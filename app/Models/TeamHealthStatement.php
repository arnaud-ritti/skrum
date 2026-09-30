<?php

namespace App\Models;

use App\Enums\HealthStatement;
use Database\Factories\TeamHealthStatementFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string|null $id
 * @property string $team_id
 * @property HealthStatement|null $builtin
 * @property string|null $text
 * @property string|null $label
 * @property int $position
 * @property Carbon|null $archived_at
 * @property Carbon|null $created_at
 */
#[Fillable(['team_id', 'builtin', 'text', 'label', 'position', 'archived_at'])]
class TeamHealthStatement extends Model
{
    /** @use HasFactory<TeamHealthStatementFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<Team, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function key(): string
    {
        return $this->builtin->value ?? (string) $this->id;
    }

    public function isBuiltin(): bool
    {
        return $this->builtin !== null;
    }

    public function isArchived(): bool
    {
        return $this->archived_at !== null;
    }

    protected function casts(): array
    {
        return [
            'builtin' => HealthStatement::class,
            'position' => 'integer',
            'archived_at' => 'datetime',
        ];
    }
}
