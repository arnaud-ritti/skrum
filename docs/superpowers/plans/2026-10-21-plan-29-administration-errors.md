# Administration sections and error pages (Plan 29) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development to run this plan task by task (through the Workflow tool, as the project does). Steps use checkbox (`- [ ]`) syntax. Every agent reads **Owner decisions**, **Global Constraints**, **Pre-build deviations** and its own task before anything else, then `docs/database.md` ("Rules for database code" and "Running the tests on an engine") for any task that touches PHP. A screen task also follows the "Screen task procedure" of `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md`, with the working rules below (no walkthrough, captures in Task 30 only).

**Status: draft of 2026-10-03, written on the recommended option of every decision of spec §16.** Nothing starts before the owner has read spec §16 and the pre-build deviations.

**Goal:** The instance admin gets the nine sections of the mockup (General, Branding, SSO, SMTP, Integrations, MCP keys, Licence, Users, Audit log, plus the existing Admins), the instance shows its version and, on request, whether it is up to date, a public status page exists, a workspace member who meets a 403 on a team can ask for access through the bell, and the 503 page shows "Back at" and the admin's message.

**Architecture:** New instance settings go through `App\Support\InstanceSettings` (stored value over environment default). Two new tables (`team_access_requests`, `audit_events`) and two nullable `users` columns. The status page and the 503 page are static Blade views outside the `web` middleware group or rendered by the exception handler, so they survive a dead database. Maintenance details are written into Laravel's maintenance payload by a listener of `MaintenanceModeEnabled`, so the 503 page reads no database. The access request rides on the bell (database notifications, presenters per kind).

**Tech Stack:** Laravel 13, PHP 8.4, Fortify, Sanctum, Pest (feature, unit, arch, concurrency), Inertia 3, React 19, Tailwind 4, vite-plus (Vitest), Wayfinder, Reverb; PostgreSQL, MariaDB, MySQL and SQLite through `bin/test-db`; `Tests\Concurrency\Support\Race`. Run `composer show --direct` and read `package.json` before Task 1; stop if a major differs from this list.

**Spec:** `.superpowers/sdd/roadmap/plan-29/spec.md` (moves to `docs/superpowers/specs/2026-10-21-administration-and-error-pages-design.md` in Task 31). Mockups: `docs/design-system/components/ScreenSettings` (frame b), `ScreenErrors`, `NotificationsPanel`, `Table`, `Pagination`, `Badge`, `Sidebar` — for each, the `README.md` and the `preview.html`.

**Not in this plan:** spec §3 (backlog): the "Help" link, editable secrets, licence keys, deleting users, uptime history, team roles, revoked-token rows, the former plans 28 and 30, scheduling. Browser walkthroughs (owner's rule: none is written or run).

**Tasks:** 32. Step A0, single writer: 1 to 3. Step A, back end, three lanes: V (4 to 8), R (9 to 11), U (12 to 18). Step B, screens: 19 (single writer), then lanes (20 to 28). Final: 29 (translations), 30 (captures), 31 (deviations and documents), 32 (four-engine suites and report).

## Branch and run

- Base: `main` at or after `18d3637e` (front rewrite, database portability, plan 19). Check before Task 1 and stop if one fails: `app/Support/InstanceSettings.php` exists; `app/Http/ErrorPageResponder.php` has `Statuses = [403, 404, 419, 429, 500]`; `resources/views/errors/503.blade.php` holds the comments `Place left (AD-2)`, `(AD-3)`, `(AD-5)`; `resources/js/components/auth/error-page.tsx` has the props `headerLinks`, `accessRequest`, `version`; `bin/test-db` exists and `bin/test-db pgsql -- tests/Arch` passes; `tests/Concurrency/Support/Race.php` exists.
- Branch `plan-29-admin-errors` from that base. Never push; never merge into `main` (the owner merges).
- Lanes run in git worktrees on branches `lane/29-<name>`, cut from the head named in **Lanes**; the controller merges one lane at a time and runs the gates after each merge: `npm run types:check`, `npm run check`, `npm run build:front`, `vendor/bin/pint --dirty --format agent`, `vendor/bin/sail composer types:check`, and `bin/test-db pgsql -- tests/Feature/Admin tests/Feature/ErrorPagesTest.php tests/Feature/TeamAccessRequests tests/Arch`.
- From a worktree, `bin/test-db` needs `TEST_DB_CONTAINER` and `TEST_DB_WORKDIR`; MariaDB and MySQL are started once with `docker compose up -d mariadb mysql`. Never run two whole suites at once in the shared container.
- **Every task re-reads the files it touches**; a line or a body quoted here that no longer matches is followed in spirit and reported.

## Owner decisions

The ten questions of spec §16. "Plan written on" is the recommended option. The last column says what changes with another answer.

| # | Question | Plan written on | If the owner answers otherwise |
|---|---|---|---|
| 1 | Where SSO, SMTP and integration-app settings live | **A**: environment, read-only sections with tests | **B**: six tasks more after Task 18: encrypted keys in Task 1 (`oidc_*`, `google_*`, `github_*`, `entra_*`, `mail_*`, per-provider client id and secret), `ApplyInstanceConfiguration` middleware and a `JobProcessing` listener that set `config()` per request and per job and `Mail::purge()`, editable forms in Tasks 21, 22, 23; P29-02 disappears. **C**: the same for SMTP and integrations, Task 21 unchanged |
| 2 | Licence | **B**: informational card | **A**: drop the Licence half of Tasks 18 and 26 and its nav entry in Task 19. **C**: a new plan |
| 3 | Users section | **B**: list, search, deactivate, reactivate | **A**: Task 13 keeps only `last_signed_in_at` and the listing; Task 25 drops the row menu. **C**: Task 13 adds `Admin\UsersController@destroy` over `App\Actions\Fortify\DeleteUser` (re-read its workspace checks) and Task 25 a typed-name dialog |
| 4 | Audit scope | **B**: admin actions and security events | **A**: Task 2 drops the security listeners. **C**: Task 2 adds hooks in `TeamMembersController`, `WorkspaceMembersController`, `WorkspaceInvitationsController`, `TeamsController@destroy` |
| 5 | Status page | **A**: public, states only | **B**: Task 7 puts the route in the `web` group behind `can:manageInstance`; the error-page link shows to admins only (Tasks 8, 27). **C**: Task 6 returns timings and heartbeat times; Task 7 renders them |
| 6 | Version on error pages | **B**: signed-in users; none on 503 and status | **A**: Task 11 sends the version to everyone; Task 8 prints it in the 503 footer. **C**: Task 11 checks `manageInstance` |
| 7 | 403 team block content | **A**: the mockup (team, count, managers) | **B**: Task 11 drops `managers`; Task 27 drops the avatars line. **C**: Task 11 sends no team; Task 27 renders the form alone |
| 8 | Recipients before TM-6 | **B**: workspace owners and admins | **A**: Tasks 9 to 11, 27 and 28 move to after plan 23. **C**: `AccessRequestRecipients` filters on `WorkspaceRole::Owner` |
| 9 | "Back at" and message | **A**: `--retry` and the stored message | **B**: Task 5 becomes a `skrum:down` command (`DownWithDetailsCommand`), Task 12 drops the message card. **C**: both, the command's options win |
| 10 | Update check | **B**: off by default, switch in General | **A**: drop the check half of Task 4 and the switch of Tasks 12 and 20. **C**: `InstanceSettings::DefaultUpdateCheckEnabled = true` |

## File structure

Back end, created:

| File | Responsibility |
|---|---|
| `app/Support/InstanceVersion.php` | current version, update status |
| `app/Console/Commands/CheckForUpdateCommand.php` | `skrum:check-for-update` |
| `app/Jobs/CheckForUpdate.php` | runs the check once when the switch is turned on |
| `app/Support/Maintenance/MaintenanceDetails.php` | reads and writes the `skrum` key of the maintenance payload |
| `app/Listeners/AddMaintenanceDetailsListener.php` | attaches message, author and back-at at `artisan down` |
| `app/Support/Status/InstanceStatus.php`, `ComponentState.php` (enum in `app/Enums/StatusComponentState.php`) | the status checks |
| `app/Console/Commands/HeartbeatCommand.php`, `app/Jobs/RecordQueueHeartbeat.php` | heartbeats |
| `routes/status.php`, `app/Http/Controllers/StatusPagesController.php`, `resources/views/status.blade.php`, `resources/views/partials/static-page-head.blade.php` | status page and the head shared with the 503 page |
| `database/migrations/2026_10_21_100000_create_team_access_requests_table.php`, `app/Models/TeamAccessRequest.php`, `database/factories/TeamAccessRequestFactory.php`, `app/Enums/TeamAccessRequestStatus.php` | access requests |
| `app/Actions/Teams/RequestTeamAccess.php`, `AnswerTeamAccessRequest.php`, `AccessRequestRecipients.php`, `ResolveDeniedTeam.php`, `PresentAccessRequestOffer.php` | access-request flow |
| `app/Notifications/TeamAccessRequestedNotification.php`, `TeamAccessAnsweredNotification.php`, `app/Actions/Notifications/PresentAccessRequestNotifications.php` | bell |
| `app/Http/Controllers/TeamAccessRequestsController.php`, `app/Http/Requests/TeamAccessRequestStoreRequest.php`, `TeamAccessRequestUpdateRequest.php` | HTTP |
| `database/migrations/2026_10_21_100100_create_audit_events_table.php`, `app/Models/AuditEvent.php`, `database/factories/AuditEventFactory.php`, `app/Enums/AuditAction.php`, `app/Actions/Admin/RecordAuditEvent.php`, `app/Listeners/RecordSignInListener.php`, `RecordFailedSignInListener.php`, `RecordSecurityChangeListener.php` | audit log |
| `database/migrations/2026_10_21_100200_add_activity_columns_to_users_table.php`, `app/Actions/Admin/DeactivateUser.php`, `ReactivateUser.php`, `app/Http/Middleware/EnsureAccountIsActive.php`, `app/Actions/Fortify/RefuseDeactivatedAccount.php` | users |
| `app/Http/Controllers/Admin/GeneralSettingsController.php`, `SsoConnectionTestsController.php`, `MailSettingsController.php`, `MailTestsController.php`, `IntegrationSettingsController.php`, `McpKeysController.php`, `LicencesController.php`, `UsersController.php`, `UserDeactivationsController.php`, `AuditEventsController.php` | admin HTTP |
| `app/Http/Requests/Admin/GeneralSettingsUpdateRequest.php`, `MailTestStoreRequest.php`, `SsoConnectionTestStoreRequest.php`, `IntegrationSettingsUpdateRequest.php`, `UsersIndexRequest.php`, `AuditEventsIndexRequest.php` | validation |
| `app/Actions/Admin/TestOidcDiscovery.php`, `PresentSsoProviders.php`, `PresentMailSettings.php`, `PresentIntegrationSettings.php`, `PresentMcpKeys.php`, `PresentAuditEvents.php` | section data |
| `app/Mail/InstanceTestMail.php`, `resources/views/mail/instance-test.blade.php` | test e-mail |

Back end, modified: `app/Enums/InstanceSettingKey.php`, `app/Support/InstanceSettings.php`, `app/Enums/IntegrationProvider.php`, `app/Actions/Auth/SignupGate.php`, `app/Http/ErrorPageResponder.php`, `app/Http/Middleware/HandleInertiaRequests.php`, `app/Http/Middleware/AuthenticateMcpRequest.php`, `app/Providers/FortifyServiceProvider.php`, `app/Actions/Notifications/ListNotifications.php`, `app/Models/User.php`, `app/Http/Controllers/Admin/BrandingController.php`, `AdminsController.php`, `SignInSettingsController.php`, `app/Actions/Mcp/IssueMcpToken.php`, `RevokeMcpToken.php`, `bootstrap/app.php`, `routes/admin.php`, `routes/web.php`, `routes/console.php`, `config/skrum.php`, `resources/views/errors/503.blade.php`, `Dockerfile`, `.github/workflows/docker-image.yml`, `tests/Arch/ArchTest.php` (one `ignoring` entry).

Front end, created: `resources/js/pages/admin/{general,mail,integrations,mcp-keys,licence,users,audit-log}.tsx`; `resources/js/components/admin/{general,sso,mail,integrations,mcp-keys,licence,users,audit-log}/*` with tests; `resources/js/components/auth/access-request-block.tsx` and test; `resources/js/lib/admin/types.ts`.
Front end, modified: `resources/js/components/admin/admin-shell.tsx`, `resources/js/pages/admin/sign-in.tsx`, `resources/js/components/admin/sign-in-settings-form.tsx`, `resources/js/components/auth/error-page.tsx`, `resources/js/pages/errors/error.tsx`, `resources/js/components/skrum/notifications-panel.tsx`, `resources/js/hooks/use-notifications.ts`, `resources/js/types/*` (shared `instanceVersion`).

Tests, created: `tests/Unit/Support/InstanceVersionTest.php`; `tests/Feature/Admin/{GeneralSettingsTest,UpdateCheckTest,SsoSectionTest,MailSectionTest,IntegrationSettingsTest,McpKeysTest,LicenceTest,UsersSectionTest,UserDeactivationTest,AuditLogTest}.php`; `tests/Feature/MaintenanceDetailsTest.php`, `StatusPageTest.php`; `tests/Feature/TeamAccessRequests/{RequestTeamAccessTest,AnswerTeamAccessRequestTest,AccessRequestNotificationsTest,ForbiddenTeamPageTest}.php`; `tests/Concurrency/{TeamAccessRequestTest,LastActiveAdminTest}.php`; `tests/Browser/Visual/AdminAndErrorPagesVisualTest.php` (captures only).

## Lanes

| Lane | Tasks | Cut from | Files shared with another lane (merge by hand, append-only) |
|---|---|---|---|
| A0 (single writer) | 1, 2, 3 | base | — |
| V — version, maintenance, status | 4, 5, 6, 7, 8 | head after Task 3 | `routes/console.php` (U: none), `bootstrap/app.php` (none other), `config/skrum.php` (U: Task 18 adds `licence`), `lang/*.json`, `app/Http/Middleware/HandleInertiaRequests.php` (R: none; U: none) |
| R — access requests | 9, 10, 11 | head after Task 3 | `routes/web.php` (none other), `app/Http/ErrorPageResponder.php` (V: none — Task 11 also adds `version`), `tests/Pest.php` (helpers), `lang/*.json` |
| U — admin back end | 12 to 18 | head after Task 3 | `routes/admin.php` (only U), `app/Enums/InstanceSettingKey.php` (done in Task 1), `config/skrum.php` (V), `lang/*.json`, `tests/Pest.php` |
| S0 (single writer) | 19 | head after the three back-end lanes are merged | — |
| S-admin | 20, 21, 22, 23 | head after Task 19 | `lang/*.json`, `resources/js/lib/admin/types.ts` (append) |
| S-super | 24, 25, 26 | head after Task 19 | `lang/*.json`, `resources/js/lib/admin/types.ts` |
| S-errors | 27, 28 | head after Task 19 | `lang/*.json` |
| Final (single writer) | 29 to 32 | head after all screen lanes | — |

`lang/en.json`, `fr.json`, `es.json`, `de.json` are touched by every lane: each lane adds its keys in one sorted block; the controller resolves conflicts by keeping both blocks, then re-sorts with the existing script if one exists (re-read `package.json` scripts), else by hand.

## Global Constraints

- **Mockup first** (parent spec §5 rule 13). A screen follows its mockup: layout, placement, labels, states. A difference is fixed, or is a row of **Pre-build deviations**, put to the owner before its screen is built. Captures are taken once, in Task 30, in light, at 1440, in French, and compared with the mockup's `preview.html` in Task 31.
- **Front rules** of the parent spec §5 on every front file: tokens only, rem, Tailwind scale (no arbitrary size), no overflow from 20rem to 60rem, visible focus, contrast, motion with `prefers-reduced-motion`, lucide icons, the literal call shape `t('…')`, presentational `skrum/` components (no network, no Echo, no router). Containers in `resources/js/components/<domain>/`. Reuse: `AdminShell`, `ui/table`, `ui/pagination`, `ui/switch`, `ui/radio-group`, `ui/textarea`, `ui/badge`, `ui/alert`, `ui/dialog`, `settings/settings-card` (the `.st-card` pattern), `auth/error-page`, `skrum/notifications-panel`, `useHttp` for JSON calls.
- **Database (owner rule): Eloquent and the standard query builder only.** `docs/database.md` rules 1 to 12 apply to every line of PHP, migration and test; `tests/Arch/DatabasePortabilityTest.php` enforces them. No raw query of any form, no driver test, Schema-builder migrations with `up` only, `dateTime()` for non-null times, UUID keys, no partial index, lock the aggregate root first in a transaction, explicit tie-breakers, `Alphabetical::sort` for lists read by people on bounded sets, JSON compared with `toBeIgnoringKeyOrder`.
- **Tests per task on two engines, four at merges.** Every task runs the tests it wrote or touched on PostgreSQL and SQLite: `bin/test-db pgsql -- <paths>` and `bin/test-db sqlite -- <paths>`. Races (`tests/Concurrency`) run with `bin/test-db <engine> --concurrency` on `pgsql`, `mariadb`, `mysql` and `sqlite-file`, never in memory, never in parallel. Whole suites on the four engines at each lane merge and in Task 32. The red step may run once on SQLite in memory: `vendor/bin/sail artisan test --compact <path>`.
- **Working rules (owner):** unit, feature, arch and concurrency tests are written and run; Vitest is written and run (`npm run test -- <pattern>` per task, the whole suite in Task 32); no browser walkthrough is written, edited or run; captures only (Task 30), light / 1440 / French.
- **No new dependency**, PHP or JS, without the owner's approval. The OIDC test uses `Http`, the status probe `stream_socket_client`, the test mail `Mail`.
- **Four languages, informal.** Every new `__('…')` and `t('…')` key goes to `lang/en.json`, `fr.json`, `es.json`, `de.json` in the commit that introduces it (`tests/Feature/TranslationKeysTest.php`), informal (French "tu", Spanish "tú", German "du"; `tests/Feature/InformalRegisterTest.php`), the static 503 and status pages included. In `en.json` the value is the key.
- **No test is deleted** without the owner's approval.
- Controllers: plural name, CRUD method names only (`tests/Arch/ArchTest.php`). Route names camelCase, URLs kebab-case, tuple notation. Form Requests with array rules. Every rendered page has its file under `resources/js/pages` (`tests/Arch/FrontEndPagesTest.php`). Create files with `vendor/bin/sail artisan make:… --no-interaction`.
- Arch facts: enums use nothing of the application except `McpFeature` (Task 16 adds `IntegrationProvider` to that `ignoring` list, the only arch change); models do not use `App\Actions`, `App\Http`, `App\Mcp`; actions do not use `App\Http`; `App\Support`, jobs and events do not use `App\Http` or `App\Mcp`; no class is `final`; commands carry the `Command` suffix; listeners the `Listener` suffix.
- PHP style: early returns, no `else`, happy path last, typed everything, PascalCase constants, constructor promotion, no comment that restates code; `vendor/bin/pint --dirty --format agent` and `vendor/bin/sail composer types:check` (PHPStan) before each commit.
- Octane is installed: no static or per-request singleton state in new classes; nothing new is written into `config()` at boot.
- Front gates after every task that touches the front: `npm run types:check`, `npm run check`, `npm run build:front` (also regenerates Wayfinder after a new route).
- One commit per task, in the repository's style (`feat(admin): …`, `feat(errors): …`, `feat(teams): …`, `test: …`), ending with:

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE
```

## Review Focus

1. **A 403 that names a team to someone outside its workspace.** `ResolveDeniedTeam` must return null unless the viewer belongs to the team's workspace; Task 11 tests a non-member opening `w/{other}/teams/{team}` and `retros/{retro}` of another workspace and asserts no `accessRequest` prop and no team name in the HTML.
2. **A deactivated user who still holds a session or a token.** Task 13 tests the next web request (redirect to login, session gone), an MCP call (401), and the broadcast auth route (403).
3. **A Branding reset that wipes the new settings.** Task 1 tests that `InstanceSettingKey::branding()` holds none of the new keys and Task 12 that a reset leaves `signup_mode` stored.
4. **The 503 and status pages with an unreachable database and a database cache store.** Tasks 7 and 8 run them inside `withUnreachableDatabase()` with `app.maintenance.driver=cache` on the `database` store and assert a 503 / 200 page without the details block.
5. **A secret leaking into props or the audit log.** Tasks 2, 14 and 15 assert that the JSON of the page props and of every `audit_events.properties` row contains none of the configured secret strings.

---

## Pre-build deviations

Put to the owner before the screen is built. Reasons: **F** false or unsafe, **N** no such data or concept, **S** this spec, **O** an owner's answer.

| # | Screen | Mockup element | Built | Reason |
|---|---|---|---|---|
| P29-01 | Admin nav | no "Admins" entry | "Admins" kept under Supervision, after Users | existing feature kept |
| P29-02 | SSO, SMTP | editable fields, "eye" on the secret, Save | read-only values, "Set" badge for a secret, env variable names as hint; Save only for `sso_required` | S: decision 1 A |
| P29-03 | Integrations | "Connected · workspace atlas-corp · #atlas-retro", "Configure", "Connect" | "Available · n teams connected", "Not configured" with the env hint, a switch | N: those are team-level states and actions |
| P29-04 | Licence | "Skrüm Entreprise", seats progress 38/50, expiry, "Update the key" | licence name, accounts in use, "every feature included", no progress, no key | N: decision 2 B |
| P29-05 | 503 | "Your admin is installing version 1.9.0" | not rendered; the existing sentence stays | N: the target version is not known |
| P29-06 | 403, 404, 500, 503 | "Help" link | not rendered | roadmap backlog |
| P29-07 | Error pages | version in the footer for everyone | signed-in users only; none on 503 and status | S: decision 6 B |
| P29-08 | MCP keys | revoked row struck and greyed | not rendered (revoke deletes) | plan 26 backlog |
| P29-09 | MCP keys | "skr_live_…9f2a" | `skrum_…9f2a` | F: the real prefix |
| P29-10 | Status page | no mockup | built from the 503 frame | N |
| P29-11 | Admin topbar | domain `retro.atlas-corp.fr` in the topbar | host in the nav footer (as today) | existing (18e) |

---

## Step A0 — single writer

### Task 1: Instance setting keys

**Files:**
- Modify: `app/Enums/InstanceSettingKey.php`, `app/Support/InstanceSettings.php`
- Test: `tests/Feature/InstanceSettingsTest.php` (exists: re-read, add cases), `tests/Unit/Enums/InstanceSettingKeyTest.php` (create)

**Interfaces:**
- Produces: `InstanceSettingKey::{SignupMode, AllowedEmailDomains, MaintenanceMessage, MaintenanceMessageBy, UpdateCheckEnabled, LatestVersion, UpdateCheckedAt, DisabledIntegrations, MailLastTest, SsoLastTest}`; `InstanceSettings::signupMode(): ?string` (stored only), `allowedEmailDomains(): ?array`, `maintenanceMessage(): ?string`, `maintenanceMessageBy(): ?string`, `updateCheckEnabled(): bool`, `latestVersion(): ?string`, `updateCheckedAt(): ?string`, `disabledIntegrations(): array<int, string>`, `mailLastTest(): ?array`, `ssoLastTest(): ?array`; `InstanceSettings::DefaultUpdateCheckEnabled = false`.

- [ ] **Step 1: Write the failing tests**

```php
<?php
// tests/Unit/Enums/InstanceSettingKeyTest.php

use App\Enums\InstanceSettingKey;

it('lists the branding keys explicitly, without the keys of the other sections', function () {
    expect(array_map(fn (InstanceSettingKey $key): string => $key->value, InstanceSettingKey::branding()))->toBe([
        'brand_color', 'brand_radius', 'display_name', 'powered_by', 'logo_light', 'logo_dark', 'favicon',
        'logo_mail', 'avatar_style', 'avatar_member_choice', 'gif_provider', 'gif_enabled', 'gif_rating', 'gif_key',
    ]);
});
```

Add to `tests/Feature/InstanceSettingsTest.php`:

```php
use App\Enums\InstanceSettingKey;
use App\Support\InstanceSettings;

it('stores the sign-up mode only when it is one of the three modes', function () {
    $settings = resolve(InstanceSettings::class);

    $settings->set(InstanceSettingKey::SignupMode->value, 'open');
    expect(resolve(InstanceSettings::class)->signupMode())->toBe('open');

    expect(fn () => $settings->set(InstanceSettingKey::SignupMode->value, 'everyone'))
        ->toThrow(InvalidArgumentException::class);
});

it('stores allowed domains folded, trimmed, unique and sorted', function () {
    resolve(InstanceSettings::class)->set(InstanceSettingKey::AllowedEmailDomains->value, [' Example.org', 'acme.fr', 'example.org', '']);

    expect(resolve(InstanceSettings::class)->allowedEmailDomains())->toBe(['acme.fr', 'example.org']);
});

it('keeps only known integration providers in the disabled list', function () {
    resolve(InstanceSettings::class)->set(InstanceSettingKey::DisabledIntegrations->value, ['slack', 'nothing', 'jira', 'slack']);

    expect(resolve(InstanceSettings::class)->disabledIntegrations())->toBe(['jira', 'slack']);
});

it('turns the update check off by default and reads a stored boolean', function () {
    expect(resolve(InstanceSettings::class)->updateCheckEnabled())->toBeFalse();

    resolve(InstanceSettings::class)->set(InstanceSettingKey::UpdateCheckEnabled->value, '1');

    expect(resolve(InstanceSettings::class)->updateCheckEnabled())->toBeTrue();
});

it('refuses a maintenance message longer than 280 characters', function () {
    expect(fn () => resolve(InstanceSettings::class)->set(InstanceSettingKey::MaintenanceMessage->value, str_repeat('a', 281)))
        ->toThrow(InvalidArgumentException::class);
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `vendor/bin/sail artisan test --compact tests/Unit/Enums/InstanceSettingKeyTest.php tests/Feature/InstanceSettingsTest.php`
Expected: FAIL — undefined cases `SignupMode`, `AllowedEmailDomains`…

- [ ] **Step 3: Implement**

`app/Enums/InstanceSettingKey.php` — add the cases and make `branding()` explicit:

```php
    case SignupMode = 'signup_mode';
    case AllowedEmailDomains = 'allowed_email_domains';
    case MaintenanceMessage = 'maintenance_message';
    case MaintenanceMessageBy = 'maintenance_message_by';
    case UpdateCheckEnabled = 'update_check_enabled';
    case LatestVersion = 'latest_version';
    case UpdateCheckedAt = 'update_checked_at';
    case DisabledIntegrations = 'disabled_integrations';
    case MailLastTest = 'mail_last_test';
    case SsoLastTest = 'sso_last_test';

    /**
     * The keys the Branding screen owns, and the only ones its reset clears.
     *
     * @return array<int, self>
     */
    public static function branding(): array
    {
        return [
            self::BrandColor, self::BrandRadius, self::DisplayName, self::PoweredBy, self::LogoLight,
            self::LogoDark, self::Favicon, self::LogoMail, self::AvatarStyle, self::AvatarMemberChoice,
            self::GifProvider, self::GifEnabled, self::GifRating, self::GifKey,
        ];
    }
```

`app/Support/InstanceSettings.php` — constants, readers, and normalisers (the enum `IntegrationProvider` is read through its values; `App\Support` may use `App\Enums`):

```php
    public const bool DefaultUpdateCheckEnabled = false;

    public const int MaintenanceMessageMaxLength = 280;

    public function signupMode(): ?string
    {
        return $this->oneOf($this->stored(InstanceSettingKey::SignupMode), array_column(SignupMode::cases(), 'value'));
    }

    /** @return ?array<int, string> */
    public function allowedEmailDomains(): ?array
    {
        $domains = $this->stored(InstanceSettingKey::AllowedEmailDomains);

        return is_array($domains) ? array_values(array_filter($domains, 'is_string')) : null;
    }

    public function maintenanceMessage(): ?string
    {
        return $this->storedString(InstanceSettingKey::MaintenanceMessage);
    }

    public function maintenanceMessageBy(): ?string
    {
        return $this->storedString(InstanceSettingKey::MaintenanceMessageBy);
    }

    public function updateCheckEnabled(): bool
    {
        return $this->storedBool(InstanceSettingKey::UpdateCheckEnabled) ?? self::DefaultUpdateCheckEnabled;
    }

    public function latestVersion(): ?string
    {
        return $this->storedString(InstanceSettingKey::LatestVersion);
    }

    public function updateCheckedAt(): ?string
    {
        return $this->storedString(InstanceSettingKey::UpdateCheckedAt);
    }

    /** @return array<int, string> */
    public function disabledIntegrations(): array
    {
        $disabled = $this->stored(InstanceSettingKey::DisabledIntegrations);

        return is_array($disabled) ? array_values(array_filter($disabled, 'is_string')) : [];
    }

    /** @return ?array{at: string, ok: bool, to: string} */
    public function mailLastTest(): ?array
    {
        $test = $this->stored(InstanceSettingKey::MailLastTest);

        return is_array($test) ? $test : null;
    }

    /** @return ?array{provider: string, at: string, ok: bool, ms: ?int, issuer: ?string} */
    public function ssoLastTest(): ?array
    {
        $test = $this->stored(InstanceSettingKey::SsoLastTest);

        return is_array($test) ? $test : null;
    }
```

In `normalise()`, before the `match`, arrays are not trimmed; extend the `match`:

```php
        return match ($key) {
            InstanceSettingKey::PoweredBy,
            InstanceSettingKey::AvatarMemberChoice,
            InstanceSettingKey::GifEnabled,
            InstanceSettingKey::SsoRequired,
            InstanceSettingKey::UpdateCheckEnabled => $this->booleanFrom($key, $value),
            InstanceSettingKey::BrandRadius => $this->integerFrom($key, $value),
            InstanceSettingKey::GifKey => Crypt::encryptString($this->stringFrom($key, $value)),
            InstanceSettingKey::SignupMode => $this->signupModeFrom($key, $value),
            InstanceSettingKey::AllowedEmailDomains => $this->domainsFrom($key, $value),
            InstanceSettingKey::DisabledIntegrations => $this->providersFrom($key, $value),
            InstanceSettingKey::MaintenanceMessage => $this->messageFrom($key, $value),
            default => $value,
        };
```

```php
    private function signupModeFrom(InstanceSettingKey $key, mixed $value): string
    {
        return SignupMode::tryFrom($this->stringFrom($key, $value))?->value
            ?? throw new InvalidArgumentException("Instance setting [{$key->value}] expects a sign-up mode.");
    }

    /** @return ?array<int, string> */
    private function domainsFrom(InstanceSettingKey $key, mixed $value): ?array
    {
        if (! is_array($value)) {
            throw new InvalidArgumentException("Instance setting [{$key->value}] expects a list.");
        }

        $domains = collect($value)
            ->filter(fn (mixed $domain): bool => is_string($domain))
            ->map(fn (string $domain): string => strtolower(trim($domain)))
            ->filter(fn (string $domain): bool => $domain !== '')
            ->unique()
            ->sort()
            ->values()
            ->all();

        return $domains === [] ? null : $domains;
    }

    /** @return ?array<int, string> */
    private function providersFrom(InstanceSettingKey $key, mixed $value): ?array
    {
        if (! is_array($value)) {
            throw new InvalidArgumentException("Instance setting [{$key->value}] expects a list.");
        }

        $known = array_column(IntegrationProvider::cases(), 'value');
        $providers = collect($value)
            ->filter(fn (mixed $provider): bool => is_string($provider) && in_array($provider, $known, true))
            ->unique()
            ->sort()
            ->values()
            ->all();

        return $providers === [] ? null : $providers;
    }

    private function messageFrom(InstanceSettingKey $key, mixed $value): string
    {
        $message = $this->stringFrom($key, $value);

        if (mb_strlen($message) > self::MaintenanceMessageMaxLength) {
            throw new InvalidArgumentException("Instance setting [{$key->value}] is too long.");
        }

        return $message;
    }
```

`sort()` here is a byte sort of ASCII domain names and enum values, not a list read by people (rule 7 does not apply). Extend `all()` and its docblock with the new readers.

- [ ] **Step 4: Run the tests on PostgreSQL and SQLite**

Run: `bin/test-db pgsql -- tests/Unit/Enums/InstanceSettingKeyTest.php tests/Feature/InstanceSettingsTest.php tests/Feature/Admin/BrandingSettingsTest.php` then the same with `sqlite`.
Expected: PASS on both (`BrandingSettingsTest` proves the reset is unchanged).

- [ ] **Step 5: Commit** — `feat(admin): instance setting keys for the new sections`

### Task 2: Audit log foundation

**Files:**
- Create: `database/migrations/2026_10_21_100100_create_audit_events_table.php`, `app/Models/AuditEvent.php`, `database/factories/AuditEventFactory.php`, `app/Enums/AuditAction.php`, `app/Actions/Admin/RecordAuditEvent.php`, `app/Listeners/RecordSignInListener.php`, `RecordFailedSignInListener.php`, `RecordSecurityChangeListener.php`
- Modify: `app/Http/Controllers/Admin/BrandingController.php` (update, destroy), `AdminsController.php` (store, destroy), `SignInSettingsController.php` (update), `app/Actions/Mcp/IssueMcpToken.php`, `RevokeMcpToken.php`, `routes/console.php` (prune list)
- Test: `tests/Feature/Admin/AuditLogTest.php`

**Interfaces:**
- Produces: `RecordAuditEvent::handle(AuditAction $action, ?User $actor, ?Model $subject = null, array $properties = [], ?string $ip = null): AuditEvent`; `AuditAction` cases `SettingsUpdated`, `BrandingReset`, `AdminGranted`, `AdminRevoked`, `UserDeactivated`, `UserReactivated`, `TokenRevokedByAdmin`, `SsoTested`, `MailTested`, `SsoRequiredChanged`, `SignedIn`, `SignInFailed`, `TwoFactorEnabled`, `TwoFactorDisabled`, `PasswordChanged`, `TokenCreated`, `TokenRevoked`; `AuditAction::group(): string` (`settings`, `accounts`, `signIn`, `tokens`); `AuditEvent::Retention = 365` (days).

- [ ] **Step 1: Write the failing tests**

```php
<?php
// tests/Feature/Admin/AuditLogTest.php

use App\Enums\AuditAction;
use App\Models\AuditEvent;
use App\Models\User;
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Login;
use Illuminate\Support\Facades\Artisan;

function confirmedAdmin(mixed $test): User
{
    $admin = User::factory()->instanceAdmin()->create();
    $test->actingAs($admin)->withSession(['auth.password_confirmed_at' => time()]);

    return $admin;
}

it('records a branding change with the changed keys and no value', function () {
    $admin = confirmedAdmin($this);

    $this->put(route('admin.branding.update'), ['display_name' => 'Atlas Rétros'])->assertRedirect();

    $event = AuditEvent::query()->sole();
    expect($event->action)->toBe(AuditAction::SettingsUpdated)
        ->and($event->actor_user_id)->toBe($admin->id)
        ->and($event->actor_name)->toBe($admin->name)
        ->and($event->properties)->toBeIgnoringKeyOrder(['section' => 'branding', 'keys' => ['display_name']]);
});

it('records a granted and a revoked admin with the user as subject', function () {
    confirmedAdmin($this);
    $other = User::factory()->create();

    $this->post(route('admin.admins.store'), ['user_id' => $other->id]);
    $this->delete(route('admin.admins.destroy', $other));

    expect(AuditEvent::query()->orderBy('created_at')->orderBy('id')->pluck('action')->all())
        ->toBe([AuditAction::AdminGranted, AuditAction::AdminRevoked])
        ->and(AuditEvent::query()->pluck('subject_id')->unique()->all())->toBe([$other->id]);
});

it('records a sign-in and a failed sign-in without the password', function () {
    $user = User::factory()->create();

    event(new Login('web', $user, false));
    event(new Failed('web', null, ['email' => 'Nadia@Example.org', 'password' => 'secret-password']));

    $failed = AuditEvent::query()->where('action', AuditAction::SignInFailed)->sole();
    expect(AuditEvent::query()->where('action', AuditAction::SignedIn)->sole()->actor_user_id)->toBe($user->id)
        ->and($failed->properties)->toBeIgnoringKeyOrder(['email' => 'nadia@example.org'])
        ->and(json_encode($failed->properties))->not->toContain('secret-password');
});

it('records a token created and revoked by its owner', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $this->post(route('settings.apiTokens.store'), ['name' => 'Claude', 'expiration' => '30'])->assertRedirect();
    $token = $user->tokens()->sole();
    $this->delete(route('settings.apiTokens.destroy', $token->id))->assertRedirect();

    expect(AuditEvent::query()->orderBy('created_at')->orderBy('id')->pluck('action')->all())
        ->toBe([AuditAction::TokenCreated, AuditAction::TokenRevoked]);
});

it('prunes events older than the retention', function () {
    AuditEvent::factory()->create(['created_at' => now()->subDays(AuditEvent::Retention + 1)]);
    $kept = AuditEvent::factory()->create(['created_at' => now()->subDays(AuditEvent::Retention - 1)]);

    Artisan::call('model:prune', ['--model' => [AuditEvent::class]]);

    expect(AuditEvent::query()->pluck('id')->all())->toBe([$kept->id]);
});
```

(Re-read the names of the token routes and the `expiration` values in `ApiTokenSettings::Expirations` and adjust the two literals.)

- [ ] **Step 2: Run to see it fail** — `vendor/bin/sail artisan test --compact tests/Feature/Admin/AuditLogTest.php`. Expected: FAIL, class `AuditEvent` not found.

- [ ] **Step 3: Implement**

Migration:

```php
public function up(): void
{
    Schema::create('audit_events', function (Blueprint $table) {
        $table->uuid('id')->primary();
        $table->foreignUuid('actor_user_id')->nullable()->constrained('users')->nullOnDelete();
        $table->string('actor_name');
        $table->string('action', 40);
        $table->string('subject_type', 60)->nullable();
        $table->string('subject_id', 64)->nullable();
        $table->json('properties')->nullable();
        $table->string('ip_address', 45)->nullable();
        $table->dateTime('created_at');
        $table->index(['created_at', 'id']);
        $table->index(['action', 'created_at']);
    });
}
```

Model:

```php
<?php

namespace App\Models;

use App\Enums\AuditAction;
use Carbon\CarbonInterface;
use Database\Factories\AuditEventFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\MassPrunable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property ?string $actor_user_id
 * @property string $actor_name
 * @property AuditAction $action
 * @property ?string $subject_type
 * @property ?string $subject_id
 * @property ?array<string, mixed> $properties
 * @property ?string $ip_address
 * @property CarbonInterface $created_at
 */
#[Fillable(['actor_user_id', 'actor_name', 'action', 'subject_type', 'subject_id', 'properties', 'ip_address', 'created_at'])]
class AuditEvent extends Model
{
    /** @use HasFactory<AuditEventFactory> */
    use HasFactory;

    use HasUuids;
    use MassPrunable;

    public const int Retention = 365;

    public const null UPDATED_AT = null;

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'action' => AuditAction::class,
            'properties' => 'json',
            'created_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }

    /** @return Builder<static> */
    public function prunable(): Builder
    {
        return static::query()->where('created_at', '<', now()->subDays(self::Retention));
    }
}
```

Action:

```php
<?php

namespace App\Actions\Admin;

use App\Enums\AuditAction;
use App\Models\AuditEvent;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class RecordAuditEvent
{
    /** @param array<string, mixed> $properties keys and identifiers only, never a secret value */
    public function handle(AuditAction $action, ?User $actor, ?Model $subject = null, array $properties = [], ?string $ip = null): AuditEvent
    {
        return AuditEvent::query()->create([
            'actor_user_id' => $actor?->id,
            'actor_name' => $actor?->name ?? '',
            'action' => $action,
            'subject_type' => $subject === null ? null : class_basename($subject),
            'subject_id' => $subject?->getKey(),
            'properties' => $properties === [] ? null : $properties,
            'ip_address' => $ip ?? request()?->ip(),
            'created_at' => now(),
        ]);
    }
}
```

`AuditAction` (string-backed, values snake_case, `group()` by `match`). Listeners (auto-discovered, re-read `bootstrap/app.php` for `withEvents`):

```php
class RecordSignInListener
{
    public function __construct(private RecordAuditEvent $recordAuditEvent) {}

    public function handle(Login $event): void
    {
        if (! $event->user instanceof User) {
            return;
        }

        $this->recordAuditEvent->handle(AuditAction::SignedIn, $event->user, $event->user, ['guard' => $event->guard]);
    }
}
```

```php
class RecordFailedSignInListener
{
    public function __construct(private RecordAuditEvent $recordAuditEvent) {}

    public function handle(Failed $event): void
    {
        $address = $event->credentials['email'] ?? null;

        $this->recordAuditEvent->handle(
            AuditAction::SignInFailed,
            null,
            $event->user instanceof User ? $event->user : null,
            is_string($address) ? ['email' => LoginAddress::normalise($address)] : [],
        );
    }
}
```

`RecordSecurityChangeListener` handles Fortify's `TwoFactorAuthenticationConfirmed` (→ `TwoFactorEnabled`), `TwoFactorAuthenticationDisabled`, and `Illuminate\Auth\Events\PasswordReset` plus the app's own password-update path (re-read `app/Actions/Fortify/UpdateUserPassword.php`: record `PasswordChanged` there if no event fires). The e-mail second factor (`EmailSecondFactorsController`) records `TwoFactorEnabled` / `TwoFactorDisabled` with `['method' => 'email']`.

Hooks: in `BrandingController@update` after the transaction, `SettingsUpdated` with `['section' => 'branding', 'keys' => array_keys($changed)]` (only keys whose stored value changed; re-read how the controller computes them); `destroy` → `BrandingReset`; `AdminsController@store` → `AdminGranted` (subject the user), `destroy` → `AdminRevoked` when the revoke happened; `SignInSettingsController@update` → `SsoRequiredChanged` with `['value' => $required]` when it changed; `IssueMcpToken` → `TokenCreated` (subject the token, `['name' => …, 'scopes' => …]`), `RevokeMcpToken` → `TokenRevoked`. Add `AuditEvent::class` to the `model:prune` list of `routes/console.php`.

- [ ] **Step 4: Run on PostgreSQL and SQLite** — `bin/test-db pgsql -- tests/Feature/Admin tests/Feature/Settings tests/Feature/Auth`, then `sqlite`. Expected: PASS (existing admin, token and auth tests stay green).

- [ ] **Step 5: Commit** — `feat(admin): audit log of admin actions and security events`

### Task 3: Sign-in time, deactivation columns, version prop

**Files:**
- Create: `database/migrations/2026_10_21_100200_add_activity_columns_to_users_table.php`, `app/Listeners/RecordLastSignInListener.php`, `app/Support/InstanceVersion.php`
- Modify: `app/Models/User.php`, `database/factories/UserFactory.php` (`deactivated()` state), `app/Http/Middleware/HandleInertiaRequests.php`
- Test: `tests/Feature/Auth/LastSignInTest.php`, `tests/Unit/Support/InstanceVersionTest.php`

**Interfaces:**
- Produces: `User::$deactivated_at`, `User::$last_signed_in_at` (datetime casts), `User::isDeactivated(): bool`, `UserFactory::deactivated()`; `InstanceVersion::current(): string`, `InstanceVersion::status(): array{state: 'unknown'|'current'|'outdated', latest: ?string, checkedAt: ?string}`; shared Inertia prop `instanceVersion: ?string` (null when signed out).

- [ ] **Step 1: Write the failing tests**

```php
<?php
// tests/Unit/Support/InstanceVersionTest.php

use App\Enums\InstanceSettingKey;
use App\Support\InstanceSettings;
use App\Support\InstanceVersion;

it('reads the configured version without its leading v', function (string $configured, string $expected) {
    config(['skrum.version' => $configured]);

    expect(resolve(InstanceVersion::class)->current())->toBe($expected);
})->with([
    ['1.8.2', '1.8.2'],
    ['v1.8.2', '1.8.2'],
    [' v2.0.0-beta.1 ', '2.0.0-beta.1'],
]);

it('says unknown while the check is off, whatever is stored', function () {
    config(['skrum.version' => '1.8.2']);
    resolve(InstanceSettings::class)->set(InstanceSettingKey::LatestVersion->value, '1.9.0');

    expect(resolve(InstanceVersion::class)->status()['state'])->toBe('unknown');
});

it('compares the stored latest version once the check is on', function (string $latest, string $state) {
    config(['skrum.version' => '1.8.2']);
    resolve(InstanceSettings::class)->setMany([
        InstanceSettingKey::UpdateCheckEnabled->value => true,
        InstanceSettingKey::LatestVersion->value => $latest,
        InstanceSettingKey::UpdateCheckedAt->value => '2026-10-03T08:00:00+00:00',
    ]);

    expect(resolve(InstanceVersion::class)->status())->toBe([
        'state' => $state,
        'latest' => $latest,
        'checkedAt' => '2026-10-03T08:00:00+00:00',
    ]);
})->with([
    ['1.9.0', 'outdated'],
    ['1.8.2', 'current'],
    ['1.8.1', 'current'],
]);
```

(`tests/Unit` cases that touch the database follow the existing `tests/Unit` setup: re-read `tests/Pest.php` for which folders use `RefreshDatabase`; if `Unit` does not, put this file under `tests/Feature/Support/`.)

```php
<?php
// tests/Feature/Auth/LastSignInTest.php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('stamps the time of a password sign-in', function () {
    $this->travelTo(now()->setDateTime(2026, 10, 3, 9, 0, 0));
    $user = User::factory()->create(['password' => 'password']);

    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password']);

    expect($user->fresh()->last_signed_in_at?->toIso8601String())->toBe('2026-10-03T09:00:00+00:00');
});

it('shares the version with a signed-in user only', function () {
    config(['skrum.version' => '1.8.2']);

    $this->get(route('login'))->assertInertia(fn (Assert $page) => $page->where('instanceVersion', null));

    $this->actingAs(User::factory()->create())
        ->get(route('about.show'))
        ->assertInertia(fn (Assert $page) => $page->where('instanceVersion', '1.8.2'));
});
```

(Re-read the login route name and the magic-link, e-mail-code and SSO test helpers: add one case each that asserts `last_signed_in_at` is set — spec criterion 12. Passkey: assert the same through the passkey test helper if one exists; otherwise record the gap in the task report, spec §17 item 4.)

- [ ] **Step 2: Run to see it fail.**

- [ ] **Step 3: Implement**

Migration: `$table->dateTime('deactivated_at')->nullable(); $table->dateTime('last_signed_in_at')->nullable();` on `users`.

```php
class RecordLastSignInListener
{
    public function handle(Login $event): void
    {
        if (! $event->user instanceof User) {
            return;
        }

        User::query()->whereKey($event->user->id)->update(['last_signed_in_at' => now()]);
    }
}
```

(`users` has derived columns `email_key` and `name_search`; this update touches neither source column — rule 9.)

```php
<?php

namespace App\Support;

class InstanceVersion
{
    public function __construct(private InstanceSettings $settings) {}

    public function current(): string
    {
        return ltrim(trim((string) config('skrum.version')), 'vV');
    }

    /**
     * @return array{
     *     state: 'unknown'|'current'|'outdated',
     *     latest: ?string,
     *     checkedAt: ?string
     * }
     */
    public function status(): array
    {
        $latest = $this->settings->latestVersion();
        $checkedAt = $this->settings->updateCheckedAt();

        if (! $this->settings->updateCheckEnabled() || $latest === null) {
            return ['state' => 'unknown', 'latest' => null, 'checkedAt' => null];
        }

        $state = version_compare($latest, $this->current(), '>') ? 'outdated' : 'current';

        return ['state' => $state, 'latest' => $latest, 'checkedAt' => $checkedAt];
    }
}
```

`HandleInertiaRequests::share()`: `'instanceVersion' => fn (): ?string => $request->user() === null ? null : resolve(InstanceVersion::class)->current(),` and, for admins only, `'instanceVersionStatus' => fn (): ?array => $request->user()?->can('manageInstance') ? resolve(InstanceVersion::class)->status() : null,`. `User`: casts and `isDeactivated(): bool { return $this->deactivated_at !== null; }`. Factory state `deactivated()` sets `deactivated_at => now()`.

- [ ] **Step 4: Run on PostgreSQL and SQLite** — `bin/test-db pgsql -- tests/Unit/Support/InstanceVersionTest.php tests/Feature/Auth tests/Feature/AboutPageTest.php`, then `sqlite`. Expected: PASS.

- [ ] **Step 5: Commit** — `feat(admin): last sign-in, deactivation column and the instance version`

---

## Step A — back end, three lanes

### Lane V

### Task 4: Update check and the version of the Docker image

**Files:**
- Create: `app/Console/Commands/CheckForUpdateCommand.php`, `app/Jobs/CheckForUpdate.php`
- Modify: `config/skrum.php` (`update_feed`), `routes/console.php`, `Dockerfile`, `.github/workflows/docker-image.yml`
- Test: `tests/Feature/Admin/UpdateCheckTest.php`

**Interfaces:**
- Consumes: Task 1 keys, Task 3 `InstanceVersion`.
- Produces: `CheckForUpdate::dispatch()`; command `skrum:check-for-update`; `config('skrum.update_feed')`.

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Enums\InstanceSettingKey;
use App\Support\InstanceSettings;
use Illuminate\Support\Facades\Http;

beforeEach(fn () => config(['skrum.update_feed' => 'https://releases.example/latest']));

it('makes no request while the check is off', function () {
    Http::fake();

    $this->artisan('skrum:check-for-update')->assertSuccessful();

    Http::assertNothingSent();
});

it('stores the latest release without its v and the time of the check', function () {
    $this->travelTo(now()->setDateTime(2026, 10, 3, 8, 0, 0));
    resolve(InstanceSettings::class)->set(InstanceSettingKey::UpdateCheckEnabled->value, true);
    Http::fake(['releases.example/*' => Http::response(['tag_name' => 'v1.9.0'])]);

    $this->artisan('skrum:check-for-update')->assertSuccessful();

    $settings = resolve(InstanceSettings::class);
    expect($settings->latestVersion())->toBe('1.9.0')
        ->and($settings->updateCheckedAt())->toBe('2026-10-03T08:00:00+00:00');
});

it('keeps what it had when the feed fails or answers nonsense', function (Closure $answer) {
    resolve(InstanceSettings::class)->setMany([
        InstanceSettingKey::UpdateCheckEnabled->value => true,
        InstanceSettingKey::LatestVersion->value => '1.8.0',
    ]);
    Http::fake(['releases.example/*' => $answer]);

    $this->artisan('skrum:check-for-update')->assertSuccessful();

    expect(resolve(InstanceSettings::class)->latestVersion())->toBe('1.8.0');
})->with([
    'server error' => [fn () => Http::response('', 500)],
    'no tag' => [fn () => Http::response(['name' => 'x'])],
    'not a version' => [fn () => Http::response(['tag_name' => '<script>'])],
    'connection refused' => [fn () => throw new Illuminate\Http\Client\ConnectionException('refused')],
]);
```

- [ ] **Step 2: Run to see it fail.**

- [ ] **Step 3: Implement**

```php
#[Description('Ask the release feed for the latest Skrüm version, when the admin turned the check on')]
#[Signature('skrum:check-for-update')]
class CheckForUpdateCommand extends Command
{
    private const string VersionPattern = '/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/D';

    public function handle(InstanceSettings $settings): int
    {
        if (! $settings->updateCheckEnabled()) {
            $this->comment('The update check is off.');

            return self::SUCCESS;
        }

        $this->info('Asking the release feed...');

        $latest = $this->latestVersion();

        if ($latest === null) {
            $this->warn('The release feed gave no usable version.');

            return self::SUCCESS;
        }

        $settings->setMany([
            InstanceSettingKey::LatestVersion->value => $latest,
            InstanceSettingKey::UpdateCheckedAt->value => now()->toIso8601String(),
        ]);

        $this->comment("Latest version: {$latest}.");

        return self::SUCCESS;
    }

    private function latestVersion(): ?string
    {
        $tag = rescue(
            fn () => Http::timeout(5)->acceptJson()->get((string) config('skrum.update_feed'))->throw()->json('tag_name'),
            null,
            report: false,
        );

        if (! is_string($tag)) {
            Log::warning('The update check got no tag from the release feed.');

            return null;
        }

        $version = ltrim(trim($tag), 'vV');

        return preg_match(self::VersionPattern, $version) === 1 ? $version : null;
    }
}
```

`CheckForUpdate` job (`ShouldQueue`) calls `Artisan::call('skrum:check-for-update')`. `config/skrum.php`: `'update_feed' => env('SKRUM_UPDATE_FEED', 'https://api.github.com/repos/arnaud-ritti/skrum/releases/latest'),`. `routes/console.php`: `Schedule::command('skrum:check-for-update')->daily()->onOneServer();`.

`Dockerfile`, in the `runtime` stage before the `ENV` block: `ARG SKRUM_VERSION=dev` and add `SKRUM_VERSION=${SKRUM_VERSION}` to the `ENV`. Workflow `docker/build-push-action` step: `build-args: SKRUM_VERSION=${{ steps.meta.outputs.version }}`.

- [ ] **Step 4: Run on PostgreSQL and SQLite**; then `docker build --build-arg SKRUM_VERSION=9.9.9 -t skrum-version-check . && docker run --rm skrum-version-check php artisan config:show skrum.version` — expected `9.9.9` (spec criterion 21; skip and report if Docker is not available to the agent).

- [ ] **Step 5: Commit** — `feat(admin): opt-in update check and the image's version`

### Task 5: Maintenance details in the maintenance payload

**Files:**
- Create: `app/Support/Maintenance/MaintenanceDetails.php`, `app/Listeners/AddMaintenanceDetailsListener.php`
- Test: `tests/Feature/MaintenanceDetailsTest.php`

**Interfaces:**
- Consumes: Task 1 (`maintenanceMessage()`, `maintenanceMessageBy()`).
- Produces: `MaintenanceDetails::read(): ?array{message: ?string, author: ?string, backAt: ?string}` (never throws; null outside maintenance); `MaintenanceDetails::PayloadKey = 'skrum'`.

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Enums\InstanceSettingKey;
use App\Models\User;
use App\Support\InstanceSettings;
use App\Support\Maintenance\MaintenanceDetails;

beforeEach(fn () => config(['app.maintenance.driver' => 'cache', 'app.maintenance.store' => 'array']));
afterEach(fn () => $this->artisan('up'));

it('attaches the message, its author and the time of return to the payload', function () {
    $this->travelTo(now()->setDateTime(2026, 10, 3, 14, 0, 0));
    $admin = User::factory()->instanceAdmin()->create(['name' => 'Hugo Lambert']);
    resolve(InstanceSettings::class)->setMany([
        InstanceSettingKey::MaintenanceMessage->value => 'Monthly update.',
        InstanceSettingKey::MaintenanceMessageBy->value => $admin->id,
    ]);

    $this->artisan('down', ['--retry' => 1800])->assertSuccessful();

    expect(resolve(MaintenanceDetails::class)->read())->toBe([
        'message' => 'Monthly update.',
        'author' => 'Hugo Lambert',
        'backAt' => '2026-10-03T14:30:00+00:00',
    ])->and(app()->maintenanceMode()->data()['retry'])->toBe(1800);
});

it('has no time of return without --retry and no message when none was saved', function () {
    $this->artisan('down')->assertSuccessful();

    expect(resolve(MaintenanceDetails::class)->read())->toBe(['message' => null, 'author' => null, 'backAt' => null]);
});

it('reads nothing outside maintenance', function () {
    expect(resolve(MaintenanceDetails::class)->read())->toBeNull();
});

it('names no author whose account is gone', function () {
    resolve(InstanceSettings::class)->setMany([
        InstanceSettingKey::MaintenanceMessage->value => 'Back soon.',
        InstanceSettingKey::MaintenanceMessageBy->value => (string) Str::uuid(),
    ]);

    $this->artisan('down')->assertSuccessful();

    expect(resolve(MaintenanceDetails::class)->read()['author'])->toBeNull();
});
```

- [ ] **Step 2: Run to see it fail.**

- [ ] **Step 3: Implement**

```php
<?php

namespace App\Support\Maintenance;

use App\Models\User;
use App\Support\InstanceSettings;

class MaintenanceDetails
{
    public const string PayloadKey = 'skrum';

    public function __construct(private InstanceSettings $settings) {}

    /**
     * Runs while the instance is still up, right after `artisan down` wrote its payload.
     *
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    public function attachTo(array $payload): array
    {
        $authorId = $this->settings->maintenanceMessageBy();
        $retry = $payload['retry'] ?? null;

        return [...$payload, self::PayloadKey => [
            'message' => $this->settings->maintenanceMessage(),
            'author' => $authorId === null ? null : User::query()->whereKey($authorId)->value('name'),
            'backAt' => is_int($retry) && $retry > 0 ? now('UTC')->addSeconds($retry)->toIso8601String() : null,
        ]];
    }

    /**
     * Read by the static 503 page: no database, and nothing thrown.
     *
     * @return ?array{message: ?string, author: ?string, backAt: ?string}
     */
    public function read(): ?array
    {
        return rescue(function (): ?array {
            if (! app()->isDownForMaintenance()) {
                return null;
            }

            $details = app()->maintenanceMode()->data()[self::PayloadKey] ?? null;

            if (! is_array($details)) {
                return null;
            }

            return [
                'message' => is_string($details['message'] ?? null) ? $details['message'] : null,
                'author' => is_string($details['author'] ?? null) ? $details['author'] : null,
                'backAt' => is_string($details['backAt'] ?? null) ? $details['backAt'] : null,
            ];
        }, null, report: false);
    }
}
```

```php
class AddMaintenanceDetailsListener
{
    public function __construct(private MaintenanceDetails $maintenanceDetails) {}

    public function handle(MaintenanceModeEnabled $event): void
    {
        rescue(function (): void {
            $mode = app()->maintenanceMode();

            $mode->activate($this->maintenanceDetails->attachTo($mode->data()));
        });
    }
}
```

- [ ] **Step 4: Run on PostgreSQL and SQLite**, plus `tests/Feature/ErrorPagesTest.php` (unchanged behaviour).
- [ ] **Step 5: Commit** — `feat(errors): maintenance message and time of return in the maintenance payload`

### Task 6: Status checks and heartbeats

**Files:**
- Create: `app/Enums/StatusComponentState.php`, `app/Support/Status/InstanceStatus.php`, `app/Console/Commands/HeartbeatCommand.php`, `app/Jobs/RecordQueueHeartbeat.php`
- Modify: `routes/console.php`
- Test: `tests/Feature/Support/InstanceStatusTest.php`

**Interfaces:**
- Produces: `StatusComponentState` (`Operational`, `Degraded`, `Down`, `NotConfigured`, `Maintenance`); `InstanceStatus::check(): array<int, array{key: string, state: StatusComponentState}>`; `InstanceStatus::overall(array $components): string` (`operational`, `degraded`, `maintenance`); cache keys `InstanceStatus::QueueHeartbeat = 'skrum.heartbeat.queue'`, `SchedulerHeartbeat = 'skrum.heartbeat.scheduler'`; command `skrum:heartbeat`.

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Enums\StatusComponentState as State;
use App\Support\Status\InstanceStatus;
use Illuminate\Support\Facades\Cache;

function stateOf(string $key): State
{
    return collect(resolve(InstanceStatus::class)->check())->firstWhere('key', $key)['state'];
}

it('lists the seven components in a fixed order', function () {
    expect(array_column(resolve(InstanceStatus::class)->check(), 'key'))
        ->toBe(['application', 'database', 'cache', 'queue', 'scheduler', 'realtime', 'mail']);
});

it('rates a heartbeat by its age', function (?int $minutesAgo, State $state) {
    $this->travelTo(now()->setDateTime(2026, 10, 3, 12, 0, 0));

    if ($minutesAgo !== null) {
        Cache::forever(InstanceStatus::QueueHeartbeat, now()->subMinutes($minutesAgo)->toIso8601String());
    }

    expect(stateOf('queue'))->toBe($state);
})->with([
    [1, State::Operational],
    [5, State::Degraded],
    [20, State::Down],
    [null, State::Down],
]);

it('writes both heartbeats from the scheduler command, the queue one through a job', function () {
    config(['queue.default' => 'sync']);

    $this->artisan('skrum:heartbeat')->assertSuccessful();

    expect(Cache::get(InstanceStatus::SchedulerHeartbeat))->not->toBeNull()
        ->and(Cache::get(InstanceStatus::QueueHeartbeat))->not->toBeNull();
});

it('calls real time and mail not configured on the defaults', function () {
    config(['broadcasting.default' => 'null', 'mail.default' => 'log']);

    expect(stateOf('realtime'))->toBe(State::NotConfigured)
        ->and(stateOf('mail'))->toBe(State::NotConfigured);
});

it('calls real time down when nothing listens on its port', function () {
    config([
        'broadcasting.default' => 'reverb',
        'broadcasting.connections.reverb.options.host' => '127.0.0.1',
        'broadcasting.connections.reverb.options.port' => 1,
    ]);

    expect(stateOf('realtime'))->toBe(State::Down);
});

it('calls the database down when it cannot be reached', function () {
    withUnreachableDatabase(fn () => expect(stateOf('database'))->toBe(State::Down));
});
```

(`withUnreachableDatabase()` lives in `tests/Feature/ErrorPagesTest.php` today: move it to `tests/Pest.php` in this task, unchanged, since two files need it.)

- [ ] **Step 2: Run to see it fail.**

- [ ] **Step 3: Implement**

```php
<?php

namespace App\Support\Status;

use App\Enums\StatusComponentState as State;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class InstanceStatus
{
    public const string QueueHeartbeat = 'skrum.heartbeat.queue';

    public const string SchedulerHeartbeat = 'skrum.heartbeat.scheduler';

    private const int HealthyMinutes = 3;

    private const int LateMinutes = 15;

    private const float SocketTimeoutSeconds = 1.0;

    /** @return array<int, array{key: string, state: State}> */
    public function check(): array
    {
        $cacheUp = $this->cacheAnswers();

        return [
            ['key' => 'application', 'state' => app()->isDownForMaintenance() ? State::Maintenance : State::Operational],
            ['key' => 'database', 'state' => $this->databaseAnswers() ? State::Operational : State::Down],
            ['key' => 'cache', 'state' => $cacheUp ? State::Operational : State::Down],
            ['key' => 'queue', 'state' => $cacheUp ? $this->heartbeat(self::QueueHeartbeat) : State::Down],
            ['key' => 'scheduler', 'state' => $cacheUp ? $this->heartbeat(self::SchedulerHeartbeat) : State::Down],
            ['key' => 'realtime', 'state' => $this->realtime()],
            ['key' => 'mail', 'state' => in_array(config('mail.default'), ['log', 'array'], true) ? State::NotConfigured : State::Operational],
        ];
    }

    /** @param array<int, array{key: string, state: State}> $components */
    public function overall(array $components): string
    {
        $states = array_column($components, 'state');

        if (in_array(State::Maintenance, $states, true)) {
            return 'maintenance';
        }

        if (in_array(State::Down, $states, true) || in_array(State::Degraded, $states, true)) {
            return 'degraded';
        }

        return 'operational';
    }

    private function databaseAnswers(): bool
    {
        return rescue(function (): bool {
            User::query()->exists();

            return true;
        }, false, report: false);
    }

    private function cacheAnswers(): bool
    {
        return rescue(function (): bool {
            $probe = Str::random(16);
            Cache::put('skrum.status.probe', $probe, 60);

            return Cache::get('skrum.status.probe') === $probe;
        }, false, report: false);
    }

    private function heartbeat(string $key): State
    {
        $beat = rescue(fn (): mixed => Cache::get($key), null, report: false);

        if (! is_string($beat)) {
            return State::Down;
        }

        $age = CarbonImmutable::parse($beat)->diffInMinutes(now(), absolute: true);

        if ($age < self::HealthyMinutes) {
            return State::Operational;
        }

        return $age < self::LateMinutes ? State::Degraded : State::Down;
    }

    private function realtime(): State
    {
        if (config('broadcasting.default') !== 'reverb') {
            return State::NotConfigured;
        }

        $host = (string) config('broadcasting.connections.reverb.options.host');
        $port = (int) config('broadcasting.connections.reverb.options.port');

        $socket = @stream_socket_client("tcp://{$host}:{$port}", $errorCode, $errorMessage, self::SocketTimeoutSeconds);

        if ($socket === false) {
            return State::Down;
        }

        fclose($socket);

        return State::Operational;
    }
}
```

`HeartbeatCommand` (`skrum:heartbeat`): writes `Cache::forever(InstanceStatus::SchedulerHeartbeat, now()->toIso8601String())`, dispatches `RecordQueueHeartbeat`, comments "Heartbeat recorded.". `RecordQueueHeartbeat` (`ShouldQueue`) writes the queue key. `routes/console.php`: `Schedule::command('skrum:heartbeat')->everyMinute()->onOneServer();`.

- [ ] **Step 4: Run on PostgreSQL and SQLite**, plus `tests/Feature/ErrorPagesTest.php` (the moved helper).
- [ ] **Step 5: Commit** — `feat(status): component checks and heartbeats`

### Task 7: Status page

**Files:**
- Create: `routes/status.php`, `app/Http/Controllers/StatusPagesController.php`, `resources/views/status.blade.php`, `resources/views/partials/static-page-head.blade.php`
- Modify: `bootstrap/app.php`, `resources/views/errors/503.blade.php` (uses the partial; no visible change)
- Test: `tests/Feature/StatusPageTest.php`

**Interfaces:**
- Consumes: Task 6.
- Produces: route `status.show` (GET `/status`); partial `partials.static-page-head` taking `$title`, `$appearance`, `$locale` and holding the token block and shared CSS of today's 503 page.

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Support\Status\InstanceStatus;

it('shows every component with its state in words, without a session', function () {
    $response = $this->get('/status', ['Accept-Language' => 'fr'])->assertOk();

    expect($response->headers->getCookies())->toBe([])
        ->and($response->headers->get('Cache-Control'))->toContain('no-store');
    $response->assertSee('lang="fr"', false)
        ->assertSee("État de l'instance")
        ->assertSee('Base de données')
        ->assertSee('data-slot="status-component"', false)
        ->assertDontSee('<script src', false);
});

it('answers during maintenance and says so', function () {
    config(['app.maintenance.driver' => 'cache', 'app.maintenance.store' => 'array']);
    $this->artisan('down');

    try {
        $this->get('/status')->assertOk()->assertSee('Maintenance in progress');
        $this->get('/')->assertServiceUnavailable();
    } finally {
        $this->artisan('up');
    }
});

it('renders with an unreachable database and a database cache store', function () {
    config(['cache.default' => 'database']);

    withUnreachableDatabase(function (): void {
        $this->get('/status')->assertOk()->assertSee('data-state="down"', false);
    });
});

it('says all systems operational when every configured component answers', function () {
    config(['broadcasting.default' => 'null', 'mail.default' => 'smtp', 'queue.default' => 'sync']);
    $this->artisan('skrum:heartbeat');

    $this->get('/status')->assertOk()->assertSee('All systems operational');
});
```

- [ ] **Step 2: Run to see it fail.**

- [ ] **Step 3: Implement**

`bootstrap/app.php`: in `then:` add `Route::group([], base_path('routes/status.php'));`; in `withMiddleware`: `$middleware->preventRequestsDuringMaintenance(except: ['status']);` (re-read the installed `Middleware` class for the method's name and signature).

`routes/status.php`:

```php
<?php

use App\Http\Controllers\StatusPagesController;
use Illuminate\Support\Facades\Route;

Route::get('status', [StatusPagesController::class, 'show'])->name('status.show');
```

```php
class StatusPagesController extends Controller
{
    public function show(Request $request, InstanceStatus $instanceStatus): Response
    {
        $locale = $request->getPreferredLanguage(config('skrum.locales')) ?? config('app.locale');
        app()->setLocale($locale);

        $components = $instanceStatus->check();

        return response()
            ->view('status', [
                'components' => $components,
                'overall' => $instanceStatus->overall($components),
                'checkedAt' => now('UTC')->format('H:i'),
                'locale' => $locale,
            ])
            ->header('Cache-Control', 'no-store');
    }
}
```

`resources/views/partials/static-page-head.blade.php`: the `<meta>` lines, `<title>`, and the whole `<style>` block of today's 503 page (tokens light and dark, header, main, footer, `.retry`, `.trema`), plus the rules the status list needs (`.components`, `.component`, `.dot`), all with tokens of the block. `503.blade.php` includes it with its title. `status.blade.php`: header (logo SVG of the 503 page, wordmark), `main` with overline "Instance status", `h1` overall sentence (`__('All systems operational')`, `__('Some systems are degraded')`, `__('Maintenance in progress')`), `<ul class="components">` with `<li data-slot="status-component" data-state="{{ $state->value }}">` holding an icon (inline SVG check / alert / cross / dash / wrench, `aria-hidden`), the component name (`__('Application')`, `__('Database')`, `__('Cache')`, `__('Background jobs')`, `__('Scheduled tasks')`, `__('Real time')`, `__('E-mail')`) and the state in words (`__('Operational')`, `__('Degraded')`, `__('Down')`, `__('Not configured')`, `__('Maintenance')`); a line `__('Checked at :time UTC', ['time' => $checkedAt])`; the `.retry` link "Refresh" to `/status` and a link "Back to my teams" to `/`. No script.

- [ ] **Step 4: Run on PostgreSQL and SQLite**, plus `tests/Feature/ErrorPagesTest.php`.
- [ ] **Step 5: Commit** — `feat(status): public status page, served during maintenance`

### Task 8: The 503 page — "Back at", message, status link

**Files:**
- Modify: `resources/views/errors/503.blade.php`
- Test: `tests/Feature/ErrorPagesTest.php` (add cases; keep every existing one)

**Interfaces:**
- Consumes: Task 5 `MaintenanceDetails::read()`, Task 7 `/status`.

- [ ] **Step 1: Write the failing tests**

```php
it('shows the time of return and the admin message in maintenance', function () {
    useProcessLocalMaintenanceMode();
    $this->travelTo(now()->setDateTime(2026, 10, 3, 12, 0, 0));
    $admin = User::factory()->instanceAdmin()->create(['name' => 'Hugo Lambert']);
    resolve(InstanceSettings::class)->setMany([
        InstanceSettingKey::MaintenanceMessage->value => 'Mise à jour mensuelle.',
        InstanceSettingKey::MaintenanceMessageBy->value => $admin->id,
    ]);
    $this->artisan('down', ['--retry' => 1800]);

    try {
        $content = $this->get('/', ['Accept-Language' => 'fr'])->assertServiceUnavailable()->getContent();

        expect($content)
            ->toContain('data-slot="maintenance-back-at"')
            ->toContain('<time datetime="2026-10-03T12:30:00+00:00">12:30 UTC</time>')
            ->toContain('« Mise à jour mensuelle. »')
            ->toContain("Hugo Lambert, admin de l'instance")
            ->toContain('href="/status"')
            ->and(substr_count($content, '<script'))->toBe(1);
    } finally {
        $this->artisan('up');
    }
});

it('shows neither block without --retry and without a message', function () {
    useProcessLocalMaintenanceMode();
    $this->artisan('down');

    try {
        $this->get('/')->assertServiceUnavailable()
            ->assertDontSee('data-slot="maintenance-back-at"', false)
            ->assertDontSee('data-slot="maintenance-message"', false)
            ->assertSee('href="/status"', false);
    } finally {
        $this->artisan('up');
    }
});

it('shows neither block on the busy-database 503, even in maintenance', function () {
    useProcessLocalMaintenanceMode();
    resolve(InstanceSettings::class)->set(InstanceSettingKey::MaintenanceMessage->value, 'Back soon.');
    $this->artisan('down', ['--retry' => 600, '--except' => ['/error-pages-probe/*']]);
    Route::middleware('web')->post('/error-pages-probe/busy', fn () => throw new PDOException('SQLSTATE[HY000]: General error: 5 database is locked'));

    try {
        $this->post('/error-pages-probe/busy')
            ->assertServiceUnavailable()
            ->assertSee('The database is busy. Try again.')
            ->assertDontSee('data-slot="maintenance-back-at"', false)
            ->assertDontSee('data-slot="maintenance-message"', false);
    } finally {
        $this->artisan('up');
    }
});

it('leaves the details out when the maintenance store is the unreachable database', function () {
    config(['app.maintenance.driver' => 'cache', 'app.maintenance.store' => 'database']);
    Route::middleware('web')->get('/error-pages-probe/unavailable', fn () => abort(503));

    withUnreachableDatabase(function (): void {
        $this->get('/error-pages-probe/unavailable')->assertServiceUnavailable()
            ->assertDontSee('data-slot="maintenance-back-at"', false);
    });
});
```

(The busy 503 is raised as `ConcurrencyErrorResponseTest` raises it; `--except` lets the probe through maintenance so that the busy page is rendered while the payload holds details. If the installed `down` command takes `--except` differently, re-read `DownCommand::excludedPaths()`.)

- [ ] **Step 2: Run to see them fail.**

- [ ] **Step 3: Implement**

In the `@php` block: `$details = $busyMessage === null ? resolve(\App\Support\Maintenance\MaintenanceDetails::class)->read() : null;` and `$backAt = $details['backAt'] ?? null;`. Header: replace the AD-3 comment with `<a class="link" href="/status">{{ __('Instance status', [], $locale) }}</a>` pushed to the end (`margin-left: auto`). After the description, replace the AD-5 comment with:

```blade
@if($backAt !== null)
    <div class="back-at" data-slot="maintenance-back-at">
        <p class="back-at-label">{{ __('Back at', [], $locale) }}</p>
        <p class="back-at-time"><time datetime="{{ $backAt }}">{{ \Illuminate\Support\Carbon::parse($backAt)->utc()->format('H:i') }} UTC</time></p>
        <p class="back-at-zone" data-slot="maintenance-back-at-zone" hidden
           data-in-minutes="{{ __('your time (:zone) · in about :minutes min', [], $locale) }}"
           data-soon="{{ __('Any moment now', [], $locale) }}"></p>
    </div>
@endif
@if(($details['message'] ?? null) !== null)
    <figure class="message" data-slot="maintenance-message">
        <blockquote>{{ __('“:message”', ['message' => $details['message']], $locale) }}</blockquote>
        @if(($details['author'] ?? null) !== null)
            <figcaption>{{ __(':name, instance admin', ['name' => $details['author']], $locale) }}</figcaption>
        @endif
    </figure>
@endif
```

(The quotes are a translation: `“:message”` in English, `« :message »` in French, `«:message»` in Spanish, `„:message“` in German.) In the one existing `<script>`, before `wait()`:

```js
var zone = document.querySelector('[data-slot="maintenance-back-at-zone"]');
var time = document.querySelector('[data-slot="maintenance-back-at"] time');
if (zone && time) {
    var at = new Date(time.getAttribute('datetime'));
    var lang = document.documentElement.lang;
    time.textContent = new Intl.DateTimeFormat(lang, { hour: 'numeric', minute: '2-digit' }).format(at);
    var minutes = Math.round((at.getTime() - Date.now()) / 60000);
    var zoneName = (new Intl.DateTimeFormat(lang, { timeZoneName: 'short' }).formatToParts(at).find(function (part) { return part.type === 'timeZoneName'; }) || { value: '' }).value;
    zone.textContent = minutes > 0
        ? zone.getAttribute('data-in-minutes').replace(':zone', zoneName).replace(':minutes', String(minutes))
        : zone.getAttribute('data-soon');
    zone.hidden = false;
}
```

CSS in the page's `<style>` (tokens of the block; `--sky*` are the info-soft tokens already copied): `.back-at { width: 100%; padding: 0.75rem 1rem; border-radius: 0.75rem; background: var(--sky); border: 1px solid var(--sky-border); }`, display size for `.back-at-time` (`font-family` display, `1.75rem`), `.message blockquote { margin: 0; font-style: italic; }`, `figcaption { font-size: 0.75rem; color: var(--muted-foreground); }`, `.link { margin-left: auto; font-size: 0.75rem; color: var(--primary-text); }`.

- [ ] **Step 4: Run on PostgreSQL and SQLite** — `tests/Feature/ErrorPagesTest.php tests/Feature/MaintenanceDetailsTest.php tests/Feature/Database/ConcurrencyErrorResponseTest.php`.
- [ ] **Step 5: Commit** — `feat(errors): time of return, admin message and status link on the 503 page`

### Lane R

### Task 9: Access requests — model and actions

**Files:**
- Create: `database/migrations/2026_10_21_100000_create_team_access_requests_table.php`, `app/Enums/TeamAccessRequestStatus.php`, `app/Models/TeamAccessRequest.php`, `database/factories/TeamAccessRequestFactory.php`, `app/Actions/Teams/RequestTeamAccess.php`, `AnswerTeamAccessRequest.php`, `AccessRequestRecipients.php`
- Modify: `app/Models/Team.php` (`accessRequests()`)
- Test: `tests/Feature/TeamAccessRequests/RequestTeamAccessTest.php`, `AnswerTeamAccessRequestTest.php`, `tests/Concurrency/TeamAccessRequestTest.php`

**Interfaces:**
- Produces: `RequestTeamAccess::handle(User $requester, Team $team, ?string $message): TeamAccessRequest` (throws `ValidationException` key `team` when the requester is already a member or outside the workspace); `AnswerTeamAccessRequest::handle(User $manager, TeamAccessRequest $request, bool $approve): TeamAccessRequestStatus` (returns the final status; throws `ValidationException` key `request` "already answered"); `AccessRequestRecipients::for(Team $team): Collection<int, User>`; the actions send no notification: the controller of Task 10 sends them after the action returns, outside its transaction.

- [ ] **Step 1: Write the failing tests**

```php
<?php
// tests/Feature/TeamAccessRequests/RequestTeamAccessTest.php

use App\Actions\Teams\AccessRequestRecipients;
use App\Actions\Teams\RequestTeamAccess;
use App\Enums\TeamAccessRequestStatus;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\TeamAccessRequest;
use App\Models\User;
use Illuminate\Validation\ValidationException;

function workspaceMemberOutside(Team $team): User
{
    $user = User::factory()->create();
    $team->workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);

    return $user;
}

it('creates one pending request with the message', function () {
    $team = Team::factory()->create();
    $nadia = workspaceMemberOutside($team);

    $request = resolve(RequestTeamAccess::class)->handle($nadia, $team, "  I'm covering for Théo.  ");

    expect($request->status)->toBe(TeamAccessRequestStatus::Pending)
        ->and($request->message)->toBe("I'm covering for Théo.")
        ->and(TeamAccessRequest::query()->count())->toBe(1);
});

it('returns the pending request instead of a second one', function () {
    $team = Team::factory()->create();
    $nadia = workspaceMemberOutside($team);

    $first = resolve(RequestTeamAccess::class)->handle($nadia, $team, null);
    $second = resolve(RequestTeamAccess::class)->handle($nadia, $team, 'Again');

    expect($second->id)->toBe($first->id)->and(TeamAccessRequest::query()->count())->toBe(1);
});

it('refuses a member of the team and a stranger to the workspace', function (Closure $who) {
    $team = Team::factory()->create();

    expect(fn () => resolve(RequestTeamAccess::class)->handle($who($team), $team, null))
        ->toThrow(ValidationException::class);
})->with([
    'member' => [fn (Team $team) => teamMember($team)],
    'stranger' => [fn (Team $team) => User::factory()->create()],
]);

it('sends the request to the owners and admins of the workspace', function () {
    $team = Team::factory()->create();
    $owner = workspaceManager($team->workspace, WorkspaceRole::Owner);
    $admin = workspaceManager($team->workspace, WorkspaceRole::Admin);
    teamMember($team);

    expect(resolve(AccessRequestRecipients::class)->for($team)->pluck('id')->sort()->values()->all())
        ->toBe(collect([$owner->id, $admin->id])->sort()->values()->all());
});
```

```php
<?php
// tests/Feature/TeamAccessRequests/AnswerTeamAccessRequestTest.php

use App\Actions\Teams\AnswerTeamAccessRequest;
use App\Enums\TeamAccessRequestStatus;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\TeamAccessRequest;
use Illuminate\Validation\ValidationException;

it('adds the requester to the team on approval', function () {
    $team = Team::factory()->create();
    $manager = workspaceManager($team->workspace);
    $request = TeamAccessRequest::factory()->for($team)->pending()->create();

    $status = resolve(AnswerTeamAccessRequest::class)->handle($manager, $request, approve: true);

    expect($status)->toBe(TeamAccessRequestStatus::Approved)
        ->and($team->hasMember($request->user))->toBeTrue()
        ->and($request->fresh()->decided_by_user_id)->toBe($manager->id);
});

it('leaves the team as it is on a decline', function () {
    $team = Team::factory()->create();
    $request = TeamAccessRequest::factory()->for($team)->pending()->create();

    resolve(AnswerTeamAccessRequest::class)->handle(workspaceManager($team->workspace), $request, approve: false);

    expect($team->hasMember($request->user))->toBeFalse()
        ->and($request->fresh()->status)->toBe(TeamAccessRequestStatus::Declined);
});

it('declines instead of adding a requester who left the workspace', function () {
    $team = Team::factory()->create();
    $request = TeamAccessRequest::factory()->for($team)->pending()->create();
    $team->workspace->members()->detach($request->user_id);

    $status = resolve(AnswerTeamAccessRequest::class)->handle(workspaceManager($team->workspace), $request, approve: true);

    expect($status)->toBe(TeamAccessRequestStatus::Declined)->and($team->hasMember($request->user))->toBeFalse();
});

it('refuses to answer twice', function () {
    $team = Team::factory()->create();
    $manager = workspaceManager($team->workspace);
    $request = TeamAccessRequest::factory()->for($team)->pending()->create();
    resolve(AnswerTeamAccessRequest::class)->handle($manager, $request, approve: false);

    expect(fn () => resolve(AnswerTeamAccessRequest::class)->handle($manager, $request->fresh(), approve: true))
        ->toThrow(ValidationException::class);
});
```

The factory's `pending()` state creates the requester as a workspace member outside the team (`afterCreating`).

```php
<?php
// tests/Concurrency/TeamAccessRequestTest.php

use App\Actions\Teams\AnswerTeamAccessRequest;
use App\Actions\Teams\RequestTeamAccess;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\TeamAccessRequest;
use App\Models\User;
use Tests\Concurrency\Support\Race;

it('makes one pending request when the same person asks twice at once', function () {
    $team = Team::factory()->create();
    $user = User::factory()->create();
    $team->workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
    [$teamId, $userId] = [$team->id, $user->id];

    $outcomes = Race::run([
        static fn () => resolve(RequestTeamAccess::class)->handle(User::query()->findOrFail($userId), Team::query()->findOrFail($teamId), 'a')->id,
        static fn () => resolve(RequestTeamAccess::class)->handle(User::query()->findOrFail($userId), Team::query()->findOrFail($teamId), 'b')->id,
    ]);

    expect(array_column($outcomes, 'ok'))->each->toBeTrue()
        ->and(TeamAccessRequest::query()->count())->toBe(1);
});

it('gives one outcome to an approval and a decline at once', function () {
    $team = Team::factory()->create();
    $request = TeamAccessRequest::factory()->for($team)->pending()->create();
    [$requestId, $firstId, $secondId] = [$request->id, workspaceManager($team->workspace)->id, workspaceManager($team->workspace)->id];

    $outcomes = Race::run([
        static fn () => resolve(AnswerTeamAccessRequest::class)->handle(User::query()->findOrFail($firstId), TeamAccessRequest::query()->findOrFail($requestId), true)->value,
        static fn () => resolve(AnswerTeamAccessRequest::class)->handle(User::query()->findOrFail($secondId), TeamAccessRequest::query()->findOrFail($requestId), false)->value,
    ]);

    $final = TeamAccessRequest::query()->findOrFail($requestId);
    expect(collect($outcomes)->where('ok', true))->toHaveCount(1)
        ->and($team->hasMember($final->user))->toBe($final->status->value === 'approved');
});
```

- [ ] **Step 2: Run to see them fail** (feature tests on SQLite in memory; the race file is run in Step 4 only).

- [ ] **Step 3: Implement**

Migration:

```php
Schema::create('team_access_requests', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
    $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
    $table->text('message')->nullable();
    $table->string('status', 16);
    $table->foreignUuid('decided_by_user_id')->nullable()->constrained('users')->nullOnDelete();
    $table->dateTime('decided_at')->nullable();
    $table->timestamps();
    $table->index(['team_id', 'status']);
    $table->index(['user_id', 'status']);
});
```

```php
class RequestTeamAccess
{
    public const int MaxMessageLength = 500;

    public function handle(User $requester, Team $team, ?string $message): TeamAccessRequest
    {
        $message = $message === null ? null : trim($message);

        return DB::transaction(function () use ($requester, $team, $message): TeamAccessRequest {
            $lockedTeam = Team::query()->whereKey($team->id)->lockForUpdate()->firstOrFail();

            if (! $requester->belongsToWorkspace($lockedTeam->workspace)) {
                throw ValidationException::withMessages(['team' => __('You are not in the workspace of this team.')]);
            }

            if ($lockedTeam->hasMember($requester)) {
                throw ValidationException::withMessages(['team' => __('You are already in this team.')]);
            }

            $pending = TeamAccessRequest::query()
                ->where('team_id', $lockedTeam->id)
                ->where('user_id', $requester->id)
                ->where('status', TeamAccessRequestStatus::Pending)
                ->first();

            if ($pending !== null) {
                return $pending;
            }

            return TeamAccessRequest::query()->create([
                'team_id' => $lockedTeam->id,
                'user_id' => $requester->id,
                'message' => $message === '' ? null : $message,
                'status' => TeamAccessRequestStatus::Pending,
            ]);
        }, Transactions::Attempts);
    }
}
```

```php
class AnswerTeamAccessRequest
{
    public function handle(User $manager, TeamAccessRequest $request, bool $approve): TeamAccessRequestStatus
    {
        return DB::transaction(function () use ($manager, $request, $approve): TeamAccessRequestStatus {
            $team = Team::query()->whereKey($request->team_id)->lockForUpdate()->firstOrFail();
            $locked = TeamAccessRequest::query()->whereKey($request->id)->lockForUpdate()->firstOrFail();

            if ($locked->status !== TeamAccessRequestStatus::Pending) {
                throw ValidationException::withMessages(['request' => __('This request was already answered.')]);
            }

            $canJoin = $approve && $locked->user->belongsToWorkspace($team->workspace);
            $status = $canJoin ? TeamAccessRequestStatus::Approved : TeamAccessRequestStatus::Declined;

            if ($canJoin) {
                $team->members()->syncWithoutDetaching([$locked->user_id]);
            }

            $locked->update(['status' => $status, 'decided_by_user_id' => $manager->id, 'decided_at' => now()]);

            return $status;
        }, Transactions::Attempts);
    }
}
```

(`Transactions::Attempts` is allowed: the callbacks touch the database only — rule 6. The notifications of Task 10 are sent after the call returns, outside the transaction.)

```php
class AccessRequestRecipients
{
    /**
     * The people who can add members to a team today. Team roles (plan 23) change this one place.
     *
     * @return Collection<int, User>
     */
    public function for(Team $team): Collection
    {
        return $team->workspace->members()
            ->wherePivotIn('role', [WorkspaceRole::Owner->value, WorkspaceRole::Admin->value])
            ->orderBy('users.id')
            ->get();
    }
}
```

- [ ] **Step 4: Run** the feature files on PostgreSQL and SQLite; the race file with `bin/test-db pgsql --concurrency -- tests/Concurrency/TeamAccessRequestTest.php`, then `mariadb`, `mysql`, `sqlite-file`. Expected: PASS on each; removing `lockForUpdate()` in `RequestTeamAccess` makes the first case fail on pgsql (check once, then restore).
- [ ] **Step 5: Commit** — `feat(teams): access requests and their answers`

### Task 10: Access requests — routes, notifications, bell

**Files:**
- Create: `app/Http/Controllers/TeamAccessRequestsController.php`, `app/Http/Requests/TeamAccessRequestStoreRequest.php`, `TeamAccessRequestUpdateRequest.php`, `app/Notifications/TeamAccessRequestedNotification.php`, `TeamAccessAnsweredNotification.php`, `app/Actions/Notifications/PresentAccessRequestNotifications.php`
- Modify: `routes/web.php` (inside the `w/{workspace}` group), `app/Actions/Notifications/ListNotifications.php`
- Test: `tests/Feature/TeamAccessRequests/AccessRequestNotificationsTest.php`

**Interfaces:**
- Consumes: Task 9.
- Produces: routes `teams.accessRequests.store` (POST, JSON `{status: 'pending'}`, 201), `teams.accessRequests.update` (PATCH `{decision: 'approve'|'decline'}`, JSON `{status}`); notification kinds `access_request` (`TeamAccessRequestedNotification::Kind`) and `access_answered`; presented shape for `access_request`: `{actor: {name, presence, avatarUrl}, team: string, excerpt: ?string, request: {id: string, status: 'pending'|'approved'|'declined', decidedBy: ?string, updateUrl: string}, href: string}`; for `access_answered`: `{team: string, outcome: 'approved'|'declined', href: string}`.

- [ ] **Step 1: Write the failing tests**

```php
<?php

use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\TeamAccessRequest;
use App\Models\User;
use App\Models\Workspace;

function requestAccess(mixed $test, User $user, Team $team, ?string $message = null)
{
    return $test->actingAs($user)->postJson(
        route('teams.accessRequests.store', [$team->workspace, $team]),
        ['message' => $message],
    );
}

it('notifies every manager in the bell and answers pending', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $manager = workspaceManager($team->workspace);
    $nadia = User::factory()->create(['name' => 'Nadia']);
    $team->workspace->members()->attach($nadia, ['role' => WorkspaceRole::Member->value]);

    requestAccess($this, $nadia, $team, "I'm covering for Théo.")->assertCreated()->assertJson(['status' => 'pending']);

    $this->actingAs($manager)->getJson(route('notifications.index'))
        ->assertJsonPath('notifications.0.kind', 'access_request')
        ->assertJsonPath('notifications.0.team', 'Atlas')
        ->assertJsonPath('notifications.0.actor.name', 'Nadia')
        ->assertJsonPath('notifications.0.excerpt', "I'm covering for Théo.")
        ->assertJsonPath('notifications.0.request.status', 'pending');
});

it('refuses a sixth request within an hour', function () {
    $workspace = Workspace::factory()->create();
    $teams = Team::factory()->count(6)->for($workspace)->create();
    $user = User::factory()->create();
    $workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);

    foreach ($teams->take(5) as $team) {
        requestAccess($this, $user, $team)->assertCreated();
    }

    requestAccess($this, $user, $teams->last())->assertTooManyRequests();
});

it('lets a manager approve, then tells the requester', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $manager = workspaceManager($team->workspace);
    $request = TeamAccessRequest::factory()->for($team)->pending()->create();

    $this->actingAs($manager)
        ->patchJson(route('teams.accessRequests.update', [$team->workspace, $team, $request]), ['decision' => 'approve'])
        ->assertOk()->assertJson(['status' => 'approved']);

    $this->actingAs($request->user)->getJson(route('notifications.index'))
        ->assertJsonPath('notifications.0.kind', 'access_answered')
        ->assertJsonPath('notifications.0.outcome', 'approved')
        ->assertJsonPath('notifications.0.href', route('teams.show', [$team->workspace, $team]));
});

it('refuses an answer from someone who cannot manage the team', function () {
    $team = Team::factory()->create();
    $request = TeamAccessRequest::factory()->for($team)->pending()->create();

    $this->actingAs(teamMember($team))
        ->patchJson(route('teams.accessRequests.update', [$team->workspace, $team, $request]), ['decision' => 'approve'])
        ->assertForbidden();
});

it('answers 422 to a second answer', function () {
    $team = Team::factory()->create();
    $manager = workspaceManager($team->workspace);
    $request = TeamAccessRequest::factory()->for($team)->pending()->create();
    $url = route('teams.accessRequests.update', [$team->workspace, $team, $request]);

    $this->actingAs($manager)->patchJson($url, ['decision' => 'decline'])->assertOk();
    $this->actingAs($manager)->patchJson($url, ['decision' => 'approve'])->assertUnprocessable();
});

it('drops the request from the bell of a manager who lost the right', function () {
    $team = Team::factory()->create();
    $manager = workspaceManager($team->workspace);
    $nadia = User::factory()->create();
    $team->workspace->members()->attach($nadia, ['role' => WorkspaceRole::Member->value]);
    requestAccess($this, $nadia, $team);
    $team->workspace->members()->updateExistingPivot($manager->id, ['role' => WorkspaceRole::Member->value]);

    $this->actingAs($manager)->getJson(route('notifications.index'))->assertJsonCount(0, 'notifications');
});
```

The throttle key is per user (`throttle:5,60,teamAccessRequests` keys on the signed-in user by default; re-read the installed `ThrottleRequests` if the key is the IP).

- [ ] **Step 2: Run to see them fail.**

- [ ] **Step 3: Implement**

Routes, inside the `w/{workspace}` group next to `teams/{team}/members`:

```php
Route::post('teams/{team}/access-requests', [TeamAccessRequestsController::class, 'store'])
    ->middleware('throttle:5,60,teamAccessRequests')
    ->name('teams.accessRequests.store');
Route::patch('teams/{team}/access-requests/{accessRequest}', [TeamAccessRequestsController::class, 'update'])
    ->whereUuid('accessRequest')
    ->name('teams.accessRequests.update');
```

`{accessRequest}` is scoped to `{team}` by `scopeBindings()` (the group has it): add `Team::accessRequests(): HasMany`.

```php
class TeamAccessRequestsController extends Controller
{
    public function store(TeamAccessRequestStoreRequest $request, Workspace $workspace, Team $team, RequestTeamAccess $requestTeamAccess, AccessRequestRecipients $recipients): JsonResponse
    {
        $accessRequest = $requestTeamAccess->handle($request->user(), $team, $request->validated('message'));

        if ($accessRequest->wasRecentlyCreated) {
            Notification::send(
                $recipients->for($team)->reject(fn (User $user): bool => $user->is($request->user())),
                new TeamAccessRequestedNotification($accessRequest->id),
            );
        }

        return response()->json(['status' => $accessRequest->status->value], 201);
    }

    public function update(TeamAccessRequestUpdateRequest $request, Workspace $workspace, Team $team, TeamAccessRequest $accessRequest, AnswerTeamAccessRequest $answer): JsonResponse
    {
        Gate::authorize('manageMembers', $team);

        $status = $answer->handle($request->user(), $accessRequest, $request->validated('decision') === 'approve');

        $accessRequest->user->notify(new TeamAccessAnsweredNotification($accessRequest->id));

        return response()->json(['status' => $status->value]);
    }
}
```

`TeamAccessRequestStoreRequest`: `'message' => ['nullable', 'string', 'max:'.RequestTeamAccess::MaxMessageLength]`. Update request: `'decision' => ['required', Rule::in(['approve', 'decline'])]`. Both notifications: `via()` → `['database']`, `toArray()` → `['kind' => self::Kind, 'requestId' => $this->requestId]` (shape of `WorkspaceInvitationReceivedNotification`, not queued: they are tiny and must be in the bell before the JSON answer).

`PresentAccessRequestNotifications::handle(User $user, Collection $notifications): array` loads the requests (`with(['team.workspace', 'user', 'decidedBy'])`) and presents `access_request` only when `$user->can('manageMembers', $request->team)`, `access_answered` only for the request's own user; excerpt = `Str::limit($message, 120)`; `actor` built like `PresentInvitationNotifications::actor()` (re-read it and reuse its method by extracting it to a shared private-free helper if it is private: `App\Actions\Notifications\PresentActor`). `ListNotifications`: add the presenter to the constructor and the `$presented` spread, and both kinds to `hasPresenter()`.

- [ ] **Step 4: Run on PostgreSQL and SQLite** — `tests/Feature/TeamAccessRequests tests/Feature/Notifications`.
- [ ] **Step 5: Commit** — `feat(teams): access requests in the bell`

### Task 11: The 403 page knows the team; version on error pages

**Files:**
- Create: `app/Actions/Teams/ResolveDeniedTeam.php`, `PresentAccessRequestOffer.php`
- Modify: `app/Http/ErrorPageResponder.php`
- Test: `tests/Feature/TeamAccessRequests/ForbiddenTeamPageTest.php`, `tests/Feature/ErrorPagesTest.php` (version cases)

**Interfaces:**
- Consumes: Tasks 3, 9.
- Produces: error-page props `accessRequest?: {team: {id, name}, workspace: {name}, memberCount: int, managers: array<int, {name, avatarUrl}>, managersMore: int, pending: bool, storeUrl: string}`, `version?: string` (signed-in viewers; on the 500 page from config with no user check other than the session's user id being present), `statusUrl: string`.

- [ ] **Step 1: Write the failing tests**

```php
<?php

use App\Enums\WorkspaceRole;
use App\Models\GameRoom;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use App\Models\TeamAccessRequest;
use App\Models\TeamSurvey;
use App\Models\User;
use App\Models\Whiteboard;
use Inertia\Testing\AssertableInertia as Assert;

function outsiderOf(Team $team): User
{
    $user = User::factory()->create();
    $team->workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);

    return $user;
}

it('offers access to the team behind every denied page of a workspace member', function (Closure $url) {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $manager = workspaceManager($team->workspace);
    $manager->update(['name' => 'Camille Roux']);

    $this->actingAs(outsiderOf($team))->get($url($team))
        ->assertForbidden()
        ->assertInertia(fn (Assert $page) => $page
            ->component('errors/error')
            ->where('accessRequest.team.name', 'Atlas')
            ->where('accessRequest.managers.0.name', 'Camille Roux')
            ->where('accessRequest.pending', false)
            ->where('accessRequest.storeUrl', route('teams.accessRequests.store', [$team->workspace, $team])));
})->with([
    'team page' => [fn (Team $team) => route('teams.show', [$team->workspace, $team])],
    'retro' => [fn (Team $team) => route('retros.show', Retro::factory()->for($team)->create())],
    'poker' => [fn (Team $team) => route('poker.show', PokerGame::factory()->for($team)->create())],
    'whiteboard' => [fn (Team $team) => route('whiteboards.show', Whiteboard::factory()->for($team)->create())],
    'survey' => [fn (Team $team) => route('surveys.show', TeamSurvey::factory()->for($team)->create())],
    'game room' => [fn (Team $team) => route('games.show', GameRoom::factory()->for($team)->create())],
]);

it('opens in the sent state when a request is pending', function () {
    $team = Team::factory()->create();
    $request = TeamAccessRequest::factory()->for($team)->pending()->create();

    $this->actingAs($request->user)->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page->where('accessRequest.pending', true));
});

it('names no team and nobody to a stranger to the workspace', function () {
    $team = Team::factory()->create(['name' => 'Secret team']);
    $retro = Retro::factory()->for($team)->create();

    foreach ([route('teams.show', [$team->workspace, $team]), route('retros.show', $retro)] as $url) {
        $response = $this->actingAs(User::factory()->create())->get($url)->assertForbidden();

        $response->assertInertia(fn (Assert $page) => $page->missing('accessRequest'));
        expect($response->getContent())->not->toContain('Secret team');
    }
});

it('offers nothing on a 403 that is not about a team', function () {
    config(['skrum.signup_mode' => 'invite']);
    User::factory()->create();

    $this->get(route('register'))->assertForbidden()->assertInertia(fn (Assert $page) => $page->missing('accessRequest'));
});
```

Add to `ErrorPagesTest.php`:

```php
it('shows the version to a signed-in viewer only, the 500 page included', function () {
    config(['skrum.version' => '1.8.2', 'app.debug' => false]);
    Route::middleware('web')->get('/error-pages-probe/failing', fn () => throw new RuntimeException('x'));

    $this->get('/no-such-page')->assertInertia(fn (Assert $page) => $page->missing('version'));
    $this->actingAs(User::factory()->create());
    $this->get('/no-such-page')->assertInertia(fn (Assert $page) => $page->where('version', '1.8.2'));
    $this->get('/error-pages-probe/failing')->assertInertia(fn (Assert $page) => $page->where('version', '1.8.2'));
});

it('links every error page to the status page', function () {
    $this->get('/no-such-page')->assertInertia(fn (Assert $page) => $page->where('statusUrl', route('status.show')));
});
```

(Re-read the factories' names for `TeamSurvey` and `GameRoom` and the route names `surveys.show`, `games.show`; spec §17 item 7: if a binding does not happen before the middleware's abort, `ResolveDeniedTeam` reads the raw route parameter with `Model::query()->find()`.)

- [ ] **Step 2: Run to see them fail.**

- [ ] **Step 3: Implement**

```php
class ResolveDeniedTeam
{
    /** @var array<int, string> */
    private const array SessionParameters = ['retro', 'game', 'board', 'teamSurvey', 'room'];

    /**
     * The team a signed-in member of its workspace was refused, or null: nothing is said to anyone else.
     */
    public function handle(Request $request): ?Team
    {
        $user = $request->user();
        $team = $this->teamOf($request);

        if (! $user instanceof User || $team === null) {
            return null;
        }

        if (! $user->belongsToWorkspace($team->workspace)) {
            return null;
        }

        return $team->hasMember($user) ? null : $team;
    }

    private function teamOf(Request $request): ?Team
    {
        $route = $request->route();

        if ($route === null) {
            return null;
        }

        $team = $route->parameter('team');

        if ($team instanceof Team) {
            return $team;
        }

        foreach (self::SessionParameters as $name) {
            $session = $route->parameter($name);

            if ($session instanceof Model && $session->getAttribute('team_id') !== null) {
                return Team::query()->find($session->getAttribute('team_id'));
            }
        }

        return null;
    }
}
```

(`App\Actions` may not use `App\Http`; `Illuminate\Http\Request` is the framework's, allowed.)

```php
class PresentAccessRequestOffer
{
    private const int ManagersShown = 3;

    public function __construct(private AccessRequestRecipients $recipients) {}

    /** @return array<string, mixed> */
    public function handle(User $viewer, Team $team): array
    {
        $managers = Alphabetical::sort($this->recipients->for($team), fn (User $manager): string => $manager->name);

        return [
            'team' => $team->only(['id', 'name']),
            'workspace' => ['name' => $team->workspace->name],
            'memberCount' => $team->members()->count(),
            'managers' => $managers->take(self::ManagersShown)
                ->map(fn (User $manager): array => ['name' => $manager->name, 'avatarUrl' => $manager->avatarUrl()])
                ->values()->all(),
            'managersMore' => max(0, $managers->count() - self::ManagersShown),
            'pending' => $team->accessRequests()->where('user_id', $viewer->id)->where('status', TeamAccessRequestStatus::Pending)->exists(),
            'storeUrl' => route('teams.accessRequests.store', [$team->workspace, $team]),
        ];
    }
}
```

`ErrorPageResponder::props()`: add `'statusUrl' => route('status.show')` always; `version` when `$response->request->user() !== null` (inside `rescue`, report false); for status 403, `$team = rescue(fn () => resolve(ResolveDeniedTeam::class)->handle($request), null, false)` and when non-null `'accessRequest' => resolve(PresentAccessRequestOffer::class)->handle($request->user(), $team)`. The props are computed inside `throughPageMiddleware` so the session user is known for a request that matched no route (move the `props()` call into the closure). `serverError()`: add `'version' => config('skrum.version')` when the session holds a user id (`$request->hasSession() && $request->session()->has(Auth::guard()->getName())` — re-read how the 500 path reaches the session; no database read) and `'statusUrl' => '/status'`.

- [ ] **Step 4: Run on PostgreSQL and SQLite** — `tests/Feature/TeamAccessRequests tests/Feature/ErrorPagesTest.php`.
- [ ] **Step 5: Commit** — `feat(errors): access-request offer on the 403 page, version and status link`

### Lane U

### Task 12: General section — back end

**Files:**
- Create: `app/Http/Controllers/Admin/GeneralSettingsController.php`, `app/Http/Requests/Admin/GeneralSettingsUpdateRequest.php`, `resources/js/pages/admin/general.tsx` (thin: renders `AdminShell` with a heading; built in Task 20)
- Modify: `routes/admin.php`, `app/Actions/Auth/SignupGate.php`
- Test: `tests/Feature/Admin/GeneralSettingsTest.php`

**Interfaces:**
- Consumes: Tasks 1, 2, 3, 4.
- Produces: `admin.general.edit` props `{signupMode: ?string, allowedEmailDomains: ?string[], defaults: {signupMode: string, allowedEmailDomains: string[]}, maintenanceMessage: ?string, maintenanceMessageBy: ?{name: string}, maintenanceMessageAt: ?string, updateCheckEnabled: bool, version: string, versionStatus: {state, latest, checkedAt}}`; `admin.general.update` accepts `signup_mode` (nullable, in modes), `allowed_email_domains` (nullable array of domains, max 20), `maintenance_message` (nullable, max 280), `update_check_enabled` (boolean); `/admin` redirects to `admin.general.edit`.

- [ ] **Step 1: Write the failing tests**

```php
<?php

use App\Enums\AuditAction;
use App\Jobs\CheckForUpdate;
use App\Models\AuditEvent;
use App\Models\User;
use App\Support\InstanceSettings;
use Illuminate\Support\Facades\Queue;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->admin = User::factory()->instanceAdmin()->create();
    $this->actingAs($this->admin)->withSession(['auth.password_confirmed_at' => time()]);
});

it('opens general from /admin with the environment values as defaults', function () {
    config(['skrum.signup_mode' => 'domain', 'skrum.allowed_email_domains' => ['acme.fr']]);

    $this->get('/admin')->assertRedirect(route('admin.general.edit'));
    $this->get(route('admin.general.edit'))->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('admin/general')
        ->where('signupMode', null)
        ->where('defaults.signupMode', 'domain')
        ->where('defaults.allowedEmailDomains', ['acme.fr'])
        ->where('updateCheckEnabled', false));
});

it('stores the sign-up mode, which the sign-up gate then follows', function () {
    config(['skrum.signup_mode' => 'invite']);
    User::factory()->create();

    $this->put(route('admin.general.update'), ['signup_mode' => 'open'])->assertRedirect(route('admin.general.edit'));
    auth()->logout();

    $this->get(route('register'))->assertOk();
});

it('keeps the author of the maintenance message and audits the change', function () {
    $this->put(route('admin.general.update'), ['maintenance_message' => 'Back soon.']);

    expect(resolve(InstanceSettings::class)->maintenanceMessageBy())->toBe($this->admin->id)
        ->and(AuditEvent::query()->where('action', AuditAction::SettingsUpdated)->sole()->properties)
        ->toBeIgnoringKeyOrder(['section' => 'general', 'keys' => ['maintenance_message', 'maintenance_message_by']]);
});

it('runs the update check once when the switch is turned on', function () {
    Queue::fake();

    $this->put(route('admin.general.update'), ['update_check_enabled' => true]);

    Queue::assertPushed(CheckForUpdate::class, 1);
});

it('refuses a domain that is not one', function () {
    $this->put(route('admin.general.update'), ['signup_mode' => 'domain', 'allowed_email_domains' => ['not a domain']])
        ->assertSessionHasErrors('allowed_email_domains.0');
});

it('requires at least one domain in domain mode', function () {
    config(['skrum.allowed_email_domains' => []]);

    $this->put(route('admin.general.update'), ['signup_mode' => 'domain', 'allowed_email_domains' => []])
        ->assertSessionHasErrors('allowed_email_domains');
});

it('leaves the general settings in place on a branding reset', function () {
    $this->put(route('admin.general.update'), ['signup_mode' => 'open']);
    $this->delete(route('admin.branding.destroy'));

    expect(resolve(InstanceSettings::class)->signupMode())->toBe('open');
});
```

- [ ] **Step 2: Run to see them fail.**

- [ ] **Step 3: Implement**

`routes/admin.php`: change `admin` to redirect to `admin.general.edit`; add under `RequirePassword`: `Route::get('admin/general', [GeneralSettingsController::class, 'edit'])->name('admin.general.edit'); Route::put('admin/general', [GeneralSettingsController::class, 'update'])->name('admin.general.update');`.

`GeneralSettingsUpdateRequest::rules()`:

```php
return [
    'signup_mode' => ['sometimes', 'nullable', Rule::enum(SignupMode::class)],
    'allowed_email_domains' => ['sometimes', 'nullable', 'array', 'max:20', Rule::requiredIf(fn (): bool => $this->input('signup_mode') === SignupMode::Domain->value && config('skrum.allowed_email_domains') === [])],
    'allowed_email_domains.*' => ['string', 'max:253', 'regex:/^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i'],
    'maintenance_message' => ['sometimes', 'nullable', 'string', 'max:'.InstanceSettings::MaintenanceMessageMaxLength],
    'update_check_enabled' => ['sometimes', 'boolean'],
];
```

Controller `update()`: build `$values` from the validated keys present (`signup_mode`, `allowed_email_domains`, `update_check_enabled`, and when `maintenance_message` is present, the message plus `maintenance_message_by` = the admin's id, or both null when cleared); `$changed` = keys whose stored value differs (compare with `$settings->all()`-style readers before writing); `$settings->setMany($values)`; record `SettingsUpdated` with `['section' => 'general', 'keys' => $changed]` when `$changed !== []`; dispatch `CheckForUpdate` when the switch went from off to on; toast `__('General settings saved.')`; redirect to `admin.general.edit`.

`SignupGate`: inject `InstanceSettings`; `SignupMode::tryFrom($this->settings->signupMode() ?? '') ?? SignupMode::fromConfig()` in both methods; `hasAllowedDomain()` reads `$this->settings->allowedEmailDomains() ?? config('skrum.allowed_email_domains')`.

- [ ] **Step 4: Run on PostgreSQL and SQLite** — `tests/Feature/Admin tests/Feature/Auth`.
- [ ] **Step 5: Commit** — `feat(admin): general section (sign-up, maintenance message, updates)`

### Task 13: Users — listing, deactivation, enforcement

**Files:**
- Create: `app/Http/Controllers/Admin/UsersController.php`, `UserDeactivationsController.php`, `app/Http/Requests/Admin/UsersIndexRequest.php`, `app/Actions/Admin/DeactivateUser.php`, `ReactivateUser.php`, `app/Http/Middleware/EnsureAccountIsActive.php`, `app/Actions/Fortify/RefuseDeactivatedAccount.php`, `resources/js/pages/admin/users.tsx` (thin)
- Modify: `routes/admin.php`, `bootstrap/app.php` (web group), `app/Providers/FortifyServiceProvider.php`, `app/Http/Middleware/AuthenticateMcpRequest.php`
- Test: `tests/Feature/Admin/UsersSectionTest.php`, `UserDeactivationTest.php`, `tests/Concurrency/LastActiveAdminTest.php`

**Interfaces:**
- Consumes: Tasks 2, 3.
- Produces: `admin.users.index` props `{users: {data: array<int, {id, name, email, avatarUrl, isAdmin, isDeactivated, hasSecondFactor, workspacesCount, createdAt, lastSignedInAt, isSelf}>, links…, meta…}, filters: {query: ?string, status: 'all'|'active'|'deactivated'|'admins'}, activeAdminCount: int}`; `DeactivateUser::handle(User $admin, User $user): bool` (false when refused: self or last active admin); `ReactivateUser::handle(User $admin, User $user): void`.

- [ ] **Step 1: Write the failing tests**

```php
<?php
// tests/Feature/Admin/UserDeactivationTest.php

use App\Enums\AuditAction;
use App\Enums\McpScope;
use App\Models\AuditEvent;
use App\Models\User;

beforeEach(function () {
    $this->admin = User::factory()->instanceAdmin()->create();
});

function asConfirmedAdmin(mixed $test): void
{
    $test->actingAs($test->admin)->withSession(['auth.password_confirmed_at' => time()]);
}

it('deactivates an account and audits it', function () {
    asConfirmedAdmin($this);
    $user = User::factory()->create();

    $this->post(route('admin.userDeactivations.store', $user))->assertRedirect();

    expect($user->fresh()->isDeactivated())->toBeTrue()
        ->and(AuditEvent::query()->where('action', AuditAction::UserDeactivated)->sole()->subject_id)->toBe($user->id);
});

it('signs a deactivated account out on its next request', function () {
    $user = User::factory()->deactivated()->create();

    $this->actingAs($user)->get(route('dashboard'))
        ->assertRedirect(route('login'))
        ->assertSessionHasErrors('email');
    $this->assertGuest();
});

it('refuses the password login of a deactivated account only with the right password', function () {
    $user = User::factory()->deactivated()->create(['password' => 'password']);

    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password'])
        ->assertSessionHasErrors(['email' => __('This account is deactivated. Ask an admin of the instance.')]);
    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'wrong'])
        ->assertSessionHasErrors(['email' => __('auth.failed')]);
    $this->assertGuest();
});

it('refuses the MCP token of a deactivated account', function () {
    $user = User::factory()->deactivated()->create();
    $token = issueTestMcpToken($user, [McpScope::Read]);

    postMcp($token)->assertUnauthorized();
});

it('refuses to deactivate oneself and the last active admin', function () {
    asConfirmedAdmin($this);

    $this->post(route('admin.userDeactivations.store', $this->admin))->assertSessionHasErrors('user');
    expect($this->admin->fresh()->isDeactivated())->toBeFalse();
});

it('reactivates an account', function () {
    asConfirmedAdmin($this);
    $user = User::factory()->deactivated()->create();

    $this->delete(route('admin.userDeactivations.destroy', $user))->assertRedirect();

    expect($user->fresh()->isDeactivated())->toBeFalse()
        ->and(AuditEvent::query()->where('action', AuditAction::UserReactivated)->exists())->toBeTrue();
});
```

Also: the broadcast authorisation route answers 403 for a deactivated account (re-read the route name in `routes/channels.php` / `BroadcastAuthorizationsController`; spec §17 item 5).

```php
<?php
// tests/Feature/Admin/UsersSectionTest.php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->admin = User::factory()->instanceAdmin()->create(['created_at' => now()->subYear()]);
    $this->actingAs($this->admin)->withSession(['auth.password_confirmed_at' => time()]);
});

it('lists accounts newest first, 25 a page', function () {
    $this->travelTo(now()->setDateTime(2026, 10, 3, 12, 0, 0));
    $older = User::factory()->create(['created_at' => now()->subDay()]);
    $newer = User::factory()->create(['created_at' => now()]);

    $this->get(route('admin.users.index'))->assertInertia(fn (Assert $page) => $page
        ->component('admin/users')
        ->where('users.data.0.id', $newer->id)
        ->where('users.data.1.id', $older->id)
        ->where('users.data.2.id', $this->admin->id));
});

it('filters by status and searches names and addresses', function () {
    User::factory()->deactivated()->create(['name' => 'Théo Martin']);
    User::factory()->create(['name' => 'Camille Roux', 'email' => 'camille@atlas.fr']);

    $this->get(route('admin.users.index', ['status' => 'deactivated']))
        ->assertInertia(fn (Assert $page) => $page->has('users.data', 1)->where('users.data.0.name', 'Théo Martin'));
    $this->get(route('admin.users.index', ['query' => 'ATLAS']))
        ->assertInertia(fn (Assert $page) => $page->has('users.data', 1)->where('users.data.0.name', 'Camille Roux'));
});
```

```php
<?php
// tests/Concurrency/LastActiveAdminTest.php

use App\Actions\Admin\DeactivateUser;
use App\Models\User;
use Tests\Concurrency\Support\Race;

it('keeps one active admin when the last two are deactivated at the same time', function () {
    $first = User::factory()->instanceAdmin()->create()->id;
    $second = User::factory()->instanceAdmin()->create()->id;

    Race::run([
        static fn (): bool => resolve(DeactivateUser::class)->handle(User::query()->findOrFail($second), User::query()->findOrFail($first)),
        static fn (): bool => resolve(DeactivateUser::class)->handle(User::query()->findOrFail($first), User::query()->findOrFail($second)),
    ]);

    expect(User::query()->where('is_instance_admin', true)->whereNull('deactivated_at')->count())->toBe(1);
});
```

- [ ] **Step 2: Run to see them fail.**

- [ ] **Step 3: Implement**

```php
class DeactivateUser
{
    public function __construct(private RecordAuditEvent $recordAuditEvent) {}

    /**
     * False when refused: an admin keeps their own account, and the instance keeps one active admin.
     * Every active admin row is locked before the count, as RevokeInstanceAdmin does.
     */
    public function handle(User $admin, User $user): bool
    {
        if ($admin->is($user)) {
            return false;
        }

        $done = DB::transaction(function () use ($user): bool {
            $activeAdminIds = User::query()
                ->where('is_instance_admin', true)
                ->whereNull('deactivated_at')
                ->orderBy('id')
                ->lockForUpdate()
                ->pluck('id');

            if ($activeAdminIds->contains($user->id) && $activeAdminIds->count() === 1) {
                return false;
            }

            User::query()->whereKey($user->id)->whereNull('deactivated_at')->update(['deactivated_at' => now()]);

            return true;
        }, Transactions::Attempts);

        if ($done) {
            $this->recordAuditEvent->handle(AuditAction::UserDeactivated, $admin, $user);
        }

        return $done;
    }
}
```

`ReactivateUser` sets `deactivated_at` null and records `UserReactivated`.

```php
class EnsureAccountIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user instanceof User || ! $user->isDeactivated()) {
            return $next($request);
        }

        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        if ($request->expectsJson()) {
            abort(403, __('This account is deactivated. Ask an admin of the instance.'));
        }

        return redirect()->route('login')->withErrors(['email' => __('This account is deactivated. Ask an admin of the instance.')]);
    }
}
```

Registered with `$middleware->web(append: [EnsureAccountIsActive::class, …])` before `HandleInertiaRequests`.

```php
class RefuseDeactivatedAccount
{
    /** Speaks only to whoever holds the password: anyone else gets the usual failure further down the pipeline. */
    public function handle(Request $request, Closure $next): mixed
    {
        $user = User::query()->where('email_key', LoginAddress::key((string) $request->input(Fortify::username())))->first();

        if ($user !== null && $user->isDeactivated() && Hash::check((string) $request->input('password'), $user->password)) {
            throw ValidationException::withMessages([Fortify::username() => __('This account is deactivated. Ask an admin of the instance.')]);
        }

        return $next($request);
    }
}
```

(Re-read `LoginAddress` for the method that builds `email_key`.) `FortifyServiceProvider`: `Fortify::authenticateThrough(fn (Request $request) => array_filter([...the installed default pipeline, with RefuseDeactivatedAccount::class inserted after CanonicalizeUsername...]))` — copy the default list from `vendor/laravel/fortify/src/Http/Controllers/AuthenticatedSessionController::loginPipeline()` verbatim (spec §17 item 6).

`AuthenticateMcpRequest`: after the `User` check, `if ($user->isDeactivated()) { return $this->unauthorized(); }`.

`UsersController@index` (`UsersIndexRequest`: `query` nullable string max 100, `status` in the four filters):

```php
$users = User::query()
    ->withCount('workspaces')
    ->when($status === 'active', fn (Builder $query) => $query->whereNull('deactivated_at'))
    ->when($status === 'deactivated', fn (Builder $query) => $query->whereNotNull('deactivated_at'))
    ->when($status === 'admins', fn (Builder $query) => $query->where('is_instance_admin', true))
    ->when($term !== null, fn (Builder $query) => $query->where(fn (Builder $match) => $match
        ->whereContains('name', $term)
        ->orWhereLike('email_key', SearchText::pattern($term), caseSensitive: true)))
    ->orderByDesc('created_at')
    ->orderByDesc('id')
    ->paginate(25)
    ->withQueryString()
    ->through(fn (User $user): array => [...]);
```

(The SQL `LIKE` gives near misses for a term with a wildcard character; the page shows at most 25 rows and a near miss there is acceptable for an admin search — say so in the report.) `hasSecondFactor` from `SecondFactors` (re-read). Routes: `admin/users` GET, `admin/users/{user}/deactivation` POST / DELETE (`whereUuid('user')`), all under `RequirePassword`. `UserDeactivationsController@store` throws `ValidationException::withMessages(['user' => __('You cannot deactivate your own account or the last active admin.')])` when the action returns false.

- [ ] **Step 4: Run** on PostgreSQL and SQLite: `tests/Feature/Admin tests/Feature/Auth tests/Feature/Mcp`; the race with `--concurrency` on `pgsql`, `mariadb`, `mysql`, `sqlite-file`.
- [ ] **Step 5: Commit** — `feat(admin): users section, deactivation and its enforcement`

### Task 14: SSO section — back end

**Files:**
- Create: `app/Actions/Admin/PresentSsoProviders.php`, `TestOidcDiscovery.php`, `app/Http/Controllers/Admin/SsoConnectionTestsController.php`, `app/Http/Requests/Admin/SsoConnectionTestStoreRequest.php`
- Modify: `app/Http/Controllers/Admin/SignInSettingsController.php` (`edit` props), `routes/admin.php`
- Test: `tests/Feature/Admin/SsoSectionTest.php`

**Interfaces:**
- Produces: `admin/sign-in` prop `providerDetails: array<int, {key: 'google'|'github'|'entra'|'oidc', label: string, configured: bool, redirectUri: string, issuer: ?string, clientId: ?string, secretSet: bool, envNames: string[], testable: bool}>`, prop `lastTest: ?{provider, at, ok, ms, issuer}`; route `admin.ssoTests.store` (POST `{provider}`) redirecting back with flash `ssoTest: {ok, ms, issuer, error}`.

- [ ] **Step 1: Write the failing tests**

```php
<?php

use App\Enums\AuditAction;
use App\Models\AuditEvent;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    config([
        'oidc.connections.generic.base_url' => 'https://auth.atlas.test/realms/atlas',
        'oidc.connections.generic.client_id' => 'skrum-prod',
        'oidc.connections.generic.client_secret' => 'very-secret-value',
        'services.google.client_id' => null,
        'services.google.client_secret' => null,
    ]);
    $this->actingAs(User::factory()->instanceAdmin()->create())->withSession(['auth.password_confirmed_at' => time()]);
});

it('describes each provider without any secret', function () {
    $response = $this->get(route('admin.signIn.edit'))->assertOk();

    $response->assertInertia(fn (Assert $page) => $page
        ->where('providerDetails.3.key', 'oidc')
        ->where('providerDetails.3.configured', true)
        ->where('providerDetails.3.clientId', 'skrum-prod')
        ->where('providerDetails.3.secretSet', true)
        ->where('providerDetails.3.redirectUri', route('sso.callback', 'oidc'))
        ->where('providerDetails.0.configured', false));
    expect($response->getContent())->not->toContain('very-secret-value');
});

it('tests the discovery document of the OIDC provider', function () {
    Http::fake(['auth.atlas.test/*' => Http::response(['issuer' => 'https://auth.atlas.test/realms/atlas', 'authorization_endpoint' => 'x', 'token_endpoint' => 'y'])]);

    $this->post(route('admin.ssoTests.store'), ['provider' => 'oidc'])
        ->assertRedirect()
        ->assertSessionHas('inertia.flash_data.ssoTest.ok', true);

    Http::assertSent(fn ($request) => $request->url() === 'https://auth.atlas.test/realms/atlas/.well-known/openid-configuration');
    expect(AuditEvent::query()->where('action', AuditAction::SsoTested)->exists())->toBeTrue();
});

it('reports an issuer that does not match and a failure', function (Closure $answer, string $error) {
    Http::fake(['auth.atlas.test/*' => $answer]);

    $this->post(route('admin.ssoTests.store'), ['provider' => 'oidc'])
        ->assertSessionHas('inertia.flash_data.ssoTest.error', $error);
})->with([
    [fn () => Http::response(['issuer' => 'https://evil.test']), 'issuer_mismatch'],
    [fn () => Http::response('', 500), 'unreachable'],
    [fn () => Http::response('not json'), 'not_oidc'],
]);

it('refuses to test a provider that is not configured or not testable', function (string $provider) {
    Http::fake();

    $this->post(route('admin.ssoTests.store'), ['provider' => $provider])->assertSessionHasErrors('provider');

    Http::assertNothingSent();
})->with(['google', 'github']);
```

(Re-read how the project flashes Inertia data — `Inertia::flash()` — and how tests read it in `SignInSettingsTest` / `BrandingSettingsTest`; use the same assertion.)

- [ ] **Step 2: Run to see them fail.**

- [ ] **Step 3: Implement**

`TestOidcDiscovery::handle(SsoProvider $provider): array{ok: bool, ms: ?int, issuer: ?string, error: ?string}`: base URL = `oidc.connections.generic.base_url` for `Oidc`, `https://login.microsoftonline.com/{tenant}/v2.0` for `Entra`; GET `{base}/.well-known/openid-configuration` with `Http::timeout(5)->acceptJson()`, measure with `hrtime(true)`; `unreachable` on a connection error or a non-2xx; `not_oidc` when `issuer`, `authorization_endpoint` or `token_endpoint` is missing; `issuer_mismatch` when `rtrim(issuer, '/') !== rtrim(base, '/')` for `Oidc` (Entra's issuer holds the tenant id: compare host only); stores `sso_last_test`; records `SsoTested` with `['provider' => …, 'ok' => …]`. `PresentSsoProviders` builds the four rows from `SsoProvider::cases()` reading the same config keys as `requiredConfigKeys()` (re-read; expose that list through a public method `configKeys()` on the enum if it helps — the enum still uses only `config()`), `envNames` per provider (`GOOGLE_CLIENT_ID`, …, `OIDC_BASE_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_LABEL`, `ENTRA_TENANT`, …). Route under `RequirePassword`: `Route::post('admin/sign-in/tests', [SsoConnectionTestsController::class, 'store'])->middleware('throttle:10,1,ssoTests')->name('admin.ssoTests.store');`.

- [ ] **Step 4: Run on PostgreSQL and SQLite** — `tests/Feature/Admin`.
- [ ] **Step 5: Commit** — `feat(admin): SSO providers read-only with a connection test`

### Task 15: SMTP section — back end

**Files:**
- Create: `app/Actions/Admin/PresentMailSettings.php`, `app/Http/Controllers/Admin/MailSettingsController.php`, `MailTestsController.php`, `app/Http/Requests/Admin/MailTestStoreRequest.php`, `app/Mail/InstanceTestMail.php`, `resources/views/mail/instance-test.blade.php`, `resources/js/pages/admin/mail.tsx` (thin)
- Modify: `routes/admin.php`
- Test: `tests/Feature/Admin/MailSectionTest.php`

**Interfaces:**
- Produces: `admin/mail` props `{mail: {mailer: string, delivering: bool, host: ?string, port: ?int, scheme: ?string, username: ?string, passwordSet: bool, from: {address: ?string, name: ?string}}, lastTest: ?{at, ok, to}, defaultRecipient: string}`; route `admin.mailTests.store` (POST `{to}`).

- [ ] **Step 1: Write the failing tests**

```php
<?php

use App\Enums\AuditAction;
use App\Mail\InstanceTestMail;
use App\Models\AuditEvent;
use App\Models\User;
use App\Support\InstanceSettings;
use Illuminate\Support\Facades\Mail;
use Inertia\Testing\AssertableInertia as Assert;
use Symfony\Component\Mailer\Exception\TransportException;

beforeEach(function () {
    config([
        'mail.default' => 'smtp',
        'mail.mailers.smtp.host' => 'smtp.atlas.test',
        'mail.mailers.smtp.port' => 587,
        'mail.mailers.smtp.username' => 'skrum',
        'mail.mailers.smtp.password' => 'smtp-secret-value',
    ]);
    $this->actingAs(User::factory()->instanceAdmin()->create(['email' => 'arnaud@atlas.test']))
        ->withSession(['auth.password_confirmed_at' => time()]);
});

it('shows the mail configuration without the password', function () {
    $response = $this->get(route('admin.mail.show'))->assertOk();

    $response->assertInertia(fn (Assert $page) => $page
        ->component('admin/mail')
        ->where('mail.host', 'smtp.atlas.test')
        ->where('mail.passwordSet', true)
        ->where('mail.delivering', true)
        ->where('defaultRecipient', 'arnaud@atlas.test'));
    expect($response->getContent())->not->toContain('smtp-secret-value');
});

it('sends a test e-mail now and keeps the result', function () {
    Mail::fake();

    $this->post(route('admin.mailTests.store'), ['to' => 'camille@atlas.test'])->assertRedirect();

    Mail::assertSent(InstanceTestMail::class, fn (InstanceTestMail $mail) => $mail->hasTo('camille@atlas.test'));
    expect(resolve(InstanceSettings::class)->mailLastTest())->toMatchArray(['ok' => true, 'to' => 'camille@atlas.test'])
        ->and(AuditEvent::query()->where('action', AuditAction::MailTested)->exists())->toBeTrue();
});

it('turns a transport failure into a sentence', function () {
    Mail::shouldReceive('to->send')->andThrow(new TransportException('Connection refused by smtp.atlas.test'));

    $this->post(route('admin.mailTests.store'), ['to' => 'camille@atlas.test'])
        ->assertSessionHas('inertia.flash_data.mailTest.error', 'transport');

    expect(resolve(InstanceSettings::class)->mailLastTest()['ok'])->toBeFalse();
});

it('refuses the sixth test within ten minutes', function () {
    Mail::fake();

    foreach (range(1, 5) as $attempt) {
        $this->post(route('admin.mailTests.store'), ['to' => 'camille@atlas.test']);
    }

    $this->post(route('admin.mailTests.store'), ['to' => 'camille@atlas.test'])->assertTooManyRequests();
});
```

- [ ] **Step 2: Run to see them fail.**
- [ ] **Step 3: Implement** — `MailTestsController@store`: `Mail::to($to)->send(new InstanceTestMail($instanceName))` inside `try`; catch `TransportExceptionInterface` → `error = 'transport'`; any other `Throwable` → report, `error = 'unknown'`; store `mail_last_test = ['at' => now()->toIso8601String(), 'ok' => $ok, 'to' => $to]`; audit `MailTested` with `['ok' => $ok]` (no address in the audit: the address is personal data the admin typed, kept in the setting only); flash `mailTest`. `InstanceTestMail` (not queued) uses the existing mail layout (re-read `resources/views/mail/`), subject `__('Test e-mail from :name', ['name' => …])`. Routes: `admin/mail` GET, `admin/mail/tests` POST with `throttle:5,10,mailTests`.
- [ ] **Step 4: Run on PostgreSQL and SQLite.**
- [ ] **Step 5: Commit** — `feat(admin): SMTP section with a test e-mail`

### Task 16: Integrations section — back end

**Files:**
- Create: `app/Actions/Admin/PresentIntegrationSettings.php`, `app/Http/Controllers/Admin/IntegrationSettingsController.php`, `app/Http/Requests/Admin/IntegrationSettingsUpdateRequest.php`, `resources/js/pages/admin/integrations.tsx` (thin)
- Modify: `app/Enums/IntegrationProvider.php`, `tests/Arch/ArchTest.php`, `routes/admin.php`, `app/Http/Middleware/HandleInertiaRequests.php` (no change expected: re-read `features.integrations`)
- Test: `tests/Feature/Admin/IntegrationSettingsTest.php`

**Interfaces:**
- Produces: `IntegrationProvider::isEnabled()` = configured and not in `InstanceSettings::disabledIntegrations()`; `admin/integrations` props `{providers: array<int, {key, label, configured: bool, enabled: bool, connectedTeams: int, envNames: string[]}>}`; `admin.integrations.update` accepts `disabled: string[]`.

- [ ] **Step 1: Write the failing tests**

```php
<?php

use App\Enums\IntegrationProvider;
use App\Models\TeamIntegration;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    config(['services.slack.client_id' => 'id', 'services.slack.client_secret' => 'secret', 'services.linear.client_id' => null]);
    $this->actingAs(User::factory()->instanceAdmin()->create())->withSession(['auth.password_confirmed_at' => time()]);
});

it('lists every provider with its state and the teams that use it', function () {
    TeamIntegration::factory()->count(2)->create(['provider' => IntegrationProvider::Slack]);

    $this->get(route('admin.integrations.edit'))->assertInertia(fn (Assert $page) => $page
        ->component('admin/integrations')
        ->where('providers.0.key', 'slack')
        ->where('providers.0.configured', true)
        ->where('providers.0.enabled', true)
        ->where('providers.0.connectedTeams', 2));
});

it('turns a configured provider off and on, keeping the team integrations', function () {
    $integration = TeamIntegration::factory()->create(['provider' => IntegrationProvider::Slack]);

    $this->put(route('admin.integrations.update'), ['disabled' => ['slack']])->assertRedirect();
    expect(IntegrationProvider::Slack->isEnabled())->toBeFalse();
    $this->get(route('integrations.callback', 'slack'))->assertNotFound();

    $this->put(route('admin.integrations.update'), ['disabled' => []]);
    expect(IntegrationProvider::Slack->isEnabled())->toBeTrue()
        ->and($integration->fresh())->not->toBeNull();
});

it('refuses to turn on a provider that is not configured', function () {
    expect(IntegrationProvider::Linear->isEnabled())->toBeFalse();

    $this->put(route('admin.integrations.update'), ['disabled' => []]);

    expect(IntegrationProvider::Linear->isEnabled())->toBeFalse();
});
```

(Re-read the `TeamIntegration` factory and how "active" is defined (`isActive()`); count active ones only.)

- [ ] **Step 2: Run to see them fail.**
- [ ] **Step 3: Implement**

```php
    public function isEnabled(): bool
    {
        if (! $this->isConfigured()) {
            return false;
        }

        return ! in_array($this->value, resolve(InstanceSettings::class)->disabledIntegrations(), true);
    }
```

`tests/Arch/ArchTest.php`: `->ignoring([McpFeature::class, IntegrationProvider::class])` and the test's description gains ", and IntegrationProvider which asks the instance settings whether the admin turned it off". `PresentIntegrationSettings` counts active integrations per provider in PHP over `TeamIntegration::query()->get(['id', 'provider', …])` filtered by `isActive()` (bounded: teams × providers). Update: validated `disabled.*` in provider values; store; audit `SettingsUpdated` `['section' => 'integrations', 'keys' => ['disabled_integrations'], 'disabled' => $list]` (provider names are not secrets).

- [ ] **Step 4: Run on PostgreSQL and SQLite** — `tests/Feature/Admin tests/Feature/Integrations tests/Arch`.
- [ ] **Step 5: Commit** — `feat(admin): turn integration providers off for the instance`

### Task 17: MCP keys section — back end

**Files:**
- Create: `app/Actions/Admin/PresentMcpKeys.php`, `app/Http/Controllers/Admin/McpKeysController.php`, `resources/js/pages/admin/mcp-keys.tsx` (thin)
- Modify: `routes/admin.php`
- Test: `tests/Feature/Admin/McpKeysTest.php`

**Interfaces:**
- Produces: `admin/mcp-keys` props `{keys: {data: array<int, {id, name, owner: {id, name, avatarUrl}, fingerprint: string, scopes: string[], team: ?string, createdAt, lastUsedAt: ?string, expiresAt: ?string}>, links, meta}, mcpEnabled: bool, createUrl: string}`; route `admin.mcpKeys.destroy`.

- [ ] **Step 1: Write the failing tests**

```php
<?php

use App\Enums\AuditAction;
use App\Enums\McpScope;
use App\Models\AuditEvent;
use App\Models\PersonalAccessToken;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->actingAs(User::factory()->instanceAdmin()->create())->withSession(['auth.password_confirmed_at' => time()]);
});

it('lists the tokens of every user, newest first, with a fingerprint and no secret', function () {
    $malik = User::factory()->create(['name' => 'Malik']);
    $plain = issueTestMcpToken($malik, [McpScope::Read, McpScope::Write]);

    $response = $this->get(route('admin.mcpKeys.index'))->assertInertia(fn (Assert $page) => $page
        ->component('admin/mcp-keys')
        ->where('keys.data.0.owner.name', 'Malik')
        ->where('keys.data.0.fingerprint', 'skrum_…'.substr($plain, -4))
        ->where('keys.data.0.scopes', ['mcp:read', 'mcp:write']));

    expect($response->getContent())->not->toContain($plain);
});

it('revokes any token, which stops authenticating', function () {
    $owner = User::factory()->create();
    $plain = issueTestMcpToken($owner);
    $token = PersonalAccessToken::query()->sole();

    $this->delete(route('admin.mcpKeys.destroy', $token->id))->assertRedirect();

    postMcp($plain)->assertUnauthorized();
    expect(AuditEvent::query()->where('action', AuditAction::TokenRevokedByAdmin)->sole()->properties)
        ->toBeIgnoringKeyOrder(['owner' => $owner->id, 'name' => $token->name]);
});
```

- [ ] **Step 2: Run to see them fail.**
- [ ] **Step 3: Implement** — `PersonalAccessToken::query()->where('tokenable_type', (new User)->getMorphClass())->with(['tokenable', 'team'])->orderByDesc('created_at')->orderByDesc('id')->paginate(25)`; fingerprint `config('sanctum.token_prefix').'…'.$token->token_hint`; destroy: find by id or 404, record `TokenRevokedByAdmin` then `$token->delete()`; `createUrl` = the admin's own token settings route (re-read its name); `mcpEnabled` = `config('skrum.mcp.enabled')`. Routes under `RequirePassword`: `admin/mcp-keys` GET, `admin/mcp-keys/{token}` DELETE (`whereUuid('token')`).
- [ ] **Step 4: Run on PostgreSQL and SQLite.**
- [ ] **Step 5: Commit** — `feat(admin): MCP keys of the instance`

### Task 18: Licence and audit log pages — back end

**Files:**
- Create: `app/Http/Controllers/Admin/LicencesController.php`, `AuditEventsController.php`, `app/Http/Requests/Admin/AuditEventsIndexRequest.php`, `app/Actions/Admin/PresentAuditEvents.php`, `resources/js/pages/admin/licence.tsx`, `audit-log.tsx` (thin)
- Modify: `config/skrum.php` (`licence`), `routes/admin.php`
- Test: `tests/Feature/Admin/LicenceTest.php`, `tests/Feature/Admin/AuditLogTest.php` (add the page cases)

**Interfaces:**
- Produces: `admin/licence` props `{licence: string, repositoryUrl: string, accountsInUse: int, version: string}`; `admin/audit-log` props `{events: {data: array<int, {id, action: string, group: string, actor: ?{name, avatarUrl}, subject: ?{type, id, label: ?string}, properties: array, ip: ?string, at: string}>, links, meta}, filters: {group: ?string, actor: ?string}, retentionDays: int}`.

- [ ] **Step 1: Write the failing tests**

```php
it('counts active accounts only for the licence card', function () {
    config(['skrum.licence' => 'AGPL-3.0']);
    $this->actingAs(User::factory()->instanceAdmin()->create())->withSession(['auth.password_confirmed_at' => time()]);
    User::factory()->count(2)->create();
    User::factory()->deactivated()->create();

    $this->get(route('admin.licence.show'))->assertInertia(fn (Assert $page) => $page
        ->component('admin/licence')->where('licence', 'AGPL-3.0')->where('accountsInUse', 3));
});
```

```php
it('lists audit events newest first, 50 a page, filtered by group', function () {
    $admin = confirmedAdmin($this);
    AuditEvent::factory()->create(['action' => AuditAction::SignedIn, 'created_at' => now()->subMinute()]);
    AuditEvent::factory()->create(['action' => AuditAction::AdminGranted, 'created_at' => now()]);

    $this->get(route('admin.auditEvents.index'))->assertInertia(fn (Assert $page) => $page
        ->component('admin/audit-log')->where('events.data.0.action', 'admin_granted')->where('retentionDays', 365));
    $this->get(route('admin.auditEvents.index', ['group' => 'signIn']))
        ->assertInertia(fn (Assert $page) => $page->has('events.data', 1)->where('events.data.0.action', 'signed_in'));
});
```

- [ ] **Step 2: Run to see them fail.**
- [ ] **Step 3: Implement** — `config/skrum.php`: `'licence' => env('SKRUM_LICENCE', 'AGPL-3.0'), 'repository_url' => 'https://github.com/arnaud-ritti/skrum',` (the default value is the owner's answer to decision 2; change it here only). Accounts in use: `User::query()->whereNull('deactivated_at')->count()`. Audit index: `whereIn('action', AuditAction::inGroup($group))` when filtered, actor filter by `actor_user_id` (uuid), `orderByDesc('created_at')->orderByDesc('id')->paginate(50)`, `with('actor')`; subject label resolved for `User` subjects in one `whereIn` query on the page's ids. Routes `admin/licence` GET, `admin/audit-log` GET under `RequirePassword`.
- [ ] **Step 4: Run on PostgreSQL and SQLite.**
- [ ] **Step 5: Commit** — `feat(admin): licence card and audit log page`

---

## Step B — screens

Every screen task: read the mockup (`ScreenSettings/preview.html` frame b, or `ScreenErrors/preview.html`) and its README; build the container in `resources/js/components/admin/<section>/` and the page in `resources/js/pages/admin/<section>.tsx`; write Vitest for each behaviour named; run `npm run test -- <pattern>`, `npm run types:check`, `npm run check`, `npm run build:front`; add the keys to the four `lang` files, informal; commit. No capture here (Task 30).

### Task 19: Admin navigation and version footer (single writer)

**Files:** Modify `resources/js/components/admin/admin-shell.tsx`, `admin-shell.test.tsx`; create `resources/js/lib/admin/types.ts`.

**Interfaces:** `AdminSection` = `'general' | 'branding' | 'signIn' | 'mail' | 'integrations' | 'mcpKeys' | 'licence' | 'users' | 'admins' | 'auditLog'`; reads shared `instanceVersion`, `instanceVersionStatus`.

Composition: two `nav` groups with overlines "Instance" and "Supervision" (`aria-labelledby` each); entries in the order of spec §9.1 with lucide icons (`Settings`, `Palette`, `KeyRound`, `Mail`, `Plug`, `Bot`, `Scale`, `Users`, `ShieldCheck`, `ScrollText`); badge "active" on SSO (exists), "n/m" on Integrations is omitted from the nav (the count needs the section's data: P29 row not needed, the mockup's "2/3" is drawn — add it only if `features.integrations` gives the counts; otherwise record a deviation row in Task 31); the mobile `Select` lists the groups as `SelectGroup` with labels; footer card: host, then `v{instanceVersion}` and, from `instanceVersionStatus.state`, " · up to date" (`text-skrum-success-text`) or " · update available: v{latest}" (`text-skrum-warning-text`, with an icon) or nothing. Breadcrumb root "Administration" links to General.

Tests (Vitest): renders ten entries in order with the right `href`s (Wayfinder); `aria-current` on the active one; the footer's three states; the mobile select navigates (`router.visit` mocked).

Commit: `feat(admin): the mockup's navigation and the version line`.

### Task 20: General screen

**Files:** `resources/js/pages/admin/general.tsx`, `resources/js/components/admin/general/{signup-card,maintenance-message-card,updates-card,general-settings-form}.tsx` and tests.

Composition: `AdminShell active="general"` with the topbar actions "n unsaved changes · Cancel · Save" (reuse the Branding form-state pattern: re-read `components/admin/branding`), three `settings-card`s: Sign-up (`RadioGroup` invite / open / domain; domain chips input: `Input` + Enter adds, chips with remove buttons, invalid domain error under the field; the environment default in muted text "Default from the environment: …"); Maintenance message (`Textarea` max 280 with a counter, the sentence "Shown on the maintenance page from the next `artisan down`.", "Saved by :name, :date", "Clear"); Updates (version, `Switch` "Check for new versions once a day", the outbound-call sentence, last check "Checked :relative: v1.9.0 is available" / "up to date" / "never"). One `useForm` PUT on Save.

Behaviours to test: the unsaved count follows edits and Cancel resets; domain mode shows the chips field and requires one; the counter turns destructive past 280 and Save is disabled; Save sends only changed fields; server errors land under their fields.

Commit: `feat(admin): general screen`.

### Task 21: SSO screen

**Files:** `resources/js/pages/admin/sign-in.tsx`, `resources/js/components/admin/sso/{provider-card,connection-test-result}.tsx` and tests; `sign-in-settings-form.tsx` unchanged below the cards.

Composition: one card per provider, the mockup's two-column field grid with `Input readOnly` values, the client secret as a masked read-only field with a "Set" / "Not set" badge (no eye), redirect URI with a Copy button (`useClipboard`, "Copied" 2 s), env names under the card in `code`; status badge "Configured" (`success`) / "Not configured" (outline); "Test the connection" (`Form` POST to `admin.ssoTests.store`, pending spinner) on testable providers; result `Alert` success "Connected · :ms ms · issuer :issuer" or destructive with the error sentence per code (`unreachable`, `not_oidc`, `issuer_mismatch`); last test line "Last test :relative". Not configured: compact card with the env hint. Then the existing `sso_required` form.

Behaviours to test: no secret field holds a value; Copy writes the URI; the test button posts the provider; each error code renders its sentence; unconfigured cards have no test button.

Commit: `feat(admin): SSO providers screen`.

### Task 22: SMTP screen

**Files:** `resources/js/pages/admin/mail.tsx`, `resources/js/components/admin/mail/{mail-settings-card,mail-test-form}.tsx` and tests.

Composition: card "SMTP" with status badge ("Operational" success / "Not configured" warning with "Mails are written to the log."), read-only grid (host, port, encryption, user, password "Set", sender `Name <address>`), env hint; footer row "Send a test e-mail" (`Input type=email` prefilled with `defaultRecipient`, "Send"), result line from `lastTest` ("Last test delivered :relative" / "Last test failed :relative: :sentence"), 429 shown as "Wait a few minutes before the next test.".

Behaviours to test: the result line's three states; the form posts `to`; the 429 message.

Commit: `feat(admin): SMTP screen`.

### Task 23: Integrations screen

**Files:** `resources/js/pages/admin/integrations.tsx`, `resources/js/components/admin/integrations/{integration-row,turn-off-dialog}.tsx` and tests.

Composition: card "Integrations" with one `.st-int` row per provider: provider mark (initial on a tile, as the mockup's "J"/"L"), name, state line ("Available · :count teams connected" in `text-skrum-success-text`, "Turned off", "Not configured · set :env"), `Switch` (disabled when not configured, `aria-describedby` the state line). Turning off a provider with teams opens a confirm dialog "Turn :name off? :count teams lose it until you turn it back on. Their settings are kept."; the save happens on confirm (PUT with the full `disabled` list) — this section saves per switch, no topbar Save.

Behaviours to test: switch disabled when unconfigured; the dialog for a used provider, none for an unused one; the PUT body.

Commit: `feat(admin): integrations screen`.

### Task 24: MCP keys screen

**Files:** `resources/js/pages/admin/mcp-keys.tsx`, `resources/js/components/admin/mcp-keys/{mcp-keys-table,revoke-key-dialog}.tsx` and tests.

Composition: card with the mockup's sentence "To connect AI agents (Claude, IDE, scripts) to the instance's MCP server. A key is shown only once.", "Create a key" (link to `createUrl`), `Table` (name + fingerprint in `font-mono`, scopes as `code` chips `.st-scope`, created "date · owner", last used relative or "Never", expiry, "Revoke" destructive text button); revoke dialog "Revoke :name of :owner? Agents using it stop at once."; `Pagination`; MCP-off `Alert`; `EmptyState` "No key yet". Mobile: stacked cards.

Behaviours to test: rows render the fields; the dialog names the owner and sends DELETE; pagination links; empty state; the alert.

Commit: `feat(admin): MCP keys screen`.

### Task 25: Users screen

**Files:** `resources/js/pages/admin/users.tsx`, `resources/js/components/admin/users/{users-table,user-filters,deactivate-dialog}.tsx` and tests.

Composition: search `Input` (debounced visit with `query`, `preserveState`), `ToggleGroup` filter All / Active / Deactivated / Admins, `Table`: avatar + name + email, badges (Admin, Deactivated, 2FA), workspaces count, created date, last sign-in relative or "—"; row `DropdownMenu`: "Deactivate" / "Reactivate" (disabled with tooltip "You can't deactivate yourself" / "The instance needs an active admin" from `isSelf` and `activeAdminCount`), "Make admin" (link to Admins). Confirm dialog "Deactivate :name? They are signed out and can't sign in until you reactivate them. Their content stays." `Pagination`; empty search state.

Behaviours to test: filter and search visit with the right query; the menu's disabled reasons; the dialog posts / deletes; badges.

Commit: `feat(admin): users screen`.

### Task 26: Licence and audit log screens

**Files:** `resources/js/pages/admin/licence.tsx`, `audit-log.tsx`, `resources/js/components/admin/licence/licence-card.tsx`, `resources/js/components/admin/audit-log/{audit-table,audit-filters,audit-action-label}.tsx` and tests.

Licence: card "Skrüm" with badge "Valid" replaced by the licence name badge, sentence "Open source; every feature is included.", "Accounts in use: :count", "No limit, no expiry.", link "Source code". Audit log: filters (`Select` group: All, Settings, Accounts, Sign-in, Tokens; actor search by name over the page's actors), `Table` (time relative with `title` exact, actor avatar or "System", action sentence from `audit-action-label` — one `t()` per `AuditAction` with `:subject` and the properties it uses, e.g. "changed :keys in :section", "revoked the key :name of :owner"), subject, IP in `font-mono`; note "Events are kept 365 days."; `Pagination`; empty state.

Behaviours to test: every `AuditAction` value has a label (iterate the list exported from `lib/admin/types.ts`); filters visit; empty states.

Commit: `feat(admin): licence and audit log screens`.

### Task 27: Error pages — status link, version, access-request block

**Files:** Create `resources/js/components/auth/access-request-block.tsx` and test; modify `resources/js/pages/errors/error.tsx`, `resources/js/components/auth/error-page.tsx` (title for a known team), their tests.

Composition (ScreenErrors 403): the block inside `data-slot="error-page-access-request"`: team pastille (initial on `bg-skrum-primary-soft`, rounded), name in 650, "workspace · :count members" muted; the sentence "You're signed in as **:email**. Ask for access and a team admin will review it."; `Label` "Message to the admins (optional)" + `Textarea` (max 500); actions "Request access" (primary, `useHttp` POST to `storeUrl`) and the existing "Switch account" (ghost); the managers line: `PresenceStack`-like avatars (re-read `skrum/presence-stack`) and "Team admins: A, B" (+ "and :count others"). Sent state: toast "Request sent. You'll see the answer in your notifications." and the button replaced by a disabled "Request sent" (`aria-live` polite region announces it). Error: the form stays, the message under the field. `error.tsx` passes `headerLinks` = "Instance status" link (`statusUrl`), `version` (when present), `accessRequest` = the block when the prop exists; `ErrorPage` uses the title "You don't have access to this team" when `accessRequest` is given.

Behaviours to test: the block renders the team and managers; pending opens in the sent state; a successful POST switches to sent and fires the toast; a 422 shows the error; the status link and the version are present only when given; the 500 page with version.

Commit: `feat(errors): access request, status link and version on the error pages`.

### Task 28: Bell — access requests

**Files:** Modify `resources/js/components/skrum/notifications-panel.tsx`, `resources/js/hooks/use-notifications.ts` and their tests; `resources/js/pages/dev/sections/notifications-panel.tsx` (the design-system preview gets the two kinds).

Composition: kind `access_request` — actor avatar, "**:name** asks to join **:team**", excerpt in muted quotes, inline "Add to the team" (primary sm) and "Decline" (ghost sm) calling `request.updateUrl` with `useHttp` PATCH, optimistic answered state "Added by you" / "Declined by you", rollback and toast on error ("already answered" → the server's status is shown); answered state from the server "Added by :name" / "Declined by :name". Kind `access_answered` — team tile (`users` icon on `--skrum-primary-soft`), "You were added to **:team**" (link) or "Your request to join **:team** was declined". Unknown kinds stay ignored.

Behaviours to test: both kinds render; Add sends `{decision: 'approve'}` and switches the state; a 422 rolls back with the server's status; keyboard order of the inline actions.

Commit: `feat(teams): access requests in the bell`.

---

## Final

### Task 29: Translations

Every key added by Tasks 1 to 28 exists in `lang/en.json`, `fr.json`, `es.json`, `de.json`. One pass per language over the plan's keys: informal register (`tu` / `tú` / `du`), the glossary of `docs/superpowers/research/front-rewrite/translations-review.md` (admin, instance, workspace, team, access request), lengths that fit the mockup's places (nav labels ≤ 22 characters in French). Quotation marks per language for the 503 message. Run `bin/test-db pgsql -- tests/Feature/TranslationKeysTest.php tests/Feature/InformalRegisterTest.php` and `npm run test -- i18n`. Commit `chore(i18n): plan 29 strings in four languages`.

### Task 30: Captures (light, 1440, French)

Create `tests/Browser/Visual/AdminAndErrorPagesVisualTest.php` in the pattern of `tests/Browser/Visual/SettingsPagesVisualTest.php` and `AccessPagesVisualTest.php` (re-read both): the nine admin sections (General, Branding, SSO, SMTP, Integrations, MCP keys, Licence, Users, Audit log) with seeded data close to the mockup (eleven users, three tokens, two integrations configured, audit events of four groups), the 403 with the block (form and sent states), the 503 in maintenance with `--retry=1800` and a message, the status page. Run with `VISUAL_ONLY=light-1440-fr` (re-read `bin/test-browser` for the exact switch); the harness's overflow check must pass. No walkthrough. Commit the captures as the harness stores them.

### Task 31: Deviations and documents

- Compare each capture with its mockup's `preview.html`; each difference is fixed (a commit in the owning component) or a row added to **Pre-build deviations** above with its reason.
- `docs/superpowers/research/front-rewrite/feature-roadmap.md`: AD-1 to AD-5 rows get "done, plan 29" (and the corrected AD-2 "Back end" line); the owner note at the top stays.
- `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md`: D-31 and D-35 rows say what plan 29 cleared and what stays ("Help": backlog).
- Move the spec to `docs/superpowers/specs/2026-10-21-administration-and-error-pages-design.md` and this plan to `docs/superpowers/plans/2026-10-21-plan-29-administration-and-error-pages.md`; fix the links.
- The self-hosting notes of `README.md` (re-read; edit only an existing section): `artisan down --retry=<seconds>` and the maintenance message, `SKRUM_VERSION`, `SKRUM_UPDATE_FEED`, `SKRUM_LICENCE`, the `/status` page and the `skrum:heartbeat` schedule.
Commit `docs: plan 29 deviations, roadmap rows and spec`.

### Task 32: Four-engine suites and report

- [ ] `vendor/bin/pint --format agent`, `vendor/bin/sail composer types:check`, `npm run types:check`, `npm run check`, `npm run build:front`.
- [ ] `bin/test-db pgsql`, `bin/test-db mariadb`, `bin/test-db mysql`, `bin/test-db sqlite` — the whole unit, feature, upgrade and arch suites; each must pass.
- [ ] `bin/test-db pgsql --concurrency`, `mariadb`, `mysql`, `sqlite-file` — the whole concurrency suite, one engine at a time.
- [ ] `npm run test` — the whole Vitest suite.
- [ ] Report in `.superpowers/sdd/plan-29/report.md`: tasks done, spec acceptance criteria 1 to 23 each with its evidence (test name or capture), deviations added, what was found different from the plan, open points (spec §17 items answered or still open).
- [ ] Commit `docs: plan 29 report`. Do not merge into `main`, do not push.

---

## Self-review

1. **Spec coverage.** §6.1 → Task 1; §6.2 → Tasks 3, 13; §6.3 → Tasks 3, 4, 19; §6.4 → Tasks 5, 8; §6.5 → Tasks 9, 10, 11; §6.6 → Tasks 2, 18, 26; §6.7 → Tasks 6, 7; §9.1 → 19; §9.2 → 12, 20; §9.3 → 14, 21; §9.4 → 15, 22; §9.5 → 16, 23; §9.6 → 17, 24; §9.7 → 18, 26; §9.8 → 13, 25; §9.9 → 18, 26; §9.10 → 11, 27; §9.11 → 8; §9.12 → 7; §9.13 → 10, 28; §12 → every task and 30, 32; criteria 1 to 23 → the report of Task 32 maps each. Criterion 21 (image version) → Task 4 Step 4.
2. **Placeholders.** None left: every test step holds its code. The "re-read" notes name the exact file to read and what to take from it; they are there because the plan was written without running code, and each names the fallback.
3. **Type consistency.** `RequestTeamAccess::handle(User, Team, ?string)`, `AnswerTeamAccessRequest::handle(User, TeamAccessRequest, bool): TeamAccessRequestStatus`, `AccessRequestRecipients::for(Team)`, `ResolveDeniedTeam::handle(Request): ?Team`, `PresentAccessRequestOffer::handle(User, Team): array`, `MaintenanceDetails::read()`/`attachTo()`, `InstanceStatus::check()`/`overall()`, `InstanceVersion::current()`/`status()`, `RecordAuditEvent::handle(AuditAction, ?User, ?Model, array, ?string)`, `DeactivateUser::handle(User $admin, User $user): bool` — used with these signatures in every later task.
4. **Review Focus.** Five lines above; each has its test in Tasks 11, 13, 1/12, 7/8 and 2/14/15.
