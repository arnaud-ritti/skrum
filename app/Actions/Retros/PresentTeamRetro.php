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
     *     rotiAverage: ?float
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
        ];
    }

    private function templateName(Retro $retro): string
    {
        if ($retro->template === TemplateCatalogue::Workspace) {
            return $retro->workspaceTemplate?->name ?? __('Workspace template');
        }

        return TemplateCatalogue::find($retro->template)?->name() ?? $retro->template;
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
