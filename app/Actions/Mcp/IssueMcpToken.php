<?php

namespace App\Actions\Mcp;

use App\Enums\McpScope;
use App\Models\PersonalAccessToken;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\NewAccessToken;

class IssueMcpToken
{
    public const MaxActiveTokens = 25;

    /**
     * @param  array<int, McpScope>  $scopes
     */
    public function handle(User $user, string $name, array $scopes, ?Team $team, ?CarbonInterface $expiresAt): NewAccessToken
    {
        return DB::transaction(function () use ($user, $name, $scopes, $team, $expiresAt): NewAccessToken {
            User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();

            $this->ensureRoom($user);

            $newToken = $user->createToken($name, $this->abilities($scopes), $expiresAt);

            $token = $newToken->accessToken;

            assert($token instanceof PersonalAccessToken);

            $token->forceFill([
                'team_id' => $team?->id,
                'token_hint' => substr($newToken->plainTextToken, -4),
            ])->save();

            return $newToken;
        });
    }

    private function ensureRoom(User $user): void
    {
        $active = $user->tokens()
            ->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->count();

        if ($active < self::MaxActiveTokens) {
            return;
        }

        throw ValidationException::withMessages([
            'name' => __('You can have at most 25 active tokens.'),
        ]);
    }

    /**
     * @param  array<int, McpScope>  $scopes
     * @return array<int, string>
     */
    private function abilities(array $scopes): array
    {
        return collect(McpScope::cases())
            ->filter(fn (McpScope $scope): bool => $scope === McpScope::Read || in_array($scope, $scopes, true))
            ->map(fn (McpScope $scope): string => $scope->value)
            ->values()
            ->all();
    }
}
