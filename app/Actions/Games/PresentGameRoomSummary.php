<?php

namespace App\Actions\Games;

use App\Models\GameRoom;
use App\Models\Team;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PresentGameRoomSummary
{
    /**
     * @return HasMany<GameRoom, Team>
     */
    public static function query(Team $team): HasMany
    {
        return $team->gameRooms()
            ->whereNull('retro_id')
            ->withCount(['players', 'rounds as ended_rounds_count' => fn ($query) => $query->whereNotNull('ended_at')])
            ->latest('updated_at');
    }

    /**
     * @return array{
     *     id: string,
     *     name: ?string,
     *     game: string,
     *     gameLabel: string,
     *     access: string,
     *     playersCount: int,
     *     roundsCount: int,
     *     updatedAt: ?string
     * }
     */
    public function handle(GameRoom $room): array
    {
        return [
            'id' => $room->id,
            'name' => $room->name,
            'game' => $room->game->value,
            'gameLabel' => $room->game->label(),
            'access' => $room->access->value,
            'playersCount' => (int) $room->getAttribute('players_count'),
            'roundsCount' => (int) $room->getAttribute('ended_rounds_count'),
            'updatedAt' => $room->updated_at?->toIso8601String(),
        ];
    }
}
