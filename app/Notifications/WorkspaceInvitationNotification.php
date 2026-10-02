<?php

namespace App\Notifications;

use App\Mail\WorkspaceInvitationMail;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

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

    public function toMail(AnonymousNotifiable|User $notifiable): WorkspaceInvitationMail
    {
        return (new WorkspaceInvitationMail($this->workspaceName, $this->inviterName, $this->url, $this->expiresAt))
            ->subject(Str::squish(__('You are invited to join :workspace', ['workspace' => $this->workspaceName])))
            ->forNotifiable($notifiable);
    }
}
