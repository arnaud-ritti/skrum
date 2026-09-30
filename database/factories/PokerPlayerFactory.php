<?php

namespace Database\Factories;

use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PokerPlayer>
 */
class PokerPlayerFactory extends Factory
{
    public function definition(): array
    {
        return [
            'poker_game_id' => PokerGame::factory(),
            'user_id' => User::factory(),
        ];
    }

    public function guest(string $secret = 'secret'): static
    {
        return $this->state(fn () => [
            'user_id' => null,
            'guest_name' => fake()->firstName(),
            'guest_secret_hash' => hash('sha256', $secret),
        ]);
    }

    public function spectator(): static
    {
        return $this->state(fn () => ['is_spectator' => true]);
    }
}
