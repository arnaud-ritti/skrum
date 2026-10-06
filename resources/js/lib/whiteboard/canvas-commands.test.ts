import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    commandEvent,
    finishDrawing,
    isApplePlatform,
    nativeControlEnabled,
    pressNativeControl,
    runCanvasCommand,
} from './canvas-commands';

function canvasWith(markup: string): HTMLElement {
    const canvas = document.createElement('div');

    canvas.innerHTML = markup;
    document.body.append(canvas);

    return canvas;
}

afterEach(() => {
    document.body.innerHTML = '';
});

describe('canvas commands', () => {
    it('reads the platform as the library does', () => {
        expect(isApplePlatform('MacIntel')).toBe(true);
        expect(isApplePlatform('iPhone')).toBe(true);
        expect(isApplePlatform('Win32')).toBe(false);
        expect(isApplePlatform('Linux x86_64')).toBe(false);
    });

    it('sends group with the command key on a Mac and Ctrl elsewhere', () => {
        expect(commandEvent('group', true)).toMatchObject({
            key: 'g',
            metaKey: true,
            ctrlKey: false,
            shiftKey: false,
        });
        expect(commandEvent('group', false)).toMatchObject({
            key: 'g',
            metaKey: false,
            ctrlKey: true,
        });
    });

    it('sends the library keys of every command', () => {
        expect(commandEvent('ungroup', false)).toMatchObject({
            key: 'G',
            ctrlKey: true,
            shiftKey: true,
        });
        expect(commandEvent('alignLeft', false)).toMatchObject({
            key: 'ArrowLeft',
            ctrlKey: true,
            shiftKey: true,
        });
        expect(commandEvent('alignRight', false)).toMatchObject({
            key: 'ArrowRight',
            ctrlKey: true,
            shiftKey: true,
        });
        expect(commandEvent('alignTop', false)).toMatchObject({
            key: 'ArrowUp',
            ctrlKey: true,
            shiftKey: true,
        });
        expect(commandEvent('alignBottom', false)).toMatchObject({
            key: 'ArrowDown',
            ctrlKey: true,
            shiftKey: true,
        });
        expect(commandEvent('distributeHorizontally', false)).toMatchObject({
            code: 'KeyH',
            altKey: true,
            ctrlKey: false,
        });
        expect(commandEvent('distributeVertically', false)).toMatchObject({
            code: 'KeyV',
            altKey: true,
            ctrlKey: false,
        });
        expect(commandEvent('delete', false)).toMatchObject({
            key: 'Delete',
            ctrlKey: false,
            metaKey: false,
        });
        expect(commandEvent('toggleLock', false)).toMatchObject({
            key: 'L',
            ctrlKey: true,
            shiftKey: true,
        });
        expect(commandEvent('clearCanvas', false)).toMatchObject({
            key: 'Delete',
            ctrlKey: true,
            shiftKey: false,
        });
        expect(commandEvent('clearCanvas', true)).toMatchObject({
            key: 'Delete',
            metaKey: true,
            ctrlKey: false,
        });
    });

    it('dispatches the key on the library container, bubbling and cancelable', () => {
        const canvas = canvasWith(
            '<div class="excalidraw excalidraw-container"></div>',
        );
        const container = canvas.querySelector(
            '.excalidraw-container',
        ) as HTMLElement;
        const seen = vi.fn();

        container.addEventListener('keydown', (event) =>
            seen(event.key, event.ctrlKey, event.bubbles, event.cancelable),
        );

        expect(runCanvasCommand(canvas, 'group', 'Win32')).toBe(true);
        expect(seen).toHaveBeenCalledWith('g', true, true, true);
    });

    it('fails soft without the library container, warning once', async () => {
        vi.resetModules();
        const fresh = await import('./canvas-commands');
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        expect(
            fresh.runCanvasCommand(
                canvasWith('<div></div>'),
                'delete',
                'Win32',
            ),
        ).toBe(false);
        expect(fresh.runCanvasCommand(null, 'delete', 'Win32')).toBe(false);
        expect(warn).toHaveBeenCalledTimes(1);

        warn.mockRestore();
    });
});

describe('native controls', () => {
    it('presses the hidden undo button and reads its state', () => {
        const canvas = canvasWith(
            '<button data-testid="button-undo"></button><button data-testid="button-redo" disabled></button>',
        );
        const undo = vi.fn();

        canvas
            .querySelector('[data-testid="button-undo"]')
            ?.addEventListener('click', undo);

        expect(nativeControlEnabled(canvas, 'undo')).toBe(true);
        expect(nativeControlEnabled(canvas, 'redo')).toBe(false);
        expect(pressNativeControl(canvas, 'undo')).toBe(true);
        expect(undo).toHaveBeenCalledOnce();
        expect(pressNativeControl(canvas, 'redo')).toBe(false);
    });

    it('treats a missing control as disabled', () => {
        expect(nativeControlEnabled(canvasWith(''), 'undo')).toBe(false);
        expect(pressNativeControl(canvasWith(''), 'undo')).toBe(false);
    });
});

describe('finishDrawing', () => {
    function heardKeys(canvas: HTMLElement): string[] {
        const keys: string[] = [];

        canvas
            .querySelector('.excalidraw-container')
            ?.addEventListener('keydown', (event) =>
                keys.push((event as KeyboardEvent).key),
            );

        return keys;
    }

    it('ends the connector in progress as Enter does, on the library container', () => {
        const canvas = canvasWith('<div class="excalidraw-container"></div>');
        const keys = heardKeys(canvas);
        const api = { getAppState: () => ({ multiElement: { id: 'arrow' } }) };

        expect(finishDrawing(api as never, canvas)).toBe(true);
        expect(keys).toEqual(['Enter']);
    });

    it('does nothing when nothing is being drawn', () => {
        const canvas = canvasWith('<div class="excalidraw-container"></div>');
        const keys = heardKeys(canvas);

        expect(
            finishDrawing(
                { getAppState: () => ({ multiElement: null }) } as never,
                canvas,
            ),
        ).toBe(false);
        expect(
            finishDrawing(
                {
                    getAppState: () => ({ multiElement: { id: 'arrow' } }),
                } as never,
                null,
            ),
        ).toBe(false);
        expect(keys).toEqual([]);
    });
});
