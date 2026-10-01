<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\WebhookEvent;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Rules\OutgoingWebhookUrl;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\Webhook\WebhookHealth;
use Illuminate\Validation\Rule;

/**
 * A generic webhook: the URL and the signing secret are credentials; the
 * secret leaves the server only in the connect and rotate responses.
 */
class ConnectOutgoingWebhook
{
    private const SecretBytes = 32;

    public function __construct(
        private SaveTeamIntegration $saveTeamIntegration,
        private WebhookHealth $health,
    ) {}

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(bool $isUpdate = false): array
    {
        $url = ['required', 'string', 'max:2048', new OutgoingWebhookUrl];
        $rules = [
            'url' => $isUpdate ? ['bail', 'sometimes', ...$url] : ['bail', ...$url],
            'channel_label' => ['sometimes', 'nullable', 'string', 'max:'.ConnectUrlChannel::LabelMaxLength, 'regex:/^[^\p{Cc}]*$/u'],
        ];

        if (! $isUpdate) {
            return $rules;
        }

        return [
            ...$rules,
            'events' => ['sometimes', 'array'],
            'events.*' => ['required', 'string', 'distinct', Rule::in(WebhookEvent::values())],
            'enabled' => ['sometimes', 'accepted'],
        ];
    }

    public function handle(Team $team, User $user, string $url, ?string $channelLabel): TeamIntegration
    {
        $integration = $this->saveTeamIntegration->handle($team, IntegrationProvider::Webhook, $user, [
            'status' => IntegrationStatus::Active,
            'access' => IntegrationAccess::Write,
            'credentials' => ['url' => $url, 'webhookSecret' => self::newSecret()],
            'settings' => [
                'host' => self::host($url),
                'channelLabel' => ConnectUrlChannel::label($channelLabel),
                'secretCreatedAt' => now()->toIso8601ZuluString(),
                'events' => [],
            ],
            'scopes' => [],
        ]);

        $integration->forceFill(['consecutive_failures' => 0, 'last_delivery_succeeded_at' => null])->save();

        return $integration;
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    public function update(TeamIntegration $integration, array $validated): TeamIntegration
    {
        $settings = $integration->settings;

        if (array_key_exists('channel_label', $validated)) {
            $settings['channelLabel'] = ConnectUrlChannel::label(is_string($validated['channel_label']) ? $validated['channel_label'] : null);
        }

        if (is_array($validated['events'] ?? null)) {
            $settings['events'] = WebhookEvent::normalize($validated['events']);
        }

        $newUrl = is_string($validated['url'] ?? null) ? $validated['url'] : null;

        if ($newUrl !== null) {
            $integration->forceFill(['credentials' => [...$this->credentials($integration), 'url' => $newUrl]]);
            $settings['host'] = self::host($newUrl);
        }

        $integration->forceFill(['settings' => $settings])->save();

        $reactivate = $newUrl !== null || array_key_exists('enabled', $validated);

        if ($reactivate && ! $integration->isActive()) {
            $this->health->reenable($integration);
        }

        return $integration;
    }

    public function rotateSecret(TeamIntegration $integration): string
    {
        $secret = self::newSecret();

        $integration->forceFill([
            'credentials' => [...$this->credentials($integration), 'webhookSecret' => $secret],
            'settings' => [...$integration->settings, 'secretCreatedAt' => now()->toIso8601ZuluString()],
        ])->save();

        return $secret;
    }

    /**
     * @return array<string, mixed>
     */
    private function credentials(TeamIntegration $integration): array
    {
        return $integration->readableCredentials() ?? throw new ReconnectRequired(IntegrationProvider::Webhook, $integration->last_error);
    }

    private static function newSecret(): string
    {
        return bin2hex(random_bytes(self::SecretBytes));
    }

    private static function host(string $url): string
    {
        return strtolower((string) parse_url($url, PHP_URL_HOST));
    }
}
