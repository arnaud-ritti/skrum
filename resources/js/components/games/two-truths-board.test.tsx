import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameRound } from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { RoomProvider, type RoomContextValue } from './room-context';
import { TwoTruthsBoard, TwoTruthsResult } from './two-truths-board';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
});

const players = ['ada', 'bob', 'cy', 'dee'].map((id) => ({
    id,
    presenceId: `presence-${id}`,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    avatarUrl: '',
    isGuest: false,
}));

function round(overrides: Partial<GameRound> = {}): GameRound {
    return {
        id: 'round',
        game: 'two_truths',
        leaderPlayerId: 'bob',
        revealedAt: null,
        turnOrder: [],
        turnPlayerId: null,
        turnEndsAt: null,
        statements: ['I have met a bear', 'I speak Welsh', 'I ran a marathon'],
        voters: ['cy'],
        myChoice: null,
        ...overrides,
    } as GameRound;
}

function renderWithRoom(
    ui: React.ReactElement,
    { me = 'ada', isHost = false } = {},
) {
    const dispatch = vi.fn();
    const refetch = vi.fn();
    const ctx = {
        snapshot: {
            room: { id: 'room', game: 'two_truths', isHost },
            me: { playerId: me },
            players,
        },
        online: players.map((player) => ({ id: player.presenceId })),
        dispatch,
        run: <T,>(mutation: Promise<T>) =>
            mutation.catch(() => undefined) as Promise<T | undefined>,
        refetch,
    } as unknown as RoomContextValue;

    renderWithProviders(<RoomProvider value={ctx}>{ui}</RoomProvider>);

    return { dispatch, refetch };
}

describe('TwoTruthsBoard', () => {
    beforeEach(() => {
        mocks.request.mockReset();
    });

    it("shows the teller's three statements as a choice of the lie, and who voted", () => {
        renderWithRoom(<TwoTruthsBoard round={round()} />);

        expect(screen.getByText("Bob's statements")).toBeTruthy();

        const group = screen.getByRole('radiogroup', {
            name: 'Which one is the lie?',
        });

        expect(within(group).getAllByRole('radio')).toHaveLength(3);
        expect(screen.getByText('1 of 3 voted')).toBeTruthy();
        expect(
            screen.queryByRole('button', { name: 'Reveal the lie' }),
        ).toBeNull();
    });

    it('sends a pick at once, shown before the answer', async () => {
        mocks.request.mockResolvedValue(null);
        const { dispatch } = renderWithRoom(<TwoTruthsBoard round={round()} />);

        await act(async () => {
            fireEvent.click(
                screen.getByRole('radio', { name: /I speak Welsh/ }),
            );
        });

        expect(dispatch).toHaveBeenNthCalledWith(1, {
            type: 'round.patched',
            roundId: 'round',
            patch: { myChoice: 1 },
        });
        expect(mocks.request.mock.calls[0][0].method).toBe('put');
        expect(mocks.request.mock.calls[0][1]).toEqual({ choice: '1' });
        expect(dispatch).toHaveBeenCalledWith({
            type: 'vote.changed',
            roundId: 'round',
            playerId: 'ada',
            voted: true,
        });
    });

    it('withdraws the pick on a second click on the chosen card', async () => {
        mocks.request.mockResolvedValue(null);
        const { dispatch } = renderWithRoom(
            <TwoTruthsBoard round={round({ myChoice: 2, voters: ['ada'] })} />,
        );
        const chosen = screen.getByRole('radio', { name: /I ran a marathon/ });

        expect(chosen.getAttribute('aria-checked')).toBe('true');

        await act(async () => {
            fireEvent.click(chosen);
        });

        expect(mocks.request.mock.calls[0][0].method).toBe('delete');
        expect(dispatch).toHaveBeenCalledWith({
            type: 'round.patched',
            roundId: 'round',
            patch: { myChoice: null },
        });
        expect(dispatch).toHaveBeenCalledWith({
            type: 'vote.changed',
            roundId: 'round',
            playerId: 'ada',
            voted: false,
        });
    });

    it('puts the pick back when the server refuses it', async () => {
        mocks.request.mockRejectedValue(new Error('refused'));
        const { dispatch } = renderWithRoom(
            <TwoTruthsBoard round={round({ myChoice: 0 })} />,
        );

        await act(async () => {
            fireEvent.click(
                screen.getByRole('radio', { name: /I speak Welsh/ }),
            );
        });

        expect(dispatch).toHaveBeenLastCalledWith({
            type: 'round.patched',
            roundId: 'round',
            patch: { myChoice: 0 },
        });
    });

    it('shows the teller their lie, without a vote, and the reveal', () => {
        renderWithRoom(<TwoTruthsBoard round={round({ lieIndex: 1 })} />, {
            me: 'bob',
        });

        expect(screen.queryByRole('radiogroup')).toBeNull();
        expect(screen.getByText('Your statements')).toBeTruthy();

        const lie = screen
            .getAllByRole('listitem')
            .find((item) => item.textContent?.includes('I speak Welsh'));

        expect(lie && within(lie).getByText('Lie')).toBeTruthy();
        expect(
            screen.getByRole('button', { name: 'Reveal the lie' }),
        ).toBeTruthy();
    });

    it('lets the host reveal the lie, which ends the round', async () => {
        const ended = { roundId: 'round', outcome: 'revealed', points: [] };
        mocks.request.mockResolvedValue({ ended });
        const { dispatch, refetch } = renderWithRoom(
            <TwoTruthsBoard round={round()} />,
            { isHost: true },
        );

        await act(async () => {
            fireEvent.click(
                screen.getByRole('button', { name: 'Reveal the lie' }),
            );
        });

        expect(dispatch).toHaveBeenCalledWith({ type: 'round.ended', ended });
        expect(refetch).toHaveBeenCalled();
    });
});

describe('TwoTruthsResult', () => {
    it('marks the lie and the truths, with who picked each and the points of the finders', () => {
        renderWithRoom(
            <TwoTruthsResult
                statements={[
                    'I have met a bear',
                    'I speak Welsh',
                    'I ran a marathon',
                ]}
                lieIndex={1}
                votes={[
                    { index: 0, playerIds: ['cy'] },
                    { index: 1, playerIds: ['ada', 'dee'] },
                    { index: 2, playerIds: [] },
                ]}
                points={[
                    { playerId: 'ada', points: 5, isWin: true },
                    { playerId: 'dee', points: 5, isWin: true },
                    { playerId: 'bob', points: 2, isWin: false },
                ]}
            />,
        );

        const cards = screen.getAllByRole('listitem');
        const lie = cards.find((card) =>
            card.textContent?.includes('I speak Welsh'),
        ) as HTMLElement;
        const truth = cards.find((card) =>
            card.textContent?.includes('I have met a bear'),
        ) as HTMLElement;

        expect(within(lie).getByText('Lie')).toBeTruthy();
        expect(within(truth).getByText('True')).toBeTruthy();
        expect(within(lie).getByLabelText('Picked by Ada, Dee')).toBeTruthy();
        expect(within(lie).getByText('+5')).toBeTruthy();
        expect(within(truth).getByLabelText('Picked by Cy')).toBeTruthy();
        expect(within(truth).queryByText('+5')).toBeNull();
    });

    it('shows the same marks without points in the history', () => {
        renderWithRoom(
            <TwoTruthsResult
                statements={['One', 'Two', 'Three']}
                lieIndex={0}
                votes={[]}
            />,
        );

        expect(screen.getAllByText('True')).toHaveLength(2);
        expect(screen.getByText('Lie')).toBeTruthy();
        expect(screen.queryByText('+5')).toBeNull();
    });
});
