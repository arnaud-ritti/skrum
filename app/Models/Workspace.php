<?php

namespace App\Models;

use App\Enums\WorkspaceRole;
use Database\Factories\WorkspaceFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $name
 * @property string $slug
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'slug'])]
class Workspace extends Model
{
    /** @use HasFactory<WorkspaceFactory> */
    use HasFactory;

    use HasUuids;

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /** @return BelongsToMany<User, $this, WorkspaceMembership, 'membership'> */
    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'workspace_user', 'workspace_id', 'user_id')
            ->using(WorkspaceMembership::class)
            ->as('membership')
            ->withPivot('role')
            ->withTimestamps();
    }

    /** @return BelongsToMany<User, $this, WorkspaceMembership, 'membership'> */
    public function owners(): BelongsToMany
    {
        return $this->members()->wherePivot('role', WorkspaceRole::Owner->value);
    }

    /** @return HasMany<WorkspaceInvitation, $this> */
    public function invitations(): HasMany
    {
        return $this->hasMany(WorkspaceInvitation::class);
    }

    /** @return HasMany<Team, $this> */
    public function teams(): HasMany
    {
        return $this->hasMany(Team::class);
    }

    /** @return Collection<int, Team> */
    public function teamsVisibleTo(User $user): Collection
    {
        $teams = $this->teams()->orderBy('name');

        if (! $user->canManage($this)) {
            $teams->whereHas('members', fn (Builder $query) => $query->whereKey($user->id));
        }

        return $teams->get();
    }
}
