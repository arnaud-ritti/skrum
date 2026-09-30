<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\DisconnectIntegration;
use App\Actions\Integrations\PresentTeamIntegration;
use App\Actions\Integrations\UpdateTeamIntegration;
use App\Enums\IntegrationProvider;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\Workspace;
use App\Support\Integrations\Telegram\TelegramBot;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as EmptyResponse;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class TeamIntegrationsController extends Controller
{
    public function __construct(private PresentTeamIntegration $presentTeamIntegration) {}

    public function index(Workspace $workspace, Team $team, TelegramBot $telegramBot): Response
    {
        Gate::authorize('manageIntegrations', $team);

        $integrations = $team->integrations()->with('connectedBy')->get()
            ->keyBy(fn (TeamIntegration $integration): string => $integration->provider->value);

        return Inertia::render('teams/integrations', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'team' => $team->only(['id', 'name']),
            'providers' => array_map(function (IntegrationProvider $provider) use ($integrations): array {
                $integration = $integrations->get($provider->value);

                return [
                    'provider' => $provider->value,
                    'label' => $provider->label(),
                    'usesOAuth' => $provider->usesOAuth(),
                    'isTracker' => $provider->isTracker(),
                    'connection' => $integration === null ? null : $this->presentTeamIntegration->handle($integration),
                ];
            }, IntegrationProvider::enabled()),
            'telegram' => IntegrationProvider::Telegram->isEnabled() ? [
                'botUsername' => $telegramBot->username(),
                'conflict' => $telegramBot->hasConflict(),
            ] : null,
        ]);
    }

    public function update(Request $request, Workspace $workspace, Team $team, TeamIntegration $integration, UpdateTeamIntegration $updateTeamIntegration): JsonResponse
    {
        Gate::authorize('manageIntegrations', $team);

        $validated = $request->validate($updateTeamIntegration->rules($integration));

        $updated = $updateTeamIntegration->handle($integration, $request->user(), $validated);

        return response()->json($this->presentTeamIntegration->handle($updated->load('connectedBy')));
    }

    public function destroy(Workspace $workspace, Team $team, TeamIntegration $integration, DisconnectIntegration $disconnectIntegration): EmptyResponse
    {
        Gate::authorize('manageIntegrations', $team);

        $disconnectIntegration->handle($integration);

        return response()->noContent();
    }
}
