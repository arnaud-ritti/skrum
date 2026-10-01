# Walkthrough coverage

Spec: `docs/superpowers/specs/2026-10-01-browser-e2e-and-arch-tests-design.md` (§4). One row per walkthrough step. A step that became several tests has one row per test, or one row naming its tests.

| Status             | Meaning                                                                  |
| ------------------ | ------------------------------------------------------------------------ |
| `auto`             | Covered by a browser test as written.                                    |
| `auto-substituted` | Covered by a browser test using a substitution from spec §3.6.           |
| `residual`         | Not automated; listed in `residual-manual-checklist.md` with the reason. |

A test is found by its identifier: `vendor/bin/pest tests/Browser/Walkthroughs --filter='P10a-07'`.

## Summary

| Walkthrough                           | Rows    | `auto`  | `auto-substituted` | `residual` |
| ------------------------------------- | ------- | ------- | ------------------ | ---------- |
| Plan 4, retro core                    | 26      | 19      | 5                  | 2          |
| Plan 10a, poker core                  | 16      | 13      | 3                  | 0          |
| Plan 10b, poker additions             | 28      | 19      | 5                  | 4          |
| Plan 6: polish pass                   | 15      | 7       | 6                  | 2          |
| Plan 7: board engagement              | 21      | 12      | 6                  | 3          |
| Plan 9a: action items core            | 9       | 9       | 0                  | 0          |
| Plan 9b: action items scope additions | 13      | 11      | 2                  | 0          |
| Plan 8a: flow and templates           | 14      | 14      | 0                  | 0          |
| Plan 8b: health check                 | 11      | 10      | 1                  | 0          |
| Plan 8c: surveys                      | 10      | 10      | 0                  | 0          |
| Plan 8d: results                      | 16      | 13      | 1                  | 2          |
| Plan 8e: LLM features                 | 22      | 11      | 9                  | 2          |
| **Total**                             | **201** | **148** | **38**             | **15**     |

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
| P08e-03a | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5509 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto             |
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
| P08e-10c | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5519 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto             |
| P08e-11a | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5520 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto-substituted |
| P08e-11b | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5520 | tests/Browser/Walkthroughs/Plan08eLlmTest.php | auto-substituted |
| P08e-11r | docs/superpowers/plans/2026-09-30-plan-8e-llm.md:5511 | (none)                                        | residual         |

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
- **Step 1, "follow scrolling" (P07-01a).** The test checks that the cursor sits over the same card on the watching page, before and after that page scrolls its board sideways. Both pages have the same viewport (800 × 700) and the same board content, because positions are normalised to the board's scroll size and two boards of different scroll width do not agree on a position (see "Notes for the lead").
- **Step 1, "disappear on blur" (P07-01b).** A headless page cannot be unfocused, so the test dispatches the `blur` event the cursor library listens for and asserts that the cursor left in under 1.5 seconds, which separates it from the 3-second expiry of an idle cursor.
- **Step 1, "Hide my cursor" (P07-01b).** The control is a toggle button in the header (`aria-label` "Hide my cursor" / "Show my cursor", `aria-pressed`), not a switch as the feature spec's §7 words it. The test also asserts what the spec adds: the preference is kept in `localStorage` across a reload and the viewer still sees other cursors.
- **Step 2, "gather into a bubble" (P07-02a).** A bubble forms only when two different people send the same emoji within 700 ms and lasts under a second; the test records it with a `MutationObserver` and asserts a `gathering` reaction with a count of at least 2 on both pages.
- **Step 3, "chip tooltip shows names; anonymous retro shows none" (P07-03a, P07-06a).** On an anonymous retro the tooltip is not rendered at all, which is what the tests assert.
- **Step 3, "any emoji" (P07-03a, P07-03b).** P07-03a toggles an emoji outside the quick set that another participant already used (🦄); P07-03b picks one in the full picker with the emoji list faked upstream.
- **Step 4, notifications (P07-04b).** "Only on private channels" is asserted as absence: the facilitator, who is neither the card's author nor in the thread, receives the comment itself (the count changes) but no toast and no unread dot.
- **Step 5, "network panel shows no request to giphy.com, tenor.com or jsdelivr.net" (P07-05a, P07-05b, P07-07b).** Replaced by the page's Resource Timing entries and by the origin of every `img` and `source` element, read with `assertScript()`; the server side is asserted with `Http::assertSent()` (what skrum asked the provider and the CDN) and `Storage::assertExists()` (the proxy's local copy).
- **Step 6 (P07-06a, P07-06b).** Covered by two tests; P07-06b overlaps `[P10b-15c]`, which checks the same two facts after the poker refactoring of the shared layers.
- **Step 7, "each of the six toggles".** The settings dialog shows six engagement switches only when a GIF provider is configured, five otherwise (feature spec §5 and §7). P07-07a asserts the five and toggles reactions and cursors; P07-07b asserts the six and toggles GIFs; the three other switches are exercised live in P07-10 (hide vote counts), P07-08a (close for editing) and P07-09 (presentation mode).
- **Step 8, lock (P07-08a, P07-08b).** The interface does not let a locked board send an edit: it removes or disables the controls, which is what P07-08a asserts for cards, drag, reactions, comments, votes and action items. The server's 423 and its toast are reached in P07-08b from a page that has not yet received the lock, arranged by setting `is_locked` in the database. The 423 of every endpoint stays covered by `tests/Feature/Retros/BoardLockTest.php`.
- **Step 9, presentation overlay (P07-09).** When the facilitator closes the overlay the highlight is cleared for everyone (plan 7, line 4840), so "follows the highlight" is asserted as: opens for both, a participant's Escape hides it for that participant only, a new highlight reopens it, and the facilitator's close removes it for both.
- **P09a-01a** — the walkthrough writes the chip as "Due 3 Oct". In English the product formats the date with `Intl.DateTimeFormat('en', { day: 'numeric', month: 'short' })`, which gives "Due Oct 3", and an overdue item's badge reads "Overdue · Oct 1". The test computes both labels from `ActionItem::today()` and asserts the red badge by its `bg-destructive` class.
- **P09a-01c** — "the guest ticks their own item" is read as the item assigned to the guest (spec §4: the assignee completes). The test also checks a plain member: Bob can tick the item assigned to him, cannot tick the guest's, and sees no edit or delete button.
- **P09a-03a / P09a-03b** — the walkthrough says "Lock the board: edits return the toast". Today's board disables every action item control as soon as it learns the board is closed, so no edit can be sent from a page that shows the lock. P09a-03a asserts the disabled controls and the "Board closed for editing" badge on both pages after the facilitator ticks "Close for editing"; P09a-03b locks the retro in the database after the page has loaded, so the click reaches the server and the page shows the toast "The board is closed for editing." and resyncs.
- **P09a-03c** — "complete the retro" is arranged in the database (the phase flow is covered by P04-07). The guest joins through the interface while the retro is in `Discussing`, then reloads the completed retro. The priority has no text in the Results view, so it is asserted by the icon's colour class.
- **P09a-05** — run with one and with two open items to cover the singular and plural sentences; a completed item is present and not counted.
- **P09b-01a** — "complete a retro that has open items, then start a new retro" is arranged with factories: an earlier `Completed` retro dated one week back with one open item, and a new retro in `Writing`. The second member cannot tick the carried item (not a manager, not the assignee, not the review facilitator); the test asserts that the toggle is disabled for him and that his sheet updates when the facilitator completes it.
- **P09b-01c** — not in the walkthrough's wording; added from spec §8 ("only when the board is first loaded while the phase is `Writing`"): on a board first opened in `Discussing` the sheet stays closed and the button opens it.
- **P09b-02a** — "(sidebar "Action items", below "Teams")" is asserted as the order of the sidebar entries, "Teams / Action items / Templates", for a member.
- **P09b-02c** — the guest and the retro are arranged with factories (a guest participant row, no browser session), because the step is about the member's page.
- **P09b-03** — "it appears within about a second" is asserted as "it appears without a reload" within the browser timeout; no duration is measured. The team's next retro is created by a factory, dated one minute ahead.
- **P09b-04** — the sub-tasks are reordered with the "Move up" button; the product has no drag handle for sub-tasks.
- **P09b-05** — the "repeat icon" is asserted through its label "Repeats weekly" (the icon is `aria-hidden`). "Follows up the item completed on …" is asserted without its date, which the browser formats in its own time zone.
- **P09b-06a** — substitution (spec §3.6, e-mail): `Notification::fake()` instead of `MAIL_MAILER=log`. The test asserts the recipient, the `mail` channel, the locale `fr`, and that the rendered digest lists the overdue item before the item due today. It has no browser page. It also travels two days to show the rule "one reminder per item, kind and due date".
- **P09b-06b** — the bell has no realtime update (spec §1, out of scope), so after the command the test reloads the page with `navigate()` to the same URL. "The sidebar badge shows 1" is the count of the viewer's overdue items and is already 1 before the command runs.
- **P09b-07** — substitution (spec §3.6, e-mail): the absence of the e-mail is asserted as "no `NotificationSent` event for the `mail` channel" while the `database` channel sent; the bell entry is then read in the browser. The reminder that step 6 had sent is arranged as an `action_item_reminders` row.
- P06-08a: found and fixed a product defect (the drag preview was always 256 px wide); see "Defects found".
- P07-01a: the cursor assertion is stricter than the plan's: it reads the position twice, 200 ms apart, and is true only when the cursor has stopped over the card, because a remote cursor is animated for about 150 ms and a retried assertion could pass while it only crosses the card. Two open defects found while measuring (cursor position across window widths, board scroll width after narrowing); see "Defects found".
- P07-04a: the author line of a comment is asserted with `p:has-text("Bob Stone")` inside the thread, because the same name also appears in the card footer.
- P07-08a: the comments toggle of a locked board is clicked from a script: the card's drag wrapper carries `aria-disabled="true"` while locked and Playwright waits on controls inside it. Open defect for the user; see "Defects found".
- P07-09: a card with a reaction chip needs two presses of Escape to close the overlay, because the dialog focuses the chip and its names tooltip takes the first one. The test asserts today's behaviour. Open defect for the user; see "Defects found".
- P09a-01a to P09a-05: the form of the action items panel is scoped with `[data-test="retro-action-items-panel"]`.
- P09b-05, P09b-07: the save-on-blur of the due date field is triggered by clicking neutral page text after `fill()`, not by Tab: in Chromium Tab moves between the segments of a date input and the field keeps its focus.
- P09b-03, P09b-04: Task 6 added `data-realtime` to the workspace "Action items" page (`resources/js/pages/action-items/index.tsx`) so that the tests can wait for the subscription; it is the only product change of plan 16b besides the drag preview fix.
- **P08a-02a** — the walkthrough expects "the Warm-up question (same question in both browsers) and the timer". Since the games spec was built, the Icebreaker phase shows the game panel instead (flow extras spec §2.5). The test asserts the icebreaker game stage, the same game name ("Draw & Guess") in both browsers, and the shared timer.
- **P08a-02b** — the walkthrough adds the column during Icebreaker and through one form. Today the columns are not rendered during Icebreaker and the add-column form has no description field. The test adds the column in Writing and sets its description through the column menu's "Edit description".
- **P08a-03** — "Previous → Icebreaker: the other browser's cards are hidden again". The board is not shown during Icebreaker, so the test asserts the cards are hidden again in Writing after a return from Grouping, absent from the whole document in Icebreaker, and still hidden when Writing is entered again.
- **P08a-04a / P08a-04b** — the settings dialog disables the Icebreaker checkbox while the retro is in Icebreaker, so the message "Move to another phase before turning this phase off." cannot be produced by a current dialog. P08a-04a asserts the disabled checkbox; P08a-04b produces the server's message with a dialog opened before the retro was moved to Icebreaker through the model (no broadcast), as P04-13 does for a refused vote.
- **P08a-05** — run with two data sets (2 and 9 top-level cards, each with one grouped card) to cover both "cards + 3" and "max 10".
- **P08a-07b** — "reorder/remove columns": the test starts from "Start, Stop, Continue", moves the first column down and removes the third; the category is changed from "Essentials" to "Team & mood" in the select.
- **P08a-07c / P08a-07d** — the template and, for P08a-07d, the retro created from it are arranged with factories so that each test stands alone.
- **P08b-01a** — the statements are reordered with the keyboard, but not through `dragWithKeyboard()`: on the team page the list sits low on a page that scrolls, the keyboard sensor scrolls the window, and the drop sent right after the arrow landed on the starting row. The test waits on the dnd-kit live region ("Moved Interaction to position 2.") between the arrow and the drop.
- **P08b-03a** — the `health.answered` frame is not inspected (browser test spec §3.6); the test asserts absence in the other participant's page and reads the snapshot endpoint from the page. "Enable guest access" is arranged with the factory state; the guest link dialog is covered by P04-10.
- **P08b-05b / P08b-06** — "server answers 423 if forced" and the 403 in Writing are produced by changing the retro through the model without a broadcast and clicking a still-enabled score button.
- **P08b-07** — the health check is toggled off and on in Writing, because the settings dialog disables that checkbox during the Health check phase; "change the team statements" is an Owner adding a custom statement on the team page.
- P08c (all rows): the walkthrough is one paragraph on line 5728; its checks are split into ten tests. It asks for "two browsers, one as a guest"; the tests open the facilitator or a member next to a guest, whichever the check needs.
- P08c-01: the walkthrough does not name the kinds in the interface; today's dialog calls them "Single choice", "Multiple choice" and "Free text" under "Answer type".
- P08c-02b: beyond the walkthrough, the test asserts that a multiple choice survey's percentages are computed per respondent (100% and 50% for two respondents), as the feature spec §5.4 requires.
- P08c-02c, P08c-05: "hidden" is asserted on the visible text and on the document's HTML (the Inertia page data), so the redaction is checked as server-side.
- P08c-03: the test also reopens the survey and asserts that the results hide again for someone who has not answered (feature spec §5.1); the walkthrough only closes.
- P08c-04a: "avatars" are asserted as `<img alt="{name}">` under the option; the names shown on hover (a tooltip) are not asserted. "Text authors" are asserted as the name inside the answer's row.
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
- P08e-10b: the second retro is arranged with a factory (`ai_summary_enabled = false`); creating it through the dialog with the switch off is `[P08e-10a]`.
- P08e-11a: not a numbered walkthrough item. It covers the provider failing (HTTP 500 three times, feature spec §6.3 and §14) and the Retry the walkthrough's item 8 ends with, using time travel between the job's attempts.
- P08e-11b: "Stop the queue worker, complete a retro, wait 10 minutes" is done by leaving the job in the `database` queue, travelling 11 minutes and reloading the page. Nothing in the product marks the row as failed: `Retro::effectiveSummaryStatus()` reads a pending request older than 10 minutes as failed when the snapshot is built, so the database still says `pending` and the page changes only on reload. The walkthrough's alternative ("set `summary_requested_at` back with tinker") is not used.
- P08e-07, P08e-09: the theme name also appears in the suggestion's "Theme: …" line, so the tests match the heading with `p:text-is("…")` instead of a text assertion.

## Defects found

Add one line per defect: identifier, what was wrong, the commit that fixed it.

- `[P06-08a]` (polish pass PB1): the drag preview of a retro card was always 256 px wide (the `w-64` fallback) instead of as wide as the card (262 px in the default layout). `board.tsx` read `event.active.rect.current.initial` in `onDragStart`, which dnd-kit 6.3.1 only fills in a later layout effect, so the width was always undefined. Fixed in the commit `fix(retro): give the drag preview the width of the dragged card` by measuring the card element when the drag starts.
- `[P07-09]` (plan 7, step 9), open, for the user: closing the presentation overlay with Escape takes two presses when the presented card has a reaction chip with names. The dialog puts the focus on its first control, the chip, whose names tooltip opens on focus; the first Escape closes only that tooltip. The test asserts today's behaviour (two presses). Not fixed: where the overlay puts its focus is a design decision.
- `[P07-08a]` (plan 7, step 8), open, for the user: the drag wrapper of a card (`SortableCard`, `GroupableCard` in `dnd.tsx`) carries dnd-kit's `aria-disabled="true"` whenever the card cannot be dragged (locked board, another participant's card), and wraps every control of the card. The controls still work with a pointer, but assistive technology, like Playwright's actionability check, treats them as disabled (the `Comments (n)` toggle of a locked board is the case the test meets; it is clicked from a script). Not fixed: changing the wrapper's ARIA is an accessibility design decision.
- `[P07-01a]` (plan 7, step 1), open, for the user: a remote cursor points at a different place when the two boards do not have the same scroll width. `live-cursors` normalises a position to the board's `scrollWidth`, the columns are 288 px wide whatever the window, and the board's `main` is `flex-1`, so on a window wider than the columns the scroll width is the window's width. Measured with an 800 px page hovering the card of the third column and a 2400 px page watching: the cursor came to rest at x = 1067 while that card spans 637 to 899. The feature spec (§3) says positions match across screen sizes. The test keeps equal viewports and asserts today's behaviour. Not fixed: it needs another coordinate model (a design decision).
- `[P07-01a]` (plan 7, step 1), open, for the user: after a window is narrowed, the board keeps scrolling sideways over empty space up to its former width while live cursors are on. The cursor overlay (`.lc-overlay`) is an absolutely positioned child of the board sized to the board's `scrollWidth`, so it holds that width itself: a page resized from 1728 px to 800 px still reports `scrollWidth` 1728, although the three columns end at 928 px. Not fixed: the sizing is done by the `live-cursors` library; containing the overlay is a design decision.
- `[P08d-01c]` (plan 8d, step 1), open, for the user: with the keyboard, a group cannot be dropped onto a group that sits below it in the same column. Measured with two groups of two cards each in one column (each 328 px high): after Space and ArrowDown the announcement is "“Slow CI” is over column Start.", further ArrowDown presses change nothing, and Space drops the group on the column, which only moves it to the end ("Dropped “Slow CI” on column Start.", no grouping). Upwards it works: ArrowUp puts the lower group over the upper one and Space groups them, which is what the test does. Probable cause, read from the code and not isolated: the board uses `closestCenter` with the column itself as a drop target, and the drag preview is shorter than a group, so the preview's centre is nearer the column's centre than the lower group's. A pointer drag is not affected in the same way, since the pointer can be placed anywhere. Not fixed: choosing another collision strategy for the board is a design decision.

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
