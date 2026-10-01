<?php

namespace App\Actions\Whiteboards;

use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Exceptions\HttpResponseException;

class WhiteboardGuard
{
    public static function facilitator(Whiteboard $board, WhiteboardMember $member): void
    {
        if ($board->isFacilitator($member)) {
            return;
        }

        throw new AuthorizationException(__('Only the facilitator can do this.'));
    }

    public static function notGuest(WhiteboardMember $member): void
    {
        if (! $member->isGuest()) {
            return;
        }

        throw new AuthorizationException(__('Guests cannot do this.'));
    }

    /**
     * A 403 with `errors.locked`: the client must tell a locked board, on
     * which it stays, from an access that ended (spec §11.2).
     */
    public static function notLocked(Whiteboard $board, WhiteboardMember $member): void
    {
        if (! $board->locked || $board->isFacilitator($member)) {
            return;
        }

        $message = __('This board is locked.');

        throw new HttpResponseException(response()->json([
            'message' => $message,
            'errors' => ['locked' => [$message]],
        ], 403));
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
