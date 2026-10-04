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
            'answer_id' => fn (array $attributes) => GameGifAnswer::factory()->state(['game_round_id' => $attributes['game_round_id']]),
            'voter_player_id' => fn (array $attributes) => GamePlayer::factory()->inRoomOfRound($attributes['game_round_id']),
        ];
    }
}
