import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useGameRoom } from '@/hooks/use-game-room';
import type { GameSnapshot } from '@/lib/games/types';
import { RetroRequestError } from '@/lib/retro/api';

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock('@/hooks/use-game-channel', () => ({
    useGameChannel: () => ({
        online: [],
        connected: true,
        reconnecting: false,
        presence: null,
        full: false,
    }),
}));

vi.mock('@/hooks/use-trans', () => ({
    useTrans: () => ({ t: (key: string) => key }),
}));

vi.mock('@/lib/retro/api', async (importOriginal) => {
    const original = await importOriginal<typeof import('@/lib/retro/api')>();

    return { ...original, retroRequest: mocks.request };
});

function snapshot(
    myVotes: string[],
    round: Record<string, unknown> = {},
): GameSnapshot {
    return {
        room: { id: 'room', currentRoundId: 'round' },
        me: { playerId: 'me' },
        players: [],
        leaderboard: [],
        history: [],
        serverTime: '2026-10-04T10:00:00Z',
        round: { id: 'round', game: 'gif', myVotes, voters: [], ...round },
    } as unknown as GameSnapshot;
}

describe('useGameRoom, a local change while the room is fetched again', () => {
    it('keeps a vote the viewer cast while an older snapshot was on its way', async () => {
        let answerRefetch: (fresh: GameSnapshot) => void = () => {};
        mocks.request.mockReturnValue(
            new Promise<GameSnapshot>((resolve) => {
                answerRefetch = resolve;
            }),
        );
        const { result } = renderHook(() =>
            useGameRoom(snapshot([]), { subscribe: true }),
        );

        let refetching: Promise<void> = Promise.resolve();

        act(() => {
            refetching = result.current.refetch();
        });
        act(() => {
            result.current.dispatch({
                type: 'round.patched',
                roundId: 'round',
                patch: { myVotes: ['answer'] },
            });
        });

        expect(result.current.state.snapshot.round?.myVotes).toEqual([
            'answer',
        ]);

        await act(async () => {
            answerRefetch(snapshot([]));
            await refetching;
        });

        expect(result.current.state.snapshot.round?.myVotes).toEqual([
            'answer',
        ]);
    });

    it('does not replay a letter the viewer picked, whose move the snapshot already keeps', async () => {
        let answerRefetch: (fresh: GameSnapshot) => void = () => {};
        mocks.request.mockReturnValue(
            new Promise<GameSnapshot>((resolve) => {
                answerRefetch = resolve;
            }),
        );
        const hangman = { game: 'hangman', mask: [], misses: 0 };
        const { result } = renderHook(() =>
            useGameRoom(snapshot([], hangman), { subscribe: true }),
        );

        let refetching: Promise<void> = Promise.resolve();

        act(() => {
            refetching = result.current.refetch();
        });
        act(() => {
            result.current.dispatch({
                type: 'letter.picked',
                picked: {
                    roundId: 'round',
                    playerId: 'me',
                    letter: 'e',
                    hit: true,
                    mask: [],
                    misses: 0,
                    turnPlayerId: null,
                    turnEndsAt: null,
                },
            } as never);
        });

        await act(async () => {
            answerRefetch(snapshot([], hangman));
            await refetching;
        });

        expect(result.current.state.snapshot.round?.recentPicks).toHaveLength(
            1,
        );
    });
});

describe('useGameRoom, a snapshot that does not arrive', () => {
    afterEach(() => {
        vi.useRealTimers();
        mocks.request.mockReset();
    });

    it('asks again after a lost network, and takes the snapshot that comes', async () => {
        vi.useFakeTimers();
        mocks.request.mockReset();
        mocks.request
            .mockRejectedValueOnce(new RetroRequestError(0, 'timeout'))
            .mockResolvedValueOnce(snapshot(['fresh']));

        const { result } = renderHook(() =>
            useGameRoom(snapshot([]), { subscribe: true }),
        );

        await act(async () => {
            await result.current.refetch();
        });

        expect(mocks.request).toHaveBeenCalledTimes(1);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(3000);
        });

        expect(mocks.request).toHaveBeenCalledTimes(2);
        expect(result.current.state.snapshot.round?.myVotes).toEqual(['fresh']);
    });
});

describe('useGameRoom, a refetch overtaken by a newer one', () => {
    it('resolves only once the newer snapshot is applied', async () => {
        const answers: ((fresh: GameSnapshot) => void)[] = [];
        mocks.request.mockImplementation(
            () =>
                new Promise<GameSnapshot>((resolve) => {
                    answers.push(resolve);
                }),
        );
        const { result } = renderHook(() =>
            useGameRoom(snapshot([]), { subscribe: true }),
        );

        let overtaken: Promise<void> = Promise.resolve();
        let settled = false;

        act(() => {
            overtaken = result.current.refetch().then(() => {
                settled = true;
            });
            void result.current.refetch();
        });

        await act(async () => {
            answers[0](snapshot(['stale']));
            await Promise.resolve();
            await Promise.resolve();
        });

        expect(settled).toBe(false);

        await act(async () => {
            answers[1](snapshot(['fresh']));
            await overtaken;
        });

        expect(result.current.state.snapshot.round?.myVotes).toEqual(['fresh']);
    });
});

describe('useGameRoom, Undercover private snapshots', () => {
    it('fetches the personal word after a public round start and resyncs after a game update', async () => {
        const personal = snapshot([], {
            game: 'undercover',
            undercover: { myWord: 'coffee', version: 1 },
        });
        mocks.request.mockReset().mockResolvedValue(personal);
        const { result } = renderHook(() =>
            useGameRoom(snapshot([]), { subscribe: true }),
        );
        await act(async () => {
            result.current.handleEvent({
                name: 'game.round.started',
                payload: {
                    round: {
                        id: 'round',
                        game: 'undercover',
                        undercover: { myWord: null, version: 1 },
                    },
                },
            });
        });
        expect(result.current.state.snapshot.round?.undercover?.myWord).toBe(
            'coffee',
        );
        mocks.request.mockResolvedValue(
            snapshot([], {
                game: 'undercover',
                undercover: { myWord: 'coffee', version: 2 },
            }),
        );
        await act(async () => {
            result.current.handleEvent({
                name: 'game.undercover.changed',
                payload: { roundId: 'round' },
            });
        });
        expect(result.current.state.snapshot.round?.undercover?.version).toBe(
            2,
        );
    });
});
