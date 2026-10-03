<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Events\Games\GameStatementsChanged;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameStatementSet;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class WriteStatementSet
{
    /**
     * Locks the room, as StartGameRound does, so that a set is never
     * rewritten while a start is copying it.
     *
     * @param  array<int, string>  $statements
     * @return array{statements: array<int, string>, lieIndex: int, played: bool}
     */
    public function handle(GameRoom $room, GamePlayer $player, array $statements, int $lieIndex): array
    {
        return DB::transaction(function () use ($room, $player, $statements, $lieIndex): array {
            $locked = GameRoom::query()->whereKey($room->id)->lockForUpdate()->firstOrFail();

            GameGuard::mutable($locked);

            if ($locked->game !== GameKind::TwoTruths) {
                throw ValidationException::withMessages(['game' => __('This action does not apply to this game.')]);
            }

            $set = GameStatementSet::query()->firstOrNew(['game_room_id' => $locked->id, 'player_id' => $player->id]);
            $wasReady = $set->exists && $set->isReady();

            $set->forceFill(['statements' => array_values($statements), 'lie_index' => $lieIndex, 'played_at' => null])->save();

            if (! $wasReady) {
                (new GameStatementsChanged($locked, $player->id, true))->sendToOthers();
            }

            return ['statements' => $set->statementsList(), 'lieIndex' => $set->lie_index, 'played' => false];
        });
    }
}
