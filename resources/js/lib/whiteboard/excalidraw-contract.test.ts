import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(
    __dirname,
    '../../../../node_modules/@excalidraw/excalidraw',
);
const script = readFileSync(resolve(root, 'dist/dev/index.js'), 'utf8');
const styles = readFileSync(resolve(root, 'dist/dev/index.css'), 'utf8');
const version = JSON.parse(
    readFileSync(resolve(root, 'package.json'), 'utf8'),
).version;

describe('Excalidraw contract of the whiteboard chrome', () => {
    it('is the pinned version', () => {
        expect(version).toBe('0.18.1');
    });

    it.each([
        'App-toolbar-container',
        'layer-ui__wrapper__footer-left',
        'layer-ui__wrapper__footer-right',
        'undo-redo-buttons',
        'main-menu-trigger',
        'selected-shape-actions',
        'App-bottom-bar',
        '"data-testid": "button-undo"',
        '"data-testid": "button-redo"',
        'excalidraw excalidraw-container',
    ])('still renders %s', (needle) => {
        expect(script).toContain(needle);
    });

    it('still styles the zoom group the CSS hides', () => {
        expect(styles).toContain('.zoom-actions');
    });
});
