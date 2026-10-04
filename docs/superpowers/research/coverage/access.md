# Coverage: access (sign-in, registration, invitations, guest joins, onboarding)

Date: 2026-10-04. Branch `tests/coverage-access`. New file: `tests/Browser/Walkthroughs/CoverageAccessTest.php` (49 cases, `CA-*`), and `tests/Feature/Auth/PasskeyEndpointsTest.php` (4 cases).

Abbreviations: `AccessV` = `tests/Browser/Visual/AccessPagesVisualTest.php`, `CrossV` = `CrossCuttingVisualTest.php`, `OnbV` = `OnboardingVisualTest.php`, `GuestV` = `GuestPagesVisualTest.php`, `P18eA` = `Walkthroughs/Plan18eAccessTest.php`, `R25` = `Walkthroughs/Roadmap25InvitationsOnboardingTest.php`, `R26` = `Roadmap26AccountTest.php`, `R29` = `Roadmap29AdministrationTest.php`.

## Routes

| Route (GET) | Renders for the right person | Refused for the wrong one |
| --- | --- | --- |
| `/` | CA-01 (member → dashboard) | CA-01 (visitor → `/login`) |
| `login` | P18eA-11-01/02, AccessV, CrossV (magic link, SSO required) | CA-09 (signed in → app) |
| `register` | R25-11, R25-10, AccessV, OnbV P25-23-06 | CA-09 (signed in), CA-10 (invite-only instance: 403) |
| `forgot-password` | P18eA-11-04, AccessV | CA-09 (signed in) |
| `reset-password/{token}` | CA-07 (reset then sign in), AccessV | CA-07 (unknown token: field error) |
| `magic-link/{token}` | CA-02 (valid, "Continue" signs in), CA-23 (phone, dark) | CA-02 (used), CA-03 (expired, tampered signature), CA-04 (signed in → app), CrossV (invalid) |
| `two-factor-challenge` (TOTP and recovery) | P18eA-11-03, AccessV | CA-06 (no password first → `/login`) |
| `two-factor-challenge` (e-mail code) | CA-05 (wrong code refused, right code signs in), CrossV | CA-05 |
| `email/verify` | R25-11, AccessV | R25-11 (unverified sent there from `/dashboard`) |
| `email/verify/{id}/{hash}` | CA-08 (own link verifies) | CA-08 (another account's link: 403) |
| `user/confirm-password` | AccessV, R29, CA-P25-26 | (auth middleware, feature `PasswordConfirmationTest`) |
| `.well-known/passkey-endpoints` (JSON) | feature `PasskeyEndpointsTest` | — (public by design) |
| `passkeys/login/options` (JSON) | feature `PasskeyEndpointsTest` | feature (signed in: redirect) |
| `passkeys/confirm/options` (JSON) | feature `PasskeyEndpointsTest` | feature (visitor: 401) |
| `auth/{provider}/redirect` | CA-11, P18eA-11-08 (buttons point to it); feature `SsoLoginTest` (redirect) | feature `SsoLoginTest` (unknown or disabled provider) |
| `auth/{provider}/callback` | feature `SsoLoginTest`, `InvitationSsoTest`, R25-26 | feature `SsoLoginTest` |
| `invitations/{token}` | P18eA-11-05/08, R25-06/07/25, CA-P25-05, AccessV, OnbV | P18eA-11-05 (wrong account, expired, invalid), R25-07 (declined) |
| `invite/{token}` | R25-09, R25-10, OnbV | R25-09b (expired), CA-18 (unknown token, turned off), CA-19 (member → team page, no join counted) |
| `t/{slug}` | R25-22, CA-P25-22 | R25-22 (unknown slug 404), CA-17 (team of another workspace: 404) |
| `join` (session code) | R26-11, CA-15 (each of the five kinds), GuestV | R26-11 (unknown code), GuestV (too short) |
| `join/{guestToken}` (retro) | CA-12, Plan04, GuestV | CA-13 (member → session), CA-14 (closed, unknown), Plan04 (rotated) |
| `poker/join/{guestToken}` | CA-12, Plan10a | CA-13, CA-14, Plan10a (rotated) |
| `whiteboards/join/{guestToken}` | CA-12, WhiteboardVisual | CA-13, CA-14, Plan17a-06a |
| `play/{guestToken}` (game) | CA-12, Plan13a, Plan18eGames | CA-13, CA-14, Plan18e-06-03 |
| `surveys/join/{guestToken}` | CA-12, SurveyPagesVisual, Plan19 | CA-13, CA-14 |
| `onboarding` | R25-11/12/14/16/24/26, OnbV, R25-21a (phone), R25-dark, R25-fr | CA-16 (visitor → `/login`; member without onboarding → app), R25-14/24 (completed) |
| `reminder-unsubscribe/{user}` | CA-20 (stops the reminders) | CA-20 (tampered signature: 403) |
| `recap-unsubscribe/{user}` | CA-21, CrossV | CA-21 (tampered signature: 403) |
| `status` | R29-10/11, AdminAndErrorPagesVisual | — (public by design) |
| `about` | CA-22, Plan18d-05, AdminPagesVisual | CA-22 (visitor → `/login`) |
| `admin/sign-in` (default workspace card) | CA-P25-26 | CA-P25-26 (member: 403) |

Every new screen state above already has a phone, dark and English capture through the visual files (8 configurations each); CA-23 adds the valid magic link confirmation at 390 in dark.

## Mockups

| Mockup | Status | Notes |
| --- | --- | --- |
| ScreenAuth (login) | matches, open items | Open: footer "Instance · version" and "Privacy · Terms" (owner: backlog, "Powered by" kept). Extra in the app: passkey button, language switcher, "Join a session with a code" (later plans). "Stay signed in 30 days" kept as "Remember me": the remember cookie is not 30 days. Brand aside: the real `ActionItem` shows priority, "Done" and "Jira ·" where the mockup has only avatar and ticket (open, minor; shared component). |
| ScreenAuth (register) | matches | Subtitle "Free up to 10 participants" and the terms line are SaaS copy (not in a self-hosted instance); confirm-password field is an app addition. |
| ScreenAuth (magic link sent) | matches | "Open my mailbox" and "We sent a link to" ruled in plan 18f (V12, V13). |
| ScreenOnboarding (steps 1–4) | matches, open items | Open, already reported: step 3 lead sentence (the role helper carries it), header shows the language switcher, step 1 logo (P25-01), step 4 date (scheduling backlog). New, open: the French stepper says "Inviter" (mockup "Invitations"); one translation key serves the button and the step. **Fixed:** the team link is shown without `https://`, as `skrum.nordlys.fr/…` in the mockup. |
| ScreenOnboarding (invitation card b/d) | matches | Name field on the account form is S35 (account created on the card); "already in n teams" omitted (backlog); the host line top right is replaced by the language switcher. |
| GuestJoin | matches, open minor | "Another random nickname" is shown in every state (mockup: empty-nickname state only); privacy line wording differs (the app does not promise the nickname is deleted); avatar shows one initial ("N") where the mockup shows two ("NA"). |
| MobileAccess (login, guest join) | open | Login on a phone opens on the Password tab; the mockup opens on Magic link (a unit test asserts the Password default: owner decision). The mockup's phone login has a centred large mark and instance line; the app keeps the desktop header. The phone guest join of the mockup (session bar, large avatar, 6-column square swatches, people already in the room, docked button) is a different layout from the app's card: big, open. |
| ScreenLanding | open (big) | There is no landing page: `/` sends to the log in page (already reported). |
| InputOTP | matches, open minor | 3 + 3 slots and separator, focus, filled, error and disabled states match. Open: the error says "The provided two factor authentication code was invalid." without "2 attempts left" (the server does not send the count). |
| Emails (light and dark) | matches, open minor | Magic link, 2FA code, invitation, reminder, recap match their rulings (plan 18f V1–V11, V25, V26). Open: a team invitation has no team tile over the inviter's avatar (the mockup's overlay); the `dev/mail/invitation` sample only renders a workspace invitation. |

## Plan 25 acceptance criteria (browser-visible)

| # | Criterion | Test |
| --- | --- | --- |
| 1 | Workspace manager invites with or without a team | P18e-09-05, CA-P25-19 |
| 2 | Team inviter sends 1–20 invitations; field error per address; member 403 | R25-18, R25-12, CA-P25-02 (incomplete address, nothing sent); 403 and limits: feature `TeamInvitationsTest` |
| 3 | Race on two invitations | concurrency suite (not browser) |
| 4 | Invitation mail of a team | feature `WorkspaceInvitationMailTest`, CrossV (workspace sample) |
| 5 | Invitation page of a team / workspace invitation with message | R25-07, OnbV P25-23-07/08, CA-P25-05 |
| 6 | Accepting adds to workspace and team, opens the team page | R25-06, R25-25 |
| 7 | Decline, declined state, inviter's bell | R25-07, OnbV P25-23-09 |
| 8 | Team link created, replaced, turned off; member has no "Invite" | R25-18 |
| 9 | Joining by a usable link; expired link refused | R25-09, R25-09b, CA-18, CA-19 |
| 10 | Signed-out visitor of a link signs in or registers and comes back | R25-09, R25-10 |
| 11 | Registration without invitation opens onboarding step 1 | R25-11 |
| 12 | Step 1 creates or renames one workspace | R25-12, R25-16 |
| 13 | Step 2 team, slug derived or edited, slug errors | R25-12, R25-16 (taken), CA-P25-13 (wrong form) |
| 14 | Step 3 sends and shows the link; Skip | R25-12, R25-14 |
| 15 | Step 4 completes, New session dialog, dashboard link | R25-12, R25-14 |
| 16 | Resume after reload | R25-16 |
| 17 | Existing user with a workspace never sees the onboarding | CA-16 |
| 18 | Team page "Invite" for inviters; Members tab resend and revoke by a facilitator | R25-18, OnbV P25-23-13, CA-P25-18 |
| 19 | Workspace members page invites with team and message, lists team and status | CA-P25-19, P18e-09-05 |
| 20 | Bell names the team, no accept or decline | CA-P25-20, R25-07 |
| 21 | Captures in four languages, no overflow | OnbV, AccessV, R25-fr, R25-dark, R25-21a |
| 22 | Slug edit on the General tab; `/t/<slug>` | CA-P25-22, R25-22, CA-17 |
| 23 | Suites pass | (gates) |
| 24 | "Skip for now" at step 2 | R25-24 |
| 25 | Session-in-progress banner after joining | R25-06, R25-09, R25-25 |
| 26 | Default workspace set and cleared by an admin; SSO newcomer at step 2 | CA-P25-26, R25-26 |
