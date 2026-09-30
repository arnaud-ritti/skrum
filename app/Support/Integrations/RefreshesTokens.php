<?php

namespace App\Support\Integrations;

interface RefreshesTokens
{
    /**
     * @return array{access_token: string, refresh_token: string|null, expires_at: int|null, scopes: array<int, string>}
     */
    public function refreshTokens(string $refreshToken): array;
}
