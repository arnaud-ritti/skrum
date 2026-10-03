import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameRound } from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { GuessWhoBoard, GuessWhoResult } from './guess-who-board';
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
        revealedAt: null,
        turnOrder: [],
        turnPlayerId: null,
        turnEndsAt: null,
        question: 'What was your first job?',
        answers: [{ playerId: 'bob', answered: true }],
        myAnswer: null,
        drawn: null,
        candidates: [],
        votedCount: 0,
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

    renderWithProviders(<RoomProvider value={ctx}>{ui}</RoomProvider>);

    return { dispatch, refetch };
}

describe('GuessWhoBoard, the answers', () => {
    beforeEach(() => {
        mocks.request.mockReset();
    });

    it('asks the question and waits for my answer, with who has answered', () => {
        renderWithRoom(<GuessWhoBoard round={round()} />);

        expect(screen.getByText('What was your first job?')).toBeTruthy();
        expect(
            (screen.getByLabelText('Your answer') as HTMLTextAreaElement).value,
        ).toBe('');
        expect(screen.getByText('0 / 120')).toBeTruthy();
        expect(
            screen
                .getByRole('button', { name: 'Send' })
                .hasAttribute('disabled'),
        ).toBe(true);
        expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
        expect(screen.getByText('1 answered')).toBeTruthy();
        expect(
            within(
                screen.getByRole('list', { name: 'Answered: Bob' }),
            ).getAllByRole('listitem'),
        ).toHaveLength(1);
        expect(
            screen.queryByRole('button', { name: 'Draw an answer' }),
        ).toBeNull();
    });

    it('sends my answer and counts me among those who answered', async () => {
        mocks.request.mockResolvedValue({
            myAnswer: { id: 'mine', text: 'Paperboy' },
        });
        const { dispatch } = renderWithRoom(<GuessWhoBoard round={round()} />);

        fireEvent.change(screen.getByLabelText('Your answer'), {
            target: { value: '  Paperboy ' },
        });

        expect(screen.getByText('11 / 120')).toBeTruthy();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Send' }));
        });

        expect(mocks.request.mock.calls[0][0].method).toBe('put');
        expect(mocks.request.mock.calls[0][1]).toEqual({ text: 'Paperboy' });
        expect(dispatch).toHaveBeenCalledWith({
            type: 'round.patched',
            roundId: 'round',
            patch: { myAnswer: { id: 'mine', text: 'Paperboy' } },
        });
        expect(dispatch).toHaveBeenCalledWith({
            type: 'answer.changed',
            roundId: 'round',
            playerId: 'ada',
            answered: true,
        });
    });

    it('keeps my sent answer in the field, to change or remove until the draw', async () => {
        mocks.request.mockResolvedValue(null);
        const { dispatch } = renderWithRoom(
            <GuessWhoBoard
                round={round({
                    answers: [
                        { playerId: 'ada', answered: true },
                        { playerId: 'bob', answered: true },
                    ],
                    myAnswer: { id: 'mine', text: 'Paperboy' },
                })}
            />,
        );

        expect(
            (screen.getByLabelText('Your answer') as HTMLTextAreaElement).value,
        ).toBe('Paperboy');
        expect(
            screen
                .getByRole('button', { name: 'Send' })
                .hasAttribute('disabled'),
        ).toBe(true);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
        });

        expect(mocks.request.mock.calls[0][0].method).toBe('delete');
        expect(dispatch).toHaveBeenCalledWith({
            type: 'round.patched',
            roundId: 'round',
            patch: { myAnswer: null },
        });
        expect(dispatch).toHaveBeenCalledWith({
            type: 'answer.changed',
            roundId: 'round',
            playerId: 'ada',
            answered: false,
        });
    });

    it('lets the host shuffle the question before the first answer only', () => {
        renderWithRoom(<GuessWhoBoard round={round({ answers: [] })} />, {
            isHost: true,
        });

        expect(
            screen.getByRole('button', { name: 'Shuffle question' }),
        ).toBeTruthy();
    });

    it('keeps the draw from the host under two answers, and says why', () => {
        renderWithRoom(<GuessWhoBoard round={round()} />, { isHost: true });

        expect(
            screen
                .getByRole('button', { name: 'Draw an answer' })
                .hasAttribute('disabled'),
        ).toBe(true);
        expect(screen.getByText('At least 2 answers are needed.')).toBeTruthy();
        expect(
            screen.queryByRole('button', { name: 'Shuffle question' }),
        ).toBeNull();
    });

    it('lets the host draw an answer from two answers on', async () => {
        const drawn = round({
            revealedAt: '2026-10-03T10:00:00Z',
            drawn: { id: 'answer', text: 'Paperboy' },
            candidates: ['bob', 'cy'],
        });
        mocks.request.mockResolvedValue(drawn);
        const { dispatch } = renderWithRoom(
            <GuessWhoBoard
                round={round({
                    answers: [
                        { playerId: 'bob', answered: true },
                        { playerId: 'cy', answered: true },
                    ],
                })}
            />,
            { isHost: true },
        );

        expect(screen.queryByText('At least 2 answers are needed.')).toBeNull();

        await act(async () => {
            fireEvent.click(
                screen.getByRole('button', { name: 'Draw an answer' }),
            );
        });

        expect(mocks.request.mock.calls[0][0].method).toBe('post');
        expect(mocks.request.mock.calls[0][0].url).toContain('/reveal');
        expect(dispatch).toHaveBeenCalledWith({
            type: 'round.patched',
            roundId: 'round',
            patch: drawn,
        });
    });

    it('turns to the vote once an answer is drawn, and never shows the others', () => {
        renderWithRoom(
            <GuessWhoBoard
                round={round({
                    revealedAt: '2026-10-03T10:00:00Z',
                    drawn: { id: 'answer', text: 'Paperboy' },
                    candidates: ['ada', 'bob', 'cy'],
                })}
            />,
        );

        expect(screen.getByText('Paperboy')).toBeTruthy();
        expect(screen.queryByLabelText('Your answer')).toBeNull();
        expect(
            screen.getByRole('radiogroup', { name: 'Who wrote this?' }),
        ).toBeTruthy();
    });
});

describe('GuessWhoResult', () => {
    const drawn = { id: 'answer', text: 'Paperboy', playerId: 'bob' };

    it('names the author, and under each candidate who named them, with a check on my right vote', () => {
        renderWithRoom(
            <GuessWhoResult
                drawn={drawn}
                nominations={[
                    { playerId: 'ada', voterIds: [] },
                    { playerId: 'bob', voterIds: ['ada', 'dee'] },
                    { playerId: 'cy', voterIds: ['cy'] },
                ]}
            />,
        );

        expect(screen.getByText('Paperboy')).toBeTruthy();
        expect(screen.getByText('Written by Bob')).toBeTruthy();

        const author = screen.getByRole('listitem', { name: 'Bob' });

        expect(within(author).getByText('Author')).toBeTruthy();
        expect(
            within(author).getByRole('list', { name: 'Named by Ada, Dee' }),
        ).toBeTruthy();
        expect(within(author).getByText('Your vote')).toBeTruthy();
        expect(
            author.querySelector('[data-slot="my-vote"][data-correct="true"]'),
        ).toBeTruthy();
    });

    it('marks my vote on someone else as wrong', () => {
        renderWithRoom(
            <GuessWhoResult
                drawn={drawn}
                nominations={[
                    { playerId: 'bob', voterIds: [] },
                    { playerId: 'cy', voterIds: ['ada'] },
                ]}
            />,
        );

        const cy = screen.getByRole('listitem', { name: 'Cy' });

        expect(
            cy.querySelector('[data-slot="my-vote"][data-correct="false"]'),
        ).toBeTruthy();
        expect(
            within(screen.getByRole('listitem', { name: 'Bob' })).queryByText(
                'Your vote',
            ),
        ).toBeNull();
    });
});
