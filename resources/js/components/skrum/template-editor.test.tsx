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
    MaxTemplateColumns,
    TemplateEditor,
    findColumnProblems,
    firstFreeColor,
    swapColumnColor,
} from '@/components/skrum/template-editor';
import type {
    TemplateColumnDraft,
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

const serverDraft: TemplateDraft = {
    name: 'Mad Sad Glad',
    category: 'team_mood',
    columns: [
        {
            id: 'a',
            title: 'Mad',
            description: 'What annoyed us?',
            color: 'coral',
        },
        { id: 'b', title: 'Sad', description: null, color: 'sky' },
        { id: 'c', title: 'Glad', color: 'moss' },
    ],
};

const categories = [
    { value: 'essentials', label: 'Essentials' },
    { value: 'team_mood', label: 'Team mood' },
    { value: 'themed', label: 'Themed' },
    { value: 'ideas', label: 'Ideas' },
    { value: 'analysis', label: 'Analysis' },
];

function manyColumns(count: number, title = 'Column'): TemplateColumnDraft[] {
    return Array.from({ length: count }, (_, index) => ({
        id: `c${index}`,
        title: `${title} ${index}`,
        color: columnColors[index % columnColors.length],
    }));
}

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
        expect(firstFreeColor(draft.columns, columnColors)).toBe('sun');
    });

    it('proposes the eight colours by default, then cycles', () => {
        expect(firstFreeColor(serverDraft.columns)).toBe('sun');
        expect(firstFreeColor(manyColumns(7))).toBe('moss');
        expect(firstFreeColor(manyColumns(8))).toBe('sun');
        expect(firstFreeColor(manyColumns(9))).toBe('apricot');
    });

    it('sets the colour without a swap when several columns already share it', () => {
        const columns = manyColumns(10);
        const changed = swapColumnColor(columns, 2, 'sun');

        expect(changed[2].color).toBe('sun');
        expect(changed[0].color).toBe('sun');
        expect(changed[8].color).toBe('sun');
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

    it('warns about a duplicate title without marking the field invalid or blocking the save', async () => {
        const onSave = vi.fn();
        const user = userEvent.setup();

        renderWithProviders(<Harness onSave={onSave} />);

        const third = screen.getByLabelText('Column 3 title');

        await user.clear(third);
        await user.type(third, 'Stop');
        await user.tab();

        const warning = screen.getByText(
            'Another column is already called “Stop”.',
        );

        expect(warning.closest('[role="status"]')).not.toBeNull();
        expect(warning.closest('[role="alert"]')).toBeNull();
        expect(third.getAttribute('aria-invalid')).toBeNull();
        expect(third.getAttribute('aria-describedby')).toBe(
            warning.closest('[role="status"]')?.id,
        );

        await user.click(screen.getByRole('button', { name: 'Save' }));

        expect(onSave).toHaveBeenCalledTimes(1);
        expect(screen.queryByText('1 field to fix')).toBeNull();
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

describe('TemplateEditor server fit', () => {
    it('edits a template that only has what the server stores', () => {
        renderWithProviders(
            <Harness initial={serverDraft} categories={categories} />,
        );

        expect(screen.queryByText('Visibility')).toBeNull();
        expect(screen.queryByText('Default settings')).toBeNull();
        expect(screen.queryByLabelText('Description')).toBeNull();
        expect(screen.queryByRole('switch')).toBeNull();
        expect(
            screen.getByRole('combobox', { name: 'Category' }).textContent,
        ).toContain('Team mood');
        expect(
            (
                screen.getByLabelText(
                    'Column 1 help question',
                ) as HTMLInputElement
            ).value,
        ).toBe('What annoyed us?');
        expect(
            screen.getByRole('button', { name: 'Color: Coral' }),
        ).toBeTruthy();
    });

    it('changes the category', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();

        renderWithProviders(
            <Harness
                initial={serverDraft}
                categories={categories}
                onChange={onChange}
            />,
        );

        await user.click(screen.getByRole('combobox', { name: 'Category' }));
        await user.click(await screen.findByRole('option', { name: 'Ideas' }));

        expect(lastDraft(onChange).category).toBe('ideas');
    });

    it('has no category field without the list of categories', () => {
        renderWithProviders(<Harness initial={serverDraft} />);

        expect(screen.queryByRole('combobox', { name: 'Category' })).toBeNull();
    });

    it('offers to start from an existing template when creating', async () => {
        const onStartFrom = vi.fn();
        const user = userEvent.setup();
        const startFrom = [
            { key: 'start_stop_continue', name: 'Start, Stop, Continue' },
            { key: 'four_ls', name: '4Ls' },
        ];

        const { unmount } = renderWithProviders(
            <Harness
                mode="create"
                initial={serverDraft}
                startFrom={startFrom}
                onStartFrom={onStartFrom}
            />,
        );

        await user.click(
            screen.getByRole('combobox', {
                name: 'Start from a built-in template',
            }),
        );
        await user.click(await screen.findByRole('option', { name: '4Ls' }));

        expect(onStartFrom).toHaveBeenCalledWith('four_ls');

        unmount();
        renderWithProviders(
            <Harness
                mode="edit"
                initial={serverDraft}
                startFrom={startFrom}
                onStartFrom={onStartFrom}
            />,
        );

        expect(
            screen.queryByRole('combobox', {
                name: 'Start from a built-in template',
            }),
        ).toBeNull();
    });

    it('replaces the columns when the parent starts from another template', () => {
        function Starter() {
            const [value, setValue] = useState(serverDraft);

            return (
                <>
                    <button
                        type="button"
                        onClick={() =>
                            setValue({
                                ...value,
                                columns: manyColumns(2, 'Liked'),
                            })
                        }
                    >
                        Load
                    </button>
                    <TemplateEditor
                        mode="create"
                        value={value}
                        onChange={setValue}
                        onSave={() => undefined}
                        onCancel={() => undefined}
                    />
                </>
            );
        }

        renderWithProviders(<Starter />);
        fireEvent.click(screen.getByRole('button', { name: 'Load' }));

        expect(
            (screen.getByLabelText('Column 1 title') as HTMLInputElement).value,
        ).toBe('Liked 0');
        expect(screen.queryByLabelText('Column 3 title')).toBeNull();
        expect(screen.getByText(`2/${MaxTemplateColumns}`)).toBeTruthy();
    });

    it('uses the server limits for the name, titles and descriptions', () => {
        renderWithProviders(<Harness initial={serverDraft} />);

        expect(screen.getByLabelText('Name').getAttribute('maxlength')).toBe(
            '80',
        );
        expect(
            screen.getByLabelText('Column 1 title').getAttribute('maxlength'),
        ).toBe('100');
        expect(
            screen
                .getByLabelText('Column 1 help question')
                .getAttribute('maxlength'),
        ).toBe('200');
    });

    it('maps every server error key to its field and counts them', () => {
        renderWithProviders(
            <Harness
                initial={serverDraft}
                categories={categories}
                errors={{
                    category: 'The selected category is invalid.',
                    columns:
                        'The columns field must not have more than 10 items.',
                    'columns.0.description': 'The description is too long.',
                    'columns.2.color': 'The selected color is invalid.',
                }}
            />,
        );

        const category = screen.getByRole('combobox', { name: 'Category' });
        const description = screen.getByLabelText('Column 1 help question');

        expect(category.getAttribute('aria-invalid')).toBe('true');
        expect(
            document.getElementById(
                category.getAttribute('aria-describedby') ?? '',
            )?.textContent,
        ).toBe('The selected category is invalid.');
        expect(description.getAttribute('aria-invalid')).toBe('true');
        expect(
            document.getElementById(
                description.getAttribute('aria-describedby') ?? '',
            )?.textContent,
        ).toBe('The description is too long.');
        expect(screen.getByText('The selected color is invalid.')).toBeTruthy();
        expect(
            screen.getByText(
                'The columns field must not have more than 10 items.',
            ),
        ).toBeTruthy();
        expect(screen.getByText('4 fields to fix')).toBeTruthy();
    });

    it('edits the description of a column', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();

        renderWithProviders(
            <Harness initial={serverDraft} onChange={onChange} />,
        );

        await user.type(screen.getByLabelText('Column 2 help question'), 'W');

        expect(lastDraft(onChange).columns[1].description).toBe('W');
    });
});

describe('TemplateEditor columns', () => {
    it('edits a nine-column template and still allows one more', () => {
        renderWithProviders(
            <Harness initial={{ ...serverDraft, columns: manyColumns(9) }} />,
        );

        expect(screen.getByText('9/10')).toBeTruthy();
        expect(screen.getByText('1 more available')).toBeTruthy();
        expect(
            (
                screen.getByRole('button', {
                    name: 'Add a column',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(false);
    });

    it('shows ten columns with 100-character titles', () => {
        const title = 'Ce que nous devrions absolument continuer de faire '
            .repeat(2)
            .slice(0, 98);
        const columns = manyColumns(10, title);

        renderWithProviders(<Harness initial={{ ...serverDraft, columns }} />);

        expect(columns[9].title).toHaveLength(100);
        expect(screen.getAllByRole('listitem')).toHaveLength(10);
        expect(
            (screen.getByLabelText('Column 10 title') as HTMLInputElement)
                .value,
        ).toBe(columns[9].title);
        expect(
            within(
                document.querySelector(
                    '[data-slot="template-preview"]',
                ) as HTMLElement,
            ).getByText(columns[9].title),
        ).toBeTruthy();
    });

    it('disables adding at ten columns and explains why', () => {
        const columns = manyColumns(10);

        renderWithProviders(<Harness initial={{ ...draft, columns }} />);

        expect(
            (
                screen.getByRole('button', {
                    name: 'Add a column',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
        expect(
            screen.getByText('You reached the limit of 10 columns.'),
        ).toBeTruthy();
        expect(screen.getByText('10/10')).toBeTruthy();
    });

    it('adds a column with a free colour and focuses its title', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();

        renderWithProviders(
            <Harness onChange={onChange} colors={columnColors} />,
        );

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

    it('does not delete a column when Delete is pressed in its portaled colour popover', async () => {
        const onChange = vi.fn();

        renderWithProviders(<Harness onChange={onChange} />);

        const row = screen
            .getByLabelText('Column 2 title')
            .closest('[data-slot="template-column-row"]') as HTMLElement;
        const trigger = row.querySelector(
            '[data-slot="column-color-trigger"], [aria-haspopup]',
        ) as HTMLElement;

        fireEvent.click(trigger);

        const option = (await screen.findAllByRole('radio')).find(
            (radio) => !row.contains(radio),
        ) as HTMLElement;

        expect(option).toBeTruthy();

        fireEvent.keyDown(option, { key: 'Delete' });

        expect(onChange).not.toHaveBeenCalled();
    });

    it('gives the fields the ids the browser suite binds to, or the ones the host asks for', () => {
        const startFrom = [{ key: 'ssc', name: 'Start, Stop, Continue' }];
        const { unmount } = renderWithProviders(
            <Harness
                initial={serverDraft}
                categories={categories}
                startFrom={startFrom}
                onStartFrom={vi.fn()}
                mode="create"
            />,
        );

        expect(document.getElementById('template-name')?.tagName).toBe('INPUT');
        expect(document.getElementById('template-source')).not.toBeNull();
        expect(document.getElementById('template-category')).not.toBeNull();

        unmount();
        renderWithProviders(
            <Harness
                initial={serverDraft}
                categories={categories}
                ids={{ name: 'copy-name', category: 'copy-category' }}
            />,
        );

        expect(document.getElementById('copy-name')?.tagName).toBe('INPUT');
        expect(document.getElementById('copy-category')).not.toBeNull();
        expect(document.getElementById('template-name')).toBeNull();
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

    it('shows each column of the preview in its colour with its help question, or a dash without one', () => {
        renderWithProviders(
            <Harness
                initial={{
                    ...draft,
                    columns: [
                        {
                            id: 'a',
                            title: 'Kudos',
                            description: 'Who helped you this sprint?',
                            color: 'moss',
                        },
                        { id: 'b', title: 'Stop', color: 'plum' },
                    ],
                }}
            />,
        );

        const preview = within(
            document.querySelector(
                '[data-slot="template-preview"]',
            ) as HTMLElement,
        );
        const kudos = preview.getByText('Kudos').closest('.col-moss');

        expect(kudos).not.toBeNull();
        expect(
            within(kudos as HTMLElement).getByText(
                'Who helped you this sprint?',
            ),
        ).toBeTruthy();
        expect(
            within(
                preview.getByText('Stop').closest('.col-plum') as HTMLElement,
            ).getByText('—'),
        ).toBeTruthy();
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

    it('disables the team option when the person may create for no team', () => {
        renderWithProviders(<Harness teams={[]} />);

        expect(
            (screen.getByRole('radio', { name: 'Team' }) as HTMLButtonElement)
                .disabled,
        ).toBe(true);
    });

    it('preselects the only team without a team select', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();

        renderWithProviders(
            <Harness
                onChange={onChange}
                teams={[{ id: 'atlas', name: 'Atlas' }]}
                initial={{ ...serverDraft, visibility: 'personal' }}
            />,
        );

        await user.click(screen.getByRole('radio', { name: 'Team' }));

        expect(lastDraft(onChange)).toMatchObject({
            visibility: 'team',
            teamId: 'atlas',
        });
        expect(screen.queryByRole('combobox', { name: 'Team' })).toBeNull();
    });

    it('chooses the team in a select when there are two teams or more', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();

        renderWithProviders(
            <Harness
                onChange={onChange}
                teams={[
                    { id: 'atlas', name: 'Atlas' },
                    { id: 'borealis', name: 'Borealis' },
                ]}
                initial={{
                    ...serverDraft,
                    visibility: 'team',
                    teamId: 'atlas',
                }}
            />,
        );

        const select = screen.getByRole('combobox', { name: 'Team' });

        expect(select.id).toBe('template-team');
        expect(select.textContent).toContain('Atlas');

        await user.click(select);
        await user.click(
            await screen.findByRole('option', { name: 'Borealis' }),
        );

        expect(lastDraft(onChange).teamId).toBe('borealis');
    });

    it('shows the server error of the team under its select', () => {
        renderWithProviders(
            <Harness
                teams={[
                    { id: 'atlas', name: 'Atlas' },
                    { id: 'borealis', name: 'Borealis' },
                ]}
                initial={{ ...serverDraft, visibility: 'team', teamId: null }}
                errors={{ team_id: 'The team id field is required.' }}
            />,
        );

        const select = screen.getByRole('combobox', { name: 'Team' });

        expect(select.getAttribute('aria-invalid')).toBe('true');
        expect(
            document.getElementById(
                select.getAttribute('aria-describedby') ?? '',
            )?.textContent,
        ).toBe('The team id field is required.');
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

    it('says one team uses the template in the singular', () => {
        renderWithProviders(
            <Harness
                meta={{
                    editedBy: 'Inès',
                    editedAt: 'two days ago',
                    usedByTeams: 1,
                }}
            />,
        );

        expect(screen.getByText(/1 team uses it/)).toBeTruthy();
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
                        anonymous: true,
                        timers: {},
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

        expect(next.defaults?.votesPerPerson).toBe(1);
        expect(next.defaults?.maxPerCard).toBe(1);
    });

    it('toggles anonymous cards', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();

        renderWithProviders(<Harness onChange={onChange} />);

        await user.click(
            screen.getByRole('switch', { name: 'Anonymous cards' }),
        );

        expect(lastDraft(onChange).defaults?.anonymous).toBe(false);
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

    it('offers only the colours it is given, under their names', async () => {
        const onValueChange = vi.fn();
        const user = userEvent.setup();

        function ServerPicker() {
            const [value, setValue] = useState<ColumnColor>('moss');

            return (
                <ColumnColorPicker
                    value={value}
                    colors={['moss', 'coral', 'sky']}
                    columnTitle="Glad"
                    onValueChange={(color) => {
                        setValue(color);
                        onValueChange(color);
                    }}
                />
            );
        }

        renderWithProviders(<ServerPicker />);

        await user.click(screen.getByRole('button', { name: 'Color: Moss' }));

        expect(
            screen.getAllByRole('radio').map((radio) => radio.textContent),
        ).toEqual(['Moss', 'Coral', 'Sky']);

        await user.keyboard('{End}{Enter}');

        expect(onValueChange).toHaveBeenCalledWith('sky');
    });

    it('is open from the start when asked, and keeps a colour outside the list reachable', () => {
        renderWithProviders(
            <ColumnColorPicker
                value="lagoon"
                colors={['moss', 'coral', 'sky']}
                columnTitle="Ideas"
                defaultOpen
                onValueChange={() => undefined}
            />,
        );

        const radios = screen.getAllByRole('radio');

        expect(radios).toHaveLength(3);
        expect(radios[0].tabIndex).toBe(0);
        expect(
            radios.filter(
                (radio) => radio.getAttribute('aria-checked') === 'true',
            ),
        ).toHaveLength(0);
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
