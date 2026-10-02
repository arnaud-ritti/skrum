# Front-end Rewrite — Screens (Plan 18e) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development to run this plan task by task (through the Workflow tool, as the project does). Steps use checkbox (`- [ ]`) syntax. Every agent reads **Global Constraints**, the procedure of its kind of task (**Screen task procedure** or **Back-end task procedure**) and its own task; a screen task also reads the brief section it names before anything else.

**Goal:** Every Inertia page is rebuilt in place from its mockup on the `ui/` and `skrum/` libraries under the new layouts, one commit per screen, faithful to the mockup, with no feature lost and the browser suite green.

**Architecture:** A page is thin: it renders its layout (directly or through the shell of its domain) and one container from `resources/js/components/<domain>/`. Containers wire the existing hooks, reducers and `lib/*` to presentational `skrum/` components. The four live session types (retro, poker, game room, whiteboard) share one session shell and the containers of `resources/js/components/session/`. The back end changes only where spec §9 says so: B1, B2, B3, B10, B15, the B16 prop renames, B17 to B32 and B36 to B45. Each back-end item is a task of its own, placed before the screen that needs it.

**Tech Stack:** Laravel 13, PHP 8.4, Pest 5 (feature, arch, browser), Inertia 3, React 19, Tailwind 4, vite-plus (Vitest), Wayfinder, Reverb, dnd-kit, frimousse, live-cursors, live-reactions, Excalidraw 0.18.1.

**Spec:** `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` as amended on 2026-10-02 — §4 to §13; rule 13 of §5; row 18e of §12; §9.1 (B1 matrix), §9.2 (B17 to B36) and §9.3 (B37 to B45); the four open points of §15. The amendment `18e-spec-amendment.md` is folded into the spec; that file is now a pointer.

**Research base (requirements of each screen task):** `docs/superpowers/research/front-rewrite/18e-briefs/01-session-creation.md` … `12-landing.md`. A brief holds the parity table (one row per action of the old front), the composition, the adapters, the realtime landing points, the mockup elements not rendered, the browser-test contract and the risks of its group. Also `notes-for-18e.md` (component interfaces as built in 18b+18c) in the same research folder. **The briefs were written before the owner's answers and before rule 13. Where a brief and this plan differ, this plan wins**; in particular a brief's section 6 ("Mockup elements not rendered") is replaced by the tables "Defaults flipped to the mockup" and "Deviations from the mockup" below.

**Owner decisions:** `docs/superpowers/research/front-rewrite/18e-owner-decisions.md`, answered on 2026-10-02 in two rounds (`owner-answers-2026-10-02.md`). The plan is written for the answers. After them the owner gave a standing rule, "the mockup must be faithfully respected" (spec §5 rule 13): every default the owner did not answer follows the mockup. A third round confirmed the reading of that rule and added "rewrite first, features after": what the server cannot feed is omitted here, its place is left, and it becomes a feature of a later plan (`docs/superpowers/research/front-rewrite/feature-roadmap.md`).

**Not in this plan:** ⌘K search, bell wiring, magic link, e-mail code, e-mails, the instance setting `sso_required` (B33), the user preferences `recap_emails` (B34) and `single_key_shortcuts` with the shortcuts `G`, `F`, `C`, `⇧R`, `⌘→` (B35), the global shortcut registry (18f); the security review of B31 (18f); `knip` clean-up, removal of unused dependencies, the three greps over the whole tree, and the rewrite of any old view component still imported at the end of this plan (18g); the Poll session type, the standalone survey and the health check as a survey template (plan 19); the rebuilt whiteboard toolbars (their own plan); any mockup element listed in spec §10 or in the "Deviations from the mockup" table, each of which is a row of the feature roadmap or stays backlog.

**Tasks:** 107 (the first version had 73). Step A (single writer): 43 — Task 0: 15; Group 1: 10; Group 2: 18. Step B (lanes): 61 — lane S: 2; lane P: 8; lane T: 10; lane G: 11 (G6 runs on lane S); lane W: 7; lane K: 5; lane A: 8; lane X: 9; lane L: 1. Final: 3. Of the 107, 30 are back-end tasks without a screen (1.0a to 1.0e, R2a, R2b, R2c, R12a, 3.0a to 3.0c, 4.0a to 4.0d, 5.0, G0a to G0e, 7.0, 7.0b, 9.0a, 9.0b, 10.0, 11.5a, 11.6, 12.1) and 5 carry both a back-end change and its screen (R1, R10, R11, 1.5, 11.7).

## Branch and run

- Precondition: plan 18d is committed, and so is the revision of the spec, of this plan and of the two research files made on 2026-10-02. `git status --short` on `plan-18d-branding` is empty.
- Branch `plan-18e-screens` from the head of `plan-18d-branding`. No merge into `main`, no push.
- Step A runs on `plan-18e-screens` with a single writer. Step B lanes run in separate git worktrees on branches `plan-18e-<lane>`, cut from the head of Step A; the controller merges one lane at a time into `plan-18e-screens` and runs the gates after each merge.

## Gates

The four spec gates of the first version of this plan are gone: the owner approved the amendment and answered the landing question.

| Gate | Condition | Stops |
|---|---|---|
| G-visual-<group> | Human visual review of the group's captures, side by side with the mockups (rule 13) | merge of the next group on the same lane; the phase report |
| G-deviations | The owner approved the reading behind the table "Deviations from the mockup" (third round). The gate now checks, at F2, that every difference found by step 7 of a screen has a row | the phase report (F3). A difference without a row is fixed, or becomes a row and a feature of the roadmap with the owner's word |
| G-open-points | The owner reads the four points of spec §15 (workspace decks, team games channel, "+2 min" maxima, the administrators' password form). The seventeen points of the first version are answered | nothing; an answer that differs from the choice made is a change request on 1.0e, G0d, the timer-extension tasks, or plan 18f |

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
13. **The mockup is the reference.** A screen follows its mockup faithfully: layout, placement, labels, component structure, states. The owner's written answers stand as written. Everything else follows the mockup; a browser test that contradicts the mockup changes, in the commit of its screen, and the plan lists it. When the mockup shows data that the server holds but does not expose, the prop or the route is added to §9 with a task; the element is not omitted. The only deviations allowed are: a statement that would be false or unsafe; the accessibility rules of this section; and data or a concept the product does not have at all. Each deviation is a row of the "Deviations from the mockup" table of this plan. Rewrite first, features after: an omitted element becomes a feature of a later plan, and the screen leaves its place. Each screen task ends with a side-by-side comparison of its captures with the mockup's `preview.html`, in light and dark, at 390 and 1440, and lists the differences that remain.

Two documented exceptions to rule 1, both canvas data and not theme (spec ruling 36): the drawing ink of Draw & Guess (`lib/games/drawing.ts`: black, the eight theme colours, the five legacy colours of old drawings, and the white eraser; pixel-tested) and the always-white paper of the whiteboard template preview (a named `@theme` token, decision 1-D5).

Contract and process:

- **The browser suite is a contract.** `data-test`, `data-realtime`, `data-presence-id`, element ids and English accessible names are preserved. A browser test changes only when a mockup (or the README of a design-system component) or an owner's answer imposes another label or structure, in the commit of that screen, and only if this plan lists it under the task's "Browser tests changed". An agent that finds an unlisted failing test stops and reports; it does not edit the test. When the failure comes from following the mockup, the controller adds the test to the task's list and the agent resumes.
- **No test is deleted** without the owner's approval. `tests/Browser/Support/InteractsWithBrowser.php` (`signIn`, `joinAsGuest`, `awaitRealtime`, `dragWithKeyboard`) is not edited by any task.
- **Exactly one `[data-realtime]` element per page** (`awaitRealtime` reads the first). It is emitted by `SessionShell` on live pages and by the page root on `action-items/index`. `ConnectionState` is never given its `realtime` prop.
- **Languages:** every new key in `lang/en.json`, `fr.json`, `es.json`, `de.json`, in the commit that uses it. Key = English text.
- **Back end:** only spec §9. Primary and foreign keys are UUIDs; migrations have an `up` method only; a new or changed write endpoint validates through a Form Request with array rules (the existing inline `validate()` calls of a controller are left as they are when the task only adds a field to them); authorisation through a policy and `Gate::authorize`, or through the guard class of the session type on live JSON endpoints; early returns, no `else`; Pint (`vendor/bin/pint --dirty --format agent`) and Rector clean; the Arch suite stays green; `php artisan wayfinder:generate` after a route change.
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

Every screen task (all tasks of Step A after Task 0, and all tasks of Step B, except the back-end tasks) follows these steps. The task text gives the specifics.

- [ ] **Step 1: Read.** The brief section named by the task (parity rows, composition, adapters, tests), the mockup README and `preview.html`, the old page and components about to be deleted, and the source of each `skrum/` component used (props are in the source, not in the README). List what the mockup shows on this screen; each element is built, or is a row of "Deviations from the mockup". An element that is neither is reported before any code is written.
- [ ] **Step 2: Failing tests first.** Write the Vitest files named by the task (adapters, container logic) and the new browser tests; run them and see them fail for the expected reason.
- [ ] **Step 3: Build** the containers and the thin page; the page renders its layout (see Task 0.2) and is added to `ownLayoutPages` in `resources/js/lib/page-layouts.ts`.
- [ ] **Step 3b: Leave the places.** The task's line "Places left" names the mockup elements of this screen that a later plan builds (feature roadmap). For each, the layout keeps its region: a named slot of the container (a prop of type `ReactNode`, undefined today), or an empty grid area, so that the later feature fills it without moving anything else. Nothing is rendered in it: no disabled control, no "coming soon". The slot's name is written in `18e-report/<group>.md` under "Places left".
- [ ] **Step 4: Parity check.** Walk the brief's parity table row by row against the running page; every row has its control. Copy the table, with a "done" column, into `docs/superpowers/research/front-rewrite/18e-report/<group>.md` (the phase report is assembled from these files).
- [ ] **Step 5: Edit the browser tests listed** under "Browser tests changed", and no other.
- [ ] **Step 6: Bench and captures.** Add `resources/js/pages/dev/sections/<name>.tsx` for composed surfaces and a visual test `tests/Browser/Visual/<Group>VisualTest.php` on the pattern of `AdminPagesVisualTest.php` (`captureVisuals`, light and dark, 390 and 1440, EN and FR, overflow check). Screenshots go to `tests/visual/__screenshots__/`.
- [ ] **Step 7: Compare with the mockup.** Open the mockup's `preview.html` and the captures side by side, in light and dark, at 390 and 1440. Fix what differs. Write the differences that remain in `18e-report/<group>.md` under "Differences with the mockup", each with the row of "Deviations from the mockup" that covers it; a difference without a row is reported to the controller, not left.
- [ ] **Step 8: Delete** the old files the task lists; `grep -rn "<file stem>" resources/js` must find no importer.
- [ ] **Step 9: Run** `npm run check`, `npm run types:check`, `npm run test`, the feature tests the task names, `npm run build:front`, then each browser file the task names with the single-file command. Rule greps on the files of the commit: `grep -nE "bg-(red|blue|gray|zinc|neutral|slate|amber|emerald)-|text-white|text-black|-\[[0-9.]+(px|rem)\]|#[0-9a-fA-F]{3,8}\b"` finds nothing (except the two documented exceptions).
- [ ] **Step 10: Commit** with the task's message and the attribution lines of the session.

At the end of each group: the controller runs `bin/test-browser` and the PHP suite, then shows the group's captures next to the mockups for the human visual review (gate G-visual). Review fixes are one more commit, `fix(<scope>): visual review of <group>`.

## Back-end task procedure

Every back-end task (ids `1.0a` to `1.0e`, `R2a`, `R2b`, `R2c`, `R12a`, `3.0a` to `3.0c`, `4.0a` to `4.0d`, `5.0`, `G0a` to `G0e`, `7.0`, `7.0b`, `9.0a`, `9.0b`, `10.0`, `11.5a`, `11.6`, `12.1`, and the back-end half of `R1`, `R10`, `R11`, `1.5`, `11.7`) follows these steps. It changes no screen: the prop or route it adds is consumed by the screen task named in its "Consumed by" line.

- [ ] **Step 1: Read** the spec item (§9.2 or §9.3) and its acceptance criterion in §13, then the controller, action, policy, model, factory and existing feature test the task names. Check sibling files for the convention.
- [ ] **Step 2: Failing feature test first** (Pest, `tests/Feature/<Domain>/…`, created with `vendor/bin/sail artisan make:test --pest <Name> --no-interaction`). One test per sentence of the acceptance criterion, plus the authorisation failures the task lists. Models come from factories. Run it; it fails for the expected reason.
- [ ] **Step 3: Migration** when the task has one: `vendor/bin/sail artisan make:migration <name> --no-interaction`; `up` only; UUID foreign keys; the model's `#[Fillable]`, casts, PHPDoc properties and factory follow.
- [ ] **Step 4: Implement.** A new action through `make:class`; a new controller through `make:controller`, with CRUD method names only; a new write endpoint validates through a Form Request (`make:request`, array rules); authorisation through the policy or the guard class named by the task. Props keep the camelCase keys of their page.
- [ ] **Step 5: Types.** Add the new props to the page's TypeScript types under `resources/js/types/` so that the screen task finds them; run `php artisan wayfinder:generate` after a route change. No component reads them yet.
- [ ] **Step 6: Run** the task's feature tests, then `vendor/bin/sail artisan test --parallel --processes=8 --compact`, `vendor/bin/pint --dirty --format agent`, `npm run types:check`.
- [ ] **Step 7: Commit** with the task's message and the attribution lines of the session.

## Review Focus

Failure modes the spec implies and that are most likely to reach a user. Each is pinned by a test in the task named.

1. **A retro that is open in `discussing`, or already has ROTI votes, when B1 and B2 are deployed** — it moves forward through Actions and ROTI, keeps its votes, and nobody loses the ability to tick an action item. Pinned in R10 and R11 (feature tests named there).
2. **A live page whose session expires or whose socket drops while two people are on it** — the content is inert, one `[data-realtime]` exists, the state returns to `connected` without a reload, nothing overlaps the reaction bar, and the banner says nothing false about unsent changes. Pinned in Task 0.3 (Vitest) and by `assertCount('[data-realtime]', 1)` in the new browser test of R3, 3.1a, G3 and 7.2.
3. **A JSON client that meets an error after B15** (`retroRequest` reading 401, 403, 404, 410, 419, 429; the MCP server), **and a 500 or a 503 while the database is down** — JSON answers are unchanged; the error page renders without shared props; the 503 page is static. Pinned in 11.7 (feature tests).
4. **Long content at 390 px in French or German**: a 120-character title, nine phases, a timer, twelve people in the session header; a 7-column table; FR labels 30% longer — no horizontal scroll, every control reachable. Pinned in Task 0.14 (bench capture with overflow check) and each group's visual test.
5. **A user with no workspace, or a member of a workspace with no team, on the new `AppLayout` and on `/dashboard`** — the sidebar renders, "Create a workspace" is reachable, the redirect of B22 does not loop. Pinned in 9a (`[P18e-09-03]`), 4.1 (`[P18e-04-07]`) and 4.0a (feature tests).
6. **Stored data that meets a changed palette or enum** — a `green` column (B10), a drawing in `red` (B26), a board made from a built-in template before B29, a retro without `started_at` (B19), a game created from a saved deck before `saved_deck_id` (B21: not counted, by decision). Each still renders and none is rewritten except where the spec says so. Pinned in R1, G0a, 7.0, R12a and 1.0c (feature tests named there).
7. **Data shown to someone who holds only a link** — the guest-join pages (B45) and the invitation page (B31, B44) send their new props for a valid token only, and never a participant's vote, score or e-mail. Pinned in R2a and 11.5a (feature tests).

## Dependency graph

```
Task 0 (0.1 → 0.15)                                    single writer
  └─ Group 1 (1.0a, 1.0b, 1.0c → 1.0e, 1.0d → 1.1 → 1.2 → 1.3 → 1.4 → 1.5)
       └─ Group 2 (R1, R2a → R2, R2b, R2c → R3 → R4 … R8, R8b, R9, R10, R11, R12a → R12, R13)
            │
            ├─ Lane S   Group 8 surveys (S1 → S2)                       needs R13
            │             └─ G6 (icebreaker stage)                       needs S2 and G5
            ├─ Lane P   Group 3 poker (3.0a, 3.0b, 3.0c → 3.1a → 3.1b → 3.1c → 3.2 → 3.3)
            ├─ Lane T   Group 4 team (4.0a, 4.0b, 4.0c, 4.0d → 4.1 → 4.2 → 4.3)   needs Group 1
            │             └─ Group 5 action items (5.0 → 5.2 → 5.3)     needs R12 and 4.1
            ├─ Lane G   Group 6 games (G0a, G0b, G0c → G0d, G0e → G1, G2, G3 → G4 → G5) → G6 on lane S
            ├─ Lane W   Group 7 whiteboard (7.0, 7.0b → 7.1 → 7.2 → 7.3 → 7.4 → 7.5)
            ├─ Lane K   Group 9 workspace (9.0a, 9.0b → 9a → 9b → 9c)    needs R1 and Group 1
            ├─ Lane A   Group 11 access (11.1 → 11.2 → 11.3 → 11.4 → 11.5a → 11.5, 11.6 → 11.7)
            │             └─ Lane X  Group 10 settings (10.0 → 10.1 … 10.8)   10.2 needs 11.1 and 10.0
            └─ Lane L   Group 12 (12.1, a redirect)                      no dependency inside Step B
                 │
                 └─ F1 shared deletions → F2 full gates → F3 phase report
```

Back-end tasks come first in their group or lane and are independent of one another, except where an arrow says otherwise: R2a before R2 (the join page reads `session`), R2b and R2c before R3 and R4 (the timer reads the extension route, the Writing banner reads `writersCount`), R12a before R12, 11.5a before 11.5, 11.6 before 11.7 (the 500 page reads the request id), 10.0 before 10.2, 1.0c before 1.0e (both migrate `poker_decks` and the default-deck columns), G0c before G0d (the channel sends the summary G0c extends), 3.0c before 3.1a, G0e before G3, 7.0b before 7.2 (each timer reads its extension route).

Parallel: lanes P, T, G, W, K, A, L and S may run at the same time in separate worktrees. Sequential inside a lane. Sequential across lanes: 5 after 4.1 (same test file `Plan09bActionItemsAdditionsTest.php`), 10.2 after 11.1 (`PasswordField`), G6 after S2 (both edit the retro board mounts), 9c after Group 1 ("Use" opens the dialog of 1.1 through `useNewSessionIntent`), 3.2, G2 and 7.1 after R2a (the three join pages read the `session` prop that R2a adds for the four types), F1 after every lane.

## Files shared between groups

| File | Touched by | Rule |
|---|---|---|
| `lang/{en,fr,es,de}.json` | every task | add keys only; on a lane merge, take the union; `TranslationKeysTest` decides |
| `resources/js/lib/page-layouts.ts` | every screen task; 12.1 removes `welcome` | one added line per page; union on merge |
| `resources/js/app.tsx` | 0.2, F1 | no other task edits it |
| `resources/js/layouts/skrum/app-layout.tsx` | 0.15 (topbar `actions` slot) | read by 5.2 and the admin shell; no other edit |
| `resources/css/app.css` | 1.3 (preview paper token), 7.2 and 7.4 (Excalidraw block, lines 477–546), any task adding a `@theme` size | additions only, outside the Excalidraw block except lane W |
| `routes/web.php` | 1.0c, 1.0e, 1.5, R2b, 3.0c, G0e, 7.0b, 12.1 | additions next to the routes of the same resource; union on merge |
| `app/Http/Controllers/BroadcastAuthorizationsController.php` | G0d (the `private-team-games.` branch) | no other task edits it |
| `app/Http/Controllers/TeamsController.php` (`show`) | 1.0a, 1.0b, 1.0c, 1.0e (Step A), then 4.0b, 4.0c, 4.0d (lane T) | one prop per task, each with its own action; sequential by construction |
| `app/Http/Middleware/HandleInertiaRequests.php` | 9.0a (`workspaces[].teamsCount`, `role`) | no other task edits it |
| `database/migrations/*` | 1.0c, 1.0e, R1, R11, R12a, G0b | one file per task; timestamps in task order |
| `resources/js/components/session/*` | written in Task 0; read by groups 2, 3, 6, 7 | a fix goes in its own commit `fix(session): …` on `plan-18e-screens`, then lanes rebase |
| `resources/js/components/skrum/*` | fixes: 0.3 (`connection-state` hint), 0.5 (`timer` add label), 0.10, 0.11, 0.12, 0.13 (leaderboard, form dialog, share dialog, gif picker), 1.2 (`deck-picker`), R1 (colour unions), R4 (`retro-card` label), S1 (`survey-question`), R2 (`guest-join` session lines and sticky action) | a group that needs a fix in a component it does not own reports it; no silent edit |
| `resources/js/components/teams/session-create/*`, `use-new-session-intent.ts` | Group 1; read by 4.1 and, through the URL, by 9c | 4.1 mounts the dialog and does not edit it |
| `resources/js/components/teams/whiteboard-templates-dialog.tsx`, `whiteboard-template-preview.tsx` | Group 1 only (briefs 03 and 04 also claimed them) | group 4 mounts them and does not edit them |
| `resources/js/components/teams/saved-decks-dialog.tsx` | deleted in 1.5 (the page `poker/decks` replaces it) | groups 3 and 4 link to the page |
| `resources/js/pages/teams/show.tsx`, `components/teams/poker-games-section.tsx`, `whiteboards-section.tsx` | 1.1–1.5 (trigger and import swaps), then 4.1 (rewrite, deletion) | sequential, 1 before 4 |
| `resources/js/lib/poker/deck-payload.ts` | created in 1.2, read by 3.1b and 1.5 | 3.1b deletes `components/poker/deck-fields.tsx` |
| `resources/js/components/action-items/item-*.tsx`, `use-action-item-mutations.ts`, `action-item-adapters.ts` | created in R8b; read by R9, R10, R12, 5.2 | 5.2 deletes the 12 old `components/action-items/*` files |
| `resources/js/components/retro/board-context.tsx`, `comment-thread.tsx`, `reaction-chips.tsx`, `emoji-picker.tsx` | kept or rewritten in place by group 2 with the same exports; read by S1, G4 | exports do not change |
| `resources/js/components/retro/board.tsx` (mount lines) | R3 to R13, then S1, then G6 | sequential |
| `resources/js/components/retro/icebreaker-stage.tsx`, `icebreaker-game.tsx` | R6 mounts them unchanged; G6 replaces and deletes them | sequential |
| `resources/js/components/gifs/gif-search-dialog.tsx` | rewritten in place in 0.13; read by R4 and G5 | no other edit |
| `resources/js/components/games/drawing-canvas.tsx`, `clue-row.tsx`, `gif-tile.tsx`, `room-context.tsx` | rewritten in place by G4/G5; read by R12 (retro results) | exports do not change |
| `resources/js/lib/games/drawing.ts` | G0a (palette), read by G4 | G4 does not change the palette |
| `resources/js/components/integrations/share/{delivery-lines,post-link-section}.tsx`, `lib/integrations.ts` | read by R3, R12, 3.1b, G3, 7.2; restyled by 10.5 only | 10.5 keeps exports and accessible names |
| `tests/Browser/Walkthroughs/Plan09aActionItemsCoreTest.php` | R9 (delete confirmation, "(Guest)", topics list) | lane T does not edit it |
| `tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php` | R9 (retro tests 01a–c, 06a), 4.1 (the sidebar lines of `P09b-02a`), 5.2 (the rest) | sequential |
| `tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php` | 1.1 (dialog), R1 (colour names), 9c (templates page) | sequential by construction (Step A, then lane K) |
| `tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php`, `Plan10bPokerAdditionsTest.php` | 1.2 (new-game dialog), 1.5 (saved decks), then lane P | sequential by construction |
| `tests/Browser/Walkthroughs/Plan13*`, `Plan07BoardEngagementTest.php` | 0.13 (GIF names), then R4 / lane G | sequential by construction |
| `tests/Browser/Walkthroughs/Plan17*`, `Support/InteractsWithWhiteboards.php` | 1.3 (creation dialog, templates manager), then lane W | sequential by construction |
| Deleted only in F1 | `components/retro/{connection-banner,session-expired-banner,presence-strip,timer-display,live-cursor-layer}.tsx`, `components/realtime/flying-reactions.tsx`, `components/retro/{ai-summary-switch,icebreaker-game-select}.tsx`, `components/templates/template-chips.tsx`, `components/confirm-form-dialog.tsx`, `components/workspace-switcher.tsx`, `components/password-input.tsx`, `components/heading.tsx`, `components/input-error.tsx`, `layouts/app-layout.tsx`, `layouts/app/*`, `layouts/auth-layout.tsx`, `layouts/auth/*`, `layouts/settings/layout.tsx`, old `components/app-sidebar.tsx` and its starter helpers | F1 deletes each one only when `grep` finds no importer; what still has an importer is listed for 18g |

## Browser tests that change because of the owner's answers

One table for the controller; each line is repeated under its task. "Confirm" means the agent reads the test before editing and reports if the line does not match.

| Answer | What changes in the tests | Files | Task |
|---|---|---|---|
| 1-D2 one "New session" trigger | `click('New retrospective')` → `click('New session')` (Retrospective is the preselected type); `click('New game')` → `click('New session')` then the type radio "Planning poker"; `button:text-is("New whiteboard")` → `click('New session')` then the type radio "Whiteboard" | `Plan04` (1), `Plan08a` (3), `Plan08b` (1), `Plan08e` (3), `Plan13d` (1); `Plan10a` (2), `Plan10b` (1); `Plan17a` (1), `Plan17b` (8, with the helper `p17bCreateBoard`) | 1.1, 1.2, 1.3 |
| 1-D4 four types (third round) | no test change: the Poll type is not built; the type radios are Retrospective, Planning poker, Whiteboard, Icebreaker | — | 1.1, 1.4 |
| 1-D3 shortcuts and "Browse" | a test that searches, filters by category or opens the "My workspace" tab clicks "Browse" first; a test that picks one of the five shortcut templates does not | `Plan08a` `P08a-01a`, `01b`, `03` | 1.1 |
| 1-D8 dialog confirmation | `div.bg-muted button:text-is("Delete")` and the text "Delete this template?" → `[role="alertdialog"]` and its "Delete" button | `Plan17b` (manager tests) | 1.3 |
| 3-D3 saved decks page, 1-D7 labels | `click('Saved decks')` opens a page, not a dialog: `[role="dialog"]` scopes go; "New deck" → "Create a deck"; "Edit deck" / "Delete deck" → "Edit :name" / "Delete :name" | `Plan10b` `P10b-01`, `02a`, `02b` | 1.5 |
| 4-D6 "…" section menu | `click('Saved decks')`, `button:text-is("Whiteboard templates")` → open the section's actions menu (`[aria-label="Planning poker actions"]`, `[aria-label="Whiteboards actions"]`) then the `[role="menuitem"]` | `Plan10b`, `Plan17b` | 4.1 |
| X5 one timer list | `click('30 s')` → `click('1 min')`; a test that lets the 30-second timer run out reaches zero the way `Plan04:419` does for the retro (confirm) | `Plan10b` :772, :811, :863; `Smoke/QueuedBroadcastTest.php` :24 | 3.1a |
| X4 timer at zero | `assertSeeIn('[role="timer"]', "Time's up!")` → `assertAttribute('[role="timer"]', 'aria-label', "Time's up!")` | `Plan04` :419; `Plan10b` :833; `Plan17c` :130, :133, :152 | R3, 3.1a, 7.2 |
| X3 reconnecting banner | a test that reads "Reconnecting…" inside `header` reads it in `[data-slot="connection-state"][data-variant="banner"]`; plain `assertSee('Reconnecting…')` is unchanged (confirm each of the 22 uses) | `Plan04` (5), `Plan10a` (2), `Plan17a` (9), `Plan17b` (5), `Support/InteractsWithWhiteboards.php` (1) | R3, 3.1a, 7.2 |
| 2-D11 / 7-D2 guest link in Share only | `click('Guest link…')` → open "Share"; "Create a new link" then confirm; the menu items "Replace the guest link" and "Copy the guest link" no longer exist: the assertions move to the Share dialog ("Create a new link", the button "Copy link" and the input named "Guest link": `ShareDialog` has no "Copy guest link") | `Plan04` :460; `Plan07`, `Plan12b` (guest-link tests); `Plan10a` :229, :616; `Plan10b` :215; `Plan17a` :357, :358, :369, :370, :408; `Plan17b` `P17b-16` | R3, 3.1b, 7.2, 7.3 |
| 6-D7 full Share dialog (games) | the header button is `[aria-label="Invite"]`; `[aria-label="Copy guest link"]` does not exist in `ShareDialog` (18c): the tests click `[data-slot="share-dialog"] button:has-text("Copy link")`; "Invite to the room" → "Invite to :title"; an "absent" assertion reads `assertNotPresent('[aria-label="Invite"]')` or "Guest link is off" | `Plan13a` (5), `Plan13d` (2, with `p13dOpenInvite`) | G3 |
| `ConfirmDialog` of 18c (games) | `[role="dialog"] button:has-text("Delete")` / `("Reset scores")` → `[role="alertdialog"]` | `Plan13a` `P13a-09`, `Plan13d` `P13d-09b` | G3 |
| Session frame title | `header > h1` → `header:has(h1) h1` (games) or `header span > h1` (whiteboard): the frame wraps the title, and pest-browser reads `header h1` as text | `Plan13a` (4), `Plan13b` (1), `Plan13d` (1); `Plan17a` (1), `Plan17b` (6), `Plan17c` (2), `Plan17d` (1) | G3, 7.2 |
| Guest access closed with a guest present (integration of wave 2a) | the Share switch asks first: confirm in `[role="alertdialog"]` ("Turn off guest access") | `Plan17a` `P17a-06a`; `Plan18eGamesTest` `[P18e-06-09]` | 7.2, G3 |
| 2-D15 settings popover | "Save" → "Apply"; the panel is a popover | `Plan04`, `Plan06`, `Plan07`, `Plan08b`, `Plan08e`, `Plan13d` | R3 |
| 8-D2 "Add survey" in the popover | open the settings popover before `click('Add survey')` | `Plan08c` (6), `Plan08e` (6) | S1 |
| 2-D9 topics-only discussion | on a board in Discussing or Actions: `[data-test^="retro-column-"]` and `main:has([data-test^="retro-column-"])` → `[data-test="retro-topics"]`; the "sort by votes" toggle (`data-test="retro-sort-by-votes"`) no longer exists: the test asserts the order of the topics; `#card-{id}` and the card's controls are unchanged | `Plan04` (the 7 uses of `retro-column-` are read one by one: only those in Discussing change), `Plan07` (3, same), and the retro tests of `Plan08e`, `Plan09a`, `Plan09b` | R9 |
| 5-D3 delete confirmation | after "Delete action item": confirm in `[role="alertdialog"]` | `Plan09a` (3), `Plan04` (1) | R9, 5.2 |
| 5-D7 "(Guest)" | `'Carol Guest (guest)'` → `'Carol Guest (Guest)'`; `:has-text("(guest)")` → `"(Guest)"`. The games' player list and the share text of `Plan12b`, `Plan13a`, `Plan13d` are other components and do not change | `Plan09a` :167, :177, :178, :182, :378; `Plan09b` :302, :305, :306 | R9, 5.2 |
| 3-D7 "Reveal cards" | `click('Show votes')` and `assertSee('Show votes')` → "Reveal cards" | `Plan10a` (10), `Plan10b` (8), `Plan14c` (6) | 3.1a |
| 3-D8 actions in the dock | Re-vote, Estimate, Save estimate, Next task keep their names; a selector scoped to the result panel is scoped to `[data-slot="facilitator-bar"]` (confirm) | `Plan10a`, `Plan10b` | 3.1a |
| 6-D2 eight ink colours | `[aria-label="Red"]` → `[aria-label="Coral"]`; the pixel assertion of that stroke takes the RGB of coral in `lib/games/drawing.ts`; black `'23 23 23 255'` and white are unchanged | `Plan13b` :354, :355, :414 and the pixel assertions after them | G4 |
| 7-D1 / 7-D4 sticky palette | colour names Yellow → Sun, Blue → Sky, Green → Moss; `'#fff3bf'` → `'#fdf1c2'` and the stroke `#ddc362`; a note made from a built-in template has a palette fill | `Plan17a`, `Plan17c`, `Plan17d`, `Support/InteractsWithWhiteboards.php`; `Plan17b` where it reads a template note's colour | 7.0, 7.4 |
| 9-D7 template deletion sentence | `'Retrospectives created from it keep their columns.'` → `'Retros already created from it are not affected.'` | `Plan08a` :418 | 9c |
| 10-D2 inline token creation | the creation dialog (`[role="dialog"]` scope, the trigger that opens it) → the inline form of the page; `#token-name`, `#scope-*`, `#token-team`, `#token-expiration`, `input[aria-label="API token"]` are unchanged | `Plan11b` (4 tests) | 10.4 |
| K24 flipped: sync as a switch | `label:has-text("Sync status") button[role="checkbox"]` → `button[role="switch"]` (and "Treat canceled as done") | `Plan14d` | 10.7 |

New browser tests, not changes: member removal confirmation (4.1), invitation revoke confirmation (9b), group by and counters (5.2), "+2 min" (R3), reaction bar in a room (G3), phone read mode (7.5), SSO buttons on the invitation (11.5), the redirects of `/` and `/dashboard` are feature tests (12.1, 4.0a).

## Where the briefs disagree

Each line was checked in the code where it could be. Rulings K4, K5, K7, K11, K12, K13 and K19 of the first version were settled by the owner's answers (6-D9, 3-D10, 1-D8, X3, X4, X5, BLOCK-1) and are removed; their numbers are not reused. K14, K17 and K24 were flipped by rule 13.

| # | Subject | Brief says | Other brief or notes say | Code | Ruling of this plan |
|---|---|---|---|---|---|
| K1 | How a page gets its layout | 04, 10: the page or shell wraps itself, `app.tsx` returns `null` | 06 (games index): `Page.layout = { active, breadcrumbs }`; 11: wire the new `AuthLayout` in `app.tsx`; 05: "default branch, nothing to change"; 09: not settled | `app.tsx:74-75`: the default branch is the OLD layout, so 05 is wrong; 18d pages wrap themselves | Pages render their layout (Task 0.2, decision X1, spec §6.1) |
| K2 | Owner of the four join pages and `session-ended` | 02, 03, 06, 07: each group its join page; 02: also `session-ended` | 11: all five in its commit 6, "others must not touch"; notes: `session-ended` = retro | spec §7 lists each join page with its session type | Shared `GuestJoinPage` in 0.7; pages in R2, 3.2, G2, 7.1; `session-ended` in R2; brief 11's commit 6 is dissolved |
| K3 | Layout of a join page | 07: no layout at all | 02, 06: `AuthLayout`; 11: centred `AuthLayout` | `AuthFrame` has no centred variant | Centred variant (0.7), as the GuestJoin mockup shows |
| K6 | Saved decks | 01 (C2) and 03 (3.4): a dialog on `DeckPicker` | 04 (commit 3): a hand-made list | three briefs own one file | The owner chose the mockup's full page (3-D3). Group 1 owns it (1.0c back end, 1.5 page); the dialog file is deleted in 1.5; briefs 03 §3.4 and 04 commit 3 are dropped |
| K8 | Deck payload helpers and custom-deck ids | 01: keep them in `deck-fields.tsx`; ids `deck-new-*` | 03: move to `lib/poker/deck-payload.ts`; ids `deck-custom-*` | — | Moved in 1.2; one prefix `deck-custom` (1-D6) |
| K9 | "New room" dialog of `games/index` | 01 (C4): rewrites `components/games/new-room-dialog.tsx` in place | 06 (G1): deletes that file, `GamesLeaderboard` embeds the dialog | spec §7: the dialog belongs to row 6 | G1 owns it; brief 01's C4 is dropped. The Icebreaker type of the "New session" dialog (1.4) has its own small form and posts to the same route |
| K10 | Icebreaker stage in the retro | 02 (R6): rewrites `icebreaker-game.tsx` in place, deletes `icebreaker-stage.tsx` | 06 (G6): new `components/games/icebreaker-stage.tsx`, deletes both retro files | — | R6 mounts the old stage unchanged in the new shell; G6 rewrites and deletes |
| K14 | Emoji picker behind the reaction bar | 02, 07: "`skrum/ReactionPicker`" | notes: frimousse picker slots | `skrum/reaction-picker.tsx` is the design system's grid; tests click "More emoji…" and `button[frimousse-emoji]`, which come from `retro/emoji-picker.tsx` | **Flipped to the mockup:** the `picker` slot renders `skrum/ReactionPicker`. Its last entry, "More emoji…", opens the existing frimousse `EmojiPicker`, so the full emoji set is not lost (deviation D-01, for approval) and the two test hooks stay (0.6) |
| K15 | Owner of the reaction engine and of `beep()` | 03: group 2; 02: a hook in `components/retro/` | 07: whoever lands first; notes: preparation | `realtime/flying-reactions.tsx` couples engine and toolbar | Task 0.5 and 0.6, in `components/session/` |
| K16 | `data-realtime` | 02 (row 24): `ConnectionState realtime` prop | 07: never pass it | `connection-state.tsx:186-189` renders a second hidden element when connected | Emitted by `SessionShell` only |
| K17 | Presence avatars shown | — | 07: new stack shows 5, old strip 8 | `presence-stack.tsx:160` `max = 5`; `presence-strip.tsx:10` `Visible = 8` | **Flipped to the mockup:** `SessionPresence` keeps the stack's five avatars and its counter, and the counter alone below `sm` (0.4). No browser test counts more than five avatars (confirm with `grep -n "data-presence-id" tests/Browser`) |
| K18 | Shared action-item containers | 02: its own files under `components/retro/` | 05 (5.1): shared files under `components/action-items/` | old files of that folder are imported by retro and by the page | One set, written in R8b before R9, under new file names |
| K20 | B10 before session creation and templates | 02: R1 must land before groups 1 and 9 | this plan's order puts group 1 first; 09: "until B10 lands use six colours" | `columnColorClass` accepts both sets | Group 1 writes no colour literal: the editable column list of 1.1 takes its colours from `serverColumnColors`; R1 follows; group 9 runs after R1 |
| K21 | Sidebar assertions (`P09b-02a`, `P12a`, `P13a`, `P14b`) | 04 and 05: "owned by the layout group" | 10: "none" | the assertion of `P09b-02a` runs on the team page (`:221-223`) | 4.1 edits them (the commit that puts the team page under the new sidebar) |
| K22 | Password field | 10: keeps `components/password-input.tsx` | 11: new `components/auth/password-field.tsx` | — | One component, `PasswordField` (11.1); 10.1 and 10.2 use it; the old file goes in F1 |
| K23 | `teams` page-prop rename | notes: preparation | 10: in its commit 4 | `ApiTokensController.php:42` | 0.9 for `teamGroups`; `filterTeams` stays in 5.0 with the counters |
| K24 | Status-sync control | 10 §3.5 row 83: `Switch` | 10 §8 and notes: keep `Checkbox` (tests bind `button[role="checkbox"]`) | — | **Flipped to the mockup:** "Sync status" and "Treat canceled as done" are switches (ScreenSettings shows a switch per integration option); the tests change (10.7). "I understand" stays a checkbox: it is an acknowledgement and no mockup shows it |
| K25 | `FormDialog` without submit | 07, notes: missing | — | `unavailableMessage` exists but its button is "Close"; `P17c-05b` clicks "Cancel" | New no-submit form state (0.11) |
| K26 | "Add survey" on the board | 02 (row 72): keeps the old board button and passes `onAddSurvey` | 08: popover only | — | R3 to R13 keep the old button; S1 removes it (8-D2) |
| K27 | New test ids | five patterns; 12 reuses `P12` | — | `P12a`–`P12d` exist | `[P18e-<gg>-<nn>]` (X8) |

## Defaults flipped to the mockup (rule 13)

What the first version of this plan left out or did differently, and now builds as the mockup shows. "Back end" names the spec item added for it.

| # | Screen | First version | Now, as the mockup | Back end | Task |
|---|---|---|---|---|---|
| M1 | Session creation | read-only mini-board of the template | editable column list (add, rename, reorder, colour) and "Save as team template" | B37 | 1.0d, 1.1 |
| M2 | Session creation | no guest toggle | "Anonymous guests allowed" on retro, poker and whiteboard | B37 | 1.0d, 1.1–1.3 |
| M3 | Session creation, poker | deck and two switches | Tasks "Type them" / "Later", facilitator "Watch only" | B37 | 1.0d, 1.2 |
| M4 | Retro, Writing | no counter | "n cards · x/y have written"; "Visible only to you" under one's own masked cards; "Anonymity: on" in the FacilitatorBar | B38 | R2c, R4 |
| M5 | Retro, Voting | budget only | "n votes / person" and "Reveal the votes" (the existing `hide_vote_counts` setting) in the FacilitatorBar | none | R8 |
| M6 | Retro, Discussion | topics rail beside the columns (owner chose topics only) | centre focus banner with Previous / Next topic, "Everyone follows" (the existing presentation mode), "Up next", inline "Create an action" with its ticket field (create, then the existing export) | none | R9 |
| M7 | Retro, Actions | plain success toast | "Action created" toast with Undo (the existing delete) | none | R10 |
| M8 | Retro, ROTI | "n of m voted" with a progress bar | the "Who has voted" list | B38 | R2c, R11 |
| M9 | Retro, session end | four stats | "votes cast n of m", health deltas per statement | B3 as amended | R12a, R12 |
| M10 | Retro, phone | tabs only | swipe between columns as well; assignee as avatar chips in the drawer | none | R13 |
| M11 | Session header | reconnecting pill only (then banner only, X3) | the compact state in the topbar and the full-width banner under it | none | 0.3 |
| M12 | Presence | 8 avatars | the stack's 5 and its counter (K17) | none | 0.4 |
| M13 | Reaction bar | frimousse picker in the slot | `ReactionPicker`, with "More emoji…" (K14) | none | 0.6 |
| M14 | Poker, after reveal | average and consensus | median, spread, agreement, the two extremes named ("open the discussion with …") | B39 | 3.0a, 3.1a |
| M15 | Estimation history | no deck column, a voters count | Deck column, voters as avatars | B40 | 3.0b, 3.3 |
| M16 | Team page, retro cards | phase and date | template name, facilitator, ROTI of a closed retro | B41 | 4.0d, 4.1 |
| M17 | Team page, poker table | no presence | "n in the room" | B41 | 4.0d, 4.1 |
| M18 | Action items | total only | counters per status and "from n rituals"; counts on the phone chips | B25 | 5.0, 5.2 |
| M19 | Games list | no status | status badge, avatar stack, "started n min ago" | B28 | G0c, G1 |
| M20 | Draw & Guess | no shortcut | `P` pencil, `E` eraser, `⌘Z` undo, shown in the tool tooltips | none | G4 |
| M21 | Whiteboard header | rename in the menu dialog only; export in the native menu only | inline rename in the breadcrumb (the menu entry stays), "Export" button in the header (opens the existing export dialog) | none | 7.2 |
| M22 | Workspace page | names only | member counts, member stack on a team tile, "one of n admins" | B42 | 9.0a, 9a |
| M23 | Workspace switcher | names only | team count and role per workspace | B42 | 9.0a, 9a (sidebar switcher) |
| M24 | Templates page | card grid of workspace templates | full picker with the built-ins, author on a workspace template, "Use", three tabs (also 9-D1, 9-D2) | B30 | 9.0b, 9c |
| M25 | Security | card without dates | "added on", "n of m recovery codes left"; the strength meter, fed with the server's real password rule | B43 | 10.0, 10.2 |
| M26 | Integrations | checkboxes | switches for sync options (K24) | none | 10.7 |
| M27 | Invitation | workspace name and e-mail | inviter, role, expiry, members; SSO block (11-D2) | B44, B31 | 11.5a, 11.5 |
| M28 | Guest join | title only | facilitator, people present, state; sticky action at 390 | B45 | R2a, R2, 3.2, G2, 7.1 |
| M29 | Share dialog | link and channels | QR code with "Download" (the component draws it; no back end) | none | 0.12 |
| M30 | Admin › Branding (18d) | sub-navigation of two entries, bar in the content, 20rem preview, three image cards, text warning, Reset card | the mockup's admin navigation column, bar in the topbar, 27.5rem preview with the mockup's content, one logo drop zone, warning with two swatches, Reset as a header button | none | 0.15 |

## Deviations from the mockup (gate G-deviations)

Reasons: **F** false or unsafe statement; **A** accessibility rule of spec §5; **N** the product has no such data or concept; **S** an approved spec decision; **O** an owner's answer. The owner read the first version of this table on 2026-10-02 (third round): the reading of rule 13 is confirmed, D-01, D-02 and D-04 are kept by decision, D-03 stands until plan 19, and the toolbars of D-21 are a plan of their own after 18e. "Rewrite first, features after": the last column names the feature of `research/front-rewrite/feature-roadmap.md` that later builds the element, and the screen leaves its place (procedure step 3b). "Backlog" means the owner did not ask for it.

| # | Screen | Mockup element not built, or built differently | Reason | Later |
|---|---|---|---|---|
| D-01 | Reaction bar | the picker also offers "More emoji…" (full emoji search), which the mockup's picker lacks | O: kept (third round) | stays |
| D-02 | Session timer, poker | the menu keeps "Custom…" beside 1/3/5/10 | O: kept (third round) | stays |
| D-03 | Retro | the optional Health check phase appears in the stepper; the mockups have none | S: spec §4; O: stands until plan 19 | SV-5 |
| D-04 | Retro, Actions | "Close the retro" in the FacilitatorBar; built: "Next phase" to ROTI | O: kept (third round) | stays |
| D-05 | Session header | the topbar connection state is hidden from assistive technology; the banner is the only announcement | A | stays |
| D-06 | Session creation | the Sessions page behind the dialog, "Schedule…" | N | SE-1, SE-2 |
| D-07 | Session creation | "Max per card", "Timer per phase", "Timer per task", "Change vote after reveal", "Write estimates to Jira" select, the Jira import tab; the "ROTI at the end" switch | N | SE-3 (with RT-3); the ROTI switch: backlog (ROTI is always a phase, spec §6.4) |
| D-08 | Session creation | invitation link and "Copy link" inside the dialog; built: the guest switch, and the link in the Share dialog once the session exists | F: the link does not exist before creation | stays |
| D-09 | Session creation | one "New session" trigger, no per-type tiles on the team page; four types, no Poll | O: 1-D2; O: third round | SV-1 (Poll) |
| D-10 | Retro, Writing and Grouping | "is writing…", "is moving a card…" indicators; Pause; "Reveal the cards" as a button separate from the next phase; duplicate detection; "Undo last group" | N | RT-1, RT-2; the last three: backlog |
| D-11 | Retro, Voting | "max 2 per card", "5/8 have finished", "I have finished voting" | N | RT-3, RT-4 |
| D-12 | Retro, Discussion | per-topic timer and time estimates, shared notes, "discussed" flag, action count per topic; "8/8 following" | N | RT-5, RT-6, RT-7, RT-8; "following" count: backlog |
| D-13 | Retro, Actions | bulk "Export to Jira" | N | RT-10 |
| D-14 | Retro, ROTI | distribution hidden until "Reveal ROTI"; "Nudge the last 2"; built: the distribution is shown at session end | N | RT-9 |
| D-15 | Retro, session end | Export menu PDF / CSV / Markdown; ROTI delta and sparkline | O: 2-D7; N | backlog (not requested) |
| D-16 | Poker room | ticket type, labels, acceptance criteria, Jira description; spectator eye in presence; role and expiry in the Share dialog | N; O: 3-D5 | PK-1; the eye and the share roles: backlog |
| D-17 | Estimation history | deck, period and "re-voted only" filters; Export CSV | O: 3-D6 | backlog (not requested) |
| D-18 | Team page | "Invite", sprint name and next retro, the mixed "recent sessions" table, the aggregated open actions, the activity feed, participant / card / action counts on a retro card, member role badge, whiteboard thumbnails | N | IN-4, TM-1 to TM-7 |
| D-19 | Action items | grouping by sprint (built: by team, assignee, status); selection and bulk bar; filters priority, due date, source; status "In progress"; topbar "Export"; whiteboard and survey sources | N; O: 5-D4 | AI-1 to AI-4; sprint grouping with TM-1; other sources with WB-5 and SV-1 |
| D-20 | Games | the four games the engine does not have; the settings card (themes, time per turn, auto hints); turn order, "round n of m"; GIF captions, two votes, podium; "needs n more players", "found by" chips, Redo and "New word", the emoji riddle bank, "Pin to the retro", duration on a game card | N | GM-1 to GM-4; from "needs n more players" on: backlog |
| D-21 | Whiteboard | the rebuilt vertical toolbar, selection bar, zoom and minimap; comments, "convert to actions", "follow"; sticky authors | S: spec §3 and rulings 5, 29; O: a separate plan after 18e; N | WB-1; WB-2 to WB-5 |
| D-22 | Surveys | the multi-question builder, scale and NPS questions, compare, CSV; the standalone participant page; builder settings (anonymity modes, close date, threshold), "send to whiteboard" | N | SV-1 to SV-4; the builder settings and "send to whiteboard": backlog |
| D-23 | Surveys | "Add survey" in the settings popover only; no "Anonymous" badge | O: 8-D2, 8-D3 | stays |
| D-24 | Workspace | team description; template visibility; template defaults and poker template settings. The three activity lines of a team tile (PB-13 A) and the usage of a template (PB-15) are built by Tasks 9a and 9c: see D-91 and D-94 | N | WS-1, WS-2; defaults and settings: backlog |
| D-25 | User settings | presence colours, photo upload, "Reduce animations", the live breach check (see D-79), active sessions, linked accounts; other notification events, "last changed", "Change device", revoked-token rows | N | AC-1 to AC-6; the rest: backlog |
| D-26 | Security | the Print button of the recovery codes | O: 10-D3 | stays |
| D-27 | Team settings | tabs other than Team and Integrations | N | WS-3 |
| D-28 | Login, register | "Remember me for 30 days" (built: "Remember me"); "Free up to 10 participants"; the terms sentence; "Privacy · Terms"; "Team name" on register; version in the footer | F; N | backlog (not requested) |
| D-29 | Login | the magic-link button and tab | built in plan 18f (B12); 11.2 leaves their place | plan 18f |
| D-30 | Invitation | team name and colour, inviter's message, "Decline"; "already in n teams" | N | IN-1, IN-2, IN-3; the last: backlog |
| D-31 | Error pages | "Instance status" link; the access request of the 403 page; "Back at" and the admin message of the 503 page; the version line; "Help" link | F; N | AD-2 to AD-5; "Help": backlog |
| D-32 | Guest join | colour picker, short code | N | GU-1, GU-2 |
| D-33 | Onboarding | the four-step onboarding | N | ON-1 |
| D-34 | `/` | the landing page | O: BLOCK-3 | stays |
| D-35 | Admin | sections other than Branding and Admins; the version line | N | AD-1, AD-2 |
| D-36 | Whiteboard, phone | the read mode is a local view mode, not a permission | N (as written in the spec, confirmed) | stays |

Rows D-37 to D-46 were added by the review of Group 1, D-47 to D-51 by the review of lane W (they were numbered D-37 to D-41 in that lane and renumbered at the merge), D-52 to D-63 by the integration of wave 2a for the access and games screens (2026-10-02). **The owner has not read them yet**: the reason is the one proposed, and gate G-deviations stays open on them until the owner's word. A difference that the owner refuses is brought back to the mockup.

| # | Screen | Mockup element not built, or built differently | Reason | Later |
|---|---|---|---|---|
| D-40 | Session creation, retro | "Votes per person" has an "Automatic" switch beside the stepper; "Icebreaker at the start" has a switch beside the game select | N proposed: the mockup has no automatic vote limit and no way to turn the icebreaker off, which the product has (parity rows 13, 15); to approve | stays |
| D-42 | Session creation, retro | "Delete column" on the line of the palette; six colours, not eight (swatches alone, the name as tooltip and accessible name, since RW-C1); a dot marks a colour another column uses | O: fourth round, 4b (swatches alone; eight colours with R1); the six colours are the server's until R1 (K20) | eight colours with R1 |
| D-43 | Session creation, retro | "All templates" and "Browse" open the full picker in place of the shortcuts, with its own read-only preview; a shortcut shows the category of the catalogue | O: 1-D3 for the picker; N for the category; to approve | stays |
| D-44 | Session creation | "Auto reveal" and "Anonymous guests allowed" open off (the mockup shows them on); the health check help does not say "6 statements, before the ROTI" | F proposed: the server defaults are off, the count varies and the phase comes first; to approve | stays |
| D-45 | Saved decks page | "Set as default" and "Delete" on the cards, so the footer of a card takes two lines at 15rem and its buttons are grouped on the left; "Workspace" badge; four built-in decks | S proposed: spec B21 and B30, parity row 34; to approve | stays |
| D-46 | Saved decks page | the page sits in the application layout with "Back to the team" above the title; the editor opens in a dialog (the mockup has no frame for it) | S proposed: the task's composition and `DeckPicker/README.md`; to approve | stays |
| D-47 | Whiteboard, topbar | reworked (RW-C2, owner round 4): the logo opens the header and leads to the team, then the breadcrumb "team › Whiteboards › name", the name renamed in place; no application rail on this screen. Remains: a guest reads "Whiteboards › name" (the snapshot does not tell a guest the team) and follows no link; the breadcrumb gives way below 48rem, where only the name stays; "Whiteboards" leads to the sessions of the team page (that page has no whiteboard anchor) | N: a guest is not told the team on any session screen (the game room already did so); A: header budget on a phone, owner round 4 ("only the title and the essentials") | stays |
| D-48 | Whiteboard, topbar | reworked (RW-C2): "Synced" (`sk-conn is-ok`) shows while connected, on every session screen. Remains: between 48rem and 80rem the pill keeps its dot, the label is for screen readers and the word shows as the pill's tooltip; below 48rem it is not shown | A: header budget (owner round 4: the Synced label gives way before the title) | stays |
| D-49 | Whiteboard, property panel | the eight swatches inside the canvas's panel; built: the colour bar under the tool bar, and in the panel the "Stroke" and "Background" rows keep their picker button alone (the library's quick picks and their separator are hidden, the picker still offers the library's colours) | O: 7-D3, and the fallback of `ExcalidrawTheme/README.md`; the panel is the library's until WB-1 | WB-1 |
| D-50 | Whiteboard | the facilitation tools (timer, lock, "Bring everyone to me") in the header, the board menu after "Share", the reactions bar at the bottom of the canvas: the mockup has none of the three | N in reverse: features the product has and the mockup does not show (brief 07 §6); parity (spec §8) keeps them. Row added in the review of lane W: awaits the owner's word | stays |
| D-51 | Guest join | the card alone; built: the centred `AuthLayout` of Task 0.7 around it, with the instance's logo and a language select in its header (one logo: D-115). The suggested nickname and the button "Join the session" were built by RW-J1 (owner round 4); what differs from the mockup in them is D-126 and D-127 | the frame is shared by the four join pages and the access pages (Task 0.7) | stays |
| D-52 | Register | the title is "Create your account", not "Create your workspace"; "Confirm password" is kept; no "Team name" | F proposed: registering creates a user, not a workspace; the server validates the confirmation (parity row 11); to approve | stays |
| D-53 | Login, password confirmation | a "Sign in with a passkey" button under the SSO buttons, which the mockup lacks | N in reverse proposed: an existing feature the mockup does not show (brief 11 row 5); to approve | stays |
| D-54 | Invitation, logged out | the account is created on the card (RW-A1, S35): locked e-mail, "Create a password", "Create my account and join :workspace", "Sign in" as a text link. What remains: a field "First and last name" between the e-mail and the password (PB-46, option B: a name made from an address would be shown to the whole team); the button names the workspace, not a team (D-30); the signed-in variants are states of the main card with a full-width button, not small separate cards; the expired notice has no "Ask for a new invitation" button, and after RW-S3 its sentence names the workspace ("Your invitation to join :workspace was valid until :date.", the mockup: "It was valid until 24 September") | owner (fourth round: REWORK, done; PB-46 ruled B); N: no route asks for a new invitation | stays; the request button: backlog |
| D-55 | Error pages | 403 says "this page", not "this team" (a closed registration is a 403 too); 404 has no "Search sessions ⌘K" (slot `search`); 503 says "Maintenance" and names the application and not the host; its line "This page reloads by itself as soon as the instance answers" is shown by its one inline script, which asks the instance every 30 s and loads the page again once the answer is no longer a 503 (rework RW-S1; the "Back at" block and the admin's message stay places left AD-5); 419 and 429 have no mockup and reuse the frame with the clock | F proposed for the 403 title and the 503 line; N for the search; to approve | search: with the command palette (18f) |
| D-56 | Games page | a room row also shows its rounds and "Open by link" / "Team only"; leaderboard rows read "n rounds · n wins" (the mockup: "n games"); streak badges on the podium and in the rows | S proposed: parity rows 5 and 10, Task 0.10; a round is what the engine counts; to approve | stays |
| D-57 | Game room, shell | after RW-G1 (owner round 4: each game follows its mockup) what remains: the header says "Back to the team", not "Back to games" (the "Atlas · Games" overline, "Synced" and the user avatar were built by RW-C2); Decoded keeps the game choice on the left and a "Scores" list above its guesses on the right (the mockup: a "Rounds" list on the left, a round leaderboard on the right); in Draw & Guess and Sprint in one GIF the host changes game from a "Choose a game" button at the foot of the players column (the mockup chooses upstream); the host is marked "Host" in the list; no "found · 0:18" under a player (one finder ends the round); the guesses column of Draw & Guess stands only during a round | N: the engine has no list of coming puzzles and no time per finder; S: the host switches game inside the room today (`P18e-06-04`), and no feature may be lost | reworked (RW-G1, RW-C2); rest stays |
| D-58 | Game room, reactions | the reaction bar sits in its own strip under the stage, not floating over it | A proposed: it must never cover the keyboard or the guess field ([P18e-06-08]); to approve | stays |
| D-59 | Hangman | no "guess the whole word (+50 pts)" field. After RW-G3 (owner round 4b) the keyboard is a docked panel at the bottom of the screen on a phone; what remains there: the reaction bar keeps its strip, above the keyboard (D-58); the gallows stand above the word, centred, without the "tries left" text beside them; the docked panel pads its foot with `pb-[calc(env(safe-area-inset-bottom)+0.75rem)]`, an arbitrary size outside spec §5 rule 3, as `ui/drawer.tsx`, `session-settings-popover.tsx` and `mobile-tab-bar.tsx` already do (one safe-area utility for the four is left to a later pass) | N: the engine has no whole-word guess (feature roadmap, games) | reworked (RW-G3); whole-word guess backlog |
| D-60 | Draw & Guess | a "Fill" tool (parity row 44); the live pencil tag is in the primary colour; the clue giver's view of Decoded has no mockup. After RW-G3 (owner round 4b) the guesses of a drawing are in a drawer on a phone, the field docked at the bottom of the screen under the latest guess; what remains there: the drawer's toolbar stays in the flow of the stage under the drawing, and the guesses of Decoded stay on the stage | S: parity; N: a game room gives players no presence colour | reworked (RW-G3); rest stays |
| D-61 | Sprint in one GIF | after RW-G2 (owner round 4: picker open on the stage, draft then "Send my GIF") what remains: the right column keeps the "Scores" list under "Your pick" and "Already sent"; a sent GIF reads "Sent" with "Change GIF" and "Remove GIF"; no title, duration or caption under the preview; the host's "Reveal the GIFs" stands under the picker; a draft not sent at the reveal is left out of the gallery (the host is told "Your GIF is not sent yet" beside the reveal button, the other players are not); the inline picker is a `group`, not a `dialog`, and takes no focus when the round starts; on a phone the picker stays in the flow of the stage with "Your pick" under it (the mockup: a full-screen drawer); the voting step reuses the results gallery; labels "Favourite" and "Votes: n" (browser contract) | S: no feature may be lost (scores, change and remove of a sent GIF, reveal by the host); N: the proxy gives no title or duration (D-62) and the product has no caption (D-20); A: a region of the page is not a dialog | reworked (RW-G2); rest stays |
| D-62 | Sprint in one GIF | a GIF is an `<img alt="">` of the proxied preview in a 4:3 frame: no looping video, no still under reduced motion, no title. **Spec §5 rule 8 is not met here** | N: the proxy returns neither a video, a still nor a title. To decide by the owner: accept, or extend the proxy | backlog (proxy) |
| D-63 | Whiteboard, phone header | reworked (RW-C2): at 390 the guests badge and the guest's logo give way and the title keeps the room left by the timer, the counter and the menu; the facilitation tools show their labels from 96rem only, so no label is cut at 1440. Remains: at 1440 the facilitation tools are icons with tooltips | S proposed: the header budget of Task 0 (`18e-report/00-preparation.md`); to approve | fix later with the header budget |

Rows D-78 to D-89 were added by the review of Group 10, settings (2026-10-02). **The owner has not read them yet**: the reason is the one proposed, and gate G-deviations stays open on them until the owner's word. A difference that the owner refuses is brought back to the mockup.

| # | Screen | Mockup element not built, or built differently | Reason | Later |
|---|---|---|---|---|
| D-78 | User settings | sentences rewritten: profile footer "A changed email address has to be verified again." (mockup: "Changing your email sends a confirmation link."); no "Other sessions are signed out when you change it." under the password; the recovery warning does not say the codes are shown once; "The theme is kept on this device. The language is saved on your account." (mockup: "Stored on this account, synced across devices."); the API tokens sentence does not name a REST API | F proposed: the server sends no link, signs no other session out, shows the codes again on demand, keeps the theme in the browser and has no REST API; to approve | stays |
| D-79 | Security, password | the breach line is "Checked against known data breaches when you save", without a met / not met mark, and only when the server's rule has the check (`checksCompromisedPasswords`); the mockup shows "Not found in known data breaches" as a rule already met | F proposed: the check runs on the server when the form is saved, the page cannot know its result while typing; to approve | AC-6 (live check) |
| D-80 | Security | "Turn off 2FA" asks for no code and its sentence does not mention one | F proposed: the server asks for none (the page is behind the password confirmation); to approve | stays |
| D-81 | Security | French badge "Activé" / "Désactivé", where the mockup has the feminine "Activée" / "Désactivée" | N proposed: the keys "On" and "Off" are shared with masculine nouns and the translation files have no gendered variant; to approve | a key of its own for this badge, if refused |
| D-82 | API tokens | the table has eight columns (Name, Scopes, Team, Created, Expires, Last used, Status, action), not the mockup's four; dates are absolute, not relative; the scopes of a token are badges with their label, not mono codes | S proposed: Task 10.4 keeps the columns, the dates and the badges that `Plan11bApiTokensTest` reads (parity rows 40 to 46); to approve | the mockup's four columns, with the browser tests listed, if refused |
| D-83 | API tokens | the copy-once panel takes the place of the form's footer until "Done"; its sentence is "Copy your token now. You won't be able to see it again." (mockup: "Token created — copy it now, you won't see it again.") | O: 10-D2 for the inline form; S proposed for the sentence (`[P11b-02]`, `[P11b-18a]`); to approve | stays |
| D-84 | Notifications | at 390 the table keeps its head and its two columns; the mockup has "label + two switches" rows without a head | A proposed: the column heads are what names the two switches, and with one event the columns fit; to approve | the mockup's rows when the other events arrive (MN-1), if refused now |
| D-85 | Team settings, integrations | one card per provider (head, details, footer of actions), not one row per provider in a single card; the status is a badge at the end of the head, not a coloured line under the name; no switch per integration and no "Configure" | N proposed for the switch and "Configure" (a connection is connected or not, it has no "off" state); S proposed for the cards and the badge (brief 10 §6: the mockup has no frame for the details, actions and tracker panels; `Plan12a` and `Plan14a` read the first badge of the card); to approve | stays |
| D-86 | Team settings, integrations | lucide icons stand for the providers (Slack: `hash`), not the brand marks of the mockup | N proposed: lucide marks its brand icons deprecated and no dependency may be added; to approve | brand marks once an asset set is approved |
| D-87 | Team settings | three crumbs (team › Team settings › Integrations), the mockup has two; no "Changes saved" indicator in the topbar | S proposed for the crumbs (brief 10 row 53); F proposed for the indicator (nothing on this page saves by itself); to approve | stays |
| D-88 | Team settings | "created in March 2025" under the name of the team is not shown | **not a deviation rule 13 allows**: the server holds the date and does not send it. It needs a §9 item (the prop on the team settings page) and a task; open until the owner adds the item or refuses the element | new §9 item |
| D-89 | Team settings, integrations | "Rotate secret", "Redeliver" and the status-sync confirmation are plain `dialog`s, not `ConfirmDialog` (`alertdialog`); "Re-enable" has no confirmation; People is a list, not a `Table` | S proposed: Tasks 10.5 to 10.7 change no browser test, and those tests scope the confirmations to `[role="dialog"]`; to approve | `ConfirmDialog` and `Table`, with the browser tests listed, if refused |

Row D-90 was added at the integration of wave 3 (2026-10-02), from the review of the small rework lane. **The owner has not read it yet.**

| # | Screen | Mockup element not built, or built differently | Reason | Later |
|---|---|---|---|---|
| D-90 | Instance admin, branding | after RW-S2 (owner round 4) the radius has an "Exact radius in pixels" field beside the segments when the stored value is none of them, and each staged image has an "Undo" button; neither is in ScreenSettings frame b. In the narrow form column the field wraps under the segments. On a staged replacement "Undo" takes the place of "Remove": removing the stored image then takes Undo, then Remove | O: owner round 4 (exact radius, undo per staged image); A proposed for the wrap; S to approve for "Remove" (one action per state of the drop zone) | stays; "Remove" beside "Undo" if refused |

Not a deviation: the type tiles use `layers` (Retro) and `sparkles` (Icebreaker), which is what the tiles of `ScreenSessionCreate/preview.html` and the table of `SessionTypePicker/README.md` show. `sticky-note` and `party-popper` appear in that mockup only in the session rows behind the dialog, in the "Games" entry of the sidebar and in the "Icebreaker at the start" row.

Rows added in the review of lane P (poker), from the differences of `18e-report/03-poker.md`. None was read by the owner: each "to approve" awaits the owner's word (gate G-deviations). The numbers follow the rows of wave 2a (D-37 to D-63); they did not clash at the merge and are unchanged.

| # | Screen | Mockup element not built, or built differently | Reason | Later |
|---|---|---|---|---|
| D-64 | Poker room, result | the figures in the oval (ScreenPokerQueue) or in the dock (ScreenPokerAfter). Built after the owner's fourth round (RW-P1): no panel under the table; the oval holds the average, the median and the spread; the dock holds the agreement, the distribution and the line naming the extremes, in place of the deck, after the average and the median repeated there as in ScreenPokerAfter. What remains: with a tall story card (a Jira source with its conflict block) the bottom edge of the oval is cut by the reaction bar at 1440 × 900; the dock keeps "Nearest card: n", the reason of an automatic reveal, "Your card · n" and "View as table" under the distribution; the cards of an anonymous round stay listed under the seats; on a phone the result is a card of the page under the seats and the dock keeps the two buttons (MobilePoker) | O: fourth round, D-64 ("everything in the oval and the dock"); parity (nearest card, reveal reason, anonymous votes) and the accessibility rules (table view of the chart) | stays |
| D-65 | Poker room, dock | the final-estimate cards and "Validate 5 pts · Next story". Built after the owner's fourth round (RW-P1): the cards and one button. What remains: the cards are every value of the deck in a scrolling row (the mockup shows the four values played); the button reads "Validate 5 · Next story" without "pts", and "Validate 5" when no other task waits; no button "discuss with the extremes" (the line names them); "Next task" stays in the dock before the reveal, and after it the N key still moves on without saving | O: fourth round, D-65 and D-68 ("pts" false on a T-shirt deck); parity (any card of the deck can be the estimate; skipping a task) | stays |
| D-66 | Poker room, table | the watchers box laid over the corner of the table; first names on the seats; on a phone, a scrolling row of participants. Built after the owner's fourth round (RW-P2): the first word of the display name on every seat ("You" for the viewer), the full name as tooltip and for screen readers; on a phone the players are one row that scrolls sideways, the avatar pinned on the card, reachable with the keyboard. What remains: the watchers box in the flow under the seats (the top row of seats takes the whole width, the box would cover the first seat); on a phone, while the team votes, the row of players is partly under the fold of an 844px screen; the progress and "Reveal cards" stay in a bar above the row (the mockup has a heading "Participants · 5 / 8 voted" and an alert), the row does not bleed to the screen edges, and the facilitator's player menu and "Offline" stay under a seat | S: `PokerTable` of 18c (the seats take the whole width); parity (reveal, player menu, offline players) | stays |
| D-67 | Poker room, rounds | the rounds shown open, values only. Built after the owner's fourth round (RW-P2): open by default, each round lists "name: value". What remains: the names are kept, so a round is taller than the mockup's line of chips and the list scrolls inside the story card beyond 8rem; on a phone the list is folded (README of ScreenPokerQueue: "Rounds repliés par défaut") | O: fourth round, D-67 ("open by default, names kept"); mockup README for the phone | stays |
| D-68 | Poker room, queue | "3 pts" on an estimated row; "Votes: n" on every row; a drop line while dragging; the switch "Auto-reveal when everyone voted". Built after the owner's fourth round (RW-P2): "Votes: n" on every row (the votes of the task's last round, sent by the snapshot) and the drop line, the rows staying in place while one is dragged. What remains: the bare estimate ("3"), without "pts"; "Reveal automatically when everyone has voted or the timer ends"; the dragged row follows the pointer above the list | O: fourth round, D-68 ("pts" false on a T-shirt deck); F: the timer reveals too | stays |
| D-69 | Poker room, header | the "Atlas · Planning poker" line above the title and the user avatar at the end (both built by RW-C2; a guest reads "Planning poker" alone); a "Share" button that always shows its label. Built: "Share" shows its label from 96rem (the header also holds "Watch only" and "Hide tasks"); the Share dialog reads ":count present" without the team name | S proposed: the session frame of Task 0 is the same on every session screen; N: the room does not receive the team name; to approve | stays |
| D-70 | Poker room, settings | a popover anchored to a header button. Built after the owner's fifth round (RW-P3): the settings open in the session settings popover from an icon button "Game settings" of the header (a drawer on a phone, where the button is in the bar under the header), with "Apply (n)", "Reset", the question before a change is dropped, and the toast "Settings applied" with "Undo"; the popover stays open after "Apply"; a player who does not facilitate opens the same button and reads the values as text; the comma key opens it; "Settings…" left the facilitator menu, whose button is now an ellipsis. What remains: the deck editor of the popover has no name field; the button is absent once the game has ended; no side sheet on a wide screen | F: the settings endpoint cannot save a deck; an ended game takes no setting | stays |
| D-71 | Poker room, import and source | no mockup (brief 03 §6). Built: the board is a search field and a select, not a `Combobox`; a queue ticket shows a check when the issue is done in its tracker; the story of an imported task carries the tracker block (assignee, estimate, sync state, status, note) | S proposed: parity rows 27 to 31 and the browser contract (`[aria-label="Choose a board"]`, `P14d-10a`); the search is done by the tracker, which `Combobox` cannot do; to approve | stays |
| D-72 | Estimation history | rows that do not open; arrows on Previous / Next; the ticket key alone under the title of a task; "Search tasks or tickets…". Built (RW-P4 done: the ticket key under the title of an imported task, "across n games" in the summary): the name of the game after the key, on the same line; "in 1 game" when one game holds the estimates; the team name alone under a filter; a "Search" button after the field, which searches titles only; a chevron that opens the rounds of a task; the page under `AppLayout`; the date in the order of the locale | browser contract (`P10a-15`); parity row 58; the composition of Task 3.3; the game name tells two games apart under "All games"; approved in the fourth round ("other points of the row stay") | search by ticket key: backlog |

Rows added by the integration of wave 2b for the team page (lane T had numbered none), from `18e-report/04-team.md`. None was read by the owner: each "to approve" awaits the owner's word (gate G-deviations). Next free id: D-78.

| # | Screen | Mockup element not built, or built differently | Reason | Later |
|---|---|---|---|---|
| D-73 | Team page, retro cards | three phase tones for three phases (Writing, Voting, Closed). Built (RW-T1 built the gear "Team settings" and "Join" / "Resume"): Voting warning, Completed muted, every other phase of the product info with a dot; the gear is left out for a member who can change nothing of the team; "New session" follows the gear in the header | N: the product has more phases than the mockup; F: a gear that leads nowhere; O: fifth round | stays |
| D-74 | Team page, planning poker | "Open" on a game without players; points in the Points column only. Built: "Open the game" (the key "Open" is the status of an action item); "· n points" also in the line under the name (`P10a-12` reads it); an "Ended games" group | browser contract and parity row 14; to approve | stays |
| D-75 | Team page, layout | two columns from about 64rem of content. Built: from 80rem of viewport; controls the mockup lacks: the trash of a whiteboard, "Remove" and "Add a member", the "Team settings" card (rename, delete) | S proposed: with the sidebar, 64rem leaves 18rem to the main column; parity rows 4, 5, 17, 33, 34; to approve | stays |
| D-76 | Team page, health check | "6 statements asked at the end of each retro, scored 1–5", every row "Built-in", link "Manage". Built (RW-T2): the compact list with the real count and "scored 1–10"; a "Custom" badge on a team's own statement; the link reads "Details" for a member who cannot manage (the page it opens is read-only for them); managing is on the page `teams/health-check`, which opens on `view` of the team (a member reads the list and the Mood trend) while the controls and the five write routes ask `update`: the plan said "same authorisation as today's statement management", to confirm by the owner | O: fourth round (real values, a page of its own); F: "Manage" would be false for a member | stays |
| D-77 | Team page, mood trend | the ROTI curve with sprint labels S35 to S42 and "since S35", in the right column of ScreenDashboard. Built (RW-T2): the same card in the main column of the team page, under the session sections; the x axis shows the day each retro closed and the badge reads "since :day"; labels thinned out when they would collide. The Mood trend (health score) is on the health check page. Accepted loss on the team page (mockup strict): the ROTI "View as table", the link to each retro and the number of voters are gone; every retro and its value stay readable by assistive technology in a visually hidden list | O: fourth round (main column, mockup strict); N: no sprint number | sprint labels: TM-1 |

Rows added by the integration of wave 4 (2026-10-02) for the workspace screens (Tasks 9a, 9b, 9c numbered none), the recovery-code alert (RW-S4) and the health check page (RW-T2), from `18e-report/09-workspace.md`, `10-settings.md` and `04-team.md`. **None was read by the owner**: each "to approve" awaits the owner's word (gate G-deviations).

| # | Screen | Mockup element not built, or built differently | Reason | Later |
|---|---|---|---|---|
| D-91 | Workspace page | "Retro live now · Sprint 42"; "1 whiteboard edited today" on one tile; "Open →"; "Manage templates" for everyone; the dashed tile "Teams share this workspace templates"; a full-screen switcher on a phone. Built (9a, PB-13 A): "Retro in progress" (the server knows the phase of a retro, not who is in it); the second line is always the poker games; "Open" ends with the lucide arrow; a member reads "View templates"; the dashed tile reads "Teams share the templates of this workspace."; the switcher stays the dropdown of the sidebar on a phone | F: no presence outside a session, no activity log for whiteboards; rule 9 (icons); F: a member cannot manage templates; to approve | whiteboard activity: TM-4; phone switcher: backlog |
| D-92 | Workspace page, leaving | the consequence lists "the teams left"; "You're one of 2 admins — Camille R stays admin". Built (9a, PB-18): only the teams the person belongs to, joined by `Intl.ListFormat`, and "You leave n teams." above three; "You're the only admin of this workspace." when no other admin exists; inline from 768 px, a modal under it | F: the mockup has no case without another admin; to approve | stays |
| D-93 | Workspace members | no mockup of the page; reference: the Members card of ScreenSettings frame a (PB-16 A, PB-22). Built (9b) beyond it: every member listed (no "See all 11"); "Revoke" is a cross with its label; an expired invitation reads "Expired"; the line under an invitation starts with its role; the viewer's own row has the "…" menu with "Leave"; an owner seen by an admin is a badge without a select; the link of an invitation just created shows in a band under the card header, with "Copy link"; the toast reads "Invitation created for :email."; under 36rem of card the table becomes stacked blocks and the role stays a select in the row; a "Delete workspace" card under the members card; a footer line explains Admin and Owner | parity rows 6, 15, 16, 19; rule 6 (a destructive action has an icon and a label); F: a mail may not leave the instance (`mail.default` log); to approve | "Invitation link" button: backlog (D-30) |
| D-94 | Templates page | the lagoon tile with the pen as whiteboard empty state; no whiteboard template card; no "Create a deck"; the preview of a card hidden from assistive technology at 0.625rem; no state without a team; no search states; no editor frame. Built (9c, PB-14 A, PB-17, PB-21): the `EmptyState` component; a whiteboard template card (board outline, name, description, "Use", no author); "Create a deck" in the header of the Planning poker section and dashed empty blocks per kind; "New template" for a manager only, always a retro template; the column titles of a preview are read by assistive technology, at the overline size; "used 0×" at zero, counted on the teams the viewer can see; no author line when the account is gone; without a team "Use" is `aria-disabled` with "Pick a team first"; while searching, a section without a match is hidden, and "No template matches…" with "Clear search" when none is left; the editor opens in a side sheet without the close cross; tab counts are text ("Retro · 4") | rule 3 (type scale); accessibility; B30 (visibility of the teams); plan 9-D1; parity row 23; to approve | visibility badge: WS-2 |
| D-95 | Security, recovery codes | one button "Regenerate codes" and "8 of 10 left · generated 12 March 2026". Built (RW-S4, PB-50 A, PB-51): two buttons on the row ("View recovery codes", hidden at zero codes, and "Regenerate codes"); ":left of :total recovery codes left", no "generated on" date; a warning at three codes or fewer and an error at zero, with wording that has no mockup; the alert has no button of its own (the plan asked for one: the button of the row sits beside it); a regeneration shows the new codes and is announced; "Regenerate codes" asks no confirmation, as the mockup's bare button | N: the date is not stored; O: fourth round (the alert); to approve (the missing confirmation is an owner decision) | stays |
| D-96 | Health check page | no mockup. Built (RW-T2): the page `teams/health-check` under the application layout, "Mood & ROTI" active in the sidebar although that entry leads to `#mood` of the team page (the ROTI card): the Mood trend is reached through "Manage" / "Details" of the side card only; an h1 "Health check", one sentence, the statements manager and the Mood trend in two columns from 80rem; "The trend could not be loaded." with "Retry" when the server cannot build it | O: fourth round (a page of its own); to approve | a link from the ROTI card to the page: backlog |

Rows of the retro lane (review of `lane/18e-back-a`, 2026-10-02). The lane numbered them D-R01 to D-R19; the integration of wave 4 renumbered them **D-97 to D-115** (D-R01 is D-97), in the plan and in `18e-report/02-retro.md`. Next free id: **D-116**. The owner has not read them: each one is **to approve**. Where none of the five reasons holds, the row says so and names what the difference rests on; the owner then keeps it, or the mockup's version is built.

| # | Screen | Mockup element not built, or built differently | Reason | Later |
|---|---|---|---|---|
| D-97 | Retro, Writing | built as the mockup since rework 3 (R3-1): every column ends with the dashed "Add a card" button, which opens one card in editing (N does too). What remains: the editing card has "GIF", "Cancel" and "Save" beside the two key hints; it sits at the foot of the column, in place of the button, and stays open after a card is published, ready for the next one, until "Cancel" or Esc; on a phone it opens in a drawer from the round button | O: rework 3, R3-1 ("Cancel" and "Save" stay visible, "GIF" stays within reach) and 2-D12 (the "Add a card…" field stays); A: a touch screen has no Esc and no ⌘↵ | stays |
| D-98 | Retro, Writing | "Visible only to you" is on its own line under the author; my card on an anonymous retro shows my name and "You", not "Anonymous"; a dragged card leaves a dimmed card, not the dashed ghost | N for the second (the server sends its author to the author only; no per-card anonymity). None of the five for the others: a 300px card has no room on the author's line; the ghost of `RetroCard` drops the reactions and comments mounted under the card | stays; the ghost: backlog |
| D-99 | Retro, header | "+2 min" and the menu that starts and stops the timer sit beside the countdown; the mockups put "+2 min" in the FacilitatorBar | O: 2-D8, third round ("+2 min" on every timer: `SessionTimer` carries it, plan Task 0.5) | stays |
| D-100 | Retro, header | the header also holds "Previous" and "Next", the settings button, the cursor toggle and the "…" facilitator menu; the mockup's topbar has the rail, the timer, the people and Share only. The line above the title reads "team · Retrospective" ("Retrospective" alone for a guest), built at the integration of wave 4 as on the three other rooms: there is no sprint to name | S: ruling 27 (settings and share in every phase). None of the five for "Previous" and "Next": the `PhaseStepper` of 18c, pressed by the browser suite. N for the line (no sprint, TM-1) | stays; TM-1 |
| D-101 | Retro, header | at 1440 the rail shows numbered markers and the label of the current phase only; the mockup shows every label. At session end the rail is its ticked markers without labels beside "Completed", and "Previous" is not drawn | none of the five: the rule of the 18c `PhaseStepper` (every label from 56rem of room); the retro has up to nine steps since B1 and B2 (D-03), which no header width of the mockup holds | stays |
| D-102 | Retro, Health check | the scale is 1 to 10 with the ends "Awful" and "Great" (mockup: 1 to 5, "Strongly disagree" / "Strongly agree"); no "Submit answers", each score is saved on its own; under each scale who answered, "n answered" and "Clear"; a check after a scored statement | N: the server scores 1 to 10 and has no submit endpoint (SV-5 leaves the phase untouched) | SV-5 |
| D-103 | Retro, Grouping and Voting | every card has "Comments (n)" and, where reacting is open, a dashed "Add a reaction" chip; the mockup's cards show the author and the grip only | O: 2-D9 (no feature lost) | stays |
| D-104 | Retro, Grouping | the grip is on a card alone; a group is dragged by its section and its cards are not draggable (they leave with "Ungroup"); the mockup draws a grip on every card. The suggestion bar is the AI group names, shown to everyone, in the frame of the mockup's duplicate suggestion | N: a grouped card cannot be dragged on its own; no duplicate detection (D-10) | stays |
| D-105 | Retro, Voting | the vote button is the thumb with the total, where the screen mockup draws "+ Vote"; "n of m votes cast" over a progress bar where the mockup has "5/8 have finished"; no live cursor | none of the five for the button: the `RetroCard` and `VoteDots` component mockups draw the thumb, the screen mockup "+ Vote". N for the sentence (no "finished" state, D-11). S: §9.1 for the cursors | RT-4 |
| D-106 | Retro, Discussing | the right card is "Action items" of the whole retro, not "Topic actions"; a presentation dialog shows the topic while everyone follows; "Previous topic" and "Next topic" carry their label; the title of a group is the one of its `CardGroup`, with rename and collapse | N: an item is not linked to a topic (RT-8). O: 2-D9 for the dialog (no feature lost). None of the five for the labels: `FacilitatorBar` has no icon-only action outside its compact form | RT-8 |
| D-107 | Retro, Actions | the facilitator bar is at the bottom centre, under the reaction bar, as in every phase; the mockup puts it at the bottom left under the topics and shows no reaction bar | S: spec §6.4 (one ReactionBar, stacked above the FacilitatorBar), ruling 27 | stays |
| D-108 | Retro, FacilitatorBar | "Lock board" is in the bar from Health check to Voting, the phases in which cards are written, grouped and voted; the mockups show it in Grouping only. From Discussing to ROTI the lock is in the settings popover alone, as in the mockups (it was also in the bar of ROTI before the review) | S: ruling 28 (every facilitator action that exists has a slot: the bar, then the popover) | stays |
| D-110 | Retro, ROTI | the screen lists no action item, as the mockup, and spec §9.1 now says so (rework 3, R3-3): the items stay editable on the server in `roti` and are ticked from the action items page, or after "Previous". A guest, who has no action items page, ticks one after "Previous" only | none of the five: the mockup is followed and the spec is aligned | closed by the owner; a compact list to tick stays in the backlog |
| D-111 | Retro, session end | the health card is `HealthCheckResults` (figures, radar, trend, one block per statement), not the six compact rows; the subline is "n participants." without the team name | S: plan R12 interface for the card. the snapshot carries the team name since the integration of wave 4, the subline does not use it yet | stays; the team name comes with RW-C2 |
| D-112 | Retro, session end | built as the mockup since rework 3 (R3-2): the reaction bar is docked bottom-centre under the results and under the "Board" tab, which keep room for it under their last card. What remains: on a phone the bar is the compact one, above the sticky actions | A: the phone has no room for six emoji above the sticky foot | closed: spec §9.1 amended (flying reactions are on in `completed`, never stored) |
| D-113 | Retro, phone | a card is not dragged with a finger: a sideways move, also one that starts on a card, goes to the next column (M10). Cards move from the keyboard, and are grouped from "Add to group…" in the menu of the card, not after a long press | A: one gesture has one meaning; a menu entry is reachable from the keyboard | stays |
| D-114 | Retro, phone | the header has no phase subtitle and its presence is the counter alone; the stepper is the phone form of `PhaseStepper` ("Phase n/m", the label, "Previous", "Next", a progress bar), not the compact rail; a vote is a button with the total and a "−" beside it, and the budget is the `VoteBudget` pill | none of the five: Task 0.3 and 0.4 (`SessionTitle` takes one line), the 18c `PhaseStepper` (the rail needs 36rem) and vote components | stays |
| D-115 | Guest join | the logo is drawn once, in the header of the centred `AuthFrame` (the card's own logo is off inside a page frame since wave 2a; the mockup has it in the card). At 390 the action is sticky inside the card, not glued to the bottom of the screen | none of the five: `AuthFrame` (Task 0.7) and `GuestJoin` (18c) each draw what their own mockup shows | backlog (one logo) |
| D-116 | Action items, header | the line reads "n open · n overdue · from n rituals"; the mockup says "n open or recent" | F: the count is the open items only (PB-02) | stays |
| D-117 | Action items, widths | the table starts at 80rem of viewport; from 48rem to 80rem the page shows the faceted toolbar over the list of `ActionItem`, which edits in place and has no sheet. The mockup shows the table beside the sidebar at every desktop width | none of the five: seven columns do not fit beside the sidebar below 80rem | stays, or a narrower table on the owner's word |
| D-118 | Action items, phone | the chips read "Mine n", "Overdue n", "To do n", "Done" (mockup: "Open", "Completed"); the list is grouped by the "Group by" control, not by retro; no long press to select | PB-04 (one vocabulary for the status on every width); N for the selection (D-19, AI-1) | stays; the selection with AI-1 |
| D-119 | Action items, table | "Edit" of the "…" menu opens the sheet, where the title is edited from its pencil; the ticket is the `ActionItemLinkChip` (provider and key), not the square and round marks; a date within three days reads "Fri, Oct 3 · in 3 days" (the browser's wording), not "· dans 3 j" | none of the five: `ActionSheet`, `ActionItemLinkChip` (18c) and `Intl.RelativeTimeFormat` as they are | stays |
| D-120 | Action items, filters | the page opens on the current team (PB-01). "Reset" and the cross of the Team facet both mean "every team", and that choice is kept for the next visits until a team is picked again; the mockup has no such memory | PB-01 A; none of the five for the memory (the old page already stored its filters) | stays, or "Reset returns to the current team" on the owner's word |
| D-121 | Surveys, card | a single-choice result reads "n · p%" like a multiple-choice one (the component mockup: "p%" alone); the overline of a card is the type alone ("Multiple choice"), the sentence "Several answers allowed" is gone; "Show who answered" is a switch. Voters, reactions, comments, close, reopen, withdraw, the AI draft and a Submit per card are kept | PB-24 A, PB-26, PB-27, PB-28 (no feature lost) | stays |
| D-122 | Surveys, column and editor | the surveys column, the editor dialog (the small `FormDialog`, 27.5rem; the old one was 32rem), the actions menu and the discussion foot have no mockup: composed from the column header, `FormDialog`, the card menu and the card reactions | N: no mockup | stays |
| D-123 | Surveys, completed results | a viewer who never answered a survey left open at the end sees its option labels without figures, and "No answers yet." for a text survey, possibly beside "3 responses"; the foot still says "Answer to join the discussion". The server shows results to who answered or once the survey is closed | none of the five: the server rule (`PresentSurvey`) is unchanged by the rewrite | on the owner's word: results visible to everyone once the retro is completed (one line of `PresentSurvey`, with its test) |
| D-124 | Retro, icebreaker | the facilitator's main button reads "Go to the retro" during the icebreaker; the game cards sit in the left column, read-only for a player, who sees them only from 80rem and not in Draw & Guess or Sprint in one GIF (the players hold that column: D-57); the reaction bar stays the board's fixed bar above the facilitator bar, so the stage ends 8rem above the bottom of the screen; no duration badge in the header | PB-30 A, PB-31; S: spec §6.4 (one ReactionBar above the FacilitatorBar, D-58) | stays |
| D-125 | Retro, icebreaker | a live cursor is placed against the stage wrapper, whose columns scroll on their own: two people scrolled differently see a pointer at the same place of the frame, not on the same element | none of the five: `GameLayout` columns scroll since RW-G1 | 18g, or backlog |
| D-126 | Guest join | the sentence under the button reads "No account and no e-mail needed. The others see your nickname.", plus "Cards are anonymous in this retro." on an anonymous retro; the mockup says the nickname is deleted at the end of the session and that cards can stay anonymous | F: nothing ever deletes a guest's nickname (PB-49) | stays |
| D-127 | Guest join | the field opens filled with the suggested nickname (the signed-in visitor's own name, cut at 50 characters, or a random one) and "Another random nickname" is always shown; the mockup shows an empty field with the proposal in the preview, and the button only in that empty state. The word lists stay under `resources/games/guest-names/` | O: 6-D9 (prefilled), PB-48 | stays |

---

# Step A — sequential, single writer

## Task 0: Preparation

Fifteen commits. Nothing in Task 0 changes how an existing page looks, except 0.8 (a landmark name), 0.13 (the GIF dialog) and 0.15 (the admin pages of plan 18d, brought in line with their mockup).

### Task 0.1: Branch, and the documents in the repository

The spec was amended on 2026-10-02 (amendment A1–A9 folded in, B17 to B45 added, rule 13) and committed on `plan-18d-branding` with this plan, the answered decisions file and the amendment pointer. This task only checks that and opens the branch.

**Files:** none modified. Read: `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` (header line "Amended 2026-10-02"), `docs/superpowers/research/front-rewrite/18e-owner-decisions.md`, `owner-answers-2026-10-02.md`, `18e-briefs/`.

- [ ] **Step 1:** `git status --short` is empty and `git log -1` is the last commit of plan 18d or of the document revision. Otherwise stop.
- [ ] **Step 2:** `grep -n "Amended 2026-10-02" docs/superpowers/specs/2026-10-01-front-rewrite-design.md` finds the header line, and `grep -c "^| B" …` finds the 45 items of §9. Otherwise stop: the spec this plan was written for is not in the tree.
- [ ] **Step 3:** `git switch -c plan-18e-screens`.
- [ ] **Step 4:** Create `docs/superpowers/research/front-rewrite/18e-report/README.md` with one line per group file that the screen tasks will write (`00-preparation.md` … `12-redirect.md`), and commit: `docs(front-rewrite): report folder of plan 18e`.

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
- Create: `resources/js/components/session/reconnecting-hints.ts`
- Modify: `resources/js/components/skrum/connection-state.tsx:21-32,200-226` (new prop `hint`), `resources/js/components/skrum/connection-state.test.tsx`

**Interfaces:**
- Consumes: `SessionLayout` (`@/layouts/skrum/session-layout`, props `{ title: ReactNode; phases?; timer?; presence?; actions?; children }`; no sidebar for a guest), `ConnectionState` (`status`, `variant`, `onReload`), `RealtimeState` (`'connecting' | 'connected'` from `@/lib/realtime/realtime-state`).
- Produces (used by R3, 3.1a, G3, 7.2):

```ts
export type SessionConnection = { reconnecting: boolean; expired: boolean };

/** The four live session types; picks the sentence of the reconnecting banner. */
export type SessionKind = 'retro' | 'poker' | 'game' | 'whiteboard';

export type SessionShellProps = {
    /** Session type: the reconnecting banner says what is true for it. */
    kind: SessionKind;
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
- Reconnecting is a full-width banner under the header (`role="status"`, `data-variant="banner"`, text "Reconnecting…" followed by the sentence of the session type), as the owner decided (X3). The header also shows the compact state the ScreenErrors mockup has in its topbar; it is wrapped in `aria-hidden` so that the banner is the only announcement (deviation D-05). The content stays usable while reconnecting.
- The banner never says "Your cards are kept locally…": no session type queues unsent changes (`grep -rn "pendingChanges" resources/js` finds only the component and its bench). `reconnecting-hints.ts` holds the sentence of each type:

```ts
// resources/js/components/session/reconnecting-hints.ts
import type { SessionKind } from './session-shell';

/** English keys; the shell translates them with t(). Each states only what is true for its session type. */
export const ReconnectingHints: Record<SessionKind, string> = {
    retro: 'Live updates are paused. What you see may be out of date.',
    poker: 'Live updates are paused. What you see may be out of date.',
    game: 'Live updates are paused. The round may have moved on.',
    whiteboard:
        "Live updates are paused. Other people's changes appear when the connection returns.",
};
```

  `TranslationKeysTest` scans for literal `t('…')` calls, so the shell translates through a `switch` on `kind` with one literal call per sentence, and this map is used by the test only.
- `ConnectionState` gains `hint?: string`: in the banner variant it replaces the "kept locally" sentence. Without `hint` the component behaves as before.
- An expired session is a banner (`role="alert"`, "Your session has expired.", button "Reload") above content that is `inert`.
- A page that has ended (deleted, access lost, room full) still renders `SessionShell`, with the title only and an `EmptyState` as children.
- The title is an `<h1>` inside the header. It is not a direct child of `<header>` (the frame wraps the slot): a test that binds `header > h1` changes to `header h1` in the commit of its screen.

- [ ] **Step 1: Write the failing test**

```tsx
// resources/js/components/session/session-shell.test.tsx
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReconnectingHints } from '@/components/session/reconnecting-hints';
import { SessionShell } from '@/components/session/session-shell';
import { SessionTitle } from '@/components/session/session-title';
import { renderWithProviders } from '@/test/render';

function renderShell(
    connection = { reconnecting: false, expired: false },
    kind: 'retro' | 'poker' | 'game' | 'whiteboard' = 'retro',
) {
    return renderWithProviders(
        <SessionShell
            kind={kind}
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

    it('shows a full-width banner while reconnecting and keeps one data-realtime', () => {
        const { container } = renderShell({ reconnecting: true, expired: false });
        const banner = screen.getByRole('status');

        expect(banner.getAttribute('data-variant')).toBe('banner');
        expect(banner.textContent).toContain('Reconnecting…');
        expect(banner.textContent).toContain(ReconnectingHints.retro);
        expect(container.querySelectorAll('[data-realtime]')).toHaveLength(1);
        expect(screen.queryByText(/kept locally/)).toBeNull();
        expect(screen.getByText('board').closest('[inert]')).toBeNull();
    });

    it('says what is true for each session type', () => {
        for (const kind of ['retro', 'poker', 'game', 'whiteboard'] as const) {
            const { unmount } = renderShell({ reconnecting: true, expired: false }, kind);

            expect(screen.getByRole('status').textContent).toContain(ReconnectingHints[kind]);
            unmount();
        }
    });

    it('keeps the compact state of the topbar out of the accessibility tree', () => {
        const { container } = renderShell({ reconnecting: true, expired: false });

        expect(screen.getAllByRole('status')).toHaveLength(1);
        expect(
            container.querySelector('header [aria-hidden="true"] [data-slot="connection-state"]'),
        ).not.toBeNull();
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
import { useTrans } from '@/hooks/use-trans';
import SessionLayout from '@/layouts/skrum/session-layout';
import type { RealtimeState } from '@/lib/realtime/realtime-state';
import { cn } from '@/lib/utils';

export type SessionConnection = { reconnecting: boolean; expired: boolean };

export type SessionKind = 'retro' | 'poker' | 'game' | 'whiteboard';

export type SessionShellProps = {
    kind: SessionKind;
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

function useReconnectingHint(kind: SessionKind): string {
    const { t } = useTrans();

    switch (kind) {
        case 'game':
            return t('Live updates are paused. The round may have moved on.');
        case 'whiteboard':
            return t(
                "Live updates are paused. Other people's changes appear when the connection returns.",
            );
        default:
            return t('Live updates are paused. What you see may be out of date.');
    }
}

export function SessionShell({
    kind,
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
    const reconnectingHint = useReconnectingHint(kind);

    return (
        <SessionLayout
            title={title}
            phases={phases}
            timer={timer}
            presence={presence}
            actions={
                <>
                    {isReconnecting && (
                        <span aria-hidden="true" className="flex">
                            <ConnectionState status="reconnecting" variant="pill" />
                        </span>
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
                {isReconnecting && (
                    <ConnectionState
                        status="reconnecting"
                        variant="banner"
                        hint={reconnectingHint}
                        className="m-2"
                    />
                )}
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

In `resources/js/components/skrum/connection-state.tsx`, add `hint?: string;` to `ConnectionStateProps`, destructure it, and in the banner branch replace

```tsx
                    {isOffline || status === 'reconnecting' ? (
                        <> {keptLocally}</>
                    ) : null}
```

by

```tsx
                    {hint !== undefined ? (
                        <> {hint}</>
                    ) : isOffline || status === 'reconnecting' ? (
                        <> {keptLocally}</>
                    ) : null}
```

and add to `connection-state.test.tsx`:

```tsx
    it('shows the given hint in place of the kept-locally sentence', () => {
        renderWithProviders(
            <ConnectionState status="reconnecting" variant="banner" hint="Live updates are paused." />,
        );

        expect(screen.getByRole('status').textContent).toContain('Live updates are paused.');
        expect(screen.queryByText(/kept locally/)).toBeNull();
    });
```

Add the three sentences to the four `lang/*.json` files.

- [ ] **Step 4: Run** both test files (PASS), `npm run types:check`, `npm run check`, `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php`.
- [ ] **Step 5: Commit**: `feat(session): session shell with the single realtime root and the connection banner`.

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

    it('keeps the five avatars and the counter of the mockup', () => {
        const many = Array.from({ length: 10 }, (_, index) => ({
            id: `p${index}`,
            name: `Person ${index}`,
            avatarUrl: `/avatars/${index}.svg`,
            isGuest: false,
        }));
        const { container } = renderWithProviders(
            <SessionPresence online={many} selfId="p0" />,
        );

        expect(container.querySelectorAll('[data-presence-id]')).toHaveLength(5);
        expect(screen.getByRole('group', { name: '10 online' })).toBeTruthy();
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

/** Below `sm` the mockups show the counter alone; above, the stack's own five avatars. */
const VisibleOnPhone = 0;

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
            max={isMobile ? VisibleOnPhone : undefined}
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
- Modify: `resources/js/components/skrum/timer.tsx:36-52,188-191,297-303` (prop `addSeconds`), `resources/js/components/skrum/timer.test.tsx`

**Interfaces:**
- Consumes: `Timer`, `TimerPreset`, `DefaultTimerPresets` (`skrum/timer.tsx`: the pill has `role="timer"`, shows `m:ss`, and at zero shows `0:00` with `data-state="done"` and the accessible name "Time's up!"; the menu trigger is named "Timer"; entries "1 min", "3 min", "5 min", "10 min", "Stop timer", and "Custom…" when `onCustom` is given), `useCountdown(endsAt, offset)`.
- Produces:

```ts
/** Toast "Time's up!" and a beep, once per end time, only if this client saw the timer running. */
export function useTimerAlarm(endsAt: string | null, remaining: number | null): void;

export type SessionTimerProps = {
    endsAt: string | null;
    /** Server clock offset in milliseconds. */
    offset: number;
    /** Never passed by a page: every screen has the Timer's own list, 1, 3, 5, 10 minutes (X5, spec ruling 19). */
    presets?: TimerPreset[];
    /** Seconds chosen at start, for the ring; absent for a late joiner. */
    totalSeconds?: number;
    /** Given only to who may start and stop (the facilitator, the host). */
    onStart?: (seconds: number) => void;
    onStop?: () => void;
    /** Poker only: opens its custom-duration dialog (kept by the owner beside 1/3/5/10). */
    onCustom?: () => void;
    /** B20, the four session types: adds two minutes to the running timer. Shown as "+2 min" while a timer runs. */
    onExtend?: () => void;
    /** false in a game room: it shows <TimeUpBadge> instead of a toast. */
    alarm?: boolean;
    className?: string;
};

export function SessionTimer(props: SessionTimerProps): ReactElement | null;

/** Destructive badge "Time's up", rendered by a game inside <main>, next to the stage title. */
export function TimeUpBadge(props: { endsAt: string | null; offset: number }): ReactElement | null;
```

Convention (answers notes R4; the owner confirmed it, X4):

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
    onExtend?: () => void;
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
    onExtend,
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
            onAdd={onExtend ? () => onExtend() : undefined}
            addSeconds={120}
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

`skrum/timer.tsx` adds one minute today (`onAdd(60)` at lines 190 and 302, label "+1 min"). The mockups of the retro show "+2 min" and B20 adds 120 seconds, so the component gains `addSeconds?: number` (default 60): the two calls become `onAdd(addSeconds)` and the label becomes `t('+:count min', { count: addSeconds / 60 })`. Add to `timer.test.tsx`:

```tsx
    it('offers "+2 min" when told to add 120 seconds', () => {
        const onAdd = vi.fn();

        renderWithProviders(
            <Timer remainingSeconds={90} onStart={() => {}} onStop={() => {}} onAdd={onAdd} addSeconds={120} />,
        );

        fireEvent.click(screen.getByRole('button', { name: '+2 min' }));
        expect(onAdd).toHaveBeenCalledWith(120);
    });
```

and to `session-timer.test.tsx`:

```tsx
    it('shows "+2 min" only when it can extend and a timer runs', () => {
        const { rerender } = renderWithProviders(
            <SessionTimer endsAt={inTenSeconds} offset={0} onStart={() => {}} onStop={() => {}} />,
        );

        expect(screen.queryByRole('button', { name: '+2 min' })).toBeNull();

        rerender(
            <SessionTimer endsAt={inTenSeconds} offset={0} onStart={() => {}} onStop={() => {}} onExtend={() => {}} />,
        );

        expect(screen.getByRole('button', { name: '+2 min' })).toBeTruthy();
    });
```

If the "+" control of `timer.tsx` is a menu item and not a button, the two tests query `menuitem` after opening the "Timer" menu; read lines 290–310 first.

`components/retro/timer-display.tsx` is not edited: old poker and whiteboard keep it until their screens; F1 deletes it.

- [ ] **Step 4: Run** the test (PASS), `npm run types:check`, `npm run check`.
- [ ] **Step 5: Commit**: `feat(session): shared session timer with the end-of-time alarm`.

### Task 0.6: Reaction engine and the session reaction bar

**Files:**
- Create: `resources/js/components/session/use-flying-reactions.ts`, `session-reactions.tsx`, `session-reaction-picker.tsx`, `session-reactions.test.tsx`
- Modify: `resources/js/components/retro/emoji-picker.tsx` (exports `EmojiSearchDialog`; `EmojiPicker` unchanged for its callers)
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

`SessionReactions` renders `<LiveReactions reactions label>` and `<ReactionBar onReact={send} picker={<SessionReactionPicker onPick={send} />}>`. The picker follows the mockup (K14, flipped): the "add" button of the bar opens the design system's grid, not the old dropdown.

`SessionReactionPicker({ onPick })`, in `session-reaction-picker.tsx`: a ghost icon button named "Send a reaction" (`SmilePlus`) that opens a `Popover`; inside, `ReactionPickerGrid` (`skrum/reaction-picker.tsx`) with `emojis` = `QuickEmoji` of `lib/retro/emoji.ts`, the quick list the old dropdown offered, `mine={[]}`, `onToggle={onPick}`, `label={t('Send a reaction')}`; under the grid, a ghost button "More emoji…" that closes the popover and opens the emoji search dialog. That dialog exists inside `retro/emoji-picker.tsx` (lines 125–160: `Dialog`, frimousse, the field "Search emoji…"); this task extracts it in the same file as an exported `EmojiSearchDialog({ open, onOpenChange, label, onPick })`, which `EmojiPicker` keeps using, so the card reactions do not change. Keeping "More emoji…" is deviation D-01 (the full emoji set is an existing feature), and it keeps the two hooks the browser suite binds: `click('More emoji…')` and `button[frimousse-emoji]`.

It never passes `incoming`: the flight stays in the library overlay, which `Plan07BoardEngagementTest.php:887-918` and `Plan17aWhiteboardCoreTest.php:541-546`, `Plan17cWhiteboardFacilitationTest.php:768-774` read (`.lr-overlay` with the emoji and the sender name).

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
import type { HTMLAttributes } from 'react';
import { ReactionBar } from '@/components/skrum/reaction-bar';
import { SessionReactionPicker } from './session-reaction-picker';
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
                picker={<SessionReactionPicker onPick={send} />}
            />
        </>
    );
}
```

```tsx
// resources/js/components/session/session-reaction-picker.tsx
import { SmilePlus } from 'lucide-react';
import { useState } from 'react';
import { EmojiSearchDialog } from '@/components/retro/emoji-picker';
import { ReactionPickerGrid } from '@/components/skrum/reaction-picker';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTrans } from '@/hooks/use-trans';
import { QuickEmoji } from '@/lib/retro/emoji';

export function SessionReactionPicker({ onPick }: { onPick: (emoji: string) => void }) {
    const { t } = useTrans();
    const [gridOpen, setGridOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);

    function pick(emoji: string): void {
        onPick(emoji);
        setGridOpen(false);
        setSearchOpen(false);
    }

    return (
        <>
            <Popover open={gridOpen} onOpenChange={setGridOpen}>
                <PopoverTrigger asChild>
                    <Button size="icon-sm" variant="ghost" aria-label={t('Send a reaction')}>
                        <SmilePlus aria-hidden />
                    </Button>
                </PopoverTrigger>
                <PopoverContent side="top" className="flex flex-col gap-2 p-2">
                    <ReactionPickerGrid
                        emojis={QuickEmoji}
                        mine={[]}
                        onToggle={pick}
                        label={t('Send a reaction')}
                    />
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            setGridOpen(false);
                            setSearchOpen(true);
                        }}
                    >
                        {t('More emoji…')}
                    </Button>
                </PopoverContent>
            </Popover>
            <EmojiSearchDialog
                open={searchOpen}
                onOpenChange={setSearchOpen}
                label={t('Send a reaction')}
                onPick={pick}
            />
        </>
    );
}
```

`QuickEmoji` is the quick list the old dropdown shows (`lib/retro/emoji.ts`).

In `realtime/flying-reactions.tsx`, replace the roster, bucket and transport code (lines 59–96) by `const { reactions, send } = useFlyingReactions({ presence, selfId, online, originFor });` and re-export the two origin helpers from the new module.

- [ ] **Step 4: Run** the test (PASS), `npm run types:check`, `npm run check`, `npm run build:front`, then `Plan07BoardEngagementTest.php` and `Plan17aWhiteboardCoreTest.php` with the single-file command (the old boards still fly reactions).
- [ ] **Step 5: Commit**: `feat(session): reaction engine extracted, session reaction bar on ReactionBar`.

### Task 0.7: Centred auth frame, access notice and the guest-join page

**Places left (feature roadmap):** the colour picker and the short code of the guest-join card (GU-1, GU-2): `GuestJoin` already has the props `takenColors` and `session.code`; the page passes neither.

**Files:**
- Modify: `resources/js/components/skrum/frames.tsx:168-223` (`AuthFrame`), `resources/js/components/skrum/frames.test.tsx`
- Modify: `resources/js/layouts/skrum/auth-layout.tsx`, `resources/js/layouts/skrum/auth-layout.test.tsx`
- Create: `resources/js/components/auth/access-notice.tsx`, `access-notice.test.tsx`
- Create: `resources/js/components/session/guest-join-page.tsx`, `guest-join-page.test.tsx`
- Modify: `resources/js/components/skrum/guest-join.tsx` (`stickyAction`), `guest-join.test.tsx`

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
    /** null: the guest link is no longer valid (the server answered 404). The last three come from B45 (Task R2a). */
    session: {
        title: string;
        gameLabel?: string;
        facilitatorName?: string | null;
        participantsCount?: number;
        isLive?: boolean;
    } | null;
    /** URL of the join POST (`RetroJoinsController.store.url(token)`, …). */
    storeUrl: string | null;
    suggestedName?: string | null;
    /** Extra named controls, e.g. the poker `#spectator` switch. */
    children?: ReactNode;
    /** Extra fields of the POST body read from the form (`spectator`). */
    extraFields?: string[];
};
export function GuestJoinPage(props: GuestJoinPageProps): ReactElement;
```

`centered`: one column, the header with the logo and `headerEnd`, the content centred with `max-w-120`, the `title` rendered as a visually hidden `<h1>`, no aside. `GuestJoinPage` renders `<AuthLayout variant="centered" title={session?.title ?? invalidTitle}>` and, inside, `GuestJoin` or `<AccessNotice title={invalidTitle} description={t('This guest link is no longer valid.')}>`; it posts `{ name, ...extraFields }` with `router.post(storeUrl, …)`, maps `errors.name` to `error`, and passes `initialName={suggestedName ?? undefined}`. It maps the B45 fields to the lines the GuestJoin mockup shows: `facilitator` = `facilitatorName`, `participants` = `participantsCount`, `status` = `'live'` when `isLive`. Until R2a lands the pages send none of them and the lines are absent. At 390 the join button is sticky at the bottom, as MobileAccess shows: `GuestJoin` has no sticky mode today, so this task adds `stickyAction?: boolean` to it (the button's wrapper becomes `sticky bottom-0` with the card's background and a top border) with a test in `guest-join.test.tsx`, and `GuestJoinPage` passes it on a phone (`useIsMobile`).

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

The section renders `SessionShell` with every slot filled at its worst case: a 120-character title with two badges, `PhaseStepper` with the nine phases, `SessionTimer` running, `SessionPresence` with twelve people, an actions slot with the cursor toggle, a Share button and a menu; then the same with the reconnecting banner (once per session type, so the four sentences are captured), and with the expired banner. The reaction bar is shown floating over a tall content.

- [ ] **Step 1:** Write the visual test: captures `session-shell` in light and dark, at 390 and 1440, in EN and FR; it fails on horizontal overflow and asserts `assertCount('[data-realtime]', 3)` (three shells on the bench page) and that the header of each shell is 3.5rem tall at 1440.
- [ ] **Step 2:** Write the section. If the header overflows at 390, the fix is in the bench's use of the slots (compact stepper, three avatars, icon-only actions), not in `frames.tsx`; a change to `SessionFrame` is reported first.
- [ ] **Step 3: Run** `npm run check`, `npm run types:check`, `npm run test`, `vendor/bin/sail artisan test --parallel --processes=8 --compact`, `npm run build:front`, the visual test with the single-file command, then `bin/test-browser`. All green.
- [ ] **Step 4: Commit**: `test(session): bench section and captures of the session shell`.

### Task 0.15: Admin pages of plan 18d in line with the mockup; topbar actions slot

**Places left (feature roadmap):** the other entries of the admin navigation column and the version line under the host (AD-1, AD-2): the navigation takes its entries from a list.

Rule 13 applies to the screens already built. The differences are listed in `.superpowers/sdd/2026-10-15-plan-18d-front-rewrite-branding/reports/integrator.md` under "Differences with the mockup"; the mockup is ScreenSettings frame b (Branding block). This task follows the screen task procedure.

**Read first:** that report section; `docs/design-system/` ScreenSettings README and `preview.html`, frame b; `resources/js/components/admin/admin-shell.tsx` and the files of `components/admin/`; `resources/js/pages/admin/branding.tsx`, `admin/admins.tsx`; `tests/Browser/Walkthroughs/Plan18dBrandingTest.php`, `tests/Browser/Visual/AdminPagesVisualTest.php`.

**Files:**
- Modify: `resources/js/layouts/skrum/app-layout.tsx` and its test — new prop `actions?: ReactNode`, rendered at the end of the topbar, before the bell (used here for the unsaved-changes bar and by 5.2 for "New action item")
- Modify: `resources/js/components/admin/admin-shell.tsx` — the mockup's admin navigation column
- Modify: the branding containers under `resources/js/components/admin/` (the form, the preview, the logo cards, the colour field, the reset card), `resources/js/pages/admin/branding.tsx`
- Modify: `resources/js/pages/dev/sections/` (the admin section), `tests/Browser/Visual/AdminPagesVisualTest.php`
- Tests: `resources/js/components/admin/*.test.tsx`, `tests/Browser/Walkthroughs/Plan18dBrandingTest.php`

**What changes, one line per difference of the report:**

| Difference | Built now |
|---|---|
| Sub-navigation of two entries inside the app layout; no domain or self-host badge | `AdminShell` renders the mockup's navigation column inside the page (spec ruling 14): a `nav` named "Administration" with the sections that exist (Branding, Admins), the instance host (`window.location.host`) under it and the "Self-host" badge in the topbar. The sections of the mockup that do not exist are not listed (deviation D-35) |
| Unsaved bar at the top of the content | the bar ("n unsaved changes", Cancel, Save) is passed to `AppLayout` through `actions` and sits in the topbar |
| Preview column 20rem, with a button, badge, selected card and focus ring | 27.5rem (a `@theme` size if the scale lacks it), with the mockup's content: the bar, the switch and the column card, and its Light / Dark toggle |
| Three image cards; uploads act at once | one logo drop zone in the mockup's style, with a segmented choice Light logo / Dark logo / Favicon above it (the dark logo and the favicon are additions the mockup lacks, kept and placed in its style). A dropped file is staged: the preview shows it from an object URL and it counts as an unsaved change; on Save the staged files are sent first through the existing `admin.brandingAssets.store` route (a removed image through `admin.brandingAssets.destroy`), then the settings form. No back-end change |
| Applied colour shown for both themes with a badge each; warning as a text line | the mockup's contrast badge beside the field, and the auto-adjust notice with the two mini swatches (entered → applied) and the arrow. The second theme's applied value stays, as a second line of the same notice |
| Radius has an exact value field | the mockup's segmented control with four values (Square, Soft, Standard, Round = 0, 4, 8, 16 px). The server keeps accepting 0 to 16; an instance whose stored value is none of the four shows no segment selected and its exact value in a field beside the segments (0 to 16 px, editable; owner's fourth round, RW-S2), and saves only when changed. While nothing is stored, the default of 10 px reads "Standard" as the mockup and no field shows. Each staged image (a file or a removal) has an "Undo" button in the drop zone, which takes back that image alone (RW-S2) |
| Avatar grid lists 31 styles with licences | the mockup's radiogroup of seven styles and a "31 styles" entry that expands the full list; the licence stays on the About page (B7) and as the tile's title |
| GIF settings, "Powered by Skrüm", member choice and Reset card are additions; Reset is a card at the bottom | the three additions stay, each as a card of the mockup's style under the mockup's blocks; "Back to Skrüm" is a button in the section header, with its confirmation |

**Interfaces — produces:** `AppLayout({ active?, breadcrumbs?, actions?, children })`; `AdminShell({ active, actions?, children })` passes `actions` through.

**Browser tests changed** (imposed by ScreenSettings frame b): in `Plan18dBrandingTest.php` — the navigation selector of the admin sub-navigation becomes `nav[aria-label="Administration"]`; "Save" and "Cancel" are read in `header`; the three upload cards become one drop zone with the segmented choice (select the variant, then upload), and the assertion that an upload is applied moves after the click on "Save"; the radius field `fill` becomes a click on the segment; "Reset" is clicked in the section header. Confirm each line while reading the test; `[data-slot="avatar-style-card"]` (`P18d-06`) and the confirm-password flow are unchanged.

**New tests:** Vitest — the unsaved count includes a staged file; Cancel drops it and revokes the object URL; the radius segment maps to 0, 4, 8, 16; a stored value of 6 shows "Soft" selected. Browser `[P18e-00-01]` — a staged logo shows in the preview before Save and on the login page after Save.

**Run:** `npm run test -- resources/js/components/admin resources/js/layouts/skrum`; `tests/Feature/Admin`, `tests/Feature/Branding` (unchanged, must stay green); browser `Plan18dBrandingTest.php`, `Visual/AdminPagesVisualTest.php`; then the Task 0 gate again (`bin/test-browser`).

**Commit:** `feat(admin): branding and admins pages in line with the mockup`

---

## Group 1 — Session creation (after Task 0)

Brief: `18e-briefs/01-session-creation.md`. Layout: none changes (a dialog over `teams/show`, which stays on the old layout until 4.1). Ten tasks: five back-end tasks, then the dialog shell with the retro form, the poker form, the whiteboard form, the Icebreaker form, and the saved decks page. The brief's fourth commit (C4, "New room") is done by G1 (K9). Constraint K20: no colour literal in this group (fixtures and the editable column list take colours from `serverColumnColors`).

What the owner changed in this group: one "New session" trigger and the type chosen in the dialog (1-D2); five shortcut cards and "Browse" (1-D3); four types, the Poll type arriving with plan 19 (1-D4, third round); workspace-level decks (third round); the saved decks as a page (3-D3); the templates manager confirming in a dialog (1-D8). What rule 13 added: the editable column list, the guest switch, the poker tasks and "Watch only" (M1 to M3).

### Task 1.0a: Most used retro templates of the team (B17) — back end

**Read first:** spec §9.2 B17, criterion 14; `app/Support/RetroTemplates/TemplateCatalogue.php`, `app/Models/WorkspaceTemplate.php` (`catalogueKey()`, `KeyPrefix`), `app/Actions/Retros/CreateRetro.php:29-34` (how `template` and `workspace_template_id` are stored), `app/Http/Controllers/TeamsController.php`.

**Files:**
- Create: `app/Actions/Retros/TopTeamTemplates.php`, `tests/Feature/Retros/TopTeamTemplatesTest.php`
- Modify: `app/Support/RetroTemplates/TemplateCatalogue.php` (constant `Shortcuts`), `app/Http/Controllers/TeamsController.php` (`'topTemplates' => $topTeamTemplates->handle($team)`), the props type of `resources/js/pages/teams/show.tsx` (`topTemplates: string[]`)

**Interfaces — produces:**

```php
// TemplateCatalogue
/** @var list<string> The five shortcut cards of a team that has no retro yet, in order. */
public const Shortcuts = ['went_well_to_improve_actions', 'start_stop_continue', 'four_ls', 'sailboat', 'mad_sad_glad'];

// App\Actions\Retros\TopTeamTemplates
/** @return list<string> exactly five catalogue keys, most used first */
public function handle(Team $team): array;
```

One grouped query over `retros` (`team_id`, `template`, `workspace_template_id`, `count(*)`, `max(created_at)`), ordered by count then by last use; a row with a `workspace_template_id` becomes `WorkspaceTemplate::KeyPrefix.$id` when that template still belongs to the team's workspace and is dropped otherwise; `TemplateCatalogue::Custom` and `TemplateCatalogue::Workspace` rows without an id are dropped; the list is completed from `Shortcuts`, without duplicates, and cut to five.

**Feature tests (written first):** a team without a retro gets `Shortcuts` in order; three retros on `sailboat` and one on a workspace template give `sailboat`, then `workspace:{id}`, then the fallback without `sailboat`; with equal counts the most recently used comes first; a retro on `custom` and a retro whose workspace template was deleted change nothing; the retros of another team are not counted; the list always holds five distinct keys; `teams/show` carries the prop (`assertInertia` … `->where('topTemplates.0', 'sailboat')`).

**Consumed by:** 1.1. **Run:** `vendor/bin/sail artisan test --compact tests/Feature/Retros/TopTeamTemplatesTest.php tests/Feature/Teams`. **Commit:** `feat(teams): most used retro templates of the team (B17)`

### Task 1.0b: Icebreaker session type (B18) — back end

**Read first:** spec §9.2 B18, criterion 15; `app/Http/Controllers/TeamGameRoomsController.php` (`index`: `gameOptions`, `canCreate`, `roomLimit`), `TeamsController@show`, `tests/Feature/Teams/TeamsTest.php`.

**Files:** modify `app/Http/Controllers/TeamsController.php` (`gameOptions`, `canCreateGameRoom`, `roomLimit`), the props type of `teams/show`; extend `tests/Feature/Teams/TeamsTest.php`.

**What changes:** `TeamsController@show` adds `gameOptions` (`$gameRulesRegistry->options(new GameRoom(['team_id' => $team->id]))`), `canCreateGameRoom` (`can('createGameRoom', $team)` and fewer than `GameRoom::MaxRoomsPerTeam` standalone rooms) and `roomLimit`. No route changes: the Icebreaker type posts to the existing `teams.games.store`. Nothing is added for a poll: the Poll type is the standalone survey of plan 19 and `TeamRetrosController` is not touched by this task.

**Feature tests (written first):** `teams/show` carries `gameOptions` with the same shape as `games/index`; `canCreateGameRoom` is false at the room limit and for a user who may not create a room; `roomLimit` equals `GameRoom::MaxRoomsPerTeam`.

**Consumed by:** 1.4. **Run:** `vendor/bin/sail artisan test --compact tests/Feature/Teams`. **Commit:** `feat(teams): icebreaker session type props (B18)`

### Task 1.0c: Default deck, duplicate and usage of saved decks (B21) — back end

**Read first:** spec §9.2 B21, criterion 18 (usage counts start from the change: no backfill, third round); `app/Http/Controllers/PokerDecksController.php`, `app/Policies/PokerDeckPolicy.php`, `app/Actions/Poker/SavedPokerDeckRules.php` (`nameRules`, `ensureRoom`, `findForTeam`, `MaxDecks`), `app/Actions/Poker/CreatePokerGame.php`, `NewPokerGame.php`, `app/Http/Controllers/TeamPokerGamesController.php`, `app/Http/Controllers/Poker/PokerSettingsController.php:85-100`, `app/Http/Controllers/Whiteboards/WhiteboardDuplicatesController.php` (the convention for a "duplicate" controller), `database/migrations/2026_10_03_100100_create_poker_decks_table.php`, `tests/Feature/Poker/SavedPokerDecksTest.php`, `PokerSavedDeckGamesTest.php`.

**Files:**
- Create: a migration `add_default_deck_and_usage_to_poker_tables` (up only): `teams.default_poker_deck` (`string(30)`, nullable), `teams.default_saved_poker_deck_id` (`foreignUuid`, nullable, `constrained('poker_decks')`, `nullOnDelete`), `poker_games.saved_deck_id` (same shape). No backfill: a game created before the migration keeps `saved_deck_id` null and counts for no deck
- Create: `app/Http/Controllers/TeamDefaultPokerDecksController.php` (`update`), `app/Http/Requests/DefaultPokerDeckUpdateRequest.php`, `app/Http/Controllers/PokerDeckDuplicatesController.php` (`store`)
- Create: `tests/Feature/Poker/DefaultPokerDeckTest.php`, `PokerDeckDuplicateTest.php`, `PokerDeckUsageTest.php`
- Modify: `app/Models/Team.php`, `PokerGame.php`, `SavedPokerDeck.php` (fillable, PHPDoc, relations `defaultSavedPokerDeck()`, `savedDeck()`, `games()`), their factories; `app/Actions/Poker/NewPokerGame.php` (`?string $savedDeckId = null`), `CreatePokerGame.php`, `TeamPokerGamesController.php` (passes the saved deck's id), `PokerSettingsController.php` (sets or clears `saved_deck_id` with the deck); `TeamsController.php` (`defaultPokerDeck`); `routes/web.php` (next to line 246); the props type of `teams/show`

**Interfaces — produces:**

```php
// routes, inside the team group
Route::put('teams/{team}/default-poker-deck', [TeamDefaultPokerDecksController::class, 'update'])->name('teams.defaultPokerDeck.update');
Route::post('teams/{team}/poker-decks/{pokerDeck}/duplicate', [PokerDeckDuplicatesController::class, 'store'])->name('teams.pokerDecks.duplicate.store')->whereUuid('pokerDeck');

// DefaultPokerDeckUpdateRequest::rules()
[
    'deck' => ['nullable', 'required_without:saved_deck_id', 'prohibits:saved_deck_id', Rule::enum(PokerDeck::class)->except(PokerDeck::Custom)],
    'saved_deck_id' => ['nullable', 'required_without:deck', 'uuid'],
]
// authorize(): $this->user()->can('update', $this->route('team'))

// teams/show
'defaultPokerDeck' => ['deck' => $team->default_poker_deck, 'savedDeckId' => $team->default_saved_poker_deck_id],
```

`TeamDefaultPokerDecksController@update` writes one column and nulls the other; a `saved_deck_id` is resolved with `SavedPokerDeckRules::findForTeam` (404 for a deck of another team). `PokerDeckDuplicatesController@store` authorises `create` on `[SavedPokerDeck::class, $team]`, locks the team as `PokerDecksController@store` does, calls `SavedPokerDeckRules::ensureRoom`, and creates the copy named `__('Copy of :name', …)` cut to 40 characters, with " 2", " 3"… appended (and the base cut further) while the name is taken; it answers `back()`.

**Feature tests (written first):** default — a member without `update` on the team gets 403; a built-in value is stored and clears the saved id; a saved deck of the team is stored and clears the built-in; `custom`, both fields, and a deck of another team are refused; deleting the default saved deck leaves both columns null; `teams/show` carries `defaultPokerDeck`. Duplicate — the copy has the same cards and the name "Copy of Fibonacci+"; a second copy is "Copy of Fibonacci+ 2"; a 40-character name still yields a valid, unique 40-character name; refused at `MaxDecks`; 403 for a user who cannot view the team. Usage — a game created from a saved deck stores `saved_deck_id`; changing its deck in the settings clears it; **a game that existed before the migration, created from a deck of the same name, has `saved_deck_id` null and is not counted** (Review Focus 6).

**Consumed by:** 1.2 (preselection), 1.5 (page). **Run:** `vendor/bin/sail artisan test --compact tests/Feature/Poker tests/Feature/Teams`; `php artisan wayfinder:generate`. **Commit:** `feat(poker): default deck, duplicate and usage of saved decks (B21)`

### Task 1.0e: Workspace-level decks (B30) — back end

**Read first:** spec §9.2 B30 ("Workspace decks"), criterion 27, §15 point 1; `database/migrations/2026_10_03_100100_create_poker_decks_table.php` (the team index and the unique index on `lower(name)`), `app/Models/SavedPokerDeck.php`, `app/Policies/PokerDeckPolicy.php`, `app/Actions/Poker/SavedPokerDeckRules.php` (`nameRules`, `ensureRoom`, `findForTeam`, `MaxDecks`), `app/Http/Controllers/PokerDecksController.php`, `WorkspaceWhiteboardTemplatesController.php` (the convention of a workspace-owned resource), `TeamsController::pokerDecks()`, `app/Http/Controllers/Poker/PokerSavedDecksController.php`, the files of 1.0c.

**Files:**
- Create: a migration `add_workspace_to_poker_decks_table` (up only): `foreignUuid('workspace_id')->nullable()->constrained()->cascadeOnDelete()`; `team_id` becomes nullable; on PostgreSQL, a check constraint `(team_id is null) <> (workspace_id is null)` and `create unique index poker_decks_workspace_name_unique on poker_decks (workspace_id, lower(name)) where workspace_id is not null` (the same `DB::getDriverName()` guard as the existing migration)
- Create: `app/Http/Controllers/WorkspacePokerDecksController.php` (`store`, `update`, `destroy`), `app/Http/Requests/WorkspacePokerDeckRequest.php`, `tests/Feature/Poker/WorkspacePokerDecksTest.php`
- Modify: `SavedPokerDeck.php` (`workspace()` relation, `isWorkspaceDeck(): bool`, PHPDoc, fillable), its factory (state `forWorkspace(Workspace $workspace)`), `app/Models/Workspace.php` (`pokerDecks()`), `PokerDeckPolicy.php`, `SavedPokerDeckRules.php` (`findForTeam` accepts a deck of the team's workspace; `nameRules` and `ensureRoom` gain a workspace variant), `TeamsController::pokerDecks()`, `PokerSavedDecksController@index`, `TeamDefaultPokerDecksController` (a workspace deck of the team's workspace is a valid default), `routes/web.php` (next to line 354), the deck types in `resources/js/types/poker.ts`

**Interfaces — produces:**

```php
// routes, inside the workspace group
Route::post('poker-decks', [WorkspacePokerDecksController::class, 'store'])->name('workspaces.pokerDecks.store');
Route::patch('poker-decks/{pokerDeck}', [WorkspacePokerDecksController::class, 'update'])->name('workspaces.pokerDecks.update')->whereUuid('pokerDeck');
Route::delete('poker-decks/{pokerDeck}', [WorkspacePokerDecksController::class, 'destroy'])->name('workspaces.pokerDecks.destroy')->whereUuid('pokerDeck');

// PokerDeckPolicy
public function createForWorkspace(User $user, Workspace $workspace): bool; // $user->canManage($workspace)
// manage(): a workspace deck is managed by who canManage its workspace; a team deck as today
// a deck reached through a route of another workspace, or of a team of another workspace, is 404
```

Every deck list gains `scope` (`'team'` or `'workspace'`); a workspace deck's `canManage` is true for a workspace manager only. `WorkspacePokerDeckRequest` holds the rules of `PokerDecksController@store` (name, cards, the two special-card flags), with the name unique in the workspace; `authorize()` calls the policy. The limit is `SavedPokerDeckRules::MaxDecks` per workspace, checked under a lock of the workspace row, as the team controller locks the team.

**Feature tests (written first):** a workspace manager creates, renames and deletes a workspace deck; a plain member gets 403 on the three; a deck of workspace A is 404 through the routes of workspace B; the name is unique per workspace, case-insensitive, and may equal a team deck's name; the limit; a workspace deck is listed, with `scope: 'workspace'`, on `teams/show` of every team of the workspace and in the game settings list, and on no team of another workspace; a game is created from it (`saved_deck_id` set); a team takes it as its default, and deleting it clears that default; a row with both owners, or with none, is refused by the database on PostgreSQL; the existing `SavedPokerDecksTest` stays green.

**Consumed by:** 1.2, 1.5, 3.1b, 9.0b, 9c. **Run:** `vendor/bin/sail artisan test --compact tests/Feature/Poker tests/Feature/Teams`; `php artisan wayfinder:generate`. **Commit:** `feat(poker): workspace-level decks (B30)`

### Task 1.0d: Session creation options the mockup shows (B37) — back end

**Read first:** spec §9.3 B37, criterion 36; `app/Http/Controllers/TeamRetrosController.php`, `TeamPokerGamesController.php`, `TeamWhiteboardsController.php`; `app/Actions/Retros/NewRetro.php`, `CreateRetro.php:81-95` (`columns()`); `app/Http/Requests/WorkspaceTemplateRequest.php` (the rules of a column list: count, title, description, colour); `app/Actions/Poker/AddPokerTask.php` (`MaxTasks`), `app/Http/Controllers/Poker/PokerTasksController.php:32` (title rule); `app/Actions/Poker/CreatePokerGame.php` (how the creator becomes a player).

**Files:**
- Modify: the three `store` methods (added rules), `app/Http/Requests/WorkspaceTemplateRequest.php` (constant `MaxColumns`), `NewRetro.php` (`bool $guestAccessEnabled = false`, `?array $columns = null`), `CreateRetro.php`, `NewPokerGame.php` (`bool $guestAccessEnabled = false`, `bool $spectator = false`, `array $tasks = []`), `CreatePokerGame.php`, `app/Actions/Whiteboards/CreateWhiteboard.php` (guest flag)
- Tests: `tests/Feature/Retros/CreateRetroTest.php`, `tests/Feature/Poker/CreatePokerGameTest.php`, `tests/Feature/Whiteboards/CreateWhiteboardTest.php`

**Added rules:**

```php
// teams.retros.store
'guest_access_enabled' => ['sometimes', 'boolean'],
'columns' => ['sometimes', 'array', 'min:1', 'max:'.WorkspaceTemplateRequest::MaxColumns],
'columns.*.title' => ['required', 'string', 'max:100'],
'columns.*.description' => ['nullable', 'string', 'max:200'],
'columns.*.color' => ['required', Rule::enum(ColumnColor::class)],

// teams.pokerGames.store
'guest_access_enabled' => ['sometimes', 'boolean'],
'spectator' => ['sometimes', 'boolean'],
'tasks' => ['sometimes', 'array', 'max:50'],
'tasks.*' => ['required', 'string', 'max:200'],

// teams.whiteboards.store
'guest_access_enabled' => ['sometimes', 'boolean'],
```

`WorkspaceTemplateRequest` writes its limit as the literal `max:10` (line 29); this task gives it the constant `public const MaxColumns = 10`, uses it there, and reuses it here, so that a template and a retro cannot drift. `CreateRetro` uses `columns` in place of the template's when it is given; `retros.template` keeps the chosen key. `CreatePokerGame` creates the tasks in order through `AddPokerTask` and sets `is_spectator` on the creator's player.

**Feature tests (written first):** a retro created with three columns has those three, in order, with their colours, and the template key it was given; an unknown colour, an empty title and one column too many are refused; `guest_access_enabled` is stored on the three session types and is false by default; a game created with `spectator` has its creator watching; `tasks` creates the tasks in order with positions 1…n (the `AddPokerTask` convention); 51 titles and a 201-character title are refused; the existing creation tests stay green.

**Consumed by:** 1.1, 1.2, 1.3. **Run:** `vendor/bin/sail artisan test --compact tests/Feature/Retros/CreateRetroTest.php tests/Feature/Poker/CreatePokerGameTest.php tests/Feature/Whiteboards/CreateWhiteboardTest.php`. **Commit:** `feat(teams): guest access, columns, tasks and watch-only at session creation (B37)`

### Task 1.1: New session dialog shell with the retro form

**Places left (feature roadmap):** in the right settings column, the rows "Max per card" and "Timer per phase" (SE-3, RT-3); in the footer, "Schedule…" beside "Create & open" (SE-2); the Poll tile (SV-1). `SettingRow`s come from a list and the footer takes a `secondaryAction` slot.

**Read first:** brief 01 §3 rows 1–19, 53, 54; §4 (`new-session-dialog`, `retro-session-fields`, `setting-row`, `lib/retro/template-adapter.ts`); §8. ScreenSessionCreate README and `preview.html`, retro variant: type tiles, left column (name, template shortcuts, columns list), right settings, footer.

**Files:**
- Create: `resources/js/components/teams/session-create/new-session-dialog.tsx`, `retro-session-fields.tsx`, `retro-columns-editor.tsx`, `setting-row.tsx`, `use-new-session-intent.ts`, and their Vitest files
- Create: `resources/js/lib/retro/template-adapter.ts`, `template-adapter.test.ts`
- Create: `resources/js/pages/dev/sections/session-create.tsx`, `tests/Browser/Visual/SessionCreateVisualTest.php`, `tests/Browser/Walkthroughs/Plan18eSessionCreateTest.php`
- Modify: `resources/js/pages/teams/show.tsx` (one "New session" trigger in the page header; the "New retrospective" trigger of the retros section goes; the "New game" and "New whiteboard" triggers stay until 1.2 and 1.3)
- Delete: `resources/js/components/teams/new-retro-dialog.tsx`

**Interfaces:**
- Consumes: `SessionTypePicker` (`variant="tiles"`, `as="radiogroup"`), `RetroTemplatePicker` (`blankId` default `'custom'`, `shortcuts`), `ColumnColorPicker`, `Dialog` / `Drawer`, `useIsMobile`; props `topTemplates` (1.0a), `catalogue`; the `columns` and `guest_access_enabled` fields of 1.0d; `workspaces.templates.store` for "Save as team template".
- Produces:

```ts
export type SessionType = 'retro' | 'poker' | 'whiteboard' | 'icebreaker';

/** One trigger, one dialog. A type is offered when its form is passed; a type whose form is passed with `disabledReason` is shown disabled with that reason. */
export function NewSessionDialog(props: {
    trigger: ReactNode;
    team: { id: string; name: string };
    intent?: NewSessionIntent | null;
    retro?: RetroSessionForm;
    poker?: PokerSessionForm;          // 1.2
    whiteboard?: WhiteboardSessionForm; // 1.3
    icebreaker?: IcebreakerSessionForm; // 1.4
}): ReactElement;

/** Read once from the URL: ?new=retro|poker|whiteboard&template=<key>&deck=<id>. Opens the dialog on that type and choice, then removes the query. Used by the team page and, through a link, by the templates page (9c). */
export type NewSessionIntent = { type: SessionType; template?: string; deck?: string };
export function useNewSessionIntent(): NewSessionIntent | null;

export function toRetroTemplate(item: CatalogueTemplate): RetroTemplate;
export function shortcutTemplates(catalogue: CatalogueTemplate[], topTemplates: string[]): RetroTemplate[]; // five, in the order of topTemplates; a key absent from the catalogue is skipped
export function SettingRow(props: { label: string; htmlFor: string; help?: string; children: ReactNode }): ReactElement;
export function RetroColumnsEditor(props: { value: DraftColumn[]; onChange: (columns: DraftColumn[]) => void; max: number; errors?: Record<string, string> }): ReactElement;
```

**Composition (the mockup, element by element):** type tiles on top (Retrospective preselected): four types. The mockup's fifth tile, Poll, is not rendered; `SessionTypePicker` receives its options as a list, so plan 19 adds the entry and its form without touching the dialog (place left: the `poll` form prop is simply absent from `NewSessionDialog` today). Left column: Name; the template radiogroup of five shortcut cards from `topTemplates`, then "Browse", which opens the full `RetroTemplatePicker` (search, categories, tabs Built-in / My workspace, detail) in place of the shortcuts, with "Back" to return; under it the columns of the chosen template as an editable list (`RetroColumnsEditor`: reorder handle with keyboard support, title, colour radiogroup, "Add a column", delete), sent as `columns` only when the user changed something. Right column: switches Anonymous cards, Health check, Anonymous guests allowed (`guest_access_enabled`); stepper Votes per person (with "Automatic"); Icebreaker at the start with its game select; the AI summary row (no mockup: placed last, in the same row style); checkbox "Save as team template", shown to who may manage templates, which posts the edited columns to `workspaces.templates.store` and then creates the retro from the new template. Footer: Cancel, "Create & open". Not built, with their row in "Deviations": Max per card, Timer per phase, ROTI at the end (D-07), the invitation link inside the dialog (D-08), the Sessions page behind (D-06).

**Browser tests changed** (imposed by ScreenSessionCreate, by `RetroTemplatePicker/README.md`, and by the owner's answers 1-D1, 1-D2, 1-D3):
- Trigger (1-D2): `click('New retrospective')` → `click('New session')` in `Plan04RetroCoreTest.php` (1), `Plan08aFlowAndTemplatesTest.php` (3), `Plan08bHealthCheckTest.php` (1), `Plan08eLlmTest.php` (3), `Plan13dIcebreakerScoresInvitesTest.php` (1). Retrospective is preselected, so no type click is added.
- `Plan04RetroCoreTest.php:79-90`: `[role="dialog"] li button…` → `[role="dialog"] [role="radiogroup"][aria-label="Retrospective template"] [role="radio"]`; `aria-pressed` → `aria-checked`. The radiogroup holds the five shortcuts; the test picks one of them, or clicks "Browse" first when its template is not among the five of a new team (`TemplateCatalogue::Shortcuts`).
- `Plan08aFlowAndTemplatesTest.php` `P08a-01a` (160-215), `01b` (220-250), `03` (350-375): `click('Browse')` first (1-D3), then the same selector change; counts exclude "Start from scratch"; preview = `section[aria-label="Template preview"]`; swatch classes → `bg-skrum-col-*`; "Common templates" / "More templates" assertions removed (the tabs replace the sections); no-match text → `No template matches "…"`; "Empty board" → "Start from scratch"; the click on "Settings" removed; "Workspace templates" → click the tab "My workspace".
- `Plan08bHealthCheckTest.php:250-260`, `Plan08eLlmTest.php:126-131,252-262,701-710`, `Plan13dIcebreakerScoresInvitesTest.php:172-196`: template selector as above; the click on the "Settings" collapsible removed.
- Unchanged and checked: `#new-retro-title`, `#new-retro-anonymous`, `#new-retro-health-check`, `#new-retro-icebreaker`, `#new-retro-icebreaker-game`, `#new-retro-votes-auto`, `#new-retro-ai-summary`, `[aria-label="Search templates"]`, `[aria-label="Category"] button` (both after "Browse"), `[role="dialog"] button[type="submit"]`.

**New tests:** `[P18e-01-01]` the type picker keeps each type's fields when switching; `[P18e-01-02]` "Browse", tab "My workspace", creates from a workspace template; `[P18e-01-03]` Enter in the name submits; `[P18e-01-06]` at 375 px the dialog is a full-height drawer with a reachable footer; `[P18e-01-09]` the five shortcuts of a team that ran three Sailboat retros start with Sailboat; `[P18e-01-10]` a column renamed, one added and two reordered in the dialog are the columns of the created board; `[P18e-01-11]` "Anonymous guests allowed" opens the guest link of the new retro; `[P18e-01-12]` `?new=retro&template=four_ls` opens the dialog with 4Ls selected and leaves a clean URL. Vitest: `template-adapter.test.ts` (`shortcutTemplates` order and skipping of unknown keys), `new-session-dialog.test.tsx` (type switch keeps state; submit target per type; a type without a form is absent), `retro-columns-editor.test.tsx` (add, rename, recolour, keyboard reorder, the maximum, `columns` is sent only when changed), `use-new-session-intent.test.ts`.

**Run:** `npm run test -- resources/js/lib/retro/template-adapter.test.ts resources/js/components/teams/session-create`; browser files `Plan04RetroCoreTest.php`, `Plan08aFlowAndTemplatesTest.php`, `Plan08bHealthCheckTest.php`, `Plan08eLlmTest.php`, `Plan13dIcebreakerScoresInvitesTest.php`, `Plan18eSessionCreateTest.php`, `Visual/SessionCreateVisualTest.php`.

**Commit:** `feat(session-create): new session dialog shell with the retro form`

### Task 1.2: Poker form on DeckPicker and DeckEditor

**Places left (feature roadmap):** the third Tasks tab "Import from Jira", and the rows "Change vote after reveal", "Timer per task", "Write estimates to Jira" (SE-3): the tabs and the rows come from lists.

**Read first:** brief 01 §3 rows 20–35; §4 (`poker-session-fields`, `lib/poker/deck-adapter.ts`). ScreenSessionCreate, poker variant: deck radio with value preview, Tasks tabs, switches, footer.

**Files:**
- Create: `resources/js/components/teams/session-create/poker-session-fields.tsx`, `poker-tasks-field.tsx` and their tests
- Create: `resources/js/lib/poker/deck-adapter.ts`, `deck-adapter.test.ts`, `resources/js/lib/poker/deck-payload.ts` (moved from `deck-fields.tsx`: `deckPayload`, `splitCustomCards`, `deckChoiceFromGame`)
- Modify: `resources/js/components/poker/deck-fields.tsx` (imports the three helpers; group 3 deletes the file), `resources/js/components/skrum/deck-picker.tsx` (`Deck.source` gains `'custom'`, badge "This game only"; decision 1-D5) and its test; `resources/js/pages/teams/show.tsx` (the "New game" trigger goes; the poker form is passed to the one dialog)
- Delete: `resources/js/components/teams/new-poker-game-dialog.tsx`
- Not touched: `resources/js/components/teams/saved-decks-dialog.tsx` (replaced by the page in 1.5)

**Interfaces:**
- Consumes: `NewSessionDialog` (1.1), the deck lists of 1.0e (team and workspace decks, the latter with a "Workspace" badge), `DeckPicker` (`onCreate`, `Deck.canManage`), `DeckEditor` (`idPrefix`, `nameRequired`, `saveLabel`, `errors`), `deckShapeFromCards`; props `defaultPokerDeck` (1.0c); fields `guest_access_enabled`, `spectator`, `tasks` (1.0d).
- Produces: `toDeck(option: PokerDeckOption): Deck`, `toSavedDeck(saved: SavedPokerDeck): Deck`, `customDeckToPayload(draft): Record<string, unknown>`, `serverErrorsToDeckErrors(errors): { name?: string; values?: string }`, `initialDeckId(decks: Deck[], defaultPokerDeck, intentDeck?: string): string`; `lib/poker/deck-payload.ts` exports for 3.1b. Custom deck editor uses `idPrefix="deck-custom"` (1-D6): `#deck-custom-cards` (unchanged), `#deck-custom-unknown`, `#deck-custom-coffee`, `#deck-custom-name`.

**Composition:** Name; deck radiogroup (built-in and saved decks, the team's default preselected, a deck named by `?deck=` wins) with the value preview and "Create a deck" (a one-off deck, or a saved one when named); Tasks with two tabs, "Type them" (one title per line, 50 at most, a counter) and "Later" (preselected); switches Auto reveal, Facilitator "Watch only" (`spectator`), Anonymous votes (no mockup: same row style), Anonymous guests allowed; footer "Create & open". Not built: the Jira import tab, "Change vote after reveal", "Timer per task", "Write estimates to Jira" (D-07), "Schedule…" (D-06).

**Browser tests changed** (imposed by `DeckPicker/README.md`, `DeckEditor/README.md`, ScreenSessionCreate and 1-D2):
- Trigger: `click('New game')` → `click('New session')` then `[role="radio"]:has-text("Planning poker")` in `Plan10aPokerCoreTest.php` (2) and `Plan10bPokerAdditionsTest.php` (1).
- `Plan10aPokerCoreTest.php` `P10a-02` (96-118), `P10a-03` (136-152): radio count scoped `[aria-label="Deck"] [role="radio"]` (4 built-in decks); chips from the picker's preview; open "Create a deck" then `#deck-custom-cards`; `#deck-include-unknown` → `#deck-custom-unknown`, `#deck-include-coffee` → `#deck-custom-coffee`; `3, 3` is refused by the editor ("Duplicate value: 3") before the server; `click('Create game')` → `click('Create & open')`.
- `Plan10bPokerAdditionsTest.php`: `Create game` → `Create & open` wherever a game is created; `#new-poker-anonymous`, `#new-poker-auto-reveal`, `#new-poker-title` unchanged. The saved-decks tests (`P10b-01`, `02a`, `02b`) change in 1.5, not here.

**New tests:** `[P18e-01-04]` "Create a deck" with a name creates the game and a saved deck, without a name a one-off deck; `[P18e-01-13]` three typed tasks are the queue of the new game, in order; `[P18e-01-14]` "Watch only" at creation: the creator arrives watching; `[P18e-01-15]` the team's default deck is preselected. Vitest `deck-adapter.test.ts`: payload for a built-in, a saved and a one-off deck; `custom_cards.N` and `save_deck_as` errors mapped to `values` and `name`; `initialDeckId` order (intent, default saved, default built-in, first built-in).

**Run:** the Vitest files; `tests/Feature/Poker` (unchanged, must stay green); browser `Plan10aPokerCoreTest.php`, `Plan10bPokerAdditionsTest.php`, `Plan18eSessionCreateTest.php`.

**Commit:** `feat(session-create): poker form on DeckPicker and DeckEditor`

### Task 1.3: Whiteboard form and template gallery, templates manager

**Read first:** brief 01 §3 rows 36–46; §4 (`whiteboard-session-fields`, `whiteboard-template-gallery`); brief 04 §3 rows 19–23 (selectors of the manager).

**Files:**
- Create: `resources/js/components/teams/session-create/whiteboard-session-fields.tsx`, `whiteboard-template-gallery.tsx`
- Rewrite in place: `resources/js/components/teams/whiteboard-templates-dialog.tsx`, `whiteboard-template-preview.tsx`
- Modify: `resources/css/app.css` (`@theme` token for the preview paper, pure white, 1-D5); `resources/js/pages/teams/show.tsx` (the "New whiteboard" trigger goes; the whiteboard form is passed to the one dialog)
- Delete: `resources/js/components/teams/new-whiteboard-dialog.tsx`

**Interfaces:**
- Consumes: `NewSessionDialog` (1.1), `RadioGroupCardItem`, `ConfirmDialog` (the manager confirms a deletion in a dialog, 1-D8); the field `guest_access_enabled` (1.0d).
- Produces: `WhiteboardTemplateGallery({ items, value, onValueChange, loading, error })` — two `radiogroup`s named "Template" (built-in, workspace), tile = preview surface (`div` direct child) + `span.font-medium` name + `span.text-muted-foreground` description.

**Browser tests changed** (imposed by ScreenSessionCreate, 1-D2 and 1-D8):
- Trigger: `button:text-is("New whiteboard")` → `click('New session')` then `[role="radio"]:has-text("Whiteboard")` in `Plan17aWhiteboardCoreTest.php` (1) and `Plan17bWhiteboardTemplatesTest.php` (8, with the helper `p17bCreateBoard()`); `Support/InteractsWithWhiteboards.php` if it opens the dialog (read it).
- `Plan17aWhiteboardCoreTest.php:38-42`: the checked radio scoped to `[aria-label="Template"]`; `form button:text-is("Create")` → "Create & open".
- `Plan17bWhiteboardTemplatesTest.php` `P17b-03`, `-05`, `-06`, `-07`, `-08`, `-12`, `-15` and helper `p17bCreateBoard()`: radiogroup and radio counts scoped to `[role="dialog"] [aria-label="Template"]`; default `$createLabel = 'Create & open'`.
- Templates manager (1-D8): `div.bg-muted button:text-is("Delete")` and the text "Delete this template?" → the row's "Delete :name" button, then `[role="alertdialog"]` and its "Delete" button.
- Unchanged and checked: `#whiteboard-title`; the manager's selectors `[role="dialog"] li:has(p:text-is("…"))`, `input[maxlength="80"]`, `input[maxlength="300"]`, `form button:text-is("Save")`, "No whiteboard templates yet."; the white preview surface of `P17b-07`.

**New tests:** `[P18e-01-05]` arrows pick a template in the gallery; a workspace template sends `workspace_template_id` and no `template`; `[P18e-01-08]` captures in dark and FR without overflow (`SessionCreateVisualTest`); `[P18e-01-16]` cancelling the confirmation keeps the template.

**Run:** browser `Plan17aWhiteboardCoreTest.php`, `Plan17bWhiteboardTemplatesTest.php`, `Plan18eSessionCreateTest.php`, `Visual/SessionCreateVisualTest.php`.

**Commit:** `feat(session-create): whiteboard form and template gallery, templates manager`

### Task 1.4: Icebreaker form

**Read first:** spec §9.2 B18; ScreenSessionCreate (the type tiles); `resources/js/components/games/new-room-dialog.tsx` (the fields a room needs; G1 rewrites that dialog, this task does not touch it).

**Files:**
- Create: `resources/js/components/teams/session-create/icebreaker-session-fields.tsx` and its test
- Modify: `resources/js/pages/teams/show.tsx` (passes the form)

**Interfaces:**
- Consumes: `NewSessionDialog` (1.1); props `gameOptions`, `canCreateGameRoom`, `roomLimit` (1.0b); `IcebreakerGameGrid` / `IcebreakerGameCard`; `TeamGameRoomsController.store`.
- Produces: `IcebreakerSessionForm`.

**Composition:** Name, the game as cards (unavailable games disabled with their reason), Access; the tile is disabled with "This team already has :count game rooms." at the room limit and absent for a user who may not create a room.

**Places left (feature roadmap):** the Poll tile and its form (SV-1).

**Browser tests changed:** none.

**New tests:** `[P18e-01-18]` Icebreaker: the room opens on the chosen game; at the room limit the tile is disabled with its reason; the dialog offers four types and no Poll. Vitest: the form's payload.

**Run:** browser `Plan18eSessionCreateTest.php`, `Plan13aGamesFoundationTest.php`.

**Commit:** `feat(session-create): icebreaker type`

### Task 1.5: Saved decks page

**Read first:** spec §9.2 B21, criterion 18; ScreenPokerQueue, "Saved decks" page: deck cards with usage, Default badge, built-in decks locked with Duplicate, custom decks with Edit / Duplicate, "Create a custom deck", New deck; `DeckPicker/README.md`, `DeckEditor/README.md`; brief 03 §3 rows 61–63, brief 04 §3 rows 42–44.

**Files:**
- Back end: `app/Http/Controllers/PokerDecksController.php` (`index`), `routes/web.php` (`Route::get('teams/{team}/poker-decks', [PokerDecksController::class, 'index'])->name('teams.pokerDecks.index')`), `tests/Feature/Poker/SavedDecksPageTest.php`
- Create: `resources/js/pages/poker/decks.tsx` (`AppLayout active="sessions"`, breadcrumbs team › Saved decks), `resources/js/components/poker/saved-decks-page.tsx`, `deck-card.tsx` and their tests; add `poker/decks` to `page-layouts.ts`
- Modify: `resources/js/pages/teams/show.tsx` ("Saved decks" becomes a link to the page), `tests/Browser/Visual/SessionCreateVisualTest.php` (captures of the page)
- Delete: `resources/js/components/teams/saved-decks-dialog.tsx`

**Interfaces — `index` props:** `workspace`, `team`, `builtInDecks` (`key`, `name`, `cards`, `isDefault`, `usageCount`), `savedDecks` (`id`, `name`, `cards`, `scope`, `isDefault`, `usageCount`, `canManage`: the team's decks and the workspace's, 1.0e), `canCreate`, `canSetDefault`, `deckLimit`. `usageCount` counts this team's games only, from the change on (no backfill), through `withCount('games')` for saved decks and one grouped query on `poker_games.deck` for the built-ins; with no stored default, the first built-in deck has `isDefault`.

**Feature tests (written first):** a team member gets the page with the built-in and saved decks; 403 for a user who cannot view the team; `isDefault` follows the two columns and falls back to the first built-in; `usageCount` counts the team's games only; `canManage` is true for the creator and a workspace admin; `canSetDefault` follows `update` on the team.

**Composition:** a grid of deck cards: name, value preview, "Used n times", "Default" badge; a built-in card shows a lock and "Duplicate" (posts its cards to `teams.pokerDecks.store` under "Copy of :name"); a saved card shows "Edit :name", "Duplicate" (`teams.pokerDecks.duplicate.store`), "Delete :name" (with confirmation) when `canManage`; a workspace deck carries the badge "Workspace", is edited here only by a workspace manager, and its "Duplicate" makes a team deck; "Set as default" on any card when `canSetDefault`; "Create a deck" opens `DeckEditor` (`idPrefix="deck-new"`).

**Browser tests changed** (imposed by ScreenPokerQueue and the answers 3-D3, 1-D7): `Plan10bPokerAdditionsTest.php` `P10b-01` (60-100), `02a` (120-160), `02b` (160-190): `click('Saved decks')` opens a page (`assertPathEndsWith('/poker-decks')`), the `[role="dialog"]` scopes of the list go; "New deck" → "Create a deck"; chip selector → the card's preview values; "Edit deck" / "Delete deck" → "Edit :name" / "Delete :name"; the deletion is confirmed in `[role="alertdialog"]`; the `#deck-new-*` ids of the editor are unchanged.

**New tests:** `[P18e-01-07]` a manager sees Edit and Delete on a saved deck, another member does not; `[P18e-01-19]` "Set as default" moves the badge and the new-session dialog preselects that deck; `[P18e-01-20]` Duplicate of a built-in and of a saved deck; `[P18e-01-21]` the usage count rises after a game is created from the deck.

**Run:** `vendor/bin/sail artisan test --compact tests/Feature/Poker`; browser `Plan10bPokerAdditionsTest.php`, `Plan18eSessionCreateTest.php`, `Visual/SessionCreateVisualTest.php`; then the group gate (`bin/test-browser`, PHP suite) and G-visual-1.

**Commit:** `feat(poker): saved decks page with default, duplicate and usage`

---

## Group 2 — Retro (after Group 1)

Brief: `18e-briefs/02-retro.md`. Eighteen tasks; R2a, R2b, R2c and R12a are back-end tasks. What the owner changed in this group: "+2 min" (2-D8; on every timer since the third round, so lanes P, G and W have their own extension task), the topics-only discussion (2-D9), the duration (2-D6), confetti (2-D13), the reconnecting banner (X3), the delete confirmation and "(Guest)" of action items (5-D3, 5-D7). What rule 13 added: M4 to M10 and M28. Layout: `SessionShell kind="retro"` (Task 0.3), rendered by `components/retro/board.tsx`. Until its own commit, a phase keeps its old components mounted inside the new shell (they only need `useBoard()` from `board-context.tsx`, which keeps its API to the end of the plan). Files kept with the same exports for group 8: `board-context.tsx`, `comment-thread.tsx` (`CommentThreadList`), `reaction-chips.tsx` (`ReactionChips`), `emoji-picker.tsx` (`EmojiPicker`), and the eight survey files.

### Task R1: Eight column colours (B10)

**Read first:** brief 02 §7.4; spec §9 B10.

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

### Task R2a: Guest-join page data for the four session types (B45) — back end

**Read first:** spec §9.3 B45, criterion 44; `app/Http/Controllers/RetroJoinsController.php`, `PokerJoinsController.php`, `GameJoinsController.php`, `WhiteboardJoinsController.php` (`show`: what each sends today, and how an invalid token answers 404); `resources/js/components/skrum/guest-join.tsx` (`session.facilitator`, `participants`, `status`).

**Files:**
- Create: `app/Actions/Sessions/PresentJoinSession.php` (four small methods, one per session type, so that the four controllers build the same shape), `tests/Feature/Sessions/JoinSessionPropsTest.php`
- Modify: the four `*JoinsController@show`; the props types of the four join pages

**Interfaces — produces:**

```php
/**
 * @return array{title: string, gameLabel?: string, facilitatorName: ?string, participantsCount: int, isLive: bool}
 */
public function retro(Retro $retro): array;      // participants()->count(); isLive = phase is not Completed
public function poker(PokerGame $game): array;   // players()->count(); isLive = ended_at is null
public function game(GameRoom $room): array;     // players()->count(); isLive = true; gameLabel = $room->game->label()
public function whiteboard(Whiteboard $board): array; // members count; isLive = true
```

`facilitatorName` is the display name of the facilitator (participant, player, host or member) or `null`. Each controller sends the result as `session`, next to what it sends today (the pages read the old keys until their own task). `app/Actions/Sessions` is a new folder under `app/Actions`, like its siblings; it is not a new base folder.

**Feature tests (written first):** for each of the four types — a valid guest link carries `session` with the title, the facilitator's name, the number of people who have joined and `isLive`; **an invalid token, and a valid token of a session whose guest access is off, carry no `session`** (Review Focus 7); the prop never holds an e-mail, a vote or a card; a completed retro and an ended poker game have `isLive` false.

**Consumed by:** R2, 3.2, G2, 7.1. **Run:** `vendor/bin/sail artisan test --compact tests/Feature/Sessions tests/Feature/Retros/GuestJoinTest.php tests/Feature/Poker/PokerJoinTest.php tests/Feature/Games/GameJoinTest.php tests/Feature/Whiteboards`. **Commit:** `feat(sessions): facilitator, people and state on the guest-join pages (B45)`

### Task R2: Guest join and session ended

**Read first:** brief 02 §3.6 rows 99–101; brief 11 §3 rows 32, 35–39 (K2).

**Files:**
- Rewrite: `resources/js/pages/retros/join.tsx`, `resources/js/pages/retros/session-ended.tsx`
- Modify: `resources/js/lib/page-layouts.ts` (`retros/join`, `retros/session-ended`)

**Interfaces — consumes:** `GuestJoinPage` (`kind="retro"`, `invalidTitle={t('Join a retrospective')}`, `session` = the `session` prop of R2a, `storeUrl={RetroJoinsController.store.url(guestToken)}`), `AuthLayout variant="centered"`, `AccessNotice` (`title={t('Your session has ended.')}`, `hint={t('Guests: ask the facilitator for the guest link.')}`, action = link "Log in" to `login()`). `session-ended` is rendered by the middlewares of the four session types: groups 3, 6 and 7 do not touch it.

**Browser tests changed:** none. Checked: `joinAsGuest` (`#name`, `click('Join')`), "This guest link is no longer valid." (`Plan04:477`), "Your session has ended." / "Guests: ask the facilitator for the guest link." / "Log in" (`Plan06:461-463`, `Plan17a:421-422`).

**Run:** browser `Plan04RetroCoreTest.php`, `Plan06PolishPassTest.php`, `Smoke/HarnessTest.php`; the visual test `tests/Browser/Visual/RetroPagesVisualTest.php` is created here with the join, the invalid link and session-ended.

**Commit:** `feat(retro): guest join and session ended`

### Task R2b: "+2 min" on a running retro timer (B20) — back end

**Read first:** spec §9.2 B20 (the table: this task is its Retro row), criterion 17, §15 point 3; `app/Http/Controllers/Retros/RetroTimersController.php` (the whole file: guards, lock, event, icebreaker expiry), `app/Events/Retros/TimerChanged.php`, `tests/Feature/Retros/FacilitationTest.php` (the timer tests), `routes/web.php:394`.

**Files:**
- Create: `app/Http/Controllers/Retros/RetroTimerExtensionsController.php` (`store`), `tests/Feature/Retros/TimerExtensionTest.php`
- Modify: `routes/web.php` (after the `retros.timer.update` line: `Route::post('timer/extension', [RetroTimerExtensionsController::class, 'store'])->name('retros.timer.extension.store');`), `app/Http/Controllers/Retros/RetroTimersController.php` (constant `MaxSeconds = 7200`, used by its own rule)

**Interfaces — produces:** `POST retros/{retro}/timer/extension`, no body, answers `{ "timerEndsAt": "<ISO 8601>" }`. Constants `RetroTimerExtensionsController::ExtensionSeconds = 120`.

```php
public function store(Request $request, Retro $retro, ScheduleIcebreakerExpiry $scheduleIcebreakerExpiry): JsonResponse
{
    $participant = Participant::current($request);

    RetroGuard::facilitator($retro, $participant);
    RetroGuard::open($retro);

    $endsAt = DB::transaction(function () use ($retro, $participant, $scheduleIcebreakerExpiry): CarbonInterface {
        $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

        RetroGuard::facilitator($locked, $participant);
        RetroGuard::open($locked);

        if ($locked->timer_ends_at === null || $locked->timer_ends_at->isPast()) {
            throw ValidationException::withMessages(['timer' => __('No timer is running.')]);
        }

        $endsAt = $locked->timer_ends_at->copy()->addSeconds(self::ExtensionSeconds);

        if (now()->diffInSeconds($endsAt) > RetroTimersController::MaxSeconds) {
            throw ValidationException::withMessages(['timer' => __('A timer cannot run longer than two hours.')]);
        }

        $locked->update(['timer_ends_at' => $endsAt]);

        (new TimerChanged($locked->id, $endsAt->toIso8601String()))->sendToOthers();

        $scheduleIcebreakerExpiry->handle($locked);

        return $endsAt;
    });

    return response()->json(['timerEndsAt' => $endsAt->toIso8601String()]);
}
```

**Feature tests (written first):** with a timer that ends in 60 seconds the answer is the end moved by 120 seconds, the column holds it, and `TimerChanged` is broadcast to others with it; 422 with an error on `timer` when no timer runs, when the timer has ended, and when the result would leave more than 7 200 seconds; 403 for a participant who is not the facilitator and for a guest; refused on a completed retro as `RetroGuard::open` refuses today; during the icebreaker phase the round expiry is rescheduled (assert the job as the existing timer test does).

**Consumed by:** R3. **Run:** `vendor/bin/sail artisan test --compact tests/Feature/Retros/TimerExtensionTest.php tests/Feature/Retros/FacilitationTest.php`; `php artisan wayfinder:generate`. **Commit:** `feat(retro): extend a running timer by two minutes (B20)`

### Task R2c: Who has written, who has voted on ROTI (B38) — back end

**Read first:** spec §9.3 B38, criterion 37; `app/Actions/Retros/BuildBoardSnapshot.php` (the `roti` object around line 291 and how cards are masked in Writing), `app/Events/Retros/CardCreated.php`, `CardDeleted.php`, `OwnCardSaved.php`, `RotiChanged.php`, `app/Http/Controllers/Retros/CardsController.php`, `RetroRotiController.php`; `tests/Feature/Retros/BoardSnapshotTest.php`, `RotiTest.php`, `RetroBroadcastEventTest.php`.

**Files:**
- Modify: `BuildBoardSnapshot.php` (`writersCount`; `roti.voterIds`), `CardCreated.php` and `CardDeleted.php` (payload key `writersCount`), `CardsController.php` (passes the count), `RotiChanged.php` (payload key `voterIds`), `RetroRotiController.php`, `resources/js/lib/retro/types.ts`, the retro reducer (`lib/retro/` — the two events set the two values)
- Tests: `tests/Feature/Retros/WritersCountTest.php` (new), `RotiTest.php`, `BoardSnapshotTest.php`

**What changes:** `writersCount` is `cards()->distinct()->count('participant_id')` (confirm the author column's name in `Card.php`). It is in the snapshot in every phase and in the two card events; it is a number, so it is sent on an anonymous retro as well. `roti.voterIds` is the list of `participant_id` of `roti_votes`, in the snapshot and in `RotiChanged`, never with a score. Payloads stay viewer-less.

**Feature tests (written first):** two participants write three cards: `writersCount` is 2; deleting a participant's only card lowers it; the `CardCreated` payload received by the others carries the new count and **no author on an anonymous retro** (assert the payload keys, as `RetroBroadcastEventTest` does); `roti.voterIds` holds the voter after a vote and loses it after a retract; `RotiChanged` carries `voterIds` and `respondents`, and no score; the snapshot of a guest carries both values.

**Consumed by:** R4 (banner), R11 (list). **Run:** `vendor/bin/sail artisan test --compact tests/Feature/Retros`; `npm run test -- resources/js/lib/retro`. **Commit:** `feat(retro): writers count and ROTI voters in the snapshot and events (B38)`

### Task R3: Session shell of the board

**Read first:** brief 02 §3.1 rows 1–29; §4.1 (`board`, `board-topbar`, `board-settings`, `board-share`, `board-dialogs`, `board-reactions`, `board-cursors`, `facilitator-dock`), §4.3 adapters for `PhaseStepper`, `Timer`, `PresenceStack`, `ShareDialog`, `SessionSettingsPopover`.

**Files:**
- Rewrite in place: `resources/js/components/retro/board.tsx`
- Create: `components/retro/board-topbar.tsx`, `board-settings.tsx`, `board-share.tsx`, `board-dialogs.tsx`, `board-reactions.tsx`, `board-cursors.tsx`, `facilitator-dock.tsx`, `board-ended.tsx` (new body), `lib/retro/phases.ts` (`PhaseLabels`), their Vitest files; `tests/Browser/Walkthroughs/Plan18eRetroTest.php`
- Delete: `components/retro/board-header.tsx`, `phase-stepper.tsx`, `timer-control.tsx`, `facilitator-menu.tsx`, `settings-dialog.tsx`, `guest-link-dialog.tsx`, `share-board-button.tsx`, `board-post-link.tsx`, `handover-dialog.tsx`, `delete-retro-dialog.tsx`, `lock-badge.tsx`, `flying-reactions.tsx`, `phase-panel.tsx`
- Kept for F1: `connection-banner.tsx`, `session-expired-banner.tsx`, `timer-display.tsx`, `presence-strip.tsx`, `live-cursor-layer.tsx`

**Interfaces:**
- Consumes: `SessionShell` (`kind="retro"`), `SessionTitle`, `SessionPresence`, `SessionTimer` (the Timer's own list 1, 3, 5, 10; `onStart`, `onStop` and `onExtend` for the facilitator only; `onExtend` posts to `retros.timer.extension.store` of R2b and applies the answered `timerEndsAt`), `CursorToggle`, `useHideMyCursor`, `LiveCursors`, `SessionReactions` (`toolbarProps={dragIsolation}`; `labelFor` null and `originFor={centreOrigin}` on an anonymous retro), `PhaseStepper`, `SessionSettingsPopover` + `useRetroSettingGroups`, `ShareDialog` (`channelsExtra` = `delivery-lines`), `FormDialog`, `ConfirmDialog`, `FacilitatorBar`.
- Produces: `showsRetroCursors(retro: { cursorsEnabled: boolean; phase: string }): boolean` in `board-cursors.tsx` (off in `voting` and `completed`; R11 adds `roti`); `facilitatorActions(phase, board): FacilitatorAction[]` in `facilitator-dock.tsx` (brief 02 §4.1 table).

**Browser tests changed:**
- Settings flow in `Plan04`, `Plan06`, `Plan07`, `Plan08b`, `Plan08e`, `Plan13d` (wherever a test opens "Settings…" then presses a `type="submit"` "Save"): the panel is a popover and its button is "Apply" — imposed by `SessionSettingsPopover/README.md` (2-D15). The ids `#retro-locked`, `#retro-icebreaker`, `#retro-ai-summary`, `#retro-reactions`, `#retro-hide-vote-counts`, `#retro-health-check`, `#retro-cursors`, `#retro-votes-auto`, `#retro-gifs`, `#retro-presentation` are unchanged.
- "Guest link…" tests in `Plan04` (:460), `Plan07`, `Plan12b`: the facilitator menu has no "Guest link…" entry any more; the test opens "Share"; the link is in the Share dialog only, and "Create a new link" asks for confirmation (one more press) — imposed by `ShareDialog/README.md` and the answers 2-D11 / 7-D2. `input[aria-label="Guest link"]`, "Copy guest link", "Allow guests", "Post link to Slack" unchanged. The Share dialog shows its QR code with "Download" (M29; the component draws it).
- "Reconnecting…" (X3): the five uses of `Plan04` are read one by one; one that scopes the text to `header` is rescoped to `[data-slot="connection-state"][data-variant="banner"]`.
- `Plan04RetroCoreTest.php:419`: `assertAttribute('[role="timer"]', 'aria-label', "Time's up!")` (Task 0.5).
- Unchanged and checked: `header ol[aria-label="Phases"]`, `[aria-current="step"]`, `press('Next')`, `press('Complete')`, `press('Reopen')`, `[aria-label="Timer"]`, `click('1 min')`, `click('Stop timer')`, `[role="group"][aria-label="2 online"]`, `img[data-presence-id]`, "Hide my cursor" / "Show my cursor", `header [aria-label="Language"]`, `[aria-label="Facilitator menu"]` and its items other than "Guest link…", `[role="alert"]:has-text("Your session has expired.")`, `click('Reload')`, `[role="toolbar"][aria-label="Reactions"]`, "Send a reaction 🎉", `click('More emoji…')`, `.lr-overlay`, `.lc-overlay`, `[data-realtime]`.

**New tests:** `[P18e-02-08]` one `[data-realtime]` on the board, the expired banner makes the board inert, Reload restores it; the reconnecting banner is full width, reads the retro sentence and never "kept locally" (Review Focus 2); `[P18e-02-09]` "+2 min" is offered to the facilitator while a timer runs, moves the countdown by two minutes for a guest in a second browser, and is absent for the guest. Vitest: `facilitatorActions` per phase; `PhaseStepper` adapter; presence adapter is covered in 0.4.

**Run:** browser `Plan04RetroCoreTest.php`, `Plan06PolishPassTest.php`, `Plan07BoardEngagementTest.php`, `Plan12bIntegrationsSharingTest.php`, `Smoke/RealtimeTest.php`, `Plan18eRetroTest.php`.

**Commit:** `feat(retro): session shell`

### Task R4: Writing phase

**Places left (feature roadmap):** the typing indicator in the help banner and on the avatars (RT-1); "Pause" in the FacilitatorBar, before "+2 min" (RT-2): `facilitatorActions` is a list.

**Read first:** brief 02 §3.2 rows 30–39, §3.3 rows 40–48 and 67; §4.3 adapters `RetroColumn`, `RetroCard`.

**Files:**
- Create: `components/retro/columns-board.tsx`, `board-column.tsx`, `board-card.tsx`, `lib/retro/adapters.ts`, `adapters.test.ts`
- Rewrite in place: `components/retro/dnd.tsx`
- Modify: `components/skrum/retro-card.tsx` (`labels.editor?: string`, the accessible name of the editing textarea; default "Card text") and its test
- Delete: `components/retro/retro-column.tsx`, `column-header.tsx`, `add-column.tsx`, `retro-card.tsx`, `card-composer.tsx`, `card-editor.tsx`, `card-gif.tsx`, `gif-picker.tsx`, `card-insight.tsx` (only if `insights/*` no longer imports it; otherwise R12)

**Interfaces:**
- Consumes: `RetroColumn` (rest props carry `data-test="retro-column-{id}"`), `RetroCard` (`editing`, `editorTools`, `gif`, `insight`, default `id="card-{id}"`), `ColumnColorOptions`, `GifSearchDialog` (0.13, `isolation={dragIsolation}`).
- Produces: `toCardProps(card, board): RetroCardProps`, `toColumnProps(column, board): RetroColumnProps` in `lib/retro/adapters.ts` (R7–R9 extend the file).

**Mockup elements added by rule 13 (M4):** the help banner reads "n cards · x/y have written" (`writersCount` of R2c over the people present); a participant's own masked cards carry the caption "Visible only to you"; the FacilitatorBar shows "Anonymity: on" on an anonymous retro (a state, not a control: anonymity is changed in the settings popover, where the server rule that it cannot be turned off after the first card is explained).

**Browser tests changed:** none. The composer passes `labels={{ editor: t('Add a card…') }}` so the 13 uses of `[aria-label="Add a card…"]` stay (2-D12). Checked: `[data-test^="retro-column-"]`, `main:has([data-test^="retro-column-"])`, `#card-{id}`, `#card-{id} textarea`, "Edit card", "Delete card", `@retro-card-handle-{id}`, "Column menu", "Column title", "Add column", "Edit description", "Delete column", "GIF", "Remove GIF", `Smoke/KeyboardDragTest.php`.

**New tests:** `[P18e-02-10]` the banner counts "1/2 have written" after one of two participants writes, live for both, on an anonymous retro too.

**Run:** browser `Plan04RetroCoreTest.php`, `Plan06PolishPassTest.php`, `Plan07BoardEngagementTest.php`, `Plan08aFlowAndTemplatesTest.php`, `Smoke/KeyboardDragTest.php`, `Plan18eRetroTest.php`.

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

**Places left (feature roadmap):** the "is moving a card…" indicator (RT-1).

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

**Places left (feature roadmap):** in the vote bar, "x/y have finished" and the participant's "I have finished voting" (RT-4); the per-card cap in `VoteBudget` (RT-3).

**Read first:** brief 02 §3.3 rows 55–57.

**Files:** Create `components/retro/phase-voting-bar.tsx`; delete `vote-controls.tsx`, `vote-progress.tsx`.

**Interfaces — consumes:** `VoteBudget` (`total`, `remaining`), `RetroCard votes / canVote / onVote`, `CardGroup votes`, `Progress`, `FacilitatorBar` (R3's `facilitatorActions`).

**Mockup elements added by rule 13 (M5):** the FacilitatorBar of the Voting phase shows "n votes / person" (the vote limit, read-only: the server locks it once voting has started) and the action "Reveal the votes" / "Hide the votes", which is the existing `hide_vote_counts` setting (`#retro-hide-vote-counts` stays in the popover; both controls write the same field).

**Browser tests changed:** none. Checked: "Add a vote", "Remove a vote", "Your votes: n", `/^\d+ votes?$/`, `[role="progressbar"]`.

**New tests:** `[P18e-02-11]` "Reveal the votes" in the bar shows the totals to a guest in a second browser and flips the switch of the settings popover.

**Run:** browser `Plan04RetroCoreTest.php`, `Plan07BoardEngagementTest.php`.

**Commit:** `feat(retro): voting phase`

### Task R8b: Shared action-item containers

**Read first:** brief 05 §2 (commit 5.1), §3 rows 12–40, §4 (adapter table); brief 02 §3.4 rows 74–82 (K18).

**Files:**
- Create in `resources/js/components/action-items/` (new names; the twelve old files stay until 5.2): `action-item-adapters.ts`, `use-action-item-mutations.ts`, `item-comments.tsx`, `item-subtasks.tsx`, `item-export.tsx` (menu and dialog), `item-create-form.tsx`, and their Vitest files

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
export function ItemCreateForm(props: { members: ActionItemOwner[]; onCreate: (values: NewActionItem) => Promise<boolean>; ids?: { title?: string }; exportSources?: ExportSource[]; onCreatedWithTicket?: (item: ActionItem, source: ExportSource) => void }): ReactElement;
export function ItemDeleteConfirm(props: { item: ActionItem | null; onCancel: () => void; onConfirm: (item: ActionItem) => Promise<void> }): ReactElement;
```

`remove` asks for confirmation first: the containers render a `ConfirmDialog` ("Delete this action item?", destructive, icon and label) and call `remove` on confirm (5-D3). The owner label is the component's "(Guest)", with a capital (5-D7): `toActionItemData` passes the guest flag and never builds the label itself.

`ActionItemEndpoints` is the existing shape returned by `workspaceActionItemEndpoints(slug)` and by the retro's board endpoints (`lib/action-items/endpoints.ts`, unchanged). Accessible names are the old ones: "Add an action item…", "Priority", "Due date", "Repeat", "Assignee", "Sub-tasks", "Add a sub-task", "Move up", "Move down", "Edit sub-task", "Delete sub-task", "n of m sub-tasks done", "Comment", "Edit comment", "Delete comment", "Export", "Export to :provider", "Linear team", "Issue type", "Project", "Repository", "Manage people".

**Browser tests changed:** none (no screen uses the new files yet).

**Run:** `npm run test -- resources/js/components/action-items`.

**Commit:** `feat(action-items): shared containers and server-to-component adapters`

### Task R9: Discussing phase

**Places left (feature roadmap):** in the focus banner, the per-topic timer (RT-5); in the right column, above the actions, the shared notes panel (RT-6); on a topic row, the "discussed" mark and the action count (RT-7, RT-8). The right column is a stack of panels taken from a list.

**Read first:** brief 02 §3.3 rows 58–60, §3.4 rows 73–82; §6. ScreenRetroDiscussion README and `preview.html`: left Topics list, centre focus banner and focused group, right topic actions. The owner's answer 2-D9: topics list only, and no feature of the discussing board lost.

**Files:**
- Create: `components/retro/phase-discussing.tsx`, `topics-list.tsx`, `topic-focus.tsx`, `action-items-list.tsx` (retro container over the R8b files), `suggestions-panel.tsx` (new body), `lib/retro/topics.ts`, `topics.test.ts`
- Delete: `components/retro/presentation-overlay.tsx`, `action-items-panel.tsx`, the old `suggestions-panel.tsx` body

**Interfaces:**
- Consumes: R8b files (with `ItemDeleteConfirm`); `ActionItem` (`id={`action-item-${id}`}` as rest prop, never `withDoing`); `CardGroup` and `RetroCard` with every control they had in R7 (comments, reactions, GIF, insight, rename and ungroup of a group, highlight button with `aria-pressed`); `RetroSettingsController` (`presentation_mode`); `Dialog` for the presentation overlay.
- Produces: `topicsFrom(board): Topic[]` in `lib/retro/topics.ts` — one topic per group and per lone card, sorted by votes descending, then by column position and card position, so that two browsers show the same order; `Topic = { id: string; leadCardId: string; title: string; votes: number; columnId: string; cardIds: string[] }`.

**Layout (the mockup, with the owner's condition):**
- Left: the Topics list (`data-test="retro-topics"`, an ordered list), sorted by votes. Each row: rank, title, votes, the colour mark of its column. A press focuses the topic for the viewer.
- Centre: the focus banner with "Previous topic" and "Next topic"; the focused topic, rendered as its `CardGroup` or `RetroCard` with all its controls and the same ids (`#card-{id}`), so comments, reactions, highlight, GIF, rename and ungroup work as on the board; "Up next" under it. "Everyone follows" is a toggle for the facilitator: it is the existing presentation mode (`presentation_mode`); when it is on, the highlighted card is the focused topic for everyone, and a participant who browses elsewhere sees "Back to the topic".
- Right: the action items of the retro (`data-test="retro-action-items-panel"`) with the inline "Create an action" form (title, assignee, due date, priority, and, when the team has an export source, "Create the ticket in :provider": the item is created, then the existing export dialog opens on it), and the suggestions panel.
- Not built, with their rows in "Deviations": per-topic timer and estimates, shared notes, "n/n following", "discussed" flag and action count per topic (D-12).

**Browser tests changed** (imposed by ScreenRetroDiscussion and the answers 2-D9, 5-D3, 5-D7):
- On a board in Discussing, `[data-test^="retro-column-"]` and `main:has([data-test^="retro-column-"])` become `[data-test="retro-topics"]`: read the 7 uses of `Plan04RetroCoreTest.php` and the 3 of `Plan07BoardEngagementTest.php` one by one; only those made after the board reached Discussing change. `Plan06`, `Plan08a`, `Plan13d` assert in other phases and `Plan08d` on the Board tab of a completed retro: they do not change.
- `Plan04RetroCoreTest.php`, the test of `data-test="retro-sort-by-votes"`: the toggle no longer exists; the test asserts that the first topic of `[data-test="retro-topics"]` is the most voted card and the last the least voted.
- A test that acts on a card in Discussing (`#card-{id} button[aria-pressed]`, comments, reactions) first focuses its topic: `click('[data-test="retro-topics"] li:has-text("…")')`. The card's own selectors are unchanged.
- Delete confirmation (5-D3): after "Delete action item", confirm in `[role="alertdialog"]` — `Plan09aActionItemsCoreTest.php` (3 uses), `Plan04RetroCoreTest.php` (1).
- "(Guest)" (5-D7): `Plan09aActionItemsCoreTest.php` :167, :177, :178, :182, :378 — `'Carol Guest (guest)'` → `'Carol Guest (Guest)'`.
- Unchanged and checked: `[data-test="retro-action-items-panel"]`, `[aria-label="Add an action item…"]`, `#action-item-{id}`, "Mark as done", "Reopen", "Edit action item", "Delete action item", `#action-item-{id}-comments`, "Export to Linear", `aside[aria-label="Suggestions"]`, `press('Stop presenting')`.

**New tests:** `[P18e-02-12]` the topics are in vote order for a member and a guest; "Next topic" by the facilitator with "Everyone follows" on moves both; with it off the guest keeps their own topic; `[P18e-02-13]` a comment, a reaction and a highlight on the focused topic reach the other browser; `[P18e-02-14]` "Create the ticket in Linear" creates the item and opens the export dialog on it. Vitest `topics.test.ts`: order by votes, stable tie-break, a group counts its own votes, hidden totals never reorder.

**Run:** browser `Plan04RetroCoreTest.php`, `Plan07BoardEngagementTest.php`, `Plan08eLlmTest.php`, `Plan09aActionItemsCoreTest.php`, `Plan09bActionItemsAdditionsTest.php` (retro tests 01a–c, 06a), `Plan12dActionItemExportTest.php`, `Plan14cTrackersTest.php`, `Plan14dStatusSyncTest.php`, `Plan18eRetroTest.php`.

**Commit:** `feat(retro): discussing phase on the topics list`

### Task R10: Actions phase (B1)

**Places left (feature roadmap):** "Export to Jira" in the header of the actions card (RT-10); the topic an item belongs to (RT-8).

It implements the matrix of spec §9.1, which the owner approved (BLOCK-1). The matrix wins over the text below.

**Read first:** spec §9 B1 and §9.1; brief 02 §7.1 (file and line of each guard), §8 "Tests that MUST change".

**Files (back end):**
- Modify: `app/Enums/RetroPhase.php` (cases `Actions = 'actions'`, `Roti = 'roti'` between `Discussing` and `Completed`; `label()`; new `takesActionItems(): bool`), `app/Models/Retro.php:95`, `app/Actions/Retros/ChangeRetroPhase.php:94-101`, `app/Http/Controllers/Retros/RetroHighlightsController.php:24,39`, `app/Http/Controllers/Concerns/LocksDiscussingRetro.php:14`, `app/Actions/Retros/SuggestionGuard.php:35-52`, `app/Actions/Retros/BuildInsights.php:30`, `app/Actions/Retros/RetroGuard.php:37`, `app/Http/Controllers/Retros/CardReactionsController.php:75`, `CardCommentsController.php:147`, `app/Mcp/Tools/Retro/CreateAction.php:34,81,89`, `UpdateAction.php:36,53,91`, `ListInsights.php:57`, `PromoteSuggestion.php:29`, `app/Mcp/Servers/SkrumServer.php:44`
- Tests: `tests/Feature/Retros/RetroModelTest.php`, `FacilitationTest.php`, `RetroGuardTest.php`, `ActionItemsTest.php`, `SuggestedActionsTest.php`, `BoardSnapshotTest.php`, `ResultsTest.php`, `RetroCompletedTest.php`, `tests/Feature/Mcp/ActionItemWriteToolsTest.php`, `SuggestionToolsTest.php`, `McpSweepTest.php`; new `tests/Feature/Retros/ActionsPhaseTest.php`

**Files (front):**
- Modify: `resources/js/lib/retro/types.ts:15` (`RetroPhase`), `lib/retro/phases.ts` (`actions: 'Actions'`, `roti: 'ROTI'`), `components/retro/board.tsx`, `facilitator-dock.tsx`, `board-cursors.tsx`
- Create: `components/retro/phase-actions.tsx`, `carried-items-sheet.tsx`
- Delete: `components/retro/carried-action-items-panel.tsx`

**Feature tests (written first, `ActionsPhaseTest.php`):** the neighbour walk through the nine phases and back; from `completed`, the previous phase is `roti`; in `actions`: an action item is created, updated and deleted; a locked board refuses with 423; a card is highlighted; the highlight survives `discussing` → `actions` → `discussing` and is cleared on `actions` → `roti`; vote totals are visible in `actions` and `roti`; a card comment, a card reaction and a group name are accepted in `actions` and refused in `roti`; a survey answer is refused in `actions`; **a retro created in `discussing` before the change moves to `actions` with its cards, votes and action items intact** (Review Focus 1); in `roti` an action item can still be ticked.

**Browser tests changed** (imposed by B1 and spec §6.4, ScreenRetroActions): `press('Complete')` from a board in Discussing becomes Next, Next, Complete (or the board is created in `Roti`): `Plan04` :364, :375; `Plan08c` :617; `Plan08d` :327, :564; `Plan08e` :194, :495, :570, :635, :732, :795, :849; `Plan14b` :407. `press('Reopen')` then "Discussing" becomes "ROTI": `Plan04` :370; `Plan08c` :632-655; `Plan08d` :557. `[P04-07]` walks the two new phases. `button:has-text("Previous action items (1)")` and its sheet are unchanged.

**Mockup elements added by rule 13 (M7):** the left column lists the most voted topics (the `topicsFrom` of R9) with "Next topic"; creating an item shows the toast "Action created" with "Undo", which deletes it through the existing endpoint without a confirmation (the toast is the confirmation's opposite: it is offered for a few seconds only); the main action of the FacilitatorBar is "Next phase" (ruling 26, deviation D-04).

**New tests:** `[P18e-02-02]` Actions phase: create, assign and complete an item, a guest sees it live, "Next topic" moves the highlight for both; "Undo" in the toast removes the item for both.

**Run:** `vendor/bin/sail artisan test --parallel --processes=8 --compact tests/Feature/Retros tests/Feature/Mcp tests/Feature/ActionItems`; `vendor/bin/pint --dirty --format agent`; the Arch suite; browser `Plan04`, `Plan08c`, `Plan08d`, `Plan08e`, `Plan09a`, `Plan09b`, `Plan14b`, `Plan18eRetroTest.php`.

**Commit:** `feat(retro): actions phase (B1)`

### Task R11: ROTI phase (B2)

**Places left (feature roadmap):** "Reveal ROTI" and "Nudge" in the FacilitatorBar (RT-9).

**Read first:** spec §9 B2 and §9.1 (the owner approved both, BLOCK-1 and BLOCK-2); brief 02 §7.2, rows 84–85; ScreenRetroROTI, ROTI frame.

**Files (back end):**
- Create: a migration (up only) adding `retros.roti_votable_when_completed` (boolean, default false) and setting it to true where `phase = 'completed'`
- Modify: `app/Models/Retro.php` (cast), `app/Http/Controllers/Retros/RetroRotiController.php:63`, `app/Actions/Retros/BuildBoardSnapshot.php:291` (`roti.canVote`), `app/Mcp/Tools/Retro/GetRoti.php:50,58`, `database/factories/RetroFactory.php` (state `legacyRoti()`)
- Tests: `tests/Feature/Retros/RotiTest.php:52-64`, `tests/Feature/Mcp/InsightsHealthRotiTest.php`

**Files (front):** create `components/retro/phase-roti.tsx`; modify `lib/retro/types.ts` (`roti.canVote`), `board-cursors.tsx` (`roti` is cursorless); delete `components/retro/roti-control.tsx`.

**Feature tests (written first):** a vote is accepted in `roti`, refused in `discussing` and `actions`; in `completed` it is refused for a retro completed after the migration and accepted for one the migration marked; the migration marks exactly the completed retros; **a retro in `discussing` that already holds ROTI votes keeps them through `actions` into `roti` and a voter can change the score there** (Review Focus 1); `roti.canVote` follows the same rule; `GetRoti` answers "pending" in `roti`.

**Interfaces — consumes:** `ROTIWidget` (`mode="vote"`, a press on the pressed score → `DELETE`), `[role="group"][aria-label="How was this retro?"]`; `roti.voterIds` (R2c).

**Mockup elements added by rule 13 (M8):** the "Who has voted" list — every participant present, with "Voted" or "Thinking…", from `roti.voterIds`, never a score — and the count "n/m". The distribution stays hidden until the session ends; "Reveal ROTI" and "Nudge" are not built (D-14); the main action of the FacilitatorBar is "End session".

**Browser tests changed** (imposed by B2 and ScreenRetroROTI): the ROTI control asserted on a board in Discussing moves to a board in `Roti`: `Plan08d` :259 (and :478, :499 where the board is not completed).

**New tests:** `[P18e-02-03]` vote, change, retract; the "Who has voted" list moves live for the other browser and shows no score; refused in Discussing; `[P18e-02-01]` a member and a guest walk Writing → Grouping → Voting → Discussing → Actions → ROTI → Completed in two browsers without a reload (spec §13 criterion 9).

**Run:** `vendor/bin/sail artisan test --compact tests/Feature/Retros/RotiTest.php tests/Feature/Mcp/InsightsHealthRotiTest.php`; Pint; browser `Plan08dResultsTest.php`, `Plan18eRetroTest.php`.

**Commit:** `feat(retro): ROTI phase (B2)`

### Task R12a: Start time, duration and session-end statistics (B3, B19) — back end

**Read first:** spec §9 B3 and §9.2 B19, criterion 16; `app/Actions/Retros/BuildResults.php`, `ChangeRetroPhase.php`, `app/Http/Controllers/Retros/CardsController.php` (`store`), `HealthCheckAnswersController.php`, `RetroTimersController.php`, `app/Actions/HealthCheck/SummarizeHealthCheck.php`, `BuildHealthTrend.php`; `tests/Feature/Retros/ResultsTest.php`, `HealthCheckSummaryTest.php`.

**Files:**
- Create: a migration `add_started_at_to_retros_table` (up only: `timestamp('started_at')->nullable()`, no backfill), `app/Actions/Retros/MarkRetroStarted.php`, `tests/Feature/Retros/RetroStartTest.php`
- Modify: `app/Models/Retro.php` (PHPDoc, cast `started_at` → `datetime`; not fillable: only the action writes it), `database/factories/RetroFactory.php` (state `started(?CarbonInterface $at = null)`), the four call sites, `BuildResults.php` (`stats`), `SummarizeHealthCheck.php` (`previousAverage` per statement), `resources/js/lib/retro/types.ts`
- Tests: `tests/Feature/Retros/ResultsTest.php`, `HealthCheckSummaryTest.php`

**Interfaces — produces:**

```php
// App\Actions\Retros\MarkRetroStarted
/** Sets started_at once; a later call changes nothing. */
public function handle(Retro $retro): void
{
    if ($retro->started_at !== null) {
        return;
    }

    Retro::query()->whereKey($retro->id)->whereNull('started_at')->update(['started_at' => now()]);
}

// BuildResults — added key
'stats' => [
    'votesCast' => int,
    'votesAvailable' => int,          // participants × voteLimit()
    'participation' => ['participants' => int, 'teamMembers' => int],
    'durationSeconds' => ?int,        // completed_at − started_at, null without started_at
],
```

Call sites of `MarkRetroStarted`: `CardsController@store` (after the card is created), `HealthCheckAnswersController` (after an answer is saved), `RetroTimersController@update` (when `seconds` is not null), `ChangeRetroPhase` (on any move). Each passes the model it already holds; none adds a query when `started_at` is set. `previousAverage` of a statement is its average in the team's previous completed retro with a health check (the one `BuildHealthTrend` would list just before this retro), matched by statement key, or `null`.

**Feature tests (written first):** each of the four events sets `started_at`; a second event does not move it; reopening and completing again keeps it; a retro completed 50 minutes after its start reports `durationSeconds` 3000 (`Carbon::setTestNow`); **a retro that has no `started_at` reports `null`** (Review Focus 6); `votesCast` and `votesAvailable` for two participants with a limit of five; `participation` for two participants in a team of three; `previousAverage` for a statement present in the previous retro, `null` for a new statement and for the team's first health check; a guest's results carry `stats` and no `healthTrend`, as today.

**Consumed by:** R12. **Run:** `vendor/bin/sail artisan test --compact tests/Feature/Retros`. **Commit:** `feat(retro): start time, duration and session-end statistics (B3, B19)`

### Task R12: Session end (B3)

**Places left (feature roadmap):** none requested: the Export menu and the ROTI trend stay backlog.

**Read first:** brief 02 §3.5 rows 86–98, §7.3; spec §9 B3, ruling 37; ScreenRetroROTI, end frame: header "Session ended · 58 min · date", Back to the team, "Email the recap", five stats, actions list, ROTI block, health check, frozen confetti.

**Files:**
- Create: `components/retro/session-end.tsx`, `session-confetti.tsx` and a new, smaller `components/retro/results/*` set (participants, summary, top topics, health with radar and trend, action items, games played, recap share, recap e-mail)
- Delete: the old `components/retro/results/*` except `survey-result.tsx` (S2), `insights/suggestions-list.tsx`, `insights/summary-section.tsx`, `board-ended.tsx` old body if not done

**Interfaces — consumes:** `results.stats` and `health.statements[].previousAverage` (R12a); `StatCard`, `ROTIWidget mode="result"` (and vote mode when `roti.canVote`), `HealthCheckResults` (`children` = radar and trend SVGs kept as container-side components; each score with its delta when `previousAverage` is not null), `GamesLeaderboard` pieces, `ActionItem` without handlers, `Tabs` with ids `completed-tab-results` / `completed-tab-board`, the games files `drawing-canvas`, `clue-row`, `gif-tile` (unchanged exports), old `SurveyResult` mounted until S2.

**Composition:** header "Session ended", the duration when `durationSeconds` is not null (formatted with `Intl`, "58 min" or "1 h 12 min"), the date; "Back to the team"; the primary button "Send the recap by e-mail" (2-D14); five stats: actions created, participation "n of m · p %", cards, groups, votes cast "n of m". Confetti (2-D13, ruling 37): `SessionConfetti` renders about forty `span`s with the `animate-confetti` utility of `app.css` and random `--dx`, `--dy`, `--rot` custom properties, token colours, `aria-hidden`; it plays once, when the viewer sees the phase turn to `completed` live (not on a later visit), and renders nothing under `prefers-reduced-motion` (`motion-reduce:hidden` and no mount when `matchMedia('(prefers-reduced-motion: reduce)')` matches). Not built: the Export menu (D-15), the ROTI delta and sparkline (D-15).

**Browser tests changed** (imposed by ScreenRetroROTI frames c/d): `click('Send to email')` → `click('Send the recap by e-mail')` (3 uses, 2-D14). Unchanged and checked: `#completed-tab-results`, `#completed-tab-board`, `[role="tabpanel"]`, `[aria-labelledby="results-summary"]`, `svg[aria-label="Team health radar"]`, `svg[aria-label="Trend across retros"]`, `[role="tabpanel"] li:has-text("Casey") [aria-label="6 points"]`, "Points of this round", "Drawing of rocket", `click('Share to Slack')`, `[role="dialog"] button:has-text("Send")`, `ul[aria-live="polite"]`, `main:has([data-test^="retro-column-"])` on the Board tab.

**New tests:** `[P18e-02-04]` stats row with the duration and "votes cast n of m", tabs, recap e-mail dialog, share to a channel, Reopen lands on ROTI; `[P18e-02-07]` with `prefers-reduced-motion` no flying reaction and no confetti element (spec §13 criterion 12); `[P18e-02-15]` the facilitator's "End session" shows confetti to a guest in a second browser, and a reload shows none; a retro without a start time shows no duration.

**Run:** `vendor/bin/sail artisan test --compact tests/Feature/Retros/ResultsTest.php`; browser `Plan08dResultsTest.php`, `Plan08eLlmTest.php`, `Plan12bIntegrationsSharingTest.php`, `Plan13dIcebreakerScoresInvitesTest.php`, `Plan14bOutgoingWebhooksTest.php`, `Plan18eRetroTest.php`.

**Commit:** `feat(retro): session end (B3)`

### Task R13: Mobile board

**Read first:** brief 02 commit R13; MobileRetro README.

**Files:** modify the retro containers for the phone layout (column tabs with a swipe between columns — a pointer handler on the columns area that moves to the next or previous tab past a 25 % horizontal drag, ignored while a card is dragged; the slide between two columns is not animated under `prefers-reduced-motion` —, add-card button, drawers for the action items and the votes with the assignee as avatar chips, the topics list of R9 as a drawer, compact `FacilitatorBar` and `SessionReactions compact`); extend `tests/Browser/Visual/RetroPagesVisualTest.php` with every phase at 390.

**Browser tests changed:** none (the suite runs at desktop width).

**New tests:** `[P18e-02-06]` at 390: one column per tab, a swipe changes the column and the tabs still work from the keyboard, a card added, a vote, the action drawer, the topics drawer in Discussing.

**Run:** `Visual/RetroPagesVisualTest.php`, `Plan18eRetroTest.php`; then the group gate (`bin/test-browser`, PHP suite, Vitest) and G-visual-2.

**Commit:** `feat(retro): mobile board`

---

# Step B — lanes in separate worktrees, cut from the head of Step A

Each lane: `git worktree add ../skrum-18e-<lane> -b plan-18e-<lane> plan-18e-screens`. A lane agent works only in its worktree. The controller merges a finished lane into `plan-18e-screens` (union for the lang files and `page-layouts.ts`), runs the gates, then the next lane rebases if it shares a file from the table above.

## Lane S — Group 8, surveys (needs R13)

Brief: `18e-briefs/08-surveys.md`.

### Task S1: Surveys column, answer and results cards, editor dialog and AI draft

**Places left (feature roadmap):** none in the retro: the standalone survey, its builder and its question kinds are new pages of plan 19 (SV-1 to SV-4). The health-check phase is untouched by this plan (SV-5).

**Read first:** brief 08 §1 (the three mount points), §3 rows 1–35, 37–38, §4, §9 (G1–G4).

**Files:**
- Create: `resources/js/components/retro/surveys/surveys-column.tsx`, `survey-board-card.tsx`, `survey-actions-menu.tsx`, `survey-editor-dialog.tsx`, `survey-draft-field.tsx`, `survey-discussion.tsx`; `resources/js/lib/retro/survey-question-adapter.ts`, `survey-question-adapter.test.ts`; `tests/Browser/Walkthroughs/Plan18eSurveysTest.php`
- Modify: `resources/js/components/skrum/survey-question.tsx` and its test — `disabled?: boolean` (answering blocked without the "Closed" badge), voter avatars with `alt` = the name, `submitDisabled?: boolean` (the container disables Submit when the answer is unchanged), rest props on the `<article>` (`aria-label`, `data-test`)
- Modify: `components/retro/board.tsx` (the column mount and `onAddSurvey` of `SessionSettingsPopover`; the old board button goes)
- Delete: `components/retro/surveys-column.tsx`, `survey-card.tsx`, `survey-menu.tsx`, `survey-dialog.tsx`, `survey-draft-field.tsx`, `survey-discussion.tsx`

**Interfaces:**
- Consumes: `useBoard()` (`run`, `apply`, `invalidateSurvey`, `isEditable`, `sessionExpired`), `CommentThreadList`, `ReactionChips`, `EmojiPicker` (R7 exports), `lib/retro/survey-api.ts`, `SurveyQuestion`, `ConfirmDialog`.
- Produces: `toSurveyQuestionProps(survey: SurveyPayload, context: { participants; mode: 'answer' | 'results' }): SurveyQuestionProps`; `useSurveyEditor(): { open; survey; openCreate(); openEdit(survey); close() }`; `SurveyPhases` (`writing`, `grouping`, `voting`, `discussing`: unchanged, spec §9.1).

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

Brief: `18e-briefs/03-poker.md`. Eight tasks; 3.0a, 3.0b and 3.0c are back-end tasks. The saved decks are a page (1.5); the brief's commit 3.4 is dropped. What the owner changed in this lane: "Reveal cards" (3-D7), the facilitator's actions in the dock (3-D8), one timer list (X5), the guest link in the Share dialog only (7-D2), the spectator switch of the join page (3-D10). What rule 13 added: M14, M15, M28.

### Task 3.0a: Median, spread, agreement and outliers of a revealed round (B39) — back end

**Read first:** spec §9.3 B39, criterion 38, ruling 10; `app/Actions/Poker/PokerResult.php` (whole file: which votes are countable, how `average` and `consensus` are built, what an anonymous round returns), its callers (`grep -rn "PokerResult" app`), `tests/Feature/Poker/PokerRevealTest.php`, `PokerAnonymousTest.php`, `PokerRoundHistoryTest.php`.

**Files:** modify `app/Actions/Poker/PokerResult.php`, `resources/js/types/poker.ts`; tests `tests/Feature/Poker/PokerStatisticsTest.php` (new), `PokerRevealTest.php`.

**Interfaces — produces**, added to the array `PokerResult` returns for a revealed round:

```php
'median' => ?float,                       // of the numeric votes; null when there is none
'spread' => ?array{min: float, max: float},
'agreement' => ?float,                    // share of voters on the most frequent countable value, 0 to 1, two decimals
'outliers' => array{low: list<string>, high: list<string>}, // player ids on the lowest and on the highest numeric value, when that value is not the most frequent one; both empty on an anonymous round
```

Before the reveal the four keys are `null` / empty, in the same branch that returns `'average' => null` today (line 46). Non-numeric cards (`?`, coffee) are ignored, as they are for the average.

**Feature tests (written first):** votes 3, 5, 5, 8 → median 5.0, spread 3 to 8, agreement 0.5, `low` = the voter of 3, `high` = the voter of 8; votes 5, 5, 5 → agreement 1.0 and no outlier; an even number of votes → the median is the mean of the two middle values; `?` and coffee are ignored; an anonymous round has empty outliers and its other figures; nothing before the reveal; the round history carries the figures of each past round.

**Consumed by:** 3.1a. **Run:** `vendor/bin/sail artisan test --compact tests/Feature/Poker`. **Commit:** `feat(poker): median, spread, agreement and outliers of a revealed round (B39)`

### Task 3.0b: Deck and voters of an estimation-history row (B40) — back end

**Read first:** spec §9.3 B40, criterion 39; `app/Http/Controllers/TeamEstimatesController.php` (whole file), `tests/Feature/Poker/PokerEstimatesPageTest.php`; how a player's avatar URL is produced (`grep -rn "avatarUrl" app/Actions/Poker`).

**Files:** modify `TeamEstimatesController.php` (eager-load `game` and the players of the last revealed round's votes), `resources/js/types/poker.ts`; tests in `PokerEstimatesPageTest.php`.

**Interfaces — produces**, added to each row: `deck` (the game's `deck_name`, or the label of its built-in `deck`), `voters` (list of `name`, `avatarUrl`; empty when the round was anonymous) and `votersCount`.

**Feature tests (written first):** a row of a game on a saved deck shows the deck's name, on a built-in deck its label; `voters` lists the players of the last revealed round with an avatar URL; an anonymous round gives `voters = []` and the right `votersCount`; the query count of the page does not grow with the number of rows (assert with `DB::enableQueryLog()` on 3 and on 30 rows).

**Consumed by:** 3.3. **Run:** `vendor/bin/sail artisan test --compact tests/Feature/Poker/PokerEstimatesPageTest.php`. **Commit:** `feat(poker): deck and voters on estimation history rows (B40)`

### Task 3.0c: "+2 min" on a poker round timer (B20) — back end

**Read first:** spec §9.2 B20 (Poker row), criterion 17; `app/Http/Controllers/Poker/PokerTimersController.php` (whole file: the guards before and inside the lock, the event, the delayed job), `app/Jobs/RevealPokerRoundOnTimer.php` (it acts only when the stored end equals the end it was dispatched for), Task R2b (the retro controller this one mirrors), `tests/Feature/Poker/PokerTimerTest.php`, `routes/web.php:488`.

**Files:** create `app/Http/Controllers/Poker/PokerTimerExtensionsController.php` (`store`), `tests/Feature/Poker/PokerTimerExtensionTest.php`; modify `routes/web.php` (`Route::post('rounds/{round}/timer/extension', [PokerTimerExtensionsController::class, 'store'])->name('poker.rounds.timer.extension.store')->whereUuid('round');`), `PokerTimersController.php` (constant `MaxSeconds = 3600`, used by its own rule).

**What it does:** as R2b, on `poker_rounds.timer_ends_at`: `PokerGuard::notEnded` and `PokerGuard::facilitator` before the lock; inside the transaction, lock the game and the round, repeat the two guards and `PokerGuard::openRound`; 422 on `timer` when no timer runs or when more than `PokerTimersController::MaxSeconds` would remain; add `ExtensionSeconds = 120`; `(new PokerTimerChanged($game->id, $round->id, $endsAt->toIso8601String()))->sendToOthers()`; dispatch `new RevealPokerRoundOnTimer($round->id, $endsAt->toIso8601String())` delayed to the new end, `afterCommit`. The job of the old end is not cancelled: it finds another stored end and returns.

**Feature tests (written first):** the end moves by 120 seconds and the event carries it; **the job dispatched for the old end does not reveal the round, and the job for the new end does** (run both with the clock set after each end); 422 without a running timer and beyond one hour; 403 for a player who is not the facilitator; refused on an ended game and on a revealed round.

**Consumed by:** 3.1a. **Run:** `vendor/bin/sail artisan test --compact tests/Feature/Poker/PokerTimerExtensionTest.php tests/Feature/Poker/PokerTimerTest.php`; `php artisan wayfinder:generate`. **Commit:** `feat(poker): extend a running round timer by two minutes (B20)`

### Task 3.1a: Room on the table model — shell, table, dock, queue

**Places left (feature roadmap):** in the story card, under the title: type and label chips, description, acceptance criteria (PK-1). The card takes a `details` slot.

**Read first:** brief 03 §3 rows 1–10, 14, 20–26, 32–52; §4 (containers and adapters); §9.

**Files:**
- Create in `resources/js/components/poker/`: `poker-room.tsx`, `room-topbar.tsx`, `room-table.tsx`, `story-card.tsx`, `task-queue.tsx`, `task-row.tsx`, `room-dock.tsx`, `room-cursors.tsx`, `room-reactions.tsx`, `room-gone.tsx`, `lib/poker/room-adapters.ts` with its test; `tests/Browser/Walkthroughs/Plan18ePokerTest.php`, `tests/Browser/Visual/PokerPagesVisualTest.php`
- Rewrite: `resources/js/pages/poker/show.tsx`
- Delete: the old view files of `components/poker/` replaced by the above (`game.tsx`, `game-header.tsx`, `players-grid.tsx`, `poker-card.tsx`, `hand.tsx`, `tasks-pane.tsx`, `task-detail.tsx`, `facilitator-toolbar.tsx`, `result-panel.tsx`, `anonymous-values-row.tsx`, `round-history.tsx`, `round-timer-control.tsx`, `spectator-toggle.tsx`, `take-control-button.tsx`, `game-cursors.tsx`, `game-reactions.tsx`, `game-gone.tsx` and their private helpers). Kept: `game-context.tsx`, `auto-reveal-triggers.tsx` (logic only), and until 3.1b / 3.1c the dialogs and the import files, mounted from the new room.

**Interfaces:**
- Consumes: `SessionShell` (`kind="poker"`), `SessionTitle`, `SessionPresence`, `SessionTimer` (the Timer's own list 1, 3, 5, 10 — no `presets` — and `onCustom`, which opens the custom-duration dialog poker has today; `onExtend` posts to `poker.rounds.timer.extension.store` of 3.0c), `CursorToggle`, `LiveCursors`, `SessionReactions` (`variant="inline"`), `PokerTable`, `PokerDeck selection="toggle"`, `PokerRounds`, `VoteDrawer`, `FacilitatorBar`, `usePokerGame`, `GameProvider`; the statistics of 3.0a.

**Composition changed by the answers and by rule 13:** the reveal button is "Reveal cards" (3-D7). After the reveal, Re-vote, the Estimate select, "Save estimate" and "Next task" are in the dock, where the deck was (3-D8, ScreenPokerQueue); the result panel of the table shows the figures: average, median, spread "3 → 13", agreement "50 % on 5", the distribution, and, when the round is not anonymous and has outliers, the line naming them ("Lucas and Malik open the discussion") (M14). The observers box of the table lists who watches.
- Produces: `seatsFrom(snapshot, onlineIds): PokerSeat[]`, `storyFrom(task)`, `nextUnestimatedTask` (kept) in `lib/poker/room-adapters.ts`.

**Browser tests changed:**
- `Plan10bPokerAdditionsTest.php:833`: `assertAttribute('[role="timer"]', 'aria-label', "Time's up!")` (Task 0.5).
- Timer list (X5): `assertSee('30 s')` / `click('30 s')` → `'1 min'` at `Plan10bPokerAdditionsTest.php` :772, :811, :863 and `Smoke/QueuedBroadcastTest.php` :24. Where the test then waits for the 30-second timer to end, read how `Plan04RetroCoreTest.php:419` brings its timer to zero and use the same means. If that test simply waits, the poker tests cannot (the shortest duration is now one minute, and "Custom…" counts in minutes): they shorten `poker_rounds.timer_ends_at` in the database right after the click, then let the page read the snapshot again. Report which of the two was used.
- "Reveal cards" (3-D7): `click('Show votes')` and `assertSee('Show votes')` → `'Reveal cards'` in `Plan10aPokerCoreTest.php` (10), `Plan10bPokerAdditionsTest.php` (8), `Plan14cTrackersTest.php` (6).
- Dock (3-D8): "Re-vote", `[aria-label="Estimate"]`, "Save estimate", "Next task" keep their names; a selector that scopes one of them to the result panel is rescoped to `[data-slot="facilitator-bar"]`.
- "Reconnecting…" (X3): the two uses of `Plan10aPokerCoreTest.php`, read; rescope to the banner if scoped to `header`.
- `P10b-11`: the second press uses the banner's "Join the vote" (the "Watch only" switch keeps its label when on) — imposed by ScreenPokerQueue (observer banner), 3-D9. Confirm by reading the test before editing.
- Unchanged and checked: `[aria-label="Play 5"]`, `[aria-label="Your cards"]`, `[role="img"][aria-label="Bob: Voted"]`, `section[aria-label="Players"]` (no "5", "8" or task key before the reveal — task titles and "n of m voted" live in that section: see notes-for-18e), "Estimate: 5", `[data-test="poker-task-row"]`, `#poker-tasks`, "Hide tasks" / "Show tasks", `[aria-label="Drag to reorder"]`, the `ol li` order of `Smoke/KeyboardDragTest.php` (the queue is the first `ol` of the page: check `PokerRounds` and `PokerTable` markup), `[aria-label="Timer"]`, `#poker-timer-minutes` (the custom dialog), `.lc-overlay`, `[role="toolbar"][aria-label="Reactions"]`, "You're watching — switch to Play to vote", "Reconnecting…", "This game was deleted.", `[data-realtime]`.

**New tests:** `[P18e-03-06]` after a reveal of 3, 5, 5, 8 the panel shows median 5, "3 → 8", "50 % on 5" and names the two extremes; an anonymous round names nobody; `[P18e-03-07]` the timer menu offers 1, 3, 5, 10 minutes and "Custom…", and no "30 s"; "+2 min" moves the countdown for a player in a second browser; `[P18e-03-01]` at 390 the queue drawer opens and a vote goes through the vote drawer; `[P18e-03-02]` "Join the vote" brings the deck back; `[P18e-03-03]` "Hide tasks" collapses `#poker-tasks` (`aria-pressed`); `[P18e-03-04]` the reaction bar sits above the deck with no overlap, and the page has one `[data-realtime]` (Review Focus 2). Vitest: `seatsFrom` (offline voter kept, offline non-voter dropped, spectator who voted before a named reveal is `voted`).

**Run:** browser `Plan10aPokerCoreTest.php`, `Plan10bPokerAdditionsTest.php`, `Smoke/KeyboardDragTest.php`, `Smoke/RealtimeTest.php`, `Smoke/QueuedBroadcastTest.php`, `Plan18ePokerTest.php`.

**Commit:** `feat(poker): room on the table model`

### Task 3.1b: Room dialogs

**Read first:** brief 03 §3 rows 11–13, 15–19; D3, D4.

**Files:** create `components/poker/room-dialogs.tsx` (settings, share with the guest link, hand-over, end, delete, task form, custom timer); delete `game-settings-dialog.tsx`, `game-share-dialog.tsx`, `game-guest-link-dialog.tsx`, `transfer-dialog.tsx`, `delete-game-dialog.tsx`, `task-form-dialog.tsx`, `game-menu.tsx`, and `components/poker/deck-fields.tsx` (its last consumer).

**Interfaces — consumes:** `SessionSettingsContent` with poker groups (ids `poker-auto-reveal`, `poker-anonymous-votes`, `poker-cursors`, `poker-reactions`), `DeckPicker` + `DeckEditor idPrefix="deck-custom"`, `lib/poker/deck-payload.ts` (1.2), `ShareDialog guestSwitchId="poker-guest-link-access"` (0.12), `FormDialog`, `ConfirmDialog`, `delivery-lines`.

The facilitator menu has no "Guest link…" entry: the guest-link controls are in the Share dialog only (7-D2). The deck picker of the game settings links to the saved decks page ("Manage decks", 1.5).

**Browser tests changed** (imposed by `ShareDialog/README.md`, `DeckPicker/README.md` and the answer 7-D2): `click('Guest link…')` → open "Share" at `Plan10aPokerCoreTest.php` :229, :616 and `Plan10bPokerAdditionsTest.php` :215; `P10a-14`: "Create a new link" asks for confirmation (one more press). `P10b-02c`, `P10b-16`: the heading "Your team's decks" becomes the picker's "Saved" group — confirm the picker's label in `deck-picker.tsx` before editing. Unchanged and checked: `#poker-guest-link-access`, `input[aria-label="Guest link"]`, `#poker-task-title`, `[aria-label="Facilitator menu"]` and its items other than "Guest link…", "End this game?", `[role="dialog"] button:has-text("End game")`, `#deck-custom-cards`, "Game settings".

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

**Interfaces — consumes:** `GuestJoinPage` (`kind="poker"`, `invalidTitle={t('Join a planning poker game')}`, `session` = the prop of R2a, `extraFields={['spectator']}`, children = `<Switch id="spectator" name="spectator" value="1">` with the label "Join as spectator"; 3-D10).

**Browser tests changed** (imposed by `GuestJoin/README.md`: heading "Join as a guest", label "Your nickname"): `Plan10aPokerCoreTest.php:255-256` — "Choose the name other players will see." and "Display name" → "Join as a guest" and "Your nickname"; "Sprint 12 estimates" and "Join as spectator" stay. `#spectator` is now a switch: `click('#spectator')` and `assertAriaAttribute('#spectator', 'checked', 'true')` (`Plan10b:50-53, 226-229`) hold for a switch as they did for a checkbox; if a test binds `[role="checkbox"]`, it becomes `[role="switch"]`. Confirm that the form still posts `spectator=1` (the Radix switch needs `name` and `value`). Unchanged: `joinAsGuest`, "This guest link is no longer valid." (`Plan10a:628`).

**Run:** browser `Plan10aPokerCoreTest.php`, `Plan10bPokerAdditionsTest.php`.

**Commit:** `feat(poker): guest join on GuestJoin`

### Task 3.3: Estimation history

**Read first:** brief 03 §3 rows 55–60.

**Files:** create `components/poker/estimation-history.tsx`; rewrite `resources/js/pages/poker/estimates.tsx` (under `AppLayout active="sessions"`, breadcrumbs team › Estimation history); add `poker/estimates` to `page-layouts.ts`.

**Interfaces — consumes:** `Table`, `Pagination`, `Select`, `PokerRounds open players`, `EmptyState`, `AvatarStack`; `deck`, `voters`, `votersCount` of each row (3.0b); the statistics of 3.0a in the expanded rounds.

**Composition:** the mockup's table — Task, Estimate, Deck, Date, Voters (avatars, or the count for an anonymous round), Rounds — with the search and the game filter the page has today. Not built: the deck, period and "re-voted only" filters and "Export CSV" (D-17).

**Browser tests changed:** none. Checked (`P10a-15`): `button[aria-label="Game"]`, `input[aria-label="Search tasks"]`, `click('Search')`, `[aria-label="Show rounds"]`, "Round 1", "Ada Facilitator: 5", "5 × 2", "Average: 5.5", "Consensus", `[aria-label="Pagination"]`, "No estimated tasks yet.".

**New tests:** `[P18e-03-05]` a row shows its deck, its voters as avatars and a warning badge when re-voted; an anonymous round shows a count; captures of the room (before and after reveal, observer) and of the history in `PokerPagesVisualTest.php`.

**Run:** browser `Plan10aPokerCoreTest.php`, `Visual/PokerPagesVisualTest.php`; group gate; G-visual-3.

**Commit:** `feat(poker): estimation history`

## Lane T — Group 4, team page, then Group 5, action items

Ten tasks; 4.0a to 4.0d and 5.0 are back-end tasks. What the owner changed in this lane: `/dashboard` (4-D1), the mood and ROTI trend (4-D3), member avatars (4-D4), the confirmation before removing a member (4-D5), the "…" section menus (4-D6), the delete confirmation, "Group by", the counters and the topbar button of the action items page (5-D3 to 5-D6), "(Guest)" (5-D7). What rule 13 added: M16, M17, M18.

### Task 4.0a: `/dashboard` goes to the current team (B22) — back end

**Read first:** spec §9.2 B22, criterion 19; `app/Http/Controllers/CurrentWorkspaceController.php`, `app/Support/CurrentTeamResolver.php` (the session key `current_team_id`), `app/Models/Workspace.php` (`teamsVisibleTo`), `tests/Feature/DashboardTest.php`; every test that asserts where `/dashboard` lands (`grep -rn "dashboard" tests/Feature` lists 12 files: read each assertion on the redirect target).

**Files:** modify `CurrentWorkspaceController.php`; tests `tests/Feature/DashboardTest.php` and the feature tests that assert `workspaces.show` after `/dashboard`.

```php
public function show(Request $request): RedirectResponse
{
    $user = $request->user();

    $workspace = $user->workspaces()->whereKey($user->current_workspace_id)->first()
        ?? $user->workspaces()->orderBy('name')->first();

    if ($workspace === null) {
        return to_route('workspaces.create');
    }

    $teams = $workspace->teamsVisibleTo($user)->sortBy('name')->values();
    $team = $teams->firstWhere('id', $request->session()->get('current_team_id')) ?? $teams->first();

    if ($team === null) {
        return to_route('workspaces.show', $workspace);
    }

    return to_route('teams.show', [$workspace, $team]);
}
```

**Feature tests (written first):** with a remembered team the redirect is its page; without one, the first visible team by name; a remembered team of another workspace, or one the user can no longer see, is ignored; **a workspace without a visible team lands on the workspace page and a user without a workspace on workspace creation, with no redirect loop** (follow the redirects and assert a 200) (Review Focus 5); the login and SSO flows that end on `/dashboard` still end on a page the user can open.

**Browser tests:** a walkthrough that signs in and then asserts the workspace page by its path changes to the team page, or visits the workspace explicitly; `grep -rn "assertPath" tests/Browser | grep -i workspace` lists the candidates. `signIn` itself only asserts that the path is not `/login`, and is not edited.

**Run:** `vendor/bin/sail artisan test --parallel --processes=8 --compact`. **Commit:** `feat(dashboard): redirect to the current team (B22)`

### Task 4.0b: Team mood and ROTI trend (B23) — back end

**Read first:** spec §9.2 B23, criterion 20; `app/Actions/HealthCheck/BuildHealthTrend.php` (whole file), `SummarizeHealthCheck.php` (`scoreOf`), `app/Mcp/Tools/Retro/GetRoti.php:85-100` (`withAvg('rotiVotes', 'score')`), `resources/js/components/skrum/mood-trend-chart.tsx` (`MoodPoint`), `tests/Feature/Retros/HealthTrendTest.php`.

**Files:**
- Create: `app/Actions/Teams/BuildTeamMoodTrend.php`, `tests/Feature/Teams/TeamMoodTrendTest.php`
- Modify: `app/Actions/HealthCheck/BuildHealthTrend.php` (the score of a list of retros becomes a public method `scores(Collection $retroIds): Collection` that `handle()` and the new action both call; no behaviour change), `app/Http/Controllers/TeamsController.php` (`'moodTrend' => Inertia::defer(fn (): array => $buildTeamMoodTrend->handle($team), 'trend')`), the props type of `teams/show`

**Interfaces — produces:**

```php
/**
 * @return list<array{retroId: string, title: string, completedAt: string, url: string, mood: ?float, moodVoters: int, roti: ?float, rotiVoters: int}>
 */
public function handle(Team $team): array; // at most 8, oldest first
```

The query: the team's retros in phase `Completed` with a `completed_at`, `withAvg('rotiVotes', 'score')`, `withCount('rotiVotes')`, newest first; the health scores from `BuildHealthTrend::scores()`; a retro with neither a score nor a ROTI vote is skipped; the first eight are kept and reversed.

**Feature tests (written first):** three completed retros, one with a health check, one with ROTI votes, one with both, give three points in date order with the right nulls; a completed retro with neither is absent; an open retro and a retro of another team are absent; ten retros give the eight most recent; the prop is deferred (`assertInertia` … `->missing('moodTrend')` on the first response, then `->loadDeferredProps`); `HealthTrendTest` stays green.

**Consumed by:** 4.3. **Run:** `vendor/bin/sail artisan test --compact tests/Feature/Teams tests/Feature/Retros/HealthTrendTest.php`. **Commit:** `feat(teams): mood and ROTI trend of a team (B23)`

### Task 4.0c: Avatars of team members (B24) — back end

**Read first:** spec §9.2 B24; `TeamsController@show` (`members`, `availableMembers`), `app/Models/User.php:80` (`avatarUrl()`).

**Files:** modify `TeamsController.php` (both maps become `[...$member->only(['id', 'name', 'email']), 'avatarUrl' => $member->avatarUrl()]`), the props type; test in `tests/Feature/Teams/TeamsTest.php`.

**Feature tests (written first):** each member and each available member carries an `avatarUrl` that starts with the application's avatar route; `availableMembers` stays empty for a user who cannot manage members.

**Consumed by:** 4.1. **Commit:** `feat(teams): avatar URL of team members (B24)`

### Task 4.0d: Template, facilitator and ROTI of a retro; players in the room of a game (B41) — back end

**Read first:** spec §9.3 B41, criterion 40; `TeamsController@show` (`retros`, `pokerGames`), `app/Actions/Poker/PresentPokerGameSummary.php`, `app/Contracts` (`PokerPresenceRoster::playerIds()` returns the ids or `null`), `app/Support/RetroTemplates/TemplateCatalogue.php` (a template's translated name), `app/Models/Retro.php` (`workspaceTemplate`, `facilitator_participant_id`), `tests/Feature/Poker/TeamPokerSectionTest.php`, `ReverbPokerPresenceRosterTest.php` (how the roster is faked).

**Files:**
- Create: `app/Actions/Retros/PresentTeamRetro.php` (the name `PresentRetroSummary` is taken: it presents the AI summary), `tests/Feature/Teams/TeamRetroCardsTest.php`
- Modify: `TeamsController.php` (`retros` through the new action, with `->with(['workspaceTemplate', 'facilitator.user'])->withAvg('rotiVotes', 'score')` — confirm the relation name of the facilitator participant in `Retro.php`; `'pokerPresence' => Inertia::defer(…, 'presence')`), the props type

**Interfaces — produces:** each retro: the five keys of today plus `templateName` (the workspace template's name, or the built-in template's translated name), `facilitator` (`name`, `avatarUrl`, or `null`), `rotiAverage` (one decimal, completed retros with votes, otherwise `null`). `pokerPresence`: `array<string, ?int>`, game id → players online, for the games that are not ended; `null` when the roster answers `null`.

**Feature tests (written first):** a retro from a built-in template and one from a workspace template carry the right name; a retro whose workspace template was deleted is named "Workspace template"; the facilitator's name and avatar; `rotiAverage` only when completed with votes; `pokerPresence` with a faked roster of two players, `null` when the roster fails, and no entry for an ended game; the page's query count does not grow with the number of retros.

**Consumed by:** 4.1. **Run:** `vendor/bin/sail artisan test --compact tests/Feature/Teams tests/Feature/Poker/TeamPokerSectionTest.php`. **Commit:** `feat(teams): template, facilitator and ROTI on retro cards, players online on games (B41)`

### Task 4.1: Team page on the new layout — sessions, members, settings

**Places left (feature roadmap):** "Invite" in the members card (IN-4); the member's role badge (TM-6); under the team name, the sprint and the next retro (TM-1); the regions of the dashboard for the recent sessions table, the aggregated open actions and the activity feed (TM-2, TM-3, TM-4), which are named grid areas of `team-page.tsx`; participant, card and action counts in the footer of a retro card (TM-5); the thumbnail of a whiteboard row (TM-7).

**Read first:** brief 04 §1 (anchors), §3 rows 1–23, 32–41, §4, §8; ScreenTeam and ScreenDashboard READMEs and previews; the answers 1-D2, 4-D4, 4-D5, 4-D6.

**Files:**
- Create in `resources/js/components/teams/`: `team-page.tsx`, `team-header.tsx`, `team-retros-section.tsx`, `team-poker-section.tsx`, `team-whiteboards-section.tsx`, `section-actions-menu.tsx`, `team-members-card.tsx`, `team-settings-card.tsx` and their Vitest files; `resources/js/pages/dev/sections/team.tsx`; `tests/Browser/Walkthroughs/Plan18eTeamPageTest.php`, `tests/Browser/Visual/TeamPageVisualTest.php`
- Rewrite: `resources/js/pages/teams/show.tsx` (`AppLayout` with `active` from the URL hash: `sessions`, `mood`, `members`, default `dashboard`; breadcrumbs workspace › Teams › team); add `teams/show` to `page-layouts.ts`
- Delete: `components/teams/poker-games-section.tsx`, `whiteboards-section.tsx`

**Interfaces — consumes:** `NewSessionDialog` — one instance, opened by the one "New session" trigger of the team header and by `useNewSessionIntent()` (1.1); no per-type tile (1-D2, deviation D-09); `SessionCard` with the template name, the facilitator and the ROTI of a closed retro (4.0d); the poker table with "n in the room" from the deferred `pokerPresence` (a skeleton, then the number, nothing when `null`); `SectionActionsMenu({ label, items })` — the "…" menu of a section (4-D6): "Saved decks" (a link to `poker/decks`) in Planning poker, named "Planning poker actions"; "Whiteboard templates" (opens the manager of 1.3) in Whiteboards, named "Whiteboards actions". "Estimation history" stays a link in the section header, as ScreenTeam shows. `EmptyState`, `ConfirmDialog` (promise wrapper around `router.delete`), `AvatarStack` and member rows with `avatarUrl` (4.0c), `formatPoints`. Removing a member asks for confirmation: "Remove :name from :team?" (4-D5).

**Browser tests changed** (imposed by `Sidebar/README.md`, ScreenTeam and the answer 4-D6):
- `Plan09bActionItemsAdditionsTest.php:216-221` (`P09b-02a`): the expected sidebar entries string and the `$sidebarTeams` selector ("All teams"). Only these lines; the rest of the test belongs to 5.2.
- `Plan12aIntegrationsFoundationTest.php` `P12a-01b`, `01c`, `Plan13aGamesFoundationTest.php` `P13a-01`, `Plan14bOutgoingWebhooksTest.php` `P14b-07`: `a[href$="/games"]` and `a[href$="/integrations"]` scoped to `main` (the sidebar carries the same links).
- Section menus (4-D6): `click('Saved decks')` → open `[aria-label="Planning poker actions"]` then `[role="menuitem"]:has-text("Saved decks")` in `Plan10bPokerAdditionsTest.php`; `button:text-is("Whiteboard templates")` → open `[aria-label="Whiteboards actions"]` then `[role="menuitem"]:has-text("Whiteboard templates")` in `Plan17bWhiteboardTemplatesTest.php`.
- Unchanged and checked: `a:has-text("Open action items (1)")`, "No retrospectives yet." before "Planning poker" in the page text, `click('New session')` (1.1), `click('Estimation history')`, "3 tasks · 1 estimated · 5 points" in one text node, "Last activity", `a[href="/whiteboards/{id}"]` containing "Facilitated by …", `button[aria-label="Delete Sprint board"]`, `[role="dialog"] button:text-is("Delete this board")`, "No games yet.", "No whiteboards yet.".

**New tests:** `[P18e-04-01]` the sidebar entries Sessions, Mood & ROTI and Members land on `#sessions`, `#mood`, `#members` and `aria-current` follows; `[P18e-04-03]` a retro card shows its phase, template, facilitator and, once closed, its ROTI, and links to the retro; `[P18e-04-04]` active and ended games, "2 in the room" with two browsers in a game, the row becomes a card at 390; `[P18e-04-05]` rename by a manager, no control for a member; `[P18e-04-06]` delete team; add a member; removing one asks for confirmation, Cancel keeps the member, Confirm removes; `[P18e-04-07]` a member of a workspace that has no team reaches the workspace page and the sidebar renders (Review Focus 5); `[P18e-04-08]` the "…" menus open with the keyboard and hold their entry.

**Run:** browser `Plan04`, `Plan09bActionItemsAdditionsTest.php`, `Plan10aPokerCoreTest.php`, `Plan10bPokerAdditionsTest.php`, `Plan12aIntegrationsFoundationTest.php`, `Plan13aGamesFoundationTest.php`, `Plan14bOutgoingWebhooksTest.php`, `Plan17aWhiteboardCoreTest.php`, `Plan17bWhiteboardTemplatesTest.php`, `Plan18eTeamPageTest.php`, `Visual/TeamPageVisualTest.php`.

**Commit:** `feat(team): team page on the new layout, sessions and members`

### Task 4.2: Health check card on the new manager

**Read first:** brief 04 §3 rows 24–31; risk R5.

**Files:** create `components/teams/team-health-card.tsx` (inside the section `id="mood"`, under the trend card of 4.3); delete `components/teams/health-statements-section.tsx`.

**Interfaces — consumes:** `HealthStatementsManager` (`onReorder`, `onAdd`, `onEdit`, `onArchive`, `onRestore`, `addErrors`, `editErrors`, `error`), the five `TeamHealthStatement*` Wayfinder controllers.

**Browser tests changed:** `Plan08bHealthCheckTest.php` `P08b-01a`: the drag announcement `'Moved Interaction to position 2.'` becomes the manager's wording (read `health-check-manager.tsx` around lines 590–615 for the exact sentence) — imposed by `HealthCheck/README.md` (the manager owns its announcements). Unchanged and checked: `[aria-label="Drag to reorder"]`, `[aria-label="Statement"]`, `[aria-label="Axis label"]`, `button:has-text("Add statement")`, `input[name="text"]`, "Edit", "Save", "Archive", "Archived (1)", "Restore", "Statement added.". If the manager's edit input has no `name="text"`, the component takes it.

**Run:** browser `Plan08bHealthCheckTest.php`, `Plan18eTeamPageTest.php`.

**Commit:** `feat(team): health check card on the new manager`

### Task 4.3: Mood and ROTI trend card

**Read first:** spec §9.2 B23; ScreenDashboard (the trend block) and `MoodTrendChart/README.md`; `resources/js/components/skrum/mood-trend-chart.tsx` (`MoodPoint`: `sprint`, `mean`, `voters`, `href`; `period`, `scale`, `emptyLabel`, `defaultView`).

**Files:** create `components/teams/team-mood-card.tsx`, `lib/teams/mood-adapter.ts`, `mood-adapter.test.ts`; modify `team-page.tsx` (mount, first in the section `id="mood"`); extend `Plan18eTeamPageTest.php`, `TeamPageVisualTest.php`.

**Interfaces:**
- Consumes: the deferred prop `moodTrend` (4.0b) through Inertia's `<Deferred data="moodTrend">` with a pulsing skeleton as fallback; `MoodTrendChart` with `period="retro"`; `Tabs` "Mood" / "ROTI".
- Produces: `toMoodPoints(trend, 'mood' | 'roti'): MoodPoint[]` — one point per retro that has the value (`sprint` = the retro's title, `mean`, `voters`, `href` = its URL); `scale` 1 to 5 for ROTI and the health-check scale for mood (read `SummarizeHealthCheck::scoreOf` for its bounds).

**Browser tests changed:** none.

**New tests:** `[P18e-04-09]` a team with two completed retros shows two points and the delta since the previous one; the ROTI tab shows the ROTI averages; the table view lists the same values; a team without data shows the empty state; the skeleton shows before the deferred prop arrives. Vitest: the adapter skips a retro without the value and keeps the order.

**Run:** `npm run test -- resources/js/lib/teams`; browser `Plan18eTeamPageTest.php`, `Visual/TeamPageVisualTest.php`; group gate; G-visual-4.

**Commit:** `feat(team): mood and ROTI trend card`

### Task 5.0: Counters of the action items page, `filterTeams` (B25, B16) — back end

**Read first:** spec §9.2 B25, criterion 22, B16; `app/Http/Controllers/WorkspaceActionItemsController.php` (whole file), `app/Actions/ActionItems/ActionItemFilters.php`, `ActionItemQuery.php`, `tests/Feature/ActionItems/ActionItemsPageTest.php`.

**Files:** modify `WorkspaceActionItemsController.php` (`'teams'` → `'filterTeams'` at line 63; `'counts' => fn (): array => $this->counts(…)`), `ActionItemQuery.php` if the counting needs a scope it lacks; the props type of `action-items/index`; the old page `resources/js/pages/action-items/index.tsx` (reads `filterTeams`; one-line change, the page is rewritten in 5.2); tests in `ActionItemsPageTest.php`.

**Interfaces — produces:** `counts: { open: int, overdue: int, completed: int, mine: int, rituals: int }`, built on the same query as `items` with the status filter removed: `open` and `completed` by `completed_at`; `overdue` = open with `due_on` before today; `mine` = open and assigned to the viewer; `rituals` = distinct `retro_id` among the counted items. The shared prop `teams` keeps `{ id, name }` only.

**Feature tests (written first):** `->where('filterTeams.0.name', 'Alpha')` and the shared `teams` shape; the five counts for a workspace with open, overdue, completed and unassigned items across two retros; the team and assignee filters narrow the counts and the status filter does not; an item of a team the user cannot see is counted nowhere; `counts` is absent from a partial reload that asks only for `items`, and present when asked.

**Consumed by:** 5.2. **Run:** `vendor/bin/sail artisan test --compact tests/Feature/ActionItems`. **Commit:** `feat(action-items): counters per status and filterTeams (B25, B16)`

### Task 5.2: Action items page on the new table, sheet and filters (needs R12, 4.1 and 5.0)

**Places left (feature roadmap):** the first table column for the selection checkboxes and the floating bulk bar (AI-1); the Priority, Due date and Source facets of the filter toolbar, which takes its facets from a list (AI-2); the "In progress" value of the status filter and badge (AI-3); "Export" in the topbar, before "New action item" (AI-4); "Sprint" in "Group by" (TM-1).

Brief: `18e-briefs/05-action-items.md`. Its commit 5.1 is Task R8b.

**Read first:** brief 05 §1 (prop collision), §3 all rows, §4, §5, §8; ScreenActions README and preview: topbar ("New action"), header with counters and "Group by", faceted filter bar, table; the answers 5-D1 to 5-D7.

**Files:**
- Create in `resources/js/components/action-items/`: `action-items-table.tsx`, `action-items-list.tsx`, `action-items-header.tsx`, `action-item-filters.tsx`, `action-item-filters-drawer.tsx`, `action-item-sheet.tsx`, `action-item-create-dialog.tsx`, `use-action-items-realtime.ts`, `use-action-item-filters.ts`, `lib/action-items/grouping.ts` and their Vitest files; `tests/Browser/Walkthroughs/Plan18eActionItemsTest.php`
- Rewrite: `resources/js/pages/action-items/index.tsx` (`AppLayout active="actions"` with `actions={<NewActionItemButton />}`: "New action item" sits in the topbar, 5-D6, through the slot of Task 0.15; the page root carries `data-realtime`); add `action-items/index` to `page-layouts.ts`
- Delete: the twelve old files of `components/action-items/` (`action-item-card`, `action-item-comments`, `action-item-form`, `anonymous-notice`, `assignee-select`, `due-date-chip`, `export-action-item-button`, `export-action-item-dialog`, `external-link-chips`, `priority-select`, `recurrence-select`, `subtask-checklist`) after `grep -rnE "components/action-items/(action-item-card|action-item-form|…)" resources/js` finds no importer

**Interfaces — consumes:** R8b files (with `ItemDeleteConfirm`: deleting asks for confirmation, 5-D3); `ActionItem`, `ActionSheet`, `Table`, `Pagination`, `Popover` + `Command`, `Drawer`, `EmptyState`, `ToggleGroup`; props `filterTeams` and `counts` (5.0).

**Composition changed by the answers and by rule 13:**
- Header (5-D5, M18): the counters of `counts` — "n open · n overdue · n completed · from n rituals" — reloaded with `items` (`router.reload({ only: ['items', 'counts'] })` wherever the page reloads `items` today, the realtime handler included). On a phone, the filter chips carry their numbers: "Mine n", "Overdue n", "Open n".
- "Group by" (5-D4): a segmented control None / Team / Assignee / Status, on the client, over the rows of the current page. `groupItems(items, by): { key: string; label: string; items: ActionItem[] }[]` in `lib/action-items/grouping.ts`; a group is a table section with a header row (label and count); the order of the rows inside a group is the server's. The choice is kept in the same `localStorage` entry as the filters. Grouping by sprint is not built (D-19); under a group header the page says "on this page" when the list has more than one page, so that a group's count is not read as a total.
- The owner label is the component's "(Guest)" (5-D7).
- Not built, with their rows in "Deviations": selection and the bulk bar, the priority / due date / source filters, the "In progress" status, the topbar "Export" (D-19).

**Browser tests changed** (imposed by ScreenActions: a table with a filter toolbar, details in a side sheet):
- `Plan09bActionItemsAdditionsTest.php` helper `p09bFilter`: `div.grid > [aria-label=…]` → `[role="toolbar"][aria-label="Filters"] [aria-label=…]`.
- `P09b-02b`: `li[id^="action-item-"]` → `tr[id^="action-item-"]`; the expanded comments are in the open sheet.
- `P09b-02c`, `04`, `05`, `06b`: open the sheet (click the row title) and scope the assignee, sub-task, due-date and repeat selectors to `[data-slot="action-sheet"]`; `[aria-label="1 of 3 sub-tasks done"]` is read as the sheet's text.
- "(Guest)" (5-D7): `Plan09bActionItemsAdditionsTest.php` :302, :305, :306 — `'Carol Guest (guest)'` → `'Carol Guest (Guest)'`, `:has-text("(guest)")` → `:has-text("(Guest)")`.
- Delete confirmation (5-D3): a test of this page that deletes an item confirms in `[role="alertdialog"]`.
- "New action item" (5-D6): the button is in `header`; a test that scopes it to `main` is rescoped.
- Unchanged and checked: `#action-item-{id}`, `[aria-label="Status"]`, `[aria-label="Assignee"]`, `[aria-label="Team"]`, "Mark as done", "Reopen", "Edit action item", "Delete action item", `#action-item-{id} [aria-label="Export to Jira"]` on the row (`P12d-06`), `section:has-text("Linked action item")`, "No open action items.", "Nothing matches these filters.", "Follow-ups of every team you can see", "Added outside a retro", "Due …", "Repeats weekly", `nav[aria-label="Pagination"]`, the `localStorage` key `skrum.actionItemFilters.{workspace.id}`, `[data-realtime]`.

Before editing, confirm in `action-sheet.tsx` (around lines 480–720) that the due date is a native input that `fill()` can type into and that Repeat is disabled without a due date; if not, the component is fixed in its own commit and groups 2 and 4 are told.

**New tests:** `[P18e-05-07]` the header counters match the database and move when an item is completed in another browser; `[P18e-05-08]` "Group by" Team, Assignee and Status regroups the rows, survives a reload, and "None" restores the flat list; `[P18e-05-09]` Delete asks for confirmation; Cancel keeps the item; `[P18e-05-10]` "New action item" is in the topbar and opens the creation dialog; `[P18e-05-01]` table columns, overdue row, Previous / Next with 51 items; `[P18e-05-02]` filters toolbar, "Overdue" shortcut, Reset clears the query and the storage; `[P18e-05-03]` a row opens the sheet, edits save, Escape returns focus to the row; `[P18e-05-04]` at 390: the list, the filters drawer, a status change; `[P18e-05-05]` two browsers: a change at A shows at B; an item deleted at A while B's sheet is open shows "This action item was deleted."; `[P18e-05-06]` `?item=` of an item outside the page opens the sheet under "Linked action item"; one `[data-realtime]` on the page.

**Run:** `vendor/bin/sail artisan test --compact tests/Feature/ActionItems`; Pint; browser `Plan09aActionItemsCoreTest.php`, `Plan09bActionItemsAdditionsTest.php`, `Plan12dActionItemExportTest.php`, `Plan14cTrackersTest.php`, `Plan14dStatusSyncTest.php`, `Plan18eActionItemsTest.php`.

**Commit:** `feat(action-items): action items page on the new table, sheet and filters`

### Task 5.3: Bench section and captures of the action items page

**Files:** create `resources/js/pages/dev/sections/actions-index.tsx` (rows, grouped rows, counters, empty, loading, overdue, sheet open, delete confirmation), `tests/Browser/Visual/ActionsPageVisualTest.php`.

**Run:** the visual test; group gate; G-visual-5.

**Commit:** `test(action-items): dev section and visual captures`

## Lane G — Group 6, games

Brief: `18e-briefs/06-games.md`. Eleven tasks; G0a to G0e are back-end tasks and come first. G1 and G2 are independent; G3 → G4 → G5; G6 runs on lane S after S2. What the owner changed in this lane: eight ink colours (6-D2), the reaction bar in a room (6-D3), status and avatars in the rooms list (6-D6), the full Share dialog (6-D7), one timer list (X5). What rule 13 added: M19, M20, M28.

### Task G0a: Drawing ink — black and the eight theme colours (B26) — back end and palette

**Read first:** spec §9.2 B26, criterion 23, ruling 36; `app/Support/Games/DrawingOp.php`, `resources/js/lib/games/drawing.ts` (`DrawingColors`, `Palette`, `PaletteIndex`, `EraserColor`), `resources/js/lib/games/types.ts` (`DrawingColor`), `resources/css/app.css:263-290` (the light values of `--skrum-col-*-text`), `tests/Feature/Games/DrawingOpTest.php`, `DrawingTest.php`.

**Files:** modify `DrawingOp.php`, `app/Support/Branding/BrandPalette.php` (`oklchToHex` becomes `public static`), `lib/games/drawing.ts`, `lib/games/types.ts`, `lib/games/drawing.test.ts`; tests `DrawingOpTest.php`, new `DrawingInkPaletteTest.php`.

**Interfaces — produces:**

```php
// DrawingOp
public const Colors = ['black', 'sun', 'apricot', 'coral', 'plum', 'iris', 'sky', 'lagoon', 'moss', 'white'];

/** Colours of drawings made before the eight theme inks. Still accepted and still drawn; no longer offered. */
public const LegacyColors = ['red', 'orange', 'green', 'blue', 'purple'];
// parse(): in_array($color, [...self::Colors, ...self::LegacyColors], true)
```

```ts
// lib/games/drawing.ts
export const DrawingColors: DrawingColor[] = ['black', 'sun', 'apricot', 'coral', 'plum', 'iris', 'sky', 'lagoon', 'moss'];
```

`Palette` keeps its seven entries at their indexes (white, black, red, orange, green, blue, purple: a stored raster or replay must not change) and gains eight entries after them. Their RGB values are the sRGB conversion of the light-theme `--skrum-col-<name>-text` tokens of `app.css` (lines 263 to 290, `oklch(L C H)`), written as literals with a comment naming the token. The conversion is the one `BrandPalette::toHex()` already performs through its private `oklchToHex(array $color)` (line 325): this task makes it `public static` (no behaviour change), and a Pest test, `tests/Feature/Games/DrawingInkPaletteTest.php`, reads the eight `oklch(…)` values from `resources/css/app.css` and the eight literals from `resources/js/lib/games/drawing.ts` and asserts that they match, so the literals cannot drift from the tokens. `DrawingColor` gains the eight names.

**Tests (written first):** PHP — a stroke and a fill are accepted in each of the ten colours and in each of the five legacy colours; an unknown colour is refused. Vitest — `isDrawingColor` accepts the fifteen names; **the palette indexes of white, black and the five legacy colours are 0 to 6, as before, and a stored op in `red` rasterises to `220 38 38`** (Review Focus 6); each new colour has a contrast of at least 3:1 on white (compute it in the test from the literal).

**Consumed by:** G4. **Run:** `vendor/bin/sail artisan test --compact tests/Feature/Games/DrawingOpTest.php tests/Feature/Games/DrawingTest.php`; `npm run test -- resources/js/lib/games`. **Commit:** `feat(games): black and eight theme colours for the drawing ink (B26)`

### Task G0b: Reactions setting of a standalone game room (B27) — back end

**Read first:** spec §9.2 B27, criterion 24; `database/migrations/2026_10_09_100100_add_reactions_enabled_to_whiteboards_table.php` (the convention), `app/Models/GameRoom.php`, `app/Http/Controllers/Games/GameRoomsController.php:33-62` (`update`: the two rule sets), `app/Actions/Games/BuildGameSnapshot.php:71-78` (`room`), `app/Events/Games/GameRoomChanged.php`, `tests/Feature/Games/GameRoomsTest.php`, `GameSnapshotTest.php`, `IcebreakerRoomTest.php`.

**Files:** create a migration `add_reactions_enabled_to_game_rooms_table` (up only: `boolean('reactions_enabled')->default(true)`); modify `GameRoom.php` (fillable, cast, PHPDoc), `GameRoomFactory.php`, `GameRoomsController.php` (standalone rules: `'reactions_enabled' => ['sometimes', 'boolean']`; icebreaker rules: `'reactions_enabled' => ['prohibited']`), `BuildGameSnapshot.php` (`'reactionsEnabled' => $room->reactions_enabled`), `GameRoomChanged.php` if its payload lists the room's fields, `resources/js/types/games.ts`; tests in `GameRoomsTest.php`, `GameSnapshotTest.php`, `IcebreakerRoomTest.php`.

**Feature tests (written first):** a new room has reactions on and its snapshot says so; the manager turns them off and `GameRoomChanged` reaches the others with the new value; a player who does not manage the room gets 403; the field is refused on an icebreaker room; the presence channel authorisation of a room is unchanged (`GameBroadcastAuthorizationTest` stays green: reactions are client events on that channel, no new route).

**Consumed by:** G3. **Commit:** `feat(games): reactions setting of a standalone room (B27)`

### Task G0c: Status and players of a room in the rooms list (B28) — back end

**Read first:** spec §9.2 B28, criterion 25; `app/Actions/Games/PresentGameRoomSummary.php`, `PresentGamePlayer.php`, `app/Models/GameRound.php` (`isActive()`, its start column), `tests/Feature/Games/GamePagesTest.php`.

**Files:** modify `PresentGameRoomSummary.php` (`query()` eager-loads `currentRound` and the first five `players.user`; `handle()` adds the keys), `resources/js/types/games.ts`; tests in `GamePagesTest.php`.

**Interfaces — produces**, added to each room: `status` (`'playing'` when `activeRound()` is not null, otherwise `'waiting'`), `players` (at most five: `id`, `name`, `avatarUrl`, through `PresentGamePlayer`), `roundStartedAt` (ISO 8601 or `null`). No game has a minimum number of players (`StartGameRound` checks none), so the mockup's "needs n more players" has no data: deviation D-20.

**Feature tests (written first):** a room with an active round is `playing` with its `roundStartedAt`, a room without one `waiting`; a room of seven players sends five and `playersCount` 7; the query count of the page does not grow with the number of rooms.

**Consumed by:** G1. **Run:** `vendor/bin/sail artisan test --compact tests/Feature/Games`. **Commit:** `feat(games): status and players of a room in the rooms list (B28)`

### Task G0d: Team-level games channel — a live rooms list (B28) — back end

**Read first:** spec §9.2 B28 (the channel and its two events), criterion 25, §15 point 2; `app/Events/ActionItems/TeamActionItemsBroadcastEvent.php` (the team channel this one copies: a private channel `team-action-items.{teamId}`), `app/Http/Controllers/BroadcastAuthorizationsController.php` (the branch that authorises `private-team-action-items.`: copy its rule), `app/Events/Games/GameBroadcastEvent.php`, `GameRoomChanged.php`, `GameRoomDeleted.php`, `GameRoundStarted.php`, `GameRoundEnded.php` and the places that dispatch them (`grep -rn "GameRoomChanged\|GameRoomDeleted\|GameRoundStarted\|GameRoundEnded" app`), `app/Actions/Games/CreateGameRoom.php`, `FindGamePlayer.php` and `GameJoinsController@store` (where a player row is created), `tests/Feature/Games/GameEventsTest.php`, `GameBroadcastAuthorizationTest.php`, `PayloadLeakHelperTest.php`.

**Files:**
- Create: `app/Events/Games/TeamGamesBroadcastEvent.php` (abstract, `PrivateChannel("team-games.{$this->teamId}")`), `TeamGameRoomChanged.php` (`broadcastAs` `team.game-room.changed`; payload `room` = `PresentGameRoomSummary::handle()`), `TeamGameRoomDeleted.php` (`team.game-room.deleted`; payload `roomId`), `app/Actions/Games/AnnounceTeamGameRoom.php`, `tests/Feature/Games/TeamGamesChannelTest.php`
- Modify: `BroadcastAuthorizationsController.php` (a branch for `private-team-games.`), the dispatch points, `resources/js/types/games.ts`

**Interfaces — produces:**

```php
// App\Actions\Games\AnnounceTeamGameRoom
/** Reloads the room's summary and sends it to the team's games channel. Does nothing for an icebreaker room. */
public function changed(GameRoom $room): void;
public function deleted(GameRoom $room): void;
```

`changed()` is called, after commit, where a standalone room is created, where `GameRoomChanged` is dispatched (rename, access, language, game switch, host change), where a round starts and where it ends (every path that dispatches `GameRoundEnded`: end, expiry, pass), and where a new player row is created. `deleted()` where `GameRoomDeleted` is dispatched. Both events go to others (`sendToOthers()` in a request; the queued paths have no socket to exclude). The authorisation branch accepts a signed-in user who can `view` the team of the channel's id, and refuses everyone else, a room's guest included.

**Feature tests (written first):** creating, renaming, deleting a room, starting and ending a round, and a new player joining each send one event on `private-team-games.{teamId}` with the room's current summary (`status`, `players`, `playersCount`, `roundStartedAt`); **an icebreaker room of a retro sends nothing**; the payload passes the leak helper of `PayloadLeakHelperTest` (no word, drawing op, clue or answer); the channel is authorised for a team member, refused (403) for a member of another team of the workspace who cannot view this one, for a room's guest and for an unauthenticated socket (Review Focus 7).

**Consumed by:** G1. **Run:** `vendor/bin/sail artisan test --compact tests/Feature/Games`. **Commit:** `feat(games): team-level games channel for a live rooms list (B28)`

### Task G0e: "+2 min" on a game room timer (B20) — back end

**Read first:** spec §9.2 B20 (Game room row), criterion 17; `app/Http/Controllers/Games/GameTimersController.php` (whole file), `app/Actions/Games/ScheduleRoundExpiry.php`, `app/Jobs/CloseExpiredGameRound.php` (it belongs to one end time), `app/Models/GameRoom.php` (`effectiveTimerEndsAt()`), Task R2b, `tests/Feature/Games/GameTimerTest.php`, `routes/web.php:551`.

**Files:** create `app/Http/Controllers/Games/GameTimerExtensionsController.php` (`store`), `tests/Feature/Games/GameTimerExtensionTest.php`; modify `routes/web.php` (`Route::post('timer/extension', [GameTimerExtensionsController::class, 'store'])->name('games.timer.extension.store');`), `GameTimersController.php` (constant `MaxSeconds = 7200`).

**What it does:** as R2b, on `game_rooms.timer_ends_at`: `GameGuard::standalone` and `GameGuard::host` before the lock, `GameGuard::host` again inside it; 422 on `timer` when no timer runs or beyond the maximum; `(new GameTimerChanged($room, $endsAt->toIso8601String()))->sendToOthers()`; when the room has an active round, `ScheduleRoundExpiry::handle($room, $round)`, which schedules the close at the new end. An icebreaker room is refused by `GameGuard::standalone`: its timer is the retro's (R2b).

**Feature tests (written first):** the end moves by 120 seconds and the event carries it; **the round is closed by the job of the new end and not by the job of the old one**; 422 without a running timer and beyond two hours; 403 for a player who is not the host and for a guest; refused on an icebreaker room.

**Consumed by:** G3. **Run:** `vendor/bin/sail artisan test --compact tests/Feature/Games/GameTimerExtensionTest.php tests/Feature/Games/GameTimerTest.php`; `php artisan wayfinder:generate`. **Commit:** `feat(games): extend a running room timer by two minutes (B20)`

### Task G1: Team games page

**Places left (feature roadmap):** none beyond the deviations of D-20 that stay backlog.

**Read first:** brief 06 §3 rows 1–12, §4.1; brief 01 §3 rows 47–52 (the "New room" dialog; K9); risk R6.

**Files:** create `components/games/team-games.tsx`, its test, `tests/Browser/Walkthroughs/Plan18eGamesTest.php`, `tests/Browser/Visual/GamesPagesVisualTest.php`; rewrite `resources/js/pages/games/index.tsx` (`AppLayout active="games"`); add `games/index` to `page-layouts.ts`; delete `components/games/new-room-dialog.tsx`, `room-card.tsx`, `team-leaderboard.tsx`.

**Interfaces — consumes:** `GamesLeaderboard` (rooms with `status`, the avatar stack of `players` and "started n min ago" from `roundStartedAt`, G0c, M19; the list is live: a new hook `use-team-games-channel.ts` in `components/games/` subscribes to `private-team-games.{team.id}` and replaces, adds or removes a room in the list on `team.game-room.changed` / `team.game-room.deleted` (G0d), with the page's one `[data-realtime]` on its root, as `action-items/index` does; leaderboard with the podium streak of 0.10, embedded `NewGameRoomDialog` with ids `new-room-name`, `new-room-game`, `new-room-access`; `onCreate` resolves `false` on a server error so the dialog stays open). Search the Inertia v3 docs for the error state of a deferred prop before choosing between `leaderboardError` and rendering `Leaderboard` inside `<Deferred>`.

**Browser tests changed** (imposed by `GamesLeaderboard/README.md`: podium for the first three, tabs for the period): `Plan13dIcebreakerScoresInvitesTest.php` `P13d-09a`, `09b`, `10a`, `10b` — `section[aria-labelledby="team-leaderboard"] ol > li …` → `[data-slot="podium-place"]` / `[data-slot="leaderboard-row"]`; `[data-state="on"]` → `[data-state="active"]`. Unchanged: "New room", `#new-room-*`, "Create room", "Back to the team", "No game rooms yet.", "No games played yet.", `[aria-label="Period"]`, "Last 30 days", "All time", "2-week streak".

**New tests:** `[P18e-06-01]` podium with a streak on a top-three player and the current user marked; `[P18e-06-02]` room links and order; `[P18e-06-07]` a room with a round in play shows "Playing", its players' avatars and "started … ago"; a room without a round shows "Waiting"; `[P18e-06-11]` two browsers on the page: a room created, renamed, started and deleted in one appears, changes and disappears in the other without a reload.

**Commit:** `feat(games): team games page`

### Task G2: Guest join

**Read first:** brief 06 §3 rows 13–15; brief 11 §3 row 34; the answer 6-D9 (the nickname is prefilled).

**Files:** rewrite `resources/js/pages/games/join.tsx`; add `games/join` to `page-layouts.ts`.

**Interfaces — consumes:** `GuestJoinPage` (`kind="game"`, `invalidTitle={t('Join a game')}`, `session` = the prop of R2a (title, game label, host, players, live), `suggestedName` prefilled).

**Browser tests changed** (imposed by `GuestJoin/README.md`): `Plan13aGamesFoundationTest.php:143-144` and `Plan13dIcebreakerScoresInvitesTest.php:444,672` — the sentence "You are invited to play Hangman. Choose the name other players will see." and "Display name" → the game name "Hangman" in the session card and "Your nickname". `$guest->value('#name')` (the random name) is unchanged (6-D9).

**New tests:** `[P18e-06-03]` an invalid link shows the notice with HTTP 404.

**Commit:** `feat(games): guest join`

### Task G3: Room shell and hangman

**Places left (feature roadmap):** in the left column, under the game cards, the settings card (GM-1); in the right column, the turn order, and in the stage header "Round n of m" (GM-2); the four other game cards of the picker (GM-4), which lists whatever `gameOptions` holds.

**Read first:** brief 06 §3 rows 16–43, 55–56, §4.3; R4, R7, R9; the answers 6-D1, 6-D3, 6-D7, 6-D8 and X5; ScreenIcebreaker and ScreenIcebreakerDraw (standalone frame: topbar with Invite and Game settings, ReactionBar on the stage).

**Files:** create in `components/games/`: `game-room.tsx` (new body), `game-layout.tsx`, room header, menu, settings / delete / reset dialogs, sidebar with `player-row.tsx` and scores, end card, start controls, leader picker, pass button, history sheet, round detail, `room-full.tsx`, `room-gone.tsx`, `hangman-board.tsx`, `hangman-figure.tsx`, `word-mask.tsx`, `letter-keyboard.tsx` (new bodies), Vitest for `player-row` and the keyboard layouts; rewrite `resources/js/pages/games/show.tsx`. Delete the 28 old files the brief lists for G3. Kept: `room-context.tsx`.

**Interfaces — consumes:** `SessionShell` (`kind="game"`), `SessionTitle` (`badges` = the game badge), `SessionPresence`, `SessionTimer` (`alarm={false}`, the Timer's own list 1, 3, 5, 10 — the 2-minute entry goes, X5 —, host only, `onExtend` posts to `games.timer.extension.store` of G0e), `TimeUpBadge` (in `<main>`, next to the stage title), `IcebreakerGameGrid` / `IcebreakerGameCard`, `Sheet`, `FormDialog`, `ConfirmDialog`, `EmptyState`; `ShareDialog` (the full dialog, 6-D7: guest switch, link, copy, "Create a new link" with confirmation, QR code, and `channelsExtra` = `post-link-section`), opened by "Invite" in the header; `SessionReactions` on the room's presence channel, mounted only while `room.reactionsEnabled` (G0b, 6-D3), `shortcuts={false}` while the hangman keyboard or a guess field is on screen (the digits and letters belong to the game); the room settings dialog gains the switch `#room-reactions`; `useGameRoom(initial, { subscribe: true })`.
- Produces: `GameLayout({ left, stage, right })` — the three-column grid without a topbar, reused by G6.

**Browser tests changed:**
- Game choice (6-D1): `[aria-label="Game"]` + `[role="option"]:has-text("Hangman")` → `[role="radiogroup"][aria-label="Choose an icebreaker"] [role="radio"]:has-text("Hangman")` in `P13a-01`, `P13a-06`, `P13b-01`, `P13b-02`, `P13c-01` — imposed by ScreenIcebreaker (left column of game cards). The icebreaker tests `P13d-06a/b/c` change in G6.
- A test that binds `header > h1` changes to `header h1` (the session frame wraps the title; ScreenIcebreakerDraw standalone frame).
- Share dialog (6-D7): `[aria-label="Copy guest link"]` is inside the Share dialog — the test presses "Invite" first — at its 5 uses in `Plan13aGamesFoundationTest.php` and 1 in `Plan13dIcebreakerScoresInvitesTest.php`; a test that replaces the link confirms once more.
- Unchanged and checked: `main [data-slot="badge"]` with "Time's up" (`Plan13a:360,390`), `[role="group"][aria-label="2 online"]`, `[aria-label="Timer"]`, `[role="menuitem"]:text-is("1 min")`, "Stop timer", `[aria-label="Room menu"]`, `#room-name`, `#room-access`, "History", "Last rounds", `section[aria-labelledby="game-players"]`, `[role="tab"]:has-text("Scores")`, `[aria-label="6 points"]`, "Ready to play?", "Start", "Next round", `button[aria-label="Who draws?"]`, `ul[aria-label="Points of this round"]`, `[role="group"][aria-label="Letters"] button:has-text("t")`, `[aria-label="1 of 6 misses"]`, `ul[aria-label="Last letters"]`, "This room is full.", "This room was deleted.", `[data-realtime]`.

**New tests:** `[P18e-06-04]` the host picks a game from the cards, a non-host sees a badge, an unavailable game shows its reason; `[P18e-06-05]` the hangman keyboard follows the locale and works at 390; one `[data-realtime]` on the page and the expired banner (Review Focus 2); `[P18e-06-08]` a reaction sent by a guest flies on the host's screen (`.lr-overlay` with the sender's name); the host turns reactions off in the settings and the bar disappears for both without a reload; the bar never covers the keyboard or the guess field at 1440 and 390; `[P18e-06-09]` "Invite" opens the Share dialog: the guest switch, the link, "Create a new link" with its confirmation, the QR code.

**Run:** browser `Plan13aGamesFoundationTest.php`, `Plan13bDrawAndDecodedTest.php`, `Plan13cSprintGifTest.php` (the two later boards still run on old files inside the new shell), `Plan18eGamesTest.php`.

**Commit:** `feat(games): room shell and hangman`

### Task G4: Draw & Guess and Decoded

**Read first:** brief 06 §3 rows 44–48, §4.4; R3, R5.

**Files:** new bodies for `draw-board.tsx`, `drawing-toolbar.tsx`, `guess-chat.tsx`, `hint-button.tsx`, `leader-word.tsx`, `decoded-board.tsx`, `clue-editor.tsx`; rewrite in place with the same exports `drawing-canvas.tsx`, `clue-row.tsx` (the retro results import them).

**Interfaces — consumes:** `use-stroke-whispers`, `use-secret-word`, `lib/games/drawing.ts` as G0a left it (`DrawingColors` = black and the eight theme colours; the swatch of a colour is its `bg-skrum-col-*-text` token class, the stroke is the canvas literal; the legacy colours are drawn and never offered), `EmojiPicker`.

**Mockup elements added by rule 13 (M20):** the toolbar is the mockup's — Pencil, Eraser, three stroke widths, "Ink" and the eight colours, Undo, Clear — with the shortcuts `P` (pencil), `E` (eraser) and `⌘Z` / `Ctrl+Z` (undo) shown in the tooltips; they are handled on the drawing stage only, for the drawer only, and never while a field is edited. `P` and `E` are single-key shortcuts: when plan 18f brings `single_key_shortcuts` (B35) they obey it; until then they are always on. Redo and "New word" are not built (D-20).

**Browser tests changed** (imposed by ScreenIcebreakerDraw and the answer 6-D2): `Plan13bDrawAndDecodedTest.php` :354, :355, :414 — `[aria-label="Red"]` → `[aria-label="Coral"]`, and every pixel assertion that follows a stroke or a fill in that colour takes the RGB of coral from `lib/games/drawing.ts` (read the literal; do not copy it from this plan). The assertions on black `'23 23 23 255'` and on the white sheet `'255 255 255 255'` are unchanged. Checked: `canvas[aria-label="Your drawing"]`, `canvas[aria-label="The drawing"]`, `[role="toolbar"][aria-label="Drawing tools"]`, `[aria-label="Fill"]`, `[aria-label="Undo"]`, "Clear" → "Click again to clear", `section[aria-labelledby="game-guesses"]`, `input[aria-label="Your guess"]`, "Very close!", `button:has-text("Reveal a letter (2 left)")`, `[aria-label="Add an emoji"]`, `[aria-label="Remove 🚀"]`, `[role="img"][aria-label="Clue: 🚀 🌕"]`.

**New tests:** `[P18e-06-06]` the colour popover of the drawing toolbar at phone width; `[P18e-06-10]` each of the eight colours draws its own RGB on the guesser's canvas; `E` then a stroke erases, `⌘Z` undoes it; **a round drawn in `red` before G0a replays in the retro results with its old colour** (Review Focus 6: seed the ops through the factory).

**Run:** browser `Plan13bDrawAndDecodedTest.php`, `Plan13dIcebreakerScoresInvitesTest.php` (round replay in the retro results).

**Commit:** `feat(games): draw & guess and decoded`

### Task G5: Sprint in one GIF

**Places left (feature roadmap):** the caption field under the chosen GIF and the podium of the results (GM-3).

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

Brief: `18e-briefs/07-whiteboard.md`. Seven tasks; 7.0 is a data task and 7.0b a back-end task. What the owner changed in this lane: the eight colours and the regenerated templates (7-D1), the guest link in the Share dialog only (7-D2), the colour bar everywhere (7-D3), the phone read mode (7-D7). What rule 13 added: M21, M28.

### Task 7.0: Built-in whiteboard templates with the eight sticky colours (B29) — data

**Read first:** spec §9.2 B29, criterion 26; `resources/whiteboard-templates/*.json` (eight files; the fills in use are `#a5d8ff` ×7, `#b2f2bb` ×5, `#fff3bf` ×5, `#ffc9c9` ×3, `#d0bfff` ×1, `#ffd8a8` ×1, and sixteen `"strokeColor": "transparent"`), `app/Support/WhiteboardTemplates/BuiltInTemplates.php` (defaults and how a file is read), `resources/js/lib/whiteboard/palette.ts` (`POSTIT`), `tests/Feature/Whiteboards/BuiltInWhiteboardTemplatesTest.php`, `PresentWhiteboardPreviewTest.php`.

**Files:** modify the eight JSON files; tests in `BuiltInWhiteboardTemplatesTest.php`. No PHP class changes.

**The mapping**, applied to every element that has one of the six fills (each such element is a sticky: confirm with `grep -c` that the sixteen transparent strokes are on those elements, and report if a filled shape that is not a sticky exists):

| Old fill | New fill | New stroke | Colour |
|---|---|---|---|
| `#fff3bf` | `#fdf1c2` | `#ddc362` | sun |
| `#ffd8a8` | `#ffecdd` | `#efb787` | apricot |
| `#ffc9c9` | `#ffebe8` | `#f9aea4` | coral |
| `#d0bfff` | `#efeeff` | `#c3bbfb` | iris |
| `#a5d8ff` | `#e2f3ff` | `#8dccf9` | sky |
| `#b2f2bb` | `#e1f8dc` | `#a5d39b` | moss |

**Feature tests (written first):** for each built-in key, every element with a `backgroundColor` other than `transparent` has one of the eight fills of `POSTIT` and the stroke of the same colour — the test reads the pairs from `resources/js/lib/whiteboard/palette.ts` with a regular expression, as `DesignTokensTest` reads `app.css`, so the two palettes cannot drift; no old fill remains in any file; the preview of each template still renders (`PresentWhiteboardPreviewTest` green); **a board created before the change keeps its stored elements** (create a board with an old-colour element through the factory, run nothing, assert it is unchanged: the change touches files, not rows) (Review Focus 6).

**Consumed by:** 7.4 (the colour bar shows the right swatch on a template note). **Browser tests changed:** `Plan17bWhiteboardTemplatesTest.php` where it reads the colour of a note created from a built-in template (`grep -n "#a5d8ff\|#b2f2bb\|#fff3bf\|#ffc9c9" tests/Browser`): the new fill. **Run:** `vendor/bin/sail artisan test --compact tests/Feature/Whiteboards`; browser `Plan17bWhiteboardTemplatesTest.php`. **Commit:** `feat(whiteboard): built-in templates on the eight sticky colours (B29)`

### Task 7.0b: "+2 min" on a whiteboard timer (B20) — back end

**Read first:** spec §9.2 B20 (Whiteboard row), criterion 17; `app/Http/Controllers/Whiteboards/WhiteboardTimersController.php` (whole file; no expiry job), Task R2b, `tests/Feature/Whiteboards/WhiteboardFacilitationTest.php` (the timer tests), `routes/web.php:524`.

**Files:** create `app/Http/Controllers/Whiteboards/WhiteboardTimerExtensionsController.php` (`store`), `tests/Feature/Whiteboards/WhiteboardTimerExtensionTest.php`; modify `routes/web.php` (`Route::post('timer/extension', [WhiteboardTimerExtensionsController::class, 'store'])->name('whiteboards.timer.extension.store');`), `WhiteboardTimersController.php` (constant `MaxSeconds = 3600`).

**What it does:** as R2b, on `whiteboards.timer_ends_at`: `WhiteboardGuard::facilitator` before and inside the lock; 422 on `timer` when no timer runs or beyond one hour; `(new WhiteboardTimerChanged($board->id, $endsAt->toIso8601String()))->sendToOthers()`. No job.

**Feature tests (written first):** the end moves by 120 seconds and the event carries it; 422 without a running timer and beyond one hour; 403 for a member who is not the facilitator and for a guest.

**Consumed by:** 7.2. **Run:** `vendor/bin/sail artisan test --compact tests/Feature/Whiteboards`; `php artisan wayfinder:generate`. **Commit:** `feat(whiteboard): extend a running timer by two minutes (B20)`

### Task 7.1: Guest join

**Files:** rewrite `resources/js/pages/whiteboards/join.tsx`; add `whiteboards/join` to `page-layouts.ts`. **Consumes:** `GuestJoinPage` (`kind="whiteboard"`, `invalidTitle={t('Join a whiteboard')}`, `session` = the prop of R2a). The brief's `guest-join-form.tsx` is not written (K2).

**Browser tests changed:** none. Checked: `joinAsGuest`, "This guest link is no longer valid." (`Plan17a:374,426`), `assertNotPresent('#name')` (`Plan17a:375`). **New:** `[P18e-07-01]` the name is prefilled, "Join" works, an invalid link shows the notice.

**Commit:** `feat(whiteboard): guest join on GuestJoin`

### Task 7.2: Board chrome on the session shell

**Places left (feature roadmap):** "Comments" in the header, before "Export" (WB-2); the "Follow :name" pill in the presence stack's popover (WB-3). The rebuilt tool bar, selection bar, zoom and minimap replace Excalidraw's own in plan WB-1: the canvas wrapper keeps the full area, so nothing of this plan's chrome moves then.

**Read first:** brief 07 §3 rows 1–5, 14–16, 30–43, 53, §4.1; R2, R3, R4, R9, R10.

**Files:** rewrite `components/whiteboard/board.tsx` (every hook and effect kept verbatim), `pages/whiteboards/show.tsx`; create `board-header.tsx`, `board-timer.tsx`, `board-facilitation.tsx`, `board-notices.tsx`, `board-share.tsx`, `board-gone.tsx`, `lib/whiteboard/presence-slot.ts`; rewrite `board-reactions.tsx`; modify `resources/css/app.css` (the three reaction rules of the Excalidraw block, on `[data-slot="reaction-bar"]`, offsets recomputed); delete `top-bar.tsx`, `status-bar.tsx`, `facilitator-bar.tsx`; `tests/Browser/Walkthroughs/Plan18eWhiteboardTest.php`, `tests/Browser/Visual/WhiteboardVisualTest.php`.

**Interfaces — consumes:** `SessionShell` (`kind="whiteboard"`, `rootRef` for `data-scene`, set by `setAttribute` in `onChange` as today), `SessionTitle` (the title is renamed in place, as the mockup's editable breadcrumb: a press on it, or `F2`, turns it into a field named "Board name", `↵` saves through the existing rename endpoint, leaving the field with a changed name saves too, and `Esc` cancels, for who may rename; the field is read-only while it saves and stays open, focused, when the save is refused; the document title follows the board's name; the "Rename" entry of the board menu stays, M21), an "Export" button in the header that opens the existing export dialog (`scene-export.tsx`), `SessionPresence` (`presenceFor` from `presence-slot.ts`; cursor colours from the presence tokens, 7-D6), `SessionTimer` (in the `start` slot of `FacilitatorBar` for the facilitator, in the header for the others, 7-D5; `onExtend` posts to `whiteboards.timer.extension.store` of 7.0b), `FacilitatorBar` (toggles "Lock the board" / "Unlock the board", "Bring everyone to me"), `SessionReactions` (`toolbarProps={{ className: 'whiteboard-reactions' }}`, `shortcuts={false}`, `compact` on a phone), `ShareDialog` (the only place of the guest-link controls, 7-D2: "Allow guests", the link, "Copy guest link", "Create a new link" with its confirmation, the QR code). The `.whiteboard-canvas` element keeps `data-facilitator` and a sized parent (`min-h-0 flex-1` chain down from `main`).

**Browser tests changed:** `Plan17cWhiteboardFacilitationTest.php:130,133,152` (`P17c-01c`): `assertAttribute('[role="timer"]', 'aria-label', "Time's up!")` (Task 0.5); the toast assertion stays. "Reconnecting…" (X3): the 9 uses of `Plan17aWhiteboardCoreTest.php`, the 5 of `Plan17bWhiteboardTemplatesTest.php` and the 1 of `Support/InteractsWithWhiteboards.php` are read; those scoped to `header` are rescoped to the banner. Guest link (7-D2): `Plan17aWhiteboardCoreTest.php` :357, :358 (the two menu items are present) → the Share dialog shows "Create a new link" and "Copy guest link"; :369, :370 (absent for a non-facilitator) → the Share dialog shows no guest control to that viewer; :408 (`click` on "Replace the guest link") → open "Share", "Create a new link", confirm; `P17b-16` likewise. Unchanged and checked: `[role="toolbar"][aria-label="Facilitation tools"] [aria-label="Timer"]`, five menu items, `[aria-label="Lock the board"][aria-pressed="false"]`, `div[role="status"]:has-text("This board is locked.")`, "Resume", `.whiteboard-reactions[role="toolbar"][aria-label="Reactions"]`, `.lr-overlay` with the sender name, `[data-scene^="N:"]`, `[data-realtime="connected"]`, `a[aria-label="Back to the team"]`, `header img[data-presence-id][alt]`, "This board was deleted.".

**New tests:** `[P18e-07-02]` header: back link, title, presence count, facilitation tools, Share opens the dialog with the guest link; `[P18e-07-06]` the title is renamed in place and the new name reaches the other browser; a guest has no field; "Export" opens the export dialog; `[P18e-07-04]` the reaction bar does not overlap Excalidraw's scroll-back button at 1440 and 390; one `[data-realtime]` (Review Focus 2). Vitest: `board-timer` is covered by 0.5; `presence-slot` hash; participant mapping.

**Run:** browser `Plan17aWhiteboardCoreTest.php`, `Plan17cWhiteboardFacilitationTest.php`, `Plan17dWhiteboardSecrecyTest.php`, `Smoke/WhiteboardHarnessTest.php`, `Plan18eWhiteboardTest.php`.

**Commit:** `feat(whiteboard): board chrome on the session frame`

### Task 7.3: Board menu and dialogs

**Read first:** brief 07 §3 rows 17–29, §4.2.

**Files:** rewrite `components/whiteboard/board-menu.tsx`; create `board-dialogs.tsx`; delete `hand-over-dialog.tsx`, `save-template-dialog.tsx`.

**Interfaces — consumes:** `FormDialog` (rename, save as template, hand over; with no candidate the hand-over dialog uses the no-submit state of 0.11 and shows "No one else can facilitate this board yet."), `ConfirmDialog` (delete).

**Browser tests changed:** none. Checked: `[aria-label="Board menu"]`, `[role="menuitemcheckbox"]:has-text("Hide my cursor")`, "Rename", "Take control", `#whiteboard-new-facilitator`, `[role="dialog"] button:text-is("Hand over")`, `[role="dialog"] button:text-is("Cancel")` (`P17c-05b`), "Duplicate this board", `[role="dialog"] input[maxlength="80"]`, `[maxlength="300"]`, "A template with this name already exists.", `[role="dialog"] button:text-is("Delete this board")`. The menu has no guest-link entry any more (7-D2; the tests moved in 7.2).

**Run:** browser `Plan17bWhiteboardTemplatesTest.php`, `Plan17cWhiteboardFacilitationTest.php`.

**Commit:** `feat(whiteboard): board menu and dialogs on the new primitives`

### Task 7.4: Eight-colour sticky notes and colour bar

**Places left (feature roadmap):** the author of a sticky (WB-4) and "Convert to actions" on a selection (WB-5).

**Read first:** brief 07 §3 rows 8–9, 54, §4.3, risk R7; the answers 7-D1, 7-D3, 7-D4; `ExcalidrawTheme/README.md` (the colour bar and the rule `skrum-whiteboard--fallback-colors` that hides Excalidraw's native quick picks).

**Files:** rewrite `components/whiteboard/sticky-tool.tsx`; create `components/whiteboard/canvas-colors.tsx` (the colour bar shown for every tool and every selection that has a fill, 7-D3); modify `board.tsx` (`initialData.appState`; the class `skrum-whiteboard--fallback-colors` on the canvas wrapper, which hides the native quick picks and keeps the "more colours" picker), `scene-export.tsx` (restyle), `lib/whiteboard/excalidraw.ts` (dead exports removed), `tests/Browser/Support/InteractsWithWhiteboards.php` (`addWhiteboardSticky`).

**Interfaces — consumes:** `WhiteboardColorBar` (radiogroup "Fill colour", radios Sun … Moss), `POSTIT`, `postItAppState`, `CANVAS_LIGHT` (`lib/whiteboard/palette.ts`).

**Browser tests changed** (imposed by `ExcalidrawTheme/README.md` palette and `WhiteboardToolbar/README.md` colour bar): helper `addWhiteboardSticky` and its call sites in `Plan17a` (:89, :114, :116, :317, :447, :556, :560, :589), `Plan17c` (:213, :238, :262), `Plan17d` (:15): colour names Yellow → Sun, Blue → Sky, Green → Moss; the control is `button[aria-label="Sticky note"]` then `[role="radiogroup"][aria-label="Fill colour"] [role="radio"][aria-label="<Name>"]`. `P17a-02a` (:101) and `P17a-11` (:569): `'#fff3bf'` → `'#fdf1c2'`, and the stroke `#ddc362` (7-D4). Fixture colours written by the server (`Plan17a:231`, `Plan17c:439`, `Plan17b:92`) are unchanged.

**New tests:** `[P18e-07-05]` captures as a member, as a guest on a locked board, and of the join page; `[P18e-07-07]` the colour bar recolours a selected rectangle and a selected sticky; the native quick picks are not in the DOM's visible tree and the "more colours" picker still opens; a note of a board made from a built-in template shows its swatch selected (7.0).

**Run:** the four `Plan17*` files, `Smoke/WhiteboardHarnessTest.php`, `Visual/WhiteboardVisualTest.php`.

**Commit:** `feat(whiteboard): eight-colour sticky notes and colour bar`

### Task 7.5: Read mode on a phone

**Read first:** the answer 7-D7; spec §6.4 (whiteboard); ScreenWhiteboard README, the phone frame ("Lecture / Modifier"); brief 07 §6 (how `viewModeEnabled` is driven by the board lock today), `components/whiteboard/board.tsx`.

**Files:** create `components/whiteboard/use-read-mode.ts`, `read-mode-toggle.tsx` and their tests; modify `board.tsx` (`viewModeEnabled`, and the toggle in the canvas dock, where the MobileRituals mockup has it: below `md` the header has no room for a labelled button); extend `Plan18eWhiteboardTest.php`, `WhiteboardVisualTest.php`.

**Interfaces — produces:**

```ts
/** Read mode is on by default below `md`, off above. It is local state: not stored, not sent. */
export function useReadMode(isPhone: boolean): { reading: boolean; setReading: (reading: boolean) => void };

/** "Edit" while reading, "Read" while editing: the label names the action, so the button has no `aria-pressed`. Hidden when the viewer cannot edit anyway. */
export function ReadModeToggle(props: { reading: boolean; onChange: (reading: boolean) => void }): ReactElement;
```

The mode itself is announced by a polite region that stays mounted over the canvas (`span[role="status"]`: the visible "Reading" pill while reading, "Editing" for assistive technology otherwise).

`viewModeEnabled = lockedForViewer || reading`: the lock keeps the last word, so the toggle never lets a non-facilitator edit a locked board, and it is not rendered for such a viewer. Above `md` the toggle is not rendered and `reading` is false. In French the button reads "Modifier" / "Lire" (lang files).

**Browser tests changed:** none (the suite runs at desktop width, where nothing changes).

**New tests:** `[P18e-07-08]` at 390 the board opens in read mode: no tool is offered, pan and zoom work, "Edit" brings the tools and the sticky tool adds a note, "Read" goes back; at 1440 there is no toggle; on a locked board a guest at 390 has no toggle and cannot edit; a guest at 390 who pressed "Edit" loses the tools and the toggle when the lock arrives live. Vitest: `useReadMode` defaults and the combination with the lock.

**Run:** browser `Plan18eWhiteboardTest.php`, `Plan17cWhiteboardFacilitationTest.php` (the lock), `Visual/WhiteboardVisualTest.php`; group gate; G-visual-7.

**Commit:** `feat(whiteboard): read mode on a phone`

## Lane K — Group 9, workspace (needs R1)

Brief: `18e-briefs/09-workspace.md`. Five tasks; 9.0a and 9.0b are back-end tasks. What the owner changed in this lane: "Use" and the Poker / Whiteboard tabs (9-D1), workspace-level decks in the Poker tab (third round), the built-in templates on the page (9-D2), the confirmation before revoking an invitation (9-D5), the component's deletion sentence (9-D7). What rule 13 added: M22, M23, M24.

### Task 9.0a: Counts, roles and members of the workspace page and switcher (B42) — back end

**Read first:** spec §9.3 B42, criterion 41; `app/Http/Controllers/WorkspacesController.php` (`show`), `app/Http/Middleware/HandleInertiaRequests.php:63-75` (`workspaces`), `app/Models/Workspace.php` (`teamsVisibleTo`, `members`), `app/Models/User.php` (`roleIn`, `canManage`), `app/Enums/WorkspaceRole.php`, `tests/Feature/Workspaces/WorkspacesTest.php`, `tests/Feature/SharedPropsTest.php`.

**Files:** modify `WorkspacesController.php`, `HandleInertiaRequests.php`, `resources/js/types/workspaces.ts`, the shared-props type; tests in `WorkspacesTest.php`, `SharedPropsTest.php`.

**Interfaces — produces:** on `workspaces/show`: `membersCount`, `adminsCount` (members whose role may manage the workspace), and on each of `teams`: `membersCount`, `members` (the first five by name: `name`, `avatarUrl`). On each entry of the shared `workspaces`: `teamsCount` (teams visible to the user) and `role` (the role's value). One `withCount` and one eager load on the page; one query for the shared prop, whatever the number of workspaces.

**Feature tests (written first):** the counts of a workspace with two teams, four members and two admins; a team's five first members and its total of seven; a team the user cannot see is absent from `teams` and from `teamsCount`; the shared `workspaces` carries the role of the user in each; the shared prop adds a constant number of queries for one and for five workspaces; a guest (no user) still gets `workspaces = []`.

**Consumed by:** 9a. **Run:** `vendor/bin/sail artisan test --compact tests/Feature/Workspaces tests/Feature/SharedPropsTest.php`. **Commit:** `feat(workspaces): member and team counts, roles and member stacks (B42)`

### Task 9.0b: Data of the templates page — whiteboard templates, workspace decks, authors (B30) — back end

**Read first:** spec §9.2 B30 ("Templates page"), criterion 27; `app/Http/Controllers/WorkspaceTemplatesController.php` (`index`, `present`), `app/Actions/Whiteboards/BuildWhiteboardGallery.php` (how a workspace whiteboard template is presented with its preview), `app/Policies/WhiteboardTemplatePolicy.php`, `PokerDeckPolicy.php`, `TeamsController::pokerDecks()` (the shape of a saved deck and its `canManage`), `tests/Feature/Workspaces/WorkspaceTemplatesTest.php`.

**Files:** modify `WorkspaceTemplatesController.php` (`whiteboardTemplates`, `pokerDecks`, `author` in `present()` with `->with('creator')` — confirm the relation name on `WorkspaceTemplate`), `resources/js/types/workspaces.ts`; tests in `WorkspaceTemplatesTest.php`.

**Interfaces — produces:** `whiteboardTemplates` (`id`, `name`, `description`, `preview`, `canManage`), `pokerDecks` (`id`, `name`, `cards`, `usageCount`, `canManage`: the workspace's decks of 1.0e, by name; `usageCount` counts the games of the teams the user can view), `canCreatePokerDeck` (the `createForWorkspace` ability), and `author` (`?string`) on each entry of `templates`. The built-in retro templates come from the `catalogue` prop the page already has.

**Feature tests (written first):** the whiteboard templates of the workspace with their preview and `canManage` for the creator and for a workspace admin; the workspace's decks in name order, **no team deck and no deck of another workspace**; `canManage` and `canCreatePokerDeck` true for a workspace manager only; `usageCount` ignores the games of a team the user cannot view; `author` is the creator's name and `null` when the creator's account is gone; the page stays reachable for whoever reaches it today.

**Consumed by:** 9c. **Run:** `vendor/bin/sail artisan test --compact tests/Feature/Workspaces/WorkspaceTemplatesTest.php`. **Commit:** `feat(workspaces): whiteboard templates, saved decks and authors on the templates page (B30)`

### Task 9a: Workspace page and workspace creation

**Places left (feature roadmap):** on a team tile, the description line and the three activity lines (WS-1, TM-4).

**Read first:** brief 09 §3 rows 1–10, §4; R4, R7.

**Files:** create in `resources/js/components/workspaces/`: `workspace-overview.tsx`, `team-tile.tsx`, `new-team-dialog.tsx`, `leave-workspace-dialog.tsx`, `create-workspace-form.tsx`, `use-router-action.ts` and their tests; rewrite `pages/workspaces/show.tsx`, `create.tsx` (`AppLayout active="teams"`); add both to `page-layouts.ts`; `pages/dev/sections/workspace.tsx`; `tests/Browser/Walkthroughs/Plan18eWorkspaceTest.php`, `tests/Browser/Visual/WorkspacePagesVisualTest.php`.

**Interfaces — produces:** `useRouterAction(): { run(visit: (options) => void): Promise<void>; error?: string }` (resolves on `onSuccess`, rejects on `onError`); `LeaveWorkspaceDialog({ open, onOpenChange, workspace })` (used again in 9b).

**Mockup elements added by rule 13 (M22, M23), from the props of 9.0a:** the header reads "n teams · n members" and the viewer's role; each team tile shows its member stack and count; the Leave zone says "You are one of n admins" when the viewer is an admin; the workspace switcher of the sidebar (`components/skrum/app-sidebar` through `use-sidebar-model.ts`) shows the team count and the role of each workspace. Team description and activity lines are not built (D-24).

**Browser tests changed:** none (no browser test covers these two pages).

**New tests:** `[P18e-09-08]` the header counts, a tile's member stack and the switcher's "2 teams · Admin" match the database; `[P18e-09-01]` a manager creates a team from the dialog and reaches the members page through "Invite people"; `[P18e-09-02]` leaving needs the typed name; the last owner sees "A workspace needs at least one owner."; `[P18e-09-03]` **a user with no workspace creates one from `workspaces/create`; the sidebar renders without a team** (Review Focus 5).

**Commit:** `feat(workspaces): workspace page and workspace creation`

### Task 9b: Members, roles and invitations

**Places left (feature roadmap):** the message field of the invite form (IN-2); team invitations (IN-1).

**Read first:** brief 09 §3 rows 11–20.

**Files:** create `members-table.tsx`, `invite-form.tsx`, `invitations-table.tsx`, `delete-workspace-section.tsx`; rewrite `pages/workspaces/members.tsx`; add to `page-layouts.ts`.

Revoking an invitation asks for confirmation (9-D5): `ConfirmDialog`, "Revoke the invitation of :email?", destructive.

**Browser tests changed:** none. **New:** `[P18e-09-04]` role change, removal with confirmation, last-owner error, an admin sees no select on an owner; `[P18e-09-05]` invite, link shown when mail is not configured, Resend, Revoke with its confirmation (Cancel keeps the invitation), "Expired"; `[P18e-09-06]` the owner deletes the workspace with the typed name.

**Run:** `vendor/bin/sail artisan test --compact tests/Feature/Workspaces`; `Plan18eWorkspaceTest.php`.

**Commit:** `feat(workspaces): members, roles and invitations`

### Task 9c: Templates page — full picker, "Use", Poker and Whiteboard tabs

**Places left (feature roadmap):** on a template card, "used n×" and the visibility badge (WS-2).

**Read first:** brief 09 §3 rows 21–38; R3, R5; ScreenWorkspace, templates frames: tabs with counts, search, "New template", retro template cards (column preview, author, "Use"), poker cards (deck preview, "Use"), the whiteboard empty state; the answers 9-D1, 9-D2, 9-D7; spec §9.2 B30.

**Files:** create `components/workspaces/templates-page.tsx`, `retro-templates-tab.tsx`, `poker-decks-tab.tsx`, `whiteboard-templates-tab.tsx`, `template-editor-sheet.tsx`, `lib/workspaces/use-template.ts` and their tests; rewrite `pages/workspaces/templates.tsx`; add to `page-layouts.ts`; modify `lang/{en,fr,es,de}.json` (the sentence of 9-D7).

**Interfaces:**
- Consumes: `RetroTemplatePicker` (the full picker: search, categories, tabs Built-in / My workspace, detail with the mini-board; `onUse`, `onDuplicate`), `TemplateEditor` (`ids` defaults `template-name`, `template-source`, `template-category`; `colors` = the eight colours of R1; `startFrom`, `onStartFrom`, `onDuplicate`, `onDelete`), `columnColorClass`, `DeckPicker` cards (read-only), the preview renderer of 1.3 (`whiteboard-template-preview.tsx`, mounted, not edited), `Tabs`; props `catalogue`, `templates` with `author`, `whiteboardTemplates`, `pokerDecks` (9.0b); the shared `currentTeam`.
- Produces: `useTemplateHref(kind, key, team): string | null` in `lib/workspaces/use-template.ts` — the URL of `teams.show` of the current team with `?new=retro&template=<key>`, `?new=whiteboard&template=workspace:<id>` or `?new=poker&deck=<id>`, read on the other side by `useNewSessionIntent` (1.1); `null` without a team.

**Composition:**
- Tabs "Retro · n", "Poker · n", "Whiteboard · n" (the mockup's "All" tab lists the three kinds one under the other).
- Retro (9-D2): the full picker. A built-in template is read-only, with "Use" and "Duplicate" (which opens the editor prefilled, saved through the existing `workspaces.templates.store`). A workspace template shows its author, "Use", and, for a manager, Edit and "Delete template".
- Poker: the workspace's decks (1.0e), each with its value preview, its usage and "Use" (the current team); a workspace manager has "Create a deck", "Edit :name" and "Delete :name" here, through `workspaces.pokerDecks.*` and `DeckEditor`, the deletion confirmed in a dialog. The mockup's per-template timer and auto-reveal settings are not built (D-24).
- Whiteboard: the workspace's whiteboard templates with their preview, "Use", and, when `canManage`, rename and delete through the existing `workspaces.whiteboardTemplates.update` / `.destroy`, the deletion confirmed in a dialog; the mockup's empty state when there is none.
- "Use" is a link built by `useTemplateHref`; it is disabled, with the hint "Pick a team first", when the user has no current team.
- Deleting a retro template says the component's sentence, "Retros already created from it are not affected." (9-D7): the component is not modified; the sentence is translated in `fr`, `es` and `de`, and the old key "Retrospectives created from it keep their columns." is removed from the four files once `grep -rn` finds no other use.

**Browser tests changed** (imposed by `TemplateEditor/README.md`, ScreenWorkspace frame c, and the answers 9-D2, 9-D7): `Plan08aFlowAndTemplatesTest.php` `P08a-07a`: `li:has-text("Team pulse")` → the picker's radio of that template on the tab "My workspace" (`[role="radio"]:has-text("Team pulse")`); `P08a-07b`: `[aria-label="Column title"]` → "Column 1 title" …, "Move down" → keyboard reorder on the handle (Space, ArrowDown, Space), `[aria-label="Remove column"]` and `fieldset > div:nth-of-type(n)` → "Delete column “…”", "Add column" → "Add a column"; `P08a-07d`: Edit → "Delete template" → `[role="alertdialog"]` → confirm, and line 418: `'Retrospectives created from it keep their columns.'` → `'Retros already created from it are not affected.'`, read in `[role="alertdialog"]`. Unchanged: `#template-name`, `#template-source`, `#template-category`, `[role="dialog"] button[type="submit"]`, "Template saved.", "Template deleted.", "No workspace templates yet.", "New template".

**New tests:** `[P18e-09-07]` duplicate, edit, delete a workspace template; `[P18e-09-09]` a built-in template has "Use" and "Duplicate" and no Edit or Delete; "Use" lands on the team page with the "New session" dialog open on that template; `[P18e-09-10]` the Poker tab lists the workspace's decks; a manager creates, edits and deletes one, a member sees no such control; "Use" opens the dialog of the current team with the deck selected; `[P18e-09-11]` the Whiteboard tab: preview, "Use", rename, delete with confirmation, and the empty state; `[P18e-09-12]` without a current team "Use" is disabled with its hint. Vitest: `useTemplateHref` for the three kinds and without a team.

**Run:** `tests/Feature/Workspaces/WorkspaceTemplatesTest.php`, `tests/Feature/TranslationKeysTest.php`; browser `Plan08aFlowAndTemplatesTest.php`, `Plan18eWorkspaceTest.php`, `Visual/WorkspacePagesVisualTest.php`; group gate; G-visual-9.

**Commit:** `feat(workspaces): templates page with the full picker, Use, and the poker and whiteboard tabs`

## Lane A — Group 11, access

Brief: `18e-briefs/11-access.md`. Eight tasks; 11.5a and 11.6 are back-end tasks. What the owner changed in this lane: SSO on the invitation page (11-D2), the request id of the 500 page (11-D3), the static 503 page and the 419 and 429 pages (11-D7, 11-D10). What rule 13 added: M27. Its commit 6 (join pages, session-ended) is done in R2, 3.2, G2 and 7.1. Each page renders `AuthLayout` (`@/layouts/skrum/auth-layout`) itself; the old `layouts/auth-layout.tsx` goes in F1.

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

**Places left (feature roadmap):** the magic-link button and the phone's tab strip (plan 18f, B12).

**Read first:** brief 11 §3 rows 1–14.

**Files:** create `login-form.tsx`, `register-form.tsx`; rewrite `pages/auth/login.tsx`, `register.tsx`; add to `page-layouts.ts`; delete `components/sso-buttons.tsx`; `tests/Browser/Walkthroughs/Plan18eAccessTest.php`, `tests/Browser/Visual/AccessPagesVisualTest.php`.

**Browser tests changed:** none. Checked (every walkthrough signs in through them): `#email`, `#password`, `@login-button`, name "Log in", `assertPathIsNot('/login')`; `#name`, `#password_confirmation`, `@register-user-button`.

**Deviations of this screen** (rows D-28, D-29): the checkbox reads "Remember me" (the mockup's "30 days" is false, 11-D5); no magic-link button or tab (plan 18f builds B12 and fills their place: the form footer and the phone's tab strip are plain containers); no "Free up to 10 participants", terms sentence, "Privacy · Terms" or version; on a rebranded instance the aside shows the brand logo only (11-D4).

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

### Task 11.5a: Invitation page data — SSO providers, inviter, role, expiry, members (B31, B44) — back end

**Read first:** spec §9.2 B31 ("Ownership"), §9.3 B44, criteria 28 and 43; `app/Http/Controllers/InvitationLinksController.php`, `SsoCallbacksController.php`, `app/Actions/Auth/ResolveSsoUser.php`, `SignupGate.php`, `app/Enums/SsoProvider.php` (`options()`), `app/Models/WorkspaceInvitation.php` (`role`, `invited_by_id`, `expires_at`, `isPending`), `app/Providers/FortifyServiceProvider.php:58,83` (how the login page gets `ssoProviders`), `tests/Feature/Auth/SsoLoginTest.php` (how Socialite is faked), `ResolveSsoUserTest.php`, `InvitationRegistrationTest.php`.

**This task adds props and tests. It does not change `ResolveSsoUser`, `SsoCallbacksController` or `SignupGate`.** If a pinning test below fails, the behaviour of the sign-in code is not what the spec describes: stop and report. The owner decided one change to that code — an SSO address the provider does not mark verified is refused even with a matching invitation — and gave it to plan 18f, under its security rules. This task therefore writes no test on the unverified case, in either direction: a test that pins today's behaviour would have to be deleted by 18f, and a test of the new rule would fail until 18f.

**Files:** modify `InvitationLinksController.php`, the props type of `invitations/show`; create `tests/Feature/Auth/InvitationPagePropsTest.php`, `InvitationSsoTest.php`.

**Interfaces — produces**, in the valid branch of `show` only:

```php
'ssoProviders' => $user === null && $invitation->isPending() ? SsoProvider::options() : [],
'inviter' => $inviter === null ? null : ['name' => $inviter->name, 'avatarUrl' => $inviter->avatarUrl()],
'role' => $invitation->role->value,            // 'owner' | 'admin' | 'member'; the page translates it
'expiresAt' => $invitation->expires_at->toIso8601String(),
'membersCount' => $invitation->workspace->members()->count(),
'members' => /* the first five by name: name, avatarUrl */,
```

The invalid branch (`isInvalid: true`, 404) sends none of them. An expired invitation sends `inviter` and `expiresAt` (the page says who to ask) and an empty `ssoProviders`, and no `members`.

**Feature tests (written first):** props — a logged-out visitor of a pending invitation gets one entry per enabled provider; a signed-in visitor, an expired invitation and an invalid token get none; the inviter's name and avatar, `null` when the inviter's account was deleted; the role value, the expiry, the member count and five members; **an invalid token gets none of the new props, and no prop ever carries an e-mail other than the invited one** (Review Focus 7). SSO flow, pinned — a new person who signs in through SSO with the invited, verified address gets an account, belongs to the workspace, and the session's `invitation_token` is cleared; with another address the invitation stays pending, and in `invite` sign-up mode the sign-in is refused with the existing message; an existing verified account that signs in through SSO is not auto-accepted, lands back on the invitation page (the intended URL) and accepts with `invitations.acceptance.store`; a user with a confirmed second factor is sent to the challenge and joins nothing before passing it. Not pinned here: the unverified address (plan 18f).

**Consumed by:** 11.5. **Run:** `vendor/bin/sail artisan test --compact tests/Feature/Auth`. **Commit:** `feat(invitations): SSO providers, inviter, role, expiry and members on the invitation page (B31, B44)`

### Task 11.5: Accept-invitation card

**Places left (feature roadmap):** the inviter's message under the sentence (IN-2); "Decline" beside the main action (IN-3); the team's name and colour (IN-1).

**Read first:** brief 11 §3 rows 26–31; ScreenOnboarding, accept-invitation frame and its variants (signed in, expired). **Files:** `invitation-card.tsx`, `pages/invitations/show.tsx` rewritten (`AuthLayout variant="centered"`), `page-layouts.ts`.

**Interfaces — consumes:** `AccessNotice` (invalid, expired), the five states of the brief; `SsoButtons` (11.1) with `ssoProviders`; `inviter`, `role`, `expiresAt`, `membersCount`, `members` (11.5a). The session `invitation_token` flow is server-side and untouched.

**Composition:** the mockup's card — the inviter's avatar and "Ada invited you to join :workspace", the role sentence, the member stack and count, the locked e-mail; logged out: the SSO buttons (11-D2), then "Create an account" (when `canRegister`) and "Log in"; signed in with the invited address: "Join :workspace"; signed in with another address: "Log out" to switch account; expired: the notice with the inviter's name and the expiry date. Not built: team name and colour, the inviter's message, "Decline" (D-30).

**Browser tests changed:** none. **New:** `[P18e-11-05]` logged out: Log in and Create an account; matching account accepts; another account sees Log out; expired and invalid notices; `[P18e-11-08]` the card shows the inviter, the role and the members; with a provider enabled (config set in the test) a button "Continue with :provider" links to `auth/{provider}/redirect`, and none shows when signed in or expired.

**Commit:** `feat(invitations): accept-invitation card`

### Task 11.6: Request id per request (B36) — back end

**Read first:** spec §9.2 B36, criterion 33; `bootstrap/app.php` (`withMiddleware`), `app/Http/Middleware/TrustProxies.php` (a sibling global middleware), Laravel's `Illuminate\Support\Facades\Context` (search the docs: "context", "log context"), `tests/Feature/RequestIsolationTest.php`.

**Files:** create `app/Http/Middleware/AssignRequestId.php`, `tests/Feature/RequestIdTest.php`; modify `bootstrap/app.php` (`$middleware->prepend(AssignRequestId::class);`).

```php
class AssignRequestId
{
    public const Header = 'X-Request-Id';

    public const ContextKey = 'request_id';

    public function handle(Request $request, Closure $next): Response
    {
        $requestId = (string) Str::uuid();

        Context::add(self::ContextKey, $requestId);

        $response = $next($request);

        $response->headers->set(self::Header, $requestId);

        return $response;
    }
}
```

**Feature tests (written first):** every response carries `X-Request-Id` in UUID form; two requests get two ids; an inbound `X-Request-Id` is ignored; `Context::get('request_id')` inside a route equals the header of its response; a log entry written during the request carries the id (assert with `Log::spy()` or the context of a `Log::listen` callback — follow the documentation found); a JSON error response keeps its body and gains the header; the id of one request is not visible in the next (`RequestIsolationTest` pattern).

**Consumed by:** 11.7. **Run:** `vendor/bin/sail artisan test --parallel --processes=8 --compact`. **Commit:** `feat(errors): a request id per request, in the log context and the response (B36)`

### Task 11.7: Error pages — 403, 404, 419, 429, 500 and the static 503 (B15)

**Places left (feature roadmap):** the header links "Instance status" (AD-3) and the version in the footer (AD-2); the access-request form of the 403 page (AD-4); the "Back at" block and the admin's message of the 503 page (AD-5).

**Read first:** brief 11 §7, §9 (first two risks); spec §9 B15 and B36, criterion 34; ScreenErrors README and preview (404, 403, 500 with "Copy error ID" and "Try again", 503 with "Retry now"); the answers 11-D3, 11-D7, 11-D10; Inertia v3's error handling (search the docs: "error pages", `handleExceptionsUsing`).

**Files:** modify `bootstrap/app.php` (`Inertia::handleExceptionsUsing` or the `respond` hook the docs give for v3); create `resources/js/pages/errors/error.tsx`, `resources/js/components/auth/error-page.tsx` and its test, `resources/views/errors/503.blade.php`, `tests/Feature/ErrorPagesTest.php`; add `errors/error` to `page-layouts.ts`.

**Interfaces:** the page `errors/error` receives `status` (403, 404, 419, 429, 500), `requestId` (500 only, from `Context::get(AssignRequestId::ContextKey)`) and `retryAfter` (429, seconds from the `Retry-After` header when present). Actions per status: 404 and 403 — "Back to my teams" (a guest: "Log in"); 419 — "Reload"; 429 — "Try again" and "You can retry in :seconds seconds." when known; 500 — "Try again" and "Copy error ID" with the id shown in a `code` element. The 503 view is plain Blade: a complete HTML document with inline `<style>` (the token values of the light theme and a `prefers-color-scheme: dark` block, copied from `docs/design-system/tokens.json`; hex is allowed here, the file is not under the token rule's greps because it cannot load `app.css` — say so in a Blade comment), the Skrüm logo inline as SVG, the title, one sentence, and a "Retry now" link to the current URL; no `@vite`, no script, no `config()` call that needs the database, no `__()` beyond the default translator. It is the view Laravel renders for `php artisan down` and for any `abort(503)`.

**Feature tests (written first):** an HTML request to an unknown URL renders `errors/error` with status 404, for a guest and for a signed-in user; closed registration renders the 403 page; a POST with a stale CSRF token renders the 419 page; a throttled HTML request renders the 429 page with `retryAfter`; **a JSON request (`Accept: application/json`) to a live endpoint that answers 403, 404, 410, 419 or 429 keeps its JSON body and status**; an `X-Inertia` request gets the page; in debug mode a 500 is not intercepted; **the 500 page renders when the shared props cannot be built** (bind a failing `CurrentTeamResolver` and assert the response is the error page with status 500, in English) and its `requestId` equals the response's `X-Request-Id`; the other statuses carry no `requestId`; **`abort(503)` renders the static view with status 503 while the database connection is broken** (point the connection at a closed port for the test) and the body holds no `<script`; `php artisan down` then a GET renders the same view (Review Focus 3).

**Browser tests changed** (found by the review of Group 10): `[P11b-17]` of `Plan11bApiTokensTest.php` read the framework's "Not Found" after opening `/settings/api-tokens` with MCP off; it reads "ERROR 404" in `[data-slot="error-page"][data-status="404"]`, the 404 page of this task. **New:** `[P18e-11-07]` an unknown URL shows "Error 404" and its action; a guest's action is "Log in"; `[P18e-11-09]` the 500 page (a test-only route that throws, registered in the test's environment) shows an id and "Copy error ID" copies it.

**Deviations of this screen** (row D-31): no "Instance status" or "Help" link, no access request on the 403 page, no "Back at" block or admin message on the 503 page.

**Run:** `vendor/bin/sail artisan test --parallel --processes=8 --compact` (131 files assert 403 and 404: all must stay green); Pint; browser `Plan18eAccessTest.php`, `Visual/AccessPagesVisualTest.php` (the 503 view is captured by visiting a test route that aborts with 503); group gate; G-visual-11.

**Commit:** `feat(errors): design-system error pages and the static 503 page (B15)`

## Lane X — Group 10, settings (10.2 needs 11.1 and 10.0)

Brief: `18e-briefs/10-settings.md`. Nine tasks; 10.0 is a back-end task. Shells mirror `components/admin/admin-shell.tsx`. What the owner changed in this lane: the inline token creation form (10-D2). What rule 13 added: M25 (security page data, strength meter), M26 (switches for the sync options, K24). Each page of the group is added to `page-layouts.ts` in its task (`settings/profile`, `settings/security`, `settings/appearance`, `settings/notifications`, `settings/api-tokens`, `teams/integrations`). Each task follows the screen task procedure.

### Task 10.0: Security page data — date of the second factor, recovery codes left (B43) — back end

**Read first:** spec §9.3 B43, criterion 42; `app/Http/Controllers/Settings/SecurityController.php` (`edit`: the `$props` it builds), `app/Models/User.php` (`two_factor_confirmed_at`, `two_factor_recovery_codes`; Fortify's `recoveryCodes()`), `tests/Feature/Settings` (the security tests).

**Files:** modify `SecurityController.php`, the props type of `settings/security`; create `tests/Feature/Settings/SecurityPagePropsTest.php`.

**Interfaces — produces:** `twoFactor: { confirmedAt: ?string, recoveryCodesRemaining: ?int, recoveryCodesTotal: int }` next to the props of today — `confirmedAt` from `two_factor_confirmed_at` (ISO 8601), `recoveryCodesRemaining` = `count($user->recoveryCodes())` when the second factor is confirmed and `null` otherwise, `recoveryCodesTotal` = the number Fortify generates (8; read it from the generator, do not write the digit).

**Feature tests (written first):** a user without a second factor gets `confirmedAt` null and `recoveryCodesRemaining` null; a user with a confirmed one gets its date and 8; after one code is used, 7; **the page's props never contain a recovery code or the secret** (assert the serialised props do not contain any of the user's codes).

**Consumed by:** 10.2. **Run:** `vendor/bin/sail artisan test --compact tests/Feature/Settings`. **Commit:** `feat(settings): second-factor date and recovery codes left on the security page (B43)`

### Task 10.1: Settings shell and profile

**Places left (feature roadmap):** in the profile card, the photo block (AC-1) and the presence colours (AC-4).

**Read first:** brief 10 §3.1 rows 1–9, §4 (shells); ScreenUserSettings: sticky sub-navigation (Profile, Security, Appearance, Notifications, API tokens), stacked cards, the destructive "Delete account" card (10-D1).

**Files:**
- Create: `resources/js/components/settings/settings-shell.tsx`, `settings-card.tsx`, `profile-card.tsx`, `delete-account-card.tsx` and their tests; `tests/Browser/Visual/SettingsPagesVisualTest.php` (started here, extended by each task of the lane)
- Rewrite: `resources/js/pages/settings/profile.tsx` (keeps `AvatarStyleCard`); add `settings/profile` to `page-layouts.ts`
- Delete: `components/delete-user.tsx` (`layouts/settings/layout.tsx` is imported by `app.tsx` until F1)

**Interfaces — produces** (used by 10.2 to 10.4):

```ts
export function SettingsShell(props: { active: 'profile' | 'security' | 'appearance' | 'notifications' | 'apiTokens'; children: ReactNode }): ReactElement; // AppLayout + the sub-navigation `nav[aria-label="Settings"]`; on a phone the shared horizontal list (10-D5)
export function SettingsCard(props: { title: string; description?: string; footer?: ReactNode; tone?: 'default' | 'destructive'; children: ReactNode }): ReactElement;
```

Consumes `PasswordField` (11.1) in the delete-account confirmation.

**Browser tests changed:** none. Checked: `#name`, `#email`, `@update-profile-button`, `@delete-user-button`, `@confirm-delete-user-button`, `[data-slot="avatar-style-card"]` (`P18d-06`), `nav[aria-label="Settings"]`.

**Deviations of this screen** (row D-25): the twelve presence colours, "Upload photo" and "Use initials".

**Run:** Vitest of the new files; `tests/Feature/Settings`; browser `Plan11bApiTokensTest.php`, `Plan18dBrandingTest.php`, `Visual/SettingsPagesVisualTest.php`.

**Commit:** `feat(settings): settings shell and profile`

### Task 10.2: Security — password, two-factor, passkeys

**Places left (feature roadmap):** under the passkeys card, the cards Active sessions and Linked accounts (AC-2, AC-3); the breach line of the password card (AC-6).

**Read first:** brief 10 §3 rows 10–27; ScreenSecurity: cards Password (show / hide, strength meter), 2FA (setup with QR and manual key, six-box code, recovery codes with Download and Copy, the "enabled" state with its dates), then Active sessions and Linked accounts (not built); the answer 10-D3 (inline steps, no Print).

**Files:**
- Create: `components/settings/security/{password-card,password-strength,two-factor-card,two-factor-setup,recovery-codes,passkeys-card}.tsx` and their tests
- Rewrite: `pages/settings/security.tsx`; add `settings/security` to `page-layouts.ts`
- Delete: `manage-two-factor.tsx`, `two-factor-setup-modal.tsx`, `two-factor-recovery-codes.tsx`, `manage-passkeys.tsx`, `passkey-item.tsx`, `passkey-register.tsx`, `alert-error.tsx`

**Interfaces — consumes:** `SettingsShell`, `SettingsCard` (10.1), `PasswordField` (11.1), `InputOTP`; the prop `twoFactor` (10.0). The two-factor setup is the mockup's inline steps inside the card (10-D3), not a modal: QR and manual key with Copy, the six-box code, then the recovery codes with Download .txt, Copy and the checkbox "I have saved my recovery codes" before "Finish". The enabled state shows "Added on :date" and ":left of :total recovery codes left" (M25). The strength meter (M25) is `password-strength.tsx`: a client-side estimate over length and character classes, and the rule line under it states the server's real rule, built from the `passwordRules` prop the page already receives (`Password::defaults()->toPasswordRulesString()`), not the mockup's "12 characters / not found in leaks" (deviation D-28's reason applies: it would be false).

**Browser tests changed:** none. Checked: `#current_password`, `#password`, `#password_confirmation`, `@update-password-button`.

**Deviations of this screen** (rows D-25, D-26): breach check and "last changed", "Change device", "last used", active sessions, linked accounts, the Print button.

**New tests:** `[P18e-10-02]` the setup runs inline to "Finish" and the card then shows the date and "8 of 8 recovery codes left"; Vitest for the meter's three levels.

**Run:** Vitest; `tests/Feature/Settings`; browser `Plan18eSettingsTest.php` (created here), `Visual/SettingsPagesVisualTest.php`.

**Commit:** `feat(settings): security (password, two-factor, passkeys)`

### Task 10.3: Appearance and notifications

**Places left (feature roadmap):** "Reduce animations" in the appearance card (AC-5); the "Accessibility" card of `single_key_shortcuts` (plan 18f, B35); the notification rows of plan 18f (`recap_emails`) and of MN-1.

**Read first:** brief 10 §3 rows 28–34; ScreenUserSettings: theme radio cards System / Light / Dark, language, the notification table with In-app and Email switches per event; the answer 10-D6 (explicit Save).

**Files:**
- Create: `settings/appearance/{theme-picker,language-field}.tsx`, `settings/notifications-card.tsx` and their tests
- Rewrite: `pages/settings/appearance.tsx`, `pages/settings/notifications.tsx`; add both to `page-layouts.ts`
- Delete: `appearance-tabs.tsx`

**Interfaces — consumes:** `SettingsShell`, `SettingsCard`, `RadioGroupCardItem`, `Switch`. The notifications card is the mockup's table with the one event that exists, "Action item reminders", and its two switches; it is written so that plan 18f adds the row "Retro recap" (`recap_emails`, B34) without restructuring: rows come from a list.

**Browser tests changed:** none. Checked: `#action-item-reminders-by-email`, `#action-item-reminders-in-app`, "Save", name "Language".

**Deviations of this screen** (row D-25): "Reduce animations"; the five other notification events of the mockup.

**Run:** Vitest; `tests/Feature/Settings`; browser `Plan18eSettingsTest.php`, `Visual/SettingsPagesVisualTest.php`.

**Commit:** `feat(settings): appearance and notifications`

### Task 10.4: API tokens with the inline creation form

**Read first:** brief 10 §3 rows 35–52 (the rename `teamGroups` is done, 0.9); ScreenUserSettings, API tokens block: the token form in the page (name, expiration select, scope checkboxes), "Create token", the copy-once field, the tokens table with Revoke; the answer 10-D2.

**Files:**
- Create: `settings/api-tokens/{server-url,create-token-form,new-token-panel,tokens-table,token-cards,revoke-token-dialog}.tsx` and their tests
- Rewrite: `pages/settings/api-tokens.tsx`; add `settings/api-tokens` to `page-layouts.ts`
- Delete: the three old token dialogs

**Interfaces — consumes:** `SettingsShell`, `SettingsCard`, `Table`, `ConfirmDialog` (revoke), the existing token routes. The creation form is inline, in a card above the table (10-D2); on success the copy-once panel replaces the form's footer until dismissed, and focus moves to the token field.

**Browser tests changed** (imposed by ScreenUserSettings and the answer 10-D2): the four creation tests of `Plan11bApiTokensTest.php` (`grep -n "Create token\|Generate token" tests/Browser/Walkthroughs/Plan11bApiTokensTest.php` gives the four call sites): the click that opened the creation dialog is removed; the `[role="dialog"]` scope of the form fields becomes the form of the page (`form[aria-label="New API token"]`); the submit is the form's "Create token". Unchanged and checked, the rest of the file: `#mcp-url`, `#token-name`, `#scope-*`, `#token-team`, `#token-expiration`, `input[aria-label="API token"]`, `tbody tr`, `td:nth-child(2) [data-slot="badge"]` count 3, eight columns in the same order. Added by the review of Group 10: the revoke test `[P11b-16]` clicks `[role="alertdialog"] button:has-text("Revoke")` in place of `[role="dialog"] …`, because the revoke confirmation is the `ConfirmDialog` this task names (an `alertdialog`); its title and sentence are unchanged.

**Deviations of this screen** (row D-25): the struck-through "revoked" rows (a revoked token is deleted).

**New tests:** `[P18e-10-04]` a token is created from the inline form, shown once, copied, and listed after "Done"; a validation error shows under its field without leaving the page.

**Run:** Vitest; `tests/Feature/Settings`; browser `Plan11bApiTokensTest.php`, `Plan18eSettingsTest.php`, `Visual/SettingsPagesVisualTest.php`.

**Commit:** `feat(settings): API tokens with the inline creation form`

### Task 10.5: Team settings shell, provider card, chat channels

**Places left (feature roadmap):** the other entries of the sub-navigation (WS-3): it takes its entries from a list.

**Read first:** brief 10 §3 rows 53–64; ScreenSettings frame a (tabs; integration cards with a switch and Configure / Connect); the answer 10-D4 (sub-navigation "Team" and "Integrations").

**Files:**
- Create: `components/integrations/team-settings-shell.tsx`, `provider-card.tsx` and their tests
- Rewrite in place: the Slack, Telegram and URL-channel components, their actions, the disconnect dialog
- Rewrite: `pages/teams/integrations.tsx`; add `teams/integrations` to `page-layouts.ts`
- Delete: `integration-card.tsx`, `integration-status-badge.tsx`, `integration-details.tsx`

**Interfaces — produces** (used by 10.6 and 10.7): `TeamSettingsShell({ workspace, team, active: 'team' | 'integrations', children })` — `AppLayout` and the sub-navigation "Team" (a link to the settings card of the team page, `#settings`) and "Integrations"; `ProviderCard({ provider, status, error?, details, actions, children })` whose first `Badge` is the status. `components/integrations/share/{delivery-lines,post-link-section}.tsx` keep their exports and accessible names (they are read by R3, R12, 3.1b, G3, 7.2).

**Browser tests changed:** none. Checked: `[data-test="integration-card-{provider}"]`, its first `[data-slot="badge"]` = the status, `[data-slot="card-title"]`, `a[href*="/connect"]`, "Connect Platform to the tools it already uses.".

**Deviations of this screen** (row D-27): the tabs "Members & rituals" and "Data & export" and what they hold.

**Run:** Vitest; `tests/Feature/Integrations`; browser `Plan12aIntegrationsFoundationTest.php`, `Plan14aTeamsMattermostTest.php`, `Plan14bOutgoingWebhooksTest.php`, `Plan15WebhookRedeliveryTest.php`.

**Commit:** `feat(integrations): team settings shell, provider card and chat channels`

### Task 10.6: Outgoing webhook and deliveries

**Read first:** brief 10 §3 rows 65–76.

**Files:** rewrite in place the five `webhook-*` files of `components/integrations/` (same exports).

**Interfaces — consumes:** `ProviderCard` (10.5), `Table`, `Tabs`, `Dialog`, `ConfirmDialog` (rotate secret, re-enable).

**Browser tests changed:** none. Checked: `[aria-label="Signing secret"]`, `[aria-label="Deliveries"]`, `#delivery-tab-request`, `#delivery-tab-response`, `#delivery-tabpanel` and their arrow-key roving, "Redeliver", "Rotate secret", "Re-enable".

**Run:** Vitest; `tests/Feature/Integrations`; browser `Plan14bOutgoingWebhooksTest.php`, `Plan15WebhookRedeliveryTest.php`.

**Commit:** `feat(integrations): outgoing webhook, deliveries and redelivery`

### Task 10.7: Trackers — Jira, Jira Data Center, Linear, GitHub

**Read first:** brief 10 §3 rows 77–88 and §8; ruling K24 as flipped.

**Files:** rewrite in place `jira-*`, `jira-data-center-*`, `jira-token-dialog`, `linear-integration`, `github-*`, `people-panel`, `account-picker-dialog`, `priorities-panel`, `status-sync-section`, `status-mapping-panel`, `story-points-field` (same exports).

**Interfaces — consumes:** `ProviderCard` (10.5), `Switch`, `Checkbox`, `Select`, `Table`, `FormDialog`. "Sync status" and "Treat canceled as done" are switches, as the mockup shows for an integration option (K24, M26); each keeps its `<label>` and its accessible name. "I understand" stays a `Checkbox` inside its `<label>`: it is an acknowledgement and no mockup shows it.

**Browser tests changed** (imposed by ScreenSettings, K24): `label:has-text("Sync status") button[role="checkbox"]` → `label:has-text("Sync status") button[role="switch"]`, and the same for "Treat canceled as done", in `Plan14dStatusSyncTest.php` (`grep -n 'role="checkbox"' tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php` lists them; `aria-checked` assertions hold for a switch). Unchanged and checked: "Turn on status sync", `[aria-label="Complete to"]`, `[aria-label="Reopen to"]`, `[aria-label="Story points field"]`, `[aria-label="Copy Webhook URL"]`, `label:has-text("I understand") button[role="checkbox"]`.

**Run:** Vitest; `tests/Feature/Integrations`; browser `Plan12dActionItemExportTest.php`, `Plan14cTrackersTest.php`, `Plan14dStatusSyncTest.php`.

**Commit:** `feat(integrations): trackers (Jira, Jira Data Center, Linear, GitHub) and their panels`

### Task 10.8: Walkthrough, captures and bench of the settings

**Read first:** brief 10 §8.

**Files:** complete `tests/Browser/Walkthroughs/Plan18eSettingsTest.php` (`[P18e-10-01]` … `[P18e-10-10]` as the brief lists, less the two written in 10.2 and 10.4; `-09` checks the sidebar team switcher on `/settings/api-tokens`), `tests/Browser/Visual/SettingsPagesVisualTest.php` (every page of the lane, the inline token form with an error, the two-factor steps, a provider card in each status), `resources/js/pages/dev/sections/settings-*.tsx`.

**Browser tests changed:** none.

**Run:** browser `Plan18eSettingsTest.php`, `Visual/SettingsPagesVisualTest.php`; then the group gate (`bin/test-browser`, PHP suite, Vitest) and G-visual-10.

**Commit:** `test(settings): browser walkthrough, visual captures, dev bench`

## Lane L — Group 12, the redirect of `/`

The owner chose the redirect (BLOCK-3, 12-D1): there is no landing page. Brief `12-landing.md` is kept for the record and is not built (deviation D-34).

### Task 12.1: `/` redirects; the welcome page goes (B32) — back end

**Read first:** spec §9.2 B32, criterion 29; `routes/web.php:21-23` (the `home` route), `resources/js/pages/welcome.tsx`, `resources/js/lib/page-layouts.ts` and its test (Task 0.2 lists `welcome`); the tests that use the route — `tests/Feature/ExampleTest.php:14` (requests it), `Settings/AccountDeletionTest.php:32`, `Settings/ProfileUpdateTest.php:76`, `Settings/ProfileAvatarStyleTest.php:152`, `Auth/VerificationNotificationTest.php:31`, `Auth/AuthenticationTest.php:74` (assert a redirect to it) — and `grep -rn "welcome" tests resources/js lang app` for what else names the page (`Branding/BrandInPageTest.php`, `DesignTokensTest.php`, `LightScopeTokensTest.php`, `TranslationKeysTest.php` are candidates: read each).

**Files:**
- Modify: `routes/web.php` — the route becomes

```php
Route::get('/', fn (Request $request) => $request->user() === null
    ? to_route('login')
    : to_route('dashboard'))->name('home');
```

  (the `SignupGate` and `Inertia` imports go if nothing else uses them)
- Delete: `resources/js/pages/welcome.tsx` and the starter assets only it imports
- Modify: `resources/js/lib/page-layouts.ts` and `page-layouts.test.ts` (remove `'welcome'` from the list and from the test's expectations), `lang/{en,fr,es,de}.json` (remove the keys only the page used, after `grep`)
- Create: `tests/Feature/HomeRedirectTest.php`; modify `tests/Feature/ExampleTest.php` and any test that rendered the page (it asserts the redirect, or moves to the login page when what it checked was the brand in a guest page)

**Feature tests (written first):** a guest's `GET /` redirects to `/login`; a signed-in user's to `/dashboard`, which then lands on the current team (4.0a) or its fallbacks; `route('home')` still resolves, and the five tests that assert a redirect to it stay green unchanged; no file `resources/js/pages/welcome.tsx` exists and `grep -rn "'welcome'" resources/js app routes` finds nothing.

**Browser tests changed:** none (no browser test visits `/`; confirm with `grep -rn "visit('/')" tests/Browser`).

**Run:** `vendor/bin/sail artisan test --parallel --processes=8 --compact`; `npm run test -- resources/js/lib/page-layouts.test.ts`; `npm run types:check`; `npm run build:front`; `php artisan wayfinder:generate`.

**Commit:** `feat(home): redirect / to the login page or the dashboard (B32)`

---

# Final tasks (after every lane is merged)

### Task F1: Shared deletions, the last old layouts, and the list for 18g

**Files:** every file of the row "Deleted only in F1" of the shared-files table; `resources/js/app.tsx`; `resources/js/lib/page-layouts.ts` and its test; create `docs/superpowers/research/front-rewrite/18e-report/old-components-for-18g.md`.

- [ ] **Step 1:** For each file of the list, `grep -rn "<import path>" resources/js` — delete it only when nothing imports it. A file that still has an importer is not deleted, and no importer is edited to make it deletable.
- [ ] **Step 2:** `page-layouts.test.ts` gains a last test, written first: every file under `resources/js/pages` (dev sections excluded) is in `ownLayoutPages` or matches a prefix. Run it; a missing page is a screen that was not rewritten: stop and report.
- [ ] **Step 3:** When that test passes, `app.tsx` becomes `layout: () => null`, the three old layout imports go, `page-layouts.ts` and its test are deleted, and so are `layouts/app-layout.tsx`, `layouts/app/`, `layouts/auth-layout.tsx`, `layouts/auth/`, `layouts/settings/`.
- [ ] **Step 4: The list for 18g.** The owner decided that an old view component still imported after this plan is rewritten in plan 18g, and that none remains at the end of 18g. Write `old-components-for-18g.md`: one row per file under `resources/js/components` (outside `ui/`, `skrum/` and `session/`) and `resources/js/layouts` that existed before this plan, was not rewritten or created by one of its tasks, and still exists — with its path, its importers (`grep -rn`), and what it renders. Build the candidates with `git diff --name-status <first commit of plan-18e-screens>~1 HEAD -- resources/js/components resources/js/layouts` (a file with no `A`, `M`, `D` or `R` line was not touched) and check each against the files this plan names as "rewritten in place" or "kept" (logic-only files such as `game-context.tsx`, `room-context.tsx`, `board-context.tsx`, `auto-reveal-triggers.tsx` are listed under "kept, not a view"). A file of Step 1 that could not be deleted is in the list with its importer. An empty list is stated as such.
- [ ] **Step 5:** `npm run check`, `npm run types:check`, `npm run test`, `npm run build:front`.
- [ ] **Step 6:** Commit: `chore(front): remove the old shared components and layouts left by the screen rewrite`.

What F1 leaves to 18g: every row of `old-components-for-18g.md` (rewritten there on the design system), unused dependencies, `knip`, starter files that were never part of a screen, `OnboardingLayout` (unused), the rename of `LocksDiscussingRetro`.

### Task F2: Full gates

- [ ] `npm run check`, `npm run types:check`, `npm run test`, `npm run build:front`.
- [ ] `vendor/bin/sail artisan test --parallel --processes=8 --compact` (feature and Arch suites); Rector dry run reports nothing; `vendor/bin/pint --dirty --format agent` changes no file.
- [ ] `bin/test-browser` — green, including the visual tests (overflow check on every capture).
- [ ] The greps of spec §13 criterion 5 over `resources/js` and `resources/views`: no `bg-(red|blue|gray|zinc|neutral|slate)-`, no `text-white`, no `-\[[0-9.]+(px|rem)\]`. Each remaining hit is either one of the two documented exceptions, the static 503 view (inline styles, by design: spec B15), or a defect to fix in a commit `fix(<scope>): …`.
- [ ] `grep -rn "sk-" resources/js resources/css` finds no design-system preview class (criterion 8).
- [ ] Rule 13: every `18e-report/<group>.md` has its "Differences with the mockup" section, and each difference names a row of "Deviations from the mockup". A difference without a row stops the gate.
- [ ] Every item of spec §9 that this plan owns (B1, B2, B3, B10, B15, B16 renames, B17 to B32, B36 to B45) has its feature test file, named in its task; `grep -c` each in the tree.
- [ ] One whole-branch review (fresh reviewer, read-only), one fix wave, one scoped re-review.

### Task F3: Phase report

**Files:** create `docs/superpowers/research/front-rewrite/18e-report.md`, assembled from `18e-report/<group>.md`.

Content (spec §12): what is done, per group; the parity table "action in the old front end → control in the new one" per screen (spec §8 and criterion 2), with the old features the owner's answers changed or removed marked as decided (spec §8, last list); every browser test that changed, with the mockup or the answer that imposed it (criterion 3); the side-by-side comparison of each screen with its mockup and the differences that remain (criterion 35); the table "Deviations from the mockup" with the owner's decision on each row (gate G-deviations); back-end changes made, item by item (B1 … B45 of this plan), with their feature tests; code deleted; tokens or components found missing; the four open points of spec §15 and what the owner answered; the "Places left" of every screen, with the slot names, for the plans of the feature roadmap; the six decisions that stayed unanswered and their defaults; `old-components-for-18g.md`; what 18f needs (the places left for the magic link, the notification row for `recap_emails`, the shortcut handlers of B35 and the single-key shortcuts `P` and `E` of the drawing toolbar, the security review of B31) and what 18g needs. Commit: `docs(front-rewrite): phase report of plan 18e`.

---

## Self-review

**Owner's answers marked "≠ default" → spec item → task.**

| Answer | Spec | Task |
|---|---|---|
| BLOCK-3 / 12-D1 redirect | B32 | 12.1 |
| X3 banner | §6.3 | 0.3, 0.14; R3, 3.1a, G3, 7.2 |
| X5 one timer list | ruling 19 | 0.5; 3.1a, G3 |
| 1-D2 one trigger | §6.4 | 1.1, 1.2, 1.3, 4.1 |
| 1-D3 shortcuts and Browse | B17 | 1.0a, 1.1 |
| 1-D4 four types now, Poll with plan 19 | B18 | 1.0b, 1.4 |
| 1-D8 dialog confirmation | §6.4 | 1.3 |
| 2-D6 duration | B3, B19 | R12a, R12 |
| 2-D8 "+2 min", on every timer (third round) | B20, ruling 19 | 0.5; R2b, R3; 3.0c, 3.1a; G0e, G3; 7.0b, 7.2 |
| 2-D9 topics only | §6.4 | R9 |
| 7-D2 guest link in Share only | §6.4 | R3, 3.1b, 7.2, 7.3 |
| 2-D13 confetti | ruling 37 | R12 |
| 3-D3 saved decks page; usage without backfill | B21 | 1.0c, 1.5 |
| 3-D7 "Reveal cards" | §6.4 | 3.1a |
| 3-D8 actions in the dock | §6.4 | 3.1a |
| 3-D10 spectator switch | — (a control) | 3.2 |
| 4-D1 `/dashboard` | B22 | 4.0a |
| 4-D3 mood and ROTI trend | B23 | 4.0b, 4.3 |
| 4-D4 `avatarUrl` | B24 | 4.0c, 4.1 |
| 4-D5 member removal confirmation | §6.4 | 4.1 |
| 4-D6 "…" section menus | §6.4 | 4.1 |
| 5-D3 delete confirmation | §6.4 | R8b, R9, 5.2 |
| 5-D4 / 5-D5 group by, counters | ruling 38, B25 | 5.0, 5.2 |
| 5-D6 topbar button | ruling 38 | 0.15 (slot), 5.2 |
| 5-D7 "(Guest)" | §6.4 | R8b, R9, 5.2 |
| 6-D2 eight ink colours | B26, ruling 36 | G0a, G4 |
| 6-D3 reaction bar in a room | B27 | G0b, G3 |
| 6-D6 status and avatars; live list (third round) | B28 | G0c, G0d, G1 |
| 6-D7 full Share dialog | — (a component) | G3 |
| 7-D1 palette and template JSON | B29 | 7.0, 7.4 |
| 7-D3 colour bar everywhere | §6.4 | 7.4 |
| 7-D7 phone read mode | §6.4 | 7.5 |
| 9-D1 / 9-D2 templates page; workspace-level decks (third round) | B30 | 1.0e, 9.0b, 9c |
| 9-D5 revoke confirmation | §6.4 | 9b |
| 9-D7 deletion sentence | §6.4 | 9c |
| 10-D2 inline token form | — (a layout) | 10.4 |
| 11-D2 SSO on the invitation; unverified address refused (third round) | B31 | 11.5a, 11.5; the refusal: plan 18f |
| 11-D3 request id | B36 | 11.6, 11.7 |
| 11-D7 / 11-D10 503, 419, 429 | B15 | 11.7 |
| 18f: forced SSO, recap unsubscribe, shortcuts | B33, B34, B35 | plan 18f (not this plan) |
| 18g boundary | §12 row 18g | F1 step 4, F3 |
| Rule 13 (standing rule) | §5 rule 13, criterion 35, B37 to B45 | procedure step 7; the two tables; 0.15; 1.0d, R2a, R2c, 3.0a, 3.0b, 4.0d, 9.0a, 10.0, 11.5a |
| "Rewrite first, features after" (third round) | §5 rule 13, §10 | procedure step 3b; the "Places left" line of each screen task; the last column of the deviations table; `feature-roadmap.md` |

**Spec coverage.** §7 rows 1 to 12: groups 1 to 12 (row 10's Admin › Branding was 18d and is brought in line by 0.15; row 12 is a redirect). §9: B1 → R10; B2 → R11; B3 → R12a, R12; B10 → R1; B15 → 11.7; B16 renames → 0.9 and 5.0; B17 → 1.0a; B18 → 1.0b; B19 → R12a; B20 → R2b, 3.0c, G0e, 7.0b; B21 → 1.0c, 1.5; B22 → 4.0a; B23 → 4.0b; B24 → 4.0c; B25 → 5.0; B26 → G0a; B27 → G0b; B28 → G0c, G0d; B29 → 7.0; B30 → 1.0e, 9.0b; B31 → 11.5a; B32 → 12.1; B36 → 11.6; B37 → 1.0d; B38 → R2c; B39 → 3.0a; B40 → 3.0b; B41 → 4.0d; B42 → 9.0a; B43 → 10.0; B44 → 11.5a; B45 → R2a. B33, B34, B35 are plan 18f. §8 parity list: each line is a parity row of a brief; step 4 of the procedure checks them and F3 publishes the tables. §11: Vitest, feature, browser and visual tests are named per task; §13 criterion 9 → `[P18e-02-01]`; criterion 12 → `[P18e-02-07]`; criteria 5 and 8 → F2; criteria 14 to 29 and 33 to 44 → the feature tests of the back-end tasks; criterion 35 → procedure step 7 and F2. Not covered here by design: criteria 6 (`knip`) and 7 (starter kit) are 18g; criteria 30 to 32 are 18f.

**Names used on both sides.** Spec and plan agree on: `topTemplates`, `TemplateCatalogue::Shortcuts`, `gameOptions`, `canCreateGameRoom`, `roomLimit`, `retros.started_at`, `MarkRetroStarted`, `results.stats` (`votesCast`, `votesAvailable`, `participation`, `durationSeconds`), `previousAverage`, `retros.timer.extension.store`, `poker.rounds.timer.extension.store`, `games.timer.extension.store`, `whiteboards.timer.extension.store`, `poker_decks.workspace_id`, `workspaces.pokerDecks.store|update|destroy`, `scope`, `team-games.{teamId}`, `TeamGameRoomChanged`, `TeamGameRoomDeleted`, `teams.default_poker_deck`, `teams.default_saved_poker_deck_id`, `poker_games.saved_deck_id`, `teams.pokerDecks.index`, `teams.defaultPokerDeck.update`, `teams.pokerDecks.duplicate.store`, `defaultPokerDeck`, `moodTrend`, `avatarUrl`, `counts` (`open`, `overdue`, `completed`, `mine`, `rituals`), `filterTeams`, `teamGroups`, `DrawingOp::Colors` / `LegacyColors`, `game_rooms.reactions_enabled`, `reactionsEnabled`, `status` / `players` / `roundStartedAt`, `whiteboardTemplates`, `pokerDecks`, `author`, `ssoProviders`, `inviter` / `role` / `expiresAt` / `membersCount` / `members`, `AssignRequestId`, `X-Request-Id`, `requestId`, `writersCount`, `roti.voterIds`, `median` / `spread` / `agreement` / `outliers`, `deck` / `voters` / `votersCount`, `templateName` / `facilitator` / `rotiAverage`, `pokerPresence`, `adminsCount`, `teamsCount`, `twoFactor`, `session` (`facilitatorName`, `participantsCount`, `isLive`). The three names of plan 18f are only quoted here: `sso_required`, `recap_emails`, `single_key_shortcuts`.

**Type consistency.** `SessionShell` (with `kind`), `SessionTitle`, `SessionPresence`, `SessionTimer` (with `onExtend`), `TimeUpBadge`, `CursorToggle`, `useHideMyCursor`, `LiveCursors`, `SessionReactions`, `SessionReactionPicker`, `useFlyingReactions`, `GuestJoinPage`, `AccessNotice`, `GifSearchDialog`, `usesOwnLayout` / `ownLayoutPages`, `NewSessionDialog`, `useNewSessionIntent`, `topicsFrom`, `ItemDeleteConfirm`, `AppLayout actions` are named the same in the task that produces them and in every task that consumes them. `idPrefix="deck-custom"` is used in 1.2 and 3.1b, `"deck-new"` in 1.5.

**Not verified by this plan's author** (each is a "read before editing" or "confirm" instruction in its task): the message shape and overlay class of `live-reactions` (0.6); the exact roles and names inside `GifPicker` (0.13); whether the "+" control of `Timer` is a button or a menu item (0.5); whether `HealthCheckForm` renders `ol > li` and the old names (R5); the announcement text of `HealthStatementsManager` (4.2); whether the due-date control of `ActionSheet` is a native input (5.2); the label of the saved group in `DeckPicker` (3.1b); the list of old poker view files (3.1a names them from the brief, the agent lists the folder); Inertia v3's handling of a failed deferred prop (G1) and of `handleExceptionsUsing` for non-Inertia HTML requests, 419 and 429 (11.7); the name of the author column of `cards` and of the facilitator relation of `Retro` (R2c, 4.0d); the `creator` relation of `WorkspaceTemplate` (9.0b); how the timer tests bring a timer to zero (3.1a); which uses of "Reconnecting…" and of `retro-column-` are scoped in a way the new markup breaks (R3, R9, 3.1a, 7.2); the lines of `Plan18dBrandingTest.php` that 0.15 changes; the sRGB values of the eight inks (G0a computes them; G4 reads them). The mockups were read through `design-system-digest.md` and the briefs, not opened one by one: step 1 of each screen task is where a mockup element missed by both would surface. Nothing was run.

## Execution handoff

Plan saved as `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md`. Execution is subagent-driven through the Workflow tool: one agent per task, a review after each, one writer in Step A, one worktree per lane in Step B. The owner has read the deviations table and answered the first open points (third round). What is left to read before Task 0.1: the four points of spec §15, and `feature-roadmap.md`, whose order of plans 19 and after is a proposal.
