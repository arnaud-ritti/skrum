<?php

namespace Database\Factories;

use App\Enums\HealthStatement;
use App\Models\Retro;
use App\Models\RetroHealthStatement;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<RetroHealthStatement>
 */
class RetroHealthStatementFactory extends Factory
{
    public function definition(): array
    {
        return [
            'retro_id' => Retro::factory(),
            'key' => HealthStatement::Interaction->value,
            'builtin' => HealthStatement::Interaction,
            'text' => null,
            'label' => null,
            'position' => 0,
        ];
    }

    public function builtin(HealthStatement $statement): static
    {
        return $this->state(fn () => ['key' => $statement->value, 'builtin' => $statement, 'text' => null, 'label' => null]);
    }

    public function custom(): static
    {
        return $this->state(fn () => [
            'key' => (string) Str::uuid(),
            'builtin' => null,
            'text' => fake()->sentence(5),
            'label' => fake()->word(),
        ]);
    }
}
