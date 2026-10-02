<?php

namespace App\Actions\Games;

use App\Models\GamePlayer;
use App\Models\GameRoom;
use Illuminate\Database\Eloquent\Builder;

/**
 * The room's scoreboard (spec §4.7): one query over the players, each with the
 * sums of its points rows, which outlive round retention. A standalone room counts points
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

        $since = fn (Builder $points): Builder => $points
            ->where('game_room_id', $room->id)
            ->when($resetAt !== null, fn (Builder $recent) => $recent->where('created_at', '>', $resetAt));

        return $room->players()
            ->whereHas('points', $since)
            ->withSum(['points as total_points' => $since], 'points')
            ->withCount(['points as wins' => fn (Builder $points) => $since($points)->where('is_win', true), 'points as rounds_played' => $since])
            ->get()
            ->map(fn (GamePlayer $player): array => [
                'playerId' => $player->id,
                'points' => (int) $player->total_points,
                'wins' => (int) $player->wins,
                'roundsPlayed' => (int) $player->rounds_played,
            ])
            ->toBase()
            ->sort(fn (array $first, array $second): int => [$second['points'], $second['wins'], $names[$first['playerId']] ?? '']
                <=> [$first['points'], $first['wins'], $names[$second['playerId']] ?? ''])
            ->values()
            ->all();
    }
}
