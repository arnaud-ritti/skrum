# Team invitations, the invite link and the four-step onboarding (Plan 25) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development to run this plan task by task (through the Workflow tool, as the project does). Steps use checkbox (`- [ ]`) syntax. Every agent reads **Owner decisions**, **Global Constraints**, **Pre-build deviations** and its own task before anything else, then `docs/database.md` ("Rules for database code" and "Running the tests on an engine") for any task that touches PHP. A screen task also follows the "Screen task procedure" of `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md`, with the working rules below (no walkthrough, captures in Task 22 only).

**Status: draft of 2026-10-03, not approved.** Written on the recommended option of each item of spec §16. Before Task 1: the owner answers spec §16 and reads the pre-build deviations; plan 23 (TM-6, WS-1, WS-3) is merged.

**Goal:** A team inviter invites people to a team by e-mail (several at once, with a team role and a message) or shares the team's invite link; the invited person sees the team, the role and the message, accepts or declines (the inviter is told in the bell); a newcomer registers ("Create your workspace", "Team name") and, once verified, goes through the four steps of the mockup — workspace, team, invitations, first ritual — saved step by step.

**Architecture:** The existing aggregate `WorkspaceInvitation` gains a team, a team role, a message and a declined state; one action (`SendInvitation`) issues, mails and announces every invitation, from the workspace dialog, the team dialog and the onboarding. A new aggregate `TeamInviteLink` (one usable link per team, token encrypted and hashed, expiry and maximum of uses) is joined under its row lock. A new aggregate `Onboarding` (one row per user who must found a workspace) holds the step and the ids of what the steps created; `dashboard` routes to it. No data migration: every new column is nullable and every existing row keeps its meaning.

**Tech Stack:** Laravel 13, PHP 8.4, Fortify, Pest (feature, unit, arch, concurrency), Inertia 3, React 19, Tailwind 4, vite-plus (Vitest), Wayfinder; PostgreSQL, MariaDB, MySQL and SQLite through `bin/test-db`; `Tests\Concurrency\Support\Race`. Run `composer show --direct` and read `package.json` before Task 1 and stop if a major differs from this list.

**Spec:** `.superpowers/sdd/roadmap/plan-25/spec.md` (moves to `docs/superpowers/specs/2026-10-25-invitations-and-onboarding-design.md` in Task 23). Parent: `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` §5. Mockups: `docs/design-system/components/ScreenOnboarding`, `ScreenAuth`, `ScreenTeam`, `ScreenSettings`, `Emails`, `NotificationsPanel`, `PhaseStepper` — for each, the `README.md` and the `preview.html`.

**Not in this plan:** spec §3 (backlog: "already in n teams", "Ask for a new invitation", the date of step 4 and all scheduling, the team slug, the workspace logo, the session banner after acceptance, bell buttons, invitations to several teams, MCP or API invitations); browser walkthroughs (owner's working rule: none is written or run).

**Tasks:** 24. Step A, back end, single writer: 1 to 13. Step B, screens: 14 (single writer), then lanes Access (15, 16, 17), Team (18, 19), Onboarding (20). Final: 21 (translations), 22 (captures only: light, 1440, French), 23 (deviations and documents), 24 (full suites on four engines and report).

## Branch and run

- Base: `main` once plan 23 is merged into it. Check before Task 1, and stop if one fails: `app/Enums/TeamRole.php` exists with the cases `Owner`, `Facilitator`, `Member`, `Observer` (values `owner`, `facilitator`, `member`, `observer`); `team_user` has a `role` column (`database/migrations/*team_user*` or a later migration); `Team::members()` declares `->withPivot('role')`; `TeamPolicy::manageMembers` reads the team role; `teams.description` exists (WS-1); the team-settings Members tab exists (WS-3, find it with `grep -rl "Members & rituals\|Membres & rituels" resources/js`). **Plan 23's names win**: where they differ from this plan's (`TeamRole`, `role`, `description`, the tab's file), each task uses plan 23's and reports the difference. If WS-1 is absent, Tasks 12 and 20 drop the description; if WS-3 is absent, Task 19 adds its rows to the team page's members card instead.
- Branch `plan-25-invitations-onboarding` from that base. No merge into `main`, no push.
- Step A runs with one writer. Lanes run in git worktrees on branches `lane/25-<name>`, cut from the head of Task 14; the controller merges one lane at a time and runs the gates after each merge: `npm run types:check`, `npm run check`, `npm run build:front`, `vendor/bin/pint --dirty --format agent`, `vendor/bin/sail composer types:check`, and `bin/test-db pgsql -- tests/Feature/Invitations tests/Feature/Onboarding tests/Feature/Workspaces tests/Feature/Auth tests/Arch`.
- From a worktree, `bin/test-db` needs `TEST_DB_CONTAINER` and `TEST_DB_WORKDIR`; MariaDB and MySQL are started once with `docker compose up -d mariadb mysql`. Never run two whole suites at once in the shared container.
- This plan was written from `main` at `18d3637e`. **Every task re-reads the files it touches**; a line or a body quoted here that no longer matches is followed in spirit and reported.

## Owner decisions

The nine questions of spec §16. "Plan written on" is the recommended option. The last column names what changes with another answer.

| # | Question | Plan written on | If the owner answers otherwise |
|---|---|---|---|
| 1 | What registration creates | **A**: the account only; "Team name" waits on the onboarding row | **B**: Task 11's `StartOnboarding` is replaced by a `RegisterWorkspace` action called from `CreateNewUser::register` (workspace named after the team, team, owner role, onboarding row at step `workspace` holding both ids); Task 12 step 1 renames. **C**: Task 17 drops the field; Task 11 drops `team_name` from the request |
| 2 | Who may invite to a team | **A**: `TeamPolicy::invite` = `manageMembers` (TM-6) | **B**: Task 6's `invite` also returns true for `TeamRole::Facilitator`; tests gain a facilitator case. **C**: `invite` = `view` minus `Observer` |
| 3 | Link limits | **A**: fixed 7 days, 20 uses | **B**: Task 9's request takes `expires_in_days` (1, 7, 30) and `max_uses` (5, 10, 20, 50); Task 18 adds a settings row. **C**: `max_uses` nullable, `isUsable` ignores it, Task 10's race is dropped |
| 4 | Link and restricted signup | **A**: opens registration in `invite` mode; `domain` keeps its list | **B**: Task 10 leaves `SignupGate` unchanged (no `$link` parameter). **C**: `allows` returns true for a usable link before the mode match |
| 5 | Telling the inviter of a decline | **A**: bell only | **B**: Task 8's notification adds `mail` and a Blade mail (`mail.invitation-declined`, text part), with `MailMockupTest` coverage. **C**: Task 8 notifies every team inviter too |
| 6 | Step 1 logo and language | **B**: `workspaces.locale`, no logo | **A**: Task 2 drops `workspaces.locale`; Task 5 keeps today's locale rule; Task 12 drops the field. **C**: a new task (stored logo: disk, validation, serving route, `AvatarsController`-like cache headers) before Task 12 |
| 7 | Team slug | **A**: omitted | **B**: a new task: `teams.slug` (unique per workspace, derived from the name, written by the model), `GET t/{slug}` redirect, the field in Task 20 |
| 8 | "Create the retro" | **A**: completes, opens the team page with the "New session" dialog | **B**: Task 12's completion calls `CreateRetro`, `CreatePokerGame`, `CreateWhiteboard` or the game-room action with defaults and redirects to the session |
| 9 | Teams per invitation | **A**: one | **B**: a satellite table `workspace_invitation_teams`; Tasks 1, 5, 7 and 19 change |

## File structure

Back end, created:

| File | Responsibility |
|---|---|
| `database/migrations/2026_10_25_100000_add_team_and_answer_to_workspace_invitations.php` | `team_id`, `team_role`, `message`, `declined_at` |
| `database/migrations/2026_10_25_100100_add_color_to_teams_and_locale_to_workspaces.php` | `teams.color`, `workspaces.locale` |
| `database/migrations/2026_10_25_100200_create_team_invite_links_table.php` | the link table |
| `database/migrations/2026_10_25_100300_create_onboardings_table.php` | the onboarding table |
| `app/Enums/OnboardingStep.php` | the four steps |
| `app/Models/TeamInviteLink.php`, `app/Models/Onboarding.php` and their factories | the two aggregates |
| `app/Support/Teams/TeamMark.php` | the team's colour, chosen or derived as `lib/mark-color.ts` derives it |
| `app/Exceptions/InvitationUnavailable.php` | an invitation or link that can no longer be used |
| `app/Actions/Workspaces/InvitationTerms.php`, `SendInvitation.php`, `SendTeamInvitations.php`, `DeclineWorkspaceInvitation.php`, `InvitationLanding.php` | invitations |
| `app/Actions/Teams/IssueTeamInviteLink.php`, `JoinTeamByLink.php`, `PresentTeamInvitations.php` | the link, the team's pending list |
| `app/Actions/Onboarding/StartOnboarding.php`, `CloseOnboardingForJoiner.php`, `PresentOnboarding.php` | onboarding |
| `app/Notifications/InvitationDeclinedNotification.php`, `app/Actions/Notifications/PresentInvitationDeclinedNotifications.php` | the decline in the bell |
| `app/Policies/WorkspaceInvitationPolicy.php` | `manage` |
| `app/Http/Requests/Invitations/TeamInvitationRequest.php`, `app/Http/Requests/Onboarding/OnboardingWorkspaceRequest.php`, `OnboardingTeamRequest.php` | validation |
| `app/Http/Controllers/TeamInvitationsController.php`, `TeamInviteLinksController.php`, `WorkspaceInvitationResendsController.php`, `InvitationDeclinesController.php`, `InviteLinksController.php`, `InviteLinkMembershipsController.php`, `OnboardingsController.php`, `OnboardingWorkspacesController.php`, `OnboardingTeamsController.php`, `OnboardingInvitationsController.php`, `OnboardingStepsController.php`, `OnboardingCompletionsController.php` | HTTP |

Back end, modified: `app/Models/WorkspaceInvitation.php`, `Team.php`, `Workspace.php`, `User.php`; `database/factories/WorkspaceInvitationFactory.php`; `app/Actions/Workspaces/CreateWorkspaceInvitation.php`, `AcceptWorkspaceInvitation.php`, `IssuedInvitation.php`; `app/Actions/Auth/SignupGate.php`, `ResolveSsoUser.php`; `app/Actions/Fortify/CreateNewUser.php`; `app/Actions/Notifications/ListNotifications.php`, `PresentInvitationNotifications.php`; `app/Notifications/WorkspaceInvitationNotification.php`; `app/Mail/WorkspaceInvitationMail.php`; `resources/views/mail/workspace-invitation.blade.php`, `mail/text/workspace-invitation.blade.php`; `app/Policies/TeamPolicy.php`; `app/Providers/FortifyServiceProvider.php`; `app/Http/Controllers/WorkspaceInvitationsController.php`, `InvitationLinksController.php`, `InvitationAcceptancesController.php`, `InvitationAccountsController.php`, `SsoCallbacksController.php`, `CurrentWorkspaceController.php`, `WorkspaceMembersController.php`, `TeamsController.php`; `routes/web.php`; `tests/Pest.php`.

Tests, created: `tests/Feature/Invitations/{InvitationModelTest,TeamMarkTest,SendInvitationTest,TeamInvitationsTest,InvitationAcceptanceWithTeamTest,InvitationDeclineTest,TeamInviteLinksTest,InviteLinkJoinTest,InvitationListsTest}.php`; `tests/Feature/Onboarding/{OnboardingModelTest,OnboardingStartTest,OnboardingStepsTest}.php`; `tests/Concurrency/{InvitationIssueTest,InvitationAnswerTest,TeamInviteLinkTest,OnboardingStepTest}.php`; `tests/Browser/Visual/OnboardingVisualTest.php` (captures only).

Front end, created: `resources/js/lib/invitations/{types,email-chips}.ts`; `resources/js/components/skrum/{team-mark,email-chips-field}.tsx`; `resources/js/components/invitations/{team-invite-form,invite-link-block,team-invite-dialog,pending-invitations}.tsx`; `resources/js/components/auth/invite-link-card.tsx`; `resources/js/components/onboarding/{onboarding-page,onboarding-header,workspace-step,team-step,invite-step,ritual-step,team-preview}.tsx`; `resources/js/pages/onboarding/show.tsx`, `resources/js/pages/invite-links/show.tsx` (thin in Step A, built in Step B); each with its `.test.ts(x)`. `components/invitations/` and `components/onboarding/` are new domain folders under `components/`, in the pattern of the parent spec §6.1; not new base folders.

## Global Constraints

- **Mockup first** (parent spec §5 rule 13). A screen follows its mockup: layout, placement, labels, states. A difference is fixed, or is a row of **Pre-build deviations**, put to the owner before its screen is built. Captures are taken once, in Task 22, in light, at 1440, in French, and compared with the mockup's `preview.html` in Task 23.
- **Front rules** of the parent spec §5 on every front file: tokens only, rem, Tailwind scale, no overflow from 20rem to 60rem, visible focus, contrast, `prefers-reduced-motion`, lucide icons, the literal call shape `t('…')`, presentational `skrum/` components (no network, no router). Containers in `resources/js/components/<domain>/`. Reuse: `skrum/phase-stepper`, `skrum/column-color-picker` (`columnColors`, `useColumnColorName`), `skrum/text-field`, `skrum/loading-button`, `skrum/confirm-dialog` (`ConfirmDialog`, `FormDialog`), `skrum/avatar-stack`, `auth/sso-buttons`, `auth/password-field`, `auth/access-notice`, `auth/invitation-card`, `lib/mark-color.ts`, `teams/session-create/use-new-session-intent.ts`, `layouts/skrum/onboarding-layout.tsx`.
- **Database (owner rule): Eloquent and the standard query builder only.** `docs/database.md` rules 1 to 12 apply to every line of PHP, migration and test; `tests/Arch/DatabasePortabilityTest.php` enforces them. No raw query of any form; no driver test; migrations with the Schema builder only, `up` only, dated `2026_10_25_…`, no `enum()`, no `->after()`, no collation; a transaction locks its aggregate root first (invitation routes: the invitation row; link joins: the link row; link issue: the team row; onboarding steps: the onboarding row; invitation issue: the workspace row) and is retried with `Transactions::Attempts` only when it touches nothing but the database (no mail, no notification, no broadcast inside a retried callback); explicit tie-breakers; lists read by people sorted with `Alphabetical::sort()`; addresses compared through `LoginAddress::normalise()` and `User::whereAddress()`; tests never read SQL text and never change the schema; writes never skip model events.
- **Tests per task (owner):** each task writes its tests and runs them on PostgreSQL and SQLite: `bin/test-db pgsql -- <paths>` and `bin/test-db sqlite -- <paths>`. Races (`tests/Concurrency`) run on the four engines: `bin/test-db <pgsql|mariadb|mysql|sqlite-file> --concurrency -- <path>`, never on SQLite in memory, never in parallel. Data migrations would run on the four engines; this plan has none (spec §12). The red step may run once on SQLite in memory: `vendor/bin/sail artisan test --compact <path>`. The whole suites on the four engines run at the merges of the lanes and in Task 24.
- **Working rules (owner):** browser walkthroughs (`tests/Browser/Walkthroughs`) are neither written, edited nor run; captures only, in Task 22, light, 1440, French (`VISUAL_ONLY=light-1440-fr`). Vitest is written and run per task (`npm run test -- <pattern>`).
- **No new dependency**, PHP or JS, without the owner's approval.
- **Four languages, informal.** Every new `__('…')` and `t('…')` key is added to `lang/en.json`, `fr.json`, `es.json`, `de.json` in the commit that introduces it (`tests/Feature/TranslationKeysTest.php`), informal (French "tu", Spanish "tú", German "du"; `tests/Feature/InformalRegisterTest.php`). This overrides the mockups' "vous". A key that exists keeps its value.
- **No test is deleted** without the owner's approval. Three tests change their expected redirect (Task 11, listed there).
- Primary and foreign keys are UUIDs (`tests/Feature/UuidPrimaryKeysTest.php`). Create files with `vendor/bin/sail artisan make:… --no-interaction`.
- Controllers: plural name, CRUD method names only (`tests/Arch/ArchTest.php`). Route names camelCase, URLs kebab-case, tuple notation. Form Requests with array rules. Every page the server renders has its file under `resources/js/pages` (`tests/Arch/FrontEndPagesTest.php`): Tasks 10 and 12 create thin pages.
- Arch facts: models do not use `App\Actions`, `App\Http` or `App\Mcp`; actions do not use `App\Http`; `App\Support`, events and notifications do not use `App\Http`; enums use nothing of the application; no class is `final`.
- PHP style: early returns, no `else`, happy path last, typed everything, PascalCase constants, constructor promotion, no comment that restates code; before each commit `vendor/bin/pint --dirty --format agent` and `vendor/bin/sail composer types:check` (PHPStan level 7).
- Octane is installed: no static or per-request state in new classes.
- Front gates after every task that touches the front: `npm run types:check`, `npm run check`, `npm run build:front` (which runs `wayfinder:generate --with-form`, needed after each task that adds a route the front uses).
- One commit per task, in the repository's style (`feat(invitations): …`, `feat(onboarding): …`), each message ending with:

```
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE
```

- **Never push, never merge into `main`.**

## Pre-build deviations

Put to the owner before the screen is built. Reasons as in plan 18e: **F** false or unsafe, **A** accessibility, **N** no such data or concept, **S** the spec, **O** an owner's answer.

| # | Screen | Mockup element | Built | Reason |
|---|---|---|---|---|
| P25-01 | Onboarding step 1 | "Logo · optional", "Upload" | not rendered, place left | S: decision 6 (stored images come with AC-1) |
| P25-02 | Onboarding step 2 | "Team link skrum.nordlys.fr/t/atlas", "Edit" | not rendered, place left | S: decision 7 |
| P25-03 | Onboarding step 2 | "Skip for now" (the frame) | not rendered: "Back" and "Continue" only | the README: "Skip on 3 and 4 only"; a team is what steps 3 and 4 act on |
| P25-04 | Onboarding step 4 | "When · optional" date | not rendered, no place | O: scheduling is backlog |
| P25-05 | Onboarding step 3, invite dialog | `skrum.nordlys.fr/join/8fK2-qT7w` | `…/invite/<40 characters>` | F: `/join/` is the retro guest join; a nine-character code is guessable |
| P25-06 | Onboarding header | avatar and "Log out" | the language switcher kept before them | existing feature kept (owner's rule) |
| P25-07 | Onboarding step 3 | "They join Atlas as members. Facilitators can be set later." with a role select | the sentence follows the selected role (":team gets them as :role.") | F: the select can choose another role |
| P25-08 | Invitation, signed in | "nadia@nordlys.io · already in 2 teams of Nordlys" | the address only | N: backlog |
| P25-09 | Invitation, expired | "Ask for a new invitation" | not rendered | N: backlog (D-54) |
| P25-10 | Invitation, accepted | "if a session is in progress, a banner offers to join it" | none: the team page's open retro shows "Join" | S: §3 |
| P25-11 | Invite link page | no mockup | the invitation card's layout, with the link's states | designed from the invitation card |
| P25-12 | Bell | no `invitation_declined` kind | an item like `team_invite`, the invitee's initial, no buttons | designed from the `team_invite` item |
| P25-13 | Register | "Free up to 10 participants per session. No credit card." and "By creating an account, you accept the terms" | not rendered | F: a self-hosted instance has no plan or terms page (terms: backlog) |
| P25-14 | Register | no "Confirm password" in the mockup | kept | D-52: the server validates the confirmation |
| P25-15 | Onboarding | "In self-host with forced SSO, step 1 is filled by the admin and skipped" | step 1 always shown to a user without a workspace | N: no instance default workspace |

## Review Focus

The inputs the spec implies and that are most likely to bite, each pinned by a test in the task that owns the code.

1. **A link used by more people at once than it has uses left**: no more joins than uses; the count equals the joins. Race in Task 10.
2. **Accept and decline of one invitation at the same moment**, or a double "Decline": one outcome, the other 410. Race in Task 8.
3. **A double "Continue" on step 1 or 2** (double click, two tabs): one workspace, one team. Race in Task 12.
4. **An existing user with no workspace, or an invitation issued before the deploy**: onboarding at step 1; the old invitation accepted as before. Tests in Tasks 7 and 11.
5. **A signed-out visitor of a link who registers**: comes back to the link page after verification, creates no onboarding, joins with one click. Test in Task 11 (full path).
6. **A team inviter who is not a workspace manager** resending or revoking an invitation of another team: 403. Test in Task 6.
7. **An inviter's message with markup or a link**: plain text in the page, the mail (both parts) and the bell. Test in Task 5.

## Lanes

| Lane | Tasks | Cut from | Shares with other lanes |
|---|---|---|---|
| main | 1 to 14, 21 to 24 | — | — |
| Access | 15, 16, 17 | head of Task 14 | `components/auth/invitation-card.tsx` (this lane only), `components/skrum/notifications-panel.tsx` (this lane only), `lang/*.json` |
| Team | 18, 19 | head of Task 14 | `components/teams/team-page.tsx`, `team-members-card.tsx`, plan 23's Members tab, `components/workspaces/{invite-form,members-table}.tsx` (this lane only), `lang/*.json` |
| Onboarding | 20 | head of Task 14 | `layouts/skrum/onboarding-layout.tsx`, `components/skrum/frames.tsx` (this lane only), `lang/*.json` |

The three lanes run in parallel. `components/invitations/team-invite-form.tsx` is built in Task 14 and used read-only by lanes Team and Onboarding; a lane that needs a change to it stops and asks. `lang/*.json` conflicts are resolved by the controller at each merge (keys appended in alphabetical blocks per lane). `tests/Pest.php`: Task 1 adds every helper of Step A.

---

## Step A — back end (single writer)

### Task 1: Preflight; the invitation's team, message and declined state

**Files:**
- Create: `database/migrations/2026_10_25_100000_add_team_and_answer_to_workspace_invitations.php`, `app/Exceptions/InvitationUnavailable.php`
- Modify: `app/Models/WorkspaceInvitation.php`, `database/factories/WorkspaceInvitationFactory.php`, `app/Models/Team.php` (relation `invitations`), `app/Enums/TeamRole.php` (method `invitable()` if plan 23 has none), `tests/Pest.php`
- Test: `tests/Feature/Invitations/InvitationModelTest.php`

Read first: the **Branch and run** checks; `docs/database.md` rules 5 and 9; `database/migrations/2026_10_09_100000_create_whiteboard_tables.php` (foreign keys added to an existing table, run on the four engines); plan 23's `TeamRole`.

**Interfaces:**
- Consumes: `App\Enums\TeamRole` (plan 23).
- Produces: `WorkspaceInvitation::team(): BelongsTo`, `isPending(): bool` (false once declined), `isDeclined(): bool`, casts `team_role` → `?TeamRole`, `declined_at` → `?Carbon`; `Team::invitations(): HasMany`; `TeamRole::invitable(): array<int, TeamRole>` (`Facilitator`, `Member`, `Observer`); factory states `declined()`, `forTeam(Team $team, TeamRole $role = TeamRole::Member)`, `withMessage(string $message)`; `App\Exceptions\InvitationUnavailable extends InvalidArgumentException`; Pest helper `teamInviter(Team $team): User` (a workspace member who is the team's `Owner`, not a workspace manager).

- [ ] **Step 1: Write the failing test**

`tests/Feature/Invitations/InvitationModelTest.php`:

```php
<?php

use App\Enums\TeamRole;
use App\Models\Team;
use App\Models\WorkspaceInvitation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

it('is no longer pending once declined', function () {
    $invitation = WorkspaceInvitation::factory()->declined()->create();

    expect($invitation->isPending())->toBeFalse()
        ->and($invitation->isDeclined())->toBeTrue();
});

it('carries a team, a team role and a message', function () {
    $team = Team::factory()->create();
    $invitation = WorkspaceInvitation::factory()
        ->for($team->workspace)
        ->forTeam($team, TeamRole::Facilitator)
        ->withMessage("See you on Thursday.\nBring coffee.")
        ->create()
        ->fresh();

    expect($invitation->team->is($team))->toBeTrue()
        ->and($invitation->team_role)->toBe(TeamRole::Facilitator)
        ->and($invitation->message)->toBe("See you on Thursday.\nBring coffee.")
        ->and($team->invitations()->sole()->is($invitation))->toBeTrue();
});

it('goes with its team', function () {
    $team = Team::factory()->create();
    WorkspaceInvitation::factory()->for($team->workspace)->forTeam($team)->create();

    $team->delete();

    expect(WorkspaceInvitation::query()->count())->toBe(0);
});

it('reads a row written before the team columns as a pending workspace invitation', function () {
    $invitation = WorkspaceInvitation::factory()->create();
    $id = (string) Str::uuid7();
    DB::table('workspace_invitations')->insert([
        'id' => $id,
        'workspace_id' => $invitation->workspace_id,
        'email' => 'legacy@example.com',
        'role' => 'member',
        'token_hash' => WorkspaceInvitation::hashToken('legacy-token'),
        'expires_at' => now()->addDays(3),
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    $legacy = WorkspaceInvitation::query()->findOrFail($id);

    expect($legacy->isPending())->toBeTrue()
        ->and($legacy->team)->toBeNull()
        ->and($legacy->team_role)->toBeNull()
        ->and($legacy->message)->toBeNull();
});

it('offers every team role but owner to an invitation', function () {
    expect(TeamRole::invitable())->toBe([TeamRole::Facilitator, TeamRole::Member, TeamRole::Observer]);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Invitations/InvitationModelTest.php`
Expected: FAIL (`Call to undefined method … declined()`).

- [ ] **Step 3: Write the migration, the model, the factory and the helper**

`database/migrations/2026_10_25_100000_add_team_and_answer_to_workspace_invitations.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workspace_invitations', function (Blueprint $table) {
            $table->foreignUuid('team_id')->nullable()->constrained()->cascadeOnDelete();
            $table->string('team_role', 20)->nullable();
            $table->string('message', 500)->nullable();
            $table->timestamp('declined_at')->nullable();

            $table->index(['team_id', 'accepted_at']);
        });
    }
};
```

`app/Exceptions/InvitationUnavailable.php`:

```php
<?php

namespace App\Exceptions;

use InvalidArgumentException;

/**
 * An invitation or an invite link that was answered, revoked, used up or
 * that expired between the page and the request.
 */
class InvitationUnavailable extends InvalidArgumentException {}
```

In `app/Models/WorkspaceInvitation.php`: add `team_id`, `team_role`, `message`, `declined_at` to `#[Fillable]` and to the `@property` block (`string|null $team_id`, `TeamRole|null $team_role`, `string|null $message`, `Carbon|null $declined_at`, `-read Team|null $team`); then:

```php
    /** @return BelongsTo<Team, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function isPending(): bool
    {
        if ($this->accepted_at !== null) {
            return false;
        }

        if ($this->declined_at !== null) {
            return false;
        }

        return $this->expires_at->isFuture();
    }

    public function isDeclined(): bool
    {
        return $this->declined_at !== null;
    }
```

and in `casts()`: `'team_role' => TeamRole::class, 'declined_at' => 'datetime'`.

In `app/Models/Team.php`:

```php
    /** @return HasMany<WorkspaceInvitation, $this> */
    public function invitations(): HasMany
    {
        return $this->hasMany(WorkspaceInvitation::class);
    }
```

In `app/Enums/TeamRole.php` (plan 23's file; add only if no equivalent exists):

```php
    /** @return array<int, self> */
    public static function invitable(): array
    {
        return [self::Facilitator, self::Member, self::Observer];
    }
```

In `database/factories/WorkspaceInvitationFactory.php`:

```php
    public function declined(): static
    {
        return $this->state(fn () => ['declined_at' => now()]);
    }

    public function forTeam(Team $team, TeamRole $role = TeamRole::Member): static
    {
        return $this->state(fn () => [
            'workspace_id' => $team->workspace_id,
            'team_id' => $team->id,
            'team_role' => $role,
        ]);
    }

    public function withMessage(string $message): static
    {
        return $this->state(fn () => ['message' => $message]);
    }
```

In `tests/Pest.php`, next to `teamMember()`:

```php
function teamInviter(Team $team): User
{
    $user = User::factory()->create();
    $team->workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
    $team->members()->attach($user, ['role' => TeamRole::Owner->value]);

    return $user;
}
```

- [ ] **Step 4: Run the tests on PostgreSQL and SQLite**

Run: `bin/test-db pgsql -- tests/Feature/Invitations/InvitationModelTest.php tests/Feature/Workspaces tests/Feature/Auth` then `bin/test-db sqlite -- <same paths>`
Expected: PASS on both (the existing invitation tests included).

- [ ] **Step 5: Commit**

```bash
git add database/migrations/2026_10_25_100000_add_team_and_answer_to_workspace_invitations.php app/Exceptions/InvitationUnavailable.php app/Models/WorkspaceInvitation.php app/Models/Team.php app/Enums/TeamRole.php database/factories/WorkspaceInvitationFactory.php tests/Pest.php tests/Feature/Invitations/InvitationModelTest.php
git commit -m "feat(invitations): an invitation carries a team, a role, a message and a declined state

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01HkyiFjbiS1um2Xh5kizhPE"
```

### Task 2: Team colour and workspace language

**Files:**
- Create: `database/migrations/2026_10_25_100100_add_color_to_teams_and_locale_to_workspaces.php`, `app/Support/Teams/TeamMark.php`, `resources/js/lib/mark-color.test.ts` (if absent; else add the cases)
- Modify: `app/Models/Team.php`, `app/Models/Workspace.php`
- Test: `tests/Feature/Invitations/TeamMarkTest.php`

**Interfaces:**
- Produces: `Team::$color` cast `?ColumnColor`, fillable; `Workspace::$locale` fillable `?string`; `TeamMark::colorFor(Team): ColumnColor`, `TeamMark::derived(string $id): ColumnColor`, `TeamMark::Order` (the order of `lib/mark-color.ts`).

- [ ] **Step 1: Write the failing tests**

`tests/Feature/Invitations/TeamMarkTest.php`:

```php
<?php

use App\Enums\ColumnColor;
use App\Models\Team;
use App\Models\Workspace;
use App\Support\Teams\TeamMark;

it('derives the colour of an id as lib/mark-color.ts does', function (string $id, ColumnColor $expected) {
    expect(TeamMark::derived($id))->toBe($expected);
})->with([
    ['00000000-0000-0000-0000-000000000000', ColumnColor::Apricot],
    ['0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b', ColumnColor::Iris],
    ['0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c', ColumnColor::Moss],
    ['0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e', ColumnColor::Sky],
    ['0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a60', ColumnColor::Lagoon],
]);

it('prefers the colour the team chose', function () {
    $team = Team::factory()->create(['color' => ColumnColor::Plum])->fresh();

    expect($team->color)->toBe(ColumnColor::Plum)
        ->and(TeamMark::colorFor($team))->toBe(ColumnColor::Plum);
});

it('keeps an existing team without a colour on its derived one', function () {
    $team = Team::factory()->create()->fresh();

    expect($team->color)->toBeNull()
        ->and(TeamMark::colorFor($team))->toBe(TeamMark::derived($team->id));
});

it('stores the default language of a workspace', function () {
    expect(Workspace::factory()->create(['locale' => 'de'])->fresh()->locale)->toBe('de')
        ->and(Workspace::factory()->create()->fresh()->locale)->toBeNull();
});
```

`resources/js/lib/mark-color.test.ts` (the same ids, the parity half):

```ts
import { describe, expect, it } from 'vitest';
import { markColorClass } from '@/lib/mark-color';

describe('markColorClass', () => {
    it.each([
        ['00000000-0000-0000-0000-000000000000', 'col-apricot'],
        ['0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b', 'col-iris'],
        ['0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5c', 'col-moss'],
        ['0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5e', 'col-sky'],
        ['0199a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a60', 'col-lagoon'],
    ])('gives %s the class %s, as TeamMark::derived does', (id, expected) => {
        expect(markColorClass(id)).toBe(expected);
    });
});
```

- [ ] **Step 2: Run them to see the PHP one fail**

Run: `vendor/bin/sail artisan test --compact tests/Feature/Invitations/TeamMarkTest.php` — Expected: FAIL (class `TeamMark` not found). `npm run test -- mark-color` — Expected: PASS (the TypeScript side exists).

- [ ] **Step 3: Implement**

Migration:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('teams', function (Blueprint $table) {
            $table->string('color', 20)->nullable();
        });

        Schema::table('workspaces', function (Blueprint $table) {
            $table->string('locale', 5)->nullable();
        });
    }
};
```

`app/Support/Teams/TeamMark.php`:

```php
<?php

namespace App\Support\Teams;

use App\Enums\ColumnColor;
use App\Models\Team;

class TeamMark
{
    /** The order of `resources/js/lib/mark-color.ts`: both must give one id the same colour. */
    public const array Order = [
        ColumnColor::Coral,
        ColumnColor::Lagoon,
        ColumnColor::Iris,
        ColumnColor::Moss,
        ColumnColor::Apricot,
        ColumnColor::Sky,
        ColumnColor::Plum,
        ColumnColor::Sun,
    ];

    public static function colorFor(Team $team): ColumnColor
    {
        return $team->color ?? self::derived($team->id);
    }

    public static function derived(string $id): ColumnColor
    {
        $sum = 0;

        foreach (mb_str_split($id) as $character) {
            $sum += mb_ord($character);
        }

        return self::Order[$sum % count(self::Order)];
    }
}
```

`Team`: add `'color'` to `#[Fillable]`, `@property ColumnColor|null $color`, and `protected function casts(): array { return ['color' => ColumnColor::class]; }` (merge with plan 23's casts if any). `Workspace`: add `'locale'` to `#[Fillable]` and `@property string|null $locale`.

- [ ] **Step 4: Run on PostgreSQL and SQLite; Vitest**

Run: `bin/test-db pgsql -- tests/Feature/Invitations/TeamMarkTest.php tests/Feature/Teams tests/Feature/Workspaces`, then `bin/test-db sqlite -- <same>`; `npm run test -- mark-color`.
Expected: PASS.

- [ ] **Step 5: Commit** — `feat(teams): a team may choose its colour; a workspace its default language` (trailer as in Global Constraints).

### Task 3: The team's invite link

**Files:**
- Create: `database/migrations/2026_10_25_100200_create_team_invite_links_table.php`, `app/Models/TeamInviteLink.php`, `database/factories/TeamInviteLinkFactory.php`
- Modify: `app/Models/Team.php` (relations)
- Test: `tests/Feature/Invitations/TeamInviteLinksTest.php` (model part; Task 9 adds the routes)

**Interfaces:**
- Produces: `TeamInviteLink` with constants `ValidForDays = 7`, `MaxUses = 20`; `hashToken(string): string`, `findByToken(?string): ?self`, `isUsable(): bool`, `url(): string` (route `inviteLinks.show`, defined in Task 10 — until then the test asserts the path), relations `team()`, `createdBy()`; `Team::inviteLinks(): HasMany`, `Team::usableInviteLink(): ?TeamInviteLink`; factory states `expired()`, `revoked()`, `usedUp()`, `withToken(string)`.

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Models\Team;
use App\Models\TeamInviteLink;
use Illuminate\Support\Facades\DB;

it('keeps the token encrypted and finds the link by its hash', function () {
    $link = TeamInviteLink::factory()->withToken('link-token-0123456789abcdefghijklmnopqrstu')->create();

    expect(DB::table('team_invite_links')->value('token'))->not->toContain('link-token')
        ->and($link->fresh()->token)->toBe('link-token-0123456789abcdefghijklmnopqrstu')
        ->and(TeamInviteLink::findByToken('link-token-0123456789abcdefghijklmnopqrstu')?->is($link))->toBeTrue()
        ->and(TeamInviteLink::findByToken('other'))->toBeNull()
        ->and($link->toArray())->not->toHaveKeys(['token', 'token_hash']);
});

it('is usable until it expires, is revoked or is used up', function (string $state, bool $usable) {
    $factory = TeamInviteLink::factory();
    $link = ($state === 'fresh' ? $factory : $factory->{$state}())->create();

    expect($link->isUsable())->toBe($usable);
})->with([
    ['fresh', true],
    ['expired', false],
    ['revoked', false],
    ['usedUp', false],
]);

it('gives a team its one usable link', function () {
    $team = Team::factory()->create();
    TeamInviteLink::factory()->for($team)->revoked()->create();
    $usable = TeamInviteLink::factory()->for($team)->create();

    expect($team->usableInviteLink()?->is($usable))->toBeTrue()
        ->and(Team::factory()->create()->usableInviteLink())->toBeNull();
});

it('goes with its team', function () {
    $link = TeamInviteLink::factory()->create();

    $link->team->delete();

    expect(TeamInviteLink::query()->count())->toBe(0);
});
```

- [ ] **Step 2: Run it to see it fail** — `vendor/bin/sail artisan test --compact tests/Feature/Invitations/TeamInviteLinksTest.php` — Expected: FAIL (class not found).

- [ ] **Step 3: Implement**

Migration:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('team_invite_links', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_id')->constrained()->cascadeOnDelete();
            $table->text('token');
            $table->string('token_hash', 64)->unique();
            $table->foreignUuid('created_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('team_role', 20);
            $table->dateTime('expires_at');
            $table->unsignedSmallInteger('max_uses');
            $table->unsignedInteger('uses_count')->default(0);
            $table->timestamp('revoked_at')->nullable();
            $table->timestamps();

            $table->index(['team_id', 'revoked_at']);
        });
    }
};
```

`app/Models/TeamInviteLink.php`:

```php
<?php

namespace App\Models;

use App\Enums\TeamRole;
use Database\Factories\TeamInviteLinkFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $team_id
 * @property string $token
 * @property string $token_hash
 * @property string|null $created_by_id
 * @property TeamRole $team_role
 * @property Carbon $expires_at
 * @property int $max_uses
 * @property int $uses_count
 * @property Carbon|null $revoked_at
 * @property-read Team $team
 * @property-read User|null $createdBy
 */
#[Fillable(['token', 'token_hash', 'created_by_id', 'team_role', 'expires_at', 'max_uses', 'uses_count', 'revoked_at'])]
#[Hidden(['token', 'token_hash'])]
class TeamInviteLink extends Model
{
    /** @use HasFactory<TeamInviteLinkFactory> */
    use HasFactory;

    use HasUuids;

    public const int ValidForDays = 7;

    public const int MaxUses = 20;

    public static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    public static function findByToken(?string $token): ?self
    {
        if ($token === null || $token === '') {
            return null;
        }

        return static::query()->where('token_hash', static::hashToken($token))->first();
    }

    /** @return BelongsTo<Team, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /** @return BelongsTo<User, $this> */
    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_id');
    }

    public function isUsable(): bool
    {
        if ($this->revoked_at !== null) {
            return false;
        }

        if (! $this->expires_at->isFuture()) {
            return false;
        }

        return $this->uses_count < $this->max_uses;
    }

    public function url(): string
    {
        return route('inviteLinks.show', $this->token);
    }

    protected function casts(): array
    {
        return [
            'token' => 'encrypted',
            'team_role' => TeamRole::class,
            'expires_at' => 'datetime',
            'revoked_at' => 'datetime',
            'max_uses' => 'integer',
            'uses_count' => 'integer',
        ];
    }
}
```

`Team`:

```php
    /** @return HasMany<TeamInviteLink, $this> */
    public function inviteLinks(): HasMany
    {
        return $this->hasMany(TeamInviteLink::class);
    }

    public function usableInviteLink(): ?TeamInviteLink
    {
        $link = $this->inviteLinks()->whereNull('revoked_at')->latest()->orderByDesc('id')->first();

        return $link?->isUsable() === true ? $link : null;
    }
```

Factory `definition()`: `team_id` → `Team::factory()`, `token` → `$token = Str::random(40)`, `token_hash` → hash of it (use `afterMaking`/a closure so both use one token: `'token' => $token = Str::random(40), 'token_hash' => TeamInviteLink::hashToken($token)` inside `definition()`), `team_role` → `TeamRole::Member`, `expires_at` → `now()->addDays(TeamInviteLink::ValidForDays)`, `max_uses` → `TeamInviteLink::MaxUses`, `uses_count` → 0. States: `expired()` (`expires_at` a minute ago), `revoked()` (`revoked_at` now), `usedUp()` (`uses_count` = `max_uses`), `withToken(string $token)` (both columns).

`url()` needs the route of Task 10: until then, the model test does not call it; Task 10's test does.

- [ ] **Step 4: Run on PostgreSQL and SQLite** — `bin/test-db pgsql -- tests/Feature/Invitations/TeamInviteLinksTest.php`, then `sqlite`. Expected: PASS.

- [ ] **Step 5: Commit** — `feat(invitations): the team invite link` (trailer).

### Task 4: The onboarding row

**Files:**
- Create: `app/Enums/OnboardingStep.php`, `database/migrations/2026_10_25_100300_create_onboardings_table.php`, `app/Models/Onboarding.php`, `database/factories/OnboardingFactory.php`
- Modify: `app/Models/User.php` (relation `onboarding`)
- Test: `tests/Feature/Onboarding/OnboardingModelTest.php`

**Interfaces:**
- Produces: `OnboardingStep` (`Workspace = 'workspace'`, `Team = 'team'`, `Invite = 'invite'`, `Ritual = 'ritual'`, method `number(): int` 1 to 4); `Onboarding` (fillable `step`, `workspace_id`, `team_id`, `team_name`, `completed_at`; casts; relations `user()`, `workspace()`, `team()`; `isCompleted(): bool`); `User::onboarding(): HasOne`; factory states `atStep(OnboardingStep)`, `completed()`.

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Enums\OnboardingStep;
use App\Models\Onboarding;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

it('starts at the workspace step and is not completed', function () {
    $onboarding = Onboarding::factory()->create()->fresh();

    expect($onboarding->step)->toBe(OnboardingStep::Workspace)
        ->and($onboarding->isCompleted())->toBeFalse()
        ->and($onboarding->user->onboarding->is($onboarding))->toBeTrue();
});

it('numbers the steps from one to four', function () {
    expect(array_map(fn (OnboardingStep $step): int => $step->number(), OnboardingStep::cases()))->toBe([1, 2, 3, 4]);
});

it('gives a user one onboarding at most', function () {
    $user = User::factory()->create();
    Onboarding::factory()->for($user)->create();

    expect(fn () => DB::transaction(fn () => Onboarding::factory()->for($user)->create()))
        ->toThrow(UniqueConstraintViolationException::class);
});

it('forgets the workspace it created when the workspace is deleted', function () {
    $workspace = Workspace::factory()->create();
    $onboarding = Onboarding::factory()->create(['workspace_id' => $workspace->id]);

    $workspace->delete();

    expect($onboarding->fresh()->workspace_id)->toBeNull();
});
```

- [ ] **Step 2: Run it to see it fail** — Expected: FAIL (class not found).

- [ ] **Step 3: Implement**

`app/Enums/OnboardingStep.php`:

```php
<?php

namespace App\Enums;

enum OnboardingStep: string
{
    case Workspace = 'workspace';
    case Team = 'team';
    case Invite = 'invite';
    case Ritual = 'ritual';

    public function number(): int
    {
        return match ($this) {
            self::Workspace => 1,
            self::Team => 2,
            self::Invite => 3,
            self::Ritual => 4,
        };
    }
}
```

Migration:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('onboardings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('step', 20);
            $table->foreignUuid('workspace_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignUuid('team_id')->nullable()->constrained()->nullOnDelete();
            $table->string('team_name', 100)->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });
    }
};
```

`app/Models/Onboarding.php`:

```php
<?php

namespace App\Models;

use App\Enums\OnboardingStep;
use Database\Factories\OnboardingFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property string $id
 * @property string $user_id
 * @property OnboardingStep $step
 * @property string|null $workspace_id
 * @property string|null $team_id
 * @property string|null $team_name
 * @property Carbon|null $completed_at
 * @property-read User $user
 * @property-read Workspace|null $workspace
 * @property-read Team|null $team
 */
#[Fillable(['step', 'workspace_id', 'team_id', 'team_name', 'completed_at'])]
class Onboarding extends Model
{
    /** @use HasFactory<OnboardingFactory> */
    use HasFactory;

    use HasUuids;

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<Workspace, $this> */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    /** @return BelongsTo<Team, $this> */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function isCompleted(): bool
    {
        return $this->completed_at !== null;
    }

    protected function casts(): array
    {
        return [
            'step' => OnboardingStep::class,
            'completed_at' => 'datetime',
        ];
    }
}
```

`User`:

```php
    /** @return HasOne<Onboarding, $this> */
    public function onboarding(): HasOne
    {
        return $this->hasOne(Onboarding::class);
    }
```

Factory: `user_id` → `User::factory()`, `step` → `OnboardingStep::Workspace`; states `atStep(OnboardingStep $step)`, `completed()`.

- [ ] **Step 4: Run on PostgreSQL and SQLite** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(onboarding): one onboarding row per user who founds a workspace` (trailer).

### Task 5: One way to send an invitation; team, message and language in the mail

**Files:**
- Create: `app/Actions/Workspaces/InvitationTerms.php`, `app/Actions/Workspaces/SendInvitation.php`, `tests/Feature/Invitations/SendInvitationTest.php`, `tests/Concurrency/InvitationIssueTest.php`
- Modify: `app/Actions/Workspaces/CreateWorkspaceInvitation.php`, `IssuedInvitation.php`, `app/Http/Controllers/WorkspaceInvitationsController.php`, `app/Notifications/WorkspaceInvitationNotification.php`, `app/Mail/WorkspaceInvitationMail.php`, `resources/views/mail/workspace-invitation.blade.php`, `resources/views/mail/text/workspace-invitation.blade.php`, `tests/Feature/Mail/WorkspaceInvitationMailTest.php` (new cases only)

Read first: `WorkspaceInvitationsController` (the whole store, `notifyExistingAccount`), `WorkspaceInvitationMail`, the two Blade views, `docs/design-system/components/Emails/README.md` (`InvitationMail`), `MailMockupTest` (what it asserts of the invitation mail).

**Interfaces:**
- Consumes: Task 1 (`team`, `team_role`, `message`), Task 2 (`TeamMark`, `workspaces.locale`).
- Produces: `InvitationTerms(string $email, WorkspaceRole $role, ?Team $team = null, ?TeamRole $teamRole = null, ?string $message = null)`; `CreateWorkspaceInvitation::handle(Workspace $workspace, User $inviter, InvitationTerms $terms): IssuedInvitation` (signature changed; the only caller is the controller); `IssuedInvitation::url(): string`; `SendInvitation::handle(Workspace $workspace, User $inviter, InvitationTerms $terms): IssuedInvitation`.

- [ ] **Step 1: Write the failing tests**

`tests/Feature/Invitations/SendInvitationTest.php`:

```php
<?php

use App\Actions\Workspaces\InvitationTerms;
use App\Actions\Workspaces\SendInvitation;
use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Mail\WorkspaceInvitationMail;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Notifications\WorkspaceInvitationNotification;
use App\Notifications\WorkspaceInvitationReceivedNotification;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Notification;

it('issues a team invitation with its role and message, mails it and tells the bell', function () {
    Notification::fake();
    $team = Team::factory()->create(['name' => 'Atlas']);
    $inviter = workspaceManager($team->workspace);
    $known = User::factory()->create(['email' => 'nadia@example.com', 'email_verified_at' => now()]);

    $issued = resolve(SendInvitation::class)->handle($team->workspace, $inviter, new InvitationTerms(
        'Nadia@Example.com ', WorkspaceRole::Member, $team, TeamRole::Facilitator, '  See you Thursday.  ',
    ));

    expect($issued->invitation->email)->toBe('nadia@example.com')
        ->and($issued->invitation->team_id)->toBe($team->id)
        ->and($issued->invitation->team_role)->toBe(TeamRole::Facilitator)
        ->and($issued->invitation->message)->toBe('See you Thursday.')
        ->and($issued->url())->toBe(route('invitations.show', $issued->token));
    Notification::assertSentOnDemand(WorkspaceInvitationNotification::class);
    Notification::assertSentTo($known, WorkspaceInvitationReceivedNotification::class);
});

it('writes to an address without an account in the language of the workspace', function () {
    Notification::fake();
    $workspace = Workspace::factory()->create(['locale' => 'es']);
    $inviter = workspaceManager($workspace);

    resolve(SendInvitation::class)->handle($workspace, $inviter, new InvitationTerms('new@example.com', WorkspaceRole::Member));

    Notification::assertSentOnDemand(
        WorkspaceInvitationNotification::class,
        fn (WorkspaceInvitationNotification $notification) => $notification->locale === 'es',
    );
});

it('shows the team, its colour and the message in the mail, as plain text', function () {
    $team = Team::factory()->create(['name' => 'Atlas', 'color' => 'lagoon']);
    $inviter = workspaceManager($team->workspace);
    $issued = resolve(SendInvitation::class)->handle($team->workspace, $inviter, new InvitationTerms(
        'new@example.com', WorkspaceRole::Member, $team, TeamRole::Member, '<b>Hi</b> [click](https://evil.test)',
    ));

    $mail = (new WorkspaceInvitationNotification($team->workspace->name, $inviter->name, $issued->url(), $issued->invitation->expires_at, $issued->invitation->id))
        ->toMail((new AnonymousNotifiable)->route('mail', 'new@example.com'));
    $html = (string) $mail->render();

    expect($mail)->toBeInstanceOf(WorkspaceInvitationMail::class)
        ->and($mail->subject)->toBe("{$inviter->name} invited you to join Atlas on {$team->workspace->name}")
        ->and($html)->toContain('Atlas')
        ->toContain('&lt;b&gt;Hi&lt;/b&gt;')
        ->not->toContain('href="https://evil.test"');
    $mail->assertSeeInText('[click](https://evil.test)');
});
```

`tests/Concurrency/InvitationIssueTest.php`:

```php
<?php

use App\Actions\Workspaces\CreateWorkspaceInvitation;
use App\Actions\Workspaces\InvitationTerms;
use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use Tests\Concurrency\Support\Race;

it('leaves one pending invitation when one address is invited twice at the same instant', function () {
    $workspace = Workspace::factory()->create();
    $inviter = workspaceManager($workspace);
    $workspaceId = $workspace->id;
    $inviterId = $inviter->id;

    $outcomes = Race::run(array_fill(0, 2, static fn (): string => resolve(CreateWorkspaceInvitation::class)->handle(
        Workspace::query()->findOrFail($workspaceId),
        User::query()->findOrFail($inviterId),
        new InvitationTerms('same@example.com', WorkspaceRole::Member),
    )->invitation->id));

    expect(array_column($outcomes, 'ok'))->each->toBeTrue()
        ->and(WorkspaceInvitation::query()->where('email', 'same@example.com')->whereNull('accepted_at')->count())->toBe(1);
});
```

The protection proved: the workspace row is locked before the pending invitations of the address are read; without the lock both transactions read none and insert one each.

- [ ] **Step 2: Run them to see them fail** — `vendor/bin/sail artisan test --compact tests/Feature/Invitations/SendInvitationTest.php` — Expected: FAIL (class `InvitationTerms` not found). Then `bin/test-db pgsql --concurrency -- tests/Concurrency/InvitationIssueTest.php` — Expected: FAIL (same).

- [ ] **Step 3: Implement**

`app/Actions/Workspaces/InvitationTerms.php`:

```php
<?php

namespace App\Actions\Workspaces;

use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Team;

class InvitationTerms
{
    public function __construct(
        public string $email,
        public WorkspaceRole $role,
        public ?Team $team = null,
        public ?TeamRole $teamRole = null,
        public ?string $message = null,
    ) {}

    public function cleanMessage(): ?string
    {
        $message = trim((string) $this->message);

        return $message === '' ? null : $message;
    }
}
```

`CreateWorkspaceInvitation::handle`:

```php
    public function handle(Workspace $workspace, User $inviter, InvitationTerms $terms): IssuedInvitation
    {
        $token = Str::random(40);

        $invitation = DB::transaction(function () use ($workspace, $inviter, $terms, $token): WorkspaceInvitation {
            Workspace::query()->whereKey($workspace->id)->lockForUpdate()->first();

            /** @var array<int, string> $replacedIds */
            $replacedIds = $workspace->invitations()
                ->where('email', LoginAddress::normalise($terms->email))
                ->whereNull('accepted_at')
                ->pluck('id')
                ->all();

            $workspace->invitations()->whereKey($replacedIds)->delete();
            $this->forgetNotifications->handle($replacedIds);

            return $workspace->invitations()->create([
                'email' => $terms->email,
                'role' => $terms->role,
                'team_id' => $terms->team?->id,
                'team_role' => $terms->team === null ? null : $terms->teamRole,
                'message' => $terms->cleanMessage(),
                'token_hash' => WorkspaceInvitation::hashToken($token),
                'invited_by_id' => $inviter->id,
                'expires_at' => now()->addDays(self::ValidForDays),
            ]);
        }, Transactions::Attempts);

        return new IssuedInvitation($invitation, $token);
    }
```

`IssuedInvitation::url()`: `return route('invitations.show', $this->token);`

`app/Actions/Workspaces/SendInvitation.php` — the body of today's controller, moved:

```php
<?php

namespace App\Actions\Workspaces;

use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use App\Notifications\WorkspaceInvitationNotification;
use App\Notifications\WorkspaceInvitationReceivedNotification;
use Illuminate\Support\Facades\Notification;
use SensitiveParameter;

class SendInvitation
{
    public function __construct(private CreateWorkspaceInvitation $createInvitation) {}

    public function handle(Workspace $workspace, User $inviter, InvitationTerms $terms): IssuedInvitation
    {
        $issued = $this->createInvitation->handle($workspace, $inviter, $terms);

        $recipientLocale = User::query()->whereAddress($terms->email)->value('locale');

        Notification::route('mail', $issued->invitation->email)->notify(
            (new WorkspaceInvitationNotification($workspace->name, $inviter->name, $issued->url(), $issued->invitation->expires_at, $issued->invitation->id))
                ->locale($recipientLocale ?? $workspace->locale ?? app()->getLocale()),
        );

        $this->notifyExistingAccount($issued->invitation, $issued->token);

        return $issued;
    }

    /**
     * The bell of the one verified account that owns the invited address is told of the
     * invitation. The inviter's answer is the same whether or not such an account exists.
     */
    private function notifyExistingAccount(WorkspaceInvitation $invitation, #[SensitiveParameter] string $token): void
    {
        $accounts = User::query()
            ->whereAddress($invitation->email)
            ->whereNotNull('email_verified_at')
            ->limit(2)
            ->get();

        if ($accounts->count() !== 1) {
            return;
        }

        $accounts->sole()->notify(new WorkspaceInvitationReceivedNotification($invitation->id, $token));
    }
}
```

`WorkspaceInvitationsController::store` now validates also `team_id` (`['nullable', 'uuid', Rule::exists('teams', 'id')->where('workspace_id', $workspace->id)]`), `team_role` (`['nullable', 'required_with:team_id', Rule::in(array_map(fn (TeamRole $role): string => $role->value, TeamRole::invitable()))]`), `message` (`['nullable', 'string', 'max:500']`); the "already a member" check reads the team when one is given (`$team->members()->whereAddress(...)->exists()`, message `__('This person is already in :team.', ['team' => $team->name])`) and the workspace otherwise; then `$issued = $sendInvitation->handle($workspace, $request->user(), new InvitationTerms(...))`, and flashes `$issued->url()` when `mail.default` is `log`, as today. `notifyExistingAccount` leaves the controller.

`WorkspaceInvitationNotification::toMail` reads `$invitation?->team` and `$invitation?->message`: subject `__(':inviter invited you to join :team on :workspace', …)` for a team invitation, today's otherwise; passes to the mail `teamName`, `teamInitial` (`mb_substr` of the squished name, upper case), `teamColor` (`TeamMark::colorFor($team)->value`), `teamMembersCount` (`$team->members()->count()`), and `message`. `WorkspaceInvitationMail` takes these five as constructor arguments with `null` defaults (appended after the existing ones, so `MailPreviewsController` keeps compiling; it passes none).

`workspace-invitation.blade.php`: when `$teamName` is set, the heading reads `__(':inviter invited you to join the :team team in the :workspace workspace', …)` and the block holds the mark (a 36 px square in the column colour's light token from `$colors` — use the `col-<colour>` background and border values the mail palette already carries for ROTI and presence; if it carries none for columns, add the eight light/dark pairs to `MailBrand`'s palette from `resources/css` tokens and say so in the report), the team name, `trans_choice('{1} :count member|[2,*] :count members', $teamMembersCount)` and the workspace name; when `$message` is set, a quoted paragraph `{{ $message }}` with `white-space:pre-line`. The text part: the same lines, `{!! $message !!}` kept literal as the existing text part does.

- [ ] **Step 4: Run on PostgreSQL and SQLite; the race on the four engines**

Run: `bin/test-db pgsql -- tests/Feature/Invitations/SendInvitationTest.php tests/Feature/Workspaces/WorkspaceInvitationsTest.php tests/Feature/Mail`, then `sqlite`. Then `bin/test-db pgsql --concurrency -- tests/Concurrency/InvitationIssueTest.php`, `mariadb`, `mysql`, `sqlite-file`.
Expected: PASS everywhere; the existing workspace invitation tests pass unchanged.

- [ ] **Step 5: Commit** — `feat(invitations): one action sends every invitation; the mail shows the team and the message` (trailer).

### Task 6: Inviting to a team; resend and revoke by the team's inviters

**Files:**
- Create: `app/Actions/Workspaces/SendTeamInvitations.php`, `app/Http/Requests/Invitations/TeamInvitationRequest.php`, `app/Http/Controllers/TeamInvitationsController.php`, `app/Http/Controllers/WorkspaceInvitationResendsController.php`, `app/Policies/WorkspaceInvitationPolicy.php`, `tests/Feature/Invitations/TeamInvitationsTest.php`
- Modify: `app/Policies/TeamPolicy.php` (`invite`), `app/Http/Controllers/WorkspaceInvitationsController.php` (`destroy` authorises `manage` on the invitation), `routes/web.php`

**Interfaces:**
- Consumes: Task 5 (`SendInvitation`, `InvitationTerms`).
- Produces: `TeamPolicy::invite(User, Team): bool`; `WorkspaceInvitationPolicy::manage(User, WorkspaceInvitation): bool`; `SendTeamInvitations::handle(Team $team, User $inviter, array $emails, TeamRole $role, ?string $message): array<int, IssuedInvitation>` (throws `ValidationException` keyed `emails.<index>`); routes `teams.invitations.store`, `workspaces.invitations.resend.store`.

- [ ] **Step 1: Write the failing tests**

```php
<?php

use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use App\Notifications\WorkspaceInvitationNotification;
use Illuminate\Support\Facades\Notification;

beforeEach(fn () => Notification::fake());

it('lets a team inviter invite several addresses to the team at once', function () {
    $team = Team::factory()->create();
    $inviter = teamInviter($team);

    $this->actingAs($inviter)
        ->post(route('teams.invitations.store', [$team->workspace, $team]), [
            'emails' => ['camille@example.com', ' Theo@Example.com', 'camille@example.com'],
            'role' => 'observer',
            'message' => 'Welcome!',
        ])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    $invitations = $team->invitations()->orderBy('email')->get();

    expect($invitations->pluck('email')->all())->toBe(['camille@example.com', 'theo@example.com'])
        ->and($invitations->pluck('team_role')->unique()->all())->toBe([TeamRole::Observer])
        ->and($invitations->pluck('role')->unique()->all())->toBe([WorkspaceRole::Member])
        ->and($invitations->pluck('message')->unique()->all())->toBe(['Welcome!']);
    Notification::assertSentOnDemandTimes(WorkspaceInvitationNotification::class, 2);
});

it('names the address that cannot be invited and sends nothing', function (array $emails, string $errorKey) {
    $team = Team::factory()->create();
    $inviter = teamInviter($team);
    $inTeam = teamMember($team);

    $this->actingAs($inviter)
        ->post(route('teams.invitations.store', [$team->workspace, $team]), [
            'emails' => array_map(fn (string $email): string => $email === 'IN_TEAM' ? $inTeam->email : $email, $emails),
            'role' => 'member',
        ])
        ->assertSessionHasErrors($errorKey);

    expect(WorkspaceInvitation::query()->count())->toBe(0);
    Notification::assertNothingSent();
})->with([
    'invalid' => [['ok@example.com', 'malik@nordlys'], 'emails.1'],
    'already in the team' => [['ok@example.com', 'IN_TEAM'], 'emails.1'],
    'more than twenty' => [array_map(fn (int $i): string => "p{$i}@example.com", range(1, 21)), 'emails'],
    'none' => [[], 'emails'],
]);

it('invites a member of the workspace who is not in the team', function () {
    $team = Team::factory()->create();
    $inviter = teamInviter($team);
    $colleague = User::factory()->create();
    $team->workspace->members()->attach($colleague, ['role' => WorkspaceRole::Member->value]);

    $this->actingAs($inviter)
        ->post(route('teams.invitations.store', [$team->workspace, $team]), ['emails' => [$colleague->email], 'role' => 'member'])
        ->assertSessionHasNoErrors();

    expect($team->invitations()->count())->toBe(1);
});

it('refuses the owner role and refuses people who may not invite', function () {
    $team = Team::factory()->create();

    $this->actingAs(teamInviter($team))
        ->post(route('teams.invitations.store', [$team->workspace, $team]), ['emails' => ['a@example.com'], 'role' => 'owner'])
        ->assertSessionHasErrors('role');

    $this->actingAs(teamMember($team))
        ->post(route('teams.invitations.store', [$team->workspace, $team]), ['emails' => ['a@example.com'], 'role' => 'member'])
        ->assertForbidden();
});

it('lets a team inviter resend and revoke the invitations of the team and of no other', function () {
    $team = Team::factory()->create();
    $other = Team::factory()->for($team->workspace)->create();
    $inviter = teamInviter($team);
    $own = WorkspaceInvitation::factory()->forTeam($team)->create(['email' => 'own@example.com']);
    $foreign = WorkspaceInvitation::factory()->forTeam($other)->create();
    $workspaceOnly = WorkspaceInvitation::factory()->for($team->workspace)->create();

    $this->actingAs($inviter)->post(route('workspaces.invitations.resend.store', [$team->workspace, $own]))->assertRedirect();
    $this->actingAs($inviter)->post(route('workspaces.invitations.resend.store', [$team->workspace, $foreign]))->assertForbidden();
    $this->actingAs($inviter)->delete(route('workspaces.invitations.destroy', [$team->workspace, $workspaceOnly]))->assertForbidden();

    $resent = $team->invitations()->sole();

    expect($resent->email)->toBe('own@example.com')
        ->and($resent->is($own))->toBeFalse()
        ->and($resent->invited_by_id)->toBe($inviter->id);
    Notification::assertSentOnDemandTimes(WorkspaceInvitationNotification::class, 1);

    $this->actingAs($inviter)->delete(route('workspaces.invitations.destroy', [$team->workspace, $resent]))->assertRedirect();
    expect($team->invitations()->count())->toBe(0);
});
```

- [ ] **Step 2: Run them to see them fail** — Expected: FAIL (route `teams.invitations.store` not defined).

- [ ] **Step 3: Implement**

`TeamPolicy`:

```php
    public function invite(User $user, Team $team): bool
    {
        return $this->manageMembers($user, $team);
    }
```

`app/Policies/WorkspaceInvitationPolicy.php`:

```php
<?php

namespace App\Policies;

use App\Models\User;
use App\Models\WorkspaceInvitation;

class WorkspaceInvitationPolicy
{
    public function manage(User $user, WorkspaceInvitation $invitation): bool
    {
        if ($user->canManage($invitation->workspace)) {
            return true;
        }

        if ($invitation->team === null) {
            return false;
        }

        return $user->can('invite', $invitation->team);
    }
}
```

`app/Http/Requests/Invitations/TeamInvitationRequest.php`:

```php
<?php

namespace App\Http\Requests\Invitations;

use App\Enums\TeamRole;
use App\Support\Auth\LoginAddress;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TeamInvitationRequest extends FormRequest
{
    public const int MaxAddresses = 20;

    public function authorize(): bool
    {
        $team = $this->route('team');

        return $team === null || $this->user()->can('invite', $team);
    }

    protected function prepareForValidation(): void
    {
        $emails = $this->input('emails');

        if (! is_array($emails)) {
            return;
        }

        $this->merge([
            'emails' => array_values(array_unique(array_map(
                fn (mixed $email): string => LoginAddress::normalise((string) $email),
                $emails,
            ))),
        ]);
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'emails' => ['required', 'array', 'min:1', 'max:'.self::MaxAddresses],
            'emails.*' => ['required', 'string', 'email', 'max:255'],
            'role' => ['required', Rule::in(array_map(fn (TeamRole $role): string => $role->value, TeamRole::invitable()))],
            'message' => ['nullable', 'string', 'max:500'],
        ];
    }

    /** @return array<int, string> */
    public function emails(): array
    {
        return $this->validated('emails');
    }

    public function teamRole(): TeamRole
    {
        return TeamRole::from($this->validated('role'));
    }
}
```

`app/Actions/Workspaces/SendTeamInvitations.php`:

```php
<?php

namespace App\Actions\Workspaces;

use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class SendTeamInvitations
{
    public function __construct(private SendInvitation $sendInvitation) {}

    /**
     * @param  array<int, string>  $emails  normalised and distinct
     * @return array<int, IssuedInvitation>
     */
    public function handle(Team $team, User $inviter, array $emails, TeamRole $role, ?string $message): array
    {
        $errors = [];

        foreach ($emails as $index => $email) {
            if ($team->members()->whereAddress($email)->exists()) {
                $errors["emails.{$index}"] = __(':email is already in :team.', ['email' => $email, 'team' => $team->name]);
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }

        $issued = [];

        foreach ($emails as $email) {
            $issued[] = $this->sendInvitation->handle(
                $team->workspace,
                $inviter,
                new InvitationTerms($email, WorkspaceRole::Member, $team, $role, $message),
            );
        }

        return $issued;
    }
}
```

`app/Http/Controllers/TeamInvitationsController.php`:

```php
<?php

namespace App\Http\Controllers;

use App\Actions\Workspaces\IssuedInvitation;
use App\Actions\Workspaces\SendTeamInvitations;
use App\Http\Requests\Invitations\TeamInvitationRequest;
use App\Models\Team;
use App\Models\Workspace;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;

class TeamInvitationsController extends Controller
{
    public function store(TeamInvitationRequest $request, Workspace $workspace, Team $team, SendTeamInvitations $sendInvitations): RedirectResponse
    {
        $issued = $sendInvitations->handle($team, $request->user(), $request->emails(), $request->teamRole(), $request->validated('message'));

        if (config('mail.default') === 'log') {
            Inertia::flash('invitationUrls', array_map(fn (IssuedInvitation $invitation): string => $invitation->url(), $issued));
        }

        Inertia::flash('invitationsSent', count($issued));

        return back();
    }
}
```

Authorisation is the request's `authorize()`, so a non-inviter gets 403 before any validation.

`WorkspaceInvitationResendsController::store(Workspace $workspace, WorkspaceInvitation $invitation, SendInvitation $send)`: `Gate::authorize('manage', $invitation)`; `$send->handle($workspace, $request->user(), new InvitationTerms($invitation->email, $invitation->role, $invitation->team, $invitation->team_role, $invitation->message))` (which deletes the old row and its bell item, issues a new token and a new expiry); flash the URL when mail is logged; `back()`.

`WorkspaceInvitationsController::destroy`: `Gate::authorize('manage', $invitation)` in place of `manageMembers` on the workspace.

Routes, inside the `w/{workspace}` group:

```php
            Route::post('teams/{team}/invitations', [TeamInvitationsController::class, 'store'])->name('teams.invitations.store')->middleware('throttle:10,1,teamInvitations');
            Route::post('invitations/{invitation}/resend', [WorkspaceInvitationResendsController::class, 'store'])->name('workspaces.invitations.resend.store')->middleware('throttle:20,1,invitationResends');
```

- [ ] **Step 4: Run on PostgreSQL and SQLite** — `tests/Feature/Invitations/TeamInvitationsTest.php tests/Feature/Workspaces`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(invitations): invite to a team, resend and revoke by the team's inviters` (trailer).

### Task 7: Accepting a team invitation; the invitation page's new props

**Files:**
- Create: `app/Actions/Workspaces/InvitationLanding.php`, `tests/Feature/Invitations/InvitationAcceptanceWithTeamTest.php`
- Modify: `app/Actions/Workspaces/AcceptWorkspaceInvitation.php`, `app/Http/Controllers/InvitationAcceptancesController.php`, `InvitationAccountsController.php`, `InvitationLinksController.php`, `SsoCallbacksController.php`, `app/Actions/Auth/ResolveSsoUser.php` (nothing but the exception type it may receive), `app/Actions/Notifications/PresentInvitationNotifications.php` (`team` names the team)

**Interfaces:**
- Consumes: Tasks 1, 4.
- Produces: `AcceptWorkspaceInvitation::handle(WorkspaceInvitation, User): void` locks the invitation row and throws `InvitationUnavailable` when it is no longer pending; joins the team with the invitation's role; calls `CloseOnboardingForJoiner` (Task 11 creates it — in this task call nothing; Task 11 adds the call and its test). `InvitationLanding::url(WorkspaceInvitation, User): string`. Invitation page props `team` (`array{name: string, initial: string, color: string}|null`), `teamRole` (`?string`), `message` (`?string`), `isDeclined` (`bool`), `declineUrl` (`?string`, Task 8 fills it).

- [ ] **Step 1: Write the failing tests**

```php
<?php

use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use Inertia\Testing\AssertableInertia as Assert;

it('joins the workspace and the team with their roles and opens the team page', function () {
    $team = Team::factory()->create();
    $user = User::factory()->create(['email' => 'nadia@example.com']);
    WorkspaceInvitation::factory()->forTeam($team, TeamRole::Facilitator)->withToken('team-token')->create(['email' => 'nadia@example.com']);

    $this->actingAs($user)
        ->post(route('invitations.acceptance.store', 'team-token'))
        ->assertRedirect(route('teams.show', [$team->workspace, $team]));

    expect($user->roleIn($team->workspace))->toBe(WorkspaceRole::Member)
        ->and($team->members()->whereKey($user->id)->first()?->pivot->role)->toBe(TeamRole::Facilitator->value);
});

it('never changes a role the account already has', function () {
    $team = Team::factory()->create();
    $user = workspaceManager($team->workspace);
    $team->members()->attach($user, ['role' => TeamRole::Owner->value]);
    WorkspaceInvitation::factory()->forTeam($team, TeamRole::Observer)->withToken('team-token')->create(['email' => $user->email]);

    $this->actingAs($user)->post(route('invitations.acceptance.store', 'team-token'));

    expect($user->roleIn($team->workspace))->toBe(WorkspaceRole::Admin)
        ->and($team->members()->whereKey($user->id)->first()?->pivot->role)->toBe(TeamRole::Owner->value);
});

it('joins the team when the account is created on the card', function () {
    config(['skrum.signup_mode' => 'invite']);
    $team = Team::factory()->create();
    WorkspaceInvitation::factory()->forTeam($team)->withToken('team-token')->create(['email' => 'new@example.com']);

    $this->post(route('invitations.account.store', 'team-token'), ['name' => 'Nadia Benali', 'password' => 'a-long-enough-password-42'])
        ->assertRedirect(route('teams.show', [$team->workspace, $team]));

    expect($team->members()->where('email', 'new@example.com')->exists())->toBeTrue();
});

it('keeps accepting an invitation issued before the team columns as before', function () {
    $invitation = WorkspaceInvitation::factory()->withToken('old-token')->create(['email' => 'old@example.com']);
    $user = User::factory()->create(['email' => 'old@example.com']);

    $this->actingAs($user)
        ->post(route('invitations.acceptance.store', 'old-token'))
        ->assertRedirect(route('workspaces.show', $invitation->workspace));
});

it('shows the team, its mark, the role and the message on the invitation page', function () {
    $team = Team::factory()->create(['name' => 'Atlas', 'color' => 'lagoon']);
    teamMember($team);
    WorkspaceInvitation::factory()->forTeam($team, TeamRole::Facilitator)->withMessage('See you Thursday.')->withToken('team-token')->create();

    $this->get(route('invitations.show', 'team-token'))
        ->assertInertia(fn (Assert $page) => $page
            ->component('invitations/show')
            ->where('team', ['name' => 'Atlas', 'initial' => 'A', 'color' => 'lagoon'])
            ->where('teamRole', 'facilitator')
            ->where('message', 'See you Thursday.')
            ->where('membersCount', 1)
            ->where('isDeclined', false));
});

it('refuses with 410 an invitation that stopped being pending under the lock', function () {
    $invitation = WorkspaceInvitation::factory()->declined()->withToken('gone')->create(['email' => 'x@example.com']);

    $this->actingAs(User::factory()->create(['email' => 'x@example.com']))
        ->post(route('invitations.acceptance.store', 'gone'))
        ->assertStatus(410);

    expect($invitation->fresh()->accepted_at)->toBeNull();
});
```

- [ ] **Step 2: Run them to see them fail** — Expected: FAIL (redirect to the workspace page; no `team` prop).

- [ ] **Step 3: Implement**

`AcceptWorkspaceInvitation::handle`:

```php
    public function handle(WorkspaceInvitation $invitation, User $user): void
    {
        throw_unless($invitation->matchesEmail($user->email), InvalidArgumentException::class, 'The invitation was sent to another email address.');

        DB::transaction(function () use ($invitation, $user): void {
            $locked = WorkspaceInvitation::query()->lockForUpdate()->find($invitation->id);

            if ($locked === null || ! $locked->isPending()) {
                throw new InvitationUnavailable('The invitation is no longer pending.');
            }

            $workspace = $locked->workspace;

            if (! $user->belongsToWorkspace($workspace)) {
                $workspace->members()->attach($user, ['role' => $locked->role->value]);
            }

            if ($locked->team !== null && ! $locked->team->hasMember($user)) {
                $locked->team->members()->attach($user, ['role' => $locked->team_role?->value ?? TeamRole::Member->value]);
            }

            $locked->update(['accepted_at' => now()]);
            $this->forgetNotifications->handle([$locked->id]);

            $user->forceFill(['current_workspace_id' => $workspace->id])->save();
        });
    }
```

When called from `CreateNewUser::createForInvitation`, the invitation row is already locked by the outer transaction: the nested `lockForUpdate` on the same row in the same connection returns at once on every engine.

`app/Actions/Workspaces/InvitationLanding.php`:

```php
<?php

namespace App\Actions\Workspaces;

use App\Models\User;
use App\Models\WorkspaceInvitation;

class InvitationLanding
{
    public function url(WorkspaceInvitation $invitation, User $user): string
    {
        $team = $invitation->team;

        if ($team !== null && $user->can('view', $team)) {
            return route('teams.show', [$invitation->workspace, $team]);
        }

        return route('workspaces.show', $invitation->workspace);
    }
}
```

`InvitationAcceptancesController::store`: keep the 404/410/403 checks, wrap the call — `try { $acceptInvitation->handle(...); } catch (InvitationUnavailable) { abort(410); }` — and `return redirect($landing->url($invitation->fresh(), $request->user()));`. `InvitationAccountsController::store`: the same landing. `SsoCallbacksController`: when the invitation was accepted, `redirect()->setIntendedUrl($landing->url(...))` before `$completeLogin->handle(...)` (read `CompleteLogin` first: if it ignores the intended URL, add a test and report).

`InvitationLinksController::show`, pending branch, adds:

```php
            'team' => $invitation->team === null ? null : [
                'name' => $invitation->team->name,
                'initial' => mb_strtoupper(mb_substr(trim($invitation->team->name), 0, 1)),
                'color' => TeamMark::colorFor($invitation->team)->value,
            ],
            'teamRole' => $invitation->team_role?->value,
            'message' => $invitation->message,
            'isDeclined' => false,
            'declineUrl' => null,
```

and `pendingDetails()` reads the team's members (and its count) when the invitation has a team, the workspace's otherwise. The expired branch gets `'isDeclined' => $invitation->isDeclined()` (Task 8 renders it). A signed-in member of the **team** is redirected to the team page (today: a member of the workspace is redirected to the workspace page — keep that for a workspace invitation, and for a team invitation redirect only when already in the team, since a workspace member may be invited to a team).

`PresentInvitationNotifications`: load `team` with the invitation; `'team' => $invitation->team?->name ?? $invitation->workspace->name`.

- [ ] **Step 4: Run on PostgreSQL and SQLite** — `tests/Feature/Invitations tests/Feature/Auth tests/Feature/Notifications tests/Feature/Workspaces`. Expected: PASS (the existing `InvitationPagePropsTest`, `InvitationAccountTest`, `InvitationSsoTest`, `BellNotificationsTest` unchanged).
- [ ] **Step 5: Commit** — `feat(invitations): accepting a team invitation joins the team with its role` (trailer).

### Task 8: Declining, and the inviter's bell item

**Files:**
- Create: `app/Actions/Workspaces/DeclineWorkspaceInvitation.php`, `app/Notifications/InvitationDeclinedNotification.php`, `app/Actions/Notifications/PresentInvitationDeclinedNotifications.php`, `app/Http/Controllers/InvitationDeclinesController.php`, `tests/Feature/Invitations/InvitationDeclineTest.php`, `tests/Concurrency/InvitationAnswerTest.php`
- Modify: `app/Actions/Notifications/ListNotifications.php`, `app/Http/Controllers/InvitationLinksController.php` (`declineUrl`, declined state), `app/Providers/FortifyServiceProvider.php` (limiter `invitationDeclines`), `routes/web.php`

**Interfaces:**
- Produces: `DeclineWorkspaceInvitation::handle(WorkspaceInvitation): WorkspaceInvitation` (throws `InvitationUnavailable`); `InvitationDeclinedNotification::Kind = 'invitation_declined'`, data `{kind, invitationId, email, workspaceId, teamId}`; presenter output per notification `array{actor: null, email: string, team: string, href: string}`; route `invitations.decline.store`.

- [ ] **Step 1: Write the failing tests**

```php
<?php

use App\Models\Team;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use App\Notifications\InvitationDeclinedNotification;
use App\Notifications\WorkspaceInvitationReceivedNotification;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

it('declines a pending invitation without an account, and the link then says so', function () {
    Notification::fake();
    $team = Team::factory()->create();
    $inviter = teamInviter($team);
    $invitation = WorkspaceInvitation::factory()->forTeam($team)->withToken('t')->create(['invited_by_id' => $inviter->id]);

    $this->post(route('invitations.decline.store', 't'))->assertRedirect(route('invitations.show', 't'));

    expect($invitation->fresh()->isDeclined())->toBeTrue();
    Notification::assertSentTo($inviter, InvitationDeclinedNotification::class);
    $this->get(route('invitations.show', 't'))
        ->assertInertia(fn (Assert $page) => $page->where('isDeclined', true)->where('inviter.name', $inviter->name));
    $this->actingAs(User::factory()->create(['email' => $invitation->email]))
        ->post(route('invitations.acceptance.store', 't'))
        ->assertStatus(410);
});

it('removes the invitee bell item and tells nobody when the inviter left the workspace', function () {
    $team = Team::factory()->create();
    $inviter = teamInviter($team);
    $invitee = User::factory()->create(['email_verified_at' => now()]);
    $invitation = WorkspaceInvitation::factory()->forTeam($team)->withToken('t')->create(['email' => $invitee->email, 'invited_by_id' => $inviter->id]);
    $invitee->notifyNow(new WorkspaceInvitationReceivedNotification($invitation->id, 't'));
    $team->workspace->members()->detach($inviter);

    $this->post(route('invitations.decline.store', 't'));

    expect($invitee->notifications()->count())->toBe(0)
        ->and($inviter->notifications()->count())->toBe(0);
});

it('refuses to decline an invitation that is no longer pending', function (string $state) {
    WorkspaceInvitation::factory()->{$state}()->withToken('t')->create();

    $this->post(route('invitations.decline.store', 't'))->assertStatus(410);
})->with(['accepted', 'declined', 'expired']);

it('presents the decline in the inviter bell, linking to the team', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $inviter = teamInviter($team);
    $invitation = WorkspaceInvitation::factory()->forTeam($team)->create(['email' => 'nadia@example.com', 'invited_by_id' => $inviter->id]);
    $inviter->notifyNow(new InvitationDeclinedNotification($invitation->id, 'nadia@example.com', $team->workspace_id, $team->id));

    $this->actingAs($inviter)
        ->getJson(route('notifications.index'))
        ->assertJsonPath('notifications.0.kind', 'invitation_declined')
        ->assertJsonPath('notifications.0.email', 'nadia@example.com')
        ->assertJsonPath('notifications.0.team', 'Atlas')
        ->assertJsonPath('notifications.0.href', route('teams.show', [$team->workspace, $team]).'#members');
});
```

(Read `NotificationsController` and `BellNotificationsTest` first: use the route name and response shape they use; the assertions above follow `ListNotifications::handle`.)

`tests/Concurrency/InvitationAnswerTest.php`:

```php
<?php

use App\Actions\Workspaces\AcceptWorkspaceInvitation;
use App\Actions\Workspaces\DeclineWorkspaceInvitation;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use Tests\Concurrency\Support\Race;

it('lets one answer win when an invitation is accepted and declined at the same instant', function () {
    $user = User::factory()->create(['email' => 'nadia@example.com']);
    $invitation = WorkspaceInvitation::factory()->create(['email' => 'nadia@example.com']);
    $invitationId = $invitation->id;
    $userId = $user->id;

    $outcomes = Race::run([
        static fn (): string => tap('accepted', fn () => resolve(AcceptWorkspaceInvitation::class)->handle(WorkspaceInvitation::query()->findOrFail($invitationId), User::query()->findOrFail($userId))),
        static fn (): string => tap('declined', fn () => resolve(DeclineWorkspaceInvitation::class)->handle(WorkspaceInvitation::query()->findOrFail($invitationId))),
    ]);

    $fresh = $invitation->fresh();

    expect(array_column($outcomes, 'ok'))->toContain(true)
        ->and(collect($outcomes)->where('ok', false)->pluck('error')->all())->each->toBe(\App\Exceptions\InvitationUnavailable::class)
        ->and(($fresh->accepted_at !== null) xor ($fresh->declined_at !== null))->toBeTrue()
        ->and($user->belongsToWorkspace($fresh->workspace))->toBe($fresh->accepted_at !== null);
});
```

The protection proved: both actions lock the invitation row and re-read `isPending()` under the lock; without it both write.

- [ ] **Step 2: Run them to see them fail** — Expected: FAIL (route not defined).

- [ ] **Step 3: Implement**

`app/Actions/Workspaces/DeclineWorkspaceInvitation.php`:

```php
<?php

namespace App\Actions\Workspaces;

use App\Actions\Notifications\ForgetInvitationNotifications;
use App\Exceptions\InvitationUnavailable;
use App\Models\WorkspaceInvitation;
use App\Notifications\InvitationDeclinedNotification;
use Illuminate\Support\Facades\DB;

class DeclineWorkspaceInvitation
{
    public function __construct(private ForgetInvitationNotifications $forgetNotifications) {}

    public function handle(WorkspaceInvitation $invitation): WorkspaceInvitation
    {
        $declined = DB::transaction(function () use ($invitation): WorkspaceInvitation {
            $locked = WorkspaceInvitation::query()->lockForUpdate()->find($invitation->id);

            if ($locked === null || ! $locked->isPending()) {
                throw new InvitationUnavailable('The invitation is no longer pending.');
            }

            $locked->update(['declined_at' => now()]);
            $this->forgetNotifications->handle([$locked->id]);

            return $locked;
        });

        $this->tellInviter($declined);

        return $declined;
    }

    private function tellInviter(WorkspaceInvitation $invitation): void
    {
        $inviter = $invitation->invitedBy;

        if ($inviter === null) {
            return;
        }

        if (! $inviter->belongsToWorkspace($invitation->workspace)) {
            return;
        }

        $inviter->notify(new InvitationDeclinedNotification($invitation->id, $invitation->email, $invitation->workspace_id, $invitation->team_id));
    }
}
```

`app/Notifications/InvitationDeclinedNotification.php`:

```php
<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

class InvitationDeclinedNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public const string Kind = 'invitation_declined';

    public function __construct(
        public string $invitationId,
        public string $email,
        public string $workspaceId,
        public ?string $teamId,
    ) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * @return array{
     *     kind: string,
     *     invitationId: string,
     *     email: string,
     *     workspaceId: string,
     *     teamId: string|null
     * }
     */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => self::Kind,
            'invitationId' => $this->invitationId,
            'email' => $this->email,
            'workspaceId' => $this->workspaceId,
            'teamId' => $this->teamId,
        ];
    }
}
```

`PresentInvitationDeclinedNotifications::handle(User $user, Collection $notifications): array<string, array{actor: null, email: string, team: string, href: string}>`: filter the kind; load the workspaces and teams by id in two queries; for each, skip when the user no longer belongs to the workspace; when the team exists and `$user->can('view', $team)`: `team` = its name, `href` = `route('teams.show', [$workspace, $team]).'#members'`; otherwise `team` = the workspace name and `href` = `route('workspaces.members.index', $workspace)` for a manager, `route('workspaces.show', $workspace)` for anyone else. `ListNotifications` spreads it with the others and lists the kind in `hasPresenter()`, so an item whose workspace the user left is deleted as the others are.

`InvitationDeclinesController::store(string $token, DeclineWorkspaceInvitation $decline)`: `findByToken` → 404 when null; `try { $decline->handle($invitation); } catch (InvitationUnavailable) { abort(410); }`; `$request->session()->forget('invitation_token')`; `return to_route('invitations.show', $token);`.

`InvitationLinksController::show`: a declined invitation renders the not-pending branch with `isDeclined: true` (the inviter's name kept); the pending branch sends `declineUrl` = `route('invitations.decline.store', $token)`.

Route, outside the auth groups: `Route::post('invitations/{token}/decline', [InvitationDeclinesController::class, 'store'])->middleware('throttle:invitationDeclines')->name('invitations.decline.store');` and the limiter in `FortifyServiceProvider::configureRateLimiting()`: `RateLimiter::for('invitationDeclines', fn (Request $request) => Limit::perMinute(10)->by('invitation-decline-ip:'.$request->ip()));`.

- [ ] **Step 4: Run on PostgreSQL and SQLite; the race on the four engines** — `tests/Feature/Invitations/InvitationDeclineTest.php tests/Feature/Notifications`; `bin/test-db <engine> --concurrency -- tests/Concurrency/InvitationAnswerTest.php` for `pgsql`, `mariadb`, `mysql`, `sqlite-file`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(invitations): decline an invitation; the inviter is told in the bell` (trailer).

### Task 9: Managing the team's link; the team page's invitation props

**Files:**
- Create: `app/Actions/Teams/IssueTeamInviteLink.php`, `app/Actions/Teams/PresentTeamInvitations.php`, `app/Http/Controllers/TeamInviteLinksController.php`, `tests/Concurrency/TeamInviteLinkTest.php`
- Modify: `app/Http/Controllers/TeamsController.php`, `routes/web.php`, `tests/Feature/Invitations/TeamInviteLinksTest.php`

**Interfaces:**
- Produces: `IssueTeamInviteLink::handle(Team, User): TeamInviteLink`; routes `teams.inviteLink.store|destroy`; team page props `canInvite: bool`, `inviteRoles: array<int, string>`, `inviteLink` (optional prop: `array{url: string, expiresAt: string, maxUses: int, usesCount: int}|null`), `pendingInvitations: array<int, array{id: string, email: string, teamRole: string, status: 'pending'|'expired'|'declined', invitedAt: string}>` (empty unless `canInvite`), `team.color: string` (chosen or derived).

- [ ] **Step 1: Write the failing tests** (appended to `TeamInviteLinksTest.php`)

```php
it('creates the link, replaces it, and turns it off', function () {
    $team = Team::factory()->create();
    $inviter = teamInviter($team);

    $this->actingAs($inviter)->post(route('teams.inviteLink.store', [$team->workspace, $team]))->assertRedirect();
    $first = $team->usableInviteLink();

    $this->actingAs($inviter)->post(route('teams.inviteLink.store', [$team->workspace, $team]));
    $second = $team->usableInviteLink();

    expect($first?->fresh()->revoked_at)->not->toBeNull()
        ->and($second?->is($first))->toBeFalse()
        ->and($second?->created_by_id)->toBe($inviter->id)
        ->and($second?->max_uses)->toBe(TeamInviteLink::MaxUses)
        ->and($second?->expires_at->diffInDays(now(), true))->toBeGreaterThan(6.9);

    $this->actingAs($inviter)->delete(route('teams.inviteLink.destroy', [$team->workspace, $team]))->assertRedirect();
    expect($team->usableInviteLink())->toBeNull();
});

it('refuses the link to someone who may not invite', function () {
    $team = Team::factory()->create();

    $this->actingAs(teamMember($team))->post(route('teams.inviteLink.store', [$team->workspace, $team]))->assertForbidden();
});

it('gives the team page the link and the pending invitations of the team to its inviters only', function () {
    $team = Team::factory()->create();
    $inviter = teamInviter($team);
    $link = TeamInviteLink::factory()->for($team)->withToken('page-token-0123456789abcdefghijklmnopqrstu')->create();
    WorkspaceInvitation::factory()->forTeam($team)->create(['email' => 'b@example.com']);
    WorkspaceInvitation::factory()->forTeam($team)->declined()->create(['email' => 'a@example.com']);

    $this->actingAs($inviter)
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('canInvite', true)
            ->where('inviteRoles', ['facilitator', 'member', 'observer'])
            ->where('pendingInvitations.0.email', 'a@example.com')
            ->where('pendingInvitations.0.status', 'declined')
            ->where('pendingInvitations.1.status', 'pending')
            ->missing('inviteLink')
            ->reloadOnly('inviteLink', fn (Assert $reload) => $reload
                ->where('inviteLink.url', route('inviteLinks.show', 'page-token-0123456789abcdefghijklmnopqrstu'))
                ->where('inviteLink.usesCount', 0)));

    $this->actingAs(teamMember($team))
        ->get(route('teams.show', [$team->workspace, $team]))
        ->assertInertia(fn (Assert $page) => $page->where('canInvite', false)->where('pendingInvitations', []));
});
```

(`reloadOnly` is the Inertia 3 testing helper for partial reloads; check its exact name with `search-docs` — "testing partial reloads" — and use the installed one. `inviteLinks.show` is defined in Task 10: run this test after Task 10, or define the route name in this task with a placeholder controller method that Task 10 fills — prefer moving this one test into Task 10's file if the route is not yet there.)

`tests/Concurrency/TeamInviteLinkTest.php`:

```php
<?php

use App\Actions\Teams\IssueTeamInviteLink;
use App\Models\Team;
use App\Models\TeamInviteLink;
use App\Models\User;
use Tests\Concurrency\Support\Race;

it('leaves one usable link when two are created at the same instant', function () {
    $team = Team::factory()->create();
    $inviter = teamInviter($team);
    $teamId = $team->id;
    $inviterId = $inviter->id;

    $outcomes = Race::run(array_fill(0, 2, static fn (): string => resolve(IssueTeamInviteLink::class)->handle(
        Team::query()->findOrFail($teamId),
        User::query()->findOrFail($inviterId),
    )->id));

    expect(array_column($outcomes, 'ok'))->each->toBeTrue()
        ->and(TeamInviteLink::query()->where('team_id', $teamId)->whereNull('revoked_at')->count())->toBe(1);
});
```

The protection proved: the team row is locked before the open links are revoked.

- [ ] **Step 2: Run them to see them fail** — Expected: FAIL.

- [ ] **Step 3: Implement**

```php
<?php

namespace App\Actions\Teams;

use App\Enums\TeamRole;
use App\Models\Team;
use App\Models\TeamInviteLink;
use App\Models\User;
use App\Support\Database\Transactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class IssueTeamInviteLink
{
    public function handle(Team $team, User $creator): TeamInviteLink
    {
        return DB::transaction(function () use ($team, $creator): TeamInviteLink {
            Team::query()->whereKey($team->id)->lockForUpdate()->first();

            $team->inviteLinks()->whereNull('revoked_at')->update(['revoked_at' => now()]);

            $token = Str::random(40);

            return $team->inviteLinks()->create([
                'token' => $token,
                'token_hash' => TeamInviteLink::hashToken($token),
                'created_by_id' => $creator->id,
                'team_role' => TeamRole::Member,
                'expires_at' => now()->addDays(TeamInviteLink::ValidForDays),
                'max_uses' => TeamInviteLink::MaxUses,
                'uses_count' => 0,
            ]);
        }, Transactions::Attempts);
    }
}
```

`TeamInviteLinksController`: `store(Request, Workspace, Team, IssueTeamInviteLink)` → `Gate::authorize('invite', $team)`, issue, `back()`; `destroy(Workspace, Team)` → authorize, `$team->inviteLinks()->whereNull('revoked_at')->update(['revoked_at' => now()])`, `back()`. Routes in the workspace group: `Route::post('teams/{team}/invite-link', …)->name('teams.inviteLink.store')->middleware('throttle:10,1,inviteLinks')` and `Route::delete('teams/{team}/invite-link', …)->name('teams.inviteLink.destroy')`.

`PresentTeamInvitations::handle(Team): array` — the team's invitations not accepted, each with `status` (`declined` when `declined_at`, `expired` when not pending, else `pending`), `teamRole`, `invitedAt` ISO 8601; sorted with `Alphabetical::sort()` on the e-mail, then by id.

`TeamsController::show`: `$canInvite = $request->user()->can('invite', $team);` then

```php
            'team' => [...$team->only(['id', 'name']), 'color' => TeamMark::colorFor($team)->value],
            'canInvite' => $canInvite,
            'inviteRoles' => array_map(fn (TeamRole $role): string => $role->value, TeamRole::invitable()),
            'inviteLink' => Inertia::optional(fn (): ?array => $canInvite ? $this->inviteLink($team) : null),
            'pendingInvitations' => $canInvite ? $presentTeamInvitations->handle($team) : [],
```

with

```php
    /** @return array{url: string, expiresAt: string, maxUses: int, usesCount: int}|null */
    private function inviteLink(Team $team): ?array
    {
        $link = $team->usableInviteLink();

        if ($link === null) {
            return null;
        }

        return [
            'url' => $link->url(),
            'expiresAt' => $link->expires_at->toIso8601String(),
            'maxUses' => $link->max_uses,
            'usesCount' => $link->uses_count,
        ];
    }
```

(Plan 23 may already have added keys to `team`: merge, do not replace.)

- [ ] **Step 4: Run on PostgreSQL and SQLite; the race on the four engines.** Expected: PASS (`tests/Feature/Teams` included: the new `team.color` key must not break an existing exact-match assertion; where one does, add the key to the expected value and list the test in the commit message).
- [ ] **Step 5: Commit** — `feat(invitations): the team's link — create, replace, turn off; the team page's invitation props` (trailer).

### Task 10: Opening and joining the link; registration and SSO know the link

**Files:**
- Create: `app/Actions/Teams/JoinTeamByLink.php`, `app/Http/Controllers/InviteLinksController.php`, `app/Http/Controllers/InviteLinkMembershipsController.php`, `resources/js/pages/invite-links/show.tsx` (thin), `tests/Feature/Invitations/InviteLinkJoinTest.php`
- Modify: `app/Actions/Auth/SignupGate.php`, `app/Actions/Fortify/CreateNewUser.php`, `app/Actions/Auth/ResolveSsoUser.php`, `app/Http/Controllers/SsoCallbacksController.php`, `app/Providers/FortifyServiceProvider.php` (register and login views read the link), `routes/web.php`, `tests/Concurrency/TeamInviteLinkTest.php`

**Interfaces:**
- Consumes: Tasks 3, 9.
- Produces: `JoinTeamByLink::handle(TeamInviteLink, User): Team` (throws `InvitationUnavailable`); session key `invite_link_token` (constant `InviteLinksController::SessionKey`); `SignupGate::allows(string $email, ?WorkspaceInvitation $invitation = null, ?TeamInviteLink $link = null): bool`, `canShowRegistration(?WorkspaceInvitation $invitation = null, ?TeamInviteLink $link = null): bool`; `ResolveSsoUser::handle(SsoProvider, AbstractUser, ?WorkspaceInvitation, ?TeamInviteLink $link = null): User`; page `invite-links/show` props `isInvalid`, `isUsable`, `token`, `teamName`, `team` (mark), `workspaceName`, `inviter`, `membersCount`, `members`, `teamRole`, `isLoggedIn`, `isVerified`, `canRegister`, `ssoRequired`, `ssoProviders`.

- [ ] **Step 1: Write the failing tests**

```php
<?php

use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Team;
use App\Models\TeamInviteLink;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

it('adds a verified account to the workspace and the team and counts the use', function () {
    $link = TeamInviteLink::factory()->withToken('join-token-0123456789abcdefghijklmnopqrst')->create();
    $user = User::factory()->create();

    $this->actingAs($user)
        ->post(route('inviteLinks.membership.store', 'join-token-0123456789abcdefghijklmnopqrst'))
        ->assertRedirect(route('teams.show', [$link->team->workspace, $link->team]));

    expect($user->roleIn($link->team->workspace))->toBe(WorkspaceRole::Member)
        ->and($link->team->members()->whereKey($user->id)->first()?->pivot->role)->toBe(TeamRole::Member->value)
        ->and($link->fresh()->uses_count)->toBe(1)
        ->and($user->fresh()->current_workspace_id)->toBe($link->team->workspace_id);
});

it('counts nothing for someone already in the team', function () {
    $link = TeamInviteLink::factory()->withToken('join-token-0123456789abcdefghijklmnopqrst')->create();
    $member = teamMember($link->team);

    $this->actingAs($member)->post(route('inviteLinks.membership.store', 'join-token-0123456789abcdefghijklmnopqrst'))->assertRedirect();

    expect($link->fresh()->uses_count)->toBe(0);
});

it('refuses a link that expired, was turned off or is used up', function (string $state) {
    TeamInviteLink::factory()->{$state}()->withToken('join-token-0123456789abcdefghijklmnopqrst')->create();

    $this->actingAs(User::factory()->create())
        ->post(route('inviteLinks.membership.store', 'join-token-0123456789abcdefghijklmnopqrst'))
        ->assertStatus(410);
})->with(['expired', 'revoked', 'usedUp']);

it('asks an unverified account to verify its address before joining', function () {
    TeamInviteLink::factory()->withToken('join-token-0123456789abcdefghijklmnopqrst')->create();

    $this->actingAs(User::factory()->unverified()->create())
        ->post(route('inviteLinks.membership.store', 'join-token-0123456789abcdefghijklmnopqrst'))
        ->assertRedirect(route('verification.notice'));
});

it('shows a signed-out visitor the team and remembers the link for registration', function () {
    config(['skrum.signup_mode' => 'invite']);
    $link = TeamInviteLink::factory()->withToken('join-token-0123456789abcdefghijklmnopqrst')->create();

    $this->get(route('inviteLinks.show', 'join-token-0123456789abcdefghijklmnopqrst'))
        ->assertSessionHas('invite_link_token', 'join-token-0123456789abcdefghijklmnopqrst')
        ->assertInertia(fn (Assert $page) => $page
            ->component('invite-links/show')
            ->where('isUsable', true)
            ->where('teamName', $link->team->name)
            ->where('canRegister', true)
            ->where('isLoggedIn', false));

    $this->get(route('register'))->assertOk();
});

it('opens registration through a link by signup mode', function (string $mode, string $email, bool $allowed) {
    config(['skrum.signup_mode' => $mode, 'skrum.allowed_email_domains' => ['nordlys.io']]);
    User::factory()->create();
    $link = TeamInviteLink::factory()->create();

    expect(resolve(\App\Actions\Auth\SignupGate::class)->allows($email, null, $link))->toBe($allowed);
})->with([
    'invite mode' => ['invite', 'anyone@example.com', true],
    'domain mode, listed domain' => ['domain', 'nadia@nordlys.io', true],
    'domain mode, other domain' => ['domain', 'anyone@example.com', false],
    'open mode' => ['open', 'anyone@example.com', true],
]);

it('shows the link page of a used-up link as no longer working, naming its creator', function () {
    $link = TeamInviteLink::factory()->usedUp()->withToken('join-token-0123456789abcdefghijklmnopqrst')->create();

    $this->get(route('inviteLinks.show', 'join-token-0123456789abcdefghijklmnopqrst'))
        ->assertInertia(fn (Assert $page) => $page->where('isUsable', false)->where('inviter.name', $link->createdBy?->name));
});

it('answers 404 with the invalid card for an unknown token', function () {
    $this->get(route('inviteLinks.show', 'nope'))->assertNotFound();
});
```

Append to `tests/Concurrency/TeamInviteLinkTest.php`:

```php
it('lets no more people join than the link has uses left', function () {
    $link = TeamInviteLink::factory()->create(['max_uses' => 3]);
    $linkId = $link->id;
    $userIds = User::factory()->count(4)->create()->modelKeys();

    $outcomes = Race::run(array_map(
        static fn (string $userId) => static fn (): string => resolve(\App\Actions\Teams\JoinTeamByLink::class)
            ->handle(TeamInviteLink::query()->findOrFail($linkId), User::query()->findOrFail($userId))->id,
        $userIds,
    ));

    expect(collect($outcomes)->where('ok', true)->count())->toBe(3)
        ->and(collect($outcomes)->where('ok', false)->pluck('error')->all())->toBe([\App\Exceptions\InvitationUnavailable::class])
        ->and($link->team->members()->count())->toBe(3)
        ->and($link->fresh()->uses_count)->toBe(3);
});

it('counts one use when one account joins twice at the same instant', function () {
    $link = TeamInviteLink::factory()->create();
    $user = User::factory()->create();
    $linkId = $link->id;
    $userId = $user->id;

    $outcomes = Race::run(array_fill(0, 2, static fn (): string => resolve(\App\Actions\Teams\JoinTeamByLink::class)
        ->handle(TeamInviteLink::query()->findOrFail($linkId), User::query()->findOrFail($userId))->id));

    expect(array_column($outcomes, 'ok'))->each->toBeTrue()
        ->and($link->fresh()->uses_count)->toBe(1)
        ->and($link->team->members()->count())->toBe(1);
});
```

The protection proved: the link row is locked; membership and the count are read and written under it.

- [ ] **Step 2: Run them to see them fail** — Expected: FAIL (routes not defined).

- [ ] **Step 3: Implement**

`app/Actions/Teams/JoinTeamByLink.php`:

```php
<?php

namespace App\Actions\Teams;

use App\Enums\WorkspaceRole;
use App\Exceptions\InvitationUnavailable;
use App\Models\Team;
use App\Models\TeamInviteLink;
use App\Models\User;
use App\Support\Database\Transactions;
use Illuminate\Support\Facades\DB;

class JoinTeamByLink
{
    public function handle(TeamInviteLink $link, User $user): Team
    {
        return DB::transaction(function () use ($link, $user): Team {
            $locked = TeamInviteLink::query()->lockForUpdate()->find($link->id);

            if ($locked === null) {
                throw new InvitationUnavailable('The link no longer exists.');
            }

            $team = $locked->team;

            if ($team->hasMember($user)) {
                return $team;
            }

            if (! $locked->isUsable()) {
                throw new InvitationUnavailable('The link no longer works.');
            }

            $workspace = $team->workspace;

            if (! $user->belongsToWorkspace($workspace)) {
                $workspace->members()->attach($user, ['role' => WorkspaceRole::Member->value]);
            }

            $team->members()->attach($user, ['role' => $locked->team_role->value]);
            $locked->increment('uses_count');

            $user->forceFill(['current_workspace_id' => $workspace->id])->save();

            return $team;
        }, Transactions::Attempts);
    }
}
```

(Task 11 adds the call to `CloseOnboardingForJoiner` inside the transaction; it writes only the database, so the retry stays allowed.)

`InviteLinksController::show(Request $request, string $token, SignupGate $signupGate, SignInPolicy $signInPolicy): Response|RedirectResponse|SymfonyResponse` — built on `InvitationLinksController::show`:

```php
    public const string SessionKey = 'invite_link_token';

    public function show(Request $request, string $token, SignupGate $signupGate, SignInPolicy $signInPolicy): Response|RedirectResponse|SymfonyResponse
    {
        $link = TeamInviteLink::findByToken($token);

        if ($link === null) {
            return Inertia::render('invite-links/show', ['isInvalid' => true])->toResponse($request)->setStatusCode(404);
        }

        $user = $request->user();
        $team = $link->team;

        if ($user !== null && $team->hasMember($user)) {
            $request->session()->forget(self::SessionKey);

            return to_route('teams.show', [$team->workspace, $team]);
        }

        if ($user === null) {
            redirect()->setIntendedUrl($request->fullUrl());
        }

        $request->session()->put(self::SessionKey, $token);

        $canRegister = Features::enabled(Features::registration())
            && $signInPolicy->allowsLocalCredentials()
            && $signupGate->canShowRegistration(null, $link);

        return Inertia::render('invite-links/show', [
            'isInvalid' => false,
            'isUsable' => $link->isUsable(),
            'token' => $token,
            'teamName' => $team->name,
            'team' => ['name' => $team->name, 'initial' => mb_strtoupper(mb_substr(trim($team->name), 0, 1)), 'color' => TeamMark::colorFor($team)->value],
            'workspaceName' => $team->workspace->name,
            'inviter' => $link->createdBy === null ? null : ['name' => $link->createdBy->name, 'avatarUrl' => $link->createdBy->avatarUrl()],
            'teamRole' => $link->team_role->value,
            'membersCount' => $team->members()->count(),
            'members' => Alphabetical::sort($team->members()->orderBy('users.name')->orderBy('users.id')->limit(5)->get(), fn (User $member): string => $member->name)
                ->map(fn (User $member): array => ['name' => $member->name, 'avatarUrl' => $member->avatarUrl()])
                ->all(),
            'isLoggedIn' => $user !== null,
            'isVerified' => $user?->hasVerifiedEmail() ?? false,
            'canRegister' => $user === null && $canRegister,
            'ssoRequired' => $signInPolicy->ssoRequired(),
            'ssoProviders' => $user === null ? SsoProvider::options() : [],
        ]);
    }
```

`InviteLinkMembershipsController::store(Request $request, string $token, JoinTeamByLink $join): RedirectResponse`: `findByToken` → 404; `try { $team = $join->handle($link, $request->user()); } catch (InvitationUnavailable) { abort(410); }`; forget `SessionKey`; `to_route('teams.show', [$team->workspace, $team])`.

Routes:

```php
Route::get('invite/{token}', [InviteLinksController::class, 'show'])->middleware('throttle:30,1,inviteLinkPages')->name('inviteLinks.show');
Route::post('invite/{token}/membership', [InviteLinkMembershipsController::class, 'store'])->middleware(['auth', 'verified', 'throttle:10,1,inviteLinkJoins'])->name('inviteLinks.membership.store');
```

`SignupGate` (decision 4 A):

```php
    public function allows(string $email, ?WorkspaceInvitation $invitation = null, ?TeamInviteLink $link = null): bool
    {
        if ($this->isFirstUser()) {
            return true;
        }

        if ($this->isUsableInvitation($invitation) && $invitation->matchesEmail($email)) {
            return true;
        }

        $mode = SignupMode::fromConfig();

        if ($mode === SignupMode::Invite && $link?->isUsable() === true) {
            return true;
        }

        return match ($mode) {
            SignupMode::Open => true,
            SignupMode::Invite => false,
            SignupMode::Domain => $this->hasAllowedDomain($email),
        };
    }

    public function canShowRegistration(?WorkspaceInvitation $invitation = null, ?TeamInviteLink $link = null): bool
    {
        if ($this->isFirstUser()) {
            return true;
        }

        if ($this->isUsableInvitation($invitation)) {
            return true;
        }

        if ($link?->isUsable() === true) {
            return true;
        }

        return SignupMode::fromConfig() !== SignupMode::Invite;
    }
```

`CreateNewUser::create` passes `TeamInviteLink::findByToken(request()->session()->get(InviteLinksController::SessionKey))` to `register`, which passes it to `SignupGate::allows`. (`App\Actions` may not use `App\Http`: put the key in `App\Support\Invitations\InviteLinkSession::Key` and have the controller use that constant instead.) `ResolveSsoUser::handle` gains `?TeamInviteLink $link = null` and passes it to `allows`; `SsoCallbacksController` reads it from the session. `FortifyServiceProvider` register and login views pass the link to `canShowRegistration`.

`resources/js/pages/invite-links/show.tsx` (thin until Task 15):

```tsx
import { Head } from '@inertiajs/react';
import { useTrans } from '@/hooks/use-trans';
import AuthLayout from '@/layouts/skrum/auth-layout';

export default function ShowInviteLink() {
    const { t } = useTrans();

    return (
        <AuthLayout variant="centered" title={t('Invitation')} literalTitle>
            <Head title={t('Invitation')} />
        </AuthLayout>
    );
}
```

- [ ] **Step 4: Run on PostgreSQL and SQLite; the races on the four engines** — `tests/Feature/Invitations tests/Feature/Auth`; `bin/test-db <engine> --concurrency -- tests/Concurrency/TeamInviteLinkTest.php`. Expected: PASS (`SignupGateTest`, `SsoLoginTest`, `ResolveSsoUserTest` unchanged).
- [ ] **Step 5: Commit** — `feat(invitations): join a team by its link; a link opens registration in invite mode` (trailer).

### Task 11: Who gets an onboarding; registration with "Team name"; `dashboard`

**Files:**
- Create: `app/Actions/Onboarding/StartOnboarding.php`, `app/Actions/Onboarding/CloseOnboardingForJoiner.php`, `tests/Feature/Onboarding/OnboardingStartTest.php`
- Modify: `app/Actions/Fortify/CreateNewUser.php`, `app/Http/Controllers/CurrentWorkspaceController.php`, `app/Actions/Workspaces/AcceptWorkspaceInvitation.php`, `app/Actions/Teams/JoinTeamByLink.php`, `app/Providers/FortifyServiceProvider.php` (register view prop `asksTeamName`), `tests/Feature/DashboardTest.php`, `tests/Feature/Workspaces/WorkspacesTest.php`, `tests/Feature/Workspaces/WorkspaceMembersTest.php` (expected redirect only)

**Interfaces:**
- Produces: `StartOnboarding::handle(User $user, ?string $teamName = null): Onboarding` (idempotent: `createOrFirst` on `user_id`); `CloseOnboardingForJoiner::handle(User): void`; register page prop `asksTeamName: bool`; route `onboarding.show` (Task 12 — this task registers the route with a thin controller method so the redirects can be asserted: `OnboardingsController@show` and `resources/js/pages/onboarding/show.tsx`, thin).

- [ ] **Step 1: Write the failing tests**

```php
<?php

use App\Enums\OnboardingStep;
use App\Models\Onboarding;
use App\Models\Team;
use App\Models\TeamInviteLink;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(fn () => config(['skrum.signup_mode' => 'open']));

it('starts an onboarding holding the team name at registration, and creates nothing else', function () {
    User::factory()->create();

    $this->post(route('register.store'), [
        'name' => 'Sofia Laurent',
        'team_name' => '  Atlas ',
        'email' => 'sofia@example.com',
        'password' => 'a-long-enough-password-42',
        'password_confirmation' => 'a-long-enough-password-42',
    ])->assertRedirect();

    $user = User::query()->where('email', 'sofia@example.com')->sole();

    expect($user->onboarding->step)->toBe(OnboardingStep::Workspace)
        ->and($user->onboarding->team_name)->toBe('Atlas')
        ->and(Workspace::query()->count())->toBe(0);
});

it('asks for a team name only when the registration will start an onboarding', function () {
    $this->get(route('register'))->assertInertia(fn (Assert $page) => $page->where('asksTeamName', true));

    $link = TeamInviteLink::factory()->withToken('join-token-0123456789abcdefghijklmnopqrst')->create();
    $this->get(route('inviteLinks.show', 'join-token-0123456789abcdefghijklmnopqrst'));

    $this->get(route('register'))->assertInertia(fn (Assert $page) => $page->where('asksTeamName', false));
});

it('starts no onboarding for an account created through a link', function () {
    User::factory()->create();
    TeamInviteLink::factory()->withToken('join-token-0123456789abcdefghijklmnopqrst')->create();
    $this->get(route('inviteLinks.show', 'join-token-0123456789abcdefghijklmnopqrst'));

    $this->post(route('register.store'), [
        'name' => 'Nadia', 'email' => 'nadia@example.com',
        'password' => 'a-long-enough-password-42', 'password_confirmation' => 'a-long-enough-password-42',
    ]);

    expect(User::query()->where('email', 'nadia@example.com')->sole()->onboarding)->toBeNull();
});

it('sends a verified user without a workspace to the onboarding instead of the create page', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->get(route('dashboard'))->assertRedirect(route('onboarding.show'));

    expect($user->fresh()->onboarding->step)->toBe(OnboardingStep::Workspace);
});

it('never sends an existing member of a workspace to the onboarding', function () {
    $team = Team::factory()->create();
    $member = teamMember($team);

    $this->actingAs($member)->get(route('dashboard'))->assertRedirect(route('teams.show', [$team->workspace, $team]));

    expect($member->fresh()->onboarding)->toBeNull();
});

it('resumes an onboarding that is not completed', function () {
    $onboarding = Onboarding::factory()->atStep(OnboardingStep::Invite)->create();
    Workspace::factory()->withMember($onboarding->user)->create();

    $this->actingAs($onboarding->user)->get(route('dashboard'))->assertRedirect(route('onboarding.show'));
});

it('sends a user who opened a link before registering back to the link', function () {
    TeamInviteLink::factory()->withToken('join-token-0123456789abcdefghijklmnopqrst')->create();

    $this->actingAs(User::factory()->create())
        ->withSession(['invite_link_token' => 'join-token-0123456789abcdefghijklmnopqrst'])
        ->get(route('dashboard'))
        ->assertRedirect(route('inviteLinks.show', 'join-token-0123456789abcdefghijklmnopqrst'));
});

it('closes an onboarding without a workspace when its user joins by an invitation or a link', function (string $how) {
    $onboarding = Onboarding::factory()->create();
    $user = $onboarding->user;
    $team = Team::factory()->create();

    if ($how === 'invitation') {
        WorkspaceInvitation::factory()->forTeam($team)->withToken('t')->create(['email' => $user->email]);
        $this->actingAs($user)->post(route('invitations.acceptance.store', 't'));
    }

    if ($how === 'link') {
        TeamInviteLink::factory()->for($team)->withToken('join-token-0123456789abcdefghijklmnopqrst')->create();
        $this->actingAs($user)->post(route('inviteLinks.membership.store', 'join-token-0123456789abcdefghijklmnopqrst'));
    }

    expect($onboarding->fresh()->isCompleted())->toBeTrue();
})->with(['invitation', 'link']);

it('follows a link visitor through registration and verification back to the link', function () {
    User::factory()->create();
    TeamInviteLink::factory()->withToken('join-token-0123456789abcdefghijklmnopqrst')->create();
    $this->get(route('inviteLinks.show', 'join-token-0123456789abcdefghijklmnopqrst'));

    $this->post(route('register.store'), [
        'name' => 'Nadia', 'email' => 'nadia@example.com',
        'password' => 'a-long-enough-password-42', 'password_confirmation' => 'a-long-enough-password-42',
    ])->assertRedirect(route('inviteLinks.show', 'join-token-0123456789abcdefghijklmnopqrst'));
});
```

The last case depends on Fortify honouring the intended URL after registration (spec §17 item 2). If it redirects to `/dashboard` instead, the test is changed to follow the chain `dashboard → verification.notice`, then, once verified, `dashboard → inviteLinks.show` (the session rule above), and the report says which path holds.

Existing tests whose expected redirect changes from `workspaces.create` to `onboarding.show`: `DashboardTest::test_…` (line 28), `WorkspacesTest` "sends users without a workspace to the create page" (renamed "…to the onboarding"), `WorkspaceMembersTest` line 145. No other change to them.

- [ ] **Step 2: Run them to see them fail** — Expected: FAIL.

- [ ] **Step 3: Implement**

```php
<?php

namespace App\Actions\Onboarding;

use App\Enums\OnboardingStep;
use App\Models\Onboarding;
use App\Models\User;

class StartOnboarding
{
    public function handle(User $user, ?string $teamName = null): Onboarding
    {
        $teamName = trim((string) $teamName);

        return Onboarding::query()->createOrFirst(
            ['user_id' => $user->id],
            ['step' => OnboardingStep::Workspace, 'team_name' => $teamName === '' ? null : $teamName],
        );
    }
}
```

```php
<?php

namespace App\Actions\Onboarding;

use App\Models\User;

class CloseOnboardingForJoiner
{
    /** A person who joins a team before naming a workspace came to join, not to found one. */
    public function handle(User $user): void
    {
        $user->onboarding()
            ->whereNull('completed_at')
            ->whereNull('workspace_id')
            ->first()
            ?->update(['completed_at' => now()]);
    }
}
```

Called inside the transactions of `AcceptWorkspaceInvitation` (after the attach) and `JoinTeamByLink` (after the attach). `Onboarding::query()->createOrFirst` uses a nested transaction when called inside one: allowed (rule 6, "a statement that may fail inside a transaction runs in its own nested transaction").

`CreateNewUser::create`: validation adds `'team_name' => ['nullable', 'string', 'max:100']`; `register()` gains `?TeamInviteLink $link` and, after the user is created and no invitation was accepted, `if ($link?->isUsable() !== true) { resolve(StartOnboarding::class)->handle($user, $input['team_name'] ?? null); }`. `createForInvitation` starts none.

`CurrentWorkspaceController::show`:

```php
    public function show(Request $request, StartOnboarding $startOnboarding): RedirectResponse
    {
        $user = $request->user();
        $linkToken = $request->session()->get(InviteLinkSession::Key);

        if (TeamInviteLink::findByToken($linkToken)?->isUsable() === true) {
            return to_route('inviteLinks.show', $linkToken);
        }

        if ($user->onboarding !== null && ! $user->onboarding->isCompleted()) {
            return to_route('onboarding.show');
        }

        $workspace = $user->workspaces()->whereKey($user->current_workspace_id)->first()
            ?? $user->workspaces()->orderBy('name')->orderBy('workspaces.id')->first();

        if ($workspace === null) {
            $startOnboarding->handle($user);

            return to_route('onboarding.show');
        }

        // … unchanged: remembered team, else first team, else the workspace page.
    }
```

A user whose onboarding was completed and who later leaves every workspace: `onboarding` exists and is completed, and `workspace === null` → `createOrFirst` returns the completed row → redirect to `onboarding.show`, which sends a completed row to `dashboard`: a loop. Prevent it: when the completed row exists and the user has no workspace, reopen it (`step` = `workspace`, `workspace_id` and `team_id` null, `completed_at` null). Add the test "reopens a completed onboarding for a user who left every workspace".

`FortifyServiceProvider` register view: `'asksTeamName' => ($invitation?->isPending() !== true) && ($link?->isUsable() !== true)`.

Thin `OnboardingsController::show` (Task 12 completes it): renders `onboarding/show` for an uncompleted row, else redirects to `dashboard`. Thin page `resources/js/pages/onboarding/show.tsx` in the shape of Task 10's.

Route: inside `['auth', 'verified']`: `Route::get('onboarding', [OnboardingsController::class, 'show'])->name('onboarding.show');`.

- [ ] **Step 4: Run on PostgreSQL and SQLite** — `tests/Feature/Onboarding tests/Feature/Auth tests/Feature/DashboardTest.php tests/Feature/Workspaces`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(onboarding): registration asks for a team name and starts the onboarding; dashboard resumes it` (trailer; the body lists the three tests whose redirect changed).

### Task 12: The four steps

**Files:**
- Create: `app/Actions/Onboarding/PresentOnboarding.php`, `app/Http/Requests/Onboarding/OnboardingWorkspaceRequest.php`, `OnboardingTeamRequest.php`, `app/Http/Controllers/OnboardingWorkspacesController.php`, `OnboardingTeamsController.php`, `OnboardingInvitationsController.php`, `OnboardingStepsController.php`, `OnboardingCompletionsController.php`, `tests/Feature/Onboarding/OnboardingStepsTest.php`, `tests/Concurrency/OnboardingStepTest.php`
- Modify: `app/Http/Controllers/OnboardingsController.php`, `routes/web.php`

**Interfaces:**
- Consumes: Tasks 4, 6 (`SendTeamInvitations`, `TeamInvitationRequest` rules), 9 (`IssueTeamInviteLink`), 11.
- Produces: page props of `onboarding/show`:

```ts
type OnboardingProps = {
    step: 'workspace' | 'team' | 'invite' | 'ritual';
    workspace: { name: string; locale: string } | null;
    team: { id: string; name: string; color: ColumnColor; description: string | null } | null;
    teamName: string | null;          // from registration, until the team exists
    defaultColor: ColumnColor;        // derived from the user id
    locales: { value: string; label: string }[];
    userLocale: string;
    inviteRoles: string[];
    invitedCount: number;             // pending invitations of the team
    inviteLinkUrl: string | null;     // usable link of the team, on step invite
    inviteLinkExpiresInDays: number;
    inviteLinkMaxUses: number;
    membersCount: number;
};
```

and the routes `onboarding.workspace.update`, `onboarding.team.update`, `onboarding.invitations.store`, `onboarding.step.update`, `onboarding.completion.store`.

- [ ] **Step 1: Write the failing tests**

```php
<?php

use App\Enums\ColumnColor;
use App\Enums\OnboardingStep;
use App\Enums\TeamRole;
use App\Enums\WorkspaceRole;
use App\Models\Onboarding;
use App\Models\Workspace;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;

it('creates the workspace at step one, then renames it after Back', function () {
    $onboarding = Onboarding::factory()->create();
    $user = $onboarding->user;

    $this->actingAs($user)->put(route('onboarding.workspace.update'), ['name' => 'Nordlys', 'locale' => 'fr'])->assertRedirect(route('onboarding.show'));
    $workspace = Workspace::query()->sole();

    expect($user->roleIn($workspace))->toBe(WorkspaceRole::Owner)
        ->and($workspace->locale)->toBe('fr')
        ->and($onboarding->fresh()->step)->toBe(OnboardingStep::Team);

    $this->actingAs($user)->put(route('onboarding.step.update'), ['step' => 'workspace'])->assertRedirect();
    $this->actingAs($user)->put(route('onboarding.workspace.update'), ['name' => 'Nordlys SA', 'locale' => 'en']);

    expect(Workspace::query()->sole()->name)->toBe('Nordlys SA');
});

it('creates the team at step two with its colour, the user its owner, prefilled from registration', function () {
    $onboarding = Onboarding::factory()->create(['team_name' => 'Atlas']);
    $this->actingAs($onboarding->user)->put(route('onboarding.workspace.update'), ['name' => 'Nordlys', 'locale' => 'en']);

    $this->actingAs($onboarding->user)
        ->get(route('onboarding.show'))
        ->assertInertia(fn (Assert $page) => $page->component('onboarding/show')->where('step', 'team')->where('teamName', 'Atlas'));

    $this->actingAs($onboarding->user)->put(route('onboarding.team.update'), ['name' => 'Atlas', 'color' => 'lagoon'])->assertRedirect();
    $team = $onboarding->fresh()->team;

    expect($team->color)->toBe(ColumnColor::Lagoon)
        ->and($team->workspace_id)->toBe($onboarding->fresh()->workspace_id)
        ->and($team->members()->whereKey($onboarding->user_id)->first()?->pivot->role)->toBe(TeamRole::Owner->value)
        ->and($onboarding->fresh()->step)->toBe(OnboardingStep::Invite);

    $this->actingAs($onboarding->user)->put(route('onboarding.step.update'), ['step' => 'workspace']);
    $this->actingAs($onboarding->user)->put(route('onboarding.workspace.update'), ['name' => 'Nordlys', 'locale' => 'en']);
    $this->actingAs($onboarding->user)->put(route('onboarding.team.update'), ['name' => 'Atlas 2', 'color' => 'moss']);

    expect($team->workspace->teams()->count())->toBe(1)
        ->and($team->fresh()->name)->toBe('Atlas 2');
});

it('refuses the team step before the workspace exists', function () {
    $onboarding = Onboarding::factory()->create();

    $this->actingAs($onboarding->user)->put(route('onboarding.team.update'), ['name' => 'Atlas'])->assertSessionHasErrors('name');
});

it('sends the invitations of step three, or skips them', function () {
    Notification::fake();
    $onboarding = onboardingAtInvite();

    $this->actingAs($onboarding->user)
        ->post(route('onboarding.invitations.store'), ['emails' => ['camille@example.com', 'theo@example.com'], 'role' => 'member'])
        ->assertRedirect(route('onboarding.show'));

    expect($onboarding->fresh()->team->invitations()->count())->toBe(2)
        ->and($onboarding->fresh()->step)->toBe(OnboardingStep::Ritual);

    $other = onboardingAtInvite();
    $this->actingAs($other->user)->put(route('onboarding.step.update'), ['step' => 'ritual'])->assertRedirect();
    expect($other->fresh()->step)->toBe(OnboardingStep::Ritual);
});

it('refuses a move the stepper does not offer', function (OnboardingStep $from, string $to) {
    $onboarding = Onboarding::factory()->atStep($from)->create();

    $this->actingAs($onboarding->user)->put(route('onboarding.step.update'), ['step' => $to])->assertSessionHasErrors('step');
})->with([
    [OnboardingStep::Workspace, 'ritual'],
    [OnboardingStep::Team, 'invite'],
    [OnboardingStep::Ritual, 'workspace'],
]);

it('completes at step four and opens the new session dialog on the chosen type', function (?string $ritual, string $query) {
    $onboarding = onboardingAtInvite();
    $onboarding->update(['step' => OnboardingStep::Ritual]);
    $team = $onboarding->team;

    $this->actingAs($onboarding->user)
        ->post(route('onboarding.completion.store'), array_filter(['ritual' => $ritual]))
        ->assertRedirect(route('teams.show', [$team->workspace, $team]).$query);

    expect($onboarding->fresh()->isCompleted())->toBeTrue();
    $this->actingAs($onboarding->user)->get(route('onboarding.show'))->assertRedirect(route('dashboard'));
})->with([
    ['retro', '?new=retro'],
    ['icebreaker', '?new=icebreaker'],
    [null, ''],
]);

it('lets nobody else touch the onboarding of a user', function () {
    $onboarding = onboardingAtInvite();
    $stranger = Onboarding::factory()->create()->user;

    $this->actingAs($stranger)->put(route('onboarding.team.update'), ['name' => 'Hijack'])->assertSessionHasErrors('name');
    expect($onboarding->fresh()->team->name)->not->toBe('Hijack');
});
```

with a helper in `tests/Pest.php` (added in this task, in one block):

```php
function onboardingAtInvite(): Onboarding
{
    $user = User::factory()->create();
    $workspace = Workspace::factory()->withMember($user, WorkspaceRole::Owner)->create();
    $team = Team::factory()->for($workspace)->create();
    $team->members()->attach($user, ['role' => TeamRole::Owner->value]);

    return Onboarding::factory()->for($user)->atStep(OnboardingStep::Invite)->create([
        'workspace_id' => $workspace->id,
        'team_id' => $team->id,
    ]);
}
```

`tests/Concurrency/OnboardingStepTest.php`:

```php
<?php

use App\Models\Onboarding;
use App\Models\Workspace;
use Tests\Concurrency\Support\Race;

it('creates one workspace when step one is sent twice at the same instant', function () {
    $onboarding = Onboarding::factory()->create();
    $userId = $onboarding->user_id;

    $outcomes = Race::run(array_fill(0, 2, static fn (): int => Race::request($userId, 'PUT', '/onboarding/workspace', ['name' => 'Nordlys', 'locale' => 'en'])));

    expect(array_column($outcomes, 'ok'))->each->toBeTrue()
        ->and(Workspace::query()->count())->toBe(1)
        ->and($onboarding->fresh()->workspace_id)->toBe(Workspace::query()->sole()->id);
});

it('creates one team when step two is sent twice at the same instant', function () {
    $onboarding = Onboarding::factory()->create();
    $this->actingAs($onboarding->user)->put(route('onboarding.workspace.update'), ['name' => 'Nordlys', 'locale' => 'en']);
    $userId = $onboarding->user_id;

    Race::run(array_fill(0, 2, static fn (): int => Race::request($userId, 'PUT', '/onboarding/team', ['name' => 'Atlas', 'color' => 'lagoon'])));

    expect($onboarding->fresh()->workspace->teams()->count())->toBe(1);
});
```

The protection proved: each step locks the onboarding row first and reads `workspace_id`/`team_id` under the lock.

- [ ] **Step 2: Run them to see them fail** — Expected: FAIL.

- [ ] **Step 3: Implement**

`OnboardingWorkspaceRequest`: `name` `['required', 'string', 'max:100']`, `locale` `['required', Rule::in(config('skrum.locales'))]`. `OnboardingTeamRequest`: `name` `['required', 'string', 'max:100']`, `color` `['nullable', Rule::enum(ColumnColor::class)]`, `description` `['nullable', 'string', 'max:<WS-1's length>']` (omit when WS-1 is absent).

`OnboardingWorkspacesController::update`:

```php
    public function update(OnboardingWorkspaceRequest $request, CreateWorkspace $createWorkspace): RedirectResponse
    {
        $user = $request->user();

        DB::transaction(function () use ($request, $user, $createWorkspace): void {
            $onboarding = $this->lockedOnboarding($user);
            $existing = $onboarding->workspace;

            if ($existing === null) {
                $workspace = $createWorkspace->handle($user, $request->validated('name'));
                $workspace->update(['locale' => $request->validated('locale')]);
                $onboarding->workspace_id = $workspace->id;
            }

            if ($existing !== null) {
                abort_unless($user->roleIn($existing) === WorkspaceRole::Owner, 403);
                $existing->update($request->safe()->only(['name', 'locale']));
            }

            $onboarding->step = OnboardingStep::Team;
            $onboarding->save();
        });

        return to_route('onboarding.show');
    }
```

The shared `lockedOnboarding(User): Onboarding` lives in a trait `app/Http/Controllers/Concerns/LocksOnboarding.php`:

```php
    private function lockedOnboarding(User $user): Onboarding
    {
        $onboarding = Onboarding::query()->where('user_id', $user->id)->lockForUpdate()->first();

        if ($onboarding === null || $onboarding->isCompleted()) {
            abort(404);
        }

        return $onboarding;
    }
```

(`CreateWorkspace` opens its own transaction: nested, allowed. No `Transactions::Attempts` on these callbacks: they are cheap and the user retries by clicking again; keep them single-attempt so that an `abort()` is not retried.)

`OnboardingTeamsController::update`: lock; when `workspace === null` → `throw ValidationException::withMessages(['name' => __('Name your workspace first.')])`; when `team === null` → `$team = $onboarding->workspace->teams()->create($request->safe()->only(['name', 'color', 'description']))`, `$team->members()->attach($user, ['role' => TeamRole::Owner->value])`, `team_id` set; else `abort_unless($user->can('update', $onboarding->team), 403)` and update; `step` = `Invite`.

`OnboardingInvitationsController::store(TeamInvitationRequest $request, SendTeamInvitations $send)`: `TeamInvitationRequest::authorize()` reads `route('team')`, which is absent here: it returns true when the route has no team (`$team = $this->route('team'); return $team === null || $this->user()->can('invite', $team);`), and this controller authorises itself — `abort_unless($request->user()->can('invite', $onboarding->team), 403)`. Lock the onboarding, require `step === Invite` and a team (else 409 → `back()->withErrors(['emails' => …])`), `$send->handle(...)` **after** the transaction commits (it mails), then set `step` = `Ritual` in a second short transaction.

`OnboardingStepsController::update`: body `step` in `['workspace', 'ritual']`; allowed moves `Team → Workspace` and `Invite → Ritual`; any other → `ValidationException` on `step`.

`OnboardingCompletionsController::store`: body `ritual` nullable in `['retro', 'poker', 'whiteboard', 'icebreaker']`; requires `step === Ritual` and a team (else the same validation error); sets `completed_at`; redirects to `route('teams.show', [$workspace, $team]).($ritual === null ? '' : "?new={$ritual}")`.

`PresentOnboarding::handle(Onboarding, User): array` builds the props above (`defaultColor` = `TeamMark::derived($user->id)->value`; `inviteLinkUrl` = `$team?->usableInviteLink()?->url()`; `locales` from `config('skrum.locales')` with their own names — reuse what `LocalesController` sends if it has a label list; `invitedCount` = pending invitations of the team). `OnboardingsController::show` renders it.

Routes, in the `['auth', 'verified']` group:

```php
    Route::put('onboarding/workspace', [OnboardingWorkspacesController::class, 'update'])->name('onboarding.workspace.update');
    Route::put('onboarding/team', [OnboardingTeamsController::class, 'update'])->name('onboarding.team.update');
    Route::post('onboarding/invitations', [OnboardingInvitationsController::class, 'store'])->middleware('throttle:10,1,teamInvitations')->name('onboarding.invitations.store');
    Route::put('onboarding/step', [OnboardingStepsController::class, 'update'])->name('onboarding.step.update');
    Route::post('onboarding/completion', [OnboardingCompletionsController::class, 'store'])->name('onboarding.completion.store');
```

- [ ] **Step 4: Run on PostgreSQL and SQLite; the races on the four engines** — `tests/Feature/Onboarding`; `bin/test-db <engine> --concurrency -- tests/Concurrency/OnboardingStepTest.php`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(onboarding): the four steps — workspace, team, invitations, first ritual` (trailer).

### Task 13: The workspace members page and the workspace invite dialog's data

**Files:**
- Modify: `app/Http/Controllers/WorkspaceMembersController.php`
- Test: `tests/Feature/Invitations/InvitationListsTest.php`

**Interfaces:**
- Produces: `workspaces/members` props: `invitations[]` gains `team` (`array{id: string, name: string}|null`), `teamRole` (`?string`), `status` (`'pending'|'expired'|'declined'`), keeps `isExpired`; new `teams` (`array<int, array{id: string, name: string}>`, `Alphabetical::sort`) and `teamRoles` (`TeamRole::invitable()` values).

- [ ] **Step 1: Write the failing test**

```php
<?php

use App\Enums\TeamRole;
use App\Models\Team;
use App\Models\WorkspaceInvitation;
use Inertia\Testing\AssertableInertia as Assert;

it('lists each invitation with its team and status, and offers the teams to invite to', function () {
    $team = Team::factory()->create(['name' => 'Atlas']);
    $manager = workspaceManager($team->workspace);
    WorkspaceInvitation::factory()->forTeam($team, TeamRole::Observer)->declined()->create(['email' => 'a@example.com']);
    WorkspaceInvitation::factory()->for($team->workspace)->expired()->create(['email' => 'b@example.com']);

    $this->actingAs($manager)
        ->get(route('workspaces.members.index', $team->workspace))
        ->assertInertia(fn (Assert $page) => $page
            ->where('teams', [['id' => $team->id, 'name' => 'Atlas']])
            ->where('teamRoles', ['facilitator', 'member', 'observer'])
            ->where('invitations', fn ($invitations) => collect($invitations)->keyBy('email')->map(fn ($row) => [$row['status'], $row['team']['name'] ?? null, $row['teamRole']])->all() === [
                'a@example.com' => ['declined', 'Atlas', 'observer'],
                'b@example.com' => ['expired', null, null],
            ]));
});
```

- [ ] **Step 2: Run it to see it fail.**
- [ ] **Step 3: Implement** — eager-load `team`; map as above; `status` computed as in `PresentTeamInvitations` (extract the status rule to `WorkspaceInvitation::status(): string` and use it in both).
- [ ] **Step 4: Run on PostgreSQL and SQLite** — `tests/Feature/Invitations/InvitationListsTest.php tests/Feature/Workspaces/WorkspaceMembersTest.php`. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(invitations): the members page shows each invitation's team and status` (trailer).

## Step B — the screens

Each screen task: read the mockup's `README.md` and `preview.html` first; compose from the components named; write Vitest for the behaviours listed (the states of the spec §10 the task owns); keep every existing test of the component green (a changed expectation is listed in the commit message); add the translation keys in the four languages; no capture (Task 22).

### Task 14: Front foundation — types, the address chips, the team mark, the shared invite form

**Files:**
- Create: `resources/js/lib/invitations/types.ts`, `resources/js/lib/invitations/email-chips.ts` (+ `.test.ts`), `resources/js/components/skrum/team-mark.tsx` (+ test), `resources/js/components/skrum/email-chips-field.tsx` (+ test), `resources/js/components/invitations/team-invite-form.tsx` (+ test), `resources/js/components/invitations/invite-link-block.tsx` (+ test)
- Modify: `resources/js/components/teams/session-create/use-new-session-intent.ts` (`icebreaker` in `IntentTypes`; its test gains the case), `resources/js/types/index.d.ts` or the file that declares `TeamSummary` (`color`)

**Interfaces:**
- Produces:

```ts
// lib/invitations/types.ts
export type TeamRoleValue = 'owner' | 'facilitator' | 'member' | 'observer';
export type InviteLink = { url: string; expiresAt: string; maxUses: number; usesCount: number };
export type PendingInvitation = {
    id: string; email: string; teamRole: TeamRoleValue | null;
    status: 'pending' | 'expired' | 'declined'; invitedAt: string;
    team?: { id: string; name: string } | null;
};
export type TeamMarkData = { name: string; initial: string; color: ColumnColor };

// lib/invitations/email-chips.ts
export type EmailChip = { value: string; isValid: boolean };
export const MaxInvitationAddresses = 20;
export function splitAddresses(text: string): string[];            // on comma, semicolon, space, newline
export function normaliseAddress(address: string): string;         // trim + lower case, as LoginAddress
export function isPlausibleAddress(address: string): boolean;      // local@domain.tld, one @, a dot after it
export function addChips(chips: EmailChip[], text: string): EmailChip[]; // dedupe on normalised value, cap at 20
export function removeChip(chips: EmailChip[], value: string): EmailChip[];
```

`TeamMark({ team, size }: { team: TeamMarkData; size?: 'sm' | 'md' })` (presentational: the initial on `col-<color>`, `.ob-mark` of the mockup); `EmailChipsField({ id, label, chips, onChange, errors })` (presentational: chips with remove buttons, an input that turns typed text into chips on Enter, comma, space, paste or blur; an invalid chip carries `aria-invalid` and the message "“:address” looks incomplete." under the field; a server error on `emails.<i>` shows under the field naming the address); `TeamInviteForm({ team, roles, defaultRole, inviteLink, onSubmit, onSkip?, submitLabelCount })` — the content of onboarding step 3 and of the team dialog: `EmailChipsField`, role `Select` (labels "Facilitator", "Member", "Observer"), "Message · optional" (`Textarea`, 500, counter), `InviteLinkBlock`, actions; `InviteLinkBlock({ link, canManage, onCreate, onReplace, onTurnOff })` — "Or share this link", the URL in `font-mono`, "Copy" (clipboard, "Copied" for 2 s, `aria-live`), "Expires in :days days · up to :count people" (days from `expiresAt`, `Math.ceil`), "Create a new link" (`ConfirmDialog`: "The current link stops working."), "Turn off the link", and "Create a link" when `link` is null.

- [ ] **Step 1: Write the Vitest for the pure logic**

```ts
import { describe, expect, it } from 'vitest';
import { addChips, isPlausibleAddress, MaxInvitationAddresses, removeChip, splitAddresses } from '@/lib/invitations/email-chips';

describe('email chips', () => {
    it('splits a pasted list on commas, semicolons, spaces and lines', () => {
        expect(splitAddresses('a@x.io, b@x.io;c@x.io\nd@x.io  e@x.io')).toEqual(['a@x.io', 'b@x.io', 'c@x.io', 'd@x.io', 'e@x.io']);
    });

    it('marks an address without a dot after the at sign as incomplete', () => {
        expect(isPlausibleAddress('malik@nordlys')).toBe(false);
        expect(isPlausibleAddress('malik@nordlys.io')).toBe(true);
        expect(isPlausibleAddress('a@@b.io')).toBe(false);
    });

    it('keeps one chip per address, case and spaces ignored', () => {
        const chips = addChips([], 'Camille@Nordlys.io camille@nordlys.io ');

        expect(chips).toEqual([{ value: 'camille@nordlys.io', isValid: true }]);
    });

    it('stops at twenty addresses', () => {
        const many = Array.from({ length: 25 }, (_, i) => `p${i}@x.io`).join(' ');

        expect(addChips([], many)).toHaveLength(MaxInvitationAddresses);
    });

    it('removes a chip by its address', () => {
        expect(removeChip(addChips([], 'a@x.io b@x.io'), 'a@x.io').map((chip) => chip.value)).toEqual(['b@x.io']);
    });
});
```

- [ ] **Step 2: Run it to see it fail** — `npm run test -- email-chips` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement `email-chips.ts`**

```ts
export type EmailChip = { value: string; isValid: boolean };

export const MaxInvitationAddresses = 20;

export function splitAddresses(text: string): string[] {
    return text.split(/[\s,;]+/).filter((part) => part !== '');
}

export function normaliseAddress(address: string): string {
    return address.trim().toLowerCase();
}

export function isPlausibleAddress(address: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address);
}

export function addChips(chips: EmailChip[], text: string): EmailChip[] {
    const next = [...chips];

    for (const part of splitAddresses(text)) {
        const value = normaliseAddress(part);

        if (next.length >= MaxInvitationAddresses) {
            break;
        }

        if (next.some((chip) => chip.value === value)) {
            continue;
        }

        next.push({ value, isValid: isPlausibleAddress(value) });
    }

    return next;
}

export function removeChip(chips: EmailChip[], value: string): EmailChip[] {
    return chips.filter((chip) => chip.value !== value);
}
```

- [ ] **Step 4: The components and their Vitest** — behaviours to test: `TeamMark` renders the initial with `col-<color>` and is `aria-hidden` (the name is said next to it); `EmailChipsField` turns typed text into chips on Enter and on paste, removes a chip with its button and with Backspace in an empty input, announces an invalid chip and shows the server error of `emails.1` under the field naming the second address; `TeamInviteForm` disables submit with no valid chip or any invalid chip, labels it "Send :count invitations" (`trans_choice`-style keys "Send one invitation" / "Send :count invitations"), sends `{ emails, role, message }`, shows the sentence of P25-07 for the selected role; `InviteLinkBlock` copies the URL (mock `navigator.clipboard`), computes "Expires in 7 days · up to 20 people" from props, asks confirmation before "Create a new link". `use-new-session-intent.test.ts`: `?new=icebreaker` is read.
- [ ] **Step 5: Front gates and commit** — `npm run test -- invitations team-mark email-chips use-new-session-intent`, `npm run types:check`, `npm run check`, `npm run build:front`; commit `feat(invitations): front foundation — chips, team mark, the shared invite form` (trailer).

### Task 15 (lane Access): The invitation card — team, message, decline, declined

**Files:** Modify `resources/js/components/auth/invitation-card.tsx` (+ test), `resources/js/pages/invitations/show.tsx`.

Mockup: ScreenOnboarding b and d. Composition: fill the three places the card already has — `team` → `TeamMark` over the inviter avatar's corner; `message` → a quoted paragraph (`whitespace-pre-line`, `wrap-anywhere`, muted) under the members line; `decline` → a ghost button with `UserX` icon and destructive text "Decline invitation", the consequence line ":name will be notified. The link stops working." (":inviter" fallback "The link stops working." when the inviter is gone) under the main action, posting `invitations.decline.store` with `router.post` (busy state; a 410 reloads the page). Signed-in matching variant: title "Join :team as :name?", the address line, "Join :team" and "Decline" side by side, "Not you? Switch account" (logs out to the login page, as the wrong-account state does). The sentence becomes ":inviter invited you to join the :team team in the :workspace workspace" with the names bold (`Rich` markers as the card does with `{{inviter}}`); the members line names the team role ("you join as :role"). New state `declined`: `AccessNotice` with `CircleCheck`, "Invitation declined", ":name has been notified. You can close this page.".

Behaviours to test: each new prop renders in its place and nothing renders when it is absent (a workspace invitation looks as today — the existing tests stay green); decline posts once and shows busy; the declined state; the message is text (a `<b>` in it is shown literally); the team role label per value; the main button names the team when there is one.

Commit: `feat(invitations): the invitation card shows the team, the message and Decline` (trailer).

### Task 16 (lane Access): The invite link page and the bell

**Files:** Create `resources/js/components/auth/invite-link-card.tsx` (+ test); modify `resources/js/pages/invite-links/show.tsx`, `resources/js/components/skrum/notifications-panel.tsx` (+ test), and the bell container that maps the server's items (find it from `NotificationsPanel`'s importers).

Link card (P25-11): the invitation card's frame (`Card` `w-120`-equivalent rem width, `p-8`, raised shadow), inviter avatar + `TeamMark`, the sentence, the members `AvatarStack` with "n members · you join as Member"; signed out: `SsoButtons`, "Sign in" (link to `login`), "Create an account" (link to `register`) when `canRegister`, the SSO-required variant without the two; signed in, verified: "Join :team as :name?", "Join :team" (posts `inviteLinks.membership.store`), "Not you? Switch account"; signed in, unverified: `AccessNotice` "Verify your address to join :team" with the resend button of the verify page (`verification.send`); not usable: `AccessNotice` "This link no longer works." + "Ask :name for a new one." (or "Ask a team owner for a new one."); invalid: today's invalid card.

Bell (P25-12): `NotificationKind` gains `'invitation_declined'`; the item reads ":email declined your invitation to join :team" with an initial avatar of the address, links to `href` ("View the team"), no buttons. Behaviours to test: the five link states; the bell item text and link; an unknown kind is still ignored.

Commit: `feat(invitations): the invite link page; the declined invitation in the bell` (trailer).

### Task 17 (lane Access): Register — "Create your workspace"

**Files:** Modify `resources/js/components/auth/register-form.tsx` (+ test), `resources/js/pages/auth/register.tsx`.

Mockup: ScreenAuth "Inscription". When `asksTeamName`: title "Create your workspace", description "Your team gets a space for its retros, poker and icebreakers." (P25-13 drops the plan and terms lines), fields in the mockup's order — "First and last name" and "Team name" side by side from `sm` (one column on a phone), "Work email", password, confirmation (P25-14) — and "Create my account"; otherwise today's page. "Team name" is optional, `maxLength` 100, `autoComplete="organization"`. Behaviours to test: the two titles; the field present or not; the field posts as `team_name`; the existing register tests stay green.

Commit: `feat(onboarding): register follows "Create your workspace" with a team name` (trailer).

### Task 18 (lane Team): "Invite" on the team page, and the team's pending invitations

**Files:** Create `resources/js/components/invitations/team-invite-dialog.tsx` (+ test), `resources/js/components/invitations/pending-invitations.tsx` (+ test); modify `resources/js/components/teams/team-page.tsx`, `resources/js/pages/teams/show.tsx` (props), plan 23's Members tab file (or `team-members-card.tsx` when WS-3 is absent).

Mockups: ScreenTeam (members card header: ghost "Invite" with `UserPlus`), ScreenSettings a (Members card header ":count members · :pending pending invitations", "Invitation link", "Invite"; pending rows). Composition: the team page passes `inviteAction` = the "Invite" button when `canInvite`; it opens `TeamInviteDialog` (`Dialog`, `Drawer` below `md`) holding `TeamInviteForm`; opening it does `router.reload({ only: ['inviteLink'] })`; "Create a link", "Create a new link" and "Turn off the link" post or delete `teams.inviteLink.*` with `preserveScroll` and reload `inviteLink`; sending posts `teams.invitations.store`, toasts the count from the flash `invitationsSent`, clears the chips, and on mail-only instances shows the flashed URLs as copyable lines (as the workspace page does with `invitationUrl`). `PendingInvitations` (in the Members tab): one row per `pendingInvitations` item — address, "Invited on :date", badge "Pending invitation" (warning) / "Expired" / "Declined" (muted), the role, "Resend" (posts `workspaces.invitations.resend.store`, toast), revoke (`ConfirmDialog`, 9-D5, deletes `workspaces.invitations.destroy`); "Invitation link" opens the dialog with focus on the link block. Behaviours to test: "Invite" only with `canInvite`; the dialog loads the link on open; send, resend, revoke flows with their requests; the header count.

Commit: `feat(invitations): invite from the team page; pending invitations in the team settings` (trailer).

### Task 19 (lane Team): The workspace invite dialog and table

**Files:** Modify `resources/js/components/workspaces/invite-form.tsx` (+ test), `members-table.tsx` (+ test), `invitations-table.tsx`, `pages/workspaces/members.tsx`.

Composition: fill `InviteSlots.inviteTeamsField` with "Team · optional" (`Select` of `teams`, an empty choice "No team") and, once a team is picked, "Role in the team" (`teamRoles`, default `member`); `inviteMessageField` with "Message · optional" (500). The POST adds `team_id`, `team_role`, `message`. The invitations table shows the team (when set), the status badge, "Resend". Behaviours to test: the team role appears only with a team; the payload; the badges; existing tests green.

Commit: `feat(invitations): the workspace invite dialog picks a team and takes a message` (trailer).

### Task 20 (lane Onboarding): The onboarding page

**Files:** Create `resources/js/components/onboarding/{onboarding-page,onboarding-header,workspace-step,team-step,invite-step,ritual-step,team-preview}.tsx` (+ tests); modify `resources/js/pages/onboarding/show.tsx`, `resources/js/layouts/skrum/onboarding-layout.tsx` (header end: language switcher, avatar, "Log out" — P25-06), `components/skrum/frames.tsx` only if the progress bar under the header needs a slot (`OnboardingFrame` gains `progress?: ReactNode`).

Mockup: ScreenOnboarding a and c. Composition:

| Region | Content | Built from |
|---|---|---|
| Header | logo; `PhaseStepper` with the four steps (`interactive={false}`, `compact` below `md`); language switcher, `PersonAvatar` of the user, "Log out" (`logout` route, `method="post"`) | `OnboardingLayout`, `PhaseStepper` (read §17 item 4: if it cannot render a plain read-only rail, add an option in its own commit) |
| Progress | `Progress` value `step/4`, 0.1875rem, under the header | `components/ui/progress` |
| Form column | "Step :n of 4" (overline), title (`font-display`, the display-lg size), sentence, fields, actions row; under step 2 "Everything can be changed later in Team settings." | `TextField`, `Select`, `Textarea` |
| Step 1 | "Name your workspace", "The workspace groups your teams, templates and members.", "Workspace name" (autofocus, 100), "Default language" (`Select` of `locales`, default `workspace.locale ?? userLocale`), the logo's place left empty (P25-01), "Continue" | `useForm` → `onboarding.workspace.update` |
| Step 2 | "Create your first team", "A team is the people who run their rituals together. You can add more teams to :workspace later.", "Team name" (autofocus, prefilled `team?.name ?? teamName`, help "Shown in the sidebar, on invitations and in session links."), "Team colour" (radiogroup of the eight colours with the chosen name under it — the picker of `column-color-picker.tsx`, its inline form), the team link's place left empty (P25-02), "Description · optional", "Back" (`onboarding.step.update` `workspace`) and "Continue" (lg) | `columnColors`, `useColumnColorName` |
| Step 3 | "Invite your teammates", sentence of P25-07, `TeamInviteForm` with `onSkip` ("Skip" → `onboarding.step.update` `ritual`) posting `onboarding.invitations.store`; when `inviteLinkUrl` is null on mount, post `teams.inviteLink.store` once and reload | `TeamInviteForm` (Task 14) |
| Step 4 | "What do you want to start with?", four radio cards (`.ob-rit`: icon on its column colour — Retro `sun`, Poker `iris`, Whiteboard `sky`, Icebreaker `coral`; the mockup's lines "Writing → vote → actions", "Estimate the backlog", "A free canvas", "5 minutes to warm up"), no date (P25-04), "Go to the dashboard instead" (ghost) and the primary "Create the retro" / "Create the poker game" / "Create the whiteboard" / "Create the icebreaker", both posting `onboarding.completion.store` | `RadioGroup` |
| Aside (from `lg`) | dot-grid panel: "Preview", a team switcher row and the team card (`TeamMark` live from the typed name and colour, ":workspace · :count member(s)", static skeletons, "No sessions yet"), then "Coming next" with the steps after the current one | `TeamPreview`, `Skeleton` |
| Phone | form full width, `p-4`, aside hidden, actions `sticky bottom-0` with a top border | — |

Behaviours to test: each step renders its fields and actions; the preview follows the typed name and colour; "Back" and "Skip" call the step route; step 3 creates the link once when absent; step 4 changes the button label with the type and posts the ritual; field errors under their field; the stepper marks done and current steps; the phone layout hides the aside (class assertions on the breakpoint).

Commit: `feat(onboarding): the four-step onboarding page` (trailer).

## Final

### Task 21: Translations

- [ ] Collect every key added by Tasks 1 to 20 (`git diff main -- lang/en.json`); check each exists in `fr.json`, `es.json`, `de.json`, informal (French "tu": "Nomme ton espace de travail", "Crée ta première équipe", "Invite tes coéquipiers", "Par quoi veux-tu commencer ?", "Refuser l'invitation", ":name sera prévenu·e. Le lien cessera de fonctionner.", "Invitation refusée", ":name a été prévenu·e. Tu peux fermer cette page.", "Rejoindre :team en tant que :name ?", "Ce n'est pas toi ? Changer de compte", "Ou partage ce lien", "Expire dans :days jours · jusqu'à :count personnes", "« :address » semble incomplète.", "Crée ton espace", "Nom de l'équipe", "Tout reste modifiable dans Paramètres de l'équipe."; Spanish "tú", German "du"), terms consistent with `docs/superpowers/research/front-rewrite/translations-review.md` (glossary: "équipe", "espace de travail", "facilitateur·rice", "observateur·rice", "lien d'invitation").
- [ ] Run `bin/test-db pgsql -- tests/Feature/TranslationKeysTest.php tests/Feature/InformalRegisterTest.php` and `sqlite`. Expected: PASS.
- [ ] Commit `chore(i18n): plan 25 strings in four languages, informal` (trailer).

### Task 22: Captures (light, 1440, French)

- [ ] Add `tests/Browser/Visual/OnboardingVisualTest.php` in the pattern of `tests/Browser/Visual/AccessPagesVisualTest.php` (read it first): fixtures built with the factories; captures of the onboarding at steps 1, 2 (name and colour typed), 3 (three chips, one invalid, link shown) and 4; the register page with "Team name"; the invitation card of a team invitation with a message (signed out, signed in), its declined state; the invite link page (signed out, signed in); the team page's invite dialog; the team settings Members card with a pending, an expired and a declined invitation.
- [ ] Run `VISUAL_ONLY=light-1440-fr vendor/bin/sail pest tests/Browser/Visual/OnboardingVisualTest.php` and the harness's overflow check. No walkthrough is written or run.
- [ ] Commit `test(visual): plan 25 captures` (trailer).

### Task 23: Deviations and documents

- [ ] Compare each capture with its mockup's `preview.html` (ScreenOnboarding a–d, ScreenAuth, ScreenTeam, ScreenSettings a, NotificationsPanel); fix what fits no reason; add a row P25-16… for each difference kept, with its reason.
- [ ] Update `docs/superpowers/plans/2026-10-16-plan-18e-front-rewrite-screens.md` deviation rows: D-30 (cleared except "already in n teams", backlog), D-33 (cleared), D-52 (cleared), D-18 ("Invite" cleared), D-54 (the button names the team). Update `docs/superpowers/research/front-rewrite/feature-roadmap.md`: IN-1 to IN-4 and ON-1 "done, plan 25", the registration line, ON-1's dependency on SE-2 removed. Move the spec to `docs/superpowers/specs/2026-10-25-invitations-and-onboarding-design.md` and this plan to `docs/superpowers/plans/2026-10-25-plan-25-invitations-onboarding.md`.
- [ ] Commit `docs: plan 25 — spec and plan in place, roadmap and deviation rows updated` (trailer).

### Task 24: Full suites and report

- [ ] `vendor/bin/pint --format agent`; `vendor/bin/sail composer types:check`; `vendor/bin/sail composer rector:check`.
- [ ] `bin/test-db pgsql`, then `bin/test-db sqlite`, `bin/test-db mariadb`, `bin/test-db mysql` (one engine at a time) — Expected: `test-db <engine>: PASS` on each.
- [ ] `bin/test-db pgsql --concurrency`, `mariadb --concurrency`, `mysql --concurrency`, `sqlite-file --concurrency` — Expected: PASS on each.
- [ ] `bin/check-pg-upgrade` — Expected: PASS (the upgraded schema equals a fresh install's).
- [ ] `npm run test`, `npm run types:check`, `npm run check`, `npm run build:front` — Expected: PASS.
- [ ] Report `docs/superpowers/research/plan-25-report.md`: per acceptance criterion of spec §14, the test that proves it and the engines it passed on; plan 23's names as found and every place this plan followed them; which registration path Fortify took (§17 item 2); the differences that remain with each mockup; every existing test edited and why (the three redirects of Task 11, any `team` prop assertion of Task 9); every decision taken on the owner's behalf.
- [ ] Commit `docs: plan 25 report` (trailer). Then ask the owner to read it. No merge into `main`, no push.

---

## Self-review (done while writing; kept for the reader)

**Spec coverage.** §6.1 invitation columns: Task 1; team colour and workspace language: Task 2; §6.2 link: Task 3, onboarding: Task 4; §6.3 who gets an onboarding: Task 11; §7 permissions: Tasks 6 (invite, manage), 7 (accept), 8 (decline), 10 (join, signup), 12 (steps); §8.1 sending: Tasks 5, 6; §8.2 mail: Task 5; §8.3 decline: Tasks 8, 15, 16; §8.4 link: Tasks 9, 10, 16, 18; §8.5 onboarding: Tasks 11, 12, 20; §8.6 registration: Tasks 11, 17; §9 real time: nothing to build (the existing listener; Task 8's notification is on the `database` channel); §10 screens: Tasks 15 to 20; §11 routes: Tasks 6 to 12; §12 existing data: Tasks 1 (legacy row), 7 (old invitation accepted), 11 (existing users), 2 (no colour); §14 criteria: 1 → 5; 2 → 6; 3 → 5; 4 → 5; 5 → 7, 15; 6 → 7; 7 → 8, 15; 8 → 9; 9 → 10; 10 → 10, 11; 11 → 11, 17; 12, 13 → 12; 14 → 12, 20; 15 → 12, 14, 20; 16 → 11; 17 → 7, 11; 18 → 6, 9, 18; 19 → 13, 19; 20 → 7, 8, 16; 21 → 21, 22, 23; 22 → 24.

**Placeholders.** Back-end tasks carry their tests and code. Screen tasks carry composition, behaviours and the code of their pure logic (Task 14), not full component code: they follow the screen procedure of plan 18e, where the mockup is the specification of the markup. Two places depend on code not yet written and say how to adapt: plan 23's names (Branch and run) and Fortify's intended-URL behaviour (Task 11).

**Type consistency.** `InvitationTerms` is built in Tasks 5, 6, 12 with the same five arguments. `CreateWorkspaceInvitation::handle(Workspace, User, InvitationTerms)` has one caller left (`SendInvitation`). `InvitationUnavailable` is thrown by `AcceptWorkspaceInvitation`, `DeclineWorkspaceInvitation` and `JoinTeamByLink` and mapped to 410 by their three controllers. `TeamInviteLink::url()` uses `inviteLinks.show`, defined in Task 10; Task 9's page test runs after it. The session key lives in `App\Support\Invitations\InviteLinkSession::Key` (Task 10) and is read by `CreateNewUser`, `CurrentWorkspaceController`, `SsoCallbacksController` and the register view. `PendingInvitation.status` and `WorkspaceInvitation::status()` share the three values. The props of `onboarding/show` (Task 12) are those Task 20 reads.

**Review Focus.** Each line has its test: link uses under a race (Task 10), accept against decline (Task 8), double "Continue" (Task 12), existing users and old invitations (Tasks 7, 11), the link visitor's registration path (Task 11), a team inviter on another team's invitation (Task 6), markup in a message (Task 5).

**Known weak points of this draft.** Nothing was run. Plan 23 does not exist yet: `TeamRole`, the pivot `role` and `TeamPolicy::manageMembers`'s new rule are assumed, and `teamMember()` (which attaches without a role today) may be changed by plan 23. The mail's team colour needs column colours in the mail palette, which was not checked (Task 5 says what to do). The onboarding's GET never writes; step 3 creates the link through its own POST.
</content>
</invoke>
