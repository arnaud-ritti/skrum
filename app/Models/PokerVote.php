<?php

namespace App\Models;

use Database\Factories\PokerVoteFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Touches;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $poker_round_id
 * @property string $poker_player_id
 * @property string $value
 * @property-read PokerRound $round
 * @property-read PokerPlayer $player
 */
#[Fillable(['poker_round_id', 'poker_player_id', 'value'])]
#[Touches(['round'])]
class PokerVote extends Model
{
    /** @use HasFactory<PokerVoteFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<PokerRound, $this> */
    public function round(): BelongsTo
    {
        return $this->belongsTo(PokerRound::class, 'poker_round_id');
    }

    /** @return BelongsTo<PokerPlayer, $this> */
    public function player(): BelongsTo
    {
        return $this->belongsTo(PokerPlayer::class, 'poker_player_id');
    }
}
