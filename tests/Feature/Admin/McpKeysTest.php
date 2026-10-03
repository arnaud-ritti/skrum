<?php

use App\Enums\AuditAction;
use App\Enums\McpScope;
use App\Models\AuditEvent;
use App\Models\PersonalAccessToken;
use App\Models\User;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->actingAs(User::factory()->instanceAdmin()->create())->withSession(['auth.password_confirmed_at' => time()]);
});

it('lists the tokens of every user, newest first, with a fingerprint and no secret', function () {
    $this->travel(-1)->days();
    issueTestMcpToken(User::factory()->create(['name' => 'Ines']));
    $this->travelBack();

    $malik = User::factory()->create(['name' => 'Malik']);
    $plain = issueTestMcpToken($malik, [McpScope::Read, McpScope::Write]);

    $response = $this->get(route('admin.mcpKeys.index'))->assertInertia(fn (Assert $page) => $page
        ->component('admin/mcp-keys')
        ->where('keys.data.0.owner.name', 'Malik')
        ->where('keys.data.0.fingerprint', 'skrum_…'.substr($plain, -4))
        ->where('keys.data.0.scopes', ['mcp:read', 'mcp:write'])
        ->where('keys.data.1.owner.name', 'Ines')
        ->where('mcpEnabled', config('skrum.mcp.enabled'))
        ->where('createUrl', route('apiTokens.index')));

    expect($response->getContent())->not->toContain($plain);
});

it('revokes any token, which stops authenticating', function () {
    $owner = User::factory()->create();
    $plain = issueTestMcpToken($owner);
    $token = PersonalAccessToken::query()->sole();

    $this->delete(route('admin.mcpKeys.destroy', $token->id))->assertRedirect();

    postMcp($plain)->assertUnauthorized();
    expect(AuditEvent::query()->where('action', AuditAction::TokenRevokedByAdmin)->sole()->properties)
        ->toBeIgnoringKeyOrder(['owner' => $owner->id, 'name' => $token->name]);
});

it('answers 404 for a token that does not exist', function () {
    $this->delete(route('admin.mcpKeys.destroy', (string) Str::uuid()))->assertNotFound();

    expect(AuditEvent::query()->count())->toBe(0);
});
