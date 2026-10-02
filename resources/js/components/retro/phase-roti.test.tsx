import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PhaseRoti, RotiVote, rotiVoters } from '@/components/retro/phase-roti';
import type { PresenceMember } from '@/lib/retro/types';
import { boardContext, renderInBoard, retroSnapshot } from '@/test/retro-board';

const retroRequest = vi.hoisted(() => vi.fn());
const mobile = vi.hoisted(() => ({ value: false }));

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest,
}));

vi.mock('@/hooks/use-mobile', () => ({
    useIsMobile: () => mobile.value,
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

const carol: PresenceMember = {
    id: 'carol',
    name: 'Carol Guest',
    avatarUrl: '/c.svg',
    isGuest: true,
};

function rotiBoard(roti = {}, phase: 'roti' | 'completed' = 'roti') {
    return retroSnapshot({
        retro: { phase },
        roti: {
            myScore: null,
            respondents: 0,
            voterIds: [],
            canVote: true,
            ...roti,
        },
    });
}

const group = () => screen.getByRole('group', { name: 'How was this retro?' });
const rows = () =>
    [...document.querySelectorAll('[data-test="retro-roti-voters"] > li')].map(
        (row) =>
            [...row.children]
                .slice(1)
                .map((part) => part.textContent)
                .join(' · '),
    );

beforeEach(() => {
    retroRequest.mockReset();
    mobile.value = false;
});

describe('rotiVoters', () => {
    it('lists who is in the room, the viewer first, with who has voted', () => {
        const board = rotiBoard({ voterIds: ['bob', 'gone'] });
        const { online } = boardContext(board);

        expect(
            rotiVoters(board, [...online].reverse()).map((voter) => [
                voter.id,
                voter.isMe,
                voter.hasVoted,
            ]),
        ).toEqual([
            ['me', true, false],
            ['bob', false, true],
        ]);
    });

    it('holds the viewer alone before the presence channel has answered', () => {
        const board = rotiBoard({ voterIds: ['me'] });

        expect(rotiVoters(board, []).map((voter) => voter.id)).toEqual(['me']);
        expect(rotiVoters(board, [])[0].hasVoted).toBe(true);
    });
});

describe('PhaseRoti', () => {
    it('asks the question in a row of five scores, under its eyebrow, with the distribution hidden', () => {
        renderInBoard(<PhaseRoti />, boardContext(rotiBoard()));

        expect(group().getAttribute('data-layout')).toBe('row');
        expect(
            within(group()).getAllByRole('button', { pressed: false }),
        ).toHaveLength(5);
        expect(
            screen.getByText('Last step · ROTI (return on time invested)'),
        ).toBeTruthy();
        expect(screen.getByText('Votes hidden until the end')).toBeTruthy();
        expect(
            screen.getByText('Anonymous · nobody sees who voted what'),
        ).toBeTruthy();
        expect(
            screen.getByRole('img', { name: 'Distribution hidden' }),
        ).toBeTruthy();
        expect(screen.queryByRole('status')).toBeNull();
    });

    it('lists everyone present with "Voted" or "Thinking…", the count, and never a score', () => {
        const board = rotiBoard({
            myScore: 4,
            respondents: 2,
            voterIds: ['me', 'carol'],
        });
        const ctx = boardContext(board);

        renderInBoard(
            <PhaseRoti />,
            boardContext(board, { online: [...ctx.online, carol] }),
        );

        expect(
            screen.getByRole('heading', { name: 'Who has voted' }),
        ).toBeTruthy();
        expect(rows()).toEqual([
            'Alice Martin (you) · Voted',
            'Bob Stone · Thinking…',
            'Carol Guest · Voted',
        ]);
        expect(
            document.querySelector('[data-slot="retro-roti-count"]')
                ?.textContent,
        ).toBe('2/32 of 3 have voted');
        expect(
            screen.getByRole('progressbar', { name: '2 of 3 have voted' }),
        ).toBeTruthy();
        expect(
            document.querySelector('[data-test="retro-roti-voters"]')
                ?.textContent,
        ).not.toMatch(/\d/);
        expect(
            screen.getByText(
                'Results appear for everyone when the facilitator ends the session.',
            ),
        ).toBeTruthy();
    });

    it('sends the score, applies the answer and says the vote is saved', async () => {
        retroRequest.mockResolvedValue({
            myScore: 4,
            respondents: 1,
            voterIds: ['me'],
        });
        const { ctx } = renderInBoard(<PhaseRoti />, boardContext(rotiBoard()));

        fireEvent.click(
            within(group()).getByRole('button', { name: /Good use of time/ }),
        );

        await waitFor(() =>
            expect(ctx.apply).toHaveBeenCalledWith({
                type: 'roti.set',
                myScore: 4,
                respondents: 1,
                voterIds: ['me'],
            }),
        );
        expect(retroRequest.mock.calls[0][0]).toMatchObject({ method: 'put' });
        expect(retroRequest.mock.calls[0][1]).toEqual({ score: 4 });
        expect(ctx.refetch).not.toHaveBeenCalled();
    });

    it('takes the vote back on a press on the score already given', async () => {
        retroRequest.mockResolvedValue({
            myScore: null,
            respondents: 0,
            voterIds: [],
        });
        const { ctx } = renderInBoard(
            <PhaseRoti />,
            boardContext(
                rotiBoard({ myScore: 4, respondents: 1, voterIds: ['me'] }),
            ),
        );

        expect(screen.getByRole('status').textContent).toBe(
            'Vote saved · you can change it until the session ends',
        );

        fireEvent.click(within(group()).getByRole('button', { pressed: true }));

        await waitFor(() => expect(ctx.apply).toHaveBeenCalled());
        expect(retroRequest.mock.calls[0][0]).toMatchObject({
            method: 'delete',
        });
        expect(retroRequest).toHaveBeenCalledTimes(1);
    });

    it('applies nothing when the server refuses', async () => {
        retroRequest.mockRejectedValue(new Error('refused'));
        const { ctx } = renderInBoard(<PhaseRoti />, boardContext(rotiBoard()));

        fireEvent.click(
            within(group()).getByRole('button', { name: /Break-even/ }),
        );

        await waitFor(() => expect(retroRequest).toHaveBeenCalled());
        await Promise.resolve();
        expect(ctx.apply).not.toHaveBeenCalled();
    });

    it('shows on a phone the stack of those who have voted, not the list', () => {
        mobile.value = true;

        renderInBoard(
            <PhaseRoti />,
            boardContext(rotiBoard({ respondents: 1, voterIds: ['bob'] })),
        );

        expect(
            document.querySelector('[data-test="retro-roti-voters"]'),
        ).toBeNull();
        expect(
            document.querySelectorAll(
                '[data-slot="retro-roti-voters"] [data-slot="person-avatar"]',
            ),
        ).toHaveLength(1);
        expect(
            document.querySelector('[data-slot="retro-roti-count"]')
                ?.textContent,
        ).toContain('1/2');
    });
});

describe('RotiVote', () => {
    it('refetches the results after a rating on a completed retro', async () => {
        retroRequest.mockResolvedValue({
            myScore: 5,
            respondents: 1,
            voterIds: ['me'],
        });
        const { ctx } = renderInBoard(
            <RotiVote />,
            boardContext(rotiBoard({}, 'completed')),
        );

        expect(group().getAttribute('data-layout')).toBe('list');

        fireEvent.click(
            within(group()).getByRole('button', {
                name: /Excellent use of time/,
            }),
        );

        await waitFor(() => expect(ctx.refetch).toHaveBeenCalled());
    });
});
