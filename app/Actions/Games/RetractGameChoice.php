<?php

namespace App\Actions\Games;

use App\Models\GameChoice;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRulesRegistry;
use App\Support\Games\TakesChoices;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RetractGameChoice
{
    public function __construct(private GameRulesRegistry $gameRulesRegistry) {}

    public function handle(GameRoom $room, GameRound $round, GamePlayer $player): void
    {
        DB::transaction(function () use ($room, $round, $player): void {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            GameGuard::mutable($lockedRoom);

            $rules = $this->gameRulesRegistry->for($lockedRound->game);

            if (! $rules instanceof TakesChoices) {
                throw ValidationException::withMessages(['round' => __('This action does not apply to this game.')]);
            }

            GameGuard::activeRound($lockedRoom, $lockedRound);

            $rules->choicesFor($lockedRound, $player);

            $removed = GameChoice::query()
                ->where('game_round_id', $lockedRound->id)
                ->where('player_id', $player->id)
                ->delete();

            if ($removed > 0) {
                $rules->choiceChanged($lockedRoom, $lockedRound, $player, false);
            }
        });
    }
}
