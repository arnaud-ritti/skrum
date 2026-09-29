# Skrum — Polish pass (carried minors) — Design

Date: 2026-09-29
Status: Approved design, awaiting spec review
Parent spec: `docs/superpowers/specs/2026-09-29-retro-board-core-design.md` (all its rules still apply; nothing here relaxes redaction)

## 1. Intent

Before a first public release, remove the known rough edges left after Plans 4 (board UI) and 5 (packaging), so users do not hit them and the board code is easier to maintain.

**Success:** every item below is either fixed and covered by its acceptance criterion, or explicitly listed as out of scope; the test suite, phpstan, type-check and lint stay green; a two-browser walkthrough (including keyboard-only grouping) passes.

### In scope

- **C. Code tidy** (done first, no behaviour change): board state shared through a React context instead of a prop-drilled `ctx`; no optional `ctx?` props; one vote-sort helper.
- **A. Realtime robustness:** own mutation results survive an in-flight refetch; a participant's own card created or edited in another tab of theirs shows its content; request timeouts show a clear message; expired sessions are detected and surfaced.
- **B. Board UX:** drag preview not clipped; in-flight guards on vote +/− and card delete; card editor closes when the card stops being editable; delete-column dialog stays open on failure; add-column colour resets; action-item assignee select disabled while saving.
- **E. Packaging:** default image `ghcr.io/arnaud-ritti/skrum`; faster multi-arch CI by building platform-independent parts natively; amd64 build verified locally.
- **D.** Keyboard-only grouping verified in the final walkthrough.

### Out of scope

- New features, visual redesign, a frontend test runner, browser E2E suite.
- Changing `--env-file` / `env_file:` behaviour (documented), restart back-off of a misconfigured container.

## 2. Code tidy (C)

- `resources/js/components/retro/board-context.tsx` exports `BoardProvider` and `useBoard(): BoardContextValue`. `useBoard()` throws a clear error outside the provider.
- `Board` renders `<BoardProvider value={…}>`; descendants call `useBoard()` instead of receiving `ctx`. Components keep the props that are genuinely theirs (e.g. `card`, `column`, `index`, `total`, `hasCards`), and those props become required.
- `sortByVotes(cards)` (votes desc, then position asc, returns a new array) lives in `resources/js/lib/retro/board-reducer.ts` and is used by the column and the completed summary.
- No user-visible change.

## 3. Realtime robustness (A)

### A1 — Own mutation results vs an in-flight refetch

`useRetroBoard` already buffers realtime events while a snapshot refetch is in flight and replays them after `replace`. Server-derived updates from the viewer's own mutation responses go through the same path: the context exposes `apply(action)` (buffered while a refetch is pending, dispatched immediately otherwise) alongside `dispatch` (always immediate, used only for optimistic updates). Every place that dispatches from a mutation response uses `apply`.

Replayed actions must be absolute, never relative: the vote endpoints' response gains `votesCast` (the retro's current vote total), and the client applies it as an absolute value instead of adding ±1, so a replay after a refetch cannot double-count.

Vote totals are also ordered: the retro keeps a `votes_version` integer, incremented under the existing retro lock on every vote cast or retracted. The snapshot, the vote endpoints' response and the `vote.cast` / `vote.retracted` broadcasts carry it next to `votesCast`, and the client ignores a total whose version is not newer than the one it already shows, so a peer's older total delivered after the viewer's own response cannot overwrite it.

### A2 — Own cards in the participant's other tabs

- New private channel `private-participant.{participantId}` (participant UUID).
- `/broadcasting/auth` authorizes it only when the participant resolved from the request (member session or guest cookie, for the participant's retro) has exactly that id; anything else → 403. The existing presence-channel authorization is unchanged.
- When a card is created or its content is updated, besides the existing redacted presence broadcast, the server broadcasts `own-card.saved` on the author's private channel with the card presented **for the author** (`isMine: true`, full content, author). It uses the same after-commit, report-don't-throw, `toOthers()` delivery as other board events, so the originating tab does not receive it.
- The client subscribes to its own private channel while the board is active and upserts the received card.
- Redaction invariant: no other participant can subscribe to someone else's channel, and the presence payloads are unchanged.

### A3 — Request timeout message

`retroRequest` turns a timeout/abort into `RetroRequestError` with status `0`; the board shows the translated message "The server did not respond in time. Please try again." (then refetches as today).

### A4 — Expired session

Board API requests (JSON) with no authenticated user and no guest cookie for that retro are answered **401** (a logged-out or expired member session); 403 remains for revoked or disabled guest cookies and members without access, and every 403 carries a translated message ("You no longer have access to this retrospective."). Page visits keep redirecting to login.

When any board request or refetch receives 401 or 419:

- a persistent banner "Your session has expired." with a **Reload** button (`role="alert"`) is shown;
- the whole page except the banner becomes non-interactive (`inert`), including the header's facilitator controls;
- no toast storm: the banner replaces per-request error toasts for 401/419;
- Reload performs a full page reload (members land on login and return; guests whose cookie is no longer valid see the existing "access ended" screen).

## 4. Board UX (B)

- **B1** Dragging renders the card in a `DragOverlay` (portal), so it is never clipped by the scrollable board.
- **B2** Vote + and − and card delete are disabled while their own request is in flight.
- **B3** If a card becomes non-editable while its editor is open (phase change, card no longer the viewer's), the editor closes; if the draft differed from the saved content, a toast says "The phase changed before your edit was saved."
- **B4** The delete-column confirmation dialog stays open when deletion fails.
- **B5** After a column is added, the add-column form resets its title and colour to the defaults.
- **B6** The add-action-item assignee select is disabled while the item is being saved.

## 5. Packaging (E)

- `compose.production.yaml` defaults `SKRUM_IMAGE` to `ghcr.io/arnaud-ritti/skrum:latest` (still overridable; `build: .` kept for local builds). README uses `arnaud-ritti/skrum` everywhere `<owner>` appeared.
- Dockerfile: the stages that produce platform-independent output (PHP `vendor/` and built assets) run on `--platform=$BUILDPLATFORM`; only the runtime stage (apk packages, PHP extensions, s6-overlay) is built for the target platform. The resulting image content and behaviour are unchanged.
- An `linux/amd64` image builds locally (under emulation) and passes the smoke test.

## 6. i18n

Every new string goes through `t()` with real translations in `lang/{en,fr,es,de}.json` (German "du", French "vous", Spanish "tú"): the timeout message, the session-expired banner and its button, and the phase-changed toast.

## 7. Testing

- Pest: private participant channel authorization (own member channel OK; own guest channel OK via guest cookie; another participant's channel 403; malformed/unknown id 403).
- Pest: creating and updating a card broadcasts `own-card.saved` on the author's private channel with full content, while the presence broadcast stays redacted in Writing (existing redaction tests stay green).
- Frontend: `types:check` and lint; behaviour verified in the final walkthrough.
- Docker: arm64 build + smoke test; amd64 build + smoke test under emulation.

## 8. Acceptance criteria

- **PC1** Board components obtain board state via `useBoard()`; no component takes an optional `ctx` prop; one `sortByVotes` helper is used by column and summary; no behaviour change.
- **PA1** A mutation response that arrives while a snapshot refetch is in flight is not lost: after the refetch the board shows the mutation's result.
- **PA1b** The displayed "votes cast" total never goes back to an older value because of delivery order (version-ordered totals).
- **PA2** A participant with two tabs on the same board sees, in the second tab, the full content of a card created or edited in the first tab during Writing; other participants still see it hidden.
- **PA3** Only the owning participant can subscribe to `private-participant.{id}` (member and guest); any other request is refused with 403.
- **PA4** A board request that times out shows "The server did not respond in time. Please try again." in the active locale.
- **PA5a** A board API request from a logged-out member (no session, no guest cookie) is answered 401; a revoked guest cookie still gets 403 with a translated message; no toast is ever blank.
- **PA5** A 401 or 419 on any board request or refetch shows the persistent session-expired banner with a Reload button and makes everything but the banner non-interactive (header included), without repeated error toasts.
- **PB1** A dragged card is never clipped by the board's scroll container.
- **PB2** Vote +/− and card delete cannot send a second request while the first is in flight.
- **PB3** A card editor closes when its card becomes non-editable; a changed draft triggers the phase-changed toast.
- **PB4** A failed column deletion leaves its confirmation dialog open.
- **PB5** The add-column form resets title and colour after a successful add.
- **PB6** The add-action-item assignee select is disabled while saving.
- **PE1** `docker compose -f compose.production.yaml up` without `SKRUM_IMAGE` uses `ghcr.io/arnaud-ritti/skrum:latest`; the README contains no `<owner>` placeholder.
- **PE2** Multi-arch image builds run dependency install and asset build natively (`$BUILDPLATFORM`); the image content is unchanged (same files under `/app`, same services).
- **PE3** A `linux/amd64` image builds and passes the smoke test (migrations, `/up` 200, websocket upgrade, services as `www-data`, healthy).
- **PD1** Keyboard-only: a card can be grouped under another and moved to another column in Grouping using only the keyboard.
- **PI1** All new strings exist in all four locales; `TranslationKeysTest` passes.
