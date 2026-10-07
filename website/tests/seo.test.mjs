import assert from 'node:assert/strict';
import { test } from 'node:test';
import { seoProblems } from '../scripts/check.mjs';

for (const address of ['https://example.org/skrum/', 'https://skrum.example.org/']) {
    test(`accepts metadata and sitemap under ${address}`, () => {
        const site = new URL(address);
        const path = `${site.pathname}docs/`;
        const canonical = new URL(path, site).href;
        const html = `<link rel="canonical" href="${canonical}"><meta property="og:image" content="${address}og-image.png"><meta name="twitter:card" content="summary_large_image">`;

        assert.deepEqual(seoProblems(new Map([[path, html]]), site, `<url><loc>${canonical}</loc></url>`), []);
    });
}

test('reports a canonical on the wrong domain, missing sitemap entry and missing social preview', () => {
    const pages = new Map([['/skrum/', '<link rel="canonical" href="https://wrong.example/">']]);

    assert.deepEqual(seoProblems(pages, new URL('https://example.org/skrum/'), ''), [
        '/skrum/: missing or incorrect canonical URL',
        '/skrum/: must appear once in the sitemap',
        '/skrum/: missing social image or large Twitter card',
    ]);
});

test('excludes the error page from indexing and the sitemap', () => {
    const site = new URL('https://example.org/skrum/');
    const pages = new Map([['/skrum/404.html', '<meta name="robots" content="noindex, follow">']]);

    assert.deepEqual(seoProblems(pages, site, ''), []);
    assert.deepEqual(seoProblems(pages, site, '<loc>https://example.org/skrum/404.html</loc>'), [
        '/skrum/404.html: a noindex page is in the sitemap',
    ]);
});
