<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\PresentTeamIntegration;
use App\Enums\IntegrationProvider;
use App\Http\Controllers\Controller;
use App\Jobs\Integrations\RegisterTrackerWebhooks;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\Workspace;
use App\Support\Integrations\InboundModes;
use App\Support\Integrations\StatusSync;
use App\Support\Integrations\TrackerWebhooks;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Spec 8 §4.1, §7: the Jira Data Center manual registration details (the
 * only response carrying the URL token and secret, never cached), the
 * "I've registered it" confirmation and on-demand (re)registration.
 */
class TrackerWebhooksController extends Controller
{
    public function __construct(
        private TrackerWebhooks $webhooks,
        private InboundModes $inboundModes,
        private PresentTeamIntegration $presentTeamIntegration,
    ) {}

    public function show(Workspace $workspace, Team $team, TeamIntegration $integration): JsonResponse
    {
        Gate::authorize('manageIntegrations', $team);

        abort_unless($integration->provider === IntegrationProvider::JiraDataCenter, 404);

        $integration->ensureActive();

        return response()->json($this->webhooks->manualDetails($integration))->header('Cache-Control', 'no-store, private');
    }

    public function store(Request $request, Workspace $workspace, Team $team, TeamIntegration $integration): JsonResponse
    {
        Gate::authorize('manageIntegrations', $team);

        abort_unless(in_array($integration->provider, [IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter], true), 404);

        $request->validate([
            'registered' => $integration->provider === IntegrationProvider::JiraDataCenter ? ['sometimes', 'accepted'] : ['prohibited'],
        ]);

        $integration->ensureActive();

        $label = ['provider' => $integration->provider->label()];

        if (! StatusSync::isOn($integration)) {
            abort(409, __('Turn on status sync for :provider first.', $label));
        }

        if (! $this->inboundModes->acceptsWebhooks($integration->provider)) {
            abort(409, __("This skrum instance can't receive webhooks; it checks :provider regularly instead.", $label));
        }

        if ($request->boolean('registered')) {
            $integration = $this->webhooks->confirmManual($integration);
        } else {
            RegisterTrackerWebhooks::dispatch($integration->id);
        }

        return response()->json($this->presentTeamIntegration->handle($integration->load('connectedBy')), 202);
    }
}
