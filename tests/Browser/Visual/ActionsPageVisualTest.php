<?php

use App\Enums\ActionItemPriority;
use App\Enums\ActionItemRecurrence;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\ActionItem;
use App\Models\ActionItemExternalLink;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;

it('[P18e-05-11] renders the action items page of a manager without overflow', function () {
    config(['app.name' => 'Skrum']);

    $workspace = Workspace::factory()->create(['name' => 'Nordlys']);
    $team = Team::factory()->for($workspace)->create(['name' => 'Atlas']);
    $admin = User::factory()->create([
        'id' => '0199a000-0000-7000-8000-000000000051',
        'name' => 'Camille Roux',
        'email' => 'camille@example.com',
    ]);
    $malik = User::factory()->create([
        'id' => '0199a000-0000-7000-8000-000000000052',
        'name' => 'Malik Kone',
    ]);
    $workspace->members()->attach($admin, ['role' => WorkspaceRole::Admin->value]);
    $workspace->members()->attach($malik, ['role' => WorkspaceRole::Member->value]);
    $team->members()->attach([$admin->id, $malik->id]);

    $retro = Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create([
        'title' => 'Sprint 42 retrospective',
        'completed_at' => now(),
    ]);

    $late = ActionItem::factory()->overdue()->assignedTo($malik)->priority(ActionItemPriority::High)->create([
        'retro_id' => $retro->id,
        'content' => 'Fix the flaky end-to-end tests of the checkout',
    ]);
    ActionItemExternalLink::factory()->create(['action_item_id' => $late->id, 'external_key' => 'ATLAS-1287']);

    ActionItem::factory()->assignedTo($admin)->recurring(ActionItemRecurrence::Weekly)->withSubtasks(3)->create([
        'retro_id' => $retro->id,
        'content' => 'Rotate the on-call handover every Monday',
        'due_on' => ActionItem::today()->addDays(2)->toDateString(),
    ]);
    ActionItem::factory()->assignedTo($admin)->priority(ActionItemPriority::High)->create([
        'retro_id' => $retro->id,
        'content' => 'Rewrite the deployment checklist so that every release names an owner, a rollback plan, a communication channel and the dashboards to watch, then review it with the three squads before the end of the quarter',
        'due_on' => ActionItem::today()->addDays(30)->toDateString(),
    ]);
    ActionItem::factory()->withoutRetro($team, $admin)->priority(ActionItemPriority::Low)->create([
        'content' => 'Book the room for the quarterly planning',
    ]);
    ActionItem::factory()->withoutRetro($team, $admin)->assignedTo($malik)->completed()->create([
        'content' => 'Archive the old release notes',
    ]);

    RateLimiter::for('login', fn (): Limit => Limit::none());

    $path = route('workspaces.actionItems.index', ['workspace' => $workspace, 'team' => $team->id], false);

    $this->captureVisuals('actions-page', $path, function (string $path, array $options, int $width) use ($admin) {
        User::query()->whereKey($admin->id)->update(['locale' => str_starts_with($options['locale'], 'fr') ? 'fr' : 'en']);

        $page = visit('/login', $options);

        $page->fill('#email', $admin->email)
            ->fill('#password', 'password')
            ->click('@login-button')
            ->assertPathIsNot('/login');

        $page->navigate($path)
            ->resize($width, 900)
            ->assertCount('[data-realtime]', 1)
            ->assertPresent('header [data-slot="new-action-item"]')
            ->assertPresent('header [data-slot="export-action-items"]')
            ->assertPresent('[data-slot="action-items-header"] [data-slot="action-items-counts"]')
            ->assertPresent('[role="toolbar"]')
            ->assertNotPresent('[data-slot="action-sheet"]')
            ->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);

        if ($width < 1280) {
            return $page
                ->assertPresent('[data-slot="action-item-filters-phone"]')
                ->assertNotPresent('[data-slot="action-items-table"]')
                ->assertCount('[data-slot="action-items-list"] [role="list"] > [id^="action-item-"]', 4);
        }

        return $page
            ->assertCount('[data-slot="action-item-filters"] [data-slot="action-filter"]', 6)
            ->assertAttribute('[data-slot="action-filter"]:first-child', 'data-active', 'true')
            ->assertCount('[data-slot="action-items-table"] tr[data-slot="action-row"]', 4)
            ->assertCount('[data-slot="action-items-table"] tr[data-slot="action-row"][data-status="open"]', 4)
            ->assertCount('[data-slot="action-row-ticket"] a', 1);
    });
});

it('[P18e-05-12] renders the states of the action items page on the bench without overflow', function () {
    $this->captureVisuals(
        'actions-index',
        '/dev/design-system/actions-index',
        function (string $path, array $options, int $width) {
            $page = visit($path, $options)
                ->resize($width, 900)
                ->assertPresent('[data-bench-section="actions-index"]')
                ->assertCount('[data-state="page"] [data-slot="action-items-header"]', 1)
                ->assertPresent('[data-state="page"] [data-slot="new-action-item"]')
                ->assertPresent('[data-state="page"] [data-slot="action-items-pagination"]')
                ->assertCount('[data-state="counters"] [data-slot="action-items-counts"]', 2)
                ->assertCount('[data-state="filters"] [data-slot="action-filter"][data-active="true"]', 4)
                ->assertAttribute('[data-state="filters"] [data-slot="action-filter-overdue"]', 'aria-pressed', 'true')
                ->assertCount('[data-state="empty"] [data-slot="empty-state"]', 1)
                ->assertCount('[data-state="empty-filtered"] [data-slot="empty-state"]', 1)
                ->assertPresent('[data-slot="action-sheet"]')
                ->assertPresent('[data-slot="action-sheet"] [data-slot="action-sheet-overdue"]')
                ->assertNotPresent('[data-slot="action-sheet"] [data-slot="alert"]')
                ->assertNotPresent('[role="alertdialog"]');

            if ($width < 1280) {
                return $page
                    ->assertPresent('[data-state="page"] [data-slot="action-item-filters-phone"]')
                    ->assertNotPresent('[data-slot="action-items-table"]')
                    ->assertCount('[data-state="page"] [role="list"] > [id^="action-item-page-"]', 6)
                    ->assertCount('[data-state="grouped-team"] [data-slot="action-group"]', 2)
                    ->assertCount('[data-state="grouped-assignee"] [data-slot="action-group"]', 5)
                    ->assertCount('[data-state="overdue"] [role="list"] > [id^="action-item-overdue-"]', 3);
            }

            return $page
                ->assertPresent('[data-state="page"] [data-slot="action-item-filters"]')
                ->assertCount('[data-state="page"] tr[data-slot="action-row"]', 6)
                ->assertCount('[data-state="page"] tr[data-slot="action-row"][data-status="completed"]', 1)
                ->assertCount('[data-state="page"] tr[data-slot="action-row"] td:last-child button', 6)
                ->assertCount('[data-state="grouped-team"] tr[data-slot="action-group"]', 2)
                ->assertCount('[data-state="grouped-assignee"] tr[data-slot="action-group"]', 5)
                ->assertCount('[data-state="overdue"] tr[data-slot="action-row"]', 3)
                ->assertCount('[data-state="member"] tr[data-slot="action-row"]', 6)
                ->assertNotPresent('[data-state="member"] tr[data-slot="action-row"] td:last-child button')
                ->assertPresent('[data-state="loading"] [data-slot="table-loading-row"]')
                ->assertNotPresent('[data-state="loading"] tr[data-slot="action-row"]');
        },
    );
});

it('[P24-16-01] renders the selection, facets and In progress states of the bench without overflow', function () {
    $this->captureVisuals(
        'actions-index-bulk',
        '/dev/design-system/actions-index?overlay=none',
        function (string $path, array $options, int $width) {
            $page = visit($path, $options)
                ->resize($width, 900)
                ->assertNotPresent('[data-slot="action-sheet"]')
                ->assertNotPresent('[role="alertdialog"]')
                ->assertCount('[data-state="facets"] [data-slot="action-filter"]', 6)
                ->assertCount('[data-state="facets"] [data-slot="action-filter"][data-active="true"]', 5)
                ->assertAttribute('[data-state="facets"] [data-slot="action-filter-overdue"]', 'aria-pressed', 'false')
                ->assertCount('[data-state="phone-selection"] [data-slot="action-item-selectable"]', 3)
                ->assertCount('[data-state="phone-selection"] [data-slot="action-item"][data-selected="true"]', 2)
                ->assertAttribute('[data-state="phone-selection"] [data-slot="action-items-bulk-bar"]', 'data-layout', 'docked')
                ->assertPresent('[data-state="phone-selection"] [data-slot="action-items-select-mode"]');

            if ($width < 1280) {
                return $page
                    ->assertNotPresent('[data-slot="action-items-table"]')
                    ->assertCount('[data-state="selection"] [data-slot="action-item-selectable"]', 6)
                    ->assertCount('[data-state="selection"] [data-slot="action-item"][data-selected="true"]', 3)
                    ->assertPresent('[data-state="selection"] [data-slot="action-items-bulk-bar"]')
                    ->assertCount('[data-state="selection-page"] [data-slot="action-item"][data-selected="true"]', 6)
                    ->assertCount('[data-state="all-matching"] [data-slot="action-item"][data-selected="true"]', 4)
                    ->assertCount('[data-state="all-matching"] [data-slot="action-items-bulk-bar"] button:disabled', 1);
            }

            return $page
                ->assertCount('[data-state="selection"] tr[data-slot="action-row"]', 6)
                ->assertCount('[data-state="selection"] tr[data-slot="action-row"][data-selected="true"]', 3)
                ->assertAttribute('[data-state="selection"] [data-slot="action-select-all"]', 'data-state', 'indeterminate')
                ->assertPresent('[data-state="selection"] [data-slot="action-items-bulk-bar"]')
                ->assertNotPresent('[data-state="selection"] [data-slot="bulk-select-matching"]')
                ->assertCount('[data-state="selection-page"] tr[data-slot="action-row"][data-selected="true"]', 6)
                ->assertAttribute('[data-state="selection-page"] [data-slot="action-select-all"]', 'data-state', 'checked')
                ->assertPresent('[data-state="selection-page"] [data-slot="bulk-select-matching"]')
                ->assertCount('[data-state="all-matching"] tr[data-slot="action-row"][data-selected="true"]', 4)
                ->assertNotPresent('[data-state="all-matching"] [data-slot="bulk-select-matching"]')
                ->assertCount('[data-state="all-matching"] [data-slot="action-items-bulk-bar"] button:disabled', 1)
                ->assertCount('[data-state="in-progress"] tr[data-slot="action-row"]', 3)
                ->assertCount('[data-state="in-progress"] tr[data-slot="action-row"][data-status="doing"]', 1);
        },
    );
});

it('[P24-16-02] renders the confirmation of a change of every matching item without overflow', function () {
    $this->captureVisuals(
        'actions-index-confirm-matching',
        '/dev/design-system/actions-index?overlay=confirm-matching',
        fn (string $path, array $options) => visit($path, $options)
            ->assertCount('[role="alertdialog"]', 1)
            ->assertSeeIn('[role="alertdialog"] [data-slot="dialog-title"]', '137')
            ->assertNotPresent('[data-slot="action-sheet"]'),
    );
});

it('[P24-16-03] renders the confirmation of a bulk deletion without overflow', function () {
    $this->captureVisuals(
        'actions-index-bulk-delete',
        '/dev/design-system/actions-index?overlay=bulk-delete',
        fn (string $path, array $options) => visit($path, $options)
            ->assertCount('[role="alertdialog"]', 1)
            ->assertNotPresent('[data-slot="action-sheet"]'),
    );
});

it('[P24-16-04] renders the details of a partial bulk change without overflow', function () {
    $this->captureVisuals(
        'actions-index-bulk-result',
        '/dev/design-system/actions-index?overlay=bulk-result',
        fn (string $path, array $options) => visit($path, $options)
            ->click('[data-sonner-toast] [data-button]')
            ->assertCount('[data-slot="bulk-refusals"] li', 2)
            ->assertNotPresent('[data-slot="action-sheet"]'),
    );
});

it('[P24-16-05] renders the sheet of a started action item without overflow', function () {
    $this->captureVisuals(
        'actions-index-started',
        '/dev/design-system/actions-index?overlay=started',
        fn (string $path, array $options) => visit($path, $options)
            ->assertPresent('[data-slot="action-sheet"]')
            ->assertNotPresent('[data-slot="action-sheet"] [data-slot="alert"]'),
    );
});

it('[P18e-05-13] renders the delete confirmation of an action item without overflow', function () {
    $this->captureVisuals(
        'actions-index-delete',
        '/dev/design-system/actions-index?overlay=delete',
        fn (string $path, array $options) => visit($path, $options)
            ->assertPresent('[role="alertdialog"]')
            ->assertNotPresent('[data-slot="action-sheet"]'),
    );
});

it('[P18e-05-14] renders the sheet of an action item deleted elsewhere without overflow', function () {
    $this->captureVisuals(
        'actions-index-deleted',
        '/dev/design-system/actions-index?overlay=deleted',
        fn (string $path, array $options) => visit($path, $options)
            ->assertPresent('[data-slot="action-sheet"] [data-slot="alert"]')
            ->assertNotPresent('[role="alertdialog"]'),
    );
});
