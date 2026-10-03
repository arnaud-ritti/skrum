<?php

namespace App\Policies;

use App\Enums\TemplateVisibility;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceTemplate;

class WorkspaceTemplatePolicy
{
    public function view(User $user, WorkspaceTemplate $template): bool
    {
        return match ($template->visibility) {
            TemplateVisibility::Workspace => $user->belongsToWorkspace($template->workspace),
            TemplateVisibility::Team => $template->team !== null && $user->can('view', $template->team),
            TemplateVisibility::Personal => $this->ownsPersonal($user, $template),
        };
    }

    public function update(User $user, WorkspaceTemplate $template): bool
    {
        return match ($template->visibility) {
            TemplateVisibility::Workspace => $user->canManage($template->workspace),
            TemplateVisibility::Team => $template->team !== null && $user->managesRitualsOf($template->team),
            TemplateVisibility::Personal => $this->ownsPersonal($user, $template),
        };
    }

    public function delete(User $user, WorkspaceTemplate $template): bool
    {
        return $this->update($user, $template);
    }

    /**
     * Whether the person may give a template this visibility (and this team).
     */
    public function share(User $user, Workspace $workspace, TemplateVisibility $visibility, ?Team $team = null): bool
    {
        return match ($visibility) {
            TemplateVisibility::Workspace => $user->canManage($workspace),
            TemplateVisibility::Team => $team !== null && $team->workspace_id === $workspace->id && $user->managesRitualsOf($team),
            TemplateVisibility::Personal => $user->belongsToWorkspace($workspace),
        };
    }

    private function ownsPersonal(User $user, WorkspaceTemplate $template): bool
    {
        if ($template->created_by_user_id === null) {
            return $user->canManage($template->workspace);
        }

        return $template->created_by_user_id === $user->id;
    }
}
