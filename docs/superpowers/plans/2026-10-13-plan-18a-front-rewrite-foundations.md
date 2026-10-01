# Front-end Rewrite — Foundations (Plan 18a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The application runs on the design-system tokens, fonts and logo, and the five new layouts exist and are shown on a local-only `/dev/design-system` page that a visual test captures and checks for overflow.

**Architecture:** `resources/css/app.css` becomes the design-system file plus the existing Excalidraw overrides. New presentational shells live in `resources/js/components/skrum/`; the five layouts in `resources/js/layouts/skrum/` are thin containers that feed them from shared props. Old layouts and pages are untouched and keep running on the new tokens; they migrate in plan 18e.

**Tech Stack:** Laravel 13, PHP 8.4, Pest 5 with the browser plugin, Inertia 3 + React 19, Tailwind CSS 4, shadcn/ui new-york, vite-plus (`vp`), Vitest (bundled), Wayfinder.

**Spec:** `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` — this plan covers the row 18a of §12, B8, B9 and B16 of §9, and sets up the harnesses of §11. Read §4, §5 and §6 before starting. Design references: `docs/design-system/README.md`, `sections/04-tailwind.md`, `components/Sidebar/README.md`.

**Not in this plan:** themed shadcn primitives (18b), business components (18c), branding and admin (18d), any page rewrite (18e), ⌘K and the notifications panel (18f), removal of the old layouts (18g). The old pages keep their old layouts.

## Global Constraints

- New dependencies in this plan, and no others: `@fontsource-variable/figtree`, `@fontsource-variable/bricolage-grotesque`, `@fontsource-variable/jetbrains-mono`, and dev `@testing-library/react`, `jsdom`. Removed: `@radix-ui/react-navigation-menu`.
- The values in `docs/design-system/app.css` are copied, never edited. Additions to `@theme` are allowed only for sizes missing from the scale.
- In every file this plan creates: tokens only (no hex, rgb, `white`, `black`, default Tailwind palette class); rem everywhere (px only for strokes ≤ 2px and the pill radius); no arbitrary `[…]` size; labels of buttons, menu items and tabs carry `truncate`; focus ring never removed; lucide-react icons only.
- The `sk-*` classes and `_preview-bundle.css` are mockup-only and never enter the application.
- Presentational components (`components/skrum/*`) take typed props. They may call `useTrans()` and render Inertia's `<Link>`; they never call `usePage()`, the router, Echo or the network.
- Every user-facing string goes through `t('…')` with a literal key present in `lang/en.json`, `lang/fr.json`, `lang/de.json`, `lang/es.json` (`tests/Feature/TranslationKeysTest.php`). New keys are in Appendix A.
- The Pest browser suite is a contract: `data-test`, `data-realtime`, `data-presence-id`, element ids and English accessible names of existing pages do not change in this plan.
- URLs only through Wayfinder (`@/actions/...`, `@/routes/...`). Run `npm run build` once after adding a route so the actions exist.
- PHP style: early returns, no `else`, curly braces always, typed everything, PascalCase constants, no comments that restate code. Run `vendor/bin/pint --dirty --format agent` before every commit that touches PHP.
- Controllers are plural and stick to CRUD method names. Route names are camelCase segments; URLs are kebab-case.
- Commit messages end with the attribution lines the session provides.

## Review Focus

1. **A user who belongs to no team in the current workspace** opens any page: the sidebar must render without the Team group and without a broken link, not crash on a null team. Pinned in Task 4 (PHP) and Task 5 (component).
2. **A guest or signed-out visitor** hits a page under the new layouts or `/dev/design-system`: shared props have `auth.user = null`; nothing may dereference it. Pinned in Task 4 and Task 7.
3. **`/dev/design-system` in production**: must be a 404, including its sub-sections. Pinned in Task 7.
4. **A French label 30 % longer than the English one** in the sidebar, tab bar and sub-navigation at 390px: it must truncate, not wrap or push the layout wider. Pinned by the overflow check in Task 8, which runs in FR.
5. **First paint in dark mode**: the inline background in `app.blade.php` must match the new dark `--background`, or the page flashes the old colour before the stylesheet loads. Pinned in Task 2.

---

## File structure

| File | Responsibility |
|---|---|
| `vite.config.ts` | adds the `test` block, removes the Bunny font |
| `resources/js/test/setup.ts` | Vitest setup: mocks `usePage` for `useTrans()` |
| `resources/css/app.css` | design-system tokens + Excalidraw overrides |
| `resources/views/app.blade.php` | first-paint colours, favicon links, no `@fonts` |
| `public/brand/*.svg`, `public/favicon.svg` | brand assets |
| `resources/js/components/skrum/skrum-logo.tsx` | inline SVG logo on tokens |
| `app/Http/Middleware/HandleInertiaRequests.php` | `auth.user.avatarUrl`, `currentTeam`, `teams` |
| `resources/js/components/skrum/app-sidebar.tsx` | the single sidebar, presentational |
| `resources/js/components/skrum/mobile-tab-bar.tsx` | five-tab bar for mobile |
| `resources/js/components/skrum/app-topbar.tsx` | topbar with breadcrumb and slots |
| `resources/js/components/skrum/sub-nav.tsx` | in-page sub-navigation |
| `resources/js/components/skrum/frames.tsx` | `AppFrame`, `SessionFrame`, `SettingsFrame`, `AuthFrame`, `OnboardingFrame` |
| `resources/js/hooks/use-sidebar-model.ts` | shared props → `AppSidebarProps` |
| `resources/js/layouts/skrum/*.tsx` | the five layouts (containers) |
| `app/Http/Controllers/DesignSystemPagesController.php`, `resources/js/pages/dev/design-system.tsx` | local-only test bench |
| `tests/Browser/Support/CapturesVisuals.php`, `tests/Browser/Visual/DesignSystemVisualTest.php` | visual harness |

---

### Task 0: Branch and baseline

**Files:** none.

- [ ] **Step 1: Branch from up-to-date main**

```bash
git checkout main && git merge --ff-only plan-18-front-rewrite && git checkout -b plan-18a-foundations
```

- [ ] **Step 2: Install what `composer.json` and `package.json` already declare**

`vendor/pestphp/pest-plugin-browser` is missing from the working copy although `composer.json` requires it.

```bash
composer install && npm install && npm run build
```

- [ ] **Step 3: Record the baseline**

Run: `php artisan test --compact` then `composer test:browser`
Expected: both pass. If the browser suite fails before any change, stop and report: this plan relies on it as the guard.

---

### Task 1: Vitest harness

**Files:**
- Modify: `package.json`, `vite.config.ts`
- Create: `resources/js/test/setup.ts`, `resources/js/lib/utils.test.ts`

**Interfaces:**
- Produces: `npm run test` (runs `vp test run`); test files are `resources/js/**/*.test.{ts,tsx}`; `usePage()` is mocked globally and returns `{ props: { translations: {} } }`, so `t(key)` returns the key.

- [ ] **Step 1: Install the dev dependencies**

```bash
npm install --save-dev @testing-library/react jsdom
```

- [ ] **Step 2: Write the first test**

`resources/js/lib/utils.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
    it('keeps the last of two conflicting Tailwind classes', () => {
        expect(cn('p-2', 'p-4')).toBe('p-4');
    });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vp test run`
Expected: FAIL or "no test files found", because no `test` block exists yet.

- [ ] **Step 4: Configure Vitest**

In `vite.config.ts`, add inside `defineConfig({ … })`, after `server`:

```ts
    test: {
        environment: 'jsdom',
        include: ['resources/js/**/*.test.{ts,tsx}'],
        setupFiles: ['resources/js/test/setup.ts'],
        css: false,
    },
```

If `import … from 'vitest'` does not resolve, vite-plus re-exports it: use `'vite-plus/test'` in every test file and in the setup file instead.

If the Laravel, Inertia or Wayfinder plugins break the test run (they expect a build context), wrap the plugin list: `plugins: process.env.VITEST ? [react()] : lazyPlugins(() => [ … ])`, and add `resolve: { alias: { '@': '/resources/js' } }` for the test case.

`resources/js/test/setup.ts`:

```ts
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: { translations: {} } }),
    };
});

afterEach(() => {
    cleanup();
});
```

In `package.json` scripts, add:

```json
        "test": "vp test run",
```

- [ ] **Step 5: Run it to see it pass**

Run: `npm run test`
Expected: 1 passed.

- [ ] **Step 6: Check and commit**

Run: `npm run types:check && npm run check`

```bash
git add package.json package-lock.json vite.config.ts resources/js/test/setup.ts resources/js/lib/utils.test.ts
git commit -m "test: add the Vitest harness for front-end unit tests"
```

---

### Task 2: Tokens and fonts

**Files:**
- Modify: `resources/css/app.css` (replaced), `resources/views/app.blade.php`, `vite.config.ts`, `resources/js/app.tsx:82-84`, `package.json`
- Test: `tests/Feature/DesignTokensTest.php`

**Interfaces:**
- Produces: every Tailwind class of `docs/design-system/sections/04-tailwind.md` (`bg-skrum-col-sun`, `text-body-sm`, `w-column`, `max-w-page`, `shadow-card`, `duration-220`, `font-display`, `font-mono`, `.col-*`, `.bg-dotgrid`…).

- [ ] **Step 1: Write the failing test**

Create with `php artisan make:test --pest DesignTokensTest`, then:

```php
<?php

it('starts the stylesheet with the design-system file, unmodified', function () {
    $reference = file_get_contents(base_path('docs/design-system/app.css'));
    $stylesheet = file_get_contents(resource_path('css/app.css'));

    expect(str_starts_with($stylesheet, rtrim($reference)))->toBeTrue();
});

it('keeps the whiteboard overrides after the tokens', function () {
    $stylesheet = file_get_contents(resource_path('css/app.css'));

    expect($stylesheet)
        ->toContain('.excalidraw .default-sidebar-trigger')
        ->toContain(".whiteboard-canvas[data-facilitator='false']");
});

it('paints the first frame with the token backgrounds', function () {
    $view = file_get_contents(resource_path('views/app.blade.php'));

    expect($view)
        ->toContain('background-color: oklch(0.985 0.004 80)')
        ->toContain('background-color: oklch(0.165 0.008 55)')
        ->not->toContain('@fonts');
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `php artisan test --compact tests/Feature/DesignTokensTest.php`
Expected: 3 failed.

- [ ] **Step 3: Install the fonts**

```bash
npm install @fontsource-variable/figtree @fontsource-variable/bricolage-grotesque @fontsource-variable/jetbrains-mono
```

- [ ] **Step 4: Replace the stylesheet, keeping the Excalidraw block**

The old file's lines 145–214 (from the comment `Excalidraw 0.18.1 has no UIOptions key` to the end) are the whiteboard overrides. They stay byte for byte: their px values mirror Excalidraw's own layout and are reworked with the whiteboard screen in plan 18e.

```bash
sed -n '145,$p' resources/css/app.css > /tmp/skrum-excalidraw.css
head -3 /tmp/skrum-excalidraw.css   # must show the opening "/*" of the Excalidraw comment
{ cat docs/design-system/app.css; printf '\n'; cat /tmp/skrum-excalidraw.css; } > resources/css/app.css
```

If `head -3` does not show the start of that comment, adjust the line number until it does, then rerun.

- [ ] **Step 5: Remove the Bunny font**

In `vite.config.ts`, delete the import `import { bunny } from 'laravel-vite-plugin/fonts';` and the whole `fonts: [ … ]` key of the `laravel({ … })` call.

- [ ] **Step 6: Update the root view**

In `resources/views/app.blade.php`: delete the `@fonts` line; replace the inline `<style>` block with:

```blade
        {{-- First-paint background: the values of --background in resources/css/app.css --}}
        <style>
            html {
                background-color: oklch(0.985 0.004 80);
            }

            html.dark {
                background-color: oklch(0.165 0.008 55);
            }
        </style>
```

Replace `<title>{{ config('app.name', 'Laravel') }}</title>` with `<title>{{ config('app.name', 'Skrüm') }}</title>`, and `<body class="font-sans antialiased">` with `<body>` (the base layer sets both).

- [ ] **Step 7: Use a token for the progress bar**

In `resources/js/app.tsx`, replace `color: '#4B5563',` with `color: 'var(--primary)',`.

- [ ] **Step 8: Run the test, then build**

Run: `php artisan test --compact tests/Feature/DesignTokensTest.php`
Expected: 3 passed.

Run: `npm run build && npm run types:check && npm run check`
Expected: build succeeds with no "unknown utility" error.

- [ ] **Step 9: Run the browser suite**

Run: `composer test:browser`
Expected: pass. Old pages now render with the new palette and fonts; no selector or label changed. If a test fails on a colour-dependent assertion, report it instead of editing the test.

- [ ] **Step 10: Commit**

```bash
git add resources/css/app.css resources/views/app.blade.php vite.config.ts resources/js/app.tsx package.json package-lock.json tests/Feature/DesignTokensTest.php
git commit -m "feat(design): adopt the design-system tokens and self-hosted fonts"
```

---

### Task 3: Brand assets and `<SkrumLogo>`

**Files:**
- Create: `public/brand/` (8 SVG), `resources/js/components/skrum/skrum-logo.tsx`, `resources/js/components/skrum/skrum-logo.test.tsx`
- Modify: `public/favicon.svg`, `resources/views/app.blade.php`
- Delete: `public/favicon.ico`, `public/apple-touch-icon.png` (Laravel artwork)

**Interfaces:**
- Produces: `SkrumLogo({ variant?: 'horizontal' | 'symbol' | 'wordmark'; className?: string })`, default `horizontal`. It has `role="img"` and `aria-label="Skrüm"`. Size is set by the caller through `className` (for example `h-7 w-auto`).

Colour mapping from the SVG files to tokens (light file / dark file → class):

| Part | Light | Dark | Class |
|---|---|---|---|
| Tile | `#bb4d2a` | `#ea865e` | `fill-primary` |
| Folded corner | `#8f3519` | `#b8603f` | `fill-primary brightness-75` |
| ü on the tile | `#fbfaf7` | `#1d100b` | `stroke-primary-foreground` / `fill-primary-foreground` |
| Wordmark strokes | `#211a16` | `#f2f0ec` | `stroke-foreground` |
| First dot | `#bb4d2a` | `#ea865e` | `fill-primary` |
| Second dot | `#358264` | `#68bf9b` | `fill-chart-2` |

- [ ] **Step 1: Write the failing test**

`resources/js/components/skrum/skrum-logo.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SkrumLogo } from '@/components/skrum/skrum-logo';

describe('SkrumLogo', () => {
    it.each(['horizontal', 'symbol', 'wordmark'] as const)(
        'renders the %s variant as a labelled image',
        (variant) => {
            render(<SkrumLogo variant={variant} />);

            expect(screen.getByRole('img', { name: 'Skrüm' })).toBeTruthy();
        },
    );

    it('paints with tokens only', () => {
        const { container } = render(<SkrumLogo />);

        expect(container.innerHTML).not.toMatch(/#[0-9a-f]{3,8}\b/i);
        expect(container.querySelectorAll('[fill^="#"], [stroke^="#"]')).toHaveLength(0);
    });

    it('draws both the tile and the wordmark in the horizontal variant', () => {
        const { container } = render(<SkrumLogo variant="horizontal" />);

        expect(container.querySelector('[data-part="symbol"]')).not.toBeNull();
        expect(container.querySelector('[data-part="wordmark"]')).not.toBeNull();
    });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm run test -- skrum-logo`
Expected: FAIL, module not found.

- [ ] **Step 3: Write the component**

Paths are copied from `docs/design-system/logos/skrum-logo-horizontal-light.svg`; only colours change.

`resources/js/components/skrum/skrum-logo.tsx`:

```tsx
import { cn } from '@/lib/utils';

type Variant = 'horizontal' | 'symbol' | 'wordmark';

const ViewBoxes: Record<Variant, string> = {
    horizontal: '0 0 310 72',
    symbol: '0 0 64 64',
    wordmark: '0 0 228 70',
};

function Symbol() {
    return (
        <g data-part="symbol">
            <path
                className="fill-primary"
                d="M14 0 H50 A14 14 0 0 1 64 14 V46 L46 64 H14 A14 14 0 0 1 0 50 V14 A14 14 0 0 1 14 0 Z"
            />
            <path
                className="fill-primary brightness-75"
                d="M64 46 L50 46 A4 4 0 0 0 46 50 L46 64 Z"
            />
            <path
                className="fill-none stroke-primary-foreground"
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 27 L19 38 C19 45 24 49.5 30 49.5 C36 49.5 41 45 41 38 L41 27"
            />
            <circle className="fill-primary-foreground" cx="21.5" cy="15.5" r="4.5" />
            <circle className="fill-primary-foreground" cx="38.5" cy="15.5" r="4.5" />
        </g>
    );
}

function Wordmark() {
    return (
        <g data-part="wordmark">
            <g
                className="fill-none stroke-foreground"
                strokeWidth="9"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M27 31 C24 26 19 24 14 24 C7 24 2 28 2 34 C2 40 8 42 15 44 C22 46 28 48 28 54.5 C28 61 22 64 15 64 C9 64 4 61.5 1.5 57" />
                <path d="M43 4 L43 64" />
                <path d="M67 24 L44 47" />
                <path d="M53 38 L69 64" />
                <path d="M82 24 L82 64" />
                <path d="M82 42 C82 30 90 24 101 24" />
                <path d="M114 24 L114 46 C114 57 121 64 130 64 C139 64 146 57 146 46" />
                <path d="M146 24 L146 64" />
                <path d="M161 24 L161 64" />
                <path d="M161 38 C161 29 167 24 174.5 24 C182 24 187 29 187 38 L187 64" />
                <path d="M187 38 C187 29 193 24 200.5 24 C208 24 213 29 213 38 L213 64" />
            </g>
            <circle className="fill-primary" cx="117" cy="10" r="6" />
            <circle className="fill-chart-2" cx="143" cy="10" r="6" />
        </g>
    );
}

export function SkrumLogo({
    variant = 'horizontal',
    className,
}: {
    variant?: Variant;
    className?: string;
}) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox={ViewBoxes[variant]}
            role="img"
            aria-label="Skrüm"
            className={cn('shrink-0', className)}
        >
            {variant === 'symbol' && <Symbol />}
            {variant === 'wordmark' && (
                <g transform="translate(5 0)">
                    <Wordmark />
                </g>
            )}
            {variant === 'horizontal' && (
                <>
                    <g transform="scale(1.09375)">
                        <Symbol />
                    </g>
                    <g transform="translate(92 3)">
                        <Wordmark />
                    </g>
                </>
            )}
        </svg>
    );
}
```

The wordmark paths above are in the coordinates of the horizontal file (shifted 5 units left of `skrum-wordmark-light.svg`), hence `translate(5 0)` for the standalone wordmark.

- [ ] **Step 4: Run the test to see it pass**

Run: `npm run test -- skrum-logo`
Expected: 5 passed.

- [ ] **Step 5: Publish the static assets**

```bash
mkdir -p public/brand && cp docs/design-system/logos/*.svg public/brand/
cp docs/design-system/logos/skrum-favicon.svg public/favicon.svg
git rm public/favicon.ico public/apple-touch-icon.png
```

In `resources/views/app.blade.php`, replace the three icon `<link>` lines with:

```blade
        <link rel="icon" href="/favicon.svg" type="image/svg+xml">
```

- [ ] **Step 6: Check nothing else referenced the removed files**

Run: `grep -rn "favicon.ico\|apple-touch-icon" resources app config public --include='*.php' --include='*.tsx' --include='*.ts' --include='*.json' --include='*.webmanifest'`
Expected: no output. If something references them, report it rather than restoring Laravel artwork.

- [ ] **Step 7: Commit**

```bash
npm run types:check && npm run check
git add public/brand public/favicon.svg resources/views/app.blade.php resources/js/components/skrum
git commit -m "feat(brand): add the Skrüm logos, favicon and SkrumLogo component"
```

---

### Task 4: Shared props — avatar URL and current team (B9, B16)

**Files:**
- Modify: `app/Http/Middleware/HandleInertiaRequests.php`, `resources/js/types/auth.ts`, `resources/js/types/workspaces.ts`, `resources/js/types/global.d.ts`, `resources/js/components/user-info.tsx:22`
- Test: `tests/Feature/SharedPropsTest.php`

**Interfaces:**
- Produces shared props:
  - `auth.user.avatarUrl: string` (when signed in)
  - `currentTeam: { id: string; name: string; membersCount: number } | null`
  - `teams: { id: string; name: string }[]`
- TS: `CurrentTeam`, `TeamSummary` in `@/types/workspaces`; `User.avatarUrl: string` replaces `User.avatar?`.

Current team resolution: the `team` route parameter when it is a `Team`; otherwise the team whose id is in session key `current_team_id`, if still visible in the current workspace; otherwise the first visible team by name; otherwise null. Visiting a route with a `team` parameter stores its id in the session.

- [ ] **Step 1: Write the failing tests**

Create with `php artisan make:test --pest SharedPropsTest`. Check `tests/Feature/DashboardTest.php` and `database/factories` for the existing way to build a user with a workspace and teams, and reuse those factory states; the assertions are:

```php
<?php

use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use Inertia\Testing\AssertableInertia;

function memberOf(Workspace $workspace): User
{
    $user = User::factory()->create(['current_workspace_id' => $workspace->id]);
    $workspace->members()->attach($user, ['role' => 'member']);

    return $user;
}

it('shares the avatar URL of the signed-in user', function () {
    $workspace = Workspace::factory()->create();
    $user = memberOf($workspace);

    $this->actingAs($user)
        ->get(route('workspaces.show', $workspace))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('auth.user.avatarUrl', $user->avatarUrl()));
});

it('shares no user and no team for a visitor', function () {
    $this->get(route('login'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('auth.user', null)
            ->where('currentTeam', null)
            ->where('teams', []));
});

it('shares no current team when the user has none in the workspace', function () {
    $workspace = Workspace::factory()->create();
    Team::factory()->for($workspace)->create();
    $user = memberOf($workspace);

    $this->actingAs($user)
        ->get(route('workspaces.show', $workspace))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('currentTeam', null)
            ->where('teams', []));
});

it('shares the team of the route, with its member count', function () {
    $workspace = Workspace::factory()->create();
    $user = memberOf($workspace);
    $alpha = Team::factory()->for($workspace)->create(['name' => 'Alpha']);
    $beta = Team::factory()->for($workspace)->create(['name' => 'Beta']);
    $alpha->members()->attach($user);
    $beta->members()->attach($user);

    $this->actingAs($user)
        ->get(route('teams.show', [$workspace, $beta]))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('currentTeam.id', $beta->id)
            ->where('currentTeam.name', 'Beta')
            ->where('currentTeam.membersCount', 1)
            ->has('teams', 2));
});

it('remembers the last visited team on pages without a team', function () {
    $workspace = Workspace::factory()->create();
    $user = memberOf($workspace);
    $alpha = Team::factory()->for($workspace)->create(['name' => 'Alpha']);
    $beta = Team::factory()->for($workspace)->create(['name' => 'Beta']);
    $alpha->members()->attach($user);
    $beta->members()->attach($user);

    $this->actingAs($user)->get(route('teams.show', [$workspace, $beta]));

    $this->actingAs($user)
        ->get(route('workspaces.show', $workspace))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('currentTeam.id', $beta->id));
});

it('falls back to the first team by name', function () {
    $workspace = Workspace::factory()->create();
    $user = memberOf($workspace);
    $beta = Team::factory()->for($workspace)->create(['name' => 'Beta']);
    $alpha = Team::factory()->for($workspace)->create(['name' => 'Alpha']);
    $alpha->members()->attach($user);
    $beta->members()->attach($user);

    $this->actingAs($user)
        ->get(route('workspaces.show', $workspace))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('currentTeam.id', $alpha->id));
});

it('ignores a remembered team that is no longer visible', function () {
    $workspace = Workspace::factory()->create();
    $user = memberOf($workspace);
    $alpha = Team::factory()->for($workspace)->create(['name' => 'Alpha']);
    $gone = Team::factory()->for($workspace)->create(['name' => 'Gone']);
    $alpha->members()->attach($user);

    $this->actingAs($user)
        ->withSession(['current_team_id' => $gone->id])
        ->get(route('workspaces.show', $workspace))
        ->assertInertia(fn (AssertableInertia $page) => $page->where('currentTeam.id', $alpha->id));
});
```

If the membership pivot or the factories use other names than `members()` / `role`, adapt `memberOf()` to the existing helpers in `tests/Pest.php`; the seven assertions stay.

- [ ] **Step 2: Run them to see them fail**

Run: `php artisan test --compact tests/Feature/SharedPropsTest.php`
Expected: 7 failed (missing props).

- [ ] **Step 3: Implement**

In `app/Http/Middleware/HandleInertiaRequests.php`, add `use App\Models\Team;`, `use App\Models\User;` and `use Illuminate\Support\Collection;`. Replace the `'auth'` entry and add two entries after `'currentWorkspace'`:

```php
            'auth' => [
                'user' => $this->user($request),
            ],
```

```php
            'teams' => fn (): array => $this->visibleTeams($request)
                ->map(fn (Team $team): array => $team->only(['id', 'name']))
                ->all(),
            'currentTeam' => fn (): ?array => $this->currentTeam($request),
```

Add the private methods:

```php
    /**
     * @return array<string, mixed>|null
     */
    private function user(Request $request): ?array
    {
        $user = $request->user();

        if ($user === null) {
            return null;
        }

        return [...$user->toArray(), 'avatarUrl' => $user->avatarUrl()];
    }

    private function workspaceInScope(Request $request, User $user): ?Workspace
    {
        $workspace = $request->route('workspace');

        if (! $workspace instanceof Workspace) {
            $workspace = $user->currentWorkspace;
        }

        if ($workspace === null || ! $user->belongsToWorkspace($workspace)) {
            return null;
        }

        return $workspace;
    }

    /**
     * @return Collection<int, Team>
     */
    private function visibleTeams(Request $request): Collection
    {
        $user = $request->user();

        if ($user === null) {
            return collect();
        }

        $workspace = $this->workspaceInScope($request, $user);

        if ($workspace === null) {
            return collect();
        }

        return $workspace->teamsVisibleTo($user)->sortBy('name')->values();
    }

    /**
     * @return array{
     *     id: string,
     *     name: string,
     *     membersCount: int
     * }|null
     */
    private function currentTeam(Request $request): ?array
    {
        $teams = $this->visibleTeams($request);
        $routeTeam = $request->route('team');

        if ($routeTeam instanceof Team && $request->hasSession() && $teams->contains('id', $routeTeam->id)) {
            $request->session()->put('current_team_id', $routeTeam->id);
        }

        $rememberedId = $request->hasSession() ? $request->session()->get('current_team_id') : null;
        $team = $teams->firstWhere('id', $rememberedId) ?? $teams->first();

        if ($team === null) {
            return null;
        }

        return [
            ...$team->only(['id', 'name']),
            'membersCount' => $team->members()->count(),
        ];
    }
```

`Workspace::teamsVisibleTo()` already exists (used by `WorkspacesController@show`). Check its return type: if it returns a query builder rather than a collection, call `->get()` before `sortBy`.

- [ ] **Step 4: Run the tests to see them pass**

Run: `php artisan test --compact tests/Feature/SharedPropsTest.php`
Expected: 7 passed.

- [ ] **Step 5: Update the TypeScript side**

`resources/js/types/auth.ts`: replace `avatar?: string;` with `avatarUrl: string;`.

`resources/js/types/workspaces.ts`: add

```ts
export type TeamSummary = {
    id: string;
    name: string;
};

export type CurrentTeam = TeamSummary & {
    membersCount: number;
};
```

`resources/js/types/global.d.ts`: import both types and add to `sharedPageProps`:

```ts
            teams: TeamSummary[];
            currentTeam: CurrentTeam | null;
```

`resources/js/components/user-info.tsx`: replace `src={user.avatar}` with `src={user.avatarUrl}`.

- [ ] **Step 6: Run the wider suites**

Run: `vendor/bin/pint --dirty --format agent && php artisan test --compact && npm run types:check && npm run check`
Expected: all pass. A page prop named `teams` already exists on `workspaces/show`; a page prop overrides a shared prop of the same name, and both have the shape `{id, name}[]`, so nothing changes for that page.

- [ ] **Step 7: Commit**

```bash
git add app/Http/Middleware/HandleInertiaRequests.php resources/js/types resources/js/components/user-info.tsx tests/Feature/SharedPropsTest.php
git commit -m "feat(shell): share the avatar URL and the current team with every page"
```

---

### Task 5: The sidebar and the mobile tab bar

**Files:**
- Create: `resources/js/components/skrum/app-sidebar.tsx`, `resources/js/components/skrum/mobile-tab-bar.tsx`, `resources/js/components/skrum/app-sidebar.test.tsx`
- Modify: `lang/en.json`, `lang/fr.json`, `lang/de.json`, `lang/es.json` (Appendix A)

**Interfaces:**
- Produces:

```ts
export type NavKey =
    | 'dashboard' | 'sessions' | 'actions' | 'mood' | 'games' | 'members'
    | 'templates' | 'teams' | 'settings' | 'admin';

export type NavHref = NonNullable<InertiaLinkProps['href']>;

export type AppSidebarProps = {
    active?: NavKey;
    team: { id: string; name: string; initials: string; membersCount: number } | null;
    teams: { id: string; name: string; href: NavHref }[];
    workspace: { id: string; name: string } | null;
    workspaces: { id: string; name: string; href: NavHref }[];
    newWorkspaceHref: NavHref;
    homeHref: NavHref;
    links: Partial<Record<NavKey, NavHref>>;
    overdueActions?: number;
    footer?: ReactNode;   // the user card, supplied by the layout
};

export function AppSidebar(props: AppSidebarProps): JSX.Element;
export function MobileTabBar(props: { active?: NavKey; links: Partial<Record<NavKey, NavHref>>; onMore: () => void }): JSX.Element;
```

An entry whose key is absent from `links` is not rendered: there is never a dead control. `team === null` hides the Team group. `AppSidebar` must be rendered inside `SidebarProvider` from `@/components/ui/sidebar`.

- [ ] **Step 1: Add the translation keys of Appendix A to the four lang files**

- [ ] **Step 2: Write the failing tests**

`resources/js/components/skrum/app-sidebar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppSidebar, type AppSidebarProps } from '@/components/skrum/app-sidebar';
import { MobileTabBar } from '@/components/skrum/mobile-tab-bar';
import { SidebarProvider } from '@/components/ui/sidebar';

const base: AppSidebarProps = {
    team: { id: 't1', name: 'Atlas', initials: 'AT', membersCount: 8 },
    teams: [{ id: 't1', name: 'Atlas', href: '/t1' }],
    workspace: { id: 'w1', name: 'Nordlys' },
    workspaces: [{ id: 'w1', name: 'Nordlys', href: '/w1' }],
    newWorkspaceHref: '/workspaces/create',
    homeHref: '/dashboard',
    links: {
        dashboard: '/t1',
        sessions: '/t1#sessions',
        actions: '/actions',
        mood: '/t1#mood',
        games: '/t1/games',
        members: '/t1#members',
        templates: '/templates',
        teams: '/w1',
    },
};

function renderSidebar(props: Partial<AppSidebarProps> = {}) {
    return render(
        <SidebarProvider>
            <AppSidebar {...base} {...props} />
        </SidebarProvider>,
    );
}

describe('AppSidebar', () => {
    it('lists the team and workspace entries in the order of the design system', () => {
        renderSidebar();

        const labels = screen
            .getAllByRole('link')
            .map((link) => link.textContent?.trim())
            .filter((label) => label && label !== 'Skrüm');

        expect(labels).toEqual([
            'Dashboard', 'Sessions', 'Actions', 'Mood & ROTI', 'Games', 'Members',
            'Templates', 'All teams',
        ]);
    });

    it('marks the active entry', () => {
        renderSidebar({ active: 'actions' });

        expect(screen.getByRole('link', { name: /Actions/ }).getAttribute('aria-current')).toBe('page');
        expect(screen.getByRole('link', { name: 'Dashboard' }).getAttribute('aria-current')).toBeNull();
    });

    it('shows the overdue badge with an accessible name', () => {
        renderSidebar({ overdueActions: 3 });

        expect(screen.getByLabelText('3 overdue')).toBeTruthy();
    });

    it('hides the badge when nothing is overdue', () => {
        renderSidebar({ overdueActions: 0 });

        expect(screen.queryByLabelText('0 overdue')).toBeNull();
    });

    it('renders no entry without a link', () => {
        renderSidebar({ links: { teams: '/w1' } });

        expect(screen.queryByRole('link', { name: 'Team settings' })).toBeNull();
        expect(screen.queryByRole('link', { name: 'Administration' })).toBeNull();
        expect(screen.queryByRole('link', { name: 'Dashboard' })).toBeNull();
    });

    it('hides the Team group when the user has no team', () => {
        renderSidebar({ team: null, teams: [], links: { templates: '/templates', teams: '/w1' } });

        expect(screen.queryByText('Team')).toBeNull();
        expect(screen.getByRole('link', { name: 'All teams' })).toBeTruthy();
    });

    it('is a labelled navigation landmark', () => {
        renderSidebar();

        expect(screen.getByRole('navigation', { name: 'Navigation' })).toBeTruthy();
    });
});

describe('MobileTabBar', () => {
    it('shows the five tabs', () => {
        render(<MobileTabBar links={base.links} onMore={() => {}} />);

        expect(screen.getAllByRole('link').map((link) => link.textContent?.trim())).toEqual([
            'Home', 'Sessions', 'Actions', 'Mood',
        ]);
        expect(screen.getByRole('button', { name: 'More' })).toBeTruthy();
    });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `npm run test -- app-sidebar`
Expected: FAIL, modules not found.

- [ ] **Step 4: Write the sidebar**

`resources/js/components/skrum/app-sidebar.tsx`:

```tsx
import type { InertiaLinkProps } from '@inertiajs/react';
import { Link } from '@inertiajs/react';
import {
    Building2,
    CalendarClock,
    Check,
    ChevronsUpDown,
    LayoutDashboard,
    LayoutTemplate,
    ListChecks,
    type LucideIcon,
    PartyPopper,
    Plus,
    Settings,
    ShieldCheck,
    TrendingUp,
    Users,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { SkrumLogo } from '@/components/skrum/skrum-logo';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useTrans } from '@/hooks/use-trans';

export type NavKey =
    | 'dashboard'
    | 'sessions'
    | 'actions'
    | 'mood'
    | 'games'
    | 'members'
    | 'templates'
    | 'teams'
    | 'settings'
    | 'admin';

export type NavHref = NonNullable<InertiaLinkProps['href']>;

export type AppSidebarProps = {
    active?: NavKey;
    team: {
        id: string;
        name: string;
        initials: string;
        membersCount: number;
    } | null;
    teams: { id: string; name: string; href: NavHref }[];
    workspace: { id: string; name: string } | null;
    workspaces: { id: string; name: string; href: NavHref }[];
    newWorkspaceHref: NavHref;
    homeHref: NavHref;
    links: Partial<Record<NavKey, NavHref>>;
    overdueActions?: number;
    footer?: ReactNode;
};

type Entry = { key: NavKey; label: string; icon: LucideIcon };

function NavEntries({
    entries,
    active,
    links,
    overdueActions = 0,
}: {
    entries: Entry[];
    active?: NavKey;
    links: AppSidebarProps['links'];
    overdueActions?: number;
}) {
    const { t } = useTrans();

    return (
        <SidebarMenu>
            {entries.map(({ key, label, icon: Icon }) => {
                const href = links[key];

                if (href === undefined) {
                    return null;
                }

                const isActive = active === key;

                return (
                    <SidebarMenuItem key={key}>
                        <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            tooltip={{ children: label }}
                            className="data-[active=true]:font-semibold"
                        >
                            <Link
                                href={href}
                                prefetch
                                aria-current={isActive ? 'page' : undefined}
                            >
                                <Icon
                                    className={
                                        isActive
                                            ? 'text-skrum-primary-text'
                                            : undefined
                                    }
                                />
                                <span className="truncate">{label}</span>
                            </Link>
                        </SidebarMenuButton>
                        {key === 'actions' && overdueActions > 0 && (
                            <SidebarMenuBadge
                                className="rounded-full bg-destructive px-1.5 text-destructive-foreground tabular-nums peer-hover/menu-button:text-destructive-foreground"
                                aria-label={t(':count overdue', {
                                    count: overdueActions,
                                })}
                            >
                                {overdueActions > 99 ? '99+' : overdueActions}
                            </SidebarMenuBadge>
                        )}
                    </SidebarMenuItem>
                );
            })}
        </SidebarMenu>
    );
}

function TeamSwitcher({
    team,
    teams,
    workspace,
    workspaces,
    newWorkspaceHref,
}: Pick<
    AppSidebarProps,
    'team' | 'teams' | 'workspace' | 'workspaces' | 'newWorkspaceHref'
>) {
    const { t } = useTrans();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="gap-2">
                    <span
                        aria-hidden
                        className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground"
                    >
                        {team?.initials ?? workspace?.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="grid min-w-0 flex-1 text-left">
                        <span className="truncate text-sm font-semibold">
                            {team?.name ??
                                workspace?.name ??
                                t('Select a workspace')}
                        </span>
                        {team !== null && workspace !== null && (
                            <span className="truncate text-xs text-muted-foreground">
                                {workspace.name} ·{' '}
                                {t(':count members', {
                                    count: team.membersCount,
                                })}
                            </span>
                        )}
                    </span>
                    <ChevronsUpDown className="size-4 shrink-0" />
                </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
                {teams.length > 0 && (
                    <>
                        <DropdownMenuLabel className="truncate">
                            {t('Teams')}
                        </DropdownMenuLabel>
                        {teams.map((entry) => (
                            <DropdownMenuItem key={entry.id} asChild>
                                <Link href={entry.href}>
                                    <span className="min-w-0 flex-1 truncate">
                                        {entry.name}
                                    </span>
                                    {entry.id === team?.id && (
                                        <Check className="size-4 shrink-0" />
                                    )}
                                </Link>
                            </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                    </>
                )}
                <DropdownMenuLabel className="truncate">
                    {t('Workspaces')}
                </DropdownMenuLabel>
                {workspaces.map((entry) => (
                    <DropdownMenuItem key={entry.id} asChild>
                        <Link href={entry.href}>
                            <span className="min-w-0 flex-1 truncate">
                                {entry.name}
                            </span>
                            {entry.id === workspace?.id && (
                                <Check className="size-4 shrink-0" />
                            )}
                        </Link>
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link href={newWorkspaceHref}>
                        <Plus className="size-4 shrink-0" />
                        <span className="truncate">{t('New workspace')}</span>
                    </Link>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function AppSidebar({
    active,
    team,
    teams,
    workspace,
    workspaces,
    newWorkspaceHref,
    homeHref,
    links,
    overdueActions,
    footer,
}: AppSidebarProps) {
    const { t } = useTrans();

    const teamEntries: Entry[] = [
        { key: 'dashboard', label: t('Dashboard'), icon: LayoutDashboard },
        { key: 'sessions', label: t('Sessions'), icon: CalendarClock },
        { key: 'actions', label: t('Actions'), icon: ListChecks },
        { key: 'mood', label: t('Mood & ROTI'), icon: TrendingUp },
        { key: 'games', label: t('Games'), icon: PartyPopper },
        { key: 'members', label: t('Members'), icon: Users },
    ];

    const workspaceEntries: Entry[] = [
        { key: 'templates', label: t('Templates'), icon: LayoutTemplate },
        { key: 'teams', label: t('All teams'), icon: Building2 },
    ];

    const footerEntries: Entry[] = [
        { key: 'settings', label: t('Team settings'), icon: Settings },
        { key: 'admin', label: t('Administration'), icon: ShieldCheck },
    ];

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                            <Link href={homeHref} prefetch>
                                <SkrumLogo
                                    variant="symbol"
                                    className="size-6 group-data-[collapsible=icon]:block"
                                />
                                <SkrumLogo
                                    variant="wordmark"
                                    className="h-5 w-auto group-data-[collapsible=icon]:hidden"
                                />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <TeamSwitcher
                            team={team}
                            teams={teams}
                            workspace={workspace}
                            workspaces={workspaces}
                            newWorkspaceHref={newWorkspaceHref}
                        />
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <nav aria-label={t('Navigation')}>
                    {team !== null && (
                        <SidebarGroup>
                            <SidebarGroupLabel>{t('Team')}</SidebarGroupLabel>
                            <NavEntries
                                entries={teamEntries}
                                active={active}
                                links={links}
                                overdueActions={overdueActions}
                            />
                        </SidebarGroup>
                    )}
                    <SidebarGroup>
                        <SidebarGroupLabel>{t('Workspace')}</SidebarGroupLabel>
                        <NavEntries
                            entries={
                                team === null
                                    ? [
                                          ...teamEntries.filter(
                                              (entry) => entry.key === 'actions',
                                          ),
                                          ...workspaceEntries,
                                      ]
                                    : workspaceEntries
                            }
                            active={active}
                            links={links}
                            overdueActions={overdueActions}
                        />
                    </SidebarGroup>
                </nav>
            </SidebarContent>

            <SidebarFooter>
                <NavEntries
                    entries={footerEntries}
                    active={active}
                    links={links}
                />
                {footer}
            </SidebarFooter>
        </Sidebar>
    );
}
```

Two logos are rendered in the brand link, so `screen.getAllByRole('link')` contains one link whose text is empty; the first test filters it out. When there is no team, Actions (a workspace-level page) moves into the Workspace group so it stays reachable.

- [ ] **Step 5: Write the tab bar**

`resources/js/components/skrum/mobile-tab-bar.tsx`:

```tsx
import { Link } from '@inertiajs/react';
import {
    CalendarClock,
    Ellipsis,
    House,
    ListChecks,
    type LucideIcon,
    TrendingUp,
} from 'lucide-react';
import type { NavHref, NavKey } from '@/components/skrum/app-sidebar';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

const itemClass =
    'flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-xs font-medium text-muted-foreground aria-[current=page]:text-skrum-primary-text';

export function MobileTabBar({
    active,
    links,
    onMore,
}: {
    active?: NavKey;
    links: Partial<Record<NavKey, NavHref>>;
    onMore: () => void;
}) {
    const { t } = useTrans();

    const tabs: { key: NavKey; label: string; icon: LucideIcon }[] = [
        { key: 'dashboard', label: t('Home'), icon: House },
        { key: 'sessions', label: t('Sessions'), icon: CalendarClock },
        { key: 'actions', label: t('Actions'), icon: ListChecks },
        { key: 'mood', label: t('Mood'), icon: TrendingUp },
    ];

    return (
        <nav
            aria-label={t('Navigation')}
            className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-sidebar pb-[env(safe-area-inset-bottom)] md:hidden"
        >
            {tabs.map(({ key, label, icon: Icon }) => {
                const href = links[key];

                if (href === undefined) {
                    return null;
                }

                return (
                    <Link
                        key={key}
                        href={href}
                        aria-current={active === key ? 'page' : undefined}
                        className={itemClass}
                    >
                        <Icon className="size-5" />
                        <span className="max-w-full truncate">{label}</span>
                    </Link>
                );
            })}
            <button type="button" onClick={onMore} className={cn(itemClass)}>
                <Ellipsis className="size-5" />
                <span className="max-w-full truncate">{t('More')}</span>
            </button>
        </nav>
    );
}
```

`pb-[env(safe-area-inset-bottom)]` is an environment value, not a size from the scale; it is the one bracket allowed here.

- [ ] **Step 6: Run the tests to see them pass**

Run: `npm run test -- app-sidebar`
Expected: 8 passed.

Run: `php artisan test --compact tests/Feature/TranslationKeysTest.php && npm run types:check && npm run check`
Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add resources/js/components/skrum lang
git commit -m "feat(shell): add the team-centred sidebar and the mobile tab bar"
```

---

### Task 6: Frames and the five layouts

**Files:**
- Create: `resources/js/components/skrum/app-topbar.tsx`, `resources/js/components/skrum/sub-nav.tsx`, `resources/js/components/skrum/frames.tsx`, `resources/js/components/skrum/frames.test.tsx`, `resources/js/hooks/use-sidebar-model.ts`, `resources/js/layouts/skrum/app-layout.tsx`, `session-layout.tsx`, `settings-layout.tsx`, `auth-layout.tsx`, `onboarding-layout.tsx`

**Interfaces:**
- Consumes: `AppSidebar`, `AppSidebarProps`, `NavKey`, `NavHref`, `MobileTabBar` (Task 5); `SkrumLogo` (Task 3); shared props `currentTeam`, `teams` (Task 4).
- Produces:

```ts
// frames.tsx — presentational
AppFrame({ sidebar: AppSidebarProps; collapsed?: boolean; defaultOpen?: boolean; topbar: ReactNode; children: ReactNode })
SessionFrame({ sidebar: AppSidebarProps; title: ReactNode; phases?: ReactNode; timer?: ReactNode; presence?: ReactNode; actions?: ReactNode; children: ReactNode })
SettingsFrame({ title: string; description?: string; nav: SubNavItem[]; navLabel: string; children: ReactNode })
AuthFrame({ title: string; description?: string; aside?: ReactNode; headerEnd?: ReactNode; children: ReactNode })
OnboardingFrame({ stepper?: ReactNode; headerEnd?: ReactNode; aside?: ReactNode; children: ReactNode })

// app-topbar.tsx
AppTopbar({ breadcrumbs?: BreadcrumbItem[]; search?: ReactNode; actions?: ReactNode })

// sub-nav.tsx
type SubNavItem = { label: string; href: NavHref; current: boolean };
SubNav({ items: SubNavItem[]; label: string })

// use-sidebar-model.ts
useSidebarModel(active?: NavKey): AppSidebarProps   // without `footer`

// layouts/skrum/*.tsx — containers, default exports
AppLayout({ breadcrumbs?, active?, children })
SessionLayout({ title, phases?, timer?, presence?, actions?, children })
SettingsLayout({ title, description?, nav, children })
AuthLayout({ title?, description?, aside?, children })
OnboardingLayout({ stepper?, aside?, children })
```

The search slot stays empty in this plan (⌘K arrives in 18b and 18f). The bell is the existing `NotificationBell`, passed through `actions`.

- [ ] **Step 1: Write the failing tests**

`resources/js/components/skrum/frames.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AppSidebarProps } from '@/components/skrum/app-sidebar';
import { AppTopbar } from '@/components/skrum/app-topbar';
import {
    AppFrame,
    AuthFrame,
    OnboardingFrame,
    SessionFrame,
    SettingsFrame,
} from '@/components/skrum/frames';

const sidebar: AppSidebarProps = {
    team: { id: 't1', name: 'Atlas', initials: 'AT', membersCount: 8 },
    teams: [],
    workspace: { id: 'w1', name: 'Nordlys' },
    workspaces: [],
    newWorkspaceHref: '/workspaces/create',
    homeHref: '/dashboard',
    links: { dashboard: '/t1', teams: '/w1' },
};

describe('AppFrame', () => {
    it('renders the sidebar, the topbar and the content in a main landmark', () => {
        render(
            <AppFrame sidebar={sidebar} topbar={<AppTopbar breadcrumbs={[{ title: 'Atlas', href: '/t1' }]} />}>
                <p>content</p>
            </AppFrame>,
        );

        expect(screen.getAllByRole('navigation', { name: 'Navigation' }).length).toBeGreaterThan(0);
        expect(screen.getByRole('main').textContent).toContain('content');
        expect(screen.getByRole('banner').textContent).toContain('Atlas');
    });
});

describe('SessionFrame', () => {
    it('starts with the sidebar collapsed and shows the session slots', () => {
        const { container } = render(
            <SessionFrame sidebar={sidebar} title="Sprint 42" phases={<span>phases</span>} timer={<span>05:00</span>}>
                <p>board</p>
            </SessionFrame>,
        );

        expect(container.querySelector('[data-state="collapsed"]')).not.toBeNull();
        expect(screen.getByRole('banner').textContent).toContain('Sprint 42');
        expect(screen.getByRole('banner').textContent).toContain('phases');
        expect(screen.getByRole('banner').textContent).toContain('05:00');
    });
});

describe('SettingsFrame', () => {
    it('marks the current section in a labelled sub-navigation', () => {
        render(
            <SettingsFrame
                title="Settings"
                navLabel="Settings"
                nav={[
                    { label: 'Profile', href: '/settings/profile', current: true },
                    { label: 'Security', href: '/settings/security', current: false },
                ]}
            >
                <p>form</p>
            </SettingsFrame>,
        );

        const nav = screen.getByRole('navigation', { name: 'Settings' });

        expect(nav).toBeTruthy();
        expect(screen.getByRole('link', { name: 'Profile' }).getAttribute('aria-current')).toBe('page');
        expect(screen.getByRole('link', { name: 'Security' }).getAttribute('aria-current')).toBeNull();
    });
});

describe('AuthFrame', () => {
    it('shows the title as the page heading and the logo', () => {
        render(
            <AuthFrame title="Log in to your account" description="Enter your email">
                <p>form</p>
            </AuthFrame>,
        );

        expect(screen.getByRole('heading', { level: 1, name: 'Log in to your account' })).toBeTruthy();
        expect(screen.getAllByRole('img', { name: 'Skrüm' }).length).toBeGreaterThan(0);
    });
});

describe('OnboardingFrame', () => {
    it('renders the stepper in the header and the content in main', () => {
        render(
            <OnboardingFrame stepper={<ol aria-label="Steps" />}>
                <p>step</p>
            </OnboardingFrame>,
        );

        expect(screen.getByRole('banner').querySelector('ol')).not.toBeNull();
        expect(screen.getByRole('main').textContent).toContain('step');
    });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm run test -- frames`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write the topbar and the sub-navigation**

`resources/js/components/skrum/app-topbar.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { SidebarTrigger } from '@/components/ui/sidebar';
import type { BreadcrumbItem } from '@/types';

export function AppTopbar({
    breadcrumbs = [],
    search,
    actions,
}: {
    breadcrumbs?: BreadcrumbItem[];
    search?: ReactNode;
    actions?: ReactNode;
}) {
    return (
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4 md:px-10">
            <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
            <div className="min-w-0 flex-1">
                <Breadcrumbs breadcrumbs={breadcrumbs} />
            </div>
            {search}
            {actions}
        </header>
    );
}
```

`Breadcrumbs` is the existing component; it is restyled with the shadcn Breadcrumb in plan 18b.

`resources/js/components/skrum/sub-nav.tsx`:

```tsx
import { Link } from '@inertiajs/react';
import type { NavHref } from '@/components/skrum/app-sidebar';

export type SubNavItem = { label: string; href: NavHref; current: boolean };

export function SubNav({
    items,
    label,
}: {
    items: SubNavItem[];
    label: string;
}) {
    return (
        <nav
            aria-label={label}
            className="flex gap-1 overflow-x-auto lg:w-56 lg:shrink-0 lg:flex-col lg:overflow-visible"
        >
            {items.map((item) => (
                <Link
                    key={item.label}
                    href={item.href}
                    aria-current={item.current ? 'page' : undefined}
                    className="min-h-9 max-w-full shrink-0 truncate rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground aria-[current=page]:bg-skrum-primary-soft aria-[current=page]:text-skrum-primary-text"
                >
                    {item.label}
                </Link>
            ))}
        </nav>
    );
}
```

- [ ] **Step 4: Write the frames**

`resources/js/components/skrum/frames.tsx`:

```tsx
import type { ReactNode } from 'react';
import { AppSidebar, type AppSidebarProps } from '@/components/skrum/app-sidebar';
import { MobileTabBar } from '@/components/skrum/mobile-tab-bar';
import { SkrumLogo } from '@/components/skrum/skrum-logo';
import { SubNav, type SubNavItem } from '@/components/skrum/sub-nav';
import {
    SidebarInset,
    SidebarProvider,
    SidebarTrigger,
    useSidebar,
} from '@/components/ui/sidebar';

function TabBar({ sidebar }: { sidebar: AppSidebarProps }) {
    const { toggleSidebar } = useSidebar();

    return (
        <MobileTabBar
            active={sidebar.active}
            links={sidebar.links}
            onMore={toggleSidebar}
        />
    );
}

export function AppFrame({
    sidebar,
    defaultOpen = true,
    topbar,
    children,
}: {
    sidebar: AppSidebarProps;
    defaultOpen?: boolean;
    topbar: ReactNode;
    children: ReactNode;
}) {
    return (
        <SidebarProvider defaultOpen={defaultOpen}>
            <AppSidebar {...sidebar} />
            <SidebarInset className="min-w-0 overflow-x-clip pb-14 md:pb-0">
                {topbar}
                <main className="mx-auto w-full max-w-page flex-1 px-4 py-6 md:px-10">
                    {children}
                </main>
            </SidebarInset>
            <TabBar sidebar={sidebar} />
        </SidebarProvider>
    );
}

export function SessionFrame({
    sidebar,
    title,
    phases,
    timer,
    presence,
    actions,
    children,
}: {
    sidebar: AppSidebarProps;
    title: ReactNode;
    phases?: ReactNode;
    timer?: ReactNode;
    presence?: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
}) {
    return (
        <SidebarProvider defaultOpen={false}>
            <AppSidebar {...sidebar} />
            <SidebarInset className="h-svh min-w-0 overflow-hidden bg-skrum-canvas">
                <header className="z-30 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
                    <SidebarTrigger className="-ml-1 md:hidden" />
                    <div className="min-w-0 truncate text-base font-semibold">
                        {title}
                    </div>
                    <div className="flex min-w-0 flex-1 justify-center">
                        {phases}
                    </div>
                    {timer}
                    {presence}
                    {actions}
                </header>
                <main className="relative min-h-0 flex-1">{children}</main>
            </SidebarInset>
        </SidebarProvider>
    );
}

export function SettingsFrame({
    title,
    description,
    nav,
    navLabel,
    children,
}: {
    title: string;
    description?: string;
    nav: SubNavItem[];
    navLabel: string;
    children: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-title tracking-heading">{title}</h1>
                {description && (
                    <p className="text-sm/snug text-muted-foreground">
                        {description}
                    </p>
                )}
            </div>
            <div className="flex min-w-0 flex-col gap-6 lg:flex-row lg:gap-10">
                <SubNav items={nav} label={navLabel} />
                <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
            </div>
        </div>
    );
}

export function AuthFrame({
    title,
    description,
    aside,
    headerEnd,
    children,
}: {
    title: string;
    description?: string;
    aside?: ReactNode;
    headerEnd?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="grid min-h-svh lg:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-8 p-6 md:p-10">
                <header className="flex items-center justify-between gap-4">
                    <SkrumLogo className="h-7 w-auto" />
                    {headerEnd}
                </header>
                <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-2xl font-title tracking-heading">
                            {title}
                        </h1>
                        {description && (
                            <p className="text-sm/snug text-muted-foreground">
                                {description}
                            </p>
                        )}
                    </div>
                    {children}
                </main>
            </div>
            <aside className="bg-dotgrid hidden items-center justify-center bg-secondary p-10 lg:flex">
                {aside ?? (
                    <SkrumLogo variant="symbol" className="size-24" />
                )}
            </aside>
        </div>
    );
}

export function OnboardingFrame({
    stepper,
    headerEnd,
    aside,
    children,
}: {
    stepper?: ReactNode;
    headerEnd?: ReactNode;
    aside?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="flex min-h-svh flex-col">
            <header className="flex h-14 shrink-0 items-center gap-4 border-b px-4 md:px-10">
                <SkrumLogo className="h-6 w-auto" />
                <div className="flex min-w-0 flex-1 justify-center">
                    {stepper}
                </div>
                {headerEnd}
            </header>
            <div className="mx-auto grid w-full max-w-page flex-1 gap-10 px-4 py-10 md:px-10 lg:grid-cols-2">
                <main className="min-w-0">{children}</main>
                {aside && <aside className="hidden min-w-0 lg:block">{aside}</aside>}
            </div>
        </div>
    );
}
```

`.bg-dotgrid` sets its own background colour (`skrum-canvas`); on the auth aside, `bg-secondary` comes after it in the class list and wins, which gives the sage pane with dots of the mockup. If the rendered pane is not sage, set the colour with a wrapper instead of fighting the utility order, and say so in the report.

- [ ] **Step 5: Run the frame tests to see them pass**

Run: `npm run test -- frames`
Expected: 5 passed.

- [ ] **Step 6: Write the sidebar model hook**

`resources/js/hooks/use-sidebar-model.ts`:

```ts
import { usePage } from '@inertiajs/react';
import TeamGameRoomsController from '@/actions/App/Http/Controllers/TeamGameRoomsController';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import WorkspaceActionItemsController from '@/actions/App/Http/Controllers/WorkspaceActionItemsController';
import WorkspacesController from '@/actions/App/Http/Controllers/WorkspacesController';
import WorkspaceTemplatesController from '@/actions/App/Http/Controllers/WorkspaceTemplatesController';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
import type {
    AppSidebarProps,
    NavKey,
} from '@/components/skrum/app-sidebar';
import { dashboard } from '@/routes';

function initialsOf(name: string): string {
    const words = name.trim().split(/\s+/);
    const letters =
        words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2);

    return letters.toUpperCase();
}

export function useSidebarModel(active?: NavKey): AppSidebarProps {
    const { currentWorkspace, currentTeam, teams, workspaces, actionItems } =
        usePage().props;

    const links: AppSidebarProps['links'] = {};

    if (currentWorkspace) {
        const slug = currentWorkspace.slug;

        links.actions = WorkspaceActionItemsController.index(slug);
        links.templates = WorkspaceTemplatesController.index(slug);
        links.teams = WorkspacesController.show(slug);

        if (currentTeam) {
            const team = { workspace: slug, team: currentTeam.id };
            const teamUrl = TeamsController.show.url(team);

            links.dashboard = teamUrl;
            links.sessions = `${teamUrl}#sessions`;
            links.mood = `${teamUrl}#mood`;
            links.members = `${teamUrl}#members`;
            links.games = TeamGameRoomsController.index(team);

            if (currentWorkspace.role !== 'member') {
                links.settings = TeamIntegrationsController.index(team);
            }
        }
    }

    return {
        active,
        team: currentTeam
            ? { ...currentTeam, initials: initialsOf(currentTeam.name) }
            : null,
        teams: currentWorkspace
            ? teams.map((team) => ({
                  ...team,
                  href: TeamsController.show({
                      workspace: currentWorkspace.slug,
                      team: team.id,
                  }),
              }))
            : [],
        workspace: currentWorkspace,
        workspaces: workspaces.map((workspace) => ({
            id: workspace.id,
            name: workspace.name,
            href: WorkspacesController.show(workspace.slug),
        })),
        newWorkspaceHref: WorkspacesController.create(),
        homeHref: dashboard(),
        links,
        overdueActions: actionItems?.overdueAssignedCount,
    };
}
```

Check each import against the generated files under `resources/js/actions/` (run `npm run build` first): the controller for `teams.integrations.index` and its parameter names may differ; use what Wayfinder generated. The `#sessions`, `#mood` and `#members` anchors land on the team page; the sections get those ids when the team page is rewritten in plan 18e. The "Team settings" entry points to the integrations page, the only team settings page today, and only for workspace managers, who are the only ones allowed there (`TeamPolicy::manageIntegrations`). No `admin` link is set: the admin area arrives in plan 18d.

- [ ] **Step 7: Write the five layouts**

`resources/js/layouts/skrum/app-layout.tsx`:

```tsx
import type { ReactNode } from 'react';
import { NavUser } from '@/components/nav-user';
import { NotificationBell } from '@/components/notification-bell';
import type { NavKey } from '@/components/skrum/app-sidebar';
import { AppTopbar } from '@/components/skrum/app-topbar';
import { AppFrame } from '@/components/skrum/frames';
import { usePage } from '@inertiajs/react';
import { useSidebarModel } from '@/hooks/use-sidebar-model';
import type { BreadcrumbItem } from '@/types';

export default function AppLayout({
    breadcrumbs = [],
    active,
    children,
}: {
    breadcrumbs?: BreadcrumbItem[];
    active?: NavKey;
    children: ReactNode;
}) {
    const sidebar = useSidebarModel(active);
    const { sidebarOpen } = usePage().props;

    return (
        <AppFrame
            sidebar={{ ...sidebar, footer: <NavUser /> }}
            defaultOpen={sidebarOpen}
            topbar={
                <AppTopbar
                    breadcrumbs={breadcrumbs}
                    actions={<NotificationBell />}
                />
            }
        >
            {children}
        </AppFrame>
    );
}
```

`resources/js/layouts/skrum/session-layout.tsx`:

```tsx
import type { ReactNode } from 'react';
import { NavUser } from '@/components/nav-user';
import { SessionFrame } from '@/components/skrum/frames';
import { useSidebarModel } from '@/hooks/use-sidebar-model';

export default function SessionLayout({
    title,
    phases,
    timer,
    presence,
    actions,
    children,
}: {
    title: ReactNode;
    phases?: ReactNode;
    timer?: ReactNode;
    presence?: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
}) {
    const sidebar = useSidebarModel('sessions');

    return (
        <SessionFrame
            sidebar={{ ...sidebar, footer: <NavUser /> }}
            title={title}
            phases={phases}
            timer={timer}
            presence={presence}
            actions={actions}
        >
            {children}
        </SessionFrame>
    );
}
```

A guest in a session has no workspace: `useSidebarModel` then returns no team and almost no links, and `NavUser` renders nothing. How a guest's session screen looks without a sidebar is decided with the retro screen in plan 18e.

`resources/js/layouts/skrum/settings-layout.tsx`:

```tsx
import type { ReactNode } from 'react';
import { SettingsFrame } from '@/components/skrum/frames';
import type { SubNavItem } from '@/components/skrum/sub-nav';
import { useTrans } from '@/hooks/use-trans';

export default function SettingsLayout({
    title,
    description,
    nav,
    children,
}: {
    title: string;
    description?: string;
    nav: SubNavItem[];
    children: ReactNode;
}) {
    const { t } = useTrans();

    return (
        <SettingsFrame
            title={title}
            description={description}
            nav={nav}
            navLabel={t('Settings')}
        >
            {children}
        </SettingsFrame>
    );
}
```

`resources/js/layouts/skrum/auth-layout.tsx`:

```tsx
import type { ReactNode } from 'react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { AuthFrame } from '@/components/skrum/frames';
import { useTrans } from '@/hooks/use-trans';

export default function AuthLayout({
    title = '',
    description = '',
    aside,
    children,
}: {
    title?: string;
    description?: string;
    aside?: ReactNode;
    children: ReactNode;
}) {
    const { t } = useTrans();

    return (
        <AuthFrame
            title={t(title)}
            description={t(description)}
            aside={aside}
            headerEnd={<LanguageSwitcher />}
        >
            {children}
        </AuthFrame>
    );
}
```

`t(title)` with a variable is how the current auth layout already translates page titles; `TranslationKeysTest` only scans literal calls, and the literal keys stay in the pages.

`resources/js/layouts/skrum/onboarding-layout.tsx`:

```tsx
import type { ReactNode } from 'react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { OnboardingFrame } from '@/components/skrum/frames';

export default function OnboardingLayout({
    stepper,
    aside,
    children,
}: {
    stepper?: ReactNode;
    aside?: ReactNode;
    children: ReactNode;
}) {
    return (
        <OnboardingFrame
            stepper={stepper}
            aside={aside}
            headerEnd={<LanguageSwitcher />}
        >
            {children}
        </OnboardingFrame>
    );
}
```

- [ ] **Step 8: Check and commit**

Run: `npm run build && npm run types:check && npm run check && npm run test`
Expected: all pass. No page uses the new layouts yet; `app.tsx` is unchanged.

```bash
git add resources/js/components/skrum resources/js/hooks/use-sidebar-model.ts resources/js/layouts/skrum
git commit -m "feat(shell): add the five layouts and their presentational frames"
```

---

### Task 7: `/dev/design-system` (B8)

**Files:**
- Create: `app/Http/Controllers/DesignSystemPagesController.php`, `resources/js/pages/dev/design-system.tsx`
- Modify: `routes/web.php`, `resources/js/app.tsx` (layout switch)
- Test: `tests/Feature/DesignSystemPageTest.php`

**Interfaces:**
- Consumes: the frames of Task 6, `SkrumLogo`.
- Produces: `GET /dev/design-system/{section?}`, route name `dev.designSystem.show`, Inertia component `dev/design-system` with prop `section`, one of `tokens` (default), `app`, `session`, `settings`, `auth`, `onboarding`. Later plans add sections to `DesignSystemPagesController::Sections` and to the page.

- [ ] **Step 1: Write the failing tests**

Create with `php artisan make:test --pest DesignSystemPageTest`:

```php
<?php

use Inertia\Testing\AssertableInertia;

it('shows the token section by default', function () {
    $this->get('/dev/design-system')
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('dev/design-system')
            ->where('section', 'tokens'));
});

it('shows a layout section', function (string $section) {
    $this->get("/dev/design-system/{$section}")
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page->where('section', $section));
})->with(['app', 'session', 'settings', 'auth', 'onboarding']);

it('does not know other sections', function () {
    $this->get('/dev/design-system/nope')->assertNotFound();
});

it('does not exist outside local and testing environments', function (string $path) {
    $this->app->detectEnvironment(fn (): string => 'production');

    $this->get($path)->assertNotFound();
})->with(['/dev/design-system', '/dev/design-system/app']);
```

- [ ] **Step 2: Run them to see them fail**

Run: `php artisan test --compact tests/Feature/DesignSystemPageTest.php`
Expected: all failed with 404.

- [ ] **Step 3: Controller and route**

Create with `php artisan make:controller DesignSystemPagesController --no-interaction`:

```php
<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use Inertia\Response;

class DesignSystemPagesController extends Controller
{
    /** @var array<int, string> */
    public const array Sections = ['tokens', 'app', 'session', 'settings', 'auth', 'onboarding'];

    public function show(string $section = 'tokens'): Response
    {
        abort_unless(app()->environment(['local', 'testing']), 404);
        abort_unless(in_array($section, self::Sections, true), 404);

        return Inertia::render('dev/design-system', [
            'section' => $section,
        ]);
    }
}
```

In `routes/web.php`, import the controller and add next to the other public routes (outside the `auth` group):

```php
Route::get('dev/design-system/{section?}', [DesignSystemPagesController::class, 'show'])->name('dev.designSystem.show');
```

- [ ] **Step 4: The page**

In `resources/js/app.tsx`, add a case before `default` in the `layout` switch:

```ts
            case name.startsWith('dev/'):
                return null;
```

`resources/js/pages/dev/design-system.tsx`:

```tsx
import { Head, Link } from '@inertiajs/react';
import type { CSSProperties, ReactNode } from 'react';
import type { AppSidebarProps } from '@/components/skrum/app-sidebar';
import { AppTopbar } from '@/components/skrum/app-topbar';
import {
    AppFrame,
    AuthFrame,
    OnboardingFrame,
    SessionFrame,
    SettingsFrame,
} from '@/components/skrum/frames';
import { SkrumLogo } from '@/components/skrum/skrum-logo';

type Section = 'tokens' | 'app' | 'session' | 'settings' | 'auth' | 'onboarding';

const Sections: Section[] = ['tokens', 'app', 'session', 'settings', 'auth', 'onboarding'];

const Semantic = [
    'background', 'foreground', 'card', 'popover', 'primary', 'primary-foreground',
    'secondary', 'secondary-foreground', 'muted', 'muted-foreground', 'accent',
    'destructive', 'destructive-foreground', 'border', 'input', 'ring',
    'sidebar', 'sidebar-accent', 'skrum-canvas', 'skrum-primary-soft', 'skrum-primary-text',
];
const States = ['success', 'warning', 'info'].flatMap((state) => [
    `skrum-${state}`, `skrum-${state}-foreground`, `skrum-${state}-soft`, `skrum-${state}-text`,
]);
const Columns = ['sun', 'apricot', 'coral', 'plum', 'iris', 'sky', 'lagoon', 'moss'];
const Presence = Array.from({ length: 12 }, (_, index) => index + 1);
const Roti = [1, 2, 3, 4, 5];
const Charts = [1, 2, 3, 4, 5];
const Radii = ['rounded-xs', 'rounded-sm', 'rounded-md', 'rounded-lg', 'rounded-xl', 'rounded-2xl', 'rounded-full'];
const Shadows = ['shadow-card', 'shadow-raised', 'shadow-popover', 'shadow-modal', 'shadow-drag'];
const Durations = [
    ['instant', 'duration-80'], ['fast', 'duration-140'], ['base', 'duration-220'],
    ['slow', 'duration-360'], ['flip', 'duration-520'],
];
const Type: [string, string][] = [
    ['display-2xl', 'text-6xl/16 font-bold tracking-display font-display'],
    ['display-xl', 'text-display-xl font-display'],
    ['display-lg', 'text-display-lg font-display'],
    ['heading-xl', 'text-2xl font-title tracking-heading'],
    ['heading-lg', 'text-xl font-title tracking-subheading'],
    ['heading-md', 'text-base font-semibold'],
    ['body-lg', 'text-base/relaxed'],
    ['body', 'text-sm/snug'],
    ['body-sm', 'text-body-sm'],
    ['caption', 'text-xs font-medium'],
    ['overline', 'text-overline uppercase'],
    ['mono', 'font-mono text-body-sm font-medium'],
    ['timer', 'font-mono text-stat font-semibold tabular-nums'],
    ['poker-value', 'text-poker font-display'],
];

const sidebar: AppSidebarProps = {
    active: 'dashboard',
    team: { id: 'atlas', name: 'Atlas', initials: 'AT', membersCount: 8 },
    teams: [
        { id: 'atlas', name: 'Atlas', href: '/dev/design-system/app' },
        { id: 'boreal', name: 'Boréal', href: '/dev/design-system/app' },
    ],
    workspace: { id: 'nordlys', name: 'Nordlys' },
    workspaces: [{ id: 'nordlys', name: 'Nordlys', href: '/dev/design-system/app' }],
    newWorkspaceHref: '/dev/design-system/app',
    homeHref: '/dev/design-system',
    links: {
        dashboard: '/dev/design-system/app',
        sessions: '/dev/design-system/session',
        actions: '/dev/design-system/app',
        mood: '/dev/design-system/app',
        games: '/dev/design-system/app',
        members: '/dev/design-system/app',
        templates: '/dev/design-system/app',
        teams: '/dev/design-system/app',
        settings: '/dev/design-system/settings',
        admin: '/dev/design-system/settings',
    },
    overdueActions: 2,
};

function Swatch({ name, style, className }: { name: string; style?: CSSProperties; className?: string }) {
    return (
        <figure className="flex min-w-0 flex-col gap-1">
            <div className={`h-14 rounded-lg border ${className ?? ''}`} style={style} />
            <figcaption className="truncate font-mono text-xs font-medium text-muted-foreground">
                {name}
            </figcaption>
        </figure>
    );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="flex flex-col gap-3">
            <h2 className="text-xl font-title tracking-subheading">{title}</h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-3">
                {children}
            </div>
        </section>
    );
}

function Tokens() {
    const fill = (token: string): CSSProperties => ({ backgroundColor: `var(--${token})` });

    return (
        <div className="mx-auto flex max-w-page flex-col gap-10 px-4 py-10 md:px-10">
            <header className="flex flex-col gap-4">
                <SkrumLogo className="h-10 w-auto self-start" />
                <h1 className="text-display-lg font-display">Design system</h1>
                <nav aria-label="Sections" className="flex flex-wrap gap-2">
                    {Sections.map((section) => (
                        <Link
                            key={section}
                            href={`/dev/design-system/${section}`}
                            className="truncate rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
                        >
                            {section}
                        </Link>
                    ))}
                </nav>
            </header>

            <Group title="Semantic">
                {Semantic.map((token) => <Swatch key={token} name={token} style={fill(token)} />)}
            </Group>
            <Group title="States">
                {States.map((token) => <Swatch key={token} name={token} style={fill(token)} />)}
            </Group>
            <Group title="Columns">
                {Columns.map((color) => (
                    <figure key={color} className={`col-${color} flex min-w-0 flex-col gap-1`}>
                        <div className="rounded-lg border border-(--col-border) bg-(--col) p-3 text-(--col-text)">
                            <span className="text-overline uppercase">{color}</span>
                            <p className="text-sm/snug text-foreground">Card text</p>
                        </div>
                    </figure>
                ))}
            </Group>
            <Group title="Presence">
                {Presence.map((index) => (
                    <figure key={index} className="flex items-center gap-2">
                        <span
                            className="flex size-9 items-center justify-center rounded-full text-xs font-semibold"
                            style={{
                                backgroundColor: `var(--skrum-presence-${index})`,
                                color: `var(--skrum-presence-${index}-foreground)`,
                            }}
                        >
                            {index}
                        </span>
                    </figure>
                ))}
            </Group>
            <Group title="ROTI">
                {Roti.map((index) => (
                    <Swatch key={index} name={`skrum-roti-${index}`} style={fill(`skrum-roti-${index}`)} />
                ))}
            </Group>
            <Group title="Charts">
                {Charts.map((index) => <Swatch key={index} name={`chart-${index}`} style={fill(`chart-${index}`)} />)}
            </Group>
            <Group title="Radii">
                {Radii.map((radius) => <Swatch key={radius} name={radius} className={`bg-muted ${radius}`} />)}
            </Group>
            <Group title="Shadows">
                {Shadows.map((shadow) => <Swatch key={shadow} name={shadow} className={`bg-card ${shadow}`} />)}
            </Group>

            <section className="flex flex-col gap-3">
                <h2 className="text-xl font-title tracking-subheading">Durations</h2>
                <ul className="flex flex-col gap-2">
                    {Durations.map(([name, duration]) => (
                        <li key={name} className="group flex items-center gap-3">
                            <span className="w-24 shrink-0 truncate font-mono text-xs font-medium">{name}</span>
                            <span className="h-2 flex-1 rounded-full bg-muted">
                                <span
                                    className={`block h-2 w-8 rounded-full bg-primary transition-[width] ease-standard group-hover:w-full ${duration}`}
                                />
                            </span>
                        </li>
                    ))}
                </ul>
            </section>

            <section className="flex flex-col gap-3">
                <h2 className="text-xl font-title tracking-subheading">Type</h2>
                <ul className="flex flex-col gap-3">
                    {Type.map(([name, classes]) => (
                        <li key={name} className="flex min-w-0 flex-col">
                            <span className="font-mono text-xs font-medium text-muted-foreground">{name}</span>
                            <span className={`truncate ${classes}`}>Les réunions se terminent, les actions restent.</span>
                        </li>
                    ))}
                </ul>
            </section>

            <section className="flex flex-col gap-3">
                <h2 className="text-xl font-title tracking-subheading">Canvas</h2>
                <div className="bg-dotgrid h-32 rounded-xl border" />
            </section>
        </div>
    );
}

function Sample({ label }: { label: string }) {
    return (
        <div className="rounded-lg border bg-card p-6 shadow-card">
            <p className="text-sm/snug">{label}</p>
        </div>
    );
}

export default function DesignSystem({ section }: { section: Section }) {
    return (
        <>
            <Head title={`Design system · ${section}`} />
            {section === 'tokens' && <Tokens />}
            {section === 'app' && (
                <AppFrame
                    sidebar={sidebar}
                    topbar={
                        <AppTopbar
                            breadcrumbs={[
                                { title: 'Nordlys', href: '/dev/design-system/app' },
                                { title: 'Atlas', href: '/dev/design-system/app' },
                            ]}
                        />
                    }
                >
                    <Sample label="AppLayout" />
                </AppFrame>
            )}
            {section === 'session' && (
                <SessionFrame sidebar={{ ...sidebar, active: 'sessions' }} title="Rétro sprint 42">
                    <div className="p-6">
                        <Sample label="SessionLayout" />
                    </div>
                </SessionFrame>
            )}
            {section === 'settings' && (
                <AppFrame sidebar={{ ...sidebar, active: 'settings' }} topbar={<AppTopbar />}>
                    <SettingsFrame
                        title="Paramètres de l'équipe"
                        description="Membres, rituels et intégrations"
                        navLabel="Settings"
                        nav={[
                            { label: 'Général', href: '/dev/design-system/settings', current: true },
                            { label: 'Membres & rituels', href: '/dev/design-system/settings', current: false },
                            { label: 'Intégrations', href: '/dev/design-system/settings', current: false },
                            { label: 'Données & export', href: '/dev/design-system/settings', current: false },
                        ]}
                    >
                        <Sample label="SettingsLayout" />
                    </SettingsFrame>
                </AppFrame>
            )}
            {section === 'auth' && (
                <AuthFrame title="Connectez-vous à votre espace" description="Saisissez votre adresse e-mail pour continuer">
                    <Sample label="AuthLayout" />
                </AuthFrame>
            )}
            {section === 'onboarding' && (
                <OnboardingFrame aside={<Sample label="Aperçu" />}>
                    <Sample label="OnboardingLayout" />
                </OnboardingFrame>
            )}
        </>
    );
}
```

This page is a developer bench: its sample strings are not translated and do not go through `t()`. The dynamic `col-${color}` and radius or shadow classes are built from strings, which Tailwind cannot see; the full class names are present in the arrays (`Radii`, `Shadows`, `Durations`, `Type`) so they are detected, and the `.col-*` utilities are plain CSS in `app.css`. If a swatch renders unstyled after the build, add the missing class names to a `@source inline("…")` line at the end of `app.css` and say so in the report.

- [ ] **Step 5: Run the tests and look at the page**

Run: `vendor/bin/pint --dirty --format agent && php artisan test --compact tests/Feature/DesignSystemPageTest.php && npm run build && npm run types:check && npm run check`
Expected: 9 passed, build and checks pass.

Open each of the six sections in a browser, in light and dark (the Appearance setting), at desktop and 390px width. Compare the `app` section with `docs/design-system/components/Sidebar/preview.html`. Note every difference for the report.

- [ ] **Step 6: Commit**

```bash
git add app/Http/Controllers/DesignSystemPagesController.php routes/web.php resources/js/app.tsx resources/js/pages/dev tests/Feature/DesignSystemPageTest.php
git commit -m "feat(dev): add the local-only design-system bench"
```

---

### Task 8: Visual harness

**Files:**
- Create: `tests/Browser/Support/CapturesVisuals.php`, `tests/Browser/Visual/DesignSystemVisualTest.php`, `tests/visual/__screenshots__/` (generated PNG, committed)
- Modify: `tests/BrowserTestCase.php` (use the trait)

**Interfaces:**
- Produces, for every later plan:

```php
/** Visits $path in each theme, width and locale; saves a screenshot per combination; fails on horizontal overflow. */
protected function captureVisuals(string $name, string $path, ?callable $visit = null): void;
```

`$visit` receives the path and returns the page (default: `visit($path)`); a later plan passes a closure that signs in first. Screenshots are written to `tests/visual/__screenshots__/{name}-{theme}-{width}-{locale}.png` with theme `light|dark`, width `1440|390`, locale `en|fr`.

Overflow rule: an element fails when it extends past the right or left edge of the viewport and no ancestor clips or scrolls horizontally, or when the document itself scrolls horizontally. An element or ancestor with `data-overflow-ok` is exempt (a deliberate horizontal scroller).

The Pest browser plugin was not installed when this plan was written. Before writing the trait, read the plugin's page API in `vendor/pestphp/pest-plugin-browser/src` and confirm the four calls used below: `visit()` options for colour scheme and locale, `resize(int, int)`, `script(string)`, `screenshot(...)`. `resize`, `script` and `assertScript` are already used in `tests/Browser/Walkthroughs/Plan04RetroCoreTest.php`. If a name or signature differs, use the plugin's; the behaviour below is what matters.

- [ ] **Step 1: Write the test that uses the harness**

`tests/Browser/Visual/DesignSystemVisualTest.php`:

```php
<?php

it('renders the design-system bench without overflow', function (string $section) {
    $this->captureVisuals("design-system-{$section}", "/dev/design-system/{$section}");
})->with(['tokens', 'app', 'session', 'settings', 'auth', 'onboarding']);

it('catches an element wider than the viewport', function () {
    $page = visit('/dev/design-system/tokens')->resize(390, 844);

    $page->script("() => { const wide = document.createElement('div'); wide.id = 'too-wide'; wide.style.width = '60rem'; wide.style.height = '1rem'; document.body.appendChild(wide); }");

    expect($this->overflowingElements($page))->toContain('div#too-wide');
});
```

Check how `tests/Pest.php` binds `BrowserTestCase` to `tests/Browser`; the new `Visual` folder must be covered by the same `uses()`/`pest()->extend()` call. If it is bound per sub-folder, add `Browser/Visual`.

- [ ] **Step 2: Run it to see it fail**

Run: `npm run build && vendor/bin/pest tests/Browser/Visual`
Expected: FAIL, `captureVisuals` undefined.

- [ ] **Step 3: Write the trait**

`tests/Browser/Support/CapturesVisuals.php`:

```php
<?php

namespace Tests\Browser\Support;

use Illuminate\Support\Facades\File;

trait CapturesVisuals
{
    private const array VisualWidths = [1440 => 900, 390 => 844];

    private const array VisualLocales = ['en' => 'en-US', 'fr' => 'fr-FR'];

    private const string OverflowScript = <<<'JS'
        () => {
            const clips = (element) => {
                for (let node = element; node && node !== document.documentElement; node = node.parentElement) {
                    if (node.hasAttribute('data-overflow-ok')) {
                        return true;
                    }

                    if (node !== element && getComputedStyle(node).overflowX !== 'visible') {
                        return true;
                    }
                }

                return false;
            };
            const describe = (element) => element.tagName.toLowerCase()
                + (element.id ? `#${element.id}` : '')
                + (typeof element.className === 'string' && element.className ? `.${element.className.trim().split(/\s+/).slice(0, 3).join('.')}` : '');
            const width = document.documentElement.clientWidth;
            const offenders = [];

            for (const element of document.body.querySelectorAll('*')) {
                const box = element.getBoundingClientRect();

                if (box.width === 0 || box.height === 0) {
                    continue;
                }

                if ((box.right > width + 1 || box.left < -1) && !clips(element)) {
                    offenders.push(describe(element));
                }
            }

            if (document.documentElement.scrollWidth > width + 1) {
                offenders.push('document');
            }

            return JSON.stringify([...new Set(offenders)].slice(0, 20));
        }
        JS;

    /**
     * @return array<int, string>
     */
    protected function overflowingElements(mixed $page): array
    {
        return json_decode((string) $page->script(self::OverflowScript), true, flags: JSON_THROW_ON_ERROR);
    }

    protected function captureVisuals(string $name, string $path, ?callable $visit = null): void
    {
        $directory = base_path('tests/visual/__screenshots__');

        File::ensureDirectoryExists($directory);

        foreach (['light', 'dark'] as $theme) {
            foreach (self::VisualLocales as $locale => $browserLocale) {
                foreach (self::VisualWidths as $width => $height) {
                    $page = $visit === null
                        ? $this->visualPage($path, $theme, $browserLocale)
                        : $visit($path, $theme, $browserLocale);

                    $page->resize($width, $height);
                    $page->script('() => document.fonts.ready.then(() => true)');

                    $label = "{$name}-{$theme}-{$width}-{$locale}";

                    expect($this->overflowingElements($page))->toBe([], "Horizontal overflow in {$label}");

                    $this->saveVisual($page, "{$directory}/{$label}.png");
                }
            }
        }
    }

    private function visualPage(string $path, string $theme, string $browserLocale): mixed
    {
        $page = visit($path)->withLocale($browserLocale);

        return $theme === 'dark' ? $page->inDarkMode() : $page->inLightMode();
    }

    private function saveVisual(mixed $page, string $target): void
    {
        $name = pathinfo($target, PATHINFO_FILENAME);

        $page->screenshot(fullPage: true, filename: $name);

        $saved = base_path("tests/Browser/Screenshots/{$name}.png");

        if (is_file($saved)) {
            File::move($saved, $target);
        }
    }
}
```

How theme and locale reach the page: with no `appearance` cookie the application follows `prefers-color-scheme` (inline script in `app.blade.php`), so the browser's colour scheme selects the theme. A visitor without a `locale` cookie gets the language of `Accept-Language` (`SetLocale::resolveLocale`), so the browser locale selects the language. For signed-in pages in later plans, the closure sets `users.locale` instead.

If the plugin applies colour scheme and locale only before navigation, build the page with those options first and navigate after; if `screenshot()` accepts a full path, write straight to `$target` and drop the move.

In `tests/BrowserTestCase.php`, add `use Tests\Browser\Support\CapturesVisuals;` and `use CapturesVisuals;` in the class.

- [ ] **Step 4: Run the harness**

Run: `npm run build && vendor/bin/pest tests/Browser/Visual`
Expected: 7 passed, 48 PNG files in `tests/visual/__screenshots__/`.

If a bench section overflows, fix the component (Task 5, 6 or 7), not the check. Do not add `data-overflow-ok` to pass.

- [ ] **Step 5: Look at the captures**

Open the 48 files. Check for each section: fonts are Figtree and Bricolage Grotesque (not a fallback), dark captures are dark, FR captures show French sidebar labels, the 390 captures show the tab bar and no sidebar. Compare `design-system-app-light-1440-fr.png` with `docs/design-system/components/Sidebar/preview.html`. List the differences for the report.

- [ ] **Step 6: Commit**

```bash
git add tests/Browser/Support/CapturesVisuals.php tests/Browser/Visual tests/BrowserTestCase.php tests/visual
git commit -m "test(visual): capture the design-system bench in both themes, widths and languages, and fail on overflow"
```

---

### Task 9: Remove the dead starter files

**Files:**
- Delete: `resources/js/components/app-header.tsx`, `resources/js/components/nav-footer.tsx`, `resources/js/components/ui/icon.tsx`, `resources/js/components/ui/placeholder-pattern.tsx`, `resources/js/components/ui/navigation-menu.tsx`, `resources/js/layouts/app/app-header-layout.tsx`, `resources/js/layouts/auth/auth-card-layout.tsx`, `resources/js/layouts/auth/auth-split-layout.tsx`
- Modify: `package.json`

- [ ] **Step 1: Prove each file is unreachable**

For each of the eight files, search its import path:

```bash
for name in components/app-header components/nav-footer components/ui/icon components/ui/placeholder-pattern components/ui/navigation-menu layouts/app/app-header-layout layouts/auth/auth-card-layout layouts/auth/auth-split-layout; do
    echo "== $name"; grep -rn "@/$name'" resources/js | grep -v "^resources/js/$name"
done
```

Expected: the only importers are other files of this list (`app-header-layout` imports `app-header`, `app-header` imports `ui/icon` and `ui/navigation-menu`, `nav-footer` imports `ui/icon`). If any other file imports one of them, leave that file and its dependencies in place and report it.

- [ ] **Step 2: Delete and drop the orphan dependency**

```bash
git rm resources/js/components/app-header.tsx resources/js/components/nav-footer.tsx resources/js/components/ui/icon.tsx resources/js/components/ui/placeholder-pattern.tsx resources/js/components/ui/navigation-menu.tsx resources/js/layouts/app/app-header-layout.tsx resources/js/layouts/auth/auth-card-layout.tsx resources/js/layouts/auth/auth-split-layout.tsx
grep -rn "react-navigation-menu" resources/js || npm uninstall @radix-ui/react-navigation-menu
```

- [ ] **Step 3: Verify and commit**

Run: `npm run build && npm run types:check && npm run check && npm run test`
Expected: all pass.

```bash
git add -A resources/js package.json package-lock.json
git commit -m "chore: remove the unreachable starter-kit header, layouts and UI files"
```

---

### Task 10: Phase verification and report

**Files:** none.

- [ ] **Step 1: Run everything**

```bash
npm run build && npx tsc --noEmit && npm run check && npm run test
vendor/bin/pint --dirty --format agent
php artisan test --compact
composer test:browser
```

Expected: all pass. Paste the summary line of each command into the report.

- [ ] **Step 2: Check the rules on the new files**

```bash
grep -rnE "bg-(red|blue|gray|zinc|neutral|slate)-|text-white|text-black|-\[[0-9.]+(px|rem)\]|#[0-9a-fA-F]{3,8}\b" resources/js/components/skrum resources/js/layouts/skrum resources/js/pages/dev resources/js/hooks/use-sidebar-model.ts
grep -rn "sk-" resources/js/components/skrum resources/js/layouts/skrum resources/js/pages/dev
```

Expected: no output from either.

- [ ] **Step 3: Write the phase report for the product owner**

In the conversation, not in a file. Sections: what is done; gaps with the mockups and why (from Task 7 Step 5 and Task 8 Step 5); old features verified (the browser suite result, and that no old page changed layout); code deleted (Task 9 list, Instrument Sans, Laravel favicon files); missing tokens or components; next step (plan 18b).

---

## Appendix A: Translation keys

Keys already present in the four files and reused: `Dashboard`, `Actions`, `Games`, `Members`, `Templates`, `All teams`, `Teams`, `Team`, `Home`, `Settings`, `New workspace`, `Select a workspace`, `:count overdue`. Check each with `grep -n '"<key>"' lang/en.json` before adding; add only the missing ones.

| Key (`en`) | `fr` | `de` | `es` |
|---|---|---|---|
| `Sessions` | `Sessions` | `Sitzungen` | `Sesiones` |
| `Mood & ROTI` | `Moral & ROTI` | `Stimmung & ROTI` | `Ánimo y ROTI` |
| `Mood` | `Moral` | `Stimmung` | `Ánimo` |
| `More` | `Plus` | `Mehr` | `Más` |
| `Workspace` | `Espace de travail` | `Arbeitsbereich` | `Espacio de trabajo` |
| `Workspaces` | `Espaces de travail` | `Arbeitsbereiche` | `Espacios de trabajo` |
| `Team settings` | `Paramètres de l'équipe` | `Team-Einstellungen` | `Ajustes del equipo` |
| `Administration` | `Administration` | `Administration` | `Administración` |
| `Navigation` | `Navigation` | `Navigation` | `Navegación` |
| `:count members` | `:count membres` | `:count Mitglieder` | `:count miembros` |

The lang files are sorted or grouped in an existing order; insert each key where that order puts it.
