# Front-end Rewrite — Clean-up and Parity Proof (Plan 18g) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Every agent reads **Global Constraints** and **The deletion rule** before its task.

**Goal:** After phases 18e and 18f, nothing of the old front end or of the starter kit is left — the old view components that a rewritten screen still imported are rewritten here — every page matches its mockup or has an approved deviation, the rules of the design system are held by tests instead of by reviewers, and a table proves that every route, page, action and feature of the old front end has a place in the new one or a recorded gap.

**Architecture:** Two read-only Node scripts under `bin/` do what no installed tool does: `front-unused.mjs` (files, exports, packages, CSS and translation keys nobody uses; it drives the clean-up and is the cross-check of the one `npx knip` run that gives the evidence of AC6) and `front-parity.mjs` (the parity table, generated from the inventories, the current code and one hand-written rulings file). The rules of spec §5 become Pest tests under `tests/Arch` that read the source files; a page catalogue under `tests/Browser/Support` gives one address per page to the capture test and to the accessibility test. Deletion comes first, then the rewrite of what is old and still used, then enforcement, then the mockup-fidelity pass, and proof last, so that no time is spent fixing files that are about to go and the proof is taken on the final tree. A third script, `front-old-components.mjs`, lists the view components that predate the screen rewrite and that a page still reaches.

**Tech Stack:** Laravel 13, PHP 8.4, Pest 5 with the browser plugin (Playwright, axe-core bundled), Inertia 3, React 19, Tailwind 4, vite-plus (`vp`: build, oxlint, oxfmt, Vitest), Node 24 with the `typescript` package already installed.

**Spec:** `docs/superpowers/specs/2026-10-01-front-rewrite-design.md` — row 18g of §12; rules of §5; §6.1; §8; §10; §11; acceptance criteria of §13. Inputs: `docs/superpowers/research/front-rewrite/` (`inventory-pages.md`, `inventory-components.md`, `route-callers.tsv`, `notes-for-18e.md`), the phase reports of 18e and 18f in their ledgers under `.superpowers/sdd/`.

**Owner answers of 2026-10-02** (`docs/superpowers/research/front-rewrite/owner-answers-2026-10-02.md`, section "Plan 18g"), all applied below: dead-code evidence is `knip` through a one-off `npx`, not installed (Task 5 Step 6); `@testing-library/user-event` is declared as a dev dependency (Task 1 Step 4); captures run in FR and EN (Task 8); the manual accessibility checklist is run by an agent with a real browser, and the owner reads its report (Task 9 Step 5). Second round, same day: old view components still imported after 18e are rewritten in this plan, none remains at the end (Task 4). Standing rule, same day: **the mockup must be faithfully respected** — the visual pass is a mockup-fidelity pass (Task 8), and "no unapproved deviation remains" is an acceptance check (Task 11).

**Not in this plan:** any new feature, any item of the backlog (§10), any change to a screen that is not a rewrite of an old component (Task 4), a rule fix, an accessibility fix or a correction of a difference with the mockup (Task 8), the merge into `main` and the push (both wait for the owner).

## What was checked while writing this plan (2026-10-02, branch `plan-18d-branding`)

The code blocks of this plan were run against the repository as it was before 18e, read-only. What that proved, and what it could not:

- `bin/front-unused.mjs` runs and reports 0 unreached files, 4 files reached only by a test, 26 dead exports, 119 local-only exports, 0 unused packages, 1 undeclared package (`@testing-library/user-event`), 1 unused class of our own CSS, 103 candidate translation keys. The numbers will differ after 18e; the sections will not.
- `bin/front-parity.mjs` finds a current caller for every one of the 256 routes that had one in `route-callers.tsv` (0 route holes on the old tree), and extracts 32 pages, 560 action rows, 76 features and 365 files.
- The detectors of `FrontEndRulesTest.php` pass their own 46 examples and report nothing in `components/skrum`, `components/ui`, `components/admin`, `layouts/skrum`, `pages/dev`, `hooks` and `lib` except `lib/retro/colors.ts` (the old column palette, replaced by B10 in 18e).
- The page wiring check finds 36 rendered components and 36 page files, with no difference.
- The contrast pairs of Task 9 all hold on the current `app.css` (lowest: `input` on `card` in dark, 3.25; `primary-foreground` on `primary` in light, 4.83).
- A static test for "focus never removed" was tried and dropped: 24 false positives on the reviewed library (the focus style sits in another string of the same `cn()` call, or the element is a focus target without being a control). Focus is checked in the browser instead (Task 9).
- `@testing-library/user-event` is in `node_modules` and in `package-lock.json` at 14.6.7 (`dev: true`), pulled by `@vitest/browser-preview` (`^14.6.1`); 30 files under `resources/js` import it; `package.json` does not declare it.
- `npm view knip version` answered 6.39.0 (engines `^20.19.0 || >=22.12.0`; the host runs Node 24). `knip` itself was not run while writing this plan: its configuration (Task 5 Step 6) is written from its documentation and is adjusted in that step.
- `bin/front-old-components.mjs` (Task 4) runs: against a commit of 2026-10-01 that predates the rewrite it lists 235 view files on the tree as it is before 18e (the whole old front end, as expected), 0 against the first commit of the repository, and exits 1 while the list is not empty.
- The mockup folders named by `PageCatalogue::Mockups` (Task 8) all exist under `docs/design-system/components/` with a `preview.html`. `npx playwright screenshot` on them was not run.
- Not run: the Pest files themselves, the browser tests, any build. `RetroPhase::Actions` and `RetroPhase::Roti`, used by the page catalogue, exist only after 18e (B1).

## Global Constraints

- Branch `plan-18g-cleanup` from the head of the last phase branch (18f). No merge into `main`, no push: both wait for the owner.
- No new dependency, PHP or JS, with one exception the owner approved: `@testing-library/user-event` is declared in `devDependencies` at the exact version already resolved, `14.6.7` (Task 1 Step 4). `knip` is never installed: it runs once through `npx --yes knip@6.39.0` with a configuration file kept in the ledger, so neither `package.json`, `package-lock.json` nor the repository gains a line for it. Apart from that declaration, packages may only be removed.
- PHP tests run through Sail: `vendor/bin/sail artisan test --parallel --processes=8 --compact` for the whole suite, `vendor/bin/sail artisan test --compact <path>` for one file.
- npm runs on the host: `npm run build:front` (build, then Wayfinder generation: never `npm run build` alone before a type check), `npm run types:check`, `npm run check`, `npm run test`.
- The browser suite runs on the host with `bin/test-browser` (4 shards, ports 8099 to 8102). One browser file alone: `BROWSER_REVERB_PORT=8098 DB_HOST=127.0.0.1 DB_DATABASE=testing_browser_1 php -d memory_limit=2G vendor/bin/pest <file>`. Never port 8097, and never kill what listens there. Never `--tia`, in any gate or inner loop of this plan.
- Browser tests need built assets and no `public/hot`: run `npm run build:front` before them.
- The Pest browser suite is a contract. A browser test changes only when a mockup imposes another label or flow; such a change is made in the commit that brings the screen to the mockup (Task 4 or Task 8), and is listed with the mockup line that imposes it. If a deletion breaks a browser test, the deletion is wrong: restore the file.
- **The mockup is respected faithfully** (owner, 2026-10-02). An explicit answer of the owner in `owner-answers-2026-10-02.md` stands as written. Everything else follows the mockups and READMEs of `docs/design-system/` exactly: layout, placement, labels, states. A deviation is allowed only for something false or unsafe, for an accessibility rule, or for data the product does not have at all; an element the owner sent to the backlog (spec §10) is absent by decision. Every deviation is a line of `docs/superpowers/research/front-rewrite/deviations.md` (Task 8), with its reason. When the mockup needs data the back end lacks and the owner has not sent it to the backlog, this plan does not leave the element out and does not build the back end either: it stops on that page and reports — a back-end task belongs to 18e or 18f, and the owner decides which.
- No test and no test file is deleted without the owner's approval, including a Vitest file whose component has become unreachable. Such files are listed in the final report and left in place.
- Rules of spec §5 for every line written here: tokens only, rem, no arbitrary size, lucide only, literal `t('…')` keys present in `en`, `fr`, `es`, `de`.
- The first 475 lines of `resources/css/app.css` are a verbatim copy of `docs/design-system/app.css` (`tests/Feature/DesignTokensTest.php`). They are never edited, even to remove a class nobody uses.
- PHP style: early returns, no `else`, typed everything, PascalCase constants, no comment that restates the code, array shapes in docblocks. Run `vendor/bin/pint --dirty --format agent` after touching PHP. Scripts under `bin/` pass `npm run check`.
- Every decision taken on the owner's behalf goes in the ledger (`.superpowers/sdd/2026-10-17-plan-18g-front-rewrite-cleanup/progress.md`) and in the final report.
- Commit messages follow the repository's style (`chore(front): …`, `test(front): …`, `docs: …`) and end with the attribution lines of the session that runs the plan.

## The deletion rule

A file, an export, a class, a translation key or a package is deleted only when all of these hold. One "no" means it stays and goes in the final report.

1. No import reaches it: `bin/front-unused.mjs` lists it.
2. No test reaches it. A file listed under "Files that only a test reaches" stays, with its test, until the owner approves.
3. No route or server code names it: an Inertia page is named by a string in PHP, a class name may be a selector in a browser test or in CSS, a translation key may be sent by the server. The grep given in the task finds nothing.
4. After the deletion, `npm run types:check`, `npm run test` and `npm run check` pass, and at the end of the task the feature suite and `bin/test-browser` pass.

## Review Focus

1. **Something kept alive by a name, not by an import** — a page the server renders by string, a class a browser test selects, a file a Vitest test reads from disk. Deleting it passes the type check and breaks at run time. Pinned by the page wiring test of Task 2 (`tests/Arch/FrontEndPagesTest.php`) and by rule 3 of the deletion rule, whose grep is part of Task 3.
2. **A translation key that only a label map, a layout prop or the server spells** — it is missing from a lang file, or removed as unused, and the French screen shows English. Pinned by the three tests added to `TranslationKeysTest.php` in Task 7, and by the grep before deletion in Task 5.
3. **A package nobody imports but something needs** — a font imported by CSS, a plugin named in `vite.config.ts`, a binary a command runs. Removing it works on a machine where it is hoisted and fails on a clean install. Pinned by the `toolingPackages` list of the script (each entry with its reason, and the "stale tooling" section) and by the clean install of Task 5.
4. **A guest and a long name at 390 pixels in French** — the guest has no sidebar, the name does not fit. Pinned in the page catalogue of Task 8: a guest inside a retro (`retros-show-page--guest`) and a member named "Maximilian Alexander von Hohenberg-Lichtenstein" on every team page.
5. **A control whose focus mark is carried by a neighbour, or motion started from script** — a static scan cannot see either. Pinned by the three harness self-tests of Task 9 (a control that hides its focus is caught, the bench is accepted, a scripted animation is caught).
6. **An old component rewritten into something else** — the rewrite drops a state the old file had (empty, loading, error, read-only for a guest), renames a hook the browser suite uses, or changes a request. Pinned by the characterisation test of Task 4 Step 6 point 4, the hook inventory of point 3 and the browser files of point 1.
7. **A page that resembles its mockup** — a label reworded, a block in another place, a state the mockup draws and the page lacks. Pinned by the side-by-side table of Task 8 Step 7 and the acceptance check "no unapproved deviation remains" of Task 11.

---

### Task 1: Branch, ledger and baseline

**Files:**
- Create (untracked, the folder is git-ignored): `.superpowers/sdd/2026-10-17-plan-18g-front-rewrite-cleanup/progress.md`, `plan-path`, `reports/`

**Interfaces:**
- Consumes: the head of the 18f branch, with its phase report accepted.
- Produces: the ledger folder, named `$LEDGER` in every later task (`LEDGER=.superpowers/sdd/2026-10-17-plan-18g-front-rewrite-cleanup`), and the baseline numbers every later gate is compared with.

- [ ] **Step 1: Read the environment notes and check where the work starts**

Read the newest `env.md` under `.superpowers/sdd/` (the 18f ledger, else the 18e one). It holds the `PATH` line every shell command starts with and the facts about the browser plugin.

```bash
git status --short | wc -l
git log --oneline -3
ls resources/js/pages/retros resources/js/components/session 2>/dev/null
```

Expected: `0` for the first command (clean tree), the last commits are those of 18f, and the retro page is the rewritten one. If the tree is not clean or 18e/18f are not finished, stop and report.

- [ ] **Step 2: Create the branch and the ledger**

```bash
git switch -c plan-18g-cleanup
LEDGER=.superpowers/sdd/2026-10-17-plan-18g-front-rewrite-cleanup
mkdir -p "$LEDGER/reports"
echo "docs/superpowers/plans/2026-10-17-plan-18g-front-rewrite-cleanup.md" > "$LEDGER/plan-path"
printf '%s\n' \
  '# SDD ledger — plan: docs/superpowers/plans/2026-10-17-plan-18g-front-rewrite-cleanup.md' \
  'Spec: docs/superpowers/specs/2026-10-01-front-rewrite-design.md' \
  "Branch: plan-18g-cleanup (from $(git rev-parse --short HEAD)). No merge, no push." \
  '' \
  '## Progress' > "$LEDGER/progress.md"
```

- [ ] **Step 3: Run every gate once and write the numbers in the ledger**

```bash
npm run build:front
npm run types:check
npm run check
npm run test
vendor/bin/sail artisan test --parallel --processes=8 --compact
vendor/bin/sail composer lint:check
vendor/bin/sail composer types:check
vendor/bin/sail composer rector:check
bin/test-browser
git ls-files resources/js resources/css lang | wc -l
git ls-files resources/js resources/css | xargs wc -l | tail -1
```

Expected: every command exits 0; `bin/test-browser` ends with `Total: PASS, <n> passed, 0 failed, 4 shards`. Write one line per command in `progress.md` under `Baseline:` with the count it printed (Vitest tests, feature tests, browser tests, tracked files, lines). A command that was already red at the end of 18f (the 18d ledger records two pre-existing PHPStan errors and eleven Rector files) is written down as "red before this plan" with its output; it is not fixed here unless a later task touches the file.

If a gate that was green at the end of 18f is red now, stop and report: clean-up does not start on a red tree.

- [ ] **Step 4: Declare `@testing-library/user-event` (owner approved, 2026-10-02)**

The Vitest files import it; today it is installed only because `@vitest/browser-preview` depends on it. The declared version is the one already in `package-lock.json` and `node_modules`, so nothing new is downloaded.

```bash
node -p "require('./node_modules/@testing-library/user-event/package.json').version"
grep -c '"@testing-library/user-event"' package.json
```

Expected: `14.6.7` and `0`. If the first line prints another version, 18e or 18f moved the lockfile: use the version printed, and write it in `progress.md`. If the second prints `1`, an earlier phase already declared it: skip to the commit-free end of this step and write that in `progress.md`.

```bash
npm install --save-dev --save-exact @testing-library/user-event@14.6.7
git diff --stat package.json package-lock.json
npm ls @testing-library/user-event
npm run test
```

Expected: `package.json` gains one line under `devDependencies` (`"@testing-library/user-event": "14.6.7"`); `package-lock.json` changes only in the root package's `devDependencies` block (the `node_modules/@testing-library/user-event` entry keeps its version and integrity); `npm ls` shows the package once at the root, deduplicated under `@vitest/browser-preview`; Vitest passes with the count of Step 3. A lockfile diff that touches any other package is not committed: `git checkout package.json package-lock.json`, stop and report.

```bash
git add package.json package-lock.json
git commit -m "chore(front): declare @testing-library/user-event, which the Vitest files import"
```

---

### Task 2: The detection script and the page wiring test

**Files:**
- Create: `bin/front-unused.mjs`
- Create: `tests/Arch/FrontEndPagesTest.php`

**Interfaces:**
- Consumes: nothing.
- Produces: `node bin/front-unused.mjs [--json] [--lang]` — sections `unreachedFiles`, `testOnlyFiles`, `deadExports`, `localOnlyExports`, `libraryLocalOnlyExports`, `testOnlyExports`, `unusedPackages`, `undeclaredPackages`, `staleTooling`, `unusedStyles`, `unusedTranslationKeys` (only with `--lang`). Exit 1 while `unreachedFiles`, `deadExports`, `localOnlyExports`, `unusedPackages`, `undeclaredPackages`, `staleTooling` or `unusedStyles` is not empty. `pageComponents(string $root): array` and `renderedComponents(string $root): array` in `tests/Arch/FrontEndPagesTest.php`, reused by Task 8.

- [ ] **Step 1: Write the script**

`bin/front-unused.mjs`:

```js
#!/usr/bin/env node
/**
 * Lists what the front end no longer uses. Read-only.
 *
 *   node bin/front-unused.mjs            human-readable report, exit 1 when something is listed
 *   node bin/front-unused.mjs --json     the same as JSON
 *   node bin/front-unused.mjs --lang     adds the translation keys no code spells (never blocking)
 *
 * Sections: files no page reaches, files only a test reaches, exports nobody
 * imports, packages nobody imports, packages imported but not declared.
 * Generated folders (actions, routes, wayfinder) are never read.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, resolve, dirname } from 'node:path';

const root = process.cwd();
const ts = createRequire(join(root, 'package.json'))('typescript');
const sourceRoot = join(root, 'resources/js');
const generated = ['actions', 'routes', 'wayfinder'].map((name) =>
    join(sourceRoot, name),
);

/** Packages used by a tool, a config file or a stylesheet, never by an import in resources/js. */
const toolingPackages = new Map([
    ['typescript', 'tsc --noEmit'],
    ['vite', 'peer of vite-plus and of the Vite plugins'],
    ['vite-plus', 'vp build, check and test'],
    ['tailwindcss', '@import "tailwindcss" in app.css'],
    ['@types/node', 'types of vite.config.ts'],
    ['@types/react', 'types'],
    ['@types/react-dom', 'types'],
    ['jsdom', 'Vitest environment'],
    ['playwright', 'Pest browser plugin'],
    ['concurrently', '`php artisan dev` (composer dev) runs it'],
    ['laravel-echo', 'peer of @laravel/echo-react'],
    ['pusher-js', 'peer of @laravel/echo-react (Reverb protocol)'],
    ['babel-plugin-react-compiler', 'reactCompilerPreset in vite.config.ts'],
]);

/** Packages imported without being declared, on purpose. */
const providedPackages = new Map([
    ['vitest', 'shipped by vite-plus'],
    ['@inertiajs/core', 'dependency of @inertiajs/react, hoisted'],
]);

function walk(directory) {
    return readdirSync(directory).flatMap((name) => {
        const path = join(directory, name);

        if (statSync(path).isDirectory()) {
            return generated.includes(path) ? [] : walk(path);
        }

        return /\.(ts|tsx)$/.test(name) ? [path] : [];
    });
}

function resolveModule(specifier, from) {
    const base = specifier.startsWith('@/')
        ? join(sourceRoot, specifier.slice(2))
        : specifier.startsWith('.')
          ? resolve(dirname(from), specifier)
          : null;

    if (base === null) {
        return null;
    }

    const candidates = [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        `${base}.d.ts`,
        join(base, 'index.ts'),
        join(base, 'index.tsx'),
    ];

    return (
        candidates.find(
            (path) => existsSync(path) && statSync(path).isFile(),
        ) ?? null
    );
}

function packageName(specifier) {
    if (specifier.startsWith('.') || specifier.startsWith('@/')) {
        return null;
    }

    if (specifier.startsWith('node:')) {
        return null;
    }

    const parts = specifier.split('/');

    return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

function hasExportModifier(node) {
    return (
        ts.canHaveModifiers(node) &&
        (ts.getModifiers(node) ?? []).some(
            (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
        )
    );
}

function hasDefaultModifier(node) {
    return (ts.getModifiers(node) ?? []).some(
        (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword,
    );
}

/**
 * @returns {{ exports: Set<string>, imports: Array<{ specifier: string, names: Set<string> | '*' }>, usedInFile: (name: string) => boolean }}
 */
function readModule(path) {
    const text = readFileSync(path, 'utf8');
    const source = ts.createSourceFile(
        path,
        text,
        ts.ScriptTarget.Latest,
        true,
        path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const exports = new Set();
    const clauseExports = new Set();
    const identifiers = new Map();
    const imports = [];

    const addImport = (specifier, names) => imports.push({ specifier, names });

    for (const statement of source.statements) {
        if (ts.isImportDeclaration(statement)) {
            const specifier = statement.moduleSpecifier.text;
            const clause = statement.importClause;

            if (!clause) {
                addImport(specifier, new Set());
                continue;
            }

            const names = new Set();

            if (clause.name) {
                names.add('default');
            }

            if (clause.namedBindings) {
                if (ts.isNamespaceImport(clause.namedBindings)) {
                    addImport(specifier, '*');
                    continue;
                }

                for (const element of clause.namedBindings.elements) {
                    names.add((element.propertyName ?? element.name).text);
                }
            }

            addImport(specifier, names);
            continue;
        }

        if (ts.isExportDeclaration(statement)) {
            if (statement.moduleSpecifier) {
                const specifier = statement.moduleSpecifier.text;

                if (
                    !statement.exportClause ||
                    ts.isNamespaceExport(statement.exportClause)
                ) {
                    addImport(specifier, '*');
                    exports.add('*');
                    continue;
                }

                const names = new Set();

                for (const element of statement.exportClause.elements) {
                    names.add((element.propertyName ?? element.name).text);
                    exports.add(element.name.text);
                }

                addImport(specifier, names);
                continue;
            }

            if (
                statement.exportClause &&
                ts.isNamedExports(statement.exportClause)
            ) {
                for (const element of statement.exportClause.elements) {
                    exports.add(element.name.text);
                    clauseExports.add(element.name.text);
                }
            }

            continue;
        }

        if (ts.isExportAssignment(statement)) {
            exports.add('default');
            continue;
        }

        if (!hasExportModifier(statement)) {
            continue;
        }

        if (hasDefaultModifier(statement)) {
            exports.add('default');
            continue;
        }

        if (ts.isVariableStatement(statement)) {
            for (const declaration of statement.declarationList.declarations) {
                if (ts.isIdentifier(declaration.name)) {
                    exports.add(declaration.name.text);
                }
            }

            continue;
        }

        if (statement.name) {
            exports.add(statement.name.text);
        }
    }

    const visit = (node) => {
        if (ts.isIdentifier(node)) {
            identifiers.set(node.text, (identifiers.get(node.text) ?? 0) + 1);
        }

        if (
            ts.isCallExpression(node) &&
            node.expression.kind === ts.SyntaxKind.ImportKeyword &&
            node.arguments.length === 1 &&
            ts.isStringLiteralLike(node.arguments[0])
        ) {
            addImport(node.arguments[0].text, '*');
        }

        if (
            ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            ['mock', 'doMock', 'importActual'].includes(
                node.expression.name.text,
            ) &&
            node.arguments.length > 0 &&
            ts.isStringLiteralLike(node.arguments[0])
        ) {
            addImport(node.arguments[0].text, '*');
        }

        if (
            ts.isImportTypeNode(node) &&
            ts.isLiteralTypeNode(node.argument) &&
            ts.isStringLiteral(node.argument.literal)
        ) {
            addImport(node.argument.literal.text, '*');
        }

        ts.forEachChild(node, visit);
    };

    visit(source);

    const usedInFile = (name) =>
        (identifiers.get(name) ?? 0) > (clauseExports.has(name) ? 2 : 1);

    return { exports, imports, usedInFile };
}

const isTest = (path) =>
    /\.test\.(ts|tsx)$/.test(path) || path.startsWith(join(sourceRoot, 'test'));
const isAmbient = (path) => path.endsWith('.d.ts');
const isPage = (path) => path.startsWith(join(sourceRoot, 'pages') + '/');
const isBenchSection = (path) =>
    path.startsWith(join(sourceRoot, 'pages/dev/sections') + '/');

const files = walk(sourceRoot);
const modules = new Map(files.map((path) => [path, readModule(path)]));

const pageEntries = files.filter(
    (path) => path === join(sourceRoot, 'app.tsx') || isPage(path),
);
const testEntries = files.filter(isTest);

function reach(entries) {
    const seen = new Set();
    const queue = [...entries];

    while (queue.length > 0) {
        const path = queue.pop();

        if (seen.has(path)) {
            continue;
        }

        seen.add(path);

        for (const { specifier } of modules.get(path).imports) {
            const target = resolveModule(specifier, path);

            if (target !== null && modules.has(target)) {
                queue.push(target);
            }
        }
    }

    return seen;
}

const reachedByPages = reach(pageEntries);
const reachedByTests = reach(testEntries);

const unreachedFiles = files.filter(
    (path) =>
        !reachedByPages.has(path) &&
        !reachedByTests.has(path) &&
        !isAmbient(path),
);
const testOnlyFiles = files.filter(
    (path) =>
        !reachedByPages.has(path) &&
        reachedByTests.has(path) &&
        !isTest(path) &&
        !isAmbient(path),
);

/** name -> importers, per exporting file */
const importedNames = new Map(files.map((path) => [path, new Map()]));

for (const [path, module] of modules) {
    for (const { specifier, names } of module.imports) {
        const target = resolveModule(specifier, path);

        if (target === null || !importedNames.has(target)) {
            continue;
        }

        const record = importedNames.get(target);

        for (const name of names === '*' ? ['*'] : names) {
            record.set(name, [...(record.get(name) ?? []), path]);
        }
    }
}

const deadExports = [];
const localOnlyExports = [];
const libraryLocalOnlyExports = [];
const testOnlyExports = [];

/** The design-system library: a prop type stays exported so a container can type against it. */
const isLibrary = (path) =>
    ['components/ui', 'components/skrum'].some((folder) =>
        path.startsWith(join(sourceRoot, folder) + '/'),
    );

for (const [path, module] of modules) {
    if (isTest(path) || isAmbient(path) || !reachedByPages.has(path)) {
        continue;
    }

    const record = importedNames.get(path);

    if (record.has('*')) {
        continue;
    }

    for (const name of module.exports) {
        if (name === '*') {
            continue;
        }

        if (
            name === 'default' &&
            (isPage(path) || path === join(sourceRoot, 'app.tsx'))
        ) {
            continue;
        }

        if (isBenchSection(path)) {
            continue;
        }

        const importers = record.get(name) ?? [];

        if (importers.length === 0) {
            const line = `${relative(root, path)}: ${name}`;

            if (name === 'default' || !module.usedInFile(name)) {
                deadExports.push(line);
            } else if (isLibrary(path)) {
                libraryLocalOnlyExports.push(line);
            } else {
                localOnlyExports.push(line);
            }

            continue;
        }

        if (importers.every(isTest)) {
            testOnlyExports.push(`${relative(root, path)}: ${name}`);
        }
    }
}

const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const declared = new Set([
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
]);
const importedPackages = new Map();

const notePackage = (specifier, from) => {
    const name = packageName(specifier);

    if (name !== null) {
        importedPackages.set(name, [
            ...(importedPackages.get(name) ?? []),
            from,
        ]);
    }
};

for (const [path, module] of modules) {
    for (const { specifier } of module.imports) {
        notePackage(specifier, relative(root, path));
    }
}

for (const config of ['vite.config.ts']) {
    const text = readFileSync(join(root, config), 'utf8');

    for (const match of text.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        notePackage(match[1], config);
    }
}

for (const stylesheet of readdirSync(join(root, 'resources/css'))) {
    const text = readFileSync(join(root, 'resources/css', stylesheet), 'utf8');

    for (const match of text.matchAll(
        /@(?:import|plugin)\s+['"]([^'"]+)['"]/g,
    )) {
        notePackage(match[1], `resources/css/${stylesheet}`);
    }
}

const unusedPackages = [...declared]
    .filter((name) => !importedPackages.has(name) && !toolingPackages.has(name))
    .sort();
const undeclaredPackages = [...importedPackages.keys()]
    .filter((name) => !declared.has(name) && !providedPackages.has(name))
    .sort()
    .map((name) => `${name} (first import: ${importedPackages.get(name)[0]})`);
const staleTooling = [...toolingPackages.keys()].filter(
    (name) => !declared.has(name),
);


/**
 * Every string literal of the TypeScript sources, read by the compiler.
 */
function stringLiterals() {
    const literals = new Set();

    for (const path of files) {
        if (isTest(path)) {
            continue;
        }

        const source = ts.createSourceFile(
            path,
            readFileSync(path, 'utf8'),
            ts.ScriptTarget.Latest,
            true,
            path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
        );
        const visit = (node) => {
            if (ts.isStringLiteralLike(node)) {
                literals.add(node.text);
            }

            ts.forEachChild(node, visit);
        };

        visit(source);
    }

    return literals;
}

function phpSources() {
    const phpFiles = (directory) =>
        existsSync(directory)
            ? readdirSync(directory).flatMap((name) => {
                  const path = join(directory, name);

                  if (statSync(path).isDirectory()) {
                      return phpFiles(path);
                  }

                  return name.endsWith('.php') ? [path] : [];
              })
            : [];

    return ['app', 'config', 'database', 'routes', 'resources/views', 'lang/en']
        .flatMap((folder) => phpFiles(join(root, folder)))
        .map((path) => readFileSync(path, 'utf8'))
        .join('\n');
}

/**
 * Keys of lang/en.json that no code spells. Keys that only the other locales
 * hold are the framework's own lines and are left alone.
 */
function unusedTranslationKeys() {
    const literals = stringLiterals();
    const php = phpSources();
    const spelledInPhp = (key) =>
        php.includes(`'${key.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`) ||
        php.includes(`"${key.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`);

    return Object.keys(
        JSON.parse(readFileSync(join(root, 'lang/en.json'), 'utf8')),
    )
        .filter((key) => !literals.has(key) && !spelledInPhp(key))
        .sort()
        .map((key) => JSON.stringify(key));
}

/**
 * Class names and custom properties that the stylesheets define after the
 * verbatim design-system block, and that no source file mentions.
 */
function unusedStyles() {
    const reference = readFileSync(
        join(root, 'docs/design-system/app.css'),
        'utf8',
    ).trimEnd();
    const stylesheet = readFileSync(join(root, 'resources/css/app.css'), 'utf8');
    const owned = [
        stylesheet.startsWith(reference)
            ? stylesheet.slice(reference.length)
            : stylesheet,
        ...readdirSync(join(root, 'resources/css'))
            .filter((name) => name !== 'app.css' && name.endsWith('.css'))
            .map((name) => readFileSync(join(root, 'resources/css', name), 'utf8')),
    ]
        .join('\n')
        .replace(/\/\*[\s\S]*?\*\//g, '');
    const haystack = [
        ...files.map((path) => readFileSync(path, 'utf8')),
        readFileSync(join(root, 'resources/views/app.blade.php'), 'utf8'),
    ].join('\n');
    const libraryClass =
        /^(excalidraw|App-|HelpDialog|Island|ToolIcon|layer-ui|library-|sidebar-|default-sidebar|context-menu|dropdown-menu|scroll-back|mobile-misc|main-menu|welcome-screen|popover|color-picker|lc-|lr-|dark$|light$)/;
    const unused = [];

    for (const name of new Set(
        [...owned.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((match) => match[1]),
    )) {
        if (!libraryClass.test(name) && !haystack.includes(name)) {
            unused.push(`.${name}`);
        }
    }

    const ownedTheme = [...owned.matchAll(/@theme[^{]*\{([\s\S]*?)\n\}/g)]
        .map((match) => match[1])
        .join('\n');

    for (const [, property] of ownedTheme.matchAll(/(--[\w-]+)\s*:/g)) {
        const utility = property.replace(
            /^--(?:animate|max-height|max-width|min-height|min-width|height|width|spacing|container|text|radius|shadow|ease|color)-/,
            '',
        );
        const mentioned =
            haystack.includes(utility) ||
            stylesheet.split(property).length > 2;

        if (!mentioned) {
            unused.push(property);
        }
    }

    return unused.sort();
}

const report = {
    unreachedFiles: unreachedFiles.map((path) => relative(root, path)).sort(),
    testOnlyFiles: testOnlyFiles.map((path) => relative(root, path)).sort(),
    deadExports: deadExports.sort(),
    localOnlyExports: localOnlyExports.sort(),
    libraryLocalOnlyExports: libraryLocalOnlyExports.sort(),
    testOnlyExports: testOnlyExports.sort(),
    unusedPackages,
    undeclaredPackages,
    staleTooling,
    unusedStyles: unusedStyles(),
    unusedTranslationKeys: process.argv.includes('--lang')
        ? unusedTranslationKeys()
        : [],
};

if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
} else {
    const titles = {
        unreachedFiles: 'Files that no page and no test reaches',
        testOnlyFiles:
            'Files that only a test reaches (owner approval before deleting the test)',
        deadExports: 'Exports that nothing uses, not even their own file',
        localOnlyExports:
            'Exports used only inside their own file (remove the export keyword)',
        libraryLocalOnlyExports:
            'Same, in components/ui and components/skrum (kept: public surface of the library)',
        testOnlyExports: 'Exports that only a test imports',
        unusedPackages: 'Declared packages that nothing imports',
        undeclaredPackages: 'Imported packages that package.json does not declare',
        staleTooling:
            'Tooling entries of this script that package.json no longer declares',
        unusedStyles:
            'Classes and theme variables of our own CSS that no source file mentions',
        unusedTranslationKeys:
            'Translation keys that no string literal of the code spells (only with --lang)',
    };

    for (const [key, title] of Object.entries(titles)) {
        console.log(`\n## ${title} (${report[key].length})`);

        for (const line of report[key]) {
            console.log(line);
        }
    }
}

const blocking = [
    'unreachedFiles',
    'deadExports',
    'localOnlyExports',
    'unusedPackages',
    'undeclaredPackages',
    'staleTooling',
    'unusedStyles',
];

process.exit(blocking.some((key) => report[key].length > 0) ? 1 : 0);
```

```bash
chmod +x bin/front-unused.mjs
```

- [ ] **Step 2: Prove the script sees a dead file and a dead export**

```bash
printf "export const zzProbe = 1;\n" > resources/js/lib/zz-unused-probe.ts
printf "\nexport const zzDeadExport = 1;\n" >> resources/js/lib/utils.ts
node bin/front-unused.mjs | grep -n "zz"
```

Expected: two lines, `resources/js/lib/zz-unused-probe.ts` under "Files that no page and no test reaches" and `resources/js/lib/utils.ts: zzDeadExport` under "Exports that nothing uses".

```bash
rm resources/js/lib/zz-unused-probe.ts
git checkout resources/js/lib/utils.ts
node bin/front-unused.mjs | grep -c "zz"
```

Expected: `0`.

- [ ] **Step 3: Save the first report**

```bash
node bin/front-unused.mjs --lang > "$LEDGER/reports/unused-before.txt"; echo "exit $?"
grep "^## " "$LEDGER/reports/unused-before.txt"
```

Expected: eleven `## ` headings, each ending with a count. Copy the eleven lines into `progress.md`.

- [ ] **Step 4: Write the page wiring test**

`tests/Arch/FrontEndPagesTest.php`:

```php
<?php

/**
 * Pages no PHP file renders by a literal name, with the reason (for instance
 * an error page whose name the exception handler builds from the status code).
 */
const PagesRenderedIndirectly = [];

/**
 * @return array<int, string> Inertia component names, e.g. `retros/show`
 */
function pageComponents(string $root): array
{
    $pages = "{$root}/resources/js/pages";
    $components = [];
    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($pages, FilesystemIterator::SKIP_DOTS));

    foreach ($files as $file) {
        $component = substr($file->getPathname(), strlen($pages) + 1, -strlen('.tsx'));

        if ($file->getExtension() !== 'tsx' || str_ends_with($component, '.test') || str_starts_with($component, 'dev/sections/')) {
            continue;
        }

        $components[] = $component;
    }

    sort($components);

    return $components;
}

/**
 * @return array<int, string> Inertia components named in the PHP sources
 */
function renderedComponents(string $root): array
{
    $components = [];

    foreach (['app', 'routes', 'bootstrap'] as $folder) {
        $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator("{$root}/{$folder}", FilesystemIterator::SKIP_DOTS));

        foreach ($files as $file) {
            if ($file->getExtension() !== 'php') {
                continue;
            }

            preg_match_all(
                '/(?:Inertia::render|Route::inertia|\binertia)\(\s*(?:[\'"][^\'"]*[\'"]\s*,\s*)?[\'"]([\w\/-]+)[\'"]/',
                (string) file_get_contents($file->getPathname()),
                $matches,
            );

            $components = [...$components, ...$matches[1]];
        }
    }

    $components = array_values(array_unique($components));
    sort($components);

    return $components;
}

it('has a page file for every component the server renders, and renders every page file', function () {
    $root = dirname(__DIR__, 2);
    $pages = pageComponents($root);
    $rendered = renderedComponents($root);

    expect($pages)->not->toBeEmpty()
        ->and(array_values(array_diff($rendered, $pages)))->toBe([])
        ->and(array_values(array_diff($pages, $rendered, array_keys(PagesRenderedIndirectly))))->toBe([])
        ->and(array_values(array_diff(array_keys(PagesRenderedIndirectly), $pages)))->toBe([]);
});
```

- [ ] **Step 5: Run it**

Run: `vendor/bin/sail artisan test --compact tests/Arch/FrontEndPagesTest.php`
Expected: 1 passed.

If it fails, read which side is not empty. A component the server renders without a page file is a bug of 18e or 18f: stop and report. A page file nothing renders is either dead (it goes in Task 3) or rendered by a name built at run time: then add it to `PagesRenderedIndirectly` with the file and line that builds the name as its reason.

- [ ] **Step 6: Format, lint, commit**

```bash
npm run check:fix && npm run check
vendor/bin/pint --dirty --format agent
git add bin/front-unused.mjs tests/Arch/FrontEndPagesTest.php
git commit -m "test(front): script that lists unused front-end code, and a test that every rendered page exists"
```

Expected: `npm run check` exits 0. If oxlint reports a finding in the script, fix the line without changing what the script prints, and run Step 2 again.

---

### Task 3: Remove dead files and dead exports

**Files:**
- Delete: what `bin/front-unused.mjs` lists under "Files that no page and no test reaches" and passes the deletion rule.
- Modify: the files listed under "Exports that nothing uses" and "Exports used only inside their own file".

**Interfaces:**
- Consumes: `node bin/front-unused.mjs --json` (Task 2).
- Produces: a tree where `unreachedFiles`, `deadExports` and `localOnlyExports` are empty, and `$LEDGER/reports/deleted-files.txt`, read by Task 10 and by the final report.

Known candidates, from `inventory-components.md` §1.11, `inventory-pages.md` §I and the notes of the 18e controller. None is deleted because it is on this list: the script and the deletion rule decide. The list is there so that a candidate that is still imported is noticed and explained.

| Group | Files |
|---|---|
| Starter-kit shell | `resources/js/components/app-shell.tsx`, `app-content.tsx`, `app-sidebar.tsx`, `app-sidebar-header.tsx`, `app-logo.tsx`, `app-logo-icon.tsx`, `nav-main.tsx`, `nav-user.tsx`, `user-info.tsx`, `heading.tsx`, `text-link.tsx`, `appearance-tabs.tsx`, `delete-user.tsx`, `alert-error.tsx`, `input-error.tsx`, `password-input.tsx`, `language-switcher.tsx`, `notification-bell.tsx`, `user-menu-content.tsx` |
| Old layouts | `resources/js/layouts/app-layout.tsx`, `layouts/auth-layout.tsx`, `layouts/app/app-sidebar-layout.tsx`, `layouts/auth/auth-simple-layout.tsx`, `layouts/settings/layout.tsx` |
| Deletions the 18e groups deferred because several screens shared the file | `components/poker/deck-fields.tsx`, `components/retro/icebreaker-game-select.tsx`, `components/retro/ai-summary-switch.tsx`, `components/templates/template-chips.tsx`, `components/confirm-form-dialog.tsx`, `components/workspace-switcher.tsx`, `components/action-items/*`, `components/retro/board-context.tsx`, `comment-thread.tsx`, `reaction-chips.tsx`, `emoji-picker.tsx` |
| Old live pieces replaced by the shared session containers | `components/realtime/flying-reactions.tsx`, `components/realtime/live-cursors.tsx`, `components/retro/connection-banner.tsx`, `session-expired-banner.tsx`, `presence-strip.tsx`, `timer-display.tsx`, `live-cursor-layer.tsx`, `components/gifs/gif-search-dialog.tsx` |
| Auth and security pieces at the root | `components/manage-passkeys.tsx`, `manage-two-factor.tsx`, `passkey-item.tsx`, `passkey-register.tsx`, `passkey-verify.tsx`, `two-factor-recovery-codes.tsx`, `two-factor-setup-modal.tsx`, `sso-buttons.tsx` |
| Hooks and types of the old shell | `hooks/use-mobile-navigation.ts`, `use-current-url.ts`, `use-is-mounted.ts`, `use-initials.tsx`, `use-flash-toast.ts`, `use-comment-notifications.ts`, `types/navigation.ts`, `types/ui.ts` |
| Old colour data | `lib/retro/colors.ts` (the six-colour palette, replaced by B10) |
| Kept on purpose by 18e (must not be listed as dead) | `components/games/room-context.tsx`, `drawing-canvas.tsx`, `clue-row.tsx`, `gif-tile.tsx`; `lib/**` reducers and API modules; the channel hooks; `use-countdown`, `use-trans`, `use-appearance`, `use-local-preference`, `use-clipboard` (spec §6.1) |

- [ ] **Step 1: See which candidates are still there, and who imports them**

```bash
for file in \
  components/app-shell.tsx components/app-content.tsx components/app-sidebar.tsx components/app-sidebar-header.tsx \
  components/app-logo.tsx components/app-logo-icon.tsx components/nav-main.tsx components/nav-user.tsx \
  components/user-info.tsx components/heading.tsx components/text-link.tsx components/appearance-tabs.tsx \
  components/delete-user.tsx components/alert-error.tsx components/input-error.tsx components/password-input.tsx \
  components/language-switcher.tsx components/notification-bell.tsx components/user-menu-content.tsx \
  layouts/app-layout.tsx layouts/auth-layout.tsx layouts/app/app-sidebar-layout.tsx layouts/auth/auth-simple-layout.tsx layouts/settings/layout.tsx \
  components/poker/deck-fields.tsx components/retro/icebreaker-game-select.tsx components/retro/ai-summary-switch.tsx \
  components/templates/template-chips.tsx components/confirm-form-dialog.tsx components/workspace-switcher.tsx \
  components/retro/board-context.tsx components/retro/comment-thread.tsx components/retro/reaction-chips.tsx components/retro/emoji-picker.tsx \
  components/realtime/flying-reactions.tsx components/realtime/live-cursors.tsx components/retro/connection-banner.tsx \
  components/retro/session-expired-banner.tsx components/retro/presence-strip.tsx components/retro/timer-display.tsx \
  components/retro/live-cursor-layer.tsx components/gifs/gif-search-dialog.tsx \
  components/manage-passkeys.tsx components/manage-two-factor.tsx components/passkey-item.tsx components/passkey-register.tsx \
  components/passkey-verify.tsx components/two-factor-recovery-codes.tsx components/two-factor-setup-modal.tsx components/sso-buttons.tsx \
  hooks/use-mobile-navigation.ts hooks/use-current-url.ts hooks/use-is-mounted.ts hooks/use-initials.tsx hooks/use-flash-toast.ts \
  hooks/use-comment-notifications.ts types/navigation.ts types/ui.ts lib/retro/colors.ts
do
  [ -e "resources/js/$file" ] || continue
  module="@/${file%.*}"
  echo "== $file — imported by: $(grep -rlF "'$module'" resources/js --include='*.ts' --include='*.tsx' | grep -v '\.test\.' | tr '\n' ' ')"
done | tee "$LEDGER/reports/candidates.txt"
ls resources/js/components/action-items 2>/dev/null
```

Expected: one line per candidate that still exists. A candidate with no importer will be in the script's list (Step 2). A candidate with an importer is still used by a rewritten screen: it is not deleted here, and the line goes in `progress.md` as "old file still in use: <file>, by <importers>". Task 4 rewrites it (owner, 2026-10-02: none remains at the end).

- [ ] **Step 2: List what the script would delete and check that nothing names it**

```bash
node bin/front-unused.mjs --json > "$LEDGER/reports/unused.json"
node -e '
const report = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
for (const file of report.unreachedFiles) console.log(file);
' "$LEDGER/reports/unused.json" | while read -r file; do
  name=$(basename "$file" | sed -E 's/\.(tsx|ts)$//')
  module=$(echo "$file" | sed -E 's#^resources/js/##; s/\.(tsx|ts)$//')
  echo "== $file"
  grep -rnF -e "$module" -e "/$name." app routes config resources/views tests bin vite.config.ts 2>/dev/null | head -5
done | tee "$LEDGER/reports/unreached-check.txt"
```

Expected: under each `== file` line, nothing. A line under a file means something names it without importing it (a page rendered by PHP, a test that reads the file from disk): that file stays, and the reason goes in `progress.md`.

- [ ] **Step 3: Delete the files that passed, one group per commit**

```bash
git rm <the files of one group that passed Step 2>
npm run types:check && npm run test && npm run check
git commit -m "chore(front): remove the starter-kit shell left unused by the rewrite"
```

Expected: the three commands exit 0. Use one commit per group of the table (shell, old layouts, deferred shared files, old live pieces, auth pieces, hooks and types). Append every deleted path to `$LEDGER/reports/deleted-files.txt`.

Files under "Files that only a test reaches" are not deleted: copy that section into `progress.md` under "Awaiting the owner: unreachable code kept for its test".

- [ ] **Step 4: Run the script again until it lists no file**

```bash
node bin/front-unused.mjs | sed -n '/^## Files that no page/,/^## Files that only/p'
```

Expected: `## Files that no page and no test reaches (0)`. Deleting a file can make another one unreachable: repeat Steps 2 and 3 until the count is 0.

- [ ] **Step 5: Remove the dead exports**

```bash
node bin/front-unused.mjs | sed -n '/^## Exports that nothing uses/,/^## Same, in components/p'
```

For each line `path: name` of "Exports that nothing uses, not even their own file": delete the declaration (and what only it used). For each line of "Exports used only inside their own file": remove the `export` keyword and nothing else. A re-export (`export type { X } from '…'`) that nothing imports is deleted. The section "Same, in components/ui and components/skrum" is left as it is: the prop types of the library stay exported.

Do not touch a name that a browser test, a Blade view or PHP spells:

```bash
grep -rnw "<name>" app routes resources/views tests | head
```

Expected: nothing, before the export is removed.

```bash
npm run types:check && npm run test && npm run check
node bin/front-unused.mjs | grep -E "^## (Files that no page|Exports that nothing uses|Exports used only inside)"
git commit -am "chore(front): remove exports that nothing imports"
```

Expected: the three counts are `(0)`.

- [ ] **Step 6: Gate of the task**

```bash
npm run build:front
vendor/bin/sail artisan test --parallel --processes=8 --compact
bin/test-browser
```

Expected: same pass counts as the baseline of Task 1 for the feature and browser suites, 0 failed. A browser failure here means a deleted file was in use: restore it with `git revert` of the commit that removed it, write why in `progress.md`, and run the gate again.

---

### Task 4: Rewrite the old view components a rewritten screen still imports

Owner's answer of 2026-10-02 (second round, "18g boundary"): the old view components still imported after 18e are **rewritten in 18g; none remains at the end**. The first version of this plan kept them and reported them; that line moved. This task finds them, rewrites each on the design-system library, and leaves a check that fails as long as one is left.

**Files:**
- Create: `bin/front-old-components.mjs`
- Rewrite or delete: each file the script lists
- Create or modify: one Vitest file per rewritten component; the captures of the pages that mount it

**Interfaces:**
- Consumes: `node bin/front-unused.mjs --json` (Task 2); the tree Task 3 left; `$LEDGER/reports/candidates.txt` (Task 3 Step 1); the 18e report's list "old file kept, with its importer" (18e Task F1 Step 1); `docs/superpowers/research/front-rewrite/inventory-components.md`; the mockups of spec §7.
- Produces: `node bin/front-old-components.mjs <base> [--json]` — sections `old`, `headless`, `exempt`, `staleExemptions`; exit 1 while `old` or `staleExemptions` is not empty. `$LEDGER/base-18e` (the commit the screen rewrite started from). `$LEDGER/reports/rewrites/<component>.md`, one per component, read by Task 11.

**What "old view component" means here.** A `.tsx` file under `resources/js/components` or `resources/js/layouts`, outside the folders the design-system phases wrote (`components/ui`, `components/skrum`, `components/admin`, `layouts/skrum`), that existed when plan 18e started, that no commit of 18e, 18f or this plan has touched since, that renders markup of its own, and that a page still reaches. A file 18e rewrote in place is not old, whatever its name. A file without markup (a context, a provider, a headless helper) is not a view: it is classified by reading, and exempted in the script with its reason.

- [ ] **Step 1: The base commit**

```bash
cat .superpowers/sdd/*plan-18e*/progress.md | grep -m1 -i "^Branch:"
git merge-base plan-18d-branding HEAD
```

The first line is the ledger of 18e ("Branch: … (from <commit>)"); the second is the fallback. They name the same commit unless `plan-18d-branding` moved after 18e branched: the ledger wins. Write it down:

```bash
echo "<commit>" > "$LEDGER/base-18e"
git cat-file -t "$(cat "$LEDGER/base-18e")"
```

Expected: `commit`.

- [ ] **Step 2: Write the detection script**

`bin/front-old-components.mjs`:

```js
#!/usr/bin/env node
/**
 * Lists the view components of the old front end that a page still reaches.
 * Read-only.
 *
 *   node bin/front-old-components.mjs <base commit> [--json]
 *
 * <base commit> is the commit the screen rewrite (plan 18e) started from.
 * A file is "old" when it existed at that commit, lies outside the
 * design-system library, renders markup, and no commit has touched it since.
 * Exit 1 while one is listed, or while an exemption no longer applies.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const [base] = process.argv.slice(2).filter((argument) => !argument.startsWith('--'));

if (base === undefined) {
    console.error('usage: node bin/front-old-components.mjs <base commit> [--json]');
    process.exit(2);
}

/** Folders the design-system phases (18a–18d) wrote: never old. */
const libraryFolders = [
    'resources/js/components/ui/',
    'resources/js/components/skrum/',
    'resources/js/components/admin/',
    'resources/js/layouts/skrum/',
];

/**
 * Files that existed before the rewrite, are still untouched, and are not
 * views: a context, a provider or a headless helper kept on purpose (spec
 * §6.1). Each entry carries its reason. An entry is added only for a file
 * that returns no element of its own.
 */
const notViews = new Map([]);

const git = (...parameters) =>
    execFileSync('git', parameters, { cwd: root, encoding: 'utf8' }).trim();

const unused = JSON.parse(
    spawnSync('node', [join(root, 'bin/front-unused.mjs'), '--json'], {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
    }).stdout,
);
const notReached = new Set([...unused.unreachedFiles, ...unused.testOnlyFiles]);

const rendersMarkup = (path) =>
    /<[A-Za-z][\w.]*[\s/>]/.test(
        readFileSync(join(root, path), 'utf8').replace(/<[A-Z]\w*(?:,\s*\w+)*>\(/g, '('),
    );

const candidates = git('ls-tree', '-r', '--name-only', base, '--', 'resources/js/components', 'resources/js/layouts')
    .split('\n')
    .filter((path) => path.endsWith('.tsx') && !/\.test\.tsx$/.test(path))
    .filter((path) => !libraryFolders.some((folder) => path.startsWith(folder)))
    .filter((path) => existsSync(join(root, path)) && !notReached.has(path));

const untouched = candidates.filter(
    (path) => git('log', '--oneline', `${base}..HEAD`, '--', path) === '',
);

const importersOf = (path) => {
    const module = `@/${path.replace(/^resources\/js\//, '').replace(/\.tsx$/, '')}`;
    const found = spawnSync('git', ['grep', '-lF', `'${module}'`, '--', 'resources/js'], {
        cwd: root,
        encoding: 'utf8',
    }).stdout;

    return found
        .split('\n')
        .filter((file) => file !== '' && !/\.test\.tsx?$/.test(file) && file !== path);
};

const old = untouched
    .filter((path) => !notViews.has(path))
    .filter(rendersMarkup)
    .map((path) => ({ path, importers: importersOf(path) }));
const headless = untouched.filter((path) => !notViews.has(path) && !rendersMarkup(path));
const staleExemptions = [...notViews.keys()].filter((path) => !untouched.includes(path));

const report = { old, headless, exempt: [...notViews], staleExemptions };

if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
} else {
    console.log(`\n## Old view components a page still reaches (${old.length})`);

    for (const { path, importers } of old) {
        console.log(`${path} — imported by: ${importers.join(', ') || '(a relative import: git grep the file name)'}`);
    }

    console.log(`\n## Untouched files without markup, to classify by reading (${headless.length})`);

    for (const path of headless) {
        console.log(path);
    }

    console.log(`\n## Exempt: not a view (${notViews.size})`);

    for (const [path, reason] of notViews) {
        console.log(`${path} — ${reason}`);
    }

    console.log(`\n## Exemptions that no longer apply (${staleExemptions.length})`);

    for (const path of staleExemptions) {
        console.log(path);
    }
}

process.exit(old.length > 0 || staleExemptions.length > 0 ? 1 : 0);
```

```bash
chmod +x bin/front-old-components.mjs
```

- [ ] **Step 3: Prove the script on two bases whose answer is known**

```bash
node bin/front-old-components.mjs "$(git rev-list --max-parents=0 HEAD | tail -1)" | grep "^## Old view components"
node bin/front-old-components.mjs HEAD | grep "^## Old view components"
```

Expected: the first line ends with `(0)` — nothing existed at the first commit of the repository, so nothing is old. The second ends with the number of view files outside the library that a page reaches today — with `HEAD` as the base every file is "untouched since": it is the upper bound of the real run, and it must be greater than 0. Then the real run:

```bash
node bin/front-old-components.mjs "$(cat "$LEDGER/base-18e")" | tee "$LEDGER/reports/old-components-before.txt"; echo "exit ${PIPESTATUS[0]}"
```

Expected: the list of this task. Before 18e the same command, run on `plan-18d-branding` against a commit that predates the rewrite, listed 235 files: the whole old front end. After 18e it should list what 18e's report calls "old file kept, with its importer", and no more. Compare the two lists; a file on one and not on the other is explained in `progress.md` (touched by a formatting commit: then it is old all the same — add it by hand to the work list of Step 5; listed by 18e but since rewritten by 18f: nothing to do).

- [ ] **Step 4: Classify what is not a view**

The section "Untouched files without markup, to classify by reading" holds contexts, providers and headless helpers. Read each one. A file that returns no element of its own (only `children`, a context provider, or nothing) goes into the `notViews` map of the script with its reason, for instance:

```js
const notViews = new Map([
    ['resources/js/components/games/room-context.tsx', 'context of the game room, no markup (spec §6.1: kept)'],
]);
```

A file that does render something through a helper the regular expression missed is a view: it joins the work list. Run the script again: the section is empty or holds only files that are in neither list by mistake, which is fixed before going on.

- [ ] **Step 5: The work list, in dependency order**

```bash
node bin/front-old-components.mjs "$(cat "$LEDGER/base-18e")" --json > "$LEDGER/reports/old-components.json"
node -e '
const { old } = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
const paths = new Set(old.map((entry) => entry.path));
const order = [...old].sort((a, b) =>
    a.importers.filter((file) => paths.has(file)).length - b.importers.filter((file) => paths.has(file)).length || a.path.localeCompare(b.path));
for (const { path, importers } of order) console.log(`- [ ] ${path} — ${importers.length} importer(s)`);
' "$LEDGER/reports/old-components.json" | tee -a "$LEDGER/progress.md"
```

A component that other old components import comes after them (leaves first), so that each rewrite stands on files already rewritten. Group the list by screen (spec §7 row) in `progress.md`; one agent per screen group may take its components in parallel only when no two groups share a file.

- [ ] **Step 6: Rewrite one component — the pattern, applied to every line of the list**

One component, one commit. For the component `<path>`:

1. **Read.** The file; its importers; its row in `inventory-components.md`; the mockup of the screen that mounts it (spec §7) and the README of the library component that draws the same thing (`docs/design-system/components/<Name>/README.md`); every browser test that reaches into it:

   ```bash
   name=$(basename "<path>" .tsx)
   grep -rnE "data-test=|data-realtime|data-presence-id|id=|aria-label=|data-slot=" "<path>"
   grep -rln -e "<each data-test, id and label found above>" tests/Browser | sort -u
   ```

2. **Decide, and write the decision** in `$LEDGER/reports/rewrites/$name.md` (target, hooks kept, tests run, captures taken, mockup differences):
   - **Replace**: a library component already does the job (`components/skrum/*` or `components/ui/*`). The importers call it directly, through the adapter 18e wrote for that screen if there is one; the old file is deleted.
   - **Rewrite in place**: the file is a container (it holds state, requests or a channel). It keeps its path and exports and becomes a container over library components: tokens only, no arbitrary size, lucide icons, `t('…')` keys — the rules of spec §5 that Task 6 then enforces.
   - **Compose**: no library component exists for it. It is composed from `components/ui` primitives in the anatomy of the nearest mockup, and listed in the final report under "components composed from primitives because the design system has none". It is never left as it is.
   
   No new feature, no change of behaviour, no new base folder, no new dependency.

3. **Hooks kept.** Every `data-test`, `data-realtime`, `data-presence-id`, element id and English accessible name the browser suite uses stays, on an element of the same role. The mockup may impose another label or another flow: then the browser test changes in this commit, and the report file names the test, the old and new assertion, and the line of the mockup's README or `preview.html` that imposes it (owner's rule of 2026-10-02: a browser test that contradicts the mockup changes, and the task lists it).

4. **Test first.** `resources/js/components/…/$name.test.tsx` (or the importer's test when the file is deleted): one case per state the old component had (read its conditionals), one per callback, one per hook of point 3. Run it: it fails against the new markup or passes against the old one — in the second case it is a characterisation test and must stay green through the rewrite.

5. **Rewrite**, then:

   ```bash
   npm run test -- "$name"
   npm run types:check && npm run check && npm run build:front
   BROWSER_REVERB_PORT=8098 DB_HOST=127.0.0.1 DB_DATABASE=testing_browser_1 php -d memory_limit=2G vendor/bin/pest <each browser file of point 1>
   ```

   Expected: all pass.

6. **Captures, against the mockup.** Run the visual test of each page that mounts the component (`tests/Browser/Visual/*` of 18e for that screen, single file as above). Open every capture that changed beside the mockup's `preview.html`: the component must now match it — layout, placement, labels, states. A difference is fixed, or written in the report file as a deviation with its reason (false or unsafe, accessibility, data the product does not have at all), and carried to the deviations table of Task 8.

7. **Commit.**

   ```bash
   git add -A resources/js tests lang
   git commit -m "refactor(front): <component> on the design-system library"
   ```

   Then `node bin/front-old-components.mjs "$(cat "$LEDGER/base-18e")" | head -3`: the count went down by one (or more, when the importers of a deleted file were the last users of another).

Stop and report, without committing, when: a rewrite needs a product decision the mockups and the owner's answers do not give; a browser test fails for a reason other than a label or flow the mockup imposes; the component is the only user of a package that would have to change version.

- [ ] **Step 7: Nothing old is left**

```bash
node bin/front-old-components.mjs "$(cat "$LEDGER/base-18e")"; echo "exit $?"
node bin/front-unused.mjs | grep -E "^## (Files that no page|Exports that nothing uses|Exports used only inside)"
```

Expected: `## Old view components a page still reaches (0)`, `## Exemptions that no longer apply (0)`, `exit 0`; the three counts of the second command are `(0)` — a rewrite can leave a file or an export without user: run Task 3 Steps 2 to 5 again on what appears.

- [ ] **Step 8: Gate of the task**

```bash
npm run build:front && npm run types:check && npm run check && npm run test
vendor/bin/sail artisan test --parallel --processes=8 --compact
bin/test-browser
git add bin/front-old-components.mjs
git commit -m "chore(front): script that lists the old view components a page still reaches"
```

Expected: every command exits 0; `bin/test-browser` ends with `Total: PASS`, with the count of the baseline, or the baseline changed only by the tests listed in the `rewrites/*.md` files. The script is committed last, with its final `notViews` map; `npm run check` passes on it.

---

### Task 5: Remove dead CSS, translation keys, packages and starter-kit leftovers

**Files:**
- Modify: `resources/css/app.css` (after line 475 only), `resources/css/excalidraw-theme.css`
- Modify: `lang/en.json`, `lang/fr.json`, `lang/es.json`, `lang/de.json`
- Modify: `package.json`, `package-lock.json`
- Delete: starter-kit files left under `public/` and `resources/`

**Interfaces:**
- Consumes: `node bin/front-unused.mjs --json --lang` (Task 2), the tree left by Task 3.
- Produces: a tree where `unusedStyles`, `unusedPackages` and `staleTooling` are empty; `$LEDGER/reports/removed-keys.txt` and `$LEDGER/reports/removed-packages.txt` for the final report; `$LEDGER/knip.json` (configuration, untracked), `$LEDGER/reports/knip.json`, `knip.txt` and `knip-classified.txt` (the evidence of AC6, read by Task 11).

- [ ] **Step 1: CSS**

```bash
node bin/front-unused.mjs | sed -n '/^## Classes and theme variables/,/^## Translation keys/p'
```

For each class or `--variable` listed, confirm that nothing builds its name at run time or selects it in a test:

```bash
grep -rnF -- "<name without the leading dot>" resources/js resources/views tests docs/design-system/components | head
```

Expected: nothing in `resources/js`, `resources/views` or `tests`. Then delete its rule from the part of `app.css` after the design-system block, or from `excalidraw-theme.css`. A class that only the design-system block defines is never listed and never removed. A class added to an Excalidraw element by Excalidraw itself is not ours: add its prefix to `libraryClass` in the script instead of deleting the rule.

```bash
vendor/bin/sail artisan test --compact tests/Feature/DesignTokensTest.php tests/Feature/LightScopeTokensTest.php
npm run test
```

Expected: all pass (`whiteboard-theme.test.ts` reads `excalidraw-theme.css` from disk).

- [ ] **Step 2: Translation keys**

```bash
node bin/front-unused.mjs --json --lang > "$LEDGER/reports/unused.json"
node -e '
const report = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
for (const key of report.unusedTranslationKeys) console.log(key);
' "$LEDGER/reports/unused.json" > "$LEDGER/reports/candidate-keys.txt"
wc -l < "$LEDGER/reports/candidate-keys.txt"
```

Each line is a key of `lang/en.json`, JSON-quoted, that no TypeScript string literal and no quoted PHP string spells. A key can still be spelled by a data file, or built from parts. Keep only the keys that nothing else spells:

```bash
node -e '
const fs = require("fs");
const { execFileSync } = require("child_process");
const keep = [];
for (const line of fs.readFileSync(process.argv[1], "utf8").split("\n").filter(Boolean)) {
    const key = JSON.parse(line);
    let found = "";
    try {
        found = execFileSync("grep", ["-rlF", "--exclude-dir=actions", "--exclude-dir=routes", "--exclude-dir=wayfinder", "--", key, "app", "config", "database", "routes", "resources", "tests"], { encoding: "utf8" });
    } catch {
        found = "";
    }
    if (found.trim() === "") keep.push(line);
    else console.error(`kept ${line}: spelled in ${found.trim().split("\n")[0]}`);
}
fs.writeFileSync(process.argv[2], keep.join("\n") + (keep.length ? "\n" : ""));
' "$LEDGER/reports/candidate-keys.txt" "$LEDGER/reports/removed-keys.txt"
wc -l < "$LEDGER/reports/removed-keys.txt"
```

Expected: the second count is at most the first. The keys printed as `kept` are spelled somewhere (a test, a seeder, a JSON data file): they stay.

Read `removed-keys.txt` once. Take out by hand any key that looks like a sentence the server could build from an enum or a status (`:count …` plurals whose singular is in use, role or status names). When in doubt the key stays: an unused key costs nothing, a missing one shows English to a French reader.

```bash
node -e '
const fs = require("fs");
const keys = fs.readFileSync(process.argv[1], "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
for (const locale of ["en", "fr", "es", "de"]) {
    const path = `lang/${locale}.json`;
    const lines = JSON.parse(fs.readFileSync(path, "utf8"));
    for (const key of keys) delete lines[key];
    fs.writeFileSync(path, JSON.stringify(lines, null, 4) + "\n");
}
' "$LEDGER/reports/removed-keys.txt"
git diff --stat lang
vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php
```

Expected: the diff shows only deleted lines in the four files (the files are written with a four-space indent and a final newline, as they are today); `TranslationKeysTest` passes. The keys that only `fr`, `es` and `de` hold are the framework's lines and are never candidates.

```bash
git commit -am "chore(i18n): remove the translation keys that nothing spells any more"
```

- [ ] **Step 3: Packages**

```bash
node bin/front-unused.mjs | sed -n '/^## Declared packages/,/^## Classes and theme/p'
```

For each package under "Declared packages that nothing imports", confirm that no config, script or PHP file names it:

```bash
grep -rnF -- "<package>" vite.config.ts composer.json components.json resources/css bin .github app config 2>/dev/null | head
```

Expected: nothing. Then:

```bash
npm uninstall <package>
echo "<package>" >> "$LEDGER/reports/removed-packages.txt"
```

Candidates named by the spec and the inventory: `@radix-ui/react-navigation-menu` (already gone if 18a removed it), the Radix packages of primitives that no longer exist (`@radix-ui/react-toggle`, `-toggle-group`, `-collapsible`, `-separator`, `-avatar`, `-label`, `-tooltip`), `frimousse` if the emoji picker was rebuilt without it. `live-cursors`, `live-reactions`, `@dnd-kit/*`, `@excalidraw/excalidraw`, `input-otp` and `sonner` are kept by spec §4.1: if the script lists one of them, the browser suite still targets `.lc-overlay` and `button[frimousse-emoji]`, so stop and report instead of uninstalling.

A package under "Imported packages that package.json does not declare" is never added here (no new dependency). `@testing-library/user-event` is no longer in that section: Task 1 Step 4 declared it. Any other package listed there is written in `progress.md` under "Awaiting the owner" and left. `optionalDependencies` are not read by the script and are not touched.

A line under "Tooling entries of this script that package.json no longer declares" means the script's `toolingPackages` names a package that is gone: delete that entry from the script.

- [ ] **Step 4: Prove a clean install still builds**

```bash
rm -rf node_modules
npm ci
npm run build:front && npm run types:check && npm run check && npm run test
git add package.json package-lock.json bin/front-unused.mjs
git commit -m "chore(front): remove the packages that nothing imports"
```

Expected: all exit 0. A build that fails after `npm ci` and passed before means a removed package was needed without being imported: `npm install <package>@<the version it had in git>`, add it to `toolingPackages` with its reason, and run the step again. Skip the commit when nothing was removed.

- [ ] **Step 5: Starter-kit leftovers**

```bash
grep -rniE "laravel\.com|laracasts|react-starter-kit|cloud\.laravel|instrument[- ]sans|fonts\.bunny|bunny\.net" resources public config/app.php vite.config.ts | grep -v "^resources/js/\(actions\|routes\|wayfinder\)/"
grep -rnE "AppLogoIcon|PlaceholderPattern|NavFooter|AppHeader" resources/js | head
ls public
ls resources/js/components/*.tsx 2>/dev/null
grep -rn "sk-[a-z]\|_preview-bundle" resources/js resources/css resources/views | head
```

Expected: the first, second and last commands print nothing. `public` holds `brand`, `build`, `favicon.svg`, `index.php`, `robots.txt` and nothing of the starter kit (`favicon.ico`, `apple-touch-icon.png`, `logo.svg`). The root of `resources/js/components` holds only files that Task 3 found in use. Anything else found is removed under the deletion rule and committed:

```bash
git commit -am "chore(front): remove the last starter-kit files"
```

- [ ] **Step 6: The one `knip` run (evidence of AC6), cross-checked with the script**

`knip` is run once, through `npx`, at a pinned version. It is not installed: its configuration lives in the ledger (untracked), and the step ends by proving that the manifest did not move.

```bash
cat > "$LEDGER/knip.json" <<'JSON'
{
    "entry": [
        "resources/js/app.tsx",
        "resources/js/pages/**/*.tsx",
        "resources/js/**/*.test.{ts,tsx}",
        "resources/js/test/**/*.{ts,tsx}",
        "bin/*.mjs",
        "vite.config.ts"
    ],
    "project": ["resources/js/**/*.{ts,tsx}", "bin/*.mjs"],
    "ignore": [
        "resources/js/actions/**",
        "resources/js/routes/**",
        "resources/js/wayfinder/**"
    ],
    "ignoreExportsUsedInFile": false
}
JSON
npx --yes knip@6.39.0 --config "$LEDGER/knip.json" --reporter json --no-exit-code > "$LEDGER/reports/knip.json"
npx --yes knip@6.39.0 --config "$LEDGER/knip.json" --no-exit-code > "$LEDGER/reports/knip.txt"
git status --short package.json package-lock.json | wc -l
```

Expected: both report files are written; the last count is `0` (`npx` keeps the package in its own cache). Every page is an entry because the server names pages by a string, as in the script. If `knip` stops on its configuration (an option renamed in the version run), read `npx --yes knip@6.39.0 --help`, correct `$LEDGER/knip.json`, and write the change in `progress.md`; the entries, the three ignored generated folders and `ignoreExportsUsedInFile: false` are the part that must not change, because they are what makes the two tools comparable.

Classify every finding. The JSON reporter prints `{ "issues": [ { "file": "…", "files": […], "exports": [{ "name": … }], "types": [{ "name": … }], "dependencies": […], "devDependencies": […], "unlisted": […], … } ] }`:

```bash
node -e '
const fs = require("fs");
const knip = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const ours = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const kept = new Set(ours.libraryLocalOnlyExports);
const testOnly = new Set(ours.testOnlyFiles);
const library = /^resources\/js\/components\/(ui|skrum)\//;
const lines = { keptLibrary: [], keptTestOnly: [], toResolve: [] };
for (const issue of knip.issues) {
    for (const [kind, items] of Object.entries(issue)) {
        if (!Array.isArray(items)) continue;
        for (const item of items) {
            const line = `${issue.file}: ${item.name}`;
            if ((kind === "exports" || kind === "types") && library.test(issue.file) && kept.has(line)) lines.keptLibrary.push(line);
            else if (kind === "files" && testOnly.has(issue.file)) lines.keptTestOnly.push(issue.file);
            else lines.toResolve.push(`${kind} — ${line}`);
        }
    }
}
const missed = [...kept].filter((line) => !lines.keptLibrary.includes(line));
console.log(`kept as public surface of the library: ${lines.keptLibrary.length}`);
console.log(`kept for their test (awaiting the owner): ${lines.keptTestOnly.length}`);
console.log(`to resolve: ${lines.toResolve.length}`);
for (const line of lines.toResolve) console.log(`  ${line}`);
console.log(`listed by the script and not by knip: ${missed.length}`);
for (const line of missed) console.log(`  ${line}`);
' "$LEDGER/reports/knip.json" <(node bin/front-unused.mjs --json) | tee "$LEDGER/reports/knip-classified.txt"
```

How each class is treated:

| Class | Treatment |
|---|---|
| **Kept as public surface of the library** — an export or a prop type of `components/ui` or `components/skrum` that `knip` reports and the script lists under `libraryLocalOnlyExports` (224 before 18e) | **Reported, kept.** The `export` keyword stays: a container types against these props, and the design-system bench documents them. The count and the file `knip-classified.txt` go in the final report under "Code deleted — what was not deleted". They are the only findings of `knip` that AC6 accepts without a change. |
| **Kept for their test** — a file only a test reaches | Kept, already in `progress.md` under "Awaiting the owner" (Task 3 Step 3). |
| **To resolve** | Each line is one of three things, and the ledger says which: (a) dead code the script missed — it goes through the deletion rule and Task 3's commands, then both tools run again; (b) a false positive of `knip` (a package used by a tool or by CSS, which the script's `toolingPackages` names with its reason; a file the server names) — written in `progress.md` with the reason, and added to `ignoreDependencies` or `entry` of `$LEDGER/knip.json` only when the reason is one the script already records; (c) a difference between the tools that is neither — stop and report. |
| **Listed by the script and not by knip** | Expected `0`. A line here means the two tools read an export differently: look at the file, write the cause in `progress.md`. It does not block. |

Expected at the end of the step: `to resolve: 0`, with every (b) written in the ledger. `knip` is not run again after this step except to confirm a fix of class (a); the final gates use the script.

- [ ] **Step 7: Gate of the task**

```bash
node bin/front-unused.mjs; echo "exit $?"
vendor/bin/sail artisan test --parallel --processes=8 --compact
bin/test-browser
```

Expected: `exit 0` when nothing awaits the owner; `exit 1` with only "Imported packages that package.json does not declare" not empty when a package other than `@testing-library/user-event` is imported without being declared (written in the ledger in Step 3). Both suites: 0 failed.

---

### Task 6: The rules of the design system as tests

**Files:**
- Create: `tests/Arch/FrontEndRulesTest.php`
- Modify: the source files the test reports

**Interfaces:**
- Consumes: the tree left by Tasks 3 and 5 (no file about to be deleted is fixed here).
- Produces: `FrontEndRuleExemptions` (rule => path => reason) and the detectors `arbitrarySizeOffences`, `colourLiteralOffences`, `pixelOffences`, `designSystemClassOffences`, `iconPackageOffences`, `inlineSvgOffences`, `scriptedMotionOffences`, `presentationalImportOffences`, each `(string $source): array<int, string>`.

What each rule of spec §5 becomes:

| Rule | Check |
|---|---|
| 1 Tokens only; AC5 | `colour`: no hex, no `rgb()`/`hsl()`/`oklch()`, no default-palette class, no `-white`/`-black` utility, in `resources/js`; palette classes in Blade views |
| 2 rem everywhere | `px`: no pixel length above 2px in `resources/js` |
| 3 No arbitrary size; AC5 | `arbitrary-size`: no literal length between brackets on a size utility; `calc()`, `env()`, `var()`, grid templates and `color-mix` stay allowed |
| 8 Motion | `scripted-motion`: a file that animates from script asks for the reduced-motion preference; the browser side is Task 9 |
| 9 Icons | `icon-package` and the `package.json` test: lucide-react only; `inline-svg`: an inline `<svg>` only in a file listed with its reason |
| 11 Presentational components | `presentational`: what `components/skrum/*` may import and call |
| AC8 | `design-system-class`: no `sk-*` class |
| 4, 5, 6, 7 | not checkable on source: overflow by the captures (Task 8), focus and contrast in the browser and on the tokens (Task 9) |
| 10 i18n | Task 7 |

- [ ] **Step 1: Write the test**

`tests/Arch/FrontEndRulesTest.php`:

```php
<?php

/**
 * The rules of the front-end rewrite (spec §5), checked on the source files.
 * A file leaves a rule only through FrontEndRuleExemptions, with its reason.
 */
const FrontEndRuleExemptions = [
    'colour' => [
        'resources/js/components/admin/branding/samples.ts' => 'palettes the server derives, shown on the bench and in tests as the hex values an admin sees',
        'resources/js/pages/dev/sections/admin-branding.tsx' => 'brand colours as an admin types them: hex is the input format',
        'resources/js/components/admin/branding/branding-form.tsx' => 'the validation message of the colour field quotes a hex value as an example',
        'resources/js/components/ui/chart.tsx' => 'attribute selectors on the strokes Recharts writes, replaced by tokens',
        'resources/js/hooks/use-whiteboard-cursors.ts' => 'one hue per collaborator, computed from the member id for the Excalidraw canvas',
        'resources/js/lib/whiteboard/palette.ts' => 'Excalidraw stores a colour as hex in the scene',
        'resources/js/lib/games/drawing.ts' => 'pixels of the drawing canvas',
    ],
    'px' => [
        'resources/js/pages/dev/sections/notifications-panel.tsx' => 'a bench label names a viewport width',
    ],
    'inline-svg' => [
        'resources/js/components/skrum/skrum-logo.tsx' => 'the Skrüm logo, drawn from the brand files',
        'resources/js/components/skrum/empty-state.tsx' => 'illustration of the design system',
        'resources/js/components/skrum/icebreaker-game-card.tsx' => 'illustration of the design system',
        'resources/js/components/skrum/mood-trend-chart.tsx' => 'chart drawn by hand on the chart tokens',
        'resources/js/components/skrum/stat-card.tsx' => 'sparkline of the stat card',
        'resources/js/components/skrum/timer.tsx' => 'progress ring of the timer',
        'resources/js/components/skrum/live-cursor.tsx' => 'cursor arrow coloured per participant',
        'resources/js/components/skrum/action-item.tsx' => 'status glyph filled with the status tokens, kept from the reviewed 18c component',
    ],
];

const FrontEndGeneratedFolders = ['resources/js/actions', 'resources/js/routes', 'resources/js/wayfinder'];

/**
 * @return array<string, string> source by path relative to the repository
 */
function frontEndSources(string $root, string $folder = 'resources/js', bool $withTests = false): array
{
    $directory = "{$root}/{$folder}";

    if (! is_dir($directory)) {
        return [];
    }

    $sources = [];
    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS));

    foreach ($files as $file) {
        $path = substr($file->getPathname(), strlen($root) + 1);

        if (! in_array($file->getExtension(), ['ts', 'tsx'], true)) {
            continue;
        }

        if (array_any(FrontEndGeneratedFolders, fn (string $generated): bool => str_starts_with($path, "{$generated}/"))) {
            continue;
        }

        $isTest = preg_match('/\.test\.tsx?$/', $path) === 1 || str_starts_with($path, 'resources/js/test/');

        if ($isTest && ! $withTests) {
            continue;
        }

        $sources[$path] = (string) file_get_contents($file->getPathname());
    }

    ksort($sources);

    return $sources;
}

/**
 * @return array<int, string> "line: what was found"
 */
function frontEndMatches(string $source, string $pattern, ?callable $keep = null): array
{
    preg_match_all($pattern, $source, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);

    $found = [];

    foreach ($matches as $match) {
        if ($keep !== null && ! $keep($match)) {
            continue;
        }

        $line = substr_count($source, "\n", 0, $match[0][1]) + 1;
        $found[] = "{$line}: {$match[0][0]}";
    }

    return $found;
}

/**
 * A size utility with a literal length between brackets (`w-[13px]`, `text-[0.8rem]`, `leading-[1.2]`).
 * `calc()`, `env()`, `var()` and keywords stay allowed: no class of the scale can say them.
 *
 * @return array<int, string>
 */
function arbitrarySizeOffences(string $source): array
{
    $utilities = 'w|h|size|min-w|min-h|max-w|max-h|p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me'
        .'|gap|gap-x|gap-y|space-x|space-y|inset|inset-x|inset-y|top|right|bottom|left|start|end'
        .'|text|leading|tracking|indent|basis|translate-x|translate-y|rounded|rounded-[a-z]{1,2}'
        .'|scroll-m[trblxyse]?|scroll-p[trblxyse]?';

    return frontEndMatches(
        $source,
        '/(?<![\w-])-?(?:'.$utilities.')-\[(-?\d*\.?\d+(?:px|rem|em|%|vh|vw|svh|dvh|lvh|ch|ex)?)\]/',
    );
}

/**
 * A colour that is not a token: hex, a colour function, the default Tailwind palette, white, black.
 *
 * @return array<int, string>
 */
function colourLiteralOffences(string $source): array
{
    $properties = 'bg|text|border(?:-[trblxyse])?|ring|ring-offset|fill|stroke|from|to|via|outline|divide|decoration|shadow|accent|caret|placeholder';
    $palette = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';

    return [
        ...frontEndMatches($source, '/(?<![\w&#])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/'),
        ...frontEndMatches($source, '/(?<![\w-])(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/'),
        ...frontEndMatches($source, '/(?<![\w-])(?:'.$properties.')-(?:white|black|(?:'.$palette.')-\d{2,3})(?![\w-])/'),
    ];
}

/**
 * A pixel length above the two pixels a stroke may take (the pill radius lives in app.css).
 *
 * @return array<int, string>
 */
function pixelOffences(string $source): array
{
    return frontEndMatches(
        $source,
        '/(?<![a-zA-Z\d.])(\d+(?:\.\d+)?)px(?![a-zA-Z\d])/',
        fn (array $match): bool => (float) $match[1][0] > 2,
    );
}

/**
 * @return array<int, string>
 */
function designSystemClassOffences(string $source): array
{
    return frontEndMatches($source, '/(?<=[\s"\'`])sk-[a-z][\w-]*/');
}

/**
 * An icon package other than lucide-react.
 *
 * @return array<int, string>
 */
function iconPackageOffences(string $source): array
{
    $packages = '@heroicons\/|react-icons|@tabler\/icons|@radix-ui\/react-icons|@phosphor-icons\/|phosphor-react|react-feather|feather-icons|@fortawesome\/|@mui\/icons-material|iconoir-react|@iconify\/';

    return frontEndMatches($source, '/\bfrom\s+[\'"](?:'.$packages.')[^\'"]*[\'"]/');
}

/**
 * @return array<int, string>
 */
function inlineSvgOffences(string $source): array
{
    return frontEndMatches($source, '/<svg\b/');
}

/**
 * Animation started from script (the stylesheet cannot shorten it) in a file that never asks for the reduced-motion preference.
 *
 * @return array<int, string>
 */
function scriptedMotionOffences(string $source): array
{
    if (preg_match('/prefers-reduced-motion|useReducedMotion|reducedMotion/', $source) === 1) {
        return [];
    }

    return frontEndMatches($source, '/\.animate\(\s*[\[{]|\bfrom\s+[\'"]live-reactions(?:\/react)?[\'"]|\bfrom\s+[\'"]canvas-confetti[\'"]/');
}

/**
 * What a presentational component may not import (spec §5 rule 11), with the two exceptions: useTrans and Inertia's Link.
 *
 * @return array<int, string>
 */
function presentationalImportOffences(string $source): array
{
    $forbidden = '@\/actions\/|@\/routes\/|@\/routes[\'"]|@\/wayfinder\/|@\/pages\/|@\/layouts\/|@laravel\/echo-react|laravel-echo|pusher-js|@inertiajs\/core'
        .'|@\/hooks\/use-(?:retro|poker|game|whiteboard)[\w-]*|@\/hooks\/use-comment-notifications|@\/hooks\/use-flash-toast|@\/hooks\/use-two-factor-auth'
        .'|@\/lib\/[\w-]+\/(?:api|endpoints|request)|@\/lib\/reverb-config|@\/lib\/realtime\/'
        .'|@\/components\/(?!ui\/|skrum\/|breadcrumbs[\'"])';

    $offences = frontEndMatches($source, '/\bfrom\s+[\'"](?:'.$forbidden.')[^\'"]*[\'"]?/');

    preg_match_all('/\bimport\s+(type\s+)?(\{[^}]*\}|[\w$]+|\*\s+as\s+[\w$]+)\s+from\s+[\'"]@inertiajs\/react[\'"]/', $source, $imports, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);

    foreach ($imports as $import) {
        $names = array_filter(array_map(
            fn (string $name): string => trim((string) preg_replace('/^type\s+|\s+as\s+.*$/', '', trim($name))),
            explode(',', trim($import[2][0], '{} ')),
        ));

        $notAllowed = array_diff($names, ['Link', 'InertiaLinkProps']);

        if ($notAllowed === []) {
            continue;
        }

        $line = substr_count($source, "\n", 0, $import[0][1]) + 1;
        $offences[] = "{$line}: imports ".implode(', ', $notAllowed).' from @inertiajs/react';
    }

    return [
        ...$offences,
        ...frontEndMatches($source, '/(?<![\w.])(?:fetch|usePage|useForm|useHttp|useEcho|useEchoPresence)\(|\bnew\s+XMLHttpRequest\b|\bnavigator\.sendBeacon\(/'),
    ];
}

/**
 * @param  callable(string): array<int, string>  $detector
 * @param  array<string, string>  $sources
 * @return array<int, string>
 */
function frontEndOffences(array $sources, callable $detector, string $rule): array
{
    $exempt = FrontEndRuleExemptions[$rule] ?? [];
    $offences = [];

    foreach ($sources as $path => $source) {
        if (isset($exempt[$path])) {
            continue;
        }

        foreach ($detector($source) as $found) {
            $offences[] = "{$path}:{$found}";
        }
    }

    return $offences;
}

/**
 * @return array<string, callable(string): array<int, string>>
 */
function frontEndDetectors(): array
{
    return [
        'arbitrary-size' => arbitrarySizeOffences(...),
        'colour' => colourLiteralOffences(...),
        'px' => pixelOffences(...),
        'design-system-class' => designSystemClassOffences(...),
        'icon-package' => iconPackageOffences(...),
        'inline-svg' => inlineSvgOffences(...),
        'scripted-motion' => scriptedMotionOffences(...),
    ];
}

it('keeps the front end on the rules of the design system', function (string $rule) {
    $sources = frontEndSources(dirname(__DIR__, 2));

    expect($sources)->not->toBeEmpty()
        ->and(frontEndOffences($sources, frontEndDetectors()[$rule], $rule))->toBe([]);
})->with(array_keys(frontEndDetectors()));

it('keeps the default palette and literal sizes out of the Blade views', function () {
    $offences = [];

    foreach (glob(dirname(__DIR__, 2).'/resources/views/{*,*/*,*/*/*}.blade.php', GLOB_BRACE) ?: [] as $view) {
        $source = (string) file_get_contents($view);
        $classOffences = array_filter(
            colourLiteralOffences($source),
            fn (string $found): bool => preg_match('/: (?:#|\w+\()/', $found) !== 1,
        );

        foreach ([...$classOffences, ...arbitrarySizeOffences($source), ...designSystemClassOffences($source)] as $found) {
            $offences[] = basename($view).":{$found}";
        }
    }

    expect($offences)->toBe([]);
});

it('keeps the skrum components presentational', function () {
    $sources = frontEndSources(dirname(__DIR__, 2), 'resources/js/components/skrum');

    expect($sources)->not->toBeEmpty()
        ->and(frontEndOffences($sources, presentationalImportOffences(...), 'presentational'))->toBe([]);
});

it('declares no icon package other than lucide-react', function () {
    $manifest = json_decode((string) file_get_contents(dirname(__DIR__, 2).'/package.json'), true, flags: JSON_THROW_ON_ERROR);
    $packages = array_keys([...$manifest['dependencies'] ?? [], ...$manifest['devDependencies'] ?? []]);

    $iconPackages = array_values(array_filter(
        $packages,
        fn (string $package): bool => iconPackageOffences("import x from '{$package}'") !== [],
    ));

    expect($iconPackages)->toBe([])
        ->and($packages)->toContain('lucide-react');
});

it('keeps only exemptions that still exempt something', function () {
    $root = dirname(__DIR__, 2);
    $detectors = [...frontEndDetectors(), 'presentational' => presentationalImportOffences(...)];
    $stale = [];

    foreach (FrontEndRuleExemptions as $rule => $files) {
        foreach (array_keys($files) as $path) {
            if (! is_file("{$root}/{$path}") || $detectors[$rule]((string) file_get_contents("{$root}/{$path}")) === []) {
                $stale[] = "{$rule}: {$path}";
            }
        }
    }

    expect($stale)->toBe([]);
});

it('gives every exemption a reason', function () {
    foreach (FrontEndRuleExemptions as $files) {
        foreach ($files as $reason) {
            expect(strlen($reason))->toBeGreaterThan(10);
        }
    }
});

dataset('frontEndRuleBreaks', [
    'pixel width' => ['arbitrary-size', '<div className="w-[13px]" />'],
    'rem text size' => ['arbitrary-size', "cn('text-[0.8125rem]')"],
    'unitless leading' => ['arbitrary-size', '<p className="leading-[1.15]" />'],
    'negative margin behind a variant' => ['arbitrary-size', '<div className="md:-mt-[2rem]" />'],
    'hex' => ['colour', "const stroke = '#4B5563';"],
    'short hex' => ['colour', '<path fill="#fff" />'],
    'rgb function' => ['colour', "style={{ color: 'rgb(0 0 0 / 50%)' }}"],
    'oklch function' => ['colour', "const tone = 'oklch(0.5 0.1 20)';"],
    'default palette' => ['colour', '<div className="bg-red-600" />'],
    'white text' => ['colour', '<div className="hover:text-white" />'],
    'black overlay' => ['colour', '<div className="bg-black/80" />'],
    'pixel length' => ['px', "style={{ width: '320px' }}"],
    'pixel length in a class' => ['px', '<div className="shadow-[0_4px_0]" />'],
    'design-system preview class' => ['design-system-class', '<div className="sk-card" />'],
    'other icon package' => ['icon-package', "import { HomeIcon } from '@heroicons/react/24/outline';"],
    'inline svg' => ['inline-svg', '<svg viewBox="0 0 24 24" />'],
    'web animation without the preference' => ['scripted-motion', "node.animate([{ opacity: 0 }, { opacity: 1 }], 300);"],
    'flying reactions without the preference' => ['scripted-motion', "import { LiveReactions } from 'live-reactions/react';"],
]);

it('reports a broken rule', function (string $rule, string $code) {
    expect(frontEndDetectors()[$rule]($code))->not->toBe([]);
})->with('frontEndRuleBreaks');

dataset('frontEndRuleLookalikes', [
    'calc width' => ['arbitrary-size', '<div className="max-w-[calc(100%-2rem)]" />'],
    'safe-area padding' => ['arbitrary-size', '<div className="pb-[env(safe-area-inset-bottom)]" />'],
    'grid template' => ['arbitrary-size', '<div className="grid-cols-[repeat(auto-fill,minmax(16rem,1fr))]" />'],
    'data variant' => ['arbitrary-size', '<div className="data-[size=sm]:h-8 group-data-[collapsible=icon]:hidden" />'],
    'container breakpoint' => ['arbitrary-size', '<div className="@min-[28rem]/card:flex" />'],
    'inherited radius' => ['arbitrary-size', '<div className="rounded-[inherit]" />'],
    'issue key' => ['colour', "key: 'skrum#128',"],
    'anchor' => ['colour', '<a href="#mood" />'],
    'element id selector' => ['colour', "document.querySelector('#deck-new-name')"],
    'html entity' => ['colour', '<span>&#8203;</span>'],
    'token class' => ['colour', '<div className="bg-primary text-primary-foreground border-skrum-sky" />'],
    'colour mix of tokens' => ['colour', '<div className="bg-[color-mix(in_oklab,var(--card),var(--primary)_8%)]" />'],
    'stroke of one and a half pixels' => ['px', '<div className="border-[1.5px]" />'],
    'two pixel offset' => ['px', '<div className="w-[calc(var(--sidebar-width-icon)+2px)]" />'],
    'task title' => ['design-system-class', "title: 'Task-12 risk-review'"],
    'lucide' => ['icon-package', "import { Home } from 'lucide-react';"],
    'web animation that asks first' => ['scripted-motion', "if (! matchMedia('(prefers-reduced-motion: reduce)').matches) { node.animate([{ opacity: 0 }], 300); }"],
    'array method named like it' => ['scripted-motion', 'const animate = frames.animate(speed);'],
]);

it('accepts what only looks like a broken rule', function (string $rule, string $code) {
    expect(frontEndDetectors()[$rule]($code))->toBe([]);
})->with('frontEndRuleLookalikes');

dataset('presentationalBreaks', [
    'router' => ["import { router } from '@inertiajs/react';"],
    'page props' => ["import { Link, usePage } from '@inertiajs/react';"],
    'wayfinder action' => ["import RetrosController from '@/actions/App/Http/Controllers/Retros/RetrosController';"],
    'named routes' => ["import { dashboard } from '@/routes';"],
    'echo' => ["import { useEcho } from '@laravel/echo-react';"],
    'channel hook' => ["import { useRetroChannel } from '@/hooks/use-retro-channel';"],
    'request helper' => ["import { retroRequest } from '@/lib/retro/api';"],
    'domain container' => ["import { Board } from '@/components/retro/board';"],
    'layout' => ["import AppLayout from '@/layouts/skrum/app-layout';"],
    'fetch' => ["const response = await fetch('/search');"],
]);

it('reports a skrum component that does more than render', function (string $code) {
    expect(presentationalImportOffences($code))->not->toBe([]);
})->with('presentationalBreaks');

it('accepts the imports a skrum component needs', function () {
    $code = <<<'TSX'
    import { Link } from '@inertiajs/react';
    import type { InertiaLinkProps } from '@inertiajs/react';
    import { Check } from 'lucide-react';
    import { useState } from 'react';
    import { Breadcrumbs } from '@/components/breadcrumbs';
    import { PersonAvatar } from '@/components/skrum/person-avatar';
    import { Button } from '@/components/ui/button';
    import { useShortcut } from '@/hooks/use-shortcut';
    import { useTrans } from '@/hooks/use-trans';
    import type { PokerRound } from '@/lib/poker/types';
    import { cn } from '@/lib/utils';
    const refetch = () => props.onRefetch();
    TSX;

    expect(presentationalImportOffences($code))->toBe([]);
});
```

- [ ] **Step 2: Run it**

Run: `vendor/bin/sail artisan test --compact tests/Arch/FrontEndRulesTest.php`
Expected: 59 tests. The 46 examples (`reports a broken rule`, `accepts what only looks like a broken rule`, `reports a skrum component that does more than render`), `accepts the imports a skrum component needs`, `declares no icon package other than lucide-react` and `gives every exemption a reason` pass. The tests that read the repository pass or fail with the list of offences, each as `path:line: what was found`. `keeps only exemptions that still exempt something` fails for every seeded exemption whose file 18e deleted or cleaned.

- [ ] **Step 3: Bring the repository tests to green**

For each stale exemption: delete its line from `FrontEndRuleExemptions`.

For each offence, in this order of preference:

| Found | Do |
|---|---|
| A size between brackets | Use the class of the scale. If the value is not in the scale, add a named size to the `@theme` block of plan additions at the end of `app.css` (after the design-system block) and use its class. |
| A hex, a colour function, a palette class, white or black | Use the token (`bg-card`, `text-primary-foreground`, `border-skrum-…`). Text on a solid colour takes its `*-foreground`. |
| A pixel length above 2px | Convert to rem (divide by 16), or use the class of the scale. |
| `sk-*` | Replace by the utilities the component README gives. |
| Another icon package | Replace by the lucide icon of `docs/design-system/sections/03-iconographie.md`. |
| An inline `<svg>` that is an icon | Replace by the lucide icon. |
| An inline `<svg>` that is a drawing, a chart or a logo | Add the file to `'inline-svg'` with what the drawing is. |
| Animation from script with no preference check | Read `window.matchMedia('(prefers-reduced-motion: reduce)')` (or `useReducedMotion` from `@/components/ui/chart`) and skip or shorten the animation. |
| A skrum component that imports the router, page props, a channel hook, a Wayfinder module or a domain container | Move that code to the container in `components/<domain>/` and pass the value or the callback as a prop. |
| Canvas or scene data, or text that quotes a value (a hex an admin types, a pixel count in a label) | Add the file to the rule's exemptions with the reason. No other kind of exemption is accepted. |

A fix that changes how a screen looks is checked against its mockup and its capture is taken again in Task 8.

Run after each batch: `vendor/bin/sail artisan test --compact tests/Arch/FrontEndRulesTest.php`
Expected at the end: 59 passed.

- [ ] **Step 4: The three greps of the acceptance criteria**

```bash
grep -rnE "bg-(red|blue|gray|zinc|neutral|slate)-|text-white|-\[[0-9.]+(px|rem)\]" resources/js resources/views | grep -v "^resources/js/\(actions\|routes\|wayfinder\)/"
grep -rn "sk-[a-z]" resources/js resources/css resources/views
grep -rn "_preview-bundle" resources public
```

Expected: nothing, three times (AC5 and AC8). A line here that the test did not report is a hole in the test: add the case to `frontEndRuleBreaks` and widen the detector before fixing the line.

- [ ] **Step 5: Gates and commit**

```bash
vendor/bin/pint --dirty --format agent
npm run build:front && npm run types:check && npm run check && npm run test
git add tests/Arch/FrontEndRulesTest.php resources
git commit -m "test(front): hold the rules of the design system with tests on the sources"
```

Expected: all exit 0.

---

### Task 7: Translation keys the literal scan cannot see

**Files:**
- Modify: `tests/Feature/TranslationKeysTest.php` (append; the existing three tests and their helpers are not changed)
- Modify: `lang/en.json`, `lang/fr.json`, `lang/es.json`, `lang/de.json` (missing keys only)

**Interfaces:**
- Consumes: `translationCallArgument(string $source, int $start): string`, already in `TranslationKeysTest.php`.
- Produces: `DynamicTranslationSources` (path => where its keys are checked), `translationSources(): array`, `bracketedLiteral`, `labelMapValues`, `layoutPropTranslationKeys`, `dynamicTranslationCalls`.

The existing test finds `t('…')`, `t("…")`, `__('…')` and the two branches of a ternary. It does not see a key that reaches `t()` through a label map (`t(PhaseLabels[phase])`), a list (`t(RotiLabels[score - 1])`) or a layout prop (`Login.layout = { title: 'Log in to your account' }`). On the tree before 18e that was 49 keys in maps and 16 in layout props, one of them missing from `en.json`.

- [ ] **Step 1: Append the helpers and the tests**

At the end of `tests/Feature/TranslationKeysTest.php`:

```php
/**
 * Files where `t()` receives a value the scan cannot follow, with the place that guarantees the keys exist.
 */
const DynamicTranslationSources = [
    'resources/js/components/breadcrumbs.tsx' => 'titles arrive already translated by the page, or as layout props, which the layout-prop test covers',
    'resources/js/layouts/skrum/auth-layout.tsx' => 'title and description are layout props of the auth pages, which the layout-prop test covers',
    'resources/js/components/admin/branding/palette-warnings.tsx' => 'warning keys are built by BrandPalette; tests/Unit/Branding/BrandPaletteTest.php checks them in the four files',
];

/**
 * @return array<string, string> TypeScript source by path relative to the repository, tests left out
 */
function translationSources(): array
{
    $sources = [];

    foreach (['pages', 'components', 'layouts', 'hooks', 'lib'] as $folder) {
        foreach (File::allFiles(resource_path("js/{$folder}")) as $file) {
            if (! in_array($file->getExtension(), ['ts', 'tsx'], true) || preg_match('/\.test\.tsx?$/', $file->getFilename()) === 1) {
                continue;
            }

            $sources[str_replace(base_path().'/', '', $file->getPathname())] = File::get($file->getPathname());
        }
    }

    ksort($sources);

    return $sources;
}

/**
 * The text between the bracket at $opener and the bracket that closes it.
 */
function bracketedLiteral(string $source, int $opener): string
{
    $depth = 0;
    $quote = null;

    for ($index = $opener; $index < strlen($source); $index++) {
        $character = $source[$index];

        if ($quote !== null) {
            if ($character === '\\') {
                $index++;

                continue;
            }

            if ($character === $quote) {
                $quote = null;
            }

            continue;
        }

        if (in_array($character, ["'", '"', '`'], true)) {
            $quote = $character;

            continue;
        }

        if (in_array($character, ['(', '[', '{'], true)) {
            $depth++;

            continue;
        }

        if (! in_array($character, [')', ']', '}'], true)) {
            continue;
        }

        if (--$depth === 0) {
            return substr($source, $opener + 1, $index - $opener - 1);
        }
    }

    return '';
}

/**
 * The string values of a module-level `const NAME = { … }` or `const NAME = [ … ]`, or null when there is no such literal.
 *
 * @return null|array<int, string>
 */
function labelMapValues(string $source, string $name): ?array
{
    if (preg_match('/^(?:export\s+)?const\s+'.preg_quote($name, '/').'\b[^=\n]*=\s*([{\[])/m', $source, $match, PREG_OFFSET_CAPTURE) !== 1) {
        return null;
    }

    $literal = bracketedLiteral($source, $match[1][1]);
    $string = '([\'"])((?:(?!\1)[^\\\\\n]|\\\\.)+)\1';

    preg_match_all($match[1][0] === '{' ? "/:\s*{$string}/" : "/{$string}(?!\s*:)/", $literal, $values);

    return array_map(stripslashes(...), $values[2]);
}

/**
 * Layout props a page hands to its layout as literals (`Login.layout = { title: '…', description: '…' }`,
 * breadcrumb titles included): the layout translates them.
 *
 * @param  array<string, string>  $sources
 * @return array<int, string>
 */
function layoutPropTranslationKeys(array $sources): array
{
    $keys = [];

    foreach ($sources as $source) {
        preg_match_all('/^\w+\.layout\s*=\s*\{/m', $source, $blocks, PREG_OFFSET_CAPTURE);

        foreach ($blocks[0] as [$opening, $offset]) {
            $literal = bracketedLiteral($source, $offset + strlen($opening) - 1);

            preg_match_all('/\b(?:title|description)\s*:\s*([\'"])((?:(?!\1)[^\\\\\n]|\\\\.)+)\1/', $literal, $values);

            $keys = [...$keys, ...array_map(stripslashes(...), $values[2])];
        }
    }

    return array_values(array_unique($keys));
}

/**
 * Calls such as `t(PhaseLabels[phase])` or `t(roleLabels.owner)`: the keys are the string values of the map.
 *
 * @param  array<string, string>  $sources
 * @return array{
 *     keys: array<int, string>,
 *     unresolved: array<int, string>
 * }
 */
function dynamicTranslationCalls(array $sources): array
{
    $keys = [];
    $unresolved = [];

    foreach ($sources as $path => $source) {
        preg_match_all('/(?<![\w.$])t\(\s*([A-Za-z_$][\w$]*)\s*([\[.,)])/', $source, $calls, PREG_SET_ORDER | PREG_OFFSET_CAPTURE);

        foreach ($calls as $call) {
            $argument = translationCallArgument($source, $call[0][1] + strlen('t('));

            if (str_contains($argument, '?')) {
                continue;
            }

            $name = $call[1][0];
            $values = labelMapValues($source, $name);

            foreach ($values === null ? $sources : [] as $other) {
                if (preg_match('/^export\s+const\s+'.preg_quote($name, '/').'\b/m', $other) === 1) {
                    $values = labelMapValues($other, $name);

                    break;
                }
            }

            if ($values === null) {
                $line = substr_count($source, "\n", 0, $call[0][1]) + 1;
                $unresolved[] = "{$path}:{$line} t(".trim($argument).')';

                continue;
            }

            $keys = [...$keys, ...$values];
        }
    }

    return ['keys' => array_values(array_unique($keys)), 'unresolved' => $unresolved];
}

it('defines the keys of every label map and of every layout prop in every locale', function (string $locale) {
    $translations = json_decode(File::get(lang_path("{$locale}.json")), true);
    $sources = translationSources();
    $keys = [...dynamicTranslationCalls($sources)['keys'], ...layoutPropTranslationKeys($sources)];

    expect(array_values(array_diff($keys, array_keys($translations))))->toBeEmpty();
})->with(['en', 'fr', 'es', 'de']);

it('knows where the keys of every other dynamic call come from', function () {
    $files = array_values(array_unique(array_map(
        fn (string $call): string => explode(':', $call)[0],
        dynamicTranslationCalls(translationSources())['unresolved'],
    )));

    expect(array_values(array_diff($files, array_keys(DynamicTranslationSources))))->toBe([])
        ->and(array_values(array_diff(array_keys(DynamicTranslationSources), $files)))->toBe([]);
});

it('reads the keys of a label map, of a label list and of layout props', function () {
    $sources = [
        'a.tsx' => "export const PhaseLabels: Record<string, string> = {\n    writing: 'Writing',\n    done: \"It's done\",\n};\nconst Scores = ['Time wasted', 'Excellent'] as const;\nfunction A() { return t(Scores[score - 1]) + t(isOpen ? 'Close' : 'Open'); }\nA.layout = {\n    title: 'Log in to your account',\n    breadcrumbs: [{ title: 'Profile settings', href: edit() }],\n};\n",
        'b.tsx' => "function B({ item }) { return t(PhaseLabels[phase]) + t(item.title); }\n",
    ];

    $calls = dynamicTranslationCalls($sources);

    expect($calls['keys'])->toEqualCanonicalizing(['Time wasted', 'Excellent', 'Writing', "It's done"])
        ->and($calls['unresolved'])->toBe(['b.tsx:1 t(item.title)'])
        ->and(layoutPropTranslationKeys($sources))->toBe(['Log in to your account', 'Profile settings']);
});
```

- [ ] **Step 2: Run it**

Run: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: `reads the keys of a label map, of a label list and of layout props` passes. `defines the keys of every label map…` passes or lists missing keys per locale. `knows where the keys of every other dynamic call come from` fails with two lists: files that call `t()` with a value the scan cannot follow and are not in `DynamicTranslationSources`, and entries of `DynamicTranslationSources` whose file is gone or no longer has such a call.

- [ ] **Step 3: Bring it to green**

Missing keys: add each to the four files, translated (French, Spanish and German written by hand, in the tone of the neighbouring keys; in `en.json` the value is the key).

For each file reported by the second test, in this order of preference:

1. The value comes from a constant map or list in the front end: make it a module-level `const Name = { … }` or `const Name = [ … ]` and call `t(Name[key])`. The scan then follows it and the file leaves the list.
2. The value is a prop that the caller already translated: remove the second `t()`.
3. The value comes from the server or from a prop that callers fill with literals: add the file to `DynamicTranslationSources`, and write as its reason the test that checks those keys in the four files. If no test checks them, write that test first (the pattern is in `tests/Unit/Branding/BrandPaletteTest.php`, which reads the four lang files for the warning keys).

Remove the stale entries the test lists.

Run: `vendor/bin/sail artisan test --compact tests/Feature/TranslationKeysTest.php`
Expected: all pass (the three existing tests with their datasets, plus the three new ones).

- [ ] **Step 4: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add tests/Feature/TranslationKeysTest.php lang resources/js
git commit -m "test(i18n): check the keys of label maps and layout props, and name the source of every dynamic key"
```

---

### Task 8: Mockup-fidelity pass — every page captured and compared with its mockup

**Files:**
- Create: `tests/Browser/Support/PageCatalogue.php`
- Create: `tests/Browser/Visual/PagesVisualTest.php`
- Create: `docs/superpowers/research/front-rewrite/fidelity.md` (the comparison, page by page), `docs/superpowers/research/front-rewrite/deviations.md` (the deviations table)
- Modify: `tests/Arch/FrontEndPagesTest.php` (append the capture coverage and the fidelity coverage)
- Modify: the components and pages the comparison finds different from their mockup
- Create or replace: `tests/visual/__screenshots__/*.png`

**Interfaces:**
- Consumes: `pageComponents(string $root): array` (Task 2); `captureVisuals(string $name, string $path, ?callable $visit)` and `overflowingElements(mixed $page)` of `tests/Browser/Support/CapturesVisuals.php`; the helpers of `tests/Pest.php` (`teamMember`, `openPokerRound`, `pokerVote`); `RetroPhase::Actions` and `RetroPhase::Roti` (18e, B1).
- Produces: `Tests\Browser\Support\PageCatalogue` — `PageCatalogue::Pages` (capture name => `[component, actor]`), `PageCatalogue::build(): self`, `->open(string $name, array $options = []): mixed`, used again by Task 9. Capture names: the component with dashes and `-page` (`retros/show` → `retros-show-page`), a state adds `--state`.

A capture is taken for every page in light and dark, at 1440 and 390, in French and English — the two capture languages the owner confirmed on 2026-10-02 (no Spanish or German capture; those two languages are held by `TranslationKeysTest` and by the label-length rule of spec §5); `captureVisuals` fails on horizontal overflow before it writes the file. If 18e already added a visual test for a screen under the same capture name, keep one of the two: delete the row from `PageCatalogue::Pages` here only if the 18e test covers the eight variants.

- [ ] **Step 1: Append the coverage tests**

At the end of `tests/Arch/FrontEndPagesTest.php`:

```php

/**
 * Pages that have no capture of their own, with the reason.
 */
const PagesWithoutCapture = [
    'dev/design-system' => 'captured section by section as design-system-<section>',
];

/**
 * States of a page that have their own mockup, or their own audience, and their own capture.
 */
const PageStatesWithCapture = [
    'retros-show-page' => ['grouping', 'voting', 'discussing', 'actions', 'roti', 'completed', 'guest'],
    'poker-show-page' => ['revealed'],
];

function captureName(string $component): string
{
    return str_replace('/', '-', $component).'-page';
}

/**
 * @return array<int, string> the capture files a name must have: both themes, both widths, both languages
 */
function captureFiles(string $name): array
{
    $files = [];

    foreach (['light', 'dark'] as $theme) {
        foreach ([1440, 390] as $width) {
            foreach (['en', 'fr'] as $locale) {
                $files[] = "{$name}-{$theme}-{$width}-{$locale}.png";
            }
        }
    }

    return $files;
}

/**
 * @return array<int, string>
 */
function missingCaptures(string $root): array
{
    $names = [];

    foreach (pageComponents($root) as $component) {
        if (isset(PagesWithoutCapture[$component])) {
            continue;
        }

        $name = captureName($component);
        $names = [...$names, $name, ...array_map(fn (string $state): string => "{$name}--{$state}", PageStatesWithCapture[$name] ?? [])];
    }

    $missing = [];

    foreach ($names as $name) {
        foreach (captureFiles($name) as $file) {
            if (! is_file("{$root}/tests/visual/__screenshots__/{$file}")) {
                $missing[] = $file;
            }
        }
    }

    return $missing;
}

it('has a capture of every page in both themes, both widths and both languages', function () {
    expect(missingCaptures(dirname(__DIR__, 2)))->toBe([]);
});

it('names a page that exists for every exception and every state', function () {
    $components = pageComponents(dirname(__DIR__, 2));
    $names = array_map(captureName(...), $components);

    expect(array_values(array_diff(array_keys(PagesWithoutCapture), $components)))->toBe([])
        ->and(array_values(array_diff(array_keys(PageStatesWithCapture), $names)))->toBe([]);
});

it('keeps no capture of a page or of a bench section that is gone', function () {
    $root = dirname(__DIR__, 2);
    $known = array_map(captureName(...), pageComponents($root));
    $sections = array_map(
        fn (string $path): string => 'design-system-'.basename($path, '.tsx'),
        glob("{$root}/resources/js/pages/dev/sections/*.tsx") ?: [],
    );
    $orphans = [];

    foreach (glob("{$root}/tests/visual/__screenshots__/*.png") ?: [] as $file) {
        $name = (string) preg_replace('/-(?:light|dark)-(?:1440|390)-(?:en|fr)\.png$/', '', basename($file));
        $page = explode('--', $name)[0];

        if (! in_array($page, $known, true) && ! in_array($name, $sections, true)) {
            $orphans[] = basename($file);
        }
    }

    expect($orphans)->toBe([]);
});
```

- [ ] **Step 2: Run it to see what is missing**

Run: `vendor/bin/sail artisan test --compact tests/Arch/FrontEndPagesTest.php`
Expected: `has a capture of every page…` fails and lists the missing files; the list, reduced to capture names, is the work of this task. `keeps no capture of a page or of a bench section that is gone` lists captures to delete (`git rm` them: they are captures, not tests).

- [ ] **Step 3: Write the page catalogue**

`tests/Browser/Support/PageCatalogue.php`:

```php
<?php

namespace Tests\Browser\Support;

use App\Enums\RetroPhase;
use App\Enums\WorkspaceRole;
use App\Models\Card;
use App\Models\Column;
use App\Models\GamePlayer;
use App\Models\GameRoom;
use App\Models\Participant;
use App\Models\PokerGame;
use App\Models\PokerPlayer;
use App\Models\PokerTask;
use App\Models\Retro;
use App\Models\Team;
use App\Models\User;
use App\Models\Whiteboard;
use App\Models\WhiteboardMember;
use App\Models\WorkspaceInvitation;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;

/**
 * One reachable address per page of the application, with the data it needs,
 * for the tests that walk every page (captures, accessibility).
 */
class PageCatalogue
{
    public const string Guest = 'guest';

    public const string Member = 'member';

    public const string Unverified = 'unverified';

    public const string TwoFactor = 'two-factor';

    public const string JoinedGuest = 'joined-guest';

    /**
     * Capture name => Inertia component and who opens the page. The name of a
     * page is its component with dashes and the suffix `-page`; a second state
     * of a page adds `--state`.
     *
     * @var array<string, array{0: string, 1: string}>
     */
    public const array Pages = [
        'auth-login-page' => ['auth/login', self::Guest],
        'auth-register-page' => ['auth/register', self::Guest],
        'auth-forgot-password-page' => ['auth/forgot-password', self::Guest],
        'auth-reset-password-page' => ['auth/reset-password', self::Guest],
        'auth-verify-email-page' => ['auth/verify-email', self::Unverified],
        'auth-two-factor-challenge-page' => ['auth/two-factor-challenge', self::TwoFactor],
        'auth-confirm-password-page' => ['auth/confirm-password', self::Member],
        'invitations-show-page' => ['invitations/show', self::Guest],
        'workspaces-create-page' => ['workspaces/create', self::Member],
        'workspaces-show-page' => ['workspaces/show', self::Member],
        'workspaces-members-page' => ['workspaces/members', self::Member],
        'workspaces-templates-page' => ['workspaces/templates', self::Member],
        'action-items-index-page' => ['action-items/index', self::Member],
        'teams-show-page' => ['teams/show', self::Member],
        'teams-integrations-page' => ['teams/integrations', self::Member],
        'poker-estimates-page' => ['poker/estimates', self::Member],
        'games-index-page' => ['games/index', self::Member],
        'retros-show-page' => ['retros/show', self::Member],
        'retros-show-page--grouping' => ['retros/show', self::Member],
        'retros-show-page--voting' => ['retros/show', self::Member],
        'retros-show-page--discussing' => ['retros/show', self::Member],
        'retros-show-page--actions' => ['retros/show', self::Member],
        'retros-show-page--roti' => ['retros/show', self::Member],
        'retros-show-page--completed' => ['retros/show', self::Member],
        'retros-show-page--guest' => ['retros/show', self::JoinedGuest],
        'retros-join-page' => ['retros/join', self::Guest],
        'retros-session-ended-page' => ['retros/session-ended', self::Guest],
        'poker-show-page' => ['poker/show', self::Member],
        'poker-show-page--revealed' => ['poker/show', self::Member],
        'poker-join-page' => ['poker/join', self::Guest],
        'games-show-page' => ['games/show', self::Member],
        'games-join-page' => ['games/join', self::Guest],
        'whiteboards-show-page' => ['whiteboards/show', self::Member],
        'whiteboards-join-page' => ['whiteboards/join', self::Guest],
        'settings-profile-page' => ['settings/profile', self::Member],
        'settings-security-page' => ['settings/security', self::Member],
        'settings-appearance-page' => ['settings/appearance', self::Member],
        'settings-notifications-page' => ['settings/notifications', self::Member],
        'settings-api-tokens-page' => ['settings/api-tokens', self::Member],
    ];

    private const string ComponentScript = "JSON.parse(document.querySelector('script[data-page]').textContent).component";

    /**
     * @param  array<string, string>  $paths
     * @param  array<string, User>  $users
     * @param  array<string, string>  $joinPaths  where a guest gets in before opening the page of the same name
     */
    private function __construct(private array $paths, private array $users, private array $joinPaths) {}

    public static function build(): self
    {
        config(['skrum.signup_mode' => 'open', 'skrum.mcp.enabled' => true]);

        RateLimiter::for('login', fn (): Limit => Limit::none());

        $team = Team::factory()->create(['name' => 'Demo Team']);
        $workspace = $team->workspace;
        $member = teamMember($team);

        $member->forceFill(['name' => 'Fran Facilitator', 'email' => 'fran@example.com'])->save();
        $workspace->members()->updateExistingPivot($member->id, ['role' => WorkspaceRole::Admin->value]);

        $ada = teamMember($team);
        $ada->forceFill(['name' => 'Maximilian Alexander von Hohenberg-Lichtenstein', 'email' => 'maximilian.alexander.von.hohenberg@a-rather-long-domain.example.com'])->save();

        $paths = [
            'auth-login-page' => '/login',
            'auth-register-page' => '/register',
            'auth-forgot-password-page' => '/forgot-password',
            'auth-reset-password-page' => '/reset-password/visual-token?email=fran@example.com',
            'auth-verify-email-page' => '/email/verify',
            'auth-two-factor-challenge-page' => '/two-factor-challenge',
            'auth-confirm-password-page' => '/user/confirm-password',
            'workspaces-create-page' => route('workspaces.create', absolute: false),
            'workspaces-show-page' => route('workspaces.show', $workspace, false),
            'workspaces-members-page' => route('workspaces.members.index', $workspace, false),
            'workspaces-templates-page' => route('workspaces.templates.index', $workspace, false),
            'action-items-index-page' => route('workspaces.actionItems.index', $workspace, false),
            'teams-show-page' => route('teams.show', [$workspace, $team], false),
            'teams-integrations-page' => route('teams.integrations.index', [$workspace, $team], false),
            'poker-estimates-page' => route('teams.estimates.index', [$workspace, $team], false),
            'games-index-page' => route('teams.games.index', [$workspace, $team], false),
            'settings-profile-page' => '/settings/profile',
            'settings-security-page' => '/settings/security',
            'settings-appearance-page' => '/settings/appearance',
            'settings-notifications-page' => '/settings/notifications',
            'settings-api-tokens-page' => '/settings/api-tokens',
        ];

        WorkspaceInvitation::factory()->withToken('visual-invitation')->create(['workspace_id' => $workspace->id]);
        $paths['invitations-show-page'] = '/invitations/visual-invitation';

        $joinPaths = [];

        foreach (self::retroPhases() as $suffix => $phase) {
            $retro = self::retro($team, $member, $ada, $phase);
            $paths["retros-show-page{$suffix}"] = "/retros/{$retro->id}";

            if ($suffix === '') {
                $paths['retros-join-page'] = "/join/{$retro->guest_token}";
                $paths['retros-session-ended-page'] = "/retros/{$retro->id}";
                $paths['retros-show-page--guest'] = "/retros/{$retro->id}";
                $joinPaths['retros-show-page--guest'] = "/join/{$retro->guest_token}";
            }
        }

        $game = self::pokerGame($team, $member, $ada, revealed: false);
        $paths['poker-show-page'] = "/poker/{$game->id}";
        $paths['poker-join-page'] = "/poker/join/{$game->guest_token}";
        $paths['poker-show-page--revealed'] = '/poker/'.self::pokerGame($team, $member, $ada, revealed: true)->id;

        $room = GameRoom::factory()->linkAccess()->create(['team_id' => $team->id, 'name' => 'Lunch break']);
        $host = GamePlayer::factory()->create(['game_room_id' => $room->id, 'user_id' => $member->id]);
        $room->forceFill(['host_player_id' => $host->id, 'created_by_user_id' => $member->id])->save();
        $paths['games-show-page'] = "/games/{$room->id}";
        $paths['games-join-page'] = "/play/{$room->guest_token}";

        $board = Whiteboard::factory()->withGuestAccess()->create(['team_id' => $team->id, 'title' => 'Sprint planning board']);
        $facilitator = WhiteboardMember::factory()->create(['whiteboard_id' => $board->id, 'user_id' => $member->id]);
        $board->update(['facilitator_member_id' => $facilitator->id]);
        $paths['whiteboards-show-page'] = "/whiteboards/{$board->id}";
        $paths['whiteboards-join-page'] = "/whiteboards/join/{$board->guest_token}";

        return new self($paths, [
            self::Member => $member,
            self::Unverified => User::factory()->unverified()->create(['name' => 'Uma Unverified', 'email' => 'uma@example.com']),
            self::TwoFactor => User::factory()->withTwoFactor()->create(['name' => 'Tom Twofactor', 'email' => 'tom@example.com']),
        ], $joinPaths);
    }

    /**
     * Opens the page with a full load, so that the page data printed by the server names the component.
     *
     * @param  array<string, string>  $options  the visit options (colour scheme, locale, reduced motion)
     */
    public function open(string $name, array $options = []): mixed
    {
        [$component, $actor] = self::Pages[$name];
        $path = $this->paths[$name];

        if ($actor === self::Guest) {
            return visit($path, $options)->assertScript(self::ComponentScript, $component);
        }

        if ($actor === self::JoinedGuest) {
            $joinPath = $this->joinPaths[$name];

            return visit($joinPath, $options)
                ->fill('#name', 'Gus Guest')
                ->click('form button[type="submit"]')
                ->assertPathIsNot($joinPath)
                ->navigate($path)
                ->assertScript(self::ComponentScript, $component);
        }

        $user = $this->users[$actor];
        $user->forceFill(['locale' => str_starts_with($options['locale'] ?? 'en', 'fr') ? 'fr' : 'en'])->save();

        $page = visit('/login', $options);

        $page->fill('#email', $user->email)
            ->fill('#password', 'password')
            ->click('@login-button')
            ->assertPathIsNot('/login');

        $page->navigate($path);

        $asksForPassword = parse_url($page->url(), PHP_URL_PATH) === '/user/confirm-password' && $component !== 'auth/confirm-password';

        if ($asksForPassword) {
            $page->fill('#password', 'password')
                ->click('@confirm-password-button')
                ->assertPathIs((string) parse_url($path, PHP_URL_PATH))
                ->navigate($path);
        }

        return $page->assertScript(self::ComponentScript, $component);
    }

    /**
     * @return array<string, RetroPhase>
     */
    private static function retroPhases(): array
    {
        return [
            '' => RetroPhase::Writing,
            '--grouping' => RetroPhase::Grouping,
            '--voting' => RetroPhase::Voting,
            '--discussing' => RetroPhase::Discussing,
            '--actions' => RetroPhase::Actions,
            '--roti' => RetroPhase::Roti,
            '--completed' => RetroPhase::Completed,
        ];
    }

    private static function retro(Team $team, User $facilitator, User $member, RetroPhase $phase): Retro
    {
        $retro = Retro::factory()
            ->inPhase($phase)
            ->withGuestAccess()
            ->create(['team_id' => $team->id, 'title' => "Sprint 12 ({$phase->value})"]);

        $fran = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $facilitator->id]);
        $ada = Participant::factory()->create(['retro_id' => $retro->id, 'user_id' => $member->id]);

        $retro->forceFill(['facilitator_participant_id' => $fran->id])->save();

        foreach (['Start', 'Stop', 'Continue'] as $position => $title) {
            $column = Column::factory()->create(['retro_id' => $retro->id, 'title' => $title, 'position' => $position]);

            foreach ([$fran, $ada] as $cardPosition => $author) {
                Card::factory()->create([
                    'retro_id' => $retro->id,
                    'column_id' => $column->id,
                    'participant_id' => $author->id,
                    'content' => "{$title}: pair on the reviews that wait longer than a day, and write down who picks them up",
                    'position' => $cardPosition,
                ]);
            }
        }

        return $retro;
    }

    private static function pokerGame(Team $team, User $facilitator, User $member, bool $revealed): PokerGame
    {
        $game = PokerGame::factory()
            ->withGuestAccess()
            ->create(['team_id' => $team->id, 'title' => $revealed ? 'Sprint 12 estimates (revealed)' : 'Sprint 12 estimates']);

        $fran = PokerPlayer::factory()->create(['poker_game_id' => $game->id, 'user_id' => $facilitator->id]);
        $ada = PokerPlayer::factory()->create(['poker_game_id' => $game->id, 'user_id' => $member->id]);

        $game->forceFill(['facilitator_player_id' => $fran->id])->save();

        $round = openPokerRound($game, PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Login page with passkeys']));

        PokerTask::factory()->create(['poker_game_id' => $game->id, 'title' => 'Export the action items of a retrospective to the tracker']);

        if ($revealed) {
            pokerVote($round, $fran, '5');
            pokerVote($round, $ada, '8');
            $round->forceFill(['revealed_at' => now()])->save();
        }

        return $game;
    }
}
```

- [ ] **Step 4: Write the capture test**

`tests/Browser/Visual/PagesVisualTest.php`:

```php
<?php

use Tests\Browser\Support\PageCatalogue;

it('renders every page without overflow', function (string $name) {
    $catalogue = PageCatalogue::build();
    $isLive = in_array(PageCatalogue::Pages[$name][0], ['retros/show', 'poker/show', 'games/show', 'whiteboards/show'], true);

    $this->captureVisuals($name, $name, function (string $name, array $options) use ($catalogue, $isLive) {
        $page = $catalogue->open($name, $options);

        if ($isLive) {
            $this->awaitRealtime($page);
        }

        return $page->assertScript('document.querySelectorAll(\'[data-slot="person-avatar"] .animate-pulse\').length', 0);
    });
})->with(array_keys(PageCatalogue::Pages));
```

- [ ] **Step 5: Add the pages the catalogue does not know yet**

The catalogue lists the pages of the inventory with the states that have a mockup (the `welcome` page is gone: the owner's answer BLOCK-3 makes `/` a redirect, spec B32 — it has no line here, and `pageComponents()` no longer finds it). Pages added by 18d are captured by `tests/Browser/Visual/AdminPagesVisualTest.php`. For every other name the coverage test still asks for (the error pages of B15, the pages of 18f such as the magic-link request), add a line to `PageCatalogue::Pages` and its path in `build()`, with the actor that can open it. An error page is opened by the address that produces it: `/this-page-does-not-exist` for 404 as a guest, `/admin/branding` as the member for 403. A page that cannot be produced on demand (500, 503) goes in `PagesWithoutCapture` with that reason, and its bench section under `pages/dev/sections` carries its capture.

- [ ] **Step 6: Take the captures**

```bash
npm run build:front
BROWSER_REVERB_PORT=8098 DB_HOST=127.0.0.1 DB_DATABASE=testing_browser_1 php -d memory_limit=2G vendor/bin/pest tests/Browser/Visual
```

Expected: every test passes; a failure reads `Horizontal overflow in <name>-<theme>-<width>-<locale>` followed by the elements, or names the page that did not open. An overflow is fixed in the component (truncate, wrap, `min-w-0`, a container query), never by `data-overflow-ok` unless the element is a scroller by design. A page that does not open means the catalogue's data or path is wrong for the rewritten screen: fix the catalogue, not the screen.

```bash
vendor/bin/sail artisan test --compact tests/Arch/FrontEndPagesTest.php
git status --short tests/visual/__screenshots__ | wc -l
```

Expected: 4 passed; the count is the number of captures added or changed.

- [ ] **Step 7: Compare every page with its mockup, side by side**

Owner's rule of 2026-10-02: the mockup must be faithfully respected. This step is where it is checked on the whole application: the capture of each page is put beside the `preview.html` of its mockup, every difference is listed, and each is fixed or entered in the deviations table. Nothing is settled by "close enough".

**The mockup of each page.** Add to `PageCatalogue` the constant `Mockups`, capture name (or its prefix up to `--`) to the mockup folders under `docs/design-system/components/`, from spec §7:

```php
    /**
     * The mockups each page is compared with (spec §7). A page the design
     * system does not draw names the mockup it was designed from.
     *
     * @var array<string, array<int, string>>
     */
    public const array Mockups = [
        'retros-show-page' => ['ScreenRetroWriting', 'ScreenRetroGrouping', 'ScreenRetroVote', 'ScreenRetroDiscussion', 'ScreenRetroActions', 'ScreenRetroROTI', 'ScreenSurvey', 'MobileRetro'],
        'retros-join-page' => ['GuestJoin', 'MobileAccess'],
        'retros-session-ended-page' => ['ScreenRetroROTI'],
        'poker-show-page' => ['ScreenPokerBefore', 'ScreenPokerAfter', 'ScreenPokerQueue', 'MobilePoker'],
        'poker-join-page' => ['GuestJoin', 'MobileAccess'],
        'poker-estimates-page' => ['ScreenPokerAfter'],
        'poker-decks-page' => ['ScreenPokerQueue'],
        'teams-show-page' => ['ScreenDashboard', 'ScreenTeam', 'ScreenSessionCreate', 'MobileDashboard'],
        'teams-integrations-page' => ['ScreenSettings'],
        'action-items-index-page' => ['ScreenActions'],
        'games-index-page' => ['ScreenIcebreaker', 'MobileRituals'],
        'games-show-page' => ['ScreenIcebreaker', 'ScreenIcebreakerDraw', 'ScreenIcebreakerEmoji', 'ScreenIcebreakerGif', 'MobileRituals'],
        'games-join-page' => ['GuestJoin', 'MobileAccess'],
        'whiteboards-show-page' => ['ScreenWhiteboard'],
        'whiteboards-join-page' => ['GuestJoin', 'MobileAccess'],
        'workspaces-show-page' => ['ScreenWorkspace'],
        'workspaces-create-page' => ['ScreenWorkspace', 'ScreenOnboarding'],
        'workspaces-members-page' => ['ScreenWorkspace', 'ScreenTeam'],
        'workspaces-templates-page' => ['ScreenWorkspace', 'TemplateEditor', 'RetroTemplatePicker'],
        'settings-profile-page' => ['ScreenUserSettings'],
        'settings-security-page' => ['ScreenSecurity'],
        'settings-appearance-page' => ['ScreenUserSettings'],
        'settings-notifications-page' => ['ScreenUserSettings'],
        'settings-api-tokens-page' => ['ScreenUserSettings', 'ScreenSettings'],
        'admin-branding-page' => ['ScreenSettings'],
        'admin-admins-page' => ['ScreenSettings'],
        'admin-sign-in-page' => ['ScreenSettings'],
        'auth-login-page' => ['ScreenAuth', 'MobileAccess'],
        'auth-register-page' => ['ScreenAuth', 'MobileAccess'],
        'auth-forgot-password-page' => ['ScreenAuth'],
        'auth-reset-password-page' => ['ScreenAuth'],
        'auth-verify-email-page' => ['ScreenAuth'],
        'auth-confirm-password-page' => ['ScreenAuth'],
        'auth-two-factor-challenge-page' => ['ScreenAuth', 'ScreenSecurity'],
        'auth-magic-link-page' => ['ScreenAuth'],
        'auth-reminder-unsubscribe-page' => ['ScreenAuth'],
        'auth-recap-unsubscribe-page' => ['ScreenAuth'],
        'invitations-show-page' => ['ScreenAuth', 'MobileAccess'],
        'errors-page' => ['ScreenErrors'],
    ];
```

The keys are the capture names of `PageCatalogue::Pages` as they stand after 18e and 18f: add a line for a page that list has and this one lacks, with the mockup spec §7 gives it, and remove a line whose page is gone. A page with no mockup of its own (spec §7, "Designed from neighbouring mockups") names the mockup it was designed from; the comparison is then on what that mockup fixes — frame, spacing, component anatomy, labels of shared controls.

**The coverage test**, appended to `tests/Arch/FrontEndPagesTest.php`, written and run before the comparison (it fails until the two documents exist):

```php
/**
 * @return array<int, array{id: string, reason: string, explanation: string}>
 */
function recordedDeviations(string $root): array
{
    $rows = [];

    foreach (file("{$root}/docs/superpowers/research/front-rewrite/deviations.md", FILE_IGNORE_NEW_LINES) ?: [] as $line) {
        if (preg_match('/^\| (D\d+) \|/', $line) !== 1) {
            continue;
        }

        $cells = array_map(trim(...), explode('|', trim($line, '| ')));

        $rows[] = ['id' => $cells[0], 'reason' => $cells[5] ?? '', 'explanation' => $cells[6] ?? ''];
    }

    return $rows;
}

it('has a mockup comparison for every page', function () {
    $root = dirname(__DIR__, 2);
    $fidelity = (string) file_get_contents("{$root}/docs/superpowers/research/front-rewrite/fidelity.md");
    $pages = array_values(array_unique(array_map(
        fn (string $name): string => explode('--', $name)[0],
        array_keys(PageCatalogue::Pages),
    )));

    expect(array_values(array_diff($pages, array_keys(PageCatalogue::Mockups))))->toBe([])
        ->and(array_values(array_filter(
            array_merge(...array_values(PageCatalogue::Mockups)),
            fn (string $mockup): bool => ! is_file("{$root}/docs/design-system/components/{$mockup}/preview.html"),
        )))->toBe([])
        ->and(array_values(array_filter($pages, fn (string $page): bool => ! str_contains($fidelity, "## {$page}\n"))))->toBe([]);
});

it('leaves no difference with a mockup open', function () {
    $fidelity = (string) file_get_contents(dirname(__DIR__, 2).'/docs/superpowers/research/front-rewrite/fidelity.md');

    expect(preg_match_all('/\|\s*open\s*\|/', $fidelity))->toBe(0);
});

it('gives every deviation an allowed reason and an explanation', function () {
    $deviations = recordedDeviations(dirname(__DIR__, 2));

    expect($deviations)->not->toBeEmpty()
        ->and(array_values(array_filter(
            $deviations,
            fn (array $row): bool => ! in_array($row['reason'], ['owner', 'backlog', 'false', 'unsafe', 'a11y', 'no data'], true) || $row['explanation'] === '',
        )))->toBe([]);
});

it('points every deviation of the comparison to a line of the table', function () {
    $root = dirname(__DIR__, 2);
    $fidelity = (string) file_get_contents("{$root}/docs/superpowers/research/front-rewrite/fidelity.md");
    preg_match_all('/\bD\d+\b/', $fidelity, $used);

    expect(array_values(array_diff(array_unique($used[0]), array_column(recordedDeviations($root), 'id'))))->toBe([]);
});
```

(`use Tests\Browser\Support\PageCatalogue;` at the top of the file.)

**The pictures of the mockups.** Playwright is installed for the browser suite; its command line draws each `preview.html` at the two widths and in the two themes, into the ledger (untracked):

```bash
mkdir -p "$LEDGER/reports/mockups"
for mockup in $(ls docs/design-system/components | grep -E "^(Screen|Mobile|GuestJoin|TemplateEditor|RetroTemplatePicker)"); do
  for theme in light dark; do
    for width in 1440 390; do
      npx playwright screenshot --full-page --color-scheme="$theme" --viewport-size="$width,900" \
        "file://$PWD/docs/design-system/components/$mockup/preview.html" \
        "$LEDGER/reports/mockups/$mockup-$theme-$width.png"
    done
  done
done
ls "$LEDGER/reports/mockups" | wc -l
```

Expected: four pictures per mockup. A `Mobile*` mockup is read at 390; a `Screen*` mockup at 1440 and, for its mobile section, at 390. A preview that draws both themes side by side whatever the colour scheme is read as it is.

**The comparison.** Split the pages between reviewers by screen group (the rows of spec §7); each reviewer reads, for each page: its captures (`tests/visual/__screenshots__/<name>-{light,dark}-{1440,390}-{fr,en}.png`), the pictures of its mockups, the mockup's `README.md` (zones, states, behaviour, labels), and the answers of `owner-answers-2026-10-02.md` for that screen group (an explicit answer stands as written, even against the mockup). It writes in `docs/superpowers/research/front-rewrite/fidelity.md` one section per page:

```markdown
## retros-show-page

Mockups: ScreenRetroWriting, ScreenRetroGrouping, ScreenRetroVote, ScreenRetroDiscussion, ScreenRetroActions, ScreenRetroROTI, ScreenSurvey, MobileRetro. States compared: writing, grouping, voting, discussing, actions, roti, completed, guest, 390.

| Zone | Element | Mockup | Application | Status |
|---|---|---|---|---|
| Top bar | timer presets | 1, 3, 5, 10 min | 1, 3, 5, 10 min | same |
| Column | add-card label | "Ajouter une carte…" | "Add a card…" / "Ajouter une carte…" | same |
| Facilitator bar | "+2 min" | shown while a timer runs | missing | open |
```

Every zone the mockup's README names has at least one line; every state the README lists is compared (a state the catalogue cannot reach gets a new entry in `PageCatalogue::Pages` and its capture, Step 5 and Step 6). What is compared, in this order: **layout** (which zones, in what order, in which column, at both widths), **placement** (where each control sits inside its zone), **labels** (word for word, in French against the mockup's French, in English against its English where the mockup has one), **states** (every state of the README exists and looks as drawn), then the rules of spec §5 the first version of this step looked for (a label cut without an ellipsis or wrapped inside a button, a tab, a select or a menu item; a leading icon or avatar not on the first line of its title; text on a solid colour that is not its `*-foreground`; in dark, a surface that stayed light or a border that vanished; in French, a width sized for the English label; at 390, a sidebar instead of the tab bar, or a control under the tab bar).

`Status` is one of: `same`; `open` (a difference not yet handled); `fixed in <commit>`; `D<n>` (a line of the deviations table); `owner <id>` (an explicit answer of the owner, by its id in `owner-answers-2026-10-02.md`); `backlog` (spec §10).

**The deviations table.** `docs/superpowers/research/front-rewrite/deviations.md` — "Deviations from the mockup", one table for the whole application:

```markdown
| Id | Page | Mockup | Element | Built instead | Reason | Why |
|---|---|---|---|---|---|---|
| D1 | auth-login-page | ScreenAuth | "Nous avons envoyé un lien de connexion à …" | "If an account exists for …" | unsafe | The answer must not say whether the address has an account (18f, S8). |
```

Its first lines are copied from what the earlier phases recorded, each re-checked against the page as it is now and against the allowed reasons: the Deviations table of plan 18f (V1–V23, renumbered D1…), the "gaps with the mockups" of the 18e report, the `rewrites/*.md` files of Task 4. `Reason` is one of `owner`, `backlog`, `false`, `unsafe`, `a11y`, `no data` — the last four are the only reasons this plan may give by itself: something false or unsafe, an accessibility rule, data the product does not have at all. A gap that an earlier report recorded with another reason ("out of scope", "later", "not wired") is **not** a deviation: it is an `open` line.

**Closing every `open` line.** One fix wave per screen group, each fix in its own commit (`fix(<screen>): <element> as the mockup draws it`), with the Vitest case that pins it when it is a label, a state or an order; then the captures of that page are taken again (Step 6) and the line becomes `fixed in <commit>`. A browser test that asserted the old label or flow changes in the same commit, and the commit message names the mockup that imposes it. An `open` line that cannot be fixed here is one of three things:

1. It fits an allowed reason: it becomes a `D<n>` line, with the reason spelled out.
2. The mockup needs data the back end does not give, and the owner has not sent it to the backlog: this plan does not build back end. The line stays `open`, the page is listed in `progress.md` under "Awaiting the owner: mockup element without data", and the plan stops at the end of this task — the acceptance check "no unapproved deviation remains" cannot pass, and the owner decides between a back-end task (18e or 18f reopened), the backlog, or a deviation.
3. The mockup and an owner answer disagree: the answer stands, the line reads `owner <id>`.

```bash
vendor/bin/sail artisan test --compact tests/Arch/FrontEndPagesTest.php
grep -c "| open |" docs/superpowers/research/front-rewrite/fidelity.md
grep -c "^| D" docs/superpowers/research/front-rewrite/deviations.md
```

Expected: the four fidelity tests pass; `0` open lines; the number of deviations, written in `progress.md`. The owner approves the deviations table by reading it in the final report: until then a deviation is "recorded with an allowed reason", and Task 11 says so in those words.

- [ ] **Step 8: Commit**

```bash
vendor/bin/pint --dirty --format agent
git add tests/Browser/Support/PageCatalogue.php tests/Browser/Visual/PagesVisualTest.php tests/Arch/FrontEndPagesTest.php tests/visual/__screenshots__ resources docs/superpowers/research/front-rewrite/fidelity.md docs/superpowers/research/front-rewrite/deviations.md
git commit -m "test(front): a capture of every page, compared with its mockup; deviations recorded"
```

(The fixes of the fix wave are already committed, one by one; this commit holds the catalogue, the tests, the captures and the two documents.)

---

### Task 9: Accessibility pass

**Files:**
- Create: `tests/Browser/Smoke/AccessibilityTest.php`
- Modify: `tests/Feature/LightScopeTokensTest.php` (append; it owns `customPropertiesOfFirstBlock`)
- Modify: the components the tests report

**Interfaces:**
- Consumes: `PageCatalogue` (Task 8); `customPropertiesOfFirstBlock(string $stylesheet, string $selector): array` of `LightScopeTokensTest.php`; `App\Support\Branding\BrandPalette::contrast(array $x, array $y): float`.
- Produces: `controlsWithoutFocusMark(mixed $page): array<int, string>`; the checklist report for the owner in `$LEDGER/reports/accessibility.md` (Step 5), written by the agent that ran it in a real browser.

What is automated and what is not:

| Point | Automated | Checklist of Step 5 (an agent in a real browser) |
|---|---|---|
| Contrast (rule 6) | Token pairs computed from `app.css` in both themes (AAA body, AA secondary, 3:1 controls); axe `color-contrast` on every page in both themes (AA) | Text over a column colour, a presence colour or a GIF; the brand colour of a rebranded instance is covered by `BrandPaletteTest` |
| Visible focus (rule 5) | Every control of every page is focused and must change look | Focus order follows reading order; focus returns to the trigger when a dialog, sheet or drawer closes; focus is not lost after a realtime update |
| Reduced motion (rule 8, AC12) | No CSS animation or transition longer than 50 ms, and none looping, on any page under `prefers-reduced-motion`; source rule of Task 6 for scripted motion; Vitest of `reaction-bar`, `timer`, `gif-picker` | Flying reactions, confetti and the card flip, which only start on an action |
| Keyboard paths | `tests/Browser/Smoke/KeyboardDragTest.php` (drag and drop), the walkthroughs that use `keys()` | The paths of the checklist below |
| Names, roles, labels | axe on every page, level "serious" and above | The live regions (timer, votes, connection state) read in the DOM and in the accessibility tree: role, `aria-live`, and that the text changes once per event. **No real screen reader is used**: what VoiceOver or NVDA actually says is not verified by this plan |

- [ ] **Step 1: Append the token contrast test**

At the end of `tests/Feature/LightScopeTokensTest.php`, with `use App\Support\Branding\BrandPalette;` added under the opening tag:

```php
/**
 * @param  array<string, string>  $tokens
 * @return array{0: float, 1: float, 2: float}
 */
function oklchOfToken(array $tokens, string $name): array
{
    $value = $tokens["--{$name}"] ?? '';

    while (preg_match('/^var\((--[\w-]+)\)$/', $value, $reference) === 1) {
        $value = $tokens[$reference[1]] ?? '';
    }

    throw_unless(
        preg_match('/^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/', $value, $parts) === 1,
        RuntimeException::class,
        "--{$name} is not an oklch colour.",
    );

    return [(float) $parts[1], (float) $parts[2], (float) $parts[3]];
}

dataset('tokenContrasts', function () {
    $pairs = [
        ['foreground', 'background', 7.0],
        ['foreground', 'card', 7.0],
        ['popover-foreground', 'popover', 7.0],
        ['accent-foreground', 'accent', 7.0],
        ['muted-foreground', 'background', 4.5],
        ['muted-foreground', 'card', 4.5],
        ['muted-foreground', 'muted', 4.5],
        ['secondary-foreground', 'secondary', 4.5],
        ['primary-foreground', 'primary', 4.5],
        ['destructive-foreground', 'destructive', 4.5],
        ['input', 'background', 3.0],
        ['input', 'card', 3.0],
        ['ring', 'background', 3.0],
        ['ring', 'card', 3.0],
    ];

    foreach ([':root', '.dark'] as $scope) {
        foreach ($pairs as [$text, $ground, $minimum]) {
            yield "{$scope}: {$text} on {$ground}" => [$scope, $text, $ground, $minimum];
        }
    }
});

it('keeps the contrast the rules ask for: AAA for body text, AA for secondary text, 3:1 for controls', function (string $scope, string $text, string $ground, float $minimum) {
    $tokens = customPropertiesOfFirstBlock(file_get_contents(resource_path('css/app.css')), $scope);

    expect(BrandPalette::contrast(oklchOfToken($tokens, $text), oklchOfToken($tokens, $ground)))->toBeGreaterThanOrEqual($minimum);
})->with('tokenContrasts');
```

Run: `vendor/bin/sail artisan test --compact tests/Feature/LightScopeTokensTest.php`
Expected: 30 passed (the 2 existing tests and 28 pairs). A failing pair means `app.css` no longer matches `docs/design-system/app.css`: `DesignTokensTest` fails too, and the stylesheet is restored, not the threshold.

- [ ] **Step 2: Write the browser test**

`tests/Browser/Smoke/AccessibilityTest.php`:

```php
<?php

use Tests\Browser\Support\PageCatalogue;

/**
 * Focuses every control of the page in turn and returns those whose look does
 * not change: no outline, and no change of ring, border, background or
 * underline on the control, its three nearest ancestors or its neighbours.
 */
function controlsWithoutFocusMarkScript(): string
{
    return <<<'JS'
    async () => {
        const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(true)));
        const look = (node) => {
            const style = getComputedStyle(node);

            return [style.outlineStyle, style.outlineWidth, style.outlineColor, style.boxShadow, style.borderColor, style.backgroundColor, style.textDecorationLine].join('|');
        };
        const mark = (element) => {
            const nodes = [element.previousElementSibling, element.nextElementSibling];

            for (let node = element, depth = 0; node && depth < 4; node = node.parentElement, depth++) {
                nodes.push(node);
            }

            return nodes.filter(Boolean).map(look).join('\n');
        };
        const describe = (element) => element.tagName.toLowerCase()
            + (element.id ? `#${element.id}` : '')
            + (element.getAttribute('aria-label') ? `[aria-label="${element.getAttribute('aria-label')}"]` : '')
            + (element.textContent.trim() ? ` "${element.textContent.trim().slice(0, 30)}"` : '');
        const controls = [...document.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, summary, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]')]
            .filter((element) => ! element.disabled
                && element.getClientRects().length > 0
                && getComputedStyle(element).visibility !== 'hidden'
                && ! element.closest('.excalidraw, [inert], [aria-hidden="true"], [data-focus-mark-ok]'));
        const offenders = [];

        for (const element of controls) {
            if (! element.isConnected) {
                continue;
            }

            document.activeElement?.blur();
            await frame();

            const before = mark(element);

            element.focus({ focusVisible: true });

            if (document.activeElement !== element) {
                continue;
            }

            await frame();

            const style = getComputedStyle(element);
            const outlined = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;

            if (! outlined && mark(element) === before) {
                offenders.push(describe(element));
            }
        }

        document.activeElement?.blur();

        return JSON.stringify([...new Set(offenders)].slice(0, 20));
    }
    JS;
}

/**
 * Animations still running under `prefers-reduced-motion`: longer than a blink, or looping.
 */
function runningMotionScript(): string
{
    return <<<'JS'
    () => JSON.stringify(document.getAnimations()
        .filter((animation) => animation.playState === 'running')
        .map((animation) => ({ timing: animation.effect?.getComputedTiming(), target: animation.effect?.target }))
        .filter(({ timing }) => timing && (timing.duration > 50 || timing.iterations === Infinity))
        .map(({ target }) => (target?.tagName ?? 'unknown').toLowerCase() + (typeof target?.className === 'string' && target.className ? `.${target.className.trim().split(/\s+/).slice(0, 3).join('.')}` : ''))
        .slice(0, 20))
    JS;
}

/**
 * @return array<int, string>
 */
function controlsWithoutFocusMark(mixed $page): array
{
    $page->keys('body', 'Tab');

    return json_decode((string) $page->script(controlsWithoutFocusMarkScript()), true, flags: JSON_THROW_ON_ERROR);
}

it('passes the automated accessibility rules on every page, in both themes', function (string $name) {
    $catalogue = PageCatalogue::build();

    foreach (['light', 'dark'] as $theme) {
        $catalogue->open($name, ['colorScheme' => $theme, 'locale' => 'en-US', 'reducedMotion' => 'reduce'])
            ->assertNoAccessibilityIssues();
    }
})->with(array_keys(PageCatalogue::Pages));

it('shows where the focus is on every control of every page', function (string $name) {
    $page = PageCatalogue::build()->open($name, ['colorScheme' => 'light', 'locale' => 'en-US', 'reducedMotion' => 'reduce']);

    expect(controlsWithoutFocusMark($page))->toBe([], "Controls without a focus mark on {$name}");
})->with(array_keys(PageCatalogue::Pages));

it('stops moving when the visitor asks for reduced motion', function (string $name) {
    $page = PageCatalogue::build()->open($name, ['colorScheme' => 'light', 'locale' => 'en-US', 'reducedMotion' => 'reduce']);

    $page->script('() => document.fonts.ready.then(() => new Promise((resolve) => setTimeout(() => resolve(true), 300)))');

    expect(json_decode((string) $page->script(runningMotionScript()), true, flags: JSON_THROW_ON_ERROR))->toBe([], "Motion left on {$name}");
})->with(array_keys(PageCatalogue::Pages));

it('catches a control that hides its focus', function () {
    $page = visit('/dev/design-system/button', ['reducedMotion' => 'reduce']);

    $page->script("() => { const button = document.createElement('button'); button.id = 'no-focus-mark'; button.textContent = 'Silent'; button.style.outline = 'none'; button.style.boxShadow = 'none'; document.body.appendChild(button); }");

    expect(implode(' ', controlsWithoutFocusMark($page)))->toContain('button#no-focus-mark');
});

it('accepts the controls of the design-system bench', function () {
    $page = visit('/dev/design-system/button', ['reducedMotion' => 'reduce']);

    expect(controlsWithoutFocusMark($page))->toBe([]);
});

it('catches an animation that ignores reduced motion', function () {
    $page = visit('/dev/design-system/button', ['reducedMotion' => 'reduce']);

    $page->script("() => { const box = document.createElement('div'); box.className = 'stubborn'; document.body.appendChild(box); box.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 4000, iterations: Infinity }); }");

    expect(implode(' ', json_decode((string) $page->script(runningMotionScript()), true, flags: JSON_THROW_ON_ERROR)))->toContain('div.stubborn');
});
```

- [ ] **Step 3: Run the three self-tests first**

```bash
BROWSER_REVERB_PORT=8098 DB_HOST=127.0.0.1 DB_DATABASE=testing_browser_1 php -d memory_limit=2G vendor/bin/pest tests/Browser/Smoke/AccessibilityTest.php --filter="catches|accepts"
```

Expected: 3 passed. They prove the harness before it judges the pages: a button with no focus mark is caught, the buttons of the bench are accepted, a looping scripted animation is caught. If `accepts the controls of the design-system bench` fails, read the listed controls: a control of the bench with no focus mark is a real defect of the library (fix it); if every control is listed, scripted focus does not count as keyboard focus in this Chromium, and the finding goes to the ledger before anything else is run.

- [ ] **Step 4: Run it on every page and fix what it finds**

```bash
BROWSER_REVERB_PORT=8098 DB_HOST=127.0.0.1 DB_DATABASE=testing_browser_1 php -d memory_limit=2G vendor/bin/pest tests/Browser/Smoke/AccessibilityTest.php
```

Expected at the end: all pass. On the way:

| Failure | Do |
|---|---|
| An axe violation | Fix the markup: a name for the control, a label for the field, the right role, the token that gives the contrast. The report names the rule and the element. |
| `Controls without a focus mark on <page>` | Give the control `focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2`, or the ring of the library. A control inside Excalidraw is not listed (third party). Only an element that is focusable without being a control (a scroll region the browser makes focusable) may take `data-focus-mark-ok`, with the reason in the ledger. |
| `Motion left on <page>` | The animation needs `motion-reduce:animate-none` or `motion-reduce:transition-none`, or the component must stop its loop under the preference. |

The whiteboard page holds a canvas: an axe violation inside `.excalidraw` is third-party and is written in the ledger, not fixed; if it blocks the test, the whiteboard pages keep the focus and motion checks and leave the axe dataset, with the reason in the test.

- [ ] **Step 5: The accessibility checklist, run by an agent in a real browser**

Owner's answer (2026-10-02): the checklist is run by an agent with a real browser, and the owner reads the report. Nobody else runs it.

**Who and with what.** One agent, with the Chrome automation tools of the session (`claude-in-chrome`: load the skill first, then `tabs_context_mcp`, `tabs_create_mcp`, `navigate`, `computer` for keys and screenshots, `read_page` for the accessibility tree, `javascript_tool` for computed styles, `resize_window`, `read_console_messages`). It drives the owner's Chrome on the Sail application (`http://localhost`, never port 8097), signed in as the demo users of `DemoSeeder`. It works in new tabs it opens itself and closes them at the end. Steps that need a second account or a guest (the two realtime lines) use a second tab signed in through the guest link, which is the rule recorded for the plan 17 walkthroughs: a guest tab, not a second browser profile.

**What it is not.** No real screen reader is used: the agent has no VoiceOver, NVDA or JAWS. The block that the first version of this plan called "Screen reader (VoiceOver)" is replaced by checks of the accessibility tree and of the live regions in the DOM, which prove that the right element exists and changes once, not what assistive technology says aloud. The report states this in its first lines, and lists a real screen-reader pass as an open item for the owner.

**How each kind of line is checked.**

| Kind | How the agent checks it | Evidence written in the report |
|---|---|---|
| Keyboard only | Every action through `computer` key presses (`Tab`, `Shift+Tab`, `Enter`, `Space`, arrows, `Escape`, the shortcut); no click, no `javascript_tool` call that moves focus or triggers a handler. After each step, `javascript_tool` reads `document.activeElement` (tag, accessible name, `data-test`). | The key sequence, the focused element after it, a screenshot |
| Focus return | `document.activeElement` read before opening and after closing the overlay; they must be the same element. | Both readings |
| Contrast by eye | A screenshot, plus the computed `color` and `background-color` of the element read with `javascript_tool` and the ratio computed from them (text over an image: the screenshot only, marked "not measurable"). | Ratio, threshold (4.5 text, 3 large text and controls), screenshot |
| Reduced motion | The preference is emulated for the tab: `chrome://settings/accessibility` cannot be driven, so the agent sets it through the DevTools rendering emulation if the tools expose it, otherwise it asks the owner once to turn on "Reduce motion" in the operating system and waits. Each line is then checked by reading `getAnimations()` on the document right after the action (`javascript_tool`): no running animation longer than 50 ms. | The animations list, a screenshot |
| Live regions | `read_page` on the region before and after the event; `javascript_tool` installs a `MutationObserver` on it and counts the text changes during the event. | Role, `aria-live` value, number of changes (expected: 1 per event) |

Run once in light and once in dark for the keyboard and contrast blocks; once for the two others.

Keyboard only, no pointer:

- [ ] Log in, open the team page from the sidebar, open "New session", choose the retrospective type and a template, create, land on the board.
- [ ] On the board: add a card with the keyboard, edit it, delete it; move a card to another column and group two cards with the drag handle (Space, arrows, Space); vote and remove a vote; open the card menu and close it with Escape.
- [ ] As facilitator: go through every phase to Completed with the forward button; start, pause and stop the timer; open the settings popover and change one setting.
- [ ] `?` opens the shortcuts panel and Escape closes it; ⌘K opens the command palette, a search result opens with Enter.
- [ ] The shortcuts built in 18f: `G` starts the keyboard move of a card in the Grouping phase and `F` highlights a card in Discussing, `⌘→` moves to the next phase, `C` plays the coffee card and `⇧R` starts a re-vote at poker; with "Single-key shortcuts" turned off in the settings, none of the single-letter ones fires and `⌘→`, `⌘K` still do.
- [ ] Poker: play a card with a digit, reveal, re-vote, save an estimate, reorder the queue with the drag handle.
- [ ] Action items: change a filter, open an item, mark it done, close the sheet; focus is back on the row.
- [ ] Settings: move through the sub-navigation, change the theme, create and revoke an API token.
- [ ] Every dialog, sheet, drawer, popover and menu met on the way: focus goes inside on opening, Tab stays inside, Escape closes, focus returns to what opened it.
- [ ] At 390 wide (`resize_window`): the tab bar is reachable and its five entries are in reading order.

Contrast, in both themes:

- [ ] Card text on each of the eight column colours; the column title on its header.
- [ ] Initials on each presence colour in the presence stack and on live cursors.
- [ ] Text laid over a GIF (attribution, remove button).
- [ ] A destructive action always shows an icon and a label, never colour alone.
- [ ] The focus ring is visible on a primary button, on a card, on a column colour and on the dark sidebar.

Reduced motion, spec AC12:

- [ ] Sending a reaction shows it without flying across the screen.
- [ ] Completing a retro, and a poker consensus, show no confetti.
- [ ] Revealing poker cards fades them instead of flipping.
- [ ] Opening a dialog, a sheet and a drawer has no slide; skeletons do not pulse.

Live regions (accessibility tree and DOM; not a screen reader):

- [ ] The timer's region changes once when the time is up, not every second, and its accessible name is "Time's up!".
- [ ] A vote, a new card from another participant (guest tab) and a lost connection each change a region with `aria-live` or a `status` / `alert` role, once.

**The report.** `$LEDGER/reports/accessibility.md`, written for the owner, who reads it without having watched the run:

1. First lines, verbatim: `Run by an agent driving Chrome (claude-in-chrome), not by a person. No real screen reader was used: the "Live regions" block checks the accessibility tree and the DOM, not speech output. A pass with VoiceOver or NVDA is still open.` Then the date, the commit (`git rev-parse --short HEAD`), the Chrome version, the two themes.
2. One table per block: line, result (`pass`, `finding`, `not checked` with the reason), evidence as in the table above, screenshot file under `$LEDGER/reports/accessibility/`.
3. Findings: page, what was pressed, what happened, what was expected, and whether it was fixed in this task (commit) or left for the final report.
4. What the agent could not check and why (a tool that was missing, the motion preference the owner did not turn on, a step that needed a person).

A finding is fixed in this task when the fix is a class or an attribute; otherwise it goes in the final report. A line marked `not checked` is never counted as a pass in Task 11. If the Chrome tools are not available in the session that runs the plan, the whole step is `not checked`, the report says so in its first line, and Task 11 lists the checklist under "What waits for the owner".

- [ ] **Step 6: Gates and commit**

```bash
vendor/bin/pint --dirty --format agent
npm run build:front && npm run types:check && npm run check && npm run test
git add tests/Browser/Smoke/AccessibilityTest.php tests/Feature/LightScopeTokensTest.php resources tests/visual/__screenshots__
git commit -m "test(a11y): axe, focus mark and reduced motion on every page, and token contrast in both themes"
```

A component fixed here has its capture taken again (Task 8, Step 6) before the commit.

---

### Task 10: Parity table

**Files:**
- Create: `bin/front-parity.mjs`
- Create: `docs/superpowers/research/front-rewrite/parity-rulings.tsv` (written by hand)
- Create: `docs/superpowers/research/front-rewrite/parity.md` (generated)

**Interfaces:**
- Consumes: `route-callers.tsv` (five tab-separated columns, no header: method, URI, name, action, callers), `inventory-pages.md` (a `## pages/<file>.tsx` heading per page, action tables whose first header is Action, Key, UI, Element, Feature, Capability or Step), `inventory-components.md` (one bullet per file, starting with the path between backticks), spec §8, `$LEDGER/reports/deleted-files.txt` and `candidates.txt` (Task 3), the per-screen parity tables of the 18e report.
- Produces: `node bin/front-parity.mjs <routes.json> [--check] [--out=<file>]`; `parity.md` with five sections (routes, pages, actions, features, files) and the hole count on its fourth line.

Every row of the old front end ends with a verdict. The script gives the verdict itself where the code proves it (a route that still has a Wayfinder caller, a page file that exists). Everywhere else a person writes one line in `parity-rulings.tsv`: `kind<TAB>key<TAB>ruling`, where the ruling starts with `kept:` (same control), `changed:` (another control or place, mockup-imposed), `moved:` (a file replaced by another) or `gap:` (not in the new front end, with the reason), and anything but a gap names a file that exists.

- [ ] **Step 1: Write the script**

`bin/front-parity.mjs`:

```js
#!/usr/bin/env node
/**
 * Builds the parity table of the front-end rewrite and checks that it has no hole.
 *
 *   node bin/front-parity.mjs <routes.json>           writes docs/superpowers/research/front-rewrite/parity.md
 *   node bin/front-parity.mjs <routes.json> --check   same, and exits 1 while a row has no verdict
 *   node bin/front-parity.mjs <routes.json> --out=<file>   writes the table elsewhere
 *
 * <routes.json> is the output of `php artisan route:list --json`.
 *
 * Read: route-callers.tsv, inventory-pages.md and inventory-components.md (the
 * state before the rewrite), the current resources/js, and parity-rulings.tsv,
 * the only hand-written input: `kind<TAB>key<TAB>ruling`, where kind is route,
 * page, action, feature or file, and the ruling starts with `kept:`, `changed:`,
 * `moved:` or `gap:`. A ruling other than a gap names at least one file that
 * exists.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const research = join(root, 'docs/superpowers/research/front-rewrite');
const sourceRoot = join(root, 'resources/js');
const routesFile = process.argv[2];
const check = process.argv.includes('--check');
const output =
    process.argv.find((argument) => argument.startsWith('--out='))?.slice(6) ??
    join(research, 'parity.md');

if (!routesFile || !existsSync(routesFile)) {
    console.error('Usage: node bin/front-parity.mjs <routes.json> [--check]');
    process.exit(2);
}

const generated = ['actions', 'routes', 'wayfinder'].map((name) =>
    join(sourceRoot, name),
);

function walk(directory) {
    return readdirSync(directory).flatMap((name) => {
        const path = join(directory, name);

        if (statSync(path).isDirectory()) {
            return generated.includes(path) ? [] : walk(path);
        }

        return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)
            ? [path]
            : [];
    });
}

const sources = new Map(
    walk(sourceRoot)
        .filter((path) => !path.startsWith(join(sourceRoot, 'test') + '/'))
        .map((path) => [
            relative(sourceRoot, path),
            readFileSync(path, 'utf8'),
        ]),
);

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Local names under which a file imports `exported` (or the default export) of `module`. */
function importedAs(source, module, exported) {
    const names = [];
    const pattern = new RegExp(
        `import\\s+(?:type\\s+)?([^;]*?)\\s+from\\s+['"]${escape(module)}['"]`,
        'g',
    );

    for (const [, clause] of source.matchAll(pattern)) {
        const defaultName = clause.match(/^([\w$]+)/);

        if (defaultName) {
            names.push({ local: defaultName[1], whole: true });
        }

        const namespace = clause.match(/\*\s+as\s+([\w$]+)/);

        if (namespace) {
            names.push({ local: namespace[1], whole: true });
        }

        const named = clause.match(/\{([^}]*)\}/);

        for (const part of named ? named[1].split(',') : []) {
            const [original, alias] = part
                .trim()
                .replace(/^type\s+/, '')
                .split(/\s+as\s+/);

            if (original === exported) {
                names.push({ local: alias ?? original, whole: false });
            }
        }
    }

    return names;
}

function usesMember(source, { local, whole }, member) {
    if (!whole) {
        return true;
    }

    if (member === null) {
        return new RegExp(`\\b${escape(local)}\\b[^'"]`).test(
            source.replace(/import[^;]*;/g, ''),
        );
    }

    return new RegExp(
        `\\b${escape(local)}\\s*(?:\\.\\s*${escape(member)}\\b|\\[\\s*['"]${escape(member)}['"]\\s*\\])`,
    ).test(source);
}

/** Front files that call a route through Wayfinder, by controller method or by route name. */
function callersOf(route) {
    const targets = [];
    const [controller, method] = route.action.split('@');

    if (controller.includes('\\')) {
        targets.push({
            module: `@/actions/${controller.replaceAll('\\', '/')}`,
            exported: method ?? 'default',
            member: method ?? null,
        });
    }

    if (route.name) {
        const parts = route.name.split('.');
        const last = parts
            .pop()
            .replace(/-([a-z0-9])/g, (_, letter) => letter.toUpperCase());

        targets.push({
            module: ['@/routes', ...parts].join('/'),
            exported: last,
            member: last,
        });
    }

    const callers = [];

    for (const [path, source] of sources) {
        const called = targets.some(({ module, exported, member }) =>
            importedAs(source, module, exported).some((name) =>
                usesMember(source, name, member),
            ),
        );

        if (called) {
            callers.push(path);
        }
    }

    return callers.sort();
}

const rulingsFile = join(research, 'parity-rulings.tsv');
const rulings = new Map();
const rulingProblems = [];

for (const [index, line] of (existsSync(rulingsFile)
    ? readFileSync(rulingsFile, 'utf8').split('\n')
    : []
).entries()) {
    if (line.trim() === '' || line.startsWith('#')) {
        continue;
    }

    const [kind, key, ruling] = line.split('\t');

    if (
        !['route', 'page', 'action', 'feature', 'file'].includes(kind) ||
        !key ||
        !/^(kept|changed|moved|gap): \S/.test(ruling ?? '')
    ) {
        rulingProblems.push(`parity-rulings.tsv:${index + 1} is not "kind<TAB>key<TAB>kept:|changed:|moved:|gap: text"`);
        continue;
    }

    if (!ruling.startsWith('gap:')) {
        const files = ruling.match(/(?:resources|tests|app|routes)\/[\w./-]+\.\w+/g) ?? [];

        if (files.length === 0) {
            rulingProblems.push(`parity-rulings.tsv:${index + 1} names no file`);
        }

        for (const file of files) {
            if (!existsSync(join(root, file))) {
                rulingProblems.push(`parity-rulings.tsv:${index + 1} names ${file}, which does not exist`);
            }
        }
    }

    rulings.set(`${kind}\t${key}`, ruling);
}

const usedRulings = new Set();
const ruling = (kind, key) => {
    usedRulings.add(`${kind}\t${key}`);

    return rulings.get(`${kind}\t${key}`) ?? null;
};

const cell = (text) => String(text).replaceAll('|', '\\|').replaceAll('\n', ' ');
const holes = [];

/* Routes */

const before = new Map();

for (const line of readFileSync(join(research, 'route-callers.tsv'), 'utf8').split('\n')) {
    if (line.trim() === '') {
        continue;
    }

    const [method, uri, name, action, callers] = line.split('\t');

    before.set(`${method} ${uri}`, { method, uri, name, action, callers: callers ?? '' });
}

const now = new Map(
    JSON.parse(readFileSync(routesFile, 'utf8')).map((route) => [
        `${route.method} ${route.uri}`,
        { ...route, name: route.name ?? '' },
    ]),
);

const routeRows = [];

for (const key of [...new Set([...before.keys(), ...now.keys()])].sort()) {
    const old = before.get(key);
    const current = now.get(key);
    const callers = current ? callersOf(current) : [];
    const written = ruling('route', key);
    let verdict;

    if (!current) {
        verdict = written ?? 'HOLE: the route no longer exists';
    } else if (callers.length > 0) {
        verdict = old ? 'called' : 'new route, called';
    } else if (!old) {
        verdict = written ?? 'new route, no front caller';
    } else if (old.callers === '') {
        verdict = written ?? 'no front caller before or after';
    } else {
        verdict = written ?? 'HOLE: had a front caller, has none';
    }

    if (verdict.startsWith('HOLE')) {
        holes.push(`route ${key}: ${verdict}`);
    }

    routeRows.push(
        `| ${cell(key)} | ${cell((current ?? old).name)} | ${cell(old ? old.callers || 'none' : 'not in the inventory')} | ${cell(callers.join(', ') || 'none')} | ${cell(verdict)} |`,
    );
}

/* Pages and their actions */

const inventory = readFileSync(join(research, 'inventory-pages.md'), 'utf8').split('\n');
const pageRows = [];
const actionRows = [];
let page = null;
let headers = null;
const seenPages = new Set();
const seenActions = new Set();

for (const line of inventory) {
    const heading = line.match(/^## `?pages\/([\w/-]+\.tsx)`?/);

    if (heading) {
        page = heading[1];
        headers = null;

        if (!seenPages.has(page)) {
            seenPages.add(page);

            const exists = existsSync(join(sourceRoot, 'pages', page));
            const written = ruling('page', page);
            const verdict = exists
                ? 'page file present'
                : (written ?? 'HOLE: page file gone');

            if (verdict.startsWith('HOLE')) {
                holes.push(`page ${page}: ${verdict}`);
            }

            pageRows.push(`| ${cell(page)} | ${cell(verdict)} |`);
        }

        continue;
    }

    if (line.startsWith('# ') || line.startsWith('## ')) {
        page = null;
        headers = null;
        continue;
    }

    if (page === null || !line.startsWith('|')) {
        headers = line.trim() === '' ? null : headers;
        continue;
    }

    const cells = line
        .slice(1, line.lastIndexOf('|'))
        .split(/(?<!\\)\|/)
        .map((text) => text.trim());

    if (headers === null) {
        headers = cells;
        continue;
    }

    if (cells.every((text) => /^:?-+:?$/.test(text))) {
        continue;
    }

    if (!/^(action|control|shortcut|key|ui|element|feature|capability|step)\b/i.test(headers[0])) {
        continue;
    }

    let key = `${page} :: ${cells[0]}`;

    for (let copy = 2; seenActions.has(key); copy++) {
        key = `${page} :: ${cells[0]} (${copy})`;
    }

    seenActions.add(key);

    const written = ruling('action', key);

    if (written === null) {
        holes.push(`action ${key}: no ruling`);
    }

    actionRows.push(
        `| ${cell(page)} | ${cell(key.slice(page.length + 4))} | ${cell(cells[1] ?? '')} | ${cell(written ?? 'HOLE: no ruling')} |`,
    );
}

/* Features of the spec (§8) */

const spec = readFileSync(
    join(root, 'docs/superpowers/specs/2026-10-01-front-rewrite-design.md'),
    'utf8',
);
const parity = spec.slice(
    spec.indexOf('\n## 8. Feature parity'),
    spec.indexOf('\n## 9. '),
);
const featureRows = [];

for (const [, bullet] of parity.matchAll(/^- (.+)$/gm)) {
    const colon = bullet.indexOf(': ');
    const area = colon === -1 ? '' : bullet.slice(0, colon);
    const items = bullet
        .slice(colon === -1 ? 0 : colon + 2)
        .replace(/\.$/, '')
        .split(/,\s*(?![^()]*\))/);

    for (const item of items) {
        const key = area === '' ? item.trim() : `${area}: ${item.trim()}`;
        const written = ruling('feature', key);

        if (written === null) {
            holes.push(`feature ${key}: no ruling`);
        }

        featureRows.push(`| ${cell(key)} | ${cell(written ?? 'HOLE: no ruling')} |`);
    }
}

/* Files of the old front end */

const fileRows = [];
const seenFiles = new Set();

for (const line of readFileSync(join(research, 'inventory-components.md'), 'utf8').split('\n')) {
    const entry = line.match(/^- `(resources\/js\/[\w./-]+\.(?:tsx|ts))`/);

    if (!entry || seenFiles.has(entry[1])) {
        continue;
    }

    seenFiles.add(entry[1]);

    const exists = existsSync(join(root, entry[1]));
    const written = ruling('file', entry[1]);
    const verdict = written ?? (exists ? 'HOLE: still present, no ruling' : 'HOLE: deleted, no ruling');

    if (verdict.startsWith('HOLE')) {
        holes.push(`file ${entry[1]}: ${verdict}`);
    }

    fileRows.push(`| ${cell(entry[1])} | ${exists ? 'present' : 'deleted'} | ${cell(verdict)} |`);
}

const unusedRulings = [...rulings.keys()].filter((key) => !usedRulings.has(key));

for (const key of unusedRulings) {
    rulingProblems.push(`parity-rulings.tsv has a ruling for an unknown row: ${key.replace('\t', ' ')}`);
}

const document = [
    '# Front-end rewrite: parity table',
    '',
    'Generated by `node bin/front-parity.mjs`; do not edit. Verdicts written by hand live in `parity-rulings.tsv`.',
    '',
    `Rows: ${routeRows.length} routes, ${pageRows.length} pages, ${actionRows.length} actions, ${featureRows.length} features, ${fileRows.length} files. Holes: ${holes.length}.`,
    '',
    '## Routes',
    '',
    '| Method and URI | Name | Callers before (route-callers.tsv) | Callers now | Verdict |',
    '|---|---|---|---|---|',
    ...routeRows,
    '',
    '## Pages',
    '',
    '| Page | Verdict |',
    '|---|---|',
    ...pageRows,
    '',
    '## Actions (inventory-pages.md)',
    '',
    '| Page | Action | Control before | Verdict |',
    '|---|---|---|---|',
    ...actionRows,
    '',
    '## Features (spec §8)',
    '',
    '| Feature | Verdict |',
    '|---|---|',
    ...featureRows,
    '',
    '## Files of the old front end (inventory-components.md)',
    '',
    '| File | Now | Verdict |',
    '|---|---|---|',
    ...fileRows,
    '',
].join('\n');

writeFileSync(output, document);

console.log(
    `${routeRows.length} routes, ${pageRows.length} pages, ${actionRows.length} actions, ${featureRows.length} features, ${fileRows.length} files; ${holes.length} holes; ${rulingProblems.length} ruling problems.`,
);

for (const line of [...rulingProblems, ...(check ? holes : holes.slice(0, 20))]) {
    console.log(line);
}

process.exit(check && holes.length + rulingProblems.length > 0 ? 1 : 0);
```

- [ ] **Step 2: First run, to get the list of rows**

```bash
chmod +x bin/front-parity.mjs
vendor/bin/sail artisan route:list --json > "$LEDGER/reports/routes.json"
node bin/front-parity.mjs "$LEDGER/reports/routes.json"
sed -n 5p docs/superpowers/research/front-rewrite/parity.md
```

Expected: one line such as `Rows: 3xx routes, 32 pages, 560 actions, 76 features, 365 files. Holes: <n>.` The action, feature and file rows are all holes at this point (no ruling yet); route and page rows are holes only where the code does not prove them.

- [ ] **Step 3: Route and page holes**

```bash
node bin/front-parity.mjs "$LEDGER/reports/routes.json" --check | grep -E "^(route|page) "
```

For each line:

| Hole | Ruling |
|---|---|
| `had a front caller, has none` | Find how the new front end reaches the route (`grep -rn "<last URI segment>" resources/js`). Reached through a URL the server sends in props: `kept: <file that uses the prop>`. Not reached: the feature is lost — stop, it is an 18e defect to fix before this plan ends, or a `gap:` only if the 18e report already records it with the owner's decision. |
| `the route no longer exists` | Only B1, B10 and the items of spec §9 may remove or rename a route: `changed: <the file that calls the new route>`. Anything else: stop and report. |
| `page file gone` | `moved: <new page file>` when the page was renamed by a spec item; otherwise stop and report. |

Routes with `no front caller before or after` and `new route, no front caller` are not holes: the inventory lists why (IdP callbacks, webhooks, server-built URLs).

- [ ] **Step 4: Action and feature rows**

One agent per screen group of spec §7, each with the inventory section of its pages, the parity table of that screen in the 18e report, and the new code. For every row the script lists for its pages (`node bin/front-parity.mjs "$LEDGER/reports/routes.json" --check | grep "^action <page>"`), it writes one ruling line. The key is the text after `action ` and before `: no ruling`, copied exactly.

```text
action	auth/login.tsx :: Show/hide password	kept: resources/js/pages/auth/login.tsx, PasswordField toggle; tests/Browser/Walkthroughs/Plan04RetroCoreTest.php
action	welcome.tsx :: External links "Documentation", "Laracasts", "Deploy now"	gap: starter-kit links; no landing page is built, `/` redirects (owner, BLOCK-3; spec B32)
feature	Retro: presentation mode	kept: resources/js/components/retro/presentation-overlay.tsx; tests/Browser/Walkthroughs/Plan07BoardEngagementTest.php
```

The lines above show the format; the paths are those of the tree at that time. An agent does not copy the 18e table on trust: for each `kept:` or `changed:` it opens the file it names and finds the control (its accessible name, its `data-test`, its handler), and names the browser test that exercises it when one does. A row whose control it cannot find is not ruled `kept`: it is reported to the controller, which decides between a fix (the feature is lost: 18e defect) and a `gap:` (the mockup or the backlog of spec §10 removes it; the reason says which).

The 76 feature rows of spec §8 are ruled the same way, by the agent of the screen that owns the feature.

- [ ] **Step 5: File rows**

Every file of `inventory-components.md` gets a ruling. Most are mechanical; generate them, then correct by hand:

```bash
node -e '
const fs = require("fs");
const inventory = fs.readFileSync("docs/superpowers/research/front-rewrite/inventory-components.md", "utf8");
const seen = new Set();
for (const [, file] of inventory.matchAll(/^- `(resources\/js\/[\w./-]+\.(?:tsx|ts))`/gm)) {
    if (seen.has(file)) continue;
    seen.add(file);
    const ruling = fs.existsSync(file)
        ? `kept: ${file}`
        : "gap: FILL — deleted; name what replaces it (moved: <file>) or why nothing does";
    console.log(`file\t${file}\t${ruling}`);
}
' >> docs/superpowers/research/front-rewrite/parity-rulings.tsv
grep -c "FILL" docs/superpowers/research/front-rewrite/parity-rulings.tsv
```

Each `FILL` line is rewritten: `moved: resources/js/components/skrum/<component>.tsx` (or the container that took over) when the 18e report or `git log --diff-filter=D --follow` shows what replaced the file; `gap: starter kit, nothing replaces it` for the starter-kit files; `gap: <reason>` for a feature removed with the owner's decision. No file of the table is an old view component any more: Task 4 rewrote or deleted them. A row whose file Task 4 deleted reads `moved: <the library component or container that took over>`, from `$LEDGER/reports/rewrites/`.

```bash
grep -c "FILL" docs/superpowers/research/front-rewrite/parity-rulings.tsv
```

Expected: `0`.

- [ ] **Step 6: The check passes**

```bash
node bin/front-parity.mjs "$LEDGER/reports/routes.json" --check; echo "exit $?"
sed -n 5p docs/superpowers/research/front-rewrite/parity.md
grep -c "| gap:" docs/superpowers/research/front-rewrite/parity.md
```

Expected: `exit 0`, `Holes: 0.`, and the number of gaps, which goes in the final report with the list (`grep "| gap:" parity.md`). The script also refuses a ruling for a row that does not exist and a ruling that names a missing file.

- [ ] **Step 7: Format, lint, commit**

```bash
npm run check:fix && npm run check
git add bin/front-parity.mjs docs/superpowers/research/front-rewrite/parity-rulings.tsv docs/superpowers/research/front-rewrite/parity.md
git commit -m "docs(front): parity table of the rewrite, generated from the inventories and checked"
```

If `npm run check` reformats or flags the script, run Step 6 again after the fix.

---

### Task 11: Acceptance sweep, final gates, review, report and close-out

**Files:**
- Create (untracked): `$LEDGER/reports/final-report.md`
- Create: `/Users/aritti/.claude/projects/-Users-aritti-Projects-skrum/memory/plan-18-front-rewrite.md`
- Modify: `/Users/aritti/.claude/projects/-Users-aritti-Projects-skrum/memory/MEMORY.md`

**Interfaces:**
- Consumes: everything above.
- Produces: the final report, the memory entry, the closed ledger. No merge, no push.

- [ ] **Step 1: All gates on the final tree**

```bash
npm run build:front
npm run types:check
npm run check
npm run test
vendor/bin/sail artisan test --parallel --processes=8 --compact
vendor/bin/sail composer lint:check
vendor/bin/sail composer types:check
vendor/bin/sail composer rector:check
bin/test-browser
node bin/front-unused.mjs; echo "unused exit $?"
node bin/front-old-components.mjs "$(cat "$LEDGER/base-18e")"; echo "old components exit $?"
grep -c "| open |" docs/superpowers/research/front-rewrite/fidelity.md
vendor/bin/sail artisan route:list --json > "$LEDGER/reports/routes.json"
node bin/front-parity.mjs "$LEDGER/reports/routes.json" --check; echo "parity exit $?"
git status --short | wc -l
```

Expected: every command exits 0 (PHPStan and Rector: no finding that was not in the baseline of Task 1); `bin/test-browser` ends with `Total: PASS, <n> passed, 0 failed, 4 shards`, with `<n>` at least the baseline plus the tests of Tasks 8 and 9; `unused exit 0`; `old components exit 0`; `0` open lines in the fidelity report; `parity exit 0`; the last count is `0` (`parity.md` regenerated identical, no capture changed by the run). A capture that changed during the suite is a real difference: look at it before committing it.

- [ ] **Step 2: The acceptance criteria of spec §13, one by one**

Write the table in the final report, with the evidence of this run:

| AC | Evidence to record |
|---|---|
| 1 Every page, new layout, 1440/390, light/dark, four languages, no overflow | `tests/Arch/FrontEndPagesTest.php` passed; number of captures (`ls tests/visual/__screenshots__ | wc -l`). Captures are FR and EN (spec §4, confirmed by the owner on 2026-10-02); ES and DE are covered by `TranslationKeysTest` only: say so. |
| 2 Every action has a control | `parity.md`: rows, holes 0, gaps listed |
| 3 Browser suite passes; changed tests justified | The `bin/test-browser` total; `git log --oneline main..HEAD -- tests/Browser/Walkthroughs tests/Browser/Smoke` for the 18e–18g range, each changed test with its mockup reason from the 18e report |
| 4 All gates | Step 1 |
| 5 The grep | Task 6 Step 4, run again now |
| 6 `npx knip` reports nothing | Task 5 Step 6: the one run of `npx --yes knip@6.39.0` (not installed), `$LEDGER/reports/knip-classified.txt`: `to resolve: 0`; the findings left are the exports and prop types of `components/ui` and `components/skrum`, reported and kept as the public surface of the library (their count), and the files kept for their test. `bin/front-unused.mjs` exit code and its eleven counts on the final tree are the cross-check. Say plainly that `knip` does not print an empty report: it prints the kept list. |
| 7 No starter-kit file | Task 5 Step 5, run again now |
| 7b No import of an old view component remains (owner, 2026-10-02) | `node bin/front-old-components.mjs "$(cat "$LEDGER/base-18e")"` on the final tree: `Old view components a page still reaches (0)`, exit 0; the `notViews` exemptions, each with its reason; the number of components rewritten, replaced and composed (`ls "$LEDGER/reports/rewrites" | wc -l`) |
| 7c No unapproved deviation from the mockups remains (owner, 2026-10-02) | Task 8: `docs/superpowers/research/front-rewrite/deviations.md`, every line with one of the allowed reasons or "backlog" or "owner"; `docs/superpowers/research/front-rewrite/fidelity.md` with no line left `open`; `tests/Arch/FrontEndPagesTest.php` `has a mockup comparison for every page` passed |
| 8 No `sk-*`, no `_preview-bundle.css` | Task 6 Step 4 |
| 9 A retro runs Writing → Completed with a member and a guest in two browsers, without reload | `grep -rnE "RetroPhase::(Actions|Roti)|'actions'|'roti'" tests/Browser/Walkthroughs | head` shows the walkthrough that 18e extended for B1; name the test and its result in this run. If no browser test walks the nine phases with a guest page open, stop: it is a deliverable of 18e (B1), not written here. |
| 10 Brand contrast, Branding screen | `tests/Unit/Branding/BrandPaletteTest.php` and `tests/Browser/Walkthroughs/Plan18dBrandingTest.php` passed |
| 11 Avatars and GIFs served by the application | `grep -rn "api.dicebear.com\|tenor.googleapis\|api.giphy.com" resources/js` prints nothing; the feature tests of `tests/Feature/Avatars` passed |
| 12 Reduced motion | Task 9: the motion test on every page, the Vitest files, the reduced-motion block of the agent's checklist report (`not checked` lines named) |
| 13 §9 items covered; B12 and B13 security review | The 18f report |

- [ ] **Step 3: Whole-branch review**

One reviewer on the most capable model, read-only, with the diff `git diff <base of plan-18g-cleanup>..HEAD` and this plan. It checks, in this order: a deleted file or key that something still names (Review Focus 1 and 2); ten rewrites of Task 4 sampled against their old file (`git show <base>:<path>`): every state, callback and browser hook of the old component is in the new one (Review Focus 6); twenty lines of `fidelity.md` marked `same` or `fixed`, at least two per screen group, checked against the capture and the mockup picture, and every line of `deviations.md` checked against the three allowed reasons (Review Focus 7); an exemption in `FrontEndRuleExemptions`, `DynamicTranslationSources`, `PagesWithoutCapture` or `data-focus-mark-ok` whose reason does not hold; a `kept:` ruling of `parity-rulings.tsv` sampled against the code (twenty rows at random, at least two per screen group); a rule or accessibility fix that changed behaviour. It does not run the browser or feature suites.

One fix wave for its findings, then Step 1 again, then a re-review limited to the fixes.

- [ ] **Step 4: Final report**

`$LEDGER/reports/final-report.md`, in this order (spec §12, end-of-phase report):

1. **Done** — one line per task, with the commit range and the numbers: files deleted (`wc -l < $LEDGER/reports/deleted-files.txt`), lines removed (`git diff --shortstat <base>..HEAD -- resources/js resources/css lang`), exports removed, translation keys removed, packages removed, tests added (Arch, Feature, Browser), captures taken.
2. **Mockup fidelity** — the numbers of `fidelity.md` (pages compared, lines `same`, fixed, deviations, owner answers, backlog; `open` must be 0), the deviations table of `deviations.md` in full with the sentence "each line carries one of the allowed reasons; the owner's approval of this table is what turns it from recorded to approved", the browser tests changed because a mockup imposed it (test, old and new assertion, mockup line), and every `gap:` line of `parity.md`, grouped by screen.
3. **Old features verified** — the parity counts (routes, pages, actions, features), the acceptance table of Step 2, the accessibility checklist report of Task 9 Step 5 (`$LEDGER/reports/accessibility.md`, copied in full), introduced by the sentence that it was run by an agent driving Chrome and that no real screen reader was used.
4. **Code deleted and rewritten** — the old view components of Task 4, one line each from `rewrites/*.md` (replaced by a library component, rewritten in place, or composed from primitives), with the count and the proof that none is left; the groups of Task 3, the CSS, keys and packages of Task 5; the package declared (`@testing-library/user-event` 14.6.7, Task 1); and what was not deleted: files reached only by a test, old files still in use, each with its reason, and the library exports and prop types that `knip` reports and that stay exported as public surface (count, and the list in `knip-classified.txt`).
5. **Missing tokens or components** — sizes added to `@theme`, files that needed a rule exemption, components composed from primitives because the design system has none (from the 18e report).
6. **Backlog** — spec §10 unchanged, plus what this phase adds: the open questions below, the checklist lines that are a finding or `not checked`, a pass with a real screen reader (VoiceOver or NVDA), which no agent can do.
7. **Decisions taken for the owner** — every ruling line of the ledger.
8. **What waits for the owner** — review of this report and of the accessibility report, approval of the deviations table (and a decision on any mockup element left without data, if Task 8 stopped on one), approval to delete the tests of unreachable code, a screen-reader pass by a person, the merge into `main`, the push.

- [ ] **Step 5: Memory and ledger close-out**

Write `/Users/aritti/.claude/projects/-Users-aritti-Projects-skrum/memory/plan-18-front-rewrite.md` with the front matter the other memory files use (`name`, `description`, `metadata` with `node_type: memory`, `type: project`, `originSessionId`, `modified`) and a body that says: the spec and the seven plans; the branch chain and the head commit of `plan-18g-cleanup`; that nothing is merged into `main` and nothing is pushed; the final numbers of the gates; where the report and the parity table are; what waits for the owner (the list of point 8); the commands that are easy to get wrong (`npm run build:front` before a type check, single browser file on port 8098, `node bin/front-unused.mjs`, `node bin/front-parity.mjs <routes.json> --check`).

Add one line to `MEMORY.md`, after the plan 17 line:

```markdown
- [Plan 18 front-end rewrite](plan-18-front-rewrite.md) — 18a–18g built on `plan-18g-cleanup`, not merged, not pushed; report and parity table ready for the owner
```

Close the ledger: append to `$LEDGER/progress.md` the final gate numbers, the head commit (`git rev-parse --short HEAD`), and the line `Stop line: no merge into main and no push without the owner.`

```bash
git status --short | wc -l
git log --oneline -1
git branch --show-current
```

Expected: `0`, the last commit of this plan, `plan-18g-cleanup`. The run ends here.

---

## Owner answers (2026-10-02) and what is still open

Answered, and applied in the tasks named:

| Was question | Answer | Where |
|---|---|---|
| 9. Old view components still imported after 18e | Second round: they are rewritten in this plan; none remains at the end. | Task 4; acceptance 7b in Task 11. |
| (standing rule) | The mockup must be faithfully respected; allowed deviations only for something false or unsafe, an accessibility rule, or data the product does not have at all, each listed with its reason. | Global Constraints; Task 4 Step 6; Task 8 Step 7; acceptance 7c in Task 11. |
| 1. `knip` (AC6) | `knip` through a one-off `npx`, not installed. | Task 5 Step 6; the home-made script stays as the cross-check and as the tool of every gate. |
| 2. `@testing-library/user-event` | Declare it as a dev dependency. | Task 1 Step 4, at 14.6.7, the version already resolved. |
| 4. Library exports | Follows from the `knip` answer: the exports and prop types of `components/ui` and `components/skrum` that nobody imports (224 before 18e) are reported by `knip` and by the script, and kept exported as the public surface of the library. | Task 3 Step 5 (kept), Task 5 Step 6 (classified), final report point 4. |
| 5. Capture languages | FR and EN. | Task 8. |
| 8. Accessibility checklist | Run by an agent with a real browser; the owner reads the report. No real screen reader is used, and the report says so. | Task 9 Step 5. |

Still open:

1. **Unreachable code kept for its test.** Before 18e the script lists four such files (`layouts/skrum/auth-layout.tsx`, `onboarding-layout.tsx`, `session-layout.tsx`, `lib/brand.ts`); 18e should bring them into use. Whatever is still in that state at the end needs a yes or no to delete the file with its test.
2. **Does 18e add a capture per screen under the name `<component with dashes>-page`?** This plan works either way, but if 18e uses other names the coverage test will ask for a second set: the 18e plan should use this convention, or this plan's `captureName()` should follow 18e's.
3. **AC9 walkthrough.** This plan expects 18e to extend the phase walkthrough to Actions and ROTI with a guest page open (B1). If the 18e plan does not include it, it has to be added there, or here once the labels of the rewritten phase controls are known.
4. **A mockup element that needs data the server does not give.** Task 8 stops on such a page instead of leaving the element out or building back end here. If it happens, the owner chooses: a back-end task (18e or 18f reopened), the backlog, or a deviation.
5. **A pass with a real screen reader.** The agent's checklist proves the live regions exist and change once; what VoiceOver or NVDA says is not verified by any plan of the rewrite. A person has to do it, or it stays in the backlog.
6. **AC6 wording.** The spec says "`npx knip` reports nothing"; with the library's public surface kept, `knip` reports that list and nothing else. Either the spec line is amended to "nothing but the library's exported prop types", or the `export` keywords are removed there too (the bench and the containers that type against them would then import nothing less, but the library would stop documenting its props).
