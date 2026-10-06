<?php

namespace App\Http\Controllers;

use App\Http\Requests\Teams\TeamRitualsRequest;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

class TeamRitualsController extends Controller
{
    public function update(TeamRitualsRequest $request, Workspace $workspace, Team $team): RedirectResponse
    {
        $team->update($request->rituals());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Rituals saved.')]);

        return back();
    }
}
