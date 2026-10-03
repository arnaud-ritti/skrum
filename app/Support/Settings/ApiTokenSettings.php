<?php

namespace App\Support\Settings;

use App\Enums\McpScope;
use App\Models\PersonalAccessToken;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMembership;
use App\Support\Alphabetical;
use Illuminate\Contracts\Database\Query\Builder;

/**
 * The API tokens section of the account settings, in two parts: the choices
 * of the creation form, the same for every account, and what belongs to the
 * account, which is read only behind a confirmed password.
 */
class ApiTokenSettings
{
    public const array Expirations = ['30_days', '90_days', '1_year', 'never'];

    public const string DefaultExpiration = '90_days';

    /**
     * Constants of the application alone: nothing here may depend on the
     * account or on the instance.
     *
     * @return array{
     *     expirationOptions: array<int, array{value: string, label: string}>,
     *     defaultExpiration: string
     * }
     */
    public function offered(): array
    {
        return [
            'expirationOptions' => collect(self::Expirations)
                ->map(fn (string $value): array => ['value' => $value, 'label' => $this->expirationLabel($value)])
                ->all(),
            'defaultExpiration' => self::DefaultExpiration,
        ];
    }

    /**
     * @return array{
     *     tokens: array<int, array<string, mixed>>,
     *     teamGroups: array<int, array{workspace: array{id: string, name: string}, teams: array<int, array{id: string, name: string}>}>,
     *     mcpUrl: string
     * }
     */
    public function protected(User $user): array
    {
        $viewableTeamIds = $this->viewableTeamIds($user);

        return [
            'tokens' => PersonalAccessToken::query()
                ->whereMorphedTo('tokenable', $user)
                ->with('team.workspace')
                ->latest()
                ->get()
                ->map(fn (PersonalAccessToken $token): array => $this->presentToken($token, $viewableTeamIds))
                ->values()
                ->all(),
            'teamGroups' => $this->teamsByWorkspace($user),
            'mcpUrl' => url('/mcp'),
        ];
    }

    /**
     * @param  array<int, string>  $viewableTeamIds
     * @return array{
     *     id: string,
     *     name: string,
     *     hint: string,
     *     scopes: array<int, string>,
     *     team: array{id: string, name: string}|null,
     *     teamAccessible: bool,
     *     createdAt: ?string,
     *     expiresAt: ?string,
     *     lastUsedAt: ?string,
     *     isExpired: bool
     * }
     */
    private function presentToken(PersonalAccessToken $token, array $viewableTeamIds): array
    {
        $team = $token->team;

        return [
            'id' => $token->id,
            'name' => $token->name,
            'hint' => $token->token_hint,
            'scopes' => array_map(fn (McpScope $scope): string => $scope->value, $token->scopes()),
            'team' => $team === null ? null : ['id' => $team->id, 'name' => $team->name],
            'teamAccessible' => $team === null || in_array($team->id, $viewableTeamIds, true),
            'createdAt' => $token->created_at?->toIso8601String(),
            'expiresAt' => $token->expires_at?->toIso8601String(),
            'lastUsedAt' => $token->last_used_at?->toIso8601String(),
            'isExpired' => $token->isExpired(now()),
        ];
    }

    /**
     * @return array<int, array{workspace: array{id: string, name: string}, teams: array<int, array{id: string, name: string}>}>
     */
    private function teamsByWorkspace(User $user): array
    {
        return Alphabetical::sort($user->workspaces()->orderBy('workspaces.id')->get(), fn (Workspace $workspace): string => $workspace->name)
            ->map(fn (Workspace $workspace): array => [
                'workspace' => ['id' => $workspace->id, 'name' => $workspace->name],
                'teams' => $workspace->teamsVisibleTo($user)
                    ->map(fn (Team $team): array => ['id' => $team->id, 'name' => $team->name])
                    ->values()
                    ->all(),
            ])
            ->filter(fn (array $group): bool => $group['teams'] !== [])
            ->values()
            ->all();
    }

    /**
     * @return array<int, string>
     */
    private function viewableTeamIds(User $user): array
    {
        $managedWorkspaceIds = WorkspaceMembership::query()
            ->where('user_id', $user->id)
            ->get()
            ->filter(fn (WorkspaceMembership $membership): bool => $membership->role->canManageWorkspace())
            ->pluck('workspace_id');

        return Team::query()
            ->whereIn('workspace_id', $managedWorkspaceIds)
            ->orWhereHas('members', fn (Builder $query) => $query->whereKey($user->id))
            ->pluck('id')
            ->all();
    }

    private function expirationLabel(string $expiration): string
    {
        return match ($expiration) {
            '30_days' => __('30 days'),
            '90_days' => __('90 days'),
            '1_year' => __('1 year'),
            default => __('Never'),
        };
    }
}
