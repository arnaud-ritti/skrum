<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\PokerTaskSync;
use App\Actions\Integrations\RequestEstimateSync;
use App\Actions\Poker\PokerGuard;
use App\Actions\Poker\PresentPokerTask;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PokerTaskSyncsController extends Controller
{
    public function store(Request $request, PokerGame $game, PokerTask $task, RequestEstimateSync $requestEstimateSync, PresentPokerTask $presentPokerTask): JsonResponse
    {
        $player = PokerPlayer::current($request);

        PokerGuard::facilitator($game, $player);

        $synced = DB::transaction(function () use ($game, $task, $player, $requestEstimateSync): PokerTask {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();
            $lockedTask = PokerTask::query()->where('poker_game_id', $locked->id)->whereKey($task->id)->firstOrFail();

            $requestEstimateSync->retryAndBroadcast($locked, $lockedTask, $player);

            return $lockedTask;
        });

        return response()->json($presentPokerTask->handle($synced, PokerTaskSync::for($game)), 202);
    }
}
