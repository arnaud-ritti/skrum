<?php

namespace App\Http\Controllers;

use App\Actions\HealthCheck\ManageTeamHealthStatements;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

class TeamHealthStatementArchivalsController extends Controller
{
    public function __construct(private ManageTeamHealthStatements $manageTeamHealthStatements) {}

    public function update(Workspace $workspace, Team $team, string $statement): RedirectResponse
    {
        Gate::authorize('update', $team);

        $this->manageTeamHealthStatements->archive($team, $statement);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Statement disabled.')]);

        return back();
    }

    public function destroy(Workspace $workspace, Team $team, string $statement): RedirectResponse
    {
        Gate::authorize('update', $team);

        $this->manageTeamHealthStatements->restore($team, $statement);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Statement enabled.')]);

        return back();
    }
}
