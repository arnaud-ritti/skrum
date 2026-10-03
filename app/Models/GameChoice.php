<?php

namespace App\Models;

use Database\Factories\GameChoiceFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $game_round_id
 * @property string $player_id
 * @property string $choice
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read GameRound $round
 * @property-read GamePlayer $player
 */
#[Fillable(['game_round_id', 'player_id', 'choice'])]
class GameChoice extends Model
{
    /** @use HasFactory<GameChoiceFactory> */
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
}
