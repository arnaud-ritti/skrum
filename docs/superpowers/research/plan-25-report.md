# Plan 25: team invitations, the invite link and the four-step onboarding — report

Branch `plan-25-invitations-onboarding` (worktree `.claude/worktrees/rm25`). Spec:
`docs/superpowers/specs/2026-10-25-invitations-and-onboarding-design.md`; plan:
`docs/superpowers/plans/2026-10-25-plan-25-invitations-onboarding.md`. First written on the code of `69694ab9` (the fix
of §1.2), before Tasks 26 to 29; **rewritten after them and after the review fix round, on the code of `7501c3e7`**:
every run of §1 below is on that code, the commit after it changes this report only. Not pushed; `main` and `roadmap`
untouched. The controller ran every task in numeric order on this one branch (lanes flattened), so Tasks 26, 27, 28
and 29 (the three answers of 2026-10-03 against the recommendation: P25-03, P25-10, P25-15) came after the first
version of this report; §1.3 and §8 say how they were built, criteria 24 to 26 map them to their tests.

## 1. Result

One command at a time in the shared application container `skrum-laravel.test-1`, database `testing_l25`
(`TEST_DB_DATABASE=testing_l25`, `TEST_DB_WORKDIR=/var/www/html/.claude/worktrees/rm25`). PostgreSQL only (owner,
2026-10-03): SQLite, MariaDB and MySQL run in the roadmap's final four-engine matrix, not here.

| Run | Result |
|---|---|
| `bin/test-db pgsql` (Unit, Feature, Upgrade, Arch; 8 processes) on `69694ab9`, first run | `FAIL, 1278 failed, 2 skipped, 6061 passed`: the slug of §1.2 |
| the same on `69694ab9`, after the fix of §1.2 | `PASS, Tests: 2 skipped, 7340 passed (61276 assertions)` |
| **`bin/test-db pgsql` on `7501c3e7`** (Tasks 26 to 29 and the fix round included) | `PASS, Tests: 2 skipped, 7372 passed (61432 assertions)` |
| **`bin/test-db pgsql --concurrency` on `7501c3e7`** | `PASS, Tests: 1 skipped, 59 passed (225 assertions)` |
| `bin/check-pg-upgrade` (databases `testing_l25_upgrade_old` and `_fresh`), on `69694ab9` | `PASS, every row is there, and the schemas are equal apart from the five legacy check constraints`. Not rerun: no commit after it touches `database/` (`git diff 3061443f..7501c3e7 -- database/` is empty) |
| **`composer types:check` (PHPStan) on `7501c3e7`** | `passed`, 0 errors |
| `vendor/bin/pint --dirty --format agent` on `7501c3e7` | `passed` |
| `composer rector:check` | fails on 246 files before the pass, as on the base; see §1.1. Not rerun after Tasks 26 to 29 |
| **`npm run test` (Vitest) on `7501c3e7`** | `550 files, 5619 tests passed` |
| `npm run types:check`, `npm run check` on `7501c3e7` | no error; 1413 files formatted, no lint warning in 1396 files |
| `vp build`, then `wayfinder:generate --with-form` on `7501c3e7` | built; nothing to commit afterwards |

`TranslationKeysTest`, `InformalRegisterTest`, `UuidPrimaryKeysTest` and `tests/Arch/DatabasePortabilityTest.php` ran
inside the whole suite. Browser walkthroughs and smoke tests were not run (owner's rule); the captures are those of
Task 23.

The five migrations are dated `2026_10_25_100000` to `2026_10_25_100400` as the plan names them.
`bin/check-pg-upgrade` ran them on the old install. Its fixture holds 17 teams and no two of one name in one
workspace: the slug fill gave each its derived slug and numbered none. The numbering of two teams
of one name in one workspace (`atlas`, `atlas-2`, in creation order) and a second run that writes nothing are proved
by `tests/Upgrade/TeamSlugBackfillTest.php` on the real migration.

### 1.1 Rector

`composer rector:check` is not clean on this branch, nor on its base (as in plans 18e, 19, 22, 23 and 27): 246 files.
As those plans did, the pass (`69694ab9`) applied rector to the files plan 25 created: `throw_if` / `throw_unless` in
`DeclineWorkspaceInvitation`, `JoinTeamByLink` and `CreateTeam`, `abort_if` in `LocksOnboarding`, one arrow function
in the link race, one chained `expect` in `InvitationAcceptanceWithTeamTest`, `toBeEmpty()` in
`TeamSlugBackfillTest`. Left as they were: `NewMethodCallWithoutParenthesesRector` in `SendInvitation` and
`SendInvitationTest` (no file of the project uses that form yet), and every finding in a file older than this plan,
among them the lines plan 25 edited in `AcceptWorkspaceInvitation`, `Team`, `User`, `WorkspaceInvitationNotification`,
the mail tests and `tests/Pest.php`.

### 1.2 The failure of the first whole run, fixed in `69694ab9`

1272 tests failed on `null value in column "slug" of relation "teams"`: Task 14 gave a team its slug in a `creating`
listener of the model, and `Event::fake()` (and every quiet save) skips model listeners. The tests that fake events and
create a team through `TeamFactory` (action items, retros, poker, games…) therefore inserted a team without a slug.
The plan said of `TeamFactory` "nothing to add: the model's hook gives the slug; checked in Task 14"; Task 14's own
files did not fake events, and the per-task runs never ran those files. `Team` now fills the slug in `performInsert`,
before calling Eloquent's, so the slug is given at the insert itself whatever the event dispatcher; the derivation
(`TeamSlug::availableIn` on `TeamSlug::fromName`) and a given slug are unchanged, and `CreateTeam` still passes its own.
A new case of `TeamSlugTest` ("gives a new team its slug while events are faked or muted") failed before the change and
passes after. No production path changed: no code of `app/` saves a team quietly.

### 1.3 Tasks 26 to 29, and the review fix round

Tasks 26 to 29 were built after the first version of this report: `571e8873` (Task 26, P25-03), `5e67a52d` (Task 27,
P25-10), `8db7e330` (Task 28, P25-15, server) and `defdabc7` (Task 29, P25-15, the admin card). Their tests are
`tests/Feature/Onboarding/OnboardingSkipTest.php`, `tests/Feature/Invitations/LiveSessionBannerTest.php`,
`tests/Feature/Onboarding/DefaultWorkspaceTest.php`, `tests/Feature/Admin/DefaultWorkspaceSettingTest.php`,
`resources/js/components/admin/default-workspace-card.test.tsx` and the new case of
`resources/js/pages/admin/sign-in.test.tsx`; all ran in the runs of §1 on `7501c3e7`. §8 says how each answer was
built.

The review of Tasks 21 to 29 found five defects in code, fixed with a failing test first:

- `807225cb`: a default-workspace newcomer who then accepts a team invitation or joins by a link ends the onboarding
  (`CloseOnboardingForJoiner` also closes an open row at the team step, with no team, in a workspace the user does
  not own). `DefaultWorkspaceTest`: "ends the joiner's onboarding when they then join a team by an invitation or a
  link" (two cases), "keeps the onboarding of a workspace owner who joins another team".
- `f7896e9a`: step 4 shows the server's `step` refusal (`ritual-step.test.tsx`, "shows the step refusal of "Create the
  retro""); a ritual sent from a row rewound to the team step (its team deleted meanwhile) gets "This step is not
  available." instead of "Choose a first ritual on the last step.", whose key left the four `lang/*.json`
  (`OnboardingSkipTest`, "refuses the first ritual with the step message when the team was deleted during step four").
- `96b5eccd`: step 3 creates the team's link by itself only for a team that never had one (the prop
  `hasHadInviteLink`): a link turned off stays off when the step shows again (`invite-step.test.tsx`, "leaves a
  turned-off link off when the step shows again"; `OnboardingStepsTest`, "tells step three whether the team ever had
  a link…").
- `7501c3e7`: the team colour's error is tied to its radiogroup (`aria-describedby`, `aria-invalid`;
  `team-step.test.tsx`, "ties a colour error to the swatches").

**Still open: the three captures** of Task 23 that need Tasks 26 to 29 (step 2 of a default-workspace newcomer, the
team page with the session-in-progress banner after accepting an invitation, the admin SSO authentication page with
the default workspace card set). They are written as `[P25-23-15]` to `[P25-23-17]` but not committed: the fix round
could not run the browser harness (the host run against a new `testing_l25_browser` database was refused by the
session's permission check). Until they run, these three screens are unchecked for overflow at 1440 and uncompared
with the design system; no deviation row is added for them.

## 2. Acceptance criteria (spec §14)

Every PHP test named here ran in the whole PostgreSQL suite above, unless the row says concurrency or upgrade. Vitest
files ran once in `npm run test`. The races and the upgrade test run on SQLite, MariaDB and MySQL in the roadmap's
final matrix.

| # | Criterion | Proved by |
|---|---|---|
| 1 | Workspace invitation with or without a team; team role required; owner refused; message over 500 refused | `SendInvitationTest` ("invites to a team of the workspace from the workspace dialog", "refuses a team of another workspace, an owner role and someone already in the team"); `InvitationModelTest` ("offers every team role but owner to an invitation"); `invite-form.test.tsx` |
| 2 | A team inviter sends 1 to 20 addresses with one role and one message; errors on the index; workspace member not in the team invitable; member, observer, outsider 403; a facilitator of one team 403 on another | `TeamInvitationsTest` (the first six cases and "puts the error on the index of the chip that was submitted"); `team-invite-form.test.tsx`, `email-chips-field.test.tsx`, `lib/invitations/email-chips.test.ts` |
| 3 | Two invitations of one address at once leave one pending | concurrency `InvitationIssueTest`, PostgreSQL |
| 4 | Mail: team name, colour, member count, message; subject names the team; workspace mail with the message; workspace language for an address without an account | `SendInvitationTest` ("issues a team invitation…", "writes to an address without an account in the language of the workspace", "shows the team, its colour and the message in the mail, as plain text"); `WorkspaceInvitationMailTest`; `TeamMarkTest` (the colour's parity with `lib/mark-color.ts`, with `mark-color.test.ts`) |
| 5 | Invitation page: team mark, sentence, members, team role, message, buttons naming the team; workspace invitation as today plus the message | `InvitationAcceptanceWithTeamTest` ("shows the team, its mark, the role and the message on the invitation page", "shows a team invitation to a workspace member who is not yet in the team"); `InvitationPagePropsTest`; `invitation-card.test.tsx` |
| 6 | Accepting (card, account form, SSO) joins workspace and team with their roles, never changes a role, opens the team page; a deleted team deletes the invitation | `InvitationAcceptanceWithTeamTest` (the first five cases and "sends a member of the team to the team page"); `InvitationModelTest` ("goes with its team") |
| 7 | Decline stamps declined; the link says so; accepting afterwards 410; the invitee's bell item disappears; the inviter's `invitation_declined` item; accept and decline at once leave one | `InvitationDeclineTest` (seven cases); `InvitationAcceptanceWithTeamTest` ("refuses with 410 an invitation that stopped being pending under the lock", "refuses to accept an invitation read before it was declined"); concurrency `InvitationAnswerTest` (two cases); `notifications-panel.test.tsx` |
| 8 | Team inviters create, replace and turn off the link (7 days, no use limit); two creations at once leave one; member and observer 403; URL and joined count shown each time; token encrypted, found by hash | `TeamInviteLinksTest` (nine cases); concurrency `TeamInviteLinkTest` ("leaves one usable link when two are created at the same instant"); `invite-link-block.test.tsx`, `team-invite-dialog.test.tsx` |
| 9 | A verified account joins by a usable link, counted once; already in the team counts nothing; expired or turned off 410; many at once all join and are counted; one account twice at once counted once | `InviteLinkJoinTest` (the first four cases, "shows the link page of an expired link…", "answers 404 with the invalid card…"); concurrency `TeamInviteLinkTest` (the two join races); `invite-link-card.test.tsx` |
| 10 | A signed-out link visitor signs in or registers and comes back; decision 4 per signup mode; no onboarding | `InviteLinkJoinTest` ("shows a signed-out visitor the team and remembers the link for registration", "opens registration through a link by signup mode", "registers a visitor who came by a usable link in invite mode…", "creates an SSO account in invite mode…"); `OnboardingStartTest` ("starts no onboarding for an account created through a link", "follows a link visitor through registration and verification back to the link", "sends a user who opened a link before registering back to the link") |
| 11 | Register shows "Create your workspace" with "Team name", creates the account only, onboarding at step 1 after verification; with an invitation or link no team field and no onboarding | `OnboardingStartTest` (the first four cases); `register.test.tsx`, `register-form.test.tsx` |
| 12 | Step 1 creates one workspace with its language (two at once: one); after "Back" it renames | `OnboardingStepsTest` ("creates the workspace at step one, then renames it after Back", "names the languages of step one…"); concurrency `OnboardingStepTest` ("creates one workspace…"); `workspace-step.test.tsx` |
| 13 | Step 2 creates one team with colour, description and slug, the user its owner, prefilled; updated not duplicated; a rename keeps the slug; a taken or malformed slug is a field error | `OnboardingStepsTest` ("creates the team at step two…", "refuses the team step before the workspace exists"); `TeamSlugTest` (the three onboarding cases); concurrency `OnboardingStepTest` ("creates one team…"); `team-step.test.tsx`, `team-preview.test.tsx`, `team-address-field.test.tsx` |
| 14 | Step 3 sends the invitations, shows the link (created when first shown); "Skip" moves to step 4 | `OnboardingStepsTest` ("sends the invitations of step three, or skips them", "shows the team, its link and its pending invitations at step three", "tells step three whether the team ever had a link…"); `invite-step.test.tsx` (a link turned off is not created again, §1.3) |
| 15 | Step 4 completes and opens the team page with "New session" on the chosen type; "Go to the dashboard instead"; never shown again | `OnboardingStepsTest` ("completes at step four and opens the new session dialog on the chosen type", "refuses a move the stepper does not offer"); `OnboardingStartTest` ("opens the onboarding page only for an onboarding that is not completed"); `ritual-step.test.tsx`, `use-new-session-intent.test.ts` |
| 16 | Resume at the saved step; joining before step 1 completes the onboarding | `OnboardingStartTest` ("resumes an onboarding that is not completed", "closes an onboarding without a workspace when its user joins by an invitation or a link"); `OnboardingStepsTest` (the two rewind cases); `DefaultWorkspaceTest` (a default-workspace newcomer who joins a team, §1.3); `onboarding-page.test.tsx` |
| 17 | A user with a workspace never sees the onboarding; one with none sees step 1; an old invitation as before | `OnboardingStartTest` ("never sends an existing member of a workspace to the onboarding", "reopens a completed onboarding for a user who left every workspace"); `DashboardTest`; `InvitationAcceptanceWithTeamTest` ("keeps accepting an invitation issued before the team columns as before"); `InvitationModelTest` ("reads a row written before the team columns…") |
| 18 | "Invite" to team inviters only; the dialog sends and manages the link; Members tab lists pending, expired, declined with "Resend" and revoke, "Invitation link" and "Invite", to a facilitator as to an owner; a team inviter resends and revokes their team's invitations only | `TeamInvitationsTest` ("lets a team inviter resend and revoke the invitations of the team and of no other", "refuses to replace a pending invitation the team inviter may not manage", the two resend refusals); `TeamInviteLinksTest` (the two page-props cases); `TeamSettingsPagesTest`; `team-page.test.tsx`, `pages/teams/members.test.tsx`, `pending-invitations.test.tsx`, `team-invite-dialog.test.tsx` |
| 19 | Workspace members page invites with a team and a message, lists team and status | `InvitationListsTest`; `invite-form.test.tsx`, `members-table.test.tsx` |
| 20 | The bell names the team and presents `invitation_declined`, no buttons | `InvitationAcceptanceWithTeamTest` ("names the team in the invitee bell item"); `InvitationDeclineTest` (the two bell cases); `notifications-panel.test.tsx` |
| 21 | Four languages, informal; captures compared | `TranslationKeysTest`, `InformalRegisterTest`; Task 23's fifteen captures (light, 1440, French), compared in Task 24: rows P25-19 to P25-23. **Not captured yet**: the banner, step 2 of a default-workspace newcomer, the admin card (§1.3, still open) |
| 22 | A slug per team, unique per workspace, derived, raced, kept on rename, edited by who may update the team, filled by the upgrade; `/t/<slug>` by Rule S-1, 404 alike, signed-out visitor back | `TeamSlugTest` (twelve cases); concurrency `TeamSlugTest`; upgrade `TeamSlugBackfillTest` (three cases); `TeamAddressesTest` (four cases); `lib/teams/team-slug.test.ts`, `general-settings.test.tsx` |
| 23 | Suites on PostgreSQL with `DatabasePortabilityTest`; `bin/check-pg-upgrade` | §1 above. Other engines: final matrix |
| 24 | "Skip for now" on step 2 (P25-03) | `OnboardingSkipTest` (five cases: ends without a team and opens `dashboard`, keeps a team saved before "Back", refuses a ritual with the skip, refuses a ritual from a rewound step 4, refuses before the workspace step); `team-step.test.tsx` ("ends the onboarding with "Skip for now", with no ritual") |
| 25 | The session-in-progress banner after joining (P25-10) | `LiveSessionBannerTest` (eight cases: after accepting, after creating the account on the card, after joining by the link, after an SSO that accepted a team invitation; nothing without a Live session, after a workspace invitation without a team, to a member already in the team, nor on the next visit); `live-session-banner.test.tsx`, `team-page.test.tsx`. Capture still open (§1.3) |
| 26 | The instance default workspace for new SSO accounts (P25-15) | `DefaultWorkspaceTest` (eleven cases with the two of the fix round: joins as member at the team step, one team at step 2 but no "Back", Rule D-1 kept outside the onboarding, "Skip for now", ends when a team is then joined, kept for an owner, invitation or link take precedence, new SSO accounts only, unset or deleted setting, step 1 again when deleted); `DefaultWorkspaceSettingTest` (six cases: options and value, stored and audited and cleared, deleted workspace, unknown id, kept through a Branding reset, instance admins only); `default-workspace-card.test.tsx` (seven cases); `sign-in.test.tsx` ("ends with the card of the new SSO accounts, after the "SSO required" form"); `team-step.test.tsx` ("offers no "Back" when the workspace cannot be edited"). Captures still open (§1.3) |

## 3. Plan 23's names, as found

As the plan assumed: `App\Enums\TeamRole` with `Owner`, `Facilitator`, `Member`, `Observer`; `team_user.role`;
`Team::members()` with `withPivot('role')`; `Team::roleOf(User): ?TeamRole`; `teams.description`;
`TeamPolicy::manageMembers` reading the team role. Different from the plan: plan 23's Members tab and General tab live
in `resources/js/components/team-settings/` (`members-table.tsx`, `general-settings.tsx`, the "Members & rituals"
page `pages/teams/members.tsx`), not under `components/teams/`; Tasks 19 and 20 followed them. Plan 23 had no
team-creation action: Task 14 created `App\Actions\Teams\CreateTeam` as the plan says.

## 4. Fortify's registration path (spec §17 item 2)

A link visitor does not come back through `redirect()->intended()`. The link page stores its token in the session
(`App\Support\Invitations\InviteLinkSession::Key`, `invite_link_token`) when it is shown to a visitor who cannot join
yet; Fortify's register and e-mail verification responses land on `dashboard` as before, and
`CurrentWorkspaceController::show` sends whoever carries a usable link's token back to the link page before any
onboarding. Proved end to end by `OnboardingStartTest` ("follows a link visitor through registration and verification
back to the link"). Registration and SSO read the same key to apply decision 4 and to start no onboarding.

## 5. Differences left with the mockups

All in the plan's **Pre-build deviations**: P25-01 to P25-17 (answered by the owner on 2026-10-03; P25-02 obsolete,
built as drawn; P25-03, P25-10 and P25-15 built by Tasks 26 to 29, §8), and rows found later, which **wait for the
owner**:

- **P25-18** (review of Tasks 1 to 10): a team inviter who may not manage a pending invitation of the address gets a
  field error instead of replacing it.
- **P25-19** (Task 24): the stepper's third step reads "Inviter" in French (the existing key "Invite").
- **P25-20** (Task 24): step 3 has the message field and the link's "Create a new link" and "Turn off the link".
- **P25-21** (Task 24): "Send" is disabled while an address is incomplete.
- **P25-22** (Task 24): step 4's lines without "sprint 43" and "Excalidraw"; French "Tableau blanc".
- **P25-23** (Task 24): the Members card's invitation rows show the team role under the badge and "Expired" and
  "Declined" rows with "Resend" and the revoke cross.

## 6. Existing tests edited, and why

PHP:

- `tests/Feature/DashboardTest.php`, `tests/Feature/Workspaces/WorkspacesTest.php` ("sends users without a workspace to
  the onboarding", renamed), `tests/Feature/Workspaces/WorkspaceMembersTest.php` (leaving the last workspace): the
  three redirects of Task 11, from `workspaces.create` to `onboarding.show`.
- `tests/Feature/Auth/InvitationPagePropsTest.php`: the invitation page's exact key list gains `isDeclined` (Task 7).
- `tests/Feature/Database/EmailKeyTest.php`, `tests/Feature/Mail/MailMockupTest.php`,
  `tests/Feature/Workspaces/WorkspaceInvitationModelTest.php`: `CreateWorkspaceInvitation::handle` takes an
  `InvitationTerms` instead of the address and the role (Task 5); expectations unchanged.
- `tests/Feature/Mail/WorkspaceInvitationMailTest.php`: cases added for the team block and the message (Task 5); no
  expectation changed.
- `tests/Feature/Teams/TeamSettingsPagesTest.php`: Members & rituals' props gain the invitation props (Task 19); cases
  added, none changed.
- `tests/Upgrade/DrawFindersUpgradeTest.php`, `tests/Upgrade/GameSettingsUpgradeTest.php`: their raw team rows insert a
  `slug`, the column being not null at their migration's date (Task 14).
- `tests/Feature/Invitations/InvitationAcceptanceWithTeamTest.php`, `tests/Concurrency/TeamInviteLinkTest.php`,
  `tests/Upgrade/TeamSlugBackfillTest.php`: rector's form only (§1.1); `tests/Feature/Teams/TeamSlugTest.php`: one case
  added (§1.2).

No `team` prop assertion changed in Tasks 9 and 14: the team page's props gained keys, and the tests that read them
read single keys.

Vitest: `invitation-card.test.tsx` (the test of the empty team, message and refusal places replaced by tests on the
data props, Task 16), `workspaces/invite-form.test.tsx` ("Resend" posts the invitation's resend route, Task 20),
`register-form.test.tsx`, `frames.test.tsx`, `notifications-panel.test.tsx`, `phase-stepper.test.tsx`,
`general-settings.test.tsx`, `use-new-session-intent.test.ts`, `team-page.test.tsx`, `members-table.test.tsx`,
`auth-layout.test.tsx`, `mark-color.test.ts`, `pages/teams/members.test.tsx`: new props or cases for what the tasks
added; fixtures gain the new required props.

## 7. Decisions taken on the owner's behalf

The readings of spec §16 ruled on 2026-10-03 and built as ruled: a facilitator invites with facilitator, member or
observer, as an owner (`TeamInvitationsTest`, "lets a facilitator of the team invite, with any role but owner");
`/t/<slug>` looks in the current workspace first, then the account's other workspaces by name (`TeamAddressesTest`);
decisions 3 and 4 together let a leaked link open registration in `invite` mode to any number of people for 7 days
(kept; the joined count and "Create a new link" are the answer). Rule D-1: a default-workspace newcomer joins as
`member`; inside the onboarding they may create one team at step 2 (they become its owner), outside it a member still
may not create a team (`DefaultWorkspaceTest`, "keeps the team creation of a workspace member outside the onboarding
refused (Rule D-1)"). The banner's choice of session: the team's most recently active `Live` session the person may
see (`ListTeamSessions`, state `Live`, limit 1), flashed once on the redirect, nothing when there is none. Taken in
the fix round: a newcomer who then joins a team by an invitation or a link ends the onboarding unless they own the
row's workspace; step 3 never re-creates a link the team has had.

Taken during the build and reported with their tasks: P25-18 to P25-23 (§5); the team's link page names the link's
creator when it no longer works and lists no members (`6d5a692d`); a resend posts the invitation's own route so that
its team, role and message survive (`c3a7fc45`); the onboarding page's language list is the prop `languages`, the
shared `locales` being the header switcher's (`321f1a3b`); the team slug is filled at the insert rather than in a
model listener (§1.2, this task).

## 8. How P25-03, P25-10 and P25-15 were built

- **P25-03, "Skip for now" on step 2** (`571e8873`, the button from Task 21): `POST onboarding/completion` without a
  ritual, on a row at the team step, completes the onboarding and opens `dashboard`; no team is created, a team saved
  before "Back" is kept, steps 3 and 4 are skipped. A ritual at the team step is refused with the `step` key (fix
  round, §1.3). The row is read under the lock and rewound first (`LocksOnboarding`).
- **P25-10, the session in progress after joining** (`5e67a52d`, the banner from Task 19): the trait
  `FlashesLiveSession`, used by `InvitationAcceptancesController`, `InvitationAccountsController`,
  `InviteLinkMembershipsController` and `SsoCallbacksController`, flashes `liveSession` (`kind`, `title`, `url`) on
  the redirect to the team page when the team has a `Live` session the person may see; the team page draws
  `LiveSessionBanner` (an info `Alert`, "Join" and a dismiss button) from the flash, so it shows once.
- **P25-15, the default workspace** (`8db7e330`, `defdabc7`): the instance setting `default_workspace`
  (`InstanceSettingKey::DefaultWorkspace`), set on the admin SSO authentication page by the card "New SSO accounts"
  (`default-workspace-card.tsx`, a `Select` with "None" then every workspace, `PUT admin.defaultWorkspace.update`,
  audited as `settings_updated` in section `sign_in`). `ResolveSsoUser` calls `JoinDefaultWorkspace` for a new
  account brought by no invitation and no usable link: it joins as `member`, the workspace becomes current, and
  `StartOnboarding` opens the row at the team step in that workspace. `PresentOnboarding` gives `canEditWorkspace`
  false to a non-owner, so step 1 shows done and step 2 has no "Back"; `OnboardingStepsController` refuses the move
  to step 1 ("Your admin chose this workspace."). A deleted default workspace is ignored, and a row whose workspace
  was deleted goes back to step 1.
