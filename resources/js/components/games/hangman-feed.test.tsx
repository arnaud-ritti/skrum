import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { GameRound } from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { HangmanFeed } from './hangman-feed';
import { RoomProvider, type RoomContextValue } from './room-context';

function player(id: string, name: string) {
    return {
        id,
        presenceId: `presence-${id}`,
        name,
        avatarUrl: null,
        isGuest: false,
    };
}

function renderFeed(round: Partial<GameRound>, limit?: number) {
    const ctx = {
        snapshot: {
            room: { id: 'r1', game: 'hangman' },
            me: { playerId: 'ada' },
            players: [player('ada', 'Ada'), player('theo', 'Théo')],
        },
    } as unknown as RoomContextValue;

    return renderWithProviders(
        <RoomProvider value={ctx}>
            <HangmanFeed
                round={{ id: 'round', game: 'hangman', ...round } as GameRound}
                limit={limit}
            />
        </RoomProvider>,
    );
}

function lines(): string[] {
    return within(screen.getByRole('list', { name: 'Last moves' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent ?? '');
}

describe('HangmanFeed', () => {
    it('interleaves the whole words with the letters by arrival, newest first', () => {
        renderFeed({
            recentPicks: [
                { playerId: 'ada', letter: 'e', hit: true, seq: 1 },
                { playerId: 'theo', letter: 'x', hit: false, seq: 3 },
            ],
            wordGuesses: [
                { id: 'g1', playerId: 'ada', text: 'before' },
                { id: 'g2', playerId: 'theo', text: 'laptop', seq: 2 },
            ],
        });

        expect(lines()).toEqual([
            'Théo picked X — not in the word',
            'Théo tries LAPTOP — missed',
            'Ada picked E — in the word',
            'Ada tries BEFORE — missed',
        ]);
    });

    it('keeps only the latest moves on the stage', () => {
        renderFeed(
            {
                recentPicks: [
                    { playerId: 'ada', letter: 'e', hit: true, seq: 1 },
                ],
                wordGuesses: [
                    { id: 'g2', playerId: 'theo', text: 'laptop', seq: 2 },
                ],
            },
            1,
        );

        expect(lines()).toEqual(['Théo tries LAPTOP — missed']);
    });

    it('shows nothing before the first move', () => {
        renderFeed({});

        expect(screen.queryByRole('list')).toBeNull();
    });
});
