<?php

namespace App\Support\Integrations;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Models\Team;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class OAuthState
{
    public const SessionKey = 'integrations.oauth';

    private const TtlMinutes = 10;

    private const Length = 40;

    public function issue(Request $request, IntegrationProvider $provider, Team $team, IntegrationAccess $access): string
    {
        $state = Str::random(self::Length);

        $request->session()->put(self::SessionKey, [
            'state' => $state,
            'provider' => $provider->value,
            'teamId' => $team->id,
            'access' => $access->value,
            'expiresAt' => now()->addMinutes(self::TtlMinutes)->getTimestamp(),
        ]);

        return $state;
    }

    /**
     * @return array{teamId: string, access: IntegrationAccess}|null
     */
    public function consume(Request $request, IntegrationProvider $provider, mixed $state): ?array
    {
        $stored = $request->session()->pull(self::SessionKey);

        if (! is_array($stored) || ! is_string($state) || ! is_string($stored['state'] ?? null)) {
            return null;
        }

        if (! hash_equals($stored['state'], $state)) {
            return null;
        }

        if (($stored['provider'] ?? null) !== $provider->value) {
            return null;
        }

        if ((int) ($stored['expiresAt'] ?? 0) < now()->getTimestamp()) {
            return null;
        }

        $access = IntegrationAccess::tryFrom((string) ($stored['access'] ?? ''));

        if ($access === null || ! is_string($stored['teamId'] ?? null)) {
            return null;
        }

        return ['teamId' => $stored['teamId'], 'access' => $access];
    }
}
