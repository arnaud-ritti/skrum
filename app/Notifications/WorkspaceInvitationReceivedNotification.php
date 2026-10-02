<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Crypt;
use SensitiveParameter;

/**
 * Tells an existing account, in the bell, that it was invited. It is a
 * link to the invitation page and accepts nothing; the link holds the
 * invitation token, so it is stored encrypted.
 */
class WorkspaceInvitationReceivedNotification extends Notification implements ShouldBeEncrypted, ShouldQueue
{
    use Queueable;

    public const string Kind = 'team_invite';

    public function __construct(
        public string $invitationId,
        #[SensitiveParameter] public string $link,
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
     *     link: string
     * }
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => self::Kind,
            'invitationId' => $this->invitationId,
            'link' => Crypt::encryptString($this->link),
        ];
    }
}
