# Plan 4 — Board UI and Realtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A usable, realtime retrospective board in the browser for members and guests: columns and cards, hidden writing, drag-and-drop moving and grouping, voting, facilitator controls (phases, timer, highlight, settings, guest link, handover, deletion, columns), action items, completed summary, online presence — in four languages.

**Architecture:** The Inertia page `retros/show` receives the server snapshot (Plan 3) and hands it to a `useRetroBoard` hook: a pure reducer holds board state, mutations go through a small JSON client (Inertia's XHR client → CSRF handled, `X-Socket-ID` added), and a presence-channel hook applies broadcast events and refetches the snapshot on phase/settings changes and reconnects. Components are small and phase-aware; drag-and-drop uses @dnd-kit.

**Tech Stack:** React 19, Inertia v3, Wayfinder, Tailwind 4 + existing shadcn/ui components, `@laravel/echo-react` + `laravel-echo` + `pusher-js` (Reverb), `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`, Laravel 13 (small backend additions), Pest.

**Spec:** `docs/superpowers/specs/2026-09-29-retro-board-core-design.md` (§4 Board data flow, phase rules; AC13–AC16 UI side, AC17 UI, AC21–AC30 client side, AC34). Builds on Plans 1–3 on `main`.

This is **plan 4 of 5**. Plan 5 is packaging.

## Global Constraints

- Commands through Sail: `vendor/bin/sail artisan …`, `vendor/bin/sail composer …`, `vendor/bin/sail bin pint --dirty --format agent`, `vendor/bin/sail bin phpstan analyse` (0 errors). npm on the host.
- New dependencies allowed in this plan (npm only): `@laravel/echo-react`, `laravel-echo`, `pusher-js`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`. Nothing else (no new PHP packages).
- Frontend verification (the spec has no browser test runner in v1): every frontend task ends with `vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npm run check` (known pre-existing `npm run check` failures only in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`) **and** the manual check its task describes. Backend changes are TDD with Pest as usual.
- Every user-facing string goes through `t()` from `@/hooks/use-trans` (keys = English text) and is added to `lang/{en,fr,es,de}.json` with real translations; German informal "du". `tests/Feature/TranslationKeysTest.php` must stay green. Dynamic keys (e.g. `t(phaseLabel)`) must be added by hand.
- Use Wayfinder route functions (`@/actions/App/Http/Controllers/Retros/...`) — no hard-coded URLs.
- Board API calls go through `retroRequest()` (Task 2) only.
- Existing UI primitives in `resources/js/components/ui/` (button, input, dialog, dropdown-menu, select, badge, tooltip, avatar, checkbox, separator, sheet, sonner). Add a `textarea.tsx` primitive in Task 3 (shadcn style).
- Follow the project's React style: function components, `type Props`, no default exports except pages, Tailwind utility classes, lucide icons.
- Commit messages: Conventional Commits, ending with exactly:
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01FcMxGGHCZcDTndQCc57VPC`

## Board API facts (from Plan 3 — use exactly)

Snapshot (`GET retros/{retro}/snapshot`, and the `snapshot` page prop):

```
retro: { id, title, template, phase, isAnonymous, votesPerParticipant, guestAccessEnabled,
         facilitatorParticipantId, timerEndsAt, highlightedCardId, completedAt, guestUrl }
viewer: { participantId, isFacilitator, isGuest, remainingVotes }        (+ transferCandidates, Task 1)
columns: [{ id, title, color, position }]
cards: [{ id, columnId, parentCardId, position, isMine, content|null, author|null {id,name}, votes|null, myVotes }]
participants: [{ id, name, avatarUrl, isGuest }]
actionItems: [{ id, content, isDone, assignee|null {id,name} }]
votesCast: number|null
links: { team: string|null }                                             (+ serverTime, Task 1)
```

Mutations (all under `retros/{retro}`; JSON; 403 `{message}` / 422 `{message, errors}`):

| Controller (Wayfinder) | Method | Body | Response |
|---|---|---|---|
| `CardsController.store` | POST | `{column_id, content}` | 201 `{card}` |
| `CardsController.update` | PATCH | `{content}` | `{card}` |
| `CardsController.destroy` | DELETE | — | 204 |
| `CardPositionsController.update` | PUT | `{column_id, index}` | `{cards}` |
| `CardGroupsController.update` | PUT | `{parent_card_id}` | `{cards}` |
| `CardGroupsController.destroy` | DELETE | — | `{cards}` |
| `CardVotesController.store` / `.destroy` | POST / DELETE | — | `{cardId, myVotes, remainingVotes}` |
| `RetroPhasesController.update` | PUT | `{phase}` | `{phase}` |
| `RetroTimersController.update` | PUT | `{seconds|null}` | `{timerEndsAt}` |
| `RetroHighlightsController.update` | PUT | `{card_id|null}` | `{highlightedCardId}` |
| `RetroSettingsController.update` | PATCH | `{title?, is_anonymous?, votes_per_participant?, guest_access_enabled?}` | 204 |
| `RetroGuestTokensController.store` | POST | — | `{guestUrl}` |
| `RetroFacilitatorsController.update` | PUT | `{user_id}` | 204 |
| `RetrosController.destroy` | DELETE | — | 204 |
| `ColumnsController.store` / `.update` / `.destroy` | POST / PATCH / DELETE | `{title, color}` / partial / — | `{columns}` |
| `ColumnOrdersController.update` | PUT | `{column_ids}` | `{columns}` |
| `ActionItemsController.store` / `.update` / `.destroy` | POST / PATCH / DELETE | `{content, assignee_participant_id?}` / `{content?, assignee_participant_id?, is_done?}` / — | `{actionItem}` / `{actionItem}` / 204 |

Broadcast events on presence channel `retro.{id}` (listen with a leading dot, e.g. `.card.created`): `card.created {card}`, `card.updated {card}`, `card.deleted {cardId, ungroupedCards}`, `cards.moved {cards}`, `card.grouped {cards}`, `card.ungrouped {cards}`, `vote.cast {votesCast}`, `vote.retracted {votesCast}`, `phase.changed {phase}`, `timer.changed {timerEndsAt}`, `card.highlighted {cardId}`, `settings.changed {}`, `columns.changed {columns}`, `action-item.saved {actionItem}`, `action-item.deleted {actionItemId}`, `retro.deleted {}`. Broadcast cards have no `votes`/`myVotes` fields. Presence member = `{ id: participantId, info: { name, avatarUrl, isGuest } }`. Channel auth: `POST /broadcasting/auth` `{socket_id, channel_name}` (CSRF required).

## Review Focus

1. **Revoked access** — a guest signed out (guest link regenerated or guest access disabled) or a retro deleted must see a clear "access ended"/"deleted" screen and the client must leave the channel, not keep rendering stale data. Pinned in Task 2 (manual check).
2. **Reconnect** — after the websocket drops and reconnects, the board must refetch the snapshot (missed events) and show a "Reconnecting…" banner while down. Pinned in Task 2.
3. **Hidden and anonymous cards** — the UI must render placeholders for hidden cards (no crash on `content: null`) and never render an author label when `author` is null. Pinned in Task 3.
4. **Failed mutations** — any 403/422/network error shows a translated toast and the board resyncs (refetch) so optimistic changes never stick. Pinned in Tasks 2, 4, 5.
5. **Clock skew** — the timer countdown uses the server clock offset from the snapshot, so participants on skewed clocks see the same remaining time. Pinned in Tasks 1 and 6.

---

## File Structure

```
app/Actions/Retros/BuildBoardSnapshot.php         (modify) serverTime, viewer.transferCandidates
app/Providers/AppServiceProvider.php              (modify) Reverb in `artisan dev` (local)
compose.yaml, .env.example                        (modify) Reverb port for Sail
resources/js/
  app.tsx                                         (modify) configureEcho
  lib/retro/
    types.ts            snapshot / event payload types
    api.ts              retroRequest() + RetroRequestError
    board-reducer.ts    pure reducer + helpers (placeCard, topLevelCards, childrenOf, …)
    colors.ts           column color classes
  hooks/
    use-retro-board.ts  state, refetch, mutations helpers, status
    use-retro-channel.ts presence channel, events, connection status
    use-countdown.ts    timer countdown with server offset
  components/retro/
    board.tsx, board-header.tsx, phase-stepper.tsx, presence-strip.tsx, connection-banner.tsx,
    board-ended.tsx, retro-column.tsx, column-header.tsx, add-column.tsx, retro-card.tsx,
    card-composer.tsx, card-editor.tsx, vote-controls.tsx, vote-progress.tsx, timer-display.tsx,
    timer-control.tsx, facilitator-menu.tsx, settings-dialog.tsx, guest-link-dialog.tsx,
    handover-dialog.tsx, delete-retro-dialog.tsx, action-items-panel.tsx, completed-summary.tsx,
    dnd.tsx (drag helpers)
  components/ui/textarea.tsx
  pages/retros/show.tsx                           (rewrite)
tests/Feature/Retros/BoardSnapshotTest.php        (modify)
```

---

### Task 1: Snapshot additions and realtime dev setup

**Files:**
- Modify: `app/Actions/Retros/BuildBoardSnapshot.php`, `app/Providers/AppServiceProvider.php`, `compose.yaml`, `.env.example`
- Test: `tests/Feature/Retros/BoardSnapshotTest.php`

**Interfaces:**
- Produces: snapshot `serverTime` (ISO-8601 with milliseconds, UTC) and `viewer.transferCandidates: {userId, name}[]` — for the facilitator only (empty array otherwise): every user who may view the retro's team (team members + workspace Owners/Admins), excluding the facilitator's own user, sorted by name.

- [ ] **Step 1: Write the failing tests** — append to `tests/Feature/Retros/BoardSnapshotTest.php`:

```php
it('reports the server time for clock offsets', function () {
    $retro = Retro::factory()->create();
    [, $viewer] = retroMember($retro);
    $this->freezeTime();

    expect(snapshotFor($retro, $viewer)['serverTime'])->toBe(now()->utc()->format('Y-m-d\TH:i:s.v\Z'));
});

it('lists handover candidates for the facilitator only', function () {
    $retro = Retro::factory()->create();
    [$facilitatorUser, $facilitator] = retroFacilitator($retro);
    [$memberUser, $member] = retroMember($retro);
    $admin = App\Models\User::factory()->create(['name' => 'Aaron Admin']);
    $retro->team->workspace->members()->attach($admin, ['role' => App\Enums\WorkspaceRole::Admin->value]);
    $outsider = App\Models\User::factory()->create();
    $retro->team->workspace->members()->attach($outsider, ['role' => App\Enums\WorkspaceRole::Member->value]);

    $candidates = snapshotFor($retro, $facilitator)['viewer']['transferCandidates'];

    expect(collect($candidates)->pluck('userId')->all())->toBe([$admin->id, $memberUser->id])
        ->and(collect($candidates)->pluck('userId'))->not->toContain($facilitatorUser->id)
        ->and(collect($candidates)->pluck('userId'))->not->toContain($outsider->id)
        ->and(snapshotFor($retro, $member)['viewer']['transferCandidates'])->toBe([]);
});
```

(Adjust the expected order if `$memberUser->name` sorts before "Aaron Admin" — sort both by name in the assertion instead: `->toBe(collect([$admin, $memberUser])->sortBy('name')->pluck('id')->values()->all())`.)

- [ ] **Step 2: Run to verify failure** — `vendor/bin/sail artisan test --compact tests/Feature/Retros/BoardSnapshotTest.php` → FAIL (missing keys).

- [ ] **Step 3: Implement**

In `BuildBoardSnapshot::handle()` add to the returned array `'serverTime' => now()->utc()->format('Y-m-d\TH:i:s.v\Z'),` and to `viewer`: `'transferCandidates' => $retro->isFacilitator($viewer) ? $this->transferCandidates($retro, $viewer) : [],` with:

```php
/**
 * @return array<int, array{
 *     userId: string,
 *     name: string
 * }>
 */
private function transferCandidates(Retro $retro, Participant $viewer): array
{
    $team = $retro->team;

    $managerIds = $team->workspace->members()
        ->wherePivotIn('role', [WorkspaceRole::Owner->value, WorkspaceRole::Admin->value])
        ->pluck('users.id');

    return User::query()
        ->where(fn ($query) => $query
            ->whereIn('id', $team->members()->select('users.id'))
            ->orWhereIn('id', $managerIds))
        ->when($viewer->user_id !== null, fn ($query) => $query->whereKeyNot($viewer->user_id))
        ->orderBy('name')
        ->get(['id', 'name'])
        ->map(fn (User $user) => ['userId' => $user->id, 'name' => $user->name])
        ->all();
}
```

(imports `App\Enums\WorkspaceRole`, `App\Models\User`).

- [ ] **Step 4: Reverb for local development**

`app/Providers/AppServiceProvider.php` `boot()` — add:

```php
if ($this->app->environment('local')) {
    DevCommands::artisan('reverb:start --host=0.0.0.0 --port=8080', 'reverb');
}
```

(import `Illuminate\Foundation\DevCommands`; `DevCommands::artisan` is a no-op outside the console). `compose.yaml` — under `laravel.test.ports` add `- '${REVERB_PORT:-8080}:8080'`. `.env.example` — keep `REVERB_HOST="localhost"` / `REVERB_PORT=8080` / `REVERB_SCHEME=http` defaults and add the comment `# Local: vendor/bin/sail artisan dev (runs Reverb on :8080) or vendor/bin/sail artisan reverb:start --host=0.0.0.0`.

- [ ] **Step 5: Run tests, commit**

`vendor/bin/sail artisan test --compact` → PASS; pint; phpstan.

```bash
git add -A && git commit -m "feat: add server time and handover candidates to the board snapshot

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FcMxGGHCZcDTndQCc57VPC"
```

---

### Task 2: Realtime client, board state and page shell

**Files:**
- Install: `npm install @laravel/echo-react laravel-echo pusher-js`
- Modify: `resources/js/app.tsx`, `resources/js/pages/retros/show.tsx`, `lang/*.json`
- Create: `resources/js/lib/retro/{types,api,board-reducer,colors}.ts`, `resources/js/hooks/{use-retro-board,use-retro-channel}.ts`, `resources/js/components/retro/{board,board-header,presence-strip,connection-banner,board-ended,phase-stepper}.tsx`

**Interfaces:**
- Produces (used by every later task):
  - `types.ts`: `RetroPhase`, `ColumnColor`, `BoardCard`, `CardPayload`, `BoardColumn`, `BoardParticipant`, `ActionItem`, `Snapshot`, `PresenceMember`
  - `retroRequest<T>(route: {url: string; method: string}, data?: Record<string, unknown>): Promise<T>`, `class RetroRequestError { status; message; errors }`
  - `boardReducer(state: Snapshot, action: BoardAction): Snapshot`, helpers `topLevelCards(cards, columnId)`, `childrenOf(cards, cardId)`, `placeCard(cards, cardId, columnId, index)`
  - `useRetroBoard(initial: Snapshot)` → `{ board, dispatch, refetch, status, online, connected, run }` where `run(promise)` awaits a mutation and on failure toasts the translated message and refetches
  - `<Board snapshot={…} />` renders the whole board; later tasks fill in `RetroColumn` etc.

- [ ] **Step 1: Install and configure Echo**

`npm install @laravel/echo-react laravel-echo pusher-js`

`resources/js/app.tsx` — before `createInertiaApp`, add:

```tsx
import { http } from '@inertiajs/core';
import { configureEcho } from '@laravel/echo-react';
import BroadcastAuthorizationsController from '@/actions/App/Http/Controllers/BroadcastAuthorizationsController';

configureEcho({
    broadcaster: 'reverb',
    channelAuthorization: {
        customHandler: ({ socketId, channelName }, callback) => {
            http.getClient()
                .request({
                    method: 'post',
                    url: BroadcastAuthorizationsController.store.url(),
                    data: { socket_id: socketId, channel_name: channelName },
                    headers: { Accept: 'application/json' },
                })
                .then((response) => callback(null, JSON.parse(response.data)))
                .catch((error: Error) => callback(error, null));
        },
    },
});
```

`configureEcho` fills key/host/port/scheme from `VITE_REVERB_*`. The custom handler goes through Inertia's XHR client, which sends the `X-XSRF-TOKEN` header from the `XSRF-TOKEN` cookie (members and guests both have it) — the auth route requires CSRF. If laravel-echo does not pass `channelAuthorization` through to pusher-js (check in the browser: the auth request must be a POST to `/broadcasting/auth` returning 200), use Echo's `authorizer: (channel) => ({ authorize: (socketId, callback) => … })` option with the same request instead, and note it.

- [ ] **Step 2: Types**

`resources/js/lib/retro/types.ts`:

```ts
export type RetroPhase = 'writing' | 'grouping' | 'voting' | 'discussing' | 'completed';
export type ColumnColor = 'green' | 'red' | 'blue' | 'amber' | 'purple' | 'slate';

export type Person = { id: string; name: string };

export type CardPayload = {
    id: string;
    columnId: string;
    parentCardId: string | null;
    position: number;
    isMine: boolean;
    content: string | null;
    author: Person | null;
};

export type BoardCard = CardPayload & {
    votes: number | null;
    myVotes: number;
};

export type BoardColumn = { id: string; title: string; color: ColumnColor; position: number };

export type BoardParticipant = { id: string; name: string; avatarUrl: string; isGuest: boolean };

export type ActionItem = { id: string; content: string; isDone: boolean; assignee: Person | null };

export type TransferCandidate = { userId: string; name: string };

export type Snapshot = {
    retro: {
        id: string;
        title: string;
        template: string;
        phase: RetroPhase;
        isAnonymous: boolean;
        votesPerParticipant: number;
        guestAccessEnabled: boolean;
        facilitatorParticipantId: string | null;
        timerEndsAt: string | null;
        highlightedCardId: string | null;
        completedAt: string | null;
        guestUrl: string | null;
    };
    viewer: {
        participantId: string;
        isFacilitator: boolean;
        isGuest: boolean;
        remainingVotes: number;
        transferCandidates: TransferCandidate[];
    };
    columns: BoardColumn[];
    cards: BoardCard[];
    participants: BoardParticipant[];
    actionItems: ActionItem[];
    votesCast: number | null;
    links: { team: string | null };
    serverTime: string;
};

export type PresenceMember = { id: string; info: { name: string; avatarUrl: string; isGuest: boolean } };

export const Phases: RetroPhase[] = ['writing', 'grouping', 'voting', 'discussing', 'completed'];
```

- [ ] **Step 3: API client**

`resources/js/lib/retro/api.ts`:

```ts
import { http, HttpResponseError } from '@inertiajs/core';
import { echo, echoIsConfigured } from '@laravel/echo-react';

type Route = { url: string; method: string };

type ErrorPayload = { message?: string; errors?: Record<string, string[]> };

export class RetroRequestError extends Error {
    constructor(
        public status: number,
        message: string,
        public errors: Record<string, string[]> = {},
    ) {
        super(message);
    }
}

function parse(data: string): ErrorPayload | null {
    try {
        return JSON.parse(data) as ErrorPayload;
    } catch {
        return null;
    }
}

function socketId(): string | undefined {
    if (!echoIsConfigured()) {
        return undefined;
    }

    return echo().socketId();
}

export async function retroRequest<T = null>(route: Route, data?: Record<string, unknown>): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const socket = socketId();

    if (socket) {
        headers['X-Socket-ID'] = socket;
    }

    try {
        const response = await http.getClient().request({
            method: route.method as 'get',
            url: route.url,
            data,
            headers,
        });

        return (response.data === '' ? null : JSON.parse(response.data)) as T;
    } catch (error) {
        if (error instanceof HttpResponseError) {
            const payload = parse(error.response.data);
            const firstError = Object.values(payload?.errors ?? {})[0]?.[0];

            throw new RetroRequestError(error.response.status, firstError ?? payload?.message ?? error.message, payload?.errors ?? {});
        }

        throw error;
    }
}
```

Server messages are already translated (Laravel `__()`); network errors fall back to a translated generic toast in `useRetroBoard.run`. Empty (204) responses resolve to `null`, so `run()` resolves `undefined` **only on failure** — for endpoints without a body check `if (result !== undefined)`, for JSON endpoints `if (result)` is fine.

- [ ] **Step 4: Reducer**

`resources/js/lib/retro/board-reducer.ts`:

```ts
import type { ActionItem, BoardCard, BoardColumn, CardPayload, Snapshot } from './types';

export type BoardAction =
    | { type: 'replace'; snapshot: Snapshot }
    | { type: 'cards.upsert'; cards: CardPayload[] }
    | { type: 'card.remove'; cardId: string; ungroupedCards: CardPayload[] }
    | { type: 'card.place'; cardId: string; columnId: string; index: number }
    | { type: 'columns.set'; columns: BoardColumn[] }
    | { type: 'votes.cast'; votesCast: number }
    | { type: 'votes.tally'; cardId: string; myVotes: number; remainingVotes: number }
    | { type: 'timer.set'; timerEndsAt: string | null }
    | { type: 'highlight.set'; cardId: string | null }
    | { type: 'actionItem.upsert'; actionItem: ActionItem }
    | { type: 'actionItem.remove'; actionItemId: string };

export function topLevelCards(cards: BoardCard[], columnId: string): BoardCard[] {
    return cards
        .filter((card) => card.columnId === columnId && card.parentCardId === null)
        .sort((a, b) => a.position - b.position);
}

export function childrenOf(cards: BoardCard[], cardId: string): BoardCard[] {
    return cards.filter((card) => card.parentCardId === cardId).sort((a, b) => a.position - b.position);
}

function upsertCards(cards: BoardCard[], payloads: CardPayload[]): BoardCard[] {
    const byId = new Map(cards.map((card) => [card.id, card]));

    for (const payload of payloads) {
        const existing = byId.get(payload.id);
        byId.set(payload.id, { votes: existing?.votes ?? null, myVotes: existing?.myVotes ?? 0, ...payload });
    }

    return [...byId.values()];
}

export function placeCard(cards: BoardCard[], cardId: string, columnId: string, index: number): BoardCard[] {
    const moving = cards.find((card) => card.id === cardId);

    if (!moving) {
        return cards;
    }

    const siblings = topLevelCards(cards, columnId).filter((card) => card.id !== cardId);
    siblings.splice(Math.min(Math.max(index, 0), siblings.length), 0, { ...moving, parentCardId: null });

    const updates = new Map<string, BoardCard>();
    siblings.forEach((card, position) => updates.set(card.id, { ...card, columnId, position }));
    cards.filter((card) => card.parentCardId === cardId).forEach((child) => updates.set(child.id, { ...child, columnId }));

    if (moving.columnId !== columnId) {
        topLevelCards(cards, moving.columnId)
            .filter((card) => card.id !== cardId)
            .forEach((card, position) => updates.set(card.id, { ...card, position }));
    }

    return cards.map((card) => updates.get(card.id) ?? card);
}

export function boardReducer(state: Snapshot, action: BoardAction): Snapshot {
    switch (action.type) {
        case 'replace':
            return action.snapshot;
        case 'cards.upsert':
            return { ...state, cards: upsertCards(state.cards, action.cards) };
        case 'card.remove':
            return {
                ...state,
                cards: upsertCards(
                    state.cards.filter((card) => card.id !== action.cardId),
                    action.ungroupedCards,
                ),
            };
        case 'card.place':
            return { ...state, cards: placeCard(state.cards, action.cardId, action.columnId, action.index) };
        case 'columns.set':
            return { ...state, columns: [...action.columns].sort((a, b) => a.position - b.position) };
        case 'votes.cast':
            return { ...state, votesCast: action.votesCast };
        case 'votes.tally':
            return {
                ...state,
                viewer: { ...state.viewer, remainingVotes: action.remainingVotes },
                cards: state.cards.map((card) => (card.id === action.cardId ? { ...card, myVotes: action.myVotes } : card)),
            };
        case 'timer.set':
            return { ...state, retro: { ...state.retro, timerEndsAt: action.timerEndsAt } };
        case 'highlight.set':
            return { ...state, retro: { ...state.retro, highlightedCardId: action.cardId } };
        case 'actionItem.upsert': {
            const exists = state.actionItems.some((item) => item.id === action.actionItem.id);

            return {
                ...state,
                actionItems: exists
                    ? state.actionItems.map((item) => (item.id === action.actionItem.id ? action.actionItem : item))
                    : [...state.actionItems, action.actionItem],
            };
        }
        case 'actionItem.remove':
            return { ...state, actionItems: state.actionItems.filter((item) => item.id !== action.actionItemId) };
    }
}
```

`resources/js/lib/retro/colors.ts`:

```ts
import type { ColumnColor } from './types';

export const columnAccent: Record<ColumnColor, string> = {
    green: 'border-t-emerald-500',
    red: 'border-t-rose-500',
    blue: 'border-t-sky-500',
    amber: 'border-t-amber-500',
    purple: 'border-t-violet-500',
    slate: 'border-t-slate-500',
};

export const ColumnColors: ColumnColor[] = ['green', 'red', 'blue', 'amber', 'purple', 'slate'];
```

- [ ] **Step 5: Channel hook**

`resources/js/hooks/use-retro-channel.ts`:

```ts
import { echo, useConnectionStatus } from '@laravel/echo-react';
import { useEffect, useRef, useState } from 'react';
import type { PresenceMember } from '@/lib/retro/types';

export const RetroEvents = [
    'card.created', 'card.updated', 'card.deleted', 'cards.moved', 'card.grouped', 'card.ungrouped',
    'vote.cast', 'vote.retracted', 'phase.changed', 'timer.changed', 'card.highlighted',
    'settings.changed', 'columns.changed', 'action-item.saved', 'action-item.deleted', 'retro.deleted',
] as const;

export type RetroEventName = (typeof RetroEvents)[number];

export type RetroEvent = { name: RetroEventName; payload: Record<string, unknown> };

export function useRetroChannel(retroId: string, enabled: boolean, onEvent: (event: RetroEvent) => void, onResync: () => void) {
    const [online, setOnline] = useState<PresenceMember[]>([]);
    const status = useConnectionStatus();
    const handlers = useRef({ onEvent, onResync });
    const wasConnected = useRef(false);

    handlers.current = { onEvent, onResync };

    useEffect(() => {
        if (!enabled) {
            return;
        }

        const name = `retro.${retroId}`;
        const channel = echo<'reverb'>()
            .join(name)
            .here((members: PresenceMember[]) => setOnline(members))
            .joining((member: PresenceMember) => setOnline((current) => [...current.filter((m) => m.id !== member.id), member]))
            .leaving((member: PresenceMember) => setOnline((current) => current.filter((m) => m.id !== member.id)));

        for (const event of RetroEvents) {
            channel.listen(`.${event}`, (payload: Record<string, unknown>) => handlers.current.onEvent({ name: event, payload }));
        }

        return () => {
            echo().leave(name);
            setOnline([]);
        };
    }, [retroId, enabled]);

    useEffect(() => {
        if (status !== 'connected') {
            return;
        }

        if (wasConnected.current) {
            handlers.current.onResync();
        }

        wasConnected.current = true;
    }, [status]);

    return { online, connected: status === 'connected' };
}
```

- [ ] **Step 6: Board hook**

`resources/js/hooks/use-retro-board.ts`:

```ts
import { useCallback, useReducer, useState } from 'react';
import { toast } from 'sonner';
import RetroSnapshotsController from '@/actions/App/Http/Controllers/Retros/RetroSnapshotsController';
import { useTrans } from '@/hooks/use-trans';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import { boardReducer } from '@/lib/retro/board-reducer';
import type { ActionItem, BoardColumn, CardPayload, Snapshot } from '@/lib/retro/types';
import { useRetroChannel, type RetroEvent } from './use-retro-channel';

export type BoardStatus = 'active' | 'ended' | 'deleted';

export function useRetroBoard(initial: Snapshot) {
    const { t } = useTrans();
    const [board, dispatch] = useReducer(boardReducer, initial);
    const [status, setStatus] = useState<BoardStatus>('active');
    const retroId = initial.retro.id;

    const refetch = useCallback(async () => {
        try {
            const snapshot = await retroRequest<Snapshot>(RetroSnapshotsController.show(retroId));
            dispatch({ type: 'replace', snapshot });
        } catch (error) {
            if (error instanceof RetroRequestError && [403, 404].includes(error.status)) {
                setStatus('ended');
            }
        }
    }, [retroId]);

    const onEvent = useCallback(
        ({ name, payload }: RetroEvent) => {
            switch (name) {
                case 'card.created':
                case 'card.updated':
                    dispatch({ type: 'cards.upsert', cards: [payload.card as CardPayload] });
                    break;
                case 'card.deleted':
                    dispatch({ type: 'card.remove', cardId: payload.cardId as string, ungroupedCards: payload.ungroupedCards as CardPayload[] });
                    break;
                case 'cards.moved':
                case 'card.grouped':
                case 'card.ungrouped':
                    dispatch({ type: 'cards.upsert', cards: payload.cards as CardPayload[] });
                    break;
                case 'vote.cast':
                case 'vote.retracted':
                    dispatch({ type: 'votes.cast', votesCast: payload.votesCast as number });
                    break;
                case 'timer.changed':
                    dispatch({ type: 'timer.set', timerEndsAt: payload.timerEndsAt as string | null });
                    break;
                case 'card.highlighted':
                    dispatch({ type: 'highlight.set', cardId: payload.cardId as string | null });
                    break;
                case 'columns.changed':
                    dispatch({ type: 'columns.set', columns: payload.columns as BoardColumn[] });
                    break;
                case 'action-item.saved':
                    dispatch({ type: 'actionItem.upsert', actionItem: payload.actionItem as ActionItem });
                    break;
                case 'action-item.deleted':
                    dispatch({ type: 'actionItem.remove', actionItemId: payload.actionItemId as string });
                    break;
                case 'phase.changed':
                case 'settings.changed':
                    void refetch();
                    break;
                case 'retro.deleted':
                    setStatus('deleted');
                    break;
            }
        },
        [refetch],
    );

    const { online, connected } = useRetroChannel(retroId, status === 'active', onEvent, refetch);

    const run = useCallback(
        async <T,>(mutation: Promise<T>): Promise<T | undefined> => {
            try {
                return await mutation;
            } catch (error) {
                toast.error(error instanceof RetroRequestError ? error.message : t('Something went wrong. Please try again.'));
                await refetch();

                return undefined;
            }
        },
        [refetch, t],
    );

    return { board, dispatch, refetch, status, online, connected, run };
}
```

- [ ] **Step 7: Shell components**

`resources/js/components/retro/connection-banner.tsx`:

```tsx
import { useTrans } from '@/hooks/use-trans';

export function ConnectionBanner({ connected }: { connected: boolean }) {
    const { t } = useTrans();

    if (connected) {
        return null;
    }

    return (
        <div role="status" className="bg-amber-100 px-4 py-1 text-center text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            {t('Reconnecting…')}
        </div>
    );
}
```

`resources/js/components/retro/board-ended.tsx`:

```tsx
import { Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

export function BoardEnded({ reason, teamUrl }: { reason: 'ended' | 'deleted'; teamUrl: string | null }) {
    const { t } = useTrans();

    return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="text-lg">
                {reason === 'deleted'
                    ? t('This retrospective has been deleted.')
                    : t('Your access to this retrospective has ended.')}
            </p>
            {teamUrl && (
                <Button asChild variant="outline">
                    <Link href={teamUrl}>{t('Back to the team')}</Link>
                </Button>
            )}
        </div>
    );
}
```

`resources/js/components/retro/presence-strip.tsx`:

```tsx
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTrans } from '@/hooks/use-trans';
import type { PresenceMember } from '@/lib/retro/types';

const Visible = 8;

export function PresenceStrip({ members }: { members: PresenceMember[] }) {
    const { t } = useTrans();
    const hidden = members.length - Visible;

    return (
        <div className="flex items-center -space-x-2" aria-label={t(':count online', { count: members.length })}>
            {members.slice(0, Visible).map((member) => (
                <Tooltip key={member.id}>
                    <TooltipTrigger asChild>
                        <img src={member.info.avatarUrl} alt={member.info.name} className="size-8 rounded-full border-2 border-background bg-muted" />
                    </TooltipTrigger>
                    <TooltipContent>
                        {member.info.name}
                        {member.info.isGuest && ` · ${t('Guest')}`}
                    </TooltipContent>
                </Tooltip>
            ))}
            {hidden > 0 && <span className="flex size-8 items-center justify-center rounded-full border-2 border-background bg-muted text-xs">+{hidden}</span>}
        </div>
    );
}
```

`resources/js/components/retro/phase-stepper.tsx` (read-only here; Task 6 adds facilitator buttons):

```tsx
import { useTrans } from '@/hooks/use-trans';
import { Phases, type RetroPhase } from '@/lib/retro/types';
import { cn } from '@/lib/utils';

export const PhaseLabels: Record<RetroPhase, string> = {
    writing: 'Writing',
    grouping: 'Grouping',
    voting: 'Voting',
    discussing: 'Discussing',
    completed: 'Completed',
};

export function PhaseStepper({ phase }: { phase: RetroPhase }) {
    const { t } = useTrans();
    const current = Phases.indexOf(phase);

    return (
        <ol className="flex items-center gap-1 text-xs" aria-label={t('Phases')}>
            {Phases.map((step, index) => (
                <li
                    key={step}
                    aria-current={step === phase ? 'step' : undefined}
                    className={cn(
                        'rounded-full px-2 py-0.5',
                        index < current && 'text-muted-foreground',
                        step === phase && 'bg-primary text-primary-foreground',
                    )}
                >
                    {t(PhaseLabels[step])}
                </li>
            ))}
        </ol>
    );
}
```

`resources/js/components/retro/board-header.tsx`:

```tsx
import { Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useTrans } from '@/hooks/use-trans';
import type { PresenceMember, Snapshot } from '@/lib/retro/types';
import { PhaseStepper } from './phase-stepper';
import { PresenceStrip } from './presence-strip';

type Props = {
    board: Snapshot;
    online: PresenceMember[];
    actions?: ReactNode;
};

export function BoardHeader({ board, online, actions }: Props) {
    const { t } = useTrans();

    return (
        <header className="flex flex-wrap items-center gap-4 border-b px-4 py-3">
            {board.links.team && (
                <Link href={board.links.team} className="text-muted-foreground hover:text-foreground" aria-label={t('Back to the team')}>
                    <ArrowLeft className="size-5" />
                </Link>
            )}
            <h1 className="text-lg font-semibold">{board.retro.title}</h1>
            <PhaseStepper phase={board.retro.phase} />
            <div className="ml-auto flex items-center gap-3">
                {actions}
                <PresenceStrip members={online} />
                {board.viewer.isGuest && <LanguageSwitcher />}
            </div>
        </header>
    );
}
```

`resources/js/components/retro/board.tsx` (columns are placeholders until Task 3):

```tsx
import { useRetroBoard } from '@/hooks/use-retro-board';
import type { Snapshot } from '@/lib/retro/types';
import { BoardEnded } from './board-ended';
import { BoardHeader } from './board-header';
import { ConnectionBanner } from './connection-banner';

export function Board({ snapshot }: { snapshot: Snapshot }) {
    const { board, status, online, connected } = useRetroBoard(snapshot);

    if (status !== 'active') {
        return <BoardEnded reason={status} teamUrl={board.links.team} />;
    }

    return (
        <div className="flex min-h-dvh flex-col">
            <BoardHeader board={board} online={online} />
            <ConnectionBanner connected={connected} />
            <main className="flex flex-1 items-start gap-4 overflow-x-auto p-4">
                {board.columns.map((column) => (
                    <section key={column.id} className="w-72 shrink-0 rounded-lg border p-3">
                        {column.title}
                    </section>
                ))}
            </main>
        </div>
    );
}
```

`resources/js/pages/retros/show.tsx`:

```tsx
import { Head } from '@inertiajs/react';
import { Board } from '@/components/retro/board';
import type { Snapshot } from '@/lib/retro/types';

export default function ShowRetro({ snapshot }: { snapshot: Snapshot }) {
    return (
        <>
            <Head title={snapshot.retro.title} />
            <Board snapshot={snapshot} />
        </>
    );
}
```

Remove the now-unused key "The board is being built." from the lang files. Add keys: `Reconnecting…`, `This retrospective has been deleted.`, `Your access to this retrospective has ended.`, `Back to the team`, `:count online`, `Guest`, `Phases`, `Something went wrong. Please try again.`, and the phase labels are already present from Plan 3 (`Writing`, `Grouping`, `Voting`, `Discussing`, `Completed`).

- [ ] **Step 8: Verify**

`vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npm run check`.

Manual check (run `vendor/bin/sail artisan dev` or `vendor/bin/sail artisan reverb:start --host=0.0.0.0` + `npm run dev`): open a retro as a member in two browsers (one private window logged in as another team member). Both show each other in the presence strip. In the network tab, `POST /broadcasting/auth` returns 200 (CSRF works). Stop Reverb → "Reconnecting…" appears; restart → it disappears and a snapshot request is made. As facilitator, disable guest access (tinker: `App\Models\Retro::find(...)->update(['guest_access_enabled' => false])` then broadcast is not needed — reload as guest) → a guest sees "Your access to this retrospective has ended.". Record what you did in the report.

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: add realtime board state and page shell

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01FcMxGGHCZcDTndQCc57VPC"
```

---

### Task 3: Columns and cards — writing, editing, deleting

**Files:**
- Create: `resources/js/components/ui/textarea.tsx`, `resources/js/components/retro/{retro-column,column-header,retro-card,card-composer,card-editor}.tsx`
- Modify: `resources/js/components/retro/board.tsx`, `lang/*.json`

**Interfaces:**
- Consumes: `useRetroBoard` (`board`, `dispatch`, `run`), `topLevelCards`, `childrenOf`, `columnAccent`, `retroRequest`.
- Produces: `<RetroColumn column board ctx />`, `<RetroCard card board ctx />` where `ctx = { board, dispatch, run }` is a `BoardContext` object built in `Board` (type `BoardContextValue` exported from `board.tsx`). Later tasks add props/slots to these components.

Rules: composer only in Writing; own cards editable/deletable in Writing and Grouping; hidden cards (`content === null`) render a muted placeholder "Hidden until writing ends" (eye-off icon) with no author; author label only when `author !== null`; own cards get a subtle "You" badge; children render nested under their lead (indented, smaller).

- [ ] **Step 1: Textarea primitive**

`resources/js/components/ui/textarea.tsx`:

```tsx
import * as React from 'react';
import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
    return (
        <textarea
            data-slot="textarea"
            className={cn(
                'flex min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50',
                className,
            )}
            {...props}
        />
    );
}

export { Textarea };
```

- [ ] **Step 2: Board context**

In `board.tsx`, export:

```tsx
import type { Dispatch } from 'react';
import type { BoardAction } from '@/lib/retro/board-reducer';

export type BoardContextValue = {
    board: Snapshot;
    dispatch: Dispatch<BoardAction>;
    run: <T,>(mutation: Promise<T>) => Promise<T | undefined>;
    refetch: () => Promise<void>;
};
```

and build `const ctx: BoardContextValue = { board, dispatch, run, refetch };` passing it down (plain props, no React context needed).

- [ ] **Step 3: Card composer**

`resources/js/components/retro/card-composer.tsx`:

```tsx
import { useState } from 'react';
import CardsController from '@/actions/App/Http/Controllers/Retros/CardsController';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { CardPayload } from '@/lib/retro/types';
import type { BoardContextValue } from './board';

export function CardComposer({ columnId, ctx }: { columnId: string; ctx: BoardContextValue }) {
    const { t } = useTrans();
    const [content, setContent] = useState('');
    const [sending, setSending] = useState(false);

    const submit = async () => {
        const trimmed = content.trim();

        if (trimmed === '' || sending) {
            return;
        }

        setSending(true);
        const response = await ctx.run(
            retroRequest<{ card: CardPayload }>(CardsController.store(ctx.board.retro.id), { column_id: columnId, content: trimmed }),
        );
        setSending(false);

        if (response) {
            ctx.dispatch({ type: 'cards.upsert', cards: [response.card] });
            setContent('');
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
            <Textarea
                value={content}
                maxLength={1000}
                placeholder={t('Add a card…')}
                aria-label={t('Add a card…')}
                onChange={(event) => setContent(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void submit();
                    }
                }}
            />
            <Button size="sm" className="w-full" disabled={sending || content.trim() === ''}>
                {t('Add')}
            </Button>
        </form>
    );
}
```

- [ ] **Step 4: Card editor**

`resources/js/components/retro/card-editor.tsx`:

```tsx
import { useState } from 'react';
import CardsController from '@/actions/App/Http/Controllers/Retros/CardsController';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { BoardCard, CardPayload } from '@/lib/retro/types';
import type { BoardContextValue } from './board';

export function CardEditor({ card, ctx, onDone }: { card: BoardCard; ctx: BoardContextValue; onDone: () => void }) {
    const { t } = useTrans();
    const [content, setContent] = useState(card.content ?? '');

    const save = async () => {
        const response = await ctx.run(
            retroRequest<{ card: CardPayload }>(CardsController.update({ retro: ctx.board.retro.id, card: card.id }), { content: content.trim() }),
        );

        if (response) {
            ctx.dispatch({ type: 'cards.upsert', cards: [response.card] });
        }

        onDone();
    };

    return (
        <div className="space-y-2">
            <Textarea value={content} maxLength={1000} autoFocus aria-label={t('Edit card')} onChange={(event) => setContent(event.target.value)} />
            <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={onDone}>{t('Cancel')}</Button>
                <Button size="sm" disabled={content.trim() === ''} onClick={() => void save()}>{t('Save')}</Button>
            </div>
        </div>
    );
}
```

- [ ] **Step 5: Card**

`resources/js/components/retro/retro-card.tsx`:

```tsx
import { Pencil, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import CardsController from '@/actions/App/Http/Controllers/Retros/CardsController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import { childrenOf } from '@/lib/retro/board-reducer';
import type { BoardCard } from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import type { BoardContextValue } from './board';
import { CardEditor } from './card-editor';

type Props = {
    card: BoardCard;
    ctx: BoardContextValue;
    isChild?: boolean;
    footer?: ReactNode;
};

export function RetroCard({ card, ctx, isChild = false, footer }: Props) {
    const { t } = useTrans();
    const [editing, setEditing] = useState(false);
    const phase = ctx.board.retro.phase;
    const canChange = card.isMine && (phase === 'writing' || phase === 'grouping');
    const isHighlighted = ctx.board.retro.highlightedCardId === card.id;

    const remove = async () => {
        const result = await ctx.run(retroRequest(CardsController.destroy({ retro: ctx.board.retro.id, card: card.id })));

        if (result !== undefined) {
            ctx.dispatch({ type: 'card.remove', cardId: card.id, ungroupedCards: [] });
            await ctx.refetch();
        }
    };

    return (
        <article
            id={`card-${card.id}`}
            className={cn(
                'rounded-md border bg-card p-3 text-sm shadow-xs',
                isChild && 'ml-3 border-dashed p-2 text-xs',
                isHighlighted && 'ring-2 ring-primary',
            )}
        >
            {editing ? (
                <CardEditor card={card} ctx={ctx} onDone={() => setEditing(false)} />
            ) : (
                <>
                    {card.content === null ? (
                        <p className="text-muted-foreground italic">{t('Hidden until writing ends')}</p>
                    ) : (
                        <p className="break-words whitespace-pre-wrap">{card.content}</p>
                    )}
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        {card.author && <span>{card.author.name}</span>}
                        {card.isMine && <Badge variant="secondary">{t('You')}</Badge>}
                        <div className="ml-auto flex items-center gap-1">
                            {footer}
                            {canChange && (
                                <>
                                    <Button size="icon" variant="ghost" className="size-7" aria-label={t('Edit card')} onClick={() => setEditing(true)}>
                                        <Pencil className="size-3.5" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="size-7" aria-label={t('Delete card')} onClick={() => void remove()}>
                                        <Trash2 className="size-3.5" />
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </>
            )}
            {!isChild &&
                childrenOf(ctx.board.cards, card.id).map((child) => (
                    <div key={child.id} className="mt-2">
                        <RetroCard card={child} ctx={ctx} isChild />
                    </div>
                ))}
        </article>
    );
}
```

Deleting: the server answers 204 and other clients get `card.deleted` with `ungroupedCards`; the sender removes the card locally and refetches because ungrouped children changed position server-side.

- [ ] **Step 6: Column**

`resources/js/components/retro/column-header.tsx`:

```tsx
import type { BoardColumn } from '@/lib/retro/types';

export function ColumnHeader({ column, count }: { column: BoardColumn; count: number }) {
    return (
        <header className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">{column.title}</h2>
            <span className="text-xs text-muted-foreground">{count}</span>
        </header>
    );
}
```

`resources/js/components/retro/retro-column.tsx`:

```tsx
import { topLevelCards } from '@/lib/retro/board-reducer';
import { columnAccent } from '@/lib/retro/colors';
import type { BoardColumn } from '@/lib/retro/types';
import { cn } from '@/lib/utils';
import type { BoardContextValue } from './board';
import { CardComposer } from './card-composer';
import { ColumnHeader } from './column-header';
import { RetroCard } from './retro-card';

export function RetroColumn({ column, ctx }: { column: BoardColumn; ctx: BoardContextValue }) {
    const cards = topLevelCards(ctx.board.cards, column.id);

    return (
        <section className={cn('flex w-72 shrink-0 flex-col rounded-lg border border-t-4 bg-muted/30 p-3', columnAccent[column.color])}>
            <ColumnHeader column={column} count={cards.length} />
            <div className="flex flex-col gap-2">
                {cards.map((card) => (
                    <RetroCard key={card.id} card={card} ctx={ctx} />
                ))}
            </div>
            {ctx.board.retro.phase === 'writing' && (
                <div className="mt-3">
                    <CardComposer columnId={column.id} ctx={ctx} />
                </div>
            )}
        </section>
    );
}
```

`board.tsx` — render `<RetroColumn key={column.id} column={column} ctx={ctx} />` for each column. When there are no columns show `t('No columns yet.')` (the facilitator adds them in Task 7).

Add keys: `Add a card…`, `Add` (exists), `Edit card`, `Delete card`, `Save` (exists?), `Cancel` (exists?), `Hidden until writing ends`, `You`, `No columns yet.` — skip existing keys.

- [ ] **Step 7: Verify** — types/lint as in Global Constraints. Manual: two members in one retro during Writing: A writes cards → B sees "Hidden until writing ends" placeholders (no author, no text); A edits/deletes own card; B cannot edit A's card. Move the retro to Grouping via tinker (`->update(['phase' => 'grouping'])` + reload) → content and authors visible; make it anonymous → no author names for others' cards.

- [ ] **Step 8: Commit** — `feat: write, edit and delete cards on the board`.

---

### Task 4: Drag and drop — moving and grouping

**Files:**
- Install: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
- Create: `resources/js/components/retro/dnd.tsx`
- Modify: `resources/js/components/retro/{board,retro-column,retro-card}.tsx`, `lang/*.json`

**Interfaces:**
- Produces: drag ids `card:{id}`, drop ids `card:{id}` and `column:{id}`; helpers `parseDndId(id): {kind: 'card' | 'column'; id: string} | null`.

Rules (server-enforced; the UI mirrors them): Writing — drag only own top-level cards, reorder within/between columns (sortable). Grouping — drag any card; drop **on a card** → group under it (`CardGroupsController.update`); drop **on a column** (empty area or header) → move to the end of that column (`CardPositionsController.update` with `index = count`); child cards show an "Ungroup" button (`CardGroupsController.destroy`). Other phases — no dragging. Moves are optimistic (`card.place` before the request, authoritative `cards.upsert` after); grouping waits for the response; any error → toast + refetch (via `run`). Keyboard dragging works through `KeyboardSensor`.

- [ ] **Step 1: Helpers**

`resources/js/components/retro/dnd.tsx`:

```tsx
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function parseDndId(id: string | number | undefined | null): { kind: 'card' | 'column'; id: string } | null {
    if (typeof id !== 'string') {
        return null;
    }

    const [kind, value] = id.split(':');

    if ((kind !== 'card' && kind !== 'column') || !value) {
        return null;
    }

    return { kind, id: value };
}

export function SortableCard({ id, disabled, children }: { id: string; disabled: boolean; children: ReactNode }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `card:${id}`, disabled });

    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={cn(isDragging && 'opacity-50', !disabled && 'cursor-grab')}
            {...attributes}
            {...listeners}
        >
            {children}
        </div>
    );
}

export function GroupableCard({ id, children }: { id: string; children: ReactNode }) {
    const drag = useDraggable({ id: `card:${id}` });
    const drop = useDroppable({ id: `card:${id}` });

    return (
        <div
            ref={(node) => {
                drag.setNodeRef(node);
                drop.setNodeRef(node);
            }}
            style={{ transform: CSS.Translate.toString(drag.transform) }}
            className={cn('cursor-grab rounded-md', drag.isDragging && 'opacity-50', drop.isOver && !drag.isDragging && 'ring-2 ring-primary ring-offset-2')}
            {...drag.attributes}
            {...drag.listeners}
        >
            {children}
        </div>
    );
}

export function ColumnDropZone({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
    const { setNodeRef, isOver } = useDroppable({ id: `column:${id}` });

    return (
        <div ref={setNodeRef} className={cn(className, isOver && 'bg-primary/5')}>
            {children}
        </div>
    );
}
```

Buttons inside draggable cards must not start a drag: add `onPointerDown={(event) => event.stopPropagation()}` to the edit/delete/vote/ungroup buttons, or configure `PointerSensor` with `activationConstraint: { distance: 6 }` (do the latter in Step 2 — simpler).

- [ ] **Step 2: Board DnD context**

In `board.tsx`, wrap the columns in:

```tsx
<DndContext
    sensors={sensors}
    collisionDetection={closestCenter}
    onDragEnd={(event) => void handleDragEnd(event)}
>
```

with `const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));` and:

```tsx
const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    const dragged = parseDndId(active.id);
    const target = parseDndId(over?.id);

    if (!dragged || !target || dragged.kind !== 'card') {
        return;
    }

    const retroId = board.retro.id;
    const phase = board.retro.phase;

    if (phase === 'grouping' && target.kind === 'card' && target.id !== dragged.id) {
        const response = await run(
            retroRequest<{ cards: CardPayload[] }>(CardGroupsController.update({ retro: retroId, card: dragged.id }), { parent_card_id: target.id }),
        );

        if (response) {
            dispatch({ type: 'cards.upsert', cards: response.cards });
        }

        return;
    }

    const targetCard = target.kind === 'card' ? board.cards.find((card) => card.id === target.id) : undefined;
    const columnId = target.kind === 'column' ? target.id : targetCard?.columnId;

    if (!columnId) {
        return;
    }

    const siblings = topLevelCards(board.cards, columnId).filter((card) => card.id !== dragged.id);
    const index = targetCard ? siblings.findIndex((card) => card.id === targetCard.id) : siblings.length;

    dispatch({ type: 'card.place', cardId: dragged.id, columnId, index: Math.max(index, 0) });

    const response = await run(
        retroRequest<{ cards: CardPayload[] }>(CardPositionsController.update({ retro: retroId, card: dragged.id }), {
            column_id: columnId,
            index: Math.max(index, 0),
        }),
    );

    if (response) {
        dispatch({ type: 'cards.upsert', cards: response.cards });
    }
};
```

- [ ] **Step 3: Column and card wiring**

`retro-column.tsx`: wrap the card list in `<ColumnDropZone id={column.id} className="flex min-h-12 flex-col gap-2">`. In Writing, also wrap it in `<SortableContext items={cards.map((card) => `card:${card.id}`)} strategy={verticalListSortingStrategy}>` and each card in `<SortableCard id={card.id} disabled={!card.isMine}>`. In Grouping, wrap each card in `<GroupableCard id={card.id}>`. Other phases: plain cards.

`retro-card.tsx`: for child cards in Grouping, add an "Ungroup" button (lucide `Ungroup` icon, `aria-label={t('Ungroup')}`) calling `CardGroupsController.destroy({retro, card})` via `run` and dispatching `cards.upsert` with the response.

Add keys: `Ungroup`, `Drag cards onto each other to group them.` (show this hint under the header during Grouping).

- [ ] **Step 4: Verify** — types/lint. Manual: in Writing drag own cards between columns and reorder (others' cards don't drag); in Grouping drag a card onto another → it nests; ungroup it; drag onto a column's empty area → it goes last; the second browser follows every change; keyboard: focus a card, Space, arrows, Space to drop (Writing reorder).

- [ ] **Step 5: Commit** — `feat: drag cards to move and group them`.

---

### Task 5: Voting

**Files:**
- Create: `resources/js/components/retro/{vote-controls,vote-progress}.tsx`
- Modify: `resources/js/components/retro/{board,retro-column,retro-card}.tsx`, `lang/*.json`

**Interfaces:**
- Consumes: `CardVotesController.store/destroy`, reducer `votes.tally`.
- Produces: `<VoteControls card ctx />`, `<VoteProgress board />`; column "Sort by votes" toggle in Discussing/Completed.

Rules: Voting — top-level cards show − / count / + (own votes); + disabled when `remainingVotes === 0`; − disabled when `myVotes === 0`; the header shows "Votes left: n" and a progress bar `votesCast / (participants × votesPerParticipant)`. Discussing/Completed — top-level cards show a total badge (`votes`); each column has a "Sort by votes" toggle (local state, default on in Discussing).

- [ ] **Step 1: Vote controls**

`resources/js/components/retro/vote-controls.tsx`:

```tsx
import { Minus, Plus } from 'lucide-react';
import CardVotesController from '@/actions/App/Http/Controllers/Retros/CardVotesController';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { BoardCard } from '@/lib/retro/types';
import type { BoardContextValue } from './board';

type Tally = { cardId: string; myVotes: number; remainingVotes: number };

export function VoteControls({ card, ctx }: { card: BoardCard; ctx: BoardContextValue }) {
    const { t } = useTrans();
    const route = { retro: ctx.board.retro.id, card: card.id };

    const vote = async (delta: 1 | -1) => {
        ctx.dispatch({
            type: 'votes.tally',
            cardId: card.id,
            myVotes: card.myVotes + delta,
            remainingVotes: ctx.board.viewer.remainingVotes - delta,
        });

        const tally = await ctx.run(
            retroRequest<Tally>(delta === 1 ? CardVotesController.store(route) : CardVotesController.destroy(route)),
        );

        if (tally) {
            ctx.dispatch({ type: 'votes.tally', ...tally });
        }
    };

    return (
        <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="size-7" aria-label={t('Remove a vote')} disabled={card.myVotes === 0} onClick={() => void vote(-1)}>
                <Minus className="size-3.5" />
            </Button>
            <span className="min-w-4 text-center font-medium" aria-label={t('Your votes: :count', { count: card.myVotes })}>
                {card.myVotes}
            </span>
            <Button size="icon" variant="ghost" className="size-7" aria-label={t('Add a vote')} disabled={ctx.board.viewer.remainingVotes === 0} onClick={() => void vote(1)}>
                <Plus className="size-3.5" />
            </Button>
        </div>
    );
}
```

- [ ] **Step 2: Progress**

`resources/js/components/retro/vote-progress.tsx`:

```tsx
import { useTrans } from '@/hooks/use-trans';
import type { Snapshot } from '@/lib/retro/types';

export function VoteProgress({ board }: { board: Snapshot }) {
    const { t } = useTrans();
    const total = board.participants.length * board.retro.votesPerParticipant;
    const cast = board.votesCast ?? 0;

    return (
        <div className="flex items-center gap-3 text-sm">
            <span>{t('Votes left: :count', { count: board.viewer.remainingVotes })}</span>
            <div className="h-2 w-32 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={cast} aria-label={t('Votes cast')}>
                <div className="h-full bg-primary transition-all" style={{ width: `${total === 0 ? 0 : Math.min(100, (cast / total) * 100)}%` }} />
            </div>
            <span className="text-muted-foreground">{t(':cast of :total votes cast', { cast, total })}</span>
        </div>
    );
}
```

Show it in the header `actions` slot during Voting.

- [ ] **Step 3: Card footer and totals**

`retro-card.tsx`: when the card is top-level — Voting: `footer={<VoteControls card={card} ctx={ctx} />}`; Discussing/Completed: a `Badge` with `card.votes` and `aria-label={t(':count votes', { count: card.votes ?? 0 })}`. Pass these from `RetroColumn` so the card stays phase-agnostic, or compute inside `RetroCard` — keep it inside `RetroCard` for simplicity.

`retro-column.tsx`: in Discussing/Completed add a small toggle button (lucide `ArrowDownWideNarrow`) "Sort by votes" (`useState(true)`); when on, sort `cards` by `votes` desc then `position`.

Add keys: `Remove a vote`, `Add a vote`, `Your votes: :count`, `Votes left: :count`, `Votes cast`, `:cast of :total votes cast`, `:count votes`, `Sort by votes`.

- [ ] **Step 4: Verify** — types/lint. Manual: in Voting cast votes until the limit (+ disables), retract, the other browser's progress bar moves but shows no per-card numbers; in Discussing totals appear and sorting works.

- [ ] **Step 5: Commit** — `feat: vote on cards and show totals when discussing`.

---

### Task 6: Facilitator controls — phases, timer, highlight, settings, guest link, handover, deletion

**Files:**
- Create: `resources/js/hooks/use-countdown.ts`, `resources/js/components/retro/{timer-display,timer-control,facilitator-menu,settings-dialog,guest-link-dialog,handover-dialog,delete-retro-dialog}.tsx`
- Modify: `resources/js/components/retro/{board,board-header,phase-stepper,retro-card}.tsx`, `lang/*.json`

**Interfaces:**
- Consumes: `RetroPhasesController`, `RetroTimersController`, `RetroHighlightsController`, `RetroSettingsController`, `RetroGuestTokensController`, `RetroFacilitatorsController`, `RetrosController.destroy`; snapshot `serverTime`, `viewer.transferCandidates`, `retro.guestUrl`.

Rules: all controls render only when `viewer.isFacilitator`. Phase: "Previous"/"Next" buttons next to the stepper (adjacent only; in Completed only "Reopen" → Discussing); after success call `refetch()`. Timer: everyone sees a countdown (mm:ss) when `timerEndsAt` is set, computed with the server clock offset; at zero it shows "Time's up!", plays a short beep once (Web Audio, no asset) and toasts once; facilitator gets a popover with 1/3/5/10 minutes and "Stop timer". Highlight: in Discussing the facilitator gets a "Discuss" button on top-level cards (PUT highlight; clicking the highlighted one clears it); every client scrolls the highlighted card into view when `highlightedCardId` changes. Settings dialog: title, anonymous switch (switching off disabled when any card exists — show the server message on 422), votes per participant (1–20; disabled outside Writing/Grouping), save → PATCH settings then `refetch()`. Guest link dialog: toggle guest access (PATCH `guest_access_enabled`), copy link (`navigator.clipboard.writeText`), regenerate (POST guest-token, warns that current guests are signed out). Handover dialog: select from `transferCandidates` → PUT facilitator → `refetch()`. Delete dialog: confirmation → DELETE → navigate to `links.team` (`router.visit`).

- [ ] **Step 1: Countdown hook**

`resources/js/hooks/use-countdown.ts`:

```ts
import { useEffect, useMemo, useState } from 'react';

export function useServerOffset(serverTime: string): number {
    return useMemo(() => new Date(serverTime).getTime() - Date.now(), [serverTime]);
}

export function useCountdown(endsAt: string | null, offset: number): number | null {
    const [now, setNow] = useState(() => Date.now() + offset);

    useEffect(() => {
        if (endsAt === null) {
            return;
        }

        const interval = window.setInterval(() => setNow(Date.now() + offset), 250);

        return () => window.clearInterval(interval);
    }, [endsAt, offset]);

    if (endsAt === null) {
        return null;
    }

    return Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / 1000));
}

export function formatSeconds(seconds: number): string {
    const minutes = Math.floor(seconds / 60);

    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}
```

- [ ] **Step 2: Timer**

`resources/js/components/retro/timer-display.tsx`:

```tsx
import { Timer } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { formatSeconds, useCountdown } from '@/hooks/use-countdown';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

function beep() {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.1, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.6);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.6);
}

export function TimerDisplay({ endsAt, offset }: { endsAt: string | null; offset: number }) {
    const { t } = useTrans();
    const remaining = useCountdown(endsAt, offset);
    const announced = useRef<string | null>(null);

    useEffect(() => {
        if (remaining !== 0 || endsAt === null || announced.current === endsAt) {
            return;
        }

        announced.current = endsAt;
        toast(t("Time's up!"));

        try {
            beep();
        } catch {
            // Audio can be blocked until the user interacts with the page.
        }
    }, [remaining, endsAt, t]);

    if (remaining === null) {
        return null;
    }

    return (
        <span role="timer" className={cn('flex items-center gap-1 font-mono text-sm', remaining === 0 && 'text-destructive')}>
            <Timer className="size-4" />
            {remaining === 0 ? t("Time's up!") : formatSeconds(remaining)}
        </span>
    );
}
```

`resources/js/components/retro/timer-control.tsx`:

```tsx
import { AlarmClock } from 'lucide-react';
import RetroTimersController from '@/actions/App/Http/Controllers/Retros/RetroTimersController';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { BoardContextValue } from './board';

const Minutes = [1, 3, 5, 10];

export function TimerControl({ ctx }: { ctx: BoardContextValue }) {
    const { t } = useTrans();

    const set = async (seconds: number | null) => {
        const response = await ctx.run(
            retroRequest<{ timerEndsAt: string | null }>(RetroTimersController.update(ctx.board.retro.id), { seconds }),
        );

        if (response) {
            ctx.dispatch({ type: 'timer.set', timerEndsAt: response.timerEndsAt });
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" aria-label={t('Timer')}>
                    <AlarmClock className="size-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {Minutes.map((minutes) => (
                    <DropdownMenuItem key={minutes} onSelect={() => void set(minutes * 60)}>
                        {t(':count min', { count: minutes })}
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={ctx.board.retro.timerEndsAt === null} onSelect={() => void set(null)}>
                    {t('Stop timer')}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
```

Hide `TimerControl` in Completed.

- [ ] **Step 3: Phase controls**

Extend `PhaseStepper` with optional `ctx?: BoardContextValue` + `onChanged: () => void`. When `ctx?.board.viewer.isFacilitator`, render "Previous" (hidden in Writing and Completed) and "Next" (hidden in Completed; label "Complete" when next is Completed) buttons, and "Reopen" in Completed. Handler:

```tsx
const move = async (phase: RetroPhase) => {
    const response = await ctx.run(retroRequest<{ phase: RetroPhase }>(RetroPhasesController.update(ctx.board.retro.id), { phase }));

    if (response) {
        onChanged();
    }
};
```

`onChanged` = `ctx.refetch`.

- [ ] **Step 4: Highlight**

In `RetroCard`, for top-level cards when `phase === 'discussing'` and `viewer.isFacilitator`, add a "Discuss" toggle button (lucide `Crosshair`, `aria-pressed={isHighlighted}`) calling `RetroHighlightsController.update(retroId)` with `{ card_id: isHighlighted ? null : card.id }` and dispatching `highlight.set` with the response's `highlightedCardId`.

In `Board`, add:

```tsx
useEffect(() => {
    if (!board.retro.highlightedCardId) {
        return;
    }

    document.getElementById(`card-${board.retro.highlightedCardId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
}, [board.retro.highlightedCardId]);
```

- [ ] **Step 5: Facilitator menu and dialogs**

`facilitator-menu.tsx`: a `DropdownMenu` (lucide `Settings2` trigger, `aria-label={t('Facilitator menu')}`) with items "Settings…", "Guest link…", "Hand over facilitation…", separator, "Delete retrospective…" (destructive). Each item opens its dialog (local `useState<'settings' | 'guests' | 'handover' | 'delete' | null>`).

`settings-dialog.tsx` — a `Dialog` with a small form (controlled state initialised from `board.retro`): `Input` title (max 120), a `Checkbox` "Anonymous cards" (`disabled={board.retro.isAnonymous && board.cards.length > 0}` with helper text `t('Anonymity can only be turned off before any card is written.')`), a number `Input` "Votes per participant" (min 1 max 20, `disabled={!['writing', 'grouping'].includes(phase)}`). Save sends only changed fields via `RetroSettingsController.update(retroId)`, then `refetch()` and closes.

`guest-link-dialog.tsx` — `Checkbox` "Allow guests" (PATCH `guest_access_enabled`, then `refetch()`); when enabled and `board.retro.guestUrl` is set: read-only `Input` with the URL + "Copy" button (`navigator.clipboard.writeText`, toast `t('Link copied')`) + "Create a new link" button (POST `RetroGuestTokensController.store(retroId)` → `refetch()`), with the warning text `t('Creating a new link signs out every guest who joined with the old one.')`.

`handover-dialog.tsx` — `Select` of `board.viewer.transferCandidates` (label `name`, value `userId`) + "Hand over" → PUT `RetroFacilitatorsController.update(retroId)` `{ user_id }` → `refetch()` → close. Empty list → `t('No one else can facilitate this retrospective yet.')`.

`delete-retro-dialog.tsx` — confirmation dialog (pattern of `components/confirm-form-dialog.tsx` / `delete-user.tsx` visually) with `t('Delete this retrospective? Everyone loses access to it.')`; confirm → `retroRequest(RetrosController.destroy(retroId))` via `run` → `router.visit(board.links.team ?? '/dashboard')`.

`board-header.tsx` `actions`: `<TimerDisplay … />` always, plus for the facilitator `<TimerControl />` (not in Completed) and `<FacilitatorMenu />`; `<VoteProgress />` in Voting (from Task 5).

Add keys: `Previous`, `Next`, `Complete`, `Reopen`, `Timer`, `:count min`, `Stop timer`, `Time's up!`, `Discuss`, `Facilitator menu`, `Settings…`, `Guest link…`, `Hand over facilitation…`, `Delete retrospective…`, `Retrospective settings`, `Title`, `Anonymous cards`, `Votes per participant`, `Allow guests`, `Copy`, `Link copied`, `Create a new link`, `Creating a new link signs out every guest who joined with the old one.`, `Hand over`, `New facilitator`, `No one else can facilitate this retrospective yet.`, `Delete this retrospective? Everyone loses access to it.`, `Delete` (exists?) — skip existing ones.

- [ ] **Step 6: Verify** — types/lint. Manual: facilitator moves through all phases (the other browser follows), sets a 1-minute timer (both show the same countdown; at zero both see "Time's up!"), highlights cards in Discussing (the other browser scrolls), edits settings, enables guests and copies the link, opens it in a private window as a guest, regenerates the link (the guest's board switches to "access ended" after its refetch), hands facilitation to another member (menus move to them), deletes the retro (the other browser shows "deleted").

- [ ] **Step 7: Commit** — `feat: add facilitator controls to the board`.

---

### Task 7: Column editing

**Files:**
- Create: `resources/js/components/retro/add-column.tsx`
- Modify: `resources/js/components/retro/{column-header,board}.tsx`, `lang/*.json`

**Interfaces:**
- Consumes: `ColumnsController.store/update/destroy`, `ColumnOrdersController.update`, reducer `columns.set`, `ColumnColors`, `columnAccent`.

Rules: facilitator + Writing only. Each column header gets a menu: Rename (inline input), Color (6 swatches), Move left / Move right (PUT column-order with the swapped id list), Delete (disabled when the column has cards; confirm). A final "Add column" tile opens a small form (title + color). Every response `{columns}` → `columns.set`. Renaming/deleting a column with cards returns 422 → toast (from `run`).

- [ ] **Step 1: Header menu** — extend `ColumnHeader` with props `ctx?: BoardContextValue` and `index`, `total`, `hasCards`. When `ctx?.board.viewer.isFacilitator && phase === 'writing'`, render a `DropdownMenu` (lucide `Ellipsis`) with the actions above. Rename switches the title into an `Input` (`maxLength={60}`) saved on Enter/blur via `ColumnsController.update({ retro, column })` with `{ title }`. Colors call the same endpoint with `{ color }`. Move left/right:

```tsx
const move = async (offset: -1 | 1) => {
    const ids = ctx.board.columns.map((item) => item.id);
    const from = ids.indexOf(column.id);
    [ids[from], ids[from + offset]] = [ids[from + offset], ids[from]];

    const response = await ctx.run(retroRequest<{ columns: BoardColumn[] }>(ColumnOrdersController.update(ctx.board.retro.id), { column_ids: ids }));

    if (response) {
        ctx.dispatch({ type: 'columns.set', columns: response.columns });
    }
};
```

- [ ] **Step 2: Add column** — `add-column.tsx`: a dashed `w-72` tile with a form: `Input` title (max 60, required), color swatches (radio group of 6 buttons with `aria-label={t(colorLabel)}`), "Add column" → `ColumnsController.store(retroId)` → `columns.set`. Render it after the columns in `Board` for the facilitator in Writing. Color labels: `Green`, `Red`, `Blue`, `Amber`, `Purple`, `Slate` (translate).

Add keys: `Column menu`, `Rename`, `Color`, `Move left`, `Move right`, `Delete column`, `Only empty columns can be renamed or deleted.`, `Add column`, `Column title`, `Green`, `Red`, `Blue`, `Amber`, `Purple`, `Slate`.

- [ ] **Step 3: Verify** — types/lint. Manual: in a Custom retro (no columns) the facilitator adds three columns, renames one, recolours one, reorders, deletes an empty one; the other browser follows; after a card exists in a column, rename/delete show the error toast.

- [ ] **Step 4: Commit** — `feat: let facilitators edit columns on the board`.

---

### Task 8: Action items and completed summary

**Files:**
- Create: `resources/js/components/retro/{action-items-panel,completed-summary}.tsx`
- Modify: `resources/js/components/retro/board.tsx`, `lang/*.json`

**Interfaces:**
- Consumes: `ActionItemsController.store/update/destroy`, reducer `actionItem.upsert/remove`.

Rules: the panel shows in Discussing (editable by everyone, guests included) and Completed (read-only). Editable: add form (content 1–500 + optional assignee `Select` from `board.participants`), each item: checkbox done, content (click to edit inline), assignee select, delete. Completed: `CompletedSummary` at the top of the page — "Top topics" (top 5 top-level cards by `votes`, with their content and vote count) and the action item list (read-only), plus a "Retrospective completed on :date" line using `completedAt` (`new Date(...).toLocaleString(locale)` with the page `locale` prop).

- [ ] **Step 1: Panel** — `action-items-panel.tsx` (right-hand `aside`, `w-80`, sticky; on narrow screens below the columns). All mutations via `ctx.run(retroRequest(...))`, dispatching `actionItem.upsert` / `actionItem.remove` with the response (destroy → dispatch remove with the known id).

```tsx
const add = async () => {
    const response = await ctx.run(
        retroRequest<{ actionItem: ActionItem }>(ActionItemsController.store(retroId), {
            content: content.trim(),
            assignee_participant_id: assigneeId,
        }),
    );

    if (response) {
        ctx.dispatch({ type: 'actionItem.upsert', actionItem: response.actionItem });
        setContent('');
        setAssigneeId(null);
    }
};
```

Unassigned option in the `Select` uses the value `none` mapped to `null` (Radix Select cannot hold an empty string value).

- [ ] **Step 2: Summary** — `completed-summary.tsx` renders the two lists as described; `Board` shows it above the columns in Completed.

Add keys: `Action items`, `Add an action item…`, `Assignee`, `Unassigned`, `Mark as done`, `Delete action item`, `Edit action item`, `No action items yet.`, `Top topics`, `Retrospective completed on :date`.

- [ ] **Step 3: Verify** — types/lint. Manual: in Discussing both a member and a guest add, assign, complete and delete items (the other browser follows); in Completed the summary shows top-voted cards and items read-only; reopening restores editing.

- [ ] **Step 4: Commit** — `feat: track action items and summarise completed retrospectives`.

---

### Task 9: End-to-end check and polish

**Files:**
- Modify: as needed for defects found (commit each fix separately); `lang/*.json`

This task has no new feature. Run the whole flow in two real browsers against the dev stack (`vendor/bin/sail artisan dev`, or Reverb + Vite separately), in all four languages at least once, and fix what is broken.

- [ ] **Step 1: Scripted walkthrough** — as facilitator A and member B (plus guest C via the link in a private window): create a Start/Stop/Continue retro from the team page → Writing (A, B, C write; others see placeholders only) → Grouping (drag/group/ungroup) → Voting (limits, progress, no per-card numbers) → Discussing (totals, sort, highlight scrolls for everyone, action items incl. guest) → Completed (summary, read-only) → Reopen → Complete. Timer at 1 minute during Writing. Settings: anonymity on in a second retro and verify no author names are shown to others at any phase. Regenerate the guest link → C sees "access ended". Delete the retro → B sees "deleted".
- [ ] **Step 2: Resilience** — stop Reverb mid-retro → banner; make changes as A while B is disconnected; restart Reverb → B's board catches up (refetch). Trigger a 403 (e.g. B clicks + after A moved the phase; or edit a card in Voting via devtools) → translated toast, board resyncs.
- [ ] **Step 3: Accessibility and layout** — keyboard-only: write a card, vote, move a card with the keyboard sensor, open every dialog; screen widths 375px and 1440px (columns scroll horizontally, header wraps, action items panel moves below on small screens); dark mode.
- [ ] **Step 4: i18n** — switch through fr/es/de (members via settings, guest via the header switcher) and check the board for untranslated strings; `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php`.
- [ ] **Step 5: Full checks** — `vendor/bin/sail artisan test --compact`, phpstan, `npm run types:check`, `npm run check`, `npm run build`.
- [ ] **Step 6: Report** — list every defect found and the commit that fixed it; anything not fixed goes to the report with a reason.

---

## Spec coverage (Plan 4)

| Spec item | Task |
|---|---|
| AC13 phase rules visible in the UI | 3, 4, 5, 6 |
| AC14 vote limit UI | 5 |
| AC15 grouping UI | 4 |
| AC16 completed read-only + reopen | 6, 8 |
| AC17 guest join → board | 2, 9 |
| AC21 realtime updates applied | 2–8 |
| AC22–AC24 redaction rendered safely | 3, 5 |
| AC25 refetch on phase/settings/reconnect | 2, 6 |
| AC26 two browsers within a second | 9 |
| AC27 presence avatars | 2 |
| AC28 timer | 6 |
| AC29 highlight scroll | 6 |
| AC30 action items | 8 |
| AC34 four languages | all, 9 |
| Revoked guests / deleted retro screens (Plan 3 R18) | 2, 6 |
| CSRF for channel auth (Plan 3 note) | 2 |
