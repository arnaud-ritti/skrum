# Skrum — Board engagement — Design

Date: 2026-09-29
Status: Approved design, awaiting spec review
Parent spec: `docs/superpowers/specs/2026-09-29-retro-board-core-design.md` (all its rules apply unless this spec changes them explicitly — see §9)
Research: `docs/superpowers/research/qretro/` (QRetro parity roadmap, spec 1 of 7)

## 1. Intent

Make the board feel alive and conversational, on par with QRetro: people see each other's cursors (mouse and touch), send flying emoji, react to cards with any emoji, discuss cards in threaded comments with live notifications, attach GIFs to cards, and the facilitator gets QRetro's board-control toggles.

**Success:** every rule below is covered by a feature test or a step of the two-browser walkthrough; test suite, phpstan, type-check and lint stay green; the only new npm dependencies are `live-cursors`, `live-reactions` and `frimousse`.

### In scope

- Live cursors (ephemeral), for mouse, touch and pen.
- Flying emoji reactions (ephemeral), any single emoji.
- Per-card emoji reactions (persisted), six quick emoji plus a full picker.
- Card comments (persisted) with one level of threaded replies.
- Live in-app comment notifications.
- GIFs in cards through a server-proxied provider (GIPHY or Tenor, bring your own key).
- Six facilitator board settings: reactions, live cursors, GIFs, hide vote counts, close for editing, presentation mode.

### Out of scope

- Persistent notification inbox, email notifications.
- GIF uploads.
- Frontend test runner, browser E2E suite.

### Dependencies (approved by the user on 2026-09-29)

- `live-cursors`, `live-reactions` (npm, MIT, zero runtime deps, React bindings, by QRetro).
- `frimousse` (npm, headless React emoji picker).

## 2. Data model

### `retros` — new columns

| Column | Type / default | Meaning |
|---|---|---|
| `reactions_enabled` | bool, `true` | Flying reactions and card reactions available |
| `cursors_enabled` | bool, `true` | Live cursors available |
| `gifs_enabled` | bool, `true` | GIFs can be attached to cards (only when a provider is configured) |
| `hide_vote_counts` | bool, `false` | Vote totals hidden during `Voting` |
| `is_locked` | bool, `false` | "Close for editing": board content frozen |
| `presentation_mode` | bool, `false` | Highlighted card shown as a full overlay in `Discussing` |

All six are changed through the existing `PATCH /retros/{retro}/settings` (facilitator only), in any phase except `Completed`, and broadcast the existing `settings.changed` event (clients refetch the snapshot).

### `cards` — new column

- `gif_id` (nullable string): provider GIF id. `content` becomes nullable; a card must have non-empty `content` or a `gif_id` (validation: `content` 1–1000 characters when present).

### `card_reactions` — new table

- `id` (UUID), `retro_id`, `card_id` (cascade on delete), `participant_id`, `emoji` (string), timestamps.
- Unique (`card_id`, `participant_id`, `emoji`).
- `emoji` validation (shared rule `SingleEmoji`): exactly one extended grapheme cluster that matches the Unicode emoji property (`\p{Extended_Pictographic}` or a regional-indicator pair / keycap sequence), at most 16 bytes.
- Quick set shown first in the UI: `👍 ❤️ 👏 🎉 🤔 👎` (a frontend constant, not a server restriction).

### `card_comments` — new table

- `id` (UUID), `retro_id`, `card_id` (cascade on delete), `participant_id`, `parent_comment_id` (nullable self-FK, cascade on delete), `content` (nullable text, 1–500 characters when present), `deleted_at` (nullable timestamp, soft delete for parents with replies), timestamps.
- One level only: a reply's `parent_comment_id` always points to a top-level comment. Replying to a reply stores the reply's parent instead.

### Local preferences (`localStorage`, no server state)

- `skrum.hideMyCursor` — "Hide my cursor".
- `skrum.readComments.{retroId}` — map of card id → last-seen comment timestamp, for unread dots.

## 3. Ephemeral realtime: cursors and flying reactions

### Transport

- `config/reverb.php`: `accept_client_events_from` changes from `'none'` to `'members'`, so only authorized members of presence channels can whisper. The private `participant.{id}` channel carries no whispers.
- Both libraries use their Echo transport on the existing presence channel `presence-retro.{retroId}`, with event names `cursor` and `reaction`. `useRetroChannel` exposes the joined channel instance so it is not joined twice.
- Nothing is persisted and the server never processes these messages.
- If an operator enables Reverb rate limiting (`REVERB_APP_RATE_LIMITING_ENABLED`), its limit must allow ~25 cursor messages/s per connection; `.env.example` documents this.

### Identity and abuse (receive side)

- The payload `id` is the sender's participant id. Messages whose `id` is not in the current presence roster (`here` / `joining`, minus `leaving`) are dropped.
- A member can still claim another member's id. Accepted risk: it only affects ephemeral visuals. Documented in the spec and in a code comment.
- Flying reactions: messages whose emoji fails the same single-emoji check as `SingleEmoji` (client-side port) are dropped; each sender is rate-limited on receipt with a token bucket (burst 5, 2/s), mirroring the send-side limit.
- Messages failing parsing, roster, emoji or rate checks are dropped silently.

### Live cursors

- Coordinates: `elementSpace(boardScrollContainer)` — normalized to the board's scrollable content, so positions match across screen sizes and scroll offsets.
- **Mouse:** handled by the library: send throttle 40 ms (leading + trailing); leave sent on pointer leave, window blur and tab hidden.
- **Touch and pen:** the library ignores non-mouse pointers, so skrum adds its own sender that writes the library's wire format with `m: {p: "touch"}` (or `"pen"`), throttled at 40 ms, only while the pointer is down (`pointerdown` → `pointermove`), and sends a leave on `pointerup` / `pointercancel`. Incoming messages go through the library's `ingest()`.
- Remote cursor removed after 3 s without movement; removed immediately on presence `leaving`. At most 50 remote cursors.
- Rendering: mouse → arrow; touch/pen → dot. Both carry a label.
- Label: participant display name. On anonymous retros the label is the translated "Participant" and no avatar is shown; colour stays stable per participant.
- Colour: library hash of the participant id.
- Shown in every phase except `Completed`, only when `cursors_enabled`.
- "Hide my cursor" (user menu switch) stops sending for all pointer types; the viewer still sees others' cursors.

### Flying reactions

- Bar with the six quick emoji plus a `+` opening the `frimousse` picker, bottom-centre of the board.
- Each reaction rises from above the sender's avatar in the presence strip; if its position is unknown, from a random point near the centre.
- Same emoji from several senders within the library window gathers into a growing bubble (library default).
- Available in every phase except `Completed`, only when `reactions_enabled`.
- `prefers-reduced-motion`: emoji fade in place instead of flying (library default).

## 4. Card reactions and comments

### Rules

- Allowed from `Grouping` onward on any visible card, including cards inside a group. Before `Grouping` → 403.
- `Completed` → read-only (403). `is_locked` → 423. Reactions additionally require `reactions_enabled` (403 otherwise).
- Reacting is a toggle per (card, participant, emoji).
- A comment is edited only by its author; deleted by its author or the facilitator.
- Deleting a top-level comment that has replies soft-deletes it: `content` is cleared, `deleted_at` set, and it renders as "Comment deleted" with its replies intact. A top-level comment without replies, or a reply, is hard-deleted. When the last reply of a soft-deleted parent is deleted, the parent is hard-deleted too.
- Anonymous retros: reaction chips show counts only (no names); comment authors are not serialized to others. Own reactions/comments carry `mine: true` / `isMine: true`.

### Endpoints (under `/retros/{retro}/…`, participant resolved per request)

| Method | Path | Body | Response |
|---|---|---|---|
| PUT | `/cards/{card}/reactions` | `{emoji}` | card reaction summary; idempotent |
| DELETE | `/cards/{card}/reactions` | `{emoji}` | card reaction summary; idempotent |
| POST | `/cards/{card}/comments` | `{content, parentCommentId?}` | comment presented for the author |
| PATCH | `/comments/{comment}` | `{content}` | comment presented for the author |
| DELETE | `/comments/{comment}` | — | 204 |

Invalid emoji → 422. A `parentCommentId` from another card → 422. Error messages are translated.

### Broadcast events

Via `RetroBroadcastEvent`: after commit, `toOthers()`, report-don't-throw.

- `card.reactions.changed` — `{cardId, reactions: [{emoji, count}]}` (ordered by count desc, then first use). No participant data. The acting client sets its own `mine` flag from its own action; the snapshot provides `mine` on load.
- `comment.created`, `comment.updated` — the comment presented for others (author omitted on anonymous retros). `comment.deleted` — `{cardId, commentId, soft: bool}`.
- The author's other tabs receive `own-comment.saved` on the private `participant.{participantId}` channel with the comment presented for the author (same mechanism as `own-card.saved`).

### Comment notifications (live, in-app)

- On `comment.created`, the server sends `comment.notification` on the private `participant.{id}` channel of each recipient: the card's author, plus every participant who already commented in the same thread (top-level comment and its replies; for a top-level comment, only the card's author), minus the new comment's author.
- Payload: `{cardId, commentId, threadId, excerpt}` (excerpt ≤ 80 characters) plus `authorName` only when the retro is not anonymous.
- The client shows a toast ("New comment on your card" / "New reply in a thread you follow") and an unread dot on the card; opening the card's thread records it as read in `skrum.readComments.{retroId}`.
- Because it goes only to private channels, it never reveals a card's author on anonymous retros.
- Sent only for new comments and replies, never for edits or deletions.

### Snapshot

- Each visible card gains `gif` (`{id, previewUrl, url}` or null), `reactions: [{emoji, count, mine}]`, `commentCount`, `comments: CommentPayload[]` (top-level oldest first, each with `replies[]` oldest first, `deleted: bool`).
- Loaded with one query per relation (no N+1); query count constant as cards grow.
- Others' cards in `Writing` keep the existing redaction and carry none of these fields (including `gif`).

## 5. GIFs in cards

### Provider configuration

- `config/services.php` → `gifs`: `provider` (`giphy` | `tenor`, env `SKRUM_GIF_PROVIDER`), `key` (env `SKRUM_GIF_API_KEY`), `rating` (env `SKRUM_GIF_RATING`, default `pg`).
- The feature is available only when both provider and key are set. Otherwise the picker, the `gifs_enabled` switch and the search endpoints are hidden / return 404. `.env.example` documents the variables.

### Search and proxy

- `GET /retros/{retro}/gifs?q=` — participant-only, allowed only when the viewer can currently edit a card (phase `Writing` or `Grouping`, not locked, `gifs_enabled`). Returns up to 24 results `{id, previewUrl, width, height}`. Empty `q` returns trending. Rate-limited to 20 requests/minute per participant. Results cached 10 minutes per (provider, query, rating).
- `GET /gifs/{id}/{size}` (`size` = `preview` | `full`) — streams the image from the provider's CDN, with long-lived cache headers and a local cache (default filesystem disk, `gifs/` prefix). Only ids that belong to at least one card or appeared in a cached search result are served. Browsers never contact the provider directly, so viewer IPs are not shared with it.
- A provider failure returns 502 with a translated message; the picker shows "GIF search is unavailable."

### Card rules

- Attaching or removing a GIF follows the same rules as editing the card's content (own card, phase, lock), plus `gifs_enabled`.
- Turning `gifs_enabled` off keeps existing GIFs visible but blocks new ones.
- The `card.*` broadcasts and the snapshot carry the `gif` object with proxied URLs; redaction as for content.

## 6. Board settings behaviour

- **Show reactions** (`reactions_enabled`): off hides the flying bar and card reaction chips/picker for everyone; existing reactions are kept and reappear when turned back on.
- **Show live cursors** (`cursors_enabled`): off unmounts the cursor layer for everyone.
- **Allow GIFs** (`gifs_enabled`): see §5.
- **Hide vote counts** (`hide_vote_counts`): see §9.
- **Close for editing** (`is_locked`): every mutation of cards (including GIFs), groups, positions, votes, reactions, comments and action items returns 423 "The board is closed for editing."; phase changes, timer, highlight and settings still work for the facilitator. A header badge shows the locked state to everyone and editing controls are disabled.
- **Presentation mode** (`presentation_mode`): in `Discussing`, the highlighted card opens as a modal overlay for everyone, showing its content, GIF, author (unless anonymous), vote total, reactions and comments. Non-facilitators may close it locally; it reopens on the next highlight change. No effect in other phases.

## 7. UI

- Card: GIF shown above the text (proxied preview, full on click). Card editor gains a "GIF" button opening a search popover (grid, infinite scroll not required, "Powered by GIPHY/Tenor" attribution).
- Card footer: reaction chips (emoji + count; tooltip with names unless anonymous), `+☺` button opening the six quick emoji and the full picker; comment button with count and unread dot, opening an inline thread under the card: top-level comments with collapsed replies ("3 replies"), reply box, edit/delete on own comments, delete on any for the facilitator.
- Flying reaction bar bottom-centre with `+` picker; cursor layer over the board scroll container.
- User menu: "Hide my cursor" switch.
- Facilitator settings dialog: six new switches (GIF switch only when a provider is configured).
- Header: "Board closed for editing" badge when locked.
- Toasts for comment notifications.
- Every new string exists in `lang/{en,fr,es,de}.json`.

## 8. Error handling

- Failed reaction/comment/GIF mutation → optimistic update rolled back + toast (same as votes).
- 423 → toast "The board is closed for editing." and a snapshot refetch.
- 404 (card or comment deleted concurrently) → item removed locally.
- 429 on GIF search → "Too many searches, wait a moment."; 502 → "GIF search is unavailable."

## 9. Change to the parent spec: vote totals during Voting (parity)

The parent redaction table hides vote totals during `Voting`. This spec aligns with QRetro:

| `hide_vote_counts` | Vote totals during `Voting` | `Discussing` / `Completed` |
|---|---|---|
| `false` (default) | visible, live | visible |
| `true` | hidden (parent behaviour) | visible |

- `vote.cast` / `vote.retracted` broadcasts and the vote endpoints' responses carry `{cardId, total}` during `Voting` only when `hide_vote_counts` is false; the snapshot follows the same rule. `votesCast` and `votes_version` ordering are unchanged.
- **Who voted** stays never exposed, in every phase and setting.
- The parent spec gets a note pointing to this section.

## 10. Testing

Pest feature tests, alongside the existing `tests/Feature/Retros/*` files. Provider HTTP calls are faked with `Http::fake()`.

- **Card reactions:** add idempotent; remove idempotent; `SingleEmoji` accepts ZWJ sequences, skin tones, flags and keycaps, rejects text, two emoji and oversized strings (422); 403 in `Writing` and `Completed` and when `reactions_enabled` is off; 423 when locked; response and broadcast carry no participant data; snapshot `mine` flag.
- **Comments:** create/edit/delete with validation (1–500); edit author-only; delete by author or facilitator, 403 for others; reply to a reply attaches to the top-level comment; parent from another card 422; soft delete of a parent with replies and hard delete once the last reply goes; phase and lock rules; no author in broadcast or snapshot on anonymous retros; `own-comment.saved` delivered only on the author's private channel; card deletion cascades comments and reactions.
- **Notifications:** recipients are the card author plus thread participants minus the commenter; none in `Completed`; anonymous retro payload has no `authorName`; sent only on private channels.
- **GIFs:** endpoints hidden without provider config; search rules (phase, lock, `gifs_enabled`, rate limit, caching); proxy serves only known ids and never exposes the provider key; card attach/remove follows content rules; `Writing` redaction hides others' GIFs; provider failure → 502.
- **Settings:** each of the six toggles is facilitator-only, rejected in `Completed`, and broadcasts `settings.changed`.
- **Lock:** every mutation endpoint listed in §6 returns 423 while locked; phase change, timer, highlight and settings still succeed.
- **Vote totals:** during `Voting`, vote responses, broadcasts and snapshot include totals when `hide_vote_counts` is false and omit them when true; totals visible in `Discussing` either way; voter identity never present.
- **Snapshot:** new fields present from `Grouping`; `Writing` redaction intact; constant query count.
- **Reverb config:** `accept_client_events_from` is `members`.
- **Manual two-browser walkthrough** (one desktop, one phone or touch emulation): mouse and touch cursors appear, follow scrolling, disappear on blur / lift / "Hide my cursor"; flying reactions (quick and picker) from both browsers gather; card reactions with a picker emoji; threaded replies and notifications toast + unread dot; GIF search and display; anonymous retro shows "Participant" labels and no names on chips, comments or notifications; toggles take effect live; lock blocks edits; presentation overlay follows highlight.

Type-check and lint stay green; no frontend test runner is added.

## 11. Acceptance criteria

1. Cursors (mouse, touch, pen) and flying reactions travel only as presence-channel whispers, are validated against the roster, the single-emoji rule and the receive rate limit, and are never persisted.
2. Card reactions accept any single emoji and follow the phase, lock and enablement rules in §4.
3. Comments support one level of replies, soft deletion of parents with replies, authorship and anonymity rules in §4.
4. Comment notifications reach exactly the recipients in §4, only on private channels, without revealing anonymous authors.
5. GIFs work only with a configured provider, are always served through the proxy, and follow card content and redaction rules (§5).
6. The six settings behave as in §6.
7. Vote totals follow §9; voter identity is never exposed.
8. Snapshot additions respect `Writing` redaction and have a constant query count.
9. All new strings are translated in en/fr/es/de.
10. Suite, phpstan, type-check and lint are green; walkthrough passes.
