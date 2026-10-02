# Group 10 — settings

## Task 10.1 — settings shell and profile

Page `settings/profile` renders `SettingsShell` itself and is in `ownLayoutPages`. Containers in `resources/js/components/settings/`: `SettingsShell`, `SettingsCard`, `ProfileCard`, `DeleteAccountCard`; `AvatarStyleCard` (18d) is unchanged. Captures: `settings-profile-page-*`, `settings-profile-unverified-*`, `settings-profile-delete-dialog-*`.

Shared components extended, each in its own commit: `SubNav` entries take an `icon` and the list is sticky on a wide screen, with the mockup's active style (accent background, semibold label, primary icon); `FormDialog` takes `submitTest`, the `data-test` of its submit button.

### Parity (brief 10 §3.1)

| # | Action | Control | Done |
|---|---|---|---|
| 1 | Edit name | `TextField` `#name` in the Profile card, `autoComplete="name"`, error under the field | yes |
| 2 | Edit e-mail | `TextField` `#email`, labelled "Email"; "Verified" badge in the field when `email_verified_at` is set | yes |
| 3 | Save profile | footer `LoadingButton` "Save", `data-test="update-profile-button"`, `preserveScroll`; the toast comes from the server | yes |
| 4 | Resend verification | warning alert "Your email address is unverified." with the button "Click here to re-send the verification email."; success alert once `status` is `verification-link-sent` | yes |
| 5 | Avatar style card | `AvatarStyleCard`, unchanged, under the Profile group | yes |
| 6 | Delete account (open) | destructive button with the trash icon, `data-test="delete-user-button"`, in the tinted card | yes |
| 7 | Delete account (confirm) | `FormDialog tone="destructive"` with `PasswordField` `#password`; submit `data-test="confirm-delete-user-button"`; a refusal (wrong password, last instance admin) shows under the field, which takes the focus | yes |
| 8 | Cancel delete | "Cancel" of the dialog; the refusal is forgotten | yes |
| 9 | Settings sub-navigation | `nav[aria-label="Settings"]`: Profile, Security, Appearance, Notifications, and API tokens when `features.mcp` | yes |

### Places left

| Mockup element | Slot | Later |
|---|---|---|
| Twelve presence colours and their help line, beside the avatar | `ProfileCard` prop `presenceColours`, first child of `[data-slot="profile-identity"]` | AC-4 |
| "Upload photo" / "Use initials", under the colours | `ProfileCard` prop `photo`, second child of `[data-slot="profile-identity"]` | AC-1 |

`[data-slot="profile-identity"]` is not rendered while both are undefined.

### Differences with the mockup (ScreenUserSettings, Profile and Delete account)

| Difference | Covered by |
|---|---|
| No presence colours, no "Upload photo", no "Use initials": the avatar stands alone on its row | D-25 |
| The footer sentence is "A changed email address has to be verified again.", shown only when the instance verifies addresses; the mockup says "Changing your email sends a confirmation link.", which is false: the server clears the verification and sends nothing until the member asks | rule 13, false statement: no row yet, reported |
| One page per section; the mockup stacks Profile, Appearance, Notifications and API tokens on one long page for review | README of the mockup ("une page par sous-nav") |
| The sub-navigation is named "Settings" (the mockup of this screen says "Settings sections") | Task 0.8, `Plan11bApiTokensTest`, ScreenSecurity |
| The "Avatar style" group (18d, no mockup on this screen) sits under the Profile group, in its 18d form without a card | brief 10 §1 (excluded from this lane) |
| The warning about an unverified address and the "link sent" confirmation have no mockup element | parity row 4 |
| Sub-navigation column 13.5rem as the mockup; entries 2.25rem high below `lg` (touch), 2.125rem above | none needed |
| No search field in the topbar | the application topbar, not this screen |
| Below `lg` the sub-navigation is the shared horizontal list | O: 10-D5 |
