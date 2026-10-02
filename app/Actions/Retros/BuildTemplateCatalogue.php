<?php

namespace App\Actions\Retros;

use App\Models\Workspace;
use App\Models\WorkspaceTemplate;
use App\Support\Alphabetical;
use App\Support\RetroTemplates\TemplateCatalogue;
use App\Support\RetroTemplates\TemplateDefinition;

class BuildTemplateCatalogue
{
    /**
     * @return array<int, array{
     *     key: string,
     *     name: string,
     *     category: ?string,
     *     isCommon: bool,
     *     isWorkspace: bool,
     *     columns: array<int, array{title: string, description: ?string, color: string}>
     * }>
     */
    public function handle(Workspace $workspace): array
    {
        $workspaceTemplates = Alphabetical::sort($workspace->templates()->with('columns')->get(), fn (WorkspaceTemplate $template): string => $template->name)
            ->map(fn (WorkspaceTemplate $template): array => [
                'key' => $template->catalogueKey(),
                'name' => $template->name,
                'category' => $template->category->value,
                'isCommon' => false,
                'isWorkspace' => true,
                'columns' => $template->presentColumns(),
            ])
            ->values()
            ->all();

        $builtIns = array_map(fn (TemplateDefinition $definition): array => [
            'key' => $definition->key,
            'name' => $definition->name(),
            'category' => $definition->category?->value,
            'isCommon' => $definition->isCommon,
            'isWorkspace' => false,
            'columns' => array_map(fn (array $column): array => [
                'title' => $column['title'],
                'description' => $column['description'],
                'color' => $column['color']->value,
            ], $definition->translatedColumns()),
        ], TemplateCatalogue::all());

        return [...$workspaceTemplates, ...$builtIns];
    }
}
