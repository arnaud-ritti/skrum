<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\GameGuard;
use App\Events\Games\GameRoomChanged;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class GameScoresController extends Controller
{
    /**
     * The room leaderboard starts again from zero; the points stay, so the
     * team leaderboard keeps them (spec §4.7).
     */
    public function destroy(Request $request, GameRoom $room): Response
    {
        $player = GamePlayer::current($request);

        GameGuard::standalone($room);
        GameGuard::manager($room, $player);

        DB::transaction(function () use ($room, $player): void {
            $locked = GameRoom::query()->whereKey($room->id)->lockForUpdate()->firstOrFail();

            GameGuard::manager($locked, $player);

            $locked->forceFill(['scores_reset_at' => now()])->save();

            (new GameRoomChanged($locked))->sendToOthers();
        });

        return response()->noContent();
    }
}
