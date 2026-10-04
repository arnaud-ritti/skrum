# Coverage: account (settings, security, administration)

Date: 2026-10-04. Branch `tests/coverage-account`. New file: `tests/Browser/Walkthroughs/CoverageAccountTest.php` (10 cases, `CAcc-*`). Feature test added: `tests/Feature/DemoSeederTest.php` (the demo admin is an instance admin).

Abbreviations: `R26` = `Walkthroughs/Roadmap26AccountTest.php`, `R29` = `Walkthroughs/Roadmap29AdministrationTest.php`, `P18e` = `Walkthroughs/Plan18eSettingsTest.php`, `P18d` = `Walkthroughs/Plan18dBrandingTest.php`, `P11b` = `Walkthroughs/Plan11bApiTokensTest.php`, `CA` = `Walkthroughs/CoverageAccessTest.php`, `SetV` = `Visual/SettingsPagesVisualTest.php`, `AdmV` = `Visual/AdminPagesVisualTest.php`, `AdmErrV` = `Visual/AdminAndErrorPagesVisualTest.php`, `DSV` = `Visual/DesignSystemVisualTest.php`. The visual files capture every state in 8 configurations (light/dark, 1440/390, en/fr) with an overflow check.

## Routes

| Route (GET) | Renders for the right person | Refused for the wrong one |
| --- | --- | --- |
| `settings` (one page: profile, photo, colour, delete account, password, 2FA, recovery codes, passkeys, sessions, linked accounts, appearance, shortcuts, notifications, API tokens, MCP URL) | P18e-10-01…10-08, R26-01…09, R26-12 (phone), R26-13 (dark), R26-14 (English), P11b, SetV | CAcc-01 (visitor → `/login`), CAcc-03 (retro guest → `/login`); feature `SettingsGuestAccessTest` |
| `settings/profile`, `settings/appearance`, `settings/notifications`, `settings/security`, `settings/api-tokens` (redirects to a section) | P18e-10-08 (each leads to its section), R26-01/04/05, P11b | CAcc-01 (visitor → `/login`), CAcc-03 (guest, `settings/security`) |
| `settings/linked-accounts/{provider}` | R26-07 (link Google, back to the row) | feature `LinkSocialAccountTest`, `LinkedAccountsTest` (unknown or disabled provider, other account) |
| `user/two-factor-qr-code`, `user/two-factor-secret-key`, `user/two-factor-recovery-codes` (JSON) | P18e-10-02, 10-03b, 10-03c (through the card) | feature `PasswordConfirmationGuardTest` (no fresh confirmation: 423) |
| `user/passkeys/options` (JSON) | P18e-10-05 | feature `PasswordConfirmationGuardTest` |
| `user/confirmed-password-status` (JSON) | feature `SecurityTest`, `SetPasswordTest` | Fortify `auth` middleware |
| `user/confirm-password` | R26, R29, P18d (every admin visit) | covered in `coverage/access.md` |
| `avatar-photos/{file}` | R26-02, SetV (photo shown) | feature `ProfilePhotoTest` (not a stored photo: 404; photos off: not offered nor shown; served cached and inert) |
| `avatars/{seed}.svg`, `avatars/{style}/{seed}.svg` | P18d-06, DSV avatar bench | feature `AvatarStyleTest`, `Retros/AvatarsTest` (unknown style) |
| `admin` (→ General) | R29-01, P18d-01 | CAcc-01 (visitor), CAcc-02 (workspace owner, not instance admin: 403) |
| `admin/general` | R29-01/03/14/15, AdmErrV | R29-01 (member 403), CAcc-01, CAcc-02 |
| `admin/branding` | P18d-01/03, P18e-00-01, P18e-RW-S2, CAcc-09, AdmV, AdmErrV | P18d-02 (member 403), CAcc-01, CAcc-02 |
| `admin/branding/preview` (JSON) | P18d (colour guard rail) | feature `BrandingSettingsTest`, `AdminAccessTest` |
| `admin/avatar-previews/{style}/{seed}.svg` | P18d-05 (tiles) | feature `AvatarPreviewsTest`, `AdminAccessTest` |
| `admin/sign-in` | CAcc-04 (direct visit by an admin who owns a workspace, no script error: the sweep's `toString` crash, fixed in 90c425a1, does not come back), CAcc-05 (OIDC saved, button on the login page), CA-P25-26, AdmErrV (stale confirmation, stored secret) | CA-P25-26 (member 403), CAcc-01, CAcc-02 |
| `admin/sign-in/confirm`, `admin/mail/confirm`, `admin/integrations/confirm` | AdmErrV (stale confirmation line), feature `SsoSectionTest`, `MailSectionTest`, `IntegrationSettingsTest` | feature `AdminAccessTest` |
| `admin/mail` | R29-04, AdmErrV | CAcc-01, CAcc-02 |
| `admin/integrations` | R29-05, CAcc-08, AdmErrV | CAcc-01, CAcc-02 |
| `admin/mcp-keys` | R29-06, AdmErrV | CAcc-01, CAcc-02 |
| `admin/licence` | R29-12, CAcc-06, AdmErrV | CAcc-01, CAcc-02 |
| `admin/users` | R29-07, R29-13 (phone), AdmErrV | CAcc-01, CAcc-02 |
| `admin/admins` | P18d-04, AdmV | CAcc-01, CAcc-02 |
| `admin/admins/candidates` (JSON) | P18d-04 (search) | feature `InstanceAdminsTest`, `AdminAccessTest` |
| `admin/audit-log` | R29-07, CAcc-07 (group and actor filters, empty match), AdmErrV | CAcc-01, CAcc-02 |

Observer role: not relevant (no account or admin route depends on a team role). Other team / other workspace: an instance admin section is instance-wide; a workspace owner who is not an instance admin is refused (CAcc-02).

## Mockups

Captures (outside the repo): previews rendered at 1440 with `app.css` and `_preview-bundle.css` (no `bundle.js` exists; lucide icons stay empty), the app captured through the visual files (light, 1440, en) and the `/dev/design-system` bench; none of the five previews has a dark variant (the dark mini-UI in the theme cards is drawn in both).

| Mockup | Status | Notes |
| --- | --- | --- |
| ScreenUserSettings | matches, open items already ruled | Ruled rows: P26-01 (no "card lock"), P26-13 (Remove photo / Use initials), D-78 (profile footer, appearance and API tokens sentences), D-25 (four of the six notification events, revoked-token rows), D-82/D-83 (token table and copy-once panel), D-130 (one long page, cards locked until the confirmation). App additions: passkeys card, Accessibility (single-key shortcuts), MCP server card, four languages. |
| ScreenSecurity | matches, open minor | Ruled: P26-02 (no "Last changed"), P26-03/04 (IP address, "Firefox on macOS", no location), P26-06 (linked date), D-26 (no Print), D-80 (turn off asks no code), D-95 (codes row), 8 Fortify codes instead of 10. Open minor (new): the password card says "Ensure your account is using a long, random password to stay secure" and the 2FA off state "When you enable two-factor authentication, you will be prompted for a secure pin…" (starter-kit copy, no mockup sentence; "pin" is not the mockup's "6-digit code"); the rule "Different from your email and name" is not shown (the server does not check it); the QR code has no logo in its centre. |
| AvatarStylePicker | fixed, open minor | **Fixed:** the member-choice switch has its help line "Otherwise the instance style applies to everyone, guests included." and the preview its label "Preview · <style>" (four languages). Open minor: the mockup's foot note "Guests: same style, seed = nickname + session…" is not shown; "Members can choose" where the mockup says "can pick"; the locked member view is a lock banner over a dimmed grid in the bench, while the profile shows no card at all when members cannot choose (mockup: "My avatar · Style set by the administrator" with a disabled button). Admin › Branding uses its own compact grid (ScreenBranding scope). |
| Avatar | matches | Sizes, presence colours 1–12, online / away dots, typing ring, guest and anonymous, stack with +N. Loading shows the initials pulsing (README: initials stay the fallback while loading; the preview draws an empty skeleton). |
| Sonner | fixed | Toasts (success, info with Undo, persistent warning with Now, error with Retry, collapsed stack) and the four alerts match in light and dark. **Fixed:** the reconnecting toast of the bench shows the warning-coloured trema after "Reconnecting in 4 s". |

## Plan 26 acceptance criteria (browser-visible)

| # | Criterion | Test |
| --- | --- | --- |
| 1 | Twelve colours, the current one selected, saved; 13 refused | R26-01; feature `PresenceColorTest` |
| 2 | Presence channels carry `presence` | feature (`Realtime`), R26-10 |
| 3 | Cursor, ring and stack use the presence colour | R26-10 (retro board, live, both sides); other session types: feature only |
| 4 | JPEG/PNG upload, GIF refused, metadata stripped, served headers | R26-02 (PNG accepted, GIF refused); feature `ProfilePhotoTest` (sizes, SVG, Exif, headers) |
| 5 | Photo in props / snapshot, Use initials, Remove photo, photos off, Branding switch | R26-02, R26-03, CAcc-09 (admin turns photos on, member gets the controls), AdmV (switch on); feature `ProfilePhotoTest`, `BrandingSettingsTest` |
| 6 | Reduce animations | R26-04 |
| 7 | Breach range endpoint | feature `PasswordBreachRangeTest` |
| 8 | Breached / clean password lines before saving | R26-05 |
| 9 | Sessions listed, newest first, this device | R26-06, SetV (three devices) |
| 10 | Sign out one, sign out the others | R26-06 |
| 11 | Other session driver: no card | feature `BrowserSessionsTest` |
| 12 | Link Google from the card | R26-07 |
| 13 | Unlink refused for the last way in | R26-07 (unlink), R26-08 (only identity kept); concurrency `SocialAccountUnlinkTest` |
| 14 | Identities managed by the admin under `sso_required` | R26-09 |
| 15 | No known password: no confirmation, "Set a password" | R26-08, SetV (SSO-only account) |
| 16 | Join pages: taken colours disabled, free one stored | R26-10; feature (`Sessions`) for 0/13 and the five kinds |
| 17 | Session code in the share dialog | R26-11 |
| 18 | `join` with a code in any case / without hyphen | R26-11, CA-15 |
| 19 | Four languages, captures without overflow | `InformalRegisterTest`, `TranslationKeysTest`, SetV, R26-12/13/14 |
| 21 | Rule S-1 both ways | R26-08 (no confirmation), P18e-10-02/03b (confirmation asked); feature `SetPasswordTest`, `PasswordConfirmationGuardTest` |

## Plan 29 acceptance criteria (browser-visible)

| # | Criterion | Test |
| --- | --- | --- |
| 1 | Non-admin 403 on every `admin/*`; admin asked to confirm | CAcc-02 (every section), R29-01, CAcc-01 (visitor) |
| 2 | Navigation order, `/admin` opens General | R29-02, R29-01 |
| 3 | Footer: update available / up to date / version alone | R29-02, CAcc-06 |
| 4 | General stores the sign-up mode and domains | R29-03 |
| 7 | SSO section saves a provider; the login page uses it | CAcc-05; feature `SsoSectionTest` (test the connection) |
| 8 | SMTP saved, masked password, failed test as a sentence | R29-04 |
| 9 | Integration turned off for every team, back on | R29-05 (connected team, confirmation), CAcc-08 (hidden from a team's integrations, shown again) |
| 10 | MCP keys listed and revoked | R29-06 |
| 11 | Users: deactivate, reactivate | R29-07 |
| 13 | Audit log lists, filters by group and actor | R29-07, CAcc-07 |
| 14 | 403 with the team block / plain 403 | R29-08, R29-09 |
| 15 | Request access, request sent after a reload | R29-08, R29-09 |
| 16 | Approve and decline from the bell | R29-08 (approve), CAcc-10 (decline: team unchanged, requester told live) |
| 17 | Bell texts | R29-08, CAcc-10 |
| 18 | 503 page with time of return and message | R29-11 |
| 19 | `/status`, also in maintenance; error pages link to it | R29-10, R29-11, AdmErrV |
| 20 | Version on error pages to signed-in users only | R29-10 |
| 22 | Four languages, captures without overflow | AdmErrV, AdmV, R29-13/14/15 |
| 26 | Rule S2: stale confirmation | AdmErrV (stale confirmation line); feature `SsoSectionTest`, `MailSectionTest` |
| 30 | Licence card AGPL-3.0 | R29-12 |
| 31 | Masked secret fields; e-mail fallback switch locked on | R29-04, CAcc-05 (secret never in the page), CAcc-04 (fallback switch checked and disabled) |

Criteria 5, 6, 12, 21, 23, 24, 25, 27, 28 and 29 are server-side (feature, concurrency and upgrade suites).

## Bugs found

- DemoSeeder granted no instance admin: `admin@skrum.test` is now one (fixed, `DemoSeederTest`).
- `/admin/sign-in` "Cannot read properties of undefined (reading 'toString')": already fixed on the branch (90c425a1); CAcc-04 proves the direct visit by an admin who owns a workspace now has no script error.
- Empty titles on `notifications` and `search`: not a bug, both are JSON endpoints (the sweep opened them as pages).
