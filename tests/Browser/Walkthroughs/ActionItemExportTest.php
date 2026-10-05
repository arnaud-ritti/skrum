<?php

use App\Enums\ActionItemPriority;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\IntegrationUserMatch;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\Column;
use App\Models\IntegrationUserMapping;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

function actionItemExportPerson(User $user, string $name, string $email): User
{
    $user->forceFill(['name' => $name, 'email' => $email, 'locale' => 'en'])->save();

    return $user;
}

/**
 * @param  array<int, IntegrationProvider>  $sources
 * @return array<string, TeamIntegration>
 */
function actionItemExportConnect(Team $team, array $sources): array
{
    disableIntegrations();
    enableIntegrations(...$sources);

    $integrations = [];

    foreach ($sources as $source) {
        $factory = TeamIntegration::factory();
        $connected = $source === IntegrationProvider::Linear ? $factory->linear() : $factory->jira();

        $integrations[$source->value] = $connected->create(['team_id' => $team->id]);
    }

    return $integrations;
}

function actionItemExportRow(string $provider): string
{
    return "[data-test=\"integration-card-{$provider}\"]";
}

function actionItemExportPanel(string $provider): string
{
    return "[data-test=\"integration-panel-{$provider}\"]";
}

function actionItemExportConfigure(mixed $page, string $provider): mixed
{
    $page->click(actionItemExportRow($provider).' [data-slot="provider-row-configure"]')
        ->assertVisible(actionItemExportPanel($provider));

    return $page;
}

function actionItemExportClosePanel(mixed $page, string $provider): mixed
{
    $page->click(actionItemExportPanel($provider).' [data-slot="sheet-close-button"]')
        ->assertNotPresent(actionItemExportPanel($provider));

    return $page;
}

/**
 * @param  array<string, mixed>  $routes
 */
function actionItemExportFakeJira(array $routes = []): void
{
    $priorities = [
        ['id' => '1', 'name' => 'Highest'],
        ['id' => '2', 'name' => 'High'],
        ['id' => '3', 'name' => 'Medium'],
        ['id' => '4', 'name' => 'Low'],
    ];

    Http::fake([
        ...$routes,
        jiraApiUrl('rest/api/3/priority/search*') => Http::response(['values' => $priorities]),
        jiraApiUrl('rest/api/3/project/search*') => Http::response(['values' => [
            ['id' => '10000', 'key' => 'PROJ', 'name' => 'Project'],
        ]]),
        jiraApiUrl('rest/api/3/issuetype/project*') => Http::response([
            ['id' => '10', 'name' => 'Bug', 'subtask' => false],
            ['id' => '11', 'name' => 'Task', 'subtask' => false],
        ]),
        jiraApiUrl('rest/api/3/issue/createmeta/*') => Http::response(jiraCreateMeta(priorities: $priorities)),
        jiraApiUrl('rest/api/3/issue') => Http::response([
            'id' => '10042',
            'key' => 'PROJ-42',
            'self' => 'https://api.atlassian.com/ex/jira/cloud-1/rest/api/3/issue/10042',
        ], 201),
        'api.atlassian.com/*' => Http::response(['errorMessages' => ['Unexpected request in a browser test.']], 404),
    ]);
}

function actionItemExportLinearTeamId(): string
{
    return '6a1f0c1e-4e8b-4a55-9b53-3c0b5f1f0a01';
}

function actionItemExportFakeLinear(): void
{
    fakeLinearGraphql([
        'issueCreate' => ['issueCreate' => ['success' => true, 'issue' => [
            'id' => 'lin-issue-7',
            'identifier' => 'ENG-7',
            'url' => 'https://linear.app/acme/issue/ENG-7/write-the-runbook',
        ]]],
        'teams(first' => ['teams' => ['nodes' => [
            ['id' => actionItemExportLinearTeamId(), 'key' => 'ENG', 'name' => 'Engineering'],
        ]]],
        'users(first' => ['users' => ['nodes' => [], 'pageInfo' => ['hasNextPage' => false]]],
    ]);
}

/**
 * @param  array<int, IntegrationProvider>  $sources
 * @return array{
 *     0: Retro,
 *     1: User,
 *     2: User,
 *     3: Participant,
 *     4: array<string, TeamIntegration>
 * }
 */
function actionItemExportBoard(array $sources): array
{
    $retro = Retro::factory()
        ->inPhase(RetroPhase::Discussing)
        ->withGuestAccess()
        ->create(['title' => 'Sprint 12']);

    Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Start', 'position' => 0]);

    $integrations = actionItemExportConnect($retro->team, $sources);

    [$alice] = retroFacilitator($retro);
    [$bob, $bobParticipant] = retroMember($retro);

    actionItemExportPerson($alice, 'Alice Martin', 'alice@example.test');
    actionItemExportPerson($bob, 'Bob Stone', 'bob@example.test');

    return [$retro->fresh(), $alice, $bob, $bobParticipant, $integrations];
}

it('matches the members by email from the People panel and leaves a differing email unmapped', function () {
    config(['queue.default' => 'database']);
    $team = Team::factory()->create();
    $integrations = actionItemExportConnect($team, [IntegrationProvider::Jira, IntegrationProvider::Linear]);
    $ada = actionItemExportPerson(integrationAdmin($team), 'Ada Admin', 'ada@example.test');
    $bob = actionItemExportPerson(teamMember($team), 'Bob Member', 'bob@example.test');
    actionItemExportPerson(teamMember($team), 'Cleo Member', 'cleo@example.test');
    actionItemExportFakeJira([
        jiraApiUrl('rest/api/3/user/search*') => fn (Request $request) => Http::response(
            $request['query'] === 'bob@example.test' ? [jiraAccount('acc-bob', 'Bob (Jira)')] : [],
        ),
    ]);
    $jira = actionItemExportPanel('jira');
    $match = "{$jira} button:has-text(\"Match by email\")";

    $page = $this->signIn($ada, teamPath('teams.integrations.index', $team));

    actionItemExportConfigure($page, 'linear')
        ->assertSeeIn(actionItemExportPanel('linear'), 'Linear: emails are compared on this server.');
    actionItemExportClosePanel($page, 'linear');
    actionItemExportConfigure($page, 'jira');

    $page->assertSeeIn($jira, 'People')
        ->assertSeeIn($jira, "Jira: members' emails are looked up on your Jira site.")
        ->assertCount("{$jira} li:has-text(\"Not mapped\")", 3)
        ->assertEnabled($match)
        ->click($match)
        ->assertDisabled($match);

    expect(DB::table('jobs')->count())->toBe(1);

    $this->workQueue();

    $page->assertSeeIn("{$jira} li:has-text(\"bob@example.test\")", 'Matched by email')
        ->assertSeeIn("{$jira} li:has-text(\"bob@example.test\")", 'Bob (Jira)')
        ->assertSeeIn("{$jira} li:has-text(\"cleo@example.test\")", 'Not mapped')
        ->assertSeeIn("{$jira} li:has-text(\"ada@example.test\")", 'Not mapped')
        ->assertEnabled($match);

    Http::assertSent(fn (Request $request): bool => str_contains($request->url(), '/rest/api/3/user/search')
        && $request['query'] === 'bob@example.test');

    $mapping = IntegrationUserMapping::query()->where('team_integration_id', $integrations['jira']->id)->sole();

    expect($mapping->user_id)->toBe($bob->id)
        ->and($mapping->external_account_id)->toBe('acc-bob')
        ->and($mapping->matched_by)->toBe(IntegrationUserMatch::Email);
});

it('maps a member through the account search, sets another to never assign and resets a third', function () {
    $team = Team::factory()->create();
    $integrations = actionItemExportConnect($team, [IntegrationProvider::Jira]);
    $ada = actionItemExportPerson(integrationAdmin($team), 'Ada Admin', 'ada@example.test');
    $bob = actionItemExportPerson(teamMember($team), 'Bob Member', 'bob@example.test');
    $cleo = actionItemExportPerson(teamMember($team), 'Cleo Member', 'cleo@example.test');
    $dan = actionItemExportPerson(teamMember($team), 'Dan Member', 'dan@example.test');
    IntegrationUserMapping::factory()->create([
        'team_integration_id' => $integrations['jira']->id,
        'user_id' => $dan->id,
        'external_account_id' => 'acc-dan',
        'external_display_name' => 'Dan (Jira)',
    ]);
    actionItemExportFakeJira([
        jiraApiUrl('rest/api/3/user/search*') => Http::response([
            jiraAccount('acc-cleo', 'Cleo Stone', 'cleo.stone@corp.example'),
        ]),
        jiraApiUrl('rest/api/3/user?accountId=acc-cleo') => Http::response(
            jiraAccount('acc-cleo', 'Cleo Stone', 'cleo.stone@corp.example'),
        ),
    ]);
    $jira = actionItemExportPanel('jira');
    $picker = '[role="dialog"]:has([data-slot="account-results"])';

    $page = $this->signIn($ada, teamPath('teams.integrations.index', $team));

    actionItemExportConfigure($page, 'jira')
        ->assertSeeIn("{$jira} li:has-text(\"cleo@example.test\")", 'Not mapped')
        ->click('[aria-label="Change the Jira account of Cleo Member"]')
        ->assertSee('Choose an account…')
        ->click('Choose an account…')
        ->assertSee('Jira account of Cleo Member')
        ->assertSee('Search by name or email. Emails are not shown.')
        ->fill("{$picker} [aria-label=\"Search\"]", 'cleo')
        ->assertVisible("{$picker} button:has-text(\"Cleo Stone\")")
        ->assertDontSeeIn($picker, 'cleo.stone@corp.example')
        ->click("{$picker} button:has-text(\"Cleo Stone\")")
        ->assertNotPresent($picker)
        ->assertSeeIn("{$jira} li:has-text(\"cleo@example.test\")", 'Set manually')
        ->assertSeeIn("{$jira} li:has-text(\"cleo@example.test\")", 'Cleo Stone');

    $page->assertNotPresent('[role="menu"]')
        ->click('[aria-label="Change the Jira account of Bob Member"]')
        ->click('[role="menuitem"]:has-text("Never assign")')
        ->assertSeeIn("{$jira} li:has-text(\"bob@example.test\")", 'Never assign');

    $page->assertNotPresent('[role="menu"]')
        ->assertSeeIn("{$jira} li:has-text(\"dan@example.test\")", 'Matched by email')
        ->click('[aria-label="Change the Jira account of Dan Member"]')
        ->click('[role="menuitem"]:has-text("Reset")')
        ->assertSeeIn("{$jira} li:has-text(\"dan@example.test\")", 'Not mapped');

    Http::assertSent(fn (Request $request): bool => str_contains($request->url(), '/rest/api/3/user/search')
        && $request['query'] === 'cleo');

    $mappings = IntegrationUserMapping::query()
        ->where('team_integration_id', $integrations['jira']->id)
        ->get()
        ->keyBy('user_id');

    expect($mappings)->toHaveCount(2)
        ->and($mappings[$cleo->id]->external_account_id)->toBe('acc-cleo')
        ->and($mappings[$cleo->id]->matched_by)->toBe(IntegrationUserMatch::Manual)
        ->and($mappings[$bob->id]->external_account_id)->toBeNull()
        ->and($mappings[$bob->id]->matched_by)->toBe(IntegrationUserMatch::Manual);
});

it('saves a Jira priority for High and no Linear priority for Low', function () {
    $team = Team::factory()->create();
    $integrations = actionItemExportConnect($team, [IntegrationProvider::Jira, IntegrationProvider::Linear]);
    $ada = actionItemExportPerson(integrationAdmin($team), 'Ada Admin', 'ada@example.test');
    actionItemExportFakeJira();
    $jiraHigh = actionItemExportPanel('jira').' [aria-label="Priority for High"]';
    $linearLow = actionItemExportPanel('linear').' [aria-label="Priority for Low"]';

    $page = $this->signIn($ada, teamPath('teams.integrations.index', $team));

    actionItemExportConfigure($page, 'jira')
        ->assertSeeIn($jiraHigh, 'Default (High)')
        ->click($jiraHigh)
        ->click('[role="option"]:has-text("Highest")')
        ->assertSee('Priority mapping saved.')
        ->assertSeeIn($jiraHigh, 'Highest');

    expect($integrations['jira']->refresh()->setting('priorityMap'))
        ->toBe(['high' => ['id' => '1', 'name' => 'Highest']]);

    actionItemExportClosePanel($page, 'jira');
    actionItemExportConfigure($page, 'linear')
        ->assertSeeIn($linearLow, 'Default (Low)')
        ->click($linearLow)
        ->click('[role="option"]:has-text("No priority")')
        ->assertSeeIn($linearLow, 'No priority');

    expect($integrations['linear']->refresh()->setting('priorityMap'))->toBe(['low' => 0]);
});

it('exports a board item to Jira with the mapped assignee and priority and shows the key to members only', function () {
    [$retro, $alice, $bob, $bobParticipant, $integrations] = actionItemExportBoard([IntegrationProvider::Jira, IntegrationProvider::Linear]);
    $integrations['jira']->mergeSettings(['priorityMap' => ['high' => ['id' => '1', 'name' => 'Highest']]]);
    $cleo = actionItemExportPerson(teamMember($retro->team), 'Cleo Member', 'cleo@example.test');
    IntegrationUserMapping::factory()->manual()->create([
        'team_integration_id' => $integrations['jira']->id,
        'user_id' => $cleo->id,
        'external_account_id' => 'acc-cleo',
        'external_display_name' => 'Cleo Stone',
    ]);
    $item = ActionItem::factory()->assignedTo($cleo)->priority(ActionItemPriority::High)->create([
        'retro_id' => $retro->id,
        'created_by_participant_id' => $bobParticipant->id,
        'content' => 'Speed up CI',
        'due_on' => '2026-10-20',
    ]);
    actionItemExportFakeJira();
    actionItemExportFakeLinear();
    $export = "#action-item-{$item->id} [aria-label=\"Export\"]";
    $chip = "#action-item-{$item->id} a[href=\"https://acme.atlassian.net/browse/PROJ-42\"]";

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $guestPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $guestPage->assertSee('Speed up CI')
        ->assertNotPresent($export);

    $bobPage->assertVisible($export)
        ->click($export)
        ->assertSee('Export to Linear')
        ->click('Export to Jira')
        ->assertSeeIn('[role="dialog"] [aria-label="Project"]', 'PROJ — Project')
        ->assertSeeIn('[role="dialog"] [aria-label="Issue type"]', 'Task')
        ->assertSee('Assignee: Cleo Stone (Jira)')
        ->assertSee('Priority: Highest')
        ->assertEnabled('[role="dialog"] button:has-text("Export")')
        ->click('[role="dialog"] button:has-text("Export")')
        ->assertSee('Exported as PROJ-42.')
        ->assertNotPresent('[role="dialog"]')
        ->assertSeeIn($chip, 'PROJ-42');

    $alicePage->assertSeeIn($chip, 'PROJ-42');

    $guestPage->assertSee('Speed up CI')
        ->assertNotPresent($chip)
        ->assertDontSee('PROJ-42');

    expect(json_encode($this->snapshotOf($guestPage, "/retros/{$retro->id}/snapshot")))
        ->toContain('Speed up CI')
        ->not->toContain('PROJ-42');

    Http::assertSent(function (Request $request) use ($item): bool {
        if ($request->method() !== 'POST' || ! str_ends_with($request->url(), '/rest/api/3/issue')) {
            return false;
        }

        $fields = $request->data()['fields'];

        return $fields['summary'] === 'Speed up CI'
            && $fields['project'] === ['id' => '10000']
            && $fields['issuetype'] === ['id' => '11']
            && $fields['assignee'] === ['accountId' => 'acc-cleo']
            && $fields['priority'] === ['id' => '1']
            && $fields['duedate'] === '2026-10-20'
            && str_contains((string) json_encode($fields['description']), 'From the retrospective \"Sprint 12\"')
            && str_contains((string) json_encode($fields['description']), "action-items?item={$item->id}");
    });

    $link = ActionItemExternalLink::query()->sole();

    expect($link->action_item_id)->toBe($item->id)
        ->and($link->external_key)->toBe('PROJ-42')
        ->and($link->created_by_user_id)->toBe($bob->id);
});

it('exports a guest-assigned item to Linear unassigned and warns about it', function () {
    [$retro, , $bob, $bobParticipant, $integrations] = actionItemExportBoard([IntegrationProvider::Linear]);
    $integrations['linear']->mergeSettings(['priorityMap' => ['low' => 0]]);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Carol Guest']);
    $item = ActionItem::factory()->assignedToGuest($guest)->priority(ActionItemPriority::Low)->create([
        'created_by_participant_id' => $bobParticipant->id,
        'content' => 'Write the runbook',
    ]);
    actionItemExportFakeLinear();
    $export = "#action-item-{$item->id} [aria-label=\"Export to Linear\"]";
    $chip = "#action-item-{$item->id} a[href=\"https://linear.app/acme/issue/ENG-7/write-the-runbook\"]";

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $page->assertVisible($export)
        ->click($export)
        ->assertSeeIn('[role="dialog"] [aria-label="Linear team"]', 'ENG — Engineering')
        ->assertSee('Unassigned (guest)')
        ->assertSee('Priority: No priority')
        ->assertEnabled('[role="dialog"] button:has-text("Export")')
        ->click('[role="dialog"] button:has-text("Export")')
        ->assertSee('Exported as ENG-7.')
        ->assertSee('Guests have no Linear account, so the issue is unassigned.')
        ->assertNotPresent('[role="dialog"]')
        ->assertSeeIn($chip, 'ENG-7')
        ->assertNotPresent($export);

    Http::assertSent(function (Request $request): bool {
        if (! str_contains((string) $request['query'], 'issueCreate')) {
            return false;
        }

        $input = (array) data_get($request->data(), 'variables.input');

        return $input['teamId'] === actionItemExportLinearTeamId()
            && $input['title'] === 'Write the runbook'
            && $input['priority'] === 0
            && ! array_key_exists('assigneeId', $input);
    });

    expect(ActionItemExternalLink::query()->sole()->external_key)->toBe('ENG-7')
        ->and($integrations['linear']->refresh()->setting('exportTeamId'))->toBe(actionItemExportLinearTeamId());
});

it('creates one issue when the same export is sent twice and takes Jira out of the export menu', function () {
    [$retro, , $bob, $bobParticipant] = actionItemExportBoard([IntegrationProvider::Jira, IntegrationProvider::Linear]);
    $item = ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'created_by_participant_id' => $bobParticipant->id,
        'content' => 'Speed up CI',
    ]);
    actionItemExportFakeJira();
    actionItemExportFakeLinear();
    $exportUrl = route('retros.action-items.exports.store', [$retro, $item], false);
    $chip = "#action-item-{$item->id} a[href=\"https://acme.atlassian.net/browse/PROJ-42\"]";

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $page->assertVisible("#action-item-{$item->id} [aria-label=\"Export\"]");

    $answers = collect(range(1, 2))
        ->map(function () use ($page, $exportUrl): string {
            $answer = $this->sendFromPage($page, 'POST', $exportUrl, ['source' => 'jira', 'project_id' => '10000', 'issue_type_id' => '11']);

            return "{$answer['status']}:".($answer['body']['message'] ?? '');
        })
        ->implode(' / ');

    expect($answers)->toBe('201: / 409:Already exported as PROJ-42.');

    $page->assertSeeIn($chip, 'PROJ-42')
        ->assertNotPresent("#action-item-{$item->id} [aria-label=\"Export\"]")
        ->assertVisible("#action-item-{$item->id} [aria-label=\"Export to Linear\"]");

    expect(Http::recorded(fn (Request $request): bool => $request->method() === 'POST'
        && str_ends_with($request->url(), '/rest/api/3/issue')))->toHaveCount(1)
        ->and(ActionItemExternalLink::query()->where('action_item_id', $item->id)->count())->toBe(1);
});

it('exports an item added outside a retro from the side sheet of the global action items page', function () {
    $team = Team::factory()->create();
    actionItemExportConnect($team, [IntegrationProvider::Jira]);
    $bob = actionItemExportPerson(teamMember($team), 'Bob Stone', 'bob@example.test');
    $item = ActionItem::factory()->withoutRetro($team, $bob)->create(['content' => 'Book the room']);
    actionItemExportFakeJira();
    $sheet = '[data-slot="action-sheet"]';
    $dialog = '[role="dialog"]:has([data-slot="item-export-preview"])';
    $export = "{$sheet} [aria-label=\"Export to Jira\"]";
    $issue = 'a[href="https://acme.atlassian.net/browse/PROJ-42"]';

    $page = $this->signIn($bob, route('workspaces.actionItems.index', ['workspace' => $team->workspace, 'item' => $item->id], false));

    $page->assertSeeIn("{$sheet} h2", 'Book the room')
        ->assertVisible($export)
        ->click($export)
        ->assertSeeIn("{$dialog} [aria-label=\"Issue type\"]", 'Task')
        ->assertSeeIn($dialog, 'Unassigned')
        ->assertSeeIn($dialog, 'Priority: Medium')
        ->assertEnabled("{$dialog} button:has-text(\"Export\")")
        ->click("{$dialog} button:has-text(\"Export\")")
        ->assertSee('Exported as PROJ-42.')
        ->assertNotPresent($dialog)
        ->assertPresent("{$sheet} li {$issue}")
        ->assertNotPresent($export)
        ->keys($sheet, 'Escape')
        ->assertNotPresent($sheet)
        ->assertPresent("#action-item-{$item->id} [data-slot=\"action-row-ticket\"] {$issue}");

    Http::assertSent(function (Request $request): bool {
        if ($request->method() !== 'POST' || ! str_ends_with($request->url(), '/rest/api/3/issue')) {
            return false;
        }

        $fields = $request->data()['fields'];

        return $fields['summary'] === 'Book the room'
            && $fields['priority'] === ['id' => '3']
            && ! array_key_exists('assignee', $fields)
            && str_contains((string) json_encode($fields['description']), 'Added outside a retro on');
    });

    expect(ActionItemExternalLink::query()->sole()->action_item_id)->toBe($item->id);
});

it('asks to reconnect Linear once its access is revoked and shows it on the integrations page', function () {
    [$retro, , $bob, $bobParticipant, $integrations] = actionItemExportBoard([IntegrationProvider::Linear]);
    $ada = actionItemExportPerson(integrationAdmin($retro->team), 'Ada Admin', 'ada@example.test');
    $item = ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'created_by_participant_id' => $bobParticipant->id,
        'content' => 'Write the runbook',
    ]);
    $revoked = false;
    Http::fake(['api.linear.app/graphql' => function () use (&$revoked) {
        if ($revoked) {
            return Http::response(['errors' => [[
                'message' => 'Authentication required, not authenticated',
                'extensions' => ['code' => 'AUTHENTICATION_ERROR'],
            ]]], 401);
        }

        return Http::response(['data' => ['teams' => ['nodes' => [
            ['id' => actionItemExportLinearTeamId(), 'key' => 'ENG', 'name' => 'Engineering'],
        ]]]]);
    }]);
    $export = "#action-item-{$item->id} [aria-label=\"Export to Linear\"]";

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $page->assertVisible($export)
        ->click($export)
        ->assertSeeIn('[role="dialog"] [aria-label="Linear team"]', 'ENG — Engineering')
        ->assertEnabled('[role="dialog"] button:has-text("Export")');

    $revoked = true;

    $page->click('[role="dialog"] button:has-text("Export")')
        ->assertSee('Reconnect Linear in the team settings.')
        ->assertDontSee('Exported as');

    expect($integrations['linear']->refresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and(ActionItemExternalLink::query()->count())->toBe(0);

    $linear = actionItemExportPanel('linear');
    $admin = $this->signIn($ada, teamPath('teams.integrations.index', $retro->team));

    $admin->assertSeeIn(actionItemExportRow('linear').' [data-slot="provider-row-status"]', 'Reconnect required')
        ->assertSeeIn(actionItemExportRow('linear').' [data-slot="provider-row-configure"]', 'Reconnect');

    actionItemExportConfigure($admin, 'linear')
        ->assertVisible("{$linear} a:text-is(\"Reconnect\")")
        ->assertNotPresent("{$linear} button:has-text(\"Match by email\")");
});
