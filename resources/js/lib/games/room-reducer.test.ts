import { describe, expect, it } from 'vitest';
import { roomReducer } from './room-reducer';
import type { GameRoomState } from './types';
import type { GameSnapshot } from './types';

function snapshot(round: Record<string, unknown> | null): GameSnapshot {
    return {
        room: { id: 'room', currentRoundId: round ? round.id : null },
        players: [],
        leaderboard: [],
        round,
    } as unknown as GameSnapshot;
}

function stateOf(round: Record<string, unknown> | null): GameRoomState {
    return {
        snapshot: snapshot(round),
        lastEnded: null,
        resyncRequests: 0,
    } as unknown as GameRoomState;
}

const picks = [{ playerId: 'ada', letter: 'q', hit: true }];

describe('roomReducer, replace', () => {
    it('keeps the last letters of the round in play when the room is fetched again', () => {
        const next = roomReducer(
            stateOf({ id: 'round-1', game: 'hangman', recentPicks: picks }),
            {
                type: 'replace',
                snapshot: snapshot({ id: 'round-1', game: 'hangman' }),
            },
        );

        expect(next.snapshot.round?.recentPicks).toEqual(picks);
    });

    it('drops them when another round is in play', () => {
        const next = roomReducer(
            stateOf({ id: 'round-1', game: 'hangman', recentPicks: picks }),
            {
                type: 'replace',
                snapshot: snapshot({ id: 'round-2', game: 'hangman' }),
            },
        );

        expect(next.snapshot.round?.recentPicks).toBeUndefined();
    });
});
