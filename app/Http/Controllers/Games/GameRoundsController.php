<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\GameGuard;
use App\Actions\Games\PresentGameRound;
use App\Actions\Games\PresentGameRoundHistory;
use App\Actions\Games\StartGameRound;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRulesRegistry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class GameRoundsController extends Controller
{
    public function index(GameRoom $room, PresentGameRoundHistory $presentGameRoundHistory): JsonResponse
    {
        return response()->json($presentGameRoundHistory->forRoom($room));
    }

    public function store(Request $request, GameRoom $room, StartGameRound $startGameRound, PresentGameRound $presentGameRound): JsonResponse
    {
        $player = GamePlayer::current($request);

        GameGuard::mutable($room);
        GameGuard::host($room, $player);

        $validated = $request->validate([
            'leader_player_id' => ['nullable', 'string', 'uuid', Rule::exists('game_players', 'id')->where('game_room_id', $room->id)],
            'turn_order' => ['sometimes', 'array', 'min:1', 'max:50'],
            'turn_order.*' => ['string', 'uuid', 'distinct', Rule::exists('game_players', 'id')->where('game_room_id', $room->id)],
        ]);

        ['round' => $round, 'ended' => $ended] = $startGameRound->handle($room, $player, $validated);

        return response()->json([
            'round' => $presentGameRound->handle($round, $room->refresh(), $player),
            'ended' => $ended,
        ], 201);
    }

    public function show(GameRoom $room, GameRound $round, PresentGameRoundHistory $presentGameRoundHistory, GameRulesRegistry $gameRulesRegistry): JsonResponse
    {
        abort_if($round->isActive() || $round->outcome === null, 404);

        $round->load(PresentGameRoundHistory::Relations);

        return response()->json([
            ...$presentGameRoundHistory->handle($round),
            ...($gameRulesRegistry->find($round->game)?->presentEnded($round) ?? []),
        ]);
    }
}
