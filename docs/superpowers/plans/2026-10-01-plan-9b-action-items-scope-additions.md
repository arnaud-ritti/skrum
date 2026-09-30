# Plan 9b — Action items v2 scope additions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On top of Plan 9a's action items, build the "Previous action items" carry-over panel and the workspace-wide "Action items" page (filters, deep link, live updates, items added outside a retro, sidebar entry, team page link), then add one level of sub-tasks, completion-based recurring items, and due-date reminders to member assignees — a queued daily email digest and an in-app notification bell — with per-user opt-out in `/settings/notifications` and a red overdue badge on the sidebar entry.

**Architecture:** The carry-over sheet and the global page reuse Plan 9a's frontend foundation (reducer, channels, endpoint maps) and `ActionItemCard`/`ActionItemForm` against the workspace endpoints; the page subscribes to `private-team-action-items.{teamId}` and reconciles with debounced Inertia partial reloads. They come first so the later UI (repeat select, sub-task checklist, bell, badge) renders on every surface. Sub-tasks are a child table edited through three single-purpose actions (`AddActionItemSubtask`, `UpdateActionItemSubtask`, `DeleteActionItemSubtask`) behind board and workspace endpoints that return the whole presented item; every change touches the item and re-broadcasts it through Plan 9a's `BroadcastActionItemChange`. Recurrence is an enum on the item; `SetActionItemStatus` creates the next occurrence (through `CreateActionItem`, so it is announced like any new item) in the completion transaction, guarded by the item row lock, a `nextOccurrence` check and the unique `previous_occurrence_id`. Reminders are computed by `SendActionItemReminders` (called by the daily `action-items:send-reminders` command registered in `routes/console.php`), logged in `action_item_reminders` with `insertOrIgnore` before dispatch, and delivered as one queued `ActionItemReminderDigestNotification` per user plus one database `ActionItemReminderNotification` per item. The bell reads a JSON endpoint that re-checks visibility live; counts travel as shared Inertia props.

**Tech Stack:** Laravel 13 (PHP 8.4), PostgreSQL, Laravel notifications (`mail`, `database`), scheduler, Pest, React 19, Inertia v3, Wayfinder, Tailwind 4, lucide, Radix dropdown/select/checkbox (already installed).

**Spec:** `docs/superpowers/specs/2026-09-29-action-items-v2-design.md` — §8 carry-over panel, global page, sidebar entry and team page link (with §3 "View all", §3.1 display, §5 page subscription, §6 `localStorage`), §2 (`action_item_subtasks`, `action_item_reminders`, `notifications`, `users` preferences, recurrence columns' behaviour), §3.2, §3.3, §3.4, §5 (sub-task, notification and settings endpoints, `recurrence`/`previousOccurrenceId`/`subtasks` in the payload), §7 (reminders, sub-tasks and recurrence privacy), §8 (repeat select, sub-task checklist, bell, settings, sidebar badge), §10 (scheduler, `.env.example`), §11, §12, AC13–AC15. Everything else of the spec is Plan 9a.

## Global Constraints

- Plan 9a is implemented on the same branch `feat/plan-9-action-items-v2`. This plan consumes exactly the "Contract for Plan 9b" of `docs/superpowers/plans/2026-10-01-plan-9a-action-items-core.md`: columns `action_items.recurrence` / `previous_occurrence_id` and check `action_items_recurrence_needs_due_date`; `ActionItem::presentationRelations()`, `loadForPresentation()`, `today()`, `isCompleted()`; `ActionItemActor`, `ExternalSyncActor`, `ActionItemPermissions` (`authorizeEdit`, `authorizeComplete`, `canEdit`, `canComplete`); `ActionItemRules::create/update/attributes/messages`; `CreateActionItem::handle(Team $team, ?Retro $retro, ActionItemActor $author, array $attributes, ?RetroTheme $theme = null)`; `UpdateActionItem::handle(ActionItem $locked, ActionItemActor $actor, array $changes)`; `SetActionItemStatus::handle(ActionItem $locked, ActionItemActor|ExternalSyncActor $actor, ActionItemStatus $status)`; `BroadcastActionItemChange::saved()`; `PresentActionItem::handle(ActionItem $item, ?ActionItemActor $viewer = null, ?CarbonInterface $today = null)`; `WorkspaceActionItemGuard::visible()` / `writable()`; `ActionItemQuery::visibleTo()`; the `workspaces.actionItems.index` props (`workspace`, `filters`, `items`, `focusedItem`, `teams`, `creatableTeams`, `assignees`, `realtimeTeamIds`, `viewer`) and `teams/show` prop `openActionItemCount`; snapshot fields `carriedActionItems`, `carriedActionItemsHasMore`, `teamMembers`, `links.{actionItems, workspace}`, `viewer.*`; the frontend foundation of 9a Task 11 (types, reducer actions `carriedActionItem.upsert/remove` / `actionItem.comments`, exported `countActionItemComments`, `useRetroChannel(…, membersOnly, …)`, `ActionItemViewer` and permission helpers, `EndpointRoute`, `ActionItemEndpoints`, `boardActionItemEndpoints`, `workspaceActionItemEndpoints`, `formatShortDate`) and the shared components of 9a Task 12 (`ActionItemCard`, `RunMutation`, `ActionItemForm` / `ActionItemDraft` / `actionItemPayload`, `teamAssigneeGroups`, `assigneeLabel`); existing `board.tsx`, `NavItem`, `AppSidebar`, `NavMain`, `teams/show.tsx`; test helpers of `tests/Pest.php` (`teamMember()`, `workspaceManager()`, `workspaceAdminParticipant()`, `retroMember()`, `retroFacilitator()`, `retroGuestCookie()`). Helpers defined inside other test files are not available when a single file runs, so every test file below declares its own fixtures.
- Commands through Sail: `vendor/bin/sail artisan …`, `vendor/bin/sail bin pint --dirty --format agent`, `vendor/bin/sail bin phpstan analyse --no-progress` (level 7, 0 errors). npm on the host.
- Tests run on PostgreSQL. No new Composer or npm dependency.
- Migration filenames continue Plan 9a's `2026_10_02_1000xx` series after its `100000` and `100100`: `100200`–`100500`; only `up()` methods.
- Sub-task endpoints follow the item's surface rules exactly (Plan 9a): board — `Discussing` only, 423 when locked, retro row locked; workspace — any phase, 404 when invisible, 423 only for a locked retro that is not `Completed`, item row locked. Structure changes (add, edit text, reorder, delete) need `canEdit`; check/uncheck needs `canComplete`.
- Reminders go only to member assignees who are still in the item's team and have a verified email. Emails and in-app rows never carry comments, authors or other assignees; in-app rows store ids only (spec §7).
- Every user-facing string via `t()` / `__()` / `trans_choice()` with real translations in `lang/{en,fr,es,de}.json` (German "du", French "vous", Spanish "tú"), appended at the end of each file, keeping every existing value. Each task lists its own rows; add only keys missing at execution time. `tests/Feature/TranslationKeysTest.php` stays green.
- Wayfinder: run `vendor/bin/sail artisan wayfinder:generate --with-form` after every route change; never stage `resources/js/actions` or `resources/js/routes`. Frontend imports use the generated controllers and named routes.
- Frontend checks: `npm run types:check && npm run check` (known pre-existing failures only in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`). Format only touched files with `npx vp check --fix <paths>`.
- PHP: constructor promotion, typed everything, array-shape docblocks, early returns, curly braces, no comments restating code. New test helper names are unique in `tests/`.
- Commit messages: Conventional Commits, ending with exactly:
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS`

## Review Focus

1. **Completing a recurring item twice** (complete, reopen, complete again) creates exactly one successor, whose due date is advanced interval by interval until it is on or after today, with monthly dates clamped to the month's end. Pinned in Task 4 ("creates exactly one next occurrence", "advances the due date until it is not overdue", "clamps monthly recurrences to the end of the month").
2. **A recurring item without a due date** — sent on create, or produced by clearing `due_on` on a recurring item — is a 422 on both surfaces, and an assignee who is not a manager cannot change the recurrence (403). Pinned in Task 4 ("needs a due date for a recurring item", "keeps the recurrence to managers").
3. **Reminder selection edges** — due in two days, due eight days ago, completed, unassigned, guest-assigned, assignee who left the team, unverified email → nothing sent and nothing logged; a second run the same day sends nothing; moving the due date or reassigning makes the item eligible again. Pinned in Task 7 ("skips items that must not be reminded", "sends each reminder once", "reminds again after the due date moves or the item is reassigned").
4. **Opt-outs** — email off → in-app only; in-app off → email only; both off → nothing and no `action_item_reminders` row. Pinned in Task 7 ("respects the email and in-app preferences").
5. **Stale notifications** — a notification whose item was deleted, or whose team the user can no longer view, is deleted and not listed; another user's notification is a 404; completing an item marks its unread reminders read. Pinned in Task 9 ("drops notifications of deleted or hidden items", "refuses other users notifications", "marks reminders read when the item is completed").

## File map

| Area | Files |
|---|---|
| Carry-over panel | `resources/js/components/retro/carried-action-items-panel.tsx`, `resources/js/components/retro/board.tsx` |
| Global page | `resources/js/pages/action-items/index.tsx`, `resources/js/components/app-sidebar.tsx`, `resources/js/pages/teams/show.tsx` |
| Sub-tasks | migration `2026_10_02_100200_create_action_item_subtasks_table`; `app/Models/ActionItemSubtask.php`; `database/factories/ActionItemSubtaskFactory.php`; `app/Actions/ActionItems/{ActionItemSubtaskRules,RenumberActionItemSubtasks,AddActionItemSubtask,UpdateActionItemSubtask,DeleteActionItemSubtask}.php`; `app/Http/Controllers/Retros/ActionItemSubtasksController.php`; `app/Http/Controllers/WorkspaceActionItemSubtasksController.php` |
| Recurrence | `app/Enums/ActionItemRecurrence.php`; `app/Actions/ActionItems/CreateNextOccurrence.php`; `app/Actions/ActionItems/{CreateActionItem,UpdateActionItem,SetActionItemStatus,ActionItemRules}.php` |
| Shared model/presenter | `app/Models/{ActionItem,Retro,User}.php`, `database/factories/ActionItemFactory.php`, `app/Actions/Retros/PresentActionItem.php`, `routes/web.php` |
| Reminders | migrations `2026_10_02_100300_create_notifications_table`, `2026_10_02_100400_add_notification_preferences_to_users_table`, `2026_10_02_100500_create_action_item_reminders_table`; `app/Enums/ActionItemReminderKind.php`; `app/Models/ActionItemReminder.php`; `app/Notifications/{ActionItemReminderDigestNotification,ActionItemReminderNotification}.php`; `app/Actions/ActionItems/{SendActionItemReminders,PruneActionItemNotifications}.php`; `app/Console/Commands/SendActionItemRemindersCommand.php`; `routes/console.php`; `config/skrum.php`; `.env.example` |
| Notifications & settings | `app/Http/Controllers/{NotificationsController,ReadAllNotificationsController}.php`; `app/Http/Controllers/Settings/NotificationPreferencesController.php`; `routes/settings.php`; `app/Http/Middleware/HandleInertiaRequests.php` |
| Frontend | `resources/js/lib/retro/types.ts`, `resources/js/lib/action-items/{endpoints,format}.ts`, `resources/js/components/action-items/{recurrence-select,subtask-checklist,action-item-card,action-item-form}.tsx`, `resources/js/components/notification-bell.tsx`, `resources/js/components/{app-sidebar-header,app-sidebar,nav-main}.tsx`, `resources/js/types/{index.d.ts,navigation.ts}`, `resources/js/layouts/settings/layout.tsx`, `resources/js/pages/settings/notifications.tsx` |
| Tests | `tests/Feature/ActionItems/{SubtasksTest,RecurrenceTest,ReminderDigestTest,ReminderSelectionTest,ReminderCommandTest,NotificationsTest}.php`, `tests/Feature/Settings/NotificationPreferencesTest.php`, `tests/Feature/ActionItems/PresentActionItemTest.php` |
| Translations | `lang/{en,fr,es,de}.json` (rows inside each task) |

---

### Task 1: "Previous action items" carry-over panel

**Files:**
- Create: `resources/js/components/retro/carried-action-items-panel.tsx`
- Modify: `resources/js/components/retro/board.tsx`, `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: snapshot `carriedActionItems`, `carriedActionItemsHasMore`, `teamMembers`, `links.{actionItems, workspace}` (Plan 9a Task 10); reducer actions `carriedActionItem.upsert/remove`, `actionItem.comments` (Plan 9a Task 11); `ActionItemCard`, `teamAssigneeGroups` (Plan 9a Task 12); `workspaceActionItemEndpoints`, `boardActionItemViewer`, `formatShortDate` (Plan 9a Task 11).
- Produces: `CarriedActionItemsPanel()` — header button "Previous action items (n)" (n = open carried items) for non-guests in every phase but `Completed` while the list is not empty; a right-hand sheet grouped by source retro (newest first) then "Added outside a retro"; opens by itself once per viewer and retro when the board first loads in `Writing` (`localStorage` key `skrum.carriedSeen.{retroId}`); "View all on the action items page" when capped; footer link "Open the action items page". `groupCarriedActionItems(items: ActionItem[]): CarriedGroup[]`.

- [ ] **Step 1: The panel**

Create `resources/js/components/retro/carried-action-items-panel.tsx`:

```tsx
import { Link, usePage } from '@inertiajs/react';
import { History } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActionItemCard } from '@/components/action-items/action-item-card';
import { teamAssigneeGroups } from '@/components/action-items/assignee-select';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { useTrans } from '@/hooks/use-trans';
import { workspaceActionItemEndpoints } from '@/lib/action-items/endpoints';
import { formatShortDate } from '@/lib/action-items/format';
import { boardActionItemViewer } from '@/lib/action-items/permissions';
import type { ActionItem } from '@/lib/retro/types';
import { useBoard } from './board-context';

const OutsideRetro = 'outside';

export type CarriedGroup = {
    key: string;
    title: string;
    createdAt: string | null;
    items: ActionItem[];
};

/**
 * One group per source retro, newest retro first, items in server order;
 * items added outside a retro come last.
 */
export function groupCarriedActionItems(items: ActionItem[]): CarriedGroup[] {
    const groups = new Map<string, CarriedGroup>();

    for (const item of items) {
        const key = item.retroId ?? OutsideRetro;
        const group = groups.get(key) ?? {
            key,
            title: item.source?.retroTitle ?? '',
            createdAt: item.source?.retroCreatedAt ?? null,
            items: [],
        };

        groups.set(key, { ...group, items: [...group.items, item] });
    }

    return [...groups.values()].sort((first, second) => {
        if (first.key === OutsideRetro) {
            return 1;
        }

        if (second.key === OutsideRetro) {
            return -1;
        }

        return (second.createdAt ?? '').localeCompare(first.createdAt ?? '');
    });
}

export function CarriedActionItemsPanel() {
    const ctx = useBoard();
    const { t } = useTrans();
    const { locale } = usePage().props;
    const { board } = ctx;
    const [open, setOpen] = useState(false);
    const firstPhase = useRef(board.retro.phase);
    const workspace = board.links.workspace;
    const endpoints = useMemo(
        () => workspaceActionItemEndpoints(workspace ?? ''),
        [workspace],
    );
    const items = board.carriedActionItems;
    const openCount = items.filter((item) => item.status === 'open').length;
    const available =
        !board.viewer.isGuest &&
        workspace !== null &&
        board.retro.phase !== 'completed' &&
        items.length > 0;

    useEffect(() => {
        if (!available || firstPhase.current !== 'writing') {
            return;
        }

        const key = `skrum.carriedSeen.${board.retro.id}`;

        try {
            if (window.localStorage.getItem(key) !== null) {
                return;
            }

            window.localStorage.setItem(key, 'true');
        } catch {
            return;
        }

        setOpen(true);
    }, [available, board.retro.id]);

    if (!available) {
        return null;
    }

    const viewer = boardActionItemViewer(board);
    const groups = teamAssigneeGroups(board.teamMembers, t);

    return (
        <>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
                <History className="size-4" />
                {t('Previous action items (:count)', { count: openCount })}
            </Button>
            <Sheet open={open} onOpenChange={setOpen}>
                <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
                    <SheetHeader>
                        <SheetTitle>{t('Previous action items')}</SheetTitle>
                        <SheetDescription>
                            {t(
                                'Open follow-ups from earlier retrospectives of this team.',
                            )}
                        </SheetDescription>
                    </SheetHeader>
                    <div className="space-y-6 px-4">
                        {groupCarriedActionItems(items).map((group) => (
                            <section key={group.key} className="space-y-2">
                                <h3 className="text-sm font-semibold">
                                    {group.key === OutsideRetro
                                        ? t('Added outside a retro')
                                        : group.title}
                                    {group.createdAt && (
                                        <span className="ml-2 font-normal text-muted-foreground">
                                            {formatShortDate(
                                                group.createdAt,
                                                locale,
                                            )}
                                        </span>
                                    )}
                                </h3>
                                <ul className="space-y-2">
                                    {group.items.map((item) => (
                                        <ActionItemCard
                                            key={item.id}
                                            item={item}
                                            endpoints={endpoints}
                                            viewer={viewer}
                                            assigneeGroups={groups}
                                            run={ctx.run}
                                            editable
                                            showAnonymousNotice={
                                                board.retro.isAnonymous
                                            }
                                            onSaved={(actionItem) =>
                                                ctx.apply({
                                                    type: 'carriedActionItem.upsert',
                                                    actionItem,
                                                })
                                            }
                                            onRemoved={(actionItemId) =>
                                                ctx.apply({
                                                    type: 'carriedActionItem.remove',
                                                    actionItemId,
                                                })
                                            }
                                            onCommentCount={(
                                                actionItemId,
                                                commentCount,
                                            ) =>
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
                            </section>
                        ))}
                        {board.carriedActionItemsHasMore &&
                            board.links.actionItems && (
                                <p className="text-sm">
                                    <Link
                                        href={board.links.actionItems}
                                        className="underline-offset-4 hover:underline"
                                    >
                                        {t('View all on the action items page')}
                                    </Link>
                                </p>
                            )}
                    </div>
                    {board.links.actionItems && (
                        <SheetFooter>
                            <Button variant="secondary" asChild>
                                <Link href={board.links.actionItems}>
                                    {t('Open the action items page')}
                                </Link>
                            </Button>
                        </SheetFooter>
                    )}
                </SheetContent>
            </Sheet>
        </>
    );
}
```

- [ ] **Step 2: Mount it in the header**

In `resources/js/components/retro/board.tsx` add `import { CarriedActionItemsPanel } from './carried-action-items-panel';` and, in the `actions` fragment passed to `BoardHeader`, add `<CarriedActionItemsPanel />` before `<SuggestGroupNamesButton />`.

- [ ] **Step 3: Translations**

| Key | fr | es | de |
|---|---|---|---|
| `Previous action items (:count)` | `Actions précédentes (:count)` | `Acciones anteriores (:count)` | `Frühere Aktionspunkte (:count)` |
| `Previous action items` | `Actions précédentes` | `Acciones anteriores` | `Frühere Aktionspunkte` |
| `Open follow-ups from earlier retrospectives of this team.` | `Les suivis ouverts des rétrospectives précédentes de cette équipe.` | `Seguimientos abiertos de retrospectivas anteriores de este equipo.` | `Offene Folgeaufgaben aus früheren Retrospektiven dieses Teams.` |
| `Added outside a retro` | `Ajoutée hors d'une rétro` | `Añadida fuera de una retro` | `Außerhalb einer Retro hinzugefügt` |
| `View all on the action items page` | `Tout voir sur la page des actions` | `Ver todo en la página de acciones` | `Alle auf der Seite der Aktionspunkte ansehen` |
| `Open the action items page` | `Ouvrir la page des actions` | `Abrir la página de acciones` | `Seite der Aktionspunkte öffnen` |

- [ ] **Step 4: Checks**

Run: `npx vp check --fix resources/js/components/retro/carried-action-items-panel.tsx resources/js/components/retro/board.tsx && npm run types:check && npm run check && vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: PASS (known pre-existing lint failures only).

- [ ] **Step 5: Commit**

```bash
git add resources/js/components/retro/carried-action-items-panel.tsx resources/js/components/retro/board.tsx lang
git commit -m "feat: review the team's previous action items from the board

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 2: Global "Action items" page, sidebar entry and team link

**Files:**
- Create: `resources/js/pages/action-items/index.tsx`
- Modify: `resources/js/components/app-sidebar.tsx`, `resources/js/pages/teams/show.tsx`, `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: page props of Plan 9a Task 9; Wayfinder `WorkspaceActionItemsController.index/store`; `ActionItemCard`, `ActionItemForm`, `teamAssigneeGroups`, `assigneeLabel` (Plan 9a Task 12); `workspaceActionItemEndpoints`, `countActionItemComments`, `formatShortDate`, `ActionItemViewer` (Plan 9a Task 11); `echo`, `echoIsConfigured` from `@laravel/echo-react`; `retroRequest`, `RetroRequestError`.
- Produces: Inertia page `action-items/index` (default export `ActionItemsIndex`): filter bar (status, assignee, team) driven by the query string and remembered in `localStorage` key `skrum.actionItemFilters.{workspaceId}` (applied when the page opens without a query string); "New action item" dialog (team select defaulting to the team filter, create form, `POST /w/{workspace}/action-items`); rows = `ActionItemCard` with team, source retro link/date or "Added outside a retro", and assignee as `meta`; `?item=` shows and scrolls to the linked item (pinned above the list when it is not on the current page); live updates from `private-team-action-items.{teamId}` for every id in `realtimeTeamIds` (row replaced in place, comment counts updated, debounced 1 s partial reload of `items`/`focusedItem`), reload on window focus and after own mutations; empty states; pagination. Sidebar entry "Action items" below "Teams"; team page button "Open action items (n)".

- [ ] **Step 1: The page**

Create `resources/js/pages/action-items/index.tsx`:

```tsx
import { Head, Link, router, usePage } from '@inertiajs/react';
import { echo, echoIsConfigured } from '@laravel/echo-react';
import { Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import WorkspaceActionItemsController from '@/actions/App/Http/Controllers/WorkspaceActionItemsController';
import {
    ActionItemCard,
    type RunMutation,
} from '@/components/action-items/action-item-card';
import { ActionItemForm } from '@/components/action-items/action-item-form';
import {
    assigneeLabel,
    teamAssigneeGroups,
} from '@/components/action-items/assignee-select';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import { workspaceActionItemEndpoints } from '@/lib/action-items/endpoints';
import { formatShortDate } from '@/lib/action-items/format';
import type { ActionItemViewer } from '@/lib/action-items/permissions';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import { countActionItemComments } from '@/lib/retro/board-reducer';
import type { ActionItem } from '@/lib/retro/types';
import type { WorkspaceSummary } from '@/types';

type StatusFilter = 'open' | 'overdue' | 'completed' | 'all';

type Filters = {
    status: StatusFilter;
    assignee: string | null;
    team: string | null;
    item: string | null;
};

type TeamOption = {
    id: string;
    name: string;
    members: Array<{ id: string; name: string; avatarUrl: string }>;
};

type Props = {
    workspace: WorkspaceSummary;
    filters: Filters;
    items: {
        data: ActionItem[];
        currentPage: number;
        lastPage: number;
        total: number;
        prevPageUrl: string | null;
        nextPageUrl: string | null;
    };
    focusedItem: ActionItem | null;
    teams: TeamOption[];
    creatableTeams: TeamOption[];
    assignees: Array<{ id: string; name: string }>;
    realtimeTeamIds: string[];
    viewer: {
        userId: string;
        isWorkspaceManager: boolean;
        facilitatedRetroIds: string[];
        reviewTeamIds: string[];
    };
};

const Any = 'any';
const ReloadDelayMs = 1_000;
const ReloadProps = ['items', 'focusedItem'];

/** Translation keys, passed to t() through a variable. */
const StatusLabels: Record<StatusFilter, string> = {
    open: 'Open',
    overdue: 'Overdue',
    completed: 'Completed',
    all: 'All',
};

function filterStorageKey(workspaceId: string): string {
    return `skrum.actionItemFilters.${workspaceId}`;
}

function filterQuery(filters: Filters): Record<string, string> {
    const query: Record<string, string> = {};

    if (filters.status !== 'open') {
        query.status = filters.status;
    }

    if (filters.assignee) {
        query.assignee = filters.assignee;
    }

    if (filters.team) {
        query.team = filters.team;
    }

    return query;
}

function readStoredFilters(workspaceId: string): Record<string, string> | null {
    try {
        const stored: unknown = JSON.parse(
            window.localStorage.getItem(filterStorageKey(workspaceId)) ?? 'null',
        );

        if (stored === null || typeof stored !== 'object') {
            return null;
        }

        return Object.fromEntries(
            Object.entries(stored).filter(
                (entry): entry is [string, string] =>
                    typeof entry[1] === 'string',
            ),
        );
    } catch {
        return null;
    }
}

function storeFilters(workspaceId: string, query: Record<string, string>) {
    try {
        window.localStorage.setItem(
            filterStorageKey(workspaceId),
            JSON.stringify(query),
        );
    } catch {
        // Storage can be full or disabled; the filters still apply to this visit.
    }
}

function replaceActionItem(
    items: ActionItem[],
    incoming: ActionItem,
): ActionItem[] {
    return items.map((item) =>
        item.id === incoming.id
            ? {
                  ...incoming,
                  isMine: incoming.isMine || item.isMine,
                  commentsRevision: item.commentsRevision,
              }
            : item,
    );
}

function reload() {
    router.reload({ only: ReloadProps });
}

function useToastRun(): RunMutation {
    const { t } = useTrans();

    return useCallback<RunMutation>(
        async (mutation) => {
            try {
                return await mutation;
            } catch (error) {
                const message =
                    error instanceof RetroRequestError && error.status === 0
                        ? t('The server did not respond in time. Please try again.')
                        : error instanceof RetroRequestError &&
                            error.message !== ''
                          ? error.message
                          : t('Something went wrong. Please try again.');

                toast.error(message);
                reload();

                return undefined;
            }
        },
        [t],
    );
}

function RowMeta({
    item,
    teamName,
}: {
    item: ActionItem;
    teamName: string | undefined;
}) {
    const { t } = useTrans();
    const { locale } = usePage().props;

    return (
        <>
            {teamName && (
                <Badge variant="secondary" className="font-normal">
                    {teamName}
                </Badge>
            )}
            {item.source ? (
                <Link
                    href={item.source.retroUrl}
                    className="underline-offset-4 hover:underline"
                >
                    {item.source.retroTitle}
                    {item.source.retroCreatedAt &&
                        ` · ${formatShortDate(item.source.retroCreatedAt, locale)}`}
                </Link>
            ) : (
                <span>{t('Added outside a retro')}</span>
            )}
            {item.assignee && <span>{assigneeLabel(item.assignee, t)}</span>}
        </>
    );
}

function NewActionItemDialog({
    open,
    onOpenChange,
    workspaceSlug,
    teams,
    defaultTeamId,
    run,
    onCreated,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workspaceSlug: string;
    teams: TeamOption[];
    defaultTeamId: string | null;
    run: RunMutation;
    onCreated: () => void;
}) {
    const { t } = useTrans();
    const [teamId, setTeamId] = useState(
        teams.some((team) => team.id === defaultTeamId)
            ? (defaultTeamId as string)
            : (teams[0]?.id ?? ''),
    );
    const team = teams.find((option) => option.id === teamId);

    const create = async (
        payload: Record<string, unknown>,
    ): Promise<boolean> => {
        const response = await run(
            retroRequest<{ actionItem: ActionItem }>(
                WorkspaceActionItemsController.store(workspaceSlug),
                { ...payload, team_id: teamId },
            ),
        );

        if (!response) {
            return false;
        }

        onCreated();
        onOpenChange(false);

        return true;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogTitle>{t('New action item')}</DialogTitle>
                <DialogDescription>
                    {t('Add a follow-up to one of your teams.')}
                </DialogDescription>
                <Select value={teamId} onValueChange={setTeamId}>
                    <SelectTrigger className="w-full" aria-label={t('Team')}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {teams.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                                {option.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <ActionItemForm
                    key={teamId}
                    assigneeGroups={teamAssigneeGroups(team?.members ?? [], t)}
                    submitLabel={t('Create')}
                    onSubmit={create}
                />
            </DialogContent>
        </Dialog>
    );
}

export default function ActionItemsIndex({
    workspace,
    filters,
    items,
    focusedItem,
    teams,
    creatableTeams,
    assignees,
    realtimeTeamIds,
    viewer,
}: Props) {
    const { t } = useTrans();
    const run = useToastRun();
    const [rows, setRows] = useState(items.data);
    const [knownRows, setKnownRows] = useState(items.data);
    const [focused, setFocused] = useState(focusedItem);
    const [knownFocused, setKnownFocused] = useState(focusedItem);
    const [creating, setCreating] = useState(false);
    const pendingReload = useRef<ReturnType<typeof setTimeout> | null>(null);
    const endpoints = useMemo(
        () => workspaceActionItemEndpoints(workspace.slug),
        [workspace.slug],
    );
    const teamsById = useMemo(
        () => new Map(teams.map((team) => [team.id, team])),
        [teams],
    );
    const actionViewer: ActionItemViewer = {
        userId: viewer.userId,
        participantId: null,
        isWorkspaceManager: viewer.isWorkspaceManager,
        facilitatedRetroIds: viewer.facilitatedRetroIds,
        reviewTeamIds: viewer.reviewTeamIds,
    };

    if (knownRows !== items.data) {
        setKnownRows(items.data);
        setRows(items.data);
    }

    if (knownFocused !== focusedItem) {
        setKnownFocused(focusedItem);
        setFocused(focusedItem);
    }

    const scheduleReload = useCallback(() => {
        if (pendingReload.current !== null) {
            return;
        }

        pendingReload.current = setTimeout(() => {
            pendingReload.current = null;
            reload();
        }, ReloadDelayMs);
    }, []);

    const replaceRow = useCallback((incoming: ActionItem) => {
        setRows((current) => replaceActionItem(current, incoming));
        setFocused((current) =>
            current === null ? null : replaceActionItem([current], incoming)[0],
        );
    }, []);

    const countComments = useCallback(
        (actionItemId: string, commentCount: number, refresh: boolean) => {
            setRows((current) =>
                countActionItemComments(
                    current,
                    actionItemId,
                    commentCount,
                    refresh,
                ),
            );
            setFocused((current) =>
                current === null
                    ? null
                    : countActionItemComments(
                          [current],
                          actionItemId,
                          commentCount,
                          refresh,
                      )[0],
            );
        },
        [],
    );

    const handlers = useRef({ replaceRow, countComments, scheduleReload });

    handlers.current = { replaceRow, countComments, scheduleReload };

    const channelKey = realtimeTeamIds.join(',');

    useEffect(() => {
        if (!echoIsConfigured() || channelKey === '') {
            return;
        }

        const names = channelKey
            .split(',')
            .map((teamId) => `team-action-items.${teamId}`);

        for (const name of names) {
            echo<'reverb'>()
                .private(name)
                .listen(
                    '.team-action-item.saved',
                    (payload: { actionItem: ActionItem }) => {
                        handlers.current.replaceRow(payload.actionItem);
                        handlers.current.scheduleReload();
                    },
                )
                .listen('.team-action-item.deleted', () =>
                    handlers.current.scheduleReload(),
                )
                .listen(
                    '.team-action-item.comments.changed',
                    (payload: { actionItemId: string; commentCount: number }) =>
                        handlers.current.countComments(
                            payload.actionItemId,
                            payload.commentCount,
                            true,
                        ),
                );
        }

        return () => {
            for (const name of names) {
                echo().leave(name);
            }
        };
    }, [channelKey]);

    useEffect(() => {
        window.addEventListener('focus', reload);

        return () => {
            window.removeEventListener('focus', reload);

            if (pendingReload.current !== null) {
                clearTimeout(pendingReload.current);
            }
        };
    }, []);

    useEffect(() => {
        if (window.location.search !== '') {
            return;
        }

        const stored = readStoredFilters(workspace.id);

        if (stored === null || Object.keys(stored).length === 0) {
            return;
        }

        router.get(
            WorkspaceActionItemsController.index.url(workspace.slug, {
                query: stored,
            }),
            {},
            { preserveState: true, replace: true },
        );
    }, [workspace.id, workspace.slug]);

    useEffect(() => {
        if (filters.item === null) {
            return;
        }

        document
            .getElementById(`action-item-${filters.item}`)
            ?.scrollIntoView({ block: 'center' });
    }, [filters.item]);

    const applyFilters = (changes: Partial<Filters>) => {
        const query = filterQuery({ ...filters, ...changes, item: null });

        storeFilters(workspace.id, query);
        router.get(
            WorkspaceActionItemsController.index.url(workspace.slug, { query }),
            {},
            { preserveState: true, preserveScroll: true },
        );
    };

    const renderCard = (item: ActionItem) => (
        <ActionItemCard
            key={item.id}
            item={item}
            endpoints={endpoints}
            viewer={actionViewer}
            assigneeGroups={teamAssigneeGroups(
                teamsById.get(item.teamId)?.members ?? [],
                t,
            )}
            run={run}
            editable
            defaultExpanded={item.id === filters.item}
            meta={
                <RowMeta item={item} teamName={teamsById.get(item.teamId)?.name} />
            }
            onSaved={(actionItem) => {
                replaceRow(actionItem);
                scheduleReload();
            }}
            onRemoved={(actionItemId) => {
                setRows((current) =>
                    current.filter((row) => row.id !== actionItemId),
                );
                setFocused((current) =>
                    current?.id === actionItemId ? null : current,
                );
                scheduleReload();
            }}
            onCommentCount={(actionItemId, commentCount) =>
                countComments(actionItemId, commentCount, false)
            }
        />
    );

    const isDefaultFilter =
        filters.status === 'open' &&
        filters.assignee === null &&
        filters.team === null;
    const focusedOutsideList =
        focused !== null && !rows.some((row) => row.id === focused.id);

    return (
        <>
            <Head title={t('Action items')} />
            <div className="max-w-4xl space-y-6 p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <Heading
                        title={t('Action items')}
                        description={t('Follow-ups of every team you can see')}
                    />
                    {creatableTeams.length > 0 && (
                        <Button onClick={() => setCreating(true)}>
                            <Plus />
                            {t('New action item')}
                        </Button>
                    )}
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                    <Select
                        value={filters.status}
                        onValueChange={(status) =>
                            applyFilters({ status: status as StatusFilter })
                        }
                    >
                        <SelectTrigger className="w-full" aria-label={t('Status')}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {(
                                Object.keys(StatusLabels) as StatusFilter[]
                            ).map((status) => (
                                <SelectItem key={status} value={status}>
                                    {t(StatusLabels[status])}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select
                        value={filters.assignee ?? Any}
                        onValueChange={(assignee) =>
                            applyFilters({
                                assignee: assignee === Any ? null : assignee,
                            })
                        }
                    >
                        <SelectTrigger
                            className="w-full"
                            aria-label={t('Assignee')}
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={Any}>{t('Anyone')}</SelectItem>
                            <SelectItem value="me">{t('Me')}</SelectItem>
                            <SelectItem value="unassigned">
                                {t('Unassigned')}
                            </SelectItem>
                            {assignees.map((assignee) => (
                                <SelectItem key={assignee.id} value={assignee.id}>
                                    {assignee.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select
                        value={filters.team ?? Any}
                        onValueChange={(team) =>
                            applyFilters({ team: team === Any ? null : team })
                        }
                    >
                        <SelectTrigger className="w-full" aria-label={t('Team')}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={Any}>{t('All teams')}</SelectItem>
                            {teams.map((team) => (
                                <SelectItem key={team.id} value={team.id}>
                                    {team.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {focusedOutsideList && focused && (
                    <section className="space-y-2">
                        <Heading variant="small" title={t('Linked action item')} />
                        <ul>{renderCard(focused)}</ul>
                    </section>
                )}

                {rows.length === 0 ? (
                    <p className="text-muted-foreground">
                        {isDefaultFilter
                            ? t('No open action items.')
                            : t('Nothing matches these filters.')}
                    </p>
                ) : (
                    <ul className="space-y-2">{rows.map(renderCard)}</ul>
                )}

                {items.lastPage > 1 && (
                    <nav
                        className="flex items-center justify-between gap-2 text-sm"
                        aria-label={t('Pagination')}
                    >
                        {items.prevPageUrl ? (
                            <Link href={items.prevPageUrl} preserveScroll>
                                {t('Previous')}
                            </Link>
                        ) : (
                            <span />
                        )}
                        <span className="text-muted-foreground">
                            {t('Page :page of :total', {
                                page: items.currentPage,
                                total: items.lastPage,
                            })}
                        </span>
                        {items.nextPageUrl ? (
                            <Link href={items.nextPageUrl} preserveScroll>
                                {t('Next')}
                            </Link>
                        ) : (
                            <span />
                        )}
                    </nav>
                )}
            </div>

            {creating && (
                <NewActionItemDialog
                    open={creating}
                    onOpenChange={setCreating}
                    workspaceSlug={workspace.slug}
                    teams={creatableTeams}
                    defaultTeamId={filters.team}
                    run={run}
                    onCreated={reload}
                />
            )}
        </>
    );
}
```

- [ ] **Step 2: Sidebar entry**

In `resources/js/components/app-sidebar.tsx` add `import WorkspaceActionItemsController from '@/actions/App/Http/Controllers/WorkspaceActionItemsController';`, add `ListChecks` to the `lucide-react` import, and right after the `mainNavItems` declaration (so the entry sits below "Teams"):

```tsx
    if (currentWorkspace) {
        mainNavItems.push({
            title: 'Action items',
            href: WorkspaceActionItemsController.index(currentWorkspace.slug),
            icon: ListChecks,
        });
    }
```

- [ ] **Step 3: Team page link**

In `resources/js/pages/teams/show.tsx` add `import WorkspaceActionItemsController from '@/actions/App/Http/Controllers/WorkspaceActionItemsController';`, add `openActionItemCount: number;` to `Props` and to the destructured props, and right after the page `<Heading … />`:

```tsx
                <Button variant="outline" size="sm" asChild>
                    <Link
                        href={WorkspaceActionItemsController.index(workspace.slug, {
                            query: { team: team.id },
                        })}
                    >
                        {t('Open action items (:count)', {
                            count: openActionItemCount,
                        })}
                    </Link>
                </Button>
```

- [ ] **Step 4: Translations**

`Open` and `All` / `Completed` / `Overdue` reach `t()` through `StatusLabels`; keep every row:

| Key | fr | es | de |
|---|---|---|---|
| `Open` | `Ouvertes` | `Abiertas` | `Offen` |
| `Status` | `Statut` | `Estado` | `Status` |
| `Anyone` | `N'importe qui` | `Cualquiera` | `Alle Personen` |
| `Me` | `Moi` | `Yo` | `Ich` |
| `All teams` | `Toutes les équipes` | `Todos los equipos` | `Alle Teams` |
| `New action item` | `Nouvelle action` | `Nueva acción` | `Neuer Aktionspunkt` |
| `Add a follow-up to one of your teams.` | `Ajoutez un suivi à l'une de vos équipes.` | `Añade un seguimiento a uno de tus equipos.` | `Füge einem deiner Teams eine Folgeaufgabe hinzu.` |
| `Create` | `Créer` | `Crear` | `Erstellen` |
| `Follow-ups of every team you can see` | `Les suivis de toutes les équipes que vous voyez` | `Los seguimientos de todos los equipos que puedes ver` | `Folgeaufgaben aller Teams, die du sehen kannst` |
| `Linked action item` | `Action liée` | `Acción enlazada` | `Verknüpfter Aktionspunkt` |
| `No open action items.` | `Aucune action ouverte.` | `No hay acciones abiertas.` | `Keine offenen Aktionspunkte.` |
| `Nothing matches these filters.` | `Rien ne correspond à ces filtres.` | `Nada coincide con estos filtros.` | `Nichts passt zu diesen Filtern.` |
| `Pagination` | `Pagination` | `Paginación` | `Seitennavigation` |
| `Page :page of :total` | `Page :page sur :total` | `Página :page de :total` | `Seite :page von :total` |
| `Open action items (:count)` | `Actions ouvertes (:count)` | `Acciones abiertas (:count)` | `Offene Aktionspunkte (:count)` |

- [ ] **Step 5: Checks**

Run: `npx vp check --fix resources/js/pages/action-items/index.tsx resources/js/components/app-sidebar.tsx resources/js/pages/teams/show.tsx && npm run types:check && npm run check && vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php tests/Feature/ActionItems/ActionItemsPageTest.php`
Expected: PASS (known pre-existing lint failures only).

- [ ] **Step 6: Commit**

```bash
git add resources/js/pages/action-items/index.tsx resources/js/components/app-sidebar.tsx resources/js/pages/teams/show.tsx lang
git commit -m "feat: add the workspace action items page with filters and live updates

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 3: Sub-tasks (model, actions, board and workspace endpoints)

**Files:**
- Create: `database/migrations/2026_10_02_100200_create_action_item_subtasks_table.php`, `app/Models/ActionItemSubtask.php`, `database/factories/ActionItemSubtaskFactory.php`, `app/Actions/ActionItems/ActionItemSubtaskRules.php`, `app/Actions/ActionItems/RenumberActionItemSubtasks.php`, `app/Actions/ActionItems/AddActionItemSubtask.php`, `app/Actions/ActionItems/UpdateActionItemSubtask.php`, `app/Actions/ActionItems/DeleteActionItemSubtask.php`, `app/Http/Controllers/Retros/ActionItemSubtasksController.php`, `app/Http/Controllers/WorkspaceActionItemSubtasksController.php`
- Modify: `app/Models/ActionItem.php`, `app/Models/Retro.php`, `database/factories/ActionItemFactory.php`, `app/Actions/Retros/PresentActionItem.php`, `routes/web.php`, `tests/Feature/ActionItems/PresentActionItemTest.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/ActionItems/SubtasksTest.php`

**Interfaces:**
- Consumes: Plan 9a contract (permissions, broadcaster, presenter, guards, `tests/Pest.php` helpers).
- Produces: table `action_item_subtasks`; `App\Models\ActionItemSubtask` (`actionItem()`, `isCompleted()`), factory state `completed()`; `ActionItem::subtasks(): HasMany` ordered by `position`, `'subtasks'` appended to `ActionItem::presentationRelations()`; `ActionItemFactory::withSubtasks(int $count)`; `Retro::actionItemSubtasks(): HasManyThrough`; payload key `subtasks: [{id, content, isCompleted, position}]` (after `themeName`, before `createdAt`); `AddActionItemSubtask::handle(ActionItem $locked, ActionItemActor $actor, string $content): ActionItem` (`Limit = 20`), `UpdateActionItemSubtask::handle(ActionItem $locked, ActionItemSubtask $subtask, ActionItemActor $actor, array $validated): ActionItem`, `DeleteActionItemSubtask::handle(ActionItem $locked, ActionItemSubtask $subtask, ActionItemActor $actor): ActionItem`, `RenumberActionItemSubtasks::move(ActionItemSubtask $subtask, int $position): void` / `compact(string $actionItemId): void`, `ActionItemSubtaskRules::create()` / `update()`; routes `retros.action-items.subtasks.store` (`POST /retros/{retro}/action-items/{actionItem}/subtasks {content}` → 201 `{actionItem}`), `retros.action-items.subtasks.update` (`PATCH /retros/{retro}/action-item-subtasks/{actionItemSubtask}` any of `content, status, position` → 200 `{actionItem}`), `retros.action-items.subtasks.destroy` (`DELETE …` → 200 `{actionItem}`), and `workspaces.actionItemSubtasks.store|update|destroy` on `/w/{workspace}/action-items/{actionItem}/subtasks` and `/w/{workspace}/action-item-subtasks/{actionItemSubtask}`.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/ActionItems/SubtasksTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Events\ActionItems\TeamActionItemSaved;
use App\Models\ActionItem;
use App\Models\ActionItemSubtask;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Factories\Sequence;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

/**
 * @param  array<string, mixed>  $attributes
 * @return array{0: Retro, 1: ActionItem, 2: User}
 */
function subtaskBoardItem(RetroPhase $phase = RetroPhase::Discussing, array $attributes = []): array
{
    $retro = Retro::factory()->inPhase($phase)->create($attributes);
    [$user, $participant] = retroMember($retro);
    $item = ActionItem::factory()->create(['retro_id' => $retro->id, 'created_by_participant_id' => $participant->id]);

    return [$retro, $item, $user];
}

it('adds, edits, reorders, checks and deletes sub-tasks on the board', function () {
    [$retro, $item, $user] = subtaskBoardItem();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 10:00:00'));

    foreach (['Draft', 'Review', 'Ship'] as $content) {
        $this->actingAs($user)
            ->postJson(route('retros.action-items.subtasks.store', [$retro, $item]), ['content' => $content])
            ->assertCreated();
    }

    $ship = ActionItemSubtask::query()->where('content', 'Ship')->sole();
    $draft = ActionItemSubtask::query()->where('content', 'Draft')->sole();

    $this->actingAs($user)
        ->patchJson(route('retros.action-items.subtasks.update', [$retro, $ship]), ['position' => 0, 'content' => 'Ship it'])
        ->assertOk()
        ->assertJsonPath('actionItem.subtasks.0.content', 'Ship it')
        ->assertJsonPath('actionItem.subtasks.1.content', 'Draft')
        ->assertJsonPath('actionItem.subtasks.2.content', 'Review');

    $this->actingAs($user)
        ->patchJson(route('retros.action-items.subtasks.update', [$retro, $draft]), ['status' => 'completed'])
        ->assertOk()
        ->assertJsonPath('actionItem.subtasks.1.isCompleted', true)
        ->assertJsonPath('actionItem.status', 'open');

    $this->actingAs($user)
        ->deleteJson(route('retros.action-items.subtasks.destroy', [$retro, $ship]))
        ->assertOk()
        ->assertJsonPath('actionItem.subtasks.0.content', 'Draft')
        ->assertJsonPath('actionItem.subtasks.0.position', 0)
        ->assertJsonPath('actionItem.subtasks.1.position', 1);

    expect($item->fresh()->updated_at?->toDateTimeString())->toBe('2026-10-05 10:00:00');
    Event::assertDispatched(TeamActionItemSaved::class, fn (TeamActionItemSaved $event) => count($event->actionItem['subtasks']) === 3);
});

it('keeps the structure to managers and ticking to completers', function () {
    [$retro, $item] = subtaskBoardItem();
    [$assignee] = retroMember($retro);
    [$stranger] = retroMember($retro);
    $item->update(['assignee_user_id' => $assignee->id]);
    $subtask = ActionItemSubtask::factory()->create(['action_item_id' => $item->id]);

    $this->actingAs($assignee)->postJson(route('retros.action-items.subtasks.store', [$retro, $item]), ['content' => 'Mine'])->assertForbidden();
    $this->actingAs($assignee)->patchJson(route('retros.action-items.subtasks.update', [$retro, $subtask]), ['content' => 'Renamed'])->assertForbidden();
    $this->actingAs($assignee)->deleteJson(route('retros.action-items.subtasks.destroy', [$retro, $subtask]))->assertForbidden();
    $this->actingAs($stranger)->patchJson(route('retros.action-items.subtasks.update', [$retro, $subtask]), ['status' => 'completed'])->assertForbidden();
    $this->actingAs($assignee)
        ->patchJson(route('retros.action-items.subtasks.update', [$retro, $subtask]), ['status' => 'completed'])
        ->assertOk()
        ->assertJsonPath('actionItem.subtasks.0.isCompleted', true);
});

it('validates the content and allows twenty sub-tasks', function () {
    [$retro, $item, $user] = subtaskBoardItem();
    $route = route('retros.action-items.subtasks.store', [$retro, $item]);

    $this->actingAs($user)->postJson($route, ['content' => ''])->assertUnprocessable()->assertJsonValidationErrors('content');
    $this->actingAs($user)->postJson($route, ['content' => str_repeat('a', 201)])->assertUnprocessable()->assertJsonValidationErrors('content');

    ActionItemSubtask::factory()->count(20)
        ->state(new Sequence(fn (Sequence $sequence) => ['position' => $sequence->index]))
        ->create(['action_item_id' => $item->id]);

    $this->actingAs($user)
        ->postJson($route, ['content' => 'One too many'])
        ->assertUnprocessable()
        ->assertJsonPath('errors.content.0', 'An action item can have at most 20 sub-tasks.');
});

it('follows the board phase and lock rules', function () {
    [$votingRetro, $votingItem, $votingUser] = subtaskBoardItem(RetroPhase::Voting);
    [$lockedRetro, $lockedItem, $lockedUser] = subtaskBoardItem(RetroPhase::Discussing, ['is_locked' => true]);

    $this->actingAs($votingUser)
        ->postJson(route('retros.action-items.subtasks.store', [$votingRetro, $votingItem]), ['content' => 'Too early'])
        ->assertForbidden();
    $this->actingAs($lockedUser)
        ->postJson(route('retros.action-items.subtasks.store', [$lockedRetro, $lockedItem]), ['content' => 'Locked'])
        ->assertStatus(423);
});

it('changes sub-tasks from the workspace in any phase', function () {
    [$retro, $item, $user] = subtaskBoardItem(RetroPhase::Completed);
    $workspace = $retro->team->workspace;

    $id = $this->actingAs($user)
        ->postJson(route('workspaces.actionItemSubtasks.store', ['workspace' => $workspace, 'actionItem' => $item]), ['content' => 'Follow up'])
        ->assertCreated()
        ->json('actionItem.subtasks.0.id');

    $this->actingAs($user)
        ->patchJson(route('workspaces.actionItemSubtasks.update', ['workspace' => $workspace, 'actionItemSubtask' => $id]), ['status' => 'completed'])
        ->assertOk()
        ->assertJsonPath('actionItem.subtasks.0.isCompleted', true);
    $this->actingAs($user)
        ->deleteJson(route('workspaces.actionItemSubtasks.destroy', ['workspace' => $workspace, 'actionItemSubtask' => $id]))
        ->assertOk()
        ->assertJsonCount(0, 'actionItem.subtasks');
});

it('returns 404 for sub-tasks of other items or invisible teams', function () {
    [$retro, $item, $user] = subtaskBoardItem();
    $foreign = ActionItemSubtask::factory()->create();
    $own = ActionItemSubtask::factory()->create(['action_item_id' => $item->id]);
    $outsider = teamMember(Team::factory()->create(['workspace_id' => $retro->team->workspace_id]));

    $this->actingAs($user)
        ->patchJson(route('retros.action-items.subtasks.update', [$retro, $foreign]), ['status' => 'completed'])
        ->assertNotFound();
    $this->actingAs($outsider)
        ->patchJson(route('workspaces.actionItemSubtasks.update', ['workspace' => $retro->team->workspace, 'actionItemSubtask' => $own]), ['status' => 'completed'])
        ->assertNotFound();
});

it('leaves sub-tasks alone when the item is completed and deletes them with it', function () {
    [$retro, $item, $user] = subtaskBoardItem();
    ActionItemSubtask::factory()->count(2)
        ->state(new Sequence(fn (Sequence $sequence) => ['position' => $sequence->index]))
        ->create(['action_item_id' => $item->id]);

    $this->actingAs($user)
        ->patchJson(route('retros.action-items.update', [$retro, $item]), ['status' => 'completed'])
        ->assertOk()
        ->assertJsonPath('actionItem.subtasks.0.isCompleted', false)
        ->assertJsonPath('actionItem.subtasks.1.isCompleted', false);

    $item->delete();

    expect(ActionItemSubtask::count())->toBe(0);
});
```

In `tests/Feature/ActionItems/PresentActionItemTest.php` (test "presents every field of a board item") add `'subtasks' => [],` right after `'themeName' => null,`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems/SubtasksTest.php`
Expected: FAIL with `Class "App\Models\ActionItemSubtask" not found`.

- [ ] **Step 3: Migration, model, factory, relations**

`database/migrations/2026_10_02_100200_create_action_item_subtasks_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('action_item_subtasks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('action_item_id')->constrained()->cascadeOnDelete();
            $table->string('content', 200);
            $table->unsignedInteger('position');
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->index(['action_item_id', 'position']);
        });
    }
};
```

`app/Models/ActionItemSubtask.php`:

```php
<?php

namespace App\Models;

use Database\Factories\ActionItemSubtaskFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $action_item_id
 * @property string $content
 * @property int $position
 * @property Carbon|null $completed_at
 * @property-read ActionItem $actionItem
 */
#[Fillable(['content', 'position', 'completed_at'])]
class ActionItemSubtask extends Model
{
    /** @use HasFactory<ActionItemSubtaskFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<ActionItem, $this> */
    public function actionItem(): BelongsTo
    {
        return $this->belongsTo(ActionItem::class);
    }

    public function isCompleted(): bool
    {
        return $this->completed_at !== null;
    }

    protected function casts(): array
    {
        return [
            'position' => 'integer',
            'completed_at' => 'datetime',
        ];
    }
}
```

`database/factories/ActionItemSubtaskFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\ActionItem;
use App\Models\ActionItemSubtask;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ActionItemSubtask>
 */
class ActionItemSubtaskFactory extends Factory
{
    public function definition(): array
    {
        return [
            'action_item_id' => ActionItem::factory(),
            'content' => fake()->words(3, true),
            'position' => 0,
        ];
    }

    public function completed(): static
    {
        return $this->state(fn () => ['completed_at' => now()]);
    }
}
```

In `app/Models/ActionItem.php`:
- add `'subtasks'` at the end of the `presentationRelations()` array;
- add the relation:

```php
    /** @return HasMany<ActionItemSubtask, $this> */
    public function subtasks(): HasMany
    {
        return $this->hasMany(ActionItemSubtask::class)->orderBy('position');
    }
```

In `app/Models/Retro.php`, after `actionItemComments()`:

```php
    /** @return HasManyThrough<ActionItemSubtask, ActionItem, $this> */
    public function actionItemSubtasks(): HasManyThrough
    {
        return $this->hasManyThrough(ActionItemSubtask::class, ActionItem::class);
    }
```

In `database/factories/ActionItemFactory.php` add `use App\Models\ActionItemSubtask;` and `use Illuminate\Database\Eloquent\Factories\Sequence;` and:

```php
    public function withSubtasks(int $count): static
    {
        return $this->has(
            ActionItemSubtask::factory()->count($count)->state(new Sequence(fn (Sequence $sequence) => ['position' => $sequence->index])),
            'subtasks',
        );
    }
```

- [ ] **Step 4: Present sub-tasks**

In `app/Actions/Retros/PresentActionItem.php` add `use App\Models\ActionItemSubtask;`, add to the array-shape docblock after `themeName: ?string,` the line `subtasks: array<int, array{id: string, content: string, isCompleted: bool, position: int}>,`, and to the returned array after `'themeName' => $item->theme_name,`:

```php
            'subtasks' => $item->subtasks
                ->map(fn (ActionItemSubtask $subtask) => [
                    'id' => $subtask->id,
                    'content' => $subtask->content,
                    'isCompleted' => $subtask->isCompleted(),
                    'position' => $subtask->position,
                ])
                ->values()
                ->all(),
```

- [ ] **Step 5: Actions**

`app/Actions/ActionItems/ActionItemSubtaskRules.php`:

```php
<?php

namespace App\Actions\ActionItems;

use App\Enums\ActionItemStatus;
use Illuminate\Validation\Rule;

class ActionItemSubtaskRules
{
    /**
     * @return array<string, array<int, mixed>>
     */
    public static function create(): array
    {
        return ['content' => ['required', 'string', 'max:200']];
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public static function update(): array
    {
        return [
            'content' => ['sometimes', 'required', 'string', 'max:200'],
            'status' => ['sometimes', 'required', Rule::enum(ActionItemStatus::class)],
            'position' => ['sometimes', 'required', 'integer', 'min:0', 'max:19'],
        ];
    }
}
```

`app/Actions/ActionItems/RenumberActionItemSubtasks.php`:

```php
<?php

namespace App\Actions\ActionItems;

use App\Models\ActionItemSubtask;

/**
 * Keeps positions contiguous (0…n-1) so a new sub-task is appended at
 * position = count.
 */
class RenumberActionItemSubtasks
{
    public function move(ActionItemSubtask $subtask, int $position): void
    {
        $orderedIds = $this->orderedIds($subtask->action_item_id, $subtask->id);

        array_splice($orderedIds, min($position, count($orderedIds)), 0, [$subtask->id]);

        $this->apply($orderedIds);
    }

    public function compact(string $actionItemId): void
    {
        $this->apply($this->orderedIds($actionItemId));
    }

    /**
     * @return array<int, string>
     */
    private function orderedIds(string $actionItemId, ?string $exceptId = null): array
    {
        /** @var array<int, string> $ids */
        $ids = ActionItemSubtask::query()
            ->where('action_item_id', $actionItemId)
            ->when($exceptId !== null, fn ($query) => $query->whereKeyNot($exceptId))
            ->orderBy('position')
            ->orderBy('created_at')
            ->pluck('id')
            ->all();

        return $ids;
    }

    /**
     * @param  array<int, string>  $orderedIds
     */
    private function apply(array $orderedIds): void
    {
        foreach ($orderedIds as $position => $id) {
            ActionItemSubtask::query()->whereKey($id)->update(['position' => $position]);
        }
    }
}
```

`app/Actions/ActionItems/AddActionItemSubtask.php`:

```php
<?php

namespace App\Actions\ActionItems;

use App\Models\ActionItem;
use App\Models\ActionItemSubtask;
use Illuminate\Validation\ValidationException;

class AddActionItemSubtask
{
    public const Limit = 20;

    public function __construct(
        private ActionItemPermissions $permissions,
        private BroadcastActionItemChange $broadcastActionItemChange,
    ) {}

    public function handle(ActionItem $locked, ActionItemActor $actor, string $content): ActionItem
    {
        $this->permissions->authorizeEdit($locked, $actor);

        $count = ActionItemSubtask::query()->where('action_item_id', $locked->id)->count();

        if ($count >= self::Limit) {
            throw ValidationException::withMessages([
                'content' => __('An action item can have at most 20 sub-tasks.'),
            ]);
        }

        $locked->subtasks()->create(['content' => $content, 'position' => $count]);
        $locked->touch();

        $this->broadcastActionItemChange->saved($locked);

        return $locked;
    }
}
```

`app/Actions/ActionItems/UpdateActionItemSubtask.php`:

```php
<?php

namespace App\Actions\ActionItems;

use App\Enums\ActionItemStatus;
use App\Models\ActionItem;
use App\Models\ActionItemSubtask;

class UpdateActionItemSubtask
{
    public function __construct(
        private ActionItemPermissions $permissions,
        private RenumberActionItemSubtasks $renumberActionItemSubtasks,
        private BroadcastActionItemChange $broadcastActionItemChange,
    ) {}

    /**
     * Text and order need edit rights; ticking needs completion rights.
     * Checking every sub-task never completes the item.
     *
     * @param  array<string, mixed>  $validated  the output of ActionItemSubtaskRules::update()
     */
    public function handle(ActionItem $locked, ActionItemSubtask $subtask, ActionItemActor $actor, array $validated): ActionItem
    {
        if ($validated === []) {
            return $locked->loadForPresentation();
        }

        if (array_key_exists('content', $validated) || array_key_exists('position', $validated)) {
            $this->permissions->authorizeEdit($locked, $actor);
        }

        if (array_key_exists('status', $validated)) {
            $this->permissions->authorizeComplete($locked, $actor);
        }

        if (array_key_exists('content', $validated)) {
            $subtask->fill(['content' => (string) $validated['content']]);
        }

        if (array_key_exists('status', $validated)) {
            $subtask->fill(['completed_at' => $validated['status'] === ActionItemStatus::Completed->value
                ? ($subtask->completed_at ?? now())
                : null]);
        }

        $subtask->save();

        if (array_key_exists('position', $validated)) {
            $this->renumberActionItemSubtasks->move($subtask, (int) $validated['position']);
        }

        $locked->touch();

        $this->broadcastActionItemChange->saved($locked);

        return $locked;
    }
}
```

`app/Actions/ActionItems/DeleteActionItemSubtask.php`:

```php
<?php

namespace App\Actions\ActionItems;

use App\Models\ActionItem;
use App\Models\ActionItemSubtask;

class DeleteActionItemSubtask
{
    public function __construct(
        private ActionItemPermissions $permissions,
        private RenumberActionItemSubtasks $renumberActionItemSubtasks,
        private BroadcastActionItemChange $broadcastActionItemChange,
    ) {}

    public function handle(ActionItem $locked, ActionItemSubtask $subtask, ActionItemActor $actor): ActionItem
    {
        $this->permissions->authorizeEdit($locked, $actor);

        $subtask->delete();

        $this->renumberActionItemSubtasks->compact($locked->id);

        $locked->touch();

        $this->broadcastActionItemChange->saved($locked);

        return $locked;
    }
}
```

- [ ] **Step 6: Controllers and routes**

`app/Http/Controllers/Retros/ActionItemSubtasksController.php`:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ActionItemSubtaskRules;
use App\Actions\ActionItems\AddActionItemSubtask;
use App\Actions\ActionItems\DeleteActionItemSubtask;
use App\Actions\ActionItems\UpdateActionItemSubtask;
use App\Actions\Retros\PresentActionItem;
use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Http\Controllers\Controller;
use App\Models\ActionItem;
use App\Models\ActionItemSubtask;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ActionItemSubtasksController extends Controller
{
    public function __construct(
        private PresentActionItem $presentActionItem,
        private AddActionItemSubtask $addActionItemSubtask,
        private UpdateActionItemSubtask $updateActionItemSubtask,
        private DeleteActionItemSubtask $deleteActionItemSubtask,
    ) {}

    public function store(Request $request, Retro $retro, ActionItem $actionItem): JsonResponse
    {
        $actor = ActionItemActor::forParticipant(Participant::current($request));

        $this->guard($retro);

        $validated = $request->validate(ActionItemSubtaskRules::create());

        $item = DB::transaction(fn (): ActionItem => $this->addActionItemSubtask->handle(
            $this->lockItem($retro, $actionItem->id),
            $actor,
            $validated['content'],
        ));

        return response()->json(['actionItem' => $this->presentActionItem->handle($item, $actor)], 201);
    }

    public function update(Request $request, Retro $retro, ActionItemSubtask $actionItemSubtask): JsonResponse
    {
        $actor = ActionItemActor::forParticipant(Participant::current($request));

        $this->guard($retro);

        $validated = $request->validate(ActionItemSubtaskRules::update());

        $item = DB::transaction(function () use ($retro, $actionItemSubtask, $actor, $validated): ActionItem {
            $locked = $this->lockItem($retro, $actionItemSubtask->action_item_id);

            return $this->updateActionItemSubtask->handle(
                $locked,
                $locked->subtasks()->whereKey($actionItemSubtask->id)->firstOrFail(),
                $actor,
                $validated,
            );
        });

        return response()->json(['actionItem' => $this->presentActionItem->handle($item, $actor)]);
    }

    public function destroy(Request $request, Retro $retro, ActionItemSubtask $actionItemSubtask): JsonResponse
    {
        $actor = ActionItemActor::forParticipant(Participant::current($request));

        $this->guard($retro);

        $item = DB::transaction(function () use ($retro, $actionItemSubtask, $actor): ActionItem {
            $locked = $this->lockItem($retro, $actionItemSubtask->action_item_id);

            return $this->deleteActionItemSubtask->handle(
                $locked,
                $locked->subtasks()->whereKey($actionItemSubtask->id)->firstOrFail(),
                $actor,
            );
        });

        return response()->json(['actionItem' => $this->presentActionItem->handle($item, $actor)]);
    }

    private function guard(Retro $retro): void
    {
        RetroGuard::phase($retro, RetroPhase::Discussing);
        RetroGuard::unlocked($retro);
    }

    private function lockItem(Retro $retro, string $actionItemId): ActionItem
    {
        $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

        $this->guard($locked);

        $item = $locked->actionItems()->whereKey($actionItemId)->lockForUpdate()->firstOrFail();
        $item->setRelation('retro', $locked);

        return $item;
    }
}
```

`app/Http/Controllers/WorkspaceActionItemSubtasksController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ActionItemSubtaskRules;
use App\Actions\ActionItems\AddActionItemSubtask;
use App\Actions\ActionItems\DeleteActionItemSubtask;
use App\Actions\ActionItems\UpdateActionItemSubtask;
use App\Actions\ActionItems\WorkspaceActionItemGuard;
use App\Actions\Retros\PresentActionItem;
use App\Models\ActionItem;
use App\Models\ActionItemSubtask;
use App\Models\Workspace;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WorkspaceActionItemSubtasksController extends Controller
{
    public function __construct(
        private PresentActionItem $presentActionItem,
        private AddActionItemSubtask $addActionItemSubtask,
        private UpdateActionItemSubtask $updateActionItemSubtask,
        private DeleteActionItemSubtask $deleteActionItemSubtask,
    ) {}

    public function store(Request $request, Workspace $workspace, ActionItem $actionItem): JsonResponse
    {
        $user = $request->user();
        $actor = ActionItemActor::forUser($user);

        WorkspaceActionItemGuard::visible($user, $workspace, $actionItem);

        $validated = $request->validate(ActionItemSubtaskRules::create());

        $item = DB::transaction(fn (): ActionItem => $this->addActionItemSubtask->handle(
            $this->lockItem($actionItem->id),
            $actor,
            $validated['content'],
        ));

        return response()->json(['actionItem' => $this->presentActionItem->handle($item, $actor)], 201);
    }

    public function update(Request $request, Workspace $workspace, ActionItemSubtask $actionItemSubtask): JsonResponse
    {
        $user = $request->user();
        $actor = ActionItemActor::forUser($user);

        WorkspaceActionItemGuard::visible($user, $workspace, $actionItemSubtask->actionItem);

        $validated = $request->validate(ActionItemSubtaskRules::update());

        $item = DB::transaction(function () use ($actionItemSubtask, $actor, $validated): ActionItem {
            $locked = $this->lockItem($actionItemSubtask->action_item_id);

            return $this->updateActionItemSubtask->handle(
                $locked,
                $locked->subtasks()->whereKey($actionItemSubtask->id)->firstOrFail(),
                $actor,
                $validated,
            );
        });

        return response()->json(['actionItem' => $this->presentActionItem->handle($item, $actor)]);
    }

    public function destroy(Request $request, Workspace $workspace, ActionItemSubtask $actionItemSubtask): JsonResponse
    {
        $user = $request->user();
        $actor = ActionItemActor::forUser($user);

        WorkspaceActionItemGuard::visible($user, $workspace, $actionItemSubtask->actionItem);

        $item = DB::transaction(function () use ($actionItemSubtask, $actor): ActionItem {
            $locked = $this->lockItem($actionItemSubtask->action_item_id);

            return $this->deleteActionItemSubtask->handle(
                $locked,
                $locked->subtasks()->whereKey($actionItemSubtask->id)->firstOrFail(),
                $actor,
            );
        });

        return response()->json(['actionItem' => $this->presentActionItem->handle($item, $actor)]);
    }

    private function lockItem(string $actionItemId): ActionItem
    {
        $locked = ActionItem::query()->whereKey($actionItemId)->lockForUpdate()->firstOrFail();

        WorkspaceActionItemGuard::writable($locked);

        return $locked;
    }
}
```

In `routes/web.php` add `use App\Http\Controllers\Retros\ActionItemSubtasksController;` and `use App\Http\Controllers\WorkspaceActionItemSubtasksController;`. In the `retros/{retro}` group, after the action item comment routes:

```php
        Route::post('action-items/{actionItem}/subtasks', [ActionItemSubtasksController::class, 'store'])->name('retros.action-items.subtasks.store')->whereUuid('actionItem');
        Route::patch('action-item-subtasks/{actionItemSubtask}', [ActionItemSubtasksController::class, 'update'])->name('retros.action-items.subtasks.update')->whereUuid('actionItemSubtask');
        Route::delete('action-item-subtasks/{actionItemSubtask}', [ActionItemSubtasksController::class, 'destroy'])->name('retros.action-items.subtasks.destroy')->whereUuid('actionItemSubtask');
```

In the `w/{workspace}` group, after the action item comment routes:

```php
            Route::post('action-items/{actionItem}/subtasks', [WorkspaceActionItemSubtasksController::class, 'store'])->name('workspaces.actionItemSubtasks.store')->whereUuid('actionItem');
            Route::patch('action-item-subtasks/{actionItemSubtask}', [WorkspaceActionItemSubtasksController::class, 'update'])->name('workspaces.actionItemSubtasks.update')->whereUuid('actionItemSubtask')->withoutScopedBindings();
            Route::delete('action-item-subtasks/{actionItemSubtask}', [WorkspaceActionItemSubtasksController::class, 'destroy'])->name('workspaces.actionItemSubtasks.destroy')->whereUuid('actionItemSubtask')->withoutScopedBindings();
```

Then run `vendor/bin/sail artisan wayfinder:generate --with-form`.

- [ ] **Step 7: Translations**

| Key | fr | es | de |
|---|---|---|---|
| `An action item can have at most 20 sub-tasks.` | `Une action peut avoir au plus 20 sous-tâches.` | `Una acción puede tener como máximo 20 subtareas.` | `Ein Aktionspunkt kann höchstens 20 Unteraufgaben haben.` |

- [ ] **Step 8: Run tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems tests/Feature/Retros/ActionItemsTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 9: Pint, phpstan, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add database/migrations/2026_10_02_100200_create_action_item_subtasks_table.php app/Models database/factories app/Actions/ActionItems app/Actions/Retros/PresentActionItem.php app/Http/Controllers/Retros/ActionItemSubtasksController.php app/Http/Controllers/WorkspaceActionItemSubtasksController.php routes/web.php tests/Feature/ActionItems lang
git commit -m "feat: give action items a checklist of sub-tasks

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 4: Recurring action items

**Files:**
- Create: `app/Enums/ActionItemRecurrence.php`, `app/Actions/ActionItems/CreateNextOccurrence.php`
- Modify: `app/Models/ActionItem.php`, `database/factories/ActionItemFactory.php`, `app/Actions/ActionItems/ActionItemRules.php`, `app/Actions/ActionItems/CreateActionItem.php`, `app/Actions/ActionItems/UpdateActionItem.php`, `app/Actions/ActionItems/SetActionItemStatus.php`, `app/Actions/Retros/PresentActionItem.php`, `tests/Feature/ActionItems/PresentActionItemTest.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/ActionItems/RecurrenceTest.php`

**Interfaces:**
- Consumes: Task 3 `subtasks()`; Plan 9a `CreateActionItem`, `UpdateActionItem`, `SetActionItemStatus`, `ActionItemRules`, `PresentActionItem`.
- Produces: `App\Enums\ActionItemRecurrence` (`Weekly`, `EveryTwoWeeks`, `Monthly`; `advance(CarbonInterface $date): CarbonImmutable`, `label(): string`); `ActionItem::$recurrence` cast to the enum, `previousOccurrence(): BelongsTo`, `nextOccurrence(): HasOne`; factory state `recurring(ActionItemRecurrence $recurrence)`; request field `recurrence` (nullable enum) on board and workspace create/update; `CreateActionItem` attributes also accept `recurrence`, `previous_occurrence_id`, `theme_name` (used only when no theme model is given) and `subtasks` (list of contents, created unchecked in order) and refuses a recurrence without due date; `UpdateActionItem` refuses a recurring item without due date (error on `due_on` when the request cleared it, else on `recurrence`); `CreateNextOccurrence::handle(ActionItem $completed): ?ActionItem`, called by `SetActionItemStatus` whenever an item becomes completed; payload keys `recurrence` and `previousOccurrenceId` (after `themeName`, before `subtasks`).

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/ActionItems/RecurrenceTest.php`:

```php
<?php

use App\Actions\ActionItems\ActionItemActor;
use App\Actions\ActionItems\ExternalSyncActor;
use App\Actions\ActionItems\SetActionItemStatus;
use App\Enums\ActionItemPriority;
use App\Enums\ActionItemRecurrence;
use App\Enums\ActionItemStatus;
use App\Enums\RetroPhase;
use App\Events\ActionItems\ActionItemCreated;
use App\Events\ActionItems\TeamActionItemSaved;
use App\Models\ActionItem;
use App\Models\ActionItemComment;
use App\Models\ActionItemSubtask;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

beforeEach(function () {
    Event::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-10 09:00:00'));
});

/**
 * @param  array<string, mixed>  $attributes
 * @return array{0: Team, 1: User, 2: ActionItem}
 */
function recurringTeamItem(ActionItemRecurrence $recurrence = ActionItemRecurrence::Weekly, array $attributes = []): array
{
    $team = Team::factory()->create();
    $author = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $author)->recurring($recurrence)->create(['due_on' => '2026-10-09', ...$attributes]);

    return [$team, $author, $item];
}

function setStatusFromWorkspace(TestCase $test, User $user, ActionItem $item, string $status): TestResponse
{
    return $test->actingAs($user)->patchJson(
        route('workspaces.actionItems.update', ['workspace' => $item->team->workspace, 'actionItem' => $item]),
        ['status' => $status],
    );
}

it('needs a due date for a recurring item', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroMember($retro);
    $team = $retro->team;

    $this->actingAs($user)
        ->postJson(route('retros.action-items.store', $retro), ['content' => 'Weekly sync', 'recurrence' => 'weekly'])
        ->assertUnprocessable()
        ->assertJsonPath('errors.recurrence.0', 'A recurring action item needs a due date.');

    $id = $this->actingAs($user)
        ->postJson(route('retros.action-items.store', $retro), ['content' => 'Weekly sync', 'recurrence' => 'weekly', 'due_on' => '2026-10-16'])
        ->assertCreated()
        ->assertJsonPath('actionItem.recurrence', 'weekly')
        ->json('actionItem.id');

    $this->actingAs($user)
        ->patchJson(route('retros.action-items.update', [$retro, $id]), ['due_on' => null])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('due_on');
    $this->actingAs($user)
        ->postJson(route('workspaces.actionItems.store', $team->workspace), ['team_id' => $team->id, 'content' => 'Monthly report', 'recurrence' => 'monthly'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('recurrence');
    $this->actingAs($user)
        ->postJson(route('workspaces.actionItems.store', $team->workspace), ['team_id' => $team->id, 'content' => 'Daily', 'recurrence' => 'daily', 'due_on' => '2026-10-16'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('recurrence');
});

it('keeps the recurrence to managers', function () {
    [$team, $author, $item] = recurringTeamItem();
    $assignee = teamMember($team);
    $item->update(['assignee_user_id' => $assignee->id]);
    $route = route('workspaces.actionItems.update', ['workspace' => $team->workspace, 'actionItem' => $item]);

    $this->actingAs($assignee)->patchJson($route, ['recurrence' => 'monthly'])->assertForbidden();
    $this->actingAs($author)->patchJson($route, ['recurrence' => 'monthly'])->assertOk()->assertJsonPath('actionItem.recurrence', 'monthly');
});

it('creates exactly one next occurrence', function () {
    [$team, $author, $item] = recurringTeamItem(ActionItemRecurrence::Weekly, [
        'content' => 'Water the plants',
        'priority' => ActionItemPriority::High,
        'theme_name' => 'Office',
    ]);
    $assignee = teamMember($team);
    $item->update(['assignee_user_id' => $assignee->id]);
    ActionItemSubtask::factory()->completed()->create(['action_item_id' => $item->id, 'content' => 'Kitchen', 'position' => 0]);
    ActionItemSubtask::factory()->create(['action_item_id' => $item->id, 'content' => 'Lobby', 'position' => 1]);
    ActionItemComment::factory()->create(['action_item_id' => $item->id]);

    setStatusFromWorkspace($this, $author, $item, 'completed')->assertOk();
    setStatusFromWorkspace($this, $author, $item, 'open')->assertOk();
    setStatusFromWorkspace($this, $author, $item, 'completed')->assertOk();

    $next = ActionItem::query()->where('previous_occurrence_id', $item->id)->sole();

    expect($next->only(['team_id', 'retro_id', 'content', 'assignee_user_id', 'created_by_user_id', 'theme_name']))->toBe([
        'team_id' => $team->id,
        'retro_id' => null,
        'content' => 'Water the plants',
        'assignee_user_id' => $assignee->id,
        'created_by_user_id' => $author->id,
        'theme_name' => 'Office',
    ])
        ->and($next->priority)->toBe(ActionItemPriority::High)
        ->and($next->recurrence)->toBe(ActionItemRecurrence::Weekly)
        ->and($next->due_on?->toDateString())->toBe('2026-10-16')
        ->and($next->completed_at)->toBeNull()
        ->and($next->subtasks->map(fn (ActionItemSubtask $subtask) => [$subtask->content, $subtask->position, $subtask->completed_at])->all())
        ->toBe([['Kitchen', 0, null], ['Lobby', 1, null]])
        ->and($next->comments()->count())->toBe(0)
        ->and(ActionItem::count())->toBe(2);

    Event::assertDispatched(ActionItemCreated::class, fn (ActionItemCreated $event) => $event->actionItem->is($next));
    Event::assertDispatched(TeamActionItemSaved::class, fn (TeamActionItemSaved $event) => $event->actionItem['id'] === $next->id
        && $event->actionItem['previousOccurrenceId'] === $item->id
        && $event->actionItem['retroId'] === null
        && $event->actionItem['recurrence'] === 'weekly');
});

it('advances the due date until it is not overdue', function (ActionItemRecurrence $recurrence, string $dueOn, string $nextDueOn) {
    [, $author, $item] = recurringTeamItem($recurrence, ['due_on' => $dueOn]);

    setStatusFromWorkspace($this, $author, $item, 'completed')->assertOk();

    expect($item->nextOccurrence()->sole()->due_on?->toDateString())->toBe($nextDueOn);
})->with([
    'weekly, three weeks late' => [ActionItemRecurrence::Weekly, '2026-09-18', '2026-10-16'],
    'every two weeks, late' => [ActionItemRecurrence::EveryTwoWeeks, '2026-09-01', '2026-10-13'],
    'monthly, landing on today' => [ActionItemRecurrence::Monthly, '2026-08-10', '2026-10-10'],
    'weekly, completed early' => [ActionItemRecurrence::Weekly, '2026-10-20', '2026-10-27'],
]);

it('clamps monthly recurrences to the end of the month', function () {
    [, $author, $item] = recurringTeamItem(ActionItemRecurrence::Monthly, ['due_on' => '2027-01-31']);

    setStatusFromWorkspace($this, $author, $item, 'completed')->assertOk();

    expect($item->nextOccurrence()->sole()->due_on?->toDateString())->toBe('2027-02-28');
});

it('drops guest and former member assignees from the next occurrence', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->withGuestAccess()->create();
    [, $author] = retroMember($retro);
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
    $guestItem = ActionItem::factory()->assignedToGuest($guest)->recurring(ActionItemRecurrence::Weekly)
        ->create(['created_by_participant_id' => $author->id]);
    [$team, $teamAuthor, $memberItem] = recurringTeamItem();
    $leaver = teamMember($team);
    $memberItem->update(['assignee_user_id' => $leaver->id]);
    $team->members()->detach($leaver);
    $complete = app(SetActionItemStatus::class);

    $complete->handle($guestItem, ActionItemActor::forParticipant($author), ActionItemStatus::Completed);
    $complete->handle($memberItem->fresh(), ActionItemActor::forUser($teamAuthor), ActionItemStatus::Completed);

    expect($guestItem->nextOccurrence()->sole()->only(['assignee_user_id', 'assignee_participant_id', 'retro_id', 'created_by_participant_id']))->toBe([
        'assignee_user_id' => null,
        'assignee_participant_id' => null,
        'retro_id' => null,
        'created_by_participant_id' => $author->id,
    ])
        ->and($memberItem->nextOccurrence()->sole()->assignee_user_id)->toBeNull();
});

it('stops the series when the item no longer repeats', function () {
    [$team, $author, $item] = recurringTeamItem();

    $this->actingAs($author)
        ->patchJson(route('workspaces.actionItems.update', ['workspace' => $team->workspace, 'actionItem' => $item]), ['recurrence' => null])
        ->assertOk()
        ->assertJsonPath('actionItem.recurrence', null);
    setStatusFromWorkspace($this, $author, $item, 'completed')->assertOk();

    expect(ActionItem::count())->toBe(1);
});

it('regenerates when the external sync completes the item', function () {
    [, , $item] = recurringTeamItem();

    app(SetActionItemStatus::class)->handle($item, new ExternalSyncActor('jira', 'PROJ-7'), ActionItemStatus::Completed);

    expect($item->nextOccurrence()->exists())->toBeTrue();
});
```

In `tests/Feature/ActionItems/PresentActionItemTest.php` (test "presents every field of a board item") add `'recurrence' => null,` and `'previousOccurrenceId' => null,` right after `'themeName' => null,` (before `'subtasks' => [],`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems/RecurrenceTest.php`
Expected: FAIL with `Class "App\Enums\ActionItemRecurrence" not found`.

- [ ] **Step 3: Enum, model, factory**

`app/Enums/ActionItemRecurrence.php`:

```php
<?php

namespace App\Enums;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

enum ActionItemRecurrence: string
{
    case Weekly = 'weekly';
    case EveryTwoWeeks = 'every_two_weeks';
    case Monthly = 'monthly';

    /**
     * Monthly adds one calendar month, clamped to the last day of the
     * target month (31 January → 28 February).
     */
    public function advance(CarbonInterface $date): CarbonImmutable
    {
        $date = CarbonImmutable::instance($date);

        return match ($this) {
            self::Weekly => $date->addWeek(),
            self::EveryTwoWeeks => $date->addWeeks(2),
            self::Monthly => $date->addMonthNoOverflow(),
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::Weekly => __('Repeats weekly'),
            self::EveryTwoWeeks => __('Repeats every 2 weeks'),
            self::Monthly => __('Repeats monthly'),
        };
    }
}
```

In `app/Models/ActionItem.php`:
- add `use App\Enums\ActionItemRecurrence;` and `use Illuminate\Database\Eloquent\Relations\HasOne;`;
- in the docblock replace `@property string|null $recurrence` with `@property ActionItemRecurrence|null $recurrence`;
- add `'recurrence' => ActionItemRecurrence::class,` to `casts()`;
- add the relations:

```php
    /** @return BelongsTo<ActionItem, $this> */
    public function previousOccurrence(): BelongsTo
    {
        return $this->belongsTo(self::class, 'previous_occurrence_id');
    }

    /** @return HasOne<ActionItem, $this> */
    public function nextOccurrence(): HasOne
    {
        return $this->hasOne(self::class, 'previous_occurrence_id');
    }
```

In `database/factories/ActionItemFactory.php` add `use App\Enums\ActionItemRecurrence;` and:

```php
    public function recurring(ActionItemRecurrence $recurrence): static
    {
        return $this->state(fn (array $attributes) => [
            'recurrence' => $recurrence,
            'due_on' => $attributes['due_on'] ?? ActionItem::today()->addWeek()->toDateString(),
        ]);
    }
```

- [ ] **Step 4: Validation and creation**

In `app/Actions/ActionItems/ActionItemRules.php` add `use App\Enums\ActionItemRecurrence;`, add to `optionalFields()`:

```php
            'recurrence' => ['sometimes', 'nullable', Rule::enum(ActionItemRecurrence::class)],
```

and replace the key list of `attributes()` with `['content', 'priority', 'due_on', 'recurrence']`.

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
use Illuminate\Validation\ValidationException;

class CreateActionItem
{
    public function __construct(private BroadcastActionItemChange $broadcastActionItemChange) {}

    /**
     * Callers authorize: board participants while discussing, promotions
     * through SuggestionGuard, team members outside a retro, and
     * CreateNextOccurrence for recurring successors.
     *
     * @param  array<string, mixed>  $attributes  content, and optionally priority, due_on, recurrence, assignee_user_id, assignee_participant_id; from the system only: previous_occurrence_id, theme_name, subtasks
     */
    public function handle(Team $team, ?Retro $retro, ActionItemActor $author, array $attributes, ?RetroTheme $theme = null): ActionItem
    {
        $recurrence = $attributes['recurrence'] ?? null;
        $dueOn = $attributes['due_on'] ?? null;

        if ($recurrence !== null && $dueOn === null) {
            throw ValidationException::withMessages([
                'recurrence' => __('A recurring action item needs a due date.'),
            ]);
        }

        $actionItem = ActionItem::query()->create([
            'team_id' => $team->id,
            'retro_id' => $retro?->id,
            'content' => $attributes['content'],
            'priority' => $attributes['priority'] ?? ActionItemPriority::Medium->value,
            'due_on' => $dueOn,
            'recurrence' => $recurrence,
            'previous_occurrence_id' => $attributes['previous_occurrence_id'] ?? null,
            'assignee_user_id' => $attributes['assignee_user_id'] ?? null,
            'assignee_participant_id' => $attributes['assignee_participant_id'] ?? null,
            'created_by_participant_id' => $author->participant?->id,
            'created_by_user_id' => $author->user?->id,
            'theme_id' => $theme?->id,
            'theme_name' => $theme?->name ?? $attributes['theme_name'] ?? null,
        ]);

        /** @var array<int, string> $subtasks */
        $subtasks = $attributes['subtasks'] ?? [];

        foreach (array_values($subtasks) as $position => $content) {
            $actionItem->subtasks()->create(['content' => $content, 'position' => $position]);
        }

        ActionItemCreated::dispatch($actionItem);

        $this->broadcastActionItemChange->saved($actionItem);

        return $actionItem;
    }
}
```

In `app/Actions/ActionItems/UpdateActionItem.php` add `use Illuminate\Validation\ValidationException;` and, right after the `if (! $locked->isDirty()) { … }` block:

```php
        if ($locked->recurrence !== null && $locked->due_on === null) {
            throw ValidationException::withMessages([
                array_key_exists('due_on', $changes) ? 'due_on' : 'recurrence' => __('A recurring action item needs a due date.'),
            ]);
        }
```

- [ ] **Step 5: The next occurrence**

`app/Actions/ActionItems/CreateNextOccurrence.php`:

```php
<?php

namespace App\Actions\ActionItems;

use App\Enums\ActionItemRecurrence;
use App\Models\ActionItem;
use App\Models\ActionItemSubtask;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

class CreateNextOccurrence
{
    public function __construct(private CreateActionItem $createActionItem) {}

    /**
     * Completion-based: one successor per occurrence (the caller holds the
     * row lock; previous_occurrence_id is unique), due one interval later,
     * moved forward until it is not already overdue, and detached from any
     * retro so completed retros never grow.
     */
    public function handle(ActionItem $completed): ?ActionItem
    {
        if ($completed->recurrence === null || $completed->due_on === null) {
            return null;
        }

        if ($completed->nextOccurrence()->exists()) {
            return null;
        }

        return $this->createActionItem->handle(
            $completed->team,
            null,
            new ActionItemActor($completed->author, $completed->createdByParticipant),
            [
                'content' => $completed->content,
                'priority' => $completed->priority->value,
                'due_on' => $this->nextDueOn($completed->recurrence, $completed->due_on)->toDateString(),
                'recurrence' => $completed->recurrence->value,
                'assignee_user_id' => $this->keptAssignee($completed),
                'previous_occurrence_id' => $completed->id,
                'theme_name' => $completed->theme_name,
                'subtasks' => $completed->subtasks->map(fn (ActionItemSubtask $subtask) => $subtask->content)->values()->all(),
            ],
            $completed->theme,
        );
    }

    private function nextDueOn(ActionItemRecurrence $recurrence, CarbonInterface $dueOn): CarbonImmutable
    {
        $today = ActionItem::today()->toDateString();
        $next = $recurrence->advance(CarbonImmutable::parse($dueOn->toDateString()));

        while ($next->toDateString() < $today) {
            $next = $recurrence->advance($next);
        }

        return $next;
    }

    /**
     * Guests and members who left the team are not carried over.
     */
    private function keptAssignee(ActionItem $completed): ?string
    {
        $userId = $completed->assignee_user_id;

        if ($userId === null) {
            return null;
        }

        return $completed->team->members()->whereKey($userId)->exists() ? $userId : null;
    }
}
```

In `app/Actions/ActionItems/SetActionItemStatus.php` add the constructor parameter `private CreateNextOccurrence $createNextOccurrence,` and, right after `$locked->update(['completed_at' => $completing ? now() : null]);`:

```php
        if ($completing) {
            $this->createNextOccurrence->handle($locked);
        }
```

- [ ] **Step 6: Present the recurrence**

In `app/Actions/Retros/PresentActionItem.php` add to the array-shape docblock after `themeName: ?string,` the lines `recurrence: ?string,` and `previousOccurrenceId: ?string,`, and to the returned array after `'themeName' => $item->theme_name,`:

```php
            'recurrence' => $item->recurrence?->value,
            'previousOccurrenceId' => $item->previous_occurrence_id,
```

- [ ] **Step 7: Translations**

| Key | fr | es | de |
|---|---|---|---|
| `A recurring action item needs a due date.` | `Une action récurrente a besoin d'une échéance.` | `Una acción recurrente necesita una fecha límite.` | `Ein wiederkehrender Aktionspunkt braucht ein Fälligkeitsdatum.` |
| `Repeats weekly` | `Se répète chaque semaine` | `Se repite cada semana` | `Wiederholt sich wöchentlich` |
| `Repeats every 2 weeks` | `Se répète toutes les 2 semaines` | `Se repite cada 2 semanas` | `Wiederholt sich alle 2 Wochen` |
| `Repeats monthly` | `Se répète chaque mois` | `Se repite cada mes` | `Wiederholt sich monatlich` |

- [ ] **Step 8: Run tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems tests/Feature/Retros/ActionItemsTest.php tests/Feature/Retros/SuggestedActionsTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 9: Pint, phpstan, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Enums/ActionItemRecurrence.php app/Actions/ActionItems app/Models/ActionItem.php database/factories/ActionItemFactory.php app/Actions/Retros/PresentActionItem.php tests/Feature/ActionItems lang
git commit -m "feat: repeat action items weekly, every two weeks or monthly

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 5: Reminder storage, preferences and the settings endpoints

**Files:**
- Create: `database/migrations/2026_10_02_100300_create_notifications_table.php`, `database/migrations/2026_10_02_100400_add_notification_preferences_to_users_table.php`, `database/migrations/2026_10_02_100500_create_action_item_reminders_table.php`, `app/Enums/ActionItemReminderKind.php`, `app/Models/ActionItemReminder.php`, `app/Http/Controllers/Settings/NotificationPreferencesController.php`
- Modify: `app/Models/User.php`, `config/skrum.php`, `.env.example`, `routes/settings.php`, `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/Settings/NotificationPreferencesTest.php`

**Interfaces:**
- Consumes: Laravel `Notifiable` (already on `User`).
- Produces: table `notifications` (framework schema with UUID `id`, `uuidMorphs('notifiable')`, `json` `data` so `data->actionItemId` can be queried); `users.action_item_reminders_by_email` / `action_item_reminders_in_app` (booleans, default `true`, fillable, cast); table `action_item_reminders` (unique `action_item_id, user_id, kind, due_on`); `App\Enums\ActionItemReminderKind` (`DueSoon = 'due_soon'`, `Overdue = 'overdue'`); `App\Models\ActionItemReminder` (no timestamps); config `skrum.action_item_reminders.enabled` (`SKRUM_ACTION_ITEM_REMINDERS`, default `true`) and `skrum.action_item_reminders.time` (`SKRUM_ACTION_ITEM_REMINDER_TIME`, default `08:00`); routes `notificationPreferences.edit` (`GET /settings/notifications` → Inertia `settings/notifications` with `preferences {action_item_reminders_by_email, action_item_reminders_in_app}`, `reminderTime`, `remindersEnabled`) and `notificationPreferences.update` (`PATCH /settings/notifications` → redirect back with the flash toast "Notification settings saved.").

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/Settings/NotificationPreferencesTest.php`:

```php
<?php

use App\Enums\ActionItemReminderKind;
use App\Models\ActionItem;
use App\Models\ActionItemReminder;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;

it('turns both reminder channels on by default', function () {
    $user = User::factory()->create()->fresh();

    expect($user->action_item_reminders_by_email)->toBeTrue()
        ->and($user->action_item_reminders_in_app)->toBeTrue();
});

it('shows the notification preferences', function () {
    $user = User::factory()->create();
    $user->forceFill(['action_item_reminders_in_app' => false])->save();

    $this->actingAs($user)
        ->get(route('notificationPreferences.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('settings/notifications', false)
            ->where('preferences', ['action_item_reminders_by_email' => true, 'action_item_reminders_in_app' => false])
            ->where('reminderTime', '08:00')
            ->where('remindersEnabled', true));
});

it('saves the notification preferences', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->from(route('notificationPreferences.edit'))
        ->patch(route('notificationPreferences.update'), [
            'action_item_reminders_by_email' => false,
            'action_item_reminders_in_app' => true,
        ])
        ->assertRedirect(route('notificationPreferences.edit'));

    expect($user->fresh()->only(['action_item_reminders_by_email', 'action_item_reminders_in_app']))
        ->toBe(['action_item_reminders_by_email' => false, 'action_item_reminders_in_app' => true]);
});

it('validates the preferences as booleans', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch(route('notificationPreferences.update'), ['action_item_reminders_by_email' => 'maybe'])
        ->assertSessionHasErrors(['action_item_reminders_by_email', 'action_item_reminders_in_app']);
});

it('logs a reminder once per item, user, kind and due date', function () {
    $item = ActionItem::factory()->create(['due_on' => '2026-10-10']);
    $user = User::factory()->create();
    $row = [
        'action_item_id' => $item->id,
        'user_id' => $user->id,
        'kind' => ActionItemReminderKind::Overdue,
        'due_on' => '2026-10-10',
        'sent_at' => now(),
    ];

    ActionItemReminder::query()->create($row);

    expect(fn () => DB::transaction(fn () => ActionItemReminder::query()->create($row)))->toThrow(QueryException::class)
        ->and(ActionItemReminder::query()->create([...$row, 'due_on' => '2026-10-11'])->exists)->toBeTrue();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Settings/NotificationPreferencesTest.php`
Expected: FAIL (`Route [notificationPreferences.edit] not defined.`, unknown columns).

- [ ] **Step 3: Migrations**

Run `vendor/bin/sail artisan make:notifications-table`, rename the generated file to `database/migrations/2026_10_02_100300_create_notifications_table.php` and replace its content with (UUID morph per parent AC0; `json` data so the reminders can be looked up by item):

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type');
            $table->uuidMorphs('notifiable');
            $table->json('data');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['notifiable_type', 'notifiable_id', 'read_at']);
        });
    }
};
```

`database/migrations/2026_10_02_100400_add_notification_preferences_to_users_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('action_item_reminders_by_email')->default(true);
            $table->boolean('action_item_reminders_in_app')->default(true);
        });
    }
};
```

`database/migrations/2026_10_02_100500_create_action_item_reminders_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('action_item_reminders', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('action_item_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->string('kind');
            $table->date('due_on');
            $table->timestamp('sent_at');

            $table->unique(['action_item_id', 'user_id', 'kind', 'due_on']);
            $table->index('sent_at');
        });
    }
};
```

- [ ] **Step 4: Enum, model, user preferences, config**

`app/Enums/ActionItemReminderKind.php`:

```php
<?php

namespace App\Enums;

enum ActionItemReminderKind: string
{
    case DueSoon = 'due_soon';
    case Overdue = 'overdue';
}
```

`app/Models/ActionItemReminder.php`:

```php
<?php

namespace App\Models;

use App\Enums\ActionItemReminderKind;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/**
 * One row per reminder sent: an item, its assignee, the kind and the due
 * date it was about. A moved due date or a new assignee needs a new row.
 *
 * @property string $id
 * @property string $action_item_id
 * @property string $user_id
 * @property ActionItemReminderKind $kind
 * @property Carbon $due_on
 * @property Carbon $sent_at
 */
#[Fillable(['action_item_id', 'user_id', 'kind', 'due_on', 'sent_at'])]
class ActionItemReminder extends Model
{
    use HasUuids;

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'kind' => ActionItemReminderKind::class,
            'due_on' => 'date',
            'sent_at' => 'datetime',
        ];
    }
}
```

In `app/Models/User.php`:
- add `@property bool $action_item_reminders_by_email` and `@property bool $action_item_reminders_in_app` to the docblock;
- replace the `Fillable` attribute with `#[Fillable(['name', 'email', 'password', 'locale', 'action_item_reminders_by_email', 'action_item_reminders_in_app'])]`;
- add to `casts()`:

```php
            'action_item_reminders_by_email' => 'boolean',
            'action_item_reminders_in_app' => 'boolean',
```

In `config/skrum.php` add before `'trusted_proxies'`:

```php
    'action_item_reminders' => [
        'enabled' => (bool) env('SKRUM_ACTION_ITEM_REMINDERS', true),
        'time' => env('SKRUM_ACTION_ITEM_REMINDER_TIME', '08:00'),
    ],
```

In `.env.example`, after `SKRUM_AVATAR_STYLE=thumbs`, add:

```dotenv
# Daily due-date and overdue reminders for action items, sent at this time
# in APP_TIMEZONE (e-mail digest and notification bell). false turns them off.
SKRUM_ACTION_ITEM_REMINDERS=true
SKRUM_ACTION_ITEM_REMINDER_TIME=08:00
```

- [ ] **Step 5: Settings controller and routes**

`app/Http/Controllers/Settings/NotificationPreferencesController.php`:

```php
<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class NotificationPreferencesController extends Controller
{
    public function edit(Request $request): Response
    {
        $user = $request->user();

        return Inertia::render('settings/notifications', [
            'preferences' => [
                'action_item_reminders_by_email' => $user->action_item_reminders_by_email,
                'action_item_reminders_in_app' => $user->action_item_reminders_in_app,
            ],
            'reminderTime' => (string) config('skrum.action_item_reminders.time'),
            'remindersEnabled' => (bool) config('skrum.action_item_reminders.enabled'),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'action_item_reminders_by_email' => ['required', 'boolean'],
            'action_item_reminders_in_app' => ['required', 'boolean'],
        ]);

        $request->user()->update($validated);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Notification settings saved.')]);

        return back();
    }
}
```

In `routes/settings.php` add `use App\Http\Controllers\Settings\NotificationPreferencesController;` and, in the `['auth', 'verified']` group:

```php
    Route::get('settings/notifications', [NotificationPreferencesController::class, 'edit'])->name('notificationPreferences.edit');
    Route::patch('settings/notifications', [NotificationPreferencesController::class, 'update'])->name('notificationPreferences.update');
```

Run `vendor/bin/sail artisan wayfinder:generate --with-form`.

- [ ] **Step 6: Translations**

| Key | fr | es | de |
|---|---|---|---|
| `Notification settings saved.` | `Paramètres de notification enregistrés.` | `Ajustes de notificaciones guardados.` | `Benachrichtigungseinstellungen gespeichert.` |

- [ ] **Step 7: Run tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Settings tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 8: Pint, phpstan, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add database/migrations/2026_10_02_100300_create_notifications_table.php database/migrations/2026_10_02_100400_add_notification_preferences_to_users_table.php database/migrations/2026_10_02_100500_create_action_item_reminders_table.php app/Enums/ActionItemReminderKind.php app/Models/ActionItemReminder.php app/Models/User.php config/skrum.php .env.example app/Http/Controllers/Settings/NotificationPreferencesController.php routes/settings.php tests/Feature/Settings/NotificationPreferencesTest.php lang
git commit -m "feat: store reminder logs, notifications and per-user reminder preferences

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 6: The reminder digest e-mail

**Files:**
- Create: `app/Notifications/ActionItemReminderDigestNotification.php`
- Modify: `lang/{en,fr,es,de}.json`
- Test: create `tests/Feature/ActionItems/ReminderDigestTest.php`

**Interfaces:**
- Consumes: `ActionItemReminderKind`, route `notificationPreferences.edit` (Task 5); `workspaces.actionItems.index`, `ActionItem::today()` (Plan 9a).
- Produces: `App\Notifications\ActionItemReminderDigestNotification` (`ShouldQueue`, `ShouldBeEncrypted`, `mail` channel; `__construct(public array $reminders)` with `array<int, array{actionItemId: string, kind: string}>`; `Limit = 20`); the mail lists "Overdue" then "Due soon" items (content linked to `?item={id}`, team, source retro or "Added outside a retro", "Due today" / "Due tomorrow" / "Due :date" with `isoFormat('LL')` in the recipient's locale), "And :count more." past 20, the button "View my open action items" (`?assignee=me&status=open` in the first item's workspace) and the footer about notification settings; subject "Action items need your attention" when both kinds are present, else the `trans_choice` subjects below. Item text is Markdown-escaped. Items deleted before the queued mail renders are left out.

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/ActionItems/ReminderDigestTest.php`:

```php
<?php

use App\Enums\ActionItemReminderKind;
use App\Models\ActionItem;
use App\Models\Retro;
use App\Models\Team;
use App\Notifications\ActionItemReminderDigestNotification;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-10 08:00:00'));
});

/**
 * @param  array<int, array{0: ActionItem, 1: ActionItemReminderKind}>  $entries
 */
function reminderDigest(array $entries): ActionItemReminderDigestNotification
{
    return new ActionItemReminderDigestNotification(array_map(
        fn (array $entry) => ['actionItemId' => $entry[0]->id, 'kind' => $entry[1]->value],
        $entries,
    ));
}

it('lists overdue items before items due soon, each with its context and link', function () {
    $team = Team::factory()->create(['name' => 'Platform']);
    $user = teamMember($team);
    $retro = Retro::factory()->create(['team_id' => $team->id, 'title' => 'Sprint 42']);
    $overdue = ActionItem::factory()->create(['retro_id' => $retro->id, 'content' => 'Rotate the keys', 'due_on' => '2026-10-07']);
    $today = ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'Book the room', 'due_on' => '2026-10-10']);
    $tomorrow = ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'Send the notes', 'due_on' => '2026-10-11']);

    $mail = reminderDigest([
        [$today, ActionItemReminderKind::DueSoon],
        [$overdue, ActionItemReminderKind::Overdue],
        [$tomorrow, ActionItemReminderKind::DueSoon],
    ])->toMail($user);
    $html = (string) $mail->render();

    expect($mail->subject)->toBe('Action items need your attention')
        ->and(strpos($html, 'Rotate the keys'))->toBeLessThan(strpos($html, 'Book the room'))
        ->and($html)->toContain('Platform')
        ->toContain('Sprint 42')
        ->toContain('Added outside a retro')
        ->toContain('Due today')
        ->toContain('Due tomorrow')
        ->toContain('October 7, 2026')
        ->toContain(e(route('workspaces.actionItems.index', ['workspace' => $team->workspace, 'item' => $overdue->id])))
        ->toContain('View my open action items')
        ->toContain(e(route('workspaces.actionItems.index', ['workspace' => $team->workspace, 'assignee' => 'me', 'status' => 'open'])))
        ->toContain('You can turn off these reminders in your notification settings.')
        ->toContain(route('notificationPreferences.edit'));
});

it('shows at most twenty items and counts the rest', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $items = ActionItem::factory()->count(23)->withoutRetro($team, $user)->create(['due_on' => '2026-10-11']);

    $html = (string) reminderDigest($items->map(fn (ActionItem $item) => [$item, ActionItemReminderKind::DueSoon])->all())
        ->toMail($user)
        ->render();

    expect(substr_count($html, '?item='))->toBe(20)
        ->and($html)->toContain('And 3 more.');
});

it('uses singular and plural subjects', function (int $overdue, int $dueSoon, string $subject) {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $entries = [
        ...ActionItem::factory()->count($overdue)->withoutRetro($team, $user)->create(['due_on' => '2026-10-08'])
            ->map(fn (ActionItem $item) => [$item, ActionItemReminderKind::Overdue])->all(),
        ...ActionItem::factory()->count($dueSoon)->withoutRetro($team, $user)->create(['due_on' => '2026-10-11'])
            ->map(fn (ActionItem $item) => [$item, ActionItemReminderKind::DueSoon])->all(),
    ];

    expect(reminderDigest($entries)->toMail($user)->subject)->toBe($subject);
})->with([
    'one overdue' => [1, 0, '1 action item is overdue'],
    'two overdue' => [2, 0, '2 action items are overdue'],
    'one due soon' => [0, 1, '1 action item is due soon'],
    'three due soon' => [0, 3, '3 action items are due soon'],
]);

it('leaves out items deleted before the mail is written', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $kept = ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'Still here', 'due_on' => '2026-10-11']);
    $gone = ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'Already gone', 'due_on' => '2026-10-11']);
    $digest = reminderDigest([[$kept, ActionItemReminderKind::DueSoon], [$gone, ActionItemReminderKind::DueSoon]]);

    $gone->delete();
    $mail = $digest->toMail($user);

    expect($mail->subject)->toBe('1 action item is due soon')
        ->and((string) $mail->render())->toContain('Still here')->not->toContain('Already gone');
});

it('escapes item text so it cannot inject links', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'Click [here](https://evil.test)', 'due_on' => '2026-10-11']);

    $html = (string) reminderDigest([[$item, ActionItemReminderKind::DueSoon]])->toMail($user)->render();

    expect($html)->not->toContain('href="https://evil.test"');
});

it('writes the digest in the recipient language', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $user->update(['locale' => 'fr']);
    $item = ActionItem::factory()->withoutRetro($team, $user)->create(['due_on' => '2026-10-07']);
    Notification::fake();

    $user->notify(reminderDigest([[$item, ActionItemReminderKind::Overdue]]));

    Notification::assertSentTo(
        $user,
        ActionItemReminderDigestNotification::class,
        fn (ActionItemReminderDigestNotification $notification, array $channels, object $notifiable, ?string $locale) => $locale === 'fr' && $channels === ['mail'],
    );

    app()->setLocale('fr');
    $mail = reminderDigest([[$item, ActionItemReminderKind::Overdue]])->toMail($user);

    expect($mail->subject)->toBe('1 action est en retard')
        ->and((string) $mail->render())->toContain('7 octobre 2026');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems/ReminderDigestTest.php`
Expected: FAIL with `Class "App\Notifications\ActionItemReminderDigestNotification" not found`.

- [ ] **Step 3: The notification**

`app/Notifications/ActionItemReminderDigestNotification.php`:

```php
<?php

namespace App\Notifications;

use App\Enums\ActionItemReminderKind;
use App\Models\ActionItem;
use Carbon\CarbonImmutable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Collection as SupportCollection;

class ActionItemReminderDigestNotification extends Notification implements ShouldBeEncrypted, ShouldQueue
{
    use Queueable;

    public const Limit = 20;

    /**
     * Ids only: the items are read again when the queued mail is written,
     * so an item deleted in between is left out.
     *
     * @param  array<int, array{actionItemId: string, kind: string}>  $reminders
     */
    public function __construct(public array $reminders) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        /** @var Collection<string, ActionItem> $items */
        $items = ActionItem::query()
            ->with(['team.workspace', 'retro'])
            ->whereKey(array_column($this->reminders, 'actionItemId'))
            ->get()
            ->keyBy('id');
        $overdue = $this->itemsOfKind($items, ActionItemReminderKind::Overdue);
        $dueSoon = $this->itemsOfKind($items, ActionItemReminderKind::DueSoon);
        $shownOverdue = $overdue->take(self::Limit);
        $shownDueSoon = $dueSoon->take(self::Limit - $shownOverdue->count());
        $hidden = $overdue->count() + $dueSoon->count() - $shownOverdue->count() - $shownDueSoon->count();

        $mail = (new MailMessage)->subject($this->subject($overdue->count(), $dueSoon->count()));

        $this->section($mail, __('Overdue'), $shownOverdue);
        $this->section($mail, __('Due soon'), $shownDueSoon);

        if ($hidden > 0) {
            $mail->line(__('And :count more.', ['count' => $hidden]));
        }

        $first = $overdue->concat($dueSoon)->first();

        if ($first !== null) {
            $mail->action(__('View my open action items'), route('workspaces.actionItems.index', [
                'workspace' => $first->team->workspace,
                'assignee' => 'me',
                'status' => 'open',
            ]));
        }

        $settingsLabel = $this->escape(__('Notification settings'));
        $settingsUrl = route('notificationPreferences.edit');

        return $mail
            ->line(__('You can turn off these reminders in your notification settings.'))
            ->line("[{$settingsLabel}]({$settingsUrl})");
    }

    /**
     * @param  Collection<string, ActionItem>  $items
     * @return SupportCollection<int, ActionItem>
     */
    private function itemsOfKind(Collection $items, ActionItemReminderKind $kind): SupportCollection
    {
        return collect($this->reminders)
            ->filter(fn (array $reminder) => $reminder['kind'] === $kind->value && $items->has($reminder['actionItemId']))
            ->map(fn (array $reminder): ActionItem => $items[$reminder['actionItemId']])
            ->values();
    }

    /**
     * @param  SupportCollection<int, ActionItem>  $items
     */
    private function section(MailMessage $mail, string $title, SupportCollection $items): void
    {
        if ($items->isEmpty()) {
            return;
        }

        $mail->line("**{$this->escape($title)}**");

        foreach ($items as $item) {
            $mail->line($this->describe($item));
        }
    }

    private function describe(ActionItem $item): string
    {
        $url = route('workspaces.actionItems.index', ['workspace' => $item->team->workspace, 'item' => $item->id]);
        $content = $this->escape($item->content);
        $team = $this->escape($item->team->name);
        $source = $this->escape($item->retro === null ? __('Added outside a retro') : $item->retro->title);
        $due = $this->dueWording($item);

        return "[{$content}]({$url}) · {$team} · {$source} · {$due}";
    }

    private function dueWording(ActionItem $item): string
    {
        $dueOn = (string) $item->due_on?->toDateString();
        $today = ActionItem::today();

        if ($dueOn === $today->toDateString()) {
            return __('Due today');
        }

        if ($dueOn === $today->addDay()->toDateString()) {
            return __('Due tomorrow');
        }

        return __('Due :date', ['date' => CarbonImmutable::parse($dueOn)->locale(app()->getLocale())->isoFormat('LL')]);
    }

    private function subject(int $overdue, int $dueSoon): string
    {
        if ($overdue > 0 && $dueSoon > 0) {
            return __('Action items need your attention');
        }

        if ($overdue > 0) {
            return trans_choice(':count action item is overdue|:count action items are overdue', $overdue);
        }

        return trans_choice(':count action item is due soon|:count action items are due soon', $dueSoon);
    }

    /**
     * Item text is user input: escaping Markdown keeps it from becoming a
     * link or formatting in the e-mail.
     */
    private function escape(string $text): string
    {
        return addcslashes($text, '\\`*_{}[]()#+-.!|<>');
    }
}
```

- [ ] **Step 4: Translations**

`trans_choice()` keys are not seen by `TranslationKeysTest`; add them anyway.

| Key | fr | es | de |
|---|---|---|---|
| `Due soon` | `Bientôt dues` | `Vencen pronto` | `Bald fällig` |
| `Due today` | `Pour aujourd'hui` | `Vence hoy` | `Heute fällig` |
| `Due tomorrow` | `Pour demain` | `Vence mañana` | `Morgen fällig` |
| `And :count more.` | `Et :count de plus.` | `Y :count más.` | `Und :count weitere.` |
| `View my open action items` | `Voir mes actions ouvertes` | `Ver mis acciones abiertas` | `Meine offenen Aktionspunkte ansehen` |
| `You can turn off these reminders in your notification settings.` | `Vous pouvez désactiver ces rappels dans vos paramètres de notification.` | `Puedes desactivar estos recordatorios en tus ajustes de notificaciones.` | `Du kannst diese Erinnerungen in deinen Benachrichtigungseinstellungen ausschalten.` |
| `Notification settings` | `Paramètres de notification` | `Ajustes de notificaciones` | `Benachrichtigungseinstellungen` |
| `Action items need your attention` | `Des actions requièrent votre attention` | `Hay acciones que requieren tu atención` | `Aktionspunkte brauchen deine Aufmerksamkeit` |
| `:count action item is overdue\|:count action items are overdue` | `:count action est en retard\|:count actions sont en retard` | `:count acción está vencida\|:count acciones están vencidas` | `:count Aktionspunkt ist überfällig\|:count Aktionspunkte sind überfällig` |
| `:count action item is due soon\|:count action items are due soon` | `:count action arrive bientôt à échéance\|:count actions arrivent bientôt à échéance` | `:count acción vence pronto\|:count acciones vencen pronto` | `:count Aktionspunkt ist bald fällig\|:count Aktionspunkte sind bald fällig` |

(In the JSON files the pipe is a plain `|`, e.g. `":count action item is overdue|:count action items are overdue": ":count action est en retard|:count actions sont en retard"`.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems/ReminderDigestTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 6: Pint, phpstan, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Notifications/ActionItemReminderDigestNotification.php tests/Feature/ActionItems/ReminderDigestTest.php lang
git commit -m "feat: write a daily digest e-mail of due and overdue action items

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 7: Choosing and sending reminders (`SendActionItemReminders`)

**Files:**
- Create: `app/Actions/ActionItems/SendActionItemReminders.php`, `app/Notifications/ActionItemReminderNotification.php`
- Test: create `tests/Feature/ActionItems/ReminderSelectionTest.php`

**Interfaces:**
- Consumes: Task 5 (`action_item_reminders`, preferences, `ActionItemReminderKind`), Task 6 digest; `ActionItem::today()`.
- Produces: `SendActionItemReminders::handle(?Closure $progress = null): array{reminders: int, users: int}` (`$progress(User $user, int $count)` is called once per reminded user before delivery); `App\Notifications\ActionItemReminderNotification` (`database` channel, `__construct(public string $actionItemId, public ActionItemReminderKind $kind, public string $workspaceId, public string $dueOn)`, `toArray(): array{kind: string, actionItemId: string, workspaceId: string, dueOn: string}` — ids only).

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/ActionItems/ReminderSelectionTest.php`:

```php
<?php

use App\Actions\ActionItems\SendActionItemReminders;
use App\Models\ActionItem;
use App\Models\ActionItemReminder;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Notifications\ActionItemReminderDigestNotification;
use App\Notifications\ActionItemReminderNotification;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Notification;

beforeEach(function () {
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-10 08:00:00'));
});

/**
 * @param  array<string, mixed>  $attributes
 * @return array{0: ActionItem, 1: User, 2: Team}
 */
function assignedReminderItem(array $attributes = []): array
{
    $team = Team::factory()->create();
    $assignee = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, teamMember($team))->assignedTo($assignee)
        ->create(['due_on' => '2026-10-10', ...$attributes]);

    return [$item, $assignee, $team];
}

/**
 * @return array{reminders: int, users: int}
 */
function sendDueReminders(): array
{
    return app(SendActionItemReminders::class)->handle();
}

it('reminds of items due today or tomorrow and of items overdue within a week', function (string $dueOn, string $kind) {
    [$item, $assignee, $team] = assignedReminderItem(['due_on' => $dueOn]);

    expect(sendDueReminders())->toBe(['reminders' => 1, 'users' => 1]);

    Notification::assertSentTo(
        $assignee,
        ActionItemReminderDigestNotification::class,
        fn (ActionItemReminderDigestNotification $notification) => $notification->reminders === [['actionItemId' => $item->id, 'kind' => $kind]],
    );
    Notification::assertSentTo(
        $assignee,
        ActionItemReminderNotification::class,
        fn (ActionItemReminderNotification $notification) => $notification->toArray($assignee) === [
            'kind' => $kind,
            'actionItemId' => $item->id,
            'workspaceId' => $team->workspace_id,
            'dueOn' => $dueOn,
        ],
    );
    expect(ActionItemReminder::query()->sole()->only(['action_item_id', 'user_id']))
        ->toBe(['action_item_id' => $item->id, 'user_id' => $assignee->id]);
})->with([
    'due today' => ['2026-10-10', 'due_soon'],
    'due tomorrow' => ['2026-10-11', 'due_soon'],
    'due yesterday' => ['2026-10-09', 'overdue'],
    'due a week ago' => ['2026-10-03', 'overdue'],
]);

it('skips items that must not be reminded', function (Closure $prepare) {
    [$item, $assignee, $team] = assignedReminderItem();
    $prepare($item, $assignee, $team);

    expect(sendDueReminders())->toBe(['reminders' => 0, 'users' => 0]);

    Notification::assertNothingSent();
    expect(ActionItemReminder::count())->toBe(0);
})->with([
    'due in two days' => [fn (ActionItem $item) => $item->update(['due_on' => '2026-10-12'])],
    'due eight days ago' => [fn (ActionItem $item) => $item->update(['due_on' => '2026-10-02'])],
    'completed' => [fn (ActionItem $item) => $item->update(['completed_at' => now()])],
    'unassigned' => [fn (ActionItem $item) => $item->update(['assignee_user_id' => null])],
    'assigned to a guest' => [function (ActionItem $item, User $assignee, Team $team) {
        $retro = Retro::factory()->create(['team_id' => $team->id]);
        $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);
        $item->update(['retro_id' => $retro->id, 'assignee_user_id' => null, 'assignee_participant_id' => $guest->id]);
    }],
    'assignee left the team' => [fn (ActionItem $item, User $assignee, Team $team) => $team->members()->detach($assignee)],
    'unverified email' => [fn (ActionItem $item, User $assignee) => $assignee->forceFill(['email_verified_at' => null])->save()],
]);

it('sends each reminder once', function () {
    [, $assignee] = assignedReminderItem();

    sendDueReminders();
    sendDueReminders();

    Notification::assertSentToTimes($assignee, ActionItemReminderDigestNotification::class, 1);
    Notification::assertSentToTimes($assignee, ActionItemReminderNotification::class, 1);
});

it('reminds again after the due date moves or the item is reassigned', function () {
    [$item, $assignee, $team] = assignedReminderItem();

    sendDueReminders();
    $item->update(['due_on' => '2026-10-11']);
    sendDueReminders();
    $colleague = teamMember($team);
    $item->update(['assignee_user_id' => $colleague->id]);
    sendDueReminders();

    Notification::assertSentToTimes($assignee, ActionItemReminderDigestNotification::class, 2);
    Notification::assertSentToTimes($colleague, ActionItemReminderDigestNotification::class, 1);
    expect(ActionItemReminder::count())->toBe(3);
});

it('respects the email and in-app preferences', function (bool $byEmail, bool $inApp) {
    [, $assignee] = assignedReminderItem();
    $assignee->forceFill(['action_item_reminders_by_email' => $byEmail, 'action_item_reminders_in_app' => $inApp])->save();

    sendDueReminders();

    Notification::assertSentToTimes($assignee, ActionItemReminderDigestNotification::class, $byEmail ? 1 : 0);
    Notification::assertSentToTimes($assignee, ActionItemReminderNotification::class, $inApp ? 1 : 0);
    expect(ActionItemReminder::count())->toBe($byEmail || $inApp ? 1 : 0);
})->with([
    'email only' => [true, false],
    'bell only' => [false, true],
    'neither' => [false, false],
]);

it('sends one digest per user with all their items', function () {
    [$first, $assignee, $team] = assignedReminderItem(['due_on' => '2026-10-08']);
    ActionItem::factory()->count(2)->withoutRetro($team, $assignee)->assignedTo($assignee)->create(['due_on' => '2026-10-11']);
    [, $other] = assignedReminderItem();
    $progress = [];

    $totals = app(SendActionItemReminders::class)->handle(function (User $user, int $count) use (&$progress): void {
        $progress[$user->id] = $count;
    });

    expect($totals)->toBe(['reminders' => 4, 'users' => 2])
        ->and($progress)->toBe([$assignee->id => 3, $other->id => 1]);
    Notification::assertSentToTimes($assignee, ActionItemReminderDigestNotification::class, 1);
    Notification::assertSentTo(
        $assignee,
        ActionItemReminderDigestNotification::class,
        fn (ActionItemReminderDigestNotification $notification) => count($notification->reminders) === 3
            && $notification->reminders[0] === ['actionItemId' => $first->id, 'kind' => 'overdue'],
    );
    Notification::assertSentToTimes($assignee, ActionItemReminderNotification::class, 3);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems/ReminderSelectionTest.php`
Expected: FAIL with `Class "App\Actions\ActionItems\SendActionItemReminders" not found`.

- [ ] **Step 3: In-app notification**

`app/Notifications/ActionItemReminderNotification.php`:

```php
<?php

namespace App\Notifications;

use App\Enums\ActionItemReminderKind;
use Illuminate\Notifications\Notification;

/**
 * Stores ids only; the bell loads the item live, with a permission check.
 */
class ActionItemReminderNotification extends Notification
{
    public function __construct(
        public string $actionItemId,
        public ActionItemReminderKind $kind,
        public string $workspaceId,
        public string $dueOn,
    ) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array{
     *     kind: string,
     *     actionItemId: string,
     *     workspaceId: string,
     *     dueOn: string
     * }
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => $this->kind->value,
            'actionItemId' => $this->actionItemId,
            'workspaceId' => $this->workspaceId,
            'dueOn' => $this->dueOn,
        ];
    }
}
```

- [ ] **Step 4: Sending**

`app/Actions/ActionItems/SendActionItemReminders.php`:

```php
<?php

namespace App\Actions\ActionItems;

use App\Enums\ActionItemReminderKind;
use App\Models\ActionItem;
use App\Models\User;
use App\Notifications\ActionItemReminderDigestNotification;
use App\Notifications\ActionItemReminderNotification;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SendActionItemReminders
{
    /**
     * Open items due today or tomorrow ("due soon") or during the last
     * seven days ("overdue"), assigned to a verified member still in the
     * item's team: one digest and one bell entry per item, each channel
     * unless the user turned it off.
     *
     * @param  (Closure(User, int): void)|null  $progress
     * @return array{reminders: int, users: int}
     */
    public function handle(?Closure $progress = null): array
    {
        $today = ActionItem::today();
        $reminders = 0;
        $users = 0;

        foreach ($this->dueItems($today)->groupBy('assignee_user_id') as $items) {
            /** @var Collection<int, ActionItem> $items */
            $user = $items->first()?->assigneeUser;

            if ($user === null) {
                continue;
            }

            if (! $user->action_item_reminders_by_email && ! $user->action_item_reminders_in_app) {
                continue;
            }

            $unsent = $items->filter(fn (ActionItem $item) => $this->log($item, $user, $today))->values();

            if ($unsent->isEmpty()) {
                continue;
            }

            if ($progress !== null) {
                $progress($user, $unsent->count());
            }

            $this->deliver($user, $unsent, $today);

            $reminders += $unsent->count();
            $users++;
        }

        return ['reminders' => $reminders, 'users' => $users];
    }

    /**
     * @return Collection<int, ActionItem>
     */
    private function dueItems(CarbonImmutable $today): Collection
    {
        return ActionItem::query()
            ->whereNull('completed_at')
            ->whereNotNull('assignee_user_id')
            ->whereBetween('due_on', [$today->subDays(7)->toDateString(), $today->addDay()->toDateString()])
            ->whereExists(fn ($query) => $query
                ->select(DB::raw(1))
                ->from('team_user')
                ->whereColumn('team_user.team_id', 'action_items.team_id')
                ->whereColumn('team_user.user_id', 'action_items.assignee_user_id'))
            ->whereHas('assigneeUser', fn ($query) => $query->whereNotNull('email_verified_at'))
            ->with(['assigneeUser', 'team'])
            ->orderBy('due_on')
            ->orderBy('created_at')
            ->get();
    }

    private function kind(ActionItem $item, CarbonImmutable $today): ActionItemReminderKind
    {
        return (string) $item->due_on?->toDateString() < $today->toDateString()
            ? ActionItemReminderKind::Overdue
            : ActionItemReminderKind::DueSoon;
    }

    /**
     * Logged before anything is sent: a second run the same day finds the
     * row and skips the item, and a failed mail is never sent twice.
     */
    private function log(ActionItem $item, User $user, CarbonImmutable $today): bool
    {
        return DB::table('action_item_reminders')->insertOrIgnore([
            'id' => (string) Str::uuid(),
            'action_item_id' => $item->id,
            'user_id' => $user->id,
            'kind' => $this->kind($item, $today)->value,
            'due_on' => (string) $item->due_on?->toDateString(),
            'sent_at' => now(),
        ]) === 1;
    }

    /**
     * @param  Collection<int, ActionItem>  $items
     */
    private function deliver(User $user, Collection $items, CarbonImmutable $today): void
    {
        if ($user->action_item_reminders_by_email) {
            $user->notify(new ActionItemReminderDigestNotification(
                $items->map(fn (ActionItem $item) => [
                    'actionItemId' => $item->id,
                    'kind' => $this->kind($item, $today)->value,
                ])->values()->all(),
            ));
        }

        if (! $user->action_item_reminders_in_app) {
            return;
        }

        foreach ($items as $item) {
            $user->notify(new ActionItemReminderNotification(
                $item->id,
                $this->kind($item, $today),
                $item->team->workspace_id,
                (string) $item->due_on?->toDateString(),
            ));
        }
    }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems/ReminderSelectionTest.php`
Expected: PASS.

- [ ] **Step 6: Pint, phpstan, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/ActionItems/SendActionItemReminders.php app/Notifications/ActionItemReminderNotification.php tests/Feature/ActionItems/ReminderSelectionTest.php
git commit -m "feat: remind member assignees of due and overdue action items

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 8: The daily command, schedule and housekeeping

**Files:**
- Create: `app/Actions/ActionItems/PruneActionItemNotifications.php`, `app/Console/Commands/SendActionItemRemindersCommand.php`
- Modify: `routes/console.php`
- Test: create `tests/Feature/ActionItems/ReminderCommandTest.php`

**Interfaces:**
- Consumes: `SendActionItemReminders` (Task 7), `ActionItemReminder` (Task 5), `ActionItemReminderNotification` (Task 7), config `skrum.action_item_reminders.*`.
- Produces: `PruneActionItemNotifications::handle(): array{notifications: int, reminders: int}` (deletes reminder notifications whose item is gone, read notifications older than 30 days, any notification older than 90 days, reminder records older than 90 days); artisan command `action-items:send-reminders` (does nothing but say so when `skrum.action_item_reminders.enabled` is false; prints "Reminding user `…` about N items…" per user and "Sent N reminders to M users."); schedule `dailyAt(config time)->timezone(app.timezone)->withoutOverlapping()->onOneServer()`, run by the existing s6 `scheduler` service (`php artisan schedule:work`).

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/ActionItems/ReminderCommandTest.php`:

```php
<?php

use App\Enums\ActionItemReminderKind;
use App\Models\ActionItem;
use App\Models\ActionItemReminder;
use App\Models\Team;
use App\Models\User;
use App\Notifications\ActionItemReminderNotification;
use Carbon\CarbonImmutable;
use Illuminate\Console\Scheduling\Event as ScheduledEvent;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

/**
 * @param  array<string, mixed>  $attributes
 */
function storedReminderNotification(User $user, ActionItem $item, array $attributes = []): DatabaseNotification
{
    return $user->notifications()->create([
        'id' => (string) Str::uuid(),
        'type' => ActionItemReminderNotification::class,
        'data' => ['kind' => 'overdue', 'actionItemId' => $item->id, 'workspaceId' => $item->team->workspace_id, 'dueOn' => '2026-10-01'],
        ...$attributes,
    ]);
}

it('sends the reminders and reports progress', function () {
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-10 08:00:00'));
    $team = Team::factory()->create();
    $assignee = teamMember($team);
    ActionItem::factory()->withoutRetro($team, $assignee)->assignedTo($assignee)->create(['due_on' => '2026-10-10']);

    $this->artisan('action-items:send-reminders')
        ->expectsOutput("Reminding user `{$assignee->id}` about 1 items…")
        ->expectsOutput('Sent 1 reminders to 1 users.')
        ->assertSuccessful();
});

it('does nothing when reminders are turned off', function () {
    Notification::fake();
    config(['skrum.action_item_reminders.enabled' => false]);
    $team = Team::factory()->create();
    $assignee = teamMember($team);
    ActionItem::factory()->withoutRetro($team, $assignee)->assignedTo($assignee)->create(['due_on' => now()->toDateString()]);

    $this->artisan('action-items:send-reminders')
        ->expectsOutput('Action item reminders are turned off.')
        ->assertSuccessful();

    Notification::assertNothingSent();
    expect(ActionItemReminder::count())->toBe(0);
});

it('runs every day at the configured time in the instance time zone', function () {
    $event = collect(app(Schedule::class)->events())
        ->first(fn (ScheduledEvent $event) => str_contains((string) $event->command, 'action-items:send-reminders'));

    expect($event)->not->toBeNull()
        ->and($event->expression)->toBe('0 8 * * *')
        ->and($event->timezone)->toBe(config('app.timezone'))
        ->and($event->withoutOverlapping)->toBeTrue()
        ->and($event->onOneServer)->toBeTrue();
});

it('prunes orphaned, read and old notifications and old reminder records', function () {
    Notification::fake();
    $user = User::factory()->create();
    $item = ActionItem::factory()->create();
    $gone = ActionItem::factory()->create();
    $kept = storedReminderNotification($user, $item);
    storedReminderNotification($user, $gone);
    storedReminderNotification($user, $item, ['read_at' => now()->subDays(31), 'created_at' => now()->subDays(31)]);
    $recentlyRead = storedReminderNotification($user, $item, ['read_at' => now()->subDays(2), 'created_at' => now()->subDays(2)]);
    storedReminderNotification($user, $item, ['created_at' => now()->subDays(91)]);
    $gone->delete();
    $reminder = ['action_item_id' => $item->id, 'user_id' => $user->id, 'kind' => ActionItemReminderKind::Overdue];
    ActionItemReminder::query()->create([...$reminder, 'due_on' => '2026-01-01', 'sent_at' => now()->subDays(91)]);
    ActionItemReminder::query()->create([...$reminder, 'due_on' => '2026-10-01', 'sent_at' => now()]);

    $this->artisan('action-items:send-reminders')->assertSuccessful();

    expect($user->notifications()->pluck('id')->sort()->values()->all())
        ->toBe(collect([$kept->id, $recentlyRead->id])->sort()->values()->all())
        ->and(ActionItemReminder::count())->toBe(1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems/ReminderCommandTest.php`
Expected: FAIL (`The command "action-items:send-reminders" does not exist.`).

- [ ] **Step 3: Housekeeping**

`app/Actions/ActionItems/PruneActionItemNotifications.php`:

```php
<?php

namespace App\Actions\ActionItems;

use App\Models\ActionItem;
use App\Models\ActionItemReminder;
use App\Notifications\ActionItemReminderNotification;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Notifications\DatabaseNotification;

class PruneActionItemNotifications
{
    /**
     * @return array{notifications: int, reminders: int}
     */
    public function handle(): array
    {
        $orphaned = $this->deleteOrphanedNotifications();
        $read = DatabaseNotification::query()
            ->whereNotNull('read_at')
            ->where('created_at', '<', now()->subDays(30))
            ->delete();
        $old = DatabaseNotification::query()
            ->where('created_at', '<', now()->subDays(90))
            ->delete();
        $reminders = ActionItemReminder::query()
            ->where('sent_at', '<', now()->subDays(90))
            ->delete();

        return ['notifications' => $orphaned + $read + $old, 'reminders' => $reminders];
    }

    private function deleteOrphanedNotifications(): int
    {
        $deleted = 0;

        DatabaseNotification::query()
            ->where('type', ActionItemReminderNotification::class)
            ->chunkById(500, function (Collection $notifications) use (&$deleted): void {
                $referenced = $notifications
                    ->map(fn (DatabaseNotification $notification) => $notification->data['actionItemId'] ?? null)
                    ->filter()
                    ->unique()
                    ->values();
                $existing = ActionItem::query()->whereKey($referenced)->pluck('id');
                $orphans = $notifications
                    ->reject(fn (DatabaseNotification $notification) => $existing->contains($notification->data['actionItemId'] ?? null))
                    ->modelKeys();

                $deleted += DatabaseNotification::query()->whereKey($orphans)->delete();
            });

        return $deleted;
    }
}
```

- [ ] **Step 4: Command and schedule**

Run `vendor/bin/sail artisan make:command SendActionItemRemindersCommand --no-interaction` and replace `app/Console/Commands/SendActionItemRemindersCommand.php` with:

```php
<?php

namespace App\Console\Commands;

use App\Actions\ActionItems\PruneActionItemNotifications;
use App\Actions\ActionItems\SendActionItemReminders;
use App\Models\User;
use Illuminate\Console\Command;

class SendActionItemRemindersCommand extends Command
{
    protected $signature = 'action-items:send-reminders';

    protected $description = 'Send due-soon and overdue action item reminders, then prune old notifications';

    public function handle(SendActionItemReminders $sendActionItemReminders, PruneActionItemNotifications $pruneActionItemNotifications): int
    {
        if (! config('skrum.action_item_reminders.enabled')) {
            $this->comment('Action item reminders are turned off.');

            return self::SUCCESS;
        }

        $sent = $sendActionItemReminders->handle(function (User $user, int $count): void {
            $this->info("Reminding user `{$user->id}` about {$count} items…");
        });

        $pruned = $pruneActionItemNotifications->handle();

        $this->comment("Sent {$sent['reminders']} reminders to {$sent['users']} users.");
        $this->comment("Pruned {$pruned['notifications']} notifications and {$pruned['reminders']} reminder records.");

        return self::SUCCESS;
    }
}
```

Replace `routes/console.php` with:

```php
<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('action-items:send-reminders')
    ->dailyAt((string) config('skrum.action_item_reminders.time'))
    ->timezone((string) config('app.timezone'))
    ->withoutOverlapping()
    ->onOneServer();
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems/ReminderCommandTest.php`
Expected: PASS.

- [ ] **Step 6: Pint, phpstan, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/ActionItems/PruneActionItemNotifications.php app/Console/Commands/SendActionItemRemindersCommand.php routes/console.php tests/Feature/ActionItems/ReminderCommandTest.php
git commit -m "feat: send action item reminders daily and prune old notifications

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 9: Notification endpoints, shared counts and read-on-completion

**Files:**
- Create: `app/Actions/ActionItems/ListActionItemNotifications.php`, `app/Actions/ActionItems/MarkActionItemRemindersRead.php`, `app/Http/Controllers/NotificationsController.php`, `app/Http/Controllers/ReadAllNotificationsController.php`
- Modify: `app/Actions/ActionItems/SetActionItemStatus.php`, `app/Http/Middleware/HandleInertiaRequests.php`, `routes/web.php`
- Test: create `tests/Feature/ActionItems/NotificationsTest.php`

**Interfaces:**
- Consumes: `ActionItemReminderNotification` (Task 7), `ActionItemQuery::visibleTo()` and `ActionItem::today()` (Plan 9a), `WorkspaceRole`.
- Produces:
  - `ListActionItemNotifications::handle(User $user): array{notifications: array<int, array{id: string, kind: string, wording: string, readAt: ?string, createdAt: ?string, actionItem: array{id: string, content: string, teamName: string, dueOn: ?string, isOverdue: bool, url: string}}>, unreadCount: int}` — latest 30 own notifications; those whose item is gone or whose team the user can no longer view are deleted and left out; `wording` ∈ `overdue|due_today|due_tomorrow` (due soon on the day it was sent vs the day after, instance time zone).
  - `MarkActionItemRemindersRead::handle(ActionItem $item): void`, called by `SetActionItemStatus` when an item becomes completed.
  - Routes (`auth`, `verified`): `notifications.index` (`GET /notifications`), `notifications.update` (`PATCH /notifications/{notification} {read: true}` → `{unreadCount}`; another user's id → 404), `notifications.readAll` (`POST /notifications/read-all` → `{unreadCount: 0}`).
  - Shared Inertia props `notifications: {unreadCount: int} | null` and `actionItems: {overdueAssignedCount: int} | null` (open, overdue items assigned to the viewer that they can see in the current workspace; `null` without a user).

- [ ] **Step 1: Write the failing tests**

Create `tests/Feature/ActionItems/NotificationsTest.php`:

```php
<?php

use App\Enums\ActionItemReminderKind;
use App\Models\ActionItem;
use App\Models\Team;
use App\Models\User;
use App\Notifications\ActionItemReminderNotification;
use Carbon\CarbonImmutable;
use Illuminate\Notifications\DatabaseNotification;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-10 08:00:00'));
});

/**
 * @param  array<string, mixed>  $attributes
 * @return array{0: User, 1: ActionItem, 2: Team}
 */
function notifiedAssignee(array $attributes = []): array
{
    $team = Team::factory()->create(['name' => 'Platform']);
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->assignedTo($user)->create(['due_on' => '2026-10-08', ...$attributes]);

    return [$user, $item, $team];
}

function remindAbout(User $user, ActionItem $item, ActionItemReminderKind $kind = ActionItemReminderKind::Overdue): DatabaseNotification
{
    $user->notify(new ActionItemReminderNotification($item->id, $kind, $item->team->workspace_id, (string) $item->due_on?->toDateString()));

    return $user->notifications()->latest()->firstOrFail();
}

it('lists the latest notifications with live item details', function () {
    [$user, $item, $team] = notifiedAssignee(['content' => 'Rotate the keys']);
    $notification = remindAbout($user, $item);

    $this->actingAs($user)
        ->getJson(route('notifications.index'))
        ->assertOk()
        ->assertJsonPath('unreadCount', 1)
        ->assertJsonPath('notifications.0.id', $notification->id)
        ->assertJsonPath('notifications.0.kind', 'overdue')
        ->assertJsonPath('notifications.0.wording', 'overdue')
        ->assertJsonPath('notifications.0.readAt', null)
        ->assertJsonPath('notifications.0.actionItem', [
            'id' => $item->id,
            'content' => 'Rotate the keys',
            'teamName' => 'Platform',
            'dueOn' => '2026-10-08',
            'isOverdue' => true,
            'url' => route('workspaces.actionItems.index', ['workspace' => $team->workspace, 'item' => $item->id]),
        ]);
});

it('words due-soon reminders as today or tomorrow', function (string $dueOn, string $wording) {
    [$user, $item] = notifiedAssignee(['due_on' => $dueOn]);
    remindAbout($user, $item, ActionItemReminderKind::DueSoon);

    $this->actingAs($user)
        ->getJson(route('notifications.index'))
        ->assertJsonPath('notifications.0.wording', $wording);
})->with([
    'today' => ['2026-10-10', 'due_today'],
    'tomorrow' => ['2026-10-11', 'due_tomorrow'],
]);

it('drops notifications of deleted or hidden items', function () {
    [$user, $item, $team] = notifiedAssignee();
    $deleted = ActionItem::factory()->withoutRetro($team, $user)->create(['due_on' => '2026-10-08']);
    $otherTeam = Team::factory()->create(['workspace_id' => $team->workspace_id]);
    $otherTeam->members()->attach($user);
    $hidden = ActionItem::factory()->withoutRetro($otherTeam, $user)->create(['due_on' => '2026-10-08']);
    $visible = remindAbout($user, $item);
    remindAbout($user, $deleted);
    remindAbout($user, $hidden);
    $deleted->delete();
    $otherTeam->members()->detach($user);

    $this->actingAs($user)
        ->getJson(route('notifications.index'))
        ->assertOk()
        ->assertJsonCount(1, 'notifications')
        ->assertJsonPath('notifications.0.id', $visible->id)
        ->assertJsonPath('unreadCount', 1);

    expect($user->notifications()->count())->toBe(1);
});

it('lists only the own notifications, thirty at most', function () {
    [$user, $item] = notifiedAssignee();
    [$other, $otherItem] = notifiedAssignee();
    remindAbout($other, $otherItem);

    foreach (range(1, 31) as $minute) {
        $this->travelTo(CarbonImmutable::parse('2026-10-10 08:00:00')->addMinutes($minute));
        remindAbout($user, $item);
    }

    $this->actingAs($user)
        ->getJson(route('notifications.index'))
        ->assertJsonCount(30, 'notifications')
        ->assertJsonPath('unreadCount', 31);
});

it('marks one or all notifications read', function () {
    [$user, $item] = notifiedAssignee();
    $first = remindAbout($user, $item);
    remindAbout($user, $item, ActionItemReminderKind::DueSoon);

    $this->actingAs($user)
        ->patchJson(route('notifications.update', $first->id), ['read' => true])
        ->assertOk()
        ->assertExactJson(['unreadCount' => 1]);
    $this->actingAs($user)
        ->postJson(route('notifications.readAll'))
        ->assertOk()
        ->assertExactJson(['unreadCount' => 0]);

    expect($user->unreadNotifications()->count())->toBe(0);
});

it('refuses other users notifications', function () {
    [, $item] = notifiedAssignee();
    [$other, $otherItem] = notifiedAssignee();
    $foreign = remindAbout($other, $otherItem);

    $this->actingAs($item->assigneeUser)
        ->patchJson(route('notifications.update', $foreign->id), ['read' => true])
        ->assertNotFound();

    expect($foreign->fresh()->read_at)->toBeNull();
});

it('marks reminders read when the item is completed', function () {
    [$user, $item, $team] = notifiedAssignee();
    $other = ActionItem::factory()->withoutRetro($team, $user)->assignedTo($user)->create(['due_on' => '2026-10-08']);
    $reminder = remindAbout($user, $item);
    $untouched = remindAbout($user, $other);

    $this->actingAs($user)
        ->patchJson(route('workspaces.actionItems.update', ['workspace' => $team->workspace, 'actionItem' => $item]), ['status' => 'completed'])
        ->assertOk();

    expect($reminder->fresh()->read_at)->not->toBeNull()
        ->and($untouched->fresh()->read_at)->toBeNull();
});

it('shares the unread count and my overdue items of the current workspace', function () {
    [$user, $item, $team] = notifiedAssignee();
    ActionItem::factory()->withoutRetro($team, $user)->assignedTo($user)->create(['due_on' => '2026-10-01']);
    ActionItem::factory()->withoutRetro($team, $user)->assignedTo($user)->completed()->create(['due_on' => '2026-10-01']);
    ActionItem::factory()->withoutRetro($team, $user)->assignedTo($user)->create(['due_on' => '2026-10-20']);
    ActionItem::factory()->withoutRetro($team, $user)->assignedTo(teamMember($team))->create(['due_on' => '2026-10-01']);
    $elsewhere = Team::factory()->create();
    $elsewhere->workspace->members()->attach($user, ['role' => 'member']);
    $elsewhere->members()->attach($user);
    ActionItem::factory()->withoutRetro($elsewhere, $user)->assignedTo($user)->create(['due_on' => '2026-10-01']);
    remindAbout($user, $item);

    $this->actingAs($user)
        ->get(route('workspaces.actionItems.index', $team->workspace))
        ->assertInertia(fn (Assert $page) => $page
            ->where('notifications.unreadCount', 1)
            ->where('actionItems.overdueAssignedCount', 2));
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems/NotificationsTest.php`
Expected: FAIL with `Route [notifications.index] not defined.`

- [ ] **Step 3: Listing and marking**

`app/Actions/ActionItems/ListActionItemNotifications.php`:

```php
<?php

namespace App\Actions\ActionItems;

use App\Enums\ActionItemReminderKind;
use App\Enums\WorkspaceRole;
use App\Models\ActionItem;
use App\Models\Team;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Notifications\DatabaseNotification;

class ListActionItemNotifications
{
    public const Limit = 30;

    /**
     * Notifications store ids only; the item is read live and a user who
     * lost access to it no longer sees it (the notification is deleted).
     *
     * @return array{
     *     notifications: array<int, array<string, mixed>>,
     *     unreadCount: int
     * }
     */
    public function handle(User $user): array
    {
        $notifications = $user->notifications()->limit(self::Limit)->get();
        /** @var Collection<string, ActionItem> $items */
        $items = ActionItem::query()
            ->with('team.workspace')
            ->whereKey($notifications->map(fn (DatabaseNotification $notification) => $notification->data['actionItemId'] ?? null)->filter()->unique()->values())
            ->get()
            ->keyBy('id');
        $viewableTeamIds = $this->viewableTeamIds($user);
        $visible = $notifications->filter(function (DatabaseNotification $notification) use ($items, $viewableTeamIds): bool {
            $item = $items->get($notification->data['actionItemId'] ?? '');

            return $item !== null && in_array($item->team_id, $viewableTeamIds, true);
        });

        DatabaseNotification::query()->whereKey($notifications->diff($visible)->modelKeys())->delete();

        return [
            'notifications' => $visible
                ->map(fn (DatabaseNotification $notification) => $this->present($notification, $items[$notification->data['actionItemId']]))
                ->values()
                ->all(),
            'unreadCount' => $user->unreadNotifications()->count(),
        ];
    }

    /**
     * Same rule as TeamPolicy::view: every team of the workspaces the user
     * manages, and the teams they belong to.
     *
     * @return array<int, string>
     */
    private function viewableTeamIds(User $user): array
    {
        $managedWorkspaceIds = $user->workspaces()
            ->wherePivotIn('role', [WorkspaceRole::Owner->value, WorkspaceRole::Admin->value])
            ->pluck('workspaces.id');

        /** @var array<int, string> $teamIds */
        $teamIds = Team::query()
            ->whereIn('workspace_id', $managedWorkspaceIds)
            ->orWhereIn('id', $user->teams()->select('teams.id'))
            ->pluck('id')
            ->all();

        return $teamIds;
    }

    /**
     * @return array{
     *     id: string,
     *     kind: string,
     *     wording: string,
     *     readAt: ?string,
     *     createdAt: ?string,
     *     actionItem: array{id: string, content: string, teamName: string, dueOn: ?string, isOverdue: bool, url: string}
     * }
     */
    private function present(DatabaseNotification $notification, ActionItem $item): array
    {
        return [
            'id' => $notification->id,
            'kind' => (string) ($notification->data['kind'] ?? ''),
            'wording' => $this->wording($notification),
            'readAt' => $notification->read_at?->toIso8601String(),
            'createdAt' => $notification->created_at?->toIso8601String(),
            'actionItem' => [
                'id' => $item->id,
                'content' => $item->content,
                'teamName' => $item->team->name,
                'dueOn' => $item->due_on?->toDateString(),
                'isOverdue' => $item->isOverdue(ActionItem::today()),
                'url' => route('workspaces.actionItems.index', ['workspace' => $item->team->workspace, 'item' => $item->id]),
            ],
        ];
    }

    private function wording(DatabaseNotification $notification): string
    {
        if (($notification->data['kind'] ?? null) === ActionItemReminderKind::Overdue->value) {
            return 'overdue';
        }

        $sentOn = $notification->created_at?->setTimezone((string) config('app.timezone'))->toDateString();

        return ($notification->data['dueOn'] ?? null) === $sentOn ? 'due_today' : 'due_tomorrow';
    }
}
```

`app/Actions/ActionItems/MarkActionItemRemindersRead.php`:

```php
<?php

namespace App\Actions\ActionItems;

use App\Models\ActionItem;
use App\Notifications\ActionItemReminderNotification;
use Illuminate\Notifications\DatabaseNotification;

class MarkActionItemRemindersRead
{
    public function handle(ActionItem $item): void
    {
        DatabaseNotification::query()
            ->where('type', ActionItemReminderNotification::class)
            ->whereNull('read_at')
            ->where('data->actionItemId', $item->id)
            ->update(['read_at' => now()]);
    }
}
```

In `app/Actions/ActionItems/SetActionItemStatus.php` add the constructor parameter `private MarkActionItemRemindersRead $markActionItemRemindersRead,` and extend the completion block to:

```php
        if ($completing) {
            $this->createNextOccurrence->handle($locked);
            $this->markActionItemRemindersRead->handle($locked);
        }
```

- [ ] **Step 4: Controllers, routes, shared props**

`app/Http/Controllers/NotificationsController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\ActionItems\ListActionItemNotifications;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationsController extends Controller
{
    public function index(Request $request, ListActionItemNotifications $listActionItemNotifications): JsonResponse
    {
        return response()->json($listActionItemNotifications->handle($request->user()));
    }

    public function update(Request $request, string $notification): JsonResponse
    {
        $request->validate(['read' => ['required', 'accepted']]);

        $user = $request->user();

        $user->notifications()->findOrFail($notification)->markAsRead();

        return response()->json(['unreadCount' => $user->unreadNotifications()->count()]);
    }
}
```

`app/Http/Controllers/ReadAllNotificationsController.php`:

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReadAllNotificationsController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $request->user()->unreadNotifications()->update(['read_at' => now()]);

        return response()->json(['unreadCount' => 0]);
    }
}
```

In `routes/web.php` add `use App\Http\Controllers\NotificationsController;` and `use App\Http\Controllers\ReadAllNotificationsController;`, and in the `['auth', 'verified']` group, after `workspaces.store`:

```php
    Route::get('notifications', [NotificationsController::class, 'index'])->name('notifications.index');
    Route::post('notifications/read-all', [ReadAllNotificationsController::class, 'store'])->name('notifications.readAll');
    Route::patch('notifications/{notification}', [NotificationsController::class, 'update'])->name('notifications.update')->whereUuid('notification');
```

In `app/Http/Middleware/HandleInertiaRequests.php` add `use App\Actions\ActionItems\ActionItemQuery;` and `use App\Models\ActionItem;`, add to the shared array:

```php
            'notifications' => fn () => $request->user() === null
                ? null
                : ['unreadCount' => $request->user()->unreadNotifications()->count()],
            'actionItems' => fn () => $this->actionItemCounts($request),
```

and the private method:

```php
    /**
     * @return array{overdueAssignedCount: int}|null
     */
    private function actionItemCounts(Request $request): ?array
    {
        $user = $request->user();

        if ($user === null) {
            return null;
        }

        $workspace = $request->route('workspace');

        if (! $workspace instanceof Workspace) {
            $workspace = $user->currentWorkspace;
        }

        if ($workspace === null || ! $user->belongsToWorkspace($workspace)) {
            return ['overdueAssignedCount' => 0];
        }

        return [
            'overdueAssignedCount' => app(ActionItemQuery::class)->visibleTo($user, $workspace)
                ->where('assignee_user_id', $user->id)
                ->whereNull('completed_at')
                ->where('due_on', '<', ActionItem::today()->toDateString())
                ->count(),
        ];
    }
```

Run `vendor/bin/sail artisan wayfinder:generate --with-form`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/ActionItems tests/Feature/RequestIsolationTest.php`
Expected: PASS.

- [ ] **Step 6: Pint, phpstan, commit**

```bash
vendor/bin/sail bin pint --dirty --format agent
vendor/bin/sail bin phpstan analyse --no-progress
git add app/Actions/ActionItems/ListActionItemNotifications.php app/Actions/ActionItems/MarkActionItemRemindersRead.php app/Actions/ActionItems/SetActionItemStatus.php app/Http/Controllers/NotificationsController.php app/Http/Controllers/ReadAllNotificationsController.php app/Http/Middleware/HandleInertiaRequests.php routes/web.php tests/Feature/ActionItems/NotificationsTest.php
git commit -m "feat: list, read and count action item notifications

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 10: Repeat select and sub-task checklist in the UI

**Files:**
- Create: `resources/js/components/action-items/recurrence-select.tsx`, `resources/js/components/action-items/subtask-checklist.tsx`
- Modify: `resources/js/lib/retro/types.ts`, `resources/js/lib/action-items/endpoints.ts`, `resources/js/components/action-items/action-item-card.tsx`, `resources/js/components/action-items/action-item-form.tsx`, `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: payload keys `recurrence`, `previousOccurrenceId`, `subtasks` (Tasks 3–4); Wayfinder `Retros/ActionItemSubtasksController`, `WorkspaceActionItemSubtasksController`; Plan 9a `ActionItemCard`, `ActionItemForm`, `ActionItemEndpoints`, `retroRequest`, `formatShortDate`.
- Produces: types `ActionItemRecurrence`, `ActionItemSubtask`, `ActionItem.{recurrence, previousOccurrenceId, subtasks}`; `ActionItemEndpoints.{addSubtask, updateSubtask, destroySubtask}` in both factories; `RecurrenceSelect({value, disabled?, onChange})` ("Does not repeat", "Weekly", "Every 2 weeks", "Monthly"), `RecurrenceBadge({item})` (repeat icon, "Repeats weekly…", "Follows up the item completed on :date" on generated occurrences — their `createdAt` is the completion moment of the previous one); `SubtaskChecklist({item, endpoints, run, canManage, canCheck, onSaved})` (checkbox per sub-task for completers; add, inline edit, up/down, delete for managers; hidden when empty for non-managers); the card shows the badge and "2/5" progress in its meta line, the checklist under the content and the repeat select (enabled once a due date is set); `ActionItemDraft.recurrence` with the repeat select in the create form (cleared when the due date is cleared).

- [ ] **Step 1: Types and endpoints**

In `resources/js/lib/retro/types.ts` add:

```ts
export type ActionItemRecurrence = 'weekly' | 'every_two_weeks' | 'monthly';

export type ActionItemSubtask = {
    id: string;
    content: string;
    isCompleted: boolean;
    position: number;
};
```

and in the `ActionItem` type, after `themeName: string | null;`:

```ts
    recurrence: ActionItemRecurrence | null;
    previousOccurrenceId: string | null;
    subtasks: ActionItemSubtask[];
```

In `resources/js/lib/action-items/endpoints.ts` add the imports

```ts
import ActionItemSubtasksController from '@/actions/App/Http/Controllers/Retros/ActionItemSubtasksController';
import WorkspaceActionItemSubtasksController from '@/actions/App/Http/Controllers/WorkspaceActionItemSubtasksController';
```

add to the `ActionItemEndpoints` type:

```ts
    addSubtask: (actionItemId: string) => EndpointRoute;
    updateSubtask: (subtaskId: string) => EndpointRoute;
    destroySubtask: (subtaskId: string) => EndpointRoute;
```

add to the object returned by `boardActionItemEndpoints`:

```ts
        addSubtask: (actionItem) =>
            ActionItemSubtasksController.store({ retro: retroId, actionItem }),
        updateSubtask: (actionItemSubtask) =>
            ActionItemSubtasksController.update({
                retro: retroId,
                actionItemSubtask,
            }),
        destroySubtask: (actionItemSubtask) =>
            ActionItemSubtasksController.destroy({
                retro: retroId,
                actionItemSubtask,
            }),
```

and to the object returned by `workspaceActionItemEndpoints`:

```ts
        addSubtask: (actionItem) =>
            WorkspaceActionItemSubtasksController.store({
                workspace,
                actionItem,
            }),
        updateSubtask: (actionItemSubtask) =>
            WorkspaceActionItemSubtasksController.update({
                workspace,
                actionItemSubtask,
            }),
        destroySubtask: (actionItemSubtask) =>
            WorkspaceActionItemSubtasksController.destroy({
                workspace,
                actionItemSubtask,
            }),
```

- [ ] **Step 2: Recurrence controls**

`resources/js/components/action-items/recurrence-select.tsx`:

```tsx
import { usePage } from '@inertiajs/react';
import { Repeat } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import { formatShortDate } from '@/lib/action-items/format';
import type { ActionItem, ActionItemRecurrence } from '@/lib/retro/types';

const DoesNotRepeat = 'none';

export const Recurrences: ActionItemRecurrence[] = [
    'weekly',
    'every_two_weeks',
    'monthly',
];

/** Translation keys, passed to t() through a variable. */
const RecurrenceLabels: Record<ActionItemRecurrence, string> = {
    weekly: 'Weekly',
    every_two_weeks: 'Every 2 weeks',
    monthly: 'Monthly',
};

/** Translation keys, passed to t() through a variable. */
const RepeatLabels: Record<ActionItemRecurrence, string> = {
    weekly: 'Repeats weekly',
    every_two_weeks: 'Repeats every 2 weeks',
    monthly: 'Repeats monthly',
};

type Props = {
    value: ActionItemRecurrence | null;
    disabled?: boolean;
    onChange: (recurrence: ActionItemRecurrence | null) => void;
};

export function RecurrenceSelect({ value, disabled, onChange }: Props) {
    const { t } = useTrans();

    return (
        <Select
            value={value ?? DoesNotRepeat}
            disabled={disabled}
            onValueChange={(next) =>
                onChange(
                    next === DoesNotRepeat ? null : (next as ActionItemRecurrence),
                )
            }
        >
            <SelectTrigger size="sm" className="w-full" aria-label={t('Repeat')}>
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={DoesNotRepeat}>
                    {t('Does not repeat')}
                </SelectItem>
                {Recurrences.map((recurrence) => (
                    <SelectItem key={recurrence} value={recurrence}>
                        {t(RecurrenceLabels[recurrence])}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

export function RecurrenceBadge({
    item,
}: {
    item: Pick<ActionItem, 'recurrence' | 'previousOccurrenceId' | 'createdAt'>;
}) {
    const { t } = useTrans();
    const { locale } = usePage().props;

    if (item.recurrence === null) {
        return null;
    }

    return (
        <span className="flex items-center gap-1">
            <Repeat className="size-3" aria-hidden="true" />
            {t(RepeatLabels[item.recurrence])}
            {item.previousOccurrenceId && item.createdAt && (
                <span>
                    ·{' '}
                    {t('Follows up the item completed on :date', {
                        date: formatShortDate(item.createdAt, locale),
                    })}
                </span>
            )}
        </span>
    );
}
```

- [ ] **Step 3: Sub-task checklist**

`resources/js/components/action-items/subtask-checklist.tsx`:

```tsx
import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useTrans } from '@/hooks/use-trans';
import type {
    ActionItemEndpoints,
    EndpointRoute,
} from '@/lib/action-items/endpoints';
import { retroRequest } from '@/lib/retro/api';
import type { ActionItem } from '@/lib/retro/types';
import type { RunMutation } from './action-item-card';

const MaxSubtasks = 20;

type Props = {
    item: ActionItem;
    endpoints: ActionItemEndpoints;
    run: RunMutation;
    canManage: boolean;
    canCheck: boolean;
    onSaved: (item: ActionItem) => void;
};

export function SubtaskChecklist({
    item,
    endpoints,
    run,
    canManage,
    canCheck,
    onSaved,
}: Props) {
    const { t } = useTrans();
    const [draft, setDraft] = useState('');
    const [editing, setEditing] = useState<{
        id: string;
        content: string;
    } | null>(null);
    const [busy, setBusy] = useState(false);
    const subtasks = item.subtasks;

    const send = async (
        route: EndpointRoute,
        data?: Record<string, unknown>,
    ): Promise<boolean> => {
        if (busy) {
            return false;
        }

        setBusy(true);
        const response = await run(
            retroRequest<{ actionItem: ActionItem }>(route, data),
        );
        setBusy(false);

        if (!response) {
            return false;
        }

        onSaved(response.actionItem);

        return true;
    };

    const add = async () => {
        const content = draft.trim();

        if (content === '') {
            return;
        }

        if (await send(endpoints.addSubtask(item.id), { content })) {
            setDraft('');
        }
    };

    const rename = async () => {
        const content = editing?.content.trim() ?? '';

        if (editing === null || content === '') {
            return;
        }

        if (await send(endpoints.updateSubtask(editing.id), { content })) {
            setEditing(null);
        }
    };

    if (subtasks.length === 0 && !canManage) {
        return null;
    }

    return (
        <div className="space-y-1 pl-6">
            <ul className="space-y-1" aria-label={t('Sub-tasks')}>
                {subtasks.map((subtask, index) => (
                    <li
                        key={subtask.id}
                        className="flex items-center gap-1 text-sm"
                    >
                        <Checkbox
                            checked={subtask.isCompleted}
                            disabled={busy || !canCheck}
                            aria-label={subtask.content}
                            onCheckedChange={(checked) =>
                                void send(endpoints.updateSubtask(subtask.id), {
                                    status:
                                        checked === true ? 'completed' : 'open',
                                })
                            }
                        />
                        {editing?.id === subtask.id ? (
                            <form
                                className="flex flex-1 gap-1"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    void rename();
                                }}
                            >
                                <Input
                                    autoFocus
                                    value={editing.content}
                                    maxLength={200}
                                    className="h-7"
                                    aria-label={t('Edit sub-task')}
                                    onChange={(event) =>
                                        setEditing({
                                            id: subtask.id,
                                            content: event.target.value,
                                        })
                                    }
                                    onKeyDown={(event) => {
                                        if (event.key === 'Escape') {
                                            event.preventDefault();
                                            setEditing(null);
                                        }
                                    }}
                                />
                                <Button type="submit" size="sm" disabled={busy}>
                                    {t('Save')}
                                </Button>
                            </form>
                        ) : (
                            <span
                                className={`min-w-0 flex-1 break-words ${subtask.isCompleted ? 'text-muted-foreground line-through' : ''}`}
                            >
                                {subtask.content}
                            </span>
                        )}
                        {canManage && editing?.id !== subtask.id && (
                            <>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-6"
                                    disabled={busy || index === 0}
                                    aria-label={t('Move up')}
                                    onClick={() =>
                                        void send(
                                            endpoints.updateSubtask(subtask.id),
                                            { position: index - 1 },
                                        )
                                    }
                                >
                                    <ArrowUp className="size-3" />
                                </Button>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-6"
                                    disabled={
                                        busy || index === subtasks.length - 1
                                    }
                                    aria-label={t('Move down')}
                                    onClick={() =>
                                        void send(
                                            endpoints.updateSubtask(subtask.id),
                                            { position: index + 1 },
                                        )
                                    }
                                >
                                    <ArrowDown className="size-3" />
                                </Button>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-6"
                                    aria-label={t('Edit sub-task')}
                                    onClick={() =>
                                        setEditing({
                                            id: subtask.id,
                                            content: subtask.content,
                                        })
                                    }
                                >
                                    <Pencil className="size-3" />
                                </Button>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="size-6"
                                    disabled={busy}
                                    aria-label={t('Delete sub-task')}
                                    onClick={() =>
                                        void send(
                                            endpoints.destroySubtask(subtask.id),
                                        )
                                    }
                                >
                                    <Trash2 className="size-3" />
                                </Button>
                            </>
                        )}
                    </li>
                ))}
            </ul>
            {canManage && subtasks.length < MaxSubtasks && (
                <form
                    className="flex gap-1"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void add();
                    }}
                >
                    <Input
                        value={draft}
                        maxLength={200}
                        className="h-7"
                        placeholder={t('Add a sub-task')}
                        aria-label={t('Add a sub-task')}
                        onChange={(event) => setDraft(event.target.value)}
                    />
                    <Button
                        type="submit"
                        size="sm"
                        variant="outline"
                        disabled={busy || draft.trim() === ''}
                    >
                        {t('Add')}
                    </Button>
                </form>
            )}
        </div>
    );
}
```

- [ ] **Step 4: Card and form**

In `resources/js/components/action-items/action-item-card.tsx`:
- add `import { RecurrenceBadge, RecurrenceSelect } from './recurrence-select';` and `import { SubtaskChecklist } from './subtask-checklist';`;
- after `const completed = item.status === 'completed';` add:

```tsx
    const completedSubtasks = item.subtasks.filter(
        (subtask) => subtask.isCompleted,
    ).length;
```

- in the meta line, right after `<DueDateChip item={item} />`, add:

```tsx
                        <RecurrenceBadge item={item} />
                        {item.subtasks.length > 0 && (
                            <span
                                aria-label={t(':done of :total sub-tasks done', {
                                    done: completedSubtasks,
                                    total: item.subtasks.length,
                                })}
                            >
                                {completedSubtasks}/{item.subtasks.length}
                            </span>
                        )}
```

- replace `{children}` with:

```tsx
            <SubtaskChecklist
                item={item}
                endpoints={endpoints}
                run={run}
                canManage={manages}
                canCheck={completes}
                onSaved={onSaved}
            />
            {children}
```

- right after the closing `</div>` of the priority/due-date grid, add:

```tsx
            <RecurrenceSelect
                value={item.recurrence}
                disabled={busy || !manages || item.dueOn === null}
                onChange={(recurrence) => void patch({ recurrence })}
            />
```

In `resources/js/components/action-items/action-item-form.tsx`:
- add `import { RecurrenceSelect } from './recurrence-select';` and import `ActionItemRecurrence` next to `ActionItemPriority` from `@/lib/retro/types`;
- add `recurrence: ActionItemRecurrence | null;` to `ActionItemDraft` (after `dueOn`), `recurrence: null,` to `emptyActionItemDraft()` and `recurrence: draft.recurrence,` to `actionItemPayload()` (after `due_on`);
- replace the due date `onChange` with:

```tsx
                    onChange={(event) =>
                        update({
                            dueOn: event.target.value,
                            ...(event.target.value === ''
                                ? { recurrence: null }
                                : {}),
                        })
                    }
```

- right after the priority/due-date grid add:

```tsx
            <RecurrenceSelect
                value={draft.recurrence}
                disabled={disabled || sending || draft.dueOn === ''}
                onChange={(recurrence) => update({ recurrence })}
            />
```

- [ ] **Step 5: Translations**

`Weekly`, `Every 2 weeks`, `Monthly` and the three `Repeats …` keys reach `t()` through variables; keep every row (the `Repeats …` keys exist since Task 4).

| Key | fr | es | de |
|---|---|---|---|
| `Repeat` | `Répétition` | `Repetición` | `Wiederholung` |
| `Does not repeat` | `Ne se répète pas` | `No se repite` | `Wiederholt sich nicht` |
| `Weekly` | `Chaque semaine` | `Cada semana` | `Wöchentlich` |
| `Every 2 weeks` | `Toutes les 2 semaines` | `Cada 2 semanas` | `Alle 2 Wochen` |
| `Monthly` | `Chaque mois` | `Cada mes` | `Monatlich` |
| `Follows up the item completed on :date` | `Fait suite à l'action terminée le :date` | `Da continuidad a la acción completada el :date` | `Folgt auf den am :date abgeschlossenen Aktionspunkt` |
| `Sub-tasks` | `Sous-tâches` | `Subtareas` | `Unteraufgaben` |
| `Add a sub-task` | `Ajouter une sous-tâche` | `Añadir una subtarea` | `Unteraufgabe hinzufügen` |
| `Edit sub-task` | `Modifier la sous-tâche` | `Editar la subtarea` | `Unteraufgabe bearbeiten` |
| `Delete sub-task` | `Supprimer la sous-tâche` | `Eliminar la subtarea` | `Unteraufgabe löschen` |
| `:done of :total sub-tasks done` | `:done sous-tâches terminées sur :total` | `:done de :total subtareas hechas` | `:done von :total Unteraufgaben erledigt` |

- [ ] **Step 6: Checks**

Run: `npx vp check --fix resources/js/lib/retro/types.ts resources/js/lib/action-items/endpoints.ts resources/js/components/action-items && npm run types:check && npm run check && vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: PASS (known pre-existing lint failures only).

- [ ] **Step 7: Commit**

```bash
git add resources/js/lib/retro/types.ts resources/js/lib/action-items/endpoints.ts resources/js/components/action-items lang
git commit -m "feat: repeat action items and tick off their sub-tasks from every surface

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 11: Notification bell, sidebar badge and settings page

**Files:**
- Create: `resources/js/components/notification-bell.tsx`, `resources/js/pages/settings/notifications.tsx`
- Modify: `resources/js/types/index.d.ts`, `resources/js/types/navigation.ts`, `resources/js/lib/action-items/format.ts`, `resources/js/components/app-sidebar-header.tsx`, `resources/js/components/nav-main.tsx`, `resources/js/components/app-sidebar.tsx`, `resources/js/layouts/settings/layout.tsx`, `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: shared props `notifications`, `actionItems` and routes `notifications.*` (Task 9); `notificationPreferences.*` (Task 5); Wayfinder `NotificationsController`, `ReadAllNotificationsController`, `Settings/NotificationPreferencesController`, named routes `@/routes/notificationPreferences`.
- Produces: `NotificationBell()` in the sidebar layout header — unread badge (hidden at 0, "9+" above 9), dropdown fetching `/notifications` on open with rows "Overdue: :content" / "Due today: :content" / "Due tomorrow: :content", team and relative time, unread rows bold, "Mark all as read", empty state "No notifications."; clicking a row marks it read and visits its deep link; the shared counts refresh on window focus. `NavItem.badge?: number` rendered as a red `SidebarMenuBadge`; the "Action items" entry carries `actionItems.overdueAssignedCount`. Settings page `settings/notifications` with the two switches (checkboxes) and "Reminders are sent at :time for action items assigned to you.", saved with `useForm(...).submit(NotificationPreferencesController.update())`; settings navigation entry "Notifications". `formatRelativeTime(iso: string, locale: string, now: number): string` in `resources/js/lib/action-items/format.ts`.

- [ ] **Step 1: Shared prop types and navigation badge**

In `resources/js/types/index.d.ts`, inside `sharedPageProps`, after `currentWorkspace: CurrentWorkspace | null;`:

```ts
            notifications: { unreadCount: number } | null;
            actionItems: { overdueAssignedCount: number } | null;
```

In `resources/js/types/navigation.ts` add `badge?: number;` to `NavItem`.

In `resources/js/components/nav-main.tsx` add `SidebarMenuBadge` to the `@/components/ui/sidebar` import and, inside `SidebarMenuItem` after the closing `</SidebarMenuButton>`:

```tsx
                        {item.badge !== undefined && item.badge > 0 && (
                            <SidebarMenuBadge
                                className="bg-red-600 text-white peer-hover/menu-button:text-white"
                                aria-label={t(':count overdue', {
                                    count: item.badge,
                                })}
                            >
                                {item.badge > 99 ? '99+' : item.badge}
                            </SidebarMenuBadge>
                        )}
```

In `resources/js/components/app-sidebar.tsx` replace `const { currentWorkspace } = usePage().props;` with `const { currentWorkspace, actionItems } = usePage().props;` and add `badge: actionItems?.overdueAssignedCount,` to the "Action items" entry pushed in Task 2.

- [ ] **Step 2: Relative time**

Append to `resources/js/lib/action-items/format.ts`:

```ts
const RelativeUnits: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
];

export function formatRelativeTime(
    iso: string,
    locale: string,
    now: number,
): string {
    const elapsed = new Date(iso).getTime() - now;
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

    for (const [unit, size] of RelativeUnits) {
        if (Math.abs(elapsed) >= size) {
            return formatter.format(Math.round(elapsed / size), unit);
        }
    }

    return formatter.format(0, 'minute');
}
```

- [ ] **Step 3: The bell**

`resources/js/components/notification-bell.tsx`:

```tsx
import { router, usePage } from '@inertiajs/react';
import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import NotificationsController from '@/actions/App/Http/Controllers/NotificationsController';
import ReadAllNotificationsController from '@/actions/App/Http/Controllers/ReadAllNotificationsController';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTrans } from '@/hooks/use-trans';
import { formatRelativeTime } from '@/lib/action-items/format';
import { retroRequest } from '@/lib/retro/api';

type Wording = 'overdue' | 'due_today' | 'due_tomorrow';

type BellNotification = {
    id: string;
    kind: 'due_soon' | 'overdue';
    wording: Wording;
    readAt: string | null;
    createdAt: string;
    actionItem: {
        id: string;
        content: string;
        teamName: string;
        dueOn: string | null;
        isOverdue: boolean;
        url: string;
    };
};

/** Translation keys, passed to t() through a variable. */
const WordingLabels: Record<Wording, string> = {
    overdue: 'Overdue: :content',
    due_today: 'Due today: :content',
    due_tomorrow: 'Due tomorrow: :content',
};

const SharedCounts = ['notifications', 'actionItems'];

function refreshCounts() {
    router.reload({ only: SharedCounts });
}

export function NotificationBell() {
    const { t } = useTrans();
    const { notifications, locale } = usePage().props;
    const shared = notifications?.unreadCount ?? 0;
    const [unread, setUnread] = useState(shared);
    const [knownShared, setKnownShared] = useState(shared);
    const [items, setItems] = useState<BellNotification[] | null>(null);
    const [loadedAt, setLoadedAt] = useState(0);

    if (knownShared !== shared) {
        setKnownShared(shared);
        setUnread(shared);
    }

    useEffect(() => {
        window.addEventListener('focus', refreshCounts);

        return () => window.removeEventListener('focus', refreshCounts);
    }, []);

    if (notifications === null) {
        return null;
    }

    const load = async () => {
        try {
            const response = await retroRequest<{
                notifications: BellNotification[];
                unreadCount: number;
            }>(NotificationsController.index());

            setItems(response.notifications);
            setUnread(response.unreadCount);
            setLoadedAt(Date.now());
        } catch {
            toast.error(t('Something went wrong. Please try again.'));
        }
    };

    const open = async (notification: BellNotification) => {
        if (notification.readAt === null) {
            try {
                const response = await retroRequest<{ unreadCount: number }>(
                    NotificationsController.update(notification.id),
                    { read: true },
                );

                setUnread(response.unreadCount);
            } catch {
                // Visiting the item matters more than the read mark.
            }
        }

        router.visit(notification.actionItem.url);
    };

    const readAll = async () => {
        try {
            await retroRequest(ReadAllNotificationsController.store());
            setUnread(0);
            setItems(
                (current) =>
                    current?.map((notification) => ({
                        ...notification,
                        readAt: notification.readAt ?? new Date().toISOString(),
                    })) ?? null,
            );
        } catch {
            toast.error(t('Something went wrong. Please try again.'));
        }
    };

    return (
        <DropdownMenu
            onOpenChange={(isOpen) => {
                if (isOpen) {
                    void load();
                }
            }}
        >
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative"
                    aria-label={t('Notifications')}
                >
                    <Bell className="size-5" />
                    {unread > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
                            {unread > 9 ? '9+' : unread}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between gap-2">
                    {t('Notifications')}
                    <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0"
                        disabled={unread === 0}
                        onClick={() => void readAll()}
                    >
                        {t('Mark all as read')}
                    </Button>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {items === null && (
                    <p className="px-2 py-1.5 text-sm text-muted-foreground">
                        {t('Loading…')}
                    </p>
                )}
                {items?.length === 0 && (
                    <p className="px-2 py-1.5 text-sm text-muted-foreground">
                        {t('No notifications.')}
                    </p>
                )}
                {items?.map((notification) => (
                    <DropdownMenuItem
                        key={notification.id}
                        className="flex flex-col items-start gap-0.5"
                        onSelect={() => void open(notification)}
                    >
                        <span
                            className={`break-words ${notification.readAt === null ? 'font-semibold' : ''}`}
                        >
                            {t(WordingLabels[notification.wording], {
                                content: notification.actionItem.content,
                            })}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {notification.actionItem.teamName} ·{' '}
                            {formatRelativeTime(
                                notification.createdAt,
                                locale,
                                loadedAt,
                            )}
                        </span>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
```

In `resources/js/components/app-sidebar-header.tsx` add `import { NotificationBell } from '@/components/notification-bell';` and, after the inner `<div className="flex items-center gap-2">…</div>`:

```tsx
            <div className="ml-auto">
                <NotificationBell />
            </div>
```

- [ ] **Step 4: Settings page and navigation**

`resources/js/pages/settings/notifications.tsx`:

```tsx
import { Head, useForm } from '@inertiajs/react';
import NotificationPreferencesController from '@/actions/App/Http/Controllers/Settings/NotificationPreferencesController';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useTrans } from '@/hooks/use-trans';
import { edit as editNotifications } from '@/routes/notificationPreferences';

type Preferences = {
    action_item_reminders_by_email: boolean;
    action_item_reminders_in_app: boolean;
};

type Props = {
    preferences: Preferences;
    reminderTime: string;
    remindersEnabled: boolean;
};

export default function NotificationSettings({
    preferences,
    reminderTime,
    remindersEnabled,
}: Props) {
    const { t } = useTrans();
    const form = useForm<Preferences>(preferences);

    return (
        <>
            <Head title={t('Notification settings')} />

            <h1 className="sr-only">{t('Notification settings')}</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title={t('Action item reminders')}
                    description={t(
                        'Reminders are sent at :time for action items assigned to you.',
                        { time: reminderTime },
                    )}
                />

                {!remindersEnabled && (
                    <p className="text-sm text-muted-foreground">
                        {t('Reminders are turned off on this instance.')}
                    </p>
                )}

                <form
                    className="space-y-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        form.submit(NotificationPreferencesController.update(), {
                            preserveScroll: true,
                        });
                    }}
                >
                    <div className="flex items-center gap-3">
                        <Checkbox
                            id="action-item-reminders-by-email"
                            checked={form.data.action_item_reminders_by_email}
                            onCheckedChange={(checked) =>
                                form.setData(
                                    'action_item_reminders_by_email',
                                    checked === true,
                                )
                            }
                        />
                        <Label htmlFor="action-item-reminders-by-email">
                            {t('Email me about due and overdue action items')}
                        </Label>
                    </div>
                    <div className="flex items-center gap-3">
                        <Checkbox
                            id="action-item-reminders-in-app"
                            checked={form.data.action_item_reminders_in_app}
                            onCheckedChange={(checked) =>
                                form.setData(
                                    'action_item_reminders_in_app',
                                    checked === true,
                                )
                            }
                        />
                        <Label htmlFor="action-item-reminders-in-app">
                            {t(
                                'Show due and overdue action items in the notification bell',
                            )}
                        </Label>
                    </div>
                    <Button disabled={form.processing}>{t('Save')}</Button>
                </form>
            </div>
        </>
    );
}

NotificationSettings.layout = {
    breadcrumbs: [
        {
            title: 'Notification settings',
            href: editNotifications(),
        },
    ],
};
```

In `resources/js/layouts/settings/layout.tsx` add `import { edit as editNotifications } from '@/routes/notificationPreferences';` and append to `sidebarNavItems`:

```ts
    {
        title: 'Notifications',
        href: editNotifications(),
        icon: null,
    },
```

- [ ] **Step 5: Translations**

`Notifications` (settings navigation) and the three `…: :content` keys reach `t()` through variables; keep every row.

| Key | fr | es | de |
|---|---|---|---|
| `Notifications` | `Notifications` | `Notificaciones` | `Benachrichtigungen` |
| `Mark all as read` | `Tout marquer comme lu` | `Marcar todo como leído` | `Alle als gelesen markieren` |
| `No notifications.` | `Aucune notification.` | `No hay notificaciones.` | `Keine Benachrichtigungen.` |
| `Overdue: :content` | `En retard : :content` | `Vencida: :content` | `Überfällig: :content` |
| `Due today: :content` | `Pour aujourd'hui : :content` | `Vence hoy: :content` | `Heute fällig: :content` |
| `Due tomorrow: :content` | `Pour demain : :content` | `Vence mañana: :content` | `Morgen fällig: :content` |
| `:count overdue` | `:count en retard` | `:count vencidas` | `:count überfällig` |
| `Action item reminders` | `Rappels des actions` | `Recordatorios de acciones` | `Erinnerungen an Aktionspunkte` |
| `Reminders are sent at :time for action items assigned to you.` | `Les rappels sont envoyés à :time pour les actions qui vous sont assignées.` | `Los recordatorios se envían a las :time para las acciones asignadas a ti.` | `Erinnerungen werden um :time für Aktionspunkte verschickt, die dir zugewiesen sind.` |
| `Reminders are turned off on this instance.` | `Les rappels sont désactivés sur cette instance.` | `Los recordatorios están desactivados en esta instancia.` | `Erinnerungen sind auf dieser Instanz ausgeschaltet.` |
| `Email me about due and overdue action items` | `M'envoyer un e-mail pour les actions à échéance ou en retard` | `Enviarme un correo sobre las acciones que vencen o están vencidas` | `Mir E-Mails zu fälligen und überfälligen Aktionspunkten senden` |
| `Show due and overdue action items in the notification bell` | `Afficher les actions à échéance ou en retard dans la cloche de notifications` | `Mostrar las acciones que vencen o están vencidas en la campana de notificaciones` | `Fällige und überfällige Aktionspunkte in der Benachrichtigungsglocke anzeigen` |

- [ ] **Step 6: Checks**

Run: `npx vp check --fix resources/js/components/notification-bell.tsx resources/js/pages/settings/notifications.tsx resources/js/types/index.d.ts resources/js/types/navigation.ts resources/js/lib/action-items/format.ts resources/js/components/app-sidebar-header.tsx resources/js/components/nav-main.tsx resources/js/components/app-sidebar.tsx resources/js/layouts/settings/layout.tsx && npm run types:check && npm run check && vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php tests/Feature/Settings/NotificationPreferencesTest.php`
Expected: PASS (known pre-existing lint failures only).

- [ ] **Step 7: Commit**

```bash
git add resources/js/components/notification-bell.tsx resources/js/pages/settings/notifications.tsx resources/js/types/index.d.ts resources/js/types/navigation.ts resources/js/lib/action-items/format.ts resources/js/components/app-sidebar-header.tsx resources/js/components/nav-main.tsx resources/js/components/app-sidebar.tsx resources/js/layouts/settings/layout.tsx lang
git commit -m "feat: add the notification bell, the overdue badge and notification settings

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01SosW8d2Uj7QxsF1tws5ssS"
```

---

### Task 12: Verification (controller-driven)

- [ ] **Step 1:** `vendor/bin/sail artisan test --compact tests/Feature/ActionItems tests/Feature/Retros tests/Feature/Settings tests/Feature/Teams tests/Feature/TranslationKeysTest.php` — all green.
- [ ] **Step 2:** `vendor/bin/sail bin phpstan analyse --no-progress` — 0 errors; `vendor/bin/sail bin pint --dirty --format agent` — clean.
- [ ] **Step 3:** `npm run types:check && npm run check` — only the known pre-existing failures.
- [ ] **Step 4:** Ask the user to run the full suite: `vendor/bin/sail artisan test --compact`.
- [ ] **Step 5: Walkthrough** (two member browsers and a guest; `npm run dev` or `npm run build`; `MAIL_MAILER=log`):
  1. Complete a retro that has open items, then start a new retro of the same team: the member's "Previous action items" sheet opens once in `Writing`; complete a carried item — the second member's sheet updates live; reload: it does not open again. The guest sees no button and no carried item.
  2. Global page (sidebar "Action items", below "Teams"; also "Open action items (n)" on the team page): filters (status, assignee, team) change the URL; leave and come back through the sidebar — the last filters are restored. Open `?item={id}` of a completed item that the filter hides — it is pinned as "Linked action item" and expanded. Reassign a guest item to a member.
  3. Keep the global page open in the second member browser; create an item outside a retro in the first ("New action item"): it appears within about a second in the second browser; it later shows under "Added outside a retro" in the team's next retro.
  4. On the global page add sub-tasks to an item, reorder them with the arrows, tick one: the card shows "1/3" and the second browser updates live; the assignee (not a manager) can tick but sees no add/edit/delete controls.
  5. Set a due date and "Weekly" on an item, complete it: a new open occurrence appears ("Added outside a retro", repeat icon, "Follows up the item completed on …", due one week later, sub-tasks unticked). Reopen and complete the first again: no second successor. Set "Does not repeat" on the new one and complete it: nothing new.
  6. Assign yourself an item due today and one overdue by three days; run `vendor/bin/sail artisan action-items:send-reminders`: the output lists you and the summary; the log shows one digest e-mail in your language with "Overdue" before "Due soon"; the bell shows 2; the sidebar "Action items" badge shows 1. Opening a bell entry marks it read and deep-links to the item. Run the command again: nothing is sent.
  7. In `/settings/notifications` turn e-mail off, save ("Notification settings saved."), move an item's due date to tomorrow and rerun the command: only a bell entry appears, no e-mail.
  8. Complete a reminded item: its bell entry turns read.

## Notes

- The notifications `data` column is `json` (the framework migration uses `text`) so reminders can be matched with `where('data->actionItemId', …)`; Laravel's `DatabaseNotification` casts it to an array either way.
- The digest's "View my open action items" button points to the workspace of its first item; items of other workspaces keep their own `?item=` links.
- No realtime bell badge (spec §1 out of scope): counts refresh on navigation and window focus.

## Spec coverage

| Spec | Task |
|---|---|
| §3 carry-over panel listing, "View all on the action items page" when capped | 1 |
| §3.1 display "Added outside a retro" (carry-over group, global page source column) | 1, 2 |
| §5 global page subscription to `private-team-action-items.{teamId}` (re-subscribe on team filter, `toOthers()` via `X-Socket-ID`) | 2 |
| §6 filters remembered in `localStorage` (`skrum.actionItemFilters.{workspaceId}`), query-string driven filters, pagination | 2 |
| §8 carry-over panel (button with open count, non-guests, not in `Completed`, sheet grouped by source retro, auto-open once in `Writing`, footer link) | 1 |
| §8 global page (sidebar entry, filter bar, "New action item" dialog, rows, `?item=` deep link, live updates, empty states), team page "Open action items (n)" | 2 |
| §2 `action_item_subtasks` (table, one level, max 20, `ActionItemSubtask`, `completed()`), factory `withSubtasks` | 3 |
| §2 recurrence behaviour: enum `ActionItemRecurrence` (`advance`, `label`), `previousOccurrence`/`nextOccurrence`, factory `recurring` | 4 |
| §2 `action_item_reminders`, `notifications` (UUID morph, `json` data), `users` preference columns | 5 |
| §3.2 recurrence (due date required, managers only, completion-based regeneration in the same transaction, advance until ≥ today, month-end clamp, member assignee kept, guest/former member dropped, author fields copied, `retro_id` null, sub-tasks copied unchecked, no comments, one successor, stop with "Does not repeat", successor announced) | 4, 10 |
| §3.3 sub-tasks (managers structure, completers tick, surface rules, 422 limit/length, no automation, progress, touch + broadcast whole item) | 3, 10 |
| §3.4 who/when/what is due, `insertOrIgnore` log, digest (sections, 20 + "and :count more", links, footer), in-app per item, preferences, translations and locale, bell list with live permission check, mark read on open and on completion, sidebar badge, opt-out page, housekeeping, progress output, schedule and config | 5, 6, 7, 8, 9, 11 |
| §5 sub-task endpoints (board and workspace), `recurrence` on create/update bodies, payload `recurrence`/`previousOccurrenceId`/`subtasks` | 3, 4 |
| §5 notification (incl. `wording`) and settings endpoints, route names | 5, 9 |
| §7 reminders only to the member assignee, no comments/authors in e-mails, ids-only in-app rows, instance mailer; sub-tasks/recurrence follow item visibility | 6, 7, 9 |
| §8 repeat select (create form and edit), repeat icon and label, sub-task checklist and progress, bell (sidebar-layout header), settings page (checkboxes), settings navigation, sidebar badge | 10, 11 |
| §10 scheduler runs `action-items:send-reminders`; `.env.example` documents `SKRUM_ACTION_ITEM_REMINDERS` and `SKRUM_ACTION_ITEM_REMINDER_TIME` | 5, 8 |
| §11 recurrence 422s, completion rolled back with the regeneration (same transaction), sub-task 422/404, notification 404, dropped stale notifications, reminder row kept when a mail job fails; toasts on the global page and carry-over panel | 1, 2, 3, 4, 7, 9 |
| §12 tests: recurrence, sub-tasks, reminders, notification endpoints, settings; walkthrough (carry-over, global page, scope additions) | 3–9, 12 |
| AC5 (UI), AC6 (panel), AC11 (UI), AC12 (subscription) | 1, 2 |
| AC13 | 5, 6, 7, 8, 9, 11 |
| AC14 | 4, 10 |
| AC15 | 3, 10 |
| AC9 (new strings) | translation rows of Tasks 1–11 |
| AC10 | 12 |
