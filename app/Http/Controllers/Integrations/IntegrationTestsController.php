<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\CheckIntegration;
use App\Actions\Integrations\PresentTeamIntegration;
use App\Enums\IntegrationProvider;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\Workspace;
use App\Support\Integrations\Slack\SlackClient;
use App\Support\Integrations\Telegram\TelegramClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Gate;

class IntegrationTestsController extends Controller
{
    public function store(
        Workspace $workspace,
        Team $team,
        TeamIntegration $integration,
        SlackClient $slack,
        TelegramClient $telegram,
        CheckIntegration $checkIntegration,
        PresentTeamIntegration $presentTeamIntegration,
    ): JsonResponse {
        Gate::authorize('manageIntegrations', $team);

        $integration->ensureActive();

        $message = __('skrum is connected.');

        $test = match ($integration->provider) {
            IntegrationProvider::Slack => fn () => $slack->postMessage($integration, ['text' => $message]),
            IntegrationProvider::Telegram => fn () => $telegram->sendMessageTo($integration, e($message)),
            IntegrationProvider::Jira, IntegrationProvider::Linear => fn () => $checkIntegration->handle($integration),
        };

        $test();

        if ($integration->provider->isChannel()) {
            $integration->markChecked();
        }

        return response()->json($presentTeamIntegration->handle($integration->refresh()->load('connectedBy')));
    }
}
