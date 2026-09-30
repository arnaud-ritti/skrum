<?php

namespace App\Models;

use App\Concerns\HasGuestIdentity;
use Database\Factories\ParticipantFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\Request;

/**
 * @property string $id
 * @property string $retro_id
 * @property string|null $user_id
 * @property string|null $guest_name
 * @property string|null $guest_secret_hash
 * @property-read Retro $retro
 * @property-read User|null $user
 */
#[Fillable(['retro_id', 'user_id', 'guest_name', 'guest_secret_hash'])]
#[Hidden(['guest_secret_hash'])]
class Participant extends Model
{
    /** @use HasFactory<ParticipantFactory> */
    use HasFactory;

    use HasGuestIdentity;
    use HasUuids;

    public static function current(Request $request): self
    {
        $participant = $request->attributes->get('participant');

        abort_unless($participant instanceof self, 403);

        return $participant;
    }

    /** @return BelongsTo<Retro, $this> */
    public function retro(): BelongsTo
    {
        return $this->belongsTo(Retro::class);
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return HasMany<Card, $this> */
    public function cards(): HasMany
    {
        return $this->hasMany(Card::class);
    }

    /** @return HasMany<Vote, $this> */
    public function votes(): HasMany
    {
        return $this->hasMany(Vote::class);
    }
}
