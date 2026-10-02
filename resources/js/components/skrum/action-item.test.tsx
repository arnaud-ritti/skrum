import { fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
    ActionItem,
    groupActionOwners,
    actionOwnerValue,
    isActionOverdue,
    nextActionStatus,
    resolveActionOverdue,
} from '@/components/skrum/action-item';
import type {
    ActionItemLink,
    ActionItemProps,
} from '@/components/skrum/action-item';
import { renderWithProviders } from '@/test/render';

const base = {
    title: 'Limit PRs to 400 lines',
    status: 'open' as const,
    priority: 'high' as const,
    today: '2026-10-10',
};

const providers = ['jira', 'linear', 'jira_dc', 'github'] as const;

function makeLinks(count: number): ActionItemLink[] {
    return Array.from({ length: count }, (_, index) => ({
        id: `l${index}`,
        source: providers[index % providers.length],
        key: `KEY-${index}`,
        url: `https://example.test/KEY-${index}`,
    }));
}

function Editable(props: Partial<ActionItemProps>) {
    const [editing, setEditing] = useState(false);

    return (
        <ActionItem
            {...base}
            {...props}
            editing={editing}
            onEditStart={() => setEditing(true)}
            onEditCancel={() => setEditing(false)}
            onChange={(patch) => {
                props.onChange?.(patch);
                setEditing(false);
            }}
        />
    );
}

describe('ActionItem logic', () => {
    it('cycles status, with doing only when enabled', () => {
        expect(nextActionStatus('open', false)).toBe('completed');
        expect(nextActionStatus('open', true)).toBe('doing');
        expect(nextActionStatus('doing', true)).toBe('completed');
        expect(nextActionStatus('completed', true)).toBe('open');
    });

    it('is overdue only when past due and not completed', () => {
        expect(isActionOverdue('2026-10-09', 'open', '2026-10-10')).toBe(true);
        expect(isActionOverdue('2026-10-10', 'open', '2026-10-10')).toBe(false);
        expect(isActionOverdue('2026-10-09', 'completed', '2026-10-10')).toBe(
            false,
        );
        expect(isActionOverdue(null, 'open', '2026-10-10')).toBe(false);
    });

    it('lets the server flag win over the computed overdue state', () => {
        const past = { dueDate: '2026-10-09', today: '2026-10-10' };

        expect(
            resolveActionOverdue({ ...past, status: 'open', overdue: false }),
        ).toBe(false);
        expect(
            resolveActionOverdue({
                dueDate: '2099-01-01',
                today: '2026-10-10',
                status: 'open',
                overdue: true,
            }),
        ).toBe(true);
        expect(
            resolveActionOverdue({
                ...past,
                status: 'completed',
                overdue: true,
            }),
        ).toBe(false);
    });

    it('tells a member from a guest with the same id', () => {
        expect(actionOwnerValue(null)).toBe('none');
        expect(actionOwnerValue({ id: '1', name: 'A' })).toBe('member:1');
        expect(actionOwnerValue({ id: '1', name: 'A', kind: 'guest' })).toBe(
            'guest:1',
        );
    });
});

describe('ActionItem', () => {
    it('completes with the accessible name the browser tests use', () => {
        const onStatusChange = vi.fn();
        renderWithProviders(
            <ActionItem {...base} onStatusChange={onStatusChange} />,
        );

        expect(screen.getByText('High')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Mark as done' }));
        expect(onStatusChange).toHaveBeenCalledWith('completed');
    });

    it('strikes a completed title and offers to reopen', () => {
        const onStatusChange = vi.fn();
        renderWithProviders(
            <ActionItem
                {...base}
                status="completed"
                doneAt="2026-09-22"
                completedVia="jira_dc"
                onStatusChange={onStatusChange}
            />,
        );

        expect(
            screen.getByText(base.title).className.includes('line-through'),
        ).toBe(true);
        expect(screen.getByText('Completed in Jira Data Center')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Reopen' }));
        expect(onStatusChange).toHaveBeenCalledWith('open');
    });

    it('goes through doing only when asked', () => {
        const onStatusChange = vi.fn();
        renderWithProviders(
            <ActionItem {...base} withDoing onStatusChange={onStatusChange} />,
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Mark as in progress' }),
        );
        expect(onStatusChange).toHaveBeenCalledWith('doing');
    });

    it('disables completion without the right to complete', () => {
        const onStatusChange = vi.fn();
        const { rerender } = renderWithProviders(
            <ActionItem
                {...base}
                canComplete={false}
                onStatusChange={onStatusChange}
            />,
        );
        const button = screen.getByRole('button', { name: 'Mark as done' });

        expect((button as HTMLButtonElement).disabled).toBe(true);
        fireEvent.keyDown(screen.getByRole('listitem'), { key: ' ' });
        expect(onStatusChange).not.toHaveBeenCalled();

        rerender(<ActionItem {...base} busy onStatusChange={onStatusChange} />);
        expect(
            (
                screen.getByRole('button', {
                    name: 'Mark as done',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });

    it('flags an overdue item in text', () => {
        renderWithProviders(<ActionItem {...base} dueDate="2026-09-26" />);

        expect(screen.getAllByText(/Overdue/).length).toBeGreaterThan(0);
        expect(screen.getByRole('listitem').getAttribute('data-overdue')).toBe(
            'true',
        );
    });

    it('passes the DOM id and other attributes through', () => {
        renderWithProviders(
            <ActionItem {...base} id="action-item-42" data-test="row" />,
        );
        const row = screen.getByRole('listitem');

        expect(row.id).toBe('action-item-42');
        expect(row.getAttribute('data-test')).toBe('row');
    });

    it('shows every external link with its provider and sync state', () => {
        const onRetrySync = vi.fn();
        const links: ActionItemLink[] = [
            {
                id: 'l1',
                source: 'jira',
                key: 'ATLAS-1287',
                url: 'https://example.test/ATLAS-1287',
            },
            {
                id: 'l2',
                source: 'github',
                key: 'skrum#12',
                url: 'https://example.test/12',
                state: 'done',
                statusName: 'Closed',
                syncState: 'synced',
            },
            {
                id: 'l3',
                source: 'linear',
                key: 'ENG-42',
                url: 'https://example.test/ENG-42',
                syncState: 'failed',
                syncError: 'Token expired',
            },
        ];
        renderWithProviders(
            <ActionItem {...base} links={links} onRetrySync={onRetrySync} />,
        );

        const jira = screen.getByRole('link', {
            name: 'Open ATLAS-1287 in Jira',
        });
        expect(jira.getAttribute('target')).toBe('_blank');
        expect(jira.getAttribute('rel')).toContain('noopener');
        expect(
            screen.getByRole('link', {
                name: 'Open skrum#12 in GitHub · Closed in GitHub',
            }),
        ).toBeTruthy();
        expect(
            screen.getByRole('link', {
                name: 'Open ENG-42 in Linear · Sync failed: Token expired',
            }),
        ).toBeTruthy();

        fireEvent.click(
            screen.getByRole('button', { name: 'Retry the sync of ENG-42' }),
        );
        expect(onRetrySync).toHaveBeenCalledWith(links[2]);
        expect(
            screen.queryByRole('button', {
                name: 'Retry the sync of ATLAS-1287',
            }),
        ).toBeNull();
    });

    it('offers to link a ticket only without links and with a callback', () => {
        const onLinkTicket = vi.fn();
        const { rerender } = renderWithProviders(<ActionItem {...base} />);
        expect(screen.queryByText('Link a ticket')).toBeNull();

        rerender(<ActionItem {...base} onLinkTicket={onLinkTicket} />);
        fireEvent.click(screen.getByText('Link a ticket'));
        expect(onLinkTicket).toHaveBeenCalled();

        rerender(
            <ActionItem
                {...base}
                links={makeLinks(1)}
                onLinkTicket={onLinkTicket}
            />,
        );
        expect(screen.queryByText('Link a ticket')).toBeNull();
    });

    it('marks a missing owner as unassigned and a guest as a guest', () => {
        const { rerender } = renderWithProviders(<ActionItem {...base} />);

        expect(screen.getByRole('img', { name: 'Unassigned' })).toBeTruthy();

        rerender(
            <ActionItem
                {...base}
                owner={{ id: 'p1', name: 'Zoe', kind: 'guest' }}
            />,
        );
        expect(screen.getByRole('img', { name: 'Zoe (Guest)' })).toBeTruthy();
    });

    it('shows recurrence, sub-task progress, creator, theme and page meta', () => {
        renderWithProviders(
            <ActionItem
                {...base}
                dueDate="2099-10-10"
                recurrence="every_two_weeks"
                followUpDate="2026-09-01"
                subtasks={[
                    { isCompleted: true },
                    { isCompleted: false },
                    { isCompleted: true },
                ]}
                createdBy={null}
                themeName="Reviews"
                teamName="Platform"
                source={{ label: 'Sprint 42', url: '/retros/r1' }}
                meta={<span>page meta</span>}
            />,
        );

        expect(screen.getByText(/Repeats every 2 weeks/)).toBeTruthy();
        expect(
            screen.getByText(/Follows up the item completed on/),
        ).toBeTruthy();
        expect(screen.getByText('2 of 3 sub-tasks done')).toBeTruthy();
        expect(screen.getByText('Former member')).toBeTruthy();
        expect(screen.getByText('Theme: Reviews')).toBeTruthy();
        expect(screen.getByText('Platform')).toBeTruthy();
        expect(
            screen
                .getByRole('link', { name: 'Sprint 42' })
                .getAttribute('href'),
        ).toBe('/retros/r1');
        expect(screen.getByText('page meta')).toBeTruthy();
    });

    it('leaves out what the back end did not send', () => {
        renderWithProviders(<ActionItem {...base} />);

        expect(screen.queryByText('Former member')).toBeNull();
        expect(screen.queryByText(/comment/)).toBeNull();
        expect(screen.queryByText(/sub-tasks/)).toBeNull();
        expect(screen.queryByRole('link')).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Edit action item' }),
        ).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Delete action item' }),
        ).toBeNull();
    });

    it('toggles the comment thread slot', () => {
        const onToggleComments = vi.fn();
        const props = {
            ...base,
            id: 'action-item-7',
            commentCount: 1,
            comments: <p>thread</p>,
            onToggleComments,
        };
        const { rerender } = renderWithProviders(<ActionItem {...props} />);
        const toggle = screen.getByRole('button', { name: '1 comment' });

        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(screen.queryByText('thread')).toBeNull();
        fireEvent.click(toggle);
        expect(onToggleComments).toHaveBeenCalled();

        rerender(<ActionItem {...props} commentCount={3} commentsOpen />);
        const open = screen.getByRole('button', { name: '3 comments' });
        expect(open.getAttribute('aria-expanded')).toBe('true');
        expect(open.getAttribute('aria-controls')).toBe(
            'action-item-7-comments',
        );
        expect(
            document.getElementById('action-item-7-comments')?.textContent,
        ).toBe('thread');
    });

    it('renders the checklist and export slots and deletes with a label', () => {
        const onDelete = vi.fn();
        renderWithProviders(
            <ActionItem
                {...base}
                actions={<button type="button">Export</button>}
                onDelete={onDelete}
            >
                <p>checklist</p>
            </ActionItem>,
        );

        expect(screen.getByText('checklist')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Export' })).toBeTruthy();
        const remove = screen.getByRole('button', {
            name: 'Delete action item',
        });
        expect(remove.textContent).toBe('Delete');
        fireEvent.click(remove);
        expect(onDelete).toHaveBeenCalled();
    });

    it('handles Space and Enter on the row', () => {
        const onStatusChange = vi.fn();
        const onEditStart = vi.fn();
        renderWithProviders(
            <ActionItem
                {...base}
                onStatusChange={onStatusChange}
                onEditStart={onEditStart}
            />,
        );
        const row = screen.getByRole('listitem');

        fireEvent.keyDown(row, { key: ' ' });
        fireEvent.keyDown(row, { key: 'Enter' });

        expect(onStatusChange).toHaveBeenCalledWith('completed');
        expect(onEditStart).toHaveBeenCalled();
    });

    it('saves with Ctrl+Enter, cancels with Escape, and rejects an empty title', () => {
        const onChange = vi.fn();
        const onEditCancel = vi.fn();
        renderWithProviders(
            <ActionItem
                {...base}
                editing
                onChange={onChange}
                onEditCancel={onEditCancel}
            />,
        );
        const input = screen.getByLabelText('Action title');

        expect((input as HTMLInputElement).maxLength).toBe(500);
        fireEvent.change(input, { target: { value: '  ' } });
        fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
        expect(onChange).not.toHaveBeenCalled();

        fireEvent.change(input, { target: { value: 'New title' } });
        fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
        expect(onChange).toHaveBeenCalledWith({
            title: 'New title',
            priority: 'high',
            dueDate: null,
        });

        fireEvent.keyDown(input, { key: 'Escape' });
        expect(onEditCancel).toHaveBeenCalled();
    });

    it('keeps an assignee who is not in the list and drops recurrence without a due date', () => {
        const onChange = vi.fn();
        renderWithProviders(
            <ActionItem
                {...base}
                editing
                dueDate="2099-10-10"
                recurrence="weekly"
                owner={{ id: 'p9', name: 'Guest Zoe', kind: 'guest' }}
                members={[{ id: 'u1', name: 'Ines' }]}
                onChange={onChange}
            />,
        );

        fireEvent.change(screen.getByLabelText('Due date'), {
            target: { value: '' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onChange).toHaveBeenCalledWith({
            title: base.title,
            priority: 'high',
            dueDate: null,
            recurrence: null,
        });
    });

    it('lists the assignee options under the heading of their group, a guest marked as one', () => {
        expect(
            groupActionOwners([
                { id: 'u1', name: 'Ines', group: 'In this retro' },
                { id: 'u2', name: 'Dan', group: 'Team' },
                {
                    id: 'p1',
                    name: 'Zoe',
                    kind: 'guest',
                    group: 'In this retro',
                },
            ]).map((group) => [
                group.label,
                group.members.map((member) => member.name),
            ]),
        ).toEqual([
            ['In this retro', ['Ines', 'Zoe']],
            ['Team', ['Dan']],
        ]);
        expect(groupActionOwners([{ id: 'u1', name: 'Ines' }])).toEqual([
            { label: null, members: [{ id: 'u1', name: 'Ines' }] },
        ]);
    });

    it('returns focus to the edit button when the editor saves or cancels', () => {
        const onChange = vi.fn();
        renderWithProviders(<Editable onChange={onChange} />);

        fireEvent.click(
            screen.getByRole('button', { name: 'Edit action item' }),
        );
        const input = screen.getByLabelText('Action title');
        expect(document.activeElement).toBe(input);
        fireEvent.keyDown(input, { key: 'Escape' });
        expect(document.activeElement).toBe(
            screen.getByRole('button', { name: 'Edit action item' }),
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Edit action item' }),
        );
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(onChange).toHaveBeenCalled();
        expect(document.activeElement).toBe(
            screen.getByRole('button', { name: 'Edit action item' }),
        );
    });

    it('resets the draft from new props each time editing starts', () => {
        const { rerender } = renderWithProviders(
            <ActionItem {...base} editing onChange={() => {}} />,
        );
        fireEvent.change(screen.getByLabelText('Action title'), {
            target: { value: 'Half typed' },
        });

        rerender(<ActionItem {...base} title="Renamed elsewhere" editing />);
        expect(
            (screen.getByLabelText('Action title') as HTMLInputElement).value,
        ).toBe('Half typed');

        rerender(<ActionItem {...base} title="Renamed elsewhere" />);
        rerender(<ActionItem {...base} title="Renamed elsewhere" editing />);
        expect(
            (screen.getByLabelText('Action title') as HTMLInputElement).value,
        ).toBe('Renamed elsewhere');
    });

    it('holds extreme data', () => {
        const title = 'x'.repeat(280);
        const name = 'N'.repeat(60);
        renderWithProviders(
            <ActionItem
                {...base}
                title={title}
                owner={{ id: 'u1', name }}
                showOwnerName
                links={makeLinks(6)}
                subtasks={Array.from({ length: 12 }, (_, index) => ({
                    isCompleted: index < 5,
                }))}
                commentCount={200}
            />,
        );
        const row = screen.getByRole('listitem');

        expect(within(row).getByText(title)).toBeTruthy();
        expect(within(row).getByText(name)).toBeTruthy();
        expect(within(row).getAllByRole('link')).toHaveLength(6);
        expect(within(row).getByText('5 of 12 sub-tasks done')).toBeTruthy();
        expect(within(row).getByText('200 comments')).toBeTruthy();
    });

    it('renders with no link, no sub-task and no comment', () => {
        renderWithProviders(
            <ActionItem {...base} links={[]} subtasks={[]} commentCount={0} />,
        );

        expect(screen.queryByRole('link')).toBeNull();
        expect(screen.queryByText(/sub-tasks done/)).toBeNull();
        expect(screen.getByText('0 comments')).toBeTruthy();
    });
});
