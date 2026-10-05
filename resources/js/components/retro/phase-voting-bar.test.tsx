import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    PhaseVotingBar,
    useCardVote,
} from '@/components/retro/phase-voting-bar';
import type { BoardCard } from '@/lib/retro/types';
import { boardContext, renderInBoard, retroSnapshot } from '@/test/retro-board';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
});

const people = [
    { id: 'me', name: 'Alice Martin', avatarUrl: '/a.svg', isGuest: false },
    { id: 'bob', name: 'Bob Stone', avatarUrl: '/a.svg', isGuest: false },
];

function bar(
    overrides: Parameters<typeof retroSnapshot>[0] = {},
    slots: Parameters<typeof PhaseVotingBar>[0] = {},
) {
    const { retro, viewer, ...rest } = overrides;

    return renderInBoard(
        <PhaseVotingBar {...slots} />,
        boardContext(
            retroSnapshot({
                participants: people,
                votesCast: 1,
                retro: { phase: 'voting', votesPerParticipant: 2, ...retro },
                viewer: { remainingVotes: 1, ...viewer },
                ...rest,
            }),
        ),
    );
}

describe('PhaseVotingBar', () => {
    it('shows my budget on the vote budget, out of the votes of one person', () => {
        const { container } = bar();
        const budget = screen.getByRole('status');

        expect(budget.textContent).toContain('1 vote left of 2');
        expect(budget.querySelectorAll('[data-slot="vote-dot"]')).toHaveLength(
            2,
        );
        expect(
            budget.querySelectorAll(
                '[data-slot="vote-dot"][data-filled="true"]',
            ),
        ).toHaveLength(1);
        expect(
            container.querySelector('[data-slot="vote-budget-detail"]')
                ?.textContent,
        ).toBe('of 2');
    });

    it('shows an observer of the team no vote budget, only how far the room is (P23-04)', () => {
        const { container } = bar({
            viewer: { isFacilitator: false, participantId: 'bob' },
            viewerIsObserver: true,
        });

        expect(
            container.querySelector('[data-slot="vote-budget-detail"]'),
        ).toBeNull();
        expect(screen.queryByText('Votes left: 1')).toBeNull();
        expect(
            container.querySelector('[data-slot="retro-voting-progress"]'),
        ).not.toBeNull();
    });

    it('keeps the sentence the browser suite reads', () => {
        bar();

        expect(screen.getByText('Votes left: 1')).toBeTruthy();
    });

    it('says how far the room is, in words and on a progress bar', () => {
        const one = bar();
        const progress = screen.getByRole('progressbar', {
            name: 'Votes cast',
        });

        expect(progress.getAttribute('aria-valuenow')).toBe('1');
        expect(progress.getAttribute('aria-valuemax')).toBe('4');
        expect(screen.getByText('1 of 4 votes cast')).toBeTruthy();
        one.unmount();

        bar({ votesCast: 2 });

        expect(screen.getByText('2 of 4 votes cast')).toBeTruthy();
    });

    it('keeps the noun singular when the room has a single vote to cast', () => {
        bar({
            participants: [people[0]],
            votesCast: 0,
            retro: { votesPerParticipant: 1 },
        });

        expect(screen.getByText('0 of 1 vote cast')).toBeTruthy();
    });

    it('says that the votes are hidden only while they are', () => {
        const hidden = bar({ retro: { hideVoteCounts: true } });

        expect(screen.getByText('Votes hidden until the reveal')).toBeTruthy();
        hidden.unmount();

        bar();

        expect(screen.queryByText('Votes hidden until the reveal')).toBeNull();
    });

    it('leaves the places of the features to come empty, and fills them when given', () => {
        const empty = bar();

        expect(
            empty.container.querySelector(
                '[data-slot="retro-voting-finished"]',
            ),
        ).toBeNull();
        expect(
            empty.container.querySelector('[data-slot="retro-voting-done"]'),
        ).toBeNull();
        empty.unmount();

        const { container } = bar(
            {},
            {
                cap: ' · max 2 per card',
                finished: '5/8 have finished',
                done: <button type="button">I have finished voting</button>,
            },
        );

        expect(
            container.querySelector('[data-slot="vote-budget-detail"]')
                ?.textContent,
        ).toBe('of 2 · max 2 per card');
        expect(
            container.querySelector('[data-slot="retro-voting-finished"]')
                ?.textContent,
        ).toBe('5/8 have finished');
        expect(
            container.querySelector('[data-slot="retro-voting-done"] button'),
        ).not.toBeNull();
    });
});

describe('useCardVote', () => {
    const voted = { id: 'c', myVotes: 0 } as BoardCard;

    function VoteButton() {
        const vote = useCardVote(voted);

        return (
            <button type="button" onClick={() => vote(1)}>
                Vote
            </button>
        );
    }

    async function voteAnswered(finishedIds: string[] | null) {
        mocks.request.mockResolvedValueOnce({
            cardId: 'c',
            myVotes: 1,
            remainingVotes: 2,
            votesCast: 4,
            votesVersion: 7,
            total: 3,
            finishedIds,
        });

        const { ctx } = renderInBoard(
            <VoteButton />,
            boardContext(retroSnapshot({ retro: { phase: 'voting' } })),
        );

        fireEvent.click(screen.getByRole('button', { name: 'Vote' }));

        await waitFor(() =>
            expect(ctx.apply).toHaveBeenCalledWith(
                expect.objectContaining({ type: 'votes.cast' }),
            ),
        );

        return ctx.apply;
    }

    it('takes back "finished" as the answer of the vote says', async () => {
        const apply = await voteAnswered(['p2']);

        expect(apply).toHaveBeenCalledWith({
            type: 'voting.finished',
            finishedIds: ['p2'],
        });
    });

    it('leaves "finished" alone when the answer does not say it', async () => {
        const apply = await voteAnswered(null);

        expect(apply).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'voting.finished' }),
        );
    });
});
