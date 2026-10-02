<?php

use App\Enums\McpScope;
use App\Enums\WorkspaceRole;
use App\Models\PersonalAccessToken;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Inertia\Support\SessionKey;
use Inertia\Testing\AssertableInertia as Assert;

function apiTokenOwner(): User
{
    return User::factory()->create();
}

it('asks for the password before showing or creating tokens', function () {
    $user = apiTokenOwner();

    $this->actingAs($user)
        ->get(route('apiTokens.index'))
        ->assertRedirect(route('password.confirm'));

    $this->actingAs($user)
        ->post(route('apiTokens.store'), ['name' => 'Laptop', 'expiration' => '90_days'])
        ->assertRedirect(route('password.confirm'));

    expect(PersonalAccessToken::query()->count())->toBe(0);
});

it('requires a verified email', function () {
    $user = User::factory()->unverified()->create();

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('apiTokens.index'))
        ->assertRedirect(route('verification.notice'));
});

it('lists the user tokens without their secrets', function () {
    $user = apiTokenOwner();
    $team = Team::factory()->withMember($user)->create(['name' => 'Platform']);
    $team->workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
    $active = PersonalAccessToken::factory()->forUser($user)->withScopes(McpScope::Write)->boundTo($team)
        ->create(['name' => 'Claude Code', 'token_hint' => 'ab12']);
    PersonalAccessToken::factory()->forUser($user)->expired()->create(['name' => 'Old laptop']);
    PersonalAccessToken::factory()->create(['name' => 'Somebody else']);

    $response = $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('apiTokens.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/api-tokens')
            ->has('tokens', 2)
            ->where('mcpUrl', url('/mcp'))
            ->where('defaultExpiration', '90_days')
            ->has('expirationOptions', 4)
            ->has('teamGroups', 1)
            ->where('teamGroups.0.teams.0.name', 'Platform')
            ->where('teams', fn ($teams): bool => collect($teams)->isNotEmpty() && collect($teams)->every(fn (array $team): bool => array_keys($team) === ['id', 'name'])));

    $tokens = collect($response->viewData('page')['props']['tokens'])->keyBy('name');

    expect($tokens['Claude Code'])->toMatchArray([
        'id' => $active->id,
        'hint' => 'ab12',
        'scopes' => ['mcp:read', 'mcp:write'],
        'team' => ['id' => $team->id, 'name' => 'Platform'],
        'teamAccessible' => true,
        'isExpired' => false,
        'lastUsedAt' => null,
    ])
        ->and($tokens['Old laptop']['isExpired'])->toBeTrue()
        ->and(json_encode($response->viewData('page')['props']))->not->toContain($active->token);

    $props = json_encode($response->viewData('page')['props']);

    foreach (PersonalAccessToken::query()->pluck('token') as $storedHash) {
        expect($props)->not->toContain($storedHash);
    }

    expect($response->viewData('page')['props']['tokens'])->each->not->toHaveKeys(['token', 'plainText', 'plainTextToken']);
});

it('throttles token creation to ten attempts a minute', function () {
    $user = apiTokenOwner();
    $request = fn () => $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->post(route('apiTokens.store'), ['name' => '', 'expiration' => '90_days']);

    foreach (range(1, 10) as $attempt) {
        $request()->assertStatus(302);
    }

    $request()->assertStatus(429);
});

it('flags tokens bound to a team the user can no longer see', function () {
    $user = apiTokenOwner();
    $team = Team::factory()->create();
    PersonalAccessToken::factory()->forUser($user)->boundTo($team)->create(['name' => 'Former team']);

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('apiTokens.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('tokens.0.name', 'Former team')
            ->where('tokens.0.teamAccessible', false));
});

it('creates a token and shows it only once', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-04 10:00:00'));
    $user = apiTokenOwner();
    $team = Team::factory()->withMember($user)->create();

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => now()->timestamp])
        ->post(route('apiTokens.store'), [
            'name' => 'Claude Code',
            'scopes' => [McpScope::Write->value],
            'team_id' => $team->id,
            'expiration' => '30_days',
        ])
        ->assertRedirect()
        ->assertSessionHasNoErrors()
        ->assertInertiaFlash('newToken.name', 'Claude Code');

    $plainText = session()->get(SessionKey::FLASH_DATA)['newToken']['plainText'];
    $token = PersonalAccessToken::query()->sole();

    expect($plainText)->toStartWith("{$token->id}|skrum_")
        ->and($token->abilities)->toBe(['mcp:read', 'mcp:write'])
        ->and($token->team_id)->toBe($team->id)
        ->and($token->token_hint)->toBe(substr($plainText, -4))
        ->and($token->expires_at?->toDateTimeString())->toBe('2026-11-03 10:00:00')
        ->and($token->token)->not->toBe(explode('|', $plainText, 2)[1]);

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => now()->timestamp])
        ->get(route('apiTokens.index'))
        ->assertInertiaFlashMissing('newToken');
});

it('always grants read and never everything', function () {
    $user = apiTokenOwner();

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->post(route('apiTokens.store'), ['name' => 'Wildcard', 'scopes' => ['*'], 'expiration' => '90_days'])
        ->assertSessionHasErrors('scopes.0');

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->post(route('apiTokens.store'), ['name' => 'Reader', 'expiration' => '90_days'])
        ->assertSessionHasNoErrors();

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->post(route('apiTokens.store'), [
            'name' => 'Everything',
            'scopes' => [McpScope::Delete->value, McpScope::Write->value, McpScope::Write->value],
            'expiration' => '90_days',
        ])
        ->assertSessionHasNoErrors();

    expect(PersonalAccessToken::query()->where('name', 'Reader')->sole()->abilities)->toBe(['mcp:read'])
        ->and(PersonalAccessToken::query()->where('name', 'Everything')->sole()->abilities)->toBe(['mcp:read', 'mcp:write', 'mcp:delete']);
});

it('offers four expirations', function (string $expiration, ?string $expected) {
    $this->travelTo(CarbonImmutable::parse('2026-10-04 10:00:00'));
    $user = apiTokenOwner();

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => now()->timestamp])
        ->post(route('apiTokens.store'), ['name' => 'Laptop', 'expiration' => $expiration])
        ->assertSessionHasNoErrors();

    expect(PersonalAccessToken::query()->sole()->expires_at?->toDateTimeString())->toBe($expected);
})->with([
    '30 days' => ['30_days', '2026-11-03 10:00:00'],
    '90 days' => ['90_days', '2027-01-02 10:00:00'],
    '1 year' => ['1_year', '2027-10-04 10:00:00'],
    'never' => ['never', null],
]);

it('refuses unknown expirations', function () {
    $this->actingAs(apiTokenOwner())
        ->withSession(['auth.password_confirmed_at' => time()])
        ->post(route('apiTokens.store'), ['name' => 'Laptop', 'expiration' => 'forever'])
        ->assertSessionHasErrors('expiration');
});

it('keeps token names unique per user', function () {
    $user = apiTokenOwner();
    PersonalAccessToken::factory()->forUser($user)->create(['name' => 'Laptop']);
    PersonalAccessToken::factory()->create(['name' => 'Desktop']);

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->post(route('apiTokens.store'), ['name' => 'Laptop', 'expiration' => '90_days'])
        ->assertSessionHasErrors(['name' => 'You already have a token with this name.']);

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->post(route('apiTokens.store'), ['name' => 'Desktop', 'expiration' => '90_days'])
        ->assertSessionHasNoErrors();
});

it('limits a user to 25 active tokens', function () {
    $user = apiTokenOwner();
    PersonalAccessToken::factory()->forUser($user)->count(24)->create();
    PersonalAccessToken::factory()->forUser($user)->expired()->count(3)->create();

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->post(route('apiTokens.store'), ['name' => 'Twenty-fifth', 'expiration' => '90_days'])
        ->assertSessionHasNoErrors();

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->post(route('apiTokens.store'), ['name' => 'Twenty-sixth', 'expiration' => '90_days'])
        ->assertSessionHasErrors(['name' => 'You can have at most 25 active tokens.']);

    expect($user->tokens()->count())->toBe(28);
});

it('binds tokens only to teams the user can see', function () {
    $user = apiTokenOwner();
    $managed = Workspace::factory()->withMember($user, WorkspaceRole::Admin)->create();
    $managedTeam = Team::factory()->create(['workspace_id' => $managed->id]);
    $foreignTeam = Team::factory()->create();

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->post(route('apiTokens.store'), ['name' => 'Foreign', 'team_id' => $foreignTeam->id, 'expiration' => '90_days'])
        ->assertSessionHasErrors(['team_id' => 'Choose a team you can see.']);

    $this->actingAs($user)
        ->withSession(['auth.password_confirmed_at' => time()])
        ->post(route('apiTokens.store'), ['name' => 'Managed', 'team_id' => $managedTeam->id, 'expiration' => '90_days'])
        ->assertSessionHasNoErrors();

    expect(PersonalAccessToken::query()->sole()->team_id)->toBe($managedTeam->id);
});

it('revokes only the user own tokens', function () {
    $user = apiTokenOwner();
    $own = PersonalAccessToken::factory()->forUser($user)->create();
    $other = PersonalAccessToken::factory()->create();

    $this->actingAs($user)
        ->delete(route('apiTokens.destroy', $other->id))
        ->assertNotFound();

    $this->actingAs($user)
        ->delete(route('apiTokens.destroy', $own->id))
        ->assertRedirect();

    expect(PersonalAccessToken::query()->whereKey($own->id)->exists())->toBeFalse()
        ->and(PersonalAccessToken::query()->whereKey($other->id)->exists())->toBeTrue();
});

it('hides the api tokens pages when mcp is disabled', function () {
    config(['skrum.mcp.enabled' => false]);
    $user = apiTokenOwner();
    $token = PersonalAccessToken::factory()->forUser($user)->create();

    $this->actingAs($user)->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('apiTokens.index'))->assertNotFound();
    $this->actingAs($user)->withSession(['auth.password_confirmed_at' => time()])
        ->post(route('apiTokens.store'), ['name' => 'Laptop', 'expiration' => '90_days'])->assertNotFound();
    $this->actingAs($user)
        ->delete(route('apiTokens.destroy', $token->id))->assertNotFound();

    $this->actingAs($user)
        ->get(route('profile.edit'))
        ->assertInertia(fn (Assert $page) => $page->where('features.mcp', false));
});

it('shares that mcp is enabled', function () {
    $this->actingAs(apiTokenOwner())
        ->get(route('profile.edit'))
        ->assertInertia(fn (Assert $page) => $page->where('features.mcp', true));
});
