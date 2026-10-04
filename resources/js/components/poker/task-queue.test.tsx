import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { TaskQueue } from '@/components/poker/task-queue';
import type { PokerTaskExternal } from '@/lib/poker/types';
import {
    pokerPlayer,
    pokerRound,
    pokerSnapshot,
    pokerTask,
    renderInRoom,
} from '@/test/poker-room';

const mocks = vi.hoisted(() => ({
    request: vi.fn(),
    dragEnd: null as
        | null
        | ((event: { active: { id: string }; over: { id: string } }) => void),
}));

vi.mock('@dnd-kit/core', async (importOriginal) => {
    const original = await importOriginal<typeof import('@dnd-kit/core')>();

    return {
        ...original,
        DndContext: (props: Parameters<typeof original.DndContext>[0]) => {
            mocks.dragEnd = (event) =>
                props.onDragEnd?.(
                    event as Parameters<NonNullable<typeof props.onDragEnd>>[0],
                );

            return <original.DndContext {...props} />;
        },
    };
});

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
});

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

function rows(): HTMLElement[] {
    return Array.from(
        document.querySelectorAll<HTMLElement>('[data-test="poker-task-row"]'),
    );
}

/** The scripts of the browser suite: the title is the first text of a row, then its badges. */
function titlesAsTheBrowserSuiteReadsThem(): string[] {
    return rows().map(
        (row) => row.querySelector('span span')?.textContent ?? '',
    );
}

function badges(row: HTMLElement): string[] {
    return Array.from(row.querySelectorAll('[data-slot="badge"]')).map(
        (badge) => badge.textContent ?? '',
    );
}

beforeEach(() => {
    mocks.request.mockReset();
});

describe('TaskQueue, the list', () => {
    it('lists the tasks in an ordered list, the title first in each row, the current one marked', () => {
        const { container } = renderInRoom(
            <TaskQueue />,
            pokerSnapshot({
                tasks: [
                    pokerTask('t2', 'Password reset', { position: 2 }),
                    pokerTask('t1', 'Login page', {
                        position: 1,
                        estimate: '5',
                        external: {
                            source: 'jira',
                            key: 'PROJ-1',
                            url: 'https://acme.atlassian.net/browse/PROJ-1',
                            type: null,
                            labels: [],
                            isManaged: true,
                        },
                    }),
                ],
                current: {
                    taskId: 't1',
                    round: pokerRound({ number: 2, votesCount: 2 }),
                },
            }),
        );

        expect(container.querySelectorAll('ol')).toHaveLength(1);
        expect(container.querySelectorAll('ol > li')).toHaveLength(2);
        expect(titlesAsTheBrowserSuiteReadsThem()).toEqual([
            'Login page',
            'Password reset',
        ]);
        expect(rows()[0].getAttribute('aria-current')).toBe('true');
        expect(rows()[1].hasAttribute('aria-current')).toBe(false);
        expect(badges(rows()[0])).toEqual(['PROJ-1', '5', 'Votes: 2']);
        expect(badges(rows()[1])).toEqual(['Votes: 0']);
        expect(within(rows()[0]).getByText('Round 2')).toBeTruthy();
    });

    it('shows the votes of the last round on every row: the round being played, an estimated task, a task still to estimate', () => {
        renderInRoom(
            <TaskQueue />,
            pokerSnapshot({
                tasks: [
                    pokerTask('t0', 'Sign up', {
                        position: 1,
                        estimate: '3',
                        roundsCount: 2,
                        votesCount: 7,
                    }),
                    pokerTask('t1', 'Login page', {
                        position: 2,
                        votesCount: 1,
                    }),
                    pokerTask('t2', 'Password reset', {
                        position: 3,
                        roundsCount: 1,
                        votesCount: 4,
                    }),
                    pokerTask('t3', 'Billing', { position: 4 }),
                ],
                current: {
                    taskId: 't1',
                    round: pokerRound({ votesCount: 3 }),
                },
            }),
        );

        expect(badges(rows()[0])).toEqual(['3']);
        expect(
            rows()[0].querySelector('[data-slot="task-votes"]')?.textContent,
        ).toBe('Votes: 7');
        expect(badges(rows()[1])).toEqual(['Votes: 3']);
        expect(badges(rows()[2])).toEqual(['Votes: 4']);
        expect(badges(rows()[3])).toEqual(['Votes: 0']);
        expect(screen.queryByText(/pts$/)).toBeNull();
    });

    it('lets the facilitator drag and pick a task, and nobody else', async () => {
        mocks.request.mockResolvedValue(null);
        const onSelected = vi.fn();
        const { ctx, unmount } = renderInRoom(
            <TaskQueue onSelected={onSelected} />,
        );

        expect(
            screen
                .getAllByRole('button', { name: /^Drag to reorder / })
                .map((handle) => handle.getAttribute('aria-label')),
        ).toEqual([
            'Drag to reorder Login page',
            'Drag to reorder Password reset',
        ]);

        await act(async () => {
            fireEvent.click(screen.getByText('Password reset'));
        });

        expect(mocks.request.mock.calls[0][1]).toEqual({ task_id: 't2' });
        expect(ctx.refetch).toHaveBeenCalledTimes(1);
        expect(onSelected).toHaveBeenCalledTimes(1);
        unmount();

        renderInRoom(
            <TaskQueue />,
            pokerSnapshot({ me: { isFacilitator: false } }),
        );

        expect(rows()[0].querySelector('button')).toBeNull();
        expect(rows()[1].querySelector('button')).toBeNull();
    });

    it('does not ask the server for the task that is already the current one', async () => {
        const onSelected = vi.fn();
        renderInRoom(<TaskQueue onSelected={onSelected} />);

        await act(async () => {
            fireEvent.click(screen.getByText('Login page'));
        });

        expect(mocks.request).not.toHaveBeenCalled();
        expect(onSelected).toHaveBeenCalledTimes(1);
    });

    it('has no control in a row of an ended game', () => {
        renderInRoom(
            <TaskQueue />,
            pokerSnapshot({
                game: { endedAt: '2026-10-02T10:00:00Z' },
                current: null,
            }),
        );

        expect(
            document.querySelectorAll('[data-test="poker-task-row"] button'),
        ).toHaveLength(0);
        expect(screen.queryByRole('button', { name: 'Add task' })).toBeNull();
        expect(screen.queryByRole('textbox')).toBeNull();
    });

    it('counts the tasks and the points estimated on a numeric deck', () => {
        const tasks = [
            pokerTask('t1', 'Login page', { position: 1, estimate: '3' }),
            pokerTask('t2', 'Password reset', { position: 2, estimate: '8' }),
            pokerTask('t3', 'Export invoices', { position: 3 }),
        ];
        const { unmount } = renderInRoom(
            <TaskQueue />,
            pokerSnapshot({ tasks, current: null }),
        );
        const heading = screen.getByRole('heading', { level: 2 });

        expect(heading.textContent).toBe('Tasks3');
        expect(screen.getByText('11 pts estimated')).toBeTruthy();
        unmount();

        renderInRoom(
            <TaskQueue />,
            pokerSnapshot({
                game: { isNumeric: false },
                tasks: [pokerTask('t1', 'Login page', { estimate: 'M' })],
                current: null,
            }),
        );

        expect(screen.queryByText(/pts estimated/)).toBeNull();
    });
});

describe('TaskQueue, adding', () => {
    it('adds a task from its title alone and empties the field', async () => {
        const saved = pokerTask('t3', 'Export invoices', { position: 3 });

        mocks.request.mockResolvedValue(saved);

        const { ctx } = renderInRoom(<TaskQueue />);
        const field = screen.getByRole('textbox', { name: 'Add a task…' });

        fireEvent.change(field, { target: { value: '  Export invoices ' } });

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Add' }));
        });

        expect(mocks.request.mock.calls[0][0].method).toBe('post');
        expect(mocks.request.mock.calls[0][1]).toEqual({
            title: 'Export invoices',
            description: null,
        });
        expect(ctx.apply).toHaveBeenCalledWith({
            type: 'task.upsert',
            task: saved,
        });
        expect((field as HTMLInputElement).value).toBe('');
    });

    it('sends nothing for an empty title', async () => {
        renderInRoom(<TaskQueue />);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Add' }));
        });

        expect(mocks.request).not.toHaveBeenCalled();
    });

    it('offers the full form only once a task exists: the empty table has its own call', () => {
        const { unmount } = renderInRoom(<TaskQueue />);

        expect(screen.getByRole('button', { name: 'Add task' })).toBeTruthy();
        unmount();

        renderInRoom(
            <TaskQueue />,
            pokerSnapshot({ tasks: [], current: null }),
        );

        expect(screen.queryByRole('button', { name: 'Add task' })).toBeNull();
        expect(screen.getByText('No tasks yet.')).toBeTruthy();
        expect(
            screen.getByRole('textbox', { name: 'Add a task…' }),
        ).toBeTruthy();
    });

    it('offers no way to add to who may not edit the tasks', () => {
        renderInRoom(
            <TaskQueue />,
            pokerSnapshot({
                me: {
                    isGuest: true,
                    isFacilitator: false,
                    canEditTasks: false,
                },
            }),
        );

        expect(screen.queryByRole('textbox')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Add task' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Import' })).toBeNull();
    });

    it('offers the import and the refresh when a tracker is connected', () => {
        renderInRoom(
            <TaskQueue />,
            pokerSnapshot({
                integrations: {
                    jira: {
                        connected: true,
                        canWrite: true,
                        estimateFields: [],
                        defaultEstimateFieldId: null,
                    },
                    linear: null,
                    jira_dc: null,
                    github: null,
                },
                tasks: [
                    pokerTask('t1', 'Login page', {
                        external: {
                            source: 'jira',
                            key: 'PROJ-1',
                            url: 'https://acme.atlassian.net/browse/PROJ-1',
                            type: null,
                            labels: [],
                            isManaged: true,
                        },
                    }),
                ],
            }),
        );

        expect(screen.getByRole('button', { name: 'Import' })).toBeTruthy();
        expect(
            screen.getByRole('button', { name: 'More task actions' }),
        ).toBeTruthy();
    });
});

describe('TaskQueue, the facilitator settings', () => {
    it('shows the deck and who watches, and turns the automatic reveal on', async () => {
        mocks.request.mockResolvedValue(null);

        const { ctx } = renderInRoom(
            <TaskQueue />,
            pokerSnapshot({
                players: [
                    pokerPlayer('ada', 'Ada'),
                    pokerPlayer('casey', 'Casey', { isSpectator: true }),
                ],
            }),
        );
        const settings = screen.getByRole('region', {
            name: 'Facilitator settings',
        });

        expect(within(settings).getByText('Fibonacci')).toBeTruthy();
        expect(within(settings).getByText('1 (Casey)')).toBeTruthy();

        const autoReveal = within(settings).getByRole('switch', {
            name: 'Reveal automatically when everyone has voted or the timer ends',
        });

        expect(autoReveal.getAttribute('aria-checked')).toBe('false');

        await act(async () => {
            fireEvent.click(autoReveal);
        });

        expect(mocks.request.mock.calls[0][1]).toEqual({ auto_reveal: true });
        expect(ctx.refetch).toHaveBeenCalledTimes(1);
    });

    it('is shown to the facilitator of a game that is not ended only', () => {
        renderInRoom(
            <TaskQueue />,
            pokerSnapshot({ me: { isFacilitator: false } }),
        );

        expect(
            screen.queryByRole('region', { name: 'Facilitator settings' }),
        ).toBeNull();
    });
});

const external = (
    source: 'jira' | 'linear',
    key: string,
): PokerTaskExternal => ({
    source,
    key,
    url: `https://tracker.test/${key}`,
    type: null,
    labels: [],
    isManaged: true,
});

const connected = {
    connected: true,
    canWrite: true,
    estimateFields: [],
    defaultEstimateFieldId: null,
};

describe('TaskQueue, order and refresh', () => {
    beforeEach(() => {
        mocks.request.mockReset();
        vi.mocked(toast.success).mockReset();
        vi.mocked(toast.warning).mockReset();
    });

    it('moves a dropped task at once and sends the new order', async () => {
        mocks.request.mockResolvedValue(null);
        const { ctx } = renderInRoom(<TaskQueue />);

        await act(async () => {
            mocks.dragEnd?.({ active: { id: 't2' }, over: { id: 't1' } });
        });

        expect(ctx.apply).toHaveBeenCalledWith({
            type: 'tasks.reorder',
            taskIds: ['t2', 't1'],
        });
        expect(mocks.request.mock.calls[0][1]).toEqual({
            task_ids: ['t2', 't1'],
        });
    });

    it('refreshes the imported tasks and names no single tracker for what several lost', async () => {
        mocks.request.mockResolvedValue({ refreshed: 1, missing: 1 });
        const { ctx } = renderInRoom(
            <TaskQueue />,
            pokerSnapshot({
                integrations: {
                    jira: connected,
                    linear: connected,
                    jira_dc: null,
                    github: null,
                },
                tasks: [
                    pokerTask('t1', 'Login page', {
                        external: external('jira', 'PROJ-1'),
                    }),
                    pokerTask('t2', 'Password reset', {
                        external: external('linear', 'ENG-1'),
                    }),
                ],
            }),
        );

        fireEvent.keyDown(
            screen.getByRole('button', { name: 'More task actions' }),
            { key: 'Enter' },
        );

        await act(async () => {
            fireEvent.click(
                await screen.findByRole('menuitem', {
                    name: 'Refresh from Jira & Linear',
                }),
            );
        });

        expect(toast.success).toHaveBeenCalledWith('1 task refreshed.');
        expect(toast.warning).toHaveBeenCalledWith(
            '1 task was not found in its tracker.',
        );
        expect(ctx.refetch).toHaveBeenCalledTimes(1);
    });
});
