<?php

use App\Actions\HealthCheck\FreezeHealthStatements;
use App\Actions\Teams\BuildTeamMoodTrend;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\HealthCheckAnswer;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RotiVote;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Inertia\Testing\AssertableInertia as Assert;

function completedRetro(Team $team, string $completedAt, array $attributes = []): Retro
{
    return Retro::factory()->for($team)->withHealthCheck()->inPhase(RetroPhase::Completed)->create([
        'completed_at' => $completedAt,
        ...$attributes,
    ]);
}

function withHealthScores(Retro $retro, array $scoresByVoter): Retro
{
    resolve(FreezeHealthStatements::class)->handle($retro);

    foreach ($scoresByVoter as $scores) {
        $participant = Participant::factory()->create(['retro_id' => $retro->id]);

        foreach ($scores as $statement => $score) {
            HealthCheckAnswer::factory()->create([
                'retro_id' => $retro->id,
                'participant_id' => $participant->id,
                'statement' => $statement,
                'score' => $score,
            ]);
        }
    }

    return $retro;
}

function withRotiVotes(Retro $retro, array $scores): Retro
{
    foreach ($scores as $score) {
        RotiVote::factory()->create(['retro_id' => $retro->id, 'score' => $score]);
    }

    return $retro;
}

it('gives one point per completed retro with a mood or a ROTI, in date order, with nulls', function () {
    $team = Team::factory()->create();
    $moodOnly = withHealthScores(completedRetro($team, '2026-03-01 10:00:00'), [['vision' => 6, 'motivation' => 8], ['vision' => 8, 'motivation' => 8]]);
    $rotiOnly = withRotiVotes(completedRetro($team, '2026-01-01 10:00:00'), [4, 5, 3]);
    $both = withRotiVotes(withHealthScores(completedRetro($team, '2026-02-01 10:00:00'), [['vision' => 5, 'motivation' => 7]]), [2, 3]);

    $points = resolve(BuildTeamMoodTrend::class)->handle($team);

    expect(collect($points)->pluck('retroId')->all())->toBe([$rotiOnly->id, $both->id, $moodOnly->id])
        ->and($points[0])->toMatchArray([
            'title' => $rotiOnly->title,
            'completedAt' => $rotiOnly->completed_at->toIso8601String(),
            'url' => route('retros.show', $rotiOnly),
            'mood' => null,
            'moodVoters' => 0,
            'roti' => 4.0,
            'rotiVoters' => 3,
        ])
        ->and($points[1])->toMatchArray(['mood' => 6.0, 'moodVoters' => 1, 'roti' => 2.5, 'rotiVoters' => 2])
        ->and($points[2])->toMatchArray(['mood' => 7.5, 'moodVoters' => 2, 'roti' => null, 'rotiVoters' => 0]);
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
