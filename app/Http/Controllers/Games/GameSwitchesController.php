<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\GameGuard;
use App\Actions\Games\SwitchGame;
use App\Enums\GameKind;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

class GameSwitchesController extends Controller
{
    public function update(Request $request, GameRoom $room, SwitchGame $switchGame): Response
    {
        $player = GamePlayer::current($request);

        GameGuard::mutable($room);
        GameGuard::host($room, $player);

        $validated = $request->validate([
            'game' => ['required', Rule::enum(GameKind::class)],
        ]);

        $switchGame->handle($room, $player, GameKind::from($validated['game']));

        return response()->noContent();
    }
}
