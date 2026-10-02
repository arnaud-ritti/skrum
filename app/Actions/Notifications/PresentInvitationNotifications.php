<?php

namespace App\Actions\Notifications;

use App\Models\User;
use App\Models\WorkspaceInvitation;
use App\Notifications\WorkspaceInvitationReceivedNotification;
use App\Support\Mail\MailBrand;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Crypt;

class PresentInvitationNotifications
{
    /**
     * The link is decrypted only here, for the account the notification
     * belongs to and while it still owns the invited address. An
     * invitation that is gone, expired or accepted, or a link that no
     * longer decrypts, is left out.
     *
     * @param  Collection<int, DatabaseNotification>  $notifications
     * @return array<string, array{
     *     actor: array{name: string, presence: int, avatarUrl: string}|null,
     *     team: string,
     *     href: string
     * }>
     */
    public function handle(User $user, Collection $notifications): array
    {
        $received = $notifications->filter(
            fn (DatabaseNotification $notification): bool => ($notification->data['kind'] ?? null) === WorkspaceInvitationReceivedNotification::Kind,
        );

        if ($received->isEmpty()) {
            return [];
        }

        $invitations = WorkspaceInvitation::query()
            ->with(['workspace', 'invitedBy'])
            ->whereKey($received->map(fn (DatabaseNotification $notification) => $notification->data['invitationId'] ?? null)->filter()->unique()->values())
            ->get()
            ->filter(fn (WorkspaceInvitation $invitation): bool => $invitation->isPending() && $invitation->matchesEmail($user->email))
            ->keyBy('id');

        $presented = [];

        foreach ($received as $notification) {
            $invitation = $invitations->get($notification->data['invitationId'] ?? '');
            $href = $this->link($notification->data['link'] ?? null);

            if ($invitation === null || $href === null) {
                continue;
            }

            $presented[$notification->id] = [
                'actor' => $this->actor($invitation->invitedBy),
                'team' => $invitation->workspace->name,
                'href' => $href,
            ];
        }

        return $presented;
    }

    private function link(mixed $encrypted): ?string
    {
        if (! is_string($encrypted)) {
            return null;
        }

        try {
            return Crypt::decryptString($encrypted);
        } catch (DecryptException) {
            return null;
        }
    }

    /**
     * @return array{name: string, presence: int, avatarUrl: string}|null
     */
    private function actor(?User $inviter): ?array
    {
        if ($inviter === null) {
            return null;
        }

        return [
            'name' => $inviter->name,
            'presence' => MailBrand::presence($inviter->avatarSeed()),
            'avatarUrl' => $inviter->avatarUrl(),
        ];
    }
}
