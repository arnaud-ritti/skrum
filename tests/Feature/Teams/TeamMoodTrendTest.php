<?php

use App\Actions\HealthCheck\HealthCheckSurvey;
use App\Actions\Teams\BuildTeamMoodTrend;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RotiVote;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Inertia\Testing\AssertableInertia as Assert;

/** @param  array<string, mixed>  $attributes */
function completedRetro(Team $team, string $completedAt, array $attributes = []): Retro
{
    return Retro::factory()->for($team)->withHealthCheck()->inPhase(RetroPhase::Completed)->create([
        'completed_at' => $completedAt,
        ...$attributes,
    ]);
}

/**
 * Each voter's scores; the health check is closed at the retro's completion
 * time.
 *
 * @param  array<int, array<string, int>>  $scoresByVoter
 */
function withHealthScores(Retro $retro, array $scoresByVoter): Retro
{
    foreach ($scoresByVoter as $scores) {
        answerHealthCheck($retro, Participant::factory()->create(['retro_id' => $retro->id]), $scores);
    }

    closeHealthCheck($retro);

    return $retro;
}

/** @param  array<int, int>  $scores */
function withRotiVotes(Retro $retro, array $scores): Retro
{
    foreach ($scores as $score) {
        RotiVote::factory()->create(['retro_id' => $retro->id, 'score' => $score]);
    }

    return $retro;
}

it('gives one point per completed retro with a mood or a ROTI, in date order, with nulls', function () {
    $team = Team::factory()->create();
    $moodOnly = withHealthScores(completedRetro($team, '2026-03-01 10:00:00'), [['vision' => 3, 'motivation' => 4], ['vision' => 4, 'motivation' => 4]]);
    $rotiOnly = withRotiVotes(completedRetro($team, '2026-01-01 10:00:00'), [4, 5, 3]);
    $both = withRotiVotes(withHealthScores(completedRetro($team, '2026-02-01 10:00:00'), [['vision' => 2, 'motivation' => 4]]), [2, 3]);

    $points = resolve(BuildTeamMoodTrend::class)->handle($team);

    expect(collect($points)->pluck('retroId')->all())->toBe([$rotiOnly->id, $both->id, $moodOnly->id])
        ->and($points[0])->toMatchArray([
            'surveyId' => null,
            'title' => $rotiOnly->title,
            'completedAt' => $rotiOnly->completed_at->toIso8601String(),
            'url' => route('retros.show', $rotiOnly),
            'mood' => null,
            'moodVoters' => 0,
            'roti' => 4.0,
            'rotiVoters' => 3,
        ])
        ->and($points[1])->toMatchArray(['surveyId' => resolve(HealthCheckSurvey::class)->forRetro($both)->id, 'mood' => 3.0, 'moodVoters' => 1, 'roti' => 2.5, 'rotiVoters' => 2])
        ->and($points[2])->toMatchArray(['surveyId' => resolve(HealthCheckSurvey::class)->forRetro($moodOnly)->id, 'mood' => 3.8, 'moodVoters' => 2, 'roti' => null, 'rotiVoters' => 0]);
});

it('counts as mood voters only the people who answered the health check of that retro', function () {
    $team = Team::factory()->create();
    $retro = withHealthScores(completedRetro($team, '2026-03-01 10:00:00'), [['vision' => 3]]);
    Participant::factory()->create(['retro_id' => $retro->id]);
    $other = withHealthScores(completedRetro($team, '2026-02-01 10:00:00'), [['vision' => 2], ['vision' => 4]]);

    $points = collect(resolve(BuildTeamMoodTrend::class)->handle($team))->keyBy('retroId');

    expect($points->get($retro->id)['moodVoters'])->toBe(1)
        ->and($points->get($other->id)['moodVoters'])->toBe(2);
});

it('spreads the mood from the first to the third quartile of what each person gave on average', function () {
    $team = Team::factory()->create();
    $spread = withHealthScores(completedRetro($team, '2026-03-01 10:00:00'), [
        ['vision' => 1, 'motivation' => 2],
        ['vision' => 3, 'motivation' => 3],
        ['vision' => 4, 'motivation' => 4],
        ['vision' => 5, 'motivation' => 4],
    ]);
    $alone = withHealthScores(completedRetro($team, '2026-02-01 10:00:00'), [['vision' => 2, 'motivation' => 5]]);
    $rotiOnly = withRotiVotes(completedRetro($team, '2026-01-01 10:00:00'), [4]);

    $points = collect(resolve(BuildTeamMoodTrend::class)->handle($team))->keyBy('retroId');

    expect($points->get($spread->id))->toMatchArray(['moodQ1' => 2.6, 'moodQ3' => 4.1])
        ->and($points->get($alone->id))->toMatchArray(['moodQ1' => 3.5, 'moodQ3' => 3.5])
        ->and($points->get($rotiOnly->id))->toMatchArray(['moodQ1' => null, 'moodQ3' => null]);
});

it('skips a completed retro with neither a mood nor a ROTI vote', function () {
    $team = Team::factory()->create();
    completedRetro($team, '2026-01-01 10:00:00');
    $scored = withRotiVotes(completedRetro($team, '2026-01-02 10:00:00'), [3]);

    $points = resolve(BuildTeamMoodTrend::class)->handle($team);

    expect(collect($points)->pluck('retroId')->all())->toBe([$scored->id]);
});

it('leaves out open retros and the retros of another team', function () {
    $team = Team::factory()->create();
    $kept = withRotiVotes(completedRetro($team, '2026-01-01 10:00:00'), [3]);
    withRotiVotes(completedRetro($team, '2026-01-02 10:00:00', ['phase' => RetroPhase::Discussing]), [3]);
    withRotiVotes(completedRetro(Team::factory()->create(), '2026-01-03 10:00:00'), [3]);

    $points = resolve(BuildTeamMoodTrend::class)->handle($team);

    expect(collect($points)->pluck('retroId')->all())->toBe([$kept->id]);
});

it('keeps the eight most recent retros, oldest first', function () {
    $team = Team::factory()->create();
    $retros = collect(range(1, 10))->map(fn (int $day) => withRotiVotes(completedRetro($team, sprintf('2026-01-%02d 10:00:00', $day)), [3]));

    $points = resolve(BuildTeamMoodTrend::class)->handle($team);

    expect(collect($points)->pluck('retroId')->all())->toBe($retros->slice(2)->pluck('id')->values()->all());
});

it('defers the mood trend on the team page', function () {
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user, WorkspaceRole::Owner)->create();
    $team = Team::factory()->for($workspace)->create();
    $team->members()->attach($user);
    $retro = withRotiVotes(completedRetro($team, '2026-01-01 10:00:00'), [4]);

    $this->actingAs($user)
        ->get(route('teams.show', [$workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->component('teams/show')
            ->missing('moodTrend')
            ->loadDeferredProps('trend', fn (Assert $reload) => $reload
                ->where('moodTrend.0.retroId', $retro->id)
                ->where('moodTrend.0.roti', 4)));
});
