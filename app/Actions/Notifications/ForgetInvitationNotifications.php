<?php

namespace App\Actions\Notifications;

use App\Models\User;
use App\Models\WorkspaceInvitation;
use App\Notifications\WorkspaceInvitationReceivedNotification;
use Illuminate\Notifications\DatabaseNotification;

/**
 * An invitation notification lives as long as its invitation can be
 * accepted by the account that holds it, and no longer.
 */
class ForgetInvitationNotifications
{
    /**
     * Called where an invitation ends: accepted, revoked or replaced.
     *
     * @param  array<int, string>  $invitationIds
     */
    public function handle(array $invitationIds): void
    {
        DatabaseNotification::query()
            ->where('type', WorkspaceInvitationReceivedNotification::class)
            ->whereIn('data->invitationId', $invitationIds)
            ->delete();
    }

    /**
     * Nothing tells the application that an invitation expired, or that
     * an account changed its address: the bell of a user is cleaned when
     * it is read or counted.
     */
    public function forUser(User $user): void
    {
        $received = $user->notifications()
            ->where('type', WorkspaceInvitationReceivedNotification::class)
            ->get();

        if ($received->isEmpty()) {
            return;
        }

        $pendingIds = WorkspaceInvitation::query()
            ->whereKey($received->pluck('data.invitationId')->filter()->unique())
            ->get()
            ->filter(fn (WorkspaceInvitation $invitation): bool => $invitation->isPending() && $invitation->matchesEmail($user->email))
            ->modelKeys();

        $dead = $received->reject(fn (DatabaseNotification $notification): bool => in_array($notification->data['invitationId'] ?? null, $pendingIds, true));

        if ($dead->isEmpty()) {
            return;
        }

        DatabaseNotification::query()->whereKey($dead->modelKeys())->delete();
    }
}
