<?php

use App\Enums\IntegrationProvider;
use App\Enums\TeamRole;
use App\Http\Controllers\TeamDataController;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamSurvey;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;

it('opens the General tab to owners and admins only', function () {
    $team = Team::factory()->create(['description' => 'Product squad']);
    $route = route('teams.settings.show', [$team->workspace, $team]);

    $this->actingAs(teamMember($team, TeamRole::Facilitator))->get($route)->assertForbidden();
    $this->actingAs(teamMember($team, TeamRole::Owner))->get($route)
        ->assertInertia(fn (Assert $page) => $page
            ->component('teams/settings')
            ->where('team.description', 'Product squad')
            ->where('canDelete', false)
            ->where('sections.general', true));
    $this->actingAs(workspaceManager($team->workspace))->get($route)
        ->assertInertia(fn (Assert $page) => $page->where('canDelete', true));
});

it('opens Members & rituals to facilitators with the members read-only, and refuses members', function () {
    $team = Team::factory()->create();
    $route = route('teams.members.index', [$team->workspace, $team]);

    $this->actingAs(teamMember($team))->get($route)->assertForbidden();
    $this->actingAs(teamMember($team, TeamRole::Facilitator))->get($route)
        ->assertInertia(fn (Assert $page) => $page
            ->component('teams/members')
            ->where('canManageMembers', false)
            ->missing('availableMembers')
            ->has('roleOptions', 4)
            ->has('templates'));
});

it('sends Members & rituals the creation date of the team and whether its default template is gone', function () {
    $this->travelTo(CarbonImmutable::parse('2025-03-10 09:00', 'UTC'));
    $team = Team::factory()->create(['default_retro_template' => 'workspace:'.Str::uuid()->toString()]);
    $this->travelBack();
    $route = route('teams.members.index', [$team->workspace, $team]);
    $facilitator = teamMember($team, TeamRole::Facilitator);

    $this->actingAs($facilitator)->get($route)
        ->assertInertia(fn (Assert $page) => $page
            ->where('createdAt', '2025-03-10T09:00:00+00:00')
            ->where('defaultRetroTemplate', null)
            ->where('defaultRetroTemplateUnavailable', true));

    $team->update(['default_retro_template' => 'four_ls']);

    $this->actingAs($facilitator)->get($route)
        ->assertInertia(fn (Assert $page) => $page
            ->where('defaultRetroTemplate', 'four_ls')
            ->where('defaultRetroTemplateUnavailable', false));
});

it('sends the sprints, the next start, the time zone and the suggested facilitator to Members & rituals', function () {
    $team = Team::factory()->create(['retro_weekday' => 4]);
    teamSprint($team, 41, '2026-09-07', '2026-09-20');
    teamSprint($team, 42, '2026-09-21', '2026-10-04');
    $this->travelTo(CarbonImmutable::parse('2026-09-30 10:00', 'UTC'));

    $this->actingAs(teamMember($team, TeamRole::Facilitator))->get(route('teams.members.index', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('sprints.current.number', 42)
            ->where('sprints.list.0.number', 42)
            ->where('sprints.list.0.isCurrent', true)
            ->where('sprints.total', 2)
            ->where('sprints.nextRetro.date', '2026-10-01')
            ->where('sprints.nextStart', ['number' => 43, 'startsOn' => '2026-09-30', 'endsOn' => '2026-10-13', 'refusal' => null])
            ->where('sprints.timeZone', 'UTC')
            ->where('facilitators.suggested', null));
});

it('gives each member the date of their latest session row in this team', function () {
    $team = Team::factory()->create();
    $facilitator = teamMember($team, TeamRole::Facilitator);
    $member = teamMember($team);
    $this->travelTo(CarbonImmutable::parse('2026-09-28 10:00', 'UTC'));
    Participant::factory()->create(['retro_id' => Retro::factory()->for($team)->create()->id, 'user_id' => $member->id]);
    $this->travelTo(CarbonImmutable::parse('2026-09-30 10:00', 'UTC'));
    Participant::factory()->create(['retro_id' => Retro::factory()->create()->id, 'user_id' => $member->id]);

    $this->actingAs($facilitator)->get(route('teams.members.index', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page->where('members', fn ($members) => collect($members)->firstWhere('id', $member->id)['lastActiveAt'] === '2026-09-28T10:00:00+00:00'
            && collect($members)->firstWhere('id', $facilitator->id)['lastActiveAt'] === null));
});

it('links Data & export to the action items page filtered on the team', function () {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team, TeamRole::Owner))->get(route('teams.data.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page->where('actionItemsUrl', route('workspaces.actionItems.index', ['workspace' => $team->workspace, 'team' => $team->id])));
});

it('sends every tab the facts of the header line: description, members count and creation date', function (string $routeName) {
    enableIntegrations(IntegrationProvider::Slack);
    $this->travelTo(CarbonImmutable::parse('2025-03-10 09:00', 'UTC'));
    $team = Team::factory()->create(['description' => 'Product squad']);
    $this->travelBack();
    $owner = teamMember($team, TeamRole::Owner);
    teamMember($team);

    $this->actingAs($owner)->get(route($routeName, [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('team.description', 'Product squad')
            ->where('membersCount', 2)
            ->where('createdAt', '2025-03-10T09:00:00+00:00'));
})->with(['teams.settings.show', 'teams.data.show', 'teams.integrations.index']);

it('lists on Data & export the closed surveys the viewer may export', function () {
    $team = Team::factory()->create();
    $owner = teamMember($team, TeamRole::Owner);
    $mine = TeamSurvey::factory()->for($team)->closed()->withoutThreshold()->create(['created_by_user_id' => $owner->id]);
    TeamSurvey::factory()->for($team)->closed()->create(['created_by_user_id' => $owner->id, 'results_threshold' => 3]);
    TeamSurvey::factory()->for($team)->closed()->create(['created_by_user_id' => teamMember($team)->id]);
    TeamSurvey::factory()->for($team)->open()->create(['created_by_user_id' => $owner->id]);

    $this->actingAs($owner)->get(route('teams.data.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->component('teams/data')
            ->has('closedSurveys', 1)
            ->where('closedSurveys.0.id', $mine->id)
            ->where('closedSurveys.0.exportUrl', route('surveys.export.show', $mine)));
});

it('fills the Data & export list with older exportable surveys when the latest ones are under their threshold', function () {
    $team = Team::factory()->create();
    $owner = teamMember($team, TeamRole::Owner);
    TeamSurvey::factory()->for($team)->closed()->withoutThreshold()->count(TeamDataController::MaxSurveys)
        ->create(['created_by_user_id' => $owner->id, 'closed_at' => now()->subDay()]);
    TeamSurvey::factory()->for($team)->closed()->create(['created_by_user_id' => $owner->id, 'results_threshold' => 3]);

    $this->actingAs($owner)->get(route('teams.data.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page->has('closedSurveys', TeamDataController::MaxSurveys));
});

it('leads the team settings entry where the viewer may go, and names their role', function (?TeamRole $role, ?string $routeName) {
    $team = Team::factory()->create();
    $user = $role === null ? workspaceManager($team->workspace) : teamMember($team, $role);

    $this->actingAs($user)->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('currentTeam.viewerRole', $role?->value)
            ->where('currentTeam.settingsUrl', $routeName === null ? null : route($routeName, [$team->workspace, $team])));
})->with([
    'admin' => [null, 'teams.settings.show'],
    'owner' => [TeamRole::Owner, 'teams.settings.show'],
    'facilitator' => [TeamRole::Facilitator, 'teams.members.index'],
    'member' => [TeamRole::Member, null],
    'observer' => [TeamRole::Observer, null],
]);

it('gives the General tab the team slug and its address', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);

    $this->actingAs(teamMember($team, TeamRole::Owner))->get(route('teams.settings.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('team.slug', $team->slug)
            ->where('team.address', route('teamAddresses.show', $team->slug)));
});
