<?php

namespace App\Models;

use Database\Factories\PokerTaskFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * The external_* columns are written only by the tracker imports of
 * spec 6, never from a request, so they are not fillable.
 *
 * @property string $id
 * @property string $poker_game_id
 * @property string $title
 * @property string|null $description
 * @property int $position
 * @property string|null $estimate
 * @property float|null $estimate_numeric
 * @property Carbon|null $estimated_at
 * @property string|null $external_source
 * @property string|null $external_id
 * @property string|null $external_url
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read PokerGame $game
 * @property-read PokerRound|null $latestRound
 */
#[Fillable(['title', 'description', 'position', 'estimate', 'estimate_numeric', 'estimated_at'])]
class PokerTask extends Model
{
    /** @use HasFactory<PokerTaskFactory> */
    use HasFactory;

    use HasUuids;

    /** @var list<string> */
    protected $touches = ['game'];

    /** @return BelongsTo<PokerGame, $this> */
    public function game(): BelongsTo
    {
        return $this->belongsTo(PokerGame::class, 'poker_game_id');
    }

    /** @return HasMany<PokerRound, $this> */
    public function rounds(): HasMany
    {
        return $this->hasMany(PokerRound::class)->orderBy('number');
    }

    /** @return HasOne<PokerRound, $this> */
    public function latestRound(): HasOne
    {
        return $this->hasOne(PokerRound::class)->orderByDesc('number');
    }

    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'estimate_numeric' => 'float',
            'estimated_at' => 'datetime',
        ];
    }
}
