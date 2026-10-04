import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useGameRoom } from '@/hooks/use-game-room';
import type { GameSnapshot } from '@/lib/games/types';

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
