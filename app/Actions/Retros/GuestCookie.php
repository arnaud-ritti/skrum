<?php

namespace App\Actions\Retros;

use App\Models\Participant;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Cookie;

class GuestCookie
{
    private const LifetimeMinutes = 60 * 24 * 30;

    /** @return non-empty-string */
    public static function name(string $retroId): string
    {
        return "retro_guest_{$retroId}";
    }

    public static function make(Participant $participant, string $secret): Cookie
    {
        return cookie(self::name($participant->retro_id), "{$participant->id}|{$secret}", self::LifetimeMinutes);
    }

    /**
     * @return array{0: string, 1: string}|null
     */
    public static function parse(mixed $value): ?array
    {
        if (! is_string($value)) {
            return null;
        }

        $parts = explode('|', $value, 2);

        if (count($parts) !== 2) {
            return null;
        }

        if (! Str::isUuid($parts[0])) {
            return null;
        }

        if ($parts[1] === '') {
            return null;
        }

        return [$parts[0], $parts[1]];
    }
}
