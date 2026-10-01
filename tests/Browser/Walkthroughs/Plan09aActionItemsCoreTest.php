<?php

use App\Enums\ActionItemPriority;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\ActionItemComment;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * @param  array<string, mixed>  $attributes
 * @return array{
 *     0: Retro,
 *     1: User,
 *     2: User,
 *     3: Participant,
 *     4: Participant
 * }
 */
function p09aBoard(RetroPhase $phase = RetroPhase::Discussing, array $attributes = []): array
{
    $retro = Retro::factory()
        ->inPhase($phase)
        ->withGuestAccess()
        ->create(['title' => 'Sprint 12', ...$attributes]);

    [$alice, $aliceParticipant] = retroFacilitator($retro);
    [$bob, $bobParticipant] = retroMember($retro);

    $alice->update(['name' => 'Alice Martin', 'locale' => 'en']);
    $bob->update(['name' => 'Bob Stone', 'locale' => 'en']);

    return [$retro->fresh(), $alice, $bob, $aliceParticipant, $bobParticipant];
}

/**
 * @param  array<string, mixed>  $attributes
 */
function p09aItem(Retro $retro, Participant $author, string $content, array $attributes = []): ActionItem
{
    return ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'created_by_participant_id' => $author->id,
        'content' => $content,
        ...$attributes,
    ]);
}

function p09aGuest(Retro $retro): Participant
{
    return Participant::query()
        ->where('retro_id', $retro->id)
        ->whereNotNull('guest_name')
        ->sole();
}

function p09aCard(ActionItem $item): string
{
    return "#action-item-{$item->id}";
}

function p09aCardShows(ActionItem $item, string $text): string
{
    $needle = json_encode($text, JSON_THROW_ON_ERROR);

    return "document.getElementById('action-item-{$item->id}').innerText.includes({$needle})";
}

function p09aDueLabel(CarbonImmutable $date): string
{
    return $date->format('M j');
}

function p09aForm(): string
{
    return '[data-test="retro-action-items-panel"] form:has([aria-label="Add an action item…"])';
}

function p09aChoose(mixed $page, string $trigger, string $option): void
{
    $page->click($trigger)
        ->assertPresent('[role="listbox"]')
        ->click("[role=\"option\"]:has-text(\"{$option}\")")
        ->assertNotPresent('[role="listbox"]');
}

it('[P09a-01a] creates action items with each priority, a due date chip and an overdue badge', function () {
    [$retro, $alice, $bob] = p09aBoard();
    $form = p09aForm();
    $input = "{$form} [aria-label=\"Add an action item…\"]";
    $priority = "{$form} [aria-label=\"Priority\"]";
    $dueDate = "{$form} [aria-label=\"Due date\"]";
    $submit = "{$form} button[type=\"submit\"]";
    $dueSoon = ActionItem::today()->addDays(3);
    $pastDue = ActionItem::today()->subDays(2);
    $dueSoonLabel = p09aDueLabel($dueSoon);
    $pastDueLabel = p09aDueLabel($pastDue);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $alicePage->assertVisible($input)
        ->assertDontSee('Action items are not anonymous: your name is shown.')
        ->fill($input, 'Rotate the on-call');
    p09aChoose($alicePage, $priority, 'High');
    $alicePage->fill($dueDate, $dueSoon->toDateString())
        ->click($submit)
        ->assertSee('Rotate the on-call')
        ->assertValue($input, '');

    $alicePage->fill($input, 'Archive the old runbooks');
    p09aChoose($alicePage, $priority, 'Low');
    $alicePage->fill($dueDate, $pastDue->toDateString())
        ->click($submit)
        ->assertSee('Archive the old runbooks')
        ->assertValue($input, '');

    $alicePage->fill($input, 'Tidy the backlog')
        ->keys($input, 'Enter')
        ->assertSee('Tidy the backlog');

    $high = ActionItem::query()->where('content', 'Rotate the on-call')->sole();
    $low = ActionItem::query()->where('content', 'Archive the old runbooks')->sole();
    $medium = ActionItem::query()->where('content', 'Tidy the backlog')->sole();
    $highCard = p09aCard($high);
    $lowCard = p09aCard($low);
    $mediumCard = p09aCard($medium);

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertSeeIn("{$highCard} [aria-label=\"Priority\"]", 'High')
            ->assertScript(p09aCardShows($high, "Due {$dueSoonLabel}"), true)
            ->assertNotPresent("{$highCard} [data-slot=\"badge\"].bg-skrum-destructive-soft")
            ->assertSeeIn("{$lowCard} [aria-label=\"Priority\"]", 'Low')
            ->assertScript(p09aCardShows($low, "Overdue · {$pastDueLabel}"), true)
            ->assertPresent("{$lowCard} [data-slot=\"badge\"].bg-skrum-destructive-soft")
            ->assertSeeIn("{$mediumCard} [aria-label=\"Priority\"]", 'Medium')
            ->assertScript(p09aCardShows($medium, 'Alice Martin'), true);
    }

    expect($high->priority)->toBe(ActionItemPriority::High)
        ->and($high->due_on?->toDateString())->toBe($dueSoon->toDateString())
        ->and($low->priority)->toBe(ActionItemPriority::Low)
        ->and($low->due_on?->toDateString())->toBe($pastDue->toDateString())
        ->and($medium->priority)->toBe(ActionItemPriority::Medium)
        ->and($medium->due_on)->toBeNull();
});

it('[P09a-01b] assigns items to a team member outside the retro, a joined member and a guest', function () {
    [$retro, $alice, $bob, $aliceParticipant] = p09aBoard();
    $dan = teamMember($retro->team);
    $dan->update(['name' => 'Dan Rivers', 'locale' => 'en']);
    $forDan = p09aItem($retro, $aliceParticipant, 'Rotate the on-call');
    $forBob = p09aItem($retro, $aliceParticipant, 'Automate the release notes');
    $forCarol = p09aItem($retro, $aliceParticipant, 'Tidy the backlog');
    $assignee = fn (ActionItem $item): string => "#action-item-{$item->id} [aria-label=\"Assignee\"]";
    $joined = '[role="listbox"] [role="group"]:has-text("In this retro")';
    $others = '[role="listbox"] [role="group"]:has-text("Team")';

    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));
    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $alicePage->assertSeeIn($assignee($forDan), 'Unassigned')
        ->click($assignee($forDan))
        ->assertSeeIn($joined, 'Bob Stone')
        ->assertSeeIn($joined, 'Carol Guest (guest)')
        ->assertSeeIn($others, 'Dan Rivers')
        ->assertDontSeeIn($joined, 'Dan Rivers')
        ->click('[role="option"]:has-text("Dan Rivers")')
        ->assertNotPresent('[role="listbox"]')
        ->assertSeeIn($assignee($forDan), 'Dan Rivers');

    p09aChoose($alicePage, $assignee($forBob), 'Bob Stone');
    $alicePage->assertSeeIn($assignee($forBob), 'Bob Stone');

    p09aChoose($alicePage, $assignee($forCarol), 'Carol Guest (guest)');
    $alicePage->assertSeeIn($assignee($forCarol), 'Carol Guest (guest)');

    $carolPage->assertSeeIn($assignee($forDan), 'Dan Rivers')
        ->assertSeeIn($assignee($forBob), 'Bob Stone')
        ->assertSeeIn($assignee($forCarol), 'Carol Guest (guest)');

    expect($forDan->fresh()->assignee_user_id)->toBe($dan->id)
        ->and($forBob->fresh()->assignee_user_id)->toBe($bob->id)
        ->and($forCarol->fresh()->assignee_user_id)->toBeNull()
        ->and($forCarol->fresh()->assignee_participant_id)->toBe(p09aGuest($retro)->id);
});

it('[P09a-01c] lets the guest tick only their own item and shows edit and delete to managers only', function () {
    [$retro, $alice, $bob, $aliceParticipant] = p09aBoard();
    $edit = 'button[aria-label="Edit action item"]';
    $delete = '[aria-label="Delete action item"]';

    $carolPage = $this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest');
    $carolPage->assertSeeIn('header > h1', 'Sprint 12');

    $hers = p09aItem($retro, $aliceParticipant, 'Tidy the backlog', ['assignee_participant_id' => p09aGuest($retro)->id]);
    $his = p09aItem($retro, $aliceParticipant, 'Automate the release notes', ['assignee_user_id' => $bob->id]);
    $hersCard = p09aCard($hers);
    $hisCard = p09aCard($his);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage->navigate("/retros/{$retro->id}");
    $this->awaitRealtime($carolPage);

    $carolPage->assertEnabled("{$hersCard} [aria-label=\"Mark as done\"]")
        ->assertDisabled("{$hisCard} [aria-label=\"Mark as done\"]")
        ->assertDisabled("{$hersCard} [aria-label=\"Priority\"]")
        ->assertCount($edit, 0)
        ->assertCount($delete, 0)
        ->click("{$hersCard} [aria-label=\"Mark as done\"]")
        ->assertPresent("{$hersCard} [aria-label=\"Reopen\"]");

    $alicePage->assertPresent("{$hersCard} [aria-label=\"Reopen\"]")
        ->assertEnabled("{$hisCard} [aria-label=\"Mark as done\"]")
        ->assertCount($edit, 2)
        ->assertCount($delete, 2);

    $bobPage->assertPresent("{$hersCard} [aria-label=\"Reopen\"]")
        ->assertDisabled("{$hersCard} [aria-label=\"Reopen\"]")
        ->assertEnabled("{$hisCard} [aria-label=\"Mark as done\"]")
        ->assertCount($edit, 0)
        ->assertCount($delete, 0);

    expect($hers->fresh()->completed_at)->not->toBeNull()
        ->and($his->fresh()->completed_at)->toBeNull();
});

it('[P09a-02] updates comment counts and open threads live and lets the facilitator delete a guest comment', function () {
    [$retro, $alice, $bob, $aliceParticipant] = p09aBoard();
    $item = p09aItem($retro, $aliceParticipant, 'Rotate the on-call');
    $card = p09aCard($item);
    $toggle = "{$card} button[aria-controls=\"action-item-{$item->id}-comments\"]";
    $thread = "#action-item-{$item->id}-comments";
    $comments = "{$thread} ul";
    $box = "{$thread} [aria-label=\"Write a comment…\"]";
    $send = "{$thread} form:has([aria-label=\"Write a comment…\"]) button[type=\"submit\"]";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $alicePage->assertSeeIn($toggle, '0 comments')
        ->click($toggle)
        ->assertSeeIn($thread, 'No comments yet.');

    $carolPage->click($toggle)
        ->assertSeeIn($thread, 'No comments yet.')
        ->fill($box, 'Who owns this?')
        ->click($send)
        ->assertSeeIn($comments, 'Who owns this?')
        ->assertSeeIn($toggle, '1 comment');

    $bobPage->assertSeeIn($toggle, '1 comment')
        ->assertNotPresent($thread);

    $alicePage->assertSeeIn($toggle, '1 comment')
        ->assertSeeIn($comments, 'Who owns this?')
        ->assertSeeIn($comments, 'Carol Guest')
        ->fill($box, 'I do.')
        ->click($send)
        ->assertSeeIn($comments, 'I do.');

    $carolPage->assertSeeIn($toggle, '2 comments')
        ->assertSeeIn($comments, 'I do.')
        ->assertSeeIn($comments, 'Alice Martin')
        ->assertCount("{$thread} [aria-label=\"Delete comment\"]", 1);

    $bobPage->assertSeeIn($toggle, '2 comments');

    $alicePage->assertCount("{$thread} [aria-label=\"Delete comment\"]", 2)
        ->click("{$thread} li:has-text(\"Who owns this?\") [aria-label=\"Delete comment\"]")
        ->assertSeeIn($toggle, '1 comment')
        ->assertDontSeeIn($thread, 'Who owns this?');

    $carolPage->assertSeeIn($toggle, '1 comment')
        ->assertSeeIn($comments, 'I do.')
        ->assertDontSeeIn($thread, 'Who owns this?');

    $bobPage->assertSeeIn($toggle, '1 comment');

    expect(ActionItemComment::query()->where('action_item_id', $item->id)->pluck('content')->all())->toBe(['I do.']);
});

it('[P09a-03a] disables the action item controls for everyone when the facilitator closes the board for editing', function () {
    [$retro, $alice, $bob, , $bobParticipant] = p09aBoard();
    $item = p09aItem($retro, $bobParticipant, 'Rotate the on-call');
    $card = p09aCard($item);
    $form = p09aForm();
    $input = "{$form} [aria-label=\"Add an action item…\"]";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->assertEnabled($input)
        ->assertEnabled("{$card} [aria-label=\"Mark as done\"]")
        ->assertCount('[aria-label="Delete action item"]', 1);

    $alicePage->click('[aria-label="Facilitator menu"]')
        ->assertSee('Settings…')
        ->click('Settings…')
        ->assertVisible('#retro-locked')
        ->click('#retro-locked')
        ->assertAttribute('#retro-locked', 'aria-checked', 'true')
        ->press('Save')
        ->assertNotPresent('[role="dialog"]')
        ->assertSee('Board closed for editing')
        ->assertDisabled($input);

    $bobPage->assertSee('Board closed for editing')
        ->assertDisabled($input)
        ->assertDisabled("{$card} [aria-label=\"Mark as done\"]")
        ->assertCount('button[aria-label="Edit action item"]', 0)
        ->assertCount('[aria-label="Delete action item"]', 0);

    expect($retro->fresh()->is_locked)->toBeTrue();
});

it('[P09a-03b] shows a toast and resyncs when an edit reaches a board that was closed for editing', function () {
    [$retro, , $bob, , $bobParticipant] = p09aBoard();
    $item = p09aItem($retro, $bobParticipant, 'Rotate the on-call');
    $card = p09aCard($item);

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $page->assertEnabled("{$card} [aria-label=\"Mark as done\"]");

    $retro->forceFill(['is_locked' => true])->save();

    $page->click("{$card} [aria-label=\"Mark as done\"]")
        ->assertSee('The board is closed for editing.')
        ->assertSee('Board closed for editing')
        ->assertDisabled("{$card} [aria-label=\"Mark as done\"]");

    expect($item->fresh()->completed_at)->toBeNull();
});

it('[P09a-03c] lists priority, due date, overdue badge, assignee, status and theme in the Results view', function () {
    [$retro, , $bob, $aliceParticipant] = p09aBoard();
    $pastDue = ActionItem::today()->subDays(2);
    $dueSoon = ActionItem::today()->addDays(3);
    $pastDueLabel = p09aDueLabel($pastDue);
    $dueSoonLabel = p09aDueLabel($dueSoon);

    $carolPage = $this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest');
    $carolPage->assertSeeIn('header > h1', 'Sprint 12');

    $open = p09aItem($retro, $aliceParticipant, 'Rotate the on-call', [
        'priority' => ActionItemPriority::High,
        'due_on' => $pastDue->toDateString(),
        'assignee_user_id' => $bob->id,
        'theme_name' => 'Delivery',
    ]);
    $done = p09aItem($retro, $aliceParticipant, 'Tidy the backlog', [
        'priority' => ActionItemPriority::Low,
        'due_on' => $dueSoon->toDateString(),
        'assignee_participant_id' => p09aGuest($retro)->id,
        'completed_at' => now(),
    ]);
    $openCard = p09aCard($open);
    $doneCard = p09aCard($done);

    $retro->forceFill(['phase' => RetroPhase::Completed, 'completed_at' => now()])->save();

    $bobPage = $this->signIn($bob, "/retros/{$retro->id}");

    $bobPage->assertSee('Retrospective completed on')
        ->assertPresent("{$openCard} svg.text-red-600")
        ->assertScript(p09aCardShows($open, "Overdue · {$pastDueLabel}"), true)
        ->assertPresent("{$openCard} [data-slot=\"badge\"].bg-skrum-destructive-soft")
        ->assertScript(p09aCardShows($open, 'Bob Stone'), true)
        ->assertScript(p09aCardShows($open, 'Theme: Delivery'), true)
        ->assertNotPresent("{$openCard} [aria-label=\"Done\"]")
        ->assertPresent("{$doneCard} svg.text-slate-500")
        ->assertScript(p09aCardShows($done, "Due {$dueSoonLabel}"), true)
        ->assertScript(p09aCardShows($done, 'Carol Guest (guest)'), true)
        ->assertPresent("{$doneCard} [aria-label=\"Done\"]")
        ->assertNotPresent('[aria-label="Mark as done"]')
        ->assertNotPresent('[aria-label="Add an action item…"]')
        ->assertSee("View the team's action items")
        ->assertPresent("a[href*=\"/action-items?team={$retro->team_id}\"]");

    $carolPage->navigate("/retros/{$retro->id}");

    $carolPage->assertSee('Retrospective completed on')
        ->assertScript(p09aCardShows($open, 'Rotate the on-call'), true)
        ->assertDontSee("View the team's action items")
        ->assertNotPresent('a[href*="/action-items"]');
});

it('[P09a-04] warns that action items are not anonymous and names creators and comment authors on an anonymous retro', function () {
    [$retro, $alice] = p09aBoard(RetroPhase::Discussing, ['is_anonymous' => true]);
    $form = p09aForm();
    $input = "{$form} [aria-label=\"Add an action item…\"]";
    $notice = 'Action items are not anonymous: your name is shown.';

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));

    $alicePage->assertSeeIn($form, $notice);

    $carolPage->assertSeeIn($form, $notice)
        ->fill($input, 'Automate the release notes')
        ->keys($input, 'Enter')
        ->assertSee('Automate the release notes');

    $item = ActionItem::query()->where('content', 'Automate the release notes')->sole();
    $card = p09aCard($item);
    $toggle = "{$card} button[aria-controls=\"action-item-{$item->id}-comments\"]";
    $thread = "#action-item-{$item->id}-comments";
    $comments = "{$thread} ul";

    $carolPage->assertScript(p09aCardShows($item, 'Carol Guest'), true);

    $alicePage->assertScript(p09aCardShows($item, 'Carol Guest'), true)
        ->click($toggle)
        ->assertSeeIn($thread, $notice)
        ->fill("{$thread} [aria-label=\"Write a comment…\"]", 'I can pair on this')
        ->click("{$thread} form:has([aria-label=\"Write a comment…\"]) button[type=\"submit\"]")
        ->assertSeeIn($comments, 'I can pair on this')
        ->assertSeeIn($comments, 'Alice Martin');

    $carolPage->assertSeeIn($toggle, '1 comment')
        ->click($toggle)
        ->assertSeeIn($thread, $notice)
        ->assertSeeIn($comments, 'I can pair on this')
        ->assertSeeIn($comments, 'Alice Martin');

    expect($item->created_by_participant_id)->toBe(p09aGuest($retro)->id);
});

it('[P09a-05] warns how many open action items are deleted with the retro', function (int $open, string $warning) {
    [$retro, $alice, , $aliceParticipant] = p09aBoard();
    $teamPath = route('teams.show', [$retro->team->workspace, $retro->team], false);

    foreach (range(1, $open) as $number) {
        p09aItem($retro, $aliceParticipant, "Follow-up {$number}");
    }

    p09aItem($retro, $aliceParticipant, 'Archive the old runbooks', ['completed_at' => now()]);

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $page->click('[aria-label="Facilitator menu"]')
        ->assertSee('Delete retrospective…')
        ->click('Delete retrospective…')
        ->assertSeeIn('[role="dialog"]', $warning)
        ->press('Delete')
        ->assertPathIs($teamPath);

    expect(Retro::query()->whereKey($retro->id)->exists())->toBeFalse()
        ->and(ActionItem::query()->count())->toBe(0);
})->with([
    'one open item' => [1, 'This also deletes 1 open action item.'],
    'two open items' => [2, 'This also deletes 2 open action items.'],
]);
