import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
    ColumnColorOptions,
    columnColors,
} from '@/components/skrum/column-color-picker';
import { renderWithProviders } from '@/test/render';

function renderSwatches(
    props: Partial<Parameters<typeof ColumnColorOptions>[0]> = {},
) {
    const onValueChange = vi.fn();

    renderWithProviders(
        <ColumnColorOptions
            labels="tooltip"
            value="coral"
            onValueChange={onValueChange}
            colors={columnColors}
            columnTitle="Stop"
            {...props}
        />,
    );

    return { onValueChange };
}

describe('ColumnColorOptions, swatches alone', () => {
    it('shows no colour name, and keeps it as the accessible name of each swatch', () => {
        renderSwatches();

        const radios = screen.getAllByRole('radio');

        expect(
            screen.getByRole('radiogroup', { name: 'Color of “Stop”' }),
        ).toBeTruthy();
        expect(radios).toHaveLength(8);
        expect(radios.map((radio) => radio.textContent)).toEqual(
            Array.from({ length: 8 }, () => ''),
        );
        expect(
            screen
                .getByRole('radio', { name: 'Coral' })
                .getAttribute('aria-checked'),
        ).toBe('true');
    });

    it('names the colour in a tooltip on focus', async () => {
        const user = userEvent.setup();

        renderSwatches();

        await user.tab();

        expect((await screen.findByRole('tooltip')).textContent).toBe('Coral');
    });

    it('moves with the arrow keys, Home and End, and selects on click', () => {
        const { onValueChange } = renderSwatches();
        const coral = screen.getByRole('radio', { name: 'Coral' });

        expect(coral.tabIndex).toBe(0);
        expect(screen.getByRole('radio', { name: 'Sun' }).tabIndex).toBe(-1);

        fireEvent.keyDown(coral, { key: 'ArrowRight' });
        expect(document.activeElement).toBe(
            screen.getByRole('radio', { name: 'Plum' }),
        );

        fireEvent.keyDown(document.activeElement as Element, { key: 'End' });
        expect(document.activeElement).toBe(
            screen.getByRole('radio', { name: 'Moss' }),
        );

        fireEvent.keyDown(document.activeElement as Element, { key: 'Home' });
        expect(document.activeElement).toBe(
            screen.getByRole('radio', { name: 'Sun' }),
        );

        fireEvent.click(screen.getByRole('radio', { name: 'Sky' }));
        expect(onValueChange).toHaveBeenCalledWith('sky');
    });

    it('marks a colour another column uses, in the name and in the tooltip', async () => {
        const user = userEvent.setup();

        renderSwatches({ value: 'sun', usedBy: { sun: 'Start' } });

        const taken = screen.getByRole('radio', {
            name: 'Sun, used by Start',
        });

        expect(taken.querySelector('[data-slot="used-dot"]')).toBeTruthy();
        expect(
            screen.getByText('Used by another column. Pick it to swap colors.'),
        ).toBeTruthy();

        await user.tab();

        expect((await screen.findByRole('tooltip')).textContent).toBe(
            'Sun, used by Start',
        );
    });
});
