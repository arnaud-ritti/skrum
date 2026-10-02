# Spec amendment for plan 18e — applied

Target: `docs/superpowers/specs/2026-10-01-front-rewrite-design.md`.
Status: APPLIED on 2026-10-02. The owner approved the amendment in `owner-answers-2026-10-02.md` (BLOCK-1, BLOCK-2, BLOCK-4 / X1) and changed three of its sections. The text now lives in the spec; this file only says where each section went. The spec is the source of truth.

| Section | Subject | Where it is in the spec | Applied as drafted? |
|---|---|---|---|
| A1 | What is allowed in phases `actions` and `roti` | §9 B1 and the matrix of §9.1 | Yes (BLOCK-1: proposal accepted; surveys unchanged) |
| A2 | Marker of the retros that keep ROTI voting once completed | §9 B2 (`retros.roti_votable_when_completed`, `roti.canVote`) | Yes (BLOCK-2) |
| A3 | Session-end statistics | §9 B3, with B19 | Changed: the owner asked for the duration (2-D6), so `results.stats` also carries `durationSeconds`, from the new `retros.started_at` |
| A4 | Consumers of the column colour | §9 B10 | Changed in its last sentence: the built-in whiteboard templates are regenerated (7-D1, B29) |
| A5 | Folders and layout assignment | §4 (Containers), §6.1 | Yes (BLOCK-4 / X1), without the `landing` domain: there is no landing page (BLOCK-3, B32) |
| A6 | Timer durations | §6.5 ruling 19 | Reversed: one list 1/3/5/10 on every screen (X5), and "+2 min" is built for the retro (2-D8, B20) |
| A7 | Backlog list | §10 | Changed: the two removals are applied; of the additions, the ones the owner asked to build left the backlog (session duration, saved-deck default / duplicate / usage, team mood and ROTI trend, action-item counters and grouping, room status and players, SSO on the invitation page, regenerated whiteboard templates) |
| A8 | Corrections of fact | §7 rows 1, 10 and the note under the table; §11; §9 B16 | Yes |
| A9 | Limits of the error pages | §9 B15 | Changed by the second round: 419 and 429 are design-system error pages, 503 is a static Blade page, and the 500 page shows a request id (11-D3, 11-D7, 11-D10, B36) |

The same revision of the spec added the back-end items B17 to B36 (from the owner's two rounds of answers) and B37 to B45 (from the owner's rule that the mockup is the reference, §5 rule 13), the acceptance criteria 14 to 44 and the open points of §15. A third round of answers then settled the open points: four session types, "+2 min" on every timer, workspace-level decks, a live rooms list, the security wording of B31 and B33, and the feature roadmap (`feature-roadmap.md`).
