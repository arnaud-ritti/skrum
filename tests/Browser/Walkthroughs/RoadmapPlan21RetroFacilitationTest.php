<?php

use App\Enums\IntegrationProvider;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\Card;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RotiVote;
use App\Models\TeamIntegration;
use App\Models\TopicNote;
use App\Models\User;
use App\Models\Vote;
use Illuminate\Support\Facades\Http;

/**
 * A retro of two columns with Alice facilitating and Bob as a member, both reading English, open to guests.
 *
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     0: Retro,
 *     1: User,
 *     2: User,
 *     3: Column,
 *     4: Column,
 *     5: Participant,
 *     6: Participant
 * }
 */
function rt21Board(RetroPhase $phase, array $attributes = []): array
{
    $retro = Retro::factory()->inPhase($phase)->withGuestAccess()->create([
        'title' => 'Sprint 42',
        'votes_per_participant' => 5,
        ...$attributes,
    ]);
    $start = Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Start', 'position' => 0]);
    $stop = Column::factory()->create(['retro_id' => $retro->id, 'title' => 'Stop', 'position' => 1]);
    [$alice, $aliceParticipant] = retroFacilitator($retro);
    [$bob, $bobParticipant] = retroMember($retro);
    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);
    $bob->update(['name' => 'Bob Stone', 'locale' => 'en']);

    return [$retro->fresh(), $alice, $bob, $start, $stop, $aliceParticipant, $bobParticipant];
}

function rt21Card(Retro $retro, Column $column, Participant $author, string $content, int $position = 0, int $votes = 0, ?Participant $voter = null): Card
{
    $card = Card::factory()->create([
        'retro_id' => $retro->id,
        'column_id' => $column->id,
        'participant_id' => $author->id,
        'content' => $content,
        'position' => $position,
    ]);

    Vote::factory()->count($votes)->create([
        'retro_id' => $retro->id,
        'card_id' => $card->id,
        'participant_id' => ($voter ?? $author)->id,
    ]);

    return $card;
}

/**
 * A board in Discussing with the topics Slow CI (3 votes), Flaky tests (2) and Quiet standups (1).
 *
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     0: Retro,
 *     1: User,
 *     2: User,
 *     3: array{slow: Card, flaky: Card, quiet: Card},
 *     4: Participant
 * }
 */
function rt21Discussion(RetroPhase $phase = RetroPhase::Discussing, array $attributes = []): array
{
    [$retro, $alice, $bob, $start, $stop, $aliceParticipant, $bobParticipant] = rt21Board($phase, $attributes);

    $cards = [
        'slow' => rt21Card($retro, $start, $bobParticipant, 'Slow CI', 0, 3, $aliceParticipant),
        'flaky' => rt21Card($retro, $start, $bobParticipant, 'Flaky tests', 1, 2, $aliceParticipant),
        'quiet' => rt21Card($retro, $stop, $bobParticipant, 'Quiet standups', 0, 1, $aliceParticipant),
    ];

    return [$retro->fresh(), $alice, $bob, $cards, $aliceParticipant];
}

function rt21StartWriting(mixed $page, Column $column, string $text): mixed
{
    $composer = retroColumn($column).' [data-slot="retro-card-composer"] textarea';

    return $page->click(retroColumn($column).' [data-slot="retro-column-add"]')
        ->assertVisible($composer)
        ->type($composer, $text);
}

/**
 * The assets of the board fill the resource timing buffer of the page while it loads: the buffer grows before the
 * board joins its channel, so the snapshot it refetches then is recorded.
 */
function rt21RecordResources(mixed $page): mixed
{
    $page->script('() => performance.setResourceTimingBufferSize(10000)');

    return $page;
}

/**
 * The board refetches its snapshot a quarter of a second after it joins the channel: a change written behind the page
 * waits until the answer of that refetch has arrived, so the refetch cannot bring the change to the page.
 */
function rt21AwaitSnapshot(mixed $page): mixed
{
    $page->script(<<<'JS'
        () => new Promise((resolve) => {
            const isSnapshot = (entry) => entry.name.includes('/snapshot') && entry.responseEnd > 0;

            new PerformanceObserver((list, observer) => {
                if (list.getEntries().some(isSnapshot)) {
                    observer.disconnect();
                    setTimeout(() => resolve(true), 0);
                }
            }).observe({ type: 'resource', buffered: true });
        })
        JS);

    return $page;
}

const Rt21Bar = '[data-slot="facilitator-bar"]';

const Rt21Topics = '[data-test="retro-topics"]';

const Rt21Notes = '[data-slot="retro-topic-notes"] textarea';

const Rt21PageScrollsSideways = 'document.documentElement.scrollWidth > document.documentElement.clientWidth';

it('[RT21-01] shows who is writing a card under its column and in the presence line of the other board, and drops it once the card is published', function () {
    [$retro, $alice, $bob, $start, $stop] = rt21Board(RetroPhase::Writing);
    $writing = retroColumn($start).' [data-slot="retro-activity"][data-kind="writing"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    rt21StartWriting($bobPage, $start, 'Ship smaller pull requests');

    $alicePage->assertSeeIn($writing, 'Bob is writing a card…')
        ->assertSeeIn('[data-slot="presence-stack-typing"]', 'Bob is writing…')
        ->assertNotPresent(retroColumn($stop).' [data-slot="retro-activity"]');

    $bobPage->assertNotPresent('[data-slot="retro-activity"]');

    $bobPage->keys(retroColumn($start).' [data-slot="retro-card-composer"] textarea', 'Enter')
        ->assertSeeIn('article[id^="card-"]', 'Ship smaller pull requests');

    $alicePage->assertNotPresent($writing)
        ->assertDontSeeIn('[data-slot="presence-stack-typing"]', 'is writing');
});

it('[RT21-02] counts the people writing on an anonymous retro in the presence line only, never with a name or under a column', function () {
    [$retro, $alice, $bob, $start, $stop] = rt21Board(RetroPhase::Writing, ['is_anonymous' => true]);
    $typing = '[data-slot="presence-stack-typing"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    rt21StartWriting($bobPage, $start, 'Ship smaller pull requests');

    $alicePage->assertSeeIn($typing, 'Someone is writing…')
        ->assertDontSeeIn($typing, 'Bob')
        ->assertNotPresent('[data-slot="retro-activity"]');

    rt21StartWriting($carolPage, $stop, 'Stop the late meetings');

    $alicePage->assertSeeIn($typing, '2 people are writing…')
        ->assertNotPresent('[data-slot="retro-activity"]');

    $carolPage->assertSeeIn($typing, 'Someone is writing…');

    expect(Participant::query()->where('retro_id', $retro->id)->whereNotNull('writing_until')->count())->toBe(2);

    $bobPage->keys(retroColumn($start).' [data-slot="retro-card-composer"] textarea', 'Escape');

    $alicePage->assertSeeIn($typing, 'Someone is writing…');
});

it('[RT21-03] shows who is moving a card in its column on the other board while it is held with the keyboard, and clears it when the move is cancelled and after the drop that groups it', function () {
    [$retro, $alice, $bob, $start, , , $bobParticipant] = rt21Board(RetroPhase::Grouping);
    $first = rt21Card($retro, $start, $bobParticipant, 'First thought', 0);
    $second = rt21Card($retro, $start, $bobParticipant, 'Second thought', 1);
    $moving = retroColumn($start).' [data-slot="retro-activity"][data-kind="moving"]';
    $handle = "@retro-card-handle-{$first->id}";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->keys($handle, 'Space')
        ->assertAttribute($handle, 'aria-pressed', 'true');

    $alicePage->assertSeeIn($moving, 'Bob is moving a card…');

    $bobPage->keys($handle, 'Escape')
        ->assertAttributeMissing($handle, 'aria-pressed');

    $alicePage->assertNotPresent($moving);

    expect($first->fresh()->position)->toBeLessThan($second->fresh()->position);

    $bobPage->keys($handle, 'Space')
        ->assertAttribute($handle, 'aria-pressed', 'true');

    $alicePage->assertSeeIn($moving, 'Bob is moving a card…');

    $bobPage->script('() => new Promise((resolve) => setTimeout(() => resolve(true), 0))');
    $bobPage->keys($handle, 'ArrowDown');
    $bobPage->script('() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))');
    $bobPage->keys($handle, 'Space');

    $alicePage->assertSeeIn(retroColumn($start).' [data-slot="card-group"] [data-slot="card-group-count"]', '2')
        ->assertNotPresent($moving);

    expect($first->fresh()->parent_card_id)->toBe($second->id);
});

it('[RT21-04] pauses the timer from the facilitator bar for a guest to see the paused time, adds two minutes to it and resumes it for the seconds that were left', function () {
    [$retro, $alice] = rt21Board(RetroPhase::Writing);
    $pill = '[data-slot="timer-pill"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $alicePage->assertDontSeeIn(Rt21Bar, 'Pause')
        ->click('[aria-label="Timer"]')
        ->click('5 min')
        ->assertPresent("{$pill}[data-state=\"normal\"]")
        ->assertAttribute(Rt21Bar.' button:has-text("Pause")', 'aria-pressed', 'false')
        ->click(Rt21Bar.' button:has-text("Pause")')
        ->assertPresent("{$pill}[data-state=\"paused\"]")
        ->assertAttribute(Rt21Bar.' button:has-text("Resume")', 'aria-pressed', 'true');

    $carolPage->assertPresent("{$pill}[data-state=\"paused\"]")
        ->assertAttribute('[role="timer"]', 'aria-label', 'Paused, 5 minutes left')
        ->assertNotPresent(Rt21Bar);

    $paused = $retro->fresh();

    expect($paused->timer_ends_at)->toBeNull()
        ->and($paused->timer_paused_seconds)->toBeGreaterThan(290)
        ->and($paused->timer_paused_seconds)->toBeLessThanOrEqual(300);

    $alicePage->click('button:has-text("+2 min")');

    $carolPage->assertAttribute('[role="timer"]', 'aria-label', 'Paused, 7 minutes left');

    expect($retro->fresh()->timer_paused_seconds)->toBe($paused->timer_paused_seconds + 120);

    $alicePage->click(Rt21Bar.' button:has-text("Resume")')
        ->assertPresent("{$pill}[data-state=\"normal\"]")
        ->assertPresent(Rt21Bar.' button:has-text("Pause")');

    $carolPage->assertPresent("{$pill}[data-state=\"normal\"]");

    expect($retro->fresh()->timer_paused_seconds)->toBeNull()
        ->and($retro->fresh()->timer_ends_at)->not->toBeNull();
});

it('[RT21-05] stops a guest at the cap of votes on one card, says why next to the button, and lets them vote on another card', function () {
    [$retro, , , $start, $stop, , $bobParticipant] = rt21Board(RetroPhase::Voting, ['max_votes_per_card' => 2]);
    $slow = rt21Card($retro, $start, $bobParticipant, 'Slow CI');
    $quiet = rt21Card($retro, $stop, $bobParticipant, 'Quiet standups');
    $addVote = fn (Card $card): string => "#card-{$card->id} [data-slot=\"retro-card-vote\"]";

    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->assertSeeIn('[data-slot="retro-voting-bar"]', 'max 2 per card')
        ->click($addVote($slow))
        ->assertSeeIn('[data-slot="vote-budget"]', '4 votes left of 5')
        ->click($addVote($slow))
        ->assertSeeIn('[data-slot="vote-budget"]', '3 votes left of 5')
        ->assertPresent("#card-{$slow->id} [role=\"group\"][aria-label=\"Max 2 votes per card\"]")
        ->assertAttribute($addVote($slow), 'disabled', '')
        ->click($addVote($quiet))
        ->assertSeeIn('[data-slot="vote-budget"]', '2 votes left of 5');

    $carol = Participant::query()->where('retro_id', $retro->id)->whereNotNull('guest_secret_hash')->sole();

    expect(Vote::query()->where('participant_id', $carol->id)->where('card_id', $slow->id)->count())->toBe(2)
        ->and(Vote::query()->where('participant_id', $carol->id)->where('card_id', $quiet->id)->count())->toBe(1);
});

it('[RT21-06] counts who has finished voting live, takes it back with "Change my votes" and when a finished guest votes again', function () {
    [$retro, $alice, , $start, , , $bobParticipant] = rt21Board(RetroPhase::Voting);
    $slow = rt21Card($retro, $start, $bobParticipant, 'Slow CI');
    $count = '[data-slot="retro-finished-count"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn($count, '0/2 have finished');
    }

    $carolPage->click('I have finished voting')
        ->assertSee('Change my votes')
        ->assertSeeIn($count, '1/2 have finished');

    $alicePage->assertSeeIn($count, '1/2 have finished');

    $carolPage->click('Change my votes')
        ->assertSee('I have finished voting');

    $alicePage->assertSeeIn($count, '0/2 have finished');

    $carolPage->click('I have finished voting');
    $alicePage->assertSeeIn($count, '1/2 have finished')
        ->click('I have finished voting')
        ->assertSeeIn($count, '2/2 have finished');

    $carolPage->assertSeeIn($count, '2/2 have finished')
        ->click("#card-{$slow->id} [data-slot=\"retro-card-vote\"]")
        ->assertSeeIn('[data-slot="retro-finished-taken-back"]', "You changed your votes: you're no longer marked as finished.")
        ->assertSee('I have finished voting')
        ->assertSeeIn($count, '1/2 have finished');

    $alicePage->assertSeeIn($count, '1/2 have finished');

    expect(Participant::query()->where('retro_id', $retro->id)->whereNotNull('voting_finished_at')->count())->toBe(1)
        ->and(Vote::query()->where('card_id', $slow->id)->count())->toBe(1);
});

it('[RT21-07] sets the time per topic from the stage timer, restarts it on the next topic for a guest and marks the topic left as discussed', function () {
    [$retro, $alice, , $cards] = rt21Discussion();
    $retro->update(['highlighted_card_id' => $cards['slow']->id]);
    $current = Rt21Topics.' > li[data-current]';
    $meta = fn (Card $card): string => Rt21Topics." > li[data-topic-id=\"{$card->id}\"] [data-slot=\"retro-topic-meta\"]";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $alicePage->assertSeeIn($current, 'Slow CI')
        ->click('[data-slot="retro-topic-timer"] [aria-label="Timer"]')
        ->click('[role="menuitem"]:has-text("5 min")')
        ->assertSeeIn('[data-slot="retro-topic-timer"]', 'of 5:00 · this topic');

    expect($retro->fresh()->topic_seconds)->toBe(300);

    foreach ([$alicePage, $carolPage] as $page) {
        $page->assertSeeIn($meta($cards['slow']), 'Now · 0')
            ->assertSeeIn('[data-slot="retro-discussion-estimate"]', 'min left')
            ->assertSee('5 min per topic · 0 actions so far');
    }

    $alicePage->click(Rt21Topics." > li[data-topic-id=\"{$cards['flaky']->id}\"] button")
        ->assertSeeIn($current, 'Flaky tests')
        ->click("#card-{$cards['flaky']->id} button[aria-pressed=\"false\"]:has-text(\"Discuss\")")
        ->assertSeeIn($meta($cards['flaky']), 'Now · 0')
        ->assertSeeIn($meta($cards['slow']), 'Discussed');

    $carolPage->assertSeeIn($meta($cards['slow']), 'Discussed')
        ->assertSeeIn($meta($cards['flaky']), 'Now · 0');

    expect($cards['slow']->fresh()->discussed_at)->not->toBeNull()
        ->and($retro->fresh()->highlighted_card_id)->toBe($cards['flaky']->id)
        ->and((int) now()->diffInSeconds($retro->fresh()->timer_ends_at))->toBeGreaterThan(280);
});

it('[RT21-08] lets the facilitator mark the topic in front of them as discussed and take the mark back, live for a member', function () {
    [$retro, $alice, $bob, $cards] = rt21Discussion();
    $retro->update(['highlighted_card_id' => $cards['slow']->id]);
    $toggle = '[data-slot="retro-topic-discussed"]';
    $flakyMeta = Rt21Topics." > li[data-topic-id=\"{$cards['flaky']->id}\"] [data-slot=\"retro-topic-meta\"]";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->assertNotPresent($toggle)
        ->assertNotPresent($flakyMeta);

    $alicePage->click(Rt21Topics." > li[data-topic-id=\"{$cards['flaky']->id}\"] button")
        ->assertSeeIn(Rt21Topics.' > li[data-current]', 'Flaky tests')
        ->assertAttribute($toggle, 'aria-pressed', 'false')
        ->assertSeeIn($toggle, 'Mark as discussed')
        ->click($toggle)
        ->assertAttribute($toggle, 'aria-pressed', 'true')
        ->assertSeeIn($toggle, 'Discussed');

    $bobPage->assertSeeIn($flakyMeta, 'Discussed');

    expect($cards['flaky']->fresh()->discussed_at)->not->toBeNull()
        ->and($retro->fresh()->highlighted_card_id)->toBe($cards['slow']->id);

    $alicePage->click($toggle)
        ->assertAttribute($toggle, 'aria-pressed', 'false');

    $bobPage->assertNotPresent($flakyMeta);

    expect($cards['flaky']->fresh()->discussed_at)->toBeNull();
});

it('[RT21-09] shares the notes of a topic typed by a guest: the facilitator reads who is taking notes in a read-only field, then the saved text', function () {
    [$retro, $alice, , $cards] = rt21Discussion();
    $retro->update(['highlighted_card_id' => $cards['slow']->id]);
    $notesActivity = '[data-slot="retro-topic-notes"] [data-slot="retro-activity"][data-kind="notes"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->assertSee('Discussion notes')
        ->type(Rt21Notes, 'Split the pipeline in two stages');

    $alicePage->assertSeeIn($notesActivity, 'Carol Guest is taking notes…')
        ->assertAttribute(Rt21Notes, 'readonly', '');

    $carolPage->assertSeeIn('[data-slot="retro-topic-notes-state"]', 'Saved');

    $alicePage->assertValue(Rt21Notes, 'Split the pipeline in two stages');

    $note = TopicNote::query()->where('card_id', $cards['slow']->id)->sole();

    expect($note->body)->toBe('Split the pipeline in two stages')
        ->and($note->version)->toBe(1);

    $carolPage->click('[data-slot="retro-topic-notes"] h2');

    $alicePage->assertNotPresent($notesActivity)
        ->assertAttributeMissing(Rt21Notes, 'readonly');
});

it('[RT21-10] keeps the text of a note saved from an older version below the note of the server, with "Your text was not saved"', function () {
    [$retro, $alice, , $cards, $aliceParticipant] = rt21Discussion();
    $retro->update(['highlighted_card_id' => $cards['slow']->id]);

    $alicePage = rt21AwaitSnapshot($this->awaitRealtime(rt21RecordResources($this->signIn($alice, "/retros/{$retro->id}"))));

    TopicNote::factory()->create([
        'retro_id' => $retro->id,
        'card_id' => $cards['slow']->id,
        'body' => 'Written by someone else',
        'version' => 1,
        'updated_by_participant_id' => $aliceParticipant->id,
    ]);

    $alicePage->assertValue(Rt21Notes, '')
        ->type(Rt21Notes, 'My own summary')
        ->assertSeeIn('[data-slot="retro-topic-notes-conflict"]', 'Your text was not saved')
        ->assertSeeIn('[data-slot="retro-topic-notes-conflict"]', 'My own summary')
        ->assertValue(Rt21Notes, 'Written by someone else');

    expect(TopicNote::query()->where('card_id', $cards['slow']->id)->sole()->body)->toBe('Written by someone else');
});

it('[RT21-11] links an action created in Discussing to the topic in front of the viewer, counts it on the topic, and shows it in Actions with its topic', function () {
    [$retro, $alice, $bob, $cards, $aliceParticipant] = rt21Discussion();
    ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'content' => 'Rotate the on-call',
        'card_id' => $cards['quiet']->id,
        'created_by_participant_id' => $aliceParticipant->id,
    ]);
    $panel = '[data-test="retro-action-items-panel"]';
    $input = "{$panel} [aria-label=\"Add an action item…\"]";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->assertSeeIn($panel, 'Topic actions')
        ->assertSeeIn($panel, 'Linked to #1 · Slow CI')
        ->assertDontSeeIn("{$panel} [id^=\"action-item-\"]", 'Rotate the on-call')
        ->assertSeeIn('[data-slot="retro-other-action-items"]', 'Other action items (1)')
        ->fill($input, 'Cache the dependencies')
        ->keys($input, 'Enter')
        ->assertSeeIn($panel, 'Cache the dependencies');

    $item = ActionItem::query()->where('content', 'Cache the dependencies')->sole();

    expect($item->card_id)->toBe($cards['slow']->id);

    $alicePage->assertSeeIn(Rt21Topics." > li[data-topic-id=\"{$cards['slow']->id}\"] [data-slot=\"retro-topic-meta\"]", '1 action')
        ->assertSeeIn($panel, 'Cache the dependencies')
        ->click("#card-{$cards['slow']->id} button[aria-pressed=\"false\"]:has-text(\"Discuss\")")
        ->assertPresent("#card-{$cards['slow']->id} button[aria-pressed=\"true\"]:has-text(\"Discuss\")");

    $bobPage->assertPresent(Rt21Topics." > li[data-topic-id=\"{$cards['slow']->id}\"] [data-slot=\"retro-topic-meta\"][data-state=\"now\"]");

    $alicePage->click(Rt21Bar.' button:has-text("Actions")')
        ->assertSeeIn('[aria-current="step"]', 'Actions');

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertSeeIn(Rt21Topics." > li[data-topic-id=\"{$cards['slow']->id}\"] [data-slot=\"retro-topic-actions-count\"]", '1 linked action')
            ->assertSeeIn("#action-item-{$item->id} [data-slot=\"retro-item-topic\"]", 'Slow CI');
    }

    $alicePage->assertSee('Quick add · linked to “Slow CI”');
});

it('[RT21-12] nudges the participants who have not voted the ROTI, never one who has, then reveals the result to everyone and closes the vote', function () {
    [$retro, $alice, $bob, , , , $bobParticipant] = rt21Board(RetroPhase::Roti);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $bobParticipant->id, 'score' => 4]);
    $control = '[role="group"][aria-label="Was this time together worth it?"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    foreach ([$bobPage, $carolPage] as $page) {
        $page->assertSee('Results appear for everyone when the facilitator reveals them or ends the session.');
    }

    $alicePage->assertSeeIn(Rt21Bar, 'Nudge the last one')
        ->click(Rt21Bar.' button:has-text("Nudge the last one")')
        ->assertDisabled(Rt21Bar.' button:has-text("Nudge the last one")');

    $carolPage->assertSee('Your ROTI vote is awaited');
    $bobPage->assertDontSee('Your ROTI vote is awaited');

    $carolPage->click("{$control} button[data-rating=\"5\"]");

    $alicePage->assertSeeIn('[data-slot="retro-roti-count"]', '2/3')
        ->click(Rt21Bar.' button:has-text("Reveal ROTI")')
        ->assertDontSeeIn(Rt21Bar, 'Reveal ROTI');

    foreach ([$alicePage, $bobPage, $carolPage] as $page) {
        $page->assertSeeIn('[data-slot="roti-mean"]', '4.5')
            ->assertSee('Votes are closed.');
    }

    expect($retro->fresh()->roti_revealed_at)->not->toBeNull()
        ->and(RotiVote::query()->where('retro_id', $retro->id)->count())->toBe(2);
});

it('[RT21-13] exports the action items of the retro to Jira one by one from the Actions phase, shows the key live to a member, reports one exported meanwhile, and offers no export to a guest', function () {
    disableIntegrations();
    enableIntegrations(IntegrationProvider::Jira);
    Http::fake([
        jiraApiUrl('rest/api/3/project/search*') => Http::response(['values' => [['id' => '10000', 'key' => 'ATLAS', 'name' => 'Atlas']]]),
        jiraApiUrl('rest/api/3/issuetype/project*') => Http::response([['id' => '11', 'name' => 'Task', 'subtask' => false]]),
        jiraApiUrl('rest/api/3/user/search*') => Http::response([]),
        jiraApiUrl('rest/api/3/issue/createmeta/*') => Http::response(jiraCreateMeta()),
        jiraApiUrl('rest/api/3/issue') => Http::response(['id' => '10142', 'key' => 'ATLAS-142', 'self' => 'https://api.atlassian.com/ex/jira/cloud-1/rest/api/3/issue/10142'], 201),
    ]);
    [$retro, $alice, $bob, $cards, $aliceParticipant] = rt21Discussion(RetroPhase::Actions);
    TeamIntegration::factory()->jira()->create(['team_id' => $retro->team_id]);
    $items = collect(['Cache the dependencies', 'Rotate the on-call'])->map(fn (string $content): ActionItem => ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'content' => $content,
        'card_id' => $cards['slow']->id,
        'created_by_participant_id' => $aliceParticipant->id,
    ]));
    $dialog = '[data-slot="retro-bulk-export"]';
    $row = fn (ActionItem $item): string => "{$dialog} [data-item-id=\"{$item->id}\"]";

    $alicePage = rt21AwaitSnapshot($this->awaitRealtime(rt21RecordResources($this->signIn($alice, "/retros/{$retro->id}"))));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->assertSeeIn('[data-test="retro-action-items-panel"]', 'Rotate the on-call')
        ->assertNotPresent('[data-slot="retro-bulk-export-button"]');

    $alicePage->click('[data-slot="retro-bulk-export-button"]:has-text("Export to Jira")')
        ->assertCount("{$dialog} [data-slot=\"bulk-export-items\"] [data-item-id]", 2);

    ActionItemExternalLink::factory()->create([
        'action_item_id' => $items[1]->id,
        'source' => IntegrationProvider::Jira,
        'external_key' => 'ATLAS-7',
    ]);

    $alicePage->click("{$dialog} button:has-text(\"Export 2 items\")")
        ->assertSee('1 exported, 1 already linked, 0 failed.')
        ->assertPresent("{$row($items[0])}[data-state=\"exported\"]")
        ->assertSeeIn($row($items[0]), 'ATLAS-142')
        ->assertSeeIn($row($items[1]), 'Already exported');

    $bobPage->assertPresent("#action-item-{$items[0]->id} a:has-text(\"ATLAS-142\")");

    expect($items[0]->externalLinks()->count())->toBe(1)
        ->and($items[1]->externalLinks()->count())->toBe(1);
});

it('[RT21-14] keeps the voting bar with its cap and the finished count inside a phone screen of 390', function () {
    [$retro, , , $start, , , $bobParticipant] = rt21Board(RetroPhase::Voting, ['max_votes_per_card' => 2]);
    rt21Card($retro, $start, $bobParticipant, 'Slow CI');

    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $carolPage->resize(390, 844)
        ->assertSeeIn('[data-slot="retro-phone-columns-head"] [data-slot="vote-budget"]', '5 votes left of 5')
        ->assertSeeIn('[data-slot="retro-phone-columns-head"]', 'max 2 per card')
        ->assertSee('I have finished voting')
        ->assertSeeIn('[data-slot="retro-finished-count"]', '0/1 have finished')
        ->assertScript(Rt21PageScrollsSideways, false)
        ->click('I have finished voting')
        ->assertSeeIn('[data-slot="retro-finished-count"]', '1/1 have finished')
        ->assertScript(Rt21PageScrollsSideways, false);
});

it('[RT21-15] draws the discussion with its topic timer, notes and topic actions in the dark theme', function () {
    [$retro, $alice, , $cards] = rt21Discussion(attributes: ['topic_seconds' => 300]);
    $retro->update(['highlighted_card_id' => $cards['slow']->id, 'timer_ends_at' => now()->addMinutes(4)]);

    $page = visit('/login', ['colorScheme' => 'dark']);
    $page->fill('#email', $alice->email)
        ->fill('#password', 'password')
        ->click('@login-button')
        ->assertPathIsNot('/login');
    $page->navigate("/retros/{$retro->id}");

    $this->awaitRealtime($page)
        ->assertScript("document.documentElement.classList.contains('dark')", true)
        ->assertSeeIn('[data-slot="retro-topic-timer"]', 'of 5:00 · this topic')
        ->assertSee('Discussion notes')
        ->assertSee('Topic actions')
        ->assertScript("getComputedStyle(document.querySelector('[data-slot=\"retro-topic-notes\"]')).backgroundColor !== getComputedStyle(document.body).backgroundColor", true)
        ->assertScript('(() => { const [r, g, b] = getComputedStyle(document.body).backgroundColor.match(/\\d+/g).map(Number); return r + g + b < 200; })()', true)
        ->assertScript(Rt21PageScrollsSideways, false);
});

it('[RT21-16] speaks the language of the viewer on the discussion', function (string $locale, string $notes, string $topicActions, string $markDiscussed, string $perTopic) {
    [$retro, $alice, , $cards] = rt21Discussion(attributes: ['topic_seconds' => 300]);
    $retro->update(['highlighted_card_id' => $cards['slow']->id, 'timer_ends_at' => now()->addMinutes(4)]);
    $alice->update(['locale' => $locale]);

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $page->assertScript('document.documentElement.lang', $locale)
        ->assertSee($notes)
        ->assertSee($topicActions)
        ->assertSeeIn('[data-slot="retro-topic-discussed"]', $markDiscussed)
        ->assertSee($perTopic);
})->with([
    'English' => ['en', 'Discussion notes', 'Topic actions', 'Mark as discussed', '5 min per topic'],
    'French' => ['fr', 'Notes de discussion', 'Actions du sujet', 'Marquer comme discuté', '5 min par sujet'],
    'Spanish' => ['es', 'Notas de la discusión', 'Acciones del tema', 'Marcar como tratado', '5 min por tema'],
    'German' => ['de', 'Diskussionsnotizen', 'Aktionen des Themas', 'Als besprochen markieren', '5 Min. pro Thema'],
]);
