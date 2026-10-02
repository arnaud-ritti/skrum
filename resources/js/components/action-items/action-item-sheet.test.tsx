import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    ActionItemSheet,
    savedField,
} from '@/components/action-items/action-item-sheet';
import type { ActionItemRowContext } from '@/components/action-items/action-items-table';
import { ActionItemMutationsContext } from '@/components/action-items/use-action-item-mutations';
import type { ActionItem } from '@/lib/retro/types';
import {
    actionItemEndpointsFixture,
    actionItemFixture,
    actionItemMutationsFixture,
    actionItemViewerFixture,
} from '@/test/action-items';
import { renderWithProviders } from '@/test/render';

const retroRequest = vi.hoisted(() => vi.fn());

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest,
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: { translations: {}, locale: 'en' } }),
        Link: ({
            href,
            children,
            ...props
        }: {
            href: string;
            children: React.ReactNode;
        }) => (
            <a href={href} {...props}>
                {children}
            </a>
        ),
    };
});

function context(
    overrides: Partial<ActionItemRowContext> = {},
): ActionItemRowContext {
    return {
        viewer: actionItemViewerFixture(),
        locale: 'en',
        today: '2026-09-30',
        showTeam: false,
        teamName: () => 'Atlas',
        membersOf: () => [
            { id: 'user-2', name: 'Inès Benali', kind: 'member' },
        ],
        scope: { workspace: 'acme', canManagePeople: false },
        sourcesOf: () => [],
        busyId: null,
        onStatusChange: vi.fn(),
        onDelete: vi.fn(),
        onRetrySync: vi.fn(),
        ...overrides,
    };
}

function renderSheet(
    item: ActionItem,
    options: {
        context?: ActionItemRowContext;
        deleted?: boolean;
    } = {},
) {
    const onPatch = vi.fn();
    const ctx = options.context ?? context();

    renderWithProviders(
        <ActionItemMutationsContext value={actionItemMutationsFixture()}>
            <ActionItemSheet
                item={item}
                open
                onOpenChange={vi.fn()}
                context={ctx}
                endpoints={actionItemEndpointsFixture()}
                deleted={options.deleted}
                onPatch={onPatch}
            />
        </ActionItemMutationsContext>,
    );

    return { onPatch, ctx, sheet: screen.getByRole('dialog') };
}

beforeEach(() => {
    retroRequest.mockReset();
    retroRequest.mockResolvedValue({ comments: [] });
});

describe('savedField', () => {
    it('names the field a change saves', () => {
        expect(savedField({ title: 'Renamed' })).toBe('title');
        expect(savedField({ priority: 'high' })).toBe('priority');
        expect(savedField({ owner: null })).toBe('owner');
        expect(savedField({ recurrence: 'weekly' })).toBe('recurrence');
        expect(savedField({})).toBeNull();
    });

    it('is the due date when clearing it also clears the repeat', () => {
        expect(savedField({ dueDate: null, recurrence: null })).toBe('dueDate');
    });
});

describe('ActionItemSheet', () => {
    it('shows an item with its team, its creator and its comments', async () => {
        const { sheet } = renderSheet(actionItemFixture());

        expect(
            within(sheet).getByRole('heading', {
                name: 'Quarantine the flaky tests',
            }),
        ).toBeTruthy();
        expect(sheet.textContent).toContain('Atlas');
        expect(sheet.textContent).toContain('Alice Martin');
        await waitFor(() =>
            expect(sheet.textContent).toContain('No comments yet.'),
        );
    });

    it('lets a manager edit: the due date is saved when the field is left', () => {
        const item = actionItemFixture();
        const { onPatch, sheet } = renderSheet(item);
        const due = within(sheet).getByLabelText('Due date');

        fireEvent.change(due, { target: { value: '2026-11-05' } });
        fireEvent.blur(due);

        expect(onPatch).toHaveBeenCalledWith(item, { dueDate: '2026-11-05' });
    });

    it('asks the page to delete: the page confirms first', () => {
        const item = actionItemFixture();
        const { ctx, sheet } = renderSheet(item);

        fireEvent.click(
            within(sheet).getByRole('button', { name: 'Delete action item' }),
        );

        expect(ctx.onDelete).toHaveBeenCalledWith(item);
    });

    it('completes from the footer', () => {
        const item = actionItemFixture();
        const { ctx, sheet } = renderSheet(item);

        fireEvent.click(
            within(sheet).getByRole('button', { name: 'Mark as done' }),
        );

        expect(ctx.onStatusChange).toHaveBeenCalledWith(item, 'completed');
    });

    it('gives the status alone to an assignee who does not manage the item', () => {
        const item = actionItemFixture({
            isMine: false,
            assignee: {
                kind: 'member',
                id: 'user-1',
                name: 'Me',
                avatarUrl: '/avatars/me.svg',
                isTeamMember: true,
            },
        });
        const { sheet } = renderSheet(item);

        expect(
            within(sheet).getByRole('button', { name: 'Mark as done' }),
        ).toBeTruthy();
        expect(
            within(sheet).queryByRole('button', { name: 'Edit action item' }),
        ).toBeNull();
        expect(
            within(sheet).queryByRole('button', { name: 'Delete action item' }),
        ).toBeNull();
        expect(within(sheet).queryByLabelText('Due date')).toBeNull();
    });

    it('is read only for a viewer without any right on the item', () => {
        const { sheet } = renderSheet(actionItemFixture({ isMine: false }));

        expect(sheet.dataset.readonly).toBe('true');
        expect(sheet.textContent).toContain('Read only');
        expect(
            within(sheet).queryByRole('button', { name: 'Mark as done' }),
        ).toBeNull();
    });

    it('says that the item was deleted elsewhere', () => {
        const { sheet } = renderSheet(actionItemFixture(), { deleted: true });

        expect(sheet.textContent).toContain('This action item was deleted.');
        expect(within(sheet).queryByLabelText('Due date')).toBeNull();
    });
});
