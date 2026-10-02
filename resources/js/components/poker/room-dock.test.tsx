import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameProvider } from '@/components/poker/game-context';
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
        validate: vi.fn(async () => {}),
        estimate: '5',
        estimateCards: ['1', '2', '3', '5', '8'],
        chooseEstimate: vi.fn(),
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

    it('gives its place to the result once the cards are revealed, and stays, disabled, on an ended game', () => {
        const { unmount, container } = renderInRoom(
            <RoomDock actions={roundActions()} compact={false} />,
            pokerSnapshot({ current: { taskId: 't1', round: revealed } }),
        );

        expect(screen.queryByRole('group', { name: 'Your cards' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Play 5' })).toBeNull();
        expect(
            container.querySelector(
                '[data-slot="poker-deckbar"] [aria-labelledby="poker-result"]',
            ),
        ).not.toBeNull();
        expect(
            container.querySelector('[data-slot="poker-dock-status"]')
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

    it('offers the final-estimate cards, one button that validates and moves on, and Re-vote once the cards are revealed', () => {
        const actions = roundActions();
        renderInRoom(
            <RoomDock actions={actions} compact={false} />,
            pokerSnapshot({ current: { taskId: 't1', round: revealed } }),
        );
        const tools = screen.getByRole('group', { name: 'Facilitator tools' });
        const cards = within(tools).getByRole('radiogroup', {
            name: 'Final estimate',
        });

        expect(
            within(cards)
                .getAllByRole('radio')
                .map((card) => card.getAttribute('aria-label')),
        ).toEqual(['1', '2', '3', '5', '8']);
        expect(
            within(cards)
                .getByRole('radio', { checked: true })
                .getAttribute('aria-label'),
        ).toBe('5');
        expect(
            within(tools)
                .getAllByRole('button')
                .map((button) => button.textContent),
        ).toEqual(['Validate 5 · Next story', 'Re-vote']);
        expect(screen.queryByRole('button', { name: 'Next task' })).toBeNull();
        expect(
            screen.queryByRole('button', { name: 'Save estimate' }),
        ).toBeNull();

        fireEvent.click(within(tools).getByRole('button', { name: 'Re-vote' }));
        fireEvent.click(within(cards).getByRole('radio', { name: '8' }));

        expect(actions.revote).toHaveBeenCalledTimes(1);
        expect(actions.chooseEstimate).toHaveBeenCalledWith('8');

        fireEvent.click(
            within(tools).getByRole('button', {
                name: 'Validate 5 · Next story',
            }),
        );

        expect(actions.validate).toHaveBeenCalledWith('5');
        expect(actions.saveEstimate).not.toHaveBeenCalled();
        expect(actions.goToNext).not.toHaveBeenCalled();
    });

    it('shows the agreement, the distribution and who opens the discussion to everyone', () => {
        const { container } = renderInRoom(
            <RoomDock actions={roundActions()} compact={false} />,
            pokerSnapshot({
                me: { playerId: 'bob', isFacilitator: false },
                current: {
                    taskId: 't1',
                    round: {
                        ...revealed,
                        revealReason: 'everyone_voted',
                        myVote: '3',
                        result: {
                            average: 5.5,
                            median: 5.5,
                            spread: { min: 3, max: 8 },
                            agreement: 0.5,
                            outliers: { low: ['bob'], high: ['ada'] },
                            distribution: [
                                { value: '3', count: 1 },
                                { value: '8', count: 1 },
                            ],
                            mode: ['3', '8'],
                            consensus: false,
                            nearestCard: '5',
                        },
                    },
                },
            }),
        );
        const result = container.querySelector(
            '[aria-labelledby="poker-result"]',
        ) as HTMLElement;

        expect(within(result).getByText('Result · 2 votes')).toBeTruthy();
        expect(within(result).getByText('50 % on 3, 8')).toBeTruthy();
        expect(
            within(result).getByText(
                'Bob (3) and Ada (8) open the discussion.',
            ),
        ).toBeTruthy();
        expect(
            within(result).getByText('Revealed automatically — everyone voted'),
        ).toBeTruthy();
        expect(within(result).getAllByRole('listitem')).toHaveLength(2);
        expect(within(result).queryByRole('radiogroup')).toBeNull();
        expect(
            within(result).queryByRole('button', { name: 'Re-vote' }),
        ).toBeNull();
    });

    it('names nobody on an anonymous round', () => {
        renderInRoom(
            <RoomDock actions={roundActions()} compact={false} />,
            pokerSnapshot({
                current: {
                    taskId: 't1',
                    round: {
                        ...revealed,
                        anonymous: true,
                        result: {
                            ...revealed.result!,
                            spread: { min: 3, max: 8 },
                            outliers: { low: ['bob'], high: ['ada'] },
                        },
                    },
                },
            }),
        );

        expect(screen.queryByText(/Bob \(3\)/)).toBeNull();
        expect(
            screen.getByText(
                'The lowest and the highest estimates open the discussion.',
            ),
        ).toBeTruthy();
    });

    it('only validates when every other task is estimated', () => {
        const actions = roundActions({ next: null, estimate: '8' });
        renderInRoom(
            <RoomDock actions={actions} compact={false} />,
            pokerSnapshot({ current: { taskId: 't1', round: revealed } }),
        );

        expect(
            screen
                .getByRole('radio', { checked: true })
                .getAttribute('aria-label'),
        ).toBe('8');

        fireEvent.click(screen.getByRole('button', { name: 'Validate 8' }));

        expect(actions.validate).toHaveBeenCalledWith('8');
    });

    it('ignores the actions while one is on its way', () => {
        const actions = roundActions({ busy: true });
        renderInRoom(
            <RoomDock actions={actions} compact={false} />,
            pokerSnapshot({ current: { taskId: 't1', round: revealed } }),
        );

        fireEvent.click(screen.getByRole('button', { name: 'Re-vote' }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Validate 5 · Next story' }),
        );
        fireEvent.keyDown(document.body, { key: 'Enter', ctrlKey: true });

        expect(actions.revote).not.toHaveBeenCalled();
        expect(actions.validate).not.toHaveBeenCalled();
    });

    it('shows the tools to the facilitator only, to one who watches, and not on an ended game', () => {
        const { unmount } = renderInRoom(
            <RoomDock actions={roundActions()} compact={false} />,
            pokerSnapshot({ me: { isFacilitator: false } }),
        );

        expect(screen.queryByRole('toolbar')).toBeNull();
        unmount();

        const watching = renderInRoom(
            <RoomDock actions={roundActions()} compact={false} />,
            pokerSnapshot({
                me: { isSpectator: true, canVote: false },
                current: { taskId: 't1', round: revealed },
            }),
        );

        expect(
            screen.getByRole('group', { name: 'Facilitator tools' }),
        ).toBeTruthy();
        expect(screen.queryByRole('group', { name: 'Your cards' })).toBeNull();
        watching.unmount();

        const { container } = renderInRoom(
            <RoomDock actions={roundActions()} compact={false} />,
            pokerSnapshot({
                game: { endedAt: '2026-10-02T10:00:00Z' },
                current: { taskId: 't1', round: revealed },
            }),
        );

        expect(
            container.querySelector('[aria-labelledby="poker-result"]'),
        ).not.toBeNull();
        expect(
            screen.queryByRole('group', { name: 'Facilitator tools' }),
        ).toBeNull();
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

    it('keeps only the two buttons of the facilitator once revealed: the result is a card of the stage', () => {
        const actions = roundActions();
        const { container } = renderInRoom(
            <RoomDock actions={actions} compact />,
            pokerSnapshot({ current: { taskId: 't1', round: revealed } }),
        );
        const tools = screen.getByRole('group', { name: 'Facilitator tools' });

        expect(screen.queryByRole('group', { name: 'Your cards' })).toBeNull();
        expect(
            container.querySelector('[data-slot="poker-result"]'),
        ).toBeNull();
        expect(screen.queryByRole('radiogroup')).toBeNull();
        expect(
            within(tools)
                .getAllByRole('button')
                .map(
                    (button) =>
                        button.getAttribute('aria-label') ?? button.textContent,
                ),
        ).toEqual(['Validate 5 · Next story', 'Re-vote']);

        fireEvent.click(within(tools).getByRole('button', { name: 'Re-vote' }));

        expect(actions.revote).toHaveBeenCalledTimes(1);
    });

    it('has no deck panel for a participant once revealed', () => {
        const { container } = renderInRoom(
            <RoomDock
                actions={roundActions()}
                compact
                reactions={<div role="toolbar" aria-label="Reactions" />}
            />,
            pokerSnapshot({
                me: { isFacilitator: false },
                current: { taskId: 't1', round: revealed },
            }),
        );

        expect(screen.getByRole('toolbar', { name: 'Reactions' })).toBeTruthy();
        expect(
            container.querySelector('[data-slot="poker-deckbar"]'),
        ).toBeNull();
    });
});

describe('RoomDock, the focus when the round changes state', () => {
    const reveal = (
        ctx: ReturnType<typeof renderInRoom>['ctx'],
        actions: RoundActions,
        round = revealed,
    ) => (
        <GameProvider
            value={{
                ...ctx,
                snapshot: pokerSnapshot({ current: { taskId: 't1', round } }),
            }}
        >
            <RoomDock actions={actions} compact={false} />
        </GameProvider>
    );

    it('moves focus to the deck when the pressed Re-vote leaves with the result', () => {
        const actions = roundActions();
        const { ctx, rerender } = renderInRoom(
            <RoomDock actions={actions} compact={false} />,
            pokerSnapshot({ current: { taskId: 't1', round: revealed } }),
        );

        screen.getByRole('button', { name: 'Re-vote' }).focus();

        rerender(
            reveal(ctx, actions, pokerRound({ id: 'round-2', number: 2 })),
        );

        expect(screen.queryByRole('button', { name: 'Re-vote' })).toBeNull();
        expect(
            screen
                .getByRole('group', { name: 'Your cards' })
                .contains(document.activeElement),
        ).toBe(true);
    });

    it('moves focus to the result in the dock when a reveal takes the focused card away', () => {
        const actions = roundActions();
        const { ctx, rerender, container } = renderInRoom(
            <RoomDock actions={actions} compact={false} />,
        );

        screen.getByRole('button', { name: 'Play 5' }).focus();

        rerender(reveal(ctx, actions));

        expect(document.activeElement).toBe(
            container.querySelector(
                '[data-slot="poker-dock"] [data-slot="poker-result"]',
            ),
        );
    });

    it('moves focus to the result on a reveal made from the keyboard, with focus on the page', () => {
        const actions = roundActions();
        const { ctx, rerender, container } = renderInRoom(
            <RoomDock actions={actions} compact={false} />,
        );

        expect(document.activeElement).toBe(document.body);

        rerender(reveal(ctx, actions));

        expect(document.activeElement).toBe(
            container.querySelector('[data-slot="poker-result"]'),
        );
    });

    it('leaves focus alone when it stands elsewhere', () => {
        const outside = document.createElement('button');

        document.body.append(outside);
        outside.focus();

        const actions = roundActions();
        const { ctx, rerender } = renderInRoom(
            <RoomDock actions={actions} compact={false} />,
            pokerSnapshot({ current: { taskId: 't1', round: revealed } }),
        );

        rerender(
            reveal(ctx, actions, pokerRound({ id: 'round-2', number: 2 })),
        );

        expect(document.activeElement).toBe(outside);

        rerender(reveal(ctx, actions));

        expect(document.activeElement).toBe(outside);

        outside.remove();
    });
});

describe('RoomDock, the shortcuts of the result', () => {
    it('goes to the next task with N once the cards are revealed, and not while the round is open', () => {
        const actions = roundActions();
        const { unmount } = renderInRoom(
            <RoomDock actions={actions} compact={false} />,
        );

        fireEvent.keyDown(document.body, { key: 'n' });

        expect(actions.goToNext).not.toHaveBeenCalled();
        unmount();

        renderInRoom(
            <RoomDock actions={actions} compact={false} />,
            pokerSnapshot({ current: { taskId: 't1', round: revealed } }),
        );

        fireEvent.keyDown(document.body, { key: 'n' });

        expect(actions.goToNext).toHaveBeenCalledTimes(1);
    });

    it('validates the chosen estimate with Ctrl or Cmd and Enter', () => {
        const actions = roundActions();
        renderInRoom(
            <RoomDock actions={actions} compact={false} />,
            pokerSnapshot({ current: { taskId: 't1', round: revealed } }),
        );

        fireEvent.keyDown(document.body, { key: 'Enter', ctrlKey: true });

        expect(actions.validate).toHaveBeenCalledWith('5');
    });
});
