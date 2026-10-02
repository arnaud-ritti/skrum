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

const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

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
    .sort(byCodeUnit)
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
    const stylesheet = readFileSync(
        join(root, 'resources/css/app.css'),
        'utf8',
    );
    const owned = [
        stylesheet.startsWith(reference)
            ? stylesheet.slice(reference.length)
            : stylesheet,
        ...readdirSync(join(root, 'resources/css'))
            .filter((name) => name !== 'app.css' && name.endsWith('.css'))
            .map((name) =>
                readFileSync(join(root, 'resources/css', name), 'utf8'),
            ),
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
            haystack.includes(utility) || stylesheet.split(property).length > 2;

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
        undeclaredPackages:
            'Imported packages that package.json does not declare',
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
