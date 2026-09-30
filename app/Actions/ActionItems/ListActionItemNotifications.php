<?php

namespace App\Actions\ActionItems;

use App\Enums\ActionItemReminderKind;
use App\Enums\WorkspaceRole;
use App\Models\ActionItem;
use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Notifications\DatabaseNotification;

class ListActionItemNotifications
{
    public const Limit = 30;

    /**
     * Notifications store ids only; the item is read live and a user who
     * lost access to it no longer sees it (the notification is deleted).
     *
     * @return array{
     *     notifications: array<int, array<string, mixed>>,
     *     unreadCount: int
     * }
     */
    public function handle(User $user): array
    {
        $notifications = $user->notifications()->limit(self::Limit)->get();
        /** @var Collection<string, ActionItem> $items */
        $items = ActionItem::query()
            ->with('team.workspace')
            ->whereKey($notifications->map(fn (DatabaseNotification $notification) => $notification->data['actionItemId'] ?? null)->filter()->unique()->values())
            ->get()
            ->keyBy('id');
        $viewableTeamIds = $this->viewableTeamIds($user);
        $visible = $notifications->filter(function (DatabaseNotification $notification) use ($items, $viewableTeamIds): bool {
            $item = $items->get($notification->data['actionItemId'] ?? '');

            return $item !== null && in_array($item->team_id, $viewableTeamIds, true);
        });

        DatabaseNotification::query()->whereKey($notifications->diff($visible)->modelKeys())->delete();

        return [
            'notifications' => $visible
                ->map(fn (DatabaseNotification $notification) => $this->present($notification, $items[$notification->data['actionItemId']]))
                ->values()
                ->all(),
            'unreadCount' => $user->unreadNotifications()->count(),
        ];
    }

    /**
     * Same rule as TeamPolicy::view: every team of the workspaces the user
     * manages, and the teams they belong to.
     *
     * @return array<int, string>
     */
    private function viewableTeamIds(User $user): array
    {
        $managedWorkspaceIds = $user->workspaces()
            ->wherePivotIn('role', [WorkspaceRole::Owner->value, WorkspaceRole::Admin->value])
            ->pluck('workspaces.id');

        /** @var array<int, string> $teamIds */
        $teamIds = Team::query()
            ->whereIn('workspace_id', $managedWorkspaceIds)
            ->orWhereIn('id', $user->teams()->select('teams.id'))
            ->pluck('id')
            ->all();

        return $teamIds;
    }

    /**
     * @return array{
     *     id: string,
     *     kind: string,
     *     wording: string,
     *     readAt: ?string,
     *     createdAt: ?string,
     *     actionItem: array{id: string, content: string, teamName: string, dueOn: ?string, isOverdue: bool, url: string}
     * }
     */
    private function present(DatabaseNotification $notification, ActionItem $item): array
    {
        return [
            'id' => $notification->id,
            'kind' => (string) ($notification->data['kind'] ?? ''),
            'wording' => $this->wording($notification),
            'readAt' => $notification->read_at?->toIso8601String(),
            'createdAt' => $notification->created_at?->toIso8601String(),
            'actionItem' => [
                'id' => $item->id,
                'content' => $item->content,
                'teamName' => $item->team->name,
                'dueOn' => $item->due_on?->toDateString(),
                'isOverdue' => $item->isOverdue(ActionItem::today()),
                'url' => route('workspaces.actionItems.index', ['workspace' => $item->team->workspace, 'item' => $item->id]),
            ],
        ];
    }

    private function wording(DatabaseNotification $notification): string
    {
        if (($notification->data['kind'] ?? null) === ActionItemReminderKind::Overdue->value) {
            return 'overdue';
        }

        $sentOn = $notification->created_at?->setTimezone((string) config('app.timezone'))->toDateString();

        return ($notification->data['dueOn'] ?? null) === $sentOn ? 'due_today' : 'due_tomorrow';
    }
}
