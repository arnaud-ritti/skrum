<?php

namespace App\Actions\ActionItems;

use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\User;
use App\Models\Workspace;

class WorkspaceActionItemGuard
{
    /**
     * Items of another workspace or of a team the viewer cannot see do not
     * exist for them: 404, never 403.
     */
    public static function visible(User $user, Workspace $workspace, ActionItem $item): void
    {
        abort_unless($item->team->workspace_id === $workspace->id, 404);
        abort_unless($user->can('view', $item->team), 404);
    }

    /**
     * A board closed for editing mid-meeting freezes its items everywhere;
     * completed retros and items without a retro never are.
     */
    public static function writable(ActionItem $item): void
    {
        $retro = $item->retro;

        if ($retro === null) {
            return;
        }

        if ($retro->phase === RetroPhase::Completed) {
            return;
        }

        RetroGuard::unlocked($retro);
    }
}
