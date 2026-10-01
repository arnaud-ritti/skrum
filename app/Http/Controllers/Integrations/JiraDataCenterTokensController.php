<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\ConnectJiraDataCenterToken;
use App\Actions\Integrations\PresentTeamIntegration;
use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\Workspace;
use App\Support\Integrations\JiraDataCenter\JiraDataCenterClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class JiraDataCenterTokensController extends Controller
{
    public function store(
        Request $request,
        Workspace $workspace,
        Team $team,
        ConnectJiraDataCenterToken $connectToken,
        PresentTeamIntegration $presentTeamIntegration,
    ): JsonResponse {
        Gate::authorize('manageIntegrations', $team);

        abort_unless(in_array(JiraDataCenterClient::AuthMethodToken, IntegrationProvider::JiraDataCenter->authMethods(), true), 404);

        $validated = $request->validate(ConnectJiraDataCenterToken::rules());

        $integration = $connectToken->handle(
            $team,
            $request->user(),
            trim((string) $validated['token']),
            IntegrationAccess::from($validated['access']),
        );

        return response()->json($presentTeamIntegration->handle($integration->load('connectedBy')), 201);
    }
}
