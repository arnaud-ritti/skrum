import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WhiteboardColorBar } from '@/components/skrum/whiteboard-toolbar';
import { renderWithProviders } from '@/test/render';

describe('WhiteboardColorBar', () => {
    it('shows the eight colours with only the current one checked', () => {
        renderWithProviders(
            <WhiteboardColorBar value="sky" onChange={vi.fn()} />,
        );

        expect(screen.getAllByRole('radio')).toHaveLength(8);
        expect(
            screen
                .getByRole('radio', { name: 'Sky' })
                .getAttribute('aria-checked'),
        ).toBe('true');
        expect(
            screen
                .getByRole('radio', { name: 'Sun' })
                .getAttribute('aria-checked'),
        ).toBe('false');
    });

    it('reports the clicked colour', () => {
        const onChange = vi.fn();
        renderWithProviders(
            <WhiteboardColorBar value="sun" onChange={onChange} />,
        );

        fireEvent.click(screen.getByRole('radio', { name: 'Moss' }));

        expect(onChange).toHaveBeenCalledWith('moss');
    });

    it('moves with the arrow keys and wraps around', () => {
        const onChange = vi.fn();
        renderWithProviders(
            <WhiteboardColorBar value="moss" onChange={onChange} />,
        );

        fireEvent.keyDown(screen.getByRole('radio', { name: 'Moss' }), {
            key: 'ArrowRight',
        });
        expect(onChange).toHaveBeenLastCalledWith('sun');

        fireEvent.keyDown(screen.getByRole('radio', { name: 'Moss' }), {
            key: 'ArrowLeft',
        });
        expect(onChange).toHaveBeenLastCalledWith('lagoon');
    });

    it('keeps only the checked colour in the tab order', () => {
        renderWithProviders(
            <WhiteboardColorBar value="iris" onChange={vi.fn()} />,
        );

        expect(
            screen
                .getByRole('radio', { name: 'Iris' })
                .getAttribute('tabindex'),
        ).toBe('0');
        expect(
            screen
                .getByRole('radio', { name: 'Plum' })
                .getAttribute('tabindex'),
        ).toBe('-1');
    });

    it('does not report anything when disabled', () => {
        const onChange = vi.fn();
        renderWithProviders(
            <WhiteboardColorBar value="sun" onChange={onChange} disabled />,
        );

        fireEvent.click(screen.getByRole('radio', { name: 'Coral' }));

        expect(onChange).not.toHaveBeenCalled();
    });

    it('exposes its orientation', () => {
        renderWithProviders(
            <WhiteboardColorBar
                value="sun"
                onChange={vi.fn()}
                orientation="vertical"
            />,
        );

        expect(
            screen.getByRole('radiogroup').getAttribute('aria-orientation'),
        ).toBe('vertical');
    });

    it('checks no colour and keeps the first one reachable when the fill is not one of the eight', () => {
        renderWithProviders(
            <WhiteboardColorBar value={null} onChange={vi.fn()} />,
        );

        expect(
            screen
                .getAllByRole('radio')
                .filter(
                    (radio) => radio.getAttribute('aria-checked') === 'true',
                ),
        ).toHaveLength(0);
        expect(
            screen.getByRole('radio', { name: 'Sun' }).getAttribute('tabindex'),
        ).toBe('0');
        expect(
            screen
                .getByRole('radio', { name: 'Apricot' })
                .getAttribute('tabindex'),
        ).toBe('-1');
    });

    it('starts from the first colour with the arrow keys when none is checked', () => {
        const onChange = vi.fn();
        renderWithProviders(
            <WhiteboardColorBar value={null} onChange={onChange} />,
        );

        fireEvent.keyDown(screen.getByRole('radio', { name: 'Sun' }), {
            key: 'ArrowRight',
        });

        expect(onChange).toHaveBeenLastCalledWith('apricot');
    });

    it('reports a press apart from a move of the selection', () => {
        const onChange = vi.fn();
        const onActivate = vi.fn();
        renderWithProviders(
            <WhiteboardColorBar
                value="sun"
                onChange={onChange}
                onActivate={onActivate}
            />,
        );

        fireEvent.keyDown(screen.getByRole('radio', { name: 'Sun' }), {
            key: 'ArrowRight',
        });

        expect(onChange).toHaveBeenLastCalledWith('apricot');
        expect(onActivate).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole('radio', { name: 'Sky' }));

        expect(onChange).toHaveBeenLastCalledWith('sky');
        expect(onActivate).toHaveBeenCalledWith('sky');
    });
});
