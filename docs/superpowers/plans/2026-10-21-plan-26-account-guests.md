# Account, and what a guest picks (Plan 26) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development to run this plan task by task (through the Workflow tool, as the project does). Steps use checkbox (`- [ ]`) syntax. Every agent reads **Owner decisions**, **Global Constraints**, **Pre-build deviations** and its own task before anything else, then `docs/database.md` ("Rules for database code" and "Running the tests on an engine") for any task that touches PHP. A screen task also follows the "Screen task procedure" of `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md`, with the working rules below (no walkthrough, captures in Task 24 only).

**Status: draft of 2026-10-03, revised the same day on the owner's answers to spec §15** (`.superpowers/sdd/roadmap/progress.md`, "Owner answers 2026-10-03", "Plan 26"). Four answers differ from the drafted recommendation (1, 2, 3, 4); the tasks below are written on the answers. Revised a second time on 2026-10-03 with the owner's answers to the **Pre-build deviations** (progress.md, "Pre-build deviations (owner, 2026-10-03)", "P26"): every row P26-01 to P26-15 is **approved** (04 and 06 as recommended, 03 with the full IP address and no location, the others as listed); none changes what is built, so screens are built without waiting. Per-plan verification runs on **PostgreSQL only** (owner, 2026-10-03: the four-engine matrix runs once at the end of the roadmap). Rule S-1 of spec §5.12 is an accepted security risk: read it before Tasks 13, 15, 16, 17, 18, 19, and do not add a confirmation back.

**Goal:** A member chooses a presence colour and a photo, reduces animations, sees whether a new password is breached while typing it, lists and signs out their devices, links and unlinks SSO identities without ever losing the last way in; a guest picks a colour when joining; every guest-joinable session has a short code entered at `/join`.

**Architecture:** Four columns on `users` (one task, single writer), then five lanes. *Presence*: `PresenceColor` derives or reads a colour per user and per participant row (`HasGuestIdentity`), sent in the member data of the five presence channels and in the join pages' taken colours; the front reads it instead of hashing ids. *Photo*: a browser-side square crop, a server-side metadata stripper (`ImageMetadata`, pure PHP, no GD), a private file served publicly under a random name, read by `AvatarUrl` while the admin switch "Profile photos" is on. *Motion*: a user flag rendered as a class on `<html>`, honoured by the CSS, Tailwind's motion variants and one JS helper. *Security*: a k-anonymity proxy for the breach check, `BrowserSession` over the framework's `sessions` table (device, IP address, last activity), `SignInMethods` (what still signs a user in), `RequirePasswordUnlessNoneKnown` (rule S-1: an account without a known password is asked no confirmation in the account settings), an SSO intent that lets the one callback route link for a signed-in user. *Codes*: a `session_join_codes` table issued lazily per session, rotated with the guest link, resolved at `/join`.

**Tech Stack:** Laravel 13, PHP 8.4, Fortify, Socialite, Pest (feature, unit, upgrade, arch, concurrency), Inertia 3, React 19, Tailwind 4, vite-plus (Vitest), Wayfinder, Reverb; PostgreSQL through `bin/test-db` for this plan (MariaDB, MySQL and SQLite in the roadmap's final matrix); `Tests\Concurrency\Support\Race` for races. Run `composer show --direct` and read `package.json` before Task 1 and stop if a major differs from this list.

**Spec:** `docs/superpowers/specs/2026-10-21-plan-26-account-guests-design.md` (it stays there; this plan stays at `docs/superpowers/plans/2026-10-21-plan-26-account-guests.md`). Parent: `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` §5. Mockups: `docs/design-system/components/ScreenUserSettings`, `ScreenSecurity`, `GuestJoin`, `MobileAccess`, `ShareDialog`, `Input` — for each, the `README.md` and the `preview.html`.

**Not in this plan:** the backlog of spec §3; browser walkthroughs (owner's working rule: none is written or run); anything of the former plans 28 and 30 and scheduling.

**Tasks:** 26. Step A, single writer: 1. Step B, five lanes: Presence 2–6, Motion 7–8, Photo 9–11, Security 12–19, Codes 20–22. Final, single writer: 23 (translations), 24 (captures: light, 1440, French), 25 (deviations and documents), 26 (PostgreSQL suites and report).

## Branch and run

- Execution order of the roadmap (owner, 2026-10-03): plans 20, 21, **26**, 27 and 29 in parallel, then 22, then 23, then 24 and 25. This plan depends on no other roadmap plan. Plan 25 (registration, invitations) runs **after** it and builds on its `password_set_at` and its `CreateNewUser` change; plan 29 runs **beside** it and also edits `app/Support/Auth/PasswordConfirmation.php` (plan 29 adds its configuration-write check; this plan adds `isNotNeeded` / `isSatisfied`): whichever merges second keeps both, and `routes/admin.php` stays plan 29's alone (S-1.3: this plan does not touch it).
- Base: the head of the integration branch `roadmap` (it holds `main` at `18d3637e` or later: front-end rewrite, database portability, plan 19). Check before Task 1, and stop if one fails: `bin/test-db` exists and `bin/test-db pgsql -- tests/Arch` passes; `tests/Concurrency/Support/Race.php` exists; `app/Support/Auth/UserAgentSummary.php`, `app/Support/Auth/SignInPolicy.php`, `app/Support/Avatars/AvatarUrl.php` exist; `resources/js/components/skrum/guest-join.tsx` has the props `takenColors` and `initialPresence`; `resources/js/components/skrum/share-dialog.tsx` has `invite.code` and `invite.joinUrl`; the last migration of `database/migrations` is dated before `2026_10_26_100000` (if a plan merged meanwhile uses that date, take the next free day and say so in the report).
- Branch `plan-26-account-guests` from that base; at the end the controller merges it into `roadmap` (PostgreSQL suite after the merge). **Never push, never merge into `main`.**
- Task 1 runs on that branch. Lanes run in git worktrees on branches `lane/26-<name>`, cut from the head of Task 1; the controller merges one lane at a time and runs after each merge: `npm run types:check`, `npm run check`, `npm run build:front`, `vendor/bin/pint --dirty --format agent`, `vendor/bin/sail composer types:check`, `bin/test-db pgsql -- tests/Feature/Settings tests/Feature/Auth tests/Arch`.
- From a worktree, `bin/test-db` needs `TEST_DB_CONTAINER` and `TEST_DB_WORKDIR` (header of `bin/test-db`). This plan runs PostgreSQL only: MariaDB and MySQL are not started for it. Never run two whole suites at once in the shared container (four other plans run beside this one: at most five lanes testing at once).
- **Every task re-reads the files it touches**; a line number or a method body quoted here that no longer matches is followed in spirit and reported.

## Owner decisions

The nine questions of spec §15, answered by the owner on 2026-10-03. "≠ rec." marks an answer other than the drafted recommendation; the tasks named in the last column were rewritten for it.

| # | Question | Owner's answer | Where it lands |
|---|---|---|---|
| 1 | The photo | **B (≠ rec.)**: browser crop to 512 px JPEG; server checks and strips metadata; **plus an admin switch "Profile photos"** (`InstanceSettingKey::ProfilePhotos`, default off, Branding page), independent of "Members can choose their own style" | Task 10 (setting, Branding request and props, `AvatarUrl` and `ProfilePhotoRequest` read the switch), Task 11 (the Branding switch; "Remove photo" when members cannot pick a style) |
| 2 | Sessions with another driver | **C (≠ rec.)**: the Active sessions card is hidden | Task 14 (`browserSessions` is null; routes 404), Task 18 (nothing rendered) |
| 3 | Location | **No location; IP address and browser shown** (the owner's own wording; ≠ rec. "no IP") | Task 14 (`ipAddress` in each row), Task 18 (the IP column in place of the location column) |
| 4 | Confirming without a password | **None needed** (the owner's own answer, confirmed after the risk was spelled out): an account without a known password opens the security section and acts there with no confirmation. Accepted risk, rule S-1 of spec §5.12 | Task 13 (`RequirePasswordUnlessNoneKnown`, the `password.confirm` alias, `PasswordConfirmation::isSatisfied`, set a password without confirmation, the S-1 tests), Task 15 (link only: no confirm intent, no `SsoConfirmationsController`), Task 17 (the gate opens no dialog), Task 19 (no "Confirm with" buttons) |
| 5 | Managed by your admin | **C, as recommended**: enabled providers' identities while `sso_required` is in force | Tasks 13, 16 (unchanged) |
| 6 | Breach check | **B, as recommended**: live by k-anonymity (proxy, cache, switch) + at save | Tasks 12, 17 (unchanged) |
| 7 | Code form | **B, as recommended**: `XXX-XXXX`, seven random characters, 10 tries a minute | Tasks 20 to 22 (unchanged) |
| 8 | Guest colours | **A, as recommended**: taken = everyone who joined; advisory | Tasks 3, 6 (unchanged) |
| 9 | Where "join with a code" is offered | **A, as recommended**: `/join` and a link on the login page | Task 22 (unchanged) |

Settled on 2026-10-03 (spec §16, items 8 to 10, no longer open): "Profile photos" is independent of the member style choice (the owner approved P26-13 and P26-15, which build exactly that) and **off by default** (ruled: the safe default, stated in the README upgrade note); rule S-1 stops at the account settings and the admin area keeps its confirmation (ruled: the owner's words were "to open security or act there"); the consequences of S-1 beyond the three the owner was told (a passkey added, an SSO identity linked, devices signed out, a password set) follow from the same answer and are recorded in spec §5.12 point 5. The report restates them; nothing waits on them.

Pre-build deviations, answered 2026-10-03: P26-01 to P26-15 all approved (see the table's last column).

## File structure

Back end, created:

| File | Responsibility |
|---|---|
| `database/migrations/2026_10_26_100000_add_account_columns_to_users_table.php` | `presence_color`, `avatar_photo_path`, `reduce_motion`, `password_set_at` |
| `database/migrations/2026_10_26_100100_add_presence_color_to_session_participants.php` | the colour of a guest row, five tables |
| `database/migrations/2026_10_26_100200_fill_password_set_at_on_users.php` | the backfill |
| `database/migrations/2026_10_26_100300_create_session_join_codes_table.php` | codes |
| `app/Support/Avatars/PresenceColor.php` | the twelve colours, the derived one |
| `app/Support/Avatars/ImageMetadata.php`, `AvatarPhotos.php`, `app/Exceptions/InvalidAvatarPhoto.php` | the photo |
| `app/Http/Controllers/Settings/ProfilePhotosController.php`, `app/Http/Controllers/AvatarPhotosController.php`, `app/Http/Requests/Settings/ProfilePhotoRequest.php` | photo HTTP |
| `app/Http/Controllers/Settings/MotionPreferencesController.php` | reduce animations |
| `app/Support/Auth/PasswordRule.php`, `app/Http/Controllers/Settings/PasswordBreachRangesController.php` | the breach check |
| `app/Models/BrowserSession.php`, `app/Support/Settings/BrowserSessions.php`, `app/Http/Controllers/Settings/BrowserSessionsController.php`, `OtherBrowserSessionsController.php` | active sessions |
| `app/Http/Middleware/RequirePasswordUnlessNoneKnown.php` | rule S-1: no confirmation for an account without a known password |
| `app/Support/Auth/SignInMethods.php`, `SsoIntent.php`, `app/Actions/Auth/LinkSocialAccount.php`, `UnlinkSocialAccount.php`, `app/Exceptions/SocialAccountRefused.php`, `app/Support/Settings/LinkedAccounts.php`, `app/Http/Controllers/Settings/LinkedAccountsController.php` | linked accounts |
| `app/Enums/JoinableSessionKind.php`, `app/Models/SessionJoinCode.php`, `app/Support/Sessions/JoinCode.php`, `JoinCodes.php`, `app/Http/Controllers/JoinCodesController.php` | join codes |

Back end, modified: `app/Models/User.php`, `Participant.php`, `PokerPlayer.php`, `WhiteboardMember.php`, `TeamSurveyRespondent.php`, `GamePlayer.php`; `app/Concerns/HasGuestIdentity.php`; `app/Support/Avatars/AvatarUrl.php`; `app/Support/Mail/MailBrand.php`; `app/Enums/InstanceSettingKey.php`, `app/Support/InstanceSettings.php`, `app/Http/Controllers/Admin/BrandingController.php`, `app/Http/Requests/Admin/BrandingUpdateRequest.php` (the switch "Profile photos"); `app/Support/Auth/PasswordConfirmation.php`, `bootstrap/app.php` (the `password.confirm` alias); `app/Support/Auth/UserAgentSummary.php`; `app/Support/Settings/SecuritySettings.php`; `app/Http/Controllers/Settings/AccountSettingsController.php`, `ProfileController.php`, `SecurityController.php`; `app/Http/Requests/Settings/ProfileUpdateRequest.php`, `PasswordUpdateRequest.php`; `app/Http/Controllers/BroadcastAuthorizationsController.php`, `SsoCallbacksController.php`, the five `*JoinsController.php`, the five `*GuestTokensController.php`; `app/Actions/Sessions/PresentJoinSession.php`, `app/Actions/Games/PresentGamePlayer.php`; the five snapshot builders (`Retros/BuildBoardSnapshot`, `Poker/BuildPokerSnapshot`, `Whiteboards/BuildWhiteboardSnapshot`, `TeamSurveys/BuildTeamSurveySnapshot`, `Games/BuildGameSnapshot`); `app/Actions/Fortify/CreateNewUser.php`, `ResetUserPassword.php`; `app/Providers/AppServiceProvider.php`, `FortifyServiceProvider.php`; `config/skrum.php`; `resources/views/app.blade.php`; `routes/settings.php`, `routes/web.php`; `database/factories/UserFactory.php`; `tests/Pest.php`.

Front end, created: `resources/js/lib/presence/presence-color.ts`, `resources/js/lib/motion.ts`, `resources/js/lib/settings/{square-crop,breach-check}.ts`, `resources/js/lib/sessions/join-code.ts`; `resources/js/components/skrum/presence-swatches.tsx`; `resources/js/components/settings/{presence-colour-picker,profile-photo}.tsx`, `settings/appearance/reduce-motion-field.tsx`, `settings/security/{use-breach-check.ts,breach-line,active-sessions-card,linked-accounts-card}.tsx`; `resources/js/pages/sessions/join-code.tsx`, `resources/js/components/sessions/join-code-card.tsx`; each with its `.test.ts(x)`. Front end, modified besides the mounts: `resources/js/components/admin/branding/{branding.ts,avatar-style-grid.tsx,branding-form.tsx,samples.ts}` (the switch), `resources/js/components/settings/password-gate.tsx` (rule S-1).

## Global Constraints

- **Mockup first** (parent spec §5 rule 13). A screen follows its mockup: layout, placement, labels, states. A difference is fixed, or is a row of **Pre-build deviations** (all answered by the owner on 2026-10-03).
- **Front rules** of the parent spec §5 on every front file: tokens only, rem, Tailwind scale, no overflow from 20rem to 60rem, visible focus, contrast, motion through `motion-reduce` / `motion-safe` or `prefersReducedMotion()` (Task 8), lucide icons, the literal call shape `t('…')`, presentational `skrum/` components (no network, no Echo, no router). Containers live in `resources/js/components/<domain>/`. Reuse: `settings/settings-card`, `settings/password-gate`, `skrum/confirm-dialog`, `skrum/loading-button`, `skrum/guest-join`, `skrum/share-dialog`, `session/guest-join-page`, `ui/*`.
- **Database (owner rule): Eloquent and the standard query builder only.** `docs/database.md` rules 1 to 12 on every line of PHP, migration and test; `tests/Arch/DatabasePortabilityTest.php` enforces them. No raw query of any form, no driver test, migrations with the Schema builder only, `up` only, dated `2026_10_26_…`, nullable `dateTime()`, no `enum()` column, no collation, names within 64 characters; a transaction locks the aggregate root first (here: the user row for link, unlink and sign-outs) and is not retried when it does more than database work; an explicit tie-breaker on every sort; tests never read SQL text and never change the schema; a legacy `users` row written with `DB::table()` sets `email_key` and `name_search`.
- **Tests per task (owner, as amended 2026-10-03: "the four engines only at the end"):** every task writes its tests first and runs them on **PostgreSQL**: `bin/test-db pgsql -- <paths>`. The red step may run once on SQLite in memory: `vendor/bin/sail artisan test --compact <path>`. The Upgrade test of Task 13 runs with `bin/test-db pgsql -- tests/Upgrade/PasswordSetAtBackfillTest.php`; the race files of Tasks 15, 16 and 20 with `bin/test-db pgsql --concurrency -- <file>`, never in parallel. **Whole suites on PostgreSQL at the end (Task 26).** SQLite, MariaDB and MySQL (unit, feature, upgrade, arch, and the concurrency suite on a SQLite file) run **once, in the roadmap's final four-engine matrix** after plans 24 and 25 are merged into `roadmap`; that run covers this plan's Upgrade test and races. The portability rules below do not relax: the code is written for the four engines and `tests/Arch/DatabasePortabilityTest.php` runs in every task that touches PHP.
- **Races** are proved with `Tests\Concurrency\Support\Race` (static closures capturing scalars only; a contender runs in another process, so it sets the config it needs itself): one identity per provider per account (Task 15), never the last way in removed by two unlinks (Task 16), one code per session (Task 20). Each case states the protection it proves.
- **No browser walkthrough** is written, edited or run. Vitest is written and run per task (`npm run test -- <pattern>`). **Captures only in Task 24: light, 1440, French.**
- **No new dependency**, PHP or JS, without the owner's approval. No PHP image extension is added (decision 1: the browser crops).
- **Four languages, informal.** Every new `__('…')` / `t('…')` key goes into `lang/en.json`, `fr.json`, `es.json`, `de.json` in the commit that introduces it (`tests/Feature/TranslationKeysTest.php`), French "tu", Spanish "tú", German "du" (`tests/Feature/InformalRegisterTest.php`). A key that exists keeps its value. Task 23 reviews them.
- **No test is deleted** without the owner's approval; an existing test that changes is listed in the report with why.
- Primary and foreign keys are UUIDs (`tests/Feature/UuidPrimaryKeysTest.php`). Create files with `vendor/bin/sail artisan make:… --no-interaction`. Controllers: plural name, CRUD method names only (`tests/Arch/ArchTest.php`); route names camelCase, URLs kebab-case, tuple notation; Form Requests or array rules; every rendered page has its file under `resources/js/pages` (`tests/Arch/FrontEndPagesTest.php`).
- Arch facts: models do not use `App\Actions`, `App\Http` or `App\Mcp`; actions do not use `App\Http`; `App\Support`, jobs and events do not use `App\Http` or `App\Mcp`; enums use nothing of the application; no class is `final`; Octane is installed: no static or per-request state in new classes.
- PHP style: early returns, no `else`, happy path last, typed everything, PascalCase constants, constructor promotion, no comment restating code; before each commit `vendor/bin/pint --dirty --format agent` and `vendor/bin/sail composer types:check` (PHPStan level 7).
- Front gates after every task that touches the front: `npm run types:check`, `npm run check`, `npm run build:front` (also regenerates Wayfinder after a new route).
- **One commit per task**, in the repository's style (`feat(settings): …`, `feat(guests): …`, `test: …`); a change to a shared `skrum/` or `session/` component is its own commit inside the task. Every commit message ends with:

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE
```

## Pre-build deviations

**Answered by the owner on 2026-10-03** (progress.md, "Pre-build deviations (owner, 2026-10-03)", "P26: 04 + 06 browser/OS and linked date (rec.); 03 now shows the IP (owner's earlier answer), no location; others approved"). Every row is approved as listed; none changes what is built, and no screen waits. A difference found later (Task 25) that fits none of these rows is fixed to the mockup. Reasons as in plan 18e: **F** false or unsafe, **A** accessibility, **N** no such data or concept, **S** this spec, **O** an owner's answer.

| # | Screen | Mockup element | Built | Reason | Owner, 2026-10-03 |
|---|---|---|---|---|---|
| P26-01 | Profile | "Used for your avatar, live cursor and card lock." | "Used for your avatar and your live cursor." | N: no card lock exists | approved |
| P26-02 | Security, password | "Last changed 8 months ago." | not rendered | O: roadmap backlog ("last changed") | approved |
| P26-03 | Security, Active sessions | "Location is estimated from the IP address, to the city.", the Approximate location column (map pin, city), "Unusual location"; the mockup's README: "never the full IP" | the sentence is "Devices signed in to your account."; the column is "IP address" with the full address (`font-mono`, "Unknown" when none); no pin, no location, no "Unusual location" | O: decision 3 (IP and browser shown, no location) | approved: the full IP is shown (the owner's earlier answer overrides the README's "never the full IP"), no location |
| P26-04 | Security, Active sessions | "MacBook Pro · Firefox 131 / macOS 15" | "Firefox on macOS" | F: `UserAgentSummary` copies no part of the header (privacy rule of plan 18f) | approved, as recommended (browser and system) |
| P26-05 | Security, Active sessions | "Sign out other sessions" asks for the password again | the security section's fresh confirmation (password or passkey; none for an account without a known password, rule S-1) and a confirmation dialog | S/O: the section is already behind a confirmation; no password rehash is needed (spec §5.9); decision 4 | approved |
| P26-06 | Security, Linked accounts | the account's address and "used for your last sign-in" | "Linked :date" only | N: neither is stored | approved, as recommended (linked date) |
| P26-07 | Guest join | taken colours live (`Echo.join().here()`) | read when the page loads | F: a visitor cannot be authorised on the session's channel | approved |
| P26-08 | Join with a code | no mockup | the GuestJoin card's frame with the `Input` mockup's "Session code" field and states | designed from neighbours | approved |
| P26-09 | Login | no "join with a code" entry (the MobileAccess landing has one; `/` has no landing) | a link "Join a session with a code" under the form | O: decision 9 | approved |
| P26-10 | Share dialog | `ATL-4821` (team letters + digits) | `K7Q-P4M2` | S: decision 7 | approved |
| P26-11 | Security, Linked accounts | no state for a provider turned off | the row with "Not available on this instance" and "Unlink" | S: spec §5.10 | approved |
| P26-12 | Security, password | no state for an account without a password | title "Set a password", no current-password field, button "Set the password"; no confirmation asked (rule S-1) | S/O: spec §5.10, decision 4 | approved |
| P26-13 | Profile | "Use initials" always | "Remove photo" (shown only with a photo) when members cannot choose their style; "Use initials" otherwise | S: decision 1B makes photos independent of the style choice (spec §5.6) | approved |
| P26-14 | Security | the Active sessions card always present | no card at all when sessions are not in the database | O: decision 2C | approved |
| P26-15 | Administration › Branding | no "Profile photos" switch | a `Switch` "Profile photos" with its help line, under "Members can choose their own style" | O: decision 1B (no mockup holds it; designed from the neighbouring switch) | approved |

## Review Focus

1. **A signed-in user reaches the SSO callback without an intent, with another user's intent, or with an intent for another provider** (a stale tab, a link from elsewhere): no link, a redirect to the dashboard. Tests in Task 15.
2. **A JPEG carrying Exif GPS sent straight to the upload route**, bypassing the browser's canvas: the stored file holds no Exif. Unit test in Task 9, feature test in Task 10.
3. **Unlinking the last way in**: under `sso_required` for a non-admin, with mail off and no password, and two unlinks at once. Tests in Task 16 (race included).
4. **A code typed in lower case, with spaces, without the hyphen, or with a look-alike (`O`, `0`, `I`, `1`)**: the first three resolve, a look-alike is refused like an unknown code. Unit test in Task 20, feature test in Task 21.
5. **A remembered device signed out from the list**: its recaller cookie no longer signs it in. Test in Task 14 (the remember token changes).
6. **Rule S-1 both ways** (spec §5.12): an account without a known password passes every confirmation of the account settings (including Fortify's two-factor and passkey routes through the re-pointed `password.confirm` alias); an account with a known password is still asked everywhere, with the framework's 423 / redirect; the admin area still asks the passwordless account. A reviewer does **not** flag the absence of confirmation as a defect: it is the owner's accepted risk. Tests in Task 13.
7. **The IP address** shown is the user's own sessions' only, and the session id still never leaves the server. Test in Task 14.

## Lanes

| Lane | Tasks | Cut from | Shares with other lanes |
|---|---|---|---|
| plan branch (`plan-26-account-guests`) | 1, then 23 to 26 | — | — |
| Presence (P) | 2, 3, 4, 5, 6 | head of Task 1 | `app/Models/User.php` (method `presenceColor` only, written in Task 1), `AccountSettingsController::profile()` (one key), `ProfileUpdateRequest`, `components/settings/account-settings.tsx` (one mount), `lang/*.json` |
| Motion (M) | 7, 8 | head of Task 1 | `routes/settings.php` (one route), `resources/views/app.blade.php`, `resources/css/app.css`, `components/settings/account-settings.tsx` (one mount), `lang/*.json` |
| Photo (Ph) | 9, 10, 11 | head of Task 1 | `app/Support/Avatars/AvatarUrl.php`, `app/Concerns/HasGuestIdentity.php` (`avatarUrl` only; lane P edits `presenceColor` in the same file), `ProfileController::destroy`, `routes/settings.php`, `routes/web.php`, `tests/Pest.php` (one block), `components/settings/account-settings.tsx` (one mount), `lang/*.json`; alone on `InstanceSettingKey`, `InstanceSettings`, the Branding controller, request and front files |
| Security (S) | 12 to 19 | head of Task 1 | `routes/settings.php` (Task 13 swaps every `RequirePassword::class` of the file for `RequirePasswordUnlessNoneKnown::class`: lane Ph's new photo routes carry no confirmation, so the swap does not reach them), `routes/web.php` (the callback line), `AccountSettingsController`, `SecuritySettings`, `AppServiceProvider`, `config/skrum.php`, `components/settings/account-settings.tsx`, `lang/*.json`; alone on `bootstrap/app.php`, `PasswordConfirmation`, `password-gate.tsx` |
| Codes (C) | 20, 21, 22 | head of Task 1 | the five snapshot builders and five guest-token controllers (no other lane touches them), `routes/web.php`, the five share mounts, `components/auth/login-form.tsx`, `lang/*.json` |

The five lanes run in parallel. Merge order: M, Ph, P, C, S (smallest first; S last because it touches the most shared settings files). `lang/*.json` conflicts are resolved by the controller at each merge (keys appended in one block per lane). `HasGuestIdentity`: lane P adds a method, lane Ph changes `avatarUrl()`: a textual merge. `tests/Concurrency` files are new per task.

---

## Step A — single writer

### Task 1: Account columns, the presence colour

**Files:**
- Create: `database/migrations/2026_10_26_100000_add_account_columns_to_users_table.php`, `app/Support/Avatars/PresenceColor.php`
- Modify: `app/Models/User.php`, `app/Support/Mail/MailBrand.php` (`presence()` delegates), `database/factories/UserFactory.php`
- Test: `tests/Unit/Support/Avatars/PresenceColorTest.php`, `tests/Feature/Settings/AccountColumnsTest.php`

**Interfaces:**
- Produces: `PresenceColor::Count = 12`; `PresenceColor::forSeed(string $seed): int`; `User::presenceColor(): int`; `User` attributes `presence_color` (`?int`, fillable), `avatar_photo_path` (`?string`, hidden, not fillable), `reduce_motion` (`bool`, fillable, default false), `password_set_at` (`?Carbon`, hidden, not fillable). `UserFactory` sets `password_set_at` to now.

- [ ] **Step 1: Write the failing tests**

`tests/Unit/Support/Avatars/PresenceColorTest.php`:

```php
<?php

use App\Support\Avatars\PresenceColor;

it('keeps the colour mail has always derived from an avatar seed', function (string $seed) {
    $before = (hexdec(substr(hash('sha256', $seed), 0, 7)) % 12) + 1;

    expect(PresenceColor::forSeed($seed))->toBe($before);
})->with(['0123456789abcdef0123456789abcdef', 'ffffffffffffffffffffffffffffffff', 'a']);

it('always gives one of the twelve colours', function () {
    $colours = collect(range(1, 300))->map(fn (int $index): int => PresenceColor::forSeed("seed-{$index}"))->unique()->sort()->values()->all();

    expect($colours)->toBe(range(1, 12));
});
```

`tests/Feature/Settings/AccountColumnsTest.php`:

```php
<?php

use App\Models\User;
use App\Support\Avatars\PresenceColor;
use App\Support\Mail\MailBrand;

it('derives the presence colour of a user who never chose one, as mail does', function () {
    $user = User::factory()->create();

    expect($user->presence_color)->toBeNull()
        ->and($user->presenceColor())->toBe(PresenceColor::forSeed($user->avatarSeed()))
        ->and($user->presenceColor())->toBe(MailBrand::presence($user->avatarSeed()));
});

it('uses the colour the user chose', function () {
    $user = User::factory()->create(['presence_color' => 7]);

    expect($user->presenceColor())->toBe(7);
});

it('starts with animations on and a known password, and hides the photo path and the password date', function () {
    $user = User::factory()->create();
    $user->forceFill(['avatar_photo_path' => 'avatars/'.str_repeat('a', 40).'.jpg'])->save();

    expect($user->fresh()->reduce_motion)->toBeFalse()
        ->and($user->password_set_at)->not->toBeNull()
        ->and($user->fresh()->toArray())->not->toHaveKeys(['avatar_photo_path', 'password_set_at']);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `vendor/bin/sail artisan test --compact tests/Unit/Support/Avatars/PresenceColorTest.php tests/Feature/Settings/AccountColumnsTest.php`
Expected: FAIL (class `PresenceColor` not found; unknown column `presence_color`).

- [ ] **Step 3: Implementation**

Migration (`vendor/bin/sail artisan make:migration add_account_columns_to_users_table --no-interaction`, then rename to the date above):

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->unsignedTinyInteger('presence_color')->nullable();
            $table->string('avatar_photo_path', 64)->nullable();
            $table->boolean('reduce_motion')->default(false);
            $table->dateTime('password_set_at')->nullable();
        });
    }
};
```

`app/Support/Avatars/PresenceColor.php`:

```php
<?php

namespace App\Support\Avatars;

/**
 * The twelve presence colours of the theme (`--skrum-presence-1` to `-12`).
 * Without a choice, a person's colour is derived from the seed of their
 * avatar, which mail has always done: no colour changes for anyone.
 */
class PresenceColor
{
    public const int Count = 12;

    public static function forSeed(string $seed): int
    {
        return (hexdec(substr(hash('sha256', $seed), 0, 7)) % self::Count) + 1;
    }
}
```

`MailBrand::presence()` body becomes `return PresenceColor::forSeed($avatarSeed);` (keep its signature and its `PresenceColors` constant).

`app/Models/User.php`: add to the docblock `@property int|null $presence_color`, `@property string|null $avatar_photo_path`, `@property bool $reduce_motion`, `@property Carbon|null $password_set_at`; add `'presence_color', 'reduce_motion'` to `#[Fillable]`; add `'avatar_photo_path', 'password_set_at'` to `#[Hidden]`; add `'reduce_motion' => false` to `$attributes`; add to `casts()` `'presence_color' => 'integer'`, `'reduce_motion' => 'boolean'`, `'password_set_at' => 'datetime'`; add:

```php
    public function presenceColor(): int
    {
        return $this->presence_color ?? PresenceColor::forSeed($this->avatarSeed());
    }
```

`UserFactory::definition()`: add `'password_set_at' => now(),`.

- [ ] **Step 4: Run the tests on PostgreSQL**

Run: `bin/test-db pgsql -- tests/Unit/Support/Avatars tests/Feature/Settings/AccountColumnsTest.php tests/Arch $(grep -rl MailBrand tests | tr '\n' ' ')`.
Expected: PASS on both.

- [ ] **Step 5: Commit**

```bash
git add database/migrations/2026_10_26_100000_add_account_columns_to_users_table.php app/Support/Avatars/PresenceColor.php app/Models/User.php app/Support/Mail/MailBrand.php database/factories/UserFactory.php tests/Unit/Support/Avatars/PresenceColorTest.php tests/Feature/Settings/AccountColumnsTest.php
git commit -m "feat(account): presence colour, photo, motion and password-date columns on users

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

---

## Lane Presence (AC-4, GU-1)

### Task 2: The colour on the profile and in the five presence channels

**Files:**
- Create: `database/migrations/2026_10_26_100100_add_presence_color_to_session_participants.php`
- Modify: `app/Concerns/HasGuestIdentity.php`, `app/Models/{Participant,PokerPlayer,WhiteboardMember,TeamSurveyRespondent,GamePlayer}.php`, `app/Http/Requests/Settings/ProfileUpdateRequest.php`, `app/Http/Controllers/Settings/AccountSettingsController.php` (`profile()`), `app/Http/Controllers/BroadcastAuthorizationsController.php`, `app/Actions/Games/PresentGamePlayer.php` (and the `players` shape in `BuildGameSnapshot`'s docblock)
- Test: `tests/Feature/Settings/PresenceColorTest.php`, `tests/Feature/Realtime/PresenceMemberColourTest.php`
- Added in the review fix round (AC-4 "in mail"): `app/Actions/Integrations/BuildRetroRecap.php` (`assigneePresence`), `app/Actions/Notifications/PresentInvitationNotifications.php`, `app/Notifications/WorkspaceInvitationNotification.php` read `presenceColor()` of the person instead of `MailBrand::presence($avatarSeed)`; `MailBrand::presence($inviterName)` stays only for an invitation without an inviter. Tests in `RetroRecapTest`, `WorkspaceInvitationMailTest`, `BellNotificationsTest`.

**Interfaces:**
- Consumes: `PresenceColor`, `User::presenceColor()` (Task 1).
- Produces: `HasGuestIdentity::presenceColor(): int`; `GamePlayer::presenceColor()` (the participant's for an icebreaker player) and `TeamSurveyRespondent::presenceColor()` (the participant's for a respondent answering for a retro participant; added in the review fix round); member data `presence: int` on `presence-retro.*`, `presence-poker.*`, `presence-whiteboard.*`, `presence-game.*`, `presence-survey.*`; `PresentGamePlayer` key `presence`; profile props `profile.presenceColor: int`.

- [ ] **Step 1: Write the failing tests**

`tests/Feature/Settings/PresenceColorTest.php`:

```php
<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('sends the current colour to the profile', function () {
    $user = User::factory()->create(['presence_color' => 4]);

    $this->actingAs($user)->get(route('settings.edit'))
        ->assertInertia(fn (Assert $page) => $page->where('profile.presenceColor', 4));
});

it('saves a chosen colour with the profile', function () {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch(route('profile.update'), ['name' => $user->name, 'email' => $user->email, 'presence_color' => 9])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('settings.edit'));

    expect($user->fresh()->presence_color)->toBe(9);
});

it('refuses a colour outside the twelve', function (mixed $colour) {
    $user = User::factory()->create();

    $this->actingAs($user)
        ->patch(route('profile.update'), ['name' => $user->name, 'email' => $user->email, 'presence_color' => $colour])
        ->assertSessionHasErrors('presence_color');
})->with([0, 13, 'red']);
```

`tests/Feature/Realtime/PresenceMemberColourTest.php` (read `tests/Feature/Realtime` or the existing broadcast-authorisation tests first and copy their way of posting to `broadcasting/auth` with a `socket_id` and of reading `channel_data`):

```php
<?php

use App\Models\GameRoom;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\User;
use App\Models\Whiteboard;

function presenceMemberData(mixed $test, string $channel): array
{
    $response = $test->post('/broadcasting/auth', ['socket_id' => '1234.5678', 'channel_name' => $channel])->assertOk();

    return json_decode($response->json('channel_data'), true)['user_info'];
}

it('sends a member colour on the retro channel', function () {
    $retro = Retro::factory()->create();
    [$user] = retroMember($retro);
    $user->update(['presence_color' => 3]);

    $this->actingAs($user);

    expect(presenceMemberData($this, "presence-retro.{$retro->id}")['presence'])->toBe(3);
});

it('sends the colour a guest picked on the poker channel', function () {
    $game = PokerGame::factory()->withGuestAccess()->create();
    $guest = pokerGuest($game);
    $guest->update(['presence_color' => 11]);

    $this->withCookies(pokerGuestCookie($guest))->withCredentials();

    expect(presenceMemberData($this, "presence-poker.{$game->id}")['presence'])->toBe(11);
});

it('gives one person the same colour on two whiteboards', function () {
    $user = User::factory()->create();
    $first = Whiteboard::factory()->create();
    $second = Whiteboard::factory()->create(['team_id' => $first->team_id]);
    $first->team->users()->attach($user);

    $this->actingAs($user);

    expect(presenceMemberData($this, "presence-whiteboard.{$first->id}")['presence'])
        ->toBe(presenceMemberData($this, "presence-whiteboard.{$second->id}")['presence'])
        ->toBe($user->presenceColor());
});

it('gives an icebreaker player the colour of its participant', function () {
    $retro = Retro::factory()->create();
    [, $participant] = retroMember($retro);
    $room = GameRoom::factory()->icebreaker($retro)->create();
    $player = $room->players()->create(['participant_id' => $participant->id]);

    expect($player->presenceColor())->toBe($participant->presenceColor());
});
```

Adapt the fixtures to the helpers that exist (`retroMember` returns `[User, Participant]`; check the whiteboard membership rule in `ResolveMember` and use the team helper the whiteboard tests use). The survey and standalone game channels are covered by one dataset case each in the same file, in the pattern of the poker case (`surveyGuest`, `gameRoomGuest` and their cookie helpers).

- [ ] **Step 2: Run them and see them fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Settings/PresenceColorTest.php tests/Feature/Realtime/PresenceMemberColourTest.php`
Expected: FAIL (`profile.presenceColor` missing; no `presence` in `user_info`).

- [ ] **Step 3: Implementation**

Migration:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['participants', 'poker_players', 'whiteboard_members', 'team_survey_respondents', 'game_players'] as $table) {
            Schema::table($table, function (Blueprint $table): void {
                $table->unsignedTinyInteger('presence_color')->nullable();
            });
        }
    }
};
```

`HasGuestIdentity` (docblock `@property int|null $presence_color`):

```php
    /**
     * A member wears the colour of their account on every session; a guest
     * the one picked when joining, or one derived from their own avatar.
     */
    public function presenceColor(): int
    {
        $owner = $this->avatarOwner();

        if ($owner !== null) {
            return $owner->presenceColor();
        }

        return $this->presence_color ?? PresenceColor::forSeed($this->avatarSeed());
    }
```

The five models: add `'presence_color'` to `#[Fillable]`, `@property int|null $presence_color`, cast `'presence_color' => 'integer'`. `GamePlayer`: alias `presenceColor as private identityPresenceColor` in its `use HasGuestIdentity { … }` block and add

```php
    public function presenceColor(): int
    {
        if ($this->participant_id !== null && $this->participant !== null) {
            return $this->participant->presenceColor();
        }

        return $this->identityPresenceColor();
    }
```

`ProfileUpdateRequest::rules()`: the colour is accepted whatever the avatar setting —

```php
        $rules = [
            ...$this->profileRules($this->user()),
            'presence_color' => ['sometimes', 'nullable', 'integer', 'between:1,'.PresenceColor::Count],
        ];
```

and the rest of the method keeps its avatar-style branch on `$rules`. `AccountSettingsController::profile()` adds `'presenceColor' => $user->presenceColor(),`. In `BroadcastAuthorizationsController`, each of the five `authorizePresenceChannel(…, [ … ])` arrays gains `'presence' => $x->presenceColor(),` after `'isGuest'`. `PresentGamePlayer::handle()` gains `'presence' => $player->presenceColor(),` (docblock shape too).

- [ ] **Step 4: Run the tests on PostgreSQL**

Run: `bin/test-db pgsql -- tests/Feature/Settings tests/Feature/Realtime tests/Feature/Games`.
Expected: PASS. A games test asserting the exact player shape gains `presence` (list it in the report).

- [ ] **Step 5: Commit** — `feat(presence): one colour per person, chosen in the profile and sent on every presence channel` (with the two trailer lines).

### Task 3: Taken colours and the colour of a guest, on the five join pages

**Files:**
- Modify: `app/Actions/Sessions/PresentJoinSession.php`, `app/Http/Controllers/{RetroJoins,PokerJoins,WhiteboardJoins,TeamSurveyJoins,GameJoins}Controller.php`
- Test: `tests/Feature/Sessions/GuestColourTest.php`

**Interfaces:**
- Consumes: `HasGuestIdentity::presenceColor()` (Task 2).
- Produces: `PresentJoinSession::colours(iterable $participants, ?User $visitor): array{takenColors: array<int, int>, suggestedPresence: ?int}`; the five join pages' props `takenColors`, `suggestedPresence`; the five join POSTs accept `presence`.

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Models\GameRoom;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\TeamSurvey;
use App\Models\Whiteboard;
use Illuminate\Database\Eloquent\Model;
use Inertia\Testing\AssertableInertia as Assert;

/**
 * @return array<string, array{0: Closure(): Model, 1: string, 2: string, 3: string, 4: string}>
 */
dataset('guest sessions', [
    'retro' => [fn () => Retro::factory()->withGuestAccess()->create(), 'retros.join.show', 'retros.join.store', 'participants', 'retros/join'],
    'poker' => [fn () => PokerGame::factory()->withGuestAccess()->create(), 'poker.join.show', 'poker.join.store', 'players', 'poker/join'],
    'whiteboard' => [fn () => Whiteboard::factory()->withGuestAccess()->create(), 'whiteboards.join.show', 'whiteboards.join.store', 'members', 'whiteboards/join'],
    'survey' => [fn () => TeamSurvey::factory()->open()->withGuestAccess()->create(), 'surveys.join.show', 'surveys.join.store', 'respondents', 'surveys/join'],
    'game' => [fn () => GameRoom::factory()->linkAccess()->create(), 'games.join.show', 'games.join.store', 'players', 'games/join'],
]);

it('lists the colours already taken in the session', function (Closure $make, string $show, string $store, string $relation, string $component) {
    $session = $make();
    $session->{$relation}()->create(['guest_name' => 'Ada', 'presence_color' => 5]);
    $session->{$relation}()->create(['guest_name' => 'Lin', 'presence_color' => 2]);

    $this->get(route($show, $session->guest_token))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component($component)->where('takenColors', [2, 5])->where('suggestedPresence', null));
})->with('guest sessions');

it('disables nothing once the twelve colours are taken', function (Closure $make, string $show, string $store, string $relation) {
    $session = $make();

    foreach (range(1, 12) as $colour) {
        $session->{$relation}()->create(['guest_name' => "Guest {$colour}", 'presence_color' => $colour]);
    }

    $this->get(route($show, $session->guest_token))->assertInertia(fn (Assert $page) => $page->where('takenColors', []));
})->with('guest sessions');

it('stores the colour a guest picks', function (Closure $make, string $show, string $store, string $relation) {
    $session = $make();

    $this->post(route($store, $session->guest_token), ['name' => 'Otter', 'presence' => 8])->assertRedirect();

    expect($session->{$relation}()->where('guest_name', 'Otter')->sole()->presence_color)->toBe(8);
})->with('guest sessions');

it('keeps the derived colour when the guest picks none', function (Closure $make, string $show, string $store, string $relation) {
    $session = $make();

    $this->post(route($store, $session->guest_token), ['name' => 'Otter'])->assertRedirect();

    expect($session->{$relation}()->where('guest_name', 'Otter')->sole()->presence_color)->toBeNull();
})->with('guest sessions');

it('refuses a colour outside the twelve', function (Closure $make, string $show, string $store) {
    $session = $make();

    $this->postJson(route($store, $session->guest_token), ['name' => 'Otter', 'presence' => 13])->assertJsonValidationErrors('presence');
})->with('guest sessions');
```

If a factory needs a team or a status the dataset does not give (the survey's `open()`), adapt the closure; do not add factory states for this task.

- [ ] **Step 2: Run it and see it fail** — `vendor/bin/sail artisan test --compact tests/Feature/Sessions/GuestColourTest.php` → FAIL (`takenColors` missing).

- [ ] **Step 3: Implementation**

`PresentJoinSession`:

```php
    /**
     * The colours already worn in the session, which the picker disables
     * while a free one remains; and the visitor's own colour when it is free.
     *
     * @param  iterable<int, Participant|PokerPlayer|WhiteboardMember|TeamSurveyRespondent|GamePlayer>  $participants
     * @return array{
     *     takenColors: array<int, int>,
     *     suggestedPresence: ?int
     * }
     */
    public function colours(iterable $participants, ?User $visitor): array
    {
        $taken = collect($participants)
            ->map(fn (Participant|PokerPlayer|WhiteboardMember|TeamSurveyRespondent|GamePlayer $participant): int => $participant->presenceColor())
            ->unique()
            ->sort()
            ->values();
        $takenColors = $taken->count() >= PresenceColor::Count ? [] : $taken->all();
        $own = $visitor?->presenceColor();

        return [
            'takenColors' => $takenColors,
            'suggestedPresence' => $own !== null && ! in_array($own, $takenColors, true) ? $own : null,
        ];
    }
```

Each join controller's `show` adds the spread, loading what `presenceColor()` reads — retro: `...$presentJoinSession->colours($retro->participants()->with('user')->get(), $request->user())`; poker: `$game->players()->with('user')->get()`; whiteboard: `$board->members()->with('user')->get()`; survey: `$survey->respondents()->with('user')->get()`; game: `$room->players()->with(['user', 'participant.user'])->get()`. Each `store` validates `'presence' => ['sometimes', 'nullable', 'integer', 'between:1,'.PresenceColor::Count]` and adds `'presence_color' => $validated['presence'] ?? null` to the `create([...])`.

- [ ] **Step 4: Run on PostgreSQL** — `bin/test-db pgsql -- tests/Feature/Sessions tests/Feature/Retros/RetroJoinTest.php tests/Feature/Poker tests/Feature/Whiteboards tests/Feature/TeamSurveys/TeamSurveyJoinTest.php tests/Feature/Games` → PASS (the existing join tests are untouched by the new keys; a test that asserts the page props exactly gains the two keys — list it).

- [ ] **Step 5: Commit** — `feat(guests): taken colours on the join pages and the colour a guest picks`.

### Task 4: The front wears the server's colour

**Files:**
- Create: `resources/js/lib/presence/presence-color.ts` (+ test)
- Modify: `resources/js/lib/retro/types.ts` (`PresenceMember.presence?: number`), `resources/js/lib/whiteboard/presence-slot.ts` (+ test), `resources/js/hooks/use-whiteboard-cursors.ts`, `resources/js/components/whiteboard/board-header.tsx`, `resources/js/components/session/live-cursors.tsx` (+ test), `session-presence.tsx` (+ test), `resources/js/components/retro/board-cursors.tsx`, `resources/js/components/poker/room-cursors.tsx`, `resources/js/lib/games/types.ts` (`presence: number` on a player), `resources/js/components/games/*` that build presence-stack entries

**Interfaces:**
- Consumes: member data `presence` (Task 2), `PresentGamePlayer.presence`.
- Produces:

```ts
export const PresenceSlots = 12;
export function hashedSlot(id: string): number; // the old whiteboard hash, kept as the fallback
export function presenceOf(member: { id: string; presence?: number | null }): number; // member.presence when 1..12, else hashedSlot(member.id)
export function presenceVar(slot: number): string; // `var(--skrum-presence-${slot})`
```

`LiveCursors` gains the prop `presenceFor: (senderId: string) => number | undefined`; `presenceCursorColor(slot: number)` replaces `presenceCursorColor(memberId: string)`.

- [ ] **Step 1: `presence-color.ts`, test first.** `presenceOf({ id: 'x', presence: 7 })` is 7; `presence: 0`, `13`, `null` and absent fall back to `hashedSlot('x')`; `hashedSlot` returns, for the ids of the existing `presence-slot.test.ts`, the values that test expects (move those cases). `presenceVar(3)` is `var(--skrum-presence-3)`.
- [ ] **Step 2: Callers.** `session-presence.tsx`: `toParticipants` uses `presenceFor ?? presenceOf` (the stack always gets a colour). `live-cursors.tsx`: the cursor and touch dot use `presenceVar(slot)` when `presenceFor(cursor.id)` gives one, the library's `color` otherwise; retro, poker and whiteboard cursor layers pass `presenceFor = (id) => online.find((m) => m.id === id)?.presence`. Whiteboard: `presenceFor(member)` returns `presenceOf(member)`; `use-whiteboard-cursors.ts` looks up the sender's slot in the online roster and calls `presenceCursorColor(slot)` (cache key stays `slot:dark`); `board-header.tsx` takes its own colour from its roster entry (`online.find((m) => m.id === me.id)`), `presenceOf(me)` before the channel is up. Games: the players' `presence` feeds their presence-stack entries.
- [ ] **Step 3: Tests.** Vitest: `presence-color`, `presence-slot` (the cursor colour for a slot, light and dark), `live-cursors` (a cursor whose sender has `presence: 5` is painted with `var(--skrum-presence-5)`; an unknown sender keeps the library colour), `session-presence` (a member with `presence: 9` gets `presence={9}`). Hooks kept: `[data-slot="presence-stack"]`, the cursor label.
- [ ] **Step 4: Gates** — `npm run test -- presence-color presence-slot live-cursors session-presence`, `npm run types:check`, `npm run check`, `npm run build:front`.
- [ ] **Step 5: Commit** — `feat(presence): cursors and presence stacks wear each person's colour`.

### Task 5: The colour picker of the profile

**Mockup:** `ScreenUserSettings` a, Profile ("Avatar & presence colour", `us-sw` swatches with a ring). Deviation P26-01.

**Files:**
- Create: `resources/js/components/skrum/presence-swatches.tsx` (+ test) — extracted from `guest-join.tsx` (its swatch classes, `nextFree`, the radiogroup and arrow keys), own commit; `resources/js/components/settings/presence-colour-picker.tsx` (+ test)
- Modify: `resources/js/components/skrum/guest-join.tsx` (uses `PresenceSwatches`, behaviour unchanged, its tests unchanged), `resources/js/components/settings/account-settings.tsx` (mounts the picker in `ProfileCard`'s `presenceColours`), `resources/js/types/*` for `profile.presenceColor`

**Interfaces:**

```ts
export function PresenceSwatches(props: {
    value: number | null;
    onChange: (presence: number) => void;
    taken?: number[];          // disabled and marked with the `user` icon
    name?: string;             // a hidden input carrying the value, for <Form>
    label: string;             // the radiogroup's accessible name
    size?: 'md' | 'lg';        // 26 px desktop; 44 px targets on a phone (MobileAccess)
}): ReactElement;
```

- [ ] **Step 1: Failing tests** for `PresenceSwatches` (12 radios named "Colour 1" … "Colour 12"; arrow keys skip taken ones; the hidden input carries the value; a taken swatch is `aria-disabled` and shows the icon) and for `PresenceColourPicker` (title "Avatar & presence colour", the sentence of P26-01, the current colour checked, `name="presence_color"` so the card's **Save** sends it).
- [ ] **Step 2: Build.** The picker sits in `ProfileCard`'s `presenceColours` place; the avatar's ring (`PersonAvatar presence`) follows the selected swatch before saving.
- [ ] **Step 3: Gates** — `npm run test -- presence-swatches presence-colour-picker guest-join profile-card`, types, check, build.
- [ ] **Step 4: Commits** — `refactor(skrum): presence swatches shared by the guest join and the profile`, then `feat(settings): the presence colour in the profile`.

### Task 6: The colour picker of the guest join pages

**Mockup:** `GuestJoin` (states: filled with colour, taken colour disabled), `MobileAccess` (6 × 2 grid, 48 px, taken marked). Deviation P26-07.

**Files:**
- Modify: `resources/js/components/session/guest-join-page.tsx` (+ test), the five pages `resources/js/pages/{retros,poker,whiteboards,surveys,games}/join.tsx` (+ their tests)

**Interfaces:**
- Consumes: props `takenColors: number[]`, `suggestedPresence: number | null` (Task 3).
- Produces: `GuestJoinPage` props `takenColors?: number[]`, `suggestedPresence?: number | null`; the POST carries `presence`.

- [ ] **Step 1: Failing tests.** `guest-join-page.test.tsx`: with `takenColors=[2,5]` the colour row shows, Colour 2 and 5 are disabled, the first free colour is selected (or `suggestedPresence` when given), submitting posts `{ name, presence }`; without `takenColors` (an old page) no colour row (the component's rule). One test per page checks the props are passed.
- [ ] **Step 2: Build.** `GuestJoinPage` forwards `takenColors` and `initialPresence={suggestedPresence ?? undefined}` to `GuestJoin`; `join` sends `presence` from the `onSubmit` data; the phone layout uses `PresenceSwatches size="lg"` in a 6 × 2 grid.
- [ ] **Step 3: Gates** — `npm run test -- guest-join join`, types, check, build.
- [ ] **Step 4: Commit** — `feat(guests): a guest picks a colour when joining`.

---

## Lane Motion (AC-5)

### Task 7: The "Reduce animations" preference on the account

**Files:**
- Create: `app/Http/Controllers/Settings/MotionPreferencesController.php`
- Modify: `routes/settings.php`, `resources/views/app.blade.php`, `app/Http/Controllers/Settings/AccountSettingsController.php` (`appearance` prop)
- Test: `tests/Feature/Settings/MotionPreferencesTest.php`

**Interfaces:**
- Produces: route `motionPreferences.update` (PATCH `settings/motion`, `reduce_motion` boolean); `<html class="… reduce-motion">` for a user with the flag; the `appearance` prop becomes `{ reduceMotion: bool } | false` (it is a boolean today: read `account-settings.tsx` and keep its "section shown" meaning: `false` = hidden).

- [ ] **Step 1: Failing test**

```php
<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('saves the preference', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->patch(route('motionPreferences.update'), ['reduce_motion' => true])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    expect($user->fresh()->reduce_motion)->toBeTrue();
});

it('refuses a missing or non-boolean value', function (mixed $value) {
    $this->actingAs(User::factory()->create())
        ->patchJson(route('motionPreferences.update'), ['reduce_motion' => $value])
        ->assertJsonValidationErrors('reduce_motion');
})->with([null, 'often']);

it('marks the root element of every page for a user who reduces motion', function () {
    $user = User::factory()->create(['reduce_motion' => true]);

    $html = $this->actingAs($user)->get(route('settings.edit'))->assertOk()->getContent();

    expect($html)->toMatch('/<html[^>]*class="[^"]*\breduce-motion\b/');
});

it('does not mark it otherwise, nor for a visitor', function () {
    $this->actingAs(User::factory()->create())->get(route('settings.edit'))
        ->assertDontSee('reduce-motion', false);

    auth()->logout();

    $this->get(route('login'))->assertDontSee('reduce-motion', false);
});

it('sends the preference to the appearance section', function () {
    $this->actingAs(User::factory()->create(['reduce_motion' => true]))->get(route('settings.edit'))
        ->assertInertia(fn (Assert $page) => $page->where('appearance.reduceMotion', true));
});

it('refuses an unverified account', function () {
    $this->actingAs(User::factory()->unverified()->create())
        ->patch(route('motionPreferences.update'), ['reduce_motion' => true])
        ->assertRedirect(route('verification.notice'));
});
```

- [ ] **Step 2: See it fail** — route missing.
- [ ] **Step 3: Implementation**

```php
<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

class MotionPreferencesController extends Controller
{
    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'reduce_motion' => ['required', 'boolean'],
        ]);

        $request->user()->update($validated);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Appearance saved.')]);

        return back();
    }
}
```

`routes/settings.php`, in the `auth`, `verified` group beside the shortcut preferences: `Route::patch('settings/motion', [MotionPreferencesController::class, 'update'])->name('motionPreferences.update');`. `app.blade.php`: `@class(['dark' => ($appearance ?? 'system') == 'dark', 'reduce-motion' => (bool) auth()->user()?->reduce_motion])` on `<html>`. `AccountSettingsController::edit`: `'appearance' => $verified ? ['reduceMotion' => $user->reduce_motion] : false,` — and in `account-settings.tsx` the truthiness test of `appearance` keeps working (an object is truthy); the type changes in Task 8.

- [ ] **Step 4: PostgreSQL** — `bin/test-db pgsql -- tests/Feature/Settings` → PASS (`AccountSettingsPageTest` asserting `appearance` true becomes the object: list it).
- [ ] **Step 5: Commit** — `feat(settings): reduce animations on the account`.

### Task 8: The front honours it

**Mockup:** `ScreenUserSettings` a, Appearance (switch "Reduce animations" with its help).

**Files:**
- Create: `resources/js/lib/motion.ts` (+ test), `resources/js/components/settings/appearance/reduce-motion-field.tsx` (+ test)
- Modify: `resources/css/app.css`; `resources/js/components/ui/chart.tsx`, `settings/use-visible-section.ts`, `skrum/gif-picker.tsx`, `retro/session-confetti.tsx` (their `matchMedia` reads go through `prefersReducedMotion()`); `settings/account-settings.tsx` (mount in `AppearanceCard`'s `reduceAnimations`); the `appearance` prop type

**Interfaces:**

```ts
export const ReduceMotionClass = 'reduce-motion';
export const MotionChangedEvent = 'skrum:motion';
export function prefersReducedMotion(): boolean; // the class on <html>, or the system query
export function applyReduceMotion(on: boolean): void; // toggles the class and dispatches MotionChangedEvent on window
export function subscribeToMotion(onChange: () => void): () => void; // the media query's change and MotionChangedEvent
```

- [ ] **Step 1: `motion.ts`, test first** (class present → true whatever the query; class absent → the query's answer; `applyReduceMotion(true)` adds the class and notifies a subscriber; unsubscribe stops it).
- [ ] **Step 2: CSS.** In `resources/css/app.css`, beside the existing `@media (prefers-reduced-motion: reduce)` block, the same two rules under `html.reduce-motion` (`html.reduce-motion *, html.reduce-motion *::before, html.reduce-motion *::after { … }` and `html.reduce-motion .flip-3d { … }`), and the variants:

```css
@custom-variant motion-reduce {
  @media (prefers-reduced-motion: reduce) {
    @slot;
  }
  &:where(.reduce-motion, .reduce-motion *) {
    @slot;
  }
}

@custom-variant motion-safe {
  @media (prefers-reduced-motion: no-preference) {
    &:not(:where(.reduce-motion, .reduce-motion *)) {
      @slot;
    }
  }
}
```

Then `npm run build` and check the compiled stylesheet: `grep -c 'reduce-motion' public/build/assets/app-*.css` is above 100 (the 126 `motion-*` uses compile under the class) and `grep -c 'prefers-reduced-motion' public/build/assets/app-*.css` is not zero. If Tailwind refuses to redefine a built-in variant (spec §16 item 1), remove the two `@custom-variant` blocks, keep the global rules, and report it.
- [ ] **Step 3: The four readers.** `useReducedMotion` of `chart.tsx` becomes `useSyncExternalStore(subscribeToMotion, prefersReducedMotion, () => false)`; the three others call `prefersReducedMotion()`. Their existing tests keep passing with `matchMedia` mocked; each gains a case with the class on `<html>`.
- [ ] **Step 4: The switch.** `ReduceMotionField`: a `Switch` labelled "Reduce animations", help "Replaces card flips, confetti and drag tilts with simple fades. On by default when your system asks for it.", and, when `window.matchMedia('(prefers-reduced-motion: reduce)').matches`, the line "Your system already asks for fewer animations."; a change calls `router.patch(MotionPreferencesController.update.url(), { reduce_motion }, { preserveScroll: true, onSuccess: () => applyReduceMotion(reduce_motion) })` and reverts on error. Vitest: the stored value is shown, a toggle posts and applies the class, an error reverts.
- [ ] **Step 5: Gates** — `npm run test -- motion reduce-motion-field chart use-visible-section gif-picker session-confetti appearance`, types, check, build.
- [ ] **Step 6: Commit** — `feat(settings): reduce animations everywhere, with the switch in Appearance`.

---

## Lane Photo (AC-1)

### Task 9: Stripping image metadata, in pure PHP

**Files:**
- Create: `app/Support/Avatars/ImageMetadata.php`
- Modify: `tests/Pest.php` (one block: `pngBytes()`, `jpegBytes()`)
- Test: `tests/Unit/Support/Avatars/ImageMetadataTest.php`

**Interfaces:**
- Produces: `ImageMetadata::strip(string $bytes, string $mime): ?string` — null when the bytes are not a well-formed JPEG or PNG; `pngBytes(array $textChunks = []): string` (a 1 × 1 PNG, with `tEXt` chunks when given); `jpegBytes(bool $withExif = true): string` (a JFIF header, an optional APP1 `Exif` segment holding `GPS`, an APP13, a comment, a 1 × 1 SOF0, a SOS with two bytes of data, EOI).

- [ ] **Step 1: The helpers and the failing test**

In `tests/Pest.php`:

```php
function pngChunk(string $type, string $data): string
{
    return pack('N', strlen($data)).$type.$data.pack('N', crc32($type.$data));
}

/** @param array<string, string> $textChunks */
function pngBytes(array $textChunks = []): string
{
    $header = pngChunk('IHDR', pack('NNCCCCC', 1, 1, 8, 2, 0, 0, 0));
    $text = implode('', array_map(fn (string $key, string $value): string => pngChunk('tEXt', "{$key}\0{$value}"), array_keys($textChunks), $textChunks));
    $pixels = pngChunk('IDAT', (string) gzcompress("\0\xFF\x00\x00"));

    return "\x89PNG\r\n\x1A\n".$header.$text.$pixels.pngChunk('IEND', '');
}

function jpegSegment(int $marker, string $data): string
{
    return "\xFF".chr($marker).pack('n', strlen($data) + 2).$data;
}

function jpegBytes(bool $withExif = true): string
{
    $jfif = jpegSegment(0xE0, "JFIF\0\x01\x01\0\0\x01\0\x01\0\0");
    $exif = $withExif ? jpegSegment(0xE1, "Exif\0\0GPS 48.58N 7.75E") : '';
    $iptc = $withExif ? jpegSegment(0xED, 'Photoshop 3.0 caption') : '';
    $comment = $withExif ? jpegSegment(0xFE, 'taken at home') : '';
    $frame = jpegSegment(0xC0, "\x08\0\x01\0\x01\x01\x01\x11\0");
    $scan = jpegSegment(0xDA, "\x01\x01\0\0\x3F\0")."\x12\x34";

    return "\xFF\xD8".$jfif.$exif.$iptc.$comment.$frame.$scan."\xFF\xD9";
}
```

`tests/Unit/Support/Avatars/ImageMetadataTest.php`:

```php
<?php

use App\Support\Avatars\ImageMetadata;

it('removes Exif, IPTC and comments from a JPEG and keeps the image', function () {
    $clean = ImageMetadata::strip(jpegBytes(), 'image/jpeg');

    expect($clean)->not->toBeNull()
        ->and($clean)->not->toContain('Exif')
        ->and($clean)->not->toContain('GPS')
        ->and($clean)->not->toContain('Photoshop')
        ->and($clean)->not->toContain('taken at home')
        ->and($clean)->toContain('JFIF')
        ->and($clean)->toBe(jpegBytes(withExif: false))
        ->and(getimagesizefromstring($clean))->not->toBeFalse();
});

it('removes text chunks from a PNG and keeps the image', function () {
    $clean = ImageMetadata::strip(pngBytes(['Comment' => 'home', 'Author' => 'Ada']), 'image/png');

    expect($clean)->toBe(pngBytes())
        ->and(getimagesizefromstring($clean)[0])->toBe(1);
});

it('refuses bytes that are not what they claim', function (string $bytes, string $mime) {
    expect(ImageMetadata::strip($bytes, $mime))->toBeNull();
})->with([
    'png as jpeg' => [fn () => pngBytes(), 'image/jpeg'],
    'truncated jpeg' => [fn () => substr(jpegBytes(), 0, 30), 'image/jpeg'],
    'truncated png' => [fn () => substr(pngBytes(), 0, 40), 'image/png'],
    'gif' => ['GIF89a', 'image/gif'],
]);
```

- [ ] **Step 2: See it fail** — class missing.
- [ ] **Step 3: Implementation**

```php
<?php

namespace App\Support\Avatars;

/**
 * Removes what a photo says about where and when it was taken, without an
 * image library: JPEG segments and PNG chunks are copied or skipped, the
 * pixels are never decoded. A file that does not parse is refused.
 */
class ImageMetadata
{
    /** @var array<int, int> JFIF, ICC profile, Adobe colour transform: needed to draw the image. */
    private const array KeptJpegApplicationSegments = [0xE0, 0xE2, 0xEE];

    private const int JpegComment = 0xFE;

    private const int JpegStartOfScan = 0xDA;

    /** @var array<int, string> */
    private const array DroppedPngChunks = ['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME'];

    private const string PngSignature = "\x89PNG\r\n\x1A\n";

    public static function strip(string $bytes, string $mime): ?string
    {
        return match ($mime) {
            'image/jpeg' => self::stripJpeg($bytes),
            'image/png' => self::stripPng($bytes),
            default => null,
        };
    }

    private static function stripJpeg(string $bytes): ?string
    {
        if (! str_starts_with($bytes, "\xFF\xD8")) {
            return null;
        }

        $clean = "\xFF\xD8";
        $offset = 2;
        $length = strlen($bytes);

        while ($offset + 4 <= $length) {
            if ($bytes[$offset] !== "\xFF") {
                return null;
            }

            $marker = ord($bytes[$offset + 1]);

            if ($marker === self::JpegStartOfScan) {
                return $clean.substr($bytes, $offset);
            }

            $segmentLength = unpack('n', substr($bytes, $offset + 2, 2))[1];
            $end = $offset + 2 + $segmentLength;

            if ($segmentLength < 2 || $end > $length) {
                return null;
            }

            if (! self::isDroppedJpegSegment($marker)) {
                $clean .= substr($bytes, $offset, $end - $offset);
            }

            $offset = $end;
        }

        return null;
    }

    private static function isDroppedJpegSegment(int $marker): bool
    {
        if ($marker === self::JpegComment) {
            return true;
        }

        if ($marker < 0xE0 || $marker > 0xEF) {
            return false;
        }

        return ! in_array($marker, self::KeptJpegApplicationSegments, true);
    }

    private static function stripPng(string $bytes): ?string
    {
        if (! str_starts_with($bytes, self::PngSignature)) {
            return null;
        }

        $clean = self::PngSignature;
        $offset = strlen(self::PngSignature);
        $length = strlen($bytes);

        while ($offset + 12 <= $length) {
            $chunkLength = unpack('N', substr($bytes, $offset, 4))[1];
            $type = substr($bytes, $offset + 4, 4);
            $end = $offset + 12 + $chunkLength;

            if ($end > $length) {
                return null;
            }

            if (! in_array($type, self::DroppedPngChunks, true)) {
                $clean .= substr($bytes, $offset, 12 + $chunkLength);
            }

            if ($type === 'IEND') {
                return $clean;
            }

            $offset = $end;
        }

        return null;
    }
}
```

- [ ] **Step 4: Run** — `bin/test-db pgsql -- tests/Unit/Support/Avatars` → PASS.
- [ ] **Step 5: Commit** — `feat(avatars): strip image metadata without an image library`.

### Task 10: Uploading, serving and showing a photo, behind the switch "Profile photos"

**Files:**
- Create: `app/Support/Avatars/AvatarPhotos.php`, `app/Exceptions/InvalidAvatarPhoto.php`, `app/Http/Requests/Settings/ProfilePhotoRequest.php`, `app/Http/Controllers/Settings/ProfilePhotosController.php`, `app/Http/Controllers/AvatarPhotosController.php`
- Modify: `app/Enums/InstanceSettingKey.php` (`ProfilePhotos`), `app/Support/InstanceSettings.php` (`DefaultProfilePhotos`, `profilePhotos()`, `storedProfilePhotos()`, `normalise()`, `all()` and its shape), `app/Http/Controllers/Admin/BrandingController.php` (`profilePhotos`, `defaults.profilePhotos`), `app/Http/Requests/Admin/BrandingUpdateRequest.php` (`profile_photos`), `app/Support/Avatars/AvatarUrl.php` (`for()` takes the photo), `app/Models/User.php` (`avatarUrl()`), `app/Concerns/HasGuestIdentity.php` (`avatarUrl()`), `app/Http/Controllers/Settings/ProfileController.php` (`destroy` deletes the file), `AccountSettingsController::profile()` (`hasPhoto`, `photosAllowed`), `routes/settings.php`, `routes/web.php`
- Test: `tests/Feature/Settings/ProfilePhotoTest.php`, `tests/Feature/Admin/BrandingSettingsTest.php` (add cases)

**Interfaces:**
- Consumes: `ImageMetadata::strip`, `pngBytes`, `jpegBytes` (Task 9).
- Produces: `InstanceSettingKey::ProfilePhotos = 'profile_photos'` (a Branding key: `InstanceSettingKey::branding()` lists it, so the Branding reset clears it); `InstanceSettings::DefaultProfilePhotos = false`, `profilePhotos(): bool`, `storedProfilePhotos(): ?bool`; Branding props `profilePhotos: ?bool`, `defaults.profilePhotos: bool`; Branding field `profile_photos` (`present`, nullable boolean); routes `profilePhotos.store` (POST `settings/profile/photo`, field `photo`), `profilePhotos.destroy` (DELETE `settings/profile/photo`, optional `initials` boolean), `avatarPhotos.show` (GET `avatar-photos/{file}`); `AvatarUrl::for(string $seed, Closure $memberStyle, Closure $name, ?Closure $photoPath = null): string`; profile props `hasPhoto: bool`, `photosAllowed: bool` (the switch), the existing `avatarMemberChoice` (decides "Use initials" or "Remove photo" in Task 11).

- [ ] **Step 1: Failing test**

```php
<?php

use App\Models\Retro;
use App\Models\User;
use App\Support\InstanceSettings;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Storage::fake('local');
    resolve(InstanceSettings::class)->set('profile_photos', true);
    resolve(InstanceSettings::class)->set('avatar_member_choice', true);
});

function photoUpload(string $bytes, string $name = 'me.jpg'): UploadedFile
{
    return UploadedFile::fake()->createWithContent($name, $bytes);
}

it('stores a photo without its metadata and shows it as the avatar', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->post(route('profilePhotos.store'), ['photo' => photoUpload(jpegBytes())])
        ->assertSessionHasNoErrors()
        ->assertRedirect(route('settings.edit'));

    $path = $user->fresh()->avatar_photo_path;

    expect($path)->toMatch('#^avatars/[a-z0-9]{40}\.jpg$#')
        ->and(Storage::disk('local')->get($path))->toBe(jpegBytes(withExif: false))
        ->and($user->fresh()->avatarUrl())->toBe(route('avatarPhotos.show', basename($path), absolute: false));
});

it('serves the photo, cached for good and inert', function () {
    $user = User::factory()->create();
    $this->actingAs($user)->post(route('profilePhotos.store'), ['photo' => photoUpload(pngBytes(), 'me.png')]);
    auth()->logout();

    $this->get($user->fresh()->avatarUrl())
        ->assertOk()
        ->assertHeader('Content-Type', 'image/png')
        ->assertHeader('Cache-Control', 'immutable, max-age=31536000, public')
        ->assertHeader('X-Content-Type-Options', 'nosniff');
});

it('shows the photo of a member in a retro', function () {
    $retro = Retro::factory()->create();
    [$user, $participant] = retroMember($retro);
    $this->actingAs($user)->post(route('profilePhotos.store'), ['photo' => photoUpload(jpegBytes())]);

    expect($participant->fresh()->avatarUrl())->toBe($user->fresh()->avatarUrl())
        ->and($participant->fresh()->avatarUrl())->toStartWith('/avatar-photos/');
});

it('refuses what is not a small JPEG or PNG', function (Closure $file) {
    $this->actingAs(User::factory()->create())
        ->post(route('profilePhotos.store'), ['photo' => $file()])
        ->assertSessionHasErrors('photo');
})->with([
    'gif' => [fn () => photoUpload("GIF89a\x01\0\x01\0\0\0\0;", 'me.gif')],
    'svg' => [fn () => photoUpload('<svg xmlns="http://www.w3.org/2000/svg"/>', 'me.svg')],
    'too heavy' => [fn () => UploadedFile::fake()->create('me.jpg', 1100, 'image/jpeg')],
    'unreadable jpeg' => [fn () => photoUpload("\xFF\xD8\xFF\xE0garbage", 'me.jpg')],
]);

it('replaces the previous photo and deletes its file', function () {
    $user = User::factory()->create();
    $this->actingAs($user)->post(route('profilePhotos.store'), ['photo' => photoUpload(jpegBytes())]);
    $first = $user->fresh()->avatar_photo_path;

    $this->post(route('profilePhotos.store'), ['photo' => photoUpload(pngBytes(), 'me.png')]);

    Storage::disk('local')->assertMissing($first);
    expect($user->fresh()->avatar_photo_path)->not->toBe($first);
});

it('goes back to initials and deletes the file', function () {
    $user = User::factory()->create();
    $this->actingAs($user)->post(route('profilePhotos.store'), ['photo' => photoUpload(jpegBytes())]);
    $path = $user->fresh()->avatar_photo_path;

    $this->delete(route('profilePhotos.destroy'), ['initials' => true])->assertRedirect(route('settings.edit'));

    Storage::disk('local')->assertMissing($path);
    expect($user->fresh()->avatar_photo_path)->toBeNull()
        ->and($user->fresh()->avatar_style)->toBe('initials');
});

it('neither offers nor shows photos while the switch "Profile photos" is off, and keeps the file', function () {
    $user = User::factory()->create();
    $this->actingAs($user)->post(route('profilePhotos.store'), ['photo' => photoUpload(jpegBytes())]);
    $path = $user->fresh()->avatar_photo_path;
    resolve(InstanceSettings::class)->set('profile_photos', false);

    expect($user->fresh()->avatarUrl())->not->toStartWith('/avatar-photos/');
    Storage::disk('local')->assertExists($path);
    $this->post(route('profilePhotos.store'), ['photo' => photoUpload(jpegBytes())])->assertForbidden();
    $this->get(route('settings.edit'))->assertInertia(fn (Assert $page) => $page
        ->where('profile.photosAllowed', false)
        ->where('profile.hasPhoto', false));
});

it('keeps "Profile photos" off on an instance that never set it', function () {
    resolve(InstanceSettings::class)->set('profile_photos', null);

    expect(resolve(InstanceSettings::class)->profilePhotos())->toBeFalse();
    $this->actingAs(User::factory()->create())
        ->post(route('profilePhotos.store'), ['photo' => photoUpload(jpegBytes())])
        ->assertForbidden();
});

it('shows a photo while members cannot choose their style, and removes it without touching the style', function () {
    $user = User::factory()->create(['avatar_style' => 'thumbs']);
    $this->actingAs($user)->post(route('profilePhotos.store'), ['photo' => photoUpload(jpegBytes())]);
    resolve(InstanceSettings::class)->set('avatar_member_choice', false);

    expect($user->fresh()->avatarUrl())->toStartWith('/avatar-photos/');

    $this->delete(route('profilePhotos.destroy'), ['initials' => true])->assertRedirect(route('settings.edit'));

    expect($user->fresh()->avatar_photo_path)->toBeNull()
        ->and($user->fresh()->avatar_style)->toBe('thumbs');
});

it('deletes the photo with the account', function () {
    $user = User::factory()->create();
    $this->actingAs($user)->post(route('profilePhotos.store'), ['photo' => photoUpload(jpegBytes())]);
    $path = $user->fresh()->avatar_photo_path;

    $this->delete(route('profile.destroy'), ['password' => 'password']);

    Storage::disk('local')->assertMissing($path);
});

it('answers 404 for a file that is not a stored photo', function (string $file) {
    $this->get("/avatar-photos/{$file}")->assertNotFound();
})->with([str_repeat('a', 40).'.jpg', '..%2F.env', 'x.jpg']);
```

Add to `tests/Feature/Admin/BrandingSettingsTest.php` (its helpers `brandingAdmin()`, `brandingPayload()` and `storedBrandingSettings()`; `brandingPayload()` gains `'profile_photos' => null`, a `present` field every existing case then sends; the case "shows no stored value and the effective defaults" gains `profilePhotos` null and `defaults.profilePhotos` false: list both edits in the report):

```php
it('turns profile photos on and off, and the reset turns them back off', function () {
    brandingAdmin($this);

    $this->put(route('admin.branding.update'), brandingPayload(['profile_photos' => true]))->assertSessionHasNoErrors();

    expect(storedBrandingSettings()->profilePhotos())->toBeTrue();

    $this->get(route('admin.branding.edit'))->assertInertia(fn (AssertableInertia $page) => $page
        ->where('profilePhotos', true)
        ->where('defaults.profilePhotos', false));

    $this->delete(route('admin.branding.destroy'));

    expect(storedBrandingSettings()->storedProfilePhotos())->toBeNull()
        ->and(storedBrandingSettings()->profilePhotos())->toBeFalse();
});

it('refuses a profile photos value that is not a boolean', function () {
    brandingAdmin($this);

    $this->put(route('admin.branding.update'), brandingPayload(['profile_photos' => 'sometimes']))->assertSessionHasErrors('profile_photos');
});
```

Read `ProfileDeleteRequest` for the factory password before running and adapt the literal.

- [ ] **Step 2: See it fail** — routes missing.
- [ ] **Step 3: Implementation**

`app/Exceptions/InvalidAvatarPhoto.php`:

```php
<?php

namespace App\Exceptions;

use Exception;

class InvalidAvatarPhoto extends Exception
{
    public static function unreadable(): self
    {
        return new self(__('This image could not be read. Choose a JPEG or PNG file.'));
    }
}
```

`app/Support/Avatars/AvatarPhotos.php`:

```php
<?php

namespace App\Support\Avatars;

use App\Exceptions\InvalidAvatarPhoto;
use App\Models\User;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Photos are stored under a random name that changes with every upload, so
 * an address can be cached for good and says nothing about its owner.
 */
class AvatarPhotos
{
    public const string Disk = 'local';

    public const string Directory = 'avatars';

    public const string FilePattern = '[a-z0-9]{40}\.(jpg|png)';

    /** @var array<string, string> */
    private const array Extensions = ['image/jpeg' => 'jpg', 'image/png' => 'png'];

    /** @var array<string, string> */
    private const array MimeTypes = ['jpg' => 'image/jpeg', 'png' => 'image/png'];

    /**
     * @throws InvalidAvatarPhoto
     */
    public function store(User $user, UploadedFile $file): void
    {
        $mime = (string) $file->getMimeType();
        $extension = self::Extensions[$mime] ?? throw InvalidAvatarPhoto::unreadable();
        $clean = ImageMetadata::strip((string) $file->get(), $mime) ?? throw InvalidAvatarPhoto::unreadable();
        $path = self::Directory.'/'.Str::lower(Str::random(40)).".{$extension}";

        throw_if($this->disk()->put($path, $clean) === false, RuntimeException::class, 'The avatar photo could not be written.');

        $previous = $user->avatar_photo_path;

        $user->forceFill(['avatar_photo_path' => $path])->save();

        $this->delete($previous);
    }

    public function delete(?string $path): void
    {
        if ($path === null || preg_match('#^'.self::Directory.'/'.self::FilePattern.'$#D', $path) !== 1) {
            return;
        }

        $this->disk()->delete($path);
    }

    /**
     * @return array{
     *     contents: string,
     *     mime: string
     * }|null
     */
    public function read(string $file): ?array
    {
        if (preg_match('#^'.self::FilePattern.'$#D', $file) !== 1) {
            return null;
        }

        $contents = $this->disk()->get(self::Directory."/{$file}");

        if ($contents === null) {
            return null;
        }

        return ['contents' => $contents, 'mime' => self::MimeTypes[Str::afterLast($file, '.')]];
    }

    public function url(string $path): string
    {
        return route('avatarPhotos.show', basename($path), absolute: false);
    }

    private function disk(): Filesystem
    {
        return Storage::disk(self::Disk);
    }
}
```

The switch. `InstanceSettingKey`: `case ProfilePhotos = 'profile_photos';` (after `AvatarMemberChoice`; `branding()` then lists it without change). `InstanceSettings`: `public const bool DefaultProfilePhotos = false;`, then

```php
    public function profilePhotos(): bool
    {
        return $this->storedProfilePhotos() ?? self::DefaultProfilePhotos;
    }

    public function storedProfilePhotos(): ?bool
    {
        return $this->storedBool(InstanceSettingKey::ProfilePhotos);
    }
```

`normalise()` adds `InstanceSettingKey::ProfilePhotos` to the boolean arm; `all()` adds `InstanceSettingKey::ProfilePhotos->value => $this->profilePhotos(),` and its docblock shape `profile_photos: bool`. `BrandingUpdateRequest::rules()` adds `'profile_photos' => ['present', 'nullable', 'boolean'],` and `settings()` adds `InstanceSettingKey::ProfilePhotos->value => $this->nullableBoolean('profile_photos'),`. `BrandingController::edit()` adds `'profilePhotos' => $settings->storedProfilePhotos(),` and, in `defaults`, `'profilePhotos' => InstanceSettings::DefaultProfilePhotos,`.

`ProfilePhotoRequest::rules()`: `'photo' => ['required', 'file', 'max:1024', 'mimetypes:image/jpeg,image/png', 'dimensions:max_width=4096,max_height=4096']`; `authorize()`: `resolve(InstanceSettings::class)->profilePhotos()` (403 otherwise).

`ProfilePhotosController`:

```php
    public function store(ProfilePhotoRequest $request, AvatarPhotos $photos): RedirectResponse
    {
        try {
            $photos->store($request->user(), $request->file('photo'));
        } catch (InvalidAvatarPhoto $exception) {
            throw ValidationException::withMessages(['photo' => $exception->getMessage()]);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Photo updated.')]);

        return to_route('settings.edit');
    }

    public function destroy(Request $request, AvatarPhotos $photos, InstanceSettings $settings): RedirectResponse
    {
        $user = $request->user();
        $path = $user->avatar_photo_path;
        $useInitials = $request->boolean('initials') && $settings->avatarMemberChoice();

        $user->forceFill([
            'avatar_photo_path' => null,
            ...($useInitials ? ['avatar_style' => AvatarStyleCatalogue::Initials] : []),
        ])->save();

        $photos->delete($path);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Photo removed.')]);

        return to_route('settings.edit');
    }
```

`AvatarPhotosController::show(AvatarPhotos $photos, string $file): Response` — 404 when `read()` is null; otherwise `response($file['contents'], 200, ['Content-Type' => $file['mime'], 'Cache-Control' => AvatarsController::CacheControl, 'X-Content-Type-Options' => 'nosniff', 'Content-Security-Policy' => InertImage::ContentSecurityPolicy])`.

`AvatarUrl`: inject `private AvatarPhotos $photos` in the constructor; `for()` gains `?Closure $photoPath = null` and starts with

```php
        if ($photoPath !== null && $this->settings->profilePhotos()) {
            $path = $photoPath();

            if (is_string($path)) {
                return $this->photos->url($path);
            }
        }
```

`User::avatarUrl()` passes `fn (): ?string => $this->avatar_photo_path`; `HasGuestIdentity::avatarUrl()` passes `fn (): ?string => $this->avatarOwner()?->avatar_photo_path`. `ProfileController::destroy`: read `$path = $user->avatar_photo_path` before the transaction, call `resolve(AvatarPhotos::class)->delete($path)` after it. Routes: in `routes/settings.php` (`auth` group, beside `profile.update`) `Route::post('settings/profile/photo', [ProfilePhotosController::class, 'store'])->middleware('throttle:10,1')->name('profilePhotos.store');` and `Route::delete('settings/profile/photo', [ProfilePhotosController::class, 'destroy'])->name('profilePhotos.destroy');`; in `routes/web.php` beside the avatar routes `Route::get('avatar-photos/{file}', [AvatarPhotosController::class, 'show'])->where('file', AvatarPhotos::FilePattern)->name('avatarPhotos.show');`. `AccountSettingsController::profile()`: `$photosAllowed = $this->settings->profilePhotos();` then `'hasPhoto' => $photosAllowed && $user->avatar_photo_path !== null, 'photosAllowed' => $photosAllowed,` (the existing `avatarMemberChoice` key stays and tells Task 11 which button to show). `ProfilePhotosController::destroy` keeps `$useInitials = $request->boolean('initials') && $settings->avatarMemberChoice()`: without the style choice it only removes the photo.

- [ ] **Step 4: PostgreSQL** — `bin/test-db pgsql -- tests/Feature/Settings tests/Feature/Admin tests/Feature/Avatars` (or the folder of the avatar tests) → PASS (a test asserting the exact keys of `InstanceSettings::all()` or of the Branding props gains `profile_photos` / `profilePhotos`: list it).
- [ ] **Step 5: Commit** — `feat(settings): profile photo behind the admin switch, stored without metadata and shown as the avatar`.

### Task 11: The photo block of the profile, and the Branding switch

**Mockup:** `ScreenUserSettings` a, Profile ("Upload photo", "Use initials"). Deviations P26-13, P26-15. The Branding page has no mockup element for the switch: it copies the neighbouring "Members can choose their own style" switch.

**Files:**
- Create: `resources/js/lib/settings/square-crop.ts` (+ test), `resources/js/components/settings/profile-photo.tsx` (+ test)
- Modify: `settings/account-settings.tsx` (mount in `ProfileCard`'s `photo` place), the profile prop type (`hasPhoto`, `photosAllowed`); `components/admin/branding/branding.ts` (+ `branding.test.ts`: the prop `profilePhotos`, `defaults.profilePhotos`, the form field `profile_photos`, `storable()` sends null when it equals the default), `components/admin/branding/avatar-style-grid.tsx` (+ test: the switch), `components/admin/branding/branding-form.tsx` (passes the field), `components/admin/branding/samples.ts` (the sample props gain `profilePhotos`)

**Interfaces:**

```ts
export const PhotoSize = 512;
export function squareCrop(width: number, height: number): { sx: number; sy: number; size: number }; // the centred square
export async function toSquareJpeg(file: File, size?: number): Promise<File>; // canvas draw + toBlob('image/jpeg', 0.85); resolves the original file when the canvas cannot encode
```

- [ ] **Step 1: `square-crop.ts`, test first**: `squareCrop(800, 600)` → `{ sx: 100, sy: 0, size: 600 }`; `squareCrop(600, 800)` → `{ sx: 0, sy: 100, size: 600 }`; `squareCrop(512, 512)` → `{ sx: 0, sy: 0, size: 512 }`. `toSquareJpeg` is tested with a mocked `createImageBitmap` and canvas (`getContext('2d').drawImage` receives the crop; the result is named `photo.jpg` with type `image/jpeg`; a canvas whose `toBlob` yields null resolves the original file).
- [ ] **Step 2: `ProfilePhoto`**: a hidden `input type="file" accept="image/jpeg,image/png"`, the outline button "Upload photo" (icon `upload`) that opens it, then `toSquareJpeg`, then `router.post(ProfilePhotosController.store.url(), { photo }, { forceFormData: true, preserveScroll: true })`; "Use initials" (ghost, icon `case-sensitive`) calls `router.delete(ProfilePhotosController.destroy.url(), { data: { initials: true }, preserveScroll: true })`, shown when `hasPhoto` or when the style is not already initials — this while `avatarMemberChoice` is true; while it is false the same ghost button reads "Remove photo" (icon `image-off`), sends no `initials`, and shows only when `hasPhoto` (P26-13); busy state on the button in flight; `errors.photo` under the buttons (`role="alert"`); nothing at all when `photosAllowed` is false. Vitest for each state, including "Remove photo" with the style choice off.
- [ ] **Step 3: The Branding switch.** In `avatar-style-grid.tsx`, under "Members can choose their own style", a `Switch` "Profile photos" with the help "Members can upload a photo that replaces their generated avatar. Photos are public, like avatars." (`allowProfilePhotos` / `onAllowProfilePhotosChange` props, as the member-choice pair); `branding-form.tsx` binds it to `data.profile_photos`; `branding.ts` reads `props.profilePhotos ?? props.defaults.profilePhotos` and stores with `storable()` like `avatar_member_choice`. Vitest: the switch shows the stored or default value; toggling it changes the field; the payload sends `null` when it equals the default.
- [ ] **Step 4: Gates** — `npm run test -- square-crop profile-photo profile-card branding avatar-style-grid`, types, check, build.
- [ ] **Step 5: Commit** — `feat(settings): upload a photo or go back to a generated avatar; the admin switch "Profile photos"`.

---

## Lane Security (AC-6, AC-2, AC-3)

### Task 12: The breach check — switch, timeout, and the range endpoint

**Files:**
- Create: `app/Support/Auth/PasswordRule.php`, `app/Http/Controllers/Settings/PasswordBreachRangesController.php`
- Modify: `config/skrum.php`, `app/Providers/AppServiceProvider.php`, `routes/settings.php`, `app/Support/Settings/SecuritySettings.php` (`offered()` gains `liveBreachCheck: bool`), `.env.example` (one commented line)
- Test: `tests/Unit/Support/Auth/PasswordRuleTest.php`, `tests/Feature/Settings/PasswordBreachRangeTest.php`

**Interfaces:**
- Produces: `PasswordRule::defaults(bool $production, bool $breachCheck): ?Password`; config `skrum.passwords.breach_check` (bool), `skrum.passwords.breach_check_timeout` (int seconds); route `passwordBreachRanges.store` → `{ suffixes: string[] }` (35 upper-case hex characters each), 404 when the check is off, 503 `{ available: false }` when the range cannot be fetched; `security.liveBreachCheck`.

- [ ] **Step 1: Failing tests**

```php
<?php

use App\Support\Auth\PasswordRule;

it('checks breaches in production when the switch is on', function () {
    expect(PasswordRule::defaults(production: true, breachCheck: true)->appliedRules()['uncompromised'])->toBeTrue()
        ->and(PasswordRule::defaults(production: true, breachCheck: false)->appliedRules()['uncompromised'])->toBeFalse()
        ->and(PasswordRule::defaults(production: true, breachCheck: false)->appliedRules()['min'])->toBe(12)
        ->and(PasswordRule::defaults(production: false, breachCheck: true))->toBeNull();
});
```

```php
<?php

use App\Models\User;
use Illuminate\Contracts\Validation\UncompromisedVerifier;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\Rules\Password;

beforeEach(fn () => Password::defaults(fn (): Password => Password::min(12)->uncompromised()));

it('returns the suffixes of a range that appear in breaches', function () {
    Http::fake(['api.pwnedpasswords.com/range/21BD1' => Http::response("0018A45C4D1DEF81644B54AB7F969B88D65:10\r\n00D4F6E8FA6EECAD2A3AA415EEC418D38EC:0\r\n011053FD0102E94D6AE2F8B83D76FAF94F6:3")]);

    $this->actingAs(User::factory()->create())
        ->postJson(route('passwordBreachRanges.store'), ['prefix' => '21bd1'])
        ->assertOk()
        ->assertExactJson(['suffixes' => ['0018A45C4D1DEF81644B54AB7F969B88D65', '011053FD0102E94D6AE2F8B83D76FAF94F6']]);

    Http::assertSent(fn ($request) => $request->hasHeader('Add-Padding', 'true'));
});

it('asks the range once a day', function () {
    Http::fake(['*' => Http::response('0018A45C4D1DEF81644B54AB7F969B88D65:1')]);
    $user = User::factory()->create();

    $this->actingAs($user)->postJson(route('passwordBreachRanges.store'), ['prefix' => '21BD1'])->assertOk();
    $this->actingAs($user)->postJson(route('passwordBreachRanges.store'), ['prefix' => '21BD1'])->assertOk();

    Http::assertSentCount(1);
});

it('answers 503 and caches nothing when the range cannot be fetched', function () {
    Http::fake(['*' => Http::response('', 500)]);

    $this->actingAs(User::factory()->create())
        ->postJson(route('passwordBreachRanges.store'), ['prefix' => '21BD1'])
        ->assertStatus(503)
        ->assertExactJson(['available' => false]);

    expect(Cache::has('password-breach-range:21BD1'))->toBeFalse();
});

it('answers 404 when the rule does not check breaches', function () {
    Password::defaults(fn (): Password => Password::min(12));
    Http::fake();

    $this->actingAs(User::factory()->create())->postJson(route('passwordBreachRanges.store'), ['prefix' => '21BD1'])->assertNotFound();

    Http::assertNothingSent();
});

it('refuses anything but five hex characters, and visitors', function (string $prefix) {
    $this->actingAs(User::factory()->create())->postJson(route('passwordBreachRanges.store'), ['prefix' => $prefix])->assertJsonValidationErrors('prefix');
})->with(['21BD', '21BD1F', 'ZZZZZ', '21BD1:']);

it('refuses a visitor', function () {
    $this->postJson(route('passwordBreachRanges.store'), ['prefix' => '21BD1'])->assertUnauthorized();
});

it('gives the verifier the configured timeout', function () {
    config(['skrum.passwords.breach_check_timeout' => 3]);
    app()->forgetInstance(UncompromisedVerifier::class);

    $timeout = (fn (): int => $this->timeout)->call(resolve(UncompromisedVerifier::class));

    expect($timeout)->toBe(3);
});

it('tells the security section whether the live check runs', function () {
    expect(resolve(App\Support\Settings\SecuritySettings::class)->offered()['liveBreachCheck'])->toBeTrue();

    Password::defaults(fn (): Password => Password::min(12));

    expect(resolve(App\Support\Settings\SecuritySettings::class)->offered()['liveBreachCheck'])->toBeFalse();
});
```

- [ ] **Step 2: See them fail.**
- [ ] **Step 3: Implementation**

`config/skrum.php`:

```php
    'passwords' => [
        'breach_check' => (bool) env('SKRUM_PASSWORD_BREACH_CHECK', true),
        'breach_check_timeout' => (int) env('SKRUM_PASSWORD_BREACH_CHECK_TIMEOUT', 5),
    ],
```

`app/Support/Auth/PasswordRule.php`:

```php
<?php

namespace App\Support\Auth;

use Illuminate\Validation\Rules\Password;

class PasswordRule
{
    /**
     * Outside production the framework's default applies. The breach check
     * calls an outside service: an instance without outbound access turns
     * it off rather than waiting on every password change.
     */
    public static function defaults(bool $production, bool $breachCheck): ?Password
    {
        if (! $production) {
            return null;
        }

        $rule = Password::min(12)->mixedCase()->letters()->numbers()->symbols();

        if (! $breachCheck) {
            return $rule;
        }

        return $rule->uncompromised();
    }
}
```

`AppServiceProvider::configureDefaults()`: `Password::defaults(fn (): ?Password => PasswordRule::defaults(app()->isProduction(), (bool) config('skrum.passwords.breach_check')));`. `AppServiceProvider::register()`: the framework binds the verifier in a deferred provider, which would replace a plain binding; extend it instead —

```php
        $this->app->extend(UncompromisedVerifier::class, fn (UncompromisedVerifier $verifier, Application $app): UncompromisedVerifier => new NotPwnedVerifier(
            $app->make(HttpFactory::class),
            (int) config('skrum.passwords.breach_check_timeout'),
        ));
```

`PasswordBreachRangesController`:

```php
<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class PasswordBreachRangesController extends Controller
{
    public const int CacheSeconds = 86400;

    private const string RangeUrl = 'https://api.pwnedpasswords.com/range/';

    /**
     * k-anonymity: the browser sends five characters of the password's SHA-1
     * and compares the answer itself; neither the password nor its hash
     * reaches the instance.
     */
    public function store(Request $request): JsonResponse
    {
        abort_unless(Password::defaults()->appliedRules()['uncompromised'], 404);

        /** @var array{prefix: string} $validated */
        $validated = $request->validate([
            'prefix' => ['required', 'string', 'regex:/^[0-9A-Fa-f]{5}$/D'],
        ]);

        $prefix = Str::upper($validated['prefix']);
        $key = "password-breach-range:{$prefix}";
        $suffixes = Cache::get($key);

        if (is_array($suffixes)) {
            return response()->json(['suffixes' => $suffixes]);
        }

        $suffixes = $this->fetch($prefix);

        if ($suffixes === null) {
            return response()->json(['available' => false], 503);
        }

        Cache::put($key, $suffixes, self::CacheSeconds);

        return response()->json(['suffixes' => $suffixes]);
    }

    /**
     * @return array<int, string>|null
     */
    private function fetch(string $prefix): ?array
    {
        try {
            $response = Http::withHeaders(['Add-Padding' => 'true'])
                ->timeout((int) config('skrum.passwords.breach_check_timeout'))
                ->get(self::RangeUrl.$prefix);
        } catch (ConnectionException $exception) {
            report($exception);

            return null;
        }

        if (! $response->successful()) {
            return null;
        }

        return Str::of($response->body())->trim()->explode("\n")
            ->map(fn (string $line): array => explode(':', trim($line)))
            ->filter(fn (array $parts): bool => count($parts) === 2 && (int) $parts[1] > 0)
            ->map(fn (array $parts): string => Str::upper($parts[0]))
            ->values()
            ->all();
    }
}
```

Route in `routes/settings.php` (`auth`, `verified` group): `Route::post('settings/password/breach-range', [PasswordBreachRangesController::class, 'store'])->middleware('throttle:30,1')->name('passwordBreachRanges.store');`. `SecuritySettings::offered()` adds `'liveBreachCheck' => Password::defaults()->appliedRules()['uncompromised'],` (docblock shape too). `.env.example`: `# SKRUM_PASSWORD_BREACH_CHECK=false   # an instance without outbound access`.

- [ ] **Step 4: PostgreSQL** — `bin/test-db pgsql -- tests/Unit/Support/Auth tests/Feature/Settings` → PASS (`AccountSettingsPageTest`'s list of `offered()` keys gains `liveBreachCheck`: list it).
- [ ] **Step 5: Commit** — `feat(security): breach check by k-anonymity, with a switch and a short timeout`.

### Task 13: Known passwords, the ways in, setting a password, and rule S-1

**Read spec §5.12 first.** Rule S-1 is the owner's accepted risk (decision 4): an account without a known password is asked no confirmation in the account settings. This task builds it and the tests that hold it. Do not add a confirmation back, and do not narrow the rule, even if a reviewer or a security habit says so; report a concern instead.

**Files:**
- Create: `database/migrations/2026_10_26_100200_fill_password_set_at_on_users.php`, `app/Support/Auth/SignInMethods.php`, `app/Http/Middleware/RequirePasswordUnlessNoneKnown.php`
- Modify: `app/Actions/Fortify/CreateNewUser.php`, `ResetUserPassword.php`, `app/Http/Controllers/Settings/SecurityController.php`, `app/Http/Requests/Settings/PasswordUpdateRequest.php`, `app/Support/Settings/SecuritySettings.php` (`protected()` gains `password`), `app/Support/Auth/PasswordConfirmation.php` (`isNotNeeded`, `isSatisfied`), `app/Http/Controllers/Settings/AccountSettingsController.php` (reads `isSatisfied`; `profile.needsPasswordConfirmation`), `bootstrap/app.php` (the `password.confirm` alias), `routes/settings.php` (every `RequirePassword::class` becomes `RequirePasswordUnlessNoneKnown::class`)
- Test: `tests/Upgrade/PasswordSetAtBackfillTest.php`, `tests/Unit/Support/Auth/SignInMethodsTest.php` (feature-style, it needs the database: place it in `tests/Feature/Auth/SignInMethodsTest.php`), `tests/Feature/Settings/SetPasswordTest.php`, `tests/Feature/Settings/PasswordConfirmationGuardTest.php` (the S-1 cases, and three existing cases changed by decision 4: see Step 1)

**Interfaces:**
- Produces: `SignInMethods::remaining(User $user, ?SocialAccount $without = null): array<int, string>` (values `sso:<provider>`, `password`, `magic_link`, `passkey`); `SignInMethods::isManagedByAdmin(SocialAccount $account): bool`; `security.protected.password: { isSet: bool, allowed: bool }`; the password update without `current_password` and without confirmation when `password_set_at` is null; `PasswordConfirmation::isNotNeeded(?User $user): bool`, `PasswordConfirmation::isSatisfied(Request $request): bool`; middleware `RequirePasswordUnlessNoneKnown` (also behind the alias `password.confirm`); profile prop `needsPasswordConfirmation: bool` (read by the gate in Task 17).

- [ ] **Step 1: Failing tests**

`tests/Upgrade/PasswordSetAtBackfillTest.php` (the pattern of `GamePointsWeekStartBackfillTest`):

```php
<?php

use App\Support\Database\SearchText;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

it('marks the passwords people chose, and not the ones single sign-on made', function () {
    $migration = '2026_10_26_100200_fill_password_set_at_on_users.php';
    $earlier = collect(glob(database_path('migrations/*.php')))
        ->filter(fn (string $path): bool => basename($path) < $migration)
        ->values()
        ->all();

    Artisan::call('migrate:fresh', ['--path' => $earlier, '--realpath' => true]);

    $user = function (string $name, string $createdAt): string {
        $id = (string) Str::uuid7();
        $email = Str::lower($name).'@example.test';

        DB::table('users')->insert([
            'id' => $id, 'name' => $name, 'name_search' => SearchText::fold($name),
            'email' => $email, 'email_key' => $email, 'password' => bcrypt('secret'),
            'created_at' => $createdAt, 'updated_at' => $createdAt,
        ]);

        return $id;
    };
    $link = fn (string $userId, string $createdAt) => DB::table('social_accounts')->insert([
        'id' => (string) Str::uuid7(), 'user_id' => $userId, 'provider' => 'google',
        'provider_user_id' => Str::random(12), 'created_at' => $createdAt, 'updated_at' => $createdAt,
    ]);

    $registered = $user('Ada', '2026-01-10 09:00:00');
    $bornBySso = $user('Lin', '2026-02-01 10:00:00');
    $link($bornBySso, '2026-02-01 10:00:00');
    $linkedLater = $user('Grace', '2026-03-01 08:00:00');
    $link($linkedLater, '2026-05-20 12:00:00');

    Artisan::call('migrate', ['--path' => [database_path("migrations/{$migration}")], '--realpath' => true]);
    Artisan::call('migrate', ['--path' => [database_path("migrations/{$migration}")], '--realpath' => true]);

    $stored = DB::table('users')->pluck('password_set_at', 'id')->map(fn (mixed $at): ?string => $at === null ? null : substr((string) $at, 0, 19));

    expect($stored->get($registered))->toBe('2026-01-10 09:00:00')
        ->and($stored->get($bornBySso))->toBeNull()
        ->and($stored->get($linkedLater))->toBe('2026-03-01 08:00:00');
});
```

(The second `migrate` call of the same path is a no-op for the migrator; to prove the re-run, also call the migration's `up()` directly: `(require database_path("migrations/{$migration}"))->up();` and assert the same three values.)

`tests/Feature/Auth/SignInMethodsTest.php`:

```php
<?php

use App\Models\SocialAccount;
use App\Models\User;
use App\Support\Auth\SignInMethods;
use App\Support\InstanceSettings;

beforeEach(fn () => config([
    'services.google.client_id' => 'g', 'services.google.client_secret' => 's',
    'services.github.client_id' => 'h', 'services.github.client_secret' => 't',
    'mail.default' => 'array',
]));

function ways(User $user, ?SocialAccount $without = null): array
{
    return resolve(SignInMethods::class)->remaining($user->fresh(), $without);
}

it('counts a known password, linked providers, a magic link and a passkey', function () {
    config(['mail.default' => 'smtp']);
    $user = User::factory()->create();
    $google = SocialAccount::factory()->for($user)->create(['provider' => 'google']);

    expect(ways($user))->toBe(['sso:google', 'password', 'magic_link'])
        ->and(ways($user, $google))->toBe(['password', 'magic_link']);
});

it('does not count a password nobody chose, nor a provider turned off', function () {
    $user = User::factory()->create(['password_set_at' => null]);
    SocialAccount::factory()->for($user)->create(['provider' => 'entra']);

    expect(ways($user))->toBe([]);
});

it('counts only single sign-on for a member while it is required', function () {
    config(['mail.default' => 'smtp']);
    resolve(InstanceSettings::class)->set('sso_required', true);
    $user = User::factory()->create();
    $google = SocialAccount::factory()->for($user)->create(['provider' => 'google']);

    expect(ways($user))->toBe(['sso:google'])
        ->and(ways($user, $google))->toBe([])
        ->and(resolve(SignInMethods::class)->isManagedByAdmin($google))->toBeTrue();
});

it('lets nothing be managed by the admin while single sign-on is optional', function () {
    $google = SocialAccount::factory()->for(User::factory()->create())->create(['provider' => 'google']);

    expect(resolve(SignInMethods::class)->isManagedByAdmin($google))->toBeFalse();
});
```

(A passkey case is added in the same file with the passkey factory or model the passkey tests use; read `tests/Feature/Auth` for it.)

`tests/Feature/Settings/SetPasswordTest.php`:

```php
<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;

it('lets an account without a known password set one with neither the current password nor a confirmation (rule S-1)', function () {
    $user = User::factory()->create(['password_set_at' => null]);

    $this->actingAs($user)
        ->put(route('user-password.update'), ['password' => 'A-new-pass-2026!', 'password_confirmation' => 'A-new-pass-2026!'])
        ->assertSessionHasNoErrors();

    expect(Hash::check('A-new-pass-2026!', $user->fresh()->password))->toBeTrue()
        ->and($user->fresh()->password_set_at)->not->toBeNull();
});

it('still asks a known password for the current one, and dates the change', function () {
    $user = User::factory()->create(['password_set_at' => now()->subYear()]);

    $this->actingAs($user)
        ->put(route('user-password.update'), ['password' => 'A-new-pass-2026!', 'password_confirmation' => 'A-new-pass-2026!'])
        ->assertSessionHasErrors('current_password');

    $this->put(route('user-password.update'), ['current_password' => 'password', 'password' => 'A-new-pass-2026!', 'password_confirmation' => 'A-new-pass-2026!'])
        ->assertSessionHasNoErrors();

    expect($user->fresh()->password_set_at->isToday())->toBeTrue();
});

it('dates a password chosen at registration', function () {
    config(['skrum.signup_mode' => 'open']);

    $this->post(route('register.store'), [
        'name' => 'Test User',
        'email' => 'test@example.com',
        'password' => 'password',
        'password_confirmation' => 'password',
    ])->assertSessionHasNoErrors();

    expect(User::query()->whereAddress('test@example.com')->sole()->password_set_at)->not->toBeNull();
});

it('dates a password chosen at reset', function () {
    $user = User::factory()->create(['password_set_at' => null]);
    $token = Illuminate\Support\Facades\Password::broker()->createToken($user);

    $this->post(route('password.update'), [
        'token' => $token,
        'email' => $user->email,
        'password' => 'password',
        'password_confirmation' => 'password',
    ])->assertSessionHasNoErrors();

    expect($user->fresh()->password_set_at)->not->toBeNull();
});

it('tells the security section whether the password is known and allowed', function () {
    config(['services.google.client_id' => 'g', 'services.google.client_secret' => 's']);
    $withoutPassword = User::factory()->create(['password_set_at' => null]);

    $this->actingAs($withoutPassword)->withSession(['auth.password_confirmed_at' => time()])->get(route('settings.edit'))
        ->assertInertia(fn (Inertia\Testing\AssertableInertia $page) => $page->where('security.protected.password', ['isSet' => false, 'allowed' => true]));

    resolve(App\Support\InstanceSettings::class)->set('sso_required', true);
    $member = User::factory()->create();

    $this->actingAs($member)->withSession(['auth.password_confirmed_at' => time()])->get(route('settings.edit'))
        ->assertInertia(fn (Inertia\Testing\AssertableInertia $page) => $page->where('security.protected.password', ['isSet' => true, 'allowed' => false]));
});
```

Plan 25 (a workspace and a team at sign-up) runs after this plan in the roadmap order, so the registration form is still today's when this task runs; plan 25 carries this test forward with its own fields. If the form on `roadmap` has changed anyway, add its new required fields to the payload and report it; the assertion stays.

`tests/Feature/Settings/PasswordConfirmationGuardTest.php` — the S-1 cases, added to the file so they use its helpers `guardedAccountActions()` and `accountAction()` (its `beforeEach` turns on two-factor, passkeys, MCP and mail). Test names carry the rule's number; no comment is added:

```php
function accountWithoutKnownPassword(): User
{
    $user = User::factory()->withTwoFactor()->create(['password' => Str::password(64), 'password_set_at' => null]);

    SocialAccount::factory()->for($user)->create();

    return $user;
}

it('lets an account without a known password through every confirmation of the account settings, the risk the owner accepted (rule S-1)', function (string $method, string $route, array $payload, bool $json) {
    $response = accountAction(accountWithoutKnownPassword(), $method, $route, $payload, json: $json);

    expect($response->getStatusCode())->not->toBe(423)
        ->and($response->headers->get('Location'))->not->toBe(route('password.confirm'));
})->with(guardedAccountActions())->with(['a page visit' => [false], 'a JSON request' => [true]]);

it('sends the protected sections to an account without a known password with no confirmation (rule S-1)', function () {
    $user = accountWithoutKnownPassword();

    $this->actingAs($user)->get(route('settings.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('profile.needsPasswordConfirmation', false)
            ->where('security.locked', false)
            ->whereNot('security.protected', null)
            ->where('apiTokens.locked', false)
            ->whereNot('apiTokens.protected', null));
});

it('lets an account without a known password read its recovery codes, create a token and turn two-factor off with no confirmation (rule S-1)', function () {
    $user = accountWithoutKnownPassword();

    $this->actingAs($user)->getJson(route('two-factor.recovery-codes'))->assertOk()->assertJson(['recovery-code-1']);

    $this->actingAs($user)->post(route('apiTokens.store'), ['name' => 'Laptop', 'expiration' => '90_days'])->assertSessionHasNoErrors();
    expect($user->tokens()->count())->toBe(1);

    $this->actingAs($user)->delete(route('two-factor.disable'))->assertRedirect();
    expect($user->fresh()->two_factor_secret)->toBeNull();
});

it('asks for the confirmation again once the account has set a password (rule S-1 ends with a known password)', function () {
    $user = accountWithoutKnownPassword();

    $this->actingAs($user)
        ->put(route('user-password.update'), ['password' => 'A-new-pass-2026!', 'password_confirmation' => 'A-new-pass-2026!'])
        ->assertSessionHasNoErrors();

    $this->actingAs($user->fresh())->getJson(route('two-factor.recovery-codes'))->assertStatus(423);
    $this->actingAs($user->fresh())->get(route('settings.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('profile.needsPasswordConfirmation', true)
            ->where('security.protected', null));
});

it('keeps the admin area and the deletion of the account behind the password for an account without one (rule S-1 stops at the account settings)', function () {
    $admin = User::factory()->instanceAdmin()->create(['password' => Str::password(64), 'password_set_at' => null]);

    $this->actingAs($admin)->get(route('admin.branding.edit'))->assertRedirect(route('password.confirm'));

    $this->actingAs($admin)->delete(route('profile.destroy'), ['password' => 'password'])->assertSessionHasErrors('password');
    expect($admin->fresh())->not->toBeNull();
});
```

Three existing cases of the same file change with decision 4 (none is deleted; list them in the report with this reason):
- `guardedAccounts()`: its two SSO fixtures (`Str::password(64)` and a social account) get `'password_set_at' => now()` explicitly, and their labels become "an SSO account that has set a password" and "… while SSO is required": after Task 1 the factory already dates the password, so they keep proving what they proved, and their names no longer claim an account "that only signs in through SSO" is refused, which S-1 makes false.
- "confirms a password only when it is the right one, so an account that knows none stays refused": the fixture gets `'password_set_at' => now()` and the name becomes "confirms a password only when it is the right one"; the assertions stay.
- "does not confirm an account that knows no password, whatever the dialog sends": the fixture gets `'password_set_at' => null`; the first half stays (the POST is refused, no confirmation is recorded); the second half flips to S-1 (`two-factor.recovery-codes` answers 200, `security.protected` and `apiTokens.protected` are sent). New name: "records no confirmation for an account that knows no password, which rule S-1 lets through anyway".

- [ ] **Step 2: See them fail.**
- [ ] **Step 3: Implementation**

Migration:

```php
<?php

use Carbon\CarbonImmutable;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Each chunk commits on its own; a run that stopped resumes on the rows still without a date.
     *
     * @var bool
     */
    public $withinTransaction = false;

    /** An account whose first link came with it was created by single sign-on, with a password nobody knows. */
    private const int SameMomentSeconds = 60;

    public function up(): void
    {
        DB::table('users')->whereNull('password_set_at')->select(['id', 'created_at'])->chunkById(500, function (Collection $users): void {
            $firstLinks = DB::table('social_accounts')
                ->whereIn('user_id', $users->pluck('id')->all())
                ->select(['user_id', 'created_at'])
                ->get()
                ->groupBy('user_id')
                ->map(fn (Collection $links): ?string => $links->pluck('created_at')->filter()->map(fn (mixed $at): string => (string) $at)->sort()->first());

            foreach ($users as $user) {
                $createdAt = $user->created_at === null ? CarbonImmutable::now('UTC') : CarbonImmutable::parse((string) $user->created_at, 'UTC');
                $firstLink = $firstLinks->get($user->id);

                if ($firstLink !== null && abs(CarbonImmutable::parse($firstLink, 'UTC')->diffInSeconds($createdAt)) <= self::SameMomentSeconds) {
                    continue;
                }

                DB::table('users')->where('id', $user->id)->update(['password_set_at' => $createdAt->toDateTimeString()]);
            }
        });
    }
};
```

`SignInMethods`:

```php
<?php

namespace App\Support\Auth;

use App\Enums\SsoProvider;
use App\Models\SocialAccount;
use App\Models\User;
use App\Support\Integrations\IntegrationAvailability;
use Laravel\Fortify\Features;

/**
 * What would still sign a user in, read against the instance's rules
 * (`SignInPolicy`): the answer to "may this way in be removed".
 */
class SignInMethods
{
    public function __construct(
        private SignInPolicy $policy,
        private IntegrationAvailability $availability,
    ) {}

    /**
     * @return array<int, string>
     */
    public function remaining(User $user, ?SocialAccount $without = null): array
    {
        $providers = $user->socialAccounts()
            ->when($without !== null, fn ($query) => $query->whereKeyNot($without->id))
            ->orderBy('provider')
            ->orderBy('id')
            ->pluck('provider')
            ->filter(fn (string $provider): bool => SsoProvider::tryFrom($provider)?->isEnabled() === true)
            ->unique()
            ->map(fn (string $provider): string => "sso:{$provider}")
            ->values()
            ->all();

        return array_values(array_filter([
            ...$providers,
            $user->password_set_at !== null && $this->policy->allowsPassword($user) ? 'password' : null,
            $this->allowsMagicLink($user) ? 'magic_link' : null,
            $this->allowsPasskey($user) ? 'passkey' : null,
        ]));
    }

    /**
     * While only single sign-on signs in, the identities it relies on belong to the admin's rule.
     */
    public function isManagedByAdmin(SocialAccount $account): bool
    {
        if (! $this->policy->ssoRequired()) {
            return false;
        }

        return SsoProvider::tryFrom($account->provider)?->isEnabled() === true;
    }

    private function allowsMagicLink(User $user): bool
    {
        if (! $this->policy->allowsLocalCredentials()) {
            return false;
        }

        if (! $this->availability->emailEnabled()) {
            return false;
        }

        return $user->hasVerifiedEmail();
    }

    private function allowsPasskey(User $user): bool
    {
        if (! $this->policy->allowsLocalCredentials()) {
            return false;
        }

        if (! Features::canManagePasskeys()) {
            return false;
        }

        return $user->passkeys()->exists();
    }
}
```

`PasswordUpdateRequest` (no `authorize()` change: rule S-1 sets a first password with no confirmation):

```php
    public function rules(): array
    {
        if ($this->user()->password_set_at === null) {
            return ['password' => $this->passwordRules()];
        }

        return [
            'current_password' => $this->currentPasswordRules(),
            'password' => $this->passwordRules(),
        ];
    }
```

`app/Support/Auth/PasswordConfirmation.php` gains:

```php
    /**
     * Rule S-1 of the plan 26 spec (§5.12), a risk the owner accepted on
     * 2026-10-03: an account whose owner knows no password (created by single
     * sign-on) is asked no confirmation in the account settings. Do not add one
     * back without the owner's word.
     */
    public function isNotNeeded(?User $user): bool
    {
        if ($user === null) {
            return false;
        }

        return $user->password_set_at === null;
    }

    public function isSatisfied(Request $request): bool
    {
        if ($this->isNotNeeded($request->user())) {
            return true;
        }

        return $this->isFresh($request);
    }
```

`app/Http/Middleware/RequirePasswordUnlessNoneKnown.php`:

```php
<?php

namespace App\Http\Middleware;

use App\Support\Auth\PasswordConfirmation;
use Illuminate\Auth\Middleware\RequirePassword;
use Illuminate\Http\Request;

/**
 * The framework's confirmation, except for an account whose owner knows no
 * password: rule S-1 of the plan 26 spec (§5.12), a risk the owner accepted.
 * Used by the account settings routes and, through the `password.confirm`
 * alias, by Fortify's two-factor and passkey routes. The admin area keeps the
 * framework's middleware.
 */
class RequirePasswordUnlessNoneKnown extends RequirePassword
{
    /**
     * @param  Request  $request
     * @param  int|null  $passwordTimeoutSeconds
     */
    protected function shouldConfirmPassword($request, $passwordTimeoutSeconds = null): bool
    {
        if (resolve(PasswordConfirmation::class)->isNotNeeded($request->user())) {
            return false;
        }

        return (bool) parent::shouldConfirmPassword($request, $passwordTimeoutSeconds);
    }
}
```

`bootstrap/app.php`, in `withMiddleware`: `$middleware->alias(['password.confirm' => RequirePasswordUnlessNoneKnown::class]);`. `routes/settings.php`: every `RequirePassword::class` becomes `RequirePasswordUnlessNoneKnown::class` and the import follows; `routes/admin.php` is not touched. `AccountSettingsController::edit()`: `$passwordConfirmed = $verified && $this->passwordConfirmation->isSatisfied($request);` (the rest unchanged, so the security and API-token props follow), and `profile()` adds `'needsPasswordConfirmation' => ! $this->passwordConfirmation->isNotNeeded($user),`. If the arch or PHPStan rules refuse the untyped parameters, keep them untyped (they must match the framework's signature) and add the narrowest ignore the project already uses for a framework override; report it.

`SecurityController::update`: `$request->user()->forceFill(['password' => $request->password, 'password_set_at' => now()])->save();` (the rest unchanged). `CreateNewUser`: after the user is created, `$user->forceFill(['password_set_at' => now()])->save();` (inside its transaction if it has one). `ResetUserPassword`: `$user->forceFill(['password' => $input['password'], 'password_set_at' => now()])->save();`. `SecuritySettings::protected()` adds `'password' => ['isSet' => $user->password_set_at !== null, 'allowed' => $this->policy->allowsPassword($user)]` (inject `SignInPolicy`; docblock shape).

- [ ] **Step 4: Run** — `bin/test-db pgsql -- tests/Upgrade/PasswordSetAtBackfillTest.php` (the other three engines run it in the roadmap's final matrix); `bin/test-db pgsql -- tests/Feature/Auth tests/Feature/Settings tests/Feature/Admin tests/Arch` → PASS. Every existing case of `PasswordConfirmationGuardTest` for an account with a known password passes unchanged (the alias still answers 423 / redirect for it).
- [ ] **Step 5: Commit** — `feat(security): know which passwords were chosen, what still signs a user in, set a password; no confirmation without a known password (accepted risk S-1)`. The commit body names spec §5.12 and the owner's answer of 2026-10-03.

### Task 14: Active sessions — read, sign out one, sign out the others

**Files:**
- Create: `app/Models/BrowserSession.php`, `app/Support/Settings/BrowserSessions.php`, `app/Http/Controllers/Settings/BrowserSessionsController.php`, `OtherBrowserSessionsController.php`
- Modify: `app/Support/Auth/UserAgentSummary.php` (`deviceKind()`), `app/Support/Settings/SecuritySettings.php` (`protected(User $user, string $currentSessionId)` gains `browserSessions`), `AccountSettingsController::securitySection()` (passes `$request->session()->getId()`), `routes/settings.php`
- Test: `tests/Unit/Support/Auth/UserAgentSummaryTest.php` (add cases), `tests/Feature/Settings/BrowserSessionsTest.php`

**Interfaces:**
- Produces: `UserAgentSummary::deviceKind(?string $userAgent): string` (`desktop` | `phone` | `unknown`); `BrowserSessions::available(): bool`, `of(User $user, string $currentId): array<int, array{key: string, device: string, deviceKind: string, ipAddress: ?string, isCurrent: bool, lastActiveAt: string}>`, `signOut(User $user, string $key, string $currentId): bool`, `signOutOthers(User $user, string $currentId): int`; routes `browserSessions.destroy` (DELETE `settings/sessions/{sessionKey}`), `otherBrowserSessions.destroy` (DELETE `settings/sessions`), both behind `RequirePasswordUnlessNoneKnown` (Task 13); prop `security.protected.browserSessions: array<int, row>|null` — **null when the driver is not `database`** (decision 2C: Task 18 then renders no card).

- [ ] **Step 1: Failing tests**

```php
<?php

use App\Models\BrowserSession;
use App\Models\User;
use App\Support\Settings\BrowserSessions;

const FirefoxOnMac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15.0; rv:131.0) Gecko/20100101 Firefox/131.0';
const SafariOnIphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

beforeEach(fn () => config(['session.driver' => 'database']));

function browserSession(User $user, string $id, string $agent, int $minutesAgo, ?string $address = '203.0.113.7'): BrowserSession
{
    return BrowserSession::query()->forceCreate([
        'id' => $id, 'user_id' => $user->id, 'ip_address' => $address,
        'user_agent' => $agent, 'payload' => '', 'last_activity' => now()->subMinutes($minutesAgo)->getTimestamp(),
    ]);
}

it('lists the sessions of the user, newest first, with browser and IP address and without ids', function () {
    $user = User::factory()->create();
    browserSession($user, 'current-session-id', FirefoxOnMac, 0);
    browserSession($user, 'phone-session-id', SafariOnIphone, 120, '2001:db8::7');
    browserSession(User::factory()->create(), 'someone-else', FirefoxOnMac, 1, '198.51.100.9');

    $rows = resolve(BrowserSessions::class)->of($user, 'current-session-id');

    expect($rows)->toHaveCount(2)
        ->and($rows[0])->toMatchArray(['device' => 'Firefox on macOS', 'deviceKind' => 'desktop', 'ipAddress' => '203.0.113.7', 'isCurrent' => true, 'key' => hash('sha256', 'current-session-id')])
        ->and($rows[1])->toMatchArray(['device' => 'Safari on iOS', 'deviceKind' => 'phone', 'ipAddress' => '2001:db8::7', 'isCurrent' => false])
        ->and(json_encode($rows))->not->toContain('phone-session-id')->not->toContain('198.51.100.9');
});

it('gives no address for a session stored without one', function () {
    $user = User::factory()->create();
    browserSession($user, 'current-session-id', FirefoxOnMac, 0, null);

    expect(resolve(BrowserSessions::class)->of($user, 'current-session-id')[0]['ipAddress'])->toBeNull();
});

it('signs out one session and forgets remembered devices', function () {
    $user = User::factory()->create(['remember_token' => 'old-token']);
    browserSession($user, 'current-session-id', FirefoxOnMac, 0);
    browserSession($user, 'phone-session-id', SafariOnIphone, 120);

    $done = resolve(BrowserSessions::class)->signOut($user, hash('sha256', 'phone-session-id'), 'current-session-id');

    expect($done)->toBeTrue()
        ->and(BrowserSession::query()->whereKey('phone-session-id')->exists())->toBeFalse()
        ->and(BrowserSession::query()->whereKey('current-session-id')->exists())->toBeTrue()
        ->and($user->fresh()->remember_token)->not->toBe('old-token');
});

it('never signs out the current session, nor another user\'s', function () {
    $user = User::factory()->create();
    browserSession($user, 'current-session-id', FirefoxOnMac, 0);
    browserSession(User::factory()->create(), 'someone-else', FirefoxOnMac, 1);
    $sessions = resolve(BrowserSessions::class);

    expect($sessions->signOut($user, hash('sha256', 'current-session-id'), 'current-session-id'))->toBeFalse()
        ->and($sessions->signOut($user, hash('sha256', 'someone-else'), 'current-session-id'))->toBeFalse()
        ->and(BrowserSession::query()->count())->toBe(2);
});

it('signs out every other session', function () {
    $user = User::factory()->create();
    browserSession($user, 'current-session-id', FirefoxOnMac, 0);
    browserSession($user, 'phone-session-id', SafariOnIphone, 120);
    browserSession($user, 'old-session-id', FirefoxOnMac, 3000);

    expect(resolve(BrowserSessions::class)->signOutOthers($user, 'current-session-id'))->toBe(2)
        ->and(BrowserSession::query()->where('user_id', $user->id)->pluck('id')->all())->toBe(['current-session-id']);
});

it('sends no session list at all with another driver, so the card is hidden', function () {
    config(['session.driver' => 'file']);

    expect(resolve(BrowserSessions::class)->available())->toBeFalse();

    $this->actingAs(User::factory()->create())->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('settings.edit'))
        ->assertInertia(fn (Inertia\Testing\AssertableInertia $page) => $page->where('security.protected.browserSessions', null));
});

it('signs out through the routes, behind a fresh confirmation', function () {
    $user = User::factory()->create();
    browserSession($user, 'phone-session-id', SafariOnIphone, 120);
    $key = hash('sha256', 'phone-session-id');

    $this->actingAs($user)->deleteJson(route('browserSessions.destroy', $key))->assertStatus(423);

    $this->withSession(['auth.password_confirmed_at' => time()])
        ->delete(route('browserSessions.destroy', $key))
        ->assertRedirect();

    expect(BrowserSession::query()->whereKey('phone-session-id')->exists())->toBeFalse();

    $this->delete(route('browserSessions.destroy', str_repeat('a', 64)))->assertNotFound();
    $this->delete(route('otherBrowserSessions.destroy'))->assertRedirect();
});

it('answers 404 on the routes with another driver', function () {
    config(['session.driver' => 'file']);

    $this->actingAs(User::factory()->create())->withSession(['auth.password_confirmed_at' => time()])
        ->delete(route('otherBrowserSessions.destroy'))->assertNotFound();
});
```

(`config(['session.driver' => 'database'])` set in a test changes what `available()` reads; the test requests themselves keep the array store the kernel started with, which is why the "current" case is proved on the support class with an explicit id. In the route test the request's own session is not in the table, so `delete` of another row is what is checked.) Add to `UserAgentSummaryTest`: `deviceKind(FirefoxOnMac)` is `desktop`, `deviceKind(SafariOnIphone)` is `phone`, an Android Chrome header is `phone`, `deviceKind('curl/8.0')` and `deviceKind(null)` are `unknown`.

- [ ] **Step 2: See them fail.**
- [ ] **Step 3: Implementation**

`UserAgentSummary`:

```php
    /** @var array<int, string> */
    private const array PhoneNeedles = ['iPhone', 'iPad', 'Android'];

    public static function deviceKind(?string $userAgent): string
    {
        if ($userAgent === null || self::firstLabel(self::Systems, $userAgent) === null) {
            return 'unknown';
        }

        foreach (self::PhoneNeedles as $needle) {
            if (str_contains($userAgent, $needle)) {
                return 'phone';
            }
        }

        return 'desktop';
    }
```

`app/Models/BrowserSession.php`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A row of the framework's `sessions` table, read for the security page.
 *
 * @property string $id
 * @property string|null $user_id
 * @property string|null $ip_address
 * @property string|null $user_agent
 * @property string $payload
 * @property int $last_activity
 */
class BrowserSession extends Model
{
    public $incrementing = false;

    public $timestamps = false;

    protected $table = 'sessions';

    protected $keyType = 'string';
}
```

`app/Support/Settings/BrowserSessions.php`:

```php
<?php

namespace App\Support\Settings;

use App\Models\BrowserSession;
use App\Models\User;
use App\Support\Auth\UserAgentSummary;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * The devices signed in to an account, with the browser and the IP address
 * the framework stored (the owner's choice: no location). A session id is a
 * secret: only its hash leaves the server. Signing a device out also changes
 * the remember token, so that its "Remember me" cookie cannot sign it back in.
 */
class BrowserSessions
{
    public const int Shown = 50;

    public function available(): bool
    {
        return config('session.driver') === 'database';
    }

    /**
     * @return array<int, array{
     *     key: string,
     *     device: string,
     *     deviceKind: string,
     *     ipAddress: ?string,
     *     isCurrent: bool,
     *     lastActiveAt: string
     * }>
     */
    public function of(User $user, string $currentId): array
    {
        if (! $this->available()) {
            return [];
        }

        return BrowserSession::query()
            ->where('user_id', $user->id)
            ->orderByDesc('last_activity')
            ->orderBy('id')
            ->limit(self::Shown)
            ->get(['id', 'ip_address', 'user_agent', 'last_activity'])
            ->map(fn (BrowserSession $session): array => [
                'key' => hash('sha256', $session->id),
                'device' => UserAgentSummary::describe($session->user_agent) ?? __('Unknown device'),
                'deviceKind' => UserAgentSummary::deviceKind($session->user_agent),
                'ipAddress' => $session->ip_address,
                'isCurrent' => hash_equals($currentId, $session->id),
                'lastActiveAt' => Carbon::createFromTimestamp($session->last_activity)->toIso8601String(),
            ])
            ->values()
            ->all();
    }

    public function signOut(User $user, string $key, string $currentId): bool
    {
        if (! $this->available()) {
            return false;
        }

        return DB::transaction(function () use ($user, $key, $currentId): bool {
            $locked = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
            $target = BrowserSession::query()
                ->where('user_id', $locked->id)
                ->get(['id'])
                ->first(fn (BrowserSession $session): bool => hash_equals(hash('sha256', $session->id), $key));

            if ($target === null || hash_equals($currentId, $target->id)) {
                return false;
            }

            BrowserSession::query()->whereKey($target->id)->delete();
            $this->forgetRememberedDevices($locked);

            return true;
        });
    }

    public function signOutOthers(User $user, string $currentId): int
    {
        if (! $this->available()) {
            return 0;
        }

        return DB::transaction(function () use ($user, $currentId): int {
            $locked = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
            $count = BrowserSession::query()->where('user_id', $locked->id)->whereKeyNot($currentId)->delete();

            $this->forgetRememberedDevices($locked);

            return $count;
        });
    }

    private function forgetRememberedDevices(User $user): void
    {
        $user->setRememberToken(Str::random(60));
        $user->save();
    }
}
```

Controllers: `BrowserSessionsController::destroy(Request $request, string $sessionKey, BrowserSessions $sessions)` — `abort_unless($sessions->available(), 404); abort_unless($sessions->signOut($request->user(), $sessionKey, $request->session()->getId()), 404);` toast "Device signed out.", `back()`. `OtherBrowserSessionsController::destroy` — 404 when not available; toast "Other sessions signed out."; `back()`. Routes in `routes/settings.php` (`auth`, `verified`): `Route::delete('settings/sessions/{sessionKey}', …)->where('sessionKey', '[0-9a-f]{64}')->middleware(RequirePasswordUnlessNoneKnown::class)->name('browserSessions.destroy');` and `Route::delete('settings/sessions', …)->middleware(RequirePasswordUnlessNoneKnown::class)->name('otherBrowserSessions.destroy');`. `SecuritySettings::protected()` gains `'browserSessions' => $this->sessions->available() ? $this->sessions->of($user, $currentSessionId) : null` (docblock shape: the row list or null).

- [ ] **Step 4: PostgreSQL** — `bin/test-db pgsql -- tests/Unit/Support/Auth tests/Feature/Settings` → PASS.
- [ ] **Step 5: Commit** — `feat(security): active sessions, sign one out or all the others`.

### Task 15: Linking an identity from the one callback

Decision 4 (no confirmation for an account without a known password, rule S-1) removes the "Confirm with <provider>" round trip the draft had here: no confirm intent, no `SsoConfirmationsController`, no `ssoConfirmations` prop, no change to the confirm-password view.

**Files:**
- Create: `app/Support/Auth/SsoIntent.php`, `app/Actions/Auth/LinkSocialAccount.php`, `app/Exceptions/SocialAccountRefused.php`, `app/Http/Controllers/Settings/LinkedAccountsController.php` (`create`)
- Modify: `app/Http/Controllers/SsoCallbacksController.php`, `routes/web.php` (the callback line leaves the `guest` group), `routes/settings.php`
- Test: `tests/Feature/Auth/LinkSocialAccountTest.php`, `tests/Concurrency/SocialAccountLinkTest.php`

**Interfaces:**
- Consumes: `SsoProvider`, `SsoLoginRefused::providerFailed`, `RequirePasswordUnlessNoneKnown` (Task 13).
- Produces: `SsoIntent::Key = 'sso.intent'`, `SsoIntent::Link`, `SsoIntent::put(Request $request, User $user, SsoProvider $provider): void`, `SsoIntent::pull(Request $request): ?array{type: string, user: string, provider: string}`; `LinkSocialAccount::handle(User $user, SsoProvider $provider, string $providerUserId): void` throwing `SocialAccountRefused`; route `linkedAccounts.create` (GET `settings/linked-accounts/{provider}`).

- [ ] **Step 1: Failing tests**

`tests/Feature/Auth/LinkSocialAccountTest.php`:

```php
<?php

use App\Models\SocialAccount;
use App\Models\User;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;

beforeEach(fn () => config(['services.google.client_id' => 'g', 'services.google.client_secret' => 's']));

function providerReturns(string $id, string $email = 'ada@example.test'): void
{
    Socialite::fake('google', SocialiteUser::fake(['id' => $id, 'email' => $email, 'name' => 'Ada']));
}

it('sends a confirmed user to the provider with a link intent', function () {
    providerReturns('google-1');
    $user = User::factory()->create();

    $this->actingAs($user)->withSession(['auth.password_confirmed_at' => time()])
        ->get(route('linkedAccounts.create', 'google'))
        ->assertRedirect()
        ->assertSessionHas('sso.intent', ['type' => 'link', 'user' => $user->id, 'provider' => 'google']);
});

it('asks an account with a known password for a fresh confirmation before linking', function () {
    $this->actingAs(User::factory()->create())->get(route('linkedAccounts.create', 'google'))->assertRedirect(route('password.confirm'));
});

it('sends an account without a known password to the provider with no confirmation (rule S-1)', function () {
    providerReturns('google-1');
    $user = User::factory()->create(['password_set_at' => null]);

    $this->actingAs($user)->get(route('linkedAccounts.create', 'google'))
        ->assertRedirect()
        ->assertSessionHas('sso.intent', ['type' => 'link', 'user' => $user->id, 'provider' => 'google']);
});

it('links the identity the provider returns and comes back to the security section', function () {
    providerReturns('google-1');
    $user = User::factory()->create();

    $this->actingAs($user)->withSession(['sso.intent' => ['type' => 'link', 'user' => $user->id, 'provider' => 'google']])
        ->get(route('sso.callback', 'google'))
        ->assertRedirect(route('settings.edit').'#security');

    expect($user->socialAccounts()->sole()->provider_user_id)->toBe('google-1');
});

it('refuses an identity linked to another account, and a second identity of the same provider', function () {
    $user = User::factory()->create();
    SocialAccount::factory()->for(User::factory()->create())->create(['provider' => 'google', 'provider_user_id' => 'taken']);
    SocialAccount::factory()->for($user)->create(['provider' => 'google', 'provider_user_id' => 'mine']);

    foreach (['taken', 'another'] as $id) {
        providerReturns($id);

        $this->actingAs($user)->withSession(['sso.intent' => ['type' => 'link', 'user' => $user->id, 'provider' => 'google']])
            ->get(route('sso.callback', 'google'))
            ->assertRedirect(route('settings.edit').'#security');
    }

    expect($user->socialAccounts()->pluck('provider_user_id')->all())->toBe(['mine']);
});

it('does nothing for a signed-in user without an intent, or with an intent of someone else or for another provider', function (Closure $intent) {
    providerReturns('google-1');
    $user = User::factory()->create();

    $this->actingAs($user)->withSession(array_filter(['sso.intent' => $intent($user)]))
        ->get(route('sso.callback', 'google'))
        ->assertRedirect(route('dashboard'));

    expect(SocialAccount::query()->count())->toBe(0);
})->with([
    'none' => [fn () => null],
    'someone else' => [fn () => ['type' => 'link', 'user' => User::factory()->create()->id, 'provider' => 'google']],
    'another provider' => [fn (User $user) => ['type' => 'link', 'user' => $user->id, 'provider' => 'github']],
]);

it('still signs a visitor in through the callback', function () {
    $user = User::factory()->create();
    SocialAccount::factory()->for($user)->create(['provider' => 'google', 'provider_user_id' => 'google-1']);
    providerReturns('google-1');

    $this->get(route('sso.callback', 'google'))->assertRedirect(route('dashboard'));

    $this->assertAuthenticatedAs($user);
});
```

`tests/Concurrency/SocialAccountLinkTest.php`:

```php
<?php

use App\Actions\Auth\LinkSocialAccount;
use App\Enums\SsoProvider;
use App\Exceptions\SocialAccountRefused;
use App\Models\SocialAccount;
use App\Models\User;
use Tests\Concurrency\Support\Race;

it('links one identity of a provider when two links of one account arrive at once', function () {
    $userId = User::factory()->create()->id;

    $outcomes = Race::run([
        static fn () => resolve(LinkSocialAccount::class)->handle(User::query()->findOrFail($userId), SsoProvider::Google, 'google-1'),
        static fn () => resolve(LinkSocialAccount::class)->handle(User::query()->findOrFail($userId), SsoProvider::Google, 'google-2'),
    ]);

    expect(collect($outcomes)->where('ok', true))->toHaveCount(1)
        ->and(collect($outcomes)->firstWhere('ok', false)['error'])->toBe(SocialAccountRefused::class)
        ->and(SocialAccount::query()->where('user_id', $userId)->count())->toBe(1);
});
```

The protection proved: the user row's lock (remove `lockForUpdate()` and both links pass).

- [ ] **Step 2: See them fail.**
- [ ] **Step 3: Implementation**

`SsoIntent`:

```php
<?php

namespace App\Support\Auth;

use App\Enums\SsoProvider;
use App\Models\User;
use Illuminate\Http\Request;

/**
 * Why a signed-in user went to a provider: to link it. Read once, by the
 * callback, which honours it only for the same user and the same provider.
 */
class SsoIntent
{
    public const string Key = 'sso.intent';

    public const string Link = 'link';

    public static function put(Request $request, User $user, SsoProvider $provider): void
    {
        $request->session()->put(self::Key, ['type' => self::Link, 'user' => $user->id, 'provider' => $provider->value]);
    }

    /**
     * @return array{
     *     type: string,
     *     user: string,
     *     provider: string
     * }|null
     */
    public static function pull(Request $request): ?array
    {
        $intent = $request->session()->pull(self::Key);

        if (! is_array($intent) || ! is_string($intent['type'] ?? null) || ! is_string($intent['user'] ?? null) || ! is_string($intent['provider'] ?? null)) {
            return null;
        }

        return ['type' => $intent['type'], 'user' => $intent['user'], 'provider' => $intent['provider']];
    }
}
```

`SocialAccountRefused` (extends `Exception`): `linkedElsewhere(SsoProvider $p)` "This :provider account is already linked to another account.", `alreadyLinked(SsoProvider $p)` "Your account is already linked to :provider. Unlink it first.", `lastWayIn()` "You can't unlink your last sign-in method: set a password or link another account first.", `managed()` "This account is managed by your admin.".

`LinkSocialAccount`:

```php
<?php

namespace App\Actions\Auth;

use App\Enums\SsoProvider;
use App\Exceptions\SocialAccountRefused;
use App\Models\SocialAccount;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

class LinkSocialAccount
{
    /**
     * @throws SocialAccountRefused
     */
    public function handle(User $user, SsoProvider $provider, string $providerUserId): void
    {
        throw_if($providerUserId === '', SocialAccountRefused::linkedElsewhere($provider));

        DB::transaction(function () use ($user, $provider, $providerUserId): void {
            $locked = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
            $existing = SocialAccount::query()
                ->where('provider', $provider->value)
                ->where('provider_user_id', $providerUserId)
                ->first();

            if ($existing !== null) {
                throw_unless($existing->user_id === $locked->id, SocialAccountRefused::linkedElsewhere($provider));

                return;
            }

            throw_if($locked->socialAccounts()->where('provider', $provider->value)->exists(), SocialAccountRefused::alreadyLinked($provider));

            try {
                DB::transaction(fn () => $locked->socialAccounts()->create([
                    'provider' => $provider->value,
                    'provider_user_id' => $providerUserId,
                ]));
            } catch (UniqueConstraintViolationException) {
                throw SocialAccountRefused::linkedElsewhere($provider);
            }
        });
    }
}
```

`LinkedAccountsController::create(Request $request, SsoProvider $provider)`: `abort_unless($provider->isEnabled(), 404); SsoIntent::put($request, $request->user(), $provider);` then return `$provider->socialiteDriver()->redirect()` inside the same `try` / `report` / back-with-toast shape as `SsoRedirectsController`.

`SsoCallbacksController::show` starts, after `abort_unless($provider->isEnabled(), 404)`:

```php
        if ($request->user() !== null) {
            return $this->forSignedInUser($request, $request->user(), $provider, $linkSocialAccount);
        }

        $request->session()->forget(SsoIntent::Key);
```

(inject `LinkSocialAccount $linkSocialAccount`), and gains:

```php
    private function forSignedInUser(Request $request, User $user, SsoProvider $provider, LinkSocialAccount $linkSocialAccount): RedirectResponse
    {
        $intent = SsoIntent::pull($request);

        if ($intent === null || $intent['type'] !== SsoIntent::Link || $intent['user'] !== $user->id || $intent['provider'] !== $provider->value) {
            return to_route('dashboard');
        }

        try {
            $ssoUser = $provider->socialiteDriver()->user();
        } catch (Throwable $exception) {
            report($exception);

            return $this->backToSecurity(SsoLoginRefused::providerFailed($provider)->getMessage());
        }

        $providerUserId = $ssoUser instanceof AbstractUser ? (string) $ssoUser->getId() : '';

        try {
            $linkSocialAccount->handle($user, $provider, $providerUserId);
        } catch (SocialAccountRefused $exception) {
            return $this->backToSecurity($exception->getMessage());
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __(':provider is linked.', ['provider' => $provider->label()])]);

        return redirect(route('settings.edit').'#security');
    }

    private function backToSecurity(string $message): RedirectResponse
    {
        Inertia::flash('toast', ['type' => 'error', 'message' => $message]);

        return redirect(route('settings.edit').'#security');
    }
```

Routes: in `routes/web.php` move `Route::get('auth/{provider}/callback', …)->name('sso.callback');` out of the `guest` group (the redirect route stays in it). In `routes/settings.php`: `Route::get('settings/linked-accounts/{provider}', [LinkedAccountsController::class, 'create'])->middleware(RequirePasswordUnlessNoneKnown::class)->name('linkedAccounts.create');` (`auth`, `verified`).

- [ ] **Step 4: Run** — `bin/test-db pgsql -- tests/Feature/Auth tests/Feature/Settings`; the race on PostgreSQL: `bin/test-db pgsql --concurrency -- tests/Concurrency/SocialAccountLinkTest.php` → PASS (the other three engines run it in the roadmap's final matrix). The existing `SsoLoginTest`, `InvitationSsoTest`, `ForcedSsoTest` must pass unchanged.
- [ ] **Step 5: Commit** — `feat(security): link an identity from the one callback`.

### Task 16: Unlinking, and the linked accounts of the security section

**Files:**
- Create: `app/Actions/Auth/UnlinkSocialAccount.php`, `app/Support/Settings/LinkedAccounts.php`
- Modify: `app/Http/Controllers/Settings/LinkedAccountsController.php` (`destroy`), `routes/settings.php`, `app/Support/Settings/SecuritySettings.php` (`protected()` gains `linkedAccounts`)
- Test: `tests/Feature/Settings/LinkedAccountsTest.php`, `tests/Concurrency/SocialAccountUnlinkTest.php`

**Interfaces:**
- Consumes: `SignInMethods::remaining`, `isManagedByAdmin` (Task 13), `SocialAccountRefused` (Task 15).
- Produces: `UnlinkSocialAccount::handle(User $user, SocialAccount $account): void`; route `linkedAccounts.destroy` (DELETE `settings/linked-accounts/{socialAccount}`); `LinkedAccounts::of(User $user): array{rows: array<int, array{provider: string, label: string, isEnabled: bool, account: ?array{id: string, linkedAt: ?string, isManaged: bool, canUnlink: bool}}>, lastWayIn: bool}`; prop `security.protected.linkedAccounts`.

- [ ] **Step 1: Failing tests**

```php
<?php

use App\Models\SocialAccount;
use App\Models\User;
use App\Support\InstanceSettings;
use App\Support\Settings\LinkedAccounts;

beforeEach(fn () => config([
    'services.google.client_id' => 'g', 'services.google.client_secret' => 's',
    'services.github.client_id' => 'h', 'services.github.client_secret' => 't',
    'mail.default' => 'array',
]));

function unlink(mixed $test, User $user, SocialAccount $account): mixed
{
    return $test->actingAs($user)->withSession(['auth.password_confirmed_at' => time()])
        ->deleteJson(route('linkedAccounts.destroy', $account));
}

it('unlinks an identity when another way in remains', function () {
    $user = User::factory()->create();
    $google = SocialAccount::factory()->for($user)->create(['provider' => 'google']);

    unlink($this, $user, $google)->assertRedirect();

    expect($user->socialAccounts()->count())->toBe(0);
});

it('refuses to unlink the last way in', function (Closure $setUp) {
    [$user, $account] = $setUp();

    unlink($this, $user, $account)->assertJsonValidationErrors('account');

    expect($account->fresh())->not->toBeNull();
})->with([
    'no password, mail off' => [function () {
        $user = User::factory()->create(['password_set_at' => null]);

        return [$user, SocialAccount::factory()->for($user)->create(['provider' => 'google'])];
    }],
    'a member while single sign-on is required' => [function () {
        resolve(InstanceSettings::class)->set('sso_required', true);
        $user = User::factory()->create();

        return [$user, SocialAccount::factory()->for($user)->create(['provider' => 'google'])];
    }],
]);

it('refuses an identity managed by the admin even when another remains', function () {
    resolve(InstanceSettings::class)->set('sso_required', true);
    $user = User::factory()->create();
    $google = SocialAccount::factory()->for($user)->create(['provider' => 'google']);
    SocialAccount::factory()->for($user)->create(['provider' => 'github']);

    unlink($this, $user, $google)->assertJsonValidationErrors('account');
});

it('lets a provider turned off be unlinked', function () {
    $user = User::factory()->create();
    $entra = SocialAccount::factory()->for($user)->create(['provider' => 'entra']);

    unlink($this, $user, $entra)->assertRedirect();
});

it('answers 404 for another user\'s identity and asks an account with a known password for a fresh confirmation', function () {
    $user = User::factory()->create();
    $theirs = SocialAccount::factory()->for(User::factory()->create())->create(['provider' => 'google']);
    $mine = SocialAccount::factory()->for($user)->create(['provider' => 'github']);

    unlink($this, $user, $theirs)->assertNotFound();

    $this->flushSession();
    $this->actingAs($user)->deleteJson(route('linkedAccounts.destroy', $mine))->assertStatus(423);
});

it('describes every enabled provider and the linked ones of a provider turned off', function () {
    $user = User::factory()->create(['password_set_at' => null]);
    SocialAccount::factory()->for($user)->create(['provider' => 'google']);
    SocialAccount::factory()->for($user)->create(['provider' => 'entra']);

    $accounts = resolve(LinkedAccounts::class)->of($user);

    expect(collect($accounts['rows'])->pluck('provider')->all())->toBe(['google', 'github', 'entra'])
        ->and($accounts['rows'][0]['account']['canUnlink'])->toBeFalse()
        ->and($accounts['rows'][1]['account'])->toBeNull()
        ->and($accounts['rows'][2]['isEnabled'])->toBeFalse()
        ->and($accounts['rows'][2]['account']['canUnlink'])->toBeTrue()
        ->and($accounts['lastWayIn'])->toBeTrue();
});
```

`tests/Concurrency/SocialAccountUnlinkTest.php`:

```php
<?php

use App\Actions\Auth\UnlinkSocialAccount;
use App\Models\SocialAccount;
use App\Models\User;
use Tests\Concurrency\Support\Race;

it('never removes the last way in when two unlinks arrive at once', function () {
    $user = User::factory()->unverified()->create(['password_set_at' => null]);
    $googleId = SocialAccount::factory()->for($user)->create(['provider' => 'google'])->id;
    $githubId = SocialAccount::factory()->for($user)->create(['provider' => 'github'])->id;
    $userId = $user->id;
    $providers = static function (): void {
        config([
            'services.google.client_id' => 'g', 'services.google.client_secret' => 's',
            'services.github.client_id' => 'h', 'services.github.client_secret' => 't',
        ]);
    };

    $outcomes = Race::run([
        static function () use ($providers, $userId, $googleId): void {
            $providers();
            resolve(UnlinkSocialAccount::class)->handle(User::query()->findOrFail($userId), SocialAccount::query()->findOrFail($googleId));
        },
        static function () use ($providers, $userId, $githubId): void {
            $providers();
            resolve(UnlinkSocialAccount::class)->handle(User::query()->findOrFail($userId), SocialAccount::query()->findOrFail($githubId));
        },
    ]);

    expect(collect($outcomes)->where('ok', true))->toHaveCount(1)
        ->and(SocialAccount::query()->where('user_id', $userId)->count())->toBe(1);
});
```

The protection proved: the user row's lock before `remaining()` (without it both read two identities and both delete). The closure `$providers` captures nothing and is static: it serialises; if `Race` refuses a nested closure, inline the `config([...])` call in both contenders.

- [ ] **Step 2: See them fail.**
- [ ] **Step 3: Implementation**

```php
<?php

namespace App\Actions\Auth;

use App\Exceptions\SocialAccountRefused;
use App\Models\SocialAccount;
use App\Models\User;
use App\Support\Auth\SignInMethods;
use Illuminate\Support\Facades\DB;

class UnlinkSocialAccount
{
    public function __construct(private SignInMethods $methods) {}

    /**
     * The user row is locked before the ways in are counted, so two unlinks
     * at once cannot each leave the other as the last one and both pass.
     *
     * @throws SocialAccountRefused
     */
    public function handle(User $user, SocialAccount $account): void
    {
        DB::transaction(function () use ($user, $account): void {
            $locked = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
            $current = $locked->socialAccounts()->whereKey($account->id)->first();

            if ($current === null) {
                return;
            }

            throw_if($this->methods->isManagedByAdmin($current), SocialAccountRefused::managed());
            throw_if($this->methods->remaining($locked, $current) === [], SocialAccountRefused::lastWayIn());

            $current->delete();
        });
    }
}
```

`LinkedAccountsController::destroy(Request $request, SocialAccount $socialAccount, UnlinkSocialAccount $unlink): RedirectResponse` — `abort_unless($socialAccount->user_id === $request->user()->id, 404);` then `try { $unlink->handle(…) } catch (SocialAccountRefused $e) { throw ValidationException::withMessages(['account' => $e->getMessage()]); }`, toast ":provider is unlinked.", `back()`. Route `Route::delete('settings/linked-accounts/{socialAccount}', …)->whereUuid('socialAccount')->middleware(RequirePasswordUnlessNoneKnown::class)->name('linkedAccounts.destroy');` (`auth`, `verified`). An account without a known password unlinks with no confirmation (rule S-1); the last-way-in guard still applies to it.

`LinkedAccounts::of()` walks `SsoProvider::cases()` in order: a provider is listed when enabled or linked; `account` is the user's first account of it (`id`, `linkedAt` = `created_at?->toIso8601String()`, `isManaged` = `isManagedByAdmin`, `canUnlink` = not managed and `remaining($user, $account) !== []`); `lastWayIn` is true when at least one account is linked and every linked, unmanaged one has `canUnlink` false. `SecuritySettings::protected()` adds `'linkedAccounts' => $this->linkedAccounts->of($user)`.

- [ ] **Step 4: Run** — `bin/test-db pgsql -- tests/Feature/Settings tests/Feature/Auth`; the race with `bin/test-db pgsql --concurrency -- <the race file>` → PASS (the other three engines in the roadmap's final matrix).
- [ ] **Step 5: Commit** — `feat(security): unlink an identity, never the last way in`.

### Task 17: The password card — live breach line, set mode, hidden when refused; the gate under rule S-1

**Mockup:** `ScreenSecurity`, Password (rule list with "Not found in known data breaches"). Deviations P26-02, P26-12.

**Files:**
- Create: `resources/js/lib/settings/breach-check.ts` (+ test), `resources/js/components/settings/security/use-breach-check.ts` (+ test), `settings/security/breach-line.tsx` (+ test)
- Modify: `settings/security/password-card.tsx` (+ test), `settings/security/password-strength.tsx` (the save-time line becomes the fallback), `settings/password-gate.tsx` (+ test: rule S-1), `settings/account-settings.tsx` (passes `profile.needsPasswordConfirmation` to `PasswordGateProvider`), the security prop types (`liveBreachCheck`, `protected.password`), the profile prop type (`needsPasswordConfirmation`)

**Interfaces:**

```ts
export async function sha1Hex(text: string): Promise<string | null>; // upper-case hex; null without crypto.subtle
export function splitHash(hash: string): { prefix: string; suffix: string }; // 5 + 35
export function isBreached(suffixes: string[], suffix: string): boolean;
export type BreachState = 'idle' | 'checking' | 'clear' | 'breached' | 'unavailable';
export function useBreachCheck(password: string, enabled: boolean): BreachState; // 600 ms debounce; POST passwordBreachRanges.store with { prefix }
```

- [ ] **Step 1: Pure logic, test first.** `sha1Hex('password')` is `5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8` (with Node's `crypto.subtle` in Vitest); `sha1Hex` returns null when `crypto.subtle` is undefined; `splitHash` of that hash is `{ prefix: '5BAA6', suffix: '1E4C9B93F3F0682250B6CF8331B7EE68FD8' }`; `isBreached` is case-insensitive on the suffix.
- [ ] **Step 2: The hook**: `idle` for an empty password or `enabled=false`; `checking` while the request runs; `clear` / `breached` from the answer; `unavailable` on 404, 503, a network error or a null hash; a newer password cancels the older request (the last answer wins); the request body has exactly the key `prefix` with five characters (assert the mocked request). Use the project's JSON client (`useHttp` of Inertia, as `password-gate.tsx` does).
- [ ] **Step 3: The card.** `BreachLine` renders in the rule list of `PasswordStrength`: `idle` neutral "Not found in known data breaches"; `checking` a spinner (`motion-reduce:animate-none`) and "Checking known data breaches…"; `clear` met (check icon); `breached` not met, "Found in known data breaches: choose another one", and the field `aria-describedby` points at it; `unavailable` or `liveBreachCheck=false` with `checksCompromisedPasswords=true` → the existing "Checked against known data breaches when you save"; nothing when the server does not check. Set mode (`protected.password.isSet=false`): title "Set a password", no current-password field, button "Set the password", saved with no confirmation (rule S-1); `protected.password.allowed=false`: the card is not rendered. Vitest per state.
- [ ] **Step 4: The gate under rule S-1** (spec §5.12, accepted risk: do not add a dialog back). `PasswordGateProvider` takes `needsConfirmation: boolean` (from `profile.needsPasswordConfirmation`). When it is false, `guard(action)` asks no status and opens no dialog: it loads the protected props if they were kept back, then runs the action. When it is true, nothing changes. Vitest: with `needsConfirmation={false}` a guarded action runs at once and no request reaches `password.confirmation`; with `true` the existing cases pass unchanged. Test names carry "(rule S-1)".
- [ ] **Step 5: Gates** — `npm run test -- breach-check use-breach-check breach-line password-card password-strength password-gate account-settings`, types, check, build.
- [ ] **Step 6: Commit** — `feat(security): the breach line while typing, setting a first password, and no confirmation dialog without a known password (accepted risk S-1)`.

### Task 18: The Active sessions card

**Mockup:** `ScreenSecurity`, Active sessions (table; phone: list of cards). Deviations P26-03, P26-04, P26-05, P26-14.

**Files:**
- Create: `resources/js/components/settings/security/active-sessions-card.tsx` (+ test)
- Modify: `settings/account-settings.tsx` (mount in `SecurityStack`'s `activeSessions`), the prop types

| Part | Content | Behaviour |
|---|---|---|
| card | `SettingsCard` "Active sessions", "Devices signed in to your account.", header action "Sign out other sessions" (outline, icon `log-out`) | disabled when only the current row exists; opens `ConfirmDialog` "Sign out every other device?" / "They will need to sign in again. "Remember me" ends on every device." / "Sign out"; then `router.delete(OtherBrowserSessionsController.destroy.url(), { preserveScroll: true })` through `usePasswordGate().guard` |
| table (≥ md) | columns Device (icon `laptop` / `smartphone` / `monitor-off`, label "Firefox on macOS", badge "This device" on the current row), IP address (in the mockup's "Approximate location" place: the address in `font-mono`, `break-all` so an IPv6 address never overflows; "Unknown" in muted text when null; no map pin, no "Unusual location" badge), Last active ("Active now" under 2 minutes, else relative with the existing date helper), Sign out | per row "Sign out" (ghost, destructive text) with its own `ConfirmDialog`; none on the current row; the deleted row disappears after the reload of the protected props |
| phone (< md) | one card per row: icon, label, badge, the IP address under the label, last active, button | same actions |
| driver not `database` (`browserSessions` null) | **nothing**: the card is not mounted, the Security stack closes up (decision 2C) | — |
| locked section | as the other protected cards (`concealed-cards.tsx` pattern) | — |

- [ ] **Step 1: Failing Vitest** for each row of the table above (the three device icons; the IP column with an IPv4, an IPv6 and a null address; "This device" without a button; the confirm dialogs; no card at all and no `[data-slot="active-sessions"]` when `browserSessions` is null; the phone layout with `useIsMobile` mocked).
- [ ] **Step 2: Build.** Hooks kept: `[data-slot="active-sessions"]`, rows `[data-session-key]`, buttons by name "Sign out", "Sign out other sessions".
- [ ] **Step 3: Gates** — `npm run test -- active-sessions-card account-settings security-stack`, types, check, build.
- [ ] **Step 4: Commit** — `feat(security): the active sessions card`.

### Task 19: The Linked accounts card

**Mockup:** `ScreenSecurity`, Linked accounts. Deviations P26-06, P26-11. No "Confirm with <provider>" button anywhere (decision 4: an account without a known password needs no confirmation; `password-gate.tsx` is Task 17's, `auth/confirm-password` is untouched).

**Files:**
- Create: `resources/js/components/settings/security/linked-accounts-card.tsx` (+ test)
- Modify: `settings/account-settings.tsx` (mount in `SecurityStack`'s `linkedAccounts`), the prop types (`protected.linkedAccounts`)

| Part | Content | Behaviour |
|---|---|---|
| card | "Linked accounts", "Sign in with your company SSO or an existing account. Keep at least one way in." | — |
| row, linked | provider mark (the `ssoProviders` icons of the login form; a letter otherwise), label, "Linked :date", badge "Managed by your admin" (`isManaged`) or "Unlink" (outline) | "Unlink" disabled with its reason as tooltip when `canUnlink` is false; a `ConfirmDialog` "Unlink :provider?"; `router.delete(LinkedAccountsController.destroy.url(id))` through the gate; a 422 shows its message as a toast |
| row, not linked | label, "Not linked", "Link :provider" (outline, icon `link`) | a full navigation (`window.location.assign(LinkedAccountsController.create.url(provider))`) through the gate: the provider is another site |
| row, provider off | label, "Not available on this instance", "Unlink" | as linked |
| note | "You can't unlink your last sign-in method: set a password or link another account first." (icon `info`) | shown when `lastWayIn` |

- [ ] **Step 1: Failing Vitest** per row of the table (the gate is mocked: with `needsConfirmation` false the link navigation and the unlink request go at once).
- [ ] **Step 2: Build.**
- [ ] **Step 3: Gates** — `npm run test -- linked-accounts-card account-settings`, types, check, build.
- [ ] **Step 4: Commit** — `feat(security): the linked accounts card`.

---

## Lane Codes (GU-2)

### Task 20: Join codes — issue, rotate, show to who may share

**Files:**
- Create: `database/migrations/2026_10_26_100300_create_session_join_codes_table.php`, `app/Enums/JoinableSessionKind.php`, `app/Models/SessionJoinCode.php`, `database/factories/SessionJoinCodeFactory.php`, `app/Support/Sessions/JoinCode.php`, `app/Support/Sessions/JoinCodes.php`
- Modify: the five snapshot builders (`joinCode` beside `guestUrl`), the five `*GuestTokensController` (`joinCode` in the JSON), `app/Http/Controllers/Games/GameGuestTokensController.php` included
- Test: `tests/Unit/Support/Sessions/JoinCodeTest.php`, `tests/Feature/Sessions/JoinCodesTest.php`, `tests/Concurrency/JoinCodeIssueTest.php`

**Interfaces:**
- Produces: `JoinCode::Alphabet` (`ABCDEFGHJKMNPQRSTUVWXYZ23456789`), `JoinCode::generate(): string`, `JoinCode::normalise(string $input): ?string`; `JoinCodes::for(Retro|PokerGame|Whiteboard|TeamSurvey|GameRoom $session): string`, `rotate(…): string`, `resolve(string $input): ?string` (the join page URL or null); snapshot key `joinCode: ?string` wherever `guestUrl` is (`retro.guestUrl` → `retro.joinCode`, `game.guestUrl` → `game.joinCode`, and so on — read each builder); guest-token JSON `{ guestUrl, joinCode }`.

- [ ] **Step 1: Failing tests**

`tests/Unit/Support/Sessions/JoinCodeTest.php`:

```php
<?php

use App\Support\Sessions\JoinCode;

it('generates codes of the mockup shape from the alphabet without look-alikes', function () {
    foreach (range(1, 200) as $ignored) {
        expect(JoinCode::generate())->toMatch('/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{3}-[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{4}$/');
    }
});

it('reads what people type', function (string $typed, ?string $code) {
    expect(JoinCode::normalise($typed))->toBe($code);
})->with([
    ['K7Q-P4M2', 'K7Q-P4M2'],
    ['k7q-p4m2', 'K7Q-P4M2'],
    ['k7qp4m2', 'K7Q-P4M2'],
    [' K7Q P4M2 ', 'K7Q-P4M2'],
    ['K7Q-P4M', null],
    ['K7Q-P4M22', null],
    ['K0Q-P4M2', null],
    ['KOQ-P4M2', null],
    ['K1Q-P4M2', null],
    ['KIQ-P4M2', null],
    ['K7Q_P4M2', null],
]);
```

`tests/Feature/Sessions/JoinCodesTest.php`:

```php
<?php

use App\Models\GameRoom;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\SessionJoinCode;
use App\Models\TeamSurvey;
use App\Models\Whiteboard;
use App\Support\Sessions\JoinCodes;

dataset('joinable sessions', [
    'retro' => [fn () => Retro::factory()->withGuestAccess()->create(), 'retros.join.show'],
    'poker' => [fn () => PokerGame::factory()->withGuestAccess()->create(), 'poker.join.show'],
    'whiteboard' => [fn () => Whiteboard::factory()->withGuestAccess()->create(), 'whiteboards.join.show'],
    'survey' => [fn () => TeamSurvey::factory()->open()->withGuestAccess()->create(), 'surveys.join.show'],
    'game' => [fn () => GameRoom::factory()->linkAccess()->create(), 'games.join.show'],
]);

it('issues one code per session and keeps it', function (Closure $make) {
    $session = $make();
    $codes = resolve(JoinCodes::class);

    expect($codes->for($session))->toBe($codes->for($session))
        ->and(SessionJoinCode::query()->count())->toBe(1);
})->with('joinable sessions');

it('resolves a code to the join page while the session accepts guests', function (Closure $make, string $joinRoute) {
    $session = $make();
    $code = resolve(JoinCodes::class)->for($session);

    expect(resolve(JoinCodes::class)->resolve(strtolower(str_replace('-', '', $code))))->toBe(route($joinRoute, $session->guest_token));
})->with('joinable sessions');

it('gives a new code with a new link, and the old one stops resolving', function (Closure $make) {
    $session = $make();
    $codes = resolve(JoinCodes::class);
    $old = $codes->for($session);

    $new = $codes->rotate($session);

    expect($new)->not->toBe($old)
        ->and($codes->resolve($old))->toBeNull()
        ->and($codes->for($session))->toBe($new);
})->with('joinable sessions');

it('resolves nothing for a session that no longer accepts guests, or is gone', function () {
    $retro = Retro::factory()->withGuestAccess()->create();
    $codes = resolve(JoinCodes::class);
    $code = $codes->for($retro);

    $retro->update(['guest_access_enabled' => false]);
    expect($codes->resolve($code))->toBeNull();

    $retro->delete();
    expect($codes->resolve($code))->toBeNull()
        ->and(SessionJoinCode::query()->count())->toBe(0);
});

it('shows the code to who sees the link, and to no guest', function () {
    $retro = Retro::factory()->withGuestAccess()->create();
    [$facilitator] = retroFacilitator($retro);

    $this->actingAs($facilitator)->getJson(route('retros.snapshot.show', $retro))
        ->assertJsonPath('retro.joinCode', resolve(JoinCodes::class)->for($retro));
});

it('returns the new code when the link is regenerated', function () {
    $retro = Retro::factory()->withGuestAccess()->create();
    [$facilitator] = retroFacilitator($retro);
    $old = resolve(JoinCodes::class)->for($retro);

    $joinCode = $this->actingAs($facilitator)->postJson(route('retros.guestToken.store', $retro))->assertOk()->json('joinCode');

    expect($joinCode)->not->toBe($old)->toBe(resolve(JoinCodes::class)->for($retro));
});
```

Read each snapshot builder and route name before writing the last two cases for the other four kinds (one dataset each, in the style of the retro case; the retro's snapshot route name and JSON path are checked against `BuildBoardSnapshot` and `routes/web.php`). A guest's snapshot has `joinCode` null wherever its `guestUrl` is null.

`tests/Concurrency/JoinCodeIssueTest.php`:

```php
<?php

use App\Models\Retro;
use App\Models\SessionJoinCode;
use App\Support\Sessions\JoinCodes;
use Tests\Concurrency\Support\Race;

it('issues one code when two first shares of a session arrive at once', function () {
    $retroId = Retro::factory()->withGuestAccess()->create()->id;

    $outcomes = Race::run([
        static fn (): string => resolve(JoinCodes::class)->for(Retro::query()->findOrFail($retroId)),
        static fn (): string => resolve(JoinCodes::class)->for(Retro::query()->findOrFail($retroId)),
    ], Race::FirstQuery);

    expect(array_column($outcomes, 'ok'))->each->toBeTrue()
        ->and($outcomes[0]['value'])->toBe($outcomes[1]['value'])
        ->and(SessionJoinCode::query()->count())->toBe(1);
});
```

The protection proved: the unique pair (`session_kind`, `session_id`) and the re-read after the losing insert (remove the `catch` and one contender fails; remove the unique index and two rows exist).

- [ ] **Step 2: See them fail.**
- [ ] **Step 3: Implementation**

Migration:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('session_join_codes', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('code', 8)->unique();
            $table->string('session_kind', 16);
            $table->uuid('session_id');
            $table->timestamps();

            $table->unique(['session_kind', 'session_id']);
        });
    }
};
```

`JoinableSessionKind` (backed string enum: `Retro = 'retro'`, `Poker = 'poker'`, `Whiteboard = 'whiteboard'`, `Survey = 'survey'`, `Game = 'game'`).

`SessionJoinCode` (`HasUuids`, `HasFactory`, fillable `code`, `session_kind`, `session_id`, cast `session_kind` to the enum):

```php
    public function session(): Retro|PokerGame|Whiteboard|TeamSurvey|GameRoom|null
    {
        return match ($this->session_kind) {
            JoinableSessionKind::Retro => Retro::query()->find($this->session_id),
            JoinableSessionKind::Poker => PokerGame::query()->find($this->session_id),
            JoinableSessionKind::Whiteboard => Whiteboard::query()->find($this->session_id),
            JoinableSessionKind::Survey => TeamSurvey::query()->find($this->session_id),
            JoinableSessionKind::Game => GameRoom::query()->find($this->session_id),
        };
    }
```

`JoinCode`:

```php
<?php

namespace App\Support\Sessions;

use Illuminate\Support\Str;

/**
 * A code read aloud in a meeting: no 0, O, 1, I or L, three characters, a
 * hyphen, four characters (the ShareDialog mockup's shape).
 */
class JoinCode
{
    public const string Alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

    private const int Length = 7;

    private const int HeadLength = 3;

    public static function generate(): string
    {
        $characters = '';

        for ($index = 0; $index < self::Length; $index++) {
            $characters .= self::Alphabet[random_int(0, strlen(self::Alphabet) - 1)];
        }

        return self::format($characters);
    }

    public static function normalise(string $input): ?string
    {
        $compact = Str::upper(str_replace([' ', '-'], '', trim($input)));

        if (strlen($compact) !== self::Length || strspn($compact, self::Alphabet) !== self::Length) {
            return null;
        }

        return self::format($compact);
    }

    private static function format(string $compact): string
    {
        return substr($compact, 0, self::HeadLength).'-'.substr($compact, self::HeadLength);
    }
}
```

`JoinCodes`:

```php
<?php

namespace App\Support\Sessions;

use App\Enums\GameRoomAccess;
use App\Enums\JoinableSessionKind;
use App\Enums\TeamSurveyStatus;
use App\Models\GameRoom;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\SessionJoinCode;
use App\Models\TeamSurvey;
use App\Models\Whiteboard;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * A session's code is issued the first time someone who may share its link
 * sees it, and replaced with the link. It leads to the join page only while
 * that page would accept a guest.
 */
class JoinCodes
{
    private const int Attempts = 5;

    public function for(Retro|PokerGame|Whiteboard|TeamSurvey|GameRoom $session): string
    {
        $kind = self::kindOf($session);

        for ($attempt = 1; $attempt <= self::Attempts; $attempt++) {
            $existing = $this->codeOf($kind, $session->id);

            if ($existing !== null) {
                return $existing;
            }

            try {
                return DB::transaction(fn (): string => SessionJoinCode::query()->create([
                    'code' => JoinCode::generate(),
                    'session_kind' => $kind,
                    'session_id' => $session->id,
                ])->code);
            } catch (UniqueConstraintViolationException) {
                continue;
            }
        }

        throw new RuntimeException('No join code could be issued.');
    }

    public function rotate(Retro|PokerGame|Whiteboard|TeamSurvey|GameRoom $session): string
    {
        $kind = self::kindOf($session);

        for ($attempt = 1; $attempt <= self::Attempts; $attempt++) {
            try {
                return DB::transaction(fn (): string => SessionJoinCode::query()->updateOrCreate(
                    ['session_kind' => $kind, 'session_id' => $session->id],
                    ['code' => JoinCode::generate()],
                )->code);
            } catch (UniqueConstraintViolationException) {
                continue;
            }
        }

        throw new RuntimeException('No join code could be issued.');
    }

    public function resolve(string $input): ?string
    {
        $code = JoinCode::normalise($input);

        if ($code === null) {
            return null;
        }

        $row = SessionJoinCode::query()->where('code', $code)->first();

        if ($row === null) {
            return null;
        }

        $session = $row->session();

        if ($session === null) {
            $row->delete();

            return null;
        }

        return $this->joinUrl($session);
    }

    private function joinUrl(Retro|PokerGame|Whiteboard|TeamSurvey|GameRoom $session): ?string
    {
        return match (true) {
            $session instanceof Retro => $session->guest_access_enabled ? route('retros.join.show', $session->guest_token) : null,
            $session instanceof PokerGame => $session->guest_access_enabled ? route('poker.join.show', $session->guest_token) : null,
            $session instanceof Whiteboard => $session->guest_access_enabled ? route('whiteboards.join.show', $session->guest_token) : null,
            $session instanceof TeamSurvey => $session->guest_access_enabled && $session->status !== TeamSurveyStatus::Draft && $session->retro_id === null
                ? route('surveys.join.show', $session->guest_token)
                : null,
            $session instanceof GameRoom => $session->retro_id === null && $session->access === GameRoomAccess::Link ? $session->guestUrl() : null,
        };
    }

    private function codeOf(JoinableSessionKind $kind, string $sessionId): ?string
    {
        $code = SessionJoinCode::query()->where('session_kind', $kind)->where('session_id', $sessionId)->value('code');

        return is_string($code) ? $code : null;
    }

    private static function kindOf(Retro|PokerGame|Whiteboard|TeamSurvey|GameRoom $session): JoinableSessionKind
    {
        return match (true) {
            $session instanceof Retro => JoinableSessionKind::Retro,
            $session instanceof PokerGame => JoinableSessionKind::Poker,
            $session instanceof Whiteboard => JoinableSessionKind::Whiteboard,
            $session instanceof TeamSurvey => JoinableSessionKind::Survey,
            $session instanceof GameRoom => JoinableSessionKind::Game,
        };
    }
}
```

Each snapshot builder: inject `JoinCodes` and add, beside `'guestUrl' => …`, `'joinCode' => <the same condition> ? $this->joinCodes->for($x) : null,` (compute the URL once into a local and test it for null). Each `*GuestTokensController::store`: after its transaction, `'joinCode' => $joinCodes->rotate($locked)` in the JSON (for the game room, only when its `guestUrl` is not null). Check the five events or MCP presenters that copy the snapshot's `guestUrl` and add nothing to them.

- [ ] **Step 4: Run** — `bin/test-db pgsql -- tests/Unit/Support/Sessions tests/Feature/Sessions tests/Feature/Retros tests/Feature/Poker tests/Feature/Whiteboards tests/Feature/TeamSurveys tests/Feature/Games tests/Feature/Mcp` (a snapshot test asserting its exact keys gains `joinCode`: list each); the race with `bin/test-db pgsql --concurrency -- <the race file>` → PASS (the other three engines in the roadmap's final matrix).
- [ ] **Step 5: Commit** — `feat(guests): a short join code per session, rotated with its link`.

### Task 21: Joining by code — the route and its page

**Files:**
- Create: `app/Http/Controllers/JoinCodesController.php`, `resources/js/pages/sessions/join-code.tsx` (thin: it renders `JoinCodeCard` of Task 22; until then a heading and a bare form)
- Modify: `routes/web.php`, `app/Providers/AppServiceProvider.php` or the route file's throttle (a named limiter `joinCodes`: 10 per minute per IP, in the style of the existing named limiters)
- Test: `tests/Feature/Sessions/JoinByCodeTest.php`

**Interfaces:**
- Consumes: `JoinCodes::resolve` (Task 20).
- Produces: routes `joinCodes.create` (GET `join`, page `sessions/join-code`) and `joinCodes.store` (POST `join`, field `code`); the error key `code` with "No session matches this code.".

- [ ] **Step 1: Failing test**

```php
<?php

use App\Models\Retro;
use App\Support\Sessions\JoinCodes;
use Inertia\Testing\AssertableInertia as Assert;

it('shows the page to anyone', function () {
    $this->get(route('joinCodes.create'))->assertOk()->assertInertia(fn (Assert $page) => $page->component('sessions/join-code'));
});

it('sends a code, however it is typed, to the session\'s join page', function () {
    $retro = Retro::factory()->withGuestAccess()->create();
    $code = resolve(JoinCodes::class)->for($retro);

    $this->post(route('joinCodes.store'), ['code' => strtolower(str_replace('-', ' ', $code))])
        ->assertRedirect(route('retros.join.show', $retro->guest_token));
});

it('answers the same for an unknown code, a session closed to guests and a look-alike', function (Closure $code) {
    $this->from(route('joinCodes.create'))->post(route('joinCodes.store'), ['code' => $code()])
        ->assertRedirect(route('joinCodes.create'))
        ->assertSessionHasErrors(['code' => 'No session matches this code.']);
})->with([
    'unknown' => [fn () => 'AAA-AAAA'],
    'closed' => [function () {
        $retro = Retro::factory()->withGuestAccess()->create();
        $code = resolve(JoinCodes::class)->for($retro);
        $retro->update(['guest_access_enabled' => false]);

        return $code;
    }],
    'look-alike' => [fn () => 'K0Q-P4M2'],
]);

it('throttles guessing', function () {
    foreach (range(1, 10) as $ignored) {
        $this->post(route('joinCodes.store'), ['code' => 'AAA-AAAA']);
    }

    $this->post(route('joinCodes.store'), ['code' => 'AAA-AAAA'])->assertTooManyRequests();
});
```

- [ ] **Step 2: See it fail.**
- [ ] **Step 3: Implementation**

```php
<?php

namespace App\Http\Controllers;

use App\Support\Sessions\JoinCodes;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class JoinCodesController extends Controller
{
    public function create(): Response
    {
        return Inertia::render('sessions/join-code');
    }

    /**
     * One answer for every failure, so that the page says nothing about
     * which codes exist.
     */
    public function store(Request $request, JoinCodes $joinCodes): RedirectResponse
    {
        /** @var array{code: string} $validated */
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:16'],
        ]);

        $url = $joinCodes->resolve($validated['code']);

        if ($url === null) {
            throw ValidationException::withMessages(['code' => __('No session matches this code.')]);
        }

        return redirect($url);
    }
}
```

Routes in `routes/web.php`, outside the `auth` groups: `Route::get('join', [JoinCodesController::class, 'create'])->name('joinCodes.create');` and `Route::post('join', [JoinCodesController::class, 'store'])->middleware('throttle:joinCodes')->name('joinCodes.store');`, with `RateLimiter::for('joinCodes', fn (Request $request) => Limit::perMinute(10)->by($request->ip()))` where the project defines its named limiters (read `FortifyServiceProvider` and `AppServiceProvider`). Check the order against `join/{guestToken}` (no conflict: different segment counts).

- [ ] **Step 4: PostgreSQL** — `bin/test-db pgsql -- tests/Feature/Sessions tests/Arch` → PASS.
- [ ] **Step 5: Commit** — `feat(guests): join a session with its code`.

### Task 22: The code in the Share dialogs, the join-by-code page, the login link

**Mockup:** `ShareDialog` ("Session code", "Join at …/join", regenerate stops the code), `Input` ("Session code" states), `GuestJoin` (card frame). Deviations P26-08, P26-09, P26-10.

**Files:**
- Create: `resources/js/lib/sessions/join-code.ts` (+ test), `resources/js/components/sessions/join-code-card.tsx` (+ test)
- Modify: `resources/js/pages/sessions/join-code.tsx` (+ test), the five share mounts (`retro/board-share.tsx`, `poker/room-dialogs.tsx`, `whiteboard/board-share.tsx`, `surveys/survey-share.tsx`, `games/room-share-dialog.tsx`) and their snapshot types and reducers (`joinCode`, and the regenerate handler storing the new code), `resources/js/components/auth/login-form.tsx` (+ test)

**Interfaces:**

```ts
export const JoinCodeAlphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function normaliseJoinCode(input: string): string | null; // the PHP rule of Task 20, same cases
export function formatAsTyped(input: string): string;            // upper case, the hyphen inserted after three characters, at most 8 characters
export function joinHost(url: string): string;                   // 'https://skrum.example/join' → 'skrum.example/join'
```

- [ ] **Step 1: `join-code.ts`, test first** — the eleven cases of `JoinCodeTest.php`; `formatAsTyped('k7qp')` → `K7Q-P`; `joinHost` drops the scheme and a trailing slash.
- [ ] **Step 2: Share mounts.** Each passes `invite.code = snapshot.<kind>.joinCode ?? undefined` and `invite.joinUrl = joinHost(JoinCodesController.create.url({ absolute: true }))` (or the Wayfinder helper the project uses for an absolute URL; read one share mount first); on regenerate, the JSON's `joinCode` replaces the stored one with the URL. Tests: the dialog shows "Session code" with the code and "Join at …/join"; after regenerate the new code shows; a guest's dialog shows none (`joinCode` null).
- [ ] **Step 3: `JoinCodeCard` and the page.** The auth layout centred; `Card` with the logo (as `GuestJoin`), title "Join a session", sentence "Type the code the facilitator shared.", field "Session code" (`font-mono`, upper case through `formatAsTyped`, placeholder `ABC-1234`, `autoFocus`, `autoComplete="off"`, `inputMode="text"`, `autoCapitalize="characters"`), client error "The code has 8 characters" when `normaliseJoinCode` is null on submit (the `Input` mockup's invalid state, `aria-invalid`, `aria-describedby`), server error `errors.code` the same way, button "Continue" (large, full width, busy while posting), separator, "Have an account? Sign in". Phone: the button docked at the bottom as `GuestJoin`'s `stickyAction`. Vitest: typing formats; a short code shows the client error without posting; a valid one posts `{ code }`; the server error shows.
- [ ] **Step 4: Login link.** Under the login form's footer links, "Join a session with a code" → `JoinCodesController.create.url()`; absent nowhere (also under `sso_required`). Test in `login-form.test.tsx`.
- [ ] **Step 5: Gates** — `npm run test -- join-code share login-form board-share room-dialogs survey-share room-share-dialog`, types, check, build.
- [ ] **Step 6: Commit** — `feat(guests): the session code in every Share dialog, the join-by-code page and its link`.

---

## Final (single writer, after the five lanes are merged)

### Task 23: Translations

- [ ] Collect every key added by Tasks 1 to 22 (`git diff main -- lang/en.json`), and check each exists in `fr.json`, `es.json`, `de.json` with an informal value (French "tu", Spanish "tú", German "du"). The values of the main keys:

| en | fr | es | de |
|---|---|---|---|
| Avatar & presence colour | Avatar et couleur de présence | Avatar y color de presencia | Avatar und Präsenzfarbe |
| Used for your avatar and your live cursor. | Utilisée pour ton avatar et ton curseur en direct. | Se usa para tu avatar y tu cursor en directo. | Wird für deinen Avatar und deinen Live-Cursor verwendet. |
| Upload photo | Téléverser une photo | Subir una foto | Foto hochladen |
| Use initials | Utiliser les initiales | Usar las iniciales | Initialen verwenden |
| Remove photo | Retirer la photo | Quitar la foto | Foto entfernen |
| Profile photos | Photos de profil | Fotos de perfil | Profilfotos |
| Members can upload a photo that replaces their generated avatar. Photos are public, like avatars. | Les membres peuvent téléverser une photo qui remplace leur avatar généré. Les photos sont publiques, comme les avatars. | Los miembros pueden subir una foto que sustituye su avatar generado. Las fotos son públicas, como los avatares. | Mitglieder können ein Foto hochladen, das ihren generierten Avatar ersetzt. Fotos sind öffentlich, wie Avatare. |
| This image could not be read. Choose a JPEG or PNG file. | Cette image est illisible. Choisis un fichier JPEG ou PNG. | No se pudo leer esta imagen. Elige un archivo JPEG o PNG. | Dieses Bild konnte nicht gelesen werden. Wähle eine JPEG- oder PNG-Datei. |
| Reduce animations | Réduire les animations | Reducir las animaciones | Animationen reduzieren |
| Your system already asks for fewer animations. | Ton système demande déjà moins d'animations. | Tu sistema ya pide menos animaciones. | Dein System verlangt bereits weniger Animationen. |
| Not found in known data breaches | Absent des fuites de données connues | No aparece en filtraciones de datos conocidas | Nicht in bekannten Datenlecks gefunden |
| Found in known data breaches: choose another one | Présent dans des fuites de données connues : choisis-en un autre | Aparece en filtraciones de datos conocidas: elige otra | In bekannten Datenlecks gefunden: wähle ein anderes |
| Set a password | Définir un mot de passe | Definir una contraseña | Passwort festlegen |
| Active sessions | Sessions actives | Sesiones activas | Aktive Sitzungen |
| Devices signed in to your account. | Appareils connectés à ton compte. | Dispositivos conectados a tu cuenta. | Geräte, die mit deinem Konto angemeldet sind. |
| This device | Cet appareil | Este dispositivo | Dieses Gerät |
| IP address | Adresse IP | Dirección IP | IP-Adresse |
| Sign out other sessions | Déconnecter les autres sessions | Cerrar las demás sesiones | Andere Sitzungen abmelden |
| Linked accounts | Comptes liés | Cuentas vinculadas | Verknüpfte Konten |
| Managed by your admin | Géré par ton admin | Gestionado por tu administrador | Von deinem Admin verwaltet |
| You can't unlink your last sign-in method: set a password or link another account first. | Impossible de délier ton dernier moyen de connexion : définis un mot de passe ou lie un autre compte avant. | No puedes desvincular tu último método de inicio de sesión: define una contraseña o vincula otra cuenta antes. | Du kannst deine letzte Anmeldemethode nicht trennen: Lege zuerst ein Passwort fest oder verknüpfe ein anderes Konto. |
| Session code | Code de session | Código de sesión | Sitzungscode |
| Join a session | Rejoindre une session | Unirse a una sesión | Einer Sitzung beitreten |
| No session matches this code. | Aucune session ne correspond à ce code. | Ninguna sesión corresponde a este código. | Keine Sitzung passt zu diesem Code. |
| The code has 8 characters | Le code fait 8 caractères | El código tiene 8 caracteres | Der Code hat 8 Zeichen |
| Join a session with a code | Rejoindre une session avec un code | Unirse a una sesión con un código | Mit einem Code einer Sitzung beitreten |

- [ ] Run `bin/test-db pgsql -- tests/Feature/TranslationKeysTest.php tests/Feature/InformalRegisterTest.php` → PASS. Commit `chore(i18n): plan 26 strings in four languages, informal`.

### Task 24: Captures (light, 1440, French)

No browser walkthrough is written, edited or run. Captures only, through the visual harness of `tests/Browser/Visual` (`CapturesVisuals::captureVisuals`, honouring `VISUAL_ONLY`).

- [ ] **Cases** (extend `tests/Browser/Visual/SettingsPagesVisualTest.php`; create `tests/Browser/Visual/GuestPagesVisualTest.php` for the last three; fixtures by factories, fixed names and dates with `travelTo`):

| Name | Screen |
|---|---|
| `settings-profile-colours` | the profile card, colour 5 selected, a photo uploaded |
| `settings-appearance-motion` | the appearance card with "Reduce animations" on |
| `settings-security-sessions` | the security section confirmed: password card with the met breach line (range faked), Active sessions with three devices (an IPv4, an IPv6 and the current one), Linked accounts with Google linked, GitHub not linked |
| `settings-security-sso-only` | an account without a password, opened with no confirmation (rule S-1): "Set a password", the note of the last way in |
| `admin-branding-photos` | Administration › Branding, the avatar group with "Profile photos" on (extend the Branding visual test the harness already has, or `SettingsPagesVisualTest.php` if there is none) |
| `guest-join-colours` | the retro join page with three colours taken |
| `share-dialog-code` | the retro Share dialog with its code |
| `join-code` | the join-by-code page with the client error shown |

- [ ] **Run**: `npm run build:front`, then `docker compose exec -e VISUAL_ONLY=light-1440-fr laravel.test php artisan test --compact tests/Browser/Visual/SettingsPagesVisualTest.php tests/Browser/Visual/GuestPagesVisualTest.php` (from a worktree, the container and the working directory as `bin/test-db` documents them). The overflow check of the harness must pass. Only `-light-1440-fr.png` files are written.
- [ ] Commit `test(visual): account and guest captures, light, 1440, French`.

### Task 25: Deviations and documents

- [ ] For each capture of Task 24, open it beside the mockup's `preview.html` (light, 1440, French) and list the remaining differences. Each is either one of the approved rows P26-01 to P26-15 or is fixed to the mockup in this task (its own commit, `fix(settings): …` or `fix(guests): …`). A difference that can be neither (it needs data or a concept that does not exist) is listed in the report as a new row for the owner; the plan is not held for it.
- [ ] Documents, in one commit:
  - the spec and this plan stay at their paths (`docs/superpowers/specs/2026-10-21-plan-26-account-guests-design.md`, `docs/superpowers/plans/2026-10-21-plan-26-account-guests.md`); update only what the build changed (a deviation fixed in the first step, a rule found false while building), the owner's answers being already folded in;
  - `docs/superpowers/research/front-rewrite/feature-roadmap.md`: rows AC-1 to AC-6, GU-1, GU-2 marked "done, plan 26"; the "Back end" lines of AC-4 and AC-6 corrected as spec §1.1 says; the backlog line completed with spec §3;
  - `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md`, "Deviations from the mockup": D-25 reduced to what stays backlog (other notification events, "last changed", "Change device", "last used", revoked-token rows, location); D-32 removed; D-79 removed (decision 6B, answered);
  - `docs/database.md`: under SQLite, one sentence — with `SESSION_DRIVER=file` the security page shows no Active sessions card;
  - `README.md` (upgrade notes): `SKRUM_PASSWORD_BREACH_CHECK` and `SKRUM_PASSWORD_BREACH_CHECK_TIMEOUT`; the SSO callback now also serves signed-in users (no provider change needed); profile photos are **off** until an admin turns on "Profile photos" in Branding, and are stored on the `local` disk under `avatars/` (back it up with the rest of `storage/app`); Active sessions show each device's IP address as the framework stored it, so an instance behind a reverse proxy sets `TRUSTED_PROXIES`; an account created by SSO, without a password of its own, is asked no confirmation in the account settings until it sets one (the owner's accepted risk, spec §5.12, rule S-1).
- [ ] Commit `docs: plan 26 — roadmap and deviation rows updated`.

### Task 26: Full suites on PostgreSQL, and report

- [ ] `vendor/bin/pint --format agent`; `vendor/bin/sail composer types:check`; `vendor/bin/sail composer rector:check`.
- [ ] `bin/test-db pgsql` — Expected: `test-db pgsql: PASS`.
- [ ] `bin/test-db pgsql --concurrency` — Expected: PASS.
- [ ] SQLite, MariaDB and MySQL are **not** run here (owner, 2026-10-03): the roadmap's final four-engine matrix, after plans 24 and 25 are merged into `roadmap`, runs them once for every plan. The report says so.
- [ ] `bin/check-pg-upgrade` — Expected: PASS.
- [ ] `npm run test`, `npm run types:check`, `npm run check`, `npm run build:front` — Expected: PASS.
- [ ] Report `docs/superpowers/research/plan-26-report.md` (asked for by this plan): rule S-1 restated in one paragraph with its accepted risk and the tests that hold it (criterion 21), so the owner reads it again; the points ruled while revising (spec §16, items 8 to 10: "Profile photos" off by default and independent, S-1 stopping at the account settings, its consequences beyond the three the owner was told), restated so the owner can overturn them; per acceptance criterion of spec §12, the test that proves it (PostgreSQL; criterion 20's other engines are left to the roadmap's final matrix); the differences left with each mockup; every existing test edited and why; the outcome of the Tailwind variant check (Task 8); the translation keys added outside Task 23's table; every decision taken on the owner's behalf; spec §16's open points with what was learnt.
- [ ] Commit `docs: plan 26 report`. Then the controller merges the branch into `roadmap`, runs `bin/test-db pgsql` there, and notifies the owner that plan 26 is done (report path). **No merge into `main`, no push.**

---

## Self-review (done while writing; kept for the reader)

**Spec coverage.** §5.1 columns: Task 1. §5.2 participant colour: Task 2. §5.3 codes table: Task 20. §5.4 presence colour: Tasks 1, 2, 4, 5. §5.5 taken colours: Tasks 3, 6. §5.6 photo: Tasks 9, 10, 11. §5.7 motion: Tasks 7, 8. §5.8 breach: Tasks 12, 17. §5.1 bis the switch "Profile photos": Tasks 10, 11. §5.9 sessions (IP, hidden card): Tasks 14, 18. §5.10 ways in, link, unlink, managed, set a password: Tasks 13, 15, 16, 17, 19. §5.11 codes: Tasks 20, 21, 22. §5.12 rule S-1: Task 13 (middleware, alias, props, tests), Task 17 (the gate), used by the routes of Tasks 14, 15, 16. §6 permissions: the route middleware of Tasks 7, 10, 12, 14, 15, 16, 21 and the tests that refuse. §7 real time: Task 2 (member data), Task 6 (static taken colours), Task 22 (regenerate). §8 screens: Tasks 5, 6, 8, 11 (profile photo and Branding switch), 17 (password card and gate), 18, 19, 22. §9 routes: Tasks 7, 10, 12, 13 (the middleware swap), 14, 15, 16, 21. §10 migrations: Tasks 1, 2, 13 (Upgrade test on PostgreSQL; the other engines in the roadmap's final matrix), 20. §11 testing: every task; races in 15, 16, 20; captures in 24. §12 criteria: 1 → 1, 2, 5; 2 → 2; 3 → 4; 4 → 9, 10; 5 → 10, 11; 6 → 7, 8; 7 → 12; 8 → 17; 4 and 5 also → 10, 11 (the switch); 9 → 14, 18; 10 → 14; 11 → 14, 18; 12 → 15, 19; 13 → 13, 16; 14 → 13, 16; 15 → 13, 17; 16 → 3, 6; 17 → 20, 22; 18 → 20, 21; 19 → 23, 24, 25; 20 → 26 (PostgreSQL) and the roadmap's final matrix (SQLite, MariaDB, MySQL); 21 (rule S-1) → 13, 17.

**Placeholders.** Back-end tasks carry their tests and code, except the four other kinds of the share-data cases of Task 20, whose snapshot route names and JSON paths must be read from each builder (the retro case is written out), and the survey and standalone-game cases of Task 2's channel test, which follow its poker case with the survey and game guest helpers. Screen tasks carry composition tables, behaviours and states, and the code of their pure logic, as plan 19 did; the mockup is the markup's specification.

**Type consistency.** `presenceColor(): int` on `User` (Task 1) and on every `HasGuestIdentity` model (Task 2) feeds `PresentJoinSession::colours` (Task 3) and the channel data read by `presenceOf` (Task 4). `AvatarUrl::for(…, ?Closure $photoPath = null)` (Task 10) keeps its three existing callers working. `SecuritySettings::protected(User $user, string $currentSessionId)` (Task 14) is called once, by `AccountSettingsController`; Tasks 13, 14 and 16 each add one key (`password`, `browserSessions`, `linkedAccounts`), read by Tasks 17, 18 and 19. `SignInMethods` (Task 13) is used by `UnlinkSocialAccount` and `LinkedAccounts` (Task 16). `RequirePasswordUnlessNoneKnown` and `PasswordConfirmation::isNotNeeded/isSatisfied` (Task 13) are used by the routes of Tasks 14, 15 and 16 (which run after 13 in the lane) and by `AccountSettingsController`; `profile.needsPasswordConfirmation` (Task 13) is read by the gate in Task 17. `InstanceSettings::profilePhotos()` (Task 10) is read by `AvatarUrl`, `ProfilePhotoRequest` and `AccountSettingsController::profile()` (`photosAllowed`), and its Branding props by Task 11. `security.protected.browserSessions` is a row list or null (Task 14), read by Task 18. `SocialAccountRefused` is created in Task 15 and used in Task 16. `JoinCodes::for/rotate/resolve` (Task 20) are used by Task 21 and by the snapshots that Task 22 reads as `joinCode`.

**Review Focus.** Each line has its test: SSO callback intents (Task 15, the dataset "none / someone else / another provider"), Exif sent past the browser (Tasks 9, 10), the last way in and two unlinks (Task 16, with `Race`), codes as typed and look-alikes (Tasks 20, 21), a remembered device signed out (Task 14, the remember token), rule S-1 both ways (Task 13, the S-1 cases of `PasswordConfirmationGuardTest`), the IP of the user's own sessions only (Task 14).

**Revision of 2026-10-03 (owner's answers).** Decisions 1, 2, 3 and 4 differ from the draft: Tasks 10, 11 (switch), 13 (S-1), 14, 15, 17, 18, 19 rewritten; no task added or removed (26). Decisions 5 to 9 were the recommended options: their tasks are unchanged. The pre-build deviations P26-13 to P26-15 are new.

**Second revision of 2026-10-03 (pre-build deviations, PostgreSQL only, execution order).** The owner approved P26-01 to P26-15 (04 and 06 as recommended, 03 with the full IP and no location): no row changes what is built, so no task changes its code; the "to approve" gates are gone and Task 25 fixes any further difference to the mockup. Every per-task run, the Upgrade test and the three races now run on PostgreSQL only; Task 26 runs the PostgreSQL suites; the four-engine matrix belongs to the roadmap's end. The plan now branches from `roadmap` and is merged into it; plan 25 runs after it (Task 13's registration note reversed) and plan 29 beside it (`PasswordConfirmation.php` shared). Spec §16 items 8 to 10 are ruled, not open. The spec path is the docs path; nothing is moved. Task count unchanged: 26.

**Known weak points of this draft.** Nothing was run. The Tailwind override of a built-in variant is unproven (Task 8 checks the build). The `Socialite::fake` behaviour for a signed-in callback and for `redirect()` was read from its use in `InvitationSsoTest`, not run. `RequirePassword` answering 423 to a JSON request is the framework's behaviour as read. Re-pointing the `password.confirm` alias with `$middleware->alias()` in `bootstrap/app.php` relies on custom aliases overriding the framework's default ones (read, not run): the S-1 cases of Task 13 over Fortify's two-factor and passkey routes prove it or fail. The backfill's 60-second rule is a heuristic, stated as such in the spec; under S-1 a wrong null also skips confirmation (spec §5.12, item 6).
