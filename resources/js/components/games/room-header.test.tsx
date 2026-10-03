import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { RoomProvider, type RoomContextValue } from './room-context';
import { RoomTimer, RoomTitle } from './room-header';

const api = vi.hoisted(() => ({ retroRequest: vi.fn() }));

vi.mock('@/lib/retro/api', () => ({ retroRequest: api.retroRequest }));

function renderTimer(room: { isHost: boolean; timerEndsAt: string | null }) {
    const apply = vi.fn();
    const ctx = {
        snapshot: { room: { id: 'r1', isIcebreaker: false, ...room } },
        serverOffset: 0,
        run: <T,>(mutation: Promise<T>) => mutation,
        apply,
    } as unknown as RoomContextValue;

    renderWithProviders(
        <RoomProvider value={ctx}>
            <RoomTimer />
        </RoomProvider>,
    );

    return { apply };
}

function inFiveMinutes(): string {
    return new Date(Date.now() + 5 * 60_000).toISOString();
}

beforeEach(() => {
    api.retroRequest.mockReset();
});

describe('RoomTimer', () => {
    it('adds two minutes through the timer extension of the room and applies the new end', async () => {
        api.retroRequest.mockResolvedValue({
            timerEndsAt: '2026-10-02T12:07:00Z',
        });

        const { apply } = renderTimer({
            isHost: true,
            timerEndsAt: inFiveMinutes(),
        });

        await userEvent.click(
            await screen.findByRole('button', { name: '+2 min' }),
        );

        await waitFor(() =>
            expect(apply).toHaveBeenCalledWith({
                type: 'timer.set',
                timerEndsAt: '2026-10-02T12:07:00Z',
            }),
        );
        expect(api.retroRequest).toHaveBeenCalledTimes(1);
        expect(api.retroRequest.mock.calls[0][0]).toMatchObject({
            url: '/games/r1/timer/extension',
            method: 'post',
        });
    });

    it('starts with 1, 3, 5 or 10 minutes, never 2', async () => {
        renderTimer({ isHost: true, timerEndsAt: null });

        await userEvent.click(screen.getByRole('button', { name: 'Timer' }));

        expect(
            screen
                .getAllByRole('menuitem')
                .map((item) => item.textContent)
                .filter((label) => label?.endsWith('min')),
        ).toEqual(['1 min', '3 min', '5 min', '10 min']);
    });

    it('gives a player who is not the host no way to extend', async () => {
        renderTimer({ isHost: false, timerEndsAt: inFiveMinutes() });

        expect(await screen.findByRole('timer')).toBeTruthy();
        expect(screen.queryByRole('button', { name: '+2 min' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Timer' })).toBeNull();
    });
});

describe('RoomTitle', () => {
    function renderTitle(
        round: { number: number | null; roundsTotal: number | null } | null,
    ) {
        const ctx = {
            snapshot: {
                room: {
                    id: 'r1',
                    name: 'Fridays',
                    game: 'draw',
                    isIcebreaker: false,
                    teamName: null,
                },
                games: [
                    { value: 'draw', label: 'Draw & Guess', available: true },
                ],
                links: { team: null },
                round:
                    round === null
                        ? null
                        : { id: 'round', game: 'draw', ...round },
            },
        } as unknown as RoomContextValue;

        renderWithProviders(
            <RoomProvider value={ctx}>
                <RoomTitle />
            </RoomProvider>,
        );
    }

    it('counts the rounds of a game of a set length beside the game', () => {
        renderTitle({ number: 3, roundsTotal: 6 });

        expect(screen.getByText('Round 3 / 6')).toBeTruthy();
    });

    it('counts nothing in an endless game', () => {
        renderTitle({ number: 3, roundsTotal: null });

        expect(document.querySelector('[data-slot="room-round"]')).toBeNull();
    });
});
