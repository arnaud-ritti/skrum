<?php

namespace App\Http\Controllers\Integrations;

use App\Actions\Integrations\CheckIntegration;
use App\Actions\Integrations\PresentTeamIntegration;
use App\Enums\IntegrationProvider;
use App\Http\Controllers\Controller;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\Workspace;
use App\Support\Integrations\Mattermost\MattermostClient;
use App\Support\Integrations\Messages\MattermostText;
use App\Support\Integrations\Messages\MicrosoftTeamsText;
use App\Support\Integrations\MicrosoftTeams\MicrosoftTeamsClient;
use App\Support\Integrations\Slack\SlackClient;
use App\Support\Integrations\Telegram\TelegramClient;
use App\Support\Integrations\Webhook\WebhookClient;
use App\Support\Integrations\Webhook\WebhookMessage;
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
        MicrosoftTeamsClient $teams,
        MattermostClient $mattermost,
        WebhookClient $webhooks,
        CheckIntegration $checkIntegration,
        PresentTeamIntegration $presentTeamIntegration,
    ): JsonResponse {
        Gate::authorize('manageIntegrations', $team);

        if ($integration->provider !== IntegrationProvider::Webhook) {
            $integration->ensureActive();
        }

        $message = __('skrum is connected.');

        $test = match ($integration->provider) {
            IntegrationProvider::Slack => fn () => $slack->postMessage($integration, ['text' => $message]),
            IntegrationProvider::Telegram => fn () => $telegram->sendMessageTo($integration, e($message)),
            IntegrationProvider::Jira, IntegrationProvider::Linear, IntegrationProvider::JiraDataCenter, IntegrationProvider::GitHub => fn () => $checkIntegration->handle($integration),
            IntegrationProvider::MicrosoftTeams => fn () => $teams->postMessage($integration, MicrosoftTeamsText::message([MicrosoftTeamsText::block($message)])),
            IntegrationProvider::Mattermost => fn () => $mattermost->postMessage($integration, MattermostText::escape($message)),
            IntegrationProvider::Webhook => fn () => $webhooks->send($integration, WebhookMessage::test()),
        };

        $test();

        if ($integration->provider->isChannel() && $integration->isActive()) {
            $integration->markChecked();
        }

        return response()->json($presentTeamIntegration->handle($integration->refresh()->load('connectedBy')));
    }
}
