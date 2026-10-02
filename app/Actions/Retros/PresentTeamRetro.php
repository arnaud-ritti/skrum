<?php

namespace App\Actions\Retros;

use App\Enums\RetroPhase;
use App\Models\Retro;
use App\Support\RetroTemplates\TemplateCatalogue;

class PresentTeamRetro
{
    /**
     * @return array{
     *     id: string,
     *     title: string,
     *     phase: string,
     *     phaseLabel: string,
     *     createdAt: ?string,
     *     templateName: string,
     *     facilitator: ?array{name: string, avatarUrl: string},
     *     rotiAverage: ?float,
     *     viewerHasJoined: bool
     * }
     */
    public function handle(Retro $retro): array
    {
        return [
            'id' => $retro->id,
            'title' => $retro->title,
            'phase' => $retro->phase->value,
            'phaseLabel' => $retro->phase->label(),
            'createdAt' => $retro->created_at?->toIso8601String(),
            'templateName' => $this->templateName($retro),
            'facilitator' => $retro->facilitator === null ? null : [
                'name' => $retro->facilitator->displayName(),
                'avatarUrl' => $retro->facilitator->avatarUrl(),
            ],
            'rotiAverage' => $this->rotiAverage($retro),
            'viewerHasJoined' => $this->viewerHasJoined($retro),
        ];
    }

    private function templateName(Retro $retro): string
    {
        if ($retro->template === TemplateCatalogue::Workspace) {
            return $retro->workspaceTemplate?->name ?? __('Workspace template');
        }

        return TemplateCatalogue::find($retro->template)?->name() ?? $retro->template;
    }

    /**
     * Read from the `viewer_has_joined` aggregate of the query: a retro loaded
     * without it, or a completed one, has nothing to resume.
     */
    private function viewerHasJoined(Retro $retro): bool
    {
        if ($retro->phase === RetroPhase::Completed) {
            return false;
        }

        return (bool) $retro->getAttribute('viewer_has_joined');
    }

    private function rotiAverage(Retro $retro): ?float
    {
        if ($retro->phase !== RetroPhase::Completed) {
            return null;
        }

        if ($retro->roti_votes_avg_score === null) {
            return null;
        }

        return round((float) $retro->roti_votes_avg_score, 1);
    }
}
