<?php

use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Vote;
use Tests\Browser\Support\ReverbServer;

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     0: Retro,
 *     1: array<int, Column>,
 *     2: User,
 *     3: User,
 *     4: Participant,
 *     5: Participant
 * }
 */
function plan04Board(RetroPhase $phase = RetroPhase::Writing, array $attributes = []): array
{
    $retro = Retro::factory()
        ->inPhase($phase)
        ->withGuestAccess()
        ->create(['title' => 'Sprint 12', ...$attributes]);

    $columns = [];

    foreach (['Start', 'Stop', 'Continue'] as $position => $title) {
        $columns[] = Column::factory()->create([
            'retro_id' => $retro->id,
            'title' => $title,
            'position' => $position,
        ]);
    }

    [$alice, $aliceParticipant] = retroFacilitator($retro);
    [$bob, $bobParticipant] = retroMember($retro);

    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);
    $bob->update(['name' => 'Bob Stone', 'locale' => 'en']);

    return [$retro->fresh(), $columns, $alice, $bob, $aliceParticipant, $bobParticipant];
}

function plan04Composer(Column $column): string
{
    return retroColumn($column).' [data-slot="retro-card-composer"] textarea';
}

function plan04OpenComposer(mixed $page, Column $column): mixed
{
    return $page->click(retroColumn($column).' [data-slot="retro-column-add"]')
        ->assertVisible(plan04Composer($column));
}

function plan04CardOrder(Column $column): string
{
    return "[...document.querySelectorAll('[data-test=\"retro-column-{$column->id}\"] article[id^=\"card-\"]')].map((card) => card.id).join(',')";
}

it('[P04-01] creates a Start, Stop, Continue retro from the team page', function () {
    $team = Team::factory()->create();
    $alice = teamMember($team);
    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);

    $page = $this->signIn($alice, route('teams.show', [$team->workspace, $team], false));

    $page->assertSee('New session')
        ->click('New session')
        ->assertVisible('#new-retro-title')
        ->fill('#new-retro-title', 'Sprint 12 retro')
        ->assertSee('Start, Stop, Continue')
        ->click('[role="dialog"] [role="radiogroup"][aria-label="Retrospective template"] [role="radio"]:has-text("Start, Stop, Continue")')
        ->assertSeeIn('[role="dialog"] [role="radiogroup"][aria-label="Retrospective template"] [role="radio"][aria-checked="true"]', 'Start, Stop, Continue')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/retros/')
        ->assertSeeIn('header >> h1', 'Sprint 12 retro')
        ->assertSeeIn('[aria-current="step"]', 'Writing')
        ->assertCount('[data-test^="retro-column-"]', 3)
        ->assertSeeIn('main:has([data-test^="retro-column-"])', 'Start')
        ->assertSeeIn('main:has([data-test^="retro-column-"])', 'Stop')
        ->assertSeeIn('main:has([data-test^="retro-column-"])', 'Continue')
        ->assertPresent('[aria-label="Facilitator menu"]');

    $retro = Retro::query()->where('title', 'Sprint 12 retro')->firstOrFail();

    expect($retro->template)->toBe('start_stop_continue')
        ->and($retro->phase)->toBe(RetroPhase::Writing)
        ->and($retro->columns->pluck('title')->all())->toBe(['Start', 'Stop', 'Continue'])
        ->and($retro->facilitator->user_id)->toBe($alice->id);
});

it('[P04-02] hides the cards of other participants behind placeholders during Writing', function () {
    [$retro, $columns, $alice, $bob] = plan04Board();
    $start = retroColumn($columns[0]);
    $composer = plan04Composer($columns[0]);
    $add = "{$start} [data-slot=\"retro-card-composer\"] button[type=\"submit\"]";
    $placeholders = "[...document.querySelectorAll('article[id^=\"card-\"]')].filter((card) => card.innerText.includes('Hidden until the reveal')).length";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    foreach ([$alicePage, $bobPage, $carolPage] as $page) {
        plan04OpenComposer($page, $columns[0]);
    }

    $alicePage->fill($composer, 'Ship smaller pull requests')
        ->click($add)
        ->assertSee('Ship smaller pull requests');
    $bobPage->assertScript($placeholders, 1);

    $bobPage->fill($composer, 'Stop skipping code review')
        ->click($add)
        ->assertSee('Stop skipping code review');
    $carolPage->assertScript($placeholders, 2);

    $carolPage->fill($composer, 'Keep the demo on Fridays')
        ->click($add)
        ->assertSee('Keep the demo on Fridays');

    $views = [
        [$alicePage, 'Ship smaller pull requests', ['Stop skipping code review', 'Keep the demo on Fridays']],
        [$bobPage, 'Stop skipping code review', ['Ship smaller pull requests', 'Keep the demo on Fridays']],
        [$carolPage, 'Keep the demo on Fridays', ['Ship smaller pull requests', 'Stop skipping code review']],
    ];

    $bobPage->navigate("/retros/{$retro->id}");
    $this->awaitRealtime($bobPage);

    foreach ($views as [$page, $own, $others]) {
        $page->assertCount('article[id^="card-"]', 3)
            ->assertScript($placeholders, 2)
            ->assertSee($own);

        foreach ($others as $text) {
            $page->assertDontSee($text)
                ->assertScript("document.body.innerText.includes(\"{$text}\")", false)
                ->assertScript("document.documentElement.outerHTML.includes(\"{$text}\")", false);
        }
    }

    expect($retro->cards()->count())->toBe(3);
});

it('[P04-03] groups, ungroups and moves a card during Grouping', function () {
    [$retro, $columns, $alice, $bob, , $bobParticipant] = plan04Board(RetroPhase::Grouping);
    $flaky = boardCard($retro, $columns[0], $bobParticipant, 'Flaky tests', 0);
    $slow = boardCard($retro, $columns[0], $bobParticipant, 'Slow CI', 1);
    $handle = "@retro-card-handle-{$flaky->id}";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->assertSee('Drag a card onto another to group them. Click a title to rename it.')
        ->assertPresent($handle);

    $this->dragWithKeyboard($bobPage, $handle, ['Space', 'ArrowDown', 'Space'], handleRemains: false);

    $alicePage->assertPresent("#group-{$slow->id} #card-{$flaky->id}");
    expect($flaky->fresh()->parent_card_id)->toBe($slow->id);

    $bobPage->assertPresent("#card-{$flaky->id} [aria-label=\"Ungroup\"]")
        ->click("#card-{$flaky->id} [aria-label=\"Ungroup\"]");

    $alicePage->assertNotPresent("#group-{$slow->id} #card-{$flaky->id}")
        ->assertPresent("#card-{$flaky->id}");
    expect($flaky->fresh()->parent_card_id)->toBeNull();

    $bobPage->assertPresent($handle);

    $this->dragWithKeyboard($bobPage, $handle, ['Space', 'ArrowRight', 'Space']);

    $stop = retroColumn($columns[1]);

    $alicePage->assertPresent("{$stop} #card-{$flaky->id}");
    expect($flaky->fresh()->column_id)->toBe($columns[1]->id);
});

it('[P04-04] enforces the vote limit, shows the progress and hides per-card totals during Voting', function () {
    [$retro, $columns, $alice, $bob, $aliceParticipant] = plan04Board(RetroPhase::Voting, [
        'votes_per_participant' => 2,
        'hide_vote_counts' => true,
    ]);
    $slow = boardCard($retro, $columns[0], $aliceParticipant, 'Slow CI', 0);
    $flaky = boardCard($retro, $columns[0], $aliceParticipant, 'Flaky tests', 1);
    $addVote = fn (Card $card): string => "#card-{$card->id} [aria-label=\"Add a vote\"]";
    $isDisabled = fn (Card $card): string => "document.querySelector('#card-{$card->id} [aria-label=\"Add a vote\"]').disabled";
    $showsTotal = fn (Card $card): string => "[...document.querySelectorAll('#card-{$card->id} [aria-label]')].some((element) => /^\\d+ votes?$/.test(element.getAttribute('aria-label')))";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->assertSee('Votes left: 2')
        ->assertSee('0 of 4 votes cast')
        ->click($addVote($slow))
        ->assertSee('Votes left: 1');
    $alicePage->assertSee('1 of 4 votes cast');

    $bobPage->click($addVote($flaky))
        ->assertSee('Votes left: 0')
        ->assertScript($isDisabled($slow), true)
        ->assertScript($isDisabled($flaky), true)
        ->assertScript($showsTotal($slow), false)
        ->assertScript($showsTotal($flaky), false);

    $alicePage->assertSee('2 of 4 votes cast')
        ->assertAttribute('[role="progressbar"][aria-label="Votes cast"]', 'aria-valuenow', '2')
        ->assertAttribute('[role="progressbar"][aria-label="Votes cast"]', 'aria-valuemax', '4')
        ->assertSee('Votes left: 2')
        ->assertScript($showsTotal($slow), false)
        ->assertScript($showsTotal($flaky), false);

    $bobPage->click("#card-{$slow->id} [aria-label=\"Remove a vote\"]")
        ->assertSee('Votes left: 1');
    $alicePage->assertSee('1 of 4 votes cast');

    expect($retro->votes()->count())->toBe(1);
});

it('[P04-05a] shows the vote totals and lists the topics by votes during Discussing', function () {
    [$retro, $columns, , $bob, $aliceParticipant, $bobParticipant] = plan04Board(RetroPhase::Discussing);
    $flaky = boardCard($retro, $columns[0], $aliceParticipant, 'Flaky tests', 0);
    $slow = boardCard($retro, $columns[0], $aliceParticipant, 'Slow CI', 1);
    $quiet = boardCard($retro, $columns[1], $aliceParticipant, 'Quiet standups', 0);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $flaky->id, 'participant_id' => $aliceParticipant->id]);
    Vote::factory()->count(3)->create(['retro_id' => $retro->id, 'card_id' => $slow->id, 'participant_id' => $bobParticipant->id]);
    $topics = '[data-test="retro-topics"]';
    $topicOrder = "[...document.querySelectorAll('{$topics} > li')].map((topic) => topic.dataset.topicId).join(',')";

    $page = $this->signIn($bob, "/retros/{$retro->id}");

    $page->assertScript($topicOrder, "{$slow->id},{$flaky->id},{$quiet->id}")
        ->assertSeeIn("{$topics} > li:first-child", 'Slow CI')
        ->assertSeeIn("{$topics} > li:first-child", '3 votes')
        ->assertSeeIn("{$topics} > li:last-child", 'Quiet standups')
        ->assertSeeIn("{$topics} > li:last-child", '0 votes')
        ->assertNotPresent('[data-test="retro-sort-by-votes"]')
        ->assertNotPresent('[data-test^="retro-column-"]')
        ->assertPresent("#card-{$slow->id} [aria-label=\"3 votes\"]")
        ->assertNotPresent('[aria-label="Add a vote"]')
        ->click("{$topics} li:has-text(\"Flaky tests\")")
        ->assertPresent("#card-{$flaky->id} [aria-label=\"1 vote\"]")
        ->assertNotPresent("#card-{$slow->id}");
});

it('[P04-05b] brings the highlighted topic in front of everyone during Discussing', function () {
    [$retro, $columns, $alice, $bob, $aliceParticipant] = plan04Board(RetroPhase::Discussing);
    $cards = [];

    foreach (range(0, 13) as $position) {
        $cards[] = boardCard($retro, $columns[0], $aliceParticipant, "Topic {$position}", $position);
    }

    $target = $cards[13];
    $inView = "(() => { const box = document.getElementById('card-{$target->id}').getBoundingClientRect(); return box.top >= 0 && box.bottom <= window.innerHeight; })()";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->resize(1280, 600)
        ->assertPresent("#card-{$cards[0]->id}")
        ->assertNotPresent("#card-{$target->id}");

    $alicePage->click('[data-test="retro-topics"] li:has-text("Topic 13")')
        ->click("#card-{$target->id} button[aria-pressed=\"false\"]")
        ->assertPresent("#card-{$target->id} button[aria-pressed=\"true\"]");

    $bobPage->assertAttribute("#card-{$target->id}", 'data-focused', 'true')
        ->assertScript($inView, true);

    expect($retro->fresh()->highlighted_card_id)->toBe($target->id);
});

it('[P04-05c] lets a guest and a member add, complete and delete action items during Discussing', function () {
    [$retro, , , $bob] = plan04Board(RetroPhase::Discussing);
    $input = '[aria-label="Add an action item…"]';

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->fill($input, 'Automate the release notes')
        ->keys($input, 'Enter')
        ->assertSeeIn('[data-test="retro-action-items-panel"]', 'Automate the release notes');
    $bobPage->assertSeeIn('[data-test="retro-action-items-panel"]', 'Automate the release notes');

    $bobPage->fill($input, 'Rotate the on-call')
        ->keys($input, 'Enter')
        ->assertSeeIn('[data-test="retro-action-items-panel"]', 'Rotate the on-call');
    $carolPage->assertSeeIn('[data-test="retro-action-items-panel"]', 'Rotate the on-call');

    $guestItem = ActionItem::query()->where('content', 'Automate the release notes')->firstOrFail();

    $carolPage->click("#action-item-{$guestItem->id} [aria-label=\"Mark as in progress\"]")
        ->click("#action-item-{$guestItem->id} [aria-label=\"Mark as done\"]")
        ->assertPresent("#action-item-{$guestItem->id} [aria-label=\"Reopen\"]");
    $bobPage->assertPresent("#action-item-{$guestItem->id} [aria-label=\"Reopen\"]");
    expect($guestItem->fresh()->completed_at)->not->toBeNull();

    $carolPage->click("#action-item-{$guestItem->id} [aria-label=\"Delete action item\"]")
        ->assertSeeIn('[role="alertdialog"]', 'Delete this action item?')
        ->click('[role="alertdialog"] button:has-text("Delete")')
        ->assertNotPresent('[role="alertdialog"]');
    $bobPage->assertNotPresent("#action-item-{$guestItem->id}")
        ->assertSeeIn('[data-test="retro-action-items-panel"]', 'Rotate the on-call');

    expect($retro->actionItems()->pluck('content')->all())->toBe(['Rotate the on-call']);
});

it('[P04-06] shows the summary and a read-only board once Completed', function () {
    [$retro, $columns, , $bob, $aliceParticipant, $bobParticipant] = plan04Board(RetroPhase::Completed, [
        'completed_at' => now(),
    ]);
    $slow = boardCard($retro, $columns[0], $aliceParticipant, 'Slow CI', 0);
    boardCard($retro, $columns[0], $bobParticipant, 'Flaky tests', 1);
    Vote::factory()->count(2)->create(['retro_id' => $retro->id, 'card_id' => $slow->id, 'participant_id' => $bobParticipant->id]);
    ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'content' => 'Buy a faster runner',
        'created_by_participant_id' => $aliceParticipant->id,
    ]);

    $page = $this->signIn($bob, "/retros/{$retro->id}");

    $page->assertSeeIn('[aria-current="step"]', 'Completed')
        ->assertSee('Session ended')
        ->assertSee('Top topics')
        ->assertSee('Slow CI')
        ->assertSee('Actions created')
        ->assertSee('Buy a faster runner')
        ->assertNotPresent('[aria-label="Add an action item…"]')
        ->click('#completed-tab-board')
        ->assertPresent("#card-{$slow->id} [aria-label=\"2 votes\"]")
        ->assertSee('Flaky tests')
        ->assertNotPresent('[data-slot="retro-column-add"]')
        ->assertNotPresent('[aria-label="Add a vote"]')
        ->assertNotPresent('[aria-label="Edit card"]')
        ->assertNotPresent('[aria-label="Delete card"]')
        ->assertNotPresent('[aria-label="Add an action item…"]');
});

it('[P04-07] follows the facilitator through every phase, a reopen and a second completion', function () {
    [$retro, $columns, $alice, $bob, , $bobParticipant] = plan04Board();
    boardCard($retro, $columns[0], $bobParticipant, 'Pair on reviews');
    $current = '[aria-current="step"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $alicePage->assertSeeIn($current, 'Writing')->assertSee('Hidden until the reveal');
    $bobPage->assertSeeIn($current, 'Writing')->assertCount('[data-slot="retro-column-add"]', 3);

    $alicePage->press('Next')->assertSeeIn($current, 'Grouping')->assertSee('Pair on reviews');
    $bobPage->assertSeeIn($current, 'Grouping')
        ->assertSee('Drag a card onto another to group them. Click a title to rename it.')
        ->assertNotPresent('[data-slot="retro-column-add"]');

    $alicePage->press('Next')->assertSeeIn($current, 'Voting');
    $bobPage->assertSeeIn($current, 'Voting')
        ->assertSee('Votes left: 5')
        ->assertPresent('[aria-label="Add a vote"]');

    $alicePage->press('Next')->assertSeeIn($current, 'Discussing');
    $bobPage->assertSeeIn($current, 'Discussing')
        ->assertNotPresent('[aria-label="Add a vote"]')
        ->assertPresent('[aria-label="Add an action item…"]');

    $alicePage->press('Next')->assertSeeIn($current, 'Actions');
    $bobPage->assertSeeIn($current, 'Actions')
        ->assertSee('Most voted topics')
        ->assertSeeIn('[data-test="retro-topics"]', 'Pair on reviews')
        ->assertPresent('[data-test="retro-action-items-panel"] [aria-label="Add an action item…"]');

    $alicePage->press('Next')->assertSeeIn($current, 'ROTI');
    $bobPage->assertSeeIn($current, 'ROTI')
        ->assertNotPresent('[aria-label="Add an action item…"]');

    $alicePage->press('Complete')->assertSeeIn($current, 'Completed');
    $bobPage->assertSeeIn($current, 'Completed')
        ->assertSee('Top topics')
        ->assertNotPresent('[aria-label="Add an action item…"]');
    expect($retro->fresh()->completed_at)->not->toBeNull();

    $alicePage->press('Reopen')->assertSeeIn($current, 'ROTI');
    $bobPage->assertSeeIn($current, 'ROTI')
        ->assertDontSee('Top topics');
    expect($retro->fresh()->completed_at)->toBeNull();

    $alicePage->press('Previous')->assertSeeIn($current, 'Actions');
    $bobPage->assertSeeIn($current, 'Actions')
        ->assertPresent('[aria-label="Add an action item…"]');

    $alicePage->press('Next')->assertSeeIn($current, 'ROTI');

    $alicePage->press('Complete')->assertSeeIn($current, 'Completed');
    $bobPage->assertSeeIn($current, 'Completed')->assertSee('Top topics');

    expect($retro->fresh()->phase)->toBe(RetroPhase::Completed);
});

it('[P04-08a] shows the one minute timer to every participant during Writing', function () {
    [$retro, , $alice, $bob] = plan04Board();
    $isCountingDown = "/^(1:00|0:[3-5]\\d)$/.test(document.querySelector('[role=\"timer\"]').innerText.trim())";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $bobPage->assertNotPresent('[role="timer"]');

    $alicePage->click('[aria-label="Timer"]')
        ->assertSee('1 min')
        ->click('1 min')
        ->assertNotPresent('[role="menu"]');

    foreach ([$alicePage, $bobPage, $carolPage] as $page) {
        $page->assertPresent('[role="timer"]')->assertScript($isCountingDown, true);
    }

    expect($retro->fresh()->timer_ends_at)->not->toBeNull();

    $alicePage->click('[aria-label="Timer"]')
        ->assertSee('Stop timer')
        ->click('Stop timer');

    foreach ([$alicePage, $bobPage, $carolPage] as $page) {
        $page->assertNotPresent('[role="timer"]');
    }

    expect($retro->fresh()->timer_ends_at)->toBeNull();
});

it('[P04-08b] tells the participant when the timer reaches zero', function () {
    [$retro, , , $bob] = plan04Board();
    $retro->update(['timer_ends_at' => now()->addSeconds(3)]);

    $page = $this->signIn($bob, "/retros/{$retro->id}");

    $page->assertAttribute('[role="timer"]', 'aria-label', "Time's up!");
});

it('[P04-09] never shows the author of another participant\'s card on an anonymous retro', function (string $phase) {
    [$retro, $columns, , $bob, $aliceParticipant, $bobParticipant] = plan04Board(RetroPhase::from($phase), [
        'is_anonymous' => true,
        'completed_at' => $phase === RetroPhase::Completed->value ? now() : null,
    ]);
    $theirs = boardCard($retro, $columns[0], $aliceParticipant, 'Too many meetings', 0);
    $mine = boardCard($retro, $columns[0], $bobParticipant, 'Pairing works well', 1);

    $page = $this->signIn($bob, "/retros/{$retro->id}");

    if ($phase === RetroPhase::Completed->value) {
        $page->click('#completed-tab-board');
    }

    $focusTopic = function (string $content) use ($page, $phase): void {
        if ($phase === RetroPhase::Discussing->value) {
            $page->click("[data-test=\"retro-topics\"] li:has-text(\"{$content}\")");
        }
    };

    $focusTopic('Pairing works well');

    $page->assertSeeIn("#card-{$mine->id}", 'Pairing works well')
        ->assertAttribute("#card-{$mine->id} [data-slot=\"retro-card-author\"]", 'title', 'Bob Stone');

    $focusTopic('Too many meetings');

    $page->assertDontSeeIn("#card-{$theirs->id}", 'Alice Martin');

    if ($phase === RetroPhase::Writing->value) {
        $page->assertSeeIn("#card-{$theirs->id}", 'Hidden until the reveal');

        return;
    }

    $page->assertSeeIn("#card-{$theirs->id}", 'Too many meetings');
})->with(['writing', 'grouping', 'voting', 'discussing', 'completed']);

it('[P04-10] ends a guest\'s access when the facilitator creates a new guest link', function () {
    [$retro, , $alice] = plan04Board();
    $oldToken = $retro->guest_token;
    $link = 'input[aria-label="Guest link"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$oldToken}", 'Carol Guest'));

    $carolPage->assertSeeIn('header >> h1', 'Sprint 12');

    $alicePage->click('[aria-label="Facilitator menu"]')
        ->assertSee('Settings…')
        ->assertDontSee('Guest link…')
        ->keys('[role="menu"]', 'Escape')
        ->click('Share')
        ->assertVisible($link)
        ->assertScript("document.querySelector('{$link}').value.includes('{$oldToken}')", true)
        ->press('Create a new link')
        ->assertSeeIn('[role="alertdialog"]', 'Create a new link?')
        ->click('[role="alertdialog"] button:has-text("Create a new link")')
        ->assertNotPresent('[role="alertdialog"]');

    $carolPage->assertSee('Your access to this retrospective has ended.')
        ->assertNotPresent('[data-slot="retro-column-add"]');

    $alicePage->assertScript("document.querySelector('{$link}').value.includes('{$oldToken}')", false);

    $newLink = $alicePage->value($link);
    $newToken = $retro->fresh()->guest_token;

    expect($newToken)->not->toBe($oldToken)
        ->and($newLink)->toEndWith("/join/{$newToken}");

    visit("/join/{$oldToken}")->assertSee('This guest link is no longer valid.');

    $davePage = $this->joinAsGuest("/join/{$newToken}", 'Dave Guest');

    $davePage->assertSeeIn('header >> h1', 'Sprint 12')
        ->assertCount('[data-slot="retro-column-add"]', 3);
});

it('[P04-11] tells a member that the retro was deleted', function () {
    [$retro, , $alice, $bob] = plan04Board();
    $teamPath = route('teams.show', [$retro->team->workspace, $retro->team], false);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $alicePage->click('[aria-label="Facilitator menu"]')
        ->assertSee('Delete retrospective…')
        ->click('Delete retrospective…')
        ->assertSee('Delete this retrospective? Everyone loses access to it.')
        ->press('Delete');

    $bobPage->assertSee('This retrospective has been deleted.')
        ->assertSee('Back to the team')
        ->assertNotPresent('[data-slot="retro-column-add"]');

    $alicePage->assertPathIs($teamPath);

    expect(Retro::query()->whereKey($retro->id)->exists())->toBeFalse();
});

it('[P04-13] shows a translated toast and resyncs the board when the server refuses a vote', function (string $locale, string $addVoteLabel, string $toast, string $discussing) {
    [$retro, $columns, , $bob, $aliceParticipant] = plan04Board(RetroPhase::Voting);
    $bob->update(['locale' => $locale]);
    $card = boardCard($retro, $columns[0], $aliceParticipant, 'Slow CI');
    $addVote = "#card-{$card->id} [aria-label=\"{$addVoteLabel}\"]";

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $page->assertPresent($addVote);

    $retro->update(['phase' => RetroPhase::Discussing]);

    $page->click($addVote)
        ->assertSee($toast)
        ->assertSeeIn('[aria-current="step"]', $discussing)
        ->assertNotPresent($addVote)
        ->assertPresent('[data-test="retro-action-items-panel"]');

    expect($retro->votes()->count())->toBe(0);
})->with([
    'en' => ['en', 'Add a vote', 'This action is not available in the current phase.', 'Discussing'],
    'fr' => ['fr', 'Ajouter un vote', "Cette action n'est pas disponible dans la phase actuelle.", 'Discussion'],
]);

it('[P04-14a] writes a card with the keyboard only', function () {
    [$retro, $columns, $alice, $bob] = plan04Board();
    $composer = plan04Composer($columns[0]);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->keys(retroColumn($columns[0]).' [data-slot="retro-column-add"]', 'Enter')
        ->assertScript("document.activeElement === document.querySelector('{$composer}')", true)
        ->type($composer, 'Typed without a mouse')
        ->keys($composer, 'Enter')
        ->assertSeeIn('article[id^="card-"]', 'Typed without a mouse')
        ->assertValue($composer, '');

    $alicePage->assertCount('article[id^="card-"]', 1)
        ->assertSee('Hidden until the reveal');

    expect($retro->cards()->where('content', 'Typed without a mouse')->exists())->toBeTrue();
});

it('[P04-14b] casts and retracts a vote with the keyboard only', function () {
    [$retro, $columns, , $bob, $aliceParticipant] = plan04Board(RetroPhase::Voting);
    $card = boardCard($retro, $columns[0], $aliceParticipant, 'Slow CI');

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $page->assertSee('Votes left: 5')
        ->keys("#card-{$card->id} [aria-label=\"Add a vote\"]", 'Enter')
        ->assertSee('Votes left: 4');

    expect($retro->votes()->count())->toBe(1);

    $page->keys("#card-{$card->id} [aria-label=\"Remove a vote\"]", 'Space')
        ->assertSee('Votes left: 5');

    expect($retro->votes()->count())->toBe(0);
});

it('[P04-14c] reorders a card with the keyboard sensor during Writing', function () {
    [$retro, $columns, $alice, $bob, , $bobParticipant] = plan04Board();
    $first = boardCard($retro, $columns[0], $bobParticipant, 'First thought', 0);
    $second = boardCard($retro, $columns[0], $bobParticipant, 'Second thought', 1);
    $order = plan04CardOrder($columns[0]);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->assertScript($order, "card-{$first->id},card-{$second->id}");

    $this->dragWithKeyboard($bobPage, "@retro-card-handle-{$first->id}", ['Space', 'ArrowDown', 'Space']);

    $bobPage->assertScript($order, "card-{$second->id},card-{$first->id}");
    $alicePage->assertScript($order, "card-{$second->id},card-{$first->id}");

    expect($first->fresh()->position)->toBeGreaterThan($second->fresh()->position);
});

it('[P04-14d] opens every facilitator dialog with the keyboard only', function () {
    [$retro, , $alice] = plan04Board();
    $dialogs = [
        'Settings…' => ['[role="dialog"]', 'Retrospective settings'],
        'Hand over facilitation…' => ['[role="dialog"]', 'Hand over facilitation'],
        'Delete retrospective…' => ['[role="alertdialog"]', 'Delete retrospective'],
    ];

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    foreach ($dialogs as $item => [$dialog, $title]) {
        $page->keys('[aria-label="Facilitator menu"]', 'Enter')
            ->assertPresent('[role="menu"]')
            ->keys("[role=\"menu\"] [role=\"menuitem\"]:has-text(\"{$item}\")", 'Enter')
            ->assertSeeIn($dialog, $title)
            ->keys($dialog, 'Escape')
            ->assertNotPresent($dialog);
    }

    $page->keys('button:has-text("Share")', 'Enter')
        ->assertVisible('[role="dialog"] input[aria-label="Guest link"]')
        ->keys('[role="dialog"]', 'Escape')
        ->assertNotPresent('[role="dialog"]');

    $page->keys('[aria-label="Timer"]', 'Enter')
        ->assertSeeIn('[role="menu"]', '1 min')
        ->assertSeeIn('[role="menu"]', 'Stop timer')
        ->keys('[role="menu"]', 'Escape')
        ->assertNotPresent('[role="menu"]');
});

it('[P04-15a] reflows the board between 375px and 1440px', function () {
    [$retro, $columns, , $bob, $aliceParticipant] = plan04Board(RetroPhase::Discussing);
    boardCard($retro, $columns[0], $aliceParticipant, 'Slow CI');
    $topics = '[data-test="retro-topics"]';
    $panel = '[data-test="retro-action-items-panel"]';
    $stepper = 'ol[aria-label="Phases"]';
    $pageScrollsSideways = 'document.documentElement.scrollWidth > document.documentElement.clientWidth';
    $stepperIsBelowTheHeader = "document.querySelector('header {$stepper}') === null && document.querySelector('{$stepper}').getBoundingClientRect().top >= document.querySelector('header').getBoundingClientRect().bottom";
    $stepperIsInTheHeader = "document.querySelector('header {$stepper}') !== null";
    $panelIsBelowTopics = "document.querySelector('{$panel}').getBoundingClientRect().top >= document.querySelector('{$topics}').getBoundingClientRect().bottom";
    $panelIsBesideTopics = "document.querySelector('{$panel}').getBoundingClientRect().left >= document.querySelector('{$topics}').getBoundingClientRect().right";
    $selector = '[data-slot="retro-topics-selector"]';
    $panelIsBelowSelector = "document.querySelector('{$panel}').getBoundingClientRect().top >= document.querySelector('{$selector}').getBoundingClientRect().bottom";

    $page = $this->signIn($bob, "/retros/{$retro->id}");

    $page->resize(375, 812)
        ->assertPresent($panel)
        ->assertNotPresent("main {$topics}")
        ->assertPresent("main {$selector}")
        ->assertScript($pageScrollsSideways, false)
        ->assertScript($stepperIsBelowTheHeader, true)
        ->assertScript($panelIsBelowSelector, true)
        ->click("{$selector} button")
        ->assertPresent("[data-slot=\"retro-topics-drawer\"] {$topics}")
        ->keys('[data-slot="retro-topics-drawer"]', 'Escape')
        ->assertNotPresent('[data-slot="retro-topics-drawer"]');

    $page->resize(1440, 900)
        ->assertPresent("main {$topics}")
        ->assertNotPresent($selector)
        ->assertScript($stepperIsInTheHeader, true)
        ->assertScript($pageScrollsSideways, false)
        ->assertScript($panelIsBesideTopics, true)
        ->assertScript($panelIsBelowTopics, false);
});

it('[P04-16a] keeps the dark appearance on the board', function () {
    [$retro, , , $bob] = plan04Board();
    $isDark = 'document.documentElement.classList.contains("dark")';

    $page = $this->signIn($bob, '/settings/appearance');

    $page->assertScript($isDark, false)
        ->click('Dark')
        ->assertScript($isDark, true)
        ->assertScript('localStorage.getItem("appearance")', 'dark')
        ->navigate("/retros/{$retro->id}")
        ->assertSeeIn('header >> h1', 'Sprint 12')
        ->assertScript($isDark, true);
});

dataset('plan04Locales', [
    'fr' => ['fr', 'Français', 'Langue', 'Écriture', 'Regroupement', "Masquée jusqu'à la révélation", 'Ajouter une carte', 'Toi'],
    'es' => ['es', 'Español', 'Idioma', 'Escritura', 'Agrupación', 'Oculta hasta la revelación', 'Añadir una tarjeta', 'Tú'],
    'de' => ['de', 'Deutsch', 'Sprache', 'Schreiben', 'Gruppieren', 'Verborgen bis zur Aufdeckung', 'Karte hinzufügen', 'Du'],
]);

it('[P04-17a] translates the board after a member changes language in the settings', function (string $locale, string $languageName, string $languageLabel, string $writing, string $grouping, string $hidden, string $composer, string $you) {
    [$retro, $columns, , $bob, $aliceParticipant, $bobParticipant] = plan04Board();
    $theirs = boardCard($retro, $columns[0], $aliceParticipant, 'Too many meetings', 0);
    $mine = boardCard($retro, $columns[0], $bobParticipant, 'Pairing works well', 1);
    $stepper = 'header ol:has([aria-current="step"])';

    $page = $this->signIn($bob, '/settings/appearance');

    $page->assertPresent('[role="radiogroup"][aria-label="Language"]')
        ->click("[role=\"radiogroup\"][aria-label=\"Language\"] [role=\"radio\"]:has-text(\"{$languageName}\")")
        ->assertPresent("[role=\"radiogroup\"][aria-label=\"{$languageLabel}\"] [role=\"radio\"][aria-checked=\"true\"]:has-text(\"{$languageName}\")");

    expect($bob->fresh()->locale)->toBe($locale);

    $page->navigate("/retros/{$retro->id}")
        ->assertSeeIn('[aria-current="step"]', $writing)
        ->assertSeeIn($stepper, $grouping)
        ->assertSeeIn("#card-{$theirs->id}", $hidden)
        ->assertSeeIn("#card-{$mine->id} [data-slot=\"retro-card-mine\"]", $you)
        ->assertCount("[data-slot=\"retro-column-add\"]:has-text(\"{$composer}\")", 3)
        ->assertDontSee('Hidden until the reveal')
        ->assertDontSee('Add a card')
        ->assertDontSeeIn($stepper, 'Writing');
})->with('plan04Locales');

it('[P04-17b] translates the board after a guest changes language in the header', function (string $locale, string $languageName, string $languageLabel, string $writing, string $grouping, string $hidden, string $composer, string $you) {
    [$retro, $columns, , , $aliceParticipant] = plan04Board();
    $theirs = boardCard($retro, $columns[0], $aliceParticipant, 'Too many meetings');
    $stepper = 'header ol:has([aria-current="step"])';

    $page = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $page->assertSeeIn('[aria-current="step"]', 'Writing')
        ->click('header [aria-label="Language"]')
        ->assertPresent('[role="listbox"]')
        ->click($languageName)
        ->assertPresent("header [aria-label=\"{$languageLabel}\"]")
        ->assertSeeIn('[aria-current="step"]', $writing)
        ->assertSeeIn($stepper, $grouping)
        ->assertSeeIn("#card-{$theirs->id}", $hidden)
        ->assertCount("[data-slot=\"retro-column-add\"]:has-text(\"{$composer}\")", 3)
        ->assertDontSee('Hidden until the reveal')
        ->assertDontSee('Add a card')
        ->assertDontSeeIn($stepper, 'Writing');
})->with('plan04Locales');

it('[P04-12] shows the reconnecting banner and catches up when Reverb comes back', function () {
    [$retro, $columns, $alice, $bob, $aliceParticipant] = plan04Board();
    boardCard($retro, $columns[0], $aliceParticipant, 'Deploy on Fridays');
    $composer = plan04Composer($columns[0]);
    $add = retroColumn($columns[0]).' [data-slot="retro-card-composer"] button[type="submit"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->assertSee('Hidden until the reveal')
        ->assertDontSee('Reconnecting…');

    ReverbServer::stop();

    try {
        $bobPage->assertSee('Reconnecting…');
        $alicePage->assertSee('Reconnecting…');

        plan04OpenComposer($alicePage, $columns[0])
            ->fill($composer, 'Add a staging environment')
            ->click($add)
            ->assertSee('Add a staging environment')
            ->press('Next')
            ->assertSeeIn('[aria-current="step"]', 'Grouping');

        $bobPage->assertSeeIn('[aria-current="step"]', 'Writing')
            ->assertDontSee('Add a staging environment');
    } finally {
        ReverbServer::start();
    }

    $bobPage->assertDontSee('Reconnecting…')
        ->assertSeeIn('[aria-current="step"]', 'Grouping')
        ->assertSee('Deploy on Fridays')
        ->assertSee('Add a staging environment');

    $alicePage->assertDontSee('Reconnecting…');

    expect($retro->fresh()->phase)->toBe(RetroPhase::Grouping);
});
