# Skrum — Team invitations, the invite link, and the four-step onboarding (registration included) — Design

Date: 2026-10-03 (drafted for the owner; revised the same day with the owner's answers to §16, then with the owner's answers to the plan's pre-build deviations)
Status: **approved for execution, 2026-10-03.** The owner answered the nine questions of §16 on 2026-10-03 (`.superpowers/sdd/roadmap/progress.md`, "Owner answers 2026-10-03", line "Plan 25"). Six answers are the recommended option; three differ from it and the body is written on them: decision 2 (the team's facilitators also invite), decision 3 (the invite link has an expiry and no use limit), decision 7 (a team slug, unique per workspace, with the redirect route `/t/<slug>`). The owner then answered the plan's pre-build deviations P25-01 to P25-17 on 2026-10-03 (`progress.md`, line "P25: …"; §16.1): three against the recommendation and now built — P25-03 "Skip for now" on step 2 as the mockup (§8.5), P25-10 the "session in progress, join it" banner after joining (§8.8), P25-15 an instance default workspace that new SSO accounts join, step 1 skipped (§6.4) —, P25-02 obsolete, the others approved as listed. The readings of §16 (notes) are ruled on the owner's behalf. The owner's "Oui vas y" of 2026-10-03 covers the execution once the specs are revised. Execution order of the roadmap: plans 20, 21, 26, 27, 29 in parallel → 22 → 23 → 24 and 25 (§13).
Parent spec: `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` (§5 rules, rule 13; §9.2 back-end conventions; §10 backlog).
Owner's word: `docs/superpowers/research/front-rewrite/owner-answers-2026-10-02.md` — third round (security: "Invitation through SSO", "Invitation in the bell"; "Features to specify after the rewrite": "Invitations: team invitations, inviter's message, Decline, team invite link"; "Onboarding: the four-step onboarding"), fourth round (D-52: registration that creates a workspace and a team is specified with the onboarding; D-54: the invitation card; "Expired invitation"), fifth round (roadmap change: scheduling is backlog; working rules), sixth round (informal register; guests count as participants).
Roadmap rows: IN-1, IN-2, IN-3, IN-4 and ON-1 of `docs/superpowers/research/front-rewrite/feature-roadmap.md`, plus the registration line of its header note (owner, 2026-10-02). Deviation rows cleared: D-30 (wholly, except "already in n teams", backlog), D-33, D-52, the "Invite" part of D-18, the "button names the workspace" part of D-54.
Mockups (binding for presentation, parent spec §5 rule 13): `docs/design-system/components/ScreenOnboarding` (a: onboarding step 2 in full and steps 1, 3, 4 reduced; b: accepting an invitation, with the signed-in, expired and declined variants), `ScreenAuth` (the "Inscription" variant), `ScreenTeam` ("Invite" in the members card), `ScreenSettings` frame a (the Members card: "Invitation link", "Invite", a pending invitation row with "Resend"), `Emails` (the invitation mail, `kind: 'team' | 'workspace'`, team block and inviter's message), `NotificationsPanel` (the `team_invite` item), `PhaseStepper`. For each, the `README.md` and the `preview.html`.
Database rules: `docs/database.md`, "Rules for database code" 1 to 12.

What was read, and what was not: `main` at `18d3637e` (front rewrite, database portability, plan 19). Read: `WorkspaceInvitation` and its migrations, `CreateWorkspaceInvitation`, `AcceptWorkspaceInvitation`, `IssuedInvitation`, `WorkspaceInvitationsController`, `InvitationLinksController`, `InvitationAcceptancesController`, `InvitationAccountsController`, `CreateNewUser`, `SignupGate`, `ResolveSsoUser` and `SsoCallbacksController` (their invitation lines), `FortifyServiceProvider` (register view, limiters), `WorkspaceInvitationNotification`, `WorkspaceInvitationReceivedNotification`, `WorkspaceInvitationMail`, the notification presenters (`ListNotifications`, `BellNotifications`, `PresentInvitationNotifications`, `ForgetInvitationNotifications`), `WorkspacePolicy`, `TeamPolicy`, `TeamMembersController`, `WorkspaceMembersController`, `WorkspacesController`, `CurrentWorkspaceController`, `CreateWorkspace`, `TeamsController`, `Team`, `Workspace`, `User` (workspace and team helpers), the `team_user` migration, `routes/web.php` (auth, invitations, workspace scope); on the front `layouts/skrum/onboarding-layout.tsx`, `components/skrum/frames.tsx` (`OnboardingFrame`), `pages/invitations/show.tsx`, `components/auth/invitation-card.tsx`, `components/auth/register-form.tsx`, `pages/workspaces/create.tsx`, `components/workspaces/{create-workspace-form,invite-form,members-table}.tsx`, `components/teams/{team-page,team-members-card}.tsx`, `components/teams/session-create/use-new-session-intent.ts`, `components/skrum/{notifications-panel,column-color-picker,phase-stepper}.tsx`, `lib/mark-color.ts`. **Not read because it does not exist yet:** the team roles of TM-6, the team description of WS-1 and the team-settings Members tab of WS-3, all three in roadmap plan 23 (§13). Nothing was run. Read again for the revision (decision 7): `Team` (fillable, no slug), `TeamsController::store` and `update` (the only places a team is created or renamed outside factories and seeders), `CreateWorkspace` (how workspace slugs are made), the `w/{workspace}` route group, `database/migrations/2026_10_19_100200_add_email_key_to_users_table.php` and `tests/Upgrade/EmailKeyBackfillTest.php` (the pattern of a re-runnable fill and its upgrade test), the `ScreenOnboarding` frame of step 2 ("Team link skrum.nordlys.fr/t/atlas") and the `ScreenErrors` frames that address a team as `/t/atlas`; plan 23's draft spec (`TeamRole::managesRituals()`, the Members & rituals tab a facilitator reaches, the General tab that takes the rename).

## 1. Problem statement

An invitation today is to a workspace only, with a workspace role (`workspace_invitations`: e-mail, role, token hash, inviter, expiry, acceptance). It carries no team, no team role, no message; it cannot be declined; there is no link a team can share. The invitation card of the rewrite leaves three places for the team's mark, the message and "Decline" (`InvitationCardProps.team|message|decline`), the team page leaves a place for "Invite" (`TeamMembersCard.inviteAction`), the invite dialog leaves places for teams and message (`InviteSlots`).

A newcomer who registers lands on "Name your workspace" inside the application shell (`workspaces/create`, reached through `CurrentWorkspaceController` when the user has no workspace). The mockups draw a four-step onboarding without a sidebar (workspace, team, invitations, first ritual), and a registration titled "Create your workspace" with a "Team name" field. `OnboardingLayout` exists and nothing renders it.

## 2. Goals

1. A person who may manage a team's members, or a facilitator of the team, invites people to that team by e-mail, several at once, with a team role and an optional message; the invited person sees the team, the role and the message on the invitation page and in the mail, accepts (joining the workspace and the team) or declines; the inviter is told of a decline in the bell.
2. A team has one invite link at a time, with an expiry and no limit on the number of people who use it; anyone with a verified account who opens it joins the team as a member; the link stops at its expiry or when it is replaced or turned off. The people who joined through it are counted and the count is shown to the team's inviters.
3. A person who registers without an invitation or a link is taken, once their address is verified, through the four steps of the mockup: name the workspace, create the first team (or "Skip for now", which ends the onboarding there — P25-03), invite (or skip), pick a first ritual (or go to the team page). Every step is saved on "Continue" and the onboarding resumes where it was left.
4. Registration follows the "Inscription" mockup: "Create your workspace", with a "Team name" field that prefills step 2.
5. Nothing that works today stops working: workspace invitations without a team, the account created on the card (S35), SSO through an invitation (with its verified-address rule), the bell item that links to the invitation page, `workspaces/create` for a second workspace.
6. Database code is Eloquent and the standard query builder only and runs unchanged on PostgreSQL, MySQL, MariaDB and SQLite; every test that touches the database passes on the four.
7. A team has a short address, its slug, unique in its workspace: `/t/<slug>` leads to the team page. The slug is derived from the name when the team is created, can be edited at onboarding step 2 and in the team settings, and every existing team receives one.
8. An instance admin may name a **default workspace**: an account created through SSO that no invitation and no invite link brought joins it as a member and starts the onboarding at step 2, step 1 being the admin's (P25-15, the mockup's "In self-host with forced SSO, step 1 is filled by the admin and skipped").
9. Whoever lands on a team page right after accepting a team invitation or joining by a link is offered the team's session in progress, if there is one, in a banner with "Join" (P25-10, the mockup's "if a session is in progress, a banner offers to join it").

## 3. Non-goals (what stays in the backlog)

- "already in n teams of :workspace" on the signed-in invitation card (roadmap: backlog).
- "Ask for a new invitation" on the expired card (D-54: backlog). The expired card keeps naming the inviter.
- The "When · optional" date of step 4, any start time or "starts in 5 min" notification: scheduling is backlog (owner, fifth round). Nothing is reserved for it.
- Session addresses under the team slug (`/t/atlas/retro/sprint-24`, drawn in `ScreenErrors`): only `/t/<slug>` itself exists (decision 7); every other route keeps the team's id. A slug that was edited does not keep its old address: the old `/t/<old>` answers 404.
- A limit on the number of people who use an invite link, and a choice of its expiry (decision 3, option C): the expiry is fixed at 7 days.
- The workspace logo of step 1 (decision 6, option B; P25-01 approved): plan 26 now merges before this plan, but it builds profile photos (AC-1), not a workspace logo; the logo stays backlog and its place is left.
- An invitation answered from the bell ("Accept" / "Decline" buttons): the owner ruled that the bell links to the invitation page and that no token-less route exists (third round). "Decline" lives on the invitation page only.
- A mail to the inviter on a decline (decision 5, option A).
- A default workspace for accounts created otherwise than through SSO (password registration, magic link, e-mail code), for SSO accounts created before the setting, or a default team: the owner's answer to P25-15 names new SSO accounts. A choice of role in the default workspace: always `member`.
- Invitations to several teams at once (decision 9, option A); team invitations through the MCP server or the API.
- Mentions, scheduling, whiteboard collaboration (former plans 30, 22-scheduling and 28): backlog.

## 4. Decisions already taken

| Topic | Decision | Source |
|---|---|---|
| Invitations wanted | Team invitations, inviter's message, "Decline", team invite link | owner, third round, "Features to specify after the rewrite" |
| Onboarding wanted | The four-step onboarding | owner, same list |
| Registration | Registration that creates a workspace and a team is specified here (mockup: "Create your workspace", "Team name") | owner, fourth round D-52; roadmap header note |
| Invitation page, logged out | Account created on the card: locked e-mail, "Create a password", "Create my account and join …"; a "First and last name" field (PB-46 B) | owner, fourth round D-54 |
| SSO and invitations | SSO buttons on the invitation page; an SSO address the provider does not mark verified is refused even with a matching invitation | owner 11-D2; third round, security |
| Invitation in the bell | The notification links to the invitation page; no token-less accept route; the token is stored encrypted in the notification | owner, third round and approval |
| Expired invitation | The page names the workspace and the inviter | owner, fourth round |
| Revoking an invitation | Asks for confirmation | owner 9-D5 |
| Scheduling | Backlog: the date of step 4 is not built | owner, fifth round, roadmap change |
| Register | Informal everywhere: French "tu", Spanish "tú", German "du"; English unchanged; this overrides the mockups' "vous" | owner, sixth round; `tests/Feature/InformalRegisterTest.php` |
| Presentation | The mockup wins; an element with no data is omitted, listed and its place left | parent spec §5 rule 13 |
| Database | Eloquent and the standard query builder only; four engines; races proved with `Race` | owner; `docs/database.md` |
| Tests | Unit and feature tests written and run per task on PostgreSQL, races with `--concurrency` and the data migration's upgrade test on PostgreSQL, the PostgreSQL suites at the end of the plan; the other three engines at the roadmap's final matrix; no browser walkthrough; captures in light, 1440, French | owner, working rules, as changed on 2026-10-03 |
| The nine questions of §16 | Answered: 1 A, 2 B, 3 C, 4 A, 5 A, 6 B, 7 B, 8 A, 9 A | owner, 2026-10-03 (`progress.md`, line "Plan 25") |
| The plan's pre-build deviations | P25-03 "Skip for now" on step 2 as the mockup (skips 3 and 4 too), ≠ rec.; P25-10 add the "session in progress, join it" banner after accepting, ≠ rec.; P25-15 an instance DEFAULT WORKSPACE admin setting: new SSO accounts join it and step 1 is skipped, ≠ rec.; P25-02 obsolete (team slug chosen); others approved | owner, 2026-10-03 (`progress.md`, line "P25: …"); §16.1 |
| Engines per plan | Per task and per merge PostgreSQL only; the four-engine matrix runs once after the roadmap's last merge (plans 24 and 25). Portability rules unchanged | owner, 2026-10-03 ("Lance les 4 bases seulement à la fin") |
| Execution order | Plans 20, 21, 26, 27, 29 in parallel → 22 → 23 → 24 and 25 | owner, 2026-10-03 |

## 5. Rules and vocabulary

The rules of the parent spec §5 apply to every front file; §9.2 applies to the back end (actions in `app/Actions/<Domain>`, plural controllers with CRUD method names, `Gate::authorize`, UUID keys, migrations with `up` only). `docs/database.md` rules 1 to 12 apply to every line of PHP, migration and test: no raw query, no driver branch, aggregates cast in PHP, a transaction locks its aggregate root first, explicit tie-breakers, `Alphabetical::sort()` for lists people read, addresses compared through `LoginAddress::normalise()`, no write that skips model events.

| Term | Meaning |
|---|---|
| invitation | A row of `workspace_invitations`: one address, one workspace role, optionally one team with a team role, optionally a message. "Team invitation" when it has a team. |
| invite link | A row of `team_invite_links`: a shareable URL that adds whoever opens it to one team, until it expires or is replaced or turned off. Not personal: it has no address. No limit on the number of people who use it (decision 3). |
| inviter | `invited_by_id` of an invitation; `created_by_id` of a link. |
| team inviter | Someone who may invite to a team: `TeamPolicy::invite` (§7) — who manages the team's members, plus the team's facilitators (decision 2). |
| team slug | `teams.slug`: the team's short address, lower-case letters, digits and single hyphens, unique in its workspace; `/t/<slug>` redirects to the team page (decision 7). Not to be confused with the invite link. |
| onboarding | A row of `onboardings`: the progress of one user through the four steps. A user without a row has nothing to complete. |
| default workspace | The instance setting `default_workspace` (P25-15): the workspace that new SSO accounts join, set by an instance admin. Unset by default. |
| session in progress | A session of the team in plan 22's state **Live** (its spec §6.1: a retro started and not completed, a poker game with a round and not ended, an open poll, a whiteboard touched in the last 15 minutes, an icebreaker room with a round in play). |
| team role | TM-6 (plan 23): owner, facilitator, member, observer, stored on `team_user`. This spec names it `App\Enums\TeamRole`; the plan reads the name plan 23 gives it. |

## 6. Domain and data

### 6.1 Changes to existing tables

Migrations are dated `2026_10_25_…` (after plan 19's `2026_10_20_…`; the plan re-dates them if a plan merged before this one used later dates).

**`workspace_invitations`**, added (all nullable, so that every existing row stays valid):

| Column | Type | Meaning |
|---|---|---|
| `team_id` | uuid, foreign key to `teams`, cascade on delete | the team the person joins on acceptance. A deleted team takes its pending invitations with it: an invitation to a team that no longer exists would land a stranger in the workspace. |
| `team_role` | string(20) | a `TeamRole` value other than `owner`; set exactly when `team_id` is set |
| `message` | string(500) | the inviter's message, plain text |
| `declined_at` | timestamp | set by "Decline"; the invitation is then no longer pending |

Index `(team_id, accepted_at)` for the team's pending list. `WorkspaceInvitation::isPending()` becomes: not accepted, not declined, not expired.

**`teams`**, added: `color` string(20), nullable, a `ColumnColor` value (the eight column colours). Null means "not chosen": every reader then uses the colour the front already derives from the id (`lib/mark-color.ts`), computed the same way on the server by `App\Support\Teams\TeamMark::colorFor(Team)` for the mail. Nothing is backfilled.

**`teams`**, added (decision 7): `slug` string(50), not null once filled, unique index `(workspace_id, slug)`.

- Form: lower-case ASCII letters and digits in groups joined by single hyphens (`^[a-z0-9]+(-[a-z0-9]+)*$`), 2 to 50 characters. Being lower case by rule, it compares the same on the four engines (no case folding, no `slug_key`).
- Derived when the team is created: `Str::slug($name)` cut to 50 characters at a hyphen when possible, `team` when that is empty or shorter than 2; when the workspace already has it, the first free of `<base>-2`, `<base>-3`, … (the base cut so that the whole stays within 50). Written by `App\Support\Teams\TeamSlug` through the model's `creating` hook when no slug is given, so factories, seeders and every creation path get one.
- Never changed by a rename: a link someone shared keeps working. Changed only by an explicit edit (onboarding step 2, the team settings General tab), validated as above and unique in the workspace; an edit to a slug the workspace already has is a field error, also when two edits race (the unique index answers, the error is the same).
- Two teams created at the same moment in one workspace with the same name both exist, with two slugs: `App\Actions\Teams\CreateTeam` inserts in its own nested transaction and, on a unique-constraint violation of the slug, derives the next free slug and inserts again (at most 5 attempts). No lock on the workspace row is added to team creation.
- **Existing teams** (data migration, the only one of this spec): the migration adds the column nullable, fills every team that has none, per workspace, in the order `created_at`, then `id`, with the rule above (so in a workspace with two teams named "Atlas" the older one gets `atlas` and the other `atlas-2`), then makes the column not null and adds the unique index. It runs outside a transaction and fills only rows without a slug, so a run that stopped can be started again; it writes each team once. Proved on the four engines by an upgrade test.

**`workspaces`**, added: `locale` string(5), nullable (decision 6, option B): the default language chosen at step 1, one of the application's locales. Read in one place: the language of an invitation mail sent to an address that has no account (today: the inviter's request language). Null keeps today's behaviour.

The team description of step 2 is the `teams.description` column of WS-1 (plan 23); this spec adds none.

### 6.2 New tables

**`team_invite_links`**: `id` uuid; `team_id` (cascade); `token` (text, cast `encrypted`: the link is shown again to the team's inviters each time they open the dialog, so it is kept, encrypted); `token_hash` (64, unique: how an opened link is found); `created_by_id` (nullable, null on delete); `team_role` (string 20, always `member` in this spec, kept as data so that a later choice needs no migration); `expires_at` (dateTime, not null); `uses_count` (unsigned integer, default 0: the people who joined through the link, shown to the team's inviters); `revoked_at` (nullable timestamp); timestamps. Index `(team_id, revoked_at)`. A link is **usable** when not revoked and not expired. A team has at most one link that is not revoked: creating a link revokes the previous one in the same transaction, under the team's lock.

Limits (decision 3, option C, answered by the owner): an expiry and no use limit. The expiry is fixed at 7 days (constant `TeamInviteLink::ValidForDays = 7`), as the first half of the mockup line "Expires in 7 days · up to 20 people"; "Create a new link" gives a new 7 days. There is no `max_uses` column: a limit would need one, added by a later migration. The second half of the mockup line becomes the count of people who joined (pre-build deviation of the plan).

**`onboardings`**: `id` uuid; `user_id` (unique, cascade); `step` (string 20: `workspace`, `team`, `invite`, `ritual`); `workspace_id` (nullable, null on delete: the workspace step 1 created or renamed); `team_id` (nullable, null on delete: the team step 2 created or edited); `team_name` (string 100, nullable: the "Team name" typed at registration, prefilling step 2 until the team exists); `completed_at` (nullable timestamp); timestamps. No JSON column, no derived column.

### 6.3 Who gets an onboarding

- **At registration** (`CreateNewUser::register`), when the account is created without a pending invitation and without a usable invite link in the session: one row, step `workspace`, `team_name` from the form.
- **Lazily**, in `CurrentWorkspaceController` (the `dashboard` route every sign-in lands on): a verified user who belongs to no workspace and has no row gets one, step `workspace`. This covers accounts created through SSO or a magic link, and existing users who left their last workspace. It replaces today's redirect to `workspaces/create` for them; `workspaces/create` stays for a second workspace.
- **At an SSO account's creation, with a default workspace set** (§6.4): one row, step `team`, `workspace_id` the default workspace.
- **Never** for an account created by accepting an invitation or joining by a link, and never for an existing user who belongs to a workspace: no row is written for them, so **no existing data is migrated**.
- A row is **completed** at step 4 ("Create …" or "Go to the dashboard instead"), and also when its user accepts an invitation or joins by a link while the row has no workspace yet (they came to join, not to found).
- `dashboard` sends a user with an uncompleted row to `onboarding`; with a usable invite link token in the session, it sends them to the link page first (they opened a link before registering).

### 6.4 The default workspace (P25-15)

An instance setting, no new table: the key `default_workspace` of `instance_settings` (`InstanceSettingKey::DefaultWorkspace`), its value a workspace id, read through `InstanceSettings::defaultWorkspaceId()` (null when unset or not a UUID). It is not a Branding key: the Branding reset keeps it. An id whose workspace was deleted reads as unset everywhere (the admin page shows "None"; nothing is joined); nothing clears the stored value by itself.

- **Who joins it:** an account created through SSO (`ResolveSsoUser`, the creation branch) when no pending invitation for its address was accepted in the same callback and no usable invite link is in the session. It joins with the workspace role `member` (never more), the workspace becomes its current one, and its onboarding row is created at step `team` with that workspace (§6.3). Inside the account's creation transaction; nothing to lock (the account is not visible to anyone yet).
- **Who does not:** an account created by password registration, magic link or e-mail code; an existing account signing in through SSO (linked or matched by address); an account brought by an invitation (it joins the invitation's workspace only) or by a link (it joins the link's team on the link page); any account when the setting is unset or its workspace gone. The sign-up gate is unchanged: an SSO account that the signup mode refuses is still refused (the default workspace opens no registration).
- **Step 1 is skipped:** the row starts at step 2; step 1 is shown done; "Back" is not offered and the server refuses the move to `workspace` and a rename (the user does not own the workspace). If the workspace is deleted during the onboarding, the row loses it (`null` on delete) and is shown at step 1, which then creates the user's own workspace.
- **Set by:** an instance admin, on the admin "SSO authentication" page (§10.9), recorded in plan 29's audit log as a settings change.

## 7. Permissions

| Action | Who | Condition |
|---|---|---|
| Invite to a workspace (existing dialog) | workspace managers (`manageMembers` on the workspace) | workspace role `member` or `admin`, as today; optionally a team of the workspace and a team role |
| Invite to a team (team page, team settings, onboarding step 3) | team inviters: `TeamPolicy::invite` = `TeamPolicy::manageMembers` as TM-6 leaves it (workspace owners and admins, and the team's owners) **or** the team role `facilitator` — decision 2, option B | workspace role always `member`; team role `facilitator`, `member` or `observer`, whoever the inviter is (a facilitator may invite a facilitator: it is their own level, and they cannot change the role of an existing member, which stays `manageMembers`) |
| Create, replace, turn off the team's invite link; see it and its count | team inviters (facilitators included) | — |
| Resend, revoke an invitation | workspace managers for any invitation of the workspace; team inviters (facilitators included) for the invitations of their team (`WorkspaceInvitationPolicy::manage`) | revoking asks for confirmation (9-D5) |
| Accept an invitation | a signed-in account whose address matches (`matchesEmail`), the address verified by the acceptance as today; or the account created on the card (S35) or through SSO with a verified address | pending |
| Decline an invitation | whoever holds the token: the invited person, signed in or not (the card shows "Decline" in every pending state) | pending; throttled 10 per minute per address and IP |
| Join by an invite link | a signed-in account with a verified address | usable link; already a member of the team: nothing changes, nothing counted |
| Register through an invite link | anyone, when the instance's signup mode lets the link open registration — decision 4 | usable link |
| Go through the onboarding | the user of the row | step 1 renames a workspace only while the user owns it; step 2 creates the row's one team in the row's workspace (Rule D-1) and later edits it (name, colour, description, slug) only while the user may update it; "Skip for now" (step 2) completes the row |
| Set the default workspace | instance admins (`manageInstance`, password confirmed as the admin area asks) | a workspace of the instance, or none |
| Edit a team's slug (team settings, General tab) | `TeamPolicy::update` as plan 23 leaves it (managers and the team's owners); not facilitators | §6.1 form, unique in the workspace |
| Open `/t/<slug>` | a signed-in account (signed out: sign in first, then back) | resolves only among the teams of the workspaces the account belongs to (§8.7); a team the account may not view, or no match: 404 |

**Rule D-1 (from P25-15; a reading of this spec, ruled on the owner's behalf).** Step 2 creates the onboarding's first team in the row's workspace without `TeamPolicy::create`: the onboarding row is the authorisation. Its workspace is either the one step 1 created (the user owns it) or the instance's default workspace (§6.4), where the user is a `member` and could not create a team elsewhere in the application. This is what lets a newcomer of the default workspace "create the first team" as the mockup's step 2 asks. It is limited to one team per row (`team_id`: a second "Continue" updates the same team) and to an uncompleted row; outside the onboarding a workspace member still cannot create a team. An implementer must not add `TeamPolicy::create` to step 2 (it would stop every default-workspace newcomer at step 2) nor widen `TeamPolicy::create` for members. Tests: "lets the joiner create one team at step two, but never go back to the admin workspace", "keeps the team creation of a workspace member outside the onboarding refused (Rule D-1)".

Guests (session guests with a cookie) have no account: they are never invited, never join by a link, never onboarded. An invitation can never give the workspace role `owner` or the team role `owner`.

Inviting an address that already belongs to the target is refused with a field error: the team when the invitation has one, the workspace otherwise. A member of the workspace who is not in the team can be invited to the team (they get the mail and, with a verified account, the bell item).

Accepting a team invitation: the account joins the workspace with the invitation's workspace role when not yet a member (an existing workspace role is never changed), joins the team with the invitation's team role when not yet in it (an existing team role is never changed), and lands on the team page. A workspace invitation without a team lands on the workspace page, as today.

## 8. Behaviour

### 8.1 Sending invitations

One action, `App\Actions\Invitations\SendInvitation`, extracted from `WorkspaceInvitationsController::store`, used by the workspace dialog, the team dialog and step 3: it issues the invitation (`CreateWorkspaceInvitation`, which replaces a pending invitation of the same address in the workspace, as today), queues the mail (`WorkspaceInvitationNotification`, in the recipient account's language, else the workspace's `locale`, else the request's), tells the bell of the one verified account that owns the address, and returns the URL (flashed when mail is only logged, as today). `CreateWorkspaceInvitation` locks the workspace row first, so that two invitations of one address sent at once leave one pending invitation (it can leave two today).

The team endpoint takes 1 to 20 addresses at once (the chips of the mockup), one team role and one message. Addresses are trimmed, folded by `LoginAddress::normalise` and deduplicated in PHP; each invalid address or address already in the team is a field error on its index (`emails.3`), and nothing is sent when one fails. Throttle: 10 requests per minute per user.

The message: plain text, trimmed, at most 500 characters, line breaks kept; never interpreted (no Markdown, no links made clickable) in the page, the mail or the bell.

### 8.2 The invitation mail

`WorkspaceInvitationMail` follows the `Emails` mockup: for a team invitation (`kind: 'team'`), the team block (mark in the team's colour with its initial, name, number of members) and the subject ":inviter invited you to join :team on :workspace"; the message in quotes under the block when there is one; for a workspace invitation, today's mail plus the message.

### 8.3 Declining

`POST invitations/{token}/decline`. Under the invitation's row lock: refused (410) unless pending; stamps `declined_at`; forgets the invitee's bell item (`ForgetInvitationNotifications`); then, after the commit, notifies the inviter in the bell when the inviter still belongs to the workspace (`InvitationDeclinedNotification`, kind `invitation_declined`, database channel only — decision 5). Accept and decline of one invitation at the same moment: one wins, the other gets 410. The page then shows the declined state ("Invitation declined. :name has been notified. You can close this page."); the link shows the same state afterwards. A declined invitation is listed as "Declined" among the pending invitations until it is revoked or replaced by a new invitation of the address.

The bell item for the inviter: ":email declined your invitation to join :team" (":workspace" without a team), linking to the team page (members card) or to the workspace members page; it is presented while the inviter can still view the team or the workspace, and deleted otherwise (the rule of `ListNotifications`).

### 8.4 The invite link

- Created by "Create a link" in the team's invite dialog (or automatically when onboarding step 3 is shown), replaced by "Create a new link" (with confirmation: the old link stops working), revoked by "Turn off the link".
- URL: `/invite/{token}`, a 40-character random token (`/join/` is taken by the retro guest join, and a short code would be guessable).
- Opening it shows a card built like the invitation card (§9.3). Signed out: the SSO buttons, "Sign in" and "Create an account" (registration then knows the link: decision 4); the page is the intended URL, so sign-in and e-mail verification come back to it. Signed in and verified: "Join :team as :name?" with "Join :team" and "Not you? Switch account". Signed in and unverified: a notice to verify the address first, with the resend button of the verify page.
- Joining, under the link's row lock: refused when the link is not usable (expired or turned off: 410, the page then shows "This link no longer works"); an account already in the team is sent to the team page without being counted; otherwise it joins the workspace as `member` (when not a member) and the team with the link's role, `uses_count` is incremented, the current workspace is set, a pending onboarding without a workspace is completed, and the user lands on the team page. There is no cap (decision 3): any number of people joining at the same moment all join, and the count equals the joins; one account joining twice at the same moment joins once and is counted once.
- The link block tells the team's inviters how many joined: "Expires in :days days · :count joined" (":count joined" omitted at 0). A count that grows unexpectedly is the sign of a leaked link; "Create a new link" or "Turn off the link" answers it.

### 8.5 The onboarding

State machine on `onboardings.step`: `workspace` → `team` → `invite` → `ritual` → completed, plus `team` → completed ("Skip for now", P25-03). "Continue" saves the step and moves on; "Back" (step 2 only, as drawn) moves to `workspace` without losing anything, and is not offered when the row's workspace is the default workspace the user does not own (§6.4); "Skip for now" (step 2, as drawn: ghost, between "Back" and "Continue") completes the onboarding without creating a team — a team saved before a "Back" is kept — and opens `dashboard` (which lands on the team if one exists, else on the workspace page); "Skip" (step 3) moves to `ritual`; "Go to the dashboard instead" (step 4) completes. The stepper shows done steps as done; a done step is not a link (the mockup's stepper is not interactive here).

- **Step 1, workspace**: name (required, at most 100), default language (one of the application's locales; preselected from the user's locale). First "Continue": `CreateWorkspace` (the user is its owner), the row keeps its id. Later "Continue" (after "Back"): renames it, sets its locale. The logo is omitted (§3).
- **Step 2, team**: name (required, at most 100, prefilled from `team_name`), colour (the eight column colours, radiogroup, the colour's name under it; default: the colour derived from the workspace id), team link (decision 7: the instance's address and `/t/` in `font-mono` muted, then the slug; "Edit" turns the slug into a field; until it is edited the slug follows the typed name, derived in the browser by the same rule as the server's `TeamSlug::fromName`, and the server makes it unique on save), description (optional, at most WS-1's length). First "Continue": creates the team in the workspace through `CreateTeam` (with the edited slug when there is one, validated and unique, else derived), the user joins it as `owner` (TM-6), the row keeps its id. Later: updates it (a slug sent unchanged is kept; a rename alone never changes the slug).
- **Step 3, invite**: the address chips, the team role (default `member`), the message, and "Or share this link" with the team's link (created when the step is first shown), "Copy", "Expires in :days days". "Send :count invitations" sends through §8.1 and moves on; "Skip" moves on.
- **Step 4, first ritual**: four radio cards (Retro, Planning poker, Whiteboard, Icebreaker), default Retro; the primary button reads "Create the retro", "Create the poker game", "Create the whiteboard" or "Create the icebreaker"; it completes the onboarding and opens the team page with the "New session" dialog on that type (`?new=retro|poker|whiteboard|icebreaker`: `icebreaker` is added to the intents the team page reads) — decision 8. "Go to the dashboard instead" completes and opens the team page.

- **Starting at step 2** (default workspace, §6.4): the stepper shows step 1 done, the form opens on step 2 with "Step 2 of 4" and the progress at 2/4, the preview names the default workspace; steps 2 to 4 are as above.

Concurrency: every step locks the onboarding row first (its aggregate root); two "Continue" on step 1 at once create one workspace, two on step 2 one team; a "Skip for now" and a "Continue" at once end in one order or the other (the completed row refuses the later one with a 404, as every step on a completed row).

### 8.6 Registration

The register page follows the "Inscription" variant of `ScreenAuth`: title "Create your workspace", the SSO buttons, "First and last name", "Team name" (optional, at most 100), e-mail, password and its confirmation (the confirmation stays: D-52's "server validates the confirmation" holds), "Create my account", "Already have an account? Sign in". "Team name" is shown only when the registration will start an onboarding (no pending invitation, no usable link in the session); otherwise the page keeps "Create your account" and no team field. The account is all that is created (decision 1); the team name waits on the onboarding row until step 2, after the address is verified.

### 8.7 The team slug and `/t/<slug>` (decision 7)

- `GET /t/{slug}` (outside the workspace scope, as the mockups draw it: `skrum.nordlys.fr/t/atlas`), signed in. The slug is unique per workspace, not per instance, so the route looks only among the teams of the workspaces the account belongs to: the team of the **current workspace** first, then the account's other workspaces in alphabetical order of their names (`Alphabetical::sort()`, then id). The first match the account may view (`TeamPolicy::view`) is the answer: a redirect (302) to `teams.show`. No match, or a match the account may not view: 404, the same answer for both, so that the route never tells a stranger whether a team exists. Signed out: the login page, then back to `/t/<slug>` (intended URL).
- The slug is shown where the mockup draws it: step 2 (field and preview card) and the General tab of the team settings (plan 23's tab: "Team link", the same field, for who may update the team). The team page gains nothing.
- Editing: as §6.1. An edited slug frees the old one at once; the old address answers 404 (no history of slugs is kept).

**Rule S-1 (from decision 7; the resolution order is this spec's, to be confirmed by the owner when approving it).** A slug is unique in its workspace only, as the owner answered. Two workspaces can both have `/t/atlas`; the route resolves it for each account among its own workspaces, current workspace first. An account in two workspaces that both have `atlas` reaches the current workspace's. This is intended: an implementer must not make slugs unique per instance (it would make one workspace's names depend on another's) nor resolve a slug among workspaces the account is not in. Tests: "resolves `/t/<slug>` in the current workspace first", "never resolves a slug of a workspace the account is not in", "answers 404 for a team the account may not view as for no team".

### 8.8 The session in progress after joining (P25-10)

Right after a person lands on a team page by accepting a team invitation (signed in, on the card's account form, or through SSO) or by joining with the team's link, the page shows a banner when the team has a session in progress (§5): "A session is in progress: :title" with "Join" (the session's page) and a dismiss button. The session is the team's most recently active Live session for that person (plan 22's `ListTeamSessions`, state Live, first row: `updated_at` then id, newest first; a draft poll is never Live). The server computes it once, after the join has committed, and hands it to the page as flash data (`liveSession`: kind, title, URL); nothing is stored, so the banner shows once — a reload, a later visit or a partial reload of the page does not bring it back. Nothing shows after a workspace invitation without a team, for a member who opens the link of a team they are already in, or when nothing is Live. When an SSO sign-in passes through another page first (a second-factor challenge), the flash is spent there and no banner shows.

## 9. Real time

None added. Nothing on these screens is shared live: the invitation page, the link page and the onboarding are one person's; the members lists refresh on the inviter's own actions. A decline reaches an open bell live through what exists: `BroadcastNotificationReceivedListener` dispatches `NotificationReceived` (the new unread count) for every notification sent on the `database` channel to a `User`, so `InvitationDeclinedNotification` needs nothing more. The banner of §8.8 is computed when the page is reached and does not follow the session live.

## 10. Screens

Each screen follows its mockup. "Omitted" means: not built, place left, row of the plan's pre-build deviations. Copy is informal in French, Spanish and German.

### 10.1 Onboarding — `onboarding` (new page `pages/onboarding/show.tsx`)

Mockup: ScreenOnboarding frames a and c. `OnboardingLayout` on `OnboardingFrame`: logo; the `PhaseStepper` in the middle with the four steps "Workspace", "Team", "Invite", "First ritual" (done steps `is-done`, current `aria-current="step"`; `compact` on a phone); at the end the user's avatar and "Log out" (the mockup), the language switcher kept before them (existing feature); a thin progress bar under the header (step n of 4). No sidebar.

- Form column: "Step :n of 4", the step's title (display), its sentence, its fields, its actions, and under step 2 "Everything can be changed later in Team settings."
- Aside (from `lg`): the dot-grid preview — step 1 and 2: a team switcher entry and an empty team card that follow the typed name, colour and slug live (initial in the mark, the team's address `…/t/<slug>` under its name as drawn, ":workspace · 1 member", static skeletons, "No sessions yet"), then "Coming next" with the remaining steps; steps 3 and 4: the same card with the invited count.
- Phone: compact stepper, form full width, aside hidden, actions docked at the bottom (`sticky bottom-0`).

States: each step default; step 2 with "Back", "Skip for now" and "Continue" as drawn; step 2 started by a default-workspace newcomer (step 1 done, no "Back"); saving ("Continue" busy); a field error under its field (never a toast); step 2 with the slug following the name, with the slug being edited, with "This link is already taken in :workspace." under it; step 3 with an invalid chip ("“:address” looks incomplete." under the field, the chip marked invalid), with a server error on one address, with no link yet (busy while it is created), link copied; step 4 each type selected; resumed at a later step after a reload; a user who opens `onboarding` with a completed row or none is sent to `dashboard`.

### 10.2 Register — `auth/register`

Mockup: ScreenAuth "Inscription". §8.6. States: default; field errors; with an invitation or a link in the session (no team field, "Create your account"); SSO required (403 as today); signups closed (403 as today).

### 10.3 Invitation page — `invitations/show` (existing, completed)

Mockup: ScreenOnboarding frames b and d. The `InvitationCard` gains its three places:

- `team`: the team's mark (`.ob-mark`: the initial on the team colour) over the corner of the inviter's avatar; the sentence becomes ":inviter invited you to join the :team team in the :workspace workspace" for a team invitation; the members line counts and shows the team's members and names the team role ("you join as Facilitator").
- `message`: the inviter's message in quotes under the members line.
- `decline`: "Decline invitation" (ghost, icon and destructive text) with its consequence ":name will be notified. The link stops working." under the main action; in the signed-in variant "Decline" beside "Join :team". Declining asks nothing more (the mockup has no confirmation; the consequence is written under the button).
- The main button names the team when there is one ("Create my account and join :team", "Join :team"), the workspace otherwise.
- New state **declined** (the variant "Invitation declined").

States, all existing kept: invalid; expired (names workspace and inviter); logged out with account form; logged out, SSO required; signed in, matching ("Join :team as :name?", "Not you? Switch account"); signed in, wrong account; declined. Omitted: "already in n teams" (backlog).

### 10.4 Invite link page — `invite-links/show` (new)

No mockup: designed from the invitation card (same card, same layout `AuthLayout` centred). Inviter = the link's creator (or no avatar when gone); team mark; ":name invited you to join the :team team in the :workspace workspace"; members line with "you join as Member". States: signed out (SSO buttons, "Sign in", "Create an account" when registration is open to the link); signed in, verified ("Join :team as :name?", "Join :team", "Not you? Switch account"); signed in, unverified (verify first); already a member (redirect to the team page); not usable, that is expired or turned off ("This link no longer works. Ask :name for a new one."); unknown token (404, the invalid card).

### 10.5 Team page — "Invite" (`teams/show`)

Mockup: ScreenTeam (members card header, "Invite" ghost button with `user-plus`). Shown to team inviters, the team's facilitators included. It opens the **invite dialog** (`components/invitations/team-invite-dialog.tsx`), whose content is step 3's (§8.5): title "Invite to :team", chips, role, message, "Or share this link" block (link, "Copy", the line "Expires in :days days · :count joined", "Create a new link" with confirmation, "Turn off the link"; "Create a link" when there is none), "Send :count invitations". The same content component renders step 3.

States: no link; link; link copied; sending; field errors per chip; sent (toast ":count invitations sent", chips cleared).

**The session-in-progress banner** (§8.8, P25-10; no mockup frame: the README's sentence only). The design system's `Alert`, info variant, first in the team page's main column above its header block: an icon (`radio`) in the colour of the session's kind (the kind colours of `SessionTypePicker`, as plan 22's Sessions rows use them), "A session is in progress: :title" (`role="status"`), the small primary "Join" (a link to the session) and the ghost icon button "Dismiss". On a phone "Join" wraps under the sentence. States: absent (the default); shown; dismissed.

### 10.6 Team settings — Members (plan 23's tab)

Mockup: ScreenSettings a, card "Members": header line ":count members · :pending pending invitations", "Invitation link" (opens the invite dialog scrolled to the link block) and "Invite"; after the member rows, one row per pending invitation of the team: the address, "Invited on :date", badge "Pending invitation" (or "Expired", "Declined"), the team role, "Resend", and the revoke action with confirmation. This spec adds those elements to the tab plan 23 builds; the rows of members, roles and "last activity" are plan 23's. A facilitator reaches this tab (plan 23 sends them to Members & rituals, members read-only): they see "Invitation link", "Invite" and the pending rows with "Resend" and revoke, and still cannot change a member's role or remove a member.

### 10.6a Team settings — General (plan 23's tab)

No mockup for this field (the onboarding's step 2 draws it): "Team link" under the team name, the same component as step 2 (`…/t/` muted, the slug, "Edit"), saved with the name through `teams.update`; shown to who may update the team. States: default; editing; "This link is already taken in :workspace."; an invalid form ("Use lower-case letters, digits and hyphens.").

### 10.7 Workspace members page (existing)

The invite dialog's places (`InviteSlots`): "Team · optional" (a select of the workspace's teams) with the team role under it once a team is picked, and "Message · optional" last. The pending invitations table gains the team (when set) and the status ("Pending", "Expired", "Declined"), and "Resend".

### 10.8 The bell

`team_invite` items of a team invitation read ":name invited you to join :team" (the team), linking to the invitation page as today. New kind `invitation_declined` (no mockup: designed from the `team_invite` item, with the invitee's initial avatar and no buttons). Both in `components/skrum/notifications-panel.tsx`.

### 10.9 Admin — SSO authentication: the default workspace (P25-15)

No mockup frame for the setting (the ScreenOnboarding README's sentence only): one more card in the admin cards' pattern (`.st-card`, as plan 29's cards of the same page), last on the "SSO authentication" page (`admin/sign-in`, plan 29), after the `sso_required` form. Title "New SSO accounts"; the sentence "Accounts created through SSO without an invitation join this workspace as members and start by creating their team."; the select "Default workspace" ("None", then the instance's workspaces by name); "Save", disabled while unchanged; the field error under the select; a toast on save. States: none set; one set; saving; error.

## 11. Routes

Workspace scope (`w/{workspace}`, `can:view,workspace`):

| Route | Name | Controller | Authorisation |
|---|---|---|---|
| `POST invitations` (existing) | `workspaces.invitations.store` | `WorkspaceInvitationsController@store` | `manageMembers` on the workspace; new fields `team_id`, `team_role`, `message` |
| `DELETE invitations/{invitation}` (existing) | `workspaces.invitations.destroy` | `@destroy` | `manage` on the invitation (was `manageMembers` on the workspace) |
| `POST invitations/{invitation}/resend` | `workspaces.invitations.resend.store` | `WorkspaceInvitationResendsController@store` | `manage` on the invitation; throttle 20/min |
| `POST teams/{team}/invitations` | `teams.invitations.store` | `TeamInvitationsController@store` | `invite` on the team; throttle 10/min |
| `POST teams/{team}/invite-link` | `teams.inviteLink.store` | `TeamInviteLinksController@store` | `invite` on the team |
| `DELETE teams/{team}/invite-link` | `teams.inviteLink.destroy` | `@destroy` | `invite` on the team |
| `POST teams` (existing) | `teams.store` | `TeamsController@store` | as today; creates through `CreateTeam` (slug derived) |
| `PATCH teams/{team}` (existing) | `teams.update` | `TeamsController@update` | `update` on the team, as today; new optional field `slug` |

Outside any scope:

| Route | Name | Controller | Middleware |
|---|---|---|---|
| `POST invitations/{token}/decline` | `invitations.decline.store` | `InvitationDeclinesController@store` | throttle `invitationDeclines` (10/min per IP) |
| `GET invite/{token}` | `inviteLinks.show` | `InviteLinksController@show` | throttle 30/min per IP |
| `POST invite/{token}/membership` | `inviteLinks.membership.store` | `InviteLinkMembershipsController@store` | `auth`, `verified`, throttle 10/min |
| `GET t/{slug}` | `teamAddresses.show` | `TeamAddressesController@show` | `auth`, throttle 60/min; `slug` constrained to the §6.1 form |
| `GET onboarding` | `onboarding.show` | `OnboardingsController@show` | `auth`, `verified` |
| `PUT onboarding/workspace` | `onboarding.workspace.update` | `OnboardingWorkspacesController@update` | same |
| `PUT onboarding/team` | `onboarding.team.update` | `OnboardingTeamsController@update` | same |
| `POST onboarding/invitations` | `onboarding.invitations.store` | `OnboardingInvitationsController@store` | same, throttle 10/min |
| `PUT onboarding/step` | `onboarding.step.update` | `OnboardingStepsController@update` | same (body `step`: `workspace` from step 2, `ritual` from step 3) |
| `POST onboarding/completion` | `onboarding.completion.store` | `OnboardingCompletionsController@store` | same (body `ritual`: `retro`, `poker`, `whiteboard`, `icebreaker` or absent; from step `team`, "Skip for now": absent only, then the answer opens `dashboard`) |
| `PUT admin/sign-in/default-workspace` | `admin.defaultWorkspace.update` | `Admin\DefaultWorkspacesController@update` | the admin group (`auth`, `verified`, `can:manageInstance`, password confirmed); body `default_workspace_id` (uuid of a workspace, or null) |

The team page gains the props `canInvite`, `inviteRoles`, `inviteLink` (optional prop, loaded when the dialog opens: `{url, expiresAt, usesCount}` or null) and, for team inviters, `pendingInvitations`. `team` gains `color`, `slug` and `address` (the absolute URL of `/t/<slug>`). `PUT onboarding/team` takes `slug` (optional). The onboarding page gains `canEditWorkspace` (false when the row's workspace is one the user does not own: no "Back", step 1 shown done). The admin page `admin/sign-in` gains `defaultWorkspaceId` (null when unset or gone) and `workspaces` (`{id, name}`, by name). The landings of §8.8 carry the flash `liveSession` (`{kind, title, url}`) when a session is in progress. The invitation page gains `team` (`{name, color}` or null), `teamRole`, `message`, `isDeclined`, `declineUrl`. Validation in Form Requests with array rules.

## 12. Migrations of existing data

One data migration: the team slug (§6.1), which fills `teams.slug` for every existing team, outside a transaction, re-runnable, then makes it not null and unique per workspace; it is proved by an upgrade test run on PostgreSQL, MariaDB, MySQL and SQLite (every team gets a slug of the §6.1 form; two teams of one workspace with one name get `atlas` and `atlas-2` in creation order; teams of two workspaces with one name both get `atlas`; a name with no letter or digit gets `team`; a second run writes nothing). No other row is rewritten: the four schema migrations add nullable columns or new tables (§6). Consequences, each proved by a test:

- An invitation issued before the deploy has no team, no message and `declined_at` null: it shows, is accepted and is revoked exactly as today.
- An existing user who belongs to a workspace has no onboarding row and never sees the onboarding.
- An existing user who belongs to no workspace sees the onboarding at step 1 on their next visit of `dashboard`, instead of `workspaces/create`.
- An existing team has no colour: its mark keeps the colour derived from its id, everywhere, the mail included.
- An existing team has a slug after the upgrade, and `/t/<slug>` reaches it.
- Bell notifications already stored (`team_invite`) keep presenting.
- An existing account is never moved into the default workspace: the setting applies at an SSO account's creation only, and is unset after the upgrade.

## 13. Dependencies on other plans

- **Execution order (owner, 2026-10-03):** plans 20, 21, 26, 27, 29 in parallel → 22 → 23 → 24 and 25. This plan starts from the integration branch `roadmap` once 23 is merged; plan 24 may run beside it.
- **Plan 23 (TM-6, team roles) must be merged first**. A team invitation carries a team role; "who may invite to a team" is `TeamPolicy::manageMembers` as TM-6 leaves it, plus the team role `facilitator`; the creator of the onboarding's team becomes its owner. Without TM-6 there is no role to give.
- **Plan 23 (WS-1 and WS-3)**: the team description of step 2 is WS-1's column; the Members tab of §10.6 and the General tab of §10.6a are WS-3's. If plan 23 ships without them, step 2 omits the description, §10.6 is limited to the team page dialog and the slug is edited at step 2 only (the plan says how). If plan 23 creates teams through an action of its own, `CreateTeam` (§6.1) is that action, extended; plan 23's name wins.
- **Plan 22 (SE-1)** is merged before: the banner of §8.8 reads its `ListTeamSessions` and its Live state. Its SE-2 (scheduling) is not a dependency: scheduling went to the backlog; step 4 has no date.
- **Plan 26 (AC-1)** is merged before this plan, but builds profile photos, not a workspace logo: the logo of step 1 stays omitted (P25-01 approved, §3).
- **Plan 29** is merged before: the sign-up mode and domain list are stored settings there (`SignupGate` reads them as plan 29 leaves it, the link rule of decision 4 added); the admin "SSO authentication" page, `InstanceSettings`' explicit Branding list and the audit log (`RecordAuditEvent`, `AuditAction::SettingsUpdated`) are plan 29's, and §6.4 and §10.9 build on them. Plan 29's access requests go to workspace owners and admins until plan 23 widens them; this plan does not touch them.

## 14. Acceptance criteria

1. A workspace manager invites an address to the workspace with or without a team; with a team, a team role (facilitator, member or observer) is required; owner is refused for both roles; a message over 500 characters is refused.
2. A team inviter — a workspace manager, an owner of the team or a facilitator of the team (decision 2) — sends invitations to 1 to 20 addresses at once to their team with one role (facilitator, member or observer) and one message; a 21st address, an invalid address, or an address already in the team is a field error on its index and nothing is sent; a member of the workspace not in the team can be invited. A member or an observer of the team, or anyone outside it, gets 403. A facilitator of one team gets 403 on another team.
3. Two invitations of one address to one workspace sent at the same moment leave exactly one pending invitation (race, four engines).
4. The invitation mail of a team invitation shows the team's name, colour and member count and the message; the subject names the team; a workspace invitation mail shows the message when there is one; an address without an account receives it in the workspace's default language when set.
5. The invitation page of a team invitation shows the team mark, the sentence naming team and workspace, the team's members and the team role, the message, and buttons naming the team; a workspace invitation shows today's card plus the message.
6. Accepting a team invitation (on the card when signed in, by creating the account on the card, or through SSO with a verified address) adds the account to the workspace with the invitation's workspace role when not a member and to the team with the team role when not in it, never changes an existing role, and opens the team page. An invitation whose team was deleted no longer exists.
7. "Decline" on a pending invitation, signed in or not, stamps it declined; the link then shows the declined state; accepting it afterwards is refused (410); the invitee's bell item disappears; the inviter, while still in the workspace, receives one `invitation_declined` bell item linking to the team or the workspace members page; accept and decline arriving at the same moment leave exactly one of the two (race).
8. A team inviter (a facilitator included) creates the team's invite link, valid 7 days, with no use limit; creating another revokes the first (and two creations at once leave one usable link: race); "Turn off the link" revokes it; a member or an observer gets 403. The link's URL and the number of people who joined are shown again each time the dialog opens; the token is stored encrypted and found by its hash.
9. A verified account opening a usable link joins the workspace as member (when not a member) and the team as member, and lands on the team page; the join is counted; an account already in the team counts nothing. An expired or turned-off link refuses with 410 and the page says so. A link used by many people stays usable until it expires: five accounts joining at once all join and the count is five; one account joining twice at once joins once and is counted once (races, four engines).
10. A signed-out visitor of a link signs in or registers and comes back to the link page; registration through a usable link follows decision 4 on each signup mode; such a registration creates no onboarding.
11. Registering without an invitation or link shows "Create your workspace" with "Team name", creates the account only, and after e-mail verification `dashboard` opens the onboarding at step 1; registering with an invitation or link shows no team field and creates no onboarding.
12. Step 1 creates one workspace owned by the user (two submissions at once create one: race) and stores its default language; after "Back", "Continue" renames it instead of creating another.
13. Step 2 creates one team in that workspace with the chosen colour, description and slug (derived from the name, or the one edited), the user its owner; prefilled from the registration's team name; after "Back" and "Continue" again it is updated, not duplicated, and a rename alone keeps the slug; a slug the workspace already has, or of the wrong form, is a field error.
14. Step 3 sends the invitations of criterion 2 and shows the team's link (created when first shown), "Skip" moves to step 4 without sending.
15. Step 4 completes the onboarding and opens the team page with the "New session" dialog on the chosen type, the icebreaker included; "Go to the dashboard instead" completes and opens the team page. A completed onboarding is never shown again.
16. A reload or a later sign-in resumes the onboarding at its step with what was saved; accepting an invitation or joining by a link before step 1 is saved completes the onboarding.
17. An existing user with a workspace never sees the onboarding; one with none sees step 1; a pre-existing invitation behaves as before (criterion 6 on a row without team or message).
18. The team page shows "Invite" to team inviters only (a facilitator included, a member or observer not); the dialog sends invitations and manages the link. The team settings Members tab lists the team's pending, expired and declined invitations with "Resend" and revoke (confirmation), and shows "Invitation link" and "Invite", to a facilitator as to an owner. A team inviter who is not a workspace manager (an owner or a facilitator of the team) can resend and revoke the invitations of their team and no other.
19. The workspace members page invites with a team and a message and lists each invitation's team and status.
20. The bell names the team of a team invitation and presents `invitation_declined` items; neither has an accept or decline button.
21. Every new string exists in the four languages, informal in French, Spanish and German (`InformalRegisterTest`, `TranslationKeysTest`); the onboarding (four steps, step 2 with "Skip for now", step 2 of a default-workspace newcomer), the register page, the invitation card (team invitation, declined), the link page, the invite dialog, the team page's session-in-progress banner, the admin default workspace card and the General tab's team link field are captured in light at 1440 in French without horizontal overflow and compared with their mockups, each difference being a row of the plan's deviations or fixed.
22. Every team has a slug of the §6.1 form, unique in its workspace: a new team gets one derived from its name (`atlas`, then `atlas-2`), also when two teams of one name are created at the same moment (race, four engines); a rename keeps it; who may update the team edits it (step 2, General tab, `teams.update`), a facilitator or a member gets 403; an existing team receives one by the data migration (upgrade test, four engines, re-runnable). `/t/<slug>` redirects a signed-in account to the team page, looking in the current workspace first and then in the account's other workspaces, never in a workspace the account is not in; no match and a team the account may not view both answer 404; a signed-out visitor signs in and comes back (Rule S-1).
23. The unit, feature, upgrade, arch and concurrency suites pass on PostgreSQL through `bin/test-db pgsql` (and `--concurrency`), with `tests/Arch/DatabasePortabilityTest.php`; `bin/check-pg-upgrade` passes. SQLite, MariaDB, MySQL and a SQLite file run them in the roadmap's final matrix after plans 24 and 25 are merged (owner, 2026-10-03), not in this plan.
24. "Skip for now" on step 2 completes the onboarding without creating a team (a team saved before a "Back" is kept), skips steps 3 and 4, opens `dashboard`, and the onboarding is never shown again; sent with a ritual, or before step 1 is saved, it is refused (P25-03).
25. Right after accepting a team invitation (signed in, on the card's account form) or joining by a link, the response carries the team's session in progress (kind, title, URL) when one is Live, and the team page shows the banner with "Join" and "Dismiss"; nothing is carried after a workspace invitation without a team, when nothing is Live, or to a member already in the team; a reload shows no banner (P25-10).
26. An instance admin sets, changes and clears the default workspace on the SSO authentication page (audited; an unknown workspace refused; a non-admin 403; kept by a Branding reset; shown as none once its workspace is deleted). A new SSO account brought by no invitation and no usable link joins it as `member`, with an onboarding at step 2; step 1 is shown done, "Back" and a rename are refused, step 2 creates one team the account owns (Rule D-1) or "Skip for now" lands in the workspace; an account brought by an invitation or a link, a password registration and an existing account are never moved into it; an unset setting or a deleted workspace changes nothing; a default workspace deleted during the onboarding brings step 1 back (P25-15).

## 15. Risks

- **Plan 23's shape is unknown.** The role enum, the pivot column, the policy and the Members tab are assumed by name (§5, §13). The plan's first task checks them and stops on a mismatch; each later task follows plan 23's names.
- **A link is a key to the team, with no use limit (decision 3, option C, the owner's answer).** Anyone who gets it joins until it expires (7 days) or is replaced or turned off, however many they are. Mitigations kept: verified accounts only, a fixed 7-day expiry, one link per team, replacement and turning off by any team inviter, and the count of people who joined shown in the link block so that a leak shows. A leaked link is answered by "Create a new link". With decision 4 (option A), a usable link also opens registration on an instance in `invite` signup mode: a leaked link lets any number of strangers create an account there and join the team during its 7 days. The owner answered decisions 3 and 4 separately; the combined effect is kept as an accepted consequence of both answers (§16, notes: ruled 2026-10-03) and reported with the plan.
- **A facilitator invites (decision 2, option B).** A facilitator can bring people into the workspace (as `member`) and the team (as facilitator, member or observer) without a workspace manager or a team owner. Their invitations are listed with the inviter's name to the team's owners and the workspace managers, who can revoke them; the facilitator cannot change an existing member's role nor remove anyone.
- **Slugs (decision 7).** A slug is a second key of a team and is unique per workspace only (Rule S-1): `/t/<slug>` depends on who asks. The upgrade fills every existing team (one write per team, outside a transaction, re-runnable); a large instance should upgrade in maintenance mode, as for the earlier fills (`docs/database.md`). A team created by the old release during the fill gets its slug from the fill if it ran after its insert, else the migration's last step (not null) fails and the run is started again, which fills the rest. Editing a slug breaks the old `/t/` address without a redirect (non-goal).
- **Decline by token.** Whoever holds the link can decline it, as whoever holds it could accept it with the address's account. The throttle limits guessing; the token is 40 random characters.
- **The message is attacker-controlled text in a mail from the instance.** A team inviter could write a phishing sentence. It is plain text, never linked, at most 500 characters, inside the instance's branded mail that names the inviter; the throttles cap the volume. To be weighed by the owner for open instances.
- **Registration and verification paths.** The intended URL must survive registration and e-mail verification for a link visitor; Fortify's register and verify responses are assumed to honour it (§17). A test proves the full path.
- **Two colours for one team.** The derived colour exists in TypeScript (`lib/mark-color.ts`); the mail needs it in PHP. One parity test feeds both the same ids.
- **SQLite and the lock order.** Joining locks the link then writes `workspace_user` and `team_user`; accepting locks the invitation; onboarding locks its row. No path locks two of these roots. Creating a team takes no lock: `CreateTeam` inserts in a nested transaction and retries on the slug's unique index, which on SQLite means the second writer waits for the first (up to five seconds) before it sees the slug taken.
- **The default workspace (P25-15).** Every account the SSO provider and the sign-up gate let in becomes a member of that workspace, sees its teams as members do, and may create one team there through the onboarding (Rule D-1). That is the owner's answer; the admin chooses the workspace, the sign-up mode still decides who may have an account, and workspace managers can remove members and delete teams as today. A newcomer who skips step 2 lands in the workspace without a team and asks to join one (plan 29's access requests).
- **The banner (P25-10)** names a session of the team the newcomer just joined; it shows the title of a session they may open anyway as a member. A draft poll is never Live, so never named.
- **Spam through step 3.** A newcomer can send 20 invitations per request, 10 requests a minute. Same order as today's workspace invitations (20 a minute); open instances may want less.

## 16. Decisions for the owner — answered 2026-10-03

All nine are answered (`.superpowers/sdd/roadmap/progress.md`, "Owner answers 2026-10-03", line "Plan 25"). The body is written on the answers. Three differ from the recommended option (marked **≠ recommended**): 2, 3 and 7. The options are kept below for the record. Each recommendation followed the owner's pattern: the mockup decides presentation; existing features stay; simple data is added when it has a reader; what needs more is left to the backlog with its place kept.

**1. What does registration create? (D-52)**
- A. The account only. The register form gets "Team name" (mockup); the name waits on the onboarding row and prefills step 2; workspace and team are created by steps 1 and 2, after the address is verified. **Recommended:** faithful to both mockups, nothing is created for an unverified address, and one path (the onboarding) creates workspaces and teams for everyone, SSO accounts included.
- B. Account, workspace (named after the team) and team, in the registration transaction; the onboarding opens on step 1 prefilled. Fewer steps for a newcomer; unverified addresses create workspaces; step 1 then renames rather than names.
- C. Register keeps no team field (D-52 stays for that field), title "Create your workspace" only.
- **Answered: A** ("registration = account only, team name prefills step 2").

**2. Who may invite to a team and manage its link?**
- A. Those who manage the team's members as TM-6 decides (workspace owners and admins, the team's owners). **Recommended:** one rule for adding, removing and inviting.
- B. Also the team's facilitators (the mockup's settings page is "for the owner or facilitator").
- C. Every member of the team except observers.
- **Answered: B, ≠ recommended** ("inviters = members managers PLUS facilitators"). `TeamPolicy::invite` is `manageMembers` or the team role `facilitator`; the same people manage the team's link and resend or revoke the team's invitations (§7). Facilitators invite with the same three roles as owners (§7, a reading of this spec: see the note after decision 9).

**3. The invite link's limits.**
- A. Fixed: 7 days and 20 uses, as the mockup's line; "Create a new link" renews both. **Recommended:** the mockup shows no setting; the columns allow a later choice without a migration.
- B. Chosen when the link is created: 1, 7 or 30 days; 5, 10, 20 or 50 uses. A small settings row the mockup does not draw.
- C. No limit on uses, expiry only.
- **Answered: C, ≠ recommended** ("team link = expiry only, no use limit"). No `max_uses` column; the expiry stays fixed at 7 days (the answer names no choice of expiry, so option B's settings row is not built); `uses_count` is kept and shown as the number of people who joined (§6.2, §8.4).

**4. Can a link open registration on a restricted instance?** (signup mode `invite` or `domain`)
- A. Yes in `invite` mode; in `domain` mode the domain list still applies. **Recommended:** a link is the team's invitation, and the domain list is the administrator's rule about who may have an account at all.
- B. Never: a link adds existing accounts, and registration through it follows the signup mode alone (a newcomer on an invite-only instance needs an e-mail invitation).
- C. Yes in every mode, the domain list included.
- **Answered: A** ("invite mode may open registration, domain mode keeps its list").

**5. How is the inviter told of a decline?**
- A. A bell item only. **Recommended:** "Camille will be notified" is met where Skrüm tells people things; no new mail template.
- B. A bell item and a mail.
- C. A bell item to the inviter and to every team inviter of the team.
- **Answered: A** ("decline = bell only").

**6. Step 1: logo and default language.**
- A. Both omitted, places left.
- B. Default language stored on the workspace, used for invitation mails to addresses without an account; the logo omitted until stored images exist (AC-1, plan 26). **Recommended:** simple data with a reader; the logo needs storage and serving that plan 26 builds.
- C. Both, the logo upload built here (storage, validation, serving) ahead of AC-1.
- **Answered: B** ("workspace locale stored, logo with plan 26").

**7. Step 2: the team link `…/t/atlas`.**
- A. Omitted; teams stay addressed by id; the field's place is left. **Recommended:** a team slug touches every team route and link; nothing else asks for it.
- B. A unique slug per workspace, editable, and a redirect route `/t/{slug}` to the team page.
- **Answered: B, ≠ recommended** ("team slug /t/<slug> unique per workspace + redirect route"). §5, §6.1 (column, derivation, data migration), §7, §8.5 step 2, §8.7 (route and Rule S-1), §10.6a, §11, §12, criterion 22. The route sits at the root, as the mockups draw it (`skrum.nordlys.fr/t/atlas`); since the slug is unique per workspace only, it is resolved among the asking account's workspaces, current workspace first (Rule S-1).

**8. Step 4: what does "Create the retro" do?**
- A. Completes the onboarding and opens the team page with the "New session" dialog on the chosen type (name, template, "Create & open"). **Recommended:** one creation path, the dialog the team uses every day; one click more.
- B. Creates the session at once with the defaults (the team's first template, the default deck…) and opens it.
- **Answered: A** ("step 4 opens the New session dialog").

**9. One team or several per e-mail invitation?** (the invite dialog of the rewrite left a place named "teams")
- A. One team. **Recommended:** the mockups (page, mail, bell) all name one team; several teams are several invitations.
- B. Several teams, one role each, in a satellite table.
- **Answered: A** ("one team per e-mail invitation").

Notes — readings of this spec, **ruled on the owner's behalf on 2026-10-03** (the owner answered every question and every deviation; none of these blocks the build; each is reported with the plan):

- **Decisions 3 and 4 together.** A link without a use limit that also opens registration in `invite` mode lets any number of strangers holding a leaked link create accounts during its 7 days (§15). Ruled: kept as both answers say (no limit for links that open registration, registration through a link kept in `invite` mode); the count shown to inviters and "Create a new link" are the answer to a leak.
- **What role may a facilitator give?** Ruled: facilitator, member or observer, as an owner (decision 2 makes them team inviters without restriction; they still cannot change an existing member's role).
- **`/t/<slug>` resolution (Rule S-1).** Ruled: current workspace first, then the account's other workspaces by name (the mockups' URL; a workspace-scoped address would not be).
- **The default workspace (P25-15).** Ruled: role `member`; SSO-created accounts only, never with an invitation or a usable link; applies whether or not SSO is forced (the admin fills the setting); step 2 may create one team (Rule D-1); set on the "SSO authentication" admin page and audited.
- **The banner (P25-10).** Ruled: the most recently active Live session of plan 22; after accepting a team invitation or joining by a link (the same landing); once, as flash data.

### 16.1 The plan's pre-build deviations — answered 2026-10-03

The rows live in the plan (`docs/superpowers/plans/2026-10-25-plan-25-invitations-onboarding.md`, "Pre-build deviations"). Owner's answers (`progress.md`, line "P25: …"):

| Row | Subject | Answer (2026-10-03) |
|---|---|---|
| P25-01 | Step 1 logo | approved: not rendered, place left (plan 26 builds no workspace logo) |
| P25-02 | Step 2 team link | **obsolete**: the team slug was chosen (decision 7 B); built as drawn |
| P25-03 | Step 2 "Skip for now" | **≠ rec.: built as the mockup**; it skips steps 3 and 4 too (§8.5) |
| P25-04 | Step 4 date | approved: not rendered (scheduling backlog) |
| P25-05 | Link URL `/invite/<token>` | approved |
| P25-06 | Language switcher in the onboarding header | approved |
| P25-07 | Step 3 sentence follows the role | approved |
| P25-08 | "already in n teams" | approved: backlog |
| P25-09 | "Ask for a new invitation" | approved: backlog |
| P25-10 | Session-in-progress banner after accepting | **≠ rec.: built** (§8.8, §10.5) |
| P25-11 | Link page without mockup | approved |
| P25-12 | `invitation_declined` bell item | approved |
| P25-13 | Register: plan and terms lines | approved: not rendered |
| P25-14 | Register: password confirmation | approved: kept |
| P25-15 | Step 1 filled by the admin and skipped | **≠ rec.: built** as an instance default workspace for new SSO accounts (§6.4, §10.9) |
| P25-16 | Link line ":count joined" | approved |
| P25-17 | General tab "Team link" | approved |

## 17. Not determined by reading

1. The names plan 23 gives to the team role (`TeamRole`?), its cases, the pivot column (`team_user.role`?), the policy method that reads it, the team description column and the Members tab's component; whether plan 23 already makes a team's creator its owner.
2. Whether Fortify's register response and e-mail verification response redirect to the intended URL (`redirect()->intended(...)`) in the installed version, so that a link visitor comes back to the link page without an extra session key.
3. How many existing users belong to no workspace (they will see the onboarding at their next visit).
4. Whether `PhaseStepper` renders a non-interactive four-step rail without a "completed" badge in the onboarding header as drawn, or needs an option.
5. Whether the throttles named here collide with limiter names already defined (`invitationAccounts` exists; `invitationDeclines` does not).
6. Whether plan 23 adds a team-creation action (the slug's `CreateTeam` then extends it) and how its General tab saves the name (the slug field joins that save).
7. How many teams share a name inside one workspace on existing instances (each such pair gets `-2`, `-3`, … in creation order).

8. Whether plan 23 changed where a user with a workspace and no team lands from `dashboard` (the landing of "Skip for now", §8.5).
9. The `section` value plan 29's audit records for a change made on its "SSO authentication" page (§6.4 writes `sign_in` unless plan 29 has one).

Checked for the revision: no route of `routes/web.php` starts with `t/` (`GET t/{slug}` collides with nothing); workspaces already have an instance-unique slug made by `CreateWorkspace` (`<name>-<6 random characters>`), a different rule from the team slug's, which follows the mockup's `atlas`. Checked after the first reading: `workspace_user` and `team_user` both have a composite primary key on the pair (a second attach of one person fails), and every `database` notification to a user is announced live by `BroadcastNotificationReceivedListener`.
</content>
</invoke>
