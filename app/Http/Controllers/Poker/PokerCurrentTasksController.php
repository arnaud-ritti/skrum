<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\PokerGuard;
use App\Actions\Poker\SelectPokerTask;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PokerCurrentTasksController extends Controller
{
    public function update(Request $request, PokerGame $game, SelectPokerTask $selectPokerTask): Response
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::facilitator($game, $player);

        $validated = $request->validate([
            'task_id' => ['present', 'nullable', 'uuid', Rule::exists('poker_tasks', 'id')->where('poker_game_id', $game->id)],
        ]);

        DB::transaction(function () use ($game, $player, $validated, $selectPokerTask): void {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            PokerGuard::notEnded($locked);
            PokerGuard::facilitator($locked, $player);

            $task = $validated['task_id'] === null
                ? null
                : PokerTask::query()->where('poker_game_id', $locked->id)->whereKey($validated['task_id'])->firstOrFail();

            $selectPokerTask->handle($locked, $task);
        });

        return response()->noContent();
    }
}
