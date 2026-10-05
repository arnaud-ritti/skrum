<?php

use App\Enums\IntegrationDeliveryStatus;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\RetroPhase;
use App\Enums\SummaryStatus;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Column;
use App\Models\IntegrationDelivery;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\RotiVote;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Models\Vote;
use App\Notifications\RetroResultsNotification;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Tests\Browser\Support\InteractsWithIntegrations;

pest()->use(InteractsWithIntegrations::class);

beforeEach(function () {
    disableIntegrations();
    enableIntegrations(IntegrationProvider::Slack, IntegrationProvider::Telegram);
    config(['queue.default' => 'database']);
});

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     0: Retro,
 *     1: User,
 *     2: Participant
 * }
 */
function integrationsSharingRetro(RetroPhase $phase = RetroPhase::Discussing, array $attributes = []): array
{
    $retro = Retro::factory()->inPhase($phase)->create([
        'title' => 'Sprint 42',
        'team_id' => Team::factory()->create(['name' => 'Platform'])->id,
        ...$attributes,
    ]);
    TeamIntegration::factory()->slack()->create(['team_id' => $retro->team_id]);
    TeamIntegration::factory()->telegram()->create(['team_id' => $retro->team_id]);
    [$fran, $participant] = retroFacilitator($retro);
    $fran->forceFill(['name' => 'Fran Facilitator', 'locale' => 'en'])->save();

    return [$retro->refresh(), $fran, $participant];
}

function integrationsSharingFakeChats(): void
{
    Http::fake([
        'hooks.slack.com/*' => Http::response('ok'),
        'api.telegram.org/*' => Http::response(['ok' => true, 'result' => ['message_id' => 1]]),
    ]);
}

it('posts the board link to Slack with the guest link and to Telegram without it', function () {
    integrationsSharingFakeChats();
    [$retro, $fran] = integrationsSharingRetro(attributes: ['guest_access_enabled' => true]);
    $lines = '[role="dialog"] [data-slot="delivery-lines"]';
    $guestLink = '[role="dialog"] button[role="checkbox"]';

    $page = $this->awaitRealtime($this->signIn($fran, "/retros/{$retro->id}"));

    $page->assertSee('Share')
        ->click('Share')
        ->assertSee('Post a link')
        ->assertVisible($guestLink)
        ->click($guestLink)
        ->assertAriaAttribute($guestLink, 'checked', 'true')
        ->click('Post link to Slack')
        ->assertSee('The message is on its way.')
        ->assertSeeIn($lines, 'Sending to Slack…');

    $this->workQueue();

    $page->assertSeeIn($lines, 'Sent to Slack')
        ->click($guestLink)
        ->assertAriaAttribute($guestLink, 'checked', 'false')
        ->click('Post link to Telegram')
        ->assertSeeIn($lines, 'Sending to Telegram…');

    $this->workQueue();

    $page->assertSeeIn($lines, 'Sent to Telegram')
        ->assertSeeIn($lines, 'Sent to Slack');

    [$slack] = chatRequestsSentTo('hooks.slack.com');
    [$telegram] = chatRequestsSentTo('api.telegram.org');
    $guestUrl = (string) $slack['blocks'][1]['elements'][0]['url'];

    expect($slack->url())->toBe('https://hooks.slack.com/services/T000/B000/XXXX')
        ->and($slack['text'])->toBe('Fran Facilitator invites you to the retrospective "Sprint 42" (Platform)')
        ->and($slack['blocks'][1]['elements'][0]['type'])->toBe('button')
        ->and($slack['blocks'][1]['elements'][0]['text']['text'])->toBe('Open the retrospective')
        ->and($guestUrl)->toEndWith("/join/{$retro->guest_token}")
        ->and($telegram->url())->toEndWith('/sendMessage')
        ->and($telegram['chat_id'])->toBe('-100123')
        ->and($telegram['text'])->toContain("/retros/{$retro->id}\">Open the retrospective</a>")
        ->and($telegram['text'])->not->toContain($retro->guest_token);

    $guest = visit((string) parse_url($guestUrl, PHP_URL_PATH));

    $guest->assertVisible('#name')
        ->assertSee('Join');
});

it('offers the guest link option only when guest access is on, and the Share button only to the facilitator', function () {
    integrationsSharingFakeChats();
    [$retro, $fran] = integrationsSharingRetro();
    [$bob] = retroMember($retro);
    $bob->forceFill(['name' => 'Bob Stone', 'locale' => 'en'])->save();

    $facilitator = $this->awaitRealtime($this->signIn($fran, "/retros/{$retro->id}"));
    $member = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $facilitator->assertSee('Share')
        ->click('Share')
        ->assertSee('Post a link')
        ->assertSee('Post link to Slack')
        ->assertSee('Post link to Telegram')
        ->assertNotPresent('[role="dialog"] button[role="checkbox"]');

    $member->assertSeeIn('header >> h1', 'Sprint 42')
        ->assertNotPresent('button:has-text("Share")');

    Http::assertNothingSent();
});

it('offers no post-a-link section in the share dialog of the board and no share entry on the results or the poker game while the providers are disabled', function () {
    disableIntegrations();
    [$retro, $fran] = integrationsSharingRetro();
    $game = PokerGame::factory()->create(['title' => 'Sprint 12 sizing', 'team_id' => $retro->team_id]);
    [$ada] = pokerFacilitator($game);
    $ada->forceFill(['name' => 'Ada Facilitator', 'locale' => 'en'])->save();

    $board = $this->awaitRealtime($this->signIn($fran, "/retros/{$retro->id}"));

    $board->assertSeeIn('header >> h1', 'Sprint 42')
        ->assertPresent('[aria-label="Facilitator menu"]')
        ->click('Share')
        ->assertVisible('[role="dialog"] [role="switch"]')
        ->assertDontSee('Post a link')
        ->assertNotPresent('[role="dialog"] button:has-text("Post link")')
        ->keys('[role="dialog"]', 'Escape')
        ->assertNotPresent('[role="dialog"]');

    $retro->forceFill(['phase' => RetroPhase::Completed, 'completed_at' => now()])->save();

    $board->navigate("/retros/{$retro->id}");

    $this->awaitRealtime($board)
        ->assertSee('Session ended')
        ->assertNotPresent('button:has-text("Share")');

    $poker = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $poker->click('[aria-label="Facilitator menu"]')
        ->assertSee('Hand over facilitation…')
        ->assertDontSee('Share…');
});

it('escapes a retro title made of Slack and HTML markup in both messages', function () {
    integrationsSharingFakeChats();
    [$retro, $fran] = integrationsSharingRetro(attributes: ['title' => '<!channel> & <b>test</b>']);
    $lines = '[role="dialog"] [data-slot="delivery-lines"]';

    $page = $this->awaitRealtime($this->signIn($fran, "/retros/{$retro->id}"));

    $page->assertSeeIn('header >> h1', '<!channel> & <b>test</b>')
        ->click('Share')
        ->assertSee('Post a link')
        ->click('Post link to Slack')
        ->assertSeeIn($lines, 'Sending to Slack…')
        ->click('Post link to Telegram')
        ->assertSeeIn($lines, 'Sending to Telegram…');

    $this->workQueue();
    $this->workQueue();

    $page->assertSeeIn($lines, 'Sent to Slack')
        ->assertSeeIn($lines, 'Sent to Telegram');

    [$slack] = chatRequestsSentTo('hooks.slack.com');
    [$telegram] = chatRequestsSentTo('api.telegram.org');

    expect($slack['text'])->toBe('Fran Facilitator invites you to the retrospective "&lt;!channel&gt; &amp; &lt;b&gt;test&lt;/b&gt;" (Platform)')
        ->and($slack['blocks'][0]['text']['text'])->toBe($slack['text'])
        ->and(requestText($slack))->not->toContain('<!channel>')
        ->and($telegram['text'])->toStartWith('Fran Facilitator invites you to the retrospective &quot;&lt;!channel&gt; &amp; &lt;b&gt;test&lt;/b&gt;&quot; (Platform)')
        ->and($telegram['text'])->not->toContain('<b>')
        ->and($telegram['text'])->not->toContain('<!channel>')
        ->and($telegram['parse_mode'])->toBe('HTML');
});

it('shares the recap of an anonymous retro with counts, named action items and no card author', function () {
    integrationsSharingFakeChats();
    configureLlm();
    [$retro, $fran, $franParticipant] = integrationsSharingRetro(RetroPhase::Completed, [
        'is_anonymous' => true,
        'completed_at' => now(),
        'summary_status' => SummaryStatus::Pending,
        'summary_requested_at' => now(),
    ]);
    [$bob, $bobParticipant] = retroMember($retro);
    $bob->forceFill(['name' => 'Bob Stone', 'locale' => 'en'])->save();
    [$cara, $caraParticipant] = retroMember($retro);
    $cara->forceFill(['name' => 'Cara Author', 'locale' => 'en'])->save();
    $gus = Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Gus']);
    $wins = Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Wins', 'position' => 0]);
    $card = Card::factory()->create([
        'retro_id' => $retro->id,
        'column_id' => $wins->id,
        'participant_id' => $caraParticipant->id,
        'content' => 'Faster reviews',
    ]);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $bobParticipant->id]);
    ActionItem::factory()->assignedToGuest($gus)->create([
        'content' => 'Write the runbook',
        'created_by_participant_id' => $franParticipant->id,
    ]);
    ActionItem::factory()->assignedTo($bob)->create([
        'retro_id' => $retro->id,
        'content' => 'Tidy the backlog',
        'created_by_participant_id' => $franParticipant->id,
    ]);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $bobParticipant->id, 'score' => 4]);

    $page = $this->awaitRealtime($this->signIn($fran, "/retros/{$retro->id}"));

    $page->assertSee('Session ended')
        ->click('Share')
        ->assertSee('Share to Slack')
        ->assertSee('Share to Telegram')
        ->assertDontSee('Send the recap by email')
        ->click('Share to Slack')
        ->assertSee('Share the results to Slack')
        ->assertSee('The summary is still being generated and will not be included.')
        ->assertSee('Participants are shown as a count. Action items are shown with names.')
        ->assertSee('Card authors, votes and comments are never shared.')
        ->click('[role="dialog"] button:has-text("Send")')
        ->assertSee('The message is on its way.')
        ->assertNotPresent('[role="dialog"]')
        ->assertSee('Sending to Slack…');

    $this->workQueue();

    $page->assertSee('Sent to Slack')
        ->assertNotPresent('[role="menu"]')
        ->click('Share')
        ->assertSee('Share to Telegram')
        ->click('Share to Telegram')
        ->assertSee('Share the results to Telegram')
        ->click('[role="dialog"] button:has-text("Send")')
        ->assertNotPresent('[role="dialog"]')
        ->assertSee('Sending to Telegram…');

    $this->workQueue();

    $page->assertSee('Sent to Telegram');

    [$slack] = chatRequestsSentTo('hooks.slack.com');
    [$telegram] = chatRequestsSentTo('api.telegram.org');

    expect([requestText($slack), (string) $telegram['text']])
        ->each->toContain('Results of the retrospective')
        ->toContain('Participants: 4')
        ->toContain('Cards: 1')
        ->toContain('ROTI: 4.0/5 (1 answer)')
        ->toContain('Write the runbook — Gus (guest)')
        ->toContain('Tidy the backlog — Bob Stone')
        ->toContain('Wins — Faster reviews (votes: 1)')
        ->not->toContain('Participants (4)')
        ->not->toContain('Cara Author')
        ->not->toContain('Fran Facilitator')
        ->not->toContain('Summary');
});

it('emails the results to participants with an account in their own language, never to guests, and refuses a second send for ten minutes', function () {
    config(['mail.default' => 'smtp']);
    Mail::fake();
    Notification::fake();
    integrationsSharingFakeChats();
    [$retro, $fran] = integrationsSharingRetro(RetroPhase::Completed, ['completed_at' => now()]);
    [$bob] = retroMember($retro);
    $bob->forceFill(['name' => 'Bob Stone', 'locale' => 'fr'])->save();
    [$dora] = retroMember($retro);
    $dora->forceFill(['name' => 'Dora Klein', 'locale' => 'de'])->save();
    Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Gus']);
    $bystander = teamMember($retro->team);
    $send = '[role="dialog"] button:has-text("Send")';

    $page = $this->awaitRealtime($this->signIn($fran, "/retros/{$retro->id}"));

    $page->assertSee('Session ended')
        ->assertSee('Send the recap by email')
        ->click('Send the recap by email')
        ->assertSee('Email the results')
        ->assertSee('Participants with an account (3)')
        ->assertSee('All team members (4)')
        ->assertSee('Guests have no account and are never emailed.')
        ->click($send)
        ->assertSee('The results are on their way.')
        ->assertNotPresent('[role="dialog"]')
        ->assertSee('Emailed to 3 people');

    Notification::assertCount(3);
    Notification::assertSentTo($fran, RetroResultsNotification::class, fn (RetroResultsNotification $notification, array $channels, object $notifiable, ?string $locale): bool => $notification->retroId === $retro->id && $locale === 'en');
    Notification::assertSentTo($bob, RetroResultsNotification::class, fn (RetroResultsNotification $notification, array $channels, object $notifiable, ?string $locale): bool => $locale === 'fr');
    Notification::assertSentTo($dora, RetroResultsNotification::class, fn (RetroResultsNotification $notification, array $channels, object $notifiable, ?string $locale): bool => $locale === 'de');
    Notification::assertNotSentTo($bystander, RetroResultsNotification::class);

    $page->assertNotPresent('[role="menu"]')
        ->click('Send the recap by email')
        ->assertSee('Email the results')
        ->click($send)
        ->assertSee('The results were emailed a few minutes ago.')
        ->click('[role="dialog"] button:has-text("Cancel")')
        ->assertNotPresent('[role="dialog"]');

    Notification::assertCount(3);

    $this->travel(11)->minutes();

    $page->assertNotPresent('[role="menu"]')
        ->click('Send the recap by email')
        ->assertSee('Email the results')
        ->click('[role="dialog"] label:has-text("All team members (4)")')
        ->click($send)
        ->assertNotPresent('[role="dialog"]');

    Notification::assertCount(7);
    Notification::assertSentTo($bystander, RetroResultsNotification::class);
});

it('posts the poker game link from "Share…" and removes the item once the game is ended', function () {
    integrationsSharingFakeChats();
    $game = PokerGame::factory()->create([
        'title' => 'Sprint 12 sizing',
        'team_id' => Team::factory()->create(['name' => 'Platform'])->id,
    ]);
    TeamIntegration::factory()->slack()->create(['team_id' => $game->team_id]);
    [$ada] = pokerFacilitator($game);
    $ada->forceFill(['name' => 'Ada Facilitator', 'locale' => 'en'])->save();
    $lines = '[role="dialog"] [data-slot="delivery-lines"]';

    $page = $this->awaitRealtime($this->signIn($ada, "/poker/{$game->id}"));

    $page->click('[aria-label="Facilitator menu"]')
        ->assertSee('Share…')
        ->click('Share…')
        ->assertSee('Invite to Sprint 12 sizing')
        ->assertNotPresent('[role="dialog"] button[role="checkbox"]')
        ->assertNotPresent('[role="dialog"] button:has-text("Post link to Telegram")')
        ->click('Post link to Slack')
        ->assertSee('The message is on its way.')
        ->assertSeeIn($lines, 'Sending to Slack…');

    $this->workQueue();

    $page->assertSeeIn($lines, 'Sent to Slack')
        ->click('[role="dialog"] button:has-text("Close")')
        ->assertNotPresent('[role="dialog"]');

    [$slack] = chatRequestsSentTo('hooks.slack.com');

    expect($slack['text'])->toBe('Ada Facilitator invites you to the planning poker game "Sprint 12 sizing" (Platform)')
        ->and($slack['blocks'][1]['elements'][0]['text']['text'])->toBe('Open the game')
        ->and($slack['blocks'][1]['elements'][0]['url'])->toEndWith("/poker/{$game->id}");

    $page->click('[aria-label="Facilitator menu"]')
        ->assertSee('End game')
        ->click('End game')
        ->assertSee('End this game?')
        ->click('[role="alertdialog"] button:has-text("End game")')
        ->assertNotPresent('[role="alertdialog"]')
        ->assertNotPresent('[role="menu"]')
        ->click('[aria-label="Facilitator menu"]')
        ->assertSee('Reopen game')
        ->assertDontSee('Share…');

    expect($game->fresh()->isEnded())->toBeTrue();
});

it('turns the delivery line to failed and the Slack card to "Reconnect required" when the channel is gone', function () {
    Http::fake([
        'hooks.slack.com/*' => Http::response('channel_is_archived', 410),
        'api.telegram.org/*/getMe' => Http::response(['ok' => true, 'result' => ['id' => 42, 'is_bot' => true, 'username' => 'skrum_test_bot']]),
        'api.telegram.org/*' => Http::response(['ok' => true, 'result' => ['message_id' => 1]]),
    ]);
    [$retro, $fran] = integrationsSharingRetro();
    $admin = integrationAdmin($retro->team);
    $admin->forceFill(['name' => 'Ada Admin', 'locale' => 'en'])->save();
    $lines = '[role="dialog"] [data-slot="delivery-lines"]';
    $slackPanel = '[data-test="integration-panel-slack"]';

    $page = $this->awaitRealtime($this->signIn($fran, "/retros/{$retro->id}"));

    $page->click('Share')
        ->assertSee('Post a link')
        ->click('Post link to Slack')
        ->assertSeeIn($lines, 'Sending to Slack…');

    $this->workQueue();

    $page->assertSeeIn($lines, 'Slack: failed — Reconnect Slack in the team settings.')
        ->assertNotPresent('[role="dialog"] button:has-text("Post link to Slack")')
        ->assertPresent('[role="dialog"] button:has-text("Post link to Telegram")');

    $slack = $retro->team->integration(IntegrationProvider::Slack);

    expect($slack?->status)->toBe(IntegrationStatus::ReconnectRequired)
        ->and($slack?->last_error)->toBe('channel_is_archived')
        ->and(IntegrationDelivery::query()->sole()->status)->toBe(IntegrationDeliveryStatus::Failed);

    $settings = $this->signIn($admin, route('teams.integrations.index', [$retro->team->workspace, $retro->team], false));

    $this->assertIntegrationStatus($settings, 'slack', 'Reconnect required');
    $this->assertIntegrationStatus($settings, 'telegram', 'Connected');

    $this->openIntegration($settings, 'slack')
        ->assertSeeIn($slackPanel, 'channel_is_archived')
        ->assertNotPresent("{$slackPanel} button:has-text(\"Send a test message\")");
});
