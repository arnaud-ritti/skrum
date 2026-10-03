# Skrum — Retro facilitation (roadmap plan 21, RT-1 to RT-10) — Design

Date: 2026-10-03, draft v2 (the owner's answers of 2026-10-03 applied)
Status: **decisions answered, to be approved by the owner.** Every question of §15 has the owner's answer (2026-10-03). Eight follow the recommended option; two differ and the body is rewritten on them: decision 1 (an anonymous retro shows a count of people writing, relayed by the server, with no id and no column) and decision 10 (a vote cast or taken back after "I have finished voting" takes the "finished" back by itself). The plan's pre-build deviations are still to be approved by the owner.
Parent spec: `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` (§5 rule 13 "rewrite first, features after", §6.4 retro, §9.1 the phase matrix).
Owner's word: `docs/superpowers/research/front-rewrite/owner-answers-2026-10-02.md`, every round: mockup binding for presentation, existing features kept, simple data added, informal register (fr "tu", es "tú", de "du"), a guest counts as a participant, "+2 min" on every timer (2-D8, third round points 3/4), Eloquent only. Roadmap changes of the fifth round: plans 28 and 30 and scheduling are backlog.
Roadmap rows: RT-1 to RT-10 of `docs/superpowers/research/front-rewrite/feature-roadmap.md`. Deviation rows cleared: D-10 (in part), D-11, D-12 (in part), D-13, D-14 of plan 18e; D-105 (the "finished" sentence) and D-106 (the "Topic actions" card) in part.
Mockups (binding): `docs/design-system/components/` — `ScreenRetroWriting`, `ScreenRetroGrouping`, `ScreenRetroVote`, `ScreenRetroDiscussion`, `ScreenRetroActions`, `ScreenRetroROTI`, `ScreenSessionCreate` ("Max per card"), `SessionSettingsPopover` ("Max per card"), `FacilitatorBar`, `Timer`, `VoteDots`, `ROTIWidget`, `PresenceStack`, `ActionItem`. For each, `README.md` and `preview.html`.
Database rules: `docs/database.md`, "Rules for database code" 1 to 12, the concurrency harness (`Tests\Concurrency\Support\Race`).
Places left by plan 18e: `docs/superpowers/research/front-rewrite/18e-report/02-retro.md` ("Places left" of each phase) — every RT feature has its slot in the screens already.

What was read: the code of `main` at `18d3637e` (plans 18e–18g, the database portability work and plan 19 merged): `app/Models/Retro.php`, `Card.php`, `Participant.php`, `Vote.php`, `RotiVote.php`, `ActionItem.php`; `app/Http/Controllers/Retros/CardVotesController.php`, `RetroTimersController.php`, `RetroTimerExtensionsController.php`, `RetroHighlightsController.php`, `RetroRotiController.php`, `RetroSettingsController.php`, `ActionItemsController.php`, `app/Http/Controllers/TeamRetrosController.php`, `Integrations/RetroActionItemExportsController.php`; `app/Actions/Retros/BuildBoardSnapshot.php`, `ChangeRetroPhase.php`, `BuildResults.php`, `SummarizeRoti.php`, `RetroGuard.php`, `BuildSummaryInput.php`, `app/Actions/ActionItems/CreateActionItem.php`, `ActionItemRules.php`, `app/Actions/Integrations/ExportActionItem.php`, `BuildRetroRecap.php`, `app/Actions/Games/ScheduleIcebreakerExpiry.php`, `app/Jobs/CloseExpiredGameRound.php`; `app/Events/Retros/*`; `app/Http/Controllers/BroadcastAuthorizationsController.php`, `config/reverb.php`; front: `components/retro/{facilitator-dock,board-topbar,phase-voting-bar,phase-discussing,topics-list,topic-focus,phase-actions,phase-roti,action-items-list,board-column,columns-board}.tsx`, `components/skrum/{timer,session-settings-popover,presence-stack,vote-dots}.tsx`, `components/session/session-timer.tsx`, `lib/retro/topics.ts`, `lib/realtime/whisper-transport.ts`, `hooks/use-retro-board.ts`, `components/action-items/item-export.tsx`. For the v2 answers, also read on `main` at `0c294632`: `CardVotesController.php` (both transactions, `Transactions::Attempts`, the `tally` answer), `RetroBroadcastEvent.php` (`ShouldDispatchAfterCommit`), `Participant::current`, `components/retro/phase-voting-bar.tsx` (`useCardVote` applies the tally), `components/skrum/presence-stack.tsx` (the typing line), `AppServiceProvider` (the `whiteboard-writes` limiter). Nothing was run. The plan re-reads every file it touches.

## 1. Problem statement

The retro screens of plan 18e follow their mockups with what the server holds, and leave a place for ten elements the server cannot feed:

- Writing and Grouping show nobody's activity ("Inès is writing a card…", "Yuki is moving a card…") and the facilitator cannot pause the timer (D-10).
- Voting has no per-card cap ("max 2 per card") and nobody can say "I have finished voting"; the room sees "n of m votes cast", not "5/8 have finished" (D-11, D-105).
- Discussing has one retro timer and no time per topic, no shared notes, no "discussed" mark, and action items are not linked to the topic they came from (D-12, D-106).
- Actions has no bulk export to the tracker (D-13).
- ROTI shows the distribution only when the session ends; the facilitator can neither reveal it in the phase nor nudge the last voters (D-14).

Every "Back end" line of the roadmap was checked against the code; three are corrected here:

- RT-1 needs nothing new on the server for a named retro: Reverb accepts client events from presence members (`config/reverb.php`, `accept_client_events_from = members`) and the front already has a whisper transport that takes the sender from the server stamp (`lib/realtime/whisper-transport.ts`, used by cursors and flying reactions). On an anonymous retro a client event would carry the writer's presence id, so the writing indicator goes through the server instead: a heartbeat endpoint, a short-lived `participants.writing_until`, and an event carrying a count only (decision 1, §6.11).
- RT-2: the retro's timer is one end time (`retros.timer_ends_at`), and in the Icebreaker phase it is also the game's round clock (`GameRoom::effectiveTimerEndsAt`, `CloseExpiredGameRound`). A pause must therefore say what it does to an icebreaker round (§6.2).
- RT-10: the per-item export (`ExportActionItem`) is a synchronous call to the tracker under the item's lock; a batch of n calls in one request holds a PHP worker for n tracker round-trips. The recommended design loops the existing endpoint from the browser (§6.10, decision 9).

## 2. Goals

1. The room sees who is writing a card, who is moving one, and who is taking notes, live, without anything stored (RT-1); on an anonymous retro it sees how many people are writing, never who nor where.
2. The facilitator pauses and resumes the retro's timer; everyone sees the paused time (RT-2).
3. A retro can cap the votes one person puts on one card, set at creation and in the settings (RT-3).
4. Each participant says "I have finished voting"; the room sees "x/y have finished"; changing a vote afterwards takes it back by itself (RT-4).
5. In Discussing, every topic gets the same time; moving to the next topic restarts the timer; the topics list shows the time left for the topic in focus and an estimate for the rest (RT-5).
6. Each topic has shared notes, written by anyone in the room while it is discussed, and carried into the recap (RT-6).
7. A topic is marked "discussed", by hand or when the facilitator moves on (RT-7).
8. An action item created in Discussing or Actions is linked to its topic; the topic shows its count and the item shows its topic (RT-8).
9. The facilitator reveals the ROTI distribution during the ROTI phase and nudges the last voters (RT-9).
10. In Actions, the retro's action items are exported to the team's tracker in one go (RT-10).
11. Every existing retro behaviour is kept; database code is Eloquent and the standard query builder only and runs unchanged on PostgreSQL, MySQL, MariaDB and SQLite.

## 3. Non-goals (backlog)

Staying in the backlog by the roadmap ("Not requested") or the owner's word, with no place reserved unless the screen already has one:

- "Reveal the cards" as a button separate from "Next phase" (Writing), duplicate detection and "Auto-group duplicates" (Grouping), "Undo last group" (Grouping). D-10 keeps these three.
- The "n/n following" count of the focus banner (Discussing). D-12 keeps it; its place (`following` of `PhaseDiscussing`) stays empty.
- The export of a retro as PDF, CSV or Markdown; the ROTI delta ("+0.4 vs S41") and the sparkline of the session-end screen.
- "Timer per phase" of the settings popover and of the creation dialog (SE-3, plan 22): this plan adds the time per topic only.
- "⌘J create the Jira ticket too" of the Actions quick-add form (not a roadmap row).
- Pause of the poker, whiteboard and game-room timers (decision 2, option A).
- Real co-editing of the notes (several cursors in one text) and a new dependency for it (decision 5).
- Activity indicators on any other session type; a stored history of who wrote or moved what.
- Notes in the chat recaps (Slack, Teams, Mattermost, Telegram) and in the webhook payload; notes in search; notes in MCP tools (decision 6).
- A bell notification for the ROTI nudge (decision 8).
- The default values of templates (`TemplateEditor` "Max per card", "Timer per phase"): template defaults have no back end (WS-2/WS-3, plan 23).
- Anything of the former plans 28 (whiteboard collaboration, including WB-5 "Convert to actions", which needed RT-8) and 30 (mentions), and scheduling.

## 4. Decisions already taken

| Topic | Decision | Source |
|---|---|---|
| Presentation | The mockup wins; an element with no data is omitted, listed, its place left | parent spec §5 rule 13 |
| Existing features | Kept; nothing a user has today is lost | owner, 2-D9 "no feature lost"; third round |
| "+2 min" | On every timer, the topic timer included (the Discussion mockup's "+1 min" becomes "+2 min", P21-01) | owner 2-D8; third round points 3/4 |
| Timer presets | One list 1/3/5/10 on every screen | owner X5 |
| Participation | A guest counts as a participant: "x/y have finished" and "Nudge the last n" count guests | owner, sixth round |
| Register | Informal everywhere: French "tu", Spanish "tú", German "du"; English unchanged | owner, sixth round; `tests/Feature/InformalRegisterTest.php` |
| Cursors | Off in Voting, ROTI and Completed (a pointer tells a vote); named "Participant" on an anonymous retro | plan 18e; `board-cursors.tsx` |
| Vote limit | Changeable before Voting only (Icebreaker, Writing, Grouping) | `RetroSettingsController` |
| Who facilitates | One facilitator per retro (`facilitator_participant_id`); co-facilitators do not exist | code |
| Database | Eloquent and the standard query builder only, Schema builder only in migrations, no driver branch; tests on PostgreSQL, SQLite, MariaDB and MySQL; races with `Race` | owner; `docs/database.md` |
| Tests | Unit, feature, concurrency and Vitest are written and run; browser walkthroughs are neither written nor run; captures in light, 1440, French | owner, working rules |
| Roadmap | Plans 28, 30 and scheduling are backlog | owner, fifth round |
| The ten questions of §15 | Answered; decisions 1 (C) and 10 (B) differ from the recommendation | owner, 2026-10-03 |

## 5. Rules

The front rules of the parent spec §5 apply to every front file (tokens, rem, Tailwind scale, no overflow from 20rem to 60rem, visible focus, contrast, `prefers-reduced-motion`, lucide icons, literal `t('…')`, presentational `skrum/` components with no network). The back-end conventions of §9.2 of the parent spec apply: actions in `app/Actions/<Domain>`, one controller per resource with CRUD method names, a guard class on live JSON endpoints (`RetroGuard`), events sent to others only (`sendToOthers`), UUID keys, migrations with `up` only.

`docs/database.md` applies to every query, migration and test. In particular: no raw query (rule 1); bounded sets in PHP, aggregates cast in PHP (rule 2); no driver test (rule 3); Schema builder only, `dateTime()` for a date column, no JSON default, no collation (rule 5); the retro row is the aggregate root and is locked first in every transaction this spec adds (rule 6); an explicit tie-breaker on every sort (rule 7); tests never read SQL (rule 8). No new derived column.

Vocabulary:

| Term | Meaning |
|---|---|
| topic | A top-level card of the retro, alone or leading a group (`cards.parent_card_id` null). The front builds topics in `lib/retro/topics.ts`; the server knows a topic by its lead card's id. Every topic datum of this spec (discussed mark, notes, linked action items) is stored on, or points to, the lead card. |
| shared topic | The topic the facilitator put in focus for everyone: `retros.highlighted_card_id`. |
| activity | A client event on the retro's presence channel saying that a participant is writing a card, moving a card or taking notes. Never stored. |
| writing count | On an anonymous retro, in Writing: the number of participants whose `writing_until` is in the future, sent by the server with no id and no column (§6.11). |
| topic time | `retros.topic_seconds`: the duration every topic gets in Discussing. |

## 6. Domain and data

### 6.1 Changes to the schema

All new columns are nullable; null means "as today". Migrations are dated `2026_10_21_…` (after plan 19's `2026_10_20_…`; plan 20 adds none).

| Table | Column | Type | Meaning |
|---|---|---|---|
| `retros` | `timer_paused_seconds` | unsigned integer, nullable | seconds left when the timer was paused; non-null only while `timer_ends_at` is null (RT-2) |
| `retros` | `topic_seconds` | unsigned small integer, nullable | the time per topic in Discussing; null: no time per topic (RT-5) |
| `retros` | `max_votes_per_card` | unsigned tiny integer, nullable | the cap per participant and card; null: no cap (RT-3) |
| `retros` | `roti_revealed_at` | `dateTime`, nullable | when the facilitator revealed the ROTI in its phase (RT-9) |
| `participants` | `voting_finished_at` | `dateTime`, nullable | when the participant said "I have finished voting" (RT-4) |
| `participants` | `writing_until` | `dateTime`, nullable | anonymous retro, Writing: until when the participant counts as writing; a heartbeat moves it 8 s ahead, stopping clears it (RT-1, decision 1, §6.11) |
| `cards` | `discussed_at` | `dateTime`, nullable | when the topic led by this card was marked discussed (RT-7) |
| `action_items` | `card_id` | UUID, nullable, foreign key to `cards`, null on delete, indexed | the topic the item was created for (RT-8) |

New table **`topic_notes`** (RT-6): `id` (UUID), `retro_id` (cascade), `card_id` (cascade, **unique**), `body` (`text`, at most 5 000 characters, validated), `version` (unsigned integer, default 0), `updated_by_participant_id` (nullable, null on delete), timestamps. Model `TopicNote`; relations `Retro::topicNotes()`, `Card::note()`.

`Retro` gains an invariant enforced in its `saving` hook (`ModelInvariantViolation`): `timer_ends_at` and `timer_paused_seconds` are never both non-null.

### 6.2 Timer pause (RT-2)

- **Pause** — the facilitator of an open retro pauses a running timer (`timer_ends_at` in the future): `timer_paused_seconds` = the whole seconds left, at least 1; `timer_ends_at` = null.
- **Resume** — a paused timer starts again for its seconds: `timer_ends_at` = now + `timer_paused_seconds` (whole second); `timer_paused_seconds` = null.
- **Start** (`retros.timer.update` with seconds) clears a pause; **Stop** (seconds null) clears both.
- **"+2 min"** on a paused timer adds 120 s to `timer_paused_seconds` (at most 7 200 s, as a running timer).
- **Icebreaker.** In the Icebreaker phase the retro's timer is the round clock of the game. Pause is refused there (422, `timer`: "The icebreaker's timer cannot be paused.") and the facilitator bar does not offer it. A timer paused in another phase stays paused when the facilitator moves back to Icebreaker; the game then shows no countdown until the timer is resumed or restarted, which schedules the round's expiry again (`ScheduleIcebreakerExpiry`, already called by start and by resume).
- A phase change keeps a paused timer as it keeps a running one; completing the retro clears `timer_ends_at`, `timer_paused_seconds` and `topic_seconds`.
- `TimerChanged` (`timer.changed`) carries `timerEndsAt`, `timerPausedSeconds` and `topicSeconds`.
- Scope: the retro's timer only (decision 2).

### 6.3 Maximum votes per card (RT-3)

- `max_votes_per_card` is set at creation (`teams.retros.store`, field `max_votes_per_card`, nullable, 1 to 20) and in the settings (`retros.settings.update`, same rule), in the same phases as `votes_per_participant` (Icebreaker, Writing, Grouping).
- The cap in force is `Retro::maxVotesPerCard(): ?int` = null when the setting is null, else `min(max_votes_per_card, voteLimit())`, so that an automatic vote limit below the cap wins.
- `CardVotesController@store`, under the retro's lock, refuses a vote that would put more than the cap of the participant's votes on one card: 422, `votes`: "You can put at most :count votes on one card." The cap applies to the lead card a group's votes go to.
- The snapshot gives `retro.maxVotesPerCard` (the cap in force) and `retro.maxVotesPerCardSetting` (the stored value, for the settings form).
- The cap holds when two votes on one card arrive at the same moment (proved with `Race`).

### 6.4 "I have finished voting" (RT-4)

- A participant, a guest included, finishes voting in the Voting phase: `participants.voting_finished_at` = now. Taking it back ("Change my votes") clears it. Both are allowed on a locked board (they change no card).
- **Voting again takes "finished" back** (decision 10, owner's answer B): a participant who has finished can still cast or retract a vote. When `CardVotesController@store` or `@destroy` saves a vote of a participant whose `voting_finished_at` is set, the same transaction (retro locked first, then the participant) clears it and sends `voting.finished` with the new list after commit. The vote answer gains `finishedIds`: the new list when the vote took "finished" back, null otherwise, so the voter's own board updates without waiting for the event. A refused vote (no votes left, cap reached, locked board) changes nothing, "finished" included. The vote buttons are never disabled for "finished"; when a vote takes it back, the finish button returns to "I have finished voting" and a polite status says "You changed your votes: you're no longer marked as finished."
- Consequence accepted with the answer: "x/y have finished" can go down during the phase, each time a finished participant changes a vote.
- Entering the Voting phase from another phase clears every participant's flag (`ChangeRetroPhase`): a second voting round starts with nobody finished.
- The snapshot gives `voting.finishedIds` (participant ids). The event `voting.finished` carries `finishedIds`. Who has finished is not a secret: the ROTI already shows who has voted, and this says nothing of where.
- "x/y have finished" counts the people **online** (presence), as "Who has voted" of the ROTI phase does: y = people connected, x = connected people in `finishedIds`. The facilitator and guests count.

### 6.5 Time per topic and "discussed" (RT-5, RT-7)

- **Setting the time per topic** (decision 3): in Discussing, starting the timer from the topic's timer (the menu 1/3/5/10 of every timer) stores `topic_seconds` = the chosen duration; stopping it there stores null. Starting or stopping the timer in another phase does not change `topic_seconds`.
- **Moving on**: when the shared topic changes in Discussing (`retros.highlight.update` to another top-level card), and `topic_seconds` is set, the timer restarts for `topic_seconds` (a pause is cleared) and `timer.changed` is sent. Clearing the highlight does not touch the timer. In Actions nothing restarts.
- **Discussed** (decision 4): `cards.discussed_at` on the lead card. The facilitator marks or unmarks a topic by hand in Discussing and Actions (`retros.cards.discussion.update|destroy`). In Discussing, when the shared topic changes from one topic to another, the topic left is marked discussed if it was not. Event `topic.discussed` with `cardId` and `discussedAt` (null when unmarked).
- **Estimate** (front, pure): time left = the remaining seconds of the shared topic when it is not discussed, plus `topic_seconds` × the number of topics that are neither discussed nor shared. Shown as "~ n min left" (rounded up, "< 1 min" under a minute), and "n min per topic · m actions so far". Nothing when `topic_seconds` is null.
- The snapshot gives `retro.topicSeconds` and `cards[].discussedAt`.

### 6.6 Shared notes (RT-6)

- One note per topic: a row of `topic_notes` keyed by the lead card. Written by any participant, guests included, in the Discussing phase, on an unlocked board. Read by everyone on the board.
- **Save**: `PUT retros/{retro}/cards/{card}/notes` with `body` (string, at most 5 000 characters, empty allowed) and `version` (the version the writer started from). Under the retro's lock: when `version` equals the stored version (0 when no row), the body is saved, `version` + 1, `updated_by_participant_id` = the writer; otherwise 409 with the current note, and nothing is written. The first two saves of one topic at the same moment create one row (proved with `Race`).
- **One writer at a time** (decision 5): while someone types in a topic's notes, their activity (`notes`, RT-1) makes the field read-only for the others with "Inès is taking notes…", until 4 s after their last keystroke. The version check catches the rare case where two people start at once: the second gets 409, the server's text replaces the field, and their own text is kept below it ("Your text was not saved" with "Copy"), never lost silently.
- The front saves 800 ms after the last keystroke and on blur; it shows "Saving…", "Saved", "Not saved" (with "Try again").
- Event `topic.note.saved` with `note` (`cardId`, `body`, `version`, `updatedAt`). The snapshot gives `topicNotes` (every note of the retro, the same shape). Who wrote a note is not sent.
- **After the discussion** (decision 6): the notes go into the recap e-mail (`RetroRecapMail`, a section "Discussion notes" after "Top card per column": the topics with a non-empty note, by votes, at most 5, each note at most 300 characters with an ellipsis) and into the AI summary input (`BuildSummaryInput`: a `notes` key on the lead card's entry, within the token budget). Chat recaps, webhooks, search and MCP do not carry them.
- Notes stay with their card: if the facilitator goes back to Grouping and the lead card is grouped under another, its note stays on it and is not shown until it leads a topic again.

### 6.7 Action items linked to a topic (RT-8)

- `action_items.card_id`: the lead card of the topic the item was created for. The board's `retros.action-items.store|update` accept `card_id` (nullable UUID); it must be a top-level card of the same retro, read under the retro's lock (422 `card_id` otherwise). The workspace endpoints do not accept it and leave it as it is.
- `PresentActionItem` adds `cardId`. The front derives the topic (rank, title) from the board's topics; an item whose card is not a topic of the board (a carried item, a card grouped later) shows no topic.
- In Discussing, the form of the right column creates items linked to the topic in front of the viewer ("Linked to #2 · title", removable before creating); in Actions, the quick-add form links to the shared topic ("Quick add · linked to «title»").
- A topic shows its count of linked items ("Discussed · 2 actions", "1 linked action"); an item shows its topic in its meta line, on the board and in the session end's "Actions created".
- The Discussing column shows the mockup's "Topic actions" (the items of the topic in front of the viewer) and, below, "Other action items (n)", collapsed, holding the rest: nothing listed today disappears (owner 2-D9).
- Deleting a card (Writing and Grouping only) leaves its items without a topic.

### 6.8 ROTI reveal and nudge (RT-9)

- **Reveal**: the facilitator reveals the ROTI in the ROTI phase (`PUT retros/{retro}/roti/reveal`), once: `roti_revealed_at` = now. Everyone then sees the result (`ROTIWidget` result mode: mean, distribution, number of votes). **Revealing closes the vote** (decision 7): `Retro::takesRotiVotes()` is false in the ROTI phase once revealed; a vote or a withdrawal answers 403 as in any phase without ROTI votes.
- Entering the ROTI phase from another phase clears `roti_revealed_at` (the reveal belongs to one pass through the phase).
- The snapshot gives `roti.revealed` and `roti.results` (the `SummarizeRoti` shape) when revealed or completed, null otherwise. The event `roti.revealed` makes the boards refetch.
- **Nudge**: the facilitator, in the ROTI phase before the reveal, sends `POST retros/{retro}/roti/nudges`; at most one per 30 s per retro (429 "You can nudge again in a moment."). The event `roti.nudged` has no payload; each board whose viewer has not voted and is not the facilitator shows a toast "Your ROTI vote is awaited" and pulses the widget once (no pulse with reduced motion). Nothing is stored and no bell notification is created (decision 8). "Nudge the last n" counts the connected people who have not voted, guests included, and is disabled at 0.

### 6.9 Activity indicators (RT-1)

- One client event, `activity`, on `presence-retro.{id}`: `{ kind: 'writing' | 'moving' | 'notes', targetId: string, active: boolean }`. `writing`: the column of a card being written or edited; `moving`: the card being dragged (pointer or keyboard pick-up); `notes`: the lead card of the topic whose notes are being typed.
- Sent on the first keystroke or the pick-up, then at most every 2 s while it lasts, and `active: false` when it ends (publish, cancel, blur, drop). A receiver drops an entry 5 s after its last message, so a closed tab never leaves a ghost.
- The sender is the presence id Reverb stamps on the event, never a field of the payload. A receiver ignores an event from someone not online, from itself, or of a kind its phase does not show (`writing` in Writing; `moving` in Writing and Grouping; `notes` in Discussing).
- Names follow the rule of the live cursors: the participant's name, "Participant" on an anonymous retro.
- **Anonymous retro** (decision 1, owner's answer C): no `writing` client event is ever sent, since its presence id and its column would tie a hidden card to its author. Writing goes through the server as a count (§6.11). `moving` and `notes` stay client events (moving a card or taking notes says nothing of who wrote it).
- Shown: Writing — the avatar of a writer is ringed in the presence stack, the stack's line says ":names is writing…", and the column says "Inès is writing a card…" under its cards (two names at most, then "and n others"); on an anonymous retro, only the stack's line, with the count (§6.11); Grouping — the column of the card says "Yuki is moving a card…"; Discussing — the notes field says "Inès is taking notes…" and is read-only for the others (§6.6). With reduced motion the trema dots do not animate.

### 6.10 Bulk export of a retro's action items (RT-10)

- **Front only** (decision 9): the dialog calls the existing endpoint `retros.action-items.exports.store` once per item, one after the other, with one target chosen for all. No new route; the per-item authorisation, the "already exported" 409, the tracker's warnings and the item lock all stay as they are.
- In Actions, the header of the "Retro actions" card has "Export to Jira" (the provider's name: "Export to :provider"; with several export sources, "Export" opens a menu of them). Shown to a member (never a guest) when the team has an export source and the retro has at least one item without a link to that tracker.
- The dialog: the target fields of the per-item export (Jira project and issue type, Linear team, GitHub repository, with the team's last choice), the list of the retro's items without a link to that tracker, each ticked, "Export n items". While it runs: "Exporting 3 of 6…", a row per item turning to its key (a link) or its error; at the end "n exported, m failed" with "Retry the failed ones". Closing while it runs asks for confirmation and stops after the item in progress.
- Each export broadcasts as today (`action-item.saved`, `action-item.external-links.changed`), so every board shows the keys as they arrive.

### 6.11 Writing count on an anonymous retro (RT-1, decision 1)

The owner chose a count relayed by the server, with no id (answer C). The rules below keep the count from naming anyone; they are numbered so that no implementer adds an id, a column or a name back.

1. **Heartbeat.** While the viewer types a card (new or edited) on an anonymous retro in Writing, the front sends `PUT retros/{retro}/writing` at the first keystroke and then at most every 3 s while the text changes; publishing, cancelling, blurring, unmounting or leaving Writing sends `DELETE retros/{retro}/writing` once. The request carries no body: no column, no card.
2. **What the server keeps.** `PUT` sets the participant's `participants.writing_until` = now + 8 s; `DELETE` sets it to null. A single-row update, no transaction (rule 6 of `docs/database.md` covers transactions; this write takes no lock and reads nothing it depends on). The value is never shown, never in a snapshot, never in an export; it expires by itself.
3. **The count.** After each write, the server counts the participants of the retro whose `writing_until` is later than now, and answers `{count}`. It broadcasts `WritingCountChanged` (`writing.count`, payload `{count}` and nothing else) to the others after the write, on every heartbeat, even when the count did not change, so that receivers keep it alive.
4. **No id anywhere.** The payload of `writing.count` holds the count only; a test asserts its exact keys. The front never sends a `writing` client event on an anonymous retro (a Vitest asserts the whisper is never called with `writing` there), and ignores one if it arrives.
5. **Receivers.** A board keeps the last count and the time it arrived, and drops it to 0 when no `writing.count` has come for 8 s (a closed tab stops its heartbeats). The viewer is not counted on their own board: the shown number is the count minus 1 when the viewer is writing (own state, known locally), never below 0. Entering or leaving Writing resets it to 0.
6. **Shown.** In the presence stack's line only: "Someone is writing…" (1) or ":count people are writing…" (2 or more), with the trema; no avatar is ringed and no column line appears.
7. **Guards.** Any participant, guests included; the retro is anonymous (403 otherwise: a named retro uses the client events); the phase is Writing (403 otherwise); the board is unlocked (423 otherwise). Rate limit `retro-writing`: 40 requests per minute per participant (429 beyond).
8. **Accepted risk.** In a small room a count can still be read with timing: in a room of two, "Someone is writing…" names the other person, and a count dropping just as a card appears hints at its author. The owner chose the count knowing this (option C of decision 1 said "still timing-revealing in a small room"). With no column and no id, the count tells nothing the room could not guess from who is typing on their keyboard.

The writing count changes nothing for a named retro (client events, names, columns, as §6.9).

## 7. Permissions

| Action | Who | Condition |
|---|---|---|
| Pause, resume the timer | facilitator | open retro, not Icebreaker (pause); a paused timer (resume) |
| Set the cap per card | facilitator (settings), any member who may create a retro (creation) | Icebreaker, Writing, Grouping (settings) |
| Finish voting, take it back | any participant, guests included | Voting |
| Cast or retract a vote | any participant | as today; a finished participant may, and it takes "finished" back |
| Say "I am writing" (heartbeat) | any participant, guests included | anonymous retro, Writing, board unlocked, 40 per minute |
| Time per topic | facilitator | Discussing (through the timer) |
| Mark or unmark a topic discussed | facilitator | Discussing, Actions |
| Write a topic's notes | any participant, guests included | Discussing, board unlocked |
| Link an action item to a topic | whoever may create or edit the item on the board today (`LocksDiscussingRetro`, `ActionItemPermissions`) | Discussing, Actions, ROTI (as items) |
| Reveal the ROTI | facilitator | ROTI phase, not revealed |
| Nudge | facilitator | ROTI phase, not revealed, once per 30 s |
| Bulk export | a member who may export each item (`ActionItemExportGuard`) | as the per-item export |
| Send an activity event | every presence member | Reverb `accept_client_events_from = members`; never `writing` on an anonymous retro |

A workspace manager who is not the facilitator has no new right. A guest never exports (unchanged).

## 8. Real time

All on `presence-retro.{id}`, sent to others only after commit (`RetroBroadcastEvent`), except the client event.

| Event | Name | Payload | Sent when |
|---|---|---|---|
| `TimerChanged` (changed) | `timer.changed` | `timerEndsAt`, `timerPausedSeconds`, `topicSeconds` | start, stop, +2 min, pause, resume, topic change with a time per topic |
| `VotingFinishedChanged` | `voting.finished` | `finishedIds` | finish, take back, a vote cast or retracted by a finished participant, entering Voting (cleared) |
| `WritingCountChanged` | `writing.count` | `count` (nothing else) | each heartbeat and each stop on an anonymous retro in Writing (§6.11) |
| `TopicDiscussed` | `topic.discussed` | `cardId`, `discussedAt` | mark, unmark, automatic mark |
| `TopicNoteSaved` | `topic.note.saved` | `note` | a note is saved |
| `RotiRevealed` | `roti.revealed` | none | the ROTI is revealed |
| `RotiNudged` | `roti.nudged` | none | the facilitator nudges |
| client event | `client-activity` | `kind`, `targetId`, `active` | §6.9 |

`action-item.saved` already carries the presented item and gains `cardId`. A change of `max_votes_per_card` goes through `settings.changed` (the boards refetch), as every setting.

## 9. Screens

Every screen is the retro board of plan 18e; this plan fills the places it left. "Omitted" means not built; each omitted element is a row of the plan's pre-build deviations.

### 9.1 Writing — ScreenRetroWriting

- Presence stack: the writer's avatar ringed, the stack's line ":names is writing…" (`PresenceStack` `typing`, existing).
- Column: under its cards, "Inès is writing a card…" with the trema in the writer's presence colour (`board-column.tsx` `typing`).
- FacilitatorBar: "Pause" first, before "+2 min" (mockup order); "Resume" while paused. The topbar timer shows the paused state (pause icon, muted digits, "Paused, 4 minutes left" for screen readers) — `Timer` already draws it.
- Anonymous retro: the stack's line "Someone is writing…" or "3 people are writing…" (§6.11); no ring, no column line.
- States: nobody writing; one writer; two; three or more ("Inès, Malik and 2 others are writing…"); anonymous retro with one writer, with three; paused; resumed.
- Omitted: "Reveal the cards" as a separate button (backlog, D-10).

### 9.2 Grouping — ScreenRetroGrouping

- Column of the card being moved: "Yuki is moving a card…" (`board-column.tsx` `moving`). Pause as in Writing.
- Omitted: duplicates suggestion, "Undo last group" (backlog).

### 9.3 Voting — ScreenRetroVote

- Vote bar: the budget reads "2 votes left · of 5 · max 2 per card" (`cap` of `PhaseVotingBar`); at the end, "5/8 have finished" (`finished`) and the viewer's "I have finished voting" / "Change my votes" (`done`).
- Card: at the cap, the vote button is `aria-disabled` with "Max 2 votes per card" (`RetroCard labels.voteBlocked`, `VoteDots maxPerCard`). Finished, the vote buttons stay enabled (decision 10); a vote takes "finished" back, the button returns to "I have finished voting" and the status line says "You changed your votes: you're no longer marked as finished."
- States: no cap; cap reached on a card; finished; taken back with "Change my votes"; taken back by a vote; everyone finished ("8/8 have finished"); a phone (the budget stuck above the tabs keeps the cap; "finished" scrolls with the cards).
- The existing "n of m votes cast" progress stays (parity row 57), followed by the finished count.

### 9.4 Discussing — ScreenRetroDiscussion

- Topics list (`topics-list.tsx`): a row's second line — the shared topic "Now · 04:12 left" (with a time per topic), a discussed topic "Discussed · 2 actions" with a check, another "n actions" when it has some; the footer "Topic 2 of 6 · ~ 20 min left" and "5 min per topic · 3 actions so far" (`estimate`).
- Topic stage: the timer of the topic between "Previous topic" and "Next topic" (`timer` of `PhaseDiscussing`): `Timer` large, "of 5:00 · this topic" under it, "+2 min", pause; the facilitator's menu 1/3/5/10 sets the time per topic. In Discussing the topbar shows no timer (the mockup), the stage does. "Up next" shows the topic time ("5 min").
- The facilitator marks the topic in front of them "Discussed" (a toggle beside the topic's title; also `D` when single-key shortcuts are on).
- Right column: first "Discussion notes" (`notes` panel): the field, its save state, "Inès is taking notes…"; then "Topic actions" with "Create an action" (the form's first line "Linked to #2 · title"); then "Other action items (n)", collapsed; then the existing suggestions and surveys panels.
- States: no time per topic (no estimate, the timer as today); time per topic running, low, done; paused; topic discussed; notes empty, typing, saved, conflict, read-only for someone else's typing, locked board (read-only with the reason), guest; no topic (empty state, as today); a phone (selector "2/6", notes and actions in the existing drawer of tabs).
- Omitted: "8/8 following" (backlog).

### 9.5 Actions — ScreenRetroActions

- Topic cards: "1 linked action" / "n linked actions" (`topicMeta`), "In discussion" as today.
- "Retro actions" card: "Export to Jira" in the header (`exportAll`); the quick-add form's line "Quick add · linked to «title»" (`linkedTo`); each item's meta shows its topic (`itemTopic`).
- Bulk export dialog (§6.10): target, item list, progress, summary. No mockup draws the dialog: it is the per-item export dialog (`ItemExportDialog`) with a list; the plan's deviation P21-08 puts it to the owner.
- States: no export source (no button); every item already exported (no button); exporting; partial failure; all done.

### 9.6 ROTI — ScreenRetroROTI

- FacilitatorBar: "Nudge the last 2" (`roti.nudge`), "Reveal ROTI" (`roti.reveal`), "End session".
- Before the reveal: the hidden distribution, "Who has voted", and the sentence "Results appear for everyone when the facilitator reveals them or ends the session."; after: the widget in result mode for everyone, the vote closed ("Votes are closed."), "Who has voted" kept.
- A nudged participant: toast "Your ROTI vote is awaited" and a single pulse of the widget.
- States: before reveal; nudge disabled (everyone voted, or within 30 s); revealed; a phone (as plan 18e, the result stacked).

### 9.7 Session creation and settings

- "New session" dialog, retro: the row "Max per card" after "Votes per person" (`retro-session-fields.tsx`), a stepper 1 to the votes per person with a "No limit" switch on by default (today's behaviour). Mockup: ScreenSessionCreate.
- Settings popover: the row "Max per card" in the Voting group (`useRetroSettingGroups`), same stepper and switch, disabled after Grouping with the reason of the vote limit. Mockup: SessionSettingsPopover.

### 9.8 Session end

- "Actions created": each item shows its topic as its source label. Nothing else changes; notes are not drawn there (decision 6).

## 10. Migrations of existing data

None. Every new column is nullable and null keeps today's behaviour: no cap, nobody finished, nobody writing, no pause, no time per topic, no topic discussed, no note, items without a topic, ROTI not revealed. A retro sitting in the ROTI phase at the deploy behaves as before until its facilitator reveals. The two migrations (columns; `topic_notes`) are tested by the feature tests on the four engines; no Upgrade test is needed since no row is rewritten.

## 11. Routes

Retro scope (`retros/{retro}`, middleware resolving the participant, as today):

| Route | Name | Controller | Guard |
|---|---|---|---|
| `PUT timer/pause` | `retros.timer.pause.update` | `Retros\RetroTimerPausesController@update` | facilitator, open, not Icebreaker, timer running |
| `DELETE timer/pause` | `retros.timer.pause.destroy` | `@destroy` (resume) | facilitator, open, timer paused |
| `PUT voting-completion` | `retros.votingCompletion.update` | `Retros\VotingCompletionsController@update` | participant, Voting |
| `DELETE voting-completion` | `retros.votingCompletion.destroy` | `@destroy` | participant, Voting |
| `PUT writing` | `retros.writing.update` | `Retros\RetroWritersController@update` | participant, anonymous retro, Writing, unlocked, `throttle:retro-writing` |
| `DELETE writing` | `retros.writing.destroy` | `@destroy` | same |
| `PUT cards/{card}/discussion` | `retros.cards.discussion.update` | `Retros\CardDiscussionsController@update` | facilitator, Discussing or Actions, top-level card |
| `DELETE cards/{card}/discussion` | `retros.cards.discussion.destroy` | `@destroy` | same |
| `PUT cards/{card}/notes` | `retros.cards.notes.update` | `Retros\TopicNotesController@update` | participant, Discussing, unlocked, top-level card |
| `PUT roti/reveal` | `retros.roti.reveal.update` | `Retros\RetroRotiRevealsController@update` | facilitator, ROTI, not revealed |
| `POST roti/nudges` | `retros.roti.nudges.store` | `Retros\RetroRotiNudgesController@store` | facilitator, ROTI, not revealed, 1 per 30 s |

Changed: `teams.retros.store` and `retros.settings.update` take `max_votes_per_card`; `retros.timer.update` sets `topic_seconds` in Discussing; `retros.timer.extension.store` extends a paused timer; `retros.highlight.update` restarts the topic timer and marks the topic left; `retros.cards.votes.store|destroy` apply the cap, take "finished" back when the voter had finished, and answer `finishedIds` (null when unchanged); `retros.roti.update|destroy` refuse after the reveal; `retros.action-items.store|update` take `card_id`; `retros.phase.update` clears the finished flags (into Voting), the reveal (into ROTI) and the timer columns (into Completed).

## 12. Testing

- Every test touching the database runs on PostgreSQL, SQLite, MariaDB and MySQL (`bin/test-db <engine> -- <paths>`); the four suites run at the end.
- Feature tests per route: the guard of each row of §7, each 4xx, the broadcast payloads, the snapshot keys per viewer (facilitator, member, guest).
- Races (`tests/Concurrency`, `Race`, on PostgreSQL, MariaDB, MySQL and a SQLite file): the cap per card under simultaneous votes; finishing while a vote arrives (both succeed; the participant ends finished only if the finish committed after the vote); two first saves of a topic's note (one row, one 409); two saves from the same version (one 200, one 409); a vote arriving while the ROTI is revealed (saved before, or refused).
- Unit (Pest): `Retro::maxVotesPerCard`, the invariant of the timer columns.
- Feature tests of the writing count (§6.11): the count with one, two and an expired writer, the exact payload keys of `writing.count`, each guard, the rate limit.
- Vitest: the activity reducer (`lib/retro/activity.ts`: expiry, self, kinds per phase, anonymous rule, labels, the writing count with its expiry and the viewer left out), the heartbeat of the hook (never a `writing` whisper on an anonymous retro), the estimate (`lib/retro/topic-estimate.ts`), the note editor state (`lib/retro/note-editor.ts`: debounce, conflict, read-only), the bulk export runner (`lib/action-items/bulk-export.ts`: sequence, stop, retry, per-item outcome), the board reducer actions, and each component's states.
- No browser walkthrough. Captures in light, 1440, French of the six retro phases with the new elements, compared with the mockups.

## 13. Acceptance criteria

1. In Writing, when a participant types a new card in a column, every other board shows within 2 s "Name is writing a card…" under that column and the writer's ringed avatar; it disappears within 5 s of the writer stopping, publishing, cancelling or closing the tab.
2. On an anonymous retro no `writing` client event is sent. While participants type cards, every other board shows in the presence line "Someone is writing…" or ":count people are writing…" within 3 s, never a name, a ringed avatar or a column line, and the count drops within 8 s of a writer stopping or closing the tab. The `writing.count` payload holds `count` and nothing else; the heartbeat answers 403 on a named retro and outside Writing, 423 on a locked board, 429 beyond 40 a minute; a guest may send it. Moving and notes indicators show "Participant".
3. In Grouping, dragging a card (pointer or keyboard) shows "Name is moving a card…" in its column on the other boards, gone after the drop or cancel.
4. An activity event with a sender that is not online, the viewer itself, or a kind the phase does not show changes nothing; the payload never decides the sender.
5. The facilitator pauses a running timer outside Icebreaker: `timer_ends_at` becomes null, `timer_paused_seconds` holds the seconds left, every board shows the paused time, and resuming restarts it for those seconds. Pausing in Icebreaker, pausing with no timer running, and resuming without a pause answer 422. "+2 min" on a paused timer adds 120 s to the paused seconds. A participant gets 403.
6. A timer never has both an end time and paused seconds; the model refuses such a row.
7. A retro created with "Max per card" 2 refuses a third vote of one participant on one card with "You can put at most 2 votes on one card.", accepts it on another card, and the settings change the cap until Grouping and refuse it from Voting on. With the automatic vote limit below the cap, the limit wins. Eight simultaneous votes of one participant on one card with a cap of 2 make exactly 2 votes.
8. In Voting, a participant (a guest included) presses "I have finished voting": every board shows the count go up; "Change my votes" takes it back; a vote cast or retracted afterwards is saved and takes it back too, in the same transaction (every board shows the count go down, the vote answer carries the new `finishedIds`, the voter sees "You changed your votes: you're no longer marked as finished."); a refused vote leaves "finished" as it was. Entering Voting again starts with nobody finished.
9. "x/y have finished" counts the people online, guests and the facilitator included.
10. In Discussing, the facilitator starts the topic timer for 5 minutes: `topic_seconds` is 300; moving the shared topic to another topic restarts the timer for 5 minutes on every board and marks the topic left as discussed; clearing the highlight changes neither; in Actions moving the topic restarts nothing.
11. The topics list shows "Now · mm:ss left" on the shared topic, "Discussed · n actions" on a discussed topic, and "~ n min left" computed as §6.5, nothing when no time per topic is set.
12. The facilitator marks and unmarks a topic discussed in Discussing and Actions; a participant gets 403; a child card gets 422; every board updates live.
13. Any participant, a guest included, writes a topic's notes in Discussing: the note is saved with its version, every board shows it, and the snapshot carries it. A save from an older version answers 409 with the current note and writes nothing; two first saves at the same moment create one row. Saving on a locked board answers 423 and outside Discussing 403.
14. While one person types a topic's notes, the others see "Name is taking notes…" and a read-only field; a 409 keeps the writer's text visible with "Your text was not saved".
15. The recap e-mail of a completed retro lists, under "Discussion notes", the topics with a non-empty note, by votes, at most 5, each cut at 300 characters; the AI summary input carries each lead card's note within its budget. Chat recaps and the webhook payload are unchanged.
16. An action item created in Discussing from the topic in front of the viewer, or in Actions from the shared topic, is stored with that topic's lead card; a card of another retro or a child card is refused with 422; the board shows the item's topic, the topic's count, and the session end's "Actions created" shows the topic.
17. The Discussing right column shows "Topic actions" for the topic in front of the viewer and "Other action items (n)" with every other item of the retro.
18. In the ROTI phase the facilitator reveals the ROTI: every board shows the mean and the distribution, the vote is closed (403 on a vote or a withdrawal), and the snapshot carries `roti.results`. Leaving the phase and coming back hides it again and reopens the vote.
19. The facilitator's "Nudge the last n" shows a toast and a pulse on the boards of the connected people who have not voted, never on the others; a second nudge within 30 s answers 429; a participant gets 403; after the reveal it answers 403.
20. In Actions, a member exports every item of the retro not yet linked to the chosen tracker in one dialog: the items are exported one by one through the existing endpoint, the progress and each key show as they come, a failure is listed with its reason and can be retried, and an item exported meanwhile by someone else is reported "Already exported" without a second issue. A guest has no button.
21. The creation dialog and the settings popover show "Max per card" with "No limit" on by default; the popover row is read-only for a participant, with the value.
22. A retro created before this plan behaves as before: no cap, nobody finished, nobody counted as writing, no pause, no time per topic, ROTI shown at the end.
23. Every new string exists in English, French, Spanish and German, informal in the last three (`TranslationKeysTest`, `InformalRegisterTest`).
24. The six retro phases are captured in light at 1440 in French with the new elements and without horizontal overflow, and compared with their mockups; each difference is fixed or is a row of the plan's deviations table.
25. The unit, feature and arch suites pass on PostgreSQL, SQLite, MariaDB and MySQL through `bin/test-db`, the concurrency suite on PostgreSQL, MariaDB, MySQL and a SQLite file; `tests/Arch/DatabasePortabilityTest.php` passes.

## 14. Risks

- **Anonymity by timing (accepted by the owner).** A named or timed "is writing" in a column ties a hidden card to its author; masking the name on the client does not help, since the presence id rides on every client event. On an anonymous retro the writing indicator is therefore a count sent by the server with no id and no column (§6.11 rules 1 to 7). What is left — a count of one in a room of two, a count dropping as a card appears — is the risk the owner accepted with answer C (§6.11 rule 8). A change that adds an id, a name or a column to `writing.count`, or sends a `writing` client event on an anonymous retro, breaks the tests of §6.11 rule 4 and is refused.
- **Heartbeat load.** Each writer on an anonymous retro sends one small request every 3 s and each sends one broadcast; a room of 15 writers makes 5 requests a second at most, each a single-row update and one count. The rate limit (40 a minute per participant) caps a broken client.
- **"x/y have finished" moves back (decision 10).** A finished participant who changes a vote is no longer finished; the count goes down. The facilitator reading "8/8" before moving on sees it drop if someone changes a vote; that is the answer's intent (the count stays true).
- **The icebreaker clock.** The retro's timer is the icebreaker game's round clock. Pause is refused in Icebreaker; a timer paused elsewhere and carried into Icebreaker leaves the game without a countdown until resumed. Covered by a feature test of the round's expiry job.
- **Lost notes.** The soft lock relies on client events; two people starting within the same second both type. The version check refuses the second save and keeps its text on screen; it is never merged. A participant whose browser drops client events (a proxy) sees no "is taking notes" and meets the 409 more often.
- **Long bulk exports.** A browser loop survives a slow tracker (one short request each) but stops if the tab is closed; the dialog says so and asks for confirmation. A tracker's rate limit shows as failed rows with "Retry".
- **The topic timer surprises.** Restarting the timer on every topic change can surprise a facilitator who wanted one timer for the whole discussion; stopping the topic timer (or never starting it in Discussing) keeps today's behaviour.
- **Shared retro files.** `BuildBoardSnapshot`, `ChangeRetroPhase`, `routes/web.php`, `lib/retro/types.ts`, `board-reducer.ts`, `use-retro-board.ts` and the four `lang/*.json` are touched by several lanes; the plan gives each lane its own block and the controller merges one lane at a time.
- **Plan 22 (SE-3).** "Timer per phase" will start timers at phase changes; it must respect a paused timer and the time per topic. This spec names the columns (`timer_paused_seconds`, `topic_seconds`, `max_votes_per_card`) that plan 22 builds on.
- **Plan 20 (WB-1).** It rebuilds the whiteboard toolbars; it may touch `components/skrum/` pieces the retro uses (`facilitator-bar.tsx`, `timer.tsx`). A conflict is resolved at merge; this plan changes `Timer` only by props it already has.

## 15. Decisions for the owner — answered 2026-10-03

All ten are answered. The body follows the answers: eight are the recommended option; decisions 1 and 10 differ (marked **≠ recommendation**) and the sections that depend on them were rewritten (§6.4, §6.9, §6.11, §7, §8, §9.1, §9.3, §11, §12, §13 criteria 2 and 8, §14). The pattern followed when recommending: the mockup wins for presentation, nothing a user has is lost, data is added only as simply as the screen needs, and a promise made to users (anonymity, secrecy of a vote) is never weakened to fit a drawing.

**1. "Is writing…" on an anonymous retro.** The Writing mockup draws "Inès is writing a card…" with "Anonymity: on". The presence id rides on every client event, so a named or timed indicator in a column tells who wrote the hidden card that appears there.
- **Answered: C** (≠ recommendation) — a count relayed by the server, no ids, no column. §6.11; the residual timing risk is accepted (§6.11 rule 8).
- A. Send it, and show "Participant is writing a card…" (the live-cursor rule). Faithful to the drawing; anyone reading the socket frames can tie a card to its author.
- B. Send nothing on an anonymous retro: no writing indicator there; moving and notes indicators stay. Recommended in draft v1: anonymity is a promise, and the product already turns cursors off where they tell a vote.
- C. A server-relayed count ("2 people are writing") without ids or columns: a new endpoint and event, still timing-revealing in a small room.

**2. Which timers can be paused?**
- **Answered: A** (recommended) — the retro's timer only.
- A. The retro's only, as the request ("Retro: … Pause") and the mockups (Writing's FacilitatorBar) say. **Recommended.**
- B. Every timer (retro, poker, whiteboard, game rooms), as "+2 min" was extended to all. About three more tasks; the poker auto-reveal job and the game expiry job must learn the pause.

**3. How is the time per topic set?**
- **Answered: A** (recommended) — from the topic's timer.
- A. From the topic's timer in Discussing: the duration chosen there is remembered as the time per topic and restarts on each topic change. **Recommended**: no new setting, the mockup's "5 min per topic" comes from the facilitator's own choice.
- B. A "Time per topic" row in the settings popover (and later in the creation dialog with SE-3); the topic timer starts from it. A row the popover mockup does not draw.
- C. A time per topic proportional to its votes. Not drawn, harder to explain.

**4. When is a topic "discussed"?**
- **Answered: C** (recommended) — automatic on moving on, and by hand.
- A. By hand only (the facilitator's toggle).
- B. Automatically when the facilitator moves the shared topic on, never by hand.
- C. Both: automatic on moving on in Discussing, and a toggle to fix it. **Recommended**: the mockup's checks appear without extra clicks, and a mistake can be undone.

**5. How are the notes edited together?**
- **Answered: A** (recommended) — one writer at a time, stale saves refused.
- A. One text per topic, one writer at a time ("Inès is taking notes…" makes the field read-only for the others), and a version check that refuses a stale save and keeps the loser's text on screen. **Recommended**: the mockup's single field, no dependency.
- B. A list of short entries per person (each edits their own lines). Conflict-free, but not the mockup's single field.
- C. Real co-editing (several cursors in one text) with a CRDT library: a new dependency, which needs the owner's approval.

**6. Where do the notes go after the discussion?** The Discussion README says the notes are "taken into the recap"; the session-end mockup draws no notes.
- **Answered: A** (recommended) — the recap e-mail and the AI summary input.
- A. The recap e-mail ("Discussion notes") and the AI summary input. **Recommended**: what the README says, nothing undrawn on screen.
- B. A plus a "Discussion notes" card on the session-end page (no mockup).
- C. Nowhere but the board.

**7. Does revealing the ROTI close the vote?** The mockup says "Vote saved · you can change it until the session ends" before the reveal.
- **Answered: A** (recommended) — yes.
- A. Yes: the reveal closes the vote for this pass through the phase. **Recommended**: once the distribution is on screen, a late vote or change would show which bar a person moved.
- B. No: votes stay open and the distribution follows them live.
- C. The reveal can be undone ("Hide ROTI"), votes open while hidden.

**8. What does "Nudge the last n" send?**
- **Answered: A** (recommended) — a live toast and pulse only.
- A. A live nudge on the board (a toast and a pulse for the connected people who have not voted, guests included). **Recommended**: the people nudged are in the room; nothing lingers after the retro.
- B. A plus a bell notification (and mail per preferences) to members who have not voted. A new notification type and preference row.

**9. How does the bulk export run?**
- **Answered: A** (recommended) — the browser, one item at a time, through the existing endpoint.
- A. The browser exports the items one by one through the existing endpoint, with progress, stop and retry. **Recommended**: no new route, no long request, per-item rights and errors as today.
- B. One batch endpoint that exports synchronously (capped at 25 items) and answers per item. One request; a slow tracker holds a worker for the whole batch.
- C. A queued job with live progress events. Survives a closed tab; a job, an event and a progress state more.

**10. After "I have finished voting", can the participant still vote?**
- **Answered: B** (≠ recommendation) — yes; casting or retracting a vote takes "finished" back by itself. §6.4.
- A. No: their votes are frozen until they press "Change my votes". Recommended in draft v1: "x/y have finished" stays true.
- B. Yes: a vote or a retraction takes the "finished" back by itself.

## 16. Not determined by reading

1. Whether Reverb relays client events from guest presence members as from members (the configuration says `members`, and guests are presence members of the retro channel; no test proves it). The plan's Vitest mocks the channel; only a live run would prove it.
2. Whether `ActionItemPermissions::authorizeEdit` lets a member export an item they neither created nor own; the bulk dialog relies on the per-item answer and lists a 403 as a failed row.
3. Whether the SQLite schema grammar adds the `card_id` foreign key to `action_items` without trouble (Laravel rebuilds the table on SQLite); plan 19 added foreign keys after creation the same way.
4. The real latency of a Jira create on the instances in use, hence how long a bulk export of 10 items takes.
5. Whether `RetroRecap`, built with named arguments in `BuildRetroRecap`, is also constructed in tests or the mail preview (`MailPreviewsController`); the plan adds an optional argument with a default so that every caller keeps working.
6. Whether the visual harness can show activity indicators without a live Reverb: the captures of the indicators are taken with a seeded reducer state through a test-only prop, or are left out and listed.
7. Whether `useCountdown` handles a null end time with paused seconds without a flash; the plan passes the paused seconds to `Timer` directly.
8. Whether the named rate limiter `retro-writing` runs after the middleware that puts the participant in the request attributes (route middleware run after the group's, so it should); the limiter falls back to the IP when no participant is there, and the plan's 429 test proves the key on a member and on a guest.
9. Whether a `DELETE writing` sent from `pagehide` reaches the server (browsers may drop it); the 8 s expiry of `writing_until` and the receivers' 8 s timeout cover a lost stop.
</content>
</invoke>
