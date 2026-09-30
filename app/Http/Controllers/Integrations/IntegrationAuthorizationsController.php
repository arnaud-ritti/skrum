<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\OAuthConnectors;
use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\Workspace;
use App\Support\Integrations\OAuthState;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class IntegrationAuthorizationsController extends Controller
{
    public function __construct(private OAuthState $oauthState, private OAuthConnectors $connectors) {}

    public function create(Request $request, Workspace $workspace, Team $team, IntegrationProvider $provider): RedirectResponse
    {
        Gate::authorize('manageIntegrations', $team);

        $validated = $request->validate([
            'access' => ['sometimes', Rule::enum(IntegrationAccess::class)],
        ]);

        $access = $provider->isTracker()
            ? IntegrationAccess::from($validated['access'] ?? IntegrationAccess::Read->value)
            : IntegrationAccess::Write;

        $state = $this->oauthState->issue($request, $provider, $team, $access);

        return redirect()->away($this->connectors->for($provider)->authorizationUrl($state, $access));
    }
}
