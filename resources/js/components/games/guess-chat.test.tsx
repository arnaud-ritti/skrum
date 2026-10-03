import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameRound } from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { GuessChat, GuessDock } from './guess-chat';
import { RoomProvider, type RoomContextValue } from './room-context';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
});

beforeEach(() => {
    mocks.request.mockReset();
});

function player(id: string, name: string) {
    return {
        id,
        presenceId: `presence-${id}`,
        name,
        avatarUrl: null,
        isGuest: false,
    };
}

function setup(round: Partial<GameRound>, me = 'cy') {
    const dispatch = vi.fn();
    const ctx = {
        snapshot: {
            room: { id: 'r1', game: 'draw' },
            me: { playerId: me },
            players: [
                player('ines', 'Inès'),
                player('malik', 'Malik'),
                player('cy', 'Cy'),
            ],
        },
        dispatch,
        refetch: vi.fn(),
        run: <T,>(mutation: Promise<T>) => mutation,
    } as unknown as RoomContextValue;
    const fullRound = {
        id: 'round',
        game: 'draw',
        leaderPlayerId: 'bob',
        guessersTotal: 5,
        pointsPerFinder: 5,
        finders: [],
        guesses: [],
        ...round,
    } as GameRound;

    return { ctx, dispatch, round: fullRound };
}

describe('GuessChat, Draw & Guess finders', () => {
    it('puts a line for each finder among the guesses, where they found', () => {
        const { ctx, round } = setup({
            guesses: [
                { id: 'g1', playerId: 'cy', text: 'cup' },
                { id: 'g2', playerId: 'malik', text: 'mug' },
            ],
            finders: [
                {
                    playerId: 'ines',
                    seconds: 18,
                    points: 10,
                    afterGuessId: 'g1',
                },
                { playerId: 'malik', seconds: 31, points: 8 },
            ],
        });

        renderWithProviders(
            <RoomProvider value={ctx}>
                <GuessChat round={round} isLeader={false} />
            </RoomProvider>,
        );

        const log = screen.getByRole('log', { name: 'Guesses' });
        const lines = [...log.querySelectorAll('li')].map((line) =>
            line.textContent?.replace(/\s+/g, ' '),
        );

        expect(lines).toEqual([
            'CCycup',
            'Inès found it!+10',
            'MMalikmug',
            'Malik found it!+8',
        ]);
        expect(within(log).getAllByRole('listitem')).toHaveLength(4);
        expect(within(log).queryAllByRole('status')).toHaveLength(0);
        expect(screen.getByText('Found by · 2 / 5')).toBeTruthy();
    });

    it('replaces the field of a finder by the word', () => {
        const { ctx, round } = setup({
            word: 'ROCKET',
            finders: [{ playerId: 'cy', seconds: 12, points: 10 }],
        });

        renderWithProviders(
            <RoomProvider value={ctx}>
                <GuessChat round={round} isLeader={false} />
            </RoomProvider>,
        );

        expect(screen.queryByRole('textbox')).toBeNull();
        expect(screen.getByText('You found it: ROCKET')).toBeTruthy();
    });

    it('records the find and keeps the word when the guess is right', async () => {
        const { ctx, dispatch, round } = setup({});
        const found = { playerId: 'cy', seconds: 12, points: 10 };

        mocks.request.mockResolvedValue({
            result: 'correct',
            guessId: 'g9',
            ended: null,
            found,
            word: 'ROCKET',
        });

        renderWithProviders(
            <RoomProvider value={ctx}>
                <GuessChat round={round} isLeader={false} />
            </RoomProvider>,
        );

        await userEvent.type(
            screen.getByRole('textbox', { name: 'Your guess' }),
            'rocket{Enter}',
        );

        expect(dispatch).toHaveBeenCalledWith({
            type: 'word.found',
            found: { roundId: 'round', ...found },
        });
        expect(dispatch).toHaveBeenCalledWith({
            type: 'round.patched',
            roundId: 'round',
            patch: { word: 'ROCKET' },
        });
        expect(dispatch).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'guess.added' }),
        );
    });

    it('keeps the found-by block in the guesses drawer on a phone', async () => {
        const { ctx, round } = setup({
            finders: [{ playerId: 'ines', seconds: 18, points: 10 }],
        });

        renderWithProviders(
            <RoomProvider value={ctx}>
                <GuessDock round={round} isLeader={false} />
            </RoomProvider>,
        );

        expect(screen.queryByText('Found by · 1 / 5')).toBeNull();

        await userEvent.click(screen.getByRole('button', { name: /Guesses/ }));

        expect(
            within(screen.getByRole('dialog', { name: 'Guesses' })).getByText(
                'Found by · 1 / 5',
            ),
        ).toBeTruthy();
    });
});
