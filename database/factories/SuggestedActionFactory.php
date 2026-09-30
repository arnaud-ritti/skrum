<?php

namespace Database\Factories;

use App\Enums\SuggestedActionStatus;
use App\Models\Retro;
use App\Models\SuggestedAction;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SuggestedAction>
 */
class SuggestedActionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'retro_id' => Retro::factory(),
            'content' => fake()->sentence(),
            'position' => 0,
            'status' => SuggestedActionStatus::Pending,
        ];
    }

    public function rejected(): static
    {
        return $this->state(fn () => ['status' => SuggestedActionStatus::Rejected, 'handled_at' => now()]);
    }
}
