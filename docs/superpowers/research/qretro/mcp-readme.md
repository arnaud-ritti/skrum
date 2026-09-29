# QRetro MCP server — public README (reference contract)

Source: README of https://github.com/qretro/mcp-server, provided by the user on 2026-09-30 as the contract skrum's MCP server must follow (adapted to a self-hosted instance: the server lives on the skrum instance, not at mcp.qretro.com).

## Connect
- Streamable HTTP, one address, no token needed: the client opens the sign-in page itself (OAuth 2.1).
- Access token alternative for automations/CI/header-only clients: created in Settings → API Keys, optionally bound to a single team; sent as `Authorization: Bearer <token>`.

## Tools — names follow `domain.scope.action`; domains `retro` and `poker`

### Retrospectives — read
| Tool | What it does |
|---|---|
| `retro.teams.list` | Your teams, with the number of finished and unfinished boards in each |
| `retro.team.members.list` | Team roster with each person's permission — the source of user IDs for assigning work |
| `retro.boards.list` | A team's retrospectives, newest first; filter by period or finished only |
| `retro.boards.search` | Keyword search across summaries, action items and participant cards |
| `retro.actions.list` | Open action items across every retrospective at once, overdue first |
| `retro.board.messages.list` | Participant cards by template column, with sentiment, category and votes |
| `retro.board.summary.get` | Summary of a board and its participants |
| `retro.board.actions.list` | Action items of one board with status, priority and assignee |
| `retro.board.insights.list` | Semantic clusters and the follow-ups the system suggests |
| `retro.board.health.get` | Score per category on a 0–10 scale, alignment, turnout, trend across previous retros |
| `retro.board.roti.get` | ROTI with distribution and historical trend |

### Planning poker — read
| Tool | What it does |
|---|---|
| `poker.sources.list` | Which issue trackers a team has connected and what each can do |
| `poker.iterations.list` | Sprints of a connected tracker, active and upcoming |
| `poker.games.list` | A team's games, newest first, with task counts and how many already carry an estimate |
| `poker.game.get` | One game: scale, progress, the task on the table, and the join link |
| `poker.game.tasks.list` | Tasks with estimate, individual votes, tracker key and sync state |

### Write — requires `mcp:write`
| Tool | What it does |
|---|---|
| `retro.actions.create` | Create an action item on a board |
| `retro.actions.update` | Update text, priority, due date or assignee |
| `retro.actions.complete` | Mark an action item completed |
| `retro.board.suggested_actions.promote` | Turn a suggestion into an agreement, keeping its wording and the theme it came from |
| `retro.board.suggested_actions.reject` | Dismiss a suggestion |
| `retro.board.messages.update` | Edit a message authored by the current user |
| `poker.games.create` | Open a game with a ready-made or custom scale |
| `poker.game.tasks.add` | Add tasks by hand, for work outside a tracker |
| `poker.game.tasks.import` | Pull a whole sprint, or search results, from a connected tracker |
| `poker.game.task.select` | Put a task on the table for everyone in the game |
| `poker.game.task.reveal` | Reveal the cards and compute the estimate from the votes cast |
| `poker.game.task.sync` | Write the agreed estimate back to Jira or Linear |

### Delete — requires `mcp:delete`
| Tool | What it does |
|---|---|
| `retro.board.messages.delete_own` | Delete a message you authored |

Deliberately impossible: setting a poker estimate directly (only from revealed votes) and voting on the user's behalf.

## Prompts
- `analyze-retro(board_id)` — summary, clusters, agreements, health and ROTI; key themes, risks, what to change next time.
- `team-health(team_id)` — score and ROTI trends across recent retros, how many agreements get closed, what keeps repeating.

## Permissions
| Scope | Allows | Sign-in (OAuth) | Token |
|---|---|---|---|
| `mcp:read` | Read retrospectives, messages, action items, metrics, poker games | yes | yes |
| `mcp:write` | Create and update action items, messages and poker games | yes | yes |
| `mcp:delete` | Delete your own messages | no | yes |

Access = client grant ∩ the user's team memberships. Tools without permission are not offered. Permissions match the interface exactly: a client can do only what the user could do on the same board. Revoke in Settings → API Keys ("Connected applications" for sign-ins, token list for tokens).

## Manifest
`server.json` published to the MCP Registry as `com.qretro/retro` (skrum instances are self-hosted; a registry entry is out of scope).
