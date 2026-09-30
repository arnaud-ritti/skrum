<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use App\Events\Games\GameRoomChanged;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRulesRegistry;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SwitchGame
{
    public function __construct(
        private GameRulesRegistry $gameRulesRegistry,
        private EndGameRound $endGameRound,
    ) {}

    public function handle(GameRoom $room, GamePlayer $host, GameKind $game): void
    {
        DB::transaction(function () use ($room, $host, $game): void {
            $locked = GameRoom::query()->whereKey($room->id)->lockForUpdate()->firstOrFail();

            GameGuard::mutable($locked);
            GameGuard::host($locked, $host);

            if (! $this->gameRulesRegistry->isAvailable($game, $locked)) {
                throw ValidationException::withMessages(['game' => __('This game is not available.')]);
            }

            if ($locked->game === $game) {
                return;
            }

            $round = $locked->current_round_id === null
                ? null
                : GameRound::query()->whereKey($locked->current_round_id)->lockForUpdate()->first();

            if ($round !== null) {
                $this->endGameRound->handle($locked, $round, GameRoundOutcome::Abandoned);
            }

            $locked->update(['game' => $game]);

            (new GameRoomChanged($locked))->sendToOthers();
        });
    }
}
