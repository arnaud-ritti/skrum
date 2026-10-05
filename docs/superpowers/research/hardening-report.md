# Hardening report (branch `hardening`, 2026-10-05)

Base `655340d3`. Workflow `wf_a5fdf904-d7e`: 1 majors lane, 22 minors lanes, 7 ponytail lanes, 13 owner-decision lanes, then the final verification on `rmInt`. Not pushed.

## 1. The 9 majors

| # | Where | Defect | Fix |
|---|---|---|---|
| 1 | `Settings/ProfileController` | Login e-mail changed without password confirmation | Confirmation asked only when the normalised address changes (redirect to `password.confirm`, 423 for JSON); S-1 exemption kept, superseded later by the SSO e-mail code (dec-security) |
| 2 | `whiteboard/sticky-tool.tsx` (+ draw-board redo) | `crypto.randomUUID` crashes outside a secure context (self-host over http) | `lib/random-id.ts` (`randomHexId`, `crypto.getRandomValues`) |
| 3 | `ExportToJira` | `duedate` sent even when the create screen lacks it, Jira 400 | Dropped when absent from createmeta; cache key `jira-createmeta:v2` |
| 4 | `Mcp/Prompts/TeamHealth` | Trends read only from the newest board | `BuildHealthTrend::forTeam`; ROTI trend from the newest board that has one; `GetHealth::presentTrend` shared |
| 5 | `surveys/survey-builder.tsx` | Failed settings switch stays "Not saved" forever | Refetch resolves a boolean; failure cleared once the server settings are back |
| 6 | `skrum/gif-picker.tsx` | Reduced motion / paused GIF without still shows placeholders | First frame drawn on a canvas (`role=img`) |
| 7 | `skrum/deck-editor.tsx` | Refusals not announced, ARIA on the list | `aria-invalid`/`aria-describedby` on the add input; every refusal goes to the status region |
| 8 | `WordGuessRulesTest` | Guest cookie never sent, test vacuous | Cookie sent with credentials |
| 9 | `ObserverSessionsTest` | Same | Same |

## 2. Minors

Totals: 1552 fixed, 146 rejected, 94 deferred (22 lanes). Rejections are mostly stale or false findings, behaviour pinned by a spec or test, or a no-raw-SQL / mockup conflict; every reason is in the journal.

| Lane | Fixed | Rejected | Deferred |
|---|---|---|---|
| backend-http | 48 | 9 | 9 |
| backend-core-1 | 82 | 11 | 17 |
| backend-core-2 | 25 | 3 | 1 |
| backend-actions | 42 | 14 | 7 |
| front-poker-games | 75 | 8 | 4 |
| front-rest-1 | 99 | 7 | 7 |
| front-rest-2 | 107 | 2 | 3 |
| front-rest-3 | 106 | 3 | 1 |
| front-rest-4 | 93 | 11 | 7 |
| front-rest-5 | 17 | 3 | 0 |
| front-retro-session | 88 | 9 | 3 |
| front-skrum-ui-1 | 95 | 6 | 10 |
| front-skrum-ui-2 | 115 | 2 | 1 |
| front-skrum-ui-3 | 62 | 2 | 1 |
| front-whiteboard-surveys | 42 | 3 | 1 |
| i18n | 106 | 7 | 4 |
| tests-browser-1 | 72 | 28 | 10 |
| tests-browser-2 | 19 | 4 | 0 |
| tests-feature-1 | 101 | 7 | 2 |
| tests-feature-2 | 106 | 2 | 2 |
| tests-feature-3 | 52 | 5 | 4 |

### Deferred (all, with reason)

**Product / owner rulings**
- backend-http #13: no cap on guest players per game room (no join has a cap; cap and offline guests are product calls).
- backend-core-1 #54: draw needs at least 2 answers (spec).
- backend-core-1 #66, #67: require Jira DC signature / Jira Cloud JWT on inbound hooks (could refuse real deliveries).
- backend-core-1 #73: check GitHub membership per mapping (extra calls, product call).
- backend-core-1 #84: Teams 400 treated as reconnect (spec says so).
- backend-core-1 #109: production mail default `log`.
- backend-actions #7: notification retention 30/90 days applies to every type (policy).
- backend-actions #17: survey progress counts "sent", summary counts "answered" (pick one definition).
- backend-actions #24: tracker dedupe ignores the site (needs migration + cross-site identity choice).
- backend-actions #30: exact bell badge count cost.
- backend-actions #42, #43: merges past the vote cap, votes not restored on ungroup (voting semantics after Grouping).
- front-rest-1 #3: priority facet "none ticked = all" (pinned by Roadmap24 walkthroughs).
- front-rest-1 #33, retro-session #36: delete a comment without confirm/undo.
- front-rest-1 #98: clearing a field with an env value (wording or server flag).
- front-rest-2 #2: locked "Keep sign-in by e-mail as fallback" switch (mockup).
- front-rest-2 #17: "Switch account" loses the invite (post-logout return, open-redirect risk).
- front-rest-2 #85: reduce-motion switch shows Off while the system asks for less motion (test pins it).
- front-rest-3 #46: mood chart says "retro" over survey points (copy, 4 languages).
- front-rest-3 #1 / #74 parts: server guard against a team with no owner; warning before the last owner leaves.
- front-rest-4 #22/#23, poker-games #39 (+ observer half of #16/#32): observers as voters/leaders need a per-player observer flag.
- front-rest-4 #86: render invitation expiry (no mockup) or drop `expiresAt`.
- poker-games #13, retro-session #34: French zero plural ("0 cartes"), app-wide plural rule (~140 sites).
- poker-games #38: Two truths points shown twice (pick one).
- skrum-ui-1 #16: admin mode of avatar-style-picker vs admin avatar-style-grid.
- skrum-ui-1 #18: "Rename group" label hides the group name (pinned by Plan08d/e).
- skrum-ui-1 #20, #21, #88, #91: arrow keys move focus without selecting in colour picker / icebreaker grid.
- skrum-ui-1 #42, #46: Edit/Delete inside the deck radiogroup (mockup layout).
- skrum-ui-1 #44: deck-picker `onDelete` unwired (wire or drop).
- skrum-ui-1 #96: unused `shareMine` (LiveCursor spec).
- skrum-ui-2 #87: logo fold `brightness-75` ignored by Chromium on SVG paths (darker token + ~1,750 baselines).
- skrum-ui-3: TeamChart only used by the dev gallery (keep or wire).
- whiteboard-surveys: lock toggle label "Lock/Unlock the board" vs aria-pressed (plan docs + ~10 assertions; retro lock too).
- i18n #8, #10: German gender convention (~40 strings).
- i18n #37: "skrum" vs "Skrüm" / branding placeholder.
- i18n #54: straight vs curly apostrophes.
- tests-browser-1 #2: make visual diffs fail CI.
- tests-browser-1 #86: no UI to clear an estimate.
- tests-feature-2 #98: observers may search GIFs (pinned).
- tests-feature-3 #42: a facilitator can make the owner's team template personal (author/admin only, or copy).
- tests-feature-3 #54: non-UTC `APP_TIMEZONE` and DateOnly.

**Redesign / larger refactor**
- backend-http #12, #47, #48, #51, #53, #55: inline validation to form requests (118 controllers inline vs 42 requests).
- backend-http #41: estimates search pagination with wildcard characters.
- backend-http #63: 33 kebab-case route names (~212 references + Wayfinder).
- backend-core-1 #16, #19, tests-browser-1 #88: `sync_error` / `last_error` stored translated (store keys).
- backend-core-1 #37: one-of-many on UUID keys fails on PostgreSQL (custom eager load).
- backend-core-1 #58: GIF ids need their provider stored.
- backend-core-1 #72, #74: provider search cache/batching.
- backend-core-1 #87: GitHub has no conditional PATCH.
- backend-core-1 #89: Linear cursor pagination.
- backend-core-1 #96: drop `liveBreachCheck` (front contract).
- backend-core-1 #99: translating pulse questions.
- backend-core-1 #100: verifier mirroring ImportHealthChecks (moot: import removed by dec-migrations).
- backend-actions #50: lazy `surveys` prop needs a skeleton or a limit.
- front-rest-1 #29: CSV export through fetch/blob.
- front-rest-1 #59/#60: audit-log actor list needs a server prop.
- front-rest-1 #85: confirmation freshness on the client clock (`confirmedUntil` contract).
- front-rest-4 #19: two tabs of the same user voting (per-player vote versions).
- front-rest-4 #25: English fallback error message (~30 callers).
- front-rest-4 #71: avatar Loading state on the bench.
- poker-games #9: roving tabindex for toolbars (app-wide pattern).
- retro-session #37: whole card is the drag activator (dedicated handle).
- tests-browser-1 #45, #78: consolidate per-plan walkthrough helpers.
- tests-browser-1 #91, #94, #97: fixed settle windows need a pending-save signal.
- tests-feature-1 #52: behavioural RetriedTransactions test (provoke deadlocks).
- tests-feature-3 #58: Upgrade suite double migrate (moot: suite removed by dec-migrations).

**Test deletions that need the owner's approval**
- front-rest-4 #12, tests-browser-1 #35, #61, tests-feature-1 #63, tests-feature-2 #47, tests-feature-3 #56 (`tests/Unit/ExampleTest.php`).

**Dependencies**
- backend-core-2: stale `@rollup/*` optional deps; done later by ponytail pt-config-deps.

**Majors lane, deferred**
- Tell the old address when the e-mail changes (new mail + copy).
- Warn when Jira drops the due date (new ExportWarningCode).
- Enter twice on the same refused deck value is not announced twice.

## 3. Ponytail cuts

183 applied, 40 rejected, 6 deferred. Line counts per merge (screenshots excluded):

| Lane | Files | + | − |
|---|---|---|---|
| pt-config-deps | 9 | 11 | 1,076 |
| pt-front-components-1 | 53 | 359 | 571 |
| pt-front-hooks-lib | 50 | 705 | 1,345 |
| pt-front-components-2 | 34 | 239 | 577 |
| pt-front-skrum-ui-pages | 58 | 361 | 624 |
| pt-backend | 166 | 1,090 | 2,306 |
| pt-tests | 162 | 2,180 | 3,542 |
| **Ponytail phase** | 524 | 4,961 | 10,043 |

Whole branch `655340d3..HEAD`: 2,107 files, +41,466 / −29,988 (excluding visual baselines). The migrations-from-zero lane alone: 214 files, +1,425 / −9,031 (126 migrations become 87).

Dependencies removed: `laravel/chisel`, `pestphp/pest-plugin-drift`, `@rollup/rollup-linux-x64-gnu`, `@rollup/rollup-win32-x64-msvc`; scripts `build:ssr`, `build:front`, the starter-kit composer hooks and the empty `extra.laravel`; `bin/front-parity.mjs`, `bin/front-old-components.mjs`, `bin/check-pg-upgrade`; `config/inertia.php` reduced to `ssr.enabled`. No dependency added.

Ponytail deferred: shared `useNow`/`useClock` (cross-scope), GuestShare move (cross-scope), admin forms `frame` vs `barSlot` and settings-card `IconEmpty` (other scope), `PokerFacilitatorsController::ensureTakesControl` redundant guest check (an authorisation guard, owner's call), `canCreate/canShareWorkspace` and `LocaleNames` (need TS changes).

## 4. Owner decisions applied

| Decision | Lane | What was done |
|---|---|---|
| AGPL-3.0-or-later | dec-platform | composer.json, `config skrum.licence`, admin card (4 languages), README, LICENSE header with SPDX line |
| SSO accounts: e-mail code for sensitive actions | dec-security | `EmailCodePurpose::Confirm` on every password-confirmed route, account deletion and first password; S-1 kept only when no code can reach the account; SSO admins can confirm admin area with a code |
| Busy database: one retry after Retry-After | dec-platform | Wrapper on the Inertia HTTP client (visits, `useHttp`, Echo auth); only 503 + `X-Database-Busy`; second refusal shows the toast |
| Migrations from zero, remove upgrade machinery | dec-migrations | 87 migrations `0001_01_01_0000NN_create_*`; health import, `surveys:verify-health-import`, legacy ROTI vote, duplicate-email report, `tests/Upgrade`, check-pg-upgrade removed; HealthScale 1–5 only; docs/database.md and CI updated |
| Mockups in tu | dec-mockups-tu | 65 changes in docs/design-system incl. -ez imperatives; voice rule now tutoiement; one plural "vous" kept (team prompt) with an allow-list test |
| Rector skips case by case | dec-rector | 8 skips removed or narrowed, 11 kept with a reason in rector.php |
| Plan 19 §17: 9 = A, 10 = A, 11 = B, 7 + 12 moot | dec-platform, dec-migrations | Facilitator sees who has sent the health check (non-anonymous retros); spec §6.3 / §17 updated; old scale removed |
| Storage volume note | dec-platform | Already right, nothing to change |
| Dev gallery kept | ponytail lanes | Gallery components rejected as cuts |

### Mockup deviations (102 answered)

"Keep" answers needed no work: D-4, D-5, D-20, D-22–26, D-30, D-33, D-40 (chip kept, mark added), D-42–47, D-51, D-55, D-56, D-58–62, D-64–67, D-72, D-77, D-78, D-83, D-88–95, D-97, D-101.

| Ids | Lane | Where it landed |
|---|---|---|
| D-1–3, D-6–17, D-19, D-50 (list) | dev-retro | Phase rail and phone phase line, space under bars, German caption, "+ Vote", phone stepper + sticky footer, compact action rows, focus banner instead of dialog, closed add-column tile, no lock icons, anonymity state, labelled stepper, session-end trend, 280 chars, padded clock, reaction chips. D-8 partial: action sheet due date still native |
| D-18, D-21, D-27–29, D-32, D-96, D-99 | dev-onboarding-access | Share wording, Invitations step, expired vs used invitation, two initials, phone login header, team tile in mail, one-line request message, avatar style lock and guest note |
| D-31, D-98 | dec-security | Attempts left on the 2FA challenge; password ≠ e-mail/name, QR with logo, mockup copy |
| D-34–39, D-67 | dev-poker | Table centre + "écart", own value, criteria column, phone room, ticket key search as you type (`external_key_search` column), compact rounds |
| D-40, D-41 | dec-brand-logos | Simple Icons + gilbarbara/logos (CC0) marks inline in `provider-mark.tsx`; GitHub in currentColor |
| D-48, D-49, D-50, D-52–54, D-57 | dev-actions-team-sessions | Table footer, selection kept on phone, compact rows on team page, two-line tiles, creation tiles + New per section, role badges only, sessions page search |
| D-68–71, D-73 | dev-games | Capitals + own draw note, Decoded layout, ready count, "n votes", leaderboard counts games |
| D-74–76, D-79–82, D-84, D-85 | dev-whiteboard-surveys | Zoom over minimap, dot grid, round stickies, styles sizing, phone header + fit, selection bar, free-text badge, statements wording, quartiles + threshold 3 |
| D-86, D-87, D-100, D-102 | dev-admin-global | Provider purpose line, branding keys, buttons weight 600, auto-height textarea |
| D-63 + French elisions everywhere | none | **Not done** (see §6) |

## 5. Test counts (final verification, `rmInt` after `6bc2ea71`)

| Suite | Result |
|---|---|
| Vitest (`npm run test`) | 606 files, 6,410 passed |
| PHP pgsql, parallel 4 | 8,168 passed, 3 skipped (first run 1 failed, fixed: RetriedTransactionsTest) |
| PHP sqlite, parallel 4 | 8,158 passed, 13 skipped (first run 1 failed, fixed: ErrorPagesTest) |
| PHP mariadb, parallel 4 | 8,170 passed, 1 skipped |
| PHP mysql, parallel 4 | 8,170 passed, 1 skipped |
| Migrations `tests/Feature/Database` | sqlite 198 passed + 6 skipped; mariadb 204; mysql 204 |
| Concurrency pgsql / mariadb / mysql / sqlite-file | 64 passed + 1 skipped on each |
| Browser, 4 shards | 1,284 passed, 1 failed (P06-07a, real, fixed; file rerun alone: 12/12) |

Skips differ per engine (engine-only tests). The full browser run rewrote 226 tracked visual baselines and wrote 975 untracked captures; all were restored, none committed.

## 6. For the owner

**Not done from the decisions**
- D-63 and "élisions partout" (owner 2026-10-05): no shared elision mechanism exists on the branch. dev-games left D-63 to dec-platform, which ran before the ruling. Needs its own lane.
- D-8 partial: the action sheet due date is still a native date input.
- Visual baselines: several lanes kept unrelated drift out of their commits; the final baseline retake (`d75c5dec`) was done on the merged branch, but yellow-brand palette (BrandPalette fix) and GIF first-frame captures should be eyeballed.

**Rulings to give** (beyond the deferred list in §2)
- Reverb `allowed_origins` now defaults to the APP_URL host; instances opened on another host need `REVERB_ALLOWED_ORIGINS` (release note).
- Secure session cookie now defaults to true when APP_URL is https.
- Branding colours vs design-system iconography line ("monochrome muted-foreground") contradicted by D-41; update the doc.
- Lane rulings worth a glance: German "Deck" kept over "Kartensatz"; fr "affirmation" chosen for health statements, then D-84 moved them to "énoncés"; a full game room answers 409; sidebar admin link lands on the admin home; SSO-only accounts now get an e-mail code when opening Security / API tokens.
- TeamChart (design-system Chart) is used only by the dev gallery: keep or wire into a page.
- CLAUDE.md line pointing to docs/database.md: still to add by the controller.

**Rule breaches reported by lanes**
- `git stash` used once (each popped at once, nothing lost): majors, backend-http, backend-core-1, backend-actions, front-poker-games, front-rest-2, front-rest-4, front-skrum-ui-2, front-whiteboard-surveys, tests-feature-3, dec-rector; tests-feature-1 tried and was denied.
- `git reset --soft` on own unpushed commits: front-rest-2, pt-front-components-1.
- `php artisan event:list` run once (read-only, outside the allowed list): pt-backend.
- Majors lane branch named `hardening-majors` (`hardening/majors` impossible next to `hardening`).
- The final step of the workflow stopped BLOCKED on an unfinished merge; the three last lanes (dev-retro, dev-admin-global, dev-whiteboard-surveys) were merged afterwards with lang keys united and baselines retaken.

**Fixed during this verification**
- `RetriedTransactionsTest` expected one retried transaction in `PokerDecksController`; the deck update retry (`1ee8d33c`) is database-only and legitimate, so the count is now 2.
- `ErrorPagesTest` (SQLite only): the tests-feature-1 lane replaced `DB::select` with `getPdo()`, which throws `SQLiteDatabaseDoesNotExistException` (not a `PDOException`) on SQLite. It now probes with `User::query()->exists()`, which throws a `QueryException` on every engine.
- P06-07a (browser): D-11 put the add-column form behind a closed tile; the walkthrough now opens the tile first.
- Visual baselines: a full browser run still rewrites 226 tracked baselines after the retake in `d75c5dec` (whiteboard, join, access phone login with its random host:port, among others). The visual suite does not fail on a diff, so this is drift to look at, not a failure.
