# Front-end Rewrite — Cross-cutting: magic link, e-mail code, mails, search, bell, shortcuts (Plan 18f) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Back-end tasks 1–9 run in sequence, one agent each, with a review after each. Task 10 is a gate: no front task starts before it is closed. Every agent reads **Owner decisions**, **Global Constraints** and **Security rules** before its task.

**Goal:** A member signs in with a link received by e-mail, can use a 6-digit e-mail code as a second factor, receives the five transactional e-mails in the brand of the instance, finds any session or action from ⌘K, reads notifications from the new bell, and opens the keyboard shortcuts with `?`.

**Architecture:** Every way to sign in (password pipeline of Fortify, SSO callback, magic link) asks one class, `SecondFactors`, whether a challenge is due, and starts it through one action, `StartSecondFactorChallenge`. A magic link is a hashed, single-use row consumed by a POST behind a confirmation page; the request path does the same work for every address and leaves the account lookup to an encrypted queued job. Mails are Blade tables under one layout whose colours come from `BrandPalette::toHex()`; the three existing notifications keep their class, trigger and recipients and only change what `toMail()` returns. Search is one JSON route scoped to the teams the user can view in the current workspace.

**Tech Stack:** Laravel 13.34, PHP 8.4, Fortify 1.40, Socialite 5.31, Inertia Laravel 3.4 / `@inertiajs/react` 3, Pest 5, React 19, Tailwind 4, Vitest (vite-plus), `cmdk` 1.1, PostgreSQL. Versions read with `composer show --direct` and `package.json` on 2026-10-02; re-run `composer show laravel/fortify laravel/framework inertiajs/inertia-laravel` before Task 5 and stop if a major differs.

**Spec:** `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` — row 18f of §12; B11, B12, B13, B14 of §9 and the two paragraphs under the table; §5; §6.3; §6.5 ruling 21; §10; §13 criteria 1, 3, 4, 13. Design: `docs/design-system/components/Emails/README.md`, `Command/README.md`, `KeyboardShortcuts/README.md`, `NotificationsPanel` (component file), `ScreenAuth`, `ScreenSecurity`. Research: `18f-research.md` (scratchpad of the planning session; its findings are folded into this plan, with the corrections listed at the end).

**Not in this plan:** an instance setting for sign-in methods ("forced SSO", D1); geolocation in the code e-mail; a recap e-mail preference (D9); card text and whiteboard element text in search (D11); trigram indexes (D10); MJML (D13); shortcuts that have no handler (D16); deleting the old `notification-bell.tsx` and old layouts (18g).

## Autonomous run

Unattended. Branch `plan-18f-cross-cutting` from the head of the plan 18e branch (the screens `auth/login`, `auth/two-factor-challenge`, `settings/security` and the session screens must already be on the new library). If 18e is not finished, Tasks 1–10 can run from the head of `plan-18d-branding`; Tasks 11–17 wait for 18e. No merge into `main`, no push. Every decision taken on the owner's behalf goes in the phase report.

## Owner decisions

The plan runs with the default of each line. "Research" is the recommendation of the research file; where the default differs from it, the reason is given.

| # | Question | Default assumed here | If the owner answers otherwise |
|---|---|---|---|
| D1 | "Forced SSO" has no setting. Add one, derive it, or drop the clause? | Research (c): drop the clause. Magic link is offered whenever mail delivers. An instance setting is backlog. | A setting: new step in Task 6 (`SendMagicLink::handle` and the `canUseMagicLink` prop read it), S10 gains a case, Task 11 unchanged. |
| D2 | Magic link for every user, or only for users without a usable password? | Research: every user with a verified address. | Only SSO-created users: one condition in `SendMagicLink::handle` (Task 6) and one test. |
| D3 | Does the e-mail code count as a second factor for instance admins and workspace owners? | Yes, for everyone (spec B13 makes no exception; research gives no recommendation). | No: `SecondFactors::hasEmailCode` returns false for them and the Security card is hidden (Tasks 7, 12); they must be told before the factor disappears. |
| D4 | E-mail-code-only users have no recovery codes. | Accepted: recovery is regaining the mailbox (spec: "recovery codes unchanged"). Stated on the Security card. | Generate codes: Task 7 grows a step that calls Fortify's `GenerateNewRecoveryCodes` on enable; Task 12 shows them; S16 is rewritten. |
| D5 | Lifetimes and caps. | Link 15 min, code 10 min (spec). Link: 60 s cooldown and 5 per hour per address, 10 per minute per IP. Code: 60 s cooldown, 10 per day per user, 5 attempts per code. | Constants in `MagicLinksController`, `MagicLink`, `EmailTwoFactorCode`, `SendEmailTwoFactorCode` (Tasks 6, 7) and their tests. |
| D6 | Does a consumed link verify an unverified e-mail address? | **No — differs from research (yes).** No link is sent to an unverified account (same response). Reason: someone can register an account with another person's address and a password they know; if a link then verified and opened that account, the real owner would be working in an account the registrant can still enter. Fortify's two-factor and passkey enrolment routes are not behind `verified`, so the registrant could also have planted a factor. | Yes: Task 6 sends to unverified accounts and marks them verified on consume, **and** must first replace the password, cycle `remember_token`, delete the user's passkeys, TOTP secret and database sessions. That is a new task and a new review. |
| D7 | May the link be opened in another browser or device? | Research: yes. The confirmation page names the account before anything happens. | No: store a hash of a browser cookie on the row and compare on consume (Task 6, S5 gains a case, Task 11 gains an error state). |
| D8 | Remember-me after a magic link. | Never, as SSO today. | A checkbox: `remember` stored on the `magic_links` row, passed to `CompleteLogin` (Tasks 5, 6, 11). |
| D9 | Recap e-mail unsubscribe. | No unsubscribe and no new preference: B14 says triggers and recipients do not change. The footer links to the notification settings. Gap with the Emails README recorded in the report. | A preference `retro_recap_by_email`: migration, `RetroResultsRecipients`, settings page, signed unsubscribe as in Task 3 (new task). |
| D10 | `ILIKE` or `pg_trgm`? | Research: `ILIKE`. No trigram or full-text index exists in the repository and an extension needs database rights. | `pg_trgm`: a migration with `create extension` and GIN indexes before Task 9; the queries do not change. |
| D11 | What does search read? | Research: titles of retros, poker games, whiteboards, named game rooms, poker task titles, action item content. No card text, no whiteboard element text. | Card text: reuse the visibility filter of `SearchBoards::messages` (hidden cards excluded in SQL) in Task 9, plus its tests. |
| D12 | Search scope. | Research: the current workspace (`CurrentTeamResolver::visibleTeams()`). | All workspaces: Task 9 uses the rule of `ListActionItemNotifications::viewableTeamIds` extracted to a shared class; results carry the workspace name. |
| D13 | Mail templating. | Research and spec §4.1 ("Explicitly not added: `mjml`"): plain Blade tables. | MJML: stop and ask; it is a dependency. |
| D14 | Request context in the code e-mail. | Research: browser and system from the user agent, reduced to fixed labels; no city, no country. | Nothing at all: drop `UserAgentSummary` (Task 7). |
| D15 | SSO-only users cannot open Security without a passkey or a password reset. | Research: accepted, out of scope. Recorded in the report. | Not in this plan. |
| D16 | Shortcuts listed by the README without a handler (`G`, `F`, `C`, `⇧R`, `⌘→`) and the "disable single-letter shortcuts" setting. | List only what is wired; record the gap. | Build them: belongs to the session screens of 18e, not here. |

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

Front end, created: `resources/js/pages/auth/{magic-link,reminder-unsubscribe}.tsx`; `resources/js/components/auth/{magic-link-request,email-code-challenge}.tsx`; `resources/js/components/settings/email-second-factor-card.tsx`; `resources/js/components/action-items/notifications-menu.tsx`; `resources/js/components/workspaces/command-menu.tsx`; `resources/js/hooks/{use-seconds-left,use-notifications,use-global-search,use-global-shortcuts}.ts`; `resources/js/lib/shortcuts/sections.ts`; each with its `.test.ts(x)`.

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

## Security rules

Every task and every review holds these. Test names are in `tests/Feature/Auth/MagicLinkTest.php` (ML), `EmailSecondFactorTest.php` (EC), `SecondFactorDecisionTest.php` (SF), `LoginAddressTest.php` (LA), `LoginSecretRevocationTest.php` (RV), `tests/Feature/SearchTest.php` (SR), `tests/Feature/Mail/*` (MAIL).

| # | Rule | Proved by |
|---|---|---|
| S1 | **One decision.** Whether a user must pass a second factor is answered only by `SecondFactors::requiredFor()`, and a challenge is opened only by `StartSecondFactorChallenge`. The Fortify pipeline (`RedirectIfSecondFactorRequired`, bound to Fortify's contract), `CompleteLogin` (SSO and magic link) call them. No other file reads `two_factor_secret`, `two_factor_confirmed_at` or `two_factor_email_enabled_at` to decide a challenge. | SF `binds the pipeline step of Fortify to the shared decision`, EC `challenges on every entry` (dataset: password, SSO, magic link × TOTP, e-mail code), SF `lets no other file decide whether a challenge is due` (source scan) |
| S2 | **A passkey sign-in is not challenged** (unchanged; a passkey is itself strong authentication). `Passkeys::authorizeLoginUsing` stays unset. | Review gate (Task 10) reads `vendor/laravel/passkeys/src/Http/Controllers/PasskeyLoginController.php` and greps the app; no automated test (a WebAuthn assertion cannot be forged in a feature test) |
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
| S18 | **Code send limits.** 60 s cooldown and 10 per day per user and purpose. | EC `does not resend within 60 seconds`, EC `stops at ten codes a day` |
| S19 | **Enable and disable need proof.** Both sit behind `auth`, `verified`, `RequirePassword`; enabling also needs a code received at the address. | EC `enabling needs password confirmation and a received code`, EC `disabling needs password confirmation` |
| S20 | **TOTP, recovery codes, passkeys unchanged.** Existing tests pass untouched. Fortify's `POST two-factor-challenge` rejects an e-mail code and answers a validation error (not a 500) for a user without a TOTP secret. | Existing `tests/Feature/Auth/*`, `tests/Feature/Settings/SecurityTest.php`; EC `the authenticator route refuses an e-mail code` |
| S21 | **Revocation.** Password change, password reset and e-mail change delete outstanding links and codes; an e-mail change turns the e-mail factor off; deleting the account deletes its rows. | RV (four tests) |
| S22 | **Encrypted queue, clean security mails.** `SendMagicLink`, `MagicLinkMail`, `TwoFactorCodeMail` implement `ShouldBeEncrypted`. Security mails (link, code, invitation) carry no `List-Unsubscribe` header, no tracking image. | ML `queued work is encrypted`, MAIL `security mails carry no unsubscribe header` |
| S23 | **Search authorisation.** Every query starts from the ids of the teams the user can view in the current workspace; guests and unverified users get nothing; `q` under two characters is refused; `%`, `_` and `\` are literal; 60 per minute. | SR (all) |
| S24 | **Unsubscribe.** The route accepts only a valid signature, changes only `action_item_reminders_by_email` of the signed user, does nothing on `GET`, and signs nobody in. | MAIL `unsubscribe` tests |
| S25 | **User text in mail.** HTML parts escape with `{{ }}` only; no Markdown rendering of user text; subjects are single-line. | MAIL `escapes user text`, existing `ReminderDigestTest`, `WorkspaceInvitationsTest`, `ShareRedactionTest` |
| S26 | **Hex only in mail**, values from the Emails README table or from `BrandPalette::toHex()`; no user string reaches a style. | MAIL `uses hex colours only` |

Known limits, written in the phase report and on the Security card where relevant: a magic link followed by an e-mail code proves the same mailbox twice (spec §9); an e-mail-code-only user who loses the mailbox has no recovery path (D4); the token is part of the URL path and therefore of the reverse proxy's access log for 15 minutes (single use limits the value); with `QUEUE_CONNECTION=sync` the job of S8 runs inside the request and timing is no longer equal — production must run a queue worker, as the README of the project already requires for mail; an e-mail change turns the e-mail factor off without a second proof (the profile form has none today).

## Review Focus

1. **One address typed several ways** (`A@x.test`, ` a@x.test `, `á@x.test` vs `a@x.test`) — the cooldown and the hourly cap hold across spellings, and a link never goes to a different account than the one typed. Pinned in Task 5 (`LoginAddressTest`) and Task 6 (`the cooldown survives a change of case and spaces`).
2. **A link opened twice, by a scanner then by the person, in two tabs, or one second too late** — one session at most, and the second attempt lands on the login page with a clear message. Pinned in Task 6 (`GET and HEAD…`, `works once`, `expires after 15 minutes`).
3. **A code typed for another challenge** (a code issued for enabling, used at login; a code of user A in a session challenged for user B; `login.id` pointing to a deleted user) — refused without a 500. Pinned in Task 7 (`a code of another purpose or user is refused`, `a challenge for a deleted user goes back to login`).
4. **Search text that looks like a pattern or like nothing** (`%`, `_`, `\`, one character, only spaces, 101 characters, an emoji) and a user who belongs to two workspaces with different roles — literal match, validation error, never a row of a team outside the current workspace. Pinned in Task 9.
5. **Names that look like markup in a mail** (workspace `<script>`, inviter `[x](https://evil.test)`, action text with a newline) in the HTML part, the text part and the subject. Pinned in Tasks 2–4.

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
Expected: PASS after the new key `You do not know :inviter? Ignore this e-mail.` is added to the four language files (fr `Vous ne connaissez pas :inviter ? Ignorez cet e-mail.`, es `¿No conoce a :inviter? Ignore este correo.`, de `Sie kennen :inviter nicht? Ignorieren Sie diese E-Mail.`).

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

(Laravel 13 names the web CSRF middleware `PreventRequestForgery`; `validateCsrfTokens` is its deprecated alias.) Feature tests skip CSRF, so this line is checked by hand in Task 10.

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
Expected: PASS. New keys for the four files: `Unsubscribe from reminders` (fr `Se désabonner des rappels`), `Reminder e-mails` (fr `E-mails de rappel`), `Stop the action item reminders sent by e-mail?` (fr `Arrêter les rappels d'actions envoyés par e-mail ?`), `You no longer receive action item reminders by e-mail.` (fr `Vous ne recevez plus les rappels d'actions par e-mail.`), `Unsubscribe` (fr `Se désabonner`).

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

it('carries no unsubscribe header and links to the notification settings', function () {
    $retro = Retro::factory()->inPhase(RetroPhase::Completed)->create();
    [$facilitator] = retroFacilitator($retro);

    $mail = (new RetroResultsNotification($retro->id))->toMail($facilitator);

    expect(method_exists($mail, 'headers'))->toBeFalse();
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
Expected: PASS. An assertion of the two existing files that expected an escaped Markdown character (a backslash before `*`, `_`, `[`) is updated to the unescaped text: the escaping existed for Markdown rendering, which is gone (S25). List each changed line in the report. New key: `You receive this e-mail because you took part in this retrospective or belong to its team.` (fr `Vous recevez cet e-mail parce que vous avez participé à cette rétrospective ou faites partie de son équipe.`).

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
- Create: migration `create_magic_links_table`, `app/Models/MagicLink.php`, `database/factories/MagicLinkFactory.php`, `app/Actions/Auth/IssueMagicLink.php`, `app/Actions/Auth/ConsumeMagicLink.php`, `app/Jobs/Auth/SendMagicLink.php`, `app/Mail/MagicLinkMail.php`, `resources/views/mail/magic-link.blade.php`, `resources/views/mail/text/magic-link.blade.php`, `app/Http/Requests/Auth/MagicLinkRequest.php`, `app/Http/Controllers/MagicLinksController.php`, `app/Http/Controllers/MagicLinkSessionsController.php`, `resources/js/pages/auth/magic-link.tsx` (minimal here, finished in Task 11)
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

`resources/js/pages/auth/magic-link.tsx` (Task 11 gives it its final look):

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
Expected: PASS once the new keys are in the four language files. French: `Your sign-in link for :app` → `Votre lien de connexion à :app`; `Sign in to :app` → `Connexion à :app`; `Use the button to sign in as` → `Utilisez le bouton pour vous connecter en tant que`; `The link works once and expires in :minutes minutes.` → `Le lien fonctionne une seule fois et expire dans :minutes minutes.`; `Sign in` → `Se connecter`; `Or paste this link in your browser:` → `Ou collez ce lien dans votre navigateur :`; `You did not ask for this? Ignore this e-mail: nobody can sign in without the link.` → `Vous n'avez rien demandé ? Ignorez cet e-mail : personne ne peut se connecter sans ce lien.`; `This sign-in link is no longer valid. Request a new one.` → `Ce lien de connexion n'est plus valide. Demandez-en un nouveau.`; `Too many attempts. Wait a minute and try again.` → `Trop de tentatives. Patientez une minute puis réessayez.`; `This link no longer works` → `Ce lien ne fonctionne plus`; `You are about to sign in as :email.` → `Vous allez vous connecter en tant que :email.`; `It has expired or was already used. Request a new one from the log in page.` → `Il a expiré ou a déjà été utilisé. Demandez-en un nouveau depuis la page de connexion.`; `Back to log in` → `Retour à la connexion`.

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
  - `SendEmailTwoFactorCode::handle(User $user, EmailCodePurpose $purpose, ?string $userAgent): bool`, `secondsUntilResend(User $user, EmailCodePurpose $purpose): int`, constants `CooldownSeconds = 60`, `DailyCap = 10`
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

it('stops at ten codes a day', function () {
    $user = User::factory()->withEmailSecondFactor()->create();
    $send = resolve(SendEmailTwoFactorCode::class);

    $sent = collect(range(1, 12))->map(function () use ($send, $user): bool {
        $result = $send->handle($user, EmailCodePurpose::Login, null);
        $this->travel(61)->seconds();

        return $result;
    });

    expect($sent->filter()->count())->toBe(10);
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

    public const int DailyCap = 10;

    public function __construct(private IntegrationAvailability $availability) {}

    /**
     * False when nothing was sent: mail does not deliver, the address is
     * not verified, the cooldown runs, or the daily cap is reached.
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

        $capKey = "email-code-day:{$user->id}";

        if (RateLimiter::tooManyAttempts($capKey, self::DailyCap)) {
            return false;
        }

        RateLimiter::hit($capKey, 86400);

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

A resend replaces the row and so resets `attempts`; the daily cap bounds the total: 10 codes × 5 attempts = 50 guesses a day in a million, on top of the 5-per-minute route throttle.

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

French for the new keys: `:code is your :app verification code` → `:code est votre code de vérification :app`; `Your verification code` → `Votre code de vérification`; `Enter this code to continue.` → `Saisissez ce code pour continuer.`; `It expires in :minutes minutes.` → `Il expire dans :minutes minutes.`; `Requested from :device.` → `Demandé depuis :device.`; `Not you? Someone knows your password.` → `Ce n'est pas vous ? Quelqu'un connaît votre mot de passe.`; `Change your password` → `Changez votre mot de passe`; `The code is wrong or has expired.` → `Le code est incorrect ou a expiré.`; `E-mail code turned on.` → `Code par e-mail activé.`; `E-mail code turned off.` → `Code par e-mail désactivé.`

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
- Produces: route `search.index` (`GET search?q=`), JSON `{ results: Array<{ kind: 'retro'|'poker'|'whiteboard'|'game'|'action', id: string, title: string, team: { id: string, name: string }, url: string }> }`, at most five per kind, newest first, kinds in that order; `SearchWorkspaceContent::PerKind = 5`; `SearchWorkspaceContent::handle(Collection $teams, string $term): array`.

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

- [ ] **Step 5: Run the tests**

Run: `vendor/bin/sail artisan test --compact tests/Feature/SearchTest.php tests/Feature/Mcp/SearchBoardsTest.php tests/Arch`
Expected: PASS. If the `Illuminate\Routing\Route` model keys differ from the names used (`retro`, `game`, `board`, `room`), `route()` throws `UrlGenerationException`: pass the parameter by name, e.g. `route('poker.show', ['game' => $game])`.

- [ ] **Step 6: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add app routes tests
git commit -m "feat(search): search route scoped to the teams the user can view"
```

### Task 10: Security review gate (mandatory, blocks every front task)

**Files:** none created by the reviewer. Fixes go to the files of Tasks 5–9 with their tests.

**Interfaces:**
- Consumes: the diff of Tasks 1–9 (`git diff <branch point>..HEAD -- app routes database bootstrap resources/views tests/Feature`).
- Produces: a review record in the phase report: one line per rule S1–S26 (held / broken, with the file and line read), one line per Review Focus item, the list of fixes.

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

- [ ] **Step 3: Manual checks on the running application** (`vendor/bin/sail up -d`, port of the project, never 8097), with `MAIL_MAILER=smtp` pointing at the Mailpit of Sail if present, otherwise the preview routes:

1. `curl -i -X POST "<signed reminder-unsubscribe URL>" -d "List-Unsubscribe=One-Click"` with no cookie answers 204 (the CSRF exemption of Task 3 works) and the same URL with one character of the signature changed answers 403.
2. `curl -I "<magic link URL>"` then `curl "<magic link URL>"`: no `Set-Cookie` that carries an authenticated session (the `magic_links` row still has `consumed_at` null).
3. Request a link twice within a minute for a real and for an unknown address with `curl -w "%{time_total}\n"` while a queue worker runs: same status, same `Location`, comparable times.
4. Open `/dev/mail/magic-link`, `/dev/mail/two-factor-code`, `/dev/mail/invitation`, `/dev/mail/action-reminder`, `/dev/mail/retro-recap` with `?locale=fr`: each renders, in French.

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

### Task 11: Login — "E-mail me a link" and the confirmation page

**Files:**
- Create: `resources/js/hooks/use-seconds-left.ts`, `resources/js/hooks/use-seconds-left.test.ts`, `resources/js/components/auth/magic-link-request.tsx`, `resources/js/components/auth/magic-link-request.test.tsx`
- Modify: `resources/js/pages/auth/login.tsx` (props and one mount point), `resources/js/pages/auth/magic-link.tsx` (look), `resources/js/components/skrum/resend-code.tsx:10` (`locale: string`), `resources/js/pages/dev/sections/` (one section showing the three states)
- Test: the two Vitest files; `tests/Feature/Auth/MagicLinkTest.php` already covers the props

**Interfaces:**
- Consumes: `MagicLinksController.store` (Wayfinder, `@/actions/App/Http/Controllers/MagicLinksController`), login props `canUseMagicLink: boolean`, `status?: string` (`'magic-link-sent'`), `ResendCode` (`cooldownSeconds`, `remaining`, `onResend`, `sentTo`, `locale`).
- Produces: `useSecondsLeft(initial: number): [number, (seconds: number) => void]`; `<MagicLinkRequest sent={boolean} />`.

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
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MagicLinkRequest } from '@/components/auth/magic-link-request';

const post = vi.fn();

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    router: { post: (...args: unknown[]) => post(...args) },
    usePage: () => ({ props: { locale: 'en', translations: {} } }),
}));

describe('MagicLinkRequest', () => {
    beforeEach(() => post.mockReset());

    it('posts the typed address', () => {
        render(<MagicLinkRequest sent={false} />);

        fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'ada@example.test' } });
        fireEvent.click(screen.getByRole('button', { name: 'E-mail me a sign-in link' }));

        expect(post).toHaveBeenCalledTimes(1);
        expect(post.mock.calls[0][1]).toEqual({ email: 'ada@example.test' });
    });

    it('shows the same confirmation whatever the address, with the address typed in this browser', () => {
        const { rerender } = render(<MagicLinkRequest sent={false} />);

        fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'ada@example.test' } });
        fireEvent.click(screen.getByRole('button', { name: 'E-mail me a sign-in link' }));
        rerender(<MagicLinkRequest sent />);

        expect(screen.getByRole('status')).toHaveTextContent('If an account exists for ada@example.test');
        expect(screen.queryByRole('button', { name: 'E-mail me a sign-in link' })).toBeNull();
    });

    it('does not post an empty address', () => {
        render(<MagicLinkRequest sent={false} />);

        fireEvent.click(screen.getByRole('button', { name: 'E-mail me a sign-in link' }));

        expect(post).not.toHaveBeenCalled();
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

- [ ] **Step 4: The container**

```tsx
import { router, usePage } from '@inertiajs/react';
import { Mail } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import MagicLinksController from '@/actions/App/Http/Controllers/MagicLinksController';
import InputError from '@/components/input-error';
import { ResendCode } from '@/components/skrum/resend-code';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { useSecondsLeft } from '@/hooks/use-seconds-left';
import { useTrans } from '@/hooks/use-trans';

const CooldownSeconds = 60;

/**
 * Asks for a sign-in link. The confirmation is the same for every address:
 * the server never says whether an account exists, and neither does this.
 */
export function MagicLinkRequest({ sent }: { sent: boolean }) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const [email, setEmail] = useState('');
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string>();
    const [remaining, restart] = useSecondsLeft(sent ? CooldownSeconds : 0);

    const send = () => {
        if (email.trim() === '') {
            return;
        }

        router.post(
            MagicLinksController.store.url(),
            { email },
            {
                preserveScroll: true,
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
                onSuccess: () => {
                    setError(undefined);
                    restart(CooldownSeconds);
                },
                onError: (errors) => setError(errors.email),
            },
        );
    };

    const submit = (event: FormEvent) => {
        event.preventDefault();
        send();
    };

    if (sent && email !== '') {
        return (
            <div className="flex flex-col gap-3" data-slot="magic-link-sent">
                <p role="status" className="text-body-sm text-foreground">
                    {t(
                        'If an account exists for :email, a sign-in link is on its way. It works once and expires in 15 minutes.',
                        { email },
                    )}
                </p>
                <ResendCode
                    cooldownSeconds={CooldownSeconds}
                    remaining={remaining}
                    onResend={send}
                    locale={String(locale)}
                />
                <InputError message={error} />
            </div>
        );
    }

    return (
        <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
            <div className="grid gap-2">
                <Label htmlFor="magic-link-email">{t('Email address')}</Label>
                <Input
                    id="magic-link-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={t('email@example.com')}
                />
                <InputError message={error} />
            </div>
            <Button
                type="submit"
                variant="outline"
                className="w-full"
                disabled={processing}
                data-test="magic-link-button"
            >
                {processing ? <Spinner /> : <Mail aria-hidden="true" />}
                <span className="truncate">{t('E-mail me a sign-in link')}</span>
            </Button>
        </form>
    );
}
```

`ResendCode` declares `locale: 'fr' | 'en'`; the application has four locales and the value only reaches `Intl.NumberFormat`: change the type to `string` in `resources/js/components/skrum/resend-code.tsx` and keep its tests green. `ResendCode` says "code" in its wording; if its README offers a `label` prop by the time of execution use it, otherwise record the wording as a gap.

- [ ] **Step 5: Mount it on the login page**

In `resources/js/pages/auth/login.tsx`: add `canUseMagicLink: boolean` to `Props`; below the password form and above (or beside, per `ScreenAuth`) the SSO buttons, render `{canUseMagicLink && <MagicLinkRequest sent={status === 'magic-link-sent'} />}` under the separator the mockup shows. The password form, `#email`, `#password`, `@login-button` and the SSO buttons do not move in the tab order (the browser suite signs in through them). The page must not render the raw `status` string `magic-link-sent`: where the page prints `status` as a message, exclude that value.

- [ ] **Step 6: Finish the confirmation page** per `ScreenAuth`: `auth/magic-link.tsx` keeps its props, the `magic-link-confirm-button` test hook and its two states; apply the auth card layout 18e uses (heading, description, one primary button, text link). No other logic.

- [ ] **Step 7: Run**

Run: `npm run test -- use-seconds-left magic-link-request resend-code`, `npm run types:check`, `npm run check`, `npm run build:front`, then `vendor/bin/sail artisan test --compact tests/Feature/Auth tests/Feature/TranslationKeysTest.php`
Expected: PASS after the new keys are in the four files (fr: `E-mail me a sign-in link` → `Recevoir un lien de connexion par e-mail`; `If an account exists for :email, a sign-in link is on its way. It works once and expires in 15 minutes.` → `Si un compte existe pour :email, un lien de connexion est en route. Il fonctionne une seule fois et expire dans 15 minutes.`).

- [ ] **Step 8: Commit**

```bash
git add resources/js lang
git commit -m "feat(auth): ask for a sign-in link from the login page and confirm it before signing in"
```

### Task 12: Two-factor challenge and Security — e-mail code

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

- [ ] **Step 6: Run**

Run: `npm run test -- email-code-challenge email-second-factor-card`, `npm run types:check`, `npm run check`, `npm run build:front`, `vendor/bin/sail artisan test --compact tests/Feature/Auth tests/Feature/Settings tests/Feature/TranslationKeysTest.php`
Expected: PASS with the new keys in four languages (the test lists the missing ones).

- [ ] **Step 7: Commit**

```bash
git add resources/js lang
git commit -m "feat(auth): e-mail code at the challenge and in the security settings"
```

### Task 13: Bell — `NotificationsPanel` on the three existing routes

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

- [ ] **Step 6: Run**

Run: `npm run test -- use-notifications notifications-menu notifications-panel`, `npm run types:check`, `npm run check`, `npm run build:front`, then `vendor/bin/sail artisan test --compact tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php`
Expected: PASS without editing the browser test. If one of its steps reads text inside the old dropdown that the panel words differently, the change is listed in the report with the README line that imposes the new wording.

- [ ] **Step 7: Commit**

```bash
git add resources/js lang
git commit -m "feat(notifications): the new bell and panel on the existing notification routes"
```

### Task 14: Command palette with content search

**Files:**
- Create: `resources/js/hooks/use-global-search.ts`, `resources/js/hooks/use-global-search.test.ts`, `resources/js/components/workspaces/command-menu.tsx`, `resources/js/components/workspaces/command-menu.test.tsx`
- Modify: `resources/js/components/ui/command.tsx:257-354` (a `results` group, an `onSearchChange` prop, shortcuts through `useShortcut`), `resources/js/components/ui/command.test.tsx`, `resources/js/layouts/skrum/app-layout.tsx`
- Test: the Vitest files

**Interfaces:**
- Consumes: `SearchResultsController.index` (Wayfinder), JSON of Task 9; `useSidebarModel` links (as 18e left them) for the "Go to" items; `useShortcut`.
- Produces:
  - `CommandPaletteItem['group']` becomes `'actions' | 'recent' | 'results' | 'goto'`; `CommandPaletteProps` gains `onSearchChange?: (value: string) => void`
  - `useGlobalSearch(query: string, delayMs?: number): { results: SearchResult[]; loading: boolean; failed: boolean; term: string }` with `SearchResult = { kind: 'retro' | 'poker' | 'whiteboard' | 'game' | 'action'; id: string; title: string; team: { id: string; name: string }; url: string }`; constants `SearchDelayMs = 150`, `SearchMinLength = 2`
  - `<CommandMenu />` (field in the topbar + palette), exporting `openCommandMenuEvent = 'skrum:open-command-menu'` for Task 15

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

export type SearchResultKind = 'retro' | 'poker' | 'whiteboard' | 'game' | 'action';

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

`⌘K` keeps working inside fields and overlays as today (`command.test.tsx` holds that behaviour; the README's "except in a field being edited" is recorded as a deviation in the report). `/` no longer opens the palette when another dialog or menu is open: `useShortcut` ignores a key pressed in an overlay that is not its own, which removes the collision with the `/` of the shortcuts dialog and of the template picker. Add to `command.test.tsx`:

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

`resources/js/layouts/skrum/app-layout.tsx`: `search={<CommandMenu goto={gotoItems} />}` on `AppTopbar`, where `gotoItems` is built in the layout from the links `useSidebarModel` already returns (Dashboard, Sessions, Actions, Mood & ROTI, Games, Members, Templates, All teams, Team settings, Administration when present, plus Profile, Security, Notifications settings): one `CommandPaletteItem` per link with `group: 'goto'`, its sidebar label, its sidebar icon and `onSelect: () => router.visit(href)`. No link is invented: an entry the sidebar model does not have is not in the palette. The `actions` and `recent` groups stay empty in 18f (creating a session from the palette and a recent-sessions list need page data that is not shared; recorded as a gap).

- [ ] **Step 7: Run**

Run: `npm run test -- use-global-search command-menu command`, `npm run types:check`, `npm run check`, `npm run build:front`, `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: PASS (new keys: `Results` → fr `Résultats`; `Search is unavailable. Try again in a moment.` → fr `La recherche est indisponible. Réessayez dans un instant.`).

- [ ] **Step 8: Commit**

```bash
git add resources/js lang
git commit -m "feat(search): command palette in the topbar with debounced content search"
```

### Task 15: Global shortcuts and the keyboard shortcuts dialog

**Files:**
- Create: `resources/js/lib/shortcuts/sections.ts`, `resources/js/lib/shortcuts/sections.test.ts`, `resources/js/hooks/use-global-shortcuts.ts`, `resources/js/hooks/use-global-shortcuts.test.tsx`
- Modify: `resources/js/layouts/skrum/app-layout.tsx`, `resources/js/layouts/skrum/session-layout.tsx` (mount the dialog), `resources/js/pages/dev/sections/keyboard-shortcuts.tsx:26-142` (reads the shared sections)
- Test: the two Vitest files

**Interfaces:**
- Consumes: `KeyboardShortcuts`, `ShortcutSection`, `ShortcutSectionId` of `@/components/skrum/keyboard-shortcuts`; `useShortcut`; `openCommandMenuEvent` (Task 14).
- Produces: `shortcutSections(t: (key: string) => string): ShortcutSection[]` — only shortcuts that have a handler; `contextOfPage(component: string): ShortcutSectionId | undefined`; `useGlobalShortcuts(): { open: boolean; setOpen(open: boolean): void; context: ShortcutSectionId | undefined }`.

- [ ] **Step 1: Establish what is wired** (the list is data for the next step, and goes in the report)

Run:

```bash
grep -rnE "useShortcut\(|addEventListener\(['\"]keydown|onKeyDown=" resources/js --include=*.ts --include=*.tsx | grep -v "\.test\." | grep -v "pages/dev/"
```

For each hit, note the key, the screen and whether it is a document listener or an element handler. A shortcut enters `sections.ts` only if this list has its handler. From the reading of 2026-10-02 (before 18e): General `⌘K`, `/`, `?` (after this task), `⌘B`; Retro `N`, `Enter`, `Delete`, `V`, `T`, `+`, arrows of the facilitator bar; Poker `0–9`, `R`, `N`, `⌘Enter`; Reactions `1–6`; ROTI `1–5`; health check and survey digits. `G`, `F`, `C`, `⇧R`, `⌘→` had no handler (D16). 18e may have changed this list: the grep decides.

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

If Step 1 shows that 18e wired `G`, `F` or `⌘→`, delete the matching `not.toContain` line and add the item; the test documents the gap, it does not freeze it.

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

### Task 16: Translations, visual captures, browser walkthrough

**Files:**
- Modify: `lang/en.json`, `lang/fr.json`, `lang/es.json`, `lang/de.json`
- Create: `tests/Browser/Visual/CrossCuttingVisualTest.php`, `tests/Browser/Walkthroughs/Plan18fCrossCuttingTest.php`, captures under `tests/visual/__screenshots__/`

**Interfaces:**
- Consumes: `captureVisuals(string $name, string $path, ?callable $visit)` and `signIn(User $user, string $to)` of `tests/Browser/Support`; the preview route `dev.mail.show`; every screen of Tasks 11–15.

- [ ] **Step 1: Translations**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php`. Every key it lists as missing is added to the four files, translated (not copied from English) in `fr`, `es`, `de`, in the register of the neighbouring keys (French uses "vous", "e-mail", a space before `?`, `:` and `!`). No fixed width depends on a label (rule 10): check the longest German strings of the new buttons at 390.

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

- [ ] **Step 3: Browser walkthrough**

`tests/Browser/Walkthroughs/Plan18fCrossCuttingTest.php`, in the style of `Plan18dBrandingTest.php` (ids `[P18f-01]` …), with `config(['mail.default' => 'smtp'])` and `Mail::fake()` where a mail is expected:

1. `[P18f-01]` From `/login`, a member types their address in the magic-link field and clicks `@magic-link-button`: the status text appears. The test then builds a link with `resolve(IssueMagicLink::class)->handle($user)`, visits it, sees "You are about to sign in as", clicks `@magic-link-confirm-button`, and lands on the dashboard. Visiting the same link again shows "This link no longer works".
2. `[P18f-02]` A member with `withEmailSecondFactor` signs in with the password, lands on the challenge in e-mail mode, types the code read from the queued `TwoFactorCodeMail`, and lands on the dashboard. A wrong code first shows the error.
3. `[P18f-03]` In Security (after password confirmation), a member clicks "Send me a code", types the code, clicks "Turn on", sees "The e-mail code is on."; then "Turn off the e-mail code".
4. `[P18f-04]` `⌘K` (or `@command-menu-button`) opens the palette; typing two letters of a retro title shows it under "Results" with the team name; Enter opens the retro; a retro of another team never appears.
5. `[P18f-05]` `?` opens "Keyboard shortcuts" on the dashboard; on a poker game the Planning poker section comes first; typing `?` in a text field does not open it; Escape closes it and focus returns to where it was.
6. `[P18f-06]` The bell shows "2 unread notifications", opens the panel, "Mark all as read" brings it back to "Notifications".
7. `[P18f-07]` Logged out, a signed unsubscribe link shows the confirmation page; `@unsubscribe-button` turns the reminders off; the settings page then shows the e-mail reminder switch off.

- [ ] **Step 4: Run**

Run: `npm run build:front`, then `vendor/bin/sail artisan test --compact tests/Browser/Visual/CrossCuttingVisualTest.php tests/Browser/Walkthroughs/Plan18fCrossCuttingTest.php tests/Arch`
Expected: PASS; `BrowserTestRulesTest` (arch) accepts the two new files.

- [ ] **Step 5: Commit**

```bash
git add lang tests/Browser tests/visual
git commit -m "test: 18f translations, captures of the mails and screens, cross-cutting walkthrough"
```

### Task 17: Verification and phase report

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
| B11 | `SearchTest` (15 tests) |
| B12 | `MagicLinkTest`; every clause of the row mapped to a test: request by e-mail, signed, single use, 15 minutes, hashed, 60 s cooldown, per e-mail and per IP, same response, second factor still asked. "Forced SSO" clause: D1 |
| B13 | `EmailSecondFactorTest`: enable in Security, 6 digits, 10 minutes, hashed, 60 s cooldown, five attempts, TOTP / recovery / passkeys unchanged |
| B14 | `tests/Feature/Mail/*`: five Mailables, light and dark, `BrandPalette::toHex()`, triggers and recipients unchanged (`ReminderDigestTest`, `ResultsEmailTest`, `WorkspaceInvitationsTest` green) |
| §12 18f | bell on the existing routes (Task 13), global shortcuts and `?` (Task 15) |
| §13.1, 13.3, 13.4 | captures of Task 16; `bin/test-browser`; the suites of Step 1 |
| §13.13 | every §9 item of this phase has feature tests; B12 and B13 passed Task 10 (record attached) |

- [ ] **Step 4: One whole-branch review with a security lens** (`superpowers:requesting-code-review`), one fix wave, one scoped re-review. The front must not have weakened a rule: the reviewer checks that no page prints the `status` flash raw, that the e-mail code is never posted to Fortify's route, that no token or code is kept in `localStorage`, `sessionStorage` or a URL the client builds.

- [ ] **Step 5: The report**

Sections: what is done; the Task 10 record (rule by rule); decisions taken for the owner (D1–D16 with the default applied, D6 flagged as differing from the research); known limits (Security rules, last paragraph); gaps with the design system and why — Emails README: no PNG logo of Skrüm exists in `public/brand` and none can be rasterised without a new package, so a mail shows the instance's PNG/JPEG logo or the name as text; no "team" invitation (only workspace invitations exist); no browser/OS/city block beyond the fixed device label; recap without the four-stat block, the ROTI bars and the unsubscribe link (D9); reminder mail keeps overdue and due-soon; four locales through the JSON files instead of `lang/{fr,en}/mail.php` — Command README: ⌘K also opens inside a field; "Actions" and "Recent sessions" groups empty — KeyboardShortcuts README: shortcuts without a handler not listed, no "disable single-letter shortcuts" setting (D16); browser tests changed and the mockup line that imposes each change; parity table "old bell → new bell" (open, read one, read all, refresh on focus, link to the item); what 18g needs (delete `notification-bell.tsx` and `app-sidebar-header.tsx`).

- [ ] **Step 6: Commit**

```bash
git add docs
git commit -m "docs: 18f phase report"
```

No merge into `main`, no push.

---

## Self-review (done while writing; kept for the reader)

**Spec coverage.** B11 → Task 9, 14. B12 → Tasks 5, 6, 8, 11 ("not offered when … forced SSO": no such setting exists; D1 drops the clause, reported). B13 → Tasks 5, 7, 8, 12. B14 → Tasks 1–4, 6, 7 (five Mailables; "the three existing notifications keep their triggers and recipients": only `toMail` changes). "Their plan includes a security review step before merge" → Task 10 and Task 17 Step 4. "Stated on the Security screen" → Task 12 card. Bell → Task 13. Global shortcuts and `?` → Task 15. §11 visual captures FR/EN, light/dark, 1440/390 → Task 16. §13.13 → Task 17.

**Not fully covered, and said so:** the "forced SSO" clause of B12 (D1); the mounting points inside pages that plan 18e rewrites (Tasks 11–15 give the units in full and name the mount point, the surrounding JSX is read at execution); ruling 21 on digits is verified against 18e's code rather than rebuilt (Task 15 Step 7); S2 (passkeys) and the CSRF exemption of the unsubscribe POST are checked by reading and by hand in Task 10, not by an automated test.

**Type consistency.** `SecondFactors::methodsFor` returns `array<int, SecondFactorMethod>` in Tasks 5 and 7 and is consumed as such in `StartSecondFactorChallenge` and the challenge view. `SendEmailTwoFactorCode::handle(User, EmailCodePurpose, ?string): bool` is called with three arguments in `StartSecondFactorChallenge`, `EmailChallengeCodesController`, `EmailSecondFactorCodesController` and the tests. `IssueMagicLink::handle(User): string` and `ConsumeMagicLink::handle(string): ?User` match their callers. `MagicLinkMail(url, email, expiresInMinutes)` has three arguments in the job, the preview and the test. Route names used by the tests are the ones declared: `magicLinks.store`, `magicLinks.show`, `magicLinks.sessions.store`, `twoFactor.emailCodes.store`, `twoFactor.emailChallenges.store`, `emailSecondFactor.codes.store`, `emailSecondFactor.store`, `emailSecondFactor.destroy`, `reminderUnsubscribes.show`, `reminderUnsubscribes.store`, `search.index`, `dev.mail.show`. Front: `useSecondsLeft` returns a tuple in Tasks 11 and 12; `SearchResult` is one type shared by the hook and the container; `openCommandMenuEvent` is exported by Task 14 and imported by Task 15.

**The source-scan test** of Task 5 expects, at the end of Task 8, exactly: `Actions/Auth/RevokeLoginSecrets.php`, `Http/Controllers/Settings/EmailSecondFactorsController.php`, `Http/Controllers/Settings/SecurityController.php`, `Http/Requests/Auth/TwoFactorChallengeRequest.php` (in the order `File::allFiles` returns). `SecurityController` reads the TOTP state through Fortify's method to display it; the three others write or guard, none decides a challenge.
