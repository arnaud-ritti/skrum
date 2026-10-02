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
