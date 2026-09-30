<?php

namespace App\Http\Controllers;

use App\Actions\HealthCheck\PresentHealthStatement;
use App\Actions\HealthCheck\TeamHealthStatements;
use App\Actions\Poker\PresentPokerGameSummary;
use App\Actions\Retros\BuildTemplateCatalogue;
use App\Enums\PokerDeck;
use App\Enums\TemplateCategory;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamHealthStatement;
use App\Models\User;
use App\Models\Workspace;
use App\Support\Llm\Llm;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class TeamsController extends Controller
{
    public function __construct(
        private TeamHealthStatements $teamHealthStatements,
        private PresentHealthStatement $presentHealthStatement,
        private PresentPokerGameSummary $presentPokerGameSummary,
    ) {}

    public function store(Request $request, Workspace $workspace): RedirectResponse
    {
        Gate::authorize('create', [Team::class, $workspace]);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
        ]);

        $team = $workspace->teams()->create($validated);

        return to_route('teams.show', [$workspace, $team]);
    }

    public function show(Request $request, Workspace $workspace, Team $team, Llm $llm, BuildTemplateCatalogue $buildTemplateCatalogue): Response
    {
        Gate::authorize('view', $team);

        $canManage = $request->user()->can('manageMembers', $team);

        return Inertia::render('teams/show', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'team' => $team->only(['id', 'name']),
            'members' => $team->members()->orderBy('name')->get()
                ->map(fn (User $member) => $member->only(['id', 'name', 'email'])),
            'availableMembers' => $canManage
                ? $workspace->members()->whereNotIn('users.id', $team->members()->select('users.id'))->orderBy('name')->get()
                    ->map(fn (User $member) => $member->only(['id', 'name', 'email']))
                : [],
            'canManage' => $canManage,
            'openActionItemCount' => $team->actionItems()->whereNull('completed_at')->count(),
            'retros' => $team->retros()->latest()->get()->map(fn (Retro $retro) => [
                'id' => $retro->id,
                'title' => $retro->title,
                'phase' => $retro->phase->value,
                'phaseLabel' => $retro->phase->label(),
                'createdAt' => $retro->created_at?->toIso8601String(),
            ]),
            'templateCategories' => TemplateCategory::options(),
            'catalogue' => Inertia::optional(fn () => $buildTemplateCatalogue->handle($workspace)),
            'llm' => [
                'enabled' => $llm->isConfigured(),
                'provider' => $llm->providerName(),
            ],
            'canCreateRetro' => $request->user()->can('createRetro', $team),
            'healthStatements' => $this->teamHealthStatements->all($team)->map(fn (TeamHealthStatement $statement) => [
                'id' => $statement->id ?? $statement->key(),
                ...$this->presentHealthStatement->handle($statement),
                'isArchived' => $statement->isArchived(),
            ])->values(),
            'canManageHealthStatements' => $request->user()->can('update', $team),
            'pokerGames' => PresentPokerGameSummary::withCounts($team->pokerGames())
                ->latest('updated_at')
                ->get()
                ->map(fn (PokerGame $game) => $this->presentPokerGameSummary->handle($game)),
            'pokerDeckOptions' => PokerDeck::options(),
            'canCreatePokerGame' => $request->user()->can('createPokerGame', $team),
        ]);
    }

    public function update(Request $request, Workspace $workspace, Team $team): RedirectResponse
    {
        Gate::authorize('update', $team);

        $team->update($request->validate([
            'name' => ['required', 'string', 'max:100'],
        ]));

        return back();
    }

    public function destroy(Workspace $workspace, Team $team): RedirectResponse
    {
        Gate::authorize('delete', $team);

        $team->delete();

        return to_route('workspaces.show', $workspace);
    }
}
