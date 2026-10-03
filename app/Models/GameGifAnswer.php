<?php

namespace App\Models;

use Database\Factories\GameGifAnswerFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

/**
 * @property string $id
 * @property string $game_round_id
 * @property string $player_id
 * @property string $gif_id
 * @property string|null $caption
 * @property-read GameRound $round
 * @property-read GamePlayer $player
 */
#[Fillable(['game_round_id', 'player_id', 'gif_id', 'caption'])]
class GameGifAnswer extends Model
{
    /** @use HasFactory<GameGifAnswerFactory> */
    use HasFactory;

    use HasUuids;

    /**
     * Random rather than time-ordered ids: on anonymous retros an answer's id
     * is shown at the reveal, and it must not tell when the answer was posted,
     * which the "answered" broadcasts could tie to its author.
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

    /** @return HasMany<GameGifVote, $this> */
    public function votes(): HasMany
    {
        return $this->hasMany(GameGifVote::class, 'answer_id');
    }
}
