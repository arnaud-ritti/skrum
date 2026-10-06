import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BoardChrome } from '@/components/whiteboard/board-chrome';
import type {
    CanvasAppState,
    CanvasSnapshot,
} from '@/hooks/use-canvas-snapshot';
import { setSingleKeyShortcuts } from '@/lib/shortcuts/preference';
import { POSTIT } from '@/lib/whiteboard/palette';
import { renderWithProviders } from '@/test/render';

vi.mock('@/lib/whiteboard/excalidraw', () => ({
    CaptureUpdateAction: { IMMEDIATELY: 'IMMEDIATELY', NEVER: 'NEVER' },
    restoreElements: (elements: unknown[]) => elements,
    getCommonBounds: () => [100, 100, 300, 200],
}));

const View = { scrollX: 0, scrollY: 0, zoom: 1, width: 1000, height: 600 };

const Note = {
    id: 'note',
    type: 'rectangle',
    x: 100,
    y: 100,
    width: 200,
    height: 100,
    isDeleted: false,
    locked: false,
    groupIds: [],
    containerId: null,
    backgroundColor: POSTIT.sun.bg,
    strokeColor: POSTIT.sun.stroke,
    fillStyle: 'solid',
    version: 1,
    versionNonce: 1,
};

function snapshotWith(
    selected: string[] = ['note'],
    appState: Partial<CanvasAppState> = {},
): CanvasSnapshot {
    return {
        elements: [Note] as never,
        appState: {
            activeTool: { type: 'selection', customType: null, locked: false },
            selectedElementIds: Object.fromEntries(
                selected.map((id) => [id, true]),
            ),
            editingTextElement: null,
            selectedElementsAreBeingDragged: false,
            isResizing: false,
            isRotating: false,
            newElement: null,
            openDialog: null,
            viewModeEnabled: false,
            penMode: false,
            penDetected: false,
            currentItemBackgroundColor: POSTIT.sun.bg,
            currentItemStrokeColor: POSTIT.sun.stroke,
            viewBackgroundColor: '#ffffff',
            openMenu: null,
            ...appState,
        } as unknown as CanvasAppState,
        view: View,
        stamp: 'stamp',
    };
}

type ChangeListener = (elements: unknown, appState: unknown) => void;

function libraryState(snapshot: CanvasSnapshot) {
    return {
        ...snapshot.appState,
        ...snapshot.view,
        zoom: { value: snapshot.view.zoom },
    };
}

function fakeApi(snapshot: CanvasSnapshot = snapshotWith()) {
    const listeners: ChangeListener[] = [];

    return {
        setActiveTool: vi.fn(),
        updateScene: vi.fn(),
        scrollToContent: vi.fn(),
        getAppState: vi.fn(() => libraryState(snapshot)),
        getSceneElements: vi.fn(() => snapshot.elements),
        getSceneElementsIncludingDeleted: vi.fn(() => snapshot.elements),
        onPointerDown: vi.fn(() => () => {}),
        onScrollChange: vi.fn(() => () => {}),
        onChange: vi.fn((listener: ChangeListener) => {
            listeners.push(listener);

            return () => {};
        }),
        /** What the library reports after one of its updates, flushed with the next frame. */
        report(next: CanvasSnapshot): void {
            act(() => {
                listeners.forEach((listener) =>
                    listener(next.elements, libraryState(next)),
                );
                vi.advanceTimersToNextFrame();
            });
        },
    };
}

function setScreen(wide: boolean): void {
    window.matchMedia = (query: string) =>
        ({
            matches: query.includes('min-width') ? wide : false,
            media: query,
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
            dispatchEvent: () => false,
        }) as MediaQueryList;
}

function renderChrome({
    snapshot = snapshotWith(),
    editing = true,
    withApi = true,
    isPhone = false,
    readMode,
    api = fakeApi(snapshot),
    onBackgroundChange,
    onExport,
}: {
    snapshot?: CanvasSnapshot;
    editing?: boolean;
    withApi?: boolean;
    isPhone?: boolean;
    readMode?: { reading: boolean; onChange: (reading: boolean) => void };
    api?: ReturnType<typeof fakeApi>;
    onBackgroundChange?: (color: string) => void;
    onExport?: () => void;
} = {}) {
    return renderWithProviders(
        <BoardChrome
            api={withApi ? (api as never) : null}
            editing={editing}
            isPhone={isPhone}
            isFacilitator
            readMode={readMode}
            onBackgroundChange={onBackgroundChange}
            onExport={onExport}
        >
            <div data-testid="library-canvas" />
        </BoardChrome>,
    );
}

function toolbar(name: string): HTMLElement | null {
    return screen.queryByRole('toolbar', { name });
}

describe('BoardChrome', () => {
    afterEach(() => {
        vi.useRealTimers();
        localStorage.clear();
    });

    it('shows the tool bar, the selection bar, the history and the zoom bar in edit mode', () => {
        setScreen(true);
        renderChrome();

        expect(toolbar('Tools')).not.toBeNull();
        expect(toolbar('Selection')).not.toBeNull();
        expect(toolbar('History')).not.toBeNull();
        expect(toolbar('Zoom')).not.toBeNull();
        expect(screen.getByRole('img', { name: 'Minimap' })).toBeTruthy();
        expect(screen.getByTestId('library-canvas')).toBeTruthy();
    });

    it('shows only the zoom bar, and the minimap from lg, in view mode', () => {
        setScreen(true);
        const view = renderChrome({ editing: false });

        expect(toolbar('Zoom')).not.toBeNull();
        expect(screen.getByRole('img', { name: 'Minimap' })).toBeTruthy();
        expect(toolbar('Tools')).toBeNull();
        expect(toolbar('Selection')).toBeNull();
        expect(toolbar('History')).toBeNull();

        view.unmount();
        setScreen(false);
        renderChrome({ editing: false });

        expect(toolbar('Zoom')).not.toBeNull();
        expect(screen.queryByRole('img', { name: 'Minimap' })).toBeNull();
    });

    it('holds what floats for the facilitator inside the canvas, before the library and the bars', () => {
        setScreen(true);
        renderWithProviders(
            <BoardChrome
                api={fakeApi() as never}
                editing
                isPhone={false}
                isFacilitator
                facilitation={<button type="button">Lock the board</button>}
            >
                <div data-testid="library-canvas" />
            </BoardChrome>,
        );

        const pill = screen.getByRole('button', { name: 'Lock the board' });
        const canvas = document.querySelector('.whiteboard-canvas');

        expect(canvas?.firstElementChild).toBe(pill);

        for (const later of [
            screen.getByTestId('library-canvas'),
            toolbar('Tools') as HTMLElement,
        ]) {
            expect(
                pill.compareDocumentPosition(later) &
                    Node.DOCUMENT_POSITION_FOLLOWING,
            ).toBeTruthy();
        }
    });

    it('shows no bar while the canvas is loading', () => {
        setScreen(true);
        renderChrome({ withApi: false });

        expect(screen.queryAllByRole('toolbar')).toHaveLength(0);
        expect(screen.getByTestId('library-canvas')).toBeTruthy();
    });

    it('follows the canvas without rendering the library again, and tells the board its background', () => {
        setScreen(true);
        vi.useFakeTimers();
        const onBackgroundChange = vi.fn();
        const library = vi.fn(() => <div data-testid="library-canvas" />);
        function Library() {
            return library();
        }
        const api = fakeApi(snapshotWith([]));

        renderWithProviders(
            <BoardChrome
                api={api as never}
                editing
                isPhone={false}
                isFacilitator
                onBackgroundChange={onBackgroundChange}
            >
                <Library />
            </BoardChrome>,
        );

        expect(toolbar('Selection')).toBeNull();
        expect(onBackgroundChange).toHaveBeenLastCalledWith('#ffffff');

        const rendersBefore = library.mock.calls.length;

        api.report(snapshotWith(['note'], { viewBackgroundColor: '#fdf1c2' }));
        vi.useRealTimers();

        expect(toolbar('Selection')).not.toBeNull();
        expect(onBackgroundChange).toHaveBeenLastCalledWith('#fdf1c2');
        expect(library.mock.calls.length).toBe(rendersBefore);
    });

    it('lays the dot grid on the paper under the see-through canvas, following its scroll and zoom', () => {
        setScreen(true);
        const onBackgroundChange = vi.fn();
        const snapshot = {
            ...snapshotWith([], { viewBackgroundColor: '#f5faff00' }),
            view: { ...View, scrollX: 10, scrollY: -20, zoom: 2 },
        };

        renderChrome({ snapshot, onBackgroundChange });

        const paper = document.querySelector<HTMLElement>(
            '[data-slot="whiteboard-paper"]',
        );

        expect(paper?.className).toContain('bg-dotgrid');
        expect(paper?.style.backgroundColor).toBe('rgb(245, 250, 255)');
        expect(paper?.style.backgroundSize).toBe('40px 40px');
        expect(paper?.style.backgroundPosition).toBe('20px -40px');
        expect(onBackgroundChange).toHaveBeenLastCalledWith('#f5faff');
    });

    it('hides the dots when the zoom packs them too tight', () => {
        setScreen(true);
        const snapshot = {
            ...snapshotWith([], { viewBackgroundColor: '#f5faff00' }),
            view: { ...View, zoom: 0.3 },
        };

        renderChrome({ snapshot });

        expect(
            document.querySelector<HTMLElement>(
                '[data-slot="whiteboard-paper"]',
            )?.style.backgroundImage,
        ).toBe('none');
    });

    it('paints the canvas see-through again when it is opaque without an export dialog', () => {
        setScreen(true);
        const api = fakeApi(
            snapshotWith([], { viewBackgroundColor: '#ffffff' }),
        );

        renderChrome({ api });

        expect(api.updateScene).toHaveBeenCalledWith({
            appState: { viewBackgroundColor: '#ffffff00' },
            captureUpdate: 'NEVER',
        });
    });

    it.each(['copyAsPng', 'copyAsSvg'])(
        'paints the canvas opaque before the canvas menu copies it to the clipboard with %s',
        (action) => {
            setScreen(true);
            const api = fakeApi(
                snapshotWith([], { viewBackgroundColor: '#fdf1c200' }),
            );

            renderChrome({ api });
            api.updateScene.mockClear();
            const entry = document.createElement('li');
            entry.dataset.testid = action;
            entry.append(document.createElement('button'));
            document.body.append(entry);

            fireEvent.click(entry.querySelector('button')!);
            entry.remove();

            expect(api.updateScene).toHaveBeenCalledWith({
                appState: { viewBackgroundColor: '#fdf1c2' },
                captureUpdate: 'NEVER',
            });
        },
    );

    it('paints the canvas opaque before the Shift+Alt+C shortcut copies it to the clipboard', () => {
        setScreen(true);
        const api = fakeApi(
            snapshotWith([], { viewBackgroundColor: '#fdf1c200' }),
        );

        renderChrome({ api });
        api.updateScene.mockClear();

        fireEvent.keyDown(document, {
            code: 'KeyC',
            shiftKey: true,
            altKey: true,
        });

        expect(api.updateScene).toHaveBeenCalledWith({
            appState: { viewBackgroundColor: '#fdf1c2' },
            captureUpdate: 'NEVER',
        });
    });

    it('leaves the canvas see-through on a click outside the copy entries and on other shortcuts', () => {
        setScreen(true);
        const api = fakeApi(
            snapshotWith([], { viewBackgroundColor: '#fdf1c200' }),
        );

        renderChrome({ api });
        api.updateScene.mockClear();

        fireEvent.click(screen.getByTestId('library-canvas'));
        fireEvent.keyDown(document, { code: 'KeyC', altKey: true });

        expect(api.updateScene).not.toHaveBeenCalled();
    });

    it.each(['imageExport', 'jsonExport'])(
        "opens the application's export in place of the library's %s dialog, which its shortcut asks for",
        (name) => {
            setScreen(true);
            const onExport = vi.fn();
            const api = fakeApi(
                snapshotWith([], {
                    viewBackgroundColor: '#ffffff00',
                    openDialog: { name },
                } as Partial<CanvasAppState>),
            );

            renderChrome({ api, onExport });

            expect(api.updateScene).toHaveBeenCalledWith({
                appState: { openDialog: null },
            });
            expect(onExport).toHaveBeenCalledOnce();
            expect(api.updateScene).not.toHaveBeenCalledWith(
                expect.objectContaining({
                    appState: expect.objectContaining({
                        viewBackgroundColor: '#ffffff',
                    }),
                }),
            );
        },
    );

    it('leaves another dialog of the library alone', () => {
        setScreen(true);
        const onExport = vi.fn();
        const api = fakeApi(
            snapshotWith([], {
                viewBackgroundColor: '#ffffff00',
                openDialog: { name: 'help' },
            } as Partial<CanvasAppState>),
        );

        renderChrome({ api, onExport });

        expect(onExport).not.toHaveBeenCalled();
        expect(api.updateScene).not.toHaveBeenCalled();
    });

    it('presses "Styles" on a phone while the library\'s shape menu is open, and not once the library closes it', () => {
        setScreen(false);
        vi.useFakeTimers();
        const api = fakeApi(snapshotWith(['note'], { openMenu: 'shape' }));

        renderChrome({
            isPhone: true,
            readMode: { reading: false, onChange: vi.fn() },
            api,
        });

        const styles = () => screen.getByRole('button', { name: 'Styles' });

        expect(styles().getAttribute('aria-pressed')).toBe('true');

        api.report(snapshotWith(['note'], { openMenu: null }));
        vi.useRealTimers();

        expect(styles().getAttribute('aria-pressed')).toBe('false');

        fireEvent.click(styles());

        expect(api.updateScene).toHaveBeenLastCalledWith({
            appState: { openMenu: 'shape' },
        });
    });

    it('wears its own chrome and shows the library panel while "Styles" is on', () => {
        setScreen(true);
        const { container } = renderChrome();
        const wrapper = container.querySelector('.whiteboard-canvas');

        expect(wrapper?.className).toContain('skrum-whiteboard--own-chrome');
        expect(wrapper?.className).toContain(
            'skrum-whiteboard--fallback-colors',
        );
        expect(wrapper?.className).not.toContain('skrum-whiteboard--styles');

        fireEvent.click(screen.getByRole('button', { name: 'Styles' }));

        expect(wrapper?.className).toContain('skrum-whiteboard--styles');

        fireEvent.click(screen.getByRole('button', { name: 'Styles' }));

        expect(wrapper?.className).not.toContain('skrum-whiteboard--styles');
    });

    it('stops the single keys at the canvas while the single-key shortcuts are off', () => {
        setScreen(true);
        renderChrome();
        const reached = vi.fn();
        const canvas = screen.getByTestId('library-canvas');
        document.addEventListener('keydown', reached);

        setSingleKeyShortcuts(false);
        fireEvent.keyDown(canvas, { key: 'r' });
        setSingleKeyShortcuts(true);
        fireEvent.keyDown(canvas, { key: 'r' });
        document.removeEventListener('keydown', reached);

        expect(reached).toHaveBeenCalledTimes(1);
    });

    it('docks "Fit to screen" before "Edit" on a phone in read mode, with no tool bar, zoom bar or minimap', () => {
        setScreen(false);
        const api = fakeApi(snapshotWith());
        const { container } = renderChrome({
            isPhone: true,
            editing: false,
            readMode: { reading: true, onChange: vi.fn() },
            api,
        });
        const dock = container.querySelector('[data-slot="read-mode-dock"]');

        expect(
            Array.from(dock?.querySelectorAll('button') ?? []).map(
                (button) =>
                    button.getAttribute('aria-label') ?? button.textContent,
            ),
        ).toEqual(['Fit to screen', 'Edit']);
        expect(toolbar('Tools')).toBeNull();
        expect(toolbar('Zoom')).toBeNull();
        expect(toolbar('History')).toBeNull();
        expect(screen.queryByRole('img', { name: 'Minimap' })).toBeNull();

        api.scrollToContent.mockClear();
        fireEvent.click(screen.getByRole('button', { name: 'Fit to screen' }));

        expect(api.scrollToContent).toHaveBeenCalledOnce();
    });

    it('fits the board to the screen once when a phone opens it, without animation', () => {
        setScreen(false);
        const api = fakeApi(snapshotWith([]));
        const view = renderChrome({ isPhone: true, api });

        expect(api.scrollToContent).toHaveBeenCalledExactlyOnceWith([Note], {
            fitToViewport: true,
            viewportZoomFactor: 0.9,
            animate: false,
        });

        view.rerender(
            <BoardChrome api={api as never} editing isPhone isFacilitator>
                <div />
            </BoardChrome>,
        );

        expect(api.scrollToContent).toHaveBeenCalledOnce();
    });

    it('fits the board on a phone only once the library has loaded its scene', async () => {
        setScreen(false);
        vi.useFakeTimers();
        const loading = snapshotWith([], {
            isLoading: true,
        } as Partial<CanvasAppState>);
        const api = fakeApi(loading);

        renderChrome({ isPhone: true, api });

        expect(api.scrollToContent).not.toHaveBeenCalled();

        api.report(snapshotWith([]));
        api.report(snapshotWith([]));
        await act(async () => {
            await Promise.resolve();
        });

        expect(api.scrollToContent).toHaveBeenCalledOnce();
    });

    it('leaves the view as it is when a wider screen opens the board, even once it narrows to a phone', () => {
        setScreen(true);
        const api = fakeApi(snapshotWith([]));
        const view = renderChrome({ api });

        view.rerender(
            <BoardChrome api={api as never} editing isPhone isFacilitator>
                <div />
            </BoardChrome>,
        );

        expect(api.scrollToContent).not.toHaveBeenCalled();
    });

    it('docks the compact tool bar before "Read" on a phone in edit mode, without zoom bar, history or minimap', () => {
        setScreen(false);
        const { container } = renderChrome({
            isPhone: true,
            snapshot: snapshotWith([]),
            readMode: { reading: false, onChange: vi.fn() },
        });
        const dock = container.querySelector('[data-slot="read-mode-dock"]');
        const bar = toolbar('Tools');

        expect(bar?.getAttribute('aria-orientation')).toBe('horizontal');
        expect(dock?.contains(bar)).toBe(true);
        expect(dock?.lastElementChild?.textContent).toBe('Read');
        expect(screen.getByRole('button', { name: 'Pencil' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Connector' })).toBeNull();
        expect(toolbar('Zoom')).toBeNull();
        expect(toolbar('History')).toBeNull();
        expect(screen.queryByRole('img', { name: 'Minimap' })).toBeNull();
    });

    it('shows no bar on a phone to a viewer the lock keeps out', () => {
        setScreen(false);
        const { container } = renderChrome({ isPhone: true, editing: false });

        expect(screen.queryAllByRole('toolbar')).toHaveLength(0);
        expect(
            container.querySelector('[data-slot="read-mode-dock"]'),
        ).toBeNull();
    });
});
