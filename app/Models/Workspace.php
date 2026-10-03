<?php

namespace App\Models;

use App\Enums\WorkspaceRole;
use App\Support\Alphabetical;
use Database\Factories\WorkspaceFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\RouteKey;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $name
 * @property string $slug
 * @property string|null $description
 * @property string|null $locale
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read int|null $member_teams_count
 */
#[Fillable(['name', 'slug', 'description', 'locale'])]
#[RouteKey('slug')]
class Workspace extends Model
{
    /** @use HasFactory<WorkspaceFactory> */
    use HasFactory;

    use HasUuids;

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

    /** @return BelongsToMany<User, $this, WorkspaceMembership, 'membership'> */
    public function managers(): BelongsToMany
    {
        return $this->members()->wherePivotIn('role', [WorkspaceRole::Owner->value, WorkspaceRole::Admin->value]);
    }

    /** @return HasMany<WorkspaceInvitation, $this> */
    public function invitations(): HasMany
    {
        return $this->hasMany(WorkspaceInvitation::class);
    }

    /** @return HasMany<WorkspaceTemplate, $this> */
    public function templates(): HasMany
    {
        return $this->hasMany(WorkspaceTemplate::class);
    }

    /** @return HasMany<SavedPokerDeck, $this> */
    public function pokerDecks(): HasMany
    {
        return $this->hasMany(SavedPokerDeck::class);
    }

    /** @return HasMany<WhiteboardTemplate, $this> */
    public function whiteboardTemplates(): HasMany
    {
        return $this->hasMany(WhiteboardTemplate::class);
    }

    /** @return HasMany<Team, $this> */
    public function teams(): HasMany
    {
        return $this->hasMany(Team::class);
    }

    /** @return HasManyThrough<ActionItem, Team, $this> */
    public function actionItems(): HasManyThrough
    {
        return $this->hasManyThrough(ActionItem::class, Team::class);
    }

    /** @return Collection<int, Team> */
    public function teamsVisibleTo(User $user): Collection
    {
        $teams = $this->teams()->orderBy('id');

        if (! $user->canManage($this)) {
            $teams->whereHas('members', fn (Builder $query) => $query->whereKey($user->id));
        }

        return Alphabetical::sort($teams->get(), fn (Team $team): string => $team->name);
    }
}
