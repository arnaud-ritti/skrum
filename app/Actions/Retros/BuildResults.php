<?php

namespace App\Actions\Retros;

use App\Actions\HealthCheck\BuildHealthTrend;
use App\Actions\HealthCheck\SummarizeHealthCheck;
use App\Actions\Surveys\PresentSurvey;
use App\Enums\RetroPhase;
use App\Models\Participant;
use App\Models\Retro;

class BuildResults
{
    public function __construct(
        private SummarizeHealthCheck $summarizeHealthCheck,
        private BuildHealthTrend $buildHealthTrend,
        private PresentSurvey $presentSurvey,
        private PresentParticipant $presentParticipant,
        private PresentRetroSummary $presentRetroSummary,
        private SummarizeRoti $summarizeRoti,
    ) {}

    /**
     * @param  array<int, array<string, mixed>>|null  $surveys  already presented surveys, to avoid building them twice
     * @return array{
     *     participants: array<int, array{id: string, name: string, avatarUrl: string, isGuest: bool}>,
     *     health: ?array<string, mixed>,
     *     healthTrend: ?array<int, array<string, mixed>>,
     *     surveys: array<int, array<string, mixed>>,
     *     games: null,
     *     roti: array{distribution: array<int, array{score: int, count: int}>, average: ?float, respondents: int},
     *     summary: ?array{text: ?string, generatedAt: ?string, status: ?string, provider: string}
     * }|null
     */
    public function handle(Retro $retro, Participant $viewer, ?array $surveys = null): ?array
    {
        if ($retro->phase !== RetroPhase::Completed) {
            return null;
        }

        $retro->loadMissing('participants.user');

        $health = $this->summarizeHealthCheck->handle($retro);

        return [
            'participants' => $retro->participants->map(fn (Participant $participant) => $this->presentParticipant->handle($participant))->values()->all(),
            'health' => $health,
            'healthTrend' => $health === null ? null : $this->buildHealthTrend->forViewer($retro, $viewer),
            'surveys' => $surveys ?? $this->presentSurvey->many($retro, $viewer),
            'games' => null,
            'roti' => $this->summarizeRoti->handle($retro),
            'summary' => $this->presentRetroSummary->handle($retro),
        ];
    }
}
