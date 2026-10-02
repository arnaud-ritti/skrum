import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionItemsList } from '@/components/action-items/action-items-list';
import type { ActionItemRowContext } from '@/components/action-items/action-items-table';
import { ActionItemMutationsContext } from '@/components/action-items/use-action-item-mutations';
import type { ActionItemGroup } from '@/lib/action-items/grouping';
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

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

function context(
    overrides: Partial<ActionItemRowContext> = {},
): ActionItemRowContext {
    return {
        viewer: actionItemViewerFixture(),
        locale: 'en',
        today: '2026-09-30',
        showTeam: false,
        teamName: () => 'Atlas',
        membersOf: () => [],
        scope: { workspace: 'acme', canManagePeople: false },
        sourcesOf: () => [],
        busyId: null,
        onStatusChange: vi.fn(),
        onDelete: vi.fn(),
        onRetrySync: vi.fn(),
        ...overrides,
    };
}

function renderList(
    groups: ActionItemGroup[],
    options: {
        context?: ActionItemRowContext;
        focusedId?: string;
        paged?: boolean;
    } = {},
) {
    const onPatch = vi.fn();
    const ctx = options.context ?? context();

    renderWithProviders(
        <ActionItemMutationsContext value={actionItemMutationsFixture()}>
            <ActionItemsList
                groups={groups}
                context={ctx}
                endpoints={actionItemEndpointsFixture()}
                paged={options.paged}
                focusedId={options.focusedId}
                onPatch={onPatch}
            />
        </ActionItemMutationsContext>,
    );

    return { onPatch, ctx };
}

function flat(...ids: string[]): ActionItemGroup[] {
    return [
        {
            key: 'all',
            label: '',
            items: ids.map((id) => actionItemFixture({ id })),
        },
    ];
}

beforeEach(() => {
    retroRequest.mockReset();
    retroRequest.mockResolvedValue({ comments: [] });
});

describe('ActionItemsList', () => {
    it('lists one action item per row, under the id the links point to', () => {
        renderList(flat('a', 'b'));

        expect(
            document.querySelectorAll(
                '[data-slot="action-item"][id^="action-item-"]',
            ),
        ).toHaveLength(2);
        expect(document.getElementById('action-item-a')?.textContent).toContain(
            'Added outside a retro',
        );
    });

    it('completes an item from its status button', () => {
        const { ctx } = renderList(flat('a'));

        fireEvent.click(screen.getByRole('button', { name: 'Mark as done' }));

        expect(ctx.onStatusChange).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'a' }),
            'completed',
        );
    });

    it('asks the page to delete: the page confirms first', () => {
        const { ctx } = renderList(flat('a'));

        fireEvent.click(
            screen.getByRole('button', { name: 'Delete action item' }),
        );

        expect(ctx.onDelete).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'a' }),
        );
    });

    it('hides the edition from a viewer who does not manage the item', () => {
        renderList([
            {
                key: 'all',
                label: '',
                items: [actionItemFixture({ isMine: false })],
            },
        ]);

        expect(
            screen.queryByRole('button', { name: 'Edit action item' }),
        ).toBeNull();
        expect(
            (
                screen.getByRole('button', {
                    name: 'Mark as done',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });

    it('opens the comments of the item of a deep link', async () => {
        renderList(flat('a', 'b'), { focusedId: 'b' });

        await waitFor(() =>
            expect(
                document.getElementById('action-item-b-comments')?.textContent,
            ).toContain('No comments yet.'),
        );
        expect(document.getElementById('action-item-a-comments')).toBeNull();
    });

    it('heads each group with its label and its count on this page', () => {
        renderList(
            [
                {
                    key: 'atlas',
                    label: 'Atlas',
                    items: [
                        actionItemFixture({ id: 'a' }),
                        actionItemFixture({ id: 'b' }),
                    ],
                },
                {
                    key: 'mobile',
                    label: 'Mobile',
                    items: [actionItemFixture({ id: 'c' })],
                },
            ],
            { paged: true },
        );

        const headings = screen
            .getAllByRole('heading', { level: 2 })
            .map((heading) => heading.textContent);

        expect(headings).toEqual([
            'Atlas2 action items · on this page',
            'Mobile1 action item · on this page',
        ]);
    });
});
