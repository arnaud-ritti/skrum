<?php

namespace App\Actions\Retros;

use App\Enums\TemplateVisibility;
use App\Models\Retro;
use App\Models\Team;
use App\Models\WorkspaceTemplate;
use App\Support\RetroTemplates\TemplateCatalogue;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

class TopTeamTemplates
{
    private const int Count = 5;

    private const int Window = 100;

    /**
     * The templates a team used most, counted over its latest hundred retros.
     *
     * @return array<int, string>
     */
    public function handle(Team $team): array
    {
        $usedKeys = $this->usedKeys($team);

        return collect([...$usedKeys, ...TemplateCatalogue::Shortcuts])
            ->unique()
            ->take(self::Count)
            ->values()
            ->all();
    }

    /** @return array<int, string> */
    private function usedKeys(Team $team): array
    {
        $workspaceTemplateIds = WorkspaceTemplate::query()
            ->where('workspace_id', $team->workspace_id)
            ->where(fn (Builder $shared) => $shared
                ->where('visibility', TemplateVisibility::Workspace->value)
                ->orWhere(fn (Builder $teamTemplates) => $teamTemplates->where('visibility', TemplateVisibility::Team->value)->where('team_id', $team->id)))
            ->pluck('id')
            ->all();

        $keys = Retro::query()
            ->where('team_id', $team->id)
            ->where('template', '!=', TemplateCatalogue::Custom)
            ->latest()
            ->orderByDesc('id')
            ->limit(self::Window)
            ->get(['template', 'workspace_template_id', 'created_at'])
            ->groupBy(fn (Retro $retro): string => "{$retro->template}|{$retro->workspace_template_id}")
            ->sort(fn (Collection $first, Collection $second): int => [$second->count(), $second->max('created_at')] <=> [$first->count(), $first->max('created_at')])
            ->map(function (Collection $uses) use ($workspaceTemplateIds): ?string {
                /** @var Retro $row */
                $row = $uses->firstOrFail();

                if ($row->workspace_template_id !== null) {
                    return in_array($row->workspace_template_id, $workspaceTemplateIds, true) ?
                        WorkspaceTemplate::KeyPrefix.$row->workspace_template_id :
                        null;
                }

                return TemplateCatalogue::find($row->template)?->key;
            })
            ->filter();

        return $keys->values()->all();
    }
}
