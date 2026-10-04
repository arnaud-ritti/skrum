<?php

use App\Enums\GameKind;
use App\Enums\IntegrationProvider;
use App\Enums\IntegrationStatus;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Column;
use App\Models\GameRoom;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RotiVote;
use App\Models\Team;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Models\Vote;
use Database\Factories\TeamIntegrationFactory;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Http;
use Tests\Browser\Support\InteractsWithIntegrations;

uses(InteractsWithIntegrations::class);

beforeEach(function () {
    disableIntegrations();
    enableIntegrations(IntegrationProvider::MicrosoftTeams, IntegrationProvider::Mattermost);
    config(['queue.default' => 'database']);
});

function p14aAdmin(Team $team): User
{
    $admin = integrationAdmin($team);

    $admin->forceFill(['name' => 'Ada Admin', 'locale' => 'en'])->save();

    return $admin;
}

function p14aIntegrationsPath(Team $team): string
{
    return route('teams.integrations.index', [$team->workspace, $team], false);
}

function p14aCard(string $provider): string
{
    return "[data-test=\"integration-card-{$provider}\"]";
}

function p14aPanel(string $provider): string
{
    return "[data-test=\"integration-panel-{$provider}\"]";
}

function p14aForm(string $field): string
{
    return "[role=\"dialog\"][data-slot=\"dialog-content\"] {$field}";
}

function p14aConnectChats(Team $team): void
{
    TeamIntegration::factory()->microsoftTeams()->create(['team_id' => $team->id]);
    TeamIntegration::factory()->mattermost()->create(['team_id' => $team->id]);
}

function p14aFakeChats(int $teamsStatus = 202): void
{
    Http::fake([
        'prod-12.westeurope.logic.azure.com/*' => Http::response($teamsStatus === 202 ? '' : '{"error":{"code":"WorkflowNotFound"}}', $teamsStatus),
        'chat.example.com/*' => Http::response('ok'),
    ]);
}

/**
 * @return array<int, Request>
 */
function p14aSentTo(string $host): array
{
    return Http::recorded(fn (Request $request): bool => str_contains($request->url(), $host))
        ->map(fn (array $pair): Request => $pair[0])
        ->values()
        ->all();
}

function p14aText(Request $request): string
{
    return implode("\n", array_filter(Arr::flatten($request->data()), is_string(...)));
}

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     0: Retro,
 *     1: User,
 *     2: Participant
 * }
 */
function p14aRetro(RetroPhase $phase = RetroPhase::Discussing, array $attributes = []): array
{
    $retro = Retro::factory()->inPhase($phase)->create([
        'title' => 'Sprint *42*',
        'team_id' => Team::factory()->create(['name' => 'Platform'])->id,
        ...$attributes,
    ]);
    p14aConnectChats($retro->team);
    [$fran, $participant] = retroFacilitator($retro);
    $fran->forceFill(['name' => 'Fran Facilitator', 'locale' => 'en'])->save();

    return [$retro->refresh(), $fran, $participant];
}

it('[P14a-01a] connects a Microsoft Teams workflow by pasting its URL and never sends the URL back to the browser', function () {
    p14aFakeChats();
    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = p14aAdmin($team);
    $teams = p14aPanel('msteams');
    $url = p14aForm('input[type="url"]');

    $page = $this->signIn($admin, p14aIntegrationsPath($team));

    $page->assertCount('[data-test^="integration-card-"]', 2)
        ->assertSeeIn(p14aCard('msteams').' h3', 'Microsoft Teams');

    $this->assertIntegrationStatus($page, 'msteams', 'Not connected');

    $this->openIntegration($page, 'msteams')
        ->click("{$teams} button:has-text(\"Connect\")")
        ->assertSee('Connect Microsoft Teams')
        ->fill($url, 'https://example.com/workflows/abc')
        ->click(p14aForm('button[type="submit"]'))
        ->assertSee('Use the workflow URL from Microsoft Teams.')
        ->fill($url, TeamIntegrationFactory::MicrosoftTeamsUrl)
        ->fill(p14aForm('input[maxlength="80"]'), 'Retro channel')
        ->click(p14aForm('button[type="submit"]'))
        ->assertSee('Microsoft Teams connected.')
        ->assertNotPresent($this->dialogOverPanel())
        ->assertSeeIn("{$teams} [data-slot=\"provider-details\"]", 'prod-12.westeurope.logic.azure.com')
        ->assertSeeIn("{$teams} [data-slot=\"provider-details\"]", 'Retro channel')
        ->assertSeeIn($teams, 'Ada Admin')
        ->assertPresent("{$teams} button:has-text(\"Replace URL\")");

    $this->assertIntegrationStatus($page, 'msteams', 'Connected');

    $page->navigate(p14aIntegrationsPath($team));

    $this->assertIntegrationStatus($page, 'msteams', 'Connected')
        ->assertSourceMissing('teams-signature');

    $integration = TeamIntegration::query()->sole();

    expect($integration->provider)->toBe(IntegrationProvider::MicrosoftTeams)
        ->and($integration->credential('url'))->toBe(TeamIntegrationFactory::MicrosoftTeamsUrl)
        ->and($integration->setting('channelLabel'))->toBe('Retro channel');

    Http::assertNothingSent();
});

it('[P14a-01b] connects a Mattermost incoming webhook of the configured server only', function () {
    p14aFakeChats();
    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = p14aAdmin($team);
    $mattermost = p14aPanel('mattermost');
    $url = p14aForm('input[type="url"]');

    $page = $this->signIn($admin, p14aIntegrationsPath($team));

    $this->assertIntegrationStatus($page, 'mattermost', 'Not connected');

    $this->openIntegration($page, 'mattermost')
        ->assertSeeIn($mattermost, 'through an incoming webhook of https://chat.example.com.')
        ->click("{$mattermost} button:has-text(\"Connect\")")
        ->assertSee('Connect Mattermost')
        ->fill($url, 'https://other.example.com/hooks/abcdefghijklmnopqrstuvwxyz')
        ->click(p14aForm('button[type="submit"]'))
        ->assertSee('Use an incoming webhook of https://chat.example.com.')
        ->fill($url, TeamIntegrationFactory::MattermostUrl)
        ->click(p14aForm('button[type="submit"]'))
        ->assertSee('Mattermost connected.')
        ->assertNotPresent($this->dialogOverPanel())
        ->assertSeeIn("{$mattermost} [data-slot=\"provider-details\"]", 'chat.example.com')
        ->assertSeeIn($mattermost, 'Ada Admin');

    $this->assertIntegrationStatus($page, 'mattermost', 'Connected');

    $page->navigate(p14aIntegrationsPath($team));

    $this->assertIntegrationStatus($page, 'mattermost', 'Connected')
        ->assertSourceMissing('abcdefghijklmnopqrstuvwxyz');

    $integration = TeamIntegration::query()->sole();

    expect($integration->provider)->toBe(IntegrationProvider::Mattermost)
        ->and($integration->credential('url'))->toBe(TeamIntegrationFactory::MattermostUrl)
        ->and($integration->setting('host'))->toBe('chat.example.com');

    Http::assertNothingSent();
});

it('[P14a-02] sends a test message to Microsoft Teams and to Mattermost', function () {
    p14aFakeChats();
    $team = Team::factory()->create(['name' => 'Platform']);
    $admin = p14aAdmin($team);
    p14aConnectChats($team);
    $teams = p14aPanel('msteams');
    $mattermost = p14aPanel('mattermost');

    $page = $this->signIn($admin, p14aIntegrationsPath($team));

    $this->assertIntegrationStatus($page, 'msteams', 'Connected')
        ->assertSeeIn(p14aCard('msteams'), '#retros')
        ->assertSeeIn(p14aCard('mattermost'), 'town-square');
    $this->assertIntegrationStatus($page, 'mattermost', 'Connected');

    $this->openIntegration($page, 'msteams')
        ->assertSeeIn($teams, 'Never')
        ->click("{$teams} button:has-text(\"Send a test message\")")
        ->assertSee('Test message sent.')
        ->assertDontSeeIn($teams, 'Never');

    $this->closeIntegration($page, 'msteams');

    $this->openIntegration($page, 'mattermost')
        ->assertSeeIn($mattermost, 'Never')
        ->click("{$mattermost} button:has-text(\"Send a test message\")")
        ->assertDontSeeIn($mattermost, 'Never');

    [$toTeams] = p14aSentTo('prod-12.westeurope.logic.azure.com');
    [$toMattermost] = p14aSentTo('chat.example.com');

    expect($toTeams['type'])->toBe('message')
        ->and($toTeams['attachments'][0]['contentType'])->toBe('application/vnd.microsoft.card.adaptive')
        ->and($toTeams['attachments'][0]['content']['body'][0]['text'])->toBe('skrum is connected.')
        ->and($toMattermost->url())->toBe(TeamIntegrationFactory::MattermostUrl)
        ->and($toMattermost['text'])->toBe('skrum is connected.');

    Http::assertSentCount(2);
});

it('[P14a-03a] posts the board link to Microsoft Teams and to Mattermost with the title escaped', function () {
    p14aFakeChats();
    [$retro, $fran] = p14aRetro();
    $lines = '[role="dialog"] ul[aria-live="polite"]';

    $page = $this->awaitRealtime($this->signIn($fran, "/retros/{$retro->id}"));

    $page->assertSeeIn('header >> h1', 'Sprint *42*')
        ->click('Share')
        ->assertSee('Post a link')
        ->click('Post link to Microsoft Teams')
        ->assertSeeIn($lines, 'Sending to Microsoft Teams…')
        ->click('Post link to Mattermost')
        ->assertSeeIn($lines, 'Sending to Mattermost…');

    $this->workQueue();
    $this->workQueue();

    $page->assertSeeIn($lines, 'Sent to Microsoft Teams')
        ->assertSeeIn($lines, 'Sent to Mattermost');

    [$toTeams] = p14aSentTo('prod-12.westeurope.logic.azure.com');
    [$toMattermost] = p14aSentTo('chat.example.com');

    expect($toTeams['attachments'][0]['content']['body'][0]['text'])->toBe('Fran Facilitator invites you to the retrospective "Sprint \*42\*" \(Platform\)')
        ->and($toTeams['attachments'][0]['content']['actions'][0]['title'])->toBe('Open the retrospective')
        ->and($toTeams['attachments'][0]['content']['actions'][0]['url'])->toEndWith("/retros/{$retro->id}")
        ->and($toMattermost['text'])->toContain('Sprint \*42\*')
        ->and($toMattermost['text'])->toEndWith("/retros/{$retro->id})");
});

it('[P14a-03b] posts a game room invite to Microsoft Teams and to Mattermost', function () {
    p14aFakeChats();
    $room = GameRoom::factory()->create([
        'name' => 'Friday fun',
        'game' => GameKind::Hangman,
        'team_id' => Team::factory()->create(['name' => 'Platform'])->id,
    ]);
    p14aConnectChats($room->team);
    [$hana] = gameRoomHost($room);
    $hana->forceFill(['name' => 'Hana Host', 'locale' => 'en'])->save();
    $lines = '[role="dialog"] ul[aria-live="polite"]';

    $page = $this->awaitRealtime($this->signIn($hana, "/games/{$room->id}"));

    $page->assertSee('Invite')
        ->click('Invite')
        ->assertSeeIn('[data-slot="share-dialog"]', 'Invite to ')
        ->assertSee('Only members of Platform can join.')
        ->assertNotPresent('[role="dialog"] button[role="checkbox"]')
        ->click('Post link to Microsoft Teams')
        ->assertSeeIn($lines, 'Sending to Microsoft Teams…')
        ->click('Post link to Mattermost')
        ->assertSeeIn($lines, 'Sending to Mattermost…');

    $this->workQueue();
    $this->workQueue();

    $page->assertSeeIn($lines, 'Sent to Microsoft Teams')
        ->assertSeeIn($lines, 'Sent to Mattermost');

    [$toTeams] = p14aSentTo('prod-12.westeurope.logic.azure.com');
    [$toMattermost] = p14aSentTo('chat.example.com');

    expect($toTeams['attachments'][0]['content']['body'][0]['text'])->toBe('Hana Host invites you to play Hangman in "Friday fun" \(Platform\)')
        ->and($toTeams['attachments'][0]['content']['actions'][0]['title'])->toBe('Join the game')
        ->and($toTeams['attachments'][0]['content']['actions'][0]['url'])->toEndWith("/games/{$room->id}")
        ->and($toMattermost['text'])->toContain('Hana Host invites you to play Hangman in "Friday fun"')
        ->and($toMattermost['text'])->toEndWith("/games/{$room->id})");
});

it('[P14a-04a] shares the recap of an anonymous retro to both channels with a count, named action items and a literal @channel', function () {
    p14aFakeChats();
    [$retro, $fran, $franParticipant] = p14aRetro(RetroPhase::Completed, [
        'title' => 'Sprint 42',
        'is_anonymous' => true,
        'completed_at' => now(),
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
        'content' => 'Ping @channel about reviews',
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
        ->assertSee('Share to Microsoft Teams')
        ->click('Share to Microsoft Teams')
        ->assertSee('Share the results to Microsoft Teams')
        ->assertSee('Participants are shown as a count. Action items are shown with names.')
        ->click('[role="dialog"] button:has-text("Send")')
        ->assertNotPresent('[role="dialog"]')
        ->assertSee('Sending to Microsoft Teams…');

    $this->workQueue();

    $page->assertSee('Sent to Microsoft Teams')
        ->assertNotPresent('[role="menu"]')
        ->click('Share')
        ->assertSee('Share to Mattermost')
        ->click('Share to Mattermost')
        ->assertSee('Share the results to Mattermost')
        ->click('[role="dialog"] button:has-text("Send")')
        ->assertNotPresent('[role="dialog"]')
        ->assertSee('Sending to Mattermost…');

    $this->workQueue();

    $page->assertSee('Sent to Mattermost');

    [$toTeams] = p14aSentTo('prod-12.westeurope.logic.azure.com');
    [$toMattermost] = p14aSentTo('chat.example.com');
    $teamsText = p14aText($toTeams);
    $mattermostText = (string) $toMattermost['text'];

    expect([$teamsText, $mattermostText])
        ->each->toContain('Participants: 4')
        ->toContain('Write the runbook — Gus \(guest\)')
        ->toContain('Tidy the backlog — Bob Stone')
        ->toContain('about reviews \(votes: 1\)')
        ->not->toContain('Participants \(4\)')
        ->not->toContain('Cara Author')
        ->not->toContain('Fran Facilitator')
        ->and($teamsText)->toContain('Wins — Ping @channel about reviews')
        ->and($teamsText)->not->toContain('<at>')
        ->and($toTeams['attachments'][0]['content'])->not->toHaveKey('msteams')
        ->and($mattermostText)->toContain("Wins — Ping @\u{200B}channel about reviews")
        ->and($mattermostText)->not->toContain('@channel');
});

it('[P14a-05a] shows "Reconnect required" after a share to a deleted Teams workflow, and connects again when the URL is replaced', function () {
    p14aFakeChats(404);
    [$retro, $fran] = p14aRetro();
    $admin = p14aAdmin($retro->team);
    $lines = '[role="dialog"] ul[aria-live="polite"]';
    $teams = p14aPanel('msteams');

    $page = $this->awaitRealtime($this->signIn($fran, "/retros/{$retro->id}"));

    $page->click('Share')
        ->assertSee('Post a link')
        ->click('Post link to Microsoft Teams')
        ->assertSeeIn($lines, 'Sending to Microsoft Teams…');

    $this->workQueue();

    $page->assertSeeIn($lines, 'Microsoft Teams: failed — Reconnect Microsoft Teams in the team settings.')
        ->assertNotPresent('[role="dialog"] button:has-text("Post link to Microsoft Teams")')
        ->assertPresent('[role="dialog"] button:has-text("Post link to Mattermost")');

    expect($retro->team->integration(IntegrationProvider::MicrosoftTeams)?->status)->toBe(IntegrationStatus::ReconnectRequired);

    $settings = $this->signIn($admin, p14aIntegrationsPath($retro->team));

    $this->assertIntegrationStatus($settings, 'msteams', 'Reconnect required');
    $this->assertIntegrationStatus($settings, 'mattermost', 'Connected');

    $this->openIntegration($settings, 'msteams')
        ->assertSeeIn($teams, 'The Teams workflow URL no longer works. Paste a new one.')
        ->assertNotPresent("{$teams} button:has-text(\"Send a test message\")")
        ->click("{$teams} button:has-text(\"Replace URL\")")
        ->assertSee('Replace the URL')
        ->fill(p14aForm('input[type="url"]'), 'https://prod-30.northeurope.logic.azure.com:443/workflows/def456/triggers/manual/paths/invoke?api-version=2016-06-01&sig=new-signature')
        ->click(p14aForm('button[type="submit"]'))
        ->assertSee('Connection saved.')
        ->assertNotPresent($this->dialogOverPanel())
        ->assertSeeIn("{$teams} [data-slot=\"provider-details\"]", 'prod-30.northeurope.logic.azure.com')
        ->assertPresent("{$teams} button:has-text(\"Send a test message\")");

    $this->assertIntegrationStatus($settings, 'msteams', 'Connected');

    expect($retro->team->integration(IntegrationProvider::MicrosoftTeams)?->status)->toBe(IntegrationStatus::Active);
});
