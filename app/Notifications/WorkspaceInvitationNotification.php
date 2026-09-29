<?php

namespace App\Notifications;

use Carbon\CarbonInterface;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class WorkspaceInvitationNotification extends Notification implements ShouldBeEncrypted, ShouldQueue
{
    use Queueable;

    public function __construct(
        public string $workspaceName,
        public string $inviterName,
        public string $url,
        public CarbonInterface $expiresAt,
    ) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject(__('You are invited to join :workspace', ['workspace' => $this->workspaceName]))
            ->line(__(':inviter invited you to join the :workspace workspace.', [
                'inviter' => $this->inviterName,
                'workspace' => $this->workspaceName,
            ]))
            ->action(__('Accept invitation'), $this->url)
            ->line(__('This invitation expires on :date.', ['date' => $this->expiresAt->isoFormat('LL')]));
    }
}
