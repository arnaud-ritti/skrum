<?php

namespace Database\Factories;

use App\Enums\ColumnColor;
use App\Models\Column;
use App\Models\Retro;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Column>
 */
class ColumnFactory extends Factory
{
    public function definition(): array
    {
        return [
            'retro_id' => Retro::factory(),
            'title' => fake()->word(),
            'color' => ColumnColor::Moss,
            'position' => 0,
        ];
    }
}
