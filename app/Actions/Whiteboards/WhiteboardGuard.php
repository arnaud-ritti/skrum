<?php

namespace App\Actions\Whiteboards;

use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use Illuminate\Auth\Access\AuthorizationException;

class WhiteboardGuard
{
    public static function facilitator(Whiteboard $board, WhiteboardMember $member): void
    {
        if ($board->isFacilitator($member)) {
            return;
        }

        throw new AuthorizationException(__('Only the facilitator can do this.'));
    }

    public static function canDelete(Whiteboard $board, WhiteboardMember $member): void
    {
        if ($board->isFacilitator($member)) {
            return;
        }

        if ($member->user?->canManage($board->team->workspace)) {
            return;
        }

        throw new AuthorizationException(__('Only the facilitator or a workspace admin can delete this board.'));
    }
}
