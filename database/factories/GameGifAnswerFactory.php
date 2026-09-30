<?php

namespace Database\Factories;

use App\Models\GameGifAnswer;
use App\Models\GamePlayer;
use App\Models\GameRound;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<GameGifAnswer>
 */
class GameGifAnswerFactory extends Factory
{
    public function definition(): array
    {
        return [
            'game_round_id' => GameRound::factory(),
            'player_id' => GamePlayer::factory(),
            'gif_id' => Str::random(12),
        ];
    }
}
