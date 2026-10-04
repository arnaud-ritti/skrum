<?php

namespace App\Http\Controllers\Poker;

use App\Actions\Poker\PokerGuard;
use App\Actions\Poker\PresentPokerRound;
use App\Actions\Poker\StartPokerRound;
use App\Events\Poker\PokerRoundChanged;
use App\Http\Controllers\Controller;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PokerRoundsController extends Controller
{
    public function __construct(private PresentPokerRound $presentPokerRound) {}

    public function index(Request $request, PokerGame $game, PokerTask $task): JsonResponse
    {
        $player = PokerPlayer::current($request);

        $game->load('players');

        $rounds = $task->rounds()
            ->with('votes')
            ->reorder()
            ->orderByDesc('number')
            ->get();

        return response()->json(
            $rounds
                ->map(fn (PokerRound $round): array => $this->presentPokerRound->handle($round, $game, $player->id, listUnrevealedVoters: false))
                ->values(),
        );
    }

    public function store(Request $request, PokerGame $game, PokerTask $task, StartPokerRound $startPokerRound): JsonResponse
    {
        $player = PokerPlayer::current($request);

        PokerGuard::notEnded($game);
        PokerGuard::facilitator($game, $player);

        $round = DB::transaction(function () use ($game, $task, $player, $startPokerRound): PokerRound {
            $locked = PokerGame::query()->whereKey($game->id)->lockForUpdate()->firstOrFail();

            PokerGuard::notEnded($locked);
            PokerGuard::facilitator($locked, $player);

            if ($locked->current_task_id !== $task->id) {
                throw ValidationException::withMessages(['task' => __('Select this task first.')]);
            }

            $latestRound = $task->latestRound()->first();

            if ($latestRound === null || ! $latestRound->isRevealed()) {
                throw ValidationException::withMessages(['task' => __('Reveal the votes before starting a new round.')]);
            }

            $round = $startPokerRound->handle($locked, $task);

            new PokerRoundChanged($locked->id)->sendToOthers();

            return $round;
        });

        return response()->json(
            $this->presentPokerRound->handle($round->load('votes'), $game->load('players'), $player->id),
            201,
        );
    }
}
