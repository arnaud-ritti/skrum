<?php

namespace App\Models;

use App\Concerns\HasSearchColumns;
use App\Contracts\DeliverySubject;
use App\Enums\GameKind;
use App\Enums\GameRoomAccess;
use App\Events\Games\GameRoomChanged;
use Carbon\CarbonInterface;
use Database\Factories\GameRoomFactory;
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
 * @property string $team_id
 * @property string|null $retro_id
 * @property string|null $name
 * @property string|null $created_by_user_id
 * @property string|null $host_player_id
 * @property GameKind $game
 * @property string $locale
 * @property GameRoomAccess $access
 * @property bool $reactions_enabled
 * @property string $guest_token
 * @property Carbon|null $timer_ends_at
 * @property string|null $current_round_id
 * @property Carbon|null $scores_reset_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Team $team
 * @property-read Retro|null $retro
 * @property-read GameRound|null $currentRound
 */
#[Fillable([
    'team_id', 'retro_id', 'name', 'created_by_user_id', 'host_player_id', 'game', 'locale',
    'access', 'reactions_enabled', 'guest_token', 'timer_ends_at', 'current_round_id', 'scores_reset_at',
])]
#[Hidden(['guest_token'])]
class GameRoom extends Model implements DeliverySubject
{
    /** @use HasFactory<GameRoomFactory> */
    use HasFactory;

    use HasSearchColumns;
    use HasUuids;

    public const MaxRoomsPerTeam = 10;

    public const MaxOnlinePlayers = 12;

    public const KeptRounds = 20;

    /** @return BelongsTo<Team, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /** @return BelongsTo<Retro, $this> */
    public function retro(): BelongsTo
    {
        return $this->belongsTo(Retro::class);
    }

    /** @return BelongsTo<User, $this> */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    /** @return BelongsTo<GamePlayer, $this> */
    public function host(): BelongsTo
    {
        return $this->belongsTo(GamePlayer::class, 'host_player_id');
    }

    /** @return HasMany<GamePlayer, $this> */
    public function players(): HasMany
    {
        return $this->hasMany(GamePlayer::class)->oldest()->orderBy('id');
    }

    /** @return HasMany<GameRound, $this> */
    public function rounds(): HasMany
    {
        return $this->hasMany(GameRound::class);
    }

    /** @return BelongsTo<GameRound, $this> */
    public function currentRound(): BelongsTo
    {
        return $this->belongsTo(GameRound::class, 'current_round_id');
    }

    /** @return HasMany<GamePoint, $this> */
    public function points(): HasMany
    {
        return $this->hasMany(GamePoint::class);
    }

    public function isIcebreaker(): bool
    {
        return $this->retro_id !== null;
    }

    public function activeRound(): ?GameRound
    {
        $round = $this->currentRound;

        if ($round === null || ! $round->isActive()) {
            return null;
        }

        return $round;
    }

    /**
     * The icebreaker host is always the retro facilitator, so it follows a
     * facilitation transfer without any write here.
     */
    public function isHost(GamePlayer $player): bool
    {
        if ($this->isIcebreaker()) {
            return $player->participant_id !== null
                && $player->participant_id === $this->retro?->facilitator_participant_id;
        }

        return $this->host_player_id === $player->id;
    }

    public function isCreator(GamePlayer $player): bool
    {
        return $player->user_id !== null && $player->user_id === $this->created_by_user_id;
    }

    public function isManager(GamePlayer $player): bool
    {
        if ($this->isHost($player) || $this->isCreator($player)) {
            return true;
        }

        return $player->account()?->canManage($this->team->workspace) ?? false;
    }

    public function effectiveTimerEndsAt(): ?CarbonInterface
    {
        if ($this->isIcebreaker()) {
            return $this->retro?->timer_ends_at;
        }

        return $this->timer_ends_at;
    }

    public function broadcastChannel(): string
    {
        if ($this->retro_id !== null) {
            return "retro.{$this->retro_id}";
        }

        return "game.{$this->id}";
    }

    public function guestUrl(): string
    {
        return route('games.join.show', $this->guest_token);
    }

    public function deliveryTeam(): Team
    {
        return $this->team;
    }

    /**
     * A job has no socket id, so the sharer's own view refreshes too.
     */
    public function announceDeliveryChange(): void
    {
        (new GameRoomChanged($this))->sendToOthers();
    }

    protected static function booted(): void
    {
        static::deleting(function (GameRoom $room): void {
            IntegrationDelivery::query()->whereMorphedTo('subject', $room)->delete();
        });
    }

    /** @return array<string, string> */
    public function searchColumns(): array
    {
        return ['name' => 'name_search'];
    }

    protected function casts(): array
    {
        return [
            'game' => GameKind::class,
            'access' => GameRoomAccess::class,
            'reactions_enabled' => 'boolean',
            'timer_ends_at' => 'datetime',
            'scores_reset_at' => 'datetime',
        ];
    }
}
