<?php

namespace App\Actions\Games;

use App\Enums\GameKind;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameStatementSet;

/**
 * Who has a set ready, for everyone; a set's statements and lie for its
 * author only. One query, and none outside Two truths.
 */
class PresentStatementSets
{
    /**
     * @return array{ready: array<int, string>, mine: array{statements: array<int, string>, lieIndex: int, played: bool}|null}|null
     */
    public function handle(GameRoom $room, GamePlayer $viewer): ?array
    {
        if ($room->game !== GameKind::TwoTruths) {
            return null;
        }

        $sets = $room->statementSets()->get(['player_id', 'statements', 'lie_index', 'played_at']);
        $mine = $sets->firstWhere('player_id', $viewer->id);

        return [
            'ready' => $sets
                ->filter(fn (GameStatementSet $set): bool => $set->isReady())
                ->pluck('player_id')
                ->sort()
                ->values()
                ->all(),
            'mine' => $mine instanceof GameStatementSet ? [
                'statements' => $mine->statementsList(),
                'lieIndex' => $mine->lie_index,
                'played' => ! $mine->isReady(),
            ] : null,
        ];
    }
}
