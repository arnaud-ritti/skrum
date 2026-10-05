import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
    CANVAS_LIGHT,
    CanvasBackgrounds,
    POSTIT,
    PostItColors,
    isPostItColor,
    opaqueBackground,
    postItAppState,
    postItFromBackground,
    recolorElements,
    seeThroughBackground,
} from '@/lib/whiteboard/palette';

const appCss = readFileSync('resources/css/app.css', 'utf8');
const lightBlock = appCss.slice(
    appCss.indexOf(':root {'),
    appCss.indexOf('.dark {'),
);

function lightToken(name: string): [number, number, number] {
    const match = lightBlock.match(
        new RegExp(`--${name}:\\s*oklch\\(([\\d.]+) ([\\d.]+) ([\\d.]+)\\)`),
    );

    if (!match) {
        throw new Error(`token ${name} not found`);
    }

    return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function oklchToRgb([l, c, h]: [number, number, number]): number[] {
    const a = c * Math.cos((h * Math.PI) / 180);
    const b = c * Math.sin((h * Math.PI) / 180);
    const l3 = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m3 = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s3 = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const linear = [
        4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
        -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
        -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
    ];

    return linear.map((value) => {
        const clamped = Math.min(Math.max(value, 0), 1);
        const encoded =
            clamped <= 0.0031308
                ? 12.92 * clamped
                : 1.055 * clamped ** (1 / 2.4) - 0.055;

        return Math.round(encoded * 255);
    });
}

function hexToRgb(hex: string): number[] {
    return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
}

function expectClose(hex: string, token: string): void {
    const expected = oklchToRgb(lightToken(token));
    const actual = hexToRgb(hex);

    actual.forEach((channel, index) => {
        expect(Math.abs(channel - expected[index])).toBeLessThanOrEqual(3);
    });
}

describe('post-it palette', () => {
    it('stores literal hex values, never css variables', () => {
        for (const color of PostItColors) {
            expect(POSTIT[color].bg).toMatch(/^#[0-9a-f]{6}$/);
            expect(POSTIT[color].stroke).toMatch(/^#[0-9a-f]{6}$/);
        }
    });

    it('matches the light values of the design tokens', () => {
        for (const color of PostItColors) {
            expectClose(POSTIT[color].bg, `skrum-col-${color}`);
            expectClose(POSTIT[color].stroke, `skrum-col-${color}-border`);
        }
    });

    it('stores the light canvas value as the scene background', () => {
        expectClose(CANVAS_LIGHT, 'skrum-canvas');
    });

    it('recognises a post-it colour name', () => {
        expect(isPostItColor('plum')).toBe(true);
        expect(isPostItColor('purple')).toBe(false);
        expect(isPostItColor(undefined)).toBe(false);
    });

    it('finds a colour from a stored background, ignoring case', () => {
        expect(postItFromBackground('#E1F8DC')).toBe('moss');
        expect(postItFromBackground('#ffffff')).toBeNull();
    });

    it('builds the app state for a new element', () => {
        expect(postItAppState('sky')).toEqual({
            currentItemBackgroundColor: POSTIT.sky.bg,
            currentItemStrokeColor: POSTIT.sky.stroke,
            currentItemFillStyle: 'solid',
        });
    });

    it('recolors only the selected elements and bumps their version', () => {
        const base = {
            version: 3,
            versionNonce: 1,
            backgroundColor: 'transparent',
            strokeColor: '#000000',
            fillStyle: 'hachure',
        };
        const elements = [
            { id: 'a', ...base },
            { id: 'b', ...base },
        ];

        const result = recolorElements(elements, ['b'], 'coral');

        expect(result[0]).toBe(elements[0]);
        expect(result[1].backgroundColor).toBe(POSTIT.coral.bg);
        expect(result[1].strokeColor).toBe(POSTIT.coral.stroke);
        expect(result[1].fillStyle).toBe('solid');
        expect(result[1].version).toBe(4);
        expect(elements[1].backgroundColor).toBe('transparent');
    });
});

describe('canvas backgrounds', () => {
    it('paints the background see-through and gives the colour back whole', () => {
        expect(seeThroughBackground('#f5faff')).toBe('#f5faff00');
        expect(seeThroughBackground('#f5faff00')).toBe('#f5faff00');
        expect(opaqueBackground('#f5faff00')).toBe('#f5faff');
        expect(opaqueBackground('#f5faff')).toBe('#f5faff');
    });

    const dist = 'node_modules/@excalidraw/excalidraw/dist/dev';
    const chunks = readdirSync(dist)
        .filter((name) => /^chunk-.*\.js$/.test(name))
        .map((name) => readFileSync(`${dist}/${name}`, 'utf8'))
        .join('\n');

    it('offers the paper first, then the five picks of the library', () => {
        expect(CanvasBackgrounds.map(({ value }) => value)).toEqual([
            CANVAS_LIGHT,
            '#ffffff',
            '#f8f9fa',
            '#f5faff',
            '#fffce8',
            '#fdf8f6',
        ]);
    });

    it('matches DEFAULT_CANVAS_BACKGROUND_PICKS of the pinned library', () => {
        const picks = chunks.match(
            /var DEFAULT_CANVAS_BACKGROUND_PICKS = \[([\s\S]*?)\];/,
        );

        expect(picks).not.toBeNull();

        const literals = [
            ...(picks?.[1] ?? '').matchAll(/"(#[0-9a-f]{6})"/g),
        ].map((match) => match[1]);

        expect(picks?.[1]).toContain('COLOR_PALETTE.white');
        expect(chunks).toContain('white: "#ffffff"');
        expect(['#ffffff', ...literals]).toEqual(
            CanvasBackgrounds.slice(1).map(({ value }) => value),
        );
    });
});
