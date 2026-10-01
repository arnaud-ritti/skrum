<?php

namespace Database\Factories;

use App\Models\User;
use App\Models\WhiteboardTemplate;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WhiteboardTemplate>
 */
class WhiteboardTemplateFactory extends Factory
{
    public function definition(): array
    {
        return [
            'workspace_id' => Workspace::factory(),
            'name' => fake()->unique()->words(3, true),
            'description' => null,
            'scene' => ['elements' => [], 'files' => []],
            'preview' => ['width' => 0, 'height' => 0, 'shapes' => []],
            'created_by_user_id' => User::factory(),
        ];
    }
}
