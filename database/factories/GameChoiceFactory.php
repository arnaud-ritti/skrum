<?php

namespace Database\Factories;

use App\Enums\GameWeather;
use App\Models\GameChoice;
use App\Models\GamePlayer;
use App\Models\GameRound;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<GameChoice>
 */
class GameChoiceFactory extends Factory
{
    public function definition(): array
    {
        return [
            'game_round_id' => GameRound::factory(),
            'player_id' => GamePlayer::factory(),
            'choice' => GameWeather::Sunny->value,
        ];
    }
}
