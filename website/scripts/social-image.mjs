import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = new URL('../', import.meta.url);
const font = (name) => readFileSync(new URL(`node_modules/@fontsource-variable/${name}/files/${name}-latin-wght-normal.woff2`, root)).toString('base64');
const logo = readFileSync(new URL('../public/brand/skrum-logo-horizontal-light.svg', root)).toString('base64');
const browser = await chromium.launch();
try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    await page.setContent(`<!doctype html><html lang="en"><head><meta charset="utf-8"><style>
        @font-face { font-family: Figtree; src: url(data:font/woff2;base64,${font('figtree')}); font-weight:100 900 }
        @font-face { font-family: Bricolage; src: url(data:font/woff2;base64,${font('bricolage-grotesque')}); font-weight:100 900 }
        @font-face { font-family: Mono; src: url(data:font/woff2;base64,${font('jetbrains-mono')}); font-weight:100 900 }
        * { box-sizing:border-box } body { margin:0; width:1200px; height:630px; color:#211a16; font-family:Figtree; background-color:#fbfaf7; background-image:radial-gradient(#dcd6ce 1.2px,transparent 1.2px); background-size:24px 24px; }
        main { padding:60px 64px; display:grid; grid-template-columns:650px 350px; gap:68px; }
        .logo { width:450px; height:auto; display:block; margin-bottom:68px }
        h1 { font-family:Bricolage; font-size:56px; font-weight:800; letter-spacing:-2px; line-height:1.08; margin:0 0 30px; }
        h1 span { color:#bb4d2a } .lead { color:#746c64; font-size:22px; line-height:1.6; margin:0; }
        .badges { display:flex; gap:10px; margin-top:58px; white-space:nowrap; } .badge { font:14px Mono; letter-spacing:1.2px; border-radius:30px; padding:12px 14px; background:#f0eeea; color:#746c64; }
        .badge:first-child { color:#9c381b; background:#f9e7de } .badge:nth-child(2) { color:#286e53; background:#e3f2e9 }
        .card { background:#fff; border:1px solid #e1dbd2; border-radius:12px; box-shadow:0 14px 35px #211a1610; margin-top:68px; padding:24px; height:400px; }
        header { display:flex; justify-content:space-between; align-items:center; padding-bottom:18px; border-bottom:1px solid #e7e1d8 } h2 { font:bold 24px Bricolage; margin:0 } .sprint { font:13px Mono; color:#746c64; background:#f0eeea; border-radius:24px; padding:8px 12px }
        .action { position:relative; padding:22px 0 20px 34px; border-bottom:1px solid #e7e1d8; } .check { position:absolute; left:0; top:23px; width:20px; height:20px; border:1.5px solid #cec6bc; border-radius:6px; } .done { background:#bb4d2a; border-color:#bb4d2a; color:white; font-size:18px; line-height:18px; text-align:center; }
        .row { display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:16px; font-weight:500; } .priority { border-radius:20px; padding:5px 10px; font-size:12px; font-weight:500; background:#f9e7de; color:#9c381b; } .medium { background:#fcf1d4; color:#815b13 } .low { background:#e3f2e9; color:#286e53 } .meta { color:#746c64; font-size:14px; margin-top:7px; } footer { font-size:12px; color:#746c64; padding-top:24px; display:flex; justify-content:space-between; align-items:center; } .dot { width:10px; height:10px; background:#60bd98; border-radius:50%; }
    </style></head><body><main><section><img class="logo" src="data:image/svg+xml;base64,${logo}" alt="Skrüm"><h1>Meetings end,<br><span>actions remain.</span></h1><p class="lead">Retrospectives, planning poker, whiteboard,<br>icebreakers and surveys in one open-source tool<br>you host yourself.</p><div class="badges"><span class="badge">OPEN SOURCE</span><span class="badge">SELF-HOSTED</span><span class="badge">AGPL-3.0</span><span class="badge">LARAVEL · REACT</span></div></section><aside class="card"><header><h2>Actions</h2><span class="sprint">Sprint 42</span></header><div class="action"><span class="check done">✓</span><div class="row">Isolate flaky e2e tests<span class="priority">High</span></div><div class="meta">Lucas D · Oct 10</div></div><div class="action"><span class="check"></span><div class="row">A second CI runner<span class="priority medium">Medium</span></div><div class="meta">Yuki T · Oct 17</div></div><div class="action"><span class="check"></span><div class="row">Meeting-free Thursdays<span class="priority low">Low</span></div><div class="meta">Camille R · Oct 8</div></div><footer>3 actions · 1 done · reminders on<span class="dot"></span></footer></aside></main></body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: fileURLToPath(new URL('public/og-image.png', root)) });
} finally {
    await browser.close();
}
