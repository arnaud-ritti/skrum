<?php

namespace App\Models;

use App\Enums\GameKind;
use Database\Factories\GamePointFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $team_id
 * @property string $game_room_id
 * @property string|null $game_round_id
 * @property string $player_id
 * @property string|null $user_id
 * @property GameKind $game
 * @property int $points
 * @property bool $is_win
 * @property Carbon|null $created_at
 */
#[Fillable(['team_id', 'game_room_id', 'game_round_id', 'player_id', 'user_id', 'game', 'points', 'is_win'])]
class GamePoint extends Model
{
    /** @use HasFactory<GamePointFactory> */
    use HasFactory;

    use HasUuids;

    public const UPDATED_AT = null;

    /** @return BelongsTo<GameRoom, $this> */
    public function room(): BelongsTo
    {
        return $this->belongsTo(GameRoom::class, 'game_room_id');
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

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    protected function casts(): array
    {
        return [
            'game' => GameKind::class,
            'points' => 'integer',
            'is_win' => 'boolean',
        ];
    }
}
