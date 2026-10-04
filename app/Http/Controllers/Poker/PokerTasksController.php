<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Integrations\PokerTaskSync;
use App\Actions\Poker\AddPokerTask;
use App\Actions\Poker\PokerGuard;
use App\Actions\Poker\PresentPokerTask;
use App\Events\Poker\PokerTaskDeleted;
use App\Events\Poker\PokerTaskSaved;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class PokerTasksController extends Controller
{
    public function __construct(private PresentPokerTask $presentPokerTask) {}

    public function store(Request $request, PokerGame $game, AddPokerTask $addPokerTask): JsonResponse
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::canEditTasks($player);

        $validated = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:10000'],
        ]);

        $task = DB::transaction(function () use ($game, $validated, $addPokerTask): PokerTask {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            PokerGuard::notEnded($locked);

            return $addPokerTask->handle($locked, $validated['title'], $validated['description'] ?? null);
        });

        return response()->json($this->presentPokerTask->handle($task, PokerTaskSync::for($game)), 201);
    }

    public function update(Request $request, PokerGame $game, PokerTask $task): JsonResponse
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::canEditTasks($player);
        PokerGuard::notManaged($task);

        $validated = $request->validate([
            'title' => ['sometimes', 'required', 'string', 'max:200'],
            'description' => ['sometimes', 'nullable', 'string', 'max:10000'],
        ]);

        $task = DB::transaction(function () use ($game, $task, $validated): PokerTask {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            PokerGuard::notEnded($locked);

            $lockedTask = PokerTask::query()->where('poker_game_id', $locked->id)->whereKey($task->id)->firstOrFail();

            PokerGuard::notManaged($lockedTask);

            $lockedTask->update($validated);
            $lockedTask->loadCount('rounds');

            new PokerTaskSaved($locked->id, $this->presentPokerTask->handle($lockedTask))->sendToOthers();

            return $lockedTask;
        });

        return response()->json($this->presentPokerTask->handle($task, PokerTaskSync::for($game)));
    }

    public function destroy(Request $request, PokerGame $game, PokerTask $task): Response
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::facilitator($game, $player);

        DB::transaction(function () use ($game, $task, $player): void {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            PokerGuard::notEnded($locked);
            PokerGuard::facilitator($locked, $player);

            $lockedTask = PokerTask::query()->where('poker_game_id', $locked->id)->whereKey($task->id)->firstOrFail();
            $taskId = $lockedTask->id;

            $lockedTask->delete();

            new PokerTaskDeleted($locked->id, $taskId)->sendToOthers();
        });

        return response()->noContent();
    }
}
