import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('resources/css/excalidraw-theme.css', 'utf8');

describe('excalidraw theme stylesheet', () => {
    it('overrides the native variables on both themes', () => {
        expect(css).toContain('.excalidraw,\n.excalidraw.theme--dark {');
    });

    it.each([
        ['--color-primary', 'var(--primary)'],
        ['--island-bg-color', 'var(--popover)'],
        ['--default-bg-color', 'var(--skrum-canvas)'],
        ['--button-active-bg', 'var(--skrum-primary-soft)'],
        ['--button-active-border', 'var(--primary)'],
        ['--color-danger', 'var(--destructive)'],
        ['--shadow-island', 'var(--shadow-raised)'],
        ['--ui-font', 'var(--font-sans)'],
    ])('maps %s to %s', (name, token) => {
        expect(css).toContain(`${name}: ${token};`);
    });

    it('contains no literal colour', () => {
        expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
        expect(css).not.toMatch(/\brgba?\(/);
    });

    it('keeps the hand-drawn font of the content untouched', () => {
        expect(css).not.toMatch(/Excalifont|Virgil/);
        expect(css).not.toMatch(/--font-family/);
    });

    it('hides the library tool row of the phone layout under the board chrome', () => {
        expect(css).toMatch(
            /\.skrum-whiteboard--own-chrome\s+\.excalidraw\.excalidraw--mobile\s+\.App-bottom-bar\s+\.App-toolbar-content/,
        );
    });

    it('keeps the closed property panel laid out, so the library measures its opacity slider', () => {
        const closedPanel =
            /\.skrum-whiteboard--own-chrome:not\(\.skrum-whiteboard--styles\)\s+\.excalidraw\s+\.selected-shape-actions\s*\{([^}]*)\}/.exec(
                css,
            );

        expect(closedPanel?.[1]).toContain('visibility: hidden !important;');
        expect(closedPanel?.[1]).not.toContain('display');
        expect(css).toMatch(
            /\.skrum-whiteboard--own-chrome\s+\.excalidraw\s+\.App-menu_top__left\s*\{\s*margin-left:/,
        );
    });
});
