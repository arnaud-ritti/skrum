# Plan 9a — Action items v2 core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Action items become the team's follow-up list: priority, due date with an overdue flag, open/completed status, a team-member (or own-retro guest) assignee, an always-named creator, flat comments and a QRetro-style permission model, on the board and through workspace endpoints; the read models and realtime channels of the workspace-wide "Action items" page and of the "Previous action items" carry-over panel (whose UIs Plan 9b builds on the frontend foundation of Tasks 11–12).

**Architecture:** One schema migration turns `action_items` into a team-scoped table (`team_id` required, `retro_id` nullable) and adds `action_item_comments`. All behaviour lives in single-purpose actions under `app/Actions/ActionItems/` (`CreateActionItem`, `UpdateActionItem`, `SetActionItemStatus`, `DeleteActionItem`, `ApplyActionItemChanges`, comment actions) guarded by one `ActionItemPermissions` class that takes an `ActionItemActor` (user and/or participant). Every mutation fans out through `BroadcastActionItemChange` (presence board event while the item's retro is open, `private-retro-members.{retroId}` for each retro that carries the item, `private-team-action-items.{teamId}` for the global page) and dispatches plain domain events after commit. Board endpoints keep the phase/lock rules; new workspace endpoints (`/w/{workspace}/action-items…`) ignore phases and serve the global page and the carry-over panel. `ActionItemQuery` and `CarriedActionItems` share one ordering and eager-load a fixed relation list (`ActionItem::presentationRelations()`), so page and snapshot query counts stay constant. The frontend gets one reusable `ActionItemCard` (fields, permissions, comments) driven by an endpoint map, used here by the board panel and in Plan 9b by the carry-over sheet and the global page.

**Tech Stack:** Laravel 13 (PHP 8.4), PostgreSQL, Pest, Reverb, React 19, Inertia v3, `@laravel/echo-react`, Wayfinder, Tailwind 4, lucide, Radix select/dialog/sheet/checkbox (already installed).

**Spec:** `docs/superpowers/specs/2026-09-29-action-items-v2-design.md` (§1–§8, §9 service classes, §10–§13 except the scope additions (c) and (d) of Decision 8 and the UIs of the carry-over panel, the global page, the sidebar entry and the team page link (§8), which Plan 9b delivers). Parents: `docs/superpowers/specs/2026-09-29-retro-board-core-design.md`, `docs/superpowers/specs/2026-09-29-retro-flow-extras-design.md` (spec 2, implemented by Plans 8a–8e).

## Global Constraints

- Work on branch `feat/plan-9-action-items-v2`, created from the current HEAD of `feat/plan-8-retro-flow-extras` (Plans 8a–8e implemented). This plan consumes exactly: `action_items.theme_id` (nullable FK, null on delete) and `theme_name`; `App\Actions\ActionItems\CreateActionItem::handle(Retro $locked, Participant $author, string $content, ?string $assigneeParticipantId = null, ?RetroTheme $theme = null)` (its signature changes in Task 5 and its two callers are updated there); `App\Actions\Retros\PresentActionItem` (`themeId`, `themeName`); `App\Actions\Retros\PromoteSuggestedAction`; `App\Actions\Retros\SuggestionGuard`; `resources/js/components/retro/results/action-items-results.tsx`; `App\Events\RetroCompleted`; `App\Actions\Retros\ChangeRetroPhase`.
- Commands through Sail: `vendor/bin/sail artisan …`, `vendor/bin/sail bin pint --dirty --format agent`, `vendor/bin/sail bin phpstan analyse --no-progress` (level 7, 0 errors). npm on the host.
- Tests run on PostgreSQL (the Sail `testing` database). Check constraints are added only when `DB::getDriverName() === 'pgsql'`, like `create_team_health_statements_table`.
- No new Composer or npm dependency. Dates use the native `<input type="date">` and `Intl.DateTimeFormat`.
- Migration filenames use the prefix `2026_10_02_1000xx`; only `up()` methods.
- Board mutations: guards on the route-bound retro, again on the `lockForUpdate` retro inside `DB::transaction`, order phase → lock (423) → permission (403). Workspace mutations: visibility (404) → `lockForUpdate` on the item → lock of an open retro (423) → permission (403). Broadcasts only through `BroadcastActionItemChange` (after commit, `toOthers()`, report-don't-throw via `RetroBroadcastEvent::sendToOthers()` / `TeamActionItemsBroadcastEvent::sendToOthers()`); broadcast payloads are presented without a viewer (`isMine: false`).
- Controllers never pass request arrays to models: they validate with `ActionItemRules`, resolve the assignee with `ResolveActionItemAssignee` and call the actions. `theme_id`/`theme_name` are never read from a request.
- Action items and their comments are always named (creator, comment authors, assignee), also on anonymous retros (spec Decision 5). Guests never receive carried items, team members' emails or anything on `private-retro-members.*` / `private-team-action-items.*`.
- Every user-facing string via `t()` / `__()` with real translations in `lang/{en,fr,es,de}.json` (German "du", French "vous", Spanish "tú"), appended at the end of each file, keeping every existing value. Each task lists its own rows; add only keys that are missing at execution time. `tests/Feature/TranslationKeysTest.php` stays green.
- Wayfinder: run `vendor/bin/sail artisan wayfinder:generate --with-form` after every route change. `resources/js/actions` and `resources/js/routes` are gitignored — never stage them. Frontend imports use the generated controllers (`@/actions/App/Http/Controllers/…`), never hard-coded URLs.
- Frontend checks: `npm run types:check && npm run check` (known pre-existing failures only in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`). Format only touched files with `npx vp check --fix <paths>`.
- React: function components, `type Props`, no default exports except pages, Tailwind, lucide icons, `useBoard()` for board state, `retroRequest()` for JSON calls (it adds `X-Socket-ID`).
- PHP: constructor promotion, typed everything, array-shape docblocks on presenter return values, early returns, curly braces, no comments restating code. Test helper functions are global in Pest: every new helper name below is unique in `tests/`.
- Commit messages: Conventional Commits, ending with exactly:
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS`

## Review Focus

1. **A member participant is sent as `assignee_participant_id` on the board**, or a workspace Owner/Admin who is not in the team is picked → the member is stored in `assignee_user_id` (never in `assignee_participant_id`), the non-member is refused with 422, and sending both fields is 422. Pinned in Task 5 ("normalizes member participants to users", "refuses assignees outside the team", "refuses both assignee fields") and Task 6 ("normalizes a member participant sent from the board").
2. **Carry-over boundaries** — an item of the retro itself, of a later retro, of another team, or completed before the retro started is not carried; an item completed during the review stays carried; an item added outside a retro while R runs appears only in later retros; guests get `[]`. The snapshot query and the broadcast fan-out must agree. Pinned in Task 10 ("carries only earlier open or recently completed items", "carries items added outside a retro only into later retros", "never gives carried items to guests") and Task 4 ("targets exactly the retros that carry the item").
3. **Workspace endpoint on an item whose retro is locked** → 423 while the retro is open, allowed once it is `Completed`, never for items without a retro; an item of another workspace or of a team the viewer cannot see → 404, never 403. Pinned in Task 8 ("returns 423 only for locked retros that are still running", "hides items of other workspaces and invisible teams").
4. **Broadcast payloads** carry `isMine: false` and the named creator on anonymous retros; carried events go only to `private-retro-members.*`, never to a presence channel; items without a retro and items of completed retros send no presence event but always a team event. Pinned in Task 4 ("sends board, carried and team events", "sends no board event for completed retros or items without a retro") and Task 3 ("names the creator on anonymous retros").
5. **Status no-ops and the system actor** — setting the current status again returns 200 and dispatches neither a domain event nor a broadcast; `ExternalSyncActor` completes an item whatever its phase, lock and permissions and reports `origin: external`. Pinned in Task 5 ("treats the current status as a no-op", "lets the external sync actor bypass permissions").

## File map

| Area | Files |
|---|---|
| Schema & model | migrations `2026_10_02_100000_add_v2_columns_to_action_items_table`, `2026_10_02_100100_create_action_item_comments_table`; `app/Enums/{ActionItemPriority,ActionItemStatus,ActionItemEventOrigin}.php`; `app/Models/{ActionItem,ActionItemComment,Team,Retro,Workspace,User}.php`; `database/factories/{ActionItemFactory,ActionItemCommentFactory}.php`; `config/app.php`; `.env.example` |
| Permissions | `app/Actions/ActionItems/{ActionItemActor,ExternalSyncActor,ActionItemPermissions}.php` |
| Presenting | `app/Actions/Retros/PresentActionItem.php`, `app/Actions/ActionItems/PresentActionItemComment.php` |
| Realtime | `app/Actions/ActionItems/BroadcastActionItemChange.php`; `app/Events/Retros/{ActionItemCommentsChanged,RetroMembersBroadcastEvent,CarriedActionItemSaved,CarriedActionItemRemoved,CarriedActionItemCommentsChanged}.php`; `app/Events/ActionItems/{TeamActionItemsBroadcastEvent,TeamActionItemSaved,TeamActionItemDeleted,TeamActionItemCommentsChanged}.php`; `app/Http/Controllers/BroadcastAuthorizationsController.php` |
| Domain actions | `app/Actions/ActionItems/{ActionItemRules,ResolveActionItemAssignee,CreateActionItem,UpdateActionItem,SetActionItemStatus,ApplyActionItemChanges,DeleteActionItem,AddActionItemComment,UpdateActionItemComment,DeleteActionItemComment,WorkspaceActionItemGuard}.php`; `app/Events/ActionItems/{ActionItemCreated,ActionItemCompleted,ActionItemReopened,ActionItemAssigned}.php`; `app/Actions/Retros/PromoteSuggestedAction.php` |
| Endpoints | `app/Http/Controllers/Retros/{ActionItemsController,ActionItemCommentsController}.php`, `app/Http/Controllers/{WorkspaceActionItemsController,WorkspaceActionItemCommentsController,TeamsController}.php`, `routes/web.php` |
| Read models | `app/Actions/ActionItems/{ActionItemFilters,ActionItemQuery,CarriedActionItems}.php`, `app/Actions/Retros/BuildBoardSnapshot.php`, `app/Actions/Retros/BuildSummaryInput.php` |
| Frontend core | `resources/js/lib/retro/types.ts`, `resources/js/lib/retro/board-reducer.ts`, `resources/js/hooks/use-retro-channel.ts`, `resources/js/hooks/use-retro-board.ts`, `resources/js/lib/action-items/{permissions,endpoints,assignees,format}.ts` |
| Frontend UI | `resources/js/components/action-items/{priority-select,due-date-chip,assignee-select,anonymous-notice,action-item-comments,action-item-card,action-item-form}.tsx`; `resources/js/components/retro/{action-items-panel,delete-retro-dialog}.tsx`; `resources/js/components/retro/results/action-items-results.tsx` |
| Tests | `tests/Pest.php`; `tests/Feature/ActionItems/{ActionItemModelTest,ActionItemPermissionsTest,PresentActionItemTest,ActionItemBroadcastsTest,ActionItemActionsTest,ActionItemCommentsTest,WorkspaceActionItemsTest,ActionItemsPageTest,CarryOverTest}.php`; `tests/Feature/Retros/{ActionItemsTest,BoardLockTest,BoardSnapshotTest,BroadcastAuthorizationTest,SuggestedActionsTest,SummaryInputTest}.php` |
| Translations | `lang/{en,fr,es,de}.json` (rows inside each task) |

## Contract for Plan 9b

Plan 9b (carry-over panel and global page UIs, recurrence, sub-tasks, reminders, notifications) builds on exactly these products of this plan; renaming any of them breaks 9b:

- Columns `action_items.recurrence` (nullable string, no cast yet) and `previous_occurrence_id` (nullable, unique, FK → `action_items`, null on delete) plus the pgsql check `action_items_recurrence_needs_due_date`, all created in Task 1 and not used by this plan's code.
- `ActionItem::presentationRelations(): array<int, string>` and `ActionItem::loadForPresentation(): static` (9b appends `'subtasks'`); `ActionItem::today(): CarbonImmutable`; `ActionItem::isCompleted()`, `isOverdue(CarbonInterface $today)`, `hasRetro()`; relations `team`, `retro`, `author`, `assigneeUser`, `assigneeParticipant`, `createdByParticipant`, `comments`.
- `ActionItemActor` (`?User $user`, `?Participant $participant`, `forParticipant()`, `forUser()`), `ExternalSyncActor`, `ActionItemPermissions` (`canEdit`, `canComplete`, `canDelete`, `authorizeEdit`, `authorizeComplete`, `authorizeDelete`, `authorizeCreateWithoutRetro`).
- `ActionItemRules::create(bool $allowsGuests): array`, `ActionItemRules::update(bool $allowsGuests): array`, `ActionItemRules::attributes(array $validated): array`, `ActionItemRules::messages(): array`.
- `CreateActionItem::handle(Team $team, ?Retro $retro, ActionItemActor $author, array $attributes, ?RetroTheme $theme = null): ActionItem`, `UpdateActionItem::handle(ActionItem $locked, ActionItemActor $actor, array $changes): ActionItem`, `SetActionItemStatus::handle(ActionItem $locked, ActionItemActor|ExternalSyncActor $actor, ActionItemStatus $status): ActionItem`, `ApplyActionItemChanges::handle(ActionItem $locked, ActionItemActor $actor, array $validated): ActionItem`, `BroadcastActionItemChange::saved(ActionItem $item): void`.
- `PresentActionItem::handle(ActionItem $item, ?ActionItemActor $viewer = null): array` (9b adds `recurrence`, `previousOccurrenceId`, `subtasks`), `WorkspaceActionItemGuard::visible()` / `writable()`, `ActionItemQuery::visibleTo(User $user, Workspace $workspace): Builder`.
- Routes `retros.action-items.*`, `retros.action-items.comments.*`, `workspaces.actionItems.*` (incl. `index` rendering `action-items/index` with the props of Task 9: `workspace`, `filters`, `items`, `focusedItem`, `teams`, `creatableTeams`, `assignees`, `realtimeTeamIds`, `viewer`), `workspaces.actionItemComments.*`; `teams/show` prop `openActionItemCount`.
- Snapshot fields of Task 10: `retro.teamId`, `viewer.{userId, canManageActionItems, isWorkspaceManager, isReviewFacilitator, facilitatedRetroIds}`, `carriedActionItems`, `carriedActionItemsHasMore`, `teamMembers[{id, name, avatarUrl, participantId}]`, `links.{actionItems, workspace}`; channels `private-retro-members.{retroId}` (`carried-action-item.*`) and `private-team-action-items.{teamId}` (`team-action-item.*`).
- Frontend foundation of Task 11: types `ActionItem`, `ActionItemComment`, `TeamMember` and the `Snapshot` additions (`resources/js/lib/retro/types.ts`); reducer actions `actionItem.upsert`, `actionItem.comments`, `carriedActionItem.upsert/remove` and the exported helpers `upsertActionItem`, `countActionItemComments` (`resources/js/lib/retro/board-reducer.ts`); `useRetroChannel(…, membersOnly, …)` dispatching the carried events; `ActionItemViewer`, `canManageActionItem`, `canCompleteActionItem`, `boardActionItemViewer` (`permissions.ts`); `EndpointRoute`, `ActionItemEndpoints`, `boardActionItemEndpoints`, `workspaceActionItemEndpoints` (`endpoints.ts`); `Unassigned`, `assigneeValue`, `assigneePayload` (`assignees.ts`); `formatDueDate`, `formatShortDate` (`format.ts`).
- Shared components of Task 12 (`resources/js/components/action-items/`): `ActionItemCard` (props `item, endpoints, viewer, assigneeGroups, run, onSaved, onRemoved, onCommentCount, editable, showAnonymousNotice?, meta?, defaultExpanded?, children?`; `children` renders under the content), `RunMutation`, `ActionItemComments`, `ActionItemForm` / `ActionItemDraft` / `emptyActionItemDraft` / `actionItemPayload`, `AssigneeSelect`, `AssigneeGroup`, `assigneeLabel`, `boardAssigneeGroups`, `teamAssigneeGroups`, `PrioritySelect`, `PriorityIcon`, `DueDateChip`, `AnonymousNotice`.
- Existing files 9b extends: `resources/js/components/retro/board.tsx` (header `actions`), `resources/js/components/app-sidebar.tsx`, `resources/js/components/nav-main.tsx`, `resources/js/types/navigation.ts` (`NavItem`), `resources/js/pages/teams/show.tsx`.

---

### Task 1: Schema, enums, models and factories

**Files:**
- Create: `database/migrations/2026_10_02_100000_add_v2_columns_to_action_items_table.php`, `database/migrations/2026_10_02_100100_create_action_item_comments_table.php`, `app/Enums/ActionItemPriority.php`, `app/Enums/ActionItemStatus.php`, `app/Enums/ActionItemEventOrigin.php`, `app/Models/ActionItemComment.php`, `database/factories/ActionItemCommentFactory.php`
- Modify: `app/Models/ActionItem.php`, `database/factories/ActionItemFactory.php`, `app/Models/Team.php`, `app/Models/Retro.php`, `app/Models/Workspace.php`, `app/Models/User.php`, `config/app.php`, `.env.example`, `app/Actions/ActionItems/CreateActionItem.php`, `app/Actions/Retros/PresentActionItem.php`, `app/Http/Controllers/Retros/ActionItemsController.php`, `app/Actions/Retros/BuildBoardSnapshot.php`, `app/Actions/Retros/BuildSummaryInput.php`, `tests/Pest.php`, `tests/Feature/Retros/SuggestedActionsTest.php`, `tests/Feature/Retros/SummaryInputTest.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/ActionItems/ActionItemModelTest.php`

**Interfaces:**
- Consumes: `retros`, `participants`, `teams`, `users` tables; Plan 8's `action_items.theme_id` / `theme_name`.
- Produces: columns `action_items.{team_id, priority, due_on, completed_at, assignee_user_id, created_by_user_id, recurrence, previous_occurrence_id}`, nullable `retro_id` and `created_by_participant_id` (null on delete), no `is_done`; table `action_item_comments`; `App\Enums\ActionItemPriority` (`High`/`Medium`/`Low`, `sortWeight(): int`, `label(): string`, `static sqlWeight(): string`), `App\Enums\ActionItemStatus` (`Open`/`Completed`), `App\Enums\ActionItemEventOrigin` (`Skrum`/`External`); `ActionItem::today(): CarbonImmutable`, `ActionItem::presentationRelations(): array<int, string>`, `ActionItem::loadForPresentation(): static`, `isCompleted(): bool`, `hasRetro(): bool`, `isOverdue(CarbonInterface $today): bool`, relations `team()`, `retro()`, `author()`, `createdByParticipant()`, `assigneeUser()`, `assigneeParticipant()`, `theme()`, `comments()`; `App\Models\ActionItemComment` (`actionItem()`, `authorParticipant()`, `authorUser()`); `Team::actionItems(): HasMany`, `Retro::actionItemComments(): HasManyThrough`, `Workspace::actionItems(): HasManyThrough`, `User::avatarUrl(): string`; factory states `completed()`, `overdue()`, `assignedTo(User)`, `assignedToGuest(Participant)`, `priority(ActionItemPriority)`, `withoutRetro(Team, User)`; `ActionItemCommentFactory::byParticipant(Participant)`; Pest helpers `teamMember(Team $team): User`, `workspaceManager(Workspace $workspace, WorkspaceRole $role = WorkspaceRole::Admin): User`, `workspaceAdminParticipant(Retro $retro): array{0: User, 1: Participant}` (moved from `SuggestedActionsTest.php`).

- [ ] **Step 1: Pest helpers**

In `tests/Pest.php` add `use App\Models\Team;` and `use App\Models\Workspace;` to the imports and append:

```php
function teamMember(Team $team): User
{
    $user = User::factory()->create();
    $team->workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
    $team->members()->attach($user);

    return $user;
}

function workspaceManager(Workspace $workspace, WorkspaceRole $role = WorkspaceRole::Admin): User
{
    $user = User::factory()->create();
    $workspace->members()->attach($user, ['role' => $role->value]);

    return $user;
}

/**
 * @return array{0: User, 1: Participant}
 */
function workspaceAdminParticipant(Retro $retro): array
{
    $user = workspaceManager($retro->team->workspace);

    return [$user, Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $user->id])];
}
```

In `tests/Feature/Retros/SuggestedActionsTest.php` delete the local `function workspaceAdminParticipant(Retro $retro): array { … }` (it now lives in `tests/Pest.php`, same behaviour) and remove the imports that become unused (`use App\Enums\WorkspaceRole;`, `use App\Models\User;`) if nothing else in the file uses them.

- [ ] **Step 2: Write the failing tests**

Create `tests/Feature/ActionItems/ActionItemModelTest.php`:

```php
<?php

use App\Enums\ActionItemPriority;
use App\Models\ActionItem;
use App\Models\ActionItemComment;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

it('backfills the new columns from legacy rows', function () {
    Schema::table('action_items', function (Blueprint $table) {
        $table->boolean('is_done')->default(false);
    });
    $retro = Retro::factory()->create();
    $member = Participant::factory()->create(['retro_id' => $retro->id]);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $strayTeam = Team::factory()->create();
    $done = ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'team_id' => $strayTeam->id,
        'created_by_participant_id' => $member->id,
        'created_by_user_id' => null,
        'assignee_participant_id' => $member->id,
    ]);
    $open = ActionItem::factory()->create([
        'retro_id' => $retro->id,
        'created_by_participant_id' => $guest->id,
        'created_by_user_id' => null,
        'assignee_participant_id' => $guest->id,
    ]);
    DB::table('action_items')->where('id', $done->id)->update(['is_done' => true, 'updated_at' => '2026-09-01 10:00:00']);

    $migration = require database_path('migrations/2026_10_02_100000_add_v2_columns_to_action_items_table.php');
    $migration->backfill();

    $done->refresh();
    $open->refresh();

    expect($done->team_id)->toBe($retro->team_id)
        ->and($done->completed_at?->toDateTimeString())->toBe('2026-09-01 10:00:00')
        ->and($done->assignee_user_id)->toBe($member->user_id)
        ->and($done->assignee_participant_id)->toBeNull()
        ->and($done->created_by_user_id)->toBe($member->user_id)
        ->and($open->team_id)->toBe($retro->team_id)
        ->and($open->completed_at)->toBeNull()
        ->and($open->assignee_participant_id)->toBe($guest->id)
        ->and($open->assignee_user_id)->toBeNull()
        ->and($open->created_by_user_id)->toBeNull();
});

it('derives the team and the author from the creating participant', function () {
    $item = ActionItem::factory()->create();

    expect($item->team_id)->toBe($item->retro->team_id)
        ->and($item->created_by_user_id)->toBe($item->createdByParticipant->user_id)
        ->and($item->author->is($item->createdByParticipant->user))->toBeTrue()
        ->and($item->fresh()->priority)->toBe(ActionItemPriority::Medium)
        ->and($item->hasRetro())->toBeTrue()
        ->and($item->team->actionItems()->pluck('id')->all())->toBe([$item->id]);
});

it('keeps items added outside a retro on their team and workspace', function () {
    $team = Team::factory()->create();
    $author = teamMember($team);

    $item = ActionItem::factory()->withoutRetro($team, $author)->create();

    expect($item->hasRetro())->toBeFalse()
        ->and($item->retro)->toBeNull()
        ->and($item->created_by_participant_id)->toBeNull()
        ->and($item->author->is($author))->toBeTrue()
        ->and($team->workspace->actionItems()->pluck('action_items.id')->all())->toBe([$item->id]);
});

it('flags open items due before today as overdue', function (?string $dueOn, bool $completed, bool $overdue) {
    $this->travelTo(CarbonImmutable::parse('2026-10-05 12:00:00'));
    $item = ActionItem::factory()->create(['due_on' => $dueOn, 'completed_at' => $completed ? now() : null]);

    expect($item->fresh()->isOverdue(ActionItem::today()))->toBe($overdue);
})->with([
    'due yesterday' => ['2026-10-04', false, true],
    'due today' => ['2026-10-05', false, false],
    'due tomorrow' => ['2026-10-06', false, false],
    'completed late' => ['2026-10-01', true, false],
    'no due date' => [null, false, false],
]);

it('decides what today is in the instance time zone', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-05 23:30:00', 'UTC'));
    $item = ActionItem::factory()->create(['due_on' => '2026-10-05'])->fresh();

    expect($item->isOverdue(ActionItem::today()))->toBeFalse();

    config(['app.timezone' => 'Europe/Paris']);

    expect($item->isOverdue(ActionItem::today()))->toBeTrue();
});

it('refuses a member and a guest assignee at once', function () {
    $guest = Participant::factory()->guest()->create();

    expect(fn () => DB::transaction(fn () => ActionItem::factory()->create([
        'retro_id' => $guest->retro_id,
        'assignee_participant_id' => $guest->id,
        'assignee_user_id' => User::factory()->create()->id,
    ])))->toThrow(QueryException::class);
});

it('refuses a guest assignee on an item without a retro', function () {
    $guest = Participant::factory()->guest()->create();
    $team = $guest->retro->team;

    expect(fn () => DB::transaction(fn () => ActionItem::factory()->withoutRetro($team, teamMember($team))->create([
        'assignee_participant_id' => $guest->id,
    ])))->toThrow(QueryException::class);
});

it('refuses a recurrence without a due date', function () {
    expect(fn () => DB::transaction(fn () => ActionItem::factory()->create(['recurrence' => 'weekly', 'due_on' => null])))
        ->toThrow(QueryException::class);
});

it('unassigns items when the assigned user is deleted', function () {
    $user = User::factory()->create();
    $item = ActionItem::factory()->assignedTo($user)->create();

    $user->delete();

    expect($item->fresh()->assignee_user_id)->toBeNull();
});

it('deletes items and their comments with the retro or the team', function () {
    $retro = Retro::factory()->create();
    $boardItem = ActionItem::factory()->create(['retro_id' => $retro->id]);
    ActionItemComment::factory()->create(['action_item_id' => $boardItem->id]);
    $team = Team::factory()->create();
    $teamItem = ActionItem::factory()->withoutRetro($team, teamMember($team))->create();

    $retro->delete();
    $team->delete();

    expect(ActionItem::whereKey([$boardItem->id, $teamItem->id])->count())->toBe(0)
        ->and(ActionItemComment::count())->toBe(0);
});

it('gives members the same avatar as their participants', function () {
    $participant = Participant::factory()->create();

    expect($participant->user->avatarUrl())->toBe($participant->avatarUrl());
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems/ActionItemModelTest.php`
Expected: FAIL (`Failed opening required '…2026_10_02_100000_add_v2_columns_to_action_items_table.php'` and `Call to undefined method … withoutRetro()`).

- [ ] **Step 4: Enums**

`app/Enums/ActionItemPriority.php`:

```php
<?php

namespace App\Enums;

enum ActionItemPriority: string
{
    case High = 'high';
    case Medium = 'medium';
    case Low = 'low';

    public function sortWeight(): int
    {
        return match ($this) {
            self::High => 0,
            self::Medium => 1,
            self::Low => 2,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::High => __('High'),
            self::Medium => __('Medium'),
            self::Low => __('Low'),
        };
    }

    public static function sqlWeight(): string
    {
        $cases = collect(self::cases())
            ->map(fn (self $priority): string => "when '{$priority->value}' then {$priority->sortWeight()}")
            ->implode(' ');

        return "case priority {$cases} end";
    }
}
```

`app/Enums/ActionItemStatus.php`:

```php
<?php

namespace App\Enums;

enum ActionItemStatus: string
{
    case Open = 'open';
    case Completed = 'completed';
}
```

`app/Enums/ActionItemEventOrigin.php`:

```php
<?php

namespace App\Enums;

enum ActionItemEventOrigin: string
{
    case Skrum = 'skrum';
    case External = 'external';
}
```

- [ ] **Step 5: Migrations**

`database/migrations/2026_10_02_100000_add_v2_columns_to_action_items_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('action_items', function (Blueprint $table) {
            $table->foreignUuid('team_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('priority')->default('medium');
            $table->date('due_on')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->foreignUuid('assignee_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUuid('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('recurrence')->nullable();
            $table->foreignUuid('previous_occurrence_id')->nullable()->unique()->constrained('action_items')->nullOnDelete();
        });

        $this->backfill();

        Schema::table('action_items', function (Blueprint $table) {
            $table->dropForeign(['created_by_participant_id']);
        });

        Schema::table('action_items', function (Blueprint $table) {
            $table->uuid('team_id')->nullable(false)->change();
            $table->uuid('retro_id')->nullable()->change();
            $table->uuid('created_by_participant_id')->nullable()->change();
            $table->foreign('created_by_participant_id')->references('id')->on('participants')->nullOnDelete();
            $table->dropColumn('is_done');
            $table->index(['team_id', 'completed_at', 'due_on']);
            $table->index(['assignee_user_id', 'completed_at']);
            $table->index(['completed_at', 'due_on']);
        });

        $this->addChecks();
    }

    /**
     * Public so a test can run it against rows shaped like the legacy table.
     */
    public function backfill(): void
    {
        DB::table('action_items')->whereNotNull('retro_id')->update([
            'team_id' => DB::raw('(select retros.team_id from retros where retros.id = action_items.retro_id)'),
        ]);

        DB::table('action_items')->where('is_done', true)->update([
            'completed_at' => DB::raw('action_items.updated_at'),
        ]);

        DB::table('action_items')->whereNull('created_by_user_id')->whereNotNull('created_by_participant_id')->update([
            'created_by_user_id' => DB::raw('(select participants.user_id from participants where participants.id = action_items.created_by_participant_id)'),
        ]);

        DB::table('action_items')
            ->whereIn('assignee_participant_id', DB::table('participants')->select('id')->whereNotNull('user_id'))
            ->update([
                'assignee_user_id' => DB::raw('(select participants.user_id from participants where participants.id = action_items.assignee_participant_id)'),
                'assignee_participant_id' => null,
            ]);
    }

    private function addChecks(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('alter table action_items add constraint action_items_single_assignee check (assignee_user_id is null or assignee_participant_id is null)');
        DB::statement('alter table action_items add constraint action_items_guest_assignee_needs_retro check (retro_id is not null or assignee_participant_id is null)');
        DB::statement('alter table action_items add constraint action_items_recurrence_needs_due_date check (recurrence is null or due_on is not null)');
    }
};
```

`database/migrations/2026_10_02_100100_create_action_item_comments_table.php` (no check constraint: both author columns are null-on-delete, so a row may legitimately end up with neither; the actions always set exactly one):

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('action_item_comments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('action_item_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('author_participant_id')->nullable()->constrained('participants')->nullOnDelete();
            $table->foreignUuid('author_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('content');
            $table->timestamps();

            $table->index(['action_item_id', 'created_at']);
        });
    }
};
```

- [ ] **Step 6: Models**

Replace `app/Models/ActionItem.php`:

```php
<?php

namespace App\Models;

use App\Enums\ActionItemPriority;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Database\Factories\ActionItemFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $team_id
 * @property string|null $retro_id
 * @property string $content
 * @property ActionItemPriority $priority
 * @property Carbon|null $due_on
 * @property Carbon|null $completed_at
 * @property string|null $assignee_user_id
 * @property string|null $assignee_participant_id
 * @property string|null $created_by_participant_id
 * @property string|null $created_by_user_id
 * @property string|null $theme_id
 * @property string|null $theme_name
 * @property string|null $recurrence
 * @property string|null $previous_occurrence_id
 * @property int|null $comments_count
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read Team $team
 * @property-read Retro|null $retro
 * @property-read User|null $author
 * @property-read User|null $assigneeUser
 * @property-read Participant|null $assigneeParticipant
 * @property-read Participant|null $createdByParticipant
 */
#[Fillable([
    'team_id', 'retro_id', 'content', 'priority', 'due_on', 'completed_at',
    'assignee_user_id', 'assignee_participant_id', 'created_by_participant_id', 'created_by_user_id',
    'theme_id', 'theme_name', 'recurrence', 'previous_occurrence_id',
])]
class ActionItem extends Model
{
    /** @use HasFactory<ActionItemFactory> */
    use HasFactory;

    use HasUuids;

    public static function today(): CarbonImmutable
    {
        return CarbonImmutable::now((string) config('app.timezone'));
    }

    /**
     * Everything PresentActionItem reads, so lists present with a fixed
     * number of queries.
     *
     * @return array<int, string>
     */
    public static function presentationRelations(): array
    {
        return ['team.members', 'retro', 'author', 'createdByParticipant.user', 'assigneeUser', 'assigneeParticipant.user'];
    }

    public function loadForPresentation(): static
    {
        $this->load(self::presentationRelations());
        $this->loadCount('comments');

        return $this;
    }

    /** @return BelongsTo<Team, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /** @return BelongsTo<Retro, $this> */
    public function retro(): BelongsTo
    {
        return $this->belongsTo(Retro::class);
    }

    /** @return BelongsTo<User, $this> */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    /** @return BelongsTo<Participant, $this> */
    public function createdByParticipant(): BelongsTo
    {
        return $this->belongsTo(Participant::class, 'created_by_participant_id');
    }

    /** @return BelongsTo<User, $this> */
    public function assigneeUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_user_id');
    }

    /** @return BelongsTo<Participant, $this> */
    public function assigneeParticipant(): BelongsTo
    {
        return $this->belongsTo(Participant::class, 'assignee_participant_id');
    }

    /** @return BelongsTo<RetroTheme, $this> */
    public function theme(): BelongsTo
    {
        return $this->belongsTo(RetroTheme::class, 'theme_id');
    }

    /** @return HasMany<ActionItemComment, $this> */
    public function comments(): HasMany
    {
        return $this->hasMany(ActionItemComment::class);
    }

    public function isCompleted(): bool
    {
        return $this->completed_at !== null;
    }

    public function hasRetro(): bool
    {
        return $this->retro_id !== null;
    }

    public function isOverdue(CarbonInterface $today): bool
    {
        if ($this->completed_at !== null) {
            return false;
        }

        if ($this->due_on === null) {
            return false;
        }

        return $this->due_on->toDateString() < $today->toDateString();
    }

    protected function casts(): array
    {
        return [
            'priority' => ActionItemPriority::class,
            'due_on' => 'date',
            'completed_at' => 'datetime',
        ];
    }
}
```

Create `app/Models/ActionItemComment.php`:

```php
<?php

namespace App\Models;

use Database\Factories\ActionItemCommentFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $action_item_id
 * @property string|null $author_participant_id
 * @property string|null $author_user_id
 * @property string $content
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read ActionItem $actionItem
 * @property-read Participant|null $authorParticipant
 * @property-read User|null $authorUser
 */
#[Fillable(['author_participant_id', 'author_user_id', 'content'])]
class ActionItemComment extends Model
{
    /** @use HasFactory<ActionItemCommentFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<ActionItem, $this> */
    public function actionItem(): BelongsTo
    {
        return $this->belongsTo(ActionItem::class);
    }

    /** @return BelongsTo<Participant, $this> */
    public function authorParticipant(): BelongsTo
    {
        return $this->belongsTo(Participant::class, 'author_participant_id');
    }

    /** @return BelongsTo<User, $this> */
    public function authorUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_user_id');
    }
}
```

In `app/Models/Team.php` add:

```php
    /** @return HasMany<ActionItem, $this> */
    public function actionItems(): HasMany
    {
        return $this->hasMany(ActionItem::class);
    }
```

In `app/Models/Retro.php` add `use Illuminate\Database\Eloquent\Relations\HasManyThrough;` and, after `actionItems()`:

```php
    /** @return HasManyThrough<ActionItemComment, ActionItem, $this> */
    public function actionItemComments(): HasManyThrough
    {
        return $this->hasManyThrough(ActionItemComment::class, ActionItem::class);
    }
```

In `app/Models/Workspace.php` add `use Illuminate\Database\Eloquent\Relations\HasManyThrough;` and, after `teams()`:

```php
    /** @return HasManyThrough<ActionItem, Team, $this> */
    public function actionItems(): HasManyThrough
    {
        return $this->hasManyThrough(ActionItem::class, Team::class);
    }
```

In `app/Models/User.php` add (same seed as `Participant::avatarSeed()` for members, so a member looks the same on the board and on the global page):

```php
    public function avatarUrl(): string
    {
        $seed = substr(hash_hmac('sha256', $this->id, (string) config('app.key')), 0, 32);

        return route('avatars.show', $seed, absolute: false);
    }
```

- [ ] **Step 7: Factories**

Replace `database/factories/ActionItemFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Enums\ActionItemPriority;
use App\Models\ActionItem;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ActionItem>
 */
class ActionItemFactory extends Factory
{
    public function definition(): array
    {
        return [
            'retro_id' => Retro::factory(),
            'team_id' => fn (array $attributes) => $attributes['retro_id'] === null
                ? Team::factory()
                : Retro::query()->findOrFail($attributes['retro_id'])->team_id,
            'content' => fake()->sentence(),
            'priority' => ActionItemPriority::Medium,
            'created_by_participant_id' => fn (array $attributes) => $attributes['retro_id'] === null
                ? null
                : Participant::factory()->create(['retro_id' => $attributes['retro_id']])->id,
            'created_by_user_id' => fn (array $attributes) => $attributes['created_by_participant_id'] === null
                ? null
                : Participant::query()->findOrFail($attributes['created_by_participant_id'])->user_id,
        ];
    }

    public function completed(): static
    {
        return $this->state(fn () => ['completed_at' => now()]);
    }

    public function overdue(): static
    {
        return $this->state(fn () => [
            'due_on' => ActionItem::today()->subDays(3)->toDateString(),
            'completed_at' => null,
        ]);
    }

    public function assignedTo(User $user): static
    {
        return $this->state(fn () => ['assignee_user_id' => $user->id, 'assignee_participant_id' => null]);
    }

    public function assignedToGuest(Participant $guest): static
    {
        return $this->state(fn () => [
            'retro_id' => $guest->retro_id,
            'assignee_participant_id' => $guest->id,
            'assignee_user_id' => null,
        ]);
    }

    public function priority(ActionItemPriority $priority): static
    {
        return $this->state(fn () => ['priority' => $priority]);
    }

    public function withoutRetro(Team $team, User $author): static
    {
        return $this->state(fn () => [
            'retro_id' => null,
            'team_id' => $team->id,
            'created_by_participant_id' => null,
            'created_by_user_id' => $author->id,
        ]);
    }
}
```

Create `database/factories/ActionItemCommentFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\ActionItem;
use App\Models\ActionItemComment;
use App\Models\Participant;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ActionItemComment>
 */
class ActionItemCommentFactory extends Factory
{
    public function definition(): array
    {
        return [
            'action_item_id' => ActionItem::factory(),
            'author_participant_id' => null,
            'author_user_id' => User::factory(),
            'content' => fake()->sentence(),
        ];
    }

    public function byParticipant(Participant $participant): static
    {
        return $this->state(fn () => ['author_participant_id' => $participant->id, 'author_user_id' => null]);
    }
}
```

- [ ] **Step 8: Instance time zone**

In `config/app.php` replace `'timezone' => 'UTC',` with:

```php
    'timezone' => env('APP_TIMEZONE', 'UTC'),
```

In `.env.example`, after `APP_URL=http://localhost`, add:

```dotenv
# Instance time zone. Decides the day an action item becomes overdue.
APP_TIMEZONE=UTC
```

- [ ] **Step 9: Keep the current callers working on the new columns**

These are the minimal edits that keep the existing board endpoints green until Tasks 3–6 replace them.

`app/Actions/ActionItems/CreateActionItem.php` — in the `create([...])` array add `'team_id' => $locked->team_id,` and `'created_by_user_id' => $author->user_id,`, and replace `$actionItem->load('assignee.user');` with `$actionItem->load('assigneeParticipant.user');`.

`app/Actions/Retros/PresentActionItem.php` — replace the `isDone` and `assignee` entries of the returned array with:

```php
            'isDone' => $item->completed_at !== null,
            'assignee' => $item->assigneeParticipant === null
                ? null
                : ['id' => $item->assigneeParticipant->id, 'name' => $item->assigneeParticipant->displayName()],
```

`app/Http/Controllers/Retros/ActionItemsController.php` — add `use Illuminate\Support\Arr;` and in `update()` replace

```php
            $fresh->update($validated);
            $fresh->load('assignee.user');
```

with

```php
            $attributes = Arr::except($validated, ['is_done']);

            if (array_key_exists('is_done', $validated)) {
                $attributes['completed_at'] = $validated['is_done'] ? now() : null;
            }

            $fresh->update($attributes);
            $fresh->load('assigneeParticipant.user');
```

`app/Actions/Retros/BuildBoardSnapshot.php` — in `loadMissing([...])` replace `'actionItems.assignee.user',` with `'actionItems.assigneeParticipant.user',`.

`app/Actions/Retros/BuildSummaryInput.php` — replace `'done' => $item->is_done` with `'done' => $item->completed_at !== null`.

`tests/Feature/Retros/SummaryInputTest.php` — replace

```php
    ActionItem::factory()->create(['retro_id' => $retro->id, 'content' => 'Cache the build', 'assignee_participant_id' => $bob->id, 'is_done' => true]);
```

with

```php
    ActionItem::factory()->completed()->create(['retro_id' => $retro->id, 'content' => 'Cache the build', 'assignee_participant_id' => $bob->id]);
```

- [ ] **Step 10: Translations**

| Key | fr | es | de |
|---|---|---|---|
| `High` | `Haute` | `Alta` | `Hoch` |
| `Medium` | `Moyenne` | `Media` | `Mittel` |
| `Low` | `Basse` | `Baja` | `Niedrig` |

- [ ] **Step 11: Run tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems/ActionItemModelTest.php tests/Feature/Retros tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 12: Pint, phpstan, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add database/migrations/2026_10_02_100000_add_v2_columns_to_action_items_table.php database/migrations/2026_10_02_100100_create_action_item_comments_table.php app/Enums/ActionItemPriority.php app/Enums/ActionItemStatus.php app/Enums/ActionItemEventOrigin.php app/Models database/factories config/app.php .env.example app/Actions/ActionItems/CreateActionItem.php app/Actions/Retros/PresentActionItem.php app/Actions/Retros/BuildBoardSnapshot.php app/Actions/Retros/BuildSummaryInput.php app/Http/Controllers/Retros/ActionItemsController.php tests/Pest.php tests/Feature/ActionItems/ActionItemModelTest.php tests/Feature/Retros/SuggestedActionsTest.php tests/Feature/Retros/SummaryInputTest.php lang
git commit -m "feat: give action items a team, priority, due date, status and comments table

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 2: Actors and `ActionItemPermissions`

**Files:**
- Create: `app/Actions/ActionItems/ActionItemActor.php`, `app/Actions/ActionItems/ExternalSyncActor.php`, `app/Actions/ActionItems/ActionItemPermissions.php`
- Modify: `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/ActionItems/ActionItemPermissionsTest.php`

**Interfaces:**
- Consumes: Task 1 models; `TeamPolicy::view`; `User::canManage(Workspace)`; `Retro::facilitator()`.
- Produces: `App\Actions\ActionItems\ActionItemActor` (`__construct(public ?User $user, public ?Participant $participant)`, `static forParticipant(Participant $participant): self`, `static forUser(User $user): self`); `App\Actions\ActionItems\ExternalSyncActor` (`__construct(public string $source, public string $key)`); `App\Actions\ActionItems\ActionItemPermissions` with `canCreateWithoutRetro(User, Team): bool`, `canEdit(ActionItem, ActionItemActor): bool`, `canDelete(…)`, `canComplete(…)`, `canComment(…)`, `canEditComment(ActionItemComment, ActionItemActor): bool`, `canDeleteComment(…)`, `isAuthor(ActionItem, ActionItemActor): bool`, `isCommentAuthor(ActionItemComment, ActionItemActor): bool`, and `authorizeCreateWithoutRetro`, `authorizeEdit`, `authorizeDelete`, `authorizeComplete`, `authorizeComment`, `authorizeEditComment`, `authorizeDeleteComment` (all `void`, throw `AuthorizationException` with the translated messages below).

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/ActionItems/ActionItemPermissionsTest.php`:

```php
<?php

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ActionItemPermissions;
use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\ActionItem;
use App\Models\ActionItemComment;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use Illuminate\Auth\Access\AuthorizationException;

/**
 * @return array{retro: Retro, item: ActionItem, author: Participant}
 */
function permissionsFixture(): array
{
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->withGuestAccess()->create();
    [, $author] = retroMember($retro);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $author->id]);

    return ['retro' => $retro, 'item' => $item, 'author' => $author];
}

it('decides who manages, completes and comments on board items', function (Closure $makeActor, bool $manages, bool $completes) {
    $fixture = permissionsFixture();
    $actor = $makeActor($fixture);
    $item = $fixture['item']->fresh();
    $permissions = app(ActionItemPermissions::class);

    expect($permissions->canEdit($item, $actor))->toBe($manages)
        ->and($permissions->canDelete($item, $actor))->toBe($manages)
        ->and($permissions->canComplete($item, $actor))->toBe($completes)
        ->and($permissions->canComment($item, $actor))->toBeTrue();
})->with([
    'author on the board' => [fn (array $fixture) => ActionItemActor::forParticipant($fixture['author']), true, true],
    'author on the global page' => [fn (array $fixture) => ActionItemActor::forUser($fixture['author']->user), true, true],
    'facilitator on the board' => [fn (array $fixture) => ActionItemActor::forParticipant(retroFacilitator($fixture['retro'])[1]), true, true],
    'facilitator on the global page' => [fn (array $fixture) => ActionItemActor::forUser(retroFacilitator($fixture['retro'])[0]), true, true],
    'workspace admin' => [fn (array $fixture) => ActionItemActor::forUser(workspaceManager($fixture['retro']->team->workspace)), true, true],
    'workspace owner' => [fn (array $fixture) => ActionItemActor::forUser(workspaceManager($fixture['retro']->team->workspace, WorkspaceRole::Owner)), true, true],
    'member assignee' => [function (array $fixture) {
        [$user, $participant] = retroMember($fixture['retro']);
        $fixture['item']->update(['assignee_user_id' => $user->id]);

        return ActionItemActor::forParticipant($participant);
    }, false, true],
    'guest assignee' => [function (array $fixture) {
        $guest = Participant::factory()->guest()->create(['retro_id' => $fixture['retro']->id]);
        $fixture['item']->update(['assignee_participant_id' => $guest->id]);

        return ActionItemActor::forParticipant($guest);
    }, false, true],
    'other member' => [fn (array $fixture) => ActionItemActor::forParticipant(retroMember($fixture['retro'])[1]), false, false],
    'other guest' => [fn (array $fixture) => ActionItemActor::forParticipant(Participant::factory()->guest()->create(['retro_id' => $fixture['retro']->id])), false, false],
]);

it('lets the facilitator of a running retro of the team complete earlier items', function () {
    $fixture = permissionsFixture();
    $fixture['retro']->update(['phase' => RetroPhase::Completed]);
    $next = Retro::factory()->create(['team_id' => $fixture['retro']->team_id]);
    [$user, $participant] = retroFacilitator($next);
    $elsewhere = Retro::factory()->create();
    [$strangerUser] = retroFacilitator($elsewhere);
    $item = $fixture['item']->fresh();
    $permissions = app(ActionItemPermissions::class);

    expect($permissions->canComplete($item, ActionItemActor::forParticipant($participant)))->toBeTrue()
        ->and($permissions->canComplete($item, ActionItemActor::forUser($user)))->toBeTrue()
        ->and($permissions->canEdit($item, ActionItemActor::forUser($user)))->toBeFalse()
        ->and($permissions->canComplete($item, ActionItemActor::forUser($strangerUser)))->toBeFalse();

    $next->update(['phase' => RetroPhase::Completed]);

    expect($permissions->canComplete($item, ActionItemActor::forUser($user)))->toBeFalse();
});

it('keeps items without a retro to their author and workspace admins', function () {
    $team = Team::factory()->create();
    $author = teamMember($team);
    $other = teamMember($team);
    $admin = workspaceManager($team->workspace);
    $item = ActionItem::factory()->withoutRetro($team, $author)->create();
    $permissions = app(ActionItemPermissions::class);

    expect($permissions->canCreateWithoutRetro($other, $team))->toBeTrue()
        ->and($permissions->canCreateWithoutRetro($admin, $team))->toBeFalse()
        ->and($permissions->canEdit($item, ActionItemActor::forUser($author)))->toBeTrue()
        ->and($permissions->canEdit($item, ActionItemActor::forUser($admin)))->toBeTrue()
        ->and($permissions->canEdit($item, ActionItemActor::forUser($other)))->toBeFalse()
        ->and($permissions->canComplete($item, ActionItemActor::forUser($other)))->toBeFalse()
        ->and($permissions->canComment($item, ActionItemActor::forUser($other)))->toBeTrue()
        ->and($permissions->canComment($item, ActionItemActor::forUser(teamMember(Team::factory()->create()))))->toBeFalse();

    $item->update(['assignee_user_id' => $other->id]);

    expect($permissions->canComplete($item->fresh(), ActionItemActor::forUser($other)))->toBeTrue();
});

it('lets comment authors edit and managers delete comments', function () {
    $fixture = permissionsFixture();
    [$memberUser, $member] = retroMember($fixture['retro']);
    $comment = ActionItemComment::factory()->byParticipant($member)->create(['action_item_id' => $fixture['item']->id]);
    $permissions = app(ActionItemPermissions::class);

    expect($permissions->canEditComment($comment, ActionItemActor::forParticipant($member)))->toBeTrue()
        ->and($permissions->canEditComment($comment, ActionItemActor::forUser($memberUser)))->toBeTrue()
        ->and($permissions->canEditComment($comment, ActionItemActor::forParticipant($fixture['author'])))->toBeFalse()
        ->and($permissions->canDeleteComment($comment, ActionItemActor::forParticipant($fixture['author'])))->toBeTrue()
        ->and($permissions->canDeleteComment($comment, ActionItemActor::forParticipant(retroMember($fixture['retro'])[1])))->toBeFalse();
});

it('explains refusals', function () {
    $fixture = permissionsFixture();
    $stranger = ActionItemActor::forParticipant(retroMember($fixture['retro'])[1]);
    $team = $fixture['retro']->team;
    $permissions = app(ActionItemPermissions::class);

    expect(fn () => $permissions->authorizeEdit($fixture['item'], $stranger))
        ->toThrow(AuthorizationException::class, 'Only the author, the facilitator or an admin can change this action item.')
        ->and(fn () => $permissions->authorizeComplete($fixture['item'], $stranger))
        ->toThrow(AuthorizationException::class, 'Only the assignee or a manager can complete this action item.')
        ->and(fn () => $permissions->authorizeCreateWithoutRetro(workspaceManager($team->workspace), $team))
        ->toThrow(AuthorizationException::class, 'Only team members can add action items to this team.');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems/ActionItemPermissionsTest.php`
Expected: FAIL with `Class "App\Actions\ActionItems\ActionItemActor" not found`.

- [ ] **Step 3: Actors**

`app/Actions/ActionItems/ActionItemActor.php`:

```php
<?php

namespace App\Actions\ActionItems;

use App\Models\Participant;
use App\Models\User;

class ActionItemActor
{
    public function __construct(public ?User $user, public ?Participant $participant) {}

    public static function forParticipant(Participant $participant): self
    {
        return new self($participant->user, $participant);
    }

    public static function forUser(User $user): self
    {
        return new self($user, null);
    }
}
```

`app/Actions/ActionItems/ExternalSyncActor.php`:

```php
<?php

namespace App\Actions\ActionItems;

/**
 * The inbound status sync of an issue tracker (spec 8). It bypasses
 * permissions and board rules; no endpoint can construct it from a request.
 */
class ExternalSyncActor
{
    public function __construct(public string $source, public string $key) {}
}
```

- [ ] **Step 4: Permissions**

`app/Actions/ActionItems/ActionItemPermissions.php`:

```php
<?php

namespace App\Actions\ActionItems;

use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\ActionItemComment;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;

class ActionItemPermissions
{
    public function canCreateWithoutRetro(User $user, Team $team): bool
    {
        return $team->hasMember($user);
    }

    public function canEdit(ActionItem $item, ActionItemActor $actor): bool
    {
        return $this->isManager($item, $actor);
    }

    public function canDelete(ActionItem $item, ActionItemActor $actor): bool
    {
        return $this->isManager($item, $actor);
    }

    public function canComplete(ActionItem $item, ActionItemActor $actor): bool
    {
        if ($this->isManager($item, $actor)) {
            return true;
        }

        if ($this->isAssignee($item, $actor)) {
            return true;
        }

        return $this->isReviewFacilitator($item, $actor);
    }

    public function canComment(ActionItem $item, ActionItemActor $actor): bool
    {
        if ($actor->participant !== null && $item->retro_id !== null && $actor->participant->retro_id === $item->retro_id) {
            return true;
        }

        return $actor->user?->can('view', $item->team) ?? false;
    }

    public function canEditComment(ActionItemComment $comment, ActionItemActor $actor): bool
    {
        return $this->isCommentAuthor($comment, $actor);
    }

    public function canDeleteComment(ActionItemComment $comment, ActionItemActor $actor): bool
    {
        if ($this->isCommentAuthor($comment, $actor)) {
            return true;
        }

        return $this->isManager($comment->actionItem, $actor);
    }

    public function authorizeCreateWithoutRetro(User $user, Team $team): void
    {
        if ($this->canCreateWithoutRetro($user, $team)) {
            return;
        }

        throw new AuthorizationException(__('Only team members can add action items to this team.'));
    }

    public function authorizeEdit(ActionItem $item, ActionItemActor $actor): void
    {
        if ($this->canEdit($item, $actor)) {
            return;
        }

        throw new AuthorizationException(__('Only the author, the facilitator or an admin can change this action item.'));
    }

    public function authorizeDelete(ActionItem $item, ActionItemActor $actor): void
    {
        if ($this->canDelete($item, $actor)) {
            return;
        }

        throw new AuthorizationException(__('Only the author, the facilitator or an admin can change this action item.'));
    }

    public function authorizeComplete(ActionItem $item, ActionItemActor $actor): void
    {
        if ($this->canComplete($item, $actor)) {
            return;
        }

        throw new AuthorizationException(__('Only the assignee or a manager can complete this action item.'));
    }

    public function authorizeComment(ActionItem $item, ActionItemActor $actor): void
    {
        if ($this->canComment($item, $actor)) {
            return;
        }

        throw new AuthorizationException(__('You cannot comment on this action item.'));
    }

    public function authorizeEditComment(ActionItemComment $comment, ActionItemActor $actor): void
    {
        if ($this->canEditComment($comment, $actor)) {
            return;
        }

        throw new AuthorizationException(__('You can only change your own comments.'));
    }

    public function authorizeDeleteComment(ActionItemComment $comment, ActionItemActor $actor): void
    {
        if ($this->canDeleteComment($comment, $actor)) {
            return;
        }

        throw new AuthorizationException(__('Only the author of the comment or a manager can delete it.'));
    }

    public function isAuthor(ActionItem $item, ActionItemActor $actor): bool
    {
        if ($actor->participant !== null && $item->created_by_participant_id === $actor->participant->id) {
            return true;
        }

        return $actor->user !== null && $item->created_by_user_id === $actor->user->id;
    }

    public function isCommentAuthor(ActionItemComment $comment, ActionItemActor $actor): bool
    {
        if ($actor->participant !== null && $comment->author_participant_id === $actor->participant->id) {
            return true;
        }

        if ($actor->user === null) {
            return false;
        }

        if ($comment->author_user_id === $actor->user->id) {
            return true;
        }

        return $comment->authorParticipant?->user_id === $actor->user->id;
    }

    private function isManager(ActionItem $item, ActionItemActor $actor): bool
    {
        if ($this->isAuthor($item, $actor)) {
            return true;
        }

        if ($this->isRetroFacilitator($item->retro, $actor)) {
            return true;
        }

        return $actor->user?->canManage($item->team->workspace) ?? false;
    }

    private function isAssignee(ActionItem $item, ActionItemActor $actor): bool
    {
        if ($actor->user !== null && $item->assignee_user_id === $actor->user->id) {
            return true;
        }

        return $actor->participant !== null && $item->assignee_participant_id === $actor->participant->id;
    }

    private function isRetroFacilitator(?Retro $retro, ActionItemActor $actor): bool
    {
        if ($retro === null || $retro->facilitator_participant_id === null) {
            return false;
        }

        if ($actor->participant !== null && $retro->facilitator_participant_id === $actor->participant->id) {
            return true;
        }

        if ($actor->user === null) {
            return false;
        }

        return $retro->facilitator?->user_id === $actor->user->id;
    }

    /**
     * The facilitator of any running retro of the item's team reviews its
     * follow-ups there, so they may tick them off.
     */
    private function isReviewFacilitator(ActionItem $item, ActionItemActor $actor): bool
    {
        $boardRetro = $actor->participant?->retro;

        if ($boardRetro !== null
            && $boardRetro->team_id === $item->team_id
            && $boardRetro->phase !== RetroPhase::Completed
            && $boardRetro->facilitator_participant_id === $actor->participant?->id) {
            return true;
        }

        if ($actor->user === null) {
            return false;
        }

        $userId = $actor->user->id;

        return Retro::query()
            ->where('team_id', $item->team_id)
            ->where('phase', '!=', RetroPhase::Completed->value)
            ->whereHas('facilitator', fn ($query) => $query->where('user_id', $userId))
            ->exists();
    }
}
```

- [ ] **Step 5: Translations**

| Key | fr | es | de |
|---|---|---|---|
| `Only team members can add action items to this team.` | `Seuls les membres de l'équipe peuvent ajouter des actions à cette équipe.` | `Solo los miembros del equipo pueden añadir acciones a este equipo.` | `Nur Teammitglieder können diesem Team Aktionspunkte hinzufügen.` |
| `Only the author, the facilitator or an admin can change this action item.` | `Seuls l'auteur, l'animateur ou un administrateur peuvent modifier cette action.` | `Solo el autor, el facilitador o un administrador pueden cambiar esta acción.` | `Nur der Autor, der Moderator oder ein Admin kann diesen Aktionspunkt ändern.` |
| `Only the assignee or a manager can complete this action item.` | `Seuls la personne assignée ou un responsable peuvent terminer cette action.` | `Solo la persona asignada o un responsable puede completar esta acción.` | `Nur die zugewiesene Person oder ein Verantwortlicher kann diesen Aktionspunkt abschließen.` |
| `You cannot comment on this action item.` | `Vous ne pouvez pas commenter cette action.` | `No puedes comentar esta acción.` | `Du kannst diesen Aktionspunkt nicht kommentieren.` |
| `Only the author of the comment or a manager can delete it.` | `Seuls l'auteur du commentaire ou un responsable peuvent le supprimer.` | `Solo el autor del comentario o un responsable puede eliminarlo.` | `Nur der Autor des Kommentars oder ein Verantwortlicher kann ihn löschen.` |

- [ ] **Step 6: Run tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems/ActionItemPermissionsTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 7: Pint, phpstan, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/ActionItems/ActionItemActor.php app/Actions/ActionItems/ExternalSyncActor.php app/Actions/ActionItems/ActionItemPermissions.php tests/Feature/ActionItems/ActionItemPermissionsTest.php lang
git commit -m "feat: decide who edits, completes and comments on action items

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 3: `PresentActionItem` v2

**Files:**
- Modify: `app/Actions/Retros/PresentActionItem.php`, `app/Actions/Retros/BuildBoardSnapshot.php`, `app/Actions/ActionItems/CreateActionItem.php`, `app/Http/Controllers/Retros/ActionItemsController.php`, `tests/Feature/Retros/BoardSnapshotTest.php`, `tests/Feature/Retros/ActionItemsTest.php`
- Test: create `tests/Feature/ActionItems/PresentActionItemTest.php`

**Interfaces:**
- Consumes: `ActionItem::presentationRelations()`, `loadForPresentation()`, `today()`, `isOverdue()` (Task 1); `ActionItemPermissions::isAuthor()`, `ActionItemActor` (Task 2).
- Produces: `PresentActionItem::handle(ActionItem $item, ?ActionItemActor $viewer = null, ?CarbonInterface $today = null): array` with exactly the keys, in this order: `id, retroId, teamId, content, priority, dueOn, isOverdue, status, completedAt, assignee {kind, id, name, avatarUrl, isTeamMember}|null, createdBy {name, avatarUrl}|null, isMine, commentCount, source {retroTitle, retroCreatedAt, retroUrl}|null, themeId, themeName, createdAt`; `PresentActionItem::many(iterable<ActionItem> $items, ?ActionItemActor $viewer = null): array<int, array<string, mixed>>`. Snapshot `actionItems` uses this shape with the viewer (`isMine` set for the author). `source.retroUrl` is always the retro URL: everyone who can read an item can open its retro (participants of it, or viewers of its team).

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/ActionItems/PresentActionItemTest.php`:

```php
<?php

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\Retros\PresentActionItem;
use App\Enums\ActionItemPriority;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\ActionItemComment;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use Carbon\CarbonImmutable;

function presentedActionItem(ActionItem $item, ?ActionItemActor $viewer = null): array
{
    return app(PresentActionItem::class)->handle($item->fresh()->loadForPresentation(), $viewer);
}

it('presents every field of a board item', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00:00'));
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['title' => 'Sprint 12']);
    [$authorUser, $author] = retroMember($retro);
    [$assignee] = retroMember($retro);
    $item = ActionItem::factory()->assignedTo($assignee)->priority(ActionItemPriority::High)->create([
        'retro_id' => $retro->id,
        'created_by_participant_id' => $author->id,
        'content' => 'Speed up CI',
        'due_on' => '2026-10-03',
    ]);
    ActionItemComment::factory()->count(2)->create(['action_item_id' => $item->id]);

    expect(presentedActionItem($item))->toBe([
        'id' => $item->id,
        'retroId' => $retro->id,
        'teamId' => $retro->team_id,
        'content' => 'Speed up CI',
        'priority' => 'high',
        'dueOn' => '2026-10-03',
        'isOverdue' => true,
        'status' => 'open',
        'completedAt' => null,
        'assignee' => [
            'kind' => 'member',
            'id' => $assignee->id,
            'name' => $assignee->name,
            'avatarUrl' => $assignee->avatarUrl(),
            'isTeamMember' => true,
        ],
        'createdBy' => ['name' => $authorUser->name, 'avatarUrl' => $author->avatarUrl()],
        'isMine' => false,
        'commentCount' => 2,
        'source' => [
            'retroTitle' => 'Sprint 12',
            'retroCreatedAt' => $retro->created_at?->toIso8601String(),
            'retroUrl' => route('retros.show', $retro),
        ],
        'themeId' => null,
        'themeName' => null,
        'createdAt' => $item->created_at?->toIso8601String(),
    ]);
});

it('presents guest assignees, completion and items without a retro', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Robin']);
    $guestItem = ActionItem::factory()->assignedToGuest($guest)->completed()->create();
    $team = Team::factory()->create();
    $author = teamMember($team);
    $teamItem = ActionItem::factory()->withoutRetro($team, $author)->create();

    expect(presentedActionItem($guestItem))->toMatchArray([
        'assignee' => ['kind' => 'guest', 'id' => $guest->id, 'name' => 'Robin', 'avatarUrl' => $guest->avatarUrl(), 'isTeamMember' => false],
        'status' => 'completed',
        'isOverdue' => false,
    ])
        ->and(presentedActionItem($guestItem)['completedAt'])->not->toBeNull()
        ->and(presentedActionItem($teamItem))->toMatchArray([
            'retroId' => null,
            'source' => null,
            'createdBy' => ['name' => $author->name, 'avatarUrl' => $author->avatarUrl()],
        ]);
});

it('names the creator on anonymous retros', function () {
    $retro = Retro::factory()->anonymous()->inPhase(RetroPhase::Discussing)->create();
    [$authorUser, $author] = retroMember($retro);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $author->id]);

    expect(presentedActionItem($item)['createdBy'])->toBe(['name' => $authorUser->name, 'avatarUrl' => $author->avatarUrl()]);
});

it('tells the viewer which items are theirs', function () {
    $retro = Retro::factory()->create();
    [$user, $author] = retroMember($retro);
    [, $other] = retroMember($retro);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $author->id]);

    expect(presentedActionItem($item, ActionItemActor::forParticipant($author))['isMine'])->toBeTrue()
        ->and(presentedActionItem($item, ActionItemActor::forUser($user))['isMine'])->toBeTrue()
        ->and(presentedActionItem($item, ActionItemActor::forParticipant($other))['isMine'])->toBeFalse()
        ->and(presentedActionItem($item)['isMine'])->toBeFalse();
});

it('flags assignees who left the team and forgets deleted authors', function () {
    $retro = Retro::factory()->create();
    [$assignee] = retroMember($retro);
    $team = $retro->team;
    $author = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $author)->assignedTo($assignee)->create();

    $team->members()->detach($assignee);
    $author->delete();

    expect(presentedActionItem($item)['createdBy'])->toBeNull()
        ->and(presentedActionItem($item)['assignee']['isTeamMember'])->toBeFalse();
});
```

In `tests/Feature/Retros/BoardSnapshotTest.php` replace the test `it('lists action items with assignees', …)` with:

```php
it('lists action items with assignees', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user, $viewer] = retroMember($retro);
    $item = ActionItem::factory()->assignedTo($user)->create([
        'retro_id' => $retro->id,
        'created_by_participant_id' => $viewer->id,
        'content' => 'Fix CI',
    ]);

    $actionItems = snapshotFor($retro, $viewer)['actionItems'];

    expect($actionItems)->toHaveCount(1)
        ->and($actionItems[0])->toMatchArray([
            'id' => $item->id,
            'content' => 'Fix CI',
            'status' => 'open',
            'assignee' => ['kind' => 'member', 'id' => $user->id, 'name' => $user->name, 'avatarUrl' => $user->avatarUrl(), 'isTeamMember' => true],
            'isMine' => true,
            'themeId' => null,
            'themeName' => null,
        ]);
});
```

In `tests/Feature/Retros/ActionItemsTest.php` (rewritten in Task 6) replace `->assertJsonPath('actionItem.isDone', true)` with `->assertJsonPath('actionItem.status', 'completed')`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems/PresentActionItemTest.php tests/Feature/Retros/BoardSnapshotTest.php`
Expected: FAIL (`Failed asserting that two arrays are identical`, missing keys `retroId`, `status`).

- [ ] **Step 3: The presenter**

Replace `app/Actions/Retros/PresentActionItem.php`:

```php
<?php

namespace App\Actions\Retros;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ActionItemPermissions;
use App\Enums\ActionItemStatus;
use App\Models\ActionItem;
use Carbon\CarbonInterface;

class PresentActionItem
{
    public function __construct(private ActionItemPermissions $permissions) {}

    /**
     * Creators and assignees are always named, also on anonymous retros.
     *
     * @return array{
     *     id: string,
     *     retroId: ?string,
     *     teamId: string,
     *     content: string,
     *     priority: string,
     *     dueOn: ?string,
     *     isOverdue: bool,
     *     status: string,
     *     completedAt: ?string,
     *     assignee: ?array{kind: string, id: string, name: string, avatarUrl: string, isTeamMember: bool},
     *     createdBy: ?array{name: string, avatarUrl: string},
     *     isMine: bool,
     *     commentCount: int,
     *     source: ?array{retroTitle: string, retroCreatedAt: ?string, retroUrl: string},
     *     themeId: ?string,
     *     themeName: ?string,
     *     createdAt: ?string
     * }
     */
    public function handle(ActionItem $item, ?ActionItemActor $viewer = null, ?CarbonInterface $today = null): array
    {
        return [
            'id' => $item->id,
            'retroId' => $item->retro_id,
            'teamId' => $item->team_id,
            'content' => $item->content,
            'priority' => $item->priority->value,
            'dueOn' => $item->due_on?->toDateString(),
            'isOverdue' => $item->isOverdue($today ?? ActionItem::today()),
            'status' => $item->isCompleted() ? ActionItemStatus::Completed->value : ActionItemStatus::Open->value,
            'completedAt' => $item->completed_at?->toIso8601String(),
            'assignee' => $this->assignee($item),
            'createdBy' => $this->createdBy($item),
            'isMine' => $viewer !== null && $this->permissions->isAuthor($item, $viewer),
            'commentCount' => (int) ($item->comments_count ?? $item->comments()->count()),
            'source' => $this->source($item),
            'themeId' => $item->theme_id,
            'themeName' => $item->theme_name,
            'createdAt' => $item->created_at?->toIso8601String(),
        ];
    }

    /**
     * @param  iterable<ActionItem>  $items
     * @return array<int, array<string, mixed>>
     */
    public function many(iterable $items, ?ActionItemActor $viewer = null): array
    {
        $today = ActionItem::today();
        $presented = [];

        foreach ($items as $item) {
            $presented[] = $this->handle($item, $viewer, $today);
        }

        return $presented;
    }

    /**
     * @return ?array{kind: string, id: string, name: string, avatarUrl: string, isTeamMember: bool}
     */
    private function assignee(ActionItem $item): ?array
    {
        $user = $item->assigneeUser;

        if ($user !== null) {
            return [
                'kind' => 'member',
                'id' => $user->id,
                'name' => $user->name,
                'avatarUrl' => $user->avatarUrl(),
                'isTeamMember' => $item->team->members->contains('id', $user->id),
            ];
        }

        $participant = $item->assigneeParticipant;

        if ($participant === null) {
            return null;
        }

        return [
            'kind' => 'guest',
            'id' => $participant->id,
            'name' => $participant->displayName(),
            'avatarUrl' => $participant->avatarUrl(),
            'isTeamMember' => false,
        ];
    }

    /**
     * @return ?array{name: string, avatarUrl: string}
     */
    private function createdBy(ActionItem $item): ?array
    {
        $participant = $item->createdByParticipant;

        if ($participant !== null) {
            return ['name' => $participant->displayName(), 'avatarUrl' => $participant->avatarUrl()];
        }

        $author = $item->author;

        if ($author === null) {
            return null;
        }

        return ['name' => $author->name, 'avatarUrl' => $author->avatarUrl()];
    }

    /**
     * @return ?array{retroTitle: string, retroCreatedAt: ?string, retroUrl: string}
     */
    private function source(ActionItem $item): ?array
    {
        $retro = $item->retro;

        if ($retro === null) {
            return null;
        }

        return [
            'retroTitle' => $retro->title,
            'retroCreatedAt' => $retro->created_at?->toIso8601String(),
            'retroUrl' => route('retros.show', $retro),
        ];
    }
}
```

- [ ] **Step 4: Load and present with the viewer**

In `app/Actions/Retros/BuildBoardSnapshot.php`:
- add `use App\Actions\ActionItems\ActionItemActor;`
- in `loadMissing([...])` replace `'actionItems.assigneeParticipant.user',` with

```php
            'actionItems' => fn ($query) => $query->with(ActionItem::presentationRelations())->withCount('comments'),
```

- replace the `'actionItems' => …` entry of the returned array with

```php
            'actionItems' => $this->presentActionItem->many(
                $retro->actionItems->sortBy('created_at'),
                ActionItemActor::forParticipant($viewer),
            ),
```

In `app/Actions/ActionItems/CreateActionItem.php` replace `$actionItem->load('assigneeParticipant.user');` with `$actionItem->loadForPresentation();`.

In `app/Http/Controllers/Retros/ActionItemsController.php` (`update()`) replace `$fresh->load('assigneeParticipant.user');` with `$fresh->loadForPresentation();`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems tests/Feature/Retros`
Expected: PASS.

- [ ] **Step 6: Pint, phpstan, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/Retros/PresentActionItem.php app/Actions/Retros/BuildBoardSnapshot.php app/Actions/ActionItems/CreateActionItem.php app/Http/Controllers/Retros/ActionItemsController.php tests/Feature/ActionItems/PresentActionItemTest.php tests/Feature/Retros/BoardSnapshotTest.php tests/Feature/Retros/ActionItemsTest.php
git commit -m "feat: present action items with priority, due date, status and named people

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 4: Realtime fan-out (`BroadcastActionItemChange`, new channels)

**Files:**
- Create: `app/Actions/ActionItems/BroadcastActionItemChange.php`, `app/Events/Retros/ActionItemCommentsChanged.php`, `app/Events/Retros/RetroMembersBroadcastEvent.php`, `app/Events/Retros/CarriedActionItemSaved.php`, `app/Events/Retros/CarriedActionItemRemoved.php`, `app/Events/Retros/CarriedActionItemCommentsChanged.php`, `app/Events/ActionItems/TeamActionItemsBroadcastEvent.php`, `app/Events/ActionItems/TeamActionItemSaved.php`, `app/Events/ActionItems/TeamActionItemDeleted.php`, `app/Events/ActionItems/TeamActionItemCommentsChanged.php`
- Modify: `app/Http/Controllers/BroadcastAuthorizationsController.php`, `tests/Feature/Retros/BroadcastAuthorizationTest.php`
- Test: create `tests/Feature/ActionItems/ActionItemBroadcastsTest.php`

**Interfaces:**
- Consumes: `PresentActionItem::handle()` (Task 3), `ActionItem::loadForPresentation()` (Task 1), existing `ActionItemSaved(string $retroId, array $actionItem)` and `ActionItemDeleted(string $retroId, string $actionItemId)`, `RetroBroadcastEvent`.
- Produces: `BroadcastActionItemChange::saved(ActionItem $item): void`, `::deleted(ActionItem $item): void` (call after `delete()`), `::commentsChanged(ActionItem $item): void`, `::carryingRetroIds(ActionItem $item): array<int, string>`; events `action-item.comments.changed` (`ActionItemCommentsChanged(string $retroId, string $actionItemId, int $commentCount)`), `carried-action-item.saved` (`CarriedActionItemSaved(string $retroId, array $actionItem)`), `carried-action-item.removed` (`CarriedActionItemRemoved(string $retroId, string $actionItemId)`), `carried-action-item.comments.changed` (`CarriedActionItemCommentsChanged(string $retroId, string $actionItemId, int $commentCount)`) on `private-retro-members.{retroId}`; `team-action-item.saved` (`TeamActionItemSaved(string $teamId, array $actionItem)`), `team-action-item.deleted` (`TeamActionItemDeleted(string $teamId, string $actionItemId)`), `team-action-item.comments.changed` (`TeamActionItemCommentsChanged(string $teamId, string $actionItemId, int $commentCount)`) on `private-team-action-items.{teamId}`; channel authorization for both private channels.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/ActionItems/ActionItemBroadcastsTest.php`:

```php
<?php

use App\Actions\ActionItems\BroadcastActionItemChange;
use App\Enums\RetroPhase;
use App\Events\ActionItems\TeamActionItemCommentsChanged;
use App\Events\ActionItems\TeamActionItemDeleted;
use App\Events\ActionItems\TeamActionItemSaved;
use App\Events\Retros\ActionItemCommentsChanged;
use App\Events\Retros\ActionItemDeleted;
use App\Events\Retros\ActionItemSaved;
use App\Events\Retros\CarriedActionItemCommentsChanged;
use App\Events\Retros\CarriedActionItemRemoved;
use App\Events\Retros\CarriedActionItemSaved;
use App\Models\ActionItem;
use App\Models\ActionItemComment;
use App\Models\Retro;
use App\Models\Team;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('sends board, carried and team events', function () {
    $team = Team::factory()->create();
    $source = Retro::factory()->anonymous()->inPhase(RetroPhase::Discussing)->create(['team_id' => $team->id, 'created_at' => now()->subDays(14)]);
    $running = Retro::factory()->create(['team_id' => $team->id, 'created_at' => now()->subDay()]);
    Retro::factory()->inPhase(RetroPhase::Completed)->create(['team_id' => $team->id, 'created_at' => now()->subDays(7)]);
    Retro::factory()->create(['created_at' => now()->subDay()]);
    [$authorUser, $author] = retroMember($source);
    $item = ActionItem::factory()->create(['retro_id' => $source->id, 'created_by_participant_id' => $author->id]);

    app(BroadcastActionItemChange::class)->saved($item);

    Event::assertDispatched(ActionItemSaved::class, fn (ActionItemSaved $event) => $event->retroId === $source->id
        && $event->actionItem['isMine'] === false
        && $event->actionItem['createdBy']['name'] === $authorUser->name);
    Event::assertDispatchedTimes(CarriedActionItemSaved::class, 1);
    Event::assertDispatched(CarriedActionItemSaved::class, fn (CarriedActionItemSaved $event) => $event->retroId === $running->id
        && $event->broadcastOn()->name === "private-retro-members.{$running->id}"
        && $event->broadcastAs() === 'carried-action-item.saved'
        && $event->broadcastWith()['actionItem']['createdBy']['name'] === $authorUser->name);
    Event::assertDispatched(TeamActionItemSaved::class, fn (TeamActionItemSaved $event) => $event->teamId === $team->id
        && $event->broadcastOn()->name === "private-team-action-items.{$team->id}"
        && $event->broadcastAs() === 'team-action-item.saved'
        && $event->broadcastWith()['actionItem']['isMine'] === false);
});

it('sends no board event for completed retros or items without a retro', function () {
    $team = Team::factory()->create();
    $finished = Retro::factory()->inPhase(RetroPhase::Completed)->create(['team_id' => $team->id]);
    $finishedItem = ActionItem::factory()->create(['retro_id' => $finished->id]);
    $teamItem = ActionItem::factory()->withoutRetro($team, teamMember($team))->create();

    app(BroadcastActionItemChange::class)->saved($finishedItem);
    app(BroadcastActionItemChange::class)->saved($teamItem);

    Event::assertNotDispatched(ActionItemSaved::class);
    Event::assertDispatchedTimes(TeamActionItemSaved::class, 2);
});

it('targets exactly the retros that carry the item', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-01 10:00:00'));
    $team = Team::factory()->create();
    $source = Retro::factory()->inPhase(RetroPhase::Completed)->create(['team_id' => $team->id, 'created_at' => '2026-09-01 10:00:00']);
    Retro::factory()->create(['team_id' => $team->id, 'created_at' => '2026-08-01 10:00:00']);
    $beforeCompletion = Retro::factory()->create(['team_id' => $team->id, 'created_at' => '2026-09-10 10:00:00']);
    $afterCompletion = Retro::factory()->create(['team_id' => $team->id, 'created_at' => '2026-09-20 10:00:00']);
    Retro::factory()->inPhase(RetroPhase::Completed)->create(['team_id' => $team->id, 'created_at' => '2026-09-25 10:00:00']);
    $item = ActionItem::factory()->create(['retro_id' => $source->id, 'completed_at' => '2026-09-15 10:00:00']);
    $teamItem = ActionItem::factory()->withoutRetro($team, teamMember($team))->create(['created_at' => '2026-09-12 10:00:00']);
    $broadcast = app(BroadcastActionItemChange::class);

    expect($broadcast->carryingRetroIds($item->fresh()))->toBe([$beforeCompletion->id])
        ->and($broadcast->carryingRetroIds($teamItem->fresh()))->toBe([$afterCompletion->id]);
});

it('announces deletions and comment counts on every channel', function () {
    $team = Team::factory()->create();
    $source = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['team_id' => $team->id, 'created_at' => now()->subWeek()]);
    $running = Retro::factory()->create(['team_id' => $team->id]);
    $item = ActionItem::factory()->create(['retro_id' => $source->id]);
    ActionItemComment::factory()->count(3)->create(['action_item_id' => $item->id]);
    $broadcast = app(BroadcastActionItemChange::class);

    $broadcast->commentsChanged($item);
    $item->delete();
    $broadcast->deleted($item);

    $counts = ['actionItemId' => $item->id, 'commentCount' => 3];

    Event::assertDispatched(ActionItemCommentsChanged::class, fn (ActionItemCommentsChanged $event) => $event->retroId === $source->id
        && $event->broadcastAs() === 'action-item.comments.changed'
        && $event->broadcastWith() === $counts);
    Event::assertDispatched(CarriedActionItemCommentsChanged::class, fn (CarriedActionItemCommentsChanged $event) => $event->retroId === $running->id
        && $event->broadcastAs() === 'carried-action-item.comments.changed'
        && $event->broadcastWith() === $counts);
    Event::assertDispatched(TeamActionItemCommentsChanged::class, fn (TeamActionItemCommentsChanged $event) => $event->teamId === $team->id
        && $event->broadcastAs() === 'team-action-item.comments.changed'
        && $event->broadcastWith() === $counts);
    Event::assertDispatched(ActionItemDeleted::class, fn (ActionItemDeleted $event) => $event->retroId === $source->id && $event->actionItemId === $item->id);
    Event::assertDispatched(CarriedActionItemRemoved::class, fn (CarriedActionItemRemoved $event) => $event->retroId === $running->id
        && $event->broadcastAs() === 'carried-action-item.removed'
        && $event->broadcastWith() === ['actionItemId' => $item->id]);
    Event::assertDispatched(TeamActionItemDeleted::class, fn (TeamActionItemDeleted $event) => $event->teamId === $team->id
        && $event->broadcastAs() === 'team-action-item.deleted'
        && $event->broadcastWith() === ['actionItemId' => $item->id]);
});
```

Append to `tests/Feature/Retros/BroadcastAuthorizationTest.php` (add `use App\Models\Team;` to its imports):

```php
function privateChannelRequest(string $channel): array
{
    return ['socket_id' => '1234.5678', 'channel_name' => $channel];
}

it('lets members join the carried action items channel', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);

    $response = $this->actingAs($user)
        ->postJson(route('broadcasting.auth'), privateChannelRequest("private-retro-members.{$retro->id}"))
        ->assertOk();

    expect($response->json('auth'))->toStartWith('test-key:');
});

it('keeps guests and outsiders out of the carried action items channel', function (bool $asGuest) {
    $retro = Retro::factory()->withGuestAccess()->create();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $request = $asGuest
        ? $this->withCookies(retroGuestCookie($guest))->withCredentials()
        : $this->actingAs(User::factory()->create());

    $request->postJson(route('broadcasting.auth'), privateChannelRequest("private-retro-members.{$retro->id}"))
        ->assertForbidden();
})->with(['guest' => true, 'outsider' => false]);

it('lets team members and workspace admins join the team action items channel', function (bool $asAdmin) {
    $team = Team::factory()->create();
    $user = $asAdmin ? workspaceManager($team->workspace) : teamMember($team);

    $this->actingAs($user)
        ->postJson(route('broadcasting.auth'), privateChannelRequest("private-team-action-items.{$team->id}"))
        ->assertOk();
})->with(['member' => false, 'admin' => true]);

it('keeps other teams, guests and visitors out of the team action items channel', function (string $who) {
    $retro = Retro::factory()->withGuestAccess()->create();
    $team = $retro->team;
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $request = match ($who) {
        'other team' => $this->actingAs(teamMember(Team::factory()->create(['workspace_id' => $team->workspace_id]))),
        'guest' => $this->withCookies(retroGuestCookie($guest))->withCredentials(),
        'visitor' => $this,
    };

    $request->postJson(route('broadcasting.auth'), privateChannelRequest("private-team-action-items.{$team->id}"))
        ->assertForbidden();
})->with(['other team', 'guest', 'visitor']);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems/ActionItemBroadcastsTest.php tests/Feature/Retros/BroadcastAuthorizationTest.php`
Expected: FAIL with `Class "App\Actions\ActionItems\BroadcastActionItemChange" not found` and 403s on the new channels.

- [ ] **Step 3: Board-side events**

`app/Events/Retros/ActionItemCommentsChanged.php`:

```php
<?php

namespace App\Events\Retros;

class ActionItemCommentsChanged extends RetroBroadcastEvent
{
    public function __construct(string $retroId, public string $actionItemId, public int $commentCount)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'action-item.comments.changed';
    }

    public function broadcastWith(): array
    {
        return ['actionItemId' => $this->actionItemId, 'commentCount' => $this->commentCount];
    }
}
```

`app/Events/Retros/RetroMembersBroadcastEvent.php`:

```php
<?php

namespace App\Events\Retros;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;

/**
 * Carried action items of earlier retros are for members only, so they
 * travel on a private channel guests cannot join.
 */
abstract class RetroMembersBroadcastEvent extends RetroBroadcastEvent
{
    public function broadcastOn(): Channel
    {
        return new PrivateChannel("retro-members.{$this->retroId}");
    }
}
```

`app/Events/Retros/CarriedActionItemSaved.php`:

```php
<?php

namespace App\Events\Retros;

class CarriedActionItemSaved extends RetroMembersBroadcastEvent
{
    /**
     * @param  array<string, mixed>  $actionItem
     */
    public function __construct(string $retroId, public array $actionItem)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'carried-action-item.saved';
    }

    public function broadcastWith(): array
    {
        return ['actionItem' => $this->actionItem];
    }
}
```

`app/Events/Retros/CarriedActionItemRemoved.php`:

```php
<?php

namespace App\Events\Retros;

class CarriedActionItemRemoved extends RetroMembersBroadcastEvent
{
    public function __construct(string $retroId, public string $actionItemId)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'carried-action-item.removed';
    }

    public function broadcastWith(): array
    {
        return ['actionItemId' => $this->actionItemId];
    }
}
```

`app/Events/Retros/CarriedActionItemCommentsChanged.php`:

```php
<?php

namespace App\Events\Retros;

class CarriedActionItemCommentsChanged extends RetroMembersBroadcastEvent
{
    public function __construct(string $retroId, public string $actionItemId, public int $commentCount)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'carried-action-item.comments.changed';
    }

    public function broadcastWith(): array
    {
        return ['actionItemId' => $this->actionItemId, 'commentCount' => $this->commentCount];
    }
}
```

- [ ] **Step 4: Team channel events**

`app/Events/ActionItems/TeamActionItemsBroadcastEvent.php`:

```php
<?php

namespace App\Events\ActionItems;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Support\Facades\DB;

abstract class TeamActionItemsBroadcastEvent implements ShouldBroadcastNow, ShouldDispatchAfterCommit
{
    use Dispatchable;
    use InteractsWithSockets;

    public function __construct(public string $teamId) {}

    public function sendToOthers(): void
    {
        DB::afterCommit(function (): void {
            rescue(function (): void {
                broadcast($this)->toOthers();
            });
        });
    }

    public function broadcastOn(): Channel
    {
        return new PrivateChannel("team-action-items.{$this->teamId}");
    }

    abstract public function broadcastAs(): string;

    /**
     * @return array<string, mixed>
     */
    abstract public function broadcastWith(): array;
}
```

`app/Events/ActionItems/TeamActionItemSaved.php`:

```php
<?php

namespace App\Events\ActionItems;

class TeamActionItemSaved extends TeamActionItemsBroadcastEvent
{
    /**
     * @param  array<string, mixed>  $actionItem
     */
    public function __construct(string $teamId, public array $actionItem)
    {
        parent::__construct($teamId);
    }

    public function broadcastAs(): string
    {
        return 'team-action-item.saved';
    }

    public function broadcastWith(): array
    {
        return ['actionItem' => $this->actionItem];
    }
}
```

`app/Events/ActionItems/TeamActionItemDeleted.php`:

```php
<?php

namespace App\Events\ActionItems;

class TeamActionItemDeleted extends TeamActionItemsBroadcastEvent
{
    public function __construct(string $teamId, public string $actionItemId)
    {
        parent::__construct($teamId);
    }

    public function broadcastAs(): string
    {
        return 'team-action-item.deleted';
    }

    public function broadcastWith(): array
    {
        return ['actionItemId' => $this->actionItemId];
    }
}
```

`app/Events/ActionItems/TeamActionItemCommentsChanged.php`:

```php
<?php

namespace App\Events\ActionItems;

class TeamActionItemCommentsChanged extends TeamActionItemsBroadcastEvent
{
    public function __construct(string $teamId, public string $actionItemId, public int $commentCount)
    {
        parent::__construct($teamId);
    }

    public function broadcastAs(): string
    {
        return 'team-action-item.comments.changed';
    }

    public function broadcastWith(): array
    {
        return ['actionItemId' => $this->actionItemId, 'commentCount' => $this->commentCount];
    }
}
```

- [ ] **Step 5: The fan-out**

`app/Actions/ActionItems/BroadcastActionItemChange.php`:

```php
<?php

namespace App\Actions\ActionItems;

use App\Actions\Retros\PresentActionItem;
use App\Enums\RetroPhase;
use App\Events\ActionItems\TeamActionItemCommentsChanged;
use App\Events\ActionItems\TeamActionItemDeleted;
use App\Events\ActionItems\TeamActionItemSaved;
use App\Events\Retros\ActionItemCommentsChanged;
use App\Events\Retros\ActionItemDeleted;
use App\Events\Retros\ActionItemSaved;
use App\Events\Retros\CarriedActionItemCommentsChanged;
use App\Events\Retros\CarriedActionItemRemoved;
use App\Events\Retros\CarriedActionItemSaved;
use App\Models\ActionItem;
use App\Models\Retro;

/**
 * One place decides who hears about an item: its own board while that
 * retro runs, every running retro that carries it, and the team channel of
 * the global page. Payloads are presented without a viewer.
 */
class BroadcastActionItemChange
{
    public function __construct(private PresentActionItem $presentActionItem) {}

    public function saved(ActionItem $item): void
    {
        $item->loadForPresentation();
        $payload = $this->presentActionItem->handle($item);

        if ($this->hasRunningBoard($item)) {
            (new ActionItemSaved((string) $item->retro_id, $payload))->sendToOthers();
        }

        foreach ($this->carryingRetroIds($item) as $retroId) {
            (new CarriedActionItemSaved($retroId, $payload))->sendToOthers();
        }

        (new TeamActionItemSaved($item->team_id, $payload))->sendToOthers();
    }

    /**
     * Called after the delete: the model keeps its attributes.
     */
    public function deleted(ActionItem $item): void
    {
        if ($this->hasRunningBoard($item)) {
            (new ActionItemDeleted((string) $item->retro_id, $item->id))->sendToOthers();
        }

        foreach ($this->carryingRetroIds($item) as $retroId) {
            (new CarriedActionItemRemoved($retroId, $item->id))->sendToOthers();
        }

        (new TeamActionItemDeleted($item->team_id, $item->id))->sendToOthers();
    }

    public function commentsChanged(ActionItem $item): void
    {
        $commentCount = $item->comments()->count();

        if ($this->hasRunningBoard($item)) {
            (new ActionItemCommentsChanged((string) $item->retro_id, $item->id, $commentCount))->sendToOthers();
        }

        foreach ($this->carryingRetroIds($item) as $retroId) {
            (new CarriedActionItemCommentsChanged($retroId, $item->id, $commentCount))->sendToOthers();
        }

        (new TeamActionItemCommentsChanged($item->team_id, $item->id, $commentCount))->sendToOthers();
    }

    /**
     * The running retros of the item's team that list it as a previous
     * action item (same rule as CarriedActionItems).
     *
     * @return array<int, string>
     */
    public function carryingRetroIds(ActionItem $item): array
    {
        $anchor = $item->retro?->created_at ?? $item->created_at;

        /** @var array<int, string> $retroIds */
        $retroIds = Retro::query()
            ->where('team_id', $item->team_id)
            ->where('phase', '!=', RetroPhase::Completed->value)
            ->where('created_at', '>', $anchor)
            ->when($item->completed_at !== null, fn ($query) => $query->where('created_at', '<=', $item->completed_at))
            ->orderBy('created_at')
            ->pluck('id')
            ->all();

        return $retroIds;
    }

    private function hasRunningBoard(ActionItem $item): bool
    {
        return $item->retro !== null && $item->retro->phase !== RetroPhase::Completed;
    }
}
```

- [ ] **Step 6: Channel authorization**

In `app/Http/Controllers/BroadcastAuthorizationsController.php` add `use App\Models\Team;` and, in `store()` before `abort(403);`:

```php
        if (str_starts_with($validated['channel_name'], 'private-retro-members.')) {
            return $this->authorizeRetroMembersChannel($request, $validated, $resolveParticipant);
        }

        if (str_starts_with($validated['channel_name'], 'private-team-action-items.')) {
            return $this->authorizeTeamActionItemsChannel($request, $validated);
        }
```

Add the two methods:

```php
    /**
     * @param  array{socket_id: string, channel_name: string}  $validated
     */
    private function authorizeRetroMembersChannel(Request $request, array $validated, ResolveParticipant $resolveParticipant): JsonResponse
    {
        $retroId = Str::after($validated['channel_name'], 'private-retro-members.');

        abort_unless(Str::isUuid($retroId), 403);

        $retro = Retro::query()->find($retroId);

        abort_if($retro === null, 403);
        abort_unless($retro->id === $retroId, 403);

        $participant = $resolveParticipant->handle($request, $retro);

        abort_if($participant === null || $participant->isGuest(), 403);

        $signature = $this->pusher()->authorizeChannel($validated['channel_name'], $validated['socket_id']);

        return response()->json(json_decode($signature, true));
    }

    /**
     * Only an authenticated user who can view the team; a guest cookie
     * never grants it.
     *
     * @param  array{socket_id: string, channel_name: string}  $validated
     */
    private function authorizeTeamActionItemsChannel(Request $request, array $validated): JsonResponse
    {
        $teamId = Str::after($validated['channel_name'], 'private-team-action-items.');

        abort_unless(Str::isUuid($teamId), 403);

        $user = $request->user();

        abort_if($user === null, 403);

        $team = Team::query()->find($teamId);

        abort_if($team === null, 403);
        abort_unless($team->id === $teamId, 403);
        abort_unless($user->can('view', $team), 403);

        $signature = $this->pusher()->authorizeChannel($validated['channel_name'], $validated['socket_id']);

        return response()->json(json_decode($signature, true));
    }
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems/ActionItemBroadcastsTest.php tests/Feature/Retros/BroadcastAuthorizationTest.php`
Expected: PASS.

- [ ] **Step 8: Pint, phpstan, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/ActionItems/BroadcastActionItemChange.php app/Events/Retros app/Events/ActionItems app/Http/Controllers/BroadcastAuthorizationsController.php tests/Feature/ActionItems/ActionItemBroadcastsTest.php tests/Feature/Retros/BroadcastAuthorizationTest.php
git commit -m "feat: broadcast action item changes to boards, carrying retros and team pages

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 5: Domain actions and domain events

**Files:**
- Create: `app/Actions/ActionItems/ActionItemRules.php`, `app/Actions/ActionItems/ResolveActionItemAssignee.php`, `app/Actions/ActionItems/UpdateActionItem.php`, `app/Actions/ActionItems/SetActionItemStatus.php`, `app/Actions/ActionItems/ApplyActionItemChanges.php`, `app/Actions/ActionItems/DeleteActionItem.php`, `app/Events/ActionItems/ActionItemCreated.php`, `app/Events/ActionItems/ActionItemCompleted.php`, `app/Events/ActionItems/ActionItemReopened.php`, `app/Events/ActionItems/ActionItemAssigned.php`
- Modify: `app/Actions/ActionItems/CreateActionItem.php`, `app/Actions/Retros/PromoteSuggestedAction.php`, `app/Http/Controllers/Retros/ActionItemsController.php`, `tests/Feature/Retros/ActionItemsTest.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/ActionItems/ActionItemActionsTest.php`

**Interfaces:**
- Consumes: `ActionItemPermissions`, `ActionItemActor`, `ExternalSyncActor` (Task 2); `BroadcastActionItemChange::saved()` / `deleted()` (Task 4); `SuggestionGuard` (Plan 8e).
- Produces:
  - `ActionItemRules::create(bool $allowsGuests): array<string, array<int, mixed>>` (`content` required 1–500; optional `priority` enum, `due_on` `Y-m-d` 2000-01-01…2100-12-31 nullable, `assignee_user_id` uuid nullable, `assignee_participant_id` uuid nullable when `$allowsGuests`, else `prohibited`), `ActionItemRules::update(bool $allowsGuests)` (same fields as `sometimes`, plus `status` enum), `ActionItemRules::messages(): array<string, string>`, `ActionItemRules::attributes(array $validated): array` (keeps `content`, `priority`, `due_on`).
  - `ResolveActionItemAssignee::handle(Team $team, ?Retro $retro, array $validated, ?ActionItem $current = null): ?array{assignee_user_id: ?string, assignee_participant_id: ?string}` (`null` when neither field was sent; 422 messages below).
  - `CreateActionItem::handle(Team $team, ?Retro $retro, ActionItemActor $author, array $attributes, ?RetroTheme $theme = null): ActionItem` — callers authorize; copies `theme->name` into `theme_name`; dispatches `ActionItemCreated`; broadcasts; returns the item loaded for presentation.
  - `UpdateActionItem::handle(ActionItem $locked, ActionItemActor $actor, array $changes): ActionItem` — `authorizeEdit`; no-op without dirty attributes; `ActionItemAssigned` when the assignee changes to someone.
  - `SetActionItemStatus::handle(ActionItem $locked, ActionItemActor|ExternalSyncActor $actor, ActionItemStatus $status): ActionItem` — `authorizeComplete` unless `ExternalSyncActor`; same status → no event, no broadcast; `ActionItemCompleted` / `ActionItemReopened` with `origin`.
  - `ApplyActionItemChanges::handle(ActionItem $locked, ActionItemActor $actor, array $validated): ActionItem` — resolves the assignee against the item's team and retro, then `UpdateActionItem`, then `SetActionItemStatus` when `status` was sent.
  - `DeleteActionItem::handle(ActionItem $locked, ActionItemActor $actor): void`.
  - Events (all `ShouldDispatchAfterCommit`): `App\Events\ActionItems\ActionItemCreated(ActionItem $actionItem)`, `ActionItemCompleted(ActionItem $actionItem, ActionItemEventOrigin $origin)`, `ActionItemReopened(ActionItem $actionItem, ActionItemEventOrigin $origin)`, `ActionItemAssigned(ActionItem $actionItem)`.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/ActionItems/ActionItemActionsTest.php`:

```php
<?php

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ApplyActionItemChanges;
use App\Actions\ActionItems\CreateActionItem;
use App\Actions\ActionItems\DeleteActionItem;
use App\Actions\ActionItems\ExternalSyncActor;
use App\Actions\ActionItems\ResolveActionItemAssignee;
use App\Actions\ActionItems\SetActionItemStatus;
use App\Actions\ActionItems\UpdateActionItem;
use App\Enums\ActionItemEventOrigin;
use App\Enums\ActionItemPriority;
use App\Enums\ActionItemStatus;
use App\Enums\RetroPhase;
use App\Events\ActionItems\ActionItemAssigned;
use App\Events\ActionItems\ActionItemCompleted;
use App\Events\ActionItems\ActionItemCreated;
use App\Events\ActionItems\ActionItemReopened;
use App\Events\ActionItems\TeamActionItemDeleted;
use App\Events\ActionItems\TeamActionItemSaved;
use App\Models\ActionItem;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RetroTheme;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\Event;
use Illuminate\Validation\ValidationException;

beforeEach(function () {
    Event::fake();
});

/**
 * @return array{0: Retro, 1: ActionItem, 2: ActionItemActor}
 */
function authoredActionItem(RetroPhase $phase = RetroPhase::Discussing): array
{
    $retro = Retro::factory()->inPhase($phase)->create();
    [, $author] = retroMember($retro);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $author->id]);

    return [$retro, $item, ActionItemActor::forParticipant($author)];
}

it('creates items on every path and announces each one', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user, $participant] = retroMember($retro);
    $theme = RetroTheme::factory()->create(['retro_id' => $retro->id, 'name' => 'Release pain']);
    $create = app(CreateActionItem::class);

    $boardItem = $create->handle($retro->team, $retro, ActionItemActor::forParticipant($participant), ['content' => 'Speed up CI']);
    $promoted = $create->handle($retro->team, $retro, ActionItemActor::forParticipant($participant), ['content' => 'Automate the release'], $theme);
    $teamItem = $create->handle($retro->team, null, ActionItemActor::forUser($user), ['content' => 'Book the room', 'priority' => 'high', 'due_on' => '2026-10-20']);

    expect($boardItem->only(['team_id', 'retro_id', 'created_by_participant_id', 'created_by_user_id']))->toBe([
        'team_id' => $retro->team_id,
        'retro_id' => $retro->id,
        'created_by_participant_id' => $participant->id,
        'created_by_user_id' => $user->id,
    ])
        ->and($boardItem->fresh()->priority)->toBe(ActionItemPriority::Medium)
        ->and($promoted->only(['theme_id', 'theme_name']))->toBe(['theme_id' => $theme->id, 'theme_name' => 'Release pain'])
        ->and($teamItem->only(['retro_id', 'created_by_participant_id', 'created_by_user_id']))->toBe([
            'retro_id' => null,
            'created_by_participant_id' => null,
            'created_by_user_id' => $user->id,
        ])
        ->and($teamItem->fresh()->due_on?->toDateString())->toBe('2026-10-20')
        ->and($teamItem->fresh()->priority)->toBe(ActionItemPriority::High);

    Event::assertDispatchedTimes(ActionItemCreated::class, 3);
    Event::assertDispatchedTimes(TeamActionItemSaved::class, 3);
});

it('normalizes member participants to users', function () {
    $retro = Retro::factory()->create();
    [$user, $participant] = retroMember($retro);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $resolve = app(ResolveActionItemAssignee::class);

    expect($resolve->handle($retro->team, $retro, ['assignee_participant_id' => $participant->id]))
        ->toBe(['assignee_user_id' => $user->id, 'assignee_participant_id' => null])
        ->and($resolve->handle($retro->team, $retro, ['assignee_participant_id' => $guest->id]))
        ->toBe(['assignee_user_id' => null, 'assignee_participant_id' => $guest->id])
        ->and($resolve->handle($retro->team, $retro, ['assignee_user_id' => $user->id]))
        ->toBe(['assignee_user_id' => $user->id, 'assignee_participant_id' => null])
        ->and($resolve->handle($retro->team, $retro, ['assignee_user_id' => null]))
        ->toBe(['assignee_user_id' => null, 'assignee_participant_id' => null])
        ->and($resolve->handle($retro->team, $retro, ['content' => 'Unrelated']))->toBeNull();
});

it('refuses assignees outside the team', function (Closure $input, string $message) {
    $retro = Retro::factory()->create();

    expect(fn () => app(ResolveActionItemAssignee::class)->handle($retro->team, $retro, $input($retro)))
        ->toThrow(ValidationException::class, $message);
})->with([
    'admin who is not in the team' => [fn (Retro $retro) => ['assignee_user_id' => workspaceManager($retro->team->workspace)->id], 'The assignee must be a member of this team.'],
    'admin participant who is not in the team' => [fn (Retro $retro) => ['assignee_participant_id' => workspaceAdminParticipant($retro)[1]->id], 'The assignee must be a member of this team.'],
    'participant of another retro' => [fn (Retro $retro) => ['assignee_participant_id' => Participant::factory()->guest()->create()->id], 'The assignee must be a participant of this retrospective.'],
    'unknown user' => [fn (Retro $retro) => ['assignee_user_id' => '00000000-0000-4000-8000-000000000000'], 'The assignee must be a member of this team.'],
]);

it('refuses both assignee fields', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    expect(fn () => app(ResolveActionItemAssignee::class)->handle($retro->team, $retro, [
        'assignee_user_id' => $user->id,
        'assignee_participant_id' => $guest->id,
    ]))->toThrow(ValidationException::class, 'Choose either a team member or a guest as assignee, not both.');
});

it('keeps an assignee who left the team while the assignee is unchanged', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    $item = ActionItem::factory()->assignedTo($user)->create(['retro_id' => $retro->id]);
    $retro->team->members()->detach($user);
    $resolve = app(ResolveActionItemAssignee::class);

    expect($resolve->handle($retro->team, $retro, ['assignee_user_id' => $user->id], $item))
        ->toBe(['assignee_user_id' => $user->id, 'assignee_participant_id' => null])
        ->and(fn () => $resolve->handle($retro->team, $retro, ['assignee_user_id' => $user->id]))
        ->toThrow(ValidationException::class, 'The assignee must be a member of this team.');
});

it('announces new assignees only', function () {
    [$retro, $item, $author] = authoredActionItem();
    [$assignee] = retroMember($retro);
    $update = app(UpdateActionItem::class);

    $update->handle($item, $author, ['content' => 'Reworded']);
    $update->handle($item, $author, ['assignee_user_id' => $assignee->id, 'assignee_participant_id' => null]);
    $update->handle($item, $author, ['assignee_user_id' => $assignee->id, 'assignee_participant_id' => null]);
    $update->handle($item, $author, ['assignee_user_id' => null, 'assignee_participant_id' => null]);

    expect($item->fresh()->content)->toBe('Reworded');
    Event::assertDispatchedTimes(ActionItemAssigned::class, 1);
    Event::assertDispatchedTimes(TeamActionItemSaved::class, 3);
});

it('completes and reopens with the skrum origin', function () {
    [, $item, $author] = authoredActionItem();
    $set = app(SetActionItemStatus::class);

    $set->handle($item, $author, ActionItemStatus::Completed);

    expect($item->fresh()->isCompleted())->toBeTrue();

    $set->handle($item, $author, ActionItemStatus::Open);

    expect($item->fresh()->isCompleted())->toBeFalse();
    Event::assertDispatched(ActionItemCompleted::class, fn (ActionItemCompleted $event) => $event->actionItem->is($item) && $event->origin === ActionItemEventOrigin::Skrum);
    Event::assertDispatched(ActionItemReopened::class, fn (ActionItemReopened $event) => $event->actionItem->is($item) && $event->origin === ActionItemEventOrigin::Skrum);
});

it('treats the current status as a no-op', function () {
    [, $item, $author] = authoredActionItem();
    $item->update(['completed_at' => now()]);

    app(SetActionItemStatus::class)->handle($item, $author, ActionItemStatus::Completed);

    Event::assertNotDispatched(ActionItemCompleted::class);
    Event::assertNotDispatched(ActionItemReopened::class);
    Event::assertNotDispatched(TeamActionItemSaved::class);
});

it('lets the external sync actor bypass permissions', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['is_locked' => true]);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id]);

    app(SetActionItemStatus::class)->handle($item, new ExternalSyncActor('jira', 'PROJ-12'), ActionItemStatus::Completed);

    expect($item->fresh()->isCompleted())->toBeTrue();
    Event::assertDispatched(ActionItemCompleted::class, fn (ActionItemCompleted $event) => $event->origin === ActionItemEventOrigin::External);
    Event::assertDispatched(TeamActionItemSaved::class);
});

it('refuses changes by people who may not make them', function () {
    [$retro, $item] = authoredActionItem();
    $stranger = ActionItemActor::forParticipant(retroMember($retro)[1]);

    expect(fn () => app(UpdateActionItem::class)->handle($item, $stranger, ['content' => 'Hijacked']))->toThrow(AuthorizationException::class)
        ->and(fn () => app(SetActionItemStatus::class)->handle($item, $stranger, ActionItemStatus::Completed))->toThrow(AuthorizationException::class)
        ->and(fn () => app(DeleteActionItem::class)->handle($item, $stranger))->toThrow(AuthorizationException::class)
        ->and($item->fresh()->content)->not->toBe('Hijacked');
});

it('applies field and status changes together', function () {
    [$retro, $item, $author] = authoredActionItem();
    [$user, $participant] = retroMember($retro);

    $updated = app(ApplyActionItemChanges::class)->handle($item, $author, [
        'content' => 'Pair on the pipeline',
        'priority' => 'low',
        'assignee_participant_id' => $participant->id,
        'status' => 'completed',
    ]);

    expect($updated->content)->toBe('Pair on the pipeline')
        ->and($updated->priority)->toBe(ActionItemPriority::Low)
        ->and($updated->assignee_user_id)->toBe($user->id)
        ->and($updated->assignee_participant_id)->toBeNull()
        ->and($updated->isCompleted())->toBeTrue();
});

it('deletes items and tells the team', function () {
    [, $item, $author] = authoredActionItem();

    app(DeleteActionItem::class)->handle($item, $author);

    expect(ActionItem::find($item->id))->toBeNull();
    Event::assertDispatched(TeamActionItemDeleted::class, fn (TeamActionItemDeleted $event) => $event->actionItemId === $item->id);
});
```

In `tests/Feature/Retros/ActionItemsTest.php` (rewritten in Task 6) add `use App\Actions\ActionItems\ActionItemActor;` and replace

```php
    $item = app(CreateActionItem::class)->handle($retro, $author, 'Automate the release', null, $theme);
```

with

```php
    $item = app(CreateActionItem::class)->handle($retro->team, $retro, ActionItemActor::forParticipant($author), ['content' => 'Automate the release'], $theme);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems/ActionItemActionsTest.php`
Expected: FAIL with `Class "App\Actions\ActionItems\ResolveActionItemAssignee" not found` (and `CreateActionItem::handle()` argument type errors).

- [ ] **Step 3: Domain events**

`app/Events/ActionItems/ActionItemCreated.php`:

```php
<?php

namespace App\Events\ActionItems;

use App\Models\ActionItem;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ActionItemCreated implements ShouldDispatchAfterCommit
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(public ActionItem $actionItem) {}
}
```

`app/Events/ActionItems/ActionItemAssigned.php`:

```php
<?php

namespace App\Events\ActionItems;

use App\Models\ActionItem;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ActionItemAssigned implements ShouldDispatchAfterCommit
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(public ActionItem $actionItem) {}
}
```

`app/Events/ActionItems/ActionItemCompleted.php`:

```php
<?php

namespace App\Events\ActionItems;

use App\Enums\ActionItemEventOrigin;
use App\Models\ActionItem;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ActionItemCompleted implements ShouldDispatchAfterCommit
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(public ActionItem $actionItem, public ActionItemEventOrigin $origin) {}
}
```

`app/Events/ActionItems/ActionItemReopened.php`:

```php
<?php

namespace App\Events\ActionItems;

use App\Enums\ActionItemEventOrigin;
use App\Models\ActionItem;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ActionItemReopened implements ShouldDispatchAfterCommit
{
    use Dispatchable;
    use SerializesModels;

    public function __construct(public ActionItem $actionItem, public ActionItemEventOrigin $origin) {}
}
```

- [ ] **Step 4: Rules and assignee resolution**

`app/Actions/ActionItems/ActionItemRules.php`:

```php
<?php

namespace App\Actions\ActionItems;

use App\Enums\ActionItemPriority;
use App\Enums\ActionItemStatus;
use Illuminate\Validation\Rule;

class ActionItemRules
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public static function create(bool $allowsGuests): array
    {
        return [
            'content' => ['required', 'string', 'max:500'],
            ...self::optionalFields($allowsGuests),
        ];
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public static function update(bool $allowsGuests): array
    {
        return [
            'content' => ['sometimes', 'required', 'string', 'max:500'],
            ...self::optionalFields($allowsGuests),
            'status' => ['sometimes', 'required', Rule::enum(ActionItemStatus::class)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public static function messages(): array
    {
        return [
            'assignee_participant_id.prohibited' => __('Guests can only be assigned from their own retrospective.'),
        ];
    }

    /**
     * The plain item fields of a validated request; assignee and status go
     * through ResolveActionItemAssignee and SetActionItemStatus.
     *
     * @param  array<string, mixed>  $validated
     * @return array<string, mixed>
     */
    public static function attributes(array $validated): array
    {
        return array_intersect_key($validated, array_flip(['content', 'priority', 'due_on']));
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    private static function optionalFields(bool $allowsGuests): array
    {
        return [
            'priority' => ['sometimes', 'required', Rule::enum(ActionItemPriority::class)],
            'due_on' => ['sometimes', 'nullable', 'date_format:Y-m-d', 'after_or_equal:2000-01-01', 'before_or_equal:2100-12-31'],
            'assignee_user_id' => ['sometimes', 'nullable', 'uuid'],
            'assignee_participant_id' => $allowsGuests ? ['sometimes', 'nullable', 'uuid'] : ['prohibited'],
        ];
    }
}
```

`app/Actions/ActionItems/ResolveActionItemAssignee.php`:

```php
<?php

namespace App\Actions\ActionItems;

use App\Models\ActionItem;
use App\Models\Retro;
use App\Models\Team;
use Illuminate\Validation\ValidationException;

class ResolveActionItemAssignee
{
    /**
     * Member participants are stored as their user; only guests of the
     * item's own retro stay participant assignees.
     *
     * @param  array<string, mixed>  $validated
     * @return array{assignee_user_id: ?string, assignee_participant_id: ?string}|null
     */
    public function handle(Team $team, ?Retro $retro, array $validated, ?ActionItem $current = null): ?array
    {
        if (! array_key_exists('assignee_user_id', $validated) && ! array_key_exists('assignee_participant_id', $validated)) {
            return null;
        }

        $userId = $validated['assignee_user_id'] ?? null;
        $participantId = $validated['assignee_participant_id'] ?? null;

        if ($userId !== null && $participantId !== null) {
            throw ValidationException::withMessages([
                'assignee_user_id' => __('Choose either a team member or a guest as assignee, not both.'),
            ]);
        }

        if ($participantId !== null) {
            return $this->fromParticipant($team, $retro, (string) $participantId, $current);
        }

        if ($userId === null) {
            return ['assignee_user_id' => null, 'assignee_participant_id' => null];
        }

        $this->ensureTeamMember($team, (string) $userId, $current, 'assignee_user_id');

        return ['assignee_user_id' => (string) $userId, 'assignee_participant_id' => null];
    }

    /**
     * @return array{assignee_user_id: ?string, assignee_participant_id: ?string}
     */
    private function fromParticipant(Team $team, ?Retro $retro, string $participantId, ?ActionItem $current): array
    {
        $participant = $retro?->participants()->whereKey($participantId)->first();

        if ($participant === null) {
            throw ValidationException::withMessages([
                'assignee_participant_id' => __('The assignee must be a participant of this retrospective.'),
            ]);
        }

        if ($participant->user_id === null) {
            return ['assignee_user_id' => null, 'assignee_participant_id' => $participant->id];
        }

        $this->ensureTeamMember($team, $participant->user_id, $current, 'assignee_participant_id');

        return ['assignee_user_id' => $participant->user_id, 'assignee_participant_id' => null];
    }

    /**
     * An assignee who has since left the team may stay; nobody outside the
     * team can be picked.
     */
    private function ensureTeamMember(Team $team, string $userId, ?ActionItem $current, string $field): void
    {
        if ($current?->assignee_user_id === $userId) {
            return;
        }

        if ($team->members()->whereKey($userId)->exists()) {
            return;
        }

        throw ValidationException::withMessages([$field => __('The assignee must be a member of this team.')]);
    }
}
```

- [ ] **Step 5: The actions**

Replace `app/Actions/ActionItems/CreateActionItem.php`:

```php
<?php

namespace App\Actions\ActionItems;

use App\Enums\ActionItemPriority;
use App\Events\ActionItems\ActionItemCreated;
use App\Models\ActionItem;
use App\Models\Retro;
use App\Models\RetroTheme;
use App\Models\Team;

class CreateActionItem
{
    public function __construct(private BroadcastActionItemChange $broadcastActionItemChange) {}

    /**
     * Callers authorize: board participants while discussing, promotions
     * through SuggestionGuard, team members outside a retro.
     *
     * @param  array<string, mixed>  $attributes  content, and optionally priority, due_on, assignee_user_id, assignee_participant_id
     */
    public function handle(Team $team, ?Retro $retro, ActionItemActor $author, array $attributes, ?RetroTheme $theme = null): ActionItem
    {
        $actionItem = ActionItem::query()->create([
            'team_id' => $team->id,
            'retro_id' => $retro?->id,
            'content' => $attributes['content'],
            'priority' => $attributes['priority'] ?? ActionItemPriority::Medium->value,
            'due_on' => $attributes['due_on'] ?? null,
            'assignee_user_id' => $attributes['assignee_user_id'] ?? null,
            'assignee_participant_id' => $attributes['assignee_participant_id'] ?? null,
            'created_by_participant_id' => $author->participant?->id,
            'created_by_user_id' => $author->user?->id,
            'theme_id' => $theme?->id,
            'theme_name' => $theme?->name,
        ]);

        ActionItemCreated::dispatch($actionItem);

        $this->broadcastActionItemChange->saved($actionItem);

        return $actionItem;
    }
}
```

`app/Actions/ActionItems/UpdateActionItem.php`:

```php
<?php

namespace App\Actions\ActionItems;

use App\Events\ActionItems\ActionItemAssigned;
use App\Models\ActionItem;

class UpdateActionItem
{
    public function __construct(
        private ActionItemPermissions $permissions,
        private BroadcastActionItemChange $broadcastActionItemChange,
    ) {}

    /**
     * @param  array<string, mixed>  $changes  validated content, priority, due_on and a resolved assignee
     */
    public function handle(ActionItem $locked, ActionItemActor $actor, array $changes): ActionItem
    {
        $this->permissions->authorizeEdit($locked, $actor);

        $locked->fill($changes);

        if (! $locked->isDirty()) {
            return $locked->loadForPresentation();
        }

        $assigneeChanged = $locked->isDirty(['assignee_user_id', 'assignee_participant_id']);

        $locked->save();

        if ($assigneeChanged && ($locked->assignee_user_id !== null || $locked->assignee_participant_id !== null)) {
            ActionItemAssigned::dispatch($locked);
        }

        $this->broadcastActionItemChange->saved($locked);

        return $locked;
    }
}
```

`app/Actions/ActionItems/SetActionItemStatus.php`:

```php
<?php

namespace App\Actions\ActionItems;

use App\Enums\ActionItemEventOrigin;
use App\Enums\ActionItemStatus;
use App\Events\ActionItems\ActionItemCompleted;
use App\Events\ActionItems\ActionItemReopened;
use App\Models\ActionItem;

class SetActionItemStatus
{
    public function __construct(
        private ActionItemPermissions $permissions,
        private BroadcastActionItemChange $broadcastActionItemChange,
    ) {}

    /**
     * Setting the current status again changes and announces nothing.
     */
    public function handle(ActionItem $locked, ActionItemActor|ExternalSyncActor $actor, ActionItemStatus $status): ActionItem
    {
        if ($actor instanceof ActionItemActor) {
            $this->permissions->authorizeComplete($locked, $actor);
        }

        $completing = $status === ActionItemStatus::Completed;

        if ($locked->isCompleted() === $completing) {
            return $locked->loadForPresentation();
        }

        $locked->update(['completed_at' => $completing ? now() : null]);

        $origin = $actor instanceof ExternalSyncActor ? ActionItemEventOrigin::External : ActionItemEventOrigin::Skrum;

        if ($completing) {
            ActionItemCompleted::dispatch($locked, $origin);
        }

        if (! $completing) {
            ActionItemReopened::dispatch($locked, $origin);
        }

        $this->broadcastActionItemChange->saved($locked);

        return $locked;
    }
}
```

`app/Actions/ActionItems/ApplyActionItemChanges.php`:

```php
<?php

namespace App\Actions\ActionItems;

use App\Enums\ActionItemStatus;
use App\Models\ActionItem;

/**
 * One PATCH from the board or the workspace: field changes need edit
 * rights, a status change needs completion rights.
 */
class ApplyActionItemChanges
{
    public function __construct(
        private ResolveActionItemAssignee $resolveActionItemAssignee,
        private UpdateActionItem $updateActionItem,
        private SetActionItemStatus $setActionItemStatus,
    ) {}

    /**
     * @param  array<string, mixed>  $validated  the output of ActionItemRules::update()
     */
    public function handle(ActionItem $locked, ActionItemActor $actor, array $validated): ActionItem
    {
        $changes = [
            ...ActionItemRules::attributes($validated),
            ...($this->resolveActionItemAssignee->handle($locked->team, $locked->retro, $validated, $locked) ?? []),
        ];

        if ($changes !== []) {
            $locked = $this->updateActionItem->handle($locked, $actor, $changes);
        }

        if (array_key_exists('status', $validated)) {
            return $this->setActionItemStatus->handle($locked, $actor, ActionItemStatus::from((string) $validated['status']));
        }

        return $locked->loadForPresentation();
    }
}
```

`app/Actions/ActionItems/DeleteActionItem.php`:

```php
<?php

namespace App\Actions\ActionItems;

use App\Models\ActionItem;

class DeleteActionItem
{
    public function __construct(
        private ActionItemPermissions $permissions,
        private BroadcastActionItemChange $broadcastActionItemChange,
    ) {}

    public function handle(ActionItem $locked, ActionItemActor $actor): void
    {
        $this->permissions->authorizeDelete($locked, $actor);

        $locked->loadMissing('retro');
        $locked->delete();

        $this->broadcastActionItemChange->deleted($locked);
    }
}
```

- [ ] **Step 6: Callers of `CreateActionItem`**

Replace `app/Actions/Retros/PromoteSuggestedAction.php` (`CreateActionItem` now broadcasts, so the promotion no longer sends `ActionItemSaved` itself):

```php
<?php

namespace App\Actions\Retros;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\CreateActionItem;
use App\Enums\SuggestedActionStatus;
use App\Events\Retros\InsightsChanged;
use App\Models\ActionItem;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\SuggestedAction;

class PromoteSuggestedAction
{
    public function __construct(
        private SuggestionGuard $suggestionGuard,
        private CreateActionItem $createActionItem,
    ) {}

    /**
     * Allowed in Completed too: this is the one way an action item is
     * added to a completed retro.
     */
    public function handle(Retro $locked, SuggestedAction $suggestion, Participant $actor): ActionItem
    {
        $this->suggestionGuard->authorize($locked, $actor);
        $this->suggestionGuard->pending($suggestion);

        $actionItem = $this->createActionItem->handle(
            $locked->team,
            $locked,
            ActionItemActor::forParticipant($actor),
            ['content' => $suggestion->content],
            $suggestion->theme,
        );

        $suggestion->update([
            'status' => SuggestedActionStatus::Promoted,
            'action_item_id' => $actionItem->id,
            'handled_by_participant_id' => $actor->id,
            'handled_at' => now(),
        ]);

        (new InsightsChanged($locked->id))->sendToOthers();

        return $actionItem;
    }
}
```

In `app/Http/Controllers/Retros/ActionItemsController.php` (rewritten in Task 6) add `use App\Actions\ActionItems\ActionItemActor;` and replace the body of the `store()` transaction closure after the two guards with:

```php
            return $this->createActionItem->handle($locked->team, $locked, ActionItemActor::forParticipant($participant), [
                'content' => $validated['content'],
                'assignee_participant_id' => $validated['assignee_participant_id'] ?? null,
            ]);
```

(the former `(new ActionItemSaved(…))->sendToOthers();` line and the local `$actionItem` variable go away; `CreateActionItem` broadcasts).

- [ ] **Step 7: Translations**

| Key | fr | es | de |
|---|---|---|---|
| `Guests can only be assigned from their own retrospective.` | `Les invités ne peuvent être assignés que depuis leur propre rétrospective.` | `Los invitados solo se pueden asignar desde su propia retrospectiva.` | `Gäste können nur in ihrer eigenen Retrospektive zugewiesen werden.` |
| `Choose either a team member or a guest as assignee, not both.` | `Choisissez comme personne assignée soit un membre de l'équipe, soit un invité, pas les deux.` | `Elige como persona asignada un miembro del equipo o un invitado, no ambos.` | `Wähle als zugewiesene Person entweder ein Teammitglied oder einen Gast, nicht beides.` |
| `The assignee must be a participant of this retrospective.` | `La personne assignée doit participer à cette rétrospective.` | `La persona asignada debe participar en esta retrospectiva.` | `Die zugewiesene Person muss an dieser Retrospektive teilnehmen.` |
| `The assignee must be a member of this team.` | `La personne assignée doit être membre de cette équipe.` | `La persona asignada debe ser miembro de este equipo.` | `Die zugewiesene Person muss Mitglied dieses Teams sein.` |

- [ ] **Step 8: Run tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems tests/Feature/Retros tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 9: Pint, phpstan, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/ActionItems app/Events/ActionItems app/Actions/Retros/PromoteSuggestedAction.php app/Http/Controllers/Retros/ActionItemsController.php tests/Feature/ActionItems/ActionItemActionsTest.php tests/Feature/Retros/ActionItemsTest.php lang
git commit -m "feat: route action item changes through permission-checked actions and domain events

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 6: Board endpoints on the new actions

**Files:**
- Modify: `app/Http/Controllers/Retros/ActionItemsController.php`, `tests/Feature/Retros/BoardLockTest.php`
- Test: replace `tests/Feature/Retros/ActionItemsTest.php`

**Interfaces:**
- Consumes: `ActionItemRules`, `ResolveActionItemAssignee`, `CreateActionItem`, `ApplyActionItemChanges`, `DeleteActionItem` (Task 5); `PresentActionItem` (Task 3); `RetroGuard`.
- Produces: `POST /retros/{retro}/action-items {content, priority?, due_on?, assignee_user_id? | assignee_participant_id?}` → 201 `{actionItem}`; `PATCH /retros/{retro}/action-items/{actionItem}` (any of `content, priority, due_on, assignee_user_id, assignee_participant_id, status`) → 200 `{actionItem}`; `DELETE …` → 204. Only in `Discussing`, 423 when locked, 403 per §4, 404 for items of another retro or without a retro. `is_done` is ignored. Pest helpers `discussingRetroWithMember(array $attributes = []): array{0: Retro, 1: User, 2: Participant}`, `boardActionItemActor(TestCase $test, string $role, Retro $retro, ActionItem $item, Participant $author): TestCase`, `actionItemGuestRequest(TestCase $test, Participant $guest): TestCase`.

- [ ] **Step 1: Write the failing tests**

Replace `tests/Feature/Retros/ActionItemsTest.php`:

```php
<?php

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\CreateActionItem;
use App\Actions\Retros\PresentActionItem;
use App\Enums\RetroPhase;
use App\Events\ActionItems\ActionItemCompleted;
use App\Events\ActionItems\ActionItemCreated;
use App\Events\Retros\ActionItemDeleted;
use App\Events\Retros\ActionItemSaved;
use App\Models\ActionItem;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\RetroTheme;
use App\Models\User;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

beforeEach(function () {
    Event::fake();
});

/**
 * @param  array<string, mixed>  $attributes
 * @return array{0: Retro, 1: User, 2: Participant}
 */
function discussingRetroWithMember(array $attributes = []): array
{
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->withGuestAccess()->create($attributes);
    [$user, $participant] = retroMember($retro);

    return [$retro, $user, $participant];
}

function actionItemGuestRequest(TestCase $test, Participant $guest): TestCase
{
    return $test->withCookies(retroGuestCookie($guest))->withCredentials();
}

function boardActionItemActor(TestCase $test, string $role, Retro $retro, ActionItem $item, Participant $author): TestCase
{
    $newGuest = fn (): Participant => Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    return match ($role) {
        'author' => $test->actingAs($author->user),
        'facilitator' => $test->actingAs(retroFacilitator($retro)[0]),
        'workspace admin' => $test->actingAs(workspaceAdminParticipant($retro)[0]),
        'member assignee' => $test->actingAs(tap(retroMember($retro)[0], fn (User $user) => $item->update(['assignee_user_id' => $user->id]))),
        'guest assignee' => actionItemGuestRequest($test, tap($newGuest(), fn (Participant $guest) => $item->update(['assignee_participant_id' => $guest->id]))),
        'other member' => $test->actingAs(retroMember($retro)[0]),
        'other guest' => actionItemGuestRequest($test, $newGuest()),
    };
}

it('creates items with priority, due date and assignee', function () {
    [$retro, $user] = discussingRetroWithMember();
    [$assignee] = retroMember($retro);

    $this->actingAs($user)
        ->postJson(route('retros.action-items.store', $retro), [
            'content' => 'Speed up CI',
            'priority' => 'high',
            'due_on' => '2026-10-20',
            'assignee_user_id' => $assignee->id,
        ])
        ->assertCreated()
        ->assertJsonPath('actionItem.priority', 'high')
        ->assertJsonPath('actionItem.dueOn', '2026-10-20')
        ->assertJsonPath('actionItem.status', 'open')
        ->assertJsonPath('actionItem.assignee.kind', 'member')
        ->assertJsonPath('actionItem.assignee.id', $assignee->id)
        ->assertJsonPath('actionItem.createdBy.name', $user->name)
        ->assertJsonPath('actionItem.isMine', true);

    Event::assertDispatched(ActionItemCreated::class);
    Event::assertDispatched(ActionItemSaved::class, fn (ActionItemSaved $event) => $event->retroId === $retro->id && $event->actionItem['isMine'] === false);
});

it('defaults the priority to medium and accepts past due dates', function () {
    [$retro, $user] = discussingRetroWithMember();

    $this->actingAs($user)
        ->postJson(route('retros.action-items.store', $retro), ['content' => 'Clean the backlog', 'due_on' => '2020-01-01'])
        ->assertCreated()
        ->assertJsonPath('actionItem.priority', 'medium')
        ->assertJsonPath('actionItem.isOverdue', true);
});

it('normalizes a member participant sent from the board', function () {
    [$retro, $user] = discussingRetroWithMember();
    [$assignee, $assigneeParticipant] = retroMember($retro);

    $id = $this->actingAs($user)
        ->postJson(route('retros.action-items.store', $retro), ['content' => 'Pair up', 'assignee_participant_id' => $assigneeParticipant->id])
        ->assertCreated()
        ->assertJsonPath('actionItem.assignee.kind', 'member')
        ->json('actionItem.id');

    expect(ActionItem::find($id)->only(['assignee_user_id', 'assignee_participant_id']))
        ->toBe(['assignee_user_id' => $assignee->id, 'assignee_participant_id' => null]);
});

it('assigns guests of the retro', function () {
    [$retro, $user] = discussingRetroWithMember();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Robin']);

    $this->actingAs($user)
        ->postJson(route('retros.action-items.store', $retro), ['content' => 'Share notes', 'assignee_participant_id' => $guest->id])
        ->assertCreated()
        ->assertJsonPath('actionItem.assignee', [
            'kind' => 'guest',
            'id' => $guest->id,
            'name' => 'Robin',
            'avatarUrl' => $guest->avatarUrl(),
            'isTeamMember' => false,
        ]);
});

it('validates the fields', function (array $payload, string $field) {
    [$retro, $user] = discussingRetroWithMember();

    $this->actingAs($user)
        ->postJson(route('retros.action-items.store', $retro), ['content' => 'Valid', ...$payload])
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);

    expect(ActionItem::count())->toBe(0);
})->with([
    'empty content' => [['content' => ''], 'content'],
    'long content' => [['content' => str_repeat('a', 501)], 'content'],
    'unknown priority' => [['priority' => 'urgent'], 'priority'],
    'badly formatted date' => [['due_on' => '20/10/2026'], 'due_on'],
    'date too early' => [['due_on' => '1999-12-31'], 'due_on'],
    'date too late' => [['due_on' => '2101-01-01'], 'due_on'],
    'assignee outside the team' => [['assignee_user_id' => '00000000-0000-4000-8000-000000000000'], 'assignee_user_id'],
    'participant of another retro' => [['assignee_participant_id' => '00000000-0000-4000-8000-000000000000'], 'assignee_participant_id'],
]);

it('refuses both assignee fields on the board', function () {
    [$retro, $user, $participant] = discussingRetroWithMember();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)
        ->postJson(route('retros.action-items.store', $retro), [
            'content' => 'Both',
            'assignee_user_id' => $user->id,
            'assignee_participant_id' => $guest->id,
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('assignee_user_id');
});

it('completes and reopens idempotently', function () {
    [$retro, $user, $participant] = discussingRetroWithMember();
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $participant->id]);
    $route = route('retros.action-items.update', [$retro, $item]);

    $this->actingAs($user)->patchJson($route, ['status' => 'completed'])->assertOk()->assertJsonPath('actionItem.status', 'completed');
    $this->actingAs($user)->patchJson($route, ['status' => 'completed'])->assertOk()->assertJsonPath('actionItem.status', 'completed');
    $this->actingAs($user)->patchJson($route, ['status' => 'open'])->assertOk()->assertJsonPath('actionItem.status', 'open');
    $this->actingAs($user)->patchJson($route, ['status' => 'done'])->assertUnprocessable()->assertJsonValidationErrors('status');

    Event::assertDispatchedTimes(ActionItemCompleted::class, 1);
});

it('ignores the legacy is_done field', function () {
    [$retro, $user, $participant] = discussingRetroWithMember();
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $participant->id]);

    $this->actingAs($user)
        ->patchJson(route('retros.action-items.update', [$retro, $item]), ['is_done' => true])
        ->assertOk()
        ->assertJsonPath('actionItem.status', 'open');
});

it('edits and deletes items of the author', function () {
    [$retro, $user, $participant] = discussingRetroWithMember();
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $participant->id]);

    $this->actingAs($user)
        ->patchJson(route('retros.action-items.update', [$retro, $item]), ['content' => 'Reworded', 'priority' => 'low', 'due_on' => null])
        ->assertOk()
        ->assertJsonPath('actionItem.content', 'Reworded')
        ->assertJsonPath('actionItem.priority', 'low')
        ->assertJsonPath('actionItem.dueOn', null);

    $this->actingAs($user)->deleteJson(route('retros.action-items.destroy', [$retro, $item]))->assertNoContent();

    expect(ActionItem::find($item->id))->toBeNull();
    Event::assertDispatched(ActionItemDeleted::class, fn (ActionItemDeleted $event) => $event->actionItemId === $item->id);
});

it('applies the permission matrix on the board', function (string $role, string $action, int $status) {
    [$retro, , $author] = discussingRetroWithMember();
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $author->id]);
    $request = boardActionItemActor($this, $role, $retro, $item, $author);

    $response = match ($action) {
        'edit' => $request->patchJson(route('retros.action-items.update', [$retro, $item]), ['content' => 'Changed']),
        'complete' => $request->patchJson(route('retros.action-items.update', [$retro, $item]), ['status' => 'completed']),
        'delete' => $request->deleteJson(route('retros.action-items.destroy', [$retro, $item])),
    };

    $response->assertStatus($status);
})->with(function () {
    $matrix = [
        'author' => ['edit' => 200, 'complete' => 200, 'delete' => 204],
        'facilitator' => ['edit' => 200, 'complete' => 200, 'delete' => 204],
        'workspace admin' => ['edit' => 200, 'complete' => 200, 'delete' => 204],
        'member assignee' => ['edit' => 403, 'complete' => 200, 'delete' => 403],
        'guest assignee' => ['edit' => 403, 'complete' => 200, 'delete' => 403],
        'other member' => ['edit' => 403, 'complete' => 403, 'delete' => 403],
        'other guest' => ['edit' => 403, 'complete' => 403, 'delete' => 403],
    ];

    foreach ($matrix as $role => $actions) {
        foreach ($actions as $action => $status) {
            yield "{$role} may {$action}: {$status}" => [$role, $action, $status];
        }
    }
});

it('lets guests create items on their board', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->withGuestAccess()->create();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    actionItemGuestRequest($this, $guest)
        ->postJson(route('retros.action-items.store', $retro), ['content' => 'From a guest'])
        ->assertCreated()
        ->assertJsonPath('actionItem.isMine', true);
});

it('keeps other phases closed and completed retros read-only on the board', function (RetroPhase $phase) {
    $retro = Retro::factory()->inPhase($phase)->create();
    [$user, $participant] = retroFacilitator($retro);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $participant->id]);

    $this->actingAs($user)->postJson(route('retros.action-items.store', $retro), ['content' => 'X'])->assertForbidden();
    $this->actingAs($user)->patchJson(route('retros.action-items.update', [$retro, $item]), ['status' => 'completed'])->assertForbidden();
    $this->actingAs($user)->deleteJson(route('retros.action-items.destroy', [$retro, $item]))->assertForbidden();
})->with([RetroPhase::Writing, RetroPhase::Voting, RetroPhase::Completed]);

it('returns 404 for items of another retro and items without a retro', function () {
    [$retro, $user] = discussingRetroWithMember();
    $teamItem = ActionItem::factory()->withoutRetro($retro->team, $user)->create();

    $this->actingAs($user)
        ->patchJson(route('retros.action-items.update', [$retro, ActionItem::factory()->create()]), ['status' => 'completed'])
        ->assertNotFound();
    $this->actingAs($user)
        ->patchJson(route('retros.action-items.update', [$retro, $teamItem]), ['status' => 'completed'])
        ->assertNotFound();
});

it('creates action items through the shared action', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [, $author] = retroMember($retro);
    $theme = RetroTheme::factory()->create(['retro_id' => $retro->id, 'name' => 'Release pain']);

    $item = app(CreateActionItem::class)->handle($retro->team, $retro, ActionItemActor::forParticipant($author), ['content' => 'Automate the release'], $theme);

    expect($item->only(['content', 'created_by_participant_id', 'theme_id', 'theme_name']))->toBe([
        'content' => 'Automate the release',
        'created_by_participant_id' => $author->id,
        'theme_id' => $theme->id,
        'theme_name' => 'Release pain',
    ]);
});

it('keeps the theme name of an action item after its theme is removed', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    $theme = RetroTheme::factory()->create(['retro_id' => $retro->id, 'name' => 'Release pain']);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'theme_id' => $theme->id, 'theme_name' => 'Release pain']);

    expect(app(PresentActionItem::class)->handle($item->fresh()))->toMatchArray(['themeId' => $theme->id, 'themeName' => 'Release pain']);

    $theme->delete();

    expect(app(PresentActionItem::class)->handle($item->fresh()))->toMatchArray(['themeId' => null, 'themeName' => 'Release pain']);
});

it('never lets clients write the theme of an action item', function () {
    [$retro, $user, $participant] = discussingRetroWithMember();
    $theme = RetroTheme::factory()->create(['retro_id' => $retro->id]);

    $id = $this->actingAs($user)
        ->postJson(route('retros.action-items.store', $retro), ['content' => 'X', 'theme_id' => $theme->id, 'theme_name' => 'Forged'])
        ->assertCreated()
        ->json('actionItem.id');

    $this->actingAs($user)
        ->patchJson(route('retros.action-items.update', [$retro, $id]), ['theme_id' => $theme->id, 'theme_name' => 'Forged'])
        ->assertOk();

    expect(ActionItem::find($id)->only(['theme_id', 'theme_name']))->toBe(['theme_id' => null, 'theme_name' => null]);
});
```

In `tests/Feature/Retros/BoardLockTest.php` replace, in the `'edit an action item'` dataset row, `['is_done' => true]` with `['status' => 'completed']`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/ActionItemsTest.php`
Expected: FAIL — priority/due date are ignored (`actionItem.priority` is `medium`), the member participant is stored in `assignee_participant_id`, and the permission matrix returns 200 for `other member`.

- [ ] **Step 3: Rewrite the controller**

Replace `app/Http/Controllers/Retros/ActionItemsController.php`:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ActionItemRules;
use App\Actions\ActionItems\ApplyActionItemChanges;
use App\Actions\ActionItems\CreateActionItem;
use App\Actions\ActionItems\DeleteActionItem;
use App\Actions\ActionItems\ResolveActionItemAssignee;
use App\Actions\Retros\PresentActionItem;
use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Http\Controllers\Controller;
use App\Models\ActionItem;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class ActionItemsController extends Controller
{
    public function __construct(
        private PresentActionItem $presentActionItem,
        private CreateActionItem $createActionItem,
        private ApplyActionItemChanges $applyActionItemChanges,
        private DeleteActionItem $deleteActionItem,
        private ResolveActionItemAssignee $resolveActionItemAssignee,
    ) {}

    public function store(Request $request, Retro $retro): JsonResponse
    {
        $actor = ActionItemActor::forParticipant(Participant::current($request));

        $this->guard($retro);

        $validated = $request->validate(ActionItemRules::create(allowsGuests: true), ActionItemRules::messages());

        $actionItem = DB::transaction(function () use ($retro, $actor, $validated): ActionItem {
            $locked = $this->lock($retro);

            return $this->createActionItem->handle($locked->team, $locked, $actor, [
                ...ActionItemRules::attributes($validated),
                ...($this->resolveActionItemAssignee->handle($locked->team, $locked, $validated) ?? []),
            ]);
        });

        return response()->json(['actionItem' => $this->presentActionItem->handle($actionItem, $actor)], 201);
    }

    public function update(Request $request, Retro $retro, ActionItem $actionItem): JsonResponse
    {
        $actor = ActionItemActor::forParticipant(Participant::current($request));

        $this->guard($retro);

        $validated = $request->validate(ActionItemRules::update(allowsGuests: true), ActionItemRules::messages());

        $updated = DB::transaction(function () use ($retro, $actionItem, $actor, $validated): ActionItem {
            return $this->applyActionItemChanges->handle($this->lockItem($retro, $actionItem), $actor, $validated);
        });

        return response()->json(['actionItem' => $this->presentActionItem->handle($updated, $actor)]);
    }

    public function destroy(Request $request, Retro $retro, ActionItem $actionItem): Response
    {
        $actor = ActionItemActor::forParticipant(Participant::current($request));

        $this->guard($retro);

        DB::transaction(function () use ($retro, $actionItem, $actor): void {
            $this->deleteActionItem->handle($this->lockItem($retro, $actionItem), $actor);
        });

        return response()->noContent();
    }

    private function guard(Retro $retro): void
    {
        RetroGuard::phase($retro, RetroPhase::Discussing);
        RetroGuard::unlocked($retro);
    }

    private function lock(Retro $retro): Retro
    {
        $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

        $this->guard($locked);

        return $locked;
    }

    private function lockItem(Retro $retro, ActionItem $actionItem): ActionItem
    {
        $locked = $this->lock($retro);
        $item = $locked->actionItems()->whereKey($actionItem->id)->lockForUpdate()->firstOrFail();

        $item->setRelation('retro', $locked);

        return $item;
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros tests/Feature/ActionItems`
Expected: PASS.

- [ ] **Step 5: Pint, phpstan, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Http/Controllers/Retros/ActionItemsController.php tests/Feature/Retros/ActionItemsTest.php tests/Feature/Retros/BoardLockTest.php
git commit -m "feat: add priority, due date, status and team assignees to board action items

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 7: Comments on board items

**Files:**
- Create: `app/Actions/ActionItems/PresentActionItemComment.php`, `app/Actions/ActionItems/AddActionItemComment.php`, `app/Actions/ActionItems/UpdateActionItemComment.php`, `app/Actions/ActionItems/DeleteActionItemComment.php`, `app/Http/Controllers/Retros/ActionItemCommentsController.php`
- Modify: `routes/web.php`
- Test: create `tests/Feature/ActionItems/ActionItemCommentsTest.php`

**Interfaces:**
- Consumes: `ActionItemComment` model and `Retro::actionItemComments()` (Task 1), `ActionItemPermissions` (Task 2), `BroadcastActionItemChange::commentsChanged()` (Task 4).
- Produces: `PresentActionItemComment::handle(ActionItemComment $comment, ?ActionItemActor $viewer = null): array{id: string, actionItemId: string, content: string, author: ?array{name: string, avatarUrl: string}, isMine: bool, createdAt: ?string, updatedAt: ?string}` and `many(iterable<ActionItemComment>, ?ActionItemActor): array`; `AddActionItemComment::handle(ActionItem $item, ActionItemActor $actor, string $content): ActionItemComment` (participant author on the board, user author otherwise); `UpdateActionItemComment::handle(ActionItemComment $comment, ActionItemActor $actor, string $content): ActionItemComment`; `DeleteActionItemComment::handle(ActionItemComment $comment, ActionItemActor $actor): void`; routes `retros.action-items.comments.index` (`GET /retros/{retro}/action-items/{actionItem}/comments`, any phase), `retros.action-items.comments.store` (`POST …/comments {content}` → 201), `retros.action-items.comments.update` (`PATCH /retros/{retro}/action-item-comments/{actionItemComment} {content}`), `retros.action-items.comments.destroy` (`DELETE …` → 204); writes only in `Discussing`, 423 when locked.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/ActionItems/ActionItemCommentsTest.php`:

```php
<?php

use App\Actions\Retros\PresentActionItem;
use App\Enums\RetroPhase;
use App\Events\Retros\ActionItemCommentsChanged;
use App\Models\ActionItem;
use App\Models\ActionItemComment;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

/**
 * @return array{0: Retro, 1: ActionItem}
 */
function commentedBoardItem(RetroPhase $phase = RetroPhase::Discussing, array $attributes = []): array
{
    $retro = Retro::factory()->inPhase($phase)->withGuestAccess()->create($attributes);

    return [$retro, ActionItem::factory()->create(['retro_id' => $retro->id])];
}

it('comments on board items and names authors on anonymous retros', function () {
    [$retro, $item] = commentedBoardItem(attributes: ['is_anonymous' => true]);
    [$user, $participant] = retroMember($retro);

    $this->actingAs($user)
        ->postJson(route('retros.action-items.comments.store', [$retro, $item]), ['content' => 'I can take it'])
        ->assertCreated()
        ->assertJsonPath('comment.content', 'I can take it')
        ->assertJsonPath('comment.author', ['name' => $user->name, 'avatarUrl' => $participant->avatarUrl()])
        ->assertJsonPath('comment.isMine', true);

    $this->actingAs($user)
        ->postJson(route('retros.action-items.comments.store', [$retro, $item]), ['content' => 'Done by Friday'])
        ->assertCreated();

    $this->actingAs($user)
        ->getJson(route('retros.action-items.comments.index', [$retro, $item]))
        ->assertOk()
        ->assertJsonPath('comments.0.content', 'I can take it')
        ->assertJsonPath('comments.1.content', 'Done by Friday')
        ->assertJsonPath('comments.1.author.name', $user->name);

    expect(ActionItemComment::query()->pluck('author_participant_id')->unique()->all())->toBe([$participant->id])
        ->and(app(PresentActionItem::class)->handle($item->fresh())['commentCount'])->toBe(2);
    Event::assertDispatched(ActionItemCommentsChanged::class, fn (ActionItemCommentsChanged $event) => $event->retroId === $retro->id
        && $event->broadcastWith() === ['actionItemId' => $item->id, 'commentCount' => 2]);
});

it('lets guests comment on their own board', function () {
    [$retro, $item] = commentedBoardItem();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id, 'guest_name' => 'Robin']);

    $this->withCookies(retroGuestCookie($guest))->withCredentials()
        ->postJson(route('retros.action-items.comments.store', [$retro, $item]), ['content' => 'Count me in'])
        ->assertCreated()
        ->assertJsonPath('comment.author.name', 'Robin');
});

it('validates the comment length', function (string $content) {
    [$retro, $item] = commentedBoardItem();
    [$user] = retroMember($retro);

    $this->actingAs($user)
        ->postJson(route('retros.action-items.comments.store', [$retro, $item]), ['content' => $content])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('content');
})->with(['empty' => '', 'too long' => str_repeat('a', 501)]);

it('lets only the author edit a comment', function () {
    [$retro, $item] = commentedBoardItem();
    [$authorUser, $author] = retroMember($retro);
    [$otherUser] = retroMember($retro);
    $comment = ActionItemComment::factory()->byParticipant($author)->create(['action_item_id' => $item->id]);

    $this->actingAs($otherUser)
        ->patchJson(route('retros.action-items.comments.update', [$retro, $comment]), ['content' => 'Hijacked'])
        ->assertForbidden();
    $this->actingAs($authorUser)
        ->patchJson(route('retros.action-items.comments.update', [$retro, $comment]), ['content' => 'Updated'])
        ->assertOk()
        ->assertJsonPath('comment.content', 'Updated');
});

it('lets the author and managers delete a comment', function () {
    [$retro, $item] = commentedBoardItem();
    [, $author] = retroMember($retro);
    [$otherUser] = retroMember($retro);
    [$facilitatorUser] = retroFacilitator($retro);
    $comment = ActionItemComment::factory()->byParticipant($author)->create(['action_item_id' => $item->id]);

    $this->actingAs($otherUser)
        ->deleteJson(route('retros.action-items.comments.destroy', [$retro, $comment]))
        ->assertForbidden();
    $this->actingAs($facilitatorUser)
        ->deleteJson(route('retros.action-items.comments.destroy', [$retro, $comment]))
        ->assertNoContent();

    expect(ActionItemComment::count())->toBe(0);
});

it('reads comments in every phase but writes them only while discussing', function () {
    [$retro, $item] = commentedBoardItem(RetroPhase::Completed);
    [$user] = retroMember($retro);
    ActionItemComment::factory()->create(['action_item_id' => $item->id]);

    $this->actingAs($user)->getJson(route('retros.action-items.comments.index', [$retro, $item]))->assertOk()->assertJsonCount(1, 'comments');
    $this->actingAs($user)->postJson(route('retros.action-items.comments.store', [$retro, $item]), ['content' => 'Late'])->assertForbidden();
});

it('refuses comments while the board is locked', function () {
    [$retro, $item] = commentedBoardItem(attributes: ['is_locked' => true]);
    [$user] = retroMember($retro);

    $this->actingAs($user)
        ->postJson(route('retros.action-items.comments.store', [$retro, $item]), ['content' => 'Locked'])
        ->assertStatus(423);
});

it('returns 404 for comments of other retros and deletes comments with their item', function () {
    [$retro, $item] = commentedBoardItem();
    [$user] = retroMember($retro);
    $foreign = ActionItemComment::factory()->create();
    ActionItemComment::factory()->count(2)->create(['action_item_id' => $item->id]);

    $this->actingAs($user)
        ->patchJson(route('retros.action-items.comments.update', [$retro, $foreign]), ['content' => 'x'])
        ->assertNotFound();

    $item->delete();

    expect(ActionItemComment::count())->toBe(1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems/ActionItemCommentsTest.php`
Expected: FAIL with `Route [retros.action-items.comments.store] not defined.`

- [ ] **Step 3: Presenter and actions**

`app/Actions/ActionItems/PresentActionItemComment.php`:

```php
<?php

namespace App\Actions\ActionItems;

use App\Models\ActionItemComment;

class PresentActionItemComment
{
    public function __construct(private ActionItemPermissions $permissions) {}

    /**
     * Comment authors are always named, also on anonymous retros.
     *
     * @return array{
     *     id: string,
     *     actionItemId: string,
     *     content: string,
     *     author: ?array{name: string, avatarUrl: string},
     *     isMine: bool,
     *     createdAt: ?string,
     *     updatedAt: ?string
     * }
     */
    public function handle(ActionItemComment $comment, ?ActionItemActor $viewer = null): array
    {
        return [
            'id' => $comment->id,
            'actionItemId' => $comment->action_item_id,
            'content' => $comment->content,
            'author' => $this->author($comment),
            'isMine' => $viewer !== null && $this->permissions->isCommentAuthor($comment, $viewer),
            'createdAt' => $comment->created_at?->toIso8601String(),
            'updatedAt' => $comment->updated_at?->toIso8601String(),
        ];
    }

    /**
     * @param  iterable<ActionItemComment>  $comments
     * @return array<int, array<string, mixed>>
     */
    public function many(iterable $comments, ?ActionItemActor $viewer = null): array
    {
        $presented = [];

        foreach ($comments as $comment) {
            $presented[] = $this->handle($comment, $viewer);
        }

        return $presented;
    }

    /**
     * @return ?array{name: string, avatarUrl: string}
     */
    private function author(ActionItemComment $comment): ?array
    {
        $participant = $comment->authorParticipant;

        if ($participant !== null) {
            return ['name' => $participant->displayName(), 'avatarUrl' => $participant->avatarUrl()];
        }

        $user = $comment->authorUser;

        if ($user === null) {
            return null;
        }

        return ['name' => $user->name, 'avatarUrl' => $user->avatarUrl()];
    }
}
```

`app/Actions/ActionItems/AddActionItemComment.php`:

```php
<?php

namespace App\Actions\ActionItems;

use App\Models\ActionItem;
use App\Models\ActionItemComment;

class AddActionItemComment
{
    public function __construct(
        private ActionItemPermissions $permissions,
        private BroadcastActionItemChange $broadcastActionItemChange,
    ) {}

    /**
     * On a board the participant is the author; from the global page or the
     * carry-over panel the user is.
     */
    public function handle(ActionItem $item, ActionItemActor $actor, string $content): ActionItemComment
    {
        $this->permissions->authorizeComment($item, $actor);

        $comment = $item->comments()->create([
            'author_participant_id' => $actor->participant?->id,
            'author_user_id' => $actor->participant === null ? $actor->user?->id : null,
            'content' => $content,
        ]);

        $comment->load(['authorParticipant.user', 'authorUser']);

        $this->broadcastActionItemChange->commentsChanged($item);

        return $comment;
    }
}
```

`app/Actions/ActionItems/UpdateActionItemComment.php`:

```php
<?php

namespace App\Actions\ActionItems;

use App\Models\ActionItemComment;

class UpdateActionItemComment
{
    public function __construct(
        private ActionItemPermissions $permissions,
        private BroadcastActionItemChange $broadcastActionItemChange,
    ) {}

    public function handle(ActionItemComment $comment, ActionItemActor $actor, string $content): ActionItemComment
    {
        $this->permissions->authorizeEditComment($comment, $actor);

        $comment->update(['content' => $content]);
        $comment->load(['authorParticipant.user', 'authorUser']);

        $this->broadcastActionItemChange->commentsChanged($comment->actionItem);

        return $comment;
    }
}
```

`app/Actions/ActionItems/DeleteActionItemComment.php`:

```php
<?php

namespace App\Actions\ActionItems;

use App\Models\ActionItemComment;

class DeleteActionItemComment
{
    public function __construct(
        private ActionItemPermissions $permissions,
        private BroadcastActionItemChange $broadcastActionItemChange,
    ) {}

    public function handle(ActionItemComment $comment, ActionItemActor $actor): void
    {
        $this->permissions->authorizeDeleteComment($comment, $actor);

        $item = $comment->actionItem;

        $comment->delete();

        $this->broadcastActionItemChange->commentsChanged($item);
    }
}
```

- [ ] **Step 4: Board controller and routes**

`app/Http/Controllers/Retros/ActionItemCommentsController.php`:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\AddActionItemComment;
use App\Actions\ActionItems\DeleteActionItemComment;
use App\Actions\ActionItems\PresentActionItemComment;
use App\Actions\ActionItems\UpdateActionItemComment;
use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Http\Controllers\Controller;
use App\Models\ActionItem;
use App\Models\ActionItemComment;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class ActionItemCommentsController extends Controller
{
    public function __construct(
        private PresentActionItemComment $presentActionItemComment,
        private AddActionItemComment $addActionItemComment,
        private UpdateActionItemComment $updateActionItemComment,
        private DeleteActionItemComment $deleteActionItemComment,
    ) {}

    public function index(Request $request, Retro $retro, ActionItem $actionItem): JsonResponse
    {
        $actor = ActionItemActor::forParticipant(Participant::current($request));

        $comments = $actionItem->comments()
            ->with(['authorParticipant.user', 'authorUser'])
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        return response()->json(['comments' => $this->presentActionItemComment->many($comments, $actor)]);
    }

    public function store(Request $request, Retro $retro, ActionItem $actionItem): JsonResponse
    {
        $actor = ActionItemActor::forParticipant(Participant::current($request));

        $this->guard($retro);

        $validated = $request->validate(['content' => ['required', 'string', 'max:500']]);

        $comment = DB::transaction(function () use ($retro, $actionItem, $actor, $validated): ActionItemComment {
            $locked = $this->lock($retro);
            $item = $locked->actionItems()->whereKey($actionItem->id)->firstOrFail();

            return $this->addActionItemComment->handle($item, $actor, $validated['content']);
        });

        return response()->json(['comment' => $this->presentActionItemComment->handle($comment, $actor)], 201);
    }

    public function update(Request $request, Retro $retro, ActionItemComment $actionItemComment): JsonResponse
    {
        $actor = ActionItemActor::forParticipant(Participant::current($request));

        $this->guard($retro);

        $validated = $request->validate(['content' => ['required', 'string', 'max:500']]);

        $comment = DB::transaction(function () use ($retro, $actionItemComment, $actor, $validated): ActionItemComment {
            $fresh = $this->lock($retro)->actionItemComments()->whereKey($actionItemComment->id)->firstOrFail();

            return $this->updateActionItemComment->handle($fresh, $actor, $validated['content']);
        });

        return response()->json(['comment' => $this->presentActionItemComment->handle($comment, $actor)]);
    }

    public function destroy(Request $request, Retro $retro, ActionItemComment $actionItemComment): Response
    {
        $actor = ActionItemActor::forParticipant(Participant::current($request));

        $this->guard($retro);

        DB::transaction(function () use ($retro, $actionItemComment, $actor): void {
            $fresh = $this->lock($retro)->actionItemComments()->whereKey($actionItemComment->id)->firstOrFail();

            $this->deleteActionItemComment->handle($fresh, $actor);
        });

        return response()->noContent();
    }

    private function guard(Retro $retro): void
    {
        RetroGuard::phase($retro, RetroPhase::Discussing);
        RetroGuard::unlocked($retro);
    }

    private function lock(Retro $retro): Retro
    {
        $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

        $this->guard($locked);

        return $locked;
    }
}
```

In `routes/web.php` add `use App\Http\Controllers\Retros\ActionItemCommentsController;` and, after the `retros.action-items.destroy` route:

```php
        Route::get('action-items/{actionItem}/comments', [ActionItemCommentsController::class, 'index'])->name('retros.action-items.comments.index')->whereUuid('actionItem');
        Route::post('action-items/{actionItem}/comments', [ActionItemCommentsController::class, 'store'])->name('retros.action-items.comments.store')->whereUuid('actionItem');
        Route::patch('action-item-comments/{actionItemComment}', [ActionItemCommentsController::class, 'update'])->name('retros.action-items.comments.update')->whereUuid('actionItemComment');
        Route::delete('action-item-comments/{actionItemComment}', [ActionItemCommentsController::class, 'destroy'])->name('retros.action-items.comments.destroy')->whereUuid('actionItemComment');
```

Then run `vendor/bin/sail artisan wayfinder:generate --with-form`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems/ActionItemCommentsTest.php tests/Feature/Retros/ActionItemsTest.php`
Expected: PASS.

- [ ] **Step 6: Pint, phpstan, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/ActionItems/PresentActionItemComment.php app/Actions/ActionItems/AddActionItemComment.php app/Actions/ActionItems/UpdateActionItemComment.php app/Actions/ActionItems/DeleteActionItemComment.php app/Http/Controllers/Retros/ActionItemCommentsController.php routes/web.php tests/Feature/ActionItems/ActionItemCommentsTest.php
git commit -m "feat: comment on action items from the board

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 8: Workspace endpoints (items outside a retro, any-phase edits, comments)

**Files:**
- Create: `app/Actions/ActionItems/WorkspaceActionItemGuard.php`, `app/Http/Controllers/WorkspaceActionItemsController.php`, `app/Http/Controllers/WorkspaceActionItemCommentsController.php`
- Modify: `routes/web.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/ActionItems/WorkspaceActionItemsTest.php`

**Interfaces:**
- Consumes: Tasks 2, 3, 5, 7 actions and presenters; `Workspace::actionItems()` (scoped binding, Task 1); `RetroGuard::unlocked()`.
- Produces: `WorkspaceActionItemGuard::visible(User $user, Workspace $workspace, ActionItem $item): void` (404), `WorkspaceActionItemGuard::writable(ActionItem $item): void` (423 for a locked retro that is not `Completed`); `WorkspaceActionItemsController::store/update/destroy` (Task 9 adds `index`); `WorkspaceActionItemCommentsController::index/store/update/destroy`; routes `workspaces.actionItems.store` (`POST /w/{workspace}/action-items {team_id, content, priority?, due_on?, assignee_user_id?}` → 201), `workspaces.actionItems.update` (`PATCH /w/{workspace}/action-items/{actionItem}`), `workspaces.actionItems.destroy` (`DELETE` → 204), `workspaces.actionItemComments.index|store` (`/w/{workspace}/action-items/{actionItem}/comments`), `workspaces.actionItemComments.update|destroy` (`/w/{workspace}/action-item-comments/{actionItemComment}`). Pest helpers `workspaceBoardItem(RetroPhase $phase = RetroPhase::Completed, array $attributes = []): array{0: Retro, 1: ActionItem, 2: User}` and `workspaceActionItemActor(string $role, Retro $retro, ActionItem $item, User $author): User`.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/ActionItems/WorkspaceActionItemsTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Events\ActionItems\TeamActionItemCommentsChanged;
use App\Events\ActionItems\TeamActionItemSaved;
use App\Events\Retros\ActionItemSaved;
use App\Models\ActionItem;
use App\Models\ActionItemComment;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

/**
 * @param  array<string, mixed>  $attributes
 * @return array{0: Retro, 1: ActionItem, 2: User}
 */
function workspaceBoardItem(RetroPhase $phase = RetroPhase::Completed, array $attributes = []): array
{
    $retro = Retro::factory()->inPhase($phase)->withGuestAccess()->create($attributes);
    [$author, $participant] = retroMember($retro);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $participant->id]);

    return [$retro, $item, $author];
}

function workspaceActionItemActor(string $role, Retro $retro, ActionItem $item, User $author): User
{
    return match ($role) {
        'author' => $author,
        'facilitator' => retroFacilitator($retro)[0],
        'workspace admin' => workspaceManager($retro->team->workspace),
        'member assignee' => tap(teamMember($retro->team), fn (User $user) => $item->update(['assignee_user_id' => $user->id])),
        'review facilitator' => retroFacilitator(Retro::factory()->create(['team_id' => $retro->team_id]))[0],
        'other member' => teamMember($retro->team),
    };
}

it('lets team members add items outside a retro', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $assignee = teamMember($team);

    $id = $this->actingAs($user)
        ->postJson(route('workspaces.actionItems.store', $team->workspace), [
            'team_id' => $team->id,
            'content' => 'Book the retro room',
            'priority' => 'low',
            'due_on' => '2026-11-02',
            'assignee_user_id' => $assignee->id,
            'theme_name' => 'Forged',
        ])
        ->assertCreated()
        ->assertJsonPath('actionItem.retroId', null)
        ->assertJsonPath('actionItem.source', null)
        ->assertJsonPath('actionItem.teamId', $team->id)
        ->assertJsonPath('actionItem.createdBy.name', $user->name)
        ->assertJsonPath('actionItem.assignee.id', $assignee->id)
        ->assertJsonPath('actionItem.isMine', true)
        ->json('actionItem.id');

    expect(ActionItem::find($id)->only(['created_by_user_id', 'created_by_participant_id', 'theme_name']))->toBe([
        'created_by_user_id' => $user->id,
        'created_by_participant_id' => null,
        'theme_name' => null,
    ]);
    Event::assertDispatched(TeamActionItemSaved::class, fn (TeamActionItemSaved $event) => $event->teamId === $team->id);
    Event::assertNotDispatched(ActionItemSaved::class);
});

it('refuses teams of other workspaces, unknown teams and teams the viewer cannot see', function (Closure $teamId) {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $this->actingAs($user)
        ->postJson(route('workspaces.actionItems.store', $team->workspace), ['team_id' => $teamId($team), 'content' => 'Nope'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('team_id');
})->with([
    'other workspace' => [fn (Team $team) => Team::factory()->create()->id],
    'unknown team' => [fn (Team $team) => '00000000-0000-4000-8000-000000000000'],
    'invisible team' => [fn (Team $team) => Team::factory()->create(['workspace_id' => $team->workspace_id])->id],
]);

it('refuses workspace admins who are not in the team', function () {
    $team = Team::factory()->create();
    $admin = workspaceManager($team->workspace);

    $this->actingAs($admin)
        ->postJson(route('workspaces.actionItems.store', $team->workspace), ['team_id' => $team->id, 'content' => 'Nope'])
        ->assertForbidden()
        ->assertJsonPath('message', 'Only team members can add action items to this team.');
});

it('assigns only team members from the workspace', function (Closure $payload, string $field) {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $retro = Retro::factory()->withGuestAccess()->create(['team_id' => $team->id]);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->actingAs($user)
        ->postJson(route('workspaces.actionItems.store', $team->workspace), ['team_id' => $team->id, 'content' => 'Assign', ...$payload($guest, $team)])
        ->assertUnprocessable()
        ->assertJsonValidationErrors($field);
})->with([
    'a guest' => [fn (Participant $guest, Team $team) => ['assignee_participant_id' => $guest->id], 'assignee_participant_id'],
    'an admin outside the team' => [fn (Participant $guest, Team $team) => ['assignee_user_id' => workspaceManager($team->workspace)->id], 'assignee_user_id'],
]);

it('applies the permission matrix on the workspace', function (string $role, string $action, int $status) {
    [$retro, $item, $author] = workspaceBoardItem();
    $user = workspaceActionItemActor($role, $retro, $item, $author);
    $params = ['workspace' => $retro->team->workspace, 'actionItem' => $item];

    $response = match ($action) {
        'edit' => $this->actingAs($user)->patchJson(route('workspaces.actionItems.update', $params), ['content' => 'Changed']),
        'complete' => $this->actingAs($user)->patchJson(route('workspaces.actionItems.update', $params), ['status' => 'completed']),
        'delete' => $this->actingAs($user)->deleteJson(route('workspaces.actionItems.destroy', $params)),
    };

    $response->assertStatus($status);
})->with(function () {
    $matrix = [
        'author' => ['edit' => 200, 'complete' => 200, 'delete' => 204],
        'facilitator' => ['edit' => 200, 'complete' => 200, 'delete' => 204],
        'workspace admin' => ['edit' => 200, 'complete' => 200, 'delete' => 204],
        'member assignee' => ['edit' => 403, 'complete' => 200, 'delete' => 403],
        'review facilitator' => ['edit' => 403, 'complete' => 200, 'delete' => 403],
        'other member' => ['edit' => 403, 'complete' => 403, 'delete' => 403],
    ];

    foreach ($matrix as $role => $actions) {
        foreach ($actions as $action => $status) {
            yield "{$role} may {$action}: {$status}" => [$role, $action, $status];
        }
    }
});

it('manages items added outside a retro', function () {
    $team = Team::factory()->create();
    $author = teamMember($team);
    $other = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $author)->create();
    [$reviewer] = retroFacilitator(Retro::factory()->create(['team_id' => $team->id]));
    $params = ['workspace' => $team->workspace, 'actionItem' => $item];

    $this->actingAs($other)->patchJson(route('workspaces.actionItems.update', $params), ['content' => 'Mine now'])->assertForbidden();
    $this->actingAs($author)->patchJson(route('workspaces.actionItems.update', $params), ['content' => 'Reworded'])->assertOk();
    $this->actingAs($reviewer)->patchJson(route('workspaces.actionItems.update', $params), ['status' => 'completed'])->assertOk();
    $this->actingAs(workspaceManager($team->workspace))->deleteJson(route('workspaces.actionItems.destroy', $params))->assertNoContent();
});

it('changes items in every phase from the workspace', function (RetroPhase $phase) {
    [$retro, $item, $author] = workspaceBoardItem($phase);

    $this->actingAs($author)
        ->patchJson(route('workspaces.actionItems.update', ['workspace' => $retro->team->workspace, 'actionItem' => $item]), ['priority' => 'high'])
        ->assertOk()
        ->assertJsonPath('actionItem.priority', 'high');
})->with([RetroPhase::Writing, RetroPhase::Voting, RetroPhase::Discussing, RetroPhase::Completed]);

it('returns 423 only for locked retros that are still running', function () {
    [$running, $runningItem, $runningAuthor] = workspaceBoardItem(RetroPhase::Voting, ['is_locked' => true]);
    [$finished, $finishedItem, $finishedAuthor] = workspaceBoardItem(RetroPhase::Completed, ['is_locked' => true]);
    $team = Team::factory()->create();
    $teamAuthor = teamMember($team);
    $teamItem = ActionItem::factory()->withoutRetro($team, $teamAuthor)->create();

    $this->actingAs($runningAuthor)
        ->patchJson(route('workspaces.actionItems.update', ['workspace' => $running->team->workspace, 'actionItem' => $runningItem]), ['status' => 'completed'])
        ->assertStatus(423);
    $this->actingAs($runningAuthor)
        ->postJson(route('workspaces.actionItemComments.store', ['workspace' => $running->team->workspace, 'actionItem' => $runningItem]), ['content' => 'Locked'])
        ->assertStatus(423);
    $this->actingAs($finishedAuthor)
        ->patchJson(route('workspaces.actionItems.update', ['workspace' => $finished->team->workspace, 'actionItem' => $finishedItem]), ['status' => 'completed'])
        ->assertOk();
    $this->actingAs($teamAuthor)
        ->patchJson(route('workspaces.actionItems.update', ['workspace' => $team->workspace, 'actionItem' => $teamItem]), ['status' => 'completed'])
        ->assertOk();
});

it('hides items of other workspaces and invisible teams', function () {
    [$retro, $item] = workspaceBoardItem();
    $workspace = $retro->team->workspace;
    $outsider = teamMember(Team::factory()->create(['workspace_id' => $workspace->id]));
    [$foreignRetro, $foreignItem] = workspaceBoardItem();
    $admin = workspaceManager($workspace);

    $this->actingAs($outsider)
        ->patchJson(route('workspaces.actionItems.update', ['workspace' => $workspace, 'actionItem' => $item]), ['status' => 'completed'])
        ->assertNotFound();
    $this->actingAs($outsider)
        ->getJson(route('workspaces.actionItemComments.index', ['workspace' => $workspace, 'actionItem' => $item]))
        ->assertNotFound();
    $this->actingAs($admin)
        ->patchJson(route('workspaces.actionItems.update', ['workspace' => $workspace, 'actionItem' => $foreignItem]), ['status' => 'completed'])
        ->assertNotFound();
});

it('keeps guests out of the workspace endpoints', function () {
    [$retro, $item] = workspaceBoardItem(RetroPhase::Discussing);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCookies(retroGuestCookie($guest))->withCredentials()
        ->patchJson(route('workspaces.actionItems.update', ['workspace' => $retro->team->workspace, 'actionItem' => $item]), ['status' => 'completed'])
        ->assertUnauthorized();
});

it('comments from the workspace as the user and keeps board comments editable there', function () {
    [$retro, $item, $author] = workspaceBoardItem();
    $boardComment = ActionItemComment::factory()->byParticipant($item->createdByParticipant)->create(['action_item_id' => $item->id]);
    $workspace = $retro->team->workspace;

    $this->actingAs($author)
        ->postJson(route('workspaces.actionItemComments.store', ['workspace' => $workspace, 'actionItem' => $item]), ['content' => 'Following up'])
        ->assertCreated()
        ->assertJsonPath('comment.author.name', $author->name)
        ->assertJsonPath('comment.isMine', true);
    $this->actingAs($author)
        ->patchJson(route('workspaces.actionItemComments.update', ['workspace' => $workspace, 'actionItemComment' => $boardComment]), ['content' => 'Edited'])
        ->assertOk()
        ->assertJsonPath('comment.content', 'Edited');
    $this->actingAs($author)
        ->getJson(route('workspaces.actionItemComments.index', ['workspace' => $workspace, 'actionItem' => $item]))
        ->assertOk()
        ->assertJsonCount(2, 'comments');

    expect(ActionItemComment::query()->where('content', 'Following up')->sole()->only(['author_user_id', 'author_participant_id']))
        ->toBe(['author_user_id' => $author->id, 'author_participant_id' => null]);
    Event::assertDispatched(TeamActionItemCommentsChanged::class, fn (TeamActionItemCommentsChanged $event) => $event->commentCount === 2);
});

it('keeps comment rights on the workspace', function () {
    [$retro, $item, $author] = workspaceBoardItem();
    $workspace = $retro->team->workspace;
    $comment = ActionItemComment::factory()->create(['action_item_id' => $item->id, 'author_user_id' => teamMember($retro->team)->id]);
    $other = teamMember($retro->team);
    $params = ['workspace' => $workspace, 'actionItemComment' => $comment];

    $this->actingAs($other)->patchJson(route('workspaces.actionItemComments.update', $params), ['content' => 'Hijacked'])->assertForbidden();
    $this->actingAs($other)->deleteJson(route('workspaces.actionItemComments.destroy', $params))->assertForbidden();
    $this->actingAs($author)->deleteJson(route('workspaces.actionItemComments.destroy', $params))->assertNoContent();
});

it('returns 404 for comments of items the viewer cannot see', function () {
    [$retro, $item] = workspaceBoardItem();
    $comment = ActionItemComment::factory()->create(['action_item_id' => $item->id]);
    $outsider = teamMember(Team::factory()->create(['workspace_id' => $retro->team->workspace_id]));

    $this->actingAs($outsider)
        ->patchJson(route('workspaces.actionItemComments.update', ['workspace' => $retro->team->workspace, 'actionItemComment' => $comment]), ['content' => 'x'])
        ->assertNotFound();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems/WorkspaceActionItemsTest.php`
Expected: FAIL with `Route [workspaces.actionItems.store] not defined.`

- [ ] **Step 3: Guard**

`app/Actions/ActionItems/WorkspaceActionItemGuard.php`:

```php
<?php

namespace App\Actions\ActionItems;

use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\User;
use App\Models\Workspace;

class WorkspaceActionItemGuard
{
    /**
     * Items of another workspace or of a team the viewer cannot see do not
     * exist for them: 404, never 403.
     */
    public static function visible(User $user, Workspace $workspace, ActionItem $item): void
    {
        abort_unless($item->team->workspace_id === $workspace->id, 404);
        abort_unless($user->can('view', $item->team), 404);
    }

    /**
     * A board closed for editing mid-meeting freezes its items everywhere;
     * completed retros and items without a retro never are.
     */
    public static function writable(ActionItem $item): void
    {
        $retro = $item->retro;

        if ($retro === null) {
            return;
        }

        if ($retro->phase === RetroPhase::Completed) {
            return;
        }

        RetroGuard::unlocked($retro);
    }
}
```

- [ ] **Step 4: Controllers**

`app/Http/Controllers/WorkspaceActionItemsController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ActionItemPermissions;
use App\Actions\ActionItems\ActionItemRules;
use App\Actions\ActionItems\ApplyActionItemChanges;
use App\Actions\ActionItems\CreateActionItem;
use App\Actions\ActionItems\DeleteActionItem;
use App\Actions\ActionItems\ResolveActionItemAssignee;
use App\Actions\ActionItems\WorkspaceActionItemGuard;
use App\Actions\Retros\PresentActionItem;
use App\Models\ActionItem;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class WorkspaceActionItemsController extends Controller
{
    public function __construct(
        private PresentActionItem $presentActionItem,
        private ActionItemPermissions $permissions,
        private CreateActionItem $createActionItem,
        private ApplyActionItemChanges $applyActionItemChanges,
        private DeleteActionItem $deleteActionItem,
        private ResolveActionItemAssignee $resolveActionItemAssignee,
    ) {}

    public function store(Request $request, Workspace $workspace): JsonResponse
    {
        $user = $request->user();
        $actor = ActionItemActor::forUser($user);

        $validated = $request->validate([
            'team_id' => ['required', 'uuid', Rule::exists('teams', 'id')->where('workspace_id', $workspace->id)],
            ...ActionItemRules::create(allowsGuests: false),
        ], ActionItemRules::messages());

        $team = Team::query()->findOrFail($validated['team_id']);

        if ($user->cannot('view', $team)) {
            throw ValidationException::withMessages(['team_id' => __('The selected team is invalid.')]);
        }

        $this->permissions->authorizeCreateWithoutRetro($user, $team);

        $actionItem = DB::transaction(fn (): ActionItem => $this->createActionItem->handle($team, null, $actor, [
            ...ActionItemRules::attributes($validated),
            ...($this->resolveActionItemAssignee->handle($team, null, $validated) ?? []),
        ]));

        return response()->json(['actionItem' => $this->presentActionItem->handle($actionItem, $actor)], 201);
    }

    public function update(Request $request, Workspace $workspace, ActionItem $actionItem): JsonResponse
    {
        $user = $request->user();
        $actor = ActionItemActor::forUser($user);

        WorkspaceActionItemGuard::visible($user, $workspace, $actionItem);

        $validated = $request->validate(ActionItemRules::update(allowsGuests: false), ActionItemRules::messages());

        $updated = DB::transaction(fn (): ActionItem => $this->applyActionItemChanges->handle($this->lock($actionItem), $actor, $validated));

        return response()->json(['actionItem' => $this->presentActionItem->handle($updated, $actor)]);
    }

    public function destroy(Request $request, Workspace $workspace, ActionItem $actionItem): Response
    {
        $user = $request->user();

        WorkspaceActionItemGuard::visible($user, $workspace, $actionItem);

        DB::transaction(function () use ($actionItem, $user): void {
            $this->deleteActionItem->handle($this->lock($actionItem), ActionItemActor::forUser($user));
        });

        return response()->noContent();
    }

    private function lock(ActionItem $actionItem): ActionItem
    {
        $locked = ActionItem::query()->whereKey($actionItem->id)->lockForUpdate()->firstOrFail();

        WorkspaceActionItemGuard::writable($locked);

        return $locked;
    }
}
```

`app/Http/Controllers/WorkspaceActionItemCommentsController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\AddActionItemComment;
use App\Actions\ActionItems\DeleteActionItemComment;
use App\Actions\ActionItems\PresentActionItemComment;
use App\Actions\ActionItems\UpdateActionItemComment;
use App\Actions\ActionItems\WorkspaceActionItemGuard;
use App\Models\ActionItem;
use App\Models\ActionItemComment;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class WorkspaceActionItemCommentsController extends Controller
{
    public function __construct(
        private PresentActionItemComment $presentActionItemComment,
        private AddActionItemComment $addActionItemComment,
        private UpdateActionItemComment $updateActionItemComment,
        private DeleteActionItemComment $deleteActionItemComment,
    ) {}

    public function index(Request $request, Workspace $workspace, ActionItem $actionItem): JsonResponse
    {
        $user = $request->user();

        WorkspaceActionItemGuard::visible($user, $workspace, $actionItem);

        $comments = $actionItem->comments()
            ->with(['authorParticipant.user', 'authorUser'])
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();

        return response()->json(['comments' => $this->presentActionItemComment->many($comments, ActionItemActor::forUser($user))]);
    }

    public function store(Request $request, Workspace $workspace, ActionItem $actionItem): JsonResponse
    {
        $user = $request->user();
        $actor = ActionItemActor::forUser($user);

        WorkspaceActionItemGuard::visible($user, $workspace, $actionItem);

        $validated = $request->validate(['content' => ['required', 'string', 'max:500']]);

        $comment = DB::transaction(fn (): ActionItemComment => $this->addActionItemComment->handle(
            $this->lockItem($actionItem->id),
            $actor,
            $validated['content'],
        ));

        return response()->json(['comment' => $this->presentActionItemComment->handle($comment, $actor)], 201);
    }

    public function update(Request $request, Workspace $workspace, ActionItemComment $actionItemComment): JsonResponse
    {
        $user = $request->user();
        $actor = ActionItemActor::forUser($user);

        WorkspaceActionItemGuard::visible($user, $workspace, $actionItemComment->actionItem);

        $validated = $request->validate(['content' => ['required', 'string', 'max:500']]);

        $comment = DB::transaction(function () use ($actionItemComment, $actor, $validated): ActionItemComment {
            $this->lockItem($actionItemComment->action_item_id);

            return $this->updateActionItemComment->handle($actionItemComment->fresh() ?? abort(404), $actor, $validated['content']);
        });

        return response()->json(['comment' => $this->presentActionItemComment->handle($comment, $actor)]);
    }

    public function destroy(Request $request, Workspace $workspace, ActionItemComment $actionItemComment): Response
    {
        $user = $request->user();

        WorkspaceActionItemGuard::visible($user, $workspace, $actionItemComment->actionItem);

        DB::transaction(function () use ($actionItemComment, $user): void {
            $this->lockItem($actionItemComment->action_item_id);

            $this->deleteActionItemComment->handle($actionItemComment->fresh() ?? abort(404), ActionItemActor::forUser($user));
        });

        return response()->noContent();
    }

    private function lockItem(string $actionItemId): ActionItem
    {
        $locked = ActionItem::query()->whereKey($actionItemId)->lockForUpdate()->firstOrFail();

        WorkspaceActionItemGuard::writable($locked);

        return $locked;
    }
}
```

- [ ] **Step 5: Routes**

In `routes/web.php` add `use App\Http\Controllers\WorkspaceActionItemCommentsController;` and `use App\Http\Controllers\WorkspaceActionItemsController;`, and inside the `w/{workspace}` group, after the templates routes:

```php
            Route::post('action-items', [WorkspaceActionItemsController::class, 'store'])->name('workspaces.actionItems.store');
            Route::patch('action-items/{actionItem}', [WorkspaceActionItemsController::class, 'update'])->name('workspaces.actionItems.update')->whereUuid('actionItem');
            Route::delete('action-items/{actionItem}', [WorkspaceActionItemsController::class, 'destroy'])->name('workspaces.actionItems.destroy')->whereUuid('actionItem');
            Route::get('action-items/{actionItem}/comments', [WorkspaceActionItemCommentsController::class, 'index'])->name('workspaces.actionItemComments.index')->whereUuid('actionItem');
            Route::post('action-items/{actionItem}/comments', [WorkspaceActionItemCommentsController::class, 'store'])->name('workspaces.actionItemComments.store')->whereUuid('actionItem');
            Route::patch('action-item-comments/{actionItemComment}', [WorkspaceActionItemCommentsController::class, 'update'])->name('workspaces.actionItemComments.update')->whereUuid('actionItemComment')->withoutScopedBindings();
            Route::delete('action-item-comments/{actionItemComment}', [WorkspaceActionItemCommentsController::class, 'destroy'])->name('workspaces.actionItemComments.destroy')->whereUuid('actionItemComment')->withoutScopedBindings();
```

`{actionItem}` is scoped through `Workspace::actionItems()` (an item of another workspace is a 404); comments are checked by `WorkspaceActionItemGuard::visible()` through their item. Then run `vendor/bin/sail artisan wayfinder:generate --with-form`.

- [ ] **Step 6: Translations**

| Key | fr | es | de |
|---|---|---|---|
| `The selected team is invalid.` | `L'équipe sélectionnée n'est pas valide.` | `El equipo seleccionado no es válido.` | `Das ausgewählte Team ist ungültig.` |

- [ ] **Step 7: Run tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 8: Pint, phpstan, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/ActionItems/WorkspaceActionItemGuard.php app/Http/Controllers/WorkspaceActionItemsController.php app/Http/Controllers/WorkspaceActionItemCommentsController.php routes/web.php tests/Feature/ActionItems/WorkspaceActionItemsTest.php lang
git commit -m "feat: manage action items from the workspace, also outside a retro

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 9: Global page read model (`ActionItemQuery`, filters, page props)

**Files:**
- Create: `app/Actions/ActionItems/ActionItemFilters.php`, `app/Actions/ActionItems/ActionItemQuery.php`
- Modify: `app/Http/Controllers/WorkspaceActionItemsController.php`, `app/Http/Controllers/TeamsController.php`, `routes/web.php`
- Test: create `tests/Feature/ActionItems/ActionItemsPageTest.php`

**Interfaces:**
- Consumes: `ActionItem::presentationRelations()`, `ActionItemPriority::sqlWeight()`, `ActionItem::today()` (Task 1); `PresentActionItem::many()` (Task 3); `Workspace::teamsVisibleTo(User)`.
- Produces:
  - `ActionItemFilters` (`public string $status` ∈ `open|overdue|completed|all`, `public ?string $assignee` ∈ `me|unassigned|{uuid}`, `public ?string $teamId`, `public ?string $itemId`; `static fromRequest(Request $request, Collection<int, Team> $visibleTeams): self` ignoring unknown values; `toArray(): array{status: string, assignee: ?string, team: ?string, item: ?string}`).
  - `ActionItemQuery::forUser(User $user, Workspace $workspace, ActionItemFilters $filters): LengthAwarePaginator<int, ActionItem>` (50 per page, eager-loaded), `ActionItemQuery::find(User $user, Workspace $workspace, string $itemId): ?ActionItem`, `ActionItemQuery::visibleTo(User $user, Workspace $workspace): Builder<ActionItem>`, `static ActionItemQuery::order(Builder<ActionItem> $query): Builder<ActionItem>` (shared with `CarriedActionItems`).
  - Route `workspaces.actionItems.index` (`GET /w/{workspace}/action-items?status&assignee&team&item&page`) rendering `action-items/index` with props `workspace {id, name, slug}`, `filters`, `items {data: ActionItemPayload[], currentPage, lastPage, total, prevPageUrl, nextPageUrl}`, `focusedItem: ActionItemPayload|null`, `teams [{id, name, members: [{id, name, avatarUrl}]}]` (visible teams), `creatableTeams` (same shape, teams the viewer is a member of), `assignees [{id, name}]` (members of visible teams), `realtimeTeamIds: string[]`, `viewer {userId, isWorkspaceManager, facilitatedRetroIds: string[], reviewTeamIds: string[]}`.
  - `teams/show` prop `openActionItemCount: int`.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/ActionItems/ActionItemsPageTest.php`:

```php
<?php

use App\Enums\ActionItemPriority;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\ActionItemComment;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Testing\TestResponse;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * @param  array<string, string>  $query
 */
function actionItemsPage(TestCase $test, User $user, Workspace $workspace, array $query = []): TestResponse
{
    return $test->actingAs($user)
        ->get(route('workspaces.actionItems.index', ['workspace' => $workspace, ...$query]))
        ->assertOk();
}

/**
 * @return array<int, string>
 */
function actionItemsPageIds(TestResponse $response): array
{
    return collect($response->viewData('page')['props']['items']['data'])->pluck('id')->all();
}

it('orders open items overdue first, then by due date, priority and age, then completed ones', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-10 12:00:00'));
    $team = Team::factory()->create();
    $user = teamMember($team);
    $make = fn (array $attributes) => ActionItem::factory()->withoutRetro($team, $user)->create($attributes);

    $noDateLow = $make(['priority' => ActionItemPriority::Low, 'created_at' => '2026-09-10 10:00:00']);
    $completedEarly = $make(['completed_at' => '2026-10-02 10:00:00']);
    $dueSoonLow = $make(['due_on' => '2026-10-12', 'priority' => ActionItemPriority::Low]);
    $overdueRecent = $make(['due_on' => '2026-10-08']);
    $noDateHighOld = $make(['priority' => ActionItemPriority::High, 'created_at' => '2026-09-01 10:00:00']);
    $completedLate = $make(['completed_at' => '2026-10-09 10:00:00']);
    $dueSoonHigh = $make(['due_on' => '2026-10-12', 'priority' => ActionItemPriority::High]);
    $overdueOld = $make(['due_on' => '2026-10-01']);
    $noDateHighNew = $make(['priority' => ActionItemPriority::High, 'created_at' => '2026-09-05 10:00:00']);

    expect(actionItemsPageIds(actionItemsPage($this, $user, $team->workspace, ['status' => 'all'])))->toBe([
        $overdueOld->id,
        $overdueRecent->id,
        $dueSoonHigh->id,
        $dueSoonLow->id,
        $noDateHighNew->id,
        $noDateHighOld->id,
        $noDateLow->id,
        $completedLate->id,
        $completedEarly->id,
    ]);
});

it('filters by status, assignee and team', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-10 12:00:00'));
    $team = Team::factory()->create();
    $otherTeam = Team::factory()->create(['workspace_id' => $team->workspace_id]);
    $user = teamMember($team);
    $otherTeam->members()->attach($user);
    $colleague = teamMember($team);
    $mine = ActionItem::factory()->withoutRetro($team, $user)->assignedTo($user)->create();
    $theirs = ActionItem::factory()->withoutRetro($team, $user)->assignedTo($colleague)->create(['due_on' => '2026-10-01']);
    $nobodys = ActionItem::factory()->withoutRetro($otherTeam, $user)->create();
    $done = ActionItem::factory()->withoutRetro($team, $user)->completed()->create();
    $workspace = $team->workspace;
    $ids = fn (array $query) => collect(actionItemsPageIds(actionItemsPage($this, $user, $workspace, $query)))->sort()->values()->all();
    $expected = fn (ActionItem ...$items) => collect($items)->pluck('id')->sort()->values()->all();

    expect($ids([]))->toBe($expected($mine, $theirs, $nobodys))
        ->and($ids(['status' => 'overdue']))->toBe($expected($theirs))
        ->and($ids(['status' => 'completed']))->toBe($expected($done))
        ->and($ids(['status' => 'all']))->toBe($expected($mine, $theirs, $nobodys, $done))
        ->and($ids(['assignee' => 'me']))->toBe($expected($mine))
        ->and($ids(['assignee' => 'unassigned']))->toBe($expected($nobodys))
        ->and($ids(['assignee' => $colleague->id]))->toBe($expected($theirs))
        ->and($ids(['team' => $otherTeam->id]))->toBe($expected($nobodys));
});

it('ignores unknown filter values', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $invisibleTeam = Team::factory()->create(['workspace_id' => $team->workspace_id]);
    $item = ActionItem::factory()->withoutRetro($team, $user)->create();

    actionItemsPage($this, $user, $team->workspace, ['status' => 'bogus', 'assignee' => 'somebody', 'team' => $invisibleTeam->id, 'item' => 'nope'])
        ->assertInertia(fn (Assert $page) => $page
            ->component('action-items/index', false)
            ->where('filters', ['status' => 'open', 'assignee' => null, 'team' => null, 'item' => null])
            ->where('items.data.0.id', $item->id)
            ->where('focusedItem', null));
});

it('shows members only their teams and admins every team of the workspace', function () {
    $team = Team::factory()->create();
    $hiddenTeam = Team::factory()->create(['workspace_id' => $team->workspace_id]);
    $member = teamMember($team);
    $admin = workspaceManager($team->workspace);
    $boardItem = ActionItem::factory()->create(['retro_id' => Retro::factory()->create(['team_id' => $team->id])->id]);
    $teamItem = ActionItem::factory()->withoutRetro($team, $member)->create();
    $hiddenItem = ActionItem::factory()->withoutRetro($hiddenTeam, teamMember($hiddenTeam))->create();
    ActionItem::factory()->create();

    $sorted = fn (array $ids) => collect($ids)->sort()->values()->all();

    expect($sorted(actionItemsPageIds(actionItemsPage($this, $member, $team->workspace))))
        ->toBe($sorted([$boardItem->id, $teamItem->id]))
        ->and($sorted(actionItemsPageIds(actionItemsPage($this, $admin, $team->workspace))))
        ->toBe($sorted([$boardItem->id, $teamItem->id, $hiddenItem->id]));
});

it('deep links to a visible item and ignores the others', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->completed()->create();
    $hidden = ActionItem::factory()->withoutRetro(Team::factory()->create(['workspace_id' => $team->workspace_id]), $user)->create();

    actionItemsPage($this, $user, $team->workspace, ['item' => $item->id])
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.item', $item->id)
            ->where('focusedItem.id', $item->id)
            ->where('focusedItem.status', 'completed'));

    actionItemsPage($this, $user, $team->workspace, ['item' => $hidden->id])
        ->assertInertia(fn (Assert $page) => $page->where('focusedItem', null));
});

it('paginates fifty items per page', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    ActionItem::factory()->count(51)->withoutRetro($team, $user)->create();

    actionItemsPage($this, $user, $team->workspace)
        ->assertInertia(fn (Assert $page) => $page
            ->has('items.data', 50)
            ->where('items.total', 51)
            ->where('items.lastPage', 2));

    actionItemsPage($this, $user, $team->workspace, ['page' => '2'])
        ->assertInertia(fn (Assert $page) => $page->has('items.data', 1)->where('items.currentPage', 2));
});

it('offers creatable teams, assignees, channels and the viewer context', function () {
    $team = Team::factory()->create(['name' => 'Alpha']);
    $adminOnlyTeam = Team::factory()->create(['workspace_id' => $team->workspace_id, 'name' => 'Beta']);
    $admin = workspaceManager($team->workspace);
    $team->members()->attach($admin);
    $colleague = teamMember($team);
    $running = Retro::factory()->create(['team_id' => $team->id]);
    $finished = Retro::factory()->inPhase(RetroPhase::Completed)->create(['team_id' => $adminOnlyTeam->id]);
    $running->forceFill(['facilitator_participant_id' => Participant::factory()->create(['retro_id' => $running->id, 'user_id' => $admin->id])->id])->save();
    $finished->forceFill(['facilitator_participant_id' => Participant::factory()->create(['retro_id' => $finished->id, 'user_id' => $admin->id])->id])->save();

    actionItemsPage($this, $admin, $team->workspace)
        ->assertInertia(fn (Assert $page) => $page
            ->where('teams.0.name', 'Alpha')
            ->where('teams.1.name', 'Beta')
            ->has('creatableTeams', 1)
            ->where('creatableTeams.0.id', $team->id)
            ->where('realtimeTeamIds', [$team->id, $adminOnlyTeam->id])
            ->where('viewer.userId', $admin->id)
            ->where('viewer.isWorkspaceManager', true)
            ->where('viewer.reviewTeamIds', [$team->id])
            ->where('viewer.facilitatedRetroIds', fn ($ids) => collect($ids)->sort()->values()->all() === collect([$running->id, $finished->id])->sort()->values()->all())
            ->where('assignees', fn ($assignees) => collect($assignees)->pluck('id')->contains($colleague->id)));

    actionItemsPage($this, $admin, $team->workspace, ['team' => $adminOnlyTeam->id])
        ->assertInertia(fn (Assert $page) => $page->where('realtimeTeamIds', [$adminOnlyTeam->id]));
});

it('loads the page with a constant number of queries', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $seed = function (int $count) use ($team, $user): void {
        $retro = Retro::factory()->create(['team_id' => $team->id]);
        ActionItem::factory()->count($count)->assignedTo($user)->create(['retro_id' => $retro->id])
            ->each(fn (ActionItem $item) => ActionItemComment::factory()->create(['action_item_id' => $item->id]));
        ActionItem::factory()->count($count)->withoutRetro($team, $user)->create();
    };
    $countQueries = function () use ($team, $user): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        actionItemsPage($this, $user, $team->workspace);
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    $seed(2);
    $small = $countQueries();

    $seed(6);

    expect($countQueries())->toBe($small);
});

it('counts open action items on the team page', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    ActionItem::factory()->count(2)->withoutRetro($team, $user)->create();
    ActionItem::factory()->withoutRetro($team, $user)->completed()->create();

    $this->actingAs($user)
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page->where('openActionItemCount', 2));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems/ActionItemsPageTest.php`
Expected: FAIL with `Route [workspaces.actionItems.index] not defined.`

- [ ] **Step 3: Filters and query**

`app/Actions/ActionItems/ActionItemFilters.php`:

```php
<?php

namespace App\Actions\ActionItems;

use App\Models\Team;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class ActionItemFilters
{
    public const Statuses = ['open', 'overdue', 'completed', 'all'];

    public function __construct(
        public string $status = 'open',
        public ?string $assignee = null,
        public ?string $teamId = null,
        public ?string $itemId = null,
    ) {}

    /**
     * Unknown values fall back to the defaults instead of failing.
     *
     * @param  Collection<int, Team>  $visibleTeams
     */
    public static function fromRequest(Request $request, Collection $visibleTeams): self
    {
        $status = $request->query('status');
        $team = $request->query('team');
        $item = $request->query('item');

        return new self(
            status: is_string($status) && in_array($status, self::Statuses, true) ? $status : 'open',
            assignee: self::assignee($request->query('assignee')),
            teamId: is_string($team) && $visibleTeams->contains('id', $team) ? $team : null,
            itemId: is_string($item) && Str::isUuid($item) ? $item : null,
        );
    }

    /**
     * @return array{
     *     status: string,
     *     assignee: ?string,
     *     team: ?string,
     *     item: ?string
     * }
     */
    public function toArray(): array
    {
        return [
            'status' => $this->status,
            'assignee' => $this->assignee,
            'team' => $this->teamId,
            'item' => $this->itemId,
        ];
    }

    private static function assignee(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        if (in_array($value, ['me', 'unassigned'], true)) {
            return $value;
        }

        return Str::isUuid($value) ? $value : null;
    }
}
```

`app/Actions/ActionItems/ActionItemQuery.php`:

```php
<?php

namespace App\Actions\ActionItems;

use App\Enums\ActionItemPriority;
use App\Models\ActionItem;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

class ActionItemQuery
{
    public const PerPage = 50;

    /**
     * @return LengthAwarePaginator<int, ActionItem>
     */
    public function forUser(User $user, Workspace $workspace, ActionItemFilters $filters): LengthAwarePaginator
    {
        $query = $this->visibleTo($user, $workspace)
            ->with(ActionItem::presentationRelations())
            ->withCount('comments');

        $this->filterByStatus($query, $filters->status);
        $this->filterByAssignee($query, $user, $filters->assignee);

        if ($filters->teamId !== null) {
            $query->where('team_id', $filters->teamId);
        }

        return self::order($query)->paginate(self::PerPage)->withQueryString();
    }

    public function find(User $user, Workspace $workspace, string $itemId): ?ActionItem
    {
        return $this->visibleTo($user, $workspace)
            ->with(ActionItem::presentationRelations())
            ->withCount('comments')
            ->find($itemId);
    }

    /**
     * Items of the workspace's teams the user can view: all of them for
     * Owners/Admins, their own teams for Members.
     *
     * @return Builder<ActionItem>
     */
    public function visibleTo(User $user, Workspace $workspace): Builder
    {
        $query = ActionItem::query()->whereIn('team_id', $workspace->teams()->select('id'));

        if ($user->canManage($workspace)) {
            return $query;
        }

        return $query->whereIn('team_id', $user->teams()->select('teams.id'));
    }

    /**
     * Open before completed; overdue first, then by due date (none last),
     * priority and newest; completed ones by completion, newest first.
     *
     * @param  Builder<ActionItem>  $query
     * @return Builder<ActionItem>
     */
    public static function order(Builder $query): Builder
    {
        $today = ActionItem::today()->toDateString();

        return $query
            ->orderByRaw('(action_items.completed_at is not null)')
            ->orderByRaw('case when action_items.completed_at is null and action_items.due_on < ? then 0 else 1 end', [$today])
            ->orderByRaw('case when action_items.completed_at is null then action_items.due_on end asc nulls last')
            ->orderByRaw('case when action_items.completed_at is null then '.ActionItemPriority::sqlWeight().' end')
            ->orderByDesc('action_items.completed_at')
            ->orderByDesc('action_items.created_at')
            ->orderBy('action_items.id');
    }

    /**
     * @param  Builder<ActionItem>  $query
     */
    private function filterByStatus(Builder $query, string $status): void
    {
        if ($status === 'all') {
            return;
        }

        if ($status === 'completed') {
            $query->whereNotNull('completed_at');

            return;
        }

        $query->whereNull('completed_at');

        if ($status === 'overdue') {
            $query->whereNotNull('due_on')->where('due_on', '<', ActionItem::today()->toDateString());
        }
    }

    /**
     * @param  Builder<ActionItem>  $query
     */
    private function filterByAssignee(Builder $query, User $user, ?string $assignee): void
    {
        if ($assignee === null) {
            return;
        }

        if ($assignee === 'unassigned') {
            $query->whereNull('assignee_user_id')->whereNull('assignee_participant_id');

            return;
        }

        $query->where('assignee_user_id', $assignee === 'me' ? $user->id : $assignee);
    }
}
```

- [ ] **Step 4: The page action**

In `app/Http/Controllers/WorkspaceActionItemsController.php` add the imports `use App\Actions\ActionItems\ActionItemFilters;`, `use App\Actions\ActionItems\ActionItemQuery;`, `use App\Enums\RetroPhase;`, `use App\Models\Retro;`, `use App\Models\User;`, `use Illuminate\Database\Eloquent\Collection;`, `use Inertia\Inertia;`, `use Inertia\Response as InertiaResponse;`, add `private ActionItemQuery $actionItemQuery,` to the constructor, and add:

```php
    public function index(Request $request, Workspace $workspace): InertiaResponse
    {
        $user = $request->user();
        $actor = ActionItemActor::forUser($user);
        $teams = $workspace->teamsVisibleTo($user)->load(['members' => fn ($query) => $query->orderBy('name')]);
        $filters = ActionItemFilters::fromRequest($request, $teams);
        $facilitated = Retro::query()
            ->whereIn('team_id', $teams->pluck('id'))
            ->whereHas('facilitator', fn ($query) => $query->where('user_id', $user->id))
            ->get(['id', 'team_id', 'phase']);

        return Inertia::render('action-items/index', [
            'workspace' => $workspace->only(['id', 'name', 'slug']),
            'filters' => $filters->toArray(),
            'items' => fn () => $this->items($user, $workspace, $filters, $actor),
            'focusedItem' => fn () => $this->focusedItem($user, $workspace, $filters, $actor),
            'teams' => $this->presentTeams($teams),
            'creatableTeams' => $this->presentTeams($teams->filter(fn (Team $team) => $team->members->contains('id', $user->id))),
            'assignees' => $teams->flatMap(fn (Team $team) => $team->members)
                ->unique('id')
                ->sortBy('name')
                ->map(fn (User $member) => ['id' => $member->id, 'name' => $member->name])
                ->values(),
            'realtimeTeamIds' => $filters->teamId === null ? $teams->pluck('id')->values() : [$filters->teamId],
            'viewer' => [
                'userId' => $user->id,
                'isWorkspaceManager' => $user->canManage($workspace),
                'facilitatedRetroIds' => $facilitated->pluck('id')->values(),
                'reviewTeamIds' => $facilitated
                    ->reject(fn (Retro $retro) => $retro->phase === RetroPhase::Completed)
                    ->pluck('team_id')
                    ->unique()
                    ->values(),
            ],
        ]);
    }
```

and the private helpers:

```php
    /**
     * @return array{
     *     data: array<int, array<string, mixed>>,
     *     currentPage: int,
     *     lastPage: int,
     *     total: int,
     *     prevPageUrl: ?string,
     *     nextPageUrl: ?string
     * }
     */
    private function items(User $user, Workspace $workspace, ActionItemFilters $filters, ActionItemActor $actor): array
    {
        $page = $this->actionItemQuery->forUser($user, $workspace, $filters);

        return [
            'data' => $this->presentActionItem->many($page->items(), $actor),
            'currentPage' => $page->currentPage(),
            'lastPage' => $page->lastPage(),
            'total' => $page->total(),
            'prevPageUrl' => $page->previousPageUrl(),
            'nextPageUrl' => $page->nextPageUrl(),
        ];
    }

    /**
     * @return ?array<string, mixed>
     */
    private function focusedItem(User $user, Workspace $workspace, ActionItemFilters $filters, ActionItemActor $actor): ?array
    {
        if ($filters->itemId === null) {
            return null;
        }

        $item = $this->actionItemQuery->find($user, $workspace, $filters->itemId);

        return $item === null ? null : $this->presentActionItem->handle($item, $actor);
    }

    /**
     * @param  Collection<int, Team>  $teams
     * @return array<int, array{id: string, name: string, members: array<int, array{id: string, name: string, avatarUrl: string}>}>
     */
    private function presentTeams(Collection $teams): array
    {
        return $teams->map(fn (Team $team) => [
            'id' => $team->id,
            'name' => $team->name,
            'members' => $team->members
                ->map(fn (User $member) => ['id' => $member->id, 'name' => $member->name, 'avatarUrl' => $member->avatarUrl()])
                ->values()
                ->all(),
        ])->values()->all();
    }
```

In `routes/web.php`, inside the `w/{workspace}` group before the `action-items` POST route:

```php
            Route::get('action-items', [WorkspaceActionItemsController::class, 'index'])->name('workspaces.actionItems.index');
```

In `app/Http/Controllers/TeamsController.php` add to the `teams/show` props:

```php
            'openActionItemCount' => $team->actionItems()->whereNull('completed_at')->count(),
```

Run `vendor/bin/sail artisan wayfinder:generate --with-form`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems/ActionItemsPageTest.php tests/Feature/Teams/TeamsTest.php`
Expected: PASS.

- [ ] **Step 6: Pint, phpstan, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/ActionItems/ActionItemFilters.php app/Actions/ActionItems/ActionItemQuery.php app/Http/Controllers/WorkspaceActionItemsController.php app/Http/Controllers/TeamsController.php routes/web.php tests/Feature/ActionItems/ActionItemsPageTest.php
git commit -m "feat: list a workspace's action items with filters, ordering and deep links

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 10: Carry-over and snapshot additions

**Files:**
- Create: `app/Actions/ActionItems/CarriedActionItems.php`
- Modify: `app/Actions/Retros/BuildBoardSnapshot.php`
- Test: create `tests/Feature/ActionItems/CarryOverTest.php`

**Interfaces:**
- Consumes: `ActionItemQuery::order()` (Task 9), `PresentActionItem::many()` (Task 3), `ActionItem::presentationRelations()` (Task 1).
- Produces: `CarriedActionItems::handle(Retro $retro): array{items: Collection<int, ActionItem>, hasMore: bool}` (cap 200, same rule as `BroadcastActionItemChange::carryingRetroIds()`); snapshot additions `retro.teamId`, `viewer.userId` (null for guests), `viewer.canManageActionItems` (facilitator or workspace Owner/Admin), `viewer.isWorkspaceManager`, `viewer.isReviewFacilitator` (facilitator of this retro while it is not `Completed`), `viewer.facilitatedRetroIds: string[]` (retros of this team the viewer facilitates), `teamMembers: [{id, name, avatarUrl, participantId}]` (`participantId` = the member's participant in this retro or `null`; no emails; guests get it too), `carriedActionItems` (presented with the viewer; `[]` for guests), `carriedActionItemsHasMore: bool`, `links.actionItems` (global page filtered by the team; `null` for guests), `links.workspace` (workspace slug; `null` for guests).

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/ActionItems/CarryOverTest.php`:

```php
<?php

use App\Actions\ActionItems\CarriedActionItems;
use App\Actions\Retros\BuildBoardSnapshot;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\ActionItemComment;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * @return array<int, string>
 */
function carriedIds(Retro $retro): array
{
    return app(CarriedActionItems::class)->handle($retro->fresh())['items']->pluck('id')->sort()->values()->all();
}

it('carries only earlier open or recently completed items', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-05 10:00:00'));
    $team = Team::factory()->create();
    $earlier = Retro::factory()->inPhase(RetroPhase::Completed)->create(['team_id' => $team->id, 'created_at' => '2026-09-01 10:00:00']);
    $current = Retro::factory()->create(['team_id' => $team->id, 'created_at' => '2026-10-01 10:00:00']);
    $later = Retro::factory()->create(['team_id' => $team->id, 'created_at' => '2026-10-03 10:00:00']);
    $otherTeam = Retro::factory()->inPhase(RetroPhase::Completed)->create(['created_at' => '2026-09-01 10:00:00']);
    $open = ActionItem::factory()->create(['retro_id' => $earlier->id]);
    $completedDuringReview = ActionItem::factory()->create(['retro_id' => $earlier->id, 'completed_at' => '2026-10-01 11:00:00']);
    ActionItem::factory()->create(['retro_id' => $earlier->id, 'completed_at' => '2026-09-20 10:00:00']);
    ActionItem::factory()->create(['retro_id' => $current->id]);
    ActionItem::factory()->create(['retro_id' => $later->id]);
    ActionItem::factory()->create(['retro_id' => $otherTeam->id]);

    expect(carriedIds($current))->toBe(collect([$open->id, $completedDuringReview->id])->sort()->values()->all())
        ->and(app(CarriedActionItems::class)->handle($current->fresh())['hasMore'])->toBeFalse();
});

it('carries items added outside a retro only into later retros', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-05 10:00:00'));
    $team = Team::factory()->create();
    $running = Retro::factory()->create(['team_id' => $team->id, 'created_at' => '2026-10-01 10:00:00']);
    $next = Retro::factory()->create(['team_id' => $team->id, 'created_at' => '2026-10-04 10:00:00']);
    $teamItem = ActionItem::factory()->withoutRetro($team, teamMember($team))->create(['created_at' => '2026-10-02 10:00:00']);

    expect(carriedIds($running))->toBe([])
        ->and(carriedIds($next))->toBe([$teamItem->id]);
});

it('caps the carried items at two hundred', function () {
    $team = Team::factory()->create();
    $retro = Retro::factory()->create(['team_id' => $team->id]);
    ActionItem::factory()->count(201)->withoutRetro($team, teamMember($team))->create(['created_at' => now()->subDay()]);

    $carried = app(CarriedActionItems::class)->handle($retro->fresh());

    expect($carried['items'])->toHaveCount(200)
        ->and($carried['hasMore'])->toBeTrue();
});

it('adds carried items and the team context to member snapshots', function () {
    $team = Team::factory()->create();
    $earlier = Retro::factory()->inPhase(RetroPhase::Completed)->create(['team_id' => $team->id, 'created_at' => now()->subWeek()]);
    $item = ActionItem::factory()->create(['retro_id' => $earlier->id]);
    $current = Retro::factory()->anonymous()->create(['team_id' => $team->id]);
    [$user, $viewer] = retroMember($current);

    $snapshot = app(BuildBoardSnapshot::class)->handle($current->fresh(), $viewer);

    expect($snapshot['carriedActionItems'])->toHaveCount(1)
        ->and($snapshot['carriedActionItems'][0]['id'])->toBe($item->id)
        ->and($snapshot['carriedActionItems'][0]['createdBy'])->not->toBeNull()
        ->and($snapshot['carriedActionItemsHasMore'])->toBeFalse()
        ->and($snapshot['retro']['teamId'])->toBe($team->id)
        ->and($snapshot['viewer'])->toMatchArray([
            'userId' => $user->id,
            'canManageActionItems' => false,
            'isWorkspaceManager' => false,
            'isReviewFacilitator' => false,
            'facilitatedRetroIds' => [],
        ])
        ->and($snapshot['teamMembers'])->toContain([
            'id' => $user->id,
            'name' => $user->name,
            'avatarUrl' => $user->avatarUrl(),
            'participantId' => $viewer->id,
        ])
        ->and($snapshot['links']['actionItems'])->toBe(route('workspaces.actionItems.index', ['workspace' => $team->workspace, 'team' => $team->id]))
        ->and($snapshot['links']['workspace'])->toBe($team->workspace->slug);
});

it('marks the facilitator and workspace admins as managers', function () {
    $retro = Retro::factory()->create();
    [, $facilitator] = retroFacilitator($retro);
    [, $admin] = workspaceAdminParticipant($retro);

    $facilitatorView = app(BuildBoardSnapshot::class)->handle($retro->fresh(), $facilitator)['viewer'];
    $adminView = app(BuildBoardSnapshot::class)->handle($retro->fresh(), $admin)['viewer'];

    expect($facilitatorView)->toMatchArray([
        'canManageActionItems' => true,
        'isWorkspaceManager' => false,
        'isReviewFacilitator' => true,
        'facilitatedRetroIds' => [$retro->id],
    ])
        ->and($adminView)->toMatchArray([
            'canManageActionItems' => true,
            'isWorkspaceManager' => true,
            'isReviewFacilitator' => false,
        ]);
});

it('never gives carried items to guests', function () {
    $team = Team::factory()->create();
    $earlier = Retro::factory()->inPhase(RetroPhase::Completed)->create(['team_id' => $team->id, 'created_at' => now()->subWeek()]);
    ActionItem::factory()->create(['retro_id' => $earlier->id, 'content' => 'Secret follow-up']);
    $current = Retro::factory()->withGuestAccess()->create(['team_id' => $team->id]);
    $member = teamMember($team);
    $guest = Participant::factory()->guest()->create(['retro_id' => $current->id]);

    $snapshot = app(BuildBoardSnapshot::class)->handle($current->fresh(), $guest);

    expect($snapshot['carriedActionItems'])->toBe([])
        ->and($snapshot['carriedActionItemsHasMore'])->toBeFalse()
        ->and($snapshot['links']['actionItems'])->toBeNull()
        ->and($snapshot['links']['workspace'])->toBeNull()
        ->and($snapshot['viewer']['userId'])->toBeNull()
        ->and(json_encode($snapshot))->not->toContain('Secret follow-up')
        ->and(json_encode($snapshot))->not->toContain($member->email)
        ->and(collect($snapshot['teamMembers'])->pluck('id')->all())->toContain($member->id);
});

it('builds the action item parts of the snapshot with a constant number of queries', function () {
    $team = Team::factory()->create();
    $current = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['team_id' => $team->id]);
    [, $viewer] = retroMember($current);
    $seed = function (int $count) use ($team, $current): void {
        $earlier = Retro::factory()->inPhase(RetroPhase::Completed)->create(['team_id' => $team->id, 'created_at' => now()->subWeek()]);
        ActionItem::factory()->count($count)->create(['retro_id' => $earlier->id])
            ->each(fn (ActionItem $item) => ActionItemComment::factory()->create(['action_item_id' => $item->id]));
        ActionItem::factory()->count($count)->withoutRetro($team, teamMember($team))->create(['created_at' => now()->subDay()]);
        ActionItem::factory()->count($count)->create(['retro_id' => $current->id]);
    };
    $countQueries = function () use ($current, $viewer): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        app(BuildBoardSnapshot::class)->handle($current->fresh(), $viewer);
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    $seed(2);
    $small = $countQueries();

    $seed(6);

    expect($countQueries())->toBe($small);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems/CarryOverTest.php`
Expected: FAIL with `Class "App\Actions\ActionItems\CarriedActionItems" not found`.

- [ ] **Step 3: The carry-over query**

`app/Actions/ActionItems/CarriedActionItems.php`:

```php
<?php

namespace App\Actions\ActionItems;

use App\Models\ActionItem;
use App\Models\Retro;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;

class CarriedActionItems
{
    public const Limit = 200;

    /**
     * The team's earlier follow-ups this retro reviews: items of older
     * retros, or added outside a retro before it started, that are still
     * open or were completed since it started (they stay, struck through).
     * BroadcastActionItemChange::carryingRetroIds() applies the same rule.
     *
     * @return array{items: Collection<int, ActionItem>, hasMore: bool}
     */
    public function handle(Retro $retro): array
    {
        $startedAt = $retro->created_at;

        $query = ActionItem::query()
            ->where('team_id', $retro->team_id)
            ->where(fn (Builder $query) => $query
                ->whereIn('retro_id', Retro::query()->select('id')->where('team_id', $retro->team_id)->where('created_at', '<', $startedAt))
                ->orWhere(fn (Builder $query) => $query->whereNull('retro_id')->where('created_at', '<', $startedAt)))
            ->where(fn (Builder $query) => $query->whereNull('completed_at')->orWhere('completed_at', '>=', $startedAt))
            ->with(ActionItem::presentationRelations())
            ->withCount('comments');

        $items = ActionItemQuery::order($query)->limit(self::Limit + 1)->get();

        return ['items' => $items->take(self::Limit), 'hasMore' => $items->count() > self::Limit];
    }
}
```

- [ ] **Step 4: Snapshot additions**

In `app/Actions/Retros/BuildBoardSnapshot.php`:

- add `use App\Actions\ActionItems\CarriedActionItems;` and the constructor parameter `private CarriedActionItems $carriedActionItems,`;
- add `'team.members',` to the `loadMissing([...])` list;
- at the top of `handle()`, after `$surveys = …`, add:

```php
        $viewerParticipant = $retro->participants->firstWhere('id', $viewer->id) ?? $viewer;
        $isFacilitator = $retro->isFacilitator($viewer);
        $isWorkspaceManager = ! $viewer->isGuest() && ($viewerParticipant->user?->canManage($retro->team->workspace) ?? false);
        $carried = $viewer->isGuest()
            ? ['items' => [], 'hasMore' => false]
            : $this->carriedActionItems->handle($retro);
```

- in the `'retro'` array add `'teamId' => $retro->team_id,`;
- in the `'viewer'` array add:

```php
                'userId' => $viewer->user_id,
                'canManageActionItems' => $isFacilitator || $isWorkspaceManager,
                'isWorkspaceManager' => $isWorkspaceManager,
                'isReviewFacilitator' => $isFacilitator && $retro->phase !== RetroPhase::Completed,
                'facilitatedRetroIds' => $this->facilitatedRetroIds($retro, $viewer),
```

- after the `'actionItems'` entry add:

```php
            'carriedActionItems' => $this->presentActionItem->many($carried['items'], ActionItemActor::forParticipant($viewerParticipant)),
            'carriedActionItemsHasMore' => $carried['hasMore'],
            'teamMembers' => $this->teamMembers($retro),
```

- replace the `'links'` array with:

```php
            'links' => [
                'team' => $viewer->isGuest() ? null : route('teams.show', [$retro->team->workspace, $retro->team]),
                'actionItems' => $viewer->isGuest()
                    ? null
                    : route('workspaces.actionItems.index', ['workspace' => $retro->team->workspace, 'team' => $retro->team_id]),
                'workspace' => $viewer->isGuest() ? null : $retro->team->workspace->slug,
            ],
```

- add the private helpers (and `use App\Models\User;` is already imported):

```php
    /**
     * Guests may assign team members on their board, so they get the list
     * too, without emails.
     *
     * @return array<int, array{
     *     id: string,
     *     name: string,
     *     avatarUrl: string,
     *     participantId: ?string
     * }>
     */
    private function teamMembers(Retro $retro): array
    {
        $participantIds = $retro->participants->whereNotNull('user_id')->pluck('id', 'user_id');

        return $retro->team->members
            ->sortBy('name')
            ->map(fn (User $member) => [
                'id' => $member->id,
                'name' => $member->name,
                'avatarUrl' => $member->avatarUrl(),
                'participantId' => $participantIds[$member->id] ?? null,
            ])
            ->values()
            ->all();
    }

    /**
     * @return array<int, string>
     */
    private function facilitatedRetroIds(Retro $retro, Participant $viewer): array
    {
        if ($viewer->user_id === null) {
            return $retro->isFacilitator($viewer) ? [$retro->id] : [];
        }

        /** @var array<int, string> $retroIds */
        $retroIds = Retro::query()
            ->where('team_id', $retro->team_id)
            ->whereHas('facilitator', fn ($query) => $query->where('user_id', $viewer->user_id))
            ->pluck('id')
            ->all();

        return $retroIds;
    }
```

`CarriedActionItems::handle()` returns an Eloquent collection and the guest branch an empty array; `PresentActionItem::many()` accepts any iterable.

- [ ] **Step 5: Run tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems/CarryOverTest.php tests/Feature/Retros/BoardSnapshotTest.php`
Expected: PASS.

- [ ] **Step 6: Pint, phpstan, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/ActionItems/CarriedActionItems.php app/Actions/Retros/BuildBoardSnapshot.php tests/Feature/ActionItems/CarryOverTest.php
git commit -m "feat: carry the team's open action items into its next retros

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 11: Frontend foundation (types, permissions, endpoints, reducer, channels)

**Files:**
- Create: `resources/js/lib/action-items/permissions.ts`, `resources/js/lib/action-items/endpoints.ts`, `resources/js/lib/action-items/assignees.ts`, `resources/js/lib/action-items/format.ts`
- Modify: `resources/js/lib/retro/types.ts`, `resources/js/lib/retro/board-reducer.ts`, `resources/js/hooks/use-retro-channel.ts`, `resources/js/hooks/use-retro-board.ts`, `resources/js/components/retro/action-items-panel.tsx`, `resources/js/components/retro/results/action-items-results.tsx`

**Interfaces:**
- Consumes: payload shapes of Tasks 3, 7, 10; Wayfinder controllers `Retros/ActionItemsController`, `Retros/ActionItemCommentsController`, `WorkspaceActionItemsController`, `WorkspaceActionItemCommentsController`; events of Task 4.
- Produces:
  - Types in `resources/js/lib/retro/types.ts`: `ActionItemPriority`, `ActionItemStatus`, `ActionItemPerson`, `ActionItemAssignee`, `ActionItemSource`, `ActionItem` (spec §5 shape plus client-only `commentsRevision?: number`), `ActionItemComment`, `TeamMember`; `Snapshot` gains `retro.teamId`, `viewer.{userId, canManageActionItems, isWorkspaceManager, isReviewFacilitator, facilitatedRetroIds}`, `carriedActionItems`, `carriedActionItemsHasMore`, `teamMembers`, `links.{actionItems, workspace}`.
  - `resources/js/lib/action-items/permissions.ts`: `type ActionItemViewer = {userId, participantId, isWorkspaceManager, facilitatedRetroIds, reviewTeamIds}`, `canManageActionItem(item, viewer)`, `isActionItemAssignee(item, viewer)`, `canCompleteActionItem(item, viewer)`, `canDeleteActionItemComment(comment, item, viewer)`, `boardActionItemViewer(board: Snapshot): ActionItemViewer`.
  - `resources/js/lib/action-items/endpoints.ts`: `type EndpointRoute = {url: string; method: string}`, `type ActionItemEndpoints = {update, destroy, comments, addComment, updateComment, destroyComment}` (each `(id: string) => EndpointRoute`), `boardActionItemEndpoints(retroId: string)`, `workspaceActionItemEndpoints(workspaceSlug: string)`.
  - `resources/js/lib/action-items/assignees.ts`: `Unassigned = 'none'`, `assigneeValue(assignee: ActionItemAssignee | null): string` (`member:{userId}` / `guest:{participantId}` / `none`), `assigneePayload(value: string): {assignee_user_id: string | null; assignee_participant_id: string | null}`.
  - `resources/js/lib/action-items/format.ts`: `formatDueDate(dueOn: string, locale: string): string` ("3 Oct"), `formatShortDate(iso: string, locale: string): string`.
  - Reducer actions `actionItem.upsert` (keeps `isMine` and `commentsRevision` of the known copy), `actionItem.comments {actionItemId, commentCount, refresh}` (both lists; `refresh` bumps `commentsRevision`), `carriedActionItem.upsert`, `carriedActionItem.remove`.
  - `useRetroChannel(retroId, participantId, enabled, membersOnly, handlers)` also subscribes to `private-retro-members.{retroId}` when `membersOnly`; `RetroEventName` includes `action-item.comments.changed` and the three `carried-action-item.*` events.

- [ ] **Step 1: Types**

In `resources/js/lib/retro/types.ts` replace the `ActionItem` type with:

```ts
export type ActionItemPriority = 'high' | 'medium' | 'low';

export type ActionItemStatus = 'open' | 'completed';

export type ActionItemPerson = { name: string; avatarUrl: string };

export type ActionItemAssignee = ActionItemPerson & {
    kind: 'member' | 'guest';
    id: string;
    isTeamMember: boolean;
};

export type ActionItemSource = {
    retroTitle: string;
    retroCreatedAt: string | null;
    retroUrl: string;
};

export type ActionItem = {
    id: string;
    retroId: string | null;
    teamId: string;
    content: string;
    priority: ActionItemPriority;
    dueOn: string | null;
    isOverdue: boolean;
    status: ActionItemStatus;
    completedAt: string | null;
    assignee: ActionItemAssignee | null;
    createdBy: ActionItemPerson | null;
    isMine: boolean;
    commentCount: number;
    source: ActionItemSource | null;
    themeId: string | null;
    themeName: string | null;
    createdAt: string | null;
    /** Client-only: bumped by comment events so an open thread refetches. */
    commentsRevision?: number;
};

export type ActionItemComment = {
    id: string;
    actionItemId: string;
    content: string;
    author: ActionItemPerson | null;
    isMine: boolean;
    createdAt: string | null;
    updatedAt: string | null;
};

export type TeamMember = {
    id: string;
    name: string;
    avatarUrl: string;
    participantId: string | null;
};
```

In the `Snapshot` type: add `teamId: string;` to `retro`; add to `viewer`:

```ts
        userId: string | null;
        canManageActionItems: boolean;
        isWorkspaceManager: boolean;
        isReviewFacilitator: boolean;
        facilitatedRetroIds: string[];
```

add after `actionItems: ActionItem[];`:

```ts
    carriedActionItems: ActionItem[];
    carriedActionItemsHasMore: boolean;
    teamMembers: TeamMember[];
```

and replace `links: { team: string | null };` with:

```ts
    links: {
        team: string | null;
        actionItems: string | null;
        workspace: string | null;
    };
```

- [ ] **Step 2: Permissions, endpoints, assignees, formatting**

`resources/js/lib/action-items/permissions.ts`:

```ts
import type { ActionItem, ActionItemComment, Snapshot } from '@/lib/retro/types';

/**
 * What the client knows about the viewer to show or hide controls; the
 * server stays the authority (spec §4).
 */
export type ActionItemViewer = {
    userId: string | null;
    participantId: string | null;
    isWorkspaceManager: boolean;
    facilitatedRetroIds: string[];
    reviewTeamIds: string[];
};

export function canManageActionItem(
    item: ActionItem,
    viewer: ActionItemViewer,
): boolean {
    if (item.isMine || viewer.isWorkspaceManager) {
        return true;
    }

    return (
        item.retroId !== null && viewer.facilitatedRetroIds.includes(item.retroId)
    );
}

export function isActionItemAssignee(
    item: ActionItem,
    viewer: ActionItemViewer,
): boolean {
    if (item.assignee === null) {
        return false;
    }

    if (item.assignee.kind === 'member') {
        return item.assignee.id === viewer.userId;
    }

    return item.assignee.id === viewer.participantId;
}

export function canCompleteActionItem(
    item: ActionItem,
    viewer: ActionItemViewer,
): boolean {
    return (
        canManageActionItem(item, viewer) ||
        isActionItemAssignee(item, viewer) ||
        viewer.reviewTeamIds.includes(item.teamId)
    );
}

export function canDeleteActionItemComment(
    comment: ActionItemComment,
    item: ActionItem,
    viewer: ActionItemViewer,
): boolean {
    return comment.isMine || canManageActionItem(item, viewer);
}

export function boardActionItemViewer(board: Snapshot): ActionItemViewer {
    return {
        userId: board.viewer.userId,
        participantId: board.viewer.participantId,
        isWorkspaceManager: board.viewer.isWorkspaceManager,
        facilitatedRetroIds: board.viewer.facilitatedRetroIds,
        reviewTeamIds: board.viewer.isReviewFacilitator
            ? [board.retro.teamId]
            : [],
    };
}
```

`resources/js/lib/action-items/endpoints.ts`:

```ts
import ActionItemCommentsController from '@/actions/App/Http/Controllers/Retros/ActionItemCommentsController';
import ActionItemsController from '@/actions/App/Http/Controllers/Retros/ActionItemsController';
import WorkspaceActionItemCommentsController from '@/actions/App/Http/Controllers/WorkspaceActionItemCommentsController';
import WorkspaceActionItemsController from '@/actions/App/Http/Controllers/WorkspaceActionItemsController';

export type EndpointRoute = { url: string; method: string };

/**
 * The same card talks to the board endpoints (own retro, phase rules) or
 * to the workspace endpoints (carry-over panel, global page).
 */
export type ActionItemEndpoints = {
    update: (actionItemId: string) => EndpointRoute;
    destroy: (actionItemId: string) => EndpointRoute;
    comments: (actionItemId: string) => EndpointRoute;
    addComment: (actionItemId: string) => EndpointRoute;
    updateComment: (commentId: string) => EndpointRoute;
    destroyComment: (commentId: string) => EndpointRoute;
};

export function boardActionItemEndpoints(retroId: string): ActionItemEndpoints {
    return {
        update: (actionItem) =>
            ActionItemsController.update({ retro: retroId, actionItem }),
        destroy: (actionItem) =>
            ActionItemsController.destroy({ retro: retroId, actionItem }),
        comments: (actionItem) =>
            ActionItemCommentsController.index({ retro: retroId, actionItem }),
        addComment: (actionItem) =>
            ActionItemCommentsController.store({ retro: retroId, actionItem }),
        updateComment: (actionItemComment) =>
            ActionItemCommentsController.update({
                retro: retroId,
                actionItemComment,
            }),
        destroyComment: (actionItemComment) =>
            ActionItemCommentsController.destroy({
                retro: retroId,
                actionItemComment,
            }),
    };
}

export function workspaceActionItemEndpoints(
    workspace: string,
): ActionItemEndpoints {
    return {
        update: (actionItem) =>
            WorkspaceActionItemsController.update({ workspace, actionItem }),
        destroy: (actionItem) =>
            WorkspaceActionItemsController.destroy({ workspace, actionItem }),
        comments: (actionItem) =>
            WorkspaceActionItemCommentsController.index({
                workspace,
                actionItem,
            }),
        addComment: (actionItem) =>
            WorkspaceActionItemCommentsController.store({
                workspace,
                actionItem,
            }),
        updateComment: (actionItemComment) =>
            WorkspaceActionItemCommentsController.update({
                workspace,
                actionItemComment,
            }),
        destroyComment: (actionItemComment) =>
            WorkspaceActionItemCommentsController.destroy({
                workspace,
                actionItemComment,
            }),
    };
}
```

`resources/js/lib/action-items/assignees.ts`:

```ts
import type { ActionItemAssignee } from '@/lib/retro/types';

export const Unassigned = 'none';

export function assigneeValue(assignee: ActionItemAssignee | null): string {
    if (assignee === null) {
        return Unassigned;
    }

    return `${assignee.kind}:${assignee.id}`;
}

/**
 * Members travel as users and guests as participants; the workspace
 * endpoints refuse a non-empty participant id.
 */
export function assigneePayload(value: string): {
    assignee_user_id: string | null;
    assignee_participant_id: string | null;
} {
    if (value === Unassigned) {
        return { assignee_user_id: null, assignee_participant_id: null };
    }

    const [kind, id] = value.split(':');

    if (kind === 'guest') {
        return { assignee_user_id: null, assignee_participant_id: id };
    }

    return { assignee_user_id: id, assignee_participant_id: null };
}
```

`resources/js/lib/action-items/format.ts`:

```ts
/**
 * Due dates have no time part; formatting them in UTC keeps the day the
 * user picked whatever the browser's time zone.
 */
export function formatDueDate(dueOn: string, locale: string): string {
    const [year, month, day] = dueOn.split('-').map(Number);

    return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatShortDate(iso: string, locale: string): string {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
        new Date(iso),
    );
}
```

- [ ] **Step 3: Reducer**

In `resources/js/lib/retro/board-reducer.ts` add to the `BoardAction` union (next to the existing action item actions):

```ts
    | {
          type: 'actionItem.comments';
          actionItemId: string;
          commentCount: number;
          refresh: boolean;
      }
    | { type: 'carriedActionItem.upsert'; actionItem: ActionItem }
    | { type: 'carriedActionItem.remove'; actionItemId: string }
```

Add these helpers above `boardReducer`:

```ts
/**
 * Broadcast payloads are presented without a viewer, so they never mark
 * an item as mine; the known copy keeps it and its comment revision.
 */
export function upsertActionItem(
    items: ActionItem[],
    incoming: ActionItem,
): ActionItem[] {
    const existing = items.find((item) => item.id === incoming.id);

    if (!existing) {
        return [...items, incoming];
    }

    return items.map((item) =>
        item.id === incoming.id
            ? {
                  ...incoming,
                  isMine: incoming.isMine || existing.isMine,
                  commentsRevision: existing.commentsRevision,
              }
            : item,
    );
}

export function countActionItemComments(
    items: ActionItem[],
    actionItemId: string,
    commentCount: number,
    refresh: boolean,
): ActionItem[] {
    return items.map((item) =>
        item.id === actionItemId
            ? {
                  ...item,
                  commentCount,
                  commentsRevision: refresh
                      ? (item.commentsRevision ?? 0) + 1
                      : item.commentsRevision,
              }
            : item,
    );
}
```

Replace the existing `case 'actionItem.upsert': { … }` block with:

```ts
        case 'actionItem.upsert':
            return {
                ...state,
                actionItems: upsertActionItem(
                    state.actionItems,
                    action.actionItem,
                ),
            };
        case 'actionItem.comments':
            return {
                ...state,
                actionItems: countActionItemComments(
                    state.actionItems,
                    action.actionItemId,
                    action.commentCount,
                    action.refresh,
                ),
                carriedActionItems: countActionItemComments(
                    state.carriedActionItems,
                    action.actionItemId,
                    action.commentCount,
                    action.refresh,
                ),
            };
        case 'carriedActionItem.upsert':
            return {
                ...state,
                carriedActionItems: upsertActionItem(
                    state.carriedActionItems,
                    action.actionItem,
                ),
            };
        case 'carriedActionItem.remove':
            return {
                ...state,
                carriedActionItems: state.carriedActionItems.filter(
                    (item) => item.id !== action.actionItemId,
                ),
            };
```

- [ ] **Step 4: Channels**

Replace `resources/js/hooks/use-retro-channel.ts` with:

```ts
import {
    echo,
    echoIsConfigured,
    type ConnectionStatus,
} from '@laravel/echo-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type {
    CardComment,
    CardPayload,
    CommentNotificationPayload,
    PresenceMember,
    SurveyComment,
} from '@/lib/retro/types';
import type { WhisperChannel } from '@/lib/retro/whisper-transport';

export const RetroEvents = [
    'card.created',
    'card.updated',
    'card.deleted',
    'cards.moved',
    'card.grouped',
    'card.ungrouped',
    'vote.cast',
    'vote.retracted',
    'phase.changed',
    'timer.changed',
    'card.highlighted',
    'settings.changed',
    'columns.changed',
    'action-item.saved',
    'action-item.deleted',
    'action-item.comments.changed',
    'retro.deleted',
    'card.reactions.changed',
    'comment.created',
    'comment.updated',
    'comment.deleted',
    'health.answered',
    'survey.changed',
    'survey.deleted',
    'survey.discussion.changed',
    'card.group-named',
    'roti.changed',
    'results.changed',
    'insights.changed',
] as const;

/**
 * Carried action items of earlier retros travel on a private channel only
 * members can join (spec §5).
 */
export const MemberEvents = [
    'carried-action-item.saved',
    'carried-action-item.removed',
    'carried-action-item.comments.changed',
] as const;

/**
 * The presence and private subscriptions complete moments apart (on load
 * and on every reconnect); waiting briefly lets one snapshot cover both.
 */
const ResyncCoalesceMs = 250;

export type RetroEventName =
    | (typeof RetroEvents)[number]
    | (typeof MemberEvents)[number];

export type RetroEvent = {
    name: RetroEventName;
    payload: Record<string, unknown>;
};

export type RetroChannelHandlers = {
    onEvent: (event: RetroEvent) => void;
    onResync: () => void;
    onJoining: (member: PresenceMember) => void;
    onOwnCard: (card: CardPayload) => void;
    onOwnComment: (comment: CardComment) => void;
    onOwnSurveyComment: (comment: SurveyComment) => void;
    onCommentNotification: (notification: CommentNotificationPayload) => void;
};

function subscribeToConnection(onChange: () => void): () => void {
    if (!echoIsConfigured()) {
        return () => {};
    }

    return echo().connector.onConnectionChange(onChange);
}

function connectionStatus(): ConnectionStatus {
    if (!echoIsConfigured()) {
        return 'connecting';
    }

    return echo().connector.connectionStatus();
}

function serverConnectionStatus(): ConnectionStatus {
    return 'connecting';
}

/**
 * SSR-safe replacement for echo-react's useConnectionStatus, which calls
 * echo() during render and would throw on the server.
 */
export function useSafeConnectionStatus(): ConnectionStatus {
    return useSyncExternalStore(
        subscribeToConnection,
        connectionStatus,
        serverConnectionStatus,
    );
}

export function useRetroChannel(
    retroId: string,
    participantId: string,
    enabled: boolean,
    membersOnly: boolean,
    channelHandlers: RetroChannelHandlers,
) {
    const [online, setOnline] = useState<PresenceMember[]>([]);
    const [presence, setPresence] = useState<WhisperChannel | null>(null);
    const status = useSafeConnectionStatus();
    const handlers = useRef(channelHandlers);
    const [wasConnected, setWasConnected] = useState(false);

    handlers.current = channelHandlers;

    if (status === 'connected' && !wasConnected) {
        setWasConnected(true);
    }

    useEffect(() => {
        if (!enabled || !echoIsConfigured()) {
            return;
        }

        let pendingResync: ReturnType<typeof setTimeout> | null = null;

        const scheduleResync = () => {
            if (pendingResync !== null) {
                return;
            }

            pendingResync = setTimeout(() => {
                pendingResync = null;
                handlers.current.onResync();
            }, ResyncCoalesceMs);
        };

        const name = `retro.${retroId}`;
        const channel = echo<'reverb'>()
            .join(name)
            .here((members: PresenceMember[]) => {
                setOnline(members);
                scheduleResync();
            })
            .joining((member: PresenceMember) => {
                setOnline((current) => [
                    ...current.filter((m) => m.id !== member.id),
                    member,
                ]);
                handlers.current.onJoining(member);
            })
            .leaving((member: PresenceMember) =>
                setOnline((current) =>
                    current.filter((m) => m.id !== member.id),
                ),
            )
            .error(scheduleResync);

        setPresence(channel as unknown as WhisperChannel);

        for (const event of RetroEvents) {
            channel.listen(`.${event}`, (payload: Record<string, unknown>) =>
                handlers.current.onEvent({ name: event, payload }),
            );
        }

        const ownChannel = `participant.${participantId}`;

        echo<'reverb'>()
            .private(ownChannel)
            .subscribed(scheduleResync)
            .listen('.own-card.saved', (payload: { card: CardPayload }) =>
                handlers.current.onOwnCard(payload.card),
            )
            .listen('.own-comment.saved', (payload: { comment: CardComment }) =>
                handlers.current.onOwnComment(payload.comment),
            )
            .listen(
                '.own-survey-comment.saved',
                (payload: { comment: SurveyComment }) =>
                    handlers.current.onOwnSurveyComment(payload.comment),
            )
            .listen(
                '.comment.notification',
                (payload: CommentNotificationPayload) =>
                    handlers.current.onCommentNotification(payload),
            )
            .error(scheduleResync);

        const membersChannel = `retro-members.${retroId}`;

        if (membersOnly) {
            const members = echo<'reverb'>()
                .private(membersChannel)
                .subscribed(scheduleResync)
                .error(scheduleResync);

            for (const event of MemberEvents) {
                members.listen(
                    `.${event}`,
                    (payload: Record<string, unknown>) =>
                        handlers.current.onEvent({ name: event, payload }),
                );
            }
        }

        return () => {
            if (pendingResync !== null) {
                clearTimeout(pendingResync);
            }

            echo().leave(name);
            echo().leave(ownChannel);

            if (membersOnly) {
                echo().leave(membersChannel);
            }

            setOnline([]);
            setPresence(null);
        };
    }, [retroId, participantId, enabled, membersOnly]);

    const connected = status === 'connected';
    const reconnecting = status === 'failed' || (wasConnected && !connected);

    return { online, connected, reconnecting, presence };
}
```

In `resources/js/hooks/use-retro-board.ts`:
- in `onEvent`, after the `case 'action-item.deleted':` block, add:

```ts
                case 'action-item.comments.changed':
                case 'carried-action-item.comments.changed':
                    apply({
                        type: 'actionItem.comments',
                        actionItemId: payload.actionItemId as string,
                        commentCount: payload.commentCount as number,
                        refresh: true,
                    });
                    break;
                case 'carried-action-item.saved':
                    apply({
                        type: 'carriedActionItem.upsert',
                        actionItem: payload.actionItem as ActionItem,
                    });
                    break;
                case 'carried-action-item.removed':
                    apply({
                        type: 'carriedActionItem.remove',
                        actionItemId: payload.actionItemId as string,
                    });
                    break;
```

- in the `useRetroChannel(…)` call, insert `!initial.viewer.isGuest,` after `status === 'active',`.

- [ ] **Step 5: Keep the current action item components compiling**

(Task 13 rewrites both files.) In `resources/js/components/retro/action-items-panel.tsx`:
- in the `patch` data type replace `is_done: boolean;` with `status: 'open' | 'completed';`;
- replace `checked={item.isDone}` with `checked={item.status === 'completed'}`;
- replace `void patch({ is_done: checked === true })` with `void patch({ status: checked === true ? 'completed' : 'open' })`;
- replace `${item.isDone ? 'text-muted-foreground line-through' : ''}` with `${item.status === 'completed' ? 'text-muted-foreground line-through' : ''}`.

In `resources/js/components/retro/results/action-items-results.tsx` replace both `item.isDone` with `item.status === 'completed'`.

- [ ] **Step 6: Checks**

Run: `npx vp check --fix resources/js/lib/action-items resources/js/lib/retro/types.ts resources/js/lib/retro/board-reducer.ts resources/js/hooks/use-retro-channel.ts resources/js/hooks/use-retro-board.ts resources/js/components/retro/action-items-panel.tsx resources/js/components/retro/results/action-items-results.tsx && npm run types:check && npm run check`
Expected: PASS (known pre-existing lint failures only).

- [ ] **Step 7: Commit**

```bash
git add resources/js/lib/action-items resources/js/lib/retro/types.ts resources/js/lib/retro/board-reducer.ts resources/js/hooks/use-retro-channel.ts resources/js/hooks/use-retro-board.ts resources/js/components/retro/action-items-panel.tsx resources/js/components/retro/results/action-items-results.tsx
git commit -m "feat: teach the board the new action item shape, carried items and comment events

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 12: Shared action item components

**Files:**
- Create: `resources/js/components/action-items/priority-select.tsx`, `resources/js/components/action-items/due-date-chip.tsx`, `resources/js/components/action-items/assignee-select.tsx`, `resources/js/components/action-items/anonymous-notice.tsx`, `resources/js/components/action-items/action-item-comments.tsx`, `resources/js/components/action-items/action-item-card.tsx`, `resources/js/components/action-items/action-item-form.tsx`
- Modify: `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: Task 11 types and helpers (`ActionItem`, `ActionItemComment`, `ActionItemViewer`, `canManageActionItem`, `canCompleteActionItem`, `canDeleteActionItemComment`, `ActionItemEndpoints`, `Unassigned`, `assigneeValue`, `assigneePayload`, `formatDueDate`, `formatShortDate`); `retroRequest()`.
- Produces:
  - `PriorityIcon({priority})`, `PrioritySelect({value, disabled?, onChange})`, `Priorities`.
  - `DueDateChip({item: Pick<ActionItem, 'dueOn' | 'isOverdue'>})` ("Due 3 Oct" or a red "Overdue · 3 Oct").
  - `type AssigneeGroup = {label: string; options: {value: string; label: string}[]}`, `AssigneeSelect({value, groups, current?, disabled?, onChange})` (shows a disabled entry for a current assignee that is not in the groups: a guest or a member who left), `assigneeLabel(assignee, t)`, `boardAssigneeGroups(board: Snapshot, t): AssigneeGroup[]` ("In this retro": guests of the retro and team members who joined it; "Team": the other members), `teamAssigneeGroups(members: {id, name}[], t): AssigneeGroup[]`.
  - `AnonymousNotice()`.
  - `ActionItemComments({item, endpoints, viewer, canWrite, showAnonymousNotice?, run, onCountChange})` (fetches on open and whenever `item.commentsRevision` changes).
  - `ActionItemCard({item, endpoints, viewer, assigneeGroups, run, onSaved, onRemoved, onCommentCount, editable, showAnonymousNotice?, meta?, defaultExpanded?, children?})`.
  - `type ActionItemDraft = {content, priority, dueOn, assignee, extra: Record<string, unknown>}`, `emptyActionItemDraft(): ActionItemDraft`, `actionItemPayload(draft): Record<string, unknown>` (`extra` is spread into the payload), `ActionItemForm({assigneeGroups, disabled?, showAnonymousNotice?, submitLabel, extraFields?: (draft, update) => ReactNode, onSubmit: (payload) => Promise<boolean>})`.
  - `type RunMutation = <T>(mutation: Promise<T>) => Promise<T | undefined>` exported from `action-item-card.tsx`.

- [ ] **Step 1: Priority, due date, notice**

`resources/js/components/action-items/priority-select.tsx`:

```tsx
import { ArrowDown, ArrowUp, Circle } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import type { ActionItemPriority } from '@/lib/retro/types';

export const Priorities: ActionItemPriority[] = ['high', 'medium', 'low'];

/** Translation keys, passed to t() through a variable. */
const PriorityLabels: Record<ActionItemPriority, string> = {
    high: 'High',
    medium: 'Medium',
    low: 'Low',
};

export function PriorityIcon({ priority }: { priority: ActionItemPriority }) {
    if (priority === 'high') {
        return <ArrowUp className="size-4 text-red-600" aria-hidden="true" />;
    }

    if (priority === 'low') {
        return (
            <ArrowDown className="size-4 text-slate-500" aria-hidden="true" />
        );
    }

    return <Circle className="size-3.5 text-amber-500" aria-hidden="true" />;
}

type Props = {
    value: ActionItemPriority;
    disabled?: boolean;
    onChange: (priority: ActionItemPriority) => void;
};

export function PrioritySelect({ value, disabled, onChange }: Props) {
    const { t } = useTrans();

    return (
        <Select
            value={value}
            disabled={disabled}
            onValueChange={(next) => onChange(next as ActionItemPriority)}
        >
            <SelectTrigger
                size="sm"
                className="w-full"
                aria-label={t('Priority')}
            >
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {Priorities.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                        <PriorityIcon priority={priority} />
                        {t(PriorityLabels[priority])}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
```

`resources/js/components/action-items/due-date-chip.tsx`:

```tsx
import { usePage } from '@inertiajs/react';
import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import { formatDueDate } from '@/lib/action-items/format';
import type { ActionItem } from '@/lib/retro/types';

export function DueDateChip({
    item,
}: {
    item: Pick<ActionItem, 'dueOn' | 'isOverdue'>;
}) {
    const { t } = useTrans();
    const { locale } = usePage().props;

    if (item.dueOn === null) {
        return null;
    }

    const date = formatDueDate(item.dueOn, locale);

    if (item.isOverdue) {
        return (
            <Badge variant="destructive">
                {t('Overdue')} · {date}
            </Badge>
        );
    }

    return (
        <Badge variant="outline" className="font-normal">
            {t('Due :date', { date })}
        </Badge>
    );
}
```

`resources/js/components/action-items/anonymous-notice.tsx`:

```tsx
import { Info } from 'lucide-react';
import { useTrans } from '@/hooks/use-trans';

export function AnonymousNotice() {
    const { t } = useTrans();

    return (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Info className="size-3 shrink-0" aria-hidden="true" />
            {t('Action items are not anonymous: your name is shown.')}
        </p>
    );
}
```

- [ ] **Step 2: Assignee select**

`resources/js/components/action-items/assignee-select.tsx`:

```tsx
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import { Unassigned } from '@/lib/action-items/assignees';
import type { ActionItemAssignee, Snapshot } from '@/lib/retro/types';

type Translate = ReturnType<typeof useTrans>['t'];

export type AssigneeOption = { value: string; label: string };

export type AssigneeGroup = { label: string; options: AssigneeOption[] };

export function assigneeLabel(assignee: ActionItemAssignee, t: Translate): string {
    if (assignee.kind === 'guest') {
        return t(':name (guest)', { name: assignee.name });
    }

    if (!assignee.isTeamMember) {
        return t(':name (not in team)', { name: assignee.name });
    }

    return assignee.name;
}

/**
 * Guests of this retro and the members who joined it first, then the rest
 * of the team. Workspace admins outside the team cannot be assigned.
 */
export function boardAssigneeGroups(
    board: Snapshot,
    t: Translate,
): AssigneeGroup[] {
    const guests = board.participants
        .filter((participant) => participant.isGuest)
        .map((participant) => ({
            value: `guest:${participant.id}`,
            label: t(':name (guest)', { name: participant.name }),
        }));
    const joined = board.teamMembers
        .filter((member) => member.participantId !== null)
        .map((member) => ({ value: `member:${member.id}`, label: member.name }));
    const others = board.teamMembers
        .filter((member) => member.participantId === null)
        .map((member) => ({ value: `member:${member.id}`, label: member.name }));

    return [
        { label: t('In this retro'), options: [...joined, ...guests] },
        { label: t('Team'), options: others },
    ];
}

export function teamAssigneeGroups(
    members: Array<{ id: string; name: string }>,
    t: Translate,
): AssigneeGroup[] {
    return [
        {
            label: t('Team'),
            options: members.map((member) => ({
                value: `member:${member.id}`,
                label: member.name,
            })),
        },
    ];
}

type Props = {
    value: string;
    groups: AssigneeGroup[];
    current?: ActionItemAssignee | null;
    disabled?: boolean;
    onChange: (value: string) => void;
};

export function AssigneeSelect({
    value,
    groups,
    current,
    disabled,
    onChange,
}: Props) {
    const { t } = useTrans();
    const isListed = groups.some((group) =>
        group.options.some((option) => option.value === value),
    );

    return (
        <Select value={value} disabled={disabled} onValueChange={onChange}>
            <SelectTrigger
                size="sm"
                className="w-full"
                aria-label={t('Assignee')}
            >
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={Unassigned}>{t('Unassigned')}</SelectItem>
                {!isListed && current && (
                    <SelectItem value={value} disabled>
                        {assigneeLabel(current, t)}
                    </SelectItem>
                )}
                {groups
                    .filter((group) => group.options.length > 0)
                    .map((group) => (
                        <SelectGroup key={group.label}>
                            <SelectLabel>{group.label}</SelectLabel>
                            {group.options.map((option) => (
                                <SelectItem
                                    key={option.value}
                                    value={option.value}
                                >
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    ))}
            </SelectContent>
        </Select>
    );
}
```

- [ ] **Step 3: Comment thread**

`resources/js/components/action-items/action-item-comments.tsx`:

```tsx
import { usePage } from '@inertiajs/react';
import { Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTrans } from '@/hooks/use-trans';
import type { ActionItemEndpoints } from '@/lib/action-items/endpoints';
import { formatShortDate } from '@/lib/action-items/format';
import {
    canDeleteActionItemComment,
    type ActionItemViewer,
} from '@/lib/action-items/permissions';
import { retroRequest } from '@/lib/retro/api';
import type { ActionItem, ActionItemComment } from '@/lib/retro/types';
import { AnonymousNotice } from './anonymous-notice';
import type { RunMutation } from './action-item-card';

type Props = {
    item: ActionItem;
    endpoints: ActionItemEndpoints;
    viewer: ActionItemViewer;
    canWrite: boolean;
    showAnonymousNotice?: boolean;
    run: RunMutation;
    onCountChange: (count: number) => void;
};

export function ActionItemComments({
    item,
    endpoints,
    viewer,
    canWrite,
    showAnonymousNotice,
    run,
    onCountChange,
}: Props) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const [comments, setComments] = useState<ActionItemComment[] | null>(null);
    const [draft, setDraft] = useState('');
    const [editing, setEditing] = useState<{
        id: string;
        content: string;
    } | null>(null);
    const [busy, setBusy] = useState(false);
    const latest = useRef({ endpoints, run });
    const revision = item.commentsRevision ?? 0;

    latest.current = { endpoints, run };

    useEffect(() => {
        let cancelled = false;

        void latest.current
            .run(
                retroRequest<{ comments: ActionItemComment[] }>(
                    latest.current.endpoints.comments(item.id),
                ),
            )
            .then((response) => {
                if (!cancelled && response) {
                    setComments(response.comments);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [item.id, revision]);

    const add = async () => {
        const content = draft.trim();

        if (content === '' || busy) {
            return;
        }

        setBusy(true);
        const response = await run(
            retroRequest<{ comment: ActionItemComment }>(
                endpoints.addComment(item.id),
                { content },
            ),
        );
        setBusy(false);

        if (!response) {
            return;
        }

        const next = [...(comments ?? []), response.comment];

        setComments(next);
        setDraft('');
        onCountChange(next.length);
    };

    const save = async () => {
        const content = editing?.content.trim() ?? '';

        if (editing === null || content === '' || busy) {
            return;
        }

        setBusy(true);
        const response = await run(
            retroRequest<{ comment: ActionItemComment }>(
                endpoints.updateComment(editing.id),
                { content },
            ),
        );
        setBusy(false);

        if (!response) {
            return;
        }

        setComments((current) =>
            (current ?? []).map((comment) =>
                comment.id === response.comment.id ? response.comment : comment,
            ),
        );
        setEditing(null);
    };

    const remove = async (comment: ActionItemComment) => {
        if (busy) {
            return;
        }

        setBusy(true);
        const result = await run(
            retroRequest(endpoints.destroyComment(comment.id)),
        );
        setBusy(false);

        if (result === undefined) {
            return;
        }

        const next = (comments ?? []).filter(
            (existing) => existing.id !== comment.id,
        );

        setComments(next);
        onCountChange(next.length);
    };

    return (
        <div className="space-y-2 border-l pl-3">
            {comments === null && (
                <p className="text-xs text-muted-foreground">{t('Loading…')}</p>
            )}
            {comments?.length === 0 && (
                <p className="text-xs text-muted-foreground">
                    {t('No comments yet.')}
                </p>
            )}
            <ul className="space-y-2">
                {comments?.map((comment) => (
                    <li key={comment.id} className="text-sm">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">
                                {comment.author?.name ?? t('Former member')}
                            </span>
                            {comment.createdAt && (
                                <time dateTime={comment.createdAt}>
                                    {formatShortDate(comment.createdAt, locale)}
                                </time>
                            )}
                            {canWrite && comment.isMine && (
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-6"
                                    aria-label={t('Edit comment')}
                                    onClick={() =>
                                        setEditing({
                                            id: comment.id,
                                            content: comment.content,
                                        })
                                    }
                                >
                                    <Pencil className="size-3" />
                                </Button>
                            )}
                            {canWrite &&
                                canDeleteActionItemComment(
                                    comment,
                                    item,
                                    viewer,
                                ) && (
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="size-6"
                                        disabled={busy}
                                        aria-label={t('Delete comment')}
                                        onClick={() => void remove(comment)}
                                    >
                                        <Trash2 className="size-3" />
                                    </Button>
                                )}
                        </div>
                        {editing?.id === comment.id ? (
                            <form
                                className="mt-1 space-y-1"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    void save();
                                }}
                            >
                                <Textarea
                                    value={editing.content}
                                    maxLength={500}
                                    rows={2}
                                    aria-label={t('Edit comment')}
                                    onChange={(event) =>
                                        setEditing({
                                            id: comment.id,
                                            content: event.target.value,
                                        })
                                    }
                                />
                                <div className="flex gap-2">
                                    <Button type="submit" size="sm" disabled={busy}>
                                        {t('Save')}
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setEditing(null)}
                                    >
                                        {t('Cancel')}
                                    </Button>
                                </div>
                            </form>
                        ) : (
                            <p className="break-words whitespace-pre-wrap">
                                {comment.content}
                            </p>
                        )}
                    </li>
                ))}
            </ul>
            {canWrite && (
                <form
                    className="space-y-1"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void add();
                    }}
                >
                    {showAnonymousNotice && <AnonymousNotice />}
                    <Textarea
                        value={draft}
                        maxLength={500}
                        rows={2}
                        placeholder={t('Write a comment…')}
                        aria-label={t('Write a comment…')}
                        onChange={(event) => setDraft(event.target.value)}
                    />
                    <Button
                        type="submit"
                        size="sm"
                        disabled={busy || draft.trim() === ''}
                    >
                        {t('Comment')}
                    </Button>
                </form>
            )}
        </div>
    );
}
```

- [ ] **Step 4: The card**

`resources/js/components/action-items/action-item-card.tsx`:

```tsx
import { MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import { assigneePayload, assigneeValue } from '@/lib/action-items/assignees';
import type { ActionItemEndpoints } from '@/lib/action-items/endpoints';
import {
    canCompleteActionItem,
    canManageActionItem,
    type ActionItemViewer,
} from '@/lib/action-items/permissions';
import { retroRequest } from '@/lib/retro/api';
import type { ActionItem } from '@/lib/retro/types';
import { ActionItemComments } from './action-item-comments';
import { AssigneeSelect, type AssigneeGroup } from './assignee-select';
import { DueDateChip } from './due-date-chip';
import { PriorityIcon, PrioritySelect } from './priority-select';

export type RunMutation = <T>(mutation: Promise<T>) => Promise<T | undefined>;

type Props = {
    item: ActionItem;
    endpoints: ActionItemEndpoints;
    viewer: ActionItemViewer;
    assigneeGroups: AssigneeGroup[];
    run: RunMutation;
    onSaved: (item: ActionItem) => void;
    onRemoved: (actionItemId: string) => void;
    onCommentCount: (actionItemId: string, count: number) => void;
    editable: boolean;
    showAnonymousNotice?: boolean;
    meta?: ReactNode;
    defaultExpanded?: boolean;
    children?: ReactNode;
};

export function ActionItemCard({
    item,
    endpoints,
    viewer,
    assigneeGroups,
    run,
    onSaved,
    onRemoved,
    onCommentCount,
    editable,
    showAnonymousNotice,
    meta,
    defaultExpanded = false,
    children,
}: Props) {
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(item.content);
    const [dueDraft, setDueDraft] = useState(item.dueOn ?? '');
    const [knownDueOn, setKnownDueOn] = useState(item.dueOn);
    const [commentsOpen, setCommentsOpen] = useState(defaultExpanded);
    const manages = editable && canManageActionItem(item, viewer);
    const completes = editable && canCompleteActionItem(item, viewer);
    const completed = item.status === 'completed';

    if (knownDueOn !== item.dueOn) {
        setKnownDueOn(item.dueOn);
        setDueDraft(item.dueOn ?? '');
    }

    const patch = async (data: Record<string, unknown>) => {
        if (busy) {
            return;
        }

        setBusy(true);
        const response = await run(
            retroRequest<{ actionItem: ActionItem }>(
                endpoints.update(item.id),
                data,
            ),
        );
        setBusy(false);

        if (response) {
            onSaved(response.actionItem);
        }
    };

    const remove = async () => {
        if (busy) {
            return;
        }

        setBusy(true);
        const result = await run(retroRequest(endpoints.destroy(item.id)));
        setBusy(false);

        if (result !== undefined) {
            onRemoved(item.id);
        }
    };

    const saveContent = () => {
        const trimmed = draft.trim();

        setEditing(false);

        if (trimmed === '' || trimmed === item.content) {
            return;
        }

        void patch({ content: trimmed });
    };

    const saveDueDate = () => {
        if (dueDraft === (item.dueOn ?? '')) {
            return;
        }

        void patch({ due_on: dueDraft === '' ? null : dueDraft });
    };

    return (
        <li
            id={`action-item-${item.id}`}
            className="space-y-2 rounded-md border bg-card p-2"
        >
            <div className="flex items-start gap-2">
                <Checkbox
                    className="mt-1"
                    checked={completed}
                    disabled={busy || !completes}
                    aria-label={completed ? t('Reopen') : t('Mark as done')}
                    onCheckedChange={(checked) =>
                        void patch({
                            status: checked === true ? 'completed' : 'open',
                        })
                    }
                />
                <div className="min-w-0 flex-1 space-y-1">
                    {editing ? (
                        <form
                            className="flex gap-1"
                            onSubmit={(event) => {
                                event.preventDefault();
                                saveContent();
                            }}
                        >
                            <Input
                                autoFocus
                                value={draft}
                                maxLength={500}
                                className="h-7"
                                aria-label={t('Edit action item')}
                                onChange={(event) =>
                                    setDraft(event.target.value)
                                }
                                onKeyDown={(event) => {
                                    if (event.key === 'Escape') {
                                        event.preventDefault();
                                        setEditing(false);
                                    }
                                }}
                            />
                            <Button type="submit" size="sm" disabled={busy}>
                                {t('Save')}
                            </Button>
                        </form>
                    ) : (
                        <p
                            className={`text-sm break-words ${completed ? 'text-muted-foreground line-through' : ''}`}
                        >
                            {item.content}
                        </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <PriorityIcon priority={item.priority} />
                        <DueDateChip item={item} />
                        <span className="flex items-center gap-1">
                            <Avatar className="size-4">
                                {item.createdBy && (
                                    <AvatarImage
                                        src={item.createdBy.avatarUrl}
                                        alt=""
                                    />
                                )}
                                <AvatarFallback />
                            </Avatar>
                            {item.createdBy?.name ?? t('Former member')}
                        </span>
                        {item.themeName && (
                            <Badge variant="outline" className="font-normal">
                                {t('Theme: :name', { name: item.themeName })}
                            </Badge>
                        )}
                        {meta}
                    </div>
                </div>
                {manages && !editing && (
                    <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 shrink-0"
                        aria-label={t('Edit action item')}
                        onClick={() => {
                            setDraft(item.content);
                            setEditing(true);
                        }}
                    >
                        <Pencil className="size-4" />
                    </Button>
                )}
                {manages && (
                    <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 shrink-0"
                        disabled={busy}
                        aria-label={t('Delete action item')}
                        onClick={() => void remove()}
                    >
                        <Trash2 className="size-4" />
                    </Button>
                )}
            </div>
            {children}
            <div className="grid grid-cols-2 gap-2">
                <PrioritySelect
                    value={item.priority}
                    disabled={busy || !manages}
                    onChange={(priority) => void patch({ priority })}
                />
                <Input
                    type="date"
                    className="h-8"
                    value={dueDraft}
                    min="2000-01-01"
                    max="2100-12-31"
                    disabled={busy || !manages}
                    aria-label={t('Due date')}
                    onChange={(event) => setDueDraft(event.target.value)}
                    onBlur={saveDueDate}
                />
            </div>
            <AssigneeSelect
                value={assigneeValue(item.assignee)}
                current={item.assignee}
                groups={assigneeGroups}
                disabled={busy || !manages}
                onChange={(value) => void patch(assigneePayload(value))}
            />
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 px-2"
                aria-expanded={commentsOpen}
                onClick={() => setCommentsOpen(!commentsOpen)}
            >
                <MessageSquare className="size-4" />
                {item.commentCount === 1
                    ? t('1 comment')
                    : t(':count comments', { count: item.commentCount })}
            </Button>
            {commentsOpen && (
                <ActionItemComments
                    item={item}
                    endpoints={endpoints}
                    viewer={viewer}
                    canWrite={editable}
                    showAnonymousNotice={showAnonymousNotice}
                    run={run}
                    onCountChange={(count) => onCommentCount(item.id, count)}
                />
            )}
        </li>
    );
}
```

- [ ] **Step 5: The create form**

`resources/js/components/action-items/action-item-form.tsx`:

```tsx
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import { assigneePayload, Unassigned } from '@/lib/action-items/assignees';
import type { ActionItemPriority } from '@/lib/retro/types';
import { AnonymousNotice } from './anonymous-notice';
import { AssigneeSelect, type AssigneeGroup } from './assignee-select';
import { PrioritySelect } from './priority-select';

export type ActionItemDraft = {
    content: string;
    priority: ActionItemPriority;
    dueOn: string;
    assignee: string;
    /** Fields contributed through `extraFields`, sent as they are. */
    extra: Record<string, unknown>;
};

export function emptyActionItemDraft(): ActionItemDraft {
    return {
        content: '',
        priority: 'medium',
        dueOn: '',
        assignee: Unassigned,
        extra: {},
    };
}

export function actionItemPayload(
    draft: ActionItemDraft,
): Record<string, unknown> {
    return {
        content: draft.content.trim(),
        priority: draft.priority,
        due_on: draft.dueOn === '' ? null : draft.dueOn,
        ...assigneePayload(draft.assignee),
        ...draft.extra,
    };
}

type Props = {
    assigneeGroups: AssigneeGroup[];
    disabled?: boolean;
    showAnonymousNotice?: boolean;
    submitLabel: string;
    extraFields?: (
        draft: ActionItemDraft,
        update: (changes: Partial<ActionItemDraft>) => void,
    ) => ReactNode;
    onSubmit: (payload: Record<string, unknown>) => Promise<boolean>;
};

export function ActionItemForm({
    assigneeGroups,
    disabled = false,
    showAnonymousNotice,
    submitLabel,
    extraFields,
    onSubmit,
}: Props) {
    const { t } = useTrans();
    const [draft, setDraft] = useState<ActionItemDraft>(emptyActionItemDraft);
    const [sending, setSending] = useState(false);
    const update = (changes: Partial<ActionItemDraft>) =>
        setDraft((current) => ({ ...current, ...changes }));

    const submit = async () => {
        if (sending || draft.content.trim() === '') {
            return;
        }

        setSending(true);
        const created = await onSubmit(actionItemPayload(draft));
        setSending(false);

        if (created) {
            setDraft(emptyActionItemDraft());
        }
    };

    return (
        <form
            className="space-y-2"
            onSubmit={(event) => {
                event.preventDefault();
                void submit();
            }}
        >
            {showAnonymousNotice && <AnonymousNotice />}
            <Input
                value={draft.content}
                maxLength={500}
                disabled={disabled}
                placeholder={t('Add an action item…')}
                aria-label={t('Add an action item…')}
                onChange={(event) => update({ content: event.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
                <PrioritySelect
                    value={draft.priority}
                    disabled={disabled || sending}
                    onChange={(priority) => update({ priority })}
                />
                <Input
                    type="date"
                    className="h-8"
                    value={draft.dueOn}
                    min="2000-01-01"
                    max="2100-12-31"
                    disabled={disabled || sending}
                    aria-label={t('Due date')}
                    onChange={(event) => update({ dueOn: event.target.value })}
                />
            </div>
            <AssigneeSelect
                value={draft.assignee}
                groups={assigneeGroups}
                disabled={disabled || sending}
                onChange={(assignee) => update({ assignee })}
            />
            {extraFields?.(draft, update)}
            <Button
                type="submit"
                size="sm"
                className="w-full"
                disabled={disabled || sending || draft.content.trim() === ''}
            >
                {submitLabel}
            </Button>
        </form>
    );
}
```

- [ ] **Step 6: Translations**

`High`/`Medium`/`Low` (Task 1) and `Team` are passed to `t()` through variables or here directly; add every row that is missing:

| Key | fr | es | de |
|---|---|---|---|
| `Priority` | `Priorité` | `Prioridad` | `Priorität` |
| `Due date` | `Échéance` | `Fecha límite` | `Fälligkeitsdatum` |
| `Overdue` | `En retard` | `Vencida` | `Überfällig` |
| `Due :date` | `Échéance :date` | `Vence el :date` | `Fällig am :date` |
| `:name (guest)` | `:name (invité)` | `:name (invitado)` | `:name (Gast)` |
| `:name (not in team)` | `:name (hors équipe)` | `:name (fuera del equipo)` | `:name (nicht im Team)` |
| `In this retro` | `Dans cette rétro` | `En esta retro` | `In dieser Retro` |
| `Team` | `Équipe` | `Equipo` | `Team` |
| `Action items are not anonymous: your name is shown.` | `Les actions ne sont pas anonymes : votre nom est affiché.` | `Las acciones no son anónimas: se muestra tu nombre.` | `Aktionspunkte sind nicht anonym: Dein Name wird angezeigt.` |
| `No comments yet.` | `Aucun commentaire pour le moment.` | `Aún no hay comentarios.` | `Noch keine Kommentare.` |
| `1 comment` | `1 commentaire` | `1 comentario` | `1 Kommentar` |
| `:count comments` | `:count commentaires` | `:count comentarios` | `:count Kommentare` |

- [ ] **Step 7: Checks**

Run: `npx vp check --fix resources/js/components/action-items && npm run types:check && npm run check && vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: PASS (known pre-existing lint failures only).

- [ ] **Step 8: Commit**

```bash
git add resources/js/components/action-items lang
git commit -m "feat: add a shared action item card, comment thread and create form

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 13: Board panel, Results view and delete warning

**Files:**
- Modify: `resources/js/components/retro/action-items-panel.tsx`, `resources/js/components/retro/results/action-items-results.tsx`, `resources/js/components/retro/delete-retro-dialog.tsx`, `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: Task 12 components; Task 11 `boardActionItemEndpoints`, `boardActionItemViewer`; `useBoard()` (`board`, `run`, `apply`, `isEditable`); Wayfinder `ActionItemsController.store`.
- Produces: `ActionItemsPanel()` (create form with priority, due date, grouped assignee select and the anonymous notice; one `ActionItemCard` per item; ROTI control unchanged); `ActionItemsResults()` (read-only priority, status, due date/overdue, assignee, theme; link "View the team's action items" for members); the delete dialog warns "This also deletes N open action items." when N > 0.

- [ ] **Step 1: Rewrite the board panel**

Replace `resources/js/components/retro/action-items-panel.tsx`:

```tsx
import { useMemo } from 'react';
import ActionItemsController from '@/actions/App/Http/Controllers/Retros/ActionItemsController';
import { ActionItemCard } from '@/components/action-items/action-item-card';
import { ActionItemForm } from '@/components/action-items/action-item-form';
import { boardAssigneeGroups } from '@/components/action-items/assignee-select';
import { useTrans } from '@/hooks/use-trans';
import { boardActionItemEndpoints } from '@/lib/action-items/endpoints';
import { boardActionItemViewer } from '@/lib/action-items/permissions';
import { retroRequest } from '@/lib/retro/api';
import type { ActionItem } from '@/lib/retro/types';
import { useBoard } from './board-context';
import { RotiControl } from './roti-control';

export function ActionItemsPanel() {
    const ctx = useBoard();
    const { t } = useTrans();
    const { board } = ctx;
    const endpoints = useMemo(
        () => boardActionItemEndpoints(board.retro.id),
        [board.retro.id],
    );
    const viewer = boardActionItemViewer(board);
    const groups = boardAssigneeGroups(board, t);

    const create = async (
        payload: Record<string, unknown>,
    ): Promise<boolean> => {
        const response = await ctx.run(
            retroRequest<{ actionItem: ActionItem }>(
                ActionItemsController.store(board.retro.id),
                payload,
            ),
        );

        if (!response) {
            return false;
        }

        ctx.apply({ type: 'actionItem.upsert', actionItem: response.actionItem });

        return true;
    };

    return (
        <aside className="w-full shrink-0 space-y-3 p-4 lg:sticky lg:top-4 lg:max-h-dvh lg:w-80 lg:self-start lg:overflow-y-auto">
            <h2 className="text-sm font-semibold">{t('Action items')}</h2>
            <ActionItemForm
                assigneeGroups={groups}
                disabled={!ctx.isEditable}
                showAnonymousNotice={board.retro.isAnonymous}
                submitLabel={t('Add')}
                onSubmit={create}
            />
            {board.actionItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {t('No action items yet.')}
                </p>
            ) : (
                <ul className="space-y-2">
                    {board.actionItems.map((item) => (
                        <ActionItemCard
                            key={item.id}
                            item={item}
                            endpoints={endpoints}
                            viewer={viewer}
                            assigneeGroups={groups}
                            run={ctx.run}
                            editable={ctx.isEditable}
                            showAnonymousNotice={board.retro.isAnonymous}
                            onSaved={(actionItem) =>
                                ctx.apply({ type: 'actionItem.upsert', actionItem })
                            }
                            onRemoved={(actionItemId) =>
                                ctx.apply({ type: 'actionItem.remove', actionItemId })
                            }
                            onCommentCount={(actionItemId, commentCount) =>
                                ctx.apply({
                                    type: 'actionItem.comments',
                                    actionItemId,
                                    commentCount,
                                    refresh: false,
                                })
                            }
                        />
                    ))}
                </ul>
            )}
            <div className="border-t pt-3">
                <RotiControl />
            </div>
        </aside>
    );
}
```

- [ ] **Step 2: Results view**

Replace `resources/js/components/retro/results/action-items-results.tsx`:

```tsx
import { Link } from '@inertiajs/react';
import { Check } from 'lucide-react';
import { assigneeLabel } from '@/components/action-items/assignee-select';
import { DueDateChip } from '@/components/action-items/due-date-chip';
import { PriorityIcon } from '@/components/action-items/priority-select';
import { Badge } from '@/components/ui/badge';
import { useTrans } from '@/hooks/use-trans';
import { useBoard } from '../board-context';
import { ResultsSection } from './results-section';

export function ActionItemsResults() {
    const { board } = useBoard();
    const { t } = useTrans();

    return (
        <ResultsSection title={t('Action items')}>
            {board.actionItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {t('No action items yet.')}
                </p>
            ) : (
                <ul className="space-y-2">
                    {board.actionItems.map((item) => {
                        const completed = item.status === 'completed';

                        return (
                            <li
                                key={item.id}
                                id={`action-item-${item.id}`}
                                className="flex flex-wrap items-start gap-2 rounded-md border p-2 text-sm"
                            >
                                <PriorityIcon priority={item.priority} />
                                {completed && (
                                    <Check
                                        className="mt-0.5 size-4 shrink-0"
                                        aria-label={t('Done')}
                                    />
                                )}
                                <span
                                    className={`min-w-0 flex-1 break-words ${completed ? 'text-muted-foreground line-through' : ''}`}
                                >
                                    {item.content}
                                </span>
                                <DueDateChip item={item} />
                                {item.themeName && (
                                    <Badge
                                        variant="outline"
                                        className="shrink-0 font-normal"
                                    >
                                        {t('Theme: :name', {
                                            name: item.themeName,
                                        })}
                                    </Badge>
                                )}
                                {item.assignee && (
                                    <span className="shrink-0 text-muted-foreground">
                                        {assigneeLabel(item.assignee, t)}
                                    </span>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
            {board.links.actionItems && (
                <Link
                    href={board.links.actionItems}
                    className="text-sm underline-offset-4 hover:underline"
                >
                    {t("View the team's action items")}
                </Link>
            )}
        </ResultsSection>
    );
}
```

- [ ] **Step 3: Delete warning**

In `resources/js/components/retro/delete-retro-dialog.tsx`, add after `const [busy, setBusy] = useState(false);`:

```tsx
    const openItems = ctx.board.actionItems.filter(
        (item) => item.status === 'open',
    ).length;
```

and after the `</DialogDescription>` closing tag:

```tsx
                {openItems > 0 && (
                    <p className="text-sm font-medium text-destructive">
                        {openItems === 1
                            ? t('This also deletes 1 open action item.')
                            : t('This also deletes :count open action items.', {
                                  count: openItems,
                              })}
                    </p>
                )}
```

- [ ] **Step 4: Translations**

| Key | fr | es | de |
|---|---|---|---|
| `View the team's action items` | `Voir les actions de l'équipe` | `Ver las acciones del equipo` | `Aktionspunkte des Teams ansehen` |
| `This also deletes 1 open action item.` | `Cela supprime aussi 1 action ouverte.` | `Esto también elimina 1 acción abierta.` | `Dadurch wird auch 1 offener Aktionspunkt gelöscht.` |
| `This also deletes :count open action items.` | `Cela supprime aussi :count actions ouvertes.` | `Esto también elimina :count acciones abiertas.` | `Dadurch werden auch :count offene Aktionspunkte gelöscht.` |

- [ ] **Step 5: Checks**

Run: `npx vp check --fix resources/js/components/retro/action-items-panel.tsx resources/js/components/retro/results/action-items-results.tsx resources/js/components/retro/delete-retro-dialog.tsx && npm run types:check && npm run check && vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: PASS (known pre-existing lint failures only).

- [ ] **Step 6: Commit**

```bash
git add resources/js/components/retro/action-items-panel.tsx resources/js/components/retro/results/action-items-results.tsx resources/js/components/retro/delete-retro-dialog.tsx lang
git commit -m "feat: manage prioritized, dated and assigned action items on the board

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 14: Verification (controller-driven)

- [ ] **Step 1:** `vendor/bin/sail artisan test --compact tests/Feature/ActionItems tests/Feature/Retros tests/Feature/Teams tests/Feature/TranslationKeysTest.php` — all green (carry-over, global page, items outside a retro and the team channel are covered by the feature tests of Tasks 4, 8, 9 and 10; their UIs are walked through in Plan 9b).
- [ ] **Step 2:** `vendor/bin/sail bin phpstan analyse --no-progress` — 0 errors; `vendor/bin/sail bin pint --dirty --format agent` — clean.
- [ ] **Step 3:** `npm run types:check && npm run check` — only the known pre-existing failures.
- [ ] **Step 4:** Ask the user to run the full suite: `vendor/bin/sail artisan test --compact`.
- [ ] **Step 5: Two-browser walkthrough** (a member and a guest; `npm run dev` or `npm run build`):
  1. Discussing on a named retro: create items with each priority, a past due date (red "Overdue" badge) and a future one ("Due 3 Oct"); assign one to a team member who has not joined (listed under "Team"), one to a joined member ("In this retro") and one to the guest ("(guest)"). The guest ticks their own item; ticking another member's item is disabled for the guest; edit/delete buttons appear only for managers.
  2. Comment on an item from both browsers; the other browser's count updates and an open thread refetches. The facilitator deletes the guest's comment.
  3. Lock the board: edits return the toast "The board is closed for editing.". Complete the retro: the Results view lists priority, due date, overdue badge, assignee, status, theme; the member sees "View the team's action items".
  4. On an anonymous retro: the create form and the comment box show "Action items are not anonymous: your name is shown."; creators and comment authors are named in both browsers.
  5. Delete a retro with open items: the dialog says "This also deletes N open action items.".

## Notes

- Plan 9b adds the carry-over panel, the global page UI with its sidebar entry and team page link, recurrence, sub-tasks, due-date reminders (email digest and in-app bell), notification settings and the sidebar overdue badge on top of the contract above.
- `source.retroUrl` is never `null`: everyone who can read an item can open its retro (participants of it, or viewers of its team who become participants by opening it).
- The `action_item_comments` table has no check constraint: both author columns are null-on-delete, which a `CHECK (… is not null)` would reject; `AddActionItemComment` always sets exactly one.
- `externalLinks` (spec §5 presenter) is added by spec 6's plan; nothing here reserves it.

## Spec coverage

| Spec | Task |
|---|---|
| §1 intent: priority, due date, overdue, status, member/guest assignee, comments, global page, carry-over | 1–15 |
| §2 `action_items` columns, backfill, checks, indexes, author rule, model relations/helpers, factory states (except `recurring`, `withSubtasks` → 9b) | 1, 3 |
| §2 `action_item_comments` | 1, 7 |
| §2 `recurrence`, `previous_occurrence_id` columns and check (behaviour → 9b) | 1 |
| §3 fields and validation (content, priority default, `due_on` format/range, past dates, overdue in `APP_TIMEZONE`, idempotent status) | 1, 5, 6 |
| §3 assignee rules (exclusive fields, team members only, participant normalization, workspace refuses guests, left members flagged, deleted users unassigned, guest items reassignable) | 1, 3, 5, 6, 8 |
| §3 carry-over rule, cap 200 (panel and "View all" → Plan 9b Task 1) | 4, 10 |
| §3 where items can be changed (board phase/lock; workspace any phase, 423 rule; guests excluded; promotion exception with `theme_name`) | 5, 6, 8 |
| §3.1 items outside a retro (create, who, fields, managers, carry-over, lifecycle; display on the panel and page → Plan 9b) | 1, 2, 8, 10 |
| §4 permissions matrix, `ActionItemPermissions`, `ActionItemActor`, 403 messages, `ExternalSyncActor` | 2, 5, 6, 8 |
| §5 board endpoints (items, comments) | 6, 7 |
| §5 workspace endpoints (items, comments; filters ignored when unknown; 50 per page) | 8, 9 |
| §5 `PresentActionItem` shape, `isMine: false` in broadcasts, client-side permissions | 3, 4, 11 |
| §5 comment payload | 7 |
| §5 broadcast events and channels, `BroadcastActionItemChange`, channel authorization, `toOthers()` from workspace endpoints (global page subscription → Plan 9b Task 2) | 4, 8, 11 |
| §5 domain events (`ActionItemCreated`, `Completed`, `Reopened`, `Assigned`; no-op dispatches nothing) | 5 |
| §5 snapshot additions (`actionItems`, `carriedActionItems`, viewer fields, `teamMembers`, `links.actionItems`) with constant queries | 3, 10 |
| §6 global page scope, ordering, filters, `ActionItemQuery` constant queries, `creatableTeams`, `realtimeTeamIds` (`localStorage` → Plan 9b Task 2) | 9 |
| §7 redaction (always named, anonymous notice, guests, team visibility, retro deletion warning) | 3, 7, 10, 12, 13 |
| §8 board panel (create form, card, notice, hidden/disabled controls) | 12, 13 |
| §8 carry-over panel | Plan 9b Task 1 |
| §8 Results view action items | 13 |
| §8 global page, team page link, sidebar entry | Task 9 (`openActionItemCount`); Plan 9b Task 2 |
| §9 service classes for MCP / spec 6 / spec 8 | 2, 5, 7, 9 |
| §10 parent AC30/AC16 changes, nullable `retro_id`/`created_by_participant_id`, `APP_TIMEZONE` in `.env.example` | 1, 6, 8 |
| §11 error handling (403 toast, 404, 422 inline/toast, 423 toast, 404 across workspaces) | 6, 8, 12 |
| §12 tests: migration, fields, assignee, permissions (board, workspace), surfaces, carry-over, broadcasts, anonymity, global page, comments, retro deletion, domain events, theme, items outside a retro, global page realtime | 1–10 |
| §12 walkthrough (board parts) | 14 |
| §3.2 recurrence, §3.3 sub-tasks, §3.4 reminders/notifications/settings/badge, AC13–AC15 | Plan 9b |
| AC1 | 1, 3, 5, 6 |
| AC2 | 1, 5, 6, 8 |
| AC3 | 2, 6, 7, 8 |
| AC4 | 6, 8 |
| AC5 | 9 (UI: Plan 9b Task 2) |
| AC6 | 10 (panel: Plan 9b Task 1) |
| AC7 | 4, 11, 13 |
| AC8 | 3, 7, 12 |
| AC9 | every task's translation rows |
| AC10 | 14 |
| AC11 | 8, 10 (UI: Plan 9b Tasks 1–2) |
| AC12 | 4 (subscription: Plan 9b Task 2) |
| AC16 | 3, 6 |
