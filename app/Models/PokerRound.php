<?php

namespace App\Models;

use App\Enums\PokerRevealReason;
use Database\Factories\PokerRoundFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $poker_task_id
 * @property int $number
 * @property Carbon|null $revealed_at
 * @property int $version
 * @property bool $anonymous
 * @property Carbon|null $timer_ends_at
 * @property PokerRevealReason|null $reveal_reason
 * @property Carbon|null $created_at
 * @property-read PokerTask $task
 */
#[Fillable(['number', 'revealed_at', 'version', 'anonymous', 'timer_ends_at', 'reveal_reason'])]
class PokerRound extends Model
{
    /** @use HasFactory<PokerRoundFactory> */
    use HasFactory;

    use HasUuids;

    /** @var list<string> */
    protected $touches = ['task'];

    /** @return BelongsTo<PokerTask, $this> */
    public function task(): BelongsTo
    {
        return $this->belongsTo(PokerTask::class, 'poker_task_id');
    }

    /** @return HasMany<PokerVote, $this> */
    public function votes(): HasMany
    {
        return $this->hasMany(PokerVote::class);
    }

    public function isRevealed(): bool
    {
        return $this->revealed_at !== null;
    }

    protected function casts(): array
    {
        return [
            'number' => 'integer',
            'version' => 'integer',
            'anonymous' => 'boolean',
            'revealed_at' => 'datetime',
            'timer_ends_at' => 'datetime',
            'reveal_reason' => PokerRevealReason::class,
        ];
    }
}
