import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { GameRound } from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { GuessDock } from './guess-chat';
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

function round(guesses: GameRound['guesses']): GameRound {
    return {
        id: 'round',
        game: 'draw',
        leaderPlayerId: 'bob',
        guesses,
    } as GameRound;
}

function renderDock(
    guesses: GameRound['guesses'],
    isLeader = false,
    viewerIsObserver = false,
) {
    const ctx = {
        snapshot: {
            room: { id: 'r1', game: 'draw' },
            me: { playerId: 'ada' },
            players: [player('ada', 'Ada'), player('cy', 'Cy')],
            viewerIsObserver,
        },
    } as unknown as RoomContextValue;

    return renderWithProviders(
        <RoomProvider value={ctx}>
            <GuessDock round={round(guesses)} isLeader={isLeader} />
        </RoomProvider>,
    );
}

describe('GuessDock', () => {
    it('keeps the field and the latest guess at hand, and the whole list in a drawer', () => {
        renderDock([
            { id: 'g1', playerId: 'cy', text: 'a boat' },
            { id: 'g2', playerId: 'ada', text: 'a ship', veryClose: true },
        ]);

        const last = document.querySelector('[data-slot="last-guess"]');

        expect(
            screen.getByRole('textbox', { name: 'Your guess' }),
        ).toBeTruthy();
        expect(last?.textContent).toContain('Ada');
        expect(last?.textContent).toContain('a ship');
        expect(last?.textContent).toContain('Very close!');
        expect(last?.textContent).not.toContain('a boat');
        expect(screen.queryByRole('log')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: /Guesses/ }));

        const drawer = screen.getByRole('dialog', { name: 'Guesses' });
        const log = within(drawer).getByRole('log', { name: 'Guesses' });

        expect(within(log).getAllByRole('listitem')).toHaveLength(2);
        expect(within(log).getByText('a boat')).toBeTruthy();
        expect(within(drawer).getByText('2 guesses')).toBeTruthy();
        expect(within(drawer).queryByRole('textbox')).toBeNull();
        expect(
            within(drawer).getByText('Only you are told when you are close.'),
        ).toBeTruthy();
        expect(within(drawer).queryByText(/Enter to send/)).toBeNull();
    });

    it('gives an observer the guesses without a field', () => {
        renderDock([{ id: 'g1', playerId: 'cy', text: 'a boat' }], false, true);

        expect(screen.queryByRole('textbox')).toBeNull();
        expect(
            document.querySelector('[data-slot="last-guess"]')?.textContent,
        ).toContain('a boat');
    });

    it('gives who draws the list without a field', () => {
        renderDock([], true);

        expect(screen.queryByRole('textbox')).toBeNull();
        expect(
            document.querySelector('[data-slot="last-guess"]')?.textContent,
        ).toBe('No guesses yet.');

        fireEvent.click(screen.getByRole('button', { name: 'Guesses' }));

        expect(
            within(screen.getByRole('dialog', { name: 'Guesses' })).getByText(
                'You know the word, so you cannot guess.',
            ),
        ).toBeTruthy();
    });
});
