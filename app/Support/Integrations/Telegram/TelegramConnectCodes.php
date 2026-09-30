<?php

namespace App\Support\Integrations\Telegram;

use App\Models\Team;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * Single-use codes, stored hashed; issuing a new code for a team
 * invalidates the previous one.
 */
class TelegramConnectCodes
{
    public const Alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

    private const Length = 8;

    private const TtlMinutes = 15;

    /**
     * @return array{code: string, expiresAt: CarbonImmutable}
     */
    public function issue(Team $team, User $user): array
    {
        $previous = Cache::get($this->teamKey($team->id));

        if (is_string($previous)) {
            Cache::forget($this->codeKey($previous));
        }

        $code = '';

        for ($index = 0; $index < self::Length; $index++) {
            $code .= self::Alphabet[random_int(0, strlen(self::Alphabet) - 1)];
        }

        $hash = hash('sha256', $code);
        $expiresAt = CarbonImmutable::now()->addMinutes(self::TtlMinutes);

        Cache::put($this->codeKey($hash), ['teamId' => $team->id, 'userId' => $user->id], $expiresAt);
        Cache::put($this->teamKey($team->id), $hash, $expiresAt);

        return ['code' => $code, 'expiresAt' => $expiresAt];
    }

    /**
     * @return array{teamId: string, userId: string}|null
     */
    public function consume(string $code): ?array
    {
        $payload = Cache::pull($this->codeKey(hash('sha256', Str::upper(trim($code)))));

        if (! is_array($payload) || ! is_string($payload['teamId'] ?? null) || ! is_string($payload['userId'] ?? null)) {
            return null;
        }

        Cache::forget($this->teamKey($payload['teamId']));

        return ['teamId' => $payload['teamId'], 'userId' => $payload['userId']];
    }

    private function codeKey(string $hash): string
    {
        return "telegram-connect:{$hash}";
    }

    private function teamKey(string $teamId): string
    {
        return "telegram-connect-team:{$teamId}";
    }
}
