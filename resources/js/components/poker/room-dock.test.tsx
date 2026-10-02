import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomDock } from '@/components/poker/room-dock';
import type { RoundActions } from '@/components/poker/use-round-actions';
import {
    pokerRound,
    pokerSnapshot,
    pokerTask,
    renderInRoom,
} from '@/test/poker-room';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
});

function roundActions(overrides: Partial<RoundActions> = {}): RoundActions {
    return {
        busy: false,
        reveal: vi.fn(async () => {}),
        revote: vi.fn(async () => {}),
        saveEstimate: vi.fn(async () => {}),
        goToNext: vi.fn(async () => {}),
        next: pokerTask('t2', 'Password reset'),
        ...overrides,
    };
}

const revealed = pokerRound({
    revealedAt: '2026-10-02T09:01:00Z',
    revealReason: 'manual',
    votesCount: 2,
    votes: [
        { playerId: 'ada', value: '8' },
        { playerId: 'bob', value: '3' },
    ],
    myVote: '8',
    result: {
        average: 5.5,
        distribution: [
            { value: '3', count: 1 },
            { value: '8', count: 1 },
        ],
        mode: ['3', '8'],
        consensus: false,
        nearestCard: '5',
    },
});

beforeEach(() => {
    mocks.request.mockReset();
});

describe('RoomDock, the deck', () => {
    it('offers every card of the deck as "Play :card" and plays the pressed one', async () => {
        mocks.request.mockResolvedValue({
            roundId: 'round-1',
            myVote: '5',
            votesCount: 1,
            version: 2,
            revealed: false,
        });
        const { ctx } = renderInRoom(
            <RoomDock actions={roundActions()} compact={false} />,
        );
        const deck = screen.getByRole('group', { name: 'Your cards' });

        expect(
            within(deck)
                .getAllByRole('button')
                .map((card) => card.getAttribute('aria-label')),
        ).toEqual([
            'Play 1',
            'Play 2',
            'Play 3',
            'Play 5',
            'Play 8',
            'Play ?',
            'Play ☕',
        ]);
        expect(screen.getByText('Choose your card')).toBeTruthy();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Play 5' }));
        });

        expect(mocks.request).toHaveBeenCalledTimes(1);
        expect(mocks.request.mock.calls[0][0].method).toBe('put');
        expect(mocks.request.mock.calls[0][1]).toEqual({ value: '5' });
        expect(ctx.apply).toHaveBeenNthCalledWith(1, {
            type: 'vote.mine',
            response: {
                roundId: 'round-1',
                myVote: '5',
                votesCount: 1,
                version: 1,
                revealed: false,
            },
        });
        expect(ctx.refetch).not.toHaveBeenCalled();
    });

    it('says which card is played and withdraws it when it is pressed again', async () => {
        mocks.request.mockResolvedValue({
            roundId: 'round-1',
            myVote: null,
            votesCount: 0,
            version: 3,
            revealed: false,
        });
        renderInRoom(
            <RoomDock actions={roundActions()} compact={false} />,
            pokerSnapshot({
                current: {
                    taskId: 't1',
                    round: pokerRound({
                        myVote: '5',
                        votesCount: 1,
                        votes: [{ playerId: 'ada', value: '5' }],
                    }),
                },
            }),
        );

        expect(
            screen.getByText(/you can change it until the reveal/).textContent,
        ).toBe('Your card · 5 — you can change it until the reveal');
        expect(
            screen
                .getByRole('button', { name: 'Play 5' })
                .getAttribute('aria-pressed'),
        ).toBe('true');

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Play 5' }));
        });

        expect(mocks.request.mock.calls[0][0].method).toBe('delete');
    });

    it('refetches when the played card revealed the round', async () => {
        mocks.request.mockResolvedValue({
            roundId: 'round-1',
            myVote: '3',
            votesCount: 3,
            version: 4,
            revealed: true,
        });
        const { ctx } = renderInRoom(
            <RoomDock actions={roundActions()} compact={false} />,
        );

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Play 3' }));
        });

        expect(ctx.refetch).toHaveBeenCalledTimes(1);
    });

    it('keeps the deck, disabled, once the cards are revealed and on an ended game', () => {
        const { unmount } = renderInRoom(
            <RoomDock actions={roundActions()} compact={false} />,
            pokerSnapshot({ current: { taskId: 't1', round: revealed } }),
        );

        expect(screen.getByRole('button', { name: 'Play 5' })).toHaveProperty(
            'disabled',
            true,
        );
        expect(
            screen
                .getByRole('button', { name: 'Play 8' })
                .getAttribute('aria-pressed'),
        ).toBe('true');
        expect(
            document.querySelector('[data-slot="poker-dock-status"]')
                ?.textContent,
        ).toBe('Your card · 8');
        unmount();

        renderInRoom(
            <RoomDock actions={roundActions()} compact={false} />,
            pokerSnapshot({
                game: { endedAt: '2026-10-02T10:00:00Z' },
                current: null,
            }),
        );

        expect(screen.getByRole('button', { name: 'Play 5' })).toHaveProperty(
            'disabled',
            true,
        );
        expect(screen.queryByRole('toolbar')).toBeNull();
    });

    it('shows a watcher the deck, disabled and under the name of the deck, never as "Your cards"', () => {
        renderInRoom(
            <RoomDock actions={roundActions()} compact={false} />,
            pokerSnapshot({ me: { isSpectator: true, canVote: false } }),
        );
        const deck = screen.getByRole('group', { name: 'Fibonacci deck' });

        expect(screen.queryByRole('group', { name: 'Your cards' })).toBeNull();
        expect(deck.getAttribute('aria-disabled')).toBe('true');
        expect(within(deck).queryAllByRole('button')).toHaveLength(0);
        expect(within(deck).getAllByRole('img')).toHaveLength(7);
        expect(
            screen.getByText('Deck disabled while you watch only'),
        ).toBeTruthy();
    });

    it('has no deck while the game has no task, and still shows the reaction bar', () => {
        const { container } = renderInRoom(
            <RoomDock
                actions={roundActions()}
                compact={false}
                reactions={<div role="toolbar" aria-label="Reactions" />}
            />,
            pokerSnapshot({ tasks: [], current: null }),
        );

        expect(screen.getByRole('toolbar', { name: 'Reactions' })).toBeTruthy();
        expect(
            container.querySelector('[data-slot="poker-deckbar"]'),
        ).toBeNull();
    });

    it('puts the reaction bar before the deck panel, in the flow', () => {
        const { container } = renderInRoom(
            <RoomDock
                actions={roundActions()}
                compact={false}
                reactions={<div role="toolbar" aria-label="Reactions" />}
            />,
        );
        const dock = container.querySelector('[data-slot="poker-dock"]');

        expect(
            Array.from(dock?.children ?? []).map(
                (child) =>
                    child.getAttribute('data-slot') ??
                    child.getAttribute('aria-label'),
            ),
        ).toEqual(['Reactions', 'poker-deckbar']);
        expect(dock?.className).toContain('gap-3');
    });
});

describe('RoomDock, the facilitator', () => {
    it('offers only "Next task" before the reveal', () => {
        const actions = roundActions();
        renderInRoom(<RoomDock actions={actions} compact={false} />);
        const bar = screen.getByRole('toolbar', { name: 'Facilitator tools' });

        expect(bar.getAttribute('data-slot')).toBe('facilitator-bar');
        expect(
            within(bar)
                .getAllByRole('button')
                .map((button) => button.textContent),
        ).toEqual(['Next task']);

        fireEvent.click(within(bar).getByRole('button', { name: 'Next task' }));

        expect(actions.goToNext).toHaveBeenCalledTimes(1);
    });

    it('offers Re-vote, the estimate, Save estimate and Next task once the cards are revealed', () => {
        const actions = roundActions();
        renderInRoom(
            <RoomDock actions={actions} compact={false} />,
            pokerSnapshot({ current: { taskId: 't1', round: revealed } }),
        );
        const bar = screen.getByRole('toolbar', { name: 'Facilitator tools' });
        const estimate = within(bar).getByRole('combobox', {
            name: 'Estimate',
        });

        expect(
            within(bar)
                .getAllByRole('button')
                .map((button) => button.getAttribute('aria-label')),
        ).toEqual(['Re-vote', 'Save estimate', 'Next task']);
        expect(estimate.textContent).toBe('5');

        fireEvent.click(within(bar).getByRole('button', { name: 'Re-vote' }));
        fireEvent.click(
            within(bar).getByRole('button', { name: 'Save estimate' }),
        );

        expect(actions.revote).toHaveBeenCalledTimes(1);
        expect(actions.saveEstimate).toHaveBeenCalledWith('5');
    });

    it('proposes the saved estimate first, and disables Next task when every other task is estimated', () => {
        const actions = roundActions({ next: null });
        renderInRoom(
            <RoomDock actions={actions} compact={false} />,
            pokerSnapshot({
                tasks: [pokerTask('t1', 'Login page', { estimate: '8' })],
                current: { taskId: 't1', round: revealed },
            }),
        );
        const next = screen.getByRole('button', { name: 'Next task' });

        expect(
            screen.getByRole('combobox', { name: 'Estimate' }).textContent,
        ).toBe('8');
        expect(next.getAttribute('aria-disabled')).toBe('true');

        fireEvent.click(next);

        expect(actions.goToNext).not.toHaveBeenCalled();
    });

    it('ignores the actions while one is on its way', () => {
        const actions = roundActions({ busy: true });
        renderInRoom(
            <RoomDock actions={actions} compact={false} />,
            pokerSnapshot({ current: { taskId: 't1', round: revealed } }),
        );

        fireEvent.click(screen.getByRole('button', { name: 'Re-vote' }));
        fireEvent.click(screen.getByRole('button', { name: 'Save estimate' }));

        expect(actions.revote).not.toHaveBeenCalled();
        expect(actions.saveEstimate).not.toHaveBeenCalled();
    });

    it('shows the actions to the facilitator only, and to one who watches', () => {
        const { unmount } = renderInRoom(
            <RoomDock actions={roundActions()} compact={false} />,
            pokerSnapshot({ me: { isFacilitator: false } }),
        );

        expect(screen.queryByRole('toolbar')).toBeNull();
        unmount();

        renderInRoom(
            <RoomDock actions={roundActions()} compact={false} />,
            pokerSnapshot({
                me: { isSpectator: true, canVote: false },
                current: { taskId: 't1', round: revealed },
            }),
        );

        expect(
            screen.getByRole('toolbar', { name: 'Facilitator tools' }),
        ).toBeTruthy();
        expect(screen.queryByRole('group', { name: 'Your cards' })).toBeNull();
    });
});

describe('RoomDock on a phone', () => {
    it('opens the whole deck in the vote drawer and plays the validated card', async () => {
        mocks.request.mockResolvedValue({
            roundId: 'round-1',
            myVote: '8',
            votesCount: 1,
            version: 2,
            revealed: false,
        });
        renderInRoom(
            <RoomDock actions={roundActions()} compact />,
            pokerSnapshot({ me: { isFacilitator: false } }),
        );

        fireEvent.click(screen.getByRole('button', { name: 'All deck' }));

        const drawer = await screen.findByRole('dialog');

        fireEvent.click(
            within(drawer).getByRole('radio', { name: '8 points' }),
        );

        await act(async () => {
            fireEvent.click(
                within(drawer).getByRole('button', {
                    name: 'Validate 8 points',
                }),
            );
        });

        expect(mocks.request.mock.calls[0][1]).toEqual({ value: '8' });
    });

    it('has no "All deck" for a watcher or once the round is closed', () => {
        renderInRoom(
            <RoomDock actions={roundActions()} compact />,
            pokerSnapshot({ current: { taskId: 't1', round: revealed } }),
        );

        expect(screen.queryByRole('button', { name: 'All deck' })).toBeNull();
    });
});
