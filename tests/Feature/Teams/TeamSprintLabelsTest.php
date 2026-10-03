<?php

use App\Actions\Teams\BuildTeamMoodTrend;
use App\Actions\Teams\PresentNewSessionOptions;
use App\Enums\RetroPhase;
use App\Models\Retro;
use App\Models\RotiVote;
use App\Models\Team;
use Carbon\CarbonImmutable;
use Inertia\Testing\AssertableInertia as Assert;

function atlasTeam(): Team
{
    $team = Team::factory()->create(['retro_weekday' => 4, 'retro_time' => '14:00']);
    teamSprint($team, 41, '2026-09-07', '2026-09-20');
    teamSprint($team, 42, '2026-09-21', '2026-10-04');
    teamSprint($team, 43, '2026-10-05', '2026-10-18');

    return $team;
}

it('shows the current sprint and the next retro on the team page', function () {
    $team = atlasTeam();
    $this->travelTo(CarbonImmutable::parse('2026-09-30 10:00', 'UTC'));

    $this->actingAs(teamMember($team))->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('schedule.sprint.number', 42)
            ->where('schedule.sprint.startsOn', '2026-09-21')
            ->where('schedule.nextRetro', ['date' => '2026-10-01', 'time' => '14:00'])
            ->where('hasSprints', true));
});

it('moves the next retro to the next sprint once the day has passed, and has none without a next sprint', function () {
    $team = atlasTeam();
    $this->travelTo(CarbonImmutable::parse('2026-10-01 15:00', 'UTC'));
    $member = teamMember($team);
    $page = fn () => $this->actingAs($member)->get(route('teams.show', [$team->workspace, $team]));

    $page()->assertInertia(fn (Assert $page) => $page->where('schedule.nextRetro.date', '2026-10-15'));

    $team->sprints()->where('number', 43)->delete();

    $page()->assertInertia(fn (Assert $page) => $page->where('schedule.sprint.number', 42)->where('schedule.nextRetro', null));
});

it('sends no schedule before the first sprint, and says the team has none', function () {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page->where('schedule', null)->where('hasSprints', false));
});

it('labels a trend point, a retro header, a live retro tile and the new retro name with the sprint of the day', function () {
    $team = atlasTeam();
    $this->travelTo(CarbonImmutable::parse('2026-09-10 09:00', 'UTC'));
    $closed = Retro::factory()->for($team)->create(['phase' => RetroPhase::Completed, 'completed_at' => now()]);
    RotiVote::factory()->create(['retro_id' => $closed->id, 'score' => 4]);
    $this->travelTo(CarbonImmutable::parse('2026-09-30 09:00', 'UTC'));
    $open = Retro::factory()->for($team)->create();
    $member = teamMember($team);
    [$viewer] = retroMember($open);

    expect(resolve(BuildTeamMoodTrend::class)->handle($team)[0]['sprintLabel'])->toBe('S41')
        ->and(resolve(PresentNewSessionOptions::class)->handle($member, $team->workspace, $team)['currentSprintNumber'])->toBe(42);

    $this->actingAs($viewer)->getJson(route('retros.snapshot.show', $open))->assertJsonPath('retro.sprintNumber', 42);

    $this->actingAs($member)->get(route('workspaces.show', $team->workspace))
        ->assertInertia(fn (Assert $page) => $page->where('teams.0.activity.openRetroSprint', 42));
});

it('gives no label to a retro created between two sprints', function () {
    $team = Team::factory()->create();
    teamSprint($team, 41, '2026-09-07', '2026-09-20');
    $this->travelTo(CarbonImmutable::parse('2026-09-25 09:00', 'UTC'));
    $retro = Retro::factory()->for($team)->create();
    [$viewer] = retroMember($retro);

    $this->actingAs($viewer)->getJson(route('retros.snapshot.show', $retro))->assertJsonPath('retro.sprintNumber', null);
});
