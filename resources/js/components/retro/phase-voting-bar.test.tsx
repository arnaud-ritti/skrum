import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PhaseVotingBar } from '@/components/retro/phase-voting-bar';
import { boardContext, renderInBoard, retroSnapshot } from '@/test/retro-board';

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

        expect(budget.getAttribute('aria-label')).toBe('1 vote left of 2');
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
        expect(screen.getByText('1 of 4 vote cast')).toBeTruthy();
        one.unmount();

        bar({ votesCast: 2 });

        expect(screen.getByText('2 of 4 votes cast')).toBeTruthy();
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
