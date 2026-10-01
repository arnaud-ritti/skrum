<?php

namespace App\Support\Integrations;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Models\Team;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use LogicException;

class OAuthState
{
    public const SessionKey = 'integrations.oauth';

    private const TtlMinutes = 10;

    private const Length = 40;

    private const VerifierLength = 64;

    public function issue(Request $request, IntegrationProvider $provider, Team $team, IntegrationAccess $access): string
    {
        $state = Str::random(self::Length);

        $request->session()->put(self::SessionKey, [
            'state' => $state,
            'provider' => $provider->value,
            'teamId' => $team->id,
            'access' => $access->value,
            'expiresAt' => now()->addMinutes(self::TtlMinutes)->getTimestamp(),
            'codeVerifier' => Str::random(self::VerifierLength),
        ]);

        return $state;
    }

    /**
     * @return array{teamId: string, access: IntegrationAccess, codeVerifier: ?string}|null
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

        return [
            'teamId' => $stored['teamId'],
            'access' => $access,
            'codeVerifier' => is_string($stored['codeVerifier'] ?? null) ? $stored['codeVerifier'] : null,
        ];
    }

    /**
     * The PKCE S256 challenge of the verifier issued with the current state.
     */
    public function codeChallenge(Request $request): string
    {
        $verifier = data_get($request->session()->get(self::SessionKey), 'codeVerifier');

        if (! is_string($verifier) || $verifier === '') {
            throw new LogicException('No PKCE verifier was issued with the OAuth state.');
        }

        return self::challenge($verifier);
    }

    public static function challenge(string $verifier): string
    {
        return rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');
    }
}
