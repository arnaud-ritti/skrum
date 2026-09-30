<?php

namespace App\Support\Integrations\Telegram;

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\IntegrationException;
use App\Support\Integrations\Exceptions\ProviderRejected;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use App\Support\Integrations\Exceptions\RateLimited;
use App\Support\Integrations\Exceptions\ReconnectRequired;
use App\Support\Integrations\Exceptions\TelegramConflict;
use App\Support\Integrations\ProviderHttp;
use Illuminate\Support\Str;

class TelegramClient
{
    public const ApiUrl = 'https://api.telegram.org/bot';

    public const AllowedUpdates = ['message', 'channel_post', 'my_chat_member'];

    private const LongPollMarginSeconds = 10;

    private const DefaultRetryAfterSeconds = 30;

    /**
     * @return array<string, mixed>
     */
    public function getMe(): array
    {
        $result = $this->call('getMe');

        return is_array($result) ? $result : [];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function getUpdates(int $offset, int $timeout): array
    {
        $result = $this->call('getUpdates', [
            'offset' => $offset,
            'timeout' => $timeout,
            'allowed_updates' => self::AllowedUpdates,
        ], $timeout + self::LongPollMarginSeconds);

        return array_values(array_filter(is_array($result) ? $result : [], 'is_array'));
    }

    public function sendMessage(string $chatId, string $html): void
    {
        $this->call('sendMessage', [
            'chat_id' => $chatId,
            'text' => $html,
            'parse_mode' => 'HTML',
            'link_preview_options' => ['is_disabled' => true],
        ]);
    }

    public function sendMessageTo(TeamIntegration $integration, string $html): void
    {
        $integration->withReconnectHandling(fn () => $this->sendMessage($this->chatId($integration), $html));
    }

    /**
     * @return array<string, mixed>
     */
    public function getChat(TeamIntegration $integration): array
    {
        return $integration->withReconnectHandling(function () use ($integration): array {
            $result = $this->call('getChat', ['chat_id' => $this->chatId($integration)]);

            return is_array($result) ? $result : [];
        });
    }

    public function leaveChat(TeamIntegration $integration): void
    {
        try {
            $this->call('leaveChat', ['chat_id' => $this->chatId($integration)]);
        } catch (IntegrationException) {
            // Leaving is best effort: the connection is deleted either way.
        }
    }

    private function chatId(TeamIntegration $integration): string
    {
        return (string) $integration->setting('chatId');
    }

    /**
     * @param  array<string, mixed>  $params
     */
    private function call(string $method, array $params = [], int $timeout = 15): mixed
    {
        $url = self::ApiUrl.config('services.telegram.bot_token').'/'.$method;

        $response = ProviderHttp::send(IntegrationProvider::Telegram, fn () => ProviderHttp::request($timeout)->post($url, $params));

        $payload = $response->json();

        if ($response->successful() && is_array($payload) && ($payload['ok'] ?? false) === true) {
            return $payload['result'] ?? null;
        }

        $status = $response->status();
        $description = is_array($payload) && is_string($payload['description'] ?? null) ? $payload['description'] : "HTTP {$status}";

        if ($status === 409) {
            throw new TelegramConflict($description);
        }

        if ($status === 429) {
            $retryAfter = is_array($payload) ? data_get($payload, 'parameters.retry_after') : null;

            throw new RateLimited(IntegrationProvider::Telegram, is_numeric($retryAfter) ? max(1, (int) $retryAfter) : self::DefaultRetryAfterSeconds, $description);
        }

        if ($status === 403 || ($status === 400 && Str::contains($description, 'chat not found', ignoreCase: true))) {
            throw new ReconnectRequired(IntegrationProvider::Telegram, $description);
        }

        if ($status >= 500) {
            throw new ProviderUnavailable(IntegrationProvider::Telegram, $description);
        }

        throw new ProviderRejected(IntegrationProvider::Telegram, $description, $status);
    }
}
