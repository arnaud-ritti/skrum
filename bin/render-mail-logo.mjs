#!/usr/bin/env node
/**
 * Draws the two PNG logos of the e-mails from the SVG logos, at twice the
 * 28 px they are shown at. Run by hand when the SVG logo changes.
 *
 *   node bin/render-mail-logo.mjs
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const displayHeight = 28;
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });

for (const theme of ['light', 'dark']) {
    const svg = readFileSync(
        join(root, `public/brand/skrum-logo-horizontal-${theme}.svg`),
        'utf8',
    );

    await page.setContent(
        `<body style="margin:0;background:transparent"><div id="logo" style="display:inline-block;height:${displayHeight}px;line-height:0">${svg.replace('<svg', `<svg style="height:${displayHeight}px;width:auto"`)}</div></body>`,
    );
    await page.locator('#logo').screenshot({
        path: join(root, `public/brand/skrum-logo-mail-${theme}.png`),
        omitBackground: true,
    });
}

await browser.close();
