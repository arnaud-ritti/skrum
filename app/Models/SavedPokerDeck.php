<?php

namespace App\Models;

use Database\Factories\SavedPokerDeckFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A team's saved custom deck. Games copy its cards and name, so editing or
 * deleting it never changes a game.
 *
 * @property string $id
 * @property string $team_id
 * @property string $name
 * @property array<int, string> $cards
 * @property string|null $created_by_user_id
 * @property-read Team $team
 * @property-read User|null $creator
 */
#[Fillable(['name', 'cards', 'created_by_user_id'])]
class SavedPokerDeck extends Model
{
    /** @use HasFactory<SavedPokerDeckFactory> */
    use HasFactory;

    use HasUuids;

    protected $table = 'poker_decks';

    /** @return BelongsTo<Team, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    protected function casts(): array
    {
        return [
            'cards' => 'array',
        ];
    }
}
