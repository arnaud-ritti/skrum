<?php

namespace App\Actions\Retros;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\CarriedActionItems;
use App\Actions\Games\BuildGameSnapshot;
use App\Actions\Games\EnsureIcebreakerRoom;
use App\Actions\Games\ExpireGameRound;
use App\Actions\Games\IcebreakerGameOptions;
use App\Actions\HealthCheck\PresentHealthCheck;
use App\Actions\Integrations\LatestDeliveries;
use App\Actions\Integrations\ListExportSources;
use App\Actions\Integrations\ShareOptions;
use App\Actions\Integrations\SharePermissions;
use App\Actions\Surveys\PresentSurvey;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Http\Controllers\EmojiDataController;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\GamePlayer;
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
        private CarriedActionItems $carriedActionItems,
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
        private ShareOptions $shareOptions,
        private SharePermissions $sharePermissions,
        private LatestDeliveries $latestDeliveries,
        private ListExportSources $listExportSources,
        private EnsureIcebreakerRoom $ensureIcebreakerRoom,
        private ExpireGameRound $expireGameRound,
        private BuildGameSnapshot $buildGameSnapshot,
        private IcebreakerGameOptions $icebreakerGameOptions,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function handle(Retro $retro, Participant $viewer): array
    {
        $retro->loadMissing([
            'team.workspace',
            'team.members',
            'participants.user',
            'cards.participant.user',
            'cards.reactions.participant.user',
            'cards.comments.participant.user',
            'actionItems' => fn ($query) => $query->with(ActionItem::presentationRelations())->withCount('comments'),
        ]);

        $showsTotals = $retro->showsVoteTotals();
        $showsCardInsights = $this->llm->isConfigured();

        [$votesVersion, $voteTotals, $myVotes] = $this->readVotes($retro, $viewer);

        $surveys = $this->presentSurvey->many($retro, $viewer);

        $viewerParticipant = $retro->participants->firstWhere('id', $viewer->id) ?? $viewer;
        $isFacilitator = $retro->isFacilitator($viewer);
        $isWorkspaceManager = ! $viewer->isGuest() && ($viewerParticipant->user?->canManage($retro->team->workspace) ?? false);
        $carried = $viewer->isGuest()
            ? ['items' => [], 'hasMore' => false]
            : $this->carriedActionItems->handle($retro);
        $canShare = $this->sharePermissions->retro($retro, $viewerParticipant);

        return [
            'retro' => [
                'id' => $retro->id,
                'teamId' => $retro->team_id,
                'title' => $retro->title,
                'template' => $retro->template,
                'phase' => $retro->phase->value,
                'phases' => array_map(fn (RetroPhase $phase) => $phase->value, $retro->phases()),
                'healthCheckEnabled' => $retro->health_check_enabled,
                'icebreakerEnabled' => $retro->icebreaker_enabled,
                'icebreakerGame' => $retro->icebreaker_game->value,
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
                'guestUrl' => $retro->guest_access_enabled && $isFacilitator
                    ? route('retros.join.show', $retro->guest_token)
                    : null,
                'facilitatorParticipantId' => $retro->facilitator_participant_id,
                'timerEndsAt' => $retro->timer_ends_at?->toIso8601String(),
                'highlightedCardId' => $retro->highlighted_card_id,
                'completedAt' => $retro->completed_at?->toIso8601String(),
            ],
            'viewer' => [
                'participantId' => $viewer->id,
                'userId' => $viewer->user_id,
                'canManageActionItems' => $isFacilitator || $isWorkspaceManager,
                'isWorkspaceManager' => $isWorkspaceManager,
                'isReviewFacilitator' => $isFacilitator && $retro->phase !== RetroPhase::Completed,
                'facilitatedRetroIds' => $this->facilitatedRetroIds($retro, $viewer),
                'isFacilitator' => $isFacilitator,
                'isGuest' => $viewer->isGuest(),
                'canHandleSuggestions' => $this->suggestionGuard->allows($retro, $retro->participants->firstWhere('id', $viewer->id) ?? $viewer),
                'remainingVotes' => max(0, $retro->voteLimit() - (int) $myVotes->sum()),
                'transferCandidates' => $isFacilitator ? $this->transferCandidates($retro, $viewer) : [],
            ],
            'columns' => $this->presentColumns->handle($retro),
            'cards' => $retro->cards->sortBy('position')->map(function (Card $card) use ($retro, $viewer, $showsTotals, $voteTotals, $myVotes, $showsCardInsights) {
                $presented = $this->presentCard->handle($card, $retro, $viewer);
                $isHidden = $presented['hidden'];

                return [
                    ...$presented,
                    'votes' => $showsTotals ? (int) ($voteTotals[$card->id] ?? 0) : null,
                    'myVotes' => (int) ($myVotes[$card->id] ?? 0),
                    'reactions' => $isHidden ? [] : $this->summarizeReactions->handle($card->reactions, $retro, $viewer),
                    'commentCount' => $this->presentCard->commentCount($card, $isHidden),
                    'comments' => $isHidden ? [] : $this->presentComment->threads($card->comments, $retro, $viewer),
                    ...$this->presentCard->insights($card, $isHidden, $showsCardInsights),
                ];
            })->values()->all(),
            'participants' => $retro->participants->map(fn (Participant $participant) => $this->presentParticipant->handle($participant))->values()->all(),
            'actionItems' => $this->presentActionItem->many(
                $retro->actionItems->sortBy('created_at'),
                ActionItemActor::forParticipant($viewerParticipant),
            ),
            'carriedActionItems' => $this->presentActionItem->many($carried['items'], ActionItemActor::forParticipant($viewerParticipant)),
            'carriedActionItemsHasMore' => $carried['hasMore'],
            'exportSources' => $viewer->isGuest() ? [] : $this->listExportSources->forTeam($retro->team),
            'teamMembers' => $this->teamMembers($retro),
            'insights' => $this->buildInsights->handle($retro),
            'roti' => $this->roti($retro, $viewer),
            'surveys' => $surveys,
            'results' => $this->buildResults->handle($retro, $viewer, $surveys),
            'healthCheck' => $this->presentHealthCheck->handle($retro, $viewer),
            'icebreaker' => $this->icebreaker($retro, $viewer),
            'icebreakerGames' => $this->icebreakerGameOptions->options(),
            'integrations' => $this->shareOptions->retro($retro, $viewerParticipant),
            'linkDeliveries' => $canShare ? $this->latestDeliveries->handle($retro, [IntegrationDeliveryKind::RetroLink]) : [],
            'votesCast' => $retro->phase === RetroPhase::Voting ? (int) $voteTotals->sum() : null,
            'votesVersion' => $votesVersion,
            'links' => [
                'team' => $viewer->isGuest() ? null : route('teams.show', [$retro->team->workspace, $retro->team]),
                'actionItems' => $viewer->isGuest()
                    ? null
                    : route('workspaces.actionItems.index', ['workspace' => $retro->team->workspace, 'team' => $retro->team_id]),
                'workspace' => $viewer->isGuest() ? null : $retro->team->workspace->slug,
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
     * Guests may assign team members on their board, so they get the list
     * too, without emails.
     *
     * @return array<int, array{
     *     id: string,
     *     name: string,
     *     avatarUrl: string,
     *     participantId: ?string
     * }>
     */
    private function teamMembers(Retro $retro): array
    {
        $participantIds = $retro->participants->whereNotNull('user_id')->pluck('id', 'user_id');

        return $retro->team->members
            ->sortBy('name')
            ->map(fn (User $member) => [
                'id' => $member->id,
                'name' => $member->name,
                'avatarUrl' => $member->avatarUrl(),
                'participantId' => $participantIds[$member->id] ?? null,
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<int, string>
     */
    private function facilitatedRetroIds(Retro $retro, Participant $viewer): array
    {
        if ($viewer->user_id === null) {
            return $retro->isFacilitator($viewer) ? [$retro->id] : [];
        }

        /** @var array<int, string> $retroIds */
        $retroIds = Retro::query()
            ->where('team_id', $retro->team_id)
            ->whereHas('facilitator', fn ($query) => $query->where('user_id', $viewer->user_id))
            ->pluck('id')
            ->all();

        return $retroIds;
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

    /**
     * The game panel of the Icebreaker phase, as this participant sees it.
     * The room is created on first need and its expired round closed first,
     * so a late queue never shows a stale round (spec §5).
     *
     * @return array<string, mixed>|null
     */
    private function icebreaker(Retro $retro, Participant $viewer): ?array
    {
        if ($retro->phase !== RetroPhase::Icebreaker) {
            return null;
        }

        $room = $this->ensureIcebreakerRoom->handle($retro);

        $this->expireGameRound->handle($room);

        $player = GamePlayer::query()->firstOrCreate([
            'game_room_id' => $room->id,
            'participant_id' => $viewer->id,
        ]);

        return $this->buildGameSnapshot->handle($room, $player);
    }
}
