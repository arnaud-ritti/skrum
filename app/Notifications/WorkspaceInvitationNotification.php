<?php

namespace App\Notifications;

use App\Actions\Auth\SignupGate;
use App\Enums\SsoProvider;
use App\Mail\WorkspaceInvitationMail;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use App\Support\Auth\SignInPolicy;
use App\Support\Avatars\AvatarUrl;
use App\Support\Mail\MailBrand;
use App\Support\Teams\TeamMark;
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

    /**
     * The invitation is carried by its id: the counts of its workspace and
     * the inviter are read when the queued mail is written.
     */
    public function __construct(
        public string $workspaceName,
        public string $inviterName,
        public string $url,
        public CarbonInterface $expiresAt,
        public ?string $invitationId = null,
    ) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(AnonymousNotifiable|User $notifiable): WorkspaceInvitationMail
    {
        $invitation = $this->invitationId === null
            ? null
            : WorkspaceInvitation::query()->with(['workspace', 'invitedBy', 'team'])->find($this->invitationId);
        $workspaceName = Str::squish($this->workspaceName);
        $inviterName = Str::squish($this->inviterName);
        $team = $invitation?->team;
        $teamName = $team === null ? null : Str::squish($team->name);

        return new WorkspaceInvitationMail(
            $workspaceName,
            $inviterName,
            $this->url,
            resolve(AvatarUrl::class)->initials($inviterName),
            $invitation?->invitedBy?->presenceColor() ?? MailBrand::presence($inviterName),
            $invitation?->workspace->teams()->count(),
            $invitation?->workspace->members()->count(),
            SsoProvider::enabled() !== [],
            resolve(SignInPolicy::class)->allowsLocalCredentials() && resolve(SignupGate::class)->canShowRegistration($invitation),
            max(1, (int) ceil(now()->diffInDays($this->expiresAt, absolute: false))),
            $teamName,
            $teamName === null ? null : mb_strtoupper(mb_substr($teamName, 0, 1)),
            $team === null ? null : TeamMark::colorFor($team)->value,
            $team?->members()->count(),
            $invitation?->message,
        )
            ->subject($teamName === null
                ? __(':inviter invited you to join :workspace', ['inviter' => $inviterName, 'workspace' => $workspaceName])
                : __(':inviter invited you to join :team on :workspace', ['inviter' => $inviterName, 'team' => $teamName, 'workspace' => $workspaceName]))
            ->forNotifiable($notifiable);
    }
}
