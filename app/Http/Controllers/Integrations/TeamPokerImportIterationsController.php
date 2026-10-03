<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\ListPokerIterations;
use App\Actions\Integrations\ResolvePokerTracker;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\Workspace;
use App\Support\Integrations\TrackerBrowseLimit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class TeamPokerImportIterationsController extends Controller
{
    public function index(Request $request, Workspace $workspace, Team $team, string $source, ResolvePokerTracker $resolvePokerTracker, ListPokerIterations $listPokerIterations): JsonResponse
    {
        Gate::authorize('createPokerGame', $team);

        $validated = $request->validate([
            'container' => ['required', 'string', 'max:100'],
        ]);

        $integration = $resolvePokerTracker->handle($team, $source);

        TrackerBrowseLimit::hit($request->user()->id);

        return response()->json($listPokerIterations->iterations($integration, (string) $validated['container']));
    }
}
