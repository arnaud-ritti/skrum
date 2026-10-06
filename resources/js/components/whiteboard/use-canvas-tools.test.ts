import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanvasSnapshot } from '@/hooks/use-canvas-snapshot';
import { useCanvasTools } from './use-canvas-tools';

vi.mock('@/components/whiteboard/sticky-tool', () => ({
    addSticky: vi.fn(),
}));

const singleKeys = vi.hoisted(() => ({ enabled: true }));

vi.mock('@/lib/shortcuts/preference', () => ({
    singleKeyShortcutsEnabled: () => singleKeys.enabled,
}));

const snapshot = {
    elements: [],
    appState: {
        activeTool: { type: 'arrow', customType: null, locked: false },
        viewModeEnabled: false,
    },
    view: { scrollX: 0, scrollY: 0, zoom: 1, width: 1000, height: 600 },
    stamp: 'stamp',
} as unknown as CanvasSnapshot;

/** What the canvas heard, in order: the keys sent to the library and the tools set on it. */
let heard: string[] = [];
let wrapper: HTMLDivElement;
let container: HTMLDivElement;

function fakeApi(drawing: boolean) {
    const state = { multiElement: drawing ? { id: 'arrow' } : null };

    container.addEventListener('keydown', (event) => {
        heard.push(`key:${event.key}`);

        if (event.key === 'Enter') {
            state.multiElement = null;
        }
    });

    return {
        getAppState: vi.fn(() => state),
        setActiveTool: vi.fn((tool: { type: string }) =>
            heard.push(`tool:${tool.type}`),
        ),
        onPointerDown: vi.fn(() => () => {}),
    };
}

function tools(api: ReturnType<typeof fakeApi>) {
    return renderHook(() =>
        useCanvasTools(api as never, snapshot, { current: wrapper }),
    ).result.current;
}

function press(key: string, init: KeyboardEventInit = {}): void {
    container.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, ...init }),
    );
}

beforeEach(() => {
    heard = [];
    singleKeys.enabled = true;
    wrapper = document.createElement('div');
    container = document.createElement('div');
    container.className = 'excalidraw-container';
    wrapper.append(container);
    document.body.append(wrapper);
});

afterEach(() => {
    wrapper.remove();
});

describe('useCanvasTools', () => {
    it('ends the connector in progress before it changes the tool', () => {
        const { choose, setTool } = tools(fakeApi(true));

        choose('shape');

        expect(heard).toEqual(['key:Enter', 'tool:rectangle']);

        heard = [];
        setTool({ type: 'laser' });

        expect(heard).toEqual(['tool:laser']);
    });

    it('does nothing when nothing is being drawn', () => {
        const { choose } = tools(fakeApi(false));

        choose('select');

        expect(heard).toEqual(['tool:selection']);
    });

    it('ends it before the library hears a tool key, which it ignores while a connector is drawn', () => {
        tools(fakeApi(true));

        press('r');

        expect(heard).toEqual(['key:Enter', 'key:r']);
    });

    it.each([
        ['a key that is no tool', 'g', {}],
        ['a tool key with a modifier', 'r', { ctrlKey: true }],
    ])('leaves the connector alone on %s', (_what, key, init) => {
        tools(fakeApi(true));

        press(key, init);

        expect(heard).toEqual([`key:${key}`]);
    });

    it('leaves the connector alone on a tool key when single-key shortcuts are off', () => {
        singleKeys.enabled = false;
        tools(fakeApi(true));

        press('r');

        expect(heard).toEqual(['key:r']);
    });

    it('ends the connector before a sticky note added from the bar takes the selection tool', () => {
        const { addStickyInView } = tools(fakeApi(true));

        expect(addStickyInView('sun')).toBe(true);
        expect(heard).toEqual(['key:Enter', 'tool:selection']);
    });
});
