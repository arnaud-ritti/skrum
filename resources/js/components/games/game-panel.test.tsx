import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GamePanel } from '@/components/games/game-panel';

vi.mock('@/components/games/room-context', () => ({
    useRoom: () => ({
        snapshot: { room: { game: 'trivia' }, round: null },
        lastEnded: null,
    }),
}));

vi.mock('@/components/games/round-end-card', () => ({
    RoundEndCard: () => <p>Ready to play?</p>,
}));

vi.mock('@/components/games/room-sidebar', () => ({
    hasPlayersOnLeft: () => false,
    RoomPlayersSide: () => null,
    RoomSidebar: () => <p>Players</p>,
}));

vi.mock('@/components/games/game-board', () => ({
    GameBoard: () => <p>Board</p>,
}));

describe('GamePanel', () => {
    it('is the main landmark of a game room', () => {
        const { container } = render(<GamePanel />);

        expect(container.querySelector('main')?.textContent).toBe(
            'Ready to play?',
        );
    });

    it('is no landmark inside a page that already has its main', () => {
        const { container } = render(<GamePanel landmark={false} />);

        expect(container.querySelector('main')).toBeNull();
        expect(
            container.querySelector('[data-slot="game-stage"]')?.textContent,
        ).toBe('Ready to play?');
        expect(container.querySelector('aside')?.textContent).toBe('Players');
    });
});
