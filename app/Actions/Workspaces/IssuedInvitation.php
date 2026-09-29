<?php

namespace App\Actions\Workspaces;

use App\Models\WorkspaceInvitation;

class IssuedInvitation
{
    public function __construct(
        public WorkspaceInvitation $invitation,
        public string $token,
    ) {}
}
