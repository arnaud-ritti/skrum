<?php

namespace App\Http\Controllers\Settings;

use App\Actions\Mcp\IssueMcpToken;
use App\Actions\Mcp\RevokeMcpToken;
use App\Enums\McpScope;
use App\Http\Controllers\Controller;
use App\Models\PersonalAccessToken;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMembership;
use App\Support\Alphabetical;
use Carbon\CarbonInterface;
use Closure;
use Illuminate\Contracts\Database\Query\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ApiTokensController extends Controller
{
    private const array Expirations = ['30_days', '90_days', '1_year', 'never'];

    private const string DefaultExpiration = '90_days';

    public function index(Request $request): Response
    {
        $user = $request->user();
        $viewableTeamIds = $this->viewableTeamIds($user);

        return Inertia::render('settings/api-tokens', [
            'tokens' => PersonalAccessToken::query()
                ->whereMorphedTo('tokenable', $user)
                ->with('team.workspace')
                ->latest()
                ->get()
                ->map(fn (PersonalAccessToken $token): array => $this->presentToken($token, $viewableTeamIds))
                ->values(),
            'teamGroups' => $this->teamsByWorkspace($user),
            'mcpUrl' => url('/mcp'),
            'expirationOptions' => collect(self::Expirations)
                ->map(fn (string $value): array => ['value' => $value, 'label' => $this->expirationLabel($value)])
                ->all(),
            'defaultExpiration' => self::DefaultExpiration,
        ]);
    }

    public function store(Request $request, IssueMcpToken $issueMcpToken): RedirectResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:60',
                Rule::unique('personal_access_tokens', 'name')
                    ->where('tokenable_type', $user->getMorphClass())
                    ->where('tokenable_id', $user->id),
            ],
            'scopes' => ['sometimes', 'array'],
            'scopes.*' => ['string', Rule::in([McpScope::Write->value, McpScope::Delete->value])],
            'team_id' => ['nullable', 'uuid', $this->viewableTeam($user)],
            'expiration' => ['required', 'string', Rule::in(self::Expirations)],
        ], [
            'name.unique' => __('You already have a token with this name.'),
        ]);

        $newToken = $issueMcpToken->handle(
            $user,
            $validated['name'],
            array_map(McpScope::from(...), $validated['scopes'] ?? []),
            isset($validated['team_id']) ? Team::query()->whereKey($validated['team_id'])->firstOrFail() : null,
            $this->expiresAt($validated['expiration']),
        );

        Inertia::flash('newToken', [
            'name' => $validated['name'],
            'plainText' => $newToken->plainTextToken,
        ]);

        return back();
    }

    public function destroy(Request $request, string $token, RevokeMcpToken $revokeMcpToken): RedirectResponse
    {
        $user = $request->user();

        $model = PersonalAccessToken::query()->whereMorphedTo('tokenable', $user)->whereKey($token)->first();

        abort_unless($model instanceof PersonalAccessToken, 404);

        $revokeMcpToken->handle($user, $model);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Token revoked.')]);

        return back();
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

    private function viewableTeam(User $user): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($user): void {
            $team = is_string($value) ? Team::query()->find($value) : null;

            if ($team !== null && $user->can('view', $team)) {
                return;
            }

            $fail(__('Choose a team you can see.'));
        };
    }

    private function expiresAt(string $expiration): ?CarbonInterface
    {
        return match ($expiration) {
            '30_days' => now()->addDays(30),
            '90_days' => now()->addDays(90),
            '1_year' => now()->addYear(),
            default => null,
        };
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
