<?php

namespace Database\Factories;

use App\Models\Whiteboard;
use App\Models\WhiteboardVersion;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WhiteboardVersion>
 */
class WhiteboardVersionFactory extends Factory
{
    public function definition(): array
    {
        return [
            'whiteboard_id' => Whiteboard::factory(),
            'name' => null,
            'scene' => ['elements' => [], 'fileIds' => []],
            'private_element_ids' => [],
            'seq' => 0,
            'created_by_member_id' => null,
        ];
    }

    public function named(string $name = 'Checkpoint'): static
    {
        return $this->state(fn () => ['name' => $name]);
    }
}
