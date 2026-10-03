<?php

namespace App\Http\Controllers;

use App\Actions\Teams\StartNextSprint;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

class TeamSprintStartsController extends Controller
{
    public function store(Workspace $workspace, Team $team, StartNextSprint $startNextSprint): RedirectResponse
    {
        Gate::authorize('manageRituals', $team);

        $sprint = $startNextSprint->handle($team, now());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Sprint :number started.', ['number' => $sprint->number])]);

        return back();
    }
}
