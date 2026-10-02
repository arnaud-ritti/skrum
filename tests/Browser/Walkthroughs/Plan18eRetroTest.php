<?php

use App\Enums\ColumnColor;
use App\Enums\IntegrationProvider;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\CardComment;
use App\Models\CardReaction;
use App\Models\Column;
use App\Models\Retro;
use App\Models\RotiVote;
use App\Models\TeamIntegration;
use App\Models\User;
use App\Models\Vote;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Tests\Browser\Support\ReverbServer;

it('[P18e-02-05] renders a board with the eight colours, shows a migrated green column as Moss and recolours it for everyone', function () {
    $retro = Retro::factory()->create(['title' => 'Eight colours']);
    $columns = [];

    foreach (ColumnColor::cases() as $position => $color) {
        $columns[$color->value] = Column::factory()->create([
            'retro_id' => $retro->id,
            'title' => ucfirst($color->value),
            'color' => $color,
            'position' => $position,
        ]);
    }

    $migrated = $columns['moss'];
    DB::table('columns')->where('id', $migrated->id)->update(['color' => 'green']);
    (require database_path('migrations/2026_10_15_100300_map_column_colors_to_the_eight_theme_colors.php'))->up();

    [$alice] = retroFacilitator($retro);
    [$bob] = retroMember($retro);
    $alice->update(['locale' => 'en']);
    $bob->update(['locale' => 'en']);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $alicePage->assertCount('[data-test^="retro-column-"]', 8);

    foreach ($columns as $color => $column) {
        $alicePage->assertPresent("[data-test=\"retro-column-{$column->id}\"].col-{$color}");
    }

    $moss = "[data-test=\"retro-column-{$migrated->id}\"]";

    $alicePage->click("{$moss} [aria-label=\"Column menu\"]")
        ->click('[role="menuitem"]:has-text("Color")')
        ->assertCount('[role="menu"] [role="menuitemradio"]', 8)
        ->assertAriaAttribute('[role="menuitemradio"]:has-text("Moss")', 'checked', 'true')
        ->click('[role="menuitemradio"]:has-text("Lagoon")')
        ->assertPresent("{$moss}.col-lagoon")
        ->assertNotPresent("{$moss}.col-moss");

    $bobPage->assertPresent("{$moss}.col-lagoon");

    expect($migrated->fresh()->color)->toBe(ColumnColor::Lagoon);
});

/**
 * @return array{
 *     0: Retro,
 *     1: User,
 *     2: User
 * }
 */
function p18eShellBoard(bool $acceptsGuests = false): array
{
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create([
        'title' => 'Sprint 42',
        'guest_access_enabled' => $acceptsGuests,
    ]);

    foreach (['Start', 'Stop', 'Continue'] as $position => $title) {
        Column::factory()->create(['retro_id' => $retro->id, 'title' => $title, 'position' => $position]);
    }

    [$alice] = retroFacilitator($retro);
    [$bob] = retroMember($retro);
    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);
    $bob->update(['name' => 'Bob Stone', 'locale' => 'en']);

    return [$retro->fresh(), $alice, $bob];
}

function p18eSection(string $title): string
{
    return "section:has(h2:has-text(\"{$title}\"))";
}

function p18eTimerSeconds(): string
{
    return "(() => { const [minutes, seconds] = document.querySelector('[role=\"timer\"]').textContent.trim().split(':').map(Number); return minutes * 60 + seconds; })()";
}

it('[P18e-02-08] keeps one realtime root, says what is true while reconnecting, and freezes the board under the expired banner until the viewer is back', function () {
    [$retro, $alice, $bob] = p18eShellBoard();
    $banner = '[data-slot="connection-state"][data-variant="banner"]';
    $expired = '[role="alert"]:has-text("Your session has expired.")';
    $isInert = "document.querySelector('[data-slot=\"retro-body\"]').closest('[inert]') !== null";
    $bannerIsFullWidth = "(() => { const banner = document.querySelector('{$banner}').getBoundingClientRect(); const main = document.querySelector('main').getBoundingClientRect(); return banner.left - main.left <= 16 && main.right - banner.right <= 16; })()";
    $bannerClearsTheReactions = "document.querySelector('{$banner}').getBoundingClientRect().bottom <= document.querySelector('[role=\"toolbar\"][aria-label=\"Reactions\"]').getBoundingClientRect().top";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertCount('[data-realtime]', 1)
            ->assertScript("document.querySelectorAll('main').length", 1)
            ->assertNotPresent($banner)
            ->assertScript($isInert, false);
    }

    ReverbServer::stop();

    try {
        foreach ([$alicePage, $bobPage] as $page) {
            $page->assertSeeIn($banner, 'Reconnecting…')
                ->assertSeeIn($banner, 'Live updates are paused. What you see may be out of date.')
                ->assertDontSee('kept locally')
                ->assertCount('[data-realtime]', 1)
                ->assertPresent('[data-slot="session-connection-pill"][aria-hidden="true"]')
                ->assertScript($bannerIsFullWidth, true)
                ->assertScript($bannerClearsTheReactions, true)
                ->assertScript($isInert, false);
        }
    } finally {
        ReverbServer::start();
    }

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertNotPresent($banner)
            ->assertAttribute('[data-realtime]', 'data-realtime', 'connected')
            ->assertCount('[data-realtime]', 1);
    }

    $status = $bobPage->script(<<<'JS'
        () => {
            const token = document.cookie.split('; ').find((cookie) => cookie.startsWith('XSRF-TOKEN=')).slice('XSRF-TOKEN='.length);

            return fetch('/logout', {
                method: 'POST',
                headers: { Accept: 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(token) },
            }).then((response) => response.status);
        }
        JS);

    expect($status)->toBe(204);

    $alicePage->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'Grouping');

    $bobPage->assertCount($expired, 1)
        ->assertCount('[data-realtime]', 1)
        ->assertScript($isInert, true)
        ->assertSeeIn('[aria-current="step"]', 'Writing')
        ->click('Reload')
        ->assertPathIs('/login')
        ->fill('#email', $bob->email)
        ->fill('#password', 'password')
        ->click('@login-button')
        ->assertPathIs("/retros/{$retro->id}");

    $this->awaitRealtime($bobPage)
        ->assertNotPresent($expired)
        ->assertScript($isInert, false)
        ->assertSeeIn('[aria-current="step"]', 'Grouping')
        ->assertCount('[data-realtime]', 1);
});

it('[P18e-02-09] offers "+2 min" to the facilitator while a timer runs and moves the countdown of a guest by two minutes', function () {
    [$retro, $alice] = p18eShellBoard(acceptsGuests: true);
    $extend = 'button:has-text("+2 min")';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $alicePage->assertNotPresent($extend)
        ->click('[aria-label="Timer"]')
        ->assertSee('1 min')
        ->click('1 min')
        ->assertPresent('[role="timer"]')
        ->assertVisible($extend);

    $carolPage->assertPresent('[role="timer"]')
        ->assertNotPresent($extend)
        ->assertNotPresent('[aria-label="Timer"]')
        ->assertScript(p18eTimerSeconds().' <= 60', true);

    $endsAt = $retro->fresh()->timer_ends_at;

    $alicePage->click($extend)
        ->assertScript(p18eTimerSeconds().' > 120', true);

    $carolPage->assertScript(p18eTimerSeconds().' > 120', true)
        ->assertScript(p18eTimerSeconds().' <= 180', true)
        ->assertNotPresent($extend);

    expect((int) $endsAt->diffInSeconds($retro->fresh()->timer_ends_at))->toBe(120);
});

it('[P18e-02-10] counts the cards and who has written in the Writing banner, live for everyone', function (bool $isAnonymous) {
    [$retro, $alice, $bob] = p18eShellBoard();
    $retro->update(['is_anonymous' => $isAnonymous]);
    $start = $retro->columns()->orderBy('position')->firstOrFail();
    $composer = "[data-test=\"retro-column-{$start->id}\"] textarea";
    $progress = '[data-slot="retro-writing-progress"]';
    $bar = '[data-slot="facilitator-bar"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertSee('Silent writing: your cards are only visible to you until the reveal.')
            ->assertSeeIn($progress, '0 cards · 0/2 have written');
    }

    $isAnonymous
        ? $alicePage->assertSeeIn($bar, 'Anonymity: on')
        : $alicePage->assertDontSee('Anonymity: on');

    $bobPage->type($composer, 'Ship smaller pull requests')
        ->keys($composer, 'Enter')
        ->assertSeeIn($progress, '1 card · 1/2 have written')
        ->assertSeeIn('article[id^="card-"]', 'Visible only to you');

    $alicePage->assertSeeIn($progress, '1 card · 1/2 have written')
        ->assertSeeIn('article[id^="card-"]', 'Hidden until the reveal')
        ->assertDontSee('Visible only to you');

    $bobPage->type($composer, 'Pair on reviews')
        ->keys($composer, 'Enter')
        ->assertSeeIn($progress, '2 cards · 1/2 have written');

    $alicePage->assertSeeIn($progress, '2 cards · 1/2 have written');

    $alicePage->type($composer, 'Keep the demo on Fridays')
        ->keys($composer, 'Enter')
        ->assertSeeIn($progress, '3 cards · 2/2 have written');

    $bobPage->assertSeeIn($progress, '3 cards · 2/2 have written');

    $card = $retro->cards()->where('content', 'Keep the demo on Fridays')->sole();

    $alicePage->click("#card-{$card->id} [aria-label=\"Delete card\"]")
        ->assertSeeIn($progress, '2 cards · 1/2 have written');

    $bobPage->assertSeeIn($progress, '2 cards · 1/2 have written');

    $alicePage->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'Grouping')
        ->assertNotPresent($progress)
        ->assertDontSee('Anonymity: on');
})->with([
    'named retro' => false,
    'anonymous retro' => true,
]);

it('[P18e-02-11] reveals the votes from the facilitator bar: the totals show to a guest in a second browser and the switch of the settings follows', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create([
        'title' => 'Sprint 42',
        'guest_access_enabled' => true,
        'hide_vote_counts' => true,
        'votes_per_participant' => 3,
    ]);
    $column = Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Start', 'position' => 0]);
    [$alice, $aliceParticipant] = retroFacilitator($retro);
    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);
    $card = Card::factory()->create([
        'retro_id' => $retro->id,
        'column_id' => $column->id,
        'participant_id' => $aliceParticipant->id,
        'content' => 'Slow CI',
        'position' => 0,
    ]);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $aliceParticipant->id]);
    $retro = $retro->fresh();
    $bar = '[data-slot="facilitator-bar"]';
    $showsTotal = "[...document.querySelectorAll('#card-{$card->id} [aria-label]')].some((element) => /^\\d+ votes?$/.test(element.getAttribute('aria-label')))";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSee('Votes hidden until the reveal')
            ->assertPresent("#card-{$card->id} [aria-label=\"Add a vote\"]")
            ->assertScript($showsTotal, false);
    }

    $alicePage->assertSeeIn($bar, '3 votes / person')
        ->assertPresent("#card-{$card->id} [aria-label=\"Your votes: 1\"]")
        ->assertNotPresent("{$bar} button[aria-label=\"Hide the votes\"]")
        ->click("{$bar} button[aria-label=\"Reveal the votes\"]");

    $carolPage->assertPresent("#card-{$card->id} [aria-label=\"1 vote\"]")
        ->assertDontSee('Votes hidden until the reveal')
        ->assertNotPresent($bar)
        ->click("#card-{$card->id} [aria-label=\"Add a vote\"]")
        ->assertPresent("#card-{$card->id} [aria-label=\"2 votes\"]");

    $alicePage->assertPresent("#card-{$card->id} [aria-label=\"2 votes\"]")
        ->assertDontSee('Votes hidden until the reveal')
        ->assertPresent("{$bar} button[aria-label=\"Hide the votes\"]")
        ->assertNotPresent("{$bar} button[aria-label=\"Reveal the votes\"]");

    expect($retro->fresh()->hide_vote_counts)->toBeFalse();

    $alicePage->click('[aria-label="Facilitator menu"]')
        ->click('Settings…')
        ->assertSee('Retrospective settings')
        ->assertAriaAttribute('#retro-hide-vote-counts', 'checked', 'false')
        ->keys('[role="dialog"]', 'Escape')
        ->assertNotPresent('[role="dialog"]')
        ->click("{$bar} button[aria-label=\"Hide the votes\"]");

    $carolPage->assertSee('Votes hidden until the reveal')
        ->assertScript($showsTotal, false);

    $alicePage->assertScript($showsTotal, false)
        ->click('[aria-label="Facilitator menu"]')
        ->click('Settings…')
        ->assertAriaAttribute('#retro-hide-vote-counts', 'checked', 'true');

    expect($retro->fresh()->hide_vote_counts)->toBeTrue();
});

/**
 * A board in Discussing with three topics of 3, 1 and 0 votes, a facilitator and a member.
 *
 * @return array{
 *     0: Retro,
 *     1: User,
 *     2: User,
 *     3: array{slow: Card, flaky: Card, quiet: Card}
 * }
 */
function p18eDiscussion(): array
{
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create([
        'title' => 'Sprint 42',
        'guest_access_enabled' => true,
    ]);
    $start = Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Start', 'position' => 0]);
    $stop = Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Stop', 'position' => 1]);
    [$alice, $aliceParticipant] = retroFacilitator($retro);
    [$bob, $bobParticipant] = retroMember($retro);
    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);
    $bob->update(['name' => 'Bob Stone', 'locale' => 'en']);
    $cards = [];

    foreach ([['flaky', $start, 'Flaky tests', 0, 1], ['slow', $start, 'Slow CI', 1, 3], ['quiet', $stop, 'Quiet standups', 0, 0]] as [$key, $column, $content, $position, $votes]) {
        $cards[$key] = Card::factory()->create([
            'retro_id' => $retro->id,
            'column_id' => $column->id,
            'participant_id' => $bobParticipant->id,
            'content' => $content,
            'position' => $position,
        ]);

        Vote::factory()->count($votes)->create([
            'retro_id' => $retro->id,
            'card_id' => $cards[$key]->id,
            'participant_id' => $aliceParticipant->id,
        ]);
    }

    return [$retro->fresh(), $alice, $bob, $cards];
}

it('[P18e-02-12] lists the topics by votes for a member and a guest, moves both with "Next topic" while everyone follows, and leaves the guest on their topic otherwise', function () {
    [$retro, $alice, , $cards] = p18eDiscussion();
    $topics = '[data-test="retro-topics"]';
    $order = "[...document.querySelectorAll('{$topics} > li')].map((topic) => topic.dataset.topicId).join(',')";
    $current = "{$topics} > li[aria-current=\"true\"]";
    $bar = '[data-slot="facilitator-bar"]';
    $follow = "{$bar} button:has-text(\"Everyone follows\")";
    $overlay = '[data-slot="retro-presentation"]';
    $nav = '[data-slot="retro-topic-nav"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertScript($order, "{$cards['slow']->id},{$cards['flaky']->id},{$cards['quiet']->id}")
            ->assertSeeIn($current, 'Slow CI')
            ->assertPresent("#card-{$cards['slow']->id}")
            ->assertNotPresent($overlay);
    }

    $carolPage->assertNotPresent($bar);

    $alicePage->assertAttribute($follow, 'aria-pressed', 'false')
        ->click($follow);

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn($overlay, 'Slow CI');
    }

    $alicePage->click("{$overlay} button:has-text(\"Next topic\")");

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn($overlay, 'Flaky tests')
            ->assertSeeIn($current, 'Flaky tests');
    }

    expect($retro->fresh()->presentation_mode)->toBeTrue()
        ->and($retro->fresh()->highlighted_card_id)->toBe($cards['flaky']->id);

    $carolPage->keys($overlay, 'Escape')
        ->assertNotPresent($overlay)
        ->assertSee('Alice Martin put this topic in focus — everyone is looking here')
        ->click("{$topics} li:has-text(\"Quiet standups\")")
        ->assertSeeIn($current, 'Quiet standups')
        ->assertSee('Everyone is looking at another topic.')
        ->press('Back to the topic')
        ->assertSeeIn($current, 'Flaky tests')
        ->assertPresent("#card-{$cards['flaky']->id}");

    $alicePage->press('Stop presenting')
        ->assertNotPresent($overlay)
        ->assertAttribute($follow, 'aria-pressed', 'true')
        ->click($follow)
        ->assertAttribute($follow, 'aria-pressed', 'false')
        ->click("{$nav} button:has-text(\"Next topic\")")
        ->assertSeeIn($current, 'Quiet standups')
        ->assertPresent("#card-{$cards['quiet']->id}");

    $carolPage->assertDontSee('put this topic in focus')
        ->assertSeeIn($current, 'Flaky tests')
        ->assertPresent("#card-{$cards['flaky']->id}")
        ->assertNotPresent("#card-{$cards['quiet']->id}")
        ->assertNotPresent($overlay);

    expect($retro->fresh()->presentation_mode)->toBeFalse()
        ->and($retro->fresh()->highlighted_card_id)->toBeNull();
});

it('[P18e-02-13] carries a comment, a reaction and a highlight on the topic in focus to the other browser', function () {
    [$retro, $alice, $bob, $cards] = p18eDiscussion();
    $slow = "#card-{$cards['slow']->id}";
    $topics = '[data-test="retro-topics"]';
    $current = "{$topics} > li[aria-current=\"true\"]";
    $composer = "{$slow} textarea[aria-label=\"Write a comment…\"]";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->click("{$slow} button[aria-label=\"Comments (0)\"]")
        ->assertVisible($composer)
        ->fill($composer, 'Which pipeline is slow?')
        ->keys($composer, 'Enter')
        ->assertSeeIn($slow, 'Which pipeline is slow?');

    $alicePage->click("{$slow} button[aria-label=\"Comments (1)\"]")
        ->assertSeeIn($slow, 'Which pipeline is slow?')
        ->assertSeeIn($slow, 'Bob Stone');

    $bobPage->click("{$slow} [aria-label=\"Add a reaction\"]")
        ->assertVisible('[role="menuitem"]:has-text("🎉")')
        ->click('[role="menuitem"]:has-text("🎉")')
        ->assertPresent("{$slow} button[aria-label=\"🎉, 1 reaction\"]");

    $alicePage->assertPresent("{$slow} button[aria-label=\"🎉, 1 reaction\"]");

    $bobPage->click("{$topics} li:has-text(\"Quiet standups\")")
        ->assertSeeIn($current, 'Quiet standups')
        ->assertNotPresent($slow)
        ->assertNotPresent("#card-{$cards['quiet']->id} button:has-text(\"Discuss\")");

    $alicePage->click("{$slow} button[aria-pressed=\"false\"]:has-text(\"Discuss\")")
        ->assertPresent("{$slow} button[aria-pressed=\"true\"]:has-text(\"Discuss\")");

    $bobPage->assertSeeIn($current, 'Slow CI')
        ->assertAttribute($slow, 'data-focused', 'true')
        ->assertSeeIn("{$topics} > li[data-shared]", 'Slow CI')
        ->assertNotPresent('[role="dialog"]');

    expect($retro->fresh()->highlighted_card_id)->toBe($cards['slow']->id)
        ->and($retro->fresh()->presentation_mode)->toBeFalse()
        ->and(CardComment::query()->where('card_id', $cards['slow']->id)->count())->toBe(1)
        ->and(CardReaction::query()->where('card_id', $cards['slow']->id)->count())->toBe(1);
});

it('[P18e-02-14] creates an action item with "Create the ticket in Linear" and opens the export on it', function () {
    [$retro, , $bob] = p18eDiscussion();
    disableIntegrations();
    enableIntegrations(IntegrationProvider::Linear);
    TeamIntegration::factory()->linear()->create(['team_id' => $retro->team_id]);
    fakeLinearGraphql([
        'issueCreate' => ['issueCreate' => ['success' => true, 'issue' => [
            'id' => 'lin-issue-7',
            'identifier' => 'ENG-7',
            'url' => 'https://linear.app/acme/issue/ENG-7/rotate-the-on-call',
        ]]],
        'teams(first' => ['teams' => ['nodes' => [
            ['id' => '6a1f0c1e-4e8b-4a55-9b53-3c0b5f1f0a01', 'key' => 'ENG', 'name' => 'Engineering'],
        ]]],
        'users(first' => ['users' => ['nodes' => [], 'pageInfo' => ['hasNextPage' => false]]],
    ]);
    $panel = '[data-test="retro-action-items-panel"]';
    $input = "{$panel} [aria-label=\"Add an action item…\"]";

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->assertPresent($input)
        ->assertDontSeeIn($panel, 'Create the ticket in Linear');

    $bobPage->assertAttribute("{$panel} button:has-text(\"Create an action\")", 'aria-expanded', 'true')
        ->fill($input, 'Rotate the on-call')
        ->click("{$panel} form button[role=\"checkbox\"]")
        ->keys($input, 'Enter')
        ->assertSeeIn('[role="dialog"]', 'Export to Linear')
        ->assertSeeIn('[role="dialog"] [aria-label="Linear team"]', 'ENG — Engineering')
        ->assertSeeIn($panel, 'Rotate the on-call');

    $item = ActionItem::query()->where('content', 'Rotate the on-call')->sole();
    $chip = "#action-item-{$item->id} a[href=\"https://linear.app/acme/issue/ENG-7/rotate-the-on-call\"]";

    $carolPage->assertSeeIn($panel, 'Rotate the on-call')
        ->assertNotPresent('[role="dialog"]');

    $bobPage->assertEnabled('[role="dialog"] button:has-text("Export")')
        ->click('[role="dialog"] button:has-text("Export")')
        ->assertSee('Exported as ENG-7.')
        ->assertNotPresent('[role="dialog"]')
        ->assertSeeIn($chip, 'ENG-7')
        ->assertValue($input, '');

    expect($item->externalLinks()->count())->toBe(1);
});

it('[P18e-02-02] creates, assigns and completes an action item in the Actions phase for a guest to see live, moves the topic in discussion for both with "Next topic", and takes an item back with "Undo"', function () {
    [$retro, $alice, , $cards] = p18eDiscussion();
    $retro->update(['phase' => RetroPhase::Actions]);
    $current = '[data-test="retro-topics"] > li[aria-current="true"]';
    $order = "[...document.querySelectorAll('[data-test=\"retro-topics\"] > li')].map((topic) => topic.dataset.topicId).join(',')";
    $panel = '[data-test="retro-action-items-panel"]';
    $input = "{$panel} [aria-label=\"Add an action item…\"]";
    $bar = '[data-slot="facilitator-bar"]';
    $next = "{$bar} button:has-text(\"Next topic\")";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn('[aria-current="step"]', 'Actions')
            ->assertSee('Most voted topics')
            ->assertScript($order, "{$cards['slow']->id},{$cards['flaky']->id},{$cards['quiet']->id}")
            ->assertNotPresent($current)
            ->assertNotPresent("#card-{$cards['slow']->id}")
            ->assertSeeIn($panel, 'Retro actions')
            ->assertSeeIn($panel, 'No action items yet.');
    }

    $carolPage->assertNotPresent($bar);

    $alicePage->assertSeeIn($bar, 'Next phase')
        ->fill($input, 'Quarantine the flaky tests')
        ->click("{$panel} form [aria-label=\"Assignee\"]")
        ->click('[role="option"]:has-text("Bob Stone")')
        ->assertNotPresent('[role="listbox"]')
        ->keys($input, 'Enter')
        ->assertSee('Action created')
        ->assertSeeIn($panel, 'Quarantine the flaky tests');

    $item = ActionItem::query()->where('content', 'Quarantine the flaky tests')->sole();
    $row = "#action-item-{$item->id}";

    expect($item->assignee_user_id)->not->toBeNull();

    $carolPage->assertSeeIn($row, 'Quarantine the flaky tests')
        ->assertSeeIn($row, 'Bob Stone')
        ->assertPresent("{$row} [aria-label=\"Mark as done\"]");

    $alicePage->click("{$row} [aria-label=\"Mark as done\"]")
        ->assertPresent("{$row} [aria-label=\"Reopen\"]");

    $carolPage->assertPresent("{$row} [aria-label=\"Reopen\"]");

    expect($item->fresh()->completed_at)->not->toBeNull();

    $alicePage->click($next);

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn($current, 'Slow CI')
            ->assertSeeIn($current, 'In discussion');
    }

    $alicePage->click($next);

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn($current, 'Flaky tests')
            ->assertCount($current, 1);
    }

    expect($retro->fresh()->highlighted_card_id)->toBe($cards['flaky']->id);

    $alicePage->fill($input, 'Buy a faster runner')
        ->keys($input, 'Enter')
        ->assertSeeIn($panel, 'Buy a faster runner');

    $carolPage->assertSeeIn($panel, 'Buy a faster runner');

    $alicePage->click('[data-sonner-toast] button:has-text("Undo") >> nth=0')
        ->assertDontSeeIn($panel, 'Buy a faster runner')
        ->assertNotPresent('[role="alertdialog"]');

    $carolPage->assertDontSeeIn($panel, 'Buy a faster runner')
        ->assertSeeIn($panel, 'Quarantine the flaky tests');

    expect(ActionItem::query()->where('content', 'Buy a faster runner')->exists())->toBeFalse()
        ->and(ActionItem::query()->where('retro_id', $retro->id)->count())->toBe(1);
});

it('[P18e-02-03] takes a rating in the ROTI phase only: a vote, a change and a retract move the "Who has voted" list of the other browser, which never shows a score', function () {
    [$retro, $alice] = p18eDiscussion();
    $control = '[role="group"][aria-label="How was this retro?"]';
    $rate = fn (string $label): string => "{$control} button:has-text(\"{$label}\")";
    $count = '[data-slot="retro-roti-count"]';
    $voters = '[data-test="retro-roti-voters"]';
    $states = "[...document.querySelectorAll('{$voters} > li')].map((row) => [...row.children].slice(1).map((part) => part.textContent).join(' · ')).join(' | ')";
    $putScore = <<<'JS'
        () => {
            const token = document.cookie.split('; ').find((cookie) => cookie.startsWith('XSRF-TOKEN=')).slice('XSRF-TOKEN='.length);

            return fetch(`/retros/${location.pathname.split('/').pop()}/roti`, {
                method: 'PUT',
                headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(token) },
                body: JSON.stringify({ score: 4 }),
            }).then((response) => response.status);
        }
        JS;

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn('[aria-current="step"]', 'Discussing')
            ->assertNotPresent($control);
    }

    expect($alicePage->script($putScore))->toBe(403)
        ->and(RotiVote::query()->count())->toBe(0);

    $alicePage->press('Next')->assertSeeIn('[aria-current="step"]', 'Actions')->assertNotPresent($control);
    $alicePage->press('Next')->assertSeeIn('[aria-current="step"]', 'ROTI');

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn('[aria-current="step"]', 'ROTI')
            ->assertPresent($control)
            ->assertSee('Who has voted')
            ->assertSeeIn($count, '0/2')
            ->assertSee('Votes hidden until the end')
            ->assertNotPresent("{$control} button[aria-pressed=\"true\"]");
    }

    $alicePage->assertScript($states, 'Alice Martin (you) · Thinking… | Carol Guest · Thinking…')
        ->assertSeeIn('[data-slot="facilitator-bar"]', 'End session');
    $carolPage->assertScript($states, 'Carol Guest (you) · Thinking… | Alice Martin · Thinking…')
        ->assertNotPresent('[data-slot="facilitator-bar"]');

    $carolPage->click($rate('Good use of time'))
        ->assertAriaAttribute($rate('Good use of time'), 'pressed', 'true')
        ->assertSee('Vote saved · you can change it until the session ends')
        ->assertSeeIn($count, '1/2')
        ->assertScript($states, 'Carol Guest (you) · Voted | Alice Martin · Thinking…');

    $alicePage->assertSeeIn($count, '1/2')
        ->assertScript($states, 'Alice Martin (you) · Thinking… | Carol Guest · Voted')
        ->assertNotPresent("{$control} button[aria-pressed=\"true\"]")
        ->assertScript("/\\d/.test(document.querySelector('{$voters}').textContent)", false)
        ->assertDontSee('Average:');

    $carolPage->click($rate('Not really worth it'))
        ->assertAriaAttribute($rate('Not really worth it'), 'pressed', 'true')
        ->assertAriaAttribute($rate('Good use of time'), 'pressed', 'false')
        ->assertSeeIn($count, '1/2');

    expect(RotiVote::query()->where('retro_id', $retro->id)->sole()->score)->toBe(2);

    $alicePage->assertSeeIn($count, '1/2')
        ->assertScript($states, 'Alice Martin (you) · Thinking… | Carol Guest · Voted');

    $carolPage->click($rate('Not really worth it'))
        ->assertAriaAttribute($rate('Not really worth it'), 'pressed', 'false')
        ->assertDontSee('Vote saved')
        ->assertSeeIn($count, '0/2');

    $alicePage->assertSeeIn($count, '0/2')
        ->assertScript($states, 'Alice Martin (you) · Thinking… | Carol Guest · Thinking…');

    expect(RotiVote::query()->where('retro_id', $retro->id)->count())->toBe(0);
});

it('[P18e-02-01] walks a member and a guest from Writing to Grouping, Voting, Discussing, Actions, ROTI and the completed retro without a reload', function () {
    [$retro, $alice] = p18eShellBoard(acceptsGuests: true);
    $start = $retro->columns()->orderBy('position')->firstOrFail();
    $composer = "[data-test=\"retro-column-{$start->id}\"] textarea";
    $current = '[aria-current="step"]';
    $control = '[role="group"][aria-label="How was this retro?"]';
    $panel = '[data-test="retro-action-items-panel"]';
    $input = "{$panel} [aria-label=\"Add an action item…\"]";
    $bar = '[data-slot="facilitator-bar"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    foreach ([$alicePage, $carolPage] as $page) {
        $page->script('() => { window.__p18eSamePage = true; }');
        $page->assertSeeIn($current, 'Writing');
    }

    $carolPage->type($composer, 'Slow CI')
        ->keys($composer, 'Enter')
        ->assertSeeIn('article[id^="card-"]', 'Slow CI');

    $card = Card::query()->where('retro_id', $retro->id)->where('content', 'Slow CI')->sole();

    $alicePage->assertPresent("#card-{$card->id}")
        ->press('Next');

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn($current, 'Grouping')
            ->assertSeeIn("#card-{$card->id}", 'Slow CI');
    }

    $alicePage->press('Next');

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn($current, 'Voting')
            ->assertPresent("#card-{$card->id} [aria-label=\"Add a vote\"]");
    }

    $carolPage->click("#card-{$card->id} [aria-label=\"Add a vote\"]")
        ->assertPresent("#card-{$card->id} [aria-label=\"Your votes: 1\"]");

    $alicePage->press('Next');

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn($current, 'Discussing')
            ->assertSeeIn('[data-test="retro-topics"]', 'Slow CI')
            ->assertPresent("#card-{$card->id} [aria-label=\"1 vote\"]")
            ->assertNotPresent($control);
    }

    $alicePage->press('Next');

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn($current, 'Actions')
            ->assertSee('Most voted topics')
            ->assertPresent($input);
    }

    $carolPage->fill($input, 'Buy a faster runner')
        ->keys($input, 'Enter')
        ->assertSeeIn($panel, 'Buy a faster runner');

    $alicePage->assertSeeIn($panel, 'Buy a faster runner')
        ->click("{$bar} button:has-text(\"Next phase\")");

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn($current, 'ROTI')
            ->assertPresent($control)
            ->assertSee('Who has voted')
            ->assertNotPresent($panel);
    }

    $carolPage->click("{$control} button:has-text(\"Excellent use of time\")")
        ->assertSeeIn('[data-slot="retro-roti-count"]', '1/2');

    $alicePage->assertSeeIn('[data-slot="retro-roti-count"]', '1/2')
        ->assertDontSee('Average:')
        ->click("{$bar} button:has-text(\"End session\")");

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn($current, 'Completed')
            ->assertSee('Top topics')
            ->assertSeeIn(p18eSection('Return on time invested').' [data-slot="roti-mean"]', '5.0')
            ->assertSeeIn(p18eSection('Return on time invested'), '1 vote')
            ->assertNotPresent($control)
            ->assertSee('Buy a faster runner')
            ->assertScript('window.__p18eSamePage === true', true);
    }

    expect($retro->fresh()->phase)->toBe(RetroPhase::Completed)
        ->and($retro->fresh()->roti_votable_when_completed)->toBeFalse();
});

/**
 * A board in ROTI, started 58 minutes ago, with a card, two votes and an action item.
 *
 * @return array{
 *     0: Retro,
 *     1: User,
 *     2: User
 * }
 */
function p18eRotiBoard(bool $started = true): array
{
    $retro = Retro::factory()->inPhase(RetroPhase::Roti)->withGuestAccess()->create([
        'title' => 'Sprint 42',
        'votes_per_participant' => 5,
        'started_at' => $started ? now()->subMinutes(58) : null,
    ]);
    $column = Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Start', 'position' => 0]);

    [$alice, $aliceParticipant] = retroFacilitator($retro);
    [$bob, $bobParticipant] = retroMember($retro);
    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);
    $bob->update(['name' => 'Bob Stone', 'locale' => 'en']);

    $card = Card::factory()->create([
        'retro_id' => $retro->id,
        'column_id' => $column->id,
        'participant_id' => $bobParticipant->id,
        'content' => 'Slow CI',
        'position' => 0,
    ]);
    Vote::factory()->count(2)->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $aliceParticipant->id]);
    ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'content' => 'Buy a faster runner',
        'created_by_participant_id' => $aliceParticipant->id,
    ]);

    return [$retro->fresh(), $alice, $bob];
}

function p18eStat(string $label): string
{
    return "[data-slot=\"stat-card\"]:has-text(\"{$label}\") [data-slot=\"stat-card-value\"]";
}

it('[P18e-02-04] ends the session on its figures with the duration and the votes cast, switches between Results and Board, e-mails the recap, shares it to a channel and reopens on ROTI', function () {
    config(['mail.default' => 'smtp', 'queue.default' => 'database']);
    Notification::fake();
    Http::fake(['hooks.slack.com/*' => Http::response('ok')]);
    disableIntegrations();
    enableIntegrations(IntegrationProvider::Slack);
    [$retro, $alice] = p18eRotiBoard();
    TeamIntegration::factory()->slack()->create(['team_id' => $retro->team_id]);
    $current = '[aria-current="step"]';
    $line = '[data-slot="retro-session-end-line"]';
    $send = '[role="dialog"] button:has-text("Send")';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $alicePage->click('[data-slot="facilitator-bar"] button:has-text("End session")');

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn($current, 'Completed')
            ->assertSeeIn($line, 'SESSION ENDED · 58 MIN ·')
            ->assertSee('Sprint 42, wrapped up')
            ->assertSee('Meetings end, actions stay.')
            ->assertSeeIn(p18eStat('Actions created'), '1')
            ->assertSeeIn(p18eStat('Participation'), '3 of 2 · 100%')
            ->assertSeeIn(p18eStat('Cards'), '1')
            ->assertSeeIn(p18eStat('Groups'), '0')
            ->assertSeeIn(p18eStat('Votes cast'), '2 of 15')
            ->assertAriaAttribute('#completed-tab-results', 'selected', 'true')
            ->assertSeeIn(p18eSection('Actions created'), 'Buy a faster runner')
            ->click('#completed-tab-board')
            ->assertAriaAttribute('#completed-tab-board', 'selected', 'true')
            ->assertPresent('[role="tabpanel"] [data-test^="retro-column-"]')
            ->assertNotPresent('[data-slot="retro-session-end-stats"]')
            ->assertSee('Sprint 42, wrapped up')
            ->click('#completed-tab-results')
            ->assertPresent('[data-slot="retro-session-end-stats"]');
    }

    $carolPage->assertDontSee('Send the recap by e-mail')
        ->assertDontSee('Back to the team')
        ->assertNotPresent('button:has-text("Share")');

    $alicePage->assertSee('Back to the team')
        ->click('Send the recap by e-mail')
        ->assertSee('Email the results')
        ->assertSee('Participants with an account (2)')
        ->click($send)
        ->assertSee('The results are on their way.')
        ->assertNotPresent('[role="dialog"]')
        ->assertSee('Emailed to 2 people');

    Notification::assertCount(2);

    $alicePage->click('Share')
        ->click('Share to Slack')
        ->assertSee('Share the results to Slack')
        ->click($send)
        ->assertNotPresent('[role="dialog"]')
        ->assertSee('Sending to Slack…');

    $this->workQueue();

    $alicePage->assertSee('Sent to Slack')
        ->press('Reopen')
        ->assertSeeIn($current, 'ROTI');

    $carolPage->assertSeeIn($current, 'ROTI')
        ->assertNotPresent('#completed-tab-results')
        ->assertPresent('[role="group"][aria-label="How was this retro?"]');

    expect($retro->fresh()->phase)->toBe(RetroPhase::Roti)
        ->and($retro->fresh()->started_at)->not->toBeNull();
});

it('[P18e-02-04b] shows no duration at the end of a retro without a start time', function () {
    [$retro, $alice] = p18eRotiBoard(started: false);
    $retro->forceFill(['phase' => RetroPhase::Completed, 'completed_at' => now()])->save();

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $page->assertSeeIn('[data-slot="retro-session-end-line"]', 'SESSION ENDED ·')
        ->assertDontSeeIn('[data-slot="retro-session-end-line"]', 'MIN')
        ->assertSeeIn(p18eStat('Votes cast'), '2 of 10');

    expect($retro->fresh()->started_at)->toBeNull();
});

it('[P18e-02-07] holds a reaction in place instead of flying it and throws no confetti for a viewer who prefers reduced motion, who reads that the session has ended in a toast', function () {
    [$retro, $alice, $bob] = p18eRotiBoard();
    $joinPath = "/join/{$retro->guest_token}";
    $watchReactions = '() => { window.p18eReactionAnimations = []; new MutationObserver(() => { for (const reaction of document.querySelectorAll(".lr-reaction")) { const name = getComputedStyle(reaction).animationName; if (! window.p18eReactionAnimations.includes(name)) { window.p18eReactionAnimations.push(name); } } }).observe(document.body, { childList: true, subtree: true }); return true; }';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = visit($joinPath, ['reducedMotion' => 'reduce']);

    $carolPage->fill('#name', 'Carol Guest')
        ->click('Join')
        ->assertPathIsNot($joinPath);

    $this->awaitRealtime($carolPage)
        ->assertScript('window.matchMedia("(prefers-reduced-motion: reduce)").matches', true);

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertPresent('[role="group"][aria-label="3 online"]');
    }

    foreach ([$bobPage, $carolPage] as $page) {
        $page->script($watchReactions);
    }

    $alicePage->click('[aria-label="Send a reaction 🎉"]');

    $bobPage->assertPresent('.lr-reaction')
        ->assertScript('window.p18eReactionAnimations.length > 0 && ! window.p18eReactionAnimations.includes("lr-hold")', true);
    $carolPage->assertPresent('.lr-reaction')
        ->assertScript('window.p18eReactionAnimations.join(",")', 'lr-hold');

    $alicePage->click('[data-slot="facilitator-bar"] button:has-text("End session")');

    $bobPage->assertSeeIn('[aria-current="step"]', 'Completed')
        ->assertPresent('[data-slot="session-confetti"]');

    $carolPage->assertSeeIn('[aria-current="step"]', 'Completed')
        ->assertSee('Session ended — 1 action created')
        ->assertNotPresent('[data-slot="session-confetti"]');
});

it('[P18e-02-15] throws the confetti for a guest in a second browser when the facilitator ends the session, and none after a reload', function () {
    [$retro, $alice] = p18eRotiBoard();
    $confetti = '[data-slot="session-confetti"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->assertNotPresent($confetti);

    $alicePage->click('[data-slot="facilitator-bar"] button:has-text("End session")');

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn('[aria-current="step"]', 'Completed')
            ->assertCount("{$confetti} > span", 40)
            ->assertAttribute($confetti, 'aria-hidden', 'true')
            ->assertPresent('[role="toolbar"][aria-label="Reactions"]');
    }

    $carolPage->navigate("/retros/{$retro->id}");

    $this->awaitRealtime($carolPage)
        ->assertSeeIn('[aria-current="step"]', 'Completed')
        ->assertSee('Sprint 42, wrapped up')
        ->assertNotPresent($confetti);
});
