<?php

use App\Enums\ActionItemReminderKind;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\ActionItemReminder;
use App\Models\ActionItemSubtask;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Notifications\ActionItemReminderDigestNotification;
use App\Notifications\ActionItemReminderNotification;
use Carbon\CarbonImmutable;
use Illuminate\Notifications\Events\NotificationSent;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;

function p09bMember(Team $team, string $name): User
{
    $user = teamMember($team);

    $user->update(['name' => $name, 'locale' => 'en']);

    return $user;
}

/**
 * @return array{
 *     0: Team,
 *     1: User,
 *     2: User
 * }
 */
function p09bTeam(): array
{
    $team = Team::factory()->create(['name' => 'Platform']);

    return [$team, p09bMember($team, 'Alice Martin'), p09bMember($team, 'Bob Stone')];
}

function p09bJoin(Retro $retro, User $user, bool $facilitates = false): Participant
{
    $participant = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $user->id]);

    if ($facilitates) {
        $retro->forceFill(['facilitator_participant_id' => $participant->id])->save();
    }

    return $participant;
}

/**
 * @return array{
 *     0: Retro,
 *     1: ActionItem,
 *     2: User,
 *     3: User,
 *     4: Team
 * }
 */
function p09bCarryOver(RetroPhase $phase = RetroPhase::Writing): array
{
    [$team, $alice, $bob] = p09bTeam();

    $earlier = Retro::factory()->inPhase(RetroPhase::Completed)->create([
        'team_id' => $team->id,
        'title' => 'Sprint 11',
        'created_at' => now()->subWeek(),
        'completed_at' => now()->subWeek(),
    ]);
    $carried = ActionItem::factory()->create(['retro_id' => $earlier->id, 'content' => 'Buy a faster runner']);

    $retro = Retro::factory()
        ->inPhase($phase)
        ->withGuestAccess()
        ->create(['team_id' => $team->id, 'title' => 'Sprint 12']);

    p09bJoin($retro, $alice, facilitates: true);
    p09bJoin($retro, $bob);

    return [$retro->fresh(), $carried, $alice, $bob, $team];
}

/**
 * @param  array<string, mixed>  $attributes
 */
function p09bFollowUp(Team $team, User $author, string $content, array $attributes = []): ActionItem
{
    return ActionItem::factory()
        ->withoutRetro($team, $author)
        ->create(['content' => $content, ...$attributes]);
}

function p09bPagePath(Team $team): string
{
    return route('workspaces.actionItems.index', ['workspace' => $team->workspace], false);
}

function p09bCard(ActionItem $item): string
{
    return "#action-item-{$item->id}";
}

function p09bTitle(ActionItem $item): string
{
    return "#action-item-{$item->id} [data-slot=\"action-row-title\"]";
}

function p09bCardShows(ActionItem $item, string $text): string
{
    $needle = json_encode($text, JSON_THROW_ON_ERROR);

    return "document.getElementById('action-item-{$item->id}').innerText.includes({$needle})";
}

function p09bDueLabel(CarbonImmutable $date): string
{
    return $date->format('M j');
}

function p09bFilter(string $label): string
{
    return "[data-slot=\"action-item-filters\"] [aria-label=\"{$label}\"]";
}

function p09bChoose(mixed $page, string $trigger, string $option): void
{
    $page->click($trigger)
        ->assertPresent('[role="listbox"]')
        ->click("[role=\"option\"]:has-text(\"{$option}\")")
        ->assertNotPresent('[role="listbox"]');
}

it('[P09b-01a] opens the previous action items once in Writing and updates the other member live', function () {
    [$retro, $carried, $alice, $bob] = p09bCarryOver();
    $sheet = '[role="dialog"]';
    $card = "{$sheet} #action-item-{$carried->id}";
    $seen = "localStorage.getItem('skrum.carriedSeen.{$retro->id}')";

    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));
    $bobPage = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    foreach ([$alicePage, $bobPage] as $page) {
        $page->assertSeeIn($sheet, 'Previous action items')
            ->assertSeeIn($sheet, 'Sprint 11')
            ->assertSeeIn($sheet, 'Buy a faster runner')
            ->assertPresent('button:has-text("Previous action items (1)")')
            ->assertScript($seen, 'true');
    }

    $bobPage->assertDisabled("{$card} [aria-label=\"Mark as in progress\"]");

    $alicePage->click("{$card} [aria-label=\"Mark as in progress\"]")
        ->assertPresent('button:has-text("Previous action items (1)")')
        ->click("{$card} [aria-label=\"Mark as done\"]")
        ->assertPresent("{$card} [aria-label=\"Reopen\"]")
        ->assertPresent('button:has-text("Previous action items (0)")');

    $bobPage->assertPresent("{$card} [aria-label=\"Reopen\"]")
        ->assertPresent('button:has-text("Previous action items (0)")');

    expect($carried->fresh()->completed_at)->not->toBeNull();

    $alicePage->navigate("/retros/{$retro->id}");

    $this->awaitRealtime($alicePage)
        ->assertPresent('button:has-text("Previous action items (0)")')
        ->assertNotPresent($sheet)
        ->click('button:has-text("Previous action items (0)")')
        ->assertSeeIn($sheet, 'Buy a faster runner');
});

it('[P09b-01b] never shows the previous action items to a guest', function () {
    [$retro, $carried, $alice] = p09bCarryOver();
    $sheet = '[role="dialog"]';
    $card = "{$sheet} #action-item-{$carried->id}";

    $carolPage = $this->awaitRealtime($this->joinAsGuest("/join/{$retro->guest_token}", 'Carol Guest'));
    $alicePage = $this->awaitRealtime($this->signIn($alice, "/retros/{$retro->id}"));

    $carolPage->assertSeeIn('header >> h1', 'Sprint 12');

    $alicePage->click("{$card} [aria-label=\"Mark as in progress\"]")
        ->assertPresent("{$card} [aria-label=\"Mark as done\"]")
        ->keys($sheet, 'Escape')
        ->assertNotPresent($sheet)
        ->press('Next')
        ->assertSeeIn('[aria-current="step"]', 'Grouping');

    $carolPage->assertSeeIn('[aria-current="step"]', 'Grouping')
        ->assertNotPresent($sheet)
        ->assertDontSee('Previous action items')
        ->assertScript('document.documentElement.outerHTML.includes("Buy a faster runner")', false)
        ->assertScript("localStorage.getItem('skrum.carriedSeen.{$retro->id}') === null", true);
});

it('[P09b-01c] leaves the previous action items closed when the board is first opened after Writing', function () {
    [$retro, , , $bob, $team] = p09bCarryOver(RetroPhase::Discussing);
    $sheet = '[role="dialog"]';

    $page = $this->awaitRealtime($this->signIn($bob, "/retros/{$retro->id}"));

    $page->assertPresent('button:has-text("Previous action items (1)")')
        ->assertNotPresent($sheet)
        ->assertScript("localStorage.getItem('skrum.carriedSeen.{$retro->id}') === null", true)
        ->click('button:has-text("Previous action items (1)")')
        ->assertSeeIn($sheet, 'Buy a faster runner')
        ->assertSeeIn($sheet, 'Open the action items page')
        ->assertPresent("{$sheet} a[href*=\"/action-items?team={$team->id}\"]");
});

it('[P09b-02a] reaches the page from the sidebar and the team page, writes the filters to the URL and restores them', function () {
    [$team, $alice] = p09bTeam();
    $workspace = $team->workspace;
    $mobile = Team::factory()->create(['workspace_id' => $workspace->id, 'name' => 'Mobile']);
    $mobile->members()->attach($alice);
    p09bFollowUp($team, $alice, 'Rotate the keys', ['assignee_user_id' => $alice->id]);
    p09bFollowUp($mobile, $alice, 'Book the room');
    p09bFollowUp($team, $alice, 'Archive the old board', ['completed_at' => now()]);
    $path = p09bPagePath($team);
    $sidebarEntries = 'Array.from(document.querySelectorAll(\'[data-sidebar="content"] a[data-sidebar="menu-button"]\')).map((link) => link.textContent.trim()).join(" / ")';
    $sidebarTeams = "a[data-sidebar=\"menu-button\"][href$=\"/w/{$workspace->slug}\"]";
    $sidebarActionItems = 'a[data-sidebar="menu-button"][href$="/action-items"]';

    $page = $this->signIn($alice, route('teams.show', [$workspace, $team], false));

    $page->assertScript($sidebarEntries, 'Dashboard / Sessions / Actions / Mood & ROTI / Games / Members / Templates / All teams')
        ->click('a:has-text("Open action items (1)")')
        ->assertPathIs($path)
        ->assertQueryStringHas('team', $team->id)
        ->assertSee('Rotate the keys')
        ->assertDontSee('Book the room');

    p09bChoose($page, p09bFilter('Team'), 'All teams');
    $page->assertQueryStringMissing('team')
        ->assertSee('Book the room');

    $this->toggleListboxOption($page, p09bFilter('Status'), 'Done');
    $this->toggleListboxOption($page, p09bFilter('Status'), 'To do');
    $this->toggleListboxOption($page, p09bFilter('Status'), 'In progress');
    $page->assertQueryStringHas('status', 'completed')
        ->assertSeeIn(p09bFilter('Status'), 'Done')
        ->assertSee('Archive the old board')
        ->assertDontSee('Rotate the keys');

    $this->toggleListboxOption($page, p09bFilter('Status'), 'To do');
    $this->toggleListboxOption($page, p09bFilter('Status'), 'In progress');
    $page->assertQueryStringHas('status', 'todo,doing,completed')
        ->assertSee('Rotate the keys');

    p09bChoose($page, p09bFilter('Assignee'), 'Me');
    $page->assertQueryStringHas('assignee', 'me')
        ->assertSeeIn(p09bFilter('Assignee'), 'Me')
        ->assertSee('Rotate the keys')
        ->assertDontSee('Book the room')
        ->assertDontSee('Archive the old board');

    p09bChoose($page, p09bFilter('Team'), 'Mobile');
    $page->assertQueryStringHas('team', $mobile->id)
        ->assertSee('Nothing matches these filters.');

    p09bChoose($page, p09bFilter('Assignee'), 'Anyone');
    $page->assertQueryStringMissing('assignee')
        ->assertSee('Book the room')
        ->assertScript("JSON.parse(localStorage.getItem('skrum.actionItemFilters.{$workspace->id}')).team", $mobile->id);

    $page->click($sidebarTeams)
        ->assertPathIs("/w/{$workspace->slug}")
        ->click($sidebarActionItems)
        ->assertPathIs($path)
        ->assertQueryStringHas('status', 'todo,doing,completed')
        ->assertQueryStringHas('team', $mobile->id)
        ->assertSee('Book the room')
        ->assertDontSee('Rotate the keys');
});

it('[P09b-02b] pins a deep-linked item that the filters hide as the linked action item and opens its details', function () {
    [$team, $alice] = p09bTeam();
    p09bFollowUp($team, $alice, 'Rotate the keys');
    $done = p09bFollowUp($team, $alice, 'Archive the old board', ['completed_at' => now()]);
    $path = p09bPagePath($team);
    $pinned = "[data-slot=\"linked-action-item\"] #action-item-{$done->id}";
    $sheet = '[data-slot="action-sheet"]';

    $page = $this->signIn($alice, "{$path}?item={$done->id}");

    $page->assertSee('Linked action item')
        ->assertPresent($pinned)
        ->assertPresent("{$pinned} [aria-label=\"Reopen\"]")
        ->assertSeeIn("{$sheet} h2", 'Archive the old board')
        ->assertSeeIn("{$sheet} [data-slot=\"item-comments\"]", 'No comments yet.')
        ->keys($sheet, 'Escape')
        ->assertNotPresent($sheet)
        ->assertSeeIn(p09bFilter('Status'), '2 of 3')
        ->assertSee('Rotate the keys')
        ->assertCount('tr[data-slot="action-row"]', 2);
});

it('[P09b-02c] reassigns a guest item to a team member from the page', function () {
    [$team, $alice, $bob] = p09bTeam();
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create([
        'team_id' => $team->id,
        'title' => 'Sprint 11',
        'completed_at' => now(),
    ]);
    p09bJoin($retro, $alice, facilitates: true);
    $carol = Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Carol Guest']);
    $item = ActionItem::factory()->assignedToGuest($carol)->create(['content' => 'Automate the release notes']);
    $row = p09bCard($item);
    $assignee = '[data-slot="action-sheet"] [aria-label="Assignee"]';

    $page = $this->signIn($alice, p09bPagePath($team));

    $page->assertSeeIn("{$row} [data-slot=\"action-row-owner\"]", 'Carol Guest (Guest)')
        ->assertSeeIn("{$row} [data-slot=\"action-row-source\"]", 'Sprint 11')
        ->click("{$row} [data-slot=\"action-row-title\"]")
        ->assertSeeIn($assignee, 'Carol Guest (Guest)')
        ->click($assignee)
        ->assertPresent('[role="option"][aria-disabled="true"]:has-text("Carol Guest (Guest)")')
        ->assertCount('[role="option"]:has-text("(Guest)")', 1)
        ->click('[role="option"]:has-text("Bob Stone")')
        ->assertNotPresent('[role="listbox"]')
        ->assertSeeIn($assignee, 'Bob Stone')
        ->assertSeeIn("{$row} [data-slot=\"action-row-owner\"]", 'Bob Stone');

    expect($item->fresh()->assignee_user_id)->toBe($bob->id)
        ->and($item->fresh()->assignee_participant_id)->toBeNull();
});

it('[P09b-03] shows an item created outside a retro to the other member live and carries it into the next retro', function () {
    [$team, $alice, $bob] = p09bTeam();
    $path = p09bPagePath($team);
    $dialog = '[role="dialog"]';

    $alicePage = $this->awaitRealtime($this->signIn($alice, $path));
    $bobPage = $this->awaitRealtime($this->signIn($bob, $path));

    $bobPage->assertSee('No open action items.');

    $alicePage->click('New action item')
        ->assertSeeIn("{$dialog} [aria-label=\"Team\"]", 'Platform')
        ->fill("{$dialog} [aria-label=\"Add an action item…\"]", 'Renew the TLS certificate')
        ->click("{$dialog} button[type=\"submit\"]")
        ->assertNotPresent($dialog)
        ->assertSee('Renew the TLS certificate');

    $bobPage->assertSee('Renew the TLS certificate');

    $item = ActionItem::query()->where('content', 'Renew the TLS certificate')->sole();

    $bobPage->assertScript(p09bCardShows($item, 'Added outside a retro'), true)
        ->assertDontSee('No open action items.')
        ->click(p09bTitle($item))
        ->assertSeeIn('[data-slot="action-sheet"]', 'Created by')
        ->assertSeeIn('[data-slot="action-sheet"]', 'Alice Martin');

    expect($item->retro_id)->toBeNull()
        ->and($item->team_id)->toBe($team->id)
        ->and($item->created_by_user_id)->toBe($alice->id);

    $retro = Retro::factory()->create([
        'team_id' => $team->id,
        'title' => 'Sprint 13',
        'created_at' => now()->addMinute(),
    ]);
    p09bJoin($retro, $alice, facilitates: true);

    $alicePage->navigate("/retros/{$retro->id}");

    $this->awaitRealtime($alicePage)
        ->assertSeeIn($dialog, 'Previous action items')
        ->assertSeeIn($dialog, 'Added outside a retro')
        ->assertSeeIn($dialog, 'Renew the TLS certificate');
});

it('[P09b-04] adds, reorders and ticks sub-tasks live and limits the assignee to ticking', function () {
    [$team, $alice, $bob] = p09bTeam();
    $item = p09bFollowUp($team, $alice, 'Prepare the release', ['assignee_user_id' => $bob->id]);
    $path = p09bPagePath($team);
    $sheet = '[data-slot="action-sheet"]';
    $add = "{$sheet} [aria-label=\"Add a sub-task\"]";
    $list = "{$sheet} ul[aria-label=\"Sub-tasks\"]";
    $progress = "{$sheet} [data-slot=\"action-sheet-subtasks\"]";
    $subtask = fn (string $content): string => "{$list} [role=\"checkbox\"][aria-label=\"{$content}\"]";
    $order = "Array.from(document.querySelectorAll('[data-slot=\"action-sheet\"] ul[aria-label=\"Sub-tasks\"] [role=\"checkbox\"]')).map((box) => box.getAttribute('aria-label')).join(' / ')";
    $reordered = 'Draft the notes / Publish the runbook / Tag the build';

    $alicePage = $this->awaitRealtime($this->signIn($alice, $path));
    $bobPage = $this->awaitRealtime($this->signIn($bob, $path));

    $alicePage->click(p09bTitle($item))
        ->assertVisible($add);
    $bobPage->click(p09bTitle($item))
        ->assertSeeIn("{$sheet} h2", 'Prepare the release');

    foreach (['Draft the notes', 'Tag the build', 'Publish the runbook'] as $content) {
        $alicePage->fill($add, $content)
            ->keys($add, 'Enter')
            ->assertPresent($subtask($content))
            ->assertValue($add, '');
    }

    $alicePage->click("{$list} > li:has([aria-label=\"Publish the runbook\"]) [aria-label=\"Move up\"]")
        ->assertScript($order, $reordered)
        ->click($subtask('Draft the notes'))
        ->assertAttribute($subtask('Draft the notes'), 'aria-checked', 'true')
        ->assertSeeIn($progress, '1/3');

    $bobPage->assertScript($order, $reordered)
        ->assertSeeIn($progress, '1/3')
        ->assertAttribute($subtask('Draft the notes'), 'aria-checked', 'true')
        ->assertNotPresent($add)
        ->assertNotPresent("{$sheet} [aria-label=\"Move up\"]")
        ->assertNotPresent("{$sheet} [aria-label=\"Edit sub-task\"]")
        ->assertNotPresent("{$sheet} [aria-label=\"Delete sub-task\"]")
        ->assertNotPresent("{$sheet} button[aria-label=\"Edit action item\"]")
        ->click($subtask('Tag the build'))
        ->assertAttribute($subtask('Tag the build'), 'aria-checked', 'true');

    $alicePage->assertSeeIn($progress, '2/3')
        ->assertAttribute($subtask('Tag the build'), 'aria-checked', 'true');

    expect($item->subtasks()->pluck('content')->all())->toBe(['Draft the notes', 'Publish the runbook', 'Tag the build'])
        ->and($item->subtasks()->whereNotNull('completed_at')->count())->toBe(2)
        ->and($item->fresh()->completed_at)->toBeNull();
});

it('[P09b-05] creates exactly one next occurrence when a weekly item is completed', function () {
    [$team, $alice] = p09bTeam();
    $first = p09bFollowUp($team, $alice, 'Review the dashboards');
    ActionItemSubtask::factory()->completed()->create(['action_item_id' => $first->id, 'content' => 'Check the alerts', 'position' => 0]);
    ActionItemSubtask::factory()->create(['action_item_id' => $first->id, 'content' => 'Check the latency', 'position' => 1]);
    $dueOn = ActionItem::today()->addDay();
    $firstCard = p09bCard($first);
    $sheet = '[data-slot="action-sheet"]';
    $repeat = "{$sheet} [aria-label=\"Repeat\"]";
    $markAsDone = "{$sheet} button:has-text(\"Mark as done\")";

    $page = $this->signIn($alice, p09bPagePath($team));

    $page->click(p09bTitle($first))
        ->assertDisabled($repeat)
        ->fill("{$sheet} [aria-label=\"Due date\"]", $dueOn->toDateString())
        ->click("{$sheet} h2")
        ->assertEnabled($repeat)
        ->assertAttribute("{$firstCard} [data-slot=\"action-row-due\"]", 'data-due', 'soon');

    p09bChoose($page, $repeat, 'Weekly');

    $page->assertPresent("{$firstCard} [data-slot=\"action-row-recurrence\"][aria-label=\"Repeats weekly\"]")
        ->click($markAsDone)
        ->assertNotPresent($firstCard)
        ->keys($sheet, 'Escape')
        ->assertNotPresent($sheet);

    $next = ActionItem::query()->where('previous_occurrence_id', $first->id)->sole();
    $nextCard = p09bCard($next);

    $page->assertSeeIn("{$nextCard} [data-slot=\"action-row-source\"]", 'Added outside a retro')
        ->assertPresent("{$nextCard} [data-slot=\"action-row-recurrence\"][aria-label=\"Repeats weekly\"]")
        ->click(p09bTitle($next))
        ->assertSee('Follows up the item completed on')
        ->assertSeeIn("{$sheet} [data-slot=\"action-sheet-subtasks\"]", '0/2')
        ->assertAttribute("{$sheet} [role=\"checkbox\"][aria-label=\"Check the alerts\"]", 'aria-checked', 'false')
        ->assertPresent($markAsDone)
        ->keys($sheet, 'Escape')
        ->assertNotPresent($sheet);

    expect($next->due_on?->toDateString())->toBe($dueOn->addWeek()->toDateString())
        ->and($next->retro_id)->toBeNull()
        ->and($next->completed_at)->toBeNull()
        ->and($first->fresh()->completed_at)->not->toBeNull();

    $this->toggleListboxOption($page, p09bFilter('Status'), 'Done');

    $page->assertQueryStringHas('status', 'todo,doing,completed')
        ->click("{$firstCard} [aria-label=\"Reopen\"]")
        ->assertPresent("{$firstCard} [aria-label=\"Mark as in progress\"]")
        ->click(p09bTitle($first))
        ->click($markAsDone)
        ->assertPresent("{$firstCard} [aria-label=\"Reopen\"]")
        ->keys($sheet, 'Escape')
        ->assertNotPresent($sheet);

    expect(ActionItem::query()->where('previous_occurrence_id', $first->id)->count())->toBe(1)
        ->and(ActionItem::query()->count())->toBe(2);

    $page->click(p09bTitle($next));
    p09bChoose($page, $repeat, 'Does not repeat');

    $page->assertNotPresent("{$nextCard} [data-slot=\"action-row-recurrence\"]")
        ->click($markAsDone)
        ->assertPresent("{$nextCard} [aria-label=\"Reopen\"]");

    expect($next->fresh()->recurrence)->toBeNull()
        ->and($next->fresh()->completed_at)->not->toBeNull()
        ->and(ActionItem::query()->count())->toBe(2);
});

it('[P09b-06a] sends one digest in the assignee language and one bell entry per item, once per item, kind and due date', function () {
    Notification::fake();
    config(['skrum.action_item_reminders.enabled' => true]);
    [$team, $alice, $bob] = p09bTeam();
    $bob->update(['locale' => 'fr']);
    $today = ActionItem::today();
    $dueToday = p09bFollowUp($team, $alice, 'Book the room', [
        'assignee_user_id' => $bob->id,
        'due_on' => $today->toDateString(),
    ]);
    $overdue = p09bFollowUp($team, $alice, 'Rotate the keys', [
        'assignee_user_id' => $bob->id,
        'due_on' => $today->subDays(3)->toDateString(),
    ]);

    $this->artisan('action-items:send-reminders')
        ->expectsOutput("Reminding user `{$bob->id}` about 2 items…")
        ->expectsOutput('Sent 2 reminders to 1 users.')
        ->assertSuccessful();

    Notification::assertSentTo(
        $bob,
        ActionItemReminderDigestNotification::class,
        function (ActionItemReminderDigestNotification $notification, array $channels, object $notifiable, ?string $locale) use ($overdue, $dueToday): bool {
            $html = (string) $notification->toMail($notifiable)->render();

            return $channels === ['mail']
                && $locale === 'fr'
                && $notification->reminders === [
                    ['actionItemId' => $overdue->id, 'kind' => ActionItemReminderKind::Overdue->value],
                    ['actionItemId' => $dueToday->id, 'kind' => ActionItemReminderKind::DueSoon->value],
                ]
                && strpos($html, 'Rotate the keys') < strpos($html, 'Book the room');
        },
    );
    Notification::assertSentToTimes($bob, ActionItemReminderDigestNotification::class, 1);
    Notification::assertSentToTimes($bob, ActionItemReminderNotification::class, 2);
    Notification::assertNothingSentTo($alice);

    $this->artisan('action-items:send-reminders')
        ->expectsOutput('Sent 0 reminders to 0 users.')
        ->assertSuccessful();

    Notification::assertSentToTimes($bob, ActionItemReminderDigestNotification::class, 1);
    Notification::assertSentToTimes($bob, ActionItemReminderNotification::class, 2);

    $this->travel(2)->days();

    $this->artisan('action-items:send-reminders')
        ->expectsOutput("Reminding user `{$bob->id}` about 1 items…")
        ->expectsOutput('Sent 1 reminders to 1 users.')
        ->assertSuccessful();

    Notification::assertSentToTimes($bob, ActionItemReminderDigestNotification::class, 2);
    Notification::assertSentToTimes($bob, ActionItemReminderNotification::class, 3);

    expect(ActionItemReminder::query()->where('action_item_id', $dueToday->id)->count())->toBe(2)
        ->and(ActionItemReminder::query()->where('action_item_id', $overdue->id)->count())->toBe(1);
});

it('[P09b-06b] shows the reminders in the bell and the overdue count in the sidebar, and opens the item from a bell entry', function () {
    Mail::fake();
    config(['skrum.action_item_reminders.enabled' => true]);
    [$team, $alice, $bob] = p09bTeam();
    $today = ActionItem::today();
    p09bFollowUp($team, $alice, 'Book the room', [
        'assignee_user_id' => $bob->id,
        'due_on' => $today->toDateString(),
    ]);
    $overdue = p09bFollowUp($team, $alice, 'Rotate the keys', [
        'assignee_user_id' => $bob->id,
        'due_on' => $today->subDays(3)->toDateString(),
    ]);
    $path = p09bPagePath($team);
    $badge = '[data-sidebar="menu-badge"]';

    $page = $this->signIn($bob, $path);

    $page->assertSee('Rotate the keys')
        ->assertPresent('[aria-label="Notifications"]')
        ->assertSeeIn($badge, '1 overdue')
        ->assertPresent('a[data-sidebar="menu-button"][aria-label="Actions, 1 overdue"]');

    $this->artisan('action-items:send-reminders')
        ->expectsOutput('Sent 2 reminders to 1 users.')
        ->assertSuccessful();

    $page->navigate($path)
        ->assertSeeIn('[aria-label="Notifications, 2 unread"]', '2')
        ->assertSeeIn($badge, '1 overdue')
        ->click('[aria-label="Notifications, 2 unread"]')
        ->assertSeeIn('[role="dialog"] [data-slot="notifications-panel"]', 'Overdue action: Rotate the keys')
        ->assertSeeIn('[role="dialog"] [data-slot="notifications-panel"]', 'Due today: Book the room')
        ->click('[role="dialog"] a:has-text("Overdue action: Rotate the keys")')
        ->assertQueryStringHas('item', $overdue->id)
        ->assertPathIs($path)
        ->assertSeeIn('[data-slot="action-sheet"] h2', 'Rotate the keys')
        ->assertPresent('[aria-label="Notifications, 1 unread"]');

    expect($bob->notifications()->count())->toBe(2)
        ->and($bob->unreadNotifications()->count())->toBe(1);

    $this->artisan('action-items:send-reminders')
        ->expectsOutput('Sent 0 reminders to 0 users.')
        ->assertSuccessful();

    $page->navigate($path)
        ->assertSee('Rotate the keys')
        ->assertPresent('[aria-label="Notifications, 1 unread"]');

    expect($bob->notifications()->count())->toBe(2);
});

it('[P09b-07] stops the e-mail digest after opting out in the notification settings and keeps the bell entry', function () {
    config([
        'skrum.action_item_reminders.enabled' => true,
        'skrum.action_item_reminders.time' => '08:00',
    ]);
    [$team, , $bob] = p09bTeam();
    $today = ActionItem::today();
    $tomorrow = $today->addDay();
    $tomorrowLabel = p09bDueLabel($tomorrow);
    $item = p09bFollowUp($team, $bob, 'Book the room', [
        'assignee_user_id' => $bob->id,
        'due_on' => $today->toDateString(),
    ]);
    ActionItemReminder::query()->create([
        'action_item_id' => $item->id,
        'user_id' => $bob->id,
        'kind' => ActionItemReminderKind::DueSoon,
        'due_on' => $today->toDateString(),
        'sent_at' => now(),
    ]);
    $path = p09bPagePath($team);
    $byEmail = '#action-item-reminders-by-email';
    $dueDate = '[data-slot="action-sheet"] [aria-label="Due date"]';

    $page = $this->signIn($bob, '/settings/notifications');

    $page->assertSee('Reminders are sent at 08:00 for action items assigned to you.')
        ->assertAttribute($byEmail, 'aria-checked', 'true')
        ->assertAttribute('#action-item-reminders-in-app', 'aria-checked', 'true')
        ->click($byEmail)
        ->assertAttribute($byEmail, 'aria-checked', 'false')
        ->click('[data-slot="notifications-card"] button:has-text("Save")')
        ->assertSee('Notification settings saved.');

    expect($bob->fresh()->action_item_reminders_by_email)->toBeFalse()
        ->and($bob->fresh()->action_item_reminders_in_app)->toBeTrue();

    $page->navigate($path)
        ->assertPresent('[aria-label="Notifications"]')
        ->click(p09bTitle($item))
        ->fill($dueDate, $tomorrow->toDateString())
        ->click('[data-slot="action-sheet"] h2')
        ->assertAttribute("#action-item-{$item->id} [data-slot=\"action-row-due\"]", 'data-due', 'soon')
        ->assertScript("document.querySelector('#action-item-{$item->id} [data-slot=\"action-row-due\"]').innerText.includes('{$tomorrowLabel}')", true);

    expect($item->fresh()->due_on?->toDateString())->toBe($tomorrow->toDateString());

    Event::fake([NotificationSent::class]);

    $this->artisan('action-items:send-reminders')
        ->expectsOutput('Sent 1 reminders to 1 users.')
        ->assertSuccessful();

    Event::assertDispatched(fn (NotificationSent $event): bool => $event->channel === 'database' && $event->notifiable->is($bob));
    Event::assertNotDispatched(
        NotificationSent::class,
        fn (NotificationSent $event): bool => $event->channel === 'mail',
    );

    $page->navigate($path)
        ->click('[aria-label="Notifications, 1 unread"]')
        ->assertSeeIn('[role="dialog"] [data-slot="notifications-panel"]', 'Due tomorrow: Book the room');

    expect($bob->notifications()->count())->toBe(1);
});

it('[P09b-08] marks the bell entry of a reminded item as read when the item is completed', function () {
    Mail::fake();
    config(['skrum.action_item_reminders.enabled' => true]);
    [$team, , $bob] = p09bTeam();
    $item = p09bFollowUp($team, $bob, 'Book the room', [
        'assignee_user_id' => $bob->id,
        'due_on' => ActionItem::today()->toDateString(),
    ]);

    $this->artisan('action-items:send-reminders')
        ->expectsOutput('Sent 1 reminders to 1 users.')
        ->assertSuccessful();

    $page = $this->signIn($bob, p09bPagePath($team));

    $page->assertPresent('[aria-label="Notifications, 1 unread"]')
        ->click(p09bTitle($item))
        ->click('[data-slot="action-sheet"] button:has-text("Mark as done")')
        ->assertPresent('[data-slot="action-sheet"] button:has-text("Reopen")')
        ->keys('[data-slot="action-sheet"]', 'Escape')
        ->assertNotPresent('[data-slot="action-sheet"]')
        ->assertPresent('[aria-label="Notifications"]')
        ->assertNotPresent('[aria-label="Notifications, 1 unread"]')
        ->click('[aria-label="Notifications"]')
        ->assertSeeIn('[role="dialog"] [data-slot="notifications-panel"]', 'Due today: Book the room')
        ->assertNotPresent('[data-slot="notifications-panel"] [data-unread="true"]');

    expect($bob->unreadNotifications()->count())->toBe(0)
        ->and($bob->notifications()->count())->toBe(1)
        ->and($item->fresh()->completed_at)->not->toBeNull();
});
