<?php

namespace App\Models;

use Database\Factories\GameGifVoteFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $game_round_id
 * @property string $voter_player_id
 * @property string $answer_id
 * @property-read GameRound $round
 * @property-read GamePlayer $voter
 * @property-read GameGifAnswer $answer
 */
#[Fillable(['game_round_id', 'voter_player_id', 'answer_id'])]
class GameGifVote extends Model
{
    /** @use HasFactory<GameGifVoteFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<GameRound, $this> */
    public function round(): BelongsTo
    {
        return $this->belongsTo(GameRound::class, 'game_round_id');
    }

    /** @return BelongsTo<GamePlayer, $this> */
    public function voter(): BelongsTo
    {
        return $this->belongsTo(GamePlayer::class, 'voter_player_id');
    }

    /** @return BelongsTo<GameGifAnswer, $this> */
    public function answer(): BelongsTo
    {
        return $this->belongsTo(GameGifAnswer::class, 'answer_id');
    }
}
