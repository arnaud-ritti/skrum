<?php

namespace App\Actions\Integrations;

use App\Enums\IntegrationAccess;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Exceptions\IntegrationException;
use App\Support\Integrations\Telegram\TelegramBot;
use App\Support\Integrations\Telegram\TelegramClient;
use App\Support\Integrations\Telegram\TelegramConnectCodes;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Only the commands below are read; other message text is neither stored
 * nor logged.
 */
class HandleTelegramUpdate
{
    private const int MaxInvalidAttempts = 5;

    private const int LockoutSeconds = 3600;

    private const array LeftStatuses = ['left', 'kicked'];

    public function __construct(
        private TelegramClient $telegram,
        private TelegramBot $bot,
        private TelegramConnectCodes $codes,
        private SaveTeamIntegration $saveTeamIntegration,
    ) {}

    /**
     * @param  array<string, mixed>  $update
     */
    public function handle(array $update): void
    {
        if (is_array($update['my_chat_member'] ?? null)) {
            $this->memberChanged($update['my_chat_member']);

            return;
        }

        $message = $update['message'] ?? $update['channel_post'] ?? null;

        if (! is_array($message) || ! is_array($message['chat'] ?? null) || ! isset($message['chat']['id'])) {
            return;
        }

        $chat = $message['chat'];
        $chatId = (string) $chat['id'];

        if (isset($message['migrate_to_chat_id'])) {
            $this->migrate($chatId, (string) $message['migrate_to_chat_id']);

            return;
        }

        $text = trim(is_string($message['text'] ?? null) ? $message['text'] : '');

        if (preg_match('/^\/connect(?:@(\w+))?(?:\s+(\S+))?$/i', $text, $matches) === 1) {
            if ($this->addressedToAnotherBot($matches[1] ?? '')) {
                return;
            }

            $this->connect($chat, $chatId, $matches[2] ?? '');

            return;
        }

        if (preg_match('/^\/(?:start|help)(?:@(\w+))?(?:\s|$)/i', $text, $matches) === 1 && ! $this->addressedToAnotherBot($matches[1] ?? '')) {
            $this->reply($chatId, __('This bot posts retrospective and planning poker links from :app. To connect this chat, create a code on your team\'s integrations page and send /connect with it.', ['app' => config('app.name')]));
        }
    }

    /**
     * @param  array<array-key, mixed>  $chat
     */
    private function connect(array $chat, string $chatId, string $code): void
    {
        $limiterKey = "telegram-connect-attempts:{$chatId}";

        if (RateLimiter::tooManyAttempts($limiterKey, self::MaxInvalidAttempts)) {
            return;
        }

        $payload = $code === '' ? null : $this->codes->consume($code);
        $team = $payload === null ? null : Team::query()->find($payload['teamId']);
        $user = $payload === null ? null : User::query()->find($payload['userId']);

        if ($team === null || $user === null) {
            RateLimiter::hit($limiterKey, self::LockoutSeconds);
            $this->reply($chatId, __('This code is invalid or has expired. Create a new one in skrum.'));

            return;
        }

        $this->saveTeamIntegration->handle($team, IntegrationProvider::Telegram, $user, [
            'status' => IntegrationStatus::Active,
            'access' => IntegrationAccess::Write,
            'credentials' => [],
            'settings' => [
                'chatId' => $chatId,
                'chatTitle' => $this->chatTitle($chat),
                'chatType' => is_string($chat['type'] ?? null) ? $chat['type'] : 'group',
            ],
            'scopes' => [],
        ]);

        $this->reply($chatId, __('Connected to the :team team on :app.', [
            'team' => $team->name,
            'app' => config('app.name'),
        ], $user->preferredLocale()));
    }

    /**
     * @param  array<array-key, mixed>  $member
     */
    private function memberChanged(array $member): void
    {
        $chatId = data_get($member, 'chat.id');

        if ($chatId === null || ! in_array(data_get($member, 'new_chat_member.status'), self::LeftStatuses, true)) {
            return;
        }

        $this->integrationsForChat((string) $chatId)
            ->each(fn (TeamIntegration $integration) => $integration->markReconnectRequired(__('The bot was removed from the Telegram chat.')));
    }

    private function migrate(string $chatId, string $newChatId): void
    {
        $this->integrationsForChat($chatId)->each(function (TeamIntegration $integration) use ($newChatId): void {
            $integration->forceFill(['settings' => [...$integration->settings, 'chatId' => $newChatId]])->save();
        });
    }

    /**
     * @return Collection<int, TeamIntegration>
     */
    private function integrationsForChat(string $chatId): Collection
    {
        return TeamIntegration::query()
            ->where('provider', IntegrationProvider::Telegram->value)
            ->where('settings->chatId', $chatId)
            ->get();
    }

    private function addressedToAnotherBot(string $username): bool
    {
        if ($username === '') {
            return false;
        }

        $botUsername = $this->bot->username();

        return $botUsername === null || strcasecmp($username, $botUsername) !== 0;
    }

    /**
     * @param  array<array-key, mixed>  $chat
     */
    private function chatTitle(array $chat): string
    {
        if (is_string($chat['title'] ?? null) && $chat['title'] !== '') {
            return $chat['title'];
        }

        $name = trim((($chat['first_name'] ?? '')).' '.(($chat['last_name'] ?? '')));

        return $name !== '' ? $name : (string) ($chat['username'] ?? __('Private chat'));
    }

    private function reply(string $chatId, string $text): void
    {
        try {
            $this->telegram->sendMessage($chatId, e($text));
        } catch (IntegrationException) {
            // A reply that cannot be delivered changes nothing: the next command gets its own reply.
        }
    }
}
