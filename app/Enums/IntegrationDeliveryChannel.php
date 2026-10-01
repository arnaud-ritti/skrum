<?php

namespace App\Enums;

enum IntegrationDeliveryChannel: string
{
    case Slack = 'slack';
    case Telegram = 'telegram';
    case Email = 'email';
    case MicrosoftTeams = 'msteams';
    case Mattermost = 'mattermost';
    case Webhook = 'webhook';

    /**
     * @return array<int, self>
     */
    public static function shareChannels(): array
    {
        return [self::Slack, self::Telegram, self::MicrosoftTeams, self::Mattermost, self::Webhook];
    }

    public function provider(): ?IntegrationProvider
    {
        return match ($this) {
            self::Slack => IntegrationProvider::Slack,
            self::Telegram => IntegrationProvider::Telegram,
            self::MicrosoftTeams => IntegrationProvider::MicrosoftTeams,
            self::Mattermost => IntegrationProvider::Mattermost,
            self::Webhook => IntegrationProvider::Webhook,
            self::Email => null,
        };
    }
}
