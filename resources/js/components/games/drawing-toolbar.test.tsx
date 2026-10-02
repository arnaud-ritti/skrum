import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DrawingColors } from '@/lib/games/drawing';
import { renderWithProviders } from '@/test/render';
import { DrawingToolbar, type DrawingToolbarProps } from './drawing-toolbar';

function setup(props: Partial<DrawingToolbarProps> = {}) {
    const handlers = {
        onTool: vi.fn(),
        onColor: vi.fn(),
        onSize: vi.fn(),
        onUndo: vi.fn(),
        onClear: vi.fn(),
    };

    renderWithProviders(
        <DrawingToolbar
            tool="pen"
            color="black"
            size={10}
            canUndo
            {...handlers}
            {...props}
        />,
    );

    return {
        ...handlers,
        toolbar: screen.getByRole('toolbar', { name: 'Drawing tools' }),
    };
}

afterEach(() => {
    vi.useRealTimers();
});

describe('DrawingToolbar', () => {
    it('offers the pencil, the eraser, the fill, three strokes, the ink and the eight theme colours, undo and clear', () => {
        const { toolbar } = setup();
        const bar = within(toolbar);

        expect(
            bar
                .getByRole('button', { name: 'Pencil' })
                .getAttribute('aria-pressed'),
        ).toBe('true');
        expect(
            bar
                .getByRole('button', { name: 'Eraser' })
                .getAttribute('aria-pressed'),
        ).toBe('false');
        expect(
            bar
                .getByRole('button', { name: 'Fill' })
                .getAttribute('aria-pressed'),
        ).toBe('false');
        expect(
            within(bar.getByRole('radiogroup', { name: 'Stroke' }))
                .getAllByRole('radio')
                .map((radio) => radio.getAttribute('aria-label')),
        ).toEqual(['Stroke: Thin', 'Stroke: Medium', 'Stroke: Thick']);
        expect(
            bar
                .getByRole('radio', { name: 'Stroke: Medium' })
                .getAttribute('aria-checked'),
        ).toBe('true');
        expect(
            [...toolbar.querySelectorAll('[data-color]')].map((swatch) =>
                swatch.getAttribute('aria-label'),
            ),
        ).toEqual([
            'Ink',
            'Sun',
            'Apricot',
            'Coral',
            'Plum',
            'Iris',
            'Sky',
            'Lagoon',
            'Moss',
        ]);
        expect(toolbar.querySelectorAll('[data-color]')).toHaveLength(
            DrawingColors.length,
        );
        expect(
            bar
                .getByRole('button', { name: 'Ink' })
                .getAttribute('aria-pressed'),
        ).toBe('true');
        expect(
            (bar.getByRole('button', { name: 'Undo' }) as HTMLButtonElement)
                .disabled,
        ).toBe(false);
        expect(
            (bar.getByRole('button', { name: 'Clear' }) as HTMLButtonElement)
                .disabled,
        ).toBe(false);
        expect(bar.queryByRole('button', { name: 'Redo' })).toBeNull();
    });

    it('shows the keys of the pencil and of the eraser and names the keys of undo', () => {
        const { toolbar } = setup();
        const bar = within(toolbar);

        expect(
            bar
                .getByRole('button', { name: 'Pencil' })
                .getAttribute('aria-keyshortcuts'),
        ).toBe('P');
        expect(
            bar
                .getByRole('button', { name: 'Eraser' })
                .getAttribute('aria-keyshortcuts'),
        ).toBe('E');
        expect(
            bar
                .getByRole('button', { name: 'Undo' })
                .getAttribute('aria-keyshortcuts'),
        ).toBe('Meta+Z Control+Z');
        expect(
            bar.getByRole('button', { name: 'Pencil' }).textContent,
        ).toContain('P');
    });

    it('picks a tool, a stroke and a colour; a colour picked with the eraser gives the pencil back', () => {
        const { toolbar, onTool, onColor, onSize } = setup({ tool: 'eraser' });
        const bar = within(toolbar);

        fireEvent.click(bar.getByRole('button', { name: 'Fill' }));
        expect(onTool).toHaveBeenLastCalledWith('fill');

        fireEvent.click(bar.getByRole('radio', { name: 'Stroke: Thick' }));
        expect(onSize).toHaveBeenLastCalledWith(24);

        fireEvent.click(bar.getByRole('button', { name: 'Coral' }));
        expect(onColor).toHaveBeenLastCalledWith('coral');
        expect(onTool).toHaveBeenLastCalledWith('pen');
    });

    it('keeps the fill when a colour is picked with it', () => {
        const { toolbar, onTool, onColor } = setup({ tool: 'fill' });

        fireEvent.click(within(toolbar).getByRole('button', { name: 'Moss' }));

        expect(onColor).toHaveBeenLastCalledWith('moss');
        expect(onTool).not.toHaveBeenCalled();
    });

    it('moves between the strokes with the arrow keys', () => {
        const { toolbar, onSize } = setup();
        const medium = within(toolbar).getByRole('radio', {
            name: 'Stroke: Medium',
        });

        fireEvent.keyDown(medium, { key: 'ArrowRight' });
        expect(onSize).toHaveBeenLastCalledWith(24);

        fireEvent.keyDown(medium, { key: 'ArrowLeft' });
        expect(onSize).toHaveBeenLastCalledWith(4);
    });

    it('clears after a second click only, and forgets the first after three seconds', () => {
        vi.useFakeTimers();

        const { toolbar, onClear } = setup();
        const bar = within(toolbar);

        fireEvent.click(bar.getByRole('button', { name: 'Clear' }));

        expect(onClear).not.toHaveBeenCalled();
        expect(
            bar.getByRole('button', { name: 'Click again to clear' }),
        ).not.toBeNull();

        act(() => {
            vi.advanceTimersByTime(3000);
        });

        expect(bar.getByRole('button', { name: 'Clear' })).not.toBeNull();

        fireEvent.click(bar.getByRole('button', { name: 'Clear' }));
        fireEvent.click(
            bar.getByRole('button', { name: 'Click again to clear' }),
        );

        expect(onClear).toHaveBeenCalledTimes(1);
    });

    it('has nothing to undo or clear on an empty drawing', () => {
        const { toolbar } = setup({ canUndo: false });
        const bar = within(toolbar);

        expect(
            (bar.getByRole('button', { name: 'Undo' }) as HTMLButtonElement)
                .disabled,
        ).toBe(true);
        expect(
            (bar.getByRole('button', { name: 'Clear' }) as HTMLButtonElement)
                .disabled,
        ).toBe(true);
    });

    it('shows the colours with the light values of the inks in both themes', () => {
        const { toolbar } = setup();

        expect(
            [...toolbar.querySelectorAll('[data-color]')].every(
                (swatch) => swatch.closest('.light') !== null,
            ),
        ).toBe(true);
    });

    it('keeps the colours in a popover when compact', () => {
        const { toolbar, onColor } = setup({ compact: true, color: 'sky' });
        const bar = within(toolbar);

        expect(bar.queryByRole('button', { name: 'Coral' })).toBeNull();

        const trigger = bar.getByRole('button', { name: 'Ink colour: Sky' });

        expect(trigger.getAttribute('data-color')).toBe('sky');
        expect(trigger.closest('.light')).not.toBeNull();

        fireEvent.click(trigger);

        const popover = screen.getByRole('dialog');

        expect(popover.querySelectorAll('[data-color]')).toHaveLength(9);
        expect(popover.closest('.light')).not.toBeNull();
        expect(
            within(popover)
                .getByRole('button', { name: 'Sky' })
                .getAttribute('aria-pressed'),
        ).toBe('true');

        fireEvent.click(within(popover).getByRole('button', { name: 'Coral' }));

        expect(onColor).toHaveBeenLastCalledWith('coral');
        expect(screen.queryByRole('dialog')).toBeNull();
    });
});
