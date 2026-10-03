import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setSingleKeyShortcuts } from '@/lib/shortcuts/preference';
import { useCanvasKeyGuard } from './use-canvas-key-guard';

describe('useCanvasKeyGuard', () => {
    let wrapper: HTMLDivElement;
    let canvas: HTMLDivElement;
    let editor: HTMLTextAreaElement;
    const reached = vi.fn();

    const press = (target: Element, init: KeyboardEventInit): boolean => {
        const event = new KeyboardEvent('keydown', {
            bubbles: true,
            cancelable: true,
            ...init,
        });

        target.dispatchEvent(event);

        return event.defaultPrevented;
    };

    beforeEach(() => {
        wrapper = document.createElement('div');
        canvas = document.createElement('div');
        editor = document.createElement('textarea');
        wrapper.append(canvas, editor);
        document.body.append(wrapper);
        document.addEventListener('keydown', reached);

        renderHook(() => useCanvasKeyGuard({ current: wrapper }));
    });

    afterEach(() => {
        document.removeEventListener('keydown', reached);
        wrapper.remove();
        reached.mockReset();
        setSingleKeyShortcuts(true);
    });

    it('lets a single key reach the canvas while the preference is on', () => {
        press(canvas, { key: 'r' });

        expect(reached).toHaveBeenCalledTimes(1);
    });

    it('swallows a single key while the preference is off', () => {
        setSingleKeyShortcuts(false);

        press(canvas, { key: 'r' });
        press(canvas, { key: 'R', shiftKey: true });
        press(canvas, { key: '1' });

        expect(reached).not.toHaveBeenCalled();
    });

    it('never prevents the default of a swallowed key', () => {
        setSingleKeyShortcuts(false);

        expect(press(canvas, { key: 'r' })).toBe(false);
    });

    it('lets named keys, combinations and typing through while the preference is off', () => {
        setSingleKeyShortcuts(false);

        press(canvas, { key: 'Enter' });
        press(canvas, { key: 'Escape' });
        press(canvas, { key: ' ' });
        press(canvas, { key: 'z', ctrlKey: true });
        press(canvas, { key: 'z', metaKey: true });
        press(canvas, { key: 'r', altKey: true });
        press(editor, { key: 'r' });

        expect(reached).toHaveBeenCalledTimes(7);
    });

    it('leaves keys pressed outside the canvas alone', () => {
        setSingleKeyShortcuts(false);

        press(document.body, { key: 'r' });

        expect(reached).toHaveBeenCalledTimes(1);
    });
});
