<?php

namespace App\Actions\Whiteboards;

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
 *         cursorsEnabled: bool
 *     },
 *     me: array{
 *         id: string,
 *         userId: ?string,
 *         name: string,
 *         avatarUrl: string,
 *         isGuest: bool,
 *         isFacilitator: bool,
 *         canTakeControl: bool,
 *         canDelete: bool
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
                ->map(fn (WhiteboardElement $element): array => $this->presentWhiteboardElement->handle($element, $viewer))
                ->all(),
            'seq' => $board->seq,
            'links' => [
                'team' => $isGuest ? null : route('teams.show', [$board->team->workspace, $board->team], absolute: false),
            ],
            'serverTime' => now()->toIso8601String(),
        ];
    }
}
