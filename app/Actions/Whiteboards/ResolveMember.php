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
        if (! $board->guest_access_enabled) {
            return null;
        }

        $credentials = GuestCookie::parse($request->cookie(GuestCookie::name(GuestCookie::WhiteboardScope, $board->id)));

        if ($credentials === null) {
            return null;
        }

        [$memberId, $secret] = $credentials;

        $member = $board->members()
            ->whereKey($memberId)
            ->whereNull('user_id')
            ->whereNotNull('guest_secret_hash')
            ->first();

        if ($member === null) {
            return null;
        }

        if (! hash_equals((string) $member->guest_secret_hash, hash('sha256', $secret))) {
            return null;
        }

        return $member;
    }
}
