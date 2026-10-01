<?php

use App\Actions\Integrations\MatchIntegrationUserAccounts;
use App\Enums\ActionItemPriority;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationUserMatch;
use App\Events\ActionItems\TeamActionItemSaved;
use App\Events\Retros\ActionItemExternalLinksChanged;
use App\Events\Retros\ActionItemSaved;
use App\Events\Retros\CarriedActionItemSaved;
use App\Models\ActionItemExternalLink;
use App\Models\IntegrationUserMapping;
use App\Models\SocialAccount;
use App\Models\TeamIntegration;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
    Event::fake([ActionItemSaved::class, TeamActionItemSaved::class, CarriedActionItemSaved::class, ActionItemExternalLinksChanged::class]);
    enableIntegrations(IntegrationProvider::GitHub);
});

/**
 * @param  array<string, mixed>  $routes
 */
function fakeGitHubExport(array $routes = []): void
{
    fakeGitHubTrackerApi([
        'api.github.com/user/583231' => Http::response(['id' => 583231, 'login' => 'octocat', 'type' => 'User']),
        'api.github.com/repos/acme/api/labels/*' => Http::response(['name' => 'priority: high']),
        'api.github.com/repos/acme/api/issues' => Http::response([
            'number' => 12,
            'html_url' => 'https://github.com/acme/api/issues/12',
            'assignees' => [['login' => 'octocat']],
        ], 201),
        ...$routes,
    ]);
}

function gitHubCreatedIssuePayload(): array
{
    $request = collect(Http::recorded())
        ->map(fn (array $pair): Request => $pair[0])
        ->first(fn (Request $request): bool => $request->method() === 'POST' && $request->url() === 'https://api.github.com/repos/acme/api/issues');

    return $request?->data() ?? [];
}

it('exports an action item to a GitHub repository', function () {
    fakeGitHubExport();
    [$retro, $item, $author] = exportBoardItem(['priority' => ActionItemPriority::High, 'due_on' => '2026-10-20', 'content' => "Speed up CI\nPing @core-team"]);
    $integration = TeamIntegration::factory()->gitHub()->create(['team_id' => $retro->team_id]);
    $integration->forceFill(['settings' => [...$integration->settings, 'priorityLabels' => ['high' => 'priority: high']]])->save();
    $assignee = teamMember($retro->team);
    IntegrationUserMapping::factory()->manual()->create(['team_integration_id' => $integration->id, 'user_id' => $assignee->id, 'external_account_id' => '583231']);
    $item->update(['assignee_user_id' => $assignee->id]);

    $this->actingAs($author)
        ->postJson(route('retros.action-items.exports.store', [$retro, $item]), ['source' => 'github', 'repository_id' => '9001'])
        ->assertCreated()
        ->assertJsonPath('actionItem.externalLinks', [['source' => 'github', 'key' => 'acme/api#12', 'url' => 'https://github.com/acme/api/issues/12']])
        ->assertJsonPath('warnings', []);

    $payload = gitHubCreatedIssuePayload();

    expect($payload['title'])->toBe('Speed up CI')
        ->and($payload['assignees'])->toBe(['octocat'])
        ->and($payload['labels'])->toBe(['priority: high'])
        ->and($payload['body'])->toContain("Ping @\u{200B}core-team")
        ->and($payload['body'])->not->toContain('@core-team')
        ->and($payload['body'])->toContain('From the retrospective "Sprint 12"')
        ->and($payload['body'])->toEndWith("\n\nDue: 2026-10-20");

    $link = ActionItemExternalLink::query()->sole();

    expect($link->external_id)->toBe('9001/12')
        ->and($link->external_site)->toBe('4242')
        ->and($integration->fresh()?->setting('exportRepositoryId'))->toBe('9001');
    Http::assertSent(fn (Request $request) => $request->url() === 'https://api.github.com/repos/acme/api/labels/priority%3A%20high');
});

it('warns when GitHub drops the assignee and the label is missing', function () {
    fakeGitHubExport([
        'api.github.com/repos/acme/api/labels/*' => Http::response(['message' => 'Not Found'], 404),
        'api.github.com/repos/acme/api/issues' => Http::response(['number' => 12, 'html_url' => 'https://github.com/acme/api/issues/12', 'assignees' => []], 201),
    ]);
    [$retro, $item, $author] = exportBoardItem(['priority' => ActionItemPriority::High]);
    $integration = TeamIntegration::factory()->gitHub()->create(['team_id' => $retro->team_id]);
    $integration->forceFill(['settings' => [...$integration->settings, 'priorityLabels' => ['high' => 'urgent']]])->save();
    $assignee = teamMember($retro->team);
    IntegrationUserMapping::factory()->manual()->create(['team_integration_id' => $integration->id, 'user_id' => $assignee->id, 'external_account_id' => '583231']);
    $item->update(['assignee_user_id' => $assignee->id]);

    $response = $this->actingAs($author)
        ->postJson(route('retros.action-items.exports.store', [$retro, $item]), ['source' => 'github', 'repository_id' => '9001'])
        ->assertCreated();

    expect(array_column($response->json('warnings'), 'code'))->toBe(['assigneeRejected', 'priorityUnavailable'])
        ->and(gitHubCreatedIssuePayload())->not->toHaveKey('labels');
});

it('never builds a label path from . or ..', function () {
    fakeGitHubExport();
    [$retro, $item, $author] = exportBoardItem(['priority' => ActionItemPriority::High]);
    $integration = TeamIntegration::factory()->gitHub()->create(['team_id' => $retro->team_id]);
    $integration->forceFill(['settings' => [...$integration->settings, 'priorityLabels' => ['high' => '..']]])->save();

    $this->actingAs($author)
        ->postJson(route('retros.action-items.exports.store', [$retro, $item]), ['source' => 'github', 'repository_id' => '9001'])
        ->assertCreated()
        ->assertJsonPath('warnings.0.code', 'priorityUnavailable');

    Http::assertNotSent(fn (Request $request) => str_contains($request->url(), '/labels/'));
});

it('validates the repository id before calling GitHub', function () {
    [$retro, $item, $author] = exportBoardItem();
    TeamIntegration::factory()->gitHub()->create(['team_id' => $retro->team_id]);

    $this->actingAs($author)
        ->postJson(route('retros.action-items.exports.store', [$retro, $item]), ['source' => 'github', 'repository_id' => '../9001'])
        ->assertJsonValidationErrors('repository_id');

    Http::assertNothingSent();
});

it('lists repositories as export targets', function () {
    fakeGitHubTrackerApi();
    $integration = TeamIntegration::factory()->gitHub()->create();
    $team = $integration->team;

    $this->actingAs(integrationAdmin($team))
        ->getJson(route('teams.integrations.targets.index', [$team->workspace, $team, $integration, 'q' => 'web']))
        ->assertOk()
        ->assertExactJson(['repositories' => [['id' => '9002', 'name' => 'acme/web']], 'defaults' => ['repositoryId' => '9002']]);
});

it('maps members through their GitHub sign-in only', function () {
    fakeGitHubExport();
    $integration = TeamIntegration::factory()->gitHub()->create();
    $linked = teamMember($integration->team);
    $unlinked = teamMember($integration->team);
    SocialAccount::factory()->create(['user_id' => $linked->id, 'provider' => 'github', 'provider_user_id' => '583231']);
    SocialAccount::factory()->create(['user_id' => $unlinked->id, 'provider' => 'google', 'provider_user_id' => '583231']);

    app(MatchIntegrationUserAccounts::class)->handle($integration);

    $mapping = $integration->userMappings()->sole();

    expect($mapping->user_id)->toBe($linked->id)
        ->and($mapping->matched_by)->toBe(IntegrationUserMatch::Sso)
        ->and($mapping->external_account_id)->toBe('583231')
        ->and($mapping->external_display_name)->toBe('octocat');
    Http::assertNotSent(fn (Request $request) => str_contains($request->url(), 'search'));
});

it('searches organization members for manual mappings', function () {
    fakeGitHubTrackerApi([
        'api.github.com/orgs/acme/members*' => Http::response([
            ['id' => 583231, 'login' => 'octocat', 'type' => 'User'],
            ['id' => 2, 'login' => 'hubot', 'type' => 'User'],
        ]),
    ]);
    $integration = TeamIntegration::factory()->gitHub()->create();
    $team = $integration->team;

    $this->actingAs(integrationAdmin($team))
        ->getJson(route('teams.integrations.accounts.index', [$team->workspace, $team, $integration, 'q' => 'oct']))
        ->assertOk()
        ->assertExactJson([['accountId' => '583231', 'displayName' => 'octocat']]);
});

it('saves priority labels but never . or ..', function () {
    $integration = TeamIntegration::factory()->gitHub()->create();
    $team = $integration->team;
    $admin = integrationAdmin($team);
    $url = route('teams.integrations.update', [$team->workspace, $team, $integration]);

    $this->actingAs($admin)->patchJson($url, ['priority_labels' => ['high' => 'priority: high', 'low' => '..']])
        ->assertJsonValidationErrors('priority_labels.low');

    $this->actingAs($admin)->patchJson($url, ['priority_labels' => ['high' => ' priority: high ', 'medium' => null]])
        ->assertOk()
        ->assertJsonPath('settings.priorityLabels.high', 'priority: high')
        ->assertJsonPath('settings.priorityLabels.medium', null);

    $this->actingAs(teamMember($team))->patchJson($url, ['priority_labels' => ['high' => 'x']])->assertForbidden();
});

it('announces the sign-in match and the label in the export preview', function () {
    [$retro, $item, $author] = exportBoardItem(['priority' => ActionItemPriority::High]);
    $integration = TeamIntegration::factory()->gitHub()->create(['team_id' => $retro->team_id]);
    $integration->forceFill(['settings' => [...$integration->settings, 'priorityLabels' => ['high' => 'priority: high']]])->save();
    $assignee = teamMember($retro->team);
    SocialAccount::factory()->create(['user_id' => $assignee->id, 'provider' => 'github', 'provider_user_id' => '583231']);
    $item->update(['assignee_user_id' => $assignee->id]);

    $this->actingAs($author)
        ->getJson(route('retros.action-items.exports.preview', [$retro, $item, 'source' => 'github']))
        ->assertOk()
        ->assertExactJson(['assignee' => ['state' => 'willMatch', 'displayName' => $assignee->name], 'priority' => ['name' => 'priority: high']]);

    Http::assertNothingSent();
});

it('neutralizes mentions and Markdown in the whole issue body', function () {
    fakeGitHubExport();
    [$retro, $item, $author] = exportBoardItem(['content' => "Fix the build\n[Docs](https://evil.example) ![x](https://evil.example/x.png) <img src=x>"]);
    $retro->update(['title' => 'Sprint @acme/core']);
    TeamIntegration::factory()->gitHub()->create(['team_id' => $retro->team_id]);

    $this->actingAs($author)
        ->postJson(route('retros.action-items.exports.store', [$retro, $item]), ['source' => 'github', 'repository_id' => '9001'])
        ->assertCreated();

    $body = gitHubCreatedIssuePayload()['body'];

    expect($body)->toContain("From the retrospective \"Sprint @\u{200B}acme/core\"")
        ->and($body)->not->toContain('@acme')
        ->and($body)->toContain('\[Docs\]\(https://evil.example\)')
        ->and($body)->toContain('\<img src=x\>')
        ->and($body)->not->toContain('](')
        ->and($body)->toContain(route('workspaces.actionItems.index', ['workspace' => $item->team->workspace, 'item' => $item->id]));
});

it('refuses a repository the installation cannot access', function () {
    fakeGitHubExport(['api.github.com/repositories/*' => Http::response(gitHubRepository(7777, 'someone/public'))]);
    [$retro, $item, $author] = exportBoardItem();
    TeamIntegration::factory()->gitHub()->create(['team_id' => $retro->team_id]);

    $this->actingAs($author)
        ->postJson(route('retros.action-items.exports.store', [$retro, $item]), ['source' => 'github', 'repository_id' => '7777'])
        ->assertStatus(422);

    expect(ActionItemExternalLink::query()->count())->toBe(0);
    Http::assertNotSent(fn (Request $request) => $request->method() === 'POST' && str_contains($request->url(), '/issues'));
});
