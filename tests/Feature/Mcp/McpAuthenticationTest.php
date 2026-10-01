<?php

use App\Models\PersonalAccessToken;
use App\Models\User;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\Event;

function initializeMcpPayload(): array
{
    return [
        'jsonrpc' => '2.0',
        'id' => 1,
        'method' => 'initialize',
        'params' => [
            'protocolVersion' => '2025-06-18',
            'capabilities' => [],
            'clientInfo' => ['name' => 'pest', 'version' => '1.0'],
        ],
    ];
}

it('refuses requests without a bearer token', function () {
    postMcp(null)
        ->assertUnauthorized()
        ->assertHeader('WWW-Authenticate', 'Bearer realm="skrum"')
        ->assertExactJson(['error' => 'Unauthenticated.']);
});

it('serves the skrum server to a valid token', function () {
    $token = issueTestMcpToken(User::factory()->create());

    postMcp($token, initializeMcpPayload())
        ->assertOk()
        ->assertJsonPath('result.serverInfo.name', 'skrum')
        ->assertJsonPath('result.serverInfo.version', '1.0.0');

    postMcp($token)
        ->assertOk()
        ->assertJsonStructure(['result' => ['tools']]);
});

it('refuses wrong, revoked and expired tokens', function (Closure $makeToken) {
    postMcp($makeToken())
        ->assertUnauthorized()
        ->assertHeader('WWW-Authenticate', 'Bearer realm="skrum"');
})->with([
    'unknown' => fn () => 'not-a-token',
    'forged secret' => function (): string {
        $token = issueTestMcpToken(User::factory()->create());

        return explode('|', $token)[0].'|skrum_forged';
    },
    'revoked' => function (): string {
        $token = issueTestMcpToken(User::factory()->create());
        PersonalAccessToken::query()->delete();

        return $token;
    },
    'expired' => fn () => issueTestMcpToken(User::factory()->create(), expiresAt: now()->subMinute()),
]);

it('refuses a token revoked or expired after initialize', function () {
    $user = User::factory()->create();
    $revoked = issueTestMcpToken($user);
    $expiring = issueTestMcpToken($user, expiresAt: now()->addMinutes(5));

    postMcp($revoked, initializeMcpPayload())->assertOk();
    postMcp($expiring, initializeMcpPayload())->assertOk();

    PersonalAccessToken::query()->whereKey(explode('|', $revoked)[0])->delete();
    $this->travel(6)->minutes();

    postMcp($revoked, ['jsonrpc' => '2.0', 'id' => 2, 'method' => 'tools/list'], ['Mcp-Session-Id' => 'kept-by-the-client'])
        ->assertUnauthorized()
        ->assertHeader('WWW-Authenticate', 'Bearer realm="skrum"');
    postMcp($expiring, ['jsonrpc' => '2.0', 'id' => 2, 'method' => 'tools/list'], ['Mcp-Session-Id' => 'kept-by-the-client'])
        ->assertUnauthorized();
});

it('refuses a token without the read scope', function () {
    $user = User::factory()->create();
    $plainText = $user->createToken('Legacy', ['mcp:write'])->plainTextToken;

    postMcp($plainText)->assertUnauthorized();
});

it('never authenticates with a session cookie', function () {
    $user = User::factory()->create();
    $headers = ['Accept' => 'application/json, text/event-stream'];
    $payload = ['jsonrpc' => '2.0', 'id' => 1, 'method' => 'tools/list'];

    $this->actingAs($user)->postJson('/mcp', $payload, $headers)->assertUnauthorized();
    $this->actingAs($user)->postJson('/mcp', $payload, [...$headers, 'Authorization' => 'Bearer bogus'])->assertUnauthorized();
});

it('refuses users whose email is not verified', function () {
    $token = issueTestMcpToken(User::factory()->unverified()->create());

    postMcp($token)->assertUnauthorized();
});

it('answers 404 when mcp is disabled', function () {
    $token = issueTestMcpToken(User::factory()->create());
    config(['skrum.mcp.enabled' => false]);

    postMcp($token)->assertNotFound();
});

it('records when a token was last used', function () {
    $this->freezeTime();
    $token = issueTestMcpToken(User::factory()->create());

    postMcp($token)->assertOk();

    expect(PersonalAccessToken::query()->sole()->last_used_at?->toDateTimeString())->toBe(now()->toDateTimeString());
});

it('limits requests per token', function () {
    config(['skrum.mcp.rate_limit' => 2]);
    $user = User::factory()->create();
    $limited = issueTestMcpToken($user);
    $other = issueTestMcpToken($user);

    postMcp($limited)->assertOk();
    postMcp($limited)->assertOk();
    postMcp($limited)->assertTooManyRequests()
        ->assertHeader('Retry-After');

    postMcp($other)->assertOk();
});

it('answers in the user locale', function () {
    $user = User::factory()->create(['locale' => 'fr']);
    $token = issueTestMcpToken($user);

    postMcp($token)->assertOk();

    expect(app()->getLocale())->toBe('fr');
});

it('never logs the plain token', function () {
    $messages = [];
    Event::listen(MessageLogged::class, function (MessageLogged $event) use (&$messages): void {
        $messages[] = $event->message.json_encode($event->context);
    });
    $token = issueTestMcpToken(User::factory()->create());

    postMcp($token)->assertOk();
    postMcp($token.'tampered')->assertUnauthorized();

    expect(implode("\n", $messages))->not->toContain(explode('|', $token)[1]);
});

it('keeps sanctum tokens away from every other route', function () {
    $token = issueTestMcpToken(User::factory()->create());

    $this->withHeader('Authorization', "Bearer {$token}")
        ->get(route('profile.edit'))
        ->assertRedirect(route('login'));
});
