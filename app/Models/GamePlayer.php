<?php

namespace App\Models;

use App\Concerns\HasGuestIdentity;
use Database\Factories\GamePlayerFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

/**
 * A player of one room: a team member, a guest of a link room, or — in an
 * icebreaker room — a retro participant, whose identity it borrows.
 *
 * @property string $id
 * @property string $game_room_id
 * @property string|null $user_id
 * @property string|null $participant_id
 * @property string|null $guest_name
 * @property string|null $guest_secret_hash
 * @property Carbon|null $created_at
 * @property-read GameRoom $room
 * @property-read User|null $user
 * @property-read Participant|null $participant
 */
#[Fillable(['game_room_id', 'user_id', 'participant_id', 'guest_name', 'guest_secret_hash'])]
#[Hidden(['guest_secret_hash'])]
class GamePlayer extends Model
{
    /** @use HasFactory<GamePlayerFactory> */
    use HasFactory;

    use HasGuestIdentity {
        isGuest as private identityIsGuest;
        displayName as private identityDisplayName;
        avatarSeed as private identityAvatarSeed;
        avatarOwner as private identityAvatarOwner;
    }
    use HasUuids;

    public static function current(Request $request): self
    {
        $player = $request->attributes->get('gamePlayer');

        abort_unless($player instanceof self, 403);

        return $player;
    }

    /** @return BelongsTo<GameRoom, $this> */
    public function room(): BelongsTo
    {
        return $this->belongsTo(GameRoom::class, 'game_room_id');
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Participant, $this> */
    public function participant(): BelongsTo
    {
        return $this->belongsTo(Participant::class);
    }

    public function isGuest(): bool
    {
        if ($this->participant_id !== null && $this->participant !== null) {
            return $this->participant->isGuest();
        }

        return $this->identityIsGuest();
    }

    public function displayName(): string
    {
        if ($this->participant_id !== null && $this->participant !== null) {
            return $this->participant->displayName();
        }

        return $this->identityDisplayName();
    }

    public function avatarSeed(): string
    {
        if ($this->participant_id !== null && $this->participant !== null) {
            return $this->participant->avatarSeed();
        }

        return $this->identityAvatarSeed();
    }

    public function avatarOwner(): ?User
    {
        if ($this->participant_id !== null && $this->participant !== null) {
            return $this->participant->avatarOwner();
        }

        return $this->identityAvatarOwner();
    }

    /**
     * Reverb stamps whispers with this id: icebreaker players share the
     * retro presence channel, where members are participants.
     */
    public function presenceId(): string
    {
        return $this->participant_id ?? $this->id;
    }

    public function accountUserId(): ?string
    {
        if ($this->participant_id !== null) {
            return $this->participant?->user_id;
        }

        return $this->user_id;
    }

    public function account(): ?User
    {
        if ($this->participant_id !== null) {
            return $this->participant?->user;
        }

        return $this->user;
    }
}
