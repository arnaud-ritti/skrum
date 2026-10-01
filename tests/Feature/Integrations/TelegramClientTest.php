<?php

use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Exceptions\Integrations\IntegrationException;
use App\Exceptions\Integrations\RateLimited;
use App\Exceptions\Integrations\ReconnectRequired;
use App\Exceptions\Integrations\TelegramConflict;
use App\Models\TeamIntegration;
use App\Support\Integrations\Telegram\TelegramBot;
use App\Support\Integrations\Telegram\TelegramClient;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Telegram);
});

it('sends HTML messages without link previews', function () {
    Http::fake(['api.telegram.org/*' => Http::response(['ok' => true, 'result' => ['message_id' => 1]])]);
    $integration = TeamIntegration::factory()->telegram()->create();

    resolve(TelegramClient::class)->sendMessageTo($integration, '<b>Hello</b>');

    Http::assertSent(fn (Request $request) => $request->url() === 'https://api.telegram.org/bot123456:telegram-token/sendMessage'
        && $request['chat_id'] === '-100123'
        && $request['text'] === '<b>Hello</b>'
        && $request['parse_mode'] === 'HTML'
        && $request['link_preview_options'] === ['is_disabled' => true]);
});

it('requires a reconnect when the bot lost the chat', function (int $status, string $description) {
    Http::fake(['api.telegram.org/*' => Http::response(['ok' => false, 'error_code' => $status, 'description' => $description], $status)]);
    $integration = TeamIntegration::factory()->telegram()->create();

    expect(fn () => resolve(TelegramClient::class)->sendMessageTo($integration, 'Hello'))->toThrow(ReconnectRequired::class)
        ->and($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired);
})->with([
    'blocked' => [403, 'Forbidden: bot was kicked from the supergroup chat'],
    'chat not found' => [400, 'Bad Request: chat not found'],
]);

it('honours the retry delay Telegram asks for', function () {
    Http::fake(['api.telegram.org/*' => Http::response(['ok' => false, 'error_code' => 429, 'description' => 'Too Many Requests', 'parameters' => ['retry_after' => 17]], 429)]);
    $integration = TeamIntegration::factory()->telegram()->create();

    try {
        resolve(TelegramClient::class)->sendMessageTo($integration, 'Hello');
        $this->fail('No exception was thrown.');
    } catch (RateLimited $exception) {
        expect($exception->retryAfter)->toBe(17)
            ->and($integration->fresh()->status)->toBe(IntegrationStatus::Active);
    }
});

it('reports a bot used elsewhere', function () {
    Http::fake(['api.telegram.org/*' => Http::response(['ok' => false, 'error_code' => 409, 'description' => 'Conflict: can\'t use getUpdates method while webhook is active'], 409)]);

    expect(fn () => resolve(TelegramClient::class)->getUpdates(0, 0))->toThrow(TelegramConflict::class);
});

it('long-polls updates with the allowed update types', function () {
    Http::fake(['api.telegram.org/*' => Http::response(['ok' => true, 'result' => [['update_id' => 7]]])]);

    $updates = resolve(TelegramClient::class)->getUpdates(5, 50);

    expect($updates)->toBe([['update_id' => 7]]);
    Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/getUpdates')
        && $request['offset'] === 5
        && $request['timeout'] === 50
        && $request['allowed_updates'] === ['message', 'channel_post', 'my_chat_member']);
});

it('never exposes the bot token in errors', function () {
    Http::fake(['api.telegram.org/*' => Http::response(['ok' => false, 'error_code' => 400, 'description' => 'Bad Request: bot123456:telegram-token is odd'], 400)]);
    $integration = TeamIntegration::factory()->telegram()->create();

    try {
        resolve(TelegramClient::class)->sendMessageTo($integration, 'Hello');
        $this->fail('No exception was thrown.');
    } catch (IntegrationException $exception) {
        expect($exception->getMessage())->not->toContain('telegram-token');
    }
});

it('caches the bot username for a day', function () {
    Http::fake(['api.telegram.org/*/getMe' => Http::response(['ok' => true, 'result' => ['id' => 42, 'is_bot' => true, 'username' => 'skrum_test_bot']])]);
    $bot = resolve(TelegramBot::class);

    expect($bot->username())->toBe('skrum_test_bot')
        ->and($bot->username())->toBe('skrum_test_bot');

    Http::assertSentCount(1);
});

it('answers null when the bot cannot be reached', function () {
    Http::fake(['api.telegram.org/*' => Http::response('down', 502)]);

    expect(resolve(TelegramBot::class)->username())->toBeNull();
});

it('waits a minute before asking an unreachable bot again', function () {
    Http::fake(['api.telegram.org/*/getMe' => Http::sequence()
        ->push('down', 502)
        ->push(['ok' => true, 'result' => ['id' => 42, 'is_bot' => true, 'username' => 'skrum_test_bot']])]);
    $bot = resolve(TelegramBot::class);

    expect($bot->username())->toBeNull()
        ->and($bot->username())->toBeNull();

    Http::assertSentCount(1);

    $this->travel(61)->seconds();

    expect($bot->username())->toBe('skrum_test_bot');
});

it('remembers a polling conflict for the integrations page', function () {
    $bot = resolve(TelegramBot::class);

    $bot->markConflict();

    expect($bot->hasConflict())->toBeTrue();

    $bot->clearConflict();

    expect($bot->hasConflict())->toBeFalse();
});
