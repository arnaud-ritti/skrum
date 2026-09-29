# QRetro research (2026-09-29)

Sources: live app (logged-in session), https://qretro.com/docs/*, /templates (52, see templates.md),
screens/ (doc screenshots), repos qretro/live-cursors, live-reactions (MIT), mcp-server (docs only, MIT).

## Board (observed UI + screenshots)
- Header: editable title · phase breadcrumb (Health Check → Warmup/Icebreaker → Brainstorm → Group → Vote → Discuss → Finish), done phases get check icon, current = filled green. Share (copy link / download QR). Avatar strip of participants.
- Toolbar: `?` (reopens per-phase facilitator tour, 4–6 steps, "Facilitator" badge) · votes left `5/10` · Timer (1/3/5 min presets + custom minutes) · Tasks (action-item drawer) · Add survey · Add column · Board Settings · `Ready?` toggle + `n/m` count.
- Board Settings dropdown (observed): Show reactions ✓, Show live cursors ✓, Presentation mode, Enable Health Check ✓, Enable Icebreaker ✓, Enable GIFs ✓. Docs add: Private Mode, Disable Voting, Hide Vote Count, Vote Limit (auto cards+3, max 10), Show Author, Close for Editing.
- Column menu (⋮): rename + description inline, Save, Change color, Clear (all cards), Delete. Columns have a description line under title.
- Card: author avatar+name header (unless anonymous), content, footer: Delete, Edit (pencil), vote 👍 count + vote button, comment icon, add-reaction icon (per-card emoji reactions).
- Grouping: group = titled container ("Staging and CI stability") holding cards; auto-suggested group name.
- Reaction bar bottom-center: 👍 ❤️ 👏 🎉 🤔 👎 + picker → flying emoji.
- Surveys render as a leftmost pseudo-column: question header + ⋮, description, options as bars with % fill and voter avatars; single choice; reactions + comment on survey.
- Tasks drawer: "Description*" + Add; Task list. Task card: author, text, priority select (High/Medium/Low, icons), assignee select, done ✓, edit, delete, comment.
- Results (Finish): "Reopen" button, "Send to Email", "Thanks for participating!" + participants, generated summary paragraph, Team Health radar (6 axes, score x/10, participation n/m), Key signals (Top strength, Growth area), Alignment score (consensus x/10), health assessment text, plus action items, survey results, games played.

## Health check
- 6 statements, 1–10 scale (Awful → Great), voters' avatars + vote count per statement:
  Interaction with colleagues was productive · Tasks assigned to me were clear · My manager was understanding and supportive · The vision and goals are clear to me · (No blockers / Processes) · (Motivation).
- Results: radar, average, top/weakest axis, alignment (spread → consensus), trend across retros (MCP).

## Voting
- Limit auto = cards + 3, max 10 (overridable). Hide vote count / disable voting options.

## App shell
- Sidebar: team switcher · Home · Retrospectives · Action items · Planning Poker · Games · Guide · Settings; user menu (Settings, Create board ⇧N, Logout).
- Retrospectives list: Active (cards with date, card count, "Create new board") + Completed with results.
- Create dialog: team, board name (default "Retro <date>"), template category dropdown ("Common templates"), template list with description + column preview, Settings, Change template, 1–5 quick-pick, Start.
- Global Action items page: all tasks across boards (open/overdue first).
- Settings: profile (theme, generated-content language, name, avatar upload, JSON export, delete account → anonymize), API keys (tokens for MCP), team (name, description, avatar; Integrations tab; Members tab: invite by email, list).

## Planning poker
- Decks: Fibonacci, Modified Fibonacci, T-shirt, Powers of 2 (+ custom). `?` and ☕ excluded from estimate.
- Game = task list (manual Markdown or Jira/Linear import). Facilitator selects task → all vote → Show votes → average → Re-vote. Estimate only from revealed votes; write-back to Jira/Linear.
- UI: left task list with vote counts; right: player cards (name + card), task detail; Delete / Re-vote / New game. Guests join by link.

## Games (standalone rooms + retro icebreaker)
- Draw & Guess, Sprint in one GIF, Hangman (6 misses), Decoded (≤5 emoji). Rooms: team-only or open-by-link, ≤12 players, ≤10 rooms/team, last 20 rounds history.

## Integrations
- Slack (owner, OAuth, channel; share link + recap), Telegram bot (/connect team_id), Jira/Linear (poker import + write-back; action items → issues), email (results).

## Realtime libs (MIT, reusable)
- live-cursors: whisper `cursor` `{v:1,t:"m",id,x,y}` normalized to board element (elementSpace), 40 ms throttle leading+trailing, TTL 3 s, leave on blur/hidden, mouse only, color hash→HSL, "hide my cursor" toggle. Spoofing: verify id vs presence roster.
- live-reactions: whisper `reaction` `{v:1,t:"r",id,e}`, token bucket burst 5 / 2 per s, cluster same emoji from ≥2 senders in 700 ms, DOM float 2–3.5 s, reduced-motion fade. Need allow-list + per-sender receive limit.
- Reverb: needs client events enabled; private/presence channel only.

## MCP
- Remote streamable HTTP; OAuth (read/write, never delete) or Bearer token (read + opt-in write/delete, optionally team-bound); tools hidden without scope; access = scope ∩ membership; hidden cards stay hidden.
- Tools `domain.scope.action`: teams.list, team.members.list, boards.list/search, actions.list/create/update/complete, board.messages.list/update/delete_own, board.summary.get, board.actions.list, board.insights.list, board.health.get, board.roti.get, suggested_actions.promote/reject, poker.* . Prompts: analyze-retro, team-health.
