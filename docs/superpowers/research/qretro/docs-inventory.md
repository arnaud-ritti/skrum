# QRetro feature inventory (public docs)

Sources: `/docs`, `/docs/register`, `/docs/teams`, `/docs/retro`, `/docs/poker`, `/docs/games`, `/docs/integrations`, `/docs/mcp`, `/templates`, `/planning-poker`, `/planning-poker/jira`, `/changelog`, `/compare/parabol`, `/p/privacy`.
**[S]** = stated, **[I]** = inferred. Not documented anywhere: presentation mode details, ROTI scale/UI, email notifications, poker stats screens, Linear setup guide.

## Registration
- Google OAuth or a one-time email code; optional password ("I have a password"). No separate signup: the first sign-in creates the account. Unconfirmed accounts with no activity are deleted after 7 days.
- Team invites are accepted under Retrospectives → "Invitations" → Accept.
- Guests join without an account and get an auto-generated name they can rename. Guest data lives as long as the sessions do. Since 27 Jul 2026, guest cards/comments/actions are retained.

## Teams
- Settings → Your Teams → Add Team. Invite with "Add User" by email; invitations can be revoked, members removed. Unlimited participants.
- Team boards are private to members; public boards also exist (changelog, 19 Jan 2026).
- Roles: owner, admin, facilitator. Only the owner connects Slack and changes poker games (import, reveal, sync).
- Team settings tabs: General (name, description, avatar), Integrations, Members.

## Retrospective board
**Create**: 100+ templates advertised, 52 listed; or custom columns. Options: column names, Private Mode, Show Author, Allow GIFs, Health Check on/off, Icebreaker on/off + game.

**Stages** (any can be skipped; host can go back):
0. **Health Check** (optional): 6 aspects on a 1–10 scale: Colleague Interaction, Task Clarity, Manager Support, Vision & Strategy, No Blockers, Motivation. Voter avatars shown. Radar chart at Results. MCP adds per-category score, alignment, turnout, trend.
1. **Icebreaker** (optional): one of 4 games, switchable even mid-icebreaker; host-run; the board timer closes turns.
2. **Comments/Brainstorm**: cards per column; private mode hides others' cards; GIFs in cards; emoji reactions.
3. **Grouping**: drag-and-drop merge; group name suggested automatically.
4. **Voting**: limit = cards + 3, max 10. [I] per participant; unclear whether groups count as one card.
5. **Discussion**: top-voted items first; add action items.
6. **Results**: generated summary, action items, survey results, health chart, "Games we played". Share to Slack/Telegram, send by email. "Recommended next steps" / suggested actions can be promoted or rejected once. Results can be reopened.

**Board settings**: Private Mode, Disable Voting, Hide Vote Count, Vote Limit, Allow GIFs, Show Author, Close for Editing, Health Check, Icebreaker. Observed in-app too: Show reactions, Show live cursors, Presentation mode.
**Columns**: rename + description, colour, clear cards, delete.
**Reactions**: floating emoji 👍 ❤️ 👏 🎉 🤔 👎 + extended picker; per-card reactions.
**Live cursors**: yes; libraries extracted as MIT packages (changelog, 2 Aug 2026).
**Timer**: limits stage time, notifies everyone at the end, closes icebreaker turns, reveals GIF answers.
**Surveys**: Add → Add Survey: title, description, ≤10 options, single choice. Results shown after voting; closed when the board closes or via "Close Survey". Can be generated from a prompt [observed].
**Action items**: added from the "Tasks" menu; a global Tasks page per team. Fields: text, status (open/completed), priority (High/Medium/Low), due date (overdue flag), assignee. The author and board owner can edit; the assignee can complete. Comments on tasks [observed]. Export to Jira/Linear as issues [I, privacy page].
**ROTI**: distribution + trend via MCP; included in the Slack recap. Scale not documented [I: 1–5].

## Planning poker
- Decks: Fibonacci `0 1 2 3 5 8 13 21 34 55 89 ? ☕` (default); Modified Fibonacci `0 ½ 1 2 3 5 8 13 20 40 100 ? ☕`; T-shirt `XXS XS S M L XL XXL ? ☕`; Powers of 2 `0 1 2 4 8 16 32 64 ? ☕`; custom via MCP.
- Tasks: manual (title + Markdown description) or imported from Jira/Linear (sprint/cycle, JQL/text). Imports bring summary, description, assignee, reporter, existing points; descriptions sync.
- Flow: share a link (no account needed) → facilitator selects a task → everyone votes → "Show Votes" reveals all → automatic average → "Re-vote". The estimate comes only from revealed votes; nobody votes for someone else. `?`/☕ are excluded.
- Write-back: Jira story-point field (detected per site, write scope); Linear estimate (max 64, 0 = clear). Validated before sending; T-shirt games cannot sync. `needs_sync` flag per task.
- Lists show task and estimated counts; individual votes are kept per task.

## Games
- Draw & Guess (2+), Sprint in one GIF (1+), Hangman (1+), Decoded (2+). Played standalone or as the icebreaker, same rules.
- Rooms: Games → Start a game (name, personal or team space). Owners/admins/facilitators create them in a team. Rooms persist until deleted; ≤10 per team; owner/admin deletes (removes rounds). A card shows players, round count, access mode.
- Access: team-only by default, or open by link (guests get a random name/avatar, no uploads). Invites via Slack/Telegram. ≤12 players.
- Runtime: auto-starts on open; the host hands turns in Draw & Guess and Decoded; all state live; the host timer ends turns or reveals GIFs; history of the last 20 rounds (word, leader, outcome); drawings reopenable.
- **Draw & Guess**: the host passes the brush; only the drawer sees the word (others see `_ _ _`). 6 colours, 3 sizes, eraser, fill, undo, clear. Can reveal letters, up to half the word. Live strokes. Wrong guesses in chat; a near miss (1–2 letters) is flagged "very close" to the guesser only. A correct guess is never shown, only who got it and the word, then the turn ends. Also ends on timer or pass. Endless rotation.
- **Sprint in one GIF**: shared question, replaceable until the first answer. GIF from search or upload (guests search only). Hidden until the host or timer reveals. New round with a new question.
- **Hangman**: 6 misses; dev/team/agile words; anyone picks letters, no turns; the player who opens the final letter is credited; the host starts the next word.
- **Decoded**: ≤5 emoji, editable live, no letters/digits; guessing as in Draw & Guess.
- Words: shared dictionary; undrawable words excluded from Draw & Guess; language = retro language or room opener's; no repeats until exhausted.

## Integrations
- **Slack**: owner only; OAuth + channel picker (reconnect to change). Share board link; "Share to Slack" recap: participants, card count, ROTI, summary, agreements, top-voted card per column. Loss of access → "Reconnect required"; Disconnect.
- **Telegram**: add @qretrobot, `/connect <team_id>`. "Share to Telegram" sends results + summary, plus unspecified important-event notifications.
- **Jira**: OAuth, Cloud only, read or write scope, upgradeable without reconnecting. Team-owned, team boards only. **Linear**: same idea. A team can connect both.
- **Email**: invites, one-time codes, "Send to Email" of results.

## MCP
- `https://mcp.qretro.com` over HTTP. OAuth consent shows app, redirect and scopes; covers all of the user's teams; never delete; auto-renew; revoke under "Connected applications". Or a Bearer token (shown once; read always, write/delete opt-in; optionally team-bound).
- Scope ∩ membership, same as the UI; private-mode hidden cards stay hidden, even in search. See `repos.md` for the tool list.
- Every doc page has Copy page, a raw Markdown link, and "Open in ChatGPT/Claude".

## Account & data
- Profile: theme, generated-content language, name, avatar upload (png/jpg/webp).
- Export: JSON (profile, boards, cards, comments, votes). Delete: erases name/email/avatar; cards/comments stay, anonymised.
- Content is kept until the host or creator deletes it. No quotas, no history limit, no per-seat fee.
