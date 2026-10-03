<?php

namespace App\Models;

use App\Enums\TemplateCategory;
use App\Enums\TemplateVisibility;
use App\Support\Database\NameKey;
use Database\Factories\WorkspaceTemplateFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * @property string $id
 * @property string $workspace_id
 * @property string $name
 * @property string $name_key
 * @property TemplateCategory $category
 * @property string|null $created_by_user_id
 * @property TemplateVisibility $visibility
 * @property string|null $team_id
 * @property-read Collection<int, WorkspaceTemplateColumn> $columns
 * @property-read User|null $creator
 * @property-read Team|null $team
 * @property-read Workspace $workspace
 * @property-read int|null $retros_count
 */
#[Fillable(['name', 'category', 'created_by_user_id', 'visibility', 'team_id'])]
class WorkspaceTemplate extends Model
{
    /** @use HasFactory<WorkspaceTemplateFactory> */
    use HasFactory;

    use HasUuids;

    public const KeyPrefix = 'workspace:';

    protected $attributes = ['visibility' => TemplateVisibility::Workspace->value];

    public static function idFromKey(string $key): ?string
    {
        if (! str_starts_with($key, self::KeyPrefix)) {
            return null;
        }

        $id = substr($key, strlen(self::KeyPrefix));

        return Str::isUuid($id) ? $id : null;
    }

    public function catalogueKey(): string
    {
        return self::KeyPrefix.$this->id;
    }

    /** @return BelongsTo<Workspace, $this> */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    /** @return BelongsTo<Team, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /**
     * What a person sees: the workspace's templates, those of the given team (or of every
     * team they can view), and their own personal ones; an admin also sees the personal
     * templates whose author's account is gone.
     *
     * @param  Builder<self>  $query
     */
    public function scopeVisibleTo(Builder $query, User $user, Workspace $workspace, ?Team $team = null): void
    {
        $teamIds = $team !== null ? [$team->id] : $workspace->teamsVisibleTo($user)->modelKeys();
        $managesWorkspace = $user->canManage($workspace);

        $query->where(function (Builder $visible) use ($user, $teamIds, $managesWorkspace): void {
            $visible->where('visibility', TemplateVisibility::Workspace->value)
                ->orWhere(fn (Builder $teamTemplates) => $teamTemplates->where('visibility', TemplateVisibility::Team->value)->whereIn('team_id', $teamIds))
                ->orWhere(fn (Builder $own) => $own->where('visibility', TemplateVisibility::Personal->value)->where('created_by_user_id', $user->id));

            if ($managesWorkspace) {
                $visible->orWhere(fn (Builder $orphans) => $orphans->where('visibility', TemplateVisibility::Personal->value)->whereNull('created_by_user_id'));
            }
        });
    }

    /** @return HasMany<Retro, $this> */
    public function retros(): HasMany
    {
        return $this->hasMany(Retro::class);
    }

    /** @return HasMany<WorkspaceTemplateColumn, $this> */
    public function columns(): HasMany
    {
        return $this->hasMany(WorkspaceTemplateColumn::class)->orderBy('position');
    }

    /**
     * @return array<int, array{
     *     title: string,
     *     description: ?string,
     *     color: string
     * }>
     */
    public function presentColumns(): array
    {
        return $this->columns->map(fn (WorkspaceTemplateColumn $column): array => [
            'title' => $column->title,
            'description' => $column->description,
            'color' => $column->color->value,
        ])->values()->all();
    }

    /**
     * The key always follows the name: no caller sets it.
     *
     * @return Attribute<string, string>
     */
    protected function name(): Attribute
    {
        return Attribute::make(
            set: fn (string $name): array => ['name' => $name, 'name_key' => NameKey::of($name)],
        );
    }

    protected function casts(): array
    {
        return [
            'category' => TemplateCategory::class,
            'visibility' => TemplateVisibility::class,
        ];
    }
}
