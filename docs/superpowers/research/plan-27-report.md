# Plan 27: games — settings, turns and rounds, GIF captions and podium, the whole-word guess, four new games — report

Branch `plan-27-games` (worktree `.claude/worktrees/rm27`), cut from `roadmap` at `678bf871`. Spec:
`docs/superpowers/specs/2026-10-21-plan-27-games-design.md`; plan: `docs/superpowers/plans/2026-10-21-plan-27-games.md`.
Final run on 2026-10-03 on the code of `6d473a92` (the rector pass below); the commit after it adds this report only.
Not pushed; `main` and `roadmap` untouched.

The controller runs the plan's tasks in numeric order on this one branch, so this report is written **after Tasks 1 to 26
and before Tasks 28 to 31** (the owner's answers P27-04, P27-08 and P27-14). Criteria 17 to 20 are therefore not built
yet (§2), and the renames of Task 26 wait for those tasks, as the commit of Task 26 says.

## 1. Result

One command at a time in the shared application container `skrum-laravel.test-1`, database `testing_l27`
(`TEST_DB_DATABASE=testing_l27`, `TEST_DB_WORKDIR=/var/www/html/.claude/worktrees/rm27`). PostgreSQL only (owner,
2026-10-03): SQLite, MariaDB and MySQL run in the roadmap's final four-engine matrix, not here.

| Run | Result |
|---|---|
| `bin/test-db pgsql --parallel --processes=4` (Unit, Feature, Upgrade, Arch) | `PASS, Tests: 2 skipped, 6280 passed (56295 assertions)` (4 min 30) |
| `bin/test-db pgsql --concurrency` | `PASS, Tests: 1 skipped, 31 passed (127 assertions)` |
| `bin/check-pg-upgrade` (databases `testing_l27_upgrade_old` and `_fresh`) | `PASS, every row is there, and the schemas are equal apart from the five legacy check constraints`; the two migrations `2026_10_27_100000_add_game_settings_and_turns` and `2026_10_27_100100_create_game_choice_tables` ran on the old install |
| `bin/test-db pgsql -- tests/Feature/Games tests/Upgrade/GameSettingsUpgradeTest.php` (after the rector pass) | `PASS, 653 passed (18668 assertions)` |
| `bin/test-db pgsql -- tests/Arch` (after the rector pass) | `PASS, 107 passed (232 assertions)` |
| `composer types:check` (PHPStan) | `passed`, 0 errors |
| `vendor/bin/pint --format agent` | `passed` |
| `composer rector:check` | fails on 199 files, of which plan 27 created 12; see §1.1 |
| `npm run test` (Vitest) | `404 files, 4265 tests passed` |
| `npm run types:check`, `npm run check` | no error; 1119 files formatted, no lint warning in 1102 files |
| `vp build`, then `wayfinder:generate --with-form` | built; nothing to commit afterwards |

`TranslationKeysTest`, `InformalRegisterTest`, `UuidPrimaryKeysTest` and `tests/Arch/DatabasePortabilityTest.php` passed
inside the whole suite. Browser walkthroughs and smoke tests were not run (owner's rule); the captures are those of
Task 25.

### 1.1 Rector

`composer rector:check` is not clean on this branch, nor on its base (as in plans 18e and 19). Before the pass it
listed 215 files, 28 of them created by plan 27. In the pattern of plans 18e and 19, the pass (`6d473a92`) applied rector
to the files plan 27 created: a typed constant in `BroadcastToEveryone`, typed closures in event assertions, arrays
instead of `compact()`, `toBeEmpty`, `toHaveSameSize`, `toBeFalsy`. Left as they were:
`NewMethodCallWithoutParenthesesRector` on ten actions and rules classes and on two tests (no file of the project
uses that form yet), and every file older than this plan.

## 2. Acceptance criteria (spec §13)

Every PHP test named here ran in the whole PostgreSQL suite above, unless the row says concurrency or upgrade. Vitest
files ran once in `npm run test`. The four engines come with the roadmap's final matrix.

| # | Criterion | Proved by |
|---|---|---|
| 1 | Settings card for managers; 403 for a non-manager and a guest; 422 outside §6.2; `game.room.changed` | `GameRoomSettingsTest` ("lets the host change every setting, and tells the other players", "refuses values outside the lists", "refuses the settings to a player who does not manage the room, and to a guest", the two icebreaker cases); `game-settings-card.test.tsx`, `lib/games/settings.test.ts` |
| 2 | An existing room plays as before; a new room starts with turns in hangman, two GIF votes, hidden authors | `GameSettingsModelTest` ("gives a room created without settings the behaviour rooms had before", "gives a round no number, no turn, one vote and visible authors by default"); `GameRoomSettingsTest` ("starts a new room with turns in hangman…", "starts an icebreaker room with the same defaults"); `GameTurnsTest` ("plays the four existing games without turns, as before"); upgrade `GameSettingsUpgradeTest`; `bin/check-pg-upgrade` |
| 3 | Words from the chosen themes; a used-up themed pool resets alone | `WordThemesTest` (five cases, among them "forgets the used words of the themed pool only when it is used up" and "refuses themes that leave no word") |
| 4 | Rounds numbered per game; "Game over" after the last; next start is 1; a switch starts at 1 | `RoundNumberTest` (four cases); `round-info.test.tsx`, `round-end-card.test.tsx` ("closes the last round of a game…", "leaves the players waiting for the host after the last round") |
| 5 | Turn deadlines by job and lazy check, rooms and icebreakers; a stale job does nothing | `GameTurnsTest` ("ends an expired turn from its job, and a stale job does nothing", "ends an expired turn on the next request of anyone…", "ends a round that is its own turn when its deadline passes"); concurrency `GameTurnTest`; `turn-timer.test.tsx`, `lib/games/turns.test.ts` |
| 6 | Hangman in turns: only the turn's player acts; acts and expiries pass the turn; host skip; two skips move one turn | `HangmanTurnsTest` (five cases); `GameTurnsTest` ("lets the turn's player end the turn, and the host skip it…", "refuses a turn end from another player…"); concurrency `GameTurnTest`, `HangmanTurnPickTest`; `hangman-turn-banner.test.tsx`, `letter-keyboard.test.tsx`, `turn-order.test.tsx` |
| 7 | Whole-word guess: +5 and win; a wrong one costs a life and shows in "Last moves"; the guess is never broadcast | `HangmanWordGuessTest` (four cases); `hangman-word-guess.test.tsx`, `hangman-feed.test.tsx` |
| 8 | Auto hints on schedule up to half the word; the countdown matches | `AutoHintsTest` (five cases); `lib/games/hints.test.ts`, `auto-hint-countdown.test.tsx` |
| 9 | Caption ≤ 60, hidden until the reveal; vote budget, never on one's own GIF, never beyond under concurrency; hidden authors; ranks with ties; top authors win (not in an anonymous retro) | `SprintGifCaptionTest`, `SprintGifBudgetTest`, `SprintGifPodiumTest`, `SprintGifRedactionTest`; concurrency `GifVoteBudgetTest`; `gif-caption-field.test.tsx`, `gif-vote-budget.test.tsx`, `gif-podium.test.tsx`, `gif-voting-stage.test.tsx`, `lib/games/gif.test.ts`; unit `CompetitionRankingTest` |
| 10 | The four new games in rooms and in the icebreaker, with their points; prepared Two truths sets; Guess who? draw and single vote | `TwoTruthsTest`, `TwoTruthsSetsTest`, `MoodWeatherTest`, `GuessWhoTest`, `QuickQuestionTest`, `StagedGamesTest`, `PromptsTest`; Vitest `two-truths-board`, `two-truths-set-form`, `mood-weather-board`, `guess-who-board`, `guess-who-vote`, `quick-question-board`, `question-banner`, `lib/games/two-truths.test.ts`, `lib/games/mood.test.ts` |
| 11 | No secret reaches a viewer who should not see it | `TwoTruthsRedactionTest`, `GuessWhoRedactionTest`, `MoodWeatherTest` ("tells everyone who has answered, and each player their own weather only", "shows the weather at the reveal from three answers, without any author"), `SprintGifCaptionTest` ("keeps a caption from the other players until the reveal…"), `SprintGifPodiumTest` ("hides the authors of revealed GIFs until the close…"), `HangmanWordGuessTest` (no broadcast of the guess), `GameSettingsModelTest` ("never serialises the lie…") |
| 12 | Mood weather: no distribution under 3; Guess who? unavailable in an anonymous retro | `MoodWeatherTest` ("keeps the weather back under three answers"); `GuessWhoTest` ("is not offered in the icebreaker of an anonymous retro"); `mood-weather-board.test.tsx` ("keeps the weather back under the threshold"), `game-picker.test.tsx` ("says why Guess who? cannot be played in an anonymous retro") |
| 13 | Screens match their mockups (captures light/1440/fr); other differences are approved rows | Captures of Task 25 (`tests/visual/__screenshots__/game-*-light-1440-fr.png`, fourteen), compared in Task 26. **Not fully met yet:** rows P27-15 to P27-19 wait for the owner (§3); the three captures of Tasks 28, 30 and 31 are not taken |
| 14 | Eight games in the picker, session-create fields, team page, leaderboard, history, "Games we played" | `GameModelTest` (the eight labels), `IcebreakerRoomTest` (`icebreakerGames` lists eight), `GameRoomsTest`, `TeamsTest`, `GamesPlayedTest`; `game-picker.test.tsx`, `icebreaker-game-card.test.tsx`, `games-leaderboard.test.tsx`, `games-played.test.tsx`, `round-end-card.test.tsx`; capture `game-picker-eight` |
| 15 | Constant snapshot query count | `GameSnapshotTest` ("builds the snapshot with a constant number of queries") |
| 16 | Strings in four languages, informal; suites, PHPStan, type-check, lint, build; Upgrade tests | `TranslationKeysTest`, `InformalRegisterTest` (Task 24 reviewed the values); §1 above; upgrade `GameSettingsUpgradeTest` and `bin/check-pg-upgrade` on PostgreSQL |
| 17 | Duration and players on every card | **Not built yet: Task 29** (runs after this report) |
| 18 | Draw & Guess: several finders | **Not built yet: Tasks 28 and 30** |
| 19 | "New word" and Redo | **Not built yet: Tasks 28 and 30** |
| 20 | Decoded's list of puzzles | **Not built yet: Tasks 28 and 31** |

## 3. Differences left with the mockups

Rows P27-01 to P27-14 were answered by the owner on 2026-10-03 (plan, **Pre-build deviations**; spec §17). Found later
and still to put to the owner (plan rows, spec §17.1):

- **P27-15** — Two truths, "Ready": built as "Statements ready" (fr "Affirmations prêtes"), since the key "Ready" is
  already the plural "Prêts" of the GIF lane.
- **P27-16** — "Tour de :name" without the elision of "Tour d'Arnaud", and the full name.
- **P27-17** — "Paramètres de la partie" and "Deviner" (existing keys keep their values) where the mockup says
  "Réglages de la partie" and "Proposer".
- **P27-18** — GIF step 3: the budget and the voters' marks are gone once the round has ended; the gallery reads
  "Revealed".
- **P27-19** — GIF podium: a tie for first names every winner; the mockup draws no tie.

Fixed in Task 26 rather than recorded: the settings rows sized as the mockups' `.g-set`, the categories control drawn as
a select, the game card titles on two lines, three French values ("Chrono", "Auteurs cachés jusqu'aux votes",
"Manches").

## 4. Existing tests edited, and why

| Test | Edit | Why |
|---|---|---|
| `GameModelTest` | the list of labels holds eight games | four new games (Task 1) |
| `IcebreakerRoomTest` | `icebreakerGames` lists eight; two hangman starts send a `turn_order` | four new games; a room made by `EnsureIcebreakerRoom` takes turns in hangman (decision 2, Task 5) |
| `GameRoomsTest` | `gameOptions` holds only hangman in the test's registry | the options offer only the games whose rules are registered (`a21beb72`) |
| `GameSnapshotTest` | the `settings` key, `number`, `roundsTotal`, turn and hint keys in the exact shapes; the options case lists only registered games; `gameSnapshotFor()` moved to `tests/Pest.php` | settings, numbering, turns and hints are in the snapshot (Tasks 3 to 6); every lane uses the helper |
| `GameRoundEngineTest` | `number` and `roundsTotal` in the exact shape | round numbering (Task 4) |
| `SprintGifTest` | `caption`, `rank`, `number`, `roundsTotal` in the exact shapes; the author of the most-voted GIF wins | captions (Task 9), the podium and winner (decision 7, Task 10), numbering |
| `SprintGifVotingTest` | `caption` in the shapes; the author wins | as above |
| `SprintGifAnswersTest`, `SprintGifRedactionTest`, `GamesPlayedTest` | `caption` in the exact shapes | captions (Task 9) |
| `SprintGifSupportTest` | `PickGifQuestion` → `PickRoundQuestion` with the question list | the question picker became generic (Task 7) |
| `tests/Support/FakeGameRules.php` | turn methods | the `GameRules` contract gained the turn's expiry (Task 5) |
| `tests/Pest.php` | `gameSnapshotFor()` | shared by every lane (Task 3) |
| Vitest: `game-picker`, `gif-answer-stage`, `gif-round-results`, `gif-tile`, `gif-your-pick`, `hangman-board`, `letter-keyboard`, `room-header`, `games-leaderboard`, `icebreaker-game-card`, `room-reducer` | cases added; `gif-round-results` cases reworked for ranks and the podium | the screens of Tasks 15 to 23 |

No test was deleted.

## 5. Decisions taken on the owner's behalf

- Guess who? text answers are rate-limited in a bucket of their own (burst 5), not the game-play bucket (burst 3):
  writing, fixing and withdrawing an answer is typing (`a583f835`).
- "Games we played" has no rules registry, so a Mood weather round is a line with its outcome there; the weather is shown
  in the room history (`00b538f1`).
- Game rounds say "manche" in French: the settings row and the endless round line got keys of their own, since "Rounds"
  and "Round :number" are the planning poker's "Tours" / "Tour" (`cde9f818`); "Rounds per game" shortened to "Manches" /
  "Rondas" / "Runden" to fit the 300 px column (`1317bc34`).
- Rows P27-15 to P27-19 (§3) are built as described and wait for the owner.
- The rector pass leaves `NewMethodCallWithoutParenthesesRector` aside, as plans 18e and 19 did.
- This report is written before Tasks 28 to 31, since the controller runs the tasks in numeric order; those tasks
  complete criteria 13 and 17 to 20 and the renames of Task 26.

## 6. Stale walkthroughs (listed, not run)

Browser walkthroughs are neither run nor edited (owner's rule). Those that name games, and may describe behaviour this plan
changed (turns in new hangman rooms, two GIF votes and hidden authors, eight cards):

- `tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php`
- `tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php`
- `tests/Browser/Walkthroughs/Plan13cSprintGifTest.php`
- `tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php`
- `tests/Browser/Walkthroughs/Plan18eGamesTest.php`
