<?php

namespace App\Http\Controllers\Games;

use App\Actions\Games\PlayUndercover;
use App\Http\Controllers\Controller;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRateLimit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GameUndercoverController extends Controller
{
    public function advance(Request $request, GameRoom $room, GameRound $round, PlayUndercover $play): JsonResponse
    {
        return $this->play($request, $room, $round, $play, 'advance');
    }

    public function vote(Request $request, GameRoom $room, GameRound $round, PlayUndercover $play): JsonResponse
    {
        return $this->play($request, $room, $round, $play, 'vote');
    }

    public function retract(Request $request, GameRoom $room, GameRound $round, PlayUndercover $play): JsonResponse
    {
        return $this->play($request, $room, $round, $play, 'retract');
    }

    private function play(Request $request, GameRoom $room, GameRound $round, PlayUndercover $play, string $action): JsonResponse
    {
        $player = GamePlayer::current($request);
        GameRateLimit::hit("game-play:{$player->id}", 3, 1);
        $input = $request->validate([
            'version' => ['required', 'integer', 'min:1'],
            'choice' => [$action === 'vote' ? 'required' : 'nullable', 'string', 'uuid'],
        ]);

        return response()->json($play->handle($room, $round, $player, (int) $input['version'], $action, $input['choice'] ?? null));
    }
}
