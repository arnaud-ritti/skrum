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

## Task 10.3 — appearance and notifications

Pages `settings/appearance` and `settings/notifications` render `SettingsShell` themselves and are in `ownLayoutPages`. Containers: `settings/appearance/appearance-card.tsx` (`AppearanceCard`, reads `use-appearance`), `settings/appearance/language-field.tsx` (`LanguageField`), `settings/notifications-card.tsx` (`NotificationsCard`); presentational: `settings/appearance/theme-picker.tsx` (`ThemePicker`). `appearance-tabs.tsx` is deleted; `language-switcher.tsx` stays (auth pages and session headers). Captures: `settings-appearance-page-*`, `settings-notifications-page-*`, `settings-notifications-reminders-off-*`. Walkthrough: `[P18e-10-06]`, `[P18e-10-07]`.

### Parity (brief 10 §3.3)

| # | Action | Control | Done |
|---|---|---|---|
| 28 | Theme Light / Dark / System | three `RadioGroupCardItem` in a radio group named "Theme" (order of the mockup: System, Light, Dark), each with a small board drawn in a nested `.light` / `.dark` scope, System with both halves; `use-appearance` unchanged (local storage, cookie, `html.dark`) | yes |
| 29 | Language | segmented `ToggleGroup` named "Language", built from the shared `locales` (four languages, each under its own name); PUT `locale.update` with `preserveScroll`; pressing the current language sends nothing | yes |
| 30 | Reminders by email | `Switch#action-item-reminders-by-email` in the "Email" column, named "Email me about due and overdue action items" | yes |
| 31 | Reminders in app | `Switch#action-item-reminders-in-app` in the "In-app" column, named "Show due and overdue action items in the notification bell" | yes |
| 32 | Save preferences | footer `LoadingButton` "Save" (10-D6); PATCH `notificationPreferences.update`, `preserveScroll`; the toast comes from the server | yes |
| 33 | Reminder time sentence | second line of the event, under "Action item reminders" | yes |
| 34 | Reminders off message | info `Alert` above the table; the switches stay usable | yes |

### Places left

| Mockup element | Slot | Later |
|---|---|---|
| "Reduce animations" row, under the language | `AppearanceCard` prop `reduceAnimations` (rendered after a separator in `[data-slot="appearance-reduce-animations"]`) | AC-5 |
| "Accessibility" card (`single_key_shortcuts`) | `AppearanceCard` prop `accessibility`, rendered under the Appearance card | plan 18f, B35 |
| Other notification events ("Retro recap", MN-1) | `NotificationsCard` builds its table from a list of `NotificationRow` (`event`, `description?`, `inApp?`, `email?`); a row with one channel leaves the other cell empty. A new event is one more entry of the list and one more field of `NotificationPreferences` | plan 18f (B34), MN-1 |

Nothing is rendered while the two slots are undefined.

### Differences with the mockup (ScreenUserSettings, Appearance and Notifications)

| Difference | Covered by |
|---|---|
| The sentence under "Appearance" is "The theme is kept on this device. The language is saved on your account.", not "Stored on this account, synced across devices.": the theme lives in the browser (local storage and a cookie) | rule 13, false statement: no row yet, reported |
| No "Reduce animations" row | D-25; place left |
| Four languages (English, Français, Español, Deutsch), the mockup has two; at 390 the control goes under its label | brief row 29 |
| The checked theme card has the outer 2px ring of `RadioGroupCardItem` around its border; the mockup has a 1px inner line. The card keeps the card background (not the soft primary of the component) as the mockup | `RadioGroupCardItem` (18c); the 2px focus ring of rule 5 shares that ring |
| At 390 the previews are 3.5rem high and the theme icon is hidden, so that "Système" and its radio fit a third of the card | README of the mockup ("3 colonnes compactes (aperçu réduit)") |
| One event, "Action item reminders", with the time of the reminders under it; the mockup has six events | D-25 |
| A "Save" footer under the table; the switches of the mockup save themselves | O: 10-D6 |
| At 390 the table keeps its head and its two columns (4rem each) instead of "label + 2 switches" rows without a head: with one event the columns fit | none: reported |
| An info alert above the table when the instance sends no reminders | parity row 34 |
| One page per section, the "Settings" title and the sub-navigation of 10.1 | Task 10.1 |

## Task 10.4 — API tokens with the inline creation form

Page `settings/api-tokens` renders `SettingsShell` itself and is in `ownLayoutPages`. Containers in `resources/js/components/settings/api-tokens/`: `CreateTokenForm` (the form of the page, `form[aria-label="New API token"]`), `TokenList` (the card under it, with the revoke confirmation), `RevokeTokenDialog`, `ServerUrl`; presentational: `NewTokenPanel`, `TokensTable`, `TokenCards`; `lib/api-tokens.ts` holds the scope labels and the date formatter. The three old dialogs (`create-token-dialog`, `new-token-dialog`, `revoke-token-dialog` of `components/settings/`) are deleted. Captures: `settings-api-tokens-page-*`, `settings-api-tokens-empty-*`, `settings-api-tokens-error-*`, `settings-api-tokens-new-token-*`. Walkthrough: `[P18e-10-04]`; `Plan11bApiTokensTest` follows the inline form (10-D2).

### Parity (brief 10 §3.4)

| # | Action | Control | Done |
|---|---|---|---|
| 35 | Show and copy the server URL | "MCP server" group: read-only mono field `#mcp-url` (selected on focus) and "Copy", which becomes "Copied" with a check (no toast) | yes |
| 36 | Notes | the two sentences, as a list under the field | yes |
| 37 | Open the creation form | none: the form is in the page (10-D2) | decided |
| 38 | Name | `TextField` `#token-name`, labelled "Token name", 60 characters; a refusal shows under the field, which takes the focus | yes |
| 39 | Scopes | group "Scopes": `#scope-read` (checked, disabled), `#scope-write`, `#scope-delete`, each with its code (`mcp:read`…) and its label; the help of the delete scope under it | yes |
| 40 | Team | `Select` `#token-team`, "All my teams" then the teams by workspace | yes |
| 41 | Expiration | `Select` `#token-expiration`, options as sent | yes |
| 42 | Submit | footer `LoadingButton` "Create token" with the plus icon | yes |
| 43 | Token shown once | `NewTokenPanel` in the card, in place of the footer: success box with "Copy your token now. You won't be able to see it again.", the mono field `input[aria-label="API token"]` (focused and selected), "Copy" / "Copied" | yes |
| 44 | Client snippets | tabs "Claude Code" / "Other clients (JSON)" named "Client configuration", one `[role="tabpanel"]`, "Copy configuration" | yes |
| 45 | Done | "Done" in the panel: the footer and "Create token" come back | yes |
| 46 | Token table | `Table`, the same eight columns in the same order (Name and hint, Scopes as badges, Team, Created, Expires, Last used, Status, Revoke) | yes |
| 47 | Expired row | muted row, outline badge "Expired"; "Active" otherwise | yes |
| 48 | Team no longer visible | "No access to this team anymore" under the team | yes |
| 49 | Empty state | key icon and "No API tokens yet." in the card | yes |
| 50 | Revoke | "Revoke" with the trash icon (named "Revoke :name"), then a destructive `ConfirmDialog` "Revoke this token?" | yes |
| 51 | MCP off | no entry, page 404 (unchanged, server side) | yes |
| 52 | Phone | the tokens as cards when the card is narrower than 42rem (container query); the table stays in the page, not displayed | yes |

### Places left

None: the task has no "Places left" line.

### Differences with the mockup (ScreenUserSettings, API tokens)

| Difference | Covered by |
|---|---|
| The table has eight columns (Name, Scopes, Team, Created, Expires, Last used, Status, action), not the mockup's four (Token with its scope codes, Last used, Expires, action); in the 50rem column the dates take two lines | plan, Task 10.4 ("eight columns in the same order", `Plan11bApiTokensTest`): no row, reported |
| Dates are absolute ("Sep 14, 2026"), not relative ("2 h ago", "in 90 days") | `Plan11bApiTokensTest` (`p11bCellShowsDate`): no row, reported |
| The scopes of a token are badges with their label ("Read"), not mono codes; the codes are in the form | `Plan11bApiTokensTest` (badges of the second cell): no row, reported |
| No struck-through "revoked" row | D-25 |
| A "Team" field beside name and expiration; three scopes (`mcp:read`, `mcp:write`, `mcp:delete`), reading always ticked | parity rows 39, 40 (N: the product's scopes) |
| The sentence under the title is "Connect an AI assistant that supports MCP to skrum with a personal token.", not "Personal tokens for the Skrüm REST API and MCP server. They act as you.": there is no REST API | rule 13, false statement: no row yet, reported |
| The success box says "Copy your token now. You won't be able to see it again." (the mockup: "Token created — copy it now, you won't see it again.") | `Plan11bApiTokensTest` P11b-02, P11b-18a: no row, reported |
| While the new token is shown the footer and "Create token" are replaced by the panel, which also holds the client configuration tabs, "Copy configuration" and "Done"; the mockup shows the box and the footer together | plan, Task 10.4; parity rows 44, 45 |
| `role="status"` is on the sentence of the box, not on the box (it holds a field and a button) | A |
| "Revoke" has a trash icon; the mockup's is a label alone | A: rule 6 |
| A "Status" badge (Active / Expired) and a "New" pill kept until "Done" | parity row 47; the mockup's "New" |
| An "MCP server" group under the tokens (server URL, its help and the two notes), which the mockup does not have | parity rows 35, 36 |
| An empty state in the list card | parity row 49 |
| At 390 a token card names its values (Team, Created, Expires, Last used) and has a "Revoke" button with a border | README of the mockup ("table des jetons en cartes") |
| One page per section, the "Settings" title and the sub-navigation of 10.1 | Task 10.1 |
