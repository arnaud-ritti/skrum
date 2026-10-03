<?php

namespace App\Actions\Games;

use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRulesRegistry;

/**
 * An active round as one viewer may see it. The word is never read here:
 * only a game's rules may hand it to the round's leader.
 */
class PresentGameRound
{
    public function __construct(private GameRulesRegistry $gameRulesRegistry) {}

    /**
     * @return array<string, mixed>
     */
    public function handle(GameRound $round, GameRoom $room, ?GamePlayer $viewer): array
    {
        return [
            'id' => $round->id,
            'game' => $round->game->value,
            'leaderPlayerId' => $round->leader_player_id,
            'startedAt' => $round->started_at->toIso8601String(),
            'revealedAt' => $round->revealed_at?->toIso8601String(),
            'number' => $round->number,
            'roundsTotal' => $round->rounds_total,
            'turnOrder' => $round->turnOrder(),
            'turnPlayerId' => $round->turn_player_id,
            'turnEndsAt' => $round->turn_ends_at?->toIso8601String(),
            'turnSeconds' => $round->turn_seconds,
            'hintSeconds' => $round->hint_seconds,
            ...($this->gameRulesRegistry->find($round->game)?->presentActive($round, $room, $viewer) ?? []),
        ];
    }
}
