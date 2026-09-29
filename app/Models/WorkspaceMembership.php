<?php

namespace App\Models;

use App\Enums\WorkspaceRole;
use Illuminate\Database\Eloquent\Relations\Pivot;

/**
 * @property string $workspace_id
 * @property string $user_id
 * @property WorkspaceRole $role
 */
class WorkspaceMembership extends Pivot
{
    protected $table = 'workspace_user';

    protected function casts(): array
    {
        return [
            'role' => WorkspaceRole::class,
        ];
    }
}
