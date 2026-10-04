import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(
    __dirname,
    '../../../../node_modules/@excalidraw/excalidraw',
);
const script = readFileSync(resolve(root, 'dist/dev/index.js'), 'utf8');
const styles = readFileSync(resolve(root, 'dist/dev/index.css'), 'utf8');
const chunks = readdirSync(resolve(root, 'dist/dev'))
    .filter((name) => /^chunk-.*\.js$/.test(name))
    .map((name) => readFileSync(resolve(root, 'dist/dev', name), 'utf8'))
    .join('\n');
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
        '{ className: "App-toolbar-content", children: [',
        '"excalidraw--mobile": this.device.editor.isMobile',
        'appState.openMenu === "shape" && !appState.viewModeEnabled',
        '"data-testid": "button-undo"',
        '"data-testid": "button-redo"',
        'excalidraw excalidraw-container',
        'event[KEYS.CTRL_OR_CMD] && (event.key === KEYS.BACKSPACE || event.key === KEYS.DELETE)',
        'editorJotaiStore.set(activeConfirmDialogAtom, "clearCanvas")',
    ])('still renders %s', (needle) => {
        expect(script).toContain(needle);
    });

    it('still names the sidebar and the tab of its canvas search', () => {
        expect(chunks).toContain('var CANVAS_SEARCH_TAB = "search";');
        expect(chunks).toMatch(/var DEFAULT_SIDEBAR = \{\s*name: "default"/);
    });

    it('still wraps the field of its canvas search in the class "Find on canvas" focuses', () => {
        expect(chunks).toContain(
            'SEARCH_MENU_INPUT_WRAPPER: "layer-ui__search-inputWrapper"',
        );
    });

    it('still styles the zoom group the CSS hides', () => {
        expect(styles).toContain('.zoom-actions');
    });
});
