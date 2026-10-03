import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
    GameGifRevealed,
    GameRound,
    GameRoundEnded,
} from '@/lib/games/types';
import { GifPodium } from './gif-podium';
import { RoomProvider, type RoomContextValue } from './room-context';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
});

const Players = [
    { id: 'malik', name: 'Malik', avatarUrl: null, isGuest: false },
    { id: 'ines', name: 'Inès', avatarUrl: null, isGuest: false },
    { id: 'theo', name: 'Théo', avatarUrl: null, isGuest: false },
    { id: 'yuki', name: 'Yuki', avatarUrl: null, isGuest: true },
];

function answer(
    id: string,
    playerId: string | null,
    votes: number,
    rank: number,
    caption: string | null = null,
): GameGifRevealed {
    return {
        id,
        playerId,
        votes,
        rank,
        caption,
        gif: { id, previewUrl: `/gifs/${id}/preview`, url: `/gifs/${id}/full` },
    };
}

function ended(answers: GameGifRevealed[]): GameRoundEnded {
    return {
        roundId: 'round',
        outcome: 'revealed',
        word: null,
        winnerPlayerId: null,
        leaderPlayerId: null,
        points: [],
        answers,
    };
}

function renderPodium(
    lastEnded: GameRoundEnded | null,
    round: GameRound | null = null,
    history: { id: string; game: string }[] = [],
) {
    const ctx = {
        snapshot: {
            room: { id: 'room', currentRoundId: 'round' },
            round,
            players: Players,
            history,
        },
        lastEnded,
    } as unknown as RoomContextValue;

    return render(
        <RoomProvider value={ctx}>
            <GifPodium />
        </RoomProvider>,
    );
}

describe('GifPodium', () => {
    beforeEach(() => {
        mocks.request.mockReset();
    });

    it('names the winner with the caption and the votes, then ranks the others with ties', () => {
        renderPodium(
            ended([
                answer('a', 'theo', 1, 3),
                answer('b', 'malik', 5, 1, 'CI on Friday at 6 pm'),
                answer('c', 'ines', 3, 2),
                answer('d', 'yuki', 1, 3),
            ]),
        );

        expect(
            screen.getByRole('heading', { name: "This sprint's GIF" }),
        ).toBeTruthy();
        expect(screen.getByText('Malik wins the round')).toBeTruthy();
        expect(
            screen.getByText('“CI on Friday at 6 pm” · 5 votes out of 10'),
        ).toBeTruthy();
        expect(screen.getByText('Winner')).toBeTruthy();

        const rows = within(
            screen.getByRole('list', { name: 'Ranking' }),
        ).getAllByRole('listitem');

        expect(rows.map((row) => row.firstChild?.textContent)).toEqual([
            '2',
            '3',
            '3',
        ]);
        expect(within(rows[0]).getByText('Inès')).toBeTruthy();
        expect(within(rows[0]).getByText('3 votes')).toBeTruthy();
        expect(within(rows[1]).getByText('Théo')).toBeTruthy();
        expect(within(rows[2]).getByText('Yuki')).toBeTruthy();
        expect(within(rows[2]).getByText('1 vote')).toBeTruthy();
    });

    it('names every winner of a tie for first', () => {
        renderPodium(
            ended([answer('a', 'malik', 2, 1), answer('b', 'ines', 2, 1)]),
        );

        expect(screen.getByText('Malik, Inès win the round')).toBeTruthy();
        expect(screen.queryByRole('list', { name: 'Ranking' })).toBeNull();
    });

    it('crowns nobody when no GIF got a vote', () => {
        renderPodium(
            ended([answer('a', 'malik', 0, 1), answer('b', 'ines', 0, 1)]),
        );

        expect(screen.getByText('No GIF got a vote.')).toBeTruthy();
        expect(screen.queryByText('Winner')).toBeNull();
        expect(
            within(screen.getByRole('list', { name: 'Ranking' })).getAllByRole(
                'listitem',
            ),
        ).toHaveLength(2);
    });

    it('shows no name on an anonymous retro', () => {
        renderPodium(
            ended([
                answer('a', null, 3, 1, 'Late again'),
                answer('b', null, 1, 2),
            ]),
        );

        expect(screen.queryByText(/wins the round/)).toBeNull();
        expect(
            screen.getByText('“Late again” · 3 votes out of 4'),
        ).toBeTruthy();
        expect(screen.getByText('Anonymous GIF')).toBeTruthy();
    });

    it('is absent while a round is in play or before any GIF round ended', () => {
        const { container, unmount } = renderPodium(
            ended([answer('a', 'malik', 1, 1)]),
            { id: 'next', game: 'gif' } as GameRound,
        );

        expect(container.innerHTML).toBe('');

        unmount();

        const empty = renderPodium(null);

        expect(empty.container.innerHTML).toBe('');
    });

    it('reads the closed GIFs of the last round when the page opens between rounds', async () => {
        mocks.request.mockResolvedValue({
            answers: [answer('a', 'malik', 2, 1)],
        });

        renderPodium(null, null, [{ id: 'round', game: 'gif' }]);

        await waitFor(() =>
            expect(screen.getByText('Malik wins the round')).toBeTruthy(),
        );
        expect(mocks.request).toHaveBeenCalledTimes(1);
    });
});
