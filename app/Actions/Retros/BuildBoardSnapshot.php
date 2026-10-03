<?php

namespace App\Actions\Retros;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\CarriedActionItems;
use App\Actions\Games\BuildGameSnapshot;
use App\Actions\Games\EnsureIcebreakerRoom;
use App\Actions\Games\ExpireGameRound;
use App\Actions\Games\IcebreakerGameOptions;
use App\Actions\HealthCheck\PresentHealthCheck;
use App\Actions\HealthCheck\TeamHealthStatements;
use App\Actions\Integrations\LatestDeliveries;
use App\Actions\Integrations\ListExportSources;
use App\Actions\Integrations\ShareOptions;
use App\Actions\Integrations\SharePermissions;
use App\Actions\Surveys\PresentSurvey;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\GamePlayer;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\TopicNote;
use App\Models\User;
use App\Support\Alphabetical;
use App\Support\EmojibaseLocale;
use App\Support\Gifs\GifCatalog;
use App\Support\Llm\Llm;
use App\Support\Sessions\JoinCodes;
use Illuminate\Contracts\Database\Query\Builder;
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
        private TeamHealthStatements $teamHealthStatements,
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
        private PresentTopicNote $presentTopicNote,
        private SummarizeRoti $summarizeRoti,
        private JoinCodes $joinCodes,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function handle(Retro $retro, Participant $viewer): array
    {
        $retro->loadMissing([
            'team.workspace',
            'team.members' => fn (Builder $members) => $members->orderBy('users.id'),
            'participants.user',
            'cards.participant.user',
            'cards.reactions.participant.user',
            'cards.comments.participant.user',
            'actionItems' => fn ($query) => $query->with(ActionItem::presentationRelations())->withCount('comments'),
            'topicNotes',
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
        $guestUrl = $retro->guest_access_enabled && $isFacilitator
            ? route('retros.join.show', $retro->guest_token)
            : null;

        return [
            'retro' => [
                'id' => $retro->id,
                'teamId' => $retro->team_id,
                'teamName' => $viewer->isGuest() ? null : $retro->team->name,
                'title' => $retro->title,
                'template' => $retro->template,
                'phase' => $retro->phase->value,
                'phases' => array_map(fn (RetroPhase $phase) => $phase->value, $retro->phases()),
                'healthCheckStatements' => $this->teamHealthStatements->active($retro->team)->count(),
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
                'maxVotesPerCard' => $retro->maxVotesPerCard(),
                'maxVotesPerCardSetting' => $retro->max_votes_per_card,
                'guestAccessEnabled' => $retro->guest_access_enabled,
                'guestUrl' => $guestUrl,
                'joinCode' => $guestUrl === null ? null : $this->joinCodes->for($retro),
                'facilitatorParticipantId' => $retro->facilitator_participant_id,
                'timerEndsAt' => $retro->timer_ends_at?->toIso8601String(),
                'timerPausedSeconds' => $retro->timer_paused_seconds,
                'topicSeconds' => $retro->topic_seconds,
                'phaseDurations' => $retro->phase_durations,
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
                'canTakeControl' => ! $viewer->isGuest()
                    && ! $isFacilitator
                    && $retro->phase !== RetroPhase::Completed
                    && ($viewerParticipant->user?->can('takeControl', $retro->team) ?? false),
            ],
            'columns' => $this->presentColumns->handle($retro),
            'cards' => $retro->cards->sortBy('position')->map(function (Card $card) use ($retro, $viewer, $showsTotals, $voteTotals, $myVotes, $showsCardInsights): array {
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
            'participants' => $retro->participants->map(fn (Participant $participant): array => $this->presentParticipant->handle($participant))->values()->all(),
            'actionItems' => $this->presentActionItem->many(
                $retro->actionItems->sortBy('created_at'),
                ActionItemActor::forParticipant($viewerParticipant),
            ),
            'carriedActionItems' => $this->presentActionItem->many($carried['items'], ActionItemActor::forParticipant($viewerParticipant)),
            'carriedActionItemsHasMore' => $carried['hasMore'],
            'exportSources' => $viewer->isGuest() ? [] : $this->listExportSources->forTeam($retro->team),
            'teamMembers' => $this->teamMembers($retro),
            'insights' => $this->buildInsights->handle($retro),
            'writersCount' => $retro->writersCount(),
            'voting' => ['finishedIds' => $retro->votingFinishedIds()],
            'topicNotes' => $retro->topicNotes
                ->sortBy('card_id')
                ->map(fn (TopicNote $note): array => $this->presentTopicNote->handle($note, $note->card_id))
                ->values()
                ->all(),
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
                'locale' => EmojibaseLocale::forAppLocale(app()->getLocale()),
            ],
            'features' => [
                'llm' => $this->llm->isConfigured(),
                'llmProvider' => $this->llm->providerName(),
            ],
            'viewerIsObserver' => $viewerParticipant->user?->isObserverOf($retro->team) ?? false,
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

        return Alphabetical::sort($retro->team->members, fn (User $member): string => $member->name)
            ->map(fn (User $member): array => [
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
            ->whereHas('facilitator', fn (Builder $query) => $query->where('user_id', $viewer->user_id))
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
            $retro->voteCountsByCard(),
            $retro->voteCountsByCard($viewer),
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

        $candidates = User::query()
            ->where(fn (Builder $query) => $query
                ->whereIn('id', $team->members()->select('users.id'))
                ->orWhereIn('id', $managerIds))
            ->when($viewer->user_id !== null, fn ($query) => $query->whereKeyNot($viewer->user_id))
            ->orderBy('id')
            ->get(['id', 'name']);

        return Alphabetical::sort($candidates, fn (User $user): string => $user->name)
            ->map(fn (User $user): array => ['userId' => $user->id, 'name' => $user->name])
            ->all();
    }

    /**
     * @return array{
     *     myScore: ?int,
     *     respondents: int,
     *     voterIds: array<int, string>,
     *     canVote: bool,
     *     revealed: bool,
     *     results: ?array{
     *         distribution: array<int, array{score: int, count: int}>,
     *         average: ?float,
     *         respondents: int
     *     }
     * }
     */
    private function roti(Retro $retro, Participant $viewer): array
    {
        $myScore = $retro->rotiVotes()->where('participant_id', $viewer->id)->value('score');

        $voterIds = $retro->rotiVotes()->pluck('participant_id')->all();

        return [
            'myScore' => $myScore === null ? null : (int) $myScore,
            'respondents' => count($voterIds),
            'voterIds' => $voterIds,
            'canVote' => $retro->takesRotiVotes(),
            'revealed' => $retro->roti_revealed_at !== null,
            'results' => $retro->roti_revealed_at !== null || $retro->phase === RetroPhase::Completed
                ? $this->summarizeRoti->handle($retro)
                : null,
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
