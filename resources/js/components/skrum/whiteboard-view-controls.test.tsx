import { readFileSync } from 'node:fs';
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    WhiteboardHistoryBar,
    WhiteboardMinimap,
    WhiteboardZoomBar,
} from '@/components/skrum/whiteboard-view-controls';
import type { MinimapShape } from '@/components/skrum/whiteboard-view-controls';
import { renderWithProviders } from '@/test/render';

function zoomBar(
    overrides: Partial<Parameters<typeof WhiteboardZoomBar>[0]> = {},
) {
    const props = {
        percent: 80,
        canZoomIn: true,
        canZoomOut: true,
        minimapOpen: true,
        onZoomIn: vi.fn(),
        onZoomOut: vi.fn(),
        onReset: vi.fn(),
        onFit: vi.fn(),
        onMinimapToggle: vi.fn(),
        ...overrides,
    };

    renderWithProviders(<WhiteboardZoomBar {...props} />);

    return props;
}

function namesIn(toolbar: HTMLElement): string[] {
    return within(toolbar)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label') ?? '');
}

describe('WhiteboardZoomBar', () => {
    it('names its controls in the order of the mockup, with a separator before Fit', () => {
        zoomBar();

        const toolbar = screen.getByRole('toolbar', { name: 'Zoom' });

        expect(toolbar.getAttribute('aria-orientation')).toBe('horizontal');
        expect(namesIn(toolbar)).toEqual([
            'Zoom out',
            'Reset zoom to 100 %',
            'Zoom in',
            'Fit to screen',
            'Minimap',
        ]);
        expect(
            toolbar.querySelectorAll(
                '[data-slot="whiteboard-toolbar-separator"]',
            ),
        ).toHaveLength(1);
    });

    it('shows the percentage with a narrow no-break space and resets to 100 % on a press', () => {
        const props = zoomBar({ percent: 80 });

        const percentage = screen.getByRole('button', {
            name: 'Reset zoom to 100 %',
        });

        expect(percentage.textContent).toBe('80 %');

        fireEvent.click(percentage);

        expect(props.onReset).toHaveBeenCalledOnce();
    });

    it('calls each control', () => {
        const props = zoomBar();

        fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
        fireEvent.click(screen.getByRole('button', { name: 'Zoom out' }));
        fireEvent.click(screen.getByRole('button', { name: 'Fit to screen' }));
        fireEvent.click(screen.getByRole('button', { name: 'Minimap' }));

        expect(props.onZoomIn).toHaveBeenCalledOnce();
        expect(props.onZoomOut).toHaveBeenCalledOnce();
        expect(props.onFit).toHaveBeenCalledOnce();
        expect(props.onMinimapToggle).toHaveBeenCalledOnce();
    });

    it('disables Zoom in and Zoom out at the ends of the range', () => {
        zoomBar({ canZoomIn: false, canZoomOut: true });

        expect(
            screen
                .getByRole('button', { name: 'Zoom in' })
                .getAttribute('aria-disabled'),
        ).toBe('true');
        expect(
            screen
                .getByRole('button', { name: 'Zoom out' })
                .getAttribute('aria-disabled'),
        ).toBe(null);
    });

    it('disables Zoom out at the lower end', () => {
        zoomBar({ canZoomIn: true, canZoomOut: false });

        expect(
            screen
                .getByRole('button', { name: 'Zoom out' })
                .getAttribute('aria-disabled'),
        ).toBe('true');
    });

    it('keeps the focus on Zoom in when a press reaches the largest zoom, and ignores further presses', () => {
        const props = {
            percent: 390,
            canZoomOut: true,
            onZoomIn: vi.fn(),
            onZoomOut: vi.fn(),
            onReset: vi.fn(),
            onFit: vi.fn(),
        };
        const { rerender } = renderWithProviders(
            <WhiteboardZoomBar {...props} canZoomIn />,
        );
        const zoomIn = screen.getByRole('button', { name: 'Zoom in' });

        zoomIn.focus();
        fireEvent.click(zoomIn);
        rerender(<WhiteboardZoomBar {...props} canZoomIn={false} />);
        fireEvent.click(zoomIn);

        expect(document.activeElement).toBe(zoomIn);
        expect((zoomIn as HTMLButtonElement).disabled).toBe(false);
        expect(props.onZoomIn).toHaveBeenCalledOnce();
    });

    it('presses the Minimap toggle while the minimap is open', () => {
        zoomBar({ minimapOpen: true });

        expect(
            screen
                .getByRole('button', { name: 'Minimap' })
                .getAttribute('aria-pressed'),
        ).toBe('true');
    });

    it('releases the Minimap toggle while the minimap is closed', () => {
        zoomBar({ minimapOpen: false });

        expect(
            screen
                .getByRole('button', { name: 'Minimap' })
                .getAttribute('aria-pressed'),
        ).toBe('false');
    });

    it('has no Minimap toggle when the minimap cannot be shown', () => {
        zoomBar({ minimapOpen: undefined, onMinimapToggle: undefined });

        expect(screen.queryByRole('button', { name: 'Minimap' })).toBeNull();
        expect(
            screen.getByRole('button', { name: 'Fit to screen' }),
        ).toBeTruthy();
    });

    it('keeps one tab stop and moves with left and right, wrapping, skipping a disabled control', () => {
        zoomBar({ canZoomOut: false });

        const toolbar = screen.getByRole('toolbar', { name: 'Zoom' });
        const tabStops = within(toolbar)
            .getAllByRole('button')
            .filter((button) => button.tabIndex === 0);

        expect(tabStops).toHaveLength(1);
        expect(tabStops[0].getAttribute('aria-label')).toBe(
            'Reset zoom to 100 %',
        );

        tabStops[0].focus();
        fireEvent.keyDown(document.activeElement as Element, {
            key: 'ArrowRight',
        });
        expect(document.activeElement?.getAttribute('aria-label')).toBe(
            'Zoom in',
        );

        fireEvent.keyDown(document.activeElement as Element, { key: 'End' });
        expect(document.activeElement?.getAttribute('aria-label')).toBe(
            'Minimap',
        );

        fireEvent.keyDown(document.activeElement as Element, {
            key: 'ArrowRight',
        });
        expect(document.activeElement?.getAttribute('aria-label')).toBe(
            'Reset zoom to 100 %',
        );

        fireEvent.keyDown(document.activeElement as Element, {
            key: 'ArrowLeft',
        });
        expect(document.activeElement?.getAttribute('aria-label')).toBe(
            'Minimap',
        );
        expect(
            within(toolbar)
                .getAllByRole('button')
                .filter((button) => button.tabIndex === 0)
                .map((button) => button.getAttribute('aria-label')),
        ).toEqual(['Minimap']);
    });
});

const shapes: MinimapShape[] = [
    { id: 'a', x: 10, y: 12, width: 8, height: 6, color: 'coral' },
    { id: 'b', x: 30, y: 12, width: 8, height: 6, color: 'sky' },
    { id: 'c', x: 50, y: 40, width: 20, height: 3, color: null },
];

function minimap(
    overrides: Partial<Parameters<typeof WhiteboardMinimap>[0]> = {},
) {
    const props = {
        shapes,
        view: { x: 18, y: 14, width: 108, height: 74 },
        onMoveTo: vi.fn(),
        onPan: vi.fn(),
        ...overrides,
    };

    renderWithProviders(<WhiteboardMinimap {...props} />);

    return props;
}

describe('WhiteboardMinimap', () => {
    it('is an image named Minimap, described, drawing one rectangle per shape', () => {
        minimap();

        const image = screen.getByRole('img', { name: 'Minimap' });
        const described = document.getElementById(
            image.getAttribute('aria-describedby') ?? '',
        );

        expect(described?.textContent).toBe(
            'Shows the whole board; the frame is the part you see.',
        );
        expect(
            image.querySelectorAll('[data-slot="whiteboard-minimap-shape"]'),
        ).toHaveLength(3);
    });

    it('draws a palette shape in its swatch colours and any other in the muted colour', () => {
        minimap();

        const drawn = Array.from(
            document.querySelectorAll<HTMLElement>(
                '[data-slot="whiteboard-minimap-shape"]',
            ),
        );

        expect(drawn[0].className).toContain('bg-skrum-col-coral');
        expect(drawn[0].className).toContain('border-skrum-col-coral-border');
        expect(drawn[1].className).toContain('bg-skrum-col-sky');
        expect(drawn[2].className).toContain('bg-muted-foreground/50');
        expect(drawn[0].style.left).toBe('10px');
        expect(drawn[0].style.top).toBe('12px');
        expect(drawn[0].style.width).toBe('8px');
        expect(drawn[0].style.height).toBe('6px');
    });

    it('places the frame of the view as a button', () => {
        minimap();

        const frame = screen.getByRole('button', { name: 'Move the view' });

        expect(frame.style.left).toBe('18px');
        expect(frame.style.top).toBe('14px');
        expect(frame.style.width).toBe('108px');
        expect(frame.style.height).toBe('74px');
    });

    it('moves the view to the point pressed, relative to the minimap, and follows a drag', () => {
        const props = minimap();
        const surface = document.querySelector<HTMLElement>(
            '[data-slot="whiteboard-minimap"]',
        ) as HTMLElement;
        surface.getBoundingClientRect = () =>
            ({
                left: 100,
                top: 200,
                right: 280,
                bottom: 312,
                width: 180,
                height: 112,
                x: 100,
                y: 200,
                toJSON: () => ({}),
            }) as DOMRect;

        fireEvent.pointerDown(surface, {
            clientX: 150,
            clientY: 230,
            pointerId: 1,
            button: 0,
        });

        expect(props.onMoveTo).toHaveBeenLastCalledWith({ x: 50, y: 30 });

        fireEvent.pointerMove(surface, {
            clientX: 160,
            clientY: 240,
            pointerId: 1,
        });

        expect(props.onMoveTo).toHaveBeenLastCalledWith({ x: 60, y: 40 });

        fireEvent.pointerUp(surface, { pointerId: 1 });
        fireEvent.pointerMove(surface, {
            clientX: 170,
            clientY: 250,
            pointerId: 1,
        });

        expect(props.onMoveTo).toHaveBeenCalledTimes(2);
    });

    it('pans by a tenth with the arrows on the frame', () => {
        const props = minimap();
        const frame = screen.getByRole('button', { name: 'Move the view' });

        fireEvent.keyDown(frame, { key: 'ArrowRight' });
        expect(props.onPan).toHaveBeenLastCalledWith(0.1, 0);

        fireEvent.keyDown(frame, { key: 'ArrowLeft' });
        expect(props.onPan).toHaveBeenLastCalledWith(-0.1, 0);

        fireEvent.keyDown(frame, { key: 'ArrowDown' });
        expect(props.onPan).toHaveBeenLastCalledWith(0, 0.1);

        fireEvent.keyDown(frame, { key: 'ArrowUp' });
        expect(props.onPan).toHaveBeenLastCalledWith(0, -0.1);

        fireEvent.keyDown(frame, { key: 'a' });
        expect(props.onPan).toHaveBeenCalledTimes(4);
    });

    it('draws only the frame on an empty board', () => {
        minimap({ shapes: [] });

        expect(
            document.querySelectorAll('[data-slot="whiteboard-minimap-shape"]'),
        ).toHaveLength(0);
        expect(
            screen.getByRole('button', { name: 'Move the view' }),
        ).toBeTruthy();
    });
});

describe('WhiteboardHistoryBar', () => {
    it('names Undo then Redo in a History toolbar', () => {
        renderWithProviders(
            <WhiteboardHistoryBar
                canUndo
                canRedo
                onUndo={vi.fn()}
                onRedo={vi.fn()}
            />,
        );

        const toolbar = screen.getByRole('toolbar', { name: 'History' });

        expect(namesIn(toolbar)).toEqual(['Undo', 'Redo']);
        expect(toolbar.getAttribute('aria-orientation')).toBe('horizontal');
    });

    it('disables each button by its own state and calls the enabled one', () => {
        const onUndo = vi.fn();
        const onRedo = vi.fn();
        renderWithProviders(
            <WhiteboardHistoryBar
                canUndo
                canRedo={false}
                onUndo={onUndo}
                onRedo={onRedo}
            />,
        );

        const undo = screen.getByRole('button', {
            name: 'Undo',
        }) as HTMLButtonElement;
        const redo = screen.getByRole('button', {
            name: 'Redo',
        }) as HTMLButtonElement;

        expect(undo.disabled).toBe(false);
        expect(redo.disabled).toBe(true);

        fireEvent.click(undo);
        fireEvent.click(redo);

        expect(onUndo).toHaveBeenCalledOnce();
        expect(onRedo).not.toHaveBeenCalled();
    });

    it('moves the focus between Undo and Redo with the arrows', () => {
        renderWithProviders(
            <WhiteboardHistoryBar
                canUndo
                canRedo
                onUndo={vi.fn()}
                onRedo={vi.fn()}
            />,
        );

        const undo = screen.getByRole('button', { name: 'Undo' });
        const redo = screen.getByRole('button', { name: 'Redo' });

        expect(undo.tabIndex).toBe(0);
        expect(redo.tabIndex).toBe(-1);

        undo.focus();
        fireEvent.keyDown(undo, { key: 'ArrowRight' });

        expect(document.activeElement).toBe(redo);
    });
});

describe('whiteboard view controls', () => {
    it('only render: no library, router or socket import', () => {
        const source = readFileSync(
            'resources/js/components/skrum/whiteboard-view-controls.tsx',
            'utf8',
        );

        expect(source).not.toMatch(/from '@\/lib\/whiteboard\/excalidraw'/);
        expect(source).not.toMatch(/@excalidraw\//);
        expect(source).not.toMatch(/@inertiajs\/react/);
        expect(source).not.toMatch(/laravel-echo/);
    });
});
