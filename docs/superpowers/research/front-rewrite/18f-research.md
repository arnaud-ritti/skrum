# Plan 18f research — cross-cutting (B11–B14, bell, shortcuts)

Read-only research on branch `plan-18d-branding` (2026-10-02). Nothing was run except `route:list`, `composer show`, greps and file reads. No test, no build. Paths are relative to `/Users/aritti/Projects/skrum`. `.ai/rules` does not exist in this repo.

Versions: laravel/framework 13.34.0, laravel/fortify 1.40.0, laravel/socialite 5.31.0, socialiteproviders/openidconnect 1.0.1, inertia-laravel 3.4.0, laravel/octane 2.20.0 (installed: no static per-request state in new services; `tests/Feature/RequestIsolationTest.php` exists), `@laravel/passkeys` ^0.2.0 (npm), `cmdk` ^1.1.1. `vendor/laravel/passkeys` is present as a Fortify dependency (not a direct one).

---

## 1. Auth today

### 1.1 Fortify configuration
- `config/fortify.php:18` guard `web`; `:48` username `email`; `:63` `lowercase_usernames` true; `:76` home `/dashboard`.
- `config/fortify.php:117-121` limiters: `login`, `two-factor`, `passkeys`.
- `config/fortify.php:163-175` features: registration, resetPasswords, emailVerification, twoFactorAuthentication (`confirm` true, `confirmPassword` true), passkeys (`confirmPassword` true).
- No `fortify.pipelines.login` key and no `Fortify::authenticateThrough` / `authenticateUsing` call: the default pipeline runs.

### 1.2 `app/Providers/FortifyServiceProvider.php`
- `:45-46` actions: `ResetUserPassword`, `CreateNewUser`.
- `:54-59` login view props: `canResetPassword`, `canRegister` (via `SignupGate::canShowRegistration`), `status`, `ssoProviders`.
- `:87` two-factor challenge view `auth/two-factor-challenge`; `:89` confirm-password view.
- `:102` limiter `two-factor`: 5/min keyed by session `login.id`.
- `:104-108` limiter `login`: 5/min keyed by `transliterate(lower(email))|ip`.
- `:110-112` limiter `passkeys`: 10/min keyed by `credential.id` or session id, plus IP.

### 1.3 Password login → two-factor challenge (vendor, Fortify 1.40.0)
- Pipeline: `vendor/laravel/fortify/src/Http/Controllers/AuthenticatedSessionController.php:85-91` = `CanonicalizeUsername` → `RedirectsIfTwoFactorAuthenticatable` (contract, resolved from the container) → `AttemptToAuthenticate` → `PrepareAuthenticatedSession`. `EnsureLoginIsNotThrottled` is skipped because a limiter is configured (`:86`); the throttle is route middleware (`vendor/laravel/fortify/routes/routes.php:42-46`).
- `RedirectIfTwoFactorAuthenticatable::handle` (`.../Actions/RedirectIfTwoFactorAuthenticatable.php:51-71`): challenges **only** when `two_factor_secret` is set and (because `confirm` is on) `two_factor_confirmed_at` is not null. Credentials are checked inside a 200 ms `Timebox` (`:93-105`).
- Challenge state (`:147-158`): session keys `login.id` and `login.remember`; redirect to `two-factor.login`. The user is **not** authenticated yet.
- Challenge submit: `.../TwoFactorAuthenticatedSessionController.php:56-75`. Recovery code or `hasValidCode()`, then `guard->login($user, remember)`, `session()->regenerate()`.
- `TwoFactorLoginRequest::hasValidCode` (`.../Http/Requests/TwoFactorLoginRequest.php:56-65`) decrypts `two_factor_secret` and calls `TwoFactorAuthenticationProvider::verify($secret, $code)`. It has no user context and assumes a TOTP secret exists.
- `PrepareAuthenticatedSession` (`.../Actions/PrepareAuthenticatedSession.php:34-43`): session regenerate + limiter clear.
- Responses redirect with `redirect()->intended(...)` (`LoginResponse.php:20`, `TwoFactorLoginResponse.php:21`).

### 1.4 `users` columns
- `two_factor_secret` (text), `two_factor_recovery_codes` (text), `two_factor_confirmed_at` (timestamp): `database/migrations/2025_08_14_170933_add_two_factor_columns_to_users_table.php:15-17`.
- `email_verified_at` (`0001_01_01_000000_create_users_table.php:18`), `locale` (5 chars), `is_instance_admin`, `avatar_style`, `action_item_reminders_by_email`, `action_item_reminders_in_app` (`app/Models/User.php:26-42`).
- `User` implements `MustVerifyEmail`, `PasskeyUser`, `HasLocalePreference`; traits `TwoFactorAuthenticatable`, `PasskeyAuthenticatable`, `Notifiable`, `HasApiTokens` (`app/Models/User.php:46-56`). Primary key is a UUID.
- There is **no** column for an e-mail second factor and no table for login tokens or codes.

### 1.5 Passkeys
- Routes (Fortify registers them, `vendor/laravel/fortify/routes/routes.php:180-217`): `GET passkeys/login/options`, `POST passkeys/login` (guest + throttle), `GET/POST passkeys/confirm` (auth), `GET user/passkeys/options`, `POST user/passkeys`, `DELETE user/passkeys/{passkey}` (auth + `password.confirm`).
- Sign-in: `vendor/laravel/passkeys/src/Http/Controllers/PasskeyLoginController.php:43-67` verifies the assertion, calls `Passkeys::allowsLogin`, then `guard->login($passkey->user, remember)` and `session()->regenerate()`. **A passkey login never goes through the two-factor challenge.** `Passkeys::authorizeLoginUsing` is not set by the app (only `Passkeys::usePasskeyModel` at `app/Providers/AppServiceProvider.php:77`).
- Front: `resources/js/pages/auth/login.tsx:13,37` (`PasskeyVerify`), `resources/js/pages/auth/confirm-password.tsx:11-27` (confirm with a passkey).

### 1.6 SSO
- Providers: `app/Enums/SsoProvider.php:13-16` (Google, GitHub, Entra, generic OIDC); enabled when their config keys are filled (`:71-80`, `:104-112`).
- Callback: `app/Http/Controllers/SsoCallbacksController.php:19-61`. User resolved by `ResolveSsoUser`; then `:47-54` puts `login.id` / `login.remember=false` and redirects to `two-factor.login` if `hasConfirmedTwoFactor` (`:63-74`, TOTP columns only); else `Auth::login`, `session()->regenerate()`, `redirect()->intended(route('dashboard'))` (`:56-60`).
- `ResolveSsoUser` (`app/Actions/Auth/ResolveSsoUser.php`): linked account wins (`:30-37`); an existing user is linked only if the provider e-mail is verified **and** the local one is verified (`:48-54`); a new user needs a verified e-mail or a matching pending invitation (`:56-60`) and must pass `SignupGate::allows` (`:62-64`).
- SSO-created users get `Str::password(64)` (`:92`) and `email_verified_at = now()` (`:97`). They do not know that password: known limitation. Consequence: `settings/security` is behind `RequirePassword` (`routes/settings.php:21-23`), so an SSO-only user can open Security only by confirming with a passkey, or after a password reset.
- **"SSO forced" does not exist.** No such key in `config/skrum.php`, `app/Support/InstanceSettings.php` or `.env.example` (grep for `sso` returned nothing in those three). The password form is always rendered.

### 1.7 Signup modes and verification
- `app/Enums/SignupMode.php:7-9` Open / Invite / Domain; default Invite (`config/skrum.php:8`).
- `SignupGate::allows` (`app/Actions/Auth/SignupGate.php:12-27`): first user, or matching pending invitation, or mode rule. `canShowRegistration` (`:29-40`).
- `CreateNewUser` (`app/Actions/Fortify/CreateNewUser.php:24-61`): gate check, first user becomes instance admin, invitation acceptance marks the e-mail verified.
- E-mail verification: Fortify feature on; app routes are under `['auth','verified']` (`routes/web.php:211`, `routes/settings.php:18`).
- No `AuthenticateSession` middleware and no `logoutOtherDevices` call anywhere (grep on `app bootstrap config routes` empty): a password change does not end other sessions today.
- Sessions, cache and queue are database-backed by default (`.env.example:33,41,43`); mailer default is `log` (`.env.example:53`, `config/mail.php:17`).

### 1.8 Where a magic-link login must enter
There is no single "complete login" function today: the same tail is written twice (Fortify pipeline, and `SsoCallbacksController.php:47-60`). Magic link would be a third copy. Recommended:
1. Extract an action (for example `App\Actions\Auth\CompleteLogin`) that takes a resolved `User` and a `remember` flag and does exactly what the SSO callback does: if the user has any second factor → put `login.id` + `login.remember` in the session and redirect to `two-factor.login`; else `Auth::login`, `session()->regenerate()`, `redirect()->intended(route('dashboard'))`. SSO callback is refactored onto it first, with no behaviour change (existing `tests/Feature/Auth/SsoLoginTest.php`, `TwoFactorChallengeTest.php` as guard).
2. The magic-link consume controller calls that action after the token is consumed. This gives: 2FA challenge (`login.id`), session regeneration, intended URL, and the `verified` middleware still applies on the next request.
3. Signup gates: magic link is **login only** (lookup of an existing user). It must not create accounts, so `SignupGate` is not involved; state this as a rule.
4. E-mail verification: a consumed link proves the mailbox. Whether it sets `email_verified_at` for an unverified user is a product decision (D6); if not, the user lands on `verification.notice`.
5. Throttling is not inherited from Fortify: the new routes need their own limiters.

### 1.9 Where an e-mail-code second factor plugs in
- `TwoFactorAuthenticationProvider` (`vendor/laravel/fortify/src/Contracts/TwoFactorAuthenticationProvider.php`) is **not** a usable extension point: `verify($secret, $code)` receives a TOTP secret and no user.
- Three places decide "does this user have a second factor", all TOTP-only today:
  a. Fortify password pipeline → bind the contract `Laravel\Fortify\Contracts\RedirectsIfTwoFactorAuthenticatable` to an app subclass that also returns the challenge response when the e-mail factor is enabled (the pipeline resolves the contract: `AuthenticatedSessionController.php:88`). Alternative: `Fortify::authenticateThrough`. Not verified by running; the binding is read from the source only.
  b. `SsoCallbacksController::hasConfirmedTwoFactor` (`:63-74`) → replaced by the shared action of 1.8.
  c. The new magic-link consume.
  Missing one of the three is a full 2FA bypass for e-mail-code-only users.
- Challenge: keep Fortify's `POST two-factor-challenge` for TOTP and recovery codes untouched; add app routes (guest, same `login.id` session contract) `POST two-factor-challenge/email-code` (send / resend) and `POST two-factor-challenge/email` (verify). The verify controller ends like `TwoFactorAuthenticatedSessionController.php:68-74` (`login`, `regenerate`, forget `login.id`). `two-factor.login` view gets props: which factors the challenged user has. Note `TwoFactorLoginRequest::hasValidCode` would call `decrypt(null)` for a user without TOTP; the page must not post an e-mail code to Fortify's route (behaviour of `decrypt(null)` not verified).
- Storage proposal: `users.two_factor_email_enabled_at` (nullable timestamp) + table `email_two_factor_codes` (`user_id`, `code_hash`, `expires_at`, `attempts`, `sent_at`, `consumed_at`).
- Recovery codes: `recoveryCodes()` reads `two_factor_recovery_codes`, generated by Fortify's enable-TOTP flow. A user with only the e-mail factor has none (D4).
- Enabling: Security page is behind `RequirePassword`; `SecurityController::edit` (`app/Http/Controllers/Settings/SecurityController.php:19-51`) already sends `twoFactorEnabled`. Enabling must confirm by a code sent to the address (same idea as Fortify's `confirm`).
- Passkey login keeps skipping every second factor (1.5). "Passkeys unchanged" in B13 means this stays.

---

## 2. Threat notes for B12 / B13

| Topic | Note |
|---|---|
| Token storage | Random ≥ 32 bytes (`Str::random(64)`), store `hash('sha256', token)` only, same pattern as `WorkspaceInvitation::hashToken` (`app/Models/WorkspaceInvitation.php:34-46`). The 6-digit code has 10^6 values: a plain SHA-256 is reversible from a database leak; use `Hash::make` or an HMAC keyed with the app key, plus the attempt counter. |
| Replay / single use | Consume with one atomic statement (`update … where consumed_at is null and expires_at > now()`, check affected rows = 1). A new request invalidates earlier unconsumed tokens of the user. Same for codes: a resend replaces the previous code and resets nothing but the code (attempts stay counted per challenge). |
| Signed link | `URL::temporarySignedRoute` (15 min) **and** the hashed token row; the signature alone is not single-use. |
| Mail scanners / prefetch | `GET` must not log in. `GET /magic-link/{token}` renders a confirmation page ("Sign in as a…@x"); a CSRF-protected `POST` consumes. `HEAD` and repeated `GET` leave the token intact. |
| Login CSRF / link planting | An attacker can request a link for their own account and send it to a victim. The confirmation page shows the account e-mail before the POST. Binding the link to the requesting browser would stop it but breaks "open on my phone" (D7). |
| Enumeration | Same HTTP status, body, flash and timing whether the address exists, is unverified, is SSO-only, is in cooldown, or mail fails. Do the work in a `Timebox` or queue everything; never return 429 only for existing addresses. Cooldown and per-e-mail throttle are keyed on the normalised address, not on the user id. |
| Throttle keys | Request: per address `sha256(lower(transliterate(email)))` and per IP, separately (an attacker rotating addresses hits the IP limit; rotating IPs hits the address limit). Consume: per IP. Code verify: existing `two-factor` limiter (5/min by `login.id`) **plus** the stored five-attempt cap, after which the code is dead and a new one must be sent. Code send: 60 s cooldown per user + a daily cap. IP comes through `TrustProxies` (`app/Http/Middleware/TrustProxies.php`, `config/skrum.php:28`). |
| Mail bombing | The 60 s cooldown and a per-address hourly cap protect a victim's mailbox. |
| Open redirect | Never put a `redirect`/`next` parameter in the link. Use `redirect()->intended()` only (server-set `url.intended`). Cross-device opens lose the intended URL; accepted. |
| Session fixation | `session()->regenerate()` after login in every path (present in SSO `:58`, Fortify, passkeys). The challenge state (`login.id`) lives in the pre-login session; regenerate again after the second factor (Fortify does: `TwoFactorAuthenticatedSessionController.php:72`). |
| Existing sessions | Untouched by a magic-link login (consistent with today: nothing ends other sessions). Outstanding links and codes must be deleted on password change, password reset, e-mail change and account deletion. |
| Same mailbox twice | Magic link + e-mail code = one factor proven twice. Accepted by spec §9; must be written on the Security screen next to the e-mail-code switch. |
| Lockout / recovery | E-mail-code-only user who loses the mailbox has no recovery path (no recovery codes, D4). TOTP user keeps recovery codes. Five wrong codes must not lock the account, only kill the code. |
| Passkeys | Passkey login skips the challenge; unchanged. A magic link is not a passkey substitute for `password.confirm`: confirmation stays password or passkey. |
| Remember-me | SSO sets `login.remember=false` (`SsoCallbacksController.php:50`). Recommend the same for magic link (no long-lived cookie from a mailbox proof) (D8). |
| Logging | Never log the token, the code, the signed URL or the full address. With `MAIL_MAILER=log` the link is written to `laravel.log`; the invitation flow even flashes the URL in that case (`WorkspaceInvitationsController.php:52-54`): do **not** copy that. Offer magic link and e-mail code only when `IntegrationAvailability::emailEnabled()` is true (`app/Support/Integrations/IntegrationAvailability.php:13-16`). Queued mail classes implement `ShouldBeEncrypted` like the existing notifications. `Referrer-Policy: no-referrer` on the confirmation page. |
| Unverified / changed e-mail | Send codes only to a verified address; an e-mail change must disable or re-confirm the e-mail factor. How `ProfileController::update` treats `email_verified_at` on change was not read. |

---

## 3. Notifications and mail today

### 3.1 Classes (`app/Notifications/`) — there are four, three of them send mail
| Class | Channel | Queue | Trigger | Recipients |
|---|---|---|---|---|
| `WorkspaceInvitationNotification` | mail | `ShouldQueue`, `ShouldBeEncrypted` | `WorkspaceInvitationsController::store` `:47-50`, on-demand `Notification::route('mail', …)`, locale of the existing user or the app | the invited address |
| `ActionItemReminderDigestNotification` | mail | queued, encrypted | `SendActionItemReminders::deliver` `:119-126` | assignee, verified, still in the team, `action_item_reminders_by_email` |
| `ActionItemReminderNotification` | database | not queued | `SendActionItemReminders::deliver` `:128-139` | same, `action_item_reminders_in_app` |
| `RetroResultsNotification` | mail | queued, encrypted, `shouldSend` re-checks phase and membership (`:35-48`) | `RetroResultsEmailsController::store` `:65` (`POST retros/{retro}/results-email`), 600 s cooldown (`:29,60-62`), 404 when mail is a non-delivering mailer (`:42`) | `RetroResultsRecipients::query` (`app/Actions/Integrations/RetroResultsRecipients.php:19-28`): verified team members, optionally participants only |

- All mails are `MailMessage` with the default Laravel Markdown theme. `app/Mail/` does not exist; `resources/views/vendor/` does not exist; `resources/views/` holds only `app.blade.php`.
- User text is Markdown-escaped by hand (`ActionItemReminderDigestNotification.php:149-154`, `app/Support/Integrations/Messages/RetroRecapMail.php:74-79`). Blade templates will need HTML escaping instead (`{{ }}`), and the Markdown escaping must go, or text shows backslashes.
- Recap content is built by `BuildRetroRecap` + `SummarizeHealthCheck` and rendered by `RetroRecapMail::build` (`:17-52`).
- Scheduled reminder: `action-items:send-reminders` (`app/Console/Commands/SendActionItemRemindersCommand.php:12-13`), daily at `skrum.action_item_reminders.time` (`routes/console.php:13-17`), idempotent through `action_item_reminders` (`SendActionItemReminders.php:102-112`). Digest covers **overdue and due-soon** (limit 20, `ActionItemReminderDigestNotification.php:20,44-57`); the README mock-up covers overdue only.
- Preferences: two booleans on `users`, edited at `settings/notifications` (`app/Http/Controllers/Settings/NotificationPreferencesController.php:13-39`). There is **no** preference for the retro recap.

### 3.2 Bell
- Routes (`routes/web.php:217-219`, group `['auth','verified']`): `GET notifications` (JSON), `POST notifications/read-all`, `PATCH notifications/{notification}` (body `read: true`).
- `NotificationsController@index` → `ListActionItemNotifications::handle` (`app/Actions/ActionItems/ListActionItemNotifications.php:26-51`): last 30, item re-read live, notifications of items the user can no longer view are **deleted** during the read, returns `{notifications[], unreadCount}`.
- Item shape (`:85-101`), mirrored by `resources/js/components/notification-bell.tsx:22-36`: `id`, `kind` (`due_soon|overdue`), `wording` (`overdue|due_today|due_tomorrow`), `readAt`, `createdAt`, `actionItem{id, content, teamName, dueOn, isOverdue, url}`.
- Shared prop `notifications.unreadCount` (`app/Http/Middleware/HandleInertiaRequests.php:74-76`); the old bell reloads `['notifications','actionItems']` on window focus (`notification-bell.tsx:45-72`).
- New panel: `resources/js/components/skrum/notifications-panel.tsx:69-83` declares `ActionItemNotification` with the same shape; other kinds are marked backlog (`:31-39`). Only lines 1-90 of the panel were read: its props and callbacks must be re-read by the plan.
- Wiring point: `resources/js/layouts/skrum/app-layout.tsx:28-31` passes `actions={<NotificationBell />}`; `AppTopbar` has `search` and `actions` slots (`resources/js/components/skrum/app-topbar.tsx:6-25`). The old `resources/js/components/app-sidebar-header.tsx` also uses the bell (deleted in 18g).

### 3.3 What the Emails README requires (`docs/design-system/components/Emails/README.md`)
- One layout, five contents; 600 px card; tables with `role="presentation"`; inline styles; **hex only** (no CSS variables, `color-mix`, OKLCH) (`:41-42`); hex table (`:55-77`).
- One bulletproof button with VML fallback (`:45`); fallback text link for the magic link.
- Dark mode: `color-scheme` metas, `@media (prefers-color-scheme: dark)`, `[data-ogsc]` / `[data-ogsb]` (`:48`).
- Unsubscribe for reminders and recaps: signed URL without login **and** `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click`; none on security mails (`:47`).
- White-label: name, logo and colour from Branding; `BrandPalette::derive($hex)->toHex()` (`:83-85`). `toHex()` exists and returns `{light, dark}` maps of token → hex (`app/Support/Branding/BrandPalette.php:100-106`); which token keys it holds was not read.
- Laravel side (`:34-37`): one queued Mailable per mail, `->locale()`, preview route in local; reminders stay a Notification so preferences apply.
- 2FA code: mono 32 px, grouped 3 + 3, code in the subject (`:95`).

Gaps between README and repo (each needs a line in the plan):
1. README speaks EN/FR and `lang/{fr,en}/mail.php`; the app has four locales (`config/skrum.php:4`) and JSON translation files (`lang/en.json` …). Follow the repo.
2. README has "team" and "workspace" invitations; only workspace invitations exist.
3. README asks for an unsubscribe link on the recap; no recap preference exists and spec B14 says recipients do not change (D9).
4. README 2FA mail shows browser, OS, city, country; geolocation is backlog (spec §10).
5. README wants a PNG logo @2x; which formats Branding accepts for logos was not checked (SVG does not render in most mail clients).
6. README offers Markdown components or MJML; MJML is a new dependency (needs approval). Plain Blade tables need none.

### 3.4 Moving to Mailables without changing triggers
`Notification::toMail()` may return a Mailable. Keep the three Notification classes, their `via`, `shouldSend`, queueing and call sites; change only `toMail` to build `App\Mail\…` and set the recipient (`$notifiable->email`, or `$notifiable->routes['mail']` for the on-demand invitation). Existing feature tests that assert `Notification::assertSentTo` keep passing; tests that assert `MailMessage` lines (if any; not checked) need rewriting. Magic link and 2FA code are new, sent as Mailables directly (`Mail::to()->queue()`), encrypted.

---

## 4. Search (B11)

- Database: PostgreSQL (`.env.example:26`). `ilike` is already used by the MCP tool `app/Mcp/Tools/Retro/SearchBoards.php:121,146,161` with `App\Mcp\Support\LikePattern::contains` / `::snippet` (`app/Mcp/Support/LikePattern.php:7,12`), min 2 / max 100 characters (`:69`), own rate limit (`:75-79`). Reuse the helper (move it to `App\Support` or call it as is).
- No trigram or full-text index exists (grep for `pg_trgm`, `tsvector`, `gin` empty). Indexes are `team_id` composites only: `retros (team_id, created_at)`, `poker_games (team_id, ended_at)`, `whiteboards (team_id, updated_at)`, `game_rooms (team_id, retro_id)`, `action_items (team_id, completed_at, due_on)`. `ILIKE '%x%'` scans the rows of the visible teams; acceptable at this size with `LIMIT 5` per kind. A `pg_trgm` extension would need database rights and approval (D10).

| Kind | Table.column | Notes |
|---|---|---|
| Retro | `retros.title` (120) | summary is searched by MCP only under four conditions (`SearchBoards.php:141-146`) |
| Poker game | `poker_games.title` (120); tasks `poker_tasks.title` (200), `description` | |
| Whiteboard | `whiteboards.title` (120) | element text lives in `whiteboard_elements` (payload not read) |
| Game room | `game_rooms.name` (60, **nullable**) | rooms attached to a retro have `retro_id`; `access` is `team` or `link` (`app/Enums/GameRoomAccess.php`) |
| Action item | `action_items.content` (500), `team_id` not null | |
| Cards | `cards.content` (text) | hidden while others write; MCP excludes them in SQL (`SearchBoards.php:171-175`). Searching card text is the main leak risk (D11) |

- Visibility rule to reuse: `TeamPolicy::view` = workspace Owner/Admin, or team member (`app/Policies/TeamPolicy.php:11-18`). Query forms that already exist: `Workspace::teamsVisibleTo` (`app/Models/Workspace.php:82-91`, one workspace), `ActionItemQuery::visibleTo` (`app/Actions/ActionItems/ActionItemQuery.php:58-67`, one workspace), `ListActionItemNotifications::viewableTeamIds` (`:59-73`, **all** workspaces of the user). No policy class exists for Retro, PokerGame, Whiteboard or GameRoom (`app/Policies/` has four files); session access is by team view plus the join middleware. Extract one `viewableTeamIds(User)` and make every search sub-query start with `whereIn('team_id', $ids)`.
- `GET /search?q=` has no workspace in the URL. Scope = current workspace or all workspaces of the user (D12).
- Result shape for the palette: `CommandPaletteItem` (`resources/js/components/ui/command.tsx:257-275`; README `Command/README.md:13`: `id, group, label, icon, meta?, shortcut?, keywords?, onSelect`). Server JSON proposal: `{ results: [{ kind: 'retro'|'poker'|'whiteboard'|'game'|'action', id, title, team: {id, name}, url, live: bool }] }`, max 5 per kind, most recent first. No HTML in `title`; highlighting is done client-side. Route names for each `url` were not looked up.
- The palette component filters its `items` locally and owns its ⌘K and `/` listeners (`command.tsx:331-354`). Server results must be merged as items after a 150 ms debounce (README `:31`), with stale-response protection.
- Throttle: named limiter in the repo style, for example `throttle:60,1,search` (`routes/web.php:289`), under `['auth','verified']`.
- Tests for authorisation: guest → redirect / 401 JSON; unverified user → blocked; member of team A never receives a title of team B of the same workspace; workspace Admin sees every team of that workspace but nothing of another workspace; a user removed from a team loses its results; `q` of 1 character → 422 or empty; `%` and `_` in `q` are literal; 61st request → 429; card text never returned (if D11 = no); a `link`-access game room of a team the user cannot view is not returned.

---

## 5. Shortcuts

### 5.1 `resources/js/hooks/use-shortcut.ts`
- `useShortcut(combo | combo[], handler, { enabled, scope, enableOnFormTags, enableInOverlays, preventDefault })` (`:106-116`). Listener on `document` `keydown` (`:191`).
- Ignores `defaultPrevented` and IME composition (`:165`), editable targets unless `enableOnFormTags` (`:19-31,169`), and any open overlay that is not the shortcut's own layer unless `enableInOverlays` (`:22-23,177-182`). `scope` is a ref: overlays containing it are its layer (`:154-162`).
- `mod` = meta or ctrl (`:85-90`); shift is strict for letters and named keys, ignored for symbols such as `?` and `+` (`:96-103`).
- No key sequences (`G` then `A`), no registry, no "disable single-letter shortcuts" switch.
- `react-hotkeys-hook` (named in the README `:71`) is not installed.

### 5.2 Shortcuts found in the code (grep `keydown`, `useShortcut`, `event.key`)
Global (document listeners):
- ⌘/Ctrl+B sidebar: `resources/js/components/ui/sidebar.tsx:31,95-103` (raw listener, fires in inputs).
- ⌘/Ctrl+K and `/` palette: `resources/js/components/ui/command.tsx:331-354` (raw listener; ⌘K fires in inputs; `/` checks only editable targets, not overlays).
- `useShortcut`: poker `mod+enter` accept, `n` next (`poker-table.tsx:676-683`), `r` reveal (`:1074`); reactions `1`–`6` (`reaction-bar.tsx:289-292`); `/` focus search in the template picker (`retro-template-picker.tsx:682`) and in the shortcuts dialog (`keyboard-shortcuts.tsx:631`); `?` only on the dev page (`pages/dev/sections/keyboard-shortcuts.tsx:181`).
Component handlers (seen by grep only; whether each is bound to a focused element or to the window was not checked one by one):
- Retro: `N` new card (`retro-column.tsx:383`), `V` vote (`retro-card.tsx:366`, `vote-dots.tsx:143`), `Enter` edit / `Delete` (`retro-card.tsx:352-359`), `T` timer and `+` add time (`timer.tsx:179-188`), arrows in `facilitator-bar.tsx:296-308`, `phase-stepper.tsx:253`.
- Digits: ROTI `1`–`5` (`roti-widget.tsx:117`), health check `0`–`9` (`health-check-form.tsx:111`), survey (`survey-question.tsx:579`), poker cards `0`–`9` (`poker-card.tsx:332`).
- Escape claimed in capture phase by `text-field.tsx:200-217`, `retro-template-picker.tsx:698-713`, `deck-editor.tsx:179-188`.
- Whiteboard: native Excalidraw (ruling 5/29); `lib/whiteboard/excalidraw.ts:93` dispatches a synthetic Escape.
- Old front (`components/retro/*`, `components/poker/game-header.tsx`, `components/action-items/*`): only Enter/Escape inside fields. No `useHotkeys` anywhere.

### 5.3 Map of `docs/design-system/components/KeyboardShortcuts/README.md` (`:11-16`)
General ⌘K, `?`, ⌘B · Retro N, ↵, Esc, V, G, F (facilitator), ⌘→ (facilitator) · Poker 0–9, `?`, C, R, ⇧R, N · Whiteboard V H N S T P C, Space+drag, ⌘Z/⇧⌘Z, ⌘+/⌘− · Reactions 1–6. The same map is already written for the dev page (`pages/dev/sections/keyboard-shortcuts.tsx:26-142`). `?` does not open the dialog in a field nor when the poker deck has focus; ⌘/ stays available (`README:57`). Mobile: not shown (`:52`). The component exists: `resources/js/components/skrum/keyboard-shortcuts.tsx` (`KeyboardShortcuts` `:610`, `KeyboardShortcutsTrigger` `:674`, `orderSections` `:160`).

### 5.4 Collisions
- Digest #21 (`docs/superpowers/research/front-rewrite/design-system-digest.md:584`): digits 1–6 vs 1–5; `N`, `R`, `T`, `C` reused across session types.
- Ruling, spec §6.5 #21: digits go to ROTI, health check or survey when their panel is active, otherwise to reactions; letter shortcuts are scoped per session type, only one type on screen at a time.
- Found in addition: (a) the palette's `/` raw listener collides with the two scoped `/` focus-search shortcuts when a dialog is open; (b) README Command says ⌘K opens "except in a field being edited", the code opens it everywhere; (c) README lists `G`, `F`, `C`, `⇧R`, `⌘→`, for which no handler was found by grep; they may be absent from the screens of 18e: list only what is wired; (d) "single-letter shortcuts can be disabled in Settings › Accessibility" (`README:60`): no such setting exists.

---

## 6. Proposal for plan 18f

### 6.1 Tasks (16)
Back end, in order, each with its Pest feature tests:
1. **Mail foundation**: `App\Mail` base class, `MailBrand` built from `InstanceSettings` + `BrandPalette::toHex()`, Blade layout (light/dark, hex only, VML button), local-only preview route. Tests: hex only (no `var(`, `oklch`, `color-mix`), brand colour applied, four locales, preview 404 outside local.
2. **Invitation Mailable** behind `WorkspaceInvitationNotification::toMail`. Tests: same trigger, same recipient, locale, user text escaped.
3. **Action reminder Mailable** behind the digest + signed one-click unsubscribe route + `List-Unsubscribe` headers. Tests: preference respected, deleted item left out, unsubscribe works logged out, tampered signature 403, more than the limit → "and n more".
4. **Retro recap Mailable** behind `RetroResultsNotification::toMail`. Tests: `shouldSend` unchanged, ROTI hidden under 3 votes, user text escaped.
5. **Login completion refactor**: one action used by the SSO callback; second-factor check in one place. No behaviour change. Tests: existing SSO and 2FA tests green, plus one per branch.
6. **Magic link back end**: table, request endpoint, confirmation GET, consume POST, Mailable, limiters, clean-up of expired rows. Tests: rules S1–S10.
7. **E-mail code back end**: column + table, enable (with confirmation code) / disable in Security, contract binding in the password pipeline, challenge send / verify / resend, Mailable. Tests: rules S11–S18.
8. **Search route** B11 with the shared `viewableTeamIds`. Tests: §4 list.
9. **Security review** of tasks 5–8 (spec §9 and §13.13) before any front work depends on them; findings fixed in the same branch.
Front end:
10. **Login**: "E-mail me a link" request, sent state with `ResendCode` (`resources/js/components/skrum/resend-code.tsx`), confirmation page; hidden when mail is not delivering.
11. **Two-factor challenge + Security**: e-mail-code mode with resend, factor choice when TOTP and e-mail are both on; Security section with the "same mailbox twice" statement.
12. **Bell**: `NotificationsPanel` in `AppTopbar` on the three existing routes; old `notification-bell.tsx` left for 18g or removed if unused.
13. **Command palette**: in the topbar `search` slot, static items (actions, go to) + debounced server results, loading and empty states.
14. **Global shortcuts + KeyboardShortcuts dialog**: one registry feeding both the handlers and the dialog; `?` and ⌘/; context section first; ⌘K, `/` and ⌘B moved to `useShortcut` or their collisions fixed; rulings #21 covered by Vitest.
15. **Translations and captures**: four `lang/*.json`, visual captures of the new screens and mails (light/dark, 1440/390, EN/FR), browser walkthrough `Plan18fCrossCuttingTest`.
16. **Verification and phase report**: every acceptance criterion, parity table, gaps (§3.3 list, shortcuts without handler).

### 6.2 Security rules (each testable)
- S1. The magic-link request returns the same status, body and session flash for an existing, unknown, unverified and cooled-down address, and sends at most one mail.
- S2. Only a SHA-256 hash of the token is stored; the plain token appears in no table, log line or flash.
- S3. A link is valid 15 minutes; after that the POST fails and no session is created.
- S4. A link works once: the second POST fails; two concurrent POSTs create one session.
- S5. `GET` and `HEAD` on the link never authenticate and never consume the token.
- S6. A new request invalidates the user's earlier links.
- S7. Second request within 60 s for the same address sends no mail; limits per address and per IP return 429 independently of whether the address exists.
- S8. A user with any second factor (TOTP or e-mail code) is sent to the challenge after the link; `Auth::check()` is false until the challenge passes.
- S9. After login the session id has changed and the redirect target is `url.intended` or the dashboard; no request parameter influences it.
- S10. Magic link never creates a user and is refused (same response) when mail does not deliver or when the "forced SSO" condition of D1 holds.
- S11. E-mail-code users are challenged on all three entries: password, SSO, magic link; a passkey login is not challenged (unchanged).
- S12. The code is 6 digits from a CSPRNG (`random_int`), stored hashed, valid 10 minutes, single use.
- S13. The fifth wrong attempt kills the code; a correct code afterwards fails; the account is not locked.
- S14. Resend within 60 s sends nothing; a resend invalidates the previous code.
- S15. Enabling the e-mail factor requires password (or passkey) confirmation and a code received at the address; disabling requires confirmation.
- S16. TOTP, recovery-code and passkey tests pass unchanged; Fortify's `POST two-factor-challenge` still rejects an e-mail code.
- S17. Password change, password reset, e-mail change and account deletion delete outstanding links and codes; an e-mail change turns the e-mail factor off until re-confirmed.
- S18. Mail jobs carrying a link or a code are encrypted on the queue; security mails carry no unsubscribe header and no tracking.
- S19. Search returns only rows whose `team_id` is in the caller's viewable teams; guests and unverified users get nothing; `q` under 2 characters returns nothing; wildcards are escaped; throttled.
- S20. The unsubscribe route accepts only a valid signature, changes only `action_item_reminders_by_email` of the signed user, and does not log anyone in.

### 6.3 Review focus — five input classes most likely to bite
1. **E-mail address variants**: case, surrounding spaces, Unicode / transliteration, plus-addressing, over-long input; lookup uses `lower(email)` elsewhere (`ResolveSsoUser.php:46`) while throttle keys use `transliterate(lower())` (`FortifyServiceProvider.php:105`): the two must agree or the cooldown is bypassed.
2. **Token and code replays and races**: double click, mail scanner GET then user POST, two tabs, expired-by-one-second, token of user A posted in a session challenged for user B, `login.id` missing or pointing to a deleted user.
3. **Search string**: `%`, `_`, backslash, 1 character, 100+ characters, only spaces, emoji, SQL fragments; and team scoping with a user in two workspaces with different roles.
4. **User text in HTML mail**: card, action, retro, workspace and inviter names containing HTML, Markdown, URLs, RTL marks and very long words, in both the HTML and the text part; subject-line header injection (newlines).
5. **Keyboard events**: IME composition, AltGr layouts where `?` or `/` need modifiers, focus inside inputs, contenteditable, Excalidraw canvas, open dialogs and menus, repeated keydown (`event.repeat`), and ⌘K while another overlay is open.

### 6.4 Decisions needed from the product owner
- D1. **"Forced SSO"** has no setting today. Options: (a) add an instance setting "sign-in methods" (password / magic link / SSO only) in Admin; (b) define it as "at least one SSO provider enabled and signup mode = invite"; (c) drop the clause for 18f and always offer magic link when mail delivers. Recommended: (c) now, (a) as backlog, because (a) is a new admin feature outside §9.
- D2. Is magic link offered to **every** user (including those with a password), or only to SSO-created users who have no usable password? Recommended: every user.
- D3. Does the e-mail code count as a second factor for **instance admins and workspace owners**, or must they use TOTP or a passkey?
- D4. E-mail-code-only users have **no recovery codes**. Accept (recovery = regain the mailbox), or generate recovery codes for them too (changes "recovery codes unchanged")?
- D5. Link lifetime 15 minutes and code lifetime 10 minutes are in the spec: confirm, and confirm daily caps (proposal: 10 links and 10 codes per user per day).
- D6. Does a consumed magic link **verify the e-mail** of an unverified account? Recommended: yes.
- D7. May a link be opened in **another browser or device** than the one that asked for it? Recommended: yes, with the confirmation page showing the account.
- D8. Remember-me after a magic link: never (as SSO today), or a checkbox at request time?
- D9. Recap mail **unsubscribe**: the README wants it, no preference exists, and B14 says recipients do not change. Add a preference `retro_recap_by_email` (default on), or send the recap with a "manage notifications" link only?
- D10. Search engine: `ILIKE` on the visible teams (no new dependency) or `pg_trgm` indexes (database extension)? Recommended: `ILIKE`.
- D11. Does search look into **card text**, poker task titles and whiteboard element text, or only session titles and action items? Recommended: titles, action items and poker task titles; no card text.
- D12. Search scope: **current workspace** or every workspace of the user? Recommended: current workspace.
- D13. Mail templating: plain Blade tables (no dependency) or MJML (new dependency, README's preferred option)?
- D14. 2FA mail "request context": browser and OS from the user agent only (no city or country, geolocation is backlog)?
- D15. SSO-only users cannot open Security without a passkey or a password reset: accept for 18f, or let a magic-link / e-mail confirmation satisfy `password.confirm`? Recommended: accept; not in scope.
- D16. Shortcuts listed by the README without a handler today (`G`, `F`, `C`, `⇧R`, `⌘→`) and the "disable single-letter shortcuts" setting: build, or list only what exists and record the gap?

### 6.5 Not verified
- Nothing was executed against Fortify: the contract binding for `RedirectsIfTwoFactorAuthenticatable` and the behaviour of `decrypt(null)` are from reading the source.
- `NotificationsPanel` props beyond line 90, `CommandPalette` body (`command.tsx:356-487`), `KeyboardShortcuts` internals.
- The token keys returned by `BrandPalette::toHex()`, the logo formats accepted by Branding, and `InstanceSettings::displayName` as mail sender name.
- `ProfileController::update` on e-mail change; `WorkspaceActionItemsController` and session `show` route names for search URLs.
- Whether component key handlers of §5.2 are element-bound or global, and which of them survive in the 18e screens (18e is not merged on this branch).
- Existing tests that assert `MailMessage` content; `tests/Feature/Auth/*` were listed, not read.
- The rate-limit key when `login.id` is absent from the session (`FortifyServiceProvider.php:102`).
