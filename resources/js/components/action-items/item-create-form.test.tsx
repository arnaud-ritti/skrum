import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { NewActionItem } from '@/components/action-items/action-item-adapters';
import { ItemCreateForm } from '@/components/action-items/item-create-form';
import type { ActionItemOwner } from '@/components/skrum/action-item';
import { actionItemFixture, pickDueDate } from '@/test/action-items';
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
        pickDueDate('10/24/2026');
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
        expect(repeat.disabled).toBe(true);

        pickDueDate('10/24/2026');

        expect(repeat.disabled).toBe(false);

        choose('Repeat', 'Monthly');
        pickDueDate('');

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

    it('links the item to the card it is given, and to none once the link is removed for this item', async () => {
        const onCreate = vi.fn(
            async (_values: NewActionItem): Promise<boolean> => true,
        );

        render(
            <ItemCreateForm
                members={members}
                onCreate={onCreate}
                linkedTo="Linked to #2 · Scope changes"
                cardId="card-2"
                unlinkable
            />,
        );

        fireEvent.submit(
            typeTitle('One in, one out').closest('form') as HTMLFormElement,
        );

        await waitFor(() =>
            expect(onCreate).toHaveBeenLastCalledWith(
                expect.objectContaining({ cardId: 'card-2' }),
            ),
        );

        fireEvent.click(
            screen.getByRole('button', {
                name: 'Remove the link to the topic',
            }),
        );

        expect(screen.queryByText('Linked to #2 · Scope changes')).toBeNull();

        fireEvent.submit(
            typeTitle('Ask the PO').closest('form') as HTMLFormElement,
        );

        await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(2));
        expect(onCreate.mock.lastCall?.[0]).not.toHaveProperty('cardId');
        await waitFor(() =>
            expect(
                screen.getByText('Linked to #2 · Scope changes'),
            ).toBeTruthy(),
        );
    });

    it('offers no way to remove a link it was not told could go', () => {
        render(
            <ItemCreateForm
                members={members}
                onCreate={vi.fn()}
                linkedTo="Quick add · linked to “CI”"
                cardId="card-1"
            />,
        );

        expect(
            screen.queryByRole('button', {
                name: 'Remove the link to the topic',
            }),
        ).toBeNull();
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

describe('ItemCreateForm, stacked for a drawer', () => {
    it('picks the assignee among avatar chips and the priority among three segments', async () => {
        const onCreate = vi.fn(async () => true);

        render(
            <ItemCreateForm
                layout="stacked"
                members={members}
                onCreate={onCreate}
            />,
        );

        const assignees = screen.getByRole('radiogroup', { name: 'Assignee' });
        const chips = Array.from(
            assignees.querySelectorAll<HTMLElement>('[role="radio"]'),
        );

        expect(chips.map((chip) => chip.textContent)).toEqual([
            'Unassigned',
            expect.stringContaining('Alice Martin'),
            expect.stringContaining('Bob Stone'),
            expect.stringContaining('Carol Guest (Guest)'),
        ]);
        expect(chips[0].getAttribute('aria-checked')).toBe('true');
        expect(screen.queryByRole('combobox', { name: 'Assignee' })).toBeNull();
        expect(screen.queryByRole('combobox', { name: 'Priority' })).toBeNull();

        const priorities = Array.from(
            screen
                .getByRole('radiogroup', { name: 'Priority' })
                .querySelectorAll<HTMLElement>('[role="radio"]'),
        );

        expect(priorities.map((segment) => segment.textContent)).toEqual([
            'Low',
            'Medium',
            'High',
        ]);
        expect(priorities[1].getAttribute('aria-checked')).toBe('true');

        fireEvent.click(chips[3]);
        fireEvent.click(priorities[2]);

        const field = typeTitle('Timebox the daily');

        fireEvent.submit(field.closest('form') as HTMLFormElement);

        await waitFor(() =>
            expect(onCreate).toHaveBeenCalledWith({
                title: 'Timebox the daily',
                priority: 'high',
                dueDate: null,
                recurrence: null,
                owner: members[2],
            }),
        );
    });

    it('keeps the due date, the repeat and the ticket of the inline form', () => {
        render(
            <ItemCreateForm
                layout="stacked"
                members={members}
                onCreate={vi.fn(async () => true)}
                exportSources={[linear]}
                onCreatedWithTicket={vi.fn()}
            />,
        );

        expect(screen.getByRole('button', { name: /Due date/ })).toBeTruthy();
        expect(screen.getByRole('combobox', { name: 'Repeat' })).toBeTruthy();
        expect(
            screen.getByRole('checkbox', {
                name: 'Create the ticket in Linear',
            }),
        ).toBeTruthy();
    });

    it('keeps what was typed when the members change, and drops an assignee who left', async () => {
        const onCreate = vi.fn(async () => true);
        const { rerender } = render(
            <ItemCreateForm members={members} onCreate={onCreate} />,
        );

        typeTitle('Share the notes');
        choose('Assignee', 'Bob Stone');
        choose('Priority', 'High');

        rerender(<ItemCreateForm members={[members[0]]} onCreate={onCreate} />);

        expect(
            (screen.getByLabelText('Add an action item…') as HTMLInputElement)
                .value,
        ).toBe('Share the notes');
        expect(
            screen.getByRole('combobox', { name: 'Assignee' }).textContent,
        ).toBe('Unassigned');

        fireEvent.click(screen.getByRole('button', { name: 'Create' }));

        await waitFor(() =>
            expect(onCreate).toHaveBeenCalledWith({
                title: 'Share the notes',
                priority: 'high',
                dueDate: null,
                recurrence: null,
                owner: null,
            }),
        );
    });

    it('locks the title while the item is being created', async () => {
        let finish: (created: boolean) => void = () => undefined;
        const onCreate = vi.fn(
            () =>
                new Promise<boolean>((resolve) => {
                    finish = resolve;
                }),
        );

        render(<ItemCreateForm members={members} onCreate={onCreate} />);

        const field = typeTitle('Book the room');

        fireEvent.submit(field.closest('form') as HTMLFormElement);

        await waitFor(() => expect(field.readOnly).toBe(true));

        finish(true);

        await waitFor(() => expect(field.readOnly).toBe(false));
    });
});
