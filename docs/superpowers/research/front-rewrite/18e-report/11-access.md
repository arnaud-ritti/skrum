# Group 11 — access

## Task 11.1 — shared auth components

Components of `resources/js/components/auth/`, shown on the bench at `/dev/design-system/auth`. No page uses them yet: 11.2 to 11.5 and 10.1, 10.2 wire them.

### Parity (rows of the brief this task covers)

| # | Behaviour | Control | Done |
|---|---|---|---|
| 2 | Show / hide password | `PasswordField`: ghost icon button in the field, named "Show password" / "Hide password", reachable by keyboard (the old `tabIndex={-1}` is gone) | yes |
| 5 | Sign in with a passkey, hidden without WebAuthn | `PasskeySignIn`: outline `lg` button, "Sign in with a passkey" / "Authenticating...", error under the button, success goes to `redirect` or `/dashboard` | yes (wired by 11.2) |
| 6 | SSO buttons per provider, full navigation | `SsoButtons`: `<a>` to `sso.redirect`; first provider full width and `lg`, the others in pairs | yes (wired by 11.2, 11.5) |
| 7 | Separator | `AuthSeparator`, "or with your e-mail"; one line only when a passkey button follows the SSO buttons | yes |
| 13 | `passwordrules` attribute | `PasswordField passwordrules` | yes (wired by 11.2, 11.3) |
| 24 | Confirm password with a passkey | `PasskeySignIn` with `routes`, `label`, `loadingLabel`, `separator` | yes (wired by 11.4) |

### Places left

None in these components. The magic-link places (D-29) belong to the login form of 11.2.

### Differences with the mockup (ScreenAuth, brand panel and sign-in buttons)

| Difference | Covered by |
|---|---|
| A paired provider shows its name alone ("Google"), as the mockup; its accessible name is "Continue with Google" | none needed: same as the mockup |
| The passkey button has no mockup element; it sits under the SSO buttons, above the separator | brief row 5 (existing feature kept) |
| The dot grid also shows in the 1.5rem margin around the panel (the frame draws it on the whole pane; the mockup draws it inside the panel only) | none: `AuthFrame` is not in this task's files |
| Notes are tilted by whole degrees (-2, 2, -1) where the mockup has -2.5, 1.5, -1: no arbitrary value (rule 3) | Global Constraints, rule 3 |
| The second card's vote button is not in its "mine" state: `RetroCard` then also shows the "your votes" dot and the remove button, which the mockup does not | none: reported |
| The sample action is the real `ActionItem`: completed state strikes the title and adds the priority and the "Done" badge; the ticket chip reads "Jira · ATLAS-1302" | none: reported |

## Task 11.2 — login and register

Pages `auth/login` and `auth/register` render `AuthLayout` (split) themselves and are in `ownLayoutPages`. Containers: `LoginForm`, `RegisterForm`, `BrandAside` (`resources/js/components/auth/`). Captures: `access-login-page-*`, `access-register-page-*`.

### Parity (brief 11 §3, rows 1–14)

| # | Behaviour | Control | Done |
|---|---|---|---|
| 1 | E-mail, password and remember sign-in | `LoginForm`: `#email`, `#password`, `#remember`, `data-test="login-button"` named "Log in"; `resetOnSuccess=['password']`; errors under the field | yes |
| 2 | Show / hide password | `PasswordField` | yes |
| 3 | Forgot link when `canResetPassword` | "Forgot your password?" at the end of the password label row; after the field in the tab order | yes |
| 4 | Remember label | checkbox "Remember me" (11-D5) | yes |
| 5 | Sign in with a passkey | `PasskeySignIn` under the SSO buttons | yes |
| 6 | SSO buttons per provider | `SsoButtons`; the company sign-on (OIDC, Entra) comes first | yes |
| 7 | Separator | "or with your e-mail" | yes |
| 8 | Sign-up link when `canRegister` | "Don't have an account?" / "Create an account" | yes |
| 9 | `status` flash | success alert above the buttons and the form | yes |
| 10 | Language switcher | `AuthLayout` header | yes |
| 11 | Register: name, e-mail, password, confirmation | `RegisterForm`: `#name`, `#email`, `#password`, `#password_confirmation`, `data-test="register-user-button"`; `resetOnSuccess`, `disableWhileProcessing` | yes |
| 12 | E-mail of a pending invitation prefilled and read-only | read-only field and "The invitation was sent to this address." | yes |
| 13 | `passwordrules` attribute | on both password fields | yes |
| 14 | Register SSO and login link | `SsoButtons`; "Already registered?" / "Log in" | yes |

### Places left

| Mockup element | Slot | Later |
|---|---|---|
| "Receive a magic link instead" button (ScreenAuth) | `LoginForm` prop `magicLink`, rendered in `[data-slot="login-magic-link"]` between the form and the sign-up line | plan 18f, B12 |
| "Magic link / Password" tab strip of the phone (MobileAccess) | `LoginForm` prop `methodTabs`, rendered in `[data-slot="login-method-tabs"]` between the separator and the form | plan 18f, B12 |

Nothing is rendered while the props are undefined.

### Differences with the mockup (ScreenAuth, MobileAccess)

| Difference | Covered by |
|---|---|
| "Remember me", not "30 days" | D-28, 11-D5 |
| No magic-link button, no tab strip | D-29 |
| No "Instance … · v1.8.2" and "Privacy · Terms" footer; the footer is the "Powered by Skrüm" line of `AuthLayout` | D-28 |
| Register: no "Team name" field, so the name takes the full row; no "Free up to 10 participants" sentence; no terms sentence | D-28 |
| Register title "Create your account", not "Create your workspace": registering creates a user, no workspace | F (false statement): to add to D-28 |
| Register keeps "Confirm password", which the mockup does not show | parity row 11 (the server validates the confirmation): reported |
| Password placeholder ":count characters minimum" is read from the server rule; none when the rule has no minimum | F: the mockup's fixed "12" is false outside production |
| The passkey button, absent from the mockup | brief row 5 (existing feature kept) |
| Register is a full split page with `lg` first SSO button and `lg` submit; the mockup draws it as a compact variant card | none: reported |
| Form column 24rem (`max-w-sm` of `AuthFrame`) for 23.75rem; title `text-2xl`; dot grid over the whole right pane | `AuthFrame` (not in this task's files): reported |
| 390: logo at the left of the header with the language switcher, not a centred 3.5rem logo with a back button; no "instance of the team" subtitle; the sign-up line is not pushed to the bottom | `AuthFrame`; N (no landing page behind, D-34): reported |
| 390: fields are 3rem high with 1rem text, as the mockup | — |
| Rebranded instance: the right pane shows the brand logo (or its name) only | 11-D4 |

## Task 11.3 — forgot password, reset password, e-mail verification

Pages `auth/forgot-password`, `auth/reset-password` and `auth/verify-email` render `AuthLayout` (split, with `BrandAside`) themselves and are in `ownLayoutPages`. Containers: `ForgotPasswordForm`, `ResetPasswordForm`, `VerifyEmailForm` (`resources/js/components/auth/`). Captures: `access-forgot-password-page-*`, `access-reset-password-page-*`, `access-verify-email-page-*`. `components/text-link.tsx` is deleted (no importer left).

### Parity (brief 11 §3, rows 15–20)

| # | Behaviour | Control | Done |
|---|---|---|---|
| 15 | Forgot: e-mail and submit | `ForgotPasswordForm`: `#email`, `data-test="email-password-reset-link-button"` named "Email password reset link", posts to `password.email`; the error under the field | yes |
| 16 | Forgot: status text, return-to-login link | success alert (`role="status"`) above the form; "Or, return to" / "log in" | yes |
| 17 | Reset: read-only e-mail, password and confirmation; token and e-mail sent through `transform` | `ResetPasswordForm`: `#email` (read-only), `#password`, `#password_confirmation`, `data-test="reset-password-button"`; `resetOnSuccess` both passwords; `passwordrules` on both | yes |
| 18 | Verify: resend the e-mail | secondary `lg` button "Resend verification email" in a form posting to `verification.send` | yes |
| 19 | Verify: confirmation when `status === 'verification-link-sent'` | success alert, same sentence | yes |
| 20 | Verify: log out | ghost button "Log out", an Inertia `Link` as a button posting to `/logout`, outside the resend form | yes |

### Places left

None: no mockup shows these three screens.

### Differences with the mockup

No mockup draws these screens; they follow the ScreenAuth form pattern (spec §7, "designed from neighbours"), so the differences of `AuthFrame` listed under Task 11.2 apply as they are.

| Difference | Covered by |
|---|---|
| The right pane repeats the login promise (or the brand alone on a rebranded instance) | 11-D4; no mockup: reported |
| The e-mail label is "Work email", as on login, where the old pages said "Email address" and "Email" | ScreenAuth label: reported |
| Reset: the password label is "New password" and its placeholder ":count characters minimum" is read from the server rule (the old placeholders "Password" / "Confirm password" repeated the labels) | reported |
| Forgot: `autocomplete="email"` where the old field had `off` | reported |
| Verify: "Log out" is a full-width ghost button, where the old page had an underlined link | brief row 20 |
| The read-only e-mail of the reset page looks like an editable field (`TextField` has no read-only style) | `skrum/text-field` (not in this task's files): reported |

## Task 11.4 — two-factor challenge and password confirmation

Pages `auth/two-factor-challenge` and `auth/confirm-password` render `AuthLayout` (split, with `BrandAside`) themselves and are in `ownLayoutPages`. Containers: `TwoFactorForm`, `ConfirmPasswordForm` (`resources/js/components/auth/`). Captures: `access-two-factor-page-*`, `access-two-factor-recovery-page-*`, `access-confirm-password-page-*`. `components/passkey-verify.tsx` is deleted (no importer left).

### Parity (brief 11 §3, rows 21–25)

| # | Behaviour | Control | Done |
|---|---|---|---|
| 21 | 2FA: 6-digit code | `InputOTP name="code"`, digits only, `OTP_MAX_LENGTH`, autofocus, disabled while the code is checked; two groups of three (InputOTP mockup); "Continue" posts to `two-factor.login`; the error under the code | yes |
| 22 | 2FA: switch to a recovery code and back, clearing the errors and the field | link-style button "login using a recovery code" / "login using an authentication code" after "or you can"; the page title and description follow the mode ("Authentication code", "Recovery code") | yes |
| 23 | 2FA: recovery code | `TextField name="recovery_code"`, placeholder "Enter recovery code", required; `resetOnSuccess` only in code mode, as before | yes |
| 24 | Confirm password with a passkey | `PasskeySignIn` on `/passkeys/confirm/options` and `/passkeys/confirm`: "Confirm with passkey", "Confirming...", separator "Or confirm with password"; hidden without WebAuthn | yes |
| 25 | Confirm password: password submit | `ConfirmPasswordForm`: `#password`, `data-test="confirm-password-button"` named "Confirm password", posts to `password.confirm.store`, `resetOnSuccess=['password']`; the error under the field | yes |

### Places left

None: no mockup shows these two screens.

### Differences with the mockup

No mockup draws these screens; they follow the ScreenAuth form pattern (spec §7) and the InputOTP mockup for the code. The differences of `AuthFrame` listed under Task 11.2 apply as they are.

| Difference | Covered by |
|---|---|
| The code is sent by itself at the sixth digit, and "Continue" is disabled while the code is incomplete; the old page did neither | InputOTP README ("submit automatically at the 6th digit", button disabled while incomplete) |
| A refused code stays in the field, selected and focused, where the old form asked for `resetOnError`; a refused recovery code is still reset | InputOTP README ("avoid: clearing the code on error without selecting it"): reported |
| No resend line, no "Use another email", no `mail-check` mark of the InputOTP verification card | N: a TOTP code is not sent; the e-mail code is plan 18f (B13) |
| The field label repeats the page title ("Authentication code", "Recovery code") | brief row 22 keeps the titles; a field needs its label: reported |
| The recovery code is typed in the mono font | ScreenSecurity (codes in `font-mono`) |
| The right pane repeats the login promise on a page reached while signed in (password confirmation) | 11-D4; no mockup: reported |
| Password confirmation: no placeholder (the old "Password" repeated the label) | same as Task 11.3 |

## Task 11.5 — accept-invitation card

Page `invitations/show` renders `AuthLayout variant="centered"` itself and is in `ownLayoutPages`. Container: `InvitationCard` (`resources/js/components/auth/invitation-card.tsx`), which reads the signed-in user from the shared props. Bench: `/dev/design-system/invitation`. Captures: `access-invitation-page-*` (logged out, with the three providers), `access-invitation-accept-page-*`, `access-invitation-wrong-account-page-*`, `access-invitation-expired-page-*`, `access-invitation-invalid-page-*`. Shared components touched, each in its own commit: `AccessNotice` has a `warning` tone; `AvatarStack` has a `total` prop and draws its "+N" over the avatar it overlaps.

### Parity (brief 11 §3, rows 26–31)

| # | Behaviour | Control | Done |
|---|---|---|---|
| 26 | Invalid link (HTTP 404) | `AccessNotice`: title "Invitation", "This invitation link is no longer valid."; no action | yes |
| 27 | Expired or used invitation | `AccessNotice tone="warning"`, clock mark. Past its last day: "This invitation has expired", "It was valid until :date.". Used before its last day: "Invitation", "This invitation has expired or was already used.". Hint: "Ask :name for a new link; nothing else to do.", or "Ask an administrator of :workspace for a new link." when the inviter's account is gone | yes |
| 28 | Card header | inviter's avatar (the workspace initial when the inviter is gone), ":inviter invited you to join :workspace" ("You are invited to join :workspace" without an inviter), three member avatars and "+N", ":count members · you join as :role"; the locked e-mail with "The invitation was sent to this address." (logged out) | yes |
| 29 | Accept, signed in with the invited address | "Join :workspace as :name?" with the account's avatar and e-mail; `LoadingButton lg` "Join :workspace" (`data-test="accept-invitation-button"`) posting to `invitations.acceptance.store`; "Not you? Switch account" (logs out) | yes |
| 30 | Signed in with another address | the account's avatar, name and e-mail; warning alert "You are logged in with another email address. Log out and sign in as :email to accept."; outline button "Log out" | yes |
| 31 | Logged out | `SsoButtons` (11-D2) and the separator, the locked e-mail, "Create an account" (`lg`, when `canRegister`) and "Already have an account? Log in"; "Log in" alone as the `lg` button when registration is closed. The session `invitation_token` flow is server-side and untouched | yes |

### Places left

| Mockup element | Slot | Later |
|---|---|---|
| Team mark over the corner of the inviter's avatar (and the team's name in the sentence) | `InvitationCard` prop `team`, rendered in `[data-slot="invitation-team"]` | IN-1 |
| The inviter's message under the members line | `InvitationCard` prop `message`, rendered in `[data-slot="invitation-message"]` | IN-2 |
| "Decline invitation" under a separator at the foot of the card (logged out), "Decline" beside "Join" (signed in) | `InvitationCard` prop `decline`, rendered in `[data-slot="invitation-decline"]` | IN-3 |

Nothing is rendered while the props are undefined. The bench shows the three places filled.

### Differences with the mockup (ScreenOnboarding, frames b and d and their variants)

| Difference | Covered by |
|---|---|
| No team name, colour or mark; the sentence names the workspace only | D-30 (IN-1) |
| No inviter's message | D-30 (IN-2) |
| No "Decline invitation" and no "declined" variant | D-30 (IN-3) |
| No "already in n teams" on the signed-in variant | D-30 |
| No password field and no "Create my account and join Atlas": the card links to the register page ("Create an account") and to the login ("Log in", not "Sign in") | plan 11.5 composition, brief row 31 (the session flow is not touched): no row, reported |
| Expired: no "Ask for a new invitation" button (no route); the sentence names the inviter | brief row 27: no row, reported |
| Expired: the inviter's full name, not the first name; the date follows the locale ("September 24" in English, "24 septembre" in French) and takes its year when it is not this year | reported |
| A used invitation that is not past its last day is not called expired | F (false statement) |
| The signed-in variants are states of the main card and keep its header (inviter, members, role); the mockup draws them as small separate cards | plan 11.5 composition: reported |
| "Join :workspace" is an `lg` full-width button, as the other access pages; the mockup's variant uses small buttons in a row | reported |
| "Signed in with another address" has no mockup; it follows the signed-in variant, with a warning alert and "Log out" | parity row 30 |
| The first provider button is `lg`, and the separator reads "or with your e-mail" | `SsoButtons` (Task 11.1) |
| The locked e-mail is a read-only field on the muted background at full opacity (the mockup dims it to 55 %): contrast rule | A |
| Page background is `background`, not the `skrum-canvas` of the mockup; the card is centred vertically, the mockup puts it under the header | `AuthFrame` centred variant (Task 0.7, not in this task's files): reported |
| Header: the logo and the language switcher; the mockup shows "skrum.nordlys.fr · Nordlys" at the right | `AuthFrame`; the workspace is named in the card: reported |
| The notices (expired, invalid) use the 28rem `AccessNotice` card with a 2.5rem mark and a `text-xl` title, where the mockup's variant card is 22rem with a 2.25rem mark | `AccessNotice` (Task 0.7): reported |
| 390: the card keeps its border and 1.25rem padding inside the frame's 1.5rem gutter, where the mockup says full width | `AuthFrame`: reported |

## Task 11.7 — error pages (B15)

`App\Http\ErrorPageResponder`, registered through `$exceptions->respond()` in `bootstrap/app.php`, renders the page `errors/error` for an HTML or Inertia request that meets 403, 404, 419, 429 or 500; a JSON request (`api/*` or `expectsJson()`) keeps its body. The page is in `ownLayoutPages` and renders `ErrorPage` (`resources/js/components/auth/error-page.tsx`, illustrations in `error-art.tsx`). `resources/views/errors/503.blade.php` is the static maintenance page. Captures: `access-error-{404,404-guest,403,419,429,500,503}-page-*`.

How the page gets its props:

- 403, 404, 419, 429: the shared props. A request that matched no route went through no route middleware, so the responder runs cookies, session, appearance and locale for it first: a signed-in visitor of an unknown URL is known, and reads the page in their language.
- 500: no shared prop. The page receives `status`, `requestId`, `occurredAt` (UTC), `locale` and `translations` (read from the language file, no database). In debug mode the framework page is kept.
- When the shared props cannot be built for another status, the page is rendered the same way, without them. When even that fails, the framework's own answer is returned.

### Parity (brief 11 §3)

| # | Behaviour | Control | Done |
|---|---|---|---|
| 40 | Throttle 429 on a join POST | the 429 page: "Too many requests", "You can retry in :seconds seconds." when the response carries `Retry-After`, "Try again" (reloads) | yes |
| 42 | Errors 403 / 404 / 500 / 503 | 404: "Back to my teams", or "Log in" for a guest. 403: the same, the account named in bold and "Switch account" (logs out) when signed in. 500: "Try again", "Back to my teams", the request id in a `code` element with "Copy" (named "Copy error ID", "Copied" for 2 s). 419: "Reload". 503: static view with "Retry now", a link to the current URL | yes |

### Places left

| Mockup element | Slot | Later |
|---|---|---|
| "Instance status" link (and "Help") at the end of the header | `ErrorPage` prop `headerLinks`, rendered in `[data-slot="error-page-links"]`; a Blade comment in the header of `503.blade.php` | AD-3 |
| Version after the instance name in the footer | `ErrorPage` prop `version`, rendered in `[data-slot="error-page-version"]`; a Blade comment in the footer of `503.blade.php` | AD-2 |
| Access request of the 403 page (team block, message, "Request access", team admins) | `ErrorPage` prop `accessRequest`, rendered in `[data-slot="error-page-access-request"]` between the text and the actions | AD-4 |
| "Search sessions ⌘K" of the 404 page | `ErrorPage` prop `search`, rendered in `[data-slot="error-page-search"]` after the first action | command palette (brief: 18f) |
| "Back at" block and admin's message of the 503 page | a Blade comment between the sentence and "Retry now" | AD-5 |

Nothing is rendered while the props are undefined.

### Differences with the mockup (ScreenErrors)

| Difference | Covered by |
|---|---|
| No "Instance status" and "Help" links; the footer shows the instance name without a version (the mockup shows the host name) | D-31 |
| 403: no team block, message field, "Request access" or team admins; the primary action is "Back to my teams" ("Log in" for a guest) | D-31 |
| 403: the title is "You don't have access to this page": the handler does not know that the refused page is a team (closed registration is a 403 too) | F: no row, reported |
| 404: no "Search sessions ⌘K" button | no row (the command palette is not built): reported |
| 404, 403: a guest gets "Log in" and a sentence without "your teams" | plan 11.7 |
| 500: the id is the request id (a UUID), in a field of 28rem where the mockup has 24rem, so that it fits on one line at 1440 | B36 |
| 500: no shared prop, so no instance name in the footer and the default logo on a rebranded instance | B15 |
| 503: no "Back at" block, no admin message | D-31 |
| 503: no "This page reloads by itself" line and no loader: the view has no script | F (B15: no script): no row, reported |
| 503: overline "Maintenance" (not "Scheduled maintenance"), the title names `config('app.name')` (not the host), no "installing version …": the view also serves every other 503 and reads no setting | F; B15 |
| 503: system fonts, the default logo and default colours: the view loads no asset and no brand | B15 |
| 419 and 429 have no mockup: same frame, the clock illustration of the maintenance view | 11-D7 / 11-D10 |
| The heading is an `h1` (the mockup's frames use `h2` inside a bench) | A |
| 390: no mockup frame; one column, 1rem padding, full-width stacked actions | ScreenErrors README, "Mobile" |

## Integration of wave 2a (2026-10-02)

Captures opened on the merged build: light 1440 and dark 390 of every access screen (login, register, forgot, reset, verify, two-factor, recovery, confirm password, the five invitation states, 403, 404, 419, 429, 500, 503), beside a rendering of `ScreenAuth`, `ScreenOnboarding`, `ScreenErrors`, `MobileAccess` and `InputOTP` (`preview.html` with the preview stylesheet injected; fonts and spacing tokens of the preview are approximate).

Fixed at the integration:

| Difference | Fix |
|---|---|
| Forgot password, 390, FR / ES / DE: the button label was cut ("Envoyer le lien de réinitialisation du mot d…") | shorter translations of "Email password reset link" |
| 500 page: the time under the id began with a separator ("· 2026-10-01 …") because a UUID always sends it to a second line | the separator is gone; the gap of the row separates them when they share a line |

Remaining differences:

| Difference | Fix later or deviation row |
|---|---|
| Register title, "Confirm password", no "Team name" | D-52 |
| Passkey button on login and password confirmation | D-53 |
| Invitation: links to register and login in place of the inline password; variants as states of the card; no "Ask for a new invitation" | D-54 |
| Error pages: 403 title, no search on 404, 503 wording, 419 and 429 without a mockup | D-55 |
| No magic link, no method tabs, no instance and version footer, no terms line, "Remember me" without "30 days" | D-28, D-29 |
| The footer of an error page and the title of the 503 page say "Skrum" (`APP_NAME`) while the logo says "skrüm" on a default install | fix later: one display name for the default brand (`isRebranded` already treats both as the product) |
| `AuthFrame`: 24rem column (23.75rem), dot grid over the whole right pane, at 390 the logo at the left with the language select instead of a centred mark and a back button | fix later, with a report first (the frame is shared, plan 18c) |
| Google and GitHub stack in one column at 390 (side by side at 1440, as the mockup) | fix later (no phone mockup shows them) |
| Aside: whole-degree tilts, the real `ActionItem` in its done state | stays (rule 3: no arbitrary value; real component) |
| The read-only e-mail of reset password looks editable (`TextField` has no read-only style) | fix later, in `skrum/TextField` |
| An Inertia request during maintenance shows the 503 page inside Inertia's modal | owner decision: full reload on a 503 |
