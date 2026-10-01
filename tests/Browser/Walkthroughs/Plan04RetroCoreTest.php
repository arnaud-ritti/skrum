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

function plan04Card(Retro $retro, Column $column, Participant $author, string $content, int $position = 0): Card
{
    return Card::factory()->create([
        'retro_id' => $retro->id,
        'column_id' => $column->id,
        'participant_id' => $author->id,
        'content' => $content,
        'position' => $position,
    ]);
}

function plan04Column(Column $column): string
{
    return "[data-test=\"retro-column-{$column->id}\"]";
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

    $page->assertSee('New retrospective')
        ->click('New retrospective')
        ->assertVisible('#new-retro-title')
        ->fill('#new-retro-title', 'Sprint 12 retro')
        ->assertSee('Start, Stop, Continue')
        ->click('[role="dialog"] li button:has-text("Start, Stop, Continue")')
        ->assertSeeIn('[role="dialog"] li button[aria-pressed="true"]', 'Start, Stop, Continue')
        ->click('[role="dialog"] button[type="submit"]')
        ->assertPathBeginsWith('/retros/')
        ->assertSeeIn('header > h1', 'Sprint 12 retro')
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
    $start = plan04Column($columns[0]);
    $composer = "{$start} textarea";
    $add = "{$start} form button:not([type=\"button\"])";
    $placeholders = "[...document.querySelectorAll('article[id^=\"card-\"]')].filter((card) => card.innerText.includes('Hidden until writing ends')).length";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

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
    $flaky = plan04Card($retro, $columns[0], $bobParticipant, 'Flaky tests', 0);
    $slow = plan04Card($retro, $columns[0], $bobParticipant, 'Slow CI', 1);
    $handle = "@retro-card-handle-{$flaky->id}";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->assertSee('Drag cards onto each other to group them.')
        ->assertPresent($handle);

    $bobPage->keys($handle, 'Space')
        ->assertAttribute($handle, 'aria-pressed', 'true');
    $bobPage->script('() => new Promise((resolve) => setTimeout(() => resolve(true), 0))');
    $bobPage->keys($handle, 'ArrowDown');
    $bobPage->script('() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))');
    $bobPage->keys($handle, 'Space')
        ->assertNotPresent($handle);

    $alicePage->assertPresent("#card-{$slow->id} #card-{$flaky->id}");
    expect($flaky->fresh()->parent_card_id)->toBe($slow->id);

    $bobPage->assertPresent("#card-{$flaky->id} [aria-label=\"Ungroup\"]")
        ->click("#card-{$flaky->id} [aria-label=\"Ungroup\"]");

    $alicePage->assertNotPresent("#card-{$slow->id} #card-{$flaky->id}")
        ->assertPresent("#card-{$flaky->id}");
    expect($flaky->fresh()->parent_card_id)->toBeNull();

    $bobPage->assertPresent($handle);

    $this->dragWithKeyboard($bobPage, $handle, ['Space', 'ArrowRight', 'Space']);

    $stop = plan04Column($columns[1]);

    $alicePage->assertPresent("{$stop} #card-{$flaky->id}");
    expect($flaky->fresh()->column_id)->toBe($columns[1]->id);
});

it('[P04-04] enforces the vote limit, shows the progress and hides per-card totals during Voting', function () {
    [$retro, $columns, $alice, $bob, $aliceParticipant] = plan04Board(RetroPhase::Voting, [
        'votes_per_participant' => 2,
        'hide_vote_counts' => true,
    ]);
    $slow = plan04Card($retro, $columns[0], $aliceParticipant, 'Slow CI', 0);
    $flaky = plan04Card($retro, $columns[0], $aliceParticipant, 'Flaky tests', 1);
    $addVote = fn (Card $card): string => "#card-{$card->id} [aria-label=\"Add a vote\"]";
    $isDisabled = fn (Card $card): string => "document.querySelector('#card-{$card->id} [aria-label=\"Add a vote\"]').disabled";
    $showsTotal = fn (Card $card): string => "[...document.querySelectorAll('#card-{$card->id} [aria-label]')].some((element) => /^\\d+ votes?$/.test(element.getAttribute('aria-label')))";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->assertSee('Votes left: 2')
        ->assertSee('0 of 4 votes cast')
        ->click($addVote($slow))
        ->assertSee('Votes left: 1');
    $alicePage->assertSee('1 of 4 vote cast');

    $bobPage->click($addVote($flaky))
        ->assertSee('Votes left: 0')
        ->assertScript($isDisabled($slow), true)
        ->assertScript($isDisabled($flaky), true)
        ->assertScript($showsTotal($slow), false)
        ->assertScript($showsTotal($flaky), false);

    $alicePage->assertSee('2 of 4 votes cast')
        ->assertAttribute('[role="progressbar"]', 'aria-valuenow', '2')
        ->assertAttribute('[role="progressbar"]', 'aria-valuemax', '4')
        ->assertSee('Votes left: 2')
        ->assertScript($showsTotal($slow), false)
        ->assertScript($showsTotal($flaky), false);

    $bobPage->click("#card-{$slow->id} [aria-label=\"Remove a vote\"]")
        ->assertSee('Votes left: 1');
    $alicePage->assertSee('1 of 4 vote cast');

    expect($retro->votes()->count())->toBe(1);
});

it('[P04-05a] shows the vote totals and sorts the cards by votes during Discussing', function () {
    [$retro, $columns, , $bob, $aliceParticipant, $bobParticipant] = plan04Board(RetroPhase::Discussing);
    $flaky = plan04Card($retro, $columns[0], $aliceParticipant, 'Flaky tests', 0);
    $slow = plan04Card($retro, $columns[0], $aliceParticipant, 'Slow CI', 1);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $flaky->id, 'participant_id' => $aliceParticipant->id]);
    Vote::factory()->count(3)->create(['retro_id' => $retro->id, 'card_id' => $slow->id, 'participant_id' => $bobParticipant->id]);
    $start = plan04Column($columns[0]);

    $page = $this->signIn($bob, "/retros/{$retro->id}");

    $page->assertPresent("#card-{$slow->id} [aria-label=\"3 votes\"]")
        ->assertPresent("#card-{$flaky->id} [aria-label=\"1 vote\"]")
        ->assertNotPresent('[aria-label="Add a vote"]')
        ->assertScript(plan04CardOrder($columns[0]), "card-{$slow->id},card-{$flaky->id}")
        ->click("{$start} button[aria-pressed=\"true\"]")
        ->assertPresent("{$start} button[aria-pressed=\"false\"]")
        ->assertScript(plan04CardOrder($columns[0]), "card-{$flaky->id},card-{$slow->id}");
});

it('[P04-05b] scrolls the highlighted card into view for everyone during Discussing', function () {
    [$retro, $columns, $alice, $bob, $aliceParticipant] = plan04Board(RetroPhase::Discussing);
    $cards = [];

    foreach (range(0, 13) as $position) {
        $cards[] = plan04Card($retro, $columns[0], $aliceParticipant, "Topic {$position}", $position);
    }

    $target = $cards[13];
    $inView = "(() => { const box = document.getElementById('card-{$target->id}').getBoundingClientRect(); return box.top >= 0 && box.bottom <= window.innerHeight; })()";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->resize(1280, 600)
        ->assertPresent("#card-{$target->id}")
        ->assertScript($inView, false);

    $alicePage->click("#card-{$target->id} button[aria-pressed=\"false\"]")
        ->assertPresent("#card-{$target->id} button[aria-pressed=\"true\"]");

    $bobPage->assertAttributeContains("#card-{$target->id}", 'class', 'ring-primary')
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
        ->assertSeeIn('aside:not([aria-label])', 'Automate the release notes');
    $bobPage->assertSeeIn('aside:not([aria-label])', 'Automate the release notes');

    $bobPage->fill($input, 'Rotate the on-call')
        ->keys($input, 'Enter')
        ->assertSeeIn('aside:not([aria-label])', 'Rotate the on-call');
    $carolPage->assertSeeIn('aside:not([aria-label])', 'Rotate the on-call');

    $guestItem = ActionItem::query()->where('content', 'Automate the release notes')->firstOrFail();

    $carolPage->click("#action-item-{$guestItem->id} [aria-label=\"Mark as done\"]")
        ->assertPresent("#action-item-{$guestItem->id} [aria-label=\"Reopen\"]");
    $bobPage->assertPresent("#action-item-{$guestItem->id} [aria-label=\"Reopen\"]");
    expect($guestItem->fresh()->completed_at)->not->toBeNull();

    $carolPage->click("#action-item-{$guestItem->id} [aria-label=\"Delete action item\"]");
    $bobPage->assertNotPresent("#action-item-{$guestItem->id}")
        ->assertSeeIn('aside:not([aria-label])', 'Rotate the on-call');

    expect($retro->actionItems()->pluck('content')->all())->toBe(['Rotate the on-call']);
});

it('[P04-06] shows the summary and a read-only board once Completed', function () {
    [$retro, $columns, , $bob, $aliceParticipant, $bobParticipant] = plan04Board(RetroPhase::Completed, [
        'completed_at' => now(),
    ]);
    $slow = plan04Card($retro, $columns[0], $aliceParticipant, 'Slow CI', 0);
    plan04Card($retro, $columns[0], $bobParticipant, 'Flaky tests', 1);
    Vote::factory()->count(2)->create(['retro_id' => $retro->id, 'card_id' => $slow->id, 'participant_id' => $bobParticipant->id]);
    ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'content' => 'Buy a faster runner',
        'created_by_participant_id' => $aliceParticipant->id,
    ]);

    $page = $this->signIn($bob, "/retros/{$retro->id}");

    $page->assertSeeIn('[aria-current="step"]', 'Completed')
        ->assertSee('Retrospective completed on')
        ->assertSee('Top topics')
        ->assertSee('Slow CI')
        ->assertSee('Action items')
        ->assertSee('Buy a faster runner')
        ->assertNotPresent('[aria-label="Add an action item…"]')
        ->click('#completed-tab-board')
        ->assertPresent("#card-{$slow->id} [aria-label=\"2 votes\"]")
        ->assertSee('Flaky tests')
        ->assertNotPresent('[aria-label="Add a card…"]')
        ->assertNotPresent('[aria-label="Add a vote"]')
        ->assertNotPresent('[aria-label="Edit card"]')
        ->assertNotPresent('[aria-label="Delete card"]')
        ->assertNotPresent('[aria-label="Add an action item…"]');
});

it('[P04-07] follows the facilitator through every phase, a reopen and a second completion', function () {
    [$retro, $columns, $alice, $bob, , $bobParticipant] = plan04Board();
    plan04Card($retro, $columns[0], $bobParticipant, 'Pair on reviews');
    $current = '[aria-current="step"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $alicePage->assertSeeIn($current, 'Writing')->assertSee('Hidden until writing ends');
    $bobPage->assertSeeIn($current, 'Writing')->assertCount('[aria-label="Add a card…"]', 3);

    $alicePage->press('Next')->assertSeeIn($current, 'Grouping')->assertSee('Pair on reviews');
    $bobPage->assertSeeIn($current, 'Grouping')
        ->assertSee('Drag cards onto each other to group them.')
        ->assertNotPresent('[aria-label="Add a card…"]');

    $alicePage->press('Next')->assertSeeIn($current, 'Voting');
    $bobPage->assertSeeIn($current, 'Voting')
        ->assertSee('Votes left: 5')
        ->assertPresent('[aria-label="Add a vote"]');

    $alicePage->press('Next')->assertSeeIn($current, 'Discussing');
    $bobPage->assertSeeIn($current, 'Discussing')
        ->assertNotPresent('[aria-label="Add a vote"]')
        ->assertPresent('[aria-label="Add an action item…"]');

    $alicePage->press('Complete')->assertSeeIn($current, 'Completed');
    $bobPage->assertSeeIn($current, 'Completed')
        ->assertSee('Top topics')
        ->assertNotPresent('[aria-label="Add an action item…"]');
    expect($retro->fresh()->completed_at)->not->toBeNull();

    $alicePage->press('Reopen')->assertSeeIn($current, 'Discussing');
    $bobPage->assertSeeIn($current, 'Discussing')
        ->assertPresent('[aria-label="Add an action item…"]');
    expect($retro->fresh()->completed_at)->toBeNull();

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

    $page->assertSeeIn('[role="timer"]', "Time's up!");
});

it('[P04-09] never shows the author of another participant\'s card on an anonymous retro', function (string $phase) {
    [$retro, $columns, , $bob, $aliceParticipant, $bobParticipant] = plan04Board(RetroPhase::from($phase), [
        'is_anonymous' => true,
        'completed_at' => $phase === RetroPhase::Completed->value ? now() : null,
    ]);
    $theirs = plan04Card($retro, $columns[0], $aliceParticipant, 'Too many meetings', 0);
    $mine = plan04Card($retro, $columns[0], $bobParticipant, 'Pairing works well', 1);

    $page = $this->signIn($bob, "/retros/{$retro->id}");

    if ($phase === RetroPhase::Completed->value) {
        $page->click('#completed-tab-board');
    }

    $page->assertSeeIn("#card-{$mine->id}", 'Pairing works well')
        ->assertSeeIn("#card-{$mine->id}", 'Bob Stone')
        ->assertDontSeeIn("#card-{$theirs->id}", 'Alice Martin');

    if ($phase === RetroPhase::Writing->value) {
        $page->assertSeeIn("#card-{$theirs->id}", 'Hidden until writing ends');

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

    $carolPage->assertSeeIn('header > h1', 'Sprint 12');

    $alicePage->click('[aria-label="Facilitator menu"]')
        ->assertSee('Guest link…')
        ->click('Guest link…')
        ->assertVisible($link)
        ->assertScript("document.querySelector('{$link}').value.includes('{$oldToken}')", true)
        ->press('Create a new link');

    $carolPage->assertSee('Your access to this retrospective has ended.')
        ->assertNotPresent('[aria-label="Add a card…"]');

    $alicePage->assertScript("document.querySelector('{$link}').value.includes('{$oldToken}')", false);

    $newLink = $alicePage->value($link);
    $newToken = $retro->fresh()->guest_token;

    expect($newToken)->not->toBe($oldToken)
        ->and($newLink)->toEndWith("/join/{$newToken}");

    visit("/join/{$oldToken}")->assertSee('This guest link is no longer valid.');

    $davePage = $this->joinAsGuest("/join/{$newToken}", 'Dave Guest');

    $davePage->assertSeeIn('header > h1', 'Sprint 12')
        ->assertCount('[aria-label="Add a card…"]', 3);
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
        ->assertNotPresent('[aria-label="Add a card…"]');

    $alicePage->assertPathIs($teamPath);

    expect(Retro::query()->whereKey($retro->id)->exists())->toBeFalse();
});
