<?php

namespace App\Actions\ActionItems;

use App\Enums\ActionItemReminderKind;
use App\Models\ActionItem;
use App\Models\ActionItemReminder;
use App\Models\User;
use App\Notifications\ActionItemReminderDigestNotification;
use App\Notifications\ActionItemReminderNotification;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Contracts\Database\Query\Builder;
use Illuminate\Database\Eloquent\Collection;
use Throwable;

class SendActionItemReminders
{
    /**
     * Open items due today or tomorrow ("due soon") or during the last
     * seven days ("overdue"), assigned to a verified member still in the
     * item's team: one digest and one bell entry per item, each channel
     * unless the user turned it off.
     *
     * @param  (Closure(User, int): void)|null  $progress
     * @return array{reminders: int, users: int}
     */
    public function handle(?Closure $progress = null): array
    {
        $today = ActionItem::today();
        $reminders = 0;
        $users = 0;

        foreach ($this->dueItems($today)->groupBy('assignee_user_id') as $items) {
            try {
                /** @var Collection<int, ActionItem> $items */
                $user = $items->first()?->assigneeUser;

                if ($user === null) {
                    continue;
                }

                if (! $user->action_item_reminders_by_email && ! $user->action_item_reminders_in_app) {
                    continue;
                }

                $unsent = $items->filter(fn (ActionItem $item): bool => $this->log($item, $user, $today))->values();

                if ($unsent->isEmpty()) {
                    continue;
                }

                if ($progress !== null) {
                    $progress($user, $unsent->count());
                }

                $this->deliver($user, $unsent, $today);

                $reminders += $unsent->count();
                $users++;
            } catch (Throwable $e) {
                report($e);
            }
        }

        return ['reminders' => $reminders, 'users' => $users];
    }

    /**
     * @return Collection<int, ActionItem>
     */
    private function dueItems(CarbonImmutable $today): Collection
    {
        return ActionItem::query()
            ->whereNull('completed_at')
            ->whereNotNull('assignee_user_id')
            ->whereBetween('due_on', [$today->subDays(7)->toDateString(), $today->addDay()->toDateString()])
            ->whereExists(fn ($query) => $query
                ->from('team_user')
                ->whereColumn('team_user.team_id', 'action_items.team_id')
                ->whereColumn('team_user.user_id', 'action_items.assignee_user_id'))
            ->whereHas('assigneeUser', fn (Builder $query) => $query->whereNotNull('email_verified_at'))
            ->with(['assigneeUser', 'team'])
            ->orderBy('due_on')
            ->orderBy('created_at')
            ->get();
    }

    private function kind(ActionItem $item, CarbonImmutable $today): ActionItemReminderKind
    {
        return (string) $item->due_on?->toDateString() < $today->toDateString()
            ? ActionItemReminderKind::Overdue
            : ActionItemReminderKind::DueSoon;
    }

    /**
     * Logged before anything is sent: a second run the same day finds the
     * row and skips the item, and a failed mail is never sent twice.
     */
    private function log(ActionItem $item, User $user, CarbonImmutable $today): bool
    {
        return ActionItemReminder::query()->createOrFirst(
            [
                'action_item_id' => $item->id,
                'user_id' => $user->id,
                'kind' => $this->kind($item, $today),
                'due_on' => $item->due_on?->toDateString(),
            ],
            ['sent_at' => now()],
        )->wasRecentlyCreated;
    }

    /**
     * @param  Collection<int, ActionItem>  $items
     */
    private function deliver(User $user, Collection $items, CarbonImmutable $today): void
    {
        if ($user->action_item_reminders_by_email) {
            $user->notify(new ActionItemReminderDigestNotification(
                $items->map(fn (ActionItem $item): array => [
                    'actionItemId' => $item->id,
                    'kind' => $this->kind($item, $today)->value,
                ])->values()->all(),
            ));
        }

        if (! $user->action_item_reminders_in_app) {
            return;
        }

        foreach ($items as $item) {
            $user->notify(new ActionItemReminderNotification(
                $item->id,
                $this->kind($item, $today),
                $item->team->workspace_id,
                (string) $item->due_on?->toDateString(),
            ));
        }
    }
}
