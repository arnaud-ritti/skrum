import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    ColumnColorPicker,
    columnColors,
} from '@/components/skrum/column-color-picker';
import type { ColumnColor } from '@/components/skrum/column-color-picker';
import {
    TemplateEditor,
    findColumnProblems,
    firstFreeColor,
    swapColumnColor,
} from '@/components/skrum/template-editor';
import type {
    TemplateDraft,
    TemplateEditorProps,
} from '@/components/skrum/template-editor';
import { renderWithProviders } from '@/test/render';

function lastDraft(mock: ReturnType<typeof vi.fn>): TemplateDraft {
    return mock.mock.calls[mock.mock.calls.length - 1][0] as TemplateDraft;
}

const toastMock = vi.hoisted(() => vi.fn());

vi.mock('sonner', () => ({ toast: toastMock }));

const draft: TemplateDraft = {
    name: 'Start Stop Continue',
    description: 'Classic three columns',
    visibility: 'team',
    columns: [
        { id: 'a', title: 'Start', color: 'sky' },
        { id: 'b', title: 'Stop', color: 'coral' },
        { id: 'c', title: 'Continue', color: 'moss' },
    ],
    defaults: {
        votesPerPerson: 5,
        maxPerCard: 2,
        anonymous: true,
        timers: { writing: 5 },
    },
};

function Harness(
    props: Partial<TemplateEditorProps> & { initial?: TemplateDraft },
) {
    const { initial = draft, onChange, ...rest } = props;
    const [value, setValue] = useState(initial);

    return (
        <TemplateEditor
            mode="edit"
            value={value}
            onChange={(next) => {
                setValue(next);
                onChange?.(next);
            }}
            onSave={() => undefined}
            onCancel={() => undefined}
            {...rest}
        />
    );
}

beforeEach(() => {
    toastMock.mockClear();
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
        },
    );
    window.HTMLElement.prototype.scrollIntoView = () => undefined;
    window.HTMLElement.prototype.hasPointerCapture = () => false;
    window.HTMLElement.prototype.releasePointerCapture = () => undefined;
});

describe('findColumnProblems', () => {
    it('flags empty titles and case and space insensitive duplicates', () => {
        const problems = findColumnProblems([
            { id: '1', title: 'Stop', color: 'sky' },
            { id: '2', title: '  ', color: 'coral' },
            { id: '3', title: ' stop  ', color: 'moss' },
        ]);

        expect(problems[0]).toBeUndefined();
        expect(problems[1]).toEqual({ kind: 'empty' });
        expect(problems[2]).toEqual({ kind: 'duplicate', otherTitle: 'Stop' });
    });
});

describe('colour helpers', () => {
    it('offers eight named colours and proposes a free one first', () => {
        expect(columnColors).toEqual([
            'sun',
            'apricot',
            'coral',
            'plum',
            'iris',
            'sky',
            'lagoon',
            'moss',
        ]);
        expect(firstFreeColor(draft.columns)).toBe('sun');
    });

    it('swaps colours when the chosen one is used by another column', () => {
        const swapped = swapColumnColor(draft.columns, 0, 'coral');

        expect(swapped[0].color).toBe('coral');
        expect(swapped[1].color).toBe('sky');
        expect(swapColumnColor(draft.columns, 0, 'sky')).toBe(draft.columns);
    });
});

describe('TemplateEditor validation', () => {
    it('shows the empty title message and blocks saving, focusing the field', async () => {
        const onSave = vi.fn();
        const user = userEvent.setup();

        renderWithProviders(
            <Harness
                onSave={onSave}
                initial={{
                    ...draft,
                    columns: [
                        ...draft.columns,
                        { id: 'd', title: '', color: 'plum' },
                    ],
                }}
            />,
        );

        expect(screen.queryByText('Give this column a title.')).toBeNull();

        await user.click(screen.getByRole('button', { name: 'Save' }));

        expect(screen.getByText('Give this column a title.')).toBeTruthy();
        expect(onSave).not.toHaveBeenCalled();

        const input = screen.getByLabelText('Column 4 title');

        expect(document.activeElement).toBe(input);
        expect(input.getAttribute('aria-invalid')).toBe('true');
        expect(input.getAttribute('aria-describedby')).toBeTruthy();
        expect(screen.getByText('1 field to fix')).toBeTruthy();
    });

    it('flags a duplicate title ignoring case and spaces', async () => {
        const user = userEvent.setup();

        renderWithProviders(<Harness />);

        const third = screen.getByLabelText('Column 3 title');

        await user.clear(third);
        await user.type(third, '  stop ');
        await user.tab();

        expect(
            screen.getByText('Another column is already called “Stop”.'),
        ).toBeTruthy();
    });

    it('focuses the empty name and does not save', async () => {
        const onSave = vi.fn();
        const user = userEvent.setup();

        renderWithProviders(
            <Harness onSave={onSave} initial={{ ...draft, name: '' }} />,
        );

        await user.click(screen.getByRole('button', { name: 'Save' }));

        expect(screen.getByText('Give this template a name.')).toBeTruthy();
        expect(document.activeElement).toBe(screen.getByLabelText('Name'));
        expect(onSave).not.toHaveBeenCalled();
    });

    it('calls onSave when the draft is valid', async () => {
        const onSave = vi.fn();
        const user = userEvent.setup();

        renderWithProviders(<Harness onSave={onSave} />);

        await user.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('shows server errors for the name and a column with the summary', () => {
        renderWithProviders(
            <Harness
                errors={{
                    name: 'The name has already been taken.',
                    'columns.1.title': 'The columns.1.title field is too long.',
                }}
            />,
        );

        expect(
            screen.getByText('The name has already been taken.'),
        ).toBeTruthy();
        expect(
            screen.getByText('The columns.1.title field is too long.'),
        ).toBeTruthy();
        expect(
            screen.getByText(':count fields to fix'.replace(':count', '2')),
        ).toBeTruthy();
        expect(
            screen
                .getByLabelText('Column 2 title')
                .getAttribute('aria-invalid'),
        ).toBe('true');
    });
});

describe('TemplateEditor columns', () => {
    it('disables adding at eight columns and explains why', () => {
        const columns = Array.from({ length: 8 }, (_, index) => ({
            id: `c${index}`,
            title: `Column ${index}`,
            color: columnColors[index],
        }));

        renderWithProviders(<Harness initial={{ ...draft, columns }} />);

        expect(
            (
                screen.getByRole('button', {
                    name: 'Add a column',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
        expect(
            screen.getByText('You reached the limit of 8 columns.'),
        ).toBeTruthy();
        expect(screen.getByText('8/8')).toBeTruthy();
    });

    it('adds a column with a free colour and focuses its title', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();

        renderWithProviders(<Harness onChange={onChange} />);

        await user.click(screen.getByRole('button', { name: 'Add a column' }));

        const next = lastDraft(onChange);

        expect(next.columns).toHaveLength(4);
        expect(next.columns[3].color).toBe('sun');
        expect(next.columns[3].title).toBe('');
        expect(document.activeElement).toBe(
            screen.getByLabelText('Column 4 title'),
        );
    });

    it('deletes a column with a delete key and offers to undo', async () => {
        const onChange = vi.fn();

        renderWithProviders(<Harness onChange={onChange} />);

        const handle = screen.getByRole('button', {
            name: /Reorder “Stop”/,
        });

        handle.focus();
        fireEvent.keyDown(handle, { key: 'Delete' });

        const next = lastDraft(onChange);

        expect(next.columns.map((column) => column.title)).toEqual([
            'Start',
            'Continue',
        ]);

        const options = toastMock.mock.calls[0][1] as {
            duration: number;
            action: { onClick: () => void };
        };

        expect(options.duration).toBe(5000);

        options.action.onClick();

        const restored = lastDraft(onChange);

        expect(restored.columns.map((column) => column.title)).toEqual([
            'Start',
            'Stop',
            'Continue',
        ]);
    });

    it('does not delete a column when Delete is pressed in a text field', () => {
        const onChange = vi.fn();

        renderWithProviders(<Harness onChange={onChange} />);

        fireEvent.keyDown(screen.getByLabelText('Column 2 title'), {
            key: 'Delete',
        });

        expect(onChange).not.toHaveBeenCalled();
    });

    it('keeps the last column', () => {
        renderWithProviders(
            <Harness initial={{ ...draft, columns: [draft.columns[0]] }} />,
        );

        expect(
            (
                screen.getByRole('button', {
                    name: 'Delete column “Start”',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });

    it('names an empty title Untitled in italic in the preview', () => {
        renderWithProviders(
            <Harness
                initial={{
                    ...draft,
                    columns: [{ id: 'z', title: '', color: 'sun' }],
                }}
            />,
        );

        const preview = document.querySelector(
            '[data-slot="template-preview"]',
        );

        expect(
            within(preview as HTMLElement).getByText('Untitled').className,
        ).toContain('italic');
    });

    it('exposes every handle as a sortable button with its position', () => {
        renderWithProviders(<Harness />);

        const handle = screen.getByRole('button', {
            name: 'Reorder “Start”, position 1 of 3',
        });

        expect(handle.getAttribute('aria-roledescription')).toBe('sortable');
    });
});

describe('TemplateEditor header, visibility and defaults', () => {
    it('disables the workspace option when sharing is not allowed', () => {
        renderWithProviders(<Harness canShareWorkspace={false} />);

        expect(
            (
                screen.getByRole('radio', {
                    name: 'Workspace',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
        expect(
            screen.getByText(
                'Only workspace admins can share templates with the whole workspace.',
            ),
        ).toBeTruthy();
    });

    it('changes the visibility', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();

        renderWithProviders(<Harness onChange={onChange} />);

        await user.click(screen.getByRole('radio', { name: 'Personal' }));

        expect(lastDraft(onChange).visibility).toBe('personal');
    });

    it('shows the meta line with the author', () => {
        renderWithProviders(
            <Harness meta={{ editedBy: 'Inès', editedAt: 'two days ago' }} />,
        );

        expect(screen.getByText(/edited by Inès two days ago/)).toBeTruthy();
    });

    it('steps votes and keeps max per card within the votes per person', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();

        renderWithProviders(
            <Harness
                onChange={onChange}
                initial={{
                    ...draft,
                    defaults: {
                        ...draft.defaults,
                        votesPerPerson: 2,
                        maxPerCard: 2,
                    },
                }}
            />,
        );

        await user.click(
            screen.getByRole('button', { name: 'Decrease Votes per person' }),
        );

        const next = lastDraft(onChange);

        expect(next.defaults.votesPerPerson).toBe(1);
        expect(next.defaults.maxPerCard).toBe(1);
    });

    it('toggles anonymous cards', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();

        renderWithProviders(<Harness onChange={onChange} />);

        await user.click(
            screen.getByRole('switch', { name: 'Anonymous cards' }),
        );

        expect(lastDraft(onChange).defaults.anonymous).toBe(false);
    });
});

describe('TemplateEditor footer', () => {
    it('shows the saving state without allowing a second submit', () => {
        const onSave = vi.fn();

        renderWithProviders(<Harness saving onSave={onSave} />);

        const save = screen.getByRole('button', {
            name: /Save/,
        }) as HTMLButtonElement;

        expect(save.disabled).toBe(true);
        expect(within(save).getByRole('status')).toBeTruthy();
    });

    it('hides delete in create mode and duplicate without a callback', () => {
        renderWithProviders(
            <Harness mode="create" onDelete={() => undefined} />,
        );

        expect(
            screen.queryByRole('button', { name: 'Delete template' }),
        ).toBeNull();
        expect(screen.queryByRole('button', { name: 'Duplicate' })).toBeNull();
    });

    it('asks for confirmation before deleting the template', async () => {
        const onDelete = vi.fn();
        const user = userEvent.setup();

        renderWithProviders(
            <Harness onDelete={onDelete} onDuplicate={() => undefined} />,
        );

        await user.click(
            screen.getByRole('button', { name: 'Delete template' }),
        );

        expect(onDelete).not.toHaveBeenCalled();

        const dialog = await screen.findByRole('alertdialog');

        await user.click(
            within(dialog).getByRole('button', { name: 'Delete template' }),
        );

        await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
    });

    it('calls duplicate and cancel', async () => {
        const onDuplicate = vi.fn();
        const onCancel = vi.fn();
        const user = userEvent.setup();

        renderWithProviders(
            <Harness onDuplicate={onDuplicate} onCancel={onCancel} />,
        );

        await user.click(screen.getByRole('button', { name: 'Duplicate' }));
        await user.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(onDuplicate).toHaveBeenCalledTimes(1);
        expect(onCancel).toHaveBeenCalledTimes(1);
    });
});

describe('ColumnColorPicker', () => {
    function Picker({
        usedBy,
        onValueChange,
    }: {
        usedBy?: Partial<Record<ColumnColor, string>>;
        onValueChange?: (color: ColumnColor) => void;
    }) {
        const [value, setValue] = useState<ColumnColor>('sky');

        return (
            <ColumnColorPicker
                value={value}
                columnTitle="Ideas"
                usedBy={usedBy}
                onValueChange={(color) => {
                    setValue(color);
                    onValueChange?.(color);
                }}
            />
        );
    }

    it('announces the current colour on the trigger and lists the eight colours', async () => {
        const user = userEvent.setup();

        renderWithProviders(<Picker />);

        await user.click(screen.getByRole('button', { name: 'Color: Sky' }));

        expect(screen.getByText('Color of “Ideas”')).toBeTruthy();
        expect(screen.getAllByRole('radio')).toHaveLength(8);
        expect(
            screen
                .getByRole('radio', { name: 'Sky' })
                .getAttribute('aria-checked'),
        ).toBe('true');
    });

    it('marks colours used elsewhere with the owner in the accessible name and a legend', async () => {
        const user = userEvent.setup();

        renderWithProviders(<Picker usedBy={{ moss: 'Bravo' }} />);

        await user.click(screen.getByRole('button', { name: 'Color: Sky' }));

        expect(
            screen.getByRole('radio', { name: 'Moss, used by Bravo' }),
        ).toBeTruthy();
        expect(
            screen.getByText('Used by another column. Pick it to swap colors.'),
        ).toBeTruthy();
    });

    it('moves focus with the arrows, picks with Enter and closes', async () => {
        const onValueChange = vi.fn();
        const user = userEvent.setup();

        renderWithProviders(<Picker onValueChange={onValueChange} />);

        await user.click(screen.getByRole('button', { name: 'Color: Sky' }));
        await user.keyboard('{ArrowRight}');

        expect(document.activeElement).toBe(
            screen.getByRole('radio', { name: 'Lagoon' }),
        );
        expect(onValueChange).not.toHaveBeenCalled();

        await user.keyboard('{Enter}');

        expect(onValueChange).toHaveBeenCalledWith('lagoon');
        await waitFor(() =>
            expect(screen.queryByRole('radio', { name: 'Sky' })).toBeNull(),
        );
        expect(
            screen.getByRole('button', { name: 'Color: Lagoon' }),
        ).toBeTruthy();
    });

    it('returns focus to the trigger on Escape', async () => {
        const user = userEvent.setup();

        renderWithProviders(<Picker />);

        const trigger = screen.getByRole('button', { name: 'Color: Sky' });

        await user.click(trigger);
        await user.keyboard('{Escape}');

        await waitFor(() => expect(document.activeElement).toBe(trigger));
    });
});
