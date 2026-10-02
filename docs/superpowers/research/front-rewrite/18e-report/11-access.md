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
