import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameRound } from '@/lib/games/types';
import { RetroRequestError } from '@/lib/retro/api';
import { renderWithProviders } from '@/test/render';
import { GameLayout } from './game-layout';
import { QuickQuestionBoard } from './quick-question-board';
import { RoomProvider, type RoomContextValue } from './room-context';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
});

function viewport(widestRem: number): void {
    vi.spyOn(window, 'matchMedia').mockImplementation(
        (query: string) =>
            ({
                matches:
                    Number(/min-width: (\d+)rem/.exec(query)?.[1]) <= widestRem,
                media: query,
                addEventListener: () => undefined,
                removeEventListener: () => undefined,
            }) as unknown as MediaQueryList,
    );
}

const players = ['ada', 'bob', 'ines'].map((id) => ({
    id,
    presenceId: `presence-${id}`,
    name: id === 'ines' ? 'Inès' : id.charAt(0).toUpperCase() + id.slice(1),
    avatarUrl: '',
    isGuest: false,
}));

function round(overrides: Partial<GameRound> = {}): GameRound {
    return {
        id: 'round',
        game: 'quick_question',
        leaderPlayerId: null,
        revealedAt: null,
        number: null,
        roundsTotal: null,
        turnOrder: ['ada', 'ines', 'bob'],
        turnPlayerId: 'ada',
        turnEndsAt: null,
        turnSeconds: null,
        hintSeconds: null,
        question: 'Your perfect weekend?',
        ...overrides,
    } as GameRound;
}

function renderBoard(
    value: GameRound,
    { me = 'ada', isHost = false, wide = true } = {},
) {
    const dispatch = vi.fn();
    const refetch = vi.fn();
    const ctx = {
        snapshot: {
            room: {
                id: 'room',
                game: 'quick_question',
                isHost,
                settings: { turnSeconds: null },
            },
            me: { playerId: me },
            players,
            round: value,
            history: [],
        },
        online: players.map((player) => ({ id: player.presenceId })),
        dispatch,
        run: <T,>(mutation: Promise<T>) =>
            mutation.catch(() => undefined) as Promise<T | undefined>,
        refetch,
    } as unknown as RoomContextValue;

    viewport(wide ? 90 : 24);
    renderWithProviders(
        <RoomProvider value={ctx}>
            <GameLayout stage={<QuickQuestionBoard round={value} />} />
        </RoomProvider>,
    );

    return { dispatch, refetch };
}

beforeEach(() => {
    mocks.request.mockReset();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('QuickQuestionBoard', () => {
    it('gives the speaker "Done", which ends my turn and passes the word', async () => {
        mocks.request.mockResolvedValue({
            turn: { roundId: 'round', turnPlayerId: 'ines', turnEndsAt: null },
            ended: null,
        });
        const { dispatch, refetch } = renderBoard(round());

        expect(screen.getByText('Your perfect weekend?')).toBeTruthy();
        expect(screen.getByText('Your turn to speak')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        });

        expect(mocks.request.mock.calls[0][0].method).toBe('post');
        expect(mocks.request.mock.calls[0][0].url).toContain(
            '/rounds/round/turn',
        );
        expect(mocks.request.mock.calls[0][1]).toEqual({
            expected_player_id: 'ada',
        });
        expect(dispatch).toHaveBeenCalledWith({
            type: 'turn.changed',
            turn: { roundId: 'round', turnPlayerId: 'ines', turnEndsAt: null },
        });
        expect(refetch).not.toHaveBeenCalled();
    });

    it('shows who speaks to the others, with no button for a player', () => {
        renderBoard(round({ turnPlayerId: 'ines' }), { me: 'bob' });

        const speaker = document.querySelector<HTMLElement>(
            '[data-slot="quick-question-speaker"]',
        );

        expect(within(speaker!).getByText('Inès is speaking')).toBeTruthy();
        expect(
            within(speaker!)
                .getByText('Inès is speaking')
                .getAttribute('aria-live'),
        ).toBe('polite');
        expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    });

    it('gives the host "Next" for another speaker', async () => {
        mocks.request.mockResolvedValue({
            turn: { roundId: 'round', turnPlayerId: 'bob', turnEndsAt: null },
            ended: null,
        });
        renderBoard(round({ turnPlayerId: 'ines' }), { isHost: true });

        expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        });

        expect(mocks.request.mock.calls[0][1]).toEqual({
            expected_player_id: 'ines',
        });
    });

    it('lets the host change the question until the first turn ends', () => {
        renderBoard(round(), { isHost: true });

        expect(
            screen.getByRole('button', { name: 'Another question' }),
        ).toBeTruthy();
    });

    it('locks the question once the first speaker is done', () => {
        renderBoard(round({ turnPlayerId: 'ines' }), { isHost: true });

        expect(
            screen.queryByRole('button', { name: 'Another question' }),
        ).toBeNull();
    });

    it('ends the round after the last speaker', async () => {
        const ended = {
            roundId: 'round',
            outcome: 'finished',
            word: null,
            winnerPlayerId: null,
            leaderPlayerId: null,
            points: [],
            question: 'Your perfect weekend?',
        };
        mocks.request.mockResolvedValue({
            turn: { roundId: 'round', turnPlayerId: null, turnEndsAt: null },
            ended,
        });
        const { dispatch, refetch } = renderBoard(
            round({ turnPlayerId: 'bob' }),
            { me: 'bob' },
        );

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        });

        expect(dispatch).toHaveBeenCalledWith({ type: 'round.ended', ended });
        expect(refetch).toHaveBeenCalled();
    });

    it('refetches quietly when the turn already moved on', async () => {
        mocks.request.mockRejectedValue(
            new RetroRequestError(409, 'The turn has already moved on.'),
        );
        const { dispatch, refetch } = renderBoard(round());

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        });

        expect(refetch).toHaveBeenCalled();
        expect(dispatch).not.toHaveBeenCalled();
    });

    it('keeps the speaking order in the side column on a wide screen, untimed', () => {
        renderBoard(round());

        const board = document.querySelector<HTMLElement>(
            '[data-slot="quick-question-board"]',
        );

        expect(board!.querySelector('[data-slot="turn-order"]')).toBeNull();
        expect(board!.querySelector('[data-slot="turn-timer"]')).toBeNull();
    });

    it('docks "Done" at the bottom of a phone, the speaking order on the stage', () => {
        renderBoard(round(), { wide: false });

        const footer = document.querySelector<HTMLElement>(
            '[data-slot="game-footer"]',
        );
        const board = document.querySelector<HTMLElement>(
            '[data-slot="quick-question-board"]',
        );

        expect(
            within(footer!).getByRole('button', { name: 'Done' }),
        ).toBeTruthy();
        expect(
            within(board!).queryByRole('button', { name: 'Done' }),
        ).toBeNull();
        expect(
            within(board!).getByRole('list', { name: 'Speaking order' }),
        ).toBeTruthy();
    });

    it('leaves the dock out for a player who only listens on a phone', () => {
        renderBoard(round({ turnPlayerId: 'ines' }), {
            me: 'bob',
            wide: false,
        });

        expect(
            document.querySelector('[data-slot="quick-question-dock"]'),
        ).toBeNull();
    });
});
