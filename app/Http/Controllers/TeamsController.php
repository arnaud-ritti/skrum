<?php

namespace App\Http\Controllers;

use App\Actions\Games\IcebreakerGameOptions;
use App\Actions\HealthCheck\PresentHealthStatement;
use App\Actions\HealthCheck\TeamHealthStatements;
use App\Actions\Poker\PresentPokerGameSummary;
use App\Actions\Retros\BuildTemplateCatalogue;
use App\Actions\Retros\TopTeamTemplates;
use App\Actions\Whiteboards\BuildWhiteboardGallery;
use App\Actions\Whiteboards\PresentWhiteboardSummary;
use App\Enums\IntegrationProvider;
use App\Enums\PokerDeck;
use App\Enums\TemplateCategory;
use App\Models\GameRoom;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\SavedPokerDeck;
use App\Models\Team;
use App\Models\TeamHealthStatement;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardTemplate;
use App\Models\Workspace;
use App\Support\Games\GameRulesRegistry;
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
        private PresentWhiteboardSummary $presentWhiteboardSummary,
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

    public function show(
        Request $request,
        Workspace $workspace,
        Team $team,
        Llm $llm,
        BuildTemplateCatalogue $buildTemplateCatalogue,
        IcebreakerGameOptions $icebreakerGameOptions,
        BuildWhiteboardGallery $buildWhiteboardGallery,
        TopTeamTemplates $topTeamTemplates,
        GameRulesRegistry $gameRulesRegistry,
    ): Response {
        Gate::authorize('view', $team);

        $canManage = $request->user()->can('manageMembers', $team);
        $managesWorkspace = $request->user()->canManage($workspace);

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
            'retros' => $team->retros()->latest()->get()->map(fn (Retro $retro): array => [
                'id' => $retro->id,
                'title' => $retro->title,
                'phase' => $retro->phase->value,
                'phaseLabel' => $retro->phase->label(),
                'createdAt' => $retro->created_at?->toIso8601String(),
            ]),
            'templateCategories' => TemplateCategory::options(),
            'topTemplates' => $topTeamTemplates->handle($team),
            'catalogue' => Inertia::optional(fn (): array => $buildTemplateCatalogue->handle($workspace)),
            'llm' => [
                'enabled' => $llm->isConfigured(),
                'provider' => $llm->providerName(),
            ],
            'canCreateRetro' => $request->user()->can('createRetro', $team),
            'icebreakerGames' => $icebreakerGameOptions->options(),
            'gameOptions' => $gameRulesRegistry->options(new GameRoom(['team_id' => $team->id])),
            'canCreateGameRoom' => $request->user()->can('createGameRoom', $team)
                && $team->gameRooms()->whereNull('retro_id')->count() < GameRoom::MaxRoomsPerTeam,
            'roomLimit' => GameRoom::MaxRoomsPerTeam,
            'healthStatements' => $this->teamHealthStatements->all($team)->map(fn (TeamHealthStatement $statement): array => [
                'id' => $statement->id ?? $statement->key(),
                ...$this->presentHealthStatement->handle($statement),
                'isArchived' => $statement->isArchived(),
            ])->values(),
            'canManageHealthStatements' => $request->user()->can('update', $team),
            'pokerGames' => PresentPokerGameSummary::withCounts($team->pokerGames())
                ->latest('updated_at')
                ->get()
                ->map(fn (PokerGame $game): array => $this->presentPokerGameSummary->handle($game)),
            'pokerDecks' => $this->pokerDecks($request->user(), $workspace, $team),
            'pokerDeckOptions' => PokerDeck::options(),
            'canCreatePokerGame' => $request->user()->can('createPokerGame', $team),
            'whiteboards' => $team->whiteboards()
                ->with('facilitator.user')
                ->latest('updated_at')
                ->get()
                ->map(fn (Whiteboard $board): array => $this->presentWhiteboardSummary->handle($board, $request->user(), $managesWorkspace)),
            'canCreateWhiteboard' => $request->user()->can('createWhiteboard', $team),
            'whiteboardTemplates' => $workspace->whiteboardTemplates()
                ->orderBy('name')
                ->get(['id', 'name', 'description', 'created_by_user_id'])
                ->map(fn (WhiteboardTemplate $template): array => [
                    'id' => $template->id,
                    'name' => $template->name,
                    'description' => $template->description,
                    'canManage' => $managesWorkspace || $template->created_by_user_id === $request->user()->id,
                ]),
            'whiteboardGallery' => Inertia::optional(fn (): array => $buildWhiteboardGallery->handle($workspace)),
            'canManageIntegrations' => IntegrationProvider::anyEnabled() && $request->user()->can('manageIntegrations', $team),
        ]);
    }

    /**
     * @return array<int, array{id: string, name: string, cards: array<int, string>, canManage: bool}>
     */
    private function pokerDecks(User $user, Workspace $workspace, Team $team): array
    {
        $isManager = $user->canManage($workspace);

        return $team->pokerDecks()->orderBy('name')->get()
            ->map(fn (SavedPokerDeck $deck): array => [
                'id' => $deck->id,
                'name' => $deck->name,
                'cards' => $deck->cards,
                'canManage' => $isManager || $deck->created_by_user_id === $user->id,
            ])
            ->values()
            ->all();
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
