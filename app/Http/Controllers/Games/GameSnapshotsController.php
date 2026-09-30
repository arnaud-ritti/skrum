<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\BuildGameSnapshot;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GameSnapshotsController extends Controller
{
    public function show(Request $request, GameRoom $room, BuildGameSnapshot $buildGameSnapshot): JsonResponse
    {
        return response()->json($buildGameSnapshot->handle($room, GamePlayer::current($request)));
    }
}
