# QRetro open-source repos

| Repo | Stack | Licence | Reuse |
|---|---|---|---|
| qretro/live-cursors | TypeScript, zero deps, vanilla/Vue/React bindings, npm `live-cursors` | MIT | Code reusable (npm or vendored, keep notice) |
| qretro/live-reactions | TypeScript, zero deps, vanilla/Vue/React bindings, npm `live-reactions` | MIT | Same |
| qretro/mcp-server | Only README, `server.json`, LICENSE. Hosted server source is not public | MIT (docs) | Ideas only |

## live-cursors
- **Transport**: client events only, server never rebroadcasts. `src/transports/echo.ts` uses `channel.whisper("cursor", msg)` / `listenForWhisper`. Requires a private/presence channel (Reverb rejects client events on public channels). `stopListeningForWhisper(event)` removes all listeners for that event, so each feature needs a distinct event name. Other transports: BroadcastChannel, raw WebSocket (`e2e/relay.mjs`).
- **Wire** (`src/protocol.ts`, `v:1`): move `{v:1,t:"m",id,x,y,m?}` (x/y normalized 0..1, clamped on receive), leave `{v:1,t:"l",id}`. `parseMessage` drops malformed/non-finite input.
- **Identity**: the transport's `senderId` overrides the payload id, but the Echo transport passes none, so the id is spoofable. Validate against the presence roster (`here()`/`joining()`), or rely on Reverb attaching `user_id` if it does.
- **Rate**: `throttleMs=40` (~25 Hz), leading + trailing (`src/throttle.ts`).
- **Smoothing**: CSS `transition: transform 80ms linear`, disabled under `prefers-reduced-motion`.
- **Coordinates** (`src/space.ts`): `viewportSpace()` (default) or `elementSpace(el)` = `(clientX - rect.left + scrollLeft) / scrollWidth`. Relative to scrollable content, returns null outside 0..1. Use `elementSpace` for the board.
- **Idle**: `ttlMs=3000`, 1 s sweep; leave sent on `pointerleave`, window `blur`, `visibilitychange→hidden`; mouse only (`pointerType==="mouse"`); `maxRemote=50`; call `cursors.remove(id)` on presence `leaving()`.
- **Privacy**: `setEnabled(false)` stops sending (sends leave). No PII on the wire; labels come from the local roster through a `label` callback.
- **Colours** (`src/color.ts`): hash(id) → `hsl(h,70%,55%)`, or `paletteColor(id, palette)`. CSS var `--lc-color`; labels set as text; SVG arrow + pill label (max 160px).
- **React**: `useCursors({transport, selfId, container})` (useSyncExternalStore), `<LiveCursors label|renderLabel>`.

## live-reactions
- **Transport**: whisper `"reaction"`; example `Echo.join('board.{id}')`.
- **Wire**: `{v:1,t:"r",id,e}`, `e` any string ≤128 chars (`MAX_EMOJI_LENGTH`), so an allow-list check on receive is needed.
- **Emoji**: app-provided; suggested `["👍","❤️","👏","🎉","🤔","👎"]`.
- **Rate** (`src/bucket.ts`): token bucket on send, burst 5, 2/s; `send()` returns false when throttled. No per-sender receive limit. Receive caps: `maxQueue=60`, `maxConcurrent=40`, `staggerMs=90`.
- **Clustering**: the same emoji from ≥2 different senders within `clusterMs=700` merges into a growing balloon that pops at `burstAt=5`. One person spamming never forms a cluster.
- **Animation**: DOM nodes, `lr-float` ease-out, lifetime 2000–3500 ms, rise `--lr-rise` (80vh). Reduced motion: fade in place (`lr-hold`). Optional sender label. Receiver picks the origin (`src/origin.ts`: left/center/right/random with jitter, or a function of the sender, e.g. their avatar's x).
- **Visibility**: everyone on the channel. The sender sees theirs locally at once; echoes are filtered out.
- **Persistence**: none. `setEnabled(false)` stops sending and clears.

## mcp-server (hosted, docs only)
- Remote streamable HTTP at `https://mcp.qretro.com`; `server.json` schema 2025-12-11, name `com.qretro/retro` v1.3.0, listed in the MCP Registry.
- **Auth**: OAuth 2.1 browser sign-in (no token), or a Bearer API token (Settings → API Keys), optionally bound to one team. Both revocable.
- **Scopes**: `mcp:read`, `mcp:write`, `mcp:delete` (token only, never OAuth). Tools the client has no scope for are not listed. Access = scope ∩ team membership, same rules as the UI.
- **Naming**: `domain.scope.action`.
- **Read tools**: `retro.teams.list`, `retro.team.members.list`, `retro.boards.list` (team_id, since, until, finished_only), `retro.boards.search`, `retro.actions.list` (team_id, status, assignee, since; overdue first), `retro.board.messages.list` (by column, sentiment, category, votes), `retro.board.summary.get`, `retro.board.actions.list`, `retro.board.insights.list`, `retro.board.health.get` (0–10 per category, alignment, turnout, trend), `retro.board.roti.get`, `poker.sources.list`, `poker.iterations.list`, `poker.games.list`, `poker.game.get`, `poker.game.tasks.list`.
- **Write tools**: `retro.actions.create` / `.update` (text, priority, due, assign_to) / `.complete`, `retro.board.suggested_actions.promote` / `.reject`, `retro.board.messages.update` (own), `poker.games.create`, `poker.game.tasks.add` / `.import`, `poker.game.task.select` / `.reveal` / `.sync`.
- **Delete tools**: `retro.board.messages.delete_own`.
- **Deliberately absent**: setting an estimate directly, voting on the user's behalf.
- **Prompts**: `analyze-retro(board_id)`, `team-health(team_id)`.
- **Not public**: source, REST mapping, JSON schemas, pagination, rate limits. Rule: a null health check is reported as "surveys not run yet", not as an error.

## Porting notes for skrum
- Use `echoTransport({channel: Echo.join('retro.{id}'), event: 'cursor' | 'reaction'})` on the existing presence channel. Enable client events (`config/reverb.php` `accept_client_events_from`). Check sender ids against the roster. Emoji allow-list plus a per-sender receive limit.
- MCP with `laravel/mcp`: `domain.scope.action` names, read/write/delete scopes with hidden tools (`shouldRegister`), authorization through existing policies, streamable HTTP web route, OAuth (Passport) or Sanctum tokens with abilities.
