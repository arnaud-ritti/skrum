---
title: "Tools reference"
description: "The 29 tools of the Skrüm MCP server, what each one does and the token scope it needs."
order: 2
related:
  - mcp/connect
  - mcp/prompts
  - reference/roles-and-permissions
---

Use this page to know what a connected assistant can ask of Skrüm, and which scope to give its token. The server registers 29 tools: 18 for retrospectives and action items, 11 for planning poker.

## How the tools behave

- An assistant is offered only the tools its token allows. A token with **Read** alone never sees a tool that changes something.
- A tool applies the rights you have in the interface, on the teams the token can see. An observer of a team cannot use a tool that changes something there.
- In tool names and results, a board is a retrospective, a message is a card and an agreement is an action item.
- Teams, boards, games, tasks and people are named by their id. The list tools return them.
- Lists come in pages: `limit` is 20 by default and 50 at most, `page` starts at 1, and `hasMore` tells whether a page follows.
- Errors come back in the language of your account.

## Retrospectives and action items

18 tools.

| Tool | What it does | Scope |
|---|---|---|
| `retro.teams.list` | Lists the teams you can see, in alphabetical order, with their workspace, whether you are a member, and how many of their boards are finished and unfinished. `workspace_id` keeps one workspace. | `mcp:read` |
| `retro.team.members.list` | Lists the members of a team with their workspace role (owner, admin, member) and their team role (owner, facilitator, member, observer). Their ids are the ones an action item is assigned to. | `mcp:read` |
| `retro.boards.list` | Lists the boards of a team, newest first. `since` and `until` keep the boards created between two dates, `finished_only` the completed ones. | `mcp:read` |
| `retro.actions.list` | Lists action items across all the boards of your teams. `status` is `open` (the default: to do and in progress), `doing`, `overdue`, `completed` or `all`; `assignee` is `me`, `unassigned` or a member's id; `team_id` or `workspace_id` narrows the list. Overdue items come first. | `mcp:read` |
| `retro.board.actions.list` | Lists the action items decided on one board, in the order they were added, with status, priority and assignee. | `mcp:read` |
| `retro.board.messages.list` | Lists the cards of a board by column, grouped cards under their lead card. `sort` is `position` or `votes`; sorting by votes is refused while the board hides vote totals. `limit` goes up to 200. | `mcp:read` |
| `retro.board.summary.get` | Returns the summary of a finished board and who took part. The summary is empty while the board is not finished, while it is being generated, when the team turned it off and when no AI provider is configured. | `mcp:read` |
| `retro.boards.search` | Searches your teams' boards for a keyword of 2 to 100 characters, in titles, summaries, action items and cards. Returns up to 20 boards with short excerpts. Cards the board still hides are not searched. | `mcp:read` |
| `retro.board.insights.list` | Lists what was generated for a board: themes (groups of related cards with their sentiment) and suggested actions with their status (pending, promoted, rejected). | `mcp:read` |
| `retro.board.health.get` | Returns the health check of a board. While it is open: who answered and your own scores. Once closed: the average per category, the overall score, the strongest and weakest categories and the trend over the team's last health checks. | `mcp:read` |
| `retro.board.roti.get` | Returns the ROTI of a board. While it is collected: how many people rated and your own rating. Once revealed: the average and the distribution. Once the board is finished: also the trend over the team's last finished boards. | `mcp:read` |
| `retro.actions.create` | Creates an action item, on a board (`board_id`, while the board is in the discussing, actions or ROTI phase and not locked) or on a team outside any retrospective (`team_id`). Takes the text (up to 500 characters), a priority (`high`, `medium`, `low`), a due date and an assignee. | `mcp:write` |
| `retro.actions.update` | Changes the text, priority, due date, recurrence (`weekly`, `every_two_weeks`, `monthly`) or assignee of an action item. Allowed for its author, the facilitator or an admin. Sub-tasks are not changed here. | `mcp:write` |
| `retro.actions.complete` | Marks an action item as done, or reopens it with `completed: false`. Completing a recurring item creates its next occurrence. | `mcp:write` |
| `retro.board.suggested_actions.promote` | Turns a suggested action into an action item, with the same wording. Each suggestion is handled once. | `mcp:write` |
| `retro.board.suggested_actions.reject` | Dismisses a suggested action. Each suggestion is handled once. | `mcp:write` |
| `retro.board.messages.update` | Changes the text of a card you wrote, while the board is in the writing or grouping phase and not locked. | `mcp:write` |
| `retro.board.messages.delete_own` | Deletes a card you wrote, while the board is in the writing or grouping phase and not locked. Cards grouped under it are ungrouped. This cannot be undone. | `mcp:delete` |

## Planning poker

11 tools.

| Tool | What it does | Scope |
|---|---|---|
| `poker.games.list` | Lists the planning poker games of a team, newest first, with their numbers of tasks, estimates and points. `status` is `active` (the default), `ended` or `all`. | `mcp:read` |
| `poker.game.get` | Returns a game: its deck, its players, the task on the table and the current round. Other players' cards appear once the round is revealed, without names in an anonymous round. | `mcp:read` |
| `poker.game.tasks.list` | Lists the tasks of a game in order, with their estimate and latest round. Before the reveal it shows who voted and your own card only. | `mcp:read` |
| `poker.games.create` | Creates a game for a team with a title and a deck: `fibonacci`, `modified_fibonacci`, `tshirt`, `powers_of_two`, or `custom` with your own cards or a deck the team saved. You become its facilitator. Guest access, automatic reveal and anonymous votes stay off. | `mcp:write` |
| `poker.game.tasks.add` | Adds 1 to 50 tasks, each with a title and an optional description in Markdown, at the end of a game. A game holds at most 200 tasks: when the batch does not fit, nothing is added. | `mcp:write` |
| `poker.game.task.select` | Puts a task on the table so that players can vote, or clears the table. Facilitator of the game only. | `mcp:write` |
| `poker.game.task.reveal` | Reveals the cards of the task on the table and stores the estimate the game suggests: the card nearest to the average for a numeric deck, otherwise the single most played card. When no card can be chosen, the estimate is left as it was. Facilitator of the game only. | `mcp:write` |
| `poker.sources.list` | Lists the issue trackers connected to a team (Jira, Jira Data Center, Linear, GitHub), with their status, whether tasks can be imported and estimates written back, and whether status sync is on. | `mcp:read` |
| `poker.iterations.list` | Without `container_id`, lists the first 50 containers of a tracker: Jira boards, Linear teams or GitHub repositories. With it, lists the active and upcoming iterations: Jira sprints, Linear cycles or open GitHub milestones. Refused to an observer of the team. | `mcp:read` |
| `poker.game.tasks.import` | Imports the issues of an iteration, or of a query (JQL for Jira, a search term for Linear or GitHub), into a game, at most 100 per call. A GitHub query also needs the repository, in `container_id`. Issues already imported are skipped. | `mcp:write` |
| `poker.game.task.sync` | Writes the estimate of an imported task to its tracker again, after a failed write or to force it. It does not change the estimate. Facilitator of the game only. | `mcp:write` |

## Tools that are not always offered

Seven of the 29 tools depend on how the instance and the team are set up:

- `retro.board.insights.list`, `retro.board.suggested_actions.promote` and `retro.board.suggested_actions.reject` are offered only when the instance has an AI provider configured.
- `poker.sources.list`, `poker.iterations.list`, `poker.game.tasks.import` and `poker.game.task.sync` are offered only when a tracker is enabled on the instance and connected to a team the token can see. See [Integrations](../../integrations/overview/).

## What no tool does

No tool casts a vote on a card, plays a poker card or sets an estimate to a value you choose. No tool creates a retrospective, moves it to another phase, writes a new card or deletes anything but your own cards. What a tool returns follows the rules of [What stays hidden from an assistant](../connect/).
