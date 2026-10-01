# Front-end Rewrite — Themed shadcn and Business Components (Plan 18b+18c) Implementation Plan

> **For agentic workers:** this plan is executed by the Workflow tool: parallel waves of one agent per component in the same checkout, an integrator after each wave, a batch review per phase. Each agent reads the **Component contract** below and the README of its component. There is no code in this plan on purpose: the READMEs are the specification.

**Goal:** Every shadcn primitive of the design system is themed in `resources/js/components/ui/`, every business component exists in `resources/js/components/skrum/`, and each is shown with all its states on `/dev/design-system`, captured and checked for overflow.

**Architecture:** Components are built in dependency waves. Agents of a wave run in parallel and own disjoint files; they never touch shared files (lang JSON, `package.json`, the bench registry) and never commit. After each wave one integrator merges translation keys, runs the checks and commits. Old pages keep running on the re-themed primitives; the browser suite is the guard.

**Tech Stack:** Laravel 13, PHP 8.4, Pest 5 + browser plugin, Inertia 3, React 19, Tailwind CSS 4, shadcn/ui new-york, Radix, vite-plus, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` — rows 18b and 18c of §12; rules of §5; rulings of §6.5; dependencies of §4.1. Design source: `docs/design-system/components/<Name>/README.md` (binding) and `preview.html` (visual reference only).

**Not in this plan:** branding and admin (18d), any page rewrite or container (18e), ⌘K search route, notification wiring, e-mails, global shortcuts wiring (18f), removal of old components (18e per screen, 18g).

## Global Constraints

- Dependencies added in this plan, and no others: `recharts`, `cmdk`, `vaul`, `react-day-picker`, `qrcode.react`, `@radix-ui/react-popover`, `@radix-ui/react-tabs`, `@radix-ui/react-switch`, `@radix-ui/react-slider`, `@radix-ui/react-radio-group`, `@radix-ui/react-accordion`, `@radix-ui/react-progress`. A peer dependency outside this list is handled as the Autonomous run section says. Not added: `@tanstack/react-table`, `react-hook-form`, `react-hotkeys-hook`, `date-fns`, `@radix-ui/react-scroll-area`, `@radix-ui/react-alert-dialog`, `@dicebear/*`.
- Consequences of the list above, decided here: AlertDialog/ConfirmDialog is built on the existing Radix Dialog with `role="alertdialog"`; Table is the plain shadcn table with sorting, selection and bulk state passed as props; KeyboardShortcuts uses a small in-house hook; dates are formatted with `Intl.DateTimeFormat`; scroll areas use native overflow; avatars use the server URL (`avatarUrl`), initials as fallback.
- Tokens only (no hex, rgb, `white`, `black`, default Tailwind palette class). rem everywhere (px only for strokes ≤ 2px and the pill radius). No arbitrary `[…]` size; a size missing from the scale is added to `@theme` in `resources/css/app.css` **by the integrator only**, after the design-system block, never inside it. Arbitrary values are allowed for grid templates, `color-mix`, `env()`, data/aria variants.
- Every component fits a container from 20rem to 60rem. Cards and rows adapt to their container (`@container/card`, `@container/action`). Labels of selects, menu items, buttons and tabs never wrap (`truncate`). Focus ring never removed. Destructive always has an icon and a label. A leading element aligns on the first line of the title.
- Motion per `docs/design-system/sections/02-motion.md`; `prefers-reduced-motion` respected (no flying reactions, no confetti, fade instead of flip).
- lucide-react icons only, per `sections/03-iconographie.md`. Emoji only as a feature.
- `sk-*` classes and `_preview-bundle.css` never enter the application.
- `docs/design-system/**` is never modified. `resources/css/app.css` keeps starting with the exact content of `docs/design-system/app.css`.
- Identifiers follow the back end, not the READMEs: phase `discussing`, session type `survey`, existing `GameKind` values, existing channel names (spec §6.5).
- The Pest browser suite is a contract: re-theming a primitive must not change `data-slot`, `data-test`, roles, ids or English accessible names that existing pages expose. Existing exports and props of every `ui/*` file stay backward compatible; new variants are additions.
- User-facing strings go through `t('…')` with literal English keys. Agents do not edit lang files; they return the keys with `fr`, `de`, `es` translations and the integrator merges them.

## Autonomous run

The product owner asked for this plan to run unattended (2026-10-01, "it must be autonomous because I will sleep"). Nothing waits for a human:

- The branch starts from the head of `plan-18a-foundations`. Nothing is merged into `main` and nothing is pushed; both stay the owner's decision.
- A package outside the dependency list is never added. If an approved package needs a peer that is not listed, the component that needs it is built without that package where a small in-house implementation is reasonable; otherwise the component is skipped and reported. A plain transitive dependency installed by npm for an approved package is fine.
- A component agent that fails or returns nothing is retried once, then skipped and reported; the run continues.
- Browser tests of this run use ports from 8098 upwards (`BROWSER_REVERB_PORT`, one per shard), so they never wait for another session on 8097.
- If the full browser suite fails after a wave, one fix agent gets the failures (fix the product, not the test, unless the design system imposes the new value); what still fails after that is reported, and the run continues.
- Every decision taken on the owner's behalf is written to the run's ledger and listed in the phase report.

## Component contract (every component agent)

1. Read your component's `README.md` in full, then `preview.html` for the visual states (light and dark). Read `sections/04-tailwind.md` for class mapping.
2. Files you own, and only these:
   - 18b: `resources/js/components/ui/<name>.tsx` (and the wrapper files your README names under `components/skrum/`), `<name>.test.tsx` next to it.
   - 18c: `resources/js/components/skrum/<name>.tsx`, `<name>.test.tsx`.
   - Your bench section: `resources/js/pages/dev/sections/<name>.tsx` (default export, no props), showing **every state the README lists**, each state labelled.
3. Props and states exactly as the README, subject to the Global Constraints. A prop whose data the back end does not provide (spec §10 backlog) is optional; its control is not rendered when the prop is absent. List every such prop in your report.
4. `components/skrum/*` are presentational: `useTrans()` and Inertia `<Link>` allowed; no `usePage()`, router, Echo, network, timers tied to server state (take values and callbacks as props).
5. Keyboard and accessibility as the README says. Every icon-only button has an accessible name and a tooltip with its shortcut. Names that assistive tech must read are real text or valid ARIA on an element with a role.
6. Vitest tests for behaviour: states, keyboard, callbacks, logic named in the spec (§11): card masking, remaining votes, timer states, poker average/median/consensus display, TemplateEditor and DeckPicker validation. No test that only asserts a class name.
7. Do not commit, do not edit shared files (lang JSON, `package.json`, `app.css`, other components, the bench shell). Run only your own tests: `npm run test -- <name>`.
8. Return: files written, translation keys with four languages, sizes or animations you need added to `@theme`, optional props left out for backlog reasons, deviations from the README and why, concerns.

## Review Focus

1. **An old page using a re-themed primitive with a prop combination the new file dropped** (for example `Button variant="destructive" size="sm" asChild`): must render and behave as before. Pinned by the full browser suite after each 18b wave and by a type check of the whole app.
2. **A French label 30 % longer** in a Select, tab, menu item, badge, toggle group: truncates, never wraps or overflows. Pinned by the visual test of each bench section at 390px in FR.
3. **Remote change during local interaction** (a card locked by someone else while editing, votes revealed while the drawer is open, timer reaching zero while paused): the component reflects the new props without losing local input or throwing. Pinned by Vitest rerender tests in RetroCard, Drawer wrappers, Timer.
4. **Empty and extreme data**: zero items, one item, 200 items, a 280-character card, a name of 60 characters, more than 12 participants, a deck of 20 values. Pinned by a bench state and a Vitest case in each list-like component.
5. **Keyboard-only use** of every interactive component, including roving focus groups and escape routes from popovers and drawers. Pinned by Vitest keyboard tests.

---

## Task 0: Preparation (one agent, sequential, committed)

- [ ] Branch `plan-18bc-components` from the merged result of plan 18a.
- [ ] Install the dependencies listed in Global Constraints; peers outside the list are handled as the Autonomous run section says.
- [ ] Make the browser-suite Reverb port configurable: `tests/Browser/Support/ReverbServer.php` reads `BROWSER_REVERB_PORT` (default 8097) instead of the constant alone; `tests/BrowserTestCase.php` uses the same value. Feature test for the default and the override.
- [ ] Shard the browser suite. A script `bin/test-browser` takes a shard count (default 4) and a base port (default 8098): for shard `i` of `N` it ensures a database `testing_browser_i` exists, then runs `BROWSER_REVERB_PORT=<base+i> DB_HOST=127.0.0.1 DB_DATABASE=testing_browser_i php -d memory_limit=2G vendor/bin/pest tests/Browser --shard=i/N` in the background with its own log file, waits for all, prints one summary line per shard and a total, and exits non-zero if any shard failed. Confirm Pest's shard flag syntax with `vendor/bin/pest --help` first (`--update-shards` exists; commit `tests/.pest/shards.json` or wherever Pest writes timing data if it produces one, so shards are time-balanced). Each shard starts its own Reverb server and its own plugin HTTP server; check that two shards do not share any other fixed resource (queue connection, cache store, storage paths such as GIF cache or whiteboard files, the screenshots folder) and isolate what is shared, by shard-specific config in `BrowserTestCase` keyed on an env var the script sets (`BROWSER_SHARD`). Prove it: run the whole suite sharded twice; both runs must match the unsharded result (same pass count, zero failures). If sharded runs are flaky where the unsharded run is not, keep the script, document the flaky tests in the report, and let the rest of this plan use the unsharded suite on port 8098. Add `composer test:browser:shards`. Every later "full browser suite" step in this plan uses the sharded script when it was proven, the unsharded suite otherwise.
- [ ] Test impact analysis (`pest --tia`, Pest 5.2.1; drivers present: pcov and Xdebug on the host, Xdebug in Sail). Evaluate it on the feature suite only: record the dependency graph once (`--tia --fresh`), note the time; then make three probes and note for each which tests re-run and whether that is correct — (a) no change: everything replays from cache; (b) edit one PHP action class: its tests re-run; (c) edit a file PHP coverage cannot see — a `lang/*.json` file, a Blade view, a `resources/js` file read by `TranslationKeysTest` or by a test that reads files from disk: the tests that depend on it MUST re-run. If (c) replays a stale pass, TIA is unsafe for those tests: say so and do not use it in this plan's gates. Whatever the outcome, the gates of this plan (end of wave, end of phase, final verification) always run the complete suites without `--tia`; TIA is only allowed for an agent's inner loop while iterating. Never use `--tia` on `tests/Browser` in this plan: browser tests depend on built JS and CSS, which PHP coverage does not track. Write the findings (times, probe results, whether it combines with `--parallel`, where the graph is stored and whether it should be git-ignored) to the phase report.
- [ ] Feature suite in parallel: check that `vendor/bin/sail artisan test --parallel` passes (databases `testing_test_N` already exist). If it does, later steps of this plan use it; if not, report the failing tests and keep the sequential run.
- [ ] Add `"build:front": "vp build && php artisan wayfinder:generate --with-form"`-equivalent that works in this environment (host build, Sail generate), and document it in the plan's environment notes.
- [ ] Bench registry: `/dev/design-system/{section}` accepts any section for which `resources/js/pages/dev/sections/{section}.tsx` exists (controller checks the file; the fixed list goes away); the page loads sections with `import.meta.glob`; the index lists them grouped (Foundations, Layouts, UI, Skrüm). Move the six existing sections into that folder. Update `DesignSystemPageTest` (unknown section and path traversal such as `..%2F` are 404).
- [ ] Visual test: `tests/Browser/Visual/DesignSystemVisualTest.php` builds its dataset from the files of that folder.
- [ ] Shared test helper `resources/js/test/render.tsx`: `renderWithProviders` (TooltipProvider).
- [ ] Verify: Vitest, types, lint, feature tests, `tests/Browser/Visual`. Commit.

## Carried from the final review of plan 18a (done in Task 0 unless a wave is named)

- [ ] Captures are not byte-stable (a clean rerun rewrites a few PNG). In `CapturesVisuals`, write each capture to a temporary file and replace the tracked PNG only when the decoded pixels differ (GD), so a browser run leaves the tree clean. Self-test for both cases.
- [ ] The overflow detector exempts every descendant of an `overflow-x: clip|hidden` ancestor. Exempt only real scrollers (`auto`, `scroll`) and `data-overflow-ok`; for `clip`/`hidden` ancestors compare the element with that ancestor's own box. Self-tests; the existing 48 captures must still pass, or the component is fixed.
- [ ] `DesignTokensTest`: read the `--background` values of `:root` and `.dark` from `resources/css/app.css` and assert `app.blade.php` contains them, instead of two literals.
- [ ] `SharedPropsTest` query-count test: count queries whose SQL contains `from "teams"` rather than a literal prefix.
- [ ] `tests/Feature/Whiteboards/TeamWhiteboardsSectionTest.php:49` is flaky on ordering (pre-existing): make the assertion order-independent. Test-only change.
- [ ] Bench sample copy goes through `t()` wherever a component shows text, so EN and FR captures differ.
- [ ] Wave B, Sidebar: collapsed state shows a `bg-destructive` dot for overdue actions and the tooltip carries the `:count overdue` phrase; the brand link has one accessible name (`aria-label` on the link, logos decorative) and the symbol is centred in the collapsed rail; optional `newTeamHref` adds a "New team" entry; the tab bar has its own landmark name and its "More" button exposes `aria-expanded`.
- Not in this plan: the shared `teams` prop collides with page props of the same name on `settings/api-tokens` and `action-items/index` (18e renames the page props when it rewrites those screens); `CurrentTeamResolver` query count and where the session write happens (18e); `.ico` and 180px PNG favicons (18d).

## Phase 18b — themed shadcn

Wave A (parallel, no dependency between them):

| Component | README | Files | Notes |
|---|---|---|---|
| Button | `Button` | `ui/button.tsx`, `skrum/loading-button.tsx` | `loading`, `loader: spinner \| trema` in the wrapper |
| Badge | `Badge` | `ui/badge.tsx` | extra variants, pill, dot |
| Input, Textarea | `Input` | `ui/input.tsx`, `ui/textarea.tsx`, `ui/label.tsx`, `skrum/text-field.tsx` | field wrappers with label, help, error, counter |
| Checkbox, RadioGroup, Switch | `Checkbox` | `ui/checkbox.tsx`, `ui/radio-group.tsx`, `ui/switch.tsx` | card radio, locked switch |
| Slider, Progress | `Slider` | `ui/slider.tsx`, `ui/progress.tsx` | |
| Tabs | `Tabs` | `ui/tabs.tsx` | pill and line |
| ToggleGroup, Toggle | `ToggleGroup` | `ui/toggle.tsx`, `ui/toggle-group.tsx` | toolbar, segmented |
| Skeleton | `Skeleton` | `ui/skeleton.tsx`, `skrum/skeletons.tsx` | BoardSkeleton, ListSkeleton |
| Sonner, Alert | `Sonner` | `ui/sonner.tsx`, `ui/alert.tsx` | |
| Accordion, Collapsible | `Accordion` | `ui/accordion.tsx`, `ui/collapsible.tsx` | |
| Avatar | `Avatar` | `ui/avatar.tsx`, `skrum/avatar-stack.tsx` | presence colours, status, typing |
| Card | `Card` | `ui/card.tsx`, `skrum/session-card.tsx`, `skrum/stat-card.tsx` | container queries |
| Popover, Tooltip, Kbd | `Popover` | `ui/popover.tsx`, `ui/tooltip.tsx`, `ui/kbd.tsx` | inverted tooltip with shortcut |
| DropdownMenu | `DropdownMenu` | `ui/dropdown-menu.tsx` | danger tone, disabled reason |
| Dialog, ConfirmDialog | `Dialog` | `ui/dialog.tsx`, `skrum/confirm-dialog.tsx` | alertdialog role on Dialog |
| Sheet | `Sheet` | `ui/sheet.tsx` | |
| Drawer | `Drawer` | `ui/drawer.tsx` | |
| InputOTP | `InputOTP` | `ui/input-otp.tsx`, `skrum/resend-code.tsx` | |
| Table | `Table` | `ui/table.tsx` | plain table |
| Command | `Command` | `ui/command.tsx` | uses the existing Dialog API |

Integrator A: merge keys, `@theme` additions, format, types, Vitest, build, visual tests of the new sections, **full browser suite**; commit one commit per component (files are disjoint), then the shared files.

Wave B (parallel, after A is committed; wave C of 18c runs alongside it, since it only needs wave A):

| Component | README | Files | Depends on |
|---|---|---|---|
| Select, Combobox | `Select` | `ui/select.tsx`, `skrum/combobox.tsx` | Popover, Command |
| Breadcrumb | `Breadcrumb` | `ui/breadcrumb.tsx`, adapts `components/breadcrumbs.tsx` | DropdownMenu |
| Pagination | `Pagination` | `ui/pagination.tsx` | Select |
| DatePicker | `DatePicker` | `ui/calendar.tsx`, `skrum/date-picker.tsx` | Popover, Button |
| Chart | `Chart` | `ui/chart.tsx` | — |
| Sidebar | `Sidebar` | `ui/sidebar.tsx`, `skrum/app-sidebar.tsx`, `skrum/user-card.tsx`, `skrum/mobile-tab-bar.tsx` | Drawer, Avatar, DropdownMenu; adds the presentational user card and the "More" Drawer |

Integrator B+C: as A, full browser suite again.

Batch review 1 (waves A, B, C), run while wave D is being built: three reviewers in parallel, one lens each — rule compliance (Global Constraints, greps), accessibility and keyboard, README fidelity and backward compatibility of `ui/*` exports. Reviewers never run the browser or feature suites.

## Phase 18c — business components

Wave C (parallel, leaf components):

| Component | File | Tests must cover |
|---|---|---|
| VoteDots | `skrum/vote-dots.tsx` | remaining votes, max per card, hidden total |
| Timer | `skrum/timer.tsx` | normal, low, done, paused, prop change while paused |
| PokerCard | `skrum/poker-card.tsx` | face down has no value in the DOM, selection, reduced motion |
| EmptyState | `skrum/empty-state.tsx` | three modes |
| ConnectionState | `skrum/connection-state.tsx` | statuses, attempts |
| LiveCursor | `skrum/live-cursor.tsx` | label, idle |
| PresenceStack | `skrum/presence-stack.tsx` | +N, more than 12, typing |
| IcebreakerGameCard | `skrum/icebreaker-game-card.tsx` | unavailable with reason |
| ROTIWidget | `skrum/roti-widget.tsx` | 1–5 keys, result hidden below three |
| SurveyQuestion | `skrum/survey-question.tsx` | five types, answer and results |
| MoodTrendChart | `skrum/mood-trend-chart.tsx` | fewer than three points, table view |
| SessionTypePicker | `skrum/session-type-picker.tsx` | disabled with reason |
| PhaseStepper | `skrum/phase-stepper.tsx` | optional phases, read-only, compact |
| AvatarStylePicker | `skrum/avatar-style-picker.tsx` | locked grid, selection |
| ReactionBar | `skrum/reaction-bar.tsx` | burst cap, disabled, reduced motion |
| GuestJoin | `skrum/guest-join.tsx` | empty name, error |
| KeyboardShortcuts | `skrum/keyboard-shortcuts.tsx`, `hooks/use-shortcut.ts` | platform display, filter, ignores inputs |
| NotificationsPanel | `skrum/notifications-panel.tsx` | unread, empty, existing notification kinds only |
| GifPicker | `skrum/gif-picker.tsx` | statuses, caption limit, attribution of the active provider |
| ExcalidrawTheme, WhiteboardToolbar | `resources/css/excalidraw-theme.css` (integrator imports it), `lib/whiteboard/palette.ts`, `skrum/whiteboard-toolbar.tsx` | palette of eight colours from tokens; existing Excalidraw overrides untouched |

Wave D1 (parallel, composites): RetroCard, FacilitatorBar, PokerTable, DeckPicker (+ DeckEditor), ActionItem, HealthCheck, GamesLeaderboard, RetroTemplatePicker, TemplateEditor (+ ColumnColorPicker), SessionSettingsPopover, ShareDialog.

Wave D2 (parallel, after D1): CardGroup, RetroColumn (both compose RetroCard).

Integrator D: Visual tests, Vitest, types, lint; commit.

Batch review 2 (wave D, and back-end fit of all of 18c): the three lenses plus a fourth, "back-end fit" — every prop maps to data the app has today or is listed as backlog. Findings of both batch reviews are deduplicated and go to one fix agent, then one scoped re-review.

## Final verification (one agent)

`npm run build`, Wayfinder generate, `npx tsc --noEmit`, `npm run check`, `npm run test`, feature suite, Arch, Rector, full browser suite, the three rule greps over `resources/js/components/ui`, `components/skrum`, `pages/dev`. Then a whole-branch review, one fix wave, one scoped re-review.

## Phase report

What is done; gaps with the READMEs and previews and why; optional props left for the backlog; old pages verified by the browser suite; tokens or sizes added to `@theme`; missing components; next step (18d).

## Scale

About 60 component agents in six waves of at most 10 at a time, 5 integrators, 7 reviewers, 2 fix agents, 1 verifier. The browser suite runs three times in full, sharded in four when Task 0 proves sharding stable.
