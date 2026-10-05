<?php

namespace App\Http\Controllers;

use App\Actions\HealthCheck\PresentTeamHealthStatements;
use App\Actions\Retros\BuildTemplateCatalogue;
use App\Actions\Retros\TemplateAvailability;
use App\Actions\Teams\PresentTeamSprints;
use App\Actions\Teams\SuggestedFacilitator;
use App\Actions\Teams\TeamSettingsSections;
use App\Actions\Teams\TeamTemplateUsage;
use App\Enums\TeamRole;
use App\Enums\TemplateCategory;
use App\Http\Requests\Teams\TeamRitualsRequest;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Support\Alphabetical;
use App\Support\Teams\TeamMark;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class TeamRitualsController extends Controller
{
    public function show(
        Request $request,
        Workspace $workspace,
        Team $team,
        TeamTemplateUsage $teamTemplateUsage,
        PresentTeamSprints $presentTeamSprints,
        SuggestedFacilitator $suggestedFacilitator,
        TemplateAvailability $templateAvailability,
        BuildTemplateCatalogue $buildTemplateCatalogue,
        TeamSettingsSections $sections,
        PresentTeamHealthStatements $presentTeamHealthStatements,
    ): Response {
        Gate::authorize('manageRituals', $team);

        $user = $request->user();
        $defaultKey = $team->default_retro_template;
        $defaultIsAvailable = $defaultKey !== null && $templateAvailability->isAvailable($team, $user, $defaultKey);
        $person = fn (User $member): array => [...$member->only(['id', 'name']), 'avatarUrl' => $member->avatarUrl()];

        return Inertia::render('teams/rituals', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'team' => [
                ...$team->only(['id', 'name', 'description', 'slug']),
                'color' => TeamMark::colorFor($team)->value,
            ],
            'createdAt' => $team->created_at?->toIso8601String(),
            'sections' => $sections->handle($user, $team),
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
            'healthStatements' => $presentTeamHealthStatements->handle($team),
            'canManageHealthStatements' => $user->can('update', $team),
        ]);
    }

    public function update(TeamRitualsRequest $request, Workspace $workspace, Team $team): RedirectResponse
    {
        $team->update($request->rituals());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Rituals saved.')]);

        return back();
    }
}
