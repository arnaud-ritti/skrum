<?php

namespace App\Actions\Retros;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Http\Request;
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

    /**
     * The guest whose cookie the request carries, when its secret matches.
     *
     * @template TGuest of Model
     * @template TOwner of Model
     *
     * @param  HasMany<TGuest, TOwner>  $guests
     * @return TGuest|null
     */
    public static function findGuest(HasMany $guests, Request $request, string $scope, string $scopeId): ?Model
    {
        $credentials = self::parse($request->cookie(self::name($scope, $scopeId)));

        if ($credentials === null) {
            return null;
        }

        [$guestId, $secret] = $credentials;

        $guest = $guests->getQuery()->whereKey($guestId)->whereNull('user_id')->whereNotNull('guest_secret_hash')->first();

        if ($guest === null) {
            return null;
        }

        return hash_equals((string) $guest->getAttribute('guest_secret_hash'), hash('sha256', $secret)) ? $guest : null;
    }
}
