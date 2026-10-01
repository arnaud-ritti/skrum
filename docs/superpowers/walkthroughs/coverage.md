# Walkthrough coverage

Spec: `docs/superpowers/specs/2026-10-01-browser-e2e-and-arch-tests-design.md` (§4). One row per walkthrough step. A step that became several tests has one row per test, or one row naming its tests.

| Status | Meaning |
|---|---|
| `auto` | Covered by a browser test as written. |
| `auto-substituted` | Covered by a browser test using a substitution from spec §3.6. |
| `residual` | Not automated; listed in `residual-manual-checklist.md` with the reason. |

A test is found by its identifier: `vendor/bin/pest tests/Browser/Walkthroughs --filter='P10a-07'`.

## Summary

| Walkthrough | Rows | `auto` | `auto-substituted` | `residual` |
|---|---|---|---|---|
| Plan 4, retro core | 26 | 19 | 5 | 2 |
| Plan 10a, poker core | 16 | 13 | 3 | 0 |
| Plan 10b, poker additions | 28 | 18 | 6 | 4 |
| **Total** | **70** | **50** | **14** | **6** |

## Plan 4: retro board core

Walkthrough: `docs/superpowers/plans/2026-09-29-plan-4-board-ui.md`, Task 9, Steps 1 to 4.

| Id | Walkthrough step | Test file | Status |
|---|---|---|---|
| P04-01 | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-02 | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-03 | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-04 | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-05a | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-05b | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-05c | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-06 | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-07 | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-08a | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-08b | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto-substituted |
| P04-09 | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-10 | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto-substituted |
| P04-11 | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1793 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-12 | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1794 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto-substituted |
| P04-13 | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1794 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-14a | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1795 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-14b | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1795 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-14c | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1795 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-14d | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1795 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-15a | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1795 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto-substituted |
| P04-15b | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1795 | (none) | residual |
| P04-16a | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1795 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto-substituted |
| P04-16b | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1795 | (none) | residual |
| P04-17a | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1796 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P04-17b | docs/superpowers/plans/2026-09-29-plan-4-board-ui.md:1796 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |

## Plan 10a: planning poker core

Walkthrough: `docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md`, "Two-browser walkthrough (10a scope)".

| Id | Walkthrough step | Test file | Status |
|---|---|---|---|
| P10a-01 | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12535 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto |
| P10a-02 | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12536 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto |
| P10a-03 | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12537 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto |
| P10a-04 (tests P10a-04a, P10a-04b) | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12538 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto |
| P10a-05 | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12539 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto-substituted |
| P10a-06 | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12540 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto |
| P10a-07 (tests P10a-07a, P10a-07b, P10a-07c) | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12541 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto-substituted |
| P10a-08 | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12542 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto |
| P10a-09 | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12543 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto |
| P10a-10 | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12544 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto |
| P10a-11 | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12545 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto-substituted |
| P10a-12 | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12546 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto |
| P10a-13 (tests P10a-13a, P10a-13b) | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12547 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto |
| P10a-14 | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12548 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto |
| P10a-15 | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12549 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto |
| P10a-16 | docs/superpowers/plans/2026-10-02-plan-10a-planning-poker-core.md:12550 | tests/Browser/Walkthroughs/Plan10aPokerCoreTest.php | auto |

## Plan 10b: planning poker scope additions

Walkthrough: `docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md`, final walkthrough step and the inline check near line 3886.

| Id | Walkthrough step | Test file | Status |
|---|---|---|---|
| P10b-01 | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5901 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto |
| P10b-02a | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5902 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto |
| P10b-02b | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5902 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto |
| P10b-02c | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5902 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto |
| P10b-03 | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5903 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto-substituted |
| P10b-04 | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5904 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto |
| P10b-04t | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5904 | (none) | residual |
| P10b-05 | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5905 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto |
| P10b-05o | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5905 | (none) | residual |
| P10b-06 | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5906 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto |
| P10b-07 | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5907 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto-substituted |
| P10b-08a | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5908 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto-substituted |
| P10b-08b | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5908 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto-substituted |
| P10b-08s | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5908 | (none) | residual |
| P10b-09 | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5909 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto-substituted |
| P10b-10a | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5910 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto |
| P10b-10b | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5910 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto |
| P10b-11a | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5911 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto |
| P10b-11b | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5911 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto |
| P10b-12 | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5912 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto |
| P10b-13 | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5913 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto |
| P10b-14 | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5914 | (none) | residual |
| P10b-15a | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5915 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto |
| P10b-15b | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5915 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto |
| P10b-15c | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5915 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto |
| P10b-15d (test P04-14c) | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5915 | tests/Browser/Walkthroughs/Plan04RetroCoreTest.php | auto |
| P10b-15a, P10b-15b, P10b-15c (Task 6 Step 7 retro smoke check) | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:3886 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto |
| P10b-16 | docs/superpowers/plans/2026-10-02-plan-10b-planning-poker-scope-additions.md:5916 | tests/Browser/Walkthroughs/Plan10bPokerAdditionsTest.php | auto-substituted |

## Notes

Where a walkthrough's wording and today's interface differ, the test follows the feature's spec.

- P04-04: vote totals are shown during Voting unless the board setting "hide vote counts" is on; the test turns it on to check plan 4's "no per-card numbers".
- P04-06, P04-09: a completed retro opens on a Results tab; the cards are behind the Board tab.
- P04-09: action items, the presence strip and the results' participant list are not anonymous by design; the test asserts "no author name" on the cards.
- P04-08b: the timer reaching zero is a client-side notice only.
- P04-17a: members change language under Settings, Appearance.
- P10a-06: the valid join page shows the game's title and "Choose the name other players will see.", not "Join a planning poker game".
- P10a-14: after the guest link is regenerated the guest sees "Your access to this game has ended.", not the session-expired banner.
- P10b-10b: the history of an anonymous round shows each value with its count and no names; the walkthrough says "lists who voted without values". The feature's spec only requires that no value is linked to a player. To confirm with the product owner.
- P10b-13: an ended game keeps the hand, disabled; the walkthrough says "no hand".
- P10b-08a, P10b-08b: the shortest timer the interface offers is 30 seconds, so the tests travel in time and run one queued job.
- P10b-15d: "card dragging still works" on the retro board is covered by the plan 4 keyboard-drag test `[P04-14c]`.

## Defects found

None recorded yet. Add one line per defect: identifier, what was wrong, the commit that fixed it.
