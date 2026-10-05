<?php

namespace App\Actions\Notifications;

use App\Models\User;
use App\Models\WorkspaceInvitation;
use App\Notifications\WorkspaceInvitationReceivedNotification;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Crypt;

class PresentInvitationNotifications
{
    public function __construct(private PresentActor $presentActor) {}

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
            ->with(['workspace', 'team', 'invitedBy'])
            ->whereKey($received->pluck('data.invitationId')->filter()->unique())
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
                'actor' => $this->presentActor->handle($invitation->invitedBy),
                'team' => $invitation->team->name ?? $invitation->workspace->name,
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
        $token = $this->decrypt($data['token'] ?? null);

        if ($token === null) {
            return null;
        }

        if (! hash_equals($invitation->token_hash, WorkspaceInvitation::hashToken($token))) {
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
}
