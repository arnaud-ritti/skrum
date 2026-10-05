<?php

use App\Actions\Admin\DeactivateUser;
use App\Enums\AuditAction;
use App\Enums\McpScope;
use App\Models\AuditEvent;
use App\Models\PokerGame;
use App\Models\User;

beforeEach(function () {
    $this->admin = User::factory()->instanceAdmin()->create();
});

function asConfirmedAdmin(mixed $test): void
{
    $test->actingAs($test->admin)->withSession(['auth.password_confirmed_at' => time()]);
}

it('deactivates an account and audits it', function () {
    asConfirmedAdmin($this);
    $user = User::factory()->create();

    $this->post(route('admin.userDeactivations.store', $user))->assertRedirect();

    expect($user->fresh()->isDeactivated())->toBeTrue()
        ->and(AuditEvent::query()->where('action', AuditAction::UserDeactivated)->sole()->subject_id)->toBe($user->id);
});

it('signs a deactivated account out on its next request', function () {
    $user = User::factory()->deactivated()->create();

    $this->actingAs($user)->get(route('dashboard'))
        ->assertRedirect(route('login'))
        ->assertSessionHasErrors('email');
    $this->assertGuest();
});

it('refuses the password login of a deactivated account only with the right password', function () {
    $user = User::factory()->deactivated()->create(['password' => 'password']);

    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password'])
        ->assertSessionHasErrors(['email' => __('This account is deactivated. Ask an admin of the instance.')]);
    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'wrong'])
        ->assertSessionHasErrors(['email' => __('auth.failed')]);
    $this->assertGuest();
});

it('refuses the MCP token of a deactivated account', function () {
    $user = User::factory()->deactivated()->create();
    $token = issueTestMcpToken($user, [McpScope::Read]);

    postMcp($token)->assertUnauthorized();
});

it('refuses the broadcast authorisation of a deactivated account', function () {
    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.key' => 'test-key',
        'broadcasting.connections.reverb.secret' => 'test-secret',
        'broadcasting.connections.reverb.app_id' => 'test-app',
    ]);
    $game = PokerGame::factory()->create();
    [$user] = pokerMember($game);
    $user->forceFill(['deactivated_at' => now()])->save();

    $this->actingAs($user)
        ->postJson(route('broadcasting.auth'), channelAuthRequest("presence-poker.{$game->id}"))
        ->assertForbidden();
    $this->assertGuest();
});

it('refuses to deactivate oneself, even when another admin is active', function (bool $withAnotherAdmin) {
    asConfirmedAdmin($this);

    if ($withAnotherAdmin) {
        User::factory()->instanceAdmin()->create();
    }

    $this->post(route('admin.userDeactivations.store', $this->admin))
        ->assertSessionHasErrors(['user' => 'You cannot deactivate your own account or the last active admin.']);

    expect($this->admin->fresh()->isDeactivated())->toBeFalse()
        ->and(AuditEvent::query()->where('action', AuditAction::UserDeactivated)->exists())->toBeFalse();
})->with(['as the last active admin' => false, 'with another active admin' => true]);

it('refuses to deactivate the last active admin for another admin', function () {
    $deactivatedAdmin = User::factory()->instanceAdmin()->deactivated()->create();
    $lastActiveAdmin = $this->admin;

    $refused = resolve(DeactivateUser::class)->handle($deactivatedAdmin, $lastActiveAdmin);

    expect($refused)->toBeFalse()
        ->and($lastActiveAdmin->fresh()->isDeactivated())->toBeFalse()
        ->and(AuditEvent::query()->where('action', AuditAction::UserDeactivated)->exists())->toBeFalse();
});

it('keeps the memberships of a deactivated account', function () {
    asConfirmedAdmin($this);
    $game = PokerGame::factory()->create();
    [$user] = pokerMember($game);
    $workspacesBefore = $user->workspaces()->count();

    $this->post(route('admin.userDeactivations.store', $user))->assertRedirect();

    expect($user->workspaces()->count())->toBe($workspacesBefore)->toBeGreaterThan(0);
});

it('reactivates an account', function () {
    asConfirmedAdmin($this);
    $user = User::factory()->deactivated()->create();

    $this->delete(route('admin.userDeactivations.destroy', $user))->assertRedirect();

    expect($user->fresh()->isDeactivated())->toBeFalse()
        ->and(AuditEvent::query()->where('action', AuditAction::UserReactivated)->exists())->toBeTrue();
});

it('keeps the deactivation routes for instance admins', function () {
    $user = User::factory()->create();
    $this->actingAs(User::factory()->create())->withSession(['auth.password_confirmed_at' => time()]);

    $this->post(route('admin.userDeactivations.store', $user))->assertForbidden();
    $this->delete(route('admin.userDeactivations.destroy', $user))->assertForbidden();
    expect($user->fresh()->isDeactivated())->toBeFalse();
});

it('knows a deactivated account', function () {
    expect(User::factory()->deactivated()->create()->isDeactivated())->toBeTrue()
        ->and(User::factory()->create()->isDeactivated())->toBeFalse();
});
