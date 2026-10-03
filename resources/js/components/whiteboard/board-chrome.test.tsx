import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BoardChrome } from '@/components/whiteboard/board-chrome';
import type {
    CanvasAppState,
    CanvasSnapshot,
} from '@/hooks/use-canvas-snapshot';
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

function snapshotWith(selected: string[] = ['note']): CanvasSnapshot {
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
        } as unknown as CanvasAppState,
        view: View,
        stamp: 'stamp',
    };
}

function fakeApi() {
    return {
        setActiveTool: vi.fn(),
        updateScene: vi.fn(),
        scrollToContent: vi.fn(),
        getAppState: vi.fn(() => ({
            ...View,
            zoom: { value: 1 },
            selectedElementIds: { note: true },
        })),
        getSceneElements: vi.fn(() => [Note]),
        getSceneElementsIncludingDeleted: vi.fn(() => [Note]),
        onPointerDown: vi.fn(() => () => {}),
        onScrollChange: vi.fn(() => () => {}),
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
    api = fakeApi(),
}: {
    snapshot?: CanvasSnapshot | null;
    editing?: boolean;
    withApi?: boolean;
    isPhone?: boolean;
    readMode?: { reading: boolean; onChange: (reading: boolean) => void };
    api?: ReturnType<typeof fakeApi>;
} = {}) {
    return renderWithProviders(
        <BoardChrome
            api={withApi ? (api as never) : null}
            snapshot={snapshot}
            editing={editing}
            isPhone={isPhone}
            isFacilitator
            readMode={readMode}
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

    it('shows no bar while the canvas is loading', () => {
        setScreen(true);
        renderChrome({ snapshot: null });

        expect(screen.queryAllByRole('toolbar')).toHaveLength(0);
        expect(screen.getByTestId('library-canvas')).toBeTruthy();

        renderChrome({ withApi: false });

        expect(screen.queryAllByRole('toolbar')).toHaveLength(0);
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

    it('docks "Fit to screen" before "Edit" on a phone in read mode, with no tool bar, zoom bar or minimap', () => {
        setScreen(false);
        const api = fakeApi();
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

        fireEvent.click(screen.getByRole('button', { name: 'Fit to screen' }));

        expect(api.scrollToContent).toHaveBeenCalledOnce();
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
