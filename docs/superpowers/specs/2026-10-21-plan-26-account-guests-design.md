# Skrüm — Account, and what a guest picks — Design

Date: 2026-10-03
Status: draft for the owner. Nothing is built before the owner has read §15 ("Decisions for the owner"). The body is written on the option marked **recommended** of each decision; the plan carries a table of the tasks that change with another answer.
Parent spec: `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` (§5 rule 13, §10).
Owner's word: `docs/superpowers/research/front-rewrite/owner-answers-2026-10-02.md` — third round ("Account: photo upload, active sessions, linked accounts, presence colours, 'reduce animations', breach check"; "Guest colour picker and short session code"; the 18f security answers on `sso_required`), sixth round (informal register; a guest counts as a participant), the working rules of the fifth round as amended for plan 19.
Roadmap rows: AC-1 to AC-6, GU-1, GU-2 of `docs/superpowers/research/front-rewrite/feature-roadmap.md`. Deviation rows cleared: D-25 (in part: the account features; "other notification events", "last changed", "Change device" and revoked-token rows stay backlog by the owner's word), D-32, D-79.
Mockups (binding for presentation, parent spec §5 rule 13): `docs/design-system/components/ScreenUserSettings` (Profile: avatar and twelve presence colours, "Upload photo" / "Use initials"; Appearance: "Reduce animations"), `ScreenSecurity` (Password with the breach rule; Active sessions; Linked accounts), `GuestJoin` (twelve colours, preview, taken colour disabled), `MobileAccess` (guest frame: 6×2 colours, taken colour marked; "Join with a code"), `ShareDialog` ("Session code" `ATL-4821`, "Join at …/join", regenerate stops the code), `Input` (state "Session code", error "The code has 8 characters").
Database rules: `docs/database.md`, "Rules for database code" 1 to 12, the concurrency harness (`Race`) and the Upgrade suite.

What was read, and what was not: the code of `main` at `18d3637e` (front-end rewrite, database portability, plan 19). Nothing was run. Every "Back end" line of the roadmap was checked against the code; four were wrong or incomplete (§1.1).

## 1. Problem statement

The settings and guest-join screens were rebuilt to their mockups in plan 18e with what the server held. Eight elements had no data and were left as places (`ProfileCard` props `presenceColours` and `photo`, `AppearanceCard` prop `reduceAnimations`, `SecurityStack` props `activeSessions` and `linkedAccounts`, the breach line of `PasswordStrength`, `GuestJoin` props `takenColors` / `initialPresence` / `session.code`, `ShareDialog` props `invite.code` / `invite.joinUrl`). The owner asked for all of them.

### 1.1 What the code says, against the roadmap's "Back end" lines

| Row | Roadmap line | What the code holds |
|---|---|---|
| AC-1 | generated avatars; a stored image and its serving | True. `User::avatarUrl()` → `AvatarUrl::for()` (DiceBear or initials, per style; member choice behind `InstanceSettings::avatarMemberChoice()`). The production image has no GD or Imagick (`Dockerfile`: `bcmath intl opcache pcntl pdo_* zip`): the server cannot resize or re-encode an image. `BrandAssets` is the pattern for a stored file served by a controller (random name, `local` disk, `InertImage` CSP). |
| AC-2 | needs the database session driver and a device description | The driver is already `database` by default (`config/session.php`, `.env.example`). But the SQLite setup documents `SESSION_DRIVER=file` (`docs/database.md`, `compose.production.sqlite.yaml`): there, no list can be read. A device description exists: `App\Support\Auth\UserAgentSummary::describe()` ("Firefox on macOS"). "Remember me" queues a recaller cookie (Fortify's login): deleting a session row alone does not sign a remembered device out. |
| AC-3 | `social_accounts` written at sign-in only; link and unlink with a "last sign-in method" guard, read against `sso_required` | True, and more: the SSO routes `auth/{provider}/redirect` and `/callback` sit in the `guest` group, so a signed-in user cannot come back from a provider; an account created by SSO holds `Str::password(64)` and nothing records that its owner knows no password; such an account cannot pass the password confirmation that guards the security section (unless it has a passkey). |
| AC-4 | the colour is assigned by the back end today | False. No page or channel receives a colour. Mail derives one from the avatar seed (`MailBrand::presence()`); the whiteboard hashes the board member's id in the browser (`lib/whiteboard/presence-slot.ts`), so one person has a different colour on each board; retro and poker cursors take the `live-cursors` library's own palette. |
| AC-5 | a user preference; the system setting is respected | True: `@media (prefers-reduced-motion)` in `resources/css/app.css`, Tailwind's `motion-reduce:` / `motion-safe:` (126 uses) and four `matchMedia` calls (`ui/chart.tsx`, `settings/use-visible-section.ts`, `skrum/gif-picker.tsx`, `retro/session-confetti.tsx`). |
| AC-6 | `Password::defaults()` without `uncompromised()` | False. `AppServiceProvider::configureDefaults()` sets `->uncompromised()` in production (no rule at all elsewhere). Laravel's `NotPwnedVerifier` calls `api.pwnedpasswords.com` with a 30-second timeout and passes the password when the call fails: on an instance without outbound access, every password change waits 30 seconds. What is missing is the **live** line of the mockup ("Not found in known data breaches" as a met rule, D-79) and a way to turn the outbound call off. |
| GU-1 | taken colours of the session, and a colour on the participant | True. Five guest-capable participant tables: `participants` (retro), `poker_players`, `whiteboard_members`, `team_survey_respondents`, `game_players`; all use `HasGuestIdentity`. `GuestJoin` already renders the picker when `takenColors` is given. |
| GU-2 | a short code and its entry page | True. Tokens are 40 characters (64 on `retros`). `ShareDialog` already renders `invite.code` and `invite.joinUrl`. Five share mounts: `retro/board-share.tsx`, `poker/room-dialogs.tsx`, `whiteboard/board-share.tsx`, `surveys/survey-share.tsx`, `games/room-share-dialog.tsx`. Five guest-token rotations: `*GuestTokensController`. |

## 2. Goals

1. **AC-4** A person has one presence colour, chosen among twelve in the profile, used for their avatar ring and fallback, their live cursor and their avatar in the presence stack, on every session type and in mail. Without a choice it is the colour mail uses today.
2. **AC-1** A member uploads a photo, which replaces the generated avatar everywhere an avatar shows; "Use initials" goes back to initials. No image metadata is published.
3. **AC-5** "Reduce animations" on the account reduces motion as the system setting does, on every page the member opens signed in.
4. **AC-6** The password card shows, while typing, whether the new password appears in known breaches, without the password or its full hash leaving the browser; an operator can turn the outbound check off; a failed check never stalls a save for 30 seconds.
5. **AC-2** A member sees the devices signed in to the account, signs one out or all the others.
6. **AC-3** A member links and unlinks SSO identities of the enabled providers; the last way in can never be removed; an account without a known password can still confirm itself and set a password.
7. **GU-1** A guest picks a colour on the join page; colours already used in the session are disabled while free ones remain.
8. **GU-2** Every guest-joinable session has a short code, shown in the Share dialog, entered at `/join`; regenerating the link replaces the code.
9. All database code is Eloquent and the standard query builder, unchanged on PostgreSQL, MySQL, MariaDB and SQLite; every test that touches the database passes on the four.

## 3. Non-goals (stay backlog)

- By the owner's word (roadmap): other notification events, "last changed" of the password, "Change device" and "last used" of the authenticator, struck-through revoked tokens.
- Approximate location, "Unusual location" and any IP display in Active sessions (decision 3).
- A device model or browser version beyond `UserAgentSummary`'s labels ("MacBook Pro · Firefox 131" → "Firefox on macOS").
- Theme stored on the account ("Stored on this account, synced across devices"): the theme stays on the device; not in the owner's list.
- A guest changing name or colour after joining; members choosing a colour per session.
- The "card lock" use of the colour (no card lock exists; RT-1 of plan 21 may consume the colour).
- A `/s/{code}` short URL and QR changes (the QR keeps encoding the guest link).
- Server-side image resizing (decision 1), animated images, SVG photos.
- The "Print" button of recovery codes (D-26 stays) and anything of the former plans 28 and 30 and scheduling.
- Deleting an account that has no known password (the deletion form asks for the current password; `ProfileDeleteRequest`): left as it is, listed in §16.

## 4. Decisions already taken

| Topic | Decision | Source |
|---|---|---|
| Scope | the eight features, all built | owner, third round |
| Presentation | the mockups are binding; a difference is fixed or is a pre-build deviation put to the owner before its screen is built | parent spec §5 rule 13; fifth round |
| Register | informal in every language (fr tu, es tú, de du), screens, validation, mails | sixth round |
| `sso_required` | only SSO signs in; instance admins keep password + second factor; ignored when no provider is enabled | 18f security answers |
| Guests | a guest counts as a participant | sixth round |
| Database | Eloquent only; four engines; races proved with `Race`; data migrations proved in `tests/Upgrade` | database portability, plan 19 |
| Working rules | tests written and run per task (pgsql and sqlite per task; four engines for data migrations and races; whole suites at the end); no browser walkthrough; captures light / 1440 / fr only; no new dependency without approval | owner, plan 19 rules |

## 5. Domain and data

### 5.1 Columns on `users`

| Column | Type | Meaning |
|---|---|---|
| `presence_color` | unsigned tiny integer, nullable | the chosen colour, 1 to 12; null = derived |
| `avatar_photo_path` | string(64), nullable, hidden | `avatars/<40 lowercase letters and digits>.jpg` or `.png` on the `local` disk |
| `reduce_motion` | boolean, default false | "Reduce animations" |
| `password_set_at` | dateTime, nullable, hidden | when the owner of the account last chose a password; null = no password the owner knows (an account created by SSO) |

### 5.2 Column on the five participant tables

`presence_color` (unsigned tiny integer, nullable) on `participants`, `poker_players`, `whiteboard_members`, `team_survey_respondents`, `game_players`. Written for a guest at join; never for a member (a member's colour is the user's).

### 5.3 Table `session_join_codes`

| Column | Type | Rule |
|---|---|---|
| `id` | uuid | primary key |
| `code` | string(8) | unique; the form `XXX-XXXX` (decision 7) |
| `session_kind` | string(16) | `retro`, `poker`, `whiteboard`, `survey`, `game` (enum `JoinableSessionKind`) |
| `session_id` | uuid | the session's id |
| `created_at`, `updated_at` | timestamps | |

Unique on (`session_kind`, `session_id`). No foreign key (five parent tables, several deleted by database cascades that fire no model event): a code whose session is gone resolves to nothing and is deleted when it is next resolved.

### 5.4 The presence colour

`App\Support\Avatars\PresenceColor`: `Count = 12`; `forSeed(string $seed): int` = `hexdec(substr(sha256($seed), 0, 7)) % 12 + 1` (today's `MailBrand::presence`, which delegates to it, so no mail changes colour).

- A user: `presence_color ?? forSeed(avatarSeed())`.
- A participant row (`HasGuestIdentity::presenceColor()`): the user's colour when it has a user; otherwise its own `presence_color ?? forSeed(avatarSeed())`.

The colour reaches the front through the member data of the five presence channels (`presence` beside `id`, `name`, `avatarUrl`, `isGuest`) and the profile props. The front stops hashing ids: `PresenceMember.presence` is the colour of cursors, rings and the presence stack. A colour changed in settings shows in a session at the next channel subscription (reload or reconnect).

### 5.5 Taken colours (GU-1, decision 8)

The taken colours of a session are the distinct `presenceColor()` of every participant row of that session (members and guests, online or not). When the twelve are all taken, the list is empty: nothing is disabled. The server accepts any colour from 1 to 12: two guests joining at once may share a colour, as people beyond twelve must.

### 5.6 The photo (AC-1, decision 1)

- The browser crops the chosen file to a centred square and draws it at 512 × 512 on a canvas, encoded as JPEG (quality 0.85). This also drops the file's metadata.
- The server accepts `image/jpeg` or `image/png` (by content, `mimetypes`), at most 1 MB and 4096 × 4096 pixels (`dimensions`, read by `getimagesize`, no GD), and strips metadata itself (`App\Support\Avatars\ImageMetadata::strip()`: JPEG APP1, APP13 and comments; PNG `eXIf`, `tEXt`, `zTXt`, `iTXt`, `tIME`), because a request may bypass the browser. A file it cannot parse is refused.
- Stored on the `local` disk at a random name; served at `GET avatar-photos/{file}` with `Cache-Control: public, max-age=31536000, immutable`, `X-Content-Type-Options: nosniff` and the `InertImage` CSP; public, like generated avatars (guests and mail recipients see avatars). The name changes with every upload, the previous file is deleted, and the file is deleted with the account.
- Shown only while "members choose their avatar" is on (`avatarMemberChoice`); while it is off the photo is kept and neither offered nor shown.
- "Use initials" removes the photo and sets the avatar style to `initials`.

### 5.7 Reduce animations (AC-5)

`users.reduce_motion`. The root view renders `<html class="reduce-motion">` for a signed-in user who has it on; the front toggles the class after a save. The CSS applies the same rules under `html.reduce-motion` as under `prefers-reduced-motion: reduce`, and Tailwind's `motion-reduce` / `motion-safe` variants are redefined to honour the class too. One helper, `prefersReducedMotion()`, replaces the four `matchMedia` reads. The system setting still applies when the switch is off.

### 5.8 Breach check (AC-6, decision 6)

- Config `skrum.passwords.breach_check` (env `SKRUM_PASSWORD_BREACH_CHECK`, default true) and `skrum.passwords.breach_check_timeout` (seconds, default 5). `Password::defaults()` keeps its production rule and adds `uncompromised()` only when the check is on; the `UncompromisedVerifier` is bound with the timeout.
- Live check by k-anonymity: the browser computes the SHA-1 of the new password (`crypto.subtle`), sends its first five hex characters to `POST settings/password/breach-range`, receives the suffixes of that range with a non-zero count, and compares locally. The server proxies `api.pwnedpasswords.com/range/{prefix}` (padding on), caches a range one day, answers 404 when the check is off and 503 when the range cannot be fetched (not cached). The password and its full hash never leave the browser; the server sees five characters.
- Where `crypto.subtle` is missing (a plain-HTTP instance), or on 404 / 503, the line falls back to "Checked against known data breaches when you save".

### 5.9 Active sessions (AC-2, decisions 2 and 3)

- Model `BrowserSession` over the framework's `sessions` table (string key, no timestamps). Read only when `config('session.driver') === 'database'`.
- A row: `key` (sha256 of the session id; the id itself never leaves the server), `device` (`UserAgentSummary::describe()`, or "Unknown device"), `deviceKind` (`desktop` | `phone` | `unknown`, from the same header), `isCurrent`, `lastActiveAt` (ISO 8601). Sorted by last activity, newest first, then by key.
- "Sign out" deletes that row; "Sign out other sessions" deletes every row of the user but the current one. Both cycle the user's remember token, so that a remembered device does not come back through its cookie. The current device stays signed in for its session.
- Driver other than `database`: the card shows one sentence and nothing else (decision 2A).

### 5.10 Ways in, linking and unlinking (AC-3, decisions 4 and 5)

`App\Support\Auth\SignInMethods::remaining(User $user, ?SocialAccount $without = null): array` lists what would still sign the user in:

| Way | Counts when |
|---|---|
| `sso:<provider>` | a linked account other than `$without` whose provider is enabled |
| `password` | `password_set_at` is not null and `SignInPolicy::allowsPassword($user)` |
| `magic_link` | `SignInPolicy::allowsLocalCredentials()`, mail is enabled and the address is verified |
| `passkey` | `allowsLocalCredentials()`, passkeys are enabled and the user has one |

- **Link.** From the Linked accounts card: `GET settings/linked-accounts/{provider}` (password confirmed) stores an intent `link` in the session and sends to the provider. The callback route leaves the `guest` group and branches: a signed-in user with an intent links (or confirms, below); a signed-in user without one goes to the dashboard as before; a visitor signs in as today. `LinkSocialAccount` locks the user row, then refuses: an identity linked to another account; a second identity of the same provider on this account. The same identity again is a no-op.
- **Unlink.** `DELETE settings/linked-accounts/{socialAccount}` (own accounts only, 404 otherwise; password confirmed). Locks the user row, then refuses when `remaining($user, $account)` is empty ("You can't unlink your last sign-in method: set a password or link another account first.") or when the account is managed by the admin.
- **Managed by your admin** (decision 5C): while `sso_required` is in force, every linked identity of an enabled provider shows the badge "Managed by your admin" and has no "Unlink".
- **A provider turned off**: its linked rows stay listed with "Not available on this instance", count for nothing, and can be unlinked.
- **Confirming without a password** (decision 4A): the password-confirmation dialog of the settings page and the `auth/confirm-password` page offer "Confirm with <provider>" for each enabled provider the user has linked. `GET settings/confirmations/{provider}` stores an intent `confirm`; the callback accepts it only when the provider returns an identity linked to this user, and then marks the password confirmed (`session()->passwordConfirmed()`).
- **Setting a password**: when `password_set_at` is null, the password card is titled "Set a password", has no current-password field, and its save requires a fresh confirmation. When `allowsPassword($user)` is false (non-admin under `sso_required`), the password card is not shown (the mockup: "hidden if the account only has SSO").
- `password_set_at` is written by registration (`CreateNewUser`, which the invitation account form also uses), password reset (`ResetUserPassword`) and the password card (`SecurityController`). An account created by SSO leaves it null.

### 5.11 Join codes (GU-2, decision 7)

- Alphabet: `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (31 characters: no `0`, `O`, `1`, `I`, `L`). A code is three characters, a hyphen, four characters: `K7Q-P4M2`. 31⁷ ≈ 2.75 × 10¹⁰ codes.
- Input is normalised: upper case, spaces removed, the hyphen optional (`k7qp4m2` → `K7Q-P4M2`); anything else of the wrong length is refused before a query.
- `JoinCodes::for(Model $session): string` returns the session's code, creating it at first use (the share data of a viewer who may manage the link). Two first uses at once make one code (unique pair, the loser re-reads). A collision on `code` retries with a new code.
- `JoinCodes::rotate()` gives a new code whenever the guest link is regenerated (the five guest-token controllers); the response carries `joinCode`.
- Resolution: `POST join` with `code` → the code's session, if it still accepts guests by the same rule as its join page (retro, poker, whiteboard: `guest_access_enabled`; survey: guest access on, not a draft, not attached to a retro; game room: standalone with link access) → redirect to that session's join page. Otherwise one answer for every failure: "No session matches this code." Throttled at 10 attempts per minute per address.

## 6. Permissions

| Action | Who |
|---|---|
| Presence colour, photo, reduce animations | the signed-in user, for their own account (verified address not required for the profile, as today; required for appearance) |
| Read sessions and linked accounts | the user, behind the fresh password confirmation of the security section (as the other protected props) |
| Sign out a session, link, unlink | the user, password confirmed |
| Confirm with SSO | a signed-in user with a linked identity of an enabled provider |
| Set a password (no known password) | the user, password confirmed (through SSO or a passkey) |
| Breach range | a signed-in user (throttled 30 per minute) |
| See a session's join code | whoever sees its guest link today (retro facilitator, poker and whiteboard non-guests, survey non-guests, game room manager) |
| Resolve a code | anyone, throttled |
| Pick a colour | a visitor of a guest join page |

## 7. Real time

- The five presence-channel authorisations add `presence` to the member data. Nothing else is broadcast: a guest's colour reaches the others with its `joining` event; a colour changed in settings reaches a session on the next subscription.
- The join page reads taken colours at load. It does not subscribe to the session's channel (a visitor is not a member yet; the mockup's `Echo.join(...).here()` cannot authorise). Deviation P26-07.
- The Share dialog shows the new code with the new link from the regenerate response, as it does for the link.

## 8. Screens

Each screen follows its mockup; the plan lists the deviations (P26-xx) for the owner before the screen is built.

### 8.1 Profile card — `ScreenUserSettings`, Profile

Avatar xl, beside it the block "Avatar & presence colour" with its sentence "Used for your avatar, live cursor and card lock." (P26-01: "card lock" leaves the sentence), the twelve swatches (`role="radiogroup"`, ring on the selected one, ←/→, accessible names "Colour 5"), then "Upload photo" and "Use initials". The colour is saved with the card's **Save** (field `presence_color`). The photo acts at once: choose a file → crop and resize in the browser → upload; the avatar shows the new photo. States: no photo ("Use initials" hidden when the style is already initials and there is no photo), photo, uploading (button busy), refused file (message under the buttons: type, size, unreadable), member choice off (photo controls absent, colours present).

### 8.2 Appearance card — `ScreenUserSettings`, Appearance

Under the language: switch "Reduce animations", help "Replaces card flips, confetti and drag tilts with simple fades. On by default when your system asks for it." (the mockup's words) Saved at once (PATCH), toast "Appearance saved.". When the system asks, the switch shows its stored value and a second line says "Your system already asks for fewer animations."

### 8.3 Password card — `ScreenSecurity`, Password

The rule list gains its breach line: while empty, "Not found in known data breaches" in the neutral state; while checking, a spinner; clear → met (check); breached → not met, "Found in known data breaches: choose another one"; unavailable → "Checked against known data breaches when you save". Set mode (no known password): title "Set a password", no current-password field, button "Set the password". Hidden when the policy refuses a password to this user.

### 8.4 Active sessions card — `ScreenSecurity`

Title "Active sessions", sentence "Devices signed in to your account." (P26-03: the location half goes). Header action "Sign out other sessions" (confirm dialog). Table: Device (icon laptop / smartphone / monitor-off for unknown, label), Last active (relative, "Active now" under 2 minutes), action "Sign out" (none on the current row, which carries the badge "This device"). Phone: a list of cards. Empty of others: the current row alone and the header action disabled. Driver not `database`: the sentence "This instance keeps sessions outside its database, so they cannot be listed here." and nothing else.

### 8.5 Linked accounts card — `ScreenSecurity`

Title "Linked accounts", sentence "Sign in with your company SSO or an existing account. Keep at least one way in." One row per enabled provider plus any linked row of a disabled one: logo or letter, provider label, then either "<email or id> · linked <date>" and "Unlink", or "Not linked" and "Link <provider>". The badge "Managed by your admin" replaces "Unlink" under decision 5C. "Used for your last sign-in" is not shown (P26-04: not recorded). The note "You can't unlink your last sign-in method: set a password or link another account first." shows under the list when the guard would refuse every unlink. Unlink asks for confirmation. Errors of the round trip come back as toasts.

### 8.6 Password-confirmation dialog and page

The existing dialog of the settings page (`password-gate.tsx`) and `auth/confirm-password` gain one outline button per linked enabled provider, "Confirm with <provider>", above the passkey button.

### 8.7 Guest join — `GuestJoin`, `MobileAccess`

`GuestJoinPage` passes `takenColors` and `initialPresence` to `GuestJoin`, which then shows the colour row and the preview (avatar on the colour, name, badge "Guest"); the POST carries `presence`. A taken colour is disabled and marked with the `user` icon (MobileAccess). Five pages: `retros/join`, `poker/join`, `whiteboards/join`, `surveys/join`, `games/join`.

### 8.8 Share dialog — `ShareDialog`

The five share mounts pass `invite.code` and `invite.joinUrl` (`<host>/join`, without scheme). "Copy the code" exists already. Regenerate updates both.

### 8.9 Join with a code — new page `join/code` (no mockup: P26-08)

Auth layout, card "Join a session", field "Session code" (mono, upper case, placeholder `ABC-1234`, autofocus, `autocomplete="off"`, the `Input` mockup's invalid state "The code has 8 characters" for a wrong length), button "Continue", link "Have an account? Sign in". The login page gains the link "Join a session with a code" under its form (P26-09).

## 9. Routes and validation

| Method and URL | Name | Controller | Middleware |
|---|---|---|---|
| POST `settings/profile/photo` | `profilePhotos.store` | `Settings\ProfilePhotosController@store` | auth, throttle:10,1 |
| DELETE `settings/profile/photo` | `profilePhotos.destroy` | `Settings\ProfilePhotosController@destroy` | auth |
| GET `avatar-photos/{file}` | `avatarPhotos.show` | `AvatarPhotosController@show` | — (`file`: `[a-z0-9]{40}\.(jpg|png)`) |
| PATCH `settings/motion` | `motionPreferences.update` | `Settings\MotionPreferencesController@update` | auth, verified |
| POST `settings/password/breach-range` | `passwordBreachRanges.store` | `Settings\PasswordBreachRangesController@store` | auth, verified, throttle:30,1 |
| DELETE `settings/sessions/{sessionKey}` | `browserSessions.destroy` | `Settings\BrowserSessionsController@destroy` | auth, verified, RequirePassword |
| DELETE `settings/sessions` | `otherBrowserSessions.destroy` | `Settings\OtherBrowserSessionsController@destroy` | auth, verified, RequirePassword |
| GET `settings/linked-accounts/{provider}` | `linkedAccounts.create` | `Settings\LinkedAccountsController@create` | auth, verified, RequirePassword |
| DELETE `settings/linked-accounts/{socialAccount}` | `linkedAccounts.destroy` | `Settings\LinkedAccountsController@destroy` | auth, verified, RequirePassword |
| GET `settings/confirmations/{provider}` | `ssoConfirmations.create` | `Settings\SsoConfirmationsController@create` | auth, throttle:10,1 |
| GET `auth/{provider}/callback` | `sso.callback` (moved out of `guest`) | `SsoCallbacksController@show` | — |
| GET `join` | `joinCodes.create` | `JoinCodesController@create` | — |
| POST `join` | `joinCodes.store` | `JoinCodesController@store` | throttle:10,1,joinCodes |

Validation: `presence_color` `['sometimes', 'nullable', 'integer', 'between:1,12']` on the profile; `photo` `['required', 'file', 'max:1024', 'mimetypes:image/jpeg,image/png', 'dimensions:max_width=4096,max_height=4096']`; `reduce_motion` `['required', 'boolean']`; `prefix` `['required', 'string', 'regex:/^[0-9A-Fa-f]{5}$/']`; `presence` on the five join POSTs `['sometimes', 'nullable', 'integer', 'between:1,12']`; `code` `['required', 'string', 'max:16']` then normalised.

Transactions lock the aggregate root first: the user row for link, unlink and sign-outs; the join-code issue relies on the unique pair, its insert in its own nested transaction.

## 10. Migrations of existing data

1. `users`: the four columns of §5.1, all nullable or defaulted; no rewrite of rows except `password_set_at`.
2. `password_set_at` backfill (Upgrade test, outside a transaction, can run again): a user with no social account gets `created_at`; a user whose earliest social account was created within 60 seconds of the user (an account created by SSO) stays null; any other user with social accounts gets `created_at`. A null that should not be (an SSO-born account whose owner later reset the password) only means the card offers "Set a password" behind a fresh confirmation.
3. The five participant tables: `presence_color` added, null for existing rows (their derived colour is unchanged).
4. `session_join_codes`: created empty; codes are issued at first use, so no session is rewritten.

## 11. Testing

- Feature tests for every route, guard and refusal; unit tests for `PresenceColor`, `ImageMetadata`, `JoinCode` (generation, normalisation), `SignInMethods`, `UserAgentSummary::deviceKind`.
- Races (`tests/Concurrency`, `Race`, on pgsql, mariadb, mysql and a SQLite file): two links of one user at once make one; two unlinks that would each leave one way in make one; two first uses of a session's code make one code.
- Upgrade test of the `password_set_at` backfill on the four engines.
- Vitest for the pure front logic (photo crop rectangle, SHA-1 range split and match, code normalisation, presence lookup, motion helper) and for every changed component.
- No browser walkthrough. Captures (light, 1440, fr) of the Profile card, the Appearance card, the Security section with both new cards, a guest join page, the Share dialog with its code and the join-by-code page.

## 12. Acceptance criteria

1. The profile shows twelve colours with the current one selected; saving another stores it; the value 13 is refused. A user who never chose has the colour `MailBrand::presence()` gives today, in mail and in sessions.
2. The member data of the retro, poker, whiteboard, survey and game presence channels carries `presence`; for a member it is the user's colour, for a guest the colour picked at join.
3. On every session type a member's cursor, avatar ring and presence-stack avatar use their presence colour; the same person has the same colour on two whiteboards.
4. A JPEG or PNG of at most 1 MB uploads; a GIF, an SVG, a file of 1.1 MB, an image of 5000 px and an unreadable file are refused with a message. The stored file contains no Exif, XMP, IPTC, comment or PNG text chunk. The served response is immutable-cached, `nosniff`, with the inert CSP.
5. After an upload, the user's avatar in the shared props, in a retro snapshot and in the presence channel is the photo; after "Use initials" it is the initials avatar and the file is gone; with member choice off, no photo shows and the controls are absent; deleting the account deletes the file.
6. "Reduce animations" on: the root element carries `reduce-motion` on the next page, the compiled CSS applies the reduced rules under it, and `prefersReducedMotion()` is true; off, the system setting still applies.
7. With the check on in production, `POST settings/password/breach-range` with `21BD1` returns the suffixes with a non-zero count of that range; it caches the range; a failed fetch answers 503 and is not cached; with the check off it answers 404 and `Password::defaults()` has no `uncompromised` rule. The verifier's timeout is the configured one.
8. Typing a breached password shows the not-met breach line before saving; a clean one shows the met line; without `crypto.subtle` the save-time sentence shows. No request carries more than five characters of the hash.
9. With the database driver, the security section lists the user's sessions, newest first, with device, kind, "This device" and last activity, and no session id or IP. Another user's sessions never appear.
10. "Sign out" deletes that session only and changes the remember token; signing out the current session is refused; an unknown key answers 404. "Sign out other sessions" leaves only the current one. Both require a fresh confirmation.
11. With another driver, the section says the list is unavailable and offers no action.
12. A signed-in user links Google from the card and comes back to the security section with the row linked; linking an identity linked to another account, or a second Google identity, is refused with its message; two links at once make one.
13. Unlinking is refused when no other way in remains (cases: SSO-only account with one identity; `sso_required` with a non-admin; mail disabled and no password), allowed otherwise; two unlinks at once never leave the account without a way in; another user's account answers 404.
14. While `sso_required` is in force, identities of enabled providers are "Managed by your admin" and cannot be unlinked.
15. A user without a known password confirms through a linked provider and then opens the security section; a different identity from the provider is refused; the password card then offers "Set a password" without a current password, and saving sets `password_set_at`. A non-admin under `sso_required` sees no password card.
16. A visitor of each of the five join pages sees the colours taken in that session disabled, joins with a free one, and their row stores it; with twelve taken nothing is disabled; 0 and 13 are refused.
17. A session's share data carries a code of the form `XXX-XXXX` from the alphabet of §5.11 for a viewer who sees the link, and none for a guest; regenerating the link changes the code and the old one stops resolving.
18. `POST join` with the code, in any case, with or without the hyphen, redirects to the session's join page; an unknown code, a code of a session that no longer accepts guests and a code of a deleted session all answer the same error; the eleventh attempt in a minute is throttled.
19. Every new string exists in the four languages, informal in French, Spanish and German (`InformalRegisterTest` passes); the captures of §11 are taken without horizontal overflow and compared with their mockups, the differences being rows of the plan's deviations table or fixed.
20. The unit, feature, upgrade and arch suites pass on PostgreSQL, SQLite, MariaDB and MySQL through `bin/test-db`, and the concurrency suite on PostgreSQL, MariaDB, MySQL and a SQLite file; `tests/Arch/DatabasePortabilityTest.php` passes.

## 13. Risks

- **The SSO callback leaves the `guest` group.** The one route every provider calls back now serves three flows (sign-in, link, confirm). A signed-in user without an intent must still land on the dashboard, and an intent must never be honoured for another user or another provider. Each branch has its test; the intent is pulled (read once) and carries the user id and provider.
- **Linking an identity is an account-takeover vector** if the intent can be planted: the link route requires a fresh confirmation, the intent lives in the server session, and the callback re-checks the signed-in user against it.
- **The remember token is cycled** by every sign-out: every remembered device must sign in again at the end of its session. Stated in the card's confirmation.
- **Public photos.** Anyone with the URL sees a photo, as anyone sees a generated avatar today; names are random and change on each upload. Metadata is stripped server side; pixel content is the user's choice.
- **Outbound call.** The live check sends a five-character prefix to the instance, which calls `api.pwnedpasswords.com`; an air-gapped operator turns it off with one variable.
- **Tailwind variant override.** Redefining `motion-reduce` / `motion-safe` with `@custom-variant` must keep the media query; the plan checks the compiled CSS (Task 4). If Tailwind refuses the override, the fallback is the global CSS rules under `html.reduce-motion` only, and the 126 `motion-*` uses keep following the system setting alone (reported).
- **`password_set_at` heuristic.** Wrong in one direction only (an SSO-born account that later reset its password reads "no password"): the consequence is the "Set a password" form behind a confirmation.
- **Brute force of codes.** 2.75 × 10¹⁰ codes, 10 tries per minute per address; a code only leads to the join page, which still asks for a nickname and enforces guest access.
- **Five copies.** Five participant tables, five join controllers, five share mounts, five token rotations: the plan treats them with datasets, not five hand-written tests.

## 14. Lanes and order (summary)

One back-end task on `users` first (single writer), then five lanes in worktrees: Presence (AC-4, GU-1), Photo (AC-1), Motion (AC-5), Security (AC-6, AC-2, AC-3), Codes (GU-2). They share `routes/settings.php`, `routes/web.php`, `app/Models/User.php` (different methods), `AccountSettingsController`, `SecuritySettings`, `account-settings.tsx` (one mount line each) and the four `lang/*.json`.

## 15. Decisions for the owner

**1. The photo: who processes it, and when may it show?**
- A. The browser crops and resizes to 512 px JPEG; the server checks type, size and dimensions and strips metadata; photos follow the existing switch "members choose their avatar". No new dependency, no new admin setting. **Recommended.**
- B. As A, plus an admin switch "Profile photos" of its own (one instance setting, one row in Administration › Branding).
- C. The server resizes and re-encodes: needs the GD extension in the production image (a dependency change to approve), and gives one size and format whatever the client.

**2. Active sessions on an instance whose sessions are not in the database (the SQLite setup uses files).**
- A. The card says the list is unavailable there, with no action. **Recommended:** honest, no change to the SQLite advice.
- B. Add Laravel's `AuthenticateSession` so that "Sign out other sessions" works on every driver (by rehashing the password); it also changes what a password change does to other devices on every instance.
- C. Hide the card where it cannot list.

**3. Location in Active sessions.**
- A. Not shown (no city, no "Unusual location"). **Recommended:** the owner did not ask for it; no IP is shown either.
- B. A city from a GeoLite2 database: a new dependency, a licence key and a monthly download for the operator.

**4. How does an account with no known password (created by SSO) confirm itself to open the security section?**
- A. "Confirm with <provider>": a round trip to a provider it has linked. **Recommended:** works under `sso_required` and without mail.
- B. An e-mail code (the second-factor code machinery with a new purpose); needs mail.
- C. Nothing new: such a user first sets a password through "Forgot password" (impossible under `sso_required`).

**5. Which linked identities are "Managed by your admin" and cannot be unlinked?**
- A. None by themselves: only the last-way-in guard decides.
- B. Always the company providers (Microsoft Entra and generic OIDC).
- C. While `sso_required` is in force, every identity of an enabled provider. **Recommended:** the badge then says something true ("your admin requires SSO"), and outside that setting the guard is enough.

**6. The breach check.**
- A. At save only, as today in production, plus the switch and the short timeout; the line keeps "Checked … when you save" (D-79 stays).
- B. Live while typing, by k-anonymity through the instance (five characters of the hash), plus at save, plus the switch. **Recommended:** the mockup's met / not-met line without the password leaving the browser.
- C. Live, the browser calling `api.pwnedpasswords.com` directly: no server endpoint, but every user's browser talks to a third party.

**7. The short code.**
- A. The mockup's literal form: three letters of the team, a hyphen, four digits (`ATL-4821`). 10 000 codes per team, easy to guess once the team is known.
- B. The mockup's shape, seven random characters without look-alikes (`K7Q-P4M2`), 2.75 × 10¹⁰ codes, throttled. **Recommended.**
- C. Ten random characters (`K7QP-4M2X-9R`): safer still, breaks the mockup's "8 characters".

**8. Guest colours.**
- A. Taken = the colours of everyone who has joined the session; the picker disables them while free ones remain; the server accepts any colour. **Recommended:** simple, no lock, faithful to the picker's "taken" state.
- B. Taken = the colours of the people online now: needs a presence roster for retro, whiteboard and survey (today only poker and games read one from Reverb).
- C. Unique colours enforced by the server under a lock (a 422 "taken" when two guests pick the same at once).

**9. Where is "join with a code" offered besides the Share dialog's "Join at …/join"?**
- A. The page `/join`, and a link "Join a session with a code" on the login page. **Recommended:** the login page is where a visitor without a link lands (`/` redirects there).
- B. The page `/join` only.
- C. A code field on the login page itself (the MobileAccess landing's button, on a page that has no mockup for it).

## 16. Not determined by reading

1. Whether Tailwind 4 accepts `@custom-variant motion-reduce` over its built-in variant with a block holding both the media query and the class selector (Task 4 checks the compiled CSS).
2. Whether every browser the owner supports encodes a canvas to JPEG with `toBlob` at the quality given (all current ones do; the fallback is the original file, refused by the server if over 1 MB).
3. How many existing accounts were created by SSO and later reset their password (the backfill's null case).
4. Whether a production instance runs the database session driver (the SQLite compose file uses files).
5. Whether any provider configured by an operator rejects the callback URL being called for a signed-in user (it is the same URL; nothing changes on the provider's side).
6. What `ProfileDeleteRequest` should ask of an account without a known password: deleting such an account is impossible today and stays so (out of scope, reported).
7. Whether the icebreaker players of a retro (game players carrying a `participant_id`) should show the participant's colour: they do through `HasGuestIdentity` of the participant; the plan verifies with a test.
