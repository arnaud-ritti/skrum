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

## Task 10.2 — security (password, two-factor, passkeys)

Page `settings/security` renders `SettingsShell` itself (with its own title, sentence and third crumb) and is in `ownLayoutPages`. Containers in `resources/js/components/settings/security/`: `PasswordCard`, `TwoFactorCard`, `PasskeysCard`, `SecurityStack`; presentational: `PasswordStrength` and `PasswordRules` (`password-strength.tsx`), `TwoFactorSetup`, `RecoveryCodes`. Captures: `settings-security-page-*`, `settings-security-two-factor-setup-*`, `settings-security-recovery-codes-*`, `settings-security-two-factor-on-*`. Walkthrough: `Plan18eSettingsTest.php` `[P18e-10-02]`.

Components extended: `SettingsCard` takes `header` (a row above the body) and `flush` (a body of full-width rows); `SettingsShell` takes `title` and `description`; `PasswordField` (11.1) takes `mark`, in its own commit.

### Parity (brief 10 §3.2)

| # | Action | Control | Done |
|---|---|---|---|
| 10 | Change password | Password card: three `PasswordField` (`#current_password`, `#password`, `#password_confirmation`), `passwordrules` kept, `@update-password-button` "Update password"; the three fields are emptied after an error and the refused field takes the focus; strength meter and the server's rule under the new password | yes |
| 11 | Enable 2FA | "Enable 2FA" in the footer of the card (badge "Off"), POST `two-factor.enable`, then the setup opens inside the card | yes |
| 12 | Load QR and key | QR code of Fortify in a `.light` box named "QR code for your authenticator app" (no `invert` filter); key in groups of four; skeletons while they load | yes |
| 13 | Copy the setup key | "Copy", then "Copied" with a check | yes |
| 14 | Continue setup | "Continue setup" after "Cancel", while the page still holds the QR code and the key | yes |
| 15 | Confirm with the code | `InputOTP` 3 + 3 named "Enter the 6-digit code", POST `two-factor.confirm`; the buttons are the mockup's "Cancel" and "Enable 2FA" (the old "Back" and "Confirm"); a refused code shows under the boxes, which are emptied and focused | yes |
| 16 | Recovery codes after enabling | step card "Save your recovery codes": warning, numbered codes, "Download .txt", "Copy", the checkbox "I have saved my recovery codes" before "Finish"; no Print (10-D3) | yes |
| 17 | View / hide recovery codes | "View recovery codes" / "Hide recovery codes" on the Recovery codes row, `aria-expanded`; skeleton while loading; the codes are fetched on demand, no longer when the page opens | yes |
| 18 | Regenerate codes | "Regenerate codes" while the codes are shown, with "Each recovery code can be used once. Regenerating them makes the old codes invalid." | yes |
| 19 | Disable 2FA | "Turn off 2FA" (the mockup's label; the old one was "Disable 2FA"), outline in the destructive colour with an icon, then a destructive `ConfirmDialog`; no code is asked | yes |
| 20 | Hide the 2FA block | no card when `canManageTwoFactor` is false | yes |
| 21 | Add passkey | "Add passkey" opens a `FormDialog` with `#passkey-name` (default "<Browser> on <OS>"), "Register passkey", "Cancel"; `usePasskeyRegister` unchanged; the refusal of the browser shows in the dialog | yes |
| 22 | Remove passkey | "Remove" with the trash icon (named "Remove :name"), then a destructive `ConfirmDialog` "Remove passkey"; the spinner of the dialog replaces "Removing..." | yes |
| 23 | Passkey line | name, authenticator badge, "Added :time · Last used :time" | yes |
| 24 | Empty state | key icon, "No passkeys yet", "Add a passkey to sign in without a password" (composed: `EmptyState` only has the six session modules) | yes |
| 25 | Unsupported browser | info `Alert` "Passkeys are not supported in this browser.", no button | yes |
| 26 | Hide passkeys | no card when `canManagePasskeys` is false | yes |
| 27 | Half-finished setup | nothing on the front side | yes |

### Places left

| Mockup element | Slot | Later |
|---|---|---|
| Active sessions card, under the passkeys | `SecurityStack` prop `activeSessions` | AC-2 |
| Linked accounts card, under the sessions | `SecurityStack` prop `linkedAccounts` | AC-3 |
| "Not found in known data breaches", in the rule list of the password card | `PasswordCard` prop `breachCheck` (an `li`, last of `[data-slot="password-rules"]`) | AC-6 |

Nothing is rendered while they are undefined.

### Differences with the mockup (ScreenSecurity)

| Difference | Covered by |
|---|---|
| No "Last changed 8 months ago": the description of the Password group is the sentence of the old page | D-25 |
| No "Other sessions are signed out when you change it." in the footer of the password card: the application does not sign the other sessions out | rule 13, false statement: no row yet, reported |
| The rule list is the server's rule (`passwordRules`), each part marked as the typed password meets it; not "12 characters / not found in leaks / different from your email" | plan, Task 10.2 (D-28's reason); the breach line is a place left |
| The meter has three levels (Weak, Good, Strong) on four segments; "Weak" is in the destructive colour; its hint says "more characters", not a count | plan, Task 10.2 (client-side estimate) |
| The match mark of the confirmation sits before the show / hide button, which the field keeps | none needed (the mockup draws one state) |
| The QR code is Fortify's picture: no logo in its centre | N: the server draws it |
| The six boxes are the `InputOTP` of the design system (two joined groups of three), not six separate boxes | `InputOTP/README.md` |
| The recovery codes card replaces the setup card after the code is accepted; the mockup stacks the three states for review | README of the mockup ("étape 3, juste après l'activation") |
| The warning says "Keep these codes somewhere safe." and does not say they are shown once: the member can view them again (parity row 17) | rule 13, false statement: no row yet, reported |
| 8 codes of 21 characters (Fortify's), so three columns at 1440 and one at 390, where the mockup has 10 short codes and two columns on a phone | N: the product's codes |
| No Print button | D-26 |
| Enabled state: no "last used", no "Change device", no "generated on"; the codes row has "View recovery codes" and, once shown, "Regenerate codes" | D-25; parity rows 17, 18 |
| "Turn off 2FA" does not ask for a code and its sentence does not say so | brief row 19 (the server asks for none): F |
| A card for the "Off" state before the setup (sentence of the old page, "Enable 2FA" in the footer): the mockup starts at the setup | parity row 11 |
| A Passkeys group, which the mockup does not have | parity rows 21–26 |
| No Active sessions, no Linked accounts | D-25; places left |
| The description under "Security" names what the page has ("Password, two-factor authentication and passkeys."), not "signed-in devices and linked accounts" | D-25 (F) |
| French badge "Activé" / "Désactivé", where the mockup has the feminine "Activée" / "Désactivée": the keys "On" and "Off" are shared | none: reported |
| Width of the page and place of the sub-navigation: those of the settings shell of 10.1 | Task 10.1 |
