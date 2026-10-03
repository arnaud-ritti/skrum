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

function stateWith(
    round: Record<string, unknown> | null,
    extra: Record<string, unknown> = {},
): GameRoomState {
    const state = stateOf(round);

    return {
        ...state,
        snapshot: {
            ...state.snapshot,
            me: { playerId: 'me' },
            ...extra,
        },
    } as unknown as GameRoomState;
}

const truthRoom = {
    room: { id: 'room', game: 'two_truths', currentRoundId: null },
    truthSets: {
        ready: ['ada', 'me'],
        mine: { statements: ['a', 'b', 'c'], lieIndex: 1, played: false },
    },
};

describe('roomReducer, turn.changed', () => {
    it('moves the turn of the round it names', () => {
        const next = roomReducer(
            stateOf({ id: 'round-1', turnPlayerId: 'a', turnEndsAt: null }),
            {
                type: 'turn.changed',
                turn: {
                    roundId: 'round-1',
                    turnPlayerId: 'b',
                    turnEndsAt: '2026-10-03T10:00:30+00:00',
                },
            },
        );

        expect(next.snapshot.round?.turnPlayerId).toBe('b');
        expect(next.snapshot.round?.turnEndsAt).toBe(
            '2026-10-03T10:00:30+00:00',
        );
    });

    it('asks for a fresh snapshot when the round is unknown', () => {
        const next = roomReducer(stateOf({ id: 'round-1' }), {
            type: 'turn.changed',
            turn: { roundId: 'round-9', turnPlayerId: 'b', turnEndsAt: null },
        });

        expect(next.resyncRequests).toBe(1);
        expect(next.snapshot.round?.turnPlayerId).toBeUndefined();
    });
});

describe('roomReducer, statements', () => {
    it('adds a player whose set became ready', () => {
        const next = roomReducer(stateWith(null, truthRoom), {
            type: 'statements.changed',
            change: { playerId: 'bob', ready: true },
        });

        expect(next.snapshot.truthSets?.ready).toEqual(['ada', 'me', 'bob']);
    });

    it('removes a player whose set stopped being ready', () => {
        const next = roomReducer(stateWith(null, truthRoom), {
            type: 'statements.changed',
            change: { playerId: 'ada', ready: false },
        });

        expect(next.snapshot.truthSets?.ready).toEqual(['me']);
    });

    it('changes nothing in a room that plays another game', () => {
        const state = stateWith(null, { truthSets: null });
        const next = roomReducer(state, {
            type: 'statements.changed',
            change: { playerId: 'bob', ready: true },
        });

        expect(next).toBe(state);
    });

    it('keeps the writer own set and readiness from the response', () => {
        const mine = {
            statements: ['x', 'y', 'z'],
            lieIndex: 0,
            played: false,
        };
        const next = roomReducer(
            stateWith(null, {
                ...truthRoom,
                truthSets: { ready: [], mine: null },
            }),
            { type: 'statements.mine', mine },
        );

        expect(next.snapshot.truthSets).toEqual({ ready: ['me'], mine });
    });

    it('drops the writer from the ready players once the set is removed', () => {
        const next = roomReducer(stateWith(null, truthRoom), {
            type: 'statements.mine',
            mine: null,
        });

        expect(next.snapshot.truthSets).toEqual({ ready: ['ada'], mine: null });
    });

    it('takes the teller out of the ready players when a round starts', () => {
        const next = roomReducer(stateWith(null, truthRoom), {
            type: 'round.started',
            round: { id: 'round-1', game: 'two_truths', leaderPlayerId: 'ada' },
        } as never);

        expect(next.snapshot.truthSets?.ready).toEqual(['me']);
        expect(next.snapshot.truthSets?.mine?.played).toBe(false);
    });

    it('marks the viewer own set played when the viewer tells', () => {
        const next = roomReducer(stateWith(null, truthRoom), {
            type: 'round.started',
            round: { id: 'round-1', game: 'two_truths', leaderPlayerId: 'me' },
        } as never);

        expect(next.snapshot.truthSets?.ready).toEqual(['ada']);
        expect(next.snapshot.truthSets?.mine?.played).toBe(true);
    });
});

describe('roomReducer, votes.counted', () => {
    it('sets how many have voted in the round it names', () => {
        const next = roomReducer(stateOf({ id: 'round-1', votedCount: 0 }), {
            type: 'votes.counted',
            counted: { roundId: 'round-1', voted: 3 },
        });

        expect(next.snapshot.round?.votedCount).toBe(3);
    });
});

describe('roomReducer, hangman', () => {
    it('passes the turn with the picked letter', () => {
        const next = roomReducer(
            stateOf({ id: 'round-1', game: 'hangman', turnPlayerId: 'a' }),
            {
                type: 'letter.picked',
                picked: {
                    roundId: 'round-1',
                    playerId: 'a',
                    letter: 'e',
                    hit: true,
                    mask: ['e'],
                    misses: 0,
                    turnPlayerId: 'b',
                    turnEndsAt: '2026-10-03T10:00:30+00:00',
                },
            },
        );

        expect(next.snapshot.round?.turnPlayerId).toBe('b');
        expect(next.snapshot.round?.turnEndsAt).toBe(
            '2026-10-03T10:00:30+00:00',
        );
    });

    it('keeps a wrong whole word apart from the guesses, with the misses', () => {
        const earlier = Array.from({ length: 10 }, (_, index) => ({
            playerId: 'a',
            text: `word${index}`,
        }));
        const next = roomReducer(
            stateOf({
                id: 'round-1',
                game: 'hangman',
                misses: 2,
                wordGuesses: earlier,
            }),
            {
                type: 'guess.added',
                roundId: 'round-1',
                guess: { id: 'g', playerId: 'b', text: 'retro' },
                misses: 3,
            },
        );

        expect(next.snapshot.round?.wordGuesses).toHaveLength(10);
        expect(next.snapshot.round?.wordGuesses?.at(-1)).toMatchObject({
            playerId: 'b',
            text: 'retro',
        });
        expect(next.snapshot.round?.misses).toBe(3);
        expect(next.snapshot.round?.guesses).toBeUndefined();
    });

    it('numbers the letters and the words in the order they arrive', () => {
        const picked = roomReducer(
            stateOf({
                id: 'round-1',
                game: 'hangman',
                wordGuesses: [{ playerId: 'a', text: 'early' }],
            }),
            {
                type: 'letter.picked',
                picked: {
                    roundId: 'round-1',
                    playerId: 'a',
                    letter: 'e',
                    hit: true,
                    mask: ['e'],
                    misses: 0,
                    turnPlayerId: null,
                    turnEndsAt: null,
                },
            },
        );
        const guessed = roomReducer(picked, {
            type: 'guess.added',
            roundId: 'round-1',
            guess: { id: 'g', playerId: 'b', text: 'retro' },
            misses: 1,
        });

        expect(guessed.snapshot.round?.recentPicks?.[0].seq).toBe(1);
        expect(guessed.snapshot.round?.wordGuesses).toEqual([
            { playerId: 'a', text: 'early' },
            { playerId: 'b', text: 'retro', seq: 2 },
        ]);
    });

    it('keeps the arrival of the live words when the room is fetched again', () => {
        const next = roomReducer(
            stateOf({
                id: 'round-1',
                game: 'hangman',
                recentPicks: [
                    { playerId: 'a', letter: 'e', hit: true, seq: 1 },
                ],
                wordGuesses: [
                    { playerId: 'a', text: 'early' },
                    { playerId: 'b', text: 'retro', seq: 2 },
                ],
            }),
            {
                type: 'replace',
                snapshot: snapshot({
                    id: 'round-1',
                    game: 'hangman',
                    wordGuesses: [
                        { playerId: 'a', text: 'early' },
                        { playerId: 'b', text: 'retro' },
                    ],
                }),
            },
        );

        expect(next.snapshot.round?.wordGuesses).toEqual([
            { playerId: 'a', text: 'early' },
            { playerId: 'b', text: 'retro', seq: 2 },
        ]);
    });
});

describe('roomReducer, round.revealed', () => {
    it('starts the GIF votes empty', () => {
        const answers = [{ id: 'x', gif: {}, playerId: null, caption: null }];
        const next = roomReducer(
            stateOf({ id: 'round-1', game: 'gif', revealedAt: null }),
            {
                type: 'round.revealed',
                revealed: {
                    roundId: 'round-1',
                    revealedAt: '2026-10-03T10:00:00+00:00',
                    answers,
                } as never,
            },
        );

        expect(next.snapshot.round?.answers).toEqual(answers);
        expect(next.snapshot.round?.myVotes).toEqual([]);
        expect(next.snapshot.round?.myVote).toBeNull();
    });

    it('shows the drawn answer of Guess who? and its candidates', () => {
        const next = roomReducer(
            stateOf({
                id: 'round-1',
                game: 'guess_who',
                revealedAt: null,
                answers: [{ playerId: 'a', answered: true }],
            }),
            {
                type: 'round.revealed',
                revealed: {
                    roundId: 'round-1',
                    revealedAt: '2026-10-03T10:00:00+00:00',
                    answers: [{ id: 'x', text: 'Paris' }],
                    candidates: ['a', 'b', 'c'],
                },
            },
        );

        expect(next.snapshot.round).toMatchObject({
            revealedAt: '2026-10-03T10:00:00+00:00',
            drawn: { id: 'x', text: 'Paris' },
            candidates: ['a', 'b', 'c'],
            votedCount: 0,
            myChoice: null,
            answers: [{ playerId: 'a', answered: true }],
        });
    });
});
