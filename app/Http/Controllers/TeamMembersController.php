<?php

namespace App\Http\Controllers;

use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class TeamMembersController extends Controller
{
    public function store(Request $request, Workspace $workspace, Team $team): RedirectResponse
    {
        Gate::authorize('manageMembers', $team);

        $validated = $request->validate([
            'user_id' => [
                'required',
                'uuid',
                Rule::exists('workspace_user', 'user_id')->where('workspace_id', $workspace->id),
            ],
        ]);

        $team->members()->syncWithoutDetaching([$validated['user_id']]);

        return back();
    }

    public function destroy(Workspace $workspace, Team $team, User $member): RedirectResponse
    {
        Gate::authorize('manageMembers', $team);

        $team->members()->detach($member);

        return back();
    }
}
