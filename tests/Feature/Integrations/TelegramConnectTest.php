<?php

use App\Actions\Integrations\HandleTelegramUpdate;
use App\Actions\Integrations\PollTelegramUpdates;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Telegram\TelegramBot;
use App\Support\Integrations\Telegram\TelegramConnectCodes;
use Carbon\CarbonImmutable;
use Illuminate\Console\Scheduling\Event as ScheduledEvent;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

beforeEach(function () {
    Http::preventStrayRequests();
    enableIntegrations(IntegrationProvider::Telegram);
});

/**
 * @param  array<int, array<string, mixed>>  $updates
 */
function fakeTelegramBot(array $updates = []): void
{
    Http::fake([
        'api.telegram.org/*/getMe' => Http::response(['ok' => true, 'result' => ['id' => 42, 'is_bot' => true, 'username' => 'skrum_test_bot']]),
        'api.telegram.org/*/getUpdates' => Http::response(['ok' => true, 'result' => $updates]),
        'api.telegram.org/*' => Http::response(['ok' => true, 'result' => true]),
    ]);
}

/**
 * @param  array<string, mixed>  $chat
 * @return array<string, mixed>
 */
function telegramUpdate(int $id, string $text, array $chat = ['id' => -100123, 'title' => 'Team chat', 'type' => 'supergroup'], string $kind = 'message'): array
{
    return ['update_id' => $id, $kind => ['message_id' => $id, 'date' => 1_700_000_000, 'chat' => $chat, 'text' => $text]];
}

/**
 * @return array{0: Team, 1: User, 2: string}
 */
function telegramCodeFor(): array
{
    $team = Team::factory()->create(['name' => 'Rocket']);
    $admin = integrationAdmin($team);

    return [$team, $admin, resolve(TelegramConnectCodes::class)->issue($team, $admin)['code']];
}

/**
 * @return array<int, mixed>
 */
function telegramReplies(): array
{
    return Http::recorded()
        ->filter(fn (array $pair) => str_ends_with($pair[0]->url(), '/sendMessage'))
        ->map(fn (array $pair) => $pair[0]['text'])
        ->values()
        ->all();
}

it('issues an eight-character code with the exact command', function () {
    $this->freezeSecond();
    fakeTelegramBot();
    $team = Team::factory()->create();

    $response = $this->actingAs(integrationAdmin($team))
        ->postJson(route('teams.integrations.telegramCode.store', [$team->workspace, $team]))
        ->assertOk();

    $code = $response->json('code');

    expect($code)->toMatch('/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$/')
        ->and($response->json('command'))->toBe("/connect@skrum_test_bot {$code}")
        ->and($response->json('botUsername'))->toBe('skrum_test_bot')
        ->and(CarbonImmutable::parse($response->json('expiresAt'))->equalTo(now()->addMinutes(15)))->toBeTrue();
});

it('reserves Telegram codes to admins of an instance with a bot', function () {
    fakeTelegramBot();
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))
        ->postJson(route('teams.integrations.telegramCode.store', [$team->workspace, $team]))
        ->assertForbidden();

    disableIntegrations();

    $this->actingAs(integrationAdmin($team))
        ->postJson(route('teams.integrations.telegramCode.store', [$team->workspace, $team]))
        ->assertNotFound();
});

it('connects a group that sends the command', function (string $text, string $kind) {
    $this->freezeSecond();
    fakeTelegramBot();
    [$team, $admin, $code] = telegramCodeFor();

    resolve(HandleTelegramUpdate::class)->handle(telegramUpdate(1, str_replace('CODE', $code, $text), kind: $kind));

    $integration = TeamIntegration::query()->sole();

    expect($integration->team_id)->toBe($team->id)
        ->and($integration->provider)->toBe(IntegrationProvider::Telegram)
        ->and($integration->status)->toBe(IntegrationStatus::Active)
        ->and($integration->connected_by_user_id)->toBe($admin->id)
        ->and($integration->settings)->toBeIgnoringKeyOrder(['chatId' => '-100123', 'chatTitle' => 'Team chat', 'chatType' => 'supergroup', 'linkedAt' => now()->toIso8601String()])
        ->and(telegramReplies())->toBe(['Connected to the Rocket team on '.config('app.name').'.']);
})->with([
    'addressed to the bot' => ['/connect@skrum_test_bot CODE', 'message'],
    'bot name in another case' => ['/connect@Skrum_Test_Bot CODE', 'message'],
    'without the bot name' => ['/connect CODE', 'message'],
    'channel post' => ['/connect@skrum_test_bot CODE', 'channel_post'],
]);

it('marks a new link when the same chat sends a new code', function () {
    fakeTelegramBot();
    [$team, $admin, $first] = telegramCodeFor();
    $handler = resolve(HandleTelegramUpdate::class);

    $handler->handle(telegramUpdate(1, "/connect {$first}"));
    $linkedFirst = TeamIntegration::query()->sole()->setting('linkedAt');

    $this->travel(5)->minutes();
    $second = resolve(TelegramConnectCodes::class)->issue($team, $admin)['code'];
    $handler->handle(telegramUpdate(2, "/connect {$second}"));

    expect(TeamIntegration::query()->sole()->setting('linkedAt'))->not->toBe($linkedFirst);
});

it('accepts a code only once and only while it is the newest', function () {
    fakeTelegramBot();
    [$team, $admin, $first] = telegramCodeFor();
    $second = resolve(TelegramConnectCodes::class)->issue($team, $admin)['code'];
    $handler = resolve(HandleTelegramUpdate::class);

    $handler->handle(telegramUpdate(1, "/connect {$first}"));

    expect(TeamIntegration::query()->count())->toBe(0);

    $handler->handle(telegramUpdate(2, "/connect {$second}"));
    $handler->handle(telegramUpdate(3, "/connect {$second}", ['id' => -100999, 'title' => 'Other chat', 'type' => 'group']));

    expect(TeamIntegration::query()->sole()->setting('chatId'))->toBe('-100123')
        ->and(telegramReplies())->toBe([
            'This code is invalid or has expired. Create a new one in '.config('app.name').'.',
            'Connected to the Rocket team on '.config('app.name').'.',
            'This code is invalid or has expired. Create a new one in '.config('app.name').'.',
        ]);
});

it('refuses a code whose author may no longer manage the integrations of the team', function () {
    fakeTelegramBot();
    [$team, $admin, $code] = telegramCodeFor();
    $team->workspace->members()->updateExistingPivot($admin->id, ['role' => WorkspaceRole::Member->value]);

    resolve(HandleTelegramUpdate::class)->handle(telegramUpdate(1, "/connect {$code}"));

    expect(TeamIntegration::query()->count())->toBe(0)
        ->and(telegramReplies())->toBe(['This code is invalid or has expired. Create a new one in '.config('app.name').'.']);
});

it('expires codes after fifteen minutes', function () {
    fakeTelegramBot();
    [, , $code] = telegramCodeFor();

    $this->travel(16)->minutes();

    resolve(HandleTelegramUpdate::class)->handle(telegramUpdate(1, "/connect {$code}"));

    expect(TeamIntegration::query()->count())->toBe(0);
});

it('ignores commands for another bot', function () {
    fakeTelegramBot();
    [, , $code] = telegramCodeFor();

    resolve(HandleTelegramUpdate::class)->handle(telegramUpdate(1, "/connect@other_bot {$code}"));

    expect(TeamIntegration::query()->count())->toBe(0)
        ->and(telegramReplies())->toBeEmpty();
});

it('locks a chat out after five invalid codes', function () {
    fakeTelegramBot();
    [$team, $admin, $code] = telegramCodeFor();
    $handler = resolve(HandleTelegramUpdate::class);

    foreach (range(1, 5) as $attempt) {
        $handler->handle(telegramUpdate($attempt, '/connect WRONG234'));
    }

    $handler->handle(telegramUpdate(6, "/connect {$code}"));

    expect(TeamIntegration::query()->count())->toBe(0)
        ->and(telegramReplies())->toHaveCount(5);

    $this->travel(61)->minutes();
    $fresh = resolve(TelegramConnectCodes::class)->issue($team, $admin);
    $handler->handle(telegramUpdate(7, "/connect {$fresh['code']}"));

    expect(TeamIntegration::query()->count())->toBe(1);
});

it('answers /start and /help and ignores everything else', function () {
    fakeTelegramBot();
    Log::spy();
    $handler = resolve(HandleTelegramUpdate::class);

    $handler->handle(telegramUpdate(1, '/start'));
    $handler->handle(telegramUpdate(2, '/help'));
    $handler->handle(telegramUpdate(3, 'our secret launch plan'));
    $handler->handle(['update_id' => 4, 'edited_message' => ['text' => 'x']]);

    expect(telegramReplies())->toHaveCount(2)
        ->each->toContain('/connect')
        ->and(TeamIntegration::query()->count())->toBe(0);
    Log::shouldNotHaveReceived('info');
    Log::shouldNotHaveReceived('debug');
    Log::shouldNotHaveReceived('warning');
});

it('follows a group upgraded to a supergroup', function () {
    fakeTelegramBot();
    $integration = TeamIntegration::factory()->telegram()->create(['settings' => ['chatId' => '-4001', 'chatTitle' => 'Team', 'chatType' => 'group']]);

    resolve(HandleTelegramUpdate::class)->handle(['update_id' => 1, 'message' => [
        'message_id' => 1, 'date' => 1_700_000_000,
        'chat' => ['id' => -4001, 'title' => 'Team', 'type' => 'group'],
        'migrate_to_chat_id' => -1004001,
    ]]);

    expect($integration->fresh()->setting('chatId'))->toBe('-1004001');
});

it('requires a reconnect when the bot leaves or is removed from the chat', function (string $status) {
    fakeTelegramBot();
    $integration = TeamIntegration::factory()->telegram()->create();

    resolve(HandleTelegramUpdate::class)->handle(['update_id' => 1, 'my_chat_member' => [
        'chat' => ['id' => -100123, 'title' => 'Team chat', 'type' => 'supergroup'],
        'date' => 1_700_000_000,
        'old_chat_member' => ['status' => 'member', 'user' => ['id' => 42, 'is_bot' => true]],
        'new_chat_member' => ['status' => $status, 'user' => ['id' => 42, 'is_bot' => true]],
    ]]);

    expect($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($integration->fresh()->last_error)->toBe('The bot was removed from the Telegram chat.');
})->with(['left', 'kicked']);

it('polls updates and advances the offset', function () {
    fakeTelegramBot([telegramUpdate(7, 'hello'), telegramUpdate(8, 'world')]);

    $this->artisan('skrum:telegram-poll', ['--timeout' => 0])
        ->expectsOutput('Handled 2 Telegram updates.')
        ->assertSuccessful();

    expect(Cache::get(PollTelegramUpdates::OffsetKey))->toBe(9);

    $this->artisan('skrum:telegram-poll', ['--timeout' => 0])->assertSuccessful();

    Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/getUpdates') && $request['offset'] === 9);
});

it('warns once per hour when the bot is used elsewhere', function () {
    Http::fake(['api.telegram.org/*' => Http::response(['ok' => false, 'error_code' => 409, 'description' => 'Conflict: terminated by other getUpdates request'], 409)]);
    Log::spy();

    $this->artisan('skrum:telegram-poll', ['--timeout' => 0])->assertSuccessful();
    $this->artisan('skrum:telegram-poll', ['--timeout' => 0])->assertSuccessful();

    expect(resolve(TelegramBot::class)->hasConflict())->toBeTrue();
    Log::shouldHaveReceived('warning')->once();
});

it('does nothing without a bot token', function () {
    disableIntegrations();

    $this->artisan('skrum:telegram-poll')
        ->expectsOutput('Telegram is not configured.')
        ->assertSuccessful();

    Http::assertNothingSent();
});

it('polls every minute without overlapping', function () {
    $event = collect(resolve(Schedule::class)->events())
        ->first(fn (ScheduledEvent $event) => str_contains((string) $event->command, 'skrum:telegram-poll'));

    expect($event)->not->toBeNull()
        ->and($event->expression)->toBe('* * * * *')
        ->and($event->withoutOverlapping)->toBeTrue()
        ->and($event->runInBackground)->toBeTrue()
        ->and($event->onOneServer)->toBeTrue();
});
