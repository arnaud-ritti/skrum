<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/**
 * Tells the inviter, in the bell only, that an invitation was declined.
 * The team and the workspace are read live when the bell is.
 */
class InvitationDeclinedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public const string Kind = 'invitation_declined';

    public function __construct(
        public string $invitationId,
        public string $email,
        public string $workspaceId,
        public ?string $teamId,
    ) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array{
     *     kind: string,
     *     invitationId: string,
     *     email: string,
     *     workspaceId: string,
     *     teamId: ?string
     * }
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => self::Kind,
            'invitationId' => $this->invitationId,
            'email' => $this->email,
            'workspaceId' => $this->workspaceId,
            'teamId' => $this->teamId,
        ];
    }
}
