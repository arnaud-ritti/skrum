<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\TrackedIssues;
use App\Enums\IntegrationProvider;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\Workspace;
use App\Support\Integrations\Trackers\Trackers;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Spec 8 §5.2, §7: the projects (Jira) or teams (Linear) holding tracked
 * issues, and the statuses one of them can be mapped to.
 */
class IntegrationStatusesController extends Controller
{
    public function index(Request $request, Workspace $workspace, Team $team, TeamIntegration $integration, TrackedIssues $trackedIssues, Trackers $trackers): JsonResponse
    {
        Gate::authorize('manageIntegrations', $team);

        abort_unless(in_array($integration->provider, [IntegrationProvider::Jira, IntegrationProvider::JiraDataCenter, IntegrationProvider::Linear], true), 404);

        $validated = $request->validate([
            'container' => ['sometimes', 'string', 'regex:'.TrackedIssues::ContainerKeyPattern],
        ]);

        $integration->ensureActive();

        if (! isset($validated['container'])) {
            return response()->json(['containers' => $trackedIssues->containerKeys($integration)]);
        }

        return response()->json([
            'statuses' => $trackers->syncing($integration->provider)->statuses($integration, (string) $validated['container']),
        ]);
    }
}
