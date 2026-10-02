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
const [base] = process.argv
    .slice(2)
    .filter((argument) => !argument.startsWith('--'));

if (base === undefined) {
    console.error(
        'usage: node bin/front-old-components.mjs <base commit> [--json]',
    );
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
const notViews = new Map([
    [
        'resources/js/components/poker/auto-reveal-triggers.tsx',
        'timers and one request of the poker room; it returns null',
    ],
    [
        'resources/js/components/retro/board-context.tsx',
        'context of the retro board: a provider around its children, no element of its own',
    ],
]);

/**
 * Files that existed before the screen rewrite, are still untouched, render
 * markup, and were read in plan 18g: each one is already drawn with the
 * library and its tokens, so there is nothing to rewrite. Each entry carries
 * what it stands on. Its Vitest file holds its states.
 */
const alreadyOnLibrary = new Map([
    [
        'resources/js/components/about/about-content.tsx',
        'written in plan 18d on Card and Badge, for the About page',
    ],
    [
        'resources/js/components/breadcrumbs.tsx',
        'themed in plan 18a on the Breadcrumb primitive; the topbar of the library mounts it',
    ],
    [
        'resources/js/components/dev/bench.tsx',
        'the bench of the design system itself (plans 18a to 18d)',
    ],
    [
        'resources/js/components/integrations/share/delivery-lines.tsx',
        'a polite list on the muted and destructive tokens, slotted into ShareDialog; the library has no component for it',
    ],
    [
        'resources/js/components/language-switcher.tsx',
        'a Select of the library and one request',
    ],
    [
        'resources/js/components/retro/results/health-radar.tsx',
        'radar drawn by hand on the chart tokens, mounted by 18e as the children of HealthCheckResults',
    ],
]);

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
        readFileSync(join(root, path), 'utf8').replace(
            /<[A-Z]\w*(?:,\s*\w+)*>\(/g,
            '(',
        ),
    );

const candidates = git(
    'ls-tree',
    '-r',
    '--name-only',
    base,
    '--',
    'resources/js/components',
    'resources/js/layouts',
)
    .split('\n')
    .filter((path) => path.endsWith('.tsx') && !path.endsWith('.test.tsx'))
    .filter((path) => !libraryFolders.some((folder) => path.startsWith(folder)))
    .filter((path) => existsSync(join(root, path)) && !notReached.has(path));

const untouched = candidates.filter(
    (path) => git('log', '--oneline', `${base}..HEAD`, '--', path) === '',
);

const importersOf = (path) => {
    const module = `@/${path.replace(/^resources\/js\//, '').replace(/\.tsx$/, '')}`;
    const found = spawnSync(
        'git',
        ['grep', '-lF', `'${module}'`, '--', 'resources/js'],
        {
            cwd: root,
            encoding: 'utf8',
        },
    ).stdout;

    return found
        .split('\n')
        .filter(
            (file) =>
                file !== '' && !/\.test\.tsx?$/.test(file) && file !== path,
        );
};

const old = untouched
    .filter((path) => !notViews.has(path) && !alreadyOnLibrary.has(path))
    .filter(rendersMarkup)
    .map((path) => ({ path, importers: importersOf(path) }));
const headless = untouched.filter(
    (path) => !notViews.has(path) && !rendersMarkup(path),
);
const staleExemptions = [...notViews.keys(), ...alreadyOnLibrary.keys()].filter(
    (path) => !untouched.includes(path),
);

const report = {
    old,
    headless,
    exempt: [...notViews],
    alreadyOnLibrary: [...alreadyOnLibrary],
    staleExemptions,
};

if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
} else {
    console.log(
        `\n## Old view components a page still reaches (${old.length})`,
    );

    for (const { path, importers } of old) {
        console.log(
            `${path} — imported by: ${importers.join(', ') || '(a relative import: git grep the file name)'}`,
        );
    }

    console.log(
        `\n## Untouched files without markup, to classify by reading (${headless.length})`,
    );

    for (const path of headless) {
        console.log(path);
    }

    console.log(`\n## Exempt: not a view (${notViews.size})`);

    for (const [path, reason] of notViews) {
        console.log(`${path} — ${reason}`);
    }

    console.log(
        `\n## Read in plan 18g: already on the library (${alreadyOnLibrary.size})`,
    );

    for (const [path, reason] of alreadyOnLibrary) {
        console.log(`${path} — ${reason}`);
    }

    console.log(
        `\n## Exemptions that no longer apply (${staleExemptions.length})`,
    );

    for (const path of staleExemptions) {
        console.log(path);
    }
}

process.exit(old.length > 0 || staleExemptions.length > 0 ? 1 : 0);
