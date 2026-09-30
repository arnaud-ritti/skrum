<?php

namespace App\Notifications;

use App\Enums\ActionItemReminderKind;
use Illuminate\Notifications\Notification;

/**
 * Stores ids only; the bell loads the item live, with a permission check.
 */
class ActionItemReminderNotification extends Notification
{
    public function __construct(
        public string $actionItemId,
        public ActionItemReminderKind $kind,
        public string $workspaceId,
        public string $dueOn,
    ) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array{
     *     kind: string,
     *     actionItemId: string,
     *     workspaceId: string,
     *     dueOn: string
     * }
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => $this->kind->value,
            'actionItemId' => $this->actionItemId,
            'workspaceId' => $this->workspaceId,
            'dueOn' => $this->dueOn,
        ];
    }
}
