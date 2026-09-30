<?php

namespace App\Models;

use Database\Factories\GameGifAnswerFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property string $id
 * @property string $game_round_id
 * @property string $player_id
 * @property string $gif_id
 * @property-read GameRound $round
 * @property-read GamePlayer $player
 */
#[Fillable(['game_round_id', 'player_id', 'gif_id'])]
class GameGifAnswer extends Model
{
    /** @use HasFactory<GameGifAnswerFactory> */
    use HasFactory;

    use HasUuids;

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
