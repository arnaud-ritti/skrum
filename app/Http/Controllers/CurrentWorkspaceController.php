<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class CurrentWorkspaceController extends Controller
{
    public function show(Request $request): RedirectResponse
    {
        $user = $request->user();

        $workspace = $user->workspaces()->whereKey($user->current_workspace_id)->first()
            ?? $user->workspaces()->orderBy('name')->first();

        if ($workspace === null) {
            return to_route('workspaces.create');
        }

        return to_route('workspaces.show', $workspace);
    }
}
