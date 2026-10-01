<?php

namespace App\Support\Integrations\Mattermost;

use App\Enums\IntegrationProvider;
use App\Exceptions\Integrations\ReconnectRequired;
use App\Models\TeamIntegration;
use App\Rules\MattermostWebhookUrl;
use App\Support\Integrations\ProviderHttp;
use Illuminate\Http\Client\Response;

class MattermostClient
{
    /**
     * @var array<int, int>
     */
    private const array LostWebhookStatuses = [403, 404];

    public function postMessage(TeamIntegration $integration, string $text): void
    {
        $integration->withReconnectHandling(function () use ($integration, $text): void {
            $url = $this->webhookUrl($integration);

            $response = ProviderHttp::send(
                IntegrationProvider::Mattermost,
                fn () => ProviderHttp::request()->withoutRedirecting()->post($url, ['text' => $text]),
            );

            if ($response->successful()) {
                return;
            }

            if ($this->isLostWebhook($response)) {
                throw $this->lostWebhook();
            }

            ProviderHttp::fail(IntegrationProvider::Mattermost, $response);
        });
    }

    public function ensureUsableUrl(TeamIntegration $integration): void
    {
        $integration->withReconnectHandling(fn (): string => $this->webhookUrl($integration));
    }

    private function webhookUrl(TeamIntegration $integration): string
    {
        $url = $integration->credential('url');

        if (! is_string($url) || ! MattermostWebhookUrl::isValid($url)) {
            throw $this->lostWebhook();
        }

        return $url;
    }

    private function isLostWebhook(Response $response): bool
    {
        if (in_array($response->status(), self::LostWebhookStatuses, true)) {
            return true;
        }

        return $response->status() === 400 && str_contains(strtolower($response->body()), 'invalid webhook');
    }

    private function lostWebhook(): ReconnectRequired
    {
        return new ReconnectRequired(IntegrationProvider::Mattermost, __('The Mattermost webhook no longer works. Paste a new one.'));
    }
}
