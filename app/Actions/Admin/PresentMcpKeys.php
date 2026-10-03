<?php

namespace App\Actions\Admin;

use App\Enums\McpScope;
use App\Models\PersonalAccessToken;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class PresentMcpKeys
{
    private const int PerPage = 25;

    /**
     * The tokens of every user, newest first; the fingerprint is the prefix and the last four
     * characters, never the secret.
     *
     * @return LengthAwarePaginator<int, array{
     *     id: string,
     *     name: string,
     *     owner: array{id: string, name: string, avatarUrl: string},
     *     fingerprint: string,
     *     scopes: array<int, string>,
     *     team: ?string,
     *     createdAt: ?string,
     *     lastUsedAt: ?string,
     *     expiresAt: ?string
     * }>
     */
    public function handle(): LengthAwarePaginator
    {
        $prefix = (string) config('sanctum.token_prefix');

        return PersonalAccessToken::query()
            ->whereHasMorph('tokenable', [User::class])
            ->with(['tokenable', 'team'])
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(self::PerPage)
            ->withQueryString()
            ->through(function (PersonalAccessToken $token) use ($prefix): array {
                /** @var User $owner */
                $owner = $token->tokenable;

                return [
                    'id' => $token->id,
                    'name' => $token->name,
                    'owner' => [
                        'id' => $owner->id,
                        'name' => $owner->name,
                        'avatarUrl' => $owner->avatarUrl(),
                    ],
                    'fingerprint' => "{$prefix}…{$token->token_hint}",
                    'scopes' => array_map(fn (McpScope $scope): string => $scope->value, $token->scopes()),
                    'team' => $token->team?->name,
                    'createdAt' => $token->created_at?->toIso8601String(),
                    'lastUsedAt' => $token->last_used_at?->toIso8601String(),
                    'expiresAt' => $token->expires_at?->toIso8601String(),
                ];
            });
    }
}
