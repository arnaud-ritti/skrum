<?php

use App\Models\PersonalAccessToken;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Testing\TestResponse;

/**
 * @return array{
 *     0: User,
 *     1: Team
 * }
 */
function apiTokensOwner(string $locale = 'en'): array
{
    $team = Team::factory()->create(['name' => 'Demo Team']);
    $user = teamMember($team);

    $user->forceFill(['name' => 'Fran Facilitator', 'locale' => $locale])->save();

    return [$user, $team];
}

function apiTokensConfirmPassword(mixed $page): mixed
{
    return $page->assertPathIs('/user/confirm-password')
        ->fill('#password', 'password')
        ->click('@confirm-password-button')
        ->assertPathIs('/settings')
        ->assertScript('window.location.hash', '#api-tokens');
}

function apiTokensRow(string $name): string
{
    return "tbody tr:has-text(\"{$name}\")";
}

function apiTokensCellShowsDate(string $name, int $cell, CarbonInterface $date, string $locale = 'en'): string
{
    $iso = $date->toIso8601String();

    return "Array.from(document.querySelectorAll('tbody tr')).filter((row) => row.textContent.includes('{$name}'))[0].children[{$cell}].textContent === new Intl.DateTimeFormat('{$locale}', { dateStyle: 'medium' }).format(new Date('{$iso}'))";
}

function apiTokensPostMcp(?string $token): TestResponse
{
    $sessionGuard = resolve('auth')->getDefaultDriver();

    $response = postMcp($token);

    resolve('auth')->shouldUse($sessionGuard);

    return $response;
}

it('opens the API tokens section from the settings and shows the tokens after a password confirmation', function () {
    [$user] = apiTokensOwner();

    $page = $this->signIn($user, '/settings');

    $page->assertVisible('nav[aria-label="Settings"]')
        ->click('nav[aria-label="Settings"] a:has-text("API tokens")')
        ->assertPathIs('/settings')
        ->assertSeeIn('[data-slot="token-list-concealed"]', 'Confirm it\'s you to see your tokens.')
        ->assertNotPresent('#mcp-url')
        ->click('Show my tokens')
        ->assertSeeIn('[role="dialog"] h2', 'Confirm your password')
        ->fill('#gate-password', 'password')
        ->click('@confirm-password-button')
        ->assertNotPresent('[role="dialog"]')
        ->assertSee('Connect an AI assistant that supports MCP to skrum with a personal token.')
        ->assertVisible('#mcp-url')
        ->assertSee('Copy')
        ->assertSee('Data you read through this connection is sent to the AI application you use.')
        ->assertSee('Tokens stay valid after a password change. Revoke them here.')
        ->assertSee('No API tokens yet.')
        ->assertNotPresent('[data-slot="token-list-concealed"]');

    expect($page->value('#mcp-url'))->toEndWith('/mcp');
});

it('creates a token with scopes, a team and an expiry, shows it once and stores only its hash', function () {
    [$user, $team] = apiTokensOwner();

    $page = apiTokensConfirmPassword($this->signIn($user, '/settings/api-tokens'));

    $page->assertSee('No API tokens yet.')
        ->assertNotPresent('[role="dialog"]')
        ->assertVisible('form[aria-label="New API token"] #token-name')
        ->assertAriaAttribute('#scope-read', 'checked', 'true')
        ->assertDisabled('#scope-read')
        ->assertSeeIn('#token-team', 'All my teams')
        ->assertSeeIn('#token-expiration', '90 days')
        ->fill('#token-name', 'Walkthrough')
        ->click('#scope-write')
        ->assertAriaAttribute('#scope-write', 'checked', 'true')
        ->click('#scope-delete')
        ->assertAriaAttribute('#scope-delete', 'checked', 'true')
        ->click('#token-team')
        ->click('[role="option"]:has-text("Demo Team")')
        ->assertNotPresent('[role="listbox"]')
        ->assertSeeIn('#token-team', 'Demo Team')
        ->click('#token-expiration')
        ->click('[role="option"]:has-text("30 days")')
        ->assertNotPresent('[role="listbox"]')
        ->assertSeeIn('#token-expiration', '30 days')
        ->click('form[aria-label="New API token"] button:has-text("Create token")')
        ->assertVisible('input[aria-label="API token"]')
        ->assertSee("Copy your token now. You won't be able to see it again.");

    $plainText = $page->value('input[aria-label="API token"]');
    $secret = explode('|', $plainText, 2)[1];
    $token = PersonalAccessToken::query()->sole();

    expect($plainText)->toStartWith("{$token->id}|skrum_")
        ->and($token->token)->toBe(hash('sha256', $secret))
        ->and($token->token)->not->toBe($secret)
        ->and($token->abilities)->toBe(['mcp:read', 'mcp:write', 'mcp:delete'])
        ->and($token->team_id)->toBe($team->id)
        ->and($token->token_hint)->toBe(substr($plainText, -4))
        ->and($token->expires_at->isSameDay(now()->addDays(30)))->toBeTrue();

    $page->assertSeeIn('form[aria-label="New API token"] [role="tabpanel"]', 'claude mcp add --transport http skrum')
        ->assertSeeIn('form[aria-label="New API token"] [role="tabpanel"]', "Authorization: Bearer {$plainText}")
        ->click('[role="tab"]:has-text("Other clients")')
        ->assertSeeIn('form[aria-label="New API token"] [role="tabpanel"]', '"mcpServers"')
        ->click('Done')
        ->assertNotPresent('[data-slot="new-token-panel"]')
        ->assertSeeIn(apiTokensRow('Walkthrough'), "skrum_…{$token->token_hint}")
        ->assertCount(apiTokensRow('Walkthrough').' td:nth-child(2) [data-slot="badge"]', 3)
        ->assertSeeIn(apiTokensRow('Walkthrough'), 'Read')
        ->assertSeeIn(apiTokensRow('Walkthrough'), 'Create and update')
        ->assertSeeIn(apiTokensRow('Walkthrough'), 'Delete my messages')
        ->assertSeeIn(apiTokensRow('Walkthrough'), 'Demo Team')
        ->assertSeeIn(apiTokensRow('Walkthrough'), 'Never')
        ->assertSeeIn(apiTokensRow('Walkthrough'), 'Active')
        ->assertScript(apiTokensCellShowsDate('Walkthrough', 4, $token->expires_at), true);

    $page->navigate('/settings#api-tokens')
        ->assertSeeIn(apiTokensRow('Walkthrough'), 'Demo Team')
        ->assertNotPresent('input[aria-label="API token"]')
        ->assertScript("document.documentElement.innerHTML.includes('{$secret}')", false);
});

it('shows when a token was last used after a request made with it', function () {
    [$user] = apiTokensOwner();
    $plainText = issueTestMcpToken($user);

    $page = apiTokensConfirmPassword($this->signIn($user, '/settings/api-tokens'));

    $page->assertSeeIn(apiTokensRow('Test client').' td:nth-child(6)', 'Never');

    apiTokensPostMcp($plainText)->assertOk();

    $token = PersonalAccessToken::query()->sole();

    expect($token->last_used_at)->not->toBeNull();

    $page->navigate('/settings#api-tokens')
        ->assertVisible(apiTokensRow('Test client'))
        ->assertScript(apiTokensCellShowsDate('Test client', 5, $token->last_used_at), true);
});

it('creates a read-only token bound to another team with the default expiry of 90 days', function () {
    [$user, $team] = apiTokensOwner();
    $other = Team::factory()->create(['workspace_id' => $team->workspace_id, 'name' => 'Other Team']);
    $other->members()->attach($user);

    $page = apiTokensConfirmPassword($this->signIn($user, '/settings/api-tokens'));

    $page->assertVisible('form[aria-label="New API token"] #token-name')
        ->fill('#token-name', 'Read only')
        ->click('#token-team')
        ->click('[role="option"]:has-text("Other Team")')
        ->assertNotPresent('[role="listbox"]')
        ->assertSeeIn('#token-team', 'Other Team')
        ->click('form[aria-label="New API token"] button:has-text("Create token")')
        ->assertVisible('input[aria-label="API token"]')
        ->click('Done')
        ->assertNotPresent('[data-slot="new-token-panel"]');

    $token = PersonalAccessToken::query()->sole();

    expect($token->abilities)->toBe(['mcp:read'])
        ->and($token->team_id)->toBe($other->id)
        ->and($token->expires_at->isSameDay(now()->addDays(90)))->toBeTrue();

    $page->assertCount(apiTokensRow('Read only').' td:nth-child(2) [data-slot="badge"]', 1)
        ->assertSeeIn(apiTokensRow('Read only').' td:nth-child(2)', 'Read')
        ->assertSeeIn(apiTokensRow('Read only').' td:nth-child(3)', 'Other Team')
        ->assertScript(apiTokensCellShowsDate('Read only', 4, $token->expires_at), true);
});

it('revokes a token, removes its row and refuses the next request made with it', function () {
    [$user] = apiTokensOwner();
    $plainText = issueTestMcpToken($user);

    apiTokensPostMcp($plainText)->assertOk();

    $page = apiTokensConfirmPassword($this->signIn($user, '/settings/api-tokens'));

    $page->assertVisible(apiTokensRow('Test client'))
        ->click(apiTokensRow('Test client').' button:has-text("Revoke")')
        ->assertSee('Revoke this token?')
        ->assertSee('Clients using "Test client" lose access on their next request.')
        ->click('[role="alertdialog"] button:has-text("Revoke")')
        ->assertSee('Token revoked.')
        ->assertSee('No API tokens yet.')
        ->assertNotPresent(apiTokensRow('Test client'));

    expect(PersonalAccessToken::query()->count())->toBe(0);

    apiTokensPostMcp($plainText)->assertUnauthorized();
});

it('hides the API tokens entry and page and answers 404 on the MCP endpoint when MCP is off', function () {
    [$user] = apiTokensOwner();
    $plainText = issueTestMcpToken($user);
    config(['skrum.mcp.enabled' => false]);

    $page = $this->signIn($user, '/settings');

    $page->assertVisible('nav[aria-label="Settings"]')
        ->assertSeeIn('nav[aria-label="Settings"]', 'Security')
        ->assertDontSeeIn('nav[aria-label="Settings"]', 'API tokens')
        ->navigate('/settings/api-tokens')
        ->assertSee("This page doesn't exist (anymore)")
        ->assertSeeIn('[data-slot="error-page"][data-status="404"]', 'ERROR 404')
        ->assertNotPresent('#mcp-url');

    apiTokensPostMcp($plainText)->assertNotFound();
    apiTokensPostMcp(null)->assertNotFound();
});

it('translates the API tokens page, its form and its copy-once panel', function (string $locale, string $serverUrl, string $empty, string $create, string $expiration, string $allTeams, string $copyNow) {
    [$user] = apiTokensOwner($locale);

    $page = apiTokensConfirmPassword($this->signIn($user, '/settings/api-tokens'));

    $page->assertSee($serverUrl)
        ->assertSee($empty)
        ->assertDontSee('No API tokens yet.')
        ->assertVisible('[data-slot="create-token-form"] #token-name')
        ->assertSee($expiration)
        ->assertSeeIn('#token-team', $allTeams)
        ->fill('#token-name', 'Walkthrough')
        ->click("[data-slot=\"create-token-form\"] button:has-text(\"{$create}\")")
        ->assertVisible('[data-slot="new-token-panel"] input[readonly]')
        ->assertSee($copyNow)
        ->assertDontSee('Copy your token now.');
})->with([
    'fr' => ['fr', 'URL du serveur', "Aucun jeton d'API pour le moment.", 'Créer un jeton', 'Expiration', 'Toutes mes équipes', 'Copie ton jeton maintenant. Tu ne pourras plus le voir ensuite.'],
    'es' => ['es', 'URL del servidor', 'Aún no hay tokens de API.', 'Crear token', 'Caducidad', 'Todos mis equipos', 'Copia tu token ahora. No podrás volver a verlo.'],
    'de' => ['de', 'Server-URL', 'Noch keine API-Tokens.', 'Token erstellen', 'Ablauf', 'Alle meine Teams', 'Kopiere dein Token jetzt. Du kannst es später nicht mehr sehen.'],
]);
