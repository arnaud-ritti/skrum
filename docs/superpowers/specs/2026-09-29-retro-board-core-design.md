# Skrum v1 — Retro Board Core — Design

Date: 2026-09-29
Status: Draft (awaiting review)

## 1. Intent

Skrum is an open-source, self-hostable alternative to QRetro. Anyone can deploy it; one instance serves many workspaces (multi-tenant).

**Success:** a team can run a complete retrospective in the browser — including participants without accounts — in realtime, on their own infrastructure, with no paid third-party service.

### In scope (v1)

- Workspaces → Teams → Retros tenancy, with workspace roles and team membership
- Configurable signup policy (`open` / `invite` / `domain`) and optional SSO (Google, GitHub, Microsoft Entra ID, generic OIDC)
- Guest participation via per-retro link
- Realtime board: templates, hidden writing phase, grouping, voting, facilitator-driven phases, shared timer, anonymous cards, basic action items
- Presence (who is online) with DiceBear avatars
- UI fully available in English, French, Spanish and German
- Docker image based on FrankenPHP + Laravel Octane, processes supervised by s6-overlay

### Out of scope (later specs)

- Action-item carry-over across retros, team retro history dashboards
- Integrations (Jira, Slack, …), exports (PDF/CSV/Markdown)
- Card comments and reactions
- Uploaded avatars, custom template library stored in DB
- Browser E2E test suite
- Instance-level admin UI beyond "first user is instance admin"

### Assumptions

- PostgreSQL is the only supported database.
- Existing stack stays: Laravel 13, Inertia v3 + React 19, Tailwind 4, Fortify, Wayfinder, Pest.

## 2. Domain model

```
users ─< social_accounts (provider, provider_user_id)
users >─< workspaces           via workspace_user (role)
workspaces ─< workspace_invitations (email, role, token, expires_at, accepted_at)
workspaces ─< teams >─< users  via team_user
teams ─< retros
retros ─< columns
retros ─< participants
columns ─< cards
cards ─< votes
retros ─< action_items
```

### Identifiers

Every table uses a UUID primary key (Eloquent `HasUuids`, time-ordered UUIDv7) — including `users` and framework tables that reference users (`sessions.user_id`, etc.). Foreign keys are `foreignUuid`. No auto-increment ids exist anywhere, so no id in a URL, payload or channel name is guessable or enumerable. The existing scaffold migrations are adjusted accordingly (no production data exists yet).

### Tables (key columns)

- **users**: Fortify defaults + `is_instance_admin` (bool), `current_workspace_id` (nullable FK).
- **social_accounts**: `user_id`, `provider` (string), `provider_user_id`, unique (`provider`, `provider_user_id`).
- **workspaces**: `name`, `slug` (unique).
- **workspace_user**: `workspace_id`, `user_id`, `role` (enum `WorkspaceRole`: `Owner`, `Admin`, `Member`), unique pair.
- **workspace_invitations**: `workspace_id`, `email`, `role`, `token` (unique, hashed), `invited_by`, `expires_at`, `accepted_at`.
- **teams**: `workspace_id`, `name`.
- **team_user**: `team_id`, `user_id`, unique pair.
- **retros**: `team_id`, `title`, `template` (enum `RetroTemplate`), `phase` (enum `RetroPhase`), `facilitator_participant_id` (nullable FK, set after creator's participant row exists), `is_anonymous` (bool, default false), `votes_per_participant` (int, default 5), `guest_access_enabled` (bool, default false), `guest_token` (unique string), `timer_ends_at` (nullable timestamp), `highlighted_card_id` (nullable FK), `completed_at` (nullable).
- **columns**: `retro_id`, `title`, `color`, `position`.
- **participants**: `retro_id`, `user_id` (nullable), `guest_name` (nullable), `guest_secret_hash` (nullable). Unique (`retro_id`, `user_id`) when `user_id` is not null.
- **cards**: `retro_id`, `column_id`, `participant_id`, `content` (text), `position`, `parent_card_id` (nullable self-FK).
- **votes**: `retro_id`, `card_id`, `participant_id`. Multiple rows per participant/card allowed.
- **action_items**: `retro_id`, `content`, `assignee_participant_id` (nullable), `is_done` (bool), `created_by_participant_id`.

### Modelling decisions

- **Participant** unifies members and guests. Cards, votes and action items reference a participant, never a user directly.
- **Templates** are a PHP enum `RetroTemplate` (`StartStopContinue`, `MadSadGlad`, `FourLs`, `WentWellToImproveActions`, `Custom`) exposing default column definitions. On creation, columns are copied into `columns` with titles translated into the creator's locale at that moment (stored text, not translation keys). Columns can be added/renamed/reordered/removed by the facilitator only while the retro is in `Writing` phase and has no cards in the affected column.
- **Grouping**: `parent_card_id` points to the group's lead card. Only one level of nesting: a lead card cannot itself have a parent. Grouping a lead card onto another card moves its children too. Votes target top-level cards only; if a card that already has votes (facilitator stepped back from Voting) is grouped under another card, its votes are reassigned to the new lead card.
- **Phases**: enum `RetroPhase` = `Writing`, `Grouping`, `Voting`, `Discussing`, `Completed`.
- **Anonymous**: the author is always stored (to allow editing/deleting own cards) but is never serialized to other participants when `is_anonymous` is true.
- **Timer**: only `timer_ends_at` is stored; clients render the countdown locally.

## 3. Authentication, tenancy and access

### Signup policy

Configured in `config/skrum.php` from env:

- `SKRUM_SIGNUP_MODE` = `open` | `invite` | `domain` (default `invite`)
- `SKRUM_ALLOWED_EMAIL_DOMAINS` = comma-separated list, used by `domain` mode

A single `SignupGate` class decides whether an email may create an account. It is used by both Fortify's `CreateNewUser` and the SSO callback.

| Mode | Allowed when |
|---|---|
| any | the `users` table is empty (first user; becomes `is_instance_admin`) |
| `open` | always |
| `invite` | a pending, unexpired invitation for that email is presented via its token (invitation link, carried in the session) |
| `domain` | email domain is in the allow-list, OR a matching invitation token is presented as above |

Requiring the token (not just a pending invitation for the email) stops someone who knows an invited address from registering it without access to that mailbox. Registering with a valid invitation token marks the email as verified and accepts the invitation.

The register page is hidden (and the route returns 403) when mode is `invite` and no invitation token is present, except for the first-user case.

### SSO

- Built on Laravel Socialite. Providers: Google, GitHub (Socialite core), Microsoft Entra ID (`socialiteproviders/microsoft-azure`), generic OIDC (`socialiteproviders/openidconnect`).
- A provider is enabled only when all of its env credentials are present. The login page renders buttons for enabled providers only.
- OIDC env: `OIDC_BASE_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_LABEL` (button text).
- Callback resolution order:
  1. `social_accounts` match → log in.
  2. Existing user with the same email **and** the provider reports the email as verified → create `social_accounts` link, log in.
  3. Otherwise → `SignupGate` check → create user (marked email-verified) + link, log in; or show "signup not allowed".

### Workspaces

- After first login, a user with no workspace lands on "create workspace" (skipped when they joined via invitation).
- The creator becomes `Owner`. A workspace always has at least one owner; the last owner cannot leave or be demoted.
- Users with several workspaces switch via a sidebar switcher which updates `current_workspace_id`.
- URLs are scoped by slug: `/w/{workspace}/teams/{team}/retros/{retro}`.
- Invitations are sent by email. If `MAIL_MAILER=log`, the invite UI also shows a copyable invitation link.

### Roles and permissions (policies)

| Action | Owner | Admin | Member |
|---|---|---|---|
| Delete workspace, transfer ownership | ✓ | | |
| Invite/remove workspace members, change roles (not Owner) | ✓ | ✓ | |
| Create/rename/delete teams, manage team membership | ✓ | ✓ | |
| See a team and its retros | ✓ (all) | ✓ (all) | only teams they belong to |
| Create a retro in a team | ✓ | ✓ | if team member |

**Retro facilitator** (initially the creator; transferable to another participant who is a team member, or to any workspace Owner/Admin — who is added as a participant if not one already; guests can never facilitate):
- change phase, set/clear timer, highlight card, change retro settings, edit columns, enable/disable/regenerate guest link, transfer facilitation, delete retro.

### Guests

- When `guest_access_enabled`, the link `/join/{guest_token}` lets anyone join. Regenerating `guest_token` revokes old links.
- A visitor without session enters a display name → a participant is created with a random secret; the secret is stored hashed, and the plain secret is kept in an encrypted cookie scoped to that retro. A returning guest with the cookie resumes the same participant.
- A logged-in member of the retro's team following the link joins as themselves.
- A logged-in user who is not a team member joins as a guest (display name prefilled with their name); this grants no team or workspace access.
- Guests may: add/edit/delete own cards, group cards, vote, add/edit action items. They never see workspace or team pages.
- A `Completed` retro opened via guest link is shown read-only while guest access remains enabled.

### Channel authorization

Presence channel `presence-retro.{id}`. A custom broadcasting auth route resolves the participant from either the authenticated user or the guest cookie, and returns participant id, display name and avatar URL as presence data.

### Avatars

- `dicebear/core` + `dicebear/styles` generate SVG avatars server-side.
- Route `/avatars/{seed}.svg`, seed = stable hash of user id (members) or participant id (guests). Long-lived cache headers.
- Style configured instance-wide via `SKRUM_AVATAR_STYLE`; default is a CC0-licensed style (e.g. `thumbs`). README lists the style licence.

## 4. Board data flow

### Initial load

The Inertia page `retros/show` receives a full board snapshot built **for the viewing participant** by a single `BoardSnapshot` class. All redaction logic lives there (and is reused for broadcast payloads).

### Mutations

The React board calls JSON endpoints (Inertia `useHttp`), for example:

- `POST /retros/{retro}/cards`, `PATCH /cards/{card}`, `DELETE /cards/{card}`
- `PUT /cards/{card}/position`, `PUT /cards/{card}/group`, `DELETE /cards/{card}/group`
- `POST /cards/{card}/votes`, `DELETE /cards/{card}/votes`
- `PUT /retros/{retro}/phase`, `PUT /retros/{retro}/timer`, `PUT /retros/{retro}/highlight`, `PATCH /retros/{retro}/settings`
- `POST /retros/{retro}/action-items`, `PATCH /action-items/{actionItem}`, `DELETE /action-items/{actionItem}`

Each endpoint: resolve participant → authorize (policy + phase rule) → persist in a transaction → dispatch a broadcast event after commit, excluding the sender's socket. The sender applies its change optimistically and rolls back on error.

### Events

`CardCreated`, `CardUpdated`, `CardDeleted`, `CardMoved`, `CardGrouped`, `CardUngrouped`, `VoteCast`, `VoteRetracted`, `PhaseChanged`, `TimerChanged`, `CardHighlighted`, `ActionItemSaved`, `ActionItemDeleted`, `RetroSettingsChanged`, `ColumnsChanged`.

### Redaction rules

| Data | Writing | Grouping | Voting | Discussing / Completed |
|---|---|---|---|---|
| Others' card content | hidden (id, column, position only) | visible | visible | visible |
| Card author (others' cards) | hidden | visible unless anonymous | visible unless anonymous | visible unless anonymous |
| Who voted | never exposed | never exposed | never exposed | never exposed |
| Own votes / remaining | — | — | visible | visible |
| Vote totals | — | — | hidden | visible |

- On `PhaseChanged` out of `Writing` (reveal) — and on any phase change — clients refetch the snapshot rather than receiving N card events.
- On websocket reconnect, clients refetch the snapshot.
- Vote events broadcast to others carry no card or participant data during `Voting` (only "votes changed" for progress display, e.g. "12/40 votes cast").

### Phase rules

| Phase | Allowed |
|---|---|
| Writing | add/edit/delete own cards; move own cards between columns/positions; facilitator edits columns |
| Grouping | anyone groups/ungroups/moves any card; edit/delete own cards |
| Voting | cast/retract votes on top-level cards, up to `votes_per_participant` total, several on the same card allowed |
| Discussing | facilitator highlights a card (all clients scroll to it); cards sortable by votes; anyone adds/edits/deletes action items and assigns them to a participant |
| Completed | read-only board; summary view (top-voted cards + action items); only facilitator can reopen (back to Discussing) |

- The facilitator can move to any adjacent phase (forward or back). Moving back from `Voting` keeps existing votes.
- Timer: facilitator sets a duration (or clears it) in any phase except `Completed`. At zero clients play a soft sound and show "time's up". Phases never auto-advance.
- Presence: an avatar strip shows online participants (from the presence channel).

## 5. Internationalization

- Supported locales: `en` (default and fallback), `fr`, `es`, `de`. Configured in `config/skrum.php` (`locales`), default from `APP_LOCALE`.
- **Locale resolution** per request, first match wins: authenticated user's `users.locale` → `locale` cookie (guests and logged-out visitors) → best match from `Accept-Language` → `en`. Done in a middleware; nothing stored in static state (Octane).
- **Switching:** members choose their language in settings (persisted to `users.locale`); logged-out visitors and guests use a language switcher on auth and guest pages (sets the cookie).
- **App strings:** one source of truth in `lang/{en,fr,es,de}.json`. PHP uses `__()`. Only the current locale's JSON is shared to React as an Inertia prop; a `useTrans()` hook exposes `t(key, replacements)` with the same `:placeholder` syntax as Laravel. No frontend i18n dependency.
- **Framework strings** (validation, auth, passwords, pagination) for `fr`, `es`, `de` come from `laravel-lang/common` as a dev dependency; generated `lang/` files are committed so production does not need the package.
- Every user-facing string — including the existing starter-kit auth and settings pages, emails and toast messages — goes through translation. A test fails if a key used in `en.json` is missing from any other locale file.
- Emails are sent in the recipient's locale when known (`users.locale`); invitations to unknown recipients use the inviter's locale.

## 6. Packaging and deployment

- Single Docker image based on **FrankenPHP** (Caddy built in) running **Laravel Octane** in worker mode. No nginx/PHP-FPM.
- Caddyfile reverse-proxies Reverb's websocket paths (`/app/*`, `/apps/*`) to Reverb on localhost, so only one port is exposed. Automatic HTTPS applies when `SERVER_NAME` is a public domain.
- **s6-overlay** supervises four long-running services: Octane, Reverb, queue worker, scheduler. Migrations run as an s6 oneshot at start-up (opt-out via env).
- Image published to GHCR. The repository ships an example `compose.yaml` for production: app + PostgreSQL.
- All configuration is env-driven; `.env.example` documents signup mode, SSO providers, Reverb, mail, avatar style.
- Local development keeps Sail, with a Reverb service added.
- **Octane constraint:** no request-specific state in singletons or static properties. The current participant and current workspace are resolved per request (request attributes / scoped bindings).

## 7. Error handling

- Rejected mutation (phase rule, vote limit, policy) → 403/422 JSON with a translated message → client rolls back and shows a toast.
- Target deleted concurrently → 404 → client removes the item locally.
- Websocket disconnected → "Reconnecting…" banner; HTTP mutations keep working; snapshot refetched on reconnect.
- Revoked or disabled guest link → join page shows "This link is no longer valid".
- SSO signup refused by `SignupGate` → login page shows "Signups are restricted on this instance".

## 8. Testing

- Pest feature tests per endpoint covering permissions, phase rules and vote limits.
- **Redaction is the main security invariant**: tests assert that neither the snapshot nor any broadcast payload delivered to another participant contains Writing-phase card content, anonymous authorship or voter identity.
- `Event::fake()` to assert broadcast events, channels and payloads.
- `SignupGate` matrix: mode × invitation × domain × first user.
- SSO callback tests with Socialite fakes (link by verified email, refuse unverified email linking, signup gate applied).
- Frontend: TypeScript type-check and existing lint. No browser E2E in v1.

## 9. Acceptance criteria

### Signup and SSO
- AC1: With an empty `users` table, the first registration succeeds in every signup mode and that user has `is_instance_admin = true`.
- AC2: In `invite` mode, registration without a valid invitation token matching the email is refused; with one, it succeeds and the user joins the inviting workspace with the invited role.
- AC3: In `domain` mode, registration succeeds for allow-listed domains and with a valid matching invitation token, and is refused otherwise.
- AC4: An SSO provider button appears only when all its env credentials are set.
- AC5: SSO login links to an existing account only when the provider reports the email verified; otherwise it follows the signup gate.
- AC6: SSO-created users are email-verified.

### Identifiers
- AC0: Every application table has a UUID primary key and UUID foreign keys; no auto-increment id column exists in the schema.

### Tenancy
- AC7: A user can create a workspace, becomes its Owner, and can switch between workspaces they belong to.
- AC8: Owners/Admins can invite members, create teams and manage team membership; Members cannot.
- AC9: A Member cannot see (403/404) teams or retros of teams they do not belong to.
- AC10: The last Owner cannot leave or be demoted.

### Retro lifecycle
- AC11: A team member can create a retro from any template; columns are copied from the template; the creator is the facilitator and a participant.
- AC12: Only the facilitator can change phase, timer, highlight, settings, columns, guest link, facilitation, or delete the retro.
- AC13: Phase-restricted actions outside their phase are rejected with 403/422 (e.g. adding a card in Voting, voting in Grouping).
- AC14: A participant cannot exceed `votes_per_participant` total votes; retracting a vote frees it.
- AC15: Grouping sets `parent_card_id` on the lead card; only one nesting level exists; votes on non-top-level cards are rejected.
- AC16: Completed retros are read-only for everyone; the facilitator can reopen to Discussing.

### Guests
- AC17: With guest access enabled, a visitor can join via `/join/{guest_token}` with a display name, and returning with the same cookie resumes the same participant.
- AC18: Regenerating the guest token invalidates the old link; disabling guest access blocks joining.
- AC19: A logged-in team member following the link joins as their own participant; a logged-in non-member joins as a guest without gaining team access.
- AC20: Guests cannot access any workspace or team page.

### Realtime and redaction
- AC21: Every mutation broadcasts its event on `presence-retro.{id}` after commit, excluding the sender.
- AC22: During Writing, other participants' snapshots and broadcast payloads contain no card content and no author.
- AC23: When `is_anonymous` is true, no snapshot or payload delivered to other participants contains a card's author.
- AC24: No snapshot or payload ever exposes which participant cast a vote; vote totals are hidden until Discussing.
- AC25: Phase changes cause clients to refetch the snapshot; reconnecting refetches the snapshot.
- AC26: Two browsers on the same retro see each other's changes within one second on a local deployment (manual check).
- AC27: Presence strip shows each online participant's DiceBear avatar and name.

### Timer and facilitation
- AC28: Facilitator can set and clear a timer; all participants see the same countdown derived from `timer_ends_at`.
- AC29: Highlighting a card in Discussing scrolls all clients to it.

### Action items
- AC30: In Discussing, any participant can create, edit, complete and delete action items and assign them to a participant; the Completed summary lists them.

### Internationalization
- AC34: The UI can be used entirely in each of `en`, `fr`, `es`, `de`; `lang/{fr,es,de}.json` contain every key of `lang/en.json`.
- AC35: Locale resolves in order user preference → cookie → `Accept-Language` → `en`; members can change it in settings and visitors via the switcher.
- AC36: Validation errors are shown in the active locale.

### Packaging
- AC31: `docker compose up` with the example compose file and a filled `.env` yields a working instance (web + websocket on one port) with migrations applied.
- AC32: Octane, Reverb, queue worker and scheduler are each supervised by s6 and restart after a crash.
- AC33: Test suite passes under the default test runner; no test depends on request state leaking between requests.
