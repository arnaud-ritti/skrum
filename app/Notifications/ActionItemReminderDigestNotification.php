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
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Query\Builder as QueryBuilder;
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
     * so an item deleted, completed or reassigned in between is left out.
     *
     * @param  array<int, array{actionItemId: string, kind: string}>  $reminders
     */
    public function __construct(public array $reminders) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    /**
     * The queue may run long after the reminder was chosen: nothing is mailed once the user turned
     * the mail off, was deactivated, or no item is still open, theirs and in one of their teams.
     */
    public function shouldSend(object $notifiable, string $channel): bool
    {
        if (! $notifiable instanceof User) {
            return false;
        }

        if ($notifiable->isDeactivated() || ! $notifiable->action_item_reminders_by_email) {
            return false;
        }

        return $this->stillDue($notifiable)->exists();
    }

    public function toMail(User $notifiable): ActionItemReminderMail
    {
        /** @var Collection<string, ActionItem> $items */
        $items = $this->stillDue($notifiable)
            ->with(['team.workspace', 'externalLinks'])
            ->get()
            ->keyBy('id');
        $overdue = $this->itemsOfKind($items, ActionItemReminderKind::Overdue);
        $dueSoon = $this->itemsOfKind($items, ActionItemReminderKind::DueSoon);
        $shownOverdue = $overdue->take(self::Limit);
        $shownDueSoon = $dueSoon->take(self::Limit - $shownOverdue->count());
        $first = $overdue->concat($dueSoon)->first();

        return new ActionItemReminderMail(
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
        )
            ->subject($this->subject($overdue->count(), $dueSoon->count()))
            ->forNotifiable($notifiable);
    }

    /** @return Builder<ActionItem> */
    private function stillDue(User $user): Builder
    {
        return ActionItem::query()
            ->whereKey(array_column($this->reminders, 'actionItemId'))
            ->whereNull('completed_at')
            ->where('assignee_user_id', $user->id)
            ->whereExists(fn (QueryBuilder $query) => $query
                ->from('team_user')
                ->whereColumn('team_user.team_id', 'action_items.team_id')
                ->where('team_user.user_id', $user->id));
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
            'due' => $dueOn->settings(['locale' => app()->getLocale()])->isoFormat('D MMM'),
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
