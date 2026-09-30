<?php

namespace App\Enums;

enum IntegrationDeliveryChannel: string
{
    case Slack = 'slack';
    case Telegram = 'telegram';
    case Email = 'email';

    /**
     * @return array<int, self>
     */
    public static function shareChannels(): array
    {
        return [self::Slack, self::Telegram];
    }

    public function provider(): ?IntegrationProvider
    {
        return match ($this) {
            self::Slack => IntegrationProvider::Slack,
            self::Telegram => IntegrationProvider::Telegram,
            self::Email => null,
        };
    }
}
