<?php

namespace App\Actions\Mcp;

use App\Actions\Admin\RecordAuditEvent;
use App\Enums\AuditAction;
use App\Enums\McpScope;
use App\Models\PersonalAccessToken;
use App\Models\Team;
use App\Models\User;
use App\Support\Database\Transactions;
use Carbon\CarbonInterface;
use Illuminate\Contracts\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\NewAccessToken;
use LogicException;

class IssueMcpToken
{
    public const MaxActiveTokens = 25;

    public function __construct(private RecordAuditEvent $recordAuditEvent) {}

    /**
     * @param  array<int, McpScope>  $scopes
     */
    public function handle(User $user, string $name, array $scopes, ?Team $team, ?CarbonInterface $expiresAt): NewAccessToken
    {
        return DB::transaction(function () use ($user, $name, $scopes, $team, $expiresAt): NewAccessToken {
            User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();

            $this->ensureNameIsFree($user, $name);
            $this->ensureRoom($user);

            $newToken = $user->createToken($name, $this->abilities($scopes), $expiresAt);

            $token = $newToken->accessToken;

            throw_unless($token instanceof PersonalAccessToken, LogicException::class, 'Sanctum issued a token that is not a skrum personal access token.');

            $token->forceFill([
                'team_id' => $team?->id,
                'token_hint' => substr($newToken->plainTextToken, -4),
            ])->save();

            $this->recordAuditEvent->handle(AuditAction::TokenCreated, $user, $token, [
                'name' => $name,
                'scopes' => $token->abilities,
                'teamId' => $team?->id,
            ]);

            return $newToken;
        }, Transactions::Attempts);
    }

    private function ensureNameIsFree(User $user, string $name): void
    {
        if (! $user->tokens()->where('name', $name)->exists()) {
            return;
        }

        throw ValidationException::withMessages([
            'name' => __('You already have a token with this name.'),
        ]);
    }

    private function ensureRoom(User $user): void
    {
        $active = $user->tokens()
            ->where(fn (Builder $query) => $query->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->count();

        if ($active < self::MaxActiveTokens) {
            return;
        }

        throw ValidationException::withMessages([
            'name' => __('You can have at most :count active tokens.', ['count' => self::MaxActiveTokens]),
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
