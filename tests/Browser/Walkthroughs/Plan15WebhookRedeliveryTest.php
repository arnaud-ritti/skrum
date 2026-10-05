<?php

use App\Enums\IntegrationDeliveryChannel;
use App\Enums\IntegrationDeliveryKind;
use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationStatus;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\Column;
use App\Models\IntegrationDelivery;
use App\Models\IntegrationDeliveryPayload;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Webhook\WebhookClient;
use App\Support\Integrations\Webhook\WebhookHealth;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\Browser\Support\InteractsWithIntegrations;

pest()->use(InteractsWithIntegrations::class);

/**
 * @return array{
 *     0: Retro,
 *     1: ActionItem
 * }
 */
function p15Board(Team $team, User $admin): array
{
    $retro = Retro::factory()
        ->inPhase(RetroPhase::Discussing)
        ->create(['team_id' => $team->id, 'title' => 'Sprint 42']);

    $participant = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $admin->id]);

    $retro->forceFill(['facilitator_participant_id' => $participant->id])->save();

    Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Ideas', 'position' => 0]);

    $item = ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'content' => 'Fix the deploy',
        'created_by_participant_id' => $participant->id,
    ]);

    return [$retro->fresh(), $item];
}

function p15FailedDelivery(Team $team, TeamIntegration $integration): IntegrationDelivery
{
    $delivery = IntegrationDelivery::factory()
        ->failed('Webhook did not respond. Try again later.')
        ->create([
            'team_id' => $team->id,
            'channel' => IntegrationDeliveryChannel::Webhook,
            'kind' => IntegrationDeliveryKind::Event,
            'event' => 'action_item.completed',
            'team_integration_id' => $integration->id,
            'requested_by_user_id' => null,
            'attempts' => 7,
            'response_status' => 503,
            'created_at' => now()->subMinutes(5),
        ]);

    $delivery->payload()->create(['message' => [
        'id' => $delivery->id,
        'event' => 'action_item.completed',
        'occurredAt' => '2026-10-07T10:00:00Z',
        'data' => ['actionItem' => ['id' => 'item-1', 'content' => 'Fix the deploy']],
    ]]);

    return $delivery;
}

function p15LogScript(): string
{
    return "Array.from(document.querySelectorAll('table[aria-label=\"Deliveries\"] tbody tr')).map((row) => [1, 2, 3, 4].map((index) => row.children[index].textContent).join(' | ')).join(' / ')";
}

function p15MakeUnredeliverable(string $case, TeamIntegration $integration, IntegrationDelivery $delivery): void
{
    if ($case === 'still being sent') {
        $delivery->forceFill(['status' => IntegrationDeliveryStatus::Queued])->save();

        return;
    }

    if ($case === 'webhook disabled') {
        $integration->forceFill(['status' => IntegrationStatus::ReconnectRequired])->save();

        return;
    }

    $delivery->payload()->update(['created_at' => now()->subDays(IntegrationDeliveryPayload::RetentionDays + 1)]);

    Artisan::call('model:prune', ['--model' => [IntegrationDeliveryPayload::class]]);
}

it('[P15-01] shows the request with a masked signature and the response of a delivery', function () {
    [$team, $admin] = webhookTeam();
    outgoingWebhook($team, ['action_item.completed']);
    [$retro, $item] = p15Board($team, $admin);
    Http::fake(['hooks.example.com/*' => Http::response('{"received":true}', 200)]);
    config(['queue.default' => 'database']);

    $page = $this->awaitRealtime($this->signIn($admin, "/retros/{$retro->id}"));

    $page->click("#action-item-{$item->id} [aria-label=\"Mark as in progress\"]")
        ->click("#action-item-{$item->id} [aria-label=\"Mark as done\"]")
        ->assertPresent("#action-item-{$item->id} [aria-label=\"Reopen\"]");

    $this->workQueue();

    $delivery = IntegrationDelivery::query()->sole();
    $signature = sentRequests()->sole()->header('X-Skrum-Signature')[0];
    $masked = WebhookClient::maskedSignature($signature);

    expect($delivery->payload->request_headers['X-Skrum-Signature'])->toBe($masked)
        ->and((string) DB::table('integration_delivery_payloads')->value('request_body'))->not->toContain('Fix the deploy');

    $page->navigate(teamPath('teams.integrations.index', $team));

    $this->openIntegration($page, 'webhook')
        ->click('Show deliveries')
        ->assertScript(p15LogScript(), 'action_item.completed | Sent | 1 | 200')
        ->click('table[aria-label="Deliveries"] button:has-text("View")')
        ->assertSee('Delivery details')
        ->assertAriaAttribute('#delivery-tab-request', 'selected', 'true')
        ->assertSeeIn('table[aria-label="Headers"]', 'X-Skrum-Event')
        ->assertSeeIn('table[aria-label="Headers"]', 'X-Skrum-Timestamp')
        ->assertSeeIn('table[aria-label="Headers"]', $delivery->id)
        ->assertSeeIn('table[aria-label="Headers"]', $masked)
        ->assertDontSeeIn($this->dialogOverPanel(), $signature)
        ->assertSeeIn('#delivery-tabpanel pre', '"event": "action_item.completed"')
        ->assertSeeIn('#delivery-tabpanel pre', 'Fix the deploy')
        ->click('#delivery-tab-response')
        ->assertAriaAttribute('#delivery-tab-response', 'selected', 'true')
        ->assertSee('Status: 200')
        ->assertSeeIn('#delivery-tabpanel pre', '{"received":true}');
});

it('[P15-02] shows a delivery that failed after its seven tries, with the last answer of the receiver', function () {
    [$team, $admin] = webhookTeam();
    $integration = outgoingWebhook($team, ['action_item.completed']);
    [$retro, $item] = p15Board($team, $admin);
    Http::fake(['hooks.example.com/*' => Http::response('upstream down', 503)]);
    config(['queue.default' => 'database']);

    $page = $this->awaitRealtime($this->signIn($admin, "/retros/{$retro->id}"));

    $page->click("#action-item-{$item->id} [aria-label=\"Mark as in progress\"]")
        ->click("#action-item-{$item->id} [aria-label=\"Mark as done\"]")
        ->assertPresent("#action-item-{$item->id} [aria-label=\"Reopen\"]");

    $this->workQueue();

    foreach ([30, 120, 600, 1800, 3600, 7200] as $seconds) {
        $this->travel($seconds)->seconds();
        $this->workQueue();
    }

    expect(IntegrationDelivery::query()->sole()->status)->toBe(IntegrationDeliveryStatus::Failed)
        ->and($integration->fresh()->status)->toBe(IntegrationStatus::Active);
    Http::assertSentCount(7);

    $after = $this->signIn($admin, teamPath('teams.integrations.index', $team));

    $this->openIntegration($after, 'webhook')
        ->click('Show deliveries')
        ->assertScript(p15LogScript(), 'action_item.completed | Failed | 7 | 503')
        ->assertSeeIn('table[aria-label="Deliveries"] tbody tr', 'Webhook did not respond. Try again later.')
        ->assertPresent('table[aria-label="Deliveries"] button:has-text("Redeliver")')
        ->click('table[aria-label="Deliveries"] button:has-text("View")')
        ->assertSee('Delivery details')
        ->click('#delivery-tab-response')
        ->assertSee('Status: 503')
        ->assertSeeIn('#delivery-tabpanel pre', 'upstream down');
});

it('[P15-03] redelivers a failed delivery with the same id, the redelivery header and a row marked Redelivery', function () {
    [$team, $admin] = webhookTeam();
    $integration = outgoingWebhook($team);
    $original = p15FailedDelivery($team, $integration);
    Http::fake(['hooks.example.com/*' => Http::response('', 200)]);
    config(['queue.default' => 'database']);

    $page = $this->signIn($admin, teamPath('teams.integrations.index', $team));

    $this->openIntegration($page, 'webhook')
        ->click('Show deliveries')
        ->assertScript(p15LogScript(), 'action_item.completed | Failed | 7 | 503')
        ->click('table[aria-label="Deliveries"] button:has-text("Redeliver")')
        ->assertSee('Send this delivery again to hooks.example.com?')
        ->click("{$this->dialogOverPanel()} button:has-text(\"Redeliver\")")
        ->assertSee('Delivery queued again.')
        ->assertNotPresent($this->dialogOverPanel())
        ->assertScript(p15LogScript(), 'action_item.completedRedelivery | Queued | 0 | — / action_item.completed | Failed | 7 | 503');

    Http::assertNothingSent();

    $this->workQueue();

    $page->click('Hide deliveries')
        ->click('Show deliveries')
        ->assertScript(p15LogScript(), 'action_item.completedRedelivery | Sent | 1 | 200 / action_item.completed | Failed | 7 | 503');

    $request = sentRequests()->sole();
    $body = json_decode($request->body(), true, flags: JSON_THROW_ON_ERROR);
    $redelivery = IntegrationDelivery::query()->where('redelivery_of_id', $original->id)->sole();

    expect($request->header('X-Skrum-Delivery')[0])->toBe($original->id)
        ->and($request->header('X-Skrum-Redelivery')[0])->toBe('true')
        ->and($request->header('X-Skrum-Event')[0])->toBe('action_item.completed')
        ->and(outgoingWebhookSignatureIsValid($request))->toBeTrue()
        ->and($body['id'])->toBe($original->id)
        ->and($body['occurredAt'])->toBe('2026-10-07T10:00:00Z')
        ->and($body['data'])->toBe(['actionItem' => ['id' => 'item-1', 'content' => 'Fix the deploy']])
        ->and($redelivery->requested_by_user_id)->toBe($admin->id)
        ->and($original->fresh()->attempts)->toBe(7);
});

it('[P15-04] offers no Redeliver while the webhook is disabled and offers it again once re-enabled', function () {
    [$team, $admin] = webhookTeam();
    $integration = TeamIntegration::factory()
        ->webhook()
        ->reconnectRequired('Disabled after 10 failed deliveries in a row.')
        ->create(['team_id' => $team->id, 'consecutive_failures' => 10]);
    $integration->forceFill(['settings' => [...$integration->settings, 'disabledReason' => WebhookHealth::FailuresReason]])->save();
    p15FailedDelivery($team, $integration);

    $page = $this->signIn($admin, teamPath('teams.integrations.index', $team));

    $this->openIntegration($page, 'webhook')
        ->assertSee('Disabled after 10 failed deliveries in a row.')
        ->click('Show deliveries')
        ->assertScript(p15LogScript(), 'action_item.completed | Failed | 7 | 503')
        ->assertPresent('table[aria-label="Deliveries"] button:has-text("View")')
        ->assertNotPresent('table[aria-label="Deliveries"] button:has-text("Redeliver")')
        ->click('Re-enable')
        ->assertSee('Webhook re-enabled.')
        ->assertPresent('table[aria-label="Deliveries"] button:has-text("Redeliver")');
});

it('[P15-05] explains why a delivery cannot be redelivered', function (string $case, string $message) {
    [$team, $admin] = webhookTeam();
    $integration = outgoingWebhook($team);
    $delivery = p15FailedDelivery($team, $integration);
    Http::fake(['hooks.example.com/*' => Http::response('', 200)]);
    config(['queue.default' => 'database']);

    $page = $this->signIn($admin, teamPath('teams.integrations.index', $team));

    $this->openIntegration($page, 'webhook')
        ->click('Show deliveries')
        ->assertScript(p15LogScript(), 'action_item.completed | Failed | 7 | 503')
        ->click('table[aria-label="Deliveries"] button:has-text("Redeliver")')
        ->assertSee('Send this delivery again to hooks.example.com?');

    p15MakeUnredeliverable($case, $integration, $delivery);

    $page->click("{$this->dialogOverPanel()} button:has-text(\"Redeliver\")")
        ->assertSeeIn("{$this->dialogOverPanel()} [role=\"alert\"]", $message);

    expect(IntegrationDelivery::query()->count())->toBe(1);
    Http::assertNothingSent();
})->with([
    'still being sent' => ['still being sent', 'This delivery is still being sent.'],
    'webhook disabled' => ['webhook disabled', 'Turn the webhook back on before redelivering.'],
    'content pruned' => ['content pruned', "This delivery's content is no longer kept."],
]);
