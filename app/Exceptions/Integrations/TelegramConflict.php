<?php

namespace App\Support\Integrations\Exceptions;

use App\Enums\IntegrationProvider;

class TelegramConflict extends IntegrationException
{
    public function __construct(?string $detail = null)
    {
        parent::__construct(IntegrationProvider::Telegram, $detail);
    }

    public function status(): int
    {
        return 409;
    }

    public function userMessage(): string
    {
        return __('The Telegram bot is used elsewhere. Remove its webhook or use a dedicated bot.');
    }
}
