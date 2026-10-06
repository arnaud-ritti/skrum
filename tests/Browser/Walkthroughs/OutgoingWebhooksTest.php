<?php

use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\RetroPhase;
use App\Enums\WebhookEvent;
use App\Models\ActionItem;
use App\Models\Column;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\IntegrationDelivery;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerRound;
use App\Models\PokerTask;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Support\Integrations\Webhook\WebhookHealth;
use Database\Factories\TeamIntegrationFactory;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\Browser\Support\InteractsWithIntegrations;

pest()->use(InteractsWithIntegrations::class);

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     0: Retro,
 *     1: Participant
 * }
 */
function outgoingWebhooksRetro(Team $team, User $admin, RetroPhase $phase = RetroPhase::Discussing, array $attributes = []): array
{
    $retro = Retro::factory()
        ->inPhase($phase)
        ->create(['team_id' => $team->id, 'title' => 'Sprint 42', ...$attributes]);

    $participant = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $admin->id]);

    $retro->forceFill(['facilitator_participant_id' => $participant->id])->save();

    Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Ideas', 'position' => 0]);

    return [$retro->fresh(), $participant];
}

function outgoingWebhooksReceiverAnswers(int $status = 204): void
{
    Http::fake(['hooks.example.com/*' => Http::response('', $status)]);
}

function outgoingWebhooksSentEvent(string $event): Request
{
    return sentRequests()->sole(fn (Request $request): bool => $request->header('X-Skrum-Event')[0] === $event);
}

/**
 * @return array<string, mixed>
 */
function outgoingWebhooksBody(Request $request): array
{
    return json_decode($request->body(), true, flags: JSON_THROW_ON_ERROR);
}

function outgoingWebhooksActionItemInput(): string
{
    return '[data-test="retro-action-items-panel"] [aria-label="Add an action item…"]';
}

function outgoingWebhooksDeliveryCells(string $event): string
{
    return "Array.from(document.querySelectorAll('table[aria-label=\"Deliveries\"] tbody tr')).filter((row) => row.children[1].textContent.startsWith('{$event}')).map((row) => [2, 3, 4, 5].map((index) => row.children[index].textContent).join(' | ')).join(' / ')";
}

it('connects a webhook, shows the secret once and signs the test message with it', function () {
    [$team, $admin] = webhookTeam();
    outgoingWebhooksReceiverAnswers();

    $page = $this->signIn($admin, teamPath('teams.integrations.index', $team));

    $this->assertIntegrationStatus($page, 'webhook', 'Not connected');

    $this->openIntegration($page, 'webhook')
        ->click($this->integrationPanel('webhook').' button:has-text("Connect")')
        ->assertSee('Connect Webhook')
        ->fill($this->dialogOverPanel('input[type="url"]'), 'https://127.0.0.1/skrum')
        ->click($this->dialogOverPanel('button[type="submit"]'))
        ->assertSee('This URL points to a private or invalid address.')
        ->fill($this->dialogOverPanel('input[type="url"]'), TeamIntegrationFactory::WebhookUrl)
        ->fill($this->dialogOverPanel('input[maxlength="80"]'), 'Ops receiver')
        ->click($this->dialogOverPanel('button[type="submit"]'))
        ->assertVisible('input[aria-label="Signing secret"]')
        ->assertSee("Copy this secret now. You won't be able to see it again.")
        ->assertSeeIn($this->dialogOverPanel('pre'), 'HMAC-SHA256');

    $secret = $page->value('input[aria-label="Signing secret"]');
    $integration = TeamIntegration::query()->sole();

    expect($secret)->toMatch('/^[0-9a-f]{64}$/')
        ->and($integration->credential('webhookSecret'))->toBe($secret)
        ->and($integration->credential('url'))->toBe(TeamIntegrationFactory::WebhookUrl)
        ->and((string) DB::table('team_integrations')->value('credentials'))->not->toContain($secret);

    $page->click("I've saved the secret")
        ->assertNotPresent($this->dialogOverPanel())
        ->assertSeeIn($this->integrationPanel('webhook').' [data-slot="provider-details"]', 'hooks.example.com')
        ->assertSeeIn($this->integrationPanel('webhook').' [data-slot="provider-details"]', 'Ops receiver')
        ->assertDontSee('/skrum/incoming')
        ->assertScript("document.documentElement.innerHTML.includes('{$secret}')", false)
        ->click($this->integrationPanel('webhook').' button:has-text("Send a test message")')
        ->assertSee('Test message sent.');

    $this->assertIntegrationStatus($page, 'webhook', 'Connected');

    $request = outgoingWebhooksSentEvent('webhook.test');
    $body = outgoingWebhooksBody($request);

    expect($request->url())->toBe(TeamIntegrationFactory::WebhookUrl)
        ->and(outgoingWebhookSignatureIsValid($request, $secret))->toBeTrue()
        ->and(abs(now()->getTimestamp() - (int) $request->header('X-Skrum-Timestamp')[0]))->toBeLessThanOrEqual(300)
        ->and($request->header('User-Agent')[0])->toBe('skrum-webhooks/1')
        ->and($body['id'])->toBe($request->header('X-Skrum-Delivery')[0])
        ->and($body['team'])->toBe(['id' => $team->id, 'name' => 'Platform'])
        ->and($body['data'])->toBe(['message' => 'skrum is connected.']);

    $page->navigate(teamPath('teams.integrations.index', $team))
        ->assertSee('hooks.example.com')
        ->assertNotPresent('input[aria-label="Signing secret"]')
        ->assertScript("document.documentElement.innerHTML.includes('{$secret}')", false);
});

it('rotates the secret so that the old one no longer verifies a request', function () {
    [$team, $admin] = webhookTeam();
    $integration = outgoingWebhook($team);
    outgoingWebhooksReceiverAnswers();

    $page = $this->signIn($admin, teamPath('teams.integrations.index', $team));

    $this->openIntegration($page, 'webhook')
        ->click('[data-test="rotate-webhook-secret"]')
        ->assertSee('Rotate the signing secret?')
        ->assertSee('The current secret stops working immediately. Update your endpoint with the new one.')
        ->click($this->dialogOverPanel('button:has-text("Rotate secret")'))
        ->assertVisible('input[aria-label="Signing secret"]');

    $newSecret = $page->value('input[aria-label="Signing secret"]');

    expect($newSecret)->toMatch('/^[0-9a-f]{64}$/')
        ->and($newSecret)->not->toBe(TeamIntegrationFactory::WebhookSecret)
        ->and($integration->fresh()->credential('webhookSecret'))->toBe($newSecret);

    $page->click("I've saved the secret")
        ->assertNotPresent($this->dialogOverPanel())
        ->click($this->integrationPanel('webhook').' button:has-text("Send a test message")')
        ->assertSee('Test message sent.');

    $request = outgoingWebhooksSentEvent('webhook.test');

    expect(outgoingWebhookSignatureIsValid($request, $newSecret))->toBeTrue()
        ->and(outgoingWebhookSignatureIsValid($request, TeamIntegrationFactory::WebhookSecret))->toBeFalse();
});

it('subscribes the webhook to the five automatic events', function () {
    [$team, $admin] = webhookTeam();
    $integration = outgoingWebhook($team);

    $page = $this->signIn($admin, teamPath('teams.integrations.index', $team));

    $this->openIntegration($page, 'webhook')
        ->assertSee('Send automatically')
        ->assertCount('[id^="webhook-event-"]', 5)
        ->assertButtonDisabled('Save events');

    foreach (WebhookEvent::values() as $event) {
        $page->click("[id=\"webhook-event-{$event}\"]")
            ->assertAriaAttribute("[id=\"webhook-event-{$event}\"]", 'checked', 'true');
    }

    $page->assertButtonEnabled('Save events')
        ->click('Save events')
        ->assertSee('Events saved.');

    expect($integration->fresh()->setting('events'))->toBe(WebhookEvent::values());

    $page->navigate(teamPath('teams.integrations.index', $team));

    $this->openIntegration($page, 'webhook')
        ->assertSee('Send automatically')
        ->assertButtonDisabled('Save events');

    foreach (WebhookEvent::values() as $event) {
        $page->assertAriaAttribute("[id=\"webhook-event-{$event}\"]", 'checked', 'true');
    }
});

it('sends a board link to the webhook from the board', function () {
    [$team, $admin] = webhookTeam();
    outgoingWebhook($team);
    [$retro] = outgoingWebhooksRetro($team, $admin);
    outgoingWebhooksReceiverAnswers();
    config(['queue.default' => 'database']);

    $page = $this->awaitRealtime($this->signIn($admin, "/retros/{$retro->id}"));

    $page->assertSee('Share')
        ->click('Share')
        ->assertSee('Post a link')
        ->click('Send link to webhook')
        ->assertSee('The message is on its way.')
        ->assertSee('Sending to Webhook…');

    Http::assertNothingSent();

    $this->workQueue();

    $request = outgoingWebhooksSentEvent('retro.link');
    $data = outgoingWebhooksBody($request)['data'];

    expect(outgoingWebhookSignatureIsValid($request))->toBeTrue()
        ->and(array_keys($data))->toBe(['title', 'url', 'sharedBy'])
        ->and($data['title'])->toBe('Sprint 42')
        ->and($data['url'])->toEndWith("/retros/{$retro->id}")
        ->and($data['sharedBy'])->toBe('Ada Admin')
        ->and($request->header('X-Skrum-Delivery')[0])->toBe(IntegrationDelivery::query()->sole()->id);

    $page->assertSee('Sent to Webhook');
});

it('sends a game room invite to the webhook without players or game state', function () {
    [$team, $admin] = webhookTeam();
    outgoingWebhook($team);
    $room = GameRoom::factory()->create(['team_id' => $team->id, 'name' => 'Friday fun']);
    $host = GamePlayer::factory()->create(['game_room_id' => $room->id, 'user_id' => $admin->id]);
    $room->forceFill(['host_player_id' => $host->id])->save();
    outgoingWebhooksReceiverAnswers();
    config(['queue.default' => 'database']);

    $page = $this->awaitRealtime($this->signIn($admin, "/games/{$room->id}"));

    $page->assertSee('Invite')
        ->click('Invite')
        ->assertSeeIn('[data-slot="share-dialog"]', 'Invite to ')
        ->assertSee('Only members of Platform can join.')
        ->click('Send link to webhook')
        ->assertSee('The message is on its way.');

    $this->workQueue();

    $request = outgoingWebhooksSentEvent('game_room.link');
    $data = outgoingWebhooksBody($request)['data'];

    expect(outgoingWebhookSignatureIsValid($request))->toBeTrue()
        ->and(array_keys($data))->toBe(['title', 'game', 'team', 'url', 'sharedBy'])
        ->and($data['title'])->toBe('Friday fun')
        ->and($data['game'])->toBe('Hangman')
        ->and($data['team'])->toBe('Platform')
        ->and($data['url'])->toEndWith("/games/{$room->id}")
        ->and($data['sharedBy'])->toBe('Ada Admin');
});

it('sends the recap of an anonymous retro with a participant count and no card author', function () {
    [$team, $admin] = webhookTeam();
    outgoingWebhook($team);
    [$retro, $participant] = outgoingWebhooksRetro($team, $admin, RetroPhase::Completed, [
        'is_anonymous' => true,
        'completed_at' => now(),
    ]);
    [$carla, $carlaParticipant] = retroMember($retro);
    $carla->forceFill(['name' => 'Carla Author', 'locale' => 'en'])->save();
    webhookTopCard($retro, $carlaParticipant, $participant);
    ActionItem::factory()->assignedTo($admin)->create([
        'retro_id' => $retro->id,
        'content' => 'Fix the deploy',
        'created_by_participant_id' => $participant->id,
    ]);
    outgoingWebhooksReceiverAnswers();
    config(['queue.default' => 'database']);

    $page = $this->awaitRealtime($this->signIn($admin, "/retros/{$retro->id}"));

    $page->assertSee('Share')
        ->click('Share')
        ->assertSee('Send to webhook')
        ->click('Send to webhook')
        ->assertSee('Send the results to the webhook')
        ->assertSee('Participants are shown as a count. Action items are shown with names.')
        ->assertSee('Card authors, votes and comments are never shared.')
        ->click('[role="dialog"] button:has-text("Send")')
        ->assertSee('The message is on its way.');

    $this->workQueue();

    $request = outgoingWebhooksSentEvent('retro.results');
    $data = outgoingWebhooksBody($request)['data'];

    expect(outgoingWebhookSignatureIsValid($request))->toBeTrue()
        ->and($data['title'])->toBe('Sprint 42')
        ->and($data['participants'])->toBe(['count' => 2, 'names' => null])
        ->and($data['actionItems'][0]['content'])->toBe('Fix the deploy')
        ->and($data['actionItems'][0]['assignee'])->toBe('Ada Admin')
        ->and(collect($data['topCards'])->pluck('content')->all())->toContain('Faster reviews')
        ->and($request->body())->not->toContain('Carla Author')
        ->and($request->body())->not->toContain($carla->email)
        ->and($request->body())->not->toContain($admin->email);
});

it('sends created, completed and reopened for an action item and logs the three deliveries', function () {
    [$team, $admin] = webhookTeam();
    outgoingWebhook($team, WebhookEvent::values());
    [$retro] = outgoingWebhooksRetro($team, $admin);
    $input = outgoingWebhooksActionItemInput();
    outgoingWebhooksReceiverAnswers();
    config(['queue.default' => 'database']);

    $page = $this->awaitRealtime($this->signIn($admin, "/retros/{$retro->id}"));

    $page->assertVisible($input)
        ->fill($input, 'Fix the deploy')
        ->keys($input, 'Enter')
        ->assertSeeIn('[data-test="retro-action-items-panel"]', 'Fix the deploy');

    $item = ActionItem::query()->sole();

    $page->click("#action-item-{$item->id} [aria-label=\"Mark as in progress\"]")
        ->click("#action-item-{$item->id} [aria-label=\"Mark as done\"]")
        ->assertPresent("#action-item-{$item->id} [aria-label=\"Reopen\"]")
        ->click("#action-item-{$item->id} [aria-label=\"Reopen\"]")
        ->assertPresent("#action-item-{$item->id} [aria-label=\"Mark as in progress\"]");

    expect(IntegrationDelivery::query()->count())->toBe(3);
    Http::assertNothingSent();

    $this->workQueue();
    $this->workQueue();
    $this->workQueue();

    $created = outgoingWebhooksSentEvent('action_item.created');
    $completed = outgoingWebhooksSentEvent('action_item.completed');
    $reopened = outgoingWebhooksSentEvent('action_item.reopened');

    expect(sentRequests()->every(fn (Request $request): bool => outgoingWebhookSignatureIsValid($request)))->toBeTrue()
        ->and(sentRequests()->every(fn (Request $request): bool => ! str_contains($request->body(), $admin->email)))->toBeTrue()
        ->and(outgoingWebhooksBody($created)['data']['actionItem']['content'])->toBe('Fix the deploy')
        ->and(outgoingWebhooksBody($created)['data']['actionItem']['status'])->toBe('open')
        ->and(outgoingWebhooksBody($created)['data']['actionItem']['createdBy'])->toBe(['name' => 'Ada Admin'])
        ->and(outgoingWebhooksBody($completed)['data']['actionItem']['status'])->toBe('completed')
        ->and(outgoingWebhooksBody($completed)['data']['actionItem']['completedBy'])->toBe(['name' => 'Ada Admin'])
        ->and(outgoingWebhooksBody($completed)['data']['origin'])->toBe('skrum')
        ->and(outgoingWebhooksBody($reopened)['data']['actionItem']['status'])->toBe('open')
        ->and(outgoingWebhooksBody($reopened)['data']['actionItem']['completedBy'])->toBeNull();

    $page->navigate(teamPath('teams.integrations.index', $team));

    $this->openIntegration($page, 'webhook')
        ->click('Show deliveries')
        ->assertCount('table[aria-label="Deliveries"] tbody tr', 3)
        ->assertScript(outgoingWebhooksDeliveryCells('action_item.created'), 'Sent | 1 | 204 | —')
        ->assertScript(outgoingWebhooksDeliveryCells('action_item.completed'), 'Sent | 1 | 204 | —')
        ->assertScript(outgoingWebhooksDeliveryCells('action_item.reopened'), 'Sent | 1 | 204 | —');
});

it('sends retro.completed with the recap and hides who took part in an anonymous retro', function () {
    [$team, $admin] = webhookTeam();
    outgoingWebhook($team, WebhookEvent::values());
    [$retro, $participant] = outgoingWebhooksRetro($team, $admin, RetroPhase::Discussing, ['is_anonymous' => true]);
    [$carla, $carlaParticipant] = retroMember($retro);
    $carla->forceFill(['name' => 'Carla Author', 'locale' => 'en'])->save();
    webhookTopCard($retro, $carlaParticipant, $participant);
    outgoingWebhooksReceiverAnswers();
    config(['queue.default' => 'database']);

    $page = $this->awaitRealtime($this->signIn($admin, "/retros/{$retro->id}"));

    $page->assertSeeIn('[aria-current="step"]', 'Discussing')
        ->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'Actions')
        ->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'ROTI')
        ->press('Complete')
        ->assertSeeIn('[aria-current="step"]', 'Completed');

    $this->workQueue();

    $request = outgoingWebhooksSentEvent('retro.completed');
    $data = outgoingWebhooksBody($request)['data'];

    expect(outgoingWebhookSignatureIsValid($request))->toBeTrue()
        ->and($data['retro'])->toBe(['id' => $retro->id])
        ->and($data['title'])->toBe('Sprint 42')
        ->and($data['participants'])->toBe(['count' => 2, 'names' => null])
        ->and(collect($data['topCards'])->pluck('content')->all())->toContain('Faster reviews')
        ->and($request->body())->not->toContain('Carla Author')
        ->and($request->body())->not->toContain($carla->email);

    $page->navigate(teamPath('teams.integrations.index', $team));

    $this->openIntegration($page, 'webhook')
        ->click('Show deliveries')
        ->assertScript(outgoingWebhooksDeliveryCells('retro.completed'), 'Sent | 1 | 204 | —');
});

it('sends poker.task.estimated when the facilitator saves an estimate, without players or votes', function () {
    [$team, $admin] = webhookTeam();
    outgoingWebhook($team, WebhookEvent::values());
    $game = PokerGame::factory()->create(['team_id' => $team->id, 'title' => 'Sprint 12 sizing']);
    $player = PokerPlayer::factory()->create(['poker_game_id' => $game->id, 'user_id' => $admin->id]);
    $task = PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Login page']);
    $round = PokerRound::factory()->revealed()->create(['poker_task_id' => $task->id]);
    pokerVote($round, $player, '5');
    $game->forceFill(['facilitator_player_id' => $player->id, 'current_task_id' => $task->id])->save();
    outgoingWebhooksReceiverAnswers();
    config(['queue.default' => 'database']);

    $page = $this->awaitRealtime($this->signIn($admin, "/poker/{$game->id}"));

    $page->assertAttribute('[aria-label="Final estimate"] [aria-checked="true"]', 'aria-label', '5')
        ->assertSee('Validate 5')
        ->click('@poker-validate')
        ->assertSee('Estimate: 5');

    $this->workQueue();

    $request = outgoingWebhooksSentEvent('poker.task.estimated');
    $data = outgoingWebhooksBody($request)['data'];

    expect(outgoingWebhookSignatureIsValid($request))->toBeTrue()
        ->and($data['game']['title'])->toBe('Sprint 12 sizing')
        ->and($data['task']['title'])->toBe('Login page')
        ->and($data['task']['estimate'])->toBe('5')
        ->and($data['task']['external'])->toBeNull()
        ->and(array_keys($data))->toBe(['game', 'task', 'estimatedAt'])
        ->and($request->body())->not->toContain('Ada Admin');

    $page->navigate(teamPath('teams.integrations.index', $team));

    $this->openIntegration($page, 'webhook')
        ->click('Show deliveries')
        ->assertScript(outgoingWebhooksDeliveryCells('poker.task.estimated'), 'Sent | 1 | 204 | —');
});

it('retries an event seven times with the same delivery id against a receiver answering 500', function () {
    [$team, $admin] = webhookTeam();
    $integration = outgoingWebhook($team, ['action_item.created']);
    [$retro] = outgoingWebhooksRetro($team, $admin);
    $input = outgoingWebhooksActionItemInput();
    outgoingWebhooksReceiverAnswers(500);
    config(['queue.default' => 'database']);

    $page = $this->awaitRealtime($this->signIn($admin, "/retros/{$retro->id}"));

    $page->assertVisible($input)
        ->fill($input, 'Retry me')
        ->keys($input, 'Enter')
        ->assertSeeIn('[data-test="retro-action-items-panel"]', 'Retry me');

    $delivery = IntegrationDelivery::query()->sole();

    $this->workQueue();

    $page->navigate(teamPath('teams.integrations.index', $team));

    $this->openIntegration($page, 'webhook')
        ->click('Show deliveries')
        ->assertScript(outgoingWebhooksDeliveryCells('action_item.created'), 'Queued | 1 | 500 | —');

    $this->travel(30)->seconds();
    $this->workQueue();

    $page->click('Hide deliveries')
        ->click('Show deliveries')
        ->assertScript(outgoingWebhooksDeliveryCells('action_item.created'), 'Queued | 2 | 500 | —');

    foreach ([120, 600, 1800, 3600, 7200] as $seconds) {
        $this->travel($seconds)->seconds();
        $this->workQueue();
    }

    $requests = sentRequests();

    expect($requests)->toHaveCount(7)
        ->and($requests->map(fn (Request $request): string => $request->header('X-Skrum-Delivery')[0])->unique()->values()->all())->toBe([$delivery->id])
        ->and($requests->map(fn (Request $request): string => $request->header('X-Skrum-Timestamp')[0])->unique())->toHaveCount(7)
        ->and($requests->every(fn (Request $request): bool => outgoingWebhookSignatureIsValid($request)))->toBeTrue()
        ->and($delivery->fresh()->status)->toBe(IntegrationDeliveryStatus::Failed)
        ->and($delivery->fresh()->attempts)->toBe(7)
        ->and($integration->fresh()->consecutive_failures)->toBe(1)
        ->and($integration->fresh()->status)->toBe(IntegrationStatus::Active);

    $after = $this->signIn($admin, teamPath('teams.integrations.index', $team));

    $this->openIntegration($after, 'webhook')
        ->assertNotPresent('button:has-text("Re-enable")')
        ->click('Show deliveries')
        ->assertScript(outgoingWebhooksDeliveryCells('action_item.created'), 'Failed | 7 | 500 | Webhook did not respond. Try again later.');
});

it('disables the webhook at the tenth failed delivery in a row and sends again once re-enabled', function () {
    [$team, $admin] = webhookTeam();
    $integration = outgoingWebhook($team);
    $integration->forceFill(['consecutive_failures' => 9])->save();
    [$retro] = outgoingWebhooksRetro($team, $admin);
    $status = 500;
    Http::fake(['hooks.example.com/*' => function () use (&$status) {
        return Http::response('', $status);
    }]);
    config(['queue.default' => 'database']);

    $page = $this->awaitRealtime($this->signIn($admin, "/retros/{$retro->id}"));

    $page->assertSee('Share')
        ->click('Share')
        ->assertSee('Post a link')
        ->click('Send link to webhook')
        ->assertSee('The message is on its way.');

    $this->workQueue();

    foreach ([10, 60, 300] as $seconds) {
        $this->travel($seconds)->seconds();
        $this->workQueue();
    }

    expect($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($integration->fresh()->consecutive_failures)->toBe(10)
        ->and($integration->fresh()->setting('disabledReason'))->toBe(WebhookHealth::FailuresReason);
    Http::assertSentCount(4);

    $page->navigate(teamPath('teams.integrations.index', $team));

    $this->assertIntegrationStatus($page, 'webhook', 'Reconnect required');

    $this->openIntegration($page, 'webhook')
        ->assertSee('Disabled after 10 failed deliveries in a row.')
        ->assertSee('Re-enable')
        ->click('Show deliveries')
        ->assertScript(outgoingWebhooksDeliveryCells('retro.link'), 'Failed | 4 | 500 | Webhook did not respond. Try again later.');

    $status = 204;

    $page->click('Re-enable')
        ->assertSee('Webhook re-enabled.')
        ->assertNotPresent('button:has-text("Re-enable")')
        ->assertDontSee('Disabled after 10 failed deliveries in a row.')
        ->click($this->integrationPanel('webhook').' button:has-text("Send a test message")')
        ->assertSee('Test message sent.');

    expect($integration->fresh()->status)->toBe(IntegrationStatus::Active)
        ->and($integration->fresh()->consecutive_failures)->toBe(0)
        ->and($integration->fresh()->setting('disabledReason'))->toBeNull();
    Http::assertSentCount(5);
});

it('stops at once when the receiver answers 410 and says that the receiver asked to stop', function () {
    [$team, $admin] = webhookTeam();
    $integration = outgoingWebhook($team, ['action_item.completed']);
    [$retro, $participant] = outgoingWebhooksRetro($team, $admin);
    $item = ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'content' => 'Fix the deploy',
        'created_by_participant_id' => $participant->id,
    ]);
    outgoingWebhooksReceiverAnswers(410);
    config(['queue.default' => 'database']);

    $page = $this->awaitRealtime($this->signIn($admin, "/retros/{$retro->id}"));

    $page->click("#action-item-{$item->id} [aria-label=\"Mark as in progress\"]")
        ->click("#action-item-{$item->id} [aria-label=\"Mark as done\"]")
        ->assertPresent("#action-item-{$item->id} [aria-label=\"Reopen\"]");

    $this->workQueue();

    expect($integration->fresh()->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($integration->fresh()->setting('disabledReason'))->toBe(WebhookHealth::GoneReason);
    Http::assertSentCount(1);

    $page->navigate(teamPath('teams.integrations.index', $team));

    $this->assertIntegrationStatus($page, 'webhook', 'Reconnect required');

    $this->openIntegration($page, 'webhook')
        ->assertSee('The receiver asked skrum to stop.')
        ->assertSee('Re-enable')
        ->click('Show deliveries')
        ->assertScript(outgoingWebhooksDeliveryCells('action_item.completed'), 'Failed | 1 | 410 | The receiver asked skrum to stop.');
});

it('gives a team member no way to the webhook: no Integrations link, 403 on the page and on a posted URL', function () {
    [$team] = webhookTeam();
    outgoingWebhooksReceiverAnswers();
    $integration = outgoingWebhook($team);
    $member = teamMember($team);
    $member->forceFill(['name' => 'Bob Member', 'locale' => 'en'])->save();
    $storeUrl = route('teams.integrations.urls.store', [$team->workspace, $team, 'provider' => IntegrationProvider::Webhook->value], false);
    $receiverUrl = 'https://hooks.example.com/skrum/taken-over';

    $page = $this->signIn($member, route('teams.show', [$team->workspace, $team], false));

    $page->assertSee('Insights')
        ->assertNotPresent('[data-sidebar="content"] a[aria-label="Settings"]')
        ->assertNotPresent('main a[href$="/integrations"]');

    $status = $this->sendFromPage($page, 'POST', $storeUrl, ['url' => $receiverUrl, 'channel_label' => 'Taken over'])['status'];

    expect($status)->toBe(403)
        ->and(TeamIntegration::query()->count())->toBe(1)
        ->and($integration->fresh()->credential('url'))->toBe(TeamIntegrationFactory::WebhookUrl);

    $page->navigate(teamPath('teams.integrations.index', $team))
        ->assertSee('403')
        ->assertNotPresent('[data-test^="integration-card-"]')
        ->assertDontSee('hooks.example.com');

    Http::assertNothingSent();
});
