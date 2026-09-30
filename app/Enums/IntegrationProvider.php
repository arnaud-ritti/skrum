<?php

namespace App\Enums;

enum IntegrationProvider: string
{
    case Slack = 'slack';
    case Telegram = 'telegram';
    case Jira = 'jira';
    case Linear = 'linear';

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
        };
    }

    public function isEnabled(): bool
    {
        foreach ($this->requiredConfigKeys() as $key) {
            if (blank(config($key))) {
                return false;
            }
        }

        return true;
    }

    public function usesOAuth(): bool
    {
        return $this !== self::Telegram;
    }

    public function isTracker(): bool
    {
        return $this === self::Jira || $this === self::Linear;
    }

    public function isChannel(): bool
    {
        return $this === self::Slack || $this === self::Telegram;
    }

    /**
     * @return array<int, string>
     */
    private function requiredConfigKeys(): array
    {
        return match ($this) {
            self::Slack => ['services.slack.client_id', 'services.slack.client_secret'],
            self::Telegram => ['services.telegram.bot_token'],
            self::Jira => ['services.jira.client_id', 'services.jira.client_secret'],
            self::Linear => ['services.linear.client_id', 'services.linear.client_secret'],
        };
    }
}
