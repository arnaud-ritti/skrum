# Coverage — games

Coverage pass of 2026-10-04 on `tests/coverage-games`. Browser tests run on PostgreSQL (`testing_l68_browser`), feature tests through `bin/test-db pgsql`. New files: `tests/Browser/Walkthroughs/CoverageGamesTest.php` (CVG-01 to CVG-05) and `tests/Feature/Games/GameReadRoutesAccessTest.php`.

## Routes

GET routes of the area from `route:list --method=GET`. "Refused" names the test that proves the wrong viewer is turned away.

| Route | Kind | Renders for the right viewer | Refused for the wrong viewer |
|---|---|---|---|
| `teams.games.index` `/w/{workspace}/teams/{team}/games` (rooms, team leaderboard, periods) | page | P13a-01, P13d-09a, P13d-10a/b, P18e-06-01, P18e-06-02, P18e-06-07, P18e-06-11, R27-24, visual `games-index-page`, `games-index-empty-page` | CVG-04 (workspace member outside the team: 403 page; another workspace: 403 page; visitor: login; observer: no "New room"), P13d-09a (guest: login); feature `TeamGameLeaderboardTest` |
| `games.show` `/games/{room}`, hangman | page | P13a-01 to P13a-09, P13d-04, R27-01 to R27-09, P18e-06-04, P18e-06-05, P18e-06-08, P18e-06-12, visual `games-room-hangman`, `games-room-hangman-end`, `game-hangman-*` | CVG-01 (other team: 403 page; other workspace: 403 page; visitor of a team room: login), CVG-02 (visitor of a link room without its cookie: "Your session has ended."), CVG-03 (observer: read only), P13a-07 (guest after the room became team-only), P13a-09 (deleted room); feature `GameAccessTest` |
| `games.show`, Draw & Guess and Decoded | page | P13b-01 to P13b-13b, R27-17 to R27-19, R27-22, P18e-06-06, P18e-06-08b, P18e-06-10a, visual `games-room-draw*`, `games-room-decoded*`, `game-draw-*`, `game-decoded-settings` | as above; P13b-03 (word kept from a guesser) |
| `games.show`, Sprint in one GIF | page | P13c-01 to P13c-06, R27-20, R27-21, visual `games-room-gif*`, `game-gif-*` | as above |
| `games.show`, Two truths, Mood weather, Guess who?, Quick question | page | R27-10 to R27-15, visual `game-two-truths-*`, `game-mood-results`, `game-guess-who-vote`, `game-quick-question`, `game-over` | as above |
| `games.show`, icebreaker room | redirect | CVG-05 (sends to its retro); the icebreaker plays on the retro board: P13d-06a to P13d-06e, R27-16, R27-23 | feature `GameAccessTest` |
| `games.join.show` `/play/{guestToken}` | page | P13a-02, P13d-07, P18e-06-09, every `joinAsGuest` of the games files, visual `games-join-page` | P18e-06-03 (invalid link, HTTP 404), P13a-07 (link no longer valid), visual `games-join-invalid-page`, CVG-05 (team member goes straight to the room); feature `GameJoinTest` |
| `games.snapshot.show` | JSON | every room page; P13a-03 reads it | feature `GameReadRoutesAccessTest` (member, guest, observer 200; other team and other workspace 403; no session 401), `GameAccessTest`, `GameSnapshotTest` |
| `games.rounds.index` (history) | JSON | P13a-05, P13b-13a/b, R27-24 | feature `GameReadRoutesAccessTest`, `GameRedactionTest` |
| `games.rounds.show` (ended round) | JSON | P13a-05, P13b-13a, P13c-05a | feature `GameReadRoutesAccessTest` (also a round of another room: 404), `GameRoundEngineTest` |
| `games.rounds.secret.show` (word for the leader) | JSON | P13b-03 (drawer gets it; guesser 403) | feature `GameReadRoutesAccessTest` (observer, other workspace 403; no session 401), `WordGuessPlayTest` (host, guesser, guest 403; ended round 409) |
| `games.gifs.index` | JSON | P13c-02, R27-20 | feature `GameReadRoutesAccessTest`, `GameGifSearchTest` (no provider, turned off) |

Phone 390x844, dark and English: P18e-06-05 (390), P18e-06-06, P18e-06-08b, R27-07 (390), R27-08 (dark), R27-09 (English and French), and the 8 configurations (light/dark, 1440/390, en/fr) of every capture of `GamesPagesVisualTest`. The plan 27 captures of `GamesExtendedVisualTest` are light, 1440, French only.

## Acceptance criteria — plan 27 (§13)

| # | Criterion | Test |
|---|---|---|
| 1 | Settings card for managers, live; 403 / 422 | R27-01 (manager, live to the other manager, no card for a guest); feature `GameRoomSettingsTest` |
| 2 | Existing rooms play as before; new rooms' defaults | feature `GameRoomSettingsTest`, `GameSettingsModelTest` (not a screen) |
| 3 | Words from the chosen themes; pools | feature `WordThemesTest` (not a screen) |
| 4 | Rounds numbered, "Game over", next game at 1 | R27-02 |
| 5 | Turn deadline by job and lazy check | R27-05; feature `GameTurnsTest` |
| 6 | Hangman in turns; skip; two skips move one turn | R27-03, R27-05, R27-15 ("Next" of the host); feature `HangmanTurnsTest`, `GameTurnsTest` (hangman has no skip button, spec §9.4) |
| 7 | Whole-word guess | R27-04; feature `HangmanWordGuessTest` |
| 8 | Auto hints and countdown | R27-19; feature `AutoHintsTest` |
| 9 | GIF caption, vote budget, hidden authors, ranking | R27-20, R27-21; feature `SprintGif*Test` |
| 10 | Two truths, Mood weather, Guess who?, Quick question | R27-10, R27-11, R27-12, R27-14, R27-15, R27-16; feature `TwoTruths*Test`, `MoodWeatherTest`, `GuessWhoTest`, `QuickQuestionTest` |
| 11 | Secrecy of sets, lies, authors, votes | feature `*RedactionTest`, `PayloadLeakHelperTest` (payloads, not screens); R27-12 (no author of a weather shown) |
| 12 | Weather under 3 picks; Guess who? not in an anonymous retro | R27-13, R27-16 |
| 13 | Screens match their mockups (light/1440/fr) | visual `GamesExtendedVisualTest`; mockup table below |
| 14 | Eight games in picker, session create, team page, leaderboard, history, "Games we played" | R27-06, R27-23, R27-24, R27-25 |
| 15 | Snapshot query count constant | feature `GameSnapshotTest` |
| 16 | Strings in four languages, informal | `TranslationKeysTest`, `InformalRegisterTest`, R27-09 |
| 17 | Duration and players on every card | R27-06, visual `game-picker-eight` |
| 18 | Several finders in Draw & Guess | R27-17; feature `DrawFindersTest` |
| 19 | New word and Redo | R27-18; feature `DrawNewWordTest` |
| 20 | Decoded's list of puzzles | R27-22 (now also "Hidden until its turn") |

## Mockups

Mockups rendered from `docs/design-system/components/<Name>/preview.html` at 1440 with `app.css`, `_preview-bundle.css` and lucide icons inlined (no `bundle.js` exists; none of the six previews has a dark section). App captured fresh from the visual tests (light, 1440, French). Captures stayed in a temp folder. Rows P27-xx are pre-build deviations already ruled in the plan 27 spec §17.

| Mockup | Status | Notes |
|---|---|---|
| ScreenIcebreaker | open | The mockup is the retro's icebreaker; the room adds "Give up", "History" and "Reset scores". Open: misses badge "3 erreurs sur 6" vs "3 / 6 erreurs"; the reaction bar docks at the bottom (mockup floats it over the stage title); the turn timer sits on a row under the title instead of beside it. Ruled: "Pendu" (P27-02), eight cards with players (P27-01, P27-04), "+5 pts" (P27-07), "Paramètres de la partie" and "Deviner" (P27-17), "Tour de :name" (P27-16). |
| ScreenIcebreakerDraw | fixed / open | Fixed: French turn timer "restantes pour ce tour". Open: the drawer's word is in lower case in a card with the hint button (mockup: capitals, "Autre mot" beside it); the read-only note of the drawer reads "Tu connais le mot, tu ne peux donc pas deviner." (mockup: "Tu dessines — les propositions sont en lecture seule pour toi."; the key is shared with Decoded). |
| ScreenIcebreakerEmoji | fixed / open | Fixed: coming puzzles read "Masquée jusqu'à son tour", the current one "En cours". Open (big): the answer field, "Your attempts" and "Found · 2 / 5" sit in the right column's guess chat, not under the stage; the right column shows the room's scores, not "Round leaderboard" with times nor "Total after n rounds" bars; the Decoded timer reads "restantes pour ce tour" where the mockup says "restantes". Ruled: "Énigmes" with one finder (P27-14), "Décodé" (P27-02). |
| ScreenIcebreakerGif | open | "Prêts n / m" is a progress row of its own (mono digits) where the mockup puts "3 / 6 prêts" beside "Participants"; the tie card title wraps on three lines in the narrow column. Ruled: no GIF title, duration nor "Pin to the retro" (P27-09), "Révélé" after the close (P27-18), tie podium (P27-19). |
| IcebreakerGameCard | matches | Ruled: tile colours (P27-03), "Devine" (informal register), players minimum (P27-04). |
| GamesLeaderboard | fixed / open | Fixed: subtitle "Petits jeux pour réchauffer l'équipe :team.". Open: the room list says "Salons" / "Nouveau salon" where the French mockup keeps "Rooms" / "Nouvelle room"; a leaderboard row counts rounds ("2 manches") where the mockup counts games ("11 parties"); room rows add the rounds count and the access, which wraps the "En direct" badge to a second line. |
