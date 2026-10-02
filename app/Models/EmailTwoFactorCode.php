<?php

namespace App\Models;

use App\Enums\EmailCodePurpose;
use Database\Factories\EmailTwoFactorCodeFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\MassPrunable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use SensitiveParameter;

/**
 * @property string $id
 * @property string $user_id
 * @property EmailCodePurpose $purpose
 * @property string $code_hash
 * @property int $attempts
 * @property Carbon $sent_at
 * @property Carbon $expires_at
 * @property Carbon|null $consumed_at
 */
class EmailTwoFactorCode extends Model
{
    /** @use HasFactory<EmailTwoFactorCodeFactory> */
    use HasFactory;

    use HasUuids;
    use MassPrunable;

    public const int LifetimeMinutes = 10;

    public const int MaxAttempts = 5;

    public $timestamps = false;

    /**
     * A code has a million values: a plain hash could be reversed from a
     * copy of the table, a keyed one cannot without the application key.
     */
    public static function hashCode(string $userId, EmailCodePurpose $purpose, #[SensitiveParameter] string $code): string
    {
        return hash_hmac('sha256', "{$userId}|{$purpose->value}|{$code}", (string) config('app.key'));
    }

    /** @return Builder<static> */
    public function prunable(): Builder
    {
        return static::query()->where('expires_at', '<', now()->subDay());
    }

    protected function casts(): array
    {
        return [
            'purpose' => EmailCodePurpose::class,
            'sent_at' => 'datetime',
            'expires_at' => 'datetime',
            'consumed_at' => 'datetime',
        ];
    }
}
