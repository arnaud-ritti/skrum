<?php

namespace App\Console\Commands;

use App\Actions\ActionItems\PruneActionItemNotifications;
use App\Actions\ActionItems\SendActionItemReminders;
use App\Models\User;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

#[Description('Send due-soon and overdue action item reminders, then prune old notifications')]
#[Signature('action-items:send-reminders')]
class SendActionItemRemindersCommand extends Command
{
    public function handle(SendActionItemReminders $sendActionItemReminders, PruneActionItemNotifications $pruneActionItemNotifications): int
    {
        if (! config('skrum.action_item_reminders.enabled')) {
            $this->comment('Action item reminders are turned off.');

            return self::SUCCESS;
        }

        $sent = $sendActionItemReminders->handle(function (User $user, int $count): void {
            $items = Str::plural('item', $count);

            $this->info("Reminding user `{$user->id}` about {$count} {$items}…");
        });

        $pruned = $pruneActionItemNotifications->handle();

        $reminders = Str::plural('reminder', $sent['reminders']);
        $users = Str::plural('user', $sent['users']);

        $this->comment("Sent {$sent['reminders']} {$reminders} to {$sent['users']} {$users}.");
        $this->comment("Pruned {$pruned['notifications']} notifications and {$pruned['reminders']} reminder records.");

        return self::SUCCESS;
    }
}
