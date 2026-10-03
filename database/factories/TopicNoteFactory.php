<?php

namespace Database\Factories;

use App\Models\Card;
use App\Models\Retro;
use App\Models\TopicNote;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TopicNote>
 */
class TopicNoteFactory extends Factory
{
    public function definition(): array
    {
        return [
            'retro_id' => Retro::factory(),
            'card_id' => fn (array $attributes) => Card::factory()->create(['retro_id' => $attributes['retro_id']])->id,
            'body' => fake()->sentence(),
            'version' => 1,
        ];
    }
}
