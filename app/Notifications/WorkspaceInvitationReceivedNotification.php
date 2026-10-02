<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Crypt;
use SensitiveParameter;

/**
 * Tells an existing account, in the bell, that it was invited. It leads
 * to the invitation page and accepts nothing. Only the invitation token
 * is stored, encrypted: the link is built when the bell is read, so no
 * address made from the inviter's request is ever replayed.
 */
class WorkspaceInvitationReceivedNotification extends Notification implements ShouldBeEncrypted, ShouldQueue
{
    use Queueable;

    public const string Kind = 'team_invite';

    public function __construct(
        public string $invitationId,
        #[SensitiveParameter] public string $token,
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
     *     token: string
     * }
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => self::Kind,
            'invitationId' => $this->invitationId,
            'token' => Crypt::encryptString($this->token),
        ];
    }
}
