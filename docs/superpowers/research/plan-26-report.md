# Plan 26: account, and what a guest picks — report

Branch `plan-26-account-guests` (worktree `.claude/worktrees/rm26`), cut from `roadmap` at `678bf871`. Spec:
`docs/superpowers/specs/2026-10-21-plan-26-account-guests-design.md`; plan:
`docs/superpowers/plans/2026-10-21-plan-26-account-guests.md`. The plan's lanes were flattened by the controller:
every task ran in numeric order on this one branch. Final run on 2026-10-03 on the code of `831c4828`; the commit
after it adds this report only. Not pushed; not merged into `roadmap` or `main` (the controller does that).

## 1. Result

One command at a time in the shared application container `skrum-laravel.test-1`, database `testing_l26`
(`TEST_DB_DATABASE=testing_l26`, `TEST_DB_WORKDIR=/var/www/html/.claude/worktrees/rm26`), four processes
(`TEST_DB_PROCESSES=4`: five plans share the container).

| Run | Result |
|---|---|
| `bin/test-db pgsql` (Unit, Feature, Upgrade, Arch) | `PASS, Tests: 2 skipped, 6407 passed (56777 assertions)` |
| `bin/test-db pgsql --concurrency` | `PASS, Tests: 1 skipped, 29 passed (126 assertions)` |
| `bin/check-pg-upgrade` (databases `testing_l26_upgrade_old` and `_fresh`) | `PASS, every row is there, and the schemas are equal apart from the five legacy check constraints` |
| `composer types:check` (PHPStan level 7) | `passed`, 0 errors |
| `vendor/bin/pint --format agent` | `passed` |
| `composer rector:check` | fails on 196 files, as on the base; see §1.2 |
| `npm run test` (Vitest) | `389 files, 4202 tests passed` |
| `npm run types:check`, `npm run check` | no error; 1096 files formatted, no lint warning in 1079 |
| `vp build`, then `wayfinder:generate --with-form` | built; nothing to commit afterwards |

**SQLite, MariaDB and MySQL were not run** (owner, 2026-10-03): the roadmap's final four-engine matrix, after
plans 24 and 25 are merged into `roadmap`, runs them once for every plan, the Upgrade test
`tests/Upgrade/PasswordSetAtBackfillTest.php` and the three new race files included. The code is written to the
portability rules, and `tests/Arch/DatabasePortabilityTest.php` passed inside the whole suite above.
Browser walkthroughs and smoke tests were not run (owner's rule); the captures are those of Task 24.

### 1.1 A failure found by the whole suite, fixed

The first whole run had one failure: `tests/Feature/DesignTokensTest.php` ("starts the stylesheet with the
design-system file, unmodified"). Task 8 had put the two `@custom-variant motion-reduce` / `motion-safe` blocks
right after `@custom-variant dark`, inside the verbatim copy of `docs/design-system/app.css`. They now follow
the `html.reduce-motion` rules after that copy (commit `3a8222db`); Tailwind hoists custom variants, so the
compiled CSS is the same (checked again: §5). The second whole run is the one in the table.

### 1.2 Rector

`composer rector:check` is not clean on this branch nor on its base (196 files, mostly
`NewMethodCallWithoutParenthesesRector`, 134, over code older than this plan). In the pattern of plans 18e and
19, rector was applied to the files plan 26 **created** (commit `831c4828`): `BrowserSession` takes the model
attributes `#[Table]`, `#[WithoutIncrementing]`, `#[WithoutTimestamps]`; `BrowserSessions` the `Date` facade;
`LinkedAccounts` `oldest()` (the `id` tie-breaker stays); `JoinCodes::kindOf` is no longer static;
`SignInMethodsTest` `toBeEmpty()`; `LinkedAccountsTest` closure return types. Left as they were, and put to the
owner: `NewMethodCallWithoutParenthesesRector` on the four `*GuestTokensController`s and
`WorkspaceInvitationNotification` (no file of `app/` uses that form yet), the scope rewrite rector proposes on
`User` (an older method), the visual test files, and every file older than this plan.

## 2. Rule S-1, restated (spec §5.12; criterion 21)

**An account without a known password is never asked to confirm it in the account settings.** A signed-in user
whose `password_set_at` is null (an account created by SSO, or one the backfill reads so) passes, with nothing
else, every confirmation of the account settings: the `routes/settings.php` routes now behind
`App\Http\Middleware\RequirePasswordUnlessNoneKnown`, Fortify's routes behind the re-pointed `password.confirm`
alias (two-factor set-up, confirmation, disabling, recovery codes, passkeys), the protected props of the security
and API-token sections, the page's gate (no dialog), and the "Set a password" save. It stops at the account
settings: the admin area keeps the framework's `RequirePassword`, and deleting the account still asks for the
current password. It ends as soon as the account has a password. **Accepted risk:** whoever holds a signed-in
session of such an account (a stolen cookie, an unlocked device) can turn two-factor off, read and regenerate the
recovery codes, create API tokens — the three the owner was told — and also register a passkey of their own,
link their own SSO identity (a lasting way in), sign the owner's other devices out and set a password. The
backfill's 60-second heuristic can put an account that later reset its password, or a registered account that
used SSO within a minute, in the same case until its next password change.

Tests that hold it (a failure means the rule was broken, not that a confirmation is missing):
`tests/Feature/Settings/PasswordConfirmationGuardTest.php` — "lets an account without a known password through
every confirmation of the account settings, the risk the owner accepted (rule S-1)" (every guarded action, page
and JSON), "sends the protected sections to an account without a known password with no confirmation",
"lets an account without a known password read its recovery codes, create a token and turn two-factor off with no
confirmation", "asks for the confirmation again once the account has set a password", "keeps the admin area and
the deletion of the account behind the password for an account without one", and the existing dataset of guarded
actions that still asks an account with a known password (423 or redirect); `SetPasswordTest` ("lets an account
without a known password set one with neither the current password nor a confirmation"),
`LinkSocialAccountTest` ("sends an account without a known password to the provider with no confirmation"),
`LinkedAccountsTest` ("unlinks with no confirmation for an account without a known password"); Vitest
`password-gate.test.tsx`, `password-card.test.tsx`, `account-settings.test.tsx`.

## 3. Points ruled while revising (spec §16, items 8 to 10), for the owner to overturn

- **"Profile photos" is off by default and independent of the member style choice.** An upgraded instance shows
  no photo until an admin turns the switch on in Administration › Branding; a photo may show while members cannot
  pick a style, and "Use initials" then reads "Remove photo" (P26-13, P26-15). The Branding reset turns it off.
- **S-1 stops at the account settings.** The admin area keeps its confirmation; an SSO-born admin without a
  password sets one first, or uses a passkey. The owner's words named "security, or act there".
- **S-1's consequences beyond the three the owner was told:** a stolen session can also add a passkey, link an
  SSO identity of its own, sign the other devices out and set a password (§2). Built as such.
- Linked to it (spec §16 item 11): plan 29 asks a fresh confirmation, by password or passkey, before an admin
  changes SSO or SMTP settings; under S-1 a passwordless SSO-born admin can register a passkey with no
  confirmation, and that passkey then satisfies plan 29's check. Recorded in plan 29's spec.

## 4. Acceptance criteria (spec §12)

PHP tests ran on PostgreSQL in the whole suites of §1; Vitest files once (`npm run test`).

| # | Criterion | Proved by |
|---|---|---|
| 1 | Twelve colours, saving, 13 refused, the mail colour by default | `PresenceColorTest` (Feature/Settings), `AccountColumnsTest` ("derives the presence colour of a user who never chose one, as mail does"), unit `PresenceColorTest`; `WorkspaceInvitationMailTest`, `RetroRecapTest`, `BellNotificationsTest`; `presence-colour-picker.test.tsx`, `profile-card.test.tsx` |
| 2 | `presence` in the member data of the five channels | `PresenceMemberColourTest` (ten cases, icebreaker and survey respondents included); the five `*BroadcastAuthorizationTest` |
| 3 | Cursor, ring and stack wear the colour; one colour on two whiteboards | `PresenceMemberColourTest` ("gives one person the same colour on two whiteboards"); `presence-color.test.ts`, `live-cursors.test.tsx`, `session-presence.test.tsx`, `presence-slot.test.ts` |
| 4 | Photo types, sizes, dimensions, no metadata, served inert and immutable | `ProfilePhotoTest` ("refuses what is not a small JPEG or PNG", "stores a photo without its metadata…", "serves the photo, cached for good and inert"); unit `ImageMetadataTest` (seven cases); `square-crop.test.ts`, `profile-photo.test.tsx` |
| 5 | Photo in props, snapshot, channel; initials; remove photo; the switch; reset; deletion | `ProfilePhotoTest` (twelve cases), `BrandingSettingsTest` ("turns profile photos on and off, and the reset turns them back off", "keeps the profile photos switch when the form does not send it"); `branding-form.test.tsx`, `avatar-style-grid.test.tsx` |
| 6 | "Reduce animations": class on the root, compiled CSS, helper | `MotionPreferencesTest`; `motion.test.ts`, `reduce-motion-field.test.tsx`, `chart.test.tsx`, `use-visible-section.test.tsx`, `gif-picker.test.tsx`, `session-confetti.test.tsx`; compiled CSS checked in §5 |
| 7 | Breach range endpoint, cache, 503, 404 when off, timeout | `PasswordBreachRangeTest` (nine cases), unit `PasswordRuleTest` |
| 8 | Live breach line; save-time fallback; five characters only | `breach-check.test.ts`, `use-breach-check.test.ts`, `breach-line.test.tsx`, `password-card.test.tsx` |
| 9 | Sessions listed, newest first, browser, IP, no id, own only | `BrowserSessionsTest` ("lists the sessions of the user…", "gives no address…", "never signs out the current session, nor another user's"); unit `UserAgentSummaryTest`; `active-sessions-card.test.tsx` |
| 10 | Sign out one (remember token changes), not the current, 404, sign out others, confirmation | `BrowserSessionsTest` ("signs out one session and forgets remembered devices", "signs out every other session", "signs out through the routes, behind a fresh confirmation") |
| 11 | Other driver: `browserSessions` null, no card, 404 | `BrowserSessionsTest` ("sends no session list at all with another driver…", "answers 404 on the routes with another driver", "tells the locked section whether the card exists…"); `account-settings.test.tsx` |
| 12 | Link from the card; refusals; two links make one | `LinkSocialAccountTest` (seven cases); concurrency `SocialAccountLinkTest`; `linked-accounts-card.test.tsx` |
| 13 | Unlink refused on the last way in; two unlinks; 404 | `LinkedAccountsTest`, `SignInMethodsTest`; concurrency `SocialAccountUnlinkTest` |
| 14 | "Managed by your admin" under `sso_required` | `LinkedAccountsTest` ("refuses an identity managed by the admin…", "marks an identity managed by the admin…"), `SignInMethodsTest` |
| 15 | No confirmation, "Set a password", `password_set_at`, asked again after; no card under `sso_required` | `SetPasswordTest` (five cases), `PasswordConfirmationGuardTest` (S-1 cases), Upgrade `PasswordSetAtBackfillTest`; `password-card.test.tsx` |
| 16 | Taken colours on the five join pages, twelve taken, 0 and 13 refused | `GuestColourTest` (seven cases, datasets over the five kinds); `guest-join-page.test.tsx`, the five `pages/*/join.test.tsx`, `guest-join.test.tsx`, `presence-swatches.test.tsx` |
| 17 | Code `XXX-XXXX` to who sees the link, none for a guest; regenerate | `JoinCodesTest` (seven cases), unit `JoinCodeTest`, concurrency `JoinCodeIssueTest`; `GameSnapshotTest`; the five share-mount tests, `share-dialog.test.tsx` |
| 18 | `POST join` in any case and form; same error; throttled | `JoinByCodeTest` (unknown, closed, deleted, look-alike, throttle); `join-code.test.ts`, `pages/sessions/join-code.test.tsx`, `join-code-card.test.tsx`, `login-form.test.tsx` |
| 19 | Four languages, informal; captures compared | `TranslationKeysTest`, `InformalRegisterTest` (inside the whole suite); captures of Task 24 (`4acf27ac`), comparison and fixes of Task 25 (`56a154ad`, `198c56e0`) |
| 20 | Whole suites and concurrency on PostgreSQL; portability arch test | §1. SQLite, MariaDB, MySQL and the concurrency suite on a SQLite file: the roadmap's final matrix |
| 21 | Rule S-1 both ways | §2 |

## 5. Tailwind variant check (Task 8; spec §16 item 1)

Tailwind 4 accepts `@custom-variant motion-reduce` and `motion-safe` over its built-in variants with a block
holding the media query and the class selector. Checked on the final build: the 22 distinct
`motion-reduce:` / `motion-safe:` utilities the sources use (146 uses) all compile with
`:where(.reduce-motion, .reduce-motion *)` (or its `:not(...)` for `motion-safe`), and `prefers-reduced-motion`
appears 22 times. The plan's threshold ("`reduce-motion` above 100 times") assumed one compiled rule per use; a
utility compiles once however often it is used, so 70 occurrences is the full count. No fallback was needed.

## 6. Differences left with each mockup

Only the approved rows P26-01 to P26-15 (plan, "Pre-build deviations"). Task 25 compared each capture with its
mockup (light, 1440, French) and fixed three differences to the mockup (`56a154ad`): "Active now" wrapped, an IPv6
address broke inside a group, and the Linked accounts card drew an empty footer. No new row was found.

## 7. Existing tests edited, and why

PHP:

- `tests/Feature/Settings/PasswordConfirmationGuardTest.php` — rule S-1. The "SSO-only account" cases of the
  guarded-actions dataset became "an SSO account that has set a password" (`password_set_at` set), since an
  account without a known password is now let through; "confirms a password only when it is the right one" and
  "records no confirmation for an account that knows no password, which rule S-1 lets through anyway" assert the
  new behaviour (recovery codes answer 200, the protected props are sent); five S-1 cases added.
- `tests/Feature/Settings/AccountSettingsPageTest.php` — the `appearance` prop is now `{ reduceMotion }`, and the
  security keys gain `liveBreachCheck`, `canListBrowserSessions`, `canLinkAccounts`.
- `tests/Feature/Notifications/BellNotificationsTest.php` — the actor's `presence` is the chosen colour, no longer
  `MailBrand::presence()` of the seed.
- `tests/Feature/{Retros,Poker,Whiteboards,TeamSurveys,Games}/*BroadcastAuthorizationTest.php` — the member data
  carries `presence`.
- `tests/Feature/Games/GameSnapshotTest.php` — the share data carries `joinCode`, and the member `presence`.
- `tests/Feature/InstanceSettingsTest.php` — the defaults gain `profile_photos => false`.
- `tests/Feature/Admin/BrandingSettingsTest.php` — the payload and props carry `profilePhotos`; two cases added.
- `tests/Feature/Integrations/RetroRecapTest.php`, `tests/Feature/Mail/WorkspaceInvitationMailTest.php` — a case
  each: mail wears the chosen colour.
- `tests/Arch/FrontEndRulesTest.php` — `lib/settings/square-crop.ts` joins the allow-list of literal colours
  (a JPEG has no transparency: a transparent PNG is flattened on white).
- `tests/Pest.php` — fixtures of JPEG and PNG bytes carrying metadata, for `ImageMetadataTest` and
  `ProfilePhotoTest`.
- `tests/Feature/Auth/SignInMethodsTest.php`, `tests/Feature/Settings/LinkedAccountsTest.php` (created by this
  plan) — rector only (§1.2).
- `tests/Browser/Visual/AdminPagesVisualTest.php`, `SettingsPagesVisualTest.php` — the captures of Task 24.

Vitest: `lib/whiteboard/presence-slot.test.ts` was rewritten (the colour now comes from the server; the id hash
is only the fallback); `session-presence.test.tsx` maps `presence`; `settings/account-settings.test.tsx`,
`password-gate.test.tsx`, `security/password-card.test.tsx` follow the new cards, the breach line and S-1;
`games/room-share-dialog.test.tsx` takes the code; the other edited files only gained cases (the five share
mounts, the five join pages, `guest-join-page`, `guest-join`, `share-dialog`, `profile-card`, `settings-card`,
the four motion readers, `login-form`, the three Branding files) or a fixture field (`survey-builder`,
`room-adapters`, `survey-reducer`). No test was deleted.

## 8. Translation keys added outside Task 23's table

65 keys were added in `lang/en.json`; 25 are the table's. The 40 others, each in fr, es, de, informal:
"Appearance saved.", "Replaces card flips, confetti and drag tilts with simple fades. On by default when your
system asks for it.", "Photo updated.", "Photo removed.", "Unknown device", "Device signed out.", "Other sessions
signed out.", "This :provider account is already linked to another account.", "Your account is already linked to
:provider. Unlink it first.", "This account is managed by your admin.", ":provider is linked.", ":provider is
unlinked.", "Checking known data breaches…", "Set the password", "Device", "Last active", "Sign out", "Unknown",
"Active now", "Confirm your password to see your devices.", "Show my devices", "Sign out this device?", ":device
will need to sign in again.", "Sign out every other device?", "They will need to sign in again. \"Remember me\" ends
on every device.", "Sign in with your company SSO or an existing account. Keep at least one way in.", "Not linked",
"Linked", "Linked :date", "Not available on this instance", "Link :provider", "Unlink", "Unlink :provider?", "You
will no longer sign in with :provider. You can link it again later.", "Confirm your password to see your linked
accounts.", "Show my linked accounts", "Join at :url", "Code copied", "Type the code the facilitator shared.",
"Have an account?".

## 9. Decisions taken on the owner's behalf

- The plan's lanes were flattened (controller): every task ran in order on the plan branch, so no lane merge.
- `POST join` uses the inline limiter `throttle:10,1,joinCodes` instead of the named `RateLimiter::for('joinCodes')`
  the plan describes. Same behaviour: its own `joinCodes` bucket, keyed by IP for visitors and by user for
  members, the 11th try in a minute answers 429 (`JoinByCodeTest`, "throttles guessing").
- "Enter it on :url" left the four language files: the Share dialog now says "Join at :url" and nothing else
  used it.
- Task 26: the motion variants moved out of the design-system copy of the stylesheet (§1.1); rector applied to the
  files this plan created only (§1.2); the whole suites ran with four processes instead of eight.
- Built in earlier tasks and visible in their commits: the presence colour is sent with the profile only once one
  is picked (`31243aad`); the Branding save keeps "Profile photos" when the form does not send it (`7688664c`);
  "Reduce animations" reverts on any failed save and follows the account on each visit (`6e5f61a0`); the locked
  security section says, before any confirmation, whether the Active sessions and Linked accounts cards exist
  (`canListBrowserSessions`, `canLinkAccounts`), so a locked card is drawn only where the unlocked one is
  (`1f90048e`, `2e47d3aa`); the JPEG stripper also drops what follows the end of the image (MPF, Motion Photo
  trailers) and keeps APP2 only for an ICC profile (`38905e46`). The rulings each task agent reported were sent
  to the controller with that task.

## 10. Spec §16's open points, with what was learnt

1. Tailwind accepts the override: §5.
2. Canvas `toBlob` to JPEG: not checked in a real browser (no walkthrough); Vitest covers the crop rectangle, and
   the server refuses a file over 1 MB whatever the browser sends.
3. How many accounts were created by SSO and later reset their password: not knowable from the code; the backfill
   is proved by `tests/Upgrade/PasswordSetAtBackfillTest.php` on PostgreSQL.
4. Whether production runs the database session driver: unknown; `docs/database.md` now says the card is absent
   with `SESSION_DRIVER=file`.
5. Providers and the callback for a signed-in user: the URL is unchanged; not checked against a real provider.
6. `ProfileDeleteRequest` for an account without a known password: unchanged (it asks for the password); such an
   account sets one first. Still open.
7. Icebreaker players: they show the participant's colour, and a guest player the colour its participant picked
   (`PresenceMemberColourTest`).
8. to 10. Ruled: §3.
11. Plan 29's passkey combination: §3; not held here.
