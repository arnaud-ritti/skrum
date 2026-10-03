# Plan 29: administration sections and error pages — report

Branch `plan-29-administration-errors` (worktree `.claude/worktrees/rm29`), cut from `main` at `0c294632`. Spec:
`docs/superpowers/specs/2026-10-21-plan-29-administration-errors-design.md`; plan:
`docs/superpowers/plans/2026-10-21-plan-29-administration-errors.md`. Final run on 2026-10-03 on the code of `a66fbeb6`
(Task 35); the commit after it adds this report only. Not pushed; `main` and `roadmap` untouched.

The controller runs the plan's tasks in numeric order on this one branch (lanes flattened), so this report is written
**after Tasks 1 to 35 and before Task 37** ("Secret changed" on the SSO cards, numbered last but planned for lane C). The
back-end half of criterion 31 therefore waits for Task 37 (§2). The plan asked for the report in
`.superpowers/sdd/plan-29/report.md`; that folder is excluded from git (`.git/info/exclude`), so the report sits beside
the earlier plans' reports in `docs/superpowers/research/`, as plan 27 did.

## 1. Result

One command at a time in the shared application container `skrum-laravel.test-1`, database `testing_l29`
(`TEST_DB_DATABASE=testing_l29`, `TEST_DB_WORKDIR=/var/www/html/.claude/worktrees/rm29`). PostgreSQL only (owner,
2026-10-03): SQLite, MariaDB and MySQL run in the roadmap's final four-engine matrix, not here.

| Run | Result |
|---|---|
| `bin/test-db pgsql` with `TEST_DB_PROCESSES=4` (Unit, Feature, Upgrade, Arch, `--parallel --processes=4`) | `PASS, Tests: 2 skipped, 6409 passed (56870 assertions)` |
| `bin/test-db pgsql --concurrency` | `PASS, Tests: 1 skipped, 31 passed (133 assertions)` |
| `composer types:check` (PHPStan) | `passed`, 0 errors |
| `vendor/bin/pint --format agent` | `passed`, nothing changed |
| `npm run test` (Vitest) | `406 files, 4258 tests passed` |
| `npm run types:check`, `npm run check` | no error; 1132 files formatted, no lint warning in 1115 files |
| `vp build`, then `wayfinder:generate --with-form` | built; nothing to commit afterwards |

`TranslationKeysTest`, `InformalRegisterTest` and `tests/Arch/DatabasePortabilityTest.php` passed inside the whole
suite. Browser walkthroughs and smoke tests were not run (owner's rule); the captures are those of Task 34
(`tests/visual/__screenshots__/admin-*`, `access-error-*`, `status-page-*`, light, 1440, French).

For the roadmap's four-engine matrix, this plan's race files are `tests/Concurrency/TeamAccessRequestTest.php`,
`tests/Concurrency/LastActiveAdminTest.php` and `tests/Concurrency/InstanceConfigurationTest.php`.

## 2. Acceptance criteria (spec §13)

Every PHP test named here ran in the whole PostgreSQL suite above, unless the row says concurrency. Vitest files ran
once in `npm run test`.

| # | Criterion | Proved by |
|---|---|---|
| 1 | 403 for a non-admin on `admin/*`; confirmation asked | `AdminAccessTest` ("answers 403 to a signed-in user who is not an instance admin", "asks an admin to confirm their password before the pages and every change", "changes nothing when a non-admin posts to the admin area"); each section's "…for instance admins only" case (`UsersSectionTest`, `LicenceTest`, `AuditLogTest`, `MailSectionTest`, `SsoSectionTest`) |
| 2 | `AdminShell` order and links; `/admin` opens General | `AdminAccessTest` "redirects the admin home to the general page"; `GeneralSettingsTest` "opens general from /admin…"; `admin-shell.test.tsx` (order, groups, links, version line); captures |
| 3 | Footer version and update status | `InstanceVersionTest` (four cases); `LastSignInTest` "shares the update status with instance admins only"; `updates-card.test.tsx`; commit `2e4c7e75` (a branch or local build is "unknown") |
| 4 | Sign-up mode and domains stored, followed by `SignupGate`, cleared back to the environment | `GeneralSettingsTest` ("stores the sign-up mode, which the sign-up gate then follows", "returns to the environment sign-up mode once the stored one is cleared", "lets in a stored allowed domain over the environment list") |
| 5 | Update check: stores the version without `v` and the time; failures store nothing; off makes no request | `UpdateCheckTest` (four cases) |
| 6 | A Branding reset leaves the other keys | `InstanceSettingKeyTest` "lists the branding keys explicitly…"; `GeneralSettingsTest` "leaves the general settings in place on a branding reset"; `ConfigurationStorageTest` "leaves a stored configuration section in place on a branding reset" |
| 7 | SSO section: state, sources, no secret; save used next request; connection test | `SsoSectionTest` ("describes each provider with its sources and without any secret", "S1: lets an instance admin store an issuer, a client id and a secret, used on the next request", "tests the discovery document of the values in force", "…of Microsoft Entra for its tenant", "does not follow a redirect…", "reports an issuer that does not match and a failure", "refuses to test a provider that is not configured or not testable"); `ApplyInstanceConfigurationTest` ("applies stored fields on the next web request, and the login page offers the provider", "gives the OIDC driver the stored issuer"); `provider-card.test.tsx`, `connection-test-result.test.tsx`, `sign-in.test.tsx` |
| 8 | SMTP section, save, test e-mail, failure sentence, sixth test refused | `MailSectionTest` ("shows the mail configuration in force without the password", "S1: stores an SMTP host and password that the next mail of the instance uses", "sends a test e-mail now and keeps the result", "turns a transport failure into a sentence", "refuses the sixth test within ten minutes", …); `mail-settings-card.test.tsx`, `mail-test-form.test.tsx`, `mail.test.tsx` |
| 9 | Integration on/off keeps team rows, callbacks 404, unconfigured cannot be turned on; app credentials for requests, jobs and commands | `IntegrationSettingsTest` ("turns a configured provider off and on, keeping the team integrations" with the callback's 404, "refuses to turn on a provider that is not configured", "configures a provider from its app credentials, for requests and for queued jobs, without mailing the admins"); `ApplyInstanceConfigurationTest` "applies the configuration when a console command starts"; `integration-row.test.tsx`, `integration-app-dialog.test.tsx` |
| 10 | MCP keys list and revoke, audited with the owner | `McpKeysTest` (three cases); `AuditLogTest` "names the owner of a key an admin revoked"; `mcp-keys-table.test.tsx`, `revoke-key-dialog.test.tsx` |
| 11 | Users list, filters; deactivation enforced; self and last admin kept, also at once | `UsersSectionTest` (five cases); `UserDeactivationTest` (ten cases: next request, password login, MCP 401, broadcast 403, memberships, reactivation, self and last active admin); concurrency `LastActiveAdminTest` (two cases); `users-table.test.tsx`, `deactivate-dialog.test.tsx`, `user-filters.test.tsx` |
| 12 | `last_signed_in_at` on password, SSO, magic link, e-mail code (and passkey) | `LastSignInTest` (five "stamps the time…" cases) |
| 13 | One audit event per action, no secret; page newest first, 50, filters; 365-day pruning | `AuditLogTest` (21 cases, among them "prunes events older than the retention", "lists audit events newest first, 50 a page, filtered by group", "filters the audit events by actor", "records a sign-in and a failed sign-in without the password"); `audit-table.test.tsx`, `audit-filters.test.tsx`, `audit-action-label.test.tsx` |
| 14 | 403 with the team block for a workspace member on a team and its retro, poker, whiteboard, survey, game room; plain 403 otherwise | `ForbiddenTeamPageTest` ("offers access to the team behind every denied page of a workspace member" with the six-page dataset, "names no team and nobody to a stranger to the workspace", "offers nothing on a 403 that is not about a team"); `access-request-block.test.tsx`, `error.test.tsx` |
| 15 | One pending request (two at once give one), managers notified, sent state, member refused | `RequestTeamAccessTest` (four cases); `ForbiddenTeamPageTest` "opens in the sent state when a request is pending"; `AccessRequestNotificationsTest` "notifies every manager in the bell and answers pending"; concurrency `TeamAccessRequestTest` "makes one pending request when the same person asks twice at once" |
| 16 | Approve adds and tells; decline; approve and decline at once; already answered; requester gone | `AnswerTeamAccessRequestTest` (four cases); `AccessRequestNotificationsTest` ("lets a manager approve, then tells the requester", "answers 422 to a second answer", "tells the manager why an approval became a decline…"); concurrency `TeamAccessRequestTest` "gives one outcome to an approval and a decline at once" |
| 17 | Bell kinds and texts; dropped when the reader can no longer manage | `AccessRequestNotificationsTest` "drops the request from the bell of a manager who lost the right"; `notifications-panel.test.tsx`, `use-notifications.test.ts`. A deleted team is dropped by `PresentAccessRequestNotifications` (the request goes with its team); no test names that case |
| 18 | 503 "Back at" and message; neither without them, nor on the busy 503; one inline script, unreachable database | `ErrorPagesTest` ("shows the time of return and the admin message in maintenance", "shows neither block without --retry and without a message", "shows neither block on the busy-database 503, even in maintenance", "leaves the details out when the maintenance store is the unreachable database", "gives the static 503 view one inline script…"); `MaintenanceDetailsTest` (four cases) |
| 19 | `/status` 200, in maintenance, with an unreachable database, no session; linked from error pages | `StatusPageTest` (five cases); `InstanceStatusTest` (seven cases); `ApplyInstanceConfigurationTest` "renders the status page with an unreachable database"; `ErrorPagesTest` "links every error page to the status page" |
| 20 | Version to signed-in users only, 500 included; none on 503 and status | `ErrorPagesTest` "shows the version to a signed-in viewer only, the 500 page included"; `LastSignInTest` "shares the version with a signed-in user only"; `error.test.tsx` |
| 21 | Docker image reports its release version | `Dockerfile` (`ARG SKRUM_VERSION`) and `.github/workflows/docker-image.yml` (`build-args: SKRUM_VERSION=…`); `InstanceVersionTest` "reads the configured version without its leading v". No image was built here: unverified end to end |
| 22 | Four languages, informal; captures without overflow, compared | `TranslationKeysTest`, `InformalRegisterTest`; Task 34 captures (harness overflow check passed); Task 35 rows P29-14 to P29-23 |
| 23 | PostgreSQL suites and `DatabasePortabilityTest` | §1 |
| 24 | Stored field applies per request, job, command; clearing returns; nothing at boot; unreachable database renders | `ApplyInstanceConfigurationTest` (nine cases, among them "lets a queue worker see a change, and a clearing, between two jobs", "writes nothing into the configuration at boot", "does not reuse a mailer or a Socialite driver resolved before a change"). Unreadable settings or an unreachable cache: the middleware and the listener run `apply()` inside `rescue()`; only the unreachable database is tested |
| 25 | S5, S6, S7 | see §3 |
| 26 | S2 | see §3 |
| 27 | S3, S4 | see §3 |
| 28 | S9, S8 | see §3 |
| 29 | S1 | see §3 |
| 30 | AGPL-3.0 declared; Licence card | `LicenceDeclarationTest`; `LicenceTest` "names the AGPL-3.0 and counts active accounts only on the licence card"; `licence-card.test.tsx` |
| 31 | Masked secret field with its eye; locked fallback switch; "Secret changed" | `secret-field.test.tsx`, `email-fallback-row.test.tsx`, `provider-card.test.tsx` ("Secret changed 3 days ago" from `secretChangedAt`). The back end (`SecretChangeTimes`, the `secretChangedAt` prop) is **Task 37, not built yet**: until it runs the prop is absent and the line does not show; the `admin-sso-stored-secret` capture lacks it for that reason |

## 3. Security rules S1 to S9 (spec §5.1)

| Rule | Tests |
|---|---|
| S1 accepted risk | `SsoSectionTest` "S1: lets an instance admin store an issuer, a client id and a secret, used on the next request"; `MailSectionTest` "S1: stores an SMTP host and password that the next mail of the instance uses" |
| S2 fresh confirmation (300 s) | `ConfigurationRoutesTest` "S2: refuses a write whose confirmation is older than five minutes, also for an account without a known password", "S2: accepts a write confirmed less than five minutes ago"; `ConfigurationSafeguardsTest` "S2: counts a confirmation as fresh for 300 seconds only"; `confirmation-line.test.tsx` |
| S3 audit with names only | `ConfigurationSafeguardsTest` "S3: records one audit event with the field names and no value", "records nothing and mails nobody when nothing changes" |
| S4 alert mail | `ConfigurationSafeguardsTest` "S4: mails every active instance admin once, naming the author and the fields, never a value", "S4: sends the alert of an SMTP change through the mail configuration in force before it", "S4: keeps the change and records it when the alert cannot be sent", "S4: mails nobody for an integration app, which is audited" |
| S5 secrets never in clear | `ConfigurationStorageTest` "stores a secret encrypted and reads it back", "describes a section without any secret value"; `ConfigurationRoutesTest` "S5: keeps no secret in the session after a refused write"; `SsoSectionTest` "describes each provider with its sources and without any secret"; `McpKeysTest` "…with a fingerprint and no secret"; `use-configuration-form.test.tsx` (secrets emptied after a save, commit `4831fcc1`) |
| S6 blank secret keeps the stored one | `SsoSectionTest` "S6: keeps the stored secret when the field is left blank"; `ConfigurationStorageTest` "keeps the stored secret when the new one is blank, and clears a field on request" |
| S7 environment fallback, unreadable secret | `ConfigurationStorageTest` "falls back to the environment value field by field", "treats a secret encrypted under another key as not stored and says so"; `SsoSectionTest` "returns a field to the environment value"; `ApplyInstanceConfigurationTest` "lets a queue worker see a change, and a clearing, between two jobs" |
| S8 environment-only keys | `ConfigurationStorageTest` "has no field for the environment-only keys of rule S8" |
| S9 no lock-out | `ConfigurationSafeguardsTest` "S9: refuses a change that leaves no SSO provider while SSO is required" |

## 4. Deviations added

Task 35 added rows **P29-14 to P29-23** to the plan's pre-build deviations table, each "found at capture (Task 35),
reported to the owner": the SSO card's badge instead of an "Activée" switch (P29-14), the connection test without claims
(P29-15), a Save pair per SSO card (P29-16), stacked SSO fields, the OIDC label and the `sso_required` card (P29-17), the
SMTP mailer choice and two sender fields (P29-18), nine integration providers with letter tiles (P29-19), MCP keys' team
and expiry columns and real scopes (P29-20), General, Users and Audit log built from the spec (P29-21), the 403 message
as a textarea (P29-22), the 503 overline, title and local time (P29-23). None read by the owner yet.

## 5. Found different from the plan

- **Integration clients (spec §17.9, Task 18).** Every client that reads `services.*` reads it at call time:
  `SlackClient`, `JiraClient`, `JiraDataCenterClient`, `JiraDataCenterServer`, `LinearClient`, `GitHubClient`,
  `GitHubAppJwt`, `TelegramClient`, `TelegramBot` (its cached bot name is keyed by a hash of the token in force),
  `ReadInboundEvent`, `InboundModes`, `MattermostWebhookUrl`. None caches credentials in a constructor, and none is a
  container singleton, so none needed a change.
- **Scheduler (spec §17.10, Task 18).** `ApplyInstanceConfigurationListener` listens to `JobProcessing` and
  `CommandStarting`. `CommandStarting` fires for `schedule:run`, so scheduled closures run with the configuration
  applied at the start of that run (`schedule:work` starts a new `schedule:run` every minute). Tested through
  "applies the configuration when a console command starts".
- The stored configuration is applied after the maintenance check (commit `e16205e3`), so a request maintenance turns
  away reads no stored configuration ("reads no stored configuration for a request that maintenance turns away").
- Revoking the last *active* admin is refused even while a deactivated admin remains (commit `4d7e2c65`), and saving an
  unchanged maintenance message keeps its author.
- A test e-mail while mails go to the log sends nothing and is kept as failed (commit `4831fcc1`).
- The report's path (§ introduction).

## 6. Open points (spec §17)

| # | Point | State |
|---|---|---|
| 1 | Licence | answered: AGPL-3.0-only (decision 2) |
| 2 | Is `github.com/arnaud-ritti/skrum` public with releases (`tag_name`)? | still open; the check is off by default and stores nothing on a failure |
| 3 | Reverb answers a TCP connect from inside the container? | still open (needs a running deployment); `InstanceStatusTest` covers "down" when nothing listens |
| 4 | Passkey sign-in fires `Login` | answered: yes, `LastSignInTest` "stamps the time of a passkey sign-in" |
| 5 | `EnsureAccountIsActive` on the broadcast route | answered: `UserDeactivationTest` "refuses the broadcast authorisation of a deactivated account" |
| 6 | Fortify login pipeline | answered by Task 13: the password login is refused only with the right password |
| 7 | Survey and game room bind before abort | answered: `ForbiddenTeamPageTest` dataset holds both |
| 8 | `lang/*.json` conflicts | none: lanes flattened on one branch |
| 9 | Integration clients reading `services.*` | answered, §5 |
| 10 | `CommandStarting` before scheduled closures | answered, §5 |
| 11 | Plans 26 and 29 together (passkey without confirmation satisfies S2) | ruled 2026-10-03, accepted; the owner may overturn it |

Still to run: **Task 37** ("Secret changed" back end), then the roadmap's four-engine matrix.
