<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\IntegrationMappingGuard;
use App\Actions\Integrations\ListExportTargets;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class IntegrationTargetsController extends Controller
{
    public function index(Request $request, Workspace $workspace, Team $team, TeamIntegration $integration, ListExportTargets $listTargets): JsonResponse
    {
        Gate::authorize('view', $team);

        abort_if($request->user()?->isObserverOf($team) ?? true, 403);

        IntegrationMappingGuard::ensureTracker($integration);

        $validated = $request->validate([
            'project_id' => ['nullable', 'string', 'regex:/^\d{1,20}$/'],
            'q' => ['nullable', 'string', 'max:100'],
        ]);

        return response()->json($listTargets->handle($integration, $validated['project_id'] ?? null, $validated['q'] ?? null));
    }
}
