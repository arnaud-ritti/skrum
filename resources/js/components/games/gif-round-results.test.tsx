import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { GameGifRevealed } from '@/lib/games/types';
import { GifRoundResults } from './gif-round-results';
import { RoomProvider, type RoomContextValue } from './room-context';

const Players = [
    { id: 'p1', name: 'Ada', avatarUrl: null, isGuest: false },
    { id: 'p2', name: 'Bob', avatarUrl: null, isGuest: false },
    { id: 'p3', name: 'Cleo', avatarUrl: null, isGuest: true },
];

function answer(
    id: string,
    playerId: string | null,
    votes: number | null,
    rank: number | null,
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

function renderResults(
    answers: GameGifRevealed[],
    points: { playerId: string; points: number; isWin: boolean }[] = [],
) {
    const ctx = {
        snapshot: { players: Players },
    } as unknown as RoomContextValue;

    return render(
        <RoomProvider value={ctx}>
            <GifRoundResults answers={answers} points={points} />
        </RoomProvider>,
    );
}

describe('GifRoundResults', () => {
    it('orders the GIFs by rank and marks the first as the winner', () => {
        renderResults(
            [
                answer('a', 'p1', 0, 3),
                answer('b', 'p2', 3, 1, 'CI on Friday'),
                answer('c', 'p3', 1, 2),
            ],
            [{ playerId: 'p2', points: 6, isWin: true }],
        );

        const tiles = screen.getAllByRole('figure');

        expect(
            tiles.map((tile) => tile.querySelector('figcaption')?.textContent),
        ).toEqual(['by Bob', 'by Cleo', 'by Ada']);
        expect(within(tiles[0]).getByText('Winner')).toBeTruthy();
        expect(within(tiles[0]).getByText('3 votes')).toBeTruthy();
        expect(within(tiles[0]).getByText('CI on Friday')).toBeTruthy();
        expect(within(tiles[1]).getByText('1 vote')).toBeTruthy();
        expect(within(tiles[0]).getByText('+6')).toBeTruthy();
        expect(within(tiles[1]).queryByText('Winner')).toBeNull();
        expect(within(tiles[2]).getByText('0 votes')).toBeTruthy();
    });

    it('marks every GIF of a tie, and none when nobody voted', () => {
        const { unmount } = renderResults([
            answer('a', 'p1', 2, 1),
            answer('b', null, 2, 1),
            answer('c', 'p3', 1, 3),
        ]);

        expect(screen.getAllByText('Winner')).toHaveLength(2);
        expect(screen.getByText('Anonymous GIF')).toBeTruthy();

        unmount();
        renderResults([answer('a', 'p1', 0, 1), answer('b', 'p2', 0, 1)]);

        expect(screen.queryByText('Winner')).toBeNull();
    });

    it('says so when no GIF was sent', () => {
        renderResults([]);

        expect(screen.getByText('No GIFs yet.')).toBeTruthy();
    });
});
