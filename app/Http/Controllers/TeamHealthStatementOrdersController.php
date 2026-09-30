<?php

namespace App\Http\Controllers;

use App\Actions\HealthCheck\ManageTeamHealthStatements;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

class TeamHealthStatementOrdersController extends Controller
{
    public function update(Request $request, Workspace $workspace, Team $team, ManageTeamHealthStatements $manageTeamHealthStatements): RedirectResponse
    {
        Gate::authorize('update', $team);

        $validated = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['required', 'string', 'max:64'],
        ]);

        $manageTeamHealthStatements->reorder($team, $validated['ids']);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Statements reordered.')]);

        return back();
    }
}
