<?php

namespace App\Actions\Workspaces;

use App\Models\WorkspaceInvitation;

class IssuedInvitation
{
    public function __construct(
        public WorkspaceInvitation $invitation,
        public string $token,
    ) {}

    public function url(): string
    {
        return route('invitations.show', $this->token);
    }
}
