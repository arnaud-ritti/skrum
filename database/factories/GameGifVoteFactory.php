<?php

namespace Database\Factories;

use App\Models\GameGifAnswer;
use App\Models\GameGifVote;
use App\Models\GamePlayer;
use App\Models\GameRound;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<GameGifVote>
 */
class GameGifVoteFactory extends Factory
{
    public function definition(): array
    {
        return [
            'game_round_id' => GameRound::factory(),
            'voter_player_id' => GamePlayer::factory(),
            'answer_id' => GameGifAnswer::factory(),
        ];
    }
}
