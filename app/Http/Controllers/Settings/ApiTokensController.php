<?php

namespace App\Http\Controllers\Settings;

use App\Actions\Mcp\IssueMcpToken;
use App\Actions\Mcp\RevokeMcpToken;
use App\Enums\McpScope;
use App\Http\Controllers\Controller;
use App\Models\PersonalAccessToken;
use App\Models\Team;
use App\Models\User;
use App\Support\Settings\ApiTokenSettings;
use Carbon\CarbonInterface;
use Closure;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class ApiTokensController extends Controller
{
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
            'expiration' => ['required', 'string', Rule::in(ApiTokenSettings::Expirations)],
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
}
