<?php

use App\Enums\McpScope;
use App\Models\PersonalAccessToken;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Console\Scheduling\Event as ScheduledEvent;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

it('stores tokens with uuid ids and uuid morphs', function () {
    $user = User::factory()->create();

    $newToken = $user->createToken('Laptop', [McpScope::Read->value]);
    $token = $newToken->accessToken;

    expect($token)->toBeInstanceOf(PersonalAccessToken::class)
        ->and(Str::isUuid($token->id))->toBeTrue()
        ->and($token->tokenable_id)->toBe($user->id)
        ->and($token->tokenable_type)->toBe($user->getMorphClass());
});

it('stores only the hash of the token and prefixes it', function () {
    $user = User::factory()->create();

    $plainText = $user->createToken('Laptop', [McpScope::Read->value])->plainTextToken;
    [$id, $secret] = explode('|', $plainText, 2);

    expect(Str::isUuid($id))->toBeTrue()
        ->and($secret)->toStartWith('skrum_')
        ->and(DB::table('personal_access_tokens')->where('token', $secret)->exists())->toBeFalse()
        ->and(DB::table('personal_access_tokens')->where('token', hash('sha256', $secret))->exists())->toBeTrue()
        ->and(PersonalAccessToken::findToken($plainText)?->id)->toBe($id);
});

it('parses scopes and ignores unknown abilities', function () {
    $token = PersonalAccessToken::factory()->withScopes(McpScope::Delete)->create();
    $legacy = PersonalAccessToken::factory()->create(['abilities' => ['mcp:read', 'admin:everything']]);

    expect($token->scopes())->toBe([McpScope::Read, McpScope::Delete])
        ->and($legacy->scopes())->toBe([McpScope::Read]);
});

it('knows when it expired', function () {
    $now = CarbonImmutable::parse('2026-10-04 12:00:00');
    $expired = PersonalAccessToken::factory()->create(['expires_at' => $now->subMinute()]);
    $boundary = PersonalAccessToken::factory()->create(['expires_at' => $now]);
    $valid = PersonalAccessToken::factory()->create(['expires_at' => $now->addDay()]);
    $never = PersonalAccessToken::factory()->create(['expires_at' => null]);

    expect($expired->isExpired($now))->toBeTrue()
        ->and($boundary->isExpired($now))->toBeTrue()
        ->and($valid->isExpired($now))->toBeFalse()
        ->and($never->isExpired($now))->toBeFalse();
});

it('deletes the tokens bound to a deleted team', function () {
    $team = Team::factory()->create();
    $bound = PersonalAccessToken::factory()->boundTo($team)->create();
    $unbound = PersonalAccessToken::factory()->create();

    $team->delete();

    expect(PersonalAccessToken::query()->whereKey($bound->id)->exists())->toBeFalse()
        ->and(PersonalAccessToken::query()->whereKey($unbound->id)->exists())->toBeTrue()
        ->and($unbound->fresh()->team)->toBeNull();
});

it('prunes tokens 30 days after they expired, every day', function () {
    $event = collect(resolve(Schedule::class)->events())
        ->first(fn (ScheduledEvent $event) => str_contains((string) $event->command, 'sanctum:prune-expired --hours=720'));

    expect($event)->not->toBeNull()
        ->and($event->expression)->toBe('0 0 * * *')
        ->and($event->onOneServer)->toBeTrue();
});

it('reads the mcp configuration with its defaults', function () {
    expect(config('skrum.mcp'))->toBe([
        'enabled' => true,
        'rate_limit' => 120,
        'write_rate_limit' => 30,
    ])
        ->and(config('sanctum.guard'))->toBe([])
        ->and(config('sanctum.stateful'))->toBe([])
        ->and(config('sanctum.expiration'))->toBeNull()
        ->and(config('sanctum.token_prefix'))->toBe('skrum_');
});

it('labels scopes', function () {
    expect(McpScope::Read->label())->toBe('Read')
        ->and(McpScope::Write->label())->toBe('Create and update')
        ->and(McpScope::Delete->label())->toBe('Delete my messages');
});
