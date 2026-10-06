<?php

namespace App\Http\Controllers;

use App\Actions\Retros\BuildTemplateCatalogue;
use App\Actions\Retros\TemplateAvailability;
use App\Actions\Teams\SuggestedFacilitator;
use App\Actions\Teams\TeamSettingsSections;
use App\Actions\Teams\TeamTemplateUsage;
use App\Enums\TeamRole;
use App\Enums\TemplateCategory;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Support\Alphabetical;
use App\Support\Teams\SprintCalendar;
use App\Support\Teams\TeamMark;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class TeamRetroSettingsController extends Controller
{
    public function show(
        Request $request,
        Workspace $workspace,
        Team $team,
        TeamTemplateUsage $teamTemplateUsage,
        SuggestedFacilitator $suggestedFacilitator,
        TemplateAvailability $templateAvailability,
        BuildTemplateCatalogue $buildTemplateCatalogue,
        TeamSettingsSections $sections,
    ): Response {
        Gate::authorize('manageRituals', $team);

        $user = $request->user();
        $now = now();
        $defaultKey = $team->default_retro_template;
        $defaultIsAvailable = $defaultKey !== null && $templateAvailability->isAvailable($team, $user, $defaultKey);
        $person = fn (User $member): array => [...$member->only(['id', 'name']), 'avatarUrl' => $member->avatarUrl()];

        return Inertia::render('teams/retro-settings', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'team' => [
                ...$team->only(['id', 'name', 'description', 'slug']),
                'color' => TeamMark::colorFor($team)->value,
            ],
            'createdAt' => $team->created_at?->toIso8601String(),
            'sections' => $sections->handle($user, $team),
            'nextRetro' => SprintCalendar::fromToday($team, $now)->nextRetro($now),
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
}
