<?php

namespace App\Http\Controllers;

use App\Actions\Retros\BuildTemplateCatalogue;
use App\Actions\Retros\TemplateAvailability;
use App\Actions\Teams\AvailableTeamMembers;
use App\Actions\Teams\MemberLastActivity;
use App\Actions\Teams\PresentTeamSprints;
use App\Actions\Teams\RecordTeamActivity;
use App\Actions\Teams\SuggestedFacilitator;
use App\Actions\Teams\TeamSettingsSections;
use App\Actions\Teams\TeamTemplateUsage;
use App\Enums\TeamActivityKind;
use App\Enums\TeamRole;
use App\Enums\TemplateCategory;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Support\Alphabetical;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class TeamMembersController extends Controller
{
    public function index(
        Request $request,
        Workspace $workspace,
        Team $team,
        MemberLastActivity $memberLastActivity,
        AvailableTeamMembers $availableTeamMembers,
        TeamTemplateUsage $teamTemplateUsage,
        PresentTeamSprints $presentTeamSprints,
        SuggestedFacilitator $suggestedFacilitator,
        TemplateAvailability $templateAvailability,
        BuildTemplateCatalogue $buildTemplateCatalogue,
        TeamSettingsSections $sections,
    ): Response {
        Gate::authorize('manageRituals', $team);

        $user = $request->user();
        $canManageMembers = $user->can('manageMembers', $team);
        $lastActivity = $memberLastActivity->handle($team);
        $defaultKey = $team->default_retro_template;
        $defaultIsAvailable = $defaultKey !== null && $templateAvailability->isAvailable($team, $user, $defaultKey);
        $person = fn (User $member): array => [...$member->only(['id', 'name']), 'avatarUrl' => $member->avatarUrl()];

        return Inertia::render('teams/members', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'team' => $team->only(['id', 'name', 'description']),
            'createdAt' => $team->created_at?->toIso8601String(),
            'sections' => $sections->handle($user, $team),
            'members' => Alphabetical::sort($team->members()->orderBy('users.id')->get(), fn (User $member): string => $member->name)
                ->map(fn (User $member): array => [
                    ...$member->only(['id', 'name', 'email']),
                    'avatarUrl' => $member->avatarUrl(),
                    'role' => $member->teamMembership->role->value,
                    'lastActiveAt' => $lastActivity[$member->id] ?? null,
                    'isViewer' => $member->id === $user->id,
                ])
                ->values(),
            'canManageMembers' => $canManageMembers,
            'roleOptions' => TeamRole::options(),
            'availableMembers' => $canManageMembers ? $availableTeamMembers->handle($team) : [],
            'sprints' => $presentTeamSprints->handle($team, now()),
            'rituals' => [
                'sprintLengthWeeks' => $team->sprint_length_weeks,
                'retroWeekday' => $team->retro_weekday,
                'retroTime' => $team->retro_time,
            ],
            'facilitators' => [
                'list' => $team->defaultFacilitators()->get()->map($person)->values(),
                'rotation' => $team->facilitator_rotation_enabled,
                'suggested' => $suggestedFacilitator->for($team)?->only(['id', 'name']),
                'candidates' => Alphabetical::sort(
                    $team->members()->wherePivotIn('role', [TeamRole::Owner->value, TeamRole::Facilitator->value])->orderBy('users.id')->get(),
                    fn (User $member): string => $member->name,
                )->map($person)->values(),
            ],
            'templates' => $teamTemplateUsage->handle($team, $user),
            'defaultRetroTemplate' => $defaultIsAvailable ? $defaultKey : null,
            'defaultRetroTemplateUnavailable' => $defaultKey !== null && ! $defaultIsAvailable,
            'categories' => TemplateCategory::options(),
            'catalogue' => Inertia::optional(fn (): array => $buildTemplateCatalogue->handle($workspace, $user, $team)),
        ]);
    }

    public function store(Request $request, Workspace $workspace, Team $team, RecordTeamActivity $recordTeamActivity): RedirectResponse
    {
        Gate::authorize('manageMembers', $team);

        $validated = $request->validate([
            'user_id' => [
                'required',
                'uuid',
                Rule::exists('workspace_user', 'user_id')->where('workspace_id', $workspace->id),
            ],
            'role' => ['nullable', Rule::enum(TeamRole::class)],
        ]);

        if ($team->members()->whereKey($validated['user_id'])->exists()) {
            return back();
        }

        DB::transaction(function () use ($team, $validated, $recordTeamActivity): void {
            $team->members()->attach($validated['user_id'], ['role' => $validated['role'] ?? TeamRole::Member->value]);

            $recordTeamActivity->handle($team->id, TeamActivityKind::MemberJoined, User::query()->whereKey($validated['user_id'])->firstOrFail());
        });

        return back();
    }

    public function destroy(Workspace $workspace, Team $team, User $member): RedirectResponse
    {
        Gate::authorize('manageMembers', $team);

        DB::transaction(function () use ($team, $member): void {
            $locked = Team::query()->whereKey($team->id)->lockForUpdate()->firstOrFail();

            if ($locked->defaultFacilitators()->detach($member->id) > 0) {
                $locked->update(['rotation_position' => 0]);
            }

            $locked->members()->detach($member->id);
        });

        return back();
    }
}
