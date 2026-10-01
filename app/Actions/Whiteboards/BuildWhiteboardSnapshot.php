<?php

namespace App\Actions\Whiteboards;

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use App\Models\WhiteboardMember;

/**
 * @phpstan-type Snapshot array{
 *     board: array{
 *         id: string,
 *         title: string,
 *         teamId: string,
 *         facilitatorMemberId: ?string,
 *         guestAccessEnabled: bool,
 *         guestUrl: ?string,
 *         cursorsEnabled: bool,
 *         reactionsEnabled: bool,
 *         locked: bool,
 *         followEnabled: bool,
 *         timerEndsAt: ?string
 *     },
 *     me: array{
 *         id: string,
 *         userId: ?string,
 *         name: string,
 *         avatarUrl: string,
 *         isGuest: bool,
 *         isFacilitator: bool,
 *         canTakeControl: bool,
 *         canDelete: bool,
 *         transferCandidates: array<int, array{userId: string, name: string}>
 *     },
 *     members: array<int, array{id: string, name: string, avatarUrl: string, isGuest: bool}>,
 *     elements: array<int, array<string, mixed>>,
 *     seq: int,
 *     links: array{team: ?string},
 *     serverTime: string
 * }
 */
class BuildWhiteboardSnapshot
{
    public const TimerLingerMinutes = 5;

    public function __construct(
        private PresentWhiteboardElement $presentWhiteboardElement,
        private OrderWhiteboardElements $orderWhiteboardElements,
    ) {}

    /**
     * @return Snapshot
     */
    public function handle(Whiteboard $board, WhiteboardMember $viewer): array
    {
        $board->load(['team.workspace', 'members.user']);
        $viewer->loadMissing('user');

        $isGuest = $viewer->isGuest();
        $isFacilitator = $board->isFacilitator($viewer);
        $isManager = (bool) $viewer->user?->canManage($board->team->workspace);

        return [
            'board' => [
                'id' => $board->id,
                'title' => $board->title,
                'teamId' => $board->team_id,
                'facilitatorMemberId' => $board->facilitator_member_id,
                'guestAccessEnabled' => $board->guest_access_enabled,
                'guestUrl' => $isGuest ? null : route('whiteboards.join.show', $board->guest_token),
                'cursorsEnabled' => $board->cursors_enabled,
                'reactionsEnabled' => $board->reactions_enabled,
                'locked' => $board->locked,
                'followEnabled' => $board->follow_enabled,
                'timerEndsAt' => $this->timerEndsAt($board),
            ],
            'me' => [
                'id' => $viewer->id,
                'userId' => $viewer->user_id,
                'name' => $viewer->displayName(),
                'avatarUrl' => $viewer->avatarUrl(),
                'isGuest' => $isGuest,
                'isFacilitator' => $isFacilitator,
                'canTakeControl' => ! $isGuest && ! $isFacilitator,
                'canDelete' => $isFacilitator || $isManager,
                'transferCandidates' => $isFacilitator && ! $isGuest ? $this->transferCandidates($board, $viewer) : [],
            ],
            'members' => $board->members
                ->map(fn (WhiteboardMember $member): array => [
                    'id' => $member->id,
                    'name' => $member->displayName(),
                    'avatarUrl' => $member->avatarUrl(),
                    'isGuest' => $member->isGuest(),
                ])
                ->values()
                ->all(),
            'elements' => $this->orderWhiteboardElements
                ->handle($board->elements()->where('is_deleted', false)->orderBy('seq')->get())
                ->map(fn (WhiteboardElement $element): array => $this->presentWhiteboardElement->handle($element))
                ->all(),
            'seq' => $board->seq,
            'links' => [
                'team' => $isGuest ? null : route('teams.show', [$board->team->workspace, $board->team], absolute: false),
            ],
            'serverTime' => now()->utc()->format('Y-m-d\TH:i:s.v\Z'),
        ];
    }

    /**
     * @return array<int, array{userId: string, name: string}>
     */
    private function transferCandidates(Whiteboard $board, WhiteboardMember $viewer): array
    {
        $team = $board->team;

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
            ->map(fn (User $user): array => ['userId' => $user->id, 'name' => $user->name])
            ->all();
    }

    /**
     * A board outlives its sessions: a countdown nobody stopped must not
     * read "Time's up!" for ever (spec §11.1).
     */
    private function timerEndsAt(Whiteboard $board): ?string
    {
        $endsAt = $board->timer_ends_at;

        if ($endsAt === null || $endsAt->lt(now()->subMinutes(self::TimerLingerMinutes))) {
            return null;
        }

        return $endsAt->toIso8601String();
    }
}
