<?php

namespace Database\Factories;

use App\Models\Whiteboard;
use App\Models\WhiteboardFile;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WhiteboardFile>
 */
class WhiteboardFileFactory extends Factory
{
    public function definition(): array
    {
        return [
            'whiteboard_id' => Whiteboard::factory(),
            'file_id' => sha1(fake()->uuid()),
            'path' => fn (array $attributes) => "whiteboards/{$attributes['whiteboard_id']}/{$attributes['file_id']}",
            'mime_type' => 'image/png',
            'size' => 1024,
        ];
    }
}
