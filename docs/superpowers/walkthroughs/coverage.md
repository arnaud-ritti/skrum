# Walkthrough coverage

Spec: `docs/superpowers/specs/2026-10-01-browser-e2e-and-arch-tests-design.md` (§4). One row per walkthrough step. A step that became several tests has one row per test, or one row naming its tests.

| Status             | Meaning                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `auto`             | Covered by a browser test as written.                                                           |
| `auto-substituted` | Covered by a browser test using a substitution from spec §3.6.                                  |
| `residual`         | Not automated; listed in `residual-manual-checklist.md` with the reason.                        |
| `removed`          | The walkthrough step describes a feature removed from the product; no test, no checklist entry. |

A test is found by its identifier: `vendor/bin/pest tests/Browser/Walkthroughs --filter='P10a-07'`.

## Summary

| Walkthrough                                       | Rows    | `auto`  | `auto-substituted` | `residual` |
| ------------------------------------------------- | ------- | ------- | ------------------ | ---------- |
| Plan 4, retro core                                | 26      | 19      | 5                  | 2          |
| Plan 10a, poker core                              | 16      | 13      | 3                  | 0          |
| Plan 10b, poker additions                         | 28      | 19      | 5                  | 4          |
| Plan 6: polish pass                               | 15      | 7       | 6                  | 2          |
| Plan 7: board engagement                          | 21      | 12      | 6                  | 3          |
| Plan 9a: action items core                        | 9       | 9       | 0                  | 0          |
| Plan 9b: action items scope additions             | 13      | 11      | 2                  | 0          |
| Plan 8a: flow and templates                       | 14      | 14      | 0                  | 0          |
| Plan 8b: health check                             | 11      | 10      | 1                  | 0          |
| Plan 8c: surveys                                  | 10      | 10      | 0                  | 0          |
| Plan 8d: results                                  | 16      | 13      | 1                  | 2          |
| Plan 8e: LLM features                             | 22      | 9       | 11                 | 2          |
| Plan 13a: games foundation                        | 11      | 5       | 5                  | 1          |
| Plan 13b: Draw & Guess and Decoded                | 21      | 11      | 8                  | 2          |
| Plan 13c: Sprint in one GIF                       | 8       | 0       | 7                  | 1          |
| Plan 13d: icebreaker, scores, invites             | 26      | 16      | 7                  | 3          |
| Plan 12a: integrations foundation                 | 15      | 2       | 7                  | 6          |
| Plan 12b: sharing                                 | 13      | 2       | 6                  | 5          |
| Plan 14a: Microsoft Teams and Mattermost          | 9       | 0       | 7                  | 2          |
| Plan 12c: poker trackers                          | 16      | 3       | 10                 | 3          |
| Plan 12d: action item export                      | 11      | 0       | 8                  | 3          |
| Plan 14b: outgoing webhooks                       | 14      | 2       | 11                 | 1          |
| Plan 15: webhook redelivery                       | 6       | 2       | 3                  | 1          |
| Plan 11b: MCP (API tokens page)                   | 21      | 4       | 3                  | 14         |
| Plan 14c: Jira Data Center and GitHub trackers    | 18      | 0       | 16                 | 2          |
| Plan 14d: status sync                             | 26      | 0       | 25                 | 1          |
| Plan 17a: whiteboard core                         | 22      | 9       | 8                  | 5          |
| Plan 17b: whiteboard templates, duplicate, export | 33      | 22      | 8                  | 3          |
| Plan 17c: whiteboard facilitation                 | 27      | 12      | 8                  | 4          |
| Plan 17d: whiteboard secrecy and history          | 15      | 5       | 1                  | 1          |
| **Total**                                         | **513** | **241** | **188**            | **73**     |

Plans 17a to 17d have 11 further rows with the status `removed` (3 in plan 17c, 8 in plan 17d); they are counted in the Rows column and in no other.

## Plan 4: retro board core

Walkthrough: `docs/superpowers/plans/2026-09-29-plan-4-board-ui.md`, Task 9, Steps 1 to 4.

| Id      | Walkthrough step                                          | Test file                                          | Status           |
| ------- | --------------------------------------------------------- | -------------------------------------------------- | ---------------- |
| P04-01  | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto             |
| P04-02  | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto             |
| P04-03  | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto             |
| P04-04  | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto             |
| P04-05a | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto             |
| P04-05b | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto             |
| P04-05c | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto             |
| P04-06  | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto             |
| P04-07  | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto             |
| P04-08a | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto             |
| P04-08b | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto-substituted |
| P04-09  | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto             |
| P04-10  | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto-substituted |
| P04-11  | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto             |
| P04-12  | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1794 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto-substituted |
| P04-13  | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1794 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto             |
| P04-14a | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1795 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto             |
| P04-14b | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1795 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto             |
| P04-14c | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1795 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto             |
| P04-14d | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1795 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto             |
| P04-15a | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1795 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto-substituted |
| P04-15b | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1795 | (none)                                             | residual         |
| P04-16a | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1795 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto-substituted |
| P04-16b | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1795 | (none)                                             | residual         |
| P04-17a | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1796 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto             |
| P04-17b | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1796 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto             |

## Plan 10a: planning poker core

Walkthrough: `docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md`, "Two-browser walkthrough (10a scope)".

| Id                                           | Walkthrough step                                                        | Test file                                           | Status           |
| -------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------- | ---------------- |
| P10a-01                                      | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12535 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto             |
| P10a-02                                      | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12536 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto             |
| P10a-03                                      | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12537 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto             |
| P10a-04 (tests P10a-04a, P10a-04b)           | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12538 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto             |
| P10a-05                                      | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12539 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto-substituted |
| P10a-06                                      | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12540 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto             |
| P10a-07 (tests P10a-07a, P10a-07b, P10a-07c) | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12541 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto-substituted |
| P10a-08                                      | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12542 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto             |
| P10a-09                                      | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12543 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto             |
| P10a-10                                      | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12544 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto             |
| P10a-11                                      | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12545 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto-substituted |
| P10a-12                                      | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12546 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto             |
| P10a-13 (tests P10a-13a, P10a-13b)           | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12547 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto             |
| P10a-14                                      | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12548 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto             |
| P10a-15                                      | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12549 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto             |
| P10a-16                                      | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12550 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto             |

## Plan 10b: planning poker scope additions

Walkthrough: `docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md`, final walkthrough step and the inline check near line 3886.

| Id                                                             | Walkthrough step                                                                  | Test file                                                | Status           |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------- |
| P10b-01                                                        | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5901 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto             |
| P10b-02a                                                       | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5902 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto             |
| P10b-02b                                                       | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5902 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto             |
| P10b-02c                                                       | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5902 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto             |
| P10b-03                                                        | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5903 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto-substituted |
| P10b-04                                                        | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5904 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto             |
| P10b-04t                                                       | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5904 | (none)                                                   | residual         |
| P10b-05                                                        | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5905 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto             |
| P10b-05o                                                       | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5905 | (none)                                                   | residual         |
| P10b-06                                                        | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5906 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto             |
| P10b-07                                                        | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5907 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto-substituted |
| P10b-08a                                                       | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5908 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto-substituted |
| P10b-08b                                                       | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5908 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto-substituted |
| P10b-08s                                                       | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5908 | (none)                                                   | residual         |
| P10b-09                                                        | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5909 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto-substituted |
| P10b-10a                                                       | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5910 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto             |
| P10b-10b                                                       | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5910 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto             |
| P10b-11a                                                       | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5911 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto             |
| P10b-11b                                                       | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5911 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto             |
| P10b-12                                                        | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5912 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto             |
| P10b-13                                                        | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5913 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto             |
| P10b-14                                                        | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5914 | (none)                                                   | residual         |
| P10b-15a                                                       | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5915 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto             |
| P10b-15b                                                       | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5915 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto             |
| P10b-15c                                                       | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5915 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto             |
| P10b-15d (test P04-14c)                                        | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5915 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php       | auto             |
| P10b-15a, P10b-15b, P10b-15c (Task 6 Step 7 retro smoke check) | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:3886 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto             |
| P10b-16 (tests P10b-16a, P10b-16b)                             | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5916 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto             |

## Plan 6: polish pass

Walkthrough: `docs/superpowers/plans/2026-09-29-plan-6-polish-pass.md, final verification task`.

| Id                   | Walkthrough step                                            | Test file                                           | Status           |
| -------------------- | ----------------------------------------------------------- | --------------------------------------------------- | ---------------- |
| P06-01               | docs/superpowers/plans/2026-09-29-plan-6-polish-pass.md:717 | (none)                                              | residual         |
| P06-02               | docs/superpowers/plans/2026-09-29-plan-6-polish-pass.md:718 | tests/Browser/Walkthroughs/Plan06PolishPassTest.php | auto-substituted |
| P06-03               | docs/superpowers/plans/2026-09-29-plan-6-polish-pass.md:718 | tests/Browser/Walkthroughs/Plan06PolishPassTest.php | auto             |
| P06-04a              | docs/superpowers/plans/2026-09-29-plan-6-polish-pass.md:718 | tests/Browser/Walkthroughs/Plan06PolishPassTest.php | auto             |
| P06-04b              | docs/superpowers/plans/2026-09-29-plan-6-polish-pass.md:718 | tests/Browser/Walkthroughs/Plan06PolishPassTest.php | auto             |
| P06-05               | docs/superpowers/plans/2026-09-29-plan-6-polish-pass.md:718 | tests/Browser/Walkthroughs/Plan06PolishPassTest.php | auto             |
| P06-06               | docs/superpowers/plans/2026-09-29-plan-6-polish-pass.md:718 | tests/Browser/Walkthroughs/Plan06PolishPassTest.php | auto             |
| P06-07a              | docs/superpowers/plans/2026-09-29-plan-6-polish-pass.md:718 | tests/Browser/Walkthroughs/Plan06PolishPassTest.php | auto             |
| P06-07b              | docs/superpowers/plans/2026-09-29-plan-6-polish-pass.md:718 | tests/Browser/Walkthroughs/Plan06PolishPassTest.php | auto-substituted |
| P06-08a              | docs/superpowers/plans/2026-09-29-plan-6-polish-pass.md:719 | tests/Browser/Walkthroughs/Plan06PolishPassTest.php | auto-substituted |
| P06-08b              | docs/superpowers/plans/2026-09-29-plan-6-polish-pass.md:719 | (none)                                              | residual         |
| P06-09 (test P04-03) | docs/superpowers/plans/2026-09-29-plan-6-polish-pass.md:719 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php  | auto             |
| P06-10a              | docs/superpowers/plans/2026-09-29-plan-6-polish-pass.md:720 | tests/Browser/Walkthroughs/Plan06PolishPassTest.php | auto-substituted |
| P06-10b              | docs/superpowers/plans/2026-09-29-plan-6-polish-pass.md:720 | tests/Browser/Walkthroughs/Plan06PolishPassTest.php | auto-substituted |
| P06-11               | docs/superpowers/plans/2026-09-29-plan-6-polish-pass.md:720 | tests/Browser/Walkthroughs/Plan06PolishPassTest.php | auto-substituted |

## Plan 7: board engagement

Walkthrough: `docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md, final walkthrough`.

| Id      | Walkthrough step                                                  | Test file                                                | Status           |
| ------- | ----------------------------------------------------------------- | -------------------------------------------------------- | ---------------- |
| P07-01a | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4867 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto             |
| P07-01b | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4867 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto-substituted |
| P07-01t | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4867 | (none)                                                   | residual         |
| P07-02a | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4868 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto             |
| P07-02b | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4868 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto-substituted |
| P07-03a | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4869 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto             |
| P07-03b | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4869 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto-substituted |
| P07-04a | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4870 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto             |
| P07-04b | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4870 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto             |
| P07-05a | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4871 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto-substituted |
| P07-05b | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4871 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto-substituted |
| P07-05r | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4871 | (none)                                                   | residual         |
| P07-06a | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4872 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto             |
| P07-06b | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4872 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto             |
| P07-07a | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4873 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto             |
| P07-07b | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4873 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto-substituted |
| P07-08a | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4874 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto             |
| P07-08b | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4874 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto             |
| P07-09  | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4875 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto             |
| P07-10  | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4876 | tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php | auto             |
| P07-11  | docs/superpowers/plans/2026-09-29-plan-7-board-engagement.md:4877 | (none)                                                   | residual         |

## Plan 9a: action items core

Walkthrough: `docs/superpowers/plans/2026-10-01-plan-9a-action-items-core.md, final walkthrough`.

| Id       | Walkthrough step                                                    | Test file                                                 | Status |
| -------- | ------------------------------------------------------------------- | --------------------------------------------------------- | ------ |
| P09a-01a | docs/superpowers/plans/2026-10-01-plan-9a-action-items-core.md:7684 | tests/Browser/Walkthroughs/Plan09aActionItemsCoreTest.php | auto   |
| P09a-01b | docs/superpowers/plans/2026-10-01-plan-9a-action-items-core.md:7684 | tests/Browser/Walkthroughs/Plan09aActionItemsCoreTest.php | auto   |
| P09a-01c | docs/superpowers/plans/2026-10-01-plan-9a-action-items-core.md:7684 | tests/Browser/Walkthroughs/Plan09aActionItemsCoreTest.php | auto   |
| P09a-02  | docs/superpowers/plans/2026-10-01-plan-9a-action-items-core.md:7685 | tests/Browser/Walkthroughs/Plan09aActionItemsCoreTest.php | auto   |
| P09a-03a | docs/superpowers/plans/2026-10-01-plan-9a-action-items-core.md:7686 | tests/Browser/Walkthroughs/Plan09aActionItemsCoreTest.php | auto   |
| P09a-03b | docs/superpowers/plans/2026-10-01-plan-9a-action-items-core.md:7686 | tests/Browser/Walkthroughs/Plan09aActionItemsCoreTest.php | auto   |
| P09a-03c | docs/superpowers/plans/2026-10-01-plan-9a-action-items-core.md:7686 | tests/Browser/Walkthroughs/Plan09aActionItemsCoreTest.php | auto   |
| P09a-04  | docs/superpowers/plans/2026-10-01-plan-9a-action-items-core.md:7687 | tests/Browser/Walkthroughs/Plan09aActionItemsCoreTest.php | auto   |
| P09a-05  | docs/superpowers/plans/2026-10-01-plan-9a-action-items-core.md:7688 | tests/Browser/Walkthroughs/Plan09aActionItemsCoreTest.php | auto   |

## Plan 9b: action items scope additions

Walkthrough: `docs/superpowers/plans/2026-10-01-plan-9b-action-items-scope-additions.md, final walkthrough`.

| Id       | Walkthrough step                                                               | Test file                                                      | Status           |
| -------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------- | ---------------- |
| P09b-01a | docs/superpowers/plans/2026-10-01-plan-9b-action-items-scope-additions.md:5229 | tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php | auto             |
| P09b-01b | docs/superpowers/plans/2026-10-01-plan-9b-action-items-scope-additions.md:5229 | tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php | auto             |
| P09b-01c | docs/superpowers/plans/2026-10-01-plan-9b-action-items-scope-additions.md:5229 | tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php | auto             |
| P09b-02a | docs/superpowers/plans/2026-10-01-plan-9b-action-items-scope-additions.md:5230 | tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php | auto             |
| P09b-02b | docs/superpowers/plans/2026-10-01-plan-9b-action-items-scope-additions.md:5230 | tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php | auto             |
| P09b-02c | docs/superpowers/plans/2026-10-01-plan-9b-action-items-scope-additions.md:5230 | tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php | auto             |
| P09b-03  | docs/superpowers/plans/2026-10-01-plan-9b-action-items-scope-additions.md:5231 | tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php | auto             |
| P09b-04  | docs/superpowers/plans/2026-10-01-plan-9b-action-items-scope-additions.md:5232 | tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php | auto             |
| P09b-05  | docs/superpowers/plans/2026-10-01-plan-9b-action-items-scope-additions.md:5233 | tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php | auto             |
| P09b-06a | docs/superpowers/plans/2026-10-01-plan-9b-action-items-scope-additions.md:5234 | tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php | auto-substituted |
| P09b-06b | docs/superpowers/plans/2026-10-01-plan-9b-action-items-scope-additions.md:5234 | tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php | auto             |
| P09b-07  | docs/superpowers/plans/2026-10-01-plan-9b-action-items-scope-additions.md:5235 | tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php | auto-substituted |
| P09b-08  | docs/superpowers/plans/2026-10-01-plan-9b-action-items-scope-additions.md:5236 | tests/Browser/Walkthroughs/Plan09bActionItemsAdditionsTest.php | auto             |

## Plan 8a: flow and templates

Walkthrough: `docs/superpowers/plans/2026-09-30-plan-8a-flow-and-templates.md, final walkthrough`.

| Id       | Walkthrough step                                                     | Test file                                                  | Status |
| -------- | -------------------------------------------------------------------- | ---------------------------------------------------------- | ------ |
| P08a-01a | docs/superpowers/plans/2026-09-30-plan-8a-flow-and-templates.md:6295 | tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php | auto   |
| P08a-01b | docs/superpowers/plans/2026-09-30-plan-8a-flow-and-templates.md:6295 | tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php | auto   |
| P08a-02a | docs/superpowers/plans/2026-09-30-plan-8a-flow-and-templates.md:6296 | tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php | auto   |
| P08a-02b | docs/superpowers/plans/2026-09-30-plan-8a-flow-and-templates.md:6296 | tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php | auto   |
| P08a-03  | docs/superpowers/plans/2026-09-30-plan-8a-flow-and-templates.md:6297 | tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php | auto   |
| P08a-04a | docs/superpowers/plans/2026-09-30-plan-8a-flow-and-templates.md:6298 | tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php | auto   |
| P08a-04b | docs/superpowers/plans/2026-09-30-plan-8a-flow-and-templates.md:6298 | tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php | auto   |
| P08a-04c | docs/superpowers/plans/2026-09-30-plan-8a-flow-and-templates.md:6298 | tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php | auto   |
| P08a-05  | docs/superpowers/plans/2026-09-30-plan-8a-flow-and-templates.md:6299 | tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php | auto   |
| P08a-06  | docs/superpowers/plans/2026-09-30-plan-8a-flow-and-templates.md:6300 | tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php | auto   |
| P08a-07a | docs/superpowers/plans/2026-09-30-plan-8a-flow-and-templates.md:6301 | tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php | auto   |
| P08a-07b | docs/superpowers/plans/2026-09-30-plan-8a-flow-and-templates.md:6301 | tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php | auto   |
| P08a-07c | docs/superpowers/plans/2026-09-30-plan-8a-flow-and-templates.md:6301 | tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php | auto   |
| P08a-07d | docs/superpowers/plans/2026-09-30-plan-8a-flow-and-templates.md:6301 | tests/Browser/Walkthroughs/Plan08aFlowAndTemplatesTest.php | auto   |

## Plan 8b: health check

Walkthrough: `docs/superpowers/plans/2026-09-30-plan-8b-health-check.md, final walkthrough`.

| Id       | Walkthrough step                                               | Test file                                             | Status           |
| -------- | -------------------------------------------------------------- | ----------------------------------------------------- | ---------------- |
| P08b-01a | docs/superpowers/plans/2026-09-30-plan-8b-health-check.md:3682 | tests/Browser/Walkthroughs/Plan08bHealthCheckTest.php | auto             |
| P08b-01b | docs/superpowers/plans/2026-09-30-plan-8b-health-check.md:3682 | tests/Browser/Walkthroughs/Plan08bHealthCheckTest.php | auto             |
| P08b-02  | docs/superpowers/plans/2026-09-30-plan-8b-health-check.md:3683 | tests/Browser/Walkthroughs/Plan08bHealthCheckTest.php | auto             |
| P08b-03a | docs/superpowers/plans/2026-09-30-plan-8b-health-check.md:3684 | tests/Browser/Walkthroughs/Plan08bHealthCheckTest.php | auto-substituted |
| P08b-03b | docs/superpowers/plans/2026-09-30-plan-8b-health-check.md:3684 | tests/Browser/Walkthroughs/Plan08bHealthCheckTest.php | auto             |
| P08b-03c | docs/superpowers/plans/2026-09-30-plan-8b-health-check.md:3684 | tests/Browser/Walkthroughs/Plan08bHealthCheckTest.php | auto             |
| P08b-04  | docs/superpowers/plans/2026-09-30-plan-8b-health-check.md:3685 | tests/Browser/Walkthroughs/Plan08bHealthCheckTest.php | auto             |
| P08b-05a | docs/superpowers/plans/2026-09-30-plan-8b-health-check.md:3686 | tests/Browser/Walkthroughs/Plan08bHealthCheckTest.php | auto             |
| P08b-05b | docs/superpowers/plans/2026-09-30-plan-8b-health-check.md:3686 | tests/Browser/Walkthroughs/Plan08bHealthCheckTest.php | auto             |
| P08b-06  | docs/superpowers/plans/2026-09-30-plan-8b-health-check.md:3687 | tests/Browser/Walkthroughs/Plan08bHealthCheckTest.php | auto             |
| P08b-07  | docs/superpowers/plans/2026-09-30-plan-8b-health-check.md:3688 | tests/Browser/Walkthroughs/Plan08bHealthCheckTest.php | auto             |

## Plan 8c: surveys

Walkthrough: `docs/superpowers/plans/2026-09-30-plan-8c-surveys.md, final walkthrough`.

| Id       | Walkthrough step                                          | Test file                                         | Status |
| -------- | --------------------------------------------------------- | ------------------------------------------------- | ------ |
| P08c-01  | docs/superpowers/plans/2026-09-30-plan-8c-surveys.md:5728 | tests/Browser/Walkthroughs/Plan08cSurveysTest.php | auto   |
| P08c-02a | docs/superpowers/plans/2026-09-30-plan-8c-surveys.md:5728 | tests/Browser/Walkthroughs/Plan08cSurveysTest.php | auto   |
| P08c-02b | docs/superpowers/plans/2026-09-30-plan-8c-surveys.md:5728 | tests/Browser/Walkthroughs/Plan08cSurveysTest.php | auto   |
| P08c-02c | docs/superpowers/plans/2026-09-30-plan-8c-surveys.md:5728 | tests/Browser/Walkthroughs/Plan08cSurveysTest.php | auto   |
| P08c-03  | docs/superpowers/plans/2026-09-30-plan-8c-surveys.md:5728 | tests/Browser/Walkthroughs/Plan08cSurveysTest.php | auto   |
| P08c-04a | docs/superpowers/plans/2026-09-30-plan-8c-surveys.md:5728 | tests/Browser/Walkthroughs/Plan08cSurveysTest.php | auto   |
| P08c-04b | docs/superpowers/plans/2026-09-30-plan-8c-surveys.md:5728 | tests/Browser/Walkthroughs/Plan08cSurveysTest.php | auto   |
| P08c-05  | docs/superpowers/plans/2026-09-30-plan-8c-surveys.md:5728 | tests/Browser/Walkthroughs/Plan08cSurveysTest.php | auto   |
| P08c-06  | docs/superpowers/plans/2026-09-30-plan-8c-surveys.md:5728 | tests/Browser/Walkthroughs/Plan08cSurveysTest.php | auto   |
| P08c-07  | docs/superpowers/plans/2026-09-30-plan-8c-surveys.md:5728 | tests/Browser/Walkthroughs/Plan08cSurveysTest.php | auto   |

## Plan 8d: results

Walkthrough: `docs/superpowers/plans/2026-09-30-plan-8d-results.md, final walkthrough`.

| Id       | Walkthrough step                                          | Test file                                         | Status           |
| -------- | --------------------------------------------------------- | ------------------------------------------------- | ---------------- |
| P08d-01a | docs/superpowers/plans/2026-09-30-plan-8d-results.md:3014 | tests/Browser/Walkthroughs/Plan08dResultsTest.php | auto             |
| P08d-01b | docs/superpowers/plans/2026-09-30-plan-8d-results.md:3014 | tests/Browser/Walkthroughs/Plan08dResultsTest.php | auto             |
| P08d-01c | docs/superpowers/plans/2026-09-30-plan-8d-results.md:3014 | tests/Browser/Walkthroughs/Plan08dResultsTest.php | auto             |
| P08d-02a | docs/superpowers/plans/2026-09-30-plan-8d-results.md:3015 | tests/Browser/Walkthroughs/Plan08dResultsTest.php | auto             |
| P08d-02b | docs/superpowers/plans/2026-09-30-plan-8d-results.md:3015 | tests/Browser/Walkthroughs/Plan08dResultsTest.php | auto             |
| P08d-03  | docs/superpowers/plans/2026-09-30-plan-8d-results.md:3016 | tests/Browser/Walkthroughs/Plan08dResultsTest.php | auto             |
| P08d-04a | docs/superpowers/plans/2026-09-30-plan-8d-results.md:3017 | tests/Browser/Walkthroughs/Plan08dResultsTest.php | auto             |
| P08d-04b | docs/superpowers/plans/2026-09-30-plan-8d-results.md:3017 | tests/Browser/Walkthroughs/Plan08dResultsTest.php | auto             |
| P08d-04c | docs/superpowers/plans/2026-09-30-plan-8d-results.md:3017 | tests/Browser/Walkthroughs/Plan08dResultsTest.php | auto             |
| P08d-04d | docs/superpowers/plans/2026-09-30-plan-8d-results.md:3017 | tests/Browser/Walkthroughs/Plan08dResultsTest.php | auto             |
| P08d-04e | docs/superpowers/plans/2026-09-30-plan-8d-results.md:3017 | tests/Browser/Walkthroughs/Plan08dResultsTest.php | auto             |
| P08d-04v | docs/superpowers/plans/2026-09-30-plan-8d-results.md:3017 | (none)                                            | residual         |
| P08d-05a | docs/superpowers/plans/2026-09-30-plan-8d-results.md:3018 | tests/Browser/Walkthroughs/Plan08dResultsTest.php | auto             |
| P08d-05b | docs/superpowers/plans/2026-09-30-plan-8d-results.md:3018 | tests/Browser/Walkthroughs/Plan08dResultsTest.php | auto             |
| P08d-06  | docs/superpowers/plans/2026-09-30-plan-8d-results.md:3019 | tests/Browser/Walkthroughs/Plan08dResultsTest.php | auto-substituted |
| P08d-06v | docs/superpowers/plans/2026-09-30-plan-8d-results.md:3019 | (none)                                            | residual         |

## Plan 8e: LLM features

Walkthrough: `docs/superpowers/plans/2026-09-30-plan-8e-llm.md, final walkthrough`.

| Id       | Walkthrough step                                      | Test file                                     | Status           |
| -------- | ----------------------------------------------------- | --------------------------------------------- | ---------------- |
| P08e-01a | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5507 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto             |
| P08e-01b | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5507 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto             |
| P08e-02a | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5508 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto             |
| P08e-02b | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5508 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto             |
| P08e-03a | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5509 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto-substituted |
| P08e-03b | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5509 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto             |
| P08e-04a | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5513 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto             |
| P08e-04b | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5513 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto             |
| P08e-04c | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5513 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto             |
| P08e-05a | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5514 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto-substituted |
| P08e-05b | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5514 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto-substituted |
| P08e-06  | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5515 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto-substituted |
| P08e-07  | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5516 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto-substituted |
| P08e-07r | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5516 | (none)                                        | residual         |
| P08e-08  | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5517 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto-substituted |
| P08e-09  | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5518 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto-substituted |
| P08e-10a | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5519 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto             |
| P08e-10b | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5519 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto-substituted |
| P08e-10c | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5519 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto-substituted |
| P08e-11a | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5520 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto-substituted |
| P08e-11b | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5520 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto-substituted |
| P08e-11r | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5511 | (none)                                        | residual         |

## Plan 13a: games foundation

Walkthrough: `docs/superpowers/plans/2026-10-06-plan-13a-games-foundation.md, final walkthrough`.

| Id       | Walkthrough step                                                     | Test file                                                 | Status           |
| -------- | -------------------------------------------------------------------- | --------------------------------------------------------- | ---------------- |
| P13a-01  | docs/superpowers/plans/2026-10-06-plan-13a-games-foundation.md:10651 | tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php | auto             |
| P13a-02  | docs/superpowers/plans/2026-10-06-plan-13a-games-foundation.md:10652 | tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php | auto-substituted |
| P13a-03  | docs/superpowers/plans/2026-10-06-plan-13a-games-foundation.md:10653 | tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php | auto-substituted |
| P13a-04a | docs/superpowers/plans/2026-10-06-plan-13a-games-foundation.md:10654 | tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php | auto             |
| P13a-04b | docs/superpowers/plans/2026-10-06-plan-13a-games-foundation.md:10654 | tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php | auto-substituted |
| P13a-05  | docs/superpowers/plans/2026-10-06-plan-13a-games-foundation.md:10655 | tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php | auto             |
| P13a-06a | docs/superpowers/plans/2026-10-06-plan-13a-games-foundation.md:10656 | tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php | auto-substituted |
| P13a-06b | docs/superpowers/plans/2026-10-06-plan-13a-games-foundation.md:10656 | tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php | auto-substituted |
| P13a-07  | docs/superpowers/plans/2026-10-06-plan-13a-games-foundation.md:10657 | tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php | auto             |
| P13a-08  | docs/superpowers/plans/2026-10-06-plan-13a-games-foundation.md:10658 | (none)                                                    | residual         |
| P13a-09  | docs/superpowers/plans/2026-10-06-plan-13a-games-foundation.md:10659 | tests/Browser/Walkthroughs/Plan13aGamesFoundationTest.php | auto             |

## Plan 13b: Draw & Guess and Decoded

Walkthrough: `docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md, final walkthrough`.

| Id       | Walkthrough step                                                          | Test file                                                | Status           |
| -------- | ------------------------------------------------------------------------- | -------------------------------------------------------- | ---------------- |
| P13b-01  | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5573 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto             |
| P13b-02  | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5574 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto             |
| P13b-03  | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5575 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto-substituted |
| P13b-04a | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5576 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto-substituted |
| P13b-04b | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5576 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto-substituted |
| P13b-04t | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5576 | (none)                                                   | residual         |
| P13b-05a | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5577 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto-substituted |
| P13b-05b | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5577 | (none)                                                   | residual         |
| P13b-05c | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5577 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto             |
| P13b-06  | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5578 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto-substituted |
| P13b-07  | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5579 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto             |
| P13b-08  | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5580 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto             |
| P13b-09  | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5581 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto             |
| P13b-10  | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5582 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto             |
| P13b-11a | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5583 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto-substituted |
| P13b-11b | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5583 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto-substituted |
| P13b-11c | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5583 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto             |
| P13b-12a | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5584 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto             |
| P13b-12b | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5584 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto             |
| P13b-13a | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5585 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto-substituted |
| P13b-13b | docs/superpowers/plans/2026-10-06-plan-13b-games-draw-and-decoded.md:5585 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php | auto             |

## Plan 13c: Sprint in one GIF

Walkthrough: `docs/superpowers/plans/2026-10-06-plan-13c-games-sprint-gif.md, final walkthrough`.

| Id       | Walkthrough step                                                    | Test file                                           | Status           |
| -------- | ------------------------------------------------------------------- | --------------------------------------------------- | ---------------- |
| P13c-01  | docs/superpowers/plans/2026-10-06-plan-13c-games-sprint-gif.md:3918 | tests/Browser/Walkthroughs/Plan13cSprintGifTest.php | auto-substituted |
| P13c-02  | docs/superpowers/plans/2026-10-06-plan-13c-games-sprint-gif.md:3919 | tests/Browser/Walkthroughs/Plan13cSprintGifTest.php | auto-substituted |
| P13c-02r | docs/superpowers/plans/2026-10-06-plan-13c-games-sprint-gif.md:3916 | (none)                                              | residual         |
| P13c-03  | docs/superpowers/plans/2026-10-06-plan-13c-games-sprint-gif.md:3920 | tests/Browser/Walkthroughs/Plan13cSprintGifTest.php | auto-substituted |
| P13c-04  | docs/superpowers/plans/2026-10-06-plan-13c-games-sprint-gif.md:3921 | tests/Browser/Walkthroughs/Plan13cSprintGifTest.php | auto-substituted |
| P13c-05a | docs/superpowers/plans/2026-10-06-plan-13c-games-sprint-gif.md:3922 | tests/Browser/Walkthroughs/Plan13cSprintGifTest.php | auto-substituted |
| P13c-05b | docs/superpowers/plans/2026-10-06-plan-13c-games-sprint-gif.md:3922 | tests/Browser/Walkthroughs/Plan13cSprintGifTest.php | auto-substituted |
| P13c-06  | docs/superpowers/plans/2026-10-06-plan-13c-games-sprint-gif.md:3923 | tests/Browser/Walkthroughs/Plan13cSprintGifTest.php | auto-substituted |

## Plan 13d: icebreaker, scores, invites

Walkthrough: `docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md, final walkthrough`.

| Id       | Walkthrough step                                                                   | Test file                                                                                   | Status           |
| -------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------- |
| P13d-00p | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4429 | (none)                                                                                      | residual         |
| P13d-01  | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4431 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php (`P13b-01` to `P13b-10`, Task 3)   | auto-substituted |
| P13d-02  | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4432 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php (`P13b-01` to `P13b-10`, Task 3)   | auto             |
| P13d-03  | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4433 | tests/Browser/Walkthroughs/Plan13cSprintGifTest.php (`P13c-03`, `P13c-04`, `P13c-05a`)      | auto-substituted |
| P13d-04  | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4434 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php                           | auto             |
| P13d-05  | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4435 | tests/Browser/Walkthroughs/Plan13bDrawAndDecodedTest.php (`P13b-11a` to `P13b-13b`, Task 4) | auto             |
| P13d-06a | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4436 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php                           | auto             |
| P13d-06b | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4437 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php                           | auto             |
| P13d-06c | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4438 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php                           | auto             |
| P13d-06d | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4439 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php                           | auto-substituted |
| P13d-06e | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4440 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php                           | auto             |
| P13d-07  | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4441 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php                           | auto             |
| P13d-08  | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4442 | (none)                                                                                      | residual         |
| P13d-09a | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4444 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php                           | auto             |
| P13d-09b | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4446 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php                           | auto             |
| P13d-10a | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4447 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php                           | auto             |
| P13d-10b | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4447 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php                           | auto             |
| P13d-10c | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4447 | (none)                                                                                      | residual         |
| P13d-11a | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4448 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php                           | auto             |
| P13d-11b | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4448 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php                           | auto             |
| P13d-12a | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4450 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php                           | auto-substituted |
| P13d-12b | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4451 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php                           | auto-substituted |
| P13d-12c | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4452 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php                           | auto             |
| P13d-12d | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4453 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php                           | auto-substituted |
| P13d-12f | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4453 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php                           | auto             |
| P13d-12e | docs/superpowers/plans/2026-10-06-plan-13d-games-icebreaker-scores-invites.md:4454 | tests/Browser/Walkthroughs/Plan13dIcebreakerScoresInvitesTest.php                           | auto-substituted |

## Plan 12a: integrations foundation

Walkthrough: `docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md, final walkthrough`.

| Id       | Walkthrough step                                                           | Test file                                                        | Status           |
| -------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------- |
| P12a-01a | docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md:8360 | tests/Browser/Walkthroughs/Plan12aIntegrationsFoundationTest.php | auto-substituted |
| P12a-01b | docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md:8360 | tests/Browser/Walkthroughs/Plan12aIntegrationsFoundationTest.php | auto             |
| P12a-01c | docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md:8360 | tests/Browser/Walkthroughs/Plan12aIntegrationsFoundationTest.php | auto             |
| P12a-02a | docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md:8361 | tests/Browser/Walkthroughs/Plan12aIntegrationsFoundationTest.php | auto-substituted |
| P12a-02b | docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md:8361 | (none)                                                           | residual         |
| P12a-03a | docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md:8362 | tests/Browser/Walkthroughs/Plan12aIntegrationsFoundationTest.php | auto-substituted |
| P12a-03b | docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md:8362 | (none)                                                           | residual         |
| P12a-04a | docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md:8363 | tests/Browser/Walkthroughs/Plan12aIntegrationsFoundationTest.php | auto-substituted |
| P12a-04b | docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md:8363 | (none)                                                           | residual         |
| P12a-05a | docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md:8364 | tests/Browser/Walkthroughs/Plan12aIntegrationsFoundationTest.php | auto-substituted |
| P12a-05b | docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md:8364 | (none)                                                           | residual         |
| P12a-06a | docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md:8365 | tests/Browser/Walkthroughs/Plan12aIntegrationsFoundationTest.php | auto-substituted |
| P12a-06b | docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md:8365 | (none)                                                           | residual         |
| P12a-07a | docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md:8366 | tests/Browser/Walkthroughs/Plan12aIntegrationsFoundationTest.php | auto-substituted |
| P12a-07b | docs/superpowers/plans/2026-10-05-plan-12a-integrations-foundation.md:8366 | (none)                                                           | residual         |

## Plan 12b: sharing

Walkthrough: `docs/superpowers/plans/2026-10-05-plan-12b-integrations-sharing.md, final walkthrough`.

| Id       | Walkthrough step                                                        | Test file                                                     | Status           |
| -------- | ----------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------- |
| P12b-01a | docs/superpowers/plans/2026-10-05-plan-12b-integrations-sharing.md:4799 | tests/Browser/Walkthroughs/Plan12bIntegrationsSharingTest.php | auto-substituted |
| P12b-01b | docs/superpowers/plans/2026-10-05-plan-12b-integrations-sharing.md:4799 | tests/Browser/Walkthroughs/Plan12bIntegrationsSharingTest.php | auto             |
| P12b-01c | docs/superpowers/plans/2026-10-05-plan-12b-integrations-sharing.md:4789 | tests/Browser/Walkthroughs/Plan12bIntegrationsSharingTest.php | auto             |
| P12b-01d | docs/superpowers/plans/2026-10-05-plan-12b-integrations-sharing.md:4799 | (none)                                                        | residual         |
| P12b-02a | docs/superpowers/plans/2026-10-05-plan-12b-integrations-sharing.md:4800 | tests/Browser/Walkthroughs/Plan12bIntegrationsSharingTest.php | auto-substituted |
| P12b-02b | docs/superpowers/plans/2026-10-05-plan-12b-integrations-sharing.md:4800 | (none)                                                        | residual         |
| P12b-03a | docs/superpowers/plans/2026-10-05-plan-12b-integrations-sharing.md:4801 | tests/Browser/Walkthroughs/Plan12bIntegrationsSharingTest.php | auto-substituted |
| P12b-03b | docs/superpowers/plans/2026-10-05-plan-12b-integrations-sharing.md:4801 | (none)                                                        | residual         |
| P12b-04a | docs/superpowers/plans/2026-10-05-plan-12b-integrations-sharing.md:4802 | tests/Browser/Walkthroughs/Plan12bIntegrationsSharingTest.php | auto-substituted |
| P12b-04b | docs/superpowers/plans/2026-10-05-plan-12b-integrations-sharing.md:4802 | (none)                                                        | residual         |
| P12b-05  | docs/superpowers/plans/2026-10-05-plan-12b-integrations-sharing.md:4803 | tests/Browser/Walkthroughs/Plan12bIntegrationsSharingTest.php | auto-substituted |
| P12b-06a | docs/superpowers/plans/2026-10-05-plan-12b-integrations-sharing.md:4804 | tests/Browser/Walkthroughs/Plan12bIntegrationsSharingTest.php | auto-substituted |
| P12b-06b | docs/superpowers/plans/2026-10-05-plan-12b-integrations-sharing.md:4804 | (none)                                                        | residual         |

## Plan 14a: Microsoft Teams and Mattermost

Walkthrough: `docs/superpowers/plans/2026-10-07-plan-14a-integrations-extended-foundation.md, final walkthrough`.

| Id       | Walkthrough step                                                                    | Test file                                                 | Status           |
| -------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------- |
| P14a-01a | docs/superpowers/plans/2026-10-07-plan-14a-integrations-extended-foundation.md:4142 | tests/Browser/Walkthroughs/Plan14aTeamsMattermostTest.php | auto-substituted |
| P14a-01b | docs/superpowers/plans/2026-10-07-plan-14a-integrations-extended-foundation.md:4142 | tests/Browser/Walkthroughs/Plan14aTeamsMattermostTest.php | auto-substituted |
| P14a-02  | docs/superpowers/plans/2026-10-07-plan-14a-integrations-extended-foundation.md:4142 | tests/Browser/Walkthroughs/Plan14aTeamsMattermostTest.php | auto-substituted |
| P14a-03a | docs/superpowers/plans/2026-10-07-plan-14a-integrations-extended-foundation.md:4142 | tests/Browser/Walkthroughs/Plan14aTeamsMattermostTest.php | auto-substituted |
| P14a-03b | docs/superpowers/plans/2026-10-07-plan-14a-integrations-extended-foundation.md:4142 | tests/Browser/Walkthroughs/Plan14aTeamsMattermostTest.php | auto-substituted |
| P14a-04a | docs/superpowers/plans/2026-10-07-plan-14a-integrations-extended-foundation.md:4142 | tests/Browser/Walkthroughs/Plan14aTeamsMattermostTest.php | auto-substituted |
| P14a-04b | docs/superpowers/plans/2026-10-07-plan-14a-integrations-extended-foundation.md:4142 | (none)                                                    | residual         |
| P14a-05a | docs/superpowers/plans/2026-10-07-plan-14a-integrations-extended-foundation.md:4142 | tests/Browser/Walkthroughs/Plan14aTeamsMattermostTest.php | auto-substituted |
| P14a-05b | docs/superpowers/plans/2026-10-07-plan-14a-integrations-extended-foundation.md:4142 | (none)                                                    | residual         |

## Plan 12c: poker trackers

Walkthrough: `docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md, final walkthrough`.

| Id       | Walkthrough step                                                               | Test file                                               | Status           |
| -------- | ------------------------------------------------------------------------------ | ------------------------------------------------------- | ---------------- |
| P12c-01  | docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md:6235 | tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php | auto-substituted |
| P12c-02a | docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md:6236 | tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php | auto-substituted |
| P12c-02b | docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md:6236 | tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php | auto-substituted |
| P12c-03a | docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md:6237 | tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php | auto-substituted |
| P12c-03b | docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md:6237 | tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php | auto-substituted |
| P12c-03c | docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md:6237 | tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php | auto             |
| P12c-04  | docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md:6238 | tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php | auto-substituted |
| P12c-04r | docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md:6238 | (none)                                                  | residual         |
| P12c-05a | docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md:6239 | tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php | auto-substituted |
| P12c-05b | docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md:6239 | tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php | auto-substituted |
| P12c-06  | docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md:6240 | tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php | auto             |
| P12c-07a | docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md:6241 | tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php | auto-substituted |
| P12c-07b | docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md:6241 | tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php | auto-substituted |
| P12c-07r | docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md:6241 | (none)                                                  | residual         |
| P12c-08  | docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md:6242 | tests/Browser/Walkthroughs/Plan12cPokerTrackersTest.php | auto             |
| P12c-09  | docs/superpowers/plans/2026-10-05-plan-12c-integrations-poker-trackers.md:6243 | (none)                                                  | residual         |

## Plan 12d: action item export

Walkthrough: `docs/superpowers/plans/2026-10-05-plan-12d-integrations-action-item-export.md, final walkthrough`.

| Id       | Walkthrough step                                                                   | Test file                                                  | Status           |
| -------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------- |
| P12d-01  | docs/superpowers/plans/2026-10-05-plan-12d-integrations-action-item-export.md:6431 | tests/Browser/Walkthroughs/Plan12dActionItemExportTest.php | auto-substituted |
| P12d-01r | docs/superpowers/plans/2026-10-05-plan-12d-integrations-action-item-export.md:6431 | (none)                                                     | residual         |
| P12d-02a | docs/superpowers/plans/2026-10-05-plan-12d-integrations-action-item-export.md:6432 | tests/Browser/Walkthroughs/Plan12dActionItemExportTest.php | auto-substituted |
| P12d-02b | docs/superpowers/plans/2026-10-05-plan-12d-integrations-action-item-export.md:6432 | tests/Browser/Walkthroughs/Plan12dActionItemExportTest.php | auto-substituted |
| P12d-03  | docs/superpowers/plans/2026-10-05-plan-12d-integrations-action-item-export.md:6433 | tests/Browser/Walkthroughs/Plan12dActionItemExportTest.php | auto-substituted |
| P12d-03r | docs/superpowers/plans/2026-10-05-plan-12d-integrations-action-item-export.md:6433 | (none)                                                     | residual         |
| P12d-04  | docs/superpowers/plans/2026-10-05-plan-12d-integrations-action-item-export.md:6434 | tests/Browser/Walkthroughs/Plan12dActionItemExportTest.php | auto-substituted |
| P12d-05  | docs/superpowers/plans/2026-10-05-plan-12d-integrations-action-item-export.md:6435 | tests/Browser/Walkthroughs/Plan12dActionItemExportTest.php | auto-substituted |
| P12d-06  | docs/superpowers/plans/2026-10-05-plan-12d-integrations-action-item-export.md:6436 | tests/Browser/Walkthroughs/Plan12dActionItemExportTest.php | auto-substituted |
| P12d-07  | docs/superpowers/plans/2026-10-05-plan-12d-integrations-action-item-export.md:6437 | tests/Browser/Walkthroughs/Plan12dActionItemExportTest.php | auto-substituted |
| P12d-07r | docs/superpowers/plans/2026-10-05-plan-12d-integrations-action-item-export.md:6437 | (none)                                                     | residual         |

## Plan 14b: outgoing webhooks

Walkthrough: `docs/superpowers/plans/2026-10-07-plan-14b-integrations-extended-webhooks.md, final walkthrough`.

| Id       | Walkthrough step                                                                  | Test file                                                  | Status           |
| -------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------- |
| P14b-01  | docs/superpowers/plans/2026-10-07-plan-14b-integrations-extended-webhooks.md:4840 | tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php | auto-substituted |
| P14b-01r | docs/superpowers/plans/2026-10-07-plan-14b-integrations-extended-webhooks.md:4840 | (none)                                                     | residual         |
| P14b-02a | docs/superpowers/plans/2026-10-07-plan-14b-integrations-extended-webhooks.md:4841 | tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php | auto-substituted |
| P14b-02b | docs/superpowers/plans/2026-10-07-plan-14b-integrations-extended-webhooks.md:4841 | tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php | auto-substituted |
| P14b-02c | docs/superpowers/plans/2026-10-07-plan-14b-integrations-extended-webhooks.md:4841 | tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php | auto-substituted |
| P14b-03a | docs/superpowers/plans/2026-10-07-plan-14b-integrations-extended-webhooks.md:4842 | tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php | auto             |
| P14b-03b | docs/superpowers/plans/2026-10-07-plan-14b-integrations-extended-webhooks.md:4842 | tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php | auto-substituted |
| P14b-03c | docs/superpowers/plans/2026-10-07-plan-14b-integrations-extended-webhooks.md:4842 | tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php | auto-substituted |
| P14b-03d | docs/superpowers/plans/2026-10-07-plan-14b-integrations-extended-webhooks.md:4842 | tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php | auto-substituted |
| P14b-04a | docs/superpowers/plans/2026-10-07-plan-14b-integrations-extended-webhooks.md:4843 | tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php | auto-substituted |
| P14b-04b | docs/superpowers/plans/2026-10-07-plan-14b-integrations-extended-webhooks.md:4843 | tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php | auto-substituted |
| P14b-05  | docs/superpowers/plans/2026-10-07-plan-14b-integrations-extended-webhooks.md:4844 | tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php | auto-substituted |
| P14b-06  | docs/superpowers/plans/2026-10-07-plan-14b-integrations-extended-webhooks.md:4845 | tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php | auto-substituted |
| P14b-07  | docs/superpowers/plans/2026-10-07-plan-14b-integrations-extended-webhooks.md:4840 | tests/Browser/Walkthroughs/Plan14bOutgoingWebhooksTest.php | auto             |

## Plan 15: webhook redelivery

Walkthrough: `docs/superpowers/plans/2026-10-08-plan-15-webhook-redelivery.md, final walkthrough`.

| Id      | Walkthrough step                                                     | Test file                                                  | Status           |
| ------- | -------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------- |
| P15-01  | docs/superpowers/plans/2026-10-08-plan-15-webhook-redelivery.md:2505 | tests/Browser/Walkthroughs/Plan15WebhookRedeliveryTest.php | auto-substituted |
| P15-01r | docs/superpowers/plans/2026-10-08-plan-15-webhook-redelivery.md:2505 | (none)                                                     | residual         |
| P15-02  | docs/superpowers/plans/2026-10-08-plan-15-webhook-redelivery.md:2505 | tests/Browser/Walkthroughs/Plan15WebhookRedeliveryTest.php | auto-substituted |
| P15-03  | docs/superpowers/plans/2026-10-08-plan-15-webhook-redelivery.md:2505 | tests/Browser/Walkthroughs/Plan15WebhookRedeliveryTest.php | auto-substituted |
| P15-04  | docs/superpowers/plans/2026-10-08-plan-15-webhook-redelivery.md:2505 | tests/Browser/Walkthroughs/Plan15WebhookRedeliveryTest.php | auto             |
| P15-05  | docs/superpowers/plans/2026-10-08-plan-15-webhook-redelivery.md:2505 | tests/Browser/Walkthroughs/Plan15WebhookRedeliveryTest.php | auto             |

## Plan 11b: MCP (API tokens page)

Walkthrough: `docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md, final walkthrough`.

| Id       | Walkthrough step                                                            | Test file                                           | Status           |
| -------- | --------------------------------------------------------------------------- | --------------------------------------------------- | ---------------- |
| P11b-01  | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4522 | tests/Browser/Walkthroughs/Plan11bApiTokensTest.php | auto             |
| P11b-02  | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4523 | tests/Browser/Walkthroughs/Plan11bApiTokensTest.php | auto             |
| P11b-03a | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4524 | (none)                                              | residual         |
| P11b-03b | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4524 | tests/Browser/Walkthroughs/Plan11bApiTokensTest.php | auto-substituted |
| P11b-04  | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4525 | (none)                                              | residual         |
| P11b-05  | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4526 | (none)                                              | residual         |
| P11b-06  | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4527 | (none)                                              | residual         |
| P11b-07  | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4528 | (none)                                              | residual         |
| P11b-08  | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4529 | (none)                                              | residual         |
| P11b-09  | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4530 | (none)                                              | residual         |
| P11b-10  | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4531 | (none)                                              | residual         |
| P11b-11  | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4532 | (none)                                              | residual         |
| P11b-12  | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4533 | (none)                                              | residual         |
| P11b-13  | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4534 | (none)                                              | residual         |
| P11b-14  | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4535 | (none)                                              | residual         |
| P11b-15a | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4536 | tests/Browser/Walkthroughs/Plan11bApiTokensTest.php | auto             |
| P11b-15b | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4536 | (none)                                              | residual         |
| P11b-16  | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4537 | tests/Browser/Walkthroughs/Plan11bApiTokensTest.php | auto-substituted |
| P11b-17  | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4538 | tests/Browser/Walkthroughs/Plan11bApiTokensTest.php | auto-substituted |
| P11b-18a | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4539 | tests/Browser/Walkthroughs/Plan11bApiTokensTest.php | auto             |
| P11b-18b | docs/superpowers/plans/2026-10-03-plan-11b-mcp-writes-poker-prompts.md:4539 | (none)                                              | residual         |

## Plan 14c: Jira Data Center and GitHub trackers

Walkthrough: `docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md, final walkthrough`.

| Id       | Walkthrough step                                                                  | Test file                                          | Status           |
| -------- | --------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------- |
| P14c-01  | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | tests/Browser/Walkthroughs/Plan14cTrackersTest.php | auto-substituted |
| P14c-01b | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | (none)                                             | residual         |
| P14c-02  | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | tests/Browser/Walkthroughs/Plan14cTrackersTest.php | auto-substituted |
| P14c-03  | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | tests/Browser/Walkthroughs/Plan14cTrackersTest.php | auto-substituted |
| P14c-04  | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | tests/Browser/Walkthroughs/Plan14cTrackersTest.php | auto-substituted |
| P14c-05a | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | tests/Browser/Walkthroughs/Plan14cTrackersTest.php | auto-substituted |
| P14c-05b | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | tests/Browser/Walkthroughs/Plan14cTrackersTest.php | auto-substituted |
| P14c-05c | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | tests/Browser/Walkthroughs/Plan14cTrackersTest.php | auto-substituted |
| P14c-06  | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | tests/Browser/Walkthroughs/Plan14cTrackersTest.php | auto-substituted |
| P14c-07  | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | tests/Browser/Walkthroughs/Plan14cTrackersTest.php | auto-substituted |
| P14c-07b | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | (none)                                             | residual         |
| P14c-08  | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | tests/Browser/Walkthroughs/Plan14cTrackersTest.php | auto-substituted |
| P14c-09a | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | tests/Browser/Walkthroughs/Plan14cTrackersTest.php | auto-substituted |
| P14c-09b | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | tests/Browser/Walkthroughs/Plan14cTrackersTest.php | auto-substituted |
| P14c-10  | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | tests/Browser/Walkthroughs/Plan14cTrackersTest.php | auto-substituted |
| P14c-11  | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | tests/Browser/Walkthroughs/Plan14cTrackersTest.php | auto-substituted |
| P14c-12  | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | tests/Browser/Walkthroughs/Plan14cTrackersTest.php | auto-substituted |
| P14c-13  | docs/superpowers/plans/2026-10-07-plan-14c-integrations-extended-trackers.md:6860 | tests/Browser/Walkthroughs/Plan14cTrackersTest.php | auto-substituted |

## Plan 14d: status sync

Walkthrough: `docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md, final walkthrough`.

| Id       | Walkthrough step                                                                     | Test file                                            | Status           |
| -------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------- | ---------------- |
| P14d-01a | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-01b | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-02  | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-03a | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-03b | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-04a | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-04b | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-05a | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-05b | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-06  | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-07a | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-07b | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-07c | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-08a | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-08b | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-09a | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-09b | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-10a | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-10b | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-10c | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-10d | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-11a | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-11b | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-12  | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |
| P14d-13  | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | (none)                                               | residual         |
| P14d-13a | docs/superpowers/plans/2026-10-07-plan-14d-integrations-extended-status-sync.md:8524 | tests/Browser/Walkthroughs/Plan14dStatusSyncTest.php | auto-substituted |

## Plan 17a: whiteboard core

Walkthrough: `docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md`.

| Id       | Walkthrough step                                                                                 | Test file                                                | Status           |
| -------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | ---------------- |
| P17a-00  | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:12                                     | (none)                                                   | residual         |
| P17a-01  | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:24                                     | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto             |
| P17a-02a | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:30                                     | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto             |
| P17a-02b | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:33                                     | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto-substituted |
| P17a-02c | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:33                                     | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto-substituted |
| P17a-02d | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:33                                     | (none)                                                   | residual         |
| P17a-02e | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:34                                     | (none)                                                   | residual         |
| P17a-03a | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:36                                     | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto-substituted |
| P17a-03b | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:36                                     | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto-substituted |
| P17a-04  | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:42 (and :19, "Reload causes no write") | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto             |
| P17a-05a | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:48                                     | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto-substituted |
| P17a-05b | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:48                                     | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto-substituted |
| P17a-06a | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:54                                     | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto             |
| P17a-06b | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:57                                     | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto             |
| P17a-07a | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:60                                     | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto             |
| P17a-07b | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:63                                     | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto-substituted |
| P17a-08a | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:66                                     | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto             |
| P17a-08b | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:69                                     | (none)                                                   | residual         |
| P17a-09  | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:18                                     | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto             |
| P17a-10  | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:20                                     | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto             |
| P17a-11  | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:72                                     | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php | auto-substituted |
| P17a-12  | docs/superpowers/walkthroughs/plan-17a-whiteboard-core.md:21 (and :10)                           | (none)                                                   | residual         |

## Plan 17b: whiteboard templates, duplicate, export

Walkthrough: `docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md`.

| Id       | Walkthrough step                                                              | Test file                                                     | Status           |
| -------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------- |
| P17b-00  | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:25 (to :29)    | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php      | auto             |
| P17b-01a | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:48             | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto             |
| P17b-01b | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:48             | (none)                                                        | residual         |
| P17b-02  | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:49 (and :51)   | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto             |
| P17b-03  | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:50             | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto-substituted |
| P17b-04  | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:52             | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto-substituted |
| P17b-05  | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:53 (and :54)   | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto             |
| P17b-06  | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:55             | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto             |
| P17b-07  | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:56             | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto             |
| P17b-08  | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:62             | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto             |
| P17b-09  | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:63             | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto             |
| P17b-10  | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:64 (to :67)    | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto             |
| P17b-11  | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:68             | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto-substituted |
| P17b-12  | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:69 (and :70)   | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto             |
| P17b-13  | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:71             | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto             |
| P17b-14  | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:72             | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto             |
| P17b-15  | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:73             | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto             |
| P17b-16  | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:79 (and :80)   | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto             |
| P17b-17  | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:81 (and :82)   | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto             |
| P17b-18  | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:83 (and :84)   | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto             |
| P17b-19  | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:92             | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto-substituted |
| P17b-20  | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:93             | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto-substituted |
| P17b-21  | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:94             | (none)                                                        | residual         |
| P17b-22  | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:95             | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto             |
| P17b-23  | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:101            | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto             |
| P17b-24  | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:102            | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto             |
| P17b-25  | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:103            | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto-substituted |
| P17b-26  | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:104            | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto             |
| P17b-27  | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:105            | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto             |
| P17b-28  | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:106 (and :107) | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto             |
| P17b-29  | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:115            | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto-substituted |
| P17b-30a | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:116            | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php | auto-substituted |
| P17b-30b | docs/superpowers/walkthroughs/plan-17b-whiteboard-templates.md:116            | (none)                                                        | residual         |

## Plan 17c: whiteboard facilitation

Walkthrough: `docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md`.

| Id       | Walkthrough step                                                                                                                                                    | Test file                                                                                                                                                                                                             | Status           |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| P17c-01a | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:72 (B5.1)                                                                                         | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php                                                                                                                                                      | auto             |
| P17c-01b | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:69 (T1.1), :70 (T1.2), :73 (B5.2)                                                                 | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php                                                                                                                                                      | auto             |
| P17c-01c | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:69 (T1.1), :73 (B5.2)                                                                             | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php                                                                                                                                                      | auto-substituted |
| P17c-01d | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:73 (B5.2), :150 (R1)                                                                              | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php                                                                                                                                                      | auto-substituted |
| P17c-01e | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:73 (B5.2, "plays the sound")                                                                      | (none)                                                                                                                                                                                                                | residual         |
| P17c-01f | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:72 (B5.1, "nothing new lies over the canvas … at 1280 px and at 375 px"), :151 (R2, status row)   | (none)                                                                                                                                                                                                                | residual         |
| P17c-02a | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:78 (L2.1), :80 (B5.3), :81 (B5.4)                                                                 | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php                                                                                                                                                      | auto             |
| P17c-02b | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:81 (B5.4), :82 (B5.5)                                                                             | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php                                                                                                                                                      | auto-substituted |
| P17c-02c | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:82 (B5.5)                                                                                         | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php                                                                                                                                                      | auto-substituted |
| P17c-02d | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:83 (B5.8), :90 (B5.6, empty canvas)                                                               | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php                                                                                                                                                      | auto             |
| P17c-02e | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:80 (B5.3, "a drag pans … B can still pan")                                                        | (none)                                                                                                                                                                                                                | residual         |
| P17c-03a | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:88 (E3.1)                                                                                         | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php                                                                                                                                                      | auto             |
| P17c-03b | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:88 (E3.1), :90 (B5.6)                                                                             | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php                                                                                                                                                      | auto             |
| P17c-04a | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:95 (F4.1), :98 (B6.1), :99 (B6.2), :100 (B6.3), :104 (B6.7)                                       | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php                                                                                                                                                      | auto-substituted |
| P17c-04b | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:101 (B6.4), :102 (B6.5)                                                                           | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php                                                                                                                                                      | auto-substituted |
| P17c-04c | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:103 (B6.6)                                                                                        | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php                                                                                                                                                      | auto-substituted |
| P17c-04d | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:99 (B6.2, windows of different shapes)                                                            | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php                                                                                                                                                      | auto-substituted |
| P17c-04e | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:99 (B6.2, "A pans … within about a second"), :101 (B6.4, "within about 2 s")                      | (none)                                                                                                                                                                                                                | residual         |
| P17c-05a | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:147 (B5.7), :96 (F4.2), :102 (B6.5, take-over)                                                    | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php                                                                                                                                                      | auto             |
| P17c-05b | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:147 (B5.7, "never a guest", "No one else can facilitate this board yet.")                         | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php                                                                                                                                                      | auto             |
| P17c-06  | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:80 (B5.3, "send a reaction")                                                                      | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php                                                                                                                                                      | auto             |
| P17c-07  | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:148 (B7.12)                                                                                       | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php                                                                                                                                                      | auto             |
| P17c-08  | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:159 (G5, without its vote), :158 (G4, duplicate)                                                  | tests/Browser/Walkthroughs/Plan17cWhiteboardFacilitationTest.php                                                                                                                                                      | auto             |
| P17c-09  | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:107 (section 5: V5.1 :113, B7.1 :115, B7.2 :116, B7.3 :117, B7.4 :118, B7.7 :119, B7.10 :120)     | (none)                                                                                                                                                                                                                | removed          |
| P17c-10  | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:123 (section 6: C6.1 :127, B7.8 :129, B7.9 :130, B7.11 :131)                                      | (none)                                                                                                                                                                                                                | removed          |
| P17c-11  | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:134 (section 7: S7.1 :138, B7.5 :140, B7.6 :141), and the voting parts of :151 (R2) and :159 (G5) | (none)                                                                                                                                                                                                                | removed          |
| P17c-12  | docs/superpowers/walkthroughs/plan-17c-whiteboard-facilitation.md:155 (G1), :156 (G2), :157 (G3), :158 (G4, save as template)                                       | tests/Browser/Walkthroughs/Plan17bWhiteboardTemplatesTest.php (`[P17b-02]`, `[P17b-08]`, `[P17b-23]`), tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php (`[P17a-02a]`, `[P17a-04]`, `[P17a-09]`, `[P17a-10]`) | auto             |

## Plan 17d: whiteboard secrecy and history

Walkthrough: `docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md`.

| Id       | Walkthrough step                                                                  | Test file                                                                             | Status           |
| -------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------- |
| P17d-00a | docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md:38           | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php (`[P17a-01]`)                | auto             |
| P17d-00b | docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md:39 (and :40) | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php (`[P17a-02a]`, `[P17a-02b]`) | auto-substituted |
| P17d-00c | docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md:39           | (none)                                                                                | residual         |
| P17d-00d | docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md:41           | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php (`[P17a-04]`)                | auto             |
| P17d-00e | docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md:42 (and :43) | tests/Browser/Walkthroughs/Plan17aWhiteboardCoreTest.php (`[P17a-10]`, `[P17a-09]`)   | auto             |
| P17d-00f | docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md:44           | (none)                                                                                | removed          |
| P17d-00g | docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md:45           | tests/Browser/Walkthroughs/Plan17dWhiteboardSecrecyTest.php                           | auto             |
| P17d-01  | docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md:55           | (none)                                                                                | removed          |
| P17d-02  | docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md:65           | (none)                                                                                | removed          |
| P17d-03  | docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md:75           | (none)                                                                                | removed          |
| P17d-04  | docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md:83           | (none)                                                                                | removed          |
| P17d-05  | docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md:93           | (none)                                                                                | removed          |
| P17d-06  | docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md:103          | (none)                                                                                | removed          |
| P17d-07  | docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md:111          | (none)                                                                                | removed          |
| P17d-07a | docs/superpowers/walkthroughs/plan-17d-whiteboard-secrecy-history.md:119          | tests/Browser/Walkthroughs/Plan17dWhiteboardSecrecyTest.php                           | auto             |

## Notes

Where a walkthrough's wording and today's interface differ, the test follows the feature's spec.

- P04-04: vote totals are shown during Voting unless the board setting "hide vote counts" is on; the test turns it on to check plan 4's "no per-card numbers".
- P04-06, P04-09: a completed retro opens on a Results tab; the cards are behind the Board tab.
- P04-09: action items, the presence strip and the results' participant list are not anonymous by design; the test asserts "no author name" on the cards.
- P04-08b: the timer reaching zero is a client-side notice only.
- P04-17a: members change language under Settings, Appearance.
- P10a-06: the valid join page shows the game's title and "Choose the name other players will see.", not "Join a planning poker game".
- P10a-14: after the guest link is regenerated the guest sees "Your access to this game has ended.", not the session-expired banner.
- P10b-10b: the history of an anonymous round shows each value with its count and no names; the walkthrough says "lists who voted without values". The feature's spec only requires that no value is linked to a player. Confirmed as intended by the product owner on 2026-10-01.
- P10b-13: an ended game keeps the hand, disabled; the walkthrough says "no hand". Confirmed as intended by the product owner on 2026-10-01.
- P10b-08a, P10b-08b: the shortest timer the interface offers is 30 seconds, so the tests travel in time and run one queued job.
- P10b-16: both tests run in French, Spanish and German. `[P10b-16a]` has a guest spectator switch language in the header and asserts the spectator note and the "Watching" row, the "Auto-reveal" badge and the "Revealed automatically — everyone voted" note, and the "Anonymous votes" badge and row. `[P10b-16b]` opens the game as a facilitator whose profile language is already set (members have no language switcher on the game page; the switch in the settings is `[P04-17a]`) and asserts the timer menu ("Stop timer"), the auto-reveal note of the settings dialog and the saved decks heading ("Your team's decks"). The browser asserts at least one string per group, not every string: "Time's up!", the "time's up" reveal note and "Start timer" need a timer that has run down or a second dialog and are not asserted in the three languages. `tests/Feature/TranslationKeysTest.php` proves that every key used exists in all four languages.
- P10b-15d: "card dragging still works" on the retro board is covered by the plan 4 keyboard-drag test `[P04-14c]`.
- P06-02: the walkthrough votes "during a refetch triggered by a phase/settings change". The test holds the snapshot's response inside the member's page (a wrapper around `XMLHttpRequest` installed by the test) while the member votes, then lets it through; the facilitator's change is "Hide vote counts". The snapshot was built before the vote, as in the race PA1 describes.
- P06-03: "two tabs of the same member" are two browser contexts signed in as the same user (two sessions, one participant). The test also edits the card in the first tab and expects the new content in the second.
- P06-04a, P06-04b: a double click is two `click()` calls in one page script; the test counts the requests sent. The walkthrough names only the vote; the card deletion comes from acceptance criterion PB2.
- P06-05: the card is edited during Grouping, the last phase in which a card is editable, and the facilitator's "Next" moves to Voting.
- P06-07a, P06-07b: the walkthrough lists "PB5, PB6" without steps; the tests follow the acceptance criteria. For PB6 the response of the creating request is held in the page while the select is checked.
- P06-08a: keyboard pick-up instead of a pointer drag; structural facts only. The visual check is the residual row P06-08b.
- P06-09: keyboard-only grouping and moving in Grouping is covered by the plan 4 test `[P04-03]`, which uses `dragWithKeyboard(..., handleRemains: false)` since plan 16b Task 1. No test is added in the plan 6 file.
- P06-10a: "sign out in another tab" is a `POST /logout` sent from the board page with `fetch()`, which ends the same session and leaves the board on screen. The board is inert once the banner shows, so the second refused request is the refetch caused by the facilitator's phase change, not a second action of the member.
- P06-10b: not in the walkthrough. A guest-enabled retro answers the reload with the session-ended page instead of the login page (polish pass spec, PA5b); the walkthrough's "Reload leads to login" holds only for a retro without guest access (P06-10a).
- P06-11: "`docker pause` of the Sail app for about 20 s" is a `RouteMatched` listener that sleeps 15.5 seconds on the first vote request, longer than the client's 15-second timeout. The member's locale is French, which proves the translation.
- Step 1 (full checks) and Step 6 (report) of the plan 6 verification task are not walkthrough steps and have no row. PE1 and PE2 (image name, native build stages) are verified by plan 6 Task 5 Step 4, not by its walkthrough, and have no row either.
- P07-01a: step 1, "follow scrolling". The test checks that the cursor sits over the same card on the watching page, before and after that page scrolls its board sideways. Both pages have the same viewport (800 × 700) and the same board content, because positions are normalised to the board's scroll size and two boards of different scroll width do not agree on a position (see "Notes for the lead").
- P07-01b: step 1, "disappear on blur". A headless page cannot be unfocused, so the test dispatches the `blur` event the cursor library listens for and asserts that the cursor left in under 1.5 seconds, which separates it from the 3-second expiry of an idle cursor.
- P07-01b: step 1, "Hide my cursor". The control is a toggle button in the header (`aria-label` "Hide my cursor" / "Show my cursor", `aria-pressed`), not a switch as the feature spec's §7 words it. The test also asserts what the spec adds: the preference is kept in `localStorage` across a reload and the viewer still sees other cursors.
- P07-02a: step 2, "gather into a bubble". A bubble forms only when two different people send the same emoji within 700 ms and lasts under a second; the test records it with a `MutationObserver` and asserts a `gathering` reaction with a count of at least 2 on both pages.
- P07-03a, P07-06a: step 3, "chip tooltip shows names; anonymous retro shows none". On an anonymous retro the tooltip is not rendered at all, which is what the tests assert.
- P07-03a, P07-03b: step 3, "any emoji". P07-03a toggles an emoji outside the quick set that another participant already used (🦄); P07-03b picks one in the full picker with the emoji list faked upstream.
- P07-04b: step 4, notifications. "Only on private channels" is asserted as absence: the facilitator, who is neither the card's author nor in the thread, receives the comment itself (the count changes) but no toast and no unread dot.
- P07-05a, P07-05b, P07-07b: step 5, "network panel shows no request to giphy.com, tenor.com or jsdelivr.net". Replaced by the page's Resource Timing entries and by the origin of every `img` and `source` element, read with `assertScript()`; the server side is asserted with `Http::assertSent()` (what skrum asked the provider and the CDN) and `Storage::assertExists()` (the proxy's local copy).
- P07-06a, P07-06b: step 6. Covered by two tests; P07-06b overlaps `[P10b-15c]`, which checks the same two facts after the poker refactoring of the shared layers.
- P07-07a, P07-07b: step 7, "each of the six toggles". The settings dialog shows six engagement switches only when a GIF provider is configured, five otherwise (feature spec §5 and §7). P07-07a asserts the five and toggles reactions and cursors; P07-07b asserts the six and toggles GIFs; the three other switches are exercised live in P07-10 (hide vote counts), P07-08a (close for editing) and P07-09 (presentation mode).
- P07-08a, P07-08b: step 8, lock. The interface does not let a locked board send an edit: it removes or disables the controls, which is what P07-08a asserts for cards, drag, reactions, comments, votes and action items. The server's 423 and its toast are reached in P07-08b from a page that has not yet received the lock, arranged by setting `is_locked` in the database. The 423 of every endpoint stays covered by `tests/Feature/Retros/BoardLockTest.php`.
- P07-09: step 9, presentation overlay. When the facilitator closes the overlay the highlight is cleared for everyone (plan 7, line 4840), so "follows the highlight" is asserted as: opens for both, a participant's Escape hides it for that participant only, a new highlight reopens it, and the facilitator's close removes it for both.
- P09a-01a: the walkthrough writes the chip as "Due 3 Oct". In English the product formats the date with `Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' })`, which gives "Due Oct 3", and an overdue item's badge reads "Overdue · Oct 1". The test computes both labels from `ActionItem::today()` and asserts the red badge by its `bg-destructive` class.
- P09a-01c: "the guest ticks their own item" is read as the item assigned to the guest (spec §4: the assignee completes). The test also checks a plain member: Bob can tick the item assigned to him, cannot tick the guest's, and sees no edit or delete button.
- P09a-03a, P09a-03b: the walkthrough says "Lock the board: edits return the toast". Today's board disables every action item control as soon as it learns the board is closed, so no edit can be sent from a page that shows the lock. P09a-03a asserts the disabled controls and the "Board closed for editing" badge on both pages after the facilitator ticks "Close for editing"; P09a-03b locks the retro in the database after the page has loaded, so the click reaches the server and the page shows the toast "The board is closed for editing." and resyncs.
- P09a-03c: "complete the retro" is arranged in the database (the phase flow is covered by P04-07). The guest joins through the interface while the retro is in `Discussing`, then reloads the completed retro. The priority has no text in the Results view, so it is asserted by the icon's colour class.
- P09a-05: run with one and with two open items to cover the singular and plural sentences; a completed item is present and not counted.
- P09b-01a: "complete a retro that has open items, then start a new retro" is arranged with factories: an earlier `Completed` retro dated one week back with one open item, and a new retro in `Writing`. The second member cannot tick the carried item (not a manager, not the assignee, not the review facilitator); the test asserts that the toggle is disabled for him and that his sheet updates when the facilitator completes it.
- P09b-01c: not in the walkthrough's wording; added from spec §8 ("only when the board is first loaded while the phase is `Writing`"): on a board first opened in `Discussing` the sheet stays closed and the button opens it.
- P09b-02a: "(sidebar "Action items", below "Teams")" is asserted as the order of the sidebar entries, "Teams / Action items / Templates", for a member.
- P09b-02c: the guest and the retro are arranged with factories (a guest participant row, no browser session), because the step is about the member's page.
- P09b-03: "it appears within about a second" is asserted as "it appears without a reload" within the browser timeout; no duration is measured. The team's next retro is created by a factory, dated one minute ahead.
- P09b-04: the sub-tasks are reordered with the "Move up" button; the product has no drag handle for sub-tasks.
- P09b-05: the "repeat icon" is asserted through its label "Repeats weekly" (the icon is `aria-hidden`). "Follows up the item completed on …" is asserted without its date, which the browser formats in its own time zone.
- P09b-06a: substitution (spec §3.6, e-mail): `Notification::fake()` instead of `MAIL_MAILER=log`. The test asserts the recipient, the `mail` channel, the locale `fr`, and that the rendered digest lists the overdue item before the item due today. It has no browser page. It also travels two days to show the rule "one reminder per item, kind and due date".
- P09b-06b: the bell has no realtime update (spec §1, out of scope), so after the command the test reloads the page with `navigate()` to the same URL. "The sidebar badge shows 1" is the count of the viewer's overdue items and is already 1 before the command runs.
- P09b-07: substitution (spec §3.6, e-mail): the absence of the e-mail is asserted as "no `NotificationSent` event for the `mail` channel" while the `database` channel sent; the bell entry is then read in the browser. The reminder that step 6 had sent is arranged as an `action_item_reminders` row.
- P06-08a: found and fixed a product defect (the drag preview was always 256 px wide); see "Defects found".
- P07-01a: the cursor assertion is stricter than the plan's: it reads the position twice, 200 ms apart, and is true only when the cursor has stopped over the card, because a remote cursor is animated for about 150 ms and a retried assertion could pass while it only crosses the card. Two open defects found while measuring (cursor position across window widths, board scroll width after narrowing); see "Defects found".
- P07-04a: the author line of a comment is asserted with `p:has-text("Bob Stone")` inside the thread, because the same name also appears in the card footer.
- P07-08a: the comments toggle of a locked board is clicked from a script: the card's drag wrapper carries `aria-disabled="true"` while locked and Playwright waits on controls inside it. Open defect for the user; see "Defects found".
- P07-09: a card with a reaction chip needs two presses of Escape to close the overlay, because the dialog focuses the chip and its names tooltip takes the first one. The test asserts today's behaviour. Open defect for the user; see "Defects found".
- P09a-01a to P09a-05: the form of the action items panel is scoped with `[data-test="retro-action-items-panel"]`.
- P09b-05, P09b-07: the save-on-blur of the due date field is triggered by clicking neutral page text after `fill()`, not by Tab: in Chromium Tab moves between the segments of a date input and the field keeps its focus.
- P09b-03, P09b-04: Task 6 added `data-realtime` to the workspace "Action items" page (`resources/js/pages/action-items/index.tsx`) so that the tests can wait for the subscription; it is the only product change of plan 16b besides the drag preview fix.
- P08a-02a: the walkthrough expects "the Warm-up question (same question in both browsers) and the timer". Since the games spec was built, the Icebreaker phase shows the game panel instead (flow extras spec §2.5). The test asserts the icebreaker game stage, the same game name ("Draw & Guess") in both browsers, and the shared timer.
- P08a-02b: the walkthrough adds the column during Icebreaker and through one form. Today the columns are not rendered during Icebreaker and the add-column form has no description field. The test adds the column in Writing and sets its description through the column menu's "Edit description".
- P08a-03: "Previous → Icebreaker: the other browser's cards are hidden again". The board is not shown during Icebreaker, so in Icebreaker the test reads the snapshot endpoint from each participant's page (`snapshotOf()`) and asserts what the server sends to that viewer: the other author's card has `hidden: true`, `content: null` and `author: null`, its text is nowhere in the snapshot's JSON, and the viewer's own card keeps its content and author. In Writing, after the return from Grouping and again after Icebreaker, the test asserts the page: the other card shows "Hidden until writing ends" and its text is absent from the visible text and, after the return from Grouping, from the document's HTML (which proves the page dropped a text it had already shown, not what the server sent).
- P08a-04a / P08a-04b: the settings dialog disables the Icebreaker checkbox while the retro is in Icebreaker, so the message "Move to another phase before turning this phase off." cannot be produced by a current dialog. P08a-04a asserts the disabled checkbox; P08a-04b produces the server's message with a dialog opened before the retro was moved to Icebreaker through the model (no broadcast), as P04-13 does for a refused vote. P08a-04b asserts the translated message in the dialog and that the setting is unchanged in the database. It does not assert a resync, because there is none: the settings dialog shows the message returned by `ctx.handleError()` and does not refetch after a refusal (`settings-dialog.tsx`; only mutations sent through the board's `run()` refetch). Measured: 20 seconds after the refusal the stepper still showed Writing while the server was in Icebreaker; the page catches up on the next broadcast or reload. Plan 16c's Review Focus expected "the board resyncs"; no feature spec requires it for this dialog. Product code unchanged, for the user to decide.
- P08a-05: run with two data sets (2 and 9 top-level cards, each with one grouped card) to cover both "cards + 3" and "max 10".
- P08a-07b: "reorder/remove columns": the test starts from "Start, Stop, Continue", moves the first column down and removes the third; the category is changed from "Essentials" to "Team & mood" in the select.
- P08a-07c / P08a-07d: the template and, for P08a-07d, the retro created from it are arranged with factories so that each test stands alone.
- P08b-01a: the statements are reordered with the keyboard, but not through `dragWithKeyboard()`: on the team page the list sits low on a page that scrolls, the keyboard sensor scrolls the window, and the drop sent right after the arrow landed on the starting row. The test waits on the dnd-kit live region ("Moved Interaction to position 2.") between the arrow and the drop.
- P08b-03a: the `health.answered` frame is not inspected (browser test spec §3.6); the test asserts absence in the other participant's page and reads the snapshot endpoint from the page (`snapshotOf()`): the statements carry only the viewer's own score (`myScore`), a count and who answered, and `results` is null (results are only built once the retro is completed). P08b-04 reads the same snapshot on an anonymous retro: a count and an empty `answeredBy`. "Enable guest access" is arranged with the factory state; the guest link dialog is covered by P04-10.
- P08b-05b / P08b-06: "server answers 423 if forced" and the 403 in Writing are produced by changing the retro through the model without a broadcast and clicking a still-enabled score button.
- P08b-07: the health check is toggled off and on in Writing, because the settings dialog disables that checkbox during the Health check phase; "change the team statements" is an Owner adding a custom statement on the team page.
- P08c (all rows): the walkthrough is one paragraph on line 5728; its checks are split into ten tests. It asks for "two browsers, one as a guest"; the tests open the facilitator or a member next to a guest, whichever the check needs.
- P08c-01: the walkthrough does not name the kinds in the interface; today's dialog calls them "Single choice", "Multiple choice" and "Free text" under "Answer type".
- P08c-02b: beyond the walkthrough, the test asserts that a multiple choice survey's percentages are computed per respondent (100% and 50% for two respondents), as the feature spec §5.4 requires.
- P08c-02c, P08c-05: "hidden" is asserted twice. On the guest's page: the answers list, the reactions and the comments toggle are not rendered. On the server: the test reads the snapshot endpoint from the guest's page (`snapshotOf()`) after the other participant answered or commented, and asserts that the survey has `resultsVisible: false`, `textAnswers: null` (P08c-02c) or empty `comments` and `reactions` with `commentCount: 1` (P08c-05), and that the answer's or the comment's text is nowhere in the snapshot's JSON. The realtime frames are not inspected (browser test spec §3.6).
- P08c-03: the test also reopens the survey and asserts that the results hide again for someone who has not answered (feature spec §5.1); the walkthrough only closes.
- P08c-04a: "avatars" are asserted as `<img alt="{name}">` under the option; the names shown on hover (a tooltip) are not asserted. "Text authors" are asserted as the name inside the answer's row. "Only once the viewer may see the results": after each "Show who answered" toggle the test waits until the facilitator's menu shows the item checked, then reads the snapshot endpoint from the page of someone who has not answered (`snapshotOf()`) and asserts `showVoters: true` with `resultsVisible: false`, every option's `count` and `voters` null, and for the free text survey `textAnswers: null` and the answer's text nowhere in the JSON. The absence of avatars and answers in that page is asserted after it.
- P08c-07: "answering refused" is asserted as the interface shows it: on a closed survey the option buttons and checkboxes are disabled and the free text field is absent. The server's 422 for a forced request stays covered by `tests/Feature/Retros/SurveyAnswersTest.php`.
- P08d-01a: the group is arranged with factories instead of being formed by a drag in the test; dragging one card onto another is covered by `[P04-03]`.
- P08d-01b: "Drag the only grouped card out" is done with the card's Ungroup button: a grouped card has no drag handle for the keyboard sensor, and `[P04-03]` ungroups the same way. Both paths end in the same lifecycle rule (feature spec §7.2, "when the last grouped card leaves a lead, its name is cleared").
- P08d-01c: the group is dragged upwards onto the group above it (ArrowUp), with `dragWithKeyboard()` as `[P04-03]` does. Dragged downwards onto the group below, the keyboard drop lands on the column and does not group; open defect for the user, see "Defects found".
- P08d-02b: the group name is rendered in upper case by CSS in presentation mode; the test reads the element's text content ("Pipeline"), not the displayed capitals.
- P08d-03: the walkthrough says "Lock the board"; today's control is the "Close for editing" checkbox of the settings dialog, and the badge reads "Board closed for editing".
- P08d-04a to P08d-04e: step 4 is one sentence listing every section of the Results view; it is split into five tests. Health answers, surveys, votes, ratings and the earlier retros of the team are arranged with factories (`FreezeHealthStatements`, `ManageTeamHealthStatements::archive()` for the statement change), because collecting them through the interface would need three completed retros.
- P08d-04b: the walkthrough says "the guest sees the same without the trend"; the test also asserts that the title of another retro of the team is absent from the guest's document.
- P08d-05a: "within about a second" is asserted without a clock: the assertion on the other page waits for the refetch, which the client starts one second after the broadcast.
- P08d-06: the operating system setting is emulated with the Playwright context option `reducedMotion` on a guest's context, opened by hand with `visit()` because `signIn()` and `joinAsGuest()` take no context options. The only motion in the Results view is the width transition of the ROTI bars; the survey bars, the radar and the trend have none in either mode, which the test also asserts.
- P08e-01a to P08e-03b: the walkthrough says "`SKRUM_LLM_*` empty". The tests set `services.llm` to nulls in the test process, and `[P08e-01a]` also runs with a provider and a key but no model, because `Llm::isConfigured()` requires all three (feature spec §9).
- P08e-03a, P08e-03b: the tests put a sentiment, a category, a theme and a suggestion in the database before opening the page, so that "nothing is shown" is checked against existing data and not against an empty board. `[P08e-03b]` then configures a provider and reloads, to prove that the same page shows them.
- P08e-04b, P08e-04c: the walkthrough's item 1 names only the creation dialog. The settings switch and its lock once the retro is completed come from the feature spec (§6.3, acceptance criterion 9) and are tested under the same item.
- P08e-05a: "nothing appears on the board until Save" is asserted on the facilitator's page and on a guest's page, and by the absence of a `surveys` row.
- P08e-06: "ghost names appear only in the guest's browser" is asserted by the absence of the suggested names in the facilitator's page (substitution for looking at a second screen); the request body is checked to hold the card contents and no name or id.
- P08e-07: the provider's reply is faked; the job is run with the `database` queue and `$this->workQueue()` so that "Generating the summary…" is visible first. "Sends no personal data or hidden content" is asserted on the faked request: no participant name, email, participant id or card UUID, no card comment; the full redaction list stays covered by `tests/Feature/Retros/SummaryInputTest.php`.
- P08e-08: "it links to a new action item showing 'Theme: …'" is asserted in the Results view, where the promoted suggestion is a link to `#action-item-<id>` and the item carries the badge "Theme: Release pain".
- P08e-03a, P08e-10b, P08e-10c: substitution (spec §3.6, third-party call): "nothing is sent to the provider" is asserted with `Http::fake()` and `Http::assertNothingSent()`, so the three rows have the same status.
- P08e-10b: the second retro is arranged with a factory (`ai_summary_enabled = false`); creating it through the dialog with the switch off is `[P08e-10a]`.
- P08e-11a: not a numbered walkthrough item. It covers the provider failing (HTTP 500 three times, feature spec §6.3 and §14) and the Retry the walkthrough's item 8 ends with, using time travel between the job's attempts.
- P08e-11b: "Stop the queue worker, complete a retro, wait 10 minutes" is done by leaving the job in the `database` queue, travelling 11 minutes and reloading the page. Nothing in the product marks the row as failed: `Retro::effectiveSummaryStatus()` reads a pending request older than 10 minutes as failed when the snapshot is built, so the database still says `pending` and the page changes only on reload. Retry queues a second job (the job's unique lock lasts 540 seconds and has expired), so two jobs wait: the test asserts the `jobs` count (1 before Retry, 2 after), runs the older one, which writes the summary with one request to the provider, then runs the second, which finds the summary ready and does nothing (still one request, the summary kept, no job left). The walkthrough's alternative ("set `summary_requested_at` back with tinker") is not used.
- P08e-07, P08e-09: the theme name also appears in the suggestion's "Theme: …" line, so the tests match the heading with `p:text-is("…")` instead of a text assertion.

- P13a-02: the walkthrough said "copy the guest link". The header has no field holding the link, only the icon button "Copy guest link", which writes to the clipboard and shows "Link copied". The test replaces `navigator.clipboard.writeText` in the host's page, presses the button, and reads what the product passed to it. The join link is `/play/{token}`. The suggestion "in the browser's language" is asserted for English only (the suite's browser locale), against `resources/games/guest-names/en.php`.
- P13a-03: "not visible in the page source or the network tab" is asserted on `content()` and on the snapshot JSON fetched from inside each page, for the host and the guest, before and after a reload. Hangman has no leader, so nobody receives the word. The word is fixed by binding the real `GameWordBook` with a one-word list, because the round is started with the "Start" button. The realtime frames are not inspected (browser test spec §3.6): the payloads of the broadcasts (the start of the round, the letter picks) stay covered by `tests/Feature/Games/GameRedactionTest.php`.
- P13a-04b: "the same letter twice shows a toast". A picked key is disabled for every player once the pick is broadcast, so the toast "This letter was already picked." only appears in a race. The test writes the first pick to the database without a broadcast and lets the guest press the still-enabled key. Before that write it waits for the resync that follows the page's subscription (`awaitResync()`), which would otherwise bring the pick to the page and disable the key.
- P13a-06a, P13a-06b: the browser's clock does not move with `travel()`. The tests assert the countdown badge before the travel and the end card after it, not the countdown reaching zero on screen.
- P13a-07: the walkthrough said the guest sees "Your access to this room has ended." "after the next action". Today the settings change broadcasts `game.room.changed`, the guest's page refetches its snapshot at once and shows the message without any action. The test asserts that, and also that the guest is sent to `/login` on a reload and that the old link is "no longer valid".
- P13b-02: the walkthrough said "Who draws?" is preselected on the guest. Feature spec §4.1 and `nextLeaderId()` preselect the next online player after the previous leader in join order, and the first online player when no round was led yet, which is the host in a new room. The test asserts the host is preselected, then chooses the guest in the picker. The rotation after a led round is asserted by `P13b-10`.
- P13b-03 to P13b-09, P13b-10: a second team member ("Bob Leader") is the drawer instead of the walkthrough's guest on a phone, so rounds can be arranged with factories. The guest's way into a Draw & Guess round is `P13b-02`.
- P13b-04a, P13b-04b, P13b-05a, P13b-06, P13b-13a: the canvas is driven by `PointerEvent`s dispatched with `script()` (with `setPointerCapture` replaced on the canvas element, because a synthetic pointer cannot be captured) and checked by reading pixels with `getImageData()`. "A long stroke keeps flowing without gaps" is asserted as: 451 points become two stored operations of 400 and 52 points, the second starting at the first one's last point, with the joint pixel painted on the viewer's canvas.
- P13b-05a: "compare screenshots" is replaced by three sampled pixels and a checksum of the whole canvas on both pages; the comparison across real devices is `P13b-05b`.
- P13b-08: "the button counts down to zero at half the letters" is asserted on a four-letter word ("lamp"): "(2 left)", "(1 left)", then "(0 left)" disabled.
- P13b-11a, P13b-11b: the walkthrough named 🚀 and 🌕 "from the picker". The quick row holds 👍 ❤️ 👏 🎉 🤔 👎 today, so 👍 comes from the quick row and 🚀 and 🌕 from the full list. The full list's data normally comes from `cdn.jsdelivr.net` through `EmojiDataController`; the tests put a three-emoji data set on a faked storage disk instead. The refused emoji is the keycap 1️⃣; the flag 🇫🇷 is not tested because the picker hides flags where the system font cannot draw them. `P13b-11b` also asserts that a full clue offers no sixth slot (the server message "A clue holds five emoji at most." cannot be reached from the interface).
- P13b-11c: not a walkthrough sentence of its own; it adds the guess path of a Decoded round (wrong guess shown to the clue giver, correct guess ends the round), which step 11 implies.
- P13b-12b: "Give up" ends a Hangman round with the outcome "Passed"; the test asserts the badge "Passed".
- P13c-01 to P13c-06: GIPHY is faked; the fake derives the returned ids from the search word so that two players never receive the same ids. The Tenor variant of the attribution line is not exercised (`P13c-02r`).
- P13c-02: "check the network tab: no other player's GIF id before the reveal" is asserted as: the id is absent from the other page's document, and absent from the JSON snapshot that the other page fetches from `/games/{room}/snapshot`. Payload redaction of the broadcasts stays covered by `tests/Feature/Games/SprintGifRedactionTest.php`. The test also asserts that the GIF proxy serves the faked image (`naturalWidth` of the shown GIF is 1).
- P13c-03, P13c-05b, P13d-06d: the one-minute wait is replaced by the `database` queue, a 61-second jump of the server clock and one run of the queue. The browser's own countdown does not move, so the tests do not assert "Time's up" in the header badge; they assert what the expiry did.
- P13c-03: "the host sets a new timer" is asserted as a new expiry job and a future `timer_ends_at`, not as a countdown value, because the browser's clock is 61 seconds behind the server's after the jump.
- P13c-04: the walkthrough has two players, who each have exactly one GIF to vote for; the test seeds a third answer by an offline member so that "changes the vote" has a second target. Answers are seeded with factories; picking them through the dialog is covered by `P13c-02`.
- P13c-06: today's interface has no control that starts the next round while a round is in its voting window ("Next round" is rendered only by the end card; see "Defects found"). The only way the interface sends that request is a host page that is behind: the test arranges a round in its voting window with an answer and a vote without a broadcast, reloads Bob's page only, and Ada's page, which has not seen the round, still shows "Start". Her click closes the voting round with its points and starts the next one, which both pages show. The server rule is also covered by `tests/Feature/Games/SprintGifTest.php` ("closes the voting when the host starts the next round, but not before the reveal").
- P13d-04: the round is arranged with a factory and the word "fiancée". The guest picks "e"; the host's and the guest's page both show the mask `_____ée` (the accented and the plain letter revealed by one pick, "5 letters left to find", no miss). The keyboard has the 26 unaccented letters and no "é" key, before and after the pick (`GameWord::fold()` matches letters through their ASCII fold).
- P13b-04a, P13b-04b: after the pointer lifts, the viewer's pixels are asserted twice: at once, where the three-second live preview can still be what is painted, and again after the viewer's page is reloaded, where only the committed operations of the snapshot are drawn.
- P13d-03: step 3 of the plan 13d walkthrough restates the plan 13c walkthrough; it is covered by `P13c-03`, `P13c-04` and `P13c-05a`.
- P13d-06a: "and move to Icebreaker" needs no action: a retro created with the Icebreaker phase starts in it (`CreateRetro` uses `Retro::firstPhase()`). The new-retro dialog's options sit inside its "Settings" collapsible, closed by default; the test opens it first.
- P13d-06c: the test switches to Decoded; the walkthrough does not name the target game.
- P13d-09a: the round is arranged one letter from the end because letter picks are rate-limited to a burst of three per player. The same test covers "guests score only in their room" (spec §4.7): the guest is on the room's Scores tab and absent from the team leaderboard, and the guest's browser is sent to `/login` when it opens the team's Games page.
- P13d-10a: the two weeks are arranged by seeding `game_points.created_at`, as the walkthrough allows.
- P13d-11a: the podium, "Show all" and "Replay" are checked for a member and for a guest who joins the completed retro through its guest link. The replay asserts that the canvas "Drawing of rocket" is shown, not what is painted on it; canvas content is covered by the Draw tests of Tasks 1–4.
- P13d-12a, P13d-12b: "the message opens `/games/{room}`" and "opens the guest join page" are asserted on the link that skrum sends to the faked provider, and by opening that path in a browser.
- P13d-12d: "Archive the Slack channel" is a faked `404 channel_is_archived` answer from the Slack webhook. The failed line is visible because Telegram is also connected; Slack as the only channel is `[P13d-12f]`, which needed a product fix (see "Defects found").
- P13d-12e: superseded by plan 14. The walkthrough sentence "Spec 8's channels (Teams, Mattermost, webhook) are not built yet and do not appear" no longer holds: plan 14 has built the three channels, so they exist and do appear. Following the games spec §3.1 ("each channel is offered independently"), the test asserts that the three channels appear when the team connected them, that each posts, and that Slack and Telegram do not appear when they are not connected.
- P13b-05c: not a walkthrough sentence of its own. It is the regression test of the defect that `[P13b-05a]` exposed (a cleared stroke shown again to a viewer whose room snapshot was refreshed after the stroke); see "Defects found". The defect lasted three seconds (the life of the live preview), so the test detects it only if it reaches its last assertion within 3 seconds of the stroke; on a machine slow enough to take longer, it would pass with the defect present.
- P13d-12f: not a walkthrough sentence of its own. When Slack is the team's only share channel and it needs a reconnect, the delivery line "Slack: failed — Reconnect Slack in the team settings." has to stay visible (games spec §3.1 and §6); see "Defects found". The test runs on a team room and on a room open by link: on the latter the "Include the guest link" checkbox is there before the failure and absent once no channel is left, while the failed line is shown.
- P13d-09a, P13d-09b, P13d-10a, P13d-10b: the team leaderboard's points are asserted in the `span.font-semibold` of the person's row, because a row also holds the rank and `assertSeeIn()` matches substrings.
- P12a-01a to P12a-07a: the walkthrough asks for real developer apps in `.env`. The tests enable providers with `enableIntegrations()` and answer every provider call with `Http::fake()`; connected integrations are arranged with `TeamIntegrationFactory` states, because an OAuth redirect cannot be followed against a fake.
- P12a-01b, P12a-01c: the walkthrough only says "only configured providers appear". The tests add the two boundaries the feature spec names (integrations spec §16, criteria 1 and 2): a team member has no link and gets 403, and with no provider configured the link is absent and the page answers 404.
- P12a-03a: "add the bot to a group, send the shown command" becomes: read the command from the card, serve it as the answer of `getUpdates`, run `skrum:telegram-poll --timeout=0`. The page's own 5-second poll then shows "Connected". A connection made this way never shows "Last checked: Never", because connecting stamps `last_checked_at` (`SaveTeamIntegration`); that the test message is recorded is asserted on `last_checked_at`, which is later than at the connection after five travelled minutes.
- P12a-04a, P12a-05a: the trackers are arranged with read access. The walkthrough connects Linear "read and write"; with write access the card also loads people and priorities from the provider, which belongs to the plan 12d walkthrough. "Test the connection" behaves the same for both access levels.
- P12a-06a: "the Slack card shows 'Reconnect required' with the error": the error shown is the provider's code, `token_revoked`.
- P12b-01a to P12b-06a: "a queue worker running" becomes the `database` queue plus `$this->workQueue()` after each share, so the test sees both "Sending to …" and "Sent to …".
- P12b-01a: the walkthrough's "the dialog shows 'Sent to Slack · …'": the test asserts the prefix "Sent to Slack"; the relative time after the dot depends on the browser's clock.
- P12b-01c: not a walkthrough step; it automates Step 3 of the plan 12b verification ("confirm in the running app with every integration variable unset that the board header has no 'Share' button, the Results view has no share menu and the poker game menu has no 'Share…' item").
- P12b-03a: "a summary still generating" needs a configured LLM for the dialog to mention the summary at all; the test sets the configuration and a pending summary, and no LLM call is made.
- P12b-04a: "each participant receives the mail in their own language, guests receive nothing" is asserted on the faked notifications (recipient set and locale), not on rendered mail. The test adds a third send after travelling 11 minutes to show the cooldown ends.
- P12b-06a: the walkthrough posts "again" after archiving; the test posts once to a channel that answers 410. Telegram stays connected in the test: with Slack as the only channel, the share section and its failed line disappear as soon as the connection needs reconnecting (`post-link-section.tsx` returns nothing when no channel is left).
- P14a-01a, P14a-01b: connecting Teams and Mattermost is driven in the browser, because it is a pasted URL and not an OAuth round trip. Both tests add the refusal of a foreign URL (extended integrations spec §4.3, §4.4) and assert that the stored URL is absent from the page source.
- P14a-03b: the invite is posted from a standalone Hangman room opened by its host; the sentence names the game and the room, never the players.
- P14a-04a: "names shown as a count, action items named, `@channel` in a card rendered literally" is asserted on the payloads: Teams receives the plain word (a Teams mention needs an entity that skrum never sends), Mattermost receives `@` followed by a zero-width space.
- P14a-05a: "break the Teams URL (delete the workflow)" becomes a 404 from the workflow host. The test continues with "Replace URL" to show the recovery, which the walkthrough does not mention.
- P12c-01: the walkthrough connects Jira and Linear by hand; the test starts from connections arranged with `TeamIntegrationFactory` and asserts what follows from them (the Import button and both sources in the dialog). The connection itself is covered by the plan 12a rows.
- P12c-02a: the walkthrough's `PROJ-n` "chips" are asserted as the key inside each task row, and the source link as the `href` of the key in the current task's detail.
- P12c-03c: "open a task" is done by the facilitator choosing it as the current task, which is the only way the product shows a task's detail.
- P12c-04: "queue worker running" is replaced by the `database` queue and one `$this->workQueue()`; "Jira shows 5 story points" is asserted as the `PUT` skrum sends (`customfield_10016` = 5) and is otherwise the residual row P12c-04r. A second member's page is added to prove the badge changes for the other players too.
- P12c-05a: the walkthrough says "set 1 instead"; the test sets 8, because the text of the option "1" is contained in "13" and "100" of the Modified Fibonacci deck and cannot be addressed without a hook. The rule under test is the same.
- P12c-05b: the walkthrough only names the Retry button. The feature spec (integrations design, estimate write-back) says the facilitator's retry can also force an estimate that is already synced, so the test clicks "Retry" on a failed task and then "Sync again", and asserts two writes. The failed state is arranged with the factory.
- P12c-07a and P12c-07b: the product shows two toasts, ":count tasks refreshed." and ":count tasks were not found in Jira."; English has no singular form, so the test asserts "1 tasks were not found in Jira." where the walkthrough says "the toast says one task was not found".
- P12c-08: "no import button" also covers the "More task actions" menu, which a guest does not get either. A team member's page is asserted next to the guest's so that the absence is meaningful.
- P12d-01: the People panel never shows the text "Matching…". The product shows a spinner in the disabled "Match by email" button while the job runs; the test asserts the disabled button, then the badges.
- P12d-02a: the walkthrough resets "a third" member; the test arranges that member's email match with the factory so that the menu offers "Reset".
- P12d-03: the walkthrough's `PROJ-n ↗` is asserted as the link with the issue URL and the key as text; the arrow is an icon. The exporter is the item's author; the second browser is the facilitator.
- P12d-05: "the Jira entry is gone from its menu" is asserted as the menu button being replaced by the single button "Export to Linear", which is what the product renders when one tracker is left. The forced request is sent twice in a row, not in parallel: the suite's server handles one request at a time, so a true race cannot be produced; the lock that makes a parallel double submit safe stays covered by `ActionItemExportTest` ("creates one issue for a double submit").
- P12d-07: the walkthrough revokes first and exports afterwards. With a revoked token the product already fails when the export dialog loads its teams, so the test lets the dialog load, then switches the fake to the revoked answer and clicks Export, which is the request that answers 409 in the walkthrough. The status code is not visible in the interface; the test asserts its message.
- P14b-01, P14b-06: "send Test" is checked with `Http::assertSent`-style inspection of the recorded request; the test message is not written to the delivery log, so no log row is asserted for it.
- P14b-01: the test also submits `https://127.0.0.1/skrum` first and expects "This URL points to a private or invalid address."; this is not a walkthrough bullet, it proves that the URL safety check is not switched off by the faked DNS resolver.
- P14b-02a to P14b-02c: the walkthrough's bullet names three shares; each is one test. The board link and the room invite are sent without the guest link.
- P14b-03b: the three action item events are driven from the retro board's action items panel (Discussing), not from the workspace action items page.
- P14b-04a, P15-02: after its last try on a 5xx answer the delivery's error is "Webhook did not respond. Try again later." (`ProviderUnavailable::userMessage()`); "The receiver answered 500." is the internal detail and is shown only for 4xx answers.
- P14b-04a: "watch the retries" is checked after the first and the second try (the log shows Queued with 1 then 2 attempts), then after the seventh; the waits are travelled, not waited.
- P14b-04b: nine earlier consecutive failures are arranged with the factory; the tenth is a board link shared through the interface (four tries). The walkthrough's "10 failures" are not driven one by one.
- P14b-05: the 410 answer is received by an `action_item.completed` delivery. The interface shows "The receiver asked skrum to stop." under the status "Reconnect required".
- P14b-06: "see the old one fail verification" is asserted on the request sent after the rotation: its signature verifies with the new secret and not with the old one.
- P14b-07: not a walkthrough item. It pins "Owner/Admin only" for the webhook (extended integrations spec §6): a team member has no Integrations link, gets 403 on the integrations page, and a `POST` of a receiver URL sent with `fetch()` from that member's page (`teams.integrations.urls.store`, provider `webhook`) answers 403 and leaves the connected webhook's URL as it was. The same rule for the page itself is `P12a-01b`.
- P14b-02a, P14b-02b, P14b-03d: "no Writing-phase content in outgoing payloads" (extended integrations spec §4.7 and §8.3) is covered structurally: the tests pin the exact key list of the `data` of `retro.link` (`title`, `url`, `sharedBy`), of the room invite and of `poker.task.estimated`, so a payload cannot carry card content. No browser test shares from a board in Writing; the server rules are covered by `tests/Feature/Integrations/RetroSharesTest.php` ("refuses a link on a completed retro and a recap before completion", data set "recap while writing") and `tests/Feature/Integrations/WebhookEventsTest.php` ("sends action_item.created while the retro is still in Writing, with the item named").
- P15-02: "stop the receiver" is replaced by a receiver answering 503.
- P15-03: the failed delivery is arranged with the factory; the redelivery is checked for the same `X-Skrum-Delivery`, `X-Skrum-Redelivery: true`, and the log row "Redelivery".
- P15-05: not a walkthrough item. It covers the refusals of the redelivery spec §4.3 ("still being sent", "Turn the webhook back on before redelivering.", "content is no longer kept"). The interface hides Redeliver in these states, so each case changes the state after the log was loaded. The throttle of redeliveries is not covered here; it is covered by `tests/Feature/Integrations/WebhookRedeliveryTest.php`.
- P11b-01: the server URL is the test server's (`http://127.0.0.1:<port>/mcp`), not `http://localhost/mcp`; the test asserts that it ends with `/mcp`.
- P11b-01, P11b-02: the walkthrough says that "Create token" asks for the password. Today the page itself is behind the password confirmation (`routes/settings.php`), so the password is asked when the page is opened, once, and "Create token" opens the dialog directly.
- P11b-03b, P11b-16, P11b-17: the client's call is one request sent from the test process with `postMcp()` (a bearer token, no session).
- P11b-17: the configuration value `skrum.mcp.enabled` is set in the test instead of `SKRUM_MCP_ENABLED` plus a restart. The page answers with Laravel's default 404 page ("Not Found").
- P11b-18a: three strings of the page and three of its dialogs are checked per language; the revoke dialog is not opened in each language.
- P14c-05a: the walkthrough says "replace the connection with a personal access token". A connection made with OAuth offers no token dialog (`jira-data-center-integration.tsx` shows "Replace token" only for a token connection), so the test pastes the token from the not-connected card. The feature spec (§4.1) only requires that an OAuth connection replaces a stored token, not the reverse.
- P14c-05c: "exported issue created as the token owner" is asserted as: the export's calls carry `Authorization: Bearer {personal access token}` and none carries an OAuth token. Who Jira then records as the reporter is Jira's behaviour.
- P14c-06 and P14c-13: "revoke the token in Jira" and "uninstall the app" are the faked answers 401 on `GET /rest/api/2/myself` and 404 on `GET /app/installations/4242`, found with "Test the connection".
- P14c-09a, P14c-09b, P14c-10: "see one block in the issue body" is asserted on the body of the single `PATCH /repos/acme/api/issues/7` request, with exactly one `<!-- skrum:estimate -->` marker and the surrounding text unchanged.
- P14c-11: the walkthrough expects to clear an estimate; today's interface has no control for it (open, see "Defects found"). The test sends the request the missing control would send, `PUT /poker/{game}/tasks/{task}/estimate` with `value: null`, with `fetch()` from the facilitator's page (as `P12d-05` does), runs the queued write-back, and asserts the single `PATCH` to GitHub (the body without the block and without the blank line before it) and the page (the estimate badge gone, "Sync pending" then "Synced to GitHub"). The same removal is covered by the feature test "removes the block when the estimate is cleared" in `tests/Feature/Integrations/GitHubTrackerTest.php`.
- P14c-01 to P14c-13, P14d-01a to P14d-13a: the catch-all of each provider host answers 404, so a call that a test did not fake fails in the product instead of passing with an empty answer. The calls that needed their own fake were the priority lists the integrations page loads for a tracker with write access (`rest/api/3/priority/search` for Jira Cloud, `rest/api/2/priority` for Jira Data Center) and `rest/api/2/field` after a token connection.
- P14d-01a: after the switch the card says "Checking every 5 minutes." until the registration job has run, then "Setting up live updates…" until the first verified event, then "Live updates (webhooks)". The walkthrough does not describe these three states; the test asserts all three.
- P14d-01b: "reconnect first so the webhook scope is granted" is asserted from the other side: a connection without the scope shows "Reconnect Jira to receive live updates." and polls. The reconnection itself is part of residual `P14d-13`.
- P14d-02, P14d-05a, P14d-07b, P14d-08b, P14d-11b: the walkthrough says the item completes "with 'Completed in Jira'". On an open board the item is completed at once, but "Completed in :source" appears only after the page is loaded again, because broadcast payloads carry no `completedVia`. The tests assert the live completion, then reload and assert the label.
- P14d-02: "within seconds" is not timed; the test waits for the change with the suite's 20-second assertion timeout after running the queued job itself.
- P14d-05b: "no loop on the echo" is proven on the second inbound event: exactly one job is queued for it, running it sends one more read to Jira (`POST rest/api/3/search/jql`), the queue is then empty and the number of transitions sent stays at one.
- P14d-05a, P14d-05b: the walkthrough says "complete in skrum and close in Jira within the same minute to see the newer change win". Both changes lead to the same state, so nothing would conflict. The tests use opposite changes: reopened in skrum then closed in Jira 20 seconds later (Jira wins), and completed in skrum while Jira reports the issue open with a change in the same second (tie, skrum wins, one push, no loop on the echo). The unpushed skrum change is arranged with the factory.
- P14d-08b: "close as not planned" completes the item because "Treat canceled as done" is on by default for GitHub; the case with the option off is covered for Linear by `P14d-07c`.
- P14d-09b: the brief for this plan expected a 403 on the registration call for a non-administrator; the code asks `GET /rest/api/2/mypermissions?permissions=ADMINISTER` and does not attempt the registration when `havePermission` is false. The test fakes that answer and asserts that no registration was posted.
- P14d-10a: the walkthrough says the task shows "In progress in Jira"; the interface shows the tracker's own status name, "In Progress in Jira" for a Jira status named "In Progress".
- P14d-11a: the walkthrough's "cards say 'Checking every 5 minutes.'" is asserted on the GitHub card, where the test also turns the switch on with webhooks off and checks that the webhook route answers 404.
- P14d-13a: not a walkthrough item. Every other inbound event of this file is validly signed, so this test posts a GitHub `issues` event signed with another secret: the route answers 401 "Invalid signature.", one `rejected` row with `signature_mismatch` is kept, no job is queued, GitHub is not read, and the action item on the open board is unchanged (asserted on the snapshot the page fetches, on the card and in the database). The refusals of the other providers (Jira URL token and JWT, Jira Data Center signature, Linear signature and stale timestamp) are covered by `tests/Feature/Integrations/InboundWebhooksTest.php`.
- P14d-12: the uninstallation reaches skrum as GitHub's `installation` `deleted` webhook, confirmed by a faked 404 of `GET /app/installations/4242`; the card is reloaded to show it (the integrations page has no realtime channel).
- P11b-03b, P11b-16: the test process's request to `/mcp` leaves `auth.defaults.guard` on `sanctum` for the rest of the test, because the browser requests are served by the same application instance; the file's `p11bPostMcp()` restores the web guard after each call. This is an artefact of the one-process harness, not a product defect.
- P12c-03b: the import button reads "Import 1 tasks" for a single selected issue; the test asserts today's text (open, see Defects found).
- Section 1 says "press Create"; today's dialog also shows a template gallery (plan 17b) with "Blank" selected. `[P17a-01]` leaves "Blank" selected and asserts that the new board is empty.
- Section 2: the walkthrough's "within 1 s" is not asserted (residual `P17a-02e`); the tests assert arrival without a reload on the guest's canvas (`data-scene`), in the guest's snapshot and in the database.
- `[P17a-02b]` and `[P17a-03a]` drive the Excalidraw canvas with pointer events dispatched from a script (substitution for the mouse), which is why they are `auto-substituted`.
- `[P17a-02c]` replaces the upload by a stored file arranged with `Storage::fake()` and `WhiteboardFileFactory`, and the image element by a write through the real endpoint.
- Section 3: the walkthrough's drags were "one after the other in the same second, not truly simultaneous"; `[P17a-03a]` does the same. `[P17a-03b]` adds the rule that decides a true tie (same version: the lower nonce wins, the late writer gets the stored copy back), through the write endpoint.
- Section 5: "put A offline (devtools)" is replaced by failing A's XHR requests to the board from inside the page (`[P17a-05a]`, as the manual replay did) and by stopping Reverb (`[P17a-05b]`). In `[P17a-05b]` the edits travel through the five-second poll, because the HTTP server stays up.
- Section 6: the walkthrough expected the guest link to "show" the message; the page answers 404 with "This guest link is no longer valid.", which is what `[P17a-06a]` asserts. `[P17a-06a]` also asserts what the walkthrough did not look at: a guest already on the board loses access at once.
- Section 7: on a live page the session-ended state arrives with the broadcast, before any action (`[P17a-07a]`). `[P17a-07b]` arranges the replacement in the database without a broadcast so that the guest's own action is what reveals it. A reload of the ended page shows "Your session has ended.", not the board-gone message.
- Section 8: the "facilitator lock" of the manual replay is the write of a `locked: true` element by a non-facilitator, refused with the reason `locked`. The forged author is sent under both spellings (`authorMemberId`, `author_member_id`).
- Section 9 was not replayed by hand; `[P17a-11]` replays it in the browser with the limit lowered to one element.
- Second pass, "the main menu has no links group": asserted as "no `a[href]` in the canvas menu". "No library name" is asserted as the absence of the word "Excalidraw" in the help dialog.
- The regression block at the top of the walkthrough (lines 25 to 29: created from the team page, elements seen by a guest, reload with no write-back, reactions bar, no library name) repeats plan 17a; it is covered by `[P17a-01]`, `[P17a-02a]` to `[P17a-02c]`, `[P17a-04]`, `[P17a-10]` and `[P17a-09]`, which is why row `P17b-00` names the plan 17a test file.
- Line 49 ("the board shows the template's structure") and line 51 (snapshot: frames locked, notes unlocked) are one test, `[P17b-02]`: it asserts the number of elements of each template (the number `BuiltInTemplates::elements()` gives), the number of frames, the number of locked elements recorded on line 51 (Brainstorm 3, Flowchart 7, User story map 3, Impact map 4, SWOT 4, Lean canvas 9, 2×2 matrix 8) and that no sample note is locked.
- Line 50 was replayed by hand on seven boards; `[P17b-03]` replays it on the SWOT board only, with pointer events dispatched from a script (substitution for the mouse) and the Delete key. `[P17b-02]` proves the stored lock on all seven.
- Line 52: "every label sits inside its shape without clipping" is asserted on the geometry in the snapshot (each text bound to a shape lies inside that shape), not on the rendering; labels bound to arrows are left out, since an arrow has no inside.
- Line 55: the manual replay used a 375 px iframe; `[P17b-06]` resizes the viewport to 375×812 and also creates a board from the narrow dialog.
- Line 56: "shows its structure" is asserted on the thumbnail's SVG (nine outlined frames for the Lean canvas; three ellipses, two diamonds and five arrows for the Flowchart; the outlined shapes of a workspace template) and on the computed white background of every thumbnail surface in the dark theme.
- Lines 64 to 67 were replayed by hand with the same member; `[P17b-10]` does it with a second member, as the walkthrough asked. "Moving the shape moves the arrow end" is asserted as the binding itself: the arrow's `startBinding` names the copied shape and the shape lists the copied arrow.
- Line 68: both edits are writes through `PUT /whiteboards/{board}/elements` sent from each member's page, not canvas gestures.
- Line 72 ("delete a second template saved by A for this line") and line 73 are automated although the manual replay could not delete anything.
- Lines 83 and 84: the walkthrough accepted "redirect to login or 401/403"; the tests assert 401 for the three JSON requests and the redirect to `/login` for the page visit.
- Lines 92 and 93: the save picker is replaced in the page by a recorder, as in the manual replay. Line 93 expected a `.excalidraw` file; the product has since replaced the library's save by its own panel, and `[P17b-20]` asserts `<title>.whiteboard.json`, an `application/json` blob whose `source` is the application's origin and which holds the four elements and the image's file. It also asserts that no `.excalidraw` name was offered.
- Line 95: asserted as "no visible `a[href]`" and "the word Excalidraw is not on the page" in the canvas menu and in both export dialogs.
- Line 102: "nobody on the source sees a notice" is asserted on the facilitator's open page after a later change has reached it (so the page is known to be live): same title, no toast, still the facilitator.
- Line 105 was observed for one account only; `[P17b-27]` checks the three accounts.
- Lines 106 and 107 were not replayed by hand; `[P17b-28]` automates both. "Without a full page reload" is asserted with a value set on `window` before the deletion that is still there after it.
- Lines 115 and 116: the page is put behind the purge mark by a database write made without a broadcast (one element, `seq` and `purged_seq`), then a change the page does receive makes it ask for a delta. The banner "never appeared" in the manual replay of line 115; `[P17b-29]` asserts its absence at the end.
- Dot voting was removed from the product on 2026-10-01 (note at the top of `docs/superpowers/plans/2026-10-11-plan-17c-whiteboard-facilitation.md` and of the walkthrough file; spec `docs/superpowers/specs/2026-10-01-whiteboard-design.md:28`). Checked in the current code: no route contains `vote` under `whiteboards/` (`php artisan route:list --path=whiteboards` lists 16 routes, none for vote sessions); `grep -rniE "vote|voting"` finds nothing in `app/Models/Whiteboard*`, `app/Actions/Whiteboards`, `app/Http/Controllers/Whiteboards`, `app/Events/Whiteboards`, `resources/js/components/whiteboard`, `resources/js/pages/whiteboards`, `resources/js/hooks/use-whiteboard*`, `resources/js/lib/whiteboard` or the whiteboard migrations; the snapshot has no `voting` or `votingHistory` key (`BuildWhiteboardSnapshot`); the channel has no `vote.changed` event (`use-whiteboard-channel.ts`).
- Removed: **P17c-09** — section 5, "Given an open voting session, then no payload received by any member contains another member's votes or any total, and a member cannot exceed their budget" (V5.1, B7.1, B7.2, B7.3, B7.4, B7.7, B7.10). Feature removed on 2026-10-01, no test.
- Removed: **P17c-10** — section 6, "Given a closed session, then every member sees the same counts on notes and the same ranked list" (C6.1, B7.8, B7.9, B7.11). Feature removed on 2026-10-01, no test.
- Removed: **P17c-11** — section 7, "Given an open session, when a sticky in scope has its text changed, then the write is rejected" (S7.1, B7.5, B7.6), the screenshots "with a vote open and with a vote closed (panel shown)" of R2, and "the copy has no vote" of G5. Feature removed on 2026-10-01, no test. The fix found under B7.5 (a note keeps its height when its text is edited) stays in `scene-sync.ts`; it is not a line of this walkthrough any more and no browser test covers it.
- Section 1: the interface offers only whole minutes, so the countdown to zero (`[P17c-01c]`) starts the server's minimum of ten seconds through `PUT timer` from the facilitator's page; the pages then behave as after a click. `[P17c-01b]` clicks "1 min" and compares the two countdowns (at most one second apart) and the `timerEndsAt` of both snapshots, as lines T1.1 and T1.2 ask.
- B5.2 "A browser that opens the board mid-countdown shows the right remaining time": `[P17c-01d]` arranges a timer ending in 90 seconds with the factory and opens the board as a guest (78 to 90 seconds shown). The server's clock and the browser's are the same clock in a test, so the correction for a browser whose clock is wrong is not exercised.
- R1 used `psql` to move the end of the timer six minutes back; `[P17c-01d]` does it with Eloquent and reloads. It also asserts what the code does between zero and five minutes: a page opened after the end shows "Time's up!" without a toast.
- B5.1 "a member … sees neither": the walkthrough observed the facilitator after a hand-over; `[P17c-01a]` uses a second signed-in team member and a guest, and also sends the three requests they have no button for (403).
- L2.1 and B5.3 "B tries to draw": the interface gives a locked-out participant no tool to draw with, which `[P17c-02a]` asserts (view mode, no shapes toolbar, no sticky tool); the refusal itself is reached with `$this->writeWhiteboardElements()` from the guest's page (403, `errors.locked`), as the walkthrough did with `fetch`. "A can still draw": the facilitator adds a sticky note through the interface and moves the shape through the endpoint.
- B5.4 "the page stays on the board": asserted twice, after a refused `fetch` (`[P17c-02a]`) and after a write refused to the page's own sync (`[P17c-02b]`, where the lock is arranged in the database behind the open page so that the guest still has the sticky tool).
- B5.5: the walkthrough's own remark holds ("what B types before the lock is sent while typing"): `[P17c-02c]` waits until the typed words are stored, then asserts that the lock closes the editor and that nothing more is stored during the lock or after the unlock. The keys typed after the lock ("MORE", "X") are not replayed; with the editor closed they have no target.
- E3.1 and B5.6: the canvas does not let a non-facilitator drag a locked shape (the walkthrough found the same), so "it returns to its place" is proven with "Delete" from the guest's context menu, and the toast is asserted after that deletion. The facilitator locks and unlocks the shape through the context menu itself.
- B5.6 "B right-clicks … the empty canvas: no Unlock all elements entry": the entry is in the page and hidden by CSS (`display: none`), which is what `[P17c-02d]` asserts for a member, and that it is displayed for the facilitator.
- Section 4: following is proven through the zoom label of the canvas, which follows the facilitator's zoom; pausing through a click on the follower's own zoom button. The facilitator's pan is not replayed (residual `P17c-04e`). F4.1 is a pointer to B6.1–B6.7 and has no test of its own.
- B6.1 "after ten seconds without touching B, its row still says Following the facilitator": `[P17c-04a]` waits 2.4 seconds, which covers one repeated whisper (every 2 seconds), not ten seconds.
- B6.5 and F4.2: the take-over by a second member, which the walkthrough could not replay for lack of a second login, is replayed in `[P17c-05a]` with three browser contexts (the facilitator, a member, a guest).
- B5.7: the candidates are compared exactly (`Ada Admin`, `Max Member`), in the dialog and in the snapshot; the empty dialog, not replayed by hand, is `[P17c-05b]`.
- B7.12 is a voting-era line that still applies ("the new UI" is now the facilitator bar, the status row and the timer): `[P17c-07]` runs the walkthrough's own check (no library name in the text, the `aria-label`s or the `title`s, no outbound link) on a board with all three in use.
- G5: the vote part is removed; the rest is `[P17c-08]`. As the walkthrough noted, the locked shape stays locked in the copy.
- G1 to G4 repeat checks of plans 17a and 17b; they are covered by the tests of those walkthroughs (row `P17c-12`), and "Duplicate this board" is exercised again by `[P17c-08]`.
- The walkthrough's list "Feature tests that pin these criteria" still names `WhiteboardVotingTest`, `WhiteboardVotingWritesTest`, `WhiteboardVoteModelTest` and `WhiteboardVotingSecrecyTest` and "the text freeze under vote, refund of deleted notes" (lines 167 to 170), which its own line 163 says no longer exist.
- Removed rows of plan 17d: each describes a feature removed on 2026-10-01; no test is written. Evidence common to all of them: `php artisan route:list --path=whiteboards` lists 16 routes, none for versions, votes or a reveal; `app/Http/Controllers/Whiteboards/` holds no versions, vote or private-writing controller; `app/Models/` holds no `WhiteboardVersion`; `database/migrations/` holds four whiteboard migrations, none adding `private_writing`, `is_private`, `last_versioned_seq` or `whiteboard_versions`; `lang/en.json` no longer holds "Reveal the notes first.", "Version history", "Private writing" or "Start a vote"; `tests/Feature/Whiteboards/` holds no `WhiteboardPrivateWriting*`, `WhiteboardVersion*` or `WhiteboardAutomaticVersionsTest`; the walkthrough's own notes (lines 3 and 5) and the notes at the top of `docs/superpowers/plans/2026-10-12-plan-17d-whiteboard-secrecy-history.md` say so.
- Removed: **P17d-00f** — "A quick vote: open, one vote, close, results" (line 44). Dot voting was removed: commits `bd30526` (server) and `603c5d8` (interface and strings). `resources/js/components/whiteboard/facilitator-bar.tsx` holds the timer, the lock and follow-me only.
- Removed: **P17d-01** — section 1, "A masked note carries no text for anyone but its author" (lines 55 to 63, with B7.5 and B7.10). Private writing was removed: commits `bd30526` (server), `603c5d8` (interface), `4adbffe` (plan and walkthrough notes). `PresentWhiteboardElement` masks nothing; the snapshot (`BuildWhiteboardSnapshot`) has no `privateWriting` key; `WhiteboardSettingsController::update()` validates no `private_writing` key.
- Removed: **P17d-02** — section 2, "A masked note cannot be changed by another member" (lines 65 to 73, with B7.11 and B7.12). Same removal. The reject reasons of the client are `invalid`, `stale`, `locked`, `file`, `full` (`board.tsx`): there is no `private`.
- Removed: **P17d-03** — section 3, "The reveal shows every note to every member" (lines 75 to 81). Same removal: no reveal button, no reveal endpoint.
- Removed: **P17d-04** — section 4, "Features that would leak a hidden note are refused" (lines 83 to 89). Same removal: `WhiteboardGuard` has no `notPrivateWriting()`; duplicate and save-as-template have no such refusal.
- Removed: **P17d-05** — section 5, "Automatic versions" (lines 93 to 101). Version history was removed: commits `a3ca4f3` (server), `1af3b88` (interface and strings), `3320cb1` (leftovers), merged by `47cc047`; `e1bc67a` marks it in the plan and the walkthrough. There is no `StoreAutomaticWhiteboardVersion` job.
- Removed: **P17d-06** — section 6, "Restore" (lines 103 to 109). Same removal: no versions endpoints, no history button, panel or preview.
- Removed: **P17d-07** — section 7, "Guests have no history" (lines 111 to 117, and the seven version requests of line 119). Same removal: the endpoints a guest was refused on no longer exist. The one observation of line 119 that still applies, the guest's `PATCH settings` answering 403, is `[P17d-07a]`.
- Not rows of plan 17d: also not replayable, and not rows (they are not checked lines): the version lines of "Result" (lines 24 to 26), the notes "Seen in passing" about version names, "Vote results" and the history sheet (lines 30 to 32 and 34), the queue-worker instruction of "Before starting" (line 49), and the table of the secrecy invariant with its list of feature tests (lines 121 to 142), all of which name code and tests that were removed.
- The plan 17d walkthrough is almost entirely about private writing and version history, both removed on 2026-10-01, with dot voting. Its sections 1 to 7 and its "quick vote" line have the status `removed` and no test. Only "Regression of 17a to 17c basics" still applies, and one observation of section 7.
- Line 119 reads "403" for the guest's `PATCH settings` next to version requests answered "Guests cannot do this.". The settings endpoint answers a guest "Only the facilitator can do this." (`WhiteboardGuard::facilitator()`), which is what `[P17d-07a]` asserts, with the unchanged board in the database and in the guest's own snapshot.
- Plan 17d, regression lines 38 to 43: by ruling W1 the plan 17d file has no test of its own for them; the rows point at the plan 17a tests that prove the same (`P17d-00a`: `[P17a-01]`; `P17d-00b`: `[P17a-02a]` and `[P17a-02b]`; `P17d-00d`: `[P17a-04]`; `P17d-00e`: `[P17a-10]` and `[P17a-09]`, and the same claims on the plan 17b and 17c boards in `[P17b-22]` and `[P17c-07]`).
- The walkthrough of plan 17d was run with a single participant (line 11): line 40, "A second participant sees them", was never ticked. `[P17a-02a]` and `[P17a-02b]` have a second participant, a guest who joined through the guest link. The rectangle of line 39 was drawn "by drag"; `[P17a-02b]` draws it with scripted pointer events, hence `auto-substituted`. The text typed into the note is residual (`P17d-00c`).
- Line 45: the walkthrough read `locked` in the snapshot and the button's label. `[P17d-00g]` asserts both, and what the walkthrough could not see without a second participant: the other member's snapshot, the "This board is locked." status, the refusal of that member's write (403 with `errors.locked`), the facilitator's write still accepted, and the member's write accepted after the unlock. `[P17c-02a]` proves the same server path for a guest.
- Line 119: see `[P17d-07a]` above; it overlaps the guest half of `[P17c-01a]` (lock and follow-me refused) and adds the title and guest-access keys and the unchanged snapshot.
- Task 5 countdown bounds: the displayed countdown can read one second above the true remaining time (the page runs up to about 0.4 s behind the server clock), so `[P17c-01b]`, `[P17c-01c]` and `[P17c-01d]` accept one second more than the nominal value at the top (T1.1 itself allows a difference of one second between two pages); the server-side `timerEndsAt` is asserted exactly.
- `[P17a-09]` asserts "no Documentation, no Excalidraw" in the help dialog on its rendered text (`innerText`): the product hides the help header with `display: none`, and a text assertion on the dialog also matches hidden text.
- Line 92 of plan 17b (export dialogs): in Chromium the image export dialog has no file-name field (the library shows it only without the native file-system API); `[P17b-19]` asserts the two names offered to the save picker ("<title>.png", "<title>.svg") and the preview canvas.

## Defects found

Add one line per defect: identifier, what was wrong, the commit that fixed it.

- `[P06-08a]` (polish pass PB1): the drag preview of a retro card was always 256 px wide (the `w-64` fallback) instead of as wide as the card (262 px in the default layout). `board.tsx` read `event.active.rect.current.initial` in `onDragStart`, which dnd-kit 6.3.1 only fills in a later layout effect, so the width was always undefined. Fixed in the commit `fix(retro): give the drag preview the width of the dragged card` by measuring the card element when the drag starts.
- `[P07-09]` (plan 7, step 9), open, for the user: closing the presentation overlay with Escape takes two presses when the presented card has a reaction chip with names. The dialog puts the focus on its first control, the chip, whose names tooltip opens on focus; the first Escape closes only that tooltip. The test asserts today's behaviour (two presses). Not fixed: where the overlay puts its focus is a design decision.
    - Impact: a participant who presses Escape to close the presented card sees a tooltip disappear and the overlay stay, and has to press Escape a second time; a facilitator needs the same two presses to stop presenting with the keyboard.
    - Candidate fix: give the dialog in `presentation-overlay.tsx` an explicit initial focus (the dialog itself or its title, through `onOpenAutoFocus`) so that no chip tooltip opens when the overlay appears. Small: one component, a few lines.
    - Test: `[P07-09]` sends Escape twice to the chip and asserts the overlay is still there after the first press; this test will fail when the defect is fixed and must be updated then.
- `[P07-08a]` (plan 7, step 8), open, for the user: the drag wrapper of a card (`SortableCard`, `GroupableCard` in `dnd.tsx`) carries dnd-kit's `aria-disabled="true"` whenever the card cannot be dragged (locked board, another participant's card), and wraps every control of the card. The controls still work with a pointer, but assistive technology, like Playwright's actionability check, treats them as disabled (the `Comments (n)` toggle of a locked board is the case the test meets; it is clicked from a script). Not fixed: changing the wrapper's ARIA is an accessibility design decision.
    - Impact: a screen reader user on a locked board, or on another participant's card in Writing, can hear the controls that still work inside the card (the comments toggle, the reaction chips of an open board) announced as unavailable.
    - Candidate fix: in `dnd.tsx`, do not pass dnd-kit's `aria-disabled` (and its `role="button"` and `tabIndex`) to the wrapper when the card cannot be dragged, or move the drag attributes to a handle of their own inside the card. Small for the first (two components), medium for a handle (a new control on every card).
    - Test: `[P07-08a]` asserts `aria-disabled="true"` on `@retro-card-handle-…` of a locked board and clicks the comments toggle from a script because of it; this test will fail when the defect is fixed and must be updated then. The lock itself is asserted on each control's own `disabled` property (`plan07IsNativelyDisabled()`), in `[P07-08a]` and `[P07-08b]`, since `assertDisabled()` passes on any control inside such a wrapper.
- `[P07-01a]` (plan 7, step 1), open, for the user: a remote cursor points at a different place when the two boards do not have the same scroll width. `live-cursors` normalises a position to the board's `scrollWidth`, the columns are 288 px wide whatever the window, and the board's `main` is `flex-1`, so on a window wider than the columns the scroll width is the window's width. Measured with an 800 px page hovering the card of the third column and a 2400 px page watching: the cursor came to rest at x = 1067 while that card spans 637 to 899. The feature spec (§3) says positions match across screen sizes. The test keeps equal viewports and asserts today's behaviour. Not fixed: it needs another coordinate model (a design decision).
    - Impact: any two participants whose windows are wider than the columns and differ in width see each other's cursor in different places, and that is the usual desktop case: a cursor resting on a card for its owner points beside that card, or at another column, for the others. This contradicts the board engagement spec §3 ("positions match across screen sizes and scroll offsets").
    - Candidate fix: normalise positions to the extent of the columns and not to the scroll container, for example by giving `LiveCursorLayer` an inner element as wide as its content (`w-max`) as the cursor container, in `board.tsx`. Medium: the layout of the board's `main` changes, and the poker game uses the same `LiveCursors` component and has to be checked. This one deserves its own spec.
    - Test: `[P07-01a]` gives both pages the same viewport (800 px), so it does not pin the defect and will keep passing when it is fixed; the fix needs a test with two different widths.
- `[P07-01a]` (plan 7, step 1), open, for the user: after a window is narrowed, the board keeps scrolling sideways over empty space up to its former width while live cursors are on. The cursor overlay (`.lc-overlay`) is an absolutely positioned child of the board sized to the board's `scrollWidth`, so it holds that width itself: a page resized from 1728 px to 800 px still reports `scrollWidth` 1728, although the three columns end at 928 px. Not fixed: the sizing is done by the `live-cursors` library; containing the overlay is a design decision.
    - Impact: a participant who narrows the window (or opens a side panel that narrows the board) gets a horizontal scrollbar over empty space until the page is reloaded, and that stale width is also the one the cursor positions are normalised to, which adds to the defect above.
    - Candidate fix: keep the overlay out of the board's scroll extent, for example by sizing it to an inner content element instead of the scrolling `main` (the same element as in the candidate fix above). Small to medium, to be decided in the same spec as the cursor coordinates; the mechanism inside the `live-cursors` library was measured, not read.
    - Test: none pins it. `[P07-01a]` narrows both pages to 800 px, where the three columns (928 px) overflow anyway.
- `[P08d-01c]` (plan 8d, step 1), open, for the user: with the keyboard, a group cannot be dropped onto a group that sits below it in the same column. Measured with two groups of two cards each in one column (each 328 px high): after Space and ArrowDown the announcement is "“Slow CI” is over column Start.", further ArrowDown presses change nothing, and Space drops the group on the column, which only moves it to the end ("Dropped “Slow CI” on column Start.", no grouping). Upwards it works: ArrowUp puts the lower group over the upper one and Space groups them, which is what the test does. Probable cause, read from the code and not isolated: the board uses `closestCenter` with the column itself as a drop target, and the drag preview is shorter than a group, so the preview's centre is nearer the column's centre than the lower group's. A pointer drag is expected not to be affected in the same way, since the pointer can be placed anywhere: this is reasoning from the code, not a measurement (no pointer drag was run). Not fixed: choosing another collision strategy for the board is a design decision.
    - Impact: a keyboard-only participant cannot merge a group into a group below it in the same column; the drop silently moves the group to the end of the column.
    - Workaround: drag the lower group upwards onto the upper one (measured, it is what `[P08d-01c]` does).
    - Options: keep today's behaviour and the workaround, or give the board a collision strategy that prefers a card over the column that contains it (the candidate fix below).
    - Candidate fix: a collision detection for the board's `DndContext` (`board.tsx`) that prefers a card under the dragged item over the column that contains it, with `closestCenter` as the fallback. Small in code (one function), medium in risk: it changes every drag on the board, so the drag walkthroughs of plans 4, 6 and 8d must be run again.
    - Test: `[P08d-01c]` drags upwards, so it does not pin the defect and will keep passing when it is fixed; the fix needs a test that drags a group downwards.
- `[P13b-05c]` (plan 13b, step 5): in Draw & Guess a viewer saw a stroke again for up to three seconds after the drawer had undone it or cleared the drawing, when the viewer's page had fetched a fresh snapshot between the stroke and the undo (a player joining, a room change, a reconnect, or the resync that follows the page's own subscription). The `replace` action of `room-reducer.ts` dropped the client-only `committedOpIds`, so the live preview of the stroke, kept for three seconds, was no longer hidden once its committed operation was gone. Fixed in the commit `fix(games): keep the committed stroke ids when a room snapshot is replaced`; `[P13b-05c]` failed before the fix (the pixel of the cleared line was still `23 23 23 255`).
- `[P13d-12f]` (plan 13d, step 12): when the team's only share channel failed with a reconnect error (Slack answering `404 channel_is_archived`), the room's "Invite" button and its open dialog disappeared, so the line "Slack: failed — Reconnect Slack in the team settings." was never shown, against the games spec §3.1 and §6 ("delivery failures … show on the delivery line"). `RoomInviteButton` and `PostLinkSection` rendered nothing as soon as no channel was available. Fixed in the commit `fix(games): keep the invite dialog and its failed delivery line when no share channel is left` (`7669fbf`). `[P13d-12f]` failed before the fix (the line was never on the page). The fix changed two components, one of them shared, so it reaches more than the games room:
    - `room-invite-button.tsx` (games only): the "Invite" button is shown when a channel is available or when the room's snapshot holds a delivery line (`hasShareChannel(snapshot.share) || snapshot.deliveries.length > 0`). The gate is "any delivery line exists", not "a failed delivery exists": a line of any status (sending, sent, failed) keeps the button. The snapshot holds the newest delivery of each channel (`LatestDeliveries`) and a delivery row is pruned after 90 days (`IntegrationDelivery::RetentionDays`), so after every channel is disconnected the button stays for up to 90 days of delivery history. Deliveries are only sent to viewers who may invite.
    - `post-link-section.tsx` (shared by the games, retro and poker dialogs): the "Post a link" section is rendered when a channel is available or when it is given a delivery line (it returned nothing without a channel before); with no channel it shows the heading, the hint and the delivery lines, without channel buttons and without the guest-link checkbox (`guestLinkAvailable && channels.length > 0`).
    - Surfaces affected: (1) the games "Invite to the room" dialog, the purpose of the fix, covered by `[P13d-12f]` on a team room and on a room open by link. (2) The retro "Guest link…" dialog of the facilitator menu (`guest-link-dialog.tsx`), which renders `BoardPostLink` with no `hasShareChannel()` gate: on a retro that is not completed, a facilitator whose team has no working channel but whose retro has a link delivery now sees the "Post a link" heading with the delivery line there; before the fix the dialog showed nothing below the guest link. No browser test covers it. (3) The poker "Share the game" dialog (`game-share-dialog.tsx`): a dialog that is open when the last channel goes keeps the heading and the delivery line instead of becoming empty; it cannot be reopened, since the menu item is gated (next entry). No browser test covers it. (4) The retro "Share the board" dialog (`share-board-button.tsx`) shows no change: its button and its dialog are removed together when no channel is available.
- `[P13d-12f]` (plan 13d, step 12), open, for the user: one decision about the share controls when no channel is available. The three surfaces that post a link do not behave alike since the fix above. Games: the "Invite" button stays while any delivery line exists (`room-invite-button.tsx`). Retro board: the "Share" button needs a channel (`share-board-button.tsx`: `hasShareChannel(integrations)`), but the "Guest link…" dialog shows the section with the delivery line whenever one exists (`guest-link-dialog.tsx`, ungated). Poker: the menu's "Share…" item needs a channel (`game-menu.tsx`: `hasShareChannel(share)`). Not changed: which control stays, and for which deliveries, is a product decision (ruling D4).
    - Impact: when the team's only share channel needs a reconnect after a failed post, the retro board's "Share" button is removed together with its open dialog and the failed delivery line is not shown there (it is shown in the "Guest link…" dialog); the poker menu loses its "Share…" item, so the failed line is visible only in a dialog that was already open. In a games room, the "Invite" button stays after every channel is disconnected, for up to 90 days, also when the last delivery was sent successfully; its dialog then shows only past delivery lines and nothing to press.
    - Options: (a) keep as is. (b) Show the section, and the games "Invite" button, without a channel only when a failed delivery exists: this narrows the gate of the fix to the defect it answers. (c) Make the three surfaces (games invite, retro board share, poker share) consistent, with either gate.
    - Candidate fix: for (b), replace `deliveries.length > 0` by "a delivery with the status `failed` exists" in `room-invite-button.tsx` and `post-link-section.tsx`; small: two components, and `[P13d-12f]` keeps passing. For (c), give `share-board-button.tsx` and `game-menu.tsx` the condition chosen for `room-invite-button.tsx`, in one helper next to `hasShareChannel()` in `resources/js/lib/integrations.ts`; small: three or four components and two new browser tests.
    - Test: `[P13d-12f]` pins the games room only (a failed delivery, team room and room open by link); it passes under (a), (b) and (c). No browser test opens the retro "Share" or "Guest link…" dialog or the poker "Share…" dialog with a delivery line and no channel; (c) needs one for the retro board and one for poker.
- `[P13c-06]` (plan 13c, step 6), open, for the user: plan 13c's text says that "Next round" closes a round that is in its voting window, but the interface offers no such control: `StartRoundControls` is rendered only by the end card, so a host cannot start the next round while the round is being voted on, except from a page that has not seen the voting round. The server rule works and is covered (`SprintGifTest`). Not fixed: adding a control is a design decision.
    - Impact: a host who wants to cut a voting window short has to finish the round first and then start the next one; this costs one click and loses nothing.
    - Candidate fix: render `StartRoundControls` (or a "Next round" button) in the voting state of the Sprint panel for the host. Small in code, but it changes the host's controls during voting, which is why it is left for the user.
    - Test: `[P13c-06]` takes the stale-page route and asserts today's behaviour; it keeps passing when a button is added, and the new control needs its own test.
- `[P14d-02]` (plan 14d, step 2), open, for the user: on an open board the label "Completed in :source" of an action item that its tracker completed appears only after the page is loaded again. The item itself completes live. `PresentActionItem` gives `completedVia: null` to payloads presented without a viewer, which is what a broadcast carries, because the value is hidden from guests and the broadcast goes to the presence channel guests are on. Not fixed: sending it live means sending it on the members-only channel, a design decision.
    - Impact: a member watching the board sees the item complete without knowing that its tracker did it, until they reload; the plan 14d walkthrough expects the label at once.
    - Candidate fix: include `completedVia` in the payload of the members-only action item event, or refetch the item on the members-only channel when it completes. Small to medium: one presenter and one event, with a check that no guest receives the value.
    - Test: `[P14d-02]`, `[P14d-05a]`, `[P14d-07b]`, `[P14d-08b]` and `[P14d-11b]` assert the live completion, then reload and assert the label; none asserts that the label is absent before the reload, so they keep passing when the defect is fixed.
- `[P14c-11]` (plan 14c, step 11), open, for the user: no interface control clears a poker estimate; the facilitator toolbar only offers the cards of the deck. Clearing exists on `PUT /poker/{game}/tasks/{task}/estimate` with `value: null` only. Not fixed: adding a control is a design decision. The row is `auto-substituted`: the test sends that request from the facilitator's page.
    - Impact: a facilitator who saved a wrong estimate on a task imported from GitHub can replace it but cannot remove it, so the block written to the issue body stays.
    - Candidate fix: a "Clear estimate" item on the task's menu that sends `value: null`. Small in code, but it adds a control to the facilitator's menu, which is why it is left for the user.
    - Test: `[P14c-11]` sends the request with `fetch()` from the facilitator's page and keeps passing when a control is added; the new control then needs its own test. The removal of the block is also covered by the feature test "removes the block when the estimate is cleared" in `tests/Feature/Integrations/GitHubTrackerTest.php`.
- `[P12c-03b]` (plan 12c, step 3), open, for the user: the import button reads "Import 1 tasks" when a single issue is selected, because English has no singular form for the label (the toast "1 tasks were not found in Jira." has the same shape). Not fixed: the copy is a product decision.
    - Impact: cosmetic; a facilitator who selects one issue reads an ungrammatical button.
    - Candidate fix: a pluralised translation key for the count in the import dialog and the two toasts. Small.
    - Test: `[P12c-03b]` and `[P12c-07b]` assert today's texts and will fail when the copy changes and must be updated then.

## Verification of plan 16a

Date: 2026-10-01

| Criterion (spec §10) | Evidence                                                                                                                                                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1                    | `composer test:browser` passed twice: 82 tests (1253 assertions), 152 s and 151 s; run on the host PHP of the worktree, not inside Sail; port 8097 free after each run. After the final fix wave `vendor/bin/pest tests/Browser` (no frontend change, so no rebuild) passed once: 87 tests (1343 assertions), 157 s |
| 2                    | Source scan green (`tests/Arch/BrowserTestRulesTest.php`); grep for forbidden calls empty                                                                                                                                                                                                                           |
| 3                    | `tests/Browser/Smoke/HarnessTest.php` green                                                                                                                                                                                                                                                                         |
| 4                    | `tests/Browser/Smoke/RealtimeTest.php` green                                                                                                                                                                                                                                                                        |
| 5                    | 70 rows; 51 `auto`, 13 `auto-substituted`, 6 `residual`; 67 identifiers in test titles, all in the table; the 6 `residual` rows are in the checklist                                                                                                                                                                |
| 6                    | `composer test:arch`: 13 tests green; one `ignoring()` with its reason                                                                                                                                                                                                                                              |
| 7                    | `composer test` green (3641 tests); no browser test listed                                                                                                                                                                                                                                                          |
| 8                    | CI run not pushed yet: waiting for the user                                                                                                                                                                                                                                                                         |
| 9                    | Suite green; phpstan, types, lint, Rector clean; `npm run check` still reports the known formatting findings in `.devcontainer/devcontainer.json` and `docs/superpowers/*.md` only (the three files of `docs/superpowers/walkthroughs` are formatted and no longer listed)                                          |
| 10                   | Product diff reviewed: only `data-test`, `data-realtime` and the §5.3 refactors (backend compared against the Rector commit `b321061`)                                                                                                                                                                              |

Residual steps still to be checked by hand: see `residual-manual-checklist.md`.

## Verification of plan 16b

Date: 2026-10-01

| Check                      | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Browser suite, twice       | 142 tests (2486 assertions), 271 s and 268 s, after one test fix: the first two runs each failed on `[P06-08a]` (141 passed, 1 failed), where the Escape that cancels the keyboard drag was lost; the test now waits one timer turn before Escape (`test(browser): wait a timer turn before cancelling the drag in [P06-08a]`). Port 8097 free after each run                                                                                                                                                                                                                                                                  |
| Arch suite and source scan | green: `composer test:arch`, 28 tests (109 assertions)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `composer test`            | Tests green on the second run, no browser test listed: 3656 tests (34815 assertions). The first run had one failure outside this plan, `tests/Feature/Mcp/PromptsTest.php` "drops the last messages of the board order when vote totals are hidden" (3655 passed, 1 failed); the file then passed 5 runs of 5 alone and in the next full run. `composer test` itself stops at its PHPStan step when PHP's memory limit is the default 128M ("PHPStan process crashed"); the steps were then run one by one: Pint passed, `vendor/bin/phpstan analyse --memory-limit=2G` no errors, `php -d memory_limit=2G artisan test` green |
| Rector, types, lint        | Rector: 0 changed files; `npm run types:check` clean; `npm run check` reports only the known formatting findings in `.devcontainer/devcontainer.json` and `docs/superpowers/{plans,specs,research}/*.md`, among them the browser test spec that this plan edited; no file of `docs/superpowers/walkthroughs`, no `.ts` or `.tsx` file                                                                                                                                                                                                                                                                                          |
| Coverage rows of this plan | 58 rows: 39 `auto`, 14 `auto-substituted`, 5 `residual`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Product diff               | `data-test` / `data-realtime`, plus: the subscription state that feeds `data-realtime` on the workspace "Action items" page (`resources/js/pages/action-items/index.tsx`), the rename of seven listener classes with the `Listener` suffix (Task 0, `refactor(listeners)`), and this defect fix: `fix(retro): give the drag preview the width of the dragged card` (`board.tsx`)                                                                                                                                                                                                                                               |

## Verification of plan 16c

Date: 2026-10-01

| Check                      | Evidence                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser suite, twice       | 214 tests (3984 assertions), 390 s and 391 s, both runs green with no test changed. Port 8097 free after each run. After the final fix wave (stray-request guard in `BrowserTestCase`, snapshot assertions): 214 tests (3984 assertions), 390 s with the guard alone and no test changed, then 214 tests (4027 assertions), 383 s with the changed tests |
| Arch suite and source scan | green: `composer test:arch`, 28 tests (109 assertions)                                                                                                                                                                                                                                                                                                   |
| `composer test`            | green on the first run, no browser test listed: Pint passed, PHPStan 0 errors, 3656 tests (34815 assertions), the same count as before this plan                                                                                                                                                                                                         |
| Rector, types, lint        | Rector: 0 changed files; `npm run types:check` clean; `npm run check` reports only the known formatting findings in `.devcontainer/devcontainer.json` and `docs/superpowers/{plans,specs,research}/*.md` (54 files); no file touched by this plan, no file of `docs/superpowers/walkthroughs`, no `.ts` or `.tsx` file                                   |
| Coverage rows of this plan | 73 rows: 56 `auto`, 13 `auto-substituted`, 4 `residual`                                                                                                                                                                                                                                                                                                  |
| Product diff               | empty: this plan changed no file under `app`, `routes` or `resources/js` (no hook added, defect fixes: none). One defect was recorded as open, for the user: `[P08d-01c]`                                                                                                                                                                                |

## Verification of plan 16d

Date: 2026-10-01

| Check                      | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser suite, twice       | 268 tests (5208 assertions), 474 s and 474 s, both runs of `composer test:browser` green with no test changed. Port 8097 free after each run. After the final fix wave (one new test `[P13d-04]`, a second data set for `[P13d-12f]`, `awaitResync()` in `[P13a-04b]` and `[P13c-06]`, a reload in `[P13b-04a]` and `[P13b-04b]`; no frontend change, so no rebuild) the five touched walkthrough files passed twice each: 66 tests (1547 assertions); the whole suite was not run again                                                                                                                                                                                                                                                             |
| Arch suite and source scan | green: `composer test:arch`, 33 tests (114 assertions)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `composer test`            | green on the first run, no browser test listed: Pint passed, PHPStan 0 errors, 3661 tests (34820 assertions)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Rector, types, lint        | Rector: 0 changed files; `npm run types:check` clean; `npm run check` reports only the known formatting findings in `.devcontainer/devcontainer.json` and `docs/superpowers/{plans,specs,research}/*.md` (54 files); no file of `docs/superpowers/walkthroughs`, no `.ts` or `.tsx` file                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Coverage rows of this plan | 66 rows: 32 `auto`, 27 `auto-substituted`, 7 `residual`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Product diff               | no `data-test` or `data-realtime` hook added; only these defect fixes: `fix(games): keep the committed stroke ids when a room snapshot is replaced` (`room-reducer.ts`, `[P13b-05c]`) and `fix(games): keep the invite dialog and its failed delivery line when no share channel is left` (`room-invite-button.tsx`, `post-link-section.tsx`, `[P13d-12f]`). Nothing under `app` or `routes` changed. The second fix also changes the retro "Guest link…" dialog and an open poker "Share the game" dialog, through the shared `PostLinkSection` (see "Defects found"). Two defects were recorded as open, for the user: `[P13d-12f]` (one decision about the share controls of games, retro and poker when no channel is available) and `[P13c-06]` |

## Verification of plan 16e

Date: 2026-10-01

| Check                      | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser suite, twice       | 383 tests (7030 assertions), 628 s and 623 s, both runs of `composer test:browser` green with no test changed. Port 8097 free after each run. After the final fix wave (three new tests `[P14b-07]`, `[P14c-11]` and `[P14d-13a]`, the echo assertions of `[P14d-05b]`, 404 catch-alls with explicit fakes in seven tests, `Mail::fake()` in `[P12b-04a]`, the `last_checked_at` assertion of `[P12a-03a]`; no frontend change, so no rebuild) the five touched walkthrough files passed twice each: 72 tests (1099 assertions); the whole suite, now 386 tests, was not run again |
| Arch suite and source scan | green: `composer test:arch`, 33 tests (114 assertions)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `composer test`            | green on the first run, no browser test listed: Pint passed, PHPStan 0 errors, 3661 tests (34820 assertions), the same count as before this plan                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Rector, types, lint        | Rector: 0 changed files; `npm run types:check` clean; `npm run check` reports only the known formatting findings in `.devcontainer/devcontainer.json` and `docs/superpowers/{plans,specs,research}/*.md` (54 files); no file touched by this plan, no file of `docs/superpowers/walkthroughs`, no `.ts` or `.tsx` file                                                                                                                                                                                                                                                             |
| Coverage rows of this plan | 149 rows: 15 `auto`, 96 `auto-substituted`, 38 `residual` (147 rows: 14, 94, 39 before the final fix wave)                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Product diff               | only `data-test`: one hook, `data-test="integration-card-<provider>"` on the card of `resources/js/components/integrations/integration-card.tsx`; nothing under `app` or `routes` changed; defect fixes of this plan: none. The range `32ff6b4^..HEAD` also holds the six commits of the plan 16d fix wave (`3fd00f1..594c640`), which change tests and documents only. Three defects were recorded as open, for the user: `[P14d-02]`, `[P14c-11]` and `[P12c-03b]`                                                                                                               |
