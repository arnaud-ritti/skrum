<?php

namespace App\Actions\Onboarding;

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Support\InstanceSettings;

class JoinDefaultWorkspace
{
    public function __construct(
        private InstanceSettings $settings,
        private StartOnboarding $startOnboarding,
    ) {}

    /**
     * A new SSO account that no invitation and no usable link brought
     * joins the instance's default workspace as a member and starts the
     * onboarding at the team step.
     */
    public function handle(User $user): ?Workspace
    {
        $workspaceId = $this->settings->defaultWorkspaceId();

        if ($workspaceId === null) {
            return null;
        }

        $workspace = Workspace::query()->find($workspaceId);

        if ($workspace === null) {
            return null;
        }

        if (! $user->belongsToWorkspace($workspace)) {
            $workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
        }

        $user->forceFill(['current_workspace_id' => $workspace->id])->save();
        $this->startOnboarding->handle($user, null, $workspace);

        return $workspace;
    }
}
