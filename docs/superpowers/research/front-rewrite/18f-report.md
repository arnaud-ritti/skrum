# Plan 18f — phase report

Branch `plan-18f-auth` (worktree `laneAuth`). Plan: `docs/superpowers/plans/2026-10-16-plan-18f-front-rewrite-auth-mail-search.md`. Gate record: `.superpowers/sdd/2026-10-16-plan-18e-front-rewrite-screens/18f-security-gate.md` (not in git). Not merged into `main`, not pushed.

State at the end: feature suite 5342 passed, 1 skipped, 0 failed; Arch 33 passed; Vitest 3557 passed in 327 files; check, build, types and Pint clean. Final security gate open, no Critical and no Important finding.

## 1. What was built, task by task

| Task | What | Commits |
|---|---|---|
| 1 | Mail foundation: branded Blade layout, `MailBrand`, local preview route | `5d25da0a` |
| 2 | Invitation mail as a branded mailable | `57de4e14` |
| 3 | Action reminder mail, signed one-click unsubscribe | `73958bca` |
| 4 | Retro recap mail | `80f596f5` |
| 5 | One second-factor decision (`SecondFactors`, `StartSecondFactorChallenge`), one address function (`LoginAddress`) | `a2b0f5e7` |
| 6 | Magic link: hashed single-use token, confirmation page, uniform answer | `fa0e3682` |
| 7 | E-mail code as a second factor on every entry | `09398a59` |
| 8 | Password and address changes revoke outstanding links and codes | `55946c2b` |
| 9 | Search route scoped to the viewable teams of the current workspace | `15705c62` |
| 10 | Instance setting `sso_required`, enforced on the server (R1–R16) | `7ec663b9` |
| 11 | Invitation through SSO: an unverified provider address is refused | `3e4f41d0` |
| 12 | Recap e-mail preference and signed unsubscribe | `c328aa22` |
| 13 | Single-key shortcuts preference (back end) | `bb942236` |
| 14 | The five mails to the letter of the mockup, PNG logo | `a58e2ee5`, `09e45c1c` |
| 15 | Bell kinds, paging, live arrival; recent sessions | `38dd9ffa`, `dbcffcc7`, `33f78121` |
| 16 | Security gate: review, fixes, scoped re-review | `bee2c566`, `17a446ac`, `582fc1e6`, `6fb8d3d0`, `1168d4ff`, `320e0893` |
| 17 | Login: magic link request, "sent" state, confirmation page | `d9180f10`, `ab8d0330`, `2f50b176` |
| 18 | Two-factor challenge and Security card: e-mail code | `ad31e103` |
| 19 | Bell and notifications panel on the notification routes | `6b8fbd47`, `683ecfa1`, `25e3d5b1` |
| 20 | Command palette with content search, recent sessions, `G A` / `G S` | `73e66283`, `89a40810`, `83daf01f` |
| 21 | Keyboard shortcuts dialog on `?` | `d19a1ece` |
| 22 | Admin › Sign-in, login and invitation pages under required SSO | `6d06dc5f` |
| 23 | SSO buttons of the invitation card (built by 18e; pinned by tests) | `4ec473bf` |
| 24 | Settings: recap row, accessibility card | `fcfce8fc` |
| 25 | `G`, `F`, `C`, `⇧R`, `⌘→`, the single-key switch | `5a202641`, `3f30b7bf` |
| RW-A1 | Account creation on the invitation card (S35) | `53c2be0d`, `8eb86579` |
| 26 | Translations checked against the plan's table; visual capture test file written | `bddabea7` |
| Review fix pass | Passkey URL type, address race, `⌘→` from a focused button, whiteboard keys, `?` on the deck | `62900fd8`, `722b33c7`, `4e013165`, `f180bf58` |
| Closing (this run) | P-4, then P-1, P-2, P-5; three Vitest files that had never run; merge of 18e; this report | `09af5c68`, `697db0fa`, `03e4024d`, `f28b2a63` (merge), this report |

Merges of `plan-18e-screens` into this branch: `3f4e5475` (retro board, workspace screens, reworks) and `f28b2a63`, which merges `159dab00` ("docs(front-rewrite): phase report of plan 18e", the closed 18e branch). Conflicts: the four lang files, merged by key (no key changed on both sides); three files 18e deleted and this branch had modified (`app-sidebar-layout.tsx`, `app-sidebar-header.tsx`, `lib/page-layouts.ts`), deleted. Consequence: the two unsubscribe pages, which took their layout from `app.tsx`, now render `AuthLayout` themselves. Task 25 left no note asking for a mount in the guest-join or action-items containers: the action items page is under `AppLayout`, which holds the dialog; the guest-join pages have no shortcut.

## 2. Security rules

Status is the one of the gate record. "test" names the Pest file; every file passed in the final run of §9.

| Rule | Status | Test |
|---|---|---|
| S1 one decision | PASS | `SecondFactorDecisionTest`, `EmailSecondFactorTest` |
| S2 passkey not challenged, refused under required SSO | PASS (read; a WebAuthn assertion cannot be forged in a test) | `ForcedSsoTest` |
| S3 GET never signs in | PASS | `MagicLinkTest` |
| S4 single use, atomic | PASS | `MagicLinkTest` |
| S5 hashed at rest, never exposed | PASS | `MagicLinkTest` |
| S6 short life | PASS | `MagicLinkTest`, `EmailSecondFactorTest` |
| S7 a new link kills the old ones | PASS | `MagicLinkTest`, `EmailSecondFactorTest` |
| S8 uniform answer | PASS (not with `QUEUE_CONNECTION=sync`, §6) | `MagicLinkTest` |
| S9 one address function | PASS | `LoginAddressTest`, `MagicLinkTest` |
| S10 throttles | PASS | `MagicLinkTest` |
| S11 login only | PASS | `MagicLinkTest` |
| S12 second factor after a link | PASS | `EmailSecondFactorTest` |
| S13 session regenerated | PASS | `MagicLinkTest`, `EmailSecondFactorTest` |
| S14 no open redirect | PASS | `MagicLinkTest` |
| S15 not offered when mail does not deliver | PASS | `MagicLinkTest` |
| S16 code quality | PASS | `EmailSecondFactorTest` |
| S17 five attempts | PASS | `EmailSecondFactorTest` |
| S18 code send limits | PASS | `EmailSecondFactorTest` |
| S19 enable and disable need proof | PASS | `EmailSecondFactorTest` |
| S20 TOTP, recovery codes, passkeys unchanged | PASS | `tests/Feature/Auth/*`, `Settings/SecurityTest` |
| S21 revocation | PASS | `LoginSecretRevocationTest` |
| S22 encrypted queue, clean security mails | PASS | `MagicLinkTest`, `tests/Feature/Mail/*` |
| S23 search authorisation | PASS | `SearchTest` |
| S24 reminder unsubscribe | PASS | `tests/Feature/Mail/*` |
| S25 user text in mail | PASS | `tests/Feature/Mail/*` |
| S26 hex only in mail | PASS | `tests/Feature/Mail/*`, `MailMockupTest` |
| S27 only SSO signs in while required | PASS (one clause failed at the first gate, I-1, fixed in `bee2c566`) | `ForcedSsoTest`, `PasswordResetRequestTest` |
| S28 the password is the admins' way back, never alone | PASS | `ForcedSsoTest` |
| S29 nobody is locked out | PASS | `ForcedSsoTest`, `Admin/SignInSettingsTest` |
| S30 invitation through SSO bound to the invited address | PASS | `InvitationSsoTest`, `ResolveSsoUserTest` |
| S31 an existing account joins as itself, after its second factor | PASS | `InvitationSsoTest` |
| S32 recap unsubscribe | PASS | `RecapUnsubscribeTest` |
| S33 the bell never accepts an invitation; the token is stored encrypted | PASS (tightened by P-1: the token is stored, never a link) | `BellNotificationsTest` |
| S34 a user's channel and list are its own | PASS (two refusals now named by a test, P-5) | `BellNotificationsTest`, `RecentSessionsTest` |
| S35 an invitation creates an account only for its own address, once | PASS | `InvitationAccountTest` |
| R1–R12, R14–R16 | PASS | `ForcedSsoTest`, `Admin/SignInSettingsTest`, `InstanceAdminsTest` |
| R13 reset link to admins only, same answer for everyone | PASS (failed at the first gate, I-1 and M-1, fixed in `bee2c566`) | `ForcedSsoTest`, `PasswordResetRequestTest` |

## 3. Gate records, in short

The full record has four sections.

1. **Task 16 gate (back end): closed, then open.** No Critical. Two Important: I-1 (under required SSO the reset request told an admin from a member) and I-2 (two red tests). Nine Minor (M-1 to M-9). The incident of that review (the development database wiped by an unquoted variable) is the reason for the literal command rule used since.
2. **Scoped re-review: gate open.** I-1, I-2, M-1, M-2, M-3, M-8, M-9 closed. Three new Minor (N-1 to N-3); N-1 and N-3 closed by `320e0893` (addresses stored and compared in one normalised form), N-2 (timing of the reset request, not measured) stays.
3. **Front pre-gate (Tasks 17–24): open.** No Critical, no Important. Six Minor. Ruling of the ledger: fix P-1, P-2, P-4, P-5; accept P-3 (the token of the page URL is also a page prop) and P-6 (`features.integrations` shared with signed-out pages).
4. **Final gate (Tasks 21, 25, RW-A1, 26 and the fixes): open.** No Critical, no Important. P-1, P-2, P-4, P-5 closed with tests. Three Minor, accepted: F-1 (the account form tells the holder of an invitation token that the address has an account), F-2 (`⌘→` at the last phase and `Delete` on a card write without a confirmation, as their buttons), F-3 (with `MAIL_MAILER=log` the inviter sees the invitation URL).**

Still open and accepted, all Minor: M-4 (the SSO identity is linked before the second factor is passed; no session opens), M-5 (the setting fails open when it cannot be read; cached 300 s), M-6 (the code is in the subject of the code mail, as the mockup asks), M-7 (integers computed by the server inside mail `style` attributes), N-2, P-3, P-6, and the Minor findings of the final gate.

## 4. Decisions taken on the owner's behalf, and how to overturn each

| Decision | Where | To overturn |
|---|---|---|
| An instance admin without a second factor has no password way in while SSO is required (R5); turning the setting on needs an acting admin who has one (R14) | `SignInPolicy::allowsPassword`, `SignInSettingsUpdateRequest` | Drop the second-factor condition in both; update the FS and SS tests that pin it |
| While SSO is required the reset link is mailed to instance admins only, and every request gets the same answer (R13) | `SendPasswordResetLink` | Remove the `allowsPasswordReset` check in the job |
| The forgot-password form answers "sent" for an unknown or throttled address too, and is limited to 10 per minute per IP (M-1) | `FortifyServiceProvider` (failed response bound to the successful one, limiter `passwordResetLinks`) | Remove the binding and the limiter |
| A challenge opened by a magic link or a password cannot be completed once SSO is required (M-2) | `login.entry`, `TwoFactorChallengeRequest` | Treat every entry like `Sso` |
| SSO refuses to link when two accounts share an address in different cases (M-3) | `ResolveSsoUser` | Take the first match again (not advised) |
| E-mail addresses are stored lower-cased; a migration lower-cases those that collide with nobody | `User` mutator, migration `2026_10_17_100000` | Not reversible by code; the report command lists what was left |
| Account creation on the invitation card: the route is limited to 10 per minute per IP (Fortify's register route has no limit) | limiter `invitationAccounts` | Change the limiter |
| "Registration by form refused for another reason" read as "the Fortify registration feature is off": the route answers 403 | `InvitationAccountsController` | Remove the `abort_unless` |
| An address that already has an account is refused on POST with the message of the register page; the card does not change state on GET (a flag on GET would tell existence before any submit) | `CreateNewUser::createForInvitation` | Needs a ruling: any refusal tells the holder of the token that an account exists |
| After creation the visitor lands on the workspace, like the acceptance route | `InvitationAccountsController` | `to_route('dashboard')` |
| The switch also silences element keys (V on the vote dots, N on a column, T and + on the timer, digits of the deck, ROTI, health check and survey), which WCAG 2.1.4 exempts | each element's `onKeyDown` | Remove the `singleKeyShortcutsEnabled()` check in those handlers |
| `⇧R` is wired in the dock as well as in the table; `F` is one handler in the discussion provider; `G` is one listener for the board; `C` pressed again takes the coffee card back; `⌘→` ends the session from the last phase without a confirmation, as the button does | `room-dock.tsx`, `phase-discussing.tsx`, `board-card.tsx`, `facilitator-dock.tsx` | Per handler |
| The whiteboard section lists Excalidraw's keys from knowledge of the library, not from its help dialog opened in a browser | `lib/shortcuts/sections.ts` | Correct the list after a look at the canvas |
| P-4: the expired page no longer tells an expired invitation from a used one (title "Invitation", one sentence for both), since the date is not sent | `invitation-card.tsx`, V32 | Send a boolean `wasUsed`, or the date again |
| P-2: a dead invitation notification is deleted when the bell is counted (one more query per page for a signed-in user), besides the three places where an invitation ends | `ForgetInvitationNotifications::forUser`, called by `BellNotifications::unreadCount` | Remove the call; the badge can then count a dead one until its page of the list is read |
| P-1: a link stored by the earlier format is read only if it is the invitation page of the host that reads it and its token is the invitation's | `PresentInvitationNotifications::tokenOfStoredLink` | Delete the method once no such row is left (none exists outside this branch) |
| Ten keys of the Task 26 table are in no lang file: the screens were built with other keys | Task 26 report | Strike them from the table |

## 5. Deviations from the mockup (V-rows)

The table of the plan is the reference; it stands at V1 to V32.

- V1–V26: as written in the plan before the front tasks (mails, link-sent state, bell, palette, dialog switch, accessibility card, SSO-required login).
- Added at execution: V27 (whiteboard keys are Excalidraw's), V28 (Reactions note reworded), V29 (General section without `⌘K` and `⌘B` in a session, `/` listed where the palette exists), V30 (`?` and `C` rows only when the deck holds the card), V31 (rows for `T`, `,`, `⌘↵`), V32 (expired invitation without date or avatar, this run).
- Not numbered, to number by the integrator: the footer reads "⌘ / at any time" while single-key shortcuts are off; a "Keyboard settings" link in the footer of the dialog in the application layouts; a status line under the search field while the switch is off.
- The comparison table of Task 26 (screen, element, mockup, application) was **not** written: it needs the captures, and no browser run was allowed.

## 6. Operator notes

- **The queue must not be `sync` in production.** With `QUEUE_CONNECTION=sync` the magic-link job and the reset-link job run inside the request: timing differs between a known and an unknown address, and a failing mail transport answers 500 for a known address (or, under required SSO, for an admin) and 302 for the others. `.env.example` and `config/queue.php` default to `database`; a worker must run.
- **Reset throttle under `route:cache`: verify once.** The limiter `passwordResetLinks` is attached to Fortify's `password.email` route in an `app->booted` callback. By reading it is serialised into the route cache; it was never run. On a deployment: `php artisan route:cache`, then `php artisan route:list --name=password.email -v` must show `throttle:passwordResetLinks`.
- **`php artisan users:report-duplicate-emails`** lists the groups of accounts whose addresses differ by case only, which the migration left untouched. Until they are merged or renamed by hand, those accounts get no magic link and no first SSO link (the ambiguous case is refused).
- **Unique index on `lower(email)`:** the follow-up named at the gate is replaced by the database portability plan (`2026-10-19-plan-database-portability.md`), which adds the stored column `users.email_key` with a plain index and makes `User::whereAddress()` compare it. Until then uniqueness without regard to case is enforced in PHP (`UniqueEmailAddress`) and by the model mutator, not by the database.
- **Raw queries:** `User::scopeWhereAddress` and `CreateWorkspaceInvitation` still use `whereRaw('lower(email) = ?')`. Both predate the rule and belong to the database plan. This run added none.
- **PHP:** 8.4; `BCRYPT_ROUNDS` is part of the timing of the reset request (N-2).
- **Mail:** a delivering mailer is required for the magic link, the e-mail code and the admins' password way back when their only factor is the e-mail code. With `log` or `array` the magic link is not offered and nothing is sent. `APP_URL` and trusted hosts must be right: mails and the invitation link are built from the request host (the bell no longer replays a stored link). Mail logo: a PNG is drawn only when the instance uploaded one mail clients can show; otherwise the display name is text.
- **Cache:** `sso_required` is cached 300 s; a cache that is not shared between nodes can serve the old value for five minutes after the switch.
- **Required SSO** closes no open session and revokes no API token.
- **Queued invitation notifications of the earlier format:** a job queued before this deployment that still carries `link` fails when it is stored. None can exist outside this branch.

## 7. What was not verified

- No browser walkthrough (owner decision): `tests/Browser/Walkthroughs` and `Smoke` were not read, run or fixed. `Plan18eAccessTest` [P18e-11-05] still binds the removed "Create an account" link; `Plan18fCrossCuttingTest` was never written.
- `tests/Browser/Visual/CrossCuttingVisualTest.php` was written and never run; no capture exists; no screen was compared with its mockup in a browser, in either theme or width.
- No live sign-in through SSO, a passkey or TOTP; the admin password path was never completed with a real code.
- Mail rendering in mail clients; the two data-backed previews in French.
- Timing: a handful of samples at the first gate, none since; the reset request was not measured (N-2).
- Translations (fr, es, de) are unreviewed beyond the table of Task 26; keys added at execution were not checked one by one. German length at 390 px was read from code only.
- `route:cache` with the reset throttle; behaviour behind a reverse proxy; a cache not shared between nodes.
- Shortcuts in a real browser: `G` (synthetic Space on the drag handle for @dnd-kit), Excalidraw's own keys, focus return after the dialog opened from the user menu. The switch does not silence Excalidraw's own single keys on the whiteboard.
- Rector was not run.

## 8. For 18g and after

- Delete `notification-bell.tsx` if it has no importer left (the old sidebar layout and its header went with the 18e merge).
- Unused translation keys: "Create an account" (if no other caller), "This invitation has expired", "Your invitation to join :workspace was valid until :date.", and the three mail keys of Task 26 Step 1.
- `ListActionItemNotifications` if `ListNotifications` left it without a caller.
- Spec text still behind the owner's third round: B33, criterion 28, criterion 30, §15 points 11 and 17. The owner's answers are what was built.

## 9. Final run

On `f28b2a63`, database `testing_l5`:

| Check | Result |
|---|---|
| Feature suite (`--parallel --processes=6 --exclude-testsuite=Browser`) | 5342 passed, 1 skipped, 0 failed, 52470 assertions |
| `tests/Arch` (what `composer test:arch` runs) | 33 passed |
| Vitest (`npm run test`) | 327 files, 3557 tests passed |
| `npm run check` | clean |
| `npx vp build` | built |
| `npm run types:check` after `wayfinder:generate --with-form` | clean |
| `vendor/bin/pint --dirty` | passed |
| Browser suites, Rector | not run |
