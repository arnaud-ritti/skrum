<?php

use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Events\Poker\PokerGameChanged;
use App\Events\Retros\ResultsChanged;
use App\Jobs\Integrations\DeliverToSlack;
use App\Jobs\Integrations\DeliverToTelegram;
use App\Models\IntegrationDelivery;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\TeamIntegration;
use App\Support\Integrations\Exceptions\ProviderUnavailable;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    Http::preventStrayRequests();
    Event::fake([ResultsChanged::class, PokerGameChanged::class]);
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Telegram);
});

function queuedSlackDelivery(?Retro $retro = null): IntegrationDelivery
{
    $retro ??= Retro::factory()->create();
    TeamIntegration::factory()->slack()->create(['team_id' => $retro->team_id]);

    return IntegrationDelivery::factory()->forSubject($retro)->create();
}

function queuedTelegramDelivery(?Retro $retro = null): IntegrationDelivery
{
    $retro ??= Retro::factory()->create();
    TeamIntegration::factory()->telegram()->create(['team_id' => $retro->team_id]);

    return IntegrationDelivery::factory()->forSubject($retro)->create(['channel' => IntegrationDeliveryChannel::Telegram]);
}

function runDeliveryJob(DeliverToSlack|DeliverToTelegram $job): DeliverToSlack|DeliverToTelegram
{
    $job->withFakeQueueInteractions();
    $job->handle();

    return $job;
}

it('marks a Slack delivery sent and announces it', function () {
    Http::fake(['hooks.slack.com/*' => Http::response('ok')]);
    $delivery = queuedSlackDelivery();

    runDeliveryJob(new DeliverToSlack($delivery->id, ['text' => 'hello'], 'en'))->assertNotFailed()->assertNotReleased();

    $fresh = $delivery->fresh();
    expect($fresh->status)->toBe(IntegrationDeliveryStatus::Sent)
        ->and($fresh->sent_at)->not->toBeNull()
        ->and($fresh->error)->toBeNull()
        ->and(TeamIntegration::query()->sole()->last_checked_at)->not->toBeNull();
    Http::assertSent(fn (Request $request) => $request->url() === 'https://hooks.slack.com/services/T000/B000/XXXX' && $request['text'] === 'hello');
    Event::assertDispatched(ResultsChanged::class, fn (ResultsChanged $event) => $event->retroId === $delivery->subject_id);
});

it('sends Telegram deliveries as HTML without link previews', function () {
    Http::fake(['api.telegram.org/*' => Http::response(['ok' => true, 'result' => ['message_id' => 1]])]);
    $delivery = queuedTelegramDelivery();

    runDeliveryJob(new DeliverToTelegram($delivery->id, '<b>Hello</b>', 'en'))->assertNotFailed();

    expect($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Sent);
    Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/sendMessage')
        && $request['chat_id'] === '-100123'
        && $request['text'] === '<b>Hello</b>'
        && $request['parse_mode'] === 'HTML'
        && $request['link_preview_options'] === ['is_disabled' => true]);
});

it('announces poker deliveries on the game channel', function () {
    Http::fake(['hooks.slack.com/*' => Http::response('ok')]);
    $game = PokerGame::factory()->create();
    TeamIntegration::factory()->slack()->create(['team_id' => $game->team_id]);
    $delivery = IntegrationDelivery::factory()->forSubject($game)->create();

    runDeliveryJob(new DeliverToSlack($delivery->id, ['text' => 'hello'], 'en'));

    Event::assertDispatched(PokerGameChanged::class, fn (PokerGameChanged $event) => $event->gameId === $game->id);
    Event::assertNotDispatched(ResultsChanged::class);
});

it('releases a rate-limited Slack delivery after its retry-after', function () {
    Http::fake(['hooks.slack.com/*' => Http::response('rate_limited', 429, ['Retry-After' => '42'])]);
    $delivery = queuedSlackDelivery();

    runDeliveryJob(new DeliverToSlack($delivery->id, ['text' => 'hello'], 'en'))->assertReleased(42)->assertNotFailed();

    expect($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Queued);
});

it('releases a rate-limited Telegram delivery after retry_after', function () {
    Http::fake(['api.telegram.org/*' => Http::response(['ok' => false, 'error_code' => 429, 'description' => 'Too Many Requests', 'parameters' => ['retry_after' => 7]], 429)]);
    $delivery = queuedTelegramDelivery();

    runDeliveryJob(new DeliverToTelegram($delivery->id, 'hi', 'en'))->assertReleased(7);

    expect($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Queued);
});

it('leaves the delivery queued when the provider is down', function () {
    Http::fake(['hooks.slack.com/*' => Http::response('oops', 503)]);
    $delivery = queuedSlackDelivery();
    $job = new DeliverToSlack($delivery->id, ['text' => 'hello'], 'en');
    $job->withFakeQueueInteractions();

    expect(fn () => $job->handle())->toThrow(ProviderUnavailable::class);
    expect($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Queued);
    Event::assertNotDispatched(ResultsChanged::class);
});

it('fails at once and asks for a reconnect when the Slack channel is gone', function (int $status, string $body) {
    Http::fake(['hooks.slack.com/*' => Http::response($body, $status)]);
    $delivery = queuedSlackDelivery();

    runDeliveryJob(new DeliverToSlack($delivery->id, ['text' => 'hello'], 'en'))->assertFailed();

    $fresh = $delivery->fresh();
    expect($fresh->status)->toBe(IntegrationDeliveryStatus::Failed)
        ->and($fresh->error)->toBe('Reconnect Slack in the team settings.')
        ->and(TeamIntegration::query()->sole()->status)->toBe(IntegrationStatus::ReconnectRequired);
    Event::assertDispatched(ResultsChanged::class);
})->with([
    'no service' => [404, 'no_service'],
    'forbidden' => [403, 'action_prohibited'],
    'archived' => [410, 'channel_is_archived'],
]);

it('fails at once when Telegram removed the bot', function () {
    Http::fake(['api.telegram.org/*' => Http::response(['ok' => false, 'error_code' => 403, 'description' => 'Forbidden: bot was kicked from the group chat'], 403)]);
    $delivery = queuedTelegramDelivery();

    runDeliveryJob(new DeliverToTelegram($delivery->id, 'hi', 'fr'))->assertFailed();

    expect($delivery->fresh()->error)->toBe("Reconnectez Telegram dans les paramètres de l'équipe.")
        ->and(TeamIntegration::query()->sole()->status)->toBe(IntegrationStatus::ReconnectRequired);
});

it('fails at once without calling the provider when the connection is gone', function (Closure $breakConnection, string $error) {
    Http::fake();
    $delivery = queuedSlackDelivery();
    $breakConnection(TeamIntegration::query()->sole());

    runDeliveryJob(new DeliverToSlack($delivery->id, ['text' => 'hello'], 'en'))->assertFailed();

    expect($delivery->fresh())->status->toBe(IntegrationDeliveryStatus::Failed)->error->toBe($error);
    Http::assertNothingSent();
})->with([
    'disconnected' => [fn (TeamIntegration $integration) => $integration->delete(), 'Connect Slack in the team settings.'],
    'reconnect required' => [fn (TeamIntegration $integration) => $integration->forceFill(['status' => IntegrationStatus::ReconnectRequired])->save(), 'Reconnect Slack in the team settings.'],
    'provider disabled' => [fn () => disableIntegrations(), 'Connect Slack in the team settings.'],
]);

it('records the final failure after the last retry', function () {
    $delivery = queuedSlackDelivery();

    (new DeliverToSlack($delivery->id, ['text' => 'hello'], 'en'))->failed(new ProviderUnavailable(IntegrationProvider::Slack, 'HTTP 503'));

    expect($delivery->fresh())
        ->status->toBe(IntegrationDeliveryStatus::Failed)
        ->error->toBe('Slack did not respond. Try again later.');
    Event::assertDispatched(ResultsChanged::class);
});

it('ignores deliveries that are gone or already finished', function () {
    Http::fake();
    $sent = IntegrationDelivery::factory()->sent()->create();
    $job = new DeliverToSlack($sent->id, ['text' => 'hello'], 'en');

    runDeliveryJob($job)->assertNotFailed();
    $job->failed(new RuntimeException('late'));
    runDeliveryJob(new DeliverToSlack('0199d3f0-0000-7000-8000-000000000000', ['text' => 'hello'], 'en'))->assertNotFailed();

    expect($sent->fresh()->status)->toBe(IntegrationDeliveryStatus::Sent);
    Http::assertNothingSent();
});
