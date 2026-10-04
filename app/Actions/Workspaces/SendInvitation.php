<?php

namespace App\Actions\Workspaces;

use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use App\Notifications\WorkspaceInvitationNotification;
use App\Notifications\WorkspaceInvitationReceivedNotification;
use Illuminate\Support\Facades\Notification;
use SensitiveParameter;

class SendInvitation
{
    public function __construct(private CreateWorkspaceInvitation $createInvitation) {}

    public function handle(Workspace $workspace, User $inviter, InvitationTerms $terms): IssuedInvitation
    {
        $issued = $this->createInvitation->handle($workspace, $inviter, $terms);

        $recipientLocale = User::query()
            ->whereAddress($terms->email)
            ->value('locale');

        Notification::route('mail', $issued->invitation->email)->notify(
            new WorkspaceInvitationNotification($workspace->name, $inviter->name, $issued->url(), $issued->invitation->expires_at, $issued->invitation->id)
                ->locale($recipientLocale ?? $workspace->locale ?? app()->getLocale()),
        );

        $this->notifyExistingAccount($issued->invitation, $issued->token);

        return $issued;
    }

    /**
     * The bell of the one verified account that owns the invited address
     * is told of the invitation. The inviter's answer is the same whether
     * or not such an account exists.
     */
    private function notifyExistingAccount(WorkspaceInvitation $invitation, #[SensitiveParameter] string $token): void
    {
        $accounts = User::query()
            ->whereAddress($invitation->email)
            ->whereNotNull('email_verified_at')
            ->limit(2)
            ->get();

        if ($accounts->count() !== 1) {
            return;
        }

        $accounts->sole()->notify(new WorkspaceInvitationReceivedNotification($invitation->id, $token));
    }
}
