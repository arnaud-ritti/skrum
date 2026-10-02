# Brief 10 — SETTINGS (plan 18e, spec §7 row 10)

Research only. Read at HEAD f8ea376d with 18d's uncommitted work in the tree. Not verified: no build, no test run, no browser run; hooks `use-two-factor-auth` and `passkey-register` internals read in part only; Fortify/Passkeys JSON shapes taken from the inventory.

## 1. Scope

| Page | Route (name) | Props (unchanged) | Layout today | Layout target |
|---|---|---|---|---|
| `pages/settings/profile.tsx` | GET `/settings/profile` (`profile.edit`) | `mustVerifyEmail, status?, avatarMemberChoice, avatarStyle, instanceAvatarStyle, avatarStyles` (18d added the last four) | AppLayout > old SettingsLayout (app.tsx `settings/` case) | `SettingsShell active="profile"` |
| `pages/settings/security.tsx` | GET `/settings/security` (`security.edit`, RequirePassword) | `passwordRules, canManageTwoFactor, canManagePasskeys, passkeys[], twoFactorEnabled?, requiresConfirmation?` | same | `SettingsShell active="security"` |
| `pages/settings/appearance.tsx` | GET `/settings/appearance` | none (shared `locale, locales`) | same | `SettingsShell active="appearance"` |
| `pages/settings/notifications.tsx` | GET `/settings/notifications` | `preferences{action_item_reminders_by_email,_in_app}, reminderTime, remindersEnabled` | same | `SettingsShell active="notifications"` |
| `pages/settings/api-tokens.tsx` | GET `/settings/api-tokens` (`apiTokens.index`, RequirePassword, MCP flag) | `tokens, teams (RENAME), mcpUrl, expirationOptions, defaultExpiration`, flash `newToken` | same | `SettingsShell active="apiTokens"` |
| `pages/teams/integrations.tsx` | GET `w/{workspace}/teams/{team}/integrations` (`teams.integrations.index`, manager only) | `workspace, team, providers[], telegram, mattermost, webhookEvents, pollMinutes` | default AppLayout | `TeamSettingsShell` (AppLayout `active="settings"` + SettingsLayout) |

Excluded (done by 18d, do not touch): `admin/branding`, `admin/admins`, `/about`, `components/admin/**`, `components/about/**`, `components/settings/avatar-style-card.tsx` (+ test) which is the 18d "avatar style card" and stays as is, only re-hosted by the new profile page. Align with `components/admin/admin-shell.tsx`: page wraps itself `<AppLayout active breadcrumbs><SettingsLayout title description navLabel nav>`; `app.tsx` returns `null` for these pages.

Layout switch (shared file, `resources/js/app.tsx`): `name.startsWith('settings/')` currently returns `[AppLayout, SettingsLayout]` from the OLD `@/layouts/app-layout` and `@/layouts/settings/layout`. Change to `return null` (same as `admin/`), add `case name === 'teams/integrations': return null`. Remove both imports if no other page group still uses them (other groups still use old `AppLayout`: leave that import).

Mockups: `ScreenUserSettings` (Profile, Appearance, Notifications, API tokens; mobile: sub-nav list then page), `ScreenSecurity` (password, 2FA, sessions, linked accounts; mobile: sub-nav as Select), `ScreenSettings` frame a (team settings: sub-nav Général / Membres & rituels / Intégrations / Données & export, cards `.st-card` with grey footer, integration row `.st-int`). `AvatarStylePicker` README (already used). Mobile boards: none for settings beyond the notes above.

Sub-navigation: the mockups say `.sk-subnav` "Compte", never a second sidebar (spec 6.3, ruling 14). Existing `skrum/sub-nav.tsx` is a horizontal scroll list below `lg`; the mockup wants a `Select` on mobile for Security. Keep `SubNav` as 18d did (consistency with admin); do not add a Select variant (see Decisions 5).

## 2. Commits (one branch, in this order; each deletes its old files)

| # | Commit | New | Deletes |
|---|---|---|---|
| 1 | `feat(settings): settings shell and profile` | `components/settings/settings-shell.tsx`, `profile-card.tsx`, `delete-account-card.tsx`; page `profile.tsx` rewritten; `app.tsx` switch; dev section `settings-profile.tsx`; lang keys | `layouts/settings/layout.tsx`, `components/delete-user.tsx` |
| 2 | `feat(settings): security (password, two-factor, passkeys)` | `components/settings/security/password-card.tsx`, `two-factor-card.tsx`, `two-factor-setup.tsx`, `recovery-codes.tsx`, `passkeys-card.tsx` (+ `passkey-row`, `passkey-register`) | `manage-two-factor.tsx`, `two-factor-setup-modal.tsx`, `two-factor-recovery-codes.tsx`, `manage-passkeys.tsx`, `passkey-item.tsx`, `passkey-register.tsx`, `alert-error.tsx` (orphan once the two 2FA files go: verify with grep) |
| 3 | `feat(settings): appearance and notifications` | `settings/appearance/theme-picker.tsx`, `language-field.tsx`, `notifications-card.tsx` | `appearance-tabs.tsx` |
| 4 | `feat(settings): API tokens, and the page prop teams renamed` | `settings/api-tokens/*` (server-url, tokens-table, token-rows-mobile, create-token-form, new-token-panel, revoke-token-dialog); back end rename (section 7) | `settings/create-token-dialog.tsx`, `new-token-dialog.tsx`, `revoke-token-dialog.tsx` |
| 5 | `feat(integrations): team settings shell, provider card and chat channels` | `integrations/team-settings-shell.tsx`, `provider-card.tsx` (card + status), connect/test/disconnect actions, Slack, Telegram, Teams/Mattermost | `integration-card.tsx`, `integration-status-badge.tsx`, `integration-details.tsx` folded into `provider-card.tsx`; `slack/telegram/url-channel`, `integration-actions`, `disconnect-integration-dialog` rewritten in place |
| 6 | `feat(integrations): outgoing webhook, deliveries and redelivery` | rewritten in place: `webhook-integration`, `webhook-secret`, `webhook-events-panel`, `webhook-deliveries-panel`, `webhook-delivery-dialog` | none outright |
| 7 | `feat(integrations): trackers (Jira, Jira Data Center, Linear, GitHub) and their panels` | rewritten in place: `jira-*`, `jira-data-center-*`, `jira-token-dialog`, `linear-integration`, `github-*`, `people-panel`, `account-picker-dialog`, `priorities-panel`, `status-sync-section`, `status-mapping-panel`, `story-points-field` | none outright |
| 8 | `test(settings): browser walkthrough, visual captures, dev bench` | `tests/Browser/Walkthroughs/Plan18eSettingsTest.php`, `tests/Browser/Visual/SettingsPagesVisualTest.php`, `pages/dev/sections/settings-*.tsx` | none |

Kept (still imported elsewhere, NOT deleted here): `components/integrations/share/{delivery-lines,post-link-section}.tsx` (retro/poker/games dialogs), `lib/integrations.ts`, `types/integrations.ts`, `components/confirm-form-dialog.tsx` (teams/show, workspaces), `language-switcher.tsx` (auth, session headers), `password-input.tsx` and `passkey-verify.tsx` (auth pages), `hooks/use-two-factor-auth.ts` (auth/two-factor-challenge), `heading.tsx`, `input-error.tsx`. Re-check each with grep at delete time; group 11 (auth) may still need them.

## 3. Parity table (old front → new)

Hooks column: `@x` = `data-test`. "(none)" = no browser test binds it, but keep the name anyway for the English accessible name.

### 3.1 Profile (inventory pages "settings/profile")

| # | Action | Old control | Route / event | New control | Hook | Note |
|---|---|---|---|---|---|---|
| 1 | Edit name | `Input#name` (profile.tsx) | PATCH `profile.update` | `TextField` id `name`, in Profile card | `#name` | autoComplete name, error from `errors.name` |
| 2 | Edit email | `Input#email` | same | `TextField` id `email` + Badge "Verified" when `email_verified_at` | `#email` | badge is new (mockup), uses existing prop |
| 3 | Save profile | `Button` `@update-profile-button` | same form | card footer `LoadingButton` | `@update-profile-button` | `preserveScroll`; flash toast "Profile updated." comes from server |
| 4 | Resend verification | `Link as=button` "Click here to re-send the verification email." | POST `verification.send` | same text, in an `Alert` (warning) under the email field | text | shown if `mustVerifyEmail && email_verified_at===null`; status `verification-link-sent` shows the success line |
| 5 | Avatar style card | `AvatarStyleCard` (18d) | PATCH `profile.update` `{avatar_style}` | unchanged component, placed under Profile card | `[data-slot="avatar-style-card"]`, `@update-avatar-style-button`, tile `[data-slot="avatar-style-tile"]` | P18d-06 binds it |
| 6 | Delete account (open) | `@delete-user-button` | none | `Button` destructive + `Trash2` icon in the danger card | `@delete-user-button` | mockup: tinted card, triangle icon in `skrum-destructive-soft`, consequences text |
| 7 | Delete account (confirm with password) | `Dialog` + `PasswordInput#password` + `@confirm-delete-user-button` | DELETE `profile.destroy` | `FormDialog tone="destructive"` (`skrum/confirm-dialog.tsx`) wrapping `PasswordInput#password`; `error` prop for `errors.password` | `@confirm-delete-user-button`, `#password`, "Delete account" | FormDialog gives `onSubmit(FormData)`; use Inertia `router.delete` with the password; focus the field on error; sole-owner refusal comes back as `errors.password` (ProfileDeleteRequest) |
| 8 | Cancel delete | `DialogClose` "Cancel" | none | FormDialog cancel | "Cancel" | |
| 9 | Settings sub-nav | old `layouts/settings/layout.tsx` `nav[aria-label=Settings]` | links | `SettingsLayout` nav (`SubNav`) | `nav[aria-label="Settings"]`, link texts Profile, Security, Appearance, Notifications, API tokens | API tokens entry only when shared `features.mcp` (P11b-17 asserts absence) |

### 3.2 Security

| # | Action | Old control | Route / event | New control | Hook | Note |
|---|---|---|---|---|---|---|
| 10 | Change password | `Form` current/new/confirm + `@update-password-button` | PUT `user-password.update` | Password card, 3 `PasswordInput` (kept component) in `Field` rows | `#current_password`, `#password`, `#password_confirmation`, `@update-password-button` | `resetOnError/Success`, focus on the invalid field kept; `passwordrules` attr kept; strength meter, breach rule list NOT rendered |
| 11 | Enable 2FA | `Form enable` button "Enable 2FA" | POST `two-factor.enable` | 2FA card (badge "Disabled" → button) | "Enable 2FA" | then open setup (inline, see Composition) |
| 12 | Load QR + key | `useTwoFactorAuth.fetchSetupData` | GET `two-factor.qr-code`, `two-factor.secret-key` | setup panel: QR in a `.light` box (class exists, LightScopeTokensTest) with `aria-label`, key in mono groups of 4 | none | keep `dangerouslySetInnerHTML` of Fortify SVG; remove the dark-mode `invert` filter, the `.light` scope replaces it |
| 13 | Copy setup key | `useClipboard` | clipboard | "Copy" button, check icon after | "Copy" | |
| 14 | Continue setup (data fetched, modal closed) | button "Continue setup" | client | same label when `hasSetupData` and not enabled | "Continue setup" | |
| 15 | Confirm with 6-digit code (when `requiresConfirmation`) | `InputOTP` + "Confirm"/"Back" | POST `two-factor.confirm`, error `confirmTwoFactorAuthentication.code` | `ui/input-otp` 6 slots (3 | 3) inside `Form` | "Confirm", "Back" | OTP_MAX_LENGTH from the hook; paste of full code works (primitive) |
| 16 | Show recovery codes after enabling | `TwoFactorRecoveryCodes` | GET `two-factor.recovery-codes` | step 3 grid of codes + `Alert` "shown once" + "Copy" + "Download .txt" + checkbox "I saved my codes" gating "Finish" | none | mockup step; Copy/Download/gate are client-only; Print optional |
| 17 | View / Hide recovery codes (enabled) | buttons "View recovery codes"/"Hide recovery codes" | GET (also on mount) | same two buttons in the "enabled" state, skeleton while loading | text | |
| 18 | Regenerate codes | "Regenerate codes" | POST `two-factor.regenerate-recovery-codes` then refetch | same, only while codes visible | text | mockup says regenerating invalidates old ones: add that sentence |
| 19 | Disable 2FA | `Form disable` destructive "Disable 2FA" | DELETE `two-factor.disable` | `ConfirmDialog tone="destructive"` or outline-destructive `Button` with icon; keep exact label | "Disable 2FA" | old front had no confirmation; mockup asks for a code, but the back end only needs the password confirmation already done: do NOT ask a code (gap) |
| 20 | Hide 2FA block | `canManageTwoFactor` false → null | props | same | none | |
| 21 | Add passkey | `PasskeyRegistration` (name form, default "<Browser> on <OS>", "Register passkey"/"Cancel") | GET `/user/passkeys/options`, POST `/user/passkeys`, then `router.reload()` | Passkeys card, "Add passkey" opens `FormDialog` with name field (same default) | "Add passkey", "Register passkey", "Cancel" | keep `usePasskeyRegister` as is |
| 22 | Remove passkey | `PasskeyItem` trash + `Dialog` "Remove passkey" | DELETE `passkey.destroy` | row action "Remove" (sr-only text kept) + `ConfirmDialog` destructive, "Removing..." state | "Remove", "Remove passkey" | |
| 23 | Passkey list line | name, authenticator badge, "Added :time / Last used :time" | props `passkeys[]` | list rows in a card (`Badge` for authenticator) | none | |
| 24 | Empty state | `EmptyState` local component | props | `skrum/empty-state` small, "No passkeys yet" + hint | text | |
| 25 | Unsupported browser | "Passkeys are not supported in this browser." | WebAuthn check in passkey-register | same message in an `Alert` | text | keep the check |
| 26 | Hide passkeys | `canManagePasskeys` false | props | same | none | |
| 27 | Half-finished setup | server `ensureStateIsValid()` | none | none | none | nothing to do front side |

### 3.3 Appearance, notifications

| # | Action | Old control | Route / event | New control | Hook | Note |
|---|---|---|---|---|---|---|
| 28 | Theme Light / Dark / System | `AppearanceToggleTab` buttons | client: `localStorage['appearance']`, cookie `appearance`, `html.dark` (hook `use-appearance`) | three `RadioGroupCardItem` cards with a mini-UI preview rendered in a nested `.light` / `.dark` scope; System = half/half | radio names Light, Dark, System | no Echo; hook reused unchanged. Check a `.dark` scope exists in app.css like `.light` (else use `data-theme`; not verified) |
| 29 | Language | `LanguageSwitcher` `Select` (aria "Language") | PUT `locales.update` `{locale}` `preserveScroll` | `ToggleGroup` (segmented) built from shared `locales`; fall back to `Select` if width overflows at 4 locales | name "Language" | mockup shows 2 languages, we have 4 (en fr es de): keep all four |
| 30 | Reminders by email | `Checkbox#action-item-reminders-by-email` | PATCH `notificationPreferences.update` | `Switch` same id in the "Email" column of a one-row table | `#action-item-reminders-by-email` | label text "Email me about due and overdue action items" kept |
| 31 | Reminders in app | `Checkbox#action-item-reminders-in-app` | same | `Switch` "In-app" column | `#action-item-reminders-in-app` | label "Show due and overdue action items in the notification bell" |
| 32 | Save preferences | `Button` "Save" | same, toast "Notification settings saved." | card footer `LoadingButton` | "Save" | mockup shows autosaving switches; back end only saves a form: keep Save |
| 33 | Reminder time sentence | Heading description with `:time` | prop `reminderTime` | card description | text | |
| 34 | Reminders off message | "Reminders are turned off on this instance." | prop `remindersEnabled` | `Alert` info, form stays usable | text | |

### 3.4 API tokens (P11b is the contract)

| # | Action | Old control | Route / event | New control | Hook | Note |
|---|---|---|---|---|---|---|
| 35 | Show/copy server URL | `Input#mcp-url` readonly + "Copy" | clipboard, toast "Link copied" | `TextField` readonly mono + Copy button | `#mcp-url`, "Copy" | select on focus kept; value ends `/mcp` |
| 36 | Notes (privacy, tokens survive password change) | two `li` | none | `Alert` info / list | exact English sentences (P11b-01) | |
| 37 | Open create form | "Create token" button (opens `Dialog`) | none | keep a `Dialog` (see Decision 2) | "Create token" | |
| 38 | Name | `Input#token-name` max 60 | POST `apiTokens.store` | `TextField` | `#token-name` | 422 unique message inline |
| 39 | Scopes | `Checkbox#scope-read` (checked, disabled), `#scope-write`, `#scope-delete` | `scopes[]` | `Checkbox` with mono scope code + description | `#scope-read` (aria `checked=true`, disabled), `#scope-write`, `#scope-delete`; labels Read / Create and update / Delete my messages | |
| 40 | Team | `Select#token-team` grouped by workspace, "All my teams" | `team_id` | `ui/Select` (keep, not Combobox) with `SelectGroup` per workspace | `#token-team`, `[role="option"]` | prop renamed, see §7 |
| 41 | Expiration | `Select#token-expiration` from `expirationOptions` | `expiration` | `ui/Select` | `#token-expiration`, "90 days" default | |
| 42 | Submit | form button "Create token" inside dialog | POST | `LoadingButton` | `[role="dialog"] form button:has-text("Create token")` | |
| 43 | Token shown once | `NewTokenDialog` (no Escape/outside close), input `aria-label="API token"`, "Copy" | flash `newToken` | success panel (`skrum-success-soft`) in the same dialog: mono field + "Copied" | `input[aria-label="API token"]`, text "Copy your token now. You won't be able to see it again." | plain token only in flash; never in DOM after navigation (P11b-02 asserts) |
| 44 | Client snippets | tabs "Claude Code" / "Other clients (JSON)", `aria-label="Client configuration"`, "Copy configuration" | client | `ui/tabs` + code block | `[role="tab"]:has-text("Other clients")`, `[role="tabpanel"]` text `claude mcp add --transport http skrum`, `"mcpServers"`, `Authorization: Bearer …` | |
| 45 | Done | "Done" | closes, clears flash | same | "Done" | |
| 46 | Token table | `<table>` 8 columns | props `tokens` | `ui/table` `Table` with the SAME column order: Name(+hint `skrum_…{hint}`), Permissions (Badges), Team, Created, Expires, Last used, Status, Revoke | `tbody tr`, `td:nth-child(2) [data-slot="badge"]`, nth-child(3) team, (5) expires, (6) last used | dates `Intl.DateTimeFormat(locale,{dateStyle:'medium'})`, null → "Never" |
| 47 | Expired row | muted + "Expired" Badge; else "Active" | `isExpired` | same | "Expired"/"Active" | |
| 48 | Team inaccessible | "No access to this team anymore" | `teamAccessible` | destructive-text line under team | text | |
| 49 | Empty state | "No API tokens yet." | `tokens=[]` | `EmptyState` small or plain text | text (P11b-01/18a) | |
| 50 | Revoke | row `Button` "Revoke" + `ConfirmFormDialog` | DELETE `apiTokens.destroy`, toast "Token revoked." | `ConfirmDialog tone="destructive"`; "Revoke" trigger with icon | `p11bRow button:has-text("Revoke")`, "Revoke this token?", `Clients using "Test client" lose access on their next request.` | |
| 51 | MCP off | nav entry hidden, page 404 | `features.mcp` | same | P11b-17 | |
| 52 | Mobile | none | | token list as cards below the `sm` container width | | duplicates DOM: see risks |

### 3.5 Team integrations (inventory "pages/teams/integrations"; routes under `…/integrations`)

| # | Action | Old control (file) | Route / event | New control | Hook | Note |
|---|---|---|---|---|---|---|
| 53 | Page frame | `Heading` + "Back to the team" (integrations.tsx) | GET `teams.show` | `TeamSettingsShell`: title "Integrations"? see Decision 4; description "Connect :team to the tools it already uses." | exact description (P12a-01a); `<Head title="Integrations">` | breadcrumb team name › Team settings › Integrations |
| 54 | One card per enabled provider | `IntegrationCard` | props `providers[]` | `ProviderCard` (Card, CardTitle with icon, status `Badge` first) | `[data-test="integration-card-{provider}"]`, `[data-slot="card-title"]`, first `[data-slot="badge"]` = status ("Not connected", `statusLabel`) | P12a asserts the first badge text: no other Badge may precede it |
| 55 | Reconnect-required error line | `lastError` in card | `connection.lastError` | `Alert` destructive inside card | text | |
| 56 | Details list + "Connected by"/"Last checked" | `IntegrationDetails` | props | definition list (`dl`) | "Connected by", "Former member", "Last checked", "Never" | |
| 57 | OAuth connect/reconnect/upgrade | `ConnectLink` plain `<a>` | GET `integrations.connect` (`?access=`) | same, `Button asChild` `<a href>` (never `Link`) | `{card} a[href*="/integrations/slack/connect"]`; texts Connect, Reconnect, "Upgrade to read and write", "Connect (read only)", "Connect (read and write)", "Install the GitHub App", "Manage the installation" | |
| 58 | Test connection | `TestConnectionButton` (always `router.reload({only:['providers']})` in finally) | POST `integrations.test.store` | same logic, `LoadingButton` | "Send a test message" (channels) / "Test the connection" (trackers) | success toasts per provider kept |
| 59 | Disconnect | `DisconnectIntegrationDialog` | DELETE `integrations.destroy`, toast ":provider disconnected." | `ConfirmDialog` destructive; custom label/title for Jira DC token ("Remove token") | "Disconnect" | |
| 60 | Slack: open channel config | external link on channel name | external | same | text | |
| 61 | Telegram: create code | "Connect" / "Connect another chat" | POST `integrations.telegramCode.store` | same; disabled if `telegram.botUsername===null` | text | |
| 62 | Telegram: copy command, open bot, countdown, poll | pending-code box, `useCountdown`, `usePoll(5000,{only:['providers']},{autoStart:false})` | clipboard, t.me, partial reload | same hooks in a callout box | "Copy"/"Copied", "Waiting for the command… (:time left)", "This code has expired. Create a new one." | connected detection compares `id|status|chatId|connectedBy` |
| 63 | Telegram: no answer / conflict notes | text | `telegram.conflict` | `Alert` warning | texts | |
| 64 | Teams / Mattermost: connect, replace URL, label | `UrlChannelIntegration` dialog | POST `urls.store` / PATCH `update` | `FormDialog` with `url` + `channel_label` (max 80); URL never prefilled | "Webhook URL", "Channel label (optional)", "Replace URL", 422 inline | |
| 65 | Webhook: connect | dialog "Endpoint URL" + "Label (optional)" | POST `urls.store` (201 with `secret`) | `FormDialog` | text | |
| 66 | Webhook: signing secret dialog (once) | `WebhookSecretDialog`, no Escape/outside close | clipboard | `Dialog` with `onEscapeKeyDown`/`onInteractOutside` prevented | `[aria-label="Signing secret"]`, "Copy", "I've saved the secret" | |
| 67 | Webhook: rotate secret | confirm dialog | POST `secret.store` | `ConfirmDialog` | "Rotate secret" | reopens secret dialog |
| 68 | Webhook: re-enable | "Re-enable" when `reconnect_required` | PATCH `{enabled:true}` | same | "Re-enable" | |
| 69 | Webhook: events | checkboxes + "Save events" (enabled only when changed), keyed on saved events | PATCH `{events}` | `Checkbox` list in a `Collapsible`/card | `[role="checkbox"]`, "Save events" | keep `key={events.join(',')}` reset |
| 70 | Webhook: payload reference | `Collapsible` "Payload reference" | client | same | text | untranslated technical block stays |
| 71 | Deliveries: show/hide | button `aria-expanded` "Show deliveries"/"Hide deliveries" | GET `deliveries.index?page=N` | same, `Table` region `aria-label="Deliveries"` | `[aria-label="Deliveries"]` | request-counter stale guards kept |
| 72 | Deliveries: paginate / retry / empty | "Previous", "Next", "Page :page of :pages", "Retry", "No deliveries yet." | same | `ui/pagination` or kept buttons (names must stay) | texts | |
| 73 | Delivery row tags | "Redelivery", "Content not kept"/"no longer kept", kind labels | data | `Badge` | texts | |
| 74 | View delivery | "View" → `WebhookDeliveryDialog` | GET `deliveries.show` | `Dialog` with Request/Response `ui/tabs` | `#delivery-tab-request`, `#delivery-tab-response`, `#delivery-tabpanel`, `[aria-label="Headers"]` | tablist roving tabindex + arrows/Home/End must survive; `ui/tabs` may not keep these ids: pass ids explicitly or keep the custom tablist |
| 75 | Copy request body | "Copy" | clipboard | same | "Copy" | |
| 76 | Redeliver | "Redeliver" + confirm "Send this delivery again to :host?" | POST `deliveries.redelivery.store` (202), toast "Delivery queued again." | `ConfirmDialog` | "Redeliver" (hidden unless `redeliverable && status==='active'`) | P15-04/05 |
| 77 | Jira Cloud: site choose, upgrade, open site | `Select` of `settings.sites` while `setup_required` | PATCH `{cloud_id}` | `ui/Select` | text "Jira connected." | story points hidden while `setup_required` |
| 78 | Jira DC: OAuth vs token | `JiraTokenDialog` (token pw, access toggle, "I understand") | POST `jiraDataCenterToken.store` | `FormDialog` + `ToggleGroup` Read only / Read and write + `Checkbox` | "Older Jira server? Use a personal access token", "Use a personal access token", "I understand" (submit disabled until ticked), "Replace token", "Remove token" | |
| 79 | Story points field + "Detect again" | `StoryPointsField` | PATCH `{story_point_field_id}`, POST `detection.store` | `ui/Select` | `[aria-label="Story points field"]`, "Detect again" | |
| 80 | People mapping (load, match, picker, never assign, reset) | `PeoplePanel`, `AccountPickerDialog` | GET/POST/PUT/DELETE `userMappings.*`, GET `accounts.index?q=` (300 ms, min 2) | `Table` of members + `DropdownMenu` row menu + `Dialog` with search | `aria-label` "Change the :provider account of :name", "Match by email", "Match GitHub sign-ins", "Choose an account…" | 5 s refetch while `matching` |
| 81 | Priority map | `PrioritiesPanel` three `Select` | GET `priorities.index`, PATCH `{priority_map}` | `ui/Select` | "Default (:name)", "Don't set" | |
| 82 | GitHub priority labels | 3 inputs + Save | PATCH `{priority_labels}` | `TextField` x3 | texts | |
| 83 | Status sync on/off | `Checkbox` "Sync status" + confirm "Turn on status sync with :provider?" | PATCH `{status_sync}` | `Switch` (name kept) + `ConfirmDialog` | `has-text("Sync status")`, "Turn on status sync" | P14d |
| 84 | Treat canceled as done | `Checkbox` (Linear, GitHub) | PATCH | `Switch`/`Checkbox` | "Treat canceled as done" | default on |
| 85 | Status mapping (containers, edit mapping, done set, Complete to / Reopen to) | `StatusMappingPanel` | GET `statuses.index[?container]`, PATCH `{status_mapping}` | `ui/Select` + `Checkbox` | `[aria-label="Complete to"]`, `[aria-label="Reopen to"]`, "Edit mapping", "Try again", "At least one status must count as done." | |
| 86 | Jira DC manual webhook panel | `JiraDataCenterWebhookPanel` + `CopyRow` | GET/POST `trackerWebhook.*` | collapsible panel | `[aria-label="Copy Webhook URL"]`, "I've registered it", toast "skrum now waits for the first event." | |
| 87 | Status-sync mode line | text | props | `Badge`/muted text | the four sentences | |
| 88 | Providers absent when disabled | page only gets enabled | | same | P12a-01a counts `[data-test^="integration-card-"]` | |

Total parity rows: 88 (rows 1-88).

## 4. Composition

Shells (new, mirror `AdminShell`):
- `components/settings/settings-shell.tsx`: `{active: 'profile'|'security'|'appearance'|'notifications'|'apiTokens', children}`; `AppLayout` with no `active` key (user settings are not "Team settings"; `NavKey 'settings'` is team settings), breadcrumbs `[{t('Settings'), edit()}, {section}]`; `SettingsLayout title={t('Settings')} description={t('Manage your profile and account settings')} nav=[…]` navLabel default "Settings". Nav items from `@/routes/{profile,security,appearance,notificationPreferences,apiTokens}`; API tokens item only if `usePage().props.features.mcp`. Old titles used `t()` on English keys: keep `Profile, Security, Appearance, Notifications, API tokens`.
- `components/integrations/team-settings-shell.tsx`: `AppLayout active="settings" breadcrumbs=[team, Team settings, Integrations]` + `SettingsLayout title={t('Team settings')}` and `nav`. Built from `workspace`/`team` props (`IntegrationScope {workspace: slug, team: id}`).
- Common card: no `skrum/` equivalent of `.st-card` exists. Compose `SettingsCard` (`components/settings/settings-card.tsx`) from `ui/card` (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` with muted footer for the action). Use it in every screen above. `max-w-3xl` per card (SettingsFrame body has no width cap).

| Screen | Containers | `skrum/` + `ui/` used | Composed from primitives |
|---|---|---|---|
| Profile | `ProfileCard`, `DeleteAccountCard`, existing `AvatarStyleCard` | `PersonAvatar` (xl, `auth.user.avatarUrl`, B9), `TextField`, `Badge`, `Alert`, `LoadingButton`, `FormDialog` | danger card (destructive-soft tint, `TriangleAlert`) |
| Security | `PasswordCard`, `TwoFactorCard`, `TwoFactorSetup`, `RecoveryCodes`, `PasskeysCard` | `Alert`, `Badge`, `InputOTP`, `LoadingButton`, `ConfirmDialog`, `FormDialog`, `EmptyState`, `Skeleton`, `Checkbox` | QR box (`.light` + `aria-label`), mono key with copy, numbered code grid (2 cols mobile), passkey row list |
| Appearance | `ThemePicker`, `LanguageField` | `RadioGroupCardItem` (ui), `ToggleGroup` | mini-UI preview (3 coloured bars in nested scope) |
| Notifications | `NotificationsCard` | `Table`, `Switch`, `Alert` | one-row events table; `useForm<Preferences>` kept |
| API tokens | `ServerUrlField`, `TokensTable`, `TokenCards` (mobile), `CreateTokenDialog`, `NewTokenPanel`, `RevokeTokenDialog` | `Table`, `Badge`, `Select`, `Checkbox`, `Tabs`, `Dialog`, `ConfirmDialog`, `EmptyState` | code block, scope row (code + description) |
| Integrations | `ProviderCard` and 13 provider/panel files rewritten in place | `Card`, `Badge`, `Alert`, `Switch`, `Select`, `ToggleGroup`, `Tabs`, `Collapsible`, `Table`, `Dialog`, `ConfirmDialog`, `FormDialog`, `Pagination`, `Spinner` | provider icon row, callouts, copy rows |

Adapters (server shape → props), field by field:
- Profile: none; `auth.user.{name,email,email_verified_at,avatarUrl}`.
- Passkeys: `Passkey {id,name,authenticator|null,created_at_diff,last_used_at_diff|null}` → row `{title:name, badge:authenticator, meta:t('Added :time'), t('Last used :time')}`.
- Tokens: `ApiToken.scopes` → badge labels via `ScopeLabels` (English keys through `t()`); `team` / `teamAccessible` → text + warning; dates via `Intl.DateTimeFormat(locale)`; `expirationOptions` → `Select` options as sent (labels translated by server).
- `teamGroups` (renamed) `{workspace:{id,name}, teams[]}` → `SelectGroup`/`SelectItem`.
- Integrations: `IntegrationProviderCard.connection` kept untouched; status mapping `active|setup_required|reconnect_required` → Badge variants (`default`/`secondary`/`destructive` as `IntegrationStatusBadge` does today); `lib/integrations.ts#integrationErrorMessage`, `retroRequest` (JSON client), `useClipboard`, `useCountdown`, `usePoll` kept as is.

Hooks and lib reused unchanged: `use-appearance`, `use-clipboard`, `use-countdown`, `use-trans`, `use-two-factor-auth` (setup part; challenge page also uses it), `usePasskeyRegister` (from `@laravel/passkeys/react`), `lib/retro/api.ts#retroRequest`, `lib/integrations.ts`. Wayfinder imports stay (`@/actions/...`, `@/routes/...`).

Dev bench: add sections `pages/dev/sections/settings-profile.tsx`, `settings-security.tsx`, `settings-api-tokens.tsx`, `settings-integrations.tsx` (states: connected / reconnect required / setup required / long names), same pattern as `admin-admins.tsx` (`BenchGroup 'skrum'`).

## 5. Realtime

None. No Echo channel on any of the six pages (confirmed in inventory). Freshness is by polling and partial reloads, all to keep:
- `router.reload({only:['providers']})` after every integration mutation (also after a failed test).
- Telegram `usePoll(5000, {only:['providers']}, {autoStart:false})` while a code is pending, plus countdown.
- People panel: JSON refetch every 5 s while `matching`.
- Window `focus` reload of the bell is in the shell (group of AppLayout), not here.
Two-browser checks: none for this group.

## 6. Mockup elements not rendered / without mockup

Not rendered (spec §10 or no back end):
- Profile: 12 presence colours, Upload photo / Use initials (backlog: user-chosen presence colour, photo upload). Mockup "Delete account" IS rendered (Decision 1).
- Appearance: "Reduce animations" switch (backlog: reduced-motion account setting).
- Notifications: other event rows (only action-item reminders exist).
- Security: strength meter, breach check, "12 characters / not in leaks" rules, "other sessions are signed out" (backlog password breach check); 2FA "app added date / last used / Change device", remaining-codes count, "disable asks for a code", admin-enforced 2FA note; **Active sessions** and **Linked accounts** blocks (backlog: device sessions, linked accounts); SSO-only hiding of the password card (no prop).
- API tokens: revoked/struck-through row state (revoked tokens are deleted), inline create form instead of dialog (Decision 2).
- Team settings: Members & rituals, default facilitators, templates, default columns, Data & export tabs; roles Facilitator/Observer (backlog: observer roles, default facilitators and rotation). Only Integrations exists.

No mockup (designed from neighbours): passkeys card (from Security cards + Table row), the whole of `teams/integrations` (from ScreenSettings `.st-card`/`.st-int`: card per provider with status badge in `skrum-success-text` when connected, action in footer; inner panels as nested sections separated by `Separator`), webhook deliveries table and delivery dialog (from `ui/table`, `ui/tabs`), people mapping table, status-mapping panel, Telegram pending-code callout (from the `us-once` secret box style), Jira token dialog (from `FormDialog`).

## 7. Back-end changes

Only B16 (spec §9): rename the page prop `teams` of `settings/api-tokens` (collides with the shared `teams` prop of the sidebar: a page prop overrides a shared one, which would empty the sidebar team switcher).
- `app/Http/Controllers/Settings/ApiTokensController.php:42`: `'teams' => $this->teamsByWorkspace($user)` → `'teamGroups' => …` (method name `teamsByWorkspace` may stay).
- `tests/Feature/Mcp/ApiTokensTest.php:60-61`: `->has('teams', 1)` / `->where('teams.0.teams.0.name', 'Platform')` → `teamGroups` / `teamGroups.0.teams.0.name`.
- Front: `pages/settings/api-tokens.tsx` props `teams` → `teamGroups`; `CreateTokenDialog` prop; `types/api-tokens.ts` keeps type `ApiTokenTeamGroup`.
- Gaps to report, not plan: 2FA disable-with-code, sessions, linked accounts, presence colour, photo, reduce-motion, per-event notification matrix, team settings sections.

## 8. Browser tests

Existing contract (all in `tests/Browser/Walkthroughs/`):
| File | Binds to | Changes needed |
|---|---|---|
| `Plan11bApiTokensTest.php` (P11b-01..18a) | `nav[aria-label="Settings"]` + link texts; `#mcp-url`; `#token-name`, `#scope-read/-write/-delete`, `#token-team`, `#token-expiration`; `[role="dialog"] form button:has-text("Create token")`; `input[aria-label="API token"]`; `[role="tabpanel"]`; `tbody tr`, `td:nth-child(2..6)`, `[data-slot="badge"]` count; `button:has-text("Revoke")`; texts; password-confirm redirect | None if Decision 2 = keep dialog. Re-verify `assertCount(td:nth-child(2) [data-slot="badge"], 3)`: scope labels must be `Badge`, status badge must be in another column |
| `Plan12aIntegrationsFoundationTest.php` | `[data-test="integration-card-{p}"]`, `[data-slot="card-title"]`, first `[data-slot="badge"]`, `a[href*=…/connect]`, description "Connect Platform to the tools it already uses.", link "Integrations" on `teams/show` | none; P12a-01a `click('Integrations')` clicks the team page link (group 4's file), keep sidebar/team page text unambiguous |
| `Plan12b…`, `Plan12d…` (share dialogs, export) | integration cards only as setup | none expected |
| `Plan14a/14b/14c/14d/15` | `[aria-label="Signing secret"]`, `Deliveries`, `Headers`, `#delivery-tab-*`, `#delivery-tabpanel`, `Redeliver`, `Rotate secret`, `Re-enable`, `Sync status`, `Turn on status sync`, `Complete to`, `Reopen to`, `Story points field`, `Copy Webhook URL`, `Older Jira server`, `I understand`, `Detect again`, `Upgrade to read and write`, `Treat canceled as done`, `[role="dialog"]` (65 uses), `[role="checkbox"]`, `[role="option"]` | none if names kept; checkbox → `Switch` changes role to `switch`: **`Sync status` is asserted via `[role="checkbox"]`** (check lines in Plan14dStatusSyncTest) so keep `Checkbox` for status sync and canceled-as-done, or edit the test (mockup does not impose it: keep Checkbox) |
| `Plan18dBrandingTest.php` P18d-06 | `/settings/profile`, `[data-slot="avatar-style-card"]`, `@update-avatar-style-button` | none |
| `tests/Feature/Settings/*`, `Feature/Integrations/IntegrationsPageTest.php` | Inertia component and props | update `ApiTokensTest` only |

Not covered today (no browser test at all): profile save, delete account, password change, 2FA, passkeys, appearance, notifications, `teams/integrations` mobile. New tests, file `Plan18eSettingsTest.php`:
- `[P18e-10-01]` profile: save name/email, unverified notice resend, email badge.
- `[P18e-10-02]` delete account: wrong password error, then deletion and redirect to `/`; sole owner refused.
- `[P18e-10-03]` password change: errors reset and focus; success toast.
- `[P18e-10-04]` 2FA: enable, QR visible in `.light` box, wrong then right code (Google2FA in test), recovery codes step, disable.
- `[P18e-10-05]` passkeys: empty state, seeded passkey listed, remove with confirm (WebAuthn registration not testable in headless).
- `[P18e-10-06]` appearance: theme card sets `html.dark` and cookie, survives reload; language switch to `fr` translates the sub-nav.
- `[P18e-10-07]` notifications: toggle both, Save, toast, persisted.
- `[P18e-10-08]` sub-nav: `aria-current="page"` on the active link for each page; API tokens entry hidden when MCP off (already P11b-17).
- `[P18e-10-09]` API tokens shell: sidebar team switcher still lists teams on `/settings/api-tokens` (guards the `teams` collision).
- `[P18e-10-10]` team settings sub-nav, breadcrumb, and "Team" link back.
Visual: `tests/Browser/Visual/SettingsPagesVisualTest.php` (model: `AdminPagesVisualTest.php`, `captureVisuals`, 1440/390, light/dark, EN/FR, overflow check) for profile, security (2FA enabled and setup states), appearance, notifications, api-tokens (with one token and expired), integrations (Slack connected, webhook with deliveries, Jira DC token). Vitest: `theme-picker`, `recovery-codes` (copy/download/gate), `tokens-table` (columns, expired row, no-access line), `provider-card` (status badge first, reconnect error), `webhook-delivery-dialog` tab keyboard.

## 9. Risks and open questions

| Risk | Where |
|---|---|
| Two `nav[aria-label="Settings"]` for admins/owners: the sidebar footer nav is also named "Settings" when `hasFooterLinks` | `components/skrum/app-sidebar.tsx:391` vs `skrum/sub-nav.tsx`; P11b asserts `nav[aria-label="Settings"]` (strict-mode ambiguity). Member user in P11b has no footer links so it passes; safer: rename the sidebar nav ("Team settings") in group 4/sidebar owner |
| Status-sync and canceled-as-done are `role="checkbox"` in tests; a `Switch` breaks them | `Plan14dStatusSyncTest.php:372,425,863,992` bind `label:has-text("Sync status") button[role="checkbox"]` and `label:has-text("Treat canceled as done") button[role="checkbox"]`; `Plan14cTrackersTest.php:222,278` bind `[role="dialog"] label:has-text("I understand") button[role="checkbox"]`. Keep `Checkbox` inside a `<label>` for all three |
| Delivery dialog ids `#delivery-tab-request/-response`, `#delivery-tabpanel` and arrow-key roving | `webhook-delivery-dialog.tsx:53-131`; `ui/tabs` may generate its own ids |
| `p12aBadge` reads the first `[data-slot="badge"]` of the card: any Badge before the status Badge (e.g. authenticator or access badge in header) breaks P12a | `integration-card.tsx` |
| API token table mobile cards duplicate DOM; `assertSee*` fine but counts of badges (`assertCount`) must stay on the `tbody` rows; hide the card list with a container query, not by removing the table | P11b-02 |
| Dark mini-preview needs a `.dark` scope class; only `.light` is guaranteed (`LightScopeTokensTest`) | `resources/css/app.css:595` |
| Fortify QR SVG is raw HTML with its own colours: must stay dark on light; the old invert filter must go | `two-factor-setup-modal.tsx:82-92` |
| Parallel work: `lang/{en,fr,es,de}.json` (new keys: Verified, Active sessions no, theme names…), `app.tsx` layout switch, `types/index.ts`; `teams/show.tsx` and the sidebar are other groups | see §10 |
| 18d left `profile.tsx` modified and uncommitted; commit 1 must start from the committed or stashed state of that file | git status |
| `delete-user` mockup vs backlog "account deletion": see Decision 1 | spec §10 line |
| `Select` mockups use `Combobox`; tests click `[role="option"]` and expect no `[role="listbox"]` after choosing: keep `ui/Select` | create-token |
| Untranslated hard-coded strings (`'OAuth'`, `'—'`, payload and signature snippets, "1, 2, 3, 5, 8" not in this group) kept as is to stay in the browser contract | inventory "Hardcoded" list |

Decisions needed from the product owner:
1. Delete account: the mockup shows it, spec §10 backlog lists "account deletion", the old front and back end have it (DELETE `profile.destroy`, sole-owner guard). Proposal: keep it (parity rule §2.2). Confirm.
2. API token creation: mockup shows an inline form and an inline "token created" box; the browser contract uses a dialog (`[role="dialog"]` in P11b-02/15a/18a). Proposal: keep the dialog and restyle it (no test change). Alternative: inline form and edit 4 tests.
3. 2FA setup: mockup is inline steps (QR, OTP, recovery codes with "I saved my codes"); old front is a modal; no browser test binds either. Proposal: inline steps in the card. Confirm, and whether to render Print.
4. Team settings sub-nav content: the mockup has four tabs but only Integrations exists as a page. Proposal: sub-nav `Team` (link to `teams.show`) + `Integrations` (current), title "Team settings". Alternative: a single-item nav plus breadcrumb only.
5. Mobile sub-nav: keep the shared horizontal `SubNav` (as 18d) or add the `Select` the Security mockup shows; the User settings mockup says "list then dedicated page". Proposal: keep `SubNav`.
6. Notifications: keep an explicit Save button (back end saves one form) instead of the mockup's autosaving switches. Confirm.

## 10. Size and parallelism

- Containers to write: shells 2, settings cards ~16, integrations ~24 rewritten in place (26 files + 3 folded) = about 42 files. Old files deleted outright: 12 (`layouts/settings/layout.tsx`, `delete-user`, `manage-two-factor`, `two-factor-setup-modal`, `two-factor-recovery-codes`, `manage-passkeys`, `passkey-item`, `passkey-register`, `alert-error`, `appearance-tabs`, 3 token dialogs) plus 3 folded integrations files = 15; 23 more rewritten in place (git shows as modified).
- Tests touched: `tests/Feature/Mcp/ApiTokensTest.php` (1 assertion pair); browser: 0 changed if decisions 2 and the Checkbox rule hold; new: 1 walkthrough (10 tests), 1 visual, ~6 Vitest files.
- Commits: 8. Estimate: the largest group of plan 18e by file count (integrations is 5.9k lines).
- Parallel with other groups: yes after commit 1, with these shared touchpoints: `resources/js/app.tsx` (layout switch: serialize with groups 11/12), `lang/{en,fr,es,de}.json` (conflicts: add keys in one block per commit), `types/api-tokens.ts` and `types/index.ts`, `components/skrum/app-sidebar.tsx` (nav label risk, owned by group 4), `teams/show.tsx` (Integrations link, group 4). Do not touch `components/integrations/share/*`, `lib/integrations.ts`, `confirm-form-dialog.tsx`, `password-input.tsx`, `passkey-verify.tsx`, `language-switcher.tsx`, `use-two-factor-auth.ts` without checking groups 2, 3, 6, 11.
