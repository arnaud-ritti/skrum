# Plan 18e — Group 6, games

## Task G1: team games page (`games/index`)

Page `resources/js/pages/games/index.tsx` (renders `AppLayout active="games"`), container `components/games/team-games.tsx`, hook `components/games/use-team-games-channel.ts`, presentational `skrum/games-leaderboard.tsx`.

### Parity (brief 06 §3 rows 1–12, brief 01 §3 rows 47–52)

| # | Action | New control | Done |
|---|---|---|---|
| 1 / 47 | Open "New room" | `NewGameRoomDialog` in the header and in the empty state; only when `canCreate` | done |
| 2 / 48–51 | Create a room (name max 60, available games only, access) | `#new-room-name`, `#new-room-game`, `#new-room-access`, "Create room"; `router.post` to `teams.games.store`; the server messages show under their field and the dialog stays open | done |
| 3 / 52 | Cancel, Escape | dialog "Cancel", Radix | done |
| 4 | Back to the team | header link "Back to the team" | done |
| 5 | Open a room | one link per room, named "name, game, status, n players"; rounds, "Open by link" / "Team only" in the row | done |
| 6 | Room limit text | "This team already has :count game rooms." | done |
| 7 | Empty rooms | "No game rooms yet." with "New room" | done |
| 8 | Period 30 days / all time | tabs `[aria-label="Period"]`, partial reload of `period` and `leaderboard` | done |
| 9 | Deferred leaderboard, retry | skeleton while the prop is absent; "Could not load the leaderboard." and "Try again" when the page's `rescuedProps` holds `leaderboard` | done |
| 10 | Streak badge from two weeks | on the podium and in the rows | done |
| 11 | Points, wins, rounds; "No games played yet." | podium points; rows "n rounds · n wins" and points | done (wins and rounds of the first three are not shown: the mockup's podium has points only) |
| 12 | Current user marked | ring on the podium, accent row | done |

New with B28 (M19): status badge, avatar stack with the count of players not sent, "started n min ago"; the list is live on `private-team-games.{teamId}` and the leaderboard reloads when a round of a listed room ends.

### Places left

None. The deviations of D-20 that concern this page stay backlog.

### Differences with the mockup

| Difference | Covered by |
|---|---|
| No "needs n more players" line; a waiting room shows its rounds count there | D-20 |
| No "Finished" rooms: a room is live or waiting | D-20 (spec B28: two statuses) |
| Game tiles are the four games of the engine (Sprint in one GIF takes the sky tile of "Two truths and a lie") | D-20 |
| Row of a room also shows the rounds count and "Open by link" / "Team only" | parity rows 5 (no existing feature lost); no row in the table |
| Leaderboard rows read "n rounds · n wins", the mockup "n games · n wins" | the product counts rounds; no row in the table |
| Streak badge on the podium and in the rows; the mockup has none | parity row 10, Task 0.10; no row in the table |
| Status labels are the mockup's ("Live", "Waiting for players"); the plan text says "Playing" and "Waiting" | the mockup wins (rule 13) |
| The rooms card scrolls inside itself beyond 30rem (`GameRoomList`), the mockup shows four rooms only | component of plan 18c |
