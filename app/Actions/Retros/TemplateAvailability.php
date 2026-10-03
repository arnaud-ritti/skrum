<?php

namespace App\Actions\Retros;

use App\Models\Team;
use App\Models\User;
use App\Models\WorkspaceTemplate;
use App\Support\RetroTemplates\TemplateCatalogue;

class TemplateAvailability
{
    /**
     * A built-in key, or a template of the team's workspace that this person sees from this team.
     */
    public function isAvailable(Team $team, User $user, mixed $key): bool
    {
        if (! is_string($key)) {
            return false;
        }

        $templateId = WorkspaceTemplate::idFromKey($key);

        if ($templateId === null) {
            return TemplateCatalogue::has($key);
        }

        return $team->workspace->templates()
            ->visibleTo($user, $team->workspace, $team)
            ->whereKey($templateId)
            ->exists();
    }
}
