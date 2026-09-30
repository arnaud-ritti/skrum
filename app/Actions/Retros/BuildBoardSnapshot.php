<?php

namespace App\Actions\Retros;

use App\Actions\HealthCheck\PresentHealthCheck;
use App\Actions\Surveys\PresentSurvey;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Http\Controllers\EmojiDataController;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\CardComment;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;
use App\Support\Gifs\GifCatalog;
use App\Support\Llm\Llm;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class BuildBoardSnapshot
{
    public function __construct(
        private PresentCard $presentCard,
        private PresentColumns $presentColumns,
        private PresentActionItem $presentActionItem,
        private SummarizeReactions $summarizeReactions,
        private PresentComment $presentComment,
        private GifCatalog $gifCatalog,
        private PresentHealthCheck $presentHealthCheck,
        private PresentSurvey $presentSurvey,
        private PresentParticipant $presentParticipant,
        private BuildResults $buildResults,
        private BuildInsights $buildInsights,
        private SuggestionGuard $suggestionGuard,
        private Llm $llm,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function handle(Retro $retro, Participant $viewer): array
    {
        $retro->loadMissing([
            'team.workspace',
            'participants.user',
            'cards.participant.user',
            'cards.reactions.participant.user',
            'cards.comments.participant.user',
            'actionItems.assignee.user',
        ]);

        $showsTotals = in_array($retro->phase, [RetroPhase::Discussing, RetroPhase::Completed], true)
            || ($retro->phase === RetroPhase::Voting && ! $retro->hide_vote_counts);

        [$votesVersion, $voteTotals, $myVotes] = $this->readVotes($retro, $viewer);

        $surveys = $this->presentSurvey->many($retro, $viewer);

        return [
            'retro' => [
                'id' => $retro->id,
                'title' => $retro->title,
                'template' => $retro->template,
                'phase' => $retro->phase->value,
                'phases' => array_map(fn (RetroPhase $phase) => $phase->value, $retro->phases()),
                'healthCheckEnabled' => $retro->health_check_enabled,
                'icebreakerEnabled' => $retro->icebreaker_enabled,
                'isAnonymous' => $retro->is_anonymous,
                'reactionsEnabled' => $retro->reactions_enabled,
                'cursorsEnabled' => $retro->cursors_enabled,
                'gifsEnabled' => $retro->gifs_enabled,
                'gifProvider' => $this->gifCatalog->providerName(),
                'hideVoteCounts' => $retro->hide_vote_counts,
                'isLocked' => $retro->is_locked,
                'presentationMode' => $retro->presentation_mode,
                'aiSummaryEnabled' => $retro->ai_summary_enabled,
                'votesPerParticipant' => $retro->voteLimit(),
                'votesAuto' => $retro->votes_per_participant === null,
                'guestAccessEnabled' => $retro->guest_access_enabled,
                'guestUrl' => $retro->guest_access_enabled && $retro->isFacilitator($viewer)
                    ? route('retros.join.show', $retro->guest_token)
                    : null,
                'facilitatorParticipantId' => $retro->facilitator_participant_id,
                'timerEndsAt' => $retro->timer_ends_at?->toIso8601String(),
                'highlightedCardId' => $retro->highlighted_card_id,
                'completedAt' => $retro->completed_at?->toIso8601String(),
            ],
            'viewer' => [
                'participantId' => $viewer->id,
                'isFacilitator' => $retro->isFacilitator($viewer),
                'isGuest' => $viewer->isGuest(),
                'canHandleSuggestions' => $this->suggestionGuard->allows($retro, $retro->participants->firstWhere('id', $viewer->id) ?? $viewer),
                'remainingVotes' => max(0, $retro->voteLimit() - (int) $myVotes->sum()),
                'transferCandidates' => $retro->isFacilitator($viewer) ? $this->transferCandidates($retro, $viewer) : [],
            ],
            'columns' => $this->presentColumns->handle($retro),
            'cards' => $retro->cards->sortBy('position')->map(function (Card $card) use ($retro, $viewer, $showsTotals, $voteTotals, $myVotes) {
                $presented = $this->presentCard->handle($card, $retro, $viewer);
                $isHidden = $presented['hidden'];

                return [
                    ...$presented,
                    'votes' => $showsTotals ? (int) ($voteTotals[$card->id] ?? 0) : null,
                    'myVotes' => (int) ($myVotes[$card->id] ?? 0),
                    'reactions' => $isHidden ? [] : $this->summarizeReactions->handle($card->reactions, $retro, $viewer),
                    'commentCount' => $isHidden ? 0 : $card->comments->reject(fn (CardComment $comment) => $comment->isDeleted())->count(),
                    'comments' => $isHidden ? [] : $this->presentComment->threads($card->comments, $retro, $viewer),
                    'sentiment' => $isHidden ? null : $card->sentiment?->value,
                    'category' => $isHidden ? null : $card->category,
                ];
            })->values()->all(),
            'participants' => $retro->participants->map(fn (Participant $participant) => $this->presentParticipant->handle($participant))->values()->all(),
            'actionItems' => $retro->actionItems->sortBy('created_at')
                ->map(fn (ActionItem $item) => $this->presentActionItem->handle($item))
                ->values()->all(),
            'insights' => $this->buildInsights->handle($retro),
            'roti' => $this->roti($retro, $viewer),
            'surveys' => $surveys,
            'results' => $this->buildResults->handle($retro, $viewer, $surveys),
            'healthCheck' => $this->presentHealthCheck->handle($retro, $viewer),
            'votesCast' => $retro->phase === RetroPhase::Voting ? (int) $voteTotals->sum() : null,
            'votesVersion' => $votesVersion,
            'links' => [
                'team' => $viewer->isGuest() ? null : route('teams.show', [$retro->team->workspace, $retro->team]),
            ],
            'emojiData' => [
                'baseUrl' => '/emoji-data/'.config('services.emoji_data.version'),
                'locale' => EmojiDataController::emojibaseLocale(app()->getLocale()),
            ],
            'features' => [
                'llm' => $this->llm->isConfigured(),
                'llmProvider' => $this->llm->providerName(),
            ],
            'serverTime' => now()->utc()->format('Y-m-d\TH:i:s.v\Z'),
        ];
    }

    /**
     * Votes are cast under a lock on the retro row, so reading its version
     * under a shared lock keeps the version and the vote counts consistent.
     *
     * @return array{
     *     0: int,
     *     1: Collection<array-key, mixed>,
     *     2: Collection<array-key, mixed>
     * }
     */
    private function readVotes(Retro $retro, Participant $viewer): array
    {
        return DB::transaction(fn (): array => [
            Retro::query()->whereKey($retro->id)->sharedLock()->firstOrFail(['id', 'votes_version'])->votes_version,
            $retro->votes()
                ->selectRaw('card_id, count(*) as total')
                ->groupBy('card_id')
                ->pluck('total', 'card_id'),
            $retro->votes()
                ->where('participant_id', $viewer->id)
                ->selectRaw('card_id, count(*) as total')
                ->groupBy('card_id')
                ->pluck('total', 'card_id'),
        ]);
    }

    /**
     * @return array<int, array{
     *     userId: string,
     *     name: string
     * }>
     */
    private function transferCandidates(Retro $retro, Participant $viewer): array
    {
        $team = $retro->team;

        $managerIds = $team->workspace->members()
            ->wherePivotIn('role', [WorkspaceRole::Owner->value, WorkspaceRole::Admin->value])
            ->pluck('users.id');

        return User::query()
            ->where(fn ($query) => $query
                ->whereIn('id', $team->members()->select('users.id'))
                ->orWhereIn('id', $managerIds))
            ->when($viewer->user_id !== null, fn ($query) => $query->whereKeyNot($viewer->user_id))
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (User $user) => ['userId' => $user->id, 'name' => $user->name])
            ->all();
    }

    /**
     * @return array{
     *     myScore: ?int,
     *     respondents: int
     * }
     */
    private function roti(Retro $retro, Participant $viewer): array
    {
        $myScore = $retro->rotiVotes()->where('participant_id', $viewer->id)->value('score');

        return [
            'myScore' => $myScore === null ? null : (int) $myScore,
            'respondents' => $retro->rotiVotes()->count(),
        ];
    }
}
