import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StickyTool } from '@/components/whiteboard/sticky-tool';
import { POSTIT } from '@/lib/whiteboard/palette';
import { renderWithProviders } from '@/test/render';

vi.mock('@/lib/whiteboard/excalidraw', () => ({
    CaptureUpdateAction: { IMMEDIATELY: 'IMMEDIATELY' },
    ToolbarDom: { buttonClass: 'ToolIcon', iconClass: 'ToolIcon__icon' },
    restoreElements: (elements: unknown[]) => elements,
}));

function canvas() {
    const existing = [{ id: 'existing' }];

    return {
        getSceneElementsIncludingDeleted: vi.fn(() => existing),
        getAppState: vi.fn(() => ({
            scrollX: 0,
            scrollY: 0,
            zoom: { value: 1 },
            width: 1000,
            height: 600,
        })),
        updateScene: vi.fn(),
    };
}

function open(): void {
    fireEvent.click(screen.getByRole('button', { name: 'Sticky note' }));
}

describe('StickyTool', () => {
    it('opens the eight colours with Sun chosen', () => {
        renderWithProviders(<StickyTool api={canvas() as never} />);

        expect(screen.queryByRole('radiogroup')).toBeNull();

        open();

        expect(
            screen.getByRole('radiogroup', { name: 'Fill colour' }),
        ).toBeTruthy();
        expect(screen.getAllByRole('radio')).toHaveLength(8);
        expect(
            screen
                .getByRole('radio', { name: 'Sun' })
                .getAttribute('aria-checked'),
        ).toBe('true');
    });

    it('adds a selected note with the fill and the border of the pressed colour, in the middle of the view, and closes', () => {
        const api = canvas();
        const onOpenChange = vi.fn();

        renderWithProviders(
            <StickyTool api={api as never} onOpenChange={onOpenChange} />,
        );
        open();

        expect(onOpenChange).toHaveBeenLastCalledWith(true);

        fireEvent.click(screen.getByRole('radio', { name: 'Sky' }));

        const update = api.updateScene.mock.calls[0][0];
        const note = update.elements[1];

        expect(update.elements[0]).toEqual({ id: 'existing' });
        expect(note).toMatchObject({
            type: 'rectangle',
            x: 400,
            y: 200,
            width: 200,
            height: 200,
            backgroundColor: POSTIT.sky.bg,
            strokeColor: POSTIT.sky.stroke,
            fillStyle: 'solid',
            customData: { skrum: { kind: 'sticky' } },
        });
        expect(update.appState.selectedElementIds).toEqual({
            [note.id]: true,
        });
        expect(screen.queryByRole('radiogroup')).toBeNull();
        expect(onOpenChange).toHaveBeenLastCalledWith(false);
    });

    it('moves the choice with the arrow keys without adding a note, and remembers it', () => {
        const api = canvas();

        renderWithProviders(<StickyTool api={api as never} />);
        open();
        fireEvent.keyDown(screen.getByRole('radio', { name: 'Sun' }), {
            key: 'ArrowRight',
        });

        expect(api.updateScene).not.toHaveBeenCalled();
        expect(
            screen
                .getByRole('radio', { name: 'Apricot' })
                .getAttribute('aria-checked'),
        ).toBe('true');

        fireEvent.click(screen.getByRole('radio', { name: 'Moss' }));
        open();

        expect(
            screen
                .getByRole('radio', { name: 'Moss' })
                .getAttribute('aria-checked'),
        ).toBe('true');
    });

    it('has the look of a canvas tool inside the shapes toolbar', () => {
        renderWithProviders(<StickyTool api={canvas() as never} inToolbar />);

        expect(
            screen.getByRole('button', { name: 'Sticky note' }).className,
        ).toContain('ToolIcon');
    });
});
