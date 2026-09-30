<?php

namespace Database\Factories;

use App\Models\Retro;
use App\Models\RetroTheme;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RetroTheme>
 */
class RetroThemeFactory extends Factory
{
    public function definition(): array
    {
        return [
            'retro_id' => Retro::factory(),
            'name' => fake()->words(2, true),
            'position' => 0,
        ];
    }
}
