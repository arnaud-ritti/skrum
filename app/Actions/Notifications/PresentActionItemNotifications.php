<?php

namespace App\Actions\Notifications;

use App\Enums\ActionItemReminderKind;
use App\Models\ActionItem;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class PresentActionItemNotifications
{
    /**
     * Notifications store ids only; the item is read live, and one of a
     * team the user can no longer view is left out.
     *
     * @param  Collection<int, DatabaseNotification>  $notifications
     * @param  array<int, string>  $viewableTeamIds
     * @return array<string, array{
     *     wording: string,
     *     actionItem: array{id: string, content: string, teamName: string, dueOn: ?string, isOverdue: bool, url: string, ticket: ?string}
     * }>
     */
    public function handle(Collection $notifications, array $viewableTeamIds): array
    {
        $reminders = $notifications->filter(
            fn (DatabaseNotification $notification): bool => ActionItemReminderKind::tryFrom((string) ($notification->data['kind'] ?? '')) !== null,
        );

        if ($reminders->isEmpty()) {
            return [];
        }

        $items = ActionItem::query()
            ->with(['team.workspace', 'externalLinks'])
            ->whereKey($reminders->pluck('data.actionItemId')->filter()->unique())
            ->whereIn('team_id', $viewableTeamIds)
            ->get()
            ->keyBy('id');

        return $reminders
            ->filter(fn (DatabaseNotification $notification): bool => $items->has($notification->data['actionItemId'] ?? ''))
            ->mapWithKeys(fn (DatabaseNotification $notification): array => [
                $notification->id => $this->present($notification, $items[$notification->data['actionItemId']]),
            ])
            ->all();
    }

    /**
     * @return array{
     *     wording: string,
     *     actionItem: array{id: string, content: string, teamName: string, dueOn: ?string, isOverdue: bool, url: string, ticket: ?string}
     * }
     */
    private function present(DatabaseNotification $notification, ActionItem $item): array
    {
        return [
            'wording' => $this->wording($notification),
            'actionItem' => [
                'id' => $item->id,
                'content' => $item->content,
                'teamName' => $item->team->name,
                'dueOn' => $item->due_on?->toDateString(),
                'isOverdue' => $item->isOverdue(ActionItem::today()),
                'url' => route('workspaces.actionItems.index', ['workspace' => $item->team->workspace, 'item' => $item->id]),
                'ticket' => $this->ticket($item),
            ],
        ];
    }

    private function ticket(ActionItem $item): ?string
    {
        $key = $item->externalLinks->first()?->external_key;

        return blank($key) ? null : Str::squish($key);
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
