<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\DetectJiraStoryPointFields;
use App\Actions\Integrations\PresentTeamIntegration;
use App\Enums\IntegrationProvider;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class JiraFieldDetectionsController extends Controller
{
    public function store(
        Workspace $workspace,
        Team $team,
        TeamIntegration $integration,
        DetectJiraStoryPointFields $detectStoryPointFields,
        PresentTeamIntegration $presentTeamIntegration,
    ): JsonResponse {
        Gate::authorize('manageIntegrations', $team);

        abort_unless($integration->provider === IntegrationProvider::Jira, 404);

        $integration->ensureActive();

        $detected = $detectStoryPointFields->handle($integration);

        return response()->json($presentTeamIntegration->handle($detected->load('connectedBy')));
    }
}
