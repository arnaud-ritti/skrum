import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionItemsList } from '@/components/action-items/action-items-list';
import type { ActionItemRowContext } from '@/components/action-items/action-items-table';
import { ActionItemMutationsContext } from '@/components/action-items/use-action-item-mutations';
import { useActionItemSelection } from '@/components/action-items/use-action-item-selection';
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

    it('starts a to-do item from its status button', () => {
        const { ctx } = renderList(flat('a'));

        fireEvent.click(
            screen.getByRole('button', { name: 'Mark as in progress' }),
        );

        expect(ctx.onStatusChange).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'a' }),
            'doing',
        );
    });

    it('completes an item from its status button', () => {
        const { ctx } = renderList([
            {
                key: 'all',
                label: '',
                items: [
                    actionItemFixture({
                        id: 'a',
                        status: 'doing',
                        startedAt: '2026-09-28T10:00:00Z',
                    }),
                ],
            },
        ]);

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
                    name: 'Mark as in progress',
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

    it('reads a finished sprint in the heading of its group', () => {
        renderList([
            {
                key: 'sprint-s41',
                label: 'Sprint 41',
                sprint: {
                    id: 's41',
                    number: 41,
                    startsOn: '2026-09-08',
                    endsOn: '2026-09-21',
                    teamId: 'team-1',
                    state: 'finished',
                    itemIds: ['a'],
                },
                items: [
                    actionItemFixture({
                        id: 'a',
                        status: 'open',
                        isOverdue: true,
                    }),
                ],
            },
        ]);

        const heading = screen.getByRole('heading', { level: 2 });

        expect(heading.textContent).toContain('Sprint 41');
        expect(within(heading).getByText('Finished sprint')).toBeTruthy();
        expect(within(heading).getByText('1 carried over')).toBeTruthy();
        expect(within(heading).getByText('1 overdue')).toBeTruthy();
        expect(document.getElementById('action-item-a')).not.toBeNull();
    });

    describe('selection mode', () => {
        const items = [
            actionItemFixture({ id: 'a', content: 'Fix the build' }),
            actionItemFixture({ id: 'b', content: 'Write the runbook' }),
        ];

        function Selectable({
            selecting,
            onLongPress,
        }: {
            selecting: boolean;
            onLongPress: (id: string) => void;
        }) {
            const selection = useActionItemSelection({
                rows: items,
                viewer: actionItemViewerFixture(),
                total: 2,
                filtersKey: 'f',
                pageKey: 'p',
            });

            return (
                <ActionItemMutationsContext
                    value={actionItemMutationsFixture()}
                >
                    <ActionItemsList
                        groups={[{ key: 'all', label: '', items }]}
                        context={context()}
                        endpoints={actionItemEndpointsFixture()}
                        selection={selection}
                        selecting={selecting}
                        onLongPress={(item) => onLongPress(item.id)}
                        onPatch={vi.fn()}
                    />
                </ActionItemMutationsContext>
            );
        }

        afterEach(() => {
            vi.useRealTimers();
        });

        it('shows no box outside selection mode', () => {
            renderWithProviders(
                <Selectable selecting={false} onLongPress={vi.fn()} />,
            );

            expect(
                screen.queryByRole('checkbox', {
                    name: 'Select Fix the build',
                }),
            ).toBeNull();
        });

        it('puts a box before each item, and a tap on the item toggles it', () => {
            renderWithProviders(<Selectable selecting onLongPress={vi.fn()} />);

            const box = screen.getByRole('checkbox', {
                name: 'Select Fix the build',
            });

            expect(box.getAttribute('data-state')).toBe('unchecked');

            fireEvent.click(document.getElementById('action-item-a')!);

            expect(box.getAttribute('data-state')).toBe('checked');
            expect(
                document
                    .getElementById('action-item-a')
                    ?.getAttribute('data-selected'),
            ).toBe('true');

            fireEvent.click(box);

            expect(box.getAttribute('data-state')).toBe('unchecked');
        });

        it('keeps each box inside the list item of its row', () => {
            renderWithProviders(<Selectable selecting onLongPress={vi.fn()} />);

            const box = screen.getByRole('checkbox', {
                name: 'Select Fix the build',
            });
            const listItem = box.closest('[role="listitem"]');

            expect(listItem?.parentElement?.getAttribute('role')).toBe('list');
            expect(listItem?.querySelector('[role="listitem"]')).toBeNull();
        });

        it('does not change the status when a tap selects', () => {
            const onStatusChange = vi.fn();

            function WithContext() {
                const selection = useActionItemSelection({
                    rows: items,
                    viewer: actionItemViewerFixture(),
                    total: 2,
                    filtersKey: 'f',
                    pageKey: 'p',
                });

                return (
                    <ActionItemMutationsContext
                        value={actionItemMutationsFixture()}
                    >
                        <ActionItemsList
                            groups={[{ key: 'all', label: '', items }]}
                            context={context({ onStatusChange })}
                            endpoints={actionItemEndpointsFixture()}
                            selection={selection}
                            selecting
                            onPatch={vi.fn()}
                        />
                    </ActionItemMutationsContext>
                );
            }

            renderWithProviders(<WithContext />);
            fireEvent.click(
                screen.getAllByRole('button', {
                    name: 'Mark as in progress',
                })[0],
            );

            expect(onStatusChange).not.toHaveBeenCalled();
            expect(
                screen
                    .getByRole('checkbox', { name: 'Select Fix the build' })
                    .getAttribute('data-state'),
            ).toBe('checked');
        });

        it('selects the focused item with Space instead of starting it', () => {
            renderWithProviders(<Selectable selecting onLongPress={vi.fn()} />);

            fireEvent.keyDown(document.getElementById('action-item-a')!, {
                key: ' ',
            });

            expect(
                screen
                    .getByRole('checkbox', { name: 'Select Fix the build' })
                    .getAttribute('data-state'),
            ).toBe('checked');
        });

        it('enters the mode on a long press of 500 ms, not on a 200 ms press', () => {
            vi.useFakeTimers();
            const onLongPress = vi.fn();

            renderWithProviders(
                <Selectable selecting={false} onLongPress={onLongPress} />,
            );
            const item = document.getElementById('action-item-b')!;

            fireEvent.pointerDown(item, { clientX: 5, clientY: 5 });
            vi.advanceTimersByTime(200);
            fireEvent.pointerUp(item, { clientX: 5, clientY: 5 });

            expect(onLongPress).not.toHaveBeenCalled();

            fireEvent.pointerDown(item, { clientX: 5, clientY: 5 });
            vi.advanceTimersByTime(500);

            expect(onLongPress).toHaveBeenCalledExactlyOnceWith('b');
        });
    });
});
