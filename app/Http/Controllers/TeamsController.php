<?php

namespace App\Http\Controllers;

use App\Actions\HealthCheck\PresentTeamHealthStatements;
use App\Actions\Poker\PresentPokerGameSummary;
use App\Actions\Retros\PresentTeamRetro;
use App\Actions\Teams\BuildTeamMoodTrend;
use App\Actions\Teams\PresentNewSessionOptions;
use App\Actions\Whiteboards\PresentWhiteboardSummary;
use App\Contracts\PokerPresenceRoster;
use App\Enums\IntegrationProvider;
use App\Enums\TeamRole;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardTemplate;
use App\Models\Workspace;
use App\Support\Alphabetical;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class TeamsController extends Controller
{
    public function __construct(
        private PresentPokerGameSummary $presentPokerGameSummary,
        private PresentTeamRetro $presentTeamRetro,
        private PokerPresenceRoster $pokerPresenceRoster,
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
        BuildTeamMoodTrend $buildTeamMoodTrend,
        PresentTeamHealthStatements $presentTeamHealthStatements,
        PresentNewSessionOptions $presentNewSessionOptions,
    ): Response {
        Gate::authorize('view', $team);

        $canManage = $request->user()->can('manageMembers', $team);
        $managesWorkspace = $request->user()->canManage($workspace);

        return Inertia::render('teams/show', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'team' => $team->only(['id', 'name']),
            'members' => Alphabetical::sort($team->members()->orderBy('users.id')->get(), fn (User $member): string => $member->name)
                ->map(fn (User $member): array => [
                    ...$member->only(['id', 'name', 'email']),
                    'avatarUrl' => $member->avatarUrl(),
                    'role' => $member->teamMembership->role->value,
                ]),
            'availableMembers' => $canManage
                ? Alphabetical::sort(
                    $workspace->members()->whereNotIn('users.id', $team->members()->select('users.id'))->orderBy('users.id')->get(),
                    fn (User $member): string => $member->name,
                )
                    ->map(fn (User $member): array => [...$member->only(['id', 'name', 'email']), 'avatarUrl' => $member->avatarUrl()])
                : [],
            'canManage' => $canManage,
            'openActionItemCount' => $team->actionItems()->whereNull('completed_at')->count(),
            'retros' => $team->retros()
                ->with(['workspaceTemplate', 'facilitator.user'])
                ->withAvg('rotiVotes', 'score')
                ->withExists(['participants as viewer_has_joined' => fn (Builder $participants) => $participants->where('user_id', $request->user()->id)])
                ->latest()
                ->get()
                ->map(fn (Retro $retro): array => $this->presentTeamRetro->handle($retro)),
            'healthStatements' => $presentTeamHealthStatements->handle($team),
            'canManageHealthStatements' => $request->user()->can('update', $team),
            'pokerGames' => PresentPokerGameSummary::withCounts($team->pokerGames())
                ->latest('updated_at')
                ->get()
                ->map(fn (PokerGame $game): array => $this->presentPokerGameSummary->handle($game)),
            'pokerPresence' => Inertia::defer(fn (): ?array => $this->pokerPresence($team), 'presence'),
            'whiteboards' => $team->whiteboards()
                ->with('facilitator.user')
                ->latest('updated_at')
                ->get()
                ->map(fn (Whiteboard $board): array => $this->presentWhiteboardSummary->handle($board, $request->user(), $managesWorkspace)),
            'whiteboardTemplates' => Alphabetical::sort(
                $workspace->whiteboardTemplates()->get(['id', 'name', 'description', 'created_by_user_id']),
                fn (WhiteboardTemplate $template): string => $template->name,
            )
                ->map(fn (WhiteboardTemplate $template): array => [
                    'id' => $template->id,
                    'name' => $template->name,
                    'description' => $template->description,
                    'canManage' => $managesWorkspace || $template->created_by_user_id === $request->user()->id,
                ]),
            'moodTrend' => Inertia::defer(fn (): array => $buildTeamMoodTrend->handle($team), 'trend', rescue: true),
            ...$presentNewSessionOptions->handle($request->user(), $workspace, $team),
            'canManageIntegrations' => IntegrationProvider::anyEnabled() && $request->user()->can('manageIntegrations', $team),
            'roleOptions' => $canManage ? TeamRole::options() : [],
            'viewerRole' => $team->roleOf($request->user())?->value,
            'canManageRituals' => $request->user()->can('manageRituals', $team),
        ]);
    }

    /**
     * @return ?array<string, ?int>
     */
    private function pokerPresence(Team $team): ?array
    {
        $presence = [];

        foreach ($team->pokerGames()->whereNull('ended_at')->get() as $game) {
            $playerIds = $this->pokerPresenceRoster->playerIds($game);

            if ($playerIds === null) {
                return null;
            }

            $presence[$game->id] = count($playerIds);
        }

        return $presence;
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
