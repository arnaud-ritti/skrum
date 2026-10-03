import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameRound, GameWordGuessResponse } from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { HangmanWordGuess } from './hangman-word-guess';
import { RoomProvider, type RoomContextValue } from './room-context';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
});

beforeEach(() => {
    mocks.request.mockReset();
});

const round = { id: 'round', game: 'hangman' } as GameRound;

function renderField(disabled = false) {
    const dispatch = vi.fn();
    const refetch = vi.fn().mockResolvedValue(undefined);
    const ctx = {
        snapshot: {
            room: { id: 'r1', game: 'hangman' },
            me: { playerId: 'ada' },
            players: [],
        },
        run: <T,>(mutation: Promise<T>) => mutation,
        dispatch,
        refetch,
    } as unknown as RoomContextValue;

    renderWithProviders(
        <RoomProvider value={ctx}>
            <HangmanWordGuess round={round} disabled={disabled} />
        </RoomProvider>,
    );

    return { dispatch, refetch };
}

function field(): HTMLInputElement {
    return screen.getByRole('textbox', {
        name: 'Guess the whole word (+5 pts, −1 life if wrong)',
    });
}

function response(
    overrides: Partial<GameWordGuessResponse>,
): GameWordGuessResponse {
    return {
        result: 'wrong',
        guessId: 'g1',
        misses: 3,
        turnPlayerId: 'ines',
        turnEndsAt: '2026-10-03T10:00:30+00:00',
        ended: null,
        ...overrides,
    };
}

describe('HangmanWordGuess', () => {
    it('sends nothing for an empty word', async () => {
        renderField();

        await userEvent.type(field(), '   {Enter}');

        expect(mocks.request).not.toHaveBeenCalled();
    });

    it('is locked out of turn', () => {
        renderField(true);

        expect(field().disabled).toBe(true);
        expect(
            (screen.getByRole('button', { name: 'Guess' }) as HTMLButtonElement)
                .disabled,
        ).toBe(true);
    });

    it('costs a life on a wrong word and passes the turn', async () => {
        mocks.request.mockResolvedValue(response({}));
        const { dispatch } = renderField();

        await userEvent.type(field(), 'laptop{Enter}');

        await waitFor(() =>
            expect(screen.getByRole('status').textContent).toBe(
                'Missed: −1 life',
            ),
        );
        expect(mocks.request.mock.calls[0][1]).toEqual({ text: 'laptop' });
        expect(dispatch).toHaveBeenCalledWith({
            type: 'guess.added',
            roundId: 'round',
            guess: { id: 'g1', playerId: 'ada', text: 'laptop' },
            misses: 3,
        });
        expect(dispatch).toHaveBeenCalledWith({
            type: 'turn.changed',
            turn: {
                roundId: 'round',
                turnPlayerId: 'ines',
                turnEndsAt: '2026-10-03T10:00:30+00:00',
            },
        });
        expect(field().value).toBe('');
        expect(field().getAttribute('data-shake')).toBe('true');
    });

    it('ends the round on the right word', async () => {
        const ended = { roundId: 'round', outcome: 'solved' };

        mocks.request.mockResolvedValue(
            response({ result: 'correct', ended: ended as never }),
        );
        const { dispatch, refetch } = renderField();

        await userEvent.type(field(), 'zanzibar');
        await userEvent.click(screen.getByRole('button', { name: 'Guess' }));

        await waitFor(() =>
            expect(dispatch).toHaveBeenCalledWith({
                type: 'round.ended',
                ended,
            }),
        );
        expect(refetch).toHaveBeenCalled();
        expect(screen.queryByText('Missed: −1 life')).toBeNull();
    });
});
