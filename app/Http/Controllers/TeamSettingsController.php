<?php

namespace App\Http\Controllers;

use App\Actions\Teams\TeamSettingsSections;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class TeamSettingsController extends Controller
{
    public function show(Request $request, Workspace $workspace, Team $team, TeamSettingsSections $sections): Response
    {
        Gate::authorize('update', $team);

        return Inertia::render('teams/settings', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'team' => [
                ...$team->only(['id', 'name', 'description', 'slug']),
                'address' => route('teamAddresses.show', $team->slug),
            ],
            'createdAt' => $team->created_at?->toIso8601String(),
            'membersCount' => $team->members()->count(),
            'canDelete' => $request->user()->can('delete', $team),
            'sections' => $sections->handle($request->user(), $team),
        ]);
    }
}
