<?php

namespace App\Models;

use App\Enums\IntegrationProvider;
use App\Enums\TeamRole;
use Database\Factories\TeamFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property string $id
 * @property string $workspace_id
 * @property string $name
 * @property string|null $default_poker_deck
 * @property string|null $default_saved_poker_deck_id
 * @property-read Workspace $workspace
 * @property-read string|null $last_retro_at
 * @property-read int|null $open_poker_games_count
 * @property-read int|null $open_action_items_count
 * @property-read int|null $overdue_action_items_count
 */
#[Fillable(['name', 'default_poker_deck', 'default_saved_poker_deck_id'])]
class Team extends Model
{
    /** @use HasFactory<TeamFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<Workspace, $this> */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    /** @return BelongsToMany<User, $this, TeamMembership, 'teamMembership'> */
    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class)
            ->using(TeamMembership::class)
            ->as('teamMembership')
            ->withPivot('role')
            ->withTimestamps();
    }

    public function roleOf(User $user): ?TeamRole
    {
        return TeamMembership::query()
            ->where('team_id', $this->id)
            ->where('user_id', $user->id)
            ->first()
            ?->role;
    }

    public function hasMember(User $user): bool
    {
        return $this->members()->whereKey($user->id)->exists();
    }

    /** @return HasMany<TeamAccessRequest, $this> */
    public function accessRequests(): HasMany
    {
        return $this->hasMany(TeamAccessRequest::class);
    }

    /** @return HasMany<ActionItem, $this> */
    public function actionItems(): HasMany
    {
        return $this->hasMany(ActionItem::class);
    }

    /** @return HasMany<Retro, $this> */
    public function retros(): HasMany
    {
        return $this->hasMany(Retro::class);
    }

    /** @return HasMany<PokerGame, $this> */
    public function pokerGames(): HasMany
    {
        return $this->hasMany(PokerGame::class);
    }

    /** @return HasMany<Whiteboard, $this> */
    public function whiteboards(): HasMany
    {
        return $this->hasMany(Whiteboard::class);
    }

    /** @return HasMany<TeamSurvey, $this> */
    public function teamSurveys(): HasMany
    {
        return $this->hasMany(TeamSurvey::class);
    }

    /** @return HasMany<SavedPokerDeck, $this> */
    public function pokerDecks(): HasMany
    {
        return $this->hasMany(SavedPokerDeck::class);
    }

    /**
     * The decks of the team plus the decks of its workspace.
     *
     * @return Builder<SavedPokerDeck>
     */
    public function availablePokerDecks(): Builder
    {
        return SavedPokerDeck::query()->where(function (Builder $query): void {
            $query->where('team_id', $this->id)->orWhere('workspace_id', $this->workspace_id);
        });
    }

    /** @return BelongsTo<SavedPokerDeck, $this> */
    public function defaultSavedPokerDeck(): BelongsTo
    {
        return $this->belongsTo(SavedPokerDeck::class, 'default_saved_poker_deck_id');
    }

    /** @return HasMany<GameRoom, $this> */
    public function gameRooms(): HasMany
    {
        return $this->hasMany(GameRoom::class);
    }

    /** @return HasMany<TeamIntegration, $this> */
    public function integrations(): HasMany
    {
        return $this->hasMany(TeamIntegration::class);
    }

    public function integration(IntegrationProvider $provider): ?TeamIntegration
    {
        return $this->integrations()->where('provider', $provider->value)->first();
    }

    /** @return HasMany<TeamHealthStatement, $this> */
    public function healthStatements(): HasMany
    {
        return $this->hasMany(TeamHealthStatement::class)->orderBy('position')->oldest();
    }
}
