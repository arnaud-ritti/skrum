<?php

namespace Database\Factories;

use App\Enums\TemplateCategory;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use App\Models\WorkspaceTemplateColumn;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Database\Eloquent\Factories\Sequence;

/**
 * @extends Factory<WorkspaceTemplate>
 */
class WorkspaceTemplateFactory extends Factory
{
    public function definition(): array
    {
        return [
            'workspace_id' => Workspace::factory(),
            'name' => fake()->unique()->words(3, true),
            'category' => TemplateCategory::Essentials,
        ];
    }

    public function withColumns(int $count = 2): static
    {
        return $this->has(
            WorkspaceTemplateColumn::factory()->count($count)->state(new Sequence(fn (Sequence $sequence) => ['position' => $sequence->index])),
            'columns',
        );
    }
}
