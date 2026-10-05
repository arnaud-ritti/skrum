<?php

use App\Enums\ActionItemPriority;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\ActionItemComment;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\User;

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
function actionItemsCoreBoard(RetroPhase $phase = RetroPhase::Discussing, array $attributes = []): array
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
function actionItemsCoreItem(Retro $retro, Participant $author, string $content, array $attributes = []): ActionItem
{
    return ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'created_by_participant_id' => $author->id,
        'content' => $content,
        ...$attributes,
    ]);
}

function actionItemsCoreGuest(Retro $retro): Participant
{
    return Participant::query()
        ->where('retro_id', $retro->id)
        ->whereNotNull('guest_name')
        ->sole();
}

function actionItemsCoreForm(): string
{
    return '[data-test="retro-action-items-panel"] form:has([aria-label="Add an action item…"])';
}

it('creates action items with each priority, a due date chip and an overdue badge', function () {
    [$retro, $alice, $bob] = actionItemsCoreBoard();
    $form = actionItemsCoreForm();
    $input = "{$form} [aria-label=\"Add an action item…\"]";
    $priority = "{$form} [aria-label=\"Priority\"]";
    $dueDate = "{$form} [data-slot=\"date-picker-trigger\"]";
    $submit = "{$form} button[type=\"submit\"]";
    $dueSoon = ActionItem::today()->addDays(3);
    $pastDue = ActionItem::today()->subDays(2);
    $dueSoonLabel = dueLabel($dueSoon);
    $pastDueLabel = dueLabel($pastDue);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $alicePage->assertVisible($input)
        ->assertDontSee('Action items are not anonymous: your name is shown.')
        ->fill($input, 'Rotate the on-call');
    chooseListboxOption($alicePage, $priority, 'High');
    pickDueDate($alicePage, $dueDate, $dueSoon);
    $alicePage->click($submit)
        ->assertSee('Rotate the on-call')
        ->assertValue($input, '');

    $alicePage->fill($input, 'Archive the old runbooks');
    chooseListboxOption($alicePage, $priority, 'Low');
    pickDueDate($alicePage, $dueDate, $pastDue);
    $alicePage->click($submit)
        ->assertSee('Archive the old runbooks')
        ->assertValue($input, '');

    $alicePage->fill($input, 'Tidy the backlog')
        ->keys($input, 'Enter')
        ->assertSee('Tidy the backlog');

    $high = ActionItem::query()->where('content', 'Rotate the on-call')->sole();
    $low = ActionItem::query()->where('content', 'Archive the old runbooks')->sole();
    $medium = ActionItem::query()->where('content', 'Tidy the backlog')->sole();
    $highCard = actionItemRow($high);
    $lowCard = actionItemRow($low);
    $mediumCard = actionItemRow($medium);

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertSeeIn("{$highCard} [data-slot=\"action-item-priority\"]", 'High')
            ->assertScript(actionItemCardShows($high, "Due {$dueSoonLabel}"), true)
            ->assertNotPresent("{$highCard} [data-slot=\"badge\"].bg-skrum-destructive-soft")
            ->assertSeeIn("{$lowCard} [data-slot=\"action-item-priority\"]", 'Low')
            ->assertScript(actionItemCardShows($low, "Overdue · {$pastDueLabel}"), true)
            ->assertPresent("{$lowCard} [data-slot=\"badge\"].bg-skrum-destructive-soft")
            ->assertSeeIn("{$mediumCard} [data-slot=\"action-item-priority\"]", 'Medium')
            ->assertScript(actionItemCardShows($medium, 'Alice Martin'), true);
    }

    expect($high->priority)->toBe(ActionItemPriority::High)
        ->and($high->due_on?->toDateString())->toBe($dueSoon->toDateString())
        ->and($low->priority)->toBe(ActionItemPriority::Low)
        ->and($low->due_on?->toDateString())->toBe($pastDue->toDateString())
        ->and($medium->priority)->toBe(ActionItemPriority::Medium)
        ->and($medium->due_on)->toBeNull();
});

it('assigns items to a team member outside the retro, a joined member and a guest', function () {
    [$retro, $alice, $bob, $aliceParticipant] = actionItemsCoreBoard();
    $dan = teamMember($retro->team);
    $dan->update(['name' => 'Dan Rivers', 'locale' => 'en']);
    $forDan = actionItemsCoreItem($retro, $aliceParticipant, 'Rotate the on-call');
    $forBob = actionItemsCoreItem($retro, $aliceParticipant, 'Automate the release notes');
    $forCarol = actionItemsCoreItem($retro, $aliceParticipant, 'Tidy the backlog');
    $card = fn (ActionItem $item): string => "#action-item-{$item->id}";
    $assignee = fn (ActionItem $item): string => "{$card($item)} [aria-label=\"Assignee\"]";
    $owner = fn (ActionItem $item): string => "{$card($item)} [data-slot=\"action-item-owner-name\"]";
    $edit = fn (ActionItem $item): string => "{$card($item)} button[aria-label=\"Edit action item\"]";
    $save = fn (ActionItem $item): string => "{$card($item)} button:has-text(\"Save\")";
    $joined = '[role="listbox"] [role="group"]:has-text("In this retro")';
    $others = '[role="listbox"] [role="group"]:has-text("Team")';

    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));
    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $alicePage->assertPresent("{$card($forDan)} [aria-label=\"Unassigned\"]")
        ->assertNotPresent($owner($forDan))
        ->click($edit($forDan))
        ->assertSeeIn($assignee($forDan), 'Unassigned')
        ->click($assignee($forDan))
        ->assertSeeIn($joined, 'Bob Stone')
        ->assertSeeIn($joined, 'Carol Guest (Guest)')
        ->assertSeeIn($others, 'Dan Rivers')
        ->assertDontSeeIn($joined, 'Dan Rivers')
        ->click('[role="option"]:has-text("Dan Rivers")')
        ->assertNotPresent('[role="listbox"]')
        ->click($save($forDan))
        ->assertSeeIn($owner($forDan), 'Dan Rivers');

    $alicePage->click($edit($forBob));
    chooseListboxOption($alicePage, $assignee($forBob), 'Bob Stone');
    $alicePage->click($save($forBob))
        ->assertSeeIn($owner($forBob), 'Bob Stone');

    $alicePage->click($edit($forCarol));
    chooseListboxOption($alicePage, $assignee($forCarol), 'Carol Guest (Guest)');
    $alicePage->click($save($forCarol))
        ->assertSeeIn($owner($forCarol), 'Carol Guest (Guest)');

    $carolPage->assertSeeIn($owner($forDan), 'Dan Rivers')
        ->assertSeeIn($owner($forBob), 'Bob Stone')
        ->assertSeeIn($owner($forCarol), 'Carol Guest (Guest)')
        ->assertNotPresent($edit($forCarol));

    expect($forDan->fresh()->assignee_user_id)->toBe($dan->id)
        ->and($forBob->fresh()->assignee_user_id)->toBe($bob->id)
        ->and($forCarol->fresh()->assignee_user_id)->toBeNull()
        ->and($forCarol->fresh()->assignee_participant_id)->toBe(actionItemsCoreGuest($retro)->id);
});

it('lets the guest tick only their own item and shows edit and delete to managers only', function () {
    [$retro, $alice, $bob, $aliceParticipant] = actionItemsCoreBoard();
    $edit = 'button[aria-label="Edit action item"]';
    $delete = '[aria-label="Delete action item"]';

    $carolPage = $this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest');
    $carolPage->assertSeeIn('header >> h1', 'Sprint 12');

    $hers = actionItemsCoreItem($retro, $aliceParticipant, 'Tidy the backlog', ['assignee_participant_id' => actionItemsCoreGuest($retro)->id]);
    $his = actionItemsCoreItem($retro, $aliceParticipant, 'Automate the release notes', ['assignee_user_id' => $bob->id]);
    $hersCard = actionItemRow($hers);
    $hisCard = actionItemRow($his);

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage->navigate("/retros/{$retro->id}");
    $this->awaitRealtime($carolPage);

    $carolPage->assertEnabled("{$hersCard} [aria-label=\"Mark as in progress\"]")
        ->assertDisabled("{$hisCard} [aria-label=\"Mark as in progress\"]")
        ->assertNotPresent("{$hersCard} [aria-label=\"Priority\"]")
        ->assertCount($edit, 0)
        ->assertCount($delete, 0)
        ->click("{$hersCard} [aria-label=\"Mark as in progress\"]")
        ->assertEnabled("{$hersCard} [aria-label=\"Mark as done\"]")
        ->click("{$hersCard} [aria-label=\"Mark as done\"]")
        ->assertPresent("{$hersCard} [aria-label=\"Reopen\"]");

    $alicePage->assertPresent("{$hersCard} [aria-label=\"Reopen\"]")
        ->assertEnabled("{$hisCard} [aria-label=\"Mark as in progress\"]")
        ->assertCount($edit, 2)
        ->assertCount($delete, 2);

    $bobPage->assertPresent("{$hersCard} [aria-label=\"Reopen\"]")
        ->assertDisabled("{$hersCard} [aria-label=\"Reopen\"]")
        ->assertEnabled("{$hisCard} [aria-label=\"Mark as in progress\"]")
        ->assertCount($edit, 0)
        ->assertCount($delete, 0);

    expect($hers->fresh()->completed_at)->not->toBeNull()
        ->and($hers->fresh()->started_at)->not->toBeNull()
        ->and($his->fresh()->completed_at)->toBeNull();
});

it('updates comment counts and open threads live and lets the facilitator delete a guest comment', function () {
    [$retro, $alice, $bob, $aliceParticipant] = actionItemsCoreBoard();
    $item = actionItemsCoreItem($retro, $aliceParticipant, 'Rotate the on-call');
    $card = actionItemRow($item);
    $toggle = "{$card} button[aria-controls=\"action-item-{$item->id}-comments\"]";
    $thread = "#action-item-{$item->id}-comments";
    $comments = "{$thread} ul";
    $box = "{$thread} [aria-label=\"Write a comment…\"]";
    $send = "{$thread} form:has([aria-label=\"Write a comment…\"]) button[type=\"submit\"]";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));
    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));
    $details = "{$card} [data-slot=\"action-item-details-toggle\"]";

    foreach ([$alicePage, $bobPage, $carolPage] as $page) {
        $page->assertAttribute($details, 'aria-expanded', 'false')
            ->assertNotPresent($toggle)
            ->click($details);
    }

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

it('disables the action item controls for everyone when the facilitator closes the board for editing', function () {
    [$retro, $alice, $bob, , $bobParticipant] = actionItemsCoreBoard();
    $item = actionItemsCoreItem($retro, $bobParticipant, 'Rotate the on-call');
    $card = actionItemRow($item);
    $form = actionItemsCoreForm();
    $input = "{$form} [aria-label=\"Add an action item…\"]";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $bobPage->assertEnabled($input)
        ->assertEnabled("{$card} [aria-label=\"Mark as in progress\"]")
        ->assertCount('[aria-label="Delete action item"]', 1);

    $alicePage->click('[aria-label="Facilitator menu"]')
        ->assertSee('Settings…')
        ->click('Settings…')
        ->assertVisible('#retro-locked')
        ->click('#retro-locked')
        ->assertAttribute('#retro-locked', 'aria-checked', 'true')
        ->click('[role="dialog"] button:has-text("Apply")')
        ->assertSeeIn('[role="dialog"]', 'No changes')
        ->keys('[role="dialog"]', 'Escape')
        ->assertNotPresent('[role="dialog"]')
        ->assertSee('Board closed for editing')
        ->assertDisabled($input);

    $bobPage->assertSee('Board closed for editing')
        ->assertDisabled($input)
        ->assertDisabled("{$card} [aria-label=\"Mark as in progress\"]")
        ->assertCount('button[aria-label="Edit action item"]', 0)
        ->assertCount('[aria-label="Delete action item"]', 0);

    expect($retro->fresh()->is_locked)->toBeTrue();
});

it('shows a toast and resyncs when an edit reaches a board that was closed for editing', function () {
    [$retro, , $bob, , $bobParticipant] = actionItemsCoreBoard();
    $item = actionItemsCoreItem($retro, $bobParticipant, 'Rotate the on-call');
    $card = actionItemRow($item);

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $page->assertEnabled("{$card} [aria-label=\"Mark as in progress\"]");

    $retro->forceFill(['is_locked' => true])->save();

    $page->click("{$card} [aria-label=\"Mark as in progress\"]")
        ->assertSee('The board is closed for editing.')
        ->assertSee('Board closed for editing')
        ->assertDisabled("{$card} [aria-label=\"Mark as in progress\"]");

    expect($item->fresh()->started_at)->toBeNull()
        ->and($item->fresh()->completed_at)->toBeNull();
});

it('lists priority, due date, overdue mark, assignee, status and theme in compact rows of the Results view, a done item without its priority', function () {
    [$retro, , $bob, $aliceParticipant] = actionItemsCoreBoard();
    $pastDue = ActionItem::today()->subDays(2);
    $dueSoon = ActionItem::today()->addDays(3);
    $pastDueLabel = dueLabel($pastDue);
    $dueSoonLabel = dueLabel($dueSoon);

    $carolPage = $this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest');
    $carolPage->assertSeeIn('header >> h1', 'Sprint 12');

    $open = actionItemsCoreItem($retro, $aliceParticipant, 'Rotate the on-call', [
        'priority' => ActionItemPriority::High,
        'due_on' => $pastDue->toDateString(),
        'assignee_user_id' => $bob->id,
        'theme_name' => 'Delivery',
    ]);
    $done = actionItemsCoreItem($retro, $aliceParticipant, 'Tidy the backlog', [
        'priority' => ActionItemPriority::Low,
        'due_on' => $dueSoon->toDateString(),
        'assignee_participant_id' => actionItemsCoreGuest($retro)->id,
        'completed_at' => now(),
    ]);
    $openCard = actionItemRow($open);
    $doneCard = actionItemRow($done);

    $retro->forceFill(['phase' => RetroPhase::Completed, 'completed_at' => now()])->save();

    $bobPage = $this->signIn($bob, "/retros/{$retro->id}");

    $bobPage->assertSee('Session ended')
        ->assertPresent("{$openCard} [data-slot=\"action-item-priority\"][data-priority=\"high\"]")
        ->assertScript(actionItemCardShows($open, "Overdue · {$pastDueLabel}"), true)
        ->assertPresent("{$openCard} [data-slot=\"action-item-due\"].text-skrum-destructive-text")
        ->assertScript(actionItemCardShows($open, 'Bob Stone'), true)
        ->assertScript(actionItemCardShows($open, 'Theme: Delivery'), true)
        ->assertAttribute($openCard, 'data-status', 'open')
        ->assertDisabled("{$openCard} [aria-label=\"Mark as done\"]")
        ->assertAttribute($openCard, 'data-variant', 'compact')
        ->assertNotPresent("{$doneCard} [data-slot=\"action-item-priority\"]")
        ->assertAttribute($doneCard, 'data-status', 'completed')
        ->assertScript(actionItemCardShows($done, 'Carol Guest (Guest)'), true)
        ->assertDisabled("{$doneCard} [aria-label=\"Reopen\"]")
        ->assertNotPresent('[aria-label="Delete action item"]')
        ->assertNotPresent('[aria-label="Add an action item…"]')
        ->assertSee("View the team's action items")
        ->assertPresent("a[href*=\"/action-items?team={$retro->team_id}\"]");

    $carolPage->navigate("/retros/{$retro->id}");

    $carolPage->assertSee('Session ended')
        ->assertScript(actionItemCardShows($open, 'Rotate the on-call'), true)
        ->assertDontSee("View the team's action items")
        ->assertNotPresent('a[href*="/action-items"]');
});

it('warns that action items are not anonymous and names creators and comment authors on an anonymous retro', function () {
    [$retro, $alice] = actionItemsCoreBoard(RetroPhase::Discussing, ['is_anonymous' => true]);
    $form = actionItemsCoreForm();
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
    $card = actionItemRow($item);
    $toggle = "{$card} button[aria-controls=\"action-item-{$item->id}-comments\"]";
    $thread = "#action-item-{$item->id}-comments";
    $comments = "{$thread} ul";

    $carolPage->assertScript(actionItemCardShows($item, 'Carol Guest'), true);

    $details = "{$card} [data-slot=\"action-item-details-toggle\"]";

    $alicePage->assertScript(actionItemCardShows($item, 'Carol Guest'), true)
        ->click($details)
        ->click($toggle)
        ->assertSeeIn($thread, $notice)
        ->fill("{$thread} [aria-label=\"Write a comment…\"]", 'I can pair on this')
        ->click("{$thread} form:has([aria-label=\"Write a comment…\"]) button[type=\"submit\"]")
        ->assertSeeIn($comments, 'I can pair on this')
        ->assertSeeIn($comments, 'Alice Martin');

    $carolPage->click($details)
        ->assertSeeIn($toggle, '1 comment')
        ->click($toggle)
        ->assertSeeIn($thread, $notice)
        ->assertSeeIn($comments, 'I can pair on this')
        ->assertSeeIn($comments, 'Alice Martin');

    expect($item->created_by_participant_id)->toBe(actionItemsCoreGuest($retro)->id);
});

it('warns how many open action items are deleted with the retro', function (int $open, string $warning) {
    [$retro, $alice, , $aliceParticipant] = actionItemsCoreBoard();
    $teamPath = route('teams.show', [$retro->team->workspace, $retro->team], false);

    foreach (range(1, $open) as $number) {
        actionItemsCoreItem($retro, $aliceParticipant, "Follow-up {$number}");
    }

    actionItemsCoreItem($retro, $aliceParticipant, 'Archive the old runbooks', ['completed_at' => now()]);

    $page = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $page->click('[aria-label="Facilitator menu"]')
        ->assertSee('Delete retrospective…')
        ->click('Delete retrospective…')
        ->assertSeeIn('[role="alertdialog"]', $warning)
        ->click('[role="alertdialog"] button:has-text("Delete")')
        ->assertPathIs($teamPath);

    expect(Retro::query()->whereKey($retro->id)->exists())->toBeFalse()
        ->and(ActionItem::query()->count())->toBe(0);
})->with([
    'one open item' => [1, 'This also deletes 1 open action item.'],
    'two open items' => [2, 'This also deletes 2 open action items.'],
]);
