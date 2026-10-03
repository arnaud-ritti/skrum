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

class ChooseGameOption
{
    public function __construct(private GameRulesRegistry $gameRulesRegistry) {}

    /**
     * One choice per player and round: a second one replaces the first, and
     * only a new choice is announced to the rules.
     */
    public function handle(GameRoom $room, GameRound $round, GamePlayer $player, string $choice): void
    {
        DB::transaction(function () use ($room, $round, $player, $choice): void {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            GameGuard::mutable($lockedRoom);

            $rules = $this->gameRulesRegistry->for($lockedRound->game);

            if (! $rules instanceof TakesChoices) {
                throw ValidationException::withMessages(['round' => __('This action does not apply to this game.')]);
            }

            GameGuard::activeRound($lockedRoom, $lockedRound);

            if (! in_array($choice, $rules->choicesFor($lockedRound, $player), true)) {
                throw ValidationException::withMessages(['choice' => __('This choice is not offered.')]);
            }

            $made = GameChoice::query()->updateOrCreate(
                ['game_round_id' => $lockedRound->id, 'player_id' => $player->id],
                ['choice' => $choice],
            );

            if ($made->wasRecentlyCreated) {
                $rules->choiceChanged($lockedRoom, $lockedRound, $player, true);
            }
        });
    }
}
