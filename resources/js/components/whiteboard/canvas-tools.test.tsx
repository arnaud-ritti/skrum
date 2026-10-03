import { fireEvent, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CanvasTools } from '@/components/whiteboard/canvas-tools';
import type {
    CanvasAppState,
    CanvasSnapshot,
} from '@/hooks/use-canvas-snapshot';
import { setSingleKeyShortcuts } from '@/lib/shortcuts/preference';
import { POSTIT, postItAppState } from '@/lib/whiteboard/palette';
import {
    DefaultToolChoices,
    StickyToolType,
    canvasToolFor,
} from '@/lib/whiteboard/tools';
import type { WbTool } from '@/lib/whiteboard/tools';
import { renderWithProviders } from '@/test/render';

vi.mock('@/lib/whiteboard/excalidraw', () => ({
    CaptureUpdateAction: { IMMEDIATELY: 'IMMEDIATELY', NEVER: 'NEVER' },
    restoreElements: (elements: unknown[]) => elements,
}));

type ActiveTool = {
    type: string;
    customType?: string | null;
    locked?: boolean;
};

type PointerDown = (
    activeTool: ActiveTool,
    state: { origin: { x: number; y: number } },
) => void;

const StickyActive: ActiveTool = {
    type: 'custom',
    customType: StickyToolType,
    locked: false,
};

function fakeApi(libraryState: Record<string, unknown> = {}) {
    const existing = [{ id: 'existing' }];
    const held: { pointerDown: PointerDown | null } = { pointerDown: null };

    return {
        held,
        setActiveTool: vi.fn(),
        updateScene: vi.fn(),
        getAppState: vi.fn(() => ({
            scrollX: 0,
            scrollY: 0,
            zoom: { value: 1 },
            width: 1000,
            height: 600,
            viewModeEnabled: false,
            ...libraryState,
        })),
        getSceneElementsIncludingDeleted: vi.fn(() => existing),
        onPointerDown: vi.fn((callback: PointerDown) => {
            held.pointerDown = callback;

            return () => {
                held.pointerDown = null;
            };
        }),
    };
}

type FakeApi = ReturnType<typeof fakeApi>;

function snapshotWith(appState: Partial<CanvasAppState> = {}): CanvasSnapshot {
    return {
        elements: [],
        appState: {
            activeTool: { type: 'selection', customType: null, locked: false },
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
            ...appState,
        } as unknown as CanvasAppState,
        view: { scrollX: 0, scrollY: 0, zoom: 1, width: 1000, height: 600 },
        stamp: '',
    };
}

function withTool(
    activeTool: ActiveTool,
    appState: Partial<CanvasAppState> = {},
) {
    return snapshotWith({
        activeTool: activeTool as never,
        ...appState,
    });
}

function Board({ api, snapshot }: { api: FakeApi; snapshot: CanvasSnapshot }) {
    const canvas = useRef<HTMLDivElement>(null);

    return (
        <>
            <div ref={canvas} data-testid="canvas" tabIndex={-1}>
                <CanvasTools
                    api={api as never}
                    snapshot={snapshot}
                    canvas={canvas}
                />
                <textarea
                    data-testid="wysiwyg"
                    className="excalidraw-wysiwyg"
                />
                <div role="dialog" aria-label="Library dialog">
                    <button type="button">Inside the dialog</button>
                </div>
            </div>
            <input data-testid="outside-field" />
        </>
    );
}

function renderTools(api: FakeApi, snapshot = snapshotWith()) {
    return renderWithProviders(<Board api={api} snapshot={snapshot} />);
}

function tool(name: string): HTMLElement {
    return screen.getByRole('button', { name });
}

function openMoreTools(): void {
    fireEvent.keyDown(tool('More tools'), { key: 'Enter' });
}

afterEach(() => {
    setSingleKeyShortcuts(true);
});

describe('CanvasTools', () => {
    it('sets the tool of the library for each tool of the bar, and shows the library tool as pressed', () => {
        const api = fakeApi();
        const { rerender } = renderTools(api);
        const names: [string, WbTool][] = [
            ['Selection', 'select'],
            ['Hand', 'hand'],
            ['Sticky note', 'sticky'],
            ['Shape', 'shape'],
            ['Connector', 'connector'],
            ['Text', 'text'],
            ['Pencil', 'pen'],
            ['Eraser', 'eraser'],
            ['Frame', 'frame'],
            ['Image', 'image'],
        ];

        expect(screen.getByRole('toolbar', { name: 'Tools' })).toBeTruthy();

        for (const [name, id] of names) {
            fireEvent.click(tool(name));

            expect(api.setActiveTool).toHaveBeenLastCalledWith(
                canvasToolFor(id, DefaultToolChoices),
            );
        }

        expect(tool('Selection').getAttribute('aria-pressed')).toBe('true');

        rerender(<Board api={api} snapshot={withTool({ type: 'diamond' })} />);

        expect(tool('Shape').getAttribute('aria-pressed')).toBe('true');
        expect(tool('Selection').getAttribute('aria-pressed')).toBe('false');
        expect(screen.getByRole('toolbar', { name: 'Shapes' })).toBeTruthy();
        expect(
            screen
                .getByRole('radio', { name: 'Diamond' })
                .getAttribute('aria-checked'),
        ).toBe('true');
    });

    it('keeps the shape and the connector the library last used for the next press', () => {
        const api = fakeApi();
        const { rerender } = renderTools(api, withTool({ type: 'ellipse' }));

        rerender(<Board api={api} snapshot={withTool({ type: 'line' })} />);
        rerender(<Board api={api} snapshot={snapshotWith()} />);

        fireEvent.click(tool('Shape'));
        expect(api.setActiveTool).toHaveBeenLastCalledWith({ type: 'ellipse' });

        fireEvent.click(tool('Connector'));
        expect(api.setActiveTool).toHaveBeenLastCalledWith({ type: 'line' });
    });

    it('chooses the kind of shape and of connector in their sub-bars', () => {
        const api = fakeApi();
        const { rerender } = renderTools(api, withTool({ type: 'rectangle' }));

        fireEvent.click(screen.getByRole('radio', { name: 'Ellipse' }));
        expect(api.setActiveTool).toHaveBeenLastCalledWith({ type: 'ellipse' });

        rerender(<Board api={api} snapshot={withTool({ type: 'arrow' })} />);

        expect(
            screen.getByRole('toolbar', { name: 'Connectors' }),
        ).toBeTruthy();

        fireEvent.click(screen.getByRole('radio', { name: 'Line' }));
        expect(api.setActiveTool).toHaveBeenLastCalledWith({ type: 'line' });
    });

    it('adds a selected sticky of the chosen colour under the pointer, then returns to the selection', () => {
        const api = fakeApi();

        renderTools(api, withTool(StickyActive));
        fireEvent.click(screen.getByRole('radio', { name: 'Coral' }));
        api.updateScene.mockClear();
        api.setActiveTool.mockClear();

        api.held.pointerDown?.(StickyActive, { origin: { x: 120, y: 80 } });

        const update = api.updateScene.mock.calls[0][0];
        const note = update.elements[1];

        expect(note).toMatchObject({
            type: 'rectangle',
            x: 120,
            y: 80,
            backgroundColor: POSTIT.coral.bg,
            strokeColor: POSTIT.coral.stroke,
            customData: { skrum: { kind: 'sticky' } },
        });
        expect(update.appState.selectedElementIds).toEqual({
            [note.id]: true,
        });

        fireEvent.pointerUp(window);

        expect(api.setActiveTool).toHaveBeenCalledWith({ type: 'selection' });
    });

    it('returns to the selection once when the placing pointer is cancelled, not on a later pointer-up', () => {
        const api = fakeApi();

        renderTools(api, withTool(StickyActive));
        api.setActiveTool.mockClear();

        api.held.pointerDown?.(StickyActive, { origin: { x: 0, y: 0 } });
        fireEvent.pointerCancel(window);
        fireEvent.pointerUp(window);

        expect(api.setActiveTool).toHaveBeenCalledOnce();
        expect(api.setActiveTool).toHaveBeenCalledWith({ type: 'selection' });
    });

    it('centres the tool bar between the top and the history bar when it does not fit under the header', () => {
        const offsetHeight = vi
            .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
            .mockImplementation(function (this: HTMLElement) {
                return this.dataset.slot === 'whiteboard-toolbar' ? 480 : 0;
            });
        const api = fakeApi();
        const short = snapshotWith();

        renderTools(api, { ...short, view: { ...short.view, height: 690 } });

        const root = document.querySelector<HTMLElement>(
            '[data-slot="canvas-tools"]',
        )!;

        expect(root.style.top).toBe(`${(690 - 70 - 480) / 2}px`);

        offsetHeight.mockRestore();
    });

    it('stays on the sticky tool when the tool is kept', () => {
        const api = fakeApi();
        const kept = { ...StickyActive, locked: true };

        renderTools(api, withTool(kept));
        api.setActiveTool.mockClear();

        api.held.pointerDown?.(kept, { origin: { x: 0, y: 0 } });
        fireEvent.pointerUp(window);

        expect(api.updateScene).toHaveBeenCalledTimes(1);
        expect(api.setActiveTool).not.toHaveBeenCalled();
    });

    it('ignores a press on the canvas with any other tool', () => {
        const api = fakeApi();

        renderTools(api);
        api.held.pointerDown?.(
            { type: 'rectangle' },
            { origin: { x: 0, y: 0 } },
        );

        expect(api.updateScene).not.toHaveBeenCalled();
    });

    it('adds a sticky in the middle of the view from a colour of the sub-bar, and moves the choice with the arrow keys without adding', () => {
        const api = fakeApi();

        renderTools(api, withTool(StickyActive));

        expect(
            screen.getByRole('toolbar', { name: 'Sticky note colours' }),
        ).toBeTruthy();

        fireEvent.keyDown(screen.getByRole('radio', { name: 'Sun' }), {
            key: 'ArrowRight',
        });

        expect(api.updateScene).not.toHaveBeenCalled();
        expect(
            screen
                .getByRole('radio', { name: 'Apricot' })
                .getAttribute('aria-checked'),
        ).toBe('true');

        fireEvent.click(screen.getByRole('radio', { name: 'Sky' }));

        expect(api.updateScene.mock.calls[0][0].elements[1]).toMatchObject({
            x: 400,
            y: 200,
            backgroundColor: POSTIT.sky.bg,
        });
        expect(api.setActiveTool).toHaveBeenLastCalledWith({
            type: 'selection',
        });
    });

    it('shows the eight colours of the shape tool with the current one checked', () => {
        renderTools(
            fakeApi(),
            withTool(
                { type: 'rectangle' },
                { currentItemBackgroundColor: POSTIT.sky.bg },
            ),
        );

        expect(
            screen.getByRole('radiogroup', { name: 'Fill colour' }),
        ).toBeTruthy();
        expect(
            screen
                .getAllByRole('radio')
                .filter((radio) => radio.dataset.color !== undefined),
        ).toHaveLength(8);
        expect(
            screen
                .getByRole('radio', { name: 'Sky' })
                .getAttribute('aria-checked'),
        ).toBe('true');
    });

    it('makes the colour the fill of the next shapes', () => {
        const api = fakeApi();

        renderTools(api, withTool({ type: 'rectangle' }));
        fireEvent.click(screen.getByRole('radio', { name: 'Moss' }));

        expect(api.updateScene).toHaveBeenCalledTimes(1);

        const update = api.updateScene.mock.calls[0][0];

        expect(update.elements).toBeUndefined();
        expect(update.appState).toEqual(postItAppState('moss'));
    });

    it('arms the sticky tool with N and the connector with C while the canvas or a bar has the focus', () => {
        const api = fakeApi();

        renderTools(api);

        fireEvent.keyDown(screen.getByTestId('canvas'), { key: 'n' });
        expect(api.setActiveTool).toHaveBeenLastCalledWith({
            type: 'custom',
            customType: StickyToolType,
        });

        fireEvent.keyDown(tool('Hand'), { key: 'c' });
        expect(api.setActiveTool).toHaveBeenLastCalledWith({ type: 'arrow' });
    });

    it('answers N and C neither in the text editor, a field, a dialog, outside the canvas, nor when single keys are off', () => {
        const api = fakeApi();

        renderTools(api);

        fireEvent.keyDown(screen.getByTestId('wysiwyg'), { key: 'n' });
        fireEvent.keyDown(screen.getByTestId('outside-field'), { key: 'c' });
        fireEvent.keyDown(
            screen.getByRole('button', { name: 'Inside the dialog' }),
            { key: 'n' },
        );
        fireEvent.keyDown(document.body, { key: 'n' });

        setSingleKeyShortcuts(false);
        fireEvent.keyDown(screen.getByTestId('canvas'), { key: 'n' });

        expect(api.setActiveTool).not.toHaveBeenCalled();
    });

    it('answers the letters of the library while the focus is in the tool bar', () => {
        const api = fakeApi();

        renderTools(api);
        fireEvent.keyDown(tool('Hand'), { key: 'r' });

        expect(api.setActiveTool).toHaveBeenLastCalledWith({
            type: 'rectangle',
        });

        setSingleKeyShortcuts(false);
        api.setActiveTool.mockClear();
        fireEvent.keyDown(tool('Hand'), { key: 't' });

        expect(api.setActiveTool).not.toHaveBeenCalled();
    });

    it('renders nothing in view mode, and a pending press of the sticky tool adds nothing', () => {
        const api = fakeApi();
        const { rerender } = renderTools(api, withTool(StickyActive));

        api.getAppState.mockReturnValue({
            ...api.getAppState(),
            viewModeEnabled: true,
        });
        rerender(
            <Board
                api={api}
                snapshot={withTool(StickyActive, { viewModeEnabled: true })}
            />,
        );

        expect(screen.queryByRole('toolbar', { name: 'Tools' })).toBeNull();

        api.held.pointerDown?.(StickyActive, { origin: { x: 0, y: 0 } });

        expect(api.updateScene).not.toHaveBeenCalled();
    });

    it('sets the laser pointer from "More tools" and checks it while it is active', () => {
        const api = fakeApi();
        const { rerender } = renderTools(api);

        openMoreTools();
        fireEvent.click(
            screen.getByRole('menuitemcheckbox', { name: /Laser pointer/ }),
        );

        expect(api.setActiveTool).toHaveBeenLastCalledWith({ type: 'laser' });

        rerender(<Board api={api} snapshot={withTool({ type: 'laser' })} />);

        expect(tool('Selection').getAttribute('aria-pressed')).toBe('false');
        expect(tool('More tools').className).toContain('bg-skrum-primary-soft');

        openMoreTools();

        expect(
            screen
                .getByRole('menuitemcheckbox', { name: /Laser pointer/ })
                .getAttribute('aria-checked'),
        ).toBe('true');
    });

    it('keeps the tool from "More tools"', () => {
        const api = fakeApi();

        renderTools(api, withTool({ type: 'rectangle', locked: false }));
        openMoreTools();
        fireEvent.click(
            screen.getByRole('menuitemcheckbox', { name: /Keep the tool/ }),
        );

        expect(api.updateScene).toHaveBeenLastCalledWith({
            appState: {
                activeTool: { type: 'rectangle', locked: true },
            },
        });
        expect(api.setActiveTool).not.toHaveBeenCalled();
    });

    it('keeps the image tool without opening the file picker again', () => {
        const api = fakeApi();

        renderTools(api, withTool({ type: 'image', locked: false }));
        openMoreTools();
        fireEvent.click(
            screen.getByRole('menuitemcheckbox', { name: /Keep the tool/ }),
        );

        expect(api.setActiveTool).not.toHaveBeenCalled();
        expect(api.updateScene).toHaveBeenLastCalledWith({
            appState: { activeTool: { type: 'image', locked: true } },
        });
    });

    it('offers the pen mode only when a pen was detected', () => {
        const api = fakeApi();
        const { rerender } = renderTools(api);

        openMoreTools();

        expect(
            screen.queryByRole('menuitemcheckbox', { name: /Pen mode/ }),
        ).toBeNull();

        fireEvent.keyDown(document.activeElement ?? document.body, {
            key: 'Escape',
        });
        rerender(
            <Board api={api} snapshot={snapshotWith({ penDetected: true })} />,
        );
        openMoreTools();
        fireEvent.click(
            screen.getByRole('menuitemcheckbox', { name: /Pen mode/ }),
        );

        expect(api.updateScene).toHaveBeenLastCalledWith({
            appState: { penMode: true },
        });
    });
});
