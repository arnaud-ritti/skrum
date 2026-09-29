# Plan 6 — Polish pass (carried minors) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the known rough edges left after Plans 4–5 — board state via React context, realtime robustness (own results vs refetch, own cards in other tabs, timeout and expired-session handling), six board UX fixes, and faster, owner-named multi-arch packaging.

**Architecture:** First a behaviour-neutral refactor moves board state into a `BoardProvider`/`useBoard()` context. Then server-derived updates from mutation responses go through the same refetch buffer as realtime events (the vote response gains an absolute `votesCast` so nothing relative is replayed), request errors are classified (timeout → status 0, 401/419 → session expired), and a private `participant.{id}` channel delivers the author's own card to their other tabs. UX fixes and packaging changes are independent tasks.

**Tech Stack:** Laravel 13 (PHP 8.4), Reverb + pusher-php-server, Pest, React 19, Inertia v3, `@laravel/echo-react`, `@dnd-kit/core` (`DragOverlay`), Docker buildx.

**Spec:** `docs/superpowers/specs/2026-09-29-polish-pass-design.md` (parent: `docs/superpowers/specs/2026-09-29-retro-board-core-design.md`).

## Global Constraints

- Commands through Sail: `vendor/bin/sail artisan …`, `vendor/bin/sail bin pint --dirty --format agent`, `vendor/bin/sail bin phpstan analyse --no-progress` (level 7, 0 errors). npm and docker on the host.
- No new dependencies (composer or npm).
- Redaction invariant from the parent spec is unchanged: nobody but the author ever receives Writing-phase content or anonymous authorship; presence payloads stay as they are.
- Every user-facing string via `t()` with real translations in `lang/{en,fr,es,de}.json` (German "du", French "vous", Spanish "tú"); `tests/Feature/TranslationKeysTest.php` stays green.
- Board API calls go through `retroRequest()`; Wayfinder route functions, no hard-coded URLs.
- Frontend checks: `vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npm run check` (known pre-existing failures only in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md`). Format only touched files with `npx vp fmt <files>`; never `npx prettier` on the repo.
- React style: function components, `type Props`, no default exports except pages, Tailwind, lucide icons.
- Commit messages: Conventional Commits, ending with exactly:
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01FcMxGGHCZcDTndQCc57VPC`

## Review Focus

1. **A vote response arriving while a refetch is in flight** → the vote total is neither lost nor counted twice. Pinned by the absolute `votesCast` in the vote response (`VotingTest`, Task 2) and applying it through the buffer; exercised in Task 6.
2. **Someone else subscribing to `private-participant.{id}` of another participant (member of the same retro, guest, other retro, malformed id)** → 403 every time. Pinned by `BroadcastAuthorizationTest` cases (Task 3).
3. **Session expires while the board is open (logout in another tab, cookie cleared)** → one persistent banner, no toast storm, board inert. Exercised in Task 6 Step 5.
4. **Dragging a card near the board's right edge or over a scrolled column** → the preview stays visible above everything. Exercised in Task 6 Step 4.
5. **amd64 image** → builds and passes the smoke test although the host is arm64. Task 6 Step 2.

---

### Task 1: Board context and shared vote sort (no behaviour change)

**Files:**
- Create: `resources/js/components/retro/board-context.tsx`
- Modify: `resources/js/components/retro/board.tsx` and every component that takes a `ctx: BoardContextValue` prop: `board-header.tsx`, `phase-stepper.tsx`, `timer-control.tsx`, `facilitator-menu.tsx`, `settings-dialog.tsx`, `guest-link-dialog.tsx`, `handover-dialog.tsx`, `delete-retro-dialog.tsx`, `retro-column.tsx`, `column-header.tsx`, `retro-card.tsx`, `card-composer.tsx`, `card-editor.tsx`, `vote-controls.tsx`, `add-column.tsx`, `action-items-panel.tsx`
- Modify: `resources/js/lib/retro/board-reducer.ts` (add `sortByVotes`), `resources/js/components/retro/completed-summary.tsx`

**Interfaces:**
- Produces: `BoardContextValue` (moved to `board-context.tsx`, re-exported by nothing else), `BoardProvider({ value, children })`, `useBoard(): BoardContextValue`, `sortByVotes<T extends { votes: number | null; position: number }>(cards: T[]): T[]`.

- [ ] **Step 1: Create the context**

`resources/js/components/retro/board-context.tsx`:

```tsx
import { createContext, useContext, type Dispatch, type ReactNode } from 'react';
import type { BoardAction } from '@/lib/retro/board-reducer';
import type { Snapshot } from '@/lib/retro/types';

export type BoardContextValue = {
    board: Snapshot;
    dispatch: Dispatch<BoardAction>;
    run: <T>(mutation: Promise<T>) => Promise<T | undefined>;
    refetch: () => Promise<void>;
};

const BoardContext = createContext<BoardContextValue | null>(null);

export function BoardProvider({
    value,
    children,
}: {
    value: BoardContextValue;
    children: ReactNode;
}) {
    return <BoardContext value={value}>{children}</BoardContext>;
}

export function useBoard(): BoardContextValue {
    const value = useContext(BoardContext);

    if (!value) {
        throw new Error('useBoard() must be used inside <BoardProvider>.');
    }

    return value;
}
```

- [ ] **Step 2: Use it everywhere**

In `board.tsx`: delete the local `BoardContextValue` type, import it from `./board-context`, and wrap the returned markup (everything inside the board's root element) in `<BoardProvider value={ctx}>`. In every component listed under Files: remove the `ctx` prop from its props type and signature, add `const ctx = useBoard();` as the first line of the component body, and remove `ctx={ctx}` from its JSX call sites. `column-header.tsx` and `phase-stepper.tsx` lose their optional `ctx?` prop the same way; replace `ctx!.` / `ctx?.` accesses with `ctx.` and delete the `if (!ctx …)` early returns that only existed for the optional prop. Props that belong to the component (`card`, `column`, `index`, `total`, `hasCards`, `open`, `onOpenChange`, `onDone`, `isChild`, `footer`, `online`, `actions`, `phase`, `onChanged`, `columnId`) stay and become required where they were optional only because of `ctx`. Update every import of `BoardContextValue` to `./board-context`.

- [ ] **Step 3: Shared vote sort**

`resources/js/lib/retro/board-reducer.ts`, add:

```ts
export function sortByVotes<T extends { votes: number | null; position: number }>(
    cards: T[],
): T[] {
    return [...cards].sort(
        (a, b) => (b.votes ?? 0) - (a.votes ?? 0) || a.position - b.position,
    );
}
```

Replace the inline sort in `retro-column.tsx` (~line 35) and in `completed-summary.tsx` (~line 13) with `sortByVotes(…)`; keep their surrounding filtering and slicing unchanged.

- [ ] **Step 4: Verify no behaviour change**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npm run check` → clean (known failures only).
Run: `grep -rn "ctx={ctx}\|ctx?: BoardContextValue\|ctx!\." resources/js/components/retro` → no matches.
Manual (best-effort): the board renders and a card can be written, voted and discussed as before.

- [ ] **Step 5: Commit**

```bash
git add resources/js/components/retro resources/js/lib/retro/board-reducer.ts
git commit -m "refactor: share board state through a react context"
```

---

### Task 2: Buffered mutation results, absolute vote totals, timeout and expired-session handling

**Files:**
- Modify: `app/Http/Controllers/Retros/CardVotesController.php` (`tally()` adds `votesCast`)
- Test: `tests/Feature/Retros/VotingTest.php`
- Modify: `resources/js/hooks/use-retro-board.ts`, `resources/js/components/retro/board-context.tsx`, `resources/js/components/retro/board.tsx`, `resources/js/lib/retro/api.ts`, `resources/js/lib/retro/board-reducer.ts` (remove `votes.adjust`)
- Modify (response dispatches → `apply`): `add-column.tsx`, `action-items-panel.tsx`, `card-editor.tsx`, `card-composer.tsx`, `column-header.tsx`, `retro-card.tsx`, `vote-controls.tsx`, `timer-control.tsx`, `board.tsx`
- Create: `resources/js/components/retro/session-expired-banner.tsx`
- Modify: `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: Task 1 `useBoard()`, `BoardContextValue`.
- Produces: `BoardContextValue.apply: (action: BoardAction) => void` (buffered while a refetch is in flight); `useRetroBoard` returns `sessionExpired: boolean` and `apply`; `RetroRequestError` with `status === 0` means timeout; vote responses `{cardId, myVotes, remainingVotes, votesCast}`.

- [ ] **Step 1: Write the failing test**

In `tests/Feature/Retros/VotingTest.php`, add (reuse the file's existing setup helpers/factories for a retro in Voting with a card and a member; mirror the arrange part of the existing "casts a vote" test):

```php
it('returns the retro vote total with every tally', function () {
    $retro = Retro::factory()->create(['phase' => RetroPhase::Voting, 'votes_per_participant' => 3]);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    [$user] = retroMember($retro);
    [$other] = retroMember($retro);

    $this->actingAs($other)->postJson(route('retros.cards.votes.store', ['retro' => $retro, 'card' => $card]))->assertCreated();

    $this->actingAs($user)
        ->postJson(route('retros.cards.votes.store', ['retro' => $retro, 'card' => $card]))
        ->assertCreated()
        ->assertJsonPath('votesCast', 2);

    $this->actingAs($user)
        ->deleteJson(route('retros.cards.votes.destroy', ['retro' => $retro, 'card' => $card]))
        ->assertOk()
        ->assertJsonPath('votesCast', 1);
});
```

(Check the vote route names with `vendor/bin/sail artisan route:list --path=votes` and the factory states used by the existing tests; adapt only names, not assertions.)

- [ ] **Step 2: Run test to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/VotingTest.php`
Expected: the new test FAILS (`votesCast` missing).

- [ ] **Step 3: Return the total**

`CardVotesController::tally()` adds:

```php
            'votesCast' => $retro->votes()->count(),
```

Update the method's array-shape docblock accordingly. Run the test file again → PASS.

- [ ] **Step 4: Buffered `apply` in the context**

`use-retro-board.ts`: the existing `apply` stays as is; return it from the hook together with `sessionExpired`. `board-context.tsx`: add `apply: (action: BoardAction) => void;` to `BoardContextValue`. `board.tsx`: pass `apply` in the context value.

Then change every dispatch that applies a **server response** to `ctx.apply(…)` (keep `ctx.dispatch` only for optimistic updates made before the request):
- `add-column.tsx` `columns.set`; `column-header.tsx` `columns.set`;
- `action-items-panel.tsx` `actionItem.upsert` (both) and `actionItem.remove`;
- `card-editor.tsx` and `card-composer.tsx` `cards.upsert`;
- `retro-card.tsx` `card.remove` after a successful delete, `highlight.set`, and `cards.upsert` after ungroup;
- `timer-control.tsx` `timer.set`;
- `board.tsx` `cards.upsert` after a move and after a group (the `card.place` before the request stays `dispatch`);
- `vote-controls.tsx`: keep the optimistic `votes.tally` as `dispatch`; replace the two response dispatches with

```ts
        if (tally) {
            ctx.apply({
                type: 'votes.tally',
                cardId: tally.cardId,
                myVotes: tally.myVotes,
                remainingVotes: tally.remainingVotes,
            });
            ctx.apply({ type: 'votes.cast', votesCast: tally.votesCast });
        }
```

and add `votesCast: number` to its `Tally` type.

In `board-reducer.ts` remove the `votes.adjust` action (type union member and reducer case); `grep -rn "votes.adjust" resources/js` must return nothing.

- [ ] **Step 5: Timeout and expired session**

`resources/js/lib/retro/api.ts`: import `HttpCancelledError` from `@inertiajs/core`; in the `catch` of `retroRequest`, before `throw error;`:

```ts
        if (error instanceof HttpCancelledError) {
            throw new RetroRequestError(0, 'timeout');
        }
```

`use-retro-board.ts`:

```ts
const SessionExpiredStatuses = [401, 419];
```

- add `const [sessionExpired, setSessionExpired] = useState(false);`
- in `refetch`'s catch: `if (SessionExpiredStatuses.includes(error.status)) { setSessionExpired(true); }` (alongside the existing 404/403 handling);
- `run` becomes:

```ts
    const run = useCallback(
        async <T>(mutation: Promise<T>): Promise<T | undefined> => {
            try {
                return await mutation;
            } catch (error) {
                if (
                    error instanceof RetroRequestError &&
                    SessionExpiredStatuses.includes(error.status)
                ) {
                    setSessionExpired(true);

                    return undefined;
                }

                toast.error(errorMessage(error));
                await refetch();

                return undefined;
            }
        },
        [refetch, errorMessage],
    );
```

with, above it:

```ts
    const errorMessage = useCallback(
        (error: unknown): string => {
            if (!(error instanceof RetroRequestError)) {
                return t('Something went wrong. Please try again.');
            }

            if (error.status === 0) {
                return t('The server did not respond in time. Please try again.');
            }

            return error.message;
        },
        [t],
    );
```

`resources/js/components/retro/session-expired-banner.tsx`:

```tsx
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

export function SessionExpiredBanner() {
    const { t } = useTrans();

    return (
        <div
            role="alert"
            className="flex items-center justify-center gap-3 bg-destructive px-4 py-2 text-sm text-white"
        >
            <span>{t('Your session has expired.')}</span>
            <Button
                size="sm"
                variant="secondary"
                onClick={() => window.location.reload()}
            >
                {t('Reload')}
            </Button>
        </div>
    );
}
```

`board.tsx`: render `{sessionExpired && <SessionExpiredBanner />}` right below `<ConnectionBanner … />`, and put `inert={sessionExpired}` on the element that wraps the summary, columns and action-items panel (the `div` containing `DndContext` and `CompletedSummary`), so the header's banner stays reachable.

- [ ] **Step 6: Translations**

Add to all four `lang/*.json` files (check `Reload` exists first; add only missing keys):

| key | fr | es | de |
|---|---|---|---|
| The server did not respond in time. Please try again. | Le serveur n'a pas répondu à temps. Veuillez réessayer. | El servidor no respondió a tiempo. Inténtalo de nuevo. | Der Server hat nicht rechtzeitig geantwortet. Versuch es bitte noch einmal. |
| Your session has expired. | Votre session a expiré. | Tu sesión ha caducado. | Deine Sitzung ist abgelaufen. |
| Reload | Recharger | Recargar | Neu laden |

- [ ] **Step 7: Verify**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/VotingTest.php tests/Feature/TranslationKeysTest.php` → PASS.
Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress` → clean.
Run: `vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npm run check` → clean (known failures only).

- [ ] **Step 8: Commit**

```bash
git add app/Http/Controllers/Retros/CardVotesController.php tests/Feature/Retros/VotingTest.php resources/js lang
git commit -m "feat: keep own results across refetches and surface timeouts and expired sessions"
```

---

### Task 3: Private participant channel for the author's own cards

**Files:**
- Create: `app/Events/Retros/OwnCardSaved.php`
- Modify: `app/Events/Retros/RetroBroadcastEvent.php` (`broadcastOn(): Channel`)
- Modify: `app/Http/Controllers/BroadcastAuthorizationsController.php`
- Modify: `app/Http/Controllers/Retros/CardsController.php` (store, update)
- Modify: `resources/js/hooks/use-retro-channel.ts`, `resources/js/hooks/use-retro-board.ts`
- Test: `tests/Feature/Retros/BroadcastAuthorizationTest.php`, `tests/Feature/Retros/CardsTest.php`

**Interfaces:**
- Consumes: Task 2 buffered `apply` inside `useRetroBoard`.
- Produces: channel `private-participant.{participantId}`; event `own-card.saved` payload `{ card: CardPayload }` presented for the author; `useRetroChannel(retroId, participantId, enabled, onEvent, onResync, onJoining, onOwnCard)`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/Feature/Retros/BroadcastAuthorizationTest.php`:

```php
function authorizeParticipantChannel(string $participantId): array
{
    return [
        'socket_id' => '1234.5678',
        'channel_name' => "private-participant.{$participantId}",
    ];
}

it('lets a member subscribe to their own participant channel', function () {
    $retro = Retro::factory()->create();
    [$user, $participant] = retroMember($retro);

    $response = $this->actingAs($user)
        ->postJson(route('broadcasting.auth'), authorizeParticipantChannel($participant->id))
        ->assertOk();

    expect($response->json('auth'))->toStartWith('test-key:');
});

it('lets a guest subscribe to their own participant channel', function () {
    $retro = Retro::factory()->withGuestAccess()->create();
    $guest = Participant::factory()->guest()->create(['retro_id' => $retro->id]);

    $this->withCookies(retroGuestCookie($guest))
        ->withCredentials()
        ->postJson(route('broadcasting.auth'), authorizeParticipantChannel($guest->id))
        ->assertOk();
});

it('refuses another participant channel of the same retro', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    [, $other] = retroMember($retro);

    $this->actingAs($user)
        ->postJson(route('broadcasting.auth'), authorizeParticipantChannel($other->id))
        ->assertForbidden();
});

it('refuses unknown or malformed participant channels', function (string $participantId) {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);

    $this->actingAs($user)
        ->postJson(route('broadcasting.auth'), authorizeParticipantChannel($participantId))
        ->assertForbidden();
})->with([
    'unknown uuid' => fn () => (string) Str::uuid7(),
    'not a uuid' => 'abc',
]);
```

(Add `use Illuminate\Support\Str;` at the top.)

Append to `tests/Feature/Retros/CardsTest.php` (import `App\Events\Retros\OwnCardSaved`):

```php
it('sends the author their own card on their private channel', function () {
    $retro = Retro::factory()->create();
    $column = Column::factory()->create(['retro_id' => $retro->id]);
    [$user, $participant] = retroMember($retro);

    $response = $this->actingAs($user)
        ->withHeader('X-Socket-ID', '111.222')
        ->postJson(route('retros.cards.store', $retro), ['column_id' => $column->id, 'content' => 'Deploys are slow'])
        ->assertCreated();

    Event::assertDispatched(OwnCardSaved::class, fn (OwnCardSaved $event) => $event->participantId === $participant->id
        && $event->card['id'] === $response->json('card.id')
        && $event->card['content'] === 'Deploys are slow'
        && $event->card['isMine'] === true
        && $event->socket === '111.222'
        && $event->broadcastOn()->name === "private-participant.{$participant->id}");

    $this->actingAs($user)
        ->patchJson(route('retros.cards.update', [$retro, $response->json('card.id')]), ['content' => 'Deploys are faster'])
        ->assertOk();

    Event::assertDispatched(OwnCardSaved::class, fn (OwnCardSaved $event) => $event->card['content'] === 'Deploys are faster');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/BroadcastAuthorizationTest.php tests/Feature/Retros/CardsTest.php`
Expected: FAIL — participant channels are refused (403 on the allowed cases) and `OwnCardSaved` does not exist.

- [ ] **Step 3: Event**

`app/Events/Retros/RetroBroadcastEvent.php`: change the return type of `broadcastOn()` to `Illuminate\Broadcasting\Channel` (import it; keep returning the same `PresenceChannel`).

`app/Events/Retros/OwnCardSaved.php`:

```php
<?php

namespace App\Events\Retros;

use Illuminate\Broadcasting\PrivateChannel;

class OwnCardSaved extends RetroBroadcastEvent
{
    /**
     * @param  array<string, mixed>  $card
     */
    public function __construct(string $retroId, public string $participantId, public array $card)
    {
        parent::__construct($retroId);
    }

    public function broadcastOn(): PrivateChannel
    {
        return new PrivateChannel("participant.{$this->participantId}");
    }

    public function broadcastAs(): string
    {
        return 'own-card.saved';
    }

    public function broadcastWith(): array
    {
        return ['card' => $this->card];
    }
}
```

`CardsController::store` and `::update`: right after the existing `CardCreated` / `CardUpdated` `->sendToOthers()` line, inside the same transaction, add (use the created/updated card variable and the locked retro of that method):

```php
            (new OwnCardSaved($locked->id, $participant->id, $this->presentCard->handle($card, $locked, $participant)))->sendToOthers();
```

(In `update` the card variable is `$fresh`.)

- [ ] **Step 4: Channel authorization**

In `BroadcastAuthorizationsController::store`, after validation, branch on the channel prefix: `presence-retro.` keeps the existing code path unchanged; `private-participant.` goes to a new private method; anything else → `abort(403)`.

```php
    /**
     * @param  array{socket_id: string, channel_name: string}  $validated
     */
    private function authorizeParticipantChannel(Request $request, array $validated, ResolveParticipant $resolveParticipant): JsonResponse
    {
        $participantId = Str::after($validated['channel_name'], 'private-participant.');

        abort_unless(Str::isUuid($participantId), 403);

        $owner = Participant::query()->find($participantId);

        abort_if($owner === null, 403);

        $participant = $resolveParticipant->handle($request, $owner->retro);

        abort_unless($participant?->id === $owner->id, 403);

        $broadcaster = Broadcast::connection();

        abort_unless($broadcaster instanceof PusherBroadcaster, 503);

        $signature = $broadcaster->getPusher()->authorizeChannel($validated['channel_name'], $validated['socket_id']);

        return response()->json(json_decode($signature, true));
    }
```

(Import `App\Models\Participant` if not already imported.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Retros/BroadcastAuthorizationTest.php tests/Feature/Retros/CardsTest.php tests/Feature/Retros/RetroBroadcastEventTest.php`
Expected: PASS, including the existing redaction assertions.

- [ ] **Step 6: Client subscription**

`use-retro-channel.ts`: new signature `useRetroChannel(retroId, participantId, enabled, onEvent, onResync, onJoining, onOwnCard)` with `onOwnCard: (card: CardPayload) => void` added to the `handlers` ref. Inside the existing effect (after the presence channel setup):

```ts
        const ownChannel = `participant.${participantId}`;

        echo<'reverb'>()
            .private(ownChannel)
            .listen('.own-card.saved', (payload: { card: CardPayload }) =>
                handlers.current.onOwnCard(payload.card),
            );
```

and in the cleanup add `echo().leave(ownChannel);`. Add `participantId` to the effect dependencies.

`use-retro-board.ts`: pass `initial.viewer.participantId` and `onOwnCard = useCallback((card: CardPayload) => apply({ type: 'cards.upsert', cards: [card] }), [apply])`. Delete `isOwnRedactedCard` and its refetch branch in `onEvent` (the private channel now delivers the author's content; the reducer's `keepsOwnView` already protects own cards from redacted presence payloads).

- [ ] **Step 7: Verify and commit**

Run: `vendor/bin/sail bin pint --dirty --format agent && vendor/bin/sail bin phpstan analyse --no-progress` → clean.
Run: `vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npm run check` → clean.
Run: `vendor/bin/sail artisan test --compact` → all pass.

```bash
git add app tests resources/js/hooks
git commit -m "feat: deliver own cards to the author's other tabs on a private channel"
```

---

### Task 4: Board UX fixes

**Files:**
- Modify: `resources/js/components/retro/board.tsx`, `dnd.tsx`, `retro-card.tsx`, `card-editor.tsx`, `vote-controls.tsx`, `column-header.tsx`, `add-column.tsx`, `action-items-panel.tsx`, `lang/{en,fr,es,de}.json`

**Interfaces:**
- Consumes: Task 1 `useBoard()`, Task 2 `ctx.apply`.
- Produces: `CardPreview({ card }: { card: BoardCard })` exported from `retro-card.tsx`; `CardEditor` prop `editable: boolean`.

- [ ] **Step 1: B1 — drag overlay**

`retro-card.tsx`: export a static preview (no hooks from dnd-kit, no buttons):

```tsx
export function CardPreview({ card }: { card: BoardCard }) {
    const { t } = useTrans();

    return (
        <article className="w-64 rounded-md border bg-card p-3 text-sm shadow-lg">
            {card.content === null ? (
                <p className="text-muted-foreground italic">
                    {t('Hidden until writing ends')}
                </p>
            ) : (
                <p className="break-words whitespace-pre-wrap">{card.content}</p>
            )}
            {card.author && (
                <p className="mt-2 text-xs text-muted-foreground">
                    {card.author.name}
                </p>
            )}
        </article>
    );
}
```

`board.tsx`: `const [activeCardId, setActiveCardId] = useState<string | null>(null);` On `DndContext` add `onDragStart={(event) => setActiveCardId(parseDndId(event.active.id)?.id ?? null)}`, `onDragCancel={() => setActiveCardId(null)}`, and call `setActiveCardId(null)` at the start of the existing `onDragEnd` handler. Inside `DndContext`, after `</main>`:

```tsx
                    <DragOverlay>
                        {activeCard ? <CardPreview card={activeCard} /> : null}
                    </DragOverlay>
```

with `const activeCard = board.cards.find((card) => card.id === activeCardId) ?? null;` (import `DragOverlay` from `@dnd-kit/core`).

`dnd.tsx` `GroupableCard`: drop the `style={{ transform: … }}` (the overlay now shows the moving card; the source stays in place at `opacity-50`). Leave `SortableCard` unchanged.

- [ ] **Step 2: B2 — in-flight guards**

`vote-controls.tsx`: `const [busy, setBusy] = useState(false);` — `vote` returns early if `busy`, sets it before the request and clears it in `finally`; both buttons get `disabled={busy || …existing condition}`.
`retro-card.tsx` `remove`: same pattern with `const [removing, setRemoving] = useState(false);`, and the delete button gets `disabled={removing}`.

- [ ] **Step 3: B3 — editor follows editability**

`retro-card.tsx` passes `editable={canChange}` to `CardEditor`. `card-editor.tsx` adds `editable: boolean` to its props and:

```tsx
    useEffect(() => {
        if (editable) {
            return;
        }

        if (content.trim() !== (card.content ?? '').trim()) {
            toast(t('The phase changed before your edit was saved.'));
        }

        onDone();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- react only to editability changes
    }, [editable]);
```

(Import `useEffect` and `toast` from `sonner`. If the project's lint forbids the disable comment, use a ref holding the latest `content`/`onDone` instead and keep the effect deps `[editable]`.)

- [ ] **Step 4: B4, B5, B6**

`column-header.tsx`: make the internal `apply` helper return the response (or `undefined` on failure/early return), and change `destroy` to close the dialog only on success:

```ts
    const destroy = async () => {
        const response = await apply(
            retroRequest<{ columns: BoardColumn[] }>(
                ColumnsController.destroy({
                    retro: ctx.board.retro.id,
                    column: column.id,
                }),
            ),
        );

        if (response) {
            setConfirmingDelete(false);
        }
    };
```

`add-column.tsx`: in the success branch after `setTitle('')`, add `setColor('green');`.
`action-items-panel.tsx`: the add form's `<AssigneeSelect … />` gets `disabled={sending}`.

- [ ] **Step 5: Translation**

Add to all four `lang/*.json`: "The phase changed before your edit was saved." → fr "La phase a changé avant l'enregistrement de votre modification.", es "La fase cambió antes de que se guardara tu cambio.", de "Die Phase hat sich geändert, bevor deine Änderung gespeichert wurde."

- [ ] **Step 6: Verify and commit**

Run: `vendor/bin/sail artisan wayfinder:generate --with-form && npm run types:check && npm run check` → clean; `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php` → PASS.
Manual (best-effort): drag a card to the last column — the preview stays visible; double-click vote + → one vote.

```bash
git add resources/js/components/retro lang
git commit -m "fix: polish drag preview, in-flight guards and board dialogs"
```

---

### Task 5: Packaging — owner image name and native build stages

**Files:**
- Modify: `Dockerfile`, `compose.production.yaml`, `README.md`

**Interfaces:**
- Produces: `SKRUM_IMAGE` default `ghcr.io/arnaud-ritti/skrum:latest`.

- [ ] **Step 1: Record the current image content**

Run: `docker run --rm --entrypoint sh skrum:latest -c 'cd /app && find . -type f | grep -v "^./public/build/assets/" | sort' > /private/tmp/claude-501/-Users-aritti-Projects-skrum/662998c8-4543-4e5d-bc20-b775ee6c52b7/scratchpad/files-before.txt` (built asset file names contain hashes and may change; everything else must not).

- [ ] **Step 2: Native build stages**

In `Dockerfile`:
- `FROM node:${NODE_VERSION}-alpine AS node` → `FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-alpine AS node`.
- Replace `FROM base AS build` with a stage that does not depend on the target-arch `base`:

```dockerfile
FROM --platform=$BUILDPLATFORM dunglas/frankenphp:1-php${PHP_VERSION}-alpine AS build

RUN install-php-extensions bcmath intl pcntl pdo_pgsql zip

WORKDIR /app
```

keeping every following line of the old build stage unchanged (composer copy, node copy, npm link, composer install, npm ci, `COPY . .`, the storage skeleton, dump-autoload, `npm run build`, the worker copy, the cleanup).
- `base` and `runtime` stay as they are (`runtime` still `FROM base` and `COPY --from=build /app /app`).

- [ ] **Step 3: Owner image**

`compose.production.yaml`: `image: '${SKRUM_IMAGE:-ghcr.io/arnaud-ritti/skrum:latest}'`.
`README.md`: replace every `<owner>/skrum` with `arnaud-ritti/skrum` and remove the sentence explaining the `<owner>` placeholder; the "set `SKRUM_IMAGE`" instruction becomes optional ("override `SKRUM_IMAGE` to pin a version, e.g. `ghcr.io/arnaud-ritti/skrum:1.0`").

- [ ] **Step 4: Verify**

Run: `docker build -t skrum:latest .` → succeeds.
Run the Step 1 command again into `files-after.txt` and `diff files-before.txt files-after.txt` → no differences.
Run: `docker run --rm skrum:latest` → the missing-variables message (unchanged behaviour).
Run: `DB_PASSWORD=x docker compose -f compose.production.yaml config | grep image:` → `ghcr.io/arnaud-ritti/skrum:latest`.
Run: `grep -n "<owner>" README.md compose.production.yaml` → nothing.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile compose.production.yaml README.md
git commit -m "build: name the ghcr image and build platform-independent stages natively"
```

---

### Task 6: Verification (controller-driven)

No new feature. Prove the acceptance criteria, fix what breaks (one commit per fix), report.

- [ ] **Step 1: Full checks** — `vendor/bin/sail artisan test --compact`, phpstan, `npm run types:check`, `npm run check`, `npm run build`.
- [ ] **Step 2: amd64 (PE3)** — `docker buildx build --platform linux/amd64 -t skrum:amd64 --load .`; smoke test it on a throwaway network with `postgres:18-alpine` (both `--platform linux/amd64`): migrations run, `/up` 200 inside, websocket upgrade 101 via `/app`, services as `www-data`, healthy. Remove everything afterwards (keep `skrum:latest`).
- [ ] **Step 3: Board walkthrough (Sail dev app, two browsers + second tab)** — PA1 (vote during a refetch triggered by a phase/settings change: totals right), PA2 (same member in two tabs: a card written in tab 1 shows its content in tab 2, hidden for the other participant), PB2 (double-click vote), PB3 (edit a card, facilitator moves to Voting: editor closes + toast), PB4 (make a column delete fail, e.g. add a card to it from the other browser just before confirming: dialog stays open), PB5, PB6.
- [ ] **Step 4: Drag (PB1, PD1)** — drag a card to the last column and near the right edge: preview visible; keyboard only in Grouping: focus a card, Space, arrows onto another card, Space → grouped; again onto a column → moved.
- [ ] **Step 5: Session (PA5) and timeout (PA4)** — sign out in another tab of the same member session, then act on the board: one banner, board inert, Reload leads to login; timeout: temporarily pause the app container (`docker pause` of the Sail app for ~20 s) during a board action → translated timeout toast, board recovers after unpause.
- [ ] **Step 6: Report** — each AC with its evidence; defects with fix commits.

---

## Spec coverage (Plan 6)

| Spec item / AC | Task |
|---|---|
| PC1 context, no optional ctx, shared sort | 1 |
| PA1 mutation results survive refetch | 2 (+ absolute `votesCast`) |
| PA2, PA3 private participant channel | 3 |
| PA4 timeout message | 2 |
| PA5 session expired banner + inert | 2 |
| PB1 drag overlay | 4 |
| PB2 in-flight guards | 4 |
| PB3 editor follows editability | 4 |
| PB4 delete dialog stays open on failure | 4 |
| PB5 add-column reset | 4 |
| PB6 assignee select disabled while saving | 4 |
| PE1 owner image name, no placeholder | 5 |
| PE2 native build stages, unchanged content | 5 |
| PE3 amd64 build + smoke | 6 |
| PD1 keyboard grouping | 6 |
| PI1 translations | 2, 4 |
