<?php

namespace App\Models;

use App\Exceptions\ModelInvariantViolation;
use App\Support\Database\NameKey;
use Database\Factories\SavedPokerDeckFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A saved custom deck, owned by a team or by a whole workspace. Games copy its cards and name, so editing or
 * deleting it never changes a game.
 *
 * @property string $id
 * @property string|null $team_id
 * @property string|null $workspace_id
 * @property string $name
 * @property string $name_key
 * @property array<int, string> $cards
 * @property string|null $created_by_user_id
 * @property-read Team|null $team
 * @property-read Workspace|null $workspace
 * @property-read User|null $creator
 * @property-read int|null $usage_count
 */
#[Fillable(['name', 'cards', 'created_by_user_id'])]
#[Table(name: 'poker_decks')]
class SavedPokerDeck extends Model
{
    /** @use HasFactory<SavedPokerDeckFactory> */
    use HasFactory;

    use HasUuids;

    /**
     * The rule of the model is checked here and not in a `saving` listener, which a faked or muted
     * event dispatcher skips. A stored row is checked when one of its owners changes: a model read
     * without them knows nothing about its state.
     *
     * The check reads the attributes the model holds: a row read with a partial select must have
     * loaded every column of a rule before one of them is written. A query builder or mass update
     * goes through no model and is not checked.
     *
     * @param  array<string, mixed>  $options
     */
    public function save(array $options = []): bool
    {
        $changesOwner = ! $this->exists || $this->isDirty(['team_id', 'workspace_id']);

        if ($changesOwner && ($this->team_id === null) === ($this->workspace_id === null)) {
            throw ModelInvariantViolation::because($this, 'a deck belongs to a team or to a workspace, never both or neither');
        }

        return parent::save($options);
    }

    /** @return BelongsTo<Team, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /** @return BelongsTo<Workspace, $this> */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    public function isWorkspaceDeck(): bool
    {
        return $this->workspace_id !== null;
    }

    /** @return HasMany<PokerGame, $this> */
    public function games(): HasMany
    {
        return $this->hasMany(PokerGame::class, 'saved_deck_id');
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    /**
     * The key always follows the name: no caller sets it.
     *
     * @return Attribute<string, string>
     */
    protected function name(): Attribute
    {
        return Attribute::make(
            set: fn (string $name): array => ['name' => $name, 'name_key' => NameKey::of($name)],
        );
    }

    protected function casts(): array
    {
        return [
            'cards' => 'array',
        ];
    }
}
