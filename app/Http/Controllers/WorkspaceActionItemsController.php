<?php

namespace App\Http\Controllers;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ActionItemFilters;
use App\Actions\ActionItems\ActionItemPermissions;
use App\Actions\ActionItems\ActionItemQuery;
use App\Actions\ActionItems\ActionItemRules;
use App\Actions\ActionItems\ActionItemSprints;
use App\Actions\ActionItems\ApplyActionItemChanges;
use App\Actions\ActionItems\CreateActionItem;
use App\Actions\ActionItems\DeleteActionItem;
use App\Actions\ActionItems\ResolveActionItemAssignee;
use App\Actions\ActionItems\WorkspaceActionItemGuard;
use App\Actions\Integrations\ListExportSources;
use App\Actions\Retros\PresentActionItem;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Support\Alphabetical;
use Illuminate\Contracts\Database\Query\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

class WorkspaceActionItemsController extends Controller
{
    public function __construct(
        private PresentActionItem $presentActionItem,
        private ActionItemPermissions $permissions,
        private CreateActionItem $createActionItem,
        private ApplyActionItemChanges $applyActionItemChanges,
        private DeleteActionItem $deleteActionItem,
        private ResolveActionItemAssignee $resolveActionItemAssignee,
        private ActionItemQuery $actionItemQuery,
        private ListExportSources $listExportSources,
        private ActionItemSprints $actionItemSprints,
    ) {}

    public function index(Request $request, Workspace $workspace): InertiaResponse
    {
        $user = $request->user();
        $actor = ActionItemActor::forUser($user);
        $teams = $workspace->teamsVisibleTo($user)->load(['members' => fn ($query) => $query->orderBy('users.id')]);
        $teams->each(fn (Team $team) => $team->setRelation('members', Alphabetical::sort($team->members, fn (User $member): string => $member->name)));
        $filters = ActionItemFilters::fromRequest($request, $teams);
        $facilitated = Retro::query()
            ->whereIn('team_id', $teams->pluck('id'))
            ->whereHas('facilitator', fn (Builder $query) => $query->where('user_id', $user->id))
            ->get(['id', 'team_id', 'phase']);

        return Inertia::render('action-items/index', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'filters' => $filters->toArray(),
            'items' => fn (): array => $this->items($user, $workspace, $filters, $actor),
            'focusedItem' => fn (): ?array => $this->focusedItem($user, $workspace, $filters, $actor),
            'counts' => fn (): array => $this->actionItemQuery->counts($user, $workspace, $filters),
            'filterTeams' => $this->presentTeams($teams),
            'creatableTeams' => $this->presentTeams($teams->filter(fn (Team $team) => $team->members->contains('id', $user->id))),
            'assignees' => Alphabetical::sort($teams->flatMap(fn (Team $team) => $team->members)->unique('id'), fn (User $member): string => $member->name)
                ->map(fn (User $member): array => ['id' => $member->id, 'name' => $member->name])
                ->values(),
            'realtimeTeamIds' => $filters->teamId === null ? $teams->pluck('id')->values() : [$filters->teamId],
            'exportSources' => $this->listExportSources->forTeams($teams),
            'viewer' => [
                'userId' => $user->id,
                'isWorkspaceManager' => $user->canManage($workspace),
                'facilitatedRetroIds' => $facilitated->pluck('id')->values(),
                'reviewTeamIds' => $facilitated
                    ->reject(fn (Retro $retro): bool => $retro->phase === RetroPhase::Completed)
                    ->pluck('team_id')
                    ->unique()
                    ->values(),
            ],
        ]);
    }

    public function store(Request $request, Workspace $workspace): JsonResponse
    {
        $user = $request->user();
        $actor = ActionItemActor::forUser($user);

        $validated = $request->validate([
            'team_id' => ['required', 'uuid', Rule::exists('teams', 'id')->where('workspace_id', $workspace->id)],
            ...ActionItemRules::create(allowsGuests: false),
        ], ActionItemRules::messages());

        $team = Team::query()->whereKey($validated['team_id'])->firstOrFail();

        if ($user->cannot('view', $team)) {
            throw ValidationException::withMessages(['team_id' => __('The selected team is invalid.')]);
        }

        $this->permissions->authorizeCreateWithoutRetro($user, $team);

        $actionItem = DB::transaction(fn (): ActionItem => $this->createActionItem->handle($team, null, $actor, [
            ...ActionItemRules::attributes($validated),
            ...($this->resolveActionItemAssignee->handle($team, null, $validated) ?? []),
        ]));

        return response()->json(['actionItem' => $this->presentActionItem->handle($actionItem, $actor)], 201);
    }

    public function update(Request $request, Workspace $workspace, ActionItem $actionItem): JsonResponse
    {
        $user = $request->user();
        $actor = ActionItemActor::forUser($user);

        WorkspaceActionItemGuard::visible($user, $workspace, $actionItem);

        $validated = $request->validate(ActionItemRules::update(allowsGuests: false), ActionItemRules::messages());

        $updated = DB::transaction(fn (): ActionItem => $this->applyActionItemChanges->handle(WorkspaceActionItemGuard::lockWritable($actionItem->id), $actor, $validated));

        return response()->json(['actionItem' => $this->presentActionItem->handle($updated, $actor)]);
    }

    public function destroy(Request $request, Workspace $workspace, ActionItem $actionItem): Response
    {
        $user = $request->user();

        WorkspaceActionItemGuard::visible($user, $workspace, $actionItem);

        DB::transaction(function () use ($actionItem, $user): void {
            $this->deleteActionItem->handle(WorkspaceActionItemGuard::lockWritable($actionItem->id), ActionItemActor::forUser($user));
        });

        return response()->noContent();
    }

    /**
     * @return array{
     *     data: array<int, array<string, mixed>>,
     *     currentPage: int,
     *     lastPage: int,
     *     total: int,
     *     prevPageUrl: ?string,
     *     nextPageUrl: ?string,
     *     sprints: array<int, array<string, mixed>>,
     *     withoutSprint: array<int, string>
     * }
     */
    private function items(User $user, Workspace $workspace, ActionItemFilters $filters, ActionItemActor $actor): array
    {
        $page = $this->actionItemQuery->forUser($user, $workspace, $filters);

        return [
            'data' => $this->presentActionItem->many($page->items(), $actor),
            'currentPage' => $page->currentPage(),
            'lastPage' => $page->lastPage(),
            'total' => $page->total(),
            'prevPageUrl' => $page->previousPageUrl(),
            'nextPageUrl' => $page->nextPageUrl(),
            ...$this->actionItemSprints->forPage($page->items()),
        ];
    }

    /**
     * @return ?array<string, mixed>
     */
    private function focusedItem(User $user, Workspace $workspace, ActionItemFilters $filters, ActionItemActor $actor): ?array
    {
        if ($filters->itemId === null) {
            return null;
        }

        $item = $this->actionItemQuery->find($user, $workspace, $filters->itemId);

        return $item === null ? null : $this->presentActionItem->handle($item, $actor);
    }

    /**
     * @param  Collection<int, Team>  $teams
     * @return array<int, array{id: string, name: string, members: array<int, array{id: string, name: string, avatarUrl: string}>}>
     */
    private function presentTeams(Collection $teams): array
    {
        return $teams->map(fn (Team $team): array => [
            'id' => $team->id,
            'name' => $team->name,
            'members' => $team->members
                ->map(fn (User $member): array => ['id' => $member->id, 'name' => $member->name, 'avatarUrl' => $member->avatarUrl()])
                ->values()
                ->all(),
        ])->values()->all();
    }
}
