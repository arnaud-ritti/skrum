<?php

namespace App\Models;

use Database\Factories\MagicLinkFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\MassPrunable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $user_id
 * @property string $token_hash
 * @property Carbon $expires_at
 * @property Carbon|null $consumed_at
 * @property-read User $user
 */
class MagicLink extends Model
{
    /** @use HasFactory<MagicLinkFactory> */
    use HasFactory;

    use HasUuids;
    use MassPrunable;

    public const int LifetimeMinutes = 15;

    public $timestamps = false;

    public static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    public static function findUsable(string $token): ?self
    {
        return static::query()
            ->with('user')
            ->where('token_hash', static::hashToken($token))
            ->whereNull('consumed_at')
            ->where('expires_at', '>', now())
            ->first();
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return Builder<static> */
    public function prunable(): Builder
    {
        return static::query()->where('expires_at', '<', now()->subDay());
    }

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'consumed_at' => 'datetime',
        ];
    }
}
