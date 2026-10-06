<?php

namespace App\Http\Controllers;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ActionItemQuery;
use App\Actions\HealthCheck\BuildHealthTrend;
use App\Actions\Retros\PresentActionItem;
use App\Actions\Teams\BuildTeamMoodTrend;
use App\Actions\Teams\CreateTeam;
use App\Actions\Teams\ListRecentTeamSessions;
use App\Actions\Teams\ListTeamActivity;
use App\Actions\Teams\PresentNewSessionOptions;
use App\Actions\TeamSurveys\BuildTeamEnps;
use App\Models\ActionItem;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Rules\TeamSlugRule;
use App\Support\Alphabetical;
use App\Support\Teams\SprintCalendar;
use App\Support\Teams\TeamMark;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class TeamsController extends Controller
{
    public function store(Request $request, Workspace $workspace, CreateTeam $createTeam): RedirectResponse
    {
        Gate::authorize('create', [Team::class, $workspace]);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
        ]);

        $team = $createTeam->handle($workspace, $validated);

        return to_route('teams.show', [$workspace, $team]);
    }

    public function show(
        Request $request,
        Workspace $workspace,
        Team $team,
        BuildTeamMoodTrend $buildTeamMoodTrend,
        BuildHealthTrend $buildHealthTrend,
        BuildTeamEnps $buildTeamEnps,
        PresentNewSessionOptions $presentNewSessionOptions,
        ListTeamActivity $listTeamActivity,
        ListRecentTeamSessions $listRecentTeamSessions,
        PresentActionItem $presentActionItem,
    ): Response {
        Gate::authorize('view', $team);

        $sessions = $listRecentTeamSessions->handle($team, $request->user());

        return Inertia::render('teams/show', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'team' => [
                ...$team->only(['id', 'name', 'slug']),
                'color' => TeamMark::colorFor($team)->value,
                'address' => route('teamAddresses.show', $team->slug),
            ],
            'members' => Alphabetical::sort($team->members()->orderBy('users.id')->get(), fn (User $member): string => $member->name)
                ->map(fn (User $member): array => [
                    ...$member->only(['id', 'name']),
                    'avatarUrl' => $member->avatarUrl(),
                ]),
            'liveNow' => $sessions['live'],
            'recentSessions' => $sessions['recent'],
            'hasSessions' => $sessions['live'] !== [] || $sessions['recent'] !== [],
            'openActionItems' => $this->openActionItems($team, $request->user(), $presentActionItem),
            'openActionItemCount' => $team->actionItems()->whereNull('completed_at')->count(),
            'overdueActionItemCount' => $team->actionItems()
                ->whereNull('completed_at')
                ->whereNotNull('due_on')
                ->where('due_on', '<', ActionItem::today()->toDateString())
                ->count(),
            'moodTrend' => Inertia::defer(fn (): array => $buildTeamMoodTrend->handle($team), 'trend', rescue: true),
            'latestHealth' => Inertia::defer(fn (): ?array => $this->latestHealth($team, $buildHealthTrend), 'trend', rescue: true),
            'latestEnps' => Inertia::defer(fn (): ?array => $this->latestEnps($team, $buildTeamEnps), 'trend', rescue: true),
            'activity' => $listTeamActivity->handle($team),
            'schedule' => $this->schedule($team),
            'hasSprints' => $team->sprints()->exists(),
            'canManageRituals' => $request->user()->can('manageRituals', $team),
            'viewerRole' => $team->roleOf($request->user())?->value,
            'viewerIsObserver' => $request->user()->isObserverOf($team),
            ...$presentNewSessionOptions->handle($request->user(), $workspace, $team),
        ]);
    }

    public function update(Request $request, Workspace $workspace, Team $team): RedirectResponse
    {
        Gate::authorize('update', $team);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'description' => ['sometimes', 'nullable', 'string', 'max:200'],
            'slug' => ['sometimes', ...TeamSlugRule::rules($workspace, $team->id)],
        ]);

        try {
            DB::transaction(fn (): bool => $team->update($validated));
        } catch (UniqueConstraintViolationException) {
            throw CreateTeam::slugTaken($workspace);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Team saved.')]);

        return back();
    }

    public function destroy(Workspace $workspace, Team $team): RedirectResponse
    {
        Gate::authorize('delete', $team);

        $team->delete();

        return to_route('workspaces.show', $workspace);
    }

    /**
     * The score of the last health check that has one, and how it moved since the one before.
     *
     * @return array{
     *     score: float,
     *     change: ?float
     * }|null
     */
    private function latestHealth(Team $team, BuildHealthTrend $buildHealthTrend): ?array
    {
        $latest = Arr::last($buildHealthTrend->forTeam($team->id));

        if ($latest === null) {
            return null;
        }

        return ['score' => $latest['score'], 'change' => $latest['delta']];
    }

    /**
     * The team's last eNPS and how it moved since the one before, as Insights › eNPS reads them.
     *
     * @return array{
     *     score: int,
     *     change: ?int
     * }|null
     */
    private function latestEnps(Team $team, BuildTeamEnps $buildTeamEnps): ?array
    {
        $latest = $buildTeamEnps->handle($team)['latest'];

        if ($latest === null) {
            return null;
        }

        return ['score' => $latest['score'], 'change' => $latest['change']];
    }

    /**
     * @return array{
     *     sprint: array{id: string, number: int, startsOn: string, endsOn: string}|null,
     *     nextRetro: array{date: string, time: ?string}|null
     * }|null
     */
    private function schedule(Team $team): ?array
    {
        $calendar = SprintCalendar::fromToday($team, now());
        $sprint = $calendar->sprintOn(now());
        $nextRetro = $calendar->nextRetro(now());

        if ($sprint === null && $nextRetro === null) {
            return null;
        }

        return ['sprint' => $sprint, 'nextRetro' => $nextRetro];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function openActionItems(Team $team, User $viewer, PresentActionItem $presentActionItem): array
    {
        $query = $team->actionItems()->getQuery()
            ->whereNull('completed_at')
            ->with(ActionItem::presentationRelations())
            ->withCount('comments');
        $actor = ActionItemActor::forUser($viewer);
        $today = ActionItem::today();

        return ActionItemQuery::order($query)
            ->limit(5)
            ->get()
            ->map(fn (ActionItem $item): array => $presentActionItem->handle($item, $actor, $today))
            ->all();
    }
}
