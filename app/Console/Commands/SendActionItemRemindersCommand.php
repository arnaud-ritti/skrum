<?php

namespace App\Console\Commands;

use App\Actions\ActionItems\PruneActionItemNotifications;
use App\Actions\ActionItems\SendActionItemReminders;
use App\Models\User;
use Illuminate\Console\Command;

class SendActionItemRemindersCommand extends Command
{
    protected $signature = 'action-items:send-reminders';

    protected $description = 'Send due-soon and overdue action item reminders, then prune old notifications';

    public function handle(SendActionItemReminders $sendActionItemReminders, PruneActionItemNotifications $pruneActionItemNotifications): int
    {
        if (! config('skrum.action_item_reminders.enabled')) {
            $this->comment('Action item reminders are turned off.');

            return self::SUCCESS;
        }

        $sent = $sendActionItemReminders->handle(function (User $user, int $count): void {
            $this->info("Reminding user `{$user->id}` about {$count} items…");
        });

        $pruned = $pruneActionItemNotifications->handle();

        $this->comment("Sent {$sent['reminders']} reminders to {$sent['users']} users.");
        $this->comment("Pruned {$pruned['notifications']} notifications and {$pruned['reminders']} reminder records.");

        return self::SUCCESS;
    }
}
