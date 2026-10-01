<?php

namespace App\Enums;

enum IntegrationProvider: string
{
    case Slack = 'slack';
    case Telegram = 'telegram';
    case Jira = 'jira';
    case Linear = 'linear';
    case JiraDataCenter = 'jira_dc';
    case GitHub = 'github';
    case MicrosoftTeams = 'msteams';
    case Mattermost = 'mattermost';
    case Webhook = 'webhook';

    /**
     * Configured providers whose connection flow ships in a later plan stay
     * disabled, so an early env value cannot expose a half-built card.
     */
    private const Unreleased = [self::JiraDataCenter, self::GitHub, self::Webhook];

    private const ServerPathPattern = '#^(/[A-Za-z0-9._~-]+)?/?$#';

    /**
     * @return array<int, self>
     */
    public static function enabled(): array
    {
        return array_values(array_filter(self::cases(), fn (self $provider): bool => $provider->isEnabled()));
    }

    public static function anyEnabled(): bool
    {
        return self::enabled() !== [];
    }

    public function label(): string
    {
        return match ($this) {
            self::Slack => 'Slack',
            self::Telegram => 'Telegram',
            self::Jira => 'Jira',
            self::Linear => 'Linear',
            self::JiraDataCenter => 'Jira Data Center',
            self::GitHub => 'GitHub',
            self::MicrosoftTeams => 'Microsoft Teams',
            self::Mattermost => 'Mattermost',
            self::Webhook => __('Webhook'),
        };
    }

    public function isEnabled(): bool
    {
        return $this->isConfigured() && ! in_array($this, self::Unreleased, true);
    }

    public function isConfigured(): bool
    {
        return match ($this) {
            self::Slack => self::hasConfig(['services.slack.client_id', 'services.slack.client_secret']),
            self::Telegram => self::hasConfig(['services.telegram.bot_token']),
            self::Jira => self::hasConfig(['services.jira.client_id', 'services.jira.client_secret']),
            self::Linear => self::hasConfig(['services.linear.client_id', 'services.linear.client_secret']),
            self::JiraDataCenter => self::isServerUrl(config('services.jira_dc.base_url')) && $this->authMethods() !== [],
            self::GitHub => self::hasConfig(['services.github_app.app_id', 'services.github_app.slug', 'services.github_app.client_id', 'services.github_app.client_secret'])
                && (filled(config('services.github_app.private_key')) || filled(config('services.github_app.private_key_path'))),
            self::MicrosoftTeams => config('services.msteams.enabled') === true,
            self::Mattermost => self::isServerUrl(config('services.mattermost.url')),
            self::Webhook => config('services.outgoing_webhooks.enabled') === true,
        };
    }

    /**
     * @return array<int, string>
     */
    public function authMethods(): array
    {
        if ($this !== self::JiraDataCenter) {
            return [];
        }

        $methods = [];

        if (self::hasConfig(['services.jira_dc.client_id', 'services.jira_dc.client_secret'])) {
            $methods[] = 'oauth';
        }

        if (config('services.jira_dc.personal_tokens') === true) {
            $methods[] = 'pat';
        }

        return $methods;
    }

    public function kind(): IntegrationKind
    {
        return match ($this) {
            self::Slack, self::Telegram, self::MicrosoftTeams, self::Mattermost, self::Webhook => IntegrationKind::Channel,
            self::Jira, self::JiraDataCenter, self::Linear, self::GitHub => IntegrationKind::Tracker,
        };
    }

    /**
     * @return array<int, IntegrationCapability>
     */
    public function capabilities(): array
    {
        $share = [IntegrationCapability::ShareLink, IntegrationCapability::ShareRecap];

        return match ($this) {
            self::Slack, self::Telegram, self::MicrosoftTeams, self::Mattermost => $share,
            self::Webhook => [...$share, IntegrationCapability::AutomaticEvents],
            self::Jira, self::JiraDataCenter, self::Linear, self::GitHub => [
                IntegrationCapability::PokerImport,
                IntegrationCapability::EstimateWriteBack,
                IntegrationCapability::ActionItemExport,
                IntegrationCapability::AssigneeMapping,
                IntegrationCapability::PriorityMapping,
                IntegrationCapability::StatusSync,
            ],
        };
    }

    public function can(IntegrationCapability $capability): bool
    {
        return in_array($capability, $this->capabilities(), true);
    }

    public function usesOAuth(): bool
    {
        return in_array($this, [self::Slack, self::Jira, self::Linear, self::JiraDataCenter, self::GitHub], true);
    }

    public function isTracker(): bool
    {
        return $this->kind() === IntegrationKind::Tracker;
    }

    public function isChannel(): bool
    {
        return $this->kind() === IntegrationKind::Channel;
    }

    public function connectsWithUrl(): bool
    {
        return in_array($this, [self::MicrosoftTeams, self::Mattermost, self::Webhook], true);
    }

    /**
     * @param  array<int, string>  $keys
     */
    private static function hasConfig(array $keys): bool
    {
        foreach ($keys as $key) {
            if (blank(config($key))) {
                return false;
            }
        }

        return true;
    }

    /**
     * An http(s) server address with at most one context path segment.
     */
    private static function isServerUrl(mixed $url): bool
    {
        if (! is_string($url) || filter_var($url, FILTER_VALIDATE_URL) === false) {
            return false;
        }

        $parts = parse_url($url);

        if (! is_array($parts) || ! in_array($parts['scheme'] ?? null, ['http', 'https'], true)) {
            return false;
        }

        if (isset($parts['user']) || isset($parts['query']) || isset($parts['fragment'])) {
            return false;
        }

        return preg_match(self::ServerPathPattern, $parts['path'] ?? '') === 1;
    }
}
