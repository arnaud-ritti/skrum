<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\FindWebhookDelivery;
use App\Actions\Integrations\PresentWebhookDelivery;
use App\Actions\Integrations\PresentWebhookDeliveryPayload;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationProvider;
use App\Http\Controllers\Controller;
use App\Models\IntegrationDelivery;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

/**
 * The team's generic webhook log, across reconnections (spec 8 §4.7).
 */
class WebhookDeliveriesController extends Controller
{
    private const PerPage = 25;

    public function index(Workspace $workspace, Team $team, TeamIntegration $integration, PresentWebhookDelivery $presentWebhookDelivery): JsonResponse
    {
        Gate::authorize('manageIntegrations', $team);

        abort_unless($integration->provider === IntegrationProvider::Webhook, 404);

        $deliveries = IntegrationDelivery::query()
            ->withExists('payload')
            ->where('team_id', $team->id)
            ->where('channel', IntegrationDeliveryChannel::Webhook->value)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->paginate(self::PerPage);

        return response()->json([
            'data' => array_map($presentWebhookDelivery->handle(...), $deliveries->items()),
            'currentPage' => $deliveries->currentPage(),
            'lastPage' => $deliveries->lastPage(),
            'total' => $deliveries->total(),
        ]);
    }

    public function show(
        Workspace $workspace,
        Team $team,
        TeamIntegration $integration,
        string $delivery,
        FindWebhookDelivery $findWebhookDelivery,
        PresentWebhookDeliveryPayload $presentWebhookDeliveryPayload,
    ): JsonResponse {
        Gate::authorize('manageIntegrations', $team);

        abort_unless($integration->provider === IntegrationProvider::Webhook, 404);

        $found = $findWebhookDelivery->handle($team, $delivery);

        abort_if($found->payload === null, 404);

        return response()->json($presentWebhookDeliveryPayload->handle($found));
    }
}
