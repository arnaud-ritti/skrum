<?php

namespace App\Models;

use Database\Factories\GameTextAnswerFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * @property string $id
 * @property string $game_round_id
 * @property string $player_id
 * @property string $text
 * @property bool $is_drawn
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read GameRound $round
 * @property-read GamePlayer $player
 */
#[Fillable(['game_round_id', 'player_id', 'text'])]
class GameTextAnswer extends Model
{
    /** @use HasFactory<GameTextAnswerFactory> */
    use HasFactory;

    use HasUuids;

    /** @var array<string, mixed> */
    protected $attributes = [
        'is_drawn' => false,
    ];

    /**
     * Random rather than time-ordered ids: answers are shown without author
     * at the reveal, and an id must not tell when, hence by whom, it was sent.
     */
    public function newUniqueId(): string
    {
        return (string) Str::uuid();
    }

    /** @return BelongsTo<GameRound, $this> */
    public function round(): BelongsTo
    {
        return $this->belongsTo(GameRound::class, 'game_round_id');
    }

    /** @return BelongsTo<GamePlayer, $this> */
    public function player(): BelongsTo
    {
        return $this->belongsTo(GamePlayer::class);
    }

    protected function casts(): array
    {
        return [
            'is_drawn' => 'boolean',
        ];
    }
}
