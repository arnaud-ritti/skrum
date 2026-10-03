<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\GameGuard;
use App\Enums\GameRoomAccess;
use App\Events\Games\GameRoomChanged;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Support\Sessions\JoinCodes;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class GameGuestTokensController extends Controller
{
    /**
     * A new token revokes the posted link, and clearing the secrets signs
     * every current guest out: they must join again through the new link.
     */
    public function store(Request $request, GameRoom $room, JoinCodes $joinCodes): JsonResponse
    {
        $player = GamePlayer::current($request);

        GameGuard::standalone($room);
        GameGuard::manager($room, $player);

        $locked = DB::transaction(function () use ($room, $player): GameRoom {
            $locked = GameRoom::query()->whereKey($room->id)->lockForUpdate()->firstOrFail();

            GameGuard::manager($locked, $player);

            $locked->update(['guest_token' => Str::random(40)]);
            $locked->players()->whereNotNull('guest_secret_hash')->update(['guest_secret_hash' => null]);

            (new GameRoomChanged($locked))->sendToOthers();

            return $locked;
        });

        $guestUrl = $locked->access === GameRoomAccess::Link ? $locked->guestUrl() : null;

        return response()->json([
            'guestUrl' => $guestUrl,
            'joinCode' => $guestUrl === null ? null : $joinCodes->rotate($locked),
        ]);
    }
}
