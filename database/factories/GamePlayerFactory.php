<?php

namespace Database\Factories;

use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\Participant;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<GamePlayer>
 */
class GamePlayerFactory extends Factory
{
    public function definition(): array
    {
        return [
            'game_room_id' => GameRoom::factory(),
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

    public function forParticipant(Participant $participant): static
    {
        return $this->state(fn () => [
            'user_id' => null,
            'participant_id' => $participant->id,
        ]);
    }
}
