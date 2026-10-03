# Front-end rewrite (plan 18) — final report

Written on 2026-10-02 at the close of plan 18g, on branch `plan-18g-cleanup`; updated on 2026-10-03 with rework 3 (§12). The branch holds plans 18a to 18g and the three reworks. **Nothing is merged into `main` and nothing is pushed: both are left to the owner.**

The rewrite is built and its automated suites are green. It has not been seen by a person, in a browser, on any screen. Read "What was not verified" before relying on anything else in this report.

## 1. Final gates

Run on the last commit of code of this branch, after rework 3.

| Gate | Result |
|---|---|
| Feature suite (`artisan test --parallel --processes=6 --exclude-testsuite=Browser`: Unit, Feature, Arch) | 5659 tests: 5658 passed, 1 skipped, 0 failed |
| Architecture suite alone (`--testsuite=Arch`) | 93 passed |
| `tests/Arch` (front-end rules, page wiring), `TranslationKeysTest` and `InformalRegisterTest` | 93 + 22 + 6 passed |
| Vitest (`npm run test`) | 3699 passed, 342 files |
| `wayfinder:generate --with-form`, then `npm run types:check` | clean |
| `npm run check` | 989 files formatted, 974 linted, no warning |
| `npx vp build` | built |
| `vendor/bin/pint --dirty` | passed |
| Visual capture tests (`tests/Browser/Visual`, 14 files, 251 tests), light theme, 1440 px, French only | passed before rework 3; **not run since**, and their captures are stale for the screens rework 3 changed (§12) |
| Browser walkthroughs and smoke tests (`tests/Browser/Walkthroughs`, `tests/Browser/Smoke`) | **not run** (owner decision) |
| `bin/front-old-components.mjs` | 0 old view component reached by a page |
| `bin/front-unused.mjs --lang` | 0 unreached file, 0 local-only export, 0 unused package, 0 unused CSS, 0 unused key; exits 1 because one file is reached only by its test (`layouts/skrum/onboarding-layout.tsx`, kept on purpose) |

## 2. What was done, phase by phase

| Phase | Content | Report |
|---|---|---|
| 18a to 18d | Tokens, the component library (`components/ui`, `components/skrum`), the bench, branding and instance admins | the plans of each phase; no phase report in this folder |
| 18e | Every screen rebuilt on the library, each rendering its own layout; the back-end items of spec §9 | `18e-report/README.md` and its eleven group reports |
| 18f | Mails, magic link, e-mail second factor, required SSO, search, bell, shortcuts, invitation account | `18f-report.md` |
| 18g | Merge of 18e and 18f, dead code, rule tests, translations review, reduced fidelity pass, contrast test, parity table, this report | this file; `fidelity.md`, `deviations.md`, `translations-review.md`, `parity.md` |

### Plan 18g in detail

- **Merge** of `plan-18f-auth` (which holds the closed 18e): no textual conflict. Three stale entries of the translation tests were removed with their deleted files.
- **Old view components**: none is left. Five were rewritten on the library in the first pass (`settings/avatar-style-card`, `input-error`, `user-info`, `nav-user`, `retro/card-insight`); the others went with their screens in 18e and 18f. `breadcrumbs.tsx` and `user-menu-content.tsx`, the last two of the 18e list, were read: both are built from `components/ui` and stay.
- **Dead code**: see §5.
- **Rules of spec §5 as tests** (`tests/Arch/FrontEndRulesTest.php`): the baseline is empty and its constant and test are removed. 28 exemptions remain, each with a one-line reason.
- **Translations**: see `translations-review.md`. 733 keys reviewed per language; 48 French, 59 Spanish and 189 German values changed.
- **Fidelity**: see §3.
- **Accessibility**: see §6, criterion 12, and §7.
- **Parity**: see §4.

## 3. Gaps with the mockups

Tables: D-01 to D-127 in the 18e plan ("Deviations from the mockup"), V1 to V32 in the 18f plan, D-128 to D-131 in `deviations.md`. `fidelity.md` ties each page to its rows.

| Status | Count | Rows |
|---|---|---|
| Approved by the owner (an answer is recorded) | 72 of the D rows | Listed in `18e-report/README.md`. For 21 of them the owner asked for a rework: the row now describes what remains after it, and **the owner has not read that remainder** |
| Ruled by the controller under the autonomy mandate (the owner has read none) | 35 D rows; the 28 V rows that are not an owner answer | `18e-report/README.md`; `18f-report.md` §5 |
| Owner answers among the V rows | 4 | V1, V16, V24, V32 |
| Still open in 18e (the built state is the default) | 9 (15 before rework 3) | D-88, D-96, D-115, D-117, D-119, D-125; D-95, D-101 and D-114 were reworked on the owner's word and stay for what remains (§12) |
| Not classified by the 18e report | 1 | D-90 (branding: exact radius field, "Undo" on a staged image) |
| New in 18g, to approve by the owner | 2 (4 before rework 3) | D-129, D-131; D-128 fixed and D-130 reworked in rework 3 |
| Roadmap (a later plan builds the element) | — | The rows whose last column names a feature: `feature-roadmap.md`, plans 19 to 27 and 29 |
| Backlog (not asked for) | — | The rows marked "backlog", and everything of plans 28 and 30 and of scheduling, which the owner moved to the backlog (V14 and V15 point there now) |

The roadmap and backlog rows were not counted one by one: a row often points to both.

Fidelity pass of 18g (`fidelity.md`), **light theme, 1440 px, French only**: 45 rows (a page with its states). 8 faithful, 32 with differences all tied to a row, 3 without a mockup, 2 not opened. Nine differences were fixed. Six of them were plain breakage a person would have seen at once: a link reading "Ouverte", "1 colonnes", image tabs cut, a breadcrumb cut, poker badges cut in the header, a colon alone at the start of a line.

That six such defects were found in one configuration out of eight says the seven others very likely hold more.

## 4. Old features verified

`parity.md`, generated by `bin/front-parity.mjs` from the inventories, the code and `parity-rulings.tsv`.

| Kind | Rows | Settled | Open |
|---|---|---|---|
| Routes | 339 | 339 (338 by the script: a caller before and a caller now, or none on both sides; `/` by a ruling: it is a redirect) | 0 |
| Pages | 32 | 32 (31 exist; `welcome` removed by the owner's decision) | 0 |
| Features of spec §8 | 84 | 84, each pointing to the file that carries it; every file named exists | 0 |
| Actions of `inventory-pages.md` | 560 | 4 (the landing page) | **556** |
| Files of `inventory-components.md` | 365 | 200 (186 still present, 14 renames git can follow) | **165** |

The 556 actions are open because their keys are the sentences of the inventory, and the parity tables that the 18e tasks filled (in the eleven group reports, with "Done: yes" per row) are numbered by brief, not by those sentences. Joining the two by hand for 556 rows was not done, and a mechanical verdict would have been invented. By page: `retros/show` 155, `whiteboards/show` 71, `teams/integrations` 71, `poker/show` 52, `teams/show` 49, `action-items/index` 45, `games/show` 40, `workspaces/templates` 16, `settings/security` 11, the others 46.

The 165 files are deleted files whose replacement was not traced one by one.

A feature ruling says which file carries the feature. It was written by reading file names and a search of the code, not by using the feature.

## 5. Code deleted

Against `310a5026` (the commit before plan 18e), under `resources/js`:

| | |
|---|---|
| Files deleted | 158 (17,522 lines), 14 moved |
| Whole folder | 964 files changed, +117,943 and −28,588 lines |
| View files of `components/` and `layouts/` before 18e (outside `ui/`, `skrum/`, `session/`) | 287: 153 deleted by 18e, the rest changed, moved or read and kept |
| Old view components rewritten in 18g | 5 |
| Files deleted in 18g | 16 (12 in the first pass; then `notification-bell.tsx`, `heading.tsx`, `hooks/use-current-url.ts`, `session/reconnecting-hints.ts`) |
| `export` keywords removed in 18g | 245 (64, 154, then 27 that the `knip` run found) |
| Dead exports and types deleted in 18g | 12 |
| Translation keys removed in 18g | 256 per language (161, 94, 1) |
| Packages removed | 0 (none was unused). One declared: `@testing-library/user-event` 14.6.7 |
| Unused CSS | 0 |

Not deleted, on purpose:

- `layouts/skrum/onboarding-layout.tsx`: only its test reaches it. The onboarding (plan 25) uses it.
- 195 exports of `components/ui` and `components/skrum` that only their own file uses, and 19 that nothing uses: the public surface of the library.
- 106 exports that only a test imports.
- `session/reconnecting-hints.ts` was a table only the shell's test read; the test now holds its own copy and the file is gone. No test was deleted.

`knip` (one run through `npx --yes knip@6.39.0`, not installed; configuration and output kept beside the ledger): after the fixes it lists 156 exports and types of the library (kept), 2 "unused" packages (`concurrently`, `laravel-echo`) and 342 "unlisted" imports of `vitest` and `@inertiajs/core`. The last two groups are false positives for the reasons `bin/front-unused.mjs` records (`toolingPackages`). Nothing else.

## 6. Tokens and components

No token is missing: every rule test passes without a baseline. Components composed from primitives because the design system has none: `integrations/share/delivery-lines.tsx`, `retro/results/health-radar.tsx`. `docs/design-system` READMEs were not updated for the props plan 18e added (`RetroCard`, `RetroColumn`, `CardGroup`, `CardVotes`, `VoteBudget`, `ROTIWidget`, `StatCard`, `SurveyQuestion`, `IcebreakerGameCard`, `GuestJoin`; `ColumnTabs` is new).

## 7. Acceptance criteria of spec §13

| # | Criterion | Status | Evidence, or what is missing |
|---|---|---|---|
| 1 | Every page at 1440 and 390, light and dark, four languages, no overflow | **not verified** (owner decision: one configuration) | Light, 1440, French: the capture tests pass their overflow check on 160 page captures. Dark, 390, English, Spanish, German: not run |
| 2 | Every action of the inventory has a control | **not verified** | 556 of 560 action rows open (§4). The 18e group reports hold a filled parity table per screen |
| 3 | The browser suite passes | **not verified** (owner decision) | Walkthroughs and smoke tests not run; stale and red in places |
| 4 | Suites, build, types, check pass at the end of every phase | met for 18e, 18f, 18g | §1; phase reports |
| 5 | Grep finds no palette colour, no `text-white`, no arbitrary size | **not met to the letter** | 2 hits: `border-[1.5px]` twice in `components/skrum/card-group.tsx` (a stroke; the rule test allows strokes of 2px or less). Nothing else |
| 6 | `npx knip` reports nothing | **not met to the letter** | It reports the kept list of §5 and nothing else. The spec line needs "nothing but the library's exported surface" |
| 7 | No starter-kit file remains | met | `front-unused`: 0 unreached file; old layouts, sidebar, logo components gone; `public` holds `brand`, `favicon.svg`, `index.php`, `robots.txt` |
| 8 | No `sk-*` class in the application | met | `FrontEndRulesTest` (`design-system-class`); grep |
| 9 | A retro runs through every phase with a member and a guest in two browsers | **not verified** (owner decision) | It is a walkthrough |
| 10 | Brand contrast tests; the Branding screen shows value, applied value, ratios, warnings | met | `tests/Unit/Branding/BrandPaletteTest.php`; capture `admin-branding-page` |
| 11 | Avatars served by the application; GIFs through the proxy with attribution | met by tests, not in a browser | `Teams/TeamsTest`, GIF proxy tests; capture `games-room-gif` shows "Powered by GIPHY" |
| 12 | Reduced motion: no flying reactions, no confetti, flip is a fade | **not verified** | Rule test `scripted-motion` (two exemptions resting on the `live-reactions` stylesheet, read, not seen); Vitest of `reaction-bar`, `timer`, `gif-picker`. Never observed in a browser |
| 13 | Every §9 item has feature tests; B12, B13, B31, B33 pass a security review | met | Table of `18e-report/README.md`; `18f-report.md` §2, gate open with Minor findings accepted |
| 14 to 34, 36 to 44 | One per back-end item (B15 to B45) | met by feature tests | The test files named in `18e-report/README.md` and `18f-report.md`, all in the green run of §1. Where a criterion describes a screen (15, 24, 27, 32), the screen half is not verified in a browser |
| 28, 30 | B31, B33 | met by tests | **No live SSO sign-in was ever made** |
| 35 | Side-by-side comparison of every screen, both themes, both widths; every difference approved or fixed | **not met** | One configuration compared, by an agent. 4 new rows and 15 older ones wait for the owner; 35 D rows and 28 V rows were ruled without the owner |

Accessibility, automated part done in 18g: the contrast of 14 token pairs in both themes (`tests/Feature/LightScopeTokensTest.php`, 28 cases: AAA for body text, AA for secondary text, 3:1 for controls). Not done: axe on the pages, the focus-mark check and the reduced-motion check of plan 18g Task 9 Step 2. They were planned as `tests/Browser/Smoke/AccessibilityTest.php` on a page catalogue; the smoke folder is out of bounds, the catalogue was not built, and `axe` is not a dependency.

## 8. Decisions taken on the owner's behalf

### Plan 18e

The table of `18e-report/README.md`, "Decisions taken on the owner's behalf", stands as written. In short, with how to overturn each:

| Decision | To overturn |
|---|---|
| Every "decide" row of `pre-build-deviations.md` built on its recommended option (PB-01 to PB-06, PB-13 to PB-16, PB-24, PB-30, PB-50) | One screen each; the report names the function for PB-24, PB-30, PB-01 |
| Simple data added to the server where the mockup shows it (team tiles, "used n×", ticket key, "Join" / "Resume", team name in headers, votes per task) | Remove the prop and its line; each has a feature test |
| Participation of the session end counts team members who joined; guests left out (spec B3 amended) | Revert `66bd5b52` and `0d625c51` |
| The health check page opens on `view` (D-96) | `authorize('update', …)` in its controller |
| "Regenerate codes" asks nothing (D-95) | **Overturned by the owner** in rework 3: it asks first (R3-9) |
| Action items: "Reset" stores "every team" (D-120) | **Overturned by the owner** in rework 3: Reset returns to the opening state, every team lasts one visit (R3-11) |
| "Closed" badge only on a survey the facilitator closed | `closed` in `survey-result-list.tsx` |
| French "Action items" is "Actions" | Change the value, or split the key |
| "Remove from team" / "Remove from workspace" as two keys | Rename the keys |
| Guest join: a signed-in visitor gets their own name; a name is cut at 50 characters | `PresentJoinSession::nickname()` |
| `app.tsx` wraps no page in a layout | Nothing to do; a new page renders its own |
| Rector suggestions applied to 14 files | Revert `0c914828` |

### Plan 18f

The table of `18f-report.md` §4 stands as written: the second-factor condition of an admin under required SSO; the reset link to admins only; the uniform forgot-password answer and its limit; a challenge that cannot complete once SSO is required; SSO refusing two accounts that differ by case; addresses stored lower-cased (not reversible by code); the limit on account creation from an invitation; the 403 when registration is off; the refusal of an address that has an account; the landing after creation; the switch that also silences element keys; the handlers of `⇧R`, `F`, `G`, `C`, `⌘→`; the whiteboard key list written from knowledge; the expired invitation that no longer says "expired" or "used"; the dead invitation notification deleted when the bell is counted; the reading of links stored in the earlier format. Each line there names the file to change.

### Plan 18g

| Decision | To overturn |
|---|---|
| German says "du" everywhere (189 values, 70 of them older than plan 18e) | **Settled by the owner** (sixth round: informal address everywhere). Seven remaining "Sie" strings were changed too |
| Spanish says "tú" on screen and keeps "usted" in mails; "baraja", "clave de acceso" | Register **settled by the owner** (sixth round): "tú" everywhere, mails included; French says "tu" everywhere. For "baraja" and "clave de acceso": revert `a67e4836` |
| French takes the words of the mockups: "facilitateur", "deck", "icebreaker", "double authentification", "Enregistrer", "Synthèse", "Depuis toujours" | Revert `b7d2790b`; the last three are in `cabda665` and `5faee0d6` |
| French: a non-breaking space before `: ; ? !` (469 values); the mail strings were left out so that they match their mockup to the letter | Revert `52945310` |
| Participation of the session end (plan 18e close: team members only, guests left out) | **Settled by the owner** (sixth round): a guest counts. Everyone who joined out of everyone expected (team members plus the participants who are not members); never above 100%. Spec B3 amended |
| The link of a team tile uses the key "Open team"; the key "Open" is removed | `team-tile.tsx`; restore the key |
| The poker header shows the round alone below 110rem; "Anonymous votes" and "Auto-reveal" are then only in the settings and the facilitator panel | `OptionBadgesFrom` in `poker/poker-room.tsx` |
| The unsaved line of the admin topbar shows only when something is unsaved | `unsaved-bar.tsx` (`md:data-[dirty]:not-sr-only`) |
| The four image tabs of Branding sit on two rows | `className` of the `ToggleGroup` in `branding-form.tsx` |
| `VISUAL_ONLY` filter added to `CapturesVisuals` | Remove the six lines; unset, it changes nothing |
| Two visual tests changed to bind what exists (`html > body` for the `?` key; the preview by its `data-slot`, since its label is translated) | `c24a6e5c` |
| `reconnecting-hints.ts` deleted, its table copied into the shell's test | Revert `67ffda77` |
| 256 translation keys removed per language after a search of every source (PHP, Blade, TypeScript, tests) | The four `chore(i18n)` commits |
| Unused types deleted (`TwoFactorSetupData`, `TwoFactorSecretKey`, `AppLayoutProps`, `AppVariant`, `AuthLayoutProps`, `NavItem`) | `5b1cec7e` |
| `deviations.md` points to the two existing tables instead of copying 155 rows into one renumbered table | Plan 18g Task 8 asked for the copy |
| Parity: files still present are ruled "kept" mechanically; feature rulings written from a search of the code | `parity-rulings.tsv` |
| Four new deviation rows (D-128 to D-131) recorded, not fixed | `deviations.md` |

## 9. What was not verified

- **The browser walkthroughs are stale, red in places, and were neither run nor read since integration 2b of plan 18e.** They bind the old markup (action items page, surveys, icebreaker choice, "Join", settings, team page, the "Create an account" link). They need to be rewritten against the new screens: a job of its own.
- **Fidelity was checked in one configuration only**: light theme, 1440 px, French. Dark theme, 390 px and English were not captured and not compared. Spanish and German were never captured. The captures of the seven other configurations in the repository are stale.
- **In that one configuration, an agent compared the pictures**, 108 of the 160 page captures, most of them before the last fixes. No person compared a screen with its mockup side by side.
- **No manual accessibility checklist was run.** It would cover: keyboard-only paths (log in, create a session, run a retro through every phase, poker, action items, settings, every dialog, the tab bar at 390); contrast by eye of text on the eight column colours, on presence colours and over a GIF, and of the focus ring; reduced motion on reactions, confetti, the card flip, dialogs and skeletons; live regions of the timer, votes and connection state.
- **No real screen reader** (VoiceOver, NVDA) was used at any point.
- **No axe run, no focus-mark check, no reduced-motion check in a browser.**
- **No live sign-in** through SSO, a passkey or TOTP; the admin password path under required SSO was never completed with a real code.
- **Translations were reviewed by an agent only.** No native speaker read French, Spanish or German. English was not reviewed.
- 556 action rows and 165 file rows of the parity table are open.
- Mail rendering in mail clients; timing of the password-reset request; `route:cache` with the reset throttle; a cache not shared between nodes.
- MariaDB, MySQL and SQLite: the suite runs on PostgreSQL only.
- Rector was not run in 18f or 18g.
- No whole-branch review was done: each lane had its own.

## 10. Operator notes

`18f-report.md` §6 holds them and they are unchanged: the queue must not be `sync` in production; verify the reset throttle once under `route:cache`; `php artisan users:report-duplicate-emails`; a delivering mailer is required for the magic link and the e-mail code; `sso_required` is cached 300 s; required SSO closes no open session.

From 18g: a deployment must build the front end (`npm run build`) after this branch; the captures under `tests/visual/__screenshots__` are valid for `light-1440-fr` only.

## 11. Next steps

- Database portability plan: in progress in its own worktree. Two raw `lower(email)` queries and one `orderByRaw … nulls last` belong to it and were left alone.
- Feature roadmap: plans 19 to 27 and 29 (`feature-roadmap.md`). Plans 28 and 30 and scheduling are backlog.
- Rewrite of the browser walkthroughs against the new screens, then criteria 1, 3, 9, 12 and 35 can be verified.
- The fidelity pass in the seven other configurations, and by a person.
- The parity verdicts of the 556 actions.
- For the owner:
  - read the 15 open rows, the 4 new ones, and the remainders of the reworked rows;
  - read `translations-review.md`, the German change first;
  - amend the spec for criteria 5 and 6, and for the points `18f-report.md` §8 lists (B33, criteria 28 and 30, §15 points 11 and 17);
  - the PHP `^8.4` constraint in `composer.json`;
  - the `CLAUDE.md` pointer;
  - merge into `main` and push.

## 12. Rework 3 (owner rounds 7 and 8)

Brief: `.superpowers/sdd/2026-10-16-plan-18e-front-rewrite-screens/rework-3-brief.md`. Four lanes, each reviewed, merged with `--no-ff` in this order: `rw3/r3Misc`, `rw3/r3Integrations`, `rw3/r3Retro`, `rw3/r3Settings`. The only conflict was the end of the four `lang/*.json` files (retro and settings both appended keys): resolved by the union of the keys, `TranslationKeysTest` and `InformalRegisterTest` green.

### What changed, per decision

| Item | Row | What is built now |
|---|---|---|
| R3-1 "Add a card" | D-97 reworded | Each column ends with the dashed "Add a card" button; a click or N opens one card in editing with the key hints, "GIF", "Cancel" and "Save". Controller rulings on the lane's open questions: after "Save" the card stays open and focused for the next one; it sits at the foot of the column; a new card's button reads "Save". A card left in editing now goes when the column stops taking cards (locked board, phase over), so it no longer takes the focus back later |
| R3-2 Reactions at session end | D-112 closed | The reaction bar is docked under the results (and under the "Board" tab); flying reactions are never stored; spec §9.1 and the board-engagement spec reworded. On a phone it is the compact bar above the sticky actions |
| R3-3 ROTI wording | D-109 removed, D-110 closed | "Was this time together worth it?" and the five labels of the mockup in four languages; the ROTI screen lists no action item (a test guards it), spec §9.1 says where they are ticked |
| R3-4 Phase rail labels | D-101 reworded, stays | Every label from 105rem of session header (container query, token `--container-session-rail`, now declared among the plan 18e additions so the design-system head of `app.css` stays untouched); below, markers and the current label. 1440 px still shows the markers |
| R3-5 Compact health rows | D-111 closed | `HealthCheckCompact` rows on the session end; "Details" opens the full results (figures, radar, trend, one block per statement) in a dialog, titled "Health check" like the card |
| R3-6 Phone compact rail | D-114 reworded, stays | Compact, read-only rail; the phase and its place under the title; "Previous" / "Next" ("Complete", "Reopen") in the facilitator menu |
| R3-7 Surveys at the end | D-123 closed | `PresentSurvey` counts a survey left open on a completed retro as closed: everyone sees the results, the foot "Answer to join the discussion" is gone. Completion already closed open surveys (`CloseOpenSurveys`) |
| R3-8 Settings on one page | D-130 reworded, stays | `/settings` holds Profile, Security, Appearance, Notifications and API tokens; the sub-navigation scrolls to anchors, marks the section in view and stays under the top bar on a phone; the old addresses redirect to their anchor. Every card is drawn on opening; the password is asked in a dialog at each protected action. The locked card of the first build and its test were deleted (approved by the controller) |
| R3-9 Recovery codes, badge | D-95 reworded, D-81 removed | "Regenerate codes" asks first; no generation date; the badge has keys of its own ("Activée" / "Désactivée" in French, "Activada" / "Desactivada" in Spanish) |
| R3-10 Integrations | D-85, D-86 reworded, stay | One card, one row per provider, status line under the name, a switch and "Configure" opening the existing forms in a sheet; pending steps call for action on the row ("Finish setup", "Reconnect"). No brand logo: the design system ships none, so lucide stays and no exception to "lucide only" was written |
| R3-11 Action items Reset | D-120 settled | Reset returns to the opening state (current team, open items, no grouping) and hands the focus to the Team facet; every team lasts one visit |
| R3-12 Games title | D-128 fixed | The team header button reads "Jeux d'équipe" through the key "Team games"; the sidebar entry and the games page title stay "Jeux" as their mockups |

### Security of the one-page settings

| Before rework 3 | Now | Tests |
|---|---|---|
| `/settings/security` and `/settings/api-tokens` behind `password.confirm` | Redirects to their anchor, still behind `password.confirm` and `verified` | `tests/Feature/Settings/AccountSettingsPageTest.php` |
| Account state of the security page (`twoFactorEnabled`, `twoFactor.{confirmedAt, recoveryCodesRemaining, recoveryCodesTotal}`, `passkeys`, `emailSecondFactor.*`) sent with the protected page | `security.protected`: null unless the session confirmation is fresh (same key and timeout as the middleware) and the address verified; a partial reload cannot pull it. Before confirmation only instance configuration is sent (`SecuritySettings::offered()` takes no user) | `AccountSettingsPageTest.php` |
| Token page props (`tokens`, `teamGroups`, `mcpUrl`) behind the protected page | `apiTokens.protected`, same rule. `expirationOptions` / `defaultExpiration` are code constants and are sent with the section (approved) | `AccountSettingsPageTest.php`, `tests/Feature/Mcp` |
| Six Fortify two-factor routes, three passkey routes, three e-mail code routes, `apiTokens.store` guarded | Unchanged; `apiTokens.destroy` gains `password.confirm` | `tests/Feature/Settings/PasswordConfirmationGuardTest.php`: 17 actions x 3 accounts (password, SSO-only, SSO-only under `sso_required`), refused without confirmation, let through with it, 423 on JSON, refused after the timeout, wrong password never confirms, unverified account sent to verification; partial reloads, a forged longer confirmation, an SSO-only account sending anything to the dialog, someone else's token, a guest |
| `two_factor_confirmed_at` and `two_factor_email_enabled_at` **shared with every page through `auth.user`** (a leak of the state the security section keeps behind the password) | Hidden on the `User` model | `AccountSettingsPageTest.php` ("missing auth.user.two_factor_*") |
| Fortify's `POST /user/confirm-password`: no throttle; an array `password` gave a 500 | Six tries a minute per account (`throttle:passwordConfirmations`, refusal on the password field) and `password` must be text (`EnsurePasswordIsText`), both attached by route name in `FortifyServiceProvider` | `tests/Feature/Auth/PasswordConfirmationAttemptsTest.php` |
| A reload of `/settings` during an authenticator setup dropped the pending secret | A visit made from the page itself keeps it; a new opening still drops it, as Fortify rules | `AccountSettingsPageTest.php` |

Left as it was (existed before): an unverified account that has confirmed its password can reach Fortify's two-factor routes, which carry no `verified` middleware.

### Totals

Feature suite 5658 passed, 1 skipped (5441 before); Vitest 3699 in 342 files (3580 in 334); `tests/Arch` 93; `npm run check` 989 files; build, types, wayfinder and Pint clean (§1).

### Not verified

- Nothing of rework 3 was seen in a browser: the one-page settings (smooth scroll, the mark following the scroll, the return to the anchor after the confirm page), the password dialog, the sticky phone sub-navigation, the docked reaction bar (overlap with the last card and the phone's sticky foot), the compact phone rail, the integrations rows at 390 px, the "Add a card" flow.
- `tests/Browser/Visual/SettingsPagesVisualTest.php` was edited blind by two lanes and not run; its captures, those of `CrossCuttingVisualTest` and those of the retro session end, ROTI, phone retro header and integrations are stale.

### Items left for the owner

- Retro: French "OK" now reads "Correct" app-wide (only the ROTI uses the key; a ROTI key of its own if refused); the Spanish and German ROTI wording; several columns may each hold a card in editing; whether "Complete" in the phone menu needs a confirmation; the place of "Details" and the warning sentence of the health card; the phone subtitle text ("Voting · 4/7" against the mockup's per-phase variants), tappable markers, the leader line; the "Closed" badge now on every survey card of a session end; `BuildSummaryInput` still reads the stored `is_closed` for the AI summary.
- Settings: the Spanish feminine badge and the wording of the regeneration dialog (no mockup); English "On" / "Off" are the only values that differ from their key (listed in `TranslationKeysTest`).
- Integrations: what the switch should be (mirror of the connection, a real paused state needing a spec, or none); brand logos (an asset set, the mockup's letter marks, or lucide; lucide's `Slack` glyph is deprecated, so Slack keeps `Hash`); the short purpose line of a provider that is not connected.
- Action items: whether "no memory" means no stored filter at all (a picked team, status, assignee and grouping are still remembered); every team survives a reload only when the URL has a query; the phone drawer count still counts the team facet.
- Games: whether English, Spanish and German should keep "Team games" on the team header (the English mockup says "Games"), and whether the games page title itself should read "Jeux d'équipe".
