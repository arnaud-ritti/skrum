import { act, fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameRound } from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { GuessWhoVote } from './guess-who-vote';
import { RoomProvider, type RoomContextValue } from './room-context';

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
        game: 'guess_who',
        leaderPlayerId: null,
        revealedAt: '2026-10-03T10:00:00Z',
        turnOrder: [],
        turnPlayerId: null,
        turnEndsAt: null,
        question: 'What was your first job?',
        answers: [],
        myAnswer: { id: 'mine', text: 'Lifeguard' },
        drawn: { id: 'answer', text: 'Paperboy' },
        candidates: ['ada', 'bob', 'cy'],
        votedCount: 1,
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
            room: { id: 'room', game: 'guess_who', isHost },
            me: { playerId: me },
            players,
        },
        online: players.map((player) => ({ id: player.presenceId })),
        dispatch,
        run: <T,>(mutation: Promise<T>) =>
            mutation.catch(() => undefined) as Promise<T | undefined>,
        refetch,
    } as unknown as RoomContextValue;

    const view = renderWithProviders(
        <RoomProvider value={ctx}>{ui}</RoomProvider>,
    );
    const rerender = (next: React.ReactElement) =>
        view.rerender(<RoomProvider value={ctx}>{next}</RoomProvider>);

    return { dispatch, refetch, rerender };
}

describe('GuessWhoVote', () => {
    beforeEach(() => {
        mocks.request.mockReset();
    });

    it('shows the drawn answer and the candidates but me, with only a count of votes', () => {
        renderWithRoom(<GuessWhoVote round={round()} />);

        expect(screen.getByText('Paperboy')).toBeTruthy();

        const group = screen.getByRole('radiogroup', {
            name: 'Who wrote this?',
        });
        const candidates = within(group).getAllByRole('radio');

        expect(
            candidates.map((candidate) => candidate.getAttribute('aria-label')),
        ).toEqual(['Bob', 'Cy']);
        expect(
            candidates.every(
                (candidate) =>
                    candidate.getAttribute('aria-checked') === 'false',
            ),
        ).toBe(true);
        expect(screen.getByText('1 voted')).toBeTruthy();
        expect(
            screen.queryByRole('button', { name: 'Show the author' }),
        ).toBeNull();
    });

    it('sends my choice at once and counts my vote', async () => {
        mocks.request.mockResolvedValue(null);
        const { dispatch } = renderWithRoom(<GuessWhoVote round={round()} />);

        await act(async () => {
            fireEvent.click(screen.getByRole('radio', { name: 'Cy' }));
        });

        expect(dispatch).toHaveBeenNthCalledWith(1, {
            type: 'round.patched',
            roundId: 'round',
            patch: { myChoice: 'cy' },
        });
        expect(mocks.request.mock.calls[0][0].method).toBe('put');
        expect(mocks.request.mock.calls[0][1]).toEqual({ choice: 'cy' });
        expect(dispatch).toHaveBeenCalledWith({
            type: 'votes.counted',
            counted: { roundId: 'round', voted: 2 },
        });
    });

    it('marks my choice and withdraws it on a second click', async () => {
        mocks.request.mockResolvedValue(null);
        const { dispatch } = renderWithRoom(
            <GuessWhoVote round={round({ myChoice: 'bob', votedCount: 2 })} />,
        );
        const bob = screen.getByRole('radio', { name: 'Bob' });

        expect(bob.getAttribute('aria-checked')).toBe('true');

        await act(async () => {
            fireEvent.click(bob);
        });

        expect(mocks.request.mock.calls[0][0].method).toBe('delete');
        expect(dispatch).toHaveBeenCalledWith({
            type: 'votes.counted',
            counted: { roundId: 'round', voted: 1 },
        });
    });

    it('uncounts my vote withdrawn after it came from another device', async () => {
        mocks.request.mockResolvedValue(null);
        const { dispatch, rerender } = renderWithRoom(
            <GuessWhoVote round={round()} />,
        );

        rerender(
            <GuessWhoVote round={round({ myChoice: 'bob', votedCount: 2 })} />,
        );

        await act(async () => {
            fireEvent.click(screen.getByRole('radio', { name: 'Bob' }));
        });

        expect(mocks.request.mock.calls[0][0].method).toBe('delete');
        expect(dispatch).toHaveBeenCalledWith({
            type: 'votes.counted',
            counted: { roundId: 'round', voted: 1 },
        });
    });

    it('confirms a pick reached with the arrow keys when it is clicked at once', async () => {
        mocks.request.mockResolvedValue(null);

        function Stateful() {
            const [current, setCurrent] = useState(round());
            const ctx = {
                snapshot: {
                    room: { id: 'room', game: 'guess_who', isHost: false },
                    me: { playerId: 'ada' },
                    players,
                },
                online: [],
                dispatch: (action: {
                    type: string;
                    patch?: Partial<GameRound>;
                }) => {
                    if (action.type === 'round.patched') {
                        setCurrent((previous) => ({
                            ...previous,
                            ...action.patch,
                        }));
                    }
                },
                run: <T,>(mutation: Promise<T>) => mutation,
                refetch: vi.fn(),
            } as unknown as RoomContextValue;

            return (
                <RoomProvider value={ctx}>
                    <GuessWhoVote round={current} />
                </RoomProvider>
            );
        }

        renderWithProviders(<Stateful />);

        const cy = screen.getByRole('radio', { name: 'Cy' });

        fireEvent.keyDown(screen.getByRole('radiogroup'), {
            key: 'ArrowRight',
        });
        fireEvent.click(cy);

        expect(cy.getAttribute('aria-checked')).toBe('true');

        await act(async () => {
            fireEvent.pointerDown(cy);
            fireEvent.click(cy);
        });

        expect(mocks.request).toHaveBeenCalledTimes(1);
        expect(mocks.request.mock.calls[0][0].method).toBe('put');
        expect(cy.getAttribute('aria-checked')).toBe('true');
    });

    it('puts my choice back when the server refuses it, without counting it', async () => {
        mocks.request.mockRejectedValue(new Error('refused'));
        const { dispatch } = renderWithRoom(<GuessWhoVote round={round()} />);

        await act(async () => {
            fireEvent.click(screen.getByRole('radio', { name: 'Bob' }));
        });

        expect(dispatch).toHaveBeenLastCalledWith({
            type: 'round.patched',
            roundId: 'round',
            patch: { myChoice: null },
        });
        expect(dispatch).not.toHaveBeenCalledWith(
            expect.objectContaining({ type: 'votes.counted' }),
        );
    });

    it('tells the author the others are guessing, with no choice', () => {
        renderWithRoom(
            <GuessWhoVote
                round={round({ myAnswer: { id: 'answer', text: 'Paperboy' } })}
            />,
        );

        expect(
            screen.getByText("It's your answer — the others are guessing."),
        ).toBeTruthy();
        expect(screen.queryByRole('radiogroup')).toBeNull();
        expect(screen.getByText('1 voted')).toBeTruthy();
    });

    it('lets the host show the author, which ends the round', async () => {
        const ended = { roundId: 'round', outcome: 'revealed', points: [] };
        mocks.request.mockResolvedValue({ ended });
        const { dispatch, refetch } = renderWithRoom(
            <GuessWhoVote round={round()} />,
            { isHost: true },
        );

        await act(async () => {
            fireEvent.click(
                screen.getByRole('button', { name: 'Show the author' }),
            );
        });

        expect(mocks.request.mock.calls[0][0].method).toBe('post');
        expect(mocks.request.mock.calls[0][0].url).toContain('/close');
        expect(dispatch).toHaveBeenCalledWith({ type: 'round.ended', ended });
        expect(refetch).toHaveBeenCalled();
    });

    it('lays the candidates full width on a phone', () => {
        renderWithRoom(<GuessWhoVote round={round()} />);

        expect(screen.getByRole('radiogroup').className).toContain('w-full');
        expect(screen.getByRole('radio', { name: 'Bob' }).className).toContain(
            'min-h-11',
        );
    });
});
