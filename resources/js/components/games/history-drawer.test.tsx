import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { HistoryDrawer } from './history-drawer';
import { RoomProvider, type RoomContextValue } from './room-context';

const api = vi.hoisted(() => ({
    retroRequest: vi.fn(() => new Promise(() => undefined)),
}));

vi.mock('@/lib/retro/api', () => ({ retroRequest: api.retroRequest }));

function renderDrawer() {
    const ctx = {
        snapshot: {
            room: { id: 'room' },
            history: [
                {
                    id: 'round',
                    game: 'hangman',
                    word: 'BANANA',
                    question: null,
                    outcome: 'solved',
                },
            ],
        },
        handleError: () => null,
    } as unknown as RoomContextValue;

    renderWithProviders(
        <RoomProvider value={ctx}>
            <HistoryDrawer />
        </RoomProvider>,
    );
}

describe('HistoryDrawer', () => {
    it('moves the focus to Back on a round, and back to that round on Back', async () => {
        renderDrawer();

        await userEvent.click(screen.getByRole('button', { name: 'History' }));
        await userEvent.click(screen.getByRole('button', { name: /BANANA/ }));

        expect(document.activeElement).toBe(
            screen.getByRole('button', { name: 'Back' }),
        );

        await userEvent.click(screen.getByRole('button', { name: 'Back' }));

        expect(document.activeElement).toBe(
            screen.getByRole('button', { name: /BANANA/ }),
        );
    });
});
