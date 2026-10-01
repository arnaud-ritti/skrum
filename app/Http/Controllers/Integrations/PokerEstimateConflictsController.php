<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\PokerTaskSync;
use App\Actions\Integrations\ResolvePokerEstimateConflict;
use App\Actions\Poker\PokerGuard;
use App\Actions\Poker\PresentPokerTask;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PokerEstimateConflictsController extends Controller
{
    public function store(Request $request, PokerGame $game, PokerTask $task, ResolvePokerEstimateConflict $resolvePokerEstimateConflict, PresentPokerTask $presentPokerTask): JsonResponse
    {
        $player = PokerPlayer::current($request);

        abort_if($player->isGuest(), 403);
        PokerGuard::facilitator($game, $player);

        $validated = $request->validate([
            'resolution' => ['required', 'string', Rule::in([ResolvePokerEstimateConflict::KeepSkrum, ResolvePokerEstimateConflict::UseSource])],
        ]);

        $resolved = DB::transaction(function () use ($game, $task, $player, $validated, $resolvePokerEstimateConflict): PokerTask {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();
            $lockedTask = PokerTask::query()->where('poker_game_id', $locked->id)->whereKey($task->id)->lockForUpdate()->firstOrFail();

            return $resolvePokerEstimateConflict->handle($locked, $lockedTask, $player, (string) $validated['resolution']);
        });

        $resolved->loadCount('rounds');

        return response()->json($presentPokerTask->handle($resolved, PokerTaskSync::for($game->fresh() ?? $game)));
    }
}
