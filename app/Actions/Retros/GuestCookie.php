<?php

namespace App\Actions\Retros;

use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Cookie;

class GuestCookie
{
    public const RetroScope = 'retro';

    public const PokerScope = 'poker';

    public const GameScope = 'game';

    public const WhiteboardScope = 'whiteboard';

    public const SurveyScope = 'survey';

    private const LifetimeMinutes = 60 * 24 * 30;

    /** @return non-empty-string */
    public static function name(string $scope, string $scopeId): string
    {
        return "{$scope}_guest_{$scopeId}";
    }

    public static function make(string $scope, string $scopeId, string $playerId, string $secret): Cookie
    {
        return cookie(self::name($scope, $scopeId), "{$playerId}|{$secret}", self::LifetimeMinutes);
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
