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
use Illuminate\Support\Str;

class PresentInvitationNotifications
{
    /**
     * The token is decrypted only here, for the account the notification
     * belongs to and while it still owns the invited address, and the link
     * is built from it on the spot. An invitation that is gone, expired or
     * accepted, or a token that is not the one of the invitation, is left
     * out.
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

            if ($invitation === null) {
                continue;
            }

            $token = $this->token($notification->data, $invitation);

            if ($token === null) {
                continue;
            }

            $presented[$notification->id] = [
                'actor' => $this->actor($invitation->invitedBy),
                'team' => $invitation->workspace->name,
                'href' => route('invitations.show', $token),
            ];
        }

        return $presented;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function token(array $data, WorkspaceInvitation $invitation): ?string
    {
        $token = $this->decrypt($data['token'] ?? null) ?? $this->tokenOfStoredLink($this->decrypt($data['link'] ?? null));

        if ($token === null) {
            return null;
        }

        if (! hash_equals($invitation->token_hash, WorkspaceInvitation::hashToken($token))) {
            return null;
        }

        return $token;
    }

    /**
     * Earlier versions stored the whole link, built from the inviter's
     * request. Its token is read only when the link is the invitation
     * page of this application; a link to anywhere else gives nothing.
     */
    private function tokenOfStoredLink(?string $link): ?string
    {
        if ($link === null) {
            return null;
        }

        $placeholder = 'invitation-token';
        $invitationPage = Str::before(route('invitations.show', $placeholder), $placeholder);

        if (! str_starts_with($link, $invitationPage)) {
            return null;
        }

        $token = Str::after($link, $invitationPage);

        if ($token === '' || preg_match('/^[A-Za-z0-9_-]+$/', $token) !== 1) {
            return null;
        }

        return $token;
    }

    private function decrypt(mixed $encrypted): ?string
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
