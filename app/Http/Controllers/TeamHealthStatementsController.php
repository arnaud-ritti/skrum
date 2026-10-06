<?php

namespace App\Http\Controllers;

use App\Actions\HealthCheck\ManageTeamHealthStatements;
use App\Actions\HealthCheck\PresentTeamHealthStatements;
use App\Actions\Teams\TeamSettingsSections;
use App\Models\Team;
use App\Models\Workspace;
use App\Support\Teams\TeamMark;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class TeamHealthStatementsController extends Controller
{
    public function __construct(private ManageTeamHealthStatements $manageTeamHealthStatements) {}

    public function index(Request $request, Workspace $workspace, Team $team, PresentTeamHealthStatements $presentTeamHealthStatements, TeamSettingsSections $sections): Response
    {
        Gate::authorize('manageRituals', $team);

        $user = $request->user();

        return Inertia::render('teams/health-statements', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'team' => [
                ...$team->only(['id', 'name', 'description', 'slug']),
                'color' => TeamMark::colorFor($team)->value,
            ],
            'createdAt' => $team->created_at?->toIso8601String(),
            'sections' => $sections->handle($user, $team),
            'healthStatements' => $presentTeamHealthStatements->handle($team),
            'canManageHealthStatements' => $user->can('update', $team),
        ]);
    }

    public function store(Request $request, Workspace $workspace, Team $team): RedirectResponse
    {
        Gate::authorize('update', $team);

        $validated = $request->validate($this->rules());

        $this->manageTeamHealthStatements->add($team, $validated['text'], $validated['label']);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Statement added.')]);

        return back();
    }

    public function update(Request $request, Workspace $workspace, Team $team, string $statement): RedirectResponse
    {
        Gate::authorize('update', $team);

        $validated = $request->validate($this->rules());

        $this->manageTeamHealthStatements->reword($team, $statement, $validated['text'], $validated['label']);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Statement updated.')]);

        return back();
    }

    /**
     * @return array<string, array<int, string>>
     */
    private function rules(): array
    {
        return [
            'text' => ['required', 'string', 'max:150'],
            'label' => ['required', 'string', 'max:30'],
        ];
    }
}
