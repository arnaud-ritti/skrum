# Retro facilitation (Plan 21, RT-1 to RT-10) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development to run this plan task by task (through the Workflow tool, as the project does). Steps use checkbox (`- [ ]`) syntax. Every agent reads **Owner decisions**, **Global Constraints**, **Pre-build deviations** and its own task before anything else, then `docs/database.md` ("Rules for database code" and "Running the tests on an engine") for any task that touches PHP. A screen task also follows the "Screen task procedure" of `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md`, with the working rules below (no walkthrough, captures in Task 20 only).

**Status: v3 (2026-10-03), ready to build.** Every decision of spec §15 is answered; decisions 1 (C, a server-relayed writing count) and 10 (B, voting again takes "finished" back) differ from draft v1 and the tasks that depend on them are rewritten (Tasks 1, 5, 10, 11, 13, 19 and the new Task 23). Every pre-build deviation P21-01 to P21-11 is answered by the owner (2026-10-03): P21-07, P21-08 and P21-10 as listed, the others approved as listed; none changes what is built, and no screen waits for an answer. Per-task verification runs on PostgreSQL only; the four-engine matrix runs once at the end of the roadmap (owner, 2026-10-03).

**Goal:** The retro board shows who is writing, moving a card or taking notes; the facilitator pauses the timer; a retro caps the votes per card and each participant says "I have finished voting"; every topic of the discussion gets the same time, its shared notes, a "discussed" mark and the action items made for it; the facilitator reveals the ROTI in its phase and nudges the last voters; the retro's action items go to the tracker in one dialog.

**Architecture:** Eight nullable columns and one table (`topic_notes`) added to the retro aggregate; every write locks the retro row first and broadcasts on `presence-retro.{id}` after commit, as the board already does. Activity indicators are client events on the same presence channel, sender stamped by Reverb, nothing stored; on an anonymous retro, writing is instead a heartbeat to the server (`participants.writing_until`, 8 s) and a `writing.count` event that carries a count and nothing else (spec §6.11). The bulk export is a browser loop over the existing per-item export endpoint. The front fills the places plan 18e left in each phase (`02-retro.md`, "Places left").

**Tech Stack:** Laravel 13, PHP 8.4, Pest (feature, unit, arch, concurrency), Inertia 3, React 19, Tailwind 4, vite-plus (Vitest), Wayfinder, Reverb (client events), dnd-kit; PostgreSQL through `bin/test-db` for this plan (SQLite, MariaDB and MySQL at the end of the roadmap); `Tests\Concurrency\Support\Race` for races. Run `composer show --direct` and read `package.json` before Task 1 and stop if a major differs from the list.

**Spec:** `docs/superpowers/specs/2026-10-21-plan-21-retro-facilitation-design.md` (v3, decisions and pre-build deviations answered). Parent: `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` §5. Mockups: `docs/design-system/components/ScreenRetroWriting`, `ScreenRetroGrouping`, `ScreenRetroVote`, `ScreenRetroDiscussion`, `ScreenRetroActions`, `ScreenRetroROTI`, `ScreenSessionCreate`, `SessionSettingsPopover`, `FacilitatorBar`, `Timer`, `VoteDots`, `ROTIWidget`, `PresenceStack`, `ActionItem` — for each, the `README.md` and the `preview.html`.

**Not in this plan:** the backlog of spec §3 ("Reveal the cards" button, duplicates, "Undo last group", "n/n following", retro exports, ROTI delta and sparkline, "Timer per phase" (plan 22), pause of other timers, co-editing, notes outside the recap e-mail and the AI summary, bell nudges); browser walkthroughs (owner's working rule: none is written or run); anything of the former plans 28 and 30 and scheduling.

**Tasks:** 23. Step A, back end: Task 1 (single writer), then lanes T (2, 3), V (4, 5, 23), D (6, 7, 9) and R (8) in parallel. (Task 23, the writing count, was added with the owner's answer to decision 1; it is numbered last so the other numbers stay as the drafts and the roadmap cite them, and it runs in lane V after Task 5.) Step B, front foundation: Task 10 (single writer). Step C, screens: lanes W (11, 12), Vf (13), Df (14, 15), Af (16, 18), Rf (17) in parallel. Final: 19 (translations), 20 (captures), 21 (deviations and documents), 22 (PostgreSQL suites and report). Roadmap order (owner, 2026-10-03): plan 21 runs in the first wave, in parallel with plans 20, 26, 27 and 29; plan 22 (SE-3, "Timer per phase") comes after it and builds on its timer columns; then 23; then 24 and 25.

## Branch and run

- Base: the integration branch `roadmap` at or after `19db587f` (it holds `main` at `18d3637e`: plans 18e–18g, the database portability work and plan 19). Check before Task 1, and stop if one fails: `app/Enums/RetroPhase.php` has no `HealthCheck` case and has `Actions` and `Roti`; `resources/js/components/retro/phase-voting-bar.tsx` has the props `cap`, `finished`, `done`; `resources/js/components/retro/facilitator-dock.tsx` exports `RotiTools` places (`roti?: RotiTools`); `bin/test-db` exists and `bin/test-db pgsql -- tests/Arch` passes; `tests/Concurrency/Support/Race.php` exists; the last migration of `database/migrations` is dated before `2026_10_21_100000`.
- Branch `plan-21-retro-facilitation` from that base; when Task 22 passes, the controller merges it into `roadmap` and runs the PostgreSQL suite there. **Never push, never merge into `main`** (main is fast-forwarded only when the owner asks). Plans 20, 26, 27 and 29 run at the same time on their own branches: a conflict in a shared file (`routes/web.php`, `lang/*.json`, `components/skrum/`) is resolved at the merge into `roadmap`.
- Task 1 runs on that branch with one writer. Lanes run in git worktrees on branches `lane/21-<name>`, cut from the head named in **Lanes**; the controller merges one lane at a time and runs the gates after each merge: `npm run types:check`, `npm run check`, `npm run build:front`, `vendor/bin/pint --dirty --format agent`, `vendor/bin/sail composer types:check` and `bin/test-db pgsql -- tests/Feature/Retros tests/Arch`.
- From a worktree, `bin/test-db` needs `TEST_DB_CONTAINER` (the running application container) and `TEST_DB_WORKDIR` (the worktree's path inside it). MariaDB and MySQL are not started for this plan. Never run two whole suites at once in the shared container.
- **Every task re-reads the files it touches.** A line number or a method body quoted here that no longer matches is followed in spirit and reported.

## Owner decisions

The ten questions of spec §15, answered by the owner on 2026-10-03. Two answers differ from the option draft v1 was written on (**≠ rec.**); the last column says where the plan carries each answer.

| # | Question | Owner's answer | Where in the plan |
|---|---|---|---|
| 1 | "Is writing…" on an anonymous retro | **C** (≠ rec.): a count relayed by the server, no ids, no column; the timing risk is accepted (spec §6.11 rule 8) | Task 1 (`participants.writing_until`), **Task 23** (heartbeat routes, `WritingCountChanged`, limiter), Task 10 (`writing.count` listener), Task 11 (heartbeat instead of the whisper, the count in the presence line), Task 19 (strings); deviation P21-05 reworded |
| 2 | Which timers pause | **A**: the retro's only | Tasks 2, 12 |
| 3 | How the time per topic is set | **A**: from the topic's timer | Tasks 3, 14 |
| 4 | When a topic is "discussed" | **C**: automatic on moving on, and by hand | Tasks 3, 14 |
| 5 | Editing the notes | **A**: one writer at a time, version check | Tasks 6, 15 |
| 6 | Notes after the discussion | **A**: recap e-mail and AI summary input | Task 9 |
| 7 | Reveal closes the ROTI vote | **A**: yes | Tasks 8, 17 |
| 8 | What the nudge sends | **A**: live toast and pulse only | Tasks 8, 17 |
| 9 | How the bulk export runs | **A**: browser loop over the existing endpoint | Task 18 |
| 10 | Voting while "finished" | **B** (≠ rec.): a vote cast or retracted takes "finished" back by itself | Task 5 (the vote transactions clear the flag, broadcast `voting.finished`, answer `finishedIds`; race rewritten), Task 10 (`blocked` loses `'finished'`), Task 13 (buttons stay enabled, status line), Task 19 (strings) |

## File structure

Back end, created:

| File | Responsibility |
|---|---|
| `database/migrations/2026_10_21_100000_add_retro_facilitation_columns.php` | the eight columns of spec §6.1 |
| `database/migrations/2026_10_21_100100_create_topic_notes_table.php` | `topic_notes` |
| `app/Models/TopicNote.php`, `database/factories/TopicNoteFactory.php` | the note of a topic |
| `app/Actions/Retros/PresentTopicNote.php` | the note as the board reads it |
| `app/Actions/Retros/MoveTopicFocus.php` | the shared topic changes: restart the topic timer, mark the topic left |
| `app/Events/Retros/VotingFinishedChanged.php`, `WritingCountChanged.php`, `TopicDiscussed.php`, `TopicNoteSaved.php`, `RotiRevealed.php`, `RotiNudged.php` | the new events |
| `app/Http/Controllers/Retros/RetroTimerPausesController.php`, `VotingCompletionsController.php`, `RetroWritersController.php`, `CardDiscussionsController.php`, `TopicNotesController.php`, `RetroRotiRevealsController.php`, `RetroRotiNudgesController.php` | HTTP |

Back end, modified: `app/Models/Retro.php`, `Card.php`, `Participant.php`, `ActionItem.php`; `app/Events/Retros/TimerChanged.php`; `app/Actions/Retros/BuildBoardSnapshot.php`, `PresentCard.php`, `PresentActionItem.php`, `ChangeRetroPhase.php`, `NewRetro.php`, `CreateRetro.php`, `BuildSummaryInput.php`; `app/Actions/ActionItems/ActionItemRules.php`, `CreateActionItem.php`; `app/Actions/Integrations/BuildRetroRecap.php`; `app/Support/Integrations/Messages/RetroRecap.php`, `RetroRecapMail.php`, `RecapText.php`; `app/Http/Controllers/TeamRetrosController.php`; `app/Http/Controllers/Retros/RetroTimersController.php`, `RetroTimerExtensionsController.php`, `RetroHighlightsController.php`, `RetroSettingsController.php`, `CardVotesController.php`, `ActionItemsController.php`; `app/Providers/AppServiceProvider.php` (the `retro-writing` limiter); `routes/web.php`; `database/factories/RetroFactory.php`; `tests/Pest.php`.

Tests, created: `tests/Feature/Retros/RetroFacilitationSchemaTest.php`, `TimerPauseTest.php`, `TopicTimerTest.php`, `TopicDiscussedTest.php`, `MaxVotesPerCardTest.php`, `VotingCompletionTest.php`, `WritingCountTest.php`, `TopicNotesTest.php`, `ActionItemTopicsTest.php`, `RotiRevealTest.php`, `RotiNudgeTest.php`, `TopicNotesRecapTest.php`; `tests/Concurrency/MaxVotesPerCardTest.php`, `VotingCompletionTest.php`, `TopicNotesTest.php`, `RotiRevealTest.php`; `tests/Browser/Visual/RetroFacilitationVisualTest.php` (captures only).

Front end, created: `resources/js/lib/retro/activity.ts`, `topic-estimate.ts`, `note-editor.ts`; `resources/js/lib/action-items/bulk-export.ts`; `resources/js/hooks/use-retro-activity.ts`; `resources/js/components/retro/activity-line.tsx`, `voting-finished.tsx`, `topic-timer.tsx`, `topic-meta.tsx`, `topic-notes.tsx`, `topic-actions.tsx`, `roti-facilitation.tsx`, `bulk-export-dialog.tsx`; `resources/js/components/action-items/export-target-fields.tsx` (extracted from `item-export.tsx`); each with its `.test.ts(x)`.

Front end, modified: `resources/js/lib/retro/types.ts`, `board-reducer.ts`, `hooks/use-retro-board.ts`, `components/retro/board-context.tsx`, `board.tsx`, `board-topbar.tsx` (`BoardTimer`, `BoardPresence`), `components/session/session-timer.tsx`, `components/session/session-presence.tsx`, `components/skrum/presence-stack.tsx` (`typingCount`), `components/retro/facilitator-dock.tsx`, `board-column.tsx`, `columns-board.tsx`, `phase-voting-bar.tsx`, `phase-discussing.tsx`, `topics-list.tsx`, `topic-focus.tsx`, `phase-actions.tsx`, `phase-roti.tsx`, `action-items-list.tsx`, `results/action-items.tsx`, `board-settings.tsx`, `components/skrum/session-settings-popover.tsx`, `components/teams/session-create/retro-session-fields.tsx`, `components/action-items/item-export.tsx`, the four `lang/*.json`.

## Global Constraints

- **Mockup first** (parent spec §5 rule 13). A screen follows its mockup: layout, placement, labels, states. A difference is fixed, or is a row of **Pre-build deviations**. The rows P21-01 to P21-11 are answered (2026-10-03); a new difference found while building is fixed, or ruled under the owner's autonomy mandate of 2026-10-03, added as a row marked "ruled while building" and listed in the report. Captures are taken once, in Task 20, in light, at 1440, in French, and compared with the mockup's `preview.html` in Task 21.
- **Front rules** of the parent spec §5 on every front file: tokens only, rem, Tailwind scale (no arbitrary size), no overflow from 20rem to 60rem, visible focus, contrast, `prefers-reduced-motion` (the trema dots and the nudge pulse stop), lucide icons, the literal call shape `t('…')`, presentational `skrum/` components (no network, no Echo, no router). Containers live in `resources/js/components/retro/`. Reuse what exists: `skrum/timer` (`paused`, `onPause`, `onResume` already exist), `skrum/presence-stack` (`typing` already exists), `skrum/vote-dots` (`maxPerCard` already exists), `skrum/roti-widget` (`mode="result"`), `components/action-items/item-export`.
- **Database (owner rule): Eloquent and the standard query builder only.** `docs/database.md`, rules 1 to 12, apply to every line of PHP, migration and test; `tests/Arch/DatabasePortabilityTest.php` enforces them with no allowed list. No raw query of any form; no driver test in code, migrations, factories or tests; migrations with the Schema builder only, `up` only, dated `2026_10_21_…`, `dateTime()` for date columns, no `enum()`, no collation, no JSON column; **every transaction this plan writes locks the retro row first** (`Retro::query()->whereKey($id)->lockForUpdate()->firstOrFail()`), then the participant, the card, the note or the item; a transaction that broadcasts is not retried with `Transactions::Attempts`, except the vote paths that already are (their broadcast goes through `sendToOthers`, which waits for the commit); an explicit tie-breaker on every sort; tests never read SQL text and never change the schema.
- **PostgreSQL per plan, four engines at the end of the roadmap** (owner, 2026-10-03: "Lance les 4 bases seulement à la fin"). Every task runs the tests it wrote or touched on PostgreSQL: `bin/test-db pgsql -- <paths>`; a step "Run the tests on PostgreSQL" means exactly that. Races (`tests/Concurrency`) run with `bin/test-db pgsql --concurrency -- <path>`, never in parallel. SQLite, MariaDB and MySQL are not run by this plan: the four-engine matrix (pgsql, sqlite, mariadb, mysql, and the races on `sqlite-file`, `mariadb`, `mysql`) runs once, after the last merge into `roadmap` (plans 24 and 25). The code stays portable regardless: the database rule below and `tests/Arch/DatabasePortabilityTest.php` hold on every task, so that the final matrix finds nothing; an engine-specific regression found late is the risk the owner accepted.
- **Races** are proved with `Tests\Concurrency\Support\Race` (`Race::run`, `Race::request`; static closures capturing scalars only); each case states the protection it proves: the cap per card (Task 4), finishing while a vote arrives (Task 5), the first note of a topic and two saves from one version (Task 6), a vote while the ROTI is revealed (Task 8).
- **Working rules (owner):** unit, feature, arch and concurrency tests are written and run per task on PostgreSQL before the task's commit; Vitest is written and run (`npm run test -- <pattern>` per task, the whole suite in Task 22); the retro suites run at each lane merge (gates above) and the whole suites on PostgreSQL in Task 22; browser walkthroughs (`tests/Browser/Walkthroughs`) are neither written, edited nor run; captures only, in Task 20, light, 1440, French.
- **No new dependency**, PHP or JS, without the owner's approval.
- **Four languages, informal.** Every new `__('…')` and `t('…')` key is added to `lang/en.json`, `fr.json`, `es.json`, `de.json` in the commit that introduces it (`tests/Feature/TranslationKeysTest.php`), in the informal register (French "tu", Spanish "tú", German "du"; `tests/Feature/InformalRegisterTest.php`). A key that exists keeps its value. Task 19 holds the values of every key this plan names; in `en.json` the value is the key.
- **No test is deleted** without the owner's approval. An existing test whose expectation changes is listed in its task with the reason.
- Primary and foreign keys are UUIDs (`tests/Feature/UuidPrimaryKeysTest.php`). Create files with `vendor/bin/sail artisan make:… --no-interaction`.
- Controllers: plural name, CRUD method names only (`tests/Arch/ArchTest.php`). Route names camelCase, URLs kebab-case, tuple notation.
- Arch facts: models do not use `App\Actions`, `App\Http` or `App\Mcp`; actions do not use `App\Http`; events do not use `App\Http`; no class is `final`; enums use nothing of the application.
- PHP style: early returns, no `else`, happy path last, separate conditions, typed everything, PascalCase constants, constructor promotion, no comment that restates code; before each commit `vendor/bin/pint --dirty --format agent` and `vendor/bin/sail composer types:check` (PHPStan).
- Octane is installed: no static or per-request singleton state in new classes (the nudge limit goes through `RateLimiter`, which uses the cache).
- Front gates after every task that touches the front: `npm run types:check`, `npm run check`, `npm run build:front` (build and `wayfinder:generate --with-form`, needed after every task that adds a route used by the front).
- One commit per task, in the repository's style (`feat(retro): …`, `test: …`), ending with the two trailer lines:

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE
```

A change to a shared `skrum/` or `session/` component is its own commit inside the task, with the same trailers.

## Pre-build deviations

Put to the owner before the screen is built (owner's rule of the fifth round): **all eleven rows answered on 2026-10-03.** The owner's word: "P21: 07 mockup (topic timer only in Discussing), 08 list + progress dialog, 10 both progress and '5/8 finished', other rows approved as listed". Every answer is the row as written, so no task changes. Reasons as in plan 18e: **F** false or unsafe, **A** accessibility, **N** no such data or concept, **S** this spec, **O** an owner's answer.

| # | Screen | Mockup element | Built | Reason | Owner (2026-10-03) |
|---|---|---|---|---|---|
| P21-01 | Discussing | "+1 min" on the topic timer | "+2 min" | O: "+2 min" on every timer (2-D8) | approved as listed |
| P21-02 | Discussing | "8/8" following count in the focus banner | not rendered, place kept | N: backlog (roadmap) | approved as listed |
| P21-03 | Writing | "Reveal the cards" beside the next-phase button | not rendered | N: backlog (D-10 keeps it) | approved as listed |
| P21-04 | Grouping | duplicates suggestion, "Undo last group" | not rendered | N: backlog (D-10 keeps them) | approved as listed |
| P21-05 | Writing | "Inès is writing a card…" under a column, ringed avatar, with "Anonymity: on" | on an anonymous retro, only the presence line "Someone is writing…" / ":count people are writing…": no name, no ring, no column line | F + O: a name or a column would tie a hidden card to its author; the owner chose a server-relayed count (decision 1, answer C) | approved as listed |
| P21-06 | Voting | "max 2 per card" with a stepper default of 2 in creation and settings | "Max per card" with "No limit" on by default | O: existing behaviour kept (a retro has no cap today) | approved as listed |
| P21-07 | Discussing | the topic timer is the only timer on screen; no timer in the topbar | the topbar keeps no timer in Discussing; the stage holds it | S: §9.4 (as the mockup) — listed because plan 18e kept the topbar timer in every phase | as the mockup: the topic timer only, on the stage, in Discussing (Task 14) |
| P21-08 | Actions | "Exporter vers Jira" opens nothing drawn | the per-item export dialog with a list of items and a progress | N: no mockup of the dialog | the list and progress dialog, as listed (Task 18) |
| P21-09 | Discussing | the right card is "Topic actions" only | "Topic actions", then "Other action items (n)", collapsed | O: no feature lost (2-D9) | approved as listed |
| P21-10 | Voting | "5/8 have finished" in place of the votes-cast progress | the progress "n of m votes cast" stays, followed by "5/8 have finished" | parity row 57 of plan 18e (kept by D-105) | both: the progress and "5/8 have finished" (Task 13) |
| P21-11 | ROTI | "Results appear for everyone when the facilitator ends the session." | "… when the facilitator reveals them or ends the session." | F: the reveal exists now | approved as listed |

## Review Focus

The inputs the spec implies and that are most likely to bite, each pinned by a test in the task that owns the code.

1. **A vote that would exceed the cap per card arriving together with another one** (a double click): one is refused. Race in Task 4.
2. **Two people saving the notes of one topic at the same moment**, the first time and later: one row, one 409, the loser's text kept on screen. Race in Task 6; Vitest of the editor state in Task 15.
3. **A paused timer carried into the Icebreaker phase, then resumed**: the round's expiry is scheduled for the new end. Feature test in Task 2.
4. **An activity event whose payload names someone else, or comes from a member who left**: ignored; the sender comes from Reverb's stamp. Vitest in Task 11.
5. **A late ROTI vote right after the reveal**: refused, never counted into a distribution on screen. Feature test and race in Task 8.
6. **A bulk export that meets an item exported meanwhile by someone else, a 403, and a network error**: each row says why, nothing is exported twice, "Retry the failed ones" retries only failures. Vitest in Task 18.
7. **Moving the shared topic back to a topic already discussed**: it stays discussed; the timer restarts for it. Feature test in Task 3.
8. **Anything that would put an id, a name or a column into the anonymous writing count** (a payload key added "for debugging", a `writing` whisper sent on an anonymous retro by a refactor): the exact-keys test of Task 23 and the no-whisper Vitest of Task 11 fail. The timing risk that remains is the owner's accepted risk (spec §6.11 rule 8); nobody "fixes" it by going back to named indicators.
9. **A finished participant who votes while someone else's finish or vote is on its way**: the vote is saved and "finished" is cleared in the same transaction as the vote; the voter's own board reads `finishedIds` from the answer. Feature tests and race in Task 5.

## Lanes

| Lane | Tasks | Cut from | Shares with other lanes |
|---|---|---|---|
| main | 1, 10, 19 to 22 | — | — |
| T (timers) | 2, 3 | head of Task 1 | `routes/web.php` (its own block), `lang/*.json` |
| V (voting) | 4, 5, 23 | head of Task 1 | `routes/web.php`, `lang/*.json`, `app/Providers/AppServiceProvider.php` (the `retro-writing` limiter only); `CardVotesController.php` is this lane's only |
| D (discussion) | 6, 7, 9 | head of Task 1 | `routes/web.php`, `lang/*.json` |
| R (ROTI) | 8 | head of Task 1 | `routes/web.php`, `lang/*.json`, `app/Models/Retro.php` (`takesRotiVotes` only) |
| W (writing and grouping) | 11, 12 | head of Task 10 | `lang/*.json`, `components/retro/facilitator-dock.tsx` (the `pause` action only; lane Rf touches the `roti` tools), `board-topbar.tsx` |
| Vf (voting front) | 13 | head of Task 10 | `lang/*.json`, `components/skrum/session-settings-popover.tsx` (the Voting group only) |
| Df (discussion front) | 14, 15 | head of Task 10 | `lang/*.json`, `phase-discussing.tsx`, `topics-list.tsx` |
| Af (actions front) | 16, 18 | head of Task 10 | `lang/*.json`, `action-items-list.tsx`, `phase-actions.tsx`, `phase-discussing.tsx` (the `linkedTo` and the right column only: merged after Df) |
| Rf (ROTI front) | 17 | head of Task 10 | `lang/*.json`, `facilitator-dock.tsx` (the `roti` tools only) |

Task 1 writes every column, the snapshot keys, the presenters and the `ChangeRetroPhase` rules, so the back-end lanes do not touch `BuildBoardSnapshot`, `ChangeRetroPhase` or the models (except lane R's one method). Task 10 writes every front type, reducer action and channel case, so the front lanes do not touch `types.ts`, `board-reducer.ts` or `use-retro-board.ts`. `routes/web.php`: each lane adds its lines in the `retros/{retro}` group, after `retros.timer.extension.store` (T), after `retros.cards.votes.destroy` (V), after `retros.cards.comments.store` (D), after `retros.roti.destroy` (R); Task 23 adds its two lines after Task 5's; the controller resolves the import block at merge. `lang/*.json` conflicts are resolved by the controller at each merge (keys appended in one alphabetical block per lane). `tests/Pest.php`: only Task 1 adds helpers. The merge order of the front lanes: W, Vf, Rf, Df, then Af (it builds on Df's right column).

---

## Step A — back end

### Task 1: Schema, models, presenters, phase rules, test helpers (main)

**Files:**
- Create: `database/migrations/2026_10_21_100000_add_retro_facilitation_columns.php`, `database/migrations/2026_10_21_100100_create_topic_notes_table.php`, `app/Models/TopicNote.php`, `database/factories/TopicNoteFactory.php`, `app/Actions/Retros/PresentTopicNote.php`
- Modify: `app/Models/Retro.php`, `Card.php`, `Participant.php`, `ActionItem.php`; `app/Events/Retros/TimerChanged.php`; `app/Actions/Retros/BuildBoardSnapshot.php`, `PresentCard.php`, `PresentActionItem.php`, `ChangeRetroPhase.php`; `app/Http/Controllers/Retros/RetroTimersController.php`, `RetroTimerExtensionsController.php` (the `TimerChanged::of` call only); `tests/Pest.php`
- Test: `tests/Feature/Retros/RetroFacilitationSchemaTest.php`; edited: `tests/Feature/Retros/BoardSnapshotTest.php` only if it compares the full key list of `retro` or of the snapshot (add the new keys; say so in the commit)

Read first: `docs/database.md` ("Rules for database code"); `app/Models/Retro.php` (`booted`, `casts`, `Fillable`), `app/Models/SavedPokerDeck.php` (an invariant raised with `ModelInvariantViolation::because`), `database/migrations/2026_10_20_100000_create_team_survey_tables.php` (the latest migration style); `BuildBoardSnapshot::handle` and `roti()`; `ChangeRetroPhase::move`; `PresentCard::handle`; `PresentActionItem::handle`; `TimerChanged`; `tests/Arch/DatabasePortabilityTest.php`.

**Interfaces:**
- Consumes: `App\Actions\Retros\SummarizeRoti::handle(Retro): array{distribution: array<int, array{score: int, count: int}>, average: ?float, respondents: int}`; `Retro::voteLimit(): int`; `RetroPhase`.
- Produces:
  - columns of spec §6.1 and the table `topic_notes`; `TopicNote` (`MaxLength = 5000`; relations `retro()`, `card()`, `updatedBy()`); `Retro::topicNotes(): HasMany<TopicNote>`, `Retro::maxVotesPerCard(): ?int`, `Retro::votingFinishedIds(): array<int, string>`; `Card::note(): HasOne<TopicNote>`; `Participant::hasFinishedVoting(): bool`; `participants.writing_until` (cast `datetime`, fillable; used by Task 23 only, never presented); `ActionItem::card(): BelongsTo<Card>`; the `Retro` invariant on the timer columns.
  - `TimerChanged::of(Retro $retro): TimerChanged` with `broadcastWith(): array{timerEndsAt: ?string, timerPausedSeconds: ?int, topicSeconds: ?int}`.
  - `PresentTopicNote::handle(?TopicNote $note, string $cardId): array{cardId: string, body: string, version: int, updatedAt: ?string}`.
  - Snapshot keys: `retro.timerPausedSeconds`, `retro.topicSeconds`, `retro.maxVotesPerCard`, `retro.maxVotesPerCardSetting`; `voting.finishedIds`; `cards[].discussedAt` (from `PresentCard`, so every card payload carries it); `topicNotes`; `roti.revealed`, `roti.results`; `actionItems[].cardId` (from `PresentActionItem`).
  - `ChangeRetroPhase`: entering Voting clears `participants.voting_finished_at`; entering ROTI clears `roti_revealed_at`; completing clears `timer_paused_seconds` and `topic_seconds` with `timer_ends_at`.
  - Test helpers: `retroGuest(Retro $retro, string $secret = 'secret'): Participant`; `topicCard(Retro $retro, array $attributes = []): Card`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/Retros/RetroFacilitationSchemaTest.php`:

```php
<?php

use App\Actions\Retros\BuildBoardSnapshot;
use App\Actions\Retros\ChangeRetroPhase;
use App\Enums\RetroPhase;
use App\Events\Retros\TimerChanged;
use App\Exceptions\ModelInvariantViolation;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Retro;
use App\Models\RotiVote;
use App\Models\TopicNote;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('keeps the behaviour of today on a retro with none of the new values', function () {
    $retro = Retro::factory()->create()->fresh();

    expect($retro->timer_paused_seconds)->toBeNull()
        ->and($retro->topic_seconds)->toBeNull()
        ->and($retro->max_votes_per_card)->toBeNull()
        ->and($retro->roti_revealed_at)->toBeNull()
        ->and($retro->maxVotesPerCard())->toBeNull()
        ->and($retro->votingFinishedIds())->toBe([]);
});

it('never puts who is writing in the board snapshot', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['is_anonymous' => true]);
    [, $participant] = retroMember($retro);
    $participant->update(['writing_until' => now()->addSeconds(8)]);

    $snapshot = resolve(BuildBoardSnapshot::class)->handle($retro->fresh(), $participant->fresh());

    expect(json_encode($snapshot))->not->toContain('writing_until')
        ->and(json_encode($snapshot))->not->toContain('writingUntil');
});

it('lets the vote limit win over a higher cap per card', function () {
    $retro = Retro::factory()->create(['votes_per_participant' => 3, 'max_votes_per_card' => 5]);

    expect($retro->maxVotesPerCard())->toBe(3);

    $retro->update(['max_votes_per_card' => 2]);

    expect($retro->fresh()->maxVotesPerCard())->toBe(2);
});

it('refuses a timer that both runs and is paused', function () {
    $retro = Retro::factory()->create();

    expect(fn () => $retro->update(['timer_ends_at' => now()->addMinute(), 'timer_paused_seconds' => 30]))
        ->toThrow(ModelInvariantViolation::class);
});

it('keeps one note per topic and deletes it with its card', function () {
    $retro = Retro::factory()->create();
    $card = topicCard($retro);
    TopicNote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id]);

    expect(fn () => DB::transaction(fn () => TopicNote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id])))
        ->toThrow(UniqueConstraintViolationException::class);

    $card->delete();

    expect(TopicNote::query()->count())->toBe(0);
});

it('forgets the topic of an action item whose card is deleted', function () {
    $retro = Retro::factory()->create();
    $card = topicCard($retro);
    $item = ActionItem::factory()->create(['team_id' => $retro->team_id, 'retro_id' => $retro->id, 'card_id' => $card->id]);

    $card->delete();

    expect($item->fresh()->card_id)->toBeNull();
});

it('puts the new values in the board snapshot', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create([
        'timer_paused_seconds' => 90,
        'topic_seconds' => 300,
        'votes_per_participant' => 5,
        'max_votes_per_card' => 2,
    ]);
    [, $participant] = retroMember($retro);
    $participant->update(['voting_finished_at' => now()]);
    $card = topicCard($retro, ['discussed_at' => now()]);
    TopicNote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'body' => 'Ship smaller', 'version' => 2]);
    $item = ActionItem::factory()->create(['team_id' => $retro->team_id, 'retro_id' => $retro->id, 'card_id' => $card->id]);

    $snapshot = resolve(BuildBoardSnapshot::class)->handle($retro->fresh(), $participant->fresh());

    expect($snapshot['retro'])->toMatchArray([
        'timerPausedSeconds' => 90,
        'topicSeconds' => 300,
        'maxVotesPerCard' => 2,
        'maxVotesPerCardSetting' => 2,
    ])
        ->and($snapshot['voting'])->toBe(['finishedIds' => [$participant->id]])
        ->and(collect($snapshot['cards'])->firstWhere('id', $card->id)['discussedAt'])->toBeString()
        ->and($snapshot['topicNotes'])->toHaveCount(1)
        ->and($snapshot['topicNotes'][0])->toMatchArray(['cardId' => $card->id, 'body' => 'Ship smaller', 'version' => 2])
        ->and(collect($snapshot['actionItems'])->firstWhere('id', $item->id)['cardId'])->toBe($card->id)
        ->and($snapshot['roti'])->toMatchArray(['revealed' => false, 'results' => null]);
});

it('gives the ROTI results once revealed or completed, never before', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Roti)->create();
    [, $participant] = retroMember($retro);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'score' => 4]);
    $snapshot = fn () => resolve(BuildBoardSnapshot::class)->handle($retro->fresh(), $participant->fresh());

    expect($snapshot()['roti']['results'])->toBeNull();

    $retro->update(['roti_revealed_at' => now()]);

    expect($snapshot()['roti'])->toMatchArray(['revealed' => true])
        ->and($snapshot()['roti']['results'])->toMatchArray(['average' => 4.0, 'respondents' => 1]);
});

it('sends the paused seconds and the time per topic with the timer', function () {
    $retro = Retro::factory()->create(['timer_paused_seconds' => 42, 'topic_seconds' => 300]);

    expect(TimerChanged::of($retro)->broadcastWith())->toBe([
        'timerEndsAt' => null,
        'timerPausedSeconds' => 42,
        'topicSeconds' => 300,
    ]);
});

it('starts each voting round with nobody finished', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->create();
    [, $participant] = retroMember($retro);
    $participant->update(['voting_finished_at' => now()]);

    DB::transaction(fn () => resolve(ChangeRetroPhase::class)->handle(Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail(), RetroPhase::Voting));

    expect($participant->fresh()->voting_finished_at)->toBeNull();
});

it('hides the ROTI again when the phase is entered again', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Actions)->create(['roti_revealed_at' => now()]);

    DB::transaction(fn () => resolve(ChangeRetroPhase::class)->handle(Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail(), RetroPhase::Roti));

    expect($retro->fresh()->roti_revealed_at)->toBeNull();
});

it('clears every timer column when the retro is completed', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Roti)->create(['timer_paused_seconds' => 60, 'topic_seconds' => 300, 'roti_revealed_at' => now()]);

    DB::transaction(fn () => resolve(ChangeRetroPhase::class)->handle(Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail(), RetroPhase::Completed));

    $completed = $retro->fresh();

    expect($completed->timer_ends_at)->toBeNull()
        ->and($completed->timer_paused_seconds)->toBeNull()
        ->and($completed->topic_seconds)->toBeNull()
        ->and($completed->roti_revealed_at)->not->toBeNull();
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `bin/test-db pgsql -- tests/Feature/Retros/RetroFacilitationSchemaTest.php`
Expected: FAIL (`topicCard` undefined, unknown columns).

- [ ] **Step 3: Migrations**

`database/migrations/2026_10_21_100000_add_retro_facilitation_columns.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Retro facilitation (plan 21). Every column is nullable: null keeps the behaviour of before.
     */
    public function up(): void
    {
        Schema::table('retros', function (Blueprint $table): void {
            $table->unsignedInteger('timer_paused_seconds')->nullable();
            $table->unsignedSmallInteger('topic_seconds')->nullable();
            $table->unsignedTinyInteger('max_votes_per_card')->nullable();
            $table->dateTime('roti_revealed_at')->nullable();
        });

        Schema::table('participants', function (Blueprint $table): void {
            $table->dateTime('voting_finished_at')->nullable();
            $table->dateTime('writing_until')->nullable();
        });

        Schema::table('cards', function (Blueprint $table): void {
            $table->dateTime('discussed_at')->nullable();
        });

        Schema::table('action_items', function (Blueprint $table): void {
            $table->foreignUuid('card_id')->nullable()->constrained('cards')->nullOnDelete();
        });
    }
};
```

`database/migrations/2026_10_21_100100_create_topic_notes_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('topic_notes', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('retro_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('card_id')->constrained()->cascadeOnDelete();
            $table->text('body');
            $table->unsignedInteger('version')->default(0);
            $table->foreignUuid('updated_by_participant_id')->nullable()->constrained('participants')->nullOnDelete();
            $table->timestamps();

            $table->unique('card_id');
        });
    }
};
```

- [ ] **Step 4: Models and factory**

`app/Models/TopicNote.php`:

```php
<?php

namespace App\Models;

use Database\Factories\TopicNoteFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $retro_id
 * @property string $card_id
 * @property string $body
 * @property int $version
 * @property string|null $updated_by_participant_id
 * @property Carbon|null $updated_at
 */
#[Fillable(['card_id', 'body', 'version', 'updated_by_participant_id'])]
class TopicNote extends Model
{
    /** @use HasFactory<TopicNoteFactory> */
    use HasFactory;

    use HasUuids;

    public const int MaxLength = 5000;

    /** @var array<string, mixed> */
    protected $attributes = ['body' => '', 'version' => 0];

    /** @return BelongsTo<Retro, $this> */
    public function retro(): BelongsTo
    {
        return $this->belongsTo(Retro::class);
    }

    /** @return BelongsTo<Card, $this> */
    public function card(): BelongsTo
    {
        return $this->belongsTo(Card::class);
    }

    /** @return BelongsTo<Participant, $this> */
    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(Participant::class, 'updated_by_participant_id');
    }

    protected function casts(): array
    {
        return ['version' => 'integer'];
    }
}
```

`database/factories/TopicNoteFactory.php`:

```php
<?php

namespace Database\Factories;

use App\Models\Card;
use App\Models\Retro;
use App\Models\TopicNote;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TopicNote>
 */
class TopicNoteFactory extends Factory
{
    public function definition(): array
    {
        return [
            'retro_id' => Retro::factory(),
            'card_id' => fn (array $attributes) => Card::factory()->create(['retro_id' => $attributes['retro_id']])->id,
            'body' => fake()->sentence(),
            'version' => 1,
        ];
    }
}
```

`app/Models/Retro.php`:
- `@property int|null $timer_paused_seconds`, `@property int|null $topic_seconds`, `@property int|null $max_votes_per_card`, `@property Carbon|null $roti_revealed_at`.
- `Fillable`: add `'timer_paused_seconds', 'topic_seconds', 'max_votes_per_card', 'roti_revealed_at'`.
- `casts()`: `'timer_paused_seconds' => 'integer'`, `'topic_seconds' => 'integer'`, `'max_votes_per_card' => 'integer'`, `'roti_revealed_at' => 'datetime'`.
- In `booted()`, after the `deleting` hook:

```php
        static::saving(function (Retro $retro): void {
            if ($retro->timer_ends_at === null) {
                return;
            }

            if ($retro->timer_paused_seconds === null) {
                return;
            }

            throw ModelInvariantViolation::because($retro, 'a timer either runs or is paused, never both');
        });
```

- Methods, after `voteLimit()`:

```php
    /**
     * The cap in force: an automatic vote limit below the stored cap wins.
     */
    public function maxVotesPerCard(): ?int
    {
        if ($this->max_votes_per_card === null) {
            return null;
        }

        return min($this->max_votes_per_card, $this->voteLimit());
    }

    /** @return array<int, string> */
    public function votingFinishedIds(): array
    {
        /** @var array<int, string> $ids */
        $ids = $this->participants()->whereNotNull('voting_finished_at')->orderBy('id')->pluck('id')->all();

        return $ids;
    }

    /** @return HasMany<TopicNote, $this> */
    public function topicNotes(): HasMany
    {
        return $this->hasMany(TopicNote::class);
    }
```

`app/Models/Card.php`: `@property Carbon|null $discussed_at`; `Fillable` adds `'discussed_at'`; `casts()` adds `'discussed_at' => 'datetime'`; relation:

```php
    /** @return HasOne<TopicNote, $this> */
    public function note(): HasOne
    {
        return $this->hasOne(TopicNote::class);
    }
```

`app/Models/Participant.php`: `@property Carbon|null $voting_finished_at`, `@property Carbon|null $writing_until`; `Fillable` adds `'voting_finished_at', 'writing_until'`; add `casts()` (or extend it) with `'voting_finished_at' => 'datetime'`, `'writing_until' => 'datetime'`; method:

```php
    public function hasFinishedVoting(): bool
    {
        return $this->voting_finished_at !== null;
    }
```

`app/Models/ActionItem.php`: `@property string|null $card_id`; `Fillable` adds `'card_id'`; relation `card(): BelongsTo` to `Card::class`.

- [ ] **Step 5: Event, presenters, snapshot, phase rules**

`app/Events/Retros/TimerChanged.php` becomes:

```php
<?php

namespace App\Events\Retros;

use App\Models\Retro;

class TimerChanged extends RetroBroadcastEvent
{
    public function __construct(
        string $retroId,
        public ?string $timerEndsAt,
        public ?int $timerPausedSeconds = null,
        public ?int $topicSeconds = null,
    ) {
        parent::__construct($retroId);
    }

    public static function of(Retro $retro): self
    {
        return new self($retro->id, $retro->timer_ends_at?->toIso8601String(), $retro->timer_paused_seconds, $retro->topic_seconds);
    }

    public function broadcastAs(): string
    {
        return 'timer.changed';
    }

    /**
     * @return array{
     *     timerEndsAt: ?string,
     *     timerPausedSeconds: ?int,
     *     topicSeconds: ?int
     * }
     */
    public function broadcastWith(): array
    {
        return [
            'timerEndsAt' => $this->timerEndsAt,
            'timerPausedSeconds' => $this->timerPausedSeconds,
            'topicSeconds' => $this->topicSeconds,
        ];
    }
}
```

In `RetroTimersController` and `RetroTimerExtensionsController`, replace `(new TimerChanged($locked->id, …))->sendToOthers()` with `TimerChanged::of($locked)->sendToOthers()` after the update. Existing assertions on `$event->timerEndsAt` keep passing. Every other caller of `new TimerChanged(` (search `app/`) moves to `TimerChanged::of` in the same way.

`app/Actions/Retros/PresentTopicNote.php`:

```php
<?php

namespace App\Actions\Retros;

use App\Models\TopicNote;

class PresentTopicNote
{
    /**
     * Who wrote the note is not sent: the notes belong to the room.
     *
     * @return array{
     *     cardId: string,
     *     body: string,
     *     version: int,
     *     updatedAt: ?string
     * }
     */
    public function handle(?TopicNote $note, string $cardId): array
    {
        return [
            'cardId' => $cardId,
            'body' => $note === null ? '' : $note->body,
            'version' => $note === null ? 0 : $note->version,
            'updatedAt' => $note?->updated_at?->toIso8601String(),
        ];
    }
}
```

`PresentCard::handle`: add `'discussedAt' => $card->discussed_at?->toIso8601String()` to the array it returns (the docblock shape gains `discussedAt: ?string`). `PresentActionItem::handle`: add `'cardId' => $item->card_id` after `'retroId'` (docblock too).

`BuildBoardSnapshot`:
- inject `PresentTopicNote $presentTopicNote` and `SummarizeRoti $summarizeRoti` in the constructor;
- `$retro->loadMissing([... 'topicNotes'])`;
- in `'retro' => [...]`, after `'timerEndsAt'`: `'timerPausedSeconds' => $retro->timer_paused_seconds`, `'topicSeconds' => $retro->topic_seconds`; after `'votesAuto'`: `'maxVotesPerCard' => $retro->maxVotesPerCard()`, `'maxVotesPerCardSetting' => $retro->max_votes_per_card`;
- new top-level keys after `'writersCount'`: `'voting' => ['finishedIds' => $retro->votingFinishedIds()]`, and `'topicNotes' => $retro->topicNotes->sortBy('card_id')->map(fn (TopicNote $note): array => $this->presentTopicNote->handle($note, $note->card_id))->values()->all()`;
- `roti()` returns two more keys:

```php
            'revealed' => $retro->roti_revealed_at !== null,
            'results' => $retro->roti_revealed_at !== null || $retro->phase === RetroPhase::Completed
                ? $this->summarizeRoti->handle($retro)
                : null,
```

(its docblock gains `revealed: bool, results: ?array{distribution: array<int, array{score: int, count: int}>, average: ?float, respondents: int}`).

`ChangeRetroPhase`: `move()` writes

```php
        $locked->update([
            'phase' => $phase,
            'highlighted_card_id' => $keepsHighlight ? $locked->highlighted_card_id : null,
            'completed_at' => $isCompleting ? now() : null,
            'timer_ends_at' => $isCompleting ? null : $locked->timer_ends_at,
            'timer_paused_seconds' => $isCompleting ? null : $locked->timer_paused_seconds,
            'topic_seconds' => $isCompleting ? null : $locked->topic_seconds,
            'roti_revealed_at' => $phase === RetroPhase::Roti ? null : $locked->roti_revealed_at,
        ]);
```

and `handle()` calls, right after `move()`, a new private step:

```php
    /**
     * A voting round starts with nobody finished; going back to Voting is a new round.
     */
    private function resetVotingCompletion(Retro $locked, RetroPhase $phase): void
    {
        if ($phase !== RetroPhase::Voting) {
            return;
        }

        $locked->participants()->whereNotNull('voting_finished_at')->update(['voting_finished_at' => null]);
    }
```

(`participants` has no derived column: the query update is allowed by rule 9.)

- [ ] **Step 6: Test helpers**

At the end of the retro block of `tests/Pest.php` (after `retroGuestCookie`):

```php
function retroGuest(Retro $retro, string $secret = 'secret'): Participant
{
    $retro->forceFill(['guest_access_enabled' => true])->save();

    return Participant::factory()->guest($secret)->create(['retro_id' => $retro->id]);
}

/**
 * A top-level card of the retro: a topic once the retro discusses.
 *
 * @param  array<string, mixed>  $attributes
 */
function topicCard(Retro $retro, array $attributes = []): Card
{
    return Card::factory()->create(['retro_id' => $retro->id, ...$attributes]);
}
```

(import `App\Models\Card` if the file does not already.)

- [ ] **Step 7: Run the tests on PostgreSQL**

Run: `bin/test-db pgsql -- tests/Feature/Retros`.
Expected: PASS. A failing existing test that compares the exact key list of the snapshot, of a card payload or of an action item payload gets the new keys, and is named in the commit message.

- [ ] **Step 8: Gates and commit**

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/sail composer types:check
git add database/migrations/2026_10_21_100000_add_retro_facilitation_columns.php database/migrations/2026_10_21_100100_create_topic_notes_table.php app/Models database/factories/TopicNoteFactory.php app/Events/Retros/TimerChanged.php app/Actions/Retros app/Http/Controllers/Retros/RetroTimersController.php app/Http/Controllers/Retros/RetroTimerExtensionsController.php tests/Pest.php tests/Feature/Retros
git commit -m "feat(retro): facilitation columns, topic notes table, snapshot keys and phase rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

### Task 2 (lane T): Pause and resume the retro's timer (RT-2)

**Files:**
- Create: `app/Http/Controllers/Retros/RetroTimerPausesController.php`
- Modify: `app/Http/Controllers/Retros/RetroTimersController.php`, `RetroTimerExtensionsController.php`, `routes/web.php`, the four `lang/*.json`
- Test: `tests/Feature/Retros/TimerPauseTest.php`

Read first: `RetroTimersController`, `RetroTimerExtensionsController`, `ScheduleIcebreakerExpiry`, `CloseExpiredGameRound`, `tests/Feature/Retros/TimerExtensionTest.php` (the icebreaker fixture).

**Interfaces:**
- Consumes: `TimerChanged::of(Retro)` (Task 1); the invariant of the timer columns (Task 1).
- Produces: routes `retros.timer.pause.update` (`PUT retros/{retro}/timer/pause`) and `retros.timer.pause.destroy` (`DELETE …`); both answer `TimerChanged::of($retro)->broadcastWith()` (`timerEndsAt`, `timerPausedSeconds`, `topicSeconds`). `retros.timer.update` and `retros.timer.extension.store` answer the same three keys from now on (they answered `timerEndsAt` alone; the front reads the extra keys from Task 10).

- [ ] **Step 1: Write the failing test**

`tests/Feature/Retros/TimerPauseTest.php`:

```php
<?php

use App\Actions\Games\EnsureIcebreakerRoom;
use App\Enums\GameKind;
use App\Enums\RetroPhase;
use App\Events\Retros\TimerChanged;
use App\Jobs\CloseExpiredGameRound;
use App\Models\Retro;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    Event::fake();
});

it('pauses a running timer and resumes it for the seconds that were left', function () {
    $this->freezeTime();
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['timer_ends_at' => now()->addSeconds(272)]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)
        ->putJson(route('retros.timer.pause.update', $retro))
        ->assertOk()
        ->assertExactJson(['timerEndsAt' => null, 'timerPausedSeconds' => 272, 'topicSeconds' => null]);

    expect($retro->fresh()->timer_ends_at)->toBeNull()
        ->and($retro->fresh()->timer_paused_seconds)->toBe(272);
    Event::assertDispatched(fn (TimerChanged $event) => $event->broadcastWith() === ['timerEndsAt' => null, 'timerPausedSeconds' => 272, 'topicSeconds' => null]);

    $this->travel(10)->minutes();
    $expectedEnd = now()->addSeconds(272)->startOfSecond();

    $this->actingAs($user)
        ->deleteJson(route('retros.timer.pause.destroy', $retro))
        ->assertOk()
        ->assertJsonPath('timerEndsAt', $expectedEnd->toIso8601String())
        ->assertJsonPath('timerPausedSeconds', null);

    expect($retro->fresh()->timer_ends_at->timestamp)->toBe($expectedEnd->timestamp)
        ->and($retro->fresh()->timer_paused_seconds)->toBeNull();
});

it('rounds the paused seconds up and never pauses at zero', function () {
    $this->freezeTime();
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['timer_ends_at' => now()->addMilliseconds(400)]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->putJson(route('retros.timer.pause.update', $retro))->assertOk()->assertJsonPath('timerPausedSeconds', 1);
});

it('refuses to pause when no timer runs', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['timer_ends_at' => now()->subSecond()]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->putJson(route('retros.timer.pause.update', $retro))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['timer' => 'No timer is running.']);
});

it('refuses to pause the icebreaker timer', function () {
    $retro = Retro::factory()->withIcebreaker()->inPhase(RetroPhase::Icebreaker)->create(['timer_ends_at' => now()->addMinute()]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->putJson(route('retros.timer.pause.update', $retro))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['timer' => "The icebreaker's timer cannot be paused."]);
});

it('refuses to resume a timer that is not paused', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create();
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->deleteJson(route('retros.timer.pause.destroy', $retro))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['timer' => 'The timer is not paused.']);
});

it('keeps pause and resume for the facilitator of an open retro', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['timer_ends_at' => now()->addMinute()]);
    retroFacilitator($retro);
    [$member] = retroMember($retro);
    $guest = retroGuest($retro);

    $this->actingAs($member)->putJson(route('retros.timer.pause.update', $retro))->assertForbidden();
    $this->withCookies(retroGuestCookie($guest))->withCredentials()->putJson(route('retros.timer.pause.update', $retro))->assertForbidden();

    $completed = Retro::factory()->inPhase(RetroPhase::Completed)->create(['timer_paused_seconds' => 30]);
    [$facilitator] = retroFacilitator($completed);

    $this->actingAs($facilitator)->deleteJson(route('retros.timer.pause.destroy', $completed))->assertForbidden();
});

it('adds two minutes to a paused timer', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['timer_paused_seconds' => 30]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->postJson(route('retros.timer.extension.store', $retro))
        ->assertOk()
        ->assertJsonPath('timerPausedSeconds', 150)
        ->assertJsonPath('timerEndsAt', null);

    expect($retro->fresh()->timer_paused_seconds)->toBe(150);
});

it('refuses to extend a paused timer past two hours', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['timer_paused_seconds' => 7081]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->postJson(route('retros.timer.extension.store', $retro))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('timer');
});

it('clears a pause when a new timer starts or the timer stops', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create(['timer_paused_seconds' => 30]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->putJson(route('retros.timer.update', $retro), ['seconds' => 300])
        ->assertOk()
        ->assertJsonPath('timerPausedSeconds', null);

    expect($retro->fresh()->timer_paused_seconds)->toBeNull();

    $retro->update(['timer_ends_at' => null, 'timer_paused_seconds' => 30]);

    $this->actingAs($user)->putJson(route('retros.timer.update', $retro), ['seconds' => null])->assertOk();

    expect($retro->fresh()->only(['timer_ends_at', 'timer_paused_seconds']))->toBe(['timer_ends_at' => null, 'timer_paused_seconds' => null]);
});

it('schedules the icebreaker round when a timer paused elsewhere is resumed in the icebreaker', function () {
    Queue::fake();
    $retro = Retro::factory()->withIcebreaker()->inPhase(RetroPhase::Icebreaker)->create([
        'icebreaker_game' => GameKind::Hangman,
        'timer_paused_seconds' => 90,
    ]);
    [$user] = retroFacilitator($retro);
    $room = resolve(EnsureIcebreakerRoom::class)->handle($retro->fresh());
    $round = activeGameRound($room);

    $this->actingAs($user)->deleteJson(route('retros.timer.pause.destroy', $retro))->assertOk();

    $endsAt = $retro->fresh()->timer_ends_at;

    Queue::assertPushed(CloseExpiredGameRound::class, fn (CloseExpiredGameRound $job) => $job->roundId === $round->id
        && CarbonImmutable::parse($job->timerEndsAt)->equalTo($endsAt));
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `bin/test-db pgsql -- tests/Feature/Retros/TimerPauseTest.php`
Expected: FAIL (route `retros.timer.pause.update` not defined).

- [ ] **Step 3: Controller and routes**

`app/Http/Controllers/Retros/RetroTimerPausesController.php`:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Games\ScheduleIcebreakerExpiry;
use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\TimerChanged;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The pause of the retro's timer: `update` pauses, `destroy` resumes. The
 * icebreaker's timer is the game's round clock and is never paused.
 */
class RetroTimerPausesController extends Controller
{
    public function update(Request $request, Retro $retro): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::facilitator($retro, $participant);
        RetroGuard::open($retro);

        $paused = DB::transaction(function () use ($retro, $participant): Retro {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::facilitator($locked, $participant);
            RetroGuard::open($locked);

            if ($locked->phase === RetroPhase::Icebreaker) {
                throw ValidationException::withMessages(['timer' => __("The icebreaker's timer cannot be paused.")]);
            }

            if ($locked->timer_ends_at === null || ! $locked->timer_ends_at->isFuture()) {
                throw ValidationException::withMessages(['timer' => __('No timer is running.')]);
            }

            $seconds = max(1, (int) ceil(now()->diffInMilliseconds($locked->timer_ends_at, true) / 1000));

            $locked->update(['timer_ends_at' => null, 'timer_paused_seconds' => $seconds]);

            TimerChanged::of($locked)->sendToOthers();

            return $locked;
        });

        return response()->json(TimerChanged::of($paused)->broadcastWith());
    }

    public function destroy(Request $request, Retro $retro, ScheduleIcebreakerExpiry $scheduleIcebreakerExpiry): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::facilitator($retro, $participant);
        RetroGuard::open($retro);

        $resumed = DB::transaction(function () use ($retro, $participant, $scheduleIcebreakerExpiry): Retro {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::facilitator($locked, $participant);
            RetroGuard::open($locked);

            if ($locked->timer_paused_seconds === null) {
                throw ValidationException::withMessages(['timer' => __('The timer is not paused.')]);
            }

            $locked->update([
                'timer_ends_at' => now()->addSeconds($locked->timer_paused_seconds)->startOfSecond(),
                'timer_paused_seconds' => null,
            ]);

            TimerChanged::of($locked)->sendToOthers();

            $scheduleIcebreakerExpiry->handle($locked);

            return $locked;
        });

        return response()->json(TimerChanged::of($resumed)->broadcastWith());
    }
}
```

`routes/web.php`, in the `retros/{retro}` group after `retros.timer.extension.store`:

```php
        Route::put('timer/pause', [RetroTimerPausesController::class, 'update'])->name('retros.timer.pause.update');
        Route::delete('timer/pause', [RetroTimerPausesController::class, 'destroy'])->name('retros.timer.pause.destroy');
```

- [ ] **Step 4: Start, stop and "+2 min" know the pause**

`RetroTimersController@update`: the update becomes `$locked->update(['timer_ends_at' => $endsAt, 'timer_paused_seconds' => null]);` and the response `response()->json(TimerChanged::of($locked)->broadcastWith())` (return `$locked` from the transaction closure as Task 1 left it).

`RetroTimerExtensionsController@store`: inside the transaction, before the "No timer is running" check:

```php
            if ($locked->timer_paused_seconds !== null) {
                $paused = $locked->timer_paused_seconds + self::ExtensionSeconds;

                if ($paused > RetroTimersController::MaxSeconds) {
                    throw ValidationException::withMessages(['timer' => __('A timer cannot run longer than two hours.')]);
                }

                $locked->update(['timer_paused_seconds' => $paused]);

                TimerChanged::of($locked)->sendToOthers();

                return $locked;
            }
```

and the closure returns `$locked` in both branches (type `Retro`); the response becomes `response()->json(TimerChanged::of($extended)->broadcastWith())`. `TimerExtensionTest` keeps passing: it reads `timerEndsAt`, which is still there.

- [ ] **Step 5: Translations**

Add to the four `lang/*.json` (values in Task 19): `The icebreaker's timer cannot be paused.`, `The timer is not paused.`

- [ ] **Step 6: Run the tests on PostgreSQL**

Run: `bin/test-db pgsql -- tests/Feature/Retros/TimerPauseTest.php tests/Feature/Retros/TimerExtensionTest.php tests/Feature/Retros/FacilitationTest.php`.
Expected: PASS.

- [ ] **Step 7: Gates and commit**

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/sail composer types:check
git add app/Http/Controllers/Retros routes/web.php lang tests/Feature/Retros/TimerPauseTest.php
git commit -m "feat(retro): pause and resume the retro's timer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

### Task 3 (lane T): Time per topic and the "discussed" mark (RT-5, RT-7)

**Files:**
- Create: `app/Actions/Retros/MoveTopicFocus.php`, `app/Events/Retros/TopicDiscussed.php`, `app/Http/Controllers/Retros/CardDiscussionsController.php`
- Modify: `app/Http/Controllers/Retros/RetroHighlightsController.php`, `RetroTimersController.php`, `routes/web.php`, the four `lang/*.json`
- Test: `tests/Feature/Retros/TopicTimerTest.php`, `tests/Feature/Retros/TopicDiscussedTest.php`

Read first: `RetroHighlightsController`, `CardHighlighted`, `lib/retro/topics.ts` (what a topic is on the front).

**Interfaces:**
- Consumes: `TimerChanged::of` (Task 1), `cards.discussed_at`, `retros.topic_seconds` (Task 1).
- Produces: `MoveTopicFocus::handle(Retro $locked, ?string $cardId): array{timer: array{timerEndsAt: ?string, timerPausedSeconds: ?int, topicSeconds: ?int}, discussed: ?array{cardId: string, discussedAt: string}}`; `TopicDiscussed(string $retroId, string $cardId, ?string $discussedAt)`, name `topic.discussed`; `retros.highlight.update` answers `highlightedCardId`, `timer` and `discussed`; routes `retros.cards.discussion.update|destroy` answering `{cardId, discussedAt}`.

- [ ] **Step 1: Write the failing tests**

`tests/Feature/Retros/TopicTimerTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Events\Retros\TimerChanged;
use App\Models\Retro;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('remembers the duration started in Discussing as the time per topic', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->putJson(route('retros.timer.update', $retro), ['seconds' => 300])
        ->assertOk()
        ->assertJsonPath('topicSeconds', 300);

    expect($retro->fresh()->topic_seconds)->toBe(300);

    $this->actingAs($user)->putJson(route('retros.timer.update', $retro), ['seconds' => null])
        ->assertOk()
        ->assertJsonPath('topicSeconds', null);

    expect($retro->fresh()->topic_seconds)->toBeNull();
});

it('leaves the time per topic alone when a timer starts in another phase', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Actions)->create(['topic_seconds' => 300]);
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->putJson(route('retros.timer.update', $retro), ['seconds' => 60])->assertOk();

    expect($retro->fresh()->topic_seconds)->toBe(300);
});

it('restarts the timer for the time per topic when the shared topic changes', function () {
    $this->freezeTime();
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create(['topic_seconds' => 300, 'timer_paused_seconds' => 12]);
    [$user] = retroFacilitator($retro);
    $first = topicCard($retro);
    $second = topicCard($retro);
    $retro->update(['highlighted_card_id' => $first->id]);
    $expectedEnd = now()->addSeconds(300)->startOfSecond()->toIso8601String();

    $this->actingAs($user)->putJson(route('retros.highlight.update', $retro), ['card_id' => $second->id])
        ->assertOk()
        ->assertJsonPath('highlightedCardId', $second->id)
        ->assertJsonPath('timer', ['timerEndsAt' => $expectedEnd, 'timerPausedSeconds' => null, 'topicSeconds' => 300]);

    expect($retro->fresh()->timer_paused_seconds)->toBeNull();
    Event::assertDispatched(fn (TimerChanged $event) => $event->timerEndsAt === $expectedEnd);
});

it('restarts nothing without a time per topic, on a cleared highlight, on the same topic or in Actions', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroFacilitator($retro);
    $first = topicCard($retro);
    $second = topicCard($retro);

    $this->actingAs($user)->putJson(route('retros.highlight.update', $retro), ['card_id' => $first->id])->assertOk();

    $retro->update(['topic_seconds' => 300]);

    $this->actingAs($user)->putJson(route('retros.highlight.update', $retro), ['card_id' => $first->id])->assertOk();
    $this->actingAs($user)->putJson(route('retros.highlight.update', $retro), ['card_id' => null])->assertOk();

    $retro->update(['phase' => RetroPhase::Actions]);

    $this->actingAs($user)->putJson(route('retros.highlight.update', $retro), ['card_id' => $second->id])->assertOk();

    Event::assertNotDispatched(TimerChanged::class);
    expect($retro->fresh()->timer_ends_at)->toBeNull();
});
```

`tests/Feature/Retros/TopicDiscussedTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Events\Retros\TopicDiscussed;
use App\Models\Card;
use App\Models\Retro;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('marks the topic left as discussed when the shared topic moves on in Discussing', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroFacilitator($retro);
    $first = topicCard($retro);
    $second = topicCard($retro);
    $retro->update(['highlighted_card_id' => $first->id]);

    $response = $this->actingAs($user)->putJson(route('retros.highlight.update', $retro), ['card_id' => $second->id])->assertOk();

    expect($first->fresh()->discussed_at)->not->toBeNull()
        ->and($second->fresh()->discussed_at)->toBeNull()
        ->and($response->json('discussed.cardId'))->toBe($first->id);
    Event::assertDispatched(fn (TopicDiscussed $event) => $event->cardId === $first->id && $event->discussedAt !== null);
});

it('keeps the first mark of a topic discussed twice', function () {
    $this->freezeTime();
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroFacilitator($retro);
    $first = topicCard($retro, ['discussed_at' => now()->subMinutes(10)]);
    $second = topicCard($retro);
    $retro->update(['highlighted_card_id' => $first->id]);

    $this->actingAs($user)->putJson(route('retros.highlight.update', $retro), ['card_id' => $second->id])
        ->assertOk()
        ->assertJsonPath('discussed', null);

    expect($first->fresh()->discussed_at->timestamp)->toBe(now()->subMinutes(10)->timestamp);
    Event::assertNotDispatched(TopicDiscussed::class);
});

it('marks nothing in Actions or when the highlight is cleared', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroFacilitator($retro);
    $first = topicCard($retro);
    $second = topicCard($retro);
    $retro->update(['highlighted_card_id' => $first->id]);

    $this->actingAs($user)->putJson(route('retros.highlight.update', $retro), ['card_id' => null])->assertOk();

    $retro->update(['phase' => RetroPhase::Actions, 'highlighted_card_id' => $first->id]);

    $this->actingAs($user)->putJson(route('retros.highlight.update', $retro), ['card_id' => $second->id])->assertOk();

    expect($first->fresh()->discussed_at)->toBeNull();
});

it('lets the facilitator mark and unmark a topic by hand in Discussing and Actions', function (RetroPhase $phase) {
    $retro = Retro::factory()->inPhase($phase)->create();
    [$user] = retroFacilitator($retro);
    $topic = topicCard($retro);

    $this->actingAs($user)->putJson(route('retros.cards.discussion.update', [$retro, $topic]))
        ->assertOk()
        ->assertJsonPath('cardId', $topic->id);

    expect($topic->fresh()->discussed_at)->not->toBeNull();

    $this->actingAs($user)->deleteJson(route('retros.cards.discussion.destroy', [$retro, $topic]))
        ->assertOk()
        ->assertExactJson(['cardId' => $topic->id, 'discussedAt' => null]);

    expect($topic->fresh()->discussed_at)->toBeNull();
    Event::assertDispatched(fn (TopicDiscussed $event) => $event->cardId === $topic->id && $event->discussedAt === null);
})->with([RetroPhase::Discussing, RetroPhase::Actions]);

it('refuses the mark to a participant, in another phase, on a child card and on another retro\'s card', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$facilitator] = retroFacilitator($retro);
    [$member] = retroMember($retro);
    $topic = topicCard($retro);
    $child = topicCard($retro, ['parent_card_id' => $topic->id]);
    $elsewhere = Card::factory()->create();

    $this->actingAs($member)->putJson(route('retros.cards.discussion.update', [$retro, $topic]))->assertForbidden();
    $this->actingAs($facilitator)->putJson(route('retros.cards.discussion.update', [$retro, $child]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('card');
    $this->actingAs($facilitator)->putJson(route('retros.cards.discussion.update', [$retro, $elsewhere]))->assertNotFound();

    $retro->update(['phase' => RetroPhase::Voting]);

    $this->actingAs($facilitator)->putJson(route('retros.cards.discussion.update', [$retro, $topic]))->assertForbidden();
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `bin/test-db pgsql -- tests/Feature/Retros/TopicTimerTest.php tests/Feature/Retros/TopicDiscussedTest.php`
Expected: FAIL.

- [ ] **Step 3: Event, action, controllers, routes**

`app/Events/Retros/TopicDiscussed.php`:

```php
<?php

namespace App\Events\Retros;

class TopicDiscussed extends RetroBroadcastEvent
{
    public function __construct(string $retroId, public string $cardId, public ?string $discussedAt)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'topic.discussed';
    }

    public function broadcastWith(): array
    {
        return ['cardId' => $this->cardId, 'discussedAt' => $this->discussedAt];
    }
}
```

`app/Actions/Retros/MoveTopicFocus.php`:

```php
<?php

namespace App\Actions\Retros;

use App\Enums\RetroPhase;
use App\Events\Retros\CardHighlighted;
use App\Events\Retros\TimerChanged;
use App\Events\Retros\TopicDiscussed;
use App\Models\Retro;

/**
 * The shared topic changes. In Discussing, moving from one topic to another
 * marks the topic left as discussed and restarts the timer for the time per
 * topic, when there is one.
 */
class MoveTopicFocus
{
    /**
     * Runs inside the caller's transaction, on the retro row locked for update.
     *
     * @return array{
     *     timer: array{timerEndsAt: ?string, timerPausedSeconds: ?int, topicSeconds: ?int},
     *     discussed: ?array{cardId: string, discussedAt: string}
     * }
     */
    public function handle(Retro $locked, ?string $cardId): array
    {
        $previous = $locked->highlighted_card_id;

        $locked->update(['highlighted_card_id' => $cardId]);

        (new CardHighlighted($locked->id, $cardId))->sendToOthers();

        if (! $this->movesOn($locked, $previous, $cardId)) {
            return ['timer' => TimerChanged::of($locked)->broadcastWith(), 'discussed' => null];
        }

        $discussed = $this->markLeftTopic($locked, (string) $previous);

        $this->restartTopicTimer($locked);

        return ['timer' => TimerChanged::of($locked)->broadcastWith(), 'discussed' => $discussed];
    }

    private function movesOn(Retro $locked, ?string $previous, ?string $cardId): bool
    {
        if ($locked->phase !== RetroPhase::Discussing) {
            return false;
        }

        if ($previous === null) {
            return $cardId !== null && $locked->topic_seconds !== null;
        }

        if ($cardId === null) {
            return false;
        }

        return $cardId !== $previous;
    }

    /**
     * @return ?array{cardId: string, discussedAt: string}
     */
    private function markLeftTopic(Retro $locked, string $previous): ?array
    {
        if ($previous === '') {
            return null;
        }

        $topic = $locked->cards()->whereKey($previous)->whereNull('parent_card_id')->whereNull('discussed_at')->first();

        if ($topic === null) {
            return null;
        }

        $topic->update(['discussed_at' => now()]);

        $discussedAt = (string) $topic->discussed_at?->toIso8601String();

        (new TopicDiscussed($locked->id, $topic->id, $discussedAt))->sendToOthers();

        return ['cardId' => $topic->id, 'discussedAt' => $discussedAt];
    }

    private function restartTopicTimer(Retro $locked): void
    {
        if ($locked->topic_seconds === null) {
            return;
        }

        $locked->update([
            'timer_ends_at' => now()->addSeconds($locked->topic_seconds)->startOfSecond(),
            'timer_paused_seconds' => null,
        ]);

        TimerChanged::of($locked)->sendToOthers();
    }
}
```

Note on `movesOn`: the first highlight of the discussion (no previous topic) starts the topic timer when a time per topic is set, and marks nothing (`markLeftTopic` receives `''`).

`RetroHighlightsController@update`: inject `MoveTopicFocus $moveTopicFocus`; inside the transaction replace the update and the broadcast with `return $moveTopicFocus->handle($locked, $validated['card_id']);` (the closure returns the array); the response becomes `response()->json(['highlightedCardId' => $validated['card_id'], ...$moved])`.

`RetroTimersController@update`: inside the transaction, after the guards, before the update:

```php
            $topicSeconds = $locked->phase === RetroPhase::Discussing
                ? $validated['seconds']
                : $locked->topic_seconds;
```

and the update writes `'topic_seconds' => $topicSeconds === null ? null : (int) $topicSeconds` with the other two columns (pass `$validated` into the closure).

`app/Http/Controllers/Retros/CardDiscussionsController.php`:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\TopicDiscussed;
use App\Http\Controllers\Controller;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The facilitator's "Discussed" mark on a topic: `update` marks, `destroy` unmarks.
 */
class CardDiscussionsController extends Controller
{
    public function update(Request $request, Retro $retro, Card $card): JsonResponse
    {
        return response()->json($this->mark($request, $retro, $card, true));
    }

    public function destroy(Request $request, Retro $retro, Card $card): JsonResponse
    {
        return response()->json($this->mark($request, $retro, $card, false));
    }

    /**
     * @return array{cardId: string, discussedAt: ?string}
     */
    private function mark(Request $request, Retro $retro, Card $card, bool $discussed): array
    {
        $participant = Participant::current($request);

        RetroGuard::facilitator($retro, $participant);
        RetroGuard::phase($retro, RetroPhase::Discussing, RetroPhase::Actions);

        return DB::transaction(function () use ($retro, $card, $participant, $discussed): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::facilitator($locked, $participant);
            RetroGuard::phase($locked, RetroPhase::Discussing, RetroPhase::Actions);

            $topic = $locked->cards()->whereKey($card->id)->firstOrFail();

            if (! $topic->isTopLevel()) {
                throw ValidationException::withMessages(['card' => __('Only a topic can be marked as discussed.')]);
            }

            $topic->update(['discussed_at' => $discussed ? ($topic->discussed_at ?? now()) : null]);

            $discussedAt = $topic->discussed_at?->toIso8601String();

            (new TopicDiscussed($locked->id, $topic->id, $discussedAt))->sendToOthers();

            return ['cardId' => $topic->id, 'discussedAt' => $discussedAt];
        });
    }
}
```

`routes/web.php`, after the `retros.timer.pause.*` lines:

```php
        Route::put('cards/{card}/discussion', [CardDiscussionsController::class, 'update'])->name('retros.cards.discussion.update')->whereUuid('card');
        Route::delete('cards/{card}/discussion', [CardDiscussionsController::class, 'destroy'])->name('retros.cards.discussion.destroy')->whereUuid('card');
```

The 404 for another retro's card comes from `$locked->cards()->whereKey(...)->firstOrFail()`.

- [ ] **Step 4: Translations**

`Only a topic can be marked as discussed.`

- [ ] **Step 5: Run the tests on PostgreSQL**

Run: `bin/test-db pgsql -- tests/Feature/Retros/TopicTimerTest.php tests/Feature/Retros/TopicDiscussedTest.php tests/Feature/Retros/TimerPauseTest.php tests/Feature/Retros/FacilitationTest.php tests/Feature/Retros/ActionsPhaseTest.php`.
Expected: PASS. An existing test that asserted the exact JSON of `retros.highlight.update` (`assertExactJson(['highlightedCardId' => …])`) moves to `assertJsonPath('highlightedCardId', …)`; name it in the commit.

- [ ] **Step 6: Gates and commit**

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/sail composer types:check
git add app/Actions/Retros/MoveTopicFocus.php app/Events/Retros/TopicDiscussed.php app/Http/Controllers/Retros routes/web.php lang tests/Feature/Retros
git commit -m "feat(retro): time per topic and the discussed mark

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

### Task 4 (lane V): Maximum votes per card (RT-3)

**Files:**
- Modify: `app/Http/Controllers/Retros/CardVotesController.php`, `RetroSettingsController.php`, `app/Http/Controllers/TeamRetrosController.php`, `app/Actions/Retros/NewRetro.php`, `CreateRetro.php`, the four `lang/*.json`
- Test: `tests/Feature/Retros/MaxVotesPerCardTest.php`, `tests/Concurrency/MaxVotesPerCardTest.php`

Read first: `CardVotesController@store` (the budget check under the retro's lock), `NewRetro` (a value object built with named arguments by `TeamRetrosController` and possibly by an MCP tool: search `new NewRetro(` in `app/`), `CreateRetro::handle`, `RetroSettingsController@update` (the phase guard of `votes_per_participant`).

**Interfaces:**
- Consumes: `Retro::maxVotesPerCard(): ?int` (Task 1).
- Produces: field `max_votes_per_card` (nullable integer, 1 to 20) on `teams.retros.store` and `retros.settings.update`; `NewRetro::$maxVotesPerCard` (`?int`, default `null`, last constructor argument); the 422 `votes` of the cap.

- [ ] **Step 1: Write the failing tests**

`tests/Feature/Retros/MaxVotesPerCardTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Models\Card;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Vote;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

/**
 * @return array{0: Retro, 1: User, 2: Card}
 */
function cappedRetro(int $cap, int $votes = 5): array
{
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['votes_per_participant' => $votes, 'max_votes_per_card' => $cap]);
    [$user] = retroMember($retro);

    return [$retro, $user, topicCard($retro)];
}

it('refuses a vote beyond the cap on one card and accepts it on another', function () {
    [$retro, $user, $card] = cappedRetro(2);
    $other = topicCard($retro);

    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))->assertCreated();
    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))->assertCreated();
    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['votes' => 'You can put at most 2 votes on one card.']);
    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $other]))->assertCreated();

    expect(Vote::query()->where('card_id', $card->id)->count())->toBe(2);
});

it('says one vote per card in the singular', function () {
    [$retro, $user, $card] = cappedRetro(1);

    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))->assertCreated();
    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['votes' => 'You can put only one vote on a card.']);
});

it('counts the cap per participant', function () {
    [$retro, $user, $card] = cappedRetro(1);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id]);

    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))->assertCreated();
});

it('lets an automatic vote limit below the cap win', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['votes_per_participant' => null, 'max_votes_per_card' => 9]);
    [$user] = retroMember($retro);
    $card = topicCard($retro);

    foreach (range(1, 4) as $vote) {
        $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))->assertCreated();
    }

    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['votes' => 'You have no votes left.']);
});

it('creates a retro with a cap per card', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);

    $this->actingAs($user)
        ->post(route('teams.retros.store', [$team->workspace, $team]), [
            'title' => 'Sprint 43 retro',
            'template' => 'start_stop_continue',
            'votes_per_participant' => 5,
            'max_votes_per_card' => 2,
        ])
        ->assertRedirect();

    expect(Retro::query()->sole()->max_votes_per_card)->toBe(2);
});

it('changes the cap until Grouping and refuses it from Voting on', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Grouping)->create();
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->patchJson(route('retros.settings.update', $retro), ['max_votes_per_card' => 3])->assertNoContent();

    expect($retro->fresh()->max_votes_per_card)->toBe(3);

    $this->actingAs($user)->patchJson(route('retros.settings.update', $retro), ['max_votes_per_card' => null])->assertNoContent();

    expect($retro->fresh()->max_votes_per_card)->toBeNull();

    $retro->update(['phase' => RetroPhase::Voting]);

    $this->actingAs($user)->patchJson(route('retros.settings.update', $retro), ['max_votes_per_card' => 2])->assertForbidden();
});

it('validates the cap', function (mixed $value) {
    $retro = Retro::factory()->inPhase(RetroPhase::Writing)->create();
    [$user] = retroFacilitator($retro);

    $this->actingAs($user)->patchJson(route('retros.settings.update', $retro), ['max_votes_per_card' => $value])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('max_votes_per_card');
})->with([0, 21, 'two']);
```

(`teamMember` is the existing helper of `tests/Pest.php`; check that `createRetro` on the team is allowed for a plain member, as `CreateRetroTest` does, and use the same fixture if it needs more.)

`tests/Concurrency/MaxVotesPerCardTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Models\Card;
use App\Models\Retro;
use App\Models\Vote;
use Tests\Concurrency\Support\Race;

it('never puts more votes of one participant on one card than the cap', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['votes_per_participant' => 8, 'max_votes_per_card' => 2]);
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    $userId = $user->id;
    $uri = route('retros.cards.votes.store', [$retro, $card], false);

    $outcomes = Race::run(array_fill(0, 6, static fn (): int => Race::request($userId, 'POST', $uri)));

    $statuses = array_count_values(array_column($outcomes, 'value'));

    // Protection: the cap is checked under the retro's row lock (CardVotesController@store).
    expect(array_column($outcomes, 'ok'))->each->toBeTrue()
        ->and(Vote::query()->where('participant_id', $participant->id)->where('card_id', $card->id)->count())->toBe(2)
        ->and($statuses[201] ?? 0)->toBe(2)
        ->and($statuses[422] ?? 0)->toBe(4);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `bin/test-db pgsql -- tests/Feature/Retros/MaxVotesPerCardTest.php`
Expected: FAIL (third vote accepted; unknown field).

- [ ] **Step 3: Implementation**

`CardVotesController@store`, inside the transaction, right after the budget check (`if ($used >= $locked->voteLimit())`):

```php
            $cap = $locked->maxVotesPerCard();

            if ($cap !== null && $locked->votes()->where('participant_id', $participant->id)->where('card_id', $card->id)->count() >= $cap) {
                throw ValidationException::withMessages(['votes' => $cap === 1
                    ? __('You can put only one vote on a card.')
                    : __('You can put at most :count votes on one card.', ['count' => $cap])]);
            }
```

`RetroSettingsController@update`: the rules gain `'max_votes_per_card' => ['sometimes', 'nullable', 'integer', 'min:1', 'max:20']`; the phase guard becomes:

```php
            if (array_key_exists('votes_per_participant', $validated) || array_key_exists('max_votes_per_card', $validated)) {
                RetroGuard::phase($locked, RetroPhase::Icebreaker, RetroPhase::Writing, RetroPhase::Grouping);
            }
```

`TeamRetrosController@store`: the rules gain `'max_votes_per_card' => ['nullable', 'integer', 'min:1', 'max:20']`; `new NewRetro(…)` gains `maxVotesPerCard: isset($validated['max_votes_per_card']) ? (int) $validated['max_votes_per_card'] : null`.

`NewRetro`: a promoted property `public ?int $maxVotesPerCard = null` as the last constructor parameter. `CreateRetro::handle`: the retro is created with `'max_votes_per_card' => $new->maxVotesPerCard` beside `votes_per_participant` (read the method: follow how it passes `votesPerParticipant`).

- [ ] **Step 4: Translations**

`You can put only one vote on a card.`, `You can put at most :count votes on one card.`

- [ ] **Step 5: Run the tests on PostgreSQL, and the race**

Run: `bin/test-db pgsql -- tests/Feature/Retros/MaxVotesPerCardTest.php tests/Feature/Retros/VotingTest.php tests/Feature/Retros/CreateRetroTest.php`.
Run: `bin/test-db pgsql --concurrency -- tests/Concurrency/MaxVotesPerCardTest.php`.
Expected: PASS.

- [ ] **Step 6: Gates and commit**

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/sail composer types:check
git add app/Http/Controllers app/Actions/Retros/NewRetro.php app/Actions/Retros/CreateRetro.php lang tests/Feature/Retros/MaxVotesPerCardTest.php tests/Concurrency/MaxVotesPerCardTest.php
git commit -m "feat(retro): a cap on the votes one person puts on one card

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

### Task 5 (lane V): "I have finished voting" (RT-4, decision 10 B)

**Files:**
- Create: `app/Events/Retros/VotingFinishedChanged.php`, `app/Http/Controllers/Retros/VotingCompletionsController.php`
- Modify: `app/Http/Controllers/Retros/CardVotesController.php`, `routes/web.php`
- Test: `tests/Feature/Retros/VotingCompletionTest.php`, `tests/Concurrency/VotingCompletionTest.php`

Read first: `CardVotesController` on the lane's head (both transactions run with `Transactions::Attempts`; `store` already locks the participant row after the retro, `destroy` does not; `tally()` builds the answer outside the transaction; Task 4 added the cap check in `store`). `RetroBroadcastEvent` implements `ShouldDispatchAfterCommit`, so an event sent inside a retried transaction leaves only once, after the commit that succeeds.

**Interfaces:**
- Consumes: `participants.voting_finished_at`, `Participant::hasFinishedVoting()`, `Retro::votingFinishedIds()` (Task 1); the reset on entering Voting (Task 1).
- Produces: routes `retros.votingCompletion.update` (`PUT retros/{retro}/voting-completion`) and `retros.votingCompletion.destroy` (`DELETE …`), both answering `{finishedIds: string[]}`; event `VotingFinishedChanged(string $retroId, array $finishedIds)`, name `voting.finished`; the vote answer of `retros.cards.votes.store|destroy` gains `finishedIds: string[] | null` (the new list when the vote took "finished" back, null otherwise).

Owner's answer (decision 10, B): a participant who has finished may still vote; casting or retracting a vote takes "finished" back in the same transaction. There is no 422 for "finished" and no new string on the server.

- [ ] **Step 1: Write the failing tests**

`tests/Feature/Retros/VotingCompletionTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Events\Retros\VotingFinishedChanged;
use App\Models\Retro;
use App\Models\Vote;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('lets a participant finish voting and take it back', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create();
    [$user, $participant] = retroMember($retro);

    $this->actingAs($user)->putJson(route('retros.votingCompletion.update', $retro))
        ->assertOk()
        ->assertExactJson(['finishedIds' => [$participant->id]]);

    expect($participant->fresh()->hasFinishedVoting())->toBeTrue();
    Event::assertDispatched(fn (VotingFinishedChanged $event) => $event->broadcastWith() === ['finishedIds' => [$participant->id]]);

    $this->actingAs($user)->deleteJson(route('retros.votingCompletion.destroy', $retro))
        ->assertOk()
        ->assertExactJson(['finishedIds' => []]);

    expect($participant->fresh()->hasFinishedVoting())->toBeFalse();
});

it('lets a guest finish voting, also on a locked board', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['is_locked' => true]);
    $guest = retroGuest($retro);

    $this->withCookies(retroGuestCookie($guest))->withCredentials()
        ->putJson(route('retros.votingCompletion.update', $retro))
        ->assertOk()
        ->assertExactJson(['finishedIds' => [$guest->id]]);
});

it('refuses to finish outside the Voting phase', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroMember($retro);

    $this->actingAs($user)->putJson(route('retros.votingCompletion.update', $retro))->assertForbidden();
});

it('takes finished back when a finished participant casts a vote', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['votes_per_participant' => 3]);
    [$user, $participant] = retroMember($retro);
    [, $other] = retroMember($retro);
    $card = topicCard($retro);
    $participant->update(['voting_finished_at' => now()]);
    $other->update(['voting_finished_at' => now()]);

    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))
        ->assertCreated()
        ->assertJsonPath('myVotes', 1)
        ->assertJsonPath('finishedIds', [$other->id]);

    expect($participant->fresh()->hasFinishedVoting())->toBeFalse()
        ->and($other->fresh()->hasFinishedVoting())->toBeTrue();
    Event::assertDispatched(fn (VotingFinishedChanged $event) => $event->broadcastWith() === ['finishedIds' => [$other->id]]);
});

it('takes finished back when a finished participant retracts a vote', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['votes_per_participant' => 3]);
    [$user, $participant] = retroMember($retro);
    $card = topicCard($retro);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $participant->id]);
    $participant->update(['voting_finished_at' => now()]);

    $this->actingAs($user)->deleteJson(route('retros.cards.votes.destroy', [$retro, $card]))
        ->assertOk()
        ->assertJsonPath('myVotes', 0)
        ->assertJsonPath('finishedIds', []);

    expect($participant->fresh()->hasFinishedVoting())->toBeFalse();
});

it('answers a null finishedIds and sends nothing when the voter had not finished', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['votes_per_participant' => 3]);
    [$user] = retroMember($retro);
    $card = topicCard($retro);

    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))
        ->assertCreated()
        ->assertJsonPath('finishedIds', null);

    Event::assertNotDispatched(VotingFinishedChanged::class);
});

it('keeps finished when the vote is refused', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['votes_per_participant' => 1]);
    [$user, $participant] = retroMember($retro);
    $card = topicCard($retro);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $card->id, 'participant_id' => $participant->id]);
    $participant->update(['voting_finished_at' => now()]);

    $this->actingAs($user)->postJson(route('retros.cards.votes.store', [$retro, $card]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['votes' => 'You have no votes left.']);

    expect($participant->fresh()->hasFinishedVoting())->toBeTrue();
    Event::assertNotDispatched(VotingFinishedChanged::class);
});

it('lists who has finished in the order of their ids', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create();
    [$first, $one] = retroMember($retro);
    [$second, $two] = retroMember($retro);

    $this->actingAs($second)->putJson(route('retros.votingCompletion.update', $retro))->assertOk();
    $this->actingAs($first)->putJson(route('retros.votingCompletion.update', $retro))
        ->assertOk()
        ->assertExactJson(['finishedIds' => collect([$one->id, $two->id])->sort()->values()->all()]);
});
```

(If an existing test of `tests/Feature/Retros/VotingTest.php` compares the vote answer with `assertExactJson`, it gains `'finishedIds' => null`; list it in the commit message as an expectation changed by decision 10.)

`tests/Concurrency/VotingCompletionTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Models\Card;
use App\Models\Retro;
use App\Models\Vote;
use Tests\Concurrency\Support\Race;

it('leaves the participant finished only if the finish came after the vote', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['votes_per_participant' => 3]);
    [$user, $participant] = retroMember($retro);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    $userId = $user->id;
    $voteUri = route('retros.cards.votes.store', [$retro, $card], false);
    $finishUri = route('retros.votingCompletion.update', $retro, false);

    $outcomes = Race::run([
        'vote' => static fn (): int => Race::request($userId, 'POST', $voteUri),
        'finish' => static fn (): int => Race::request($userId, 'PUT', $finishUri),
    ]);

    $finishedAt = $participant->fresh()->voting_finished_at;
    $vote = Vote::query()->where('participant_id', $participant->id)->sole();

    // Protection: both lock the retro row first, then the participant; a vote that commits after the finish clears it.
    expect($outcomes['finish']['value'])->toBe(200)
        ->and($outcomes['vote']['value'])->toBe(201);

    if ($finishedAt !== null) {
        expect($vote->created_at->lte($finishedAt))->toBeTrue();
    }
});

it('never leaves a finished participant whose vote committed last', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Voting)->create(['votes_per_participant' => 8]);
    [$user, $participant] = retroMember($retro);
    $participant->update(['voting_finished_at' => now()]);
    $card = Card::factory()->create(['retro_id' => $retro->id]);
    $userId = $user->id;
    $voteUri = route('retros.cards.votes.store', [$retro, $card], false);

    $outcomes = Race::run(array_fill(0, 4, static fn (): int => Race::request($userId, 'POST', $voteUri)));

    // Protection: each vote clears the flag under the participant's row lock; no vote can re-set it.
    expect(array_column($outcomes, 'value'))->each->toBe(201)
        ->and($participant->fresh()->voting_finished_at)->toBeNull()
        ->and(Vote::query()->where('participant_id', $participant->id)->count())->toBe(4);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `bin/test-db pgsql -- tests/Feature/Retros/VotingCompletionTest.php`
Expected: FAIL (unknown routes; `finishedIds` missing from the vote answer).

- [ ] **Step 3: Implementation**

`app/Events/Retros/VotingFinishedChanged.php`:

```php
<?php

namespace App\Events\Retros;

class VotingFinishedChanged extends RetroBroadcastEvent
{
    /**
     * @param  array<int, string>  $finishedIds
     */
    public function __construct(string $retroId, public array $finishedIds)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'voting.finished';
    }

    public function broadcastWith(): array
    {
        return ['finishedIds' => $this->finishedIds];
    }
}
```

`app/Http/Controllers/Retros/VotingCompletionsController.php`:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\VotingFinishedChanged;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * "I have finished voting": `update` says it, `destroy` takes it back. It
 * changes no card, so a locked board accepts it.
 */
class VotingCompletionsController extends Controller
{
    public function update(Request $request, Retro $retro): JsonResponse
    {
        return response()->json(['finishedIds' => $this->set($request, $retro, true)]);
    }

    public function destroy(Request $request, Retro $retro): JsonResponse
    {
        return response()->json(['finishedIds' => $this->set($request, $retro, false)]);
    }

    /**
     * @return array<int, string>
     */
    private function set(Request $request, Retro $retro, bool $finished): array
    {
        $participant = Participant::current($request);

        RetroGuard::phase($retro, RetroPhase::Voting);

        return DB::transaction(function () use ($retro, $participant, $finished): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::phase($locked, RetroPhase::Voting);

            $voter = Participant::query()->whereKey($participant->id)->lockForUpdate()->firstOrFail();

            $voter->update(['voting_finished_at' => $finished ? ($voter->voting_finished_at ?? now()) : null]);

            $finishedIds = $locked->votingFinishedIds();

            (new VotingFinishedChanged($locked->id, $finishedIds))->sendToOthers();

            return $finishedIds;
        });
    }
}
```

`CardVotesController` (decision 10, B):
- `store`: the existing `Participant::query()->whereKey($participant->id)->lockForUpdate()->first();` becomes `$voter = Participant::query()->whereKey($participant->id)->lockForUpdate()->firstOrFail();`. After `$locked->votes()->create([...])` and before `$locked->increment('votes_version')`: `$finishedIds = $this->takeBackFinished($locked, $voter);`. The array the transaction returns gains `'finishedIds' => $finishedIds`.
- `destroy`: right after `RetroGuard::unlocked($locked);` inside the transaction: `$voter = Participant::query()->whereKey($participant->id)->lockForUpdate()->firstOrFail();` (the participant is locked after the retro and before the vote row, the order `store` uses). After `$vote->delete();`: `$finishedIds = $this->takeBackFinished($locked, $voter);`; the returned array gains `'finishedIds' => $finishedIds`.
- The budget, cap and "not voted" refusals throw before `takeBackFinished`, so a refused vote leaves "finished" as it was.
- `tally()`: its `@param` shape gains `finishedIds: ?array<int, string>` and its `@return` shape gains `finishedIds: ?array<int, string>`; it returns `'finishedIds' => $totals['finishedIds']` last.
- New private method:

```php
    /**
     * Decision 10 (owner, B): a vote cast or taken back by a participant who
     * had finished takes "finished" back.
     *
     * @return array<int, string>|null the new list, or null when nothing changed
     */
    private function takeBackFinished(Retro $locked, Participant $voter): ?array
    {
        if (! $voter->hasFinishedVoting()) {
            return null;
        }

        $voter->update(['voting_finished_at' => null]);

        $finishedIds = $locked->votingFinishedIds();

        (new VotingFinishedChanged($locked->id, $finishedIds))->sendToOthers();

        return $finishedIds;
    }
```

`routes/web.php`, after `retros.cards.votes.destroy`:

```php
        Route::put('voting-completion', [VotingCompletionsController::class, 'update'])->name('retros.votingCompletion.update');
        Route::delete('voting-completion', [VotingCompletionsController::class, 'destroy'])->name('retros.votingCompletion.destroy');
```

- [ ] **Step 4: Translations**

None on the server (decision 10 B has no refusal). The front strings are in Task 13.

- [ ] **Step 5: Run the tests on PostgreSQL, and the races**

Run: `bin/test-db pgsql -- tests/Feature/Retros/VotingCompletionTest.php tests/Feature/Retros/VotingTest.php tests/Feature/Retros/MaxVotesPerCardTest.php`.
Run: `bin/test-db pgsql --concurrency -- tests/Concurrency/VotingCompletionTest.php tests/Concurrency/VoteLimitTest.php tests/Concurrency/MaxVotesPerCardTest.php`.
Expected: PASS (`VoteLimitTest`'s deadlock case still sees one rollback: the participant is locked after the retro, as before; `destroy` now locks the participant too, after the retro, so no new lock order appears).

- [ ] **Step 6: Gates and commit**

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/sail composer types:check
git add app/Events/Retros/VotingFinishedChanged.php app/Http/Controllers/Retros routes/web.php tests/Feature/Retros/VotingCompletionTest.php tests/Feature/Retros/VotingTest.php tests/Concurrency/VotingCompletionTest.php
git commit -m "feat(retro): I have finished voting, taken back by a new vote

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

### Task 23 (lane V, after Task 5): The writing count of an anonymous retro (RT-1, decision 1 C)

Numbered last so the other task numbers stay stable; it runs in Step A, in lane V, after Task 5. It carries spec §6.11, whose rules are the owner's answer with its accepted risk: **never add an id, a name or a column to the count**, and never "fix" the timing risk of rule 8 by going back to named indicators.

**Files:**
- Create: `app/Events/Retros/WritingCountChanged.php`, `app/Http/Controllers/Retros/RetroWritersController.php`
- Modify: `app/Providers/AppServiceProvider.php` (the limiter), `routes/web.php`
- Test: `tests/Feature/Retros/WritingCountTest.php`

Read first: `Participant::current`, the `retros/{retro}` route group and its middleware (which one puts the participant in the request attributes), `RetroGuard` (`phase`, `unlocked`), the `whiteboard-writes` limiter of `AppServiceProvider::boot`, `docs/database.md` rule 6.

**Interfaces:**
- Consumes: `participants.writing_until` (Task 1).
- Produces: routes `retros.writing.update` (`PUT retros/{retro}/writing`) and `retros.writing.destroy` (`DELETE …`), both answering `{count: int}`; event `WritingCountChanged(string $retroId, int $count)`, name `writing.count`, `broadcastWith(): array{count: int}`; constants `RetroWritersController::WritingSeconds = 8`; limiter `retro-writing` (40 per minute per participant).

- [ ] **Step 1: Write the failing tests**

`tests/Feature/Retros/WritingCountTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Events\Retros\WritingCountChanged;
use App\Models\Retro;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

function anonymousWritingRetro(array $attributes = []): Retro
{
    return Retro::factory()->inPhase(RetroPhase::Writing)->create(['is_anonymous' => true, ...$attributes]);
}

it('counts the people writing and sends the count with nothing else', function () {
    $retro = anonymousWritingRetro();
    [$first] = retroMember($retro);
    [$second] = retroMember($retro);

    $this->actingAs($first)->putJson(route('retros.writing.update', $retro))
        ->assertOk()
        ->assertExactJson(['count' => 1]);
    $this->actingAs($second)->putJson(route('retros.writing.update', $retro))
        ->assertOk()
        ->assertExactJson(['count' => 2]);

    // Spec §6.11 rule 4 (owner's answer C): the payload is the count, never an id, a name or a column.
    Event::assertDispatched(fn (WritingCountChanged $event) => $event->broadcastWith() === ['count' => 2]);
    Event::assertDispatched(WritingCountChanged::class, fn (WritingCountChanged $event) => array_keys($event->broadcastWith()) === ['count']);
});

it('sends the count again on every heartbeat', function () {
    $retro = anonymousWritingRetro();
    [$user] = retroMember($retro);

    $this->actingAs($user)->putJson(route('retros.writing.update', $retro))->assertOk();
    $this->actingAs($user)->putJson(route('retros.writing.update', $retro))->assertExactJson(['count' => 1]);

    Event::assertDispatchedTimes(WritingCountChanged::class, 2);
});

it('stops counting a writer who stops or goes quiet', function () {
    $retro = anonymousWritingRetro();
    [$first, $one] = retroMember($retro);
    [$second] = retroMember($retro);

    $this->actingAs($first)->putJson(route('retros.writing.update', $retro))->assertOk();
    $this->actingAs($second)->putJson(route('retros.writing.update', $retro))->assertExactJson(['count' => 2]);

    $this->actingAs($first)->deleteJson(route('retros.writing.destroy', $retro))->assertExactJson(['count' => 1]);

    expect($one->fresh()->writing_until)->toBeNull();

    $this->travel(9)->seconds();

    $this->actingAs($first)->putJson(route('retros.writing.update', $retro))->assertExactJson(['count' => 1]);
});

it('lets a guest say they are writing', function () {
    $retro = anonymousWritingRetro();
    $guest = retroGuest($retro);

    $this->withCookies(retroGuestCookie($guest))->withCredentials()
        ->putJson(route('retros.writing.update', $retro))
        ->assertExactJson(['count' => 1]);
});

it('refuses a named retro, another phase and a locked board', function () {
    $named = Retro::factory()->inPhase(RetroPhase::Writing)->create(['is_anonymous' => false]);
    [$user] = retroMember($named);
    $this->actingAs($user)->putJson(route('retros.writing.update', $named))->assertForbidden();

    $grouping = anonymousWritingRetro(['phase' => RetroPhase::Grouping]);
    [$user] = retroMember($grouping);
    $this->actingAs($user)->putJson(route('retros.writing.update', $grouping))->assertForbidden();

    $locked = anonymousWritingRetro(['is_locked' => true]);
    [$user] = retroMember($locked);
    $this->actingAs($user)->putJson(route('retros.writing.update', $locked))->assertStatus(423);

    Event::assertNotDispatched(WritingCountChanged::class);
});

it('limits the heartbeats of one participant', function () {
    $retro = anonymousWritingRetro();
    [$user] = retroMember($retro);
    [$other] = retroMember($retro);

    foreach (range(1, 40) as $beat) {
        $this->actingAs($user)->putJson(route('retros.writing.update', $retro))->assertOk();
    }

    $this->actingAs($user)->putJson(route('retros.writing.update', $retro))->assertTooManyRequests();
    $this->actingAs($other)->putJson(route('retros.writing.update', $retro))->assertOk();
});
```

(Check `RetroGuard::unlocked`'s status on the lane's head: the spec says 423; if the guard answers another status for a locked board, use the guard's and report it.)

- [ ] **Step 2: Run them to see them fail**

Run: `bin/test-db pgsql -- tests/Feature/Retros/WritingCountTest.php`
Expected: FAIL (unknown route).

- [ ] **Step 3: Implementation**

`app/Events/Retros/WritingCountChanged.php`:

```php
<?php

namespace App\Events\Retros;

/**
 * How many people write a card on an anonymous retro. Spec §6.11 rule 4
 * (owner's answer C): the count only — no id, no name, no column.
 */
class WritingCountChanged extends RetroBroadcastEvent
{
    public function __construct(string $retroId, public int $count)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'writing.count';
    }

    public function broadcastWith(): array
    {
        return ['count' => $this->count];
    }
}
```

`app/Http/Controllers/Retros/RetroWritersController.php`:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\WritingCountChanged;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The writing heartbeat of an anonymous retro (spec §6.11): `update` says
 * "I am writing" for the next few seconds, `destroy` says "I stopped".
 * One row written, no lock: a count read a moment early is corrected by the
 * next heartbeat.
 */
class RetroWritersController extends Controller
{
    public const int WritingSeconds = 8;

    public function update(Request $request, Retro $retro): JsonResponse
    {
        return response()->json(['count' => $this->write($request, $retro, now()->addSeconds(self::WritingSeconds))]);
    }

    public function destroy(Request $request, Retro $retro): JsonResponse
    {
        return response()->json(['count' => $this->write($request, $retro, null)]);
    }

    private function write(Request $request, Retro $retro, mixed $writingUntil): int
    {
        $participant = Participant::current($request);

        abort_unless($retro->is_anonymous, 403);
        RetroGuard::phase($retro, RetroPhase::Writing);
        RetroGuard::unlocked($retro);

        Participant::query()->whereKey($participant->id)->update(['writing_until' => $writingUntil]);

        $count = $retro->participants()->where('writing_until', '>', now())->count();

        (new WritingCountChanged($retro->id, $count))->sendToOthers();

        return $count;
    }
}
```

(Type `$writingUntil` as `?CarbonInterface` with the import, not `mixed`, once PHPStan confirms what `now()->addSeconds()` returns on the lane's head.)

`AppServiceProvider::boot`, after the `whiteboard-writes` limiter:

```php
        RateLimiter::for('retro-writing', function (Request $request): Limit {
            $participant = $request->attributes->get('participant');
            $key = $participant instanceof Participant ? $participant->id : $request->ip();

            return Limit::perMinute(40)->by("retro-writing|{$key}");
        });
```

(import `App\Models\Participant`).

`routes/web.php`, after Task 5's two lines:

```php
        Route::put('writing', [RetroWritersController::class, 'update'])->middleware('throttle:retro-writing')->name('retros.writing.update');
        Route::delete('writing', [RetroWritersController::class, 'destroy'])->middleware('throttle:retro-writing')->name('retros.writing.destroy');
```

- [ ] **Step 4: Run the tests on PostgreSQL**

Run: `bin/test-db pgsql -- tests/Feature/Retros/WritingCountTest.php tests/Feature/Retros/RetroFacilitationSchemaTest.php`.
Expected: PASS. No race: the count protects no invariant (spec §6.11 rule 2).

- [ ] **Step 5: Gates and commit**

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/sail composer types:check
git add app/Events/Retros/WritingCountChanged.php app/Http/Controllers/Retros/RetroWritersController.php app/Providers/AppServiceProvider.php routes/web.php tests/Feature/Retros/WritingCountTest.php
git commit -m "feat(retro): a count of people writing on an anonymous retro, with no ids

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

### Task 6 (lane D): Shared notes of a topic (RT-6)

**Files:**
- Create: `app/Events/Retros/TopicNoteSaved.php`, `app/Http/Controllers/Retros/TopicNotesController.php`
- Modify: `routes/web.php`, the four `lang/*.json`
- Test: `tests/Feature/Retros/TopicNotesTest.php`, `tests/Concurrency/TopicNotesTest.php`

**Interfaces:**
- Consumes: `TopicNote` (`MaxLength`), `Retro::topicNotes()`, `PresentTopicNote::handle(?TopicNote, string)` (Task 1).
- Produces: route `retros.cards.notes.update` (`PUT retros/{retro}/cards/{card}/notes`, body `{body: ?string, version: int}`), answering 200 `{note}` or 409 `{message, note}`; event `TopicNoteSaved(string $retroId, array $note)`, name `topic.note.saved`, payload `{note}`.

- [ ] **Step 1: Write the failing tests**

`tests/Feature/Retros/TopicNotesTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Events\Retros\TopicNoteSaved;
use App\Models\Retro;
use App\Models\TopicNote;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('saves the first note of a topic and every later one from the version it read', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user, $participant] = retroMember($retro);
    $topic = topicCard($retro);

    $this->actingAs($user)->putJson(route('retros.cards.notes.update', [$retro, $topic]), ['body' => 'Any addition goes through the PO.', 'version' => 0])
        ->assertOk()
        ->assertJsonPath('note.cardId', $topic->id)
        ->assertJsonPath('note.body', 'Any addition goes through the PO.')
        ->assertJsonPath('note.version', 1);

    $this->actingAs($user)->putJson(route('retros.cards.notes.update', [$retro, $topic]), ['body' => "Any addition goes through the PO.\nTry one in, one out.", 'version' => 1])
        ->assertOk()
        ->assertJsonPath('note.version', 2);

    $note = TopicNote::query()->sole();

    expect($note->body)->toBe("Any addition goes through the PO.\nTry one in, one out.")
        ->and($note->updated_by_participant_id)->toBe($participant->id)
        ->and($note->retro_id)->toBe($retro->id);
    Event::assertDispatched(fn (TopicNoteSaved $event) => $event->broadcastWith()['note']['version'] === 2
        && ! str_contains(json_encode($event->broadcastWith()), $participant->id));
});

it('refuses a save from an older version with the current note, and writes nothing', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroMember($retro);
    $topic = topicCard($retro);
    TopicNote::factory()->create(['retro_id' => $retro->id, 'card_id' => $topic->id, 'body' => 'Theirs', 'version' => 3]);

    $this->actingAs($user)->putJson(route('retros.cards.notes.update', [$retro, $topic]), ['body' => 'Mine', 'version' => 2])
        ->assertStatus(409)
        ->assertJsonPath('note.body', 'Theirs')
        ->assertJsonPath('note.version', 3);

    expect(TopicNote::query()->sole()->body)->toBe('Theirs');
    Event::assertNotDispatched(TopicNoteSaved::class);
});

it('answers an empty note at version 0 when the first save claims a later version', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroMember($retro);
    $topic = topicCard($retro);

    $this->actingAs($user)->putJson(route('retros.cards.notes.update', [$retro, $topic]), ['body' => 'Mine', 'version' => 4])
        ->assertStatus(409)
        ->assertJsonPath('note', ['cardId' => $topic->id, 'body' => '', 'version' => 0, 'updatedAt' => null]);
});

it('lets a guest write the notes and empties them with an empty text', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    $guest = retroGuest($retro);
    $topic = topicCard($retro);
    TopicNote::factory()->create(['retro_id' => $retro->id, 'card_id' => $topic->id, 'body' => 'Draft', 'version' => 1]);

    $this->withCookies(retroGuestCookie($guest))->withCredentials()
        ->putJson(route('retros.cards.notes.update', [$retro, $topic]), ['body' => '', 'version' => 1])
        ->assertOk()
        ->assertJsonPath('note.body', '');
});

it('refuses notes outside Discussing, on a locked board, on a child card, and beyond the length', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroMember($retro);
    $topic = topicCard($retro);
    $child = topicCard($retro, ['parent_card_id' => $topic->id]);
    $notes = fn ($card, array $payload) => $this->actingAs($user)->putJson(route('retros.cards.notes.update', [$retro, $card]), $payload);

    $notes($child, ['body' => 'x', 'version' => 0])->assertUnprocessable()->assertJsonValidationErrors('card');
    $notes($topic, ['body' => str_repeat('a', TopicNote::MaxLength + 1), 'version' => 0])->assertUnprocessable()->assertJsonValidationErrors('body');
    $notes($topic, ['body' => 'x'])->assertUnprocessable()->assertJsonValidationErrors('version');

    $retro->update(['is_locked' => true]);
    $notes($topic, ['body' => 'x', 'version' => 0])->assertStatus(423);

    $retro->update(['is_locked' => false, 'phase' => RetroPhase::Actions]);
    $notes($topic, ['body' => 'x', 'version' => 0])->assertForbidden();

    expect(TopicNote::query()->count())->toBe(0);
});
```

`tests/Concurrency/TopicNotesTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Models\Card;
use App\Models\Retro;
use App\Models\TopicNote;
use Tests\Concurrency\Support\Race;

it('creates one note when the first two saves of a topic arrive together', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$first] = retroMember($retro);
    [$second] = retroMember($retro);
    $topic = Card::factory()->create(['retro_id' => $retro->id]);
    $uri = route('retros.cards.notes.update', [$retro, $topic], false);
    $firstId = $first->id;
    $secondId = $second->id;

    $outcomes = Race::run([
        static fn (): int => Race::request($firstId, 'PUT', $uri, ['body' => 'First', 'version' => 0]),
        static fn (): int => Race::request($secondId, 'PUT', $uri, ['body' => 'Second', 'version' => 0]),
    ]);

    // Protection: the retro row is locked before the note is read, so the second save sees version 1.
    expect(array_column($outcomes, 'value'))->toEqualCanonicalizing([200, 409])
        ->and(TopicNote::query()->count())->toBe(1)
        ->and(TopicNote::query()->sole()->version)->toBe(1);
});

it('keeps one of two saves made from the same version', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$first] = retroMember($retro);
    [$second] = retroMember($retro);
    $topic = Card::factory()->create(['retro_id' => $retro->id]);
    TopicNote::factory()->create(['retro_id' => $retro->id, 'card_id' => $topic->id, 'body' => 'Start', 'version' => 4]);
    $uri = route('retros.cards.notes.update', [$retro, $topic], false);
    $firstId = $first->id;
    $secondId = $second->id;

    $outcomes = Race::run([
        static fn (): int => Race::request($firstId, 'PUT', $uri, ['body' => 'First', 'version' => 4]),
        static fn (): int => Race::request($secondId, 'PUT', $uri, ['body' => 'Second', 'version' => 4]),
    ]);

    $note = TopicNote::query()->sole();

    expect(array_column($outcomes, 'value'))->toEqualCanonicalizing([200, 409])
        ->and($note->version)->toBe(5)
        ->and($note->body)->toBeIn(['First', 'Second']);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `bin/test-db pgsql -- tests/Feature/Retros/TopicNotesTest.php`
Expected: FAIL.

- [ ] **Step 3: Implementation**

`app/Events/Retros/TopicNoteSaved.php`:

```php
<?php

namespace App\Events\Retros;

class TopicNoteSaved extends RetroBroadcastEvent
{
    /**
     * @param  array{cardId: string, body: string, version: int, updatedAt: ?string}  $note
     */
    public function __construct(string $retroId, public array $note)
    {
        parent::__construct($retroId);
    }

    public function broadcastAs(): string
    {
        return 'topic.note.saved';
    }

    public function broadcastWith(): array
    {
        return ['note' => $this->note];
    }
}
```

`app/Http/Controllers/Retros/TopicNotesController.php`:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\PresentTopicNote;
use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\TopicNoteSaved;
use App\Http\Controllers\Controller;
use App\Models\Card;
use App\Models\Participant;
use App\Models\Retro;
use App\Models\TopicNote;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * The shared notes of a topic. A save names the version it started from; a
 * save from an older version writes nothing and gets the current note back.
 */
class TopicNotesController extends Controller
{
    public function __construct(private PresentTopicNote $presentTopicNote) {}

    public function update(Request $request, Retro $retro, Card $card): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::phase($retro, RetroPhase::Discussing);
        RetroGuard::unlocked($retro);

        $validated = $request->validate([
            'body' => ['present', 'nullable', 'string', 'max:'.TopicNote::MaxLength],
            'version' => ['required', 'integer', 'min:0'],
        ]);

        $outcome = DB::transaction(function () use ($retro, $card, $participant, $validated): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::phase($locked, RetroPhase::Discussing);
            RetroGuard::unlocked($locked);

            $topic = $locked->cards()->whereKey($card->id)->firstOrFail();

            if (! $topic->isTopLevel()) {
                throw ValidationException::withMessages(['card' => __('Notes belong to a topic, not to a card inside a group.')]);
            }

            $note = $locked->topicNotes()->where('card_id', $topic->id)->lockForUpdate()->first();
            $current = $note === null ? 0 : $note->version;

            if ((int) $validated['version'] !== $current) {
                return ['saved' => false, 'note' => $this->presentTopicNote->handle($note, $topic->id)];
            }

            $note ??= new TopicNote(['card_id' => $topic->id]);

            $note->fill([
                'body' => (string) ($validated['body'] ?? ''),
                'version' => $current + 1,
                'updated_by_participant_id' => $participant->id,
            ]);

            $locked->topicNotes()->save($note);

            $presented = $this->presentTopicNote->handle($note, $topic->id);

            (new TopicNoteSaved($locked->id, $presented))->sendToOthers();

            return ['saved' => true, 'note' => $presented];
        });

        if (! $outcome['saved']) {
            return response()->json(['message' => __('Someone else changed these notes.'), 'note' => $outcome['note']], 409);
        }

        return response()->json(['note' => $outcome['note']]);
    }
}
```

`routes/web.php`, after `retros.cards.comments.store`:

```php
        Route::put('cards/{card}/notes', [TopicNotesController::class, 'update'])->name('retros.cards.notes.update')->whereUuid('card');
```

- [ ] **Step 4: Translations**

`Notes belong to a topic, not to a card inside a group.`, `Someone else changed these notes.`

- [ ] **Step 5: Run the tests on PostgreSQL, and the races**

Run: `bin/test-db pgsql -- tests/Feature/Retros/TopicNotesTest.php`.
Run: `bin/test-db pgsql --concurrency -- tests/Concurrency/TopicNotesTest.php`.
Expected: PASS.

- [ ] **Step 6: Gates and commit**

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/sail composer types:check
git add app/Events/Retros/TopicNoteSaved.php app/Http/Controllers/Retros/TopicNotesController.php routes/web.php lang tests/Feature/Retros/TopicNotesTest.php tests/Concurrency/TopicNotesTest.php
git commit -m "feat(retro): shared notes of a topic, with a version check

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

### Task 7 (lane D): Action items linked to a topic (RT-8)

**Files:**
- Modify: `app/Actions/ActionItems/ActionItemRules.php`, `CreateActionItem.php`, `app/Http/Controllers/Retros/ActionItemsController.php`, the four `lang/*.json`
- Test: `tests/Feature/Retros/ActionItemTopicsTest.php`

Read first: `ActionItemsController` (store, update, `LocksDiscussingRetro::lockActionItem`), `ApplyActionItemChanges` (it fills `ActionItemRules::attributes($validated)`), `UpdateActionItem` (authorises an edit when a field changes), `WorkspaceActionItemsController@update` (it validates `ActionItemRules::update` without `card_id`).

**Interfaces:**
- Consumes: `action_items.card_id`, `ActionItem::card()`, `PresentActionItem` `cardId` (Task 1).
- Produces: `ActionItemRules::topic(): array<string, array<int, mixed>>` (`card_id` rule); `ActionItemRules::attributes()` keeps `card_id`; `retros.action-items.store|update` accept `card_id`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/Retros/ActionItemTopicsTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\Retro;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('links a new action item to its topic', function (RetroPhase $phase) {
    $retro = Retro::factory()->inPhase($phase)->create();
    [$user] = retroMember($retro);
    $topic = topicCard($retro);

    $this->actingAs($user)->postJson(route('retros.action-items.store', $retro), ['content' => 'Share the backlog on Mondays', 'card_id' => $topic->id])
        ->assertCreated()
        ->assertJsonPath('actionItem.cardId', $topic->id);

    expect(ActionItem::query()->sole()->card_id)->toBe($topic->id);
})->with([RetroPhase::Discussing, RetroPhase::Actions]);

it('creates an item without a topic as before', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroMember($retro);

    $this->actingAs($user)->postJson(route('retros.action-items.store', $retro), ['content' => 'Book the room'])
        ->assertCreated()
        ->assertJsonPath('actionItem.cardId', null);
});

it('refuses a child card or a card of another retro as a topic', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    [$user] = retroMember($retro);
    $topic = topicCard($retro);
    $child = topicCard($retro, ['parent_card_id' => $topic->id]);
    $elsewhere = Card::factory()->create();

    foreach ([$child, $elsewhere] as $card) {
        $this->actingAs($user)->postJson(route('retros.action-items.store', $retro), ['content' => 'x', 'card_id' => $card->id])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['card_id' => 'Choose a topic of this retrospective.']);
    }

    expect(ActionItem::query()->count())->toBe(0);
});

it('moves an item to another topic, or takes it off its topic', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Actions)->create();
    [$user] = retroFacilitator($retro);
    $first = topicCard($retro);
    $second = topicCard($retro);
    $item = ActionItem::factory()->create(['team_id' => $retro->team_id, 'retro_id' => $retro->id, 'card_id' => $first->id]);

    $this->actingAs($user)->patchJson(route('retros.action-items.update', [$retro, $item]), ['card_id' => $second->id])
        ->assertOk()
        ->assertJsonPath('actionItem.cardId', $second->id);

    $this->actingAs($user)->patchJson(route('retros.action-items.update', [$retro, $item]), ['card_id' => null])
        ->assertOk()
        ->assertJsonPath('actionItem.cardId', null);
});

it('ignores a topic sent to the workspace endpoint', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    [$user] = retroFacilitator($retro);
    $topic = topicCard($retro);
    $item = ActionItem::factory()->create(['team_id' => $retro->team_id, 'retro_id' => $retro->id, 'created_by_user_id' => $user->id]);

    $this->actingAs($user)
        ->patchJson(route('workspaces.actionItems.update', [$retro->team->workspace, $item]), ['content' => 'Renamed', 'card_id' => $topic->id])
        ->assertOk();

    expect($item->fresh()->card_id)->toBeNull();
});
```

(The workspace case reuses the fixture of `tests/Feature/ActionItems/*` for an author who may edit: read `WorkspaceActionItemsTest` first and adjust the fixture to the one that test uses for a successful update.)

- [ ] **Step 2: Run it to see it fail**

Run: `bin/test-db pgsql -- tests/Feature/Retros/ActionItemTopicsTest.php`
Expected: FAIL.

- [ ] **Step 3: Implementation**

`ActionItemRules`:

```php
    /**
     * The topic of an item, on the board's endpoints only: the workspace endpoints leave it as it is.
     *
     * @return array<string, array<int, mixed>>
     */
    public static function topic(): array
    {
        return ['card_id' => ['sometimes', 'nullable', 'uuid']];
    }
```

and `attributes()` keeps `card_id`: `array_flip(['content', 'priority', 'due_on', 'recurrence', 'card_id'])` (the workspace endpoints never validate `card_id`, so it never reaches their `$validated`).

`CreateActionItem::handle`: the created row gains `'card_id' => $attributes['card_id'] ?? null` (docblock: "content, and optionally … card_id").

`ActionItemsController`:
- `store` and `update` validate `[...ActionItemRules::create(allowsGuests: true), ...ActionItemRules::topic()]` (and `update(...)` likewise);
- inside the transaction, after locking, `$this->ensureTopic($locked, $validated);` (`store`) and `$this->ensureTopic($item->retro, $validated);` after `lockActionItem` (`update`, which then calls `applyActionItemChanges->handle($item, …)`);
- new private method:

```php
    /**
     * @param  array<string, mixed>  $validated
     */
    private function ensureTopic(Retro $locked, array $validated): void
    {
        $cardId = $validated['card_id'] ?? null;

        if ($cardId === null) {
            return;
        }

        if ($locked->cards()->whereKey($cardId)->whereNull('parent_card_id')->exists()) {
            return;
        }

        throw ValidationException::withMessages(['card_id' => __('Choose a topic of this retrospective.')]);
    }
```

- [ ] **Step 4: Translations**

`Choose a topic of this retrospective.`

- [ ] **Step 5: Run the tests on PostgreSQL**

Run: `bin/test-db pgsql -- tests/Feature/Retros/ActionItemTopicsTest.php tests/Feature/Retros/ActionItemsTest.php tests/Feature/ActionItems`.
Expected: PASS.

- [ ] **Step 6: Gates and commit**

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/sail composer types:check
git add app/Actions/ActionItems app/Http/Controllers/Retros/ActionItemsController.php lang tests/Feature/Retros/ActionItemTopicsTest.php
git commit -m "feat(retro): action items linked to the topic they came from

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

### Task 8 (lane R): ROTI reveal and nudge (RT-9)

**Files:**
- Create: `app/Events/Retros/RotiRevealed.php`, `RotiNudged.php`, `app/Http/Controllers/Retros/RetroRotiRevealsController.php`, `RetroRotiNudgesController.php`
- Modify: `app/Models/Retro.php` (`takesRotiVotes` only), `routes/web.php`, the four `lang/*.json`
- Test: `tests/Feature/Retros/RotiRevealTest.php`, `tests/Feature/Retros/RotiNudgeTest.php`, `tests/Concurrency/RotiRevealTest.php`

**Interfaces:**
- Consumes: `retros.roti_revealed_at`, the snapshot's `roti.revealed` and `roti.results` (Task 1), `SummarizeRoti`.
- Produces: routes `retros.roti.reveal.update` (`PUT retros/{retro}/roti/reveal`, answers `{results}` in the `SummarizeRoti` shape) and `retros.roti.nudges.store` (`POST retros/{retro}/roti/nudges`, 204); events `roti.revealed` and `roti.nudged` (no payload); `Retro::NudgeIntervalSeconds = 30`.

- [ ] **Step 1: Write the failing tests**

`tests/Feature/Retros/RotiRevealTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Events\Retros\RotiRevealed;
use App\Models\Retro;
use App\Models\RotiVote;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('reveals the ROTI to everyone and closes the vote', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Roti)->create();
    [$facilitator, $own] = retroFacilitator($retro);
    [$member, $participant] = retroMember($retro);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $own->id, 'score' => 3]);
    RotiVote::factory()->create(['retro_id' => $retro->id, 'participant_id' => $participant->id, 'score' => 5]);

    $this->actingAs($facilitator)->putJson(route('retros.roti.reveal.update', $retro))
        ->assertOk()
        ->assertJsonPath('results.average', 4.0)
        ->assertJsonPath('results.respondents', 2);

    expect($retro->fresh()->roti_revealed_at)->not->toBeNull();
    Event::assertDispatched(RotiRevealed::class);

    $this->actingAs($member)->putJson(route('retros.roti.update', $retro), ['score' => 1])->assertForbidden();
    $this->actingAs($member)->deleteJson(route('retros.roti.destroy', $retro))->assertForbidden();

    expect(RotiVote::query()->where('participant_id', $participant->id)->value('score'))->toBe(5);
});

it('refuses a second reveal, a reveal by a participant and a reveal outside the ROTI phase', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Roti)->create(['roti_revealed_at' => now()]);
    [$facilitator] = retroFacilitator($retro);
    [$member] = retroMember($retro);

    $this->actingAs($facilitator)->putJson(route('retros.roti.reveal.update', $retro))
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['roti' => 'The ROTI is already revealed.']);
    $this->actingAs($member)->putJson(route('retros.roti.reveal.update', $retro))->assertForbidden();

    $retro->update(['phase' => RetroPhase::Actions, 'roti_revealed_at' => null]);

    $this->actingAs($facilitator)->putJson(route('retros.roti.reveal.update', $retro))->assertForbidden();
});

it('still takes ratings on a retro completed before the ROTI phase existed', function () {
    $retro = Retro::factory()->legacyRoti()->inPhase(RetroPhase::Completed)->create();
    [$member] = retroMember($retro);

    $this->actingAs($member)->putJson(route('retros.roti.update', $retro), ['score' => 4])->assertOk();
});
```

(`legacyRoti()` is the factory state for `roti_votable_when_completed`; read `RetroFactory` and use it as `RotiTest` does.)

`tests/Feature/Retros/RotiNudgeTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Events\Retros\RotiNudged;
use App\Models\Retro;
use Illuminate\Support\Facades\Event;

beforeEach(function () {
    Event::fake();
});

it('nudges once per half minute', function () {
    $this->freezeTime();
    $retro = Retro::factory()->inPhase(RetroPhase::Roti)->create();
    [$facilitator] = retroFacilitator($retro);

    $this->actingAs($facilitator)->postJson(route('retros.roti.nudges.store', $retro))->assertNoContent();
    $this->actingAs($facilitator)->postJson(route('retros.roti.nudges.store', $retro))
        ->assertStatus(429)
        ->assertJsonPath('message', 'You can nudge again in a moment.');

    $this->travel(Retro::NudgeIntervalSeconds + 1)->seconds();

    $this->actingAs($facilitator)->postJson(route('retros.roti.nudges.store', $retro))->assertNoContent();

    Event::assertDispatchedTimes(RotiNudged::class, 2);
});

it('refuses the nudge to a participant, outside the ROTI phase and after the reveal', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Roti)->create();
    [$facilitator] = retroFacilitator($retro);
    [$member] = retroMember($retro);

    $this->actingAs($member)->postJson(route('retros.roti.nudges.store', $retro))->assertForbidden();

    $retro->update(['roti_revealed_at' => now()]);
    $this->actingAs($facilitator)->postJson(route('retros.roti.nudges.store', $retro))->assertForbidden();

    $retro->update(['roti_revealed_at' => null, 'phase' => RetroPhase::Actions]);
    $this->actingAs($facilitator)->postJson(route('retros.roti.nudges.store', $retro))->assertForbidden();

    Event::assertNotDispatched(RotiNudged::class);
});
```

`tests/Concurrency/RotiRevealTest.php`:

```php
<?php

use App\Enums\RetroPhase;
use App\Models\Retro;
use App\Models\RotiVote;
use Tests\Concurrency\Support\Race;

it('counts a ROTI vote only if it arrived before the reveal', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Roti)->create();
    [$facilitator] = retroFacilitator($retro);
    [$member, $participant] = retroMember($retro);
    $facilitatorId = $facilitator->id;
    $memberId = $member->id;
    $revealUri = route('retros.roti.reveal.update', $retro, false);
    $voteUri = route('retros.roti.update', $retro, false);

    $outcomes = Race::run([
        'reveal' => static fn (): int => Race::request($facilitatorId, 'PUT', $revealUri),
        'vote' => static fn (): int => Race::request($memberId, 'PUT', $voteUri, ['score' => 2]),
    ]);

    $vote = RotiVote::query()->where('participant_id', $participant->id)->first();

    // Protection: the vote and the reveal both lock the retro row; the vote re-checks takesRotiVotes() under it.
    expect($outcomes['reveal']['value'])->toBe(200)
        ->and($outcomes['vote']['value'])->toBeIn([200, 403])
        ->and($vote === null)->toBe($outcomes['vote']['value'] === 403);

    if ($vote !== null) {
        expect($vote->updated_at->lte($retro->fresh()->roti_revealed_at))->toBeTrue();
    }
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `bin/test-db pgsql -- tests/Feature/Retros/RotiRevealTest.php tests/Feature/Retros/RotiNudgeTest.php`
Expected: FAIL.

- [ ] **Step 3: Implementation**

`Retro`:

```php
    public const int NudgeIntervalSeconds = 30;

    public function takesRotiVotes(): bool
    {
        if ($this->phase === RetroPhase::Roti) {
            return $this->roti_revealed_at === null;
        }

        return $this->phase === RetroPhase::Completed && $this->roti_votable_when_completed;
    }
```

(its docblock gains: "Revealing the ROTI in its phase closes the vote.")

`app/Events/Retros/RotiRevealed.php` and `RotiNudged.php` (the second with `broadcastAs(): 'roti.nudged'`):

```php
<?php

namespace App\Events\Retros;

class RotiRevealed extends RetroBroadcastEvent
{
    public function broadcastAs(): string
    {
        return 'roti.revealed';
    }

    public function broadcastWith(): array
    {
        return [];
    }
}
```

`app/Http/Controllers/Retros/RetroRotiRevealsController.php`:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Actions\Retros\SummarizeRoti;
use App\Enums\RetroPhase;
use App\Events\Retros\RotiRevealed;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class RetroRotiRevealsController extends Controller
{
    public function update(Request $request, Retro $retro, SummarizeRoti $summarizeRoti): JsonResponse
    {
        $participant = Participant::current($request);

        RetroGuard::facilitator($retro, $participant);
        RetroGuard::phase($retro, RetroPhase::Roti);

        $results = DB::transaction(function () use ($retro, $participant, $summarizeRoti): array {
            $locked = Retro::query()->whereKey($retro->id)->lockForUpdate()->firstOrFail();

            RetroGuard::facilitator($locked, $participant);
            RetroGuard::phase($locked, RetroPhase::Roti);

            if ($locked->roti_revealed_at !== null) {
                throw ValidationException::withMessages(['roti' => __('The ROTI is already revealed.')]);
            }

            $locked->update(['roti_revealed_at' => now()]);

            (new RotiRevealed($locked->id))->sendToOthers();

            return $summarizeRoti->handle($locked);
        });

        return response()->json(['results' => $results]);
    }
}
```

`app/Http/Controllers/Retros/RetroRotiNudgesController.php`:

```php
<?php

namespace App\Http\Controllers\Retros;

use App\Actions\Retros\RetroGuard;
use App\Enums\RetroPhase;
use App\Events\Retros\RotiNudged;
use App\Http\Controllers\Controller;
use App\Models\Participant;
use App\Models\Retro;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\RateLimiter;

/**
 * "Nudge the last n": nothing is stored, each board decides whether its viewer is one of them.
 */
class RetroRotiNudgesController extends Controller
{
    public function store(Request $request, Retro $retro): Response
    {
        $participant = Participant::current($request);

        RetroGuard::facilitator($retro, $participant);
        RetroGuard::phase($retro, RetroPhase::Roti);
        RetroGuard::takesRotiVotes($retro);

        $key = "roti-nudge:{$retro->id}";

        abort_if(RateLimiter::tooManyAttempts($key, 1), 429, __('You can nudge again in a moment.'));

        RateLimiter::hit($key, Retro::NudgeIntervalSeconds);

        (new RotiNudged($retro->id))->sendToOthers();

        return response()->noContent();
    }
}
```

(`phase` refuses a completed legacy retro, `takesRotiVotes` refuses after the reveal; both answer 403. No lock: nothing is written but the rate limiter's cache key.)

`routes/web.php`, after `retros.roti.destroy`:

```php
        Route::put('roti/reveal', [RetroRotiRevealsController::class, 'update'])->name('retros.roti.reveal.update');
        Route::post('roti/nudges', [RetroRotiNudgesController::class, 'store'])->name('retros.roti.nudges.store');
```

- [ ] **Step 4: Translations**

`The ROTI is already revealed.`, `You can nudge again in a moment.`

- [ ] **Step 5: Run the tests on PostgreSQL, and the race**

Run: `bin/test-db pgsql -- tests/Feature/Retros/RotiRevealTest.php tests/Feature/Retros/RotiNudgeTest.php tests/Feature/Retros/RotiTest.php tests/Feature/Retros/BoardSnapshotTest.php`.
Run: `bin/test-db pgsql --concurrency -- tests/Concurrency/RotiRevealTest.php`.
Expected: PASS.

- [ ] **Step 6: Gates and commit**

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/sail composer types:check
git add app/Models/Retro.php app/Events/Retros app/Http/Controllers/Retros routes/web.php lang tests/Feature/Retros/RotiRevealTest.php tests/Feature/Retros/RotiNudgeTest.php tests/Concurrency/RotiRevealTest.php
git commit -m "feat(retro): reveal the ROTI in its phase, and nudge the last voters

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

### Task 9 (lane D, after Task 6): The notes in the recap e-mail and the AI summary input (RT-6, decision 6)

**Files:**
- Modify: `app/Actions/Integrations/BuildRetroRecap.php`, `app/Support/Integrations/Messages/RetroRecap.php`, `RetroRecapMail.php`, `RecapText.php`, `app/Actions/Retros/BuildSummaryInput.php`, the four `lang/*.json`
- Test: `tests/Feature/Retros/TopicNotesRecapTest.php`

Read first: `BuildRetroRecap::handle` and `topCards()`, `RetroRecap` (constructor with named arguments; search `new RetroRecap(` in `app/` and `tests/` — every caller must keep compiling), `RetroRecapMail` (its list of sections and `section()`), `RecapText::topCard`, `BuildSummaryInput::cardsWithinBudget`, `tests/Feature/Retros/SummaryInputTest.php` (whether it compares exact shapes).

**Interfaces:**
- Consumes: `Retro::topicNotes()`, `Retro::voteCountsByCard()`.
- Produces: `RetroRecap::$topicNotes` (`array<int, array{title: string, note: string}>`, default `[]`, last constructor argument); `RecapText::topicNote(array{title: string, note: string}): string`; `BuildRetroRecap::TopicNoteLimit = 5`, `TopicNoteLength = 300`; a `notes` key on a lead card's entry of the summary input when its note is not blank.

- [ ] **Step 1: Write the failing test**

`tests/Feature/Retros/TopicNotesRecapTest.php`:

```php
<?php

use App\Actions\Integrations\BuildRetroRecap;
use App\Actions\Retros\BuildSummaryInput;
use App\Enums\RetroPhase;
use App\Models\Retro;
use App\Models\TopicNote;
use App\Models\Vote;
use App\Support\Integrations\Messages\RetroRecapMail;

function notedRetro(): array
{
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create(['completed_at' => now()]);
    $quiet = topicCard($retro, ['content' => 'Flaky CI', 'position' => 0]);
    $loud = topicCard($retro, ['content' => 'Scope changes mid-sprint', 'position' => 1]);
    $empty = topicCard($retro, ['content' => 'Client demo', 'position' => 2]);
    Vote::factory()->count(3)->create(['retro_id' => $retro->id, 'card_id' => $loud->id]);
    Vote::factory()->create(['retro_id' => $retro->id, 'card_id' => $quiet->id]);
    TopicNote::factory()->create(['retro_id' => $retro->id, 'card_id' => $quiet->id, 'body' => 'Quarantine the flaky tests.']);
    TopicNote::factory()->create(['retro_id' => $retro->id, 'card_id' => $loud->id, 'body' => str_repeat('One in, one out. ', 30)]);
    TopicNote::factory()->create(['retro_id' => $retro->id, 'card_id' => $empty->id, 'body' => '   ']);

    return [$retro, $quiet, $loud];
}

it('puts the notes of the topics in the recap, by votes, cut, without blank notes', function () {
    [$retro] = notedRetro();

    $recap = resolve(BuildRetroRecap::class)->handle($retro);

    expect($recap->topicNotes)->toHaveCount(2)
        ->and($recap->topicNotes[0]['title'])->toBe('Scope changes mid-sprint')
        ->and(mb_strlen($recap->topicNotes[0]['note']))->toBeLessThanOrEqual(BuildRetroRecap::TopicNoteLength + 1)
        ->and($recap->topicNotes[0]['note'])->toEndWith('…')
        ->and($recap->topicNotes[1])->toBe(['title' => 'Flaky CI', 'note' => 'Quarantine the flaky tests.']);
});

it('gives the recap e-mail a Discussion notes section', function () {
    [$retro] = notedRetro();

    $mail = new RetroRecapMail(resolve(BuildRetroRecap::class)->handle($retro));

    expect(collect($mail->sections())->pluck('heading')->all())->toContain('Discussion notes');
});

it('gives the AI summary input the note of each lead card', function () {
    [$retro] = notedRetro();

    $input = resolve(BuildSummaryInput::class)->handle($retro);
    $cards = collect(json_decode($input->data, true)['cards']);

    expect($cards->firstWhere('text', 'Flaky CI')['notes'])->toBe('Quarantine the flaky tests.')
        ->and($cards->firstWhere('text', 'Client demo'))->not->toHaveKey('notes');
});
```

(`RetroRecapMail::sections()` and `SummaryInput::$data` are the names to check when reading the two classes: the step adapts the two accessors to what the classes expose — a public method returning the sections, the property holding the encoded JSON — and says so in the commit.)

- [ ] **Step 2: Run it to see it fail**

Run: `bin/test-db pgsql -- tests/Feature/Retros/TopicNotesRecapTest.php`
Expected: FAIL.

- [ ] **Step 3: Implementation**

`RetroRecap`: a last promoted constructor property `public array $topicNotes = []` with the docblock `@param array<int, array{title: string, note: string}> $topicNotes`.

`BuildRetroRecap`: constants `public const TopicNoteLimit = 5;` and `public const TopicNoteLength = 300;`; `handle()` passes `topicNotes: $this->topicNotes($retro)`; new method:

```php
    /**
     * The notes of the most voted topics, without their writers.
     *
     * @return array<int, array{title: string, note: string}>
     */
    private function topicNotes(Retro $retro): array
    {
        $votes = $retro->voteCountsByCard();

        return $retro->topicNotes()
            ->with('card')
            ->get()
            ->filter(fn (TopicNote $note): bool => trim($note->body) !== '' && $note->card->isTopLevel())
            ->sortBy([
                fn (TopicNote $a, TopicNote $b): int => (int) ($votes[$b->card_id] ?? 0) <=> (int) ($votes[$a->card_id] ?? 0),
                fn (TopicNote $a, TopicNote $b): int => $a->card->position <=> $b->card->position,
                fn (TopicNote $a, TopicNote $b): int => $a->card_id <=> $b->card_id,
            ])
            ->take(self::TopicNoteLimit)
            ->map(fn (TopicNote $note): array => [
                'title' => Str::limit(Str::squish($note->card->group_name ?? $note->card->content ?? __('GIF')), 80),
                'note' => Str::limit(Str::squish($note->body), self::TopicNoteLength, '…'),
            ])
            ->values()
            ->all();
    }
```

`RecapText`:

```php
    /**
     * @param  array{title: string, note: string}  $note
     */
    public static function topicNote(array $note): string
    {
        return "{$note['title']} — {$note['note']}";
    }
```

`RetroRecapMail`: right after the section `__('Top card per column')`, the section `$this->section(__('Discussion notes'), array_map(RecapText::topicNote(...), $recap->topicNotes), 0)`, in the same list (a `null` section is dropped as the others are).

`BuildSummaryInput`: `handle()` loads `topicNotes` with the other relations; `cardsWithinBudget` reads `$notes = $retro->topicNotes->pluck('body', 'card_id');` and the lead entry ends with

```php
                ...(trim((string) ($notes[$lead->id] ?? '')) === '' ? [] : ['notes' => Str::limit(Str::squish((string) $notes[$lead->id]), BuildRetroRecap::TopicNoteLength * 2, '…')]),
```

(import `Illuminate\Support\Str` and `App\Actions\Integrations\BuildRetroRecap`; the instructions of the prompt are unchanged: notes are text about the cards, never about people).

- [ ] **Step 4: Translations**

`Discussion notes` (already a key if Task 15 lands first; add once).

- [ ] **Step 5: Run the tests on PostgreSQL**

Run: `bin/test-db pgsql -- tests/Feature/Retros/TopicNotesRecapTest.php tests/Feature/Retros/SummaryInputTest.php tests/Feature/Integrations tests/Feature/Mail` (use the folders that exist; `MailMockupTest` and the recap tests must pass unchanged).
Expected: PASS.

- [ ] **Step 6: Gates and commit**

```bash
vendor/bin/pint --dirty --format agent
vendor/bin/sail composer types:check
git add app/Actions/Integrations/BuildRetroRecap.php app/Support/Integrations/Messages app/Actions/Retros/BuildSummaryInput.php lang tests/Feature/Retros/TopicNotesRecapTest.php
git commit -m "feat(retro): discussion notes in the recap e-mail and the AI summary input

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

---

## Step B — front foundation (main, after lanes T, V, D and R are merged)

### Task 10: Types, reducer actions, channel events, the nudge listener

**Files:**
- Modify: `resources/js/lib/retro/types.ts`, `board-reducer.ts` (+ `board-reducer.test.ts`), `adapters.ts` (+ `adapters.test.ts`), `resources/js/hooks/use-retro-board.ts`, `resources/js/components/retro/board-context.tsx`, `resources/js/components/retro/phase-voting-bar.tsx` (`useCardVote` only, + its test), every test fixture of a `Snapshot` that `npm run types:check` flags (add the new keys with their empty values)

Read first: `types.ts` (`Snapshot`, `BoardCard`, `CardPayload`, `RotiState`, the board's `ActionItem`), `board-reducer.ts` (`timer.set`, `roti.set`), `adapters.ts` (`cardVoting`, `CardVoting`), `use-retro-board.ts` (`onEvent`, `subscribeGameEvents` — the pattern of a listener set exposed through the context).

**Interfaces:**
- Consumes: the snapshot keys of Task 1 and the events of Tasks 2 to 8 and 23 (`timer.changed` with three keys, `voting.finished`, `writing.count`, `topic.discussed`, `topic.note.saved`, `roti.revealed`, `roti.nudged`); the vote answer's `finishedIds` (Task 5).
- Produces:
  - types: `TopicNote = { cardId: string; body: string; version: number; updatedAt: string | null }`; `TimerState = { timerEndsAt: string | null; timerPausedSeconds: number | null; topicSeconds: number | null }`; `Snapshot.retro` gains `timerPausedSeconds: number | null`, `topicSeconds: number | null`, `maxVotesPerCard: number | null`, `maxVotesPerCardSetting: number | null`; `Snapshot` gains `voting: { finishedIds: string[] }` and `topicNotes: TopicNote[]`; `RotiState` gains `revealed: boolean` and `results: RotiResults | null`; `BoardCard` and `CardPayload` gain `discussedAt: string | null`; the board's `ActionItem` gains `cardId: string | null`.
  - reducer actions: `{ type: 'timer.set'; timerEndsAt: string | null; timerPausedSeconds?: number | null; topicSeconds?: number | null }` (the two new fields optional: callers that send only the end keep working); `{ type: 'voting.finished'; finishedIds: string[] }`; `{ type: 'topic.discussed'; cardId: string; discussedAt: string | null }`; `{ type: 'topicNote.set'; note: TopicNote }`.
  - `CardVoting.blocked: 'locked' | 'spent' | 'cap' | null` and `CardVoting.maxPerCard: number | null`; `cardVoting(card, board: Pick<Snapshot, 'retro' | 'viewer'>)` — "finished" never blocks a vote (decision 10, B).
  - `useCardVote` (`phase-voting-bar.tsx`): its `Tally` type gains `finishedIds: string[] | null`; when non-null it applies `{ type: 'voting.finished', finishedIds }` after the tally.
  - `BoardContextValue.subscribeRotiNudges: (listener: () => void) => () => void` and `BoardContextValue.subscribeWritingCount: (listener: (count: number) => void) => () => void` (the count is transient: it never enters the snapshot or the reducer).

- [ ] **Step 1: Failing reducer and adapter tests**

Append to `resources/js/lib/retro/board-reducer.test.ts`:

```ts
describe('boardReducer facilitation', () => {
    const base = {
        retro: {
            timerEndsAt: '2026-10-21T10:00:00Z',
            timerPausedSeconds: null,
            topicSeconds: 300,
        },
        voting: { finishedIds: [] },
        cards: [
            { id: 'a', discussedAt: null },
            { id: 'b', discussedAt: null },
        ],
        topicNotes: [
            { cardId: 'a', body: 'old', version: 2, updatedAt: null },
        ],
    } as unknown as Snapshot;

    it('pauses the timer and keeps the time per topic when the event does not say it', () => {
        const next = boardReducer(base, {
            type: 'timer.set',
            timerEndsAt: null,
            timerPausedSeconds: 42,
        });

        expect(next.retro).toMatchObject({
            timerEndsAt: null,
            timerPausedSeconds: 42,
            topicSeconds: 300,
        });
    });

    it('keeps the paused seconds when an older caller sends the end only', () => {
        const paused = boardReducer(base, {
            type: 'timer.set',
            timerEndsAt: null,
            timerPausedSeconds: 42,
        });
        const next = boardReducer(paused, {
            type: 'timer.set',
            timerEndsAt: '2026-10-21T10:05:00Z',
        });

        expect(next.retro.timerPausedSeconds).toBe(42);
    });

    it('sets who has finished voting', () => {
        const next = boardReducer(base, {
            type: 'voting.finished',
            finishedIds: ['p1', 'p2'],
        });

        expect(next.voting.finishedIds).toEqual(['p1', 'p2']);
    });

    it('marks and unmarks a topic discussed', () => {
        const marked = boardReducer(base, {
            type: 'topic.discussed',
            cardId: 'b',
            discussedAt: '2026-10-21T10:01:00Z',
        });
        const unmarked = boardReducer(marked, {
            type: 'topic.discussed',
            cardId: 'b',
            discussedAt: null,
        });

        expect(marked.cards[1].discussedAt).toBe('2026-10-21T10:01:00Z');
        expect(unmarked.cards[1].discussedAt).toBeNull();
    });

    it('adds a note, replaces it with a newer version, and ignores an older one', () => {
        const added = boardReducer(base, {
            type: 'topicNote.set',
            note: { cardId: 'b', body: 'new', version: 1, updatedAt: null },
        });
        const newer = boardReducer(added, {
            type: 'topicNote.set',
            note: { cardId: 'a', body: 'newer', version: 3, updatedAt: null },
        });
        const older = boardReducer(newer, {
            type: 'topicNote.set',
            note: { cardId: 'a', body: 'stale', version: 2, updatedAt: null },
        });

        expect(added.topicNotes).toHaveLength(2);
        expect(newer.topicNotes.find((n) => n.cardId === 'a')?.body).toBe(
            'newer',
        );
        expect(older).toBe(newer);
    });
});
```

Append to `resources/js/lib/retro/adapters.test.ts`:

```ts
describe('cardVoting with a cap, and a finished voter', () => {
    const board = (overrides: {
        maxVotesPerCard?: number | null;
        finishedIds?: string[];
        remainingVotes?: number;
    }) =>
        ({
            retro: {
                phase: 'voting',
                isLocked: false,
                maxVotesPerCard: overrides.maxVotesPerCard ?? null,
            },
            viewer: {
                participantId: 'me',
                remainingVotes: overrides.remainingVotes ?? 3,
            },
            voting: { finishedIds: overrides.finishedIds ?? [] },
        }) as unknown as Pick<Snapshot, 'retro' | 'viewer'>;
    const card = {
        id: 'c',
        parentCardId: null,
        hidden: false,
        votes: null,
        myVotes: 2,
    } as unknown as BoardCard;

    it('blocks a vote at the cap and still lets the vote go back', () => {
        expect(cardVoting(card, board({ maxVotesPerCard: 2 }))).toMatchObject({
            canVote: false,
            canUnvote: true,
            blocked: 'cap',
            maxPerCard: 2,
        });
    });

    it('lets a viewer who has finished still vote both ways (decision 10, B)', () => {
        expect(
            cardVoting(card, board({ finishedIds: ['me'] })),
        ).toMatchObject({ canVote: true, canUnvote: true, blocked: null });
    });

    it('says the budget is spent before the cap', () => {
        expect(
            cardVoting(card, board({ maxVotesPerCard: 2, remainingVotes: 0 })),
        ).toMatchObject({ blocked: 'spent' });
    });
});
```

(Use the board fixture the existing `cardVoting` tests use for `isBoardEditable`: if it reads more than `retro.isLocked` and `retro.phase`, copy those keys into `board()`.)

- [ ] **Step 2: Run them to see them fail**

Run: `npm run test -- board-reducer adapters`
Expected: FAIL (unknown action types; `blocked` has no `cap`).

- [ ] **Step 3: Implementation**

`board-reducer.ts`, the cases:

```ts
        case 'timer.set':
            return {
                ...state,
                retro: {
                    ...state.retro,
                    timerEndsAt: action.timerEndsAt,
                    timerPausedSeconds:
                        action.timerPausedSeconds === undefined
                            ? state.retro.timerPausedSeconds
                            : action.timerPausedSeconds,
                    topicSeconds:
                        action.topicSeconds === undefined
                            ? state.retro.topicSeconds
                            : action.topicSeconds,
                },
            };
        case 'voting.finished':
            return { ...state, voting: { finishedIds: action.finishedIds } };
        case 'topic.discussed':
            return {
                ...state,
                cards: state.cards.map((card) =>
                    card.id === action.cardId
                        ? { ...card, discussedAt: action.discussedAt }
                        : card,
                ),
            };
        case 'topicNote.set': {
            const current = state.topicNotes.find(
                (note) => note.cardId === action.note.cardId,
            );

            if (current !== undefined && current.version >= action.note.version) {
                return state;
            }

            return {
                ...state,
                topicNotes: [
                    ...state.topicNotes.filter(
                        (note) => note.cardId !== action.note.cardId,
                    ),
                    action.note,
                ],
            };
        }
```

`adapters.ts`:

```ts
export type CardVoting = {
    votes: { total: number | null; mine: number };
    canVote: boolean;
    canUnvote: boolean;
    /** Why "Add a vote" is disabled; the first reason that applies. */
    blocked: 'locked' | 'spent' | 'cap' | null;
    /** The cap in force, for the dots of a group; null without one. */
    maxPerCard: number | null;
};

function voteBlock(
    card: BoardCard,
    board: Pick<Snapshot, 'retro' | 'viewer'>,
): CardVoting['blocked'] {
    if (!isBoardEditable(board)) {
        return 'locked';
    }

    if (board.viewer.remainingVotes <= 0) {
        return 'spent';
    }

    const cap = board.retro.maxVotesPerCard;

    if (cap !== null && card.myVotes >= cap) {
        return 'cap';
    }

    return null;
}

export function cardVoting(
    card: BoardCard,
    board: Pick<Snapshot, 'retro' | 'viewer'>,
): CardVoting | null {
    if (board.retro.phase !== 'voting') {
        return null;
    }

    if (card.parentCardId !== null || card.hidden) {
        return null;
    }

    const blocked = voteBlock(card, board);

    return {
        votes: { total: card.votes, mine: card.myVotes },
        canVote: blocked === null,
        canUnvote: blocked !== 'locked' && card.myVotes > 0,
        blocked,
        maxPerCard: board.retro.maxVotesPerCard,
    };
}
```

(Keep the existing `CardVoting` fields and their meaning; if `votes` has another shape in the file, keep that shape.) `cardVoting` does not read `voting`: a finished viewer votes as before, and the server takes "finished" back (Task 5).

`phase-voting-bar.tsx`, `useCardVote`: `Tally` gains `finishedIds: string[] | null`; after the two `ctx.apply` calls of the answer:

```ts
                if (tally.finishedIds !== null) {
                    ctx.apply({
                        type: 'voting.finished',
                        finishedIds: tally.finishedIds,
                    });
                }
```

Its Vitest (in `phase-voting-bar.test.tsx`, or the file that tests `useCardVote`): an answer with `finishedIds: ['p2']` applies `voting.finished`; an answer with `finishedIds: null` does not.

`use-retro-board.ts`, in `onEvent`:

```ts
                case 'timer.changed':
                    apply({
                        type: 'timer.set',
                        timerEndsAt: payload.timerEndsAt as string | null,
                        timerPausedSeconds: payload.timerPausedSeconds as
                            | number
                            | null,
                        topicSeconds: payload.topicSeconds as number | null,
                    });
                    break;
                case 'voting.finished':
                    apply({
                        type: 'voting.finished',
                        finishedIds: payload.finishedIds as string[],
                    });
                    break;
                case 'topic.discussed':
                    apply({
                        type: 'topic.discussed',
                        cardId: payload.cardId as string,
                        discussedAt: payload.discussedAt as string | null,
                    });
                    break;
                case 'topic.note.saved':
                    apply({
                        type: 'topicNote.set',
                        note: payload.note as TopicNote,
                    });
                    break;
                case 'roti.revealed':
                    void refetch();
                    break;
                case 'roti.nudged':
                    rotiNudgeListeners.current.forEach((listener) => listener());
                    break;
                case 'writing.count':
                    writingCountListeners.current.forEach((listener) =>
                        listener(payload.count as number),
                    );
                    break;
```

with `const rotiNudgeListeners = useRef(new Set<() => void>());` and, returned with the board value as `subscribeGameEvents` is, `subscribeRotiNudges: (listener) => { rotiNudgeListeners.current.add(listener); return () => rotiNudgeListeners.current.delete(listener); }` (wrapped in `useCallback`). `subscribeWritingCount` is built the same way over `const writingCountListeners = useRef(new Set<(count: number) => void>());`. `board-context.tsx` declares both in `BoardContextValue`. Add `'timer.changed'`, `'voting.finished'`, `'writing.count'`, `'topic.discussed'`, `'topic.note.saved'`, `'roti.revealed'`, `'roti.nudged'` to the list of event names the channel hook listens to, if the hook keeps one (read `use-retro-channel` or the place `onEvent` is wired).

Every board fixture the type check flags (Vitest files, `pages/dev/sections/*`) gains `voting: { finishedIds: [] }`, `topicNotes: []`, the four `retro` keys at `null`, `roti.revealed: false`, `roti.results: null`, `discussedAt: null` on cards and `cardId: null` on items.

- [ ] **Step 4: Run the tests and the gates**

Run: `npm run test -- board-reducer adapters use-retro-board phase-voting-bar`, `npm run types:check`, `npm run check`, `npm run build:front`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add resources/js
git commit -m "feat(retro): front types, reducer actions and channel events of retro facilitation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

---

## Step C — the screens (lanes in parallel, cut from the head of Task 10)

Screen tasks carry the pure logic in full (with its Vitest) and, for the components, the composition, the behaviours, the states and the hooks later tests rely on: the mockup is the specification of the markup (plan 18e's screen procedure). Every task ends with its Vitest, `npm run types:check`, `npm run check`, `npm run build:front`, and one commit with the two trailers.

### Task 11 (lane W): Who is writing, moving a card, taking notes; the writing count of an anonymous retro (RT-1, decision 1 C)

**Mockups:** `ScreenRetroWriting` ("Inès écrit une carte…", ringed avatar), `ScreenRetroGrouping` ("Yuki déplace une carte…"), `ScreenRetroDiscussion` ("Inès prend des notes…"), `PresenceStack` (typing). Deviation P21-05.

**Files:**
- Create: `resources/js/lib/retro/activity.ts` (+ `activity.test.ts`), `resources/js/hooks/use-retro-activity.ts` (+ test), `resources/js/components/retro/activity-line.tsx` (+ test)
- Modify: `components/retro/board.tsx` (provides the activity), `board-column.tsx` (`typing`, `moving` slots filled), `columns-board.tsx` (send `moving` on drag start, end on drop and cancel), the card editor of a column (send `writing` on keystrokes; find it from `board-column.tsx`'s composing state), `board-topbar.tsx` (`BoardPresence` passes `typing` per member, or the count, to `SessionPresence`), `components/session/session-presence.tsx` (`typingFor?: (member) => boolean`, `typingCount?: number`, own commit), `components/skrum/presence-stack.tsx` (`typingCount?: number`, + its test, own commit)

**Interfaces:**
- Consumes: `presence: WhisperChannel | null`, `online`, `board.retro.{phase,isAnonymous}`, `board.viewer.participantId`, `subscribeWritingCount` (context, Task 10); `whisperTransport` (`lib/realtime/whisper-transport.ts`); routes `retros.writing.update|destroy` (Task 23, Wayfinder `RetroWritersController`).
- Produces: `useRetroActivity(): { entries: ActivityEntry[]; writingCount: number; announce: (kind: ActivityKind, targetId: string) => void; end: (kind: ActivityKind, targetId: string) => void }` (`writingCount`: others writing on an anonymous retro, 0 elsewhere), exposed to the board's components through a small `ActivityContext` in `use-retro-activity.ts` (`ActivityProvider`, `useActivity`); `ActivityLine({ kind, targetId })`.

- [ ] **Step 1: The pure logic, test first**

`resources/js/lib/retro/activity.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
    activityNames,
    applyActivity,
    kindsShownIn,
    liveActivity,
    othersWriting,
    parseActivity,
    WritingCountTtlMs,
} from './activity';

describe('parseActivity', () => {
    it('reads a well-formed message and nothing else', () => {
        expect(
            parseActivity({ kind: 'writing', targetId: 'col', active: true }),
        ).toEqual({ kind: 'writing', targetId: 'col', active: true });
        expect(parseActivity({ kind: 'shouting', targetId: 'col', active: true })).toBeNull();
        expect(parseActivity({ kind: 'writing', active: true })).toBeNull();
        expect(parseActivity('writing')).toBeNull();
    });
});

describe('kindsShownIn', () => {
    it('shows writing in Writing, moving in Writing and Grouping, notes in Discussing', () => {
        expect(kindsShownIn('writing', false)).toEqual(['writing', 'moving']);
        expect(kindsShownIn('grouping', false)).toEqual(['moving']);
        expect(kindsShownIn('discussing', false)).toEqual(['notes']);
        expect(kindsShownIn('voting', false)).toEqual([]);
    });

    it('never takes a writing client event on an anonymous retro (the count goes through the server)', () => {
        expect(kindsShownIn('writing', true)).toEqual(['moving']);
    });
});

describe('othersWriting', () => {
    const at = (count: number, receivedAt: number) => ({ count, receivedAt });

    it('leaves the viewer out of the count', () => {
        expect(othersWriting(at(3, 0), true, 1000)).toBe(2);
        expect(othersWriting(at(3, 0), false, 1000)).toBe(3);
        expect(othersWriting(at(1, 0), true, 1000)).toBe(0);
        expect(othersWriting(at(0, 0), true, 1000)).toBe(0);
    });

    it('drops a count that has not been refreshed for eight seconds', () => {
        expect(othersWriting(at(2, 0), false, WritingCountTtlMs - 1)).toBe(2);
        expect(othersWriting(at(2, 0), false, WritingCountTtlMs)).toBe(0);
        expect(othersWriting(null, false, 0)).toBe(0);
    });
});

describe('applyActivity and liveActivity', () => {
    it('adds an entry, refreshes it, and removes it when it ends', () => {
        const started = applyActivity(
            [],
            'p1',
            { kind: 'writing', targetId: 'col', active: true },
            1000,
        );
        const refreshed = applyActivity(
            started,
            'p1',
            { kind: 'writing', targetId: 'col', active: true },
            3000,
        );
        const ended = applyActivity(
            refreshed,
            'p1',
            { kind: 'writing', targetId: 'col', active: false },
            3500,
        );

        expect(started).toEqual([
            { senderId: 'p1', kind: 'writing', targetId: 'col', expiresAt: 6000 },
        ]);
        expect(refreshed).toHaveLength(1);
        expect(refreshed[0].expiresAt).toBe(8000);
        expect(ended).toEqual([]);
    });

    it('moves a writer to another column', () => {
        const first = applyActivity(
            [],
            'p1',
            { kind: 'writing', targetId: 'a', active: true },
            0,
        );
        const moved = applyActivity(
            first,
            'p1',
            { kind: 'writing', targetId: 'b', active: true },
            100,
        );

        expect(moved.map((entry) => entry.targetId)).toEqual(['b']);
    });

    it('forgets an entry five seconds after its last message', () => {
        const entries = applyActivity(
            [],
            'p1',
            { kind: 'moving', targetId: 'card', active: true },
            0,
        );

        expect(liveActivity(entries, 4999)).toHaveLength(1);
        expect(liveActivity(entries, 5000)).toHaveLength(0);
    });
});

describe('activityNames', () => {
    it('names the people of one kind on one target, in the order they started', () => {
        const entries = [
            { senderId: 'p2', kind: 'writing', targetId: 'a', expiresAt: 9 },
            { senderId: 'p1', kind: 'writing', targetId: 'a', expiresAt: 9 },
            { senderId: 'p3', kind: 'writing', targetId: 'b', expiresAt: 9 },
            { senderId: 'p4', kind: 'moving', targetId: 'a', expiresAt: 9 },
        ] as const;
        const names: Record<string, string> = { p1: 'Inès', p2: 'Malik' };

        expect(
            activityNames([...entries], 'writing', 'a', (id) => names[id] ?? '?'),
        ).toEqual(['Malik', 'Inès']);
    });
});
```

`resources/js/lib/retro/activity.ts`:

```ts
import type { RetroPhase } from './types';

export type ActivityKind = 'writing' | 'moving' | 'notes';

export type ActivityMessage = {
    kind: ActivityKind;
    /** A column (writing), a card (moving) or the lead card of a topic (notes). */
    targetId: string;
    active: boolean;
};

export type ActivityEntry = {
    senderId: string;
    kind: ActivityKind;
    targetId: string;
    expiresAt: number;
};

/** A receiver forgets an entry this long after its last message. */
export const ActivityTtlMs = 5000;

/** A sender repeats an ongoing activity at most this often. */
export const ActivityRefreshMs = 2000;

/** Anonymous retro: the writing heartbeat to the server (spec §6.11 rule 1). */
export const WritingHeartbeatMs = 3000;

/** Anonymous retro: a count not refreshed for this long is dropped (rule 5). */
export const WritingCountTtlMs = 8000;

export type WritingCount = { count: number; receivedAt: number };

const Kinds: ActivityKind[] = ['writing', 'moving', 'notes'];

export function parseActivity(raw: unknown): ActivityMessage | null {
    if (typeof raw !== 'object' || raw === null) {
        return null;
    }

    const { kind, targetId, active } = raw as Record<string, unknown>;

    if (!Kinds.includes(kind as ActivityKind)) {
        return null;
    }

    if (typeof targetId !== 'string' || targetId === '') {
        return null;
    }

    if (typeof active !== 'boolean') {
        return null;
    }

    return { kind: kind as ActivityKind, targetId, active };
}

/**
 * Which client events a phase takes. On an anonymous retro `writing` is never
 * a client event — its presence id and column would tie the hidden card to
 * its author — and goes through the server as a count (spec §6.11).
 */
export function kindsShownIn(
    phase: RetroPhase,
    isAnonymous: boolean,
): ActivityKind[] {
    if (phase === 'writing') {
        return isAnonymous ? ['moving'] : ['writing', 'moving'];
    }

    if (phase === 'grouping') {
        return ['moving'];
    }

    if (phase === 'discussing') {
        return ['notes'];
    }

    return [];
}

export function applyActivity(
    entries: ActivityEntry[],
    senderId: string,
    message: ActivityMessage,
    now: number,
): ActivityEntry[] {
    const isSame = (entry: ActivityEntry): boolean =>
        entry.senderId === senderId && entry.kind === message.kind;
    const others = entries.filter((entry) => !isSame(entry));

    if (!message.active) {
        return others;
    }

    const next: ActivityEntry = {
        senderId,
        kind: message.kind,
        targetId: message.targetId,
        expiresAt: now + ActivityTtlMs,
    };
    const index = entries.findIndex(
        (entry) => isSame(entry) && entry.targetId === message.targetId,
    );

    if (index === -1) {
        return [...others, next];
    }

    // A refresh keeps its place: names are listed in the order people started.
    return entries.flatMap((entry, position) => {
        if (position === index) {
            return [next];
        }

        return isSame(entry) ? [] : [entry];
    });
}

export function liveActivity(
    entries: ActivityEntry[],
    now: number,
): ActivityEntry[] {
    return entries.filter((entry) => entry.expiresAt > now);
}

/** How many other people are writing on an anonymous retro (spec §6.11 rule 5). */
export function othersWriting(
    last: WritingCount | null,
    viewerIsWriting: boolean,
    now: number,
): number {
    if (last === null || now - last.receivedAt >= WritingCountTtlMs) {
        return 0;
    }

    return Math.max(0, last.count - (viewerIsWriting ? 1 : 0));
}

export function activityNames(
    entries: ActivityEntry[],
    kind: ActivityKind,
    targetId: string,
    nameOf: (senderId: string) => string,
): string[] {
    return entries
        .filter((entry) => entry.kind === kind && entry.targetId === targetId)
        .map((entry) => nameOf(entry.senderId));
}
```

- [ ] **Step 2: The hook**

`use-retro-activity.ts`: inside the board, `useRetroActivity()` holds `entries` in state; on `presence` (re)binding it listens with `whisperTransport(presence, 'activity', accept)` where `accept(senderId)` is true when `senderId !== viewer.participantId` and `online` has `senderId`; each accepted message is parsed with `parseActivity`, dropped when its kind is not in `kindsShownIn(phase, isAnonymous)`, and applied with `applyActivity(…, Date.now())`. A one-second interval replaces `entries` with `liveActivity(entries, Date.now())` while any entry exists. `announce(kind, targetId)` sends `{kind, targetId, active: true}` at most once per `ActivityRefreshMs` per `kind:targetId` (a `useRef` map of last send times), and never a kind its own phase does not show (so an anonymous retro sends no `writing`); `end(kind, targetId)` sends `active: false` once and clears the throttle. On unmount, and when the phase changes, it ends whatever it announced.

**Anonymous retro in Writing (decision 1, C; spec §6.11).** `announce('writing', columnId)` never whispers: it sends `PUT retros.writing.update` (no body) at most once per `WritingHeartbeatMs`, and `end('writing', …)` sends `DELETE retros.writing.destroy` once (also on `pagehide`, unmount and leaving Writing); the column id stays in the browser. Each answer and each `writing.count` event (through `subscribeWritingCount`) sets `last = { count, receivedAt: Date.now() }`; a one-second interval re-renders while `last` is set; `writingCount = othersWriting(last, viewerIsWriting, Date.now())`, where `viewerIsWriting` is true between the first announce and the end. Leaving Writing sets `last` to null. A failed heartbeat (429, network) is ignored: the next one retries. A `writing` whisper that arrives anyway is dropped by `kindsShownIn`.

The names come from `online` with the cursors' rule (`showsRetroCursors` is not consulted; the label is "Participant" on an anonymous retro: reuse the `labelFor` of `board-cursors.tsx`, moved to `lib/retro/activity.ts` as `activityLabel(member, isAnonymous, t)` with its test).

Vitest of the hook, with a fake `WhisperChannel` (`listen` stores the callback, `whisper` records): a message from an online member appears and expires after 5 s (fake timers); a message whose metadata `user_id` is the viewer, or a member not online, is ignored; a `writing` message on an anonymous retro is ignored; `announce` twice within 2 s sends once; **on an anonymous retro `announce('writing', …)` never calls `whisper`** (spec §6.11 rule 4: assert the fake channel recorded no `writing` message at all), sends one `PUT` per 3 s with an empty body, and `end` sends one `DELETE`; a `writing.count` of 3 while the viewer writes gives `writingCount` 2, and 0 eight seconds later without a new count; `end` sends `active: false`; changing the phase to Voting sends the `end` of an announced `moving`.

- [ ] **Step 3: Components and wiring**

| Part | Content | Behaviour |
|---|---|---|
| `activity-line.tsx` | `ActivityLine({ kind, targetId })`: the trema (two dots, `animate-trema`, `motion-reduce:animate-none`, coloured with the first person's presence colour as `board-cursors` colours a cursor) and the sentence: writing — ":name is writing a card…", ":first and :second are writing cards…", ":name and :count others are writing cards…"; moving — ":name is moving a card…" (two or more: ":name and :count others are moving cards…"); notes — ":name is taking notes…" | renders nothing without a live entry; `role="status"`, `aria-live="polite"`; truncates on one line |
| column, Writing | `BoardColumn typing={<ActivityLine kind="writing" targetId={column.id} />}` | under the cards, above "Add a card" (the mockup) |
| column, Grouping and Writing | `moving={<ActivityLine kind="moving" targetId={…} />}`, with `targetId` every card of the column: `ActivityLine` takes `targetIds?: string[]` for this use | the line sits under the cards of the column the moved card belongs to |
| presence | `BoardPresence` passes `typingFor={(member) => entries.some((e) => e.kind === 'writing' && e.senderId === member.id)}` to `SessionPresence`, which sets `typing` on the `PresenceStack` participant | the existing ring and the stack's ":names is writing…" line |
| presence, anonymous retro | `BoardPresence` passes `typingCount={writingCount}` (and no `typingFor`); `SessionPresence` forwards it; `PresenceStack` (own commit) shows, when `typingCount > 0` and no participant has `typing`, the trema and t('Someone is writing…') (1) or t(':count people are writing…', { count }) (2 or more) in its `presence-stack-typing` line | no ring, no name, no column line (`ActivityLine kind="writing"` renders nothing on an anonymous retro); P21-05 |
| editor | the card editor calls `announce('writing', columnId)` on each change of a non-empty text, `end('writing', columnId)` on publish, cancel, blur and unmount | also for the edit of an existing card in Writing |
| drag | `columns-board.tsx`: `onDragStart` → `announce('moving', cardId)`; `onDragEnd` and `onDragCancel` → `end('moving', cardId)`; a keyboard pick-up goes through the same dnd-kit callbacks | the phone's "Add to group…" drawer sends nothing (no drag) |

The `notes` kind is wired by Task 15 (it uses `announce`/`end` and `ActivityLine kind="notes"`).

- [ ] **Step 4: Tests kept for later**: `data-slot="retro-activity"` on the line with `data-kind`; the presence ring is the existing `PresenceStack` one; the anonymous count is in `data-slot="presence-stack-typing"`. `PresenceStack`'s Vitest: `typingCount` 1 and 3 give the two sentences, 0 renders nothing, named `typing` participants win over the count.

- [ ] **Step 5: Gates and commits**

`npm run test -- activity use-retro-activity activity-line board-column columns-board session-presence presence-stack`, `npm run types:check`, `npm run check`, `npm run build:front`.

```bash
git commit -m "feat(skrum): PresenceStack — a count of people writing, without names

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
git commit -m "feat(session): SessionPresence takes who is typing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
git commit -m "feat(retro): who is writing, moving a card or taking notes, live

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

### Task 12 (lane W): Pause in the timer and the facilitator bar (RT-2)

**Mockups:** `ScreenRetroWriting` (FacilitatorBar: "Pause", "+2 min"), `FacilitatorBar` (timer + pause; `T` key), `Timer` (paused state). 

**Files:**
- Modify: `components/session/session-timer.tsx` (+ test, own commit), `components/retro/board-topbar.tsx` (`BoardTimer`), `components/retro/facilitator-dock.tsx` (+ `facilitator-dock.test.tsx`)

**Interfaces:**
- Consumes: `retro.timerPausedSeconds` (Task 10); routes `retros.timer.pause.update|destroy` (Wayfinder `RetroTimerPausesController`); `timer.set` with three fields.
- Produces: `SessionTimer` props `pausedSeconds?: number | null`, `onPause?: () => void`, `onResume?: () => void`; `FacilitatorTools.timer?: { paused: boolean; running: boolean; onPause: () => void; onResume: () => void }`.

- [ ] **Step 1: `facilitatorActions`, test first.** In `facilitator-dock.test.tsx`: with `tools.timer = { running: true, paused: false, … }` in Writing, the first action is `{ id: 'pause', label: 'Pause' }`; paused, it is `{ id: 'pause', label: 'Resume', pressed: true }`; in Icebreaker, or with neither a running nor a paused timer, there is no `pause` action; in Voting, Discussing, Actions and ROTI the pause action comes first, before the existing ones. Then the code: in `facilitatorActions`, a `pause` action (`Pause` / `Play` icons, `kind: 'toggle'`, `pressed: paused`) prepended to every phase's list except Icebreaker and Completed when `timer && (timer.running || timer.paused)`.
- [ ] **Step 2: `SessionTimer` (own commit).** When `pausedSeconds` is a number, `Timer` receives `remainingSeconds={pausedSeconds}`, `paused`, `onPause`/`onResume`; when not, as today (`useCountdown`), with `onPause` when given. The alarm hook gets `null` while paused. Vitest: paused renders the pause state and the seconds; a resume button calls `onResume`; no alarm while paused.
- [ ] **Step 3: `BoardTimer`.** Passes `pausedSeconds={retro.timerPausedSeconds}`, and for the facilitator of an open retro outside Icebreaker `onPause` (PUT pause) and `onResume` (DELETE pause), each applying the answer with `ctx.apply({ type: 'timer.set', ...response })`. The FacilitatorDock builds `tools.timer` from the same two calls, so the bar's "Pause" and the timer's toggle do the same thing. `start` and `+2 min` apply the three keys they now receive.
- [ ] **Step 4: States**: running; paused (bar "Resume", timer paused icon and muted digits, screen reader "Paused, :time"); "+2 min" on a paused timer adds to the paused time; Icebreaker (no pause anywhere).
- [ ] **Step 5: Gates and commits** (`npm run test -- session-timer facilitator-dock board-topbar`; the gates).

```bash
git commit -m "feat(session): SessionTimer shows a paused timer and its pause control

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
git commit -m "feat(retro): pause and resume from the facilitator bar and the timer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

### Task 13 (lane Vf): The cap per card and "I have finished voting" on screen (RT-3, RT-4)

**Mockups:** `ScreenRetroVote` ("2 votes restants · sur 5 · max 2 par carte", "5/8 ont terminé"), `VoteDots` (`maxPerCard`, disabled with tooltip), `ScreenSessionCreate` ("Max per card · Votes one person can stack"), `SessionSettingsPopover` ("Max par carte", stepper bounded by votes per person). Deviations P21-06, P21-10.

**Files:**
- Create: `resources/js/components/retro/voting-finished.tsx` (+ test)
- Modify: `components/retro/phase-voting-bar.tsx` (`cap`, `finished`, `done` filled by the board), `board.tsx` (passes them), `useVoteBlockedLabel` (in `phase-voting-bar.tsx`), the card and group vote controls (they read `CardVoting.maxPerCard`), `components/skrum/session-settings-popover.tsx` (+ test, own commit), `components/retro/board-settings.tsx`, `components/teams/session-create/retro-session-fields.tsx` (+ test)

**Interfaces:**
- Consumes: `retro.maxVotesPerCard`, `retro.maxVotesPerCardSetting`, `voting.finishedIds` (Task 10); `CardVoting.blocked` `'cap'` (Task 10; no `'finished'`: decision 10, B); the vote answer's `finishedIds` applied by `useCardVote` (Task 10); routes `retros.votingCompletion.update|destroy`; field `max_votes_per_card` of `teams.retros.store` and `retros.settings.update`.
- Produces: `finishedCount(board, online): { finished: number; total: number }` in `lib/retro/adapters.ts` (+ test): `total = online.length || 1` (the viewer alone before presence answers), `finished` = online members whose id is in `finishedIds`.

| Part | Content | Behaviour |
|---|---|---|
| `cap` | `t(' · max :count per card', { count })` after "of n" in `VoteBudget detail` | only when `maxVotesPerCard !== null`; stays in the phone's stuck budget |
| `finished` | `voting-finished.tsx` `FinishedCount`: "5/8 have finished" (`aria-label` ":finished of :total have finished") | live from `voting.finished` and presence |
| `done` | `FinishButton`: "I have finished voting" (outline, `CircleCheck`); once finished: "Change my votes" (ghost) | PUT / DELETE `voting-completion`, applying `voting.finished` from the answer; disabled while the request runs; hidden outside Voting |
| taken back by a vote | `FinishButton` watches the viewer's id leave `finishedIds` while no PUT/DELETE of its own is running: it returns to "I have finished voting" and an `aria-live="polite"` line says t("You changed your votes: you're no longer marked as finished.") for 5 s | decision 10, B: the vote buttons are never disabled for "finished" |
| card | `useVoteBlockedLabel`: `'cap'` → t('Max :count votes per card', {count}) | the vote button stays `aria-disabled` with the label as tooltip (VoteDots rule); a group's dots get `maxPerCard` |
| popover | in `useRetroSettingGroups`, Voting group, after `votes_per_participant`: a stepper `max_votes_per_card` "Max per card", help "Votes one person can stack", `min 1`, `max` = `context.votesPerParticipant`, `auto: { label: t('No limit per card'), fallback: min(2, votesPerParticipant) }`, the same `disabledReason` as the vote limit | read-only for a participant (the value, or "No limit") |
| creation | `retro-session-fields.tsx`: the row "Max per card" after "Votes per person" (the place 18e left), the same stepper with "No limit" on by default, bounded by the votes per person; sends `max_votes_per_card` (null when "No limit") | the form's error under the row |

States: no cap; at the cap on one card; finished (vote buttons still enabled, "Change my votes"); taken back by a vote (status line); everyone finished; phone (budget stuck with the cap, the finished line scrolls).

- [ ] **Step 1:** `finishedCount` with its Vitest (three cases: nobody online yet, two of three online finished, a finished participant who left is not counted).
- [ ] **Step 2:** `SessionSettingsPopover` row (own commit) and its Vitest (row present, bounded, "No limit" sends null, disabled after Grouping, read-only text for a participant).
- [ ] **Step 3:** the vote bar slots, `voting-finished.tsx` and its Vitest (count, finish, take back, error toast on a failed request; a `voting.finished` without the viewer, while finished and with no request of its own running, shows the status line and the "I have finished voting" button; the same change caused by its own DELETE shows no status line).
- [ ] **Step 4:** the card labels and the creation row with their Vitest.
- [ ] **Step 5: Gates and commits.**

```bash
git commit -m "feat(skrum): SessionSettingsPopover — Max per card

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
git commit -m "feat(retro): max votes per card and I have finished voting, on the board and at creation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

### Task 14 (lane Df): The topic timer, the estimate and the "discussed" mark (RT-5, RT-7)

**Mockup:** `ScreenRetroDiscussion` (topics list "Discussed · 2 actions", "Now · 04:12 left", footer "Topic 2 of 6 · ~ 20 min left · 5 min per topic · 3 actions so far"; stage "04:12 of 5:00 · this topic", "+1 min" → "+2 min"; "Up next … 5 min"). Deviations P21-01, P21-07.

**Files:**
- Create: `resources/js/lib/retro/topic-estimate.ts` (+ test), `resources/js/components/retro/topic-timer.tsx` (+ test), `resources/js/components/retro/topic-meta.tsx` (+ test)
- Modify: `components/retro/board.tsx` (passes `timer`, `topicMeta`, `estimate`; no topbar timer in Discussing), `phase-discussing.tsx` (the list's `estimate`, the up-next `estimate`, the "Discussed" toggle beside the topic title for the facilitator), `topics-list.tsx`, `topic-focus.tsx`, `phase-discussing.test.tsx`

**Interfaces:**
- Consumes: `retro.topicSeconds`, `retro.timerEndsAt`, `retro.timerPausedSeconds`, `cards[].discussedAt`, `actionItems[].cardId` (Task 10); `retros.cards.discussion.update|destroy`; the highlight answer's `timer` and `discussed` (Task 3); `useCountdown`; `BoardTimer` (Task 12 makes it pause-aware).
- Produces: `topicEstimateSeconds(input: { topics: Topic[]; sharedId: string | null; discussedIds: Set<string>; topicSeconds: number | null; sharedRemaining: number | null }): number | null`; `estimateMinutesLabel(seconds: number, t): string`; `actionCountByTopic(items: { cardId: string | null }[]): Map<string, number>` (in `lib/retro/topics.ts`, + test).

- [ ] **Step 1: The estimate, test first**

`resources/js/lib/retro/topic-estimate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { topicEstimateSeconds } from './topic-estimate';
import type { Topic } from './topics';

const topic = (id: string): Topic => ({
    id,
    leadCardId: id,
    title: id,
    votes: 0,
    columnId: 'c',
    cardIds: [id],
});
const topics = ['a', 'b', 'c', 'd', 'e', 'f'].map(topic);

describe('topicEstimateSeconds', () => {
    it('is nothing without a time per topic', () => {
        expect(
            topicEstimateSeconds({
                topics,
                sharedId: 'b',
                discussedIds: new Set(['a']),
                topicSeconds: null,
                sharedRemaining: 100,
            }),
        ).toBeNull();
    });

    it('adds what is left of the shared topic to a full time per topic for the others not discussed', () => {
        expect(
            topicEstimateSeconds({
                topics,
                sharedId: 'b',
                discussedIds: new Set(['a']),
                topicSeconds: 300,
                sharedRemaining: 252,
            }),
        ).toBe(252 + 4 * 300);
    });

    it('counts a full time for the shared topic when its timer is not running', () => {
        expect(
            topicEstimateSeconds({
                topics,
                sharedId: 'b',
                discussedIds: new Set(),
                topicSeconds: 300,
                sharedRemaining: null,
            }),
        ).toBe(6 * 300);
    });

    it('counts nothing for a shared topic already discussed', () => {
        expect(
            topicEstimateSeconds({
                topics,
                sharedId: 'a',
                discussedIds: new Set(['a', 'b', 'c', 'd', 'e']),
                topicSeconds: 300,
                sharedRemaining: 120,
            }),
        ).toBe(300);
    });
});
```

`resources/js/lib/retro/topic-estimate.ts`:

```ts
import type { Topic } from './topics';

type Translate = (key: string, replace?: Record<string, string | number>) => string;

/**
 * Time left for the discussion: what remains of the shared topic, and a
 * full time per topic for every other topic not yet discussed.
 */
export function topicEstimateSeconds({
    topics,
    sharedId,
    discussedIds,
    topicSeconds,
    sharedRemaining,
}: {
    topics: Topic[];
    sharedId: string | null;
    discussedIds: Set<string>;
    topicSeconds: number | null;
    sharedRemaining: number | null;
}): number | null {
    if (topicSeconds === null) {
        return null;
    }

    return topics.reduce((total, topic) => {
        if (discussedIds.has(topic.id)) {
            return total;
        }

        if (topic.id === sharedId && sharedRemaining !== null) {
            return total + sharedRemaining;
        }

        return total + topicSeconds;
    }, 0);
}

export function estimateMinutesLabel(seconds: number, t: Translate): string {
    if (seconds < 60) {
        return t('< 1 min left');
    }

    return t('~ :count min left', { count: Math.ceil(seconds / 60) });
}
```

`lib/retro/topics.ts` gains, with its test (three items on two topics and one without → `Map { a: 2, b: 1 }`):

```ts
/** How many action items each topic has, by the lead card's id. */
export function actionCountByTopic(
    items: { cardId: string | null }[],
): Map<string, number> {
    const counts = new Map<string, number>();

    for (const item of items) {
        if (item.cardId === null) {
            continue;
        }

        counts.set(item.cardId, (counts.get(item.cardId) ?? 0) + 1);
    }

    return counts;
}
```

- [ ] **Step 2: Components**

| Part | Content | Behaviour |
|---|---|---|
| `topic-timer.tsx` | in the `timer` slot of `PhaseDiscussing`: `BoardTimer` in the large size (`Timer size="lg"`), and under it "of 5:00 · this topic" (`t('of :total · this topic', {total})`) when `topicSeconds` is set and the topic in front of the viewer is the shared one; for another topic, nothing under it | the facilitator's menu 1/3/5/10 (starting it here stores the time per topic, Task 3), "+2 min", pause; low under a minute and done at 0 as `Timer` draws them |
| topbar | `board.tsx` renders no `BoardTimer` in the topbar while `phase === 'discussing'` (the stage has it) | the other phases unchanged (P21-07) |
| `topic-meta.tsx` | the `rowMeta` of `TopicsList` and the `topicMeta` of `PhaseDiscussing`: shared topic with a time per topic → "Now · mm:ss left" (`useCountdown`, or the paused seconds); discussed → `Check` + "Discussed · :count actions" ("Discussed" alone at 0, "Discussed · 1 action"); else ":count actions" when > 0 | `data-slot="retro-topic-meta"`, `data-state` `now`, `discussed` or `idle` |
| list footer | `estimate` of `TopicsList`: "Topic 2 of 6 · ~ 20 min left", and under it ":minutes min per topic · :count actions so far" | nothing of the two when `topicSeconds` is null (the existing "Topic n of m" stays) |
| up next | `estimate` of `TopicUpNext`: ":count min" (the time per topic) | only with a time per topic |
| mark | for the facilitator, a toggle button beside the focused topic's title: "Mark as discussed" / "Discussed" (`aria-pressed`), and the key `D` on a focused topic when single-key shortcuts are on (`useShortcut`, as `F` is wired in `DiscussionProvider`) | PUT / DELETE `cards/{card}/discussion`, applying `topic.discussed`; the highlight answer's `timer` and `discussed` are applied too (`DiscussionProvider.highlight` dispatches `timer.set` and `topic.discussed` from the response) |

States: no time per topic; running; low; done; paused; shared topic discussed; viewer on another topic than the shared one; phone (the selector "2/6" keeps the meta in the drawer's list).

- [ ] **Step 3: Tests**: Vitest of `topic-timer` (the "this topic" line only on the shared topic), `topic-meta` (the three states, singular and plural), `phase-discussing` (no topbar timer in Discussing; the toggle for the facilitator only; `D` toggles; the highlight answer applies the timer).
- [ ] **Step 4: Gates and commit.**

```bash
git commit -m "feat(retro): topic timer, time left for the discussion and the discussed mark

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

### Task 15 (lane Df): Discussion notes (RT-6)

**Mockup:** `ScreenRetroDiscussion` (right column, first card "Discussion notes" with "Saved", the lines, "Inès is taking notes…"). Decision 5 (one writer at a time).

**Files:**
- Create: `resources/js/lib/retro/note-editor.ts` (+ test), `resources/js/components/retro/topic-notes.tsx` (+ test)
- Modify: `components/retro/board.tsx` (passes `notes` to `PhaseDiscussing`)

**Interfaces:**
- Consumes: `topicNotes` and `topicNote.set` (Task 10); `PUT retros/{retro}/cards/{card}/notes` (Wayfinder `TopicNotesController.update`), 200 `{note}`, 409 `{note}`; `useActivity()` (`announce('notes', cardId)`, `end`, entries) and `ActivityLine kind="notes"` (Task 11).
- Produces: `noteEditorReducer(state: NoteEditorState, action: NoteEditorAction): NoteEditorState`, `initialNoteEditor(note: TopicNote): NoteEditorState`.

- [ ] **Step 1: The editor state, test first**

`resources/js/lib/retro/note-editor.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { initialNoteEditor, noteEditorReducer } from './note-editor';

const note = (body: string, version: number) => ({
    cardId: 'a',
    body,
    version,
    updatedAt: null,
});

describe('noteEditorReducer', () => {
    it('starts from the server note', () => {
        expect(initialNoteEditor(note('x', 2))).toEqual({
            draft: 'x',
            serverBody: 'x',
            serverVersion: 2,
            sentBody: null,
            status: 'idle',
            conflictText: null,
        });
    });

    it('marks an edit dirty, sends it, and settles on the saved note', () => {
        let state = initialNoteEditor(note('x', 2));

        state = noteEditorReducer(state, { type: 'edit', draft: 'xy' });
        expect(state.status).toBe('dirty');

        state = noteEditorReducer(state, { type: 'send' });
        expect(state).toMatchObject({ status: 'saving', sentBody: 'xy' });

        state = noteEditorReducer(state, { type: 'saved', note: note('xy', 3) });
        expect(state).toMatchObject({ status: 'saved', serverVersion: 3, draft: 'xy' });
    });

    it('stays dirty when typing went on while saving', () => {
        let state = noteEditorReducer(initialNoteEditor(note('', 0)), { type: 'edit', draft: 'a' });

        state = noteEditorReducer(state, { type: 'send' });
        state = noteEditorReducer(state, { type: 'edit', draft: 'ab' });
        state = noteEditorReducer(state, { type: 'saved', note: note('a', 1) });

        expect(state).toMatchObject({ status: 'dirty', draft: 'ab', serverVersion: 1 });
    });

    it('takes the server text on a conflict and keeps the own text aside', () => {
        let state = noteEditorReducer(initialNoteEditor(note('base', 1)), { type: 'edit', draft: 'mine' });

        state = noteEditorReducer(state, { type: 'send' });
        state = noteEditorReducer(state, { type: 'conflict', note: note('theirs', 2) });

        expect(state).toMatchObject({
            status: 'conflict',
            draft: 'theirs',
            serverVersion: 2,
            conflictText: 'mine',
        });

        state = noteEditorReducer(state, { type: 'dismissConflict' });
        expect(state).toMatchObject({ status: 'idle', conflictText: null });
    });

    it('follows a note from someone else only while the viewer has nothing unsaved', () => {
        const clean = noteEditorReducer(initialNoteEditor(note('a', 1)), { type: 'server', note: note('b', 2) });
        const dirty = noteEditorReducer(
            noteEditorReducer(initialNoteEditor(note('a', 1)), { type: 'edit', draft: 'mine' }),
            { type: 'server', note: note('b', 2) },
        );

        expect(clean).toMatchObject({ draft: 'b', serverVersion: 2, status: 'idle' });
        expect(dirty).toMatchObject({ draft: 'mine', serverVersion: 2, status: 'dirty' });
    });

    it('says a failed save', () => {
        let state = noteEditorReducer(initialNoteEditor(note('', 0)), { type: 'edit', draft: 'a' });

        state = noteEditorReducer(state, { type: 'send' });
        state = noteEditorReducer(state, { type: 'failed' });

        expect(state).toMatchObject({ status: 'failed', draft: 'a' });
    });
});
```

`resources/js/lib/retro/note-editor.ts`:

```ts
import type { TopicNote } from './types';

export type NoteEditorState = {
    draft: string;
    serverBody: string;
    serverVersion: number;
    /** The text of the save in flight. */
    sentBody: string | null;
    status: 'idle' | 'dirty' | 'saving' | 'saved' | 'failed' | 'conflict';
    /** The viewer's text a conflict replaced, kept on screen to copy. */
    conflictText: string | null;
};

export type NoteEditorAction =
    | { type: 'edit'; draft: string }
    | { type: 'send' }
    | { type: 'saved'; note: TopicNote }
    | { type: 'conflict'; note: TopicNote }
    | { type: 'failed' }
    | { type: 'server'; note: TopicNote }
    | { type: 'dismissConflict' };

export function initialNoteEditor(note: TopicNote): NoteEditorState {
    return {
        draft: note.body,
        serverBody: note.body,
        serverVersion: note.version,
        sentBody: null,
        status: 'idle',
        conflictText: null,
    };
}

function hasUnsaved(state: NoteEditorState): boolean {
    return state.status === 'dirty' || state.status === 'saving' || state.status === 'failed';
}

export function noteEditorReducer(
    state: NoteEditorState,
    action: NoteEditorAction,
): NoteEditorState {
    switch (action.type) {
        case 'edit':
            return { ...state, draft: action.draft, status: 'dirty' };
        case 'send':
            return { ...state, sentBody: state.draft, status: 'saving' };
        case 'saved':
            return {
                ...state,
                serverBody: action.note.body,
                serverVersion: action.note.version,
                sentBody: null,
                status: state.draft === state.sentBody ? 'saved' : 'dirty',
            };
        case 'conflict':
            return {
                ...state,
                draft: action.note.body,
                serverBody: action.note.body,
                serverVersion: action.note.version,
                sentBody: null,
                status: 'conflict',
                conflictText: state.draft,
            };
        case 'failed':
            return { ...state, sentBody: null, status: 'failed' };
        case 'server':
            if (action.note.version <= state.serverVersion) {
                return state;
            }

            if (hasUnsaved(state)) {
                return {
                    ...state,
                    serverBody: action.note.body,
                    serverVersion: action.note.version,
                };
            }

            return {
                ...state,
                draft: action.note.body,
                serverBody: action.note.body,
                serverVersion: action.note.version,
                status: 'idle',
            };
        case 'dismissConflict':
            return { ...state, conflictText: null, status: 'idle' };
    }
}
```

- [ ] **Step 2: The panel**

| Part | Content | Behaviour |
|---|---|---|
| `topic-notes.tsx` | a `Card` titled "Discussion notes" with the save state at the right ("Saving…", "Saved", "Not saved" + "Try again"); a `Textarea` (auto-grow, at most 5 000 characters, placeholder "What the room decides, the questions left open…"); under it `ActivityLine kind="notes" targetId={topic.leadCardId}`; on a conflict, an alert "Your text was not saved" with the text in a muted block and "Copy" | `key={topic.id}`: one editor per topic; `useReducer(noteEditorReducer, …)`; each change dispatches `edit` and `announce('notes', cardId)`; 800 ms after the last change, and on blur, it sends (`version: serverVersion`) unless a save is in flight; 200 → `saved` and `ctx.apply({type: 'topicNote.set'})`; 409 → `conflict` with the answer's `note`; another error → `failed`; a board note newer than the editor's (`topicNotes` from events) dispatches `server`; blur and unmount call `end('notes', cardId)` |
| read-only | while someone else has a live `notes` entry on this topic (`useActivity().entries`), the field is `readOnly` with `aria-describedby` on the activity line; on a locked board, read-only with "Board closed for editing"; outside Discussing the panel is not rendered | — |
| guests | the same as members (the server accepts them) | — |

States: empty; typing; saving; saved; not saved and retried; conflict; read-only while someone else types; locked; phone (the existing tabs drawer of the right column holds it first).

- [ ] **Step 3: Tests**: Vitest of `topic-notes` with a mocked request (debounced save after 800 ms with fake timers, the version sent, the 409 path shows the kept text, the read-only state from a seeded activity entry, the locked state).
- [ ] **Step 4: Gates and commit.**

```bash
git commit -m "feat(retro): shared discussion notes per topic, one writer at a time

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

### Task 16 (lane Af, after Df is merged): Action items of a topic, on every screen (RT-8)

**Mockups:** `ScreenRetroDiscussion` ("Topic actions", "Create an action", "Linked to #2 · Scope changes mid-sprint"), `ScreenRetroActions` (topic cards "2 actions liées", "Ajout rapide · lié à « CI instable »", the topic in each item's meta), `ScreenRetroROTI` frame c (each created action shows its topic). Deviation P21-09.

**Files:**
- Create: `resources/js/components/retro/topic-actions.tsx` (+ test)
- Modify: `components/retro/action-items-list.tsx` (a `filter` prop and the `linkedTo` passing a `card_id`), the create form it renders (`ItemCreateForm`: sends `card_id` when given), `phase-discussing.tsx` (the right column: "Topic actions" then "Other action items (n)"), `phase-actions.tsx` (`linkedTo`, `itemTopic`, `topicMeta` filled), `board.tsx`, `components/retro/results/action-items.tsx` (`sourceLabel` = the topic's title)

**Interfaces:**
- Consumes: `actionItems[].cardId` (Task 10), `actionCountByTopic` (Task 14), `topicsFrom`, `topicOfCard`, `useDiscussion().current` and `.shared`; `card_id` of `retros.action-items.store|update` (Task 7).
- Produces: `topicLabel(item: { cardId: string | null }, topics: Topic[]): { rank: number; title: string } | null` in `lib/retro/topics.ts` (+ test: an item on the second topic gives `{ rank: 2, title }`; an item without a card, or on a card that is not a topic of the board, gives `null`).

| Part | Content | Behaviour |
|---|---|---|
| Discussing, right column | `topic-actions.tsx`: a card "Topic actions" listing the items whose `cardId` is the lead card of the topic in front of the viewer (`ActionItemsList filter`), and its "Create an action" form whose first line reads "Linked to #2 · title" with a remove button (unlinking for this item only); then "Other action items (n)", a collapsed disclosure with every other item of the retro | the form sends `card_id` unless unlinked; the list follows the viewer's topic as it changes; when the viewer has no topic, only "Other action items" |
| Actions | `linkedTo`: "Quick add · linked to «title»" (the shared topic; nothing without one); `itemTopic`: the item's topic title in its meta line (`topicLabel`); `topicMeta`: "1 linked action" / ":count linked actions" | the quick add sends the shared topic's `card_id` |
| Discussing list | the action count of `topic-meta.tsx` (Task 14) uses `actionCountByTopic(board.actionItems)` | — |
| session end | `ActionsCreated` passes `sourceLabel: topicLabel(item, topicsFrom(board))?.title ?? null` | — |

- [ ] **Step 1:** `topicLabel` with its test.
- [ ] **Step 2:** `ActionItemsList` `filter?: (item) => boolean` and `linkedTo` carrying `{ cardId, label }` (adapt the existing `linkedTo?: ReactNode` into `linkedTo?: { cardId: string; label: ReactNode }`; the two callers of 18e pass nothing today); `ItemCreateForm` adds `card_id` to its payload; Vitest of both.
- [ ] **Step 3:** `topic-actions.tsx`, the Actions slots, the session end, with Vitest (an item created in Discussing carries the viewer's topic; after unlinking, the request carries no `card_id`; "Other action items (n)" counts the rest; Actions quick add carries the shared topic; the meta line shows the topic).
- [ ] **Step 4: Gates and commit.**

```bash
git commit -m "feat(retro): action items linked to their topic in Discussing, Actions and the session end

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

### Task 17 (lane Rf): Reveal the ROTI, nudge the last voters (RT-9)

**Mockup:** `ScreenRetroROTI` frames a and b ("Nudge the last 2", "Reveal ROTI", "End session"; the hidden distribution; "Who has voted"). Deviation P21-11.

**Files:**
- Create: `resources/js/components/retro/roti-facilitation.tsx` (+ test)
- Modify: `components/retro/phase-roti.tsx` (+ test), `board.tsx` (passes `roti` tools to `FacilitatorDock`)

**Interfaces:**
- Consumes: `roti.revealed`, `roti.results`, `roti.voterIds` (Task 10), `subscribeRotiNudges` (Task 10), `rotiVoters(board, online)` (existing), `toRotiResult` (`lib/retro/session-end.ts`); routes `retros.roti.reveal.update`, `retros.roti.nudges.store`.
- Produces: `useRotiFacilitation(): RotiTools` (the `nudge` and `reveal` actions of `FacilitatorDock`), `useRotiNudgeToast()`.

| Part | Content | Behaviour |
|---|---|---|
| nudge | `FacilitatorAction` "Nudge the last :count" ("Nudge the last one"), icon `BellRing` | `count` = connected people who have not voted (`rotiVoters` minus voted), guests included; disabled at 0, while the request runs, and for 30 s after a nudge (local timer; a 429 shows its message as a toast) |
| reveal | `FacilitatorAction` "Reveal ROTI", icon `Eye` | PUT reveal; on success refetch (the snapshot then carries `results`); hidden once revealed |
| phase body | before the reveal: as today, with P21-11's sentence; after: `ROTIWidget mode="result"` fed by `toRotiResult(board.roti.results)`, the line "Votes are closed.", "Who has voted" kept | a participant sees the result as soon as `roti.revealed` arrives (refetch) |
| nudge received | `useRotiNudgeToast` subscribes to `subscribeRotiNudges`; when the viewer is not the facilitator and `roti.myScore === null`: toast "Your ROTI vote is awaited", and the widget gets `data-nudged` for one `animate-nudge` run (none with reduced motion) | nothing for a viewer who has voted |

- [ ] **Step 1:** `useRotiFacilitation` and its Vitest (count from presence and voter ids; disabled at 0; disabled 30 s after a nudge with fake timers; reveal calls the route and refetches).
- [ ] **Step 2:** the phase body and the nudge toast, with Vitest (result mode once revealed; toast only for a non-voter; no toast for the facilitator).
- [ ] **Step 3: Gates and commit.**

```bash
git commit -m "feat(retro): reveal the ROTI in its phase and nudge the last voters

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

### Task 18 (lane Af): Bulk export of a retro's action items (RT-10)

**Mockup:** `ScreenRetroActions` ("Exporter vers Jira" in the header of the "Actions de la rétro" card). No mockup of the dialog (P21-08). Decision 9 (browser loop).

**Files:**
- Create: `resources/js/lib/action-items/bulk-export.ts` (+ test), `resources/js/components/action-items/export-target-fields.tsx` (+ test), `resources/js/components/retro/bulk-export-dialog.tsx` (+ test)
- Modify: `components/action-items/item-export.tsx` (+ its test: uses `ExportTargetFields`, behaviour unchanged), `components/retro/phase-actions.tsx` (`exportAll`), `board.tsx`

**Interfaces:**
- Consumes: `board.exportSources`, `board.actionItems` (`externalLinks`), `boardActionItemEndpoints(retroId).exportItem` (`lib/action-items/endpoints.ts`), `IntegrationTargetsController.index` (as `ItemExportDialog` loads targets), `retroRequest`.
- Produces: `runBulkExport(itemIds, exportOne, onProgress, shouldStop): Promise<BulkExportOutcome[]>`; `itemsToExport(items, source): ActionItem[]` (items without a link to that provider); `ExportTargetFields({ source, scope, teamId, value, onChange })` with `value: { projectId; issueTypeId; teamId; repositoryId }`.

- [ ] **Step 1: The runner, test first**

`resources/js/lib/action-items/bulk-export.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { BulkExportError, runBulkExport } from './bulk-export';

describe('runBulkExport', () => {
    it('exports one item after the other and reports each outcome', async () => {
        const order: string[] = [];
        const exportOne = vi.fn(async (id: string) => {
            order.push(id);

            if (id === 'b') {
                throw new BulkExportError(422, 'The project is archived.');
            }

            if (id === 'c') {
                throw new BulkExportError(409, 'Already exported as ATLAS-9.');
            }

            return { key: `ATLAS-${id}`, url: `https://jira/${id}` };
        });
        const progress = vi.fn();

        const outcomes = await runBulkExport(['a', 'b', 'c'], exportOne, progress, () => false);

        expect(order).toEqual(['a', 'b', 'c']);
        expect(outcomes).toEqual([
            { itemId: 'a', state: 'exported', key: 'ATLAS-a', url: 'https://jira/a' },
            { itemId: 'b', state: 'failed', message: 'The project is archived.' },
            { itemId: 'c', state: 'skipped', message: 'Already exported as ATLAS-9.' },
        ]);
        expect(progress).toHaveBeenCalledTimes(6);
    });

    it('stops after the item in progress', async () => {
        let stop = false;
        const exportOne = vi.fn(async (id: string) => {
            stop = true;

            return { key: id, url: id };
        });

        const outcomes = await runBulkExport(['a', 'b'], exportOne, () => {}, () => stop);

        expect(exportOne).toHaveBeenCalledTimes(1);
        expect(outcomes.map((outcome) => outcome.state)).toEqual(['exported', 'pending']);
    });

    it('turns an unknown error into a failure with no message', async () => {
        const outcomes = await runBulkExport(
            ['a'],
            async () => {
                throw new Error('network');
            },
            () => {},
            () => false,
        );

        expect(outcomes).toEqual([{ itemId: 'a', state: 'failed', message: null }]);
    });
});
```

`resources/js/lib/action-items/bulk-export.ts`:

```ts
export type BulkExportOutcome =
    | { itemId: string; state: 'pending' | 'running' }
    | { itemId: string; state: 'exported'; key: string; url: string }
    | { itemId: string; state: 'failed' | 'skipped'; message: string | null };

/** What the export of one item throws: the status and the server's message. */
export class BulkExportError extends Error {
    constructor(
        public status: number,
        message: string,
    ) {
        super(message);
    }
}

/**
 * Exports the items one by one through the endpoint of a single item, so
 * each keeps its own rights, lock and "already exported" check. A 409 is an
 * item someone exported meanwhile: skipped, not failed.
 */
export async function runBulkExport(
    itemIds: string[],
    exportOne: (itemId: string) => Promise<{ key: string; url: string }>,
    onProgress: (outcomes: BulkExportOutcome[]) => void,
    shouldStop: () => boolean,
): Promise<BulkExportOutcome[]> {
    const outcomes: BulkExportOutcome[] = itemIds.map((itemId) => ({
        itemId,
        state: 'pending',
    }));

    for (const [index, itemId] of itemIds.entries()) {
        if (shouldStop()) {
            break;
        }

        outcomes[index] = { itemId, state: 'running' };
        onProgress([...outcomes]);

        try {
            const { key, url } = await exportOne(itemId);

            outcomes[index] = { itemId, state: 'exported', key, url };
        } catch (error) {
            outcomes[index] =
                error instanceof BulkExportError
                    ? {
                          itemId,
                          state: error.status === 409 ? 'skipped' : 'failed',
                          message: error.message,
                      }
                    : { itemId, state: 'failed', message: null };
        }

        onProgress([...outcomes]);
    }

    return outcomes;
}
```

- [ ] **Step 2: Extract `ExportTargetFields`** from `ItemExportDialog` (the project search and select, the issue type, the Linear team, the GitHub repository, the defaults of the team's last choice): `item-export.tsx` renders it with the same behaviour; its existing Vitest passes unchanged (own commit: `refactor(action-items): the export target fields as a component of their own`).
- [ ] **Step 3: The button and the dialog**

| Part | Content | Behaviour |
|---|---|---|
| button | `exportAll` of `PhaseActions`: "Export to :provider" (`Upload` icon) when the team has one export source; with several, "Export" opening a menu of the sources | shown to a member (`!viewer.isGuest`) when `itemsToExport(board.actionItems, source)` is not empty for at least one source |
| dialog | `Dialog` (a `Drawer` on a phone) "Export to :provider": `ExportTargetFields`; the list of `itemsToExport`, each with a checkbox (all ticked) and its title; footer "Export :count items" / "Export 1 item" | the button is disabled until the target is complete and one item is ticked |
| running | the list shows each row's state: pending, a spinner "Exporting…", the key as a link, "Already exported", or the error; the header says "Exporting :current of :total…" | `runBulkExport` with `exportOne` = `retroRequest` to `endpoints.exportItem(id)` with `{source, …target}`; each answer applies `actionItem.upsert`; a closing attempt asks "Stop the export?" ("The items already exported stay in :provider. The others are not sent.", "Stop", "Keep exporting") and sets the stop flag |
| done | ":exported exported, :failed failed" and "Retry the failed ones" (runs again on the failed ids only), "Close" | the tracker's warnings of each answer are shown under its row |

- [ ] **Step 4: Tests**: Vitest of `itemsToExport` (an item linked to Jira is left out for Jira, kept for Linear), of `bulk-export-dialog` (the requests go one at a time with the chosen target; a 409 row reads "Already exported"; retry runs the failed ones only; the stop confirmation), of the button (hidden for a guest, hidden when nothing is left to export).
- [ ] **Step 5: Gates and commits.**

```bash
git commit -m "feat(retro): export the retro's action items to the tracker in one dialog

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

---

## Final

### Task 19: Translations

Every key this plan introduces, with its values. A key that already exists keeps its value (check each `lang/*.json` before adding; `:names is writing…` and `Participant` exist). In `en.json` the value is the key. French "tu", Spanish "tú", German "du" (`InformalRegisterTest`).

| Key (en) | fr | es | de |
|---|---|---|---|
| The icebreaker's timer cannot be paused. | Le timer de l'icebreaker ne peut pas être mis en pause. | El temporizador del rompehielos no se puede pausar. | Der Timer des Eisbrechers kann nicht pausiert werden. |
| The timer is not paused. | Le timer n'est pas en pause. | El temporizador no está en pausa. | Der Timer ist nicht pausiert. |
| Only a topic can be marked as discussed. | Seul un sujet peut être marqué comme discuté. | Solo un tema se puede marcar como tratado. | Nur ein Thema kann als besprochen markiert werden. |
| You can put only one vote on a card. | Tu ne peux mettre qu'un vote par carte. | Solo puedes poner un voto por tarjeta. | Du kannst nur eine Stimme pro Karte vergeben. |
| You can put at most :count votes on one card. | Tu peux mettre au plus :count votes sur une carte. | Puedes poner como máximo :count votos en una tarjeta. | Du kannst höchstens :count Stimmen auf eine Karte setzen. |
| Notes belong to a topic, not to a card inside a group. | Les notes appartiennent à un sujet, pas à une carte d'un groupe. | Las notas pertenecen a un tema, no a una tarjeta de un grupo. | Notizen gehören zu einem Thema, nicht zu einer Karte in einer Gruppe. |
| Someone else changed these notes. | Quelqu'un d'autre a modifié ces notes. | Otra persona ha cambiado estas notas. | Jemand anderes hat diese Notizen geändert. |
| Choose a topic of this retrospective. | Choisis un sujet de cette rétrospective. | Elige un tema de esta retrospectiva. | Wähle ein Thema dieser Retrospektive. |
| The ROTI is already revealed. | Le ROTI est déjà révélé. | El ROTI ya está revelado. | Der ROTI ist bereits aufgedeckt. |
| You can nudge again in a moment. | Tu pourras relancer dans un instant. | Podrás volver a avisar en un momento. | Du kannst gleich noch einmal erinnern. |
| Discussion notes | Notes de discussion | Notas de la discusión | Diskussionsnotizen |
| :name is writing a card… | :name écrit une carte… | :name está escribiendo una tarjeta… | :name schreibt eine Karte… |
| :first and :second are writing cards… | :first et :second écrivent des cartes… | :first y :second están escribiendo tarjetas… | :first und :second schreiben Karten… |
| :name and :count others are writing cards… | :name et :count autres écrivent des cartes… | :name y :count más están escribiendo tarjetas… | :name und :count weitere schreiben Karten… |
| :name is moving a card… | :name déplace une carte… | :name está moviendo una tarjeta… | :name verschiebt eine Karte… |
| :name and :count others are moving cards… | :name et :count autres déplacent des cartes… | :name y :count más están moviendo tarjetas… | :name und :count weitere verschieben Karten… |
| :name is taking notes… | :name prend des notes… | :name está tomando notas… | :name macht Notizen… |
| Pause | Pause | Pausar | Pausieren |
| Resume | Reprendre | Reanudar | Fortsetzen |
| ' · max :count per card' (with its leading space) | ' · max :count par carte' | ' · máx. :count por tarjeta' | ' · max. :count pro Karte' |
| Max :count votes per card | :count votes max par carte | Máximo :count votos por tarjeta | Höchstens :count Stimmen pro Karte |
| You changed your votes: you're no longer marked as finished. | Tu as changé tes votes : tu n'es plus marqué comme ayant terminé. | Has cambiado tus votos: ya no figuras como que has terminado. | Du hast deine Stimmen geändert: Du giltst nicht mehr als fertig. |
| Someone is writing… | Quelqu'un écrit… | Alguien está escribiendo… | Jemand schreibt… |
| :count people are writing… | :count personnes écrivent… | :count personas están escribiendo… | :count Personen schreiben… |
| :finished/:total have finished | :finished/:total ont terminé | :finished/:total han terminado | :finished/:total sind fertig |
| :finished of :total have finished | :finished sur :total ont terminé | :finished de :total han terminado | :finished von :total sind fertig |
| I have finished voting | J'ai terminé de voter | He terminado de votar | Ich bin fertig mit Abstimmen |
| Change my votes | Modifier mes votes | Cambiar mis votos | Meine Stimmen ändern |
| Max per card | Max par carte | Máx. por tarjeta | Max. pro Karte |
| Votes one person can stack | Votes qu'une personne peut cumuler | Votos que una persona puede acumular | Stimmen, die eine Person stapeln kann |
| No limit per card | Pas de limite par carte | Sin límite por tarjeta | Kein Limit pro Karte |
| Now · :time left | En cours · reste :time | Ahora · quedan :time | Jetzt · noch :time |
| Discussed | Discuté | Tratado | Besprochen |
| Discussed · 1 action | Discuté · 1 action | Tratado · 1 acción | Besprochen · 1 Aktion |
| Discussed · :count actions | Discuté · :count actions | Tratado · :count acciones | Besprochen · :count Aktionen |
| 1 action | 1 action | 1 acción | 1 Aktion |
| :count actions | :count actions | :count acciones | :count Aktionen |
| ~ :count min left | ~ :count min restantes | ~ :count min restantes | ~ :count Min. übrig |
| < 1 min left | < 1 min restante | < 1 min restante | < 1 Min. übrig |
| :minutes min per topic · :count actions so far | :minutes min par sujet · :count actions pour l'instant | :minutes min por tema · :count acciones hasta ahora | :minutes Min. pro Thema · bisher :count Aktionen |
| :minutes min per topic · 1 action so far | :minutes min par sujet · 1 action pour l'instant | :minutes min por tema · 1 acción hasta ahora | :minutes Min. pro Thema · bisher 1 Aktion |
| of :total · this topic | sur :total · ce sujet | de :total · este tema | von :total · dieses Thema |
| :count min | :count min | :count min | :count Min. |
| Mark as discussed | Marquer comme discuté | Marcar como tratado | Als besprochen markieren |
| What the room decides, the questions left open… | Ce que le groupe décide, les questions restées ouvertes… | Lo que decide el grupo, las preguntas que quedan abiertas… | Was die Runde entscheidet, offene Fragen… |
| Saving… | Enregistrement… | Guardando… | Wird gespeichert… |
| Saved | Enregistré | Guardado | Gespeichert |
| Not saved | Non enregistré | No guardado | Nicht gespeichert |
| Try again | Réessayer | Reintentar | Erneut versuchen |
| Your text was not saved | Ton texte n'a pas été enregistré | Tu texto no se ha guardado | Dein Text wurde nicht gespeichert |
| Copy | Copier | Copiar | Kopieren |
| Topic actions | Actions du sujet | Acciones del tema | Aktionen des Themas |
| Create an action | Créer une action | Crear una acción | Aktion erstellen |
| Linked to #:rank · :title | Lié au n° :rank · :title | Vinculada al n.º :rank · :title | Verknüpft mit #:rank · :title |
| Other action items (:count) | Autres actions (:count) | Otras acciones (:count) | Weitere Aktionen (:count) |
| Quick add · linked to «:title» | Ajout rapide · lié à « :title » | Añadido rápido · vinculado a «:title» | Schnell hinzufügen · verknüpft mit „:title“ |
| 1 linked action | 1 action liée | 1 acción vinculada | 1 verknüpfte Aktion |
| :count linked actions | :count actions liées | :count acciones vinculadas | :count verknüpfte Aktionen |
| Nudge the last one | Relancer le dernier | Avisar al último | Den Letzten erinnern |
| Nudge the last :count | Relancer les :count derniers | Avisar a los :count últimos | Die letzten :count erinnern |
| Reveal ROTI | Révéler le ROTI | Revelar el ROTI | ROTI aufdecken |
| Your ROTI vote is awaited | On attend ton vote ROTI | Se espera tu voto ROTI | Deine ROTI-Stimme wird erwartet |
| Votes are closed. | Les votes sont clos. | Las votaciones están cerradas. | Die Abstimmung ist geschlossen. |
| Results appear for everyone when the facilitator reveals them or ends the session. | Les résultats s'affichent pour tous quand le facilitateur les révèle ou termine la session. | Los resultados aparecen para todos cuando el facilitador los revela o termina la sesión. | Die Ergebnisse erscheinen für alle, wenn der Moderator sie aufdeckt oder die Sitzung beendet. |
| Export to :provider | Exporter vers :provider | Exportar a :provider | Nach :provider exportieren |
| Export 1 item | Exporter 1 action | Exportar 1 acción | 1 Aktion exportieren |
| Export :count items | Exporter :count actions | Exportar :count acciones | :count Aktionen exportieren |
| Exporting… | Export en cours… | Exportando… | Wird exportiert… |
| Exporting :current of :total… | Export de :current sur :total… | Exportando :current de :total… | Exportiere :current von :total… |
| :exported exported, :failed failed | :exported exportées, :failed en échec | :exported exportadas, :failed con error | :exported exportiert, :failed fehlgeschlagen |
| Retry the failed ones | Réessayer celles en échec | Reintentar las fallidas | Fehlgeschlagene erneut versuchen |
| Already exported | Déjà exportée | Ya exportada | Bereits exportiert |
| Stop the export? | Arrêter l'export ? | ¿Detener la exportación? | Export stoppen? |
| The items already exported stay in :provider. The others are not sent. | Les actions déjà exportées restent dans :provider. Les autres ne sont pas envoyées. | Las acciones ya exportadas se quedan en :provider. Las demás no se envían. | Bereits exportierte Aktionen bleiben in :provider. Die anderen werden nicht gesendet. |
| Stop | Arrêter | Detener | Stoppen |
| Keep exporting | Continuer l'export | Seguir exportando | Weiter exportieren |

- [ ] **Step 1:** add every missing key to the four files (sorted as the files are), check that the keys used in code are exactly these (`tests/Feature/TranslationKeysTest.php`), run `bin/test-db pgsql -- tests/Feature/TranslationKeysTest.php tests/Feature/InformalRegisterTest.php` and `npm run test -- i18n` if the front has a key test. A key a task added with another wording is aligned here, in code and in the four files.
- [ ] **Step 2:** a review pass per language (terms against `docs/superpowers/research/front-rewrite/translations-review.md`: "facilitateur", "sujet", "carte", "ROTI"), lengths against the bars (a German label longer than its slot is shortened, not the slot widened).
- [ ] **Step 3:** commit `chore(i18n): retro facilitation strings, four languages, informal` with the two trailers.

### Task 20: Captures (light, 1440, French)

The owner's working rule: no browser walkthrough is written or run. This task takes **captures only**, in one configuration — light, 1440, French — through the visual harness of `tests/Browser/Visual` (`CapturesVisuals::captureVisuals`, which honours `VISUAL_ONLY`). Nothing in `tests/Browser/Walkthroughs` is written, edited or run.

**Files:**
- Create: `tests/Browser/Visual/RetroFacilitationVisualTest.php` (fixtures as `RetroPagesVisualTest.php` builds them: fixed ids and names, `travelTo` for dates)

- [ ] **Step 1: Cases**

| Name | Screen |
|---|---|
| `retro-writing-paused` | Writing, facilitator, a paused timer ("Resume" in the bar) — the activity line is left out unless the harness can seed it (spec §16 item 6); if it can, "Inès écrit une carte…" in one column |
| `retro-writing-anonymous-count` | Writing, anonymous retro, "3 personnes écrivent…" in the presence line, no column line — only if the harness can seed the count (spec §16 item 6); else left out and listed |
| `retro-voting-cap-finished` | Voting, participant at the cap on one card, "5/8 ont terminé", "Modifier mes votes", the other vote buttons enabled |
| `retro-discussing-topic-timer` | Discussing, facilitator, time per topic 5 min, topic 2 of 6 shared, topic 1 discussed with 2 actions, notes filled, "Actions du sujet" with one item |
| `retro-actions-linked` | Actions, the quick add linked to the shared topic, items with their topic, "Exporter vers Jira" |
| `retro-actions-bulk-export` | the bulk export dialog mid-run (one exported, one running, one pending) — through a seeded state if the harness cannot hold a tracker; else left out and listed |
| `retro-roti-before-reveal` | ROTI, facilitator, "Relancer les 2 derniers", "Révéler le ROTI" |
| `retro-roti-revealed` | ROTI, participant, after the reveal |
| `session-create-max-per-card` | the "New session" dialog, retro, "Max par carte" on 2 |

- [ ] **Step 2: Run.** Build the assets (`npm run build:front`), then `docker compose exec -e VISUAL_ONLY=light-1440-fr laravel.test php artisan test --compact tests/Browser/Visual/RetroFacilitationVisualTest.php` (from a worktree, the container and the working directory as `bin/test-db` documents them). The overflow check of the harness must pass. Only the `-light-1440-fr.png` files are written.
- [ ] **Step 3:** commit `test(visual): retro facilitation captures, light, 1440, French` with the two trailers.

### Task 21: Deviations and documents

- [ ] For each capture of Task 20, open it beside the mockup's `preview.html` (light, 1440, French) and write the remaining differences. Each is fixed, or is one of the answered rows P21-01 to P21-11, or is ruled under the owner's autonomy mandate (2026-10-03) and added as a row marked "ruled while building", with its reason; the report lists every such ruling for the owner.
- [ ] Documents, in one commit:
  - the spec (`docs/superpowers/specs/2026-10-21-plan-21-retro-facilitation-design.md`) and this plan, in place: status "built", and every difference found while building folded in;
  - `docs/superpowers/research/front-rewrite/feature-roadmap.md`: a "Status" column for the retro section with RT-1 to RT-10 "done, plan 21" (as the surveys section has), and the "Not requested" line completed with spec §3;
  - `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md`, table "Deviations from the mockup": D-10 reduced to the three backlog elements; D-11 removed; D-12 reduced to "8/8 following"; D-13 and D-14 removed; D-105 reduced to the vote button (the "finished" sentence exists); D-106's first point removed ("Topic actions" exists);
  - `docs/superpowers/specs/2026-10-01-front-rewrite-design.md`: §6.4 (retro) amended with a pointer to the new spec (pause, cap per card, finished voting, time per topic, notes, linked items, ROTI reveal and nudge, bulk export);
  - `docs/database.md`: nothing to add unless a task found a new rule.
- [ ] Commit `docs: plan 21 — spec and plan in place, roadmap and deviation rows updated` with the two trailers.

### Task 22: Full suites on PostgreSQL, and report

- [ ] `vendor/bin/pint --format agent`; `vendor/bin/sail composer types:check`; `vendor/bin/sail composer rector:check` if the project has it.
- [ ] `bin/test-db pgsql` (Unit, Feature, Upgrade and Arch in parallel; never two whole suites at once in the shared container) — Expected: `test-db pgsql: PASS`. `tests/Arch/DatabasePortabilityTest.php` is part of it and must pass.
- [ ] `bin/test-db pgsql --concurrency` — Expected: PASS.
- [ ] SQLite, MariaDB and MySQL are **not** run here: the four-engine matrix runs once after the last merge into `roadmap` (plans 24 and 25), per the owner's ruling of 2026-10-03. A failure it finds in this plan's code is fixed then, on a branch from `roadmap`.
- [ ] `bin/check-pg-upgrade` — Expected: PASS (the upgraded schema equals a fresh install's).
- [ ] `npm run test`, `npm run types:check`, `npm run check`, `npm run build:front` — Expected: PASS.
- [ ] Report `.superpowers/sdd/roadmap/plan-21/report.md` (asked for by this plan): what is done, per acceptance criterion of spec §13 with the test that proves it (on PostgreSQL; criterion 25's other engines are checked by the roadmap's final matrix); the differences that remain with each mockup; every existing test that was edited and why; every translation key added outside Task 19's table; the captures left out (activity, bulk export) and why; every decision of spec §15 as answered (and how decisions 1 C and 10 B behave in the tests); what spec §16 could now be determined.
- [ ] Commit `docs: plan 21 report` with the two trailers. The controller merges the branch into `roadmap`, runs `bin/test-db pgsql` there, and notifies the owner that plan 21 is done (owner's autonomy mandate of 2026-10-03). **No merge into `main`, no push.**

---

## Self-review (done while writing; kept for the reader)

**Spec coverage.** §6.1 schema: Task 1. §6.2 pause: Tasks 1 (invariant, completion), 2 (routes, Icebreaker, "+2 min"), 12 (screen). §6.3 cap: Tasks 1 (`maxVotesPerCard`), 4 (endpoint, creation, settings, race), 13 (screen, popover, creation row). §6.4 finished voting (decision 10 B): Tasks 1 (reset on entering Voting, snapshot), 5 (routes, a vote takes "finished" back, `finishedIds` in the vote answer, races), 10 (`cardVoting` never blocks for "finished", `useCardVote` applies `finishedIds`), 13 (screen, status line). §6.5 time per topic and discussed: Tasks 1 (snapshot), 3 (timer, highlight, mark routes), 14 (screen, estimate). §6.6 notes: Tasks 1 (table, snapshot), 6 (route, version, races), 9 (recap e-mail, AI input), 15 (editor, soft lock). §6.7 linked items: Tasks 1 (column, presenter), 7 (routes), 16 (screens, session end). §6.8 ROTI: Tasks 1 (snapshot, reset on entering ROTI), 8 (reveal, nudge, race), 17 (screen). §6.9 activity: Task 11. §6.10 bulk export: Task 18. §6.11 writing count (decision 1 C): Tasks 1 (`writing_until`, never in the snapshot), 23 (routes, event with the count only, guards, limiter), 10 (`writing.count` listener), 11 (heartbeat, no whisper, the presence line). §7 permissions: the guard tests of Tasks 2 to 8 and 23. §8 real time: events in Tasks 1 to 8 and 23, the channel in Task 10. §9 screens: Tasks 11 to 18. §10 no data migration: Task 1's "as before" test. §11 routes: Tasks 2 to 8 and 23. §12 testing: per task on PostgreSQL (four engines at the end of the roadmap); races in Tasks 4, 5, 6, 8; captures in Task 20. §13 criteria: 1, 3, 4 → 11; 2 → 11, 23; 5–6 → 1, 2, 12; 7 → 4, 13; 8–9 → 5, 10, 13; 10–12 → 3, 14; 13–14 → 6, 15; 15 → 9; 16–17 → 7, 16; 18–19 → 8, 17; 20 → 18; 21 → 4, 13; 22 → 1; 23 → 19; 24 → 20, 21; 25 → 22.

**Placeholders.** Back-end tasks carry their tests and code. Three steps adapt to names the plan could not read with certainty and say so: the accessors of `RetroRecapMail` and `SummaryInput` (Task 9), the fixture of a workspace item an author may edit (Task 7), the `legacyRoti()` factory state (Task 8, it exists in `RetroFactory`). Screen tasks carry the pure logic in full and the composition, behaviours and states of their components, as the plan-18e procedure has it.

**Type consistency.** `TimerChanged::of(Retro)` (Task 1) is what Tasks 2 and 3 send and answer, and its three keys are `TimerState` (Task 10) and the `timer.set` action. `MoveTopicFocus::handle` returns `timer` and `discussed`, which Task 14 applies. `PresentTopicNote::handle` (Task 1) gives the `TopicNote` shape of Tasks 6, 10 and 15. `CardVoting.blocked` gains `'cap'` (and has no `'finished'`, decision 10 B) in Task 10 and `useVoteBlockedLabel` reads it in Task 13. The vote answer's `finishedIds: ?array` (Task 5) is the `Tally.finishedIds: string[] | null` of Task 10. `WritingCountChanged::broadcastWith(): array{count: int}` (Task 23) is what `subscribeWritingCount` passes (Task 10) and `othersWriting` reads (Task 11). `actionCountByTopic` (Task 14) is reused by Task 16; `topicLabel` (Task 16) by the session end. `useActivity` (Task 11) is used by Task 15. `ExportTargetFields` (Task 18) keeps `ItemExportDialog`'s behaviour.

**Review Focus.** Each line has its test: the cap under concurrency (Task 4, `Race`), two first or concurrent note saves (Task 6, `Race`; Task 15, Vitest), a paused timer resumed in Icebreaker (Task 2), a spoofed or stale activity event (Task 11), a late ROTI vote (Task 8, feature and `Race`), a bulk export meeting 409, 403 and network errors (Task 18), a topic discussed twice (Task 3), an id or a column in the anonymous writing count (Task 23 exact keys, Task 11 no-whisper Vitest), a finished participant voting under concurrency (Task 5, feature and `Race`).

**Known weak points of this draft.** Nothing was run. The `RetroRecapMail` accessor and the exact shape of `SummaryInput` were not read in full. The visual harness may not be able to show client events (spec §16 item 6). Reverb relaying guest client events is assumed from its configuration (spec §16 item 1). The `retro-writing` limiter's key depends on the participant attribute being set before the throttle middleware runs (spec §16 item 8); Task 23's 429 test proves it.

**v2 (owner's answers of 2026-10-03).** Decisions 1 and 10 changed from the draft: Task 23 is new (23 tasks); Tasks 1, 5, 10, 11, 13, 19, 20 and this review were rewritten on the answers. The pre-build deviations, P21-05 reworded, were then put to the owner.

**v3 (pre-build deviations and test matrix, 2026-10-03).** P21-01 to P21-11 answered: 07 as the mockup (topic timer only in Discussing, Task 14), 08 the list and progress dialog (Task 18), 10 both the progress and "5/8 have finished" (Task 13), the rest approved as listed; each answer is what the row already said, so no task, file or test changes and the count stays 23. The per-task runs, the lane gates and Task 22 run on PostgreSQL only; the four-engine matrix moved to the end of the roadmap (owner). Base and merge target are now the `roadmap` branch; plan 21 runs in the first wave with 20, 26, 27 and 29, before plan 22. Notes of the first revision pass settled here: Task 23 keeps its number and runs in lane V after Task 5 (ruled: stable numbers over order); goal 1's "nothing stored" is reworded in the spec, since `writing_until` is short-lived data the owner's answer C implies; the three checks against `main` (the limiter's order, `RetroGuard::unlocked`'s status, a `DELETE` on `pagehide`) stay checks inside Task 23 and Task 11, proved by their tests, not owner questions.

