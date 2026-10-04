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
