<?php

namespace App\Models;

use App\Enums\WorkspaceRole;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Relations\Pivot;

/**
 * @property string $workspace_id
 * @property string $user_id
 * @property WorkspaceRole $role
 */
#[Table(name: 'workspace_user')]
class WorkspaceMembership extends Pivot
{
    protected function casts(): array
    {
        return [
            'role' => WorkspaceRole::class,
        ];
    }
}
