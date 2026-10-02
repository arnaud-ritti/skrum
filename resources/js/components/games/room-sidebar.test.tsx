import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { RoomProvider, type RoomContextValue } from './room-context';
import { RoomSidebar } from './room-sidebar';

function player(id: string) {
    return {
        id,
        presenceId: `presence-${id}`,
        name: id,
        avatarUrl: null,
        isGuest: false,
    };
}

describe('RoomSidebar', () => {
    it('counts who is ready against the players who are online, as the tally of the votes does', () => {
        const ctx = {
            snapshot: {
                room: { id: 'r1', game: 'gif', hostPlayerId: 'ada' },
                me: { playerId: 'ada' },
                players: [player('ada'), player('bob'), player('cy')],
                scores: [],
                history: [],
                round: {
                    id: 'round',
                    game: 'gif',
                    revealedAt: null,
                    answers: [{ playerId: 'bob' }],
                    myAnswer: null,
                },
            },
            lastEnded: null,
            online: [{ id: 'presence-ada' }, { id: 'presence-bob' }],
        } as unknown as RoomContextValue;

        renderWithProviders(
            <RoomProvider value={ctx}>
                <RoomSidebar highlightPlayerId={null} />
            </RoomProvider>,
        );

        expect(screen.getByText('1 / 2')).toBeTruthy();
        expect(
            document
                .querySelector('[data-slot="gif-ready"]')
                ?.getAttribute('aria-valuemax'),
        ).toBe('2');
        expect(screen.getByText('3 players')).toBeTruthy();
    });

    it('counts a lone player in the singular', () => {
        const ctx = {
            snapshot: {
                room: { id: 'r1', game: 'hangman', hostPlayerId: 'ada' },
                me: { playerId: 'ada' },
                players: [player('ada')],
                scores: [],
                history: [],
                round: null,
            },
            lastEnded: null,
            online: [{ id: 'presence-ada' }],
        } as unknown as RoomContextValue;

        renderWithProviders(
            <RoomProvider value={ctx}>
                <RoomSidebar highlightPlayerId={null} />
            </RoomProvider>,
        );

        expect(screen.getByText('1 player')).toBeTruthy();
        expect(screen.queryByText('1 players')).toBeNull();
    });
});
