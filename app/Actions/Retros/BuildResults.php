<?php

namespace App\Actions\Retros;

use App\Actions\Games\BuildGamesPlayed;
use App\Actions\HealthCheck\BuildHealthTrend;
use App\Actions\HealthCheck\SummarizeHealthCheck;
use App\Actions\Integrations\LatestDeliveries;
use App\Actions\Integrations\RetroResultsRecipients;
use App\Actions\Integrations\SharePermissions;
use App\Actions\Surveys\PresentSurvey;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\RetroPhase;
use App\Models\Participant;
use App\Models\Retro;
use App\Support\Integrations\IntegrationAvailability;

class BuildResults
{
    public function __construct(
        private SummarizeHealthCheck $summarizeHealthCheck,
        private BuildHealthTrend $buildHealthTrend,
        private PresentSurvey $presentSurvey,
        private PresentParticipant $presentParticipant,
        private PresentRetroSummary $presentRetroSummary,
        private SummarizeRoti $summarizeRoti,
        private SharePermissions $sharePermissions,
        private LatestDeliveries $latestDeliveries,
        private RetroResultsRecipients $retroResultsRecipients,
        private IntegrationAvailability $integrationAvailability,
        private BuildGamesPlayed $buildGamesPlayed,
    ) {}

    /**
     * @param  array<int, array<string, mixed>>|null  $surveys  already presented surveys, to avoid building them twice
     * @return array{
     *     participants: array<int, array{id: string, name: string, avatarUrl: string, isGuest: bool}>,
     *     health: ?array<string, mixed>,
     *     healthTrend: ?array<int, array<string, mixed>>,
     *     surveys: array<int, array<string, mixed>>,
     *     games: ?array{roomId: string, rounds: array<int, array<string, mixed>>, leaderboard: array<int, array<string, mixed>>, roundsPlayed: int},
     *     roti: array{distribution: array<int, array{score: int, count: int}>, average: ?float, respondents: int},
     *     summary: ?array{text: ?string, generatedAt: ?string, status: ?string, provider: string},
     *     deliveries: array<int, array{id: string, channel: string, kind: string, status: string, error: ?string, sentAt: ?string, createdAt: ?string, requestedBy: ?string, recipientCount: ?int}>,
     *     emailRecipients: ?array{participants: int, team: int},
     *     stats: array{
     *         votesCast: int,
     *         votesAvailable: int,
     *         participation: array{participants: int, teamMembers: int},
     *         durationSeconds: ?int
     *     }
     * }|null
     */
    public function handle(Retro $retro, Participant $viewer, ?array $surveys = null): ?array
    {
        if ($retro->phase !== RetroPhase::Completed) {
            return null;
        }

        $retro->loadMissing('participants.user');

        $health = $this->summarizeHealthCheck->handle($retro);
        $canShare = $this->sharePermissions->retro($retro, $retro->participants->firstWhere('id', $viewer->id) ?? $viewer);

        return [
            'participants' => $retro->participants->map(fn (Participant $participant): array => $this->presentParticipant->handle($participant))->values()->all(),
            'health' => $health,
            'healthTrend' => $health === null ? null : $this->buildHealthTrend->forViewer($retro, $viewer),
            'surveys' => $surveys ?? $this->presentSurvey->many($retro, $viewer),
            'games' => $this->buildGamesPlayed->handle($retro),
            'roti' => $this->summarizeRoti->handle($retro),
            'summary' => $this->presentRetroSummary->handle($retro),
            'deliveries' => $canShare ? $this->latestDeliveries->handle($retro, [IntegrationDeliveryKind::RetroResults]) : [],
            'emailRecipients' => $canShare && $this->integrationAvailability->emailEnabled()
                ? $this->retroResultsRecipients->counts($retro)
                : null,
            'stats' => $this->stats($retro),
        ];
    }

    /**
     * @return array{
     *     votesCast: int,
     *     votesAvailable: int,
     *     participation: array{participants: int, teamMembers: int},
     *     durationSeconds: ?int
     * }
     */
    private function stats(Retro $retro): array
    {
        $participantCount = $retro->participants->count();

        return [
            'votesCast' => $retro->votes()->count(),
            'votesAvailable' => $participantCount * $retro->voteLimit(),
            'participation' => [
                'participants' => $participantCount,
                'teamMembers' => $retro->team->members()->count(),
            ],
            'durationSeconds' => $this->durationSeconds($retro),
        ];
    }

    private function durationSeconds(Retro $retro): ?int
    {
        if ($retro->started_at === null) {
            return null;
        }

        if ($retro->completed_at === null) {
            return null;
        }

        return (int) $retro->started_at->diffInSeconds($retro->completed_at);
    }
}
