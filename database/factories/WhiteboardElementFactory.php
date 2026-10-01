<?php

namespace Database\Factories;

use App\Models\Whiteboard;
use App\Models\WhiteboardElement;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<WhiteboardElement>
 */
class WhiteboardElementFactory extends Factory
{
    public function definition(): array
    {
        return [
            'whiteboard_id' => Whiteboard::factory(),
            'element_id' => Str::random(20),
            'type' => 'rectangle',
            'data' => fn (array $attributes) => self::rectangle($attributes['element_id']),
            'version' => 1,
            'version_nonce' => 1,
            'seq' => 1,
        ];
    }

    public function deleted(): static
    {
        return $this->state(fn (array $attributes) => [
            'is_deleted' => true,
            'data' => fn (array $resolved) => [...self::rectangle($resolved['element_id']), 'isDeleted' => true],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private static function rectangle(string $elementId): array
    {
        return [
            'id' => $elementId,
            'type' => 'rectangle',
            'x' => 0,
            'y' => 0,
            'width' => 100,
            'height' => 50,
            'version' => 1,
            'versionNonce' => 1,
            'isDeleted' => false,
            'locked' => false,
        ];
    }
}
