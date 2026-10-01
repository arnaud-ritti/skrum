<?php

namespace App\Console\Commands;

use App\Actions\Integrations\PollTelegramUpdates;
use App\Enums\IntegrationProvider;
use App\Exceptions\Integrations\IntegrationException;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Description('Read the Telegram bot updates (connect codes, removed chats)')]
#[Signature('skrum:telegram-poll {--timeout=50 : Seconds Telegram may hold the request open}')]
class PollTelegramUpdatesCommand extends Command
{
    public function handle(PollTelegramUpdates $pollTelegramUpdates): int
    {
        if (! IntegrationProvider::Telegram->isEnabled()) {
            $this->comment('Telegram is not configured.');

            return self::SUCCESS;
        }

        $this->info('Waiting for Telegram updates…');

        try {
            $handled = $pollTelegramUpdates->handle(max(0, (int) $this->option('timeout')));
        } catch (IntegrationException $exception) {
            $this->warn("Telegram could not be reached: {$exception->getMessage()}");

            return self::SUCCESS;
        }

        $this->comment("Handled {$handled} Telegram updates.");

        return self::SUCCESS;
    }
}
