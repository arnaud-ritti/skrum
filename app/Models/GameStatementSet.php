<?php

namespace App\Models;

use Database\Factories\GameStatementSetFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $game_room_id
 * @property string $player_id
 * @property array<int, string>|null $statements
 * @property int $lie_index
 * @property Carbon|null $played_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read GameRoom $room
 * @property-read GamePlayer $player
 */
#[Fillable(['game_room_id', 'player_id', 'statements', 'lie_index', 'played_at'])]
#[Hidden(['statements', 'lie_index'])]
class GameStatementSet extends Model
{
    /** @use HasFactory<GameStatementSetFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<GameRoom, $this> */
    public function room(): BelongsTo
    {
        return $this->belongsTo(GameRoom::class, 'game_room_id');
    }

    /** @return BelongsTo<GamePlayer, $this> */
    public function player(): BelongsTo
    {
        return $this->belongsTo(GamePlayer::class);
    }

    public function isReady(): bool
    {
        return ! $this->isPlayed();
    }

    public function isPlayed(): bool
    {
        return $this->played_at !== null;
    }

    /** @return array<int, string> */
    public function statementsList(): array
    {
        return array_values($this->statements ?? []);
    }

    protected function casts(): array
    {
        return [
            'statements' => 'array',
            'lie_index' => 'integer',
            'played_at' => 'datetime',
        ];
    }
}
