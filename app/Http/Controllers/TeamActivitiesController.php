<?php

namespace App\Http\Controllers;

use App\Actions\Teams\ListTeamActivity;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Support\Alphabetical;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TeamActivitiesController extends Controller
{
    public function index(Request $request, Workspace $workspace, Team $team, ListTeamActivity $listTeamActivity): Response
    {
        Gate::authorize('view', $team);

        $members = $team->members()->orderBy('users.id')->get();
        $otherActorIds = $team->activities()
            ->whereNotNull('actor_user_id')
            ->whereNotIn('actor_user_id', $members->modelKeys())
            ->distinct()
            ->pluck('actor_user_id');
        $people = $members->concat(User::query()->whereKey($otherActorIds)->orderBy('id')->get());

        $validated = $request->validate([
            'group' => ['sometimes', 'nullable', Rule::in(array_keys(ListTeamActivity::Groups))],
            'actor' => ['sometimes', 'nullable', 'uuid', Rule::in($people->modelKeys())],
            'day' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'before' => ['sometimes', 'nullable', 'string', 'max:80'],
        ]);

        $filters = [
            'group' => $validated['group'] ?? null,
            'actor' => $validated['actor'] ?? null,
            'day' => $validated['day'] ?? null,
        ];
        $day = $filters['day'] === null ? null : CarbonImmutable::parse($filters['day'], (string) config('app.timezone'));
        $page = $listTeamActivity->page($team, $filters['group'], $filters['actor'], $day, $validated['before'] ?? null);

        return Inertia::render('teams/activity', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'team' => $team->only(['id', 'name']),
            'lines' => Inertia::merge($page['lines'])->matchOn('id'),
            'total' => $page['total'],
            'nextCursor' => $page['nextCursor'],
            'filters' => $filters,
            'members' => Alphabetical::sort($people, fn (User $person): string => $person->name)
                ->map(fn (User $person): array => [
                    ...$person->only(['id', 'name']),
                    'avatarUrl' => $person->avatarUrl(),
                ])
                ->all(),
            'today' => now((string) config('app.timezone'))->toDateString(),
        ]);
    }
}
