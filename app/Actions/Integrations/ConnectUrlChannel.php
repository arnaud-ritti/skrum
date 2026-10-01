<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Rules\MattermostWebhookUrl;
use App\Rules\MicrosoftTeamsWebhookUrl;
use Illuminate\Contracts\Validation\ValidationRule;
use InvalidArgumentException;

/**
 * Teams and Mattermost connect with a pasted webhook URL (spec 8 §4.3, §4.4).
 * The URL is a secret: only its host and the admin's label are shown.
 */
class ConnectUrlChannel
{
    public const LabelMaxLength = 80;

    public function __construct(private SaveTeamIntegration $saveTeamIntegration) {}

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(IntegrationProvider $provider, bool $isUpdate = false): array
    {
        $url = ['required', 'string', 'max:2048', $this->urlRule($provider)];

        return [
            'url' => $isUpdate ? ['sometimes', ...$url] : $url,
            'channel_label' => ['sometimes', 'nullable', 'string', 'max:'.self::LabelMaxLength, 'regex:/^[^\p{Cc}]*$/u'],
        ];
    }

    public function handle(Team $team, IntegrationProvider $provider, User $user, string $url, ?string $channelLabel): TeamIntegration
    {
        return $this->saveTeamIntegration->handle($team, $provider, $user, [
            'status' => IntegrationStatus::Active,
            'access' => IntegrationAccess::Write,
            'credentials' => ['url' => $url],
            'settings' => [
                'host' => self::host($url),
                'channelLabel' => self::label($channelLabel),
            ],
            'scopes' => [],
        ]);
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    public function update(TeamIntegration $integration, User $user, array $validated): TeamIntegration
    {
        $label = array_key_exists('channel_label', $validated)
            ? $validated['channel_label']
            : $integration->setting('channelLabel');
        $label = is_string($label) ? $label : null;

        if (is_string($validated['url'] ?? null)) {
            return $this->handle($integration->team, $integration->provider, $user, $validated['url'], $label);
        }

        $integration->forceFill(['settings' => [...$integration->settings, 'channelLabel' => self::label($label)]])->save();

        return $integration;
    }

    private static function host(string $url): string
    {
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        $port = parse_url($url, PHP_URL_PORT);

        $defaultPort = parse_url($url, PHP_URL_SCHEME) === 'http' ? 80 : 443;

        return $port === null || $port === $defaultPort ? $host : "{$host}:{$port}";
    }

    private static function label(?string $label): ?string
    {
        $trimmed = trim((string) $label);

        return $trimmed === '' ? null : $trimmed;
    }

    private function urlRule(IntegrationProvider $provider): ValidationRule
    {
        return match ($provider) {
            IntegrationProvider::MicrosoftTeams => new MicrosoftTeamsWebhookUrl,
            IntegrationProvider::Mattermost => new MattermostWebhookUrl,
            default => throw new InvalidArgumentException("{$provider->value} does not connect with a URL."),
        };
    }
}
