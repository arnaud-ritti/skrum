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
