<?php

namespace App\Actions\Games;

use App\Models\GamePlayer;
use App\Models\GamePoint;
use App\Models\GameRoom;
use App\Models\GameRound;
use App\Support\Games\GameRulesRegistry;

class AwardRoundPoints
{
    public function __construct(private GameRulesRegistry $gameRulesRegistry) {}

    /**
     * @return array<int, array{playerId: string, points: int, isWin: bool}>
     */
    public function handle(GameRoom $room, GameRound $round): array
    {
        $rows = $this->gameRulesRegistry->for($round->game)->points($round, $room);

        if ($rows === []) {
            return [];
        }

        $players = GamePlayer::query()
            ->with('participant')
            ->where('game_room_id', $room->id)
            ->whereIn('id', array_map('strval', array_keys($rows)))
            ->get()
            ->keyBy('id');

        $awarded = [];

        foreach ($rows as $playerId => $row) {
            $player = $players->get((string) $playerId);

            if ($player === null) {
                continue;
            }

            $points = max(0, $row['points']);

            GamePoint::query()->create([
                'team_id' => $room->team_id,
                'game_room_id' => $room->id,
                'game_round_id' => $round->id,
                'player_id' => $player->id,
                'user_id' => $player->accountUserId(),
                'game' => $round->game,
                'points' => $points,
                'is_win' => $row['isWin'],
            ]);

            $awarded[] = ['playerId' => $player->id, 'points' => $points, 'isWin' => $row['isWin']];
        }

        return $awarded;
    }
}
