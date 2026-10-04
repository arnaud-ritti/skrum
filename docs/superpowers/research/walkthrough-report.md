# Walkthrough report: browser and feature tests after plans 19 to 29

Date: 2026-10-04. Branch `roadmap`, after the ten test lanes were merged.

## Result

- Browser suite (Pest browser, Playwright Chromium, PostgreSQL, 4 shards): **1134 passed, 0 failed, 0 skipped**, 1489 s.
  The first full run gave 1110 passed and 24 failed. Running the failing files alone showed that every
  failure happened again: none was a flake. Each one was fixed (see below).
- PHP suite on PostgreSQL: **7893 passed, 2 skipped**. The concurrency suite: 62 passed, 1 skipped. Arch: 107 passed.
- Gates: PHPStan 0 errors, Pint, `tsc`, `vp check`, and the build all pass.

## Browser tests per area

| Area | Test cases | New in this pass |
| --- | ---: | --- |
| Access, invitations, onboarding | 58 | Roadmap25 walkthrough |
| Poker | 81 | Roadmap22 poker room |
| Action items | 47 | Roadmap24 list and bulk |
| Surveys and health check | 82 | Plan19 team surveys |
| Retro | 117 | Plan 21 retro facilitation |
| Whiteboard | 103 | Roadmap20 toolbars |
| Games | 108 | four Roadmap27 files |
| Integrations | 108 | (existing files updated) |
| Team, workspace, sessions | 111 | Roadmap22 sessions index, Roadmap23 x2 |
| Account, settings, admin | 105 | Roadmap26 account, Roadmap29 administration |
| Design-system bench and smoke | 15 | (the bench test runs once per section) |
| **Total** | **935** (1134 with datasets) | 16 new walkthrough files, 210 new cases |

## App bugs found and fixed

- **Action items**: an observer could still edit or delete items they had written, alone or in bulk. The page now also disables the box, the status button and the menu for observed teams.
- **Poker**: the deck tile hid `?` and `☕` inside the `+n` counter.
- **Surveys**:
  - Preview in the builder was always disabled.
  - The "required" error stayed after the question was answered.
  - The results read "1 answers".
  - Figures ignored the reader's language, and the mean and NPS had no labels.
- **Retro**:
  - The card's Discuss button ignored the restarted topic timer and the "discussed" mark.
  - The topic timer wrapped at 1440.
  - "Games we played" read "1 rounds".
- **Whiteboard**:
  - The selection count chip overflowed the page on a phone.
  - The board menu took the focus away from the dialog it had just opened.
  - "Find on canvas" did not focus the search field.
- **Games**:
  - The hangman word was hidden under the dock on short phones.
  - The teller of a Two truths round did not see the lie without a reload.
  - A vote was undone on screen by a snapshot refetch.
  - The History showed "—" for Mood weather and Two truths rounds.
  - The turn timer was placed wrong, and the settings labels were cut.
- **Account**:
  - The delete-account password field shared an id with another field, which broke the focus.
  - `/admin/sign-in` crashed: a page prop overwrote the sidebar's `workspaces`.
- **Team settings** (this pass): at 390 px in French, the sprint length choices ran past the page edge. They now shrink.

## Test harness fixes (this pass)

- Plan 21's retro captures were written for light, 1440, French only, so in a full run they failed the language check. `captureVisuals` now takes a `configuration` argument.
- Captures now wait for a chart to be drawn again after the resize. The ROTI trend is drawn at its old width for one frame.
- P24-16-01 now checks the list below 80rem.
- P22-20-04 now sizes the window before it fills the form.
- The security settings test now expects `/settings`.
- The admin sign-in capture now moves the clock forward between configurations, because password confirmation allows 6 tries a minute.

## Mockup divergences

**Fixed:**
- ActionsPage: the French bulk bar and sprint group labels.
- ScreenSurvey: the figures, labels and "Exporter CSV".
- DeckPicker: the tile values.
- ScreenIcebreaker: the timer placement and the settings labels.
- Discussing: the timer no longer wraps.

**Still open (reported by the lanes, owner's call):**
- **Login and onboarding**:
  - Login footer.
  - Onboarding step 3 lead, header language switcher and step 4 date field.
  - The expired invitation title.
  - There is no mobile landing page.
- **Poker**:
  - Mobile: the players row is below the fold.
  - The criteria column.
  - The table centre content.
  - The final-estimate preselection.
  - The estimation history filters and export.
  - The compact rounds list.
- **Actions**:
  - The ticket chip.
  - The search width.
  - The breadcrumb.
  - The badge case.
  - The source line.
  - The date format.
  - Dense `ActionItem` rows.
  - A selection that survives a resize.
- **Surveys**:
  - The health statements switch and its wording.
  - The per-card header.
  - The mood chart band and threshold.
- **Retro**:
  - The compact stepper.
  - The placement of `+2 min`.
  - The add-column form shown open.
  - Lock icons.
  - The vote button style.
  - Expanded action items.
  - The focus banner.
  - The FacilitatorBar overlap.
  - The mobile vote stepper.
- **Whiteboard**:
  - Dot grid.
  - Zoom bar and minimap order (P20-11).
  - Fit-to-screen on open on a phone.
  - The selection bar lies over the Styles panel.
- **Games**:
  - The misses badge wording.
  - The drawer's word in capitals.
  - The Emoji round leaderboard and hints.
  - The GIF "Your votes" block.
  - The "Votes: n" vs "n votes" wording.
- **Integrations**:
  - Segmented tabs vs the side navigation.
  - Brand logos.
  - The "Not connected · purpose" line.
- **Team**:
  - Four creation tiles.
  - The Remove button in the team members card.
  - The dashboard's compact action rows.
  - The missing "New …" buttons per section.
  - The session dialog's invitation block.
- **Account**:
  - 404: the search and Help links.
  - Security: "last changed".
  - The API token scopes.
  - Four of the six notification events.
  - The licence card (an owner decision).

## Test cases removed

None. Every failure was a stale test or an app bug. Cases that covered removed features were rewritten under the same ID to prove the current behaviour:
- **Health-check phase**: P08b-02, 03b, 03c and 06 now test the health check attached to the retro (D-102, scale of 5).
- **Settings toggle**: P08b-07 now uses Remove and "Add survey".
- **One assertion removed**: in P08a-04a, the `#retro-health-check` switch, because the phase was removed.

## Feature and unit tests added

- **97 Pest feature cases.** 9 new files, for example:
  - roles for the health check and team surveys
  - facilitation access
  - settings guest access
  - integration route authorization
  - poker import browsing
  - invitation throttle
  - onboarding validation
  - new games for guests
- **28 Vitest cases.**

## Remaining risks (not tested)

- **Other engines:** the browser suite runs on PostgreSQL only. MariaDB, MySQL and SQLite are covered by the PHP suite, not by the browser.
- **Other browsers:** only Chromium runs; Firefox and WebKit do not.
- **Visual baselines:** the captures check overflow, theme and language. They do not compare pixels. About 400 committed baselines are out of date and were not regenerated; that is a separate decision.
- **Not automated:**
  - a real Chrome extension
  - real Jira, Linear, GitHub and Slack accounts (all faked)
  - real mail delivery
  - a human eye on the screens
- **Small known gap:** if the window is resized across 768 px while the New session form is open, the form starts over. The dialog is replaced by a drawer.

## Coverage, review fixes and quality

Date: 2026-10-04. Branch `roadmap`, after the ten coverage lanes, the review majors lane and the quality lane were merged (`db647cc9`).

### Counts

- **Browser suite** (Pest browser, Playwright Chromium, PostgreSQL, 4 shards): **1272 tests: 1269 passed, 3 failed**, 1711 s. All three failures were timeouts in a run that shared the machine with the PostgreSQL PHP suite: P22-20-03 in `SessionCreateVisualTest` and P17b-02 and P17b-04 in `Plan17bWhiteboardTemplatesTest`. Both files then passed when run alone (8 and 29 tests). This makes **1272 of 1272 green**. Pest warns that `tests/.pest/shards.json` is out of date, so the shards are not balanced; it does not affect the results.
- **PHP suite on PostgreSQL** (4 processes): **7940 passed, 2 skipped** (63128 assertions). Concurrency suite: 62 passed, 1 skipped. Arch: 107 passed.
- **Vitest**: 569 files, **5797 passed**.
- **GET routes**: 115 in the application (136 with vendor routes such as Fortify, Horizon and Boost). **112 of 115** are listed in the area matrices, each with a test that renders it for the right person and one that refuses it to the wrong one. The 3 that no matrix lists are covered by feature tests only: `brand/{asset}` (`BrandAssetsTest`), `emoji-data/{version}/{locale}/{file}` (`EmojiDataTest`) and `dev/mail/{mail}` (`MailMockupTest`).
- **Mockups** (105 rows in the matrices; one row groups seven components): **31 match**, **30 fixed** (14 fully, 16 with items still open), **60 with open items** (44 not touched, plus the 16 above). Most open items were already listed under "Mockup divergences" above.
- **Review majors**: 7 fixed, 1 not reproduced (see below).

### Per-area matrices

Each matrix lists the GET routes, the mockups and the acceptance criteria of its plan, with the test that proves each row.

- [Access, invitations, onboarding](coverage/access.md)
- [Account, settings, administration](coverage/account.md)
- [Action items](coverage/actions.md)
- [Games](coverage/games.md)
- [Integrations and settings screens](coverage/integrations.md)
- [Planning poker](coverage/poker.md)
- [Retro](coverage/retro.md)
- [Surveys and health check](coverage/surveys.md)
- [Team, workspace, sessions, dashboard, palette and errors](coverage/team.md)
- [Whiteboard](coverage/whiteboard.md)

### Review majors fixed

- **Throttles** (`routes/web.php`, `routes/settings.php`): throttles without a prefix shared one counter per user or IP. Ten emoji-data or GIF requests made guest joins, poker auto-reveal and the integration tests return 429. Each throttle now has its own key (`daa4936d`). The counters reset once on deploy.
- **Delete account** (`ProfileDeleteRequest`, `delete-account-card.tsx`): an SSO account that never set a password was asked for one and could not delete itself. Fixed (`7e29245e`).
- **Production compose files**: `/app/storage/app` had no volume, so avatars and brand assets were lost on every `pull && up`. Fixed (`2a6c17d3`).
- **Action item facets**: the arrows and Enter did nothing in the Status and Priority popovers, because the listbox had no name and `aria-controls` pointed at a missing id. Fixed (`3dcb5f64`).
- **Comboboxes** (`skrum/combobox`, admin candidate combobox, audit filters): `aria-controls` pointed at an id cmdk overwrites. Fixed (`3dcb5f64`).
- **Guest export refusal test** (`ActionItemExportTest`): the member was still signed in, so the guest case was never tested. The test is fixed (`2e932794`); the app was already right (403).
- **French link shares** (`lang/fr.json`): "vous invite" became tu (`0bb9a1bb`).
- **Not reproduced**: focus loss on keyboard reorder in the survey builder. React restores the focus after its commit. Tests were added and the code is unchanged. Checked in Chromium, plus a jsdom simulation for Firefox and WebKit.

### App bugs found by the coverage lanes

- **Fixed**:
  - Poker: square corners on every card face.
  - Poker: "1 tickets imported" at creation.
  - Action items: Previous and Next dropped the "select every match" state.
  - Action items: the French done status read "Terminé" instead of "Fait".
  - Whiteboard: every option in the Styles panel looked selected.
  - Team: `?` opened the shortcuts dialog and was also typed into its search.
  - Team: the workspace tile link wrapped.
  - Access: the team invite link was shown with its scheme.
  - Account: the demo admin was not an instance admin.
  - Surveys: the slider bench read "1 minutes".
- **Not fixed**:
  - Retro: the compact phase stepper cuts the phase name while the timer runs.
  - Retro: the "Rafale de 200" chips on the ReactionBar bench overlap.
  - Access: a pasted 6-digit code does not submit by itself after a refused code.

### Quality tools

- **Rector** (PHP 8.4, Laravel and Pest sets): 262 files changed. Every hunk was reviewed. 26 files were reverted and skipped in `rector.php`. `composer rector:check` now reports 0 changes.
- **Pint**: 26 files reformatted after Rector, then clean.
- **PHPStan** (level 7, no baseline, no ignores): 0 errors.
- **`vp check`**: 1453 files formatted, no lint warning or error.
- **`tsc`**: 0 errors.
- **`composer ci:check`**: green. It now runs in parallel and includes Pest on SQLite in memory: 7935 passed, 7 skipped.
- **Wayfinder generate and the build**: no diff.
