import { cleanup, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { RoomProvider, type RoomContextValue } from './room-context';
import { RoomGame, RoomTimer, RoomTitle } from './room-header';

const api = vi.hoisted(() => ({ retroRequest: vi.fn(), visit: vi.fn() }));

vi.mock('@/lib/retro/api', () => ({ retroRequest: api.retroRequest }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {} } }),
    router: { visit: api.visit },
}));

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
    api.visit.mockReset();
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
        part: ReactElement = <RoomTitle />,
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

        renderWithProviders(<RoomProvider value={ctx}>{part}</RoomProvider>);
    }

    it("puts the game's badge in the middle of the bar, not beside the title", () => {
        renderTitle(null);

        expect(document.querySelector('[data-slot="room-game"]')).toBeNull();

        cleanup();
        renderTitle(null, <RoomGame />);

        const badge = document.querySelector<HTMLElement>(
            '[data-slot="room-game"]',
        );

        expect(badge?.textContent).toBe('Draw & Guess');
        expect(badge?.querySelector('svg')).not.toBeNull();
        expect(badge?.classList.contains('hidden')).toBe(false);
        expect(badge?.querySelector('.truncate')?.textContent).toBe(
            'Draw & Guess',
        );
    });

    it('counts the rounds of a game of a set length beside the game', () => {
        renderTitle({ number: 3, roundsTotal: 6 });

        expect(screen.getByText('Round 3 / 6')).toBeTruthy();
    });

    it('counts nothing in an endless game', () => {
        renderTitle({ number: 3, roundsTotal: null });

        expect(document.querySelector('[data-slot="room-round"]')).toBeNull();
    });
});

describe('RoomTitle, leaving', () => {
    type Round = { game: string; revealedAt: string | null } | null;

    const votingOpen: Round = {
        game: 'gif',
        revealedAt: '2026-10-02T12:00:00Z',
    };

    function renderTitle({
        isHost = true,
        round = votingOpen,
    }: { isHost?: boolean; round?: Round } = {}) {
        const dispatch = vi.fn();
        const ctx = {
            snapshot: {
                room: {
                    id: 'r1',
                    name: 'Fridays',
                    game: 'gif',
                    isHost,
                    isIcebreaker: false,
                    teamName: 'Atlas',
                },
                games: [
                    {
                        value: 'gif',
                        label: 'Sprint in one GIF',
                        available: true,
                    },
                ],
                links: { team: '/teams/t1' },
                round:
                    round === null
                        ? null
                        : {
                              id: 'round',
                              number: null,
                              roundsTotal: null,
                              ...round,
                          },
            },
            online: [{ id: 'p1' }, { id: 'p2' }],
            run: <T,>(mutation: Promise<T>) => mutation,
            dispatch,
            refetch: vi.fn().mockResolvedValue(undefined),
        } as unknown as RoomContextValue;

        renderWithProviders(
            <RoomProvider value={ctx}>
                <RoomTitle />
            </RoomProvider>,
        );

        return { dispatch };
    }

    const backButton = () =>
        screen.queryByRole('button', { name: 'Back to the team' });

    const leavesAtOnce = () => {
        expect(
            screen
                .getByRole('link', { name: 'Back to the team' })
                .getAttribute('href'),
        ).toBe('/teams/t1');
        expect(backButton()).toBeNull();
    };

    it('asks the host while the votes of a round are open, and End it closes the round, then goes to the team', async () => {
        const ended = { roundId: 'round', outcome: 'revealed' };

        api.retroRequest.mockResolvedValue({ ended });

        const { dispatch } = renderTitle();

        expect(screen.queryByRole('link')).toBeNull();

        await userEvent.click(backButton() as HTMLElement);

        expect(
            screen.getByRole('dialog', { name: 'Leave Fridays?' }).textContent,
        ).toContain('The session is still running for 2 people.');

        await userEvent.click(
            screen.getByRole('button', { name: 'End the session' }),
        );

        await waitFor(() =>
            expect(api.visit).toHaveBeenCalledWith('/teams/t1'),
        );
        expect(api.retroRequest).toHaveBeenCalledTimes(1);
        expect(api.retroRequest.mock.calls[0][0]).toMatchObject({
            url: '/games/r1/rounds/round/close',
            method: 'post',
        });
        expect(dispatch).toHaveBeenCalledWith({ type: 'round.ended', ended });
    });

    it('leaves at once for a player who does not host the room', () => {
        renderTitle({ isHost: false });

        leavesAtOnce();
    });

    it('does not ask between two rounds', () => {
        renderTitle({ round: null });

        leavesAtOnce();
    });

    it('does not ask during a round the host cannot close: its votes are not open, or the game has none', () => {
        renderTitle({ round: { game: 'gif', revealedAt: null } });

        leavesAtOnce();
        cleanup();

        renderTitle({
            round: { game: 'hangman', revealedAt: '2026-10-02T12:00:00Z' },
        });

        leavesAtOnce();
    });
});
