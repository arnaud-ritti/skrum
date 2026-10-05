<?php

namespace App\Actions\Whiteboards;

use App\Actions\Retros\GuestCookie;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use Illuminate\Http\Request;

class ResolveMember
{
    public function handle(Request $request, Whiteboard $board): ?WhiteboardMember
    {
        $user = $request->user();

        if ($user !== null && $user->can('view', $board->team)) {
            return WhiteboardMember::query()->firstOrCreate([
                'whiteboard_id' => $board->id,
                'user_id' => $user->id,
            ]);
        }

        return $this->guest($request, $board);
    }

    private function guest(Request $request, Whiteboard $board): ?WhiteboardMember
    {
        return $board->guest_access_enabled
            ? GuestCookie::findGuest($board->members(), $request, GuestCookie::WhiteboardScope, $board->id)
            : null;
    }
}
