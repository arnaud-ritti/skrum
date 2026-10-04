<?php

namespace App\Actions\Workspaces;

use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Team;

class InvitationTerms
{
    public function __construct(
        public string $email,
        public WorkspaceRole $role,
        public ?Team $team = null,
        public ?TeamRole $teamRole = null,
        public ?string $message = null,
    ) {}

    public function cleanMessage(): ?string
    {
        $message = trim((string) $this->message);

        return $message === '' ? null : $message;
    }
}
