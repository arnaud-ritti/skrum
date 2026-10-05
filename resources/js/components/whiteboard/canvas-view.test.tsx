import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasView } from '@/components/whiteboard/canvas-view';
import type {
    CanvasAppState,
    CanvasSnapshot,
} from '@/hooks/use-canvas-snapshot';
import { useWhiteboardFollow } from '@/hooks/use-whiteboard-follow';
import type { WhisperChannel } from '@/lib/realtime/whisper-transport';
import { setSingleKeyShortcuts } from '@/lib/shortcuts/preference';
import { POSTIT } from '@/lib/whiteboard/palette';
import {
    fromMinimap,
    minimapFrame,
    minimapItems,
    toMinimap,
} from '@/lib/whiteboard/minimap';
import type { MinimapElement } from '@/lib/whiteboard/minimap';
import {
    MaxZoom,
    MinZoom,
    centredOn,
    pannedBy,
    steppedZoom,
    visibleArea,
    zoomAroundCentre,
} from '@/lib/whiteboard/viewport';
import type { CanvasView as View } from '@/lib/whiteboard/viewport';
import { renderWithProviders } from '@/test/render';

vi.mock('@/lib/whiteboard/minimap', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('@/lib/whiteboard/minimap')>();

    return { ...actual, minimapItems: vi.fn(actual.minimapItems) };
});

type ScrollListener = (
    scrollX: number,
    scrollY: number,
    zoom: { value: number },
) => void;

const MinimapKey = 'skrum.whiteboardMinimap';
const DefaultView: View = {
    scrollX: 0,
    scrollY: 0,
    zoom: 1,
    width: 1000,
    height: 600,
};

function fakeApi(
    elements: unknown[] = [{ id: 'a' }],
    initialView: View = DefaultView,
) {
    const scrollListeners: ScrollListener[] = [];
    const state = { ...initialView };

    return {
        scrollListeners,
        updateScene: vi.fn(
            (scene: {
                appState?: {
                    scrollX?: number;
                    scrollY?: number;
                    zoom?: { value: number };
                };
            }) => {
                const appState = scene.appState;

                if (appState?.scrollX === undefined) {
                    return;
                }

                state.scrollX = appState.scrollX;
                state.scrollY = appState.scrollY ?? state.scrollY;
                state.zoom = appState.zoom?.value ?? state.zoom;
                scrollListeners.forEach((listener) =>
                    listener(state.scrollX, state.scrollY, {
                        value: state.zoom,
                    }),
                );
            },
        ),
        scrollToContent: vi.fn(),
        getSceneElements: vi.fn(() => elements),
        getAppState: vi.fn(() => ({
            scrollX: state.scrollX,
            scrollY: state.scrollY,
            zoom: { value: state.zoom },
            width: state.width,
            height: state.height,
        })),
        onScrollChange: vi.fn((listener: ScrollListener) => {
            scrollListeners.push(listener);

            return () => {
                scrollListeners.splice(scrollListeners.indexOf(listener), 1);
            };
        }),
    };
}

type FakeApi = ReturnType<typeof fakeApi>;

function snapshotWith({
    elements = [],
    view = {},
    stamp = 'stamp-1',
}: {
    elements?: MinimapElement[];
    view?: Partial<View>;
    stamp?: string;
} = {}): CanvasSnapshot {
    return {
        elements: elements as never,
        appState: {
            activeTool: { type: 'selection', customType: null, locked: false },
            selectedElementIds: {},
            viewModeEnabled: false,
        } as unknown as CanvasAppState,
        view: { ...DefaultView, ...view },
        stamp,
    };
}

function setScreen({
    wide = true,
    reducedMotion = false,
}: { wide?: boolean; reducedMotion?: boolean } = {}): void {
    window.matchMedia = (query: string) =>
        ({
            matches: query.includes('min-width')
                ? wide
                : query.includes('reduce') && reducedMotion,
            media: query,
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
            dispatchEvent: () => false,
        }) as MediaQueryList;
}

function Board({
    api,
    snapshot,
    editing = true,
    history = { undo: false, redo: true },
    children,
}: {
    api: FakeApi;
    snapshot: CanvasSnapshot;
    editing?: boolean;
    history?: { undo: boolean; redo: boolean };
    children?: ReactNode;
}) {
    const canvas = useRef<HTMLDivElement>(null);

    return (
        <>
            <div ref={canvas} data-testid="canvas" tabIndex={-1}>
                <div className="excalidraw-container">
                    <button
                        type="button"
                        data-testid="button-undo"
                        disabled={!history.undo}
                    />
                    <button
                        type="button"
                        data-testid="button-redo"
                        disabled={!history.redo}
                    />
                    <textarea
                        data-testid="wysiwyg"
                        className="excalidraw-wysiwyg"
                    />
                    <div role="dialog" aria-label="Library dialog">
                        <button type="button">Inside the dialog</button>
                    </div>
                </div>
                <CanvasView
                    api={api as never}
                    snapshot={snapshot}
                    canvas={canvas}
                    editing={editing}
                />
            </div>
            <input data-testid="outside-field" />
            {children}
        </>
    );
}

function renderView(
    api: FakeApi,
    snapshot = snapshotWith(),
    props: {
        editing?: boolean;
        history?: { undo: boolean; redo: boolean };
    } = {},
) {
    return renderWithProviders(
        <Board api={api} snapshot={snapshot} {...props} />,
    );
}

function control(name: string): HTMLButtonElement {
    return screen.getByRole('button', { name }) as HTMLButtonElement;
}

function lastViewPatch(api: FakeApi) {
    const [scene] = api.updateScene.mock.lastCall as [
        {
            appState: {
                scrollX: number;
                scrollY: number;
                zoom: { value: number };
            };
        },
    ];

    return {
        scrollX: scene.appState.scrollX,
        scrollY: scene.appState.scrollY,
        zoom: scene.appState.zoom.value,
    };
}

const Elements: MinimapElement[] = [
    {
        id: 'sticky',
        type: 'rectangle',
        x: 100,
        y: 100,
        width: 200,
        height: 200,
        backgroundColor: POSTIT.sun.bg,
    },
    {
        id: 'shape',
        type: 'ellipse',
        x: 600,
        y: 400,
        width: 100,
        height: 80,
        backgroundColor: 'transparent',
    },
];

beforeEach(() => {
    setScreen();
    window.localStorage.removeItem(MinimapKey);
    vi.mocked(minimapItems).mockClear();
});

afterEach(() => {
    setSingleKeyShortcuts(true);
});

describe('CanvasView', () => {
    it('zooms in and out by a step around the centre of the view', () => {
        const api = fakeApi();

        renderView(api);

        fireEvent.click(control('Zoom in'));
        expect(lastViewPatch(api)).toEqual(zoomAroundCentre(DefaultView, 1.1));

        const zoomedIn = { ...DefaultView, ...lastViewPatch(api) };

        fireEvent.click(control('Zoom out'));
        expect(lastViewPatch(api)).toEqual(
            zoomAroundCentre(zoomedIn, steppedZoom(zoomedIn.zoom, -1)),
        );
    });

    it('zooms two steps on two presses inside one frame', () => {
        const api = fakeApi();

        renderView(api);

        fireEvent.click(control('Zoom in'));
        const afterFirst = { ...DefaultView, ...lastViewPatch(api) };

        fireEvent.click(control('Zoom in'));

        expect(afterFirst.zoom).toBeCloseTo(1.1);
        expect(lastViewPatch(api)).toEqual(
            zoomAroundCentre(afterFirst, steppedZoom(afterFirst.zoom, 1)),
        );
    });

    it('disables Zoom in at the largest zoom and Zoom out at the smallest', () => {
        const api = fakeApi();
        const { rerender } = renderView(
            api,
            snapshotWith({ view: { zoom: MaxZoom } }),
        );

        expect(control('Zoom in').getAttribute('aria-disabled')).toBe('true');
        expect(control('Zoom out').getAttribute('aria-disabled')).toBe(null);

        rerender(
            <Board
                api={api}
                snapshot={snapshotWith({ view: { zoom: MinZoom } })}
            />,
        );

        expect(control('Zoom in').getAttribute('aria-disabled')).toBe(null);
        expect(control('Zoom out').getAttribute('aria-disabled')).toBe('true');
    });

    it('resets the zoom to 100 % around the centre from the percentage', () => {
        const view = { ...DefaultView, zoom: 2.5, scrollX: -40, scrollY: 30 };
        const api = fakeApi([{ id: 'a' }], view);

        renderView(api, snapshotWith({ view }));
        fireEvent.click(control('Reset zoom to 100 %'));

        expect(lastViewPatch(api)).toEqual(zoomAroundCentre(view, 1));
    });

    it('fits every live element to the screen, without animation under reduced motion', () => {
        const api = fakeApi([{ id: 'a' }, { id: 'b' }]);

        renderView(api);
        fireEvent.click(control('Fit to screen'));

        expect(api.scrollToContent).toHaveBeenLastCalledWith(
            [{ id: 'a' }, { id: 'b' }],
            { fitToViewport: true, viewportZoomFactor: 0.9, animate: true },
        );

        setScreen({ reducedMotion: true });
        fireEvent.click(control('Fit to screen'));

        expect(api.scrollToContent).toHaveBeenLastCalledWith(
            [{ id: 'a' }, { id: 'b' }],
            { fitToViewport: true, viewportZoomFactor: 0.9, animate: false },
        );
    });

    it('does nothing on Fit to screen when the board is empty', () => {
        const api = fakeApi([]);

        renderView(api);
        fireEvent.click(control('Fit to screen'));

        expect(api.scrollToContent).not.toHaveBeenCalled();
        expect(api.updateScene).not.toHaveBeenCalled();
    });

    it('opens the minimap by default and remembers its toggle in the browser', () => {
        const api = fakeApi();
        const { unmount } = renderView(api);

        expect(screen.getByRole('img', { name: 'Minimap' })).toBeTruthy();
        expect(control('Minimap').getAttribute('aria-pressed')).toBe('true');

        fireEvent.click(control('Minimap'));

        expect(screen.queryByRole('img', { name: 'Minimap' })).toBeNull();
        expect(window.localStorage.getItem(MinimapKey)).toBe('false');

        unmount();
        renderView(api);

        expect(screen.queryByRole('img', { name: 'Minimap' })).toBeNull();
        expect(control('Minimap').getAttribute('aria-pressed')).toBe('false');
    });

    it('has neither minimap nor its toggle below lg', () => {
        setScreen({ wide: false });
        renderView(fakeApi());

        expect(screen.queryByRole('img', { name: 'Minimap' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Minimap' })).toBeNull();
        expect(control('Fit to screen')).toBeTruthy();
    });

    it('draws the live elements and the visible area, recomputed only when the scene changes', () => {
        const api = fakeApi();
        const snapshot = snapshotWith({ elements: Elements });
        const { container, rerender } = renderView(api, snapshot);

        const items = minimapItems(Elements);
        const frame = minimapFrame(items, visibleArea(DefaultView), {
            width: 180,
            height: 112,
        });
        const shapes = container.querySelectorAll<HTMLElement>(
            '[data-slot="whiteboard-minimap-shape"]',
        );
        const viewFrame = control('Move the view');
        const expectedView = toMinimap(visibleArea(DefaultView), frame);
        const expectedSticky = toMinimap(items[0].rect, frame);

        expect(shapes).toHaveLength(2);
        expect(shapes[0].className).toContain('bg-skrum-col-sun');
        expect(shapes[1].className).toContain('bg-muted-foreground/50');
        expect(parseFloat(shapes[0].style.left)).toBeCloseTo(expectedSticky.x);
        expect(parseFloat(shapes[0].style.width)).toBeCloseTo(
            expectedSticky.width,
        );
        expect(parseFloat(viewFrame.style.left)).toBeCloseTo(expectedView.x);
        expect(parseFloat(viewFrame.style.height)).toBeCloseTo(
            expectedView.height,
        );

        vi.mocked(minimapItems).mockClear();
        rerender(
            <Board
                api={api}
                snapshot={{ ...snapshot, view: { ...DefaultView, scrollX: 5 } }}
            />,
        );

        expect(minimapItems).not.toHaveBeenCalled();

        rerender(
            <Board api={api} snapshot={{ ...snapshot, stamp: 'stamp-2' }} />,
        );

        expect(minimapItems).toHaveBeenCalledTimes(1);
    });

    it('draws only the visible area on an empty board', () => {
        const { container } = renderView(fakeApi(), snapshotWith());

        expect(
            container.querySelectorAll(
                '[data-slot="whiteboard-minimap-shape"]',
            ),
        ).toHaveLength(0);
        expect(control('Move the view')).toBeTruthy();
    });

    it('centres the view on a press in the minimap, and pans with the arrows on its frame', () => {
        const api = fakeApi();
        const snapshot = snapshotWith({ elements: Elements });

        renderView(api, snapshot);

        const minimap = document.querySelector<HTMLElement>(
            '[data-slot="whiteboard-minimap"]',
        )!;

        minimap.getBoundingClientRect = () =>
            ({ left: 10, top: 20, width: 180, height: 112 }) as DOMRect;
        fireEvent.pointerDown(minimap, {
            button: 0,
            pointerId: 1,
            clientX: 60,
            clientY: 50,
        });

        const frame = minimapFrame(
            minimapItems(Elements),
            visibleArea(DefaultView),
            { width: 180, height: 112 },
        );

        expect(lastViewPatch(api)).toEqual(
            centredOn(DefaultView, fromMinimap({ x: 50, y: 30 }, frame)),
        );

        const centred = { ...DefaultView, ...lastViewPatch(api) };

        fireEvent.pointerUp(minimap, { pointerId: 1 });
        fireEvent.keyDown(control('Move the view'), { key: 'ArrowRight' });

        expect(lastViewPatch(api)).toEqual(pannedBy(centred, 0.1, 0));
    });

    it('keeps the frame of the minimap still while its view is dragged', () => {
        const api = fakeApi();
        const elements = [Elements[0]];
        const { rerender } = renderView(api, snapshotWith({ elements }));
        const minimap = (): HTMLElement =>
            document.querySelector<HTMLElement>(
                '[data-slot="whiteboard-minimap"]',
            )!;
        const centreX = (): number => {
            const patch = lastViewPatch(api);

            return -patch.scrollX + DefaultView.width / patch.zoom / 2;
        };
        const followView = (): void => {
            rerender(
                <Board
                    api={api}
                    snapshot={snapshotWith({
                        elements,
                        view: lastViewPatch(api),
                    })}
                />,
            );
            minimap().getBoundingClientRect = () =>
                ({ left: 0, top: 0, width: 180, height: 112 }) as DOMRect;
        };
        const frame = minimapFrame(
            minimapItems(elements),
            visibleArea(DefaultView),
            { width: 180, height: 112 },
        );

        minimap().getBoundingClientRect = () =>
            ({ left: 0, top: 0, width: 180, height: 112 }) as DOMRect;
        fireEvent.pointerDown(minimap(), {
            button: 0,
            pointerId: 1,
            clientX: 170,
            clientY: 56,
        });
        followView();
        fireEvent.pointerMove(minimap(), {
            pointerId: 1,
            clientX: 171,
            clientY: 56,
        });
        const first = centreX();

        followView();
        fireEvent.pointerMove(minimap(), {
            pointerId: 1,
            clientX: 172,
            clientY: 56,
        });

        expect(centreX() - first).toBeCloseTo(1 / frame.scale);

        fireEvent.pointerUp(minimap(), { pointerId: 1 });
    });

    it('undoes and redoes through the hidden buttons of the library, enabled as they are', async () => {
        const api = fakeApi();

        renderView(api);

        const undo = control('Undo');
        const redo = control('Redo');
        const nativeRedo = screen.getByTestId('button-redo');
        const redoClicks = vi.fn();

        nativeRedo.addEventListener('click', redoClicks);

        expect(undo.disabled).toBe(true);
        expect(redo.disabled).toBe(false);

        fireEvent.click(redo);
        expect(redoClicks).toHaveBeenCalledTimes(1);

        act(() => {
            screen.getByTestId('button-undo').removeAttribute('disabled');
            nativeRedo.setAttribute('disabled', '');
        });

        await waitFor(() => expect(control('Undo').disabled).toBe(false));
        expect(control('Redo').disabled).toBe(true);
    });

    it('shows the history only while editing, and the zoom bar always', () => {
        renderView(fakeApi(), snapshotWith(), { editing: false });

        expect(screen.queryByRole('toolbar', { name: 'History' })).toBeNull();
        expect(screen.getByRole('toolbar', { name: 'Zoom' })).toBeTruthy();
    });

    it('toggles the minimap with M while the canvas or a bar has the focus', () => {
        renderView(fakeApi());

        fireEvent.keyDown(screen.getByTestId('canvas'), { key: 'm' });
        expect(screen.queryByRole('img', { name: 'Minimap' })).toBeNull();

        fireEvent.keyDown(control('Zoom in'), { key: 'm' });
        expect(screen.getByRole('img', { name: 'Minimap' })).toBeTruthy();
    });

    it('answers M neither in the text editor, a field, a dialog, outside the canvas, nor when single keys are off', () => {
        renderView(fakeApi());

        fireEvent.keyDown(screen.getByTestId('wysiwyg'), { key: 'm' });
        fireEvent.keyDown(screen.getByTestId('outside-field'), { key: 'm' });
        fireEvent.keyDown(
            screen.getByRole('button', { name: 'Inside the dialog' }),
            { key: 'm' },
        );
        fireEvent.keyDown(document.body, { key: 'm' });

        setSingleKeyShortcuts(false);
        fireEvent.keyDown(screen.getByTestId('canvas'), { key: 'm' });

        expect(screen.getByRole('img', { name: 'Minimap' })).toBeTruthy();
    });

    it('pauses a follower who zooms from the bar', () => {
        const api = fakeApi();
        const listeners: ((
            data: unknown,
            metadata?: { user_id?: string },
        ) => void)[] = [];
        const presence: WhisperChannel = {
            whisper: vi.fn(),
            listen: vi.fn((_event, callback) => {
                listeners.push(callback);
            }),
            stopListening: vi.fn(),
        };
        const seen: { paused: boolean } = { paused: false };

        function Follower() {
            const { paused } = useWhiteboardFollow({
                api: api as never,
                presence,
                enabled: true,
                leading: false,
                facilitatorId: 'facilitator',
            });

            seen.paused = paused;

            return null;
        }

        renderWithProviders(
            <Board api={api} snapshot={snapshotWith()}>
                <Follower />
            </Board>,
        );

        act(() => {
            listeners.forEach((listener) =>
                listener(
                    { x: 0, y: 0, width: 1000, height: 600 },
                    { user_id: 'facilitator' },
                ),
            );
        });

        expect(seen.paused).toBe(false);

        act(() => {
            fireEvent.click(control('Zoom in'));
        });

        expect(seen.paused).toBe(true);
    });
});
