import { act, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StoryCard } from '@/components/poker/story-card';
import { pokerSnapshot, pokerTask, renderInRoom } from '@/test/poker-room';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
});

vi.mock('sonner', () => ({
    toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

const imported = pokerTask('t1', 'Login form', {
    position: 1,
    estimate: '5',
    external: {
        source: 'linear',
        key: 'ENG-1',
        url: 'https://linear.app/acme/issue/ENG-1',
        isManaged: true,
        assignee: 'Sam Lee',
        sourceEstimate: '2',
        syncState: 'synced',
    },
});

const manual = pokerTask('t2', 'Manual task', { position: 2 });

function story(task = imported) {
    return renderInRoom(
        <StoryCard task={task} />,
        pokerSnapshot({ tasks: [imported, manual] }),
    );
}

describe('StoryCard, an imported task', () => {
    it('opens with the ticket, before the place of the task in the game', () => {
        story();

        const section = document.querySelector<HTMLElement>(
            'section[aria-labelledby="poker-task-t1"]',
        );
        const link = section?.querySelector<HTMLAnchorElement>(
            'a[href="https://linear.app/acme/issue/ENG-1"]',
        );

        expect(link?.textContent).toContain('ENG-1');
        expect(link?.getAttribute('target')).toBe('_blank');
        expect(section?.querySelectorAll('a')).toHaveLength(1);
        expect(
            link?.compareDocumentPosition(
                screen.getByText('1 / 2 in this game'),
            ),
        ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
        expect(
            link?.compareDocumentPosition(
                screen.getByRole('heading', { name: 'Login form' }),
            ),
        ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    });

    it('cannot be edited here, and says what its tracker holds', () => {
        story();

        expect(screen.queryByRole('button', { name: 'Edit task' })).toBeNull();
        expect(
            screen.getByRole('button', { name: 'Delete task' }),
        ).toBeTruthy();
        expect(screen.getByText('Assignee: Sam Lee')).toBeTruthy();
        expect(screen.getByText('Linear estimate: 2')).toBeTruthy();
        expect(screen.getByText('Synced to Linear')).toBeTruthy();
    });
});

describe('StoryCard, a task typed in the game', () => {
    it('has no ticket and nothing of a tracker', () => {
        story(manual);

        expect(screen.queryByRole('link')).toBeNull();
        expect(screen.queryByText(/managed in/)).toBeNull();
        expect(screen.getByRole('button', { name: 'Edit task' })).toBeTruthy();
    });
});

describe('StoryCard, deleting the task', () => {
    it('asks in an alert dialog, then removes the task', async () => {
        mocks.request.mockResolvedValue(null);
        const { ctx } = story(manual);

        fireEvent.click(screen.getByRole('button', { name: 'Delete task' }));

        const dialog = await screen.findByRole('alertdialog', {
            name: 'Delete this task?',
        });

        expect(
            within(dialog).getByText('Its rounds and votes are deleted too.'),
        ).toBeTruthy();

        await act(async () => {
            fireEvent.click(
                within(dialog).getByRole('button', { name: 'Delete' }),
            );
        });

        expect(ctx.apply).toHaveBeenCalledWith({
            type: 'task.remove',
            taskId: 't2',
        });
    });
});

describe('StoryCard, the rounds of the task', () => {
    const round = {
        id: 'r1',
        number: 1,
        anonymous: false,
        revealedAt: '2026-10-02T09:00:00Z',
        revealReason: 'manual' as const,
        timerEndsAt: null,
        version: 2,
        votesCount: 2,
        votes: [
            { playerId: 'ada', value: '8' },
            { playerId: 'bob', value: '3' },
        ],
        myVote: '8',
        result: {
            average: 5.5,
            mode: [],
            consensus: false,
            nearestCard: '5',
            distribution: [
                { value: '3', count: 1 },
                { value: '8', count: 1 },
            ],
        },
    };
    const voted = pokerTask('t3', 'Voted task', {
        position: 3,
        roundsCount: 1,
    });

    it('lists them open, each vote as "name: value", without a click', async () => {
        mocks.request.mockReset();
        mocks.request.mockResolvedValueOnce([round]);
        renderInRoom(
            <StoryCard task={voted} />,
            pokerSnapshot({ tasks: [voted] }),
        );

        const trigger = screen.getByRole('button', { name: 'Rounds (1)' });

        expect(trigger.getAttribute('aria-expanded')).toBe('true');
        expect(await screen.findByText('Round 1')).toBeTruthy();
        expect(mocks.request).toHaveBeenCalledTimes(1);

        const votes = Array.from(
            document.querySelectorAll('[data-slot="poker-round-vote"]'),
        ).map((vote) => vote.textContent);

        expect(votes).toEqual(['Ada: 8', 'Bob: 3']);
    });

    it('keeps them folded when asked, and asks the server only once opened', async () => {
        mocks.request.mockReset();
        mocks.request.mockResolvedValueOnce([round]);
        renderInRoom(
            <StoryCard task={voted} roundsOpen={false} />,
            pokerSnapshot({ tasks: [voted] }),
        );

        const trigger = screen.getByRole('button', { name: 'Rounds (1)' });

        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        expect(mocks.request).not.toHaveBeenCalled();

        await act(async () => {
            fireEvent.click(trigger);
        });

        expect(await screen.findByText('Round 1')).toBeTruthy();
    });

    it('has no rounds list on a task that was never voted', () => {
        story(manual);

        expect(screen.queryByRole('button', { name: /Rounds/ })).toBeNull();
    });
});
