<?php

use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\ActionItemSubtask;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonImmutable;

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
    return "div.grid > [aria-label=\"{$label}\"]";
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

    $bobPage->assertDisabled("{$card} [aria-label=\"Mark as done\"]");

    $alicePage->click("{$card} [aria-label=\"Mark as done\"]")
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

    $carolPage->assertSeeIn('header > h1', 'Sprint 12');

    $alicePage->click("{$card} [aria-label=\"Mark as done\"]")
        ->assertPresent("{$card} [aria-label=\"Reopen\"]")
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

    $page->assertScript($sidebarEntries, 'Teams / Action items / Templates')
        ->click('a:has-text("Open action items (1)")')
        ->assertPathIs($path)
        ->assertQueryStringHas('team', $team->id)
        ->assertSee('Rotate the keys')
        ->assertDontSee('Book the room');

    p09bChoose($page, p09bFilter('Team'), 'All teams');
    $page->assertQueryStringMissing('team')
        ->assertSee('Book the room');

    p09bChoose($page, p09bFilter('Status'), 'Completed');
    $page->assertQueryStringHas('status', 'completed')
        ->assertSeeIn(p09bFilter('Status'), 'Completed')
        ->assertSee('Archive the old board')
        ->assertDontSee('Rotate the keys');

    p09bChoose($page, p09bFilter('Status'), 'All');
    $page->assertQueryStringHas('status', 'all')
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
        ->assertQueryStringHas('status', 'all')
        ->assertQueryStringHas('team', $mobile->id)
        ->assertSee('Book the room')
        ->assertDontSee('Rotate the keys');
});

it('[P09b-02b] pins a deep-linked item that the filters hide as the linked action item, expanded', function () {
    [$team, $alice] = p09bTeam();
    p09bFollowUp($team, $alice, 'Rotate the keys');
    $done = p09bFollowUp($team, $alice, 'Archive the old board', ['completed_at' => now()]);
    $path = p09bPagePath($team);
    $pinned = "section:has-text(\"Linked action item\") #action-item-{$done->id}";

    $page = $this->signIn($alice, "{$path}?item={$done->id}");

    $page->assertSee('Linked action item')
        ->assertPresent($pinned)
        ->assertPresent("{$pinned} [aria-label=\"Reopen\"]")
        ->assertPresent("{$pinned} button[aria-expanded=\"true\"]")
        ->assertSeeIn("#action-item-{$done->id}-comments", 'No comments yet.')
        ->assertSeeIn(p09bFilter('Status'), 'Open')
        ->assertSee('Rotate the keys')
        ->assertCount('li[id^="action-item-"]', 2);
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
    $assignee = "#action-item-{$item->id} [aria-label=\"Assignee\"]";

    $page = $this->signIn($alice, p09bPagePath($team));

    $page->assertSeeIn($assignee, 'Carol Guest (guest)')
        ->assertScript(p09bCardShows($item, 'Sprint 11'), true)
        ->click($assignee)
        ->assertPresent('[role="option"][aria-disabled="true"]:has-text("Carol Guest (guest)")')
        ->assertCount('[role="option"]:has-text("(guest)")', 1)
        ->click('[role="option"]:has-text("Bob Stone")')
        ->assertNotPresent('[role="listbox"]')
        ->assertSeeIn($assignee, 'Bob Stone');

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
        ->assertScript(p09bCardShows($item, 'Alice Martin'), true)
        ->assertDontSee('No open action items.');

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
    $card = p09bCard($item);
    $add = "{$card} [aria-label=\"Add a sub-task\"]";
    $list = "{$card} ul[aria-label=\"Sub-tasks\"]";
    $subtask = fn (string $content): string => "{$list} [role=\"checkbox\"][aria-label=\"{$content}\"]";
    $order = "Array.from(document.querySelectorAll('#action-item-{$item->id} ul[aria-label=\"Sub-tasks\"] [role=\"checkbox\"]')).map((box) => box.getAttribute('aria-label')).join(' / ')";
    $reordered = 'Draft the notes / Publish the runbook / Tag the build';

    $alicePage = $this->awaitRealtime($this->signIn($alice, $path));
    $bobPage = $this->awaitRealtime($this->signIn($bob, $path));

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
        ->assertSeeIn("{$card} [aria-label=\"1 of 3 sub-tasks done\"]", '1/3');

    $bobPage->assertScript($order, $reordered)
        ->assertSeeIn("{$card} [aria-label=\"1 of 3 sub-tasks done\"]", '1/3')
        ->assertAttribute($subtask('Draft the notes'), 'aria-checked', 'true')
        ->assertNotPresent($add)
        ->assertNotPresent("{$card} [aria-label=\"Move up\"]")
        ->assertNotPresent("{$card} [aria-label=\"Edit sub-task\"]")
        ->assertNotPresent("{$card} [aria-label=\"Delete sub-task\"]")
        ->assertNotPresent("{$card} button[aria-label=\"Edit action item\"]")
        ->click($subtask('Tag the build'))
        ->assertAttribute($subtask('Tag the build'), 'aria-checked', 'true');

    $alicePage->assertSeeIn("{$card} [aria-label=\"2 of 3 sub-tasks done\"]", '2/3')
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
    $dueLabel = p09bDueLabel($dueOn);
    $nextDueLabel = p09bDueLabel($dueOn->addWeek());
    $firstCard = p09bCard($first);
    $dueDate = "{$firstCard} [aria-label=\"Due date\"]";

    $page = $this->signIn($alice, p09bPagePath($team));

    $page->assertDisabled("{$firstCard} [aria-label=\"Repeat\"]")
        ->fill($dueDate, $dueOn->toDateString())
        ->click('Follow-ups of every team you can see')
        ->assertScript(p09bCardShows($first, "Due {$dueLabel}"), true);

    p09bChoose($page, "{$firstCard} [aria-label=\"Repeat\"]", 'Weekly');

    $page->assertScript(p09bCardShows($first, 'Repeats weekly'), true)
        ->click("{$firstCard} [aria-label=\"Mark as done\"]")
        ->assertSee('Follows up the item completed on');

    $next = ActionItem::query()->where('previous_occurrence_id', $first->id)->sole();
    $nextCard = p09bCard($next);

    $page->assertScript(p09bCardShows($next, 'Added outside a retro'), true)
        ->assertScript(p09bCardShows($next, 'Repeats weekly'), true)
        ->assertScript(p09bCardShows($next, "Due {$nextDueLabel}"), true)
        ->assertSeeIn("{$nextCard} [aria-label=\"0 of 2 sub-tasks done\"]", '0/2')
        ->assertAttribute("{$nextCard} [role=\"checkbox\"][aria-label=\"Check the alerts\"]", 'aria-checked', 'false')
        ->assertPresent("{$nextCard} [aria-label=\"Mark as done\"]")
        ->assertNotPresent($firstCard);

    expect($next->due_on?->toDateString())->toBe($dueOn->addWeek()->toDateString())
        ->and($next->retro_id)->toBeNull()
        ->and($next->completed_at)->toBeNull()
        ->and($first->fresh()->completed_at)->not->toBeNull();

    p09bChoose($page, p09bFilter('Status'), 'All');

    $page->assertQueryStringHas('status', 'all')
        ->click("{$firstCard} [aria-label=\"Reopen\"]")
        ->assertPresent("{$firstCard} [aria-label=\"Mark as done\"]")
        ->click("{$firstCard} [aria-label=\"Mark as done\"]")
        ->assertPresent("{$firstCard} [aria-label=\"Reopen\"]");

    expect(ActionItem::query()->where('previous_occurrence_id', $first->id)->count())->toBe(1)
        ->and(ActionItem::query()->count())->toBe(2);

    p09bChoose($page, "{$nextCard} [aria-label=\"Repeat\"]", 'Does not repeat');

    $page->assertScript(p09bCardShows($next, 'Repeats weekly'), false)
        ->click("{$nextCard} [aria-label=\"Mark as done\"]")
        ->assertPresent("{$nextCard} [aria-label=\"Reopen\"]");

    expect($next->fresh()->recurrence)->toBeNull()
        ->and($next->fresh()->completed_at)->not->toBeNull()
        ->and(ActionItem::query()->count())->toBe(2);
});
