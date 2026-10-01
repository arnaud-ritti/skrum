<?php

use App\Enums\RetroPhase;
use App\Models\Card;
use App\Models\CardComment;
use App\Models\CardReaction;
use App\Models\Column;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;
use App\Models\Vote;

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     retro: Retro,
 *     columns: array<int, Column>,
 *     alice: User,
 *     bob: User,
 *     carol: User,
 *     aliceParticipant: Participant,
 *     bobParticipant: Participant,
 *     carolParticipant: Participant
 * }
 */
function plan07Board(RetroPhase $phase = RetroPhase::Grouping, array $attributes = []): array
{
    $retro = Retro::factory()
        ->inPhase($phase)
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
    [$carol, $carolParticipant] = retroMember($retro);

    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);
    $bob->update(['name' => 'Bob Stone', 'locale' => 'en']);
    $carol->update(['name' => 'Carol Reyes', 'locale' => 'en']);

    return [
        'retro' => $retro->fresh(),
        'columns' => $columns,
        'alice' => $alice,
        'bob' => $bob,
        'carol' => $carol,
        'aliceParticipant' => $aliceParticipant,
        'bobParticipant' => $bobParticipant,
        'carolParticipant' => $carolParticipant,
    ];
}

function plan07Card(Retro $retro, Column $column, Participant $author, ?string $content, int $position = 0, ?string $gifId = null): Card
{
    return Card::factory()->create([
        'retro_id' => $retro->id,
        'column_id' => $column->id,
        'participant_id' => $author->id,
        'content' => $content,
        'gif_id' => $gifId,
        'position' => $position,
    ]);
}

function plan07Reaction(Card $card, Participant $participant, string $emoji): CardReaction
{
    return CardReaction::factory()->create([
        'retro_id' => $card->retro_id,
        'card_id' => $card->id,
        'participant_id' => $participant->id,
        'emoji' => $emoji,
    ]);
}

function plan07Comment(Card $card, Participant $participant, string $content): CardComment
{
    return CardComment::factory()->create([
        'retro_id' => $card->retro_id,
        'card_id' => $card->id,
        'participant_id' => $participant->id,
        'content' => $content,
    ]);
}

function plan07Chip(Card $card, string $emoji, int $count): string
{
    $noun = $count === 1 ? 'reaction' : 'reactions';

    return "#card-{$card->id} button[aria-label=\"{$emoji}, {$count} {$noun}\"]";
}

function plan07OpenSettings(mixed $page): mixed
{
    return $page->click('[aria-label="Facilitator menu"]')
        ->assertSee('Settings…')
        ->click('Settings…')
        ->assertSee('Retrospective settings');
}

function plan07SaveSettings(mixed $page): mixed
{
    return $page->click('[role="dialog"] button[type="submit"]')
        ->assertNotPresent('[role="dialog"]')
        ->assertNotPresent('[role="menu"]');
}

function plan07ShowsVoteTotal(Card $card): string
{
    return "[...document.querySelectorAll('#card-{$card->id} [aria-label]')].some((element) => /^\\d+ votes?$/.test(element.getAttribute('aria-label')))";
}

it('[P07-03a] toggles card reactions with any emoji, counts them live and names the reactors in the tooltip', function () {
    [
        'retro' => $retro,
        'columns' => $columns,
        'alice' => $alice,
        'bob' => $bob,
        'aliceParticipant' => $aliceParticipant,
        'bobParticipant' => $bobParticipant,
        'carolParticipant' => $carolParticipant,
    ] = plan07Board();
    $card = plan07Card($retro, $columns[0], $aliceParticipant, 'Slow CI');
    plan07Reaction($card, $aliceParticipant, '👍');
    plan07Reaction($card, $carolParticipant, '🦄');
    $tooltip = '[data-slot="tooltip-content"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $alicePage->assertAriaAttribute(plan07Chip($card, '👍', 1), 'pressed', 'true');

    $bobPage->assertAriaAttribute(plan07Chip($card, '👍', 1), 'pressed', 'false')
        ->assertAriaAttribute(plan07Chip($card, '🦄', 1), 'pressed', 'false')
        ->click(plan07Chip($card, '👍', 1))
        ->assertAriaAttribute(plan07Chip($card, '👍', 2), 'pressed', 'true');

    $alicePage->assertAriaAttribute(plan07Chip($card, '👍', 2), 'pressed', 'true');

    $bobPage->hover('header > h1')
        ->hover(plan07Chip($card, '👍', 2))
        ->assertSeeIn($tooltip, 'Alice Martin')
        ->assertSeeIn($tooltip, 'Bob Stone');

    $bobPage->hover('header > h1')
        ->click("#card-{$card->id} [aria-label=\"Add a reaction\"]")
        ->assertVisible('[role="menuitem"]:has-text("🎉")')
        ->click('[role="menuitem"]:has-text("🎉")')
        ->assertNotPresent('[role="menu"]')
        ->assertAriaAttribute(plan07Chip($card, '🎉', 1), 'pressed', 'true');

    $alicePage->assertAriaAttribute(plan07Chip($card, '🎉', 1), 'pressed', 'false');

    $bobPage->click(plan07Chip($card, '🦄', 1))
        ->assertAriaAttribute(plan07Chip($card, '🦄', 2), 'pressed', 'true');

    $alicePage->assertPresent(plan07Chip($card, '🦄', 2));

    $bobPage->click(plan07Chip($card, '🦄', 2))
        ->assertAriaAttribute(plan07Chip($card, '🦄', 1), 'pressed', 'false')
        ->click(plan07Chip($card, '🎉', 1))
        ->assertNotPresent("#card-{$card->id} button[aria-label^=\"🎉\"]");

    $alicePage->assertPresent(plan07Chip($card, '🦄', 1))
        ->assertNotPresent("#card-{$card->id} button[aria-label^=\"🎉\"]")
        ->assertPresent(plan07Chip($card, '👍', 2));

    expect(CardReaction::query()->where('card_id', $card->id)->count())->toBe(3)
        ->and(CardReaction::query()->where('participant_id', $bobParticipant->id)->pluck('emoji')->all())->toBe(['👍']);
});

it('[P07-07a] turns reactions and live cursors off and on for everyone from the settings', function () {
    config(['services.gifs' => ['provider' => null, 'key' => null, 'rating' => 'pg']]);

    [
        'retro' => $retro,
        'columns' => $columns,
        'alice' => $alice,
        'bob' => $bob,
        'aliceParticipant' => $aliceParticipant,
        'carolParticipant' => $carolParticipant,
    ] = plan07Board();
    $card = plan07Card($retro, $columns[0], $aliceParticipant, 'Slow CI');
    plan07Reaction($card, $carolParticipant, '👍');

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertPresent('[role="group"][aria-label="2 online"]')
            ->assertPresent('.lc-overlay')
            ->assertPresent('[aria-label="Hide my cursor"]')
            ->assertPresent('[role="toolbar"][aria-label="Reactions"]')
            ->assertPresent(plan07Chip($card, '👍', 1));
    }

    $bobPage->assertNotPresent('[aria-label="Facilitator menu"]');

    plan07OpenSettings($alicePage)
        ->assertSee('Show reactions')
        ->assertSee('Show live cursors')
        ->assertSee('Hide vote counts')
        ->assertSee('Close for editing')
        ->assertSee('Presentation mode')
        ->assertNotPresent('#retro-gifs')
        ->assertAriaAttribute('#retro-reactions', 'checked', 'true')
        ->assertAriaAttribute('#retro-cursors', 'checked', 'true')
        ->click('#retro-reactions')
        ->click('#retro-cursors')
        ->assertAriaAttribute('#retro-reactions', 'checked', 'false')
        ->assertAriaAttribute('#retro-cursors', 'checked', 'false');
    plan07SaveSettings($alicePage);

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertNotPresent('.lc-overlay')
            ->assertNotPresent('[aria-label="Hide my cursor"]')
            ->assertNotPresent('[role="toolbar"][aria-label="Reactions"]')
            ->assertNotPresent(plan07Chip($card, '👍', 1))
            ->assertNotPresent("#card-{$card->id} [aria-label=\"Add a reaction\"]");
    }

    expect($retro->fresh()->reactions_enabled)->toBeFalse()
        ->and($retro->fresh()->cursors_enabled)->toBeFalse()
        ->and(CardReaction::query()->where('card_id', $card->id)->count())->toBe(1);

    plan07OpenSettings($alicePage)
        ->assertAriaAttribute('#retro-reactions', 'checked', 'false')
        ->click('#retro-reactions')
        ->click('#retro-cursors');
    plan07SaveSettings($alicePage);

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertPresent('.lc-overlay')
            ->assertPresent('[aria-label="Hide my cursor"]')
            ->assertPresent('[role="toolbar"][aria-label="Reactions"]')
            ->assertPresent(plan07Chip($card, '👍', 1));
    }
});

it('[P07-04a] writes, answers, edits and deletes comments in a thread that every participant sees live', function () {
    [
        'retro' => $retro,
        'columns' => $columns,
        'alice' => $alice,
        'bob' => $bob,
        'carol' => $carol,
        'bobParticipant' => $bobParticipant,
    ] = plan07Board();
    $card = plan07Card($retro, $columns[0], $bobParticipant, 'Slow CI');
    $thread = "#card-{$card->id}";
    $toggle = "{$thread} button[aria-label^=\"Comments (\"]";
    $composer = "{$thread} textarea[aria-label=\"Write a comment…\"]";
    $replyBox = "{$thread} textarea[aria-label=\"Write a reply…\"]";
    $editBox = "{$thread} textarea[aria-label=\"Edit comment\"]";
    $edit = "{$thread} button[aria-label=\"Edit comment\"]";
    $delete = "{$thread} button[aria-label=\"Delete comment\"]";
    $replies = "{$thread} button:has-text(\"1 reply\")";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->signIn($carol, "/retros/{$retro->id}"));

    $carolPage->click("{$thread} button[aria-label=\"Comments (0)\"]")
        ->assertVisible($composer)
        ->fill($composer, 'Which pipeline is slow?')
        ->keys($composer, 'Enter')
        ->assertSeeIn($thread, 'Which pipeline is slow?')
        ->assertPresent("{$thread} button[aria-label=\"Comments (1)\"]");

    $bobPage->click("{$thread} button[aria-label=\"Comments (1)\"]")
        ->assertSeeIn($thread, 'Which pipeline is slow?')
        ->assertSeeIn($thread, 'Carol Reyes')
        ->assertNotPresent($edit)
        ->assertNotPresent($delete)
        ->click("{$thread} button:has-text(\"Reply\")")
        ->assertVisible($replyBox)
        ->fill($replyBox, 'The deploy one.')
        ->keys($replyBox, 'Enter')
        ->assertSeeIn($thread, 'The deploy one.')
        ->assertPresent("{$thread} button[aria-label=\"Comments (2)\"]");

    $carolPage->assertPresent("{$thread} button[aria-label=\"Comments (2)\"]")
        ->assertDontSeeIn($thread, 'The deploy one.')
        ->click($replies)
        ->assertSeeIn($thread, 'The deploy one.')
        ->assertPresent("{$thread} p:has-text(\"Bob Stone\")")
        ->assertCount($edit, 1)
        ->click($edit)
        ->assertValue($editBox, 'Which pipeline is slow?')
        ->fill($editBox, 'Which pipeline is the slow one?')
        ->keys($editBox, 'Enter')
        ->assertSeeIn($thread, 'Which pipeline is the slow one?');

    $bobPage->assertSeeIn($thread, 'Which pipeline is the slow one?')
        ->assertCount($edit, 1)
        ->assertCount($delete, 1);

    $parent = CardComment::query()->whereNull('parent_comment_id')->sole();

    expect($parent->content)->toBe('Which pipeline is the slow one?')
        ->and($parent->replies()->count())->toBe(1);

    $carolPage->click($delete)
        ->assertSeeIn($thread, 'Comment deleted')
        ->assertSeeIn($thread, 'The deploy one.')
        ->assertPresent("{$thread} button[aria-label=\"Comments (1)\"]");

    $bobPage->assertSeeIn($thread, 'Comment deleted')
        ->assertSeeIn($thread, 'The deploy one.')
        ->assertDontSeeIn($thread, 'Which pipeline is the slow one?');

    expect($parent->fresh()->deleted_at)->not->toBeNull();

    $alicePage->click($toggle)
        ->assertSeeIn($thread, 'Comment deleted')
        ->click($replies)
        ->assertSeeIn($thread, 'The deploy one.')
        ->assertNotPresent($edit)
        ->assertCount($delete, 1)
        ->click($delete);

    foreach ([$alicePage, $bobPage, $carolPage] as $page) {
        $page->assertPresent("{$thread} button[aria-label=\"Comments (0)\"]")
            ->assertDontSeeIn($thread, 'Comment deleted')
            ->assertDontSeeIn($thread, 'The deploy one.');
    }

    expect(CardComment::query()->count())->toBe(0);
});

it('[P07-04b] notifies only the card author and the thread, and keeps the unread dot across a reload until the thread is read', function () {
    [
        'retro' => $retro,
        'columns' => $columns,
        'alice' => $alice,
        'bob' => $bob,
        'carol' => $carol,
        'bobParticipant' => $bobParticipant,
    ] = plan07Board();
    $card = plan07Card($retro, $columns[0], $bobParticipant, 'Slow CI');
    $thread = "#card-{$card->id}";
    $composer = "{$thread} textarea[aria-label=\"Write a comment…\"]";
    $replyBox = "{$thread} textarea[aria-label=\"Write a reply…\"]";
    $dot = "{$thread} [aria-label=\"Unread comments\"]";
    $isMarkedRead = "Object.keys(JSON.parse(localStorage.getItem('skrum.readComments.{$retro->id}') ?? '{}')).includes('{$card->id}')";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->signIn($carol, "/retros/{$retro->id}"));

    $bobPage->assertNotPresent($dot);

    $carolPage->click("{$thread} button[aria-label=\"Comments (0)\"]")
        ->assertVisible($composer)
        ->fill($composer, 'Which pipeline is slow?')
        ->keys($composer, 'Enter')
        ->assertSeeIn($thread, 'Which pipeline is slow?');

    $bobPage->assertSee('New comment on your card')
        ->assertSee('Carol Reyes: Which pipeline is slow?')
        ->assertPresent("{$thread} button[aria-label=\"Comments (1)\"]")
        ->assertPresent($dot);

    $alicePage->assertPresent("{$thread} button[aria-label=\"Comments (1)\"]")
        ->assertDontSee('New comment on your card')
        ->assertNotPresent($dot);

    $carolPage->assertDontSee('New comment on your card')
        ->assertNotPresent($dot);

    $this->awaitRealtime($bobPage->navigate("/retros/{$retro->id}"));

    $bobPage->assertPresent($dot)
        ->assertDontSee('New comment on your card')
        ->assertScript($isMarkedRead, false)
        ->click("{$thread} button[aria-label=\"Comments (1)\"]")
        ->assertSeeIn($thread, 'Which pipeline is slow?')
        ->assertNotPresent($dot)
        ->assertScript($isMarkedRead, true);

    $this->awaitRealtime($bobPage->navigate("/retros/{$retro->id}"));

    $bobPage->assertPresent("{$thread} button[aria-label=\"Comments (1)\"]")
        ->assertNotPresent($dot)
        ->click("{$thread} button[aria-label=\"Comments (1)\"]")
        ->click("{$thread} button:has-text(\"Reply\")")
        ->assertVisible($replyBox)
        ->fill($replyBox, 'The deploy one.')
        ->keys($replyBox, 'Enter')
        ->assertSeeIn($thread, 'The deploy one.');

    $carolPage->assertSee('New reply in a thread you follow')
        ->assertSee('Bob Stone: The deploy one.')
        ->assertPresent("{$thread} button[aria-label=\"Comments (2)\"]");

    $alicePage->assertPresent("{$thread} button[aria-label=\"Comments (2)\"]")
        ->assertDontSee('New reply in a thread you follow')
        ->assertNotPresent($dot);
});

it('[P07-06a] shows no name on reaction chips, comments or notification toasts on an anonymous retro', function () {
    [
        'retro' => $retro,
        'columns' => $columns,
        'bob' => $bob,
        'carol' => $carol,
        'aliceParticipant' => $aliceParticipant,
        'bobParticipant' => $bobParticipant,
    ] = plan07Board(RetroPhase::Grouping, ['is_anonymous' => true]);
    $card = plan07Card($retro, $columns[0], $bobParticipant, 'Too many meetings');
    plan07Reaction($card, $aliceParticipant, '👍');
    $thread = "#card-{$card->id}";
    $composer = "{$thread} textarea[aria-label=\"Write a comment…\"]";
    $tooltip = '[data-slot="tooltip-content"]';

    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->signIn($carol, "/retros/{$retro->id}"));

    $carolPage->assertSeeIn($thread, 'Too many meetings')
        ->assertDontSeeIn($thread, 'Bob Stone')
        ->hover(plan07Chip($card, '👍', 1))
        ->assertNotPresent($tooltip)
        ->click(plan07Chip($card, '👍', 1))
        ->assertAriaAttribute(plan07Chip($card, '👍', 2), 'pressed', 'true')
        ->hover('header > h1')
        ->hover(plan07Chip($card, '👍', 2))
        ->assertNotPresent($tooltip);

    $bobPage->assertPresent(plan07Chip($card, '👍', 2))
        ->hover(plan07Chip($card, '👍', 2))
        ->assertNotPresent($tooltip);

    $carolPage->click("{$thread} button[aria-label=\"Comments (0)\"]")
        ->assertVisible($composer)
        ->fill($composer, 'Is this still true?')
        ->keys($composer, 'Enter')
        ->assertSeeIn($thread, 'Is this still true?')
        ->assertSeeIn($thread, 'Carol Reyes');

    $bobPage->assertSee('New comment on your card')
        ->assertSee('Is this still true?')
        ->assertDontSee('Carol Reyes: Is this still true?')
        ->click("{$thread} button[aria-label=\"Comments (1)\"]")
        ->assertSeeIn($thread, 'Is this still true?')
        ->assertSeeIn($thread, 'Anonymous')
        ->assertDontSeeIn($thread, 'Carol Reyes');
});

it('[P07-10] shows vote totals live during Voting, hides them with "Hide vote counts" and shows them again in Discussing', function () {
    [
        'retro' => $retro,
        'columns' => $columns,
        'alice' => $alice,
        'bob' => $bob,
        'aliceParticipant' => $aliceParticipant,
        'carolParticipant' => $carolParticipant,
    ] = plan07Board(RetroPhase::Voting);
    $card = plan07Card($retro, $columns[0], $aliceParticipant, 'Slow CI');
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $carolParticipant->id]);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertPresent("#card-{$card->id} [aria-label=\"1 vote\"]");
    }

    $bobPage->click("#card-{$card->id} [aria-label=\"Add a vote\"]")
        ->assertPresent("#card-{$card->id} [aria-label=\"2 votes\"]")
        ->assertDontSeeIn("#card-{$card->id}", 'Carol Reyes');

    $alicePage->assertPresent("#card-{$card->id} [aria-label=\"2 votes\"]")
        ->assertDontSeeIn("#card-{$card->id}", 'Bob Stone');

    plan07OpenSettings($alicePage)
        ->click('#retro-hide-vote-counts')
        ->assertAriaAttribute('#retro-hide-vote-counts', 'checked', 'true');
    plan07SaveSettings($alicePage);

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertScript(plan07ShowsVoteTotal($card), false);
    }

    $bobPage->assertSee('Votes left: 4')
        ->click("#card-{$card->id} [aria-label=\"Remove a vote\"]")
        ->assertSee('Votes left: 5')
        ->assertScript(plan07ShowsVoteTotal($card), false);

    $alicePage->assertSee('1 of 15 vote cast')
        ->assertScript(plan07ShowsVoteTotal($card), false)
        ->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'Discussing');

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertSeeIn('[aria-current="step"]', 'Discussing')
            ->assertPresent("#card-{$card->id} [aria-label=\"1 vote\"]");
    }

    expect($retro->fresh()->hide_vote_counts)->toBeTrue()
        ->and($retro->votes()->count())->toBe(1);
});

it('[P07-08a] closes the board for editing in every phase while the facilitator still moves the phase and the timer', function () {
    [
        'retro' => $retro,
        'columns' => $columns,
        'alice' => $alice,
        'bob' => $bob,
        'aliceParticipant' => $aliceParticipant,
        'bobParticipant' => $bobParticipant,
        'carolParticipant' => $carolParticipant,
    ] = plan07Board(RetroPhase::Writing);
    $mine = plan07Card($retro, $columns[0], $bobParticipant, 'Pairing works well', 0);
    $slow = plan07Card($retro, $columns[0], $aliceParticipant, 'Slow CI', 1);
    plan07Reaction($slow, $carolParticipant, '👍');
    plan07Comment($slow, $carolParticipant, 'Which pipeline is slow?');
    $current = '[aria-current="step"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->assertCount('[aria-label="Add a card…"]', 3)
        ->assertPresent("#card-{$mine->id} [aria-label=\"Edit card\"]")
        ->assertAttribute("@retro-card-handle-{$mine->id}", 'aria-disabled', 'false')
        ->assertDontSee('Board closed for editing');

    plan07OpenSettings($alicePage)
        ->click('#retro-locked')
        ->assertAriaAttribute('#retro-locked', 'checked', 'true');
    plan07SaveSettings($alicePage);

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertSee('Board closed for editing');
    }

    $bobPage->assertNotPresent('[aria-label="Add a card…"]')
        ->assertNotPresent("#card-{$mine->id} [aria-label=\"Edit card\"]")
        ->assertNotPresent("#card-{$mine->id} [aria-label=\"Delete card\"]")
        ->assertAttribute("@retro-card-handle-{$mine->id}", 'aria-disabled', 'true');

    $alicePage->press('Next')->assertSeeIn($current, 'Grouping');

    $bobPage->assertSeeIn($current, 'Grouping')
        ->assertSee('Board closed for editing')
        ->assertAttribute("@retro-card-handle-{$slow->id}", 'aria-disabled', 'true')
        ->assertDisabled(plan07Chip($slow, '👍', 1))
        ->assertNotPresent("#card-{$slow->id} [aria-label=\"Add a reaction\"]")
        ->assertAriaAttribute("#card-{$slow->id} button[aria-label=\"Comments (1)\"]", 'expanded', 'false')
        ->script("() => document.querySelector('#card-{$slow->id} button[aria-label=\"Comments (1)\"]').click()");

    $bobPage->assertAriaAttribute("#card-{$slow->id} button[aria-label=\"Comments (1)\"]", 'expanded', 'true')
        ->assertSeeIn("#card-{$slow->id}", 'Which pipeline is slow?')
        ->assertNotPresent("#card-{$slow->id} textarea")
        ->assertNotPresent("#card-{$slow->id} button[aria-label=\"Delete comment\"]");

    $alicePage->press('Next')->assertSeeIn($current, 'Voting');

    $bobPage->assertSeeIn($current, 'Voting')
        ->assertDisabled("#card-{$slow->id} [aria-label=\"Add a vote\"]")
        ->assertDisabled("#card-{$mine->id} [aria-label=\"Add a vote\"]");

    $alicePage->press('Next')->assertSeeIn($current, 'Discussing');

    $bobPage->assertSeeIn($current, 'Discussing')
        ->assertDisabled('[aria-label="Add an action item…"]')
        ->assertNotPresent('[role="timer"]');

    $alicePage->click('[aria-label="Timer"]')
        ->assertSee('1 min')
        ->click('1 min')
        ->assertNotPresent('[role="menu"]');

    $bobPage->assertPresent('[role="timer"]');

    expect($retro->fresh()->is_locked)->toBeTrue()
        ->and($retro->fresh()->phase)->toBe(RetroPhase::Discussing)
        ->and($retro->fresh()->timer_ends_at)->not->toBeNull()
        ->and($retro->cards()->count())->toBe(2)
        ->and($retro->votes()->count())->toBe(0)
        ->and(CardReaction::query()->where('card_id', $slow->id)->count())->toBe(1)
        ->and(CardComment::query()->where('card_id', $slow->id)->count())->toBe(1);

    plan07OpenSettings($alicePage)
        ->assertAriaAttribute('#retro-locked', 'checked', 'true')
        ->click('#retro-locked');
    plan07SaveSettings($alicePage);

    $bobPage->assertDontSee('Board closed for editing')
        ->assertEnabled('[aria-label="Add an action item…"]')
        ->assertEnabled(plan07Chip($slow, '👍', 1));

    expect($retro->fresh()->is_locked)->toBeFalse();
});

it('[P07-08b] answers an edit from a page that missed the lock with the "closed for editing" toast and resyncs the board', function () {
    [
        'retro' => $retro,
        'columns' => $columns,
        'bob' => $bob,
        'aliceParticipant' => $aliceParticipant,
        'carolParticipant' => $carolParticipant,
    ] = plan07Board();
    $card = plan07Card($retro, $columns[0], $aliceParticipant, 'Slow CI');
    plan07Reaction($card, $carolParticipant, '👍');

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $page->assertEnabled(plan07Chip($card, '👍', 1))
        ->assertDontSee('Board closed for editing');

    $retro->forceFill(['is_locked' => true])->save();

    $page->click(plan07Chip($card, '👍', 1))
        ->assertSee('The board is closed for editing.')
        ->assertSee('Board closed for editing')
        ->assertDisabled(plan07Chip($card, '👍', 1))
        ->assertNotPresent("#card-{$card->id} [aria-label=\"Add a reaction\"]");

    expect(CardReaction::query()->where('card_id', $card->id)->count())->toBe(1);
});

it('[P07-09] presents the highlighted card to everyone, lets a participant close it and reopens it on the next highlight', function () {
    [
        'retro' => $retro,
        'columns' => $columns,
        'alice' => $alice,
        'bob' => $bob,
        'bobParticipant' => $bobParticipant,
        'carolParticipant' => $carolParticipant,
    ] = plan07Board(RetroPhase::Discussing);
    $slow = plan07Card($retro, $columns[0], $bobParticipant, 'Slow CI', 0);
    $flaky = plan07Card($retro, $columns[0], $bobParticipant, 'Flaky tests', 1);
    Vote::factory()->count(2)->create(['retro_id' => $retro->id, 'card_id' => $slow->id, 'participant_id' => $carolParticipant->id]);
    plan07Reaction($slow, $carolParticipant, '👍');
    plan07Comment($slow, $carolParticipant, 'Which pipeline is slow?');
    $overlay = '[role="dialog"]';
    $presentedChip = "{$overlay} button[aria-label=\"👍, 1 reaction\"]";
    $tooltip = '[data-slot="tooltip-content"]';
    $discuss = fn (Card $card): string => "#card-{$card->id} button:has-text(\"Discuss\")";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    plan07OpenSettings($alicePage)
        ->click('#retro-presentation')
        ->assertAriaAttribute('#retro-presentation', 'checked', 'true');
    plan07SaveSettings($alicePage);

    $bobPage->assertNotPresent($overlay);

    $alicePage->click($discuss($slow));

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertSeeIn($overlay, 'Slow CI')
            ->assertSeeIn($overlay, 'Bob Stone')
            ->assertSeeIn($overlay, '2 votes')
            ->assertPresent($presentedChip)
            ->assertPresent("{$overlay} button[aria-label=\"Comments (1)\"]");
    }

    $alicePage->assertSeeIn($overlay, 'Stop presenting');

    $bobPage->assertDontSeeIn($overlay, 'Stop presenting')
        ->assertSeeIn($tooltip, 'Carol Reyes')
        ->keys($presentedChip, 'Escape')
        ->assertNotPresent($tooltip)
        ->assertPresent($overlay)
        ->keys($presentedChip, 'Escape')
        ->assertNotPresent($overlay);

    $alicePage->assertSeeIn($overlay, 'Slow CI');

    expect($retro->fresh()->highlighted_card_id)->toBe($slow->id);

    $alicePage->press('Stop presenting')
        ->assertNotPresent($overlay)
        ->assertPresent("#card-{$slow->id} button[aria-pressed=\"false\"]");

    expect($retro->fresh()->highlighted_card_id)->toBeNull();

    $alicePage->click($discuss($flaky));

    $bobPage->assertSeeIn($overlay, 'Flaky tests');

    $alicePage->assertSeeIn($overlay, 'Flaky tests')
        ->keys($overlay, 'Escape')
        ->assertNotPresent($overlay);

    $bobPage->assertNotPresent($overlay);

    expect($retro->fresh()->highlighted_card_id)->toBeNull()
        ->and($retro->fresh()->presentation_mode)->toBeTrue();
});
