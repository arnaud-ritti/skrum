<?php

namespace App\Models;

use App\Enums\TeamRole;
use Database\Factories\TeamInviteLinkFactory;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $team_id
 * @property string $token
 * @property string $token_hash
 * @property string|null $created_by_id
 * @property TeamRole $team_role
 * @property Carbon $expires_at
 * @property int $uses_count
 * @property Carbon|null $revoked_at
 * @property-read Team $team
 * @property-read User|null $createdBy
 */
#[Fillable(['token', 'token_hash', 'created_by_id', 'team_role', 'expires_at', 'uses_count', 'revoked_at'])]
#[Hidden(['token', 'token_hash'])]
class TeamInviteLink extends Model
{
    /** @use HasFactory<TeamInviteLinkFactory> */
    use HasFactory;

    use HasUuids;

    public const int ValidForDays = 7;

    public static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    public static function findByToken(?string $token): ?self
    {
        if ($token === null || $token === '') {
            return null;
        }

        return static::query()->where('token_hash', static::hashToken($token))->first();
    }

    /** @return BelongsTo<Team, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /** @return BelongsTo<User, $this> */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_id');
    }

    public function isUsable(): bool
    {
        if ($this->revoked_at !== null) {
            return false;
        }

        return $this->expires_at->isFuture();
    }

    /**
     * False once APP_KEY was rotated without keeping the previous key: the link can no longer be shown.
     */
    public function hasReadableToken(): bool
    {
        try {
            $this->getAttributeValue('token');
        } catch (DecryptException) {
            return false;
        }

        return true;
    }

    public function url(): string
    {
        return route('inviteLinks.show', $this->token);
    }

    protected function casts(): array
    {
        return [
            'token' => 'encrypted',
            'team_role' => TeamRole::class,
            'expires_at' => 'datetime',
            'revoked_at' => 'datetime',
            'uses_count' => 'integer',
        ];
    }
}
