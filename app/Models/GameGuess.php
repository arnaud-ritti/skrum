<?php

namespace App\Models;

use Database\Factories\GameGuessFactory;
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
 * @property string $text
 * @property bool $is_near_miss
 * @property bool $is_correct
 * @property Carbon|null $created_at
 * @property-read GameRound $round
 * @property-read GamePlayer $player
 */
#[Fillable(['game_round_id', 'player_id', 'text', 'is_near_miss', 'is_correct'])]
class GameGuess extends Model
{
    /** @use HasFactory<GameGuessFactory> */
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

    protected function casts(): array
    {
        return [
            'is_near_miss' => 'boolean',
            'is_correct' => 'boolean',
        ];
    }
}
