# Plan 16 — notes for later

State on 2026-10-01: plans 16a to 16f are merged into local `main` (`84d4c2d`, then `7a87eae`). Nothing is pushed.

Verified on PHP 8.4.21: browser suite 456 tests, full suite 4032 tests, Arch 33, Rector, PHPStan, Pint, `tsc` and the build all pass.

## To do

1. Push `main` and watch the first CI run. The `browser` job has never run.
2. Set up the primary checkout or Sail: `composer install`, `npm install`, `npx playwright install chromium`, `npm run build`. The suite has never run inside Sail.
3. Decide the open product items below.
4. Go through the residual manual checklist: 72 steps in `docs/superpowers/walkthroughs/residual-manual-checklist.md`.

## Open product items

Details are in `docs/superpowers/walkthroughs/coverage.md`, section "Defects found". Each fix needs a spec first.

- Cursor positions differ across window widths.
- Stale board scroll width.
- `aria-disabled` on the drag wrapper.
- The presentation overlay needs two Escape presses.
- Keyboard group drop downward does not work.
- No resync after a refused stale settings save.
- Share controls shown with no channel (one decision, three surfaces).
- No "Next round" control in Sprint voting.
- "Completed in :source" is not live.
- No interface to clear a poker estimate.
- "Import 1 tasks" copy.
- Whiteboard: a participant locked out while a text editor is open sees the toast "This board is locked." only when something was unsent. The walkthrough (B5.5) expected it every time.

## Optional clean-up

- `coverage.md`, 16f verification record: it says PHPStan fails at `app/Actions/Whiteboards/GenerateFractionalIndexes.php:45`. Two subagents saw that; the final run found 0 errors. Correct the line.
- `doubleClickOnWhiteboard()` in `tests/Browser/Support/InteractsWithWhiteboards.php` assumes zoom 1 and scroll 0.
- Delete the SDD workspaces `.superpowers/sdd/2026-10-01-plan-16*` (git-ignored).
- Remove the worktree `.claude/worktrees/plan-16-browser-e2e-arch` and the branch `feat/plan-16-browser-e2e-arch` (fully merged).
- Plan 18 work has no walkthrough tests yet.

## Traps

- Port 8097 (Reverb for browser tests) is shared by every checkout on the machine: run one browser suite at a time. Check with `pgrep -fl "pest tests/Browser"`.
- `npm run types:check` fails on `resources/js/components/manage-passkeys.tsx` when the Wayfinder routes were generated without a reachable database. Regenerate with the database env set: `php artisan wayfinder:generate --with-form`.
- Browser tests need built assets (`npm run build`) and take about 14 minutes.
- Read `docs/superpowers/walkthroughs/harness-findings.md` before writing a browser test.
- New code must stay Rector-clean: `composer rector:check`.

## Commands

```bash
composer test:arch
composer test:browser
composer rector:check
DB_HOST=127.0.0.1 DB_DATABASE=testing_plan16 php -d memory_limit=2G vendor/bin/pest
```
