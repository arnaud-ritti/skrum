<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\IntegrationMappingGuard;
use App\Http\Controllers\Controller;
use App\Jobs\MatchIntegrationUsers;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class IntegrationUserMatchesController extends Controller
{
    public function store(Workspace $workspace, Team $team, TeamIntegration $integration): JsonResponse
    {
        Gate::authorize('manageIntegrations', $team);

        IntegrationMappingGuard::ensureMappable($integration);

        MatchIntegrationUsers::start($integration);

        return response()->json(['matching' => true], 202);
    }
}
