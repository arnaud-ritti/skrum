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
        'resources/js/lib/whiteboard/palette.ts' => 'Excalidraw stores a colour as hex in the scene',
        'resources/js/lib/games/drawing.ts' => 'pixels of the drawing canvas',
        'resources/js/lib/whiteboard/presence-slot.ts' => 'the Excalidraw canvas draws the cursors itself: it takes a colour value computed from the presence token, not a class',
        'resources/js/pages/dev/sections/session-create-whiteboard.tsx' => 'scene colours of the template previews on the bench: canvas data, as the server sends them',
    ],
    'px' => [
        'resources/js/pages/dev/sections/notifications-panel.tsx' => 'a bench label names a viewport width',
        'resources/js/components/session/session-presence.tsx' => 'media query of the sm breakpoint, read by matchMedia: a breakpoint has no token',
        'resources/js/components/whiteboard/board-header.tsx' => 'media queries of the md and 2xl breakpoints, read by matchMedia: a breakpoint has no token',
    ],
    'inline-svg' => [
        'resources/js/components/skrum/skrum-logo.tsx' => 'the Skrüm logo, drawn from the brand files',
        'resources/js/components/skrum/empty-state.tsx' => 'illustration of the design system',
        'resources/js/components/skrum/icebreaker-game-card.tsx' => 'illustration of the design system',
        'resources/js/components/skrum/mood-trend-chart.tsx' => 'chart drawn by hand on the chart tokens',
        'resources/js/components/skrum/roti-trend-card.tsx' => 'line chart of the ROTI trend, drawn by hand on the chart tokens',
        'resources/js/components/skrum/stat-card.tsx' => 'sparkline of the stat card',
        'resources/js/components/skrum/timer.tsx' => 'progress ring of the timer',
        'resources/js/components/skrum/live-cursor.tsx' => 'cursor arrow coloured per participant',
        'resources/js/components/skrum/action-item.tsx' => 'status glyph filled with the status tokens, kept from the reviewed 18c component',
        'resources/js/components/auth/error-art.tsx' => 'illustration of the error pages, drawn on the tokens',
        'resources/js/components/games/hangman-figure.tsx' => 'the hangman drawing, one stroke per wrong guess, on the tokens',
        'resources/js/components/retro/results/health-radar.tsx' => 'radar of the health check, drawn by hand on the chart tokens',
        'resources/js/components/retro/results/health-trend.tsx' => 'trend line of the health check, drawn by hand on the chart tokens',
        'resources/js/components/teams/whiteboard-template-preview.tsx' => 'preview of a whiteboard template, drawn from the shapes of its scene',
        'resources/js/pages/dev/sections/settings-account.tsx' => 'stand-in on the bench for the QR code Fortify sends as SVG markup',
    ],
    'scripted-motion' => [
        'resources/js/components/session/session-reactions.tsx' => 'live-reactions animates with its own stylesheet, which holds a reaction in place under prefers-reduced-motion',
        'resources/js/components/session/use-flying-reactions.ts' => 'state of the flying reactions only; live-reactions animates with its own stylesheet, which honours prefers-reduced-motion',
    ],
];

/**
 * Old files that break a rule and are about to be deleted: the action items page, the old application shell it is the
 * last page to mount, the old auth layout and the old bell, which the last screens of plans 18e and 18f replace.
 * To empty in the final pass of plan 18g, with the constant. A listed file is not read for that rule; nothing is added here.
 */
const FrontEndRuleBaseline = [
    'arbitrary-size' => [
        'resources/js/components/notification-bell.tsx',
    ],
    'colour' => [
        'resources/js/components/action-items/external-link-chips.tsx',
        'resources/js/components/action-items/priority-select.tsx',
        'resources/js/components/app-logo.tsx',
        'resources/js/components/nav-main.tsx',
        'resources/js/components/notification-bell.tsx',
        'resources/js/layouts/auth/auth-simple-layout.tsx',
    ],
    'px' => [
        'resources/js/components/notification-bell.tsx',
    ],
    'inline-svg' => [
        'resources/js/components/app-logo-icon.tsx',
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
    $baseline = FrontEndRuleBaseline[$rule] ?? [];
    $offences = [];

    foreach ($sources as $path => $source) {
        if (isset($exempt[$path])) {
            continue;
        }

        if (in_array($path, $baseline, true)) {
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

it('keeps the baseline sorted, and apart from the exemptions', function () {
    foreach (FrontEndRuleBaseline as $rule => $files) {
        $sorted = $files;
        sort($sorted);

        expect($files)->toBe($sorted)
            ->and(array_values(array_intersect($files, array_keys(FrontEndRuleExemptions[$rule] ?? []))))->toBe([]);
    }
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
    'web animation without the preference' => ['scripted-motion', 'node.animate([{ opacity: 0 }, { opacity: 1 }], 300);'],
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
