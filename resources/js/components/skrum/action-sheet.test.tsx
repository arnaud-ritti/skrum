import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ActionItemLink } from '@/components/skrum/action-item';
import { ActionSheet } from '@/components/skrum/action-sheet';
import type { ActionSheetProps } from '@/components/skrum/action-sheet';
import { renderWithProviders } from '@/test/render';

const base = {
    open: true,
    onOpenChange: () => {},
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
        syncState: index === 0 ? ('failed' as const) : ('off' as const),
    }));
}

function Harness(props: Partial<ActionSheetProps>) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button type="button" onClick={() => setOpen(true)}>
                opener
            </button>
            <ActionSheet
                {...base}
                {...props}
                open={open}
                onOpenChange={setOpen}
            />
        </>
    );
}

describe('ActionSheet', () => {
    it('is a dialog named by the action title, with the properties as a list', () => {
        renderWithProviders(
            <ActionSheet
                {...base}
                dueDate="2099-10-10"
                owner={{ id: 'u1', name: 'Ines Benali' }}
                teamName="Platform"
                source={{ label: 'Sprint 42', url: '/retros/r1' }}
            />,
        );
        const dialog = screen.getByRole('dialog', { name: base.title });

        expect(within(dialog).getByText('Platform · Sprint 42')).toBeTruthy();
        expect(within(dialog).getByText('Ines Benali')).toBeTruthy();
        expect(within(dialog).getByText('High')).toBeTruthy();
        expect(
            within(dialog)
                .getByRole('link', { name: 'Sprint 42' })
                .getAttribute('href'),
        ).toBe('/retros/r1');
        expect(
            within(dialog).getByRole('button', { name: 'Close' }),
        ).toBeTruthy();
    });

    it('renders nothing while closed', () => {
        renderWithProviders(<ActionSheet {...base} open={false} />);

        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('focuses the title on open and gives focus back to the opener on close', async () => {
        renderWithProviders(<Harness />);
        const opener = screen.getByRole('button', { name: 'opener' });

        opener.focus();
        fireEvent.click(opener);
        expect(document.activeElement).toBe(
            screen.getByRole('heading', { name: base.title }),
        );

        fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
        expect(screen.queryByRole('dialog')).toBeNull();
        await waitFor(() => expect(document.activeElement).toBe(opener));
    });

    it('completes from the footer and deletes with an icon and a label', () => {
        const onStatusChange = vi.fn();
        const onDelete = vi.fn();
        renderWithProviders(
            <ActionSheet
                {...base}
                onStatusChange={onStatusChange}
                onDelete={onDelete}
                actions={<button type="button">Export</button>}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Mark as done' }));
        expect(onStatusChange).toHaveBeenCalledWith('completed');
        expect(screen.getByRole('button', { name: 'Export' })).toBeTruthy();

        const remove = screen.getByRole('button', {
            name: 'Delete action item',
        });
        expect(remove.textContent).toBe('Delete');
        fireEvent.click(remove);
        expect(onDelete).toHaveBeenCalled();
    });

    it('offers In progress, keeps completing in one click and says when an item was started', () => {
        const onStatusChange = vi.fn();
        renderWithProviders(
            <ActionSheet
                {...base}
                status="doing"
                startedAt="2026-10-08T09:00:00Z"
                withDoing
                locale="en"
                onStatusChange={onStatusChange}
            />,
        );

        expect(screen.getByRole('dialog').textContent).toContain(
            'Started Oct 8',
        );

        fireEvent.click(screen.getByRole('button', { name: 'Mark as done' }));
        expect(onStatusChange).toHaveBeenCalledWith('completed');
    });

    it('completes a to-do item from the footer even with In progress offered', () => {
        const onStatusChange = vi.fn();
        renderWithProviders(
            <ActionSheet {...base} withDoing onStatusChange={onStatusChange} />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Mark as done' }));
        expect(onStatusChange).toHaveBeenCalledWith('completed');
    });

    it('does not say when a done item was started', () => {
        renderWithProviders(
            <ActionSheet
                {...base}
                status="completed"
                startedAt="2026-10-08T09:00:00Z"
                withDoing
                onStatusChange={() => {}}
            />,
        );

        expect(screen.getByRole('dialog').textContent).not.toContain('Started');
        expect(screen.getByRole('button', { name: 'Reopen' })).toBeTruthy();
    });

    it('keeps completion apart from management', () => {
        renderWithProviders(
            <ActionSheet
                {...base}
                canComplete={false}
                onStatusChange={() => {}}
                onChange={() => {}}
            />,
        );

        expect(
            (
                screen.getByRole('button', {
                    name: 'Mark as done',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
        expect(screen.queryByRole('combobox', { name: 'Status' })).toBeNull();
        expect(screen.getByRole('combobox', { name: 'Priority' })).toBeTruthy();
    });

    it('is read only for a guest: no field, no footer', () => {
        renderWithProviders(
            <ActionSheet
                {...base}
                readOnly
                dueDate="2099-10-10"
                recurrence="monthly"
                links={makeLinks(1)}
                onStatusChange={() => {}}
                onChange={() => {}}
                onDelete={() => {}}
                onRetrySync={() => {}}
            />,
        );

        expect(screen.getByText('Read only')).toBeTruthy();
        expect(screen.queryByRole('combobox')).toBeNull();
        expect(screen.queryByLabelText('Due date')).toBeNull();
        expect(screen.getByText('Repeats monthly')).toBeTruthy();
        expect(
            screen.queryByRole('button', { name: 'Mark as done' }),
        ).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Delete action item' }),
        ).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Edit action item' }),
        ).toBeNull();
        expect(
            screen.queryByRole('button', { name: /Retry the sync/ }),
        ).toBeNull();
    });

    it('edits the title inline; Escape cancels the edit without closing', () => {
        const onChange = vi.fn();
        const onOpenChange = vi.fn();
        renderWithProviders(
            <ActionSheet
                {...base}
                onChange={onChange}
                onOpenChange={onOpenChange}
            />,
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Edit action item' }),
        );
        const input = screen.getByLabelText('Action title');
        fireEvent.change(input, { target: { value: 'Half typed' } });
        fireEvent.keyDown(input, { key: 'Escape' });

        expect(onOpenChange).not.toHaveBeenCalled();
        expect(onChange).not.toHaveBeenCalled();
        expect(screen.queryByLabelText('Action title')).toBeNull();
        expect(document.activeElement).toBe(
            screen.getByRole('button', { name: 'Edit action item' }),
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Edit action item' }),
        );
        fireEvent.change(screen.getByLabelText('Action title'), {
            target: { value: '  New title ' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(onChange).toHaveBeenCalledWith({ title: 'New title' });
        expect(document.activeElement).toBe(
            screen.getByRole('button', { name: 'Edit action item' }),
        );
    });

    it('saves the due date on blur, only when it changed, and clears recurrence with it', () => {
        const onChange = vi.fn();
        renderWithProviders(
            <ActionSheet
                {...base}
                dueDate="2099-10-10"
                recurrence="weekly"
                onChange={onChange}
            />,
        );
        const input = screen.getByLabelText('Due date');

        fireEvent.blur(input);
        expect(onChange).not.toHaveBeenCalled();

        fireEvent.change(input, { target: { value: '2099-11-01' } });
        fireEvent.blur(input);
        expect(onChange).toHaveBeenLastCalledWith({ dueDate: '2099-11-01' });

        fireEvent.change(input, { target: { value: '' } });
        fireEvent.blur(input);
        expect(onChange).toHaveBeenLastCalledWith({
            dueDate: null,
            recurrence: null,
        });
    });

    it('closes the title editor when the sheet closes', () => {
        const props = { ...base, onChange: () => {} };
        const { rerender } = renderWithProviders(<ActionSheet {...props} />);

        fireEvent.click(
            screen.getByRole('button', { name: 'Edit action item' }),
        );
        fireEvent.change(screen.getByLabelText('Action title'), {
            target: { value: 'Draft of another item' },
        });
        rerender(<ActionSheet {...props} open={false} />);
        rerender(<ActionSheet {...props} title="Second item" />);

        expect(screen.queryByLabelText('Action title')).toBeNull();
    });

    it('closes the title editor when the item is deleted elsewhere', () => {
        const onChange = vi.fn();
        const { rerender } = renderWithProviders(
            <ActionSheet {...base} onChange={onChange} />,
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Edit action item' }),
        );
        rerender(<ActionSheet {...base} onChange={onChange} deleted />);

        expect(screen.queryByLabelText('Action title')).toBeNull();
    });

    it('saves an edited due date when the sheet closes before the field blurs', () => {
        const onChange = vi.fn();
        renderWithProviders(
            <Harness dueDate="2099-10-10" onChange={onChange} />,
        );
        fireEvent.click(screen.getByRole('button', { name: 'opener' }));

        fireEvent.change(screen.getByLabelText('Due date'), {
            target: { value: '2099-11-01' },
        });
        fireEvent.keyDown(document.activeElement ?? document.body, {
            key: 'Escape',
        });

        expect(onChange).toHaveBeenCalledWith({ dueDate: '2099-11-01' });
    });

    it('follows a remote change of the due date and of the status', () => {
        const props = { ...base, onChange: () => {}, dueDate: '2099-10-10' };
        const { rerender } = renderWithProviders(<ActionSheet {...props} />);

        rerender(<ActionSheet {...props} dueDate="2026-09-01" status="open" />);
        expect(
            (screen.getByLabelText('Due date') as HTMLInputElement).value,
        ).toBe('2026-09-01');
        expect(screen.getAllByText('Overdue').length).toBeGreaterThan(0);

        rerender(
            <ActionSheet {...props} dueDate="2026-09-01" status="completed" />,
        );
        expect(screen.queryByText('Overdue')).toBeNull();
    });

    it('shows which field is being saved', () => {
        const { rerender } = renderWithProviders(
            <ActionSheet {...base} onChange={() => {}} />,
        );
        expect(screen.queryByRole('status', { name: 'Saving…' })).toBeNull();

        rerender(
            <ActionSheet
                {...base}
                onChange={() => {}}
                savingField="priority"
            />,
        );
        expect(screen.getAllByRole('status', { name: 'Saving…' })).toHaveLength(
            1,
        );
    });

    it('warns and freezes when the item was deleted elsewhere', () => {
        renderWithProviders(
            <ActionSheet
                {...base}
                deleted
                onChange={() => {}}
                onStatusChange={() => {}}
                onDelete={() => {}}
            />,
        );

        expect(screen.getByText('This action item was deleted.')).toBeTruthy();
        expect(screen.queryByRole('combobox')).toBeNull();
        expect(
            (
                screen.getByRole('button', {
                    name: 'Mark as done',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
        expect(
            (
                screen.getByRole('button', {
                    name: 'Delete action item',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });

    it('lists the links with their sync state and retries a failed one', () => {
        const onRetrySync = vi.fn();
        const links = makeLinks(6);
        renderWithProviders(
            <ActionSheet {...base} links={links} onRetrySync={onRetrySync} />,
        );
        const section = screen
            .getByRole('heading', { name: 'External links' })
            .closest('section') as HTMLElement;

        expect(within(section).getAllByRole('link')).toHaveLength(6);
        expect(
            within(section).getByRole('link', {
                name: /KEY-0 .* · Sync failed$/,
            }),
        ).toBeTruthy();
        expect(within(section).getAllByText('Sync failed')).toHaveLength(2);
        fireEvent.click(
            within(section).getByRole('button', {
                name: 'Retry the sync of KEY-0',
            }),
        );
        expect(onRetrySync).toHaveBeenCalledWith(links[0]);
    });

    it('holds the slots and extreme data, and hides sections without data', () => {
        const title = 'x'.repeat(280);
        const name = 'N'.repeat(60);
        const { rerender } = renderWithProviders(
            <ActionSheet
                {...base}
                title={title}
                owner={{ id: 'u1', name }}
                createdBy={{ name }}
                subtasks={Array.from({ length: 12 }, (_, index) => ({
                    isCompleted: index < 5,
                }))}
                commentCount={200}
                comments={<p>thread</p>}
                originCard={<p>origin</p>}
                history={<p>log</p>}
                watchers={[{ id: 'u2', name: 'Malik Kaci' }]}
            >
                <p>checklist</p>
            </ActionSheet>,
        );

        expect(screen.getByRole('dialog', { name: title })).toBeTruthy();
        expect(screen.getAllByText(name)).toHaveLength(2);
        expect(screen.getByText('5 of 12 sub-tasks done')).toBeTruthy();
        expect(screen.getByText('checklist')).toBeTruthy();
        expect(screen.getByText('thread')).toBeTruthy();
        expect(screen.getByText('origin')).toBeTruthy();
        expect(screen.getByText('log')).toBeTruthy();
        expect(screen.getByRole('img', { name: 'Malik Kaci' })).toBeTruthy();

        rerender(<ActionSheet {...base} links={[]} subtasks={[]} />);
        for (const heading of [
            'Sub-tasks',
            'External links',
            'Comments',
            'Origin card',
            'History',
        ]) {
            expect(screen.queryByRole('heading', { name: heading })).toBeNull();
        }
        expect(screen.queryByText('Watchers')).toBeNull();
        expect(screen.queryByText('Created by')).toBeNull();
    });
});
