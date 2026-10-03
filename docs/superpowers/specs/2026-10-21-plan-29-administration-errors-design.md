# Skrüm — Administration sections and error pages (plan 29) — Design

Date: 2026-10-03 (draft for the owner; nothing is built before the owner has read §16)
Roadmap rows: AD-1 to AD-5 of `docs/superpowers/research/front-rewrite/feature-roadmap.md`. Deviation rows cleared: D-35 (admin sections, version line) and D-31 (error pages: "Instance status" link, the 403 access request, "Back at" and the admin message of the 503 page, the version line). The "Help" link of D-31 stays backlog (roadmap). The 404 "Search sessions ⌘K" stays "never" (owner, D-55).
Owner's word: `docs/superpowers/research/front-rewrite/owner-answers-2026-10-02.md`, all rounds: mockup binding for presentation (third round, rule 13); existing features kept; simple data may be added; informal register (sixth round: French "tu", Spanish "tú", German "du", error pages and the static 503 page included); a guest counts as a participant (no effect here); Eloquent only and four engines (fifth round, `docs/database.md`); the security answers of the third round (`sso_required`, break-glass); 11-D3 (request id on the 500 page), 11-D7/11-D10 (static 503, no database), the fourth-round "Maintenance" answer (an Inertia visit during maintenance forces a full reload) and D-55 (the static 503 reloads every 30 s).
Mockups (binding for presentation): `docs/design-system/components/ScreenSettings` (frame b, "Administration de l'instance self-host"), `ScreenErrors` (404, 403, 500, 503), `NotificationsPanel` (the bell), `Table`, `Pagination`, `Badge`, `Sidebar`; for each, `README.md` and `preview.html`.
Database rules: `docs/database.md`, "Rules for database code" 1 to 12.

What was read: `main` at `18d3637e` (front-end rewrite, database portability, plan 19). Nothing was run. Every "Back end" line of the roadmap was checked against the code; corrections are in §1.

## 1. Problem statement, and what the code holds today

The admin of a self-hosted instance has three sections (`AdminShell`: Branding, SSO authentication — the `sso_required` switch only —, Admins). The mockup draws nine (General, Branding, SSO authentication, SMTP, Integrations, MCP keys, Licence; then "Supervision": Users, Audit log) and a footer "host · v1.8.2 · up to date". The error pages leave five places empty (`ErrorPage` props `headerLinks`, `accessRequest`, `version`; Blade comments "Place left (AD-2/3/5)" in `resources/views/errors/503.blade.php`).

What the code holds, checked against the roadmap's "Back end" lines:

| Roadmap line | Reading of the code |
|---|---|
| AD-1 "environment configuration today; settings in `instance_settings`" | True. SSO providers (`SsoProvider::isEnabled()` reads `services.google.*`, `services.github.*`, `oidc.connections.entra.*`, `oidc.connections.generic.*`), mail (`config/mail.php`, `MAIL_*`), integration apps (`IntegrationProvider::isConfigured()` reads `services.*`), sign-up (`SignupMode::fromConfig()`, `skrum.allowed_email_domains`) and MCP (`skrum.mcp.enabled`) are environment only. `instance_settings` (key, JSON value) is read through `App\Support\InstanceSettings` (cached 300 s, survives an unreadable table) and already holds one secret, the GIF key, encrypted, with the environment as fallback — the precedent for anything stored. Tokens: `personal_access_tokens` (Sanctum, `token_hint`, `abilities` = MCP scopes, `team_id`, `last_used_at`, `expires_at`); a revoke deletes the row (`RevokeMcpToken`). No user listing, no deactivation, no `last_signed_in_at`, no audit table, no licence concept (`composer.json` says `"license": "MIT"`, the mockup says AGPL-3.0). |
| AD-2 "No version is exposed" | **Partly false.** `config('skrum.version')` exists (`SKRUM_VERSION`, default `1.0.0`), is shown on the About page (signed-in users) and given to the MCP server. It is not set by the Docker build (`Dockerfile` has no `SKRUM_VERSION`, `.github/workflows/docker-image.yml` passes no build argument): every image says `1.0.0`. No update check exists. |
| AD-3 "No status page; `/up` is the framework health route" | True. `/up` answers 200 even in maintenance; the Docker health check calls it. Four processes run in the image (`docker/s6-rc.d`: octane, queue, reverb, scheduler). Defaults: `CACHE_STORE=database`, `QUEUE_CONNECTION=database`, `BROADCAST_CONNECTION=null`, `MAIL_MAILER=log`. No heartbeat exists. |
| AD-4 "No request model; a notification to the team's managers" | True. A signed-in user gets 403 for a team they are not in from `TeamPolicy::view` (team pages) and from the participant middlewares (`ResolveRetroParticipant`, `ResolvePokerPlayer`, `ResolveWhiteboardMember`, `ResolveSurveyRespondent`, `ResolveGamePlayer`); a non-member of the workspace gets 403 from `can:view,workspace`. "Team managers" today are the workspace's owners and admins (`TeamPolicy::manageMembers` → `User::canManage`); team roles are TM-6 (plan 23). The bell (`ListNotifications`, presenters per kind, `NotificationReceived` on `user.{id}`) is the channel to reuse. Plain members do not see the names of teams they are not in (`Workspace::teamsVisibleTo`). |
| AD-5 "The 503 page is static and reads no database: the message must come from `artisan down` options" | True for the page. `artisan down` has no message option; its payload (`retry`, `refresh`, `secret`, `status`, `template`, …) is stored by the maintenance driver (file by default, `storage/framework/down`) and read back by `app()->maintenanceMode()->data()`. `DownCommand` dispatches `MaintenanceModeEnabled` after writing the payload; extra keys written into the payload survive. The 503 view receives the `HttpException` (with `Retry-After` when `--retry` was given). No down time is stored, so "Back at" cannot be computed from `--retry` alone at request time. |

## 2. Goals

1. The admin has the sections of the mockup, each built on data the instance holds or that this plan adds, behind the existing guard (`can:manageInstance` + `RequirePassword`).
2. The instance shows its version (admin footer, error pages) and, when the admin turns the check on, whether a newer release exists.
3. A public status page tells anyone whether the application, the database, the cache, the queue worker, the scheduler and the real-time server answer, and is reachable from every error page and during maintenance.
4. A signed-in member of a workspace who meets a 403 on a team (or on a session of that team) can ask for access with a message; the people who manage that team get it in the bell, add the person or decline, and the requester learns the outcome in the bell.
5. The 503 page shows when the instance is expected back (from `artisan down --retry`) and the message the admin wrote beforehand, still without reading the database at request time.
6. Every new text in four languages, informal; every database line Eloquent-only and green on PostgreSQL, MariaDB, MySQL and SQLite.

## 3. Non-goals (backlog)

- The "Help" link of the error pages (roadmap: backlog).
- Editing SSO, SMTP or integration-app **secrets** in the admin (decision 1, option A taken in the body): those stay environment configuration, shown read-only with a test action.
- Licence keys, seat limits, expiry enforcement or an "Enterprise" edition (decision 2).
- Deleting a user from the admin, impersonation, resetting another user's second factor (decision 3).
- An uptime history, incidents, or a JSON status API (`/up` stays the monitor route).
- The version in the login footer (owner: backlog), "Team name" on register, terms and privacy pages.
- Team roles (TM-6, plan 23); this plan's access request reads the workspace managers until then (decision 8).
- Showing revoked tokens as struck rows (plan 26 backlog: "revoked-token rows"); revoke keeps deleting the row.
- The connection-lost banner of ScreenErrors: built by plan 18e, untouched.
- Anything of the former plans 28 and 30 and scheduling.

## 4. Decisions already taken (by the owner's rules or earlier answers)

| Topic | Decision | Source |
|---|---|---|
| 503 page | Static Blade view, no database, no asset, one inline script reloading every 30 s | 11-D7/11-D10, D-55, B15 |
| 500 page | Request id shown, rendered without shared props | 11-D3 |
| 404 search | Never | D-55 |
| 403 title | "this page" in general; "this team" when the team is known (this plan) | D-55 + mockup |
| `sso_required` | Kept as is on the SSO section, with its break-glass | third round, security |
| Register | Informal, four languages, the 503 page included | sixth round |
| Data | Eloquent and the standard query builder only; Schema builder migrations, `up` only | fifth round, `docs/database.md` |

## 5. Rules

- Admin routes stay under `routes/admin.php`, group `auth`, `verified`, `can:manageInstance`; every section page and write under `RequirePassword` like Branding.
- Every admin write records an audit event (§6.6) in the same transaction as the change, or right after it when the change is not a database write (a test mail, an OIDC test).
- Nothing secret is ever sent to the browser: secrets are shown as "set" / "not set".
- The status page and the 503 page are Blade views that survive an unreachable database (`Tests\Support\UnreachableDatabase`) and an unreadable cache.
- Text sorting of lists read by people goes through `Alphabetical::sort` on bounded sets; paginated lists (users, tokens, audit) sort by `created_at` then `id`, newest first, which every engine orders the same way.

## 6. Domain and data

### 6.1 Instance settings (new keys of `InstanceSettingKey`)

| Key | Type | Written by | Read by |
|---|---|---|---|
| `signup_mode` | `open` / `invite` / `domain` | General | `SignupGate` (stored value, else `skrum.signup_mode`) |
| `allowed_email_domains` | list of lower-case domains | General | `SignupGate` (stored list, else `skrum.allowed_email_domains`) |
| `maintenance_message` | string ≤ 280 | General | the maintenance listener (§6.4) |
| `maintenance_message_by` | user id | General (the admin who saved the message) | the maintenance listener |
| `update_check_enabled` | bool, default false | General | the update check (§6.3), the version line |
| `latest_version` | string | the update check | the version line |
| `update_checked_at` | ISO date | the update check | the version line |
| `disabled_integrations` | list of `IntegrationProvider` values | Integrations | `IntegrationProvider::isEnabled()` |
| `mail_last_test` | `{at, ok, to}` | SMTP test | SMTP section |
| `sso_last_test` | `{provider, at, ok, ms, issuer}` | SSO test | SSO section |

`InstanceSettingKey::branding()` lists every key except `sso_required` today, so the Branding reset would clear the new keys: it becomes an explicit list of the fifteen branding keys.

### 6.2 Users

Two nullable columns on `users`: `deactivated_at` (dateTime) and `last_signed_in_at` (dateTime). No backfill: `last_signed_in_at` stays empty until the next sign-in, shown "—". `last_signed_in_at` is written by a listener of `Illuminate\Auth\Events\Login` (every sign-in path ends in `Auth::login` or Fortify's guard login: password, two-factor, e-mail code, magic link, passkey, SSO, invitation account).

A deactivated account:
- is signed out on its next web request (middleware `EnsureAccountIsActive` in the `web` group, after `StartSession`), with the message "This account is deactivated. Ask an admin of the instance.";
- is refused at the password login (a step `RefuseDeactivatedAccount` added to Fortify's login pipeline through `Fortify::authenticateThrough`, which answers only when the password is right, so the message reveals nothing to someone who does not hold it) with the same message, and at every other sign-in path by the middleware on the request that follows;
- is refused by MCP token authentication (`AuthenticateMcpRequest`) with 401;
- is refused on the broadcast authorisation route;
- keeps its memberships, tokens and content; reactivation restores everything.

An admin cannot deactivate themselves, and the last active instance admin cannot be deactivated (locked count, as `RevokeInstanceAdmin`).

### 6.3 Version and update check

- `App\Support\InstanceVersion`: `current()` = `config('skrum.version')` trimmed, leading `v` removed; `status()` = `unknown` (check off, never run, or failed), `current`, `outdated` (with `latest`), compared with `version_compare`.
- The Docker image sets the version: `ARG SKRUM_VERSION=dev` → `ENV SKRUM_VERSION`; the workflow passes `${{ steps.meta.outputs.version }}`.
- Update check (only when `update_check_enabled`): command `skrum:check-for-update`, scheduled daily `onOneServer()`; one GET to `config('skrum.update_feed')` (default `https://api.github.com/repos/arnaud-ritti/skrum/releases/latest`, a `tag_name`), timeout 5 s; stores `latest_version` and `update_checked_at`; a failure stores nothing new and logs a warning. Turning the switch on runs the check once (queued).

### 6.4 Maintenance details

- The admin writes the message in General before maintenance (`maintenance_message`, author kept).
- `AddMaintenanceDetailsListener` listens to `MaintenanceModeEnabled`. It reads the payload, the message and its author's name (the database is still reachable when `artisan down` runs), and writes the payload back with a `skrum` key: `{message: ?string, author: ?string, backAt: ?string}` where `backAt` = now + `retry` seconds in ISO 8601 UTC, null without `--retry`. A failure is reported and leaves the payload as it was.
- The 503 view reads `app()->maintenanceMode()->data()['skrum']` only when `app()->isDownForMaintenance()` and only inside `rescue()`; with the cache driver on a database store an unreachable database leaves the block out.
- `artisan down --render=…` pre-renders the page before the event: the block is then absent. The admin docs say to use plain `artisan down --retry=…`.

### 6.5 Team access requests

Table `team_access_requests`: `id` uuid, `team_id` (cascade), `user_id` (cascade), `message` text nullable (≤ 500), `status` string (`TeamAccessRequestStatus`: `pending`, `approved`, `declined`), `decided_by_user_id` nullable (null on delete), `decided_at` dateTime nullable, timestamps; indexes `(team_id, status)`, `(user_id, status)`.

- One pending request per (team, user): enforced in `RequestTeamAccess` under a lock on the team row (rule 6), not by an index (no partial index, rule 5). A second request while one is pending returns the pending one.
- Recipients: until TM-6, the owners and admins of the team's workspace (decision 8), the requester excluded.
- Approve adds the user to the team (`syncWithoutDetaching`) if they still belong to the workspace; otherwise the request is declined and the manager told why. Approve and decline lock the team row then the request; a request answered already returns "already answered" and changes nothing.
- Notifications (database channel, bell): `TeamAccessRequestedNotification` (kind `access_request`, stores the request id) to each recipient; `TeamAccessAnsweredNotification` (kind `access_answered`) to the requester. Presenters read the request live: a recipient who can no longer manage the team, or a request whose team is gone, drops out of the bell as other kinds do.
- A rejected request can be made again (a new row).

### 6.6 Audit log

Table `audit_events`: `id` uuid, `actor_user_id` nullable (null on delete), `actor_name` string (kept when the actor is deleted), `action` string (`AuditAction`), `subject_type` / `subject_id` nullable strings, `properties` JSON nullable (never a secret, never a value of a secret setting — keys only), `ip_address` string(45) nullable, `created_at` dateTime. Index `(created_at, id)`, `(action, created_at)`. Prunable after 365 days (daily `model:prune` already scheduled: add the model).

Actions recorded (decision 4, option B): admin settings changed (section, keys), branding reset, instance admin granted / revoked, user deactivated / reactivated, MCP token revoked by an admin, SSO connection tested, test e-mail sent, `sso_required` changed; sign-in succeeded, sign-in failed (address folded, no password), two-factor enabled / disabled, password changed, MCP token created / revoked by its owner.

### 6.7 Status

`App\Support\Status\InstanceStatus::check(): array` returns one row per component `{key, state}` with `state` ∈ `operational`, `degraded`, `down`, `not_configured`, `maintenance`:

| Component | Check | States |
|---|---|---|
| Application | the page answered; in maintenance → `maintenance` | operational / maintenance |
| Database | `User::query()->exists()` inside `rescue` | operational / down |
| Cache | put then get a random value under `skrum.status.probe` | operational / down |
| Queue | heartbeat `skrum.heartbeat.queue` written by the job `RecordQueueHeartbeatJob`, dispatched every minute by `skrum:heartbeat` | < 3 min operational, < 15 min degraded, else or never down |
| Scheduler | heartbeat `skrum.heartbeat.scheduler` written by `skrum:heartbeat` | same thresholds |
| Real time | `broadcasting.default` is `reverb`: TCP connect to `broadcasting.connections.reverb.options.host:port`, 1 s timeout; `null` or `log` → not configured | operational / down / not configured |
| E-mail | `mail.default` not `log` / `array` | operational / not configured |

Heartbeats live in the cache. Overall: "All systems operational", "Some systems are degraded", "Maintenance in progress". No detail beyond the state is public (decision 5).

## 7. Permissions

| Who | What |
|---|---|
| Instance admin (`is_instance_admin`), password confirmed | every admin section, read and write |
| Anyone, signed in or not, guests included | the status page; the version line per decision 6 |
| Signed-in member of the workspace, not in the team | the access-request block on a 403 of that team or of its sessions; `POST …/access-requests` |
| Signed-in non-member of the workspace, a guest, a visitor | the plain 403 page: no team, no names |
| Workspace owner or admin (until TM-6) | receives the request; approves or declines it |
| Requester | receives the outcome |

## 8. Real time

No new channel. Bell arrivals use the existing `NotificationReceived` on `user.{id}` (fired by `BroadcastNotificationReceivedListener` for every database notification). The 403 page does not listen: the requester learns the outcome in the bell.

## 9. Screens

All admin sections render inside `AdminShell` (spec ruling 14 of the front rewrite: the mockup's navigation column inside the app layout). Topbar: "Self-host" badge, and on editable sections the mockup's "n unsaved changes · Cancel · Save" (the Branding pattern). Mobile: the navigation becomes the "Section" select (exists); tables become stacked cards.

### 9.1 Admin navigation (`AdminShell`)

Groups "Instance" (General, Branding, SSO authentication [badge "active" when `ssoInForce`], SMTP, Integrations [badge "n/m" enabled/configured], MCP keys, Licence) and "Supervision" (Users, Admins, Audit log). Footer card: host, then "v1.8.2 · up to date" / "· update available: v1.9.0" / version alone (§6.3). "Admins" stays (existing feature; the mockup has no such entry: pre-build deviation P29-01). `/admin` redirects to General.

States: active entry (`aria-current`), badges, version unknown, update available (warning text, not colour alone).

### 9.2 General (`admin/general`)

Three cards (`.st-card` pattern): **Sign-up** (radio: invitation only / open / allowed domains + domain chips input; the environment value shown as default), **Maintenance message** (textarea 280, preview line "Shown on the maintenance page from the next `artisan down`", author and date of the saved message, "Clear"), **Updates** (version, switch "Check for new versions once a day" with the sentence "The instance asks GitHub once a day; nothing about the instance is sent.", last check result). States: saved, unsaved, validation errors, check failed.

### 9.3 SSO authentication (`admin/sign-in`, extended)

Above the existing `sso_required` form: one card per provider (Google, GitHub, Microsoft Entra, OIDC) in the mockup's form layout, **read-only** (decision 1 A): status badge (Configured / Not configured), issuer or tenant, client ID, secret "set" (masked field, no eye: there is nothing to reveal), redirect URI read-only with Copy, the environment variable names as hint; "Test the connection" on Entra and OIDC (fetches the discovery document; result alert "Connected · 184 ms · issuer …" or the error; last result kept). Not configured: the card collapses to its name and "Set `OIDC_BASE_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` to enable it." The mockup's "Keep sign-in by e-mail as fallback" is the existing break-glass sentence, not a switch (P29-02).

### 9.4 SMTP (`admin/mail`)

Read-only card: mailer, host, port, encryption, user, password "set", sender; status badge "Operational" (a delivering mailer) or "Not configured (mails are written to the log)". "Send a test e-mail" (address, default the admin's), result line "Last test delivered today at 14:02" / "Last test failed at 14:02: the server refused the connection" (the exception class mapped to a sentence; never the server's raw answer). Throttled 5 per 10 minutes.

### 9.5 Integrations (`admin/integrations`)

One row per provider (`.st-int`): name, state "Available · n teams connected" / "Not configured" / "Turned off", a switch (enabled only when configured). Turning a provider off hides it from team settings and stops its deliveries and polls (`isEnabled()` false), keeping the team integrations; turning it back on resumes them. The mockup's "Configure" / "Connect" buttons are team-level actions: replaced by the teams count and the env hint (P29-03). Confirm dialog before turning off a provider that teams use.

### 9.6 MCP keys (`admin/mcp-keys`)

Table: name, owner (avatar, name), fingerprint `skrum_…{token_hint}` (Sanctum's `token_prefix` is `skrum_`, `token_hint` the last four characters), scopes as `code` chips, team, created (date · owner), last used (relative, "Never"), expires; "Revoke" (destructive text, confirm dialog naming the owner). 25 per page, newest first. "Create a key" links to the admin's own token settings (`settings/api-tokens`). MCP turned off in the environment: an alert "The MCP server is off (`SKRUM_MCP_ENABLED`)", list still shown. Empty state.

### 9.7 Licence (`admin/licence`) — decision 2, option B

Card "Skrüm" with the licence name read from `config('skrum.licence')` (owner to confirm the value), the sentence "Open source; every feature is included.", "Accounts in use" = active (not deactivated) users, no seat limit, no expiry, link to the source repository. No progress bar (no limit to measure against: P29-04).

### 9.8 Users (`admin/users`)

Search (name or address, the `AdminCandidatesController` technique), filter All / Active / Deactivated / Admins; table: avatar, name, address, badges (Admin, Deactivated, 2FA on), workspaces count, created, last sign-in; row menu: Deactivate / Reactivate (confirm dialog; refused for self and for the last active admin, the reason shown), "Make admin" opens the Admins flow. 25 per page, newest first. Empty search state.

### 9.9 Audit log (`admin/audit-log`)

Table: when (relative, exact on hover), actor (avatar or "System"), action sentence (translated per `AuditAction`), subject, IP. Filters: action group (Settings, Accounts, Sign-in, Tokens), actor search; 50 per page, newest first; "Kept 365 days" note. Empty state.

### 9.10 Error pages

- Header: "Instance status" link (to `/status`) on 403, 404, 419, 429, 500 and 503. "Help" not built.
- Footer: "name · v1.8.2" per decision 6 (500 page: from config, no shared props).
- 403 with a known team (§6.5): overline "Error 403 · Access denied", title "You don't have access to this team", team block (pastille with the initial, name, "workspace · n members"), "You're signed in as **email**. Ask for access and a team admin will review it.", optional message (textarea 500), "Request access" (primary), "Switch account" (ghost), "Team admins: A, B" with avatars (three at most, then "+n"). After sending: toast and a disabled "Request sent". A request already pending: the block opens in the sent state. A failure keeps the form with the error.
- 403 without a known team, or for a non-member of the workspace: unchanged.

### 9.11 503 page (static)

Header: logo, "Instance status" link (`/status`, served during maintenance). Main: as today, plus the "Back at" block (`skrum-info-soft`): time in display size, "your time (zone) · in about n min" — computed by the existing inline script in the browser's time zone from `<time datetime>`; without script the UTC time is shown; a past time reads "Any moment now". Then the admin's message in quotes with the author ("Hugo Lambert, instance admin"). Without `--retry` and without message: the page as today. The busy-database 503 shows neither block. The mockup's "Your admin is installing version 1.9.0" is not built: the target version is not known (P29-05). Footer: name (and version per decision 6). Still one inline script, no external asset.

### 9.12 Status page (`/status`)

No mockup: built from the 503 page's frame (same static head, logo, card list). Title "Instance status", overall sentence, list of components with an icon and the state in words (not colour alone), "Checked at hh:mm UTC", "Refresh" link, link "Back to my teams" (`/`). Language from `Accept-Language` like the 503 page. Served outside the `web` middleware group (no session, no CSRF, no cookie) and excepted from maintenance mode.

### 9.13 Bell

Two kinds added to `NotificationsPanel`: `access_request` — actor avatar, "**Nadia** asks to join **Atlas**", the message excerpt, inline "Add to the team" (primary sm) and "Decline" (ghost sm); answered state "Added by Camille" / "Declined by Camille", buttons removed — and `access_answered` — team tile, "You were added to **Atlas**" (links to the team) or "Your request to join **Atlas** was declined".

## 10. Migrations of existing data

None. New tables and nullable columns only; no row is rewritten. Environment values keep working: every new setting falls back to its environment value when not stored. `InstanceSettingKey::branding()` becomes explicit so that a Branding reset clears the same keys as before.

## 11. Routes

| Method, URL | Name | Controller |
|---|---|---|
| GET `admin` | `admin.index` | redirect to General |
| GET/PUT `admin/general` | `admin.general.edit` / `.update` | `Admin\GeneralSettingsController` |
| POST `admin/sign-in/tests` | `admin.ssoTests.store` | `Admin\SsoConnectionTestsController` |
| GET `admin/mail` | `admin.mail.show` | `Admin\MailSettingsController` |
| POST `admin/mail/tests` | `admin.mailTests.store` | `Admin\MailTestsController` (throttle 5,10) |
| GET/PUT `admin/integrations` | `admin.integrations.edit` / `.update` | `Admin\IntegrationSettingsController` |
| GET `admin/mcp-keys`, DELETE `admin/mcp-keys/{token}` | `admin.mcpKeys.index` / `.destroy` | `Admin\McpKeysController` |
| GET `admin/licence` | `admin.licence.show` | `Admin\LicencesController` |
| GET `admin/users` | `admin.users.index` | `Admin\UsersController` |
| POST/DELETE `admin/users/{user}/deactivation` | `admin.userDeactivations.store` / `.destroy` | `Admin\UserDeactivationsController` |
| GET `admin/audit-log` | `admin.auditEvents.index` | `Admin\AuditEventsController` |
| POST `w/{workspace}/teams/{team}/access-requests` | `teams.accessRequests.store` | `TeamAccessRequestsController` (throttle 5,60) |
| PATCH `w/{workspace}/teams/{team}/access-requests/{accessRequest}` | `teams.accessRequests.update` | `TeamAccessRequestsController` |
| GET `status` | `status.show` | `StatusPagesController` (routes/status.php, no `web` group) |

## 12. Testing

- Feature tests per route: admin access (non-admin 403, unconfirmed password redirect), each section's props, each write and its audit event, validation.
- Error pages: the 403 block for each denied route kind (team page, retro, poker game, whiteboard, team survey, game room), absent for a non-member of the workspace, a guest, a visitor, and on a 403 that is not about a team (closed registration); the 500 page carries the version without shared props; the 503 page in maintenance with `--retry=1800` and a message, without them, with an unreachable database, and the busy 503; still one inline script.
- Status page with each component down (fakes), in maintenance, with an unreachable database, without a session cookie set.
- Races (`tests/Concurrency`, `Race`, on pgsql, mariadb, mysql, sqlite-file): two access requests of one user at once make one pending row; an approve and a decline of one request at once give one outcome; deactivating the last two active admins at once leaves one.
- Upgrade: none (no data migration).
- Vitest for `AdminShell`, each section container, the access-request block, the two bell kinds, the version line.
- Captures (light, 1440, French) of the nine admin sections, the 403 with the block (both states), the 503 with "Back at" and message, the status page. No browser walkthrough.

## 13. Acceptance criteria

1. A non-admin gets 403 on every `admin/*` route; an admin without a recent password confirmation is sent to confirm it.
2. `AdminShell` lists, in this order, General, Branding, SSO authentication, SMTP, Integrations, MCP keys, Licence under "Instance" and Users, Admins, Audit log under "Supervision", each linking to its page; `/admin` opens General.
3. The admin footer shows the host and `v` + `config('skrum.version')`; with the update check on and a newer `latest_version`, "update available: vX"; with the same version, "up to date"; with the check off or never run, the version alone.
4. Saving General stores the sign-up mode and the domains; `SignupGate` then follows the stored mode (open, invite, domain) over the environment; clearing them returns to the environment value.
5. With the update check on, `skrum:check-for-update` stores the release's version without its `v` and the time; a failing or non-JSON answer stores nothing and does not throw; with the check off it makes no request.
6. A Branding reset leaves every non-branding key (the ten of §6.1 and `sso_required`) in place.
7. The SSO section shows each provider's state, non-secret values, redirect URI and "secret set" without any secret in the props; "Test the connection" on a configured OIDC provider reports success with the issuer and the time, or the failure, records an audit event, and makes no request for an unconfigured provider.
8. The SMTP section shows the mail configuration without the password; a test e-mail is sent synchronously to the given address, its result stored and shown; a transport failure is shown as a sentence; the sixth test within 10 minutes is refused.
9. Turning a configured provider off makes `IntegrationProvider::isEnabled()` false for it (team settings hide it, its callbacks answer 404 through `EnsureIntegrationProviderEnabled`), keeps every `team_integrations` row, and turning it back on restores it; an unconfigured provider cannot be turned on.
10. The MCP keys section lists every token of every user, newest first, 25 per page, with owner, fingerprint, scopes, team, created, last used and expiry; an admin revokes any token, the token stops authenticating, and an audit event names its owner.
11. The Users section lists every account newest first with the columns of §9.8, filters and searches them; deactivating signs the account out at its next request, refuses its password login with the message, refuses its MCP tokens with 401, and keeps its memberships; reactivating restores access; an admin cannot deactivate themselves or the last active admin, also when two deactivations arrive at once.
12. `last_signed_in_at` is set on a password sign-in, an SSO sign-in, a magic-link sign-in and an e-mail-code sign-in.
13. Each action of §6.6 writes one audit event with actor, action, subject and the changed keys, and never a secret value; the audit page lists them newest first, 50 per page, filtered by group and actor; events older than 365 days are pruned.
14. A signed-in member of the workspace who opens a team, or a retro, poker game, whiteboard, team survey or game room of a team they are not in, gets 403 with the team block, the workspace's managers named; a non-member of the workspace, a guest, a visitor, and a 403 that is not about a team get the plain 403 without any team or person named.
15. "Request access" creates one pending request (two at once create one), notifies each workspace owner and admin but the requester in the bell, and switches the block to "Request sent"; reopening the URL shows the sent state; a member of the team cannot request.
16. A manager approves from the bell: the requester is in the team, sees it in the sidebar, and gets "You were added to Atlas"; a decline leaves the team unchanged and tells the requester; an approve and a decline at once give one outcome; a request already answered answers "already answered"; a requester who left the workspace is not added.
17. The bell lists `access_request` and `access_answered` with the texts of §9.13 and drops them when their team is gone or the reader can no longer manage it.
18. `artisan down --retry=1800` with a saved message shows on the 503 page "Back at" at down time + 30 minutes (UTC in the HTML, local time after the script) and the message with its author; `artisan down` without them shows the page as before; the busy 503 shows neither; the page still has exactly one inline script and no external asset, also with an unreachable database.
19. `/status` answers 200 with every component's state, in maintenance as well (state "Maintenance in progress"), with an unreachable database (Database down, the page still rendered), without starting a session; each error page and the 503 page link to it.
20. Error pages show the version per decision 6; the 500 page shows it without shared props.
21. The Docker image built by the workflow reports its release version in `config('skrum.version')`.
22. Every new string exists in en, fr, es, de, informal (`InformalRegisterTest`, `TranslationKeysTest` pass); the captures of §12 have no horizontal overflow and are compared with their mockup, each difference fixed or a row of the plan's deviations table.
23. Unit, feature and arch suites pass on PostgreSQL, SQLite, MariaDB and MySQL through `bin/test-db`; the concurrency suite on PostgreSQL, MariaDB, MySQL and a SQLite file; `tests/Arch/DatabasePortabilityTest.php` passes.

## 14. Risks

- **Many sign-in paths.** Deactivation relies on a middleware for the paths that do not go through Fortify's pipeline: one request is served after such a sign-in before the sign-out. Acceptable for a deactivation (not a security boundary against an attacker holding the password); the test list covers each path.
- **Octane.** Settings are read per request through `InstanceSettings` (cached); nothing new is put into `config()` at boot, so a worker never keeps a stale value.
- **Information on the 403 page.** The team's name and its managers' names are shown to a workspace member who is not in the team. Today such a member does not see that team's name anywhere (decision 7).
- **Access-request spam.** One pending request per team and user, 5 requests an hour per user, and a decline that does not block a new request; a manager can ignore it.
- **The status page under load or with a dead database.** It is public and unthrottled (the throttle reads the cache, which is the database by default). Each check is bounded (TCP 1 s; the database connect timeout is the driver's) — a hanging database connection makes the page slow, as `/up` is today.
- **Update check.** An outbound call from a self-hosted instance (off by default) to a repository whose public availability is not known (§17).
- **The arch rule on enums.** `IntegrationProvider::isEnabled()` must read the instance setting: the enum is added to the `ignoring` list of the arch test beside `McpFeature`, as the precedent says ("asks the container").
- **Maintenance with `--render`.** The pre-rendered page has no "Back at" block (§6.4).
- **Size.** Nine admin sections, the error and status pages, a request flow and the bell: three back-end lanes and a screen step; AD-1 can be split (decision 1 is where the size goes up or down).
- **Admin escalation.** Kept out by decision 1 A: an admin who could change the OIDC issuer or the SMTP server could sign in as anyone (SSO accounts are matched by verified address) or read password-reset mails.

## 15. Rollout

One deploy. The migrations add columns and tables only. After the deploy the admin sees the new sections with environment values as defaults; nothing changes for users until an admin saves a setting.

## 16. Decisions for the owner

The body is written on the option marked **recommended**. The plan's table "Owner decisions" says which tasks change with another answer.

**1. Where do SSO, SMTP and integration-app settings live?**
- A. **Recommended.** They stay in the environment. The sections show them read-only (non-secret values, "secret set", redirect URI), with "Test the connection" and "Send a test e-mail"; the only new stored values are non-secret switches (sign-up, providers turned off). No admin can redirect sign-in to an identity provider of their choice or read password-reset mails through their own SMTP server. Deviation: the fields of the mockup are read-only (P29-02).
- B. Editable and stored encrypted in `instance_settings`, the environment as fallback (the GIF-key precedent), applied per request and per queued job. The mockup exactly; about six more tasks (mail and Socialite configuration per request, workers that pick up changes, decrypt failures after an `APP_KEY` rotation), and an instance admin becomes able to take over any SSO account.
- C. B for SMTP and the integration apps, A for SSO. Halves the escalation (password-reset mails still readable).

**2. Licence section.**
- A. Not built; the entry stays out of the navigation (deviation D-35 stays for it).
- B. **Recommended.** An informational card: the licence name (the owner gives it: `composer.json` says MIT, the mockup AGPL-3.0), "every feature included", accounts in use, no limit, no expiry. True data, the mockup's place filled.
- C. Licence keys with seats and expiry, and features behind them (the mockup's "SSO and audit under licence"). A business model change; a plan of its own.

**3. What the Users section can do.**
- A. List and search only.
- B. **Recommended.** List, search, deactivate and reactivate (§6.2). Covers someone leaving the company without destroying their content.
- C. B plus delete an account (reuse the self-deletion action, with the workspace-ownership checks it has).

**4. What the audit log records.**
- A. Admin actions only.
- B. **Recommended.** Admin actions plus security events (sign-in success and failure, second factor on/off, password change, MCP token created or revoked), kept 365 days.
- C. B plus workspace and team administration (members added or removed, invitations, team deletion).

**5. Status page audience and detail.**
- A. **Recommended.** Public (the error pages link to it for visitors too), states only, no versions, no hosts, no timings.
- B. Instance admins only (a visitor clicking "Instance status" lands on the login page — useless on a 503).
- C. Public, with detail (latency, last heartbeat times, version).

**6. Who sees the version line on error pages.**
- A. Everyone, as the mockup shows.
- B. **Recommended.** Signed-in users only, as the About page today; the static 503 and the status page show none (they cannot tell who is signed in). Telling an anonymous visitor the exact version helps whoever looks for a known flaw.
- C. Instance admins only.

**7. What the 403 page shows a workspace member who is not in the team.**
- A. **Recommended.** The mockup: team name, member count, the managers' names and avatars. They hold the link already; without names they cannot know whom to ask.
- B. Team name only, no people.
- C. Nothing about the team; a generic "Ask for access" sent to the workspace managers.

**8. Who receives an access request before team roles exist (TM-6, plan 23).**
- A. Wait: AD-4 moves to after plan 23, which removes three tasks here.
- B. **Recommended.** The workspace's owners and admins now (they are who can add members today); plan 23 switches the recipients to the team's owners and facilitators in `AccessRequestRecipients` (one class).
- C. The workspace owner only.

**9. "Back at" and the maintenance message.**
- A. **Recommended.** "Back at" from `artisan down --retry`; the message written beforehand in General and attached at `down` by a listener (the mockup README: "admin's message (instance setting, optional)", "the time comes from `--retry`").
- B. A command `skrum:down --message= --back-at=` only; nothing in the admin.
- C. A as well as B (the command's options win over the stored message).

**10. The update check.**
- A. None: the version alone.
- B. **Recommended.** Off by default, a switch in General; once a day to the GitHub releases of the project.
- C. On by default.

Not decisions, but to confirm with the pre-build deviations: "Admins" stays as a section (P29-01); "Configure"/"Connect" on the Integrations rows become counts (P29-03); the Licence progress bar is not drawn (P29-04); the 503 sentence naming the target version is not built (P29-05).

## 17. Not determined by reading

1. The licence of the project (MIT in `composer.json`, AGPL-3.0 in the mockup).
2. Whether `github.com/arnaud-ritti/skrum` is public and publishes releases with `tag_name` (the update check's source).
3. Whether Reverb answers a TCP connect on `broadcasting.connections.reverb.options.host:port` from inside the container (the client-facing address may differ from the server's bind address `reverb.servers.reverb`).
4. Whether every passkey sign-in fires `Illuminate\Auth\Events\Login` (the passkey package's guard call); the plan's test proves it or adds a listener on the package's event.
5. Whether `EnsureAccountIsActive` placed in the `web` group also runs on the broadcast authorisation route (`BroadcastAuthorizationsController` is a web route; to check in Task 13).
6. Whether Fortify's default login pipeline in the installed version is the one the plan extends (`authenticateThrough` with a step before the two-factor redirect); the plan re-reads `AuthenticatedSessionController::loginPipeline`.
7. Whether `TeamSurvey` and `GameRoom` routes bind their models before their middleware abort (true for `retro`, `game`, `board`; to check for `teamSurvey` and `room`).
8. The size of the `lang/*.json` conflicts between lanes.
