<?php

namespace Database\Factories;

use App\Models\Team;
use App\Models\Whiteboard;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Whiteboard>
 */
class WhiteboardFactory extends Factory
{
    public function definition(): array
    {
        return [
            'team_id' => Team::factory(),
            'title' => fake()->sentence(3),
            'guest_token' => Str::random(40),
        ];
    }

    public function withGuestAccess(): static
    {
        return $this->state(fn () => ['guest_access_enabled' => true]);
    }

    public function privateWriting(): static
    {
        return $this->state(fn () => ['private_writing' => true]);
    }
}
