<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Events\Games\GameClueChanged;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use Illuminate\Support\Facades\DB;

class SetGameClue
{
    public const MaxEmoji = 5;

    /**
     * The whole clue is replaced on every edit: the clue giver's client
     * sends its current row, debounced, so the last edit wins.
     *
     * @param  array<int, string>  $clue  validated by GameRoundCluesController
     * @return array{roundId: string, clue: array<int, string>}
     */
    public function handle(GameRoom $room, GameRound $round, GamePlayer $player, array $clue): array
    {
        return DB::transaction(function () use ($room, $round, $player, $clue): array {
            [$lockedRoom, $lockedRound] = LockGameRound::handle($room, $round);

            GameGuard::mutable($lockedRoom);
            GameGuard::leader($lockedRound, $player);
            GameGuard::activeRound($lockedRoom, $lockedRound);
            GameGuard::roundGame($lockedRound, GameKind::Decoded);

            $emoji = array_values($clue);

            $lockedRound->forceFill(['clue' => $emoji])->save();

            new GameClueChanged($lockedRoom, $lockedRound->id, $emoji)->sendToOthers();

            return ['roundId' => $lockedRound->id, 'clue' => $emoji];
        });
    }
}
