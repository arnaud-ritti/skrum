<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\BuildGameSnapshot;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class GameRoomsController extends Controller
{
    public function show(Request $request, GameRoom $room, BuildGameSnapshot $buildGameSnapshot): Response
    {
        if ($room->retro_id !== null) {
            return to_route('retros.show', $room->retro_id);
        }

        return Inertia::render('games/show', [
            'snapshot' => $buildGameSnapshot->handle($room, GamePlayer::current($request)),
        ])->toResponse($request);
    }
}
