<?php

namespace App\Support\Auth;

use App\Enums\SsoProvider;
use App\Models\User;
use Illuminate\Http\Request;

/**
 * Why a signed-in user went to a provider: to link it. Read once, by the
 * callback, which honours it only for the same user and the same provider.
 */
class SsoIntent
{
    public const string Key = 'sso.intent';

    public const string Link = 'link';

    public static function put(Request $request, User $user, SsoProvider $provider): void
    {
        $request->session()->put(self::Key, ['type' => self::Link, 'user' => $user->id, 'provider' => $provider->value]);
    }

    /**
     * @return array{
     *     type: string,
     *     user: string,
     *     provider: string
     * }|null
     */
    public static function pull(Request $request): ?array
    {
        $intent = $request->session()->pull(self::Key);

        if (! is_array($intent)) {
            return null;
        }

        $type = $intent['type'] ?? null;
        $user = $intent['user'] ?? null;
        $provider = $intent['provider'] ?? null;

        if (! is_string($type) || ! is_string($user) || ! is_string($provider)) {
            return null;
        }

        return ['type' => $type, 'user' => $user, 'provider' => $provider];
    }
}
