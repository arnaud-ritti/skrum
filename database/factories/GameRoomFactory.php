<?php

namespace Database\Factories;

use App\Enums\GameKind;
use App\Enums\GameRoomAccess;
use App\Models\GameRoom;
use App\Models\Retro;
use App\Models\Team;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<GameRoom>
 */
class GameRoomFactory extends Factory
{
    public function definition(): array
    {
        return [
            'team_id' => Team::factory(),
            'name' => Str::limit(fake()->sentence(3), 60, ''),
            'game' => GameKind::Hangman,
            'locale' => 'en',
            'access' => GameRoomAccess::Team,
            'reactions_enabled' => true,
            'guest_token' => Str::random(40),
        ];
    }

    public function game(GameKind $game): static
    {
        return $this->state(fn () => ['game' => $game]);
    }

    public function linkAccess(): static
    {
        return $this->state(fn () => ['access' => GameRoomAccess::Link]);
    }

    public function icebreaker(Retro $retro): static
    {
        return $this->state(fn () => [
            'team_id' => $retro->team_id,
            'retro_id' => $retro->id,
            'name' => null,
            'access' => GameRoomAccess::Team,
        ]);
    }
}
