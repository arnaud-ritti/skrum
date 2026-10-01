import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
    HealthStatementsManager,
    reorderedIds,
} from '@/components/skrum/health-check-manager';
import type { HealthStatement } from '@/components/skrum/health-check-manager';
import { renderWithProviders } from '@/test/render';

const statements: HealthStatement[] = [
    {
        id: 'a',
        label: 'Interaction',
        text: 'Interaction was productive',
        builtIn: true,
        enabled: true,
        position: 1,
    },
    {
        id: 'b',
        label: 'Vision',
        text: 'The vision is clear',
        builtIn: true,
        enabled: false,
        position: 2,
    },
    {
        id: 'c',
        label: 'Deploys',
        text: 'Deploys felt safe',
        builtIn: false,
        enabled: true,
        position: 3,
    },
];

function setup(
    overrides: Partial<Parameters<typeof HealthStatementsManager>[0]> = {},
) {
    const handlers = {
        onToggle: vi.fn(),
        onReorder: vi.fn(),
        onAdd: vi.fn(),
        onEdit: vi.fn(),
        onDelete: vi.fn(),
    };
    renderWithProviders(
        <HealthStatementsManager
            statements={statements}
            canManage
            {...handlers}
            {...overrides}
        />,
    );

    return handlers;
}

describe('HealthStatementsManager', () => {
    it('lists statements by position with built-in, custom and disabled badges', () => {
        setup({ statements: [statements[2], statements[0], statements[1]] });

        const rows = screen.getAllByRole('listitem');
        expect(
            rows.map((row) => within(row).getAllByText(/./)[0].textContent),
        ).toEqual(expect.arrayContaining(['Interaction']));
        expect(rows[0].textContent).toContain('Interaction');
        expect(rows[2].textContent).toContain('Deploys');
        expect(within(rows[0]).getByText('Built-in')).toBeTruthy();
        expect(within(rows[2]).getByText('Custom')).toBeTruthy();
        expect(within(rows[1]).getByText('Disabled')).toBeTruthy();
    });

    it('toggles a statement through a switch named by its label', async () => {
        const { onToggle } = setup();

        await userEvent.click(screen.getByRole('switch', { name: 'Vision' }));

        expect(onToggle).toHaveBeenCalledWith('b', true);
    });

    it('adds a trimmed statement and ignores an empty draft', async () => {
        const { onAdd } = setup();
        const add = screen.getByRole('button', { name: 'Add' });

        expect((add as HTMLButtonElement).disabled).toBe(true);

        await userEvent.type(
            screen.getByLabelText('Short label'),
            ' Meetings ',
        );
        await userEvent.type(
            screen.getByLabelText(
                'New statement, e.g. Our meetings were useful',
            ),
            'Our meetings were useful',
        );
        await userEvent.click(add);

        expect(onAdd).toHaveBeenCalledWith({
            label: 'Meetings',
            text: 'Our meetings were useful',
        });
    });

    it('is read-only without manage rights', () => {
        setup({ canManage: false });

        expect(screen.queryByRole('button', { name: /Reorder/ })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Add' })).toBeNull();
        expect(
            (
                screen.getByRole('switch', {
                    name: 'Interaction',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });

    it('offers the actions menu on custom statements only', () => {
        setup();

        expect(
            screen.getAllByRole('button', { name: /^Actions:/ }),
        ).toHaveLength(1);
        expect(
            screen.getByRole('button', { name: 'Actions: Deploys' }),
        ).toBeTruthy();
    });

    it('edits a custom statement inline', async () => {
        const { onEdit } = setup();

        await userEvent.click(
            screen.getByRole('button', { name: 'Actions: Deploys' }),
        );
        await userEvent.click(
            await screen.findByRole('menuitem', { name: 'Edit' }),
        );
        const text = screen.getAllByLabelText('Statement')[0];
        await userEvent.clear(text);
        await userEvent.type(text, 'Deploys are calm');
        await userEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onEdit).toHaveBeenCalledWith('c', {
            label: 'Deploys',
            text: 'Deploys are calm',
        });
    });

    it('deletes a custom statement after confirmation', async () => {
        const { onDelete } = setup();

        await userEvent.click(
            screen.getByRole('button', { name: 'Actions: Deploys' }),
        );
        await userEvent.click(
            await screen.findByRole('menuitem', { name: 'Delete' }),
        );
        const dialog = await screen.findByRole('alertdialog');
        expect(onDelete).not.toHaveBeenCalled();
        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Delete' }),
        );

        await waitFor(() => expect(onDelete).toHaveBeenCalledWith('c'));
    });

    it('picks up the handle with the space key, announces it and cancels with escape', async () => {
        setup();
        const handle = screen.getByRole('button', {
            name: 'Reorder: Interaction',
        });

        handle.focus();
        fireEvent.keyDown(handle, { key: ' ', code: 'Space' });

        await waitFor(() =>
            expect(
                document.querySelector('[id^="DndLiveRegion"]')?.textContent,
            ).toMatch(/Interaction\. Position 1 of 3\./),
        );
        expect(handle.getAttribute('aria-pressed')).toBe('true');
        expect(
            document.querySelector('[data-slot="health-statements-moving"]')
                ?.textContent,
        ).toMatch(/Moving: Interaction\. Position 1 of 3\./);
        fireEvent.keyDown(handle, { key: 'Escape', code: 'Escape' });
        await waitFor(() =>
            expect(
                document.querySelector(
                    '[data-slot="health-statements-moving"]',
                ),
            ).toBeNull(),
        );
    });

    it('shows an empty state without statements', () => {
        setup({ statements: [] });

        expect(screen.getByText('No statements yet.')).toBeTruthy();
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
