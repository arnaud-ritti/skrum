# Skrum — Public site: landing page and documentation (Astro, GitHub Pages) — Design

Date: 2026-10-06
Status: **approved, 2026-10-06** (the owner's "Write the plan"). Amended the same day while writing the plans, each change marked "(plans)": where the one address lives (§5.1), how the install page holds the snippet (§5.4, §5.5), a third capture helper (§5.6), the order of the content tasks (§8). Amended again the same day on the owner's word that the website and the application must be two distinct builds (goal 8, §5.7, criteria 15 and 16).
Reference site: <https://qretro.com/docs> (a sidebar of guides, "On this page" anchors, a "related" card under each page).
Mockups (binding for the landing's presentation): `docs/design-system/components/ScreenLanding` (`README.md`, `preview.html`, desktop 1440, French) and the "Landing" phone of `docs/design-system/components/MobileAccess` (390).
Branch: `public-docs-site`, a worktree based on `navigation-redesign` at `3049c6ef`.

What was read, and what was not. Read: the route files and `resources/js/pages/**` (feature inventory), `app/Enums/IntegrationProvider.php`, `config/services.php`, `.env.example`, the admin and team integration components, `routes/webhooks.php`, the webhook client and delivery jobs (integration ground truth), `tests/BrowserTestCase.php`, `tests/Browser/Support/CapturesVisuals.php` and `CaptureFile.php`, `tests/Pest.php`, the installed `pestphp/pest-plugin-browser` 5.0.1 (screenshot API), `tests/Arch/*`, both workflows, `.dockerignore`, `.gitattributes`, `vite.config.ts`, `Dockerfile`, `README.md`, the landing mockup and `docs/design-system/components/_preview-bundle.css`, `docs/design-system/app.css`. Checked on the npm registry on 2026-10-06: `astro` 7.3.6 (Node >= 22.12), `pagefind` 1.5.2, `@lucide/astro` 1.52.0 (peer `astro ^4 || ^5 || ^6 || ^7`), `sharp` 0.35.5, the three `@fontsource-variable` packages 5.3.0. **Nothing was installed or run**; what that leaves open is in §14.

## 1. Problem statement

Skrüm has no public face. `/` redirects to the login page or the dashboard, `/about` needs a session, and the only prose written for people is `README.md`, which speaks to someone installing the image. Nothing tells a team member how a retrospective runs, nothing tells a facilitator what each phase does, and nothing tells an administrator what to create at Slack, Atlassian or Microsoft before the fields of Administration → Integrations can be filled: the only setup notes are comments in `.env.example`, and no vendor documentation is linked anywhere in the code.

## 2. Goals

1. A public site at `https://arnaud-ritti.github.io/skrum/` with a landing page and the documentation of the whole application, for the people who use Skrüm and for the people who host and administer it.
2. The documentation is fine-grained, one page per task, 77 pages in 15 sections (§6), illustrated with about 160 screenshots of the real application.
3. Every integration page tells an administrator the whole configuration, vendor side and Skrüm side, with links to the vendor's official documentation (§7). The same holds for the sign-in providers and the other settings that depend on a third party.
4. Screenshots are produced by browser tests from curated story data, cropped to the element a page explains, and are reproducible: a second run with no change in the interface leaves the repository untouched.
5. The site is rebuilt and deployed by GitHub Actions on every push to `main` that touches it; a pull request builds it without deploying.
6. A broken internal link, a missing image, an unused screenshot or a page outside the navigation fails the build.
7. Nothing in the application changes: no route, no page, no dependency of the application.
8. The website and the application are two distinct builds (owner, 2026-10-06): neither reads the other's sources, neither's tooling looks at the other, neither ships inside the other, and a change to one does not start the other's workflows (§5.7).

## 3. Non-goals

- Languages other than English. Nothing is built for them; the folder layout does not forbid them later.
- A custom domain. The address is the default project address; changing it later is one line (§5.1) and the Pages setting.
- A pricing page, a hosted offer, a changelog, a blog, legal pages, a sitemap, analytics.
- Versioned documentation. The site documents `main`.
- A landing page inside the application. `/` keeps redirecting.
- Dark variants of the screenshots, and phone screenshots. Captures are light, 1440 wide, English.
- Screenshots of third-party screens (Slack's consent screen, the Atlassian developer console, …). Those steps are prose and a link.
- Re-using the baselines of `tests/visual/__screenshots__`. They are full-page overflow checks on stress data; the owner chose dedicated captures.
- A check of outbound links in CI. It exists as an on-demand command (§5.5), so that a vendor's outage cannot block a deploy.

## 4. Decisions already taken

| Topic | Decision | Source |
|---|---|---|
| Audience | The people who use Skrüm and the people who host it | owner, 2026-10-06 |
| Language | English only | owner, 2026-10-06 |
| Address | Default project address, base `/skrum` | owner, 2026-10-06 |
| Framework | Astro, on GitHub Pages | owner's request |
| Docs engine | Hand-built on Astro content collections; Starlight refused | owner, 2026-10-06 |
| Landing | The `ScreenLanding` mockup, ported, in English, without what Skrüm does not have | owner, 2026-10-06 |
| Screenshots | Dedicated captures by new browser tests, cropped | owner, 2026-10-06 |
| Granularity | One page per task | owner, 2026-10-06 |
| Integrations | Each page explains the configuration and links to the official documentation | owner, 2026-10-06 |
| Branch | A worktree based on `navigation-redesign` | owner, 2026-10-06 |
| Two builds | The website and the application must be two distinct builds | owner, 2026-10-06, after the plans |
| Site folder | `website/`, with its own `package.json`; `docs/` stays internal | this spec |
| Styling | Plain CSS from the design system's tokens and `sk-*` preview classes; no Tailwind, no UI framework | this spec |
| `sk-*` classes | `docs/design-system/PROMPT-CLAUDE-CODE.md` forbids porting them into the application. The website is not the application and is the one stated exception | this spec |
| Brand name | "Skrüm" in sentences, `skrum` in addresses and commands (design system, "Voix & contenu") | design system |

## 5. Design

### 5.1 The site

```
website/
  package.json  package-lock.json  .npmrc  .gitignore  astro.config.mjs  site.mjs  tsconfig.json
  public/favicon.svg
  scripts/check.mjs
  tests/docs.test.mjs  check.test.mjs
  src/content.config.ts
  src/nav.ts
  src/docs.mjs
  src/styles/tokens.css  sk.css  site.css
  src/components/Header.astro  ThemeToggle.astro
  src/layouts/Base.astro  Docs.astro
  src/pages/index.astro  404.astro
  src/pages/docs/[...slug].astro
  src/snippets/install.sh
  src/content/docs/<section>/<page>.md
  src/assets/screenshots/<section>/<name>.png
```

`website/` is a package of its own, not an npm workspace of the root. Its development dependencies, the only new dependencies of this spec:

| Package | Why |
|---|---|
| `astro` ^7.3 | the framework |
| `sharp` | Astro's image service, declared rather than implied |
| `pagefind` | search index, built after the site |
| `@lucide/astro` | the application's icon set, inlined at build, no script in the page |
| `@fontsource-variable/figtree`, `@fontsource-variable/bricolage-grotesque`, `@fontsource-variable/jetbrains-mono` | the application's three fonts, served by the site (no request to Google) |

No UI framework, no Tailwind, no MDX, no Markdown plugin.

`site.mjs` holds the one address, `new URL(process.env.SITE_URL ?? 'https://arnaud-ritti.github.io/skrum/')` (plans: a file of its own, because the checker of §5.5 needs the base too; the environment variable lets criterion 3 be checked without editing a file). `astro.config.mjs` takes `site` from its origin and `base` from its path; `trailingSlash` is `'always'`. A custom domain is that line and nothing else in the code.

The only logic of the site is in two plain JavaScript modules, `src/docs.mjs` (§5.3) and `scripts/check.mjs` (§5.5), tested with Node's own runner (`npm test` is `node --test`), no test dependency.

### 5.2 Styling

- `tokens.css`: the `:root` and `.dark` blocks of `docs/design-system/app.css`, and the variables that exist only inside Tailwind `@theme` blocks or in `docs/design-system/tokens.json` (`--font-*`, `--radius-*`, `--ease-*`, `--space-*`), which plain CSS would otherwise not see.
- `sk.css`: `docs/design-system/components/_preview-bundle.css` without its Google Fonts import and without the fixed desktop size.
- `site.css`: the `scr-*` rules of the landing mockup, the rules for 390 px, and the documentation's chrome (sidebar, article, table of contents, cards, code blocks, callouts as styled block quotes).
- Icons: each `<i data-lucide="…">` of the mockup becomes an `@lucide/astro` component. Lucide has no GitHub mark; it is one inline SVG.
- Light and dark follow the design system's `.dark` class. One inline script in `<head>` sets it from `localStorage`, else from `prefers-color-scheme`, before the first paint; a toggle in the header writes the choice.

### 5.3 The documentation's mechanics

- A page is a Markdown file `src/content/docs/<section>/<page>.md`. Its folder is its section. Front matter: `title`, `description`, `order` (place in the section), and optionally `related` (ids of other pages).
- `src/nav.ts` lists the 15 sections (id, label) in order and exports `href(path)`, the only place that knows the base. Sections are the only shared list, so two writers never edit the same file.
- `src/pages/docs/[...slug].astro` renders every page inside `Docs.astro` with: the sidebar (sections, then pages by `order`), "On this page" (the page's `h2` and `h3`, shown when there are at least two `h2`), previous and next across the flat ordered list, and a "Related" card when `related` is set. It stops the build on a page in a folder that is not a section, on two pages of a section with the same `order`, and on a `related` id that names no page.
- Markdown links between pages are relative (`../voting/`); images are relative imports of `src/assets/screenshots/...`, optimised by Astro. `.astro` files use `href()`.
- Search: `pagefind --site dist` runs after `astro build`; the header opens Pagefind's modal, themed with the tokens; only the article is indexed.
- `src/pages/404.astro` becomes `dist/404.html`, which Pages serves for an unknown address.
- Code blocks use Astro's built-in highlighter with a light and a dark theme.

### 5.4 The landing page

`src/pages/index.astro`, from the mockup's sections:

| Mockup zone | On the site |
|---|---|
| Nav | logo, "Features", "Self-host", "Documentation", GitHub, primary "Get started". On a phone, a menu |
| Hero | the badge "Open source · Self-hosted", the title "Meetings end, actions remain." (second half in `--skrum-primary-text`), a lead, "Get started" (→ Install with Docker) and "GitHub" (→ the repository), the copyable install command |
| Product preview | the mockup's board, as drawn, marked decorative (`aria-hidden`, no focus stop) |
| Modules | retrospectives, planning poker, whiteboard, icebreakers, surveys, each linking to its documentation section |
| Self-host | the arguments (licence AGPL-3.0-or-later, single sign-on, your branding, your SMTP), the Compose snippet, the "Instance appearance" card |
| Pricing | **not rendered** |
| Final CTA, footer | "Get started" and "View the code", as the mockup; the footer is a page-level landmark, outside `<main>`, its links limited to pages that exist (documentation sections, GitHub, licence) |

Removed from the mockup because Skrüm does not have them: the pricing section and the "Tarifs" link, any free-trial wording, the hosted offer and "hosted in the EU", SAML and SCIM, the Helm tab, the links to a changelog, a status page of a hosted service and legal pages.

Every claim on the landing names a feature that exists in the code. The list a writer may draw from: retrospectives with templates, phases, anonymous cards, grouping, voting, a timer, ROTI, a summary and suggested actions when a language model is configured; action items with owners, due dates, reminders, recurrence, export to Jira, Linear and GitHub; planning poker with hidden votes, decks, task import and estimate write-back; a whiteboard with live cursors, templates and export; eight icebreaker games; surveys (health check, team pulse, eNPS) with results over time; guests who join without an account; sign-in by password, magic link, passkey, Google, GitHub, Microsoft Entra or any OpenID Connect provider; branding (name, logos, colour, radius); an MCP server for AI assistants; PostgreSQL, MariaDB, MySQL or SQLite. Numbers such as "in 30 seconds" are not used.

The install snippet lives in `src/snippets/install.sh`. The landing shows that file; the "Install with Docker" page, being Markdown, repeats its lines; the build fails when one of its lines is missing from `README.md` or from that page (§5.5) (plans). The image is `ghcr.io/arnaud-ritti/skrum`.

### 5.5 The build's checks

`npm run build` is `astro build`, then `pagefind --site dist`, then `node scripts/check.mjs`. The script uses Node's standard library only and fails when:

1. an internal `href` or `src` in `dist/**/*.html` does not start with the base, or does not resolve to a file of `dist`, or carries a `#fragment` that is no `id` of the target page;
2. a picture referenced by a page does not exist under `src/assets/screenshots`, or has no alternative text, or a PNG there is used by no page (plans: read from the Markdown sources, so it does not depend on what Astro does with a missing file);
3. a non-empty line of `src/snippets/install.sh` is absent from `../README.md` or from the install page.

`node scripts/check.mjs --external` also requests every outbound link of `dist` and lists the ones that do not answer 2xx or 3xx. Hosts known to refuse scripted requests are named in the script and reported apart, not as failures. It is run by a writer after writing a page and once before the branch is merged; it is not part of `npm run build`.

### 5.6 The screenshot pipeline

- `tests/Browser/Support/CapturesDocs.php`, a trait used by `tests/BrowserTestCase.php` beside `CapturesVisuals`:
  - `docsVisit(User $user, string $path): mixed` signs the user in through the login form (the arch rule of `tests/Arch/BrowserTestRulesTest.php` forbids `actingAs` and injected cookies in browser tests) and opens the path in a context that is light, `en-US`, reduced motion, 1440 × 900, device scale factor 2.
  - `docsOpen(string $path): mixed` opens the path signed out, with the same options (the sign-in page, the guest join pages) (plans).
  - `docShot(mixed $page, string $name, string $selector): void` waits for the page to settle (fonts, animations, as `CapturesVisuals` does), takes `screenshotElement($selector, …)` as a candidate in `tests/Browser/Screenshots/`, then hands it to `CaptureFile::replaceWhenPictureDiffers()` with the target `website/src/assets/screenshots/{$name}.png`. `$name` is `<section>/<name>`.
- `tests/Browser/Support/DocsWorld.php`: the story every capture starts from. One workspace (Nordlys), one team (Atlas), a cast of eight people with fixed names and identifiers, three sprints. It is built from the existing factories; it is not a seeder and is not reachable outside tests.
- `tests/Browser/Docs/<Area>DocsTest.php`: one file per documentation section. Each adds the builders its pages need, as file-local functions on top of `DocsWorld` and of the helpers already in `tests/Pest.php` (`boardCard`, `topicCard`, `openPokerRound`, `pokerVote`, `whiteboardWithFacilitator`, `sceneElement`, `teamSprint`, `fakeVisualGifs`, `configureLlm`, `fakeLlmReply`, `fakeJiraTrackerApi`, `fakeLinearGraphql`, `fakeGitHubTrackerApi`, `storeConfiguration`, `enableIntegrations`, …). The fixtures of `tests/Browser/Visual` are not moved.
- Selectors are the `data-slot` and `data-test` hooks the application already has. A capture that would need a new hook is reported, not worked around.
- Every outbound call is faked: `BrowserTestCase` has `Http::preventStrayRequests()` on.
- The docs tests are part of `tests/Browser`, so the CI `browser` job runs them and a renamed selector fails CI. CI does not commit pictures. The committed PNGs come from one local run, `npm run build && DB_CONNECTION=pgsql DB_DATABASE=testing vendor/bin/pest tests/Browser/Docs`, on the machine that already produces the visual baselines.
- A test's name says what the picture shows; it carries no plan or ticket identifier and no comment.

### 5.7 Deploy and repository hygiene

- `.github/workflows/docs.yml`
  - Triggers: `push` to `main` and `pull_request`, both limited to `website/**`, `README.md` and the workflow file; `workflow_dispatch`.
  - Top-level `permissions: contents: read`. Concurrency group per ref; a newer pull-request run cancels the older one, a deploy is never cancelled.
  - Job `build` (working directory `website`): checkout without persisted credentials, Node 22 with the npm cache keyed on `website/package-lock.json`, `npm ci`, `npm run build`, then `actions/upload-pages-artifact` with `website/dist`, skipped on pull requests.
  - Job `deploy` (not on pull requests): `pages: write`, `id-token: write`, environment `github-pages`, `actions/deploy-pages`.
  - Actions are pinned by full commit SHA with the version in a comment, as `tests.yml` does; checkout and setup-node use the SHAs already in `tests.yml`.
- Once, by the owner: repository Settings → Pages → Source: "GitHub Actions". Nothing is pushed by the agent without being asked.
- `README.md` gains a link to the documentation.

**Two distinct builds.** What keeps them apart, in each direction:

| | The application's side | The site's side |
|---|---|---|
| Sources | `resources/css/app.css` ends with `@source not "../../website";`: without it Tailwind's automatic detection scans `website/src` and a word of a page can add a utility to the application's stylesheet. The line is the last of the file, because `tests/Feature/DesignTokensTest.php` requires the file to start with the design-system stylesheet unmodified | The tokens and component classes are copies made once (§5.2), not imports. The build reads one file outside `website/`: `README.md`, for the install commands (§5.5) |
| Packages | Root `package.json`, `composer.json`; no workspace | `website/package.json` and its own lockfile; no PHP |
| Tooling | `vite.config.ts`: `website/**` in the lint and fmt ignore lists and in `server.watch.ignored`. Vitest already includes `resources/js` only; `tsconfig.json` too | `npm test` is `node --test tests/*.test.mjs`, inside `website/` (a bare folder argument is run as a module by Node 22 and later, and fails) |
| Artefacts | `.dockerignore` gains `website` (the `Dockerfile` copies the whole context); `.gitattributes` gains `/website export-ignore` | `website/dist` holds nothing of the application |
| Workflows | `tests.yml` and `docker-image.yml` gain `paths-ignore` for `website/**` and `.github/workflows/docs.yml`, on push and pull request (tags still build the image) | `docs.yml` runs only for `website/**`, `README.md` and its own file |

One thing crosses the line on purpose and is not a build: the capture tests of §5.6 belong to the application's test suite and write pictures into `website/src/assets/screenshots/`. They are committed files by the time the site is built.

## 6. Information architecture

15 sections, 77 pages. The address of a page is `/docs/<section>/<page>/`. A title may be longer than the one in this table where two sections would otherwise share it ("Templates", "Overview", "Basics"): the plan's table of stubs is the list of final titles. Shots are an estimate, not a quota: a page gets the pictures that help and no others.

| Section (`id`) | Pages (`slug`) | Shots |
|---|---|---|
| Getting started (`getting-started`) | Introduction (`introduction`) · Quick start (`quick-start`) · Join as a guest (`join-as-guest`) | 8 |
| Accounts (`accounts`) | Sign up and sign in (`sign-in`) · Two-factor and passkeys (`two-factor-and-passkeys`) · Account settings (`account-settings`) · API tokens (`api-tokens`) · Keyboard shortcuts (`keyboard-shortcuts`) | 14 |
| Workspaces and teams (`teams`) | Workspaces (`workspaces`) · Create a team (`create-a-team`) · Members and roles (`members-and-roles`) · Invitations and invite links (`invitations`) · Team settings (`team-settings`) · Sprints (`sprints`) | 14 |
| Retrospectives (`retrospectives`) | Create a retro (`create-a-retro`) · Templates (`templates`) · Phases overview (`phases`) · Icebreaker (`icebreaker`) · Writing (`writing`) · Grouping (`grouping`) · Voting (`voting`) · Discussion (`discussion`) · Actions (`actions`) · ROTI and close (`roti-and-close`) · Facilitating (`facilitating`) · Summary and sharing (`summary-and-sharing`) · Rituals and retro settings (`rituals`) | 34 |
| Action items (`action-items`) | Track action items (`track`) · Reminders and recurrence (`reminders-and-recurrence`) · Export and tracker sync (`export-and-sync`) | 8 |
| Planning poker (`planning-poker`) | Start a game (`start-a-game`) · Tasks and imports (`tasks-and-imports`) · Voting and reveal (`voting-and-reveal`) · Decks (`decks`) · Estimates history (`estimates-history`) | 12 |
| Whiteboard (`whiteboard`) | Basics (`basics`) · Tools and elements (`tools`) · Templates (`templates`) · Export (`export`) | 10 |
| Surveys (`surveys`) | Create a survey (`create-a-survey`) · Health check, pulse and eNPS (`health-check-pulse-enps`) · Results and comparison (`results`) | 8 |
| Games (`games`) | Overview (`overview`) · Word and drawing games (`word-and-drawing-games`) · Conversation games (`conversation-games`) | 10 |
| Team insights (`insights`) | Insights (`insights`) · Health and eNPS trends (`health-and-enps-trends`) · Activity and data (`activity-and-data`) | 8 |
| Integrations (`integrations`) | Overview (`overview`) · Slack (`slack`) · Microsoft Teams (`microsoft-teams`) · Mattermost (`mattermost`) · Telegram (`telegram`) · Jira Cloud (`jira-cloud`) · Jira Data Center (`jira-data-center`) · Linear (`linear`) · GitHub (`github`) · Webhooks (`webhooks`) | 16 |
| AI assistants (`mcp`) | Connect an assistant (`connect`) · Tools reference (`tools`) · Prompts (`prompts`) | 3 |
| Self-hosting (`self-hosting`) | Requirements (`requirements`) · Install with Docker (`install`) · Configuration reference (`configuration`) · Database (`database`) · Processes and status (`processes`) · Upgrading (`upgrading`) | 2 |
| Administration (`administration`) | General and branding (`general-and-branding`) · Sign-in and SSO (`sign-in-and-sso`) · Mail (`mail`) · Integration apps (`integration-apps`) · Users and admins (`users-and-admins`) · MCP keys (`mcp-keys`) · Licence and updates (`licence-and-updates`) · Audit log (`audit-log`) | 14 |
| Reference (`reference`) | Roles and permissions (`roles-and-permissions`) · Webhook events (`webhook-events`) | 0 |

Rules for every page:

- It opens with one or two sentences saying what the reader will be able to do, then numbered steps or short sections. It ends with its "Related" pages.
- Every statement about the application is checked in the code or the running application by the writer, not copied from a spec or a research note: those describe intentions. Writers' starting points: `docs/superpowers/research/coverage/*.md`, `docs/superpowers/walkthroughs/*.md`, `docs/superpowers/specs/*`, `README.md`, `.env.example`, `docs/database.md`.
- Interface labels are quoted exactly as the English interface shows them, in bold.
- Sentence case in titles; "you"; no exclamation marks in a row; no decorative emoji.
- A page says who may do the thing (workspace owner, admin, member; team owner, facilitator, member, observer; instance admin) when it is not everyone.
- Catalogue pages are generated from the code's own lists where one exists, read at writing time: the 52 retro templates and their columns (`lang/en/templates.php`), the 8 whiteboard templates, the 5 poker decks (`app/Enums/PokerDeck.php`), the keyboard shortcuts (`resources/js/lib/shortcuts/sections.ts`), the MCP tools and prompts (`app/Mcp`), the environment variables (`.env.example`, `config/skrum.php`), the webhook events (`app/Enums/WebhookEvent.php`).

## 7. Integration pages

### 7.1 Outline of a provider page

1. What it does (the capabilities of `IntegrationCapability` that provider has, in plain words).
2. Who can set it up: an instance admin for Administration → Integrations (with a recent password confirmation), then a workspace manager or the team's owner for the team's Integrations page.
3. Before you start: what the provider needs from the instance (a public HTTPS address for Slack's redirect; what changes when the instance is not reachable from the internet: inbound webhooks are off and Skrüm polls every `INTEGRATIONS_POLL_MINUTES`).
4. On the vendor's side: numbered steps, with every value to copy from Skrüm written out (callback address, webhook address, scopes or permissions, events), and the link to the vendor's page for that step.
5. In Skrüm, Administration → Integrations: each field by its label, the environment variable that sets the same value, and the rule that a stored value wins over the environment.
6. In the team's Integrations page: connecting, and each option that appears afterwards.
7. Test it.
8. Troubleshooting: the messages the interface shows and what to do.
9. Disconnecting, and what stays on the vendor's side.
10. Official documentation: the list of links.

### 7.2 Ground truth and links, per provider

Read in the code on 2026-10-06. `{APP_URL}` is the instance's public address.

| Provider | Created at the vendor | Entered in Skrüm | Official documentation |
|---|---|---|---|
| Slack | A Slack app with the OAuth redirect `{APP_URL}/integrations/slack/callback` (HTTPS required) and the scope `incoming-webhook`. No bot token, no signing secret | Admin: **Client ID**, **Client secret** (`SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`). Team: **Connect**; Slack asks for the channel; **Reconnect** changes it; **Send a test message** | <https://docs.slack.dev/app-management/quickstart-app-settings> · <https://docs.slack.dev/authentication/installing-with-oauth> · <https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks> |
| Telegram | A bot from @BotFather, used by this instance only, with no webhook set on it (Skrüm polls it every minute) | Admin: **Bot token** (`TELEGRAM_BOT_TOKEN`). Team: **Connect** gives an 8-character code valid 15 minutes, sent as `/connect@<bot> CODE` in the group, channel (bot as administrator) or private chat | <https://core.telegram.org/bots/features#botfather> · <https://core.telegram.org/bots/api#getupdates> |
| Jira Cloud | An OAuth 2.0 (3LO) app in the Atlassian developer console, callback `{APP_URL}/integrations/jira/callback`, scopes `offline_access read:jira-work read:board-scope:jira-software read:sprint:jira-software manage:jira-webhook`, plus `write:jira-work read:jira-user` for writing. Webhooks are registered by Skrüm, nothing to add by hand | Admin: **Client ID**, **Client secret** (`JIRA_CLIENT_ID`, `JIRA_CLIENT_SECRET`). Team: **Connect (read only)** or **Connect (read and write)**, the site, **Story points field**, priority, people and status mapping | <https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/> · <https://developer.atlassian.com/console/myapps/> · <https://developer.atlassian.com/cloud/jira/platform/webhooks/> |
| Jira Data Center | An incoming application link (OAuth 2.0, Jira 8.22 or later), callback `{APP_URL}/integrations/jira-dc/callback`, scope `READ` or `WRITE`; or personal access tokens (Jira 8.14 or later). The webhook is registered by Skrüm when the connecting account administers Jira, otherwise by a Jira administrator from the values the card shows (System → WebHooks) | Admin: **Server URL**, **Client ID**, **Client secret**, **Personal access tokens** (`JIRA_DC_BASE_URL`, `JIRA_DC_CLIENT_ID`, `JIRA_DC_CLIENT_SECRET`, `JIRA_DC_PERSONAL_TOKENS`). Team: connect, or paste a token | <https://confluence.atlassian.com/adminjiraserver/configure-an-incoming-link-1115659067.html> · <https://confluence.atlassian.com/enterprise/using-personal-access-tokens-1026032365.html> · <https://confluence.atlassian.com/adminjiraserver/managing-webhooks-938846912.html> |
| Linear | An OAuth application with the callback `{APP_URL}/integrations/linear/callback`, and one webhook to `{APP_URL}/integrations/webhooks/linear` with its signing secret | Admin: **Client ID**, **Client secret**, **Webhook secret** (`LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET`, `LINEAR_WEBHOOK_SECRET`). Team: read or read-and-write connect, priority and people mapping, status sync | <https://linear.app/developers/oauth-2-0-authentication> · <https://linear.app/developers/webhooks> |
| GitHub Issues | A GitHub App, not an OAuth App, on github.com (Enterprise Server is not supported): callback and setup address `{APP_URL}/integrations/github/callback`, webhook `{APP_URL}/integrations/webhooks/github` with a secret, repository permissions Issues (read and write) and Metadata (read), organisation permission Members (read), events `issues`, `installation`, `installation_repositories`, a private key | Admin: **App ID**, **App slug**, **Client ID**, **Client secret**, **Private key**, **Webhook secret** (`GITHUB_APP_*`). Team: **Install the GitHub App**, **Export repository**, **Priority labels**, **Match GitHub sign-ins**, status sync | <https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app> · <https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app> · <https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/using-webhooks-with-github-apps> · <https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/managing-private-keys-for-github-apps> |
| Microsoft Teams | In the channel, the workflow "Post to a channel when a webhook request is received"; its address | Admin: **Enabled**, **Allowed hosts** (`MSTEAMS_ENABLED`, `MSTEAMS_ALLOWED_HOSTS`). Team: **Webhook URL**, **Channel label (optional)** | <https://support.microsoft.com/en-us/workflows/send-messages-in-teams-using-incoming-webhooks> |
| Mattermost | An incoming webhook for the channel | Admin: **Server URL** (`MATTERMOST_URL`). Team: the webhook address, a label | <https://docs.mattermost.com/developers/integrate/webhooks/incoming> |
| Webhooks | A receiver of your own that checks `X-Skrum-Signature` | Admin: **Enabled** (`OUTGOING_WEBHOOKS_ENABLED`). Team: the address, a label, the events; the secret is shown once; **Rotate secret**; the delivery log and redelivery | none: the contract is Skrüm's own |

The Webhooks page and "Webhook events" document the contract in full, from the code: the headers (`X-Skrum-Event`, `X-Skrum-Delivery`, `X-Skrum-Timestamp`, `X-Skrum-Signature`, `X-Skrum-Redelivery`), the signature (`sha256=` followed by the hex HMAC-SHA256 of `"{timestamp}.{rawBody}"` with the secret), the body (`version`, `id`, `event`, `occurredAt`, `sentAt`, `team`, `data`), each event with an example body, the retry schedule, what a 429 and a 410 do, when an endpoint is turned off and how to turn it back on, how long payloads and log rows are kept, and a short verification example.

### 7.3 Other settings that depend on a third party

| Page | At the vendor | Official documentation |
|---|---|---|
| Sign-in and SSO, Google | An OAuth client with the redirect `{APP_URL}/auth/google/callback` | <https://support.google.com/cloud/answer/15549257> · <https://developers.google.com/identity/protocols/oauth2/web-server> |
| Sign-in and SSO, GitHub | An OAuth App (separate from the GitHub App of the Issues integration), redirect `{APP_URL}/auth/github/callback` | <https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app> |
| Sign-in and SSO, Microsoft Entra | An app registration with the redirect `{APP_URL}/auth/entra/callback`, its tenant, and the optional ID-token claim `xms_edov` | <https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app> · <https://learn.microsoft.com/en-us/entra/identity-platform/optional-claims-reference> |
| Sign-in and SSO, OpenID Connect | A client at any OpenID Connect provider, redirect `{APP_URL}/auth/oidc/callback`; Skrüm needs the issuer address | <https://openid.net/specs/openid-connect-discovery-1_0.html> |
| Configuration reference, AI features | An API key. `SKRUM_LLM_PROVIDER` is `anthropic` or `openai` (any OpenAI-compatible server through `SKRUM_LLM_BASE_URL`), with `SKRUM_LLM_API_KEY` and `SKRUM_LLM_MODEL` | <https://platform.claude.com/docs/en/api/overview> · <https://platform.openai.com/docs/api-reference/authentication> |
| General and branding, GIFs | A Giphy or Tenor API key | <https://developers.giphy.com/docs/api/> · <https://developers.google.com/tenor/guides/quickstart> |

### 7.4 Rule for links

On 2026-10-06 every address of §7.2 and §7.3 answered 200 to a scripted request, except the OpenAI one, which answers 403 to scripts. That proves the address exists, not what the page says. Before a writer links a page, they read it and confirm it describes the step it is linked from; a better official page replaces the one listed here. Only the vendor's own documentation is linked, never a third-party tutorial.

## 8. Work breakdown

Three plans.

**A. Foundation.** Sequential; owns `website/**` except `src/content/docs` and `src/assets/screenshots`, and the repository-level files.
1. Scaffold, dependencies, `astro.config.mjs`, `tokens.css`, `sk.css`, fonts. This step first proves what §14 lists as not run.
2. `Base` and `Docs` layouts, `nav.ts` with the 15 sections, `[...slug].astro`, 404, search, theme.
3. `scripts/check.mjs`, and three seed pages without pictures: Introduction, Install with Docker, Create a retro.
4. The landing page.
5. `docs.yml`, the ignore-file edits, the README link.

**B. Capture pipeline.** Parallel with A; owns `tests/Browser/Support/CapturesDocs.php`, `tests/Browser/Support/DocsWorld.php` and the trait line in `tests/BrowserTestCase.php`. Test first: one docs test that writes one picture, run twice, the second run leaving the tree clean.

**C. Content.** After A and B. A first task creates every page as a stub, so that a page may link to any other from the start. Then one task per section; each owns `website/src/content/docs/<section>/`, `website/src/assets/screenshots/<section>/` and `tests/Browser/Docs/<Area>DocsTest.php`, so no two tasks touch the same file. The section tasks run one at a time (plans): they share one test database, one Reverb port and one `dist`. The three seed pages are taken over by their sections. A last task reads the whole site once for consistency of terms and cross-links and runs the external link check.

Captures are taken once `navigation-redesign` is committed and this branch is rebased on it: the redesign changes the navigation every picture shows. A page and its pictures are written together (the build refuses a page whose picture is missing), so plan C as a whole starts with that rebase (plans); plans A and B do not wait for it, except A.5.

## 9. Acceptance criteria

1. In `website/`, `npm ci && npm run build` exits 0 on Node 22.
2. Every internal link and image of `dist` starts with `/skrum/` and resolves, fragments included.
3. With another address in the one constant (`SITE_URL`, or the default of `site.mjs`), no internal link, asset or font of `dist` keeps `/skrum/`. (The repository's own address, `github.com/arnaud-ritti/skrum/…`, and the image and raw-file addresses of the install commands still contain it: they are outbound.)
4. Each of these stops the build with a message naming the file: a page in a folder that is not a section; two pages of a section with the same `order`; a `related` id that names no page; an image that does not exist; an image without alternative text; a screenshot no page uses; an `install.sh` line absent from `README.md` or from the install page.
5. Every documentation page shows the sidebar with its own entry marked current, previous and next, and "On this page" when it has two `h2` or more.
6. A search for "planning poker" lists a page of the Planning poker section, and its link opens that page under the base.
7. The theme chosen with the toggle is kept across a reload; with the dark theme chosen or preferred, no light frame is painted first.
8. The landing shows no pricing, trial, hosted offer, EU hosting, SAML, SCIM or Helm; "Get started" leads to Install with Docker; "GitHub" leads to `https://github.com/arnaud-ritti/skrum`. At 390 px wide the page does not scroll sideways.
9. The 77 pages of §6 exist at their addresses, each with a title, a description and at least one section of content, and none is a placeholder.
10. Each of the eight vendor pages of §7.2 has the ten parts of §7.1, states every callback and webhook address, scope, permission and event of its row, names every Skrüm field by its label and its environment variable, and links at least one official page of the vendor. The Webhooks page has the contract of §7.2. The Sign-in and SSO page has, per provider, the redirect address, the fields and the links of §7.3.
11. `node scripts/check.mjs --external` reports no failing link; the hosts reported apart as refusing scripts are listed in the script.
12. Every catalogue page lists exactly what its source lists: 52 retro templates, 8 whiteboard templates, 5 poker decks, every shortcut of `sections.ts`, every MCP tool and prompt registered in `app/Mcp`, every webhook event of `WebhookEvent`.
13. `vendor/bin/pest tests/Browser/Docs` passes; run a second time with no change, it leaves `git status` clean.
14. No capture test uses `actingAs`, an injected cookie, or a real outbound call; `tests/Arch` passes.
15. `composer ci:check` passes. The Docker build context no longer contains `website/` (`.dockerignore`), and `git archive` leaves it out (`.gitattributes`). The application's built stylesheets are byte-identical whether `website/` is present or moved away. No file of `website/` (outside `node_modules`) reads a path of the application other than `README.md`.
16. In `docs.yml`, a pull request touching `website/**` runs `build` and not `deploy`; a push to `main` touching `website/**` runs both. A change that touches only `website/**` starts neither `tests` nor `Docker image`; a change that touches neither `website/**`, `README.md` nor `docs.yml` does not start `docs`. (The live address is checked once the owner has turned Pages on and pushed.)
17. No file under `website/` or `tests/Browser/Docs` contains a plan or ticket identifier.

## 10. Verification

- `cd website && npm ci && npm run build`, then `node scripts/check.mjs --external`.
- Criterion 3: build once with another address, grep `dist` for `/skrum/`.
- Criterion 4: one throwaway change per case, each seen to fail, each reverted.
- `npm run build && DB_CONNECTION=pgsql DB_DATABASE=testing vendor/bin/pest tests/Browser/Docs`, twice.
- `vendor/bin/pint --dirty --format agent`, `composer ci:check`.
- `npm run preview` in `website/` (Astro 7 starts it detached: it is stopped with `npx astro preview stop`, and `npm run dev` with `npx astro dev stop`), in a browser: the landing at 1440 and 390 beside the mockup, the theme toggle and a reload in dark, the search, one long page (table of contents, previous and next, related), the 404.

## 11. Dependencies on other work

- `navigation-redesign` must be committed before captures are taken (§8). It also carries uncommitted edits to `tests.yml`, `docker-image.yml`, `.dockerignore` and `README.md`; step A.5 is applied after the rebase.
- The `README.md` committed on this branch has no "Features" section; the version being prepared elsewhere has one. The landing's claims rest on §5.4's list, not on the README.

## 12. Risks

- About 160 PNGs at twice the pixel density add an estimated 20 to 40 MB to the repository.
- `screenshotElement()` takes no option, so it cannot disable animations itself; captures rely on reduced motion and on the settle step. A capture that still moves is reported, not retried until it passes.
- A workflow skipped by a path filter reports no status. If `tests` is one day made a required check on `main`, a pull request that only touches `website/` would wait for it forever; the usual answer is a small always-green job of the same name for those paths.
- The story's sprints are dated from the Monday of the current week, so that "the current sprint" and "due in three days" stay true whenever the captures run. A picture that shows a date therefore changes from one week to the next, and is rewritten the next time the captures run in another week. Captures crop dates out where they are not the subject. (Fixed calendar dates would keep those pictures still and make every relative label wrong, the browser's clock not being the test's.)
- In the chained build a picture missing from disk stops at Astro (`ImageNotFound`, which names the picture), before the checker of §5.5 that would name the page.
- Linux and macOS draw text differently: pictures committed from the owner's machine will differ from what CI would draw. CI therefore never compares or commits them.
- Vendor documentation moves. Two addresses already redirected on 2026-10-06 (Microsoft, Mattermost); the redirect targets are the ones written in §7.

## 13. Questions for the owner

None open. Decided on the owner's behalf, to be overruled on review: the folder name `website/`; no dark screenshots; the eight games on two pages, not eight; environment variables inside "Configuration reference" rather than on a page of their own; `README.md` stays the one file the site's build reads outside its folder.

## 14. Not determined by reading

- Whether a Markdown image whose file is missing fails `astro build` by itself in Astro 7. `check.mjs` does not depend on it: a missing image leaves a link that does not resolve.
- The exact attributes of Pagefind's modal component for a site under a base path.
- Whether `npm ci` with `ignore-scripts=true` installs working `sharp` and `pagefind` binaries (both ship prebuilt optional packages).
- Which Markdown processor Astro 7 uses by default; no plugin is used, so either works.
- Which resource types to tick when creating the Linear webhook: the handler reads `Issue` events only; the writer confirms from the handler before the page states it.
- The scopes requested at sign-in by Google, GitHub, Entra and OpenID Connect: they are the defaults of Socialite and of `socialiteproviders/openidconnect`, not written in the application; the writer reads them in `vendor/` before the page states them.
- How `vp check` treats `.astro` files; `website/**` is ignored rather than found out.
