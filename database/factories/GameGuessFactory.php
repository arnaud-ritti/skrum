<?php

namespace Database\Factories;

use App\Models\GameGuess;
use App\Models\GamePlayer;
use App\Models\GameRound;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<GameGuess>
 */
class GameGuessFactory extends Factory
{
    public function definition(): array
    {
        return [
            'game_round_id' => GameRound::factory(),
            'player_id' => GamePlayer::factory(),
            'text' => fake()->word(),
        ];
    }
}
