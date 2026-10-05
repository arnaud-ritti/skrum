<?php

use App\Enums\RetroPhase;
use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Notifications\RetroResultsNotification;

const DashboardSearchNotificationsPanel = '[data-slot="notifications-panel"]';

const DashboardSearchNotificationsResults = '[data-slot="command-group"] [data-slot="command-item"]';

/**
 * Malik Kone, a member of Atlas in Nordlys, who also belongs to Zenith and its team Borealis.
 *
 * @return array{
 *     nordlys: Workspace,
 *     atlas: Team,
 *     zenith: Workspace,
 *     borealis: Team,
 *     member: User
 * }
 */
function dashboardSearchNotificationsMalik(): array
{
    $nordlys = Workspace::factory()->create(['name' => 'Nordlys']);
    $atlas = Team::factory()->for($nordlys)->create(['name' => 'Atlas']);
    $zenith = Workspace::factory()->create(['name' => 'Zenith']);
    $borealis = Team::factory()->for($zenith)->create(['name' => 'Borealis']);
    $member = User::factory()->create(['name' => 'Malik Kone', 'locale' => 'en']);

    foreach ([[$nordlys, $atlas], [$zenith, $borealis]] as [$workspace, $team]) {
        $workspace->members()->attach($member, ['role' => WorkspaceRole::Member->value]);
        $team->members()->attach($member, ['role' => TeamRole::Member->value]);
    }

    return ['nordlys' => $nordlys, 'atlas' => $atlas, 'zenith' => $zenith, 'borealis' => $borealis, 'member' => $member];
}

function dashboardSearchNotificationsResult(string $kind, string $id): string
{
    return DashboardSearchNotificationsResults."[data-value=\"{$kind}-{$id}\"]";
}

it('lands on the team of the current workspace from /dashboard, on a desktop and on a phone with the tab bar', function () {
    ['zenith' => $zenith, 'borealis' => $borealis, 'member' => $member] = dashboardSearchNotificationsMalik();
    $member->forceFill(['current_workspace_id' => $zenith->id])->save();
    $teamPath = route('teams.show', [$zenith, $borealis], false);

    $page = $this->signIn($member, '/dashboard');

    $page->assertPathIs($teamPath)
        ->assertSeeIn('[data-slot="team-header"] h1', 'Borealis')
        ->assertSeeIn('[data-sidebar="header"]', 'Zenith')
        ->assertScript('document.title.trim().length > 0', true);

    $page->resize(390, 844)
        ->navigate('/dashboard')
        ->assertPathIs($teamPath)
        ->assertVisible('nav[aria-label="Tab bar"]')
        ->assertSeeIn('nav[aria-label="Tab bar"] a[aria-current="page"]', 'Home');

    expect($this->overflowingElements($page))->toBe([]);
});

it('finds the sessions of the viewer\'s team in the search palette, hides those of a team they are not in, and opens a result', function () {
    ['nordlys' => $nordlys, 'atlas' => $atlas, 'member' => $member] = dashboardSearchNotificationsMalik();
    $member->forceFill(['current_workspace_id' => $nordlys->id])->save();
    $checkout = Team::factory()->for($nordlys)->create(['name' => 'Checkout']);
    $retro = Retro::factory()->for($atlas)->inPhase(RetroPhase::Completed)->create(['title' => 'Refunds retro']);
    $poker = PokerGame::factory()->for($atlas)->create(['title' => 'Refunds refinement']);
    $hidden = Retro::factory()->for($checkout)->inPhase(RetroPhase::Completed)->create(['title' => 'Refunds rollout']);

    $page = $this->signIn($member, route('teams.show', [$nordlys, $atlas], false));

    $page->click('@command-menu-button')
        ->fill('[data-slot="command-input"]', 'Refunds')
        ->assertPresent(dashboardSearchNotificationsResult('retro', $retro->id))
        ->assertPresent(dashboardSearchNotificationsResult('poker', $poker->id))
        ->assertSeeIn(dashboardSearchNotificationsResult('retro', $retro->id), 'Atlas')
        ->assertNotPresent(dashboardSearchNotificationsResult('retro', $hidden->id))
        ->assertDontSeeIn('[role="dialog"]', 'Refunds rollout')
        ->click(dashboardSearchNotificationsResult('poker', $poker->id))
        ->assertPathIs("/poker/{$poker->id}");
});

it('shows the notifications in the bell, marks one read when opened and all read from the panel, and keeps them read after a reload', function () {
    ['nordlys' => $nordlys, 'atlas' => $atlas, 'member' => $member] = dashboardSearchNotificationsMalik();
    $member->forceFill(['current_workspace_id' => $nordlys->id])->save();
    $sprint41 = Retro::factory()->for($atlas)->inPhase(RetroPhase::Completed)->create(['title' => 'Sprint 41 retro']);
    $sprint42 = Retro::factory()->for($atlas)->inPhase(RetroPhase::Completed)->create(['title' => 'Sprint 42 retro']);
    $member->notify(new RetroResultsNotification($sprint41->id));
    $member->notify(new RetroResultsNotification($sprint42->id));
    $teamPath = route('teams.show', [$nordlys, $atlas], false);

    $page = $this->signIn($member, $teamPath);

    $page->assertSeeIn('[aria-label="Notifications, 2 unread"]', '2')
        ->click('[aria-label="Notifications, 2 unread"]')
        ->assertCount(DashboardSearchNotificationsPanel.' [data-slot="notification-item"][data-unread="true"]', 2)
        ->assertSeeIn(DashboardSearchNotificationsPanel, 'The recap of Sprint 41 retro is ready')
        ->click(DashboardSearchNotificationsPanel.' [data-slot="notification-item"]:has-text("Sprint 42 retro") a[data-notification-link]')
        ->assertPathIs("/retros/{$sprint42->id}");

    expect($member->unreadNotifications()->count())->toBe(1);

    $page->navigate($teamPath)
        ->click('[aria-label="Notifications, 1 unread"]')
        ->assertCount(DashboardSearchNotificationsPanel.' [data-slot="notification-item"][data-unread="true"]', 1)
        ->click(DashboardSearchNotificationsPanel.' button:has-text("Mark all as read")')
        ->assertNotPresent(DashboardSearchNotificationsPanel.' [data-slot="notification-item"][data-unread="true"]')
        ->assertPresent('[aria-label="Notifications"]')
        ->assertNotPresent('[data-slot="notifications-badge"]');

    expect($member->unreadNotifications()->count())->toBe(0)
        ->and($member->notifications()->count())->toBe(2);

    $page->navigate($teamPath)
        ->assertPresent('[aria-label="Notifications"]')
        ->assertNotPresent('[data-slot="notifications-badge"]')
        ->click('[aria-label="Notifications"]')
        ->assertCount(DashboardSearchNotificationsPanel.' [data-slot="notification-item"]', 2)
        ->assertNotPresent(DashboardSearchNotificationsPanel.' [data-slot="notification-item"][data-unread="true"]');
});

it('opens the bell as a drawer on a phone, without horizontal scroll', function () {
    ['nordlys' => $nordlys, 'atlas' => $atlas, 'member' => $member] = dashboardSearchNotificationsMalik();
    $retro = Retro::factory()->for($atlas)->inPhase(RetroPhase::Completed)->create(['title' => 'Sprint 42 retro']);
    $member->notify(new RetroResultsNotification($retro->id));

    $page = $this->signIn($member, route('teams.show', [$nordlys, $atlas], false))->resize(390, 844);

    $page->navigate(route('teams.show', [$nordlys, $atlas], false))
        ->click('[aria-label="Notifications, 1 unread"]')
        ->assertSeeIn('[role="dialog"] '.DashboardSearchNotificationsPanel, 'The recap of Sprint 42 retro is ready');

    expect($this->overflowingElements($page))->toBe([]);
});
