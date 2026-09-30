<?php

namespace Database\Factories;

use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerVote;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PokerVote>
 */
class PokerVoteFactory extends Factory
{
    public function definition(): array
    {
        return [
            'poker_round_id' => PokerRound::factory(),
            'poker_player_id' => fn (array $attributes) => PokerPlayer::factory()->create([
                'poker_game_id' => PokerRound::query()->whereKey($attributes['poker_round_id'])->firstOrFail()->task->poker_game_id,
            ])->id,
            'value' => '3',
        ];
    }
}
