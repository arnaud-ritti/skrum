<?php

namespace App\Models;

use App\Enums\GameKind;
use App\Enums\GameRoundOutcome;
use Database\Factories\GameRoundFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $game_room_id
 * @property GameKind $game
 * @property string|null $leader_player_id
 * @property string|null $word
 * @property array<int, int> $revealed_positions
 * @property array<int, string> $picked_letters
 * @property array<int, string> $picked_by
 * @property int $misses
 * @property array<int, string> $clue
 * @property string|null $question
 * @property array<int, array<string, mixed>> $drawing
 * @property int $drawing_points
 * @property string|null $winner_player_id
 * @property Carbon|null $revealed_at
 * @property GameRoundOutcome|null $outcome
 * @property Carbon $started_at
 * @property Carbon|null $ended_at
 * @property int|null $number
 * @property int|null $rounds_total
 * @property array<int, string>|null $turn_order
 * @property string|null $turn_player_id
 * @property Carbon|null $turn_ends_at
 * @property int|null $turn_seconds
 * @property int|null $hint_seconds
 * @property int $votes_allowed
 * @property bool $authors_hidden
 * @property array<int, string>|null $statements
 * @property int|null $lie_index
 * @property int|null $guessers_total
 * @property int $word_changes
 * @property Carbon|null $created_at
 * @property-read GameRoom $room
 * @property-read GamePlayer|null $leader
 * @property-read GamePlayer|null $winner
 */
#[Fillable([
    'game_room_id', 'game', 'leader_player_id', 'word', 'revealed_positions', 'picked_letters', 'picked_by',
    'misses', 'clue', 'question', 'drawing', 'drawing_points', 'winner_player_id', 'revealed_at',
    'outcome', 'started_at', 'ended_at', 'number', 'rounds_total', 'turn_order', 'turn_player_id', 'turn_ends_at',
    'turn_seconds', 'hint_seconds', 'votes_allowed', 'authors_hidden', 'statements', 'lie_index', 'guessers_total',
    'word_changes',
])]
#[Hidden(['word', 'picked_by', 'lie_index'])]
class GameRound extends Model
{
    /** @use HasFactory<GameRoundFactory> */
    use HasFactory;

    use HasUuids;

    /** @var array<string, mixed> */
    protected $attributes = [
        'revealed_positions' => '[]',
        'picked_letters' => '[]',
        'picked_by' => '[]',
        'misses' => 0,
        'clue' => '[]',
        'drawing' => '[]',
        'drawing_points' => 0,
        'votes_allowed' => 1,
        'authors_hidden' => false,
        'word_changes' => 0,
    ];

    /** @return BelongsTo<GameRoom, $this> */
    public function room(): BelongsTo
    {
        return $this->belongsTo(GameRoom::class, 'game_room_id');
    }

    /** @return BelongsTo<GamePlayer, $this> */
    public function leader(): BelongsTo
    {
        return $this->belongsTo(GamePlayer::class, 'leader_player_id');
    }

    /** @return BelongsTo<GamePlayer, $this> */
    public function winner(): BelongsTo
    {
        return $this->belongsTo(GamePlayer::class, 'winner_player_id');
    }

    /** @return HasMany<GameGuess, $this> */
    public function guesses(): HasMany
    {
        return $this->hasMany(GameGuess::class);
    }

    /** @return HasMany<GameGifAnswer, $this> */
    public function gifAnswers(): HasMany
    {
        return $this->hasMany(GameGifAnswer::class);
    }

    /** @return HasMany<GameGifVote, $this> */
    public function gifVotes(): HasMany
    {
        return $this->hasMany(GameGifVote::class);
    }

    /** @return HasMany<GameChoice, $this> */
    public function choices(): HasMany
    {
        return $this->hasMany(GameChoice::class);
    }

    /** @return HasMany<GameTextAnswer, $this> */
    public function textAnswers(): HasMany
    {
        return $this->hasMany(GameTextAnswer::class);
    }

    /** Guess who?: the one answer the draw kept, or null before the draw. */
    public function drawnAnswer(): ?GameTextAnswer
    {
        return $this->textAnswers()->where('is_drawn', true)->first();
    }

    /** @return array<int, string> */
    public function turnOrder(): array
    {
        return array_values($this->turn_order ?? []);
    }

    public function takesTurns(): bool
    {
        return $this->turnOrder() !== [];
    }

    /** @return array<int, string> */
    public function statementsList(): array
    {
        return array_values($this->statements ?? []);
    }

    /** @return HasMany<GamePoint, $this> */
    public function points(): HasMany
    {
        return $this->hasMany(GamePoint::class);
    }

    /**
     * A Draw & Guess round started with its guessers goes on after the first
     * correct guess (spec §6.15); any other round ends there, as before.
     */
    public function keepsFinding(): bool
    {
        return $this->game === GameKind::DrawAndGuess && $this->guessers_total !== null;
    }

    public function hasFinders(): bool
    {
        return $this->guesses()->where('is_correct', true)->exists();
    }

    public function isActive(): bool
    {
        return $this->ended_at === null;
    }

    protected function casts(): array
    {
        return [
            'game' => GameKind::class,
            'outcome' => GameRoundOutcome::class,
            'revealed_positions' => 'array',
            'picked_letters' => 'array',
            'picked_by' => 'array',
            'clue' => 'array',
            'drawing' => 'array',
            'misses' => 'integer',
            'drawing_points' => 'integer',
            'revealed_at' => 'datetime',
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'number' => 'integer',
            'rounds_total' => 'integer',
            'turn_order' => 'array',
            'turn_ends_at' => 'datetime',
            'turn_seconds' => 'integer',
            'hint_seconds' => 'integer',
            'votes_allowed' => 'integer',
            'authors_hidden' => 'boolean',
            'statements' => 'array',
            'lie_index' => 'integer',
            'guessers_total' => 'integer',
            'word_changes' => 'integer',
        ];
    }
}
