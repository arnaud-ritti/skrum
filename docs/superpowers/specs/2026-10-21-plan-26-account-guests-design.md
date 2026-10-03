# Skrüm — Account, and what a guest picks — Design

Date: 2026-10-03
Status: the owner answered the nine questions of §15 on 2026-10-03 (`.superpowers/sdd/roadmap/progress.md`, "Owner answers 2026-10-03", "Plan 26"). Four answers differ from the drafted recommendation (1: an admin switch "Profile photos"; 2: the Active sessions card hidden without database sessions; 3: the IP address shown; 4: no confirmation for an account without a known password, an accepted risk, §5.12); the body below is written on the answers. The owner answered the plan's pre-build deviations the same day (progress.md, "Pre-build deviations (owner, 2026-10-03)", "P26"): P26-01 to P26-15 approved (04 and 06 as recommended, 03 with the full IP and no location, the others as listed; §15 bis). Nothing waits on the owner. Verification per plan runs on PostgreSQL only; the four engines run once at the end of the roadmap (owner, 2026-10-03). Execution: in parallel with plans 20, 21, 27 and 29, before 22, 23, 24 and 25.
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
2. **AC-1** While the admin switch "Profile photos" is on, a member uploads a photo, which replaces the generated avatar everywhere an avatar shows; "Use initials" (or "Remove photo") goes back to a generated avatar. No image metadata is published.
3. **AC-5** "Reduce animations" on the account reduces motion as the system setting does, on every page the member opens signed in.
4. **AC-6** The password card shows, while typing, whether the new password appears in known breaches, without the password or its full hash leaving the browser; an operator can turn the outbound check off; a failed check never stalls a save for 30 seconds.
5. **AC-2** A member sees the devices signed in to the account, with their browser and IP address, and signs one out or all the others; where sessions are not kept in the database the card is not shown.
6. **AC-3** A member links and unlinks SSO identities of the enabled providers; the last way in can never be removed; an account without a known password opens the security section without any confirmation (the owner's accepted risk, rule S-1 of §5.12) and can set a password.
7. **GU-1** A guest picks a colour on the join page; colours already used in the session are disabled while free ones remain.
8. **GU-2** Every guest-joinable session has a short code, shown in the Share dialog, entered at `/join`; regenerating the link replaces the code.
9. All database code is Eloquent and the standard query builder, unchanged on PostgreSQL, MySQL, MariaDB and SQLite; every test that touches the database passes on PostgreSQL in this plan, and on the four in the roadmap's final matrix.

## 3. Non-goals (stay backlog)

- By the owner's word (roadmap): other notification events, "last changed" of the password, "Change device" and "last used" of the authenticator, struck-through revoked tokens.
- Approximate location and "Unusual location" in Active sessions (decision 3; the IP address itself is shown).
- Listing or signing out sessions on an instance whose sessions are not in the database (decision 2: the card is hidden there; no `AuthenticateSession`).
- Any way for an account without a known password to confirm itself ("Confirm with <provider>", an e-mail code): it needs none (decision 4, rule S-1).
- A device model or browser version beyond `UserAgentSummary`'s labels ("MacBook Pro · Firefox 131" → "Firefox on macOS").
- Theme stored on the account ("Stored on this account, synced across devices"): the theme stays on the device; not in the owner's list.
- A guest changing name or colour after joining; members choosing a colour per session.
- The "card lock" use of the colour (no card lock exists; RT-1 of plan 21 may consume the colour).
- A `/s/{code}` short URL and QR changes (the QR keeps encoding the guest link).
- Server-side image resizing (decision 1: the browser crops), animated images, SVG photos.
- The "Print" button of recovery codes (D-26 stays) and anything of the former plans 28 and 30 and scheduling.
- Deleting an account that has no known password (the deletion form asks for the current password; `ProfileDeleteRequest`): left as it is, listed in §16.

## 4. Decisions already taken

| Topic | Decision | Source |
|---|---|---|
| Scope | the eight features, all built | owner, third round |
| Presentation | the mockups are binding; a difference is fixed or is a pre-build deviation approved by the owner (P26-01 to P26-15, approved 2026-10-03, §15 bis) | parent spec §5 rule 13; fifth round |
| Register | informal in every language (fr tu, es tú, de du), screens, validation, mails | sixth round |
| `sso_required` | only SSO signs in; instance admins keep password + second factor; ignored when no provider is enabled | 18f security answers |
| Guests | a guest counts as a participant | sixth round |
| Database | Eloquent only, portable to the four engines; races proved with `Race`; data migrations proved in `tests/Upgrade` | database portability, plan 19 |
| Working rules | tests written and run per task on PostgreSQL (data migrations and races included); whole PostgreSQL suites at the end of the plan; the four-engine matrix (pgsql, sqlite, mariadb, mysql) once, after the last roadmap merge; no browser walkthrough; captures light / 1440 / fr only; no new dependency without approval | owner, plan 19 rules, amended 2026-10-03 |
| Pre-build deviations | P26-01 to P26-15 approved; 03: the full IP shown, no location (overrides the `ScreenSecurity` README's "never the full IP"); 04: browser and system; 06: the linked date | owner, 2026-10-03 |
| The nine questions of §15 | answered: 1 browser crop + admin switch "Profile photos"; 2 card hidden without database sessions; 3 IP and browser, no location; 4 no confirmation for an account without a known password (accepted risk, §5.12); 5 managed while `sso_required`; 6 live breach check; 7 `XXX-XXXX` random, 10 tries a minute; 8 taken = everyone who joined; 9 `/join` and a link on the login page | owner, 2026-10-03 |

## 5. Domain and data

### 5.1 Columns on `users`

| Column | Type | Meaning |
|---|---|---|
| `presence_color` | unsigned tiny integer, nullable | the chosen colour, 1 to 12; null = derived |
| `avatar_photo_path` | string(64), nullable, hidden | `avatars/<40 lowercase letters and digits>.jpg` or `.png` on the `local` disk |
| `reduce_motion` | boolean, default false | "Reduce animations" |
| `password_set_at` | dateTime, nullable, hidden | when the owner of the account last chose a password; null = no password the owner knows (an account created by SSO). Null also exempts the account from every password confirmation of the account settings (rule S-1, §5.12) |

### 5.1 bis Instance setting

`InstanceSettingKey::ProfilePhotos` (`profile_photos`, boolean, default **off**: `InstanceSettings::DefaultProfilePhotos = false`), one of the Branding keys (the Branding reset clears it). Independent of "members choose their avatar" (`avatar_member_choice`): an admin may allow photos while keeping one generated style for everyone, or the reverse.

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
- Offered and shown only while the admin switch "Profile photos" is on (`InstanceSettings::profilePhotos()`, §5.1 bis, decision 1B); while it is off the stored photo is kept, neither offered nor shown, and the upload route answers 403. The switch sits in Administration › Branding, in the avatar group, under "members choose their avatar".
- "Use initials" removes the photo and sets the avatar style to `initials`, when members may choose their style. When they may not, the button reads "Remove photo" and only removes the photo: the instance's style shows again (P26-13).

### 5.7 Reduce animations (AC-5)

`users.reduce_motion`. The root view renders `<html class="reduce-motion">` for a signed-in user who has it on; the front toggles the class after a save. The CSS applies the same rules under `html.reduce-motion` as under `prefers-reduced-motion: reduce`, and Tailwind's `motion-reduce` / `motion-safe` variants are redefined to honour the class too. One helper, `prefersReducedMotion()`, replaces the four `matchMedia` reads. The system setting still applies when the switch is off.

### 5.8 Breach check (AC-6, decision 6)

- Config `skrum.passwords.breach_check` (env `SKRUM_PASSWORD_BREACH_CHECK`, default true) and `skrum.passwords.breach_check_timeout` (seconds, default 5). `Password::defaults()` keeps its production rule and adds `uncompromised()` only when the check is on; the `UncompromisedVerifier` is bound with the timeout.
- Live check by k-anonymity: the browser computes the SHA-1 of the new password (`crypto.subtle`), sends its first five hex characters to `POST settings/password/breach-range`, receives the suffixes of that range with a non-zero count, and compares locally. The server proxies `api.pwnedpasswords.com/range/{prefix}` (padding on), caches a range one day, answers 404 when the check is off and 503 when the range cannot be fetched (not cached). The password and its full hash never leave the browser; the server sees five characters.
- Where `crypto.subtle` is missing (a plain-HTTP instance), or on 404 / 503, the line falls back to "Checked against known data breaches when you save".

### 5.9 Active sessions (AC-2, decisions 2 and 3)

- Model `BrowserSession` over the framework's `sessions` table (string key, no timestamps). Read only when `config('session.driver') === 'database'`.
- A row: `key` (sha256 of the session id; the id itself never leaves the server), `device` (`UserAgentSummary::describe()`, browser and system, or "Unknown device"), `deviceKind` (`desktop` | `phone` | `unknown`, from the same header), `ipAddress` (the `ip_address` column as the framework stored it, IPv4 or IPv6, null when absent; decision 3: shown in full, no location), `isCurrent`, `lastActiveAt` (ISO 8601). Sorted by last activity, newest first, then by key.
- The address is the one the framework saw: behind a reverse proxy it is the client's only when `TRUSTED_PROXIES` is set (`App\Http\Middleware\TrustProxies`); otherwise every row shows the proxy's address. Shown only to the account's owner, behind the security section's protection.
- "Sign out" deletes that row; "Sign out other sessions" deletes every row of the user but the current one. Both cycle the user's remember token, so that a remembered device does not come back through its cookie. The current device stays signed in for its session.
- Driver other than `database`: the card is not rendered at all (decision 2C); the security props carry `browserSessions: null` and the two sign-out routes answer 404.

### 5.10 Ways in, linking and unlinking (AC-3, decisions 4 and 5)

`App\Support\Auth\SignInMethods::remaining(User $user, ?SocialAccount $without = null): array` lists what would still sign the user in:

| Way | Counts when |
|---|---|
| `sso:<provider>` | a linked account other than `$without` whose provider is enabled |
| `password` | `password_set_at` is not null and `SignInPolicy::allowsPassword($user)` |
| `magic_link` | `SignInPolicy::allowsLocalCredentials()`, mail is enabled and the address is verified |
| `passkey` | `allowsLocalCredentials()`, passkeys are enabled and the user has one |

- **Link.** From the Linked accounts card: `GET settings/linked-accounts/{provider}` (password confirmed, or no confirmation under rule S-1) stores an intent `link` in the session and sends to the provider. The callback route leaves the `guest` group and branches: a signed-in user with a `link` intent for themselves and this provider links; a signed-in user without one goes to the dashboard as before; a visitor signs in as today. There is no other intent (no "confirm" round trip: decision 4). `LinkSocialAccount` locks the user row, then refuses: an identity linked to another account; a second identity of the same provider on this account. The same identity again is a no-op.
- **Unlink.** `DELETE settings/linked-accounts/{socialAccount}` (own accounts only, 404 otherwise; password confirmed, or rule S-1). Locks the user row, then refuses when `remaining($user, $account)` is empty ("You can't unlink your last sign-in method: set a password or link another account first.") or when the account is managed by the admin.
- **Managed by your admin** (decision 5C, answered as recommended): while `sso_required` is in force, every linked identity of an enabled provider shows the badge "Managed by your admin" and has no "Unlink".
- **A provider turned off**: its linked rows stay listed with "Not available on this instance", count for nothing, and can be unlinked.
- **An account without a known password** (decision 4, the owner's own answer): it is asked for no confirmation anywhere in the account settings; rule S-1 of §5.12 says exactly where, and states the accepted risk.
- **Setting a password**: when `password_set_at` is null, the password card is titled "Set a password", has no current-password field, and its save needs no confirmation (rule S-1). From that save on, `password_set_at` is set and the account is confirmed like any other. When `allowsPassword($user)` is false (non-admin under `sso_required`), the password card is not shown (the mockup: "hidden if the account only has SSO").
- `password_set_at` is written by registration (`CreateNewUser`, which the invitation account form also uses), password reset (`ResetUserPassword`) and the password card (`SecurityController`). An account created by SSO leaves it null.

### 5.11 Join codes (GU-2, decision 7)

- Alphabet: `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (31 characters: no `0`, `O`, `1`, `I`, `L`). A code is three characters, a hyphen, four characters: `K7Q-P4M2`. 31⁷ ≈ 2.75 × 10¹⁰ codes.
- Input is normalised: upper case, spaces removed, the hyphen optional (`k7qp4m2` → `K7Q-P4M2`); anything else of the wrong length is refused before a query.
- `JoinCodes::for(Model $session): string` returns the session's code, creating it at first use (the share data of a viewer who may manage the link). Two first uses at once make one code (unique pair, the loser re-reads). A collision on `code` retries with a new code.
- `JoinCodes::rotate()` gives a new code whenever the guest link is regenerated (the five guest-token controllers); the response carries `joinCode`.
- Resolution: `POST join` with `code` → the code's session, if it still accepts guests by the same rule as its join page (retro, poker, whiteboard: `guest_access_enabled`; survey: guest access on, not a draft, not attached to a retro; game room: standalone with link access) → redirect to that session's join page. Otherwise one answer for every failure: "No session matches this code." Throttled at 10 attempts per minute per address (decision 7B, answered as recommended).

### 5.12 Security rules the owner accepted (do not "fix" them back)

The owner chose these rules on 2026-10-03 after the risk was spelled out to them. They are deliberate. An implementer or reviewer who finds them weak reports it; nobody adds a confirmation back, or narrows the rule, without the owner's new word. The code that carries a rule says so in its docblock with the rule's number.

**S-1. An account without a known password is never asked to confirm it in the account settings.**

1. *Who.* A signed-in user whose `password_set_at` is null (an account created by SSO, or one the backfill of §10 reads as such). Nothing else is required: not a linked identity, not a passkey.
2. *Where.* Every confirmation of the account settings lets such a user through at once:
   - the routes of `routes/settings.php` that ask for a fresh confirmation (opening the security and API-token sections, the e-mail second factor, signing sessions out, linking, unlinking, API tokens): they use `App\Http\Middleware\RequirePasswordUnlessNoneKnown` instead of the framework's `RequirePassword`;
   - Fortify's routes behind the `password.confirm` alias (two-factor setup, confirmation, disabling, recovery codes shown or regenerated, passkey registration and deletion): the alias points to the same middleware;
   - the protected props of the security and API-token sections (`AccountSettingsController`: `PasswordConfirmation::isSatisfied()`), and the settings page's gate, which opens no dialog for such a user;
   - the "Set a password" save (`PasswordUpdateRequest`: no current password, no confirmation).
3. *Where not.* The admin area (`routes/admin.php` keeps the framework's `RequirePassword`: an SSO-born admin sets a password first, or uses a passkey), account deletion (`ProfileDeleteRequest` still asks for the current password, §3), and anything outside the account settings.
4. *Until when.* As soon as the account gets a password (the card's "Set a password", a password reset), `password_set_at` is set and the normal confirmation applies from the next request.
5. *Accepted risk, in words.* Whoever holds a signed-in session of such an account (a stolen session cookie, an unlocked device left open) can, with nothing else, turn two-factor authentication off, read and regenerate the recovery codes, create API tokens, register a passkey of their own, link their own SSO identity (a lasting way in that survives the session), sign the owner's other devices out, and set a password. The owner was told the first three (2FA off, recovery codes, API tokens) and accepted the rule; the others follow from the same rule and are listed here so nobody discovers them later as a bug. The declined alternatives were a round trip to a linked provider ("Confirm with <provider>") and an e-mail code.
6. *The backfill's reach.* The 60-second heuristic of §10 can read as "no known password" an account born by SSO whose owner later reset the password, or a registered account that signed in by SSO within a minute of registering: those accounts also skip confirmation until their next password change. Accepted with S-1.
7. *Tests that hold the rule* (they assert the absence of a confirmation; a failing one means the rule was broken, not that a confirmation is missing): acceptance criterion 21 (§12), plan Task 13.

## 6. Permissions

| Action | Who |
|---|---|
| Presence colour, reduce animations | the signed-in user, for their own account (verified address not required for the profile, as today; required for appearance) |
| Photo | the signed-in user, for their own account, while the admin switch "Profile photos" is on (403 otherwise) |
| Switch "Profile photos" | an instance admin, in Administration › Branding |
| Read sessions and linked accounts | the user, behind the fresh password confirmation of the security section (as the other protected props); none for an account without a known password (S-1) |
| Sign out a session, link, unlink | the user, password confirmed; none asked of an account without a known password (S-1) |
| Set a password (no known password) | the user, with no confirmation (S-1) |
| Breach range | a signed-in user (throttled 30 per minute) |
| See a session's join code | whoever sees its guest link today (retro facilitator, poker and whiteboard non-guests, survey non-guests, game room manager) |
| Resolve a code | anyone, throttled |
| Pick a colour | a visitor of a guest join page |

## 7. Real time

- The five presence-channel authorisations add `presence` to the member data. Nothing else is broadcast: a guest's colour reaches the others with its `joining` event; a colour changed in settings reaches a session on the next subscription.
- The join page reads taken colours at load. It does not subscribe to the session's channel (a visitor is not a member yet; the mockup's `Echo.join(...).here()` cannot authorise). Deviation P26-07.
- The Share dialog shows the new code with the new link from the regenerate response, as it does for the link.

## 8. Screens

Each screen follows its mockup; the plan's deviations P26-01 to P26-15 are the only differences, all approved by the owner on 2026-10-03 (§15 bis).

### 8.1 Profile card — `ScreenUserSettings`, Profile

Avatar xl, beside it the block "Avatar & presence colour" with its sentence "Used for your avatar, live cursor and card lock." (P26-01: "card lock" leaves the sentence), the twelve swatches (`role="radiogroup"`, ring on the selected one, ←/→, accessible names "Colour 5"), then "Upload photo" and "Use initials". The colour is saved with the card's **Save** (field `presence_color`). The photo acts at once: choose a file → crop and resize in the browser → upload; the avatar shows the new photo. States: no photo ("Use initials" hidden when the style is already initials and there is no photo), photo, uploading (button busy), refused file (message under the buttons: type, size, unreadable), member style choice off ("Remove photo" in place of "Use initials", shown only with a photo; P26-13), switch "Profile photos" off (photo controls absent, colours present).

### 8.2 Appearance card — `ScreenUserSettings`, Appearance

Under the language: switch "Reduce animations", help "Replaces card flips, confetti and drag tilts with simple fades. On by default when your system asks for it." (the mockup's words) Saved at once (PATCH), toast "Appearance saved.". When the system asks, the switch shows its stored value and a second line says "Your system already asks for fewer animations."

### 8.3 Password card — `ScreenSecurity`, Password

The rule list gains its breach line: while empty, "Not found in known data breaches" in the neutral state; while checking, a spinner; clear → met (check); breached → not met, "Found in known data breaches: choose another one"; unavailable → "Checked against known data breaches when you save". Set mode (no known password): title "Set a password", no current-password field, button "Set the password". Hidden when the policy refuses a password to this user.

### 8.4 Active sessions card — `ScreenSecurity`

Title "Active sessions", sentence "Devices signed in to your account." (P26-03: the location half goes). Header action "Sign out other sessions" (confirm dialog). Table: Device (icon laptop / smartphone / monitor-off for unknown, label "Firefox on macOS"), IP address (in place of the mockup's "Approximate location": the address in `font-mono`, broken only between its groups (after a `:` or a `.`), "Unknown" when null; no map pin, no "Unusual location"; P26-03), Last active (relative, "Active now" under 2 minutes, on one line as the mockup's), action "Sign out" (none on the current row, which carries the badge "This device"). Phone: a list of cards, the address under the device label. Empty of others: the current row alone and the header action disabled. Driver not `database`: the card is not rendered; the Security stack closes up (P26-14).

### 8.5 Linked accounts card — `ScreenSecurity`

Title "Linked accounts", sentence "Sign in with your company SSO or an existing account. Keep at least one way in." One row per enabled provider plus any linked row of a disabled one: logo or letter, provider label, then either "<email or id> · linked <date>" and "Unlink", or "Not linked" and "Link <provider>". The badge "Managed by your admin" replaces "Unlink" under decision 5C. "Used for your last sign-in" is not shown (P26-04: not recorded). The note "You can't unlink your last sign-in method: set a password or link another account first." shows under the list when the guard would refuse every unlink; otherwise the card has no footer. Unlink asks for confirmation. Errors of the round trip come back as toasts.

### 8.6 Password-confirmation dialog and page

Unchanged for an account with a known password (password, or passkey). For an account without one (rule S-1) the settings page's gate (`password-gate.tsx`) opens no dialog: it loads the protected props when they were kept back and runs the action at once. `auth/confirm-password` is unchanged (it is only reached from the admin area for such an account, where S-1 does not apply).

### 8.6 bis Administration › Branding — switch "Profile photos"

In the avatar group (`avatar-style-grid.tsx`), under "Members can choose their own style": a `Switch` "Profile photos", help "Members can upload a photo that replaces their generated avatar. Photos are public, like avatars." Saved with the Branding form's **Save** (field `profile_photos`, `null` when left on its default, as the other switches). No mockup holds it (P26-15).

### 8.7 Guest join — `GuestJoin`, `MobileAccess`

`GuestJoinPage` passes `takenColors` and `initialPresence` to `GuestJoin`, which then shows the colour row and the preview (avatar on the colour, name, badge "Guest"); the POST carries `presence`. A taken colour is disabled and marked with the `user` icon (MobileAccess). Five pages: `retros/join`, `poker/join`, `whiteboards/join`, `surveys/join`, `games/join`.

### 8.8 Share dialog — `ShareDialog`

The five share mounts pass `invite.code` and `invite.joinUrl` (`<host>/join`, without scheme). "Copy the code" exists already. Regenerate updates both.

### 8.9 Join with a code — new page `/join` (no mockup: P26-08)

Auth layout, card "Join a session", field "Session code" (mono, upper case, placeholder `ABC-1234`, autofocus, `autocomplete="off"`, the `Input` mockup's invalid state "The code has 8 characters" for a wrong length), button "Continue", link "Have an account? Sign in". The login page gains the link "Join a session with a code" under its form (P26-09).

## 9. Routes and validation

| Method and URL | Name | Controller | Middleware |
|---|---|---|---|
| POST `settings/profile/photo` | `profilePhotos.store` | `Settings\ProfilePhotosController@store` | auth, throttle:10,1 |
| DELETE `settings/profile/photo` | `profilePhotos.destroy` | `Settings\ProfilePhotosController@destroy` | auth |
| GET `avatar-photos/{file}` | `avatarPhotos.show` | `AvatarPhotosController@show` | — (`file`: `[a-z0-9]{40}\.(jpg|png)`) |
| PATCH `settings/motion` | `motionPreferences.update` | `Settings\MotionPreferencesController@update` | auth, verified |
| POST `settings/password/breach-range` | `passwordBreachRanges.store` | `Settings\PasswordBreachRangesController@store` | auth, verified, throttle:30,1 |
| DELETE `settings/sessions/{sessionKey}` | `browserSessions.destroy` | `Settings\BrowserSessionsController@destroy` | auth, verified, RequirePasswordUnlessNoneKnown |
| DELETE `settings/sessions` | `otherBrowserSessions.destroy` | `Settings\OtherBrowserSessionsController@destroy` | auth, verified, RequirePasswordUnlessNoneKnown |
| GET `settings/linked-accounts/{provider}` | `linkedAccounts.create` | `Settings\LinkedAccountsController@create` | auth, verified, RequirePasswordUnlessNoneKnown |
| DELETE `settings/linked-accounts/{socialAccount}` | `linkedAccounts.destroy` | `Settings\LinkedAccountsController@destroy` | auth, verified, RequirePasswordUnlessNoneKnown |
| GET `auth/{provider}/callback` | `sso.callback` (moved out of `guest`) | `SsoCallbacksController@show` | — |
| PUT `admin/branding` (existing) | `admin.branding.update` | `Admin\BrandingController@update` | unchanged; gains the field `profile_photos` |

Every existing use of `RequirePassword::class` in `routes/settings.php` becomes `RequirePasswordUnlessNoneKnown::class`, and the alias `password.confirm` (Fortify's two-factor and passkey routes) points to it (`bootstrap/app.php`). `routes/admin.php` is not touched (S-1.3).
| GET `join` | `joinCodes.create` | `JoinCodesController@create` | — |
| POST `join` | `joinCodes.store` | `JoinCodesController@store` | throttle:10,1,joinCodes |

Validation: `presence_color` `['sometimes', 'nullable', 'integer', 'between:1,12']` on the profile; `photo` `['required', 'file', 'max:1024', 'mimetypes:image/jpeg,image/png', 'dimensions:max_width=4096,max_height=4096']`; `reduce_motion` `['required', 'boolean']`; `prefix` `['required', 'string', 'regex:/^[0-9A-Fa-f]{5}$/']`; `presence` on the five join POSTs `['sometimes', 'nullable', 'integer', 'between:1,12']`; `code` `['required', 'string', 'max:16']` then normalised; `profile_photos` on Branding `['present', 'nullable', 'boolean']`.

Transactions lock the aggregate root first: the user row for link, unlink and sign-outs; the join-code issue relies on the unique pair, its insert in its own nested transaction.

## 10. Migrations of existing data

1. `users`: the four columns of §5.1, all nullable or defaulted; no rewrite of rows except `password_set_at`.
2. `password_set_at` backfill (Upgrade test, outside a transaction, can run again): a user with no social account gets `created_at`; a user whose earliest social account was created within 60 seconds of the user (an account created by SSO) stays null; any other user with social accounts gets `created_at`. A null that should not be (an SSO-born account whose owner later reset the password) only means the card offers "Set a password" behind a fresh confirmation.
3. The five participant tables: `presence_color` added, null for existing rows (their derived colour is unchanged).
4. `session_join_codes`: created empty; codes are issued at first use, so no session is rewritten.

## 11. Testing

- Feature tests for every route, guard and refusal; unit tests for `PresenceColor`, `ImageMetadata`, `JoinCode` (generation, normalisation), `SignInMethods`, `UserAgentSummary::deviceKind`.
- Races (`tests/Concurrency`, `Race`, on PostgreSQL in this plan; MariaDB, MySQL and a SQLite file in the roadmap's final matrix): two links of one user at once make one; two unlinks that would each leave one way in make one; two first uses of a session's code make one code.
- Upgrade test of the `password_set_at` backfill on PostgreSQL in this plan, on the other three engines in the roadmap's final matrix.
- Vitest for the pure front logic (photo crop rectangle, SHA-1 range split and match, code normalisation, presence lookup, motion helper) and for every changed component.
- Rule S-1 has tests of its own that assert the **absence** of a confirmation for an account without a known password, and its presence for an account with one and in the admin area (criterion 21).
- No browser walkthrough. Captures (light, 1440, fr) of the Profile card, the Appearance card, the Security section with both new cards, the Branding avatar group with "Profile photos", a guest join page, the Share dialog with its code and the join-by-code page.

## 12. Acceptance criteria

1. The profile shows twelve colours with the current one selected; saving another stores it; the value 13 is refused. A user who never chose has the colour `MailBrand::presence()` gives today, in mail and in sessions.
2. The member data of the retro, poker, whiteboard, survey and game presence channels carries `presence`; for a member it is the user's colour, for a guest the colour picked at join.
3. On every session type a member's cursor, avatar ring and presence-stack avatar use their presence colour; the same person has the same colour on two whiteboards.
4. With "Profile photos" on, a JPEG or PNG of at most 1 MB uploads; a GIF, an SVG, a file of 1.1 MB, an image of 5000 px and an unreadable file are refused with a message. The stored file contains no Exif, XMP, IPTC, comment or PNG text chunk. The served response is immutable-cached, `nosniff`, with the inert CSP.
5. After an upload, the user's avatar in the shared props, in a retro snapshot and in the presence channel is the photo; after "Use initials" it is the initials avatar and the file is gone; with member style choice off, "Remove photo" removes it and the instance style shows, and a photo still shows while "Profile photos" is on; with "Profile photos" off (the default), no photo shows, the controls are absent and the upload answers 403; an admin turns it on and off in Branding, and the Branding reset turns it back off; deleting the account deletes the file.
6. "Reduce animations" on: the root element carries `reduce-motion` on the next page, the compiled CSS applies the reduced rules under it, and `prefersReducedMotion()` is true; off, the system setting still applies.
7. With the check on in production, `POST settings/password/breach-range` with `21BD1` returns the suffixes with a non-zero count of that range; it caches the range; a failed fetch answers 503 and is not cached; with the check off it answers 404 and `Password::defaults()` has no `uncompromised` rule. The verifier's timeout is the configured one.
8. Typing a breached password shows the not-met breach line before saving; a clean one shows the met line; without `crypto.subtle` the save-time sentence shows. No request carries more than five characters of the hash.
9. With the database driver, the security section lists the user's sessions, newest first, with device (browser and system), kind, IP address, "This device" and last activity, and no session id. Another user's sessions never appear.
10. "Sign out" deletes that session only and changes the remember token; signing out the current session is refused; an unknown key answers 404. "Sign out other sessions" leaves only the current one. Both require a fresh confirmation from an account with a known password.
11. With another driver, the security props carry `browserSessions: null`, the card is not rendered, and both sign-out routes answer 404.
12. A signed-in user links Google from the card and comes back to the security section with the row linked; linking an identity linked to another account, or a second Google identity, is refused with its message; two links at once make one.
13. Unlinking is refused when no other way in remains (cases: SSO-only account with one identity; `sso_required` with a non-admin; mail disabled and no password), allowed otherwise; two unlinks at once never leave the account without a way in; another user's account answers 404.
14. While `sso_required` is in force, identities of enabled providers are "Managed by your admin" and cannot be unlinked.
15. A user without a known password opens the security section with no confirmation; the password card offers "Set a password" without a current password, and saving it (with no confirmation) sets `password_set_at`; from the next request that user is asked to confirm like any other. A non-admin under `sso_required` sees no password card.
16. A visitor of each of the five join pages sees the colours taken in that session disabled, joins with a free one, and their row stores it; with twelve taken nothing is disabled; 0 and 13 are refused.
17. A session's share data carries a code of the form `XXX-XXXX` from the alphabet of §5.11 for a viewer who sees the link, and none for a guest; regenerating the link changes the code and the old one stops resolving.
18. `POST join` with the code, in any case, with or without the hyphen, redirects to the session's join page; an unknown code, a code of a session that no longer accepts guests and a code of a deleted session all answer the same error; the eleventh attempt in a minute is throttled.
19. Every new string exists in the four languages, informal in French, Spanish and German (`InformalRegisterTest` passes); the captures of §11 are taken without horizontal overflow and compared with their mockups, the differences being the approved rows P26-01 to P26-15 or fixed.
20. The unit, feature, upgrade and arch suites pass on PostgreSQL through `bin/test-db`, and the concurrency suite on PostgreSQL; `tests/Arch/DatabasePortabilityTest.php` passes. SQLite, MariaDB and MySQL (and the concurrency suite on a SQLite file) are proved once by the roadmap's final four-engine matrix, not by this plan (owner, 2026-10-03; risk accepted: an engine-specific regression is found late).
21. **Rule S-1 holds, both ways.** For an account whose `password_set_at` is null, with no confirmation in the session: `settings/security` leads to the section; the security and API-token props are sent (`locked` false); enabling two-factor authentication, showing and regenerating recovery codes, disabling it, creating an API token, adding the e-mail second factor, signing a session out, linking and unlinking all pass without a 423 or a redirect to `password.confirm`. For an account with a known password, each of these still asks (423 or redirect). For the null account, `admin/branding` (an instance admin) still redirects to `password.confirm`, and deleting the account still asks for the current password.

## 13. Risks

- **Rule S-1, accepted by the owner (§5.12).** A stolen session of an account without a known password is enough to turn 2FA off, read recovery codes, create API tokens, add a passkey or link the thief's own SSO identity. Not mitigated by design; stated in §5.12, in the middleware's docblock and in the report, and held by tests that a "fix" would break (criterion 21). Mitigation left to the user: setting a password ends the exemption for their account.
- **The SSO callback leaves the `guest` group.** The one route every provider calls back now serves two flows (sign-in, link). A signed-in user without an intent must still land on the dashboard, and an intent must never be honoured for another user or another provider. Each branch has its test; the intent is pulled (read once) and carries the user id and provider.
- **Linking an identity is an account-takeover vector** if the intent can be planted: the link route requires a fresh confirmation (except under S-1, accepted), the intent lives in the server session, and the callback re-checks the signed-in user against it.
- **The `password.confirm` alias is re-pointed.** Every Fortify route behind it now uses `RequirePasswordUnlessNoneKnown`; for an account with a known password it must behave exactly as the framework's middleware (same timeout, 423 for JSON, redirect otherwise). The class extends the framework's and overrides only `shouldConfirmPassword`; criterion 21 checks both sides.
- **IP addresses are personal data.** They are already stored by the framework's session table; the card shows a user only their own, behind the security section. Behind a proxy without `TRUSTED_PROXIES`, every row shows the proxy's address (an operator setting, said in the README note of Task 25).
- **Profile photos off by default.** An instance that upgrades shows no photo until an admin turns the switch on; stated in the README upgrade note.
- **The remember token is cycled** by every sign-out: every remembered device must sign in again at the end of its session. Stated in the card's confirmation.
- **Public photos.** Anyone with the URL sees a photo, as anyone sees a generated avatar today; names are random and change on each upload. Metadata is stripped server side; pixel content is the user's choice.
- **Outbound call.** The live check sends a five-character prefix to the instance, which calls `api.pwnedpasswords.com`; an air-gapped operator turns it off with one variable.
- **Tailwind variant override.** Redefining `motion-reduce` / `motion-safe` with `@custom-variant` must keep the media query; the plan checks the compiled CSS (Task 4). If Tailwind refuses the override, the fallback is the global CSS rules under `html.reduce-motion` only, and the 126 `motion-*` uses keep following the system setting alone (reported).
- **`password_set_at` heuristic.** Wrong in one direction only (an SSO-born account that later reset its password, or a registered one that signed in by SSO within a minute, reads "no password"): the consequence is the "Set a password" form and, under S-1, no confirmation in the account settings until the next password change (S-1.6, accepted).
- **Brute force of codes.** 2.75 × 10¹⁰ codes, 10 tries per minute per address; a code only leads to the join page, which still asks for a nickname and enforces guest access.
- **Five copies.** Five participant tables, five join controllers, five share mounts, five token rotations: the plan treats them with datasets, not five hand-written tests.

## 14. Lanes and order (summary)

One back-end task on `users` first (single writer), then five lanes in worktrees: Presence (AC-4, GU-1), Photo (AC-1, with the Branding switch), Motion (AC-5), Security (AC-6, AC-2, AC-3, rule S-1), Codes (GU-2). They share `routes/settings.php`, `routes/web.php`, `app/Models/User.php` (different methods), `AccountSettingsController`, `SecuritySettings`, `account-settings.tsx` (one mount line each) and the four `lang/*.json`; the Photo lane alone touches `InstanceSettings`, `InstanceSettingKey` and the Branding files, the Security lane alone `bootstrap/app.php`.

## 15. Decisions for the owner — answered 2026-10-03

The options are kept as they were put; the owner's answer follows each question. "≠ rec." marks an answer other than the drafted recommendation; the body above is written on the answers.

**1. The photo: who processes it, and when may it show?** — **Answered: B (≠ rec.).** The browser crops to 512 px JPEG, the server checks and strips metadata, **plus** an admin switch "Profile photos" of its own (§5.1 bis, §5.6, §8.6 bis).
- A. The browser crops and resizes to 512 px JPEG; the server checks type, size and dimensions and strips metadata; photos follow the existing switch "members choose their avatar". No new dependency, no new admin setting. (Was recommended.)
- B. As A, plus an admin switch "Profile photos" of its own (one instance setting, one row in Administration › Branding). **Chosen.**
- C. The server resizes and re-encodes: needs the GD extension in the production image (a dependency change to approve), and gives one size and format whatever the client.

**2. Active sessions on an instance whose sessions are not in the database (the SQLite setup uses files).** — **Answered: C (≠ rec.).** The card is hidden there (§5.9, §8.4).
- A. The card says the list is unavailable there, with no action. (Was recommended.)
- B. Add Laravel's `AuthenticateSession` so that "Sign out other sessions" works on every driver (by rehashing the password); it also changes what a password change does to other devices on every instance.
- C. Hide the card where it cannot list. **Chosen.**

**3. Location in Active sessions.** — **Answered (the owner's own wording, ≠ rec. on the IP): IP address and browser shown, no location.** No city, no "Unusual location", no GeoLite2; the IP address is shown in full (§5.9, §8.4).
- A. Not shown (no city, no "Unusual location"); no IP either. (Was recommended.)
- B. A city from a GeoLite2 database: a new dependency, a licence key and a monthly download for the operator.

**4. How does an account with no known password (created by SSO) confirm itself to open the security section?** — **Answered (the owner's own answer, none of A–C): it needs no confirmation**, to open the security section or to act there. Confirmed by the owner after the risk was spelled out (a stolen session can turn 2FA off, see the recovery codes, create API tokens). Recorded as the accepted security rule S-1 (§5.12) with its tests (criterion 21).
- A. "Confirm with <provider>": a round trip to a provider it has linked. (Was recommended; not built.)
- B. An e-mail code (the second-factor code machinery with a new purpose); needs mail. (Not built.)
- C. Nothing new: such a user first sets a password through "Forgot password" (impossible under `sso_required`). (Not built.)

**5. Which linked identities are "Managed by your admin" and cannot be unlinked?** — **Answered: C, as recommended.**
- A. None by themselves: only the last-way-in guard decides.
- B. Always the company providers (Microsoft Entra and generic OIDC).
- C. While `sso_required` is in force, every identity of an enabled provider. **Chosen.**

**6. The breach check.** — **Answered: B, as recommended** (live by k-anonymity through the instance, with its cache and its switch).
- A. At save only, as today in production, plus the switch and the short timeout; the line keeps "Checked … when you save" (D-79 stays).
- B. Live while typing, by k-anonymity through the instance (five characters of the hash), plus at save, plus the switch. **Chosen.**
- C. Live, the browser calling `api.pwnedpasswords.com` directly: no server endpoint, but every user's browser talks to a third party.

**7. The short code.** — **Answered: B, as recommended** (`XXX-XXXX` random, 10 tries a minute).
- A. The mockup's literal form: three letters of the team, a hyphen, four digits (`ATL-4821`). 10 000 codes per team, easy to guess once the team is known.
- B. The mockup's shape, seven random characters without look-alikes (`K7Q-P4M2`), 2.75 × 10¹⁰ codes, throttled. **Chosen.**
- C. Ten random characters (`K7QP-4M2X-9R`): safer still, breaks the mockup's "8 characters".

**8. Guest colours.** — **Answered: A, as recommended** (taken = everyone who joined).
- A. Taken = the colours of everyone who has joined the session; the picker disables them while free ones remain; the server accepts any colour. **Chosen.**
- B. Taken = the colours of the people online now: needs a presence roster for retro, whiteboard and survey (today only poker and games read one from Reverb).
- C. Unique colours enforced by the server under a lock (a 422 "taken" when two guests pick the same at once).

**9. Where is "join with a code" offered besides the Share dialog's "Join at …/join"?** — **Answered: A, as recommended** (`/join` and a link on the login page).
- A. The page `/join`, and a link "Join a session with a code" on the login page. **Chosen.**
- B. The page `/join` only.
- C. A code field on the login page itself (the MobileAccess landing's button, on a page that has no mockup for it).

## 15 bis. Pre-build deviations — answered 2026-10-03

The rows are listed in full in the plan ("Pre-build deviations"). The owner's answer (progress.md, "P26: 04 + 06 browser/OS and linked date (rec.); 03 now shows the IP (owner's earlier answer), no location; others approved"):

| Row | Subject | Answer, 2026-10-03 |
|---|---|---|
| P26-01 | Profile sentence without "card lock" | approved as listed |
| P26-02 | "Last changed" not rendered | approved as listed |
| P26-03 | Active sessions: "IP address" column, full address, no location, no "Unusual location" | approved: the IP is shown in full (the owner's earlier answer, over the mockup README's "never the full IP"), no location |
| P26-04 | Device label "Firefox on macOS" (browser and system) | approved, as recommended |
| P26-05 | "Sign out other sessions" behind the section's confirmation and a dialog | approved as listed |
| P26-06 | Linked accounts: "Linked :date" only | approved, as recommended |
| P26-07 | Taken colours read at page load | approved as listed |
| P26-08 | Join-with-a-code page designed from neighbours | approved as listed |
| P26-09 | Login link "Join a session with a code" | approved as listed |
| P26-10 | Code `K7Q-P4M2` in place of `ATL-4821` | approved as listed |
| P26-11 | Provider turned off: "Not available on this instance" and "Unlink" | approved as listed |
| P26-12 | "Set a password" mode, no confirmation | approved as listed |
| P26-13 | "Remove photo" when members cannot choose their style | approved as listed |
| P26-14 | No Active sessions card without database sessions | approved as listed |
| P26-15 | Branding switch "Profile photos" | approved as listed |

No answer changes what is built: every row already described the build. No screen waits on the owner.

## 16. Not determined by reading

1. Whether Tailwind 4 accepts `@custom-variant motion-reduce` over its built-in variant with a block holding both the media query and the class selector (plan Task 8 checks the compiled CSS).
2. Whether every browser the owner supports encodes a canvas to JPEG with `toBlob` at the quality given (all current ones do; the fallback is the original file, refused by the server if over 1 MB).
3. How many existing accounts were created by SSO and later reset their password (the backfill's null case): under S-1 they also skip confirmation until their next password change (S-1.6).
4. Whether a production instance runs the database session driver (the SQLite compose file uses files): there, the Active sessions card is simply absent.
5. Whether any provider configured by an operator rejects the callback URL being called for a signed-in user (it is the same URL; nothing changes on the provider's side).
6. What `ProfileDeleteRequest` should ask of an account without a known password: it still asks for the current password (S-1.3), so such an account sets a password first (now possible without confirmation), then deletes. Out of scope, reported.
7. Whether the icebreaker players of a retro (game players carrying a `participant_id`) should show the participant's colour: they do through `HasGuestIdentity` of the participant; the plan verifies with a test.
8. **Ruled 2026-10-03.** The switch "Profile photos" is **independent** of the member style choice (a photo may show while members cannot pick a style; "Use initials" then reads "Remove photo"): the owner approved P26-13 and P26-15, which build exactly that. It is **off by default** (like "Members can choose their own style"): the safe default for an upgrade, so an upgraded instance shows no photo until an admin allows it; the README upgrade note says so. The report restates it; an admin turns it on in one click.
9. **Ruled 2026-10-03.** Rule S-1 stops at the account settings; the admin area keeps its confirmation (an SSO-born admin without a password sets one first, or uses a passkey). The owner's words were "to open security or act there", which name the security section, not the admin area (S-1.3).
10. **Ruled 2026-10-03.** The owner was told three consequences of S-1 (2FA off, recovery codes, API tokens); the rule also lets a stolen session add a passkey, link an SSO identity of its own, sign the other devices out and set a password (S-1.5). They follow from the same answer ("or act there") and are built as such; the report lists them again.
11. Plan 29 (built beside this plan) asks a fresh confirmation, by password or passkey, before an instance admin changes SSO or SMTP settings. Under S-1 a passwordless SSO-born admin can register a passkey with no confirmation, and that passkey then satisfies plan 29's check. This plan changes nothing in the admin area (S-1.3); the combination is recorded in plan 29's spec as its own open point and does not hold this plan.
