<?php

use App\Actions\HealthCheck\BuildHealthTrend;
use App\Actions\HealthCheck\HealthCheckSurvey;
use App\Actions\HealthCheck\ManageTeamHealthStatements;
use App\Enums\RetroPhase;
use App\Enums\TeamSurveyStatus;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Support\Surveys\HealthScale;
use Illuminate\Support\Facades\DB;

/**
 * One participant's scores on ten, as before plan 19, read on the health
 * scale; the health check is closed at the retro's completion time.
 *
 * @param  array<string, int>  $scores  statement key => one participant's score
 */
function trendRetro(Team $team, array $scores, string $completedAt, array $attributes = []): Retro
{
    $retro = Retro::factory()->for($team)->withHealthCheck()->inPhase(RetroPhase::Completed)->create([
        'completed_at' => $completedAt,
        ...$attributes,
    ]);

    if ($scores !== []) {
        answerHealthCheck($retro, Participant::factory()->create(['retro_id' => $retro->id]), $scores, HealthScale::LegacyMax);
    }

    closeHealthCheck($retro);

    return $retro;
}

it('lists the last six scored completed retros of the team, oldest first, with deltas', function () {
    $team = Team::factory()->create();
    $retros = collect(range(1, 8))->map(fn (int $week) => trendRetro($team, ['vision' => $week, 'motivation' => $week + 1], "2026-0{$week}-01 10:00:00"));

    trendRetro(Team::factory()->create(), ['vision' => 10], '2026-08-15 10:00:00');
    trendRetro($team, ['vision' => 10], '2026-08-20 10:00:00', ['phase' => RetroPhase::Discussing]);
    $removed = trendRetro($team, ['vision' => 10], '2026-08-21 10:00:00');
    resolve(HealthCheckSurvey::class)->forRetro($removed)->update(['status' => TeamSurveyStatus::Draft]);
    trendRetro($team, [], '2026-08-22 10:00:00');

    $trend = resolve(BuildHealthTrend::class)->handle($retros->last());

    expect(collect($trend)->pluck('retroId')->all())->toBe($retros->slice(2)->pluck('id')->values()->all())
        ->and(collect($trend)->pluck('score')->all())->toBe([1.8, 2.3, 2.8, 3.3, 3.8, 4.3])
        ->and(collect($trend)->pluck('delta')->all())->toBe([null, 0.5, 0.5, 0.5, 0.5, 0.5])
        ->and($trend[0])->toMatchArray([
            'surveyId' => resolve(HealthCheckSurvey::class)->forRetro($retros[2])->id,
            'title' => $retros[2]->title,
            'completedAt' => $retros[2]->completed_at->toIso8601String(),
            'url' => route('retros.show', $retros[2]),
            'sameStatements' => true,
        ]);
});

it('flags a point whose statement set differs from the previous one', function () {
    $team = Team::factory()->create();
    trendRetro($team, ['vision' => 6], '2026-05-01 10:00:00');

    resolve(ManageTeamHealthStatements::class)->archive($team, 'motivation');

    trendRetro($team, ['vision' => 7], '2026-06-01 10:00:00');
    $latest = trendRetro($team, ['vision' => 8], '2026-07-01 10:00:00');

    expect(collect(resolve(BuildHealthTrend::class)->handle($latest))->pluck('sameStatements')->all())->toBe([true, false, true]);
});

it('keeps a reworded custom statement comparable across retros', function () {
    $team = Team::factory()->create();
    $manage = resolve(ManageTeamHealthStatements::class);
    $custom = $manage->add($team, 'We shipped on time', 'Delivery');

    $first = trendRetro($team, [$custom->id => 5], '2026-05-01 10:00:00');

    $manage->reword($team, $custom->id, 'We shipped what we promised', 'Promises');

    $second = trendRetro($team, [$custom->id => 7], '2026-06-01 10:00:00');

    expect(collect(resolve(BuildHealthTrend::class)->handle($second))->pluck('sameStatements')->all())->toBe([true, true])
        ->and(resolve(HealthCheckSurvey::class)->forRetro($first)->questions()->where('match_key', $custom->id)->sole()->label)->toBe('We shipped on time')
        ->and(resolve(HealthCheckSurvey::class)->forRetro($second)->questions()->where('match_key', $custom->id)->sole()->label)->toBe('We shipped what we promised');
});

it('scores each health check from the answers to its own questions, on the health scale', function () {
    $team = Team::factory()->create();
    $retro = trendRetro($team, ['vision' => 4, 'motivation' => 8], '2026-05-01 10:00:00');
    $other = trendRetro($team, ['vision' => 10, 'motivation' => 10], '2026-06-01 10:00:00');
    answerHealthCheck($retro, Participant::factory()->create(['retro_id' => $retro->id]), ['vision' => 7]);
    $surveys = collect([$retro, $other])->map(fn (Retro $own) => resolve(HealthCheckSurvey::class)->forRetro($own));

    $scores = resolve(BuildHealthTrend::class)->scoresOf($surveys);

    expect($scores->all())->toBe([$surveys[0]->id => 3.4, $surveys[1]->id => 5.0]);
});

it('leaves out a health check closed by hand while its retro is still running', function () {
    $team = Team::factory()->create();
    $completed = trendRetro($team, ['vision' => 6], '2026-05-01 10:00:00');
    trendRetro($team, ['vision' => 8], '2026-05-02 10:00:00', ['phase' => RetroPhase::Discussing]);

    expect(collect(resolve(BuildHealthTrend::class)->forTeam($team->id))->pluck('retroId')->all())->toBe([$completed->id]);
});

it('builds the trend with a constant number of queries', function () {
    $team = Team::factory()->create();
    $countQueries = function (Retro $retro): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        resolve(BuildHealthTrend::class)->handle($retro);
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    $small = $countQueries(trendRetro($team, ['vision' => 5], '2026-05-01 10:00:00'));

    foreach (range(6, 9) as $month) {
        $latest = trendRetro($team, ['vision' => 5, 'motivation' => 6, 'processes' => 7], "2026-0{$month}-01 10:00:00");
    }

    expect($countQueries($latest))->toBe($small);
});

it('never builds the trend for guests', function () {
    $retro = trendRetro(Team::factory()->create(), ['vision' => 5], '2026-05-01 10:00:00');
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    [, $member] = retroMember($retro);

    expect(resolve(BuildHealthTrend::class)->forViewer($retro, $guest))->toBeNull()
        ->and(resolve(BuildHealthTrend::class)->forViewer($retro, $member))->toHaveCount(1);
});

it('includes the viewed retro when it is not the latest', function () {
    $team = Team::factory()->create();
    $retros = collect(range(1, 8))->map(fn (int $month) => trendRetro($team, ['vision' => $month], "2026-0{$month}-01 10:00:00"));

    $trend = resolve(BuildHealthTrend::class)->handle($retros[4]);

    expect(collect($trend)->pluck('retroId')->all())->toBe($retros->slice(0, 5)->pluck('id')->values()->all())
        ->and(collect($trend)->last()['score'])->toBe(2.5);
});
