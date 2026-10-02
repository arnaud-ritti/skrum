<?php

namespace App\Actions\Notifications;

use App\Enums\ActionItemReminderKind;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use App\Notifications\RetroResultsNotification;
use App\Notifications\WorkspaceInvitationReceivedNotification;
use Illuminate\Contracts\Database\Query\Builder;
use Illuminate\Notifications\DatabaseNotification;

class ListNotifications
{
    public const int PerPage = 20;

    public function __construct(
        private BellNotifications $bellNotifications,
        private PresentActionItemNotifications $presentActionItemNotifications,
        private PresentRecapNotifications $presentRecapNotifications,
        private PresentInvitationNotifications $presentInvitationNotifications,
    ) {}

    /**
     * Notifications store ids only: each subject is read live, and a
     * notification whose subject the user may no longer see is deleted.
     * One of a kind no presenter knows is kept, and not listed.
     *
     * @param  ?string  $before  id of one of the user's notifications; the page starts after it
     * @return array{
     *     notifications: array<int, array<string, mixed>>,
     *     unreadCount: int,
     *     hasMore: bool
     * }
     */
    public function handle(User $user, ?string $before): array
    {
        $query = $this->bellNotifications->query($user)->orderByDesc('id')->limit(self::PerPage + 1);

        if ($before !== null) {
            /** @var DatabaseNotification $cursor */
            $cursor = $user->notifications()->findOrFail($before);

            $query->where(fn (Builder $older) => $older
                ->where('created_at', '<', $cursor->created_at)
                ->orWhere(fn (Builder $sameInstant) => $sameInstant
                    ->where('created_at', $cursor->created_at)
                    ->where('id', '<', $cursor->id)));
        }

        $fetched = $query->get();
        $notifications = $fetched->take(self::PerPage);
        $viewableTeamIds = $this->viewableTeamIds($user);

        $presented = [
            ...$this->presentActionItemNotifications->handle($notifications, $viewableTeamIds),
            ...$this->presentRecapNotifications->handle($notifications, $viewableTeamIds),
            ...$this->presentInvitationNotifications->handle($user, $notifications),
        ];

        $visible = $notifications->filter(fn (DatabaseNotification $notification): bool => isset($presented[$notification->id]));

        $outOfReach = $notifications->diff($visible)->filter(fn (DatabaseNotification $notification): bool => $this->hasPresenter($notification));

        DatabaseNotification::query()->whereKey($outOfReach->modelKeys())->delete();

        return [
            'notifications' => $visible
                ->map(fn (DatabaseNotification $notification): array => [
                    'id' => $notification->id,
                    'kind' => (string) $notification->data['kind'],
                    'readAt' => $notification->read_at?->toIso8601String(),
                    'createdAt' => $notification->created_at?->toIso8601String(),
                    ...$presented[$notification->id],
                ])
                ->values()
                ->all(),
            'unreadCount' => $this->bellNotifications->unreadCount($user),
            'hasMore' => $fetched->count() > self::PerPage,
        ];
    }

    private function hasPresenter(DatabaseNotification $notification): bool
    {
        $kind = (string) ($notification->data['kind'] ?? '');

        if (ActionItemReminderKind::tryFrom($kind) !== null) {
            return true;
        }

        return in_array($kind, [RetroResultsNotification::Kind, WorkspaceInvitationReceivedNotification::Kind], true);
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
}
