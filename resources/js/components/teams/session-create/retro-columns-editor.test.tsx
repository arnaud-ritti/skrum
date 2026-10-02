import { fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RetroColumnsEditor } from '@/components/teams/session-create/retro-columns-editor';
import type { DraftColumn } from '@/lib/retro/template-adapter';
import { renderWithProviders } from '@/test/render';

const columns: DraftColumn[] = [
    {
        id: 'a',
        title: 'Start',
        description: 'What should begin?',
        color: 'green',
    },
    { id: 'b', title: 'Stop', description: null, color: 'red' },
    { id: 'c', title: 'Continue', description: null, color: 'blue' },
];

function Harness({
    initial = columns,
    max = 10,
    onChange = vi.fn(),
    errors,
}: {
    initial?: DraftColumn[];
    max?: number;
    onChange?: (columns: DraftColumn[]) => void;
    errors?: Record<string, string>;
}) {
    const [value, setValue] = useState(initial);

    return (
        <RetroColumnsEditor
            value={value}
            max={max}
            errors={errors}
            onChange={(next) => {
                setValue(next);
                onChange(next);
            }}
        />
    );
}

function titles(): string[] {
    return screen
        .getAllByRole('textbox')
        .map((input) => (input as HTMLInputElement).value);
}

describe('RetroColumnsEditor', () => {
    it('shows the columns with their count and help text', () => {
        renderWithProviders(<Harness />);

        expect(screen.getByText('Columns · 3')).toBeTruthy();
        expect(titles()).toEqual(['Start', 'Stop', 'Continue']);
        expect(screen.getByText('What should begin?')).toBeTruthy();
    });

    it('renames a column', () => {
        const onChange = vi.fn();

        renderWithProviders(<Harness onChange={onChange} />);

        fireEvent.change(screen.getByLabelText('Column 2 title'), {
            target: { value: 'Pause' },
        });

        expect(onChange).toHaveBeenLastCalledWith([
            columns[0],
            { ...columns[1], title: 'Pause' },
            columns[2],
        ]);
    });

    it('adds a column in the first free colour, selects it and focuses its title', () => {
        const onChange = vi.fn();

        renderWithProviders(<Harness onChange={onChange} />);

        fireEvent.click(screen.getByRole('button', { name: 'Add a column' }));

        const added = onChange.mock.calls[0][0][3];

        expect(added).toMatchObject({
            title: '',
            color: 'amber',
            description: null,
        });
        expect(screen.getByText('Columns · 4')).toBeTruthy();
        expect(document.activeElement).toBe(
            screen.getByLabelText('Column 4 title'),
        );
        expect(
            screen.getByRole('radiogroup', { name: 'Color of “Untitled”' }),
        ).toBeTruthy();
    });

    it('stops adding at the maximum', () => {
        renderWithProviders(<Harness max={3} />);

        expect(
            (
                screen.getByRole('button', {
                    name: 'Add a column',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
        expect(screen.getByText('A board has at most 3 columns.')).toBeTruthy();
    });

    it('recolours the selected column and swaps with the column that had the colour', () => {
        const onChange = vi.fn();

        renderWithProviders(<Harness onChange={onChange} />);

        fireEvent.focus(screen.getByLabelText('Column 2 title'));

        const palette = screen.getByRole('radiogroup', {
            name: 'Color of “Stop”',
        });

        expect(
            palette
                .querySelector('[aria-checked="true"]')
                ?.getAttribute('data-color'),
        ).toBe('red');

        fireEvent.click(
            palette.querySelector('[data-color="purple"]') as HTMLElement,
        );

        expect(onChange.mock.calls[0][0][1].color).toBe('purple');

        fireEvent.click(
            palette.querySelector('[data-color="green"]') as HTMLElement,
        );

        expect(
            onChange.mock.calls[1][0].map(
                (column: DraftColumn) => column.color,
            ),
        ).toEqual(['purple', 'green', 'blue']);
    });

    it('reorders with the keyboard: Space picks up, the arrows move, Space drops', () => {
        const onChange = vi.fn();

        renderWithProviders(<Harness onChange={onChange} />);

        const handle = screen.getByRole('button', {
            name: 'Reorder “Start”, position 1 of 3',
        });

        expect(handle.getAttribute('aria-roledescription')).toBe('sortable');
        expect(handle.hasAttribute('aria-pressed')).toBe(false);

        fireEvent.keyDown(handle, { key: 'ArrowRight' });

        expect(onChange).not.toHaveBeenCalled();

        fireEvent.keyDown(handle, { key: ' ' });

        expect(handle.getAttribute('aria-pressed')).toBe('true');

        fireEvent.keyDown(handle, { key: 'ArrowRight' });
        fireEvent.keyDown(handle, { key: 'ArrowRight' });
        fireEvent.keyDown(handle, { key: 'ArrowRight' });

        expect(titles()).toEqual(['Stop', 'Continue', 'Start']);
        expect(onChange).toHaveBeenCalledTimes(2);

        fireEvent.keyDown(handle, { key: ' ' });

        expect(handle.hasAttribute('aria-pressed')).toBe(false);
        expect(
            document.querySelector('[data-slot="columns-announcement"]')
                ?.textContent,
        ).toBe('“Start” dropped at position 3 of 3');
    });

    it('announces the drop when the focus leaves a picked up column', () => {
        renderWithProviders(<Harness />);

        const handle = screen.getByRole('button', {
            name: 'Reorder “Start”, position 1 of 3',
        });
        const announcement = document.querySelector(
            '[data-slot="columns-announcement"]',
        );

        fireEvent.keyDown(handle, { key: ' ' });
        fireEvent.keyDown(handle, { key: 'ArrowRight' });
        fireEvent.blur(handle);

        expect(handle.hasAttribute('aria-pressed')).toBe(false);
        expect(titles()).toEqual(['Stop', 'Start', 'Continue']);
        expect(announcement?.textContent).toBe(
            '“Start” dropped at position 2 of 3',
        );
        expect(announcement?.hasAttribute('role')).toBe(false);
        expect(announcement?.getAttribute('aria-live')).toBe('assertive');
    });

    it('puts the column back when the move is cancelled with Escape', () => {
        renderWithProviders(<Harness />);

        const handle = screen.getByRole('button', {
            name: 'Reorder “Continue”, position 3 of 3',
        });

        fireEvent.keyDown(handle, { key: 'Enter' });
        fireEvent.keyDown(handle, { key: 'ArrowLeft' });

        expect(titles()).toEqual(['Start', 'Continue', 'Stop']);

        fireEvent.keyDown(window, { key: 'Escape' });

        expect(titles()).toEqual(['Start', 'Stop', 'Continue']);
    });

    it('deletes the selected column, and never the last one', () => {
        const onChange = vi.fn();

        renderWithProviders(
            <Harness initial={columns.slice(0, 2)} onChange={onChange} />,
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Delete column “Start”' }),
        );

        expect(onChange).toHaveBeenLastCalledWith([columns[1]]);
        expect(
            (
                screen.getByRole('button', {
                    name: 'Delete column “Stop”',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });

    it('shows the server errors of the columns', () => {
        renderWithProviders(
            <Harness
                errors={{
                    'columns.1.title': 'The title is required.',
                    title: 'ignored',
                }}
            />,
        );

        expect(screen.getByRole('alert').textContent).toBe(
            'The title is required.',
        );
        expect(
            screen
                .getByLabelText('Column 2 title')
                .getAttribute('aria-invalid'),
        ).toBe('true');
    });

    it('offers only "Add a column" for an empty board', () => {
        renderWithProviders(<Harness initial={[]} />);

        expect(screen.getByText('Columns · 0')).toBeTruthy();
        expect(screen.queryByRole('radiogroup')).toBeNull();
        expect(
            screen.getByRole('button', { name: 'Add a column' }),
        ).toBeTruthy();
    });
});
