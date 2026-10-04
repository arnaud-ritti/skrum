<?php

namespace Database\Factories;

use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\GameStatementSet;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<GameStatementSet>
 */
class GameStatementSetFactory extends Factory
{
    public function definition(): array
    {
        return [
            'game_room_id' => GameRoom::factory(),
            'player_id' => fn (array $attributes) => GamePlayer::factory()->state(['game_room_id' => $attributes['game_room_id']]),
            'statements' => ['I ski', 'I sing', 'I fly'],
            'lie_index' => 2,
            'played_at' => null,
        ];
    }

    public function played(): static
    {
        return $this->state(fn () => ['played_at' => now()->startOfSecond()]);
    }
}
