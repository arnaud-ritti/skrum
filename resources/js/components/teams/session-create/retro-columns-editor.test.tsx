import { fireEvent, screen, within } from '@testing-library/react';
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
        color: 'moss',
    },
    { id: 'b', title: 'Stop', description: null, color: 'coral' },
    { id: 'c', title: 'Continue', description: null, color: 'sky' },
];

function Harness({
    initial = columns,
    max = 10,
    onChange = vi.fn(),
    errors,
    template,
}: {
    initial?: DraftColumn[];
    max?: number;
    onChange?: (columns: DraftColumn[]) => void;
    errors?: Record<string, string>;
    template?: { name: string; category: string | null } | null;
}) {
    const [value, setValue] = useState(initial);

    return (
        <RetroColumnsEditor
            value={value}
            max={max}
            errors={errors}
            template={template}
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

    it('names the template and its category above the columns', () => {
        const line = (): string | undefined =>
            document.querySelector('[data-slot="retro-columns-template"]')
                ?.textContent ?? undefined;
        const { unmount } = renderWithProviders(
            <Harness template={{ name: 'Pre-mortem', category: 'Analysis' }} />,
        );

        expect(line()).toBe('Pre-mortem · Analysis');
        unmount();

        const named = renderWithProviders(
            <Harness template={{ name: 'Team pulse', category: null }} />,
        );

        expect(line()).toBe('Team pulse');
        named.unmount();

        renderWithProviders(<Harness template={null} />);

        expect(line()).toBeUndefined();
    });

    it("shows a column's whole title and description", () => {
        const title = '(Hypothetically) The project failed! What went wrong?';
        const description =
            'Imagine the project already failed — describe how it happened';

        renderWithProviders(
            <Harness
                initial={[
                    { id: 'a', title, description, color: 'coral' },
                    { id: 'b', title: 'Stop', description: null, color: 'sky' },
                ]}
            />,
        );

        const field = screen.getByLabelText('Column 1 title');
        const text = screen.getByText(description);
        const [first, second] = Array.from(
            document.querySelectorAll('[data-slot="retro-column-draft"]'),
        );

        expect(field.tagName).toBe('TEXTAREA');
        expect((field as HTMLTextAreaElement).value).toBe(title);

        for (const node of [field, text]) {
            expect(node.className).toContain('break-words');
            expect(node.className).not.toContain('truncate');
            expect(node.className).not.toContain('line-clamp');
        }

        expect(first.className).toContain('col-coral');
        expect(first.children).toHaveLength(2);
        expect(second.children).toHaveLength(1);
    });

    it('keeps a title on one line of text: no line break typed or pasted', () => {
        const onChange = vi.fn();

        renderWithProviders(<Harness onChange={onChange} />);

        const field = screen.getByLabelText('Column 1 title');

        expect(fireEvent.keyDown(field, { key: 'Enter' })).toBe(false);

        fireEvent.change(field, { target: { value: 'Start\nnow' } });

        expect(onChange.mock.calls[0][0][0].title).toBe('Start now');
    });

    it('lays the columns out as a grid and keeps reordering by keyboard', () => {
        renderWithProviders(<Harness />);

        const list = screen.getByRole('list', { name: 'Columns' });

        expect(
            document.querySelector('[data-slot="retro-columns-editor"]')
                ?.className,
        ).toContain('@container/columns');
        expect(list.className).toContain('grid-cols-1');
        expect(list.className).toContain('@xs/columns:grid-cols-2');
        expect(list.className).not.toContain('auto-fit');

        const handle = screen.getByRole('button', {
            name: 'Reorder “Start”, position 1 of 3',
        });

        fireEvent.keyDown(handle, { key: ' ' });
        fireEvent.keyDown(handle, { key: 'ArrowDown' });
        fireEvent.keyDown(handle, { key: ' ' });

        expect(titles()).toEqual(['Stop', 'Start', 'Continue']);
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
            color: 'sun',
            description: null,
        });
        expect(screen.getByText('Columns · 4')).toBeTruthy();
        expect(document.activeElement).toBe(
            screen.getByLabelText('Column 4 title'),
        );
        expect(
            screen.getByRole('radiogroup', { name: 'Colour of “Untitled”' }),
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
            name: 'Colour of “Stop”',
        });

        expect(
            palette
                .querySelector('[aria-checked="true"]')
                ?.getAttribute('data-color'),
        ).toBe('coral');
        expect(palette.textContent).toBe('');
        expect(
            within(palette).getByRole('radio', { name: 'Coral' }),
        ).toBeTruthy();

        fireEvent.click(
            palette.querySelector('[data-color="plum"]') as HTMLElement,
        );

        expect(onChange.mock.calls[0][0][1].color).toBe('plum');

        fireEvent.click(
            palette.querySelector('[data-color="moss"]') as HTMLElement,
        );

        expect(
            onChange.mock.calls[1][0].map(
                (column: DraftColumn) => column.color,
            ),
        ).toEqual(['plum', 'moss', 'sky']);
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

    it('marks the column of any refused field, not only its title', () => {
        renderWithProviders(
            <Harness
                errors={{
                    'columns.0.color': 'The selected colour is invalid.',
                }}
            />,
        );

        expect(
            screen
                .getByLabelText('Column 1 title')
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
