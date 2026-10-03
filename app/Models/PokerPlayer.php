<?php

namespace App\Models;

use App\Concerns\HasGuestIdentity;
use Database\Factories\PokerPlayerFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $poker_game_id
 * @property string|null $user_id
 * @property string|null $guest_name
 * @property string|null $guest_secret_hash
 * @property bool $is_spectator
 * @property int|null $presence_color
 * @property Carbon|null $created_at
 * @property-read PokerGame $game
 * @property-read User|null $user
 */
#[Fillable(['poker_game_id', 'user_id', 'guest_name', 'guest_secret_hash', 'is_spectator', 'presence_color'])]
#[Hidden(['guest_secret_hash'])]
class PokerPlayer extends Model
{
    /** @use HasFactory<PokerPlayerFactory> */
    use HasFactory;

    use HasGuestIdentity;
    use HasUuids;

    public static function current(Request $request): self
    {
        $player = $request->attributes->get('pokerPlayer');

        abort_unless($player instanceof self, 403);

        return $player;
    }

    /** @return BelongsTo<PokerGame, $this> */
    public function game(): BelongsTo
    {
        return $this->belongsTo(PokerGame::class, 'poker_game_id');
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return HasMany<PokerVote, $this> */
    public function votes(): HasMany
    {
        return $this->hasMany(PokerVote::class);
    }

    protected function casts(): array
    {
        return [
            'is_spectator' => 'boolean',
            'presence_color' => 'integer',
        ];
    }
}
