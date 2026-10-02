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
import {
    existsSync,
    readFileSync,
    readdirSync,
    statSync,
    writeFileSync,
} from 'node:fs';
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

const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
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

    return callers.sort(byCodeUnit);
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
        rulingProblems.push(
            `parity-rulings.tsv:${index + 1} is not "kind<TAB>key<TAB>kept:|changed:|moved:|gap: text"`,
        );
        continue;
    }

    if (!ruling.startsWith('gap:')) {
        const files =
            ruling.match(/(?:resources|tests|app|routes)\/[\w./-]+\.\w+/g) ??
            [];

        if (files.length === 0) {
            rulingProblems.push(
                `parity-rulings.tsv:${index + 1} names no file`,
            );
        }

        for (const file of files) {
            if (!existsSync(join(root, file))) {
                rulingProblems.push(
                    `parity-rulings.tsv:${index + 1} names ${file}, which does not exist`,
                );
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

const cell = (text) =>
    String(text).replaceAll('|', '\\|').replaceAll('\n', ' ');
const holes = [];

/* Routes */

const before = new Map();

for (const line of readFileSync(
    join(research, 'route-callers.tsv'),
    'utf8',
).split('\n')) {
    if (line.trim() === '') {
        continue;
    }

    const [method, uri, name, action, callers] = line.split('\t');

    before.set(`${method} ${uri}`, {
        method,
        uri,
        name,
        action,
        callers: callers ?? '',
    });
}

const now = new Map(
    JSON.parse(readFileSync(routesFile, 'utf8')).map((route) => [
        `${route.method} ${route.uri}`,
        { ...route, name: route.name ?? '' },
    ]),
);

const routeRows = [];

for (const key of [...new Set([...before.keys(), ...now.keys()])].sort(
    byCodeUnit,
)) {
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

const inventory = readFileSync(
    join(research, 'inventory-pages.md'),
    'utf8',
).split('\n');
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

    if (
        !/^(action|control|shortcut|key|ui|element|feature|capability|step)\b/i.test(
            headers[0],
        )
    ) {
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

        featureRows.push(
            `| ${cell(key)} | ${cell(written ?? 'HOLE: no ruling')} |`,
        );
    }
}

/* Files of the old front end */

const fileRows = [];
const seenFiles = new Set();

for (const line of readFileSync(
    join(research, 'inventory-components.md'),
    'utf8',
).split('\n')) {
    const entry = line.match(/^- `(resources\/js\/[\w./-]+\.(?:tsx|ts))`/);

    if (!entry || seenFiles.has(entry[1])) {
        continue;
    }

    seenFiles.add(entry[1]);

    const exists = existsSync(join(root, entry[1]));
    const written = ruling('file', entry[1]);
    const verdict =
        written ??
        (exists
            ? 'HOLE: still present, no ruling'
            : 'HOLE: deleted, no ruling');

    if (verdict.startsWith('HOLE')) {
        holes.push(`file ${entry[1]}: ${verdict}`);
    }

    fileRows.push(
        `| ${cell(entry[1])} | ${exists ? 'present' : 'deleted'} | ${cell(verdict)} |`,
    );
}

const unusedRulings = [...rulings.keys()].filter(
    (key) => !usedRulings.has(key),
);

for (const key of unusedRulings) {
    rulingProblems.push(
        `parity-rulings.tsv has a ruling for an unknown row: ${key.replace('\t', ' ')}`,
    );
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

for (const line of [
    ...rulingProblems,
    ...(check ? holes : holes.slice(0, 20)),
]) {
    console.log(line);
}

process.exit(check && holes.length + rulingProblems.length > 0 ? 1 : 0);
