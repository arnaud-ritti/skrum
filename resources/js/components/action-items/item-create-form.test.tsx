import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ItemCreateForm } from '@/components/action-items/item-create-form';
import type { ActionItemOwner } from '@/components/skrum/action-item';
import { actionItemFixture } from '@/test/action-items';
import type { ExportSource } from '@/types/integrations';

const members: ActionItemOwner[] = [
    { id: 'user-1', name: 'Alice Martin', kind: 'member', isTeamMember: true },
    { id: 'user-2', name: 'Bob Stone', kind: 'member', isTeamMember: true },
    { id: 'participant-3', name: 'Carol Guest', kind: 'guest' },
];

const linear: ExportSource = {
    source: 'linear',
    label: 'Linear',
    integrationId: 'integration-1',
};

const jira: ExportSource = {
    source: 'jira',
    label: 'Jira',
    integrationId: 'integration-2',
};

beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn(() => false);
    Element.prototype.releasePointerCapture = vi.fn();
});

function choose(name: string, option: string): void {
    fireEvent.keyDown(screen.getByRole('combobox', { name }), {
        key: 'ArrowDown',
    });
    fireEvent.keyDown(screen.getByRole('option', { name: option }), {
        key: 'Enter',
    });
}

function typeTitle(value: string): HTMLInputElement {
    const field = screen.getByLabelText(
        'Add an action item…',
    ) as HTMLInputElement;

    fireEvent.change(field, { target: { value } });

    return field;
}

describe('ItemCreateForm', () => {
    it('creates a medium, unassigned, undated item by default', async () => {
        const onCreate = vi.fn(async () => true);

        render(<ItemCreateForm members={members} onCreate={onCreate} />);

        const field = typeTitle('  Document the restart ');

        fireEvent.submit(field.closest('form') as HTMLFormElement);

        await waitFor(() =>
            expect(onCreate).toHaveBeenCalledWith({
                title: 'Document the restart',
                priority: 'medium',
                dueDate: null,
                recurrence: null,
                owner: null,
            }),
        );
        await waitFor(() => expect(field.value).toBe(''));
    });

    it('does not create without a title', () => {
        const onCreate = vi.fn(async () => true);

        render(<ItemCreateForm members={members} onCreate={onCreate} />);

        const create = screen.getByRole('button', {
            name: 'Create',
        }) as HTMLButtonElement;

        expect(create.disabled).toBe(true);

        const field = typeTitle('   ');

        fireEvent.submit(field.closest('form') as HTMLFormElement);

        expect(onCreate).not.toHaveBeenCalled();
    });

    it('sends the assignee, the priority, the due date and the recurrence', async () => {
        const onCreate = vi.fn(async () => true);

        render(<ItemCreateForm members={members} onCreate={onCreate} />);

        typeTitle('Add a second runner');
        choose('Assignee', 'Bob Stone');
        choose('Priority', 'High');
        fireEvent.change(screen.getByLabelText('Due date'), {
            target: { value: '2026-10-24' },
        });
        choose('Repeat', 'Weekly');
        fireEvent.click(screen.getByRole('button', { name: 'Create' }));

        await waitFor(() =>
            expect(onCreate).toHaveBeenCalledWith({
                title: 'Add a second runner',
                priority: 'high',
                dueDate: '2026-10-24',
                recurrence: 'weekly',
                owner: members[1],
            }),
        );
    });

    it('offers no recurrence without a due date, and drops it with the date', async () => {
        const onCreate = vi.fn(async () => true);

        render(<ItemCreateForm members={members} onCreate={onCreate} />);

        const repeat = screen.getByRole('combobox', {
            name: 'Repeat',
        }) as HTMLButtonElement;
        const due = screen.getByLabelText('Due date');

        expect(repeat.disabled).toBe(true);

        fireEvent.change(due, { target: { value: '2026-10-24' } });

        expect(repeat.disabled).toBe(false);

        choose('Repeat', 'Monthly');
        fireEvent.change(due, { target: { value: '' } });

        expect(repeat.disabled).toBe(true);

        typeTitle('Tidy the backlog');
        fireEvent.click(screen.getByRole('button', { name: 'Create' }));

        await waitFor(() =>
            expect(onCreate).toHaveBeenCalledWith(
                expect.objectContaining({ dueDate: null, recurrence: null }),
            ),
        );
    });

    it('names a guest with the label of the component', () => {
        render(<ItemCreateForm members={members} onCreate={vi.fn()} />);

        fireEvent.keyDown(screen.getByRole('combobox', { name: 'Assignee' }), {
            key: 'ArrowDown',
        });

        expect(
            screen.getByRole('option', { name: 'Carol Guest (Guest)' }),
        ).toBeTruthy();
        expect(screen.getByRole('option', { name: 'Unassigned' })).toBeTruthy();
    });

    it('keeps what was typed when the creation fails', async () => {
        const onCreate = vi.fn(async () => false);

        render(<ItemCreateForm members={members} onCreate={onCreate} />);

        const field = typeTitle('Add a second runner');

        fireEvent.submit(field.closest('form') as HTMLFormElement);

        await waitFor(() => expect(onCreate).toHaveBeenCalled());
        await waitFor(() =>
            expect(
                (
                    screen.getByRole('button', {
                        name: 'Create',
                    }) as HTMLButtonElement
                ).disabled,
            ).toBe(false),
        );
        expect(field.value).toBe('Add a second runner');
    });

    it('puts the id the page asks for on the title field', () => {
        render(
            <ItemCreateForm
                members={members}
                onCreate={vi.fn()}
                ids={{ title: 'topic-action-title' }}
            />,
        );

        expect(screen.getByLabelText('Add an action item…').id).toBe(
            'topic-action-title',
        );
    });

    it('has no ticket option without an export source', () => {
        render(<ItemCreateForm members={members} onCreate={vi.fn()} />);

        expect(screen.queryByRole('checkbox')).toBeNull();
        expect(screen.queryByRole('combobox', { name: 'Ticket' })).toBeNull();
    });

    it('creates the item, then hands it over for its ticket', async () => {
        const created = actionItemFixture({ id: 'item-9' });
        const onCreate = vi.fn(async () => created);
        const onCreatedWithTicket = vi.fn();

        render(
            <ItemCreateForm
                members={members}
                onCreate={onCreate}
                exportSources={[linear]}
                onCreatedWithTicket={onCreatedWithTicket}
            />,
        );

        typeTitle('Add a second runner');
        fireEvent.click(
            screen.getByRole('checkbox', {
                name: 'Create the ticket in Linear',
            }),
        );
        fireEvent.click(screen.getByRole('button', { name: 'Create' }));

        await waitFor(() =>
            expect(onCreatedWithTicket).toHaveBeenCalledWith(created, linear),
        );
        expect(
            screen
                .getByRole('checkbox', { name: 'Create the ticket in Linear' })
                .getAttribute('aria-checked'),
        ).toBe('false');
    });

    it('asks for no ticket when the box is left empty or the creation fails', async () => {
        const onCreatedWithTicket = vi.fn();
        const onCreate = vi
            .fn()
            .mockResolvedValueOnce(actionItemFixture())
            .mockResolvedValueOnce(false);

        render(
            <ItemCreateForm
                members={members}
                onCreate={onCreate}
                exportSources={[linear]}
                onCreatedWithTicket={onCreatedWithTicket}
            />,
        );

        typeTitle('First');
        fireEvent.click(screen.getByRole('button', { name: 'Create' }));

        await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));

        typeTitle('Second');
        fireEvent.click(
            screen.getByRole('checkbox', {
                name: 'Create the ticket in Linear',
            }),
        );
        fireEvent.click(screen.getByRole('button', { name: 'Create' }));

        await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(2));
        expect(onCreatedWithTicket).not.toHaveBeenCalled();
    });

    it('lets the author pick the tracker when the team has several', async () => {
        const created = actionItemFixture();
        const onCreatedWithTicket = vi.fn();

        render(
            <ItemCreateForm
                members={members}
                onCreate={vi.fn(async () => created)}
                exportSources={[linear, jira]}
                onCreatedWithTicket={onCreatedWithTicket}
            />,
        );

        typeTitle('Add a second runner');
        choose('Ticket', 'Create the ticket in Jira');
        fireEvent.click(screen.getByRole('button', { name: 'Create' }));

        await waitFor(() =>
            expect(onCreatedWithTicket).toHaveBeenCalledWith(created, jira),
        );
    });

    it('can be cancelled when its host gives it a way out', () => {
        const onCancel = vi.fn();

        const { rerender } = render(
            <ItemCreateForm members={members} onCreate={vi.fn()} />,
        );

        expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();

        rerender(
            <ItemCreateForm
                members={members}
                onCreate={vi.fn()}
                onCancel={onCancel}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(onCancel).toHaveBeenCalled();
    });

    it('is disabled on a board that takes no change, and warns on an anonymous one', () => {
        render(
            <ItemCreateForm
                members={members}
                onCreate={vi.fn()}
                disabled
                showAnonymousNotice
            />,
        );

        expect(
            (screen.getByLabelText('Add an action item…') as HTMLInputElement)
                .disabled,
        ).toBe(true);
        expect(
            screen.getByText(
                'Action items are not anonymous: your name is shown.',
            ),
        ).toBeTruthy();
    });
});
