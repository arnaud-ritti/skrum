<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\IntegrationMappingGuard;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\Workspace;
use App\Support\Integrations\ExternalAccount;
use App\Support\Integrations\IntegrationUserAccounts;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

class IntegrationAccountsController extends Controller
{
    public function index(Request $request, Workspace $workspace, Team $team, TeamIntegration $integration, IntegrationUserAccounts $accounts): JsonResponse
    {
        Gate::authorize('manageIntegrations', $team);

        IntegrationMappingGuard::ensureMappable($integration);

        $validated = $request->validate(['q' => ['required', 'string', 'min:2', 'max:100']]);

        return response()->json(array_map(
            fn (ExternalAccount $account): array => $account->toArray(),
            $accounts->search($integration, $validated['q']),
        ));
    }
}
