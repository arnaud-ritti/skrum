# Brief 11 — ACCESS (auth, invitation, guest joins, error pages)

Read-only research at HEAD f8ea376d plus the uncommitted tree. Nothing was run (no test, build, browser). Sources: spec §4-§10, inventory-pages (auth, slice 07 invitations, slices 01/03/04/05 join sections), notes-for-18e, ScreenAuth / ScreenOnboarding / ScreenErrors / MobileAccess / GuestJoin READMEs and `preview.html` text, old and new code under `resources/js`.

## 1. Scope

| Item | Detail |
|---|---|
| Pages | `auth/login`, `auth/register`, `auth/forgot-password`, `auth/reset-password`, `auth/verify-email`, `auth/two-factor-challenge`, `auth/confirm-password`; `invitations/show`; `retros/join`, `poker/join`, `games/join`, `whiteboards/join`; `retros/session-ended` (see Decision D8); NEW `errors/error` (403/404/500/503) |
| Routes (all unchanged) | Fortify views (`FortifyServiceProvider::configureViews`, app/Providers/FortifyServiceProvider.php:52-90); `invitations.show` GET `invitations/{token}`, `invitations.acceptance.store` POST (auth); `retros.join.*` `join/{guestToken}`; `poker.join.*` `poker/join/{guestToken}`; `games.join.*` `play/{guestToken}`; `whiteboards.join.*` `whiteboards/join/{guestToken}`; SSO `sso.redirect` `auth/{provider}/redirect`; passkeys `/passkeys/login/options`, `/passkeys/login`, `/passkeys/confirm/options`, `/passkeys/confirm`; `POST /logout`; `PUT /locale` |
| Layouts | `AuthLayout` (`layouts/skrum/auth-layout.tsx`, already written in 18a, wraps `AuthFrame`; NOT yet wired in `app.tsx`, which still imports the starter `@/layouts/auth-layout`). `OnboardingLayout` exists but is unused here (4-step onboarding = backlog §10). Errors: own frame (no sidebar), app.tsx returns `null` for `errors/*`. |
| New layout variant needed | AuthFrame is a 2-column split with a title (`frames.tsx:168-223`). GuestJoin, the invitation card, session-ended and the invalid-link notices are single centred cards that carry their own title (GuestJoin README, ScreenOnboarding "carte centrale w-120", MobileAccess). Add `variant?: 'split' | 'centered'` to `AuthFrame` and `AuthLayout` (Decision D1). Centred variant: logo header + language switcher, `children` centred, title rendered as `sr-only <h1>` (GuestJoin has only an `<h2>`). |
| Mockups | ScreenAuth (login, register variant; magic-link variant = 18f slot), ScreenOnboarding frames b/d (accept invitation: card, "already signed in", "expired" variants; the "declined" variant and frames a/c = backlog), ScreenErrors (404, 403, 500, 503; the connection-lost banner belongs to the session briefs), MobileAccess (login, guest), GuestJoin README |
| Designed from neighbours | forgot-password, reset-password, verify-email, two-factor-challenge, confirm-password (spec §7), invalid/expired link notices, session-ended |

What Laravel renders now for errors (verified): `bootstrap/app.php` has only `dontFlash` and `shouldRenderJsonWhen(api/* or expectsJson)`; no `resources/views/errors/`; `app/Exceptions/` has no handler; so 403/404/419/429/500/503 use the framework's plain "NNN | Message" views (and the debug page when `APP_DEBUG`). Inertia XHR requests that hit an error show Inertia's HTML modal. Examples: `registerView` does `abort_unless(...canShowRegistration, 403)` (FortifyServiceProvider.php:82); unknown routes. Inertia is 3.4.0 and ships `Inertia::handleExceptionsUsing(callable)` + `Inertia\ExceptionResponse` (`render()`, `withSharedData()`, `statusCode()`, `->request`), verified in vendor.

## 2. Commits (order)

| # | Commit | Deletes (old files) |
|---|---|---|
| 1 | `feat(auth): new AuthLayout for access pages, shared auth components` — wire `skrum/auth-layout` in `app.tsx` for `auth/*`, `invitations/*`, the 4 joins, `session-ended`; add `centered` variant; write the shared containers (PasswordField, SsoButtons, PasskeySignIn, AccessNotice, AuthAside, AuthFormFooter link style) + Vitest; update `dev/sections/auth.tsx` | `layouts/auth-layout.tsx`, `layouts/auth/auth-simple-layout.tsx`, `AuthLayoutProps` in `types/ui.ts` if unused elsewhere (not checked) |
| 2 | `feat(auth): login and register on the new design` (+ dev section, visual capture) | `components/sso-buttons.tsx`; old bodies of `pages/auth/login.tsx`, `register.tsx` |
| 3 | `feat(auth): forgot password, reset password, e-mail verification` | `components/text-link.tsx` (last users: login, register, forgot, verify-email) |
| 4 | `feat(auth): two-factor challenge and password confirmation` | `components/passkey-verify.tsx` (last user: confirm-password) |
| 5 | `feat(invitations): accept-invitation card` | `components/heading.tsx` is NOT deletable here (22 other users; 18g) |
| 6 | `feat(guest): guest join pages on GuestJoin, session ended` — 4 join pages + `session-ended`, `AccessNotice` for invalid links | none (heading/input-error still used elsewhere) |
| 7 | `feat(errors): custom 403/404/500/503 pages (B15)` — `bootstrap/app.php` handler, `pages/errors/error.tsx`, container, Feature tests | none |

Not deletable by this group (still imported by other groups until they migrate; 18g removes): `components/input-error.tsx` (34 files), `components/password-input.tsx` (delete-user, settings/security), `components/heading.tsx`, `components/app-logo-icon.tsx` (used by `app-logo.tsx`; check after the sidebar rewrite), `components/language-switcher.tsx` (kept, used by new layouts).

## 3. Parity table

Old files: L=`pages/auth/login.tsx`, R=`register.tsx`, F=`forgot-password.tsx`, P=`reset-password.tsx`, V=`verify-email.tsx`, T=`two-factor-challenge.tsx`, C=`confirm-password.tsx`, I=`pages/invitations/show.tsx`, SE=`pages/retros/session-ended.tsx`. New containers are in `components/auth/` (see §4).

| # | Action / behaviour | Old control | Route / event | New control | Hook to preserve | Note |
|---|---|---|---|---|---|---|
| 1 | Email + password + remember sign-in | L Form :39-125 | POST `/login` (`login.store`); `resetOnSuccess=['password']` | `LoginForm`: 2 `TextField`/`PasswordField`, `Checkbox#remember`, `LoadingButton` | `#email`, `#password` (ids), names `email` `password` `remember`, `data-test="login-button"` (`@login-button`), accessible name "Log in" | Used by `InteractsWithBrowser::signIn`. `tabIndex` hacks dropped (DOM order). Errors under the field (ScreenAuth: "never a toast"), `errors.email`/`errors.password` |
| 2 | Show/hide password | `components/password-input.tsx` | client | `PasswordField` (TextField `suffix` button) | names "Show password" / "Hide password" | New component replaces old PasswordInput for auth pages only |
| 3 | Forgot link (if `canResetPassword`) | L :69-77 | GET `/forgot-password` | `Link` in the password row | text "Forgot your password?" | |
| 4 | Remember label | L Checkbox | `remember` | `Checkbox` + "Remember me" | | Mockup says "30 days": false (Laravel default is long). Keep "Remember me" (D5) |
| 5 | Sign in with passkey (hidden when WebAuthn unsupported) | `PasskeyVerify` | GET `/passkeys/login/options`, POST `/passkeys/login`; success `router.visit(redirect ?? '/dashboard')` | `PasskeySignIn` (outline lg `Button`, `KeyRound`) via `usePasskeyVerify` from `@laravel/passkeys/react` | text "Sign in with a passkey", "Authenticating..." | No mockup element: placed under the SSO buttons, above the "or with your e-mail" separator. Error under the button |
| 6 | SSO buttons per provider (full navigation `<a>`) | `SsoButtons` | GET `auth/{provider}/redirect` (`SsoRedirectsController.show.url({provider})`) | new `SsoButtons` (outline lg `Button asChild` `<a>`; 1st provider full width, others 2-col grid) | text "Continue with :provider" | Keep `<a>` not `Link` (leaves the SPA). Marks: lucide only (no Google/GitHub logo in lucide): use `KeyRound`/`Building2` for `oidc`/`entra`, a text initial for google/github (ScreenAuth shows a "G") |
| 7 | Separator "or" | SsoButtons | | `Separator` + label "or with your e-mail" | | |
| 8 | Sign-up link (if `canRegister`) | L :115-122 | GET `/register` | `Link` footer line | "Don't have an account?" / "Sign up" | |
| 9 | `status` flash (password reset done) | L :133 green div | prop `status` | `Alert variant="success"` above the form | | |
| 10 | Language switcher | AuthLayout top-right | PUT `/locale` | `headerEnd={<LanguageSwitcher/>}` in `AuthLayout` (already) | name "Language" | |
| 11 | Register: name, email, password, confirmation | R Form | POST `/register`; `resetOnSuccess=[password,password_confirmation]`, `disableWhileProcessing` | `RegisterForm` | `#name`, `#email`, `#password`, `#password_confirmation`, `data-test="register-user-button"` | Mockup "Team name" field: no back end -> not rendered (§6) |
| 12 | Email prefilled and read-only with a pending invitation | R :69-70 | prop `invitationEmail` | `TextField readOnly defaultValue` + helper "The invitation was sent to this address." (ScreenOnboarding) | `#email` | |
| 13 | `passwordrules` attribute | R | prop `passwordRules` | `PasswordField passwordrules` | | Keep on both password fields |
| 14 | Register SSO + login link | R | GET `/login` | same `SsoButtons`; footer "Already have an account?" / "Log in" | | |
| 15 | Forgot: email + submit | F Form | POST `/forgot-password` (`password.email`) | `ForgotPasswordForm` | `#email`, `data-test="email-password-reset-link-button"` | |
| 16 | Forgot: status text, return-to-login link | F | prop `status`; GET `/login` | `Alert success`; `Link` "Or, return to log in" (keep both strings) | | |
| 17 | Reset: read-only email, password+confirmation; token and email sent through `transform` | P | POST `/reset-password` (`password.update`) | `ResetPasswordForm`, `transform={(d)=>({...d, token, email})}` | `#email`, `#password`, `#password_confirmation`, `data-test="reset-password-button"` | `resetOnSuccess` both passwords |
| 18 | Verify: resend e-mail | V Form | POST `/email/verification-notification` (`verification.send`) | `Button variant="secondary"` in `Form` | text "Resend verification email" | |
| 19 | Verify: sent confirmation when `status === 'verification-link-sent'` | V | prop `status` | `Alert success` (same sentence) | | |
| 20 | Verify: log out link | V `TextLink href={logout()}` | POST `/logout` | `Link href={logout()} as="button"` (ghost) | text "Log out" | Link-as-POST kept |
| 21 | 2FA: 6-digit code | T `InputOTP` | POST `/two-factor-challenge` field `code`; `resetOnError` | `InputOTP name="code"` (`ui/input-otp`, `error` prop) + `OTP_MAX_LENGTH` from `hooks/use-two-factor-auth` | name `code`, "Continue" | digits only (`REGEXP_ONLY_DIGITS`), autofocus, `disabled` while processing |
| 22 | 2FA: toggle recovery-code mode, clears errors and code | T :114-122 | client | link-style `Button variant="link"` | texts "login using a recovery code" / "login using an authentication code" | `setLayoutProps` title/description stay (`Recovery code`, `Authentication code`) |
| 23 | 2FA: recovery code input | T | POST field `recovery_code` | `TextField name="recovery_code"` | placeholder "Enter recovery code" | `resetOnSuccess={!showRecoveryInput}` |
| 24 | Confirm password: passkey | C `PasskeyVerify routes=...` | GET `/passkeys/confirm/options`, POST `/passkeys/confirm` | `PasskeySignIn` with `routes`, `label`, `loadingLabel` props | "Confirm with passkey", "Confirming...", separator "Or confirm with password" | |
| 25 | Confirm password: password submit | C Form | POST `/user/confirm-password` (`password.confirm.store`); `resetOnSuccess` | `ConfirmPasswordForm` | `#password`, `data-test="confirm-password-button"` (`@confirm-password-button`) | Used by 4 browser files (Plan11b, Plan18d, AdminPagesVisual, Plan18d) |
| 26 | Invitation invalid (HTTP 404) | I :31-43 | prop `isInvalid` | `AccessNotice` (icon, title "Invitation", text) | text "This invitation link is no longer valid." | |
| 27 | Invitation expired / used | I | `isExpired` | `AccessNotice tone=destructive`: "This invitation has expired or was already used." | exact string | "Ask for a new invitation" button has no route: hint text only |
| 28 | Invitation card header | I Heading | props `workspaceName`, `email` | `InvitationCard`: workspace initial mark + "Join :workspace" + "This invitation was sent to :email." | | Inviter, team, member count, role, message = no data (§6) |
| 29 | Accept (logged in, matching e-mail) | I Form | POST `invitations/{token}/acceptance` (`InvitationAcceptancesController.store.form(token)`) | `LoadingButton lg` | text "Accept invitation" | + "Join :workspace as :name?" from shared `auth.user.name` (mockup variant) |
| 30 | Logged in with another e-mail | I | `isLoggedIn && !emailMatches` | `Alert destructive` + outline `Button` in `Form {...logout.form()}` | "You are logged in with another email address. Log out and sign in as :email to accept.", "Log out" | mockup "Not you? Switch account" = same logout form |
| 31 | Logged out: Log in / Create an account (if `canRegister`) | I | GET login / register (`@/routes`) | two `Button asChild Link` | "Log in", "Create an account" | Session `invitation_token` flow is server-side and untouched; do not add client state |
| 32 | Guest join: nickname + submit (retro, whiteboard) | `retros/join.tsx`, `whiteboards/join.tsx` Form | POST `join/{guestToken}` / `whiteboards/join/{guestToken}` (`RetroJoinsController.store`, `WhiteboardJoinsController.store`), `name` required max 50 | `GuestJoinPage` -> `GuestJoin` (`onSubmit` -> `router.post`/`useForm`) | `#name` (GuestJoin id), button text exactly "Join", fill by name `name` | `suggestedName` -> `initialName` (the user's own name, not random) |
| 33 | Guest join poker + spectator | `poker/join.tsx` | POST `poker/join/{guestToken}`; `spectator` boolean `1` | `GuestJoin` `children` = `Switch#spectator name="spectator" value="1"` + `Label` "Join as spectator"; read `formData.get('spectator')` | `#spectator` clicked, `aria-checked` true, text "Join as spectator" | Plan10b asserts `assertAriaAttribute('#spectator','checked','true')` (Radix Switch and Checkbox both set it; not verified in the plugin) |
| 34 | Guest join game | `games/join.tsx` | POST `play/{guestToken}` | `GuestJoin session={{kind:'game', title: roomName ?? t('Join a game'), gameLabel}}`, `defaultName=suggestedName` (random), `onRandomName` -> `router.reload({only:['suggestedName']})` | `#name` | "Another random nickname" is a mockup control; server regenerates `GuestNames::random` on each GET |
| 35 | Server error under the nickname | each join `InputError errors.name` | 422 | `error={{field:'name', message: errors.name}}` | | |
| 36 | Button disabled while processing | each join | | `processing` (button label becomes "Connecting to the session…") | | |
| 37 | Invalid link (4 pages, HTTP 404): heading + "This guest link is no longer valid." | each join | `isInvalid` | `AccessNotice` with the per-kind titles "Join a retrospective" / "Join a planning poker game" / "Join a game" / "Join a whiteboard" | exact string "This guest link is no longer valid." (asserted in 5 tests) | |
| 38 | Head title = session title or kind title | each join | | `<Head>` kept | | |
| 39 | Session ended + Log in | SE | GET `/login` | `AccessNotice` + `Button asChild Link` | "Your session has ended.", "Guests: ask the facilitator for the guest link.", "Log in" | Asserted in Plan06 and Plan17a |
| 40 | Throttle 429 on join POST | none | | none (Inertia default) | | unchanged, see D10 |
| 41 | New: guest "Already have an account? Log in" | none | GET `/login` | `GuestJoin loginUrl` | | mockup element, harmless |
| 42 | Errors 403/404/500/503 | framework default views | handler | `errors/error` page | texts per §4 | new (B15) |
| 43 | Fortify `registerView` 403 when signup closed | plain 403 | | 403 page | | first real consumer of the 403 page |

## 4. Composition

New containers (domain `auth`, `resources/js/components/auth/`; all take server shapes, no presentational component fetches):

| Container | Composes | Notes |
|---|---|---|
| `password-field.tsx` | `skrum/text-field` (`TextField` with `suffix` = ghost icon `Button`, `Eye`/`EyeOff`, `aria-label` Show/Hide password) | forwards `id`, `name`, `passwordrules`, `autoComplete`; replaces old `password-input` for auth |
| `sso-buttons.tsx` | `ui/button` `asChild` `<a>`, `ui/separator`; `SsoRedirectsController.show.url` | prop `providers: SsoProviderOption[]` (`{key:'google'\|'github'\|'entra'\|'oidc', label}`); returns null when empty |
| `passkey-sign-in.tsx` | `ui/button`, `ui/spinner`/`LoadingButton`, `usePasskeyVerify` | props `routes?`, `label?`, `loadingLabel?`, `separator?` as the old component; returns null when `!isSupported` |
| `auth-aside.tsx` | `skrum/retro-card`, `skrum/action-item`, display heading | promise "Meetings end, actions stay." + 2 tilted RetroCard + 1 ActionItem with static fixtures; `aria-hidden` + `inert`; goes in `AuthLayout aside`. RetroCard default DOM id `card-{id}` must not collide: pass `domId` unique |
| `access-notice.tsx` | `ui/card`, `ui/alert`, `ui/button`, lucide icon | props `{ icon, title, description, tone?: 'default'\|'destructive', action? }`; used by invalid/expired invitation, 4 invalid guest links, session-ended |
| `login-form.tsx`, `register-form.tsx`, `forgot-password-form.tsx`, `reset-password-form.tsx`, `two-factor-form.tsx`, `confirm-password-form.tsx` | Inertia `Form` + wayfinder `.form()` (`store.form()` from `@/routes/login`, `@/routes/register`, `email.form()`/`update.form()` from `@/routes/password`, `@/routes/two-factor/login`, `@/routes/password/confirm`, `send.form()` from `@/routes/verification`) + `TextField`/`PasswordField`/`Checkbox`/`LoadingButton` | pages stay thin: `<Head>` + container; `Page.layout = { title, description }` kept (strings are keys, new keys needed) |
| `invitation-card.tsx` | `access-notice`, `ui/avatar`/initial mark, `LoadingButton`, `Alert`, `Form` | props = the 8 invitation props + `auth.user` from `usePage()` (container only) |
| `guest-join-page.tsx` | `skrum/guest-join` | props `{ kind, title, gameLabel?, guestToken, storeUrl, suggestedName?, randomName?: boolean, children? }`; owns `useForm`, maps `errors.name` to `error`, `processing`, `onSubmit(data, formData)`; `loginUrl={login().url}` |
| `components/auth/error-page.tsx` (D9: or `components/errors/`) | `ui/button`, `ui/alert`, `BrandLogo`/`SkrumLogo`, `use-clipboard` (copy id, only if D3 accepted), lucide | props `{ status: 403\|404\|500\|503 }` plus shared `auth.user`, `brand`; no `EmptyState` (its illustrations are module-bound and its action row is internal) |

Adapters (server -> component props):
- `guestToken` -> `storeUrl`: `RetroJoinsController.store.url(guestToken)` etc. (same four wayfinder controllers).
- `retroTitle` | `gameTitle` | `boardTitle` | `roomName` -> `session.title`; `gameLabel` -> `session.gameLabel`; `suggestedName` -> `initialName` (retro, poker, whiteboard) or `defaultName` (game).
- `errors.name` -> `error: { field: 'name', message }`; `processing` -> `processing`.
- `GuestJoin.onSubmit(data, formData)` -> `form.transform(() => ({ name: data.name, ...(formData.get('spectator') ? { spectator: '1' } : {}) })).post(storeUrl)`.
- `status` (string) -> `Alert` text; verify-email maps `'verification-link-sent'` to the translated sentence (as today).
- Invitation: `isExpired`, `isLoggedIn`, `emailMatches`, `canRegister` -> one of five states (invalid, expired, accept, wrong account, logged out).
- Error page: `status` + exception class are all the server gives; copy by status code.

Hooks / lib reused as is: `useTrans`, `hooks/use-two-factor-auth` (`OTP_MAX_LENGTH`), `lib/brand` (`showsPoweredBy`), `@laravel/passkeys/react`. `useShortcut` not needed.

Composed from primitives (no dedicated component): password field, SSO button group, passkey button, access notice, aside, all error-page parts (illustration = geometric sticky-note + diaeresis, `w-40 h-27.5`, column colours, `aria-hidden`), copyable id field, invitation card.

New copy (four lang files, literal `t('…')`): login/register titles and descriptions of ScreenAuth, "or with your e-mail", aside promise and "Open source · self-hostable", error titles/descriptions/actions (EN text in ScreenErrors), "Join :workspace as :name?", "Not you? Switch account", "Another random nickname" etc. already exist in GuestJoin. Check `TranslationKeysTest` after.

## 5. Realtime

None in this group (inventory: no Echo in auth, invitation, join or session-ended pages). GuestJoin README's presence-colour read (`presence-session.{code}`) and `takenColors` are backlog: do NOT pass `takenColors` (the colour picker only renders when given), no channel is opened. Two-browser check for this group = guest context apart from member (`HarnessTest` "keeps a guest context apart") after joining through the new card.

## 6. Mockup elements not rendered / without mockup

Not rendered (spec §10 or no back end):
- Login: "Receive a magic link instead" button, mobile segmented "Magic link / Password" (18f slots: leave a `{/* slot */}`-free spot: the form footer and the mobile tab strip are plain `div`s a later commit fills), "magic link sent" variant, "Remember 30 days" wording, footer "Instance … v1.8.2" (no version shared prop; instance name only if D6 accepted), "Privacy · Terms" (no pages).
- Register: "Team name" field, "Free up to 10 participants" copy, terms acceptance sentence.
- Invitation: inviter avatar and name, team name and colour, member avatars and count, role sentence, inviter message, "Decline invitation" and the "declined" variant (no route), expiry date in the expired variant, "already in 2 teams" line, SSO block (page gets no `ssoProviders`, D2).
- Errors: "Instance status" and "Help" header links, ⌘K "Search sessions" button (18f), 403 request-access form, team block and admin list (backlog "access request from the 403 page"), 503 "Back at" block, admin message, auto-reload loader, 500 timestamp and ID unless D3.
- Guest: colour picker and taken colours, status/participants/facilitator/code lines (the join pages do not receive them), mobile sticky-bottom CTA (GuestJoin has no sticky mode; gap).
- Onboarding frames a/c (4 steps) and `OnboardingLayout` stay unused (knip in 18g will flag it: leave and report).

Designed from neighbours: forgot/reset/verify/2FA/confirm = ScreenAuth form pattern (title + description from `Page.layout`, `TextField`, full-width `lg` primary button, footer link). `AccessNotice` = ScreenOnboarding "expired link" variant. Session-ended = same notice with a Log in button. 404/500 for guests: primary action "Log in" instead of "Back to my teams".

## 7. Back-end changes

Only B15 is in this group.
- `bootstrap/app.php`, inside `withExceptions`: `Inertia::handleExceptionsUsing(fn (ExceptionResponse $r) => ...)`. Render `errors/error` with `['status' => $r->statusCode()]` and `withSharedData()` for 403, 404, 500, 503 only; return `null` otherwise. Guards: return `null` when `$r->request->expectsJson()` (retro/poker/game/whiteboard JSON endpoints answer 401/403/404/410 JSON and `retroRequest` depends on it; `shouldRenderJsonWhen` is already there) and, for 500/503, when `app()->hasDebugModeEnabled()` (keep Ignition). Pest: JSON 403/404 unchanged; HTML 404 -> `assertInertia(component 'errors/error', status 404)`; registration closed -> 403 page; guest 404.
- `pages/errors/error.tsx` is a new page file: the blade `@vite("resources/js/pages/{component}.tsx")` convention is satisfied by the file path.
- Gaps (report, not planned): X-Request-Id / error ID (none is logged today: grep found no request-id code), instance version in shared props, maintenance page (`php artisan down --render` needs a plain Blade view because the app is not booted; Inertia cannot render it), 419 and 429 pages, `ssoProviders` on `invitations/show`, an invitation decline route.

## 8. Browser tests

Binding to this group (all must stay green):

| Hook | Where used |
|---|---|
| `#email`, `#password`, `@login-button` (=`data-test="login-button"`) | `Support/InteractsWithBrowser::signIn` (every walkthrough), `Visual/AdminPagesVisualTest.php:38-40`, `Plan18dBrandingTest` (via signIn) |
| `/user/confirm-password`, `#password`, `@confirm-password-button` | `Plan11bApiTokensTest.php:27-29`, `Plan18dBrandingTest.php:28-30`, `AdminPagesVisualTest.php:46-48` |
| `assertPathIsNot('/login')`, then `/dashboard` redirect | `signIn` |
| `/login` for a guest navigating to `/dashboard` | `Smoke/HarnessTest` |
| `#name`, button text "Join" (`click('Join')`, plugin `getByText` exact), `fill('name', …)` | `joinAsGuest()` (`InteractsWithBrowser.php:31`), used by ~20 walkthroughs; `Plan13aGamesFoundationTest:145-153`, `Plan13dIcebreakerScoresInvitesTest:445,673`, `Plan12bIntegrationsSharingTest:128-131`, `Plan08dResultsTest:592`, `Plan17aWhiteboardCoreTest:375` (`assertNotPresent('#name')`) |
| `#spectator` click + `aria-checked` | `Plan10bPokerAdditionsTest.php:50-53, 226-229` |
| "This guest link is no longer valid." | Plan04:477, Plan10a:628, Plan13a:429, Plan17a:374,426 |
| "Your session has ended." + "Guests: ask the facilitator for the guest link." + "Log in" | Plan06:461-463, Plan17a:421-422 |

Tests that MUST change (mockup imposes: GuestJoin README "Join as a guest", "Your nickname", session card instead of a sentence):
- `Plan10aPokerCoreTest.php:255-256` (`'Choose the name other players will see.'`, `'Display name'`) -> `'Join as a guest'`/`'Your nickname'`; keep `'Sprint 12 estimates'` and `'Join as spectator'`.
- `Plan13aGamesFoundationTest.php:143-148` (sentence 'You are invited to play Hangman…', 'Display name', `$guest->value('#name')` is the random name) -> assert `'Hangman'` in `[data-slot="guest-join-game"]`, `'Your nickname'`, and read the random name from the `placeholder` (D6); `Plan13dIcebreakerScoresInvitesTest.php:444,672` sentence -> 'Hangman'.
No other existing test needs a change if ids and strings above hold. Feature tests (`tests/Feature/Auth/*`, `Retros`, `Poker`, …) assert component names and props only; the 131 files that use `assertForbidden/assertNotFound` keep their status codes.
`Plan18dBrandingTest`/`AdminPagesVisualTest` log in through the new form: first real proof of items 1 and 25.

New tests (`[P18e11-nn]`, new file `tests/Browser/Walkthroughs/Plan18eAccessTest.php`; plus Vitest and Feature):
- 01 login error shows under `#email`/`#password`, not as a toast; 02 login with remember; 03 2FA challenge: toggle to recovery code and back clears the field; 04 forgot password shows the status alert; 05 invitation: logged-out visitor sees Log in / Create an account, registering through `register` accepts it (existing server flow); logged-in matching e-mail accepts; wrong account shows Log out; expired and invalid notices; 06 guest join: empty name shows the server error, name > 50 blocked, poker spectator, game random-name button changes the placeholder; 07 error pages: unknown URL -> "Error 404" + action; closed registration -> 403 page; guest sees "Log in" action.
- Feature (Pest): handler returns Inertia for 403/404 HTML, JSON untouched, `X-Inertia` request gets the page, debug-mode 500 not intercepted.
- Vitest: `PasswordField` toggle; `SsoButtons` empty and per-provider; `PasskeySignIn` hidden when unsupported (mock hook); `InvitationCard` five states; `GuestJoinPage` submit mapping incl. spectator; `AuthLayout` centred variant (extend `layouts/skrum/auth-layout.test.tsx`); `ErrorPage` copy per status.
- Visual (`tests/Browser/Visual/AccessPagesVisualTest.php`, same pattern as `AdminPagesVisualTest`; public pages need no login): login, register, forgot, 2FA, invitation (5 states), join (4), error 404/403/500/503, FR+EN, 1440+390, light+dark, no overflow. Dev sections `pages/dev/sections/{auth,onboarding,guest-join}.tsx` exist as bench stubs: update them.

## 9. Risks and open questions

| Risk | Where |
|---|---|
| Exception handler also catches JSON endpoints (every live page calls `retroRequest` with `Accept: application/json` and reads 401/403/404/410) | new handler in `bootstrap/app.php`: must return `null` on `expectsJson()`. Not run |
| Handler for 500/503 runs `HandleInertiaRequests::share()` (queries workspaces, teams, notifications): a DB outage makes the error page itself fail | `app/Http/Middleware/HandleInertiaRequests.php:36-72`. Render 500/503 without `withSharedData()` and fall back to English when `translations` is absent, or wrap |
| `joinAsGuest` clicks the text "Join" with exact match; the pending label "Connecting to the session…" and the heading "Join as a guest" must not match another element | `InteractsWithBrowser.php:31-36`; GuestJoin `loading` state. Plugin exactness read from `GuessLocator` (`getByText($selector, true)`), not executed |
| `GuestJoin` has no random-name source for retro/poker/whiteboard (`suggestedName` is the user's name or null) | an empty submit posts an empty name and shows the server's "name required" error; old HTML `required` is gone (GuestJoin uses `noValidate`) |
| `GuestJoin` uses `initialName` only as initial state | `guest-join.tsx:`useState(initialName)`: reload of `suggestedName` does not change the field: so games must use `defaultName` (placeholder), which breaks `value('#name')` assertions (D6) |
| Aside fixtures use RetroCard/ActionItem whose DOM ids (`card-{id}`) could collide with nothing on these pages but must be inert | `aria-hidden` + `inert`; not an existing hook |
| Session `invitation_token` flow must not be touched; `invitations/show` re-sets it on every GET | `InvitationLinksController.php`; no client state |
| Shared files edited by this group: `app.tsx` (layout switch; 18d already modified it uncommitted), `lang/{en,fr,es,de}.json`, `frames.tsx` (variant), `layouts/skrum/auth-layout.tsx`, `types/ui.ts`, `bootstrap/app.php` | parallel conflicts, see §10 |
| `OnboardingLayout`/`OnboardingFrame` end up unused | knip in 18g |
| Brand/white-label: aside promise ("Open source · self-hostable") is Skrüm marketing copy shown on a rebranded instance | D4 |
| Mobile inputs 16px (iOS zoom), 48px touch rows from MobileAccess | check `ui/input` size classes; not verified |
| Passkey button cannot be exercised in jsdom or the browser harness (WebAuthn) | Vitest with mocked hook only |

### Decisions needed (product owner)

- D1. Add a `centered` variant to `AuthFrame`/`AuthLayout` for guest, invitation, notices (spec §6.3 lists only Auth and Onboarding layouts). Recommended yes.
- D2. Add `ssoProviders` to the `invitations/show` props so the invitation card can offer "Continue with SSO" like the mockup (back-end change not in §9). Without it: Log in / Create an account only.
- D3. 500 error ID: log and show a request ID (needs a request-id middleware, not in §9). Without it the 500 page omits the ID block.
- D4. Aside content on login/register: keep the Skrüm promise on a white-labelled instance, or show the brand logo only (the `AuthFrame` default).
- D5. "Remember me": keep (Laravel's cookie lasts far beyond the mockup's "30 days").
- D6. Games guest join: random nickname as placeholder with an empty field (mockup, needs the two test edits above) versus prefilled (keeps `value('#name')` tests, hides the "Another random nickname" button).
- D7. Instance admin maintenance page and the "Instance status"/"Help" links: a static Blade `errors/503` for `artisan down --render` (not Inertia, not in B15), or leave maintenance to Laravel's default.
- D8. Who owns `retros/session-ended` (this brief takes it: it is the generic notice for 4 session types and shares `AccessNotice`); the retro brief must then skip it.
- D9. Folder for the error container: `components/auth/` (proposed, spec §6.1 has no `errors` domain) or a new `components/errors/`.
- D10. 419 (page expired) and 429 (throttle) pages are not in B15: add to the handler or leave.

## 10. Size and parallelism

- Containers to write: 13 (`password-field`, `sso-buttons`, `passkey-sign-in`, `auth-aside`, `access-notice`, 6 forms, `invitation-card`, `guest-join-page`, `error-page`) plus `AuthFrame`/`AuthLayout` variant; 12 page files rewritten thin (11 existing + 1 new).
- Old files deleted: 2 layouts, `sso-buttons`, `passkey-verify`, `text-link`, old bodies of 12 pages (12 files rewritten); `AuthLayoutProps` type. Others postponed to 18g (see §2).
- Tests touched: 2 files edited (Plan10a, Plan13a) + Plan13d (2 lines); new: 1 browser walkthrough, 1 visual, ~7 Vitest files, 1-2 Feature files; lang files x4; 3 dev sections.
- Parallelism: can run in parallel with every group except through these shared files: `app.tsx` (one switch edit; do commit 1 first, or let the coordinator merge), `lang/*.json` (keys, merge by hand), `components/skrum/frames.tsx` + `layouts/skrum/auth-layout.tsx` (only this group), `bootstrap/app.php` (only this group), `types/ui.ts`. Group 2/3/6/7 briefs rewrite the session shells of their own join page: they must NOT also touch the four `*/join.tsx` pages or `session-ended.tsx` (this group does, via `GuestJoinPage`). Groups 9/10 own deletion of `password-input`, `input-error`, `heading` consumers.
- Not verified: anything executed (tests, builds), Switch vs Checkbox with `assertAriaAttribute`, `Inertia::handleExceptionsUsing` behaviour for non-Inertia HTML requests, `AuthLayoutProps` consumers outside the two layout files, whether `ui/input` already sets 16px on mobile.
