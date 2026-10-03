import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameRound } from '@/lib/games/types';
import { renderWithProviders } from '@/test/render';
import { AutoHintCountdown } from './auto-hint-countdown';
import { RoomProvider, type RoomContextValue } from './room-context';

const now = new Date('2026-10-03T10:00:00Z');

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
});

afterEach(() => {
    vi.useRealTimers();
});

function secondsAgo(seconds: number): string {
    return new Date(now.getTime() - seconds * 1000).toISOString();
}

function renderCountdown(round: Partial<GameRound>, serverOffset = 0) {
    const ctx = { serverOffset } as unknown as RoomContextValue;

    renderWithProviders(
        <RoomProvider value={ctx}>
            <AutoHintCountdown
                round={
                    {
                        startedAt: secondsAgo(8),
                        hintSeconds: 20,
                        maxHints: 3,
                        mask: [null, null, null, null, null, null],
                        ...round,
                    } as GameRound
                }
            />
        </RoomProvider>,
    );
}

describe('AutoHintCountdown', () => {
    it('counts down to the next letter the server reveals on its own', () => {
        renderCountdown({});

        expect(screen.getByText('next letter in 0:12')).toBeTruthy();
    });

    it('counts from the letters already revealed, with the server clock', () => {
        renderCountdown(
            { startedAt: secondsAgo(30), mask: ['p', null, null, 'n', null] },
            5000,
        );

        expect(screen.getByText('next letter in 0:25')).toBeTruthy();
    });

    it('says the letter is coming once the countdown is over', () => {
        renderCountdown({ startedAt: secondsAgo(21) });

        expect(screen.getByText('next letter now')).toBeTruthy();
    });

    it('counts to the next slot after a new word, past two auto hints', () => {
        renderCountdown({
            startedAt: secondsAgo(45),
            hintSlots: 4,
            maxHints: 4,
            mask: [null, null, null, null, null, null, null, null],
        });

        expect(screen.getByText('next letter in 0:15')).toBeTruthy();
    });

    it('shows nothing without auto hints', () => {
        renderCountdown({ hintSeconds: null });

        expect(
            document.querySelector('[data-slot="auto-hint-countdown"]'),
        ).toBeNull();
    });

    it('shows nothing once every hint is shown', () => {
        renderCountdown({ mask: ['a', null, 'b', null, 'c', null] });

        expect(
            document.querySelector('[data-slot="auto-hint-countdown"]'),
        ).toBeNull();
    });
});
