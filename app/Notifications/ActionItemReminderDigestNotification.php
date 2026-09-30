<?php

namespace App\Notifications;

use App\Enums\ActionItemReminderKind;
use App\Models\ActionItem;
use Carbon\CarbonImmutable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Collection as SupportCollection;

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

    public function toMail(object $notifiable): MailMessage
    {
        /** @var Collection<string, ActionItem> $items */
        $items = ActionItem::query()
            ->with(['team.workspace', 'retro'])
            ->whereKey(array_column($this->reminders, 'actionItemId'))
            ->get()
            ->keyBy('id');
        $overdue = $this->itemsOfKind($items, ActionItemReminderKind::Overdue);
        $dueSoon = $this->itemsOfKind($items, ActionItemReminderKind::DueSoon);
        $shownOverdue = $overdue->take(self::Limit);
        $shownDueSoon = $dueSoon->take(self::Limit - $shownOverdue->count());
        $hidden = $overdue->count() + $dueSoon->count() - $shownOverdue->count() - $shownDueSoon->count();

        $mail = (new MailMessage)->subject($this->subject($overdue->count(), $dueSoon->count()));

        $this->section($mail, __('Overdue'), $shownOverdue);
        $this->section($mail, __('Due soon'), $shownDueSoon);

        if ($hidden > 0) {
            $mail->line(__('And :count more.', ['count' => $hidden]));
        }

        $first = $overdue->concat($dueSoon)->first();

        if ($first !== null) {
            $mail->action(__('View my open action items'), route('workspaces.actionItems.index', [
                'workspace' => $first->team->workspace,
                'assignee' => 'me',
                'status' => 'open',
            ]));
        }

        $settingsLabel = $this->escape(__('Notification settings'));
        $settingsUrl = route('notificationPreferences.edit');

        return $mail
            ->line(__('You can turn off these reminders in your notification settings.'))
            ->line("[{$settingsLabel}]({$settingsUrl})");
    }

    /**
     * @param  Collection<string, ActionItem>  $items
     * @return SupportCollection<int, ActionItem>
     */
    private function itemsOfKind(Collection $items, ActionItemReminderKind $kind): SupportCollection
    {
        return collect($this->reminders)
            ->filter(fn (array $reminder) => $reminder['kind'] === $kind->value && $items->has($reminder['actionItemId']))
            ->map(fn (array $reminder): ActionItem => $items[$reminder['actionItemId']])
            ->values();
    }

    /**
     * @param  SupportCollection<int, ActionItem>  $items
     */
    private function section(MailMessage $mail, string $title, SupportCollection $items): void
    {
        if ($items->isEmpty()) {
            return;
        }

        $mail->line("**{$this->escape($title)}**");

        foreach ($items as $item) {
            $mail->line($this->describe($item));
        }
    }

    private function describe(ActionItem $item): string
    {
        $url = route('workspaces.actionItems.index', ['workspace' => $item->team->workspace, 'item' => $item->id]);
        $content = $this->escape($item->content);
        $team = $this->escape($item->team->name);
        $source = $this->escape($item->retro === null ? __('Added outside a retro') : $item->retro->title);
        $due = $this->dueWording($item);

        return "[{$content}]({$url}) · {$team} · {$source} · {$due}";
    }

    private function dueWording(ActionItem $item): string
    {
        $dueOn = (string) $item->due_on?->toDateString();
        $today = ActionItem::today();

        if ($dueOn === $today->toDateString()) {
            return __('Due today');
        }

        if ($dueOn === $today->addDay()->toDateString()) {
            return __('Due tomorrow');
        }

        return __('Due :date', ['date' => CarbonImmutable::parse($dueOn)->settings(['locale' => app()->getLocale()])->isoFormat('LL')]);
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

    /**
     * Item text is user input: escaping Markdown keeps it from becoming a
     * link or formatting in the e-mail.
     */
    private function escape(string $text): string
    {
        $singleLine = preg_replace('/\s+/u', ' ', $text) ?? $text;

        return addcslashes($singleLine, '\\`*_{}[]()#+-.!|');
    }
}
