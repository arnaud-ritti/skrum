<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\ConnectOutgoingWebhook;
use App\Enums\IntegrationProvider;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class WebhookSecretsController extends Controller
{
    public function store(Workspace $workspace, Team $team, TeamIntegration $integration, ConnectOutgoingWebhook $connectOutgoingWebhook): JsonResponse
    {
        Gate::authorize('manageIntegrations', $team);

        abort_unless($integration->provider === IntegrationProvider::Webhook, 404);

        return response()->json(['secret' => $connectOutgoingWebhook->rotateSecret($integration)])->header('Cache-Control', 'no-store, private');
    }
}
