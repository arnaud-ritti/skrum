<?php

namespace App\Http\Controllers;

use App\Actions\Teams\TeamSettingsSections;
use App\Enums\TeamSurveyStatus;
use App\Models\Team;
use App\Models\TeamSurvey;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class TeamDataController extends Controller
{
    public const int MaxSurveys = 50;

    public function show(Request $request, Workspace $workspace, Team $team, TeamSettingsSections $sections): Response
    {
        Gate::authorize('update', $team);

        $user = $request->user();

        return Inertia::render('teams/data', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'team' => $team->only(['id', 'name', 'description']),
            'sections' => $sections->handle($user, $team),
            'closedSurveys' => $team->teamSurveys()
                ->whereNull('retro_id')
                ->where('status', TeamSurveyStatus::Closed->value)
                ->unless($user->canManage($workspace), fn (Builder $surveys) => $surveys->where('created_by_user_id', $user->id))
                ->latest('closed_at')
                ->orderByDesc('id')
                ->limit(self::MaxSurveys)
                ->get(['id', 'title', 'closed_at'])
                ->map(fn (TeamSurvey $survey): array => [
                    'id' => $survey->id,
                    'title' => $survey->title,
                    'closedAt' => $survey->closed_at?->toIso8601String(),
                    'exportUrl' => route('surveys.export.show', $survey),
                ]),
            'estimatesUrl' => route('teams.estimates.index', [$workspace, $team]),
            'actionItemsUrl' => route('workspaces.actionItems.index', ['workspace' => $workspace, 'team' => $team->id]),
        ]);
    }
}
