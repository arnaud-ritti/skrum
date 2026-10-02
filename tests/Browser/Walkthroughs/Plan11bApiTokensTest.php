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
function p11bOwner(string $locale = 'en'): array
{
    $team = Team::factory()->create(['name' => 'Demo Team']);
    $user = teamMember($team);

    $user->forceFill(['name' => 'Fran Facilitator', 'locale' => $locale])->save();

    return [$user, $team];
}

function p11bConfirmPassword(mixed $page): mixed
{
    return $page->assertPathIs('/user/confirm-password')
        ->fill('#password', 'password')
        ->click('@confirm-password-button')
        ->assertPathIs('/settings/api-tokens');
}

function p11bRow(string $name): string
{
    return "tbody tr:has-text(\"{$name}\")";
}

function p11bCellShowsDate(string $name, int $cell, CarbonInterface $date, string $locale = 'en'): string
{
    $iso = $date->toIso8601String();

    return "Array.from(document.querySelectorAll('tbody tr')).filter((row) => row.textContent.includes('{$name}'))[0].children[{$cell}].textContent === new Intl.DateTimeFormat('{$locale}', { dateStyle: 'medium' }).format(new Date('{$iso}'))";
}

function p11bPostMcp(?string $token): TestResponse
{
    $sessionGuard = resolve('auth')->getDefaultDriver();

    $response = postMcp($token);

    resolve('auth')->shouldUse($sessionGuard);

    return $response;
}

it('[P11b-01] opens the API tokens page from the settings after a password confirmation', function () {
    [$user] = p11bOwner();

    $page = $this->signIn($user, '/settings/profile');

    $page->assertVisible('nav[aria-label="Settings"]')
        ->click('nav[aria-label="Settings"] a:has-text("API tokens")');

    p11bConfirmPassword($page)
        ->assertSee('Connect an AI assistant that supports MCP to skrum with a personal token.')
        ->assertVisible('#mcp-url')
        ->assertSee('Copy')
        ->assertSee('Data you read through this connection is sent to the AI application you use.')
        ->assertSee('Tokens stay valid after a password change. Revoke them here.')
        ->assertSee('No API tokens yet.');

    expect($page->value('#mcp-url'))->toEndWith('/mcp');
});

it('[P11b-02] creates a token with scopes, a team and an expiry, shows it once and stores only its hash', function () {
    [$user, $team] = p11bOwner();

    $page = p11bConfirmPassword($this->signIn($user, '/settings/api-tokens'));

    $page->assertSee('No API tokens yet.')
        ->click('Create token')
        ->assertVisible('#token-name')
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
        ->click('[role="dialog"] form button:has-text("Create token")')
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

    $page->assertSeeIn('[role="dialog"] [role="tabpanel"]', 'claude mcp add --transport http skrum')
        ->assertSeeIn('[role="dialog"] [role="tabpanel"]', "Authorization: Bearer {$plainText}")
        ->click('[role="tab"]:has-text("Other clients")')
        ->assertSeeIn('[role="dialog"] [role="tabpanel"]', '"mcpServers"')
        ->click('Done')
        ->assertNotPresent('[role="dialog"]')
        ->assertSeeIn(p11bRow('Walkthrough'), "skrum_…{$token->token_hint}")
        ->assertCount(p11bRow('Walkthrough').' td:nth-child(2) [data-slot="badge"]', 3)
        ->assertSeeIn(p11bRow('Walkthrough'), 'Read')
        ->assertSeeIn(p11bRow('Walkthrough'), 'Create and update')
        ->assertSeeIn(p11bRow('Walkthrough'), 'Delete my messages')
        ->assertSeeIn(p11bRow('Walkthrough'), 'Demo Team')
        ->assertSeeIn(p11bRow('Walkthrough'), 'Never')
        ->assertSeeIn(p11bRow('Walkthrough'), 'Active')
        ->assertScript(p11bCellShowsDate('Walkthrough', 4, $token->expires_at), true);

    $page->navigate('/settings/api-tokens')
        ->assertSeeIn(p11bRow('Walkthrough'), 'Demo Team')
        ->assertNotPresent('input[aria-label="API token"]')
        ->assertScript("document.documentElement.innerHTML.includes('{$secret}')", false);
});

it('[P11b-03b] shows when a token was last used after a request made with it', function () {
    [$user] = p11bOwner();
    $plainText = issueTestMcpToken($user);

    $page = p11bConfirmPassword($this->signIn($user, '/settings/api-tokens'));

    $page->assertSeeIn(p11bRow('Test client').' td:nth-child(6)', 'Never');

    p11bPostMcp($plainText)->assertOk();

    $token = PersonalAccessToken::query()->sole();

    expect($token->last_used_at)->not->toBeNull();

    $page->navigate('/settings/api-tokens')
        ->assertVisible(p11bRow('Test client'))
        ->assertScript(p11bCellShowsDate('Test client', 5, $token->last_used_at), true);
});

it('[P11b-15a] creates a read-only token bound to another team with the default expiry of 90 days', function () {
    [$user, $team] = p11bOwner();
    $other = Team::factory()->create(['workspace_id' => $team->workspace_id, 'name' => 'Other Team']);
    $other->members()->attach($user);

    $page = p11bConfirmPassword($this->signIn($user, '/settings/api-tokens'));

    $page->click('Create token')
        ->assertVisible('#token-name')
        ->fill('#token-name', 'Read only')
        ->click('#token-team')
        ->click('[role="option"]:has-text("Other Team")')
        ->assertNotPresent('[role="listbox"]')
        ->assertSeeIn('#token-team', 'Other Team')
        ->click('[role="dialog"] form button:has-text("Create token")')
        ->assertVisible('input[aria-label="API token"]')
        ->click('Done')
        ->assertNotPresent('[role="dialog"]');

    $token = PersonalAccessToken::query()->sole();

    expect($token->abilities)->toBe(['mcp:read'])
        ->and($token->team_id)->toBe($other->id)
        ->and($token->expires_at->isSameDay(now()->addDays(90)))->toBeTrue();

    $page->assertCount(p11bRow('Read only').' td:nth-child(2) [data-slot="badge"]', 1)
        ->assertSeeIn(p11bRow('Read only').' td:nth-child(2)', 'Read')
        ->assertSeeIn(p11bRow('Read only').' td:nth-child(3)', 'Other Team')
        ->assertScript(p11bCellShowsDate('Read only', 4, $token->expires_at), true);
});

it('[P11b-16] revokes a token, removes its row and refuses the next request made with it', function () {
    [$user] = p11bOwner();
    $plainText = issueTestMcpToken($user);

    p11bPostMcp($plainText)->assertOk();

    $page = p11bConfirmPassword($this->signIn($user, '/settings/api-tokens'));

    $page->assertVisible(p11bRow('Test client'))
        ->click(p11bRow('Test client').' button:has-text("Revoke")')
        ->assertSee('Revoke this token?')
        ->assertSee('Clients using "Test client" lose access on their next request.')
        ->click('[role="dialog"] button:has-text("Revoke")')
        ->assertSee('Token revoked.')
        ->assertSee('No API tokens yet.')
        ->assertNotPresent(p11bRow('Test client'));

    expect(PersonalAccessToken::query()->count())->toBe(0);

    p11bPostMcp($plainText)->assertUnauthorized();
});

it('[P11b-17] hides the API tokens entry and page and answers 404 on the MCP endpoint when MCP is off', function () {
    [$user] = p11bOwner();
    $plainText = issueTestMcpToken($user);
    config(['skrum.mcp.enabled' => false]);

    $page = $this->signIn($user, '/settings/profile');

    $page->assertVisible('nav[aria-label="Settings"]')
        ->assertSeeIn('nav[aria-label="Settings"]', 'Security')
        ->assertDontSeeIn('nav[aria-label="Settings"]', 'API tokens')
        ->navigate('/settings/api-tokens')
        ->assertSee("This page doesn't exist (anymore)")
        ->assertNotPresent('#mcp-url');

    p11bPostMcp($plainText)->assertNotFound();
    p11bPostMcp(null)->assertNotFound();
});

it('[P11b-18a] translates the API tokens page and its dialogs', function (string $locale, string $serverUrl, string $empty, string $create, string $expiration, string $allTeams, string $copyNow) {
    [$user] = p11bOwner($locale);

    $page = p11bConfirmPassword($this->signIn($user, '/settings/api-tokens'));

    $page->assertSee($serverUrl)
        ->assertSee($empty)
        ->assertDontSee('No API tokens yet.')
        ->click($create)
        ->assertVisible('#token-name')
        ->assertSee($expiration)
        ->assertSeeIn('#token-team', $allTeams)
        ->fill('#token-name', 'Walkthrough')
        ->click("[role=\"dialog\"] form button:has-text(\"{$create}\")")
        ->assertVisible('[role="dialog"] input[readonly]')
        ->assertSee($copyNow)
        ->assertDontSee('Copy your token now.');
})->with([
    'fr' => ['fr', 'URL du serveur', "Aucun jeton d'API pour le moment.", 'Créer un jeton', 'Expiration', 'Toutes mes équipes', 'Copiez votre jeton maintenant. Vous ne pourrez plus le voir ensuite.'],
    'es' => ['es', 'URL del servidor', 'Aún no hay tokens de API.', 'Crear token', 'Caducidad', 'Todos mis equipos', 'Copia tu token ahora. No podrás volver a verlo.'],
    'de' => ['de', 'Server-URL', 'Noch keine API-Tokens.', 'Token erstellen', 'Ablauf', 'Alle meine Teams', 'Kopiere dein Token jetzt. Du kannst es später nicht mehr sehen.'],
]);
