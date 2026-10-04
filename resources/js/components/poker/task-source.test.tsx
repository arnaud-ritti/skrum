import { act, fireEvent, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    TaskSourceChip,
    TaskSourceDetails,
    TaskSourceLink,
} from '@/components/poker/task-source';
import type { PokerTask, PokerTaskExternal } from '@/lib/poker/types';
import { pokerSnapshot, pokerTask, renderInRoom } from '@/test/poker-room';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
});

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

function external(
    overrides: Partial<PokerTaskExternal> = {},
): PokerTaskExternal {
    return {
        source: 'jira',
        key: 'PROJ-1',
        url: 'https://acme.atlassian.net/browse/PROJ-1',
        type: null,
        labels: [],
        isManaged: true,
        ...overrides,
    };
}

function imported(
    overrides: Partial<PokerTaskExternal> = {},
    task: Partial<PokerTask> = {},
): PokerTask & { external: PokerTaskExternal } {
    const source = external(overrides);

    return {
        ...pokerTask('t1', 'Login page', { estimate: '5', ...task }),
        external: source,
    };
}

function details(
    task: PokerTask & { external: PokerTaskExternal },
    me: { isFacilitator?: boolean } = {},
) {
    return renderInRoom(
        <TaskSourceDetails task={task} external={task.external} />,
        pokerSnapshot({ me, tasks: [task] }),
    );
}

function badges(): string[] {
    return Array.from(document.querySelectorAll('[data-slot="badge"]')).map(
        (badge) => badge.textContent ?? '',
    );
}

beforeEach(() => {
    mocks.request.mockReset();
    vi.mocked(toast.success).mockReset();
});

describe('TaskSourceChip', () => {
    it('is a badge whose only text is the key of the ticket', () => {
        renderInRoom(<TaskSourceChip external={external()} />);

        expect(badges()).toEqual(['PROJ-1']);
        expect(screen.queryByRole('img')).toBeNull();
    });

    it('marks a ticket that is done in its tracker', () => {
        renderInRoom(
            <TaskSourceChip external={external({ statusCategory: 'done' })} />,
        );

        expect(badges()).toEqual(['PROJ-1']);
        expect(screen.getByRole('img', { name: 'Done in Jira' })).toBeTruthy();
    });
});

describe('TaskSourceLink', () => {
    it('opens the ticket in its tracker, in another tab', () => {
        renderInRoom(
            <TaskSourceLink
                external={external({
                    source: 'linear',
                    key: 'ENG-1',
                    url: 'https://linear.app/acme/issue/ENG-1',
                })}
            />,
        );

        const link = screen.getByRole('link', {
            name: 'ENG-1, Open in Linear',
        });

        expect(link.getAttribute('href')).toBe(
            'https://linear.app/acme/issue/ENG-1',
        );
        expect(link.getAttribute('target')).toBe('_blank');
        expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    });
});

describe('TaskSourceDetails', () => {
    it('shows the assignee, the estimate of the source, the sync state and who manages the text', () => {
        details(
            imported({
                assignee: 'Jane Doe',
                sourceEstimate: '3',
                syncState: 'synced',
                status: 'In Progress',
                statusCategory: 'in_progress',
            }),
        );

        expect(screen.getByText('Assignee: Jane Doe')).toBeTruthy();
        expect(screen.getByText('Jira estimate: 3')).toBeTruthy();
        expect(badges()).toEqual(['Synced to Jira', 'In Progress in Jira']);
        expect(
            screen.getByText(
                'The title and description are managed in Jira. Refresh the tasks to update them.',
            ),
        ).toBeTruthy();
    });

    it('shows a guest the note only: the server sends neither the assignee nor the sync state', () => {
        details(imported(), { isFacilitator: false });

        expect(badges()).toEqual([]);
        expect(screen.queryByText(/Assignee/)).toBeNull();
        expect(screen.queryByRole('button')).toBeNull();
        expect(screen.getByText(/managed in Jira/)).toBeTruthy();
    });

    it('says the ticket is done, or that it was not found', () => {
        details(
            imported({
                status: 'Closed',
                statusCategory: 'done',
                missing: true,
            }),
        );

        expect(badges()).toEqual(['Done in Jira', 'Not found in Jira']);
    });

    it('tells how GitHub receives the estimate', () => {
        details(imported({ source: 'github', syncState: 'synced' }));

        const badge = screen.getByText('Synced to GitHub');

        expect(
            badge.closest('[data-slot="badge"]')?.getAttribute('title'),
        ).toBe('Written to the issue description.');
        expect(badge.closest('[data-slot="badge"]')?.textContent).toBe(
            'Synced to GitHub Written to the issue description.',
        );
    });

    it('says why an estimate is not synced', () => {
        details(
            imported({
                syncState: 'unsupported',
                unsupportedReason: 'The estimate field is missing.',
            }),
        );

        expect(badges()).toEqual([
            'Not synced: The estimate field is missing.',
        ]);
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('shows the error of a failed sync and lets the facilitator retry', async () => {
        const task = imported({
            syncState: 'failed',
            syncError: 'Jira refused the value.',
        });
        const updated = {
            ...task,
            external: external({ syncState: 'pending' }),
        };
        mocks.request.mockResolvedValue(updated);

        const { ctx } = details(task);

        expect(badges()).toEqual(['Sync failed']);
        expect(screen.getByText('Jira refused the value.')).toBeTruthy();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        });

        expect(mocks.request.mock.calls[0][0].url).toBe(
            '/poker/game-1/tasks/t1/sync',
        );
        expect(ctx.apply).toHaveBeenCalledWith({
            type: 'task.upsert',
            task: updated,
        });
        expect(toast.success).toHaveBeenCalledWith('Sync requested.');
    });

    it('offers "Sync again" on a synced estimate, to the facilitator only', () => {
        const task = imported({ syncState: 'synced' });
        const { unmount } = details(task);

        expect(screen.getByRole('button', { name: 'Sync again' })).toBeTruthy();
        unmount();

        details(task, { isFacilitator: false });

        expect(screen.queryByRole('button')).toBeNull();
        expect(badges()).toEqual(['Synced to Jira']);
    });

    it('has nothing to sync while the task has no estimate', () => {
        details(imported({ syncState: 'pending' }, { estimate: null }));

        expect(badges()).toEqual(['Sync pending']);
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('does not announce a sync when the request is refused', async () => {
        mocks.request.mockResolvedValue(undefined);
        const { ctx } = details(imported({ syncState: 'synced' }));

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Sync again' }));
        });

        expect(ctx.apply).not.toHaveBeenCalled();
        expect(toast.success).not.toHaveBeenCalled();
    });

    it('flags an estimate changed in the tracker', () => {
        details(
            imported({
                syncState: 'synced',
                estimateConflict: { sourceEstimate: '8', matchingCard: '8' },
            }),
        );

        expect(screen.getByText('Changed in Jira to 8')).toBeTruthy();
        expect(
            screen.getByRole('button', { name: 'Keep skrum estimate' }),
        ).toBeTruthy();
    });
});
