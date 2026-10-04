<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Events\Games\GameStatementsChanged;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameStatementSet;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class RemoveStatementSet
{
    /**
     * Locks the room, as StartGameRound does; a played set stays, as its
     * round already copied it.
     */
    public function handle(GameRoom $room, GamePlayer $player): void
    {
        DB::transaction(function () use ($room, $player): void {
            $locked = GameRoom::query()->whereKey($room->id)->lockForUpdate()->firstOrFail();

            GameGuard::mutable($locked);

            if ($locked->game !== GameKind::TwoTruths) {
                throw ValidationException::withMessages(['game' => __('This action does not apply to this game.')]);
            }

            $set = GameStatementSet::query()
                ->where('game_room_id', $locked->id)
                ->where('player_id', $player->id)
                ->first();

            if ($set === null) {
                return;
            }

            if ($set->isPlayed()) {
                throw new ConflictHttpException(__('Your statements have been played.'));
            }

            $set->delete();

            new GameStatementsChanged($locked, $player->id, false)->sendToOthers();
        });
    }
}
