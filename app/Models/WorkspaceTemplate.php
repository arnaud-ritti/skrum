<?php

namespace App\Models;

use App\Enums\TemplateCategory;
use Database\Factories\WorkspaceTemplateFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
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
 * @property TemplateCategory $category
 * @property string|null $created_by_user_id
 * @property-read Collection<int, WorkspaceTemplateColumn> $columns
 * @property-read User|null $creator
 * @property-read int|null $retros_count
 */
#[Fillable(['name', 'category', 'created_by_user_id'])]
class WorkspaceTemplate extends Model
{
    /** @use HasFactory<WorkspaceTemplateFactory> */
    use HasFactory;

    use HasUuids;

    public const KeyPrefix = 'workspace:';

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

    protected function casts(): array
    {
        return [
            'category' => TemplateCategory::class,
        ];
    }
}
