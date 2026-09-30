<?php

namespace Database\Factories;

use App\Enums\ColumnColor;
use App\Models\WorkspaceTemplate;
use App\Models\WorkspaceTemplateColumn;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WorkspaceTemplateColumn>
 */
class WorkspaceTemplateColumnFactory extends Factory
{
    public function definition(): array
    {
        return [
            'workspace_template_id' => WorkspaceTemplate::factory(),
            'title' => fake()->words(2, true),
            'description' => null,
            'color' => ColumnColor::Green,
            'position' => 0,
        ];
    }
}
