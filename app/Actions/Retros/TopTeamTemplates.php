<?php

namespace App\Actions\Retros;

use App\Models\Retro;
use App\Models\Team;
use App\Models\WorkspaceTemplate;
use App\Support\RetroTemplates\TemplateCatalogue;

class TopTeamTemplates
{
    private const int Count = 5;

    /** @return list<string> */
    public function handle(Team $team): array
    {
        $usedKeys = $this->usedKeys($team);

        return collect([...$usedKeys, ...TemplateCatalogue::Shortcuts])
            ->unique()
            ->take(self::Count)
            ->values()
            ->all();
    }

    /** @return list<string> */
    private function usedKeys(Team $team): array
    {
        $workspaceTemplateIds = WorkspaceTemplate::query()
            ->where('workspace_id', $team->workspace_id)
            ->pluck('id')
            ->all();

        $keys = Retro::query()
            ->where('team_id', $team->id)
            ->where('template', '!=', TemplateCatalogue::Custom)
            ->selectRaw('template, workspace_template_id, count(*) as uses, max(created_at) as last_used_at')
            ->groupBy('template', 'workspace_template_id')
            ->orderByDesc('uses')
            ->latest('last_used_at')
            ->get()
            ->map(function (Retro $row) use ($workspaceTemplateIds): ?string {
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
