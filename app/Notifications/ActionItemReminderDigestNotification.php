<?php

namespace App\Notifications;

use App\Enums\ActionItemReminderKind;
use App\Mail\ActionItemReminderMail;
use App\Models\ActionItem;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Collection as SupportCollection;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

class ActionItemReminderDigestNotification extends Notification implements ShouldBeEncrypted, ShouldQueue
{
    use Queueable;

    public const Limit = 20;

    /**
     * Ids only: the items are read again when the queued mail is written,
     * so an item deleted in between is left out.
     *
     * @param  array<int, array{actionItemId: string, kind: string}>  $reminders
     */
    public function __construct(public array $reminders) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(User $notifiable): ActionItemReminderMail
    {
        /** @var Collection<string, ActionItem> $items */
        $items = ActionItem::query()
            ->with(['team.workspace', 'externalLinks'])
            ->whereKey(array_column($this->reminders, 'actionItemId'))
            ->get()
            ->keyBy('id');
        $overdue = $this->itemsOfKind($items, ActionItemReminderKind::Overdue);
        $dueSoon = $this->itemsOfKind($items, ActionItemReminderKind::DueSoon);
        $shownOverdue = $overdue->take(self::Limit);
        $shownDueSoon = $dueSoon->take(self::Limit - $shownOverdue->count());
        $first = $overdue->concat($dueSoon)->first();

        return (new ActionItemReminderMail(
            $shownOverdue->map($this->present(...))->all(),
            $shownDueSoon->map($this->present(...))->all(),
            $overdue->count() + $dueSoon->count() - $shownOverdue->count() - $shownDueSoon->count(),
            $first === null ? null : route('workspaces.actionItems.index', [
                'workspace' => $first->team->workspace,
                'assignee' => 'me',
                'status' => 'open',
            ]),
            URL::signedRoute('reminderUnsubscribes.show', ['user' => $notifiable->id]),
            route('notificationPreferences.edit'),
        ))
            ->subject($this->subject($overdue->count(), $dueSoon->count()))
            ->forNotifiable($notifiable);
    }

    /**
     * @return array{content: string, url: string, team: string, due: string, daysLate: int, ticket: ?string}
     */
    private function present(ActionItem $item): array
    {
        $dueOn = CarbonImmutable::parse((string) $item->due_on?->toDateString(), (string) config('app.timezone'));

        return [
            'content' => Str::squish($item->content),
            'url' => route('workspaces.actionItems.index', ['workspace' => $item->team->workspace, 'item' => $item->id]),
            'team' => Str::squish($item->team->name),
            'due' => $dueOn->locale(app()->getLocale())->isoFormat('D MMM'),
            'daysLate' => max(0, (int) $dueOn->diffInDays(ActionItem::today()->startOfDay())),
            'ticket' => $this->ticket($item),
        ];
    }

    private function ticket(ActionItem $item): ?string
    {
        $key = $item->externalLinks->first()?->external_key;

        return blank($key) ? null : Str::squish($key);
    }

    /**
     * @param  Collection<string, ActionItem>  $items
     * @return SupportCollection<int, ActionItem>
     */
    private function itemsOfKind(Collection $items, ActionItemReminderKind $kind): SupportCollection
    {
        return collect($this->reminders)
            ->filter(fn (array $reminder): bool => $reminder['kind'] === $kind->value && $items->has($reminder['actionItemId']))
            ->map(fn (array $reminder): ActionItem => $items[$reminder['actionItemId']])
            ->values();
    }

    private function subject(int $overdue, int $dueSoon): string
    {
        if ($overdue > 0 && $dueSoon > 0) {
            return __('Action items need your attention');
        }

        if ($overdue > 0) {
            return trans_choice(':count action item is overdue|:count action items are overdue', $overdue);
        }

        return trans_choice(':count action item is due soon|:count action items are due soon', $dueSoon);
    }
}
