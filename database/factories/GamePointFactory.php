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
            'team_id' => fn (array $attributes) => is_string($attributes['game_room_id'])
                ? GameRoom::query()->whereKey($attributes['game_room_id'])->value('team_id')
                : Team::factory(),
            'game_room_id' => fn (array $attributes) => GameRoom::factory()->state(['team_id' => $attributes['team_id']]),
            'player_id' => fn (array $attributes) => GamePlayer::factory()->state(['game_room_id' => $attributes['game_room_id']]),
            'game' => GameKind::Hangman,
            'points' => 0,
            'is_win' => false,
        ];
    }
}
