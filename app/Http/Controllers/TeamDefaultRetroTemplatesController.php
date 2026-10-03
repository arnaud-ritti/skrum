<?php

namespace App\Http\Controllers;

use App\Http\Requests\Teams\TeamDefaultRetroTemplateRequest;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

class TeamDefaultRetroTemplatesController extends Controller
{
    public function update(TeamDefaultRetroTemplateRequest $request, Workspace $workspace, Team $team): RedirectResponse
    {
        $team->update(['default_retro_template' => $request->template()]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Default template saved.')]);

        return back();
    }
}
