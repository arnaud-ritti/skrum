<?php

namespace App\Actions\Integrations;

use App\Support\Integrations\Exceptions\TelegramConflict;
use App\Support\Integrations\Telegram\TelegramBot;
use App\Support\Integrations\Telegram\TelegramClient;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Throwable;

class PollTelegramUpdates
{
    public const OffsetKey = 'telegram:update-offset';

    private const ConflictWarningKey = 'telegram:conflict-warned';

    public function __construct(
        private TelegramClient $telegram,
        private TelegramBot $bot,
        private HandleTelegramUpdate $handleTelegramUpdate,
    ) {}

    public function handle(int $timeout): int
    {
        try {
            $updates = $this->telegram->getUpdates((int) Cache::get(self::OffsetKey, 0), $timeout);
        } catch (TelegramConflict) {
            $this->bot->markConflict();

            if (Cache::add(self::ConflictWarningKey, true, now()->addHour())) {
                Log::warning('The Telegram bot is used elsewhere: remove its webhook or use a dedicated bot.');
            }

            return 0;
        }

        $this->bot->clearConflict();

        foreach ($updates as $update) {
            try {
                $this->handleTelegramUpdate->handle($update);
            } catch (Throwable $exception) {
                Log::warning('A Telegram update could not be handled.', ['exception' => $exception::class]);
            }

            Cache::forever(self::OffsetKey, (int) ($update['update_id'] ?? 0) + 1);
        }

        return count($updates);
    }
}
