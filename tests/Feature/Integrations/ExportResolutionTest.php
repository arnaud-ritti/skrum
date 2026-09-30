<?php

use App\Actions\Integrations\BuildIssueDraft;
use App\Actions\Integrations\ResolveExportAssignee;
use App\Actions\Integrations\ResolveExportPriority;
use App\Enums\ActionItemPriority;
use App\Enums\ExportWarningCode;
use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationUserMatch;
use App\Models\ActionItem;
use App\Models\IntegrationUserMapping;
use App\Models\Participant;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Support\Integrations\Jira\JiraCreateFields;
use App\Support\Integrations\Jira\JiraCreateMeta;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Jira, IntegrationProvider::Linear);
});

function jiraFieldsWith(array $priorities, bool $hasPriority = true, bool $hasAssignee = true): JiraCreateFields
{
    return new JiraCreateFields($hasAssignee, $hasPriority, $priorities);
}

it('builds the issue from the item and its retro', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00:00'));
    [$retro, $item, $author] = exportBoardItem(['content' => "Speed up CI\nCache the vendor folder", 'due_on' => '2026-10-20']);

    $draft = app(BuildIssueDraft::class)->handle($item->fresh());
    $link = route('workspaces.actionItems.index', ['workspace' => $retro->team->workspace, 'item' => $item->id]);

    expect($draft->title)->toBe('Speed up CI')
        ->and($draft->dueOn)->toBe('2026-10-20')
        ->and($draft->markdown())->toBe("Speed up CI\n\nCache the vendor folder\n\nFrom the retrospective \"Sprint 12\" on October 5, 2026: {$link}")
        ->and($draft->adf())->toBe(['type' => 'doc', 'version' => 1, 'content' => [
            ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'Speed up CI']]],
            ['type' => 'paragraph', 'content' => [['type' => 'text', 'text' => 'Cache the vendor folder']]],
            ['type' => 'paragraph', 'content' => [
                ['type' => 'text', 'text' => 'From the retrospective "Sprint 12" on October 5, 2026: '],
                ['type' => 'text', 'text' => $link, 'marks' => [['type' => 'link', 'attrs' => ['href' => $link]]]],
            ]],
        ]])
        ->and($draft->markdown())->not->toContain($author->name);
});

it('describes items added outside a retro and caps the title', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00:00'));
    $team = Team::factory()->create();
    $item = ActionItem::factory()->withoutRetro($team, teamMember($team))->create(['content' => str_repeat('a', 300)]);

    $draft = app(BuildIssueDraft::class)->handle($item->fresh());

    expect(mb_strlen($draft->title))->toBe(255)
        ->and($draft->origin)->toBe('Added outside a retro on October 5, 2026:');
});

it('maps Linear priorities with defaults and overrides', function (ActionItemPriority $priority, array $map, int $expected) {
    [, $item] = exportBoardItem();
    $item->update(['priority' => $priority]);
    $integration = TeamIntegration::factory()->linear()->create();
    $integration->forceFill(['settings' => [...$integration->settings, 'priorityMap' => $map]])->save();

    $resolved = app(ResolveExportPriority::class)->handle($item->fresh(), $integration);

    expect($resolved->value)->toBe($expected)->and($resolved->warning)->toBeNull();
})->with([
    'high default' => [ActionItemPriority::High, [], 2],
    'medium default' => [ActionItemPriority::Medium, [], 3],
    'low default' => [ActionItemPriority::Low, [], 4],
    'override' => [ActionItemPriority::High, ['high' => 1], 1],
    'no priority' => [ActionItemPriority::Low, ['low' => 0], 0],
]);

it('maps Jira priorities against the create screen', function (array $map, ?JiraCreateFields $fields, ?string $expected, ?ExportWarningCode $warning, ?string $name) {
    [, $item] = exportBoardItem(['priority' => ActionItemPriority::High]);
    $integration = TeamIntegration::factory()->jira()->create();
    $integration->forceFill(['settings' => [...$integration->settings, 'priorityMap' => $map]])->save();

    $resolved = app(ResolveExportPriority::class)->handle($item->fresh(), $integration, $fields);

    expect($resolved->value)->toBe($expected)
        ->and($resolved->warning)->toBe($warning)
        ->and($resolved->name)->toBe($name);
})->with([
    'default by name' => [[], jiraFieldsWith([['id' => '7', 'name' => 'HIGH']]), '7', null, 'HIGH'],
    'override allowed' => [['high' => ['id' => '1', 'name' => 'Highest']], jiraFieldsWith([['id' => '1', 'name' => 'Highest']]), '1', null, 'Highest'],
    'override not allowed' => [['high' => ['id' => '1', 'name' => 'Highest']], jiraFieldsWith([['id' => '2', 'name' => 'High']]), null, ExportWarningCode::PriorityUnavailable, 'Highest'],
    'default missing' => [[], jiraFieldsWith([['id' => '9', 'name' => 'Blocker']]), null, ExportWarningCode::PriorityUnavailable, 'High'],
    'no priority field' => [[], jiraFieldsWith([], hasPriority: false), null, ExportWarningCode::PriorityUnavailable, 'High'],
    "don't set" => [['high' => null], jiraFieldsWith([['id' => '2', 'name' => 'High']]), null, null, null],
]);

it('resolves the assignee from the mapping', function () {
    [$retro, $item] = exportBoardItem();
    $integration = TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);
    $mapped = teamMember($retro->team);
    $never = teamMember($retro->team);
    IntegrationUserMapping::factory()->manual()->create(['team_integration_id' => $integration->id, 'user_id' => $mapped->id, 'external_account_id' => 'acc-1']);
    IntegrationUserMapping::factory()->neverAssign()->create(['team_integration_id' => $integration->id, 'user_id' => $never->id]);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $resolve = app(ResolveExportAssignee::class);

    $item->update(['assignee_user_id' => $mapped->id]);
    expect($resolve->handle($item->fresh(), $integration)->accountId)->toBe('acc-1');

    $item->update(['assignee_user_id' => $never->id]);
    expect($resolve->handle($item->fresh(), $integration)->warning)->toBe(ExportWarningCode::NeverAssign);

    $item->update(['assignee_user_id' => null, 'assignee_participant_id' => $guest->id]);
    expect($resolve->handle($item->fresh(), $integration)->warning)->toBe(ExportWarningCode::GuestAssignee);

    $item->update(['assignee_participant_id' => null]);
    $none = $resolve->handle($item->fresh(), $integration);
    expect($none->accountId)->toBeNull()->and($none->warning)->toBeNull();
});

it('matches an unmapped assignee by email once and stores it', function () {
    [$retro, $item] = exportBoardItem();
    $integration = TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);
    $member = teamMember($retro->team);
    $item->update(['assignee_user_id' => $member->id]);
    Http::fake([jiraApiUrl('rest/api/3/user/search*') => Http::response([jiraAccount('acc-9', 'Grace H.')])]);

    $resolved = app(ResolveExportAssignee::class)->handle($item->fresh(), $integration);

    expect($resolved->accountId)->toBe('acc-9')
        ->and($integration->accountFor($member)?->matched_by)->toBe(IntegrationUserMatch::Email);
});

it('leaves the assignee unmapped when no lookup is possible or it fails', function (callable $setUp) {
    [$retro, $item] = exportBoardItem();
    $member = teamMember($retro->team);
    $item->update(['assignee_user_id' => $member->id]);
    $integration = $setUp($retro->team_id, $member);

    $resolved = app(ResolveExportAssignee::class)->handle($item->fresh(), $integration);

    expect($resolved->accountId)->toBeNull()
        ->and($resolved->warning)->toBe(ExportWarningCode::NotMapped)
        ->and($resolved->name)->toBe($member->name);
})->with([
    'no verified email' => [function (string $teamId, $member) {
        $member->forceFill(['email_verified_at' => null])->save();

        return TeamIntegration::factory()->jira()->create(['team_id' => $teamId]);
    }],
    'Jira without account scope' => [fn (string $teamId) => TeamIntegration::factory()->jira()->create([
        'team_id' => $teamId,
        'scopes' => ['offline_access', 'read:jira-work', 'write:jira-work'],
    ])],
    'provider error' => [function (string $teamId) {
        Http::fake([jiraApiUrl('rest/api/3/user/search*') => Http::response(['message' => 'boom'], 500)]);

        return TeamIntegration::factory()->jira()->create(['team_id' => $teamId]);
    }],
]);

it('caches the Jira create screen', function () {
    Http::fake([jiraApiUrl('rest/api/3/issue/createmeta/10000/issuetypes/11*') => Http::response(jiraCreateMeta(assignee: false))]);
    $integration = TeamIntegration::factory()->jira()->create();
    $meta = app(JiraCreateMeta::class);

    $first = $meta->fields($integration, '10000', '11');
    $meta->fields($integration, '10000', '11');

    expect($first->hasAssignee)->toBeFalse()
        ->and($first->hasPriority)->toBeTrue()
        ->and($first->priorities[0])->toBe(['id' => '2', 'name' => 'High']);
    Http::assertSentCount(1);
});

it('previews the export from stored data only', function () {
    [$retro, $item, $author] = exportBoardItem(['priority' => ActionItemPriority::Low]);
    $integration = TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);
    $mapped = teamMember($retro->team);
    $unmapped = teamMember($retro->team);
    IntegrationUserMapping::factory()->create(['team_integration_id' => $integration->id, 'user_id' => $mapped->id, 'external_account_id' => 'acc-1', 'external_display_name' => 'Ada (Jira)']);
    $preview = fn () => $this->actingAs($author)->getJson(route('retros.action-items.exports.preview', [$retro, $item]).'?source=jira');

    $item->update(['assignee_user_id' => $mapped->id]);
    $preview()->assertOk()->assertExactJson(['assignee' => ['state' => 'mapped', 'displayName' => 'Ada (Jira)'], 'priority' => ['name' => 'Low']]);

    $item->update(['assignee_user_id' => $unmapped->id]);
    $preview()->assertJsonPath('assignee', ['state' => 'willMatch', 'displayName' => $unmapped->name]);

    $integration->forceFill(['settings' => [...$integration->settings, 'priorityMap' => ['low' => null]]])->save();
    $preview()->assertJsonPath('priority.name', null);
});

it('previews for those who can export only', function () {
    [$retro, $item] = exportBoardItem();
    TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);
    [$other] = retroMember($retro);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $admin = workspaceManager($retro->team->workspace);
    $url = route('retros.action-items.exports.preview', [$retro, $item]).'?source=jira';

    $this->actingAs($other)->getJson($url)->assertForbidden();
    $this->withCookies(retroGuestCookie($guest))->withCredentials()->getJson($url)->assertForbidden();
    $this->actingAs($admin)
        ->getJson(route('workspaces.actionItemExports.preview', [$retro->team->workspace, $item]).'?source=jira')
        ->assertOk()
        ->assertJsonPath('assignee.state', 'none');
});

it('answers with the state of the export source', function () {
    [$retro, $item, $author] = exportBoardItem();
    TeamIntegration::factory()->linear(IntegrationAccess::Read)->create(['team_id' => $retro->team_id]);
    $url = fn (string $source) => route('retros.action-items.exports.preview', [$retro, $item])."?source={$source}";

    $this->actingAs($author)->getJson($url('linear'))->assertConflict()->assertJsonPath('message', 'This Linear connection is read-only.');
    $this->actingAs($author)->getJson($url('jira'))->assertConflict()->assertJsonPath('message', 'Connect Jira in the team settings.');
    $this->actingAs($author)->getJson($url('slack'))->assertUnprocessable();

    disableIntegrations();

    $this->actingAs($author)->getJson($url('jira'))->assertNotFound();
});
