# Public site — C. Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The owner's standing instruction is that plans run through the Workflow tool. **Tasks run one at a time, in order**: they share one test database, one Reverb port and one `website/dist`. An agent given one task is also given the sections "Global Constraints", "How a page is written" and "How a picture is taken".

**Goal:** The 77 pages of the documentation, each checked against the code, with their pictures taken by browser tests.

**Architecture:** One task per documentation section. A task owns three things and nothing else: the Markdown files of `website/src/content/docs/<section>/`, the pictures of `website/src/assets/screenshots/<section>/`, and one test file `tests/Browser/Docs/<Area>DocsTest.php` that takes those pictures. A first task creates every page as a stub so that links between sections always resolve; a last task reads the whole site.

**Tech Stack:** Markdown (Astro content collection of plan A), Pest browser tests with `docsVisit` / `docsOpen` / `docShot` and `DocsWorld` (plan B).

**Spec:** `docs/superpowers/specs/2026-10-06-public-docs-site-design.md` (§6, §7, §9 criteria 9 to 14 and 17).

**Depends on:** plan A tasks 1 to 4 and plan B, both done; `navigation-redesign` committed and this branch rebased on it (Task 1).

## Global Constraints

- Work in the worktree `.claude/worktrees/public-docs-site`, branch `public-docs-site`. Never `cd` to the main checkout.
- No application code changes. A page that cannot be illustrated without a new `data-slot` or `data-test` hook is reported; the picture is left out, not faked.
- **Every statement about the application is checked in the code of this branch (or in the running application) by the writer.** Specs, plans, research notes and this plan describe intentions and may be stale: they tell you where to look, never what to write. A statement you could not check is not written.
- English only. "Skrüm" in sentences, `skrum` in addresses, commands and file names. Sentence case in titles. "You". No exclamation marks in a row, no decorative emoji.
- Interface labels are quoted exactly as the English interface shows them, in bold: **Reveal votes**. Read them in `lang/en.json`, `lang/en/*.php` or the component.
- A page says who may do the thing when it is not everyone: workspace owner, admin, member; team owner, facilitator, member, observer; instance admin.
- Links between pages are relative and end with a slash: `../voting/` inside a section, `../../planning-poker/decks/` to another section. Until the last task, a link to another section points to the page, not to one of its headings.
- Outbound links go only to a vendor's own documentation. Before linking a page, read it and confirm it describes the step it is linked from.
- Every picture has an alternative text that says what it shows, lives under `website/src/assets/screenshots/<section>/`, and is used by at least one page.
- Every visible string in a picture is set by the test: no Faker sentence, no random name. People come from `DocsWorld`.
- Browser tests sign in through the form (`docsVisit`), fake every outbound call, carry no comment, and have names that say what the picture shows.
- No plan or ticket identifier in pages, test names, code or commit subjects.
- PHP follows the project's guidelines; run `vendor/bin/pint --dirty --format agent` before every commit.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Nothing is pushed.

## Review Focus

1. A page describes a feature as the spec planned it, not as it was built (a button renamed, an option removed at the owner's request, such as whiteboard voting and version history). Expected: every label and step matches the interface. Each task's first step is reading the component; the last task re-reads ten pages chosen at random against the running application.
2. A reader follows an integration page on a private network (no public address). Expected: the page says what does not work there (Slack's HTTPS redirect, inbound webhooks) and what replaces it (polling). Pinned in the Integrations task's "Before you start" requirement.
3. A reader without the right role follows a page and finds no button. Expected: the page named the role first. Pinned by the "who may do it" rule and checked in the last task.
4. A picture shows a loading skeleton, an empty state or a half-open menu. Expected: the writer looked at every picture before committing. Pinned by the "look at the picture" step of every task.
5. A vendor moved its documentation. Expected: `npm run check:external` reports it before the merge. Run in every task that adds outbound links and in the last task.

---

## How a page is written

A page is `website/src/content/docs/<section>/<slug>.md`. Task 1 creates all of them with their final front matter; a section task replaces the body and may refine `description` and add `related`. `title` and `order` are not changed without updating the table of Task 1.

```markdown
---
title: Voting
description: Give each person a number of votes and find what the team wants to talk about first.
order: 7
related:
  - retrospectives/grouping
  - retrospectives/discussion
---

One or two sentences: what the reader will be able to do after this page, and who may do it.

## First thing the reader does

1. Numbered steps, one action each, with the label in bold: select **Voting** in the phase bar.
2. …

![What the picture shows, in a sentence](../../../assets/screenshots/retrospectives/voting-column.png)

## Next thing

Short paragraphs. A table when there are options to compare. A block quote for the one warning that matters:

> Votes are hidden from the others until the facilitator moves to the discussion.
```

- Start with what the reader does, not with what the feature is.
- One `h2` per step of the task or per sub-topic; `h3` only inside a long `h2`. A page with two `h2` or more gets "On this page" automatically.
- 150 to 600 words for a task page; reference pages (catalogues, tables) are as long as their source.
- A catalogue page lists exactly what its source lists, read at writing time, and says how many there are.

## How a picture is taken

Pictures are taken by `tests/Browser/Docs/<Area>DocsTest.php`. One test per state of the application; one test may take several pictures of that state.

```php
<?php

use Tests\Browser\Support\DocsWorld;

it('shows the team page with its sessions and its members', function () {
    $world = DocsWorld::create();

    $page = $this->docsVisit($world->person('Camille'), route('teams.show', [$world->workspace, $world->team], false))
        ->assertPresent('[data-slot="team-page"]');

    $this->docShot($page, 'teams/team-page', '[data-slot="team-page"]');
});
```

and in the page:

```markdown
![The page of the Atlas team, with its sessions in progress and its members](../../../assets/screenshots/teams/team-page.png)
```

- `DocsWorld::create()` gives `$world->workspace` (Nordlys), `$world->team` (Atlas), `$world->person('Camille')` (workspace admin, team owner), `'Théo'` (facilitator), `'Inès'`, `'Malik'`, `'Sofia'`, `'Noa'`, `'Lucas'` (members), `'Yuki'` (observer), and sprints 41 to 43. Every password is `password`.
- `$this->docsVisit(User $user, string $path)` signs in and opens the path; `$this->docsOpen(string $path)` opens it signed out; `$this->docShot($page, '<section>/<name>', '<selector>')` saves `website/src/assets/screenshots/<section>/<name>.png`.
- Build the state on top of the story with file-local functions named `docs<Area>…` and the helpers of `tests/Pest.php` (each task names the ones it needs). Read the matching file of `tests/Browser/Visual/` and `tests/Browser/Walkthroughs/` first: it already builds that screen.
- Paths come from `route('<name>', […], false)`; find the name with `php artisan route:list --name=<prefix>`.
- The selector is the smallest element that contains what the sentence explains. Prefer an existing `data-slot`, then `data-test`; a dialog is `[role="dialog"]`; an open menu or popover is `[data-radix-popper-content-wrapper]`. Wait for the state before capturing (`assertPresent`, `assertSee`); assert that no skeleton is left (`assertNotPresent('.animate-pulse')` on the captured element) when the screen loads data.
- A picture wider than the article (46 rem) is fine, it is scaled down; a picture of a whole page is rarely what a sentence explains.
- Third-party screens (Slack's consent, the Atlassian console) are never captured: prose and a link.
- After the test passes, **open each new PNG and look at it** (the Read tool shows images): the right element, complete, no skeleton, no empty state unless that is the subject, English, real-looking text. Then run the test a second time: `git status` must show no change to the pictures.

---

### Task 1: Rebase, and a stub for every page

**Files:**
- Create: 74 files under `website/src/content/docs/` (the three seed pages exist)

**Interfaces:**
- Produces: every page id of the table below, so that any page may link to any other from now on. The stub body is the single line `This page is being written.`; the last task proves none is left.

- [ ] **Step 1: Rebase on the navigation redesign**

```bash
git log --oneline -1 navigation-redesign
git status --short | head
git rebase navigation-redesign
```

Expected: the rebase applies without conflict (this branch only adds `website/`, `tests/Browser/Docs/`, two files under `tests/Browser/Support/`, one line in `tests/BrowserTestCase.php` and files under `docs/superpowers/`). If `navigation-redesign` still has the same tip as this branch's base and the owner has not said the redesign is committed, stop and ask: pictures taken before it lands show the old navigation.

- [ ] **Step 2: Bring the worktree up to date and check both earlier plans still hold**

```bash
composer install --no-interaction && npm ci && npm run build
DB_CONNECTION=pgsql DB_DATABASE=testing vendor/bin/pest tests/Browser/Docs/CaptureDocsTest.php
(cd website && npm ci && npm test && ASTRO_TELEMETRY_DISABLED=1 npm run build)
```

Expected: 4 capture tests pass; 15 site tests pass; the site builds.

- [ ] **Step 3: Apply plan A's Task 5 if it was held back**

If `.dockerignore` has no `website` line, do steps 3 to 8 of plan A's Task 5 now.

- [ ] **Step 4: Create the stubs**

Save this as `/tmp/skrum-docs-stubs.mjs` (it is not committed) and run it from `website/` with `node /tmp/skrum-docs-stubs.mjs`:

```js
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const pages = {
    'getting-started': [
        ['introduction', 'Introduction', 'What Skrüm is, what it does, and where to start.'],
        ['quick-start', 'Quick start', 'From signing in to a finished retrospective with its actions.'],
        ['join-as-guest', 'Join as a guest', 'Join a session with a link or a code, without an account.'],
    ],
    accounts: [
        ['sign-in', 'Sign up and sign in', 'Create an account and sign in with a password, a magic link or your company account.'],
        ['two-factor-and-passkeys', 'Two-factor and passkeys', 'Add a second factor to your account, or sign in with a passkey.'],
        ['account-settings', 'Account settings', 'Your profile, password, sessions, notifications, language and appearance.'],
        ['api-tokens', 'API tokens', 'Create and revoke the tokens that let an AI assistant act for you.'],
        ['keyboard-shortcuts', 'Keyboard shortcuts', 'Every shortcut, the shortcuts dialog and the command menu.'],
    ],
    teams: [
        ['workspaces', 'Workspaces', 'What a workspace holds, who belongs to it and how to move around it.'],
        ['create-a-team', 'Create a team', 'Create a team and find your way around its page.'],
        ['members-and-roles', 'Members and roles', 'Who can do what in a team, and how to change it.'],
        ['invitations', 'Invitations and invite links', 'Invite people by e-mail or share a link that lets them join the team.'],
        ['team-settings', 'Team settings', 'Rename a team, change its address, or delete it.'],
        ['sprints', 'Sprints', 'Give the team sprints so that sessions and trends line up with them.'],
    ],
    retrospectives: [
        ['create-a-retro', 'Create a retro', 'Start a retrospective for your team from a template.'],
        ['templates', 'Templates', 'The 52 built-in templates and how to write your own.'],
        ['phases', 'Phases overview', 'The phases a retrospective moves through and who moves it.'],
        ['icebreaker', 'Icebreaker', 'Open the retrospective with a question or a short game.'],
        ['writing', 'Writing', 'Write cards in the columns, alone, before anyone reads them.'],
        ['grouping', 'Grouping', 'Bring together the cards that say the same thing and name the group.'],
        ['voting', 'Voting', 'Give each person a number of votes and find what the team wants to talk about first.'],
        ['discussion', 'Discussion', 'Go through the cards by votes, comment, and keep notes.'],
        ['actions', 'Actions', 'Turn what was said into action items with an owner and a due date.'],
        ['roti-and-close', 'ROTI and close', 'Ask whether the time was well spent, then close the retrospective.'],
        ['facilitating', 'Facilitating', 'The timer, the highlight, the session settings and handing over the facilitator role.'],
        ['summary-and-sharing', 'Summary and sharing', 'Read the summary of a finished retrospective and send its results.'],
        ['rituals', 'Rituals and retro settings', 'Set what every retrospective of the team starts with.'],
    ],
    'action-items': [
        ['track', 'Track action items', 'Follow what was decided, across every session of the workspace.'],
        ['reminders-and-recurrence', 'Reminders and recurrence', 'Let Skrüm remind the owners, and repeat an action on a schedule.'],
        ['export-and-sync', 'Export and tracker sync', 'Export action items to a file, or to Jira, Linear and GitHub, and keep their status in step.'],
    ],
    'planning-poker': [
        ['start-a-game', 'Start a game', 'Open a planning poker game and bring the team in.'],
        ['tasks-and-imports', 'Tasks and imports', 'Add the tasks to estimate, by hand or from your tracker.'],
        ['voting-and-reveal', 'Voting and reveal', 'Vote in secret, reveal together, and settle on an estimate.'],
        ['decks', 'Decks', 'The built-in decks and how to make one for your team.'],
        ['estimates-history', 'Estimates history', 'Find what the team estimated, game after game.'],
    ],
    whiteboard: [
        ['basics', 'Whiteboard basics', 'Open a whiteboard, move around it and work on it together.'],
        ['tools', 'Tools and elements', 'Sticky notes, shapes, text, arrows and files, and what you can do with a selection.'],
        ['templates', 'Whiteboard templates', 'Start a whiteboard from one of the built-in templates.'],
        ['export', 'Export a whiteboard', 'Save a whiteboard as a picture or as a file you can open again.'],
    ],
    surveys: [
        ['create-a-survey', 'Create a survey', 'Write a survey, open it to the team and close it.'],
        ['health-check-pulse-enps', 'Health check, pulse and eNPS', 'The three ready-made surveys and what each one measures.'],
        ['results', 'Results and comparison', 'Read the answers, compare them with the previous survey and export them.'],
    ],
    games: [
        ['overview', 'Games overview', 'Start a game for the team and let everyone join.'],
        ['word-and-drawing-games', 'Word and drawing games', 'The games where the team guesses a word, a drawing or a GIF.'],
        ['conversation-games', 'Conversation games', 'The games that get people talking about themselves and their mood.'],
    ],
    insights: [
        ['insights', 'Team insights', 'What the team page and the insights page tell you about your rituals.'],
        ['health-and-enps-trends', 'Health and eNPS trends', 'Follow the team’s health check and eNPS from one sprint to the next.'],
        ['activity-and-data', 'Activity and data', 'See what happened in the team, and what data it holds.'],
    ],
    integrations: [
        ['overview', 'Integrations overview', 'What Skrüm connects to, who sets it up, and what each integration can do.'],
        ['slack', 'Slack', 'Post session links and results to a Slack channel.'],
        ['microsoft-teams', 'Microsoft Teams', 'Post session links and results to a Teams channel.'],
        ['mattermost', 'Mattermost', 'Post session links and results to a Mattermost channel.'],
        ['telegram', 'Telegram', 'Post session links and results to a Telegram chat.'],
        ['jira-cloud', 'Jira Cloud', 'Import issues into planning poker, write estimates back and export action items to Jira Cloud.'],
        ['jira-data-center', 'Jira Data Center', 'Connect a Jira Data Center server with OAuth 2.0 or personal access tokens.'],
        ['linear', 'Linear', 'Import issues into planning poker, write estimates back and export action items to Linear.'],
        ['github', 'GitHub', 'Import issues into planning poker, write estimates back and export action items to GitHub Issues.'],
        ['webhooks', 'Webhooks', 'Send Skrüm’s events to an address of your own, signed.'],
    ],
    mcp: [
        ['connect', 'Connect an AI assistant', 'Give an assistant such as Claude access to your retrospectives and poker games.'],
        ['tools', 'Tools reference', 'Every tool the MCP server offers, and the scope each one needs.'],
        ['prompts', 'Prompts', 'The ready-made prompts the MCP server offers.'],
    ],
    'self-hosting': [
        ['requirements', 'Requirements', 'What you need before installing Skrüm.'],
        ['install', 'Install with Docker', 'Start a Skrüm instance from the published image with Docker Compose.'],
        ['configuration', 'Configuration reference', 'Every environment variable, and the settings that Administration overrides.'],
        ['database', 'Database', 'Choose between PostgreSQL, MariaDB, MySQL and SQLite.'],
        ['processes', 'Processes and status', 'What runs inside the container and how to tell it is healthy.'],
        ['upgrading', 'Upgrading', 'Back up, pull the new image and let Skrüm migrate.'],
    ],
    administration: [
        ['general-and-branding', 'General and branding', 'Name the instance and give it your logos, your colour and your GIF provider.'],
        ['sign-in-and-sso', 'Sign-in and SSO', 'Decide who may sign up, and connect Google, GitHub, Microsoft Entra or an OpenID Connect provider.'],
        ['mail', 'Mail', 'Point Skrüm at your SMTP server and send a test message.'],
        ['integration-apps', 'Integration apps', 'Enter the credentials each integration needs before a team can connect it.'],
        ['users-and-admins', 'Users and admins', 'Find a user, deactivate an account, and name the instance admins.'],
        ['mcp-keys', 'MCP keys', 'Create the keys that give an AI assistant access at the level of the instance.'],
        ['licence-and-updates', 'Licence and updates', 'Read the licence and check whether a newer version exists.'],
        ['audit-log', 'Audit log', 'See who changed what in the instance’s settings.'],
    ],
    reference: [
        ['roles-and-permissions', 'Roles and permissions', 'What each workspace role, team role and the instance admin may do.'],
        ['webhook-events', 'Webhook events', 'Every event Skrüm sends, with its body.'],
    ],
};

let created = 0;

for (const [section, entries] of Object.entries(pages)) {
    mkdirSync(`src/content/docs/${section}`, { recursive: true });

    entries.forEach(([slug, title, description], index) => {
        const file = `src/content/docs/${section}/${slug}.md`;

        if (existsSync(file)) {
            return;
        }

        writeFileSync(file, `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description)}\norder: ${index + 1}\n---\n\nThis page is being written.\n`);
        created++;
    });
}

console.log(`${created} stubs created, ${Object.values(pages).flat().length} pages in all`);
```

Expected: `74 stubs created, 77 pages in all`.

- [ ] **Step 5: Build and commit**

```bash
(cd website && ASTRO_TELEMETRY_DISABLED=1 npm run build) && find website/src/content/docs -name '*.md' | wc -l
git add website/src/content/docs
git commit -m "docs(website): every page of the documentation, as a stub with its title and place

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected: the build passes; `77`.

---

## The section tasks

Tasks 2 to 16 have the same five steps. They are written once here with `<section>` and `<Area>`; each task below gives its values, its pages, its pictures and where to look.

- [ ] **Step 1: Read.** Read the sources the task names, in the code of this branch. For every page, list the labels, roles, limits and options you will state, each with the file that proves it.
- [ ] **Step 2: Write the pages.** Replace the stub body of each page of the section, following "How a page is written" and the task's "must cover" list. Reference each picture where the text needs it.
- [ ] **Step 3: Take the pictures.** Write `tests/Browser/Docs/<Area>DocsTest.php` following "How a picture is taken", then:

  ```bash
  DB_CONNECTION=pgsql DB_DATABASE=testing vendor/bin/pest tests/Browser/Docs/<Area>DocsTest.php
  ```

  Open and look at every new PNG. Run the command a second time; `git status --short website/src/assets` must list no modified picture.
- [ ] **Step 4: Build.**

  ```bash
  (cd website && ASTRO_TELEMETRY_DISABLED=1 npm run build)
  grep -c 'This page is being written' website/src/content/docs/<section>/*.md
  vendor/bin/pest tests/Arch
  ```

  Expected: the build passes (every picture exists, has a text and is used; every link resolves); each count is `0`; the arch tests pass. If the task added outbound links: `(cd website && npm run check:external)` reports no failure.
- [ ] **Step 5: Commit.**

  ```bash
  vendor/bin/pint --dirty --format agent
  git add website/src/content/docs/<section> website/src/assets/screenshots/<section> tests/Browser/Docs/<Area>DocsTest.php
  git commit -m "docs(website): <what the section now explains, in the repository's sentence style>

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
  ```

  The commit body lists what you could not check or could not picture, and why.

The picture counts are estimates. A page gets the pictures that help and no others; a picture that the list names but that would show nothing useful is dropped and said so in the commit body.

---

### Task 2: Getting started

`<section>` = `getting-started`, `<Area>` = `GettingStarted`.

**Sources:** `routes/web.php` (`home`, `dashboard`, `joinCodes.*`, `retros.join.*`, `poker.join.*`, `whiteboards.*` join, `games.join.*`), `resources/js/pages/workspaces/show.tsx`, `resources/js/pages/sessions/join-code.tsx`, `resources/js/pages/retros/join.tsx`, `resources/js/components/teams/session-create/`, `app/Enums/RetroPhase.php`, `README.md`. Fixtures: `DocsWorld`, `joinAsGuest`, `boardCard` (`tests/Pest.php`).

| Page | Must cover | Pictures (`getting-started/…`) |
|---|---|---|
| `introduction` | What Skrüm is; each module in a sentence with a link to its section; who the sections are for; where to start as a user and as a host. Keep the seed page's verified facts | `workspace-home` (the workspace home of Nordlys with the Atlas team and recent sessions) |
| `quick-start` | The shortest true path from a signed-in member to a finished retro: open the team, start a retro from a template, share the link, write, vote, add an action, close. Each step links to its page in Retrospectives | `new-session` (the control that starts a session on the team page), `board-writing` (a board in the writing phase with a few cards), `board-actions` (the actions phase with two action items) |
| `join-as-guest` | Joining by link and by code (`/join`); what a guest is asked (name, colour if any); what a guest can and cannot do; that guests exist for retros, poker, whiteboards, surveys and games (state only those the code allows); what the host must enable | `join-code` (the code page), `guest-join` (a retro's join page), `guest-on-board` (the board as the guest sees it) |

### Task 3: Accounts

`<section>` = `accounts`, `<Area>` = `Accounts`.

**Sources:** `config/fortify.php`, `app/Providers/FortifyServiceProvider.php`, `app/Enums/SignupMode.php`, `resources/js/pages/auth/*.tsx`, `resources/js/pages/settings/account.tsx` and the components it renders, `routes/settings.php`, `routes/web.php` (`magicLinks.*`, `sso.*`, `twoFactor.*`), `app/Notifications/`, `resources/js/lib/shortcuts/sections.ts`, `resources/js/components/workspaces/keyboard-shortcuts-dialog.tsx`, `command-menu.tsx`. Fixtures: read `tests/Browser/Visual/SettingsPagesVisualTest.php` (it pins a two-factor secret and a token so that the picture does not change) and the access pages' visual test.

| Page | Must cover | Pictures (`accounts/…`) |
|---|---|---|
| `sign-in` | Signing up under each sign-up mode (open, by invitation, by e-mail domain) as the person experiences it; e-mail verification; signing in with a password, a magic link, a company account (the buttons an admin enabled); forgotten password. Link to Administration → Sign-in and SSO for the host's side | `login` (the sign-in page with SSO buttons enabled through `storeConfiguration`), `register`, `magic-link` |
| `two-factor-and-passkeys` | Turning on an authenticator app, the e-mail code alternative, recovery codes and what to do when they are lost; adding and removing a passkey; what the challenge looks like at sign-in | `two-factor-setup` (the QR code step, secret pinned), `recovery-codes`, `passkeys`, `two-factor-challenge` |
| `account-settings` | Each section of the one settings page: profile and photo, password, browser sessions, linked accounts, notifications (the three preferences and what each mail or bell item is), language, appearance, reduced motion; deleting the account if the page offers it | `profile`, `security`, `notifications`, `appearance` |
| `api-tokens` | What a token is for; creating one with its scopes (`mcp:read`, `mcp:write`, `mcp:delete`); that it is shown once; revoking; link to AI assistants → Connect | `tokens` (the list with one token), `token-created` (the dialog showing a pinned token) |
| `keyboard-shortcuts` | Every shortcut of `sections.ts`, in a table per section, exactly as the dialog lists them, with the count; how to open the dialog and the command menu; the shortcut preference if there is one | `shortcuts-dialog`, `command-menu` |

### Task 4: Workspaces and teams

`<section>` = `teams`, `<Area>` = `Teams`.

**Sources:** `resources/js/pages/workspaces/{show,create,members}.tsx`, `resources/js/pages/teams/{show,members,settings,sprints,sessions}.tsx`, `resources/js/pages/invitations/show.tsx`, `resources/js/pages/invite-links/show.tsx`, `app/Enums/{WorkspaceRole,TeamRole}.php`, `app/Policies/{WorkspacePolicy,TeamPolicy}.php`, `routes/web.php` (`workspaces.*`, `teams.*`, `teamAddresses.show`, `invitations.*`, `inviteLinks.*`, `search.index`, `notifications.*`). Fixtures: `teamMember`, `workspaceManager`, `teamSprint`; `tests/Browser/Visual/TeamPageVisualTest.php` builds a full team page.

| Page | Must cover | Pictures (`teams/…`) |
|---|---|---|
| `workspaces` | What a workspace is; its home; the three workspace roles; its members page; creating a second workspace and switching; search; recent sessions; the bell | `workspace-members`, `search` |
| `create-a-team` | Who may create a team; creating it; a tour of the team page (sessions, actions, pulse, activity); the team's short address `/t/<slug>` | `team-create`, `team-page` |
| `members-and-roles` | The four team roles in a table of what each may do (from `TeamPolicy`); changing a role; removing a member; access requests and answering them | `team-members`, `role-menu` |
| `invitations` | Inviting by e-mail with a role and a message; what the invited person sees; accepting and declining; pending invitations, resending, revoking; the invite link, its expiry, replacing it and turning it off | `invite-dialog`, `invite-link`, `invitation-page` (signed out, through `docsOpen`) |
| `team-settings` | Each setting of the team's settings page as built; renaming and the address; deleting and what is lost | `team-settings` |
| `sprints` | What a sprint is used for in Skrüm; creating, starting and numbering sprints; where sprints show up (sessions, trends) | `sprints` |

### Task 5: Retrospectives

`<section>` = `retrospectives`, `<Area>` = `Retrospectives`.

**Sources:** `app/Enums/RetroPhase.php`, `resources/js/pages/retros/{show,join,session-ended}.tsx` and the components of the board (`resources/js/components/retro*/`, `resources/js/components/skrum/`), `routes/web.php` (`retros.*`), `lang/en/templates.php`, `resources/js/pages/workspaces/templates.tsx`, `resources/js/pages/teams/retro-settings.tsx`, `app/Support/Llm/`, `app/Mail/` (retro results). Pointers, not truth: `docs/superpowers/research/coverage/retro.md`, `docs/superpowers/walkthroughs/`. Fixtures: `boardCard`, `topicCard`, `attachHealthCheck`, `answerHealthCheck`, `configureLlm`, `fakeLlmReply`; `tests/Browser/Visual/RetroPagesVisualTest.php` builds a board in each phase (its names are stress data: set your own).

Write one file-local `docsRetro(DocsWorld $world, RetroPhase $phase): Retro` that every test of the file starts from: title "Sprint 42 retrospective", a three-column template, eight realistic cards spread over the columns and written by people of the story, two of them anonymous if the application supports it.

| Page | Must cover | Pictures (`retrospectives/…`) |
|---|---|---|
| `create-a-retro` | Who may start one; starting from the team page; title, template, the options offered at creation; where the join link is | `new-retro`, `template-picker` |
| `templates` | The built-in templates in a table per category (name, columns), read from `lang/en/templates.php`, with the count per category and in all; writing, editing and deleting a custom template in the workspace's templates page, and who may | `templates-page`, `template-editor` |
| `phases` | Each phase in one sentence, in order, with a link to its page; who moves the board to the next phase; going back; what "completed" freezes | `phase-bar` |
| `icebreaker` | What the phase offers as built; skipping it | `icebreaker` |
| `writing` | Adding, editing, deleting a card; what others see while you write; anonymity as built; reactions and GIFs if built; managing columns | `writing-column`, `card-composer` |
| `grouping` | Grouping by dragging and by keyboard; naming a group; suggested names when a language model is configured; ungrouping | `group`, `group-name-suggestion` |
| `voting` | The number of votes and who sets it; voting and taking a vote back; what stays hidden; how the facilitator sees that everyone voted | `voting-column`, `votes-left` |
| `discussion` | The order of discussion; the highlight everyone follows; comments, reactions, notes | `discussion-highlight`, `card-comments` |
| `actions` | Creating an action item from the board: title, owner, due date, priority; suggested actions when a language model is configured, promoting and rejecting one; link to Action items | `actions-panel`, `suggested-actions` |
| `roti-and-close` | The ROTI vote and its reveal; nudging those who have not voted; the health check or survey inside a retro if built; completing; what a participant sees after the end | `roti-vote`, `roti-results`, `session-ended` |
| `facilitating` | The timer (start, pause, extend); session settings; handing over the facilitator role; inviting and guest access; sharing the link to a channel | `timer`, `session-settings`, `facilitator-menu`, `share-dialog` |
| `summary-and-sharing` | The summary of a finished retro, with and without a language model; sending the results by mail and to a channel; where finished retros are found | `summary`, `send-results` |
| `rituals` | Each setting of the team's retro settings page as built (rituals, facilitators, default template) and who may change them | `retro-settings` |

### Task 6: Action items

`<section>` = `action-items`, `<Area>` = `ActionItems`.

**Sources:** `resources/js/pages/action-items/index.tsx` and its components, `app/Models/ActionItem.php`, the enums for status, priority and recurrence, `routes/web.php` (`workspaces.actionItems.*`), `app/Http/Controllers/WorkspaceActionItemCsvExportsController.php`, `app/Mail/` and `app/Notifications/` (reminder, digest), `routes/console.php` (when reminders are sent), `app/Enums/IntegrationCapability.php`. Fixtures: `statusSyncLink`, `jiraCreateMeta`, `fakeJiraTrackerApi`.

| Page | Must cover | Pictures (`action-items/…`) |
|---|---|---|
| `track` | Where action items come from; the workspace list and its filters; status, priority, owner, due date; comments and subtasks; changing or deleting several at once | `list`, `detail`, `bulk-bar` |
| `reminders-and-recurrence` | When and to whom reminders are sent (read the schedule); the digest; turning them off (preferences, the unsubscribe link); the recurrences offered and what a recurrence creates | `recurrence` |
| `export-and-sync` | The CSV export and its columns; exporting an item to Jira, Linear or GitHub; the link back; status sync and its mapping; what happens when the issue is closed on the other side. Links to each integration page | `export-menu`, `tracker-link` |

### Task 7: Planning poker

`<section>` = `planning-poker`, `<Area>` = `PlanningPoker`.

**Sources:** `resources/js/pages/poker/{show,join,decks,estimates}.tsx` and their components, `app/Enums/PokerDeck.php`, `routes/web.php` (`poker.*`, `teams.pokerDecks.*`, `teams.estimates.index`, `workspaces.pokerDecks.*`). Fixtures: `openPokerRound`, `pokerVote`, `fakePokerRoster`, `importedPokerTask`, `fakeJiraTrackerApi`; `tests/Browser/Visual/PokerPagesVisualTest.php` (`pokerVisualGame`, `pokerVisualPlayedRounds`).

| Page | Must cover | Pictures (`planning-poker/…`) |
|---|---|---|
| `start-a-game` | Who may start a game; creating it; inviting, guests and spectators; the facilitator and handing over | `new-game`, `room` |
| `tasks-and-imports` | Adding tasks by hand; importing from Jira, Linear or GitHub (sources, sprints or iterations); what an imported task keeps of its issue | `tasks`, `import-dialog` |
| `voting-and-reveal` | Voting; what the others see; revealing, automatic reveal, the timer; the spread of votes; setting the estimate; writing it back to the tracker and the conflict case | `voting`, `revealed`, `estimate-conflict` |
| `decks` | The 5 built-in decks and their cards, read from `PokerDeck`; making a deck for the team or the workspace | `decks` |
| `estimates-history` | The team's estimates page | `estimates` |

### Task 8: Whiteboard

`<section>` = `whiteboard`, `<Area>` = `Whiteboard`.

**Sources:** `resources/js/pages/whiteboards/{show,join}.tsx`, `resources/js/components/whiteboard/` (toolbar, `canvas-selection.tsx`, `board-header.tsx`, `read-mode-toggle.tsx`, `export-dialog.tsx`, `scene-export.tsx`), `resources/js/components/skrum/whiteboard-selection-bar.tsx`, `lang/en/whiteboards.php`, `routes/web.php` (`whiteboards.*`, `workspaces.whiteboardTemplates.*`). Voting, private writing and version history were removed at the owner's request: do not document them. Fixtures: `whiteboardWithFacilitator`, `sceneElement`, `tests/Browser/Support/InteractsWithWhiteboards.php` (`addWhiteboardElement`, `writeWhiteboardElements`).

| Page | Must cover | Pictures (`whiteboard/…`) |
|---|---|---|
| `basics` | Creating a whiteboard; moving and zooming; who is here and live cursors; the facilitator; the timer; read mode; duplicating; inviting and guests | `board`, `header` |
| `tools` | Each tool of the toolbar as built; what the selection bar offers for one element and for several; adding a file or an image | `toolbar`, `selection-bar`, `sticky-note` |
| `templates` | The 8 built-in templates by name, read from `lang/en/whiteboards.php`; applying one; workspace templates if built | `template-picker` |
| `export` | PNG, SVG and the data file; what each contains; opening a data file again if built | `export-dialog` |

### Task 9: Surveys

`<section>` = `surveys`, `<Area>` = `Surveys`.

**Sources:** `resources/js/pages/surveys/{show,edit,results,join}.tsx`, the survey template enum, `routes/web.php` (`surveys.*`), `app/Http/Controllers/TeamSurveys/`. Fixtures: `answerSurvey`, `surveyMember`; the surveys' visual test.

| Page | Must cover | Pictures (`surveys/…`) |
|---|---|---|
| `create-a-survey` | Creating a survey; the kinds of question; opening, closing, duplicating; who answers and whether answers are anonymous, as built; guests | `editor`, `question-types`, `answering` |
| `health-check-pulse-enps` | The three ready-made surveys: what each asks and how its score is computed | `template-choice` |
| `results` | Reading the results; the comparison with the previous survey; the CSV export and its columns | `results`, `comparison` |

### Task 10: Games

`<section>` = `games`, `<Area>` = `Games`.

**Sources:** `app/Enums/GameKind.php` (draw, gif, hangman, decoded, two_truths, mood, guess_who, quick_question), `resources/js/pages/games/{index,show,join}.tsx` and one component folder per game, `routes/web.php` (`teams.games.*`, `games.*`). Fixtures: `wordGuessTable`, `activeGameRound`, `fakeGameRoster`, `fakeVisualGifs`, `gifAnswer`.

Put each of the eight games on one of the two game pages by reading what it is; every game is on exactly one page, with one section and one picture.

| Page | Must cover | Pictures (`games/…`) |
|---|---|---|
| `overview` | Where games are; starting one; the join link and guests; rounds and scores as built; that the GIF game needs a GIF provider set by the admin | `index`, `lobby` |
| `word-and-drawing-games` | For each game on this page: the goal, a round step by step, how it ends | one picture per game, named after its kind |
| `conversation-games` | The same, for the other games | one picture per game, named after its kind |

### Task 11: Team insights

`<section>` = `insights`, `<Area>` = `Insights`.

**Sources:** `resources/js/pages/teams/{insights,enps,activity,health-check,health-statements,data}.tsx` and their components, `routes/web.php` (`teams.insights.show`, `teams.enps.show`, `teams.activity.index`, `teams.healthCheck.show`, `teams.healthStatements.*`, `teams.data.show`). Fixtures: `healthScores`, `attachHealthCheck`, `answerHealthCheck`, `closeHealthCheck`, `travelTo`; `tests/Browser/Visual/TeamWorkspaceDataVisualTest.php`.

| Page | Must cover | Pictures (`insights/…`) |
|---|---|---|
| `insights` | Each chart or figure of the insights page: what it counts and over which period | `insights`, `roti-trend` |
| `health-and-enps-trends` | The health check page and its statements (editing them, who may); the eNPS page; how each score is computed | `health-check`, `health-statements`, `enps` |
| `activity-and-data` | What the activity page records; each thing the data page offers as built | `activity`, `data` |

### Task 12: Integrations

`<section>` = `integrations`, `<Area>` = `Integrations`. This task adds outbound links: run `npm run check:external`.

**Sources:** spec §7 (outline §7.1, the table §7.2, the rule §7.4) and, for the truth, `app/Enums/{IntegrationProvider,IntegrationCapability,WebhookEvent}.php`, `config/services.php`, `.env.example` (lines on integrations), `app/Support/InstanceConfiguration/ConfigurationCatalogue.php`, `app/Actions/Admin/PresentIntegrationSettings.php`, `resources/js/components/admin/integrations/integration-app-dialog.tsx`, `resources/js/components/integrations/*.tsx`, `resources/js/pages/teams/integrations.tsx`, `routes/web.php` (callbacks and `teams.integrations.*`), `routes/webhooks.php`, `app/Support/Integrations/` (clients: scopes; `Inbound/ReadInboundEvent.php`: how inbound webhooks are verified; the webhook client, message and delivery jobs: headers, body, retries). Fixtures: `enableIntegrations`, `integrationOAuthSession`, `tests/Browser/Support/InteractsWithIntegrations.php`, `outgoingWebhookResolves`, `fakeJiraTrackerApi`, `fakeLinearGraphql`, `fakeGitHubTrackerApi`, `storeConfiguration`.

Each of the eight vendor pages has the ten parts of spec §7.1, in that order, as `h2`: What it does · Who can set it up · Before you start · On the vendor's side · In Skrüm, Administration · In the team's Integrations page · Test it · Troubleshooting · Disconnecting · Official documentation. Every callback and webhook address, scope, permission and event of the provider's row in §7.2 is written out in a code span; every Skrüm field is named by its label with its environment variable beside it. Before linking a vendor page, fetch it and read it; if it does not describe the step, find the vendor's page that does and use that one. "Before you start" says what the provider needs from the instance (Slack: an HTTPS redirect address) and what changes on a private network (no inbound webhooks; Skrüm polls every `INTEGRATIONS_POLL_MINUTES`).

| Page | Must cover beyond the outline | Pictures (`integrations/…`) |
|---|---|---|
| `overview` | Instance level and team level and who acts at each; a table of the nine providers against the capabilities, from `IntegrationProvider::capabilities()`; inbound webhooks against polling and what decides (`INTEGRATIONS_INBOUND_WEBHOOKS`, a public HTTPS `APP_URL`) | `admin-integrations` (Administration → Integrations), `team-integrations` (a team's page with two connected) |
| `slack` | The scope `incoming-webhook`; that Slack asks for the channel; **Reconnect** to change it | `slack-app` (the admin dialog), `slack-card` (the connected card) |
| `microsoft-teams` | The workflow to add in Teams; the hosts accepted and **Allowed hosts** | `teams-dialog` |
| `mattermost` | The address format accepted | `mattermost-dialog` |
| `telegram` | One bot per instance, no webhook on it; the connect code and its 15 minutes; channels need the bot as administrator | `telegram-connect` |
| `jira-cloud` | Read only against read and write and the scopes of each; the site choice; the story points field; priority, people and status mapping; that Skrüm registers its webhooks itself; revoking on Atlassian's side | `jira-app`, `jira-card` |
| `jira-data-center` | The two ways (incoming link from Jira 8.22, personal access token from 8.14); the webhook a Jira administrator may have to add, with the values the card shows | `jira-dc-app`, `jira-dc-webhook` |
| `linear` | The webhook to create by hand and its secret; which resource types to tick (read the inbound handler before stating it) | `linear-app`, `linear-card` |
| `github` | That it is a GitHub App, on github.com only; each permission and event; the private key; installing it on the organisation; the repository, labels and sign-in mapping | `github-app`, `github-card` |
| `webhooks` | The whole contract from the code: headers, signature with a verification example in one language, body, the events a team can turn on, retries, `429` and `410`, automatic turn-off and **Re-enable**, **Rotate secret**, the delivery log and redelivery. Link to Reference → Webhook events | `webhook-secret`, `webhook-events`, `delivery-log` |

### Task 13: AI assistants

`<section>` = `mcp`, `<Area>` = `Mcp`. This task adds outbound links only if it names a client's documentation.

**Sources:** `routes/ai.php`, `app/Mcp/` (server, every tool and prompt class, scopes), `README.md` ("Connect an AI assistant"), `resources/js/pages/admin/mcp-keys.tsx`, the API tokens section of `resources/js/pages/settings/account.tsx`.

| Page | Must cover | Pictures (`mcp/…`) |
|---|---|---|
| `connect` | What an assistant can do once connected; the address `/mcp`; creating a token with its scopes; the client configuration the README gives; what stays hidden from an assistant; that there is no OAuth | `token-scopes` (the token dialog with the three scopes) |
| `tools` | Every tool registered in `app/Mcp`, in one table per family (retro, poker): name, what it does, the scope it needs; the count | none |
| `prompts` | Each prompt: its name, its arguments, what it asks the assistant to do | none |

Check the counts against the code: list the tool classes the server registers and the rows of your tables, and make them equal.

### Task 14: Self-hosting

`<section>` = `self-hosting`, `<Area>` = `SelfHosting`. This task adds outbound links.

**Sources:** `README.md` (whole), `.env.example`, `.env.production.example`, `config/skrum.php`, `compose.production.yaml`, `compose.production.mariadb.yaml`, `compose.production.sqlite.yaml`, `Dockerfile`, `docs/database.md`, `routes/console.php`, `routes/status.php`, `resources/views/status.blade.php`, `resources/views/errors/503.blade.php`, `app/Support/Llm/Llm.php`.

| Page | Must cover | Pictures (`self-hosting/…`) |
|---|---|---|
| `requirements` | Docker and Compose; a database among the four; a public address and HTTPS (what needs it); SMTP (what needs it); what is optional (language model, GIF provider) | none |
| `install` | Keep the seed page's commands, each of which is a line of `src/snippets/install.sh` (the build checks it). Add: Caddy and `SERVER_NAME`, ports, volumes, `--env-file`, the first account becoming instance admin | none |
| `configuration` | Every variable of `.env.production.example` and the commented groups of `.env.example`, in tables by topic: name, default, what it does. The rule that a value stored in Administration wins. AI features: `SKRUM_LLM_PROVIDER`, key, model, base address, with the two links of spec §7.3. Sign-up mode. Inbound webhooks and polling | none |
| `database` | Choosing an engine and the Compose file for each, from `docs/database.md` | none |
| `processes` | What runs (web server, realtime server, queue, scheduler) and what the scheduler does; the status page | `status` (the `/status` page, signed out, through `docsOpen`) |
| `upgrading` | Backing up; pulling and recreating; the maintenance page; the update check; the notes for older versions that the README gives | `maintenance` (only if the 503 page can be shown without changing application state for other tests; otherwise none) |

### Task 15: Administration

`<section>` = `administration`, `<Area>` = `Administration`. This task adds outbound links.

**Sources:** `resources/js/pages/admin/*.tsx` and their components, `routes/admin.php`, `app/Support/InstanceConfiguration/`, `config/services.php` (SSO), `routes/web.php` (`sso.*`, the callback `auth/{provider}/callback`), `.env.example` (SSO lines). Fixtures: read `tests/Browser/Visual/AdminPagesVisualTest.php` for how an instance admin reaches these pages through the form and the password confirmation (`adminVisualVisit`); `storeConfiguration`; fake the update feed with `Http::fake`.

| Page | Must cover | Pictures (`administration/…`) |
|---|---|---|
| `general-and-branding` | Each field of the General and Branding pages; logos for light and dark, colour, radius, favicon, the "powered by" line; the GIF provider with the two links of spec §7.3 | `general`, `branding` |
| `sign-in-and-sso` | Sign-up modes from the host's side; per provider (Google, GitHub, Microsoft Entra, OpenID Connect): what to create at the provider, the redirect address in a code span, each field by its label with its environment variable, **Test the connection**, and the links of spec §7.3 (read each before linking). The scopes requested, read in `vendor/`. The default workspace for new SSO accounts if built | `sign-in`, `sso-provider` |
| `mail` | Each field; the encryption choices; **Send a test email**; what goes to the log when mail is not set | `mail` |
| `integration-apps` | The page as a whole: enabling a provider, the **Configure** dialog, the copyable callback and webhook addresses; one line per provider linking to its page in Integrations | `integration-apps` |
| `users-and-admins` | Finding a user; deactivating and reactivating; adding and removing an instance admin; what a deactivated person can no longer do | `users`, `admins` |
| `mcp-keys` | What an instance key is against a personal token; creating and revoking | `mcp-keys` |
| `licence-and-updates` | What the page shows; checking for an update | `licence` |
| `audit-log` | What is recorded and for how long, as built; reading an entry | `audit-log` |

### Task 16: Reference

`<section>` = `reference`, `<Area>` = none (no picture, no test file: skip step 3 and leave the test file out of the commit).

**Sources:** `app/Policies/*.php`, `app/Enums/{WorkspaceRole,TeamRole}.php`, `app/Models/User.php` (role helpers), `app/Enums/WebhookEvent.php`, the webhook message class and the tests that assert each event's body (`tests/Feature/` on webhooks).

| Page | Must cover |
|---|---|
| `roles-and-permissions` | One table per level (workspace, team, instance): the actions in rows, the roles in columns, each cell read from a policy method. Guests in a last table |
| `webhook-events` | For each event of `WebhookEvent`, and for the share and test events the client sends: when it is sent, and a real example of its body taken from a test or built by running the message class in a test |

---

### Task 17: Read the whole site

**Files:**
- Modify: any page, to fix what this pass finds
- Modify: `docs/superpowers/specs/2026-10-06-public-docs-site-design.md` only if the site differs from it for a stated reason

- [ ] **Step 1: Nothing is left as a stub, nothing is missing**

```bash
grep -rl 'This page is being written' website/src/content/docs | wc -l
find website/src/content/docs -name '*.md' | wc -l
grep -rnE 'TODO|TBD|P[0-9]{2}[a-z]?-[0-9]+|[Pp]lan [0-9]{1,2}\b' website/src tests/Browser/Docs | head
```

Expected: `0`, `77`, no line.

- [ ] **Step 2: One vocabulary**

Read every page's first paragraph and headings in one sitting and make these the same everywhere: "retrospective" at first mention on a page, then "retro"; "action item"; "planning poker"; "whiteboard"; "workspace"; "team"; "guest"; "instance admin"; "facilitator". A feature has one name: the label of the interface.

- [ ] **Step 3: Cross-links**

For each page, check that the pages it depends on and the pages that continue it are linked, in the text or in `related`. Links to a heading of another section are allowed from now on (the checker verifies the fragment).

- [ ] **Step 4: Ten pages against the running application**

Pick ten pages at random (`find website/src/content/docs -name '*.md' | sort -R | head -10`). For each, follow it step by step in the application of this branch (`composer run dev`, with the story of `DocsWorld` or the demo seeder) and correct every label, step or role that differs. If more than two of the ten needed a correction of substance, do ten more.

- [ ] **Step 5: Catalogues**

Count, in the code and in the page, and make them equal: retro templates (`lang/en/templates.php`), whiteboard templates (`lang/en/whiteboards.php`), poker decks (`app/Enums/PokerDeck.php`), shortcuts (`resources/js/lib/shortcuts/sections.ts`), MCP tools and prompts (`app/Mcp`), webhook events (`app/Enums/WebhookEvent.php`), integration providers (`app/Enums/IntegrationProvider.php`).

- [ ] **Step 6: Every picture, twice**

```bash
npm run build
DB_CONNECTION=pgsql DB_DATABASE=testing vendor/bin/pest tests/Browser/Docs
DB_CONNECTION=pgsql DB_DATABASE=testing vendor/bin/pest tests/Browser/Docs
git status --short
```

Expected: both runs pass; after the second, `git status` lists nothing. A picture that changes between two runs is a page that still moves when it is captured: fix the wait in its test, not the comparison.

- [ ] **Step 7: The site and the gates**

```bash
(cd website && npm test && ASTRO_TELEMETRY_DISABLED=1 npm run build && npm run check:external)
vendor/bin/pest tests/Arch
vendor/bin/pint --dirty --format agent
composer ci:check
```

Expected: all pass; the outbound check lists no failure (hosts that refuse scripts are listed apart).

- [ ] **Step 8: Look at it**

`npm run preview` in `website/` (Astro 7 starts it detached; stop it afterwards with `npx astro preview stop` and confirm that `lsof -nP -iTCP:4321 -sTCP:LISTEN` prints nothing). Read the landing, the documentation index, one page of each of the 15 sections, in light and dark, at 1440 and 390 px. Search for "planning poker", "webhook", "invite": each lists a page of the right section.

- [ ] **Step 9: Commit**

```bash
git add website tests/Browser/Docs docs/superpowers/specs/2026-10-06-public-docs-site-design.md
git commit -m "docs(website): one vocabulary, cross-links and catalogues checked across the documentation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Then ask the owner to run the complete suite (`php artisan test --compact`, and `composer test:browser`), to turn GitHub Pages on, and to decide when to push.

---

## Self-review

- Spec §6 (15 sections, 77 pages, rules for every page): Task 1 creates them, Tasks 2 to 16 write them, "How a page is written" carries the rules.
- §7.1 to §7.4 (integration pages, links): Task 12; §7.3 rows: Tasks 14 (AI features) and 15 (SSO, GIFs).
- §5.6 (one test file per section, story, selectors, fakes): "How a picture is taken" and each task's fixtures.
- Criterion 9: Task 17 step 1. Criterion 10: Task 12 and Task 15. Criterion 11: Task 17 step 7. Criterion 12: Task 17 step 5. Criterion 13: Task 17 step 6. Criterion 14: every task's step 4 (`tests/Arch`). Criterion 17: Task 17 step 1.
- The spec said the section tasks run in parallel. They run one at a time: one test database, one Reverb port, one `dist`. The spec is amended.
