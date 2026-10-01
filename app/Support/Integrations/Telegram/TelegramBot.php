<?php

namespace App\Support\Integrations\Telegram;

use App\Exceptions\Integrations\IntegrationException;
use Illuminate\Support\Facades\Cache;

class TelegramBot
{
    public const ConflictKey = 'telegram:conflict';

    private const int UsernameTtlSeconds = 86400;

    private const int UnreachableTtlSeconds = 60;

    private const int ConflictTtlMinutes = 10;

    public function __construct(private TelegramClient $telegram) {}

    public function username(): ?string
    {
        $key = 'telegram:bot-username:'.hash('sha256', (string) config('services.telegram.bot_token'));
        $cached = Cache::get($key);

        if (is_string($cached)) {
            return $cached;
        }

        if ($cached === false) {
            return null;
        }

        try {
            $username = $this->telegram->getMe()['username'] ?? null;
        } catch (IntegrationException) {
            $username = null;
        }

        if (! is_string($username) || $username === '') {
            Cache::put($key, false, self::UnreachableTtlSeconds);

            return null;
        }

        Cache::put($key, $username, self::UsernameTtlSeconds);

        return $username;
    }

    public function markConflict(): void
    {
        Cache::put(self::ConflictKey, true, now()->addMinutes(self::ConflictTtlMinutes));
    }

    public function clearConflict(): void
    {
        Cache::forget(self::ConflictKey);
    }

    public function hasConflict(): bool
    {
        return Cache::has(self::ConflictKey);
    }
}
