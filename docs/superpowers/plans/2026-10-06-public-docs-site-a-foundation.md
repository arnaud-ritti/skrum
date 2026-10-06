# Public site — A. Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The owner's standing instruction is that plans run through the Workflow tool: one agent per task, in order, each followed by a reviewer.

**Goal:** A static Astro site in `website/` with the landing page, the documentation engine (sidebar, table of contents, previous/next, related, search, light/dark), a build that fails on broken links and stray pictures, three seed pages, and the GitHub Pages workflow.

**Architecture:** `website/` is a package of its own. Pages are Markdown files in an Astro content collection; one catch-all route renders them inside a hand-built layout. Styling is plain CSS copied from the design system (tokens, `sk-*` preview classes, the landing mockup's `scr-*` rules). Two small plain-JavaScript modules hold the only logic (`src/docs.mjs`, `scripts/check.mjs`) and are tested with `node --test`.

**Tech Stack:** Astro 7, Pagefind 1.5 (Component UI), `@lucide/astro`, `@fontsource-variable/*`, Node 22 (`node:test`, `node:fs`), GitHub Actions (`upload-pages-artifact`, `deploy-pages`).

**Spec:** `docs/superpowers/specs/2026-10-06-public-docs-site-design.md` (§5.1 to §5.5, §5.7, §9 criteria 1 to 8, 15, 16, 17).

## Global Constraints

- Work in the worktree `.claude/worktrees/public-docs-site`, branch `public-docs-site`. Never `cd` to the main checkout.
- Paths are relative to the repository root. A step that says "in `website/`" runs its commands there, and its `src/…` paths are under `website/`.
- New dependencies: exactly `astro`, `sharp`, `pagefind`, `@lucide/astro`, `@fontsource-variable/figtree`, `@fontsource-variable/bricolage-grotesque`, `@fontsource-variable/jetbrains-mono`, all `devDependencies` of `website/package.json`. Nothing is added to the root `package.json` or to `composer.json`.
- Node 22.12 or later. No UI framework, no Tailwind, no MDX, no Markdown plugin.
- English only. The brand is written "Skrüm" in sentences and `skrum` in addresses, commands and file names.
- Sentence case in titles; "you"; no decorative emoji.
- No plan or ticket identifier in any file, test name or commit subject (no "Task 3", "A.2", "P24").
- The landing shows no pricing, trial, hosted offer, EU hosting, SAML, SCIM or Helm (spec §5.4).
- Every commit message ends with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Nothing is pushed.

## Review Focus

1. A Markdown link written from the site root (`/docs/x/`) works on a root domain and breaks under `/skrum/`. Expected: the build fails and names the link. Pinned by `linkProblems` test "a link that leaves the base" (Task 3).
2. A `#fragment` that does not match the id Astro gave the heading (punctuation, accents, a renamed heading). Expected: the build fails. Pinned by test "a fragment that names no id" (Task 3).
3. A link without its trailing slash (`../voting`). GitHub Pages would redirect it, the checker must not accept it silently. Pinned by test "a link without its trailing slash" (Task 3).
4. A browser that refuses `localStorage` (private mode with storage blocked) or has no clipboard API. Expected: the page renders in the system's theme, the copy button does nothing harmful, no script error stops the rest. Guarded by `try`/`catch` in both inline scripts; checked by hand in Task 2 step 9 and Task 4 step 5.
5. A long command or a wide table on a 390 px screen. Expected: the block scrolls inside itself, the page never scrolls sideways. Checked by hand on the install page in Task 3 step 9 and on the landing in Task 4 step 5.

---

## File structure

| File | Responsibility |
|---|---|
| `website/package.json`, `.npmrc`, `.gitignore`, `tsconfig.json` | the package |
| `website/site.mjs` | the one address of the site; read by the Astro config and by the checker |
| `website/astro.config.mjs` | `site`, `base`, trailing slash, code themes |
| `website/src/nav.ts` | the 15 sections, the repository address, `href()` |
| `website/src/docs.mjs` | orders the pages and refuses a broken navigation |
| `website/src/content.config.ts` | the `docs` collection and its front matter |
| `website/src/styles/tokens.css` | design tokens (copied) |
| `website/src/styles/sk.css` | `sk-*` component classes (copied) |
| `website/src/styles/site.css` | landing rules (copied), responsive rules, documentation chrome |
| `website/src/layouts/Base.astro` | `<html>`, fonts, styles, theme script, search assets |
| `website/src/layouts/Docs.astro` | sidebar, article, table of contents, related, previous/next |
| `website/src/components/Header.astro`, `ThemeToggle.astro`, `Logo.astro`, `GitHubMark.astro` | the header and its parts |
| `website/src/pages/index.astro` | the landing |
| `website/src/pages/404.astro` | not found |
| `website/src/pages/docs/index.astro` | the list of sections and pages |
| `website/src/pages/docs/[...slug].astro` | one page of documentation |
| `website/src/snippets/install.sh` | the install commands, checked against `README.md` |
| `website/scripts/check.mjs` | the build's checks, and the on-demand outbound link check |
| `website/tests/docs.test.mjs`, `check.test.mjs` | `node --test` |
| `website/src/content/docs/**` | three seed pages |
| `.github/workflows/docs.yml` | build and deploy |
| `.dockerignore`, `.gitattributes`, `vite.config.ts`, `README.md` | one line each |

---

### Task 1: The package, the tokens and a first page that builds

**Files:**
- Create: `website/package.json`, `website/.npmrc`, `website/.gitignore`, `website/tsconfig.json`, `website/site.mjs`, `website/astro.config.mjs`
- Create: `website/src/nav.ts`, `website/src/styles/tokens.css`, `website/src/styles/sk.css`, `website/src/styles/site.css`
- Create: `website/src/layouts/Base.astro`, `website/src/pages/index.astro`, `website/public/favicon.svg`

**Interfaces:**
- Produces: `website/site.mjs` exports `url: URL`. `src/nav.ts` exports `sections: readonly { id: string; label: string }[]`, `repository: string`, `href(path: string): string` (`href('/docs/')` → `/skrum/docs/`). `Base.astro` takes props `title: string`, `description: string` and one default slot placed in `<body>`.

- [ ] **Step 1: Create the package files**

`website/package.json`:

```json
{
    "name": "skrum-website",
    "private": true,
    "type": "module",
    "engines": {
        "node": ">=22.12"
    },
    "scripts": {
        "dev": "astro dev",
        "build": "astro build",
        "preview": "astro preview",
        "test": "node --test tests/"
    }
}
```

`website/.npmrc`:

```
ignore-scripts=true
```

`website/.gitignore`:

```
node_modules
dist
.astro
```

`website/tsconfig.json`:

```json
{
    "extends": "astro/tsconfigs/strict",
    "include": [".astro/types.d.ts", "**/*"],
    "exclude": ["dist"]
}
```

`website/site.mjs`:

```js
export const url = new URL(process.env.SITE_URL ?? 'https://arnaud-ritti.github.io/skrum/');
```

`website/astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import { url } from './site.mjs';

export default defineConfig({
    site: url.origin,
    base: url.pathname,
    trailingSlash: 'always',
    markdown: {
        shikiConfig: {
            themes: { light: 'github-light', dark: 'github-dark' },
        },
    },
});
```

- [ ] **Step 2: Install the seven dependencies**

Run in `website/`:

```bash
ASTRO_TELEMETRY_DISABLED=1 npm install --save-dev astro@^7.3 sharp pagefind @lucide/astro @fontsource-variable/figtree @fontsource-variable/bricolage-grotesque @fontsource-variable/jetbrains-mono
```

Expected: `package-lock.json` is created; `npm ls --depth=0` lists exactly those seven packages. If `npm install` reports that `sharp` or `pagefind` needs an install script, stop and report: the spec lists this as not verified (§14).

- [ ] **Step 3: Copy the tokens**

Run in `website/`:

```bash
mkdir -p src/styles public
sed -n '205,440p' ../docs/design-system/app.css > src/styles/tokens.css
cp ../public/brand/skrum-favicon.svg public/favicon.svg
```

Check that the copy starts with `:root {` and ends with the `}` that closes `.dark`:

```bash
head -1 src/styles/tokens.css; tail -1 src/styles/tokens.css; grep -c '^\.dark {' src/styles/tokens.css
```

Expected: `:root {`, `}`, `1`. If the line numbers have moved, take instead the two blocks that start at `^:root {` and `^\.dark {` and end at their closing `^}`.

Then append to `src/styles/tokens.css` the variables that the design system defines only for Tailwind (`@theme` in `docs/design-system/app.css`) or in `docs/design-system/tokens.json`:

```css

:root {
    --font-sans: "Figtree Variable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    --font-display: "Bricolage Grotesque Variable", "Figtree Variable", ui-sans-serif, system-ui, sans-serif;
    --font-mono: "JetBrains Mono Variable", ui-monospace, "SF Mono", Menlo, monospace;

    --radius-xs: calc(var(--radius) - 0.375rem);
    --radius-sm: calc(var(--radius) - 0.25rem);
    --radius-md: calc(var(--radius) - 0.125rem);
    --radius-xl: calc(var(--radius) + 0.25rem);
    --radius-2xl: calc(var(--radius) + 0.625rem);

    --ease-standard: cubic-bezier(0.2, 0, 0, 1);
    --ease-enter: cubic-bezier(0.05, 0.7, 0.1, 1);
    --ease-exit: cubic-bezier(0.3, 0, 0.8, 0.15);
    --ease-flip: cubic-bezier(0.45, 0, 0.2, 1);
    --ease-spring: cubic-bezier(0.34, 1.4, 0.64, 1);

    --space-0-5: 0.125rem;
    --space-1: 0.25rem;
    --space-1-5: 0.375rem;
    --space-2: 0.5rem;
    --space-3: 0.75rem;
    --space-4: 1rem;
    --space-5: 1.25rem;
    --space-6: 1.5rem;
    --space-8: 2rem;
    --space-10: 2.5rem;
    --space-12: 3rem;
    --space-16: 4rem;
    --space-24: 6rem;

    --container-max: 75rem;
    --sidebar-width: 16rem;
    --sidebar-width-icon: 3rem;
    --column-width: 18.75rem;
    --topbar-height: 3.5rem;
}
```

- [ ] **Step 4: Copy the component classes and the landing rules**

Run in `website/`:

```bash
sed -e '/^@import url("https:\/\/fonts\.googleapis\.com/d' -e '/^\.sk-desktop {/d' ../docs/design-system/components/_preview-bundle.css > src/styles/sk.css
sed -n '/^<style>$/,/^<\/style>/p' ../docs/design-system/components/ScreenLanding/preview.html \
  | sed -e '1d' -e '$d' \
        -e 's/^  \.scr-nav a {/  .site-nav-links a, .site-menu-panel a {/' \
        -e '/^  \.scr-plans\{0,1\}[ .]/d' -e '/^  \.scr-price /d' -e '/^  \.scr-feats[ .]/d' -e '/^  \.scr-selfband /d' \
  > src/styles/site.css
grep -c 'googleapis' src/styles/sk.css; grep -c 'scr-plan\|scr-price\|scr-feats\|scr-selfband\|scr-nav a' src/styles/site.css; grep -c '^  \.scr-' src/styles/site.css
```

Expected: `0`, `0`, and `40` lines of `scr-` rules. If the last `sed` leaves a pricing rule, delete that line by hand: the pricing section is not rendered.

Append to `src/styles/site.css`:

```css

html { scroll-behavior: smooth; scroll-padding-top: var(--space-6); }
a.sk-btn { text-decoration: none; }
.scr-in { width: min(var(--container-max), 100% - 2rem); }
.site-brand { color: var(--foreground); text-decoration: none; }
```

- [ ] **Step 5: List the variables nothing defines**

Run in `website/`:

```bash
node -e '
const fs = require("node:fs");
const css = ["tokens", "sk", "site"].map((name) => fs.readFileSync(`src/styles/${name}.css`, "utf8")).join("\n");
const defined = new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]));
const used = new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((match) => match[1]));
console.log([...used].filter((name) => !defined.has(name)).sort().join(" "));'
```

Expected: `--dx --dy --lock --lock-fg --rot --typing` (set per element by the mockups, each read with a fallback or unused here). Any other name is a token that step 3 missed: find its value in `docs/design-system/app.css` or `tokens.json`, add it to the appended `:root` block, run again.

- [ ] **Step 6: Write `src/nav.ts`**

```ts
export const sections = [
    { id: 'getting-started', label: 'Getting started' },
    { id: 'accounts', label: 'Accounts' },
    { id: 'teams', label: 'Workspaces and teams' },
    { id: 'retrospectives', label: 'Retrospectives' },
    { id: 'action-items', label: 'Action items' },
    { id: 'planning-poker', label: 'Planning poker' },
    { id: 'whiteboard', label: 'Whiteboard' },
    { id: 'surveys', label: 'Surveys' },
    { id: 'games', label: 'Games' },
    { id: 'insights', label: 'Team insights' },
    { id: 'integrations', label: 'Integrations' },
    { id: 'mcp', label: 'AI assistants' },
    { id: 'self-hosting', label: 'Self-hosting' },
    { id: 'administration', label: 'Administration' },
    { id: 'reference', label: 'Reference' },
] as const;

export const repository = 'https://github.com/arnaud-ritti/skrum';

export function href(path: string): string {
    return import.meta.env.BASE_URL.replace(/\/$/, '') + path;
}
```

- [ ] **Step 7: Write `src/layouts/Base.astro`**

```astro
---
import '@fontsource-variable/figtree';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/jetbrains-mono';
import '../styles/tokens.css';
import '../styles/sk.css';
import '../styles/site.css';
import { href } from '../nav';

interface Props {
    title: string;
    description: string;
}

const { title, description } = Astro.props;
---

<!doctype html>
<html lang="en">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="icon" type="image/svg+xml" href={href('/favicon.svg')} />
        <script is:inline>
            (() => {
                let stored = null;

                try {
                    stored = localStorage.getItem('theme');
                } catch {}

                const dark = stored === null ? matchMedia('(prefers-color-scheme: dark)').matches : stored === 'dark';

                document.documentElement.classList.toggle('dark', dark);
            })();
        </script>
    </head>
    <body>
        <slot />
    </body>
</html>
```

- [ ] **Step 8: Write a first `src/pages/index.astro` that exercises tokens, classes, fonts and an icon**

```astro
---
import { Check } from '@lucide/astro';
import Base from '../layouts/Base.astro';
import { href } from '../nav';
---

<Base title="Skrüm" description="Retrospectives, planning poker, whiteboard, icebreakers and surveys in one self-hosted tool.">
    <main class="scr-in scr-hero">
        <h1 class="scr-d2">Meetings end,<br /><em>actions remain.</em></h1>
        <a class="sk-btn sk-btn--lg" href={href('/docs/')}><Check class="lucide" />Documentation</a>
    </main>
</Base>
```

- [ ] **Step 9: Build and read the output**

Run in `website/`:

```bash
ASTRO_TELEMETRY_DISABLED=1 npm run build
grep -o 'href="[^"]*"' dist/index.html | sort -u
grep -o '<svg[^>]*class="[^"]*"' dist/index.html
ls dist/_astro | head
```

Expected: the build exits 0; every `href` starts with `/skrum/`; the `<svg>` carries the class `lucide`; `dist/_astro` holds one CSS file and `woff2` fonts. If `<Check class="lucide" />` did not put the class on the `<svg>`, stop and report how `@lucide/astro` takes classes: every later task writes icons this way.

Then prove the address is one constant:

```bash
SITE_URL=https://docs.example.org/ ASTRO_TELEMETRY_DISABLED=1 npm run build && grep -rc '/skrum/' dist | grep -v ':0$' ; echo "exit $?"
```

Expected: no file listed, `exit 1` (grep found nothing). Rebuild without `SITE_URL` afterwards.

- [ ] **Step 10: Look at it**

Run `npm run preview` in `website/`, open `http://localhost:4321/skrum/`. Expected: the title in Bricolage Grotesque with its second line in terracotta, a terracotta button with a check icon, on the warm off-white background. Stop the server.

- [ ] **Step 11: Commit**

```bash
git add website
git commit -m "feat(website): an Astro package with the design system's tokens and component classes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: The documentation engine

**Files:**
- Create: `website/src/docs.mjs`, `website/tests/docs.test.mjs`
- Create: `website/src/content.config.ts`
- Create: `website/src/components/Logo.astro`, `GitHubMark.astro`, `ThemeToggle.astro`, `Header.astro`
- Create: `website/src/layouts/Docs.astro`
- Create: `website/src/pages/docs/[...slug].astro`, `website/src/pages/docs/index.astro`, `website/src/pages/404.astro`
- Create: `website/src/content/docs/getting-started/introduction.md` (a stub replaced in Task 3)
- Modify: `website/src/layouts/Base.astro` (search assets), `website/src/styles/site.css` (chrome), `website/package.json` (build script)

**Interfaces:**
- Consumes: `sections`, `repository`, `href()` from `src/nav.ts`; `Base.astro`.
- Produces: `orderPages(pages, sections)` from `src/docs.mjs`: takes the collection entries (`{ id: string, data: { title, description, order, related? } }[]`) and the sections, returns the entries sorted by section then `order`, and throws an `Error` naming the file for a page outside a section, two pages of a section with the same `order`, or a `related` id that names no page. A page's id is `<section>/<slug>`; its address is `href('/docs/<section>/<slug>/')`. `Header.astro` takes no props.

- [ ] **Step 1: Write the failing test**

`website/tests/docs.test.mjs`:

```js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { orderPages } from '../src/docs.mjs';

const sections = [{ id: 'retrospectives' }, { id: 'planning-poker' }];
const page = (id, order, related) => ({ id, data: { title: id, description: id, order, related } });

test('orders pages by section, then by order', () => {
    const ordered = orderPages(
        [page('planning-poker/decks', 1), page('retrospectives/voting', 2), page('retrospectives/writing', 1)],
        sections,
    );

    assert.deepEqual(
        ordered.map((entry) => entry.id),
        ['retrospectives/writing', 'retrospectives/voting', 'planning-poker/decks'],
    );
});

test('refuses a page whose folder is not a section', () => {
    assert.throws(() => orderPages([page('billing/plans', 1)], sections), /src\/content\/docs\/billing\/plans\.md is not in a section folder/);
});

test('refuses a page nested below a section', () => {
    assert.throws(() => orderPages([page('retrospectives/phases/voting', 1)], sections), /is not in a section folder/);
});

test('refuses two pages of a section with the same order', () => {
    assert.throws(
        () => orderPages([page('retrospectives/writing', 1), page('retrospectives/voting', 1)], sections),
        /retrospectives\/voting\.md and src\/content\/docs\/retrospectives\/writing\.md both have order 1/,
    );
});

test('accepts the same order in two sections', () => {
    assert.equal(orderPages([page('retrospectives/writing', 1), page('planning-poker/decks', 1)], sections).length, 2);
});

test('refuses a related id that names no page', () => {
    assert.throws(
        () => orderPages([page('retrospectives/writing', 1, ['retrospectives/votin'])], sections),
        /retrospectives\/writing\.md: related "retrospectives\/votin" names no page/,
    );
});

test('accepts a related id that names a page', () => {
    assert.equal(orderPages([page('retrospectives/writing', 1, ['planning-poker/decks']), page('planning-poker/decks', 1)], sections).length, 2);
});
```

- [ ] **Step 2: Run it to see it fail**

Run in `website/`: `npm test`
Expected: FAIL, `Cannot find module '.../src/docs.mjs'`.

- [ ] **Step 3: Write `src/docs.mjs`**

```js
/**
 * @template {{ id: string, data: { order: number, related?: string[] } }} Page
 * @param {Page[]} pages
 * @param {ReadonlyArray<{ id: string }>} sections
 * @returns {Page[]}
 */
export function orderPages(pages, sections) {
    const sectionIds = sections.map((section) => section.id);
    const file = (id) => `src/content/docs/${id}.md`;
    const places = new Map();

    for (const page of pages) {
        const [section, ...rest] = page.id.split('/');

        if (!sectionIds.includes(section) || rest.length !== 1) {
            throw new Error(`${file(page.id)} is not in a section folder (sections: ${sectionIds.join(', ')}).`);
        }

        const place = `${section}#${page.data.order}`;

        if (places.has(place)) {
            throw new Error(`${file(page.id)} and ${file(places.get(place))} both have order ${page.data.order}.`);
        }

        places.set(place, page.id);
    }

    const ids = new Set(pages.map((page) => page.id));

    for (const page of pages) {
        for (const related of page.data.related ?? []) {
            if (!ids.has(related)) {
                throw new Error(`${file(page.id)}: related "${related}" names no page.`);
            }
        }
    }

    const sectionOf = (page) => sectionIds.indexOf(page.id.split('/')[0]);

    return [...pages].sort((a, b) => sectionOf(a) - sectionOf(b) || a.data.order - b.data.order);
}
```

- [ ] **Step 4: Run the test to see it pass**

Run in `website/`: `npm test`
Expected: 7 tests pass.

- [ ] **Step 5: Write the collection and a stub page**

`website/src/content.config.ts`:

```ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const docs = defineCollection({
    loader: glob({ pattern: '**/*.md', base: './src/content/docs' }),
    schema: z
        .object({
            title: z.string().min(1),
            description: z.string().min(1),
            order: z.number().int().positive(),
            related: z.array(z.string()).optional(),
        })
        .strict(),
});

export const collections = { docs };
```

`website/src/content/docs/getting-started/introduction.md`:

```markdown
---
title: Introduction
description: What Skrüm is and where to start.
order: 1
---

## What Skrüm is

Skrüm is an open-source, self-hosted tool for a team's agile rituals.

## Where to start

This page is completed with the rest of the documentation.
```

- [ ] **Step 6: Write the header's parts**

`website/src/components/Logo.astro`:

```astro
---
interface Props {
    size?: number;
}

const { size = 28 } = Astro.props;
---

<svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
    <path d="M14 0 H50 A14 14 0 0 1 64 14 V46 L46 64 H14 A14 14 0 0 1 0 50 V14 A14 14 0 0 1 14 0 Z" style="fill:var(--primary)"></path>
    <path d="M64 46 L50 46 A4 4 0 0 0 46 50 L46 64 Z" style="fill:color-mix(in oklch, var(--primary) 70%, var(--foreground))"></path>
    <path d="M19 27 L19 38 C19 45 24 49.5 30 49.5 C36 49.5 41 45 41 38 L41 27" fill="none" style="stroke:var(--primary-foreground)" stroke-width="7" stroke-linecap="round"></path>
    <circle cx="21.5" cy="15.5" r="4.5" style="fill:var(--primary-foreground)"></circle>
    <circle cx="38.5" cy="15.5" r="4.5" style="fill:var(--primary-foreground)"></circle>
</svg>
```

`website/src/components/GitHubMark.astro`:

```astro
<svg class="lucide" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"></path>
</svg>
```

`website/src/components/ThemeToggle.astro`:

```astro
---
import { Moon, Sun } from '@lucide/astro';
---

<button class="sk-btn sk-btn--ghost sk-btn--icon theme-toggle" type="button" aria-label="Switch between the light and the dark theme">
    <Sun class="lucide theme-toggle-sun" /><Moon class="lucide theme-toggle-moon" />
</button>
<script is:inline>
    document.querySelector('.theme-toggle').addEventListener('click', () => {
        const dark = document.documentElement.classList.toggle('dark');

        try {
            localStorage.setItem('theme', dark ? 'dark' : 'light');
        } catch {}
    });
</script>
```

`website/src/components/Header.astro`:

```astro
---
import { Menu } from '@lucide/astro';
import GitHubMark from './GitHubMark.astro';
import Logo from './Logo.astro';
import ThemeToggle from './ThemeToggle.astro';
import { href, repository } from '../nav';

const links = [
    { label: 'Features', path: '/#features' },
    { label: 'Self-host', path: '/#self-host' },
    { label: 'Documentation', path: '/docs/' },
];
---

<header class="scr-in scr-nav">
    <a class="sk-row sk-gap-2 site-brand" href={href('/')} aria-label="Skrüm, home"><Logo /><span class="scr-word">skrüm</span></a>
    <nav class="site-nav-links" aria-label="Site">
        {links.map((link) => <a href={href(link.path)}>{link.label}</a>)}
    </nav>
    <span class="sk-grow"></span>
    <pagefind-modal-trigger></pagefind-modal-trigger>
    <a class="sk-btn sk-btn--ghost site-nav-github" href={repository}><GitHubMark />GitHub</a>
    <ThemeToggle />
    <a class="sk-btn site-nav-cta" href={href('/docs/self-hosting/install/')}>Get started</a>
    <details class="site-menu">
        <summary class="sk-btn sk-btn--ghost sk-btn--icon" aria-label="Menu"><Menu class="lucide" /></summary>
        <nav class="sk-card site-menu-panel" aria-label="Site">
            {links.map((link) => <a href={href(link.path)}>{link.label}</a>)}
            <a href={repository}>GitHub</a>
        </nav>
    </details>
</header>
<pagefind-config bundle-path={href('/pagefind/')} base-url={href('/')}></pagefind-config>
<pagefind-modal></pagefind-modal>
```

`/docs/self-hosting/install/` does not exist until Task 3; until then the link is dead, and Task 3's checker is what will watch it.

- [ ] **Step 7: Load the search assets in `Base.astro`**

In `website/src/layouts/Base.astro`, after the `<link rel="icon" …>` line, add:

```astro
        <link rel="stylesheet" href={href('/pagefind/pagefind-component-ui.css')} />
        <script is:inline type="module" src={href('/pagefind/pagefind-component-ui.js')}></script>
```

In `website/package.json`, change the build script to:

```json
        "build": "astro build && pagefind --site dist",
```

`astro dev` has no `pagefind/` folder: the two requests answer 404 there and the trigger renders nothing. Search is checked on a build.

- [ ] **Step 8: Write the layout, the three pages and the chrome**

`website/src/layouts/Docs.astro`:

```astro
---
import { ArrowLeft, ArrowRight } from '@lucide/astro';
import Base from './Base.astro';
import Header from '../components/Header.astro';
import { href, sections } from '../nav';

const { page, pages, previous, next, headings } = Astro.props;

const address = (entry) => href(`/docs/${entry.id}/`);
const inSection = (section) => pages.filter((entry) => entry.id.startsWith(`${section.id}/`));
const current = sections.find((section) => page.id.startsWith(`${section.id}/`));
const contents = headings.filter((heading) => heading.depth === 2 || heading.depth === 3);
const showContents = headings.filter((heading) => heading.depth === 2).length >= 2;
const related = (page.data.related ?? []).map((id) => pages.find((entry) => entry.id === id));
---

<Base title={`${page.data.title} · Skrüm documentation`} description={page.data.description}>
    <Header />
    <div class="doc-wrap">
        <div class="doc">
            <button class="sk-btn sk-btn--outline doc-menu" type="button" aria-expanded="false" aria-controls="doc-side">Menu</button>
            <nav class="doc-side" id="doc-side" aria-label="Documentation">
                {
                    sections
                        .filter((section) => inSection(section).length > 0)
                        .map((section) => (
                            <details open={section.id === current.id}>
                                <summary>{section.label}</summary>
                                <ul>
                                    {inSection(section).map((entry) => (
                                        <li>
                                            <a href={address(entry)} aria-current={entry.id === page.id ? 'page' : undefined}>
                                                {entry.data.title}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </details>
                        ))
                }
            </nav>
            <main class="doc-main">
                <article class="doc-article" data-pagefind-body>
                    <p class="scr-eyebrow">{current.label}</p>
                    <h1>{page.data.title}</h1>
                    <p class="scr-lead">{page.data.description}</p>
                    <slot />
                </article>
                {
                    related.length > 0 && (
                        <aside class="sk-card doc-related" aria-label="Related">
                            <h2>Related</h2>
                            <ul>
                                {related.map((entry) => (
                                    <li>
                                        <a href={address(entry)}>{entry.data.title}</a>
                                        <span>{entry.data.description}</span>
                                    </li>
                                ))}
                            </ul>
                        </aside>
                    )
                }
                <nav class="doc-pager" aria-label="Previous and next page">
                    {previous ? <a class="sk-card" href={address(previous)}><ArrowLeft class="lucide" /><span><small>Previous</small>{previous.data.title}</span></a> : <span />}
                    {next ? <a class="sk-card doc-pager-next" href={address(next)}><span><small>Next</small>{next.data.title}</span><ArrowRight class="lucide" /></a> : <span />}
                </nav>
            </main>
            {
                showContents && (
                    <nav class="doc-toc" aria-label="On this page">
                        <h2>On this page</h2>
                        <ul>
                            {contents.map((heading) => (
                                <li>
                                    <a class={heading.depth === 3 ? 'is-h3' : undefined} href={`#${heading.slug}`}>
                                        {heading.text}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </nav>
                )
            }
        </div>
    </div>
    <script is:inline>
        document.querySelector('.doc-menu').addEventListener('click', (event) => {
            const open = event.currentTarget.getAttribute('aria-expanded') !== 'true';

            event.currentTarget.setAttribute('aria-expanded', String(open));
            document.getElementById('doc-side').toggleAttribute('data-open', open);
        });
    </script>
</Base>
```

`website/src/pages/docs/[...slug].astro`:

```astro
---
import { getCollection, render } from 'astro:content';
import Docs from '../../layouts/Docs.astro';
import { orderPages } from '../../docs.mjs';
import { sections } from '../../nav';

export async function getStaticPaths() {
    const pages = orderPages(await getCollection('docs'), sections);

    return pages.map((page, index) => ({
        params: { slug: page.id },
        props: { page, pages, previous: pages[index - 1], next: pages[index + 1] },
    }));
}

const { page, pages, previous, next } = Astro.props;
const { Content, headings } = await render(page);
---

<Docs page={page} pages={pages} previous={previous} next={next} headings={headings}>
    <Content />
</Docs>
```

`website/src/pages/docs/index.astro`:

```astro
---
import { getCollection } from 'astro:content';
import Base from '../../layouts/Base.astro';
import Header from '../../components/Header.astro';
import { orderPages } from '../../docs.mjs';
import { href, sections } from '../../nav';

const pages = orderPages(await getCollection('docs'), sections);
---

<Base title="Documentation · Skrüm" description="Guides for the people who use Skrüm and for the people who host it.">
    <Header />
    <main class="scr-in doc-index">
        <div class="scr-sh">
            <span class="scr-eyebrow">Documentation</span>
            <h1 class="scr-d1">One task per page.</h1>
            <p class="scr-lead">Guides for the people who use Skrüm and for the people who host it.</p>
        </div>
        <div class="doc-index-grid">
            {
                sections.map((section) => (
                    <section class="sk-card doc-index-card" id={section.id}>
                        <h2>{section.label}</h2>
                        <ul>
                            {pages
                                .filter((page) => page.id.startsWith(`${section.id}/`))
                                .map((page) => (
                                    <li>
                                        <a href={href(`/docs/${page.id}/`)}>{page.data.title}</a>
                                    </li>
                                ))}
                        </ul>
                    </section>
                ))
            }
        </div>
    </main>
</Base>
```

`website/src/pages/404.astro`:

```astro
---
import Base from '../layouts/Base.astro';
import Header from '../components/Header.astro';
import { href } from '../nav';
---

<Base title="Page not found · Skrüm" description="This address leads nowhere.">
    <Header />
    <main class="scr-in scr-hero">
        <h1 class="scr-d1">This page does not exist.</h1>
        <p class="scr-lead">The address may have changed. The documentation lists every page.</p>
        <a class="sk-btn sk-btn--lg" href={href('/docs/')}>Open the documentation</a>
    </main>
</Base>
```

Append to `website/src/styles/site.css`:

```css

:root {
    --pf-text: var(--foreground);
    --pf-background: var(--popover);
    --pf-border: var(--border);
    --pf-hover: var(--accent);
    --pf-border-radius: var(--radius);
    --pf-outline-focus: var(--ring);
    --pf-font: var(--font-sans);
}

.site-nav-links { display: flex; align-items: center; gap: var(--space-6); }
.site-menu { display: none; position: relative; }
.site-menu > summary { list-style: none; }
.site-menu > summary::-webkit-details-marker { display: none; }
.site-menu-panel { position: absolute; right: 0; top: calc(100% + var(--space-2)); z-index: var(--z-overlay); display: flex; flex-direction: column; gap: var(--space-1); padding: var(--space-3) var(--space-4); min-width: 12rem; box-shadow: var(--shadow-popover); }
.theme-toggle-moon, .dark .theme-toggle-sun { display: none; }
.dark .theme-toggle-moon { display: inline; }

.doc-wrap { border-top: 1px solid var(--border); }
.doc { display: grid; grid-template-columns: 16rem minmax(0, 1fr) 14rem; gap: var(--space-10); width: min(86rem, 100% - 2rem); margin: 0 auto; padding: var(--space-8) 0 var(--space-16); align-items: start; }
.doc-menu { display: none; }
.doc-side, .doc-toc { position: sticky; top: var(--space-6); max-height: calc(100vh - 3rem); overflow-y: auto; font-size: 0.875rem; }
.doc-side summary { cursor: pointer; font-weight: 650; padding: 0.375rem 0; }
.doc-side ul, .doc-toc ul { list-style: none; margin: 0 0 var(--space-3); padding: 0; }
.doc-side a, .doc-toc a { display: block; padding: 0.3125rem 0.625rem; border-radius: var(--radius-md); color: var(--muted-foreground); text-decoration: none; }
.doc-side a:hover, .doc-toc a:hover { background: var(--accent); color: var(--accent-foreground); }
.doc-side a[aria-current="page"] { background: var(--skrum-primary-soft); color: var(--skrum-primary-text); font-weight: 600; }
.doc-toc h2 { font-size: 0.75rem; font-weight: 650; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted-foreground); margin: 0 0 var(--space-2); padding-left: 0.625rem; }
.doc-toc .is-h3 { padding-left: 1.5rem; }

.doc-article, .doc-related, .doc-pager { max-width: 46rem; }
.doc-article { font-size: 1rem; line-height: 1.625rem; }
.doc-article h1 { font-family: var(--font-display); font-size: 2.75rem; line-height: 3rem; font-weight: 700; letter-spacing: -0.025em; margin: var(--space-2) 0 var(--space-3); }
.doc-article h2 { font-size: 1.5rem; line-height: 2rem; margin: var(--space-10) 0 var(--space-3); }
.doc-article h3 { font-size: 1.25rem; line-height: 1.75rem; margin: var(--space-8) 0 var(--space-2); }
.doc-article a { color: var(--skrum-primary-text); text-underline-offset: 0.2em; }
.doc-article img { display: block; max-width: 100%; height: auto; margin: var(--space-4) 0; border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow-card); }
.doc-article code { font-family: var(--font-mono); font-size: 0.875em; padding: 0.125rem 0.375rem; border-radius: var(--radius-sm); background: var(--muted); }
.doc-article pre { padding: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius); overflow-x: auto; font-size: 0.8125rem; line-height: 1.375rem; }
.doc-article pre code { padding: 0; background: none; font-size: inherit; }
.doc-article blockquote { margin: var(--space-5) 0; padding: var(--space-3) var(--space-4); border-left: 3px solid var(--primary); border-radius: var(--radius-md); background: var(--skrum-primary-soft); }
.doc-article blockquote p { margin: 0; }
.doc-article table { display: block; width: 100%; overflow-x: auto; border-collapse: collapse; font-size: 0.875rem; }
.doc-article th, .doc-article td { padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border); text-align: left; vertical-align: top; }
.dark .astro-code, .dark .astro-code span { color: var(--shiki-dark) !important; background-color: var(--shiki-dark-bg) !important; }

.doc-related { margin-top: var(--space-10); padding: var(--space-5); }
.doc-related h2 { font-size: 0.75rem; font-weight: 650; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted-foreground); margin: 0 0 var(--space-3); }
.doc-related ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-3); }
.doc-related a { display: block; font-weight: 600; color: var(--skrum-primary-text); }
.doc-related span { font-size: 0.875rem; color: var(--muted-foreground); }
.doc-pager { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); margin-top: var(--space-8); }
.doc-pager a { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-4); color: var(--foreground); text-decoration: none; }
.doc-pager a span { display: flex; flex-direction: column; font-weight: 600; }
.doc-pager small { font-size: 0.75rem; font-weight: 500; color: var(--muted-foreground); }
.doc-pager-next { justify-content: flex-end; text-align: right; }

.doc-index { padding: var(--space-12) 0 var(--space-16); }
.doc-index-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-5); }
.doc-index-card { padding: var(--space-5); }
.doc-index-card h2 { font-size: 1rem; margin: 0 0 var(--space-2); }
.doc-index-card ul { list-style: none; margin: 0; padding: 0; font-size: 0.875rem; line-height: 1.875rem; }
.doc-index-card a { color: var(--muted-foreground); text-decoration: none; }
.doc-index-card a:hover { color: var(--skrum-primary-text); }

@media (max-width: 68rem) {
    .doc { grid-template-columns: 16rem minmax(0, 1fr); }
    .doc-toc { display: none; }
    .doc-index-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 48rem) {
    .doc { grid-template-columns: minmax(0, 1fr); gap: var(--space-4); }
    .doc-menu { display: inline-flex; justify-self: start; }
    .doc-side { display: none; position: static; max-height: none; }
    .doc-side[data-open] { display: block; }
    .doc-article h1 { font-size: 2.125rem; line-height: 2.5rem; }
    .doc-pager, .doc-index-grid { grid-template-columns: minmax(0, 1fr); }
    .scr-nav { gap: var(--space-3); }
    .site-nav-links, .site-nav-github, .site-nav-cta { display: none; }
    .site-menu { display: block; }
}
```

Run the command of Task 1 step 5 again. Expected: the six names of Task 1, plus `--shiki-dark` and `--shiki-dark-bg` (set by the highlighter on each code block). `--shadow-card`, `--shadow-popover`, `--popover`, `--accent-foreground`, `--z-overlay` must not appear: if one does, it is not in the copied tokens, so replace it by the nearest token that is and say so in the commit body.

- [ ] **Step 9: Build and try it**

Run in `website/`:

```bash
npm test && ASTRO_TELEMETRY_DISABLED=1 npm run build && ls dist/pagefind | head -3 && ls dist/docs/getting-started/introduction dist/404.html dist/docs/index.html
npm run preview
```

Open `http://localhost:4321/skrum/docs/getting-started/introduction/` and check, then stop the server:

1. Sidebar: "Getting started" open, "Introduction" marked current. "On this page" lists the two headings.
2. The search trigger opens a modal; typing "agile" lists Introduction; the result opens `/skrum/docs/getting-started/introduction/`. If the trigger does not render or the result's address lacks `/skrum/`, read `dist/pagefind/pagefind-component-ui.js` for the attribute names of `<pagefind-config>` and correct `Header.astro`; the spec lists these as not verified (§14).
3. The theme toggle switches to dark; after a reload the page is dark from its first paint (no light flash). In the browser's console run `localStorage.clear()`, set the system to dark: a reload is dark.
4. In a private window with site data blocked (Chrome: Settings → Privacy → block third-party and site data for `localhost`), the page still renders and the toggle still switches.
5. At 390 px wide: the sidebar is replaced by a "Menu" button that opens it; the header shows the logo, search, the theme toggle and the menu; nothing scrolls sideways.
6. `http://localhost:4321/skrum/nope/` shows the not-found page (the preview server serves `404.html`).

- [ ] **Step 10: Commit**

```bash
git add website
git commit -m "feat(website): documentation pages from a content collection, with sidebar, contents, search and themes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The build's checks and three seed pages

**Files:**
- Create: `website/scripts/check.mjs`, `website/tests/check.test.mjs`
- Create: `website/src/snippets/install.sh`
- Create: `website/src/content/docs/self-hosting/install.md`, `website/src/content/docs/retrospectives/create-a-retro.md`
- Modify: `website/src/content/docs/getting-started/introduction.md`, `website/package.json`

**Interfaces:**
- Consumes: `url` from `website/site.mjs`.
- Produces, from `scripts/check.mjs`:
  - `linkProblems(pages: Map<string, string>, files: Set<string>, base: string): string[]` — `pages` maps the address of each built page (`/skrum/docs/a/`) to its HTML, `files` holds every file of `dist` relative to it with forward slashes.
  - `imageProblems(markdown: Map<string, string>, pictures: Set<string>): string[]` — both keyed by path relative to `src/`.
  - `snippetProblems(snippet: string, documents: Map<string, string>): string[]`.
  - Command line: `node scripts/check.mjs` exits 1 and prints one line per problem; `node scripts/check.mjs --external` checks outbound links only.
- Rule for writers that follows from it: links between pages are relative and end with a slash (`../voting/`, `../../planning-poker/decks/`); every picture has an alternative text and lives under `src/assets/screenshots/`.

- [ ] **Step 1: Write the failing tests**

`website/tests/check.test.mjs`:

```js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { imageProblems, linkProblems, snippetProblems } from '../scripts/check.mjs';

const base = '/skrum/';
const site = (pages) => ({
    pages: new Map(Object.entries(pages)),
    files: new Set(
        Object.keys(pages)
            .map((page) => page.slice(base.length))
            .map((path) => (path === '' || path.endsWith('/') ? `${path}index.html` : path))
            .concat(['_astro/voting.abc123.webp']),
    ),
});
const problems = (pages) => {
    const built = site(pages);

    return linkProblems(built.pages, built.files, base);
};

test('accepts relative links, absolute links under the base, pictures and outbound links', () => {
    assert.deepEqual(
        problems({
            '/skrum/': '<a href="/skrum/docs/a/">a</a><a href="https://example.org/x">x</a><a href="mailto:a@example.org">m</a>',
            '/skrum/docs/a/': '<h2 id="steps">Steps</h2><a href="../b/#why">b</a><a href="#steps">s</a><img src="/skrum/_astro/voting.abc123.webp">',
            '/skrum/docs/b/': '<h2 id="why">Why</h2><a href="/skrum/">home</a>',
        }),
        [],
    );
});

test('reports a link that leaves the base', () => {
    assert.deepEqual(problems({ '/skrum/docs/a/': '<a href="/docs/b/">b</a>', '/skrum/docs/b/': '' }), [
        '/skrum/docs/a/: "/docs/b/" leaves the base /skrum/',
    ]);
});

test('reports a link to a page that does not exist', () => {
    assert.deepEqual(problems({ '/skrum/docs/a/': '<a href="../c/">c</a>' }), ['/skrum/docs/a/: "../c/" resolves to no file (docs/c/index.html)']);
});

test('reports a link without its trailing slash', () => {
    assert.deepEqual(problems({ '/skrum/docs/a/': '<a href="../b">b</a>', '/skrum/docs/b/': '' }), [
        '/skrum/docs/a/: "../b" resolves to no file (docs/b)',
    ]);
});

test('reports a fragment that names no id of its target', () => {
    assert.deepEqual(problems({ '/skrum/docs/a/': '<a href="../b/#whi">b</a>', '/skrum/docs/b/': '<h2 id="why">Why</h2>' }), [
        '/skrum/docs/a/: "../b/#whi" names no id of the target page',
    ]);
});

test('accepts a fragment whose id is written with an accent', () => {
    assert.deepEqual(problems({ '/skrum/docs/a/': '<h2 id="skrüm">Skrüm</h2><a href="#skr%C3%BCm">s</a>' }), []);
});

test('reports a picture that does not exist, one without a text, and one nobody uses', () => {
    const markdown = new Map([
        [
            'content/docs/retrospectives/voting.md',
            '![Votes on a card](../../../assets/screenshots/retrospectives/voting.png)\n![](../../../assets/screenshots/retrospectives/votes-left.png)\n![Gone](../../../assets/screenshots/retrospectives/gone.png)',
        ],
    ]);
    const pictures = new Set([
        'assets/screenshots/retrospectives/voting.png',
        'assets/screenshots/retrospectives/votes-left.png',
        'assets/screenshots/retrospectives/unused.png',
    ]);

    assert.deepEqual(imageProblems(markdown, pictures), [
        'content/docs/retrospectives/voting.md: the picture ../../../assets/screenshots/retrospectives/votes-left.png has no alternative text',
        'content/docs/retrospectives/voting.md: the picture ../../../assets/screenshots/retrospectives/gone.png does not exist',
        'assets/screenshots/retrospectives/unused.png is used by no page',
    ]);
});

test('reports a snippet line that a document does not have', () => {
    const documents = new Map([
        ['README.md', 'Run:\n\ncurl -O https://example.org/compose.yaml\ndocker compose up -d\n'],
        ['install.md', 'curl -O https://example.org/compose.yaml\n'],
    ]);

    assert.deepEqual(snippetProblems('curl -O https://example.org/compose.yaml\n\ndocker compose up -d\n', documents), [
        'install.md lacks the line "docker compose up -d" of src/snippets/install.sh',
    ]);
});
```

- [ ] **Step 2: Run them to see them fail**

Run in `website/`: `npm test`
Expected: FAIL, `Cannot find module '.../scripts/check.mjs'`.

- [ ] **Step 3: Write `scripts/check.mjs`**

```js
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { url } from '../site.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const refusesScripts = ['platform.openai.com'];

const references = (html) => [...html.matchAll(/\s(?:href|src)="([^"]*)"/g)].map((match) => match[1].replaceAll('&amp;', '&'));
const ids = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
const leavesTheSite = (reference) => /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(reference);

export function linkProblems(pages, files, base) {
    const problems = [];

    for (const [page, html] of pages) {
        for (const reference of references(html)) {
            if (leavesTheSite(reference)) {
                continue;
            }

            const target = new URL(reference, `http://site${page}`);

            if (!target.pathname.startsWith(base)) {
                problems.push(`${page}: "${reference}" leaves the base ${base}`);

                continue;
            }

            const path = decodeURIComponent(target.pathname.slice(base.length));
            const file = path === '' || path.endsWith('/') ? `${path}index.html` : path;

            if (!files.has(file)) {
                problems.push(`${page}: "${reference}" resolves to no file (${file})`);

                continue;
            }

            const targetHtml = pages.get(`${base}${path}`);

            if (target.hash !== '' && targetHtml !== undefined && !ids(targetHtml).has(decodeURIComponent(target.hash.slice(1)))) {
                problems.push(`${page}: "${reference}" names no id of the target page`);
            }
        }
    }

    return problems;
}

export function imageProblems(markdown, pictures) {
    const problems = [];
    const used = new Set();

    for (const [file, text] of markdown) {
        for (const [, alternative, reference] of text.matchAll(/!\[([^\]]*)\]\(([^)\s]+)/g)) {
            if (leavesTheSite(reference)) {
                continue;
            }

            const picture = posix.normalize(posix.join(posix.dirname(file), reference));

            if (!pictures.has(picture)) {
                problems.push(`${file}: the picture ${reference} does not exist`);

                continue;
            }

            used.add(picture);

            if (alternative.trim() === '') {
                problems.push(`${file}: the picture ${reference} has no alternative text`);
            }
        }
    }

    for (const picture of pictures) {
        if (!used.has(picture)) {
            problems.push(`${picture} is used by no page`);
        }
    }

    return problems;
}

export function snippetProblems(snippet, documents) {
    const problems = [];

    for (const line of snippet.split('\n').filter((line) => line.trim() !== '')) {
        for (const [name, text] of documents) {
            if (!text.includes(line)) {
                problems.push(`${name} lacks the line "${line}" of src/snippets/install.sh`);
            }
        }
    }

    return problems;
}

function filesOf(directory) {
    if (!existsSync(directory)) {
        return [];
    }

    return readdirSync(directory, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => relative(directory, join(entry.parentPath, entry.name)).split(sep).join('/'));
}

function builtPages(dist, base) {
    const pages = new Map();

    for (const file of filesOf(dist).filter((name) => name.endsWith('.html'))) {
        const address = file.endsWith('index.html') ? file.slice(0, -'index.html'.length) : file;

        pages.set(`${base}${address}`, readFileSync(join(dist, file), 'utf8'));
    }

    return pages;
}

async function externalProblems(pages) {
    const links = new Set();

    for (const html of pages.values()) {
        for (const reference of references(html)) {
            if (/^https?:\/\//.test(reference)) {
                links.add(reference.split('#')[0]);
            }
        }
    }

    const problems = [];

    for (const link of [...links].sort()) {
        if (refusesScripts.includes(new URL(link).hostname)) {
            console.log(`not checked, the host refuses scripts: ${link}`);

            continue;
        }

        try {
            const response = await fetch(link, {
                headers: { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36' },
                signal: AbortSignal.timeout(20_000),
            });

            if (response.status >= 400) {
                problems.push(`${link} answered ${response.status}`);
            }
        } catch (error) {
            problems.push(`${link} did not answer (${error.cause?.code ?? error.name})`);
        }
    }

    return problems;
}

async function main() {
    const dist = join(root, 'dist');
    const source = join(root, 'src');
    const base = url.pathname;
    const pages = builtPages(dist, base);
    const read = (directory, keep) => new Map(filesOf(join(source, directory)).filter(keep).map((file) => [`${directory}/${file}`, readFileSync(join(source, directory, file), 'utf8')]));

    const problems = process.argv.includes('--external')
        ? await externalProblems(pages)
        : [
              ...linkProblems(pages, new Set(filesOf(dist)), base),
              ...imageProblems(
                  read('content/docs', (file) => file.endsWith('.md')),
                  new Set(filesOf(join(source, 'assets/screenshots')).map((file) => `assets/screenshots/${file}`)),
              ),
              ...snippetProblems(
                  readFileSync(join(source, 'snippets/install.sh'), 'utf8'),
                  new Map([
                      ['README.md', readFileSync(join(root, '../README.md'), 'utf8')],
                      ['src/content/docs/self-hosting/install.md', readFileSync(join(source, 'content/docs/self-hosting/install.md'), 'utf8')],
                  ]),
              ),
          ];

    if (pages.size === 0) {
        problems.push('dist has no page: run astro build first');
    }

    for (const problem of problems) {
        console.error(problem);
    }

    process.exit(problems.length === 0 ? 0 : 1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    await main();
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run in `website/`: `npm test`
Expected: 15 tests pass (7 of Task 2, 8 here).

- [ ] **Step 5: Write the install snippet**

`website/src/snippets/install.sh` (each line is a line of `README.md`, "Run with Docker"):

```bash
curl -O https://raw.githubusercontent.com/arnaud-ritti/skrum/main/compose.production.yaml
curl -o .env https://raw.githubusercontent.com/arnaud-ritti/skrum/main/.env.production.example
docker run --rm --entrypoint php ghcr.io/arnaud-ritti/skrum:latest artisan key:generate --show
docker compose -f compose.production.yaml up -d
```

- [ ] **Step 6: Write the three seed pages**

Replace `website/src/content/docs/getting-started/introduction.md`:

```markdown
---
title: Introduction
description: What Skrüm is, what it does, and where to start.
order: 1
related:
  - self-hosting/install
  - retrospectives/create-a-retro
---

Skrüm is an open-source tool for a team's agile rituals. You host it yourself: one Docker image and a database, and your data stays on your infrastructure. It is released under the AGPL-3.0-or-later licence.

## What Skrüm does

- **Retrospectives**: 52 templates, a board that moves through phases from an icebreaker to a return-on-time-invested vote, and actions with an owner.
- **Action items**: what a team decided, tracked across sessions, with reminders and export to Jira, Linear and GitHub.
- **Planning poker**: hidden votes, a reveal, tasks imported from your tracker and estimates written back.
- **Whiteboard**: a shared canvas with live cursors.
- **Surveys**: health checks, team pulses and eNPS, compared over time.
- **Games**: eight short icebreakers.

People without an account can join a session through a link or a code.

## Who these pages are for

The first sections are for the people who use Skrüm in a team. **Self-hosting** and **Administration** are for the person who runs the instance.

## Where to start

If you run the instance, start with [Install with Docker](../../self-hosting/install/). If your team already has one, start with [Create a retro](../../retrospectives/create-a-retro/).
```

`website/src/content/docs/self-hosting/install.md`:

````markdown
---
title: Install with Docker
description: Start a Skrüm instance from the published image with Docker Compose.
order: 2
related:
  - getting-started/introduction
---

The image is published to GitHub Container Registry. You need Docker with the Compose plugin and a host your team can reach.

## Download the files

```bash
curl -O https://raw.githubusercontent.com/arnaud-ritti/skrum/main/compose.production.yaml
curl -o .env https://raw.githubusercontent.com/arnaud-ritti/skrum/main/.env.production.example
docker run --rm --entrypoint php ghcr.io/arnaud-ritti/skrum:latest artisan key:generate --show
```

The last command prints the value for `APP_KEY`.

## Fill the three values

At the top of `.env`:

| Variable | Value |
|---|---|
| `APP_URL` | The public address of the instance, as typed in the browser |
| `APP_KEY` | The value just printed |
| `DB_PASSWORD` | A strong password for the database |

Everything else has a working default.

## Start it

```bash
docker compose -f compose.production.yaml up -d
```

Skrüm answers on `http://<host>`, plain HTTP on port 80, meant for a reverse proxy that terminates TLS.

> The first account to sign up becomes the instance admin. Create it right after starting.

## If a container keeps restarting

```bash
docker compose -f compose.production.yaml logs app
```

The log names the cause, for example a missing variable.
````

`website/src/content/docs/retrospectives/create-a-retro.md`:

```markdown
---
title: Create a retro
description: What a retrospective is made of in Skrüm before you start one.
order: 1
related:
  - getting-started/introduction
---

A retrospective belongs to a team. It is created from a template, runs through phases, and ends with action items.

## Templates

Skrüm ships 52 templates in 5 categories, among them 4Ls, Start/Stop/Continue, Mad/Sad/Glad and Sailboat. A template sets the columns of the board.

## Phases

A retro moves through these phases, in this order: icebreaker, writing, grouping, voting, discussion, actions, return on time invested, completed.

## Guests

People without an account can join a retro through its link.

## What comes next

This page is completed with the rest of the Retrospectives section.
```

- [ ] **Step 7: Put the checker at the end of the build**

In `website/package.json`:

```json
        "build": "astro build && pagefind --site dist && node scripts/check.mjs",
        "check:external": "node scripts/check.mjs --external",
```

- [ ] **Step 8: Build, then prove each failure**

Run in `website/`: `npm test && ASTRO_TELEMETRY_DISABLED=1 npm run build`
Expected: exit 0, no problem printed. (The header's "Get started" link now resolves.)

Then make each of these changes, run `ASTRO_TELEMETRY_DISABLED=1 npm run build; echo "exit $?"`, see `exit 1` with the message, and undo the change (`git checkout -- .` and `git clean -fd src` after each):

| Change | Expected message contains |
|---|---|
| In `introduction.md`, replace `../../self-hosting/install/` by `/docs/self-hosting/install/` | `leaves the base /skrum/` |
| In `introduction.md`, replace `../../self-hosting/install/` by `../../self-hosting/instal/` | `resolves to no file` |
| In `introduction.md`, set `order: 1` and copy the file to `getting-started/copy.md` | `both have order 1` |
| Create `src/content/docs/billing/plans.md` with a valid front matter | `is not in a section folder` |
| In `introduction.md`, add `  - getting-started/nope` under `related:` | `names no page` |
| In `introduction.md`, add the line `![A picture](../../../assets/screenshots/getting-started/none.png)` | `does not exist` (from Astro or from the checker; either way the build stops) |
| Copy `public/favicon.svg` to `src/assets/screenshots/getting-started/orphan.png` | `is used by no page` |
| In `src/snippets/install.sh`, add the line `docker compose pull` | `README.md lacks the line "docker compose pull"` |

- [ ] **Step 9: Look at the install page on a phone-sized window**

`npm run preview`, open `http://localhost:4321/skrum/docs/self-hosting/install/` at 390 px wide. Expected: the long `curl` lines scroll inside their block, the table scrolls inside itself, the page does not scroll sideways; previous/next show "Introduction" and "Create a retro"; "Related" shows Introduction with its description. Stop the server.

- [ ] **Step 10: Commit**

```bash
git add website
git commit -m "feat(website): a build that stops on a broken link, a stray picture or an install line the README lacks

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The landing page

**Files:**
- Modify: `website/src/pages/index.astro` (replaced), `website/src/styles/site.css` (appended)

**Interfaces:**
- Consumes: `Base.astro`, `Header.astro`, `Logo.astro`, `GitHubMark.astro`, `href()`, `repository`, `src/snippets/install.sh`, the section ids of `src/nav.ts` (the documentation index has one `id` per section).
- Produces: the anchors `#features` and `#self-host` that `Header.astro` links to.

The source is `docs/design-system/components/ScreenLanding/preview.html` (read it, and its `README.md`, before starting). The markup below is that mockup with these changes, each from spec §5.4: English; no pricing section; no "Tarifs", "Changelog", "Se connecter" in the nav; no Helm; no hosted offer; calls to action "Get started" and "GitHub"; the code block shows `install.sh`; links only to pages that exist. The product preview is decoration: `aria-hidden` and `inert`.

- [ ] **Step 1: Check the claims against the code**

Each sentence of the landing names a feature. Before writing, confirm each of these in the worktree and note the file that proves it in the commit body; drop or reword a claim you cannot prove:

| Claim | Where to look |
|---|---|
| 52 retro templates, among them 4Ls and Sailboat | `lang/en/templates.php` |
| Cards can be anonymous | `resources/js/components/retro*`, `app/Models/Card.php`, `app/Models/Retro.php` |
| Action items have an owner and a due date | `app/Models/ActionItem.php` |
| Poker decks include Fibonacci and T-shirt sizes | `app/Enums/PokerDeck.php` |
| Poker tasks are imported from Jira, Linear and GitHub, estimates written back | `app/Enums/IntegrationCapability.php`, `app/Enums/IntegrationProvider.php` |
| The whiteboard has sticky notes, arrows and live cursors | `resources/js/components/whiteboard/` |
| Games include hangman, two truths and a lie, and a drawing game | `app/Enums/GameKind.php` |
| Surveys: health check, team pulse, eNPS, compared with the previous one | `routes/web.php` (`surveys.*`, the comparison route) |
| Sign-in with Google, GitHub, Microsoft Entra or OpenID Connect | `config/services.php`, `routes/web.php` (`sso.*`) |
| Branding: name, logos, colour, corner radius | `resources/js/components/admin/` (branding form) |
| Magic links and action-item reminders are mails | `app/Mail/` |
| PostgreSQL, MariaDB, MySQL or SQLite | `docs/database.md` |

- [ ] **Step 2: Replace `src/pages/index.astro`**

```astro
---
import { ArrowRight, Calendar, ChartColumn, Check, Container, Copy, GitBranch, KeyRound, Layers, Mail, Palette, PartyPopper, PenTool, Scale, Server, Spade, ThumbsUp, VenetianMask } from '@lucide/astro';
import Base from '../layouts/Base.astro';
import GitHubMark from '../components/GitHubMark.astro';
import Header from '../components/Header.astro';
import Logo from '../components/Logo.astro';
import { href, repository } from '../nav';
import install from '../snippets/install.sh?raw';

const installScript = install.trim();
const startCommand = installScript.split('\n').at(-1);
const getStarted = href('/docs/self-hosting/install/');
const section = (id: string) => href(`/docs/#${id}`);
---

<Base title="Skrüm · Meetings end, actions remain" description="Retrospectives, planning poker, whiteboard, icebreakers and surveys in one open-source tool you host yourself.">
    <Header />
    <main class="scr-in">
        <section class="scr-hero">
            <span class="sk-badge sk-badge--soft sk-badge--pill"><GitBranch class="lucide" />Open source · Self-hosted</span>
            <h1 class="scr-d2">Meetings end,<br /><em>actions remain.</em></h1>
            <p class="scr-lead">Retrospectives, planning poker, whiteboard, icebreakers and surveys in one tool, and every decision becomes a tracked action with an owner and a due date.</p>
            <div class="sk-row sk-gap-3" style="justify-content:center">
                <a class="sk-btn sk-btn--lg" href={getStarted}>Get started<ArrowRight class="lucide" /></a>
                <a class="sk-btn sk-btn--outline sk-btn--lg" href={repository}><GitHubMark />GitHub</a>
            </div>
            <span class="scr-cmd"><span class="scr-k">$</span><span>{startCommand}</span><button class="sk-btn sk-btn--ghost sk-btn--icon sk-btn--sm" type="button" aria-label="Copy the command" data-copy={startCommand}><Copy class="lucide" /></button></span>
        </section>

        <div class="scr-app sk-card" aria-hidden="true" inert>
            <div class="scr-app-top">
                <span class="sk-col" style="gap:0"><span class="sk-xs sk-muted">Atlas · Sprint 42</span><span class="sk-strong">End-of-sprint retro</span></span>
                <span class="sk-grow"></span>
                <div class="sk-phases">
                    <span class="sk-phase is-done"><span class="sk-phase-n"><Check class="lucide" style="width:0.75rem;height:0.75rem" /></span><span class="sk-phase-l">Writing</span></span><span class="sk-phase-link"></span>
                    <span class="sk-phase is-done"><span class="sk-phase-n"><Check class="lucide" style="width:0.75rem;height:0.75rem" /></span><span class="sk-phase-l">Voting</span></span><span class="sk-phase-link"></span>
                    <span class="sk-phase is-current"><span class="sk-phase-n">3</span><span class="sk-phase-l">Actions</span></span>
                </div>
                <span class="sk-grow"></span>
                <div class="sk-timer" style="--p:.8"><span class="sk-timer-ring"></span>04:30</div>
                <div class="sk-stack"><span class="sk-avatar sk-avatar--sm sk-p1">AR</span><span class="sk-avatar sk-avatar--sm sk-p4">CR</span><span class="sk-avatar sk-avatar--sm sk-p9">IB</span><span class="sk-avatar sk-avatar--sm sk-p2">TM</span><span class="sk-avatar sk-avatar--sm sk-stack-more">+4</span></div>
            </div>
            <div class="scr-app-body sk-dotgrid">
                <div class="scr-app-cols">
                    <section class="sk-column sk-c-moss" style="width:auto">
                        <div class="sk-column-h"><span class="sk-column-swatch"></span><span class="sk-column-t">Went well</span><span class="sk-column-count">3</span></div>
                        <article class="sk-rcard sk-c-moss"><p class="sk-rcard-text">The customer demo went really well.</p><div class="sk-rcard-foot"><span class="sk-rcard-author"><span class="sk-avatar sk-avatar--xs sk-p4">CR</span>Camille</span><span class="sk-grow"></span><span class="sk-vote-btn"><ThumbsUp class="lucide sk-ico-sm" />4</span></div></article>
                        <article class="sk-rcard sk-c-moss"><p class="sk-rcard-text">Postgres migration unblocked by pairing.</p><div class="sk-rcard-foot"><span class="sk-rcard-author"><span class="sk-avatar sk-avatar--xs sk-p2">TM</span>Théo</span><span class="sk-grow"></span><span class="sk-vote-btn"><ThumbsUp class="lucide sk-ico-sm" />3</span></div></article>
                    </section>
                    <section class="sk-column sk-c-coral" style="width:auto">
                        <div class="sk-column-h"><span class="sk-column-swatch"></span><span class="sk-column-t">To improve</span><span class="sk-column-count">4</span></div>
                        <article class="sk-rcard sk-c-coral"><p class="sk-rcard-text">End-to-end tests fail one run in three on CI.</p><div class="sk-rcard-foot"><span class="sk-anon"><VenetianMask class="lucide" />Anonymous</span><span class="sk-grow"></span><span class="sk-vote-btn is-mine"><ThumbsUp class="lucide sk-ico-sm" />9</span></div></article>
                        <article class="sk-rcard sk-c-coral"><p class="sk-rcard-text">The scope changes in the middle of the sprint.</p><div class="sk-rcard-foot"><span class="sk-rcard-author"><span class="sk-avatar sk-avatar--xs sk-p9">IB</span>Inès</span><span class="sk-grow"></span><span class="sk-vote-btn"><ThumbsUp class="lucide sk-ico-sm" />7</span></div></article>
                    </section>
                    <section class="sk-column sk-c-sun" style="width:auto">
                        <div class="sk-column-h"><span class="sk-column-swatch"></span><span class="sk-column-t">Ideas</span><span class="sk-column-count">2</span></div>
                        <article class="sk-rcard sk-c-sun"><p class="sk-rcard-text">A meeting-free slot on Thursday afternoons.</p><div class="sk-rcard-foot"><span class="sk-anon"><VenetianMask class="lucide" />Anonymous</span><span class="sk-grow"></span><span class="sk-vote-btn"><ThumbsUp class="lucide sk-ico-sm" />5</span></div></article>
                        <div class="sk-typing"><span class="sk-trema" style="color:var(--skrum-presence-6)"><i></i><i></i></span>Malik is writing…</div>
                    </section>
                </div>
                <div class="sk-card scr-app-actions">
                    <div class="sk-between"><span class="sk-strong">Actions</span><span class="sk-badge sk-badge--muted sk-badge--pill">3</span></div>
                    <div class="sk-action"><span class="sk-check"></span><div class="sk-grow"><div class="sk-action-t">Quarantine the flaky end-to-end tests</div><div class="sk-action-meta"><span><span class="sk-avatar sk-avatar--xs sk-p8">LD</span>Lucas D</span><span class="sk-prio sk-prio--high"><span class="bars"><i></i><i></i><i></i></span>High</span><span class="sk-due"><Calendar class="lucide sk-ico-sm" />Oct 10</span><span class="sk-ticket">ATLAS-1302</span></div></div></div>
                    <div class="sk-action"><span class="sk-check"></span><div class="sk-grow"><div class="sk-action-t">A second CI runner for end-to-end tests</div><div class="sk-action-meta"><span><span class="sk-avatar sk-avatar--xs sk-p11">YT</span>Yuki T</span><span class="sk-prio sk-prio--medium"><span class="bars"><i></i><i></i><i></i></span>Medium</span><span class="sk-due"><Calendar class="lucide sk-ico-sm" />Oct 17</span><span class="sk-ticket">ATLAS-1303</span></div></div></div>
                    <div class="sk-action"><span class="sk-check"></span><div class="sk-grow"><div class="sk-action-t">Block Thursday afternoons</div><div class="sk-action-meta"><span><span class="sk-avatar sk-avatar--xs sk-p4">CR</span>Camille R</span><span class="sk-prio sk-prio--low"><span class="bars"><i></i><i></i><i></i></span>Low</span><span class="sk-due"><Calendar class="lucide sk-ico-sm" />Oct 8</span></div></div></div>
                </div>
                <div class="sk-cursor" style="left:35rem;top:15.625rem;--cur:var(--skrum-presence-6);--cur-fg:var(--skrum-presence-6-foreground)"><svg viewBox="0 0 18 18"><path d="M2 1 L16 8 L9.5 9.5 L7 16 Z"></path></svg><span class="sk-cursor-tag">Malik</span></div>
            </div>
        </div>

        <section class="scr-sec" id="features">
            <div class="scr-sh"><span class="scr-eyebrow">Features</span><h2 class="scr-d1">All your rituals, one place.</h2><p class="scr-lead" style="text-align:left">Same account, same teams, same guests. The actions of every session land in the same list.</p></div>
            <div class="scr-mods">
                <article class="sk-card scr-mod scr-mod--wide">
                    <div class="scr-mod-art sk-c-coral" aria-hidden="true"><div class="sk-row" style="gap:0.625rem;flex-wrap:nowrap;align-items:flex-start"><article class="sk-rcard sk-c-coral"><p class="sk-rcard-text">End-to-end tests fail one run in three.</p><div class="sk-rcard-foot"><span class="sk-anon"><VenetianMask class="lucide" />Anonymous</span><span class="sk-grow"></span><span class="sk-vote-btn is-mine"><ThumbsUp class="lucide sk-ico-sm" />9</span></div></article><div class="sk-group sk-c-sun" style="width:14.375rem"><div class="sk-group-h"><Layers class="lucide sk-ico-sm" style="color:var(--c-t)" /><span class="sk-group-t">Rituals</span><span class="sk-votes"><span class="sk-vdot is-on"></span><span class="sk-vdot is-on"></span><span class="sk-vdot"></span></span></div><div class="sk-rcard sk-c-sun"><p class="sk-rcard-text">Meeting-free Thursdays</p></div></div></div></div>
                    <div class="sk-card-b sk-col sk-gap-2"><div class="sk-row sk-gap-2"><span class="scr-mod-ico sk-c-coral"><Layers class="lucide" /></span><h3 class="sk-h4"><a href={section('retrospectives')}>Retrospectives</a></h3></div><p class="sk-p sk-muted sk-sm">Anonymous cards, grouping, voting, then actions with an owner and a due date. 52 templates, from 4Ls to Sailboat.</p></div>
                </article>
                <article class="sk-card scr-mod scr-mod--wide">
                    <div class="scr-mod-art sk-c-iris" aria-hidden="true"><div class="sk-row" style="gap:0.625rem;flex-wrap:nowrap;align-items:flex-end"><div class="sk-pcard sk-pcard--sm"><div class="sk-pcard-in"><div class="sk-pcard-face">3</div><div class="sk-pcard-back"></div></div></div><div class="sk-pcard sk-pcard--sm is-selected"><div class="sk-pcard-in"><div class="sk-pcard-face">5</div><div class="sk-pcard-back"></div></div></div><div class="sk-pcard sk-pcard--sm"><div class="sk-pcard-in"><div class="sk-pcard-face">5</div><div class="sk-pcard-back"></div></div></div><div class="sk-pcard sk-pcard--sm is-hidden"><div class="sk-pcard-in"><div class="sk-pcard-face"></div><div class="sk-pcard-back"></div></div></div><div class="sk-pcard sk-pcard--sm"><div class="sk-pcard-in"><div class="sk-pcard-face">8</div><div class="sk-pcard-back"></div></div></div><div class="sk-dist" style="height:3.5rem;margin-left:1rem;margin-bottom:0.875rem"><div class="sk-dist-bar is-low" style="height:0.875rem"><span>3</span></div><div class="sk-dist-bar" style="height:3.5rem"><span>5</span></div><div class="sk-dist-bar is-low" style="height:1.75rem"><span>8</span></div></div></div></div>
                    <div class="sk-card-b sk-col sk-gap-2"><div class="sk-row sk-gap-2"><span class="scr-mod-ico sk-c-iris"><Spade class="lucide" /></span><h3 class="sk-h4"><a href={section('planning-poker')}>Planning poker</a></h3></div><p class="sk-p sk-muted sk-sm">Fibonacci or T-shirt sizes, cards face down until the reveal, tasks imported from Jira, Linear or GitHub and estimates written back.</p></div>
                </article>
                <article class="sk-card scr-mod">
                    <div class="scr-mod-art sk-c-sky" aria-hidden="true"><div style="position:relative;width:15.625rem;height:7.5rem"><div class="sk-sticky sk-c-sky" style="left:0;top:0.5rem;width:6.875rem;transform:rotate(-3deg)">Guest journey</div><div class="sk-sticky sk-c-apricot" style="left:8.125rem;top:0;width:6.875rem;transform:rotate(2deg)">Expired link?</div><svg style="position:absolute;left:3.75rem;top:4.375rem" width="140" height="40" viewBox="0 0 140 40" fill="none"><path d="M4 6 C40 40 100 40 134 10" style="stroke:var(--c-t)" stroke-width="2" stroke-dasharray="5 5" stroke-linecap="round"></path></svg></div></div>
                    <div class="sk-card-b sk-col sk-gap-2"><div class="sk-row sk-gap-2"><span class="scr-mod-ico sk-c-sky"><PenTool class="lucide" /></span><h3 class="sk-h4"><a href={section('whiteboard')}>Whiteboard</a></h3></div><p class="sk-p sk-muted sk-sm">A shared canvas with sticky notes, arrows and live cursors to map a problem together.</p></div>
                </article>
                <article class="sk-card scr-mod">
                    <div class="scr-mod-art sk-c-apricot" aria-hidden="true"><div class="sk-row" style="gap:0.375rem;flex-wrap:nowrap"><span class="sk-letter">R</span><span class="sk-letter">E</span><span class="sk-letter"></span><span class="sk-letter">R</span><span class="sk-letter">O</span></div></div>
                    <div class="sk-card-b sk-col sk-gap-2"><div class="sk-row sk-gap-2"><span class="scr-mod-ico sk-c-apricot"><PartyPopper class="lucide" /></span><h3 class="sk-h4"><a href={section('games')}>Icebreakers</a></h3></div><p class="sk-p sk-muted sk-sm">Short games to open a session: hangman, two truths and a lie, draw and guess.</p></div>
                </article>
                <article class="sk-card scr-mod">
                    <div class="scr-mod-art sk-c-sun" aria-hidden="true"><div class="sk-roti" style="width:15.625rem"><div class="sk-roti-opt" style="min-width:0"><span class="sk-roti-n sk-r2" style="width:1.875rem;height:1.875rem;font-size:0.9375rem">2</span></div><div class="sk-roti-opt" style="min-width:0"><span class="sk-roti-n sk-r3" style="width:1.875rem;height:1.875rem;font-size:0.9375rem">3</span></div><div class="sk-roti-opt is-on" style="min-width:0"><span class="sk-roti-n sk-r4" style="width:1.875rem;height:1.875rem;font-size:0.9375rem">4</span></div><div class="sk-roti-opt" style="min-width:0"><span class="sk-roti-n sk-r5" style="width:1.875rem;height:1.875rem;font-size:0.9375rem">5</span></div></div></div>
                    <div class="sk-card-b sk-col sk-gap-2"><div class="sk-row sk-gap-2"><span class="scr-mod-ico sk-c-sun"><ChartColumn class="lucide" /></span><h3 class="sk-h4"><a href={section('surveys')}>Surveys</a></h3></div><p class="sk-p sk-muted sk-sm">Health checks, team pulses and eNPS, with each result compared with the one before.</p></div>
                </article>
            </div>
        </section>

        <section class="scr-sec" id="self-host">
            <div class="scr-self">
                <div>
                    <div class="scr-sh" style="margin-bottom:0"><span class="scr-eyebrow">Self-host and open source</span><h2 class="scr-d1">On your servers, in your colours.</h2><p class="scr-lead" style="text-align:left">One Docker image and a database (PostgreSQL, MariaDB, MySQL or SQLite), and your data never leaves your infrastructure.</p></div>
                    <div class="scr-points">
                        <div class="scr-point"><Scale class="lucide" /><div><div class="sk-strong">AGPL-3.0-or-later</div><div class="sk-sm sk-muted">The source is public, contributions are welcome.</div></div></div>
                        <div class="scr-point"><KeyRound class="lucide" /><div><div class="sk-strong">Single sign-on</div><div class="sk-sm sk-muted">Google, GitHub, Microsoft Entra or any OpenID Connect provider.</div></div></div>
                        <div class="scr-point"><Palette class="lucide" /><div><div class="sk-strong">Your branding</div><div class="sk-sm sk-muted">Instance name, logos, primary colour, corner radius.</div></div></div>
                        <div class="scr-point"><Mail class="lucide" /><div><div class="sk-strong">Your SMTP</div><div class="sk-sm sk-muted">Magic links and action reminders sent by your own server.</div></div></div>
                    </div>
                </div>
                <div>
                    <div class="sk-card scr-code">
                        <div class="scr-code-h"><span class="sk-row sk-gap-2 sk-sm sk-strong"><Container class="lucide sk-ico-sm" />Docker Compose</span><span class="sk-grow"></span><button class="sk-btn sk-btn--ghost sk-btn--icon sk-btn--sm" type="button" aria-label="Copy the commands" data-copy={installScript}><Copy class="lucide" /></button></div>
                        <pre>{installScript}</pre>
                        <div class="scr-code-h" style="border-top:1px solid var(--border);border-bottom:0"><span class="sk-xs sk-muted">Fill <code>APP_URL</code>, <code>APP_KEY</code> and <code>DB_PASSWORD</code> in <code>.env</code> before the last command. <a href={getStarted}>Install with Docker</a> explains each step.</span></div>
                    </div>
                    <div class="sk-card scr-brandcard" aria-hidden="true" inert>
                        <div class="sk-col sk-gap-3">
                            <span class="sk-xs sk-strong sk-muted">Admin · Instance appearance</span>
                            <div class="sk-row sk-gap-2"><span class="scr-swatch is-on" style="background:var(--primary)"></span><span class="scr-swatch" style="background:var(--skrum-col-lagoon-text)"></span><span class="scr-swatch" style="background:var(--skrum-col-iris-text)"></span><span class="scr-swatch" style="background:var(--skrum-col-moss-text)"></span><span class="scr-swatch" style="background:var(--foreground)"></span></div>
                            <div class="sk-col sk-gap-1"><span class="sk-xs sk-muted">Card radius · 10 px</span><div class="sk-slider"><div class="sk-slider-track"><div class="sk-slider-range" style="width:62%"></div></div><span class="sk-slider-thumb" style="left:62%"></span></div></div>
                        </div>
                        <div class="sk-col sk-gap-2" style="align-items:flex-start">
                            <span class="sk-row sk-gap-2"><span class="sk-team-mark" style="background:var(--primary);color:var(--primary-foreground)">N</span><span class="sk-strong">Nordlys retros</span></span>
                            <span class="sk-btn sk-btn--sm">Join the session</span>
                            <span class="sk-xs sk-muted">Live preview</span>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section class="scr-sec">
            <div class="sk-card scr-final">
                <h2 class="scr-d1" style="max-width:47.5rem">Your next retro can produce actions that stick.</h2>
                <p class="scr-lead">Create a session, share the link, and the team joins without an account.</p>
                <div class="sk-row sk-gap-3" style="justify-content:center"><a class="sk-btn sk-btn--lg" href={getStarted}>Get started<ArrowRight class="lucide" /></a><a class="sk-btn sk-btn--outline sk-btn--lg" href={repository}><GitHubMark />View the code</a></div>
            </div>
        </section>

        <footer class="scr-footer">
            <div class="scr-fcols">
                <div class="sk-col sk-gap-3"><span class="sk-row sk-gap-2"><Logo size={24} /><span class="scr-word" style="font-size:1.25rem">skrüm</span></span><p class="sk-p sk-sm sk-muted" style="max-width:18.75rem">Open-source agile rituals, hosted by you.</p></div>
                <div><h4>Product</h4><a href={section('retrospectives')}>Retrospectives</a><a href={section('planning-poker')}>Planning poker</a><a href={section('whiteboard')}>Whiteboard</a><a href={section('games')}>Icebreakers</a><a href={section('surveys')}>Surveys</a></div>
                <div><h4>Self-host</h4><a href={getStarted}>Install with Docker</a><a href={section('self-hosting')}>Self-hosting</a><a href={section('administration')}>Administration</a><a href={repository}>Source code</a></div>
                <div><h4>Resources</h4><a href={href('/docs/')}>Documentation</a><a href={section('integrations')}>Integrations</a><a href={section('mcp')}>AI assistants</a><a href={`${repository}/blob/main/LICENSE`}>Licence</a></div>
            </div>
            <div class="sk-between sk-xs sk-muted" style="margin-top:var(--space-10)"><span>© 2026 Skrüm · AGPL-3.0-or-later</span><span>Made for teams that hate pointless meetings.</span></div>
        </footer>
    </main>
    <script is:inline>
        for (const button of document.querySelectorAll('[data-copy]')) {
            button.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(button.dataset.copy);
                    button.setAttribute('aria-label', 'Copied');
                } catch {
                    button.setAttribute('aria-label', 'Copying failed: select the text instead');
                }
            });
        }
    </script>
</Base>
```

- [ ] **Step 3: Append the landing's responsive rules to `src/styles/site.css`**

```css

.scr-mods > .scr-mod { grid-column: span 2; }
.scr-mods > .scr-mod--wide { grid-column: span 3; }
.scr-mod h3 a { color: inherit; text-decoration: none; }
.scr-mod h3 a:hover { color: var(--skrum-primary-text); }
.scr-app-cols { display: contents; }
.scr-code pre { overflow-x: auto; }
.scr-code-h code { font-family: var(--font-mono); }
.scr-code-h a { color: var(--skrum-primary-text); }

@media (max-width: 68rem) {
    .scr-self { grid-template-columns: minmax(0, 1fr); }
    .scr-mods { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .scr-mods > .scr-mod, .scr-mods > .scr-mod--wide { grid-column: auto; }
    .scr-mod-art { overflow: hidden; }
    .scr-app-body { display: flex; flex-direction: column; }
    .scr-app-cols { display: flex; gap: var(--space-4); overflow-x: auto; padding-bottom: var(--space-2); }
    .scr-app-cols > .sk-column { flex: 0 0 17rem; }
    .scr-app-body > .sk-cursor, .scr-app-top .sk-phases, .scr-app-top .sk-stack { display: none; }
    .scr-fcols { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 48rem) {
    .scr-d2 { font-size: 2.75rem; line-height: 3rem; }
    .scr-d1 { font-size: 2.125rem; line-height: 2.5rem; }
    .scr-hero > .sk-row { flex-direction: column; align-self: stretch; }
    .scr-hero > .sk-row .sk-btn { width: 100%; justify-content: center; }
    .scr-cmd { max-width: 100%; overflow-x: auto; }
    .scr-mods, .scr-points, .scr-brandcard, .scr-fcols { grid-template-columns: minmax(0, 1fr); }
    .scr-final { padding: var(--space-8) var(--space-4); }
    .scr-footer .sk-between { flex-direction: column; align-items: flex-start; gap: var(--space-2); }
}
```

- [ ] **Step 4: Build**

Run in `website/`: `npm test && ASTRO_TELEMETRY_DISABLED=1 npm run build`
Expected: exit 0. Then:

```bash
grep -oiE 'pricing|tarif|trial|essai|saas|helm|saml|scim|hosted in' dist/index.html | sort -u; echo "found: $?"
```

Expected: nothing printed, `found: 1`.

- [ ] **Step 5: Compare with the mockup**

`npm run preview`, open `http://localhost:4321/skrum/`. Open `docs/design-system/components/ScreenLanding/preview.html` beside it only as a reference of structure (it has no stylesheet of its own, so it renders unstyled; the mockup's `README.md` describes each zone).

1. At 1440 px: nav, centred hero with the two-tone title, the board preview with three columns and the Actions panel, five module cards on a row of two and a row of three, the self-host block in two columns, the final call to action on the soft terracotta, the four-column footer. No pricing section.
2. Dark theme through the toggle: every zone readable, no white block.
3. At 390 px: the nav is the logo, search, theme toggle and menu; the hero's two buttons are full width and stacked; the board's columns scroll sideways inside the card and the Actions panel sits below them; modules and footer are one column; `document.documentElement.scrollWidth === document.documentElement.clientWidth` is `true` in the console.
4. Both copy buttons put the command(s) on the clipboard. On `http://<LAN address>:4321/skrum/` (not a secure context, no clipboard API) clicking does nothing visible and the console shows no uncaught error.
5. With the keyboard, Tab never stops inside the board preview or the appearance card.
6. "Get started" opens Install with Docker; the module titles open the documentation index at their section; "GitHub" opens the repository.

Stop the server.

- [ ] **Step 6: Commit**

```bash
git add website
git commit -m "feat(website): the landing page, from the ScreenLanding mockup, in English and without what Skrüm does not sell

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

The commit body lists, one per line, each claim of step 1 and the file that proves it.

---

### Task 5: Deploy workflow and repository hygiene

**Precondition:** `navigation-redesign` is committed and this branch is rebased on it. `.dockerignore`, `README.md` and `.github/workflows/tests.yml` carry uncommitted edits in the owner's checkout; editing them before the rebase invites conflicts. If the rebase has not happened when Task 4 is done, do step 1 and step 2 only (the new workflow file conflicts with nothing) and leave steps 3 to 6 for after the rebase.

**Files:**
- Create: `.github/workflows/docs.yml`
- Modify: `.dockerignore`, `.gitattributes`, `vite.config.ts` (the two `ignorePatterns` lists), `README.md` (after the first paragraph)

**Interfaces:**
- Consumes: `npm ci`, `npm test`, `npm run build` in `website/`; the build output `website/dist`.
- Produces: the workflow `docs`.

- [ ] **Step 1: Confirm the two pins**

```bash
gh api repos/actions/upload-pages-artifact/git/ref/tags/v5.0.0 --jq .object.sha
gh api repos/actions/deploy-pages/git/ref/tags/v5.0.1 --jq .object.sha
```

Expected: `fc324d3547104276b827a68afc52ff2a11cc49c9` and `368f82528645a54fb793d4d04e342629a3f51346`. If a tag is annotated the command prints the tag object's SHA: resolve it with `gh api repos/actions/<name>/git/tags/<sha> --jq .object.sha`. If the result differs from the value above, use the resolved commit SHA in step 2 and say so in the commit body.

- [ ] **Step 2: Write `.github/workflows/docs.yml`**

```yaml
name: docs

on:
  push:
    branches:
      - main
    paths:
      - 'website/**'
      - '.github/workflows/docs.yml'
  pull_request:
    paths:
      - 'website/**'
      - '.github/workflows/docs.yml'
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: docs-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    defaults:
      run:
        working-directory: website

    steps:
      - name: Checkout code
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false

      - name: Setup Node
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: '22'
          cache: npm
          cache-dependency-path: website/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Run the site's tests
        run: npm test

      - name: Build the site
        env:
          ASTRO_TELEMETRY_DISABLED: '1'
        run: npm run build

      - name: Upload the site
        if: github.event_name != 'pull_request'
        uses: actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9 # v5.0.0
        with:
          path: website/dist

  deploy:
    if: github.event_name != 'pull_request'
    needs: build
    runs-on: ubuntu-latest
    timeout-minutes: 10

    permissions:
      pages: write
      id-token: write

    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}

    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@368f82528645a54fb793d4d04e342629a3f51346 # v5.0.1
```

Check that it parses and that the deploy is fenced:

```bash
ruby -ryaml -e 'w = YAML.load_file(".github/workflows/docs.yml"); puts w["jobs"].keys.inspect, w["jobs"]["deploy"]["if"], w["jobs"]["build"]["steps"].last["if"]'
```

Expected: `["build", "deploy"]`, then `github.event_name != 'pull_request'` twice.

- [ ] **Step 3: Keep the site out of the image and out of archives**

Append to `.dockerignore`:

```
website
```

Append to `.gitattributes`:

```
/website export-ignore
```

In `vite.config.ts`, add `'website/**',` as the last entry of `lint.ignorePatterns` and as the last entry of `fmt.ignorePatterns`.

- [ ] **Step 4: Link the documentation from the README**

In `README.md`, after the first paragraph (the one that starts "Skrum is an open-source"), add a blank line and:

```markdown
Documentation: <https://arnaud-ritti.github.io/skrum/docs/>
```

- [ ] **Step 5: Verify**

```bash
grep -cx 'website' .dockerignore
npm run check
```

Expected: `1`; `npm run check` passes without reading `website/`. `npm run check` needs the root `node_modules`; if the worktree has none, run `npm ci` at the root first. The archive is checked after the commit, in step 6.

Then run the application's own gate: `composer ci:check` (needs `composer install` and a `.env`; see plan B, Task 1, for the worktree setup). Expected: passes.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/docs.yml .dockerignore .gitattributes vite.config.ts README.md
git commit -m "ci(docs): build the site on pull requests, deploy it to GitHub Pages from main

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git archive --worktree-attributes HEAD | tar -t | grep -c '^website/'
```

Expected from the last line: `0`.

The owner turns Pages on once (repository Settings → Pages → Source: GitHub Actions) and pushes; nothing is pushed by this plan.

---

## Self-review

- Spec §5.1 (package, dependencies, one address): Task 1. The constant lives in `website/site.mjs`, read by the config and by the checker; the spec is amended to say so.
- §5.2 (styling, icons, theme): Tasks 1 and 2.
- §5.3 (collection, navigation rules, search, 404, code themes): Task 2.
- §5.4 (landing): Task 4. The install page repeats the snippet's lines instead of including the file (Markdown has no include without a plugin); the checker holds the two together. The spec is amended to say so.
- §5.5 (checks, `--external`): Task 3. Added to the spec's list: a picture without alternative text.
- §5.7 (workflow, ignore files, README): Task 5.
- Criteria 1, 2, 4, 5, 6, 7: Tasks 1 to 3. Criterion 3: Task 1 step 9. Criterion 8: Task 4 steps 4 and 5. Criteria 15 and 16: Task 5. Criterion 17: Global Constraints.
- Not in this plan: capture pipeline (plan B), the 77 pages and their pictures, criteria 9 to 14 (plan C).
