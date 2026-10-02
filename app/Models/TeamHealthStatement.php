<?php

namespace App\Models;

use App\Enums\HealthStatement;
use App\Exceptions\ModelInvariantViolation;
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

    /**
     * The rule of the model is checked here and not in a `saving` listener, which a faked or muted
     * event dispatcher skips. A stored row is checked when one of the three columns changes: a model
     * read without them knows nothing about its state.
     *
     * The check reads the attributes the model holds: a row read with a partial select must have
     * loaded every column of a rule before one of them is written. A query builder or mass update
     * goes through no model and is not checked.
     *
     * @param  array<string, mixed>  $options
     */
    public function save(array $options = []): bool
    {
        if (! $this->exists || $this->isDirty(['builtin', 'text', 'label'])) {
            $this->refuseBrokenRule();
        }

        return parent::save($options);
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

    private function refuseBrokenRule(): void
    {
        $isBuiltin = $this->builtin !== null && $this->text === null && $this->label === null;
        $isCustom = $this->builtin === null && $this->text !== null && $this->label !== null;

        if ($isBuiltin) {
            return;
        }

        if ($isCustom) {
            return;
        }

        throw ModelInvariantViolation::because($this, 'a statement is built-in without text and label, or custom with both');
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
