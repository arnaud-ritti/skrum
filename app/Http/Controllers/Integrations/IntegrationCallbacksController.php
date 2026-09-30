<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\OAuthConnectors;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Support\Integrations\Exceptions\ConnectionRefused;
use App\Support\Integrations\Exceptions\IntegrationException;
use App\Support\Integrations\OAuthState;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

class IntegrationCallbacksController extends Controller
{
    public function __construct(private OAuthState $oauthState, private OAuthConnectors $connectors) {}

    public function show(Request $request, IntegrationProvider $provider): RedirectResponse
    {
        $stored = $request->session()->get(OAuthState::SessionKey);
        $state = $this->oauthState->consume($request, $provider, $request->query('state'));
        $teamId = $state['teamId'] ?? (is_array($stored) && is_string($stored['teamId'] ?? null) ? $stored['teamId'] : null);
        $team = $teamId === null ? null : Team::query()->with('workspace')->find($teamId);

        if ($team === null || $request->user()->cannot('manageIntegrations', $team)) {
            return $this->failed($provider, null);
        }

        if ($state === null) {
            return $this->failed($provider, $team);
        }

        $code = $request->query('code');

        if ($request->has('error') || ! is_string($code) || $code === '') {
            return $this->failed($provider, $team);
        }

        try {
            $integration = $this->connectors->for($provider)->connect($team, $request->user(), $state['access'], $code);
        } catch (ConnectionRefused $exception) {
            return $this->failed($provider, $team, $exception->getMessage());
        } catch (IntegrationException) {
            return $this->failed($provider, $team);
        }

        Inertia::flash('toast', $integration->status === IntegrationStatus::SetupRequired
            ? ['type' => 'info', 'message' => __('Choose a Jira site to finish connecting.')]
            : ['type' => 'success', 'message' => __(':provider connected.', ['provider' => $provider->label()])]);

        return to_route('teams.integrations.index', [$team->workspace, $team]);
    }

    private function failed(IntegrationProvider $provider, ?Team $team, ?string $message = null): RedirectResponse
    {
        Inertia::flash('toast', [
            'type' => 'error',
            'message' => $message ?? __('Could not connect :provider. Try again.', ['provider' => $provider->label()]),
        ]);

        return $team === null
            ? to_route('dashboard')
            : to_route('teams.integrations.index', [$team->workspace, $team]);
    }
}
