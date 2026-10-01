<?php

use App\Actions\Integrations\LatestDeliveries;
use App\Actions\Integrations\QueueShare;
use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationProvider;
use App\Exceptions\Integrations\NotConnected;
use App\Exceptions\Integrations\ReconnectRequired;
use App\Jobs\Integrations\DeliverToSlack;
use App\Jobs\Integrations\DeliverToTelegram;
use App\Models\IntegrationDelivery;
use App\Models\IntegrationDeliveryPayload;
use App\Models\Retro;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Messages\LinkShareContent;
use Illuminate\Console\Scheduling\Event as ScheduledEvent;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Http::preventStrayRequests();
    Queue::fake();
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Telegram);
});

it('queues a Slack delivery for an active connection', function () {
    $retro = Retro::factory()->create();
    TeamIntegration::factory()->slack()->create(['team_id' => $retro->team_id]);
    $sharer = User::factory()->create(['name' => 'Sam Sharer']);
    $content = new LinkShareContent('Sam invites you', 'Open', 'https://skrum.test/retros/1');

    app()->setLocale('fr');
    $delivery = resolve(QueueShare::class)->handle($retro, IntegrationDeliveryChannel::Slack, IntegrationDeliveryKind::RetroLink, $sharer, $content);

    expect($delivery->only(['team_id', 'subject_id', 'requested_by_user_id']))->toBe([
        'team_id' => $retro->team_id,
        'subject_id' => $retro->id,
        'requested_by_user_id' => $sharer->id,
    ])
        ->and($delivery->subject_type)->toBe($retro->getMorphClass())
        ->and($delivery->channel)->toBe(IntegrationDeliveryChannel::Slack)
        ->and($delivery->kind)->toBe(IntegrationDeliveryKind::RetroLink)
        ->and($delivery->status)->toBe(IntegrationDeliveryStatus::Queued);
    Queue::assertPushed(DeliverToSlack::class, fn (DeliverToSlack $job) => $job->deliveryId === $delivery->id
        && $job->message === $content->toSlack()
        && $job->locale === 'fr');
    Queue::assertNotPushed(DeliverToTelegram::class);
});

it('keeps no content for a Slack share', function () {
    $retro = Retro::factory()->create();
    TeamIntegration::factory()->slack()->create(['team_id' => $retro->team_id]);

    $delivery = resolve(QueueShare::class)->handle($retro, IntegrationDeliveryChannel::Slack, IntegrationDeliveryKind::RetroLink, User::factory()->create(), new LinkShareContent('a', 'b', 'https://skrum.test', ['title' => 'Sprint 42']));

    expect($delivery->payload()->exists())->toBeFalse()
        ->and(IntegrationDeliveryPayload::query()->count())->toBe(0);
});

it('queues Telegram deliveries with the HTML message', function () {
    $retro = Retro::factory()->create();
    TeamIntegration::factory()->telegram()->create(['team_id' => $retro->team_id]);
    $content = new LinkShareContent('Sam invites you', 'Open', 'https://skrum.test/retros/1');

    $delivery = resolve(QueueShare::class)->handle($retro, IntegrationDeliveryChannel::Telegram, IntegrationDeliveryKind::RetroLink, User::factory()->create(), $content);

    Queue::assertPushed(DeliverToTelegram::class, fn (DeliverToTelegram $job) => $job->deliveryId === $delivery->id && $job->html === $content->toTelegram());
});

it('refuses a team without an active connection', function (Closure $setUp, string $exception) {
    $retro = Retro::factory()->create();
    $setUp($retro);

    expect(fn () => resolve(QueueShare::class)->handle($retro, IntegrationDeliveryChannel::Slack, IntegrationDeliveryKind::RetroLink, User::factory()->create(), new LinkShareContent('a', 'b', 'https://skrum.test')))
        ->toThrow($exception)
        ->and(IntegrationDelivery::query()->count())->toBe(0);
    Queue::assertNothingPushed();
})->with([
    'not connected' => [fn () => null, NotConnected::class],
    'reconnect required' => [fn (Retro $retro) => TeamIntegration::factory()->slack()->reconnectRequired()->create(['team_id' => $retro->team_id]), ReconnectRequired::class],
    'provider disabled' => [function (Retro $retro): void {
        TeamIntegration::factory()->slack()->create(['team_id' => $retro->team_id]);
        disableIntegrations();
    }, NotConnected::class],
]);

it('refuses email as a share channel', function () {
    $retro = Retro::factory()->create();

    expect(fn () => resolve(QueueShare::class)->handle($retro, IntegrationDeliveryChannel::Email, IntegrationDeliveryKind::RetroResults, User::factory()->create(), new LinkShareContent('a', 'b', 'https://skrum.test')))
        ->toThrow(InvalidArgumentException::class);
});

it('keeps credentials out of the queued job', function () {
    $retro = Retro::factory()->create();
    TeamIntegration::factory()->slack()->create(['team_id' => $retro->team_id]);

    resolve(QueueShare::class)->handle($retro, IntegrationDeliveryChannel::Slack, IntegrationDeliveryKind::RetroLink, User::factory()->create(), new LinkShareContent('a', 'b', 'https://skrum.test'));

    Queue::assertPushed(DeliverToSlack::class, function (DeliverToSlack $job): bool {
        $serialized = serialize($job);

        return ! str_contains($serialized, 'hooks.slack.com') && ! str_contains($serialized, 'xoxp-test-token');
    });
    expect(json_encode(IntegrationDelivery::query()->sole()->toArray()))->not->toContain('hooks.slack.com');
});

it('presents the latest delivery per channel', function () {
    $retro = Retro::factory()->create();
    $sharer = User::factory()->create(['name' => 'Sam Sharer']);
    IntegrationDelivery::factory()->forSubject($retro)->failed()->create(['created_at' => now()->subHour()]);
    $latestSlack = IntegrationDelivery::factory()->forSubject($retro)->sent()->create(['requested_by_user_id' => $sharer->id, 'created_at' => now()->subMinute()]);
    $telegram = IntegrationDelivery::factory()->forSubject($retro)->create(['channel' => IntegrationDeliveryChannel::Telegram]);
    IntegrationDelivery::factory()->forSubject($retro)->create(['kind' => IntegrationDeliveryKind::RetroResults]);
    IntegrationDelivery::factory()->create();

    $latest = resolve(LatestDeliveries::class)->handle($retro, [IntegrationDeliveryKind::RetroLink]);

    expect(array_column($latest, 'id'))->toBe([$latestSlack->id, $telegram->id])
        ->and($latest[0])->toMatchArray([
            'channel' => 'slack',
            'kind' => 'retro_link',
            'status' => 'sent',
            'error' => null,
            'requestedBy' => 'Sam Sharer',
            'recipientCount' => null,
        ])
        ->and($latest[0]['sentAt'])->not->toBeNull()
        ->and($latest[1]['status'])->toBe('queued');
});

it('escapes link shares for both chats', function () {
    $content = new LinkShareContent('Ana invites you to "<!channel> & <http://evil|click>" (Team)', 'Open', 'https://skrum.test/join/abc?x=1&y=2');

    $slack = json_encode($content->toSlack(), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    $telegram = $content->toTelegram();

    expect($slack)->not->toContain('<!channel>')
        ->and($slack)->not->toContain('<http://evil|click>')
        ->and($slack)->toContain('&lt;!channel&gt; &amp; &lt;http://evil|click&gt;')
        ->and($content->toSlack()['blocks'][1]['elements'][0]['url'])->toBe('https://skrum.test/join/abc?x=1&y=2')
        ->and($telegram)->toContain('&lt;!channel&gt; &amp; &lt;http://evil|click&gt;')
        ->and($telegram)->toContain('<a href="https://skrum.test/join/abc?x=1&amp;y=2">Open</a>')
        ->and($telegram)->not->toContain('<http://evil');
});

it('prunes deliveries daily', function () {
    $prune = collect(resolve(Schedule::class)->events())
        ->first(fn (ScheduledEvent $event) => str_contains((string) $event->command, 'model:prune') && str_contains((string) $event->command, 'IntegrationDelivery'));

    expect($prune)->not->toBeNull()
        ->and($prune->expression)->toBe('0 0 * * *');
});
