<?php

namespace App\Support\Integrations\MicrosoftTeams;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Rules\MicrosoftTeamsWebhookUrl;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\ProviderHttp;

class MicrosoftTeamsClient
{
    /**
     * @var array<int, int>
     */
    private const array LostWorkflowStatuses = [400, 401, 403, 404];

    /**
     * @param  array<string, mixed>  $message
     */
    public function postMessage(TeamIntegration $integration, array $message): void
    {
        $integration->withReconnectHandling(function () use ($integration, $message): void {
            $url = $this->workflowUrl($integration);

            $response = ProviderHttp::send(
                IntegrationProvider::MicrosoftTeams,
                fn () => ProviderHttp::request()->withoutRedirecting()->post($url, $message),
            );

            if ($response->successful()) {
                return;
            }

            if (in_array($response->status(), self::LostWorkflowStatuses, true)) {
                throw $this->lostWorkflow();
            }

            ProviderHttp::fail(IntegrationProvider::MicrosoftTeams, $response);
        });
    }

    public function ensureUsableUrl(TeamIntegration $integration): void
    {
        $integration->withReconnectHandling(fn (): string => $this->workflowUrl($integration));
    }

    private function workflowUrl(TeamIntegration $integration): string
    {
        $url = $integration->credential('url');

        if (! is_string($url) || ! MicrosoftTeamsWebhookUrl::isValid($url)) {
            throw $this->lostWorkflow();
        }

        return $url;
    }

    private function lostWorkflow(): ReconnectRequired
    {
        return new ReconnectRequired(IntegrationProvider::MicrosoftTeams, __('The Teams workflow URL no longer works. Paste a new one.'));
    }
}
