<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\IntegrationMappingGuard;
use App\Actions\Integrations\ListProviderPriorities;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class IntegrationPrioritiesController extends Controller
{
    public function index(Workspace $workspace, Team $team, TeamIntegration $integration, ListProviderPriorities $listPriorities): JsonResponse
    {
        Gate::authorize('manageIntegrations', $team);

        IntegrationMappingGuard::ensureTracker($integration);

        return response()->json($listPriorities->handle($integration));
    }
}
