<?php

namespace App\Actions\Games;

use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\Team;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Arr;

class PresentGameRoomSummary
{
    public const PlayersShown = 5;

    public function __construct(private PresentGamePlayer $presentGamePlayer) {}

    /**
     * @return HasMany<GameRoom, Team>
     */
    public static function query(Team $team): HasMany
    {
        return $team->gameRooms()
            ->whereNull('retro_id')
            ->with([
                'currentRound',
                'players' => fn ($query) => $query->limit(self::PlayersShown),
                'players.user',
            ])
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
     *     status: string,
     *     players: list<array{id: string, name: string, avatarUrl: string}>,
     *     playersCount: int,
     *     roundsCount: int,
     *     roundStartedAt: ?string,
     *     updatedAt: ?string
     * }
     */
    public function handle(GameRoom $room): array
    {
        $activeRound = $room->activeRound();

        return [
            'id' => $room->id,
            'name' => $room->name,
            'game' => $room->game->value,
            'gameLabel' => $room->game->label(),
            'access' => $room->access->value,
            'status' => $activeRound === null ? 'waiting' : 'playing',
            'players' => $room->players
                ->take(self::PlayersShown)
                ->map(fn (GamePlayer $player): array => Arr::only($this->presentGamePlayer->handle($player), ['id', 'name', 'avatarUrl']))
                ->values()
                ->all(),
            'playersCount' => (int) $room->getAttribute('players_count'),
            'roundsCount' => (int) $room->getAttribute('ended_rounds_count'),
            'roundStartedAt' => $activeRound?->started_at->toIso8601String(),
            'updatedAt' => $room->updated_at?->toIso8601String(),
        ];
    }
}
