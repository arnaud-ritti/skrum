<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\IntegrationMappingGuard;
use App\Actions\Integrations\PresentIntegrationUserMappings;
use App\Actions\Integrations\SaveIntegrationUserMapping;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

/**
 * `{user}` is read as a plain id: a scoped binding would look for a
 * users() relation on the integration.
 */
class IntegrationUserMappingsController extends Controller
{
    public function __construct(private PresentIntegrationUserMappings $presentMappings) {}

    public function index(Workspace $workspace, Team $team, TeamIntegration $integration): JsonResponse
    {
        Gate::authorize('manageIntegrations', $team);

        IntegrationMappingGuard::ensureMappable($integration);

        return response()->json($this->presentMappings->handle($integration));
    }

    public function update(Request $request, Workspace $workspace, Team $team, TeamIntegration $integration, string $user, SaveIntegrationUserMapping $saveMapping): JsonResponse
    {
        Gate::authorize('manageIntegrations', $team);

        IntegrationMappingGuard::ensureMappable($integration);

        $validated = $request->validate([
            'external_account_id' => ['present', 'nullable', 'string', 'max:128'],
        ]);

        $member = $this->member($team, $user);
        $mapping = $saveMapping->handle($integration, $member, $validated['external_account_id']);

        return response()->json($this->presentMappings->member($member, $mapping));
    }

    public function destroy(Workspace $workspace, Team $team, TeamIntegration $integration, string $user): Response
    {
        Gate::authorize('manageIntegrations', $team);

        IntegrationMappingGuard::ensureMappable($integration);

        $member = $this->member($team, $user);

        $integration->userMappings()->where('user_id', $member->id)->delete();

        return response()->noContent();
    }

    private function member(Team $team, string $userId): User
    {
        $member = $team->members()->whereKey($userId)->first();

        if ($member === null) {
            throw ValidationException::withMessages(['user' => __('This person is not a member of the team.')]);
        }

        return $member;
    }
}
