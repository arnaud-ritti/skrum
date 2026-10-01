<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\ConnectOutgoingWebhook;
use App\Actions\Integrations\ConnectUrlChannel;
use App\Actions\Integrations\PresentTeamIntegration;
use App\Enums\IntegrationProvider;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class IntegrationUrlsController extends Controller
{
    public function store(
        Request $request,
        Workspace $workspace,
        Team $team,
        IntegrationProvider $provider,
        ConnectUrlChannel $connectUrlChannel,
        ConnectOutgoingWebhook $connectOutgoingWebhook,
        PresentTeamIntegration $presentTeamIntegration,
    ): JsonResponse {
        Gate::authorize('manageIntegrations', $team);

        if ($provider === IntegrationProvider::Webhook) {
            $validated = $request->validate($connectOutgoingWebhook->rules());
            $integration = $connectOutgoingWebhook->handle($team, $request->user(), $validated['url'], $validated['channel_label'] ?? null);

            return response()->json([
                ...$presentTeamIntegration->handle($integration->load('connectedBy')),
                'secret' => $integration->credential('webhookSecret'),
            ], 201);
        }

        $validated = $request->validate($connectUrlChannel->rules($provider));

        $integration = $connectUrlChannel->handle(
            $team,
            $provider,
            $request->user(),
            $validated['url'],
            $validated['channel_label'] ?? null,
        );

        return response()->json($presentTeamIntegration->handle($integration->load('connectedBy')), 201);
    }
}
