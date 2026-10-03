# Skrüm — Administration sections and error pages (plan 29) — Design

Date: 2026-10-03 (draft); revised 2026-10-03 with the owner's answers to §16 (all ten answered; decisions 1 and 2 differ from the recommendation the draft was written on); revised again 2026-10-03 with the owner's answers to the pre-build deviations P29-01 to P29-12 (P29-03, P29-05, P29-11 as recommended; P29-02 obsolete because SSO and SMTP are editable; the others approved as listed) and his rule that each plan is verified on PostgreSQL only. Status: approved for build (owner's go-ahead for the roadmap, 2026-10-03).
Built: plan 29, branch `plan-29-administration-errors`.
Roadmap rows: AD-1 to AD-5 of `docs/superpowers/research/front-rewrite/feature-roadmap.md`. Deviation rows cleared: D-35 (admin sections, version line) and D-31 (error pages: "Instance status" link, the 403 access request, "Back at" and the admin message of the 503 page, the version line). The "Help" link of D-31 stays backlog (roadmap). The 404 "Search sessions ⌘K" stays "never" (owner, D-55).
Owner's word: `docs/superpowers/research/front-rewrite/owner-answers-2026-10-02.md`, all rounds: mockup binding for presentation (third round, rule 13); existing features kept; simple data may be added; informal register (sixth round: French "tu", Spanish "tú", German "du", error pages and the static 503 page included); a guest counts as a participant (no effect here); Eloquent only and four engines (fifth round, `docs/database.md`); the security answers of the third round (`sso_required`, break-glass); 11-D3 (request id on the 500 page), 11-D7/11-D10 (static 503, no database), the fourth-round "Maintenance" answer (an Inertia visit during maintenance forces a full reload) and D-55 (the static 503 reloads every 30 s). Answers of 2026-10-03 to §16: `.superpowers/sdd/roadmap/progress.md`, line "Plan 29".
Mockups (binding for presentation): `docs/design-system/components/ScreenSettings` (frame b, "Administration de l'instance self-host"), `ScreenErrors` (404, 403, 500, 503), `NotificationsPanel` (the bell), `Table`, `Pagination`, `Badge`, `Sidebar`; for each, `README.md` and `preview.html`.
Database rules: `docs/database.md`, "Rules for database code" 1 to 12.

What was read: `main` at `18d3637e` (front-end rewrite, database portability, plan 19), re-read at `0c294632` for the revision (instance settings, SSO and integration enums, `config/services.php`, `config/oidc.php`, `config/mail.php`, the OIDC Socialite package, Octane's listeners, `bootstrap/app.php`, `composer.json`). Nothing was run. Every "Back end" line of the roadmap was checked against the code; corrections are in §1.

## 1. Problem statement, and what the code holds today

The admin of a self-hosted instance has three sections (`AdminShell`: Branding, SSO authentication — the `sso_required` switch only —, Admins). The mockup draws nine (General, Branding, SSO authentication, SMTP, Integrations, MCP keys, Licence; then "Supervision": Users, Audit log) and a footer "host · v1.8.2 · up to date". The error pages leave five places empty (`ErrorPage` props `headerLinks`, `accessRequest`, `version`; Blade comments "Place left (AD-2/3/5)" in `resources/views/errors/503.blade.php`).

What the code holds, checked against the roadmap's "Back end" lines:

| Roadmap line | Reading of the code |
|---|---|
| AD-1 "environment configuration today; settings in `instance_settings`" | True. SSO providers (`SsoProvider::isEnabled()` reads `services.google.*`, `services.github.*`, `oidc.connections.entra.*`, `oidc.connections.generic.*`), mail (`config/mail.php`, `MAIL_*`), integration apps (`IntegrationProvider::isConfigured()` reads `services.*`), sign-up (`SignupMode::fromConfig()`, `skrum.allowed_email_domains`) and MCP (`skrum.mcp.enabled`) are environment only. The OIDC package (`socialiteproviders/openidconnect`, `OpenIDConnectServiceProvider::boot`) copies each `oidc.connections.<name>` into `services.oidc_<name>` **at boot**, and its Socialite drivers read `services.oidc_entra` / `services.oidc_generic`: a value changed later must be written to both places. Octane gives each request a clone of the configuration (`CreateConfigurationSandbox`) and forgets resolved mailers and Socialite drivers between requests (`GiveNewApplicationInstanceToMailManager`, `PrepareSocialiteForNextOperation`); a queue worker does neither. `instance_settings` (key, JSON value) is read through `App\Support\InstanceSettings` (container-scoped, cached 300 s, survives an unreadable table) and already holds one secret, the GIF key, encrypted, with the environment as fallback — the precedent for anything stored. `bootstrap/app.php` keeps `token` and `gif_key` out of flashed input (`dontFlash`). Tokens: `personal_access_tokens` (Sanctum, `token_hint`, `abilities` = MCP scopes, `team_id`, `last_used_at`, `expires_at`); a revoke deletes the row (`RevokeMcpToken`). No user listing, no deactivation, no `last_signed_in_at`, no audit table, no licence concept (`composer.json` says `"license": "MIT"`, the repository has no `LICENSE` file, the mockup says AGPL-3.0). |
| AD-2 "No version is exposed" | **Partly false.** `config('skrum.version')` exists (`SKRUM_VERSION`, default `1.0.0`), is shown on the About page (signed-in users) and given to the MCP server. It is not set by the Docker build (`Dockerfile` has no `SKRUM_VERSION`, `.github/workflows/docker-image.yml` passes no build argument): every image says `1.0.0`. No update check exists. |
| AD-3 "No status page; `/up` is the framework health route" | True. `/up` answers 200 even in maintenance; the Docker health check calls it. Four processes run in the image (`docker/s6-rc.d`: octane, queue, reverb, scheduler). Defaults: `CACHE_STORE=database`, `QUEUE_CONNECTION=database`, `BROADCAST_CONNECTION=null`, `MAIL_MAILER=log`. No heartbeat exists. |
| AD-4 "No request model; a notification to the team's managers" | True. A signed-in user gets 403 for a team they are not in from `TeamPolicy::view` (team pages) and from the participant middlewares (`ResolveRetroParticipant`, `ResolvePokerPlayer`, `ResolveWhiteboardMember`, `ResolveSurveyRespondent`, `ResolveGamePlayer`); a non-member of the workspace gets 403 from `can:view,workspace`. "Team managers" today are the workspace's owners and admins (`TeamPolicy::manageMembers` → `User::canManage`); team roles are TM-6 (plan 23). The bell (`ListNotifications`, presenters per kind, `NotificationReceived` on `user.{id}`) is the channel to reuse. Plain members do not see the names of teams they are not in (`Workspace::teamsVisibleTo`). |
| AD-5 "The 503 page is static and reads no database: the message must come from `artisan down` options" | True for the page. `artisan down` has no message option; its payload (`retry`, `refresh`, `secret`, `status`, `template`, …) is stored by the maintenance driver (file by default, `storage/framework/down`) and read back by `app()->maintenanceMode()->data()`. `DownCommand` dispatches `MaintenanceModeEnabled` after writing the payload; extra keys written into the payload survive. The 503 view receives the `HttpException` (with `Retry-After` when `--retry` was given). No down time is stored, so "Back at" cannot be computed from `--retry` alone at request time. |

## 2. Goals

1. The admin has the sections of the mockup, each built on data the instance holds or that this plan adds, behind the existing guard (`can:manageInstance` + `RequirePassword`).
2. SSO providers, SMTP and the integration apps are **editable in the admin** (decision 1, answer B): stored encrypted in `instance_settings`, the environment as the fallback for every field, applied to each web request, queued job and console command — with the safeguards of §5.1 (fresh confirmation, audit of every change, a mail to every instance admin when SSO or SMTP changes).
3. The instance shows its version (admin footer, error pages for signed-in users) and, when the admin turns the check on, whether a newer release exists.
4. A public status page tells anyone whether the application, the database, the cache, the queue worker, the scheduler and the real-time server answer, and is reachable from every error page and during maintenance.
5. A signed-in member of a workspace who meets a 403 on a team (or on a session of that team) can ask for access with a message; the people who manage that team get it in the bell, add the person or decline, and the requester learns the outcome in the bell.
6. The 503 page shows when the instance is expected back (from `artisan down --retry`) and the message the admin wrote beforehand, still without reading the database at request time.
7. The project's declared licence becomes AGPL-3.0 (decision 2): `composer.json`, a `LICENSE` file with the licence text, and the admin's Licence card agree.
8. Every new text in four languages, informal; every database line Eloquent-only and portable to PostgreSQL, MariaDB, MySQL and SQLite (`docs/database.md`), verified on PostgreSQL in this plan; the roadmap's four-engine matrix runs once, after its last plan is merged.

## 3. Non-goals (backlog)

- The "Help" link of the error pages (roadmap: backlog).
- Editing in the admin: `APP_URL` and the redirect URIs derived from it, the outgoing-webhook network relaxations (`OUTGOING_WEBHOOKS_ALLOW_PRIVATE_NETWORKS`, `OUTGOING_WEBHOOKS_ALLOW_HTTP`), `GITHUB_APP_PRIVATE_KEY_PATH`, `INTEGRATIONS_INBOUND_WEBHOOKS`, `INTEGRATIONS_POLL_MINUTES`, mailers other than SMTP (SES, Postmark…), the Laravel Slack notification channel keys (`SLACK_BOT_USER_*`). They stay environment configuration (rule S8).
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
| §16 decisions 1 to 10 | Answered 2026-10-03; the body below is written on the answers | `.superpowers/sdd/roadmap/progress.md` |
| Pre-build deviations P29-01 to P29-13 | Answered 2026-10-03 (plan, table "Pre-build deviations"): P29-02 obsolete, so the SSO and SMTP forms follow the mockup's secret field and SSO card (§9 "Configuration forms", §9.3) | `.superpowers/sdd/roadmap/progress.md`, line "P29:" |
| Test engines | PostgreSQL only per plan; the four-engine matrix once, after the last merge into `roadmap` (plans 24 and 25); risk of a late engine-specific regression accepted | owner, 2026-10-03 |
| Order | Plans 20, 21, 26, 27, 29 in parallel → 22 → 23 → 24 and 25: this plan runs beside plan 26 and before plan 23 | owner, 2026-10-03 |

## 5. Rules

- Admin routes stay under `routes/admin.php`, group `auth`, `verified`, `can:manageInstance`; every section page and write under `RequirePassword` like Branding.
- Every admin write records an audit event (§6.6) in the same transaction as the change, or right after it when the change is not a database write (a test mail, an OIDC test).
- Nothing secret is ever sent to the browser: secrets are shown as "set" / "not set".
- The status page and the 503 page are Blade views that survive an unreachable database (`Tests\Support\UnreachableDatabase`) and an unreadable cache.
- Text sorting of lists read by people goes through `Alphabetical::sort` on bounded sets; paginated lists (users, tokens, audit) sort by `created_at` then `id`, newest first, which every engine orders the same way.

### 5.1 Security rules of the editable configuration (owner's decision, accepted risk)

These rules are numbered so that no implementer or reviewer "fixes" them back. Each has its test (plan: Tasks 17 to 22).

- **S1 — Accepted risk.** An instance admin can change the SSO providers (issuer, client id, secret), the SMTP server and the integration apps from the admin. This lets an instance admin — or anyone holding an admin's signed-in session and a fresh confirmation — redirect sign-in to an identity provider of their choice and sign in as any account linked by verified address, and read password-reset mails through an SMTP server of their choice. The owner chose this on 2026-10-03 **after this risk was spelled out to him**, and asked for the safeguards S2 to S9 instead of read-only fields. Do not make these fields read-only, move them back to the environment, or remove them; a review that finds the risk refers to this rule. Test: `an instance admin can store an OIDC issuer and an SMTP host` (Task 20/21) stays green.
- **S2 — Fresh confirmation.** Every write of an SSO provider, of SMTP or of an integration app (saving or clearing a field) is refused unless the admin's session holds a password confirmation younger than **300 seconds** (`InstanceConfiguration::ConfirmationSeconds`), checked in the Form Request (error key `confirmation`, nothing written) — not the 3-hour window of `RequirePassword`. The confirmation is the existing one (password or passkey). Plan 26's rule S-1 (no confirmation in the account settings for an account without a known password) does **not** apply here: plan 26 itself keeps the admin area out of it (its §5.12, S-1.3), and S2 reads only the session's confirmation time, which S-1's middleware does not write. Tests: a write 301 s after the confirmation is refused and stores nothing; a write 299 s after it succeeds.
- **S3 — Audit of every change.** Each write records one `ConfigurationUpdated` event: section, names of the fields changed, names of the fields cleared (back to the environment), and whether the alert mail went out — never a value, secret or not. Tests: the event's `properties` hold the field names; the JSON of every audit row contains none of the values written.
- **S4 — Alert mail to every instance admin for SSO and SMTP.** After the write commits, `InstanceConfigurationChangedMail` is sent synchronously to every active (not deactivated) instance admin, the author included: who (name, address), when (UTC), from which IP, which section, which fields — never a value — and "If no admin made this change, sign in, check the section and change your password." It is sent through **the mail configuration in force before the change** (the request's configuration applied at its start), so that an SMTP server set by an intruder does not swallow the alert. A failure to send is reported, recorded in the audit event (`alertSent: false`), keeps the change, and the toast says "Saved, but the alert to the admins could not be sent." Integration-app changes are audited, not mailed (the owner named SSO and SMTP). Tests: a change of the OIDC client id mails each active admin once and none to a deactivated admin; an SMTP host change is mailed through the previous host (the mailer's transport host asserted); an integration change mails nobody.
- **S5 — Secrets never leave the server in clear.** A secret field (`client_secret`, `password`, `bot_token`, `webhook_secret`, `private_key`) is encrypted with `Crypt::encryptString` before it is stored, is write-only (the page receives `secretSet: bool` and the source), and never appears in Inertia props, flashed input (`dontFlash`), validation messages, audit rows, the alert mail or logs (`#[SensitiveParameter]` on every method that takes one). Tests: the raw `instance_settings` row differs from the plain secret and decrypts to it; the page HTML, the audit table and the mail body contain none of the secret strings; an invalid form keeps no secret in the session.
- **S6 — A blank secret keeps the stored one.** Saving a form with a secret field left blank changes nothing for that field; returning a field to the environment value is its own action ("Use the environment value"), under S2 and S3. Test: a save with a blank `client_secret` keeps the stored secret.
- **S7 — Environment fallback, per field.** A field not stored reads its environment value. A stored secret that can no longer be decrypted (the `APP_KEY` changed) is treated as not stored — the environment value applies — and the section shows "A saved secret can't be read any more (the application key changed). Enter it again." Tests: clearing a field returns `config()` to the environment value on the next request; a secret encrypted under another key falls back and raises the warning.
- **S8 — What stays environment only.** `APP_URL` and the redirect URIs, the two outgoing-webhook relaxations (an admin must not open requests to the private network from the page), `GITHUB_APP_PRIVATE_KEY_PATH`, `INTEGRATIONS_*`, mailers other than SMTP and `log`. The catalogue (§6.8) has no field for them. Test: the catalogue holds none of those configuration keys.
- **S9 — No lock-out through SSO.** While `sso_required` is on, a change that leaves no SSO provider enabled is refused ("Turn off "SSO required" first."). The break-glass of the third round is unchanged. Test: clearing the only enabled provider's client id while `sso_required` is on answers a validation error and stores nothing.

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
| `sso_google`, `sso_github`, `sso_entra`, `sso_oidc` | object of fields (§6.8), secrets encrypted | SSO section | `InstanceConfiguration` |
| `smtp` | object of fields (§6.8), password encrypted | SMTP section | `InstanceConfiguration` |
| `integration_slack`, `integration_telegram`, `integration_jira`, `integration_linear`, `integration_jira_dc`, `integration_github`, `integration_msteams`, `integration_mattermost`, `integration_webhook` | object of fields (§6.8), secrets encrypted | Integrations section | `InstanceConfiguration` |

`InstanceSettingKey::branding()` lists every key except `sso_required` today, so the Branding reset would clear the new keys: it becomes an explicit list of the fourteen branding keys.

### 6.2 Users

Two nullable columns on `users`: `deactivated_at` (dateTime) and `last_signed_in_at` (dateTime). No backfill: `last_signed_in_at` stays empty until the next sign-in, shown "—". `last_signed_in_at` is written by a listener of `Illuminate\Auth\Events\Login` (every sign-in path ends in `Auth::login` or Fortify's guard login: password, two-factor, e-mail code, magic link, passkey, SSO, invitation account).

A deactivated account:
- is signed out on its next web request (middleware `EnsureAccountIsActive` in the `web` group, after `StartSession`), with the message "This account is deactivated. Ask an admin of the instance.";
- is refused at the password login (a step `RefuseDeactivatedAccount` added to Fortify's login pipeline through `Fortify::authenticateThrough`, which answers only when the password is right, so the message reveals nothing to someone who does not hold it) with the same message, and at every other sign-in path by the middleware on the request that follows;
- is refused by MCP token authentication (`AuthenticateMcpRequest`) with 401;
- is refused on the broadcast authorisation route;
- receives no alert mail of S4;
- keeps its memberships, tokens and content; reactivation restores everything.

An admin cannot deactivate themselves, and the last active instance admin cannot be deactivated (locked count, as `RevokeInstanceAdmin`).

### 6.3 Version and update check

- `App\Support\InstanceVersion`: `current()` = `config('skrum.version')` trimmed, leading `v` removed; `status()` = `unknown` (check off, never run, or failed), `current`, `outdated` (with `latest`), compared with `version_compare`.
- The Docker image sets the version: `ARG SKRUM_VERSION=dev` → `ENV SKRUM_VERSION`; the workflow passes `${{ steps.meta.outputs.version }}`.
- Update check (decision 10: off by default, a switch in General): command `skrum:check-for-update`, scheduled daily `onOneServer()`; does nothing while the switch is off; one GET to `config('skrum.update_feed')` (default `https://api.github.com/repos/arnaud-ritti/skrum/releases/latest`, a `tag_name`), timeout 5 s; stores `latest_version` and `update_checked_at`; a failure stores nothing new and logs a warning. Turning the switch on runs the check once (queued).

### 6.4 Maintenance details

Decision 9: "Back at" from `artisan down --retry`, the message prepared in General.

- The admin writes the message in General before maintenance (`maintenance_message`, author kept).
- `AddMaintenanceDetailsListener` listens to `MaintenanceModeEnabled`. It reads the payload, the message and its author's name (the database is still reachable when `artisan down` runs), and writes the payload back with a `skrum` key: `{message: ?string, author: ?string, backAt: ?string}` where `backAt` = now + `retry` seconds in ISO 8601 UTC, null without `--retry`. A failure is reported and leaves the payload as it was.
- The 503 view reads `app()->maintenanceMode()->data()['skrum']` only when `app()->isDownForMaintenance()` and only inside `rescue()`; with the cache driver on a database store an unreachable database leaves the block out.
- `artisan down --render=…` pre-renders the page before the event: the block is then absent. The admin docs say to use plain `artisan down --retry=…`.

### 6.5 Team access requests

Table `team_access_requests`: `id` uuid, `team_id` (cascade), `user_id` (cascade), `message` text nullable (≤ 500), `status` string (`TeamAccessRequestStatus`: `pending`, `approved`, `declined`), `decided_by_user_id` nullable (null on delete), `decided_at` dateTime nullable, timestamps; indexes `(team_id, status)`, `(user_id, status)`.

- One pending request per (team, user): enforced in `RequestTeamAccess` under a lock on the team row (rule 6), not by an index (no partial index, rule 5). A second request while one is pending returns the pending one.
- Recipients (decision 8): until TM-6 (plan 23), the owners and admins of the team's workspace, the requester excluded; plan 23 changes `AccessRequestRecipients` only.
- Approve adds the user to the team (`syncWithoutDetaching`) if they still belong to the workspace; otherwise the request is declined and the manager told why. Approve and decline lock the team row then the request; a request answered already returns "already answered" and changes nothing.
- Notifications (database channel, bell): `TeamAccessRequestedNotification` (kind `access_request`, stores the request id) to each recipient; `TeamAccessAnsweredNotification` (kind `access_answered`) to the requester. Presenters read the request live: a recipient who can no longer manage the team, or a request whose team is gone, drops out of the bell as other kinds do.
- A rejected request can be made again (a new row).

### 6.6 Audit log

Decision 4: admin actions and security events, kept 365 days.

Table `audit_events`: `id` uuid, `actor_user_id` nullable (null on delete), `actor_name` string (kept when the actor is deleted), `action` string (`AuditAction`), `subject_type` / `subject_id` nullable strings, `properties` JSON nullable (never a secret, never a value of a configuration field — names only), `ip_address` string(45) nullable, `created_at` dateTime. Index `(created_at, id)`, `(action, created_at)`. Prunable after 365 days (daily `model:prune` already scheduled: add the model).

Actions recorded: admin settings changed (section, keys), **configuration changed** (`ConfigurationUpdated`: section, fields changed, fields cleared, `alertSent`), branding reset, instance admin granted / revoked, user deactivated / reactivated, MCP token revoked by an admin, SSO connection tested, test e-mail sent, `sso_required` changed; sign-in succeeded, sign-in failed (address folded, no password), two-factor enabled / disabled, password changed, MCP token created / revoked by its owner.

### 6.7 Status

Decision 5: public, states only.

`App\Support\Status\InstanceStatus::check(): array` returns one row per component `{key, state}` with `state` ∈ `operational`, `degraded`, `down`, `not_configured`, `maintenance`:

| Component | Check | States |
|---|---|---|
| Application | the page answered; in maintenance → `maintenance` | operational / maintenance |
| Database | `User::query()->exists()` inside `rescue` | operational / down |
| Cache | put then get a random value under `skrum.status.probe` | operational / down |
| Queue | heartbeat `skrum.heartbeat.queue` written by the job `RecordQueueHeartbeat`, dispatched every minute by `skrum:heartbeat` | < 3 min operational, < 15 min degraded, else or never down |
| Scheduler | heartbeat `skrum.heartbeat.scheduler` written by `skrum:heartbeat` | same thresholds |
| Real time | `broadcasting.default` is `reverb`: TCP connect to `broadcasting.connections.reverb.options.host:port`, 1 s timeout; `null` or `log` → not configured | operational / down / not configured |
| E-mail | `mail.default` (after §6.8 is applied) not `log` / `array` | operational / not configured |

Heartbeats live in the cache. Overall: "All systems operational", "Some systems are degraded", "Maintenance in progress". No detail beyond the state is public.

### 6.8 Instance configuration (SSO, SMTP, integration apps)

Decision 1, answer B. One `InstanceSettingKey` per section; its value is a JSON object holding only the fields the admin stored; a secret field holds `Crypt::encryptString(value)`.

**Catalogue** (`App\Support\InstanceConfiguration\ConfigurationCatalogue`, one `match` over the sections): each field names its configuration keys, whether it is secret, and its rules. `*` = secret.

| Section (key) | Field → configuration keys written |
|---|---|
| `sso_google` | `client_id` → `services.google.client_id`; `client_secret`* → `services.google.client_secret` |
| `sso_github` | `client_id`, `client_secret`* → `services.github.*` |
| `sso_entra` | `tenant`, `client_id`, `client_secret`* → `oidc.connections.entra.*` **and** `services.oidc_entra.*` |
| `sso_oidc` | `base_url` (https), `client_id`, `client_secret`*, `label` → `oidc.connections.generic.*` **and** `services.oidc_generic.*` |
| `smtp` | `mailer` (`smtp` or `log`) → `mail.default`; `host`, `port` (1–65535), `scheme` (`smtp` / `smtps` / none), `username`, `password`* → `mail.mailers.smtp.*` (a stored `host` also sets `mail.mailers.smtp.url` to null, so `MAIL_URL` does not override it); `from_address` (e-mail), `from_name` → `mail.from.*` |
| `integration_slack` | `client_id`, `client_secret`* → `services.slack.*` |
| `integration_telegram` | `bot_token`* → `services.telegram.bot_token` |
| `integration_jira` | `client_id`, `client_secret`* → `services.jira.*` |
| `integration_linear` | `client_id`, `client_secret`*, `webhook_secret`* → `services.linear.*` |
| `integration_jira_dc` | `base_url` (https), `client_id`, `client_secret`*, `personal_tokens` (bool) → `services.jira_dc.*` |
| `integration_github` | `app_id`, `slug`, `client_id`, `client_secret`*, `private_key`* (PEM, ≤ 16 KB), `webhook_secret`* → `services.github_app.*` |
| `integration_msteams` | `enabled` (bool), `allowed_hosts` (list of host names) → `services.msteams.*` |
| `integration_mattermost` | `url` (https) → `services.mattermost.url` |
| `integration_webhook` | `enabled` (bool) → `services.outgoing_webhooks.enabled` |

**Reading.** `InstanceConfiguration::value(section, field)` = the stored value (decrypted for a secret) or the environment baseline. `InstanceConfiguration::describe(section)` gives the page, per field: the value (non-secret only), `source` (`stored` / `environment` / `none`), `secretSet` for a secret, and `unreadable` when a stored secret fails to decrypt (S7).

**Baseline.** `InstanceConfigurationBaseline` holds the configuration values of every catalogue key as the process booted them (the environment). It is captured once per process in `AppServiceProvider::boot()` (reads `config()`, writes nothing) and never changes.

**Applying.** `InstanceConfiguration::apply()` writes, for every catalogue field, the stored value or the baseline value into its configuration keys, then forgets resolved mailers (`MailManager::forgetMailers()`) and Socialite drivers (`SocialiteManager::forgetDrivers()`) when resolved. It runs:
- per web request, by the global middleware `ApplyInstanceConfiguration` (after `AssignRequestId`, before routing, so the login page's provider buttons, the integration callbacks and the inbound webhooks see it);
- per queued job, by `ApplyInstanceConfigurationListener` on `Illuminate\Queue\Events\JobProcessing` (a worker keeps its configuration between jobs: each job starts from the stored values, and a cleared field returns to the baseline);
- per console command, by the same listener on `Illuminate\Console\Events\CommandStarting` (the scheduler's `schedule:run` included).
Nothing is written into `config()` at boot. A failure (unreadable settings, unreachable cache) is caught without being reported; the configuration stays as it was (the environment on a fresh request), and the page renders. The keys the last `apply()` wrote are kept in `config()` itself (`skrum.instance_configuration.applied`), so a field cleared since the previous job of a worker returns to its baseline value, and a configuration key that a test or an operator set directly, and that is not stored, is left alone.

**Writing.** `UpdateInstanceConfiguration::handle(User $admin, InstanceSettingKey $section, array $values, array $clear, string $ip): ConfigurationChange` — the only writer. It validates against the catalogue, keeps a blank secret (S6), encrypts secrets (S5), refuses a change that leaves no SSO provider while `sso_required` is on (S9), and — under a cache lock per section (`Cache::lock`, as `IntegrationTokens` does), so that two admins saving different fields of one section keep both — stores in one transaction with the `ConfigurationUpdated` audit event (S3), and after commit sends the alert of S4 for SSO and SMTP sections. The fresh confirmation (S2) is checked by the Form Request before the action runs.

`SsoProvider` and `IntegrationProvider` keep reading `config()`: no enum gains a new dependency for this (the arch rule on enums is unchanged by §6.8).

## 7. Permissions

| Who | What |
|---|---|
| Instance admin (`is_instance_admin`), password confirmed | every admin section, read and write |
| Instance admin with a confirmation younger than 300 s | writes of the SSO providers, SMTP and integration apps (S2) |
| Active instance admins | receive the alert mail of S4 |
| Anyone, signed in or not, guests included | the status page |
| Signed-in user | the version line on error pages (decision 6); none on the static 503 and the status page |
| Signed-in member of the workspace, not in the team | the access-request block on a 403 of that team or of its sessions; `POST …/access-requests` |
| Signed-in non-member of the workspace, a guest, a visitor | the plain 403 page: no team, no names |
| Workspace owner or admin (until TM-6) | receives the request; approves or declines it |
| Requester | receives the outcome |

## 8. Real time

No new channel. Bell arrivals use the existing `NotificationReceived` on `user.{id}` (fired by `BroadcastNotificationReceivedListener` for every database notification). The 403 page does not listen: the requester learns the outcome in the bell.

## 9. Screens

All admin sections render inside `AdminShell` (spec ruling 14 of the front rewrite: the mockup's navigation column inside the app layout). Topbar: "Self-host" badge, and on editable sections the mockup's "n unsaved changes · Cancel · Save" (the Branding pattern). Mobile: the navigation becomes the "Section" select (exists); tables become stacked cards.

**Configuration forms (SSO, SMTP, integration apps).** Shared behaviour: each field shows its source under it ("From the environment" muted / "Saved here" / nothing when empty); a secret field is the mockup's masked input with its eye (P29-02 obsolete): always empty; a secret that is set shows the mockup's dots as the placeholder with the help line "Saved. Leave blank to keep it." (or its environment source); the eye switches between hidden and shown **what the admin typed** — no stored secret ever reaches the browser to be revealed (rule S5) — and is disabled while the field is empty; a stored field has a "Use the environment value" link (clears it); while the confirmation is older than 300 s the form shows the line "Confirm your password to change these settings." with a "Confirm" button (the existing confirmation page, back to the section) and its fields are read-only; a save answered with the `confirmation` error keeps the typed values (secrets excepted) and shows the same line; the section card says in its footer "Every change is recorded in the audit log and mailed to every instance admin." (SSO, SMTP) or "Every change is recorded in the audit log." (integrations); an unreadable secret shows the S7 warning `Alert`.

### 9.1 Admin navigation (`AdminShell`)

Groups "Instance" (General, Branding, SSO authentication [badge "active" when `ssoInForce`], SMTP, Integrations [badge "n/m" enabled/configured], MCP keys, Licence) and "Supervision" (Users, Admins, Audit log). Footer card: host, then "v1.8.2 · up to date" / "· update available: v1.9.0" / version alone (§6.3). "Admins" stays (existing feature; the mockup has no such entry: pre-build deviation P29-01). `/admin` redirects to General.

States: active entry (`aria-current`), badges, version unknown, update available (warning text, not colour alone).

### 9.2 General (`admin/general`)

Three cards (`.st-card` pattern): **Sign-up** (radio: invitation only / open / allowed domains + domain chips input; the environment value shown as default), **Maintenance message** (textarea 280, preview line "Shown on the maintenance page from the next `artisan down`", author and date of the saved message, "Clear"), **Updates** (version, switch "Check for new versions once a day" — off by default —, with the sentence "The instance asks GitHub once a day; nothing about the instance is sent.", last check result). States: saved, unsaved, validation errors, check failed.

### 9.3 SSO authentication (`admin/sign-in`, extended)

Above the existing `sso_required` form: one card per provider (Google, GitHub, Microsoft Entra, OIDC) in the mockup's form layout, **editable** (decision 1 B): status badge (Configured / Not configured), the fields of §6.8 (issuer/base URL, tenant, client ID, label, client secret), the redirect URI read-only with Copy, the environment variable name of each field as a hint; "Save" per card (the card's own form; the topbar shows the unsaved count of the card being edited); "Test the connection" on Entra and OIDC (fetches the discovery document of the values in force; result alert "Connected · 184 ms · issuer …" or the error; last result kept). As the mockup: the secret with its eye (shared form behaviour above); the row "Keep sign-in by e-mail as fallback" — "For the admin if the provider is unavailable." — with a switch drawn on and locked, its second help line "Instance admins can always sign in with their password." (the third-round break-glass is not a setting: the switch changes nothing); the card footer "Secret changed :relative", the time of the latest `ConfigurationUpdated` event that changed the provider's `client_secret` (§6.6; shown only while the secret is stored here, absent once the event is pruned). One card per existing provider where the mockup draws one (P29-13, existing features kept). Shared form behaviour above.

### 9.4 SMTP (`admin/mail`)

Editable card (decision 1 B): mailer (SMTP / "Don't send: write mails to the log"), host, port, encryption (none / TLS on connect `smtps` / STARTTLS when offered `smtp`), user, password (write-only, the mockup's masked field with its eye), sender address and name; status badge "Operational" (a delivering mailer) or "Not configured (mails are written to the log)"; "Save". "Send a test e-mail" (address, default the admin's) uses the configuration in force (saved values first: save, then test); result line "Last test delivered today at 14:02" / "Last test failed at 14:02: the server refused the connection" (the exception class mapped to a sentence; never the server's raw answer). Throttled 5 per 10 minutes. Shared form behaviour above.

### 9.5 Integrations (`admin/integrations`)

One row per provider (`.st-int`): mark, name, state "Available · n teams connected" / "Not configured" / "Turned off", "Configure" (ghost; opens the provider's credentials dialog with its §6.8 fields and the redirect or webhook URL to copy; shared form behaviour), and a switch (enabled only when configured). Turning a provider off hides it from team settings and stops its deliveries and polls (`isEnabled()` false), keeping the team integrations; turning it back on resumes them. Confirm dialog before turning off a provider that teams use. Saving credentials that make a used provider unconfigured (a cleared client id) asks the same confirmation. The mockup's "Connecté · workspace atlas-corp · #atlas-retro" is a team-level state: replaced by the teams count (P29-03).

### 9.6 MCP keys (`admin/mcp-keys`)

Table: name, owner (avatar, name), fingerprint `skrum_…{token_hint}` (Sanctum's `token_prefix` is `skrum_`, `token_hint` the last four characters), scopes as `code` chips, team, created (date · owner), last used (relative, "Never"), expires; "Revoke" (destructive text, confirm dialog naming the owner). 25 per page, newest first. "Create a key" links to the admin's own token settings (`settings/api-tokens`). MCP turned off in the environment: an alert "The MCP server is off (`SKRUM_MCP_ENABLED`)", list still shown. Empty state.

### 9.7 Licence (`admin/licence`) — decision 2, answer B with AGPL-3.0

Card "Skrüm" with the licence badge "AGPL-3.0" (`config('skrum.licence')`, a constant of the project, not an environment variable), the sentence "Open source under the GNU Affero General Public License v3.0; every feature is included.", "Accounts in use" = active (not deactivated) users, no seat limit, no expiry, links "Licence text" (the repository's `LICENSE`) and "Source code" (the repository). No progress bar (no limit to measure against: P29-04).

The project's declared licence changes from MIT to AGPL-3.0 (the owner's legal decision): `composer.json` `"license": "AGPL-3.0-only"` (the SPDX identifier of "AGPL-3.0"), a `LICENSE` file at the repository root holding the unmodified GNU AGPL v3 text, and `config('skrum.licence')` = `AGPL-3.0`; a test keeps the three in agreement.

### 9.8 Users (`admin/users`)

Decision 3: list, search, deactivate, reactivate. Search (name or address, the `AdminCandidatesController` technique), filter All / Active / Deactivated / Admins; table: avatar, name, address, badges (Admin, Deactivated, 2FA on), workspaces count, created, last sign-in; row menu: Deactivate / Reactivate (confirm dialog; refused for self and for the last active admin, the reason shown), "Make admin" opens the Admins flow. 25 per page, newest first. Empty search state.

### 9.9 Audit log (`admin/audit-log`)

Table: when (relative, exact on hover), actor (avatar or "System"), action sentence (translated per `AuditAction`), subject, IP. Filters: action group (Settings, Accounts, Sign-in, Tokens; `ConfigurationUpdated` is in Settings), actor search; 50 per page, newest first; "Kept 365 days" note. Empty state.

### 9.10 Error pages

- Header: "Instance status" link (to `/status`) on 403, 404, 419, 429, 500 and 503. "Help" not built.
- Footer: "name · v1.8.2" for signed-in users only (decision 6; 500 page: from config, no shared props). The static 503 and the status page show no version.
- 403 with a known team (§6.5), decision 7 "as the mockup": overline "Error 403 · Access denied", title "You don't have access to this team", team block (pastille with the initial, name, "workspace · n members"), "You're signed in as **email**. Ask for access and a team admin will review it.", optional message (textarea 500), "Request access" (primary), "Switch account" (ghost), "Team admins: A, B" with avatars (three at most, then "+n"). After sending: toast and a disabled "Request sent". A request already pending: the block opens in the sent state. A failure keeps the form with the error.
- 403 without a known team, or for a non-member of the workspace: unchanged.

### 9.11 503 page (static)

Header: logo, "Instance status" link (`/status`, served during maintenance). Main: as today, plus the "Back at" block (`skrum-info-soft`): time in display size, "your time (zone) · in about n min" — computed by the existing inline script in the browser's time zone from `<time datetime>`; without script the UTC time is shown; a past time reads "Any moment now". Then the admin's message in quotes with the author ("Hugo Lambert, instance admin"). Without `--retry` and without message: the page as today. The busy-database 503 shows neither block. The mockup's "Your admin is installing version 1.9.0" is not built: the target version is not known (P29-05). Footer: name, no version (decision 6). Still one inline script, no external asset.

### 9.12 Status page (`/status`)

No mockup: built from the 503 page's frame (same static head, logo, card list). Title "Instance status", overall sentence, list of components with an icon and the state in words (not colour alone), "Checked at hh:mm UTC", "Refresh" link, link "Back to my teams" (`/`). Language from `Accept-Language` like the 503 page. Served outside the `web` middleware group (no session, no CSRF, no cookie) and excepted from maintenance mode. No version, host or timing.

### 9.13 Bell

Two kinds added to `NotificationsPanel`: `access_request` — actor avatar, "**Nadia** asks to join **Atlas**", the message excerpt, inline "Add to the team" (primary sm) and "Decline" (ghost sm); answered state "Added by Camille" / "Declined by Camille", buttons removed — and `access_answered` — team tile, "You were added to **Atlas**" (links to the team) or "Your request to join **Atlas** was declined".

### 9.14 Alert mail (S4)

`InstanceConfigurationChangedMail` on the existing branded mail layout: subject "SSO settings changed on :instance" / "SMTP settings changed on :instance"; body: ":name (:email) changed :section on :date at :time UTC from :ip.", the list of field labels changed and cleared, the sentence "If no admin made this change, sign in, check the section and change your password.", a button to the section. Informal, four languages, in each recipient's locale.

## 10. Migrations of existing data

None. New tables and nullable columns only; no row is rewritten. Environment values keep working: every new setting and every configuration field falls back to its environment value when not stored. `InstanceSettingKey::branding()` becomes explicit so that a Branding reset clears the same keys as before.

## 11. Routes

| Method, URL | Name | Controller |
|---|---|---|
| GET `admin` | `admin.index` | redirect to General |
| GET/PUT `admin/general` | `admin.general.edit` / `.update` | `Admin\GeneralSettingsController` |
| PUT `admin/sign-in/providers/{provider}` | `admin.ssoProviders.update` | `Admin\SsoProvidersController` |
| POST `admin/sign-in/tests` | `admin.ssoTests.store` | `Admin\SsoConnectionTestsController` |
| GET/PUT `admin/mail` | `admin.mail.show` / `.update` | `Admin\MailSettingsController` |
| POST `admin/mail/tests` | `admin.mailTests.store` | `Admin\MailTestsController` (throttle 5,10) |
| GET/PUT `admin/integrations` | `admin.integrations.edit` / `.update` | `Admin\IntegrationSettingsController` (on/off) |
| PUT `admin/integrations/{provider}/app` | `admin.integrationApps.update` | `Admin\IntegrationAppsController` (credentials) |
| GET `admin/mcp-keys`, DELETE `admin/mcp-keys/{token}` | `admin.mcpKeys.index` / `.destroy` | `Admin\McpKeysController` |
| GET `admin/licence` | `admin.licence.show` | `Admin\LicencesController` |
| GET `admin/users` | `admin.users.index` | `Admin\UsersController` |
| POST/DELETE `admin/users/{user}/deactivation` | `admin.userDeactivations.store` / `.destroy` | `Admin\UserDeactivationsController` |
| GET `admin/audit-log` | `admin.auditEvents.index` | `Admin\AuditEventsController` |
| POST `w/{workspace}/teams/{team}/access-requests` | `teams.accessRequests.store` | `TeamAccessRequestsController` (throttle 5,60) |
| PATCH `w/{workspace}/teams/{team}/access-requests/{accessRequest}` | `teams.accessRequests.update` | `TeamAccessRequestsController` |
| GET `status` | `status.show` | `StatusPagesController` (routes/status.php, no `web` group) |

The three configuration writes (`admin.ssoProviders.update`, `admin.mail.update`, `admin.integrationApps.update`) carry the clearing of fields as `clear: string[]` in the same request.

## 12. Testing

- Feature tests per route: admin access (non-admin 403, unconfirmed password redirect), each section's props, each write and its audit event, validation.
- Configuration (§5.1, §6.8): each rule S2 to S9 has its named test; stored values reach `config()` on the next request, in a queued job (a `JobProcessing` dispatched on a worker-like loop that changes the setting between two jobs) and in an artisan command; clearing returns to the baseline; the OIDC values reach `services.oidc_generic`; a mailer resolved before the change is not reused after it; the middleware survives an unreachable database and cache; nothing is applied at boot (a fresh application's `config()` equals the environment after boot with stored values present).
- Licence: `composer.json` `license` = `AGPL-3.0-only`, `LICENSE` starts with "GNU AFFERO GENERAL PUBLIC LICENSE" and "Version 3, 19 November 2007", `config('skrum.licence')` = `AGPL-3.0`.
- Error pages: the 403 block for each denied route kind (team page, retro, poker game, whiteboard, team survey, game room), absent for a non-member of the workspace, a guest, a visitor, and on a 403 that is not about a team (closed registration); the 500 page carries the version without shared props; the 503 page in maintenance with `--retry=1800` and a message, without them, with an unreachable database, and the busy 503; still one inline script.
- Status page with each component down (fakes), in maintenance, with an unreachable database, without a session cookie set.
- Races (`tests/Concurrency`, `Race`, on PostgreSQL in this plan; the other engines in the roadmap's final matrix): two access requests of one user at once make one pending row; an approve and a decline of one request at once give one outcome; deactivating the last two active admins at once leaves one; two admins saving different fields of one configuration section at once keep both fields.
- Upgrade: none (no data migration).
- Vitest for `AdminShell`, each section container (the configuration forms' write-only secrets and their eye on typed text only, sources, clear links, confirmation line; the SSO card's locked fallback switch and "Secret changed" line), the access-request block, the two bell kinds, the version line.
- Captures (light, 1440, French) of the nine admin sections, the 403 with the block (both states), the 503 with "Back at" and message, the status page. No browser walkthrough.

## 13. Acceptance criteria

1. A non-admin gets 403 on every `admin/*` route; an admin without a recent password confirmation is sent to confirm it.
2. `AdminShell` lists, in this order, General, Branding, SSO authentication, SMTP, Integrations, MCP keys, Licence under "Instance" and Users, Admins, Audit log under "Supervision", each linking to its page; `/admin` opens General.
3. The admin footer shows the host and `v` + `config('skrum.version')`; with the update check on and a newer `latest_version`, "update available: vX"; with the same version, "up to date"; with the check off or never run, the version alone.
4. Saving General stores the sign-up mode and the domains; `SignupGate` then follows the stored mode (open, invite, domain) over the environment; clearing them returns to the environment value.
5. With the update check on, `skrum:check-for-update` stores the release's version without its `v` and the time; a failing or non-JSON answer stores nothing and does not throw; with the check off (the default) it makes no request.
6. A Branding reset leaves every non-branding key (the keys of §6.1 that are not branding, and `sso_required`) in place.
7. The SSO section shows each provider's state, the value and source of each non-secret field, "set"/"not set" for the secret and the redirect URI, without any secret in the props; saving a provider stores its fields (secret encrypted), and the login page's provider buttons and the Socialite driver use them on the next request; "Test the connection" on a configured Entra or OIDC provider tests the values in force and reports success with the issuer and the time, or the failure, records an audit event, and makes no request for an unconfigured provider.
8. The SMTP section shows the mail configuration in force without the password, with each field's source; saving stores it and the next mail of the instance goes through it; a test e-mail is sent synchronously to the given address through the configuration in force, its result stored and shown; a transport failure is shown as a sentence; the sixth test within 10 minutes is refused.
9. Turning a configured provider off makes `IntegrationProvider::isEnabled()` false for it (team settings hide it, its callbacks answer 404 through `EnsureIntegrationProviderEnabled`), keeps every `team_integrations` row, and turning it back on restores it; an unconfigured provider cannot be turned on; saving a provider's app credentials in its dialog makes it configured on the next request, in queued jobs and in the scheduler's commands.
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
20. Error pages show the version to signed-in users only; the 500 page shows it without shared props; the static 503 and the status page show none.
21. The Docker image built by the workflow reports its release version in `config('skrum.version')`.
22. Every new string exists in en, fr, es, de, informal (`InformalRegisterTest`, `TranslationKeysTest` pass); the captures of §12 have no horizontal overflow and are compared with their mockup, each difference fixed or a row of the plan's deviations table.
23. Unit, feature, arch and concurrency suites pass on PostgreSQL through `bin/test-db`, and `tests/Arch/DatabasePortabilityTest.php` passes (Eloquent and the query builder only). The run on SQLite, MariaDB and MySQL belongs to the roadmap's four-engine matrix after plans 24 and 25 (owner, 2026-10-03), not to this plan's acceptance.
24. A stored configuration field applies over the environment on the next web request, in the next queued job of a running worker and in an artisan command; clearing it returns each of them to the environment value; no stored value is in `config()` right after boot; with unreadable settings or an unreachable cache the environment values apply and the page renders.
25. Rule S5: a secret is stored encrypted (the raw row differs from it and decrypts to it) and appears in none of the page props, the flashed session, the audit rows, the alert mail and the log; rule S6: a blank secret keeps the stored one; rule S7: a secret encrypted under another `APP_KEY` falls back to the environment and the section shows the warning.
26. Rule S2: a configuration write with a confirmation older than 300 s is refused with the `confirmation` error and stores nothing, also for an account without a known password; one younger than 300 s is accepted.
27. Rules S3 and S4: every configuration write records one `ConfigurationUpdated` event with the field names and no value; every SSO or SMTP write mails each active instance admin once (none to a deactivated admin), through the mail configuration in force before the change, naming the author, the IP, the section and the fields, without any value; a failed alert keeps the change, sets `alertSent: false` and warns the author; an integration-app write mails nobody.
28. Rule S9: while `sso_required` is on, a write that leaves no SSO provider enabled is refused and stores nothing. Rule S8: the catalogue holds no field for the environment-only keys.
29. Rule S1: an instance admin can store an OIDC issuer, client id and secret and an SMTP host and password from the admin (the accepted risk is a feature, not a defect).
30. `composer.json` declares `AGPL-3.0-only`, `LICENSE` holds the GNU AGPL v3 text, and the Licence card shows "AGPL-3.0" with the accounts in use and the links to the licence text and the source.
31. (P29-02 obsolete) Every single-line secret field (SSO, SMTP, integration apps) is the mockup's masked input: empty, the dots as placeholder when a secret is set, an eye that shows and hides only what the admin typed and is disabled while the field is empty; no prop or HTML ever holds a stored secret. Each SSO card shows the locked, checked "Keep sign-in by e-mail as fallback" switch and, while its secret is stored here, "Secret changed :relative" from the latest audit event that changed that secret (none for an environment or cleared secret).

## 14. Risks

- **Accepted: admin takeover of SSO accounts and of password-reset mails (S1).** The owner accepted it on 2026-10-03 with the safeguards S2 to S9. The residual risk: a stolen admin session plus a fresh confirmation (or a stolen admin password) is enough; the alert mail tells the other admins after the fact, it does not prevent the change. An instance with a single admin gets the alert in that admin's own mailbox.
- **Configuration applied per request, per job, per command.** A path that runs outside the three (a long-running process other than the queue worker, e.g. Reverb, or a closure scheduled in-process before `CommandStarting` fires) keeps the environment values. Reverb reads none of the catalogue keys; the test list covers the queue worker and the scheduler. A worker started before an `APP_KEY` change cannot decrypt: rule S7.
- **The OIDC package's boot copy.** Writing only `oidc.connections.*` would leave the Socialite driver on the environment values: the catalogue writes both places, and a test builds the driver's redirect URL from a stored base URL.
- **Mailers and Socialite drivers resolved before the overlay.** Octane forgets them between requests; a queue worker does not: `apply()` forgets them itself.
- **The alert sent through the previous configuration.** When the previous mailer is `log`, the alert lands in the log only; the toast and the audit event still record the change.
- **Plan 26's rule S-1 and S2.** Plan 26 lets an account without a known password act in its account settings without any confirmation, passkey registration included, and keeps the admin area out of that rule. An instance admin born by SSO, with no password, can therefore register a passkey from a stolen session without confirming, then use that passkey to satisfy S2 here. The two accepted risks add up for that one kind of account. Ruled 2026-10-03 (second revision pass, §17 item 11): accepted as the sum of two risks the owner accepted after they were spelled out; S4's alert mail is the detection; the owner may overturn it. Plans 26 and 29 run in the same wave: the plan that merges second adds the test "an admin without a known password and without a confirmation cannot save SSO" (S2 still holds when no passkey was registered).
- **Many sign-in paths.** Deactivation relies on a middleware for the paths that do not go through Fortify's pipeline: one request is served after such a sign-in before the sign-out. Acceptable for a deactivation (not a security boundary against an attacker holding the password); the test list covers each path.
- **The OIDC connection test reaches the URL the admin typed.** The test (§9.3) makes the server fetch the stored issuer's discovery document, which the OIDC driver fetches anyway at sign-in; it reports reachability, timing and whether the reply looks like OIDC. It follows no redirect, so it cannot be bounced to an address the admin did not type, but it does not apply the outgoing-webhook private-network guard (S8): a trusted admin may point SSO at an identity provider on the private network. Accepted under S1 (review of Tasks 11 to 20).
- **Timing of a deactivated account's sign-in.** For an address that belongs to a deactivated account, the login pipeline checks the password hash once to tell its holder the account is deactivated, and again further down when the password is wrong; for other addresses it checks it once. The response time can therefore hint that an address belongs to a deactivated account. Accepted (review of Tasks 11 to 20): the message itself speaks only to whoever holds the password, and Fortify's pipeline already answers an unknown address faster than a known one.
- **Octane.** Settings are read per request through `InstanceSettings` (container-scoped, cached); the configuration overlay is written per request into Octane's per-request configuration clone, never at boot; the baseline is immutable.
- **Information on the 403 page.** The team's name and its managers' names are shown to a workspace member who is not in the team (decision 7). Today such a member does not see that team's name anywhere.
- **Access-request spam.** One pending request per team and user, 5 requests an hour per user, and a decline that does not block a new request; a manager can ignore it.
- **The status page under load or with a dead database.** It is public and unthrottled (the throttle reads the cache, which is the database by default). Each check is bounded (TCP 1 s; the database connect timeout is the driver's) — a hanging database connection makes the page slow, as `/up` is today.
- **Update check.** An outbound call from a self-hosted instance (off by default) to a repository whose public availability is not known (§17).
- **The arch rule on enums.** `IntegrationProvider::isEnabled()` must read the instance setting `disabled_integrations`: the enum is added to the `ignoring` list of the arch test beside `McpFeature`, as the precedent says ("asks the container").
- **Maintenance with `--render`.** The pre-rendered page has no "Back at" block (§6.4).
- **Licence change.** Relicensing from MIT to AGPL-3.0 is the owner's legal decision; the plan changes the declaration and adds the text, nothing else (no file headers, no notice in the interface beyond the Licence card). What AGPL §13 asks of an instance that modifies the code (offering its source to network users) is the deployer's duty; whether Skrüm should show a "Source code" link to every user is §17.
- **Size.** Nine admin sections, three editable configuration sections with their safeguards, the error and status pages, a request flow and the bell: four back-end lanes and a screen step (37 tasks).
- **Engines verified late.** Each plan runs PostgreSQL only; SQLite, MariaDB and MySQL run once after the last plan of the roadmap (owner, 2026-10-03). A portability slip in this plan (a JSON or lock difference) is found then; the arch test and the Eloquent-only rule are the guard until then.

## 15. Rollout

One deploy. The migrations add columns and tables only. After the deploy the admin sees the new sections with environment values as defaults; nothing changes for users until an admin saves a setting. The first save of an SSO or SMTP field mails every instance admin (S4).

## 16. Decisions for the owner — answered 2026-10-03

The body is written on these answers. The plan's table "Owner decisions" lists them with the tasks they shaped.

1. **Where SSO, SMTP and integration-app settings live — answered B (≠ recommendation A).** Editable, stored encrypted in `instance_settings`, the environment as fallback, applied per request and per queued job (and per console command). The owner confirmed after the takeover risk was spelled out, with safeguards: password confirmation, audit of every change, mail to every instance admin when SSO or SMTP changes. Written as §5.1 (S1 to S9) and §6.8.
2. **Licence section — answered B, with AGPL-3.0 (≠ recommendation on the licence value).** An informational card naming AGPL-3.0; the project's declared licence changes from MIT (`composer.json` `license`, a `LICENSE` file to match): the owner's legal decision. §9.7.
3. **What the Users section can do — answered B (recommendation).** List, search, deactivate and reactivate (§6.2).
4. **What the audit log records — answered B (recommendation).** Admin actions plus security events, kept 365 days (§6.6).
5. **Status page audience and detail — answered A (recommendation).** Public, states only (§6.7, §9.12).
6. **Who sees the version line on error pages — answered B (recommendation).** Signed-in users only; none on the static 503 and the status page (§9.10).
7. **What the 403 page shows a workspace member who is not in the team — answered A (recommendation).** As the mockup: team name, member count, the managers' names and avatars (§9.10).
8. **Who receives an access request before team roles exist — answered B (recommendation).** The workspace's owners and admins until plan 23 (§6.5).
9. **"Back at" and the maintenance message — answered A (recommendation).** `artisan down --retry` plus the message prepared in General (§6.4).
10. **The update check — answered B (recommendation).** Off by default, a switch in General (§6.3).

Pre-build deviations — answered 2026-10-03: "Admins" stays as a section (P29-01, approved); P29-02 **obsolete** (SSO and SMTP are editable): the secret fields follow the mockup — masked, with the eye on what is typed — and the SSO card carries the locked fallback switch and "Secret changed" (§9.3); the Integrations rows show the instance-level state and teams counts (P29-03, as recommended); the Licence progress bar is not drawn (P29-04, approved); the 503 sentence naming the target version is not built (P29-05, as proposed); the host stays in the nav footer (P29-11, as proposed); the configuration forms carry a source line per field, a confirmation line and the audit/alert sentence (P29-12, approved); the four SSO provider cards (P29-13, existing features kept). Rows P29-06 to P29-10 approved as listed.

## 17. Not determined by reading

1. ~~The licence of the project~~ — answered: AGPL-3.0 (decision 2). Ruled 2026-10-03 (second pass): "AGPL-3.0-only", the SPDX reading of the owner's "AGPL-3.0"; no "Source code" link for every user (the owner asked for an informative licence card; offering the source of a modified instance is the deployer's duty under AGPL §13). The owner may overturn either.
2. Whether `github.com/arnaud-ritti/skrum` is public and publishes releases with `tag_name` (the update check's source).
3. Whether Reverb answers a TCP connect on `broadcasting.connections.reverb.options.host:port` from inside the container (the client-facing address may differ from the server's bind address `reverb.servers.reverb`).
4. Whether every passkey sign-in fires `Illuminate\Auth\Events\Login` (the passkey package's guard call); the plan's test proves it or adds a listener on the package's event.
5. Whether `EnsureAccountIsActive` placed in the `web` group also runs on the broadcast authorisation route (`BroadcastAuthorizationsController` is a web route; to check in Task 13).
6. Whether Fortify's default login pipeline in the installed version is the one the plan extends (`authenticateThrough` with a step before the two-factor redirect); the plan re-reads `AuthenticatedSessionController::loginPipeline`.
7. Whether `TeamSurvey` and `GameRoom` routes bind their models before their middleware abort (true for `retro`, `game`, `board`; to check for `teamSurvey` and `room`).
8. The size of the `lang/*.json` conflicts between lanes.
9. How each integration client reads its configuration: at call time (`config()` inside the method, as `SlackClient`, `JiraClient`… appear to) or once in a constructor of a long-lived object; a client built once per worker would keep old credentials. Task 18 re-reads each of the 13 classes that read `services.*` and lists any that cache.
10. Whether `CommandStarting` fires before a scheduled closure (`Schedule::call`) runs inside `schedule:run`; Task 18 checks it.
11. Plans 26 and 29 together: under plan 26's S-1 an SSO-born instance admin without a password registers a passkey with no confirmation, and that passkey then satisfies S2 for the SSO and SMTP settings. Ruled 2026-10-03 (second pass): accepted, as the sum of two risks the owner accepted separately after they were spelled out (§14); no extra rule on recent passkeys. The owner may overturn it; it does not block the build.
