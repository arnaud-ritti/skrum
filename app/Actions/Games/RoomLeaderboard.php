<?php

namespace App\Actions\Games;

use App\Models\GamePlayer;
use App\Models\GamePoint;
use App\Models\GameRoom;

/**
 * The room's scoreboard (spec §4.7): one grouped query over the points
 * rows, which outlive round retention. A standalone room counts points
 * awarded after its last reset; an icebreaker room counts all of them.
 */
class RoomLeaderboard
{
    /**
     * @return array<int, array{
     *     playerId: string,
     *     points: int,
     *     wins: int,
     *     roundsPlayed: int
     * }>
     */
    public function handle(GameRoom $room): array
    {
        $room->loadMissing(['players.user', 'players.participant.user']);

        $names = $room->players->mapWithKeys(fn (GamePlayer $player): array => [$player->id => $player->displayName()]);
        $resetAt = $room->isIcebreaker() ? null : $room->scores_reset_at;

        $rows = GamePoint::query()
            ->where('game_room_id', $room->id)
            ->when($resetAt !== null, fn ($query) => $query->where('created_at', '>', $resetAt))
            ->groupBy('player_id')
            ->selectRaw('player_id, sum(points) as total_points, sum(case when is_win then 1 else 0 end) as wins, count(*) as rounds_played')
            ->toBase()
            ->get();

        return $rows
            ->map(fn (object $row): array => [
                'playerId' => (string) $row->player_id,
                'points' => (int) $row->total_points,
                'wins' => (int) $row->wins,
                'roundsPlayed' => (int) $row->rounds_played,
            ])
            ->sort(fn (array $first, array $second): int => [$second['points'], $second['wins'], $names[$first['playerId']] ?? '']
                <=> [$first['points'], $first['wins'], $names[$second['playerId']] ?? ''])
            ->values()
            ->all();
    }
}
