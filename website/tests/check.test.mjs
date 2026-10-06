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
