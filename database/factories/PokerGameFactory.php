<?php

namespace Database\Factories;

use App\Enums\PokerDeck;
use App\Models\PokerGame;
use App\Models\Team;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<PokerGame>
 */
class PokerGameFactory extends Factory
{
    public function definition(): array
    {
        return [
            'team_id' => Team::factory(),
            'title' => fake()->sentence(3),
            'deck' => PokerDeck::Fibonacci,
            'cards' => PokerDeck::Fibonacci->cards(),
            'guest_token' => Str::random(40),
        ];
    }

    public function withGuestAccess(): static
    {
        return $this->state(fn () => ['guest_access_enabled' => true]);
    }

    public function ended(): static
    {
        return $this->state(fn () => ['ended_at' => now(), 'current_task_id' => null]);
    }

    public function deck(PokerDeck $deck): static
    {
        return $this->state(fn () => ['deck' => $deck, 'cards' => $deck->cards()]);
    }

    /**
     * @param  array<int, string>  $cards
     */
    public function customCards(array $cards): static
    {
        return $this->state(fn () => ['deck' => PokerDeck::Custom, 'cards' => $cards]);
    }
}
