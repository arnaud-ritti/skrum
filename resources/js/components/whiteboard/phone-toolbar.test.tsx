import { fireEvent, screen, within } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PhoneToolbar } from '@/components/whiteboard/phone-toolbar';
import type {
    CanvasAppState,
    CanvasSnapshot,
} from '@/hooks/use-canvas-snapshot';
import { StickyToolType } from '@/lib/whiteboard/tools';
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

function fakeApi() {
    return {
        setActiveTool: vi.fn(),
        updateScene: vi.fn(),
        scrollToContent: vi.fn(),
        getAppState: vi.fn(() => ({
            scrollX: 0,
            scrollY: 0,
            zoom: { value: 1 },
            width: 400,
            height: 700,
            viewModeEnabled: false,
        })),
        getSceneElements: vi.fn(() => [{ id: 'note' }]),
        getSceneElementsIncludingDeleted: vi.fn(() => [{ id: 'note' }]),
        onPointerDown: vi.fn(() => () => {}),
    };
}

type FakeApi = ReturnType<typeof fakeApi>;

function snapshotWith(
    activeTool: ActiveTool = { type: 'selection' },
): CanvasSnapshot {
    return {
        elements: [],
        appState: {
            activeTool: { customType: null, locked: false, ...activeTool },
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
        } as unknown as CanvasAppState,
        view: { scrollX: 0, scrollY: 0, zoom: 1, width: 400, height: 700 },
        stamp: '',
    };
}

function Phone({ api, snapshot }: { api: FakeApi; snapshot: CanvasSnapshot }) {
    const canvas = useRef<HTMLDivElement>(null);

    return (
        <div ref={canvas}>
            <button type="button" data-testid="button-undo" />
            <button type="button" data-testid="button-redo" disabled />
            <PhoneToolbar
                api={api as never}
                snapshot={snapshot}
                canvas={canvas}
            />
        </div>
    );
}

function renderPhone(api: FakeApi, snapshot = snapshotWith()) {
    return renderWithProviders(<Phone api={api} snapshot={snapshot} />);
}

function openDrawer(): HTMLElement {
    fireEvent.click(screen.getByRole('button', { name: 'More tools' }));

    return screen.getByRole('dialog', { name: 'More tools' });
}

describe('PhoneToolbar', () => {
    it('shows Selection, Sticky note, Pencil and "More tools" in one horizontal bar of touch-sized tools', () => {
        renderPhone(fakeApi());

        const bar = screen.getByRole('toolbar', { name: 'Tools' });
        const names = within(bar)
            .getAllByRole('button')
            .map((button) => button.getAttribute('aria-label'));

        expect(bar.getAttribute('aria-orientation')).toBe('horizontal');
        expect(names).toEqual([
            'Selection',
            'Sticky note',
            'Pencil',
            'More tools',
        ]);
        expect(
            within(bar).getByRole('button', { name: 'Selection' }).className,
        ).toContain('size-11');
    });

    it('lists the other tools a phone offers, then Undo, Redo and Fit to screen, in the drawer — no connector, no frame', () => {
        renderPhone(fakeApi());

        const drawer = openDrawer();
        const names = within(drawer)
            .getAllByRole('button')
            .map((button) => button.textContent)
            .filter((name) => name !== 'Close');

        expect(names).toEqual([
            'Hand',
            'Shape',
            'Text',
            'Eraser',
            'Image',
            'Undo',
            'Redo',
            'Fit to screen',
        ]);
        expect(
            within(drawer).queryByRole('button', { name: 'Connector' }),
        ).toBeNull();
        expect(
            within(drawer).queryByRole('button', { name: 'Frame' }),
        ).toBeNull();
        expect(
            (
                within(drawer).getByRole('button', {
                    name: 'Redo',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });

    it('sets a drawer tool and closes the drawer', () => {
        const api = fakeApi();

        renderPhone(api);
        fireEvent.click(
            within(openDrawer()).getByRole('button', { name: 'Eraser' }),
        );

        expect(api.setActiveTool).toHaveBeenLastCalledWith({ type: 'eraser' });
        expect(screen.queryByRole('dialog', { name: 'More tools' })).toBeNull();
    });

    it('fits the board to the screen from the drawer', () => {
        const api = fakeApi();

        renderPhone(api);
        fireEvent.click(
            within(openDrawer()).getByRole('button', { name: 'Fit to screen' }),
        );

        expect(api.scrollToContent).toHaveBeenCalledOnce();
        expect(screen.queryByRole('dialog', { name: 'More tools' })).toBeNull();
    });

    it('sets the sticky tool from the bar and opens its colours above the bar', () => {
        const api = fakeApi();
        const { rerender } = renderPhone(api);

        fireEvent.click(screen.getByRole('button', { name: 'Sticky note' }));

        expect(api.setActiveTool).toHaveBeenLastCalledWith({
            type: 'custom',
            customType: StickyToolType,
        });

        rerender(
            <Phone
                api={api}
                snapshot={snapshotWith({
                    type: 'custom',
                    customType: StickyToolType,
                })}
            />,
        );

        expect(
            screen.getByRole('toolbar', { name: 'Sticky note colours' }),
        ).toBeTruthy();
        expect(
            screen
                .getByRole('button', { name: 'Sticky note' })
                .getAttribute('aria-pressed'),
        ).toBe('true');
    });

    it('offers the three kinds of shape above the bar while the shape tool is on', () => {
        renderPhone(fakeApi(), snapshotWith({ type: 'ellipse' }));

        expect(screen.getByRole('toolbar', { name: 'Shapes' })).toBeTruthy();
        expect(
            screen
                .getByRole('radio', { name: 'Ellipse' })
                .getAttribute('aria-checked'),
        ).toBe('true');
        expect(
            screen.queryByRole('toolbar', { name: 'Connectors' }),
        ).toBeNull();
    });
});
