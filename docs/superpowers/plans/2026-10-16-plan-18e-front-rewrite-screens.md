# Front-end Rewrite — Screens (Plan 18e) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development to run this plan task by task (through the Workflow tool, as the project does). Steps use checkbox (`- [ ]`) syntax. Every agent reads **Global Constraints**, **Screen task procedure** and its own task; a screen task also reads the brief section it names before anything else.

**Goal:** Every Inertia page is rebuilt in place from its mockup on the `ui/` and `skrum/` libraries under the new layouts, one commit per screen, with no feature lost and the browser suite green.

**Architecture:** A page is thin: it renders its layout (directly or through the shell of its domain) and one container from `resources/js/components/<domain>/`. Containers wire the existing hooks, reducers and `lib/*` to presentational `skrum/` components. The four live session types (retro, poker, game room, whiteboard) share one session shell and the containers of `resources/js/components/session/`. The back end changes only where spec §9 says so (B1, B2, B3, B10, B15, and the B16 prop renames).

**Tech Stack:** Laravel 13, PHP 8.4, Pest 5 (feature, arch, browser), Inertia 3, React 19, Tailwind 4, vite-plus (Vitest), Wayfinder, Reverb, dnd-kit, frimousse, live-cursors, live-reactions, Excalidraw 0.18.1.

**Spec:** `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` — §4 to §13; row 18e of §12; B1, B2, B3, B10, B15, B16 of §9. The amendment `18e-spec-amendment.md` (Task 0.1 folds it into the spec once approved) is part of the spec for this plan.

**Research base (requirements of each screen task):** `docs/superpowers/research/front-rewrite/18e-briefs/01-session-creation.md` … `12-landing.md` (committed by Task 0.1). A brief holds the parity table (one row per action of the old front), the composition, the adapters, the realtime landing points, the mockup elements not rendered, the browser-test contract and the risks of its group. Also `notes-for-18e.md` (component interfaces as built in 18b+18c) in the same research folder.

**Owner decisions:** `docs/superpowers/research/front-rewrite/18e-owner-decisions.md`. The plan is written for the default of each decision. Four items block (see "Gates").

**Not in this plan:** ⌘K search, bell wiring, magic link, e-mail code, e-mails, global shortcuts (18f); `knip` clean-up, removal of unused dependencies, the three greps over the whole tree (18g); any mockup element listed in spec §10 or in the "not rendered" section of a brief.

## Branch and run

- Precondition: plan 18d is committed. `git status --short` on `plan-18d-branding` is empty (today `resources/js/app.tsx`, `pages/settings/profile.tsx`, the four `lang/*.json` and others are modified and uncommitted; this plan starts after that commit).
- Branch `plan-18e-screens` from the head of `plan-18d-branding`. No merge into `main`, no push.
- Step A runs on `plan-18e-screens` with a single writer. Step B lanes run in separate git worktrees on branches `plan-18e-<lane>`, cut from the head of Step A; the controller merges one lane at a time into `plan-18e-screens` and runs the gates after each merge.

## Gates

| Gate | Condition | Stops |
|---|---|---|
| G-spec-housekeeping | Owner approves amendment A4–A9 (BLOCK-4) | Task 0.2 and everything after |
| G-spec-phases | Owner approves amendment A1 (BLOCK-1) | R10, R11, the `SurveyPhases` constant of S1 |
| G-spec-roti | Owner approves amendment A2 (BLOCK-2) | R11 |
| G-landing | Owner answers 12-D1 (BLOCK-3) | 12.1 |
| G-visual-<group> | Human visual review of the group's captures against the mockups | merge of the next group on the same lane; the phase report |

**R10 and R11 do not start before the amended spec is approved and committed.** If the approval is late, Step A stops after R9; Step B lanes that do not depend on R10 to R13 (3, 4, 6 except G6, 7, 9, 10, 11) may start from the head of R9 only if the controller accepts rebasing them later. The default is to wait.

## Global Constraints

Rules of spec §5, verbatim. They are acceptance criteria for every commit.

1. **Tokens only.** No hex, rgb, `white`, `black` or default Tailwind palette class. Text on a solid colour uses its `*-foreground`. A text token is used only on the backgrounds named in its `tokens.json` note.
2. **rem everywhere.** px only for strokes ≤ 2px and the pill radius.
3. **Tailwind first.** A value in the scale uses its class. A value outside the scale is added to `@theme` in `app.css`. No arbitrary `[…]` value for a size. Arbitrary values are allowed for grid templates and `color-mix` only.
4. **No overflow.** Every component fits a container from 20rem to 60rem. Cards and rows adapt to their container (`@container/card`, `@container/action`). Card grids use `auto-fit`/`auto-fill` with `minmax`. Labels of selects, menu items, buttons and tabs never wrap (`truncate`).
5. **Visible focus**: `outline-2 outline-ring outline-offset-2`, never removed.
6. **Contrast**: AAA body text, AA secondary text, 3:1 controls. Destructive always has an icon and a label.
7. **Alignment**: a leading element aligns on the first line of the title.
8. **Motion**: `sections/02-motion.md`; `prefers-reduced-motion` respected everywhere.
9. **Icons**: lucide-react only, per `sections/03-iconographie.md`. Emoji only as a feature.
10. **i18n**: no fixed width on a label. The literal call shape `t('…')` is kept, because `TranslationKeysTest` scans for it.
11. **Presentational components**: typed props, no network, no Echo, no Inertia router or page-prop access. Those live in hooks and containers. Two exceptions: `useTrans()` for labels and Inertia's `<Link>` for navigation.
12. The values in `docs/design-system/app.css` are not modified. Additions to `@theme` are allowed for sizes missing from the scale.

Two documented exceptions to rule 1, both canvas data and not theme: the drawing ink of Draw & Guess (`lib/games/drawing.ts`, six server colours, pixel-tested) and the always-white paper of the whiteboard template preview (a named `@theme` token, decision 1-D5).

Contract and process:

- **The browser suite is a contract.** `data-test`, `data-realtime`, `data-presence-id`, element ids and English accessible names are preserved. A browser test changes only when a mockup (or the README of a design-system component) imposes another label or structure, in the commit of that screen, and only if this plan lists it under the task's "Browser tests changed". An agent that finds an unlisted failing test stops and reports; it does not edit the test.
- **No test is deleted** without the owner's approval. `tests/Browser/Support/InteractsWithBrowser.php` (`signIn`, `joinAsGuest`, `awaitRealtime`, `dragWithKeyboard`) is not edited by any task.
- **Exactly one `[data-realtime]` element per page** (`awaitRealtime` reads the first). It is emitted by `SessionShell` on live pages and by the page root on `action-items/index`. `ConnectionState` is never given its `realtime` prop.
- **Languages:** every new key in `lang/en.json`, `fr.json`, `es.json`, `de.json`, in the commit that uses it. Key = English text.
- **Back end:** only spec §9. Primary and foreign keys are UUIDs; migrations have an `up` method only; Form Requests with array rules; early returns, no `else`; Pint (`vendor/bin/pint --dirty --format agent`) and Rector clean; the Arch suite stays green.
- **No new dependency**, PHP or JS.
- **Old files of a screen are deleted in that screen's commit**, except the files listed in "Files shared between groups", which Task F1 deletes.
- **Agents never `checkout`, `restore` or `stash`** a file that holds another agent's uncommitted work, and never touch a file outside their task's list without reporting.
- **No merge to `main`, no push.**

Commands:

| What | Command |
|---|---|
| PHP tests (all) | `vendor/bin/sail artisan test --parallel --processes=8 --compact` |
| PHP tests (one file) | `vendor/bin/sail artisan test --compact tests/Feature/<path>` |
| Front build (before any browser run) | `npm run build:front` |
| Lint and format | `npm run check` |
| Types | `npm run types:check` |
| Vitest (all / one file) | `npm run test` / `npm run test -- resources/js/<path>` |
| Browser suite | `bin/test-browser` |
| One browser file | `BROWSER_REVERB_PORT=8098 DB_HOST=127.0.0.1 DB_DATABASE=testing_plan18a php -d memory_limit=2G vendor/bin/pest <path>` |

npm runs on the host; PHP tests run through Sail. Never `--tia`. Never port 8097. Two lanes that run browser files at the same time use different `BROWSER_REVERB_PORT` values (8098, 8099, 8100…) and different databases.

## Screen task procedure

Every screen task (all tasks of Step A after Task 0, and all tasks of Step B) follows these steps. The task text gives the specifics.

- [ ] **Step 1: Read.** The brief section named by the task (parity rows, composition, adapters, tests), the mockup README and `preview.html`, the old page and components about to be deleted, and the source of each `skrum/` component used (props are in the source, not in the README).
- [ ] **Step 2: Failing tests first.** Write the Vitest files named by the task (adapters, container logic) and the new browser tests; run them and see them fail for the expected reason.
- [ ] **Step 3: Build** the containers and the thin page; the page renders its layout (see Task 0.2) and is added to `ownLayoutPages` in `resources/js/lib/page-layouts.ts`.
- [ ] **Step 4: Parity check.** Walk the brief's parity table row by row against the running page; every row has its control. Copy the table, with a "done" column, into `docs/superpowers/research/front-rewrite/18e-report/<group>.md` (the phase report is assembled from these files).
- [ ] **Step 5: Edit the browser tests listed** under "Browser tests changed", and no other.
- [ ] **Step 6: Bench and captures.** Add `resources/js/pages/dev/sections/<name>.tsx` for composed surfaces and a visual test `tests/Browser/Visual/<Group>VisualTest.php` on the pattern of `AdminPagesVisualTest.php` (`captureVisuals`, light and dark, 390 and 1440, EN and FR, overflow check). Screenshots go to `tests/visual/__screenshots__/`.
- [ ] **Step 7: Delete** the old files the task lists; `grep -rn "<file stem>" resources/js` must find no importer.
- [ ] **Step 8: Run** `npm run check`, `npm run types:check`, `npm run test`, the feature tests the task names, `npm run build:front`, then each browser file the task names with the single-file command. Rule greps on the files of the commit: `grep -nE "bg-(red|blue|gray|zinc|neutral|slate|amber|emerald)-|text-white|text-black|-\[[0-9.]+(px|rem)\]|#[0-9a-fA-F]{3,8}\b"` finds nothing (except the two documented exceptions).
- [ ] **Step 9: Commit** with the task's message and the attribution lines of the session.

At the end of each group: the controller runs `bin/test-browser` and the PHP suite, then shows the group's captures next to the mockups for the human visual review (gate G-visual). Review fixes are one more commit, `fix(<scope>): visual review of <group>`.

## Review Focus

Failure modes the spec implies and that are most likely to reach a user. Each is pinned by a test in the task named.

1. **A retro that is open in `discussing`, or already has ROTI votes, when B1 and B2 are deployed** — it moves forward through Actions and ROTI, keeps its votes, and nobody loses the ability to tick an action item. Pinned in R10 and R11 (feature tests named there).
2. **A live page whose session expires or whose socket drops while two people are on it** — the content is inert, one `[data-realtime]` exists, the state returns to `connected` without a reload, nothing overlaps the reaction bar. Pinned in Task 0.3 (Vitest) and by `assertCount('[data-realtime]', 1)` in the new browser test of R3, 3.1a, G3 and 7.2.
3. **A JSON client that meets an error after B15** (`retroRequest` reading 401, 403, 404, 410; the MCP server), **and a 500 while the database is down** — JSON answers are unchanged; the error page renders without shared props. Pinned in 11.7 (feature tests).
4. **Long content at 390 px in French or German**: a 120-character title, nine phases, a timer, twelve people in the session header; a 7-column table; FR labels 30% longer — no horizontal scroll, every control reachable. Pinned in Task 0.14 (bench capture with overflow check) and each group's visual test.
5. **A user with no workspace, or a member of a workspace with no team, on the new `AppLayout`** — the sidebar renders, "Create a workspace" is reachable. Pinned in 9a (`[P18e-09-03]`) and 4.1 (`[P18e-04-07]`).

## Dependency graph

```
Task 0 (0.1 → 0.14)                                   single writer
  └─ Group 1 (1.1 → 1.3)
       └─ Group 2 (R1 → R8, R8b, R9, [gate] R10, R11, R12, R13)
            │
            ├─ Lane S   Group 8 surveys (S1 → S2)          needs R13
            │             └─ G6 (icebreaker stage)          needs S2 and G5
            ├─ Lane P   Group 3 poker (3.1a → 3.1b → 3.1c → 3.2 → 3.3)
            ├─ Lane T   Group 4 team (4.1 → 4.2)            needs Group 1
            │             └─ Group 5 action items (5.2 → 5.3)   needs R12 and 4.1
            ├─ Lane G   Group 6 games (G1, G2, G3 → G4 → G5) → G6 on lane S
            ├─ Lane W   Group 7 whiteboard (7.1 → 7.2 → 7.3 → 7.4)
            ├─ Lane K   Group 9 workspace (9a → 9b → 9c)    needs R1
            ├─ Lane A   Group 11 access (11.1 → 11.2 → 11.3 → 11.4 → 11.5, 11.7)
            │             └─ Lane X  Group 10 settings (10.1 … 10.8)   10.2 needs 11.1; needs 18d committed
            └─ Lane L   Group 12 landing (12.1)             needs gate G-landing
                 │
                 └─ F1 shared deletions → F2 full gates → F3 phase report
```

Parallel: lanes P, T, G, W, K, A, L and S may run at the same time in separate worktrees. Sequential inside a lane. Sequential across lanes: 5 after 4.1 (same test file `Plan09bActionItemsAdditionsTest.php`), 10.2 after 11.1 (`PasswordField`), G6 after S2 (both edit the retro board mounts), F1 after every lane.

## Files shared between groups

| File | Touched by | Rule |
|---|---|---|
| `lang/{en,fr,es,de}.json` | every task | add keys only; on a lane merge, take the union; `TranslationKeysTest` decides |
| `resources/js/lib/page-layouts.ts` | every screen task | one added line per page; union on merge |
| `resources/js/app.tsx` | 0.2, F1 | no other task edits it |
| `resources/css/app.css` | 1.3 (preview paper token), 7.2 and 7.4 (Excalidraw block, lines 477–546), any task adding a `@theme` size | additions only, outside the Excalidraw block except lane W |
| `resources/js/components/session/*` | written in Task 0; read by groups 2, 3, 6, 7 | a fix goes in its own commit `fix(session): …` on `plan-18e-screens`, then lanes rebase |
| `resources/js/components/skrum/*` | fixes: 0.10, 0.11, 0.12, 0.13 (leaderboard, form dialog, share dialog, gif picker), 1.2 (`deck-picker`), R1 (colour unions), R4 (`retro-card` label), R8b (`action-item` label), S1 (`survey-question`), 9c (`template-editor` string) | a group that needs a fix in a component it does not own reports it; no silent edit |
| `resources/js/components/teams/saved-decks-dialog.tsx`, `whiteboard-templates-dialog.tsx`, `whiteboard-template-preview.tsx` | Group 1 only (briefs 03 and 04 also claimed them) | groups 3 and 4 mount them and do not edit them |
| `resources/js/pages/teams/show.tsx`, `components/teams/poker-games-section.tsx`, `whiteboards-section.tsx` | 1.1–1.3 (import swaps), then 4.1 (rewrite, deletion) | sequential, 1 before 4 |
| `resources/js/lib/poker/deck-payload.ts` | created in 1.2, read by 3.1b | 3.1b deletes `components/poker/deck-fields.tsx` |
| `resources/js/components/action-items/item-*.tsx`, `use-action-item-mutations.ts`, `action-item-adapters.ts` | created in R8b; read by R9, R10, R12, 5.2 | 5.2 deletes the 12 old `components/action-items/*` files |
| `resources/js/components/retro/board-context.tsx`, `comment-thread.tsx`, `reaction-chips.tsx`, `emoji-picker.tsx` | kept or rewritten in place by group 2 with the same exports; read by S1, G4 | exports do not change |
| `resources/js/components/retro/board.tsx` (mount lines) | R3 to R13, then S1, then G6 | sequential |
| `resources/js/components/retro/icebreaker-stage.tsx`, `icebreaker-game.tsx` | R6 mounts them unchanged; G6 replaces and deletes them | sequential |
| `resources/js/components/gifs/gif-search-dialog.tsx` | rewritten in place in 0.13; read by R4 and G5 | no other edit |
| `resources/js/components/games/drawing-canvas.tsx`, `clue-row.tsx`, `gif-tile.tsx`, `room-context.tsx` | rewritten in place by G4/G5; read by R12 (retro results) | exports do not change |
| `resources/js/components/integrations/share/{delivery-lines,post-link-section}.tsx`, `lib/integrations.ts` | read by R3, R12, 3.1b, G3; restyled by 10.5 only | 10.5 keeps exports and accessible names |
| `tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php` | 4.1 (the sidebar lines of `P09b-02a`), 5.2 (the rest) | sequential |
| `tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php` | 1.1 (dialog), R1 (colour names), 9c (templates page) | sequential by construction (Step A, then lane K) |
| `tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php`, `Plan10bPokerAdditionsTest.php` | 1.2 (new-game dialog, saved decks), then lane P | sequential by construction |
| `tests/Browser/Walkthroughs/Plan13*`, `Plan07BoardEngagementTest.php` | 0.13 (GIF names), then R4 / lane G | sequential by construction |
| `tests/Browser/Walkthroughs/Plan17*`, `Support/InteractsWithWhiteboards.php` | 1.3 (creation dialog), then lane W | sequential by construction |
| Deleted only in F1 | `components/retro/{connection-banner,session-expired-banner,presence-strip,timer-display,live-cursor-layer}.tsx`, `components/realtime/flying-reactions.tsx`, `components/retro/{ai-summary-switch,icebreaker-game-select}.tsx`, `components/templates/template-chips.tsx`, `components/confirm-form-dialog.tsx`, `components/workspace-switcher.tsx`, `components/password-input.tsx`, `components/heading.tsx`, `components/input-error.tsx`, `layouts/app-layout.tsx`, `layouts/app/*`, `layouts/auth-layout.tsx`, `layouts/auth/*`, `layouts/settings/layout.tsx`, old `components/app-sidebar.tsx` and its starter helpers | F1 deletes each one only when `grep` finds no importer |

## Where the briefs disagree

Each line was checked in the code where it could be. The plan's ruling is in the last column; the owner can overrule the ones that are also decisions.

| # | Subject | Brief says | Other brief or notes say | Code | Ruling of this plan |
|---|---|---|---|---|---|
| K1 | How a page gets its layout | 04, 10: the page or shell wraps itself, `app.tsx` returns `null` | 06 (games index): `Page.layout = { active, breadcrumbs }`; 11: wire the new `AuthLayout` in `app.tsx`; 05: "default branch, nothing to change"; 09: not settled | `app.tsx:74-75`: the default branch is the OLD layout, so 05 is wrong; 18d pages wrap themselves | Pages render their layout (Task 0.2, decision X1, amendment A5) |
| K2 | Owner of the four join pages and `session-ended` | 02, 03, 06, 07: each group its join page; 02: also `session-ended` | 11: all five in its commit 6, "others must not touch"; notes: `session-ended` = retro | spec §7 lists each join page with its session type | Shared `GuestJoinPage` in 0.7; pages in R2, 3.2, G2, 7.1; `session-ended` in R2; brief 11's commit 6 is dissolved |
| K3 | Layout of a join page | 07: no layout at all | 02, 06: `AuthLayout`; 11: centred `AuthLayout` | `AuthFrame` has no centred variant | Centred variant (0.7) |
| K4 | Game guest nickname | 06: `initialName` (prefilled; a test reads the value) | 11: `defaultName` (placeholder) plus a random-name button, 2 test edits | `guest-join.tsx`: both props exist | Prefilled (6-D9) |
| K5 | Poker spectator control | 03: checkbox `#spectator` | 11: `Switch#spectator` | today a checkbox | Checkbox (3-D10) |
| K6 | Saved decks dialog | 01 (C2) and 03 (3.4): `DeckPicker`, new labels | 04 (commit 3): "DeckPicker is NOT usable here", hand-made list keeping "New deck", "Edit deck", "Delete deck" | three briefs own one file | Group 1 owns it, on `DeckPicker` (1-D7); 3.4 and brief 04's commit 3 are dropped |
| K7 | Whiteboard templates manager, delete confirmation | 01: `ConfirmDialog` | 04: inline confirm in `div.bg-muted`, name in a `<p>` (test selectors) | no mockup | Inline, as the tests bind (1-D8); group 1 owns the file |
| K8 | Deck payload helpers and custom-deck ids | 01: keep them in `deck-fields.tsx`; ids `deck-new-*` | 03: move to `lib/poker/deck-payload.ts`; ids `deck-custom-*` | — | Moved in 1.2; one prefix `deck-custom` (1-D6) |
| K9 | "New room" dialog of `games/index` | 01 (C4): rewrites `components/games/new-room-dialog.tsx` in place | 06 (G1): deletes that file, `GamesLeaderboard` embeds the dialog | spec §7 row 1 names the dialogs of `teams/show` only | G1 owns it; brief 01's C4 is dropped (group 1 has three commits) |
| K10 | Icebreaker stage in the retro | 02 (R6): rewrites `icebreaker-game.tsx` in place, deletes `icebreaker-stage.tsx` | 06 (G6): new `components/games/icebreaker-stage.tsx`, deletes both retro files | — | R6 mounts the old stage unchanged in the new shell; G6 rewrites and deletes |
| K11 | "Reconnecting…" | 02, 03, 06: banner | 07: pill, never `offline` | banner text adds "Your cards are kept locally…" (`connection-state.tsx`) | Pill (X3) |
| K12 | "Time's up!" inside `[role="timer"]` | 07: test changes | 02, 03: list `[role="timer"]` as preserved | `Plan04RetroCoreTest.php:419` and `Plan10bPokerAdditionsTest.php:833` assert that text; the new Timer shows `0:00` | Five assertions change to the accessible name (X4) |
| K13 | Timer durations | 02, 07: 1/3/5/10 | 03: 30 s, 1, 2, 3 min, custom; 06: 1/2/3/5/10; spec ruling 19: 1/3/5/10 | — | Per screen as today (X5, amendment A6) |
| K14 | Emoji picker behind the reaction bar | 02, 07: "`skrum/ReactionPicker` (frimousse)" | notes: frimousse picker slots | `skrum/reaction-picker.tsx` is a fixed grid, not frimousse; tests click "More emoji…" and `button[frimousse-emoji]`, which come from `retro/emoji-picker.tsx` | The `picker` slot takes the existing `EmojiPicker` (0.6) |
| K15 | Owner of the reaction engine and of `beep()` | 03: group 2; 02: a hook in `components/retro/` | 07: whoever lands first; notes: preparation | `realtime/flying-reactions.tsx` couples engine and toolbar | Task 0.5 and 0.6, in `components/session/` |
| K16 | `data-realtime` | 02 (row 24): `ConnectionState realtime` prop | 07: never pass it | `connection-state.tsx:186-189` renders a second hidden element when connected | Emitted by `SessionShell` only |
| K17 | Presence avatars shown | — | 07: new stack shows 5, old strip 8 | `presence-stack.tsx:160` `max = 5`; `presence-strip.tsx:10` `Visible = 8` | `SessionPresence` passes 8 (3 on phones) |
| K18 | Shared action-item containers | 02: its own files under `components/retro/` | 05 (5.1): shared files under `components/action-items/` | old files of that folder are imported by retro and by the page | One set, written in R8b before R9, under new file names |
| K19 | Surveys in `actions` and `roti` | 02: extend the guard to both | 08 and notes: unchanged | `SurveyGuard.php:17` | Unchanged (amendment A1, BLOCK-1) |
| K20 | B10 before session creation and templates | 02: R1 must land before groups 1 and 9 | this plan's order puts group 1 first; 09: "until B10 lands use six colours" | `columnColorClass` accepts both sets | Group 1 writes no colour literal; R1 follows; group 9 runs after R1 |
| K21 | Sidebar assertions (`P09b-02a`, `P12a`, `P13a`, `P14b`) | 04 and 05: "owned by the layout group" | 10: "none" | the assertion of `P09b-02a` runs on the team page (`:221-223`) | 4.1 edits them (the commit that puts the team page under the new sidebar) |
| K22 | Password field | 10: keeps `components/password-input.tsx` | 11: new `components/auth/password-field.tsx` | — | One component, `PasswordField` (11.1); 10.1 and 10.2 use it; the old file goes in F1 |
| K23 | `teams` page-prop rename | notes: preparation | 10: in its commit 4 | `ApiTokensController.php:42` | 0.9 for `teamGroups`; `filterTeams` stays in 5.2 with the page |
| K24 | Status-sync control | 10 §3.5 row 83: `Switch` | 10 §8 and notes: keep `Checkbox` (tests bind `button[role="checkbox"]`) | — | `Checkbox` inside its `<label>` |
| K25 | `FormDialog` without submit | 07, notes: missing | — | `unavailableMessage` exists but its button is "Close"; `P17c-05b` clicks "Cancel" | New no-submit form state (0.11) |
| K26 | "Add survey" on the board | 02 (row 72): keeps the old board button and passes `onAddSurvey` | 08: popover only | — | R3 to R13 keep the old button; S1 removes it (8-D2) |
| K27 | New test ids | five patterns; 12 reuses `P12` | — | `P12a`–`P12d` exist | `[P18e-<gg>-<nn>]` (X8) |

---

# Step A — sequential, single writer

## Task 0: Preparation

Fourteen commits. Nothing in Task 0 changes how an existing page looks, except 0.8 (a landmark name) and 0.13 (the GIF dialog).

### Task 0.1: Research, decisions and amended spec in the repository

**Files:**
- Create: `docs/superpowers/research/front-rewrite/18e-briefs/` (the twelve briefs, `TEMPLATE.md`, `_controller-notes.md`, same names)
- Create: `docs/superpowers/research/front-rewrite/18e-owner-decisions.md`
- Create: `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md` (this file)
- Modify: `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` (sections of `18e-spec-amendment.md` the owner approved)

- [ ] **Step 1:** `git status --short` is empty and `git log -1` is the last commit of plan 18d. Otherwise stop.
- [ ] **Step 2:** `git switch -c plan-18e-screens`.
- [ ] **Step 3:** Copy the files. Fold the approved amendment sections into the spec at the places they name; record in the spec header "Amended 2026-10-16 for plan 18e (A1–A9)" and list the sections still pending, if any.
- [ ] **Step 4:** Commit: `docs(front-rewrite): briefs, owner decisions and spec amendment for plan 18e`.

### Task 0.2: Pages render their own layout

**Files:**
- Create: `resources/js/lib/page-layouts.ts`
- Create: `resources/js/lib/page-layouts.test.ts`
- Modify: `resources/js/app.tsx:48-77`

**Interfaces:**
- Produces: `usesOwnLayout(name: string): boolean`, `ownLayoutPages`. Every screen task appends its page name to `ownLayoutPages` and renders `AppLayout` (`@/layouts/skrum/app-layout`, props `{ active?: NavKey; breadcrumbs?: BreadcrumbItem[] }`), `SettingsLayout`, `AuthLayout` or `SessionShell` itself. Model: `resources/js/components/admin/admin-shell.tsx`.

- [ ] **Step 1: Write the failing test**

```ts
// resources/js/lib/page-layouts.test.ts
import { describe, expect, it } from 'vitest';
import { ownLayoutPages, usesOwnLayout } from '@/lib/page-layouts';

const pageFiles = Object.keys(import.meta.glob('../pages/**/*.tsx')).map(
    (path) => path.slice('../pages/'.length, -'.tsx'.length),
);

describe('page layouts', () => {
    it('lets the rewritten pages render their own layout', () => {
        for (const name of [
            'welcome',
            'about',
            'admin/branding',
            'admin/admins',
            'dev/design-system',
            'retros/show',
            'poker/show',
            'games/show',
            'whiteboards/show',
        ]) {
            expect(usesOwnLayout(name), name).toBe(true);
        }
    });

    it('leaves a page that is not listed to the old layouts', () => {
        expect(usesOwnLayout('not/a-page')).toBe(false);
    });

    it('lists only pages that exist', () => {
        for (const name of ownLayoutPages) {
            expect(pageFiles, name).toContain(name);
        }
    });
});
```

- [ ] **Step 2: Run** `npm run test -- resources/js/lib/page-layouts.test.ts`. Expected: FAIL, module `@/lib/page-layouts` not found.

- [ ] **Step 3: Implement**

```ts
// resources/js/lib/page-layouts.ts
/**
 * Pages of the new front end render their own layout (AppLayout, a shell, or
 * none). A screen commit of plan 18e adds its page here; Task F1 removes the
 * list once every page is on it.
 */
export const ownLayoutPages: readonly string[] = [
    'welcome',
    'about',
    'admin/branding',
    'admin/admins',
    'retros/show',
    'poker/show',
    'games/show',
    'whiteboards/show',
];

const ownLayoutPrefixes: readonly string[] = ['dev/'];

export function usesOwnLayout(name: string): boolean {
    return (
        ownLayoutPages.includes(name) ||
        ownLayoutPrefixes.some((prefix) => name.startsWith(prefix))
    );
}
```

In `resources/js/app.tsx`, the `layout` callback becomes:

```ts
    layout: (name) => {
        if (usesOwnLayout(name)) {
            return null;
        }

        switch (true) {
            case name === 'retros/join':
            case name === 'retros/session-ended':
            case name === 'poker/join':
            case name === 'games/join':
            case name === 'whiteboards/join':
                return AuthLayout;
            case name.startsWith('auth/'):
                return AuthLayout;
            case name.startsWith('invitations/'):
                return AuthLayout;
            case name.startsWith('settings/'):
                return [AppLayout, SettingsLayout];
            default:
                return AppLayout;
        }
    },
```

with `import { usesOwnLayout } from '@/lib/page-layouts';`. The three old layout imports stay until F1.

- [ ] **Step 4: Run** the test (PASS), `npm run types:check`, `npm run check`.
- [ ] **Step 5: Commit**: `refactor(front): pages of the new front end render their own layout`.

### Task 0.3: Session shell

**Files:**
- Create: `resources/js/components/session/session-shell.tsx`
- Create: `resources/js/components/session/session-title.tsx`
- Create: `resources/js/components/session/session-shell.test.tsx`

**Interfaces:**
- Consumes: `SessionLayout` (`@/layouts/skrum/session-layout`, props `{ title: ReactNode; phases?; timer?; presence?; actions?; children }`; no sidebar for a guest), `ConnectionState` (`status`, `variant`, `onReload`), `RealtimeState` (`'connecting' | 'connected'` from `@/lib/realtime/realtime-state`).
- Produces (used by R3, 3.1a, G3, 7.2):

```ts
export type SessionConnection = { reconnecting: boolean; expired: boolean };

export type SessionShellProps = {
    /** Left of the header: usually <SessionTitle>. */
    title: ReactNode;
    phases?: ReactNode;
    timer?: ReactNode;
    presence?: ReactNode;
    actions?: ReactNode;
    /** Value of the page's single `data-realtime` attribute. */
    realtime: RealtimeState;
    connection: SessionConnection;
    /** The realtime root; the whiteboard sets `data-scene` on it. */
    rootRef?: Ref<HTMLDivElement>;
    rootProps?: Omit<HTMLAttributes<HTMLDivElement>, 'children'>;
    children: ReactNode;
};

export function SessionShell(props: SessionShellProps): ReactElement;

export type SessionTitleProps = {
    /** Absent or null for a guest: no back link. */
    backHref?: NavHref | null;
    /** Badges after the title (lock, deck, game). */
    badges?: ReactNode;
    children: ReactNode;
};

export function SessionTitle(props: SessionTitleProps): ReactElement;
```

Rules the shell fixes for the four live pages:
- The container of a live page calls its channel hook, then renders `<SessionShell …>`; the header slots are plain JSX built from the hook's state. `app.tsx` assigns no layout (the four `*/show` pages are already in `ownLayoutPages`).
- `SessionFrame` owns the page's only `<main>`. A container never renders another `<main>`; selectors such as `main:has([data-test^="retro-column-"])` and `main [data-slot="badge"]` match inside it.
- The realtime root is the one `[data-realtime]` of the page.
- Reconnecting is a pill in the header (`role="status"`, text "Reconnecting…"). An expired session is a banner (`role="alert"`, "Your session has expired.", button "Reload") above content that is `inert`.
- A page that has ended (deleted, access lost, room full) still renders `SessionShell`, with the title only and an `EmptyState` as children.
- The title is an `<h1>` inside the header. It is not a direct child of `<header>` (the frame wraps the slot): a test that binds `header > h1` changes to `header h1` in the commit of its screen.

- [ ] **Step 1: Write the failing test**

```tsx
// resources/js/components/session/session-shell.test.tsx
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SessionShell } from '@/components/session/session-shell';
import { SessionTitle } from '@/components/session/session-title';
import { renderWithProviders } from '@/test/render';

function renderShell(connection = { reconnecting: false, expired: false }) {
    return renderWithProviders(
        <SessionShell
            title={<SessionTitle backHref="/teams/t1">Sprint 42</SessionTitle>}
            realtime="connected"
            connection={connection}
            rootProps={{ 'data-scene': '3:abc' } as never}
        >
            <p>board</p>
        </SessionShell>,
    );
}

describe('SessionShell', () => {
    it('emits one data-realtime element, inside the single main landmark', () => {
        const { container } = renderShell();
        const roots = container.querySelectorAll('[data-realtime]');

        expect(roots).toHaveLength(1);
        expect(roots[0].getAttribute('data-realtime')).toBe('connected');
        expect(roots[0].getAttribute('data-scene')).toBe('3:abc');
        expect(screen.getAllByRole('main')).toHaveLength(1);
        expect(screen.getByRole('main').contains(roots[0])).toBe(true);
    });

    it('shows a status pill while reconnecting and keeps one data-realtime', () => {
        const { container } = renderShell({ reconnecting: true, expired: false });

        expect(screen.getByRole('status').textContent).toContain('Reconnecting…');
        expect(container.querySelectorAll('[data-realtime]')).toHaveLength(1);
        expect(screen.queryByText(/kept locally/)).toBeNull();
    });

    it('shows the expired alert with Reload and makes the content inert', () => {
        renderShell({ reconnecting: true, expired: true });

        const alert = screen.getByRole('alert');

        expect(alert.textContent).toContain('Your session has expired.');
        expect(screen.getByRole('button', { name: 'Reload' })).toBeTruthy();
        expect(screen.getByText('board').closest('[inert]')).not.toBeNull();
        expect(screen.queryByRole('status')).toBeNull();
    });
});

describe('SessionTitle', () => {
    it('renders the title as the page heading and a named back link', () => {
        renderShell();

        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Sprint 42');
        expect(
            screen.getByRole('link', { name: 'Back to the team' }).getAttribute('href'),
        ).toBe('/teams/t1');
    });

    it('has no back link for a guest', () => {
        renderWithProviders(<SessionTitle>Sprint 42</SessionTitle>);

        expect(screen.queryByRole('link')).toBeNull();
    });
});
```

- [ ] **Step 2: Run** `npm run test -- resources/js/components/session/session-shell.test.tsx`. Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

```tsx
// resources/js/components/session/session-shell.tsx
import type { HTMLAttributes, ReactNode, Ref } from 'react';
import { ConnectionState } from '@/components/skrum/connection-state';
import SessionLayout from '@/layouts/skrum/session-layout';
import type { RealtimeState } from '@/lib/realtime/realtime-state';
import { cn } from '@/lib/utils';

export type SessionConnection = { reconnecting: boolean; expired: boolean };

export type SessionShellProps = {
    title: ReactNode;
    phases?: ReactNode;
    timer?: ReactNode;
    presence?: ReactNode;
    actions?: ReactNode;
    realtime: RealtimeState;
    connection: SessionConnection;
    rootRef?: Ref<HTMLDivElement>;
    rootProps?: Omit<HTMLAttributes<HTMLDivElement>, 'children'>;
    children: ReactNode;
};

export function SessionShell({
    title,
    phases,
    timer,
    presence,
    actions,
    realtime,
    connection,
    rootRef,
    rootProps,
    children,
}: SessionShellProps) {
    const { className, ...root } = rootProps ?? {};
    const isReconnecting = connection.reconnecting && !connection.expired;

    return (
        <SessionLayout
            title={title}
            phases={phases}
            timer={timer}
            presence={presence}
            actions={
                <>
                    {isReconnecting && (
                        <ConnectionState status="reconnecting" variant="pill" />
                    )}
                    {actions}
                </>
            }
        >
            <div
                {...root}
                ref={rootRef}
                data-slot="session-root"
                data-realtime={realtime}
                className={cn('flex h-full min-h-0 flex-col', className)}
            >
                {connection.expired && (
                    <ConnectionState
                        status="expired"
                        variant="banner"
                        onReload={() => window.location.reload()}
                        className="m-2"
                    />
                )}
                <div
                    inert={connection.expired}
                    className="relative min-h-0 flex-1"
                >
                    {children}
                </div>
            </div>
        </SessionLayout>
    );
}
```

```tsx
// resources/js/components/session/session-title.tsx
import { Link } from '@inertiajs/react';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import type { NavHref } from '@/components/skrum/app-sidebar';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';

export type SessionTitleProps = {
    backHref?: NavHref | null;
    badges?: ReactNode;
    children: ReactNode;
};

export function SessionTitle({ backHref, badges, children }: SessionTitleProps) {
    const { t } = useTrans();

    return (
        <span className="flex min-w-0 items-center gap-2">
            {backHref && (
                <Button asChild variant="ghost" size="icon-sm">
                    <Link href={backHref} aria-label={t('Back to the team')}>
                        <ArrowLeft aria-hidden />
                    </Link>
                </Button>
            )}
            <h1 className="min-w-0 truncate text-base font-semibold">
                {children}
            </h1>
            {badges}
        </span>
    );
}
```

- [ ] **Step 4: Run** the test (PASS), `npm run types:check`, `npm run check`.
- [ ] **Step 5: Commit**: `feat(session): session shell with the single realtime root and the connection states`.

### Task 0.4: Presence and live cursors

**Files:**
- Create: `resources/js/components/session/session-presence.tsx`, `session-presence.test.tsx`
- Create: `resources/js/components/session/cursor-preference.tsx`, `cursor-preference.test.tsx`
- Move: `resources/js/components/realtime/live-cursors.tsx` → `resources/js/components/session/live-cursors.tsx` (`git mv`, content unchanged)
- Modify (import path only): `resources/js/components/retro/live-cursor-layer.tsx:1,6`, `resources/js/components/poker/game-cursors.tsx`

**Interfaces:**
- Consumes: `PresenceMember { id; name; avatarUrl; isGuest }` (`lib/retro/types.ts:340`), `PresenceStack` / `Participant` (`skrum/presence-stack.tsx`; it emits `data-presence-id` on the visible avatars and names its group ":count online"), `useLocalPreference(key, initial)`, `useIsMobile()`.
- Produces:

```ts
// session-presence.tsx
export function toParticipants(
    online: PresenceMember[],
    selfId: string | null,
    facilitatorId?: string | null,
    presenceFor?: (member: PresenceMember) => number | undefined,
): Participant[];

export type SessionPresenceProps = {
    online: PresenceMember[];
    selfId: string | null;
    facilitatorId?: string | null;
    /** Presence colour 1..12; the retro, poker and games pass none (spec ruling 7). */
    presenceFor?: (member: PresenceMember) => number | undefined;
    className?: string;
};

/** PresenceStack with the old strip's count: 8 avatars, 3 on a phone. */
export function SessionPresence(props: SessionPresenceProps): ReactElement;

// cursor-preference.tsx
export const HideMyCursorKey = 'skrum.hideMyCursor';
export function useHideMyCursor(): [boolean, (hidden: boolean) => void];
/** Icon button named "Hide my cursor" / "Show my cursor", with aria-pressed. */
export function CursorToggle(props: {
    hidden: boolean;
    onChange: (hidden: boolean) => void;
}): ReactElement;

// live-cursors.tsx (moved, unchanged): the `live-cursors` library layer, `.lc-overlay`
export function LiveCursors(props: {
    presence: WhisperChannel;
    container: HTMLElement | null;
    hidden: boolean;
    selfId: string;
    online: PresenceMember[];
    labelFor: (senderId: string) => string;
}): ReactElement;
```

`retro/live-cursor-layer.tsx` re-exports the key (`export { HideMyCursorKey } from '@/components/session/cursor-preference';`) until F1. `skrum/live-cursor.tsx` is not used by any screen of this plan: the 38 `.lc-overlay` assertions bind the library layer.

- [ ] **Step 1: Write the failing tests**

```tsx
// resources/js/components/session/session-presence.test.tsx
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
    SessionPresence,
    toParticipants,
} from '@/components/session/session-presence';
import { renderWithProviders } from '@/test/render';

const online = [
    { id: 'p1', name: 'Alice Martin', avatarUrl: '/avatars/a.svg', isGuest: false },
    { id: 'p2', name: 'Bob Stone', avatarUrl: '/avatars/b.svg', isGuest: false },
    { id: 'p3', name: 'Visitor', avatarUrl: '/avatars/c.svg', isGuest: true },
];

describe('toParticipants', () => {
    it('maps role, self and status', () => {
        expect(toParticipants(online, 'p2', 'p1')).toEqual([
            { id: 'p1', name: 'Alice Martin', avatarUrl: '/avatars/a.svg', role: 'facilitator', status: 'online', isMe: false, presence: undefined },
            { id: 'p2', name: 'Bob Stone', avatarUrl: '/avatars/b.svg', role: 'member', status: 'online', isMe: true, presence: undefined },
            { id: 'p3', name: 'Visitor', avatarUrl: '/avatars/c.svg', role: 'guest', status: 'online', isMe: false, presence: undefined },
        ]);
    });
});

describe('SessionPresence', () => {
    it('names the group by the number online and tags each avatar for flying reactions', () => {
        const { container } = renderWithProviders(
            <SessionPresence online={online} selfId="p1" />,
        );

        expect(screen.getByRole('group', { name: '3 online' })).toBeTruthy();
        expect(
            container.querySelector('img[data-presence-id="p3"][alt="Visitor"]'),
        ).not.toBeNull();
    });

    it('shows eight avatars before the overflow, as the old strip did', () => {
        const many = Array.from({ length: 10 }, (_, index) => ({
            id: `p${index}`,
            name: `Person ${index}`,
            avatarUrl: `/avatars/${index}.svg`,
            isGuest: false,
        }));
        const { container } = renderWithProviders(
            <SessionPresence online={many} selfId="p0" />,
        );

        expect(container.querySelectorAll('[data-presence-id]')).toHaveLength(8);
    });
});
```

```tsx
// resources/js/components/session/cursor-preference.test.tsx
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CursorToggle, HideMyCursorKey } from '@/components/session/cursor-preference';
import { renderWithProviders } from '@/test/render';

describe('CursorToggle', () => {
    it('keeps the storage key the old boards used', () => {
        expect(HideMyCursorKey).toBe('skrum.hideMyCursor');
    });

    it('is named by what a press does and reports the new value', () => {
        const onChange = vi.fn();

        renderWithProviders(<CursorToggle hidden={false} onChange={onChange} />);

        const button = screen.getByRole('button', { name: 'Hide my cursor' });

        expect(button.getAttribute('aria-pressed')).toBe('false');
        fireEvent.click(button);
        expect(onChange).toHaveBeenCalledWith(true);
    });

    it('reads "Show my cursor" when the cursor is hidden', () => {
        renderWithProviders(<CursorToggle hidden onChange={() => {}} />);

        expect(
            screen.getByRole('button', { name: 'Show my cursor' }).getAttribute('aria-pressed'),
        ).toBe('true');
    });
});
```

- [ ] **Step 2: Run** both files. Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

```tsx
// resources/js/components/session/session-presence.tsx
import { PresenceStack } from '@/components/skrum/presence-stack';
import type { Participant } from '@/components/skrum/presence-stack';
import { useIsMobile } from '@/hooks/use-mobile';
import type { PresenceMember } from '@/lib/retro/types';

const VisibleOnDesktop = 8;
const VisibleOnPhone = 3;

export function toParticipants(
    online: PresenceMember[],
    selfId: string | null,
    facilitatorId?: string | null,
    presenceFor?: (member: PresenceMember) => number | undefined,
): Participant[] {
    return online.map((member) => ({
        id: member.id,
        name: member.name,
        avatarUrl: member.avatarUrl,
        role:
            member.id === facilitatorId
                ? 'facilitator'
                : member.isGuest
                  ? 'guest'
                  : 'member',
        status: 'online',
        isMe: member.id === selfId,
        presence: presenceFor?.(member),
    }));
}

export type SessionPresenceProps = {
    online: PresenceMember[];
    selfId: string | null;
    facilitatorId?: string | null;
    presenceFor?: (member: PresenceMember) => number | undefined;
    className?: string;
};

export function SessionPresence({
    online,
    selfId,
    facilitatorId,
    presenceFor,
    className,
}: SessionPresenceProps) {
    const isMobile = useIsMobile();

    return (
        <PresenceStack
            participants={toParticipants(online, selfId, facilitatorId, presenceFor)}
            max={isMobile ? VisibleOnPhone : VisibleOnDesktop}
            className={className}
        />
    );
}
```

```tsx
// resources/js/components/session/cursor-preference.tsx
import { MousePointer2, MousePointerBan } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocalPreference } from '@/hooks/use-local-preference';
import { useTrans } from '@/hooks/use-trans';

export const HideMyCursorKey = 'skrum.hideMyCursor';

export function useHideMyCursor(): [boolean, (hidden: boolean) => void] {
    return useLocalPreference(HideMyCursorKey, false);
}

export function CursorToggle({
    hidden,
    onChange,
}: {
    hidden: boolean;
    onChange: (hidden: boolean) => void;
}) {
    const { t } = useTrans();

    return (
        <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-pressed={hidden}
            aria-label={hidden ? t('Show my cursor') : t('Hide my cursor')}
            onClick={() => onChange(!hidden)}
        >
            {hidden ? <MousePointerBan aria-hidden /> : <MousePointer2 aria-hidden />}
        </Button>
    );
}
```

Then `git mv resources/js/components/realtime/live-cursors.tsx resources/js/components/session/live-cursors.tsx` and update the two importers.

- [ ] **Step 4: Run** the two test files (PASS), `npm run types:check`, `npm run check`, `npm run build:front`, then `Smoke/RealtimeTest.php` with the single-file command (the old retro and poker boards still draw cursors).
- [ ] **Step 5: Commit**: `feat(session): shared presence stack and live cursor layer`.

### Task 0.5: Session timer, alarm and "Time's up"

**Files:**
- Create: `resources/js/components/session/use-timer-alarm.ts`, `session-timer.tsx`, `session-timer.test.tsx`

**Interfaces:**
- Consumes: `Timer`, `TimerPreset`, `DefaultTimerPresets` (`skrum/timer.tsx`: the pill has `role="timer"`, shows `m:ss`, and at zero shows `0:00` with `data-state="done"` and the accessible name "Time's up!"; the menu trigger is named "Timer"; entries "1 min", "30 s", "Stop timer", "Custom…"), `useCountdown(endsAt, offset)`.
- Produces:

```ts
/** Toast "Time's up!" and a beep, once per end time, only if this client saw the timer running. */
export function useTimerAlarm(endsAt: string | null, remaining: number | null): void;

export type SessionTimerProps = {
    endsAt: string | null;
    /** Server clock offset in milliseconds. */
    offset: number;
    /** Durations of the menu; the Timer default is 1, 3, 5, 10 minutes. */
    presets?: TimerPreset[];
    /** Seconds chosen at start, for the ring; absent for a late joiner. */
    totalSeconds?: number;
    /** Given only to who may start and stop (the facilitator, the host). */
    onStart?: (seconds: number) => void;
    onStop?: () => void;
    onCustom?: () => void;
    /** false in a game room: it shows <TimeUpBadge> instead of a toast. */
    alarm?: boolean;
    className?: string;
};

export function SessionTimer(props: SessionTimerProps): ReactElement | null;

/** Destructive badge "Time's up", rendered by a game inside <main>, next to the stage title. */
export function TimeUpBadge(props: { endsAt: string | null; offset: number }): ReactElement | null;
```

Convention (answers notes R4 and conflict K12):

| Page | Countdown (`[role="timer"]`) | At zero |
|---|---|---|
| retro | header `timer` slot | toast + beep; pill reads `0:00`, named "Time's up!" |
| poker | header `timer` slot | same |
| whiteboard | facilitator: `start` slot of the "Facilitation tools" bar; others: header `timer` slot | same |
| game room | header `timer` slot, `alarm={false}` | `<TimeUpBadge>` inside `<main>` (`main [data-slot="badge"]`), no toast |
| icebreaker in a retro | the retro's header timer (single control) | `<TimeUpBadge>` inside `section[aria-label="Icebreaker game"]` |

Browser tests changed by this convention (the Timer README's "done" state imposes it), each in the commit that puts its page on `SessionTimer`: `assertSeeIn('[role="timer"]', "Time's up!")` becomes `assertAttribute('[role="timer"]', 'aria-label', "Time's up!")` at `Plan04RetroCoreTest.php:419` (R3), `Plan10bPokerAdditionsTest.php:833` (3.1a), `Plan17cWhiteboardFacilitationTest.php:130,133,152` (7.2).

- [ ] **Step 1: Write the failing test**

```tsx
// resources/js/components/session/session-timer.test.tsx
import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { SessionTimer, TimeUpBadge } from '@/components/session/session-timer';
import { renderWithProviders } from '@/test/render';

vi.mock('sonner', () => ({ toast: vi.fn() }));

const start = new Date('2026-10-16T10:00:00Z');
const inTenSeconds = new Date(start.getTime() + 10_000).toISOString();

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(start);
    vi.mocked(toast).mockClear();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('SessionTimer', () => {
    it('renders nothing without a timer and without controls', () => {
        const { container } = renderWithProviders(
            <SessionTimer endsAt={null} offset={0} />,
        );

        expect(container.querySelector('[role="timer"]')).toBeNull();
    });

    it('counts down, then names the pill "Time\'s up!" and toasts once', () => {
        renderWithProviders(<SessionTimer endsAt={inTenSeconds} offset={0} />);

        expect(screen.getByRole('timer').textContent).toContain('0:10');

        act(() => {
            vi.advanceTimersByTime(11_000);
        });

        expect(screen.getByRole('timer').getAttribute('aria-label')).toBe("Time's up!");
        expect(screen.getByRole('timer').getAttribute('data-state')).toBe('done');
        expect(toast).toHaveBeenCalledTimes(1);

        act(() => {
            vi.advanceTimersByTime(5_000);
        });

        expect(toast).toHaveBeenCalledTimes(1);
    });

    it('does not toast for a timer that had already ended when the page opened', () => {
        const past = new Date(start.getTime() - 5_000).toISOString();

        renderWithProviders(<SessionTimer endsAt={past} offset={0} />);

        expect(toast).not.toHaveBeenCalled();
    });

    it('does not toast with alarm off', () => {
        renderWithProviders(
            <SessionTimer endsAt={inTenSeconds} offset={0} alarm={false} />,
        );

        act(() => {
            vi.advanceTimersByTime(11_000);
        });

        expect(toast).not.toHaveBeenCalled();
    });

    it('offers the menu only to who can start or stop', () => {
        renderWithProviders(
            <SessionTimer endsAt={null} offset={0} onStart={() => {}} onStop={() => {}} />,
        );

        expect(screen.getByRole('button', { name: 'Timer' })).toBeTruthy();
    });
});

describe('TimeUpBadge', () => {
    it('shows "Time\'s up" only at zero', () => {
        const { container } = renderWithProviders(
            <TimeUpBadge endsAt={inTenSeconds} offset={0} />,
        );

        expect(container.querySelector('[data-slot="badge"]')).toBeNull();

        act(() => {
            vi.advanceTimersByTime(11_000);
        });

        expect(container.querySelector('[data-slot="badge"]')?.textContent).toBe("Time's up");
    });
});
```

- [ ] **Step 2: Run** `npm run test -- resources/js/components/session/session-timer.test.tsx`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
// resources/js/components/session/use-timer-alarm.ts
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useTrans } from '@/hooks/use-trans';

function beep(): void {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.1, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.6);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.onended = () => void context.close();
    oscillator.stop(context.currentTime + 0.6);
}

export function useTimerAlarm(
    endsAt: string | null,
    remaining: number | null,
): void {
    const { t } = useTrans();
    const announced = useRef<string | null>(null);
    const sawRunning = useRef<string | null>(null);

    useEffect(() => {
        if (endsAt === null) {
            return;
        }

        if (remaining !== null && remaining > 0) {
            sawRunning.current = endsAt;

            return;
        }

        if (
            remaining !== 0 ||
            sawRunning.current !== endsAt ||
            announced.current === endsAt
        ) {
            return;
        }

        announced.current = endsAt;
        toast(t("Time's up!"));

        try {
            beep();
        } catch {
            // Audio can be unavailable or blocked until the user interacts.
        }
    }, [remaining, endsAt, t]);
}
```

```tsx
// resources/js/components/session/session-timer.tsx
import { Timer } from '@/components/skrum/timer';
import type { TimerPreset } from '@/components/skrum/timer';
import { Badge } from '@/components/ui/badge';
import { useCountdown } from '@/hooks/use-countdown';
import { useIsMounted } from '@/hooks/use-is-mounted';
import { useTrans } from '@/hooks/use-trans';
import { useTimerAlarm } from './use-timer-alarm';

export type SessionTimerProps = {
    endsAt: string | null;
    offset: number;
    presets?: TimerPreset[];
    totalSeconds?: number;
    onStart?: (seconds: number) => void;
    onStop?: () => void;
    onCustom?: () => void;
    alarm?: boolean;
    className?: string;
};

export function SessionTimer({
    endsAt,
    offset,
    presets,
    totalSeconds,
    onStart,
    onStop,
    onCustom,
    alarm = true,
    className,
}: SessionTimerProps) {
    const remaining = useCountdown(endsAt, offset);
    const isMounted = useIsMounted();

    useTimerAlarm(alarm ? endsAt : null, remaining);

    return (
        <Timer
            remainingSeconds={isMounted ? remaining : null}
            totalSeconds={totalSeconds}
            presets={presets}
            onStart={onStart}
            onStop={onStop}
            onCustom={onCustom}
            className={className}
        />
    );
}

export function TimeUpBadge({
    endsAt,
    offset,
}: {
    endsAt: string | null;
    offset: number;
}) {
    const { t } = useTrans();
    const remaining = useCountdown(endsAt, offset);

    if (remaining !== 0) {
        return null;
    }

    return <Badge variant="destructive">{t("Time's up")}</Badge>;
}
```

`components/retro/timer-display.tsx` is not edited: old poker and whiteboard keep it until their screens; F1 deletes it.

- [ ] **Step 4: Run** the test (PASS), `npm run types:check`, `npm run check`.
- [ ] **Step 5: Commit**: `feat(session): shared session timer with the end-of-time alarm`.

### Task 0.6: Reaction engine and the session reaction bar

**Files:**
- Create: `resources/js/components/session/use-flying-reactions.ts`, `session-reactions.tsx`, `session-reactions.test.tsx`
- Modify: `resources/js/components/realtime/flying-reactions.tsx` (calls the hook; its toolbar markup is unchanged; re-exports `avatarOrigin` and `centreOrigin`)

**Interfaces:**
- Consumes: `whisperTransport`, `WhisperChannel` (`lib/realtime/whisper-transport.ts`), `useReactions`, `LiveReactions` (`live-reactions/react`; the overlay is `.lr-overlay` and carries the sender name), `tokenBucket`, `isSingleEmoji`, `ReactionBar` (`skrum/reaction-bar.tsx`: toolbar `role="toolbar"` named "Reactions", buttons named "Send a reaction 👍"…, `className` and rest props land on the toolbar element, `picker` slot, `shortcuts`, `variant`, `compact`, `offsetBottom`, `incoming`), `EmojiPicker` (`components/retro/emoji-picker.tsx`, frimousse: trigger named by `label`, menu entry "More emoji…", `button[frimousse-emoji]`).
- Produces:

```ts
// use-flying-reactions.ts
export function centreOrigin(): number;
/** Above the sender's avatar (`[data-presence-id]`), else near the centre. */
export function avatarOrigin(senderId: string): number;

export type FlyingReactionsOptions = {
    presence: WhisperChannel;
    selfId: string;
    online: PresenceMember[];
    originFor: (senderId: string) => number;
};

/** Whisper `client-reaction`: roster check, single-emoji check, 5 burst / 2 per second per sender. */
export function useFlyingReactions(options: FlyingReactionsOptions): {
    reactions: ReturnType<typeof useReactions>['reactions'];
    send: (emoji: string) => void;
};

// session-reactions.tsx
export type SessionReactionsProps = FlyingReactionsOptions & {
    /** Name shown under a flying emoji; null hides it (anonymous retro). */
    labelFor: (senderId: string) => string | null;
    variant?: 'floating' | 'inline';
    compact?: boolean;
    /** Digits 1 to 6; false on the whiteboard, where digits pick Excalidraw tools. */
    shortcuts?: boolean;
    offsetBottom?: number;
    /** Lands on the toolbar: `whiteboard-reactions`, drag isolation handlers. */
    toolbarProps?: HTMLAttributes<HTMLDivElement>;
};

/** Callers mount it only when reactions are allowed and key it by the channel. */
export function SessionReactions(props: SessionReactionsProps): ReactElement;
```

`SessionReactions` renders `<LiveReactions reactions label>` and `<ReactionBar onReact={send} picker={<EmojiPicker label={t('Send a reaction')} onPick={send}>…</EmojiPicker>}>`. It never passes `incoming`: the flight stays in the library overlay, which `Plan07BoardEngagementTest.php:887-918` and `Plan17aWhiteboardCoreTest.php:541-546`, `Plan17cWhiteboardFacilitationTest.php:768-774` read (`.lr-overlay` with the emoji and the sender name).

Until its screen is rewritten, each old board keeps the old toolbar of `realtime/flying-reactions.tsx` over the same engine (decision X7). That file gets no other edit and is deleted in F1.

- [ ] **Step 1: Write the failing test**

```tsx
// resources/js/components/session/session-reactions.test.tsx
import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SessionReactions } from '@/components/session/session-reactions';
import { renderWithProviders } from '@/test/render';

type Listener = (data: unknown, metadata?: { user_id?: string }) => void;

function channel() {
    const listeners = new Map<string, Listener>();

    return {
        whisper: vi.fn(),
        listen: vi.fn((event: string, callback: Listener) => listeners.set(event, callback)),
        stopListening: vi.fn(),
        receive: (senderId: string, data: unknown) =>
            listeners.get('.client-reaction')?.(data, { user_id: senderId }),
    };
}

const online = [
    { id: 'me', name: 'Alice Martin', avatarUrl: '/a.svg', isGuest: false },
    { id: 'bob', name: 'Bob Stone', avatarUrl: '/b.svg', isGuest: false },
];

function renderBar(presence = channel(), toolbarProps = {}) {
    renderWithProviders(
        <SessionReactions
            presence={presence}
            selfId="me"
            online={online}
            labelFor={(id) => online.find((member) => member.id === id)?.name ?? null}
            originFor={() => 0.5}
            toolbarProps={toolbarProps}
        />,
    );

    return presence;
}

describe('SessionReactions', () => {
    it('renders the Reactions toolbar with the six quick emoji and the picker trigger', () => {
        renderBar();

        const toolbar = screen.getByRole('toolbar', { name: 'Reactions' });

        expect(toolbar.querySelectorAll('[aria-label^="Send a reaction "]')).toHaveLength(6);
        expect(screen.getByRole('button', { name: 'Send a reaction' })).toBeTruthy();
    });

    it('puts the toolbar props on the toolbar element', () => {
        renderBar(channel(), { className: 'whiteboard-reactions' });

        expect(
            screen.getByRole('toolbar', { name: 'Reactions' }).classList.contains('whiteboard-reactions'),
        ).toBe(true);
    });

    it('whispers the emoji that is pressed', () => {
        const presence = renderBar();

        fireEvent.click(screen.getByRole('button', { name: 'Send a reaction 🎉' }));

        expect(presence.whisper).toHaveBeenCalledWith(
            'reaction',
            expect.objectContaining({ e: '🎉' }),
        );
    });

    it('flies a reaction of someone in the room in the library overlay, with the name', () => {
        const presence = renderBar();

        act(() => {
            presence.receive('bob', { e: '👏' });
        });

        const overlay = document.querySelector('.lr-overlay');

        expect(overlay?.textContent).toContain('👏');
        expect(overlay?.textContent).toContain('Bob Stone');
        expect(document.querySelector('[data-slot="reaction-fly"]')).toBeNull();
    });

    it('drops a reaction from someone who is not in the room, and a text that is not one emoji', () => {
        const presence = renderBar();

        act(() => {
            presence.receive('stranger', { e: '👏' });
            presence.receive('bob', { e: 'hello' });
        });

        expect(document.querySelector('.lr-overlay')?.textContent ?? '').not.toContain('👏');
        expect(document.querySelector('.lr-overlay')?.textContent ?? '').not.toContain('hello');
    });
});
```

The message shape (`{ e: … }`) and the overlay class are those of `live-reactions`; if the library names differ in `node_modules/live-reactions`, the implementer aligns the assertions with the library and says so in the report, without changing the behaviour under test.

- [ ] **Step 2: Run** `npm run test -- resources/js/components/session/session-reactions.test.tsx`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
// resources/js/components/session/use-flying-reactions.ts
import { tokenBucket, type TokenBucket } from 'live-reactions';
import { useReactions } from 'live-reactions/react';
import { useEffect, useRef, useState } from 'react';
import {
    whisperTransport,
    type WhisperChannel,
} from '@/lib/realtime/whisper-transport';
import { isSingleEmoji } from '@/lib/retro/emoji';
import type { PresenceMember } from '@/lib/retro/types';

const ReceiveLimit = { burst: 5, perSecond: 2 };

export function centreOrigin(): number {
    return 0.4 + Math.random() * 0.2;
}

export function avatarOrigin(senderId: string): number {
    const avatar = document.querySelector(
        `[data-presence-id="${CSS.escape(senderId)}"]`,
    );

    if (!avatar) {
        return centreOrigin();
    }

    const rect = avatar.getBoundingClientRect();
    const origin = (rect.left + rect.width / 2) / window.innerWidth;

    return Math.min(1, Math.max(0, origin));
}

export type FlyingReactionsOptions = {
    presence: WhisperChannel;
    selfId: string;
    online: PresenceMember[];
    originFor: (senderId: string) => number;
};

export function useFlyingReactions({
    presence,
    selfId,
    online,
    originFor,
}: FlyingReactionsOptions) {
    const rosterKey = online.map((member) => member.id).join(',');
    const roster = useRef(new Set<string>());
    const buckets = useRef(new Map<string, TokenBucket>());
    const origin = useRef(originFor);

    origin.current = originFor;

    useEffect(() => {
        roster.current = new Set(rosterKey === '' ? [] : rosterKey.split(','));
    }, [rosterKey]);

    const [transport] = useState(() =>
        whisperTransport(presence, 'reaction', (senderId, raw) => {
            if (!roster.current.has(senderId)) {
                return false;
            }

            if (!isSingleEmoji((raw as { e?: unknown } | null)?.e)) {
                return false;
            }

            let bucket = buckets.current.get(senderId);

            if (!bucket) {
                bucket = tokenBucket(ReceiveLimit);
                buckets.current.set(senderId, bucket);
            }

            return bucket.take();
        }),
    );

    return useReactions({
        transport: () => transport,
        selfId,
        origin: (senderId) => origin.current(senderId),
    });
}
```

```tsx
// resources/js/components/session/session-reactions.tsx
import { LiveReactions } from 'live-reactions/react';
import { SmilePlus } from 'lucide-react';
import type { HTMLAttributes } from 'react';
import { EmojiPicker } from '@/components/retro/emoji-picker';
import { ReactionBar } from '@/components/skrum/reaction-bar';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import {
    useFlyingReactions,
    type FlyingReactionsOptions,
} from './use-flying-reactions';

export type SessionReactionsProps = FlyingReactionsOptions & {
    labelFor: (senderId: string) => string | null;
    variant?: 'floating' | 'inline';
    compact?: boolean;
    shortcuts?: boolean;
    offsetBottom?: number;
    toolbarProps?: HTMLAttributes<HTMLDivElement>;
};

export function SessionReactions({
    labelFor,
    variant = 'floating',
    compact,
    shortcuts = true,
    offsetBottom,
    toolbarProps,
    ...engine
}: SessionReactionsProps) {
    const { t } = useTrans();
    const { reactions, send } = useFlyingReactions(engine);

    return (
        <>
            <LiveReactions
                reactions={reactions}
                label={(reaction) => labelFor(reaction.senderId)}
            />
            <ReactionBar
                {...toolbarProps}
                variant={variant}
                compact={compact}
                shortcuts={shortcuts}
                offsetBottom={offsetBottom}
                onReact={send}
                picker={
                    <EmojiPicker label={t('Send a reaction')} onPick={send}>
                        <Button size="icon-sm" variant="ghost">
                            <SmilePlus aria-hidden />
                        </Button>
                    </EmojiPicker>
                }
            />
        </>
    );
}
```

In `realtime/flying-reactions.tsx`, replace the roster, bucket and transport code (lines 59–96) by `const { reactions, send } = useFlyingReactions({ presence, selfId, online, originFor });` and re-export the two origin helpers from the new module.

- [ ] **Step 4: Run** the test (PASS), `npm run types:check`, `npm run check`, `npm run build:front`, then `Plan07BoardEngagementTest.php` and `Plan17aWhiteboardCoreTest.php` with the single-file command (the old boards still fly reactions).
- [ ] **Step 5: Commit**: `feat(session): reaction engine extracted, session reaction bar on ReactionBar`.

### Task 0.7: Centred auth frame, access notice and the guest-join page

**Files:**
- Modify: `resources/js/components/skrum/frames.tsx:168-223` (`AuthFrame`), `resources/js/components/skrum/frames.test.tsx`
- Modify: `resources/js/layouts/skrum/auth-layout.tsx`, `resources/js/layouts/skrum/auth-layout.test.tsx`
- Create: `resources/js/components/auth/access-notice.tsx`, `access-notice.test.tsx`
- Create: `resources/js/components/session/guest-join-page.tsx`, `guest-join-page.test.tsx`

**Interfaces:**
- Consumes: `GuestJoin` (`skrum/guest-join.tsx`: field `#name`, button "Join", heading "Join as a guest", label "Your nickname", props `session`, `initialName`, `error`, `processing`, `onSubmit(data, formData)`, `children`, `loginUrl`), `login()` from `@/routes`, Inertia `router.post`.
- Produces:

```ts
// frames.tsx — AuthFrame gains one prop
variant?: 'split' | 'centered'; // default 'split'

// layouts/skrum/auth-layout.tsx — same prop, passed through
export default function AuthLayout(props: {
    title?: string;
    description?: string;
    aside?: ReactNode;
    variant?: 'split' | 'centered';
    children: ReactNode;
}): ReactElement;

// components/auth/access-notice.tsx
export type AccessNoticeProps = {
    icon: LucideIcon;
    title: string;
    description: string;
    /** A second, muted line (e.g. "Guests: ask the facilitator for the guest link."). */
    hint?: string;
    tone?: 'default' | 'destructive';
    action?: ReactNode;
};
export function AccessNotice(props: AccessNoticeProps): ReactElement;

// components/session/guest-join-page.tsx
export type GuestJoinPageProps = {
    kind: GuestJoinSessionKind; // 'retro' | 'poker' | 'whiteboard' | 'game'
    /** Title of the page when the link is invalid: "Join a retrospective", … */
    invalidTitle: string;
    /** null: the guest link is no longer valid (the server answered 404). */
    session: { title: string; gameLabel?: string } | null;
    /** URL of the join POST (`RetroJoinsController.store.url(token)`, …). */
    storeUrl: string | null;
    suggestedName?: string | null;
    /** Extra named controls, e.g. the poker `#spectator` checkbox. */
    children?: ReactNode;
    /** Extra fields of the POST body read from the form (`spectator`). */
    extraFields?: string[];
};
export function GuestJoinPage(props: GuestJoinPageProps): ReactElement;
```

`centered`: one column, the header with the logo and `headerEnd`, the content centred with `max-w-120`, the `title` rendered as a visually hidden `<h1>`, no aside. `GuestJoinPage` renders `<AuthLayout variant="centered" title={session?.title ?? invalidTitle}>` and, inside, `GuestJoin` or `<AccessNotice title={invalidTitle} description={t('This guest link is no longer valid.')}>`; it posts `{ name, ...extraFields }` with `router.post(storeUrl, …)`, maps `errors.name` to `error`, and passes `initialName={suggestedName ?? undefined}`.

- [ ] **Step 1: Write the failing tests**

```tsx
// added to resources/js/components/skrum/frames.test.tsx
describe('AuthFrame centred', () => {
    it('has one column, a hidden page heading and no aside', () => {
        const { container } = renderWithProviders(
            <AuthFrame variant="centered" title="Sprint 42 retro">
                <h2>Join as a guest</h2>
            </AuthFrame>,
        );

        const heading = screen.getByRole('heading', { level: 1 });

        expect(heading.textContent).toBe('Sprint 42 retro');
        expect(heading.classList.contains('sr-only')).toBe(true);
        expect(container.querySelector('aside')).toBeNull();
        expect(screen.getByRole('main').textContent).toContain('Join as a guest');
    });
});
```

```tsx
// resources/js/components/auth/access-notice.test.tsx
import { screen } from '@testing-library/react';
import { LinkIcon } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { AccessNotice } from '@/components/auth/access-notice';
import { renderWithProviders } from '@/test/render';

describe('AccessNotice', () => {
    it('shows the title, the text, the hint and the action', () => {
        renderWithProviders(
            <AccessNotice
                icon={LinkIcon}
                title="Join a retrospective"
                description="This guest link is no longer valid."
                hint="Guests: ask the facilitator for the guest link."
                action={<a href="/login">Log in</a>}
            />,
        );

        expect(screen.getByRole('heading', { name: 'Join a retrospective' })).toBeTruthy();
        expect(screen.getByText('This guest link is no longer valid.')).toBeTruthy();
        expect(screen.getByText('Guests: ask the facilitator for the guest link.')).toBeTruthy();
        expect(screen.getByRole('link', { name: 'Log in' })).toBeTruthy();
    });
});
```

```tsx
// resources/js/components/session/guest-join-page.test.tsx
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuestJoinPage } from '@/components/session/guest-join-page';
import { renderWithProviders } from '@/test/render';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
const post = vi.hoisted(() => vi.fn());

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => page,
    router: { post },
}));

beforeEach(() => {
    post.mockClear();
    page.props = {
        translations: {},
        locale: 'en',
        locales: ['en'],
        errors: {},
        brand: { name: 'Skrüm', logoLightUrl: null, logoDarkUrl: null, faviconUrl: null, poweredBy: true },
    };
});

describe('GuestJoinPage', () => {
    it('prefills the nickname and posts it to the join URL', () => {
        renderWithProviders(
            <GuestJoinPage
                kind="retro"
                invalidTitle="Join a retrospective"
                session={{ title: 'Sprint 42 retro' }}
                storeUrl="/join/abc"
                suggestedName="Guest Gia"
            />,
        );

        const field = document.querySelector<HTMLInputElement>('#name');

        expect(field?.value).toBe('Guest Gia');

        fireEvent.click(screen.getByRole('button', { name: 'Join' }));

        expect(post).toHaveBeenCalledWith('/join/abc', { name: 'Guest Gia' }, expect.anything());
    });

    it('sends the extra fields of the form, such as the poker spectator choice', () => {
        renderWithProviders(
            <GuestJoinPage
                kind="poker"
                invalidTitle="Join a planning poker game"
                session={{ title: 'Sprint 12 estimates' }}
                storeUrl="/poker/join/abc"
                suggestedName="Guest Gia"
                extraFields={['spectator']}
            >
                <input type="checkbox" id="spectator" name="spectator" value="1" defaultChecked />
            </GuestJoinPage>,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Join' }));

        expect(post).toHaveBeenCalledWith(
            '/poker/join/abc',
            { name: 'Guest Gia', spectator: '1' },
            expect.anything(),
        );
    });

    it('shows the server error under the nickname', () => {
        page.props = { ...page.props, errors: { name: 'The name field is required.' } };

        renderWithProviders(
            <GuestJoinPage kind="game" invalidTitle="Join a game" session={{ title: 'Warm-up' }} storeUrl="/play/abc" />,
        );

        expect(screen.getByText('The name field is required.')).toBeTruthy();
    });

    it('shows the invalid-link notice and no form when the link is gone', () => {
        renderWithProviders(
            <GuestJoinPage kind="whiteboard" invalidTitle="Join a whiteboard" session={null} storeUrl={null} />,
        );

        expect(screen.getByText('This guest link is no longer valid.')).toBeTruthy();
        expect(document.querySelector('#name')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Join' })).toBeNull();
    });
});
```

- [ ] **Step 2: Run** the three files. Expected: FAIL (unknown prop `variant` has no effect; modules not found).
- [ ] **Step 3: Implement** to the signatures above. `AuthFrame` keeps its split rendering untouched when `variant` is `'split'` (the existing `frames.test.tsx` and `auth-layout.test.tsx` cases stay green). `AccessNotice` is a `Card` with the icon in a soft round mark (`bg-muted`, or `bg-skrum-destructive-soft text-skrum-destructive-text` for `destructive`), an `<h2>` title, the description, the hint in `text-muted-foreground`, then the action.
- [ ] **Step 4: Run** the three files and `layouts/skrum/auth-layout.test.tsx` (PASS), `npm run types:check`, `npm run check`.
- [ ] **Step 5: Commit**: `feat(auth): centred auth frame, access notice and the shared guest-join page`.

### Task 0.8: One "Settings" landmark

**Files:**
- Modify: `resources/js/components/skrum/app-sidebar.tsx:391`
- Modify: `resources/js/components/skrum/app-sidebar.test.tsx:128-146`
- Modify: `tests/Browser/Walkthroughs/Plan18dBrandingTest.php:14`
- Modify: `lang/{en,fr,es,de}.json` (key "Team and administration")

**Browser tests changed:** `Plan18dBrandingTest.php:14` — `P18dSidebarAdminLink` becomes `nav[aria-label="Team and administration"] a[aria-label="Administration"]`. Imposed by: `Sidebar/README.md` names one sidebar landmark, "Navigation"; ScreenUserSettings and ScreenSettings give the name "Settings" to the sub-navigation of the page, which `Plan11bApiTokensTest.php:61,217` binds. Two landmarks with one name make `nav[aria-label="Settings"]` ambiguous for an owner or an admin.

- [ ] **Step 1:** In `app-sidebar.test.tsx`, change the two tests that look for `name: 'Settings'` to `name: 'Team and administration'`, and add:

```tsx
    it('does not name any landmark "Settings", which belongs to the settings sub-navigation', () => {
        renderSidebar({ links: { ...base.links, settings: '/t1/settings', admin: '/admin' } });

        expect(screen.queryByRole('navigation', { name: 'Settings' })).toBeNull();
    });
```

- [ ] **Step 2: Run** `npm run test -- resources/js/components/skrum/app-sidebar.test.tsx`. Expected: FAIL (the landmark is still "Settings").
- [ ] **Step 3:** `app-sidebar.tsx:391`: `<nav aria-label={t('Team and administration')}>`. Add the key to the four lang files (fr "Équipe et administration", es "Equipo y administración", de "Team und Administration"). Edit `Plan18dBrandingTest.php:14`.
- [ ] **Step 4: Run** the Vitest file (PASS), `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php`, `npm run build:front`, then `Plan18dBrandingTest.php` and `Plan11bApiTokensTest.php` with the single-file command.
- [ ] **Step 5: Commit**: `fix(sidebar): the footer navigation no longer shares the name of the settings sub-navigation`.

### Task 0.9: `teams` page prop of the API tokens page renamed `teamGroups` (B16)

**Files:**
- Modify: `app/Http/Controllers/Settings/ApiTokensController.php:42`
- Modify: `tests/Feature/Mcp/ApiTokensTest.php:60-61`
- Modify: `resources/js/pages/settings/api-tokens.tsx:24,38,125`, `resources/js/components/settings/create-token-dialog.tsx:35,48,185`

Why now: a page prop named `teams` overrides the shared `teams` (`HandleInertiaRequests.php:70`) that the new sidebar reads.

- [ ] **Step 1:** In `ApiTokensTest.php`, lines 60-61 become:

```php
            ->has('teamGroups', 1)
            ->where('teamGroups.0.teams.0.name', 'Platform')
            ->where('teams', fn ($teams): bool => collect($teams)->every(fn (array $team): bool => array_keys($team) === ['id', 'name'])));
```

(the last line pins that the shared `teams` keeps its sidebar shape on this page).

- [ ] **Step 2: Run** `vendor/bin/sail artisan test --compact tests/Feature/Mcp/ApiTokensTest.php`. Expected: FAIL, `teamGroups` missing.
- [ ] **Step 3:** Controller: `'teamGroups' => $this->teamsByWorkspace($user),`. Front: the page prop and the dialog prop become `teamGroups` (type `ApiTokenTeamGroup[]` unchanged).
- [ ] **Step 4: Run** the feature test (PASS), `vendor/bin/pint --dirty --format agent`, `npm run types:check`, `npm run build:front`, `Plan11bApiTokensTest.php` with the single-file command.
- [ ] **Step 5: Commit**: `fix(api-tokens): page prop teams renamed teamGroups so the sidebar keeps the shared teams`.

### Task 0.10: Streak badge on the podium

**Files:**
- Modify: `resources/js/components/skrum/games-leaderboard.tsx:616-694` (`PodiumPlace`)
- Modify: `resources/js/components/skrum/games-leaderboard.test.tsx`

Why: the badge ":count-week streak" is rendered from the 4th place only (`:773`); a team of two is always on the podium, and `[P13d-10a]` reads the badge on the first player.

- [ ] **Step 1:** Add to `describe('Leaderboard', …)`:

```tsx
    it('shows the streak of a player on the podium, and none below two weeks', () => {
        const list = entries(3);

        list[0].streak = 2;
        list[1].streak = 1;

        renderWithProviders(
            <Leaderboard period="30d" onPeriodChange={() => {}} entries={list} />,
        );

        const first = document.querySelector('[data-slot="podium-place"][data-place="1"]');
        const second = document.querySelector('[data-slot="podium-place"][data-place="2"]');

        expect(first?.textContent).toContain('2-week streak');
        expect(second?.textContent).not.toContain('streak');
    });
```

- [ ] **Step 2: Run** `npm run test -- resources/js/components/skrum/games-leaderboard.test.tsx`. Expected: FAIL, the first place has no streak text.
- [ ] **Step 3:** In `PodiumPlace`, after the points line, render the same badge as the list rows:

```tsx
                {(entry.streak ?? 0) >= StreakBadgeFrom && (
                    <Badge variant="outline" icon={Flame} className="max-w-full">
                        <span className="truncate">
                            {t(':count-week streak', { count: entry.streak ?? 0 })}
                        </span>
                    </Badge>
                )}
```

- [ ] **Step 4: Run** the test file (PASS), `npm run check`.
- [ ] **Step 5: Commit**: `fix(games-leaderboard): streak badge for the players on the podium`.

### Task 0.11: A form dialog that cannot be submitted

**Files:**
- Modify: `resources/js/components/skrum/confirm-dialog.tsx:44-50,250-355` (`FormDialogProps`, `FormDialog`)
- Modify: `resources/js/components/skrum/confirm-dialog.test.tsx`

Why: `unavailableMessage` already replaces the form by a message, but its only button is "Close". `[P17c-05b]` (`Plan17cWhiteboardFacilitationTest.php:731-735`) expects the message, no "Hand over" button, and a "Cancel" button that closes.

**Interfaces — produces:**

```ts
type FormDialogSubmit =
    | { submitLabel: string; onSubmit: (data: FormData) => Promise<void> }
    /** No submit button: the body explains why, the only action is Cancel. */
    | { submitLabel?: undefined; onSubmit?: undefined };

export type FormDialogProps = DialogShellProps & {
    description?: string;
    tone?: 'default' | 'destructive';
    children: ReactNode;
} & FormDialogSubmit;
```

- [ ] **Step 1:** Add to `describe('FormDialog', …)`:

```tsx
    it('has no submit button and closes on Cancel when it cannot be submitted', async () => {
        const onOpenChange = vi.fn();

        render(
            <FormDialog open onOpenChange={onOpenChange} title="Hand over facilitation">
                <p>No one else can facilitate this board yet.</p>
            </FormDialog>,
        );

        const dialog = screen.getByRole('dialog');

        expect(dialog.textContent).toContain('No one else can facilitate this board yet.');
        expect(dialog.querySelector('button[type="submit"]')).toBeNull();

        await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(onOpenChange).toHaveBeenCalledWith(false);
    });
```

- [ ] **Step 2: Run** `npm run test -- resources/js/components/skrum/confirm-dialog.test.tsx`. Expected: FAIL (type error on the missing `submitLabel`, or a submit button is found).
- [ ] **Step 3:** Change the type as above. In `FormDialog`, when `onSubmit` is undefined the `<form>`'s `onSubmit` only calls `event.preventDefault()` and the submit `<Button>` is not rendered.
- [ ] **Step 4: Run** the test file (PASS), `npm run types:check`.
- [ ] **Step 5: Commit**: `feat(form-dialog): a state with no submit button`.

### Task 0.12: `ShareDialog` — id of the guest switch

**Files:**
- Modify: `resources/js/components/skrum/share-dialog.tsx:92-121,968-979` (prop, `Switch id`), and `ShareDialogContentProps`
- Modify: `resources/js/components/skrum/share-dialog.test.tsx`

Why: `Plan10aPokerCoreTest` (`P10a-05`, `P10a-14`) clicks `#poker-guest-link-access`.

**Interfaces — produces:** `ShareDialogProps.guestSwitchId?: string` — id of the "Allow guests" switch control.

- [ ] **Step 1:** Add:

```tsx
    it('gives the guest switch the id a page asks for', () => {
        renderWithProviders(
            <ShareDialog {...baseProps({ guestSwitchId: 'poker-guest-link-access' })} />,
        );

        expect(
            screen.getByRole('switch', { name: 'Allow guests' }).getAttribute('id'),
        ).toBe('poker-guest-link-access');
    });
```

- [ ] **Step 2: Run** `npm run test -- resources/js/components/skrum/share-dialog.test.tsx`. Expected: FAIL, the id is a generated one.
- [ ] **Step 3:** Add the prop and pass `id={guestSwitchId}` to the `Switch` at `:969` (both the desktop and the mobile branch use the same `guestSwitch` element).
- [ ] **Step 4: Run** the test file (PASS).
- [ ] **Step 5: Commit**: `feat(share-dialog): id for the guest access switch`.

### Task 0.13: One GIF search dialog, on `GifPicker`

**Files:**
- Modify (rewritten in place, same export and props): `resources/js/components/gifs/gif-search-dialog.tsx`
- Create: `resources/js/components/gifs/use-gif-search.ts`, `use-gif-search.test.ts`
- Modify: `tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php:1001-1012` and the lines of that test that use `$result`; `tests/Browser/Walkthroughs/Plan13cSprintGifTest.php:100-109` (`p13cPick`)
- Possibly modify: `resources/js/components/skrum/gif-picker.tsx` (rest props on the dialog root, for the drag isolation handlers)

Owner: this task. The retro (R4) and the games (G5) both call `GifSearchDialog`; neither writes a second GIF container.

**Interfaces:**
- Consumes: `GifPicker` (`skrum/gif-picker.tsx`: `open`, `onOpenChange`, `results`, `provider`, `status`, `selectedId`, `onSelect(gif)`, `onQueryChange`, `onRetry`; dialog named "Choose a GIF"; search field named "Search GIPHY" / "Search Tenor"; tiles are `role="option"` inside a `role="listbox"`), `RetroRequestError` (`lib/retro/api.ts`).
- Produces (unchanged for callers, plus `selectedId`):

```ts
export type PickedGif = { id: string; previewUrl: string };

export function GifSearchDialog(props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onPick: (gif: PickedGif) => void;
    search: (query: string) => Promise<{ gifs: GameGifSearchResult[] }>;
    provider: 'giphy' | 'tenor' | null;
    selectedId?: string;
    /** Keeps key and pointer events away from surrounding drag-and-drop. */
    isolation?: Pick<HTMLAttributes<HTMLDivElement>, 'onKeyDown' | 'onPointerDown'>;
}): ReactElement;

// use-gif-search.ts
export function gifStatusOf(error: unknown): 'rate_limited' | 'disabled' | 'error';
export function useGifSearch(
    search: (query: string) => Promise<{ gifs: GameGifSearchResult[] }>,
    open: boolean,
): {
    results: GifItem[];
    status: GifPickerStatus;
    setQuery: (query: string) => void;
    retry: () => void;
};
```

Status mapping: request running → `loading`; `[]` → `empty`; HTTP 429 → `rate_limited`; 403 or 404 → `disabled`; any other failure → `error`; `provider === null` → `disabled` without a request. Debounce 300 ms, a search with the empty query on open, stale answers dropped (as the old dialog).

**Browser tests changed** (imposed by `GifPicker/README.md`: search field named after the provider, results as a listbox of options):
- `Plan07BoardEngagementTest.php`: `$result = '[role="dialog"] [role="option"]'`; `fill('[aria-label="Search GIFs…"]', …)` becomes `fill('[role="dialog"] [aria-label="Search GIPHY"]', …)`. "Choose a GIF" and "Powered by GIPHY" stay.
- `Plan13cSprintGifTest.php` `p13cPick`: `$result = "[role=\"dialog\"] [role=\"option\"]:has(img[src=\"/gifs/{$gifId}/preview\"])"`; the search field as above; `assertNotPresent('[role="dialog"]')` after the pick stays.

Before editing the selectors, read `gif-picker.tsx:540-560, 640-700, 895-935` for the exact roles and names; if a name above is not what the component renders, use the component's and say so in the report.

- [ ] **Step 1: Write the failing test**

```ts
// resources/js/components/gifs/use-gif-search.test.ts
import { describe, expect, it } from 'vitest';
import { gifStatusOf } from '@/components/gifs/use-gif-search';
import { RetroRequestError } from '@/lib/retro/api';

function httpError(status: number): RetroRequestError {
    return Object.assign(Object.create(RetroRequestError.prototype), { status });
}

describe('gifStatusOf', () => {
    it('tells a rate limit from a switched-off provider from a failure', () => {
        expect(gifStatusOf(httpError(429))).toBe('rate_limited');
        expect(gifStatusOf(httpError(404))).toBe('disabled');
        expect(gifStatusOf(httpError(403))).toBe('disabled');
        expect(gifStatusOf(httpError(500))).toBe('error');
        expect(gifStatusOf(new Error('network'))).toBe('error');
    });
});
```

- [ ] **Step 2: Run** `npm run test -- resources/js/components/gifs/use-gif-search.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** the hook and the dialog to the signatures above; edit the two browser tests.
- [ ] **Step 4: Run** the Vitest file (PASS), `npm run types:check`, `npm run check`, `npm run build:front`, then `Plan07BoardEngagementTest.php` and `Plan13cSprintGifTest.php` with the single-file command.
- [ ] **Step 5: Commit**: `feat(gifs): one GIF search dialog on GifPicker for the retro and the games`.

### Task 0.14: Bench section and captures of the session shell; Task 0 gate

**Files:**
- Create: `resources/js/pages/dev/sections/session-shell.tsx` (the registry is a glob over `sections/*.tsx`; no index to edit)
- Create: `tests/Browser/Visual/SessionShellVisualTest.php` (pattern: `AdminPagesVisualTest.php`, `captureVisuals`)

The section renders `SessionShell` with every slot filled at its worst case: a 120-character title with two badges, `PhaseStepper` with the nine phases, `SessionTimer` running, `SessionPresence` with twelve people, an actions slot with the cursor toggle, a Share button and a menu; then the same with the reconnecting pill, and with the expired banner. The reaction bar is shown floating over a tall content.

- [ ] **Step 1:** Write the visual test: captures `session-shell` in light and dark, at 390 and 1440, in EN and FR; it fails on horizontal overflow and asserts `assertCount('[data-realtime]', 3)` (three shells on the bench page) and that the header of each shell is 3.5rem tall at 1440.
- [ ] **Step 2:** Write the section. If the header overflows at 390, the fix is in the bench's use of the slots (compact stepper, three avatars, icon-only actions), not in `frames.tsx`; a change to `SessionFrame` is reported first.
- [ ] **Step 3: Run** `npm run check`, `npm run types:check`, `npm run test`, `vendor/bin/sail artisan test --parallel --processes=8 --compact`, `npm run build:front`, the visual test with the single-file command, then `bin/test-browser`. All green.
- [ ] **Step 4: Commit**: `test(session): bench section and captures of the session shell`.

---

## Group 1 — Session creation (after Task 0)

Brief: `18e-briefs/01-session-creation.md`. Layout: none changes (dialogs over `teams/show`, which stays on the old layout until 4.1). Three commits; the brief's fourth (C4, "New room") is done by G1 (K9). Constraint K20: no colour literal in this group (fixtures take colours from `serverColumnColors`).

### Task 1.1: New session dialog shell with the retro form

**Read first:** brief 01 §3 rows 1–19, 53, 54; §4 (`new-session-dialog`, `retro-session-fields`, `setting-row`, `lib/retro/template-adapter.ts`); §8.

**Files:**
- Create: `resources/js/components/teams/session-create/new-session-dialog.tsx`, `retro-session-fields.tsx`, `setting-row.tsx`, `new-session-dialog.test.tsx`
- Create: `resources/js/lib/retro/template-adapter.ts`, `template-adapter.test.ts`
- Create: `resources/js/pages/dev/sections/session-create.tsx`, `tests/Browser/Visual/SessionCreateVisualTest.php`, `tests/Browser/Walkthroughs/Plan18eSessionCreateTest.php`
- Modify: `resources/js/pages/teams/show.tsx` (trigger import)
- Delete: `resources/js/components/teams/new-retro-dialog.tsx`

**Interfaces:**
- Consumes: `SessionTypePicker` (`variant="tiles"`, `as="radiogroup"`), `RetroTemplatePicker` (`blankId` default `'custom'`, `shortcuts`), `Dialog` / `Drawer`, `useIsMobile`.
- Produces: `NewSessionDialog({ trigger, defaultType, team, retro?, poker?, whiteboard? })` with `defaultType: 'retro' | 'poker' | 'whiteboard'` (1.2 and 1.3 add their forms; 4.1 mounts three instances); `toRetroTemplate(item: CatalogueTemplate): RetroTemplate`; `defaultTemplateKey(catalogue: CatalogueTemplate[]): string`; `SettingRow({ label, htmlFor, help?, children })`.

**Browser tests changed** (all imposed by `RetroTemplatePicker/README.md` — radiogroup of cards, tabs Built-in / My workspace, detail panel — and by ScreenSessionCreate — settings always visible, footer "Create & open"):
- `Plan04RetroCoreTest.php:79-90`: `[role="dialog"] li button…` → `[role="dialog"] [role="radiogroup"][aria-label="Retrospective template"] [role="radio"]`; `aria-pressed` → `aria-checked`.
- `Plan08aFlowAndTemplatesTest.php` `P08a-01a` (160-215), `01b` (220-250), `03` (350-375): the same selector change; counts exclude "Start from scratch"; preview = `section[aria-label="Template preview"]`; swatch classes → `bg-skrum-col-*`; "Common templates" / "More templates" assertions removed (the tabs replace the sections); no-match text → `No template matches "…"`; "Empty board" → "Start from scratch"; the click on "Settings" removed; "Workspace templates" → click the tab "My workspace" first.
- `Plan08bHealthCheckTest.php:250-260`, `Plan08eLlmTest.php:126-131,252-262,701-710`, `Plan13dIcebreakerScoresInvitesTest.php:172-196`: template selector as above; the click on the "Settings" collapsible removed.
- Unchanged and checked: `#new-retro-title`, `#new-retro-anonymous`, `#new-retro-health-check`, `#new-retro-icebreaker`, `#new-retro-icebreaker-game`, `#new-retro-votes-auto`, `#new-retro-ai-summary`, `[aria-label="Search templates"]`, `[aria-label="Category"] button`, `[role="dialog"] button[type="submit"]`.

**New tests:** `[P18e-01-01]` type picker keeps each type's fields when switching; `[P18e-01-02]` "My workspace" tab creates from a workspace template; `[P18e-01-03]` Enter in the name submits; `[P18e-01-06]` at 375 px the dialog is a full-height drawer with a reachable footer. Vitest: `template-adapter.test.ts` (`defaultTemplateKey` picks the first non-workspace template; common templates first), `new-session-dialog.test.tsx` (type switch keeps state; submit target per type).

**Run:** `npm run test -- resources/js/lib/retro/template-adapter.test.ts resources/js/components/teams/session-create`; browser files `Plan04RetroCoreTest.php`, `Plan08aFlowAndTemplatesTest.php`, `Plan08bHealthCheckTest.php`, `Plan08eLlmTest.php`, `Plan13dIcebreakerScoresInvitesTest.php`, `Plan18eSessionCreateTest.php`, `Visual/SessionCreateVisualTest.php`.

**Commit:** `feat(session-create): new session dialog shell with the retro form`

### Task 1.2: Poker form on DeckPicker and DeckEditor, saved decks dialog

**Read first:** brief 01 §3 rows 20–35; §4 (`poker-session-fields`, `lib/poker/deck-adapter.ts`, `saved-decks-dialog`); brief 03 §3 rows 61–63 and brief 04 §3 rows 42–44 (the same dialog seen from the two other groups; K6).

**Files:**
- Create: `resources/js/components/teams/session-create/poker-session-fields.tsx`
- Create: `resources/js/lib/poker/deck-adapter.ts`, `deck-adapter.test.ts`, `resources/js/lib/poker/deck-payload.ts` (moved from `deck-fields.tsx`: `deckPayload`, `splitCustomCards`, `deckChoiceFromGame`)
- Modify: `resources/js/components/poker/deck-fields.tsx` (imports the three helpers; group 3 deletes the file), `resources/js/components/skrum/deck-picker.tsx` (`Deck.source` gains `'custom'`, badge "This game only"; decision 1-D5) and its test
- Rewrite in place: `resources/js/components/teams/saved-decks-dialog.tsx` (same path, same export)
- Delete: `resources/js/components/teams/new-poker-game-dialog.tsx`

**Interfaces:**
- Consumes: `NewSessionDialog` (1.1), `DeckPicker` (`onCreate`, `onEdit`, `onDelete`, `Deck.canManage`), `DeckEditor` (`idPrefix`, `nameRequired`, `saveLabel`, `errors`), `deckShapeFromCards`.
- Produces: `toDeck(option: PokerDeckOption): Deck`, `toSavedDeck(saved: SavedPokerDeck): Deck`, `customDeckToPayload(draft): Record<string, unknown>`, `serverErrorsToDeckErrors(errors): { name?: string; values?: string }`; `lib/poker/deck-payload.ts` exports for 3.1b. Custom deck editor uses `idPrefix="deck-custom"` (1-D6): `#deck-custom-cards` (unchanged), `#deck-custom-unknown`, `#deck-custom-coffee`, `#deck-custom-name`.

**Browser tests changed** (imposed by `DeckPicker/README.md` and `DeckEditor/README.md`, and by ScreenPokerQueue frames c/d for the saved decks):
- `Plan10aPokerCoreTest.php` `P10a-02` (96-118), `P10a-03` (136-152): radio count scoped `[aria-label="Deck"] [role="radio"]` (4 built-in decks); chips from the picker's preview; open "Create a deck" then `#deck-custom-cards`; `#deck-include-unknown` → `#deck-custom-unknown`, `#deck-include-coffee` → `#deck-custom-coffee`; `3, 3` is refused by the editor ("Duplicate value: 3") before the server; `click('Create game')` → `click('Create & open')`.
- `Plan10bPokerAdditionsTest.php` `P10b-01` (60-100), `02a` (120-160), `02b` (160-190): "New deck" → "Create a deck"; chip selector → the picker's preview values; "Edit deck" / "Delete deck" → "Edit :name" / "Delete :name"; `Create game` → `Create & open`; `#deck-new-*` ids of the saved-deck editor unchanged; `#new-poker-anonymous`, `#new-poker-auto-reveal`, `#new-poker-title` unchanged.

**New tests:** `[P18e-01-04]` "Create a deck" with a name creates the game and a saved deck, without a name a one-off deck; `[P18e-01-07]` a manager sees Edit and Delete in the saved decks dialog, another member does not. Vitest `deck-adapter.test.ts`: payload for a built-in, a saved and a one-off deck; `custom_cards.N` and `save_deck_as` errors mapped to `values` and `name`.

**Run:** the Vitest files; `tests/Feature/Poker` (unchanged, must stay green); browser `Plan10aPokerCoreTest.php`, `Plan10bPokerAdditionsTest.php`, `Plan18eSessionCreateTest.php`.

**Commit:** `feat(session-create): poker form on DeckPicker and DeckEditor, saved decks dialog`

### Task 1.3: Whiteboard form and template gallery, templates manager

**Read first:** brief 01 §3 rows 36–46; §4 (`whiteboard-session-fields`, `whiteboard-template-gallery`); brief 04 §3 rows 19–23 (selectors of the manager; K7).

**Files:**
- Create: `resources/js/components/teams/session-create/whiteboard-session-fields.tsx`, `whiteboard-template-gallery.tsx`
- Rewrite in place: `resources/js/components/teams/whiteboard-templates-dialog.tsx`, `whiteboard-template-preview.tsx`
- Modify: `resources/css/app.css` (`@theme` token for the preview paper, pure white, 1-D5)
- Delete: `resources/js/components/teams/new-whiteboard-dialog.tsx`

**Interfaces:**
- Consumes: `NewSessionDialog` (1.1), `RadioGroupCardItem`, `ConfirmDialog` is NOT used by the manager (inline confirm, 1-D8).
- Produces: `WhiteboardTemplateGallery({ items, value, onValueChange, loading, error })` — two `radiogroup`s named "Template" (built-in, workspace), tile = preview surface (`div` direct child) + `span.font-medium` name + `span.text-muted-foreground` description.

**Browser tests changed** (imposed by ScreenSessionCreate: the type picker adds a radiogroup to every creation dialog; footer "Create & open"):
- `Plan17aWhiteboardCoreTest.php:38-42`: the checked radio scoped to `[aria-label="Template"]`; `form button:text-is("Create")` → "Create & open".
- `Plan17bWhiteboardTemplatesTest.php` `P17b-03`, `-05`, `-06`, `-07`, `-08`, `-12`, `-15` and helper `p17bCreateBoard()`: radiogroup and radio counts scoped to `[role="dialog"] [aria-label="Template"]`; default `$createLabel = 'Create & open'`.
- Unchanged and checked: `#whiteboard-title`; the manager's selectors `[role="dialog"] li:has(p:text-is("…"))`, `input[maxlength="80"]`, `input[maxlength="300"]`, `form button:text-is("Save")`, `div.bg-muted button:text-is("Delete")`, the texts "Delete this template?", "No whiteboard templates yet."; the white preview surface of `P17b-07`.

**New tests:** `[P18e-01-05]` arrows pick a template in the gallery; a workspace template sends `workspace_template_id` and no `template`; `[P18e-01-08]` captures in dark and FR without overflow (`SessionCreateVisualTest`).

**Run:** browser `Plan17aWhiteboardCoreTest.php`, `Plan17bWhiteboardTemplatesTest.php`, `Plan18eSessionCreateTest.php`, `Visual/SessionCreateVisualTest.php`; then the group gate (`bin/test-browser`, PHP suite) and G-visual-1.

**Commit:** `feat(session-create): whiteboard form and template gallery, templates manager`

---

## Group 2 — Retro (after Group 1)

Brief: `18e-briefs/02-retro.md`. Layout: `SessionShell` (Task 0.3), rendered by `components/retro/board.tsx`. Until its own commit, a phase keeps its old components mounted inside the new shell (they only need `useBoard()` from `board-context.tsx`, which keeps its API to the end of the plan). Files kept with the same exports for group 8: `board-context.tsx`, `comment-thread.tsx` (`CommentThreadList`), `reaction-chips.tsx` (`ReactionChips`), `emoji-picker.tsx` (`EmojiPicker`), and the eight survey files.

### Task R1: Eight column colours (B10)

**Read first:** brief 02 §7.4; spec §9 B10 as amended (A4).

**Files:**
- Modify: `app/Enums/ColumnColor.php`; `app/Support/RetroTemplates/TemplateCatalogue.php:21-72` (52 templates); `database/factories/ColumnFactory.php:20`, `WorkspaceTemplateColumnFactory.php:21`
- Create: a migration (up only) mapping `columns.color` and `workspace_template_columns.color`
- Modify: `resources/js/lib/retro/types.ts:23`, `lib/retro/colors.ts`, `types/workspaces.ts:61`, `components/skrum/{column-color-picker,retro-column,retro-card,card-group,retro-template-picker,template-editor}.tsx` (the `ServerColumnColor` union goes), `components/retro/add-column.tsx:21`, `components/retro/column-header.tsx`, `components/templates/template-chips.tsx`, `pages/workspaces/templates.tsx:28-29`, the dev sections that demo server colours; `lang/*.json` (keys Green … Slate removed if unused)
- Tests: `tests/Feature/Retros/ColumnsTest.php`, `CreateRetroTest.php`, `RetroModelTest.php`, `TemplateCatalogueTest.php`, `tests/Feature/Workspaces/WorkspaceTemplatesTest.php`; new `tests/Feature/Retros/ColumnColorMigrationTest.php`

**Interfaces — produces:** `ColumnColor` (PHP and TS) = `sun | apricot | coral | plum | iris | sky | lagoon | moss`; `ColumnColorOptions` of `skrum/column-color-picker.tsx` is the only colour list of the front.

**Feature tests (written first):** one row per old value in each of the two tables is mapped (green→moss, red→coral, blue→sky, amber→sun, purple→plum, slate→iris); every built-in template's colours are cases of the enum; `POST …/columns` with `color: 'green'` answers 422 with an error on `color` (Review Focus: an old client or API caller gets a clear refusal).

**Browser tests changed** (imposed by B10 and `ColumnColorPicker`): colour radio names "Green", "Blue" → "Moss", "Sky" in `Plan06PolishPassTest.php` and `Plan08aFlowAndTemplatesTest.php`. New: `[P18e-02-05]` a board with the eight colours renders and recolours; a migrated `green` column shows as Moss.

**Run:** `vendor/bin/sail artisan test --compact tests/Feature/Retros tests/Feature/Workspaces`; Vitest of the six `skrum/` files; browser `Plan06PolishPassTest.php`, `Plan08aFlowAndTemplatesTest.php`.

**Commit:** `feat(retro): eight column colours (B10)`

### Task R2: Guest join and session ended

**Read first:** brief 02 §3.6 rows 99–101; brief 11 §3 rows 32, 35–39 (K2).

**Files:**
- Rewrite: `resources/js/pages/retros/join.tsx`, `resources/js/pages/retros/session-ended.tsx`
- Modify: `resources/js/lib/page-layouts.ts` (`retros/join`, `retros/session-ended`)

**Interfaces — consumes:** `GuestJoinPage` (`kind="retro"`, `invalidTitle={t('Join a retrospective')}`, `storeUrl={RetroJoinsController.store.url(guestToken)}`), `AuthLayout variant="centered"`, `AccessNotice` (`title={t('Your session has ended.')}`, `hint={t('Guests: ask the facilitator for the guest link.')}`, action = link "Log in" to `login()`). `session-ended` is rendered by the middlewares of the four session types: groups 3, 6 and 7 do not touch it.

**Browser tests changed:** none. Checked: `joinAsGuest` (`#name`, `click('Join')`), "This guest link is no longer valid." (`Plan04:477`), "Your session has ended." / "Guests: ask the facilitator for the guest link." / "Log in" (`Plan06:461-463`, `Plan17a:421-422`).

**Run:** browser `Plan04RetroCoreTest.php`, `Plan06PolishPassTest.php`, `Smoke/HarnessTest.php`; the visual test `tests/Browser/Visual/RetroPagesVisualTest.php` is created here with the join, the invalid link and session-ended.

**Commit:** `feat(retro): guest join and session ended`

### Task R3: Session shell of the board

**Read first:** brief 02 §3.1 rows 1–29; §4.1 (`board`, `board-topbar`, `board-settings`, `board-share`, `board-dialogs`, `board-reactions`, `board-cursors`, `facilitator-dock`), §4.3 adapters for `PhaseStepper`, `Timer`, `PresenceStack`, `ShareDialog`, `SessionSettingsPopover`.

**Files:**
- Rewrite in place: `resources/js/components/retro/board.tsx`
- Create: `components/retro/board-topbar.tsx`, `board-settings.tsx`, `board-share.tsx`, `board-dialogs.tsx`, `board-reactions.tsx`, `board-cursors.tsx`, `facilitator-dock.tsx`, `board-ended.tsx` (new body), `lib/retro/phases.ts` (`PhaseLabels`), their Vitest files; `tests/Browser/Walkthroughs/Plan18eRetroTest.php`
- Delete: `components/retro/board-header.tsx`, `phase-stepper.tsx`, `timer-control.tsx`, `facilitator-menu.tsx`, `settings-dialog.tsx`, `guest-link-dialog.tsx`, `share-board-button.tsx`, `board-post-link.tsx`, `handover-dialog.tsx`, `delete-retro-dialog.tsx`, `lock-badge.tsx`, `flying-reactions.tsx`, `phase-panel.tsx`
- Kept for F1: `connection-banner.tsx`, `session-expired-banner.tsx`, `timer-display.tsx`, `presence-strip.tsx`, `live-cursor-layer.tsx`

**Interfaces:**
- Consumes: `SessionShell`, `SessionTitle`, `SessionPresence`, `SessionTimer` (default presets; `onStart`, `onStop` for the facilitator only), `CursorToggle`, `useHideMyCursor`, `LiveCursors`, `SessionReactions` (`toolbarProps={dragIsolation}`; `labelFor` null and `originFor={centreOrigin}` on an anonymous retro), `PhaseStepper`, `SessionSettingsPopover` + `useRetroSettingGroups`, `ShareDialog` (`channelsExtra` = `delivery-lines`), `FormDialog`, `ConfirmDialog`, `FacilitatorBar`.
- Produces: `showsRetroCursors(retro: { cursorsEnabled: boolean; phase: string }): boolean` in `board-cursors.tsx` (off in `voting` and `completed`; R11 adds `roti`); `facilitatorActions(phase, board): FacilitatorAction[]` in `facilitator-dock.tsx` (brief 02 §4.1 table).

**Browser tests changed:**
- Settings flow in `Plan04`, `Plan06`, `Plan07`, `Plan08b`, `Plan08e`, `Plan13d` (wherever a test opens "Settings…" then presses a `type="submit"` "Save"): the panel is a popover and its button is "Apply" — imposed by `SessionSettingsPopover/README.md` (2-D15). The ids `#retro-locked`, `#retro-icebreaker`, `#retro-ai-summary`, `#retro-reactions`, `#retro-hide-vote-counts`, `#retro-health-check`, `#retro-cursors`, `#retro-votes-auto`, `#retro-gifs`, `#retro-presentation` are unchanged.
- "Guest link…" tests in `Plan04`, `Plan07`, `Plan12b`: the link is in the Share dialog and "Create a new link" asks for confirmation (one more press) — imposed by `ShareDialog/README.md` (2-D11). `input[aria-label="Guest link"]`, "Copy guest link", "Allow guests", "Post link to Slack" unchanged.
- `Plan04RetroCoreTest.php:419`: `assertAttribute('[role="timer"]', 'aria-label', "Time's up!")` (Task 0.5).
- Unchanged and checked: `header ol[aria-label="Phases"]`, `[aria-current="step"]`, `press('Next')`, `press('Complete')`, `press('Reopen')`, `[aria-label="Timer"]`, `click('1 min')`, `click('Stop timer')`, `[role="group"][aria-label="2 online"]`, `img[data-presence-id]`, "Hide my cursor" / "Show my cursor", `header [aria-label="Language"]`, `[aria-label="Facilitator menu"]` and its four items, `[role="alert"]:has-text("Your session has expired.")`, `click('Reload')`, `[role="toolbar"][aria-label="Reactions"]`, "Send a reaction 🎉", `click('More emoji…')`, `.lr-overlay`, `.lc-overlay`, `[data-realtime]`.

**New tests:** `[P18e-02-08]` one `[data-realtime]` on the board, the expired banner makes the board inert, Reload restores it (Review Focus 2). Vitest: `facilitatorActions` per phase; `PhaseStepper` adapter; presence adapter is covered in 0.4.

**Run:** browser `Plan04RetroCoreTest.php`, `Plan06PolishPassTest.php`, `Plan07BoardEngagementTest.php`, `Plan12bIntegrationsSharingTest.php`, `Smoke/RealtimeTest.php`, `Plan18eRetroTest.php`.

**Commit:** `feat(retro): session shell`

### Task R4: Writing phase

**Read first:** brief 02 §3.2 rows 30–39, §3.3 rows 40–48 and 67; §4.3 adapters `RetroColumn`, `RetroCard`.

**Files:**
- Create: `components/retro/columns-board.tsx`, `board-column.tsx`, `board-card.tsx`, `lib/retro/adapters.ts`, `adapters.test.ts`
- Rewrite in place: `components/retro/dnd.tsx`
- Modify: `components/skrum/retro-card.tsx` (`labels.editor?: string`, the accessible name of the editing textarea; default "Card text") and its test
- Delete: `components/retro/retro-column.tsx`, `column-header.tsx`, `add-column.tsx`, `retro-card.tsx`, `card-composer.tsx`, `card-editor.tsx`, `card-gif.tsx`, `gif-picker.tsx`, `card-insight.tsx` (only if `insights/*` no longer imports it; otherwise R12)

**Interfaces:**
- Consumes: `RetroColumn` (rest props carry `data-test="retro-column-{id}"`), `RetroCard` (`editing`, `editorTools`, `gif`, `insight`, default `id="card-{id}"`), `ColumnColorOptions`, `GifSearchDialog` (0.13, `isolation={dragIsolation}`).
- Produces: `toCardProps(card, board): RetroCardProps`, `toColumnProps(column, board): RetroColumnProps` in `lib/retro/adapters.ts` (R7–R9 extend the file).

**Browser tests changed:** none. The composer passes `labels={{ editor: t('Add a card…') }}` so the 13 uses of `[aria-label="Add a card…"]` stay (2-D12). Checked: `[data-test^="retro-column-"]`, `main:has([data-test^="retro-column-"])`, `#card-{id}`, `#card-{id} textarea`, "Edit card", "Delete card", `@retro-card-handle-{id}`, "Column menu", "Column title", "Add column", "Edit description", "Delete column", "GIF", "Remove GIF", `Smoke/KeyboardDragTest.php`.

**Run:** browser `Plan04RetroCoreTest.php`, `Plan06PolishPassTest.php`, `Plan07BoardEngagementTest.php`, `Plan08aFlowAndTemplatesTest.php`, `Smoke/KeyboardDragTest.php`.

**Commit:** `feat(retro): writing phase`

### Task R5: Health check phase

**Read first:** brief 02 §3.4 rows 68–70; risk 12.

**Files:** Create `components/retro/phase-health.tsx`; delete `components/retro/health-check-panel.tsx`.

**Interfaces — consumes:** `HealthCheckForm` (`statements` keyed by `key`, `onAnswer`, `onClear`, `disabled`). Re-read `PresentHealthCheck` for the server field names before writing the adapter.

**Browser tests changed:** to be confirmed while reading `Plan08bHealthCheckTest.php`: the tests bind `ol > li [role="radiogroup"]`, "Score n", "Answered", "Clear", `ol > li:has([role="radiogroup"]) img`. If `HealthCheckForm` renders that structure and those names, none changes. If it does not (the brief did not verify), the agent stops and reports: the fix is in the component when the HealthCheck README does not impose the difference, in the test when it does.

**Run:** browser `Plan08bHealthCheckTest.php`.

**Commit:** `feat(retro): health check phase`

### Task R6: Icebreaker phase in the new frame

**Read first:** brief 02 row 71; brief 06 §3 rows 57–63 (K10).

**Files:** Modify `components/retro/board.tsx` (mount). `components/retro/icebreaker-stage.tsx` and `icebreaker-game.tsx` are mounted unchanged; G6 rewrites and deletes them.

**Interfaces:** the board's `SessionTimer` is the single timer control during the icebreaker (`withBoardTimer` unchanged); `<TimeUpBadge>` is not added here (the old stage shows its own text until G6).

**Browser tests changed:** none. Checked: `section[aria-label="Icebreaker game"]`, `[aria-label="Game"]`, `[role="group"][aria-label="Letters"]`, "Time's up" inside the section (`Plan13d:305`), `.lc-overlay` over the stage.

**Run:** browser `Plan13dIcebreakerScoresInvitesTest.php`.

**Commit:** `feat(retro): icebreaker phase`

### Task R7: Grouping phase

**Read first:** brief 02 §3.3 rows 49–54, 61–66; notes-for-18e "Group markup changed".

**Files:**
- Modify: `columns-board.tsx`, `board-card.tsx`, `lib/retro/adapters.ts` (`toGroupProps`)
- Rewrite in place (same exports): `components/retro/comment-thread.tsx` (`CommentThreadList`), `reaction-chips.tsx` (`ReactionChips`), `emoji-picker.tsx` (`EmojiPicker`)
- Delete: `components/retro/group-name.tsx`, `group-name-suggestions.tsx`, `card-comments.tsx`, `card-reactions.tsx`

**Interfaces — consumes:** `CardGroup` (`domId`, `titleHint`, `onRename`, `onUngroup`, `dropTarget`), `RetroCard` (`reactions`, `reactionPicker`, `commentCount`, `commentsOpen`, `footer`, `children`).

**Browser tests changed** (imposed by `CardGroup/README.md`: the group is a section around its cards): `#card-{lead} [aria-label="Rename group"]`, `#card-{x} #card-{y}` (5 uses), `#card-{x} button[aria-label="Ungroup"]` are re-anchored on the group section (`CardGroup domId={`group-${lead.id}`}`) in the grouping tests of `Plan04`, `Plan06`, `Plan07`, `Plan08e`. Names "Rename group", "Group name", "Name this group", "Ungroup", "Suggest group names", "Use this name", "Edit this name", "Add a reaction", "👍, 1 reaction", "Comments (n)", "Write a comment…", "Write a reply…", "Edit comment", "Delete comment", "Search emoji…" are unchanged; if the new card names a reaction chip differently (brief 02 row 61 did not verify), the component takes the old name.

**Run:** browser `Plan04RetroCoreTest.php`, `Plan06PolishPassTest.php`, `Plan07BoardEngagementTest.php`, `Plan08eLlmTest.php`, `Plan08cSurveysTest.php` (surveys still use the two files rewritten in place).

**Commit:** `feat(retro): grouping phase`

### Task R8: Voting phase

**Read first:** brief 02 §3.3 rows 55–57.

**Files:** Create `components/retro/phase-voting-bar.tsx`; delete `vote-controls.tsx`, `vote-progress.tsx`.

**Interfaces — consumes:** `VoteBudget` (`total`, `remaining`), `RetroCard votes / canVote / onVote`, `CardGroup votes`, `Progress`.

**Browser tests changed:** none. Checked: "Add a vote", "Remove a vote", "Your votes: n", `/^\d+ votes?$/`, `[role="progressbar"]`.

**Run:** browser `Plan04RetroCoreTest.php`, `Plan07BoardEngagementTest.php`.

**Commit:** `feat(retro): voting phase`

### Task R8b: Shared action-item containers

**Read first:** brief 05 §2 (commit 5.1), §3 rows 12–40, §4 (adapter table); brief 02 §3.4 rows 74–82 (K18).

**Files:**
- Create in `resources/js/components/action-items/` (new names; the twelve old files stay until 5.2): `action-item-adapters.ts`, `use-action-item-mutations.ts`, `item-comments.tsx`, `item-subtasks.tsx`, `item-export.tsx` (menu and dialog), `item-create-form.tsx`, and their Vitest files
- Modify: `resources/js/components/skrum/action-item.tsx` (owner label "(guest)" as the old front, 5-D7) and its test

**Interfaces — produces** (used by R9, R10, R12, 5.2):

```ts
// action-item-adapters.ts
export function toActionItemData(item: ActionItem, context: {
    locale: string;
    teamName?: string;
    viewer: ActionItemViewer;
    sourceLabel?: string | null;
}): ActionItemData;
export function patchToPayload(patch: ActionItemPatch, item: ActionItem): Record<string, unknown>;
export function ownerOptions(members: { id: string; name: string; avatarUrl?: string | null }[]): ActionItemOwner[];

// use-action-item-mutations.ts
export function useActionItemMutations(endpoints: ActionItemEndpoints, onSaved: (item: ActionItem) => void): {
    busyId: string | null;
    patch: (item: ActionItem, patch: ActionItemPatch) => Promise<void>;
    remove: (item: ActionItem) => Promise<void>;
    run: <T>(request: Promise<T>) => Promise<T | undefined>; // toast + resync on failure
};

// item-*.tsx
export function ItemSubtasks(props: { item: ActionItem; endpoints: ActionItemEndpoints; canManage: boolean; canComplete: boolean }): ReactElement;
export function ItemComments(props: { item: ActionItem; endpoints: ActionItemEndpoints; revision: number; viewer: ActionItemViewer }): ReactElement;
export function ItemExport(props: { item: ActionItem; sources: ExportSource[]; scope: IntegrationScope }): ReactElement | null;
export function ItemCreateForm(props: { members: ActionItemOwner[]; onCreate: (values: NewActionItem) => Promise<boolean>; ids?: { title?: string } }): ReactElement;
```

`ActionItemEndpoints` is the existing shape returned by `workspaceActionItemEndpoints(slug)` and by the retro's board endpoints (`lib/action-items/endpoints.ts`, unchanged). Accessible names are the old ones: "Add an action item…", "Priority", "Due date", "Repeat", "Assignee", "Sub-tasks", "Add a sub-task", "Move up", "Move down", "Edit sub-task", "Delete sub-task", "n of m sub-tasks done", "Comment", "Edit comment", "Delete comment", "Export", "Export to :provider", "Linear team", "Issue type", "Project", "Repository", "Manage people".

**Browser tests changed:** none (no screen uses the new files yet).

**Run:** `npm run test -- resources/js/components/action-items`.

**Commit:** `feat(action-items): shared containers and server-to-component adapters`

### Task R9: Discussing phase

**Read first:** brief 02 §3.3 rows 58–60, §3.4 rows 73–82; risk 8 (2-D9); §6.

**Files:**
- Create: `components/retro/phase-discussing.tsx`, `action-items-list.tsx` (retro container over the R8b files), `suggestions-panel.tsx` (new body)
- Delete: `components/retro/presentation-overlay.tsx`, `action-items-panel.tsx`, the old `suggestions-panel.tsx` body

**Interfaces — consumes:** R8b files; `ActionItem` (`id={`action-item-${id}`}` as rest prop, never `withDoing`); `RetroColumn sortedByVotes` (emits `data-test="retro-sort-by-votes"`); `Dialog` for the presentation overlay.

Layout (2-D9 default): a topics rail (groups and cards by votes) beside the columns view, which keeps every card action and the `retro-column-*` hooks; the focused topic follows `highlightedCardId`.

**Browser tests changed:** none with the default. Checked: `[data-test="retro-action-items-panel"]`, `[aria-label="Add an action item…"]`, `#action-item-{id}`, "Mark as done", "Reopen", "Edit action item", "Delete action item", `#action-item-{id}-comments`, "Export to Linear", `aside[aria-label="Suggestions"]`, `press('Stop presenting')`, `#card-{id} button[aria-pressed]`, `data-test="retro-sort-by-votes"`.

**Run:** browser `Plan04RetroCoreTest.php`, `Plan08eLlmTest.php`, `Plan09aActionItemsCoreTest.php`, `Plan09bActionItemsAdditionsTest.php` (retro tests 01a–c, 06a), `Plan12dActionItemExportTest.php`, `Plan14cTrackersTest.php`, `Plan14dStatusSyncTest.php`.

**Commit:** `feat(retro): discussing phase`

### Task R10: Actions phase (B1) — waits for gate G-spec-phases

**This task does not start until amendment A1 is approved and folded into the spec.** It implements the approved matrix; if the owner changed a cell, the cell wins over the text below.

**Read first:** spec §9 B1 as amended; brief 02 §7.1 (file and line of each guard), §8 "Tests that MUST change".

**Files (back end):**
- Modify: `app/Enums/RetroPhase.php` (cases `Actions = 'actions'`, `Roti = 'roti'` between `Discussing` and `Completed`; `label()`; new `takesActionItems(): bool`), `app/Models/Retro.php:95`, `app/Actions/Retros/ChangeRetroPhase.php:94-101`, `app/Http/Controllers/Retros/RetroHighlightsController.php:24,39`, `app/Http/Controllers/Concerns/LocksDiscussingRetro.php:14`, `app/Actions/Retros/SuggestionGuard.php:35-52`, `app/Actions/Retros/BuildInsights.php:30`, `app/Actions/Retros/RetroGuard.php:37`, `app/Http/Controllers/Retros/CardReactionsController.php:75`, `CardCommentsController.php:147`, `app/Mcp/Tools/Retro/CreateAction.php:34,81,89`, `UpdateAction.php:36,53,91`, `ListInsights.php:57`, `PromoteSuggestion.php:29`, `app/Mcp/Servers/SkrumServer.php:44`
- Tests: `tests/Feature/Retros/RetroModelTest.php`, `FacilitationTest.php`, `RetroGuardTest.php`, `ActionItemsTest.php`, `SuggestedActionsTest.php`, `BoardSnapshotTest.php`, `ResultsTest.php`, `RetroCompletedTest.php`, `tests/Feature/Mcp/ActionItemWriteToolsTest.php`, `SuggestionToolsTest.php`, `McpSweepTest.php`; new `tests/Feature/Retros/ActionsPhaseTest.php`

**Files (front):**
- Modify: `resources/js/lib/retro/types.ts:15` (`RetroPhase`), `lib/retro/phases.ts` (`actions: 'Actions'`, `roti: 'ROTI'`), `components/retro/board.tsx`, `facilitator-dock.tsx`, `board-cursors.tsx`
- Create: `components/retro/phase-actions.tsx`, `carried-items-sheet.tsx`
- Delete: `components/retro/carried-action-items-panel.tsx`

**Feature tests (written first, `ActionsPhaseTest.php`):** the neighbour walk through the nine phases and back; from `completed`, the previous phase is `roti`; in `actions`: an action item is created, updated and deleted; a locked board refuses with 423; a card is highlighted; the highlight survives `discussing` → `actions` → `discussing` and is cleared on `actions` → `roti`; vote totals are visible in `actions` and `roti`; a card comment, a card reaction and a group name are accepted in `actions` and refused in `roti`; a survey answer is refused in `actions`; **a retro created in `discussing` before the change moves to `actions` with its cards, votes and action items intact** (Review Focus 1); in `roti` an action item can still be ticked.

**Browser tests changed** (imposed by B1 and spec §6.4, ScreenRetroActions): `press('Complete')` from a board in Discussing becomes Next, Next, Complete (or the board is created in `Roti`): `Plan04` :364, :375; `Plan08c` :617; `Plan08d` :327, :564; `Plan08e` :194, :495, :570, :635, :732, :795, :849; `Plan14b` :407. `press('Reopen')` then "Discussing" becomes "ROTI": `Plan04` :370; `Plan08c` :632-655; `Plan08d` :557. `[P04-07]` walks the two new phases. `button:has-text("Previous action items (1)")` and its sheet are unchanged.

**New tests:** `[P18e-02-02]` Actions phase: create, assign and complete an item, a guest sees it live, "Next topic" moves the highlight for both.

**Run:** `vendor/bin/sail artisan test --parallel --processes=8 --compact tests/Feature/Retros tests/Feature/Mcp tests/Feature/ActionItems`; `vendor/bin/pint --dirty --format agent`; the Arch suite; browser `Plan04`, `Plan08c`, `Plan08d`, `Plan08e`, `Plan09a`, `Plan09b`, `Plan14b`, `Plan18eRetroTest.php`.

**Commit:** `feat(retro): actions phase (B1)`

### Task R11: ROTI phase (B2) — waits for gates G-spec-phases and G-spec-roti

**This task does not start until amendments A1 and A2 are approved and folded into the spec.**

**Read first:** spec §9 B2 as amended; brief 02 §7.2, rows 84–85.

**Files (back end):**
- Create: a migration (up only) adding `retros.roti_votable_when_completed` (boolean, default false) and setting it to true where `phase = 'completed'`
- Modify: `app/Models/Retro.php` (cast), `app/Http/Controllers/Retros/RetroRotiController.php:63`, `app/Actions/Retros/BuildBoardSnapshot.php:291` (`roti.canVote`), `app/Mcp/Tools/Retro/GetRoti.php:50,58`, `database/factories/RetroFactory.php` (state `legacyRoti()`)
- Tests: `tests/Feature/Retros/RotiTest.php:52-64`, `tests/Feature/Mcp/InsightsHealthRotiTest.php`

**Files (front):** create `components/retro/phase-roti.tsx`; modify `lib/retro/types.ts` (`roti.canVote`), `board-cursors.tsx` (`roti` is cursorless); delete `components/retro/roti-control.tsx`.

**Feature tests (written first):** a vote is accepted in `roti`, refused in `discussing` and `actions`; in `completed` it is refused for a retro completed after the migration and accepted for one the migration marked; the migration marks exactly the completed retros; **a retro in `discussing` that already holds ROTI votes keeps them through `actions` into `roti` and a voter can change the score there** (Review Focus 1); `roti.canVote` follows the same rule; `GetRoti` answers "pending" in `roti`.

**Interfaces — consumes:** `ROTIWidget` (`mode="vote"`, a press on the pressed score → `DELETE`), `[role="group"][aria-label="How was this retro?"]`.

**Browser tests changed** (imposed by B2 and ScreenRetroROTI): the ROTI control asserted on a board in Discussing moves to a board in `Roti`: `Plan08d` :259 (and :478, :499 where the board is not completed).

**New tests:** `[P18e-02-03]` vote, change, retract; respondent count live for the other browser; refused in Discussing; `[P18e-02-01]` a member and a guest walk Writing → Grouping → Voting → Discussing → Actions → ROTI → Completed in two browsers without a reload (spec §13 criterion 9).

**Run:** `vendor/bin/sail artisan test --compact tests/Feature/Retros/RotiTest.php tests/Feature/Mcp/InsightsHealthRotiTest.php`; Pint; browser `Plan08dResultsTest.php`, `Plan18eRetroTest.php`.

**Commit:** `feat(retro): ROTI phase (B2)`

### Task R12: Session end (B3)

**Read first:** brief 02 §3.5 rows 86–98, §7.3; spec §9 B3 as amended (A3).

**Files:**
- Back end: `app/Actions/Retros/BuildResults.php` (`stats: { votesCast, participation: { participants, teamMembers } }`), `tests/Feature/Retros/ResultsTest.php`
- Create: `components/retro/session-end.tsx` and a new, smaller `components/retro/results/*` set (participants, summary, top topics, health with radar and trend, action items, games played, recap share, recap e-mail)
- Delete: the old `components/retro/results/*` except `survey-result.tsx` (S2), `insights/suggestions-list.tsx`, `insights/summary-section.tsx`, `board-ended.tsx` old body if not done

**Interfaces — consumes:** `StatCard`, `ROTIWidget mode="result"` (and vote mode when `roti.canVote`), `HealthCheckResults` (`children` = radar and trend SVGs kept as container-side components), `GamesLeaderboard` pieces, `ActionItem` without handlers, `Tabs` with ids `completed-tab-results` / `completed-tab-board`, the games files `drawing-canvas`, `clue-row`, `gif-tile` (unchanged exports), old `SurveyResult` mounted until S2.

**Browser tests changed** (imposed by ScreenRetroROTI frames c/d): `click('Send to email')` → `click('Send the recap by e-mail')` (3 uses, 2-D14). Unchanged and checked: `#completed-tab-results`, `#completed-tab-board`, `[role="tabpanel"]`, `[aria-labelledby="results-summary"]`, `svg[aria-label="Team health radar"]`, `svg[aria-label="Trend across retros"]`, `[role="tabpanel"] li:has-text("Casey") [aria-label="6 points"]`, "Points of this round", "Drawing of rocket", `click('Share to Slack')`, `[role="dialog"] button:has-text("Send")`, `ul[aria-live="polite"]`, `main:has([data-test^="retro-column-"])` on the Board tab.

**New tests:** `[P18e-02-04]` stats row, tabs, recap e-mail dialog, share to a channel, Reopen lands on ROTI; `[P18e-02-07]` with `prefers-reduced-motion` no flying reaction and no confetti (spec §13 criterion 12). Feature: `stats` values for a retro with two participants in a team of three.

**Run:** `vendor/bin/sail artisan test --compact tests/Feature/Retros/ResultsTest.php`; browser `Plan08dResultsTest.php`, `Plan08eLlmTest.php`, `Plan12bIntegrationsSharingTest.php`, `Plan13dIcebreakerScoresInvitesTest.php`, `Plan14bOutgoingWebhooksTest.php`, `Plan18eRetroTest.php`.

**Commit:** `feat(retro): session end (B3)`

### Task R13: Mobile board

**Read first:** brief 02 commit R13; MobileRetro README.

**Files:** modify the retro containers for the phone layout (column tabs, add-card button, drawers for the action items and the votes, compact `FacilitatorBar` and `SessionReactions compact`); extend `tests/Browser/Visual/RetroPagesVisualTest.php` with every phase at 390.

**Browser tests changed:** none (the suite runs at desktop width).

**New tests:** `[P18e-02-06]` at 390: one column per tab, a card added, a vote, the action drawer.

**Run:** `Visual/RetroPagesVisualTest.php`, `Plan18eRetroTest.php`; then the group gate (`bin/test-browser`, PHP suite, Vitest) and G-visual-2.

**Commit:** `feat(retro): mobile board`

---

# Step B — lanes in separate worktrees, cut from the head of Step A

Each lane: `git worktree add ../skrum-18e-<lane> -b plan-18e-<lane> plan-18e-screens`. A lane agent works only in its worktree. The controller merges a finished lane into `plan-18e-screens` (union for the lang files and `page-layouts.ts`), runs the gates, then the next lane rebases if it shares a file from the table above.

## Lane S — Group 8, surveys (needs R13)

Brief: `18e-briefs/08-surveys.md`.

### Task S1: Surveys column, answer and results cards, editor dialog and AI draft

**Read first:** brief 08 §1 (the three mount points), §3 rows 1–35, 37–38, §4, §9 (G1–G4).

**Files:**
- Create: `resources/js/components/retro/surveys/surveys-column.tsx`, `survey-board-card.tsx`, `survey-actions-menu.tsx`, `survey-editor-dialog.tsx`, `survey-draft-field.tsx`, `survey-discussion.tsx`; `resources/js/lib/retro/survey-question-adapter.ts`, `survey-question-adapter.test.ts`; `tests/Browser/Walkthroughs/Plan18eSurveysTest.php`
- Modify: `resources/js/components/skrum/survey-question.tsx` and its test — `disabled?: boolean` (answering blocked without the "Closed" badge), voter avatars with `alt` = the name, `submitDisabled?: boolean` (the container disables Submit when the answer is unchanged), rest props on the `<article>` (`aria-label`, `data-test`)
- Modify: `components/retro/board.tsx` (the column mount and `onAddSurvey` of `SessionSettingsPopover`; the old board button goes)
- Delete: `components/retro/surveys-column.tsx`, `survey-card.tsx`, `survey-menu.tsx`, `survey-dialog.tsx`, `survey-draft-field.tsx`, `survey-discussion.tsx`

**Interfaces:**
- Consumes: `useBoard()` (`run`, `apply`, `invalidateSurvey`, `isEditable`, `sessionExpired`), `CommentThreadList`, `ReactionChips`, `EmojiPicker` (R7 exports), `lib/retro/survey-api.ts`, `SurveyQuestion`, `ConfirmDialog`.
- Produces: `toSurveyQuestionProps(survey: SurveyPayload, context: { participants; mode: 'answer' | 'results' }): SurveyQuestionProps`; `useSurveyEditor(): { open; survey; openCreate(); openEdit(survey); close() }`; `SurveyPhases` (`writing`, `grouping`, `voting`, `discussing` — the approved matrix A1 decides; default unchanged).

**Browser tests changed:**
- `Plan08cSurveysTest.php` `P08c-01` and `Plan08eLlmTest.php` `P08e-02a`, `05a`, `05b`: open the settings popover before `click('Add survey')` — imposed by `SessionSettingsPopover/README.md` (8-D2).
- `Plan08c` `P08c-02a`, `03`, `04a`, `04b`, `05`, `06`, `07`: single-choice options are radio inputs (`label:has-text("…")`, `input[type=radio]`, `:checked`, disabled on the input) instead of `button[aria-pressed]` — imposed by `SurveyQuestion/README.md`.
- `P08c-02b`: multiple-choice result text `'100% · 1'` → `'1 · 100%'` (README, 8-D4).
- `P08c-02c`, `04a`: the text answer field is `article textarea` (named by the question) instead of `[aria-label="Your answer"]`; `P08c-07`, `03`: a closed text survey shows the field disabled instead of absent.
- Unchanged and checked: `article[aria-label="<question>"]`, `section[aria-label="Surveys"]`, `button[role="checkbox"]`, `ul[aria-label="Answers"] li`, `[aria-label="Survey actions"]`, `[role="menuitemcheckbox"]`, `[aria-label^="Comments"]`, `[aria-label="Add a reaction"]`, `#survey-kind`, `#survey-question`, `#survey-description`, `#survey-show-voters`, `#survey-draft-prompt`, `[aria-label="Option n"]`, "Close survey", "Reopen survey", "Withdraw my answer", "Submit", "Update answer", "n response(s)", "Answer to join the discussion".

**New tests:** `[P18e-08-01]` "Add survey" is offered to the facilitator only, in the survey phases, below ten surveys; `[P18e-08-02]` digits 1–3 answer a single-choice survey inside the card and send no flying reaction (spec ruling 21); `[P18e-08-03]` each group of options is named by its question. Vitest: the adapter never produces a count when results are hidden; voters and author names mapped only when present.

**Run:** `npm run test -- resources/js/lib/retro/survey-question-adapter.test.ts resources/js/components/skrum/survey-question.test.tsx`; browser `Plan08cSurveysTest.php`, `Plan08eLlmTest.php`, `Plan18eSurveysTest.php`.

**Commit:** `feat(retro-surveys): surveys column, answer and results cards, editor dialog and AI draft on SurveyQuestion`

### Task S2: Surveys in the completed results

**Read first:** brief 08 §3 row 36.

**Files:** create `components/retro/surveys/survey-result-list.tsx`; modify `components/retro/session-end.tsx` (mount); delete `components/retro/results/survey-result.tsx`.

**Interfaces — consumes:** `toSurveyQuestionProps(…, { mode: 'results' })`.

**Browser tests changed:** `Plan08dResultsTest.php` `P08d-04c`: bar selector `li div.bg-primary` → `[data-slot="survey-result-bar"] > div` (imposed by `SurveyQuestion/README.md`). `section:has(h2:has-text("Surveys")) article`, "No answers yet." and the absence of `[aria-label="Survey actions"]` are unchanged.

**New tests:** `[P18e-08-04]` captures of the surveys column and an open thread at 390 added to `RetroPagesVisualTest.php`.

**Run:** browser `Plan08dResultsTest.php`, `Plan08cSurveysTest.php`; group gate; G-visual-8.

**Commit:** `feat(retro-surveys): surveys in the completed results`

## Lane P — Group 3, poker

Brief: `18e-briefs/03-poker.md`. The saved decks dialog is done (1.2); the brief's commit 3.4 is dropped.

### Task 3.1a: Room on the table model — shell, table, dock, queue

**Read first:** brief 03 §3 rows 1–10, 14, 20–26, 32–52; §4 (containers and adapters); §9.

**Files:**
- Create in `resources/js/components/poker/`: `poker-room.tsx`, `room-topbar.tsx`, `room-table.tsx`, `story-card.tsx`, `task-queue.tsx`, `task-row.tsx`, `room-dock.tsx`, `room-cursors.tsx`, `room-reactions.tsx`, `room-gone.tsx`, `lib/poker/room-adapters.ts` with its test; `tests/Browser/Walkthroughs/Plan18ePokerTest.php`, `tests/Browser/Visual/PokerPagesVisualTest.php`
- Rewrite: `resources/js/pages/poker/show.tsx`
- Delete: the old view files of `components/poker/` replaced by the above (`game.tsx`, `game-header.tsx`, `players-grid.tsx`, `poker-card.tsx`, `hand.tsx`, `tasks-pane.tsx`, `task-detail.tsx`, `facilitator-toolbar.tsx`, `result-panel.tsx`, `anonymous-values-row.tsx`, `round-history.tsx`, `round-timer-control.tsx`, `spectator-toggle.tsx`, `take-control-button.tsx`, `game-cursors.tsx`, `game-reactions.tsx`, `game-gone.tsx` and their private helpers). Kept: `game-context.tsx`, `auto-reveal-triggers.tsx` (logic only), and until 3.1b / 3.1c the dialogs and the import files, mounted from the new room.

**Interfaces:**
- Consumes: `SessionShell`, `SessionTitle`, `SessionPresence`, `SessionTimer` (`presets=[{seconds:30},{seconds:60},{seconds:120},{seconds:180}]`, `onCustom`), `CursorToggle`, `LiveCursors`, `SessionReactions` (`variant="inline"`), `PokerTable`, `PokerDeck selection="toggle"`, `PokerRounds`, `VoteDrawer`, `usePokerGame`, `GameProvider`.
- Produces: `seatsFrom(snapshot, onlineIds): PokerSeat[]`, `storyFrom(task)`, `nextUnestimatedTask` (kept) in `lib/poker/room-adapters.ts`.

**Browser tests changed:**
- `Plan10bPokerAdditionsTest.php:833`: `assertAttribute('[role="timer"]', 'aria-label', "Time's up!")` (Task 0.5).
- `P10b-11`: the second press uses the banner's "Join the vote" (the "Watch only" switch keeps its label when on) — imposed by ScreenPokerQueue (observer banner), 3-D9. Confirm by reading the test before editing.
- Unchanged and checked: `[aria-label="Play 5"]`, `[aria-label="Your cards"]`, `[role="img"][aria-label="Bob: Voted"]`, `section[aria-label="Players"]` (no "5", "8" or task key before the reveal — task titles and "n of m voted" live in that section: see notes-for-18e), `click('Show votes')`, "Re-vote", `[aria-label="Estimate"]`, "Save estimate", "Next task", "Estimate: 5", `[data-test="poker-task-row"]`, `#poker-tasks`, "Hide tasks" / "Show tasks", `[aria-label="Drag to reorder"]`, the `ol li` order of `Smoke/KeyboardDragTest.php` (the queue is the first `ol` of the page: check `PokerRounds` and `PokerTable` markup), `[aria-label="Timer"]`, "30 s", `#poker-timer-minutes`, `.lc-overlay`, `[role="toolbar"][aria-label="Reactions"]`, "You're watching — switch to Play to vote", "Reconnecting…", "This game was deleted.", `[data-realtime]`.

**New tests:** `[P18e-03-01]` at 390 the queue drawer opens and a vote goes through the vote drawer; `[P18e-03-02]` "Join the vote" brings the deck back; `[P18e-03-03]` "Hide tasks" collapses `#poker-tasks` (`aria-pressed`); `[P18e-03-04]` the reaction bar sits above the deck with no overlap, and the page has one `[data-realtime]` (Review Focus 2). Vitest: `seatsFrom` (offline voter kept, offline non-voter dropped, spectator who voted before a named reveal is `voted`).

**Run:** browser `Plan10aPokerCoreTest.php`, `Plan10bPokerAdditionsTest.php`, `Smoke/KeyboardDragTest.php`, `Smoke/RealtimeTest.php`, `Smoke/QueuedBroadcastTest.php`, `Plan18ePokerTest.php`.

**Commit:** `feat(poker): room on the table model`

### Task 3.1b: Room dialogs

**Read first:** brief 03 §3 rows 11–13, 15–19; D3, D4.

**Files:** create `components/poker/room-dialogs.tsx` (settings, share and guest link, hand-over, end, delete, task form, custom timer); delete `game-settings-dialog.tsx`, `game-share-dialog.tsx`, `game-guest-link-dialog.tsx`, `transfer-dialog.tsx`, `delete-game-dialog.tsx`, `task-form-dialog.tsx`, `game-menu.tsx`, and `components/poker/deck-fields.tsx` (its last consumer).

**Interfaces — consumes:** `SessionSettingsContent` with poker groups (ids `poker-auto-reveal`, `poker-anonymous-votes`, `poker-cursors`, `poker-reactions`), `DeckPicker` + `DeckEditor idPrefix="deck-custom"`, `lib/poker/deck-payload.ts` (1.2), `ShareDialog guestSwitchId="poker-guest-link-access"` (0.12), `FormDialog`, `ConfirmDialog`, `delivery-lines`.

**Browser tests changed** (imposed by `ShareDialog/README.md` and `DeckPicker/README.md`): `P10a-14`: "Create a new link" asks for confirmation (one more press). `P10b-02c`, `P10b-16`: the heading "Your team's decks" becomes the picker's "Saved" group — confirm the picker's label in `deck-picker.tsx` before editing. Unchanged and checked: `#poker-guest-link-access`, `input[aria-label="Guest link"]`, `#poker-task-title`, `[aria-label="Facilitator menu"]` and its seven items, "End this game?", `[role="dialog"] button:has-text("End game")`, `#deck-custom-cards`, "Game settings".

**Run:** browser `Plan10aPokerCoreTest.php`, `Plan10bPokerAdditionsTest.php`, `Plan12bIntegrationsSharingTest.php`.

**Commit:** `feat(poker): room dialogs on the new primitives`

### Task 3.1c: Import, source details, sync and conflict

**Read first:** brief 03 §3 rows 27–31.

**Files:** rewrite in place `components/poker/import-tasks-dialog.tsx` (logic copied unchanged: 300 ms debounce, stale guards); create `task-source.tsx`, `estimate-conflict.tsx` (new bodies); delete `task-source-chip.tsx`, `task-source-details.tsx`, the old `estimate-conflict.tsx` body.

**Browser tests changed:** none. Checked: `[aria-label="Source"]`, `[aria-label="Choose a board"]` / "a sprint" / "a team", "Show issues", "Import 2 tasks", "2 imported, 0 skipped.", `[aria-label="More task actions"]`, "Refresh from Jira", "Sync again", "Synced to Jira", "Sync pending", "Changed in Jira to 8", "Keep skrum estimate".

**Run:** browser `Plan12cPokerTrackersTest.php`, `Plan14cTrackersTest.php`, `Plan14dStatusSyncTest.php`.

**Commit:** `feat(poker): task import, source details and estimate conflict`

### Task 3.2: Guest join

**Read first:** brief 03 §3 rows 53–54; brief 11 §3 row 33.

**Files:** rewrite `resources/js/pages/poker/join.tsx`; add `poker/join` to `page-layouts.ts`.

**Interfaces — consumes:** `GuestJoinPage` (`kind="poker"`, `invalidTitle={t('Join a planning poker game')}`, `extraFields={['spectator']}`, children = `<Checkbox id="spectator" name="spectator" value="1">` with the label "Join as spectator").

**Browser tests changed** (imposed by `GuestJoin/README.md`: heading "Join as a guest", label "Your nickname"): `Plan10aPokerCoreTest.php:255-256` — "Choose the name other players will see." and "Display name" → "Join as a guest" and "Your nickname"; "Sprint 12 estimates" and "Join as spectator" stay. Unchanged: `#spectator` and its `aria-checked` (`Plan10b:50-53, 226-229`), `joinAsGuest`, "This guest link is no longer valid." (`Plan10a:628`).

**Run:** browser `Plan10aPokerCoreTest.php`, `Plan10bPokerAdditionsTest.php`.

**Commit:** `feat(poker): guest join on GuestJoin`

### Task 3.3: Estimation history

**Read first:** brief 03 §3 rows 55–60.

**Files:** create `components/poker/estimation-history.tsx`; rewrite `resources/js/pages/poker/estimates.tsx` (under `AppLayout active="sessions"`, breadcrumbs team › Estimation history); add `poker/estimates` to `page-layouts.ts`.

**Interfaces — consumes:** `Table`, `Pagination`, `Select`, `PokerRounds open players`, `EmptyState`.

**Browser tests changed:** none. Checked (`P10a-15`): `button[aria-label="Game"]`, `input[aria-label="Search tasks"]`, `click('Search')`, `[aria-label="Show rounds"]`, "Round 1", "Ada Facilitator: 5", "5 × 2", "Average: 5.5", "Consensus", `[aria-label="Pagination"]`, "No estimated tasks yet.".

**New tests:** `[P18e-03-05]` a row shows the voters count and a warning badge when re-voted; captures of the room (before and after reveal, observer) and of the history in `PokerPagesVisualTest.php`.

**Run:** browser `Plan10aPokerCoreTest.php`, `Visual/PokerPagesVisualTest.php`; group gate; G-visual-3.

**Commit:** `feat(poker): estimation history`

## Lane T — Group 4, team page, then Group 5, action items

### Task 4.1: Team page on the new layout — sessions, members, settings

**Read first:** brief 04 §1 (anchors), §3 rows 1–23, 32–41, §4, §8; decisions 4-D2 to 4-D6.

**Files:**
- Create in `resources/js/components/teams/`: `team-page.tsx`, `team-header.tsx`, `team-create-tiles.tsx`, `team-retros-section.tsx`, `team-poker-section.tsx`, `team-whiteboards-section.tsx`, `team-members-card.tsx`, `team-settings-card.tsx` and their Vitest files; `resources/js/pages/dev/sections/team.tsx`; `tests/Browser/Walkthroughs/Plan18eTeamPageTest.php`, `tests/Browser/Visual/TeamPageVisualTest.php`
- Rewrite: `resources/js/pages/teams/show.tsx` (`AppLayout` with `active` from the URL hash: `sessions`, `mood`, `members`, default `dashboard`; breadcrumbs workspace › Teams › team); add `teams/show` to `page-layouts.ts`
- Delete: `components/teams/poker-games-section.tsx`, `whiteboards-section.tsx`

**Interfaces — consumes:** `NewSessionDialog` (three instances, `defaultType` per trigger; the tiles are named "Start a retrospective", "New poker game", "Start a whiteboard" so each existing text click keeps one match, 4-D2), the saved decks and whiteboard templates dialogs of group 1 (mounted, not edited), `SessionCard`, `EmptyState`, `ConfirmDialog` (promise wrapper around `router.delete`), `AvatarStack`, `formatPoints`.

**Browser tests changed** (imposed by `Sidebar/README.md`: Dashboard, Sessions, Actions, Mood & ROTI, Games, Members, Templates, All teams; the page now sits under that sidebar):
- `Plan09bActionItemsAdditionsTest.php:216-221` (`P09b-02a`): the expected sidebar entries string and the `$sidebarTeams` selector ("All teams"). Only these lines; the rest of the test belongs to 5.2.
- `Plan12aIntegrationsFoundationTest.php` `P12a-01b`, `01c`, `Plan13aGamesFoundationTest.php` `P13a-01`, `Plan14bOutgoingWebhooksTest.php` `P14b-07`: `a[href$="/games"]` and `a[href$="/integrations"]` scoped to `main` (the sidebar carries the same links).
- Unchanged and checked: `a:has-text("Open action items (1)")`, "No retrospectives yet." before "Planning poker" in the page text, `click('New retrospective')`, `click('New game')`, `button:text-is("New whiteboard")`, `click('Estimation history')`, `click('Saved decks')`, `button:text-is("Whiteboard templates")`, "3 tasks · 1 estimated · 5 points" in one text node, "Last activity", `a[href="/whiteboards/{id}"]` containing "Facilitated by …", `button[aria-label="Delete Sprint board"]`, `[role="dialog"] button:text-is("Delete this board")`, "No games yet.", "No whiteboards yet.".

**New tests:** `[P18e-04-01]` the sidebar entries Sessions, Mood & ROTI and Members land on `#sessions`, `#mood`, `#members` and `aria-current` follows; `[P18e-04-03]` a retro card shows its phase and links to the retro; `[P18e-04-04]` active and ended games, the row becomes a card at 390; `[P18e-04-05]` rename by a manager, no control for a member; `[P18e-04-06]` delete team, add and remove a member; `[P18e-04-07]` a member of a workspace that has no team reaches the workspace page and the sidebar renders (Review Focus 5).

**Run:** browser `Plan04`, `Plan09bActionItemsAdditionsTest.php`, `Plan10aPokerCoreTest.php`, `Plan10bPokerAdditionsTest.php`, `Plan12aIntegrationsFoundationTest.php`, `Plan13aGamesFoundationTest.php`, `Plan14bOutgoingWebhooksTest.php`, `Plan17aWhiteboardCoreTest.php`, `Plan17bWhiteboardTemplatesTest.php`, `Plan18eTeamPageTest.php`, `Visual/TeamPageVisualTest.php`.

**Commit:** `feat(team): team page on the new layout, sessions and members`

### Task 4.2: Health check card on the new manager

**Read first:** brief 04 §3 rows 24–31; risk R5.

**Files:** create `components/teams/team-health-card.tsx` (section `id="mood"`); delete `components/teams/health-statements-section.tsx`.

**Interfaces — consumes:** `HealthStatementsManager` (`onReorder`, `onAdd`, `onEdit`, `onArchive`, `onRestore`, `addErrors`, `editErrors`, `error`), the five `TeamHealthStatement*` Wayfinder controllers.

**Browser tests changed:** `Plan08bHealthCheckTest.php` `P08b-01a`: the drag announcement `'Moved Interaction to position 2.'` becomes the manager's wording (read `health-check-manager.tsx` around lines 590–615 for the exact sentence) — imposed by `HealthCheck/README.md` (the manager owns its announcements). Unchanged and checked: `[aria-label="Drag to reorder"]`, `[aria-label="Statement"]`, `[aria-label="Axis label"]`, `button:has-text("Add statement")`, `input[name="text"]`, "Edit", "Save", "Archive", "Archived (1)", "Restore", "Statement added.". If the manager's edit input has no `name="text"`, the component takes it.

**Run:** browser `Plan08bHealthCheckTest.php`, `Plan18eTeamPageTest.php`; group gate; G-visual-4.

**Commit:** `feat(team): health check card on the new manager`

### Task 5.2: Action items page on the new table, sheet and filters (needs R12 and 4.1)

Brief: `18e-briefs/05-action-items.md`. Its commit 5.1 is Task R8b.

**Read first:** brief 05 §1 (prop collision), §3 all rows, §4, §5, §8.

**Files:**
- Back end: `app/Http/Controllers/WorkspaceActionItemsController.php:63` (`'filterTeams'`), `tests/Feature/ActionItems/ActionItemsPageTest.php:166-167`
- Create in `resources/js/components/action-items/`: `action-items-table.tsx`, `action-items-list.tsx`, `action-item-filters.tsx`, `action-item-filters-drawer.tsx`, `action-item-sheet.tsx`, `action-item-create-dialog.tsx`, `use-action-items-realtime.ts`, `use-action-item-filters.ts` and their Vitest files; `tests/Browser/Walkthroughs/Plan18eActionItemsTest.php`
- Rewrite: `resources/js/pages/action-items/index.tsx` (`AppLayout active="actions"`; the page root carries `data-realtime`); add `action-items/index` to `page-layouts.ts`
- Delete: the twelve old files of `components/action-items/` (`action-item-card`, `action-item-comments`, `action-item-form`, `anonymous-notice`, `assignee-select`, `due-date-chip`, `export-action-item-button`, `export-action-item-dialog`, `external-link-chips`, `priority-select`, `recurrence-select`, `subtask-checklist`) after `grep -rnE "components/action-items/(action-item-card|action-item-form|…)" resources/js` finds no importer

**Interfaces — consumes:** R8b files; `ActionItem`, `ActionSheet`, `Table`, `Pagination`, `Popover` + `Command`, `Drawer`, `EmptyState`. The feature test is written first: `->where('filterTeams.0.name', 'Alpha')`, and the shared `teams` keeps `{ id, name }` only.

**Browser tests changed** (imposed by ScreenActions: a table with a filter toolbar, details in a side sheet):
- `Plan09bActionItemsAdditionsTest.php` helper `p09bFilter`: `div.grid > [aria-label=…]` → `[role="toolbar"][aria-label="Filters"] [aria-label=…]`.
- `P09b-02b`: `li[id^="action-item-"]` → `tr[id^="action-item-"]`; the expanded comments are in the open sheet.
- `P09b-02c`, `04`, `05`, `06b`: open the sheet (click the row title) and scope the assignee, sub-task, due-date and repeat selectors to `[data-slot="action-sheet"]`; `[aria-label="1 of 3 sub-tasks done"]` is read as the sheet's text.
- Unchanged and checked: `#action-item-{id}`, `[aria-label="Status"]`, `[aria-label="Assignee"]`, `[aria-label="Team"]`, "Mark as done", "Reopen", "Edit action item", "Delete action item", `#action-item-{id} [aria-label="Export to Jira"]` on the row (`P12d-06`), `section:has-text("Linked action item")`, "No open action items.", "Nothing matches these filters.", "Follow-ups of every team you can see", "Added outside a retro", "Due …", "Repeats weekly", "Carol Guest (guest)", `nav[aria-label="Pagination"]`, the `localStorage` key `skrum.actionItemFilters.{workspace.id}`, `[data-realtime]`.

Before editing, confirm in `action-sheet.tsx` (around lines 480–720) that the due date is a native input that `fill()` can type into and that Repeat is disabled without a due date; if not, the component is fixed in its own commit and groups 2 and 4 are told.

**New tests:** `[P18e-05-01]` table columns, overdue row, Previous / Next with 51 items; `[P18e-05-02]` filters toolbar, "Overdue" shortcut, Reset clears the query and the storage; `[P18e-05-03]` a row opens the sheet, edits save, Escape returns focus to the row; `[P18e-05-04]` at 390: the list, the filters drawer, a status change; `[P18e-05-05]` two browsers: a change at A shows at B; an item deleted at A while B's sheet is open shows "This action item was deleted."; `[P18e-05-06]` `?item=` of an item outside the page opens the sheet under "Linked action item"; one `[data-realtime]` on the page.

**Run:** `vendor/bin/sail artisan test --compact tests/Feature/ActionItems`; Pint; browser `Plan09aActionItemsCoreTest.php`, `Plan09bActionItemsAdditionsTest.php`, `Plan12dActionItemExportTest.php`, `Plan14cTrackersTest.php`, `Plan14dStatusSyncTest.php`, `Plan18eActionItemsTest.php`.

**Commit:** `feat(action-items): action items page on the new table, sheet and filters`

### Task 5.3: Bench section and captures of the action items page

**Files:** create `resources/js/pages/dev/sections/actions-index.tsx` (rows, empty, loading, overdue, sheet open), `tests/Browser/Visual/ActionsPageVisualTest.php`.

**Run:** the visual test; group gate; G-visual-5.

**Commit:** `test(action-items): dev section and visual captures`

## Lane G — Group 6, games

Brief: `18e-briefs/06-games.md`. G1 and G2 are independent; G3 → G4 → G5; G6 runs on lane S after S2.

### Task G1: Team games page

**Read first:** brief 06 §3 rows 1–12, §4.1; brief 01 §3 rows 47–52 (the "New room" dialog; K9); risk R6.

**Files:** create `components/games/team-games.tsx`, its test, `tests/Browser/Walkthroughs/Plan18eGamesTest.php`, `tests/Browser/Visual/GamesPagesVisualTest.php`; rewrite `resources/js/pages/games/index.tsx` (`AppLayout active="games"`); add `games/index` to `page-layouts.ts`; delete `components/games/new-room-dialog.tsx`, `room-card.tsx`, `team-leaderboard.tsx`.

**Interfaces — consumes:** `GamesLeaderboard` (rooms, leaderboard with the podium streak of 0.10, embedded `NewGameRoomDialog` with ids `new-room-name`, `new-room-game`, `new-room-access`; `onCreate` resolves `false` on a server error so the dialog stays open). Search the Inertia v3 docs for the error state of a deferred prop before choosing between `leaderboardError` and rendering `Leaderboard` inside `<Deferred>`.

**Browser tests changed** (imposed by `GamesLeaderboard/README.md`: podium for the first three, tabs for the period): `Plan13dIcebreakerScoresInvitesTest.php` `P13d-09a`, `10a`, `10b` — `section[aria-labelledby="team-leaderboard"] ol > li …` → `[data-slot="podium-place"]` / `[data-slot="leaderboard-row"]`; `[data-state="on"]` → `[data-state="active"]`. Unchanged: "New room", `#new-room-*`, "Create room", "Back to the team", "No game rooms yet.", "No games played yet.", `[aria-label="Period"]`, "Last 30 days", "All time", "2-week streak".

**New tests:** `[P18e-06-01]` podium with a streak on a top-three player and the current user marked; `[P18e-06-02]` room links and order.

**Commit:** `feat(games): team games page`

### Task G2: Guest join

**Read first:** brief 06 §3 rows 13–15; brief 11 §3 row 34 (K4).

**Files:** rewrite `resources/js/pages/games/join.tsx`; add `games/join` to `page-layouts.ts`.

**Interfaces — consumes:** `GuestJoinPage` (`kind="game"`, `invalidTitle={t('Join a game')}`, `session={{ title: roomName ?? t('Join a game'), gameLabel }}`, `suggestedName` prefilled).

**Browser tests changed** (imposed by `GuestJoin/README.md`): `Plan13aGamesFoundationTest.php:143-144` and `Plan13dIcebreakerScoresInvitesTest.php:444,672` — the sentence "You are invited to play Hangman. Choose the name other players will see." and "Display name" → the game name "Hangman" in the session card and "Your nickname". `$guest->value('#name')` (the random name) is unchanged with the default 6-D9.

**New tests:** `[P18e-06-03]` an invalid link shows the notice with HTTP 404.

**Commit:** `feat(games): guest join`

### Task G3: Room shell and hangman

**Read first:** brief 06 §3 rows 16–43, 55–56, §4.3; R4, R7, R9; decisions 6-D1, 6-D3, 6-D4, 6-D7, 6-D8.

**Files:** create in `components/games/`: `game-room.tsx` (new body), `game-layout.tsx`, room header, menu, settings / delete / reset dialogs, sidebar with `player-row.tsx` and scores, end card, start controls, leader picker, pass button, history sheet, round detail, `room-full.tsx`, `room-gone.tsx`, `hangman-board.tsx`, `hangman-figure.tsx`, `word-mask.tsx`, `letter-keyboard.tsx` (new bodies), Vitest for `player-row` and the keyboard layouts; rewrite `resources/js/pages/games/show.tsx`. Delete the 28 old files the brief lists for G3. Kept: `room-context.tsx`.

**Interfaces — consumes:** `SessionShell`, `SessionTitle` (`badges` = the game badge), `SessionPresence`, `SessionTimer` (`alarm={false}`, `presets` 1, 2, 3, 5, 10 minutes, host only), `TimeUpBadge` (in `<main>`, next to the stage title), `IcebreakerGameGrid` / `IcebreakerGameCard`, `Sheet`, `FormDialog`, `ConfirmDialog`, `EmptyState`, `post-link-section`; `useGameRoom(initial, { subscribe: true })`. No reaction bar (6-D3).
- Produces: `GameLayout({ left, stage, right })` — the three-column grid without a topbar, reused by G6.

**Browser tests changed:**
- Game choice (6-D1): `[aria-label="Game"]` + `[role="option"]:has-text("Hangman")` → `[role="radiogroup"][aria-label="Choose an icebreaker"] [role="radio"]:has-text("Hangman")` in `P13a-01`, `P13a-06`, `P13b-01`, `P13b-02`, `P13c-01` — imposed by ScreenIcebreaker (left column of game cards). The icebreaker tests `P13d-06a/b/c` change in G6.
- A test that binds `header > h1` changes to `header h1` (the session frame wraps the title; ScreenIcebreakerDraw standalone frame).
- Unchanged and checked: `main [data-slot="badge"]` with "Time's up" (`Plan13a:360,390`), `[role="group"][aria-label="2 online"]`, `[aria-label="Timer"]`, `[role="menuitem"]:text-is("1 min")`, "Stop timer", `[aria-label="Copy guest link"]`, `[aria-label="Room menu"]`, `#room-name`, `#room-access`, "History", "Last rounds", `section[aria-labelledby="game-players"]`, `[role="tab"]:has-text("Scores")`, `[aria-label="6 points"]`, "Ready to play?", "Start", "Next round", `button[aria-label="Who draws?"]`, `ul[aria-label="Points of this round"]`, `[role="group"][aria-label="Letters"] button:has-text("t")`, `[aria-label="1 of 6 misses"]`, `ul[aria-label="Last letters"]`, "This room is full.", "This room was deleted.", `[data-realtime]`.

**New tests:** `[P18e-06-04]` the host picks a game from the cards, a non-host sees a badge, an unavailable game shows its reason; `[P18e-06-05]` the hangman keyboard follows the locale and works at 390; one `[data-realtime]` on the page and the expired banner (Review Focus 2).

**Run:** browser `Plan13aGamesFoundationTest.php`, `Plan13bDrawAndDecodedTest.php`, `Plan13cSprintGifTest.php` (the two later boards still run on old files inside the new shell), `Plan18eGamesTest.php`.

**Commit:** `feat(games): room shell and hangman`

### Task G4: Draw & Guess and Decoded

**Read first:** brief 06 §3 rows 44–48, §4.4; R3, R5.

**Files:** new bodies for `draw-board.tsx`, `drawing-toolbar.tsx`, `guess-chat.tsx`, `hint-button.tsx`, `leader-word.tsx`, `decoded-board.tsx`, `clue-editor.tsx`; rewrite in place with the same exports `drawing-canvas.tsx`, `clue-row.tsx` (the retro results import them).

**Interfaces — consumes:** `use-stroke-whispers`, `use-secret-word`, `lib/games/drawing.ts` (the six server colours stay data; the swatch of a colour is a token class, the stroke is the fixed palette), `EmojiPicker`.

**Browser tests changed:** none. Checked: `canvas[aria-label="Your drawing"]`, `canvas[aria-label="The drawing"]`, `[role="toolbar"][aria-label="Drawing tools"]`, `[aria-label="Red"]` with `aria-pressed`, `[aria-label="Fill"]`, `[aria-label="Undo"]`, "Clear" → "Click again to clear", the pixel assertions `'23 23 23 255'` and `'255 255 255 255'`, `section[aria-labelledby="game-guesses"]`, `input[aria-label="Your guess"]`, "Very close!", `button:has-text("Reveal a letter (2 left)")`, `[aria-label="Add an emoji"]`, `[aria-label="Remove 🚀"]`, `[role="img"][aria-label="Clue: 🚀 🌕"]`.

**New tests:** `[P18e-06-06]` the colour popover of the drawing toolbar at phone width.

**Run:** browser `Plan13bDrawAndDecodedTest.php`, `Plan13dIcebreakerScoresInvitesTest.php` (round replay in the retro results).

**Commit:** `feat(games): draw & guess and decoded`

### Task G5: Sprint in one GIF

**Read first:** brief 06 §3 rows 49–54, §4.5.

**Files:** new bodies for `sprint-gif-board.tsx`, `gif-question-banner.tsx`, `gif-answer-stage.tsx`, `gif-voting-stage.tsx`, `gif-round-results.tsx`; delete `game-gif-picker.tsx`; `gif-tile.tsx` rewritten in place (same export).

**Interfaces — consumes:** `GifSearchDialog` (0.13; `search` = `GET games.gifs.index?q=`, `provider = round.gifProvider`, `selectedId = myAnswer?.gif.id`). No second GIF container.

**Browser tests changed:** none beyond 0.13. Checked: "Shuffle question", "Edit question", `[aria-label="Question"]`, "Choose a GIF", "Change GIF", "Remove GIF", `ul[aria-label="Answers"]`, "Reveal the GIFs", "Vote for your favourite GIF.", "1 of 2 voted", "Finish round", "Votes: 1", "+2", "Anonymous GIF".

**Run:** browser `Plan13cSprintGifTest.php`; `Visual/GamesPagesVisualTest.php`.

**Commit:** `feat(games): sprint in one GIF`

### Task G6: Icebreaker stage in the retro (lane S, after S2 and G5)

**Read first:** brief 06 §3 rows 57–63, §4.6.

**Files:** create `components/games/icebreaker-stage.tsx`; modify `components/retro/board.tsx` (import); delete `components/retro/icebreaker-stage.tsx`, `icebreaker-game.tsx`.

**Interfaces — consumes:** `GameLayout` (G3), `useGameRoom(snapshot, { subscribe: false })`, `subscribeGameEvents`, `useUnknownPlayerRefetch`, `useBoardSnapshotRefetch`, `withBoardTimer` (moved unchanged), `TimeUpBadge` inside `section[aria-label="Icebreaker game"]`.

**Browser tests changed:** `P13d-06a`, `06b`, `06c`: the game choice by cards, as in G3. Unchanged and checked: `section[aria-label="Icebreaker game"]` with "Time's up" (`Plan13d:305`), `[data-test^="retro-column-"]` count 0 during the icebreaker, no `[aria-label="Copy guest link"]` and no `[aria-label="Room menu"]`, `.lc-overlay`.

**Run:** browser `Plan13dIcebreakerScoresInvitesTest.php`, `Plan04RetroCoreTest.php`; group gate; G-visual-6.

**Commit:** `feat(games): icebreaker stage in the retro`

## Lane W — Group 7, whiteboard

Brief: `18e-briefs/07-whiteboard.md`.

### Task 7.1: Guest join

**Files:** rewrite `resources/js/pages/whiteboards/join.tsx`; add `whiteboards/join` to `page-layouts.ts`. **Consumes:** `GuestJoinPage` (`kind="whiteboard"`, `invalidTitle={t('Join a whiteboard')}`). The brief's `guest-join-form.tsx` is not written (K2).

**Browser tests changed:** none. Checked: `joinAsGuest`, "This guest link is no longer valid." (`Plan17a:374,426`), `assertNotPresent('#name')` (`Plan17a:375`). **New:** `[P18e-07-01]` the name is prefilled, "Join" works, an invalid link shows the notice.

**Commit:** `feat(whiteboard): guest join on GuestJoin`

### Task 7.2: Board chrome on the session shell

**Read first:** brief 07 §3 rows 1–5, 14–16, 30–43, 53, §4.1; R2, R3, R4, R9, R10.

**Files:** rewrite `components/whiteboard/board.tsx` (every hook and effect kept verbatim), `pages/whiteboards/show.tsx`; create `board-header.tsx`, `board-timer.tsx`, `board-facilitation.tsx`, `board-notices.tsx`, `board-share.tsx`, `board-gone.tsx`, `lib/whiteboard/presence-slot.ts`; rewrite `board-reactions.tsx`; modify `resources/css/app.css` (the three reaction rules of the Excalidraw block, on `[data-slot="reaction-bar"]`, offsets recomputed); delete `top-bar.tsx`, `status-bar.tsx`, `facilitator-bar.tsx`; `tests/Browser/Walkthroughs/Plan18eWhiteboardTest.php`, `tests/Browser/Visual/WhiteboardVisualTest.php`.

**Interfaces — consumes:** `SessionShell` (`rootRef` for `data-scene`, set by `setAttribute` in `onChange` as today), `SessionTitle`, `SessionPresence` (`presenceFor` from `presence-slot.ts`), `SessionTimer` (in the `start` slot of `FacilitatorBar` for the facilitator, in the header for the others, 7-D5), `FacilitatorBar` (toggles "Lock the board" / "Unlock the board", "Bring everyone to me"), `SessionReactions` (`toolbarProps={{ className: 'whiteboard-reactions' }}`, `shortcuts={false}`, `compact` on a phone), `ShareDialog`. The `.whiteboard-canvas` element keeps `data-facilitator` and a sized parent (`min-h-0 flex-1` chain down from `main`).

**Browser tests changed:** `Plan17cWhiteboardFacilitationTest.php:130,133,152` (`P17c-01c`): `assertAttribute('[role="timer"]', 'aria-label', "Time's up!")` (Task 0.5); the toast assertion stays. Unchanged and checked: `[role="toolbar"][aria-label="Facilitation tools"] [aria-label="Timer"]`, five menu items, `[aria-label="Lock the board"][aria-pressed="false"]`, `div[role="status"]:has-text("This board is locked.")`, "Resume", `.whiteboard-reactions[role="toolbar"][aria-label="Reactions"]`, `.lr-overlay` with the sender name, `[data-scene^="N:"]`, `[data-realtime="connected"]`, `a[aria-label="Back to the team"]`, `header img[data-presence-id][alt]`, "Reconnecting…", "This board was deleted.".

**New tests:** `[P18e-07-02]` header: back link, title, presence count, facilitation tools, Share opens the dialog with the guest link; `[P18e-07-04]` the reaction bar does not overlap Excalidraw's scroll-back button at 1440 and 390; one `[data-realtime]` (Review Focus 2). Vitest: `board-timer` is covered by 0.5; `presence-slot` hash; participant mapping.

**Run:** browser `Plan17aWhiteboardCoreTest.php`, `Plan17cWhiteboardFacilitationTest.php`, `Plan17dWhiteboardSecrecyTest.php`, `Smoke/WhiteboardHarnessTest.php`, `Plan18eWhiteboardTest.php`.

**Commit:** `feat(whiteboard): board chrome on the session frame`

### Task 7.3: Board menu and dialogs

**Read first:** brief 07 §3 rows 17–29, §4.2.

**Files:** rewrite `components/whiteboard/board-menu.tsx`; create `board-dialogs.tsx`; delete `hand-over-dialog.tsx`, `save-template-dialog.tsx`.

**Interfaces — consumes:** `FormDialog` (rename, save as template, hand over; with no candidate the hand-over dialog uses the no-submit state of 0.11 and shows "No one else can facilitate this board yet."), `ConfirmDialog` (delete).

**Browser tests changed:** none. Checked: `[aria-label="Board menu"]`, `[role="menuitemcheckbox"]:has-text("Hide my cursor")`, "Rename", "Take control", `#whiteboard-new-facilitator`, `[role="dialog"] button:text-is("Hand over")`, `[role="dialog"] button:text-is("Cancel")` (`P17c-05b`), "Duplicate this board", `[role="dialog"] input[maxlength="80"]`, `[maxlength="300"]`, "A template with this name already exists.", "Replace the guest link", "Copy the guest link", `[role="dialog"] button:text-is("Delete this board")`.

**Run:** browser `Plan17bWhiteboardTemplatesTest.php`, `Plan17cWhiteboardFacilitationTest.php`.

**Commit:** `feat(whiteboard): board menu and dialogs on the new primitives`

### Task 7.4: Eight-colour sticky notes and colour bar

**Read first:** brief 07 §3 rows 8–9, 54, §4.3; decisions 7-D1, 7-D3, 7-D4.

**Files:** rewrite `components/whiteboard/sticky-tool.tsx`; modify `board.tsx` (`initialData.appState`), `scene-export.tsx` (restyle), `lib/whiteboard/excalidraw.ts` (dead exports removed), `tests/Browser/Support/InteractsWithWhiteboards.php` (`addWhiteboardSticky`). `canvas-colors.tsx` is not written (7-D3 default: the bar lives in the sticky tool only).

**Interfaces — consumes:** `WhiteboardColorBar` (radiogroup "Fill colour", radios Sun … Moss), `POSTIT`, `postItAppState`, `CANVAS_LIGHT` (`lib/whiteboard/palette.ts`).

**Browser tests changed** (imposed by `ExcalidrawTheme/README.md` palette and `WhiteboardToolbar/README.md` colour bar): helper `addWhiteboardSticky` and its call sites in `Plan17a` (:89, :114, :116, :317, :447, :556, :560, :589), `Plan17c` (:213, :238, :262), `Plan17d` (:15): colour names Yellow → Sun, Blue → Sky, Green → Moss; the control is `button[aria-label="Sticky note"]` then `[role="radiogroup"][aria-label="Fill colour"] [role="radio"][aria-label="<Name>"]`. `P17a-02a` (:101) and `P17a-11` (:569): `'#fff3bf'` → `'#fdf1c2'`, and the stroke `#ddc362` (7-D4). Fixture colours written by the server (`Plan17a:231`, `Plan17c:439`, `Plan17b:92`) are unchanged.

**New tests:** `[P18e-07-05]` captures as a member, as a guest on a locked board, and of the join page.

**Run:** the four `Plan17*` files, `Smoke/WhiteboardHarnessTest.php`, `Visual/WhiteboardVisualTest.php`; group gate; G-visual-7.

**Commit:** `feat(whiteboard): eight-colour sticky notes and colour bar`

## Lane K — Group 9, workspace (needs R1)

Brief: `18e-briefs/09-workspace.md`.

### Task 9a: Workspace page and workspace creation

**Read first:** brief 09 §3 rows 1–10, §4; R4, R7.

**Files:** create in `resources/js/components/workspaces/`: `workspace-overview.tsx`, `team-tile.tsx`, `new-team-dialog.tsx`, `leave-workspace-dialog.tsx`, `create-workspace-form.tsx`, `use-router-action.ts` and their tests; rewrite `pages/workspaces/show.tsx`, `create.tsx` (`AppLayout active="teams"`); add both to `page-layouts.ts`; `pages/dev/sections/workspace.tsx`; `tests/Browser/Walkthroughs/Plan18eWorkspaceTest.php`, `tests/Browser/Visual/WorkspacePagesVisualTest.php`.

**Interfaces — produces:** `useRouterAction(): { run(visit: (options) => void): Promise<void>; error?: string }` (resolves on `onSuccess`, rejects on `onError`); `LeaveWorkspaceDialog({ open, onOpenChange, workspace })` (used again in 9b).

**Browser tests changed:** none (no browser test covers these two pages).

**New tests:** `[P18e-09-01]` a manager creates a team from the dialog and reaches the members page through "Invite people"; `[P18e-09-02]` leaving needs the typed name; the last owner sees "A workspace needs at least one owner."; `[P18e-09-03]` **a user with no workspace creates one from `workspaces/create`; the sidebar renders without a team** (Review Focus 5).

**Commit:** `feat(workspaces): workspace page and workspace creation`

### Task 9b: Members, roles and invitations

**Read first:** brief 09 §3 rows 11–20.

**Files:** create `members-table.tsx`, `invite-form.tsx`, `invitations-table.tsx`, `delete-workspace-section.tsx`; rewrite `pages/workspaces/members.tsx`; add to `page-layouts.ts`.

**Browser tests changed:** none. **New:** `[P18e-09-04]` role change, removal with confirmation, last-owner error, an admin sees no select on an owner; `[P18e-09-05]` invite, link shown when mail is not configured, Resend, Revoke, "Expired"; `[P18e-09-06]` the owner deletes the workspace with the typed name.

**Run:** `vendor/bin/sail artisan test --compact tests/Feature/Workspaces`; `Plan18eWorkspaceTest.php`.

**Commit:** `feat(workspaces): members, roles and invitations`

### Task 9c: Retro templates page with the template editor

**Read first:** brief 09 §3 rows 21–38; R3, R5.

**Files:** create `templates-gallery.tsx`, `template-editor-sheet.tsx`; rewrite `pages/workspaces/templates.tsx`; add to `page-layouts.ts`; modify `components/skrum/template-editor.tsx` (the delete description takes the existing sentence "Retrospectives created from it keep their columns.", 9-D7).

**Interfaces — consumes:** `TemplateEditor` (`ids` defaults `template-name`, `template-source`, `template-category`; `colors` = the eight colours of R1; `startFrom`, `onStartFrom`, `onDuplicate`, `onDelete`), `columnColorClass`.

**Browser tests changed** (imposed by `TemplateEditor/README.md` — column rows with a drag handle, "Column :position title", "Delete column “:title”", delete in the editor footer — and by ScreenWorkspace frame c — a grid of cards): `Plan08aFlowAndTemplatesTest.php` `P08a-07a`: `li:has-text("Team pulse")` → `[data-test="workspace-template-{id}"]`; `P08a-07b`: `[aria-label="Column title"]` → "Column 1 title" …, "Move down" → keyboard reorder on the handle (Space, ArrowDown, Space), `[aria-label="Remove column"]` and `fieldset > div:nth-of-type(n)` → "Delete column “…”", "Add column" → "Add a column"; `P08a-07d`: Edit → "Delete template" → `[role="alertdialog"]` → confirm. Unchanged: `#template-name`, `#template-source`, `#template-category`, `[role="dialog"] button[type="submit"]`, "Template saved.", "Template deleted.", "No workspace templates yet.", "New template".

**New tests:** `[P18e-09-07]` duplicate, edit, delete a template.

**Run:** `tests/Feature/Workspaces/WorkspaceTemplatesTest.php`; browser `Plan08aFlowAndTemplatesTest.php`, `Plan18eWorkspaceTest.php`, `Visual/WorkspacePagesVisualTest.php`; group gate; G-visual-9.

**Commit:** `feat(workspaces): retro templates page with the template editor`

## Lane A — Group 11, access

Brief: `18e-briefs/11-access.md`. Its commit 6 (join pages, session-ended) is done in R2, 3.2, G2 and 7.1. Each page renders `AuthLayout` (`@/layouts/skrum/auth-layout`) itself; the old `layouts/auth-layout.tsx` goes in F1.

### Task 11.1: Shared auth components

**Files:** create in `resources/js/components/auth/`: `password-field.tsx`, `sso-buttons.tsx`, `passkey-sign-in.tsx`, `auth-aside.tsx` and their tests; update `pages/dev/sections/auth.tsx`.

**Interfaces — produces** (10.1 and 10.2 use the first):

```ts
export function PasswordField(props: Omit<TextFieldProps, 'type' | 'suffix'> & { passwordrules?: string }): ReactElement; // toggle named "Show password" / "Hide password"
export function SsoButtons(props: { providers: SsoProviderOption[] }): ReactElement | null; // <a> links "Continue with :provider"
export function PasskeySignIn(props: { routes?: PasskeyRoutes; label?: string; loadingLabel?: string; separator?: string }): ReactElement | null; // null when WebAuthn is unsupported
export function AuthAside(): ReactElement; // decorative, aria-hidden and inert
```

**Browser tests changed:** none. **Commit:** `feat(auth): shared auth components`

### Task 11.2: Login and register

**Read first:** brief 11 §3 rows 1–14.

**Files:** create `login-form.tsx`, `register-form.tsx`; rewrite `pages/auth/login.tsx`, `register.tsx`; add to `page-layouts.ts`; delete `components/sso-buttons.tsx`; `tests/Browser/Walkthroughs/Plan18eAccessTest.php`, `tests/Browser/Visual/AccessPagesVisualTest.php`.

**Browser tests changed:** none. Checked (every walkthrough signs in through them): `#email`, `#password`, `@login-button`, name "Log in", `assertPathIsNot('/login')`; `#name`, `#password_confirmation`, `@register-user-button`.

**New tests:** `[P18e-11-01]` a wrong password shows the error under the field, not as a toast; `[P18e-11-02]` sign-in with "Remember me".

**Run:** `tests/Feature/Auth`; browser `Smoke/HarnessTest.php`, `Plan18dBrandingTest.php`, `Plan18eAccessTest.php`.

**Commit:** `feat(auth): login and register on the new design`

### Task 11.3: Forgot password, reset password, e-mail verification

**Read first:** brief 11 §3 rows 15–20. **Files:** three form containers, three pages rewritten, `page-layouts.ts`; delete `components/text-link.tsx`.

**Browser tests changed:** none. Checked: `@email-password-reset-link-button`, `@reset-password-button`, "Resend verification email", "Log out". **New:** `[P18e-11-04]` the forgot-password status alert.

**Commit:** `feat(auth): forgot password, reset password, e-mail verification`

### Task 11.4: Two-factor challenge and password confirmation

**Read first:** brief 11 §3 rows 21–25. **Files:** `two-factor-form.tsx`, `confirm-password-form.tsx`, two pages rewritten, `page-layouts.ts`; delete `components/passkey-verify.tsx`.

**Browser tests changed:** none. Checked: `/user/confirm-password`, `#password`, `@confirm-password-button` (`Plan11b:27-29`, `Plan18d:28-30`, `AdminPagesVisualTest:46-48`). **New:** `[P18e-11-03]` switching to a recovery code and back clears the field.

**Commit:** `feat(auth): two-factor challenge and password confirmation`

### Task 11.5: Accept-invitation card

**Read first:** brief 11 §3 rows 26–31. **Files:** `invitation-card.tsx`, `pages/invitations/show.tsx` rewritten (`AuthLayout variant="centered"`), `page-layouts.ts`.

**Interfaces — consumes:** `AccessNotice` (invalid, expired), the five states of the brief. The session `invitation_token` flow is server-side and untouched.

**Browser tests changed:** none. **New:** `[P18e-11-05]` logged out: Log in and Create an account; matching account accepts; another account sees Log out; expired and invalid notices.

**Commit:** `feat(invitations): accept-invitation card`

### Task 11.7: Custom error pages (B15)

**Read first:** brief 11 §7, §9 (first two risks); spec §9 B15 as amended (A9).

**Files:** modify `bootstrap/app.php` (`Inertia::handleExceptionsUsing`); create `resources/js/pages/errors/error.tsx`, `resources/js/components/auth/error-page.tsx` and its test, `tests/Feature/ErrorPagesTest.php`; add `errors/error` to `page-layouts.ts`.

**Feature tests (written first):** an HTML request to an unknown URL renders `errors/error` with status 404, for a guest and for a signed-in user; closed registration renders the 403 page; **a JSON request (`Accept: application/json`) to a live endpoint that answers 403, 404 or 410 keeps its JSON body and status**; an `X-Inertia` request gets the page; in debug mode a 500 is not intercepted; **the 500 page renders when the shared props cannot be built** (bind a failing `TeamResolver` and assert the response is the error page with status 500, in English) (Review Focus 3).

**Browser tests changed:** none. **New:** `[P18e-11-07]` an unknown URL shows "Error 404" and its action; a guest's action is "Log in".

**Run:** `vendor/bin/sail artisan test --parallel --processes=8 --compact` (131 files assert 403 and 404: all must stay green); Pint; browser `Plan18eAccessTest.php`, `Visual/AccessPagesVisualTest.php`; group gate; G-visual-11.

**Commit:** `feat(errors): custom 403/404/500/503 pages (B15)`

## Lane X — Group 10, settings (10.2 needs 11.1)

Brief: `18e-briefs/10-settings.md`. Shells mirror `components/admin/admin-shell.tsx`. Controls bound as `button[role="checkbox"]` inside a `<label>` stay a `Checkbox`: "Sync status", "Treat canceled as done", "I understand" (K24).

| Task | Read first (brief 10) | Files | Browser tests changed | Commit |
|---|---|---|---|---|
| **10.1** Shell and profile | §3.1 rows 1–9, §4 shells | create `components/settings/settings-shell.tsx`, `settings-card.tsx`, `profile-card.tsx`, `delete-account-card.tsx`; rewrite `pages/settings/profile.tsx` (keeps `AvatarStyleCard`); `page-layouts.ts`; delete `components/delete-user.tsx` (`layouts/settings/layout.tsx` is imported by `app.tsx` until F1) | none; checked `#name`, `#email`, `@update-profile-button`, `@delete-user-button`, `@confirm-delete-user-button`, `[data-slot="avatar-style-card"]` (`P18d-06`), `nav[aria-label="Settings"]` | `feat(settings): settings shell and profile` |
| **10.2** Security | rows 10–27 | create `components/settings/security/{password-card,two-factor-card,two-factor-setup,recovery-codes,passkeys-card}.tsx`; rewrite `pages/settings/security.tsx`; delete `manage-two-factor.tsx`, `two-factor-setup-modal.tsx`, `two-factor-recovery-codes.tsx`, `manage-passkeys.tsx`, `passkey-item.tsx`, `passkey-register.tsx`, `alert-error.tsx` | none; checked `#current_password`, `#password`, `#password_confirmation`, `@update-password-button` | `feat(settings): security (password, two-factor, passkeys)` |
| **10.3** Appearance and notifications | rows 28–34 | create `settings/appearance/{theme-picker,language-field}.tsx`, `settings/notifications-card.tsx`; rewrite the two pages; delete `appearance-tabs.tsx` | none; checked `#action-item-reminders-by-email`, `#action-item-reminders-in-app`, "Save", name "Language" | `feat(settings): appearance and notifications` |
| **10.4** API tokens | rows 35–52 (the rename is done, 0.9) | create `settings/api-tokens/{server-url,tokens-table,token-cards,create-token-dialog,new-token-panel,revoke-token-dialog}.tsx`; rewrite the page; delete the three old token dialogs | none (dialog kept, 10-D2); checked the whole of `Plan11bApiTokensTest.php`: `#mcp-url`, `#token-name`, `#scope-*`, `#token-team`, `#token-expiration`, `input[aria-label="API token"]`, `tbody tr`, `td:nth-child(2) [data-slot="badge"]` count 3, eight columns in the same order | `feat(settings): API tokens` |
| **10.5** Team settings shell, provider card, chat channels | rows 53–64 | create `components/integrations/team-settings-shell.tsx`, `provider-card.tsx`; rewrite in place Slack, Telegram, URL-channel, actions, disconnect dialog; rewrite `pages/teams/integrations.tsx`; delete `integration-card.tsx`, `integration-status-badge.tsx`, `integration-details.tsx` | none; checked `[data-test="integration-card-{provider}"]`, its first `[data-slot="badge"]` = the status, `[data-slot="card-title"]`, `a[href*="/connect"]`, "Connect Platform to the tools it already uses." | `feat(integrations): team settings shell, provider card and chat channels` |
| **10.6** Outgoing webhook and deliveries | rows 65–76 | rewrite in place the five `webhook-*` files | none; checked `[aria-label="Signing secret"]`, `[aria-label="Deliveries"]`, `#delivery-tab-request`, `#delivery-tab-response`, `#delivery-tabpanel` and their arrow-key roving, "Redeliver", "Rotate secret", "Re-enable" | `feat(integrations): outgoing webhook, deliveries and redelivery` |
| **10.7** Trackers | rows 77–88 | rewrite in place `jira-*`, `jira-data-center-*`, `jira-token-dialog`, `linear-integration`, `github-*`, `people-panel`, `account-picker-dialog`, `priorities-panel`, `status-sync-section`, `status-mapping-panel`, `story-points-field` | none; checked `label:has-text("Sync status") button[role="checkbox"]`, "Turn on status sync", `[aria-label="Complete to"]`, `[aria-label="Reopen to"]`, `[aria-label="Story points field"]`, `[aria-label="Copy Webhook URL"]`, "I understand" | `feat(integrations): trackers (Jira, Jira Data Center, Linear, GitHub) and their panels` |
| **10.8** Walkthrough, captures, bench | §8 | create `tests/Browser/Walkthroughs/Plan18eSettingsTest.php` (`[P18e-10-01]` … `[P18e-10-10]` as the brief lists; `-09` checks the sidebar team switcher on `/settings/api-tokens`), `tests/Browser/Visual/SettingsPagesVisualTest.php`, `pages/dev/sections/settings-*.tsx` | — | `test(settings): browser walkthrough, visual captures, dev bench` |

Each row follows the screen task procedure. Interfaces produced by 10.1 and used by 10.2–10.4: `SettingsShell({ active: 'profile' | 'security' | 'appearance' | 'notifications' | 'apiTokens'; children })` and `SettingsCard({ title, description?, footer?, tone?: 'default' | 'destructive', children })`; by 10.5 and used by 10.6–10.7: `TeamSettingsShell({ workspace, team, children })` and `ProviderCard({ provider, status, error?, details, actions, children })` whose first `Badge` is the status. Every page of the group is added to `page-layouts.ts` in its row (`settings/profile`, `settings/security`, `settings/appearance`, `settings/notifications`, `settings/api-tokens`, `teams/integrations`).

Run per row: Vitest of the new files; `tests/Feature/Settings`, `tests/Feature/Integrations`; browser `Plan11bApiTokensTest.php` (10.1, 10.4), `Plan18dBrandingTest.php` (10.1), `Plan12aIntegrationsFoundationTest.php` (10.5), `Plan14aTeamsMattermostTest.php`, `Plan14bOutgoingWebhooksTest.php`, `Plan15WebhookRedeliveryTest.php` (10.5, 10.6), `Plan12dActionItemExportTest.php`, `Plan14cTrackersTest.php`, `Plan14dStatusSyncTest.php` (10.7). Then the group gate and G-visual-10.

## Lane L — Group 12, landing (waits for gate G-landing)

### Task 12.1: Welcome page

**Read first:** brief 12 whole; decision 12-D1. The task below is option (b), the instance entry page. With (a) the mockup sections of brief 12 §4 are added, each claim of its §9 table confirmed by the owner first; with (c) the task is a redirect in `routes/web.php` and its feature test.

**Files:** create `resources/js/components/landing/landing-nav.tsx`, `landing-hero.tsx`, `landing-footer.tsx` and their tests; rewrite `resources/js/pages/welcome.tsx` (no layout; already in `ownLayoutPages`); `pages/dev/sections/landing.tsx`; `tests/Browser/Walkthroughs/Plan18eLandingTest.php`, `tests/Browser/Visual/LandingVisualTest.php`, `tests/Feature/WelcomePageTest.php`; remove the starter keys from the lang files after a grep.

**Interfaces — consumes:** `BrandLogo` with the `SkrumLogo` fallback, `brand` shared prop (`name`, logos, `poweredBy`), `canRegister`, `auth.user`, `LanguageSwitcher`, `login()`, `register()`, `dashboard()`.

**Browser tests changed:** none (no browser test visits `/`).

**New tests:** `[P18e-12-01]` a guest sees "Log in" and, in invite mode, no "Register"; `[P18e-12-02]` with open sign-up "Register" links to `/register`; `[P18e-12-03]` a signed-in user sees "Dashboard"; `[P18e-12-04]` a rebranded instance shows its name and logo, never the literal "Skrüm" outside the credit line; `[P18e-12-05]` at 390 no horizontal scroll. Feature: `canRegister` per sign-up mode.

**Commit:** `feat(landing): welcome page from the ScreenLanding mockup`

---

# Final tasks (after every lane is merged)

### Task F1: Shared deletions and the last old layouts

**Files:** every file of the row "Deleted only in F1" of the shared-files table; `resources/js/app.tsx`; `resources/js/lib/page-layouts.ts` and its test.

- [ ] **Step 1:** For each file of the list, `grep -rn "<import path>" resources/js` — delete it only when nothing imports it. A file that still has an importer is reported with the importer; it is not deleted and no importer is edited to make it deletable.
- [ ] **Step 2:** `page-layouts.test.ts` gains a last test, written first: every file under `resources/js/pages` (dev sections excluded) is in `ownLayoutPages` or matches a prefix. Run it; a missing page is a screen that was not rewritten: stop and report.
- [ ] **Step 3:** When that test passes, `app.tsx` becomes `layout: () => null`, the three old layout imports go, `page-layouts.ts` and its test are deleted, and so are `layouts/app-layout.tsx`, `layouts/app/`, `layouts/auth-layout.tsx`, `layouts/auth/`, `layouts/settings/`.
- [ ] **Step 4:** `npm run check`, `npm run types:check`, `npm run test`, `npm run build:front`.
- [ ] **Step 5:** Commit: `chore(front): remove the old shared components and layouts left by the screen rewrite`.

What F1 leaves to 18g: unused dependencies, `knip`, starter files that were never part of a screen, `OnboardingLayout` (unused), the rename of `LocksDiscussingRetro`.

### Task F2: Full gates

- [ ] `npm run check`, `npm run types:check`, `npm run test`, `npm run build:front`.
- [ ] `vendor/bin/sail artisan test --parallel --processes=8 --compact` (feature and Arch suites); Rector dry run reports nothing; `vendor/bin/pint --dirty --format agent` changes no file.
- [ ] `bin/test-browser` — green, including the visual tests (overflow check on every capture).
- [ ] The greps of spec §13 criterion 5 over `resources/js` and `resources/views`: no `bg-(red|blue|gray|zinc|neutral|slate)-`, no `text-white`, no `-\[[0-9.]+(px|rem)\]`. Each remaining hit is either one of the two documented exceptions or a defect to fix in a commit `fix(<scope>): …`.
- [ ] `grep -rn "sk-" resources/js resources/css` finds no design-system preview class (criterion 8).
- [ ] One whole-branch review (fresh reviewer, read-only), one fix wave, one scoped re-review.

### Task F3: Phase report

**Files:** create `docs/superpowers/research/front-rewrite/18e-report.md`, assembled from `18e-report/<group>.md`.

Content (spec §12): what is done, per group; the parity table "action in the old front end → control in the new one" per screen (spec §8 and criterion 2); every browser test that changed, with the mockup that imposed it (criterion 3); gaps with the mockups and why; back-end changes made (B1, B2, B3, B10, B15, B16) with their feature tests; code deleted; tokens or components found missing; decisions taken on the owner's behalf (every default of `18e-owner-decisions.md` that was not answered); what 18f and 18g need. Commit: `docs(front-rewrite): phase report of plan 18e`.

---

## Self-review

**Spec coverage.** §7 rows 1 to 12: groups 1 to 12 (row 10's Admin › Branding was 18d). §9: B1 → R10; B2 → R11; B3 → R12; B10 → R1; B15 → 11.7; B16 renames → 0.9 and 5.2. §8 parity list: each line is a parity row of a brief; step 4 of the procedure checks them and F3 publishes the tables. §11: Vitest, feature, browser and visual tests are named per task; §13 criterion 9 → `[P18e-02-01]`; criterion 12 → `[P18e-02-07]`; criteria 5 and 8 → F2. Not covered here by design: criterion 6 (`knip`) and 7 (starter kit) are 18g.

**Gaps found while assembling, and where they went.**
- The spec has no rule for the two new phases and no marker for B2 → amendment A1, A2; R10 and R11 wait.
- `components/session/` and "pages render their layout" contradict spec §6.1 → amendment A5; Task 0.2 waits.
- Five assertions read "Time's up!" inside `[role="timer"]`; two briefs listed the hook as preserved → Task 0.5 convention.
- `unavailableMessage` exists in `FormDialog` but does not satisfy `P17c-05b` → Task 0.11.
- Brief 05 states the default layout branch is the new `AppLayout`; it is the old one → Task 0.2 and the layout line of 5.2.
- The emoji picker the briefs name for the reaction bar is not the frimousse one → Task 0.6.

**Not verified by this plan's author** (each is a "read before editing" instruction in its task): the message shape and overlay class of `live-reactions` (0.6); the exact roles and names inside `GifPicker` (0.13); whether `HealthCheckForm` renders `ol > li` and the old names (R5); the announcement text of `HealthStatementsManager` (4.2); whether the due-date control of `ActionSheet` is a native input (5.2); the label of the saved group in `DeckPicker` (3.1b); the list of old poker view files (3.1a names them from the brief, the agent lists the folder); Inertia v3's handling of a failed deferred prop (G1) and of `handleExceptionsUsing` for non-Inertia HTML requests (11.7). Nothing was run.

**Type consistency.** `SessionShell`, `SessionTitle`, `SessionPresence`, `SessionTimer`, `TimeUpBadge`, `CursorToggle`, `useHideMyCursor`, `LiveCursors`, `SessionReactions`, `useFlyingReactions`, `GuestJoinPage`, `AccessNotice`, `GifSearchDialog`, `usesOwnLayout` / `ownLayoutPages` are named the same in Task 0 and in every later task. `idPrefix="deck-custom"` is used in 1.2 and 3.1b. `filterTeams` (5.2) and `teamGroups` (0.9) are the two prop names of amendment A8.

## Execution handoff

Plan saved as `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md` by Task 0.1. Execution is subagent-driven through the Workflow tool: one agent per task, a review after each, one writer in Step A, one worktree per lane in Step B. The owner reviews this plan, the decisions file and the amendment before Task 0.1.
