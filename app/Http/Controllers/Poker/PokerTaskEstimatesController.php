<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Integrations\PokerTaskSync;
use App\Actions\Poker\PokerGuard;
use App\Actions\Poker\PresentPokerTask;
use App\Actions\Poker\SetPokerEstimate;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PokerTaskEstimatesController extends Controller
{
    public function update(Request $request, PokerGame $game, PokerTask $task, SetPokerEstimate $setPokerEstimate, PresentPokerTask $presentPokerTask): JsonResponse
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::facilitator($game, $player);

        $validated = $request->validate([
            'value' => ['present', 'nullable', 'string', 'max:8'],
        ]);

        $estimated = DB::transaction(function () use ($game, $task, $player, $validated, $setPokerEstimate): PokerTask {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            PokerGuard::notEnded($locked);
            PokerGuard::facilitator($locked, $player);

            $lockedTask = $locked->tasks()->whereKey($task->id)->firstOrFail();

            return $setPokerEstimate->handle($locked, $lockedTask, $validated['value']);
        });

        return response()->json($presentPokerTask->handle($estimated, PokerTaskSync::for($game)));
    }
}
