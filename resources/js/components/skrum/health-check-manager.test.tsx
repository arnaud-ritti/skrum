import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
    HealthStatementsManager,
    reorderedIds,
} from '@/components/skrum/health-check-manager';
import type {
    HealthStatement,
    HealthStatementsManagerProps,
} from '@/components/skrum/health-check-manager';
import { renderWithProviders } from '@/test/render';

const statements: HealthStatement[] = [
    {
        id: 'a',
        key: 'interaction',
        label: 'Interaction',
        text: 'Interaction was productive',
        isBuiltin: true,
        isArchived: false,
    },
    {
        id: 'b',
        key: 'vision',
        label: 'Vision',
        text: 'The vision is clear',
        isBuiltin: true,
        isArchived: true,
    },
    {
        id: 'c',
        key: 'custom-1',
        label: 'Deploys',
        text: 'Deploys felt safe',
        isBuiltin: false,
        isArchived: false,
    },
];

function manager(
    handlers: Pick<
        HealthStatementsManagerProps,
        'onReorder' | 'onAdd' | 'onEdit' | 'onArchive' | 'onRestore'
    >,
    overrides: Partial<HealthStatementsManagerProps> = {},
) {
    return (
        <HealthStatementsManager
            statements={statements}
            canManage
            {...handlers}
            {...overrides}
        />
    );
}

function setup(overrides: Partial<HealthStatementsManagerProps> = {}) {
    const handlers = {
        onReorder: vi.fn(),
        onAdd: vi.fn(),
        onEdit: vi.fn(),
        onArchive: vi.fn(),
        onRestore: vi.fn(),
    };
    const view = renderWithProviders(manager(handlers, overrides));

    return { ...handlers, ...view };
}

function activeRows(): HTMLElement[] {
    return within(
        document.querySelector(
            '[data-slot="health-statements-active"]',
        ) as HTMLElement,
    ).getAllByRole('listitem');
}

describe('HealthStatementsManager', () => {
    it('is a region named by its heading', () => {
        setup();

        expect(
            within(
                screen.getByRole('region', { name: 'Health check statements' }),
            ).getByRole('heading', {
                level: 2,
                name: 'Health check statements',
            }),
        ).toBeTruthy();
    });

    it('lists active statements in the server order with built-in and custom badges', () => {
        setup({ statements: [statements[2], statements[0], statements[1]] });

        const rows = activeRows();

        expect(rows).toHaveLength(2);
        expect(rows[0].textContent).toContain('Deploys');
        expect(rows[1].textContent).toContain('Interaction');
        expect(within(rows[0]).getByText('Custom')).toBeTruthy();
        expect(within(rows[1]).getByText('Built-in')).toBeTruthy();
    });

    it('keeps the accessible names the application exposes today', () => {
        setup({ defaultArchivedOpen: true });

        expect(
            screen.getAllByRole('button', { name: 'Drag to reorder' }),
        ).toHaveLength(2);
        expect(screen.getAllByRole('button', { name: 'Archive' })).toHaveLength(
            2,
        );
        expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(1);
        expect(screen.getByRole('button', { name: 'Restore' })).toBeTruthy();
        expect(
            screen.getByRole('button', { name: 'Add statement' }),
        ).toBeTruthy();
        expect(
            screen.getByRole('button', { name: 'Archived (1)' }),
        ).toBeTruthy();
    });

    it('adds a trimmed statement, within the server limits, and ignores an empty draft', async () => {
        const { onAdd } = setup();
        const add = screen.getByRole('button', { name: 'Add statement' });
        const text = screen.getByLabelText('Statement') as HTMLInputElement;
        const label = screen.getByLabelText('Axis label') as HTMLInputElement;

        expect((add as HTMLButtonElement).disabled).toBe(true);
        expect(text.maxLength).toBe(150);
        expect(label.maxLength).toBe(30);

        await userEvent.type(label, ' Meetings ');
        await userEvent.type(text, 'Our meetings were useful');
        await userEvent.click(add);

        expect(onAdd).toHaveBeenCalledWith({
            label: 'Meetings',
            text: 'Our meetings were useful',
        });
        await waitFor(() => expect(text.value).toBe(''));
    });

    it('keeps the draft and shows the server errors when adding fails', async () => {
        const onAdd = vi.fn().mockResolvedValue(false);
        const { rerender, onReorder, onEdit, onArchive, onRestore } = setup({
            onAdd,
        });
        const handlers = { onReorder, onAdd, onEdit, onArchive, onRestore };

        const text = screen.getByLabelText('Statement') as HTMLInputElement;

        await userEvent.type(screen.getByLabelText('Axis label'), 'Meetings');
        await userEvent.type(text, 'Our meetings were useful');
        expect(screen.queryByRole('alert')).toBeNull();
        await userEvent.click(
            screen.getByRole('button', { name: 'Add statement' }),
        );

        await waitFor(() => expect(onAdd).toHaveBeenCalled());
        rerender(
            manager(handlers, {
                addErrors: { text: 'The text is already used.' },
            }),
        );

        expect(text.value).toBe('Our meetings were useful');
        expect(text.getAttribute('aria-invalid')).toBe('true');
        expect(text.getAttribute('aria-describedby')).toBe(
            screen.getByRole('alert').id,
        );
    });

    it('tells the reorder handles apart by their statement', () => {
        setup();

        const handles = screen.getAllByRole('button', {
            name: 'Drag to reorder',
        });
        const descriptions = handles.map((handle) =>
            (handle.getAttribute('aria-describedby') ?? '')
                .split(' ')
                .map((id) => document.getElementById(id)?.textContent ?? '')
                .join(' '),
        );

        expect(descriptions[0]).toContain('Interaction');
        expect(new Set(descriptions).size).toBe(handles.length);
    });

    it('is read-only without manage rights', () => {
        setup({ canManage: false, defaultArchivedOpen: true });

        expect(
            screen.queryByRole('button', { name: 'Drag to reorder' }),
        ).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Add statement' }),
        ).toBeNull();
        expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Restore' })).toBeNull();
        expect(screen.getByText('The vision is clear')).toBeTruthy();
    });

    it('edits a custom statement inline: focus enters the editor and returns to Edit', async () => {
        const { onEdit } = setup();

        await userEvent.click(screen.getByRole('button', { name: 'Edit' }));

        const text = screen.getAllByLabelText('Statement')[0];

        expect(document.activeElement).toBe(text);

        await userEvent.clear(text);
        await userEvent.type(text, 'Deploys are calm');
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onEdit).toHaveBeenCalledWith('c', {
            label: 'Deploys',
            text: 'Deploys are calm',
        });
        await waitFor(() =>
            expect(document.activeElement).toBe(
                screen.getByRole('button', { name: 'Edit' }),
            ),
        );
    });

    it('returns the focus to Edit when the editor is cancelled with Escape', async () => {
        const { onEdit } = setup();

        await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
        await userEvent.keyboard('{Escape}');

        expect(onEdit).not.toHaveBeenCalled();
        expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
        expect(document.activeElement).toBe(
            screen.getByRole('button', { name: 'Edit' }),
        );
    });

    it('keeps the editor open with its errors when the save is refused', async () => {
        const onEdit = vi.fn().mockResolvedValue(false);
        const { rerender, onReorder, onAdd, onArchive, onRestore } = setup({
            onEdit,
        });
        const handlers = { onReorder, onAdd, onEdit, onArchive, onRestore };

        await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
        expect(screen.queryByRole('alert')).toBeNull();
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() => expect(onEdit).toHaveBeenCalled());
        rerender(
            manager(handlers, {
                editErrors: { label: 'The label is too long.' },
            }),
        );

        expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
        expect(screen.getByRole('alert').textContent).toContain(
            'The label is too long.',
        );
    });

    it('archives a statement and moves the focus to the next row once it left', async () => {
        const handlers = {
            onReorder: vi.fn(),
            onAdd: vi.fn(),
            onArchive: vi.fn(),
            onRestore: vi.fn(),
        };
        const { rerender } = renderWithProviders(manager(handlers));

        await userEvent.click(
            within(activeRows()[0]).getByRole('button', { name: 'Archive' }),
        );

        expect(handlers.onArchive).toHaveBeenCalledWith('a');

        rerender(
            manager(handlers, {
                statements: statements.map((statement) =>
                    statement.id === 'a'
                        ? { ...statement, isArchived: true }
                        : statement,
                ),
            }),
        );

        expect(activeRows()).toHaveLength(1);
        expect(document.activeElement).toBe(
            within(activeRows()[0]).getByRole('button', { name: 'Archive' }),
        );
        expect(
            screen.getByRole('button', { name: 'Archived (2)' }),
        ).toBeTruthy();
    });

    it('restores an archived statement and focuses its active row', async () => {
        const handlers = {
            onReorder: vi.fn(),
            onAdd: vi.fn(),
            onArchive: vi.fn(),
            onRestore: vi.fn(),
        };
        const { rerender } = renderWithProviders(manager(handlers));

        await userEvent.click(
            screen.getByRole('button', { name: 'Archived (1)' }),
        );
        await userEvent.click(screen.getByRole('button', { name: 'Restore' }));

        expect(handlers.onRestore).toHaveBeenCalledWith('b');

        rerender(
            manager(handlers, {
                statements: statements.map((statement) => ({
                    ...statement,
                    isArchived: false,
                })),
            }),
        );

        expect(activeRows()).toHaveLength(3);
        expect(screen.queryByRole('button', { name: /^Archived/ })).toBeNull();
        expect(document.activeElement).toBe(
            within(activeRows()[1]).getByRole('button', { name: 'Archive' }),
        );
    });

    it('picks up the handle with the space key, announces it and cancels with escape', async () => {
        setup();
        const handle = screen.getAllByRole('button', {
            name: 'Drag to reorder',
        })[0];

        handle.focus();
        fireEvent.keyDown(handle, { key: ' ', code: 'Space' });

        await waitFor(() =>
            expect(
                document.querySelector('[id^="DndLiveRegion"]')?.textContent,
            ).toMatch(/Interaction\. Position 1 of 2\./),
        );
        expect(handle.getAttribute('aria-pressed')).toBe('true');
        expect(
            document.querySelector('[data-slot="health-statements-moving"]')
                ?.textContent,
        ).toMatch(/Moving: Interaction\. Position 1 of 2\./);
        fireEvent.keyDown(handle, { key: 'Escape', code: 'Escape' });
        await waitFor(() =>
            expect(
                document.querySelector(
                    '[data-slot="health-statements-moving"]',
                ),
            ).toBeNull(),
        );
    });

    it('lets the form be sent again after a save that throws', async () => {
        const onAdd = vi.fn().mockRejectedValue(new Error('Network down'));
        setup({ onAdd });

        await userEvent.type(screen.getByLabelText('Axis label'), 'Meetings');
        await userEvent.type(
            screen.getByLabelText('Statement'),
            'Our meetings were useful',
        );
        await userEvent.click(
            screen.getByRole('button', { name: 'Add statement' }),
        );

        await waitFor(() => expect(onAdd).toHaveBeenCalled());
        await waitFor(() =>
            expect(
                (
                    screen.getByRole('button', {
                        name: 'Add statement',
                    }) as HTMLButtonElement
                ).disabled,
            ).toBe(false),
        );
        expect(
            (screen.getByLabelText('Statement') as HTMLInputElement).value,
        ).toBe('Our meetings were useful');
    });

    it('shows a list error', () => {
        setup({ error: 'The order could not be saved.' });

        expect(screen.getByRole('alert').textContent).toContain(
            'The order could not be saved.',
        );
    });

    it('shows an empty state without statements, and copes with one and 200', () => {
        const { rerender, onReorder, onAdd, onEdit, onArchive, onRestore } =
            setup({ statements: [] });
        const handlers = { onReorder, onAdd, onEdit, onArchive, onRestore };

        expect(screen.getByText('No statements yet.')).toBeTruthy();

        const many: HealthStatement[] = Array.from(
            { length: 200 },
            (_, index) => ({
                id: `s${index}`,
                label: 'L'.repeat(30),
                text: 'T'.repeat(150),
                isBuiltin: index % 2 === 0,
                isArchived: false,
            }),
        );

        rerender(manager(handlers, { statements: many.slice(0, 1) }));
        expect(activeRows()).toHaveLength(1);

        rerender(manager(handlers, { statements: many }));
        expect(activeRows()).toHaveLength(200);
    });
});

describe('reorderedIds', () => {
    it('moves the active id to the position of the target', () => {
        expect(reorderedIds(['a', 'b', 'c'], 'a', 'c')).toEqual([
            'b',
            'c',
            'a',
        ]);
        expect(reorderedIds(['a', 'b', 'c'], 'c', 'a')).toEqual([
            'c',
            'a',
            'b',
        ]);
    });

    it('returns the same list when nothing moves or an id is unknown', () => {
        const ids = ['a', 'b'];
        expect(reorderedIds(ids, 'a', 'a')).toBe(ids);
        expect(reorderedIds(ids, 'x', 'a')).toBe(ids);
    });
});
