<?php

use App\Actions\HealthCheck\BuildHealthTrend;
use App\Actions\HealthCheck\FreezeHealthStatements;
use App\Actions\HealthCheck\ManageTeamHealthStatements;
use App\Enums\RetroPhase;
use App\Models\HealthCheckAnswer;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use Illuminate\Support\Facades\DB;

/**
 * @param  array<string, int>  $scores  statement key => one participant's score
 */
function trendRetro(Team $team, array $scores, string $completedAt, array $attributes = []): Retro
{
    $retro = Retro::factory()->for($team)->withHealthCheck()->inPhase(RetroPhase::Completed)->create([
        'completed_at' => $completedAt,
        ...$attributes,
    ]);

    resolve(FreezeHealthStatements::class)->handle($retro);

    $participant = Participant::factory()->create(['retro_id' => $retro->id]);

    foreach ($scores as $statement => $score) {
        HealthCheckAnswer::factory()->create([
            'retro_id' => $retro->id,
            'participant_id' => $participant->id,
            'statement' => $statement,
            'score' => $score,
        ]);
    }

    return $retro;
}

it('lists the last six scored completed retros of the team, oldest first, with deltas', function () {
    $team = Team::factory()->create();
    $retros = collect(range(1, 8))->map(fn (int $week) => trendRetro($team, ['vision' => $week, 'motivation' => $week + 1], "2026-0{$week}-01 10:00:00"));

    trendRetro(Team::factory()->create(), ['vision' => 10], '2026-08-15 10:00:00');
    trendRetro($team, ['vision' => 10], '2026-08-20 10:00:00', ['phase' => RetroPhase::Discussing]);
    trendRetro($team, ['vision' => 10], '2026-08-21 10:00:00', ['health_check_enabled' => false]);
    trendRetro($team, [], '2026-08-22 10:00:00');

    $trend = resolve(BuildHealthTrend::class)->handle($retros->last());

    expect(collect($trend)->pluck('retroId')->all())->toBe($retros->slice(2)->pluck('id')->values()->all())
        ->and(collect($trend)->pluck('score')->all())->toBe([3.5, 4.5, 5.5, 6.5, 7.5, 8.5])
        ->and(collect($trend)->pluck('delta')->all())->toBe([null, 1.0, 1.0, 1.0, 1.0, 1.0])
        ->and($trend[0])->toMatchArray([
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
        ->and($first->healthStatements()->where('key', $custom->id)->sole()->text)->toBe('We shipped on time')
        ->and($second->healthStatements()->where('key', $custom->id)->sole()->text)->toBe('We shipped what we promised');
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
        ->and(collect($trend)->last()['score'])->toBe(5.0);
});
