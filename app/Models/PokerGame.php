<?php

namespace App\Models;

use App\Contracts\DeliverySubject;
use App\Enums\PokerDeck;
use App\Events\Poker\PokerGameChanged;
use Database\Factories\PokerGameFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $team_id
 * @property string $title
 * @property PokerDeck $deck
 * @property array<int, string> $cards
 * @property string|null $deck_name
 * @property string|null $facilitator_player_id
 * @property string|null $current_task_id
 * @property bool $guest_access_enabled
 * @property string $guest_token
 * @property Carbon|null $ended_at
 * @property bool $auto_reveal
 * @property bool $anonymous_votes
 * @property bool $cursors_enabled
 * @property bool $reactions_enabled
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Team $team
 * @property-read PokerTask|null $currentTask
 */
#[Fillable([
    'title', 'deck', 'cards', 'deck_name', 'facilitator_player_id', 'current_task_id',
    'guest_access_enabled', 'guest_token', 'ended_at',
    'auto_reveal', 'anonymous_votes', 'cursors_enabled', 'reactions_enabled',
])]
#[Hidden(['guest_token'])]
class PokerGame extends Model implements DeliverySubject
{
    /** @use HasFactory<PokerGameFactory> */
    use HasFactory;

    use HasUuids;

    protected static function booted(): void
    {
        static::deleting(function (PokerGame $game): void {
            IntegrationDelivery::query()->whereMorphedTo('subject', $game)->delete();
        });
    }

    /** @return BelongsTo<Team, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /** @return HasMany<PokerPlayer, $this> */
    public function players(): HasMany
    {
        return $this->hasMany(PokerPlayer::class)->orderBy('created_at')->orderBy('id');
    }

    /** @return HasMany<PokerTask, $this> */
    public function tasks(): HasMany
    {
        return $this->hasMany(PokerTask::class)->orderBy('position');
    }

    /** @return HasManyThrough<PokerRound, PokerTask, $this> */
    public function rounds(): HasManyThrough
    {
        return $this->hasManyThrough(PokerRound::class, PokerTask::class);
    }

    /** @return BelongsTo<PokerPlayer, $this> */
    public function facilitator(): BelongsTo
    {
        return $this->belongsTo(PokerPlayer::class, 'facilitator_player_id');
    }

    /** @return BelongsTo<PokerTask, $this> */
    public function currentTask(): BelongsTo
    {
        return $this->belongsTo(PokerTask::class, 'current_task_id');
    }

    public function isEnded(): bool
    {
        return $this->ended_at !== null;
    }

    public function isFacilitator(PokerPlayer $player): bool
    {
        return $this->facilitator_player_id === $player->id;
    }

    public function deliveryTeam(): Team
    {
        return $this->team;
    }

    public function announceDeliveryChange(): void
    {
        (new PokerGameChanged($this->id))->sendToOthers();
    }

    public function isNumeric(): bool
    {
        return PokerDeck::isNumericDeck($this->cards);
    }

    public function deckLabel(): string
    {
        return $this->deck_name ?? $this->deck->label();
    }

    public function hasVotes(): bool
    {
        return PokerVote::query()
            ->whereIn('poker_round_id', PokerRound::query()
                ->select('poker_rounds.id')
                ->whereIn('poker_task_id', PokerTask::query()->select('id')->where('poker_game_id', $this->id)))
            ->exists();
    }

    public function latestRoundOfCurrentTask(): ?PokerRound
    {
        if ($this->current_task_id === null) {
            return null;
        }

        return $this->currentTask?->latestRound;
    }

    protected function casts(): array
    {
        return [
            'deck' => PokerDeck::class,
            'cards' => 'array',
            'guest_access_enabled' => 'boolean',
            'auto_reveal' => 'boolean',
            'anonymous_votes' => 'boolean',
            'cursors_enabled' => 'boolean',
            'reactions_enabled' => 'boolean',
            'ended_at' => 'datetime',
        ];
    }
}
