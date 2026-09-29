<?php

namespace App\Actions\Retros;

use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class BuildBoardSnapshot
{
    public function __construct(
        private PresentCard $presentCard,
        private PresentColumns $presentColumns,
        private PresentActionItem $presentActionItem,
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
            'actionItems.assignee.user',
        ]);

        $showsTotals = in_array($retro->phase, [RetroPhase::Discussing, RetroPhase::Completed], true)
            || ($retro->phase === RetroPhase::Voting && ! $retro->hide_vote_counts);

        [$votesVersion, $voteTotals, $myVotes] = $this->readVotes($retro, $viewer);

        return [
            'retro' => [
                'id' => $retro->id,
                'title' => $retro->title,
                'template' => $retro->template->value,
                'phase' => $retro->phase->value,
                'isAnonymous' => $retro->is_anonymous,
                'reactionsEnabled' => $retro->reactions_enabled,
                'cursorsEnabled' => $retro->cursors_enabled,
                'gifsEnabled' => $retro->gifs_enabled,
                'hideVoteCounts' => $retro->hide_vote_counts,
                'isLocked' => $retro->is_locked,
                'presentationMode' => $retro->presentation_mode,
                'votesPerParticipant' => $retro->votes_per_participant,
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
                'remainingVotes' => max(0, $retro->votes_per_participant - (int) $myVotes->sum()),
                'transferCandidates' => $retro->isFacilitator($viewer) ? $this->transferCandidates($retro, $viewer) : [],
            ],
            'columns' => $this->presentColumns->handle($retro),
            'cards' => $retro->cards->sortBy('position')->map(fn (Card $card) => [
                ...$this->presentCard->handle($card, $retro, $viewer),
                'votes' => $showsTotals ? (int) ($voteTotals[$card->id] ?? 0) : null,
                'myVotes' => (int) ($myVotes[$card->id] ?? 0),
            ])->values()->all(),
            'participants' => $retro->participants->map(fn (Participant $participant) => [
                'id' => $participant->id,
                'name' => $participant->displayName(),
                'avatarUrl' => $participant->avatarUrl(),
                'isGuest' => $participant->isGuest(),
            ])->values()->all(),
            'actionItems' => $retro->actionItems->sortBy('created_at')
                ->map(fn (ActionItem $item) => $this->presentActionItem->handle($item))
                ->values()->all(),
            'votesCast' => $retro->phase === RetroPhase::Voting ? (int) $voteTotals->sum() : null,
            'votesVersion' => $votesVersion,
            'links' => [
                'team' => $viewer->isGuest() ? null : route('teams.show', [$retro->team->workspace, $retro->team]),
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
}
