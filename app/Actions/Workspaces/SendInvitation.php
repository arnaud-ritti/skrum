<?php

namespace App\Actions\Workspaces;

use App\Models\User;
use App\Models\Workspace;
use App\Notifications\WorkspaceInvitationNotification;
use App\Notifications\WorkspaceInvitationReceivedNotification;
use Illuminate\Support\Facades\Notification;

class SendInvitation
{
    public function __construct(private CreateWorkspaceInvitation $createInvitation) {}

    public function handle(Workspace $workspace, User $inviter, InvitationTerms $terms): IssuedInvitation
    {
        $issued = $this->createInvitation->handle($workspace, $inviter, $terms);
        $account = $this->soleVerifiedAccount($issued->invitation->email);

        Notification::route('mail', $issued->invitation->email)->notify(
            new WorkspaceInvitationNotification($workspace->name, $inviter->name, $issued->url(), $issued->invitation->expires_at, $issued->invitation->id)
                ->locale($account->locale ?? $workspace->locale ?? app()->getLocale()),
        );

        $account?->notify(new WorkspaceInvitationReceivedNotification($issued->invitation->id, $issued->token));

        return $issued;
    }

    /**
     * The one verified account that owns the invited address: its bell is told of the invitation
     * and the mail is written in its language. With none, or with two accounts sharing the address,
     * the mail is in the workspace's language, and the inviter's answer is the same either way.
     */
    private function soleVerifiedAccount(string $email): ?User
    {
        $accounts = User::query()
            ->whereAddress($email)
            ->whereNotNull('email_verified_at')
            ->limit(2)
            ->get();

        return $accounts->count() === 1 ? $accounts->sole() : null;
    }
}
