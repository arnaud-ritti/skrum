# Front-end Rewrite — Cross-cutting: magic link, e-mail code, mails, search, bell, shortcuts (Plan 18f) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Back-end tasks 1–15 run in sequence, one agent each, with a review after each. Task 16 is a gate: no front task starts before it is closed. Every agent reads **Owner decisions**, **Global Constraints**, **Deviations from the mockup** and **Security rules** before its task.

**Goal:** A member signs in with a link received by e-mail, can use a 6-digit e-mail code as a second factor, receives the five transactional e-mails as the mockup draws them, in the brand of the instance, and can unsubscribe from the recap; finds any session or action from ⌘K, reads notifications from the new bell, opens the keyboard shortcuts with `?`, uses `G`, `F`, `C`, `⇧R`, `⌘→` and can turn single-key shortcuts off. An instance admin can require single sign-on, and an invitation can be accepted through it without a way to take over an account.

**Architecture:** Every way to sign in (password pipeline of Fortify, SSO callback, magic link) asks one class, `SecondFactors`, whether a challenge is due, and starts it through one action, `StartSecondFactorChallenge`. A magic link is a hashed, single-use row consumed by a POST behind a confirmation page; the request path does the same work for every address and leaves the account lookup to an encrypted queued job. Mails are Blade tables under one layout whose colours come from `BrandPalette::toHex()`; the three existing notifications keep their class, trigger and recipients and only change what `toMail()` returns. Search is one JSON route scoped to the teams the user can view in the current workspace. Which ways in an instance accepts is answered by one class, `SignInPolicy`, read by the password pipeline, the magic link, registration and the password reset.

**Tech Stack:** Laravel 13.34, PHP 8.4, Fortify 1.40, Socialite 5.31, Inertia Laravel 3.4 / `@inertiajs/react` 3, Pest 5, React 19, Tailwind 4, Vitest (vite-plus), `cmdk` 1.1, PostgreSQL. Versions read with `composer show --direct` and `package.json` on 2026-10-02; re-run `composer show laravel/fortify laravel/framework inertiajs/inertia-laravel` before Task 5 and stop if a major differs.

**Spec:** `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` — row 18f of §12; B11, B12, B13, B14, B33, B34, B35 of §9 and §9.2, the security review of B31, and the two paragraphs under the table; §5; §6.3; §6.5 ruling 21; §10; §13 criteria 1, 3, 4, 13, 28, 30, 31, 32; §15 points 11, 12, 17. Owner answers: `docs/superpowers/research/front-rewrite/owner-answers-2026-10-02.md` (section "Plan 18f", line 11-D2, and the 18f lines of the second round). Design: `docs/design-system/components/Emails`, `Command`, `KeyboardShortcuts`, `NotificationsPanel`, `ScreenAuth`, `ScreenSecurity`, `ScreenUserSettings` — for each, the `README.md` **and** the `preview.html`, which is the reference a screen is compared with. Research: `18f-research.md` (scratchpad of the planning session; its findings are folded into this plan, with the corrections listed at the end).

**Not in this plan:** geolocation in the code e-mail (owner: browser and time, no location); card text of hidden cards and whiteboard element text in search; trigram indexes (D10); MJML (D13); everything the Deviations table marks `roadmap` (a scheduled start of a session and its notification, mentions, accepting or declining an invitation inside the bell, team invitations, device sessions and linked accounts); deleting the old `notification-bell.tsx` and old layouts (18g).

## Autonomous run

Unattended. Branch `plan-18f-cross-cutting` from the head of the plan 18e branch (the screens `auth/login`, `auth/two-factor-challenge`, `settings/security` and the session screens must already be on the new library). If 18e is not finished, Tasks 1–16 can run from the head of `plan-18d-branding`; Tasks 17–27 wait for 18e. No merge into `main`, no push. Every decision taken on the owner's behalf goes in the phase report.

## Owner decisions

Answered by the owner on 2026-10-02, in two rounds (`owner-answers-2026-10-02.md`). "As planned" means the answer is the default this plan already had; the others changed the plan, and the task that carries the change is named.

| # | Question | Answer (2026-10-02) | Where |
|---|---|---|---|
| D1 | "Forced SSO" has no setting. Add one, derive it, or drop the clause? | **Add it** (first round), and (third round) while it is in force **only SSO signs in**: password, magic link, passkey and form registration are refused on the server. Two ways back: instance admins sign in with password **and a second factor**; with no enabled provider the setting is ignored for everyone, with an alert to instance admins. | Tasks 10, 22; rules R1–R16; S27–S29 |
| D2 | Magic link for every user, or only for users without a usable password? | As planned: every verified account; no link to an unverified account. | Task 6 |
| D3 | Does the e-mail code count as a second factor for instance admins and workspace owners? | As planned: accepted for everyone, instance admins included. | Tasks 7, 18 |
| D4 | E-mail-code-only users have no recovery codes. | As planned: none. Recovery is regaining the mailbox; stated on the Security card. | Tasks 7, 18 |
| D5 | Lifetimes and caps. | Confirmed (second round): link 15 min, code 10 min, 60 s cooldown, 5 per hour per address. The code cap of this plan was 10 per day: it becomes **5 per hour** per user and purpose (spec B13). Link: 10 per minute per IP. Code: 5 attempts. | Tasks 6, 7; S10, S18 |
| D6 | Does a consumed link verify an unverified e-mail address? | As planned (first round, "no link to an unverified account"): no. | Task 6; S11 |
| D7 | May the link be opened in another browser or device? | Confirmed (second round): allowed. The link signs in the device that opens it, after the confirmation page. | Task 6; S3 |
| D8 | Remember-me after a magic link. | Confirmed (second round): a normal session, no long-lived cookie. | Tasks 5, 6 |
| D9 | Recap e-mail unsubscribe. | **Yes**: user preference `recap_emails` and a signed one-click link (spec B34). | Tasks 12, 24; S32 |
| D10 | `ILIKE` or `pg_trgm`? | As planned: `ILIKE`. | Task 9 |
| D11 | What does search read? | **Titles and card text**: Task 9 adds revealed card text with the visibility filter of `SearchBoards::messages` (hidden cards excluded in SQL), and its tests. | Task 9; S23 |
| D12 | Search scope. | As planned: the current workspace. | Task 9 |
| D13 | Mail templating. | As planned: plain Blade. | Tasks 1–4, 6, 7, 14 |
| D14 | Request context in the code e-mail. | Confirmed (second round): the browser and the time of the request, no location. The time was not in the plan: Task 14 adds it. | Tasks 7, 14 |
| D15 | SSO-only users cannot open Security without a passkey or a password reset. | Not asked again; unchanged: accepted, recorded in the report. While single sign-on is required, the reset link goes to instance admins only (R13). | Report |
| D16 | Shortcuts without a handler (`G`, `F`, `C`, `⇧R`, `⌘→`) and the "disable single-letter shortcuts" setting. | **Build them** (spec B35): this plan builds the five handlers and mounts them in the session containers 18e wrote, with the registry, the preference and the dialog. | Tasks 13, 24, 25 |
| 11-D2 | SSO buttons on the invitation page. | **Yes**; accepting an invitation through SSO is authentication work, under this plan's security rules. Third round: an address the provider does not mark verified is refused **even with a matching invitation** — a change of `ResolveSsoUser`, owned by this plan. | Tasks 11, 23; S30, S31 |

Standing rule of the owner, same day: **the mockup must be faithfully respected.** See Global Constraints and the Deviations table.

The three points the second version of this plan left to the security gate were answered by the owner in the third round:

| # | Point | Answer (third round) | Where |
|---|---|---|---|
| D17 | The way back when `sso_required` locks people out | **Both**: instance admins always sign in with password and second factor; and with no enabled provider the setting is ignored for everyone, with an alert shown to instance admins. | Task 10, R2, R4–R9 |
| D18 | Passkey while `sso_required` is in force | **Refused**, for everyone: only SSO signs in. | Task 10, R10; S2 amended |
| D19 | An unverified provider address that matches a pending invitation | **Refused**, even with a matching invitation (it created a verified account before). | Task 11, S30 |

Also from the third round: the invitation notification of the bell links to the existing invitation page, and no route accepts an invitation without its token (Task 15, S33); a mockup element that has no data in the product is left out of the rewrite, listed as a deviation, and becomes a feature of its own afterwards (`docs/superpowers/research/front-rewrite/feature-roadmap.md`).

## File structure

Back end, created:

| File | Responsibility |
|---|---|
| `app/Support/Mail/MailBrand.php` | Name, logo, colours (hex, both themes), "powered by" for mails |
| `app/Mail/BrandedMail.php` | Abstract Mailable: brand data, recipient from a notifiable |
| `app/Mail/{WorkspaceInvitationMail,ActionItemReminderMail,RetroResultsMail,MagicLinkMail,TwoFactorCodeMail}.php` | One Mailable per mail |
| `resources/views/mail/layout.blade.php`, `mail/partials/{button,dark}.blade.php`, `mail/*.blade.php`, `mail/text/*.blade.php` | HTML and text parts |
| `app/Http/Controllers/MailPreviewsController.php` | Local-only preview |
| `app/Http/Controllers/ReminderUnsubscribesController.php` | Signed unsubscribe (page + one-click) |
| `app/Support/Auth/LoginAddress.php` | The one address normaliser, throttle key and mask |
| `app/Enums/SecondFactorMethod.php`, `app/Enums/EmailCodePurpose.php` | `Totp`, `EmailCode`; `Login`, `Enable` |
| `app/Support/Auth/SecondFactors.php` | The one answer to "which second factors does this user have" |
| `app/Actions/Auth/StartSecondFactorChallenge.php` | The one place that opens a challenge |
| `app/Actions/Auth/CompleteLogin.php` | Tail of SSO and magic-link sign-in |
| `app/Actions/Auth/RedirectIfSecondFactorRequired.php` | Fortify pipeline step, bound to Fortify's contract |
| `app/Models/MagicLink.php`, `app/Actions/Auth/{IssueMagicLink,ConsumeMagicLink}.php`, `app/Jobs/Auth/SendMagicLink.php` | Magic link |
| `app/Http/Controllers/{MagicLinksController,MagicLinkSessionsController}.php`, `app/Http/Requests/Auth/MagicLinkRequest.php` | Request, confirmation page, consume |
| `app/Models/EmailTwoFactorCode.php`, `app/Actions/Auth/{SendEmailTwoFactorCode,VerifyEmailTwoFactorCode}.php`, `app/Support/Auth/UserAgentSummary.php` | E-mail code |
| `app/Http/Requests/Auth/{TwoFactorChallengeRequest,EmailCodeChallengeRequest}.php` | Challenge requests |
| `app/Http/Controllers/{EmailChallengeCodesController,EmailCodeChallengesController}.php` | Send and verify at the challenge |
| `app/Http/Controllers/Settings/{EmailSecondFactorsController,EmailSecondFactorCodesController}.php`, `app/Http/Requests/Settings/EmailSecondFactorRequest.php` | Enable and disable |
| `app/Actions/Auth/RevokeLoginSecrets.php` | Deletes links and codes on credential changes |
| `app/Support/LikePattern.php` (moved from `app/Mcp/Support`) | `ILIKE` escaping |
| `app/Actions/Search/SearchWorkspaceContent.php`, `app/Http/Controllers/SearchResultsController.php`, `app/Http/Requests/SearchRequest.php` | Search |
| `app/Support/Auth/SignInPolicy.php` | The one answer to "which ways in does this instance accept" |
| `app/Http/Controllers/Admin/SignInSettingsController.php`, `app/Http/Requests/Admin/SignInSettingsUpdateRequest.php` | Admin › Sign-in |
| `app/Http/Controllers/RecapUnsubscribesController.php` | Signed unsubscribe of the recap (page + one-click) |
| `app/Http/Controllers/Settings/ShortcutPreferencesController.php` | Single-key shortcuts preference |
| `bin/render-mail-logo.mjs`, `public/brand/skrum-logo-mail-{light,dark}.png`, `resources/views/mail/partials/{avatar,stat}.blade.php` | PNG logo and the blocks of the mail mockup |
| `app/Actions/Notifications/ListNotifications.php`, `app/Notifications/WorkspaceInvitationReceivedNotification.php`, `app/Events/NotificationReceived.php` | Bell: kinds, paging, live arrival |
| `app/Actions/Search/ListRecentSessions.php`, `app/Http/Controllers/RecentSessionsController.php` | "Recent sessions" of the palette |

Back end, migrations added: `add_recap_emails_to_users_table`, `add_single_key_shortcuts_to_users_table` (with those of Tasks 6 and 7).

Front end, created: `resources/js/pages/auth/{magic-link,reminder-unsubscribe}.tsx`; `resources/js/components/auth/{magic-link-request,email-code-challenge}.tsx`; `resources/js/components/settings/email-second-factor-card.tsx`; `resources/js/components/action-items/notifications-menu.tsx`; `resources/js/components/workspaces/command-menu.tsx`; `resources/js/hooks/{use-seconds-left,use-notifications,use-global-search,use-global-shortcuts}.ts`; `resources/js/lib/shortcuts/sections.ts`; `resources/js/pages/admin/sign-in.tsx`, `resources/js/pages/auth/recap-unsubscribe.tsx`; `resources/js/components/admin/sign-in-settings-form.tsx`; `resources/js/components/settings/appearance/shortcut-preference-card.tsx`; `resources/js/lib/shortcuts/preference.ts`; `resources/js/hooks/{use-single-key-shortcuts,use-recent-sessions,use-shortcut-sequence}.ts`; each with its `.test.ts(x)`.

## Global Constraints

- PHP tests run through Sail: `vendor/bin/sail artisan test --parallel --processes=8 --compact`, or a file path / `--filter` with `vendor/bin/sail artisan test --compact`. Never `--tia`.
- npm runs on the host. Front build is `npm run build:front` (build + `wayfinder:generate --with-form`); run it after every task that adds a route used by the front. Vitest: `npm run test`. Types: `npm run types:check`. Lint: `npm run check`.
- Browser suite: `bin/test-browser` (needs built assets and the Sail database). It refuses `--filter` with shards: run one file with `vendor/bin/sail artisan test --compact tests/Browser/...`. Never use port 8097.
- No new dependency, PHP or JS, without the owner's approval. Mails are plain Blade; search is `ILIKE`.
- The Pest browser suite is a contract: `data-test`, `data-realtime`, `data-presence-id`, element ids and English accessible names are kept. A browser test changes only when a mockup imposes another label or flow, in the commit of that screen, and the change is listed in the report.
- No merge into `main`, no push.
- Primary and foreign keys are UUIDs (`tests/Feature/UuidPrimaryKeysTest.php`). Migrations have an `up` method only. Create files with `vendor/bin/sail artisan make:… --no-interaction`.
- Controllers: plural name, CRUD method names only (`tests/Arch/ArchTest.php`, Laravel preset). Route names camelCase, URLs kebab-case, tuple notation. Form Requests with array rules.
- Arch preset facts that shape this plan: every class under `App\Mail` extends `Mailable` **and** implements `ShouldQueue`; `App\Http` is used only by `App\Http` and `App\Providers`; `App\Support` and `App\Jobs` do not use `App\Http` or `App\Mcp`; `App\Actions` do not use `App\Http`; no class is `final`; `env()` only in config files.
- PHP style: early returns, no `else`, happy path last, typed everything, PascalCase constants, no comment that restates code, `vendor/bin/pint --dirty --format agent` before each commit, Rector-clean.
- Octane is installed: no static or singleton per-request state in new classes (`tests/Feature/RequestIsolationTest.php`).
- The test environment has `MAIL_MAILER=array`, which `IntegrationAvailability::emailEnabled()` treats as non-delivering: mail tests set `config(['mail.default' => 'smtp'])` and call `Mail::fake()`. `QUEUE_CONNECTION=sync`, `CACHE_STORE=array`, `SESSION_DRIVER=array`.
- Translations: `en`, `fr`, `es`, `de` JSON files stay complete; the literal call shape `t('…')` / `__('…')` is kept (`tests/Feature/TranslationKeysTest.php`). Task 1 makes that test scan `resources/views` too.
- Front rules of spec §5 apply to every front file: tokens only, rem, no arbitrary size, `truncate`, focus ring, lucide, presentational `skrum/` components, no `sk-*`. Containers live in `resources/js/components/<domain>/`; no new base folder.
- One commit per task. Commit messages follow the repository style (`feat(auth): …`, `feat(mail): …`, `test: …`).
- **The mockup is respected faithfully** (owner, 2026-10-02). An explicit answer of the owner in `owner-answers-2026-10-02.md` stands as written. Everything else follows the mockups and READMEs of `docs/design-system/` exactly: layout, placement, labels, states. Each front task, and each mail, ends with its screen open beside its `preview.html`, in both themes, at 1440 and 390: every difference is fixed, or is a line of the **Deviations from the mockup** table below. A browser test that contradicts the mockup changes, in the commit of that screen, and the task lists it. Reading given by the owner in the third round: the rewrite builds each screen with what the server already holds; a mockup element whose data or feature the product does not have is left out, its place kept free, and listed in the Deviations table with the reason `roadmap` and its line of `feature-roadmap.md` — it becomes a feature with its own spec and plan after the rewrite. (Tasks 14 and 15 stay in this plan: their data is already on the server — votes, action items, invitations, sessions — or was explicitly kept by the owner's answers on the bell.) Besides `roadmap`, a deviation is allowed only for something false or unsafe, for an accessibility rule, or by an explicit answer of the owner. A deviation found at execution is added to the table, with its reason, in the commit that makes it, and listed in the phase report; one that fits none of the three reasons stops the task.
- Every new translation key is given in the four languages: the table of Task 26 holds the French, Spanish and German of each key this plan introduces; in `en.json` the value is the key.

## Deviations from the mockup

The only places where a screen or a mail of this plan differs from its mockup, and why. Reason is one of: **owner** (an explicit answer), **false** (the mockup states something untrue for this product), **unsafe**, **a11y**, **roadmap** (the element needs data or a feature the product does not have; the owner wants it built after the rewrite, and it is listed in `docs/superpowers/research/front-rewrite/feature-roadmap.md` — approved for later, not an unapproved deviation), **backlog** (not requested by the owner: spec §10). Anything not listed here matches the mockup. Where a roadmap element is left out, the screen keeps its place free, so that the feature is added later without a new layout (owner, third round).

| # | Mockup | Element | What is built instead | Reason |
|---|---|---|---|---|
| V1 | Emails · 2FA code | "Strasbourg, France" in the request context | Browser, system and time; no city, no country | owner (second round: "browser and time, no location") |
| V2 | Emails · 2FA code | "Enter this code to finish signing in." | "Enter this code to continue." — the same mail carries the code that turns the factor on in Security, where "finish signing in" is untrue | false |
| V3 | Emails · Invitation | Team invitation (`kind: 'team'`), team tile with its colour, "11 members" of a team | Workspace invitation only, with the workspace block (name, teams, members), which the mockup describes as its second variant | roadmap (Invitations: team invitations) |
| V4 | Emails · Invitation | The inviter's quoted message | Not rendered | roadmap (Invitations: inviter's message) |
| V5 | Emails · Invitation | "Join with your company SSO or create an account in a minute." | The half that is true for the instance (Task 14) | false |
| V6 | Emails · Reminder | "Sent on Mondays and the day after a due date." | Left out of the reason line | false (reminders go out daily at the configured time, for items due soon and overdue) |
| V7 | Emails · Reminder | Overdue items only | A second list, "Due soon", in the same row style | owner goal 2 (feature parity) and B14: the existing reminder covers both, and its triggers do not change |
| V8 | Emails · Recap | "because you took part in this retro" | "…or belong to its team" | false (the recap can be sent to the whole team) |
| V9 | Emails · Recap | Only stats, actions and ROTI | The same, followed by the summary, suggested actions, top card per column and health-check line the product already sends | B14 (content of an existing mail is kept); nothing of the mockup is removed |
| V10 | Emails · all | Two languages, `lang/{fr,en}/mail.php` | Four languages through the JSON files | the product has four languages (spec §5) |
| V11 | Emails · header | PNG logo always | The display name as text when the instance has a logo mail clients cannot draw (SVG, WebP) and no mail logo was uploaded; the Branding page says so | false otherwise (the Skrüm logo on a rebranded instance) |
| V12 | ScreenAuth · link sent | "Nous avons envoyé un lien de connexion à …" | "If an account exists for …, a sign-in link is on its way." | unsafe (S8: the answer must not say whether the address has an account) |
| V13 | ScreenAuth · link sent | "Ouvrir ma messagerie" | Not rendered | false (the application cannot know or open the visitor's mailbox) |
| V14 | NotificationsPanel | "starts in 5 min" notification and its "Join" | Not produced | roadmap (Sessions: scheduling and the "starts in 5 min" notification) |
| V15 | NotificationsPanel | Mention notification | Not produced | roadmap (Mentions and their notifications) |
| V16 | NotificationsPanel | "Accept" and "Decline" inside the invitation item | One action, "View invitation", to the invitation page | owner (third round: the notification links to the existing invitation page, no token-less accept); "Decline" is roadmap (Invitations) |
| V17 | NotificationsPanel | "invited you to join team Atlas" | "invited you to join :workspace" | roadmap (V3) |
| V18 | Command | `⌘N`, `⌘P` beside "New retro", "New poker session" | The two actions, without a shortcut | false (the browser keeps ⌘N and ⌘P: new window, print; a page cannot take them) |
| V19 | Command | "Inviter dans l'équipe Atlas" | "Invite to :workspace", shown to those who may invite | roadmap (V3) |
| V20 | KeyboardShortcuts | No control in the dialog | A "Single-key shortcuts" switch in the dialog footer of a session | a11y (WCAG 2.1.4: a guest has no settings page and must be able to turn them off) |
| V21 | KeyboardShortcuts | Whiteboard keys `H`, `N`, `S`, `P`, `C` | The keys Excalidraw answers to | false (spec rulings 5 and 29: the whiteboard keeps Excalidraw's own shortcuts) |
| V22 | ScreenUserSettings | "Réglages › Accessibilité" as a page | A card "Accessibility" on the Appearance page | spec §15 point 12 |
| V23 | ScreenSecurity | Active sessions, linked accounts | Not rendered (18e) | roadmap (Account: active sessions, linked accounts) |
| V24 | ScreenAuth | With SSO forced, "le formulaire e-mail disparaît" | The form is folded under "Administrator sign-in", for every visitor | owner (third round: instance admins sign in with password and second factor) and unsafe otherwise (showing it to admins only would need to know who is asking) |

The two-factor challenge in e-mail mode and the e-mail card of Security have no mockup: they are composed from the library components the Security mockup uses (`InputOTP` 3 + 3, the badge "On" / "Off", the destructive outline button), in the anatomy of its TOTP block.

## Security rules

Every task and every review holds these. Test names are in `tests/Feature/Auth/MagicLinkTest.php` (ML), `EmailSecondFactorTest.php` (EC), `SecondFactorDecisionTest.php` (SF), `LoginAddressTest.php` (LA), `LoginSecretRevocationTest.php` (RV), `ForcedSsoTest.php` (FS), `InvitationSsoTest.php` (IS), `tests/Feature/Admin/SignInSettingsTest.php` (SS), `tests/Feature/SearchTest.php` (SR), `tests/Feature/RecentSessionsTest.php` (RS), `tests/Feature/Notifications/BellNotificationsTest.php` (BN), `tests/Feature/Mail/*` (MAIL), `MailMockupTest.php` (MM), `RecapUnsubscribeTest.php` (RU).

| # | Rule | Proved by |
|---|---|---|
| S1 | **One decision.** Whether a user must pass a second factor is answered only by `SecondFactors::requiredFor()`, and a challenge is opened only by `StartSecondFactorChallenge`. The Fortify pipeline (`RedirectIfSecondFactorRequired`, bound to Fortify's contract), `CompleteLogin` (SSO and magic link) call them. No other file reads `two_factor_secret`, `two_factor_confirmed_at` or `two_factor_email_enabled_at` to decide a challenge. | SF `binds the pipeline step of Fortify to the shared decision`, EC `challenges on every entry` (dataset: password, SSO, magic link × TOTP, e-mail code), SF `lets no other file decide whether a challenge is due` (source scan) |
| S2 | **A passkey sign-in is not challenged** (unchanged; a passkey is itself strong authentication). `Passkeys::authorizeLoginUsing` is set to one callback, the one of R10, which looks at the instance setting and at nothing else: it refuses every passkey while single sign-on is required and decides nothing about a second factor. | FS `refuses a passkey for everyone while the setting is in force`; review gate (Task 16) reads `vendor/laravel/passkeys/src/Http/Controllers/PasskeyLoginController.php` and greps the app for a second callback; a WebAuthn assertion cannot be forged in a feature test |
| S3 | **GET never signs in.** `GET` and `HEAD` on a link render a confirmation page and leave the row untouched; only the CSRF-protected `POST` consumes. | ML `GET and HEAD neither sign in nor consume` |
| S4 | **Single use, atomic.** Consuming is one `UPDATE … WHERE consumed_at IS NULL AND expires_at > now()`; the sign-in proceeds only when one row was changed. | ML `works once`, ML `consumes with one conditional update` |
| S5 | **Hashed at rest, never exposed.** Only `sha256(token)` is stored. The token is not written to a log, a session flash, an error message or a job payload; the job carries the address only and is encrypted. | ML `stores only a hash and flashes nothing secret`, ML `queued work is encrypted` |
| S6 | **Short life.** A link lives 15 minutes (row and URL signature); a code 10 minutes. | ML `expires after 15 minutes`, EC `expires after 10 minutes` |
| S7 | **A new link kills the old ones** of that user; a resent code replaces the previous one. | ML `a new link invalidates earlier ones`, EC `a resend invalidates the previous code` |
| S8 | **Uniform answer.** The request for a link returns the same status, redirect, flash and errors for a known, unknown, unverified, ambiguous or cooled-down address, and when mail does not deliver; the HTTP path never reads the `users` table: it dispatches one job per accepted request. Timing is therefore equal by construction on an asynchronous queue. | ML `answers the same way for every address`, ML `dispatches the same job for every address` |
| S9 | **One address function.** Account lookup uses `LoginAddress::normalise()`; every throttle and cooldown key uses `LoginAddress::throttleKey()`, which is computed from the normalised address, so two spellings that reach the same account share one bucket. Fortify's `login` limiter uses it too. | LA `spellings of one address share a key`, ML `the cooldown survives a change of case and spaces` |
| S10 | **Throttles.** Per address: 60 s cooldown and 5 per hour, both silent (S8). Per IP: 10 per minute, answered with a validation error. Confirmation and consume: 20 per minute per IP. | ML `sends one mail per minute per address`, ML `stops at five an hour per address`, ML `limits an IP that rotates addresses` |
| S11 | **Login only.** A magic link never creates a user, never verifies an address (D6), and is sent only to a verified account; when two accounts share the lower-cased address, nothing is sent. | ML `mails a verified account only`, ML `sends nothing when the address is ambiguous` |
| S12 | **Second factor after a link.** A user with any second factor is sent to the challenge; `Auth::check()` is false until it passes. | EC `challenges on every entry` |
| S13 | **Session.** The session id is regenerated on sign-in (and again after the challenge). | ML `regenerates the session`, EC `regenerates the session after the code` |
| S14 | **No open redirect.** The link carries no destination. The target is `redirect()->intended(route('dashboard'))`; request input cannot change it. | ML `ignores a redirect parameter` |
| S15 | **Not offered when mail does not deliver** (`log`, `array`): the login page hides it and the endpoint sends nothing, with the uniform answer. The invitation flow's habit of flashing the URL under `MAIL_MAILER=log` is not copied. | ML `sends nothing when mail does not deliver`, ML `tells the login page whether links are available` |
| S16 | **Code quality.** Six digits from `random_int`, stored as an HMAC-SHA-256 keyed with the app key over user, purpose and code; compared with `hash_equals`; single use. | EC `stores an HMAC, not the code`, EC `works once` |
| S17 | **Five attempts.** The fifth wrong attempt kills the code; the right code afterwards fails; the account is not locked and a new code can be sent. | EC `the fifth wrong attempt kills the code` |
| S18 | **Code send limits.** 60 s cooldown and 5 per hour per user and purpose. | EC `does not resend within 60 seconds`, EC `stops at five codes an hour` |
| S19 | **Enable and disable need proof.** Both sit behind `auth`, `verified`, `RequirePassword`; enabling also needs a code received at the address. | EC `enabling needs password confirmation and a received code`, EC `disabling needs password confirmation` |
| S20 | **TOTP, recovery codes, passkeys unchanged.** Existing tests pass untouched. Fortify's `POST two-factor-challenge` rejects an e-mail code and answers a validation error (not a 500) for a user without a TOTP secret. | Existing `tests/Feature/Auth/*`, `tests/Feature/Settings/SecurityTest.php`; EC `the authenticator route refuses an e-mail code` |
| S21 | **Revocation.** Password change, password reset and e-mail change delete outstanding links and codes; an e-mail change turns the e-mail factor off; deleting the account deletes its rows. | RV (four tests) |
| S22 | **Encrypted queue, clean security mails.** `SendMagicLink`, `MagicLinkMail`, `TwoFactorCodeMail` implement `ShouldBeEncrypted`. Security mails (link, code, invitation) carry no `List-Unsubscribe` header, no tracking image. | ML `queued work is encrypted`, MAIL `security mails carry no unsubscribe header` |
| S23 | **Search authorisation.** Every query starts from the ids of the teams the user can view in the current workspace; guests and unverified users get nothing; `q` under two characters is refused; `%`, `_` and `\` are literal; 60 per minute. A card whose retro still hides the others' cards matches only for its author, and the filter is in SQL; no result names an author. | SR (all), SR `finds the text of a card everyone may read, and of nobody else's hidden card`, SR `never returns a card of a team the user cannot view` |
| S24 | **Unsubscribe.** The route accepts only a valid signature, changes only `action_item_reminders_by_email` of the signed user, does nothing on `GET`, and signs nobody in. | MAIL `unsubscribe` tests |
| S25 | **User text in mail.** HTML parts escape with `{{ }}` only; no Markdown rendering of user text; subjects are single-line. | MAIL `escapes user text`, existing `ReminderDigestTest`, `WorkspaceInvitationsTest`, `ShareRedactionTest` |
| S26 | **Hex only in mail**, values from the Emails README table or from `BrandPalette::toHex()`; no user string reaches a style. | MAIL `uses hex colours only`, MM `stays within the hex table` |
| S27 | **While single sign-on is required, only SSO signs in, and the server enforces it** (R1, R3, R10–R13). Magic link, passkey and form registration are refused for everyone; the reset link is mailed to instance admins only and the request answers everyone the same. Every entry point asks `SignInPolicy`; none reads the setting itself. The second factor after SSO is unchanged (S1). | FS `sends no magic link and keeps the uniform answer`, FS `refuses a link issued before the setting was turned on`, FS `refuses a passkey for everyone while the setting is in force`, FS `closes form registration`, FS `mails a reset link to an instance admin only and answers everyone the same`, FS `still asks for the second factor after single sign-on`, FS `tells the login page what is offered` |
| S28 | **The password is the way back of instance admins, never alone, and its refusal says nothing** (R4–R8). A password opens a session only for an instance admin who has a second factor, and only after that factor; an admin without one, a member, and a wrong password get one identical answer after the same `Timebox`; the role is read when the password is given and again when a password-started challenge ends. | FS `refuses the right password of a member`, FS `refuses the right password of an instance admin who has no second factor`, FS `challenges an instance admin who has a second factor, and signs in after it`, FS `gives one answer to a member, to an admin without a second factor and to a wrong password`, FS `refuses the password of a demoted admin`, FS `refuses to complete a password challenge for an admin demoted meanwhile`, FS `still completes a challenge that single sign-on started for someone who is not an admin`, FS `accepts the password of a newly promoted admin who has a second factor` |
| S29 | **Nobody is locked out, and the setting is an admin's act** (R2, R9, R14, R15). Ignored for everyone while no provider is enabled, with an alert to instance admins only; turned on only with an enabled provider, by an admin who has an SSO identity and a second factor; always possible to turn off; read and written only behind `can:manageInstance` and `RequirePassword`; untouched by the Branding reset; an account without an SSO identity is linked on its first SSO sign-in; the last admin cannot be revoked. | FS `is ignored for everyone when no provider is enabled`, FS `alerts instance admins, and nobody else, while the setting is ignored`, FS `signs in through single sign-on and links an account that had no SSO identity`, SS `refuses to turn it on when no provider is configured`, SS `refuses to turn it on when the acting admin has no SSO identity of an enabled provider`, SS `refuses to turn it on when the acting admin has no second factor`, SS `turns it off whatever the state of the providers and of the admin`, SS `counts the admins who can use the password way back`, SS `keeps the page away from members and behind password confirmation`, SS `refuses a value that is not a boolean`, SS `keeps the setting when branding is reset`, SS `turns it on and deletes the outstanding magic links`, existing `InstanceAdminsTest` `does not offer to revoke the last admin` |
| S30 | **An invitation followed through SSO is bound to the invited address, and proves nothing by itself.** The callback learns of the invitation only from the server-side session; the token is never sent to the provider nor read from callback input. An address the provider does not mark verified creates no account and reaches no account, **with or without a matching invitation**. Only the invited address (case and surrounding spaces aside), verified by the provider, accepts the invitation. Another address neither accepts nor consumes it, is never linked to the account that owns the invited address, and never signs in as it. An expired or accepted invitation gives no right. | IS `refuses an address the provider does not mark verified, even with a matching invitation`, IS `creates the account and joins the workspace when the provider returns the invited address`, IS `never sends the invitation token to the provider and never reads it from the callback`, IS `gives nothing to an identity whose address is not the invited one`, IS `signs a different address in to its own account, outside the workspace, when sign-up is open`, IS `never links or opens the account that owns the invited address to another identity`, IS `refuses an unverified provider address that claims an existing account, invitation or not`, IS `gives no right through an expired or already accepted invitation`; `ResolveSsoUserTest` `refuses a matching invitation when the provider did not verify the address` |
| S31 | **An existing account joins only as itself, after its second factor.** The callback joins only the account it creates. An existing account signs in through `CompleteLogin` (challenge first, S12) and joins by the authenticated `POST invitations/{token}/acceptance`, which checks the address again. | IS `asks an existing account for its second factor before anything is joined`, IS `signs in a linked account whose address differs, and its acceptance is refused` |
| S32 | **Recap unsubscribe.** As S24 for the column `recap_emails`: a valid signature only, nothing on `GET`, nobody signed in, only the signed user changed; a signature made for the reminder link does not work on the recap link. An unsubscribed user receives no recap and is not counted. | RU `shows a confirmation page and changes nothing on GET`, RU `turns the recap e-mails off on a signed POST without signing anyone in`, RU `refuses a missing, tampered or borrowed signature`, RU `leaves an unsubscribed member out of the recipients and of their count` |
| S33 | **The bell never accepts an invitation.** (The token-less accept route of the second version of this plan is withdrawn — owner, third round. The number is kept.) An invitation notification is a link to the existing invitation page, where the existing rules apply. It is created only for the single verified account that owns the invited address, and the inviter's answer does not tell whether that account exists. The invitation token is stored in the notification encrypted, never in plain text, and is given back only to that account. | BN `links an invitation notification to the invitation page and accepts nothing`, BN `stores the invitation link encrypted and gives it to its owner only`, BN `notifies the one verified account that owns the invited address`; `php artisan route:list` has no route named `receivedInvitations.*` (Task 16) |
| S34 | **A user's channel and list are its own.** `private-user.{id}` is authorised for that signed-in user only; the event carries a count and no content; a notification whose subject the user may no longer see is dropped; recent sessions follow S23. | BN `authorises the user channel for its owner only`, BN `tells the open page that a notification arrived, with a count only`, BN `drops a notification whose subject is out of reach`, RS (all) |

Known limits, written in the phase report and on the Security card where relevant: a magic link followed by an e-mail code proves the same mailbox twice (spec §9); an e-mail-code-only user who loses the mailbox has no recovery path (D4); the token is part of the URL path and therefore of the reverse proxy's access log for 15 minutes (single use limits the value); with `QUEUE_CONNECTION=sync` the job of S8 runs inside the request and timing is no longer equal — production must run a queue worker, as the README of the project already requires for mail; an e-mail change turns the e-mail factor off without a second proof (the profile form has none today); required single sign-on closes no session already open and revokes no API token (R16), so removing a person still means removing the member; while it is in force an account whose provider address differs from its account address, or whose account address was never verified, cannot sign in until an admin intervenes — the Admin › Sign-in page shows how many accounts have never used single sign-on before the switch is turned on; nothing forces an instance admin to keep a second factor, so the password way back can be empty (the page counts the admins who have it, R9) and the other way back is then the operator's; a provider configuration lost by mistake gives every password, passkey and magic link back until it is repaired — the alert of R2 is what tells the admins; the password way back of an admin whose only second factor is the e-mail code needs mail to deliver.

## Review Focus

1. **One address typed several ways** (`A@x.test`, ` a@x.test `, `á@x.test` vs `a@x.test`) — the cooldown and the hourly cap hold across spellings, and a link never goes to a different account than the one typed. Pinned in Task 5 (`LoginAddressTest`) and Task 6 (`the cooldown survives a change of case and spaces`).
2. **A link opened twice, by a scanner then by the person, in two tabs, or one second too late** — one session at most, and the second attempt lands on the login page with a clear message. Pinned in Task 6 (`GET and HEAD…`, `works once`, `expires after 15 minutes`).
3. **A code typed for another challenge** (a code issued for enabling, used at login; a code of user A in a session challenged for user B; `login.id` pointing to a deleted user) — refused without a 500. Pinned in Task 7 (`a code of another purpose or user is refused`, `a challenge for a deleted user goes back to login`).
4. **Search text that looks like a pattern or like nothing** (`%`, `_`, `\`, one character, only spaces, 101 characters, an emoji) and a user who belongs to two workspaces with different roles — literal match, validation error, never a row of a team outside the current workspace. Pinned in Task 9.
5. **Names that look like markup in a mail** (workspace `<script>`, inviter `[x](https://evil.test)`, action text with a newline) in the HTML part, the text part and the subject. Pinned in Tasks 2–4, and again on the blocks Task 14 adds.
6. **Required single sign-on with one door left open, or one answer that talks** — a member's right password, an admin's password without a second factor, an admin demoted between the password and the code, a passkey, an old magic link, a reset link for a member, the register form posted by hand, the setting flipped by a Branding reset, the setting turned on by an admin who has no way back; and any response that differs between an admin and a member before the right password of an admin was given. Each is one test of Task 10 (rules R1–R16); the gate (Task 16) adds what a test cannot see (an entry point that does not ask `SignInPolicy`, the passkey controller).
7. **An invitation followed by the wrong person** — the provider returns another address, the invited address without marking it verified, the invited address in another case, an unverified copy of an existing account's address, or the visitor is already linked to another account; and an existing member with a second factor. One session at most, never the account of the invited address, nothing joined before the challenge. Pinned in Task 11.
8. **A screen that resembles its mockup instead of matching it** — a label reworded, a block moved, a state missing, an element dropped because the server did not send its data. Each front task and Task 14 end with the side-by-side comparison of Global Constraints; Task 26 repeats it on the captures; whatever is left is in the Deviations table or is a defect.

---

## Back-end tasks (sequential)

### Task 1: Mail foundation

**Files:**
- Create: `app/Support/Mail/MailBrand.php`, `app/Mail/BrandedMail.php`, `resources/views/mail/layout.blade.php`, `resources/views/mail/partials/button.blade.php`, `resources/views/mail/partials/dark.blade.php`, `app/Http/Controllers/MailPreviewsController.php`
- Modify: `routes/web.php` (next to the `dev/design-system` routes), `tests/Feature/TranslationKeysTest.php:15-22`
- Test: `tests/Feature/Mail/MailLayoutTest.php`

**Interfaces:**
- Consumes: `InstanceSettings::brandColor()`, `displayName()`, `poweredBy()`; `BrandAssets::url('logo-light')`, `mime('logo-light')`; `BrandPalette::derive(string $hex)->toHex()` returning `array{light: array<string, string>, dark: array<string, string>}` with keys `primary`, `primary-foreground`, `skrum-primary-text`.
- Produces: `MailBrand::name(): string`, `logoUrl(): ?string`, `poweredBy(): bool`, `instanceUrl(): string`, `colors(): array{light: array<string, string>, dark: array<string, string>}`; `BrandedMail::brandData(): array{brand: MailBrand, colors: array}` (protected) and `BrandedMail::forNotifiable(AnonymousNotifiable|User $notifiable): static`; Blade layout `mail.layout` with sections `content` and `footer` and variables `$title`, `$preheader`, `$brand`, `$colors`; partial `mail.partials.button` with `$url`, `$label`, `$colors`; `MailPreviewsController::samples(): array<string, Closure(): ?Mailable>` (private) to which Tasks 2, 3, 4, 6, 7 each add one entry; route `dev.mail.show` (`GET dev/mail/{mail}?locale=`).

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Support\InstanceSettings;
use App\Support\Mail\MailBrand;
use Illuminate\Support\Facades\Blade;

function renderMailLayout(string $body = 'Hello'): string
{
    $brand = resolve(MailBrand::class);

    return Blade::render("@extends('mail.layout')\n@section('content')\n{$body}\n@endsection", [
        'title' => 'A subject',
        'preheader' => 'A preview line',
        'brand' => $brand,
        'colors' => $brand->colors(),
    ]);
}

it('uses hex colours only', function () {
    resolve(InstanceSettings::class)->set('brand_color', '#2B63B0');

    $html = renderMailLayout();

    expect($html)->not->toMatch('/var\(|oklch|color-mix|rgb\(|hsl\(/')
        ->and(preg_match_all('/color:\s*([^;"}]+)/', $html, $matches))->toBeGreaterThan(10)
        ->and(collect($matches[1])->map(fn (string $value) => trim(str_replace('!important', '', $value)))->reject(fn (string $value) => preg_match('/^#[0-9a-f]{6}$/', $value) === 1)->values()->all())->toBe([]);
});

it('keeps the Skrüm palette when no brand colour is stored', function () {
    expect(resolve(MailBrand::class)->colors())->toBe(MailBrand::Palette);
});

it('takes the three brand tokens from the palette of the instance colour', function () {
    resolve(InstanceSettings::class)->set('brand_color', '#2B63B0');

    $colors = resolve(MailBrand::class)->colors();

    expect($colors['light']['primary'])->not->toBe(MailBrand::Palette['light']['primary'])
        ->and($colors['light']['muted'])->toBe(MailBrand::Palette['light']['muted'])
        ->and(renderMailLayout())->toContain($colors['dark']['primary']);
});

it('declares both colour schemes and the Outlook dark selectors', function () {
    $html = renderMailLayout();

    expect($html)->toContain('<meta name="color-scheme" content="light dark">')
        ->toContain('@media (prefers-color-scheme: dark)')
        ->toContain('[data-ogsc]')
        ->toContain('[data-ogsb]')
        ->toContain('role="presentation"')
        ->toContain('<title>A subject</title>');
});

it('sets the language of the document', function (string $locale) {
    app()->setLocale($locale);

    expect(renderMailLayout())->toContain("<html lang=\"{$locale}\"");
})->with(['en', 'fr', 'es', 'de']);

it('escapes the display name', function () {
    resolve(InstanceSettings::class)->set('display_name', '</title><script>alert(1)</script>');

    expect(renderMailLayout())->not->toContain('<script>alert(1)</script>');
});

it('shows the name as text when the instance logo is not a PNG or a JPEG', function () {
    expect(resolve(MailBrand::class)->logoUrl())->toBeNull()
        ->and(renderMailLayout())->not->toContain('<img');
});

it('hides the previews outside local and testing', function () {
    app()->detectEnvironment(fn (): string => 'production');

    $this->get('/dev/mail/magic-link')->assertNotFound();
});

it('answers not found for an unknown preview', function () {
    $this->get('/dev/mail/nope')->assertNotFound();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mail/MailLayoutTest.php`
Expected: FAIL, `Class "App\Support\Mail\MailBrand" not found`.

- [ ] **Step 3: `MailBrand`**

`vendor/bin/sail artisan make:class Support/Mail/MailBrand --no-interaction`, then:

```php
<?php

namespace App\Support\Mail;

use App\Support\Branding\BrandAssets;
use App\Support\Branding\BrandPalette;
use App\Support\InstanceSettings;
use Illuminate\Support\Arr;

class MailBrand
{
    /**
     * Hex values of docs/design-system/components/Emails/README.md.
     *
     * @var array{light: array<string, string>, dark: array<string, string>}
     */
    public const array Palette = [
        'light' => [
            'muted' => '#f3efeb',
            'card' => '#ffffff',
            'border' => '#e4dfd9',
            'input' => '#948a83',
            'foreground' => '#211a16',
            'muted-foreground' => '#655b55',
            'primary' => '#bb4d2a',
            'primary-foreground' => '#fefbf8',
            'skrum-primary-text' => '#9c3917',
            'skrum-destructive-text' => '#a51c30',
        ],
        'dark' => [
            'muted' => '#27221e',
            'card' => '#1b1613',
            'border' => '#352f2b',
            'input' => '#6f6761',
            'foreground' => '#f2f0ec',
            'muted-foreground' => '#b0aaa3',
            'primary' => '#ea865e',
            'primary-foreground' => '#1d100b',
            'skrum-primary-text' => '#f9a782',
            'skrum-destructive-text' => '#feaaa9',
        ],
    ];

    /** @var array<int, string> */
    private const array BrandTokens = ['primary', 'primary-foreground', 'skrum-primary-text'];

    /** @var array<int, string> */
    private const array MailSafeLogoTypes = ['image/png', 'image/jpeg'];

    public function __construct(private InstanceSettings $settings, private BrandAssets $assets) {}

    public function name(): string
    {
        return $this->settings->displayName();
    }

    public function poweredBy(): bool
    {
        return $this->settings->poweredBy();
    }

    public function instanceUrl(): string
    {
        return url('/');
    }

    /**
     * Most mail clients do not draw SVG or WebP: such a logo is replaced by the name.
     */
    public function logoUrl(): ?string
    {
        if (! in_array($this->assets->mime('logo-light'), self::MailSafeLogoTypes, true)) {
            return null;
        }

        $path = $this->assets->url('logo-light');

        return $path === null ? null : url($path);
    }

    /**
     * @return array{light: array<string, string>, dark: array<string, string>}
     */
    public function colors(): array
    {
        $color = $this->settings->brandColor();

        if ($color === null) {
            return self::Palette;
        }

        $brand = BrandPalette::derive($color)->toHex();

        return [
            'light' => [...self::Palette['light'], ...Arr::only($brand['light'], self::BrandTokens)],
            'dark' => [...self::Palette['dark'], ...Arr::only($brand['dark'], self::BrandTokens)],
        ];
    }
}
```

`toHex()` must return lower-case `#rrggbb`; if `BrandPaletteTest` shows upper case, lower it in `MailBrand::colors()` with `array_map('strtolower', …)` and keep the test as written.

- [ ] **Step 4: `BrandedMail`**

`vendor/bin/sail artisan make:mail BrandedMail --no-interaction`, then replace the body:

```php
<?php

namespace App\Mail;

use App\Models\User;
use App\Support\Mail\MailBrand;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Queue\SerializesModels;

abstract class BrandedMail extends Mailable implements ShouldQueue
{
    use Queueable;
    use SerializesModels;

    public function forNotifiable(AnonymousNotifiable|User $notifiable): static
    {
        $address = $notifiable->routeNotificationFor('mail');

        if (blank($address)) {
            return $this;
        }

        return $this->to($address);
    }

    /**
     * @return array{brand: MailBrand, colors: array{light: array<string, string>, dark: array<string, string>}}
     */
    protected function brandData(): array
    {
        $brand = resolve(MailBrand::class);

        return ['brand' => $brand, 'colors' => $brand->colors()];
    }
}
```

- [ ] **Step 5: The layout and its partials**

`resources/views/mail/partials/dark.blade.php` (`$prefix` is `''`, `'[data-ogsc] '` or `'[data-ogsb] '`, always a literal of the layout):

```blade
{!! $prefix !!}.m-bg { background-color: {{ $colors['dark']['muted'] }} !important; }
{!! $prefix !!}.m-card { background-color: {{ $colors['dark']['card'] }} !important; border-color: {{ $colors['dark']['border'] }} !important; }
{!! $prefix !!}.m-panel { background-color: {{ $colors['dark']['muted'] }} !important; border-color: {{ $colors['dark']['input'] }} !important; }
{!! $prefix !!}.m-rule { border-color: {{ $colors['dark']['border'] }} !important; }
{!! $prefix !!}.m-text { color: {{ $colors['dark']['foreground'] }} !important; }
{!! $prefix !!}.m-muted { color: {{ $colors['dark']['muted-foreground'] }} !important; }
{!! $prefix !!}.m-link { color: {{ $colors['dark']['skrum-primary-text'] }} !important; }
{!! $prefix !!}.m-danger { color: {{ $colors['dark']['skrum-destructive-text'] }} !important; }
{!! $prefix !!}.m-button { background-color: {{ $colors['dark']['primary'] }} !important; border-color: {{ $colors['dark']['primary'] }} !important; color: {{ $colors['dark']['primary-foreground'] }} !important; }
```

`resources/views/mail/layout.blade.php` (`@@media` prints `@media`; Blade must not read it as a directive):

```blade
<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" dir="ltr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>{{ $title }}</title>
<style>
@@media (max-width: 600px) {
.m-pad { padding-left: 16px !important; padding-right: 16px !important; }
}
@@media (prefers-color-scheme: dark) {
@include('mail.partials.dark', ['prefix' => ''])
}
@include('mail.partials.dark', ['prefix' => '[data-ogsc] '])
@include('mail.partials.dark', ['prefix' => '[data-ogsb] '])
</style>
</head>
<body class="m-bg" style="margin:0;padding:0;background-color:{{ $colors['light']['muted'] }};">
<div style="display:none;max-height:0;overflow:hidden;">{{ $preheader }}</div>
<table role="presentation" class="m-bg" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:{{ $colors['light']['muted'] }};">
<tr>
<td align="center" class="m-pad" style="padding:32px 24px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr>
<td class="m-card m-pad" style="padding:24px;background-color:{{ $colors['light']['card'] }};border:1px solid {{ $colors['light']['border'] }};border-radius:10px;font-family:Figtree,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
@if($brand->logoUrl() !== null)
<img src="{{ $brand->logoUrl() }}" alt="{{ $brand->name() }}" height="28" style="display:block;border:0;height:28px;width:auto;">
@else
<p class="m-text" style="margin:0;font-size:18px;line-height:28px;font-weight:bold;color:{{ $colors['light']['foreground'] }};">{{ $brand->name() }}</p>
@endif
<h1 class="m-text" style="margin:24px 0 12px;font-size:20px;line-height:28px;font-weight:bold;color:{{ $colors['light']['foreground'] }};">{{ $title }}</h1>
@yield('content')
</td>
</tr>
<tr>
<td align="center" class="m-muted m-pad" style="padding:16px 24px;font-family:Figtree,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:{{ $colors['light']['muted-foreground'] }};">
@yield('footer')
<p style="margin:8px 0 0;"><a class="m-muted" href="{{ $brand->instanceUrl() }}" style="color:{{ $colors['light']['muted-foreground'] }};">{{ $brand->name() }}</a>@if($brand->poweredBy()) · {{ __('Powered by Skrüm') }}@endif</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>
```

`resources/views/mail/partials/button.blade.php`:

```blade
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;">
<tr>
<td>
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{{ $url }}" style="height:44px;v-text-anchor:middle;width:260px;" arcsize="18%" strokecolor="{{ $colors['light']['primary'] }}" fillcolor="{{ $colors['light']['primary'] }}">
<w:anchorlock/>
<center style="color:{{ $colors['light']['primary-foreground'] }};font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">{{ $label }}</center>
</v:roundrect>
<![endif]-->
<!--[if !mso]><!-->
<a class="m-button" href="{{ $url }}" style="display:inline-block;padding:12px 24px;background-color:{{ $colors['light']['primary'] }};border:1px solid {{ $colors['light']['primary'] }};border-radius:8px;color:{{ $colors['light']['primary-foreground'] }};font-size:15px;line-height:20px;font-weight:bold;text-decoration:none;">{{ $label }}</a>
<!--<![endif]-->
</td>
</tr>
</table>
```

Shared inline styles used by the content views of Tasks 2–7 (copy them, they are not variables): paragraph `class="m-text" style="margin:0 0 12px;font-size:15px;line-height:24px;color:{{ $colors['light']['foreground'] }};"`; help line `class="m-muted" style="margin:12px 0 0;font-size:13px;line-height:20px;color:{{ $colors['light']['muted-foreground'] }};"`; link `class="m-link" style="color:{{ $colors['light']['skrum-primary-text'] }};"`.

Rule for every view of this plan: HTML parts use `{{ }}` only. Text parts (`mail/text/*`) are `text/plain`, so they print with `{!! !!}`: `{{ }}` would turn the `&` of a signed URL into `&amp;` and break the link.

- [ ] **Step 6: Preview controller and route**

`vendor/bin/sail artisan make:controller MailPreviewsController --no-interaction`:

```php
<?php

namespace App\Http\Controllers;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Mail\Mailable;

class MailPreviewsController extends Controller
{
    public function show(Request $request, string $mail): Response
    {
        abort_unless(app()->environment(['local', 'testing']), 404);

        $sample = $this->samples()[$mail] ?? null;

        abort_if($sample === null, 404);

        $mailable = $sample();

        abort_if($mailable === null, 404);

        $locale = $request->query('locale');

        if (in_array($locale, config('skrum.locales'), true)) {
            $mailable->locale($locale);
        }

        return response($mailable->render());
    }

    /**
     * @return array<string, Closure(): ?Mailable>
     */
    private function samples(): array
    {
        return [];
    }
}
```

In `routes/web.php`, after the two `dev/design-system` routes:

```php
Route::get('dev/mail/{mail}', [MailPreviewsController::class, 'show'])->where('mail', '[a-z-]+')->name('dev.mail.show');
```

- [ ] **Step 7: Make the translation test read Blade views**

In `tests/Feature/TranslationKeysTest.php`, add `...File::allFiles(resource_path('views')),` to the list of scanned folders (a `.blade.php` file has the extension `php`, so the filter keeps it). The `__('…')` pattern is already there.

- [ ] **Step 8: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mail/MailLayoutTest.php tests/Feature/TranslationKeysTest.php tests/Arch`
Expected: PASS. If `TranslationKeysTest` reports `Powered by Skrüm` missing, add it to the four `lang/*.json` files (fr `Propulsé par Skrüm`, es `Con tecnología de Skrüm`, de `Bereitgestellt von Skrüm`).

- [ ] **Step 9: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app/Support/Mail app/Mail app/Http/Controllers/MailPreviewsController.php resources/views/mail routes/web.php tests/Feature/Mail tests/Feature/TranslationKeysTest.php lang
git commit -m "feat(mail): branded Blade layout, mail brand and a local preview route"
```

### Task 2: Invitation mail

**Files:**
- Create: `app/Mail/WorkspaceInvitationMail.php`, `resources/views/mail/workspace-invitation.blade.php`, `resources/views/mail/text/workspace-invitation.blade.php`
- Modify: `app/Notifications/WorkspaceInvitationNotification.php:29-39`, `app/Http/Controllers/MailPreviewsController.php` (`samples()`)
- Test: `tests/Feature/Mail/WorkspaceInvitationMailTest.php`; existing `tests/Feature/Workspaces/WorkspaceInvitationsTest.php` stays green without edits

**Interfaces:**
- Consumes: `BrandedMail`, `mail.layout`, `mail.partials.button` (Task 1).
- Produces: `new WorkspaceInvitationMail(string $workspaceName, string $inviterName, string $url, CarbonInterface $expiresAt)`; `WorkspaceInvitationNotification::toMail(object $notifiable): WorkspaceInvitationMail`.

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Mail\WorkspaceInvitationMail;
use App\Models\User;
use App\Notifications\WorkspaceInvitationNotification;
use Illuminate\Notifications\AnonymousNotifiable;

function invitationNotification(string $workspace = 'Nordlys', string $inviter = 'Fran'): WorkspaceInvitationNotification
{
    return new WorkspaceInvitationNotification($workspace, $inviter, 'https://skrum.test/invitations/token', now()->addDays(7));
}

it('returns the branded mailable addressed to the invited person', function () {
    $mail = invitationNotification()->toMail((new AnonymousNotifiable)->route('mail', 'new@example.test'));

    expect($mail)->toBeInstanceOf(WorkspaceInvitationMail::class)
        ->and($mail->hasTo('new@example.test'))->toBeTrue()
        ->and($mail->subject)->toBe('You are invited to join Nordlys');
});

it('escapes user text in the html part and keeps it literal in the text part', function () {
    $mail = invitationNotification('<script>alert(1)</script>', '[y](https://evil.test)')->toMail(new User);
    $html = (string) $mail->render();

    expect($html)->not->toContain('<script>alert(1)</script>')
        ->not->toContain('href="https://evil.test"')
        ->toContain('&lt;script&gt;')
        ->toContain('href="https://skrum.test/invitations/token"');

    $mail->assertSeeInText('[y](https://evil.test)');
});

it('keeps the subject on one line', function () {
    expect(invitationNotification("Nord\r\nBcc: evil@example.test")->toMail(new User)->subject)->not->toContain("\n");
});

it('is written in the language given to the notification', function () {
    $html = (string) invitationNotification()->locale('fr')->toMail(new User)->locale('fr')->render();

    expect($html)->toContain('<html lang="fr"');
});

it('carries no unsubscribe header', function () {
    $mail = invitationNotification()->toMail(new User);

    $mail->assertHasSubject('You are invited to join Nordlys');
    expect(method_exists($mail, 'headers'))->toBeFalse();
});

it('previews the invitation', function () {
    $this->get('/dev/mail/invitation')->assertOk()->assertSee('Accept invitation');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mail/WorkspaceInvitationMailTest.php`
Expected: FAIL, `Class "App\Mail\WorkspaceInvitationMail" not found`.

- [ ] **Step 3: The Mailable**

```php
<?php

namespace App\Mail;

use Carbon\CarbonInterface;
use Illuminate\Mail\Mailables\Content;

class WorkspaceInvitationMail extends BrandedMail
{
    public function __construct(
        public string $workspaceName,
        public string $inviterName,
        public string $url,
        public CarbonInterface $expiresAt,
    ) {}

    public function content(): Content
    {
        return new Content(
            view: 'mail.workspace-invitation',
            text: 'mail.text.workspace-invitation',
            with: [
                ...$this->brandData(),
                'title' => $this->subject,
                'preheader' => __(':inviter invited you to join the :workspace workspace.', [
                    'inviter' => $this->inviterName,
                    'workspace' => $this->workspaceName,
                ]),
            ],
        );
    }
}
```

- [ ] **Step 4: The notification returns it**

Replace `toMail` in `app/Notifications/WorkspaceInvitationNotification.php` (drop the `MailMessage` import, add `App\Mail\WorkspaceInvitationMail`, `App\Models\User`, `Illuminate\Notifications\AnonymousNotifiable`, `Illuminate\Support\Str`):

```php
    public function toMail(AnonymousNotifiable|User $notifiable): WorkspaceInvitationMail
    {
        return (new WorkspaceInvitationMail($this->workspaceName, $this->inviterName, $this->url, $this->expiresAt))
            ->subject(Str::squish(__('You are invited to join :workspace', ['workspace' => $this->workspaceName])))
            ->forNotifiable($notifiable);
    }
```

`via`, the constructor, the queue interfaces and the call site in `WorkspaceInvitationsController` do not change.

- [ ] **Step 5: The views**

`resources/views/mail/workspace-invitation.blade.php`:

```blade
@extends('mail.layout')

@section('content')
<p class="m-text" style="margin:0 0 12px;font-size:15px;line-height:24px;color:{{ $colors['light']['foreground'] }};">{{ __(':inviter invited you to join the :workspace workspace.', ['inviter' => $inviterName, 'workspace' => $workspaceName]) }}</p>
@include('mail.partials.button', ['url' => $url, 'label' => __('Accept invitation')])
<p class="m-muted" style="margin:12px 0 0;font-size:13px;line-height:20px;color:{{ $colors['light']['muted-foreground'] }};">{{ __('This invitation expires on :date.', ['date' => $expiresAt->isoFormat('LL')]) }}</p>
@endsection

@section('footer')
<p style="margin:0;">{{ __('You do not know :inviter? Ignore this e-mail.', ['inviter' => $inviterName]) }}</p>
@endsection
```

`resources/views/mail/text/workspace-invitation.blade.php`:

```blade
{!! __(':inviter invited you to join the :workspace workspace.', ['inviter' => $inviterName, 'workspace' => $workspaceName]) !!}

{!! __('Accept invitation') !!}: {!! $url !!}

{!! __('This invitation expires on :date.', ['date' => $expiresAt->isoFormat('LL')]) !!}
```

- [ ] **Step 6: Preview entry**

In `MailPreviewsController::samples()` add (imports: `App\Mail\WorkspaceInvitationMail`, `Illuminate\Mail\Mailable`):

```php
            'invitation' => fn (): Mailable => (new WorkspaceInvitationMail('Nordlys', 'Fran Facilitator', url('/invitations/sample'), now()->addDays(7)))
                ->subject(__('You are invited to join :workspace', ['workspace' => 'Nordlys'])),
```

- [ ] **Step 7: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mail tests/Feature/Workspaces/WorkspaceInvitationsTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS after the new key `You do not know :inviter? Ignore this e-mail.` is added to the four language files (values in the translation table of Task 26).

- [ ] **Step 8: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app/Mail/WorkspaceInvitationMail.php app/Notifications/WorkspaceInvitationNotification.php app/Http/Controllers/MailPreviewsController.php resources/views/mail tests/Feature/Mail lang
git commit -m "feat(mail): workspace invitation as a branded mailable"
```

### Task 3: Action reminder mail and signed unsubscribe

**Files:**
- Create: `app/Mail/ActionItemReminderMail.php`, `resources/views/mail/action-item-reminder.blade.php`, `resources/views/mail/text/action-item-reminder.blade.php`, `app/Http/Controllers/ReminderUnsubscribesController.php`, `resources/js/pages/auth/reminder-unsubscribe.tsx`
- Modify: `app/Notifications/ActionItemReminderDigestNotification.php:37-155`, `routes/web.php`, `bootstrap/app.php:609`, `app/Http/Controllers/MailPreviewsController.php`
- Test: `tests/Feature/Mail/ActionItemReminderMailTest.php`; `tests/Feature/ActionItems/ReminderDigestTest.php` and `tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php:491` stay green (they call `toMail()->render()` and read `->subject`, both exist on a Mailable whose subject was set with `->subject()`)

**Interfaces:**
- Consumes: Task 1.
- Produces: `new ActionItemReminderMail(array $overdue, array $dueSoon, int $hidden, ?string $listUrl, string $unsubscribeUrl, string $settingsUrl)` where each item is `array{content: string, url: string, team: string, source: string, due: string}`; routes `reminderUnsubscribes.show` (`GET reminder-unsubscribe/{user}`) and `reminderUnsubscribes.store` (`POST`, same path), both `signed`; Inertia page `auth/reminder-unsubscribe` with props `unsubscribed: boolean`, `confirmUrl: string`.

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Enums\ActionItemReminderKind;
use App\Mail\ActionItemReminderMail;
use App\Models\ActionItem;
use App\Models\Team;
use App\Models\User;
use App\Notifications\ActionItemReminderDigestNotification;
use Illuminate\Support\Facades\URL;
use Inertia\Testing\AssertableInertia as Assert;

function reminderMailFor(User $user, ActionItem ...$items): ActionItemReminderMail
{
    return (new ActionItemReminderDigestNotification(array_map(
        fn (ActionItem $item): array => ['actionItemId' => $item->id, 'kind' => ActionItemReminderKind::Overdue->value],
        $items,
    )))->toMail($user);
}

it('returns the branded mailable with one-click unsubscribe headers', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->create(['due_on' => '2026-10-01']);

    $mail = reminderMailFor($user, $item);
    $unsubscribeUrl = URL::signedRoute('reminderUnsubscribes.show', ['user' => $user->id]);

    expect($mail->hasTo($user->email))->toBeTrue();
    expect($mail->headers()->text)->toBe([
        'List-Unsubscribe' => "<{$unsubscribeUrl}>",
        'List-Unsubscribe-Post' => 'List-Unsubscribe=One-Click',
    ]);
    $mail->assertSeeInHtml($unsubscribeUrl, false);
});

it('escapes item text and keeps it on one line', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $item = ActionItem::factory()->withoutRetro($team, $user)->create(['content' => "Fix <b> & it.\nnext [line](https://evil.test)", 'due_on' => '2026-10-01']);

    $html = (string) reminderMailFor($user, $item)->render();

    expect($html)->toContain('Fix &lt;b&gt; &amp; it. next')
        ->not->toContain('href="https://evil.test"')
        ->not->toContain('&amp;lt;');
});

it('says how many items are left out beyond the limit', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $items = ActionItem::factory()->count(ActionItemReminderDigestNotification::Limit + 3)->withoutRetro($team, $user)->create(['due_on' => '2026-10-01']);

    reminderMailFor($user, ...$items->all())->assertSeeInHtml('And 3 more.');
});

it('shows a confirmation page and changes nothing on GET', function () {
    $user = User::factory()->create();

    $this->get(URL::signedRoute('reminderUnsubscribes.show', ['user' => $user->id]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('auth/reminder-unsubscribe')->where('unsubscribed', false));

    $this->assertGuest();
    expect($user->fresh()->action_item_reminders_by_email)->toBeTrue();
});

it('turns the e-mail reminders off on a signed POST without signing anyone in', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();

    $this->post(URL::signedRoute('reminderUnsubscribes.show', ['user' => $user->id]), ['List-Unsubscribe' => 'One-Click'])
        ->assertNoContent();

    $this->assertGuest();
    expect($user->fresh())->action_item_reminders_by_email->toBeFalse()->action_item_reminders_in_app->toBeTrue()
        ->and($other->fresh()->action_item_reminders_by_email)->toBeTrue();
});

it('refuses a missing or tampered signature', function (string $method) {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $forged = str_replace($user->id, $other->id, URL::signedRoute('reminderUnsubscribes.show', ['user' => $user->id]));

    $this->call($method, route('reminderUnsubscribes.show', ['user' => $user->id]))->assertForbidden();
    $this->call($method, $forged)->assertForbidden();

    expect($other->fresh()->action_item_reminders_by_email)->toBeTrue();
})->with(['GET', 'POST']);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mail/ActionItemReminderMailTest.php`
Expected: FAIL, `Class "App\Mail\ActionItemReminderMail" not found`.

- [ ] **Step 3: The Mailable**

```php
<?php

namespace App\Mail;

use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Headers;

class ActionItemReminderMail extends BrandedMail
{
    /**
     * @param  array<int, array{content: string, url: string, team: string, source: string, due: string}>  $overdue
     * @param  array<int, array{content: string, url: string, team: string, source: string, due: string}>  $dueSoon
     */
    public function __construct(
        public array $overdue,
        public array $dueSoon,
        public int $hidden,
        public ?string $listUrl,
        public string $unsubscribeUrl,
        public string $settingsUrl,
    ) {}

    public function content(): Content
    {
        return new Content(
            view: 'mail.action-item-reminder',
            text: 'mail.text.action-item-reminder',
            with: [...$this->brandData(), 'title' => $this->subject, 'preheader' => $this->subject],
        );
    }

    public function headers(): Headers
    {
        return new Headers(text: [
            'List-Unsubscribe' => "<{$this->unsubscribeUrl}>",
            'List-Unsubscribe-Post' => 'List-Unsubscribe=One-Click',
        ]);
    }
}
```

- [ ] **Step 4: The notification builds it**

In `app/Notifications/ActionItemReminderDigestNotification.php`: keep the constructor, `via`, `itemsOfKind`, `dueWording`, `subject`. Delete `section`, `describe` and `escape`. Replace `toMail` and add `present` (imports: `App\Mail\ActionItemReminderMail`, `App\Models\User`, `Illuminate\Support\Facades\URL`, `Illuminate\Support\Str`; drop `MailMessage`):

```php
    public function toMail(User $notifiable): ActionItemReminderMail
    {
        /** @var Collection<string, ActionItem> $items */
        $items = ActionItem::query()
            ->with(['team.workspace', 'retro'])
            ->whereKey(array_column($this->reminders, 'actionItemId'))
            ->get()
            ->keyBy('id');
        $overdue = $this->itemsOfKind($items, ActionItemReminderKind::Overdue);
        $dueSoon = $this->itemsOfKind($items, ActionItemReminderKind::DueSoon);
        $shownOverdue = $overdue->take(self::Limit);
        $shownDueSoon = $dueSoon->take(self::Limit - $shownOverdue->count());
        $first = $overdue->concat($dueSoon)->first();

        return (new ActionItemReminderMail(
            $shownOverdue->map($this->present(...))->all(),
            $shownDueSoon->map($this->present(...))->all(),
            $overdue->count() + $dueSoon->count() - $shownOverdue->count() - $shownDueSoon->count(),
            $first === null ? null : route('workspaces.actionItems.index', [
                'workspace' => $first->team->workspace,
                'assignee' => 'me',
                'status' => 'open',
            ]),
            URL::signedRoute('reminderUnsubscribes.show', ['user' => $notifiable->id]),
            route('notificationPreferences.edit'),
        ))
            ->subject($this->subject($overdue->count(), $dueSoon->count()))
            ->forNotifiable($notifiable);
    }

    /**
     * @return array{content: string, url: string, team: string, source: string, due: string}
     */
    private function present(ActionItem $item): array
    {
        return [
            'content' => Str::squish($item->content),
            'url' => route('workspaces.actionItems.index', ['workspace' => $item->team->workspace, 'item' => $item->id]),
            'team' => Str::squish($item->team->name),
            'source' => Str::squish($item->retro === null ? __('Added outside a retro') : $item->retro->title),
            'due' => $this->dueWording($item),
        ];
    }
```

`SendActionItemReminders::deliver` sends this notification to `User` models only (it reads `action_item_reminders_by_email`); the narrower parameter type is therefore safe. Check the two test call sites that pass a `User` and keep them.

- [ ] **Step 5: The views**

`resources/views/mail/action-item-reminder.blade.php`:

```blade
@extends('mail.layout')

@section('content')
@foreach([[__('Overdue'), $overdue, true], [__('Due soon'), $dueSoon, false]] as [$heading, $items, $late])
@if($items !== [])
<p class="m-text" style="margin:16px 0 4px;font-size:15px;line-height:24px;font-weight:bold;color:{{ $colors['light']['foreground'] }};">{{ $heading }}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
@foreach($items as $item)
<tr>
<td class="m-rule" style="padding:8px 0;border-top:1px solid {{ $colors['light']['border'] }};font-size:15px;line-height:24px;">
<a class="m-link" href="{{ $item['url'] }}" style="color:{{ $colors['light']['skrum-primary-text'] }};">{{ $item['content'] }}</a><br>
<span class="m-muted" style="font-size:13px;line-height:20px;color:{{ $colors['light']['muted-foreground'] }};">{{ $item['team'] }} · {{ $item['source'] }} · </span><span class="{{ $late ? 'm-danger' : 'm-muted' }}" style="font-size:13px;line-height:20px;color:{{ $late ? $colors['light']['skrum-destructive-text'] : $colors['light']['muted-foreground'] }};">{{ $item['due'] }}</span>
</td>
</tr>
@endforeach
</table>
@endif
@endforeach
@if($hidden > 0)
<p class="m-muted" style="margin:12px 0 0;font-size:13px;line-height:20px;color:{{ $colors['light']['muted-foreground'] }};">{{ __('And :count more.', ['count' => $hidden]) }}</p>
@endif
@if($listUrl !== null)
@include('mail.partials.button', ['url' => $listUrl, 'label' => __('View my open action items')])
@endif
@endsection

@section('footer')
<p style="margin:0;">{{ __('You can turn off these reminders in your notification settings.') }}</p>
<p style="margin:8px 0 0;"><a class="m-muted" href="{{ $settingsUrl }}" style="color:{{ $colors['light']['muted-foreground'] }};">{{ __('Notification settings') }}</a> · <a class="m-muted" href="{{ $unsubscribeUrl }}" style="color:{{ $colors['light']['muted-foreground'] }};">{{ __('Unsubscribe from reminders') }}</a></p>
@endsection
```

`resources/views/mail/text/action-item-reminder.blade.php`:

```blade
@foreach([[__('Overdue'), $overdue], [__('Due soon'), $dueSoon]] as [$heading, $items])
@if($items !== [])
{!! $heading !!}
@foreach($items as $item)
- {!! $item['content'] !!} ({!! $item['team'] !!} · {!! $item['source'] !!} · {!! $item['due'] !!})
  {!! $item['url'] !!}
@endforeach

@endif
@endforeach
@if($hidden > 0)
{!! __('And :count more.', ['count' => $hidden]) !!}

@endif
{!! __('Notification settings') !!}: {!! $settingsUrl !!}
{!! __('Unsubscribe from reminders') !!}: {!! $unsubscribeUrl !!}
```

- [ ] **Step 6: Unsubscribe controller, routes, CSRF exemption**

`vendor/bin/sail artisan make:controller ReminderUnsubscribesController --no-interaction`:

```php
<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\URL;
use Inertia\Inertia;
use Inertia\Response;

class ReminderUnsubscribesController extends Controller
{
    public function show(User $user): Response
    {
        return Inertia::render('auth/reminder-unsubscribe', [
            'unsubscribed' => ! $user->action_item_reminders_by_email,
            'confirmUrl' => URL::signedRoute('reminderUnsubscribes.show', ['user' => $user->id]),
        ]);
    }

    public function store(Request $request, User $user): RedirectResponse|HttpResponse
    {
        $user->forceFill(['action_item_reminders_by_email' => false])->save();

        if ($request->input('List-Unsubscribe') === 'One-Click') {
            return response()->noContent();
        }

        return redirect(URL::signedRoute('reminderUnsubscribes.show', ['user' => $user->id]));
    }
}
```

`routes/web.php`, outside every `auth` group:

```php
Route::middleware(['signed', 'throttle:30,1'])->group(function (): void {
    Route::get('reminder-unsubscribe/{user}', [ReminderUnsubscribesController::class, 'show'])->whereUuid('user')->name('reminderUnsubscribes.show');
    Route::post('reminder-unsubscribe/{user}', [ReminderUnsubscribesController::class, 'store'])->whereUuid('user')->name('reminderUnsubscribes.store');
});
```

Both routes share one path, so the URL signed for `show` is valid for the POST that a mail client sends for one-click unsubscribe (RFC 8058). That POST has no session and no CSRF token; the signature is its proof. In `bootstrap/app.php`, inside `withMiddleware`, after `encryptCookies`:

```php
        $middleware->preventRequestForgery(except: ['reminder-unsubscribe/*']);
```

(Laravel 13 names the web CSRF middleware `PreventRequestForgery`; `validateCsrfTokens` is its deprecated alias.) Feature tests skip CSRF, so this line is checked by hand in Task 16.

- [ ] **Step 7: The page**

`resources/js/pages/auth/reminder-unsubscribe.tsx` (pages under `auth/` receive `AuthLayout` from `app.tsx`):

```tsx
import { Head, router, setLayoutProps } from '@inertiajs/react';
import { useState } from 'react';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import { login } from '@/routes';

type Props = { unsubscribed: boolean; confirmUrl: string };

export default function ReminderUnsubscribe({ unsubscribed, confirmUrl }: Props) {
    const { t } = useTrans();
    const [processing, setProcessing] = useState(false);

    setLayoutProps({
        title: t('Reminder e-mails'),
        description: unsubscribed
            ? t('You no longer receive action item reminders by e-mail.')
            : t('Stop the action item reminders sent by e-mail?'),
    });

    return (
        <>
            <Head title={t('Reminder e-mails')} />

            <div className="flex flex-col gap-4 text-center">
                {!unsubscribed && (
                    <Button
                        type="button"
                        className="w-full"
                        disabled={processing}
                        data-test="unsubscribe-button"
                        onClick={() =>
                            router.post(
                                confirmUrl,
                                {},
                                {
                                    onStart: () => setProcessing(true),
                                    onFinish: () => setProcessing(false),
                                },
                            )
                        }
                    >
                        {processing && <Spinner />}
                        {t('Unsubscribe')}
                    </Button>
                )}
                <TextLink href={login()}>{t('Log in')}</TextLink>
            </div>
        </>
    );
}
```

If 18e replaced `TextLink` or the `setLayoutProps` title convention of auth pages, follow the sibling `auth/verify-email.tsx` as it stands at execution.

- [ ] **Step 8: Preview entry**

```php
            'action-reminder' => fn (): ?Mailable => ($user = User::query()->whereHas('teams')->first()) === null
                ? null
                : (new ActionItemReminderDigestNotification(
                    ActionItem::query()->whereIn('team_id', $user->teams()->select('teams.id'))->limit(3)->pluck('id')
                        ->map(fn (string $id): array => ['actionItemId' => $id, 'kind' => ActionItemReminderKind::Overdue->value])->all(),
                ))->toMail($user),
```

- [ ] **Step 9: Run the tests**

Run: `npm run build:front` then `vendor/bin/sail artisan test --compact tests/Feature/Mail tests/Feature/ActionItems tests/Feature/TranslationKeysTest.php tests/Arch`
Expected: PASS. New keys for the four files, with their values in the translation table of Task 26: `Unsubscribe from reminders`, `Reminder e-mails`, `Stop the action item reminders sent by e-mail?`, `You no longer receive action item reminders by e-mail.`, `Unsubscribe`.

- [ ] **Step 10: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app/Mail/ActionItemReminderMail.php app/Notifications/ActionItemReminderDigestNotification.php app/Http/Controllers routes/web.php bootstrap/app.php resources/views/mail resources/js/pages/auth/reminder-unsubscribe.tsx tests/Feature/Mail lang
git commit -m "feat(mail): action reminder as a branded mailable with a signed one-click unsubscribe"
```

### Task 4: Retro recap mail

**Files:**
- Create: `app/Mail/RetroResultsMail.php`, `resources/views/mail/retro-results.blade.php`, `resources/views/mail/text/retro-results.blade.php`
- Modify: `app/Support/Integrations/Messages/RetroRecapMail.php` (whole file), `app/Notifications/RetroResultsNotification.php:50-58`, `app/Http/Controllers/MailPreviewsController.php`
- Test: `tests/Feature/Mail/RetroResultsMailTest.php`; `tests/Feature/Integrations/ResultsEmailTest.php` and `ShareRedactionTest.php` stay green

**Interfaces:**
- Consumes: Task 1; `RecapText::heading`, `context`, `participants`, `cards`, `roti` (null when it must be hidden), `actionItem`, `topCard`, `more`; `RetroRecap` (`summary`, `actionItems`, `hiddenActionItems`, `suggestedActions`, `hiddenSuggestedActions`, `topCards`, `url`).
- Produces: `new RetroResultsMail(array $facts, array $summary, array $sections, string $url, string $settingsUrl)` with `$facts: array<int, string>`, `$summary: array<int, string>`, `$sections: array<int, array{heading: string, lines: array<int, string>, more: ?string}>`; `RetroRecapMail::build(RetroRecap $recap, ?array $health): RetroResultsMail`.

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Enums\RetroPhase;
use App\Mail\RetroResultsMail;
use App\Models\ActionItem;
use App\Models\Retro;
use App\Notifications\RetroResultsNotification;

it('returns the branded mailable with the facts of the retro', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create(['title' => 'Sprint 42']);
    [$facilitator] = retroFacilitator($retro);

    $mail = (new RetroResultsNotification($retro->id))->toMail($facilitator);

    expect($mail)->toBeInstanceOf(RetroResultsMail::class)
        ->and($mail->hasTo($facilitator->email))->toBeTrue()
        ->and($mail->subject)->toBe('Results of the retrospective "Sprint 42"');
    $mail->assertSeeInHtml('View the results');
});

it('escapes user text and shows no backslash', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create(['title' => 'Sprint_42 <b>']);
    [$facilitator] = retroFacilitator($retro);
    ActionItem::factory()->create(['retro_id' => $retro->id, 'team_id' => $retro->team_id, 'content' => 'Ship [it](https://evil.test) *now*']);

    $html = (string) (new RetroResultsNotification($retro->id))->toMail($facilitator)->render();

    expect($html)->toContain('Ship [it](https://evil.test) *now*')
        ->not->toContain('href="https://evil.test"')
        ->not->toContain('\\*')
        ->not->toContain('<b>');
});

it('links to the notification settings', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    [$facilitator] = retroFacilitator($retro);

    $mail = (new RetroResultsNotification($retro->id))->toMail($facilitator);

    $mail->assertSeeInHtml(route('notificationPreferences.edit'), false);
});
```

If `ActionItem::factory()` needs another state to attach an item to a retro, use the state that `tests/Feature/Integrations/ResultsEmailTest.php` uses for its action items.

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mail/RetroResultsMailTest.php`
Expected: FAIL, `Class "App\Mail\RetroResultsMail" not found`.

- [ ] **Step 3: The Mailable**

```php
<?php

namespace App\Mail;

use Illuminate\Mail\Mailables\Content;

class RetroResultsMail extends BrandedMail
{
    /**
     * @param  array<int, string>  $facts
     * @param  array<int, string>  $summary
     * @param  array<int, array{heading: string, lines: array<int, string>, more: ?string}>  $sections
     */
    public function __construct(
        public array $facts,
        public array $summary,
        public array $sections,
        public string $url,
        public string $settingsUrl,
    ) {}

    public function content(): Content
    {
        return new Content(
            view: 'mail.retro-results',
            text: 'mail.text.retro-results',
            with: [...$this->brandData(), 'title' => $this->subject, 'preheader' => $this->facts[0] ?? $this->subject],
        );
    }
}
```

- [ ] **Step 4: Rewrite the builder**

`app/Support/Integrations/Messages/RetroRecapMail.php` becomes:

```php
<?php

namespace App\Support\Integrations\Messages;

use App\Mail\RetroResultsMail;
use Illuminate\Support\Str;

/**
 * The recap as the data of a branded mail. Every string is plain text: the
 * Blade views escape it, so user text can never become markup.
 */
class RetroRecapMail
{
    /**
     * @param  array{score: float, participation: array{respondents: int, participants: int}}|null  $health
     */
    public function build(RetroRecap $recap, ?array $health): RetroResultsMail
    {
        $facts = array_filter([
            RecapText::context($recap),
            RecapText::participants($recap),
            RecapText::cards($recap),
            RecapText::roti($recap),
            $health === null ? null : __('Health check: :score/10 (:respondents of :participants participants answered)', [
                'score' => number_format($health['score'], 1),
                'respondents' => $health['participation']['respondents'],
                'participants' => $health['participation']['participants'],
            ]),
        ]);

        $sections = array_filter([
            $this->section(__('Action items'), array_map(RecapText::actionItem(...), $recap->actionItems), $recap->hiddenActionItems),
            $this->section(__('Suggested actions'), $recap->suggestedActions, $recap->hiddenSuggestedActions),
            $this->section(__('Top card per column'), array_map(RecapText::topCard(...), $recap->topCards), 0),
        ]);

        return (new RetroResultsMail(
            array_values(array_map(Str::squish(...), $facts)),
            $recap->summary === null ? [] : array_values(array_map(Str::squish(...), preg_split('/\R{2,}/u', $recap->summary) ?: [])),
            array_values($sections),
            $recap->url,
            route('notificationPreferences.edit'),
        ))->subject(Str::squish(RecapText::heading($recap)));
    }

    /**
     * @param  array<int, string>  $lines
     * @return array{heading: string, lines: array<int, string>, more: ?string}|null
     */
    private function section(string $heading, array $lines, int $hidden): ?array
    {
        if ($lines === []) {
            return null;
        }

        return [
            'heading' => $heading,
            'lines' => array_values(array_map(Str::squish(...), $lines)),
            'more' => $hidden > 0 ? RecapText::more($hidden) : null,
        ];
    }
}
```

`RetroResultsNotification::toMail` becomes (imports: `App\Mail\RetroResultsMail`; drop `MailMessage`):

```php
    public function toMail(User $notifiable): RetroResultsMail
    {
        $retro = Retro::query()->with('team')->findOrFail($this->retroId);

        return resolve(RetroRecapMail::class)->build(
            resolve(BuildRetroRecap::class)->handle($retro),
            resolve(SummarizeHealthCheck::class)->handle($retro),
        )->forNotifiable($notifiable);
    }
```

`shouldSend`, `via`, the queue interfaces and `RetroResultsEmailsController` do not change.

- [ ] **Step 5: The views**

`resources/views/mail/retro-results.blade.php`:

```blade
@extends('mail.layout')

@section('content')
@foreach($facts as $fact)
<p class="m-text" style="margin:0 0 4px;font-size:15px;line-height:24px;color:{{ $colors['light']['foreground'] }};">{{ $fact }}</p>
@endforeach
@if($summary !== [])
<p class="m-text" style="margin:16px 0 4px;font-size:15px;line-height:24px;font-weight:bold;color:{{ $colors['light']['foreground'] }};">{{ __('Summary') }}</p>
@foreach($summary as $paragraph)
<p class="m-text" style="margin:0 0 12px;font-size:15px;line-height:24px;color:{{ $colors['light']['foreground'] }};">{{ $paragraph }}</p>
@endforeach
@endif
@foreach($sections as $section)
<p class="m-text" style="margin:16px 0 4px;font-size:15px;line-height:24px;font-weight:bold;color:{{ $colors['light']['foreground'] }};">{{ $section['heading'] }}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
@foreach($section['lines'] as $line)
<tr>
<td class="m-text m-rule" style="padding:8px 0;border-top:1px solid {{ $colors['light']['border'] }};font-size:15px;line-height:24px;color:{{ $colors['light']['foreground'] }};">{{ $line }}</td>
</tr>
@endforeach
</table>
@if($section['more'] !== null)
<p class="m-muted" style="margin:8px 0 0;font-size:13px;line-height:20px;color:{{ $colors['light']['muted-foreground'] }};">{{ $section['more'] }}</p>
@endif
@endforeach
@include('mail.partials.button', ['url' => $url, 'label' => __('View the results')])
@endsection

@section('footer')
<p style="margin:0;">{{ __('You receive this e-mail because you took part in this retrospective or belong to its team.') }} <a class="m-muted" href="{{ $settingsUrl }}" style="color:{{ $colors['light']['muted-foreground'] }};">{{ __('Notification settings') }}</a></p>
@endsection
```

`resources/views/mail/text/retro-results.blade.php`:

```blade
@foreach($facts as $fact)
{!! $fact !!}
@endforeach
@if($summary !== [])

{!! __('Summary') !!}
@foreach($summary as $paragraph)
{!! $paragraph !!}
@endforeach
@endif
@foreach($sections as $section)

{!! $section['heading'] !!}
@foreach($section['lines'] as $line)
- {!! $line !!}
@endforeach
@if($section['more'] !== null)
{!! $section['more'] !!}
@endif
@endforeach

{!! __('View the results') !!}: {!! $url !!}
```

- [ ] **Step 6: Preview entry**

```php
            'retro-recap' => fn (): ?Mailable => ($retro = Retro::query()->where('phase', RetroPhase::Completed)->latest()->first()) === null
                ? null
                : resolve(RetroRecapMail::class)->build(
                    resolve(BuildRetroRecap::class)->handle($retro),
                    resolve(SummarizeHealthCheck::class)->handle($retro),
                ),
```

- [ ] **Step 7: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mail tests/Feature/Integrations/ResultsEmailTest.php tests/Feature/Integrations/ShareRedactionTest.php tests/Feature/TranslationKeysTest.php`
Expected: PASS. An assertion of the two existing files that expected an escaped Markdown character (a backslash before `*`, `_`, `[`) is updated to the unescaped text: the escaping existed for Markdown rendering, which is gone (S25). List each changed line in the report. New key (values in the translation table of Task 26): `You receive this e-mail because you took part in this retrospective or belong to its team.`

- [ ] **Step 8: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app/Mail/RetroResultsMail.php app/Support/Integrations/Messages/RetroRecapMail.php app/Notifications/RetroResultsNotification.php app/Http/Controllers/MailPreviewsController.php resources/views/mail tests lang
git commit -m "feat(mail): retro recap as a branded mailable"
```

### Task 5: One place for the second-factor decision, one address function

No behaviour change in this task: only TOTP exists. It moves the decision so that Tasks 6 and 7 cannot miss an entry.

**Files:**
- Create: `app/Support/Auth/LoginAddress.php`, `app/Enums/SecondFactorMethod.php`, `app/Support/Auth/SecondFactors.php`, `app/Actions/Auth/StartSecondFactorChallenge.php`, `app/Actions/Auth/CompleteLogin.php`, `app/Actions/Auth/RedirectIfSecondFactorRequired.php`
- Modify: `app/Http/Controllers/SsoCallbacksController.php:19-74`, `app/Providers/FortifyServiceProvider.php:33-38,100-113`
- Test: `tests/Feature/Auth/LoginAddressTest.php`, `tests/Feature/Auth/SecondFactorDecisionTest.php`; existing `SsoLoginTest`, `TwoFactorChallengeTest`, `AuthenticationTest` stay green without edits

**Interfaces:**
- Produces:
  - `LoginAddress::normalise(string $email): string`, `LoginAddress::throttleKey(string $email): string`, `LoginAddress::mask(string $email): string`
  - `enum SecondFactorMethod: string { case Totp = 'totp'; case EmailCode = 'email'; }`
  - `SecondFactors::methodsFor(User $user): array<int, SecondFactorMethod>`, `requiredFor(User $user): bool`, `hasTotp(User $user): bool`
  - `StartSecondFactorChallenge::handle(Request $request, User $user, bool $remember): void`
  - `CompleteLogin::handle(Request $request, User $user): RedirectResponse`
  - Container: `Laravel\Fortify\Contracts\RedirectsIfTwoFactorAuthenticatable` resolves to `RedirectIfSecondFactorRequired`

- [ ] **Step 1: Write the failing tests**

`tests/Feature/Auth/LoginAddressTest.php`:

```php
<?php

use App\Support\Auth\LoginAddress;

it('normalises case and surrounding spaces only', function () {
    expect(LoginAddress::normalise('  Ada.Lovelace@Example.TEST '))->toBe('ada.lovelace@example.test')
        ->and(LoginAddress::normalise('rené@example.test'))->toBe('rené@example.test')
        ->and(LoginAddress::normalise('ada+tag@example.test'))->toBe('ada+tag@example.test');
});

it('gives spellings of one address the same throttle key', function () {
    expect(LoginAddress::throttleKey(' Ada@Example.test'))->toBe(LoginAddress::throttleKey('ada@example.test'))
        ->and(LoginAddress::throttleKey('ada@example.test'))->not->toBe(LoginAddress::throttleKey('ada+1@example.test'))
        ->and(LoginAddress::throttleKey('ada@example.test'))->toMatch('/^[a-f0-9]{64}$/');
});

it('never gives two different throttle keys to addresses that normalise to the same account', function (string $first, string $second) {
    expect(LoginAddress::normalise($first))->toBe(LoginAddress::normalise($second))
        ->and(LoginAddress::throttleKey($first))->toBe(LoginAddress::throttleKey($second));
})->with([
    ['A@x.test', 'a@x.test'],
    ["a@x.test\t", ' a@x.test'],
    ['ÉMILE@x.test', 'émile@x.test'],
]);

it('masks an address', function () {
    expect(LoginAddress::mask('ada.lovelace@example.test'))->toBe('a…@example.test')
        ->and(LoginAddress::mask('broken'))->toBe('b…@');
});
```

`tests/Feature/Auth/SecondFactorDecisionTest.php`:

```php
<?php

use App\Actions\Auth\CompleteLogin;
use App\Actions\Auth\RedirectIfSecondFactorRequired;
use App\Enums\SecondFactorMethod;
use App\Models\SocialAccount;
use App\Models\User;
use App\Support\Auth\SecondFactors;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Laravel\Fortify\Contracts\RedirectsIfTwoFactorAuthenticatable;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;
use Symfony\Component\Finder\SplFileInfo;

it('lists the second factors of a user', function () {
    $factors = resolve(SecondFactors::class);

    expect($factors->methodsFor(User::factory()->create()))->toBe([])
        ->and($factors->requiredFor(User::factory()->create()))->toBeFalse()
        ->and($factors->methodsFor(User::factory()->withTwoFactor()->create()))->toBe([SecondFactorMethod::Totp])
        ->and($factors->methodsFor(User::factory()->withTwoFactor()->create(['two_factor_confirmed_at' => null])))->toBe([]);
});

it('binds the pipeline step of Fortify to the shared decision', function () {
    expect(resolve(RedirectsIfTwoFactorAuthenticatable::class))->toBeInstanceOf(RedirectIfSecondFactorRequired::class);
});

it('challenges a password login of a user with an authenticator app', function () {
    $user = User::factory()->withTwoFactor()->create();

    $this->post(route('login'), ['email' => $user->email, 'password' => 'password', 'remember' => 'on'])
        ->assertRedirect(route('two-factor.login'));

    $this->assertGuest();
    expect(session('login.id'))->toBe($user->id)->and(session('login.remember'))->toBeTrue();
});

it('signs in a password login without a second factor', function () {
    $user = User::factory()->create();

    $this->post(route('login'), ['email' => $user->email, 'password' => 'password'])->assertRedirect(route('dashboard'));

    $this->assertAuthenticatedAs($user);
});

it('completes a login through the shared action', function () {
    $plain = User::factory()->create();
    $protected = User::factory()->withTwoFactor()->create();
    $this->startSession();
    $sessionId = session()->getId();
    $request = Request::create('/');
    $request->setLaravelSession(session()->driver());

    $response = resolve(CompleteLogin::class)->handle($request, $protected);

    expect($response->getTargetUrl())->toBe(route('two-factor.login'))
        ->and(auth()->check())->toBeFalse()
        ->and(session('login.id'))->toBe($protected->id)
        ->and(session('login.remember'))->toBeFalse();

    $response = resolve(CompleteLogin::class)->handle($request, $plain);

    expect($response->getTargetUrl())->toBe(route('dashboard'))
        ->and(auth()->id())->toBe($plain->id)
        ->and(session()->getId())->not->toBe($sessionId);
});

it('keeps the single sign-on callback on the shared action', function () {
    config(['services.google.client_id' => 'google-id', 'services.google.client_secret' => 'google-secret']);
    $user = User::factory()->withTwoFactor()->create();
    SocialAccount::factory()->for($user)->create(['provider' => 'google', 'provider_user_id' => 'g-1']);
    Socialite::fake('google', SocialiteUser::fake(['id' => 'g-1']));

    $this->get(route('sso.callback', 'google'))->assertRedirect(route('two-factor.login'));

    $this->assertGuest();
});

it('lets no other file decide whether a challenge is due', function () {
    $allowed = [
        app_path('Support/Auth/SecondFactors.php'),
        app_path('Models/User.php'),
    ];

    $offenders = collect(File::allFiles(app_path()))
        ->reject(fn (SplFileInfo $file): bool => in_array($file->getPathname(), $allowed, true))
        ->filter(fn (SplFileInfo $file): bool => preg_match('/two_factor_secret|two_factor_confirmed_at|two_factor_email_enabled_at|hasEnabledTwoFactorAuthentication/', $file->getContents()) === 1)
        ->map(fn (SplFileInfo $file): string => $file->getRelativePathname())
        ->values()
        ->all();

    expect($offenders)->toBe(['Http/Controllers/Settings/SecurityController.php']);
});
```

The last test names the one file that may still read the state (to display it). Task 7 keeps that list and makes `SecurityController` ask `SecondFactors` for the e-mail factor.

- [ ] **Step 2: Run them to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Auth/LoginAddressTest.php tests/Feature/Auth/SecondFactorDecisionTest.php`
Expected: FAIL, `Class "App\Support\Auth\LoginAddress" not found`.

- [ ] **Step 3: `LoginAddress`**

```php
<?php

namespace App\Support\Auth;

use Illuminate\Support\Str;

class LoginAddress
{
    /**
     * The form used to find an account. Nothing but case and surrounding
     * white space is folded: two different mailboxes never become one.
     */
    public static function normalise(string $email): string
    {
        return Str::lower(trim($email));
    }

    /**
     * Coarser than normalise() and computed from it, so every spelling
     * that reaches one account shares one bucket.
     */
    public static function throttleKey(string $email): string
    {
        return hash('sha256', Str::transliterate(self::normalise($email)));
    }

    public static function mask(string $email): string
    {
        [$local, $domain] = array_pad(explode('@', $email, 2), 2, '');

        return Str::substr($local, 0, 1).'…@'.$domain;
    }
}
```

- [ ] **Step 4: Enum and `SecondFactors`**

`vendor/bin/sail artisan make:enum SecondFactorMethod --string --no-interaction`:

```php
<?php

namespace App\Enums;

enum SecondFactorMethod: string
{
    case Totp = 'totp';
    case EmailCode = 'email';
}
```

```php
<?php

namespace App\Support\Auth;

use App\Enums\SecondFactorMethod;
use App\Models\User;

class SecondFactors
{
    /**
     * @return array<int, SecondFactorMethod>
     */
    public function methodsFor(User $user): array
    {
        return array_values(array_filter([
            $this->hasTotp($user) ? SecondFactorMethod::Totp : null,
        ]));
    }

    public function requiredFor(User $user): bool
    {
        return $this->methodsFor($user) !== [];
    }

    public function hasTotp(User $user): bool
    {
        return $user->hasEnabledTwoFactorAuthentication();
    }
}
```

`hasEnabledTwoFactorAuthentication()` (Fortify trait, `vendor/laravel/fortify/src/TwoFactorAuthenticatable.php:21`) is the rule the SSO callback wrote by hand: secret set, and confirmed when confirmation is on.

- [ ] **Step 5: The three actions**

```php
<?php

namespace App\Actions\Auth;

use App\Models\User;
use Illuminate\Http\Request;

class StartSecondFactorChallenge
{
    public function handle(Request $request, User $user, bool $remember): void
    {
        $request->session()->put([
            'login.id' => $user->getKey(),
            'login.remember' => $remember,
        ]);
    }
}
```

```php
<?php

namespace App\Actions\Auth;

use App\Models\User;
use App\Support\Auth\SecondFactors;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * The end of every sign-in that does not go through Fortify's pipeline.
 * The destination is the intended URL kept by the server, never request input.
 */
class CompleteLogin
{
    public function __construct(
        private SecondFactors $secondFactors,
        private StartSecondFactorChallenge $startChallenge,
    ) {}

    public function handle(Request $request, User $user): RedirectResponse
    {
        if ($this->secondFactors->requiredFor($user)) {
            $this->startChallenge->handle($request, $user, remember: false);

            return to_route('two-factor.login');
        }

        Auth::login($user);

        $request->session()->regenerate();

        return redirect()->intended(route('dashboard'));
    }
}
```

```php
<?php

namespace App\Actions\Auth;

use App\Models\User;
use App\Support\Auth\SecondFactors;
use Laravel\Fortify\Actions\RedirectIfTwoFactorAuthenticatable;
use Laravel\Fortify\Events\TwoFactorAuthenticationChallenged;

class RedirectIfSecondFactorRequired extends RedirectIfTwoFactorAuthenticatable
{
    public function handle($request, $next)
    {
        $user = $this->validateCredentials($request);

        if (! $user instanceof User) {
            return $next($request);
        }

        if (! resolve(SecondFactors::class)->requiredFor($user)) {
            return $next($request);
        }

        return $this->twoFactorChallengeResponse($request, $user);
    }

    protected function twoFactorChallengeResponse($request, $user)
    {
        resolve(StartSecondFactorChallenge::class)->handle($request, $user, $request->boolean('remember'));

        TwoFactorAuthenticationChallenged::dispatch($user);

        return $request->wantsJson()
            ? response()->json(['two_factor' => true])
            : redirect()->route('two-factor.login');
    }
}
```

`validateCredentials` is the parent's (Timebox, failed event, rate limiter increment) and throws on bad credentials, exactly as before.

- [ ] **Step 6: Bind, and move the login limiter to the shared key**

In `app/Providers/FortifyServiceProvider.php`, `boot()` gains a first line `$this->configureSecondFactor();` and the class gains:

```php
    private function configureSecondFactor(): void
    {
        $this->app->scoped(RedirectsIfTwoFactorAuthenticatable::class, RedirectIfSecondFactorRequired::class);
    }
```

(imports: `App\Actions\Auth\RedirectIfSecondFactorRequired`, `Laravel\Fortify\Contracts\RedirectsIfTwoFactorAuthenticatable`). Fortify registers its own binding in `register()`; binding again in `boot()` wins whatever the provider order.

The `login` limiter becomes (import `App\Support\Auth\LoginAddress`, drop `Str` if unused):

```php
        RateLimiter::for('login', fn (Request $request) => Limit::perMinute(5)->by(
            LoginAddress::throttleKey((string) $request->input(Fortify::username())).'|'.$request->ip(),
        ));
```

- [ ] **Step 7: The SSO callback uses `CompleteLogin`**

In `app/Http/Controllers/SsoCallbacksController.php`: add `CompleteLogin $completeLogin` to the parameters of `show`; replace lines 47–60 (from `if ($this->hasConfirmedTwoFactor($user))` to the final `return`) with:

```php
        return $completeLogin->handle($request, $user);
```

Delete `hasConfirmedTwoFactor` and the imports `Auth`, `Fortify`, `User` that are no longer used.

- [ ] **Step 8: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Auth tests/Feature/Settings/SecurityTest.php tests/Arch`
Expected: PASS, with no edit to an existing test file.

- [ ] **Step 9: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app/Support/Auth app/Enums/SecondFactorMethod.php app/Actions/Auth app/Http/Controllers/SsoCallbacksController.php app/Providers/FortifyServiceProvider.php tests/Feature/Auth
git commit -m "refactor(auth): one place decides the second factor, one function normalises the address"
```

### Task 6: Magic link — back end

**Files:**
- Create: migration `create_magic_links_table`, `app/Models/MagicLink.php`, `database/factories/MagicLinkFactory.php`, `app/Actions/Auth/IssueMagicLink.php`, `app/Actions/Auth/ConsumeMagicLink.php`, `app/Jobs/Auth/SendMagicLink.php`, `app/Mail/MagicLinkMail.php`, `resources/views/mail/magic-link.blade.php`, `resources/views/mail/text/magic-link.blade.php`, `app/Http/Requests/Auth/MagicLinkRequest.php`, `app/Http/Controllers/MagicLinksController.php`, `app/Http/Controllers/MagicLinkSessionsController.php`, `resources/js/pages/auth/magic-link.tsx` (minimal here, finished in Task 17)
- Modify: `routes/web.php` (guest group, line 203), `app/Providers/FortifyServiceProvider.php` (login view props, limiter), `routes/console.php:40` (prune list), `app/Http/Controllers/MailPreviewsController.php`
- Test: `tests/Feature/Auth/MagicLinkTest.php`

**Interfaces:**
- Consumes: `LoginAddress`, `CompleteLogin` (Task 5); `BrandedMail`, layout, button (Task 1); `IntegrationAvailability::emailEnabled()`.
- Produces:
  - `MagicLink::LifetimeMinutes = 15`, `MagicLink::hashToken(string $token): string`, `MagicLink::findUsable(string $token): ?MagicLink`, relation `user()`
  - `IssueMagicLink::handle(User $user): string` (the signed URL), `ConsumeMagicLink::handle(string $token): ?User`
  - `new SendMagicLink(string $email)`; `new MagicLinkMail(string $url, string $email, int $expiresInMinutes)`
  - Routes: `magicLinks.store` (`POST magic-link`), `magicLinks.show` (`GET magic-link/{token}`), `magicLinks.sessions.store` (`POST magic-link/{token}/session`)
  - Login page prop `canUseMagicLink: boolean`; session status `magic-link-sent`
  - Inertia page `auth/magic-link` with props `email: string|null`, `confirmUrl: string|null` (both null when the link is not usable)

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Actions\Auth\ConsumeMagicLink;
use App\Actions\Auth\IssueMagicLink;
use App\Jobs\Auth\SendMagicLink;
use App\Mail\MagicLinkMail;
use App\Models\MagicLink;
use App\Models\User;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    config(['mail.default' => 'smtp']);
    Mail::fake();
});

function magicLinkFor(User $user): string
{
    return resolve(IssueMagicLink::class)->handle($user);
}

function magicLinkToken(string $url): string
{
    return basename((string) parse_url($url, PHP_URL_PATH));
}

function consumeUrl(string $url): string
{
    return route('magicLinks.sessions.store', magicLinkToken($url));
}

it('answers the same way for every address', function (string $email) {
    User::factory()->create(['email' => 'known@example.test']);
    User::factory()->unverified()->create(['email' => 'unverified@example.test']);

    $this->from(route('login'))->post(route('magicLinks.store'), ['email' => $email])
        ->assertRedirect(route('login'))
        ->assertSessionHas('status', 'magic-link-sent')
        ->assertSessionHasNoErrors();

    $this->from(route('login'))->post(route('magicLinks.store'), ['email' => $email])
        ->assertRedirect(route('login'))
        ->assertSessionHas('status', 'magic-link-sent')
        ->assertSessionHasNoErrors();
})->with(['known@example.test', 'nobody@example.test', 'unverified@example.test']);

it('dispatches the same job for every address and never reads the users table', function (string $email) {
    Queue::fake();
    User::factory()->create(['email' => 'known@example.test']);
    $userQueries = 0;
    DB::listen(function ($query) use (&$userQueries): void {
        $userQueries += str_contains($query->sql, '"users"') ? 1 : 0;
    });

    $this->post(route('magicLinks.store'), ['email' => $email]);

    Queue::assertPushed(SendMagicLink::class, 1);
    expect($userQueries)->toBe(0);
})->with(['known@example.test', 'nobody@example.test']);

it('mails a verified account only', function () {
    User::factory()->create(['email' => 'known@example.test']);
    User::factory()->unverified()->create(['email' => 'unverified@example.test']);
    $users = User::query()->count();

    foreach (['Known@Example.test', 'nobody@example.test', 'unverified@example.test'] as $email) {
        $this->post(route('magicLinks.store'), ['email' => $email]);
    }

    Mail::assertSentCount(1);
    Mail::assertSent(MagicLinkMail::class, fn (MagicLinkMail $mail): bool => $mail->hasTo('known@example.test'));
    expect(User::query()->count())->toBe($users)
        ->and(User::query()->firstWhere('email', 'unverified@example.test')->email_verified_at)->toBeNull();
});

it('sends nothing when the address is ambiguous', function () {
    User::factory()->create(['email' => 'twin@example.test']);
    User::factory()->create(['email' => 'Twin@example.test']);

    $this->post(route('magicLinks.store'), ['email' => 'twin@example.test'])->assertSessionHas('status', 'magic-link-sent');

    Mail::assertNothingSent();
});

it('sends nothing when mail does not deliver', function (string $mailer) {
    Queue::fake();
    config(['mail.default' => $mailer]);
    $user = User::factory()->create();

    $this->post(route('magicLinks.store'), ['email' => $user->email])->assertSessionHas('status', 'magic-link-sent');

    Queue::assertNothingPushed();
})->with(['log', 'array']);

it('tells the login page whether links are available', function (string $mailer, bool $available) {
    config(['mail.default' => $mailer]);

    $this->get(route('login'))->assertInertia(fn (Assert $page) => $page->where('canUseMagicLink', $available));
})->with([['smtp', true], ['log', false]]);

it('stores only a hash and flashes nothing secret', function () {
    $user = User::factory()->create();

    $this->post(route('magicLinks.store'), ['email' => $user->email]);

    $url = '';
    Mail::assertSent(MagicLinkMail::class, function (MagicLinkMail $mail) use (&$url): bool {
        $url = $mail->url;

        return true;
    });
    $token = magicLinkToken($url);
    $link = MagicLink::query()->sole();

    expect($token)->toMatch('/^[A-Za-z0-9]{64}$/')
        ->and($link->token_hash)->toBe(hash('sha256', $token))
        ->and((string) json_encode($link->getAttributes()))->not->toContain($token)
        ->and((string) json_encode(session()->all()))->not->toContain($token);
});

it('queued work is encrypted', function () {
    expect(new SendMagicLink('a@example.test'))->toBeInstanceOf(ShouldBeEncrypted::class)
        ->and(new MagicLinkMail('https://skrum.test/x', 'a@example.test', 15))->toBeInstanceOf(ShouldBeEncrypted::class);
});

it('GET and HEAD neither sign in nor consume', function () {
    $user = User::factory()->create(['email' => 'known@example.test']);
    $url = magicLinkFor($user);

    $this->call('HEAD', $url)->assertOk();
    $this->get($url)
        ->assertOk()
        ->assertHeader('Referrer-Policy', 'no-referrer')
        ->assertInertia(fn (Assert $page) => $page
            ->component('auth/magic-link')
            ->where('email', 'k…@example.test')
            ->where('confirmUrl', consumeUrl($url)));
    $this->get($url)->assertOk();

    $this->assertGuest();
    expect(MagicLink::query()->sole()->consumed_at)->toBeNull();
});

it('shows the invalid state for a tampered or unknown link', function () {
    $url = magicLinkFor(User::factory()->create());

    foreach ([$url.'0', str_replace(magicLinkToken($url), str_repeat('a', 64), $url)] as $bad) {
        $this->get($bad)->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('auth/magic-link')
            ->where('email', null)
            ->where('confirmUrl', null));
    }
});

it('signs in on POST and works once', function () {
    $user = User::factory()->create();
    $url = magicLinkFor($user);

    $this->post(consumeUrl($url))->assertRedirect(route('dashboard'));
    $this->assertAuthenticatedAs($user);

    auth()->logout();
    $this->flushSession();

    $this->post(consumeUrl($url))->assertRedirect(route('login'))->assertSessionHasErrors('email');
    $this->assertGuest();
});

it('consumes with one conditional update', function () {
    $user = User::factory()->create();
    $token = magicLinkToken(magicLinkFor($user));
    $updates = [];
    DB::listen(function ($query) use (&$updates): void {
        if (str_starts_with($query->sql, 'update "magic_links"')) {
            $updates[] = $query->sql;
        }
    });

    $first = resolve(ConsumeMagicLink::class)->handle($token);
    $second = resolve(ConsumeMagicLink::class)->handle($token);

    expect($first?->id)->toBe($user->id)
        ->and($second)->toBeNull()
        ->and($updates)->toHaveCount(2)
        ->and($updates[0])->toContain('"consumed_at" is null')->toContain('"expires_at" >');
});

it('expires after 15 minutes', function () {
    $user = User::factory()->create();
    $url = magicLinkFor($user);

    $this->travel(15)->minutes();
    $this->travel(1)->seconds();

    $this->get($url)->assertInertia(fn (Assert $page) => $page->where('confirmUrl', null));
    $this->post(consumeUrl($url))->assertRedirect(route('login'))->assertSessionHasErrors('email');
    $this->assertGuest();
});

it('a new link invalidates earlier ones', function () {
    $user = User::factory()->create();
    $first = magicLinkFor($user);
    $second = magicLinkFor($user);

    $this->post(consumeUrl($first))->assertRedirect(route('login'));
    $this->assertGuest();

    $this->post(consumeUrl($second))->assertRedirect(route('dashboard'));
    $this->assertAuthenticatedAs($user);
});

it('sends one mail per minute per address', function () {
    $user = User::factory()->create(['email' => 'known@example.test']);

    $this->post(route('magicLinks.store'), ['email' => $user->email]);
    $this->post(route('magicLinks.store'), ['email' => $user->email]);
    Mail::assertSentCount(1);

    $this->travel(61)->seconds();
    $this->post(route('magicLinks.store'), ['email' => $user->email]);
    Mail::assertSentCount(2);
});

it('the cooldown survives a change of case and spaces', function () {
    User::factory()->create(['email' => 'known@example.test']);

    $this->post(route('magicLinks.store'), ['email' => 'known@example.test']);
    $this->post(route('magicLinks.store'), ['email' => 'KNOWN@Example.Test']);

    Mail::assertSentCount(1);
});

it('stops at five an hour per address', function () {
    $user = User::factory()->create();

    foreach (range(1, 7) as $attempt) {
        $this->post(route('magicLinks.store'), ['email' => $user->email])->assertSessionHas('status', 'magic-link-sent');
        $this->travel(61)->seconds();
    }

    Mail::assertSentCount(5);
});

it('limits an IP that rotates addresses', function () {
    foreach (range(1, 10) as $attempt) {
        $this->post(route('magicLinks.store'), ['email' => "person{$attempt}@example.test"])->assertSessionHasNoErrors();
    }

    $this->from(route('login'))->post(route('magicLinks.store'), ['email' => 'person11@example.test'])
        ->assertRedirect(route('login'))
        ->assertSessionHasErrors('email');
});

it('refuses a malformed address', function (mixed $email) {
    Queue::fake();

    $this->post(route('magicLinks.store'), ['email' => $email])->assertSessionHasErrors('email');

    Queue::assertNothingPushed();
})->with(['', 'not-an-address', str_repeat('a', 250).'@example.test', [['a@example.test']]]);

it('regenerates the session', function () {
    $user = User::factory()->create();
    $url = magicLinkFor($user);
    $this->startSession();
    $before = session()->getId();

    $this->post(consumeUrl($url));

    expect(session()->getId())->not->toBe($before);
});

it('ignores a redirect parameter and honours the intended url kept by the server', function () {
    $user = User::factory()->create();

    $this->post(consumeUrl(magicLinkFor($user)).'?redirect=https://evil.test&next=https://evil.test', ['redirect' => 'https://evil.test'])
        ->assertRedirect(route('dashboard'));

    auth()->logout();
    $this->flushSession();

    $this->withSession(['url.intended' => url('/about')])
        ->post(consumeUrl(magicLinkFor($user)))
        ->assertRedirect(url('/about'));
});

it('sends an already signed-in person to the dashboard without consuming', function () {
    $user = User::factory()->create();
    $url = magicLinkFor($user);

    $this->actingAs(User::factory()->create())->get($url)->assertRedirect();

    expect(MagicLink::query()->sole()->consumed_at)->toBeNull();
});

it('writes the mail in the language of the account', function () {
    $user = User::factory()->create(['locale' => 'fr']);

    $this->post(route('magicLinks.store'), ['email' => $user->email]);

    Mail::assertSent(MagicLinkMail::class, fn (MagicLinkMail $mail): bool => $mail->locale === 'fr');
});

it('previews the magic link mail', function () {
    $this->get('/dev/mail/magic-link')->assertOk()->assertSee('Sign in');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Auth/MagicLinkTest.php`
Expected: FAIL, `Class "App\Actions\Auth\IssueMagicLink" not found`.

- [ ] **Step 3: Migration, model, factory**

`vendor/bin/sail artisan make:model MagicLink --migration --factory --no-interaction`

```php
    public function up(): void
    {
        Schema::create('magic_links', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->string('token_hash', 64)->unique();
            $table->timestamp('expires_at')->index();
            $table->timestamp('consumed_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }
```

```php
<?php

namespace App\Models;

use Database\Factories\MagicLinkFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\MassPrunable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $user_id
 * @property string $token_hash
 * @property Carbon $expires_at
 * @property Carbon|null $consumed_at
 * @property-read User $user
 */
class MagicLink extends Model
{
    /** @use HasFactory<MagicLinkFactory> */
    use HasFactory;

    use HasUuids;
    use MassPrunable;

    public const int LifetimeMinutes = 15;

    public $timestamps = false;

    public static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    public static function findUsable(string $token): ?self
    {
        return static::query()
            ->with('user')
            ->where('token_hash', static::hashToken($token))
            ->whereNull('consumed_at')
            ->where('expires_at', '>', now())
            ->first();
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return Builder<static> */
    public function prunable(): Builder
    {
        return static::query()->where('expires_at', '<', now()->subDay());
    }

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'consumed_at' => 'datetime',
        ];
    }
}
```

Factory `definition()`:

```php
        return [
            'user_id' => User::factory(),
            'token_hash' => MagicLink::hashToken(Str::random(64)),
            'expires_at' => now()->addMinutes(MagicLink::LifetimeMinutes),
            'consumed_at' => null,
        ];
```

The model has no fillable attribute on purpose: rows are written with `forceCreate` by `IssueMagicLink` only. In `routes/console.php:40`, add `MagicLink::class` to the `--model` list of `model:prune`.

- [ ] **Step 4: Issue and consume**

```php
<?php

namespace App\Actions\Auth;

use App\Models\MagicLink;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

class IssueMagicLink
{
    /**
     * Returns the only copy of the plain token, inside the signed URL.
     */
    public function handle(User $user): string
    {
        $token = Str::random(64);
        $expiresAt = now()->addMinutes(MagicLink::LifetimeMinutes);

        DB::transaction(function () use ($user, $token, $expiresAt): void {
            MagicLink::query()->where('user_id', $user->id)->delete();

            MagicLink::query()->forceCreate([
                'user_id' => $user->id,
                'token_hash' => MagicLink::hashToken($token),
                'expires_at' => $expiresAt,
            ]);
        });

        return URL::temporarySignedRoute('magicLinks.show', $expiresAt, ['token' => $token]);
    }
}
```

```php
<?php

namespace App\Actions\Auth;

use App\Models\MagicLink;
use App\Models\User;

class ConsumeMagicLink
{
    /**
     * One conditional update claims the row: of two requests racing on the
     * same token, the database lets one change it.
     */
    public function handle(string $token): ?User
    {
        $hash = MagicLink::hashToken($token);

        $claimed = MagicLink::query()
            ->where('token_hash', $hash)
            ->whereNull('consumed_at')
            ->where('expires_at', '>', now())
            ->update(['consumed_at' => now()]);

        if ($claimed !== 1) {
            return null;
        }

        return MagicLink::query()->with('user')->where('token_hash', $hash)->first()?->user;
    }
}
```

- [ ] **Step 5: Mailable and views**

```php
<?php

namespace App\Mail;

use App\Support\Mail\MailBrand;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use SensitiveParameter;

class MagicLinkMail extends BrandedMail implements ShouldBeEncrypted
{
    public function __construct(
        #[SensitiveParameter] public string $url,
        public string $email,
        public int $expiresInMinutes,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: __('Your sign-in link for :app', ['app' => resolve(MailBrand::class)->name()]));
    }

    public function content(): Content
    {
        $title = __('Sign in to :app', ['app' => resolve(MailBrand::class)->name()]);

        return new Content(
            view: 'mail.magic-link',
            text: 'mail.text.magic-link',
            with: [...$this->brandData(), 'title' => $title, 'preheader' => __('The link works once and expires in :minutes minutes.', ['minutes' => $this->expiresInMinutes])],
        );
    }
}
```

`resources/views/mail/magic-link.blade.php`:

```blade
@extends('mail.layout')

@section('content')
<p class="m-text" style="margin:0 0 12px;font-size:15px;line-height:24px;color:{{ $colors['light']['foreground'] }};">{{ __('Use the button to sign in as') }} <strong>{{ $email }}</strong>. {{ __('The link works once and expires in :minutes minutes.', ['minutes' => $expiresInMinutes]) }}</p>
@include('mail.partials.button', ['url' => $url, 'label' => __('Sign in')])
<p class="m-muted" style="margin:12px 0 4px;font-size:13px;line-height:20px;color:{{ $colors['light']['muted-foreground'] }};">{{ __('Or paste this link in your browser:') }}</p>
<p class="m-panel m-text" style="margin:0;padding:8px;background-color:{{ $colors['light']['muted'] }};border:1px dashed {{ $colors['light']['input'] }};border-radius:8px;font-family:'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace;font-size:13px;line-height:20px;word-break:break-all;color:{{ $colors['light']['foreground'] }};">{{ $url }}</p>
@endsection

@section('footer')
<p style="margin:0;">{{ __('You did not ask for this? Ignore this e-mail: nobody can sign in without the link.') }}</p>
@endsection
```

`resources/views/mail/text/magic-link.blade.php`:

```blade
{!! __('Use the button to sign in as') !!} {!! $email !!}. {!! __('The link works once and expires in :minutes minutes.', ['minutes' => $expiresInMinutes]) !!}

{!! $url !!}

{!! __('You did not ask for this? Ignore this e-mail: nobody can sign in without the link.') !!}
```

No `headers()` method: a security mail has no unsubscribe header (S22).

- [ ] **Step 6: The job**

`vendor/bin/sail artisan make:job Auth/SendMagicLink --no-interaction`:

```php
<?php

namespace App\Jobs\Auth;

use App\Actions\Auth\IssueMagicLink;
use App\Mail\MagicLinkMail;
use App\Models\MagicLink;
use App\Models\User;
use App\Support\Integrations\IntegrationAvailability;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Mail;

/**
 * Everything that depends on whether the address has an account happens
 * here, away from the request, so the request does the same work for every
 * address. The payload holds the address only, never a token.
 */
class SendMagicLink implements ShouldBeEncrypted, ShouldQueue
{
    use Queueable;

    public function __construct(public string $email) {}

    public function handle(IssueMagicLink $issue, IntegrationAvailability $availability): void
    {
        if (! $availability->emailEnabled()) {
            return;
        }

        $users = User::query()->whereRaw('lower(email) = ?', [$this->email])->limit(2)->get();

        if ($users->count() !== 1) {
            return;
        }

        $user = $users->sole();

        if (! $user->hasVerifiedEmail()) {
            return;
        }

        Mail::to($user)->sendNow(new MagicLinkMail($issue->handle($user), $user->email, MagicLink::LifetimeMinutes));
    }
}
```

`sendNow` matters: `MagicLinkMail` implements `ShouldQueue` (arch rule), and `send()` would queue it a second time with the URL in the payload. `Mail::to($user)` takes the locale from `HasLocalePreference`.

- [ ] **Step 7: Request, controllers, routes, limiter, login prop**

`vendor/bin/sail artisan make:request Auth/MagicLinkRequest --no-interaction`:

```php
<?php

namespace App\Http\Requests\Auth;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class MagicLinkRequest extends FormRequest
{
    /**
     * @return array<string, array<int, ValidationRule|string>>
     */
    public function rules(): array
    {
        return [
            'email' => ['required', 'string', 'email', 'max:255'],
        ];
    }
}
```

```php
<?php

namespace App\Http\Controllers;

use App\Http\Requests\Auth\MagicLinkRequest;
use App\Jobs\Auth\SendMagicLink;
use App\Models\MagicLink;
use App\Support\Auth\LoginAddress;
use App\Support\Integrations\IntegrationAvailability;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class MagicLinksController extends Controller
{
    private const int CooldownSeconds = 60;

    private const int PerAddressPerHour = 5;

    /**
     * The answer is the same whatever the address: the account is looked up
     * by the job, and the per-address limits are silent.
     */
    public function store(MagicLinkRequest $request, IntegrationAvailability $availability): RedirectResponse
    {
        $address = LoginAddress::normalise($request->validated('email'));

        if ($availability->emailEnabled() && $this->claimsSendingSlot($address)) {
            SendMagicLink::dispatch($address);
        }

        return back()->with('status', 'magic-link-sent');
    }

    /**
     * Shows who the link signs in. Nothing is consumed here: mail scanners
     * and link previews open links with GET.
     */
    public function show(Request $request, string $token): Response
    {
        $link = $request->hasValidSignature() ? MagicLink::findUsable($token) : null;

        $response = Inertia::render('auth/magic-link', [
            'email' => $link === null ? null : LoginAddress::mask($link->user->email),
            'confirmUrl' => $link === null ? null : route('magicLinks.sessions.store', $token),
        ])->toResponse($request);

        $response->headers->add(['Referrer-Policy' => 'no-referrer', 'Cache-Control' => 'no-store']);

        return $response;
    }

    private function claimsSendingSlot(string $address): bool
    {
        $key = LoginAddress::throttleKey($address);

        if (RateLimiter::tooManyAttempts("magic-link-cooldown:{$key}", 1)) {
            return false;
        }

        if (RateLimiter::tooManyAttempts("magic-link-hour:{$key}", self::PerAddressPerHour)) {
            return false;
        }

        RateLimiter::hit("magic-link-cooldown:{$key}", self::CooldownSeconds);
        RateLimiter::hit("magic-link-hour:{$key}", 3600);

        return true;
    }
}
```

```php
<?php

namespace App\Http\Controllers;

use App\Actions\Auth\CompleteLogin;
use App\Actions\Auth\ConsumeMagicLink;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class MagicLinkSessionsController extends Controller
{
    public function store(Request $request, string $token, ConsumeMagicLink $consume, CompleteLogin $completeLogin): RedirectResponse
    {
        $user = $consume->handle($token);

        if ($user === null) {
            return to_route('login')->withErrors(['email' => __('This sign-in link is no longer valid. Request a new one.')]);
        }

        return $completeLogin->handle($request, $user);
    }
}
```

`routes/web.php`, inside the existing `Route::middleware('guest')` group:

```php
    Route::post('magic-link', [MagicLinksController::class, 'store'])->middleware('throttle:magicLinks')->name('magicLinks.store');
    Route::get('magic-link/{token}', [MagicLinksController::class, 'show'])
        ->where('token', '[A-Za-z0-9]{64}')
        ->middleware('throttle:20,1,magicLinkOpens')
        ->name('magicLinks.show');
    Route::post('magic-link/{token}/session', [MagicLinkSessionsController::class, 'store'])
        ->where('token', '[A-Za-z0-9]{64}')
        ->middleware('throttle:20,1,magicLinkOpens')
        ->name('magicLinks.sessions.store');
```

`app/Providers/FortifyServiceProvider.php`, in `configureRateLimiting()`:

```php
        RateLimiter::for('magicLinks', fn (Request $request) => Limit::perMinute(10)
            ->by('magic-link-ip:'.$request->ip())
            ->response(fn (): RedirectResponse => back()->withErrors([
                'email' => __('Too many attempts. Wait a minute and try again.'),
            ])));
```

(import `Illuminate\Http\RedirectResponse`), and the login view gains one prop (import `App\Support\Integrations\IntegrationAvailability`):

```php
            'canUseMagicLink' => resolve(IntegrationAvailability::class)->emailEnabled(),
```

- [ ] **Step 8: A minimal page so that Inertia finds the component**

`resources/js/pages/auth/magic-link.tsx` (Task 17 gives it its final look):

```tsx
import { Head, router, setLayoutProps } from '@inertiajs/react';
import { useState } from 'react';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import { login } from '@/routes';

type Props = { email: string | null; confirmUrl: string | null };

export default function MagicLink({ email, confirmUrl }: Props) {
    const { t } = useTrans();
    const [processing, setProcessing] = useState(false);
    const usable = email !== null && confirmUrl !== null;

    setLayoutProps({
        title: usable ? t('Sign in') : t('This link no longer works'),
        description: usable
            ? t('You are about to sign in as :email.', { email })
            : t('It has expired or was already used. Request a new one from the log in page.'),
    });

    return (
        <>
            <Head title={t('Sign in')} />

            <div className="flex flex-col gap-4 text-center">
                {usable && (
                    <Button
                        type="button"
                        className="w-full"
                        autoFocus
                        disabled={processing}
                        data-test="magic-link-confirm-button"
                        onClick={() =>
                            router.post(
                                confirmUrl,
                                {},
                                {
                                    onStart: () => setProcessing(true),
                                    onFinish: () => setProcessing(false),
                                },
                            )
                        }
                    >
                        {processing && <Spinner />}
                        {t('Continue')}
                    </Button>
                )}
                <TextLink href={login()}>{t('Back to log in')}</TextLink>
            </div>
        </>
    );
}
```

- [ ] **Step 9: Preview entry**

```php
            'magic-link' => fn (): Mailable => new MagicLinkMail(url('/magic-link/'.str_repeat('a', 64).'?expires=0&signature=sample'), 'ada@example.com', MagicLink::LifetimeMinutes),
```

- [ ] **Step 10: Run the tests**

Run: `npm run build:front` then `vendor/bin/sail artisan test --compact tests/Feature/Auth tests/Feature/Mail tests/Feature/TranslationKeysTest.php tests/Feature/UuidPrimaryKeysTest.php tests/Arch`
Expected: PASS once the new keys are in the four language files (values in the translation table of Task 26): `Your sign-in link for :app`, `Sign in to :app`, `Use the button to sign in as`, `The link works once and expires in :minutes minutes.`, `Sign in`, `Or paste this link in your browser:`, `You did not ask for this? Ignore this e-mail: nobody can sign in without the link.`, `This sign-in link is no longer valid. Request a new one.`, `Too many attempts. Wait a minute and try again.`, `This link no longer works`, `You are about to sign in as :email.`, `It has expired or was already used. Request a new one from the log in page.`, `Back to log in`.

If `it('GET and HEAD …')` fails on `HEAD` with 405, the route list shows why; Laravel registers `HEAD` with every `GET` route, so a failure means the route was declared with another verb.

- [ ] **Step 11: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app database resources/views/mail resources/js/pages/auth/magic-link.tsx routes tests/Feature/Auth/MagicLinkTest.php lang
git commit -m "feat(auth): magic-link sign-in with a hashed single-use token, confirmation page and uniform answer"
```

### Task 7: E-mail code as a second factor — back end

**Files:**
- Create: migrations `add_two_factor_email_enabled_at_to_users_table`, `create_email_two_factor_codes_table`; `app/Enums/EmailCodePurpose.php`; `app/Models/EmailTwoFactorCode.php`; `database/factories/EmailTwoFactorCodeFactory.php`; `app/Support/Auth/UserAgentSummary.php`; `app/Actions/Auth/SendEmailTwoFactorCode.php`; `app/Actions/Auth/VerifyEmailTwoFactorCode.php`; `app/Mail/TwoFactorCodeMail.php`; `resources/views/mail/two-factor-code.blade.php`; `resources/views/mail/text/two-factor-code.blade.php`; `app/Http/Requests/Auth/TwoFactorChallengeRequest.php`; `app/Http/Requests/Auth/EmailCodeChallengeRequest.php`; `app/Http/Requests/Settings/EmailSecondFactorRequest.php`; `app/Http/Controllers/EmailChallengeCodesController.php`; `app/Http/Controllers/EmailCodeChallengesController.php`; `app/Http/Controllers/Settings/EmailSecondFactorsController.php`; `app/Http/Controllers/Settings/EmailSecondFactorCodesController.php`
- Modify: `app/Models/User.php` (property docblock, cast), `database/factories/UserFactory.php` (state), `app/Support/Auth/SecondFactors.php`, `app/Actions/Auth/StartSecondFactorChallenge.php`, `app/Providers/FortifyServiceProvider.php` (challenge view props, request binding, `two-factor` limiter), `app/Http/Controllers/Settings/SecurityController.php:19-51`, `routes/web.php`, `routes/settings.php`, `routes/console.php:40`, `app/Http/Controllers/MailPreviewsController.php`, `tests/Feature/Auth/SecondFactorDecisionTest.php`
- Test: `tests/Feature/Auth/EmailSecondFactorTest.php`

**Interfaces:**
- Consumes: Tasks 1, 5, 6.
- Produces:
  - `users.two_factor_email_enabled_at` (nullable timestamp, cast `datetime`); `UserFactory::withEmailSecondFactor()`
  - `enum EmailCodePurpose: string { case Login = 'login'; case Enable = 'enable'; }`
  - `EmailTwoFactorCode::LifetimeMinutes = 10`, `MaxAttempts = 5`, `hashCode(string $userId, EmailCodePurpose $purpose, string $code): string`
  - `SendEmailTwoFactorCode::handle(User $user, EmailCodePurpose $purpose, ?string $userAgent): bool`, `secondsUntilResend(User $user, EmailCodePurpose $purpose): int`, constants `CooldownSeconds = 60`, `HourlyCap = 5`
  - `VerifyEmailTwoFactorCode::handle(User $user, EmailCodePurpose $purpose, string $code): bool`
  - `SecondFactors::hasEmailCode(User $user): bool`; `methodsFor` now may return `[Totp, EmailCode]`
  - `new TwoFactorCodeMail(string $code, int $expiresInMinutes, ?string $device)`
  - Routes: `twoFactor.emailCodes.store` (`POST two-factor-challenge/email-code`), `twoFactor.emailChallenges.store` (`POST two-factor-challenge/email`), `emailSecondFactor.codes.store` (`POST settings/email-second-factor/code`), `emailSecondFactor.store` (`POST settings/email-second-factor`), `emailSecondFactor.destroy` (`DELETE settings/email-second-factor`)
  - Challenge page props: `methods: Array<'totp' | 'email'>`, `emailCode: { sentTo: string; resendIn: number; available: boolean } | null`
  - Security page prop: `emailSecondFactor: { available: boolean; enabled: boolean; address: string; resendIn: number }`

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Actions\Auth\IssueMagicLink;
use App\Actions\Auth\SendEmailTwoFactorCode;
use App\Enums\EmailCodePurpose;
use App\Enums\SecondFactorMethod;
use App\Mail\TwoFactorCodeMail;
use App\Models\EmailTwoFactorCode;
use App\Models\SocialAccount;
use App\Models\User;
use App\Support\Auth\SecondFactors;
use App\Support\Auth\UserAgentSummary;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Mail;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;

beforeEach(function () {
    config(['mail.default' => 'smtp']);
    Mail::fake();
});

function lastEmailCode(): string
{
    $code = '';
    Mail::assertQueued(TwoFactorCodeMail::class, function (TwoFactorCodeMail $mail) use (&$code): bool {
        $code = $mail->code;

        return true;
    });

    return $code;
}

function wrongCodeFor(string $code): string
{
    return $code === '000000' ? '111111' : '000000';
}

function startEmailChallenge(User $user): void
{
    test()->post(route('login'), ['email' => $user->email, 'password' => 'password'])->assertRedirect(route('two-factor.login'));
}

function confirmedPassword(): array
{
    return ['auth.password_confirmed_at' => time()];
}

it('challenges on every entry', function (string $entry, string $factor) {
    config(['services.google.client_id' => 'google-id', 'services.google.client_secret' => 'google-secret']);
    $user = $factor === 'totp' ? User::factory()->withTwoFactor()->create() : User::factory()->withEmailSecondFactor()->create();

    $response = match ($entry) {
        'password' => $this->post(route('login'), ['email' => $user->email, 'password' => 'password']),
        'sso' => (function () use ($user) {
            SocialAccount::factory()->for($user)->create(['provider' => 'google', 'provider_user_id' => 'g-1']);
            Socialite::fake('google', SocialiteUser::fake(['id' => 'g-1']));

            return $this->get(route('sso.callback', 'google'));
        })(),
        'magic-link' => $this->post(route('magicLinks.sessions.store', basename((string) parse_url(resolve(IssueMagicLink::class)->handle($user), PHP_URL_PATH)))),
    };

    $response->assertRedirect(route('two-factor.login'));
    $this->assertGuest();
    expect(session('login.id'))->toBe($user->id);
})->with(['password', 'sso', 'magic-link'])->with(['totp', 'email']);

it('lists the e-mail code among the factors', function () {
    $factors = resolve(SecondFactors::class);

    expect($factors->methodsFor(User::factory()->withEmailSecondFactor()->create()))->toBe([SecondFactorMethod::EmailCode])
        ->and($factors->methodsFor(User::factory()->withTwoFactor()->withEmailSecondFactor()->create()))->toBe([SecondFactorMethod::Totp, SecondFactorMethod::EmailCode]);
});

it('sends a code when the challenge starts for an e-mail-only user, and waits for a choice when an app is set too', function () {
    startEmailChallenge(User::factory()->withEmailSecondFactor()->create());
    Mail::assertQueuedCount(1);

    $this->flushSession();
    startEmailChallenge(User::factory()->withTwoFactor()->withEmailSecondFactor()->create());
    Mail::assertQueuedCount(1);
});

it('gives the challenge page its methods and the masked address', function () {
    $user = User::factory()->withEmailSecondFactor()->create(['email' => 'known@example.test']);
    startEmailChallenge($user);

    $this->get(route('two-factor.login'))->assertInertia(fn (Assert $page) => $page
        ->component('auth/two-factor-challenge')
        ->where('methods', ['email'])
        ->where('emailCode.sentTo', 'k…@example.test')
        ->where('emailCode.available', true)
        ->where('emailCode.resendIn', fn (int $seconds): bool => $seconds > 0 && $seconds <= 60));
});

it('signs in with the code, works once, and regenerates the session after the code', function () {
    $user = User::factory()->withEmailSecondFactor()->create();
    startEmailChallenge($user);
    $code = lastEmailCode();
    $before = session()->getId();

    $this->post(route('twoFactor.emailChallenges.store'), ['code' => $code])->assertRedirect(route('dashboard'));

    $this->assertAuthenticatedAs($user);
    expect(session()->getId())->not->toBe($before)->and(session()->has('login.id'))->toBeFalse();

    auth()->logout();
    $this->flushSession();
    $this->withSession(['login.id' => $user->id])
        ->post(route('twoFactor.emailChallenges.store'), ['code' => $code])
        ->assertRedirect(route('two-factor.login'));
    $this->assertGuest();
});

it('stores an HMAC, not the code', function () {
    $user = User::factory()->withEmailSecondFactor()->create();
    startEmailChallenge($user);
    $code = lastEmailCode();
    $row = EmailTwoFactorCode::query()->sole();

    expect($code)->toMatch('/^\d{6}$/')
        ->and($row->code_hash)->toBe(hash_hmac('sha256', "{$user->id}|login|{$code}", (string) config('app.key')))
        ->and($row->code_hash)->not->toBe(hash('sha256', $code))
        ->and((string) json_encode($row->getAttributes()))->not->toContain("\"{$code}\"")
        ->and(new TwoFactorCodeMail($code, 10, null))->toBeInstanceOf(ShouldBeEncrypted::class);
});

it('expires after 10 minutes', function () {
    $user = User::factory()->withEmailSecondFactor()->create();
    startEmailChallenge($user);
    $code = lastEmailCode();

    $this->travel(10)->minutes();
    $this->travel(1)->seconds();

    $this->post(route('twoFactor.emailChallenges.store'), ['code' => $code])->assertRedirect(route('two-factor.login'));
    $this->assertGuest();
});

it('the fifth wrong attempt kills the code', function () {
    $user = User::factory()->withEmailSecondFactor()->create();
    startEmailChallenge($user);
    $code = lastEmailCode();
    $this->withoutMiddleware(ThrottleRequests::class);

    foreach (range(1, 5) as $attempt) {
        $this->post(route('twoFactor.emailChallenges.store'), ['code' => wrongCodeFor($code)])
            ->assertRedirect(route('two-factor.login'));
    }

    $this->post(route('twoFactor.emailChallenges.store'), ['code' => $code])
        ->assertRedirect(route('two-factor.login'));
    $this->assertGuest();

    $this->travel(61)->seconds();
    $this->post(route('twoFactor.emailCodes.store'))->assertRedirect();
    Mail::assertQueuedCount(2);
});

it('throttles code attempts by challenge', function () {
    $user = User::factory()->withEmailSecondFactor()->create();
    startEmailChallenge($user);

    foreach (range(1, 5) as $attempt) {
        $this->post(route('twoFactor.emailChallenges.store'), ['code' => '000000']);
    }

    $this->post(route('twoFactor.emailChallenges.store'), ['code' => '000000'])->assertTooManyRequests();
});

it('does not resend within 60 seconds, and a resend invalidates the previous code', function () {
    $user = User::factory()->withEmailSecondFactor()->create();
    startEmailChallenge($user);
    $first = lastEmailCode();

    $this->post(route('twoFactor.emailCodes.store'))->assertRedirect()->assertSessionHasNoErrors();
    Mail::assertQueuedCount(1);

    $this->travel(61)->seconds();
    $this->post(route('twoFactor.emailCodes.store'))->assertRedirect();
    Mail::assertQueuedCount(2);

    expect(EmailTwoFactorCode::query()->count())->toBe(1);
    $second = EmailTwoFactorCode::query()->sole();

    if ($second->code_hash !== EmailTwoFactorCode::hashCode($user->id, EmailCodePurpose::Login, $first)) {
        $this->post(route('twoFactor.emailChallenges.store'), ['code' => $first])->assertRedirect(route('two-factor.login'));
        $this->assertGuest();
    }
});

it('stops at five codes an hour', function () {
    $user = User::factory()->withEmailSecondFactor()->create();
    $send = resolve(SendEmailTwoFactorCode::class);

    $sent = collect(range(1, 7))->map(function () use ($send, $user): bool {
        $result = $send->handle($user, EmailCodePurpose::Login, null);
        $this->travel(61)->seconds();

        return $result;
    });

    expect($sent->filter()->count())->toBe(5);

    $this->travel(1)->hours();

    expect($send->handle($user, EmailCodePurpose::Login, null))->toBeTrue();
});

it('a code of another purpose or user is refused', function () {
    $user = User::factory()->withEmailSecondFactor()->create();
    $other = User::factory()->withEmailSecondFactor()->create();
    resolve(SendEmailTwoFactorCode::class)->handle($user, EmailCodePurpose::Enable, null);
    $enableCode = lastEmailCode();

    $this->withSession(['login.id' => $user->id])
        ->post(route('twoFactor.emailChallenges.store'), ['code' => $enableCode])
        ->assertRedirect(route('two-factor.login'));
    $this->withSession(['login.id' => $other->id])
        ->post(route('twoFactor.emailChallenges.store'), ['code' => $enableCode])
        ->assertRedirect(route('two-factor.login'));

    $this->assertGuest();
});

it('a challenge for a deleted user goes back to login', function () {
    $user = User::factory()->withEmailSecondFactor()->create();
    startEmailChallenge($user);
    $user->delete();

    $this->post(route('twoFactor.emailChallenges.store'), ['code' => '123456'])->assertRedirect();
    $this->post(route('twoFactor.emailCodes.store'))->assertRedirect();
    $this->get(route('two-factor.login'))->assertRedirect(route('login'));
    $this->assertGuest();
});

it('refuses a code that is not six digits', function (mixed $code) {
    $user = User::factory()->withEmailSecondFactor()->create();
    startEmailChallenge($user);

    $this->post(route('twoFactor.emailChallenges.store'), ['code' => $code])->assertSessionHasErrors('code');
    $this->assertGuest();
})->with(['', '12345', '1234567', 'abcdef', '12 456', [['123456']]]);

it('the authenticator route refuses an e-mail code without a server error', function () {
    $user = User::factory()->withEmailSecondFactor()->create();
    startEmailChallenge($user);
    $code = lastEmailCode();

    $this->post(route('two-factor.login.store'), ['code' => $code])->assertRedirect(route('two-factor.login'));
    $this->post(route('two-factor.login.store'), ['recovery_code' => 'anything'])->assertRedirect(route('two-factor.login'));
    $this->assertGuest();
});

it('still accepts a recovery code for a user with an authenticator app', function () {
    $user = User::factory()->withTwoFactor()->withEmailSecondFactor()->create();
    $this->post(route('login'), ['email' => $user->email, 'password' => 'password']);

    $this->post(route('two-factor.login.store'), ['recovery_code' => 'recovery-code-1'])->assertRedirect(route('dashboard'));
    $this->assertAuthenticatedAs($user);
});

it('fails closed when mail does not deliver', function () {
    config(['mail.default' => 'log']);
    $user = User::factory()->withEmailSecondFactor()->create();

    startEmailChallenge($user);

    Mail::assertNothingQueued();
    $this->assertGuest();
    $this->get(route('two-factor.login'))->assertInertia(fn (Assert $page) => $page->where('emailCode.available', false));
});

it('enabling needs password confirmation and a received code', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->post(route('emailSecondFactor.codes.store'))->assertRedirect(route('password.confirm'));
    $this->actingAs($user)->post(route('emailSecondFactor.store'), ['code' => '123456'])->assertRedirect(route('password.confirm'));

    $this->actingAs($user)->withSession(confirmedPassword())->post(route('emailSecondFactor.codes.store'))->assertRedirect();
    $code = lastEmailCode();

    $this->actingAs($user)->withSession(confirmedPassword())
        ->post(route('emailSecondFactor.store'), ['code' => wrongCodeFor($code)])
        ->assertSessionHasErrors('code');
    expect($user->fresh()->two_factor_email_enabled_at)->toBeNull();

    $this->actingAs($user)->withSession(confirmedPassword())
        ->post(route('emailSecondFactor.store'), ['code' => $code])
        ->assertSessionHasNoErrors();
    expect($user->fresh()->two_factor_email_enabled_at)->not->toBeNull();
});

it('refuses to enable for a guest or an unverified account', function () {
    $this->post(route('emailSecondFactor.codes.store'))->assertRedirect(route('login'));

    $this->actingAs(User::factory()->unverified()->create())->withSession(confirmedPassword())
        ->post(route('emailSecondFactor.codes.store'))
        ->assertRedirect(route('verification.notice'));
});

it('disabling needs password confirmation', function () {
    $user = User::factory()->withEmailSecondFactor()->create();

    $this->actingAs($user)->delete(route('emailSecondFactor.destroy'))->assertRedirect(route('password.confirm'));
    expect($user->fresh()->two_factor_email_enabled_at)->not->toBeNull();

    $this->actingAs($user)->withSession(confirmedPassword())->delete(route('emailSecondFactor.destroy'))->assertRedirect();
    expect($user->fresh()->two_factor_email_enabled_at)->toBeNull();
});

it('gives the security page the state of the e-mail factor', function () {
    $user = User::factory()->withEmailSecondFactor()->create(['email' => 'known@example.test']);

    $this->actingAs($user)->withSession(confirmedPassword())->get(route('security.edit'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('emailSecondFactor.available', true)
            ->where('emailSecondFactor.enabled', true)
            ->where('emailSecondFactor.address', 'known@example.test')
            ->where('emailSecondFactor.resendIn', 0));
});

it('writes the code mail with the code in the subject, grouped, without an unsubscribe header', function () {
    $mail = new TwoFactorCodeMail('042917', 10, 'Firefox · macOS');

    $mail->assertHasSubject('042917 is your '.config('app.name').' verification code');
    $mail->assertSeeInHtml('042&nbsp;917', false);
    $mail->assertSeeInHtml('Firefox · macOS');
    expect(method_exists($mail, 'headers'))->toBeFalse();
});

it('reduces a user agent to fixed labels', function (?string $userAgent, ?string $expected) {
    expect(UserAgentSummary::describe($userAgent))->toBe($expected);
})->with([
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0', 'Firefox · macOS'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0', 'Edge · Windows'],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', 'Safari · iOS'],
    ['<script>alert(1)</script>', null],
    [null, null],
]);
```

`SecondFactorDecisionTest.php` keeps all its tests; the expected list of its source-scan test grows in Steps 8 and 10 and in Task 8, each time with the reason.

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Auth/EmailSecondFactorTest.php`
Expected: FAIL, `Call to undefined method Database\Factories\UserFactory::withEmailSecondFactor()`.

- [ ] **Step 3: Migrations, enum, model, factory state**

`vendor/bin/sail artisan make:migration add_two_factor_email_enabled_at_to_users_table --no-interaction`:

```php
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->timestamp('two_factor_email_enabled_at')->nullable();
        });
    }
```

`vendor/bin/sail artisan make:model EmailTwoFactorCode --migration --factory --no-interaction`:

```php
    public function up(): void
    {
        Schema::create('email_two_factor_codes', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->string('purpose', 16);
            $table->string('code_hash', 64);
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('sent_at');
            $table->timestamp('expires_at')->index();
            $table->timestamp('consumed_at')->nullable();

            $table->index(['user_id', 'purpose']);
        });
    }
```

```php
<?php

namespace App\Enums;

enum EmailCodePurpose: string
{
    case Login = 'login';
    case Enable = 'enable';
}
```

```php
<?php

namespace App\Models;

use App\Enums\EmailCodePurpose;
use Database\Factories\EmailTwoFactorCodeFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\MassPrunable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;
use SensitiveParameter;

/**
 * @property string $id
 * @property string $user_id
 * @property EmailCodePurpose $purpose
 * @property string $code_hash
 * @property int $attempts
 * @property Carbon $sent_at
 * @property Carbon $expires_at
 * @property Carbon|null $consumed_at
 */
class EmailTwoFactorCode extends Model
{
    /** @use HasFactory<EmailTwoFactorCodeFactory> */
    use HasFactory;

    use HasUuids;
    use MassPrunable;

    public const int LifetimeMinutes = 10;

    public const int MaxAttempts = 5;

    public $timestamps = false;

    /**
     * A code has a million values: a plain hash could be reversed from a
     * copy of the table, a keyed one cannot without the application key.
     */
    public static function hashCode(string $userId, EmailCodePurpose $purpose, #[SensitiveParameter] string $code): string
    {
        return hash_hmac('sha256', "{$userId}|{$purpose->value}|{$code}", (string) config('app.key'));
    }

    /** @return Builder<static> */
    public function prunable(): Builder
    {
        return static::query()->where('expires_at', '<', now()->subDay());
    }

    protected function casts(): array
    {
        return [
            'purpose' => EmailCodePurpose::class,
            'sent_at' => 'datetime',
            'expires_at' => 'datetime',
            'consumed_at' => 'datetime',
        ];
    }
}
```

Factory `definition()`:

```php
        return [
            'user_id' => User::factory(),
            'purpose' => EmailCodePurpose::Login,
            'code_hash' => str_repeat('0', 64),
            'attempts' => 0,
            'sent_at' => now(),
            'expires_at' => now()->addMinutes(EmailTwoFactorCode::LifetimeMinutes),
            'consumed_at' => null,
        ];
```

`app/Models/User.php`: add `@property Carbon|null $two_factor_email_enabled_at` to the docblock and `'two_factor_email_enabled_at' => 'datetime',` to `casts()`. It is **not** added to `#[Fillable]`. `database/factories/UserFactory.php`:

```php
    public function withEmailSecondFactor(): static
    {
        return $this->state(fn (array $attributes) => [
            'two_factor_email_enabled_at' => now(),
        ]);
    }
```

Add `EmailTwoFactorCode::class` to the `model:prune` list in `routes/console.php`.

- [ ] **Step 4: `UserAgentSummary`**

```php
<?php

namespace App\Support\Auth;

class UserAgentSummary
{
    /** @var array<string, string> Order matters: Edge and Opera also say Chrome, Chrome also says Safari. */
    private const array Browsers = ['Edg/' => 'Edge', 'OPR/' => 'Opera', 'Firefox/' => 'Firefox', 'Chrome/' => 'Chrome', 'Safari/' => 'Safari'];

    /** @var array<string, string> Order matters: iOS devices also say Mac OS X, Android also says Linux. */
    private const array Systems = ['iPhone' => 'iOS', 'iPad' => 'iOS', 'Android' => 'Android', 'Windows' => 'Windows', 'Mac OS X' => 'macOS', 'Linux' => 'Linux'];

    /**
     * Only labels of this class leave it: no part of the header is copied.
     */
    public static function describe(?string $userAgent): ?string
    {
        if ($userAgent === null) {
            return null;
        }

        $browser = self::firstLabel(self::Browsers, $userAgent);
        $system = self::firstLabel(self::Systems, $userAgent);

        if ($browser === null || $system === null) {
            return null;
        }

        return "{$browser} · {$system}";
    }

    /**
     * @param  array<string, string>  $labels
     */
    private static function firstLabel(array $labels, string $userAgent): ?string
    {
        foreach ($labels as $needle => $label) {
            if (str_contains($userAgent, $needle)) {
                return $label;
            }
        }

        return null;
    }
}
```

- [ ] **Step 5: Mailable and views**

```php
<?php

namespace App\Mail;

use App\Support\Mail\MailBrand;
use Illuminate\Contracts\Queue\ShouldBeEncrypted;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use SensitiveParameter;

class TwoFactorCodeMail extends BrandedMail implements ShouldBeEncrypted
{
    public function __construct(
        #[SensitiveParameter] public string $code,
        public int $expiresInMinutes,
        public ?string $device,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: __(':code is your :app verification code', [
            'code' => $this->code,
            'app' => resolve(MailBrand::class)->name(),
        ]));
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.two-factor-code',
            text: 'mail.text.two-factor-code',
            with: [
                ...$this->brandData(),
                'title' => __('Your verification code'),
                'preheader' => __('It expires in :minutes minutes.', ['minutes' => $this->expiresInMinutes]),
                'groups' => str_split($this->code, 3),
                'passwordUrl' => route('security.edit'),
            ],
        );
    }
}
```

`resources/views/mail/two-factor-code.blade.php`:

```blade
@extends('mail.layout')

@section('content')
<p class="m-text" style="margin:0 0 12px;font-size:15px;line-height:24px;color:{{ $colors['light']['foreground'] }};">{{ __('Enter this code to continue.') }} {{ __('It expires in :minutes minutes.', ['minutes' => $expiresInMinutes]) }}</p>
<p class="m-panel m-text" aria-label="{{ implode(' ', str_split($code)) }}" style="margin:16px 0;padding:16px;background-color:{{ $colors['light']['muted'] }};border:1px dashed {{ $colors['light']['input'] }};border-radius:8px;text-align:center;font-family:'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace;font-size:32px;line-height:40px;font-weight:bold;letter-spacing:4px;color:{{ $colors['light']['foreground'] }};">{{ $groups[0] }}&nbsp;{{ $groups[1] }}</p>
@if($device !== null)
<p class="m-muted" style="margin:12px 0 0;font-size:13px;line-height:20px;color:{{ $colors['light']['muted-foreground'] }};">{{ __('Requested from :device.', ['device' => $device]) }}</p>
@endif
@endsection

@section('footer')
<p style="margin:0;">{{ __('Not you? Someone knows your password.') }} <a class="m-muted" href="{{ $passwordUrl }}" style="color:{{ $colors['light']['muted-foreground'] }};">{{ __('Change your password') }}</a></p>
@endsection
```

`resources/views/mail/text/two-factor-code.blade.php`:

```blade
{!! __('Enter this code to continue.') !!} {!! __('It expires in :minutes minutes.', ['minutes' => $expiresInMinutes]) !!}

{!! $groups[0] !!} {!! $groups[1] !!}

{!! __('Not you? Someone knows your password.') !!} {!! __('Change your password') !!}: {!! $passwordUrl !!}
```

- [ ] **Step 6: Send and verify**

```php
<?php

namespace App\Actions\Auth;

use App\Enums\EmailCodePurpose;
use App\Mail\TwoFactorCodeMail;
use App\Models\EmailTwoFactorCode;
use App\Models\User;
use App\Support\Auth\UserAgentSummary;
use App\Support\Integrations\IntegrationAvailability;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;

class SendEmailTwoFactorCode
{
    public const int CooldownSeconds = 60;

    public const int HourlyCap = 5;

    public function __construct(private IntegrationAvailability $availability) {}

    /**
     * False when nothing was sent: mail does not deliver, the address is
     * not verified, the cooldown runs, or the hourly cap is reached.
     */
    public function handle(User $user, EmailCodePurpose $purpose, ?string $userAgent): bool
    {
        if (! $this->availability->emailEnabled()) {
            return false;
        }

        if (! $user->hasVerifiedEmail()) {
            return false;
        }

        if ($this->secondsUntilResend($user, $purpose) > 0) {
            return false;
        }

        $capKey = "email-code-hour:{$user->id}:{$purpose->value}";

        if (RateLimiter::tooManyAttempts($capKey, self::HourlyCap)) {
            return false;
        }

        RateLimiter::hit($capKey, 3600);

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        DB::transaction(function () use ($user, $purpose, $code): void {
            EmailTwoFactorCode::query()->where('user_id', $user->id)->where('purpose', $purpose)->delete();

            EmailTwoFactorCode::query()->forceCreate([
                'user_id' => $user->id,
                'purpose' => $purpose,
                'code_hash' => EmailTwoFactorCode::hashCode($user->id, $purpose, $code),
                'sent_at' => now(),
                'expires_at' => now()->addMinutes(EmailTwoFactorCode::LifetimeMinutes),
            ]);
        });

        Mail::to($user)->queue(new TwoFactorCodeMail($code, EmailTwoFactorCode::LifetimeMinutes, UserAgentSummary::describe($userAgent)));

        return true;
    }

    public function secondsUntilResend(User $user, EmailCodePurpose $purpose): int
    {
        $latest = EmailTwoFactorCode::query()
            ->where('user_id', $user->id)
            ->where('purpose', $purpose)
            ->latest('sent_at')
            ->first();

        if ($latest === null) {
            return 0;
        }

        return max(0, self::CooldownSeconds - (int) $latest->sent_at->diffInSeconds(now()));
    }
}
```

A resend replaces the row and so resets `attempts`; the hourly cap bounds the total: 5 codes × 5 attempts = 25 guesses an hour in a million, on top of the 5-per-minute route throttle.

```php
<?php

namespace App\Actions\Auth;

use App\Enums\EmailCodePurpose;
use App\Models\EmailTwoFactorCode;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use SensitiveParameter;

class VerifyEmailTwoFactorCode
{
    public function handle(User $user, EmailCodePurpose $purpose, #[SensitiveParameter] string $code): bool
    {
        return DB::transaction(function () use ($user, $purpose, $code): bool {
            $row = EmailTwoFactorCode::query()
                ->where('user_id', $user->id)
                ->where('purpose', $purpose)
                ->whereNull('consumed_at')
                ->where('expires_at', '>', now())
                ->lockForUpdate()
                ->first();

            if ($row === null) {
                return false;
            }

            if ($row->attempts >= EmailTwoFactorCode::MaxAttempts) {
                return false;
            }

            if (! hash_equals($row->code_hash, EmailTwoFactorCode::hashCode($user->id, $purpose, $code))) {
                $row->increment('attempts');

                return false;
            }

            $row->forceFill(['consumed_at' => now()])->save();

            return true;
        });
    }
}
```

- [ ] **Step 7: The shared decision learns the e-mail factor**

`app/Support/Auth/SecondFactors.php` — replace `methodsFor` and add `hasEmailCode`:

```php
    /**
     * @return array<int, SecondFactorMethod>
     */
    public function methodsFor(User $user): array
    {
        return array_values(array_filter([
            $this->hasTotp($user) ? SecondFactorMethod::Totp : null,
            $this->hasEmailCode($user) ? SecondFactorMethod::EmailCode : null,
        ]));
    }

    public function hasEmailCode(User $user): bool
    {
        return $user->two_factor_email_enabled_at !== null;
    }
```

The factor does not depend on whether mail delivers today: if an administrator turns mail off, an e-mail-only user is still challenged and cannot pass (fail closed), rather than being let in with one factor.

`app/Actions/Auth/StartSecondFactorChallenge.php` becomes:

```php
<?php

namespace App\Actions\Auth;

use App\Enums\EmailCodePurpose;
use App\Enums\SecondFactorMethod;
use App\Models\User;
use App\Support\Auth\SecondFactors;
use Illuminate\Http\Request;

class StartSecondFactorChallenge
{
    public function __construct(
        private SecondFactors $secondFactors,
        private SendEmailTwoFactorCode $sendCode,
    ) {}

    /**
     * A user whose only factor is the e-mail code gets it at once; with an
     * authenticator app too, the code is sent when they choose it.
     */
    public function handle(Request $request, User $user, bool $remember): void
    {
        $request->session()->put([
            'login.id' => $user->getKey(),
            'login.remember' => $remember,
        ]);

        if ($this->secondFactors->methodsFor($user) === [SecondFactorMethod::EmailCode]) {
            $this->sendCode->handle($user, EmailCodePurpose::Login, $request->userAgent());
        }
    }
}
```

- [ ] **Step 8: Challenge requests and controllers**

```php
<?php

namespace App\Http\Requests\Auth;

use Laravel\Fortify\Http\Requests\TwoFactorLoginRequest;

/**
 * Fortify decrypts the authenticator secret and the recovery codes without
 * checking that they exist. A user whose only factor is the e-mail code has
 * neither: both answers are "no", not a decryption error.
 */
class TwoFactorChallengeRequest extends TwoFactorLoginRequest
{
    public function hasValidCode(): bool
    {
        if ($this->challengedUser()->two_factor_secret === null) {
            return false;
        }

        return (bool) parent::hasValidCode();
    }

    public function validRecoveryCode(): ?string
    {
        if ($this->challengedUser()->two_factor_recovery_codes === null) {
            return null;
        }

        return parent::validRecoveryCode();
    }
}
```

This file reads `two_factor_secret`: add `'Http/Requests/Auth/TwoFactorChallengeRequest.php'` to the expected list of the source-scan test of Task 5 (sorted as `File::allFiles` returns them) with this reason in the commit message: it guards a decryption, it does not decide a challenge.

```php
<?php

namespace App\Http\Requests\Auth;

use Illuminate\Contracts\Validation\ValidationRule;

class EmailCodeChallengeRequest extends TwoFactorChallengeRequest
{
    /**
     * @return array<string, array<int, ValidationRule|string>>
     */
    public function rules(): array
    {
        return [
            'code' => ['required', 'string', 'digits:6'],
        ];
    }
}
```

```php
<?php

namespace App\Http\Controllers;

use App\Actions\Auth\SendEmailTwoFactorCode;
use App\Enums\EmailCodePurpose;
use App\Http\Requests\Auth\TwoFactorChallengeRequest;
use App\Support\Auth\SecondFactors;
use Illuminate\Http\RedirectResponse;

class EmailChallengeCodesController extends Controller
{
    public function store(TwoFactorChallengeRequest $request, SecondFactors $secondFactors, SendEmailTwoFactorCode $sendCode): RedirectResponse
    {
        $user = $request->challengedUser();

        if ($secondFactors->hasEmailCode($user)) {
            $sendCode->handle($user, EmailCodePurpose::Login, $request->userAgent());
        }

        return to_route('two-factor.login')->with('status', 'email-code-sent');
    }
}
```

```php
<?php

namespace App\Http\Controllers;

use App\Actions\Auth\VerifyEmailTwoFactorCode;
use App\Enums\EmailCodePurpose;
use App\Http\Requests\Auth\EmailCodeChallengeRequest;
use App\Support\Auth\SecondFactors;
use Illuminate\Support\Facades\Auth;
use Laravel\Fortify\Contracts\FailedTwoFactorLoginResponse;
use Laravel\Fortify\Contracts\TwoFactorLoginResponse;
use Laravel\Fortify\Events\TwoFactorAuthenticationFailed;
use Laravel\Fortify\Events\ValidTwoFactorAuthenticationCodeProvided;
use Symfony\Component\HttpFoundation\Response;

class EmailCodeChallengesController extends Controller
{
    /**
     * Ends like Fortify's own challenge: sign in, then a new session id.
     */
    public function store(EmailCodeChallengeRequest $request, SecondFactors $secondFactors, VerifyEmailTwoFactorCode $verify): Response
    {
        $user = $request->challengedUser();

        if (! $secondFactors->hasEmailCode($user) || ! $verify->handle($user, EmailCodePurpose::Login, $request->validated('code'))) {
            event(new TwoFactorAuthenticationFailed($user));

            return resolve(FailedTwoFactorLoginResponse::class)->toResponse($request);
        }

        event(new ValidTwoFactorAuthenticationCodeProvided($user));

        $request->session()->forget('login.id');

        Auth::login($user, $request->remember());

        $request->session()->regenerate();

        return resolve(TwoFactorLoginResponse::class)->toResponse($request);
    }
}
```

`challengedUser()` (Fortify) answers with the failed-login redirect when `login.id` is missing or points to a deleted user.

`routes/web.php`, inside the `guest` group:

```php
    Route::post('two-factor-challenge/email-code', [EmailChallengeCodesController::class, 'store'])
        ->middleware('throttle:6,1,emailChallengeCodes')
        ->name('twoFactor.emailCodes.store');
    Route::post('two-factor-challenge/email', [EmailCodeChallengesController::class, 'store'])
        ->middleware('throttle:two-factor')
        ->name('twoFactor.emailChallenges.store');
```

- [ ] **Step 9: Fortify provider — request binding, limiter key, challenge props**

In `app/Providers/FortifyServiceProvider.php`:

`configureSecondFactor()` gains (imports `App\Http\Requests\Auth\TwoFactorChallengeRequest`, `Laravel\Fortify\Http\Requests\TwoFactorLoginRequest`):

```php
        $this->app->bind(TwoFactorLoginRequest::class, TwoFactorChallengeRequest::class);
```

The `two-factor` limiter no longer shares one bucket between all requests that have no challenge:

```php
        RateLimiter::for('two-factor', fn (Request $request) => Limit::perMinute(5)->by(
            $request->session()->get('login.id') ?: $request->ip(),
        ));
```

The challenge view (imports `App\Actions\Auth\SendEmailTwoFactorCode`, `App\Enums\EmailCodePurpose`, `App\Enums\SecondFactorMethod`, `App\Models\User`, `App\Support\Auth\LoginAddress`, `App\Support\Auth\SecondFactors`, `App\Support\Integrations\IntegrationAvailability`):

```php
        Fortify::twoFactorChallengeView(function (Request $request) {
            $user = User::query()->find($request->session()->get('login.id'));
            $methods = $user === null ? [] : resolve(SecondFactors::class)->methodsFor($user);

            return Inertia::render('auth/two-factor-challenge', [
                'methods' => array_map(fn (SecondFactorMethod $method): string => $method->value, $methods),
                'emailCode' => $user === null || ! in_array(SecondFactorMethod::EmailCode, $methods, true) ? null : [
                    'sentTo' => LoginAddress::mask($user->email),
                    'resendIn' => resolve(SendEmailTwoFactorCode::class)->secondsUntilResend($user, EmailCodePurpose::Login),
                    'available' => resolve(IntegrationAvailability::class)->emailEnabled(),
                ],
                'status' => $request->session()->get('status'),
            ]);
        });
```

- [ ] **Step 10: Enable and disable in Security**

```php
<?php

namespace App\Http\Requests\Settings;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class EmailSecondFactorRequest extends FormRequest
{
    /**
     * @return array<string, array<int, ValidationRule|string>>
     */
    public function rules(): array
    {
        return [
            'code' => ['required', 'string', 'digits:6'],
        ];
    }
}
```

```php
<?php

namespace App\Http\Controllers\Settings;

use App\Actions\Auth\SendEmailTwoFactorCode;
use App\Enums\EmailCodePurpose;
use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class EmailSecondFactorCodesController extends Controller
{
    public function store(Request $request, SendEmailTwoFactorCode $sendCode): RedirectResponse
    {
        $sendCode->handle($request->user(), EmailCodePurpose::Enable, $request->userAgent());

        return back()->with('status', 'email-code-sent');
    }
}
```

```php
<?php

namespace App\Http\Controllers\Settings;

use App\Actions\Auth\VerifyEmailTwoFactorCode;
use App\Enums\EmailCodePurpose;
use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\EmailSecondFactorRequest;
use App\Models\EmailTwoFactorCode;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class EmailSecondFactorsController extends Controller
{
    public function store(EmailSecondFactorRequest $request, VerifyEmailTwoFactorCode $verify): RedirectResponse
    {
        $user = $request->user();

        if (! $verify->handle($user, EmailCodePurpose::Enable, $request->validated('code'))) {
            throw ValidationException::withMessages(['code' => __('The code is wrong or has expired.')]);
        }

        $user->forceFill(['two_factor_email_enabled_at' => now()])->save();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('E-mail code turned on.')]);

        return back();
    }

    public function destroy(Request $request): RedirectResponse
    {
        $user = $request->user();

        $user->forceFill(['two_factor_email_enabled_at' => null])->save();

        EmailTwoFactorCode::query()->where('user_id', $user->id)->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('E-mail code turned off.')]);

        return back();
    }
}
```

These two controllers write `two_factor_email_enabled_at`; they do not decide a challenge. Add both paths to the expected list of the source-scan test.

`routes/settings.php`, inside the `['auth', 'verified']` group:

```php
    Route::middleware([RequirePassword::class, 'throttle:6,1,emailSecondFactor'])->group(function (): void {
        Route::post('settings/email-second-factor/code', [EmailSecondFactorCodesController::class, 'store'])->name('emailSecondFactor.codes.store');
        Route::post('settings/email-second-factor', [EmailSecondFactorsController::class, 'store'])->name('emailSecondFactor.store');
        Route::delete('settings/email-second-factor', [EmailSecondFactorsController::class, 'destroy'])->name('emailSecondFactor.destroy');
    });
```

`SecurityController::edit` gains three injected parameters (`IntegrationAvailability $availability, SecondFactors $secondFactors, SendEmailTwoFactorCode $sendCode`) and, in `$props`:

```php
            'emailSecondFactor' => [
                'available' => $availability->emailEnabled(),
                'enabled' => $secondFactors->hasEmailCode($request->user()),
                'address' => $request->user()->email,
                'resendIn' => $sendCode->secondsUntilResend($request->user(), EmailCodePurpose::Enable),
            ],
```

- [ ] **Step 11: Preview entry**

```php
            'two-factor-code' => fn (): Mailable => new TwoFactorCodeMail('042917', EmailTwoFactorCode::LifetimeMinutes, 'Firefox · macOS'),
```

- [ ] **Step 12: Run the tests**

Run: `npm run build:front` then `vendor/bin/sail artisan test --compact tests/Feature/Auth tests/Feature/Settings tests/Feature/Mail tests/Feature/TranslationKeysTest.php tests/Feature/UuidPrimaryKeysTest.php tests/Arch`
Expected: PASS, with no edit to `TwoFactorChallengeTest`, `SecurityTest`, `SsoLoginTest`, `AuthenticationTest`, `PasswordConfirmationTest`. If `the authenticator route refuses an e-mail code…` returns 500, the container binding of `TwoFactorLoginRequest` is not taken: stop and report, do not work around it in a controller.

New keys, with their values in the translation table of Task 26: `:code is your :app verification code`, `Your verification code`, `Enter this code to continue.`, `It expires in :minutes minutes.`, `Requested from :device.`, `Not you? Someone knows your password.`, `Change your password`, `The code is wrong or has expired.`, `E-mail code turned on.`, `E-mail code turned off.`

- [ ] **Step 13: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app database resources/views/mail routes tests/Feature/Auth lang
git commit -m "feat(auth): e-mail code as a second factor on every sign-in entry"
```

### Task 8: Revocation on credential changes

**Files:**
- Create: `app/Actions/Auth/RevokeLoginSecrets.php`
- Modify: `app/Http/Controllers/Settings/SecurityController.php:56-65` (`update`), `app/Actions/Fortify/ResetUserPassword.php:20-29`, `app/Http/Controllers/Settings/ProfileController.php:47-60` (`update`)
- Test: `tests/Feature/Auth/LoginSecretRevocationTest.php`

**Interfaces:**
- Consumes: `MagicLink`, `EmailTwoFactorCode` (Tasks 6, 7).
- Produces: `RevokeLoginSecrets::handle(User $user, bool $turnEmailFactorOff = false): void`.

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Models\EmailTwoFactorCode;
use App\Models\MagicLink;
use App\Models\User;
use Illuminate\Support\Facades\Password;

function userWithLoginSecrets(): User
{
    $user = User::factory()->withEmailSecondFactor()->create();
    MagicLink::factory()->for($user)->create();
    EmailTwoFactorCode::factory()->for($user)->create();

    return $user;
}

function loginSecretsOf(User $user): int
{
    return MagicLink::query()->where('user_id', $user->id)->count() + EmailTwoFactorCode::query()->where('user_id', $user->id)->count();
}

it('deletes links and codes when the password is changed', function () {
    $user = userWithLoginSecrets();
    $bystander = userWithLoginSecrets();

    $this->actingAs($user)->put(route('user-password.update'), [
        'current_password' => 'password',
        'password' => 'A-new-long-passphrase-42',
        'password_confirmation' => 'A-new-long-passphrase-42',
    ])->assertSessionHasNoErrors();

    expect(loginSecretsOf($user))->toBe(0)
        ->and(loginSecretsOf($bystander))->toBe(2)
        ->and($user->fresh()->two_factor_email_enabled_at)->not->toBeNull();
});

it('deletes links and codes when the password is reset', function () {
    $user = userWithLoginSecrets();

    $this->post(route('password.update'), [
        'token' => Password::createToken($user),
        'email' => $user->email,
        'password' => 'A-new-long-passphrase-42',
        'password_confirmation' => 'A-new-long-passphrase-42',
    ])->assertSessionHasNoErrors();

    expect(loginSecretsOf($user))->toBe(0);
});

it('deletes links and codes and turns the e-mail factor off when the address changes', function () {
    $user = userWithLoginSecrets();

    $this->actingAs($user)->patch(route('profile.update'), ['name' => $user->name, 'email' => 'moved@example.test'])->assertSessionHasNoErrors();

    expect(loginSecretsOf($user))->toBe(0)
        ->and($user->fresh())->two_factor_email_enabled_at->toBeNull()->email_verified_at->toBeNull();
});

it('keeps everything when the profile is saved with the same address', function () {
    $user = userWithLoginSecrets();

    $this->actingAs($user)->patch(route('profile.update'), ['name' => 'Another Name', 'email' => $user->email])->assertSessionHasNoErrors();

    expect(loginSecretsOf($user))->toBe(2)->and($user->fresh()->two_factor_email_enabled_at)->not->toBeNull();
});

it('deletes the rows with the account', function () {
    $user = userWithLoginSecrets();

    $user->delete();

    expect(loginSecretsOf($user))->toBe(0);
});
```

Use the password that `tests/Feature/Settings/SecurityTest.php` and `PasswordResetTest.php` use if `Password::defaults()` rejects the one above.

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Auth/LoginSecretRevocationTest.php`
Expected: the first three tests FAIL (`Expected 0, got 2`); the last two pass already (same address; foreign-key cascade).

- [ ] **Step 3: The action and its three call sites**

```php
<?php

namespace App\Actions\Auth;

use App\Models\EmailTwoFactorCode;
use App\Models\MagicLink;
use App\Models\User;

class RevokeLoginSecrets
{
    /**
     * A link or a code issued before a credential changed must not outlive
     * the change.
     */
    public function handle(User $user, bool $turnEmailFactorOff = false): void
    {
        MagicLink::query()->where('user_id', $user->id)->delete();
        EmailTwoFactorCode::query()->where('user_id', $user->id)->delete();

        if (! $turnEmailFactorOff) {
            return;
        }

        $user->forceFill(['two_factor_email_enabled_at' => null])->save();
    }
}
```

`SecurityController::update` — add the parameter `RevokeLoginSecrets $revoke` and, after the `update([...])` call: `$revoke->handle($request->user());`

`ResetUserPassword::reset` — after the `forceFill([...])->save()`: `resolve(RevokeLoginSecrets::class)->handle($user);`

`ProfileController::update` — add the parameter `RevokeLoginSecrets $revoke` and replace the body up to the flash with:

```php
        $user = $request->user();
        $user->fill($request->validated());
        $emailChanged = $user->isDirty('email');

        if ($emailChanged) {
            $user->email_verified_at = null;
        }

        $user->save();

        if ($emailChanged) {
            $revoke->handle($user, turnEmailFactorOff: true);
        }
```

`RevokeLoginSecrets` writes `two_factor_email_enabled_at`: add `'Actions/Auth/RevokeLoginSecrets.php'` to the expected list of the source-scan test.

- [ ] **Step 4: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Auth tests/Feature/Settings`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app tests/Feature/Auth
git commit -m "feat(auth): password and address changes revoke outstanding links and codes"
```

### Task 9: Search route

**Files:**
- Create: `app/Support/LikePattern.php` (moved), `app/Actions/Search/SearchWorkspaceContent.php`, `app/Http/Requests/SearchRequest.php`, `app/Http/Controllers/SearchResultsController.php`
- Delete: `app/Mcp/Support/LikePattern.php`
- Modify: `app/Mcp/Tools/Retro/SearchBoards.php` (import), `tests/Feature/Mcp/SearchBoardsTest.php` (import), `routes/web.php` (inside the `['auth', 'verified']` group, line 212)
- Test: `tests/Feature/SearchTest.php`

**Interfaces:**
- Consumes: `CurrentTeamResolver::visibleTeams(): Collection<int, Team>` (teams of the current workspace the user can view — the same list as the shared prop `teams`).
- Produces: route `search.index` (`GET search?q=`), JSON `{ results: Array<{ kind: 'retro'|'poker'|'whiteboard'|'game'|'action'|'card', id: string, title: string, team: { id: string, name: string }, url: string, context: string|null }> }`, at most five per kind, newest first, kinds in that order; `context` is the retro's title for a card and `null` otherwise; `SearchWorkspaceContent::PerKind = 5`; `SearchWorkspaceContent::handle(Collection $teams, string $term): array` as written in Step 4, which Step 5 extends to `handle(Collection $teams, string $term, User $user): array`.

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Enums\WorkspaceRole;
use App\Models\ActionItem;
use App\Models\Card;
use App\Models\GameRoom;
use App\Models\PokerGame;
use App\Models\PokerTask;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\Workspace;

/**
 * @return array{0: User, 1: Team}
 */
function searcher(): array
{
    $team = Team::factory()->create(['name' => 'Atlas']);
    $user = teamMember($team);
    $user->forceFill(['current_workspace_id' => $team->workspace_id])->save();

    return [$user, $team];
}

function searchTitles(User $user, string $term): array
{
    return test()->actingAs($user)->getJson(route('search.index', ['q' => $term]))->assertOk()->json('results.*.title');
}

it('finds each kind of content of a visible team', function () {
    [$user, $team] = searcher();
    $retro = Retro::factory()->for($team)->create(['title' => 'Kraken retro']);
    $game = PokerGame::factory()->for($team)->create(['title' => 'Kraken poker']);
    $board = Whiteboard::factory()->for($team)->create(['title' => 'Kraken board']);
    $room = GameRoom::factory()->for($team)->create(['name' => 'Kraken room']);
    $item = ActionItem::factory()->withoutRetro($team, $user)->create(['content' => 'Feed the kraken']);

    $results = $this->actingAs($user)->getJson(route('search.index', ['q' => 'KRAKEN']))->assertOk()->json('results');

    expect(array_column($results, 'kind'))->toBe(['retro', 'poker', 'whiteboard', 'game', 'action'])
        ->and(array_column($results, 'id'))->toBe([$retro->id, $game->id, $board->id, $room->id, $item->id])
        ->and($results[0])->toBe([
            'kind' => 'retro',
            'id' => $retro->id,
            'title' => 'Kraken retro',
            'team' => ['id' => $team->id, 'name' => 'Atlas'],
            'url' => route('retros.show', $retro),
        ])
        ->and($results[1]['url'])->toBe(route('poker.show', $game))
        ->and($results[2]['url'])->toBe(route('whiteboards.show', $board))
        ->and($results[3]['url'])->toBe(route('games.show', $room))
        ->and($results[4]['url'])->toBe(route('workspaces.actionItems.index', ['workspace' => $team->workspace, 'item' => $item->id]));
});

it('finds a poker game by the title of one of its tasks', function () {
    [$user, $team] = searcher();
    $game = PokerGame::factory()->for($team)->create(['title' => 'Sprint 12']);
    PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Migrate the kraken']);

    expect(searchTitles($user, 'kraken'))->toBe(['Sprint 12']);
});

it('never returns a team the user cannot view in the same workspace', function () {
    [$user, $team] = searcher();
    $otherTeam = Team::factory()->for($team->workspace)->create();
    Retro::factory()->for($otherTeam)->create(['title' => 'Kraken secret']);
    GameRoom::factory()->for($otherTeam)->create(['name' => 'Kraken open room', 'access' => 'link']);
    ActionItem::factory()->withoutRetro($otherTeam, teamMember($otherTeam))->create(['content' => 'Kraken secret action']);

    expect(searchTitles($user, 'kraken'))->toBe([]);
});

it('lets a workspace admin see every team of that workspace and nothing of another', function () {
    $workspace = Workspace::factory()->create();
    $admin = workspaceManager($workspace);
    $admin->forceFill(['current_workspace_id' => $workspace->id])->save();
    Retro::factory()->for(Team::factory()->for($workspace))->create(['title' => 'Kraken here']);
    $elsewhere = Team::factory()->create();
    $elsewhere->workspace->members()->attach($admin, ['role' => WorkspaceRole::Member->value]);
    $elsewhere->members()->attach($admin);
    Retro::factory()->for($elsewhere)->create(['title' => 'Kraken elsewhere']);

    expect(searchTitles($admin, 'kraken'))->toBe(['Kraken here']);
});

it('drops the results of a team the user left', function () {
    [$user, $team] = searcher();
    Retro::factory()->for($team)->create(['title' => 'Kraken retro']);
    expect(searchTitles($user, 'kraken'))->toBe(['Kraken retro']);

    $team->members()->detach($user);

    expect(searchTitles($user, 'kraken'))->toBe([]);
});

it('returns nothing without a current workspace', function () {
    $user = User::factory()->create();

    expect(searchTitles($user, 'kraken'))->toBe([]);
});

it('never searches card text', function () {
    [$user, $team] = searcher();
    $retro = Retro::factory()->for($team)->create(['title' => 'Sprint 12']);
    Card::factory()->create(['retro_id' => $retro->id, 'content' => 'kraken on a card']);

    expect(searchTitles($user, 'kraken'))->toBe([]);
});

it('treats pattern characters as text', function (string $term, array $expected) {
    [$user, $team] = searcher();
    Retro::factory()->for($team)->create(['title' => '100% done_now \\o/']);
    Retro::factory()->for($team)->create(['title' => 'Plain title']);

    expect(searchTitles($user, $term))->toBe($expected);
})->with([
    ['%%', []],
    ['0%', ['100% done_now \\o/']],
    ['e_n', ['100% done_now \\o/']],
    ['__', []],
    ['\\o', ['100% done_now \\o/']],
    ["'; drop table retros; --", []],
]);

it('refuses a term that is too short, empty or too long', function (mixed $term) {
    [$user] = searcher();

    $this->actingAs($user)->getJson(route('search.index', ['q' => $term]))->assertUnprocessable()->assertJsonValidationErrors('q');
})->with(['a', '', '   ', str_repeat('a', 101), [['kraken']]]);

it('accepts an emoji and a two-character term', function () {
    [$user, $team] = searcher();
    Retro::factory()->for($team)->create(['title' => 'Rétro 🚀 Élan']);

    expect(searchTitles($user, '🚀 É'))->toBe(['Rétro 🚀 Élan'])
        ->and(searchTitles($user, 'ré'))->toBe(['Rétro 🚀 Élan']);
});

it('returns five results per kind, newest first', function () {
    [$user, $team] = searcher();
    foreach (range(1, 7) as $number) {
        Retro::factory()->for($team)->create(['title' => "Kraken {$number}", 'created_at' => now()->addMinutes($number)]);
    }

    expect(searchTitles($user, 'kraken'))->toBe(['Kraken 7', 'Kraken 6', 'Kraken 5', 'Kraken 4', 'Kraken 3']);
});

it('is closed to guests and unverified accounts', function () {
    $this->getJson(route('search.index', ['q' => 'kraken']))->assertUnauthorized();
    $this->get(route('search.index', ['q' => 'kraken']))->assertRedirect(route('login'));
    $this->actingAs(User::factory()->unverified()->create())->getJson(route('search.index', ['q' => 'kraken']))->assertForbidden();
});

it('allows sixty searches a minute', function () {
    [$user] = searcher();

    foreach (range(1, 60) as $attempt) {
        $this->actingAs($user)->getJson(route('search.index', ['q' => 'kraken']))->assertOk();
    }

    $this->actingAs($user)->getJson(route('search.index', ['q' => 'kraken']))->assertTooManyRequests();
});
```

If a factory used above has no `for($team)` relation name (`team`), pass `['team_id' => $team->id]` instead, as the neighbouring feature tests of that model do.

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/SearchTest.php`
Expected: FAIL, `Route [search.index] not defined`.

- [ ] **Step 3: Move `LikePattern`**

```bash
git mv app/Mcp/Support/LikePattern.php app/Support/LikePattern.php
```

Change its namespace to `App\Support`; replace `use App\Mcp\Support\LikePattern;` by `use App\Support\LikePattern;` in `app/Mcp/Tools/Retro/SearchBoards.php` and `tests/Feature/Mcp/SearchBoardsTest.php` (the only two users: `grep -rn "LikePattern" app tests`).

- [ ] **Step 4: Request, action, controller, route**

```php
<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class SearchRequest extends FormRequest
{
    /**
     * @return array<string, array<int, ValidationRule|string>>
     */
    public function rules(): array
    {
        return [
            'q' => ['required', 'string', 'min:2', 'max:100'],
        ];
    }
}
```

```php
<?php

namespace App\Actions\Search;

use App\Models\ActionItem;
use App\Models\GameRoom;
use App\Models\PokerGame;
use App\Models\Retro;
use App\Models\Team;
use App\Models\Whiteboard;
use App\Support\LikePattern;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * @phpstan-type SearchResult array{
 *     kind: string,
 *     id: string,
 *     title: string,
 *     team: array{id: string, name: string},
 *     url: string
 * }
 */
class SearchWorkspaceContent
{
    public const int PerKind = 5;

    /**
     * Every query starts from the ids of the given teams: what the caller
     * may not view cannot match. Card text and whiteboard elements are not
     * searched.
     *
     * @param  Collection<int, Team>  $teams  teams of one workspace
     * @return array<int, SearchResult>
     */
    public function handle(Collection $teams, string $term): array
    {
        if ($teams->isEmpty()) {
            return [];
        }

        $teamIds = $teams->modelKeys();
        $teamsById = $teams->keyBy('id');
        $workspace = $teams->first()->workspace;
        $pattern = LikePattern::contains($term);

        $retros = Retro::query()->whereIn('team_id', $teamIds)->where('title', 'ilike', $pattern)
            ->latest()->limit(self::PerKind)->get(['id', 'team_id', 'title'])
            ->map(fn (Retro $retro): array => $this->result('retro', $retro->id, $retro->title, $teamsById[$retro->team_id], route('retros.show', $retro)));

        $games = PokerGame::query()->whereIn('team_id', $teamIds)
            ->where(fn (Builder $query) => $query
                ->where('title', 'ilike', $pattern)
                ->orWhereHas('tasks', fn (Builder $tasks) => $tasks->where('title', 'ilike', $pattern)))
            ->latest()->limit(self::PerKind)->get(['id', 'team_id', 'title'])
            ->map(fn (PokerGame $game): array => $this->result('poker', $game->id, $game->title, $teamsById[$game->team_id], route('poker.show', $game)));

        $boards = Whiteboard::query()->whereIn('team_id', $teamIds)->where('title', 'ilike', $pattern)
            ->latest('updated_at')->limit(self::PerKind)->get(['id', 'team_id', 'title'])
            ->map(fn (Whiteboard $board): array => $this->result('whiteboard', $board->id, $board->title, $teamsById[$board->team_id], route('whiteboards.show', $board)));

        $rooms = GameRoom::query()->whereIn('team_id', $teamIds)->where('name', 'ilike', $pattern)
            ->latest()->limit(self::PerKind)->get(['id', 'team_id', 'name'])
            ->map(fn (GameRoom $room): array => $this->result('game', $room->id, (string) $room->name, $teamsById[$room->team_id], route('games.show', $room)));

        $items = ActionItem::query()->whereIn('team_id', $teamIds)->where('content', 'ilike', $pattern)
            ->latest()->limit(self::PerKind)->get(['id', 'team_id', 'content'])
            ->map(fn (ActionItem $item): array => $this->result('action', $item->id, $item->content, $teamsById[$item->team_id], route('workspaces.actionItems.index', ['workspace' => $workspace, 'item' => $item->id])));

        return collect([$retros, $games, $boards, $rooms, $items])->flatten(1)->values()->all();
    }

    /**
     * @return SearchResult
     */
    private function result(string $kind, string $id, string $title, Team $team, string $url): array
    {
        return [
            'kind' => $kind,
            'id' => $id,
            'title' => $title,
            'team' => ['id' => $team->id, 'name' => $team->name],
            'url' => $url,
        ];
    }
}
```

The `orWhereHas` is wrapped in a closure: without it the `OR` would escape the `whereIn('team_id', …)` and return other teams' games.

```php
<?php

namespace App\Http\Controllers;

use App\Actions\Search\SearchWorkspaceContent;
use App\Http\Requests\SearchRequest;
use App\Support\CurrentTeamResolver;
use Illuminate\Http\JsonResponse;

class SearchResultsController extends Controller
{
    public function index(SearchRequest $request, CurrentTeamResolver $teams, SearchWorkspaceContent $search): JsonResponse
    {
        return response()->json([
            'results' => $search->handle($teams->visibleTeams(), $request->validated('q')),
        ]);
    }
}
```

`routes/web.php`, inside `Route::middleware(['auth', 'verified'])`, next to the notification routes:

```php
    Route::get('search', [SearchResultsController::class, 'index'])->middleware('throttle:60,1,search')->name('search.index');
```

- [ ] **Step 5: Card text (owner's answer to D11: "titles + card text")**

Add to `tests/Feature/SearchTest.php`, before the implementation:

```php
it('finds the text of a card everyone may read, and of nobody else\'s hidden card', function () {
    $team = Team::factory()->create();
    $user = teamMember($team);
    $other = teamMember($team);
    $revealed = Retro::factory()->for($team)->inPhase(RetroPhase::Discussing)->create(['title' => 'Sprint 42']);
    $writing = Retro::factory()->for($team)->inPhase(RetroPhase::Writing)->create(['title' => 'Sprint 43']);
    $participantOf = fn (Retro $retro, User $member): Participant => Participant::factory()->for($retro)->create(['user_id' => $member->id]);
    $shown = Card::factory()->for($revealed)->create(['content' => 'The flaky checkout test', 'participant_id' => $participantOf($revealed, $other)->id]);
    $hidden = Card::factory()->for($writing)->create(['content' => 'A flaky secret', 'participant_id' => $participantOf($writing, $other)->id]);
    $own = Card::factory()->for($writing)->create(['content' => 'My flaky idea', 'participant_id' => $participantOf($writing, $user)->id]);

    $results = collect($this->actingAs($user)->getJson(route('search.index', ['q' => 'flaky']))->assertOk()->json('results'))
        ->where('kind', 'card');

    expect($results->pluck('id')->all())->toEqualCanonicalizing([$shown->id, $own->id])
        ->and($results->pluck('id'))->not->toContain($hidden->id)
        ->and($results->firstWhere('id', $shown->id))->toMatchArray([
            'title' => 'The flaky checkout test',
            'context' => 'Sprint 42',
            'url' => route('retros.show', $revealed),
        ])
        ->and(json_encode($results->all()))->not->toContain($other->name);
});

it('never returns a card of a team the user cannot view', function () {
    $user = teamMember(Team::factory()->create());
    $elsewhere = Retro::factory()->inPhase(RetroPhase::Discussing)->create();
    Card::factory()->for($elsewhere)->create(['content' => 'The flaky checkout test']);

    $this->actingAs($user)->getJson(route('search.index', ['q' => 'flaky']))
        ->assertOk()
        ->assertJsonMissing(['kind' => 'card']);
});
```

Use the card and participant factory states the neighbouring tests of `tests/Feature/Mcp/SearchBoardsTest.php` use to attach a card to its author; the assertions do not change. Run: FAIL (no `card` result).

Then, in `SearchWorkspaceContent`: `handle` takes the user as a third parameter (`handle(Collection $teams, string $term, User $user): array`; `SearchResultsController::index` passes `$request->user()`), every result gains the key `context` (`null` for the five kinds of Step 4: `result()` takes it as a sixth, nullable parameter), the class docblock loses "Card text … not searched" for "Whiteboard elements are not searched", and the cards are read with the visibility rule of `App\Mcp\Tools\Retro\SearchBoards::messages` (a card of a retro whose phase hides the others' cards matches only for its author), written in SQL so that a hidden card is never loaded (imports `App\Enums\RetroPhase`, `App\Models\Card`, `App\Models\Participant`, `App\Models\User`, `Illuminate\Support\Str`):

```php
        $ownParticipantIds = Participant::query()->where('user_id', $user->id)->select('id');
        $hidingRetroIds = Retro::query()->whereIn('phase', RetroPhase::hidingOthersCards())->select('id');

        $cards = Card::query()
            ->with('retro:id,team_id,title')
            ->whereIn('retro_id', Retro::query()->whereIn('team_id', $teamIds)->select('id'))
            ->where('content', 'ilike', $pattern)
            ->where(fn (Builder $query) => $query
                ->whereNotIn('retro_id', $hidingRetroIds)
                ->orWhereIn('participant_id', $ownParticipantIds))
            ->latest()->orderByDesc('id')->limit(self::PerKind)->get(['id', 'retro_id', 'content'])
            ->map(fn (Card $card): array => $this->result(
                'card',
                $card->id,
                Str::limit(Str::squish($card->content), 120),
                $teamsById[$card->retro->team_id],
                route('retros.show', $card->retro),
                $card->retro->title,
            ));

        return collect([$retros, $games, $boards, $rooms, $items, $cards])->flatten(1)->values()->all();
```

An existing test of Step 1 that compares a whole result gains `'context' => null`. The two `orWhere…` conditions sit in one closure, for the reason given above for the poker tasks. The result names no author: a card is found by its text, shown with its retro's title, and opens the retro.

- [ ] **Step 6: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/SearchTest.php tests/Feature/Mcp/SearchBoardsTest.php tests/Arch`
Expected: PASS. If the `Illuminate\Routing\Route` model keys differ from the names used (`retro`, `game`, `board`, `room`), `route()` throws `UrlGenerationException`: pass the parameter by name, e.g. `route('poker.show', ['game' => $game])`.

- [ ] **Step 7: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app routes tests
git commit -m "feat(search): search route scoped to the teams the user can view"
```

### Task 10: Forced SSO — instance setting `sso_required` and server-side enforcement (B33)

Owner's answers (2026-10-02, first and third rounds): the instance gets a setting "SSO required"; while it is in force **only SSO signs in** — password, magic link, passkey and form registration are refused on the server — with two ways back: instance admins can always sign in with their password **and a second factor**, and when no SSO provider is enabled the setting is ignored for everyone, with an alert shown to instance admins.

**Where the control lives.** Not on the Branding page: sign-in policy is not branding, and "Reset" on that page must never touch it. A third page of the administration area, Admin › Sign-in (`admin/sign-in`), beside Branding and Admins, behind the same `can:manageInstance` and `RequirePassword` middleware as its two siblings (`routes/admin.php`). The value is one more key of `App\Support\InstanceSettings`, read through one class, `App\Support\Auth\SignInPolicy`.

**The rules of `sso_required` (R1–R16).** S27, S28 and S29 hold them; each names its test (FS = `ForcedSsoTest`, SS = `SignInSettingsTest`).

| # | Rule | Test |
|---|---|---|
| R1 | **In force** when the stored value is true and at least one `SsoProvider` is enabled. | FS `is off by default`, FS `is ignored for everyone when no provider is enabled` |
| R2 | **Ignored without a provider.** Stored true with no enabled provider: every local way in works for everyone as if the setting were off, and every instance admin sees an alert on every page of the application until a provider is back or the setting is turned off. Nobody else sees it. | FS `is ignored for everyone when no provider is enabled`, FS `alerts instance admins, and nobody else, while the setting is ignored` |
| R3 | **SSO signs in everyone**, with the second factor of S1 after it. An existing verified account with no SSO identity is linked on its first SSO sign-in by the verified address the provider returns (`ResolveSsoUser`). | FS `signs in through single sign-on and links an account that had no SSO identity`, FS `still asks for the second factor after single sign-on` |
| R4 | **Password: instance admins only, and never alone.** While in force a password opens a session only for a user who is an instance admin **and** has a second factor (TOTP or e-mail code); the session opens after that factor, never before. | FS `challenges an instance admin who has a second factor, and signs in after it`, FS `refuses the right password of a member` |
| R5 | **An admin without a second factor has no password way in.** The right password is refused like a wrong one. This is the safe reading of "password + second factor": a password alone would make the admin account the weakest door of an instance that asked for SSO. An admin sets up a factor while signed in (through SSO, or before the setting is on). | FS `refuses the right password of an instance admin who has no second factor` |
| R6 | **The refusal says nothing.** A member with the right password, an admin without a second factor with the right password, and anyone with a wrong password get the same status, redirect, error key and message (`auth.failed`), after the same `Timebox`, with the same limiter increment. The login page is the same for every visitor: it cannot know who is an admin, so it offers the password form to everyone behind "Administrator sign-in". Only someone who already holds an admin's password learns, from the challenge, that the account is an admin's. | FS `gives one answer to a member, to an admin without a second factor and to a wrong password`, FS `tells the login page what is offered` |
| R7 | **Demotion takes the password away at once.** The policy reads `is_instance_admin` at the moment of the sign-in, and again when a challenge that a password started is completed: an admin demoted between the password and the code is refused. Sessions already open are not closed (as for everyone). | FS `refuses the password of a demoted admin`, FS `refuses to complete a password challenge for an admin demoted meanwhile` |
| R8 | **Promotion gives it at once**, if the user has a second factor. | FS `accepts the password of a newly promoted admin who has a second factor` |
| R9 | **The last admin** cannot be revoked (existing rule of `RevokeInstanceAdmin`). Nothing forces an admin to keep a second factor: if no admin has one, the password way back is closed and the other one (R2: the operator removes the provider configuration) is what is left. Admin › Sign-in says how many admins can use the password way back, and warns at zero. | existing `InstanceAdminsTest` `does not offer to revoke the last admin`; SS `counts the admins who can use the password way back` |
| R10 | **Passkey: refused for everyone**, instance admins included, with the package's one refusal. | FS `refuses a passkey for everyone while the setting is in force` |
| R11 | **Magic link: refused for everyone**, admins included. Nothing is sent, an outstanding link opens no session, the request keeps its uniform answer (S8); turning the setting on deletes the outstanding links. | FS `sends no magic link and keeps the uniform answer`, FS `refuses a link issued before the setting was turned on`, SS `turns it on and deletes the outstanding magic links` |
| R12 | **Form registration: refused.** | FS `closes form registration` |
| R13 | **Password reset: instance admins only, and the request does not say so.** The reset link is mailed only to an instance admin; every request gets the answer Fortify gives for a sent link. The two reset pages stay reachable (a page cannot be shown to admins only). A reset signs nobody in; a password a member sets with an old token opens nothing (R4). | FS `mails a reset link to an instance admin only and answers everyone the same` |
| R14 | **Turning it on** needs: an enabled provider; an acting admin who owns an SSO identity of an enabled provider (SSO works for at least one admin); an acting admin who has a second factor (the password way back works for at least one admin). **Turning it off** needs nothing but the page. | SS `refuses to turn it on when no provider is configured`, SS `refuses to turn it on when the acting admin has no SSO identity of an enabled provider`, SS `refuses to turn it on when the acting admin has no second factor`, SS `turns it off whatever the state of the providers and of the admin` |
| R15 | **Only an instance admin, with a confirmed password, reads or writes it**; a value that is not a boolean is refused; the Branding reset does not touch it. | SS `keeps the page away from members and behind password confirmation`, SS `refuses a value that is not a boolean`, SS `keeps the setting when branding is reset` |
| R16 | **Not concerned:** sessions already open, guests of a session, API tokens, password confirmation of a signed-in user. | Known limits |

**Files:**
- Create: `app/Support/Auth/SignInPolicy.php`, `app/Http/Controllers/Admin/SignInSettingsController.php`, `app/Http/Requests/Admin/SignInSettingsUpdateRequest.php`, `resources/js/pages/admin/sign-in.tsx` (minimal here, finished in Task 22)
- Modify: `app/Enums/InstanceSettingKey.php`, `app/Support/InstanceSettings.php`, `app/Http/Controllers/Admin/BrandingController.php:76-87` (`destroy`), `app/Actions/Auth/RedirectIfSecondFactorRequired.php`, `app/Actions/Auth/StartSecondFactorChallenge.php`, `app/Actions/Auth/CompleteLogin.php` (Task 5), `app/Http/Requests/Auth/TwoFactorChallengeRequest.php`, `app/Http/Controllers/EmailCodeChallengesController.php` (Task 7), `app/Jobs/Auth/SendMagicLink.php`, `app/Http/Controllers/MagicLinksController.php`, `app/Http/Controllers/MagicLinkSessionsController.php` (Task 6), `app/Providers/FortifyServiceProvider.php` (login and register views), `app/Providers/AppServiceProvider.php:77` (passkeys), `app/Models/User.php` (`sendPasswordResetNotification`), `app/Actions/Fortify/CreateNewUser.php`, `app/Exceptions/SsoLoginRefused.php`, `app/Http/Middleware/HandleInertiaRequests.php` (the alert), `routes/admin.php`
- Test: `tests/Feature/Auth/ForcedSsoTest.php` (FS), `tests/Feature/Admin/SignInSettingsTest.php` (SS)

**Interfaces:**
- Consumes: `InstanceSettings`, `SsoProvider::enabled()`, `SsoProvider::options()`, `User::socialAccounts()`, `SecondFactors::requiredFor()` (Tasks 5, 7), `MagicLink` (Task 6).
- Produces:
  - `InstanceSettingKey::SsoRequired = 'sso_required'`; `InstanceSettingKey::branding(): array<int, InstanceSettingKey>` (every key but `SsoRequired`)
  - `InstanceSettings::DefaultSsoRequired = false`, `InstanceSettings::ssoRequired(): bool` (the stored value)
  - `SignInPolicy::ssoRequired(): bool` (in force), `isIgnored(): bool` (stored, no provider), `allowsLocalCredentials(): bool` (magic link, form registration, passkey: `! ssoRequired()`), `allowsPassword(User $user): bool`, `allowsPasswordReset(User $user): bool`, `enablingBlockers(User $admin): array<int, string>` (values `no_provider`, `no_identity`, `no_second_factor`)
  - Session key `login.local` (boolean), written by `StartSecondFactorChallenge`: true when a password started the challenge
  - Routes `admin.signIn.edit` (`GET admin/sign-in`), `admin.signIn.update` (`PUT admin/sign-in`)
  - Inertia page `admin/sign-in` with props `ssoRequired: boolean` (stored), `inForce: boolean`, `providers: {key: string, label: string}[]`, `blockers: string[]`, `accountsWithoutSso: number`, `adminsWithPasswordWayBack: number`
  - Shared Inertia prop `signInAlert: 'sso_required_ignored' | null`, non-null only for a user who can `manageInstance`
  - Login page prop `ssoRequired: boolean` (in force); while it is, `canUseMagicLink` and `canRegister` are false and `canResetPassword` stays true (R13)

- [ ] **Step 1: Write the failing tests**

`tests/Feature/Auth/ForcedSsoTest.php`:

```php
<?php

use App\Actions\Auth\IssueMagicLink;
use App\Models\Passkey;
use App\Models\SocialAccount;
use App\Models\User;
use App\Support\Auth\SignInPolicy;
use App\Support\InstanceSettings;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Passkeys\Passkeys;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;

beforeEach(function () {
    config([
        'mail.default' => 'smtp',
        'services.google.client_id' => 'google-id',
        'services.google.client_secret' => 'google-secret',
        'services.github.client_id' => null,
        'services.github.client_secret' => null,
        'skrum.signup_mode' => 'open',
    ]);
    Mail::fake();
});

function requireSso(): void
{
    resolve(InstanceSettings::class)->set('sso_required', true);
}

it('is off by default', function () {
    $member = User::factory()->create();

    expect(resolve(SignInPolicy::class)->ssoRequired())->toBeFalse();

    $this->post(route('login.store'), ['email' => $member->email, 'password' => 'password'])->assertRedirect(route('dashboard'));
    $this->assertAuthenticatedAs($member);
});

it('refuses the right password of a member', function () {
    requireSso();
    $member = User::factory()->withTwoFactor()->create();

    $this->from(route('login'))->post(route('login.store'), ['email' => $member->email, 'password' => 'password'])
        ->assertRedirect(route('login'))
        ->assertSessionHasErrors(['email' => __('auth.failed')]);

    $this->assertGuest();
    expect(session('login.id'))->toBeNull();
});

it('refuses the right password of an instance admin who has no second factor', function () {
    requireSso();
    $admin = User::factory()->instanceAdmin()->create();

    $this->from(route('login'))->post(route('login.store'), ['email' => $admin->email, 'password' => 'password'])
        ->assertRedirect(route('login'))
        ->assertSessionHasErrors(['email' => __('auth.failed')]);

    $this->assertGuest();
    expect(session('login.id'))->toBeNull();
});

it('challenges an instance admin who has a second factor, and signs in after it', function () {
    requireSso();
    $admin = User::factory()->instanceAdmin()->withTwoFactor()->create();

    $this->post(route('login.store'), ['email' => $admin->email, 'password' => 'password'])
        ->assertRedirect(route('two-factor.login'));

    $this->assertGuest();
    expect(session('login.id'))->toBe($admin->id)->and(session('login.local'))->toBeTrue();

    $this->post(route('two-factor.login.store'), ['recovery_code' => 'recovery-code-1'])
        ->assertRedirect(route('dashboard'));

    $this->assertAuthenticatedAs($admin);
});

it('gives one answer to a member, to an admin without a second factor and to a wrong password', function () {
    requireSso();
    $member = User::factory()->create();
    $admin = User::factory()->instanceAdmin()->create();
    $answer = function (string $email, string $password): array {
        $response = $this->from(route('login'))->post(route('login.store'), ['email' => $email, 'password' => $password]);
        $answer = [$response->getStatusCode(), $response->headers->get('Location'), $response->getSession()->get('errors')?->getBag('default')->toArray()];
        $this->flushSession();

        return $answer;
    };

    $wrong = $answer($member->email, 'not-the-password');

    expect($answer($member->email, 'password'))->toBe($wrong)
        ->and($answer($admin->email, 'password'))->toBe($wrong)
        ->and($answer($admin->email, 'not-the-password'))->toBe($wrong)
        ->and($answer('nobody@example.test', 'password'))->toBe($wrong);
});

it('refuses the password of a demoted admin', function () {
    requireSso();
    $admin = User::factory()->instanceAdmin()->withTwoFactor()->create();
    User::factory()->instanceAdmin()->create();
    $admin->forceFill(['is_instance_admin' => false])->save();

    $this->post(route('login.store'), ['email' => $admin->email, 'password' => 'password'])->assertSessionHasErrors('email');

    $this->assertGuest();
    expect(session('login.id'))->toBeNull();
});

it('refuses to complete a password challenge for an admin demoted meanwhile', function () {
    requireSso();
    $admin = User::factory()->instanceAdmin()->withTwoFactor()->create();
    $this->post(route('login.store'), ['email' => $admin->email, 'password' => 'password'])->assertRedirect(route('two-factor.login'));

    $admin->forceFill(['is_instance_admin' => false])->save();

    $this->post(route('two-factor.login.store'), ['recovery_code' => 'recovery-code-1'])->assertRedirect(route('login'));

    $this->assertGuest();
});

it('still completes a challenge that single sign-on started for someone who is not an admin', function () {
    requireSso();
    $member = User::factory()->withTwoFactor()->create();
    SocialAccount::factory()->for($member)->create(['provider' => 'google', 'provider_user_id' => 'g-80']);
    Socialite::fake('google', SocialiteUser::fake(['id' => 'g-80']));
    $this->get(route('sso.callback', 'google'))->assertRedirect(route('two-factor.login'));

    expect(session('login.local'))->toBeFalse();

    $this->post(route('two-factor.login.store'), ['recovery_code' => 'recovery-code-1'])->assertRedirect(route('dashboard'));

    $this->assertAuthenticatedAs($member);
});

it('accepts the password of a newly promoted admin who has a second factor', function () {
    requireSso();
    $user = User::factory()->withTwoFactor()->create();
    $user->forceFill(['is_instance_admin' => true])->save();

    $this->post(route('login.store'), ['email' => $user->email, 'password' => 'password'])->assertRedirect(route('two-factor.login'));
});

it('is ignored for everyone when no provider is enabled', function () {
    requireSso();
    config(['services.google.client_id' => null]);
    $member = User::factory()->create();

    expect(resolve(SignInPolicy::class)->ssoRequired())->toBeFalse();

    $this->get(route('login'))->assertInertia(fn (Assert $page) => $page->where('ssoRequired', false)->where('canUseMagicLink', true));
    $this->post(route('login.store'), ['email' => $member->email, 'password' => 'password'])->assertRedirect(route('dashboard'));
    $this->assertAuthenticatedAs($member);
    expect(Passkeys::allowsLogin(Request::create('/'), (new Passkey)->setRelation('user', $member)))->toBeTrue();
});

it('alerts instance admins, and nobody else, while the setting is ignored', function () {
    requireSso();
    $admin = User::factory()->instanceAdmin()->create();
    $member = User::factory()->create();

    $this->actingAs($admin)->get(route('appearance.edit'))->assertInertia(fn (Assert $page) => $page->where('signInAlert', null));

    config(['services.google.client_id' => null]);

    $this->actingAs($admin)->get(route('appearance.edit'))->assertInertia(fn (Assert $page) => $page->where('signInAlert', 'sso_required_ignored'));
    $this->actingAs($member)->get(route('appearance.edit'))->assertInertia(fn (Assert $page) => $page->where('signInAlert', null));

    resolve(InstanceSettings::class)->set('sso_required', false);

    $this->actingAs($admin)->get(route('appearance.edit'))->assertInertia(fn (Assert $page) => $page->where('signInAlert', null));
});

it('sends no magic link and keeps the uniform answer', function () {
    requireSso();
    $user = User::factory()->create();

    $this->from(route('login'))->post(route('magicLinks.store'), ['email' => $user->email])
        ->assertRedirect(route('login'))
        ->assertSessionHas('status', 'magic-link-sent')
        ->assertSessionHasNoErrors();

    Mail::assertNothingSent();
});

it('refuses a link issued before the setting was turned on', function () {
    $member = User::factory()->create();
    $url = resolve(IssueMagicLink::class)->handle($member);
    $token = basename((string) parse_url($url, PHP_URL_PATH));
    requireSso();

    $this->get($url)->assertInertia(fn (Assert $page) => $page->where('confirmUrl', null)->where('email', null));
    $this->post(route('magicLinks.sessions.store', $token))->assertRedirect(route('login'))->assertSessionHasErrors('email');

    $this->assertGuest();
});

it('tells the login page what is offered', function () {
    $this->get(route('login'))->assertInertia(fn (Assert $page) => $page
        ->where('ssoRequired', false)
        ->where('canUseMagicLink', true)
        ->where('canRegister', true)
        ->where('canResetPassword', true));

    requireSso();

    $this->get(route('login'))->assertInertia(fn (Assert $page) => $page
        ->where('ssoRequired', true)
        ->where('canUseMagicLink', false)
        ->where('canRegister', false)
        ->where('canResetPassword', true)
        ->has('ssoProviders', 1));
});

it('closes form registration', function () {
    User::factory()->instanceAdmin()->create();
    requireSso();

    $this->get(route('register'))->assertForbidden();
    $this->post(route('register.store'), [
        'name' => 'Ada',
        'email' => 'ada@example.test',
        'password' => 'a-long-enough-password',
        'password_confirmation' => 'a-long-enough-password',
    ])->assertSessionHasErrors('email');

    $this->assertGuest();
    expect(User::query()->where('email', 'ada@example.test')->exists())->toBeFalse();
});

it('mails a reset link to an instance admin only and answers everyone the same', function () {
    requireSso();
    $member = User::factory()->create();
    $admin = User::factory()->instanceAdmin()->create();
    Notification::fake();

    $forMember = $this->post(route('password.email'), ['email' => $member->email]);
    $forAdmin = $this->post(route('password.email'), ['email' => $admin->email]);

    Notification::assertNotSentTo($member, ResetPassword::class);
    Notification::assertSentTo($admin, ResetPassword::class);
    $forMember->assertSessionHasNoErrors();
    expect($forMember->getStatusCode())->toBe($forAdmin->getStatusCode())
        ->and($forMember->getSession()->get('status'))->toBe($forAdmin->getSession()->get('status'));
    $this->get(route('password.request'))->assertOk();
});

it('refuses a passkey for everyone while the setting is in force', function (bool $isAdmin) {
    $passkey = (new Passkey)->setRelation('user', User::factory()->withTwoFactor()->create(['is_instance_admin' => $isAdmin]));

    expect(Passkeys::allowsLogin(Request::create('/'), $passkey))->toBeTrue();

    requireSso();

    expect(Passkeys::allowsLogin(Request::create('/'), $passkey))->toBeFalse();
})->with(['member' => false, 'instance admin' => true]);

it('signs in through single sign-on and links an account that had no SSO identity', function () {
    requireSso();
    $member = User::factory()->create(['email' => 'member@example.test']);
    Socialite::fake('google', SocialiteUser::fake(['id' => 'g-77', 'email' => 'Member@example.test', 'email_verified' => true]));

    $this->get(route('sso.callback', 'google'))->assertRedirect(route('dashboard'));

    $this->assertAuthenticatedAs($member);
    expect(SocialAccount::query()->where('user_id', $member->id)->where('provider_user_id', 'g-77')->exists())->toBeTrue();
});

it('still asks for the second factor after single sign-on', function () {
    requireSso();
    $member = User::factory()->withTwoFactor()->create();
    SocialAccount::factory()->for($member)->create(['provider' => 'google', 'provider_user_id' => 'g-79']);
    Socialite::fake('google', SocialiteUser::fake(['id' => 'g-79']));

    $this->get(route('sso.callback', 'google'))->assertRedirect(route('two-factor.login'));

    $this->assertGuest();
});

it('does not send a refused single sign-on to the password when the setting is in force', function () {
    requireSso();
    User::factory()->unverified()->create(['email' => 'pending@example.test']);
    Socialite::fake('google', SocialiteUser::fake(['id' => 'g-78', 'email' => 'pending@example.test', 'email_verified' => true]));

    $this->get(route('sso.callback', 'google'))
        ->assertRedirect(route('login'))
        ->assertSessionHasErrors(['email' => 'An account already uses this email address and could not be matched to your single sign-on identity. Ask an administrator of this instance.']);

    $this->assertGuest();
});
```

`tests/Feature/Admin/SignInSettingsTest.php` (the helper `actingAsInstanceAdmin` is the one of `InstanceAdminsTest.php`; Pest loads the functions of every test file, so it is not declared twice):

```php
<?php

use App\Actions\Auth\IssueMagicLink;
use App\Models\MagicLink;
use App\Models\SocialAccount;
use App\Models\User;
use App\Support\InstanceSettings;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    config([
        'services.google.client_id' => 'google-id',
        'services.google.client_secret' => 'google-secret',
        'services.github.client_id' => null,
        'services.github.client_secret' => null,
    ]);
});

function actingAsInstanceAdminWithSecondFactor(mixed $test): User
{
    $admin = User::factory()->instanceAdmin()->withTwoFactor()->create();

    $test->actingAs($admin)->withSession(['auth.password_confirmed_at' => time()]);

    return $admin;
}

it('shows the setting, the providers and what stands in the way', function () {
    $admin = actingAsInstanceAdmin($this);
    User::factory()->count(2)->create();
    SocialAccount::factory()->for(User::factory())->create();

    $this->get(route('admin.signIn.edit'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/sign-in')
            ->where('ssoRequired', false)
            ->where('inForce', false)
            ->where('providers', [['key' => 'google', 'label' => 'Google']])
            ->where('blockers', ['no_identity', 'no_second_factor'])
            ->where('accountsWithoutSso', 3));

    SocialAccount::factory()->for($admin)->create(['provider' => 'google']);

    $this->get(route('admin.signIn.edit'))->assertInertia(fn (Assert $page) => $page
        ->where('blockers', ['no_second_factor'])
        ->where('accountsWithoutSso', 2));
});

it('counts the admins who can use the password way back', function () {
    actingAsInstanceAdmin($this);
    User::factory()->instanceAdmin()->withTwoFactor()->create();
    User::factory()->withTwoFactor()->create();

    $this->get(route('admin.signIn.edit'))->assertInertia(fn (Assert $page) => $page->where('adminsWithPasswordWayBack', 1));
});

it('refuses to turn it on when the acting admin has no second factor', function () {
    $admin = actingAsInstanceAdmin($this);
    SocialAccount::factory()->for($admin)->create(['provider' => 'google']);

    $this->put(route('admin.signIn.update'), ['sso_required' => true])->assertSessionHasErrors('sso_required');

    expect(resolve(InstanceSettings::class)->ssoRequired())->toBeFalse();
});

it('says when the stored setting is not in force', function () {
    actingAsInstanceAdmin($this);
    resolve(InstanceSettings::class)->set('sso_required', true);
    config(['services.google.client_id' => null]);

    $this->get(route('admin.signIn.edit'))->assertInertia(fn (Assert $page) => $page
        ->where('ssoRequired', true)
        ->where('inForce', false)
        ->where('blockers', ['no_provider']));
});

it('refuses to turn it on when no provider is configured', function () {
    $admin = actingAsInstanceAdminWithSecondFactor($this);
    SocialAccount::factory()->for($admin)->create(['provider' => 'google']);
    config(['services.google.client_id' => null]);

    $this->put(route('admin.signIn.update'), ['sso_required' => true])->assertSessionHasErrors('sso_required');

    expect(resolve(InstanceSettings::class)->ssoRequired())->toBeFalse();
});

it('refuses to turn it on when the acting admin has no SSO identity of an enabled provider', function (?string $provider) {
    $admin = actingAsInstanceAdminWithSecondFactor($this);

    if ($provider !== null) {
        SocialAccount::factory()->for($admin)->create(['provider' => $provider]);
    }

    $this->put(route('admin.signIn.update'), ['sso_required' => true])->assertSessionHasErrors('sso_required');

    expect(resolve(InstanceSettings::class)->ssoRequired())->toBeFalse();
})->with(['no identity' => null, 'identity of a provider that is not enabled' => 'github']);

it('turns it on and deletes the outstanding magic links', function () {
    $admin = actingAsInstanceAdminWithSecondFactor($this);
    SocialAccount::factory()->for($admin)->create(['provider' => 'google']);
    resolve(IssueMagicLink::class)->handle(User::factory()->create());

    $this->put(route('admin.signIn.update'), ['sso_required' => true])
        ->assertRedirect(route('admin.signIn.edit'))
        ->assertSessionHasNoErrors();

    expect(resolve(InstanceSettings::class)->ssoRequired())->toBeTrue()
        ->and(MagicLink::query()->count())->toBe(0);
});

it('turns it off whatever the state of the providers and of the admin', function () {
    actingAsInstanceAdmin($this);
    resolve(InstanceSettings::class)->set('sso_required', true);
    config(['services.google.client_id' => null]);

    $this->put(route('admin.signIn.update'), ['sso_required' => false])->assertSessionHasNoErrors();

    expect(resolve(InstanceSettings::class)->ssoRequired())->toBeFalse();
});

it('keeps the setting when branding is reset', function () {
    actingAsInstanceAdmin($this);
    resolve(InstanceSettings::class)->setMany(['sso_required' => true, 'brand_color' => '#2b63b0']);

    $this->delete(route('admin.branding.destroy'))->assertRedirect(route('admin.branding.edit'));

    expect(resolve(InstanceSettings::class)->ssoRequired())->toBeTrue()
        ->and(resolve(InstanceSettings::class)->brandColor())->toBeNull();
});

it('refuses a value that is not a boolean', function (mixed $value) {
    actingAsInstanceAdmin($this);

    $this->put(route('admin.signIn.update'), ['sso_required' => $value])->assertSessionHasErrors('sso_required');
})->with(['maybe', null, [[true]]]);

it('keeps the page away from members and behind password confirmation', function () {
    $this->actingAs(User::factory()->create())->get(route('admin.signIn.edit'))->assertForbidden();
    $this->actingAs(User::factory()->create())->put(route('admin.signIn.update'), ['sso_required' => true])->assertForbidden();

    $this->actingAs(User::factory()->instanceAdmin()->create())
        ->get(route('admin.signIn.edit'))
        ->assertRedirect(route('password.confirm'));

    expect(resolve(InstanceSettings::class)->ssoRequired())->toBeFalse();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Auth/ForcedSsoTest.php tests/Feature/Admin/SignInSettingsTest.php`
Expected: FAIL, `Class "App\Support\Auth\SignInPolicy" not found`.

`SecondFactors` (Task 5, extended by Task 7) is not a singleton and holds no state: `SignInPolicy` may take it in its constructor (Octane).

- [ ] **Step 3: The setting**

`app/Enums/InstanceSettingKey.php` gains a case and a method:

```php
    case SsoRequired = 'sso_required';

    /**
     * The keys the Branding screen owns, and the only ones its reset clears.
     *
     * @return array<int, self>
     */
    public static function branding(): array
    {
        return array_values(array_filter(self::cases(), fn (self $key): bool => $key !== self::SsoRequired));
    }
```

`app/Support/InstanceSettings.php`: a constant beside the other defaults, a reader, the boolean arm of `normalise`, and the key in `all()` with its line in the array shape (`sso_required: bool`):

```php
    public const bool DefaultSsoRequired = false;
```

```php
    public function ssoRequired(): bool
    {
        return $this->storedBool(InstanceSettingKey::SsoRequired) ?? self::DefaultSsoRequired;
    }
```

```php
            InstanceSettingKey::PoweredBy,
            InstanceSettingKey::AvatarMemberChoice,
            InstanceSettingKey::GifEnabled,
            InstanceSettingKey::SsoRequired => $this->booleanFrom($key, $value),
```

```php
            InstanceSettingKey::SsoRequired->value => $this->ssoRequired(),
```

`BrandingController::destroy` clears **every** key of the enum today (`array_column(InstanceSettingKey::cases(), 'value')`), which would turn the setting off from the Branding page. It becomes:

```php
        $settings->setMany(array_fill_keys(array_column(InstanceSettingKey::branding(), 'value'), null));
```

- [ ] **Step 4: `SignInPolicy`**

`vendor/bin/sail artisan make:class Support/Auth/SignInPolicy --no-interaction`:

```php
<?php

namespace App\Support\Auth;

use App\Enums\SsoProvider;
use App\Models\User;
use App\Support\InstanceSettings;

/**
 * The one answer to "which ways in does this instance accept". Every entry
 * point asks it; none reads the setting by itself.
 */
class SignInPolicy
{
    public const string NoProvider = 'no_provider';

    public const string NoIdentity = 'no_identity';

    public const string NoSecondFactor = 'no_second_factor';

    public function __construct(private InstanceSettings $settings, private SecondFactors $secondFactors) {}

    /**
     * In force only while a provider is enabled (R1).
     */
    public function ssoRequired(): bool
    {
        if (! $this->settings->ssoRequired()) {
            return false;
        }

        return SsoProvider::enabled() !== [];
    }

    /**
     * Stored, and ignored because no provider is enabled (R2).
     */
    public function isIgnored(): bool
    {
        if (! $this->settings->ssoRequired()) {
            return false;
        }

        return SsoProvider::enabled() === [];
    }

    /**
     * Magic link, form registration and passkey: for nobody while the setting is in force.
     */
    public function allowsLocalCredentials(): bool
    {
        return ! $this->ssoRequired();
    }

    /**
     * While the setting is in force a password is the way back of instance
     * admins, and only with a second factor behind it (R4, R5).
     */
    public function allowsPassword(User $user): bool
    {
        if (! $this->ssoRequired()) {
            return true;
        }

        if ($user->is_instance_admin !== true) {
            return false;
        }

        return $this->secondFactors->requiredFor($user);
    }

    public function allowsPasswordReset(User $user): bool
    {
        if (! $this->ssoRequired()) {
            return true;
        }

        return $user->is_instance_admin === true;
    }

    /**
     * What stands in the way of requiring single sign-on, for this admin (R14).
     *
     * @return array<int, string>
     */
    public function enablingBlockers(User $admin): array
    {
        $providers = array_map(fn (SsoProvider $provider): string => $provider->value, SsoProvider::enabled());

        if ($providers === []) {
            return [self::NoProvider];
        }

        return array_values(array_filter([
            $admin->socialAccounts()->whereIn('provider', $providers)->exists() ? null : self::NoIdentity,
            $this->secondFactors->requiredFor($admin) ? null : self::NoSecondFactor,
        ]));
    }
}
```

- [ ] **Step 5: Password, challenge, passkey, registration, password reset, the alert**

`app/Actions/Auth/RedirectIfSecondFactorRequired.php` (Task 5): `handle` gains the refusal between the credential check and the second-factor decision (import `App\Support\Auth\SignInPolicy`):

```php
    public function handle($request, $next)
    {
        $user = $this->validateCredentials($request);

        if (! $user instanceof User) {
            return $next($request);
        }

        if (! resolve(SignInPolicy::class)->allowsPassword($user)) {
            $this->fireFailedEvent($request, $user);
            $this->throwFailedAuthenticationException($request);
        }

        if (! resolve(SecondFactors::class)->requiredFor($user)) {
            return $next($request);
        }

        return $this->twoFactorChallengeResponse($request, $user);
    }
```

`throwFailedAuthenticationException` is the parent's (`vendor/laravel/fortify/src/Actions/RedirectIfTwoFactorAuthenticatable.php:118`): it increments the login limiter and answers `auth.failed`, the answer of a wrong password. The refusal sits after `validateCredentials` on purpose: the 200 ms `Timebox` of the parent has already run, so a refused right password and a wrong password take the same time (R6). While the setting is in force, `allowsPassword` is true only for a user for whom `requiredFor` is true: an admin never reaches `$next` — the password alone never opens a session (R4).

A challenge remembers what started it, so that R7 can be checked when it ends. `StartSecondFactorChallenge::handle` gains a fourth parameter, `bool $local`, and writes it:

```php
    public function handle(Request $request, User $user, bool $remember, bool $local): void
    {
        $request->session()->put([
            'login.id' => $user->getKey(),
            'login.remember' => $remember,
            'login.local' => $local,
        ]);
    }
```

`RedirectIfSecondFactorRequired::twoFactorChallengeResponse` passes `local: true`; `CompleteLogin` (SSO, magic link) passes `local: false`. The two callers of Task 5 and the test `completes a login through the shared action` of `SecondFactorDecisionTest` gain the argument and nothing else.

Both ways of ending a challenge — Fortify's controller for the authenticator app and the recovery codes, `EmailCodeChallengesController` for the e-mail code — get their user from `TwoFactorChallengeRequest::challengedUser()` (Task 7). That method gains the check, after the parent found the user (imports `App\Support\Auth\SignInPolicy`, `Illuminate\Http\Exceptions\HttpResponseException`, `Laravel\Fortify\Contracts\FailedTwoFactorLoginResponse`):

```php
    public function challengedUser()
    {
        $user = parent::challengedUser();

        if ($this->session()->get('login.local') === true && ! resolve(SignInPolicy::class)->allowsPassword($user)) {
            $this->session()->forget(['login.id', 'login.remember', 'login.local']);

            throw new HttpResponseException(resolve(FailedTwoFactorLoginResponse::class)->toResponse($this));
        }

        return $user;
    }
```

If Task 7 already overrides `challengedUser()` in that class, the check goes at the end of that override. A challenge that SSO started is never concerned (`login.local` is false).

`app/Providers/AppServiceProvider.php`, next to `Passkeys::usePasskeyModel` (imports `App\Support\Auth\SignInPolicy`, `Illuminate\Http\Request`) — R10:

```php
        Passkeys::authorizeLoginUsing(
            fn (Request $request, User $user): bool => resolve(SignInPolicy::class)->allowsLocalCredentials(),
        );
```

`vendor/laravel/passkeys/src/Http/Controllers/PasskeyLoginController.php:58` throws `InvalidPasskeyException` ("Unable to sign in with this account.") when the callback answers false, before `$guard->login`. The callback looks at the instance, never at the user: the refusal is the same for everyone. It decides nothing about a second factor, so S2 holds with one amendment: `authorizeLoginUsing` is set, to this callback and no other.

`app/Actions/Fortify/CreateNewUser.php`, after the validator and before the sign-up gate (import `App\Support\Auth\SignInPolicy`). The first account of an instance is never concerned: the setting cannot be on before an admin exists.

```php
        if (! resolve(SignInPolicy::class)->allowsLocalCredentials()) {
            throw ValidationException::withMessages([
                'email' => __('This instance requires single sign-on.'),
            ]);
        }
```

`app/Models/User.php` — R13: the reset link is mailed to an instance admin only, and the broker still answers "sent" to everyone, so the request says nothing about the setting, the account or its role (imports `App\Support\Auth\SignInPolicy`, `Illuminate\Auth\Notifications\ResetPassword`, `SensitiveParameter`). If the model already overrides this method, the guard goes at its top:

```php
    public function sendPasswordResetNotification(#[SensitiveParameter] $token): void
    {
        if (! resolve(SignInPolicy::class)->allowsPasswordReset($this)) {
            return;
        }

        $this->notify(new ResetPassword($token));
    }
```

Fortify's answer for an address without an account is an error on the field, with or without this setting: that difference exists today and is not changed here; it is written in the gate record.

`app/Providers/FortifyServiceProvider.php` (import `App\Support\Auth\SignInPolicy`): the register view starts with

```php
            abort_unless(resolve(SignInPolicy::class)->allowsLocalCredentials(), 403);
```

the two password-reset views do not change (R13), and the login view becomes:

```php
        Fortify::loginView(function (Request $request) {
            $policy = resolve(SignInPolicy::class);
            $local = $policy->allowsLocalCredentials();

            return Inertia::render('auth/login', [
                'canResetPassword' => Features::enabled(Features::resetPasswords()),
                'canRegister' => $local && resolve(SignupGate::class)->canShowRegistration($this->followedInvitation($request)),
                'status' => $request->session()->get('status'),
                'ssoProviders' => SsoProvider::options(),
                'ssoRequired' => $policy->ssoRequired(),
                'canUseMagicLink' => $local && resolve(IntegrationAvailability::class)->emailEnabled(),
            ]);
        });
```

`app/Http/Middleware/HandleInertiaRequests.php::share` gains the alert of R2, computed only for a user who can manage the instance (import `App\Support\Auth\SignInPolicy`):

```php
            'signInAlert' => fn (): ?string => $request->user()?->can('manageInstance') && resolve(SignInPolicy::class)->isIgnored()
                ? 'sso_required_ignored'
                : null,
```

- [ ] **Step 6: Magic link**

`app/Jobs/Auth/SendMagicLink.php`: `handle` takes `SignInPolicy $policy` as a third parameter and starts with:

```php
        if (! $policy->allowsLocalCredentials()) {
            return;
        }
```

(R11: for everyone, instance admins included — they have the password way back.) `MagicLinksController::store` does not change: it dispatches the same job, which sends nothing, and answers the same way (S8). `MagicLinksController::show` takes `SignInPolicy $policy` and reads the row only when links are allowed:

```php
        $link = $request->hasValidSignature() && $policy->allowsLocalCredentials() ? MagicLink::findUsable($token) : null;
```

`MagicLinkSessionsController::store` takes `SignInPolicy $policy` and refuses before it consumes anything:

```php
        $user = $policy->allowsLocalCredentials() ? $consume->handle($token) : null;
```

- [ ] **Step 7: The refusal message of single sign-on**

`SsoLoginRefused::emailAlreadyUsed()` tells the person to use the password, which is wrong advice while the password is refused (import `App\Support\Auth\SignInPolicy`):

```php
    public static function emailAlreadyUsed(): self
    {
        if (resolve(SignInPolicy::class)->ssoRequired()) {
            return new self(__('An account already uses this email address and could not be matched to your single sign-on identity. Ask an administrator of this instance.'));
        }

        return new self(__('An account already uses this email address. Log in with your password instead.'));
    }
```

- [ ] **Step 8: Request, controller, routes, minimal page**

`vendor/bin/sail artisan make:request Admin/SignInSettingsUpdateRequest --no-interaction`:

```php
<?php

namespace App\Http\Requests\Admin;

use App\Support\Auth\SignInPolicy;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class SignInSettingsUpdateRequest extends FormRequest
{
    /**
     * @return array<string, array<int, ValidationRule|string>>
     */
    public function rules(): array
    {
        return [
            'sso_required' => ['required', 'boolean'],
        ];
    }

    /**
     * Single sign-on can be required only by an admin for whom it already works, and who keeps a way back.
     *
     * @return array<int, Closure(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty() || ! $this->boolean('sso_required')) {
                    return;
                }

                foreach (resolve(SignInPolicy::class)->enablingBlockers($this->user()) as $blocker) {
                    $validator->errors()->add('sso_required', match ($blocker) {
                        SignInPolicy::NoProvider => __('Configure a single sign-on provider before requiring it.'),
                        SignInPolicy::NoSecondFactor => __('Turn on a second factor for your account before requiring single sign-on: it is what lets an administrator sign in with a password if single sign-on fails.'),
                        default => __('Sign in once with single sign-on yourself before requiring it for everyone.'),
                    });
                }
            },
        ];
    }
}
```

`vendor/bin/sail artisan make:controller Admin/SignInSettingsController --no-interaction`:

```php
<?php

namespace App\Http\Controllers\Admin;

use App\Enums\SsoProvider;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\SignInSettingsUpdateRequest;
use App\Models\MagicLink;
use App\Models\User;
use App\Support\Auth\SecondFactors;
use App\Support\Auth\SignInPolicy;
use App\Support\InstanceSettings;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class SignInSettingsController extends Controller
{
    public function edit(Request $request, SignInPolicy $policy, InstanceSettings $settings, SecondFactors $secondFactors): Response
    {
        return Inertia::render('admin/sign-in', [
            'ssoRequired' => $settings->ssoRequired(),
            'inForce' => $policy->ssoRequired(),
            'providers' => SsoProvider::options(),
            'blockers' => $policy->enablingBlockers($request->user()),
            'accountsWithoutSso' => User::query()->whereDoesntHave('socialAccounts')->count(),
            'adminsWithPasswordWayBack' => User::query()->where('is_instance_admin', true)->get()
                ->filter(fn (User $admin): bool => $secondFactors->requiredFor($admin))
                ->count(),
        ]);
    }

    public function update(SignInSettingsUpdateRequest $request, InstanceSettings $settings): RedirectResponse
    {
        $required = $request->boolean('sso_required');

        DB::transaction(function () use ($settings, $required): void {
            $settings->set('sso_required', $required);

            if ($required) {
                MagicLink::query()->delete();
            }
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Sign-in settings saved.')]);

        return to_route('admin.signIn.edit');
    }
}
```

`routes/admin.php`, inside the `RequirePassword` group, after the branding routes:

```php
        Route::get('admin/sign-in', [SignInSettingsController::class, 'edit'])->name('admin.signIn.edit');
        Route::put('admin/sign-in', [SignInSettingsController::class, 'update'])->name('admin.signIn.update');
```

`resources/js/pages/admin/sign-in.tsx`, minimal so that Inertia finds the component (Task 22 gives it its form):

```tsx
import { Head } from '@inertiajs/react';
import { useTrans } from '@/hooks/use-trans';

type Props = {
    ssoRequired: boolean;
    inForce: boolean;
    providers: { key: string; label: string }[];
    blockers: string[];
    accountsWithoutSso: number;
    adminsWithPasswordWayBack: number;
};

export default function SignInSettings({ ssoRequired }: Props) {
    const { t } = useTrans();

    return (
        <>
            <Head title={t('Sign-in')} />
            <h1>{t('Sign-in')}</h1>
            <p>{ssoRequired ? t('Single sign-on is required.') : t('Single sign-on is optional.')}</p>
        </>
    );
}
```

- [ ] **Step 9: Run the tests**

Run: `npm run build:front`, then `vendor/bin/sail artisan test --compact tests/Feature/Auth tests/Feature/Admin tests/Feature/TranslationKeysTest.php tests/Arch`
Expected: PASS once the new keys are in the four language files (values in the translation table of Task 26). `SecondFactorDecisionTest` (Task 5) gains the fourth argument of `StartSecondFactorChallenge` and the expectation `session('login.local')`; its source-scan test is unchanged (no new file reads a two-factor column: `SignInPolicy` asks `SecondFactors`). Other existing tests are expected to pass unchanged: `PasswordResetTest` (the setting is off), `BrandingSettingsTest` `resets every setting and removes the images` (it asserts the branding keys), `SsoButtonsTest` (`where` on `ssoProviders` only). A test that compared the whole list of login props gains the new prop; say so in the report.

- [ ] **Step 10: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app routes/admin.php resources/js/pages/admin/sign-in.tsx tests/Feature/Auth/ForcedSsoTest.php tests/Feature/Admin/SignInSettingsTest.php lang
git commit -m "feat(auth): instance setting that requires single sign-on, with the password and a second factor as the way back of instance admins"
```

### Task 11: Accepting an invitation through single sign-on — an unverified address is refused, and the rules are pinned (B31)

Owner's answers: 11-D2 (the invitation page shows the SSO buttons; accepting an invitation through SSO is authentication work under this plan's rules) and, third round, **an SSO address the provider does not mark verified is refused, even with a matching invitation**. Today such an address creates a verified account when it matches a pending invitation. This task changes that in `ResolveSsoUser`, and pins the whole flow with tests. Spec B31 gives the prop and the buttons to plan 18e and every change of `ResolveSsoUser`, `SsoCallbacksController` and `SignupGate` to this plan; the page props are added here only if 18e did not.

**What exists (read on 2026-10-02).** `InvitationLinksController::show` puts the token in the session (`invitation_token`) and, for a guest, sets the intended URL to the invitation page. `SsoCallbacksController::show` reads the token **from the session only**, finds the invitation and gives it to `ResolveSsoUser::handle`, which: signs in an account already linked to the SSO identity whatever its address; links an existing account only through a verified address on both sides; creates an account and accepts the invitation in one transaction when the address the provider returns is the invited address — **and then accepts an unverified provider address** (`app/Actions/Auth/ResolveSsoUser.php:56-60`, the `$isInvited` exemption), which is what changes; otherwise applies the sign-up gate without the invitation. `InvitationAcceptancesController::store` (authenticated) refuses with 403 an account whose address is not the invited one. After Task 5 the callback ends with `CompleteLogin`, so a second factor is asked before `Auth::login`.

Why the exemption goes: the invitation link proves that its holder reads the invited mailbox; it does not prove that the identity at the provider is that person. With the exemption, anyone who obtains the link (a forwarded mail, a shared screen) and can make a provider assert the invited address without verifying it gets a verified account under that address. Without it, such a person is refused, and the invited person still has the two other ways: a provider that verifies the address, or the password account of the same link.

**The rules (S30, S31):**

1. The callback learns of the invitation only from the server-side session of the browser that opened the invitation link. The token is never put in the URL sent to the provider, never in OAuth `state`, never read from callback input.
2. An address the provider does not mark verified creates no account and reaches no account, with or without an invitation. The invitation is honoured only for the invited address, verified by the provider: compared case-insensitively after trimming. Any other address neither accepts nor consumes the invitation.
3. An SSO identity whose address differs from the invited one signs in to (or creates, if the sign-up gate allows it **without** the invitation) its own account. It is never linked to the account that owns the invited address, and never signed in as it.
4. An existing account never joins the workspace inside the callback: it signs in (second factor first, S1/S12), lands on the invitation page, and joins through the authenticated `POST invitations/{token}/acceptance`, which checks the address again. Only an account created by the callback is joined in the same transaction that creates it.
5. An expired or already accepted invitation gives no right: the sign-up gate applies as if there were none.

**Files:**
- Modify: `app/Actions/Auth/ResolveSsoUser.php:54-60` (the exemption), `app/Http/Controllers/InvitationLinksController.php:35-44` (props)
- Test: `tests/Feature/Auth/InvitationSsoTest.php` (IS); `tests/Feature/Auth/ResolveSsoUserTest.php:127` (one test reversed); `SsoLoginTest`, `InvitationRegistrationTest` stay green without edits

**Interfaces:**
- Consumes: `SsoProvider::options()`, `SignInPolicy` (Task 10), `CompleteLogin` (Task 5), `SignupGate`; from plan 18e, when it built B31: the `ssoProviders` prop and its tests.
- Produces: props of `invitations/show` for a valid link — `ssoProviders: {key: string, label: string}[]` (empty unless the visitor is a guest and the invitation is pending; from 18e when it built B31), `ssoRequired: boolean` (in force), `canRegister: boolean` (false while single sign-on is required). Task 23 mounts or checks the buttons; what plan 18e must leave in place is named there.

- [ ] **Step 1: Write the failing tests**

`tests/Feature/Auth/InvitationSsoTest.php`:

```php
<?php

use App\Models\SocialAccount;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use App\Support\InstanceSettings;
use Inertia\Testing\AssertableInertia as Assert;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;

beforeEach(function () {
    config([
        'services.google.client_id' => 'google-id',
        'services.google.client_secret' => 'google-secret',
        'services.github.client_id' => null,
        'services.github.client_secret' => null,
        'skrum.signup_mode' => 'invite',
    ]);
    User::factory()->instanceAdmin()->create();
});

function followInvitation(mixed $test, string $email = 'guest@example.test', string $token = 'secret-token'): WorkspaceInvitation
{
    $invitation = WorkspaceInvitation::factory()->withToken($token)->create(['email' => $email]);

    $test->get(route('invitations.show', $token))->assertOk();

    return $invitation;
}

function ssoAnswers(array $attributes): void
{
    Socialite::fake('google', SocialiteUser::fake($attributes));
}

it('offers the providers to a guest with a pending invitation only', function () {
    $invitation = WorkspaceInvitation::factory()->withToken('secret-token')->create(['email' => 'guest@example.test']);

    $this->get(route('invitations.show', 'secret-token'))->assertInertia(fn (Assert $page) => $page
        ->where('ssoProviders', [['key' => 'google', 'label' => 'Google']])
        ->where('canRegister', true));

    $this->actingAs(User::factory()->create())->get(route('invitations.show', 'secret-token'))
        ->assertInertia(fn (Assert $page) => $page->where('ssoProviders', []));

    auth()->logout();
    $invitation->forceFill(['expires_at' => now()->subMinute()])->save();

    $this->get(route('invitations.show', 'secret-token'))->assertInertia(fn (Assert $page) => $page->where('ssoProviders', []));
    $this->get(route('invitations.show', 'unknown'))->assertNotFound()->assertInertia(fn (Assert $page) => $page->missing('ssoProviders'));
});

it('offers no password account on the invitation page when single sign-on is required', function () {
    resolve(InstanceSettings::class)->set('sso_required', true);
    WorkspaceInvitation::factory()->withToken('secret-token')->create(['email' => 'guest@example.test']);

    $this->get(route('invitations.show', 'secret-token'))->assertInertia(fn (Assert $page) => $page
        ->where('canRegister', false)
        ->where('ssoRequired', true)
        ->has('ssoProviders', 1));
});

it('refuses an address the provider does not mark verified, even with a matching invitation', function () {
    $invitation = followInvitation($this);
    ssoAnswers(['id' => 'g-0', 'email' => 'guest@example.test', 'email_verified' => false]);

    $this->get(route('sso.callback', 'google'))
        ->assertRedirect(route('login'))
        ->assertSessionHasErrors(['email' => 'Google did not confirm your email address.']);

    $this->assertGuest();
    expect($invitation->fresh()->accepted_at)->toBeNull()
        ->and(User::query()->where('email', 'guest@example.test')->exists())->toBeFalse()
        ->and(session('invitation_token'))->toBe('secret-token');
});

it('creates the account and joins the workspace when the provider returns the invited address', function (string $spelling) {
    $invitation = followInvitation($this);
    ssoAnswers(['id' => 'g-1', 'email' => $spelling, 'email_verified' => true]);

    $this->get(route('sso.callback', 'google'))->assertRedirect(route('dashboard'));

    $user = User::query()->whereRaw('lower(email) = ?', ['guest@example.test'])->sole();
    $this->assertAuthenticatedAs($user);
    expect($invitation->fresh()->accepted_at)->not->toBeNull()
        ->and($user->belongsToWorkspace($invitation->workspace))->toBeTrue()
        ->and(session('invitation_token'))->toBeNull();
})->with(['guest@example.test', 'Guest@Example.test', ' guest@example.test ']);

it('never sends the invitation token to the provider and never reads it from the callback', function () {
    $invitation = followInvitation($this);

    $location = (string) $this->get(route('sso.redirect', 'google'))->headers->get('Location');
    expect($location)->not->toContain('secret-token');

    $this->flushSession();
    ssoAnswers(['id' => 'g-2', 'email' => 'guest@example.test', 'email_verified' => true]);

    $this->get(route('sso.callback', ['provider' => 'google', 'invitation_token' => 'secret-token', 'token' => 'secret-token']))
        ->assertRedirect(route('login'))
        ->assertSessionHasErrors(['email' => 'Signups are restricted on this instance.']);

    $this->assertGuest();
    expect($invitation->fresh()->accepted_at)->toBeNull();
});

it('gives nothing to an identity whose address is not the invited one', function () {
    $invitation = followInvitation($this);
    ssoAnswers(['id' => 'g-3', 'email' => 'someone-else@example.test', 'email_verified' => true]);

    $this->get(route('sso.callback', 'google'))
        ->assertRedirect(route('login'))
        ->assertSessionHasErrors(['email' => 'Signups are restricted on this instance.']);

    $this->assertGuest();
    expect($invitation->fresh()->accepted_at)->toBeNull()
        ->and(User::query()->where('email', 'someone-else@example.test')->exists())->toBeFalse()
        ->and(session('invitation_token'))->toBe('secret-token');
});

it('signs a different address in to its own account, outside the workspace, when sign-up is open', function () {
    config(['skrum.signup_mode' => 'open']);
    $invitation = followInvitation($this);
    ssoAnswers(['id' => 'g-4', 'email' => 'someone-else@example.test', 'email_verified' => true]);

    $this->get(route('sso.callback', 'google'))->assertRedirect(route('invitations.show', 'secret-token'));

    $user = User::query()->where('email', 'someone-else@example.test')->sole();
    $this->assertAuthenticatedAs($user);
    expect($invitation->fresh()->accepted_at)->toBeNull()
        ->and($user->belongsToWorkspace($invitation->workspace))->toBeFalse();

    $this->get(route('invitations.show', 'secret-token'))->assertInertia(fn (Assert $page) => $page
        ->where('isLoggedIn', true)
        ->where('emailMatches', false));
    $this->post(route('invitations.acceptance.store', 'secret-token'))->assertForbidden();

    expect($invitation->fresh()->accepted_at)->toBeNull();
});

it('never links or opens the account that owns the invited address to another identity', function () {
    config(['skrum.signup_mode' => 'open']);
    $owner = User::factory()->create(['email' => 'guest@example.test']);
    followInvitation($this);
    ssoAnswers(['id' => 'g-5', 'email' => 'attacker@example.test', 'email_verified' => true]);

    $this->get(route('sso.callback', 'google'));

    expect(auth()->id())->not->toBe($owner->id)
        ->and(SocialAccount::query()->where('user_id', $owner->id)->exists())->toBeFalse()
        ->and($owner->fresh()->email)->toBe('guest@example.test');
});

it('refuses an unverified provider address that claims an existing account, invitation or not', function () {
    $owner = User::factory()->create(['email' => 'guest@example.test']);
    $invitation = followInvitation($this);
    ssoAnswers(['id' => 'g-6', 'email' => 'guest@example.test', 'email_verified' => false]);

    $this->get(route('sso.callback', 'google'))->assertRedirect(route('login'))->assertSessionHasErrors('email');

    $this->assertGuest();
    expect(SocialAccount::query()->where('user_id', $owner->id)->exists())->toBeFalse()
        ->and($invitation->fresh()->accepted_at)->toBeNull();
});

it('signs in a linked account whose address differs, and its acceptance is refused', function () {
    $linked = User::factory()->create(['email' => 'other@example.test']);
    SocialAccount::factory()->for($linked)->create(['provider' => 'google', 'provider_user_id' => 'g-7']);
    $invitation = followInvitation($this);
    ssoAnswers(['id' => 'g-7', 'email' => 'guest@example.test', 'email_verified' => true]);

    $this->get(route('sso.callback', 'google'))->assertRedirect(route('invitations.show', 'secret-token'));

    $this->assertAuthenticatedAs($linked);
    $this->post(route('invitations.acceptance.store', 'secret-token'))->assertForbidden();
    expect($invitation->fresh()->accepted_at)->toBeNull();
});

it('asks an existing account for its second factor before anything is joined', function () {
    $member = User::factory()->withTwoFactor()->create(['email' => 'guest@example.test']);
    $invitation = followInvitation($this);
    ssoAnswers(['id' => 'g-8', 'email' => 'guest@example.test', 'email_verified' => true]);

    $this->get(route('sso.callback', 'google'))->assertRedirect(route('two-factor.login'));

    $this->assertGuest();
    expect($invitation->fresh()->accepted_at)->toBeNull()
        ->and($member->belongsToWorkspace($invitation->workspace))->toBeFalse()
        ->and(session('invitation_token'))->toBe('secret-token');

    $this->actingAs($member)->post(route('invitations.acceptance.store', 'secret-token'))
        ->assertRedirect(route('workspaces.show', $invitation->workspace));

    expect($invitation->fresh()->accepted_at)->not->toBeNull();
});

it('gives no right through an expired or already accepted invitation', function (array $state) {
    WorkspaceInvitation::factory()->withToken('secret-token')->create(['email' => 'guest@example.test', ...$state]);
    $this->get(route('invitations.show', 'secret-token'));
    ssoAnswers(['id' => 'g-9', 'email' => 'guest@example.test', 'email_verified' => true]);

    $this->get(route('sso.callback', 'google'))
        ->assertRedirect(route('login'))
        ->assertSessionHasErrors(['email' => 'Signups are restricted on this instance.']);

    $this->assertGuest();
    expect(User::query()->where('email', 'guest@example.test')->exists())->toBeFalse();
})->with([
    'expired' => [['expires_at' => '2020-01-01 00:00:00']],
    'accepted' => [['accepted_at' => '2020-01-01 00:00:00']],
]);
```

`SocialiteUser::fake` and `Socialite::fake` are the helpers `SsoLoginTest.php` already uses; if the provider's redirect cannot be read in a feature test with the fake in place, the first half of `never sends the invitation token…` reads `Socialite::driver('google')->redirect()->getTargetUrl()` instead, as `SsoLoginTest` `redirects to an enabled provider` does.

In `tests/Feature/Auth/ResolveSsoUserTest.php`, the test `creates and joins through a matching invitation even without a verified email` (line 127) states the behaviour the owner reversed. It is rewritten in this commit, same arrangement, opposite expectation, under the name `refuses a matching invitation when the provider did not verify the address`: `ResolveSsoUser::handle` throws `SsoLoginRefused` with the message of `emailNotVerified`, no user is created, the invitation stays pending. This is a change of an existing test imposed by an owner decision, not by a mockup: it is named in the report.

- [ ] **Step 2: Run them to see which fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Auth/InvitationSsoTest.php tests/Feature/Auth/ResolveSsoUserTest.php`
Expected: FAIL on `refuses an address the provider does not mark verified, even with a matching invitation` and on the rewritten test of `ResolveSsoUserTest` (an account is created); FAIL on the page test of required single sign-on (`ssoRequired` is missing and `canRegister` is true); the test on `ssoProviders` fails only if 18e did not build B31. Every other test of `InvitationSsoTest` is expected to PASS already: they are the pins of rules 1–5. A pin that fails is a security finding, not a test to adjust: stop, write it in the ledger with the request and the result, fix it with the smallest change in `ResolveSsoUser` or `SsoCallbacksController`, and name the change in the report and for the gate of Task 16.

- [ ] **Step 3: The rule, then the props**

In `app/Actions/Auth/ResolveSsoUser.php`, the verification check no longer looks at the invitation, and comes before it:

```php
        if ($verifiedEmail === null) {
            throw SsoLoginRefused::emailNotVerified($provider);
        }

        $isInvited = $invitation?->isPending() && $invitation->matchesEmail($email);

        if (! $this->signupGate->allows($email, $invitation)) {
            throw SsoLoginRefused::signupsRestricted();
        }

        return $this->createUser($provider, $ssoUser, $providerUserId, $email, $isInvited ? $invitation : null);
```

Nothing above these lines changes: a linked identity still signs in its account, and an existing account is still reached only when both sides are verified. An account created here is therefore always created from a verified address; `createUser` keeps marking it verified.

`InvitationLinksController::show` takes `SignInPolicy $signInPolicy` as one more parameter (imports `App\Enums\SsoProvider`, `App\Support\Auth\SignInPolicy`); the render call becomes (the `ssoProviders` line is 18e's when B31 is already there — keep its expression if it gives the same three cases):

```php
        return Inertia::render('invitations/show', [
            'token' => $token,
            'isInvalid' => false,
            'workspaceName' => $invitation->workspace->name,
            'email' => $invitation->email,
            'isExpired' => ! $invitation->isPending(),
            'isLoggedIn' => $user !== null,
            'emailMatches' => $user !== null && $invitation->matchesEmail($user->email),
            'canRegister' => $signInPolicy->allowsLocalCredentials() && $signupGate->canShowRegistration($invitation),
            'ssoRequired' => $signInPolicy->ssoRequired(),
            'ssoProviders' => $user === null && $invitation->isPending() ? SsoProvider::options() : [],
        ]);
```

The buttons link to the existing `sso.redirect` route, which takes the provider and nothing else.

- [ ] **Step 4: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Auth tests/Feature/Workspaces tests/Arch`
Expected: PASS, with no edit to `SsoLoginTest` or `InvitationRegistrationTest`, and the one rewritten test of `ResolveSsoUserTest`. If `tests/Feature/Workspaces` does not exist, run the file that holds the invitation page tests (`grep -rln "invitations.show" tests/Feature`).

- [ ] **Step 5: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app/Actions/Auth/ResolveSsoUser.php app/Http/Controllers/InvitationLinksController.php tests/Feature/Auth/InvitationSsoTest.php tests/Feature/Auth/ResolveSsoUserTest.php
git commit -m "fix(auth): refuse an unverified single sign-on address even with a matching invitation, and pin the invitation flow"
```

### Task 12: Recap e-mail preference and signed unsubscribe (B34)

Owner's answer to D9 (2026-10-02): the recap e-mail gets an unsubscribe — a new user preference and a signed link. Spec B34 and the amended B14: the recipients are unchanged except that a user whose `recap_emails` is off receives no recap. Criterion 31.

**Files:**
- Create: migration `add_recap_emails_to_users_table`, `app/Http/Controllers/RecapUnsubscribesController.php`, `resources/js/pages/auth/recap-unsubscribe.tsx`
- Modify: `app/Models/User.php:36-76` (property, fillable, default, cast), `app/Actions/Integrations/RetroResultsRecipients.php:19-28`, `app/Mail/RetroResultsMail.php` and `resources/views/mail/retro-results.blade.php`, `resources/views/mail/text/retro-results.blade.php` (Task 4), `app/Notifications/RetroResultsNotification.php` (`toMail`), `app/Http/Controllers/Settings/NotificationPreferencesController.php`, `resources/js/pages/settings/notifications.tsx` (the type and the form data only; the control is Task 24), `routes/web.php`, `bootstrap/app.php` (CSRF exemption of Task 3)
- Test: `tests/Feature/Mail/RecapUnsubscribeTest.php` (RU); `tests/Feature/Settings/NotificationPreferencesTest.php` (three assertions gain the key)

**Interfaces:**
- Consumes: Task 4 (`RetroResultsMail`, `RetroRecapMail::build`), the unsubscribe pattern of Task 3.
- Produces: `users.recap_emails` (boolean, default true); `RetroResultsMail::unsubscribeVia(string $url): static`; routes `recapUnsubscribes.show` (`GET recap-unsubscribe/{user}`) and `recapUnsubscribes.store` (`POST`, same path), both `signed`; Inertia page `auth/recap-unsubscribe` with props `unsubscribed: boolean`, `confirmUrl: string`; `preferences.recap_emails` on `settings/notifications`.

- [ ] **Step 1: Write the failing test**

`tests/Feature/Mail/RecapUnsubscribeTest.php`:

```php
<?php

use App\Actions\Integrations\RetroResultsRecipients;
use App\Enums\RetroPhase;
use App\Enums\RetroResultsAudience;
use App\Models\Retro;
use App\Models\User;
use App\Notifications\RetroResultsNotification;
use Illuminate\Support\Facades\URL;
use Inertia\Testing\AssertableInertia as Assert;

it('subscribes every account by default', function () {
    expect(User::factory()->create()->fresh()->recap_emails)->toBeTrue();
});

it('leaves an unsubscribed member out of the recipients and of their count', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    [$facilitator] = retroFacilitator($retro);
    $quiet = teamMember($retro->team);
    $quiet->forceFill(['recap_emails' => false])->save();
    $recipients = resolve(RetroResultsRecipients::class);

    expect($recipients->query($retro, RetroResultsAudience::Team)->pluck('id')->all())->toBe([$facilitator->id])
        ->and($recipients->counts($retro)['team'])->toBe(1)
        ->and($recipients->isRecipient($retro, $quiet))->toBeFalse();
});

it('carries the one-click unsubscribe headers and the link in both parts', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    [$facilitator] = retroFacilitator($retro);
    $url = URL::signedRoute('recapUnsubscribes.show', ['user' => $facilitator->id]);

    $mail = (new RetroResultsNotification($retro->id))->toMail($facilitator);

    expect($mail->headers()->text)->toBe([
        'List-Unsubscribe' => "<{$url}>",
        'List-Unsubscribe-Post' => 'List-Unsubscribe=One-Click',
    ]);
    $mail->assertSeeInHtml($url, false);
    $mail->assertSeeInText($url);
    $mail->assertSeeInHtml(route('notificationPreferences.edit'), false);
});

it('shows a confirmation page and changes nothing on GET', function () {
    $user = User::factory()->create();

    $this->get(URL::signedRoute('recapUnsubscribes.show', ['user' => $user->id]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('auth/recap-unsubscribe')->where('unsubscribed', false));

    $this->assertGuest();
    expect($user->fresh()->recap_emails)->toBeTrue();
});

it('turns the recap e-mails off on a signed POST without signing anyone in', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();

    $this->post(URL::signedRoute('recapUnsubscribes.show', ['user' => $user->id]), ['List-Unsubscribe' => 'One-Click'])
        ->assertNoContent();

    $this->assertGuest();
    expect($user->fresh())->recap_emails->toBeFalse()->action_item_reminders_by_email->toBeTrue()
        ->and($other->fresh()->recap_emails)->toBeTrue();
});

it('goes back to the confirmation page after the button of the page', function () {
    $user = User::factory()->create();
    $url = URL::signedRoute('recapUnsubscribes.show', ['user' => $user->id]);

    $this->post($url)->assertRedirect($url);

    $this->get($url)->assertInertia(fn (Assert $page) => $page->where('unsubscribed', true));
});

it('refuses a missing, tampered or borrowed signature', function (string $method) {
    $user = User::factory()->create();
    $other = User::factory()->create();
    $forged = str_replace($user->id, $other->id, URL::signedRoute('recapUnsubscribes.show', ['user' => $user->id]));
    $borrowed = str_replace('reminder-unsubscribe', 'recap-unsubscribe', URL::signedRoute('reminderUnsubscribes.show', ['user' => $user->id]));

    $this->call($method, route('recapUnsubscribes.show', ['user' => $user->id]))->assertForbidden();
    $this->call($method, $forged)->assertForbidden();
    $this->call($method, $borrowed)->assertForbidden();

    expect($user->fresh()->recap_emails)->toBeTrue()
        ->and($other->fresh()->recap_emails)->toBeTrue();
})->with(['GET', 'POST']);

it('lets the member subscribe again from the settings', function () {
    $user = User::factory()->create();
    $user->forceFill(['recap_emails' => false])->save();

    $this->actingAs($user)->get(route('notificationPreferences.edit'))
        ->assertInertia(fn (Assert $page) => $page->where('preferences.recap_emails', false));

    $this->actingAs($user)->patch(route('notificationPreferences.update'), [
        'action_item_reminders_by_email' => true,
        'action_item_reminders_in_app' => true,
        'recap_emails' => true,
    ])->assertSessionHasNoErrors();

    expect($user->fresh()->recap_emails)->toBeTrue();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mail/RecapUnsubscribeTest.php`
Expected: FAIL, `column "recap_emails" … does not exist` (or the attribute is null).

- [ ] **Step 3: Column and model**

`vendor/bin/sail artisan make:migration add_recap_emails_to_users_table --no-interaction`:

```php
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->boolean('recap_emails')->default(true);
        });
    }
```

`app/Models/User.php`: `@property bool $recap_emails` in the docblock; `'recap_emails'` at the end of the `#[Fillable([...])]` list; `'recap_emails' => true` in `$attributes`; `'recap_emails' => 'boolean'` in `casts()`.

- [ ] **Step 4: Recipients**

`RetroResultsRecipients::query` gains one condition after `whereNotNull('email_verified_at')`:

```php
            ->where('recap_emails', true)
```

`counts()` and `isRecipient()` read `query()`, so the number the share dialog shows and the `shouldSend` check of the notification follow. The class docblock gains: "and who did not unsubscribe from recaps".

- [ ] **Step 5: The mail**

`app/Mail/RetroResultsMail.php` (Task 4) gains a property, a fluent setter and the headers (import `Illuminate\Mail\Mailables\Headers`); the constructor does not change, so `RetroRecapMail::build` and the preview of Task 4 keep working without a link:

```php
    public ?string $unsubscribeUrl = null;

    public function unsubscribeVia(string $url): static
    {
        $this->unsubscribeUrl = $url;

        return $this;
    }

    public function headers(): Headers
    {
        if ($this->unsubscribeUrl === null) {
            return new Headers;
        }

        return new Headers(text: [
            'List-Unsubscribe' => "<{$this->unsubscribeUrl}>",
            'List-Unsubscribe-Post' => 'List-Unsubscribe=One-Click',
        ]);
    }
```

`content()` passes it to the views: add `'unsubscribeUrl' => $this->unsubscribeUrl` to `with`.

`RetroResultsNotification::toMail` (import `Illuminate\Support\Facades\URL`):

```php
        return resolve(RetroRecapMail::class)->build(
            resolve(BuildRetroRecap::class)->handle($retro),
            resolve(SummarizeHealthCheck::class)->handle($retro),
        )
            ->unsubscribeVia(URL::signedRoute('recapUnsubscribes.show', ['user' => $notifiable->id]))
            ->forNotifiable($notifiable);
```

The footer of `resources/views/mail/retro-results.blade.php` becomes:

```blade
@section('footer')
<p style="margin:0;">{{ __('You receive this e-mail because you took part in this retrospective or belong to its team.') }}</p>
<p style="margin:8px 0 0;"><a class="m-muted" href="{{ $settingsUrl }}" style="color:{{ $colors['light']['muted-foreground'] }};">{{ __('Notification settings') }}</a>@if($unsubscribeUrl !== null) · <a class="m-muted" href="{{ $unsubscribeUrl }}" style="color:{{ $colors['light']['muted-foreground'] }};">{{ __('Unsubscribe from recaps') }}</a>@endif</p>
@endsection
```

and the text part ends with:

```blade
{!! __('Notification settings') !!}: {!! $settingsUrl !!}
@if($unsubscribeUrl !== null)
{!! __('Unsubscribe from recaps') !!}: {!! $unsubscribeUrl !!}
@endif
```

`tests/Feature/Mail/RetroResultsMailTest.php` (Task 4) needs no change: its third test asserts the settings link, which stays; the unsubscribe headers and link are asserted by `RecapUnsubscribeTest`.

- [ ] **Step 6: Controller, routes, CSRF exemption, page**

`vendor/bin/sail artisan make:controller RecapUnsubscribesController --no-interaction` — the body is `ReminderUnsubscribesController` of Task 3 with the column `recap_emails`, the route name `recapUnsubscribes.show` and the component `auth/recap-unsubscribe`:

```php
<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Support\Facades\URL;
use Inertia\Inertia;
use Inertia\Response;

class RecapUnsubscribesController extends Controller
{
    public function show(User $user): Response
    {
        return Inertia::render('auth/recap-unsubscribe', [
            'unsubscribed' => ! $user->recap_emails,
            'confirmUrl' => URL::signedRoute('recapUnsubscribes.show', ['user' => $user->id]),
        ]);
    }

    public function store(Request $request, User $user): RedirectResponse|HttpResponse
    {
        $user->forceFill(['recap_emails' => false])->save();

        if ($request->input('List-Unsubscribe') === 'One-Click') {
            return response()->noContent();
        }

        return redirect(URL::signedRoute('recapUnsubscribes.show', ['user' => $user->id]));
    }
}
```

`routes/web.php`, inside the `signed` group Task 3 opened:

```php
    Route::get('recap-unsubscribe/{user}', [RecapUnsubscribesController::class, 'show'])->whereUuid('user')->name('recapUnsubscribes.show');
    Route::post('recap-unsubscribe/{user}', [RecapUnsubscribesController::class, 'store'])->whereUuid('user')->name('recapUnsubscribes.store');
```

`bootstrap/app.php`, the line of Task 3 gains the second path:

```php
        $middleware->preventRequestForgery(except: ['reminder-unsubscribe/*', 'recap-unsubscribe/*']);
```

`resources/js/pages/auth/recap-unsubscribe.tsx` is `auth/reminder-unsubscribe.tsx` of Task 3 with the component name `RecapUnsubscribe`, the title `t('Recap e-mails')`, the two descriptions `t('You no longer receive the results of retrospectives by e-mail.')` and `t('Stop the results of retrospectives sent by e-mail?')`, and the same `data-test="unsubscribe-button"`:

```tsx
import { Head, router, setLayoutProps } from '@inertiajs/react';
import { useState } from 'react';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useTrans } from '@/hooks/use-trans';
import { login } from '@/routes';

type Props = { unsubscribed: boolean; confirmUrl: string };

export default function RecapUnsubscribe({ unsubscribed, confirmUrl }: Props) {
    const { t } = useTrans();
    const [processing, setProcessing] = useState(false);

    setLayoutProps({
        title: t('Recap e-mails'),
        description: unsubscribed
            ? t('You no longer receive the results of retrospectives by e-mail.')
            : t('Stop the results of retrospectives sent by e-mail?'),
    });

    return (
        <>
            <Head title={t('Recap e-mails')} />

            <div className="flex flex-col gap-4 text-center">
                {!unsubscribed && (
                    <Button
                        type="button"
                        className="w-full"
                        disabled={processing}
                        data-test="unsubscribe-button"
                        onClick={() =>
                            router.post(
                                confirmUrl,
                                {},
                                {
                                    onStart: () => setProcessing(true),
                                    onFinish: () => setProcessing(false),
                                },
                            )
                        }
                    >
                        {processing && <Spinner />}
                        {t('Unsubscribe')}
                    </Button>
                )}
                <TextLink href={login()}>{t('Log in')}</TextLink>
            </div>
        </>
    );
}
```

- [ ] **Step 7: The settings endpoint**

`NotificationPreferencesController`: `edit` adds `'recap_emails' => $user->recap_emails` to `preferences`; `update` adds `'recap_emails' => ['required', 'boolean']` to the rules. In `resources/js/pages/settings/notifications.tsx` (or the container 18e made of it), the `Preferences` type gains `recap_emails: boolean`, so the form posts the three keys; the control itself is Task 24.

In `tests/Feature/Settings/NotificationPreferencesTest.php`, three assertions gain the key and nothing else changes: `shows the notification preferences` (`'recap_emails' => true` in the expected array), `saves the notification preferences` (`'recap_emails' => true` in the payload), `validates the preferences as booleans` (`'recap_emails'` in the list of errors). The reason — a third required key — goes in the report.

- [ ] **Step 8: Run the tests**

Run: `npm run build:front`, then `vendor/bin/sail artisan test --compact tests/Feature/Mail tests/Feature/Settings tests/Feature/Integrations tests/Feature/TranslationKeysTest.php tests/Arch`
Expected: PASS once the new keys are in the four language files (translation table of Task 26). `ResultsEmailTest` stays green: its recipients are subscribed by default.

- [ ] **Step 9: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app database bootstrap/app.php routes/web.php resources/views/mail resources/js/pages tests/Feature/Mail tests/Feature/Settings lang
git commit -m "feat(mail): recap e-mail preference with a signed one-click unsubscribe"
```

### Task 13: Single-key shortcuts preference — back end (B35)

Owner's answer to D16 (2026-10-02): the five shortcuts are built, and so is the setting that turns single-letter shortcuts off (WCAG 2.1.4, Character Key Shortcuts). Spec B35, criterion 32. This task stores the preference of a member; a guest keeps it locally (Task 25). Task 24 gives it its control, Task 25 makes the shortcuts obey it.

**Files:**
- Create: migration `add_single_key_shortcuts_to_users_table`, `app/Http/Controllers/Settings/ShortcutPreferencesController.php`
- Modify: `app/Models/User.php` (property, fillable, default, cast), `routes/settings.php` (inside the `auth` group, next to `notificationPreferences`)
- Test: `tests/Feature/Settings/ShortcutPreferencesTest.php`

**Interfaces:**
- Produces: `users.single_key_shortcuts` (boolean, default true); route `shortcutPreferences.update` (`PATCH settings/shortcuts`); the shared Inertia prop `auth.user.single_key_shortcuts` (the user is shared as `$user->toArray()` by `HandleInertiaRequests::user`, so the cast column is in it without a change there).

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('turns single-key shortcuts on by default and shares the preference with every page', function () {
    $user = User::factory()->create()->fresh();

    expect($user->single_key_shortcuts)->toBeTrue();

    $this->actingAs($user)->get(route('appearance.edit'))
        ->assertInertia(fn (Assert $page) => $page->where('auth.user.single_key_shortcuts', true));
});

it('saves the preference of the signed-in user only', function () {
    $user = User::factory()->create();
    $other = User::factory()->create();

    $this->actingAs($user)
        ->from(route('appearance.edit'))
        ->patch(route('shortcutPreferences.update'), ['single_key_shortcuts' => false])
        ->assertRedirect(route('appearance.edit'))
        ->assertSessionHasNoErrors();

    expect($user->fresh()->single_key_shortcuts)->toBeFalse()
        ->and($other->fresh()->single_key_shortcuts)->toBeTrue();

    $this->actingAs($user)->get(route('appearance.edit'))
        ->assertInertia(fn (Assert $page) => $page->where('auth.user.single_key_shortcuts', false));
});

it('refuses a value that is not a boolean', function (mixed $value) {
    $this->actingAs(User::factory()->create())
        ->patch(route('shortcutPreferences.update'), ['single_key_shortcuts' => $value])
        ->assertSessionHasErrors('single_key_shortcuts');
})->with(['maybe', null]);

it('is for signed-in users', function () {
    $this->patch(route('shortcutPreferences.update'), ['single_key_shortcuts' => false])->assertRedirect(route('login'));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Settings/ShortcutPreferencesTest.php`
Expected: FAIL, `Route [shortcutPreferences.update] not defined.`

- [ ] **Step 3: Column, model, controller, route**

`vendor/bin/sail artisan make:migration add_single_key_shortcuts_to_users_table --no-interaction`:

```php
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->boolean('single_key_shortcuts')->default(true);
        });
    }
```

`app/Models/User.php`: `@property bool $single_key_shortcuts`; `'single_key_shortcuts'` in the `#[Fillable([...])]` list; `'single_key_shortcuts' => true` in `$attributes`; `'single_key_shortcuts' => 'boolean'` in `casts()`.

`vendor/bin/sail artisan make:controller Settings/ShortcutPreferencesController --no-interaction`:

```php
<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ShortcutPreferencesController extends Controller
{
    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'single_key_shortcuts' => ['required', 'boolean'],
        ]);

        $request->user()->update($validated);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Keyboard settings saved.')]);

        return back();
    }
}
```

`routes/settings.php`, after the `notificationPreferences` routes (import the controller):

```php
    Route::patch('settings/shortcuts', [ShortcutPreferencesController::class, 'update'])->name('shortcutPreferences.update');
```

- [ ] **Step 4: Run the tests**

Run: `npm run build:front`, then `vendor/bin/sail artisan test --compact tests/Feature/Settings tests/Feature/TranslationKeysTest.php tests/Arch`
Expected: PASS once `Keyboard settings saved.` is in the four language files (translation table of Task 26). If a test of the suite compares the whole `auth.user` array, it gains the two new columns (`recap_emails`, `single_key_shortcuts`); list it in the report.

- [ ] **Step 5: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app database routes/settings.php tests/Feature/Settings/ShortcutPreferencesTest.php lang
git commit -m "feat(settings): preference that turns single-key shortcuts off"
```

### Task 14: Mails to the letter of the Emails mockup

Standing rule (owner, 2026-10-02): the mockup is respected faithfully. Tasks 1–4, 6 and 7 built the five Mailables, their data flow and their security properties; their wording and layout were written before that rule. This task brings the six views (layout and five contents) to `docs/design-system/components/Emails/preview.html` — every title, sentence, block and footer line — and adds the data the mockup needs and the product has. It changes no trigger, no recipient, no header and no rule S22–S26.

**Read first:** `docs/design-system/components/Emails/preview.html` (open it in a browser, both themes) and `README.md` (anatomy, hex table, white-label, states).

**Files:**
- Create: `bin/render-mail-logo.mjs`, `public/brand/skrum-logo-mail-light.png`, `public/brand/skrum-logo-mail-dark.png`, `resources/views/mail/partials/{avatar,stat}.blade.php`
- Modify: `app/Support/Mail/MailBrand.php`, `resources/views/mail/layout.blade.php`, the five views and their text parts (Tasks 2, 3, 4, 6, 7), `app/Mail/{WorkspaceInvitationMail,ActionItemReminderMail,RetroResultsMail,MagicLinkMail,TwoFactorCodeMail}.php`, `app/Notifications/{WorkspaceInvitationNotification,ActionItemReminderDigestNotification}.php`, `app/Support/Integrations/Messages/{RetroRecap,RetroRecapMail}.php`, `app/Actions/Integrations/BuildRetroRecap.php`, `app/Support/Auth/UserAgentSummary.php`, `app/Actions/Auth/SendEmailTwoFactorCode.php`, `app/Enums/InstanceSettingKey.php` (`LogoMail`), `app/Support/Branding/BrandAssets.php` (`logo-mail`), `app/Http/Controllers/Admin/BrandingController.php`, `app/Http/Requests/Admin/BrandingAssetStoreRequest.php`, `routes/admin.php` and `routes/web.php` (the `asset` constraint), `resources/js/pages/admin/branding.tsx` (one upload field), `app/Http/Controllers/MailPreviewsController.php`
- Test: `tests/Feature/Mail/MailMockupTest.php` (MM); the mail tests of Tasks 1–4, 6, 7 and 12, whose asserted strings change as listed below; `tests/Feature/Admin/BrandingAssetsTest.php` (one dataset entry)

**Interfaces:**
- Produces:
  - `MailBrand::logo(): ?array{light: string, dark: string, width: int, height: int}` (null → the display name is written as text), replacing `logoUrl()`; `MailBrand::host(): string`
  - `InstanceSettingKey::LogoMail = 'logo_mail'` (a branding key: `InstanceSettingKey::branding()` of Task 10 includes it); brand asset name `logo-mail`, PNG or JPEG only
  - `RetroRecap` gains `facilitatorName: ?string`, `rotiCounts: ?array{1: int, 2: int, 3: int, 4: int, 5: int}`, and each action item gains `assigneeInitials: ?string`, `assigneePresence: ?int`
  - `new TwoFactorCodeMail(string $code, int $expiresInMinutes, ?string $device, string $requestedAt)`; `UserAgentSummary::describe()` answers `Firefox on macOS`
  - Reminder items gain `daysLate: int` and `ticket: ?string`; `new WorkspaceInvitationMail(...)` gains `inviterInitials`, `inviterPresence`, `teamsCount`, `membersCount`, `canUseSso`, `canRegister`, `validDays`

- [ ] **Step 1: The Skrüm logo as a PNG**

The README asks for a PNG logo at twice its display size (28 px high). The repository has the logo as SVG only (`public/brand/skrum-logo-horizontal-{light,dark}.svg`), and most mail clients do not draw SVG. Playwright is already a dev dependency of the project (the Pest browser plugin), so the PNG is drawn once, with no new package, and committed:

`bin/render-mail-logo.mjs`:

```js
#!/usr/bin/env node
/**
 * Draws the two PNG logos of the e-mails from the SVG logos, at twice the
 * 28 px they are shown at. Run by hand when the SVG logo changes.
 *
 *   node bin/render-mail-logo.mjs
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const displayHeight = 28;
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });

for (const theme of ['light', 'dark']) {
    const svg = readFileSync(join(root, `public/brand/skrum-logo-horizontal-${theme}.svg`), 'utf8');

    await page.setContent(
        `<body style="margin:0;background:transparent"><div id="logo" style="display:inline-block;height:${displayHeight}px;line-height:0">${svg.replace('<svg', `<svg style="height:${displayHeight}px;width:auto"`)}</div></body>`,
    );
    await page.locator('#logo').screenshot({
        path: join(root, `public/brand/skrum-logo-mail-${theme}.png`),
        omitBackground: true,
    });
}

await browser.close();
```

```bash
node bin/render-mail-logo.mjs
file public/brand/skrum-logo-mail-light.png public/brand/skrum-logo-mail-dark.png
```

Expected: two PNG files, 56 pixels high, with an alpha channel. Open both: the symbol and the word `skrüm`, nothing cut. Write their pixel width in `MailBrand::DefaultLogoWidth` (half of it, the display width). `npm run check` must pass on the script.

- [ ] **Step 2: Write the failing tests**

`tests/Feature/Mail/MailMockupTest.php` — one test per block of the mockup; each renders the Mailable through its real entry point (the notification or the job) and asserts the copy of the preview, in English and in French:

| Test | Asserts |
|---|---|
| `shows the Skrüm PNG logo, in both themes, with the display name as alt` | `<img` with `brand/skrum-logo-mail-light.png`, `height="28"`, `alt` = display name; a second image with the dark file inside the element the dark rules reveal; no SVG source |
| `shows the mail logo of the instance, then its PNG or JPEG logo, then the name as text` | with `logo-mail` stored → its URL; with only a PNG `logo-light` → its URL; with only an SVG `logo-light` → no `<img`, the name in the header; with a stored display name and no logo → the name, never the Skrüm logo |
| `ends every mail with the reason, the instance and the credit` | each of the five mails: its reason line (table below), `:app · :host`, and `Powered by Skrüm` only when the admin kept it |
| `writes the magic link mail as the mockup` | preheader `Valid for 15 minutes, works once.`; `Use the button below to sign in as`; the address in `<strong>`; `Button not working? Paste this link into your browser:`; `Didn't ask for this? Ignore this email — nobody can sign in without the link.` |
| `writes the invitation mail as the mockup` | subject `Camille Roux invited you to join Atlas`; the inviter's initials in an avatar cell with a presence colour of the hex table; the workspace block `Atlas` / `2 teams · 11 members`; `Accept invitation`; `The invitation is valid for 7 days. Don't know Camille? Just ignore this email.` |
| `adapts the join sentence to what the instance offers` | SSO provider enabled and registration open → `Join with your company SSO or create an account in a minute.`; SSO only (Task 10 in force) → `Join with your company SSO.`; no provider → `Create an account in a minute.` |
| `writes the reminder rows as the mockup` | title as a link; `Atlas · due 26 Sep · 5 days late` with the last part in `skrum-destructive-text`; the ticket key (`ATLAS-1302`) in the mono font when the item has an external link, absent otherwise; `1 day late` in the singular; button `Open my action items`; `Manage notifications` · `Unsubscribe from reminders` |
| `writes the recap as the mockup` | subject `Sprint 42 · Atlas — 4 actions, ROTI 3.8`; `Sprint 42 is done`; `Facilitated by Camille Roux on Thursday 2 October. Here is what the team decided.`; the four stats `9 Participants`, `34 Cards`, `4 Actions`, `3.8 ROTI /5`; an action row with initials, `Lucas D · due 9 Oct`; `Return on time invested · 9 votes` and five bars whose colours are `skrum-roti-1…5` of the hex table and whose counts are the votes; `Open the full summary` |
| `hides the ROTI stat and bars under three votes, and the facilitator on an anonymous retro` | two votes → no `ROTI /5`, no bars, three stats; anonymous retro → no `Facilitated by` |
| `keeps the product content the mockup does not show` | summary paragraphs, suggested actions, top card per column and the health-check line still render, below the mockup blocks |
| `writes the code mail as the mockup` | subject `Your Skrüm verification code: 042 917`; `Your verification code`; the code grouped 3 + 3 with a non-breaking space and its `aria-label` digit by digit; `Requested from Firefox on macOS · 1 Oct, 2:02 pm (UTC)`; `Not you? Someone has your password:` `change it now` `They can't sign in without this code.`; no city, no country, no IP |
| `writes every mail in French as the mockup` | the French strings of the preview for the five mails (dataset of mail → three sentences each) |
| `stays within the hex table` | every colour of every mail, both themes, is a hex value of the README table or of `BrandPalette::toHex()` (S26 extended to the new blocks: avatar, stat, ROTI bars) |

- [ ] **Step 3: Run it to verify it fails**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Mail/MailMockupTest.php`
Expected: FAIL on the first assertion of each test (the views of Tasks 1–7 have other wording).

- [ ] **Step 4: Logo of the instance**

`MailBrand::logo()` resolves, in this order: the stored `logo-mail` asset; the stored `logo-light` when it is a PNG or a JPEG (and `logo-dark` for the dark image when it is one too, otherwise the same file); `null` when the instance has a logo that mail clients cannot draw, or a display name of its own and no logo (the header then writes the name, as the white-label block of the mockup does beside its logo); the two Skrüm PNG files otherwise. `BrandAssets::Names` gains `logo-mail`, accepted as `image/png` or `image/jpeg` only, at least 128 px wide (README), within `MaxBytes`; `InstanceSettingKey::LogoMail` is cleared by the Branding reset like the other logos. The route constraints `logo-light|logo-dark|favicon` of `brand.show`, `admin.brandingAssets.store` and `admin.brandingAssets.destroy` gain `|logo-mail`. The Branding page gains one upload field under the logos, labelled `Logo for e-mails`, with the help line `PNG or JPEG, at least 128 px wide. Mail clients do not draw SVG.` and, when the instance logo is an SVG or a WebP and no mail logo is stored, the warning `E-mails show the name as text until a PNG or JPEG logo is added.` `BrandingAssetsTest` gains `logo-mail` in its dataset of assets, and a case that refuses an SVG and a WebP for it.

- [ ] **Step 5: Layout**

`mail/layout.blade.php`: the header shows the logo (`height="28"`, `width` from `MailBrand::logo()`, `alt` = name; light image by default, dark image revealed by the rules of `mail/partials/dark.blade.php`), or the name as text. The footer, outside the card, centred, 12/18: the `footer` section of the mail (its reason line and its management links), then `{{ $brand->name() }} · {{ $brand->host() }}`, then `Powered by Skrüm` when `poweredBy()`. One `<h1>` per mail, 20/28 bold, set by a `heading` section each view now defines.

- [ ] **Step 6: The five contents**

Copy of the mockup, as translation keys (the English of the preview is the key; French, Spanish and German are in the table of Task 26). "Replaces" names the key of an earlier task that this one removes from the views and from the four language files.

| Mail | Element | Key | Replaces |
|---|---|---|---|
| all | reason line of the three account mails | `You get this email because you have an account on this instance.` | — |
| magic link | preheader | `Valid for :minutes minutes, works once.` | the preheader of Task 6 |
| magic link | sentence | `Use the button below to sign in as` | `Use the button to sign in as` |
| magic link | fallback | `Button not working? Paste this link into your browser:` | `Or paste this link in your browser:` |
| magic link | exit | `Didn't ask for this? Ignore this email — nobody can sign in without the link.` | `You did not ask for this? Ignore this e-mail: nobody can sign in without the link.` |
| invitation | subject | `:inviter invited you to join :workspace` | the subject of Task 2 |
| invitation | title | `:inviter invited you to join the :workspace workspace` | — |
| invitation | block | `:teams teams · :members members` (and `1 team`, `1 member` through `trans_choice` keys `{1} :count team|[2,*] :count teams`, `{1} :count member|[2,*] :count members`) | — |
| invitation | paragraph | `:workspace runs its retros, planning poker and icebreakers on :app.` followed by one of `Join with your company SSO or create an account in a minute.`, `Join with your company SSO.`, `Create an account in a minute.` | — |
| invitation | button | `Accept invitation` (exists) | — |
| invitation | exit | `The invitation is valid for :days days. Don't know :inviter? Just ignore this email.` | `You do not know :inviter? Ignore this e-mail.` |
| reminder | intro | `Agreed by your team in retro. Mark them done, change the due date, or hand them over.` | — |
| reminder | row | `:team · due :date · :late` with `{1} :count day late|[2,*] :count days late`; a due-soon row: `:team · due :date` | the `due` wording of Task 3 in the mail |
| reminder | button | `Open my action items` | `View my open action items` |
| reminder | reason | `You get this reminder because action items are assigned to you.` | `You can turn off these reminders in your notification settings.` |
| reminder, recap | link | `Manage notifications` | `Notification settings` in the two mails (the key stays for the settings page) |
| recap | subject | `:title · :team — :actions, ROTI :roti` with `{0} no action|{1} :count action|[2,*] :count actions`; without ROTI: `:title · :team — :actions` | the subject of Task 4 in the mail (`RecapText::heading` stays for the other channels) |
| recap | preheader | `:participants participants, :cards cards, facilitated by :name.` (without the last part on an anonymous retro) | — |
| recap | title, lead | `:title is done`; `Facilitated by :name on :date. Here is what the team decided.` / `Completed on :date. Here is what the team decided.` | — |
| recap | stats | `Participants`, `Cards`, `Actions`, `ROTI /5` | the fact lines of Task 4 for these four |
| recap | action row | `:name · due :date`; without a date `:name`; unassigned `Unassigned · due :date` | — |
| recap | ROTI | `Return on time invested · :count votes` | — |
| recap | button | `Open the full summary` | `View the results` |
| recap | reason | `You get this summary because you took part in this retro or belong to its team.` | the sentence of Task 4 |
| code | subject | `Your :app verification code: :code` (code grouped `042 917`) | `:code is your :app verification code` |
| code | context | `Requested from :device · :time`; without a device `Requested on :time` | `Requested from :device.` |
| code | device | `:browser on :system` | the `·` of `UserAgentSummary` |
| code | warning, in the body | `Not you? Someone has your password:` `change it now` `They can't sign in without this code.` | `Not you? Someone knows your password.`, `Change your password` |

Data added for these blocks, each read where the mail is built, never in a view:

- **Invitation.** `WorkspaceInvitationNotification::toMail` passes the inviter's initials and a presence index (1–12, from the same seed the application uses for that user's presence colour; hex pairs of the README table, extended to the twelve presence tokens with the command the README gives), `$workspace->teams()->count()`, `$workspace->members()->count()`, `SsoProvider::enabled() !== []`, `SignInPolicy::allowsLocalCredentials()` with the sign-up gate for the invitation, and the days left until `expires_at` (rounded up).
- **Reminder.** `present()` adds `daysLate` (`ActionItem::today()` minus `due_on`, 0 for a due-soon item) and `ticket` (`$item->externalLinks->first()?->external_key`; the query of `toMail` eager-loads `externalLinks`).
- **Recap.** `BuildRetroRecap::handle` adds `facilitatorName` (the facilitator participant's display name; `null` on an anonymous retro or without a facilitator), `rotiCounts` (votes per score 1–5; `null` under the rule that already hides the ROTI, read from `SummarizeRoti`), and per action item the assignee's initials and presence index. `RetroRecapMail::build` passes four stats, the action rows, the counts and the widest count (for the bar widths, as percentages of a fixed 100 % cell: no `calc`, no CSS variable).
- **Code.** `SendEmailTwoFactorCode` passes `now()->setTimezone((string) config('app.timezone'))->locale($user->preferredLocale())->isoFormat('D MMM, LT')` followed by the zone abbreviation in parentheses. The owner's answer of 2026-10-02 is "browser and time, no location": no city, no country, and no IP are read or stored.

The text parts follow the same order with the same sentences.

- [ ] **Step 7: The earlier assertions that change**

The mail tests of Tasks 1–4, 6, 7 and 12 assert some of the strings replaced above. Each is updated to the string of the table, in this commit, and listed in the report: `MailLayoutTest` (`shows the name as text when the instance logo is not a PNG or a JPEG` becomes the second test of `MailMockupTest` and is deleted from `MailLayoutTest`), `ActionItemReminderMailTest` (`And 3 more.` stays; the link label), `RetroResultsMailTest` (`View the results`, the subject), `RecapUnsubscribeTest` (the settings link label), `EmailSecondFactorTest` (the subject, `Firefox · macOS`, the constructor with four arguments), `MagicLinkTest` (`previews the magic link mail` keeps `Sign in`), the dataset of `UserAgentSummary` (`Firefox on macOS`). `ResultsEmailTest`, `ReminderDigestTest`, `WorkspaceInvitationsTest` and `Plan09bActionItemsAdditionsTest.php:491` read `->subject` or rendered text: run them, and update an assertion only where it holds one of the replaced strings.

- [ ] **Step 8: Run**

Run: `npm run build:front`, then `vendor/bin/sail artisan test --compact tests/Feature/Mail tests/Feature/Auth tests/Feature/Admin tests/Feature/ActionItems tests/Feature/Integrations tests/Feature/TranslationKeysTest.php tests/Arch`, then open the five previews of `dev.mail.show` in English and French beside `Emails/preview.html`, in both colour schemes.
Expected: PASS; side by side, each mail has the blocks of the mockup in the same order with the same sentences. Every difference left is a line of the **Deviations from the mockup** table at the head of this plan, or is fixed.

- [ ] **Step 9: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app bin/render-mail-logo.mjs public/brand resources/views/mail resources/js/pages/admin/branding.tsx routes tests lang
git commit -m "feat(mail): the five mails to the letter of the mockup, with a PNG logo, recap stats and ROTI bars"
```

### Task 15: Data for the bell and for the command palette

The NotificationsPanel and Command mockups show things the server does not give today, and the owner has not sent them to the backlog: notifications other than action reminders, a list that loads more, an arrival that reaches the open page, and the "Recent sessions" group of the palette. This task adds the back end; Tasks 19 and 20 show it. What stays out is in the Deviations table, each line pointing to the feature roadmap: `session_starting` (needs a scheduled start), `mention` (the product has no mention), "Accept" and "Decline" inside the bell (owner, third round: the notification links to the invitation page; no route accepts an invitation without its token).

**The private user channel** exists for one thing only: the mockup's live arrival (the count rises and the bell pulses on an open page, README "Temps réel"). Nothing else of this plan uses it. If the owner prefers to leave live arrival to the roadmap, the channel, the event and the branch of `BroadcastAuthorizationsController` are dropped together (the last line of Step 3 and two tests), the bell keeps its refresh on window focus, and the Deviations table gains one line.

**Files:**
- Create: `app/Actions/Notifications/ListNotifications.php` (takes over `ListActionItemNotifications`, which becomes one of its presenters), `app/Notifications/WorkspaceInvitationReceivedNotification.php`, `app/Events/NotificationReceived.php`, `app/Actions/Search/ListRecentSessions.php`, `app/Http/Controllers/RecentSessionsController.php`
- Modify: `app/Http/Controllers/NotificationsController.php` (`index`), `app/Notifications/RetroResultsNotification.php` (`via`, `toArray`), `app/Http/Controllers/WorkspaceInvitationsController.php:48` (also notifies an existing account), `app/Http/Controllers/BroadcastAuthorizationsController.php` (one more channel), `routes/web.php`
- Test: `tests/Feature/Notifications/BellNotificationsTest.php` (BN), `tests/Feature/RecentSessionsTest.php` (RS); `tests/Feature/ActionItems/*` notification tests stay green

**Interfaces:**
- Produces:
  - `GET notifications?before={notification id}` → `{ notifications: AppNotification[], unreadCount: number, hasMore: boolean }`, 20 per page, newest first. Kinds: `due_soon`, `overdue` (shape unchanged, plus `actionItem.ticket: string|null`), `recap_ready` (`{ id, kind, readAt, createdAt, team: string, session: { id, title }, actionsCount: number, roti: number|null, href }` — the line "4 action items · ROTI 3.8 · yesterday" of the mockup; `roti` is `null` under the rule that hides it), `team_invite` (`{ id, kind, readAt, createdAt, actor: { name, presence, avatarUrl }, team: string` — the workspace name —`, href }`, where `href` is the invitation page, `invitations.show`)
  - Private channel `user.{id}`; event `NotificationReceived` broadcast as `.notification.received` with `{ unreadCount: number }` and nothing else
  - `GET recent-sessions` → route `recentSessions.index`, JSON `{ sessions: RecentSession[] }` with `RecentSession = { kind: 'retro'|'poker'|'whiteboard'|'game', id, title, team: { id, name }, url, updatedAt: string, live: boolean }`, at most 5

**Rules (S33, S34, with S23 for the recent sessions):**

1. **The bell accepts nothing.** An invitation notification is a link to the existing invitation page (`invitations.show`), where the invited person accepts with the existing button under the existing checks. No route accepts an invitation without its token.
2. **The link is kept encrypted.** The invitation token exists in plain text only in the mail and, from now on, inside this link. The notification stores the link with `Crypt::encryptString`; `ListNotifications` decrypts it only when presenting the notification to its own user; a link that no longer decrypts, or whose invitation is gone, revoked, expired or accepted, drops the notification.
3. **A notification is created only for the account that owns the invited address**, and only when exactly one verified account does (`LoginAddress::normalise`, as S11). Nothing in the inviter's answer, timing or page says whether such an account exists: the invitation mail is sent in every case, as today.
4. **A user reads only its own notifications and its own channel.** `private-user.{id}` is authorised only for the signed-in user whose id it is; the event carries a count, never content.
5. **A notification whose subject the user may no longer see is dropped**, as `ListActionItemNotifications` does today.

- [ ] **Step 1: Write the failing tests**

`tests/Feature/Notifications/BellNotificationsTest.php`:

| Test | Asserts |
|---|---|
| `lists a recap for each recipient of the recap mail and for nobody else` | sending the recap stores one `recap_ready` notification per recipient; a member with `recap_emails` off, a guest and a member of another team have none; `href` is the retro |
| `notifies the one verified account that owns the invited address` | inviting `known@example.test` stores a `team_invite` notification for that user; inviting an unknown address, an unverified account, or an address two accounts share stores none; the inviter's response is identical in the four cases (status, redirect, flash) |
| `stores the invitation link encrypted and gives it to its owner only` | the raw `data` column does not contain the token nor the URL; the JSON of `notifications.index` for the invited user has `href` equal to `route('invitations.show', $token)`; another user's list does not contain it |
| `links an invitation notification to the invitation page and accepts nothing` | listing and opening the notification leave the invitation pending and the user outside the workspace; `Route::has('receivedInvitations.acceptance.store')` is false; following `href` shows `invitations/show` with `emailMatches` true, and the existing `POST invitations/{token}/acceptance` joins the workspace |
| `drops a notification whose subject is out of reach` | a recap of a team the user left, and an invitation that was revoked, expired or accepted, disappear from the list and from the count |
| `gives the ticket key of an action item that has an external link` | `actionItem.ticket` is the key, `null` without a link |
| `pages by twenty and says when there is more` | 45 notifications: 20 with `hasMore` true, then 20 with `before`, then 5 with `hasMore` false; `before` of another user's notification answers 404 |
| `tells the open page that a notification arrived, with a count only` | `Event::fake`: each of the three kinds dispatches `NotificationReceived` on `private-user.{id}` whose payload is `['unreadCount' => n]` |
| `authorises the user channel for its owner only` | `POST broadcasting/auth` for `private-user.{own id}` answers 200; for another id, for a guest, and for a retro participant without account, 403 |

`tests/Feature/RecentSessionsTest.php`:

| Test | Asserts |
|---|---|
| `lists the five sessions last touched in the teams the user can view in the current workspace` | retros, poker games, whiteboards and named game rooms; a session of a team the user cannot view, or of another workspace, never appears |
| `puts a live session first` | `live` is true for a session that is not ended (retro not completed, poker game without `ended_at`, room with a current round) and was updated in the last 15 minutes; live sessions come before the others, each group newest first |
| `gives nothing to a guest or an unverified user` | 302 to login, 302 to verification |
| `is throttled` | 60 per minute, as the search route |

- [ ] **Step 2: Run them to verify they fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Notifications tests/Feature/RecentSessionsTest.php`
Expected: FAIL, `Route [recentSessions.index] not defined.`

- [ ] **Step 3: Build**

- `RetroResultsNotification::via` returns `['mail', 'database']`; `toArray` returns `['kind' => 'recap_ready', 'retroId' => $this->retroId]`. `shouldSend` already applies the recipient rule to every channel.
- `WorkspaceInvitationsController::store`, after the existing mail (it holds `$url`, the invitation link, at that point): `LoginAddress::normalise` the invited address, `User::query()->whereRaw('lower(email) = ?', …)->whereNotNull('email_verified_at')->limit(2)->get()`, and `notify(new WorkspaceInvitationReceivedNotification($invitation->id, $url))` only when exactly one row comes back. The notification's constructor takes the link as a `#[SensitiveParameter]`, implements `ShouldBeEncrypted` if queued, and `toArray` returns `['kind' => 'team_invite', 'invitationId' => …, 'link' => Crypt::encryptString($url)]`. No controller and no route are added for accepting.
- `ListNotifications::handle(User $user, ?string $before): array` — pages the user's notifications (`created_at`, `id` descending, 20 + 1 to know `hasMore`), presents each by kind, deletes those whose subject is out of reach (rule 4). `NotificationsController::index` validates `before` as a UUID of one of the user's notifications.
- `NotificationReceived` implements `ShouldBroadcast` on `new PrivateChannel("user.{$userId}")`, `broadcastAs(): 'notification.received'`, `broadcastWith(): ['unreadCount' => …]`; dispatched from a listener on `Illuminate\Notifications\Events\NotificationSent` when the channel is `database`.
- `BroadcastAuthorizationsController::store` gains the branch `private-user.`: 403 unless `$request->user()?->getKey() === Str::after($channel, 'private-user.')`.
- `ListRecentSessions::handle(User $user, Collection $teamIds): array` and `RecentSessionsController::index`, with the team scope and the middleware of `SearchResultsController` (Task 9): the ids of `CurrentTeamResolver::visibleTeams()`, `auth`, `verified`, `throttle:60,1`.

- [ ] **Step 4: Run the tests**

Run: `npm run build:front`, then `vendor/bin/sail artisan test --compact tests/Feature/Notifications tests/Feature/RecentSessionsTest.php tests/Feature/ActionItems tests/Feature/Integrations tests/Feature/Workspaces tests/Feature/RequestIsolationTest.php tests/Arch`
Expected: PASS. `Plan09bActionItemsAdditionsTest.php:546-567` (the bell in the browser) is run in Task 19.

- [ ] **Step 5: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app routes/web.php tests/Feature/Notifications tests/Feature/RecentSessionsTest.php lang
git commit -m "feat(notifications): recap and invitation notifications, paging and live arrival for the bell; recent sessions for the palette"
```

### Task 16: Security review gate (mandatory, blocks every front task)

**Files:** none created by the reviewer. Fixes go to the files of Tasks 5–15 with their tests.

**Interfaces:**
- Consumes: the diff of Tasks 1–15 (`git diff <branch point>..HEAD -- app routes database bootstrap resources/views tests/Feature`), and, for B31, the invitation page, `SsoCallbacksController`, `ResolveSsoUser` and `SignupGate` as plan 18e left them.
- Produces: a review record in the phase report: one line per rule S1–S34 (held / broken, with the file and line read), one line per Review Focus item, one line per rule R1–R16 of `sso_required`, the list of fixes.

- [ ] **Step 1: One reviewer, read-only, with a security lens**, on the whole back-end diff. The reviewer is given the code and this plan's **Security rules**, not a summary of what was built. Skill: `security-review`, then `superpowers:requesting-code-review`.

- [ ] **Step 2: The reviewer checks, by reading, each point a test cannot prove:**

1. S2: `git grep -n "authorizeLoginUsing" app` returns nothing; `vendor/laravel/passkeys/src/Http/Controllers/PasskeyLoginController.php` still signs in without a challenge and no app code wraps it.
2. S1: `git grep -nE "login\.id" app` lists only `StartSecondFactorChallenge`, `FortifyServiceProvider` (limiter and view), `EmailCodeChallengesController`; no controller calls `Auth::login` for a user it found by itself other than `CompleteLogin` and `EmailCodeChallengesController`: `git grep -nE "Auth::login|->login\(" app`.
3. S5: `git grep -nE "Log::|logger\(|report\(|info\(" app/Actions/Auth app/Jobs/Auth app/Http/Controllers/MagicLink*` returns nothing that could carry a token, a code or a URL; `bootstrap/app.php` still has `dontFlash(['token', …])`; no `Inertia::flash` or `->with(` carries a URL or a code.
4. S8: `MagicLinksController::store` has no branch on a user and no query on `users`; every early path returns the same redirect.
5. S4: the SQL of `ConsumeMagicLink` is one `update` with both conditions; nothing reads the row before it to decide.
6. S14: `git grep -nE "redirect\(\)->(to|away)\(|->intended\(" app/Actions/Auth app/Http/Controllers/MagicLink* app/Http/Controllers/Email*` shows only `intended(route('dashboard'))`.
7. S23: every query of `SearchWorkspaceContent` has `whereIn('team_id', $teamIds)` and no `orWhere` outside a closure.
8. S26: no view under `resources/views/mail` prints a variable inside a `style` attribute other than `$colors[…]`, and no HTML view uses `{!!` except `mail/partials/dark.blade.php` for `$prefix`, which only ever receives the three literals of the layout.
9. Timing limit of S8 with `QUEUE_CONNECTION=sync` is written in the report.
10. S27: every local way in asks `SignInPolicy`. `git grep -n "SignInPolicy" app` lists `RedirectIfSecondFactorRequired`, `TwoFactorChallengeRequest`, `CreateNewUser`, `User` (reset notification), `SendMagicLink`, `MagicLinksController`, `MagicLinkSessionsController`, `FortifyServiceProvider`, `AppServiceProvider` (passkeys), `HandleInertiaRequests` (alert), `SsoLoginRefused`, `InvitationLinksController`, the admin controller and request, and nothing reads the setting directly: `git grep -n "ssoRequired()\|sso_required" app` shows `InstanceSettings`, `InstanceSettingKey`, `SignInPolicy`, the admin controller and request only. Then the reviewer looks for a way in that the list misses: `php artisan route:list --except-vendor` and `--only-vendor` read for every route that can end in `Auth::login`, `->login(` or a session for a guest (Fortify's `login.store`, `two-factor.login.store`, `register.store`, `password.email`, `password.update`; the passkey routes; `sso.callback`; `magicLinks.sessions.store`; `twoFactor.emailChallenges.store`; guest joins of sessions, which create no account session).
11. S28, R6: the refusal of a right password — a member's, or an admin's without a second factor — is the same response as a wrong one (status, error key and message, redirect, limiter increment) and comes after the `Timebox` of `validateCredentials` (read `RedirectIfSecondFactorRequired::handle`). Nothing on the login page, in its props or in a response header differs with the address typed. The only thing that differs for an admin is the challenge, reached with the right password only.
12. S28, R4 and R7: while the setting is in force there is no path from a password to `Auth::login` that does not pass a second factor — `allowsPassword` implies `requiredFor`; `TwoFactorChallengeRequest::challengedUser()` re-checks the policy when `login.local` is true, and both completions (Fortify's controller, `EmailCodeChallengesController`) take their user from it; `login.local` is written only by `StartSecondFactorChallenge`, with `true` only from the password pipeline. S2, R10: `Passkeys::authorizeLoginUsing` is called once in the application, with the callback of R10; `PasskeyLoginController` calls `Passkeys::allowsLogin` before `$guard->login` (line 58).
13. S29: `BrandingController::destroy` uses `InstanceSettingKey::branding()`; `InstanceSettingKey::branding()` leaves out `SsoRequired` and nothing else; the two `admin.signIn.*` routes are inside the `can:manageInstance` and `RequirePassword` groups of `routes/admin.php`.
14. S30, S31 (B31): `SsoCallbacksController` reads the invitation token from `$request->session()` only; `SsoRedirectsController` adds nothing to the provider URL; `ResolveSsoUser` returns an existing account only through a linked identity or a verified address on both sides, and calls `AcceptWorkspaceInvitation` only inside `createUser`; `ResolveSsoUser` has no path that creates or returns a user from an address the provider did not verify (the `$isInvited` exemption is gone); `InvitationAcceptancesController::store` still checks `isPending()` and `matchesEmail()`; `CompleteLogin` is the only tail of the callback.
15. S32, S24: both unsubscribe controllers write one column of the bound user with `forceFill`, read nothing else from the request, and are reachable only through the `signed` group; the CSRF exemption lists the two paths and nothing wider.
16. S33, S34: no route accepts an invitation without its token (`php artisan route:list --name=invitation` shows `invitations.show`, `invitations.acceptance.store` and the workspace routes only); the only notification that holds an invitation link holds it through `Crypt::encryptString`, and `ListNotifications` decrypts it only for the notification's own user; `NotificationReceived::broadcastWith` returns a count only; the `private-user.` branch of `BroadcastAuthorizationsController` compares with `$request->user()`'s key and nothing else; `ListRecentSessions` and the card query of `SearchWorkspaceContent` start from the team ids and keep every `orWhere` inside a closure.

- [ ] **Step 3: Manual checks on the running application** (`vendor/bin/sail up -d`, port of the project, never 8097), with `MAIL_MAILER=smtp` pointing at the Mailpit of Sail if present, otherwise the preview routes:

1. `curl -i -X POST "<signed reminder-unsubscribe URL>" -d "List-Unsubscribe=One-Click"` with no cookie answers 204 (the CSRF exemption of Task 3 works) and the same URL with one character of the signature changed answers 403.
2. `curl -I "<magic link URL>"` then `curl "<magic link URL>"`: no `Set-Cookie` that carries an authenticated session (the `magic_links` row still has `consumed_at` null).
3. Request a link twice within a minute for a real and for an unknown address with `curl -w "%{time_total}\n"` while a queue worker runs: same status, same `Location`, comparable times.
4. Open `/dev/mail/magic-link`, `/dev/mail/two-factor-code`, `/dev/mail/invitation`, `/dev/mail/action-reminder`, `/dev/mail/retro-recap` with `?locale=fr`: each renders, in French.
5. `curl -i -X POST "<signed recap-unsubscribe URL>" -d "List-Unsubscribe=One-Click"` with no cookie answers 204; the same request on the URL signed for the reminder, with `reminder-unsubscribe` replaced by `recap-unsubscribe` in its path, answers 403.
6. With `sso_required` turned on through Admin › Sign-in (an SSO provider configured on the instance under review; if none can be, the step is recorded as not run and the feature tests of Task 10 stand alone): `curl -i -X POST <login URL>` with a right password and with a wrong one give the same status, `Location` and error; `POST magic-link`, `POST forgot-password` and `POST register` create no mail and no user; the login page shows no password field. As an instance admin with an authenticator app, the password then the code open a session; as an admin without a second factor the right password gives the wrong-password answer. Then remove the provider configuration: the password form is back for everyone (R2) and the admin sees the alert on every page.

- [ ] **Step 4: Run every back-end suite**

Run: `vendor/bin/sail artisan test --parallel --processes=8 --compact`
Expected: PASS.

- [ ] **Step 5: One fix agent if the review found anything**, each fix with a failing test first, then a scoped re-review of the fixed files. A finding rated high that cannot be fixed without an owner decision stops the plan here.

- [ ] **Step 6: Commit**

```bash
git add -A app routes database resources/views tests
git commit -m "fix(security): findings of the 18f back-end review"
```

(No commit when the review found nothing; the record still goes in the report.)

---

## Front tasks (after the gate)

Each front task starts by reading the page it touches **as plan 18e left it**: the code below gives the new units in full; the place where a unit is mounted inside a rewritten page is found by reading that page, and the page keeps every `data-test`, id and English accessible name it has.

### Task 17: Login — "E-mail me a magic link instead" and the two states of the mockup

**Read first:** `docs/design-system/components/ScreenAuth/preview.html` — the login card (the ghost button under the primary button) and the variant "Lien magique envoyé"; `README.md`. The login page itself (SSO buttons first, separator, fields, "Remember me", primary button, register link, footer) is plan 18e's (Task 11.2): this task adds the two pieces the mockup gives the magic link, where the mockup puts them.

**Files:**
- Create: `resources/js/hooks/use-seconds-left.ts`, `resources/js/hooks/use-seconds-left.test.ts`, `resources/js/components/auth/magic-link-request.tsx`, `resources/js/components/auth/magic-link-request.test.tsx`
- Modify: `resources/js/pages/auth/login.tsx` (props and two mount points), `resources/js/pages/auth/magic-link.tsx` (look), `resources/js/components/skrum/resend-code.tsx:10` (`locale: string`, for Task 18), `resources/js/pages/dev/sections/` (one section showing the button and the sent state)
- Test: the two Vitest files; `tests/Feature/Auth/MagicLinkTest.php` already covers the props

**Interfaces:**
- Consumes: `MagicLinksController.store` (Wayfinder, `@/actions/App/Http/Controllers/MagicLinksController`), login props `canUseMagicLink: boolean`, `status?: string` (`'magic-link-sent'`).
- Produces: `useSecondsLeft(initial: number): [number, (seconds: number) => void]`; `<MagicLinkButton email onMissingAddress onSent />` (the ghost button of the form); `<MagicLinkSent email onUseAnotherAddress />` (the state that replaces the form).

- [ ] **Step 1: Write the failing tests**

`resources/js/hooks/use-seconds-left.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSecondsLeft } from '@/hooks/use-seconds-left';

describe('useSecondsLeft', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('counts down to zero and stops', () => {
        const { result } = renderHook(() => useSecondsLeft(2));

        expect(result.current[0]).toBe(2);
        act(() => vi.advanceTimersByTime(1000));
        expect(result.current[0]).toBe(1);
        act(() => vi.advanceTimersByTime(5000));
        expect(result.current[0]).toBe(0);
    });

    it('restarts when told', () => {
        const { result } = renderHook(() => useSecondsLeft(0));

        act(() => result.current[1](60));
        expect(result.current[0]).toBe(60);
        act(() => vi.advanceTimersByTime(1000));
        expect(result.current[0]).toBe(59);
    });

    it('never goes below zero for a negative start', () => {
        const { result } = renderHook(() => useSecondsLeft(-5));

        expect(result.current[0]).toBe(0);
    });
});
```

`resources/js/components/auth/magic-link-request.test.tsx`:

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MagicLinkButton, MagicLinkSent } from '@/components/auth/magic-link-request';

const post = vi.fn();

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    router: { post: (...args: unknown[]) => post(...args) },
    usePage: () => ({ props: { locale: 'en', translations: {} } }),
}));

describe('MagicLinkButton', () => {
    beforeEach(() => post.mockReset());

    it('posts the address typed in the login form', () => {
        render(<MagicLinkButton email="ada@example.test" onMissingAddress={() => {}} onSent={() => {}} />);

        fireEvent.click(screen.getByRole('button', { name: 'E-mail me a magic link instead' }));

        expect(post).toHaveBeenCalledTimes(1);
        expect(post.mock.calls[0][1]).toEqual({ email: 'ada@example.test' });
    });

    it('asks for the address instead of posting an empty one', () => {
        const onMissingAddress = vi.fn();

        render(<MagicLinkButton email="   " onMissingAddress={onMissingAddress} onSent={() => {}} />);
        fireEvent.click(screen.getByRole('button', { name: 'E-mail me a magic link instead' }));

        expect(post).not.toHaveBeenCalled();
        expect(onMissingAddress).toHaveBeenCalledTimes(1);
    });
});

describe('MagicLinkSent', () => {
    beforeEach(() => {
        post.mockReset();
        vi.useFakeTimers();
    });
    afterEach(() => vi.useRealTimers());

    it('shows the state of the mockup with the address typed in this browser, the same for every address', () => {
        render(<MagicLinkSent email="ada@example.test" onUseAnotherAddress={() => {}} />);

        expect(screen.getByRole('heading', { name: 'Check your inbox' })).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent(
            'If an account exists for ada@example.test, a sign-in link is on its way. It is valid for 15 minutes and works once.',
        );
        expect(screen.getByText('ada@example.test').tagName).toBe('STRONG');
        expect(screen.getByText('Nothing received? Check your spam folder. On a self-hosted instance, sending depends on the SMTP your admin configured.')).toBeInTheDocument();
    });

    it('keeps the resend button disabled for a minute, counting down, then sends again', () => {
        render(<MagicLinkSent email="ada@example.test" onUseAnotherAddress={() => {}} />);

        const pass = (seconds: number) => {
            for (let second = 0; second < seconds; second++) {
                act(() => vi.advanceTimersByTime(1000));
            }
        };

        expect(screen.getByRole('button', { name: 'Resend in 1:00' })).toBeDisabled();

        pass(18);
        expect(screen.getByRole('button', { name: 'Resend in 0:42' })).toBeDisabled();

        pass(42);
        fireEvent.click(screen.getByRole('button', { name: 'Resend the link' }));

        expect(post.mock.calls[0][1]).toEqual({ email: 'ada@example.test' });
    });

    it('goes back to the form for another address', () => {
        const onUseAnotherAddress = vi.fn();

        render(<MagicLinkSent email="ada@example.test" onUseAnotherAddress={onUseAnotherAddress} />);
        fireEvent.click(screen.getByRole('button', { name: 'Use another address' }));

        expect(onUseAnotherAddress).toHaveBeenCalledTimes(1);
    });
});
```

If the project's other component tests mock `useTrans` differently (see `resources/js/components/settings/avatar-style-card.test.tsx`), use that mock instead of the `usePage` stub.

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run test -- use-seconds-left magic-link-request`
Expected: FAIL, module not found.

- [ ] **Step 3: The hook**

```ts
import { useEffect, useState } from 'react';

/**
 * Seconds left of a cooldown the server announced. The server stays the
 * judge: this only spares a request that would send nothing.
 */
export function useSecondsLeft(
    initial: number,
): [number, (seconds: number) => void] {
    const [seconds, setSeconds] = useState(() => Math.max(0, initial));

    useEffect(() => {
        if (seconds <= 0) {
            return;
        }

        const timer = window.setTimeout(
            () => setSeconds((current) => Math.max(0, current - 1)),
            1000,
        );

        return () => window.clearTimeout(timer);
    }, [seconds]);

    return [seconds, (next: number) => setSeconds(Math.max(0, next))];
}
```

- [ ] **Step 4: The two components**

`resources/js/components/auth/magic-link-request.tsx`:

```tsx
import { router, usePage } from '@inertiajs/react';
import { MailCheck } from 'lucide-react';
import { useState } from 'react';
import MagicLinksController from '@/actions/App/Http/Controllers/MagicLinksController';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useSecondsLeft } from '@/hooks/use-seconds-left';
import { useTrans } from '@/hooks/use-trans';

const CooldownSeconds = 60;

type SendOptions = {
    onStart: () => void;
    onFinish: () => void;
    onSuccess: () => void;
    onError: (message: string | undefined) => void;
};

function sendMagicLink(email: string, options: SendOptions): void {
    router.post(
        MagicLinksController.store.url(),
        { email },
        {
            preserveScroll: true,
            preserveState: true,
            onStart: options.onStart,
            onFinish: options.onFinish,
            onSuccess: options.onSuccess,
            onError: (errors) => options.onError(errors.email),
        },
    );
}

function formatCountdown(seconds: number, locale: string): string {
    const digits = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2 });

    return `${Math.floor(seconds / 60)}:${digits.format(seconds % 60)}`;
}

/**
 * The ghost button of the login form. It sends the address already typed in
 * the form's e-mail field: the mockup has one field, not two.
 */
export function MagicLinkButton({
    email,
    onMissingAddress,
    onSent,
}: {
    email: string;
    onMissingAddress: () => void;
    onSent: () => void;
}) {
    const { t } = useTrans();
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string>();

    const send = () => {
        if (email.trim() === '') {
            onMissingAddress();

            return;
        }

        sendMagicLink(email, {
            onStart: () => setProcessing(true),
            onFinish: () => setProcessing(false),
            onSuccess: () => {
                setError(undefined);
                onSent();
            },
            onError: setError,
        });
    };

    return (
        <div className="flex flex-col gap-2">
            <Button
                type="button"
                variant="ghost"
                className="w-full"
                disabled={processing}
                data-test="magic-link-button"
                onClick={send}
            >
                {processing && <Spinner />}
                <span className="truncate">{t('E-mail me a magic link instead')}</span>
            </Button>
            <InputError message={error} />
        </div>
    );
}

/**
 * The "link sent" state. It says the same thing for every address: the
 * server never tells whether an account exists, and neither does this.
 */
export function MagicLinkSent({
    email,
    onUseAnotherAddress,
}: {
    email: string;
    onUseAnotherAddress: () => void;
}) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string>();
    const [remaining, restart] = useSecondsLeft(CooldownSeconds);
    const sentence = t(
        'If an account exists for :email, a sign-in link is on its way. It is valid for 15 minutes and works once.',
    ).split(':email');

    const resend = () =>
        sendMagicLink(email, {
            onStart: () => setProcessing(true),
            onFinish: () => setProcessing(false),
            onSuccess: () => {
                setError(undefined);
                restart(CooldownSeconds);
            },
            onError: setError,
        });

    return (
        <div className="flex flex-col items-center gap-4 text-center" data-slot="magic-link-sent">
            <MailCheck className="size-10 text-skrum-primary-text" aria-hidden="true" />
            <h1 className="text-heading-lg font-bold text-foreground">{t('Check your inbox')}</h1>
            <p role="status" className="text-body text-foreground">
                {sentence[0]}
                <strong className="font-semibold break-all">{email}</strong>
                {sentence[1]}
            </p>
            <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={remaining > 0 || processing}
                onClick={resend}
            >
                {processing && <Spinner />}
                <span className="truncate tabular-nums">
                    {remaining > 0
                        ? t('Resend in :time', { time: formatCountdown(remaining, String(locale)) })
                        : t('Resend the link')}
                </span>
            </Button>
            <InputError message={error} />
            <p className="text-body-sm text-muted-foreground">
                {t('Nothing received? Check your spam folder. On a self-hosted instance, sending depends on the SMTP your admin configured.')}
            </p>
            <Button type="button" variant="link" onClick={onUseAnotherAddress}>
                {t('Use another address')}
            </Button>
        </div>
    );
}
```

The heading and text classes are those the auth card of 18e uses for its own title and description (read `pages/auth/login.tsx`; `text-heading-lg` stands for that title class). The mockup's alert on SMTP is the muted help line it draws under the button. Two elements of the mockup are not built, and are in the Deviations table: the sentence "We sent a link to …" (V12, replaced by the conditional sentence) and "Open my mail app" (V13).

`ResendCode` declares `locale: 'fr' | 'en'`; the application has four locales and the value only reaches `Intl.NumberFormat`: change the type to `string` in `resources/js/components/skrum/resend-code.tsx` and keep its tests green (Task 18 uses it with the page's locale).

- [ ] **Step 5: Mount them on the login page**

In `resources/js/pages/auth/login.tsx`: add `canUseMagicLink: boolean` to `Props`. The page keeps the address of its `#email` field in state it already has (the form's `data.email`), and one more piece of state, `linkSentTo: string | null`.

- Under the primary log-in button, where the mockup has "Recevoir un lien magique à la place": `{canUseMagicLink && <MagicLinkButton email={form.data.email} onMissingAddress={() => document.getElementById('email')?.focus()} onSent={() => setLinkSentTo(form.data.email)} />}`. A missing address also sets the form's own error under the field (`Enter your e-mail address first.`), as an error under the field and never a toast (README).
- When `linkSentTo !== null`, the card body is `<MagicLinkSent email={linkSentTo} onUseAnotherAddress={() => setLinkSentTo(null)} />` in place of the SSO buttons and the form, as the mockup variant replaces the whole card content.
- The password form, `#email`, `#password`, `@login-button` and the SSO buttons do not move in the tab order (the browser suite signs in through them); the ghost button comes after `@login-button` and before the register link.
- The page must not render the raw `status` string `magic-link-sent`: where the page prints `status` as a message, exclude that value. After a full reload the state is gone and the form is back, which is harmless: the cooldown is the server's.

- [ ] **Step 6: Finish the confirmation page** per `ScreenAuth`: `auth/magic-link.tsx` keeps its props, the `magic-link-confirm-button` test hook and its two states; apply the auth card layout 18e uses (heading, description, one primary button, text link). No other logic. The mockup has no drawing of this page (it exists because of S3): it is composed from the auth card, like the "link sent" variant.

- [ ] **Step 7: Compare with the mockup, then run**

Open `/login` at 1440 and 390, light and dark, beside `ScreenAuth/preview.html`: the ghost button sits under the primary button with the mockup's label; the sent state has the icon, the title, the sentence with the address in bold, the disabled "Resend in 0:42", the help line and "Use another address", in that order. Differences are fixed or added to the Deviations table.

Run: `npm run test -- use-seconds-left magic-link-request resend-code`, `npm run types:check`, `npm run check`, `npm run build:front`, then `vendor/bin/sail artisan test --compact tests/Feature/Auth tests/Feature/TranslationKeysTest.php`
Expected: PASS after the new keys are in the four files (table of Task 26).

- [ ] **Step 8: Commit**

```bash
git add resources/js lang
git commit -m "feat(auth): magic link from the login form, with the sent state of the mockup and a confirmation before signing in"
```

### Task 18: Two-factor challenge and Security — e-mail code

**Files:**
- Create: `resources/js/components/auth/email-code-challenge.tsx`, `resources/js/components/auth/email-code-challenge.test.tsx`, `resources/js/components/settings/email-second-factor-card.tsx`, `resources/js/components/settings/email-second-factor-card.test.tsx`
- Modify: `resources/js/pages/auth/two-factor-challenge.tsx`, `resources/js/pages/settings/security.tsx`
- Test: the two Vitest files; props are covered by `EmailSecondFactorTest.php`

**Interfaces:**
- Consumes: challenge props `methods: Array<'totp' | 'email'>`, `emailCode: { sentTo: string; resendIn: number; available: boolean } | null`; Security prop `emailSecondFactor: { available: boolean; enabled: boolean; address: string; resendIn: number }`; Wayfinder `EmailCodeChallengesController.store`, `EmailChallengeCodesController.store`, `Settings/EmailSecondFactorsController.store|destroy`, `Settings/EmailSecondFactorCodesController.store`; `useSecondsLeft`; `ResendCode`; `InputOTP`.
- Produces: `<EmailCodeChallenge sentTo resendIn available />`; `<EmailSecondFactorCard available enabled address resendIn />`.

- [ ] **Step 1: Write the failing tests**

`resources/js/components/auth/email-code-challenge.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailCodeChallenge } from '@/components/auth/email-code-challenge';

const post = vi.fn();

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    router: { post: (...args: unknown[]) => post(...args) },
    usePage: () => ({ props: { locale: 'en', translations: {} } }),
}));

describe('EmailCodeChallenge', () => {
    beforeEach(() => post.mockReset());

    it('says where the code went and cannot resend during the cooldown', () => {
        render(<EmailCodeChallenge sentTo="a…@example.test" resendIn={42} available />);

        expect(screen.getByText(/a…@example\.test/)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /resend/i })).toBeNull();
    });

    it('asks for a new code once the cooldown is over', () => {
        render(<EmailCodeChallenge sentTo="a…@example.test" resendIn={0} available />);

        fireEvent.click(screen.getByRole('button', { name: /resend/i }));

        expect(post).toHaveBeenCalledTimes(1);
        expect(String(post.mock.calls[0][0])).toContain('/two-factor-challenge/email-code');
    });

    it('submits six digits to the e-mail route, never to the authenticator route', () => {
        render(<EmailCodeChallenge sentTo="a…@example.test" resendIn={10} available />);

        fireEvent.change(screen.getByRole('textbox'), { target: { value: '123456' } });
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

        expect(String(post.mock.calls[0][0])).toMatch(/\/two-factor-challenge\/email$/);
        expect(post.mock.calls[0][1]).toEqual({ code: '123456' });
    });

    it('explains that codes cannot be sent when mail is off', () => {
        render(<EmailCodeChallenge sentTo="a…@example.test" resendIn={0} available={false} />);

        expect(screen.getByRole('alert')).toHaveTextContent('E-mail is not available on this instance');
        expect(screen.queryByRole('button', { name: /resend/i })).toBeNull();
    });
});
```

`resources/js/components/settings/email-second-factor-card.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailSecondFactorCard } from '@/components/settings/email-second-factor-card';

const post = vi.fn();
const destroy = vi.fn();

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    router: {
        post: (...args: unknown[]) => post(...args),
        delete: (...args: unknown[]) => destroy(...args),
    },
    usePage: () => ({ props: { locale: 'en', translations: {} } }),
}));

describe('EmailSecondFactorCard', () => {
    beforeEach(() => {
        post.mockReset();
        destroy.mockReset();
    });

    it('states the limits of the factor', () => {
        render(<EmailSecondFactorCard available enabled={false} address="ada@example.test" resendIn={0} />);

        expect(screen.getByText(/proves the same mailbox twice/)).toBeInTheDocument();
        expect(screen.getByText(/no recovery codes/)).toBeInTheDocument();
    });

    it('sends a code, then turns the factor on with it', () => {
        render(<EmailSecondFactorCard available enabled={false} address="ada@example.test" resendIn={0} />);

        fireEvent.click(screen.getByRole('button', { name: 'Send me a code' }));
        expect(String(post.mock.calls[0][0])).toMatch(/\/settings\/email-second-factor\/code$/);

        fireEvent.change(screen.getByRole('textbox'), { target: { value: '123456' } });
        fireEvent.click(screen.getByRole('button', { name: 'Turn on' }));
        expect(String(post.mock.calls[1][0])).toMatch(/\/settings\/email-second-factor$/);
        expect(post.mock.calls[1][1]).toEqual({ code: '123456' });
    });

    it('turns the factor off', () => {
        render(<EmailSecondFactorCard available enabled address="ada@example.test" resendIn={0} />);

        fireEvent.click(screen.getByRole('button', { name: 'Turn off the e-mail code' }));

        expect(destroy).toHaveBeenCalledTimes(1);
    });

    it('is not offered when mail does not deliver and the factor is off', () => {
        const { container } = render(<EmailSecondFactorCard available={false} enabled={false} address="ada@example.test" resendIn={0} />);

        expect(container).toBeEmptyDOMElement();
    });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run test -- email-code-challenge email-second-factor-card`
Expected: FAIL, module not found.

- [ ] **Step 3: The challenge container**

```tsx
import { router, usePage } from '@inertiajs/react';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { useState } from 'react';
import type { FormEvent } from 'react';
import EmailChallengeCodesController from '@/actions/App/Http/Controllers/EmailChallengeCodesController';
import EmailCodeChallengesController from '@/actions/App/Http/Controllers/EmailCodeChallengesController';
import InputError from '@/components/input-error';
import { ResendCode } from '@/components/skrum/resend-code';
import { Button } from '@/components/ui/button';
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from '@/components/ui/input-otp';
import { useSecondsLeft } from '@/hooks/use-seconds-left';
import { useTrans } from '@/hooks/use-trans';

const CodeLength = 6;
const CooldownSeconds = 60;

export function EmailCodeChallenge({
    sentTo,
    resendIn,
    available,
}: {
    sentTo: string;
    resendIn: number;
    available: boolean;
}) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const [code, setCode] = useState('');
    const [error, setError] = useState<string>();
    const [processing, setProcessing] = useState(false);
    const [remaining, restart] = useSecondsLeft(resendIn);

    const submit = (event: FormEvent) => {
        event.preventDefault();

        router.post(
            EmailCodeChallengesController.store.url(),
            { code },
            {
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
                onError: (errors) => {
                    setError(errors.code);
                    setCode('');
                },
            },
        );
    };

    const resend = () => {
        router.post(
            EmailChallengeCodesController.store.url(),
            {},
            {
                preserveScroll: true,
                onSuccess: () => restart(CooldownSeconds),
            },
        );
    };

    return (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <p className="text-body-sm text-muted-foreground">
                {t('Enter the 6-digit code sent to :address.', {
                    address: sentTo,
                })}
            </p>
            <div className="flex justify-center">
                <InputOTP
                    name="code"
                    maxLength={CodeLength}
                    value={code}
                    onChange={setCode}
                    disabled={processing}
                    pattern={REGEXP_ONLY_DIGITS}
                    autoFocus
                >
                    <InputOTPGroup>
                        {Array.from({ length: CodeLength }, (_, index) => (
                            <InputOTPSlot key={index} index={index} />
                        ))}
                    </InputOTPGroup>
                </InputOTP>
            </div>
            <InputError message={error} />
            <Button
                type="submit"
                className="w-full"
                disabled={processing || code.length !== CodeLength}
            >
                {t('Continue')}
            </Button>
            {available ? (
                <ResendCode
                    cooldownSeconds={CooldownSeconds}
                    remaining={remaining}
                    onResend={resend}
                    sentTo={sentTo}
                    locale={String(locale)}
                />
            ) : (
                <p role="alert" className="text-body-sm text-skrum-destructive-text">
                    {t(
                        'E-mail is not available on this instance, so no code can be sent. Contact your administrator.',
                    )}
                </p>
            )}
        </form>
    );
}
```

- [ ] **Step 4: Wire the challenge page**

In `resources/js/pages/auth/two-factor-challenge.tsx`: the page receives `methods` and `emailCode`. Modes: `totp` (the existing form, untouched, posting to Fortify's route), `recovery` (existing, offered only when `methods` contains `'totp'`), `email` (`<EmailCodeChallenge {...emailCode} />`). The starting mode is `'totp'` when `methods` contains it, else `'email'`. When both are present, a text button switches: "Use an e-mail code" → posts `EmailChallengeCodesController.store` once (it sends the first code; the server enforces the cooldown) and shows the e-mail mode; "Use the authenticator app" switches back. The title and description passed to `setLayoutProps` for the e-mail mode are `t('E-mail code')` and `t('Enter the code we sent to your mailbox.')`. An e-mail code is never posted to `two-factor.login.store`.

- [ ] **Step 5: The Security card**

```tsx
import { router, usePage } from '@inertiajs/react';
import { MailCheck, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import EmailSecondFactorCodesController from '@/actions/App/Http/Controllers/Settings/EmailSecondFactorCodesController';
import EmailSecondFactorsController from '@/actions/App/Http/Controllers/Settings/EmailSecondFactorsController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { ResendCode } from '@/components/skrum/resend-code';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSecondsLeft } from '@/hooks/use-seconds-left';
import { useTrans } from '@/hooks/use-trans';

const CooldownSeconds = 60;

export function EmailSecondFactorCard({
    available,
    enabled,
    address,
    resendIn,
}: {
    available: boolean;
    enabled: boolean;
    address: string;
    resendIn: number;
}) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const [code, setCode] = useState('');
    const [codeRequested, setCodeRequested] = useState(resendIn > 0);
    const [error, setError] = useState<string>();
    const [remaining, restart] = useSecondsLeft(resendIn);

    if (!available && !enabled) {
        return null;
    }

    const requestCode = () => {
        router.post(
            EmailSecondFactorCodesController.store.url(),
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    setCodeRequested(true);
                    restart(CooldownSeconds);
                },
            },
        );
    };

    const turnOn = (event: FormEvent) => {
        event.preventDefault();

        router.post(
            EmailSecondFactorsController.store.url(),
            { code },
            {
                preserveScroll: true,
                onError: (errors) => setError(errors.code),
                onSuccess: () => {
                    setCode('');
                    setError(undefined);
                    setCodeRequested(false);
                },
            },
        );
    };

    return (
        <section className="flex flex-col gap-4" data-slot="email-second-factor">
            <Heading
                variant="small"
                title={t('Code by e-mail')}
                description={t(
                    'Receive a 6-digit code at :address each time you sign in.',
                    { address },
                )}
            />
            <ul className="flex flex-col gap-2 text-body-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                    <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    <span>
                        {t(
                            'A sign-in link followed by an e-mail code proves the same mailbox twice. An authenticator app or a passkey protects better.',
                        )}
                    </span>
                </li>
                <li className="flex items-start gap-2">
                    <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    <span>
                        {t(
                            'This factor has no recovery codes: if you lose access to your mailbox, you lose access to your account.',
                        )}
                    </span>
                </li>
            </ul>
            {enabled && (
                <div className="flex flex-wrap items-center gap-3">
                    <p className="flex items-center gap-2 text-body-sm text-skrum-success-text">
                        <MailCheck aria-hidden="true" className="size-4 shrink-0" />
                        {t('The e-mail code is on.')}
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                            router.delete(EmailSecondFactorsController.destroy.url(), {
                                preserveScroll: true,
                            })
                        }
                    >
                        <span className="truncate">{t('Turn off the e-mail code')}</span>
                    </Button>
                </div>
            )}
            {!enabled && !codeRequested && (
                <Button type="button" className="self-start" onClick={requestCode}>
                    <span className="truncate">{t('Send me a code')}</span>
                </Button>
            )}
            {!enabled && codeRequested && (
                <form onSubmit={turnOn} className="flex flex-col gap-3" noValidate>
                    <div className="grid gap-2">
                        <Label htmlFor="email-second-factor-code">
                            {t('Code received by e-mail')}
                        </Label>
                        <Input
                            id="email-second-factor-code"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            value={code}
                            onChange={(event) => setCode(event.target.value)}
                        />
                        <InputError message={error} />
                    </div>
                    <Button type="submit" className="self-start" disabled={code.length !== 6}>
                        <span className="truncate">{t('Turn on')}</span>
                    </Button>
                    <ResendCode
                        cooldownSeconds={CooldownSeconds}
                        remaining={remaining}
                        onResend={requestCode}
                        sentTo={address}
                        locale={String(locale)}
                    />
                </form>
            )}
        </section>
    );
}
```

In the first Vitest of the card the code field appears only after "Send me a code" succeeds: make the `post` mock call `options.onSuccess?.()` for the first call (`post.mockImplementationOnce((_url, _data, options) => options?.onSuccess?.())`) before clicking, and keep the assertions as written.

Mount it in `resources/js/pages/settings/security.tsx` below the two-factor block: add `emailSecondFactor` to `Props` and render `<EmailSecondFactorCard {...props.emailSecondFactor} />`. The existing blocks (password, authenticator app, passkeys) keep their order, ids and test hooks.

- [ ] **Step 5b: Compare with the Security mockup**

Neither screen of this task is drawn by a mockup (see the note under the Deviations table): the challenge in e-mail mode and the e-mail card are composed from what `ScreenSecurity/preview.html` draws for the authenticator app. Open Security beside that preview, both themes, 1440 and 390, and check that the e-mail card is a sibling of the two-factor block in every respect the mockup fixes: the same card anatomy and spacing, the state badge ("On" / "Off") in the header as the mockup's "Activée" / "Désactivée", the six-box `InputOTP` grouped 3 + 3 with the active box on the focus ring and a pasted code accepted, the confirm and cancel buttons in the mockup's order, "Turn off" as an outline destructive button with its icon, the warning about recovery in the `Alert` style the mockup uses for the recovery codes. On the challenge page the code field is the same `InputOTP`, with `ResendCode` under it. A difference with those patterns is fixed here.

- [ ] **Step 6: Run**

Run: `npm run test -- email-code-challenge email-second-factor-card`, `npm run types:check`, `npm run check`, `npm run build:front`, `vendor/bin/sail artisan test --compact tests/Feature/Auth tests/Feature/Settings tests/Feature/TranslationKeysTest.php`
Expected: PASS with the new keys in four languages (the test lists the missing ones).

- [ ] **Step 7: Commit**

```bash
git add resources/js lang
git commit -m "feat(auth): e-mail code at the challenge and in the security settings"
```

### Task 19: Bell — `NotificationsPanel` to the mockup, on the notification routes

**Files:**
- Create: `resources/js/hooks/use-notifications.ts`, `resources/js/hooks/use-notifications.test.ts`, `resources/js/components/action-items/notifications-menu.tsx`, `resources/js/components/action-items/notifications-menu.test.tsx`
- Modify: `resources/js/layouts/skrum/app-layout.tsx:28-31`
- Not touched: `resources/js/components/notification-bell.tsx` (still used by `app-sidebar-header.tsx`; both go in 18g), the three routes, `ListActionItemNotifications`
- Test: the two Vitest files; `tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php:546-567` must pass unchanged

**Interfaces:**
- Consumes: `NotificationsController.index()`, `NotificationsController.update(id)` with `{ read: true }` → `{ unreadCount }`, `ReadAllNotificationsController.store()`; shared prop `notifications: { unreadCount: number } | null`; `NotificationsPanel` and `NotificationsBell` of `@/components/skrum/notifications-panel` (props read on 2026-10-02: `notifications`, `unreadCount`, `tab`, `onTabChange`, `onMarkAllRead`, `onOpen`, `settingsHref`, `failed`, `onRetry`, `markingAllRead`, `loading`, `locale`); `retroRequest`.
- Produces: `useNotifications(): { available: boolean; notifications: ActionItemNotification[]; unreadCount: number; loading: boolean; failed: boolean; markingAllRead: boolean; load(): Promise<void>; open(notification: AppNotification): Promise<void>; markAllRead(): Promise<void> }`; `<NotificationsMenu />`.

- [ ] **Step 1: Write the failing hook test**

```ts
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotifications } from '@/hooks/use-notifications';
import { retroRequest } from '@/lib/retro/api';

const visit = vi.fn();
const reload = vi.fn();
let shared: { unreadCount: number } | null = { unreadCount: 2 };

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest: vi.fn(),
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    router: {
        visit: (...args: unknown[]) => visit(...args),
        reload: (...args: unknown[]) => reload(...args),
    },
    usePage: () => ({ props: { notifications: shared, locale: 'en', translations: {} } }),
}));

const request = vi.mocked(retroRequest);

const unread = {
    id: 'n1',
    kind: 'overdue' as const,
    wording: 'overdue' as const,
    readAt: null,
    createdAt: '2026-10-01T08:00:00Z',
    actionItem: { id: 'a1', content: 'Fix the build', teamName: 'Atlas', dueOn: '2026-09-30', isOverdue: true, url: '/workspaces/w/action-items?item=a1' },
};

describe('useNotifications', () => {
    beforeEach(() => {
        request.mockReset();
        visit.mockReset();
        reload.mockReset();
        shared = { unreadCount: 2 };
    });

    it('is unavailable for a guest', () => {
        shared = null;

        expect(renderHook(() => useNotifications()).result.current.available).toBe(false);
    });

    it('starts from the shared count and loads the list on demand', async () => {
        request.mockResolvedValueOnce({ notifications: [unread], unreadCount: 1 } as never);
        const { result } = renderHook(() => useNotifications());

        expect(result.current.unreadCount).toBe(2);
        await act(() => result.current.load());

        expect(result.current.notifications).toEqual([unread]);
        expect(result.current.unreadCount).toBe(1);
        expect(result.current.failed).toBe(false);
    });

    it('reports a failed load and keeps the previous list', async () => {
        request.mockResolvedValueOnce({ notifications: [unread], unreadCount: 1 } as never);
        request.mockRejectedValueOnce(new Error('offline'));
        const { result } = renderHook(() => useNotifications());

        await act(() => result.current.load());
        await act(() => result.current.load());

        expect(result.current.failed).toBe(true);
        expect(result.current.notifications).toEqual([unread]);
    });

    it('drops the answer of an older load', async () => {
        let resolveFirst: (value: unknown) => void = () => {};
        request.mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)) as never);
        request.mockResolvedValueOnce({ notifications: [], unreadCount: 0 } as never);
        const { result } = renderHook(() => useNotifications());

        const first = act(() => result.current.load());
        await act(() => result.current.load());
        resolveFirst({ notifications: [unread], unreadCount: 1 });
        await first;

        expect(result.current.notifications).toEqual([]);
    });

    it('marks an unread notification read, then visits its item even if marking fails', async () => {
        request.mockRejectedValueOnce(new Error('offline'));
        const { result } = renderHook(() => useNotifications());

        await act(() => result.current.open(unread));

        expect(visit).toHaveBeenCalledWith(unread.actionItem.url);
    });

    it('marks everything read once at a time', async () => {
        request.mockResolvedValueOnce({ notifications: [unread], unreadCount: 1 } as never);
        request.mockResolvedValueOnce(null as never);
        const { result } = renderHook(() => useNotifications());
        await act(() => result.current.load());

        await act(() => result.current.markAllRead());

        expect(result.current.unreadCount).toBe(0);
        expect(result.current.notifications[0].readAt).not.toBeNull();
    });

    it('refreshes the shared counts when the window gets the focus', async () => {
        renderHook(() => useNotifications());

        window.dispatchEvent(new Event('focus'));

        await waitFor(() => expect(reload).toHaveBeenCalledWith({ only: ['notifications', 'actionItems'] }));
    });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- use-notifications`
Expected: FAIL, module not found.

- [ ] **Step 3: The hook**

```ts
import { router, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import NotificationsController from '@/actions/App/Http/Controllers/NotificationsController';
import ReadAllNotificationsController from '@/actions/App/Http/Controllers/ReadAllNotificationsController';
import type {
    ActionItemNotification,
    AppNotification,
} from '@/components/skrum/notifications-panel';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';

const SharedCounts = ['notifications', 'actionItems'];

function refreshCounts(): void {
    router.reload({ only: SharedCounts });
}

function isActionItemNotification(
    notification: AppNotification,
): notification is ActionItemNotification {
    return notification.kind === 'due_soon' || notification.kind === 'overdue';
}

export function useNotifications() {
    const { t } = useTrans();
    const shared = usePage().props.notifications;
    const sharedCount = shared?.unreadCount ?? 0;
    const [unreadCount, setUnreadCount] = useState(sharedCount);
    const [knownShared, setKnownShared] = useState(sharedCount);
    const [notifications, setNotifications] = useState<ActionItemNotification[]>([]);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const [markingAllRead, setMarkingAllRead] = useState(false);
    const latestLoad = useRef(0);

    if (knownShared !== sharedCount) {
        setKnownShared(sharedCount);
        setUnreadCount(sharedCount);
    }

    useEffect(() => {
        window.addEventListener('focus', refreshCounts);

        return () => window.removeEventListener('focus', refreshCounts);
    }, []);

    const load = async (): Promise<void> => {
        const requestId = ++latestLoad.current;

        setLoading(true);
        setFailed(false);

        try {
            const response = await retroRequest<{
                notifications: ActionItemNotification[];
                unreadCount: number;
            }>(NotificationsController.index());

            if (requestId !== latestLoad.current) {
                return;
            }

            setNotifications(response.notifications);
            setUnreadCount(response.unreadCount);
        } catch {
            if (requestId === latestLoad.current) {
                setFailed(true);
            }
        } finally {
            if (requestId === latestLoad.current) {
                setLoading(false);
            }
        }
    };

    const open = async (notification: AppNotification): Promise<void> => {
        if (!isActionItemNotification(notification)) {
            return;
        }

        if (notification.readAt === null) {
            try {
                const response = await retroRequest<{ unreadCount: number }>(
                    NotificationsController.update(notification.id),
                    { read: true },
                );

                setUnreadCount(response.unreadCount);
            } catch {
                // Visiting the item matters more than the read mark.
            }
        }

        router.visit(notification.actionItem.url);
    };

    const markAllRead = async (): Promise<void> => {
        if (markingAllRead) {
            return;
        }

        setMarkingAllRead(true);

        try {
            await retroRequest(ReadAllNotificationsController.store());
            setUnreadCount(0);
            setNotifications((current) =>
                current.map((notification) => ({
                    ...notification,
                    readAt: notification.readAt ?? new Date().toISOString(),
                })),
            );
        } catch {
            toast.error(t('Something went wrong. Please try again.'));
        } finally {
            setMarkingAllRead(false);
        }
    };

    return {
        available: shared !== null && shared !== undefined,
        notifications,
        unreadCount,
        loading,
        failed,
        markingAllRead,
        load,
        open,
        markAllRead,
    };
}
```

- [ ] **Step 4: The container and its test**

```tsx
import { usePage } from '@inertiajs/react';
import { useState } from 'react';
import {
    NotificationsBell,
    NotificationsPanel,
} from '@/components/skrum/notifications-panel';
import type { NotificationsTab } from '@/components/skrum/notifications-panel';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useNotifications } from '@/hooks/use-notifications';
import { useTrans } from '@/hooks/use-trans';
import { edit as notificationSettings } from '@/routes/notificationPreferences';

/**
 * The accessible names of the bell are those the browser suite reads:
 * "Notifications", "1 unread notification", "2 unread notifications".
 */
export function NotificationsMenu() {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const model = useNotifications();
    const [isOpen, setIsOpen] = useState(false);
    const [tab, setTab] = useState<NotificationsTab>('all');

    if (!model.available) {
        return null;
    }

    const label =
        model.unreadCount === 0
            ? t('Notifications')
            : model.unreadCount === 1
              ? t(':count unread notification', { count: model.unreadCount })
              : t(':count unread notifications', { count: model.unreadCount });

    return (
        <Popover
            open={isOpen}
            onOpenChange={(next) => {
                setIsOpen(next);

                if (next) {
                    void model.load();
                }
            }}
        >
            <PopoverTrigger asChild>
                <NotificationsBell
                    unreadCount={model.unreadCount}
                    open={isOpen}
                    aria-label={label}
                />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-96 p-0">
                <NotificationsPanel
                    notifications={model.notifications}
                    unreadCount={model.unreadCount}
                    tab={tab}
                    onTabChange={setTab}
                    onMarkAllRead={() => void model.markAllRead()}
                    onOpen={(notification) => {
                        setIsOpen(false);
                        void model.open(notification);
                    }}
                    settingsHref={notificationSettings.url()}
                    failed={model.failed}
                    onRetry={() => void model.load()}
                    markingAllRead={model.markingAllRead}
                    loading={model.loading}
                    locale={String(locale)}
                />
            </PopoverContent>
        </Popover>
    );
}
```

`resources/js/components/action-items/notifications-menu.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NotificationsMenu } from '@/components/action-items/notifications-menu';

const load = vi.fn(async () => {});
let model = {
    available: true,
    notifications: [],
    unreadCount: 2,
    loading: false,
    failed: false,
    markingAllRead: false,
    load,
    open: vi.fn(async () => {}),
    markAllRead: vi.fn(async () => {}),
};

vi.mock('@/hooks/use-notifications', () => ({ useNotifications: () => model }));
vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { locale: 'en', translations: {} } }),
}));

describe('NotificationsMenu', () => {
    it('keeps the accessible names the browser suite reads', () => {
        const { rerender } = render(<NotificationsMenu />);
        expect(screen.getByRole('button', { name: '2 unread notifications' })).toBeInTheDocument();

        model = { ...model, unreadCount: 1 };
        rerender(<NotificationsMenu />);
        expect(screen.getByRole('button', { name: '1 unread notification' })).toBeInTheDocument();

        model = { ...model, unreadCount: 0 };
        rerender(<NotificationsMenu />);
        expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    });

    it('loads the list when it opens', () => {
        render(<NotificationsMenu />);

        fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));

        expect(load).toHaveBeenCalledTimes(1);
    });

    it('renders nothing for a guest', () => {
        model = { ...model, available: false };

        expect(render(<NotificationsMenu />).container).toBeEmptyDOMElement();
    });
});
```

If `NotificationsBell` spreads `{...props}` before its own `aria-label`, the override is lost: read `notifications-panel.tsx:809-840` and, if needed, move `{...props}` after `aria-label` in that component (its own Vitest stays green). If the visual test reports overflow at 390, the panel's README gives the mobile presentation (a sheet); follow it rather than adding an arbitrary width.

- [ ] **Step 5: Mount it**

`resources/js/layouts/skrum/app-layout.tsx`: replace the import of `NotificationBell` by `NotificationsMenu` from `@/components/action-items/notifications-menu` and `actions={<NotificationBell />}` by `actions={<NotificationsMenu />}`.

- [ ] **Step 5b: Everything the NotificationsPanel mockup shows that the server now gives**

`NotificationsPanel/preview.html` is the reference: bell states (none, count, "9+", open, new arrival), popover with the header and "Mark all as read", the two tabs with their counts, the items (avatar or icon tile, sentence with the names in semibold, meta line, inline actions, unread dot and tint), the footer "Notification settings", the empty state "You're all caught up", and the `Drawer` under 640 px. The library component already draws all of it; the comments `Backlog:` in `components/skrum/notifications-panel.tsx` were written when the server gave action reminders only. Task 15 changed that. Tests first (in `use-notifications.test.ts` and `notifications-menu.test.tsx`), then the code:

1. **Kinds.** The hook passes through the three kinds of Task 15. `recap_ready` renders "The recap of **:title** is ready", the meta `:count action items · ROTI :roti · :when` (without the ROTI part when `roti` is null), the tile `file-text`, and the action "View recap" that opens `href` and marks it read. `team_invite` renders the actor's avatar, "**:name** invited you to join **:workspace**", the meta, and one action, "View invitation", which marks the notification read and visits `href` — the existing invitation page, where the existing "Accept invitation" button is. Nothing is accepted from the bell (S33): the container gives the component no `onInvite`, so the mockup's inline "Accept" and "Decline" are not rendered (Deviations V16); if the component cannot show a single link-action for this kind, it gains the prop `inviteHref?: (notification) => string` with its test.
2. **Ticket.** An action item notification shows its ticket key in the mono font after the due date, as the mockup ("Due Sep 29 · ATLAS-1287"), when `actionItem.ticket` is not null. The `Backlog:` comments on `ticket`, `onInvite` and the two kinds that now exist are removed from the component file; the type `BacklogNotificationKind` keeps `session_starting` and `mention` only (V14, V15), and `onInvite` stays an optional prop no container passes.
3. **Load more.** `useNotifications` keeps `hasMore` and exposes `loadMore()`, which calls `notifications.index` with `before` = the id of the last item and appends; the container passes `hasMore` and `onLoadMore` (README: 20 items then "Load more").
4. **Arrival.** (This is the only user of the private channel of Task 15; if that channel was dropped, this point is dropped with it and the bell keeps the refresh on focus.) `useNotifications` listens to `.notification.received` on the private channel `user.{id}` with the Echo hook the session containers use (`@laravel/echo-react`), sets the count from the payload, and, when the panel is open, reloads the first page without moving the item under the pointer (the component's concern: it keys items by id). The bell plays its arrival state once (the component's `bell-ring` and halo, off under reduced motion) and the container's `aria-live="polite"` region says "New notification". No polling is added; the refresh on window focus of Step 3 stays.
5. **Mark read on open of the item, not of the panel** (README): already the behaviour of Step 3; one test pins that opening the panel changes no `readAt`.
6. **Mobile.** Under 640 px the same content is in a `Drawer` (the component switches with `useIsMobile`): one test renders the container with the mobile hook mocked and finds the drawer title.

Then open the bell beside the preview, both themes, 1440 and 390, with one notification of each of the three kinds, read and unread: differences are fixed or go to the Deviations table (V14–V17 are the known ones).

- [ ] **Step 6: Run**

Run: `npm run test -- use-notifications notifications-menu notifications-panel`, `npm run types:check`, `npm run check`, `npm run build:front`, then `vendor/bin/sail artisan test --compact tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php`
Expected: PASS without editing the browser test. If one of its steps reads text inside the old dropdown that the panel words differently, the change is listed in the report with the README line that imposes the new wording.

- [ ] **Step 7: Commit**

```bash
git add resources/js lang
git commit -m "feat(notifications): the new bell and panel on the existing notification routes"
```

### Task 20: Command palette with content search

**Files:**
- Create: `resources/js/hooks/use-global-search.ts`, `resources/js/hooks/use-global-search.test.ts`, `resources/js/components/workspaces/command-menu.tsx`, `resources/js/components/workspaces/command-menu.test.tsx`
- Create also (Step 6b): `resources/js/hooks/use-recent-sessions.ts`, `resources/js/hooks/use-shortcut-sequence.ts`, each with its test
- Modify: `resources/js/components/ui/command.tsx:257-354` (a `results` group, an `onSearchChange` prop, shortcuts through `useShortcut`), `resources/js/components/ui/command.test.tsx`, `resources/js/layouts/skrum/app-layout.tsx`
- Test: the Vitest files

**Interfaces:**
- Consumes: `SearchResultsController.index` (Wayfinder), JSON of Task 9 (with the kind `card` and the key `context`, shown as the item's meta in place of the team for a card); `RecentSessionsController.index`, JSON of Task 15; `useSidebarModel` links (as 18e left them) for the "Go to" items; `useShortcut`.
- Produces:
  - `CommandPaletteItem['group']` becomes `'actions' | 'recent' | 'results' | 'goto'`; `CommandPaletteProps` gains `onSearchChange?: (value: string) => void`
  - `useGlobalSearch(query: string, delayMs?: number): { results: SearchResult[]; loading: boolean; failed: boolean; term: string }` with `SearchResult = { kind: 'retro' | 'poker' | 'whiteboard' | 'game' | 'action'; id: string; title: string; team: { id: string; name: string }; url: string }`; constants `SearchDelayMs = 150`, `SearchMinLength = 2`
  - `<CommandMenu />` (field in the topbar + palette), exporting `openCommandMenuEvent = 'skrum:open-command-menu'` for Task 21

- [ ] **Step 1: Write the failing hook test**

```ts
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchDelayMs, useGlobalSearch } from '@/hooks/use-global-search';
import type { SearchResult } from '@/hooks/use-global-search';
import { retroRequest } from '@/lib/retro/api';

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest: vi.fn(),
}));

const request = vi.mocked(retroRequest);

const kraken: SearchResult = { kind: 'retro', id: 'r1', title: 'Kraken retro', team: { id: 't1', name: 'Atlas' }, url: '/retros/r1' };

async function wait(ms: number): Promise<void> {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });
}

function setup(query: string) {
    return renderHook((props: { query: string }) => useGlobalSearch(props.query), { initialProps: { query } });
}

describe('useGlobalSearch', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        request.mockReset();
    });
    afterEach(() => vi.useRealTimers());

    it('does not ask the server under two characters or for spaces', async () => {
        const { rerender } = setup('k');
        await wait(SearchDelayMs * 2);
        rerender({ query: '   ' });
        await wait(SearchDelayMs * 2);

        expect(request).not.toHaveBeenCalled();
    });

    it('waits for a pause in typing, then asks once with the trimmed term', async () => {
        request.mockResolvedValue({ results: [kraken] } as never);
        const { rerender, result } = setup('kr');
        rerender({ query: 'kra' });
        rerender({ query: ' kraken ' });

        await wait(SearchDelayMs - 1);
        expect(request).not.toHaveBeenCalled();

        await wait(1);
        expect(request).toHaveBeenCalledTimes(1);
        expect(String((request.mock.calls[0][0] as { url: string }).url)).toContain('q=kraken');
        expect(result.current.results).toEqual([kraken]);
        expect(result.current.term).toBe('kraken');
        expect(result.current.loading).toBe(false);
    });

    it('drops the answer to an older term', async () => {
        let resolveFirst: (value: unknown) => void = () => {};
        request.mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)) as never);
        request.mockResolvedValueOnce({ results: [] } as never);
        const { rerender, result } = setup('kraken');
        await wait(SearchDelayMs);

        rerender({ query: 'atlas' });
        await wait(SearchDelayMs);
        await act(async () => resolveFirst({ results: [kraken] }));

        expect(result.current.results).toEqual([]);
        expect(result.current.term).toBe('atlas');
    });

    it('empties the results when the field is cleared', async () => {
        request.mockResolvedValue({ results: [kraken] } as never);
        const { rerender, result } = setup('kraken');
        await wait(SearchDelayMs);

        rerender({ query: '' });
        await wait(0);

        expect(result.current.results).toEqual([]);
        expect(result.current.loading).toBe(false);
    });

    it('reports a failure without throwing and keeps no stale result', async () => {
        request.mockRejectedValue(new Error('offline'));
        const { result } = setup('kraken');
        await wait(SearchDelayMs);

        expect(result.current.failed).toBe(true);
        expect(result.current.results).toEqual([]);
    });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- use-global-search`
Expected: FAIL, module not found.

- [ ] **Step 3: The hook**

```ts
import { useEffect, useRef, useState } from 'react';
import SearchResultsController from '@/actions/App/Http/Controllers/SearchResultsController';
import { retroRequest } from '@/lib/retro/api';

export type SearchResultKind = 'retro' | 'poker' | 'whiteboard' | 'game' | 'action' | 'card';

export type SearchResult = {
    kind: SearchResultKind;
    id: string;
    title: string;
    team: { id: string; name: string };
    url: string;
};

export const SearchDelayMs = 150;
export const SearchMinLength = 2;

type Found = { results: SearchResult[]; term: string };

const Nothing: Found = { results: [], term: '' };

/**
 * Content search of the palette. Requests wait for a pause in typing and an
 * answer to an older term is dropped.
 */
export function useGlobalSearch(
    query: string,
    delayMs: number = SearchDelayMs,
): Found & { loading: boolean; failed: boolean } {
    const [found, setFound] = useState<Found>(Nothing);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const latestRequest = useRef(0);
    const term = query.trim();

    useEffect(() => {
        if (term.length < SearchMinLength) {
            const reset = setTimeout(() => {
                setFound(Nothing);
                setLoading(false);
                setFailed(false);
            }, 0);

            return () => {
                clearTimeout(reset);
                latestRequest.current++;
            };
        }

        const timer = setTimeout(() => {
            const request = ++latestRequest.current;

            setLoading(true);

            retroRequest<{ results: SearchResult[] }>(
                SearchResultsController.index({ query: { q: term } }),
            )
                .then((response) => {
                    if (request !== latestRequest.current) {
                        return;
                    }

                    setFound({ results: response.results, term });
                    setFailed(false);
                    setLoading(false);
                })
                .catch(() => {
                    if (request !== latestRequest.current) {
                        return;
                    }

                    setFound({ results: [], term });
                    setFailed(true);
                    setLoading(false);
                });
        }, delayMs);

        return () => {
            clearTimeout(timer);
            latestRequest.current++;
        };
    }, [term, delayMs]);

    return { ...found, loading, failed };
}
```

- [ ] **Step 4: The palette learns a results group, reports its query, and uses `useShortcut`**

In `resources/js/components/ui/command.tsx`:

1. `group: "actions" | "recent" | "results" | "goto"`; `const paletteGroups = ["actions", "recent", "results", "goto"] as const`; `headings` gains `results: t("Results")`.
2. `CommandPaletteProps` gains `onSearchChange?: (value: string) => void`; the palette calls it from a `useEffect` on `search` (so closing, which empties `search`, also reports `''`).
3. Replace the body of `useCommandPaletteShortcut` with two `useShortcut` calls and delete `isEditingTarget`:

```ts
function useCommandPaletteShortcut(
  open: boolean,
  onOpenChange: (open: boolean) => void
): void {
  useShortcut("mod+k", () => onOpenChange(!open), {
    enableOnFormTags: true,
    enableInOverlays: true,
  })
  useShortcut("/", () => onOpenChange(true), { enabled: !open })
}
```

(Superseded by Step 6b, after the mockup rule of 2026-10-02: `⌘K` does **not** open the palette from a field being edited.) `⌘K` keeps working inside fields and overlays as today (`command.test.tsx` holds that behaviour; the README's "except in a field being edited" is recorded as a deviation in the report). `/` no longer opens the palette when another dialog or menu is open: `useShortcut` ignores a key pressed in an overlay that is not its own, which removes the collision with the `/` of the shortcuts dialog and of the template picker. Add to `command.test.tsx`:

```tsx
it('does not open on "/" while another dialog is open', () => {
    const onOpenChange = vi.fn();
    render(<CommandPalette open={false} onOpenChange={onOpenChange} items={[]} />);
    const dialog = document.createElement('div');
    const button = document.createElement('button');
    dialog.setAttribute('role', 'dialog');
    dialog.append(button);
    document.body.append(dialog);

    fireEvent.keyDown(button, { key: '/' });

    expect(onOpenChange).not.toHaveBeenCalled();
    dialog.remove();
});

it('reports what is typed and an empty query when it closes', () => {
    const onSearchChange = vi.fn();
    const { rerender } = render(<CommandPalette open onOpenChange={() => {}} items={[]} onSearchChange={onSearchChange} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'kraken' } });
    expect(onSearchChange).toHaveBeenLastCalledWith('kraken');

    rerender(<CommandPalette open={false} onOpenChange={() => {}} items={[]} onSearchChange={onSearchChange} />);
    expect(onSearchChange).toHaveBeenLastCalledWith('');
});

it('shows a results group', () => {
    render(<CommandPalette open onOpenChange={() => {}} items={[{ id: 'r1', group: 'results', label: 'Kraken retro', icon: Search, onSelect: () => {} }]} />);

    expect(screen.getByText('Results')).toBeInTheDocument();
});
```

(`Search` from `lucide-react`.) The palette filters its items by label and keywords: a server result that matched on a poker task title would be hidden, so the container gives every server result `keywords: [term]`.

- [ ] **Step 5: The container**

```tsx
import { router } from '@inertiajs/react';
import {
    Gamepad2,
    ListChecks,
    PenLine,
    Search,
    Spade,
    StickyNote,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CommandPalette } from '@/components/ui/command';
import type { CommandPaletteItem } from '@/components/ui/command';
import { Kbd } from '@/components/ui/kbd';
import { useGlobalSearch } from '@/hooks/use-global-search';
import type { SearchResult, SearchResultKind } from '@/hooks/use-global-search';
import { useTrans } from '@/hooks/use-trans';

export const openCommandMenuEvent = 'skrum:open-command-menu';

const KindIcons: Record<SearchResultKind, LucideIcon> = {
    retro: StickyNote,
    poker: Spade,
    whiteboard: PenLine,
    game: Gamepad2,
    action: ListChecks,
};

export function resultItems(
    results: SearchResult[],
    term: string,
): CommandPaletteItem[] {
    return results.map((result) => ({
        id: `${result.kind}-${result.id}`,
        group: 'results',
        label: result.title,
        icon: KindIcons[result.kind],
        meta: result.team.name,
        keywords: [term],
        onSelect: () => router.visit(result.url),
    }));
}

export function CommandMenu({ goto }: { goto: CommandPaletteItem[] }) {
    const { t } = useTrans();
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const search = useGlobalSearch(isOpen ? query : '');

    useEffect(() => {
        const open = () => setIsOpen(true);

        window.addEventListener(openCommandMenuEvent, open);

        return () => window.removeEventListener(openCommandMenuEvent, open);
    }, []);

    return (
        <>
            <Button
                type="button"
                variant="outline"
                className="hidden w-56 justify-start gap-2 text-muted-foreground md:inline-flex"
                onClick={() => setIsOpen(true)}
                data-test="command-menu-button"
            >
                <Search aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-left">
                    {t('Search or run a command...')}
                </span>
                <Kbd>⌘K</Kbd>
            </Button>
            <CommandPalette
                open={isOpen}
                onOpenChange={setIsOpen}
                onSearchChange={setQuery}
                items={[...resultItems(search.results, search.term), ...goto]}
                loading={search.loading}
                emptyText={
                    search.failed
                        ? t('Search is unavailable. Try again in a moment.')
                        : undefined
                }
            />
        </>
    );
}
```

Icons follow `docs/design-system/sections/03-iconographie.md`: replace any of the five above that the section maps differently. `Kbd` is `@/components/ui/kbd`; if its export name differs, use the one in the file.

`resources/js/components/workspaces/command-menu.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { resultItems } from '@/components/workspaces/command-menu';

const visit = vi.fn();

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    router: { visit: (...args: unknown[]) => visit(...args) },
}));

describe('resultItems', () => {
    it('maps a server result to a palette item that always passes the local filter', () => {
        const [item] = resultItems(
            [{ kind: 'poker', id: 'g1', title: 'Sprint 12', team: { id: 't1', name: 'Atlas' }, url: '/poker/g1' }],
            'kraken',
        );

        expect(item).toMatchObject({ id: 'poker-g1', group: 'results', label: 'Sprint 12', meta: 'Atlas', keywords: ['kraken'] });

        item.onSelect();
        expect(visit).toHaveBeenCalledWith('/poker/g1');
    });

    it('gives two results of different kinds with the same id different item ids', () => {
        const items = resultItems(
            [
                { kind: 'retro', id: 'x', title: 'A', team: { id: 't', name: 'T' }, url: '/a' },
                { kind: 'action', id: 'x', title: 'B', team: { id: 't', name: 'T' }, url: '/b' },
            ],
            'ab',
        );

        expect(new Set(items.map((item) => item.id)).size).toBe(2);
    });
});
```

- [ ] **Step 6: Mount it**

`resources/js/layouts/skrum/app-layout.tsx`: `search={<CommandMenu goto={gotoItems} />}` on `AppTopbar`, where `gotoItems` is built in the layout from the links `useSidebarModel` already returns (Dashboard, Sessions, Actions, Mood & ROTI, Games, Members, Templates, All teams, Team settings, Administration when present, plus Profile, Security, Notifications settings): one `CommandPaletteItem` per link with `group: 'goto'`, its sidebar label, its sidebar icon and `onSelect: () => router.visit(href)`. No link is invented: an entry the sidebar model does not have is not in the palette. The `actions` and `recent` groups are filled in the next step.

- [ ] **Step 6b: The groups "Actions" and "Recent sessions", and the keys of the mockup**

`Command/preview.html` draws three groups — "Actions", "Sessions récentes", "Aller à" — a shortcut or a meta on the right of each item, the match in bold, and the footer "↑ ↓ naviguer · ↵ ouvrir · Esc fermer · n résultats". The README adds: at most five items per group before "See more", `⌘K` everywhere **except in a field being edited** (with `/` as the alternative), a "Live" badge on a session in progress, placed first.

Tests first, in `command-menu.test.tsx` and in a new `resources/js/hooks/use-recent-sessions.test.ts`:

1. `useRecentSessions(open)` fetches `RecentSessionsController.index` once when the palette first opens (not on page load), gives `{ sessions, loading, failed }`, and refetches on a later opening only after 30 seconds.
2. With an empty query the palette shows "Actions" then "Recent sessions" then "Go to", in that order (the mockup's empty state); with a query, "Results" comes between "Recent sessions" and "Go to", and items of the three static groups are filtered by label and keywords.
3. "Actions" holds, for a user with a current team: `New retrospective`, `New poker session`, each opening the "New session" dialog of the current team with that type selected; for a user who may invite to the current workspace, `Invite to :workspace` (visits the members page); for everyone, `Show keyboard shortcuts` (dispatches the event Task 21 listens to). Without a current team the two first are absent. No destructive action is in the palette.
4. "Recent sessions" holds one item per session: label = title, icon by kind (the `KindIcons` of the results), meta = `:team · :date` for a retro and `:kind · :date` for the other kinds (the mockup's "Atlas · il y a 2 j", "Whiteboard · 9 sept."), the date relative under seven days and short otherwise, formatted with `Intl` in the page's locale; a live session is first and carries the badge `Live`.
5. "Go to" items show their key sequence on the right when they have one: `G` `A` for Action items, `G` `S` for the instance settings (admins), as the mockup; the sequence works outside the palette (next test).
6. `useShortcutSequence(['g', 'a'], handler)`: `g` then `a` within one second calls the handler once; `g`, a pause of more than a second, then `a` does not; neither key in a field; nothing while the single-key switch of Task 25 is off; `g` alone still reaches a `useShortcut('g', …)` of the page (the sequence does not swallow the first key).
7. `mod+k` does not open the palette while a field is being edited, and `/` does not either; from the document body both open it; `mod+k` closes it from its own search field (the palette's field is the palette's own layer).
8. The footer shows the three key hints and the number of results, announced in `aria-live="polite"`.

Build:

- `resources/js/hooks/use-recent-sessions.ts` — `useRecentSessions(open: boolean): { sessions: RecentSession[]; loading: boolean; failed: boolean }` with `RecentSession` as Task 15 defines it, fetched with `retroRequest`.
- `resources/js/hooks/use-shortcut-sequence.ts` — two `keydown` steps on the document with the guards of `useShortcut` (`isEditableTarget`, `overlaysOfEvent`, `defaultPrevented`, `isComposing`), a one-second window, `singleKeyShortcutsEnabled()` of Task 25 (the import exists once Task 25 has run: until then the guard is a constant `true`, replaced there).
- `useCommandPaletteShortcut` of Step 4 loses `enableOnFormTags: true` on `mod+k`, and keeps `enableInOverlays: true` so that the key closes the palette from its own field: the sentence of Step 4 "`⌘K` keeps working inside fields" is withdrawn — the README says the opposite, and the mockup rule wins. The palette's own search field is exempt by scope (`scope` = the palette's root ref), not by the form-tag option.
- "New retrospective" and "New poker session" use the entry point plan 18e built for B30 ("Use" on a template opens the "New session" dialog of the current team with a selection): read `resources/js/components/sessions/` as 18e left it and call the same function or visit the same URL with the type instead of the template. What 18e must expose: one way to open that dialog from another page with a session type preselected. If 18e exposes only the template form of it, add the `type` parameter beside it, with its test, in this step.
- `gotoItems` gains `shortcut: ['G', 'A']` and `['G', 'S']` on the two entries; `AppLayout` registers the two sequences with `useShortcutSequence` and `router.visit`. They are listed in the General section of `lib/shortcuts/sections.ts` (Task 21) as `Go to action items` and `Go to the instance settings` — the README asks that sequences appear in the keyboard help.
- The two shortcuts the mockup shows beside the first two actions, `⌘N` and `⌘P`, are not built (Deviations V18).

- [ ] **Step 7: Run**

Run: `npm run test -- use-global-search command-menu command`, `npm run types:check`, `npm run check`, `npm run build:front`, `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: PASS (new keys: `Results` → fr `Résultats`; `Search is unavailable. Try again in a moment.` → fr `La recherche est indisponible. Réessayez dans un instant.`).

- [ ] **Step 8: Commit**

```bash
git add resources/js lang
git commit -m "feat(search): command palette in the topbar with debounced content search"
```

### Task 21: Global shortcuts and the keyboard shortcuts dialog

**Files:**
- Create: `resources/js/lib/shortcuts/sections.ts`, `resources/js/lib/shortcuts/sections.test.ts`, `resources/js/hooks/use-global-shortcuts.ts`, `resources/js/hooks/use-global-shortcuts.test.tsx`
- Modify: `resources/js/layouts/skrum/app-layout.tsx`, `resources/js/layouts/skrum/session-layout.tsx` (mount the dialog), `resources/js/pages/dev/sections/keyboard-shortcuts.tsx:26-142` (reads the shared sections)
- Test: the two Vitest files

**Interfaces:**
- Consumes: `KeyboardShortcuts`, `ShortcutSection`, `ShortcutSectionId` of `@/components/skrum/keyboard-shortcuts`; `useShortcut`; `openCommandMenuEvent` (Task 20).
- Produces: `shortcutSections(t: (key: string) => string): ShortcutSection[]` — only shortcuts that have a handler; `contextOfPage(component: string): ShortcutSectionId | undefined`; `useGlobalShortcuts(): { open: boolean; setOpen(open: boolean): void; context: ShortcutSectionId | undefined }`.

- [ ] **Step 1: Establish what is wired** (the list is data for the next step, and goes in the report)

Run:

```bash
grep -rnE "useShortcut\(|addEventListener\(['\"]keydown|onKeyDown=" resources/js --include=*.ts --include=*.tsx | grep -v "\.test\." | grep -v "pages/dev/"
```

For each hit, note the key, the screen and whether it is a document listener or an element handler. A shortcut enters `sections.ts` only if this list has its handler. From the reading of 2026-10-02 (before 18e): General `⌘K`, `/`, `?` (after this task), `⌘B`; Retro `N`, `Enter`, `Delete`, `V`, `T`, `+`, arrows of the facilitator bar; Poker `0–9`, `R`, `N`, `⌘Enter`; Reactions `1–6`; ROTI `1–5`; health check and survey digits. `G`, `F`, `C`, `⇧R`, `⌘→` have no handler yet: Task 25 builds and lists them (spec B35). In this task the grep decides what is listed.

- [ ] **Step 2: Write the failing tests**

`resources/js/lib/shortcuts/sections.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { contextOfPage, shortcutSections } from '@/lib/shortcuts/sections';

const t = (key: string) => key;

describe('shortcutSections', () => {
    it('always starts with the general section and its four shortcuts', () => {
        const [general] = shortcutSections(t);

        expect(general.id).toBe('general');
        expect(general.items.map((item) => item.id)).toEqual(['palette', 'search', 'shortcuts', 'sidebar']);
    });

    it('lists no shortcut twice inside a section', () => {
        for (const section of shortcutSections(t)) {
            const signatures = section.items.map((item) => item.keys.join('+'));

            expect(new Set(signatures).size).toBe(signatures.length);
        }
    });

    it('does not list the shortcuts that have no handler', () => {
        const ids = shortcutSections(t).flatMap((section) => section.items.map((item) => `${section.id}.${item.id}`));

        expect(ids).not.toContain('retro.group');
        expect(ids).not.toContain('retro.focus');
        expect(ids).not.toContain('retro.next');
    });
});

describe('contextOfPage', () => {
    it('maps a session page to its section', () => {
        expect(contextOfPage('retros/show')).toBe('retro');
        expect(contextOfPage('poker/show')).toBe('poker');
        expect(contextOfPage('whiteboards/show')).toBe('whiteboard');
    });

    it('has no context elsewhere', () => {
        expect(contextOfPage('teams/show')).toBeUndefined();
        expect(contextOfPage('settings/profile')).toBeUndefined();
    });
});
```

This test holds only until Task 25, which replaces it with the test that the five shortcuts of B35 are listed. It is written here so that the list of this task never shows a key that does nothing.

`resources/js/hooks/use-global-shortcuts.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useGlobalShortcuts } from '@/hooks/use-global-shortcuts';

let component = 'teams/show';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ component, props: {} }),
}));

function Probe() {
    const shortcuts = useGlobalShortcuts();

    return (
        <div>
            <output data-testid="state">{`${shortcuts.open}|${shortcuts.context ?? 'none'}`}</output>
            <input aria-label="field" />
            <div data-testid="canvas" className="excalidraw" tabIndex={0} />
        </div>
    );
}

describe('useGlobalShortcuts', () => {
    it('opens with "?" and with mod+/', () => {
        const { unmount } = render(<Probe />);
        fireEvent.keyDown(document.body, { key: '?', shiftKey: true });
        expect(screen.getByTestId('state')).toHaveTextContent('true|none');
        unmount();

        render(<Probe />);
        fireEvent.keyDown(document.body, { key: '/', metaKey: true });
        expect(screen.getByTestId('state')).toHaveTextContent('true|none');
    });

    it('ignores "?" typed in a field but keeps mod+/ there', () => {
        render(<Probe />);

        fireEvent.keyDown(screen.getByLabelText('field'), { key: '?', shiftKey: true });
        expect(screen.getByTestId('state')).toHaveTextContent('false');

        fireEvent.keyDown(screen.getByLabelText('field'), { key: '/', ctrlKey: true });
        expect(screen.getByTestId('state')).toHaveTextContent('true');
    });

    it('ignores "?" during text composition, on key repeat, and inside the whiteboard canvas', () => {
        render(<Probe />);

        fireEvent.keyDown(document.body, { key: '?', shiftKey: true, isComposing: true });
        fireEvent.keyDown(document.body, { key: '?', shiftKey: true, repeat: true });
        fireEvent.keyDown(screen.getByTestId('canvas'), { key: '?', shiftKey: true });

        expect(screen.getByTestId('state')).toHaveTextContent('false');
    });

    it('opens with "?" on a layout where it needs AltGr or no shift', () => {
        render(<Probe />);

        fireEvent.keyDown(document.body, { key: '?', altKey: true, ctrlKey: true });

        expect(screen.getByTestId('state')).toHaveTextContent('true');
    });

    it('gives the section of the session on screen', () => {
        component = 'poker/show';
        render(<Probe />);

        expect(screen.getByTestId('state')).toHaveTextContent('false|poker');
        component = 'teams/show';
    });
});
```

The AltGr case depends on how `matchesShortcut` treats modifiers for symbol keys (`use-shortcut.ts:85-103`: shift is ignored for symbols; `ctrl` together with `alt` is how browsers report AltGr on Windows). If the test fails, extend `matchesShortcut` so that a symbol combo without `mod` accepts `ctrlKey && altKey` together, with its own case in `use-shortcut.test.tsx`; do not special-case it in this hook.

- [ ] **Step 3: Run them to verify they fail**

Run: `npm run test -- lib/shortcuts use-global-shortcuts`
Expected: FAIL, module not found.

- [ ] **Step 4: The sections**

```ts
import { Armchair, Keyboard, SmilePlus, Spade } from 'lucide-react';
import type {
    ShortcutSection,
    ShortcutSectionId,
} from '@/components/skrum/keyboard-shortcuts';

const Contexts: Record<string, ShortcutSectionId> = {
    'retros/show': 'retro',
    'poker/show': 'poker',
    'whiteboards/show': 'whiteboard',
};

export function contextOfPage(component: string): ShortcutSectionId | undefined {
    return Contexts[component];
}

/**
 * The shortcuts that have a handler in the application. One list feeds the
 * dialog; a shortcut without a handler is not listed.
 */
export function shortcutSections(t: (key: string) => string): ShortcutSection[] {
    return [
        {
            id: 'general',
            title: t('General'),
            icon: Keyboard,
            items: [
                { id: 'palette', label: t('Command palette'), keys: ['mod', 'K'] },
                { id: 'search', label: t('Search'), keys: ['/'] },
                { id: 'shortcuts', label: t('Keyboard shortcuts'), keys: ['?'] },
                { id: 'sidebar', label: t('Toggle the sidebar'), keys: ['mod', 'B'] },
            ],
        },
        {
            id: 'retro',
            title: t('Retrospective'),
            icon: Armchair,
            items: [
                { id: 'new-card', label: t('New card'), keys: ['N'] },
                { id: 'publish', label: t('Publish'), keys: ['Enter'] },
                { id: 'cancel', label: t('Cancel'), keys: ['Escape'] },
                { id: 'vote', label: t('Vote for the selected card'), keys: ['V'] },
                { id: 'timer', label: t('Start or stop the timer'), keys: ['T'], facilitatorOnly: true },
            ],
        },
        {
            id: 'poker',
            title: t('Planning poker'),
            icon: Spade,
            items: [
                { id: 'pick', label: t('Pick a card'), keys: ['0'], range: ['0', '9'] },
                { id: 'reveal', label: t('Reveal the votes'), keys: ['R'], facilitatorOnly: true },
                { id: 'next', label: t('Next task'), keys: ['N'], facilitatorOnly: true },
                { id: 'accept', label: t('Save the estimate'), keys: ['mod', 'Enter'], facilitatorOnly: true },
            ],
        },
        {
            id: 'reactions',
            title: t('Reactions'),
            icon: SmilePlus,
            items: [
                { id: 'react', label: t('Send a reaction'), keys: ['1'], range: ['1', '6'] },
            ],
            note: t('When the ROTI, the health check or a survey is open, the digits answer it instead.'),
        },
    ];
}
```

Adjust the items to the list of Step 1 before committing: remove an item whose handler is gone, add one that 18e wired (labels from `pages/dev/sections/keyboard-shortcuts.tsx:26-142`, which already has the wording of the README). The section ids must be members of `ShortcutSectionId` (`keyboard-shortcuts.tsx:41-47`); the whiteboard has no section here because its shortcuts are Excalidraw's own (ruling 5/29) — if the component has a `whiteboard` section id, add one item-less section with the note `t('The whiteboard uses the shortcuts of its own toolbar.')` only if the component renders a note without items; otherwise leave it out.

- [ ] **Step 5: The hook**

```ts
import { usePage } from '@inertiajs/react';
import { useState } from 'react';
import type { ShortcutSectionId } from '@/components/skrum/keyboard-shortcuts';
import { useShortcut } from '@/hooks/use-shortcut';
import { contextOfPage } from '@/lib/shortcuts/sections';

const whiteboardCanvas = '.excalidraw';

function isInWhiteboard(event: KeyboardEvent): boolean {
    return event.target instanceof Element && event.target.closest(whiteboardCanvas) !== null;
}

/**
 * "?" opens the shortcuts dialog outside fields, the whiteboard canvas and
 * other overlays; mod+/ opens it everywhere, for when "?" is being typed.
 */
export function useGlobalShortcuts(): {
    open: boolean;
    setOpen: (open: boolean) => void;
    context: ShortcutSectionId | undefined;
} {
    const { component } = usePage();
    const [open, setOpen] = useState(false);

    useShortcut(
        '?',
        (event) => {
            if (event.repeat || isInWhiteboard(event)) {
                return;
            }

            setOpen(true);
        },
        { enabled: !open, preventDefault: false },
    );

    useShortcut('mod+/', () => setOpen(true), {
        enabled: !open,
        enableOnFormTags: true,
    });

    return { open, setOpen, context: contextOfPage(component) };
}
```

`README:57` also asks that `?` does not open the dialog while the poker deck has the focus (there `?` is a card). If Step 1 shows the deck handles `?` on its focused element and calls `preventDefault`, `useShortcut` already skips it (`event.defaultPrevented`); if it does not, add `[data-slot="poker-deck"]` to the selector checked by `isInWhiteboard` (renamed `isInOwnKeyArea`) with a test case.

- [ ] **Step 6: Mount the dialog in both layouts**

In `app-layout.tsx` and `session-layout.tsx`:

```tsx
const { t } = useTrans();
const shortcuts = useGlobalShortcuts();
// …
<KeyboardShortcuts
    open={shortcuts.open}
    onOpenChange={shortcuts.setOpen}
    sections={shortcutSections(t)}
    context={shortcuts.context}
    onOpenCommandPalette={() => {
        shortcuts.setOpen(false);
        window.dispatchEvent(new Event(openCommandMenuEvent));
    }}
/>
```

`t` is passed as a value to `shortcutSections`, and every key inside `sections.ts` is a literal `t('…')`, so `TranslationKeysTest` sees them. `SessionLayout` has no palette: there `onOpenCommandPalette` is omitted. The dev page `pages/dev/sections/keyboard-shortcuts.tsx` keeps its full README map (it documents the design system) and gains one line showing the live `shortcutSections(t)` beside it, so the difference between "specified" and "wired" is visible.

- [ ] **Step 7: Rulings of spec §6.5 #21**

Digits: `grep -rn "useShortcut(\[\?['\"]1" resources/js/components` shows where reactions listen. Confirm in the reaction bar's Vitest (18c/18e) that a case exists for "digits do nothing while the ROTI, health check or survey panel is active"; if none exists, add to that test file a case that renders the bar with the prop 18e uses to disable its digit shortcuts and asserts that `fireEvent.keyDown(document.body, { key: '3' })` does not call the reaction callback. Letters: confirm with the grep of Step 1 that no two session types mount on one page. Record both checks, with file and line, in the report.

- [ ] **Step 8: Run**

Run: `npm run test -- lib/shortcuts use-global-shortcuts use-shortcut keyboard-shortcuts command`, `npm run types:check`, `npm run check`, `npm run build:front`, `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add resources/js lang
git commit -m "feat(shortcuts): keyboard shortcuts dialog on ? with the shortcuts that are wired"
```

### Task 22: Forced SSO — Admin › Sign-in, the login page and the invitation page

**Read first:** `docs/design-system/components/ScreenAuth/README.md` and `preview.html` ("un admin self-host peut … forcer le SSO seul (le formulaire e-mail disparaît)"); `resources/js/pages/admin/admins.tsx` and `components/admin/admin-shell.tsx` (the page this one mirrors); the login page and the invitation card as plan 18e left them.

**Files:**
- Create: `resources/js/components/admin/sign-in-settings-form.tsx`, `resources/js/components/admin/sign-in-settings-form.test.tsx`, `resources/js/components/auth/admin-sign-in-disclosure.tsx`, `resources/js/components/admin/sign-in-alert.tsx`, each with its `.test.tsx`
- Modify: `resources/js/pages/admin/sign-in.tsx` (Task 10 left it minimal), `resources/js/components/admin/admin-shell.tsx` (third entry), `resources/js/layouts/skrum/app-layout.tsx` (the alert), `resources/js/pages/auth/login.tsx`, `resources/js/pages/invitations/show.tsx` or the `invitation-card.tsx` of 18e, `resources/js/pages/dev/sections/` (one section: the form in its four states)
- Test: the Vitest file; `resources/js/pages/auth/login.test.tsx` and the invitation card's Vitest file gain the cases below

**Interfaces:**
- Consumes: page props of Task 10 (`ssoRequired`, `inForce`, `providers`, `blockers`, `accountsWithoutSso`, `adminsWithPasswordWayBack`), `SignInSettingsController.update` (Wayfinder), the shared prop `signInAlert`, login props `ssoRequired`, `canUseMagicLink`, `canRegister`, `canResetPassword`, invitation props `ssoRequired`, `canRegister`, `ssoProviders` (Task 11).
- Produces: `AdminSection` becomes `'branding' | 'signIn' | 'admins'`; `<SignInSettingsForm ssoRequired inForce providers blockers accountsWithoutSso adminsWithPasswordWayBack />`; `<AdminSignInDisclosure>` (the folded password form of the login page); `<SignInAlert />` (the admins' banner of R2).

- [ ] **Step 1: Write the failing tests**

`sign-in-settings-form.test.tsx` (mock `router.put` as `magic-link-request.test.tsx` mocks `router.post`):

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignInSettingsForm } from '@/components/admin/sign-in-settings-form';

const put = vi.fn();

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    router: { put: (...args: unknown[]) => put(...args) },
    usePage: () => ({ props: { locale: 'en', translations: {} } }),
}));

const google = [{ key: 'google', label: 'Google' }];

describe('SignInSettingsForm', () => {
    beforeEach(() => put.mockReset());

    it('saves the switch with the explicit Save button, never on toggle', () => {
        render(<SignInSettingsForm ssoRequired={false} inForce={false} providers={google} blockers={[]} accountsWithoutSso={0} adminsWithPasswordWayBack={1} />);

        fireEvent.click(screen.getByRole('switch', { name: 'Require single sign-on' }));
        expect(put).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(put.mock.calls[0][1]).toEqual({ sso_required: true });
    });

    it('explains what stands in the way and keeps the switch off', () => {
        const { rerender } = render(
            <SignInSettingsForm ssoRequired={false} inForce={false} providers={[]} blockers={['no_provider']} accountsWithoutSso={0} adminsWithPasswordWayBack={1} />,
        );

        expect(screen.getByRole('switch', { name: 'Require single sign-on' })).toBeDisabled();
        expect(screen.getByText('Configure a single sign-on provider before requiring it.')).toBeInTheDocument();

        rerender(<SignInSettingsForm ssoRequired={false} inForce={false} providers={google} blockers={['no_identity']} accountsWithoutSso={0} adminsWithPasswordWayBack={1} />);

        expect(screen.getByRole('switch', { name: 'Require single sign-on' })).toBeDisabled();
        expect(screen.getByText('Sign in once with single sign-on yourself before requiring it for everyone.')).toBeInTheDocument();
    });

    it('can always be turned off', () => {
        render(<SignInSettingsForm ssoRequired inForce={false} providers={[]} blockers={['no_provider']} accountsWithoutSso={0} adminsWithPasswordWayBack={1} />);

        expect(screen.getByRole('switch', { name: 'Require single sign-on' })).toBeEnabled();
        expect(screen.getByRole('status')).toHaveTextContent('The setting is stored but not in force: no single sign-on provider is configured.');
    });

    it('warns about the accounts that have never used single sign-on', () => {
        render(<SignInSettingsForm ssoRequired={false} inForce={false} providers={google} blockers={[]} accountsWithoutSso={3} adminsWithPasswordWayBack={1} />);

        expect(screen.getByText('3 accounts have never signed in with single sign-on. Each is linked on its first single sign-on if its address matches; otherwise it cannot sign in.')).toBeInTheDocument();
    });

    it('explains the second-factor condition and warns when no admin has the password way back', () => {
        const { rerender } = render(
            <SignInSettingsForm ssoRequired={false} inForce={false} providers={google} blockers={['no_second_factor']} accountsWithoutSso={0} adminsWithPasswordWayBack={0} />,
        );

        expect(screen.getByRole('switch', { name: 'Require single sign-on' })).toBeDisabled();
        expect(screen.getByText('Turn on a second factor for your account before requiring single sign-on: it is what lets an administrator sign in with a password if single sign-on fails.')).toBeInTheDocument();

        rerender(<SignInSettingsForm ssoRequired inForce providers={google} blockers={['no_second_factor']} accountsWithoutSso={0} adminsWithPasswordWayBack={0} />);

        expect(screen.getByRole('alert')).toHaveTextContent('No administrator has a second factor: nobody can sign in with a password if single sign-on fails.');
    });

    it('lists the configured providers', () => {
        render(<SignInSettingsForm ssoRequired={false} inForce={false} providers={google} blockers={[]} accountsWithoutSso={0} adminsWithPasswordWayBack={1} />);

        expect(screen.getByRole('list', { name: 'Single sign-on providers' })).toHaveTextContent('Google');
    });
});
```

`admin-sign-in-disclosure.test.tsx`: the children (the password form) are not in the document at first; the button `Administrator sign-in` has `aria-expanded="false"`; pressing it shows the children, sets `aria-expanded="true"` and moves focus to the first field; the sentence `Administrators can sign in with their password and a second factor.` is visible once open; pressing again folds it.

`sign-in-alert.test.tsx`: with the shared prop `signInAlert: 'sso_required_ignored'` it renders a `role="alert"` with `Single sign-on is required on this instance, but no provider is configured: the setting is ignored and every sign-in method works.` and a link `Sign-in settings` to `admin.signIn.edit`; with `null` it renders nothing.

Login page, added to its Vitest file: with `ssoRequired`, the page renders the SSO buttons first, the sentence `This instance signs in with single sign-on only.`, and the folded `Administrator sign-in`; before it is opened there is no `#email`, no `#password`, no log-in button; there is never a magic-link button nor a register link; once opened, `#email`, `#password`, "Forgot password?" and the log-in button are there, posting to the same route as always. With `ssoRequired` false nothing changes (the existing cases).

Invitation card, added to its Vitest file: with `ssoRequired` and a pending invitation for a guest, the card renders the SSO buttons and neither "Log in" nor "Create an account".

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run test -- sign-in-settings-form admin-sign-in-disclosure sign-in-alert login invitation`
Expected: FAIL, module not found; the two page cases fail on the password field and on "Log in".

- [ ] **Step 3: The form**

`SignInSettingsForm` is a `Card` of the admin area with: the title `Single sign-on`; the list of providers (`role="list"`, `aria-label`), or `No single sign-on provider is configured.`; a `Switch` with `id="sso-required"` and its `Label` `Require single sign-on`, described by `Password, magic link, passkey and registration by form are refused. Only administrators can still sign in with their password, followed by their second factor.`; the blocker sentences (the three of Task 10's request, as literal `t()` keys chosen by the blocker value); the line `:count administrators can sign in with a password and a second factor if single sign-on fails.` (singular key for 1), replaced at zero by a `role="alert"` with `No administrator has a second factor: nobody can sign in with a password if single sign-on fails.`; the `role="status"` line when `ssoRequired && !inForce`; the warning line when `accountsWithoutSso > 0` (`skrum-warning-soft` / `-text`, with a lucide `TriangleAlert`); the server error of `sso_required` under the switch (`InputError` or its 18e equivalent, never a toast); a `Save` button (10-D6: explicit Save), disabled while the request runs. The switch is disabled only when it is off and a blocker exists. State is `useForm({ sso_required: ssoRequired })`, submitted with `SignInSettingsController.update()`. The count sentence is one `t()` call with `:count`, in its singular and plural keys (`1 account has never…`, `:count accounts have never…`).

- [ ] **Step 4: The page and the shell**

`pages/admin/sign-in.tsx` renders `<AdminShell active="signIn">` around the form, with `<Head title={t('Sign-in')} />`. `AdminShell` gains the section `signIn` (label `t('Sign-in')`, route `SignInSettingsController.edit()`), between Branding and Admins. `AdminShell`'s own test gains the third link.

- [ ] **Step 5: The login page, and the alert**

In `pages/auth/login.tsx`, `ssoRequired: boolean` joins `Props`. When it is true the page renders, in the frame 18e built: the title and the SSO buttons first (as the mockup places them), the sentence `This instance signs in with single sign-on only.`, then `<AdminSignInDisclosure>` wrapping the page's own e-mail and password form with "Forgot password?" and the log-in button — the same form, same ids, same route. The separator "or with your e-mail", "Remember me", the magic-link button of Task 17 and the register link are not rendered. The disclosure is offered to every visitor: the page cannot know who is an administrator, and must not (R6). A member who opens it and types the right password gets the answer of a wrong one, from the server. The mockup says the form disappears when SSO is forced; the owner's third-round answer keeps it for administrators (Deviations V24). With no provider the server sends `ssoRequired: false` (R2), so the page is the ordinary login page. The browser suite signs in through `#email` and `#password`: it runs with the setting off, and is untouched.

`<SignInAlert />` reads the shared prop `signInAlert` and is mounted once in `AppLayout`, above the page content, in the library's `Alert` (warning tone, lucide `TriangleAlert`, text and a link, never colour alone). It is rendered for instance admins only because the server sends the prop to them only.

- [ ] **Step 6: The invitation page**

When `ssoRequired`, the logged-out pending state of the invitation card shows the SSO buttons (Task 23) and the sentence `Use the account whose address is :email.`, and neither "Log in" nor "Create an account" (`canRegister` is false from the server; "Log in" is hidden by `ssoRequired`). The other states do not change.

- [ ] **Step 7: Run**

Run: `npm run test -- sign-in-settings-form admin-sign-in-disclosure sign-in-alert admin-shell login invitation`, `npm run types:check`, `npm run check`, `npm run build:front`, `vendor/bin/sail artisan test --compact tests/Feature/Admin tests/Feature/Auth tests/Feature/TranslationKeysTest.php`
Expected: PASS once the new keys are in the four language files (table of Task 26).

- [ ] **Step 8: Commit**

```bash
git add resources/js lang
git commit -m "feat(admin): Sign-in page for required single sign-on, and the login and invitation pages that obey it"
```

### Task 23: SSO buttons on the invitation page — check what 18e built, or build it

Spec B31 gives the buttons to plan 18e (Task 11.5, accept-invitation card). This task makes sure they are there and right, because the security rules of Task 11 are about what these buttons start.

**Files:**
- Modify (only if 18e did not): `resources/js/pages/invitations/show.tsx` or `resources/js/components/access/invitation-card.tsx` (the file 18e Task 11.5 created), and its Vitest file
- Test: the card's Vitest file; `tests/Browser/Walkthroughs/Plan18fCrossCuttingTest.php` (Task 26, `[P18f-09]`)

**Interfaces:**
- Consumes: the SSO buttons component of 18e Task 11.1 (today `resources/js/components/sso-buttons.tsx`, props `providers: {key: string; label: string}[]`); page props `ssoProviders`, `email`, `isExpired`, `isLoggedIn`.
- What plan 18e must leave in place: the prop `ssoProviders` on `invitations/show`; the buttons as plain links to `SsoRedirectsController.show(provider.key)` with no query string; the five states of the card.

- [ ] **Step 1: Read what is there**

```bash
grep -rn "ssoProviders" resources/js/pages/invitations resources/js/components | grep -v "\.test\."
```

Expected: the card (or the page) reads `ssoProviders` and renders the SSO buttons component. If so, go to Step 3. If the command prints nothing, 18e did not build B31: do Step 2.

- [ ] **Step 2: Mount the buttons (only when Step 1 printed nothing)**

In the logged-out, pending state of the card, above the "Log in" / "Create an account" row and separated from it by the same separator the login page uses, render the SSO buttons component with `providers={ssoProviders}` when the list is not empty, followed by the muted line `Use the account whose address is :email.`. Nothing is rendered in the invalid, expired, logged-in-matching and logged-in-other states. The buttons are the login page's buttons: same labels ("Continue with :provider"), same order, same component — no second implementation.

- [ ] **Step 3: The cases the card's Vitest file must hold** (add those that are missing)

1. A guest with a pending invitation and one provider sees one link named "Continue with Google" whose `href` is the path of `sso.redirect` for `google` and contains no `?` and no part of the invitation token.
2. With two providers, two links in the order given.
3. With an empty list, no link and no separator.
4. Expired, invalid, logged-in (both sub-states): no SSO link, whatever `ssoProviders` holds.
5. The address line names the invited address.

- [ ] **Step 4: Run**

Run: `npm run test -- invitation`, `npm run types:check`, `npm run check`, `npm run build:front`, `vendor/bin/sail artisan test --compact tests/Feature/Auth/InvitationSsoTest.php`
Expected: PASS.

- [ ] **Step 5: Commit** (skipped when nothing changed; the report then says "B31 buttons: built by 18e, checked")

```bash
git add resources/js lang
git commit -m "feat(invitations): single sign-on buttons on the invitation page"
```

### Task 24: Settings — recap e-mails and single-key shortcuts

**Read first:** `docs/design-system/components/ScreenUserSettings/README.md` and `preview.html` (Notifications and Appearance sections); the two pages as 18e Task 10.3 left them (`settings/notifications-card.tsx`, `settings/appearance/*`). Controls, labels and placement follow that mockup; where it shows a `Switch`, the control is a `Switch`.

**Files:**
- Create: `resources/js/components/settings/appearance/shortcut-preference-card.tsx`, its `.test.tsx`
- Modify: `resources/js/components/settings/notifications-card.tsx` (or `pages/settings/notifications.tsx` if 18e kept the form in the page) and its test, `resources/js/pages/settings/appearance.tsx`
- Test: the Vitest files; `tests/Browser/Walkthroughs/Plan18fCrossCuttingTest.php` (Task 26)

**Interfaces:**
- Consumes: `preferences.recap_emails` (Task 12), `NotificationPreferencesController.update`; `auth.user.single_key_shortcuts` (Task 13), `ShortcutPreferencesController.update`; `SettingsCard` of 18e Task 10.1.
- Produces: the control `#recap-emails`; `<ShortcutPreferenceCard enabled={boolean} />` with the control `#single-key-shortcuts`.

- [ ] **Step 1: Write the failing tests**

Notifications card, added to its Vitest file:

1. The form shows a third control, `#recap-emails`, labelled `Email me the results of retrospectives`, under its own heading `Retrospective results`, checked from `preferences.recap_emails`.
2. Saving posts the three keys (`action_item_reminders_by_email`, `action_item_reminders_in_app`, `recap_emails`) with the page's one "Save" button (B34: saved with the page's Save).
3. The two existing controls keep their ids `#action-item-reminders-by-email` and `#action-item-reminders-in-app` (browser contract).

`shortcut-preference-card.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ShortcutPreferenceCard } from '@/components/settings/appearance/shortcut-preference-card';

const patch = vi.fn();

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    router: { patch: (...args: unknown[]) => patch(...args) },
    usePage: () => ({ props: { locale: 'en', translations: {} } }),
}));

describe('ShortcutPreferenceCard', () => {
    beforeEach(() => patch.mockReset());

    it('shows the stored preference and saves it with the Save button', () => {
        render(<ShortcutPreferenceCard enabled />);

        const control = screen.getByRole('switch', { name: 'Single-key shortcuts' });

        expect(control).toBeChecked();

        fireEvent.click(control);
        expect(patch).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(patch.mock.calls[0][1]).toEqual({ single_key_shortcuts: false });
    });

    it('says what stays available when they are off', () => {
        render(<ShortcutPreferenceCard enabled={false} />);

        expect(screen.getByText('When off, shortcuts made of a single letter, digit or sign do nothing. Shortcuts with ⌘ or Ctrl, Enter, Escape and the arrows keep working.')).toBeInTheDocument();
    });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run test -- notifications-card shortcut-preference-card`
Expected: FAIL.

- [ ] **Step 3: Build**

- Notifications: the third control in the existing form, same control type as its two neighbours (the browser suite binds them as checkboxes: `#action-item-reminders-by-email`, `#action-item-reminders-in-app`; if the mockup shows switches and 18e changed the three to `Switch`, follow 18e). `form.data` carries the three keys.
- Appearance: a `SettingsCard` titled `Accessibility` (spec B35 and §15 point 12: there is no Accessibility page, the mockup's "Réglages › Accessibilité" entry lives here), holding a `Switch` `id="single-key-shortcuts"` with the `Label` `Single-key shortcuts`, the description of the test above, and a `Save` button (10-D6). `useForm({ single_key_shortcuts: enabled })`, submitted with `ShortcutPreferencesController.update()` and `preserveScroll`. The page passes `enabled={auth.user.single_key_shortcuts}`.

- [ ] **Step 4: Run**

Run: `npm run test -- notifications-card shortcut-preference-card`, `npm run types:check`, `npm run check`, `npm run build:front`, `vendor/bin/sail artisan test --compact tests/Feature/Settings tests/Feature/TranslationKeysTest.php`
Expected: PASS once the new keys are in the four language files (table of Task 26).

- [ ] **Step 5: Commit**

```bash
git add resources/js lang
git commit -m "feat(settings): recap e-mail switch and the accessibility switch for single-key shortcuts"
```

### Task 25: The five shortcuts, their registry and the single-key switch (B35)

Spec B35: the five shortcuts `G`, `F`, `⌘→`, `C`, `⇧R` are built in this plan. Each handler is written here and mounted in the session container plan 18e wrote for that screen (the file named in the table), on a control that already exists there; so are the registry, the preference and the dialog. This task writes the registry, makes every shortcut obey the preference, builds and mounts the five handlers, and lists them in the dialog of Task 21.

| Shortcut | Combo for `useShortcut` | Where, who | Does | Mounted in (container written by 18e) | What the handler calls there |
|---|---|---|---|---|---|
| `G` | `g` | retro, Grouping phase, anyone who may group, on the focused card | starts the keyboard move of the focused card, exactly as pressing Space on its drag handle (`aria-label="Drag to reorder"` family of @dnd-kit) | `components/retro/board-card.tsx` (container of `RetroCard`; grouping drag set up in `columns-board.tsx`, R7) | the drag-handle element of the card, reachable by ref or by `[data-drag-handle]` inside the card |
| `F` | `f` | retro, Discussing and Actions phases, facilitator, on the focused card or topic | toggles the highlight, as the card's "focus" button (`RetroCard` `onFocusToggle`, `data-slot="retro-card-discuss"`) | `components/retro/board-card.tsx`, `phase-discussing.tsx` (R9), the Actions phase container (R10) | the callback passed to `onFocusToggle` |
| `⌘→` / `Ctrl+→` | `mod+arrowright` | retro, facilitator, every phase but Completed | next phase, as the main button of the `FacilitatorBar` / "Next", with the same confirmation dialog when that button has one | `components/retro/board.tsx` or `facilitator-dock.tsx` (R3), where `press('Next')` is wired | the one function that button calls |
| `C` | `c` | poker, a player who may vote, deck containing `☕` (`SpecialCards` of `lib/poker/types.ts`) | plays the coffee card, as clicking it (`aria-label="Play ☕"`) | `components/poker/room-dock.tsx` (3.1a), which gives `PokerDeck` its selection callback | that selection callback |
| `⇧R` | `shift+r` | poker, facilitator, after the reveal | Re-vote, as the "Re-vote" button (`onRevote` of `PokerTable`) | `resources/js/components/skrum/poker-table.tsx:676-683`, beside `mod+enter` and `n` | nothing: `onRevote` is already a prop |

`⌘→` is also "forward" in the history of Chrome and Safari on macOS when no field has the focus: the handler calls `preventDefault` (the default of `useShortcut`), and is never active in a field, where the key moves the caret.

**Files:**
- Create: `resources/js/lib/shortcuts/preference.ts`, `resources/js/lib/shortcuts/preference.test.ts`, `resources/js/hooks/use-single-key-shortcuts.ts`, `resources/js/hooks/use-single-key-shortcuts.test.tsx`
- Modify: `resources/js/hooks/use-shortcut.ts` and its test, `resources/js/components/skrum/retro-card.tsx:366` and its test (the `V` key), `resources/js/components/skrum/poker-table.tsx` and its test (`⇧R`), `resources/js/lib/shortcuts/sections.ts` and its test (Task 21), `resources/js/hooks/use-global-shortcuts.ts` (Task 21), `resources/js/components/skrum/keyboard-shortcuts.tsx` and its test (one line of status, one slot), `resources/js/layouts/skrum/{app-layout,session-layout}.tsx`; the four containers of the table (`board-card.tsx`, `phase-discussing.tsx` and the Actions phase container, `board.tsx` or `facilitator-dock.tsx`, `room-dock.tsx`) and their Vitest files
- Test: the Vitest files; `tests/Browser/Walkthroughs/Plan18fCrossCuttingTest.php` (Task 26, `[P18f-10]` to `[P18f-12]`)

**Interfaces:**
- Produces:
  - `isCharacterKeyCombo(combo: string): boolean`; `setSingleKeyShortcuts(enabled: boolean): void`; `singleKeyShortcutsEnabled(): boolean`
  - `useSingleKeyShortcuts(): [boolean, (enabled: boolean) => void]` — a member: the value of `auth.user.single_key_shortcuts`, saved through `ShortcutPreferencesController.update`; a guest: `useLocalPreference('skrum.single-key-shortcuts', true)`
  - `KeyboardShortcutsProps` gains `singleKeyDisabled?: boolean` and `footerExtra?: ReactNode`

- [ ] **Step 1: Read the mount points**

```bash
grep -rnE "useShortcut\(\s*\[?['\"](g|f|c|shift\+r|mod\+arrowright)['\"]" resources/js --include=*.ts --include=*.tsx | grep -v "\.test\."
grep -rnE "key === '(g|G|f|F|c|C)'" resources/js/components --include=*.tsx | grep -v "\.test\."
```

Expected: nothing — the five handlers are this task's. A line printed means a handler of that key already exists in a container (18e wired something on its own): read it, keep one handler per key, and make it the one of Step 8. Then read each mount point of the table and write in the ledger, for each of the five: the file, the control the shortcut stands for, and the function that control calls. A letter handled by an element `onKeyDown` (not through `useShortcut`) is noted: Step 5 gives it the preference check.

- [ ] **Step 2: Write the failing tests**

`resources/js/lib/shortcuts/preference.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import {
    isCharacterKeyCombo,
    setSingleKeyShortcuts,
    singleKeyShortcutsEnabled,
} from '@/lib/shortcuts/preference';

describe('isCharacterKeyCombo', () => {
    it('is true for a letter, a digit, a sign, and a shifted letter', () => {
        for (const combo of ['g', 'F', '1', '?', '/', '+', 'shift+r']) {
            expect(isCharacterKeyCombo(combo)).toBe(true);
        }
    });

    it('is false with mod or alt, and for named keys', () => {
        for (const combo of ['mod+k', 'mod+arrowright', 'mod+/', 'alt+n', 'enter', 'escape', 'delete', 'arrowleft', 'space', 'shift+enter']) {
            expect(isCharacterKeyCombo(combo)).toBe(false);
        }
    });
});

describe('the single-key switch', () => {
    afterEach(() => setSingleKeyShortcuts(true));

    it('is on until told otherwise', () => {
        expect(singleKeyShortcutsEnabled()).toBe(true);

        setSingleKeyShortcuts(false);

        expect(singleKeyShortcutsEnabled()).toBe(false);
    });
});
```

Added to `use-shortcut.test.tsx`:

```tsx
it('ignores character-key shortcuts while the single-key switch is off and keeps the others', () => {
    const letter = vi.fn();
    const shifted = vi.fn();
    const withMod = vi.fn();
    const named = vi.fn();

    function Probe() {
        useShortcut('g', letter);
        useShortcut('shift+r', shifted);
        useShortcut('mod+arrowright', withMod);
        useShortcut('escape', named);

        return null;
    }

    render(<Probe />);
    setSingleKeyShortcuts(false);

    fireEvent.keyDown(document.body, { key: 'g' });
    fireEvent.keyDown(document.body, { key: 'R', shiftKey: true });
    fireEvent.keyDown(document.body, { key: 'ArrowRight', metaKey: true });
    fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(letter).not.toHaveBeenCalled();
    expect(shifted).not.toHaveBeenCalled();
    expect(withMod).toHaveBeenCalledTimes(1);
    expect(named).toHaveBeenCalledTimes(1);

    setSingleKeyShortcuts(true);
    fireEvent.keyDown(document.body, { key: 'g' });

    expect(letter).toHaveBeenCalledTimes(1);
});
```

Added to `poker-table.test.tsx`: with `onRevote`, facilitator, votes revealed, `fireEvent.keyDown(document.body, { key: 'R', shiftKey: true })` calls `onRevote` once and does not call `onReveal`; before the reveal it calls neither `onRevote`; plain `r` after the reveal does not call `onRevote`; with `shortcuts={false}` nothing fires.

Added to `retro-card.test.tsx`: with the single-key switch off, `v` on the focused card does not call `onVote`, and `Enter` still calls `onEditStart`.

`use-single-key-shortcuts.test.tsx`: a member (`auth.user.single_key_shortcuts: false` in the mocked page props) reads `false` and the module switch is off after the effect; a guest (`auth.user: null`) reads `true`, then `false` after `localStorage` holds `'false'` under `skrum.single-key-shortcuts`; setting it as a guest writes `localStorage` and posts nothing; setting it as a member calls `router.patch` with `{ single_key_shortcuts: false }`.

`sections.test.ts` (Task 21): the test `does not list the shortcuts that have no handler` is replaced by:

```ts
it('lists the five shortcuts of spec B35 in their sections', () => {
    const ids = shortcutSections(t).flatMap((section) => section.items.map((item) => `${section.id}.${item.id}`));

    expect(ids).toEqual(expect.arrayContaining(['retro.group', 'retro.focus', 'retro.next-phase', 'poker.coffee', 'poker.revote']));
});

it('marks the facilitator shortcuts', () => {
    const items = shortcutSections(t).flatMap((section) => section.items);
    const facilitatorOnly = (id: string) => items.find((item) => item.id === id)?.facilitatorOnly === true;

    expect(['focus', 'next-phase', 'revote'].every(facilitatorOnly)).toBe(true);
    expect(facilitatorOnly('group')).toBe(false);
    expect(facilitatorOnly('coffee')).toBe(false);
});
```

`keyboard-shortcuts.test.tsx`: with `singleKeyDisabled`, the dialog shows `Single-key shortcuts are off. Shortcuts with ⌘ or Ctrl still work.` in a `role="status"` element; `footerExtra` is rendered in the footer.

- [ ] **Step 3: Run them to verify they fail**

Run: `npm run test -- lib/shortcuts use-shortcut use-single-key-shortcuts poker-table retro-card keyboard-shortcuts`
Expected: FAIL (module not found, then the new cases).

- [ ] **Step 4: The preference module and the gate in `useShortcut`**

`resources/js/lib/shortcuts/preference.ts`:

```ts
/**
 * WCAG 2.1.4: a shortcut made of one character key must be possible to turn
 * off. The switch lives here, outside React, so that the key handler reads
 * it at the moment a key is pressed. It is only written from an effect
 * (use-single-key-shortcuts), never during render.
 */
let enabled = true;

const namedKeys = new Set([
    'enter',
    'escape',
    'esc',
    'delete',
    'backspace',
    'tab',
    'space',
    'home',
    'end',
    'pageup',
    'pagedown',
    'arrowup',
    'arrowdown',
    'arrowleft',
    'arrowright',
]);

export function setSingleKeyShortcuts(value: boolean): void {
    enabled = value;
}

export function singleKeyShortcutsEnabled(): boolean {
    return enabled;
}

/**
 * A combo whose only key prints a character and that has no mod and no alt.
 * Shift alone still prints a character: shift+r is one.
 */
export function isCharacterKeyCombo(combo: string): boolean {
    const trailingPlus = combo.endsWith('+');
    const parts = (trailingPlus ? combo.slice(0, -1) : combo)
        .split('+')
        .filter((part) => part !== '')
        .map((part) => part.toLowerCase());
    const key = trailingPlus ? '+' : (parts.pop() ?? '');

    if (parts.includes('mod') || parts.includes('alt')) {
        return false;
    }

    return !namedKeys.has(key);
}
```

In `resources/js/hooks/use-shortcut.ts`, `onKeyDown` finds the matching combo instead of testing `some`, and stops when the switch is off and that combo is a character key (import the two functions):

```ts
            const matched = combos.find((entry) => matchesShortcut(event, entry));

            if (matched === undefined) {
                return;
            }

            if (!singleKeyShortcutsEnabled() && isCharacterKeyCombo(matched)) {
                return;
            }
```

Every shortcut registered through `useShortcut` now obeys the preference with no change at its call site: reactions `1–6`, poker digits, `R`, `N`, `/`, `?`, and the five of the table.

- [ ] **Step 5: Element handlers**

`RetroCard.handleArticleKeyDown` handles `V` on the element. Before the `v` branch (`retro-card.tsx:366`):

```ts
        if (!singleKeyShortcutsEnabled()) {
            return;
        }
```

`Enter` and `Delete` above it are named keys and stay. Any element handler of a letter that Step 1 found in a container gets the same guard.

- [ ] **Step 6: The hook that feeds the switch**

`resources/js/hooks/use-single-key-shortcuts.ts`:

```ts
import { router, usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import ShortcutPreferencesController from '@/actions/App/Http/Controllers/Settings/ShortcutPreferencesController';
import { useLocalPreference } from '@/hooks/use-local-preference';
import { setSingleKeyShortcuts } from '@/lib/shortcuts/preference';

type PageUser = { single_key_shortcuts?: boolean } | null | undefined;

/**
 * A member's preference is stored on the account; a guest of a session has
 * no account and keeps it in this browser.
 */
export function useSingleKeyShortcuts(): [boolean, (enabled: boolean) => void] {
    const user = (usePage().props.auth as { user?: PageUser } | undefined)?.user;
    const [local, setLocal] = useLocalPreference('skrum.single-key-shortcuts', true);
    const isMember = user !== null && user !== undefined;
    const enabled = isMember ? user.single_key_shortcuts !== false : local;

    useEffect(() => {
        setSingleKeyShortcuts(enabled);
    }, [enabled]);

    const update = (next: boolean): void => {
        if (!isMember) {
            setLocal(next);

            return;
        }

        router.patch(
            ShortcutPreferencesController.update.url(),
            { single_key_shortcuts: next },
            { preserveScroll: true, preserveState: true },
        );
    };

    return [enabled, update];
}
```

`useGlobalShortcuts` (Task 21) calls it and returns its pair as `singleKey` and `setSingleKey`, so both layouts get the switch with the dialog.

- [ ] **Step 7: The dialog says so, and a guest can change it there**

`KeyboardShortcuts` gains two optional props: `singleKeyDisabled` renders, under the search field, `<p role="status">` with `Single-key shortcuts are off. Shortcuts with ⌘ or Ctrl still work.` (criterion 32: "the help dialog says so"); `footerExtra` renders at the end of the footer. Both layouts pass `singleKeyDisabled={!shortcuts.singleKey}`. `SessionLayout`, where a guest has no settings page, passes as `footerExtra` a `Switch` labelled `Single-key shortcuts` bound to `shortcuts.singleKey` / `shortcuts.setSingleKey`; `AppLayout` passes a link `Keyboard settings` to `appearance.edit`. The switch in the dialog is not in the mockup: it is in the Deviations table (accessibility: a guest must be able to turn the shortcuts off, and has no settings page). With `?` turned off, the dialog stays reachable by `⌘/`, by its entry in the palette and by the keyboard button of the help menu.

- [ ] **Step 8: The five handlers**

`resources/js/components/skrum/poker-table.tsx`, beside the two shortcuts of the facilitator actions (line 676):

```ts
    useShortcut('shift+r', () => onRevote?.(), {
        scope: actionsRef,
        enabled: shortcuts && !!onRevote && !busy,
    });
```

The facilitator actions render only after the reveal, so the shortcut exists only then; `r` (reveal) requires no shift (`matchesShortcut` compares shift for letters), so the two never fire together.

Each of `G`, `F`, `⌘→`, `C` is added at its mount point with `useShortcut` and the combo of the table, calling what the table's last column names, with `enabled` set to the condition of the "Where, who" column, and Vitest cases in the container's test file, written first: the key calls the callback once; it does not in a field; it does not for a non-facilitator (for `F` and `⌘→`); it does not in another phase; it does not when the single-key switch is off (`G`, `F`, `C`), and `⌘→` still does. `G` calls `focus()` on the focused card's drag handle and dispatches the same `Space` keydown @dnd-kit's keyboard sensor listens to; the test asserts the handle receives it. `⌘→` goes through the same function as the "Next" button, confirmation dialog included. Each `FacilitatorAction` that has a shortcut sets `shortcut` (`'⌘→'`), which the bar already shows and announces (`aria-keyshortcuts`).

- [ ] **Step 9: The sections**

`lib/shortcuts/sections.ts` (Task 21) gains, with the labels of `pages/dev/sections/keyboard-shortcuts.tsx` (the wording of the README):

```ts
                { id: 'group', label: t('Group with another card'), keys: ['G'] },
                { id: 'focus', label: t('Focus the selected card'), keys: ['F'], facilitatorOnly: true },
                { id: 'next-phase', label: t('Next phase'), keys: ['mod', '→'], facilitatorOnly: true },
```

in the retro section, and in the poker section:

```ts
                { id: 'coffee', label: t('Coffee break'), keys: ['C'] },
                { id: 'revote', label: t('Re-vote'), keys: ['shift', 'R'], facilitatorOnly: true },
```

The dialog then lists every shortcut of the KeyboardShortcuts README for the General, Retro, Poker and Reactions sections. The Whiteboard section of the README lists Excalidraw-style keys; the application uses Excalidraw's own keys (rulings 5 and 29): the section lists the keys Excalidraw really answers to, read from its help dialog at execution, under the labels of the README where the key is the same.

- [ ] **Step 10: Run**

Run: `npm run test -- lib/shortcuts use-shortcut use-single-key-shortcuts use-global-shortcuts poker-table retro-card keyboard-shortcuts`, the Vitest files of any container touched in Step 8, `npm run types:check`, `npm run check`, `npm run build:front`, `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add resources/js lang
git commit -m "feat(shortcuts): G, F, C, ⇧R and ⌘→ in the sessions, and a switch that turns single-key shortcuts off"
```

### Task 26: Translations, visual captures compared with the mockups, browser walkthrough

**Files:**
- Modify: `lang/en.json`, `lang/fr.json`, `lang/es.json`, `lang/de.json`
- Create: `tests/Browser/Visual/CrossCuttingVisualTest.php`, `tests/Browser/Walkthroughs/Plan18fCrossCuttingTest.php`, captures under `tests/visual/__screenshots__/`

**Interfaces:**
- Consumes: `captureVisuals(string $name, string $path, ?callable $visit)` and `signIn(User $user, string $to)` of `tests/Browser/Support`; the preview route `dev.mail.show`; every screen of Tasks 17–21.

- [ ] **Step 1: Translations**

Every key this plan introduces, with its three translations. In `lang/en.json` the value is the key. Each task adds its keys in its own commit (so that `TranslationKeysTest` passes at every task); this step checks that the four files hold exactly this table. A key marked † is written by the task named and removed by Task 14, which replaces it with the copy of the mockup: it is in the four files between those two commits and in none at the end. French uses "vous", "e-mail", and a space before `?`, `:` and `!`; Spanish uses "usted"; German uses "Sie". The French of a sentence that a mockup shows in French is the mockup's sentence.

| Key (the English value) | fr | es | de | Task |
|---|---|---|---|---|
| `You do not know :inviter? Ignore this e-mail.` † | `Vous ne connaissez pas :inviter ? Ignorez cet e-mail.` | `¿No conoce a :inviter? Ignore este correo.` | `Sie kennen :inviter nicht? Ignorieren Sie diese E-Mail.` | 2 |
| `Unsubscribe from reminders` | `Se désabonner des rappels` | `Darse de baja de los recordatorios` | `Erinnerungen abbestellen` | 3 |
| `Reminder e-mails` | `E-mails de rappel` | `Correos de recordatorio` | `Erinnerungs-E-Mails` | 3 |
| `Stop the action item reminders sent by e-mail?` | `Arrêter les rappels d'actions envoyés par e-mail ?` | `¿Dejar de recibir por correo los recordatorios de acciones?` | `Erinnerungen an Maßnahmen per E-Mail beenden?` | 3 |
| `You no longer receive action item reminders by e-mail.` | `Vous ne recevez plus les rappels d'actions par e-mail.` | `Ya no recibe por correo los recordatorios de acciones.` | `Sie erhalten keine Erinnerungen an Maßnahmen mehr per E-Mail.` | 3 |
| `Unsubscribe` | `Se désabonner` | `Darse de baja` | `Abbestellen` | 3 |
| `You receive this e-mail because you took part in this retrospective or belong to its team.` † | `Vous recevez cet e-mail parce que vous avez participé à cette rétrospective ou faites partie de son équipe.` | `Recibe este correo porque participó en esta retrospectiva o pertenece a su equipo.` | `Sie erhalten diese E-Mail, weil Sie an dieser Retrospektive teilgenommen haben oder zu ihrem Team gehören.` | 4 |
| `Your sign-in link for :app` | `Votre lien de connexion à :app` | `Su enlace de inicio de sesión en :app` | `Ihr Anmeldelink für :app` | 6 |
| `Sign in to :app` | `Connectez-vous à :app` | `Inicie sesión en :app` | `Bei :app anmelden` | 6 |
| `Use the button to sign in as` † | `Utilisez le bouton pour vous connecter en tant que` | `Use el botón para iniciar sesión como` | `Melden Sie sich über die Schaltfläche an als` | 6 |
| `The link works once and expires in :minutes minutes.` | `Le lien ne fonctionne qu'une fois et expire dans :minutes minutes.` | `El enlace funciona una sola vez y caduca en :minutes minutos.` | `Der Link funktioniert einmal und läuft in :minutes Minuten ab.` | 6 |
| `Sign in` | `Se connecter` | `Iniciar sesión` | `Anmelden` | 6 |
| `Or paste this link in your browser:` † | `Ou collez ce lien dans votre navigateur :` | `O pegue este enlace en su navegador:` | `Oder fügen Sie diesen Link in Ihren Browser ein:` | 6 |
| `You did not ask for this? Ignore this e-mail: nobody can sign in without the link.` † | `Vous n'avez rien demandé ? Ignorez cet e-mail : personne ne peut se connecter sans ce lien.` | `¿No lo ha pedido? Ignore este correo: nadie puede iniciar sesión sin el enlace.` | `Sie haben das nicht angefordert? Ignorieren Sie diese E-Mail: Ohne den Link kann sich niemand anmelden.` | 6 |
| `This sign-in link is no longer valid. Request a new one.` | `Ce lien de connexion n'est plus valide. Demandez-en un nouveau.` | `Este enlace de inicio de sesión ya no es válido. Solicite uno nuevo.` | `Dieser Anmeldelink ist nicht mehr gültig. Fordern Sie einen neuen an.` | 6 |
| `Too many attempts. Wait a minute and try again.` | `Trop de tentatives. Patientez une minute puis réessayez.` | `Demasiados intentos. Espere un minuto y vuelva a intentarlo.` | `Zu viele Versuche. Warten Sie eine Minute und versuchen Sie es erneut.` | 6 |
| `This link no longer works` | `Ce lien ne fonctionne plus` | `Este enlace ya no funciona` | `Dieser Link funktioniert nicht mehr` | 6 |
| `You are about to sign in as :email.` | `Vous allez vous connecter en tant que :email.` | `Va a iniciar sesión como :email.` | `Sie melden sich gleich als :email an.` | 6 |
| `It has expired or was already used. Request a new one from the log in page.` | `Il a expiré ou a déjà été utilisé. Demandez-en un nouveau depuis la page de connexion.` | `Ha caducado o ya se ha usado. Solicite uno nuevo desde la página de inicio de sesión.` | `Er ist abgelaufen oder wurde bereits verwendet. Fordern Sie auf der Anmeldeseite einen neuen an.` | 6 |
| `Back to log in` | `Retour à la connexion` | `Volver al inicio de sesión` | `Zurück zur Anmeldung` | 6 |
| `:code is your :app verification code` † | `:code est votre code de vérification :app` | `:code es su código de verificación de :app` | `:code ist Ihr Bestätigungscode für :app` | 7 |
| `Your verification code` | `Votre code de vérification` | `Su código de verificación` | `Ihr Bestätigungscode` | 7 |
| `Enter this code to continue.` | `Saisissez ce code pour continuer.` | `Introduzca este código para continuar.` | `Geben Sie diesen Code ein, um fortzufahren.` | 7 |
| `It expires in :minutes minutes.` | `Il expire dans :minutes minutes.` | `Caduca en :minutes minutos.` | `Er läuft in :minutes Minuten ab.` | 7 |
| `Requested from :device.` † | `Demandé depuis :device.` | `Solicitado desde :device.` | `Angefordert von :device.` | 7 |
| `Not you? Someone knows your password.` † | `Ce n'est pas vous ? Quelqu'un connaît votre mot de passe.` | `¿No ha sido usted? Alguien conoce su contraseña.` | `Das waren nicht Sie? Jemand kennt Ihr Passwort.` | 7 |
| `Change your password` † | `Changez votre mot de passe` | `Cambie su contraseña` | `Ändern Sie Ihr Passwort` | 7 |
| `The code is wrong or has expired.` | `Le code est incorrect ou a expiré.` | `El código es incorrecto o ha caducado.` | `Der Code ist falsch oder abgelaufen.` | 7 |
| `E-mail code turned on.` | `Code par e-mail activé.` | `Código por correo activado.` | `E-Mail-Code eingeschaltet.` | 7 |
| `E-mail code turned off.` | `Code par e-mail désactivé.` | `Código por correo desactivado.` | `E-Mail-Code ausgeschaltet.` | 7 |
| `This instance requires single sign-on.` | `Cette instance impose l'authentification unique.` | `Esta instancia exige el inicio de sesión único.` | `Diese Instanz verlangt Single Sign-on.` | 10 |
| `An account already uses this email address and could not be matched to your single sign-on identity. Ask an administrator of this instance.` | `Un compte utilise déjà cette adresse e-mail et n'a pas pu être rattaché à votre identité d'authentification unique. Adressez-vous à un administrateur de cette instance.` | `Una cuenta ya usa esta dirección de correo y no se ha podido vincular a su identidad de inicio de sesión único. Consulte a un administrador de esta instancia.` | `Ein Konto verwendet diese E-Mail-Adresse bereits und konnte Ihrer Single-Sign-on-Identität nicht zugeordnet werden. Wenden Sie sich an einen Administrator dieser Instanz.` | 10 |
| `Configure a single sign-on provider before requiring it.` | `Configurez un fournisseur d'authentification unique avant de l'imposer.` | `Configure un proveedor de inicio de sesión único antes de exigirlo.` | `Richten Sie einen Single-Sign-on-Anbieter ein, bevor Sie ihn vorschreiben.` | 10 |
| `Sign in once with single sign-on yourself before requiring it for everyone.` | `Connectez-vous d'abord vous-même une fois par authentification unique avant de l'imposer à tout le monde.` | `Inicie sesión usted mismo una vez con el inicio de sesión único antes de exigirlo a todos.` | `Melden Sie sich zuerst selbst einmal per Single Sign-on an, bevor Sie es für alle vorschreiben.` | 10 |
| `Sign-in settings saved.` | `Paramètres de connexion enregistrés.` | `Ajustes de inicio de sesión guardados.` | `Anmeldeeinstellungen gespeichert.` | 10 |
| `Sign-in` | `Connexion` | `Inicio de sesión` | `Anmeldung` | 10 |
| `Single sign-on is required.` | `L'authentification unique est obligatoire.` | `El inicio de sesión único es obligatorio.` | `Single Sign-on ist vorgeschrieben.` | 10 |
| `Single sign-on is optional.` | `L'authentification unique est facultative.` | `El inicio de sesión único es opcional.` | `Single Sign-on ist freiwillig.` | 10 |
| `Unsubscribe from recaps` | `Se désabonner des récapitulatifs` | `Darse de baja de los resúmenes` | `Zusammenfassungen abbestellen` | 12 |
| `Recap e-mails` | `E-mails de récapitulatif` | `Correos de resumen` | `Zusammenfassungs-E-Mails` | 12 |
| `Stop the results of retrospectives sent by e-mail?` | `Arrêter l'envoi des résultats de rétrospective par e-mail ?` | `¿Dejar de recibir por correo los resultados de las retrospectivas?` | `Ergebnisse von Retrospektiven per E-Mail beenden?` | 12 |
| `You no longer receive the results of retrospectives by e-mail.` | `Vous ne recevez plus les résultats de rétrospective par e-mail.` | `Ya no recibe por correo los resultados de las retrospectivas.` | `Sie erhalten keine Ergebnisse von Retrospektiven mehr per E-Mail.` | 12 |
| `Keyboard settings saved.` | `Paramètres du clavier enregistrés.` | `Ajustes del teclado guardados.` | `Tastatureinstellungen gespeichert.` | 13 |
| `You get this email because you have an account on this instance.` | `Vous recevez cet e-mail car vous avez un compte sur cette instance.` | `Recibe este correo porque tiene una cuenta en esta instancia.` | `Sie erhalten diese E-Mail, weil Sie ein Konto auf dieser Instanz haben.` | 14 |
| `Valid for :minutes minutes, works once.` | `Valable :minutes minutes, utilisable une fois.` | `Válido durante :minutes minutos, de un solo uso.` | `:minutes Minuten gültig, einmal verwendbar.` | 14 |
| `Use the button below to sign in as` | `Utilisez le bouton ci-dessous pour vous connecter en tant que` | `Use el botón de abajo para iniciar sesión como` | `Melden Sie sich über die Schaltfläche unten an als` | 14 |
| `Button not working? Paste this link into your browser:` | `Le bouton ne fonctionne pas ? Collez ce lien dans votre navigateur :` | `¿El botón no funciona? Pegue este enlace en su navegador:` | `Die Schaltfläche funktioniert nicht? Fügen Sie diesen Link in Ihren Browser ein:` | 14 |
| `Didn't ask for this? Ignore this email — nobody can sign in without the link.` | `Vous n'avez rien demandé ? Ignorez cet e-mail : personne ne peut se connecter sans ce lien.` | `¿No lo ha pedido? Ignore este correo: nadie puede iniciar sesión sin el enlace.` | `Nicht angefordert? Ignorieren Sie diese E-Mail – ohne den Link kann sich niemand anmelden.` | 14 |
| `:inviter invited you to join :workspace` | `:inviter vous invite à rejoindre :workspace` | `:inviter le invita a unirse a :workspace` | `:inviter lädt Sie ein, :workspace beizutreten` | 14 |
| `:inviter invited you to join the :workspace workspace` | `:inviter vous invite à rejoindre l'espace :workspace` | `:inviter le invita a unirse al espacio :workspace` | `:inviter lädt Sie in den Arbeitsbereich :workspace ein` | 14 |
| `{1} :count team\|[2,*] :count teams` | `{1} :count équipe\|[2,*] :count équipes` | `{1} :count equipo\|[2,*] :count equipos` | `{1} :count Team\|[2,*] :count Teams` | 14 |
| `{1} :count member\|[2,*] :count members` | `{1} :count membre\|[2,*] :count membres` | `{1} :count miembro\|[2,*] :count miembros` | `{1} :count Mitglied\|[2,*] :count Mitglieder` | 14 |
| `:workspace runs its retros, planning poker and icebreakers on :app.` | `:workspace fait ses rétros, son planning poker et ses icebreakers sur :app.` | `:workspace hace sus retros, su planning poker y sus rompehielos en :app.` | `:workspace macht seine Retros, sein Planning Poker und seine Icebreaker mit :app.` | 14 |
| `Join with your company SSO or create an account in a minute.` | `Rejoignez-le avec le SSO de votre entreprise ou créez un compte en une minute.` | `Únase con el SSO de su empresa o cree una cuenta en un minuto.` | `Treten Sie mit dem SSO Ihres Unternehmens bei oder erstellen Sie in einer Minute ein Konto.` | 14 |
| `Join with your company SSO.` | `Rejoignez-le avec le SSO de votre entreprise.` | `Únase con el SSO de su empresa.` | `Treten Sie mit dem SSO Ihres Unternehmens bei.` | 14 |
| `Create an account in a minute.` | `Créez un compte en une minute.` | `Cree una cuenta en un minuto.` | `Erstellen Sie in einer Minute ein Konto.` | 14 |
| `The invitation is valid for :days days. Don't know :inviter? Just ignore this email.` | `L'invitation est valable :days jours. Vous ne connaissez pas :inviter ? Ignorez simplement cet e-mail.` | `La invitación es válida durante :days días. ¿No conoce a :inviter? Simplemente ignore este correo.` | `Die Einladung ist :days Tage gültig. Sie kennen :inviter nicht? Ignorieren Sie diese E-Mail einfach.` | 14 |
| `Agreed by your team in retro. Mark them done, change the due date, or hand them over.` | `Décidées par votre équipe en rétro. Marquez-les terminées, changez l'échéance ou confiez-les à quelqu'un.` | `Acordadas por su equipo en la retro. Márquelas como hechas, cambie la fecha límite o páselas a otra persona.` | `Von Ihrem Team in der Retro vereinbart. Erledigen Sie sie, ändern Sie die Frist oder geben Sie sie ab.` | 14 |
| `:team · due :date · :late` | `:team · échéance :date · :late` | `:team · vence el :date · :late` | `:team · fällig am :date · :late` | 14 |
| `:team · due :date` | `:team · échéance :date` | `:team · vence el :date` | `:team · fällig am :date` | 14 |
| `{1} :count day late\|[2,*] :count days late` | `{1} :count jour de retard\|[2,*] :count jours de retard` | `{1} :count día de retraso\|[2,*] :count días de retraso` | `{1} :count Tag überfällig\|[2,*] :count Tage überfällig` | 14 |
| `Open my action items` | `Ouvrir mes actions` | `Abrir mis acciones` | `Meine Maßnahmen öffnen` | 14 |
| `You get this reminder because action items are assigned to you.` | `Vous recevez ce rappel car des actions vous sont assignées.` | `Recibe este recordatorio porque tiene acciones asignadas.` | `Sie erhalten diese Erinnerung, weil Ihnen Maßnahmen zugewiesen sind.` | 14 |
| `Manage notifications` | `Gérer mes notifications` | `Gestionar mis notificaciones` | `Benachrichtigungen verwalten` | 14 |
| `:title · :team — :actions, ROTI :roti` | `:title · :team — :actions, ROTI :roti` | `:title · :team — :actions, ROTI :roti` | `:title · :team — :actions, ROTI :roti` | 14 |
| `:title · :team — :actions` | `:title · :team — :actions` | `:title · :team — :actions` | `:title · :team — :actions` | 14 |
| `{0} no action\|{1} :count action\|[2,*] :count actions` | `{0} aucune action\|{1} :count action\|[2,*] :count actions` | `{0} ninguna acción\|{1} :count acción\|[2,*] :count acciones` | `{0} keine Maßnahme\|{1} :count Maßnahme\|[2,*] :count Maßnahmen` | 14 |
| `:participants participants, :cards cards, facilitated by :name.` | `:participants participants, :cards cartes, facilitée par :name.` | `:participants participantes, :cards tarjetas, facilitada por :name.` | `:participants Teilnehmende, :cards Karten, moderiert von :name.` | 14 |
| `:participants participants, :cards cards.` | `:participants participants, :cards cartes.` | `:participants participantes, :cards tarjetas.` | `:participants Teilnehmende, :cards Karten.` | 14 |
| `:title is done` | `:title est terminée` | `:title ha terminado` | `:title ist abgeschlossen` | 14 |
| `Facilitated by :name on :date. Here is what the team decided.` | `Facilitée par :name le :date. Voici ce que l'équipe a décidé.` | `Facilitada por :name el :date. Esto es lo que ha decidido el equipo.` | `Moderiert von :name am :date. Das hat das Team beschlossen.` | 14 |
| `Completed on :date. Here is what the team decided.` | `Terminée le :date. Voici ce que l'équipe a décidé.` | `Terminada el :date. Esto es lo que ha decidido el equipo.` | `Abgeschlossen am :date. Das hat das Team beschlossen.` | 14 |
| `ROTI /5` | `ROTI /5` | `ROTI /5` | `ROTI /5` | 14 |
| `:name · due :date` | `:name · échéance :date` | `:name · vence el :date` | `:name · fällig am :date` | 14 |
| `Unassigned · due :date` | `Non assignée · échéance :date` | `Sin asignar · vence el :date` | `Nicht zugewiesen · fällig am :date` | 14 |
| `Return on time invested · :count votes` | `Retour sur le temps investi · :count votes` | `Retorno del tiempo invertido · :count votos` | `Ertrag der investierten Zeit · :count Stimmen` | 14 |
| `Open the full summary` | `Ouvrir le compte rendu complet` | `Abrir el resumen completo` | `Vollständige Zusammenfassung öffnen` | 14 |
| `You get this summary because you took part in this retro or belong to its team.` | `Vous recevez ce récapitulatif car vous avez participé à cette rétro ou faites partie de son équipe.` | `Recibe este resumen porque participó en esta retro o pertenece a su equipo.` | `Sie erhalten diese Zusammenfassung, weil Sie an dieser Retro teilgenommen haben oder zu ihrem Team gehören.` | 14 |
| `Your :app verification code: :code` | `Votre code de vérification :app : :code` | `Su código de verificación de :app: :code` | `Ihr Bestätigungscode für :app: :code` | 14 |
| `Requested from :device · :time` | `Demandé depuis :device · :time` | `Solicitado desde :device · :time` | `Angefordert von :device · :time` | 14 |
| `Requested on :time` | `Demandé le :time` | `Solicitado el :time` | `Angefordert am :time` | 14 |
| `:browser on :system` | `:browser sur :system` | `:browser en :system` | `:browser unter :system` | 14 |
| `Not you? Someone has your password:` | `Ce n'est pas vous ? Quelqu'un connaît votre mot de passe :` | `¿No ha sido usted? Alguien tiene su contraseña:` | `Das waren nicht Sie? Jemand hat Ihr Passwort:` | 14 |
| `change it now` | `changez-le maintenant` | `cámbiela ahora` | `ändern Sie es jetzt` | 14 |
| `They can't sign in without this code.` | `Sans ce code, il ne peut pas se connecter.` | `Sin este código no puede iniciar sesión.` | `Ohne diesen Code ist keine Anmeldung möglich.` | 14 |
| `Logo for e-mails` | `Logo pour les e-mails` | `Logotipo para los correos` | `Logo für E-Mails` | 14 |
| `PNG or JPEG, at least 128 px wide. Mail clients do not draw SVG.` | `PNG ou JPEG, 128 px de large au minimum. Les messageries n'affichent pas le SVG.` | `PNG o JPEG, de al menos 128 px de ancho. Los clientes de correo no muestran SVG.` | `PNG oder JPEG, mindestens 128 px breit. E-Mail-Programme stellen kein SVG dar.` | 14 |
| `E-mails show the name as text until a PNG or JPEG logo is added.` | `Les e-mails affichent le nom en texte tant qu'aucun logo PNG ou JPEG n'est ajouté.` | `Los correos muestran el nombre como texto hasta que se añada un logotipo PNG o JPEG.` | `E-Mails zeigen den Namen als Text, bis ein PNG- oder JPEG-Logo hinzugefügt wird.` | 14 |
| `E-mail me a magic link instead` | `Recevoir un lien magique à la place` | `Recibir un enlace mágico en su lugar` | `Stattdessen einen magischen Link erhalten` | 17 |
| `Enter your e-mail address first.` | `Saisissez d'abord votre adresse e-mail.` | `Introduzca primero su dirección de correo.` | `Geben Sie zuerst Ihre E-Mail-Adresse ein.` | 17 |
| `Check your inbox` | `Vérifiez votre boîte mail` | `Revise su bandeja de entrada` | `Prüfen Sie Ihren Posteingang` | 17 |
| `If an account exists for :email, a sign-in link is on its way. It is valid for 15 minutes and works once.` | `Si un compte existe pour :email, un lien de connexion est en route. Il est valable 15 minutes et ne fonctionne qu'une fois.` | `Si existe una cuenta para :email, un enlace de inicio de sesión está en camino. Es válido durante 15 minutos y funciona una sola vez.` | `Wenn für :email ein Konto besteht, ist ein Anmeldelink unterwegs. Er ist 15 Minuten gültig und funktioniert einmal.` | 17 |
| `Resend in :time` | `Renvoyer dans :time` | `Reenviar en :time` | `Erneut senden in :time` | 17 |
| `Resend the link` | `Renvoyer le lien` | `Reenviar el enlace` | `Link erneut senden` | 17 |
| `Nothing received? Check your spam folder. On a self-hosted instance, sending depends on the SMTP your admin configured.` | `Rien reçu ? Vérifiez les indésirables. Sur une instance auto-hébergée, l'envoi dépend du SMTP configuré par votre admin.` | `¿No ha recibido nada? Revise el correo no deseado. En una instancia autoalojada, el envío depende del SMTP configurado por su administrador.` | `Nichts erhalten? Prüfen Sie den Spam-Ordner. Auf einer selbst gehosteten Instanz hängt der Versand vom SMTP ab, das Ihr Admin eingerichtet hat.` | 17 |
| `Use another address` | `Utiliser une autre adresse` | `Usar otra dirección` | `Andere Adresse verwenden` | 17 |
| `Enter the 6-digit code sent to :address.` | `Saisissez le code à 6 chiffres envoyé à :address.` | `Introduzca el código de 6 dígitos enviado a :address.` | `Geben Sie den 6-stelligen Code ein, der an :address gesendet wurde.` | 18 |
| `E-mail is not available on this instance, so no code can be sent. Contact your administrator.` | `L'e-mail n'est pas disponible sur cette instance : aucun code ne peut être envoyé. Contactez votre administrateur.` | `El correo no está disponible en esta instancia, así que no se puede enviar ningún código. Contacte con su administrador.` | `E-Mail ist auf dieser Instanz nicht verfügbar, daher kann kein Code gesendet werden. Wenden Sie sich an Ihren Administrator.` | 18 |
| `E-mail code` | `Code par e-mail` | `Código por correo` | `E-Mail-Code` | 18 |
| `Enter the code we sent to your mailbox.` | `Saisissez le code que nous avons envoyé dans votre boîte mail.` | `Introduzca el código que hemos enviado a su buzón.` | `Geben Sie den Code ein, den wir an Ihr Postfach gesendet haben.` | 18 |
| `Code by e-mail` | `Code par e-mail` | `Código por correo` | `Code per E-Mail` | 18 |
| `Receive a 6-digit code at :address each time you sign in.` | `Recevez un code à 6 chiffres à :address à chaque connexion.` | `Reciba un código de 6 dígitos en :address cada vez que inicie sesión.` | `Erhalten Sie bei jeder Anmeldung einen 6-stelligen Code an :address.` | 18 |
| `A sign-in link followed by an e-mail code proves the same mailbox twice. An authenticator app or a passkey protects better.` | `Un lien de connexion suivi d'un code par e-mail prouve deux fois la même boîte mail. Une application d'authentification ou une clé d'accès protège mieux.` | `Un enlace de inicio de sesión seguido de un código por correo demuestra dos veces el mismo buzón. Una aplicación de autenticación o una llave de acceso protege mejor.` | `Ein Anmeldelink gefolgt von einem E-Mail-Code beweist zweimal dasselbe Postfach. Eine Authentifizierungs-App oder ein Passkey schützt besser.` | 18 |
| `This factor has no recovery codes: if you lose access to your mailbox, you lose access to your account.` | `Ce facteur n'a pas de codes de récupération : si vous perdez l'accès à votre boîte mail, vous perdez l'accès à votre compte.` | `Este factor no tiene códigos de recuperación: si pierde el acceso a su buzón, pierde el acceso a su cuenta.` | `Dieser Faktor hat keine Wiederherstellungscodes: Wenn Sie den Zugriff auf Ihr Postfach verlieren, verlieren Sie den Zugriff auf Ihr Konto.` | 18 |
| `The e-mail code is on.` | `Le code par e-mail est activé.` | `El código por correo está activado.` | `Der E-Mail-Code ist eingeschaltet.` | 18 |
| `Turn off the e-mail code` | `Désactiver le code par e-mail` | `Desactivar el código por correo` | `E-Mail-Code ausschalten` | 18 |
| `Send me a code` | `M'envoyer un code` | `Enviarme un código` | `Code an mich senden` | 18 |
| `Code received by e-mail` | `Code reçu par e-mail` | `Código recibido por correo` | `Per E-Mail erhaltener Code` | 18 |
| `Turn on` | `Activer` | `Activar` | `Einschalten` | 18 |
| `The recap of :title is ready` | `Le récap de :title est disponible` | `El resumen de :title está disponible` | `Die Zusammenfassung von :title ist verfügbar` | 19 |
| `:count action items · ROTI :roti · :when` | `:count actions · ROTI :roti · :when` | `:count acciones · ROTI :roti · :when` | `:count Maßnahmen · ROTI :roti · :when` | 19 |
| `:count action items · :when` | `:count actions · :when` | `:count acciones · :when` | `:count Maßnahmen · :when` | 19 |
| `:name invited you to join :workspace` | `:name vous invite à rejoindre :workspace` | `:name le invita a unirse a :workspace` | `:name lädt Sie ein, :workspace beizutreten` | 19 |
| `View invitation` | `Voir l'invitation` | `Ver la invitación` | `Einladung ansehen` | 19 |
| `New notification` | `Nouvelle notification` | `Nueva notificación` | `Neue Benachrichtigung` | 19 |
| `Search is unavailable. Try again in a moment.` | `La recherche est indisponible. Réessayez dans un instant.` | `La búsqueda no está disponible. Vuelva a intentarlo en un momento.` | `Die Suche ist nicht verfügbar. Versuchen Sie es gleich noch einmal.` | 20 |
| `Invite to :workspace` | `Inviter dans :workspace` | `Invitar a :workspace` | `In :workspace einladen` | 20 |
| `Show keyboard shortcuts` | `Afficher les raccourcis clavier` | `Mostrar los atajos de teclado` | `Tastenkürzel anzeigen` | 20 |
| `Go to action items` | `Aller aux actions` | `Ir a las acciones` | `Zu den Maßnahmen` | 20 |
| `Go to the instance settings` | `Aller aux réglages de l'instance` | `Ir a los ajustes de la instancia` | `Zu den Instanzeinstellungen` | 20 |
| `Start or stop the timer` | `Démarrer ou arrêter le minuteur` | `Iniciar o detener el temporizador` | `Timer starten oder stoppen` | 21 |
| `Reveal the votes` | `Révéler les votes` | `Revelar los votos` | `Stimmen aufdecken` | 21 |
| `Save the estimate` | `Enregistrer l'estimation` | `Guardar la estimación` | `Schätzung speichern` | 21 |
| `When the ROTI, the health check or a survey is open, the digits answer it instead.` | `Quand le ROTI, le bilan de santé ou un sondage est ouvert, les chiffres y répondent à la place.` | `Cuando el ROTI, el chequeo de salud o una encuesta están abiertos, los dígitos responden ahí.` | `Wenn ROTI, Health Check oder eine Umfrage geöffnet ist, beantworten die Ziffern stattdessen diese.` | 21 |
| `The whiteboard uses the shortcuts of its own toolbar.` | `Le tableau blanc utilise les raccourcis de sa propre barre d'outils.` | `La pizarra usa los atajos de su propia barra de herramientas.` | `Das Whiteboard verwendet die Tastenkürzel seiner eigenen Werkzeugleiste.` | 21 |
| `This instance signs in with single sign-on only.` | `Cette instance n'accepte que l'authentification unique.` | `Esta instancia solo admite el inicio de sesión único.` | `Diese Instanz erlaubt nur die Anmeldung per Single Sign-on.` | 22 |
| `Require single sign-on` | `Imposer l'authentification unique` | `Exigir el inicio de sesión único` | `Single Sign-on vorschreiben` | 22 |
| `Password, magic link, passkey and registration by form are refused. Only administrators can still sign in with their password, followed by their second factor.` | `Le mot de passe, le lien magique, la clé d'accès et l'inscription par formulaire sont refusés. Seuls les administrateurs peuvent encore se connecter avec leur mot de passe, suivi de leur second facteur.` | `La contraseña, el enlace mágico, la llave de acceso y el registro por formulario se rechazan. Solo los administradores pueden seguir iniciando sesión con su contraseña, seguida de su segundo factor.` | `Passwort, magischer Link, Passkey und Registrierung per Formular werden abgelehnt. Nur Administratoren können sich weiterhin mit ihrem Passwort und anschließend ihrem zweiten Faktor anmelden.` | 22 |
| `Turn on a second factor for your account before requiring single sign-on: it is what lets an administrator sign in with a password if single sign-on fails.` | `Activez un second facteur sur votre compte avant d'imposer l'authentification unique : c'est ce qui permet à un administrateur de se connecter par mot de passe si l'authentification unique tombe en panne.` | `Active un segundo factor en su cuenta antes de exigir el inicio de sesión único: es lo que permite a un administrador iniciar sesión con contraseña si el inicio de sesión único falla.` | `Schalten Sie einen zweiten Faktor für Ihr Konto ein, bevor Sie Single Sign-on vorschreiben: Damit kann sich ein Administrator mit Passwort anmelden, wenn Single Sign-on ausfällt.` | 10, 22 |
| `1 administrator can sign in with a password and a second factor if single sign-on fails.` | `1 administrateur peut se connecter avec mot de passe et second facteur si l'authentification unique tombe en panne.` | `1 administrador puede iniciar sesión con contraseña y segundo factor si el inicio de sesión único falla.` | `1 Administrator kann sich mit Passwort und zweitem Faktor anmelden, wenn Single Sign-on ausfällt.` | 22 |
| `:count administrators can sign in with a password and a second factor if single sign-on fails.` | `:count administrateurs peuvent se connecter avec mot de passe et second facteur si l'authentification unique tombe en panne.` | `:count administradores pueden iniciar sesión con contraseña y segundo factor si el inicio de sesión único falla.` | `:count Administratoren können sich mit Passwort und zweitem Faktor anmelden, wenn Single Sign-on ausfällt.` | 22 |
| `No administrator has a second factor: nobody can sign in with a password if single sign-on fails.` | `Aucun administrateur n'a de second facteur : personne ne pourra se connecter par mot de passe si l'authentification unique tombe en panne.` | `Ningún administrador tiene segundo factor: nadie podrá iniciar sesión con contraseña si el inicio de sesión único falla.` | `Kein Administrator hat einen zweiten Faktor: Niemand kann sich mit Passwort anmelden, wenn Single Sign-on ausfällt.` | 22 |
| `Administrator sign-in` | `Connexion administrateur` | `Inicio de sesión de administrador` | `Administrator-Anmeldung` | 22 |
| `Administrators can sign in with their password and a second factor.` | `Les administrateurs peuvent se connecter avec leur mot de passe et un second facteur.` | `Los administradores pueden iniciar sesión con su contraseña y un segundo factor.` | `Administratoren können sich mit ihrem Passwort und einem zweiten Faktor anmelden.` | 22 |
| `Single sign-on is required on this instance, but no provider is configured: the setting is ignored and every sign-in method works.` | `L'authentification unique est imposée sur cette instance, mais aucun fournisseur n'est configuré : le réglage est ignoré et tous les modes de connexion fonctionnent.` | `El inicio de sesión único es obligatorio en esta instancia, pero no hay ningún proveedor configurado: el ajuste se ignora y todos los métodos de inicio de sesión funcionan.` | `Single Sign-on ist auf dieser Instanz vorgeschrieben, aber es ist kein Anbieter eingerichtet: Die Einstellung wird ignoriert und alle Anmeldewege funktionieren.` | 22 |
| `Sign-in settings` | `Paramètres de connexion` | `Ajustes de inicio de sesión` | `Anmeldeeinstellungen` | 22 |
| `The setting is stored but not in force: no single sign-on provider is configured.` | `Le réglage est enregistré mais sans effet : aucun fournisseur d'authentification unique n'est configuré.` | `El ajuste está guardado pero no se aplica: no hay ningún proveedor de inicio de sesión único configurado.` | `Die Einstellung ist gespeichert, aber nicht wirksam: Es ist kein Single-Sign-on-Anbieter eingerichtet.` | 22 |
| `No single sign-on provider is configured.` | `Aucun fournisseur d'authentification unique n'est configuré.` | `No hay ningún proveedor de inicio de sesión único configurado.` | `Es ist kein Single-Sign-on-Anbieter eingerichtet.` | 22 |
| `Single sign-on providers` | `Fournisseurs d'authentification unique` | `Proveedores de inicio de sesión único` | `Single-Sign-on-Anbieter` | 22 |
| `1 account has never signed in with single sign-on. It is linked on its first single sign-on if its address matches; otherwise it cannot sign in.` | `1 compte ne s'est jamais connecté par authentification unique. Il sera rattaché à sa première connexion unique si son adresse correspond ; sinon il ne pourra pas se connecter.` | `1 cuenta nunca ha iniciado sesión con el inicio de sesión único. Se vinculará en su primer inicio de sesión único si su dirección coincide; si no, no podrá iniciar sesión.` | `1 Konto hat sich noch nie per Single Sign-on angemeldet. Es wird bei der ersten Single-Sign-on-Anmeldung verknüpft, wenn die Adresse übereinstimmt; sonst kann es sich nicht anmelden.` | 22 |
| `:count accounts have never signed in with single sign-on. Each is linked on its first single sign-on if its address matches; otherwise it cannot sign in.` | `:count comptes ne se sont jamais connectés par authentification unique. Chacun sera rattaché à sa première connexion unique si son adresse correspond ; sinon il ne pourra pas se connecter.` | `:count cuentas nunca han iniciado sesión con el inicio de sesión único. Cada una se vinculará en su primer inicio de sesión único si su dirección coincide; si no, no podrá iniciar sesión.` | `:count Konten haben sich noch nie per Single Sign-on angemeldet. Jedes wird bei der ersten Single-Sign-on-Anmeldung verknüpft, wenn die Adresse übereinstimmt; sonst kann es sich nicht anmelden.` | 22 |
| `Use the account whose address is :email.` | `Utilisez le compte dont l'adresse est :email.` | `Use la cuenta cuya dirección es :email.` | `Verwenden Sie das Konto mit der Adresse :email.` | 22, 23 |
| `Retrospective results` | `Résultats de rétrospective` | `Resultados de retrospectivas` | `Ergebnisse von Retrospektiven` | 24 |
| `Email me the results of retrospectives` | `M'envoyer par e-mail les résultats des rétrospectives` | `Enviarme por correo los resultados de las retrospectivas` | `Ergebnisse von Retrospektiven per E-Mail an mich senden` | 24 |
| `Accessibility` | `Accessibilité` | `Accesibilidad` | `Barrierefreiheit` | 24 |
| `Single-key shortcuts` | `Raccourcis à une touche` | `Atajos de una sola tecla` | `Ein-Tasten-Kürzel` | 24, 25 |
| `When off, shortcuts made of a single letter, digit or sign do nothing. Shortcuts with ⌘ or Ctrl, Enter, Escape and the arrows keep working.` | `Désactivés, les raccourcis faits d'une seule lettre, d'un chiffre ou d'un signe ne font rien. Les raccourcis avec ⌘ ou Ctrl, Entrée, Échap et les flèches continuent de fonctionner.` | `Si están desactivados, los atajos de una sola letra, dígito o signo no hacen nada. Los atajos con ⌘ o Ctrl, Intro, Escape y las flechas siguen funcionando.` | `Ausgeschaltet bewirken Kürzel aus einem einzelnen Buchstaben, einer Ziffer oder einem Zeichen nichts. Kürzel mit ⌘ oder Strg, Eingabe, Escape und die Pfeiltasten funktionieren weiter.` | 24 |
| `Single-key shortcuts are off. Shortcuts with ⌘ or Ctrl still work.` | `Les raccourcis à une touche sont désactivés. Les raccourcis avec ⌘ ou Ctrl fonctionnent toujours.` | `Los atajos de una sola tecla están desactivados. Los atajos con ⌘ o Ctrl siguen funcionando.` | `Ein-Tasten-Kürzel sind ausgeschaltet. Kürzel mit ⌘ oder Strg funktionieren weiter.` | 25 |
| `Keyboard settings` | `Paramètres du clavier` | `Ajustes del teclado` | `Tastatureinstellungen` | 25 |
| `Group with another card` | `Grouper avec une autre carte` | `Agrupar con otra tarjeta` | `Mit einer anderen Karte gruppieren` | 25 |
| `Focus the selected card` | `Mettre la carte sélectionnée en avant` | `Destacar la tarjeta seleccionada` | `Ausgewählte Karte hervorheben` | 25 |

Keys that already exist in the four files and are reused as they are (not in the table): `Powered by Skrüm`, `Recent sessions`, `View the results`, `View my open action items`, `You can turn off these reminders in your notification settings.` (the last three are no longer used by a mail after Task 14; whether they are still used elsewhere, and their removal if not, is plan 18g's key clean-up), `Accept invitation`, `Notification settings`, `Save`, `Log in`, `Email address`, `Continue`, `Single sign-on`, `Administration`, `Participants`, `Cards`, `Actions`, `Action items`, `Unassigned`, `Summary`, `Next phase`, `Re-vote`, `Coffee break`, `Live`, `Results`, `New retrospective`, `New poker session`, `Accept`, `View recap`, `Mark all as read`, and the labels of the shortcut sections of Task 21 that `pages/dev/sections/keyboard-shortcuts.tsx` already spells. Where a library component of 18c already has its own key for a sentence of this table (the bell's sentences of Task 19, the palette's group titles), the component's key is kept and the table's line is not added.

Run: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php`. A key it lists as missing and that is not in the table was added at execution (a label read from a mockup, an 18e component's key): translate it in the three languages, not copied from English, in the register of the neighbouring keys, and add it to the report's list of keys. Check that no key marked † is left:

```bash
node -e '
const gone = ["You do not know :inviter? Ignore this e-mail.", "You receive this e-mail because you took part in this retrospective or belong to its team.", "Use the button to sign in as", "Or paste this link in your browser:", "You did not ask for this? Ignore this e-mail: nobody can sign in without the link.", ":code is your :app verification code", "Requested from :device.", "Not you? Someone knows your password.", "Change your password"];
for (const locale of ["en", "fr", "es", "de"]) {
    const lines = JSON.parse(require("fs").readFileSync(`lang/${locale}.json`, "utf8"));
    for (const key of gone) if (key in lines) console.log(`${locale}: ${key}`);
}'
```

Expected: no output, unless the application spells one of these keys elsewhere (`git grep -nF "<key>" app resources`): then it stays, with the place written in the report.

No fixed width depends on a label (rule 10): check the longest German strings of the new buttons at 390 (`Stattdessen einen magischen Link erhalten`, `Single Sign-on vorschreiben`, `Vollständige Zusammenfassung öffnen`).

- [ ] **Step 2: Visual captures**

```php
<?php

use App\Enums\ActionItemReminderKind;
use App\Enums\RetroPhase;
use App\Models\ActionItem;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;

beforeEach(function () {
    config(['app.name' => 'Skrum', 'mail.default' => 'smtp']);
    RateLimiter::for('login', fn (): Limit => Limit::none());
});

it('renders the five mails without overflow', function (string $mail) {
    $team = Team::factory()->create(['name' => 'Demo Team']);
    $user = teamMember($team);
    ActionItem::factory()->count(3)->withoutRetro($team, $user)->create(['due_on' => '2026-09-26']);
    Retro::factory()->for($team)->inPhase(RetroPhase::Completed)->create(['title' => 'Sprint 42']);

    $this->captureVisuals(
        "mail-{$mail}",
        "/dev/mail/{$mail}",
        fn (string $path, array $options) => visit($path.'?locale='.(str_starts_with($options['locale'], 'fr') ? 'fr' : 'en'), $options),
    );
})->with(['magic-link', 'two-factor-code', 'invitation', 'action-reminder', 'retro-recap']);

it('renders the sign-in screens without overflow', function (string $name, string $path) {
    $this->captureVisuals($name, $path);
})->with([
    ['login-with-magic-link', '/login'],
    ['magic-link-invalid', '/magic-link/'.str_repeat('a', 64)],
]);
```

`captureVisuals` asserts the theme through the application's own script (`AppearanceScript`); a mail page has no such script. If the assertion fails on the mail pages, give `captureVisuals` an optional flag that skips `assertVisualAppearance` for pages outside the application shell, and say so in the report; the dark capture of a mail is then driven by `colorScheme: 'dark'` alone, which is what the mail's media query reads. Add to the same file captures of: the challenge in e-mail mode (sign in a `withEmailSecondFactor` user through `/login`), Security with the card (as `AdminPagesVisualTest.php` does for a confirmed-password page), the open bell, the open palette with results (`fill` the field with a title created by a factory), the shortcuts dialog. Each is compared by eye with its `preview.html`.

Captures added by the owner's answers and the fidelity rule, in the same file: the login page in its "link sent" state and with single sign-on required; Admin › Sign-in in its four states (off, blocked, on, stored but not in force); the invitation page with the SSO buttons; Settings › Notifications and Settings › Appearance with the two new controls; the recap unsubscribe page; the bell with the three kinds, and its empty state; the palette empty (three groups) and with results.

**Comparison with the mockups (the fidelity pass of this plan).** For each line below, the captures (1440 and 390, light and dark, FR) are opened beside the `preview.html` named, and the differences are written in a table `screen | element | mockup | application | fixed in <commit> / deviation V<n>` that goes in the phase report. A difference is fixed in this task, or is already a line of the Deviations table, or — if it fits one of the three allowed reasons — is added to that table in this commit. Anything else stops the task.

| Captures | Mockup |
|---|---|
| the five mails, and the white-label variant (a brand colour and a PNG mail logo set in the test) | `Emails/preview.html`, sections 01–06 |
| login, link sent, single sign-on required | `ScreenAuth/preview.html` |
| challenge in e-mail mode, Security with the e-mail card | `ScreenSecurity/preview.html` (anatomy of the two-factor block; no drawing of these two) |
| bell: states of the bell, popover, empty state, drawer at 390 | `NotificationsPanel/preview.html` |
| palette: empty, filtered, no result | `Command/preview.html` |
| shortcuts dialog: default, filtered, no result | `KeyboardShortcuts/preview.html` |
| Settings › Notifications, Settings › Appearance | `ScreenUserSettings/preview.html` |
| Admin › Sign-in | no mockup: compared with `pages/admin/admins.tsx`, the sibling page whose shell and card it reuses |

- [ ] **Step 3: Browser walkthrough**

`tests/Browser/Walkthroughs/Plan18fCrossCuttingTest.php`, in the style of `Plan18dBrandingTest.php` (ids `[P18f-01]` …), with `config(['mail.default' => 'smtp'])` and `Mail::fake()` where a mail is expected:

1. `[P18f-01]` From `/login`, a member types their address in `#email` and clicks `@magic-link-button`: the card shows "Check your inbox" with the address, and "Resend in" is disabled; "Use another address" brings the form back. The test then builds a link with `resolve(IssueMagicLink::class)->handle($user)`, visits it, sees "You are about to sign in as", clicks `@magic-link-confirm-button`, and lands on the dashboard. Visiting the same link again shows "This link no longer works".
2. `[P18f-02]` A member with `withEmailSecondFactor` signs in with the password, lands on the challenge in e-mail mode, types the code read from the queued `TwoFactorCodeMail`, and lands on the dashboard. A wrong code first shows the error.
3. `[P18f-03]` In Security (after password confirmation), a member clicks "Send me a code", types the code, clicks "Turn on", sees "The e-mail code is on."; then "Turn off the e-mail code".
4. `[P18f-04]` `⌘K` (or `@command-menu-button`) opens the palette; typing two letters of a retro title shows it under "Results" with the team name; Enter opens the retro; a retro of another team never appears.
5. `[P18f-05]` `?` opens "Keyboard shortcuts" on the dashboard; on a poker game the Planning poker section comes first; typing `?` in a text field does not open it; Escape closes it and focus returns to where it was.
6. `[P18f-06]` The bell shows "2 unread notifications", opens the panel, "Mark all as read" brings it back to "Notifications".
7. `[P18f-07]` Logged out, a signed unsubscribe link shows the confirmation page; `@unsubscribe-button` turns the reminders off; the settings page then shows the e-mail reminder switch off.
8. `[P18f-08]` The same with the signed link of the recap: the confirmation page, `@unsubscribe-button`, then Settings › Notifications shows `#recap-emails` off; checking it and pressing "Save" turns it back on.
9. `[P18f-09]` Logged out, the page of a pending invitation shows "Continue with Google" (provider configured in the test, `Socialite::fake`): pressing it, with the provider answering the invited address, lands in the application as a member of the workspace; with another address, on the invitation page saying the account is another one, with nothing joined.
10. `[P18f-10]` With single sign-on required (set through `InstanceSettings`, a provider configured): `/login` shows the provider button, no `@magic-link-button`, and no `#email` until "Administrator sign-in" is pressed. A member who opens it and types the right password sees the wrong-credentials error. An instance admin with an authenticator app types the password, then the code, and lands in the application; opens Admin › Sign-in, turns "Require single sign-on" off, presses "Save", and `/login` shows the ordinary form again. With the setting stored and the provider configuration removed, the admin sees the alert on the dashboard and a member does not.
11. `[P18f-11]` On a retro as facilitator: `⌘→` (`Control+ArrowRight` in the test) moves to the next phase as the "Next" button does; in the Grouping phase `G` on a focused card starts its keyboard move; in Discussing `F` on a focused card highlights it and a second `F` removes the highlight; none of the letters does anything while a card is being edited. As a participant, `⌘→` and `F` do nothing.
12. `[P18f-12]` On a poker game: `C` plays the coffee card when the deck has one; after the reveal `⇧R` starts a re-vote for the facilitator and does nothing for a player.
13. `[P18f-13]` In Settings › Appearance a member turns "Single-key shortcuts" off and saves: on a retro `G`, `V` and `?` do nothing, `⌘→` and `⌘K` still work, and the shortcuts dialog (opened with `⌘/`) says single-key shortcuts are off. A guest in a session turns them off with the switch of the dialog, reloads, and they are still off.
14. `[P18f-14]` The palette, empty: "Actions" with "New retrospective", "Recent sessions" with the retro last opened first, "Go to"; "New retrospective" opens the "New session" dialog on the retrospective type; `G` then `A` from the dashboard opens the action items; `⌘K` typed in a text field does not open the palette.
15. `[P18f-15]` The bell, with one notification of each kind (seeded with the factories of Task 15): the recap line and "View recap"; the invitation line and "View invitation", which opens the invitation page, where "Accept invitation" joins the workspace; an overdue action with its ticket key. A notification created while the page is open raises the count without a reload.

- [ ] **Step 4: Run**

Run: `npm run build:front`, then `vendor/bin/sail artisan test --compact tests/Browser/Visual/CrossCuttingVisualTest.php tests/Browser/Walkthroughs/Plan18fCrossCuttingTest.php tests/Arch`
Expected: PASS; `BrowserTestRulesTest` (arch) accepts the two new files; the comparison table is written, and every line of it ends with a commit or a deviation number.

- [ ] **Step 5: Commit**

```bash
git add lang tests/Browser tests/visual
git commit -m "test: 18f translations, captures compared with the mockups, cross-cutting walkthrough"
```

### Task 27: Verification and phase report

**Files:**
- Create: the phase report, in the place and format of the 18d report

- [ ] **Step 1: Every suite**

```bash
npm run build:front
npm run types:check
npm run check
npm run test
vendor/bin/pint --dirty --format agent
vendor/bin/sail artisan test --parallel --processes=8 --compact
bin/test-browser
```

Expected: all green. Rector as in 18d (`vendor/bin/rector --dry-run`): no change proposed.

- [ ] **Step 2: Rule greps** (spec §13.5 and §5), limited to files changed on this branch:

```bash
git diff --name-only <branch point>..HEAD -- resources/js resources/views | xargs grep -nE "bg-(red|blue|gray|zinc|neutral|slate)-|text-white|-\[[0-9.]+(px|rem)\]|sk-[a-z]" || true
```

Expected: no line outside `resources/views/mail` (mails use hex by rule S26 and are not Tailwind).

- [ ] **Step 3: Acceptance, one by one, with the evidence** (command output or test name) written in the report:

| Spec | Evidence |
|---|---|
| B11 | `SearchTest` (17 tests, card text included); `RecentSessionsTest` |
| B12 | `MagicLinkTest`; every clause of the row mapped to a test: request by e-mail, signed, single use, 15 minutes, hashed, 60 s cooldown, per e-mail and per IP, same response, second factor still asked. "Not offered, and refused by the server, while `sso_required` is in force": `ForcedSsoTest` |
| B13 | `EmailSecondFactorTest`: enable in Security, 6 digits, 10 minutes, hashed, 60 s cooldown, five codes an hour, five attempts, browser and time in the mail and no location, TOTP / recovery / passkeys unchanged |
| B14 | `tests/Feature/Mail/*`: five Mailables, light and dark, `BrandPalette::toHex()`, triggers unchanged, recipients unchanged but for `recap_emails` (`ReminderDigestTest`, `ResultsEmailTest`, `WorkspaceInvitationsTest` green); `MailMockupTest` and the comparison table of Task 26 for "per `components/Emails/README.md`" |
| B31, criterion 28 | `InvitationSsoTest`, the rewritten test of `ResolveSsoUserTest`; the Task 16 record for S30, S31; `[P18f-09]`; and who built the buttons (18e, checked in Task 23, or Task 23). The spec's criterion 28 and §15 point 17 still describe the behaviour before the third round (an unverified address accepted with a matching invitation): say so, the owner's answer wins |
| B33, criterion 30 | `ForcedSsoTest`, `SignInSettingsTest`, `[P18f-10]`; the Task 16 record for S27–S29, rule by rule R1–R16. Where the spec text of B33 still says "refuses password login" for everyone and leaves passkeys alone, the third-round answers win: say so |
| B34, criterion 31 | `RecapUnsubscribeTest`, `NotificationPreferencesTest`, `[P18f-08]` |
| B35, criterion 32 | `ShortcutPreferencesTest`; the Vitest files of Task 25; `[P18f-11]` to `[P18f-13]`; for each of the five shortcuts, the file and line where Task 25 mounted its handler |
| Mockup fidelity (owner's rule) | the comparison table of Task 26; the Deviations table as it stands at the end, each line with its reason; the list of browser tests changed because a mockup imposed it |
| §12 18f | bell (Tasks 15, 19), global shortcuts and `?` (Tasks 21, 25) |
| §13.1, 13.3, 13.4 | captures of Task 26; `bin/test-browser`; the suites of Step 1 |
| §13.13 | every §9 item of this phase has feature tests; B12, B13, B31 and B33 passed Task 16 (record attached) |

- [ ] **Step 4: One whole-branch review with a security lens** (`superpowers:requesting-code-review`), one fix wave, one scoped re-review. The front must not have weakened a rule: the reviewer checks that no page prints the `status` flash raw, that the e-mail code is never posted to Fortify's route, that no token or code is kept in `localStorage`, `sessionStorage` or a URL the client builds; that the login page with single sign-on required is the same for every visitor (the administrator form is folded, never shown or hidden by a guess about who is asking), and takes that state from the server's `ssoRequired` prop; that the SSO links of the invitation page carry no query string; that the only thing kept in `localStorage` by this phase is the guest's `skrum.single-key-shortcuts` boolean.

- [ ] **Step 5: The report**

Sections, in this order:

1. **What is done**, task by task, with the commit of each.
2. **The Task 16 record**, rule by rule (S1–S34, and R1–R16 for `sso_required`).
3. **Owner decisions**: the table at the head of this plan, each line with the task that applied it. D6 is flagged as differing from the research file.
4. **Known limits** (Security rules, last paragraph).
5. **Mockup fidelity**: the comparison table of Task 26; the Deviations table as it stands, each line with its reason; and the list "gaps of the first version of this plan and what became of them":
   - turned into work: the Skrüm logo as PNG and a mail logo for a rebranded instance; the recap with its four stats, action rows and ROTI bars; the invitation mail with the inviter's avatar and the workspace block; the reminder rows with days late and ticket key; the code mail with browser and time; the wording of the five mails; the recap unsubscribe; the "Actions" and "Recent sessions" groups of the palette, its key sequences and `⌘K` staying out of fields; the bell's recap notification and its invitation notification (a link to the invitation page), ticket key, "Load more" and live arrival; the magic-link button and "link sent" state as the mockup draws them; the five shortcuts and the single-key switch;
   - left as deviations: V1 to V24, each with its reason; those marked `roadmap`, with their line of `feature-roadmap.md`.
6. **Browser tests changed**, each with the mockup line that imposes the change.
7. **Parity table** "old bell → new bell" (open, read one, read all, refresh on focus, link to the item).
8. **Translation keys** added at execution beyond the table of Task 26.
9. **What 18g needs**: delete `notification-bell.tsx` and `app-sidebar-header.tsx`; the three mail keys no longer used by a mail (Task 26 Step 1); `ListActionItemNotifications` if `ListNotifications` left it without a caller.

- [ ] **Step 6: Commit**

```bash
git add docs
git commit -m "docs: 18f phase report"
```

No merge into `main`, no push.

---

## Self-review (done while writing; kept for the reader)

**Revised on 2026-10-02** after the owner's answers (two rounds) and the owner's rule on mockup fidelity. Added: Tasks 10–15 and 22–25; card text in Task 9; five codes an hour in Task 7; Task 17 rewritten to the ScreenAuth mockup; steps 5b / 6b in Tasks 18, 19, 20; the translation table and the mockup comparison in Task 26; rules S27–S34; the Deviations table. Old task numbers 10–17 are now 16–21, 26, 27. Totals: **27 tasks** (15 back end, 1 gate, 11 front and closing), **34 security rules** (S33 rewritten, number kept), **16 rules of `sso_required`** (R1–R16), **24 deviations** (8 of them `roadmap`).

**Spec coverage.** B11 → Tasks 9, 15, 20. B12 → Tasks 5, 6, 8, 10 (refused while `sso_required` is in force), 17. B13 → Tasks 5, 7, 8, 18. B14 → Tasks 1–4, 6, 7, 12, 14 (five Mailables; "the three existing notifications keep their triggers": only `toMail`, the recap's recipients and its unsubscribe change). B31 → Tasks 11, 16, 23 (the refusal of an unverified address, the pins and the review here; prop and buttons in 18e, built here if absent). B33 → Tasks 10, 16, 22. B34 → Tasks 12, 24. B35 → Tasks 13, 24, 25 (the five handlers are built here and mounted in the containers 18e wrote). "Their plan includes a security review step before merge" → Task 16 and Task 27 Step 4. "Stated on the Security screen" → Task 18 card. Bell → Tasks 15, 19. Global shortcuts and `?` → Tasks 21, 25. §11 visual captures FR/EN, light/dark, 1440/390 → Task 26. §13.13, criteria 28, 30, 31, 32 → Task 27.

**Every owner answer covered.** First round, "Plan 18f": magic link audience → D2, Task 6; forced SSO → Tasks 10, 22 (third round: R1–R16); e-mail code for everyone → D3; no recovery codes → D4; search titles + card text, current workspace, `ILIKE` → Task 9 Step 5; plain Blade → D13; recap unsubscribe → Tasks 12, 24; shortcuts and the single-letter switch → Tasks 13, 24, 25. 11-D2 → Tasks 11, 23 (third round: unverified address refused). Third round, bell → Task 15, S33; spec §15 point 12 → Task 24; the reading of the fidelity rule (no data → left out, `roadmap`) → Global Constraints and the Deviations table. Second round: lifetimes → D5, Task 7 (cap changed to five an hour); cross-device → D7 (Task 6 as written: no device binding); normal session → D8 (`CompleteLogin` never remembers); code mail with browser and time, no location → Task 14, V1. The fidelity rule → Global Constraints, Deviations table, Tasks 14, 15, 17–20, 26.

**Not fully covered, and said so:**

- Tasks 14, 15 and the steps 5b / 6b of Tasks 18–20 were added by the fidelity rule after the rest of the plan was written. They give files, interfaces, rules, the copy to the letter and every test by name and assertion, but not the full code of each view and container that the other tasks give: the agent that runs them writes the tests from the tables, first, and the code from the mockup beside it.
- **Third round (2026-10-02).** `sso_required` is rewritten to the owner's answers: only SSO signs in; passkeys refused; instance admins keep password plus second factor; ignored with an alert when no provider is enabled — rules R1–R16 in Task 10, S27–S29, D17–D19 answered. Task 11 now changes `ResolveSsoUser` (an unverified address is refused even with a matching invitation). The bell accepts nothing (S33 rewritten, its route withdrawn). The five shortcuts are built here. The spec text of B33, criterion 28, criterion 30 and §15 points 11 and 17 still describes the second round on these points when this plan was revised: the spec is another agent's file; where they differ, the owner's third-round answers are what this plan builds, and Task 27 says so in the report.
- Two safe readings chosen here, each a rule with its test, for the owner to overrule if wanted: an instance admin **without** a second factor has no password way in while SSO is required (R5), and turning the setting on needs an acting admin who has one (R14); the reset link is mailed to instance admins only while every request gets the same answer (R13).
- The mounting points inside pages that plan 18e rewrites (Tasks 17–25 give the units and name the mount point; the surrounding JSX is read at execution). What 18e must expose is listed in Task 20 Step 6b (opening "New session" with a type), Task 23 (the invitation card's prop), Task 25 (the control each of its five handlers stands for).
- Ruling 21 on digits is verified against 18e's code rather than rebuilt (Task 21 Step 7); S2 (passkeys) and the CSRF exemption of the two unsubscribe POSTs are checked by reading and by hand in Task 16, not by an automated test; the realtime arrival of a notification is covered by a feature test on the event and by `[P18f-15]`, not by a two-browser smoke test.
- The code of `bin/render-mail-logo.mjs` and of the new feature tests was not run while writing (no code was touched for this revision). Read on the repository as it is on `plan-18d-branding`: `InstanceSettings`, `InstanceSettingKey`, `BrandingController::destroy` (it clears every key of the enum — the reason for `InstanceSettingKey::branding()`), `SsoCallbacksController`, `ResolveSsoUser`, `SignupGate`, the two invitation controllers, `FortifyServiceProvider`, Fortify's `RedirectIfTwoFactorAuthenticatable`, the passkeys package's `allowsLogin`, `NotificationPreferencesController`, `RetroResultsRecipients`, `BuildRetroRecap`, `ListActionItemNotifications`, `BroadcastAuthorizationsController`, `use-shortcut.ts`, `retro-card.tsx`, `poker-table.tsx`, `resend-code.tsx`, `notifications-panel.tsx`, and the mockups named in the tasks.

**Type consistency.** `SecondFactors::methodsFor` returns `array<int, SecondFactorMethod>` in Tasks 5 and 7 and is consumed as such in `StartSecondFactorChallenge` and the challenge view. `SendEmailTwoFactorCode::handle(User, EmailCodePurpose, ?string): bool` is called with three arguments in `StartSecondFactorChallenge`, `EmailChallengeCodesController`, `EmailSecondFactorCodesController` and the tests. `IssueMagicLink::handle(User): string` and `ConsumeMagicLink::handle(string): ?User` match their callers. `MagicLinkMail(url, email, expiresInMinutes)` has three arguments in the job, the preview and the test. `SignInPolicy` answers five questions — `ssoRequired()`, `isIgnored()`, `allowsLocalCredentials()` (magic link, registration, passkey), `allowsPassword(User)`, `allowsPasswordReset(User)` — asked by Tasks 10, 11 and 14; `StartSecondFactorChallenge::handle` has three parameters in Task 5 and four from Task 10 (`bool $local`); `InstanceSettings::ssoRequired()` is the stored value and is read by `SignInPolicy` and the admin controller only. `RetroResultsMail` keeps its five-argument constructor (Task 4) and gains `unsubscribeVia()` (Task 12); `TwoFactorCodeMail` has three arguments until Task 14 and four after. `SearchWorkspaceContent::handle` has two parameters in Task 9 Step 4 and three from Step 5. The user columns are `recap_emails` and `single_key_shortcuts` everywhere (spec B34, B35), and the instance key is `sso_required`. Route names used by the tests are the ones declared: `admin.signIn.edit`, `admin.signIn.update`, `recapUnsubscribes.show`, `recapUnsubscribes.store`, `shortcutPreferences.update`, `recentSessions.index`, `magicLinks.store`, `magicLinks.show`, `magicLinks.sessions.store`, `twoFactor.emailCodes.store`, `twoFactor.emailChallenges.store`, `emailSecondFactor.codes.store`, `emailSecondFactor.store`, `emailSecondFactor.destroy`, `reminderUnsubscribes.show`, `reminderUnsubscribes.store`, `search.index`, `dev.mail.show`. Front: `useSecondsLeft` returns a tuple in Tasks 17 and 18; `SearchResult` is one type shared by the hook and the container; `openCommandMenuEvent` is exported by Task 20 and imported by Task 21.

**The source-scan test** of Task 5 expects, at the end of Task 8, exactly: `Actions/Auth/RevokeLoginSecrets.php`, `Http/Controllers/Settings/EmailSecondFactorsController.php`, `Http/Controllers/Settings/SecurityController.php`, `Http/Requests/Auth/TwoFactorChallengeRequest.php` (in the order `File::allFiles` returns). `SecurityController` reads the TOTP state through Fortify's method to display it; the three others write or guard, none decides a challenge.
