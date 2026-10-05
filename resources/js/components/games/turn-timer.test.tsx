import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameRound } from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { RoomProvider, type RoomContextValue } from './room-context';
import { TurnTimer } from './turn-timer';

const now = new Date('2026-10-03T10:00:00Z');

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
});

afterEach(() => {
    vi.useRealTimers();
});

function renderTimer(round: Partial<GameRound>, serverOffset = 0) {
    const ctx = {
        snapshot: {
            room: { id: 'room' },
            players: [
                {
                    id: 'arnaud',
                    presenceId: 'p-arnaud',
                    name: 'Arnaud',
                    avatarUrl: '',
                    isGuest: false,
                },
            ],
        },
        serverOffset,
    } as unknown as RoomContextValue;

    renderWithProviders(
        <RoomProvider value={ctx}>
            <TurnTimer
                round={
                    {
                        turnOrder: [],
                        turnPlayerId: null,
                        turnEndsAt: null,
                        turnSeconds: 30,
                        ...round,
                    } as GameRound
                }
            />
        </RoomProvider>,
    );
}

function inSeconds(seconds: number): string {
    return new Date(now.getTime() + seconds * 1000).toISOString();
}

describe('TurnTimer', () => {
    it('counts down the turn of the player whose turn it is', () => {
        renderTimer({
            turnOrder: ['arnaud'],
            turnPlayerId: 'arnaud',
            turnEndsAt: inSeconds(18),
        });

        expect(screen.getByText("Arnaud's turn")).toBeTruthy();
        expect(screen.getByText('00:18')).toBeTruthy();
    });

    it('counts down a round that is its own turn, with the server clock, low under ten seconds', () => {
        renderTimer({ turnEndsAt: inSeconds(14) }, 5000);

        expect(screen.getByText('left this turn')).toBeTruthy();
        expect(screen.getByText('00:09')).toBeTruthy();
        expect(
            document
                .querySelector('[data-slot="timer-pill"]')
                ?.getAttribute('data-state'),
        ).toBe('low');
    });

    it('is absent without a deadline', () => {
        renderTimer({ turnEndsAt: null });

        expect(document.querySelector('[data-slot="turn-timer"]')).toBeNull();
    });
});
