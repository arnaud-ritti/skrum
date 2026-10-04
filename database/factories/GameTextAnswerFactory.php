<?php

namespace Database\Factories;

use App\Models\GamePlayer;
use App\Models\GameRound;
use App\Models\GameTextAnswer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<GameTextAnswer>
 */
class GameTextAnswerFactory extends Factory
{
    public function definition(): array
    {
        return [
            'game_round_id' => GameRound::factory(),
            'player_id' => fn (array $attributes) => GamePlayer::factory()->inRoomOfRound($attributes['game_round_id']),
            'text' => fake()->words(3, true),
        ];
    }
}
