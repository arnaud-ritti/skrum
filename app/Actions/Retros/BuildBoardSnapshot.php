<?php

namespace App\Actions\Retros;

use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;

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

        $showsTotals = in_array($retro->phase, [RetroPhase::Discussing, RetroPhase::Completed], true);

        $voteTotals = $retro->votes()
            ->selectRaw('card_id, count(*) as total')
            ->groupBy('card_id')
            ->pluck('total', 'card_id');

        $myVotes = $retro->votes()
            ->where('participant_id', $viewer->id)
            ->selectRaw('card_id, count(*) as total')
            ->groupBy('card_id')
            ->pluck('total', 'card_id');

        return [
            'retro' => [
                'id' => $retro->id,
                'title' => $retro->title,
                'template' => $retro->template->value,
                'phase' => $retro->phase->value,
                'isAnonymous' => $retro->is_anonymous,
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
            'links' => [
                'team' => $viewer->isGuest() ? null : route('teams.show', [$retro->team->workspace, $retro->team]),
            ],
            'serverTime' => now()->utc()->format('Y-m-d\TH:i:s.v\Z'),
        ];
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
