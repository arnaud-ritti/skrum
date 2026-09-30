<?php

namespace Database\Factories;

use App\Enums\GameKind;
use App\Models\GamePlayer;
use App\Models\GamePoint;
use App\Models\GameRoom;
use App\Models\Team;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<GamePoint>
 */
class GamePointFactory extends Factory
{
    public function definition(): array
    {
        return [
            'team_id' => Team::factory(),
            'game_room_id' => GameRoom::factory(),
            'player_id' => GamePlayer::factory(),
            'game' => GameKind::Hangman,
            'points' => 0,
            'is_win' => false,
        ];
    }
}
