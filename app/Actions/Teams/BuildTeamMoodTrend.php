<?php

namespace App\Actions\Teams;

use App\Actions\HealthCheck\BuildHealthTrend;
use App\Enums\RetroPhase;
use App\Models\HealthCheckAnswer;
use App\Models\Retro;
use App\Models\Team;

class BuildTeamMoodTrend
{
    private const int Points = 8;

    public function __construct(private BuildHealthTrend $buildHealthTrend) {}

    /**
     * @return list<array{
     *     retroId: string,
     *     title: string,
     *     completedAt: string,
     *     url: string,
     *     mood: ?float,
     *     moodVoters: int,
     *     roti: ?float,
     *     rotiVoters: int
     * }>
     */
    public function handle(Team $team): array
    {
        $retros = Retro::query()
            ->where('team_id', $team->id)
            ->where('phase', RetroPhase::Completed)
            ->whereNotNull('completed_at')
            ->where(fn ($query) => $query->whereHas('healthCheckAnswers')->orHas('rotiVotes'))
            ->withAvg('rotiVotes', 'score')
            ->withCount('rotiVotes')
            ->orderByDesc('completed_at')
            ->get(['id', 'title', 'completed_at']);

        $scores = $this->buildHealthTrend->scores($retros->pluck('id'));

        $voters = HealthCheckAnswer::query()
            ->toBase()
            ->whereIn('retro_id', $retros->pluck('id'))
            ->selectRaw('retro_id, count(distinct participant_id) as voters')
            ->groupBy('retro_id')
            ->pluck('voters', 'retro_id');

        return $retros
            ->filter(fn (Retro $retro): bool => $scores->get($retro->id) !== null || $retro->roti_votes_count > 0)
            ->take(self::Points)
            ->reverse()
            ->map(fn (Retro $retro): array => [
                'retroId' => $retro->id,
                'title' => $retro->title,
                'completedAt' => $retro->completed_at->toIso8601String(),
                'url' => route('retros.show', $retro),
                'mood' => $scores->get($retro->id),
                'moodVoters' => $scores->get($retro->id) === null ? 0 : (int) $voters->get($retro->id, 0),
                'roti' => $retro->roti_votes_avg_score === null ? null : round((float) $retro->roti_votes_avg_score, 1),
                'rotiVoters' => (int) $retro->roti_votes_count,
            ])
            ->values()
            ->all();
    }
}
