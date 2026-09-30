<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\PokerGuard;
use App\Events\Poker\PokerTasksReordered;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PokerTaskOrdersController extends Controller
{
    public function update(Request $request, PokerGame $game): Response
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::facilitator($game, $player);

        /** @var array{task_ids: array<int, string>} $validated */
        $validated = $request->validate([
            'task_ids' => ['required', 'array'],
            'task_ids.*' => ['required', 'uuid', 'distinct'],
        ]);

        DB::transaction(function () use ($game, $player, $validated): void {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            PokerGuard::notEnded($locked);
            PokerGuard::facilitator($locked, $player);

            $currentIds = PokerTask::query()->where('poker_game_id', $locked->id)->pluck('id')->sort()->values()->all();
            $givenIds = collect($validated['task_ids'])->sort()->values()->all();

            if ($currentIds !== $givenIds) {
                throw ValidationException::withMessages(['task_ids' => __('The list of tasks is out of date.')]);
            }

            foreach ($validated['task_ids'] as $index => $taskId) {
                PokerTask::query()->whereKey($taskId)->update(['position' => $index + 1]);
            }

            $locked->touch();

            (new PokerTasksReordered($locked->id, $validated['task_ids']))->sendToOthers();
        });

        return response()->noContent();
    }
}
