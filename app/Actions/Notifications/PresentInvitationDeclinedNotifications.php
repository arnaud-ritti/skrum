<?php

namespace App\Actions\Notifications;

use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Notifications\InvitationDeclinedNotification;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Collection;

class PresentInvitationDeclinedNotifications
{
    /**
     * The workspace and the team are read live. A decline is left out once
     * the user left its workspace; when the team is gone or out of the
     * user's sight, the item names the workspace instead.
     *
     * @param  Collection<int, DatabaseNotification>  $notifications
     * @return array<string, array{
     *     actor: null,
     *     email: string,
     *     team: string,
     *     href: string,
     *     target: string
     * }>
     */
    public function handle(User $user, Collection $notifications): array
    {
        $declines = $notifications->filter(
            fn (DatabaseNotification $notification): bool => ($notification->data['kind'] ?? null) === InvitationDeclinedNotification::Kind,
        );

        if ($declines->isEmpty()) {
            return [];
        }

        $workspaces = Workspace::query()
            ->whereKey($declines->map(fn (DatabaseNotification $notification) => $notification->data['workspaceId'] ?? null)->filter()->unique()->values())
            ->get()
            ->keyBy('id');

        $teams = Team::query()
            ->whereKey($declines->map(fn (DatabaseNotification $notification) => $notification->data['teamId'] ?? null)->filter()->unique()->values())
            ->get()
            ->keyBy('id');

        $presented = [];

        foreach ($declines as $notification) {
            $workspace = $workspaces->get($notification->data['workspaceId'] ?? '');

            if ($workspace === null) {
                continue;
            }

            if (! $user->belongsToWorkspace($workspace)) {
                continue;
            }

            $presented[$notification->id] = [
                'actor' => null,
                'email' => (string) ($notification->data['email'] ?? ''),
                ...$this->subject($user, $workspace, $teams->get($notification->data['teamId'] ?? '')),
            ];
        }

        return $presented;
    }

    /**
     * `target` names what `href` opens: the team, the workspace's members
     * or the workspace.
     *
     * @return array{
     *     team: string,
     *     href: string,
     *     target: string
     * }
     */
    private function subject(User $user, Workspace $workspace, ?Team $team): array
    {
        if ($team !== null && $team->workspace_id === $workspace->id && $user->can('view', $team)) {
            return [
                'team' => $team->name,
                'href' => route('teams.show', [$workspace, $team]).'#members',
                'target' => 'team',
            ];
        }

        if ($user->can('manageMembers', $workspace)) {
            return [
                'team' => $workspace->name,
                'href' => route('workspaces.members.index', $workspace),
                'target' => 'members',
            ];
        }

        return [
            'team' => $workspace->name,
            'href' => route('workspaces.show', $workspace),
            'target' => 'workspace',
        ];
    }
}
