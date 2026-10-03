<?php

namespace App\Actions\Teams;

use App\Actions\Retros\TemplateAvailability;
use App\Actions\Retros\TopTeamTemplates;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\WorkspaceTemplate;
use App\Support\RetroTemplates\TemplateCatalogue;
use Illuminate\Database\Eloquent\Builder;

/**
 * @phpstan-type TemplateUsage array{
 *     key: string,
 *     name: string,
 *     columns: array<int, array{title: string, description: ?string, color: string}>,
 *     usageCount: int,
 *     isDefault: bool,
 *     templateId: ?string,
 *     canEdit: bool
 * }
 */
class TeamTemplateUsage
{
    public function __construct(
        private TopTeamTemplates $topTeamTemplates,
        private TemplateAvailability $templateAvailability,
    ) {}

    /**
     * The team's top templates and its default, with the team's own usage of each.
     *
     * @return array<int, TemplateUsage>
     */
    public function handle(Team $team, User $viewer): array
    {
        $keys = $this->topTeamTemplates->handle($team);
        $default = $team->default_retro_template;

        if ($default !== null && ! in_array($default, $keys, true) && $this->templateAvailability->isAvailable($team, $viewer, $default)) {
            $keys[] = $default;
        }

        $rows = [];

        foreach ($keys as $key) {
            $row = $this->row($team, $viewer, $key, $default);

            if ($row !== null) {
                $rows[] = $row;
            }
        }

        return $rows;
    }

    /**
     * @return TemplateUsage|null
     */
    private function row(Team $team, User $viewer, string $key, ?string $default): ?array
    {
        $templateId = WorkspaceTemplate::idFromKey($key);

        if ($templateId !== null) {
            return $this->workspaceTemplateRow($team, $viewer, $key, $templateId, $default);
        }

        $definition = TemplateCatalogue::find($key);

        if ($definition === null) {
            return null;
        }

        return [
            'key' => $key,
            'name' => $definition->name(),
            'columns' => array_map(fn (array $column): array => [
                'title' => $column['title'],
                'description' => $column['description'],
                'color' => $column['color']->value,
            ], $definition->translatedColumns()),
            'usageCount' => Retro::query()->where('team_id', $team->id)->where('template', $key)->count(),
            'isDefault' => $key === $default,
            'templateId' => null,
            'canEdit' => false,
        ];
    }

    /**
     * @return TemplateUsage|null
     */
    private function workspaceTemplateRow(Team $team, User $viewer, string $key, string $templateId, ?string $default): ?array
    {
        $template = WorkspaceTemplate::query()
            ->where('workspace_id', $team->workspace_id)
            ->with('columns')
            ->withCount(['retros' => fn (Builder $retros) => $retros->where('team_id', $team->id)])
            ->find($templateId);

        if ($template === null) {
            return null;
        }

        return [
            'key' => $key,
            'name' => $template->name,
            'columns' => $template->presentColumns(),
            'usageCount' => (int) $template->retros_count,
            'isDefault' => $key === $default,
            'templateId' => $template->id,
            'canEdit' => $viewer->can('update', $template),
        ];
    }
}
