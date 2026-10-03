import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCanvasSnapshot } from '@/hooks/use-canvas-snapshot';
import type { ExcalidrawImperativeAPI } from '@/lib/whiteboard/excalidraw';
import { sceneStamp } from '@/lib/whiteboard/scene-stamp';
import type { SceneElement } from '@/lib/whiteboard/types';

vi.mock('@/lib/whiteboard/scene-stamp', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('@/lib/whiteboard/scene-stamp')>();

    return { ...actual, sceneStamp: vi.fn(actual.sceneStamp) };
});

type ChangeListener = (
    elements: readonly SceneElement[],
    appState: Record<string, unknown>,
) => void;

function element(id: string, version = 1, isDeleted = false): SceneElement {
    return { id, type: 'rectangle', version, versionNonce: 7, isDeleted };
}

function appState(overrides: Record<string, unknown> = {}) {
    return {
        activeTool: { type: 'selection' },
        selectedElementIds: {},
        editingTextElement: null,
        selectedElementsAreBeingDragged: false,
        isResizing: false,
        isRotating: false,
        newElement: null,
        openDialog: null,
        viewModeEnabled: false,
        penMode: false,
        penDetected: false,
        currentItemBackgroundColor: 'transparent',
        currentItemStrokeColor: '#1e1e1e',
        scrollX: 10,
        scrollY: 20,
        zoom: { value: 1.5 },
        width: 800,
        height: 600,
        ...overrides,
    };
}

function fakeApi(elements: SceneElement[] = [element('a')]) {
    const listeners: ChangeListener[] = [];
    const unsubscribe = vi.fn();
    const api = {
        onChange: vi.fn((listener: ChangeListener) => {
            listeners.push(listener);

            return unsubscribe;
        }),
        getSceneElementsIncludingDeleted: vi.fn(() => elements),
        getAppState: vi.fn(() => appState()),
    };

    return {
        api: api as unknown as ExcalidrawImperativeAPI,
        unsubscribe,
        emit(next: SceneElement[], state: Record<string, unknown>) {
            listeners.forEach((listener) => listener(next, state));
        },
    };
}

describe('useCanvasSnapshot', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.stubGlobal('requestAnimationFrame', (run: FrameRequestCallback) =>
            setTimeout(() => run(performance.now()), 16),
        );
        vi.stubGlobal('cancelAnimationFrame', (frame: number) =>
            clearTimeout(frame),
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('is null while there is no api', () => {
        const { result } = renderHook(() => useCanvasSnapshot(null));

        expect(result.current).toBeNull();
    });

    it('reads the first snapshot from the api as soon as it is set', () => {
        const fake = fakeApi([element('a'), element('b', 3)]);

        const { result } = renderHook(() => useCanvasSnapshot(fake.api));

        expect(result.current?.elements.map(({ id }) => id)).toEqual([
            'a',
            'b',
        ]);
        expect(result.current?.view).toEqual({
            scrollX: 10,
            scrollY: 20,
            zoom: 1.5,
            width: 800,
            height: 600,
        });
        expect(result.current?.appState.activeTool).toEqual({
            type: 'selection',
        });
    });

    it('turns several changes inside one frame into one state, the last one', () => {
        const fake = fakeApi();
        let renders = 0;
        const { result } = renderHook(() => {
            renders += 1;

            return useCanvasSnapshot(fake.api);
        });
        const rendersBefore = renders;

        act(() => {
            fake.emit([element('x')], appState({ scrollX: 1 }));
            fake.emit([element('y')], appState({ scrollX: 2 }));
            fake.emit([element('z')], appState({ scrollX: 3 }));
        });

        expect(renders).toBe(rendersBefore);
        expect(result.current?.view.scrollX).toBe(10);

        act(() => {
            vi.advanceTimersByTime(16);
        });

        expect(renders).toBe(rendersBefore + 1);
        expect(result.current?.elements.map(({ id }) => id)).toEqual(['z']);
        expect(result.current?.view.scrollX).toBe(3);
    });

    it('stamps the scene with sceneStamp', () => {
        const fake = fakeApi([element('a', 2)]);
        const { result } = renderHook(() => useCanvasSnapshot(fake.api));

        expect(result.current?.stamp).toBe(sceneStamp([element('a', 2)]));

        const next = [element('a', 3), element('b', 1, true)];

        act(() => {
            fake.emit(next, appState());
            vi.advanceTimersByTime(16);
        });

        expect(result.current?.stamp).toBe(sceneStamp(next));
    });

    it('stamps the scene once per frame, not on every change', () => {
        const fake = fakeApi();

        renderHook(() => useCanvasSnapshot(fake.api));
        vi.mocked(sceneStamp).mockClear();

        act(() => {
            fake.emit([element('x')], appState());
            fake.emit([element('y')], appState());
            fake.emit([element('z')], appState());
        });

        expect(sceneStamp).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(16);
        });

        expect(sceneStamp).toHaveBeenCalledOnce();
    });

    it('unsubscribes and cancels a pending frame on unmount', () => {
        const fake = fakeApi();
        const { result, unmount } = renderHook(() =>
            useCanvasSnapshot(fake.api),
        );
        const before = result.current;

        act(() => {
            fake.emit([element('late')], appState());
        });
        unmount();

        expect(fake.unsubscribe).toHaveBeenCalledOnce();
        expect(vi.getTimerCount()).toBe(0);
        expect(result.current).toBe(before);
    });
});
