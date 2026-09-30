<?php

namespace App\Models;

use App\Enums\HealthStatement;
use Database\Factories\RetroHealthStatementFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $retro_id
 * @property string $key
 * @property string|null $team_health_statement_id
 * @property HealthStatement|null $builtin
 * @property string|null $text
 * @property string|null $label
 * @property int $position
 */
#[Fillable(['retro_id', 'key', 'team_health_statement_id', 'builtin', 'text', 'label', 'position'])]
class RetroHealthStatement extends Model
{
    /** @use HasFactory<RetroHealthStatementFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<Retro, $this> */
    public function retro(): BelongsTo
    {
        return $this->belongsTo(Retro::class);
    }

    protected function casts(): array
    {
        return [
            'builtin' => HealthStatement::class,
            'position' => 'integer',
        ];
    }
}
