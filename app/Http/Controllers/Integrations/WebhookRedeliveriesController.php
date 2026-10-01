<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\FindWebhookDelivery;
use App\Actions\Integrations\PresentWebhookDelivery;
use App\Actions\Integrations\RequestWebhookRedelivery;
use App\Enums\IntegrationProvider;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Sends a past generic webhook delivery again (webhook redelivery spec §4.2).
 */
class WebhookRedeliveriesController extends Controller
{
    public function store(
        Request $request,
        Workspace $workspace,
        Team $team,
        TeamIntegration $integration,
        string $delivery,
        FindWebhookDelivery $findWebhookDelivery,
        RequestWebhookRedelivery $requestWebhookRedelivery,
        PresentWebhookDelivery $presentWebhookDelivery,
    ): JsonResponse {
        Gate::authorize('manageIntegrations', $team);

        abort_unless($integration->provider === IntegrationProvider::Webhook, 404);

        $redelivery = $requestWebhookRedelivery->handle($integration, $findWebhookDelivery->handle($team, $delivery), $request->user());

        return response()->json($presentWebhookDelivery->handle($redelivery), 202);
    }
}
