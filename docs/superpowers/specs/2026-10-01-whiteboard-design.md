# Skrum — Whiteboard — Design

Date: 2026-10-01
Status: Design approved in conversation, awaiting spec review
Parent spec: `docs/superpowers/specs/2026-09-29-retro-board-core-design.md` (tenancy, roles, guests, realtime, redaction, i18n and packaging rules apply unless this spec says otherwise). Room pattern: `docs/superpowers/specs/2026-09-29-planning-poker-design.md` (parallel player table, guard, snapshot builder, presence channel).
Plans: 17a–17d (§15).

## 1. Problem statement

Teams using skrum leave it whenever a session needs free-form space: a brainstorm, a flowchart, a story map, a SWOT. They open Miro or a similar hosted tool, which means a second account, a second place where workshop output lives, and data leaving a self-hosted installation that was chosen precisely to keep it in. Retro boards are column-based and cannot hold diagrams or spatial layouts, so today skrum has no answer for these sessions.

## 2. Goals

1. A team runs a template-based workshop end to end inside skrum, with a member and a guest in two browsers, without a reload.
2. A change made by one participant is visible to the others in under 1 second on a local network.
3. A facilitator can keep a session on track: a shared countdown, a board lock, element locks and bringing everyone to their view. Every one of these rules is enforced on the server and pinned by feature tests.
4. A board survives reloads, reconnects and mistakes: the exact scene is restored on load, and an earlier version can be brought back.
5. The feature adds one dependency (`@excalidraw/excalidraw`) and no new service to the Docker image.

## 3. Non-goals

- **Comments on the canvas.** Separate interaction model (threads, notifications); a later spec.
- **Attaching a whiteboard to a retro.** v1 boards are standalone; linking needs changes to the retro flow.
- **Importing `.excalidraw` files, Excalidraw libraries, or inserting a template into an existing board.** Import needs its own validation and id-remapping rules; templates apply at creation only.
- **Global undo, per-element change log, time scrubbing.** Own undo/redo is local; shared recovery goes through versions (§9).
- **Per-board roles (viewer, commenter), following an arbitrary member, MCP tools, integrations, webhooks, LLM features.** Each is a follow-up once the core is used.
- **Character-level merging of concurrent text edits.** Two people editing the same element at once: the later version wins (§6).
- **Dot voting and private writing.** Voting on sticky notes, and notes kept from the other participants while people write: built in plans 17c/17d and removed on 2026-10-01 at the product owner's request. Requirements R8 and R9 and §11.4–11.5 of earlier revisions of this spec described them.

## 4. User stories

Facilitator (team member who created the board or took control):

- As a facilitator, I want to create a board from a template so that the session starts with the right structure instead of an empty canvas.
- As a facilitator, I want to invite people outside the workspace with a link so that stakeholders can take part without an account.
- As a facilitator, I want to bring everyone to my view, lock the board or lock the template's structure so that the session stays on track.
- As a facilitator, I want to start a shared countdown so that every activity is time-boxed.
- As a facilitator, I want to restore an earlier version so that an accidental mass deletion is not fatal.
- As a facilitator, I want to save a board as a workspace template so that the team can repeat a format it designed.

Team member:

- As a team member, I want to add sticky notes, shapes, connectors, text, frames, drawings and images on an infinite canvas so that I can express ideas spatially.
- As a team member, I want to see the others' cursors and changes live so that we can work on the same area together.
- As a team member, I want to find the team's boards on the team page so that workshop output stays next to retros and estimates.
- As a team member, I want to export a board as an image so that I can paste it into a document.
- As a team member, I want my edits made while offline to be sent when the connection returns so that a network blip does not cost me work.

Guest:

- As a guest, I want to join with only a display name so that I can contribute without creating an account.

## 5. Requirements

Priorities: **P0** the feature cannot ship without it; **P1** part of this spec, delivered in a later plan (§15); **P2** not built, but the design must not block it.

| # | Requirement | Priority | Detail |
|---|---|---|---|
| R1 | Team-owned boards: create, rename, duplicate, delete, list | P0 | §7, §8 |
| R2 | Canvas with shapes, arrows, text, frames, freehand, images, sticky notes | P0 | §6 |
| R3 | Realtime sync, cursors, reconnect and offline replay | P0 | §6 |
| R4 | Access: team members, optional guest link, facilitator role | P0 | §8 |
| R5 | Template gallery: 8 built-in templates | P0 | §10 |
| R6 | Workspace templates saved from a board; export PNG, SVG, `.whiteboard.json` | P1 | §10 |
| R7 | Timer, board lock, element lock, follow-me | P1 | §11.1–11.3 |
| R10 | Version history: auto and named snapshots, preview, restore, copy to new board | P1 | §9 |
| R11 | Canvas comments, retro attachment, import, MCP tools | P2 | Element ids are stable and server-owned, files are stored per board, and all mutations go through actions in `app/Actions/Whiteboards/`, so these can be added without a migration of existing data |

Acceptance criteria for every requirement are in §16. R8 and R9 are not in use: the features they named were removed (§3), and the other numbers were kept.

### Dependencies

- **New:** `@excalidraw/excalidraw` (MIT), approved 2026-10-01. Loaded only on the whiteboard page as a lazy chunk. Pinned to `0.18.1` (React 19 listed in its peer dependencies). The spike of plan 17a confirmed the API listed here: `excalidrawAPI.updateScene`, `onChange`, `onPointerUpdate`, `onScrollChange`, `reconcileElements`, `restoreElements`, `viewModeEnabled`, `renderTopRightUI`, `UIOptions`, `langCode`, `theme`, element `customData`, element `locked`, `exportToBlob`, `exportToSvg`. Differences found: `UIOptions` has no key that hides the library button (only `canvasActions.loadScene: false` hides "Open"), so the library trigger (`.default-sidebar-trigger`) is hidden with CSS; the `line` element has no `polygon` key in 0.18.1; `reconcileElements(localElements, remoteElements, localAppState)` takes ordered elements and returns the reconciled array; `updateScene` takes `collaborators` as `Map<SocketId, Collaborator>`.
- **Builds on:** guest identity (`app/Concerns/HasGuestIdentity.php`, `app/Actions/Retros/GuestCookie.php`), player resolution (`app/Http/Middleware/ResolvePokerPlayer.php` as the model), channel auth (`app/Http/Controllers/BroadcastAuthorizationsController.php`), broadcast base (`app/Events/Poker/PokerBroadcastEvent.php` as the model), whisper transport (`resources/js/lib/realtime/whisper-transport.ts`), timer UI (`resources/js/components/retro/timer-control.tsx`, `timer-display.tsx`), team policy (`app/Policies/TeamPolicy.php`), the queue worker.
- Reverb's message limit is 10 000 bytes (`config/reverb.php`, `max_message_size`); the 8 KB broadcast rule of §6.3 is derived from it.

## 6. Canvas and sync

### 6.1 Elements

- The canvas is Excalidraw. Its element set (rectangle, diamond, ellipse, arrow, line, freedraw, text, image, frame) is the board's element set.
- **Sticky note:** a rectangle with a bound text element, marked `customData.skrum = {kind: 'sticky'}`. A skrum button in the canvas shapes toolbar, between the image tool and the eraser, creates one in the chosen colour (six colours, each named for assistive technology; in the dark theme the swatches are shown through the canvas's dark filter so that they match the note, the stored colours being the same in both themes); when that toolbar is not on screen the button sits in skrum's top bar instead, so the tool is always reachable.
- The server is the source of truth. One row per element (§7); the author is the member who first wrote the element and is never read from the client payload.
- Flowcharts use Excalidraw's shapes, bound arrows and its built-in flowchart shortcuts; nothing custom.

### 6.2 Load

`GET /whiteboards/{board}` renders the Inertia page; `GET snapshot` returns the same data as JSON:

```
{board: {id, title, teamId, locked, followEnabled, cursorsEnabled, reactionsEnabled,
         timerEndsAt, facilitatorMemberId, guestAccessEnabled, guestUrl?},
 me: {id, userId, name, avatarUrl, isGuest, isFacilitator, canTakeControl, canDelete, transferCandidates},
 members: [{id, name, avatarUrl, isGuest}],
 elements: [...], seq,
 links: {team: string | null},
 serverTime}
```

`me.transferCandidates` (`[{userId, name}]`, by name) lists who the facilitator may hand over to: the team's members and the workspace's Owners and Admins, the viewer excepted; it is empty for everyone else. `serverTime` has millisecond precision: clients derive their clock offset from it for the countdown (§11.1) and measure it again on every snapshot they fetch.

`elements` come in canvas order: by fractional `index` compared byte by byte (Excalidraw's own order, which a database collation does not give), then by id; elements without an index come last, by `seq`. `GET elements?since=` and the `elements` of `elements.changed` use the same order. Excalidraw repairs any other order by giving elements a new index and version, so the order is part of the contract: loading a board, fetching a delta or receiving a broadcast never changes an element's `index`, `version` or `versionNonce`, and never causes a write.

One class, `BuildWhiteboardSnapshot`, builds it for the viewer (`me`, and `guestUrl`, which only the facilitator receives). `PresentWhiteboardElement` is the only serializer of elements; an element is the same for every viewer.

### 6.3 Write

- The client collects changed elements from `onChange`, batches them every 300 ms and on pointer-up, and sends `PUT elements` with `{elements: [...]}` (at most 200 per request; larger batches are split).
- The server, in a transaction with `lockForUpdate` on the board row, handles each element:
  1. Validate (§6.6) and check rights (§8, §11). An element failing either is rejected with a reason.
  2. Accept when no row exists, or `version` is greater than the stored one, or versions are equal and `versionNonce` is lower (Excalidraw's own tie rule). Otherwise reject as stale.
  3. On accept: increment `whiteboards.seq`, store it on the row, set the author on first write.
- Response: `{seq, fromSeq, rejected: [{id, reason, element}]}` where `fromSeq` is the board's `seq` before this request and `element` is the server's copy (null when the server has none), so the sender converges; this holds for every reason, `invalid` included: an edit the server refuses puts the sender back on the stored copy and only removes the element locally when the server has none. Reasons: `invalid`, `stale`, `locked`, `file`, `full`.
- Deleting is a write with `isDeleted: true` (a tombstone). Tombstones are purged 24 hours later by a scheduled command, which does not touch the board's `updated_at` (the team page sorts on it); a client whose last `seq` is older than the oldest purge refetches the snapshot (`GET elements?since=` answers 409).
- Broadcast `elements.changed` to others: `{seq, fromSeq, elements}` when the JSON is at most 8 KB; otherwise `{seq, fromSeq}` and clients call `GET elements?since={their seq}`.
- A client applies changes with `reconcileElements` then `updateScene`. It tracks the last applied `seq`; a `fromSeq` that does not match it, a resubscription or a reconnect triggers `GET elements?since=` (coalesced). It also remembers the highest `seq` announced by an event or a write response: when a fetch ends below it (the change was committed while the fetch was in flight) it fetches again, even when that fetch brought nothing new, and gives up after three fetches in a row that bring nothing (the next event or poll takes over). A fetch is also made once when the canvas becomes ready, for events that arrived before it.
- Restoring on the client keeps the server's `index`, `version` and `versionNonce` (§6.2). Two exceptions are written back so that every client agrees: an element without an index and two elements with the same index get a new index from the first client that sees them. An element the canvas cannot restore is left out and logged to the console; the rest of the board loads. A remote change the canvas cannot merge is logged and the client replaces its scene with the server's snapshot, retrying with a growing delay (2 s doubling to 30 s) until that succeeds; the "Reconnecting…" banner stays up meanwhile.

### 6.4 Drafts, cursors and reactions

- **Drafts:** not built. Intermediate states of a drag or stroke already travel in the 300 ms write batches (measured in the plan 17a walkthrough on a local stack: 11 writes during drags took 39–114 ms, median 56 ms, and one drag moved an element from version 5 to 49).
- **Cursors:** `onPointerUpdate` → whisper `cursor` with scene coordinates (throttled 40 ms) → Excalidraw's `collaborators` map renders them with the member's name and a colour hashed from the member id. The existing `live-cursors` layer is not used on the canvas because it knows nothing about pan and zoom. The sender id is the presence id stamped by Reverb; receivers drop whispers from ids outside the presence roster. The "Hide my cursor" preference (`skrum.hideMyCursor`) and the board's `cursors_enabled` switch apply.
- **Flying reactions:** same transport, identity and abuse rules as the board-engagement spec §3 and poker §4 ("Live cursors and flying reactions"), on `presence-whiteboard.{boardId}`: whisper `reaction`, sender = the presence id stamped by Reverb, receivers drop senders outside the roster, anything that is not a single emoji, and anything above the per-sender bucket (burst 5, 2/s). A bar with the six quick emoji and the picker sits bottom-centre above the canvas (above the canvas's own bottom toolbar in its mobile layout; the canvas's "Scroll back to content" button is moved above the bar, and the bar hides while the mobile panel of shape actions is open); reactions rise from the bottom edge of the window, at the horizontal position of the sender's avatar in the presence strip when it is shown, otherwise near the centre. The shared component honours `prefers-reduced-motion`. Members and guests may react. Nothing is persisted. The board's `reactions_enabled` switch (facilitator, on by default) hides the bar and drops incoming reactions for everyone. Reuses `resources/js/components/realtime/flying-reactions.tsx` and the emoji picker; no new dependency.

### 6.5 Images

- `POST files` (multipart) stores an image before the element that uses it is written. An image element whose file id is unknown for the board is rejected. Excalidraw adds an image to the scene before it has computed its file id; the client does not send an image element until the id is set.
- Allowed: PNG, JPEG, WebP, GIF, detected from content. SVG upload is refused (script risk). At most 5 MB per file and 100 MB per board (422 beyond).
- Files are served by `GET files/{fileId}` (Excalidraw's file id, so a client derives the URL from an image element without a lookup) to members of the board only, with `Content-Disposition: inline`, the stored MIME type and `X-Content-Type-Options: nosniff`.
- A file is deleted when no live element or version (§9) of its board references it; a daily command cleans up. A template (§10) keeps its own copy of every image under `whiteboard-templates/{templateId}/`, deleted with the template, so it never keeps a board's file alive. The same command removes the folder of a board or template that no longer exists, once every file in it is more than 24 hours old (a copy writes its files before the transaction that creates their owner commits).

### 6.6 Validation and limits

- Element `type` must be in the whitelist of §6.1; unknown keys are stripped; numbers must be finite.
- `version` is an integer from 1 to 2 147 483 647 and `versionNonce` a non-negative integer that fits the column; an element outside either range is rejected as `invalid`, never a server error.
- Shape: the keys Excalidraw reads without checking must have the shape it expects, because one malformed element would stop the canvas from loading for the whole board. `points` is required for line, arrow and freedraw and is a list of at least one `[number, number]` pair; `text` is a required string for text elements; `pressures` is a list of numbers; `groupIds` a list of strings; `boundElements` null or a list of `{id, type}`; `frameId` and `containerId` null or an element id; `index` null or a valid fractional index; `scale` and `lastCommittedPoint` a pair of numbers (the latter may be null); `startBinding` and `endBinding` null or `{elementId, focus, gap, fixedPoint?}`; `roundness`, `crop` and `fixedSegments` null or their Excalidraw shape; style keys (colours, fill and stroke style, stroke width, roughness, opacity, angle, seed, font size and family, line height, alignments, arrowheads, frame name, image status, the boolean flags) are scalars of the expected type. Anything else is rejected as `invalid`.
- `link` is kept only when it is an `http` or `https` URL. Text is at most 10 000 characters. `customData` is reduced to `{skrum: {kind: 'sticky'}}` or removed.
- One element's JSON is at most 64 KB. A board holds at most 5 000 live elements (422 "This board is full.").
- Writes are limited to 20 requests per second per member (429).
- `locked` may only be changed by the facilitator (§11.2).

### 6.7 Connection loss

- **Realtime down, HTTP up:** a banner says "Reconnecting…"; writes continue; the client polls `GET elements?since=` every 5 s until the channel is back.
- **Offline:** changes queue in memory; on reconnect the client fetches the delta first, then replays its queue. Stale elements come back in `rejected` and converge to the server copy.

## 7. Data model

- **whiteboards**: `id` (UUID), `team_id` (cascade), `title` (string 120), `facilitator_member_id` (nullable FK → whiteboard_members, `nullOnDelete`), `guest_access_enabled` (bool, default `false`), `guest_token` (unique string 40), `locked` (bool, default `false`), `follow_enabled` (bool, default `false`), `cursors_enabled` (bool, default `true`), `reactions_enabled` (bool, default `true`), `timer_ends_at` (nullable timestamp), `seq` (unsigned bigint, default 0), `purged_seq` (unsigned bigint, default 0 — the highest `seq` among purged tombstones; `GET elements?since=` answers 409 below it), `last_versioned_seq` (unsigned bigint, default 0), timestamps. Each plan's migration adds the columns its features need (17a: all but `locked`, `follow_enabled`, `timer_ends_at`, `last_versioned_seq`). Index (`team_id`, `updated_at`).
- **whiteboard_members**: `id`, `whiteboard_id` (cascade), `user_id` (nullable, `nullOnDelete`), `guest_name` (nullable string 50), `guest_secret_hash` (nullable string 64), timestamps. Unique (`whiteboard_id`, `user_id`). Uses `HasGuestIdentity`; cookie `GuestCookie::name('whiteboard', $id)`.
- **whiteboard_elements**: `whiteboard_id` (cascade), `element_id` (string 40, the client-generated Excalidraw id), `type` (string 20), `data` (json, the full element), `version` (unsigned int), `version_nonce` (unsigned bigint), `author_member_id` (nullable FK, `nullOnDelete`), `is_sticky` (bool), `is_deleted` (bool, default `false`), `seq` (unsigned bigint), timestamps. `id` (UUID) primary key, because Eloquent has no composite keys; unique (`whiteboard_id`, `element_id`). Index (`whiteboard_id`, `seq`).
- **whiteboard_files**: `id` (UUID), `whiteboard_id` (cascade), `file_id` (string 64, Excalidraw's id), `path`, `mime_type` (string 40), `size` (unsigned int), `uploaded_by_member_id` (nullable FK), timestamps. Unique (`whiteboard_id`, `file_id`).
- **whiteboard_versions**: `id` (UUID), `whiteboard_id` (cascade), `name` (nullable string 80; null = automatic), `scene` (json: `{elements, fileIds}` — the live elements in canvas order, and the ids of the images they show, which is what the image prune of §6.5 reads), `seq` (unsigned bigint), `created_by_member_id` (nullable FK; null = automatic), `created_at`. Index (`whiteboard_id`, `created_at`).
- **whiteboard_templates**: `id` (UUID), `workspace_id` (cascade), `name` (string 80), `description` (nullable string 300), `scene` (json: `{elements, files: [{fileId, path, mimeType, size}]}`, the live elements in canvas order as stored, without authors), `preview` (json: `{width, height, shapes}`, a text-free outline of the scene computed at save for the gallery thumbnail), `created_by_user_id` (nullable FK → users, `nullOnDelete`), timestamps. Unique (`workspace_id`, `lower(name)`). Template images are copied to a template-owned directory and referenced from `scene.files`.

Models get factories.

## 8. Access and roles

- **Create:** any user who can view the team (`TeamPolicy::createWhiteboard` = `view`). The creator becomes a member and the facilitator.
- **Enter** `/whiteboards/{board}` (middleware `ResolveWhiteboardMember`): a user who can view the team joins as themselves (member row created on first visit); otherwise a guest with a valid cookie while `guest_access_enabled`. Anyone else: logged out → login, or the "session ended" page when guest access is on; logged-in non-member → 403.
- **Guests** join at `/whiteboards/join/{guestToken}` with a display name (1–50), `throttle:10,1`. Regenerating the token revokes old links and signs out every guest; their elements stay. Guests edit the canvas. Guests never facilitate, never see version history, never save or see workspace templates, never see team or workspace pages.
- **Facilitator-only:** title and settings, guest access and link, board lock, element lock, timer, follow-me, restore, rename or delete versions, delete the board.
- **Transfer and take over:** the facilitator hands over to any team member; any non-guest member may take control at any time (same rule and reason as poker §3). A change of facilitator switches follow-me off (the new facilitator has not chosen to lead everyone's view); the board lock and the timer stay as they are.
- **Delete the board:** the facilitator or a workspace Owner/Admin.
- **Duplicate:** any non-guest member.

A `WhiteboardGuard` mirrors `PokerGuard`: `facilitator`, `notGuest`, `notLocked`, `canDelete`.

## 9. Version history

- **Automatic versions:** a queued job, dispatched with a 5-minute delay by the first write after the last version, stores the live scene when `seq` is greater than `last_versioned_seq`. Kept: the last 50 automatic versions. At most one automatic version is stored every 5 minutes: a job that finds a younger one does nothing (the write that followed that version queued its own job). "Write" means any change of `seq`: an element write or a restore. A board made from a template, a duplicate or a version starts with `last_versioned_seq = seq`, so its first edit is the first write. A daily command queues the version of a board that has changes no version holds and has been idle for an hour (its job was lost).
- **Named versions:** any non-guest member saves one (`name` 1–80). At most 100 per board (422 "This board already has 100 saved versions."). The facilitator renames and deletes versions, automatic ones included; naming an automatic version makes it a named one (it leaves the rotation of 50 and counts in the 100, so the cap applies).
- **List and preview:** any non-guest member opens the history panel and previews a version in a read-only canvas.
- **Restore** (facilitator): first stores the current scene as a named version "Before restore · {date}" (never refused by the cap of 100; `{date}` is a date in the facilitator's language without a clock time, since the server does not know the viewer's time zone and the panel shows each version's own time in the viewer's), then writes every element of the chosen version with a version number above the current one and tombstones every live element absent from it, all in one transaction. Clients receive it as an `elements.changed` without the elements (`{seq, fromSeq}`, §6.3) and fetch the delta.
  - An element whose row carries the same `version` and `versionNonce` as in the version is left alone: nothing changed since.
  - An element whose row no longer exists (its tombstone was purged), or is a tombstone already at the highest version number, comes back under a fresh id with the references to it rewritten: a browser left open may still hold the old tombstone at a higher version and would otherwise delete the element again.
  - A live element at the highest version number can be neither rewritten nor tombstoned and is left as it is; the rest of the board is restored.
  - An image whose file the board no longer stores is left out, as in the copy path of §10.
- **Copy to a new board:** any non-guest member, from any version; the new board belongs to the same team and the requester facilitates it. It goes through the copy path of §10 and is titled like a duplicate.

## 10. Templates and export

- **Built-in templates** are JSON scenes in `resources/whiteboard-templates/{key}.json` with translated name and description: Blank, Brainstorm, Flowchart, User story map, Impact map, SWOT, Lean canvas, 2×2 matrix. Structure elements (frames, headings, backgrounds) are `locked`; sample sticky notes are not. Texts inside built-in scenes are translation keys (`lang/{locale}/whiteboards.php`) resolved at creation in the creator's locale; a scene file lists only what differs from the element defaults, and the size of each text is estimated on the server, a test checking that every label fits its shape in the four locales.
- **Creation:** the dialog shows a gallery (built-in, then workspace templates) with a thumbnail rendered client-side from an outline of the scene (shapes and colours, no text; scenes themselves stay on the server; drawn on a fixed light surface in both themes, since the stored colours are those of the light canvas), name and description. `template` and `workspaceTemplateId` are mutually exclusive; neither means Blank. Creating copies the scene with fresh element ids, fresh stacking indices in the same order and version 1 (bindings, frame membership, bound text and groups remapped; a reference to an element outside the scene is dropped; an image whose stored file is missing or cannot be copied is left out, on creation, on duplication and when saving a template), author = creator.
- **Save as template:** any non-guest member. Name 1–80, unique per workspace case-insensitively; description up to 300. Copies live elements and their images; drops authors. At most 50 per workspace (422).
- **Manage:** the template's creator or a workspace Owner/Admin renames, edits the description or deletes. Changing or deleting a template never changes a board created from it.
- **Duplicate board** uses the same copy path, keeping the title with " (copy)" (translated, cut to 120 characters). The copy is in the same team with default settings, the requester facilitates it, and the source is neither changed nor notified.
- **Export:** PNG and SVG through the canvas's "Save as image" dialog, and the scene as `<board title>.whiteboard.json` (MIME `application/json`) through the menu's "Export" dialog, which holds one skrum button instead of the library's "save to disk" card (switched off, with its Ctrl+Shift+S shortcut, because the library fixes that file's type name and extension). The file is the library's scene JSON built in the browser by `serializeAsJSON`, with its `source` replaced by skrum's origin. All of it is made from what the viewer's browser holds.

## 11. Facilitation

Every rule here is enforced on the server; the client only reflects it.

### 11.1 Timer

`PUT timer` with `{seconds: 10–3600 | null}` stores `timer_ends_at = now + seconds` (null clears) and broadcasts `timer.changed`. Clients render the countdown locally, show "Time's up" and play the soft sound at zero. The timer triggers nothing else. A board outlives its sessions, so a countdown nobody stopped is not shown for ever: the snapshot gives `timerEndsAt: null` once the timer ended more than five minutes ago (the column keeps its value; a browser that stays on the page keeps "Time's up" until its next snapshot).

### 11.2 Lock

- **Board lock:** `locked = true` puts every other member in view mode (pan, zoom; no edits). Their element writes and uploads answer 403 "This board is locked." The exemption belongs to whoever facilitates at the moment of the write, checked under the board lock. Reading, duplicating and saving as a template stay allowed. The 403 carries `errors.locked`, which lets a client tell it from a lost access: it drops its unsent edits, reloads the scene from the server, says "This board is locked." and stays on the board.
- **Element lock:** Excalidraw's `locked` flag. Only the facilitator may change the flag, and only the facilitator may change or delete an element whose stored copy is locked. Others' attempts are rejected with reason `locked`. The lock entries of the canvas context menu are hidden for non-facilitators; the keyboard shortcut cannot be removed, and what it does is rejected by the server.

### 11.3 Follow-me

- The facilitator switches "Bring everyone to me" (`follow_enabled`, broadcast `board.changed`).
- While on, the facilitator's client whispers `viewport` (`{x, y, width, height}` in scene coordinates; throttled 100 ms, repeated every 2 s for late joiners). Followers fit that rectangle into their own window. A receiver accepts `viewport` only from the presence id equal to `facilitatorMemberId`, and drops one whose numbers are not finite or whose rectangle is empty.
- A follower who pans or zooms stops following and sees "Following paused · Resume". Switching off frees everyone.

## 12. Endpoints, channel and events

Team-scoped (`auth`, `verified`, `w/{workspace}` group, `scopeBindings`):

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/w/{workspace}/teams/{team}/whiteboards` | `{title, template?: string, workspaceTemplateId?: uuid}` | redirect to the board |
| PATCH | `/w/{workspace}/whiteboard-templates/{whiteboardTemplate}` | `{name?, description?}` | back |
| DELETE | `/w/{workspace}/whiteboard-templates/{whiteboardTemplate}` | — | back |

The team page props gain `whiteboards: [{id, title, updatedAt, facilitatorName, canDelete}]` and `whiteboardTemplates: [{id, name, description, canManage}]`, and, loaded when the creation dialog opens, `whiteboardGallery: [{key, workspaceTemplateId, name, description, preview}]` (built-in templates, then the workspace's by name).

Board-scoped, prefix `whiteboards/{board}` (`whereUuid`, middleware `ResolveWhiteboardMember`, `scopeBindings`):

| Method | Path | Body | Who | Response / event |
|---|---|---|---|---|
| GET | `/` | — | member | Inertia `whiteboards/show` with snapshot |
| GET | `snapshot` | — | member | snapshot JSON |
| GET | `elements` | `?since=` | member | `{seq, elements}`; 409 when `since` predates a purge |
| PUT | `elements` | `{elements}` | member | `{seq, fromSeq, rejected}`, `elements.changed` |
| POST | `files` | multipart `file`, `file_id` | member | `{id, url, mimeType}` |
| GET | `files/{fileId}` | — | member | the image |
| PATCH | `settings` | `{title?, guestAccessEnabled?, locked?, followEnabled?, cursorsEnabled?, reactionsEnabled?}` | facilitator | 204, `board.changed` |
| PUT | `timer` | `{seconds}` | facilitator | `{timerEndsAt}`, `timer.changed` |
| POST | `guest-token` | — | facilitator | `{guestUrl}`, `board.changed` |
| PUT | `facilitator` | `{userId}` | facilitator; or a team member with `userId` = self | 204, `board.changed` |
| DELETE | `/` | — | facilitator, workspace Owner/Admin | 204, `board.deleted` |
| POST | `duplicate` | — | non-guest member | 201 `{url}` |
| POST | `template` | `{name, description?}` | non-guest member | 201 `{id, name}` |
| GET | `versions` | — | non-guest member | `[{id, name, createdAt, createdByName, automatic}]` |
| POST | `versions` | `{name}` | non-guest member | 201 `{id, name, createdAt, createdByName, automatic}` |
| GET | `versions/{version}` | — | non-guest member | `{elements, files: [{id, url, mimeType}]}` (the images the board still stores) |
| PATCH / DELETE | `versions/{version}` | `{name}` / — | facilitator | 204 |
| POST | `versions/{version}/restore` | — | facilitator | 204, `elements.changed`, `board.changed` |
| POST | `versions/{version}/copy` | — | non-guest member | 201 `{url}` |

Join: `GET` and `POST /whiteboards/join/{guestToken}` (`{name}`), same behaviour as the poker join; an invalid or disabled link shows "This link is no longer valid".

Request bodies use snake_case keys, as everywhere in the code (`guest_access_enabled`, `user_id`, `file_id`); the tables above show them in camelCase for readability. Excalidraw elements inside `elements` keep their native camelCase keys. Controllers live in `app/Http/Controllers/Whiteboards/`, actions in `app/Actions/Whiteboards/`, events in `app/Events/Whiteboards/` extending a `WhiteboardBroadcastEvent` (same contract as `PokerBroadcastEvent`: broadcast now, after commit, to others, report-don't-throw). Routes are named in camelCase and consumed through Wayfinder.

Channel `presence-whiteboard.{boardId}`; `BroadcastAuthorizationsController` gains a branch that resolves the member as the page does and returns `{id, name, avatarUrl, isGuest}`.

| Event | Payload | Client reaction |
|---|---|---|
| `elements.changed` | `{seq, fromSeq, elements?}` | apply, or fetch the delta |
| `timer.changed` | `{timerEndsAt}` | start, restart or clear the countdown |
| `board.changed` | `{}` | refetch the snapshot |
| `board.deleted` | `{}` | show "This board was deleted" with a link to the team |

Whispers (client events, presence members only, never persisted): `cursor`, `reaction`, `viewport`.

## 13. UI and error handling

- **Team page:** a "Whiteboards" section beside retros and poker games: list, "New whiteboard" dialog with the template gallery, manage workspace templates.
- **Board page** `resources/js/pages/whiteboards/show.tsx`, components in `resources/js/components/whiteboard/`: full-bleed canvas (lazy chunk with a skeleton while loading); top bar (title, presence strip, share, history, settings); sticky tool and colour palette; facilitator bar (timer, lock, follow) in the top bar, for the facilitator only; a status row between the top bar and the canvas that says what everyone needs to know (board locked, following or "Following paused · Resume"); history panel, a sheet opened by a button of the top bar that guests do not have, whose preview is a read-only canvas in a dialog without the canvas's menu and help buttons. None of these covers the canvas's own controls, the shapes toolbar or the reactions bar. Excalidraw's menu loses "Live collaboration", the library and "Open". No library branding and no outbound link to the library's sites is shown anywhere in the board UI: the main menu is rendered by skrum with neutral entries only (export, save as image, find on canvas, help, clear canvas, canvas background), the welcome screen is not rendered, AI entries are off, and the help dialog's link header, the "Mermaid to Excalidraw" entry, the library tab of the search panel and the "Browse libraries" link are hidden. What a prop or a style cannot remove stays: the `type` field inside the scene file and the links in the error shown by Brave when it blocks text measuring. Theme and locale follow skrum's; skrum strings are added to `lang/*.json` for the four shipped locales.
- **Join page** `resources/js/pages/whiteboards/join.tsx`.
- **Errors:** 401, 403 and session-ended follow the parent spec. A rejected element converges silently except for limit reasons and for `locked`, which show a toast with the reason. A refused upload (413, 415, 422) shows a toast and removes the placeholder element; a 401, 403, 404 or 419 on an upload is handled like the same status on an element write, and any other failure is retried with the batch. A board-menu action that fails says so in a toast and leaves the page and the dialog as they were. A failed canvas chunk shows an error state with "Retry" and logs the cause to the console. Connection loss follows §6.7.

## 14. Testing

Pest feature tests, with factories, cover:

- Access matrix: member, guest, outsider, facilitator, workspace Owner/Admin, on every endpoint group; guest token regeneration.
- Element writes: create, update, stale version, nonce tie, tombstone, purge and the 409, batch limit, board limit, size limit, validation and stripping, link scheme, author never taken from the client, rate limit.
- Delta fetch; broadcast payload shape, the 8 KB switch to the form without elements.
- Files: types, sizes, quota, unknown file id, access by a non-member.
- Lock: board and element, both directions.
- Versions: automatic cadence and retention, named cap, restore (including the "Before restore" version), copy, guest refusal.
- Templates: every built-in scene loads and passes §6.6 validation; id remapping keeps bindings; workspace template rules.

The two-browser flows of §16 run as browser tests when the plan 16 harness is merged; until then they are written as a walkthrough in `docs/superpowers/walkthroughs/`. The repo has no JavaScript unit runner, so client logic stays thin and is exercised by the browser tests.

## 15. Phasing

One spec, four plans, each shippable:

- **17a — Core (P0):** dependency spike, tables, access and guest join, canvas, sync, files, cursors, team page list, Blank template.
- **17b — Templates:** the seven other built-in templates, gallery, workspace templates, duplicate, export.
- **17c — Facilitation:** timer, lock, follow-me.
- **17d — History:** version history.

Plans 17c and 17d also built dot voting and private writing; both were removed on 2026-10-01 (§3), after 17d and before the branch was merged.

No hard deadline. 17a starts after the plan 16 arch refactors if those are in progress, to avoid conflicts in shared files (`BroadcastAuthorizationsController`, `GuestCookie`).

## 16. Acceptance criteria

Core (R1–R4)

- [ ] Given a team member on the team page, when they create a whiteboard, then they land on it as facilitator and it appears in the team's list.
- [ ] Given a member and a guest on the same board in two browsers, when one adds a sticky note, a shape, a connector, a drawing or an image, then the other sees it within 1 second without reloading.
- [ ] Given two people moving the same element, when both release, then both browsers show the same final position.
- [ ] Given a board with content, when a member reloads, then the scene is identical.
- [ ] Given a client that was offline while editing, when it reconnects, then its edits reach the others and it receives theirs.
- [ ] Given guest access is off, when someone opens the guest link, then they see "This link is no longer valid"; a logged-in non-member opening the board gets 403.
- [ ] Given the guest link is regenerated, when a previous guest acts, then they see the session-ended page.
- [ ] A write with a client-supplied author, an unknown type, a `javascript:` link or an SVG upload never stores that value.
- [ ] A board at 5 000 elements refuses a new one with a visible reason.

Templates and export (R5–R6)

- [ ] Each of the eight built-in templates creates a board whose structure is locked and whose texts are in the creator's language.
- [ ] Given a board saved as a workspace template, when another member creates a board from it, then the new board has the same elements and images, no author data, and later edits of either do not affect the other.
- [ ] A guest cannot list, use or save workspace templates.
- [ ] A member exports PNG, SVG and `.whiteboard.json` from the board.

Facilitation (R7)

- [ ] Given the facilitator starts a 60-second timer, then every browser shows the same countdown and "Time's up" at zero.
- [ ] Given the board is locked, when a non-facilitator writes an element, then the server answers 403 and the element is unchanged; the facilitator can still edit.
- [ ] Given a locked element, when a non-facilitator moves or unlocks it, then the write is rejected and their canvas returns to the server copy.
- [ ] Given follow-me is on, when the facilitator pans, then followers' views follow; a follower who pans sees "Following paused" and "Resume" re-attaches them.

Version history (R10)

- [ ] Given edits over more than 5 minutes, then automatic versions exist, at most one per 5 minutes, and never more than 50.
- [ ] Given a version, when the facilitator restores it, then every connected browser shows that scene and a "Before restore" version exists that restores the prior state.
- [ ] A guest gets 403 on every version endpoint.

Quality

- [ ] The suite, phpstan, type-check and lint are green; Pint has been run.
- [ ] `@excalidraw/excalidraw` is the only new dependency and is absent from every page bundle except the whiteboard page.

## 17. Success metrics

skrum is self-hosted and has no product analytics; the numbers below come from database counts an installation's admin can read. Evaluate 30 days after 17d ships.

Leading:

- **Adoption:** share of active teams (a retro in the last 30 days) with at least one whiteboard. Success 30 %, stretch 50 %.
- **Template use:** share of boards created from a non-blank template. Success 50 %.
- **Facilitation use:** share of boards on which a countdown was started (`timer_ends_at` set) or a version was saved by name. Success 25 %.
- **Sync health:** share of element writes rejected as stale. Below 2 %.

Lagging:

- **Return use:** share of teams with a whiteboard that create a second one within 30 days. Success 40 %.
- **Guest reach:** share of boards with at least one guest member. Tracked, no target.

## 18. Open questions

None blocking.
- **Product, after 17d:** order of the follow-up specs (canvas comments, retro attachment, MCP tools, import).

## Decisions made while planning 17c (facilitation)

1. A refused write on a locked board is a 403 with `errors.locked`, which the client treats as "discard and reload", not as a lost access (§11.2).
2. A change of facilitator switches follow-me off (§8).
3. The snapshot gains `me.transferCandidates`; `serverTime` has millisecond precision (§6.2).
4. The snapshot stops reporting a timer five minutes after its end (§11.1). Added when the plan was reconciled with the code; not asked for by the user, to be confirmed or removed at review.

## Decisions (2026-10-01)

1. Purpose: standalone team boards used for template-first, facilitated workshops.
2. v1 includes the canvas core and facilitation (timer, follow-me, lock).
3. Engine: Excalidraw (MIT). tldraw rejected for its licence; React Flow and a custom engine not chosen.
4. Access mirrors retros and poker: team members, optional guest link, one facilitator.
5. Templates: eight built-in plus workspace templates saved from a board.
6. Sync: server-authoritative elements, last write wins per element; peer relay and Yjs rejected because locks and the server's validation could not be enforced.
7. Version history: automatic and named snapshots with restore; own undo stays local; no global undo.
8. Removal, decided by the product owner on 2026-10-01: dot voting and private writing leave the product entirely (code, tables and columns, UI, strings, tests). They had been built in plans 17c and 17d on a branch that was neither merged nor released, so its migrations were edited instead of adding migrations that drop. Version history, timer, lock, follow-me and everything else stay as specified. An element is now the same payload for every viewer.
