<?php

use App\Enums\ActionItemPriority;
use App\Enums\ActionItemRecurrence;
use App\Enums\ExportWarningCode;
use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\RetroPhase;
use App\Events\ActionItems\TeamActionItemSaved;
use App\Events\Retros\ActionItemExternalLinksChanged;
use App\Events\Retros\ActionItemSaved;
use App\Events\Retros\CarriedActionItemSaved;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\IntegrationUserMapping;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamIntegration;
use Illuminate\Http\Client\Request as HttpClientRequest;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Tests\Support\SqlProbe;

const ExportLinearTeamId = '6a1f0c1e-4e8b-4a55-9b53-3c0b5f1f0a01';

beforeEach(function () {
    Http::preventStrayRequests();
    Event::fake([ActionItemSaved::class, TeamActionItemSaved::class, CarriedActionItemSaved::class, ActionItemExternalLinksChanged::class]);
    enableIntegrations(IntegrationProvider::Jira, IntegrationProvider::Linear);
});

function fakeJiraIssueCreation(?array $createMeta = null, mixed $create = null): void
{
    Http::fake([
        jiraApiUrl('rest/api/3/issue/createmeta/*') => Http::response($createMeta ?? jiraCreateMeta()),
        jiraApiUrl('rest/api/3/issue') => $create ?? Http::response(['id' => '10042', 'key' => 'PROJ-42', 'self' => 'https://api.atlassian.com/ex/jira/cloud-1/rest/api/3/issue/10042'], 201),
    ]);
}

/**
 * @return array<string, mixed>
 */
function jiraCreatePayload(int $index = 0): array
{
    $requests = collect(Http::recorded())
        ->map(fn (array $pair): HttpClientRequest => $pair[0])
        ->filter(fn (HttpClientRequest $request): bool => $request->method() === 'POST' && str_ends_with($request->url(), '/rest/api/3/issue'))
        ->values();

    return $requests[$index]->data()['fields'];
}

/**
 * @param  array<string, mixed>  $body
 */
function jiraExportRequest(Retro $retro, ActionItem $item, array $body = []): array
{
    return [route('retros.action-items.exports.store', [$retro, $item]), ['source' => 'jira', 'project_id' => '10000', 'issue_type_id' => '11', ...$body]];
}

it('exports a board item to Jira', function () {
    fakeJiraIssueCreation();
    [$retro, $item, $author] = exportBoardItem(['priority' => ActionItemPriority::High, 'due_on' => '2026-10-20']);
    $integration = TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);
    $assignee = teamMember($retro->team);
    IntegrationUserMapping::factory()->manual()->create(['team_integration_id' => $integration->id, 'user_id' => $assignee->id, 'external_account_id' => 'acc-1']);
    $item->update(['assignee_user_id' => $assignee->id]);

    $this->actingAs($author)->postJson(...jiraExportRequest($retro, $item))
        ->assertCreated()
        ->assertJsonCount(1, 'actionItem.externalLinks')
        ->assertJsonPath('actionItem.externalLinks.0.source', 'jira')
        ->assertJsonPath('actionItem.externalLinks.0.key', 'PROJ-42')
        ->assertJsonPath('actionItem.externalLinks.0.url', 'https://acme.atlassian.net/browse/PROJ-42')
        ->assertJsonPath('actionItem.externalLinks.0.syncState', 'off')
        ->assertJsonPath('warnings', []);

    $fields = jiraCreatePayload();

    expect($fields['project'])->toBe(['id' => '10000'])
        ->and($fields['issuetype'])->toBe(['id' => '11'])
        ->and($fields['summary'])->toBe('Speed up CI')
        ->and($fields['duedate'])->toBe('2026-10-20')
        ->and($fields['priority'])->toBe(['id' => '2'])
        ->and($fields['assignee'])->toBe(['accountId' => 'acc-1'])
        ->and($fields['description']['type'])->toBe('doc')
        ->and(json_encode($fields))->toContain('From the retrospective \"Sprint 12\"')
        ->and(json_encode($fields))->not->toContain($author->name);

    $link = ActionItemExternalLink::query()->sole();

    expect($link->external_id)->toBe('10042')
        ->and($link->external_site)->toBe('cloud-1')
        ->and($link->created_by_user_id)->toBe($author->id)
        ->and($integration->fresh()->setting('exportProjectId'))->toBe('10000')
        ->and($integration->fresh()->setting('exportIssueTypeId'))->toBe('11');
});

it('leaves the due date out of a Jira project whose create screen has no due date', function () {
    fakeJiraIssueCreation(jiraCreateMeta(dueDate: false));
    [$retro, $item, $author] = exportBoardItem(['due_on' => '2026-10-20']);
    TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);

    $this->actingAs($author)->postJson(...jiraExportRequest($retro, $item))
        ->assertCreated()
        ->assertJsonPath('actionItem.externalLinks.0.key', 'PROJ-42');

    expect(jiraCreatePayload())->not->toHaveKey('duedate')
        ->and(jiraCreatePayload()['summary'])->toBe('Speed up CI');
});

it('exports to Linear with a Markdown body', function () {
    fakeLinearGraphql(['issueCreate' => ['issueCreate' => ['success' => true, 'issue' => [
        'id' => 'lin-issue-1', 'identifier' => 'ENG-7', 'url' => 'https://linear.app/acme/issue/ENG-7/speed-up-ci',
    ]]]]);
    [$retro, $item, $author] = exportBoardItem();
    $integration = TeamIntegration::factory()->linear()->create(['team_id' => $retro->team_id]);

    $this->actingAs($author)
        ->postJson(route('retros.action-items.exports.store', [$retro, $item]), ['source' => 'linear', 'team_id' => ExportLinearTeamId])
        ->assertCreated()
        ->assertJsonPath('actionItem.externalLinks.0.key', 'ENG-7');

    Http::assertSent(function (HttpClientRequest $request): bool {
        $input = ((array) $request['variables'])['input'] ?? [];

        return str_contains((string) $request['query'], 'issueCreate')
            && $input['teamId'] === ExportLinearTeamId
            && $input['title'] === 'Speed up CI'
            && $input['priority'] === 3
            && ! array_key_exists('assigneeId', $input)
            && str_contains($input['description'], 'From the retrospective "Sprint 12"');
    });

    expect($integration->fresh()->setting('exportTeamId'))->toBe(ExportLinearTeamId);
});

it('exports items added outside a retro from the global page', function () {
    fakeJiraIssueCreation();
    $team = Team::factory()->create();
    $author = teamMember($team);
    TeamIntegration::factory()->jira()->create(['team_id' => $team->id]);
    $item = ActionItem::factory()->withoutRetro($team, $author)->create(['content' => 'Book the room']);

    $this->actingAs($author)
        ->postJson(route('workspaces.actionItemExports.store', [$team->workspace, $item]), ['source' => 'jira', 'project_id' => '10000', 'issue_type_id' => '11'])
        ->assertCreated();

    expect(json_encode(jiraCreatePayload()))->toContain('Added outside a retro on');
});

it('exports each occurrence of a recurring item separately', function () {
    fakeJiraIssueCreation(create: Http::sequence()
        ->push(['id' => '1', 'key' => 'PROJ-1'], 201)
        ->push(['id' => '2', 'key' => 'PROJ-2'], 201));
    $team = Team::factory()->create();
    $author = teamMember($team);
    TeamIntegration::factory()->jira()->create(['team_id' => $team->id]);
    $first = ActionItem::factory()->withoutRetro($team, $author)->recurring(ActionItemRecurrence::Weekly)->create(['due_on' => '2026-10-05']);
    $next = ActionItem::factory()->withoutRetro($team, $author)->recurring(ActionItemRecurrence::Weekly)->create(['due_on' => '2026-10-12', 'previous_occurrence_id' => $first->id]);
    $body = ['source' => 'jira', 'project_id' => '10000', 'issue_type_id' => '11'];

    $this->actingAs($author)->postJson(route('workspaces.actionItemExports.store', [$team->workspace, $first]), $body)->assertCreated();
    $this->actingAs($author)->postJson(route('workspaces.actionItemExports.store', [$team->workspace, $next]), $body)->assertCreated();

    expect(ActionItemExternalLink::query()->orderBy('external_key')->pluck('external_key')->all())->toBe(['PROJ-1', 'PROJ-2']);
});

it('creates one issue for a double submit', function () {
    fakeJiraIssueCreation();
    [$retro, $item, $author] = exportBoardItem();
    TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);

    $this->actingAs($author)->postJson(...jiraExportRequest($retro, $item))->assertCreated();
    $this->actingAs($author)->postJson(...jiraExportRequest($retro, $item))
        ->assertConflict()
        ->assertJsonPath('message', 'Already exported as PROJ-42.');

    expect(collect(Http::recorded())->filter(fn (array $pair): bool => $pair[0]->method() === 'POST'))->toHaveCount(1)
        ->and(ActionItemExternalLink::query()->count())->toBe(1);
});

it('rolls back the link when the provider refuses the issue', function () {
    fakeJiraIssueCreation(create: Http::response(['errorMessages' => ['The project is archived.'], 'errors' => []], 400));
    [$retro, $item, $author] = exportBoardItem();
    TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);

    $this->actingAs($author)->postJson(...jiraExportRequest($retro, $item))
        ->assertUnprocessable()
        ->assertJsonPath('message', 'The project is archived.');

    expect(ActionItemExternalLink::query()->count())->toBe(0);
    Event::assertNotDispatched(ActionItemExternalLinksChanged::class);
});

it('warns that a timed out issue may exist', function () {
    fakeJiraIssueCreation(create: Http::failedConnection('cURL error 28: Operation timed out'));
    [$retro, $item, $author] = exportBoardItem();
    TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);

    $this->actingAs($author)->postJson(...jiraExportRequest($retro, $item))
        ->assertStatus(502)
        ->assertJsonPath('message', 'The issue may have been created. Check Jira before trying again.');

    expect(ActionItemExternalLink::query()->count())->toBe(0);
});

it('keeps the reconnect-required status after a rolled back export', function () {
    fakeLinearUserDirectoryGraphql(['issueCreate' => fn () => Http::response(['errors' => [['message' => 'Authentication required', 'extensions' => ['code' => 'AUTHENTICATION_ERROR']]]], 401)]);
    [$retro, $item, $author] = exportBoardItem();
    $integration = TeamIntegration::factory()->linear()->create(['team_id' => $retro->team_id]);

    $this->actingAs($author)
        ->postJson(route('retros.action-items.exports.store', [$retro, $item]), ['source' => 'linear', 'team_id' => ExportLinearTeamId])
        ->assertConflict()
        ->assertJsonPath('message', 'Reconnect Linear in the team settings.')
        ->assertJsonPath('reason', 'reconnect_required');

    expect($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and(ActionItemExternalLink::query()->count())->toBe(0);
});

it('keeps a refreshed token when the export fails', function () {
    Http::fake(['auth.atlassian.com/oauth/token' => Http::response([
        'access_token' => 'jira-access-2',
        'refresh_token' => 'jira-refresh-2',
        'expires_in' => 3600,
        'scope' => 'offline_access read:jira-work write:jira-work read:jira-user',
    ])]);
    fakeJiraIssueCreation(create: Http::response(['errorMessages' => ['Nope.']], 400));
    [$retro, $item, $author] = exportBoardItem();
    $integration = TeamIntegration::factory()->jira()->expiring()->create(['team_id' => $retro->team_id]);

    $this->actingAs($author)->postJson(...jiraExportRequest($retro, $item))->assertUnprocessable();

    expect($integration->fresh()->credential('access_token'))->toBe('jira-access-2')
        ->and($integration->fresh()->credential('refresh_token'))->toBe('jira-refresh-2');
    Http::assertSent(fn (HttpClientRequest $request) => str_ends_with($request->url(), '/rest/api/3/issue') && $request->hasHeader('Authorization', 'Bearer jira-access-2'));
});

it('rolls back when Jira answers without a usable issue key', function () {
    fakeJiraIssueCreation(create: Http::response(['id' => '10042', 'key' => ''], 201));
    [$retro, $item, $author] = exportBoardItem();
    TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);

    $this->actingAs($author)->postJson(...jiraExportRequest($retro, $item))
        ->assertStatus(502)
        ->assertJsonPath('message', 'The issue may have been created. Check Jira before trying again.');

    expect(ActionItemExternalLink::query()->count())->toBe(0);
});

it('rolls back when Linear answers without a usable identifier or url', function (array $issue) {
    fakeLinearGraphql(['issueCreate' => ['issueCreate' => ['success' => true, 'issue' => ['id' => 'lin-issue-1', ...$issue]]]]);
    [$retro, $item, $author] = exportBoardItem();
    TeamIntegration::factory()->linear()->create(['team_id' => $retro->team_id]);

    $this->actingAs($author)
        ->postJson(route('retros.action-items.exports.store', [$retro, $item]), ['source' => 'linear', 'team_id' => ExportLinearTeamId])
        ->assertStatus(502)
        ->assertJsonPath('message', 'The issue may have been created. Check Linear before trying again.');

    expect(ActionItemExternalLink::query()->count())->toBe(0);
})->with([
    'missing identifier' => [['url' => 'https://linear.app/acme/issue/ENG-7']],
    'malformed identifier' => [['identifier' => 'eng 7', 'url' => 'https://linear.app/acme/issue/ENG-7']],
    'missing url' => [['identifier' => 'ENG-7']],
    'non-https url' => [['identifier' => 'ENG-7', 'url' => 'javascript:alert(1)']],
]);

it('leaves the retro row unlocked while the provider answers', function () {
    fakeJiraIssueCreation();
    [$retro, $item, $author] = exportBoardItem();
    TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);

    $lockedTables = SqlProbe::lockedTables(fn () => $this->actingAs($author)->postJson(...jiraExportRequest($retro, $item))->assertCreated());

    expect($lockedTables)->toContain('action_items')->not->toContain('retros');
})->skip(fn () => ! SqlProbe::rowLocksExist(), 'This engine has no row lock: its write transactions are serialised instead.');

it('keeps settings saved by an admin during the export', function () {
    [$retro, $item, $author] = exportBoardItem();
    $integration = TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);
    Http::fake([
        jiraApiUrl('rest/api/3/issue/createmeta/*') => Http::response(jiraCreateMeta()),
        jiraApiUrl('rest/api/3/issue') => function () use ($integration) {
            $concurrent = TeamIntegration::query()->findOrFail($integration->id);
            $concurrent->forceFill(['settings' => [...$concurrent->settings, 'priorityMap' => ['high' => null]]])->save();

            return Http::response(['id' => '10042', 'key' => 'PROJ-42'], 201);
        },
    ]);

    $this->actingAs($author)->postJson(...jiraExportRequest($retro, $item))->assertCreated();

    expect($integration->fresh()->setting('priorityMap'))->toBe(['high' => null])
        ->and($integration->fresh()->setting('exportProjectId'))->toBe('10000');
});

it('refuses guests and members who cannot edit the item', function () {
    [$retro, $item] = exportBoardItem();
    TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);
    [$other] = retroMember($retro);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->actingAs($other)->postJson(...jiraExportRequest($retro, $item))->assertForbidden();

    resolve('auth')->forgetGuards();

    $this->withCookies(retroGuestCookie($guest))->withCredentials()->postJson(...jiraExportRequest($retro, $item))->assertForbidden();

    Http::assertNothingSent();
});

it('lets the facilitator and workspace admins export', function (string $role) {
    fakeJiraIssueCreation();
    [$retro, $item] = exportBoardItem();
    TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);

    $response = match ($role) {
        'facilitator' => $this->actingAs(retroFacilitator($retro)[0])->postJson(...jiraExportRequest($retro, $item)),
        'workspace admin' => $this->actingAs(workspaceManager($retro->team->workspace))
            ->postJson(route('workspaces.actionItemExports.store', [$retro->team->workspace, $item]), ['source' => 'jira', 'project_id' => '10000', 'issue_type_id' => '11']),
    };

    $response->assertCreated();
})->with(['facilitator', 'workspace admin']);

it('answers with the state of the connection and validates the target', function () {
    [$retro, $item, $author] = exportBoardItem();
    TeamIntegration::factory()->linear(IntegrationAccess::Read)->create(['team_id' => $retro->team_id]);
    $url = route('retros.action-items.exports.store', [$retro, $item]);

    $this->actingAs($author)->postJson($url, ['source' => 'linear', 'team_id' => ExportLinearTeamId])
        ->assertConflict()
        ->assertJsonPath('message', 'This Linear connection is read-only.');
    $this->actingAs($author)->postJson($url, ['source' => 'jira', 'project_id' => '10000', 'issue_type_id' => '11'])
        ->assertConflict()
        ->assertJsonPath('message', 'Connect Jira in the team settings.');
    $this->actingAs($author)->postJson($url, ['source' => 'jira', 'project_id' => '../10000', 'issue_type_id' => '11'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('project_id');
    $this->actingAs($author)->postJson($url, ['source' => 'linear', 'team_id' => 'ENG'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('team_id');

    disableIntegrations();

    $this->actingAs($author)->postJson($url, ['source' => 'linear', 'team_id' => ExportLinearTeamId])->assertNotFound();
});

it('freezes items of a locked running retro', function () {
    [$retro, $item, $author] = exportBoardItem();
    $retro->forceFill(['phase' => RetroPhase::Discussing, 'is_locked' => true])->save();
    TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);

    $this->actingAs($author)->postJson(...jiraExportRequest($retro, $item))->assertStatus(423);

    Http::assertNothingSent();
});

it('exports with an assignee refused by Jira', function () {
    fakeJiraIssueCreation(create: Http::sequence()
        ->push(['errorMessages' => [], 'errors' => ['assignee' => 'User cannot be assigned issues.']], 400)
        ->push(['id' => '10042', 'key' => 'PROJ-42'], 201));
    [$retro, $item, $author] = exportBoardItem();
    $integration = TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);
    $assignee = teamMember($retro->team);
    IntegrationUserMapping::factory()->manual()->create(['team_integration_id' => $integration->id, 'user_id' => $assignee->id, 'external_account_id' => 'acc-1']);
    $item->update(['assignee_user_id' => $assignee->id]);

    $this->actingAs($author)->postJson(...jiraExportRequest($retro, $item))
        ->assertCreated()
        ->assertJsonPath('warnings', [[
            'code' => 'assigneeRejected',
            'message' => "Jira refused {$assignee->name} as assignee for this project, so the issue is unassigned.",
        ]]);

    expect(jiraCreatePayload(0))->toHaveKey('assignee')
        ->and(jiraCreatePayload(1))->not->toHaveKey('assignee')
        ->and($integration->accountFor($assignee)?->external_account_id)->toBe('acc-1');
});

it('exports without assignee or priority fields on the create screen', function () {
    fakeJiraIssueCreation(createMeta: jiraCreateMeta(assignee: false, priority: false));
    [$retro, $item, $author] = exportBoardItem(['priority' => ActionItemPriority::High]);
    $integration = TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);
    $assignee = teamMember($retro->team);
    IntegrationUserMapping::factory()->manual()->create(['team_integration_id' => $integration->id, 'user_id' => $assignee->id, 'external_account_id' => 'acc-1']);
    $item->update(['assignee_user_id' => $assignee->id]);

    $this->actingAs($author)->postJson(...jiraExportRequest($retro, $item))
        ->assertCreated()
        ->assertJsonPath('warnings', [
            ['code' => 'assigneeUnavailable', 'message' => "This Jira project doesn't accept an assignee on creation."],
            ['code' => 'priorityUnavailable', 'message' => "Priority High isn't available in this project; Jira's default was used."],
        ]);

    expect(jiraCreatePayload())->not->toHaveKey('assignee')->not->toHaveKey('priority');
});

it('warns about guest assignees and unmapped members', function (string $case, string $code, ?string $message) {
    fakeJiraIssueCreation();
    [$retro, $item, $author] = exportBoardItem();
    $integration = TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);
    $member = teamMember($retro->team);
    $member->forceFill(['name' => 'Grace', 'email_verified_at' => null])->save();

    if ($case === 'guest') {
        $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Robin']);
        $item->update(['assignee_participant_id' => $guest->id]);
    }

    if ($case !== 'guest') {
        $item->update(['assignee_user_id' => $member->id]);
    }

    if ($case === 'never') {
        IntegrationUserMapping::factory()->neverAssign()->create(['team_integration_id' => $integration->id, 'user_id' => $member->id]);
    }

    $this->actingAs($author)->postJson(...jiraExportRequest($retro, $item))
        ->assertCreated()
        ->assertJsonPath('warnings', [['code' => $code, 'message' => $message]]);

    expect(json_encode(jiraCreatePayload()))->not->toContain('Grace');
})->with([
    'guest' => ['guest', 'guestAssignee', 'Guests have no Jira account, so the issue is unassigned.'],
    'unmapped' => ['unmapped', 'notMapped', 'Grace has no Jira account mapped, so the issue is unassigned.'],
    'never assign' => ['never', 'neverAssign', null],
]);

it('broadcasts the export to members of running boards', function () {
    fakeJiraIssueCreation();
    [$retro, $item, $author] = exportBoardItem();
    $retro->forceFill(['phase' => RetroPhase::Discussing])->save();
    TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);

    $this->actingAs($author)->postJson(...jiraExportRequest($retro, $item))->assertCreated();

    Event::assertDispatched(fn (ActionItemSaved $event) => $event->actionItem['externalLinks'] === null);
    Event::assertDispatched(TeamActionItemSaved::class);
    Event::assertDispatched(fn (ActionItemExternalLinksChanged $event) => $event->retroId === $retro->id
        && $event->externalLinks[0]['key'] === 'PROJ-42');
});

it('names the Jira product that refused the assignee', function () {
    expect(ExportWarningCode::AssigneeUnavailable->message(IntegrationProvider::JiraDataCenter))
        ->toBe("This Jira Data Center project doesn't accept an assignee on creation.");
});
