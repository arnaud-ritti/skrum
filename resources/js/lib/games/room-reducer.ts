import type {
    DrawingOp,
    GameGuessEntry,
    GameLetterPicked,
    GameRound,
    GameRoomState,
    GameRoundEnded,
    GameSnapshot,
} from './types';

export type RoomAction =
    | { type: 'replace'; snapshot: GameSnapshot }
    | { type: 'round.started'; round: GameRound }
    | { type: 'round.ended'; ended: GameRoundEnded }
    | { type: 'round.patched'; roundId: string; patch: Partial<GameRound> }
    | { type: 'letter.picked'; picked: GameLetterPicked }
    | { type: 'timer.set'; timerEndsAt: string | null }
    | { type: 'guess.added'; roundId: string; guess: GameGuessEntry }
    | {
          type: 'drawing.added';
          roundId: string;
          op: DrawingOp;
          clientOpId: string | null;
      }
    | { type: 'drawing.undone'; roundId: string }
    | { type: 'drawing.cleared'; roundId: string };

const RecentPicks = 5;

/** Mirrors WordGuessRules::GuessesShown on the server. */
const GuessesShown = 50;

const CommittedOpIds = 20;

export function initialRoomState(snapshot: GameSnapshot): GameRoomState {
    return { snapshot, lastEnded: null };
}

function withRound(
    state: GameRoomState,
    roundId: string,
    update: (round: GameRound) => GameRound,
): GameRoomState {
    const round = state.snapshot.round;

    if (!round || round.id !== roundId) {
        return state;
    }

    return {
        ...state,
        snapshot: { ...state.snapshot, round: update(round) },
    };
}

export function roomReducer(
    state: GameRoomState,
    action: RoomAction,
): GameRoomState {
    switch (action.type) {
        case 'replace': {
            const keepsEndCard =
                action.snapshot.round === null &&
                state.lastEnded !== null &&
                state.lastEnded.roundId === action.snapshot.room.currentRoundId;

            return {
                snapshot: action.snapshot,
                lastEnded: keepsEndCard ? state.lastEnded : null,
            };
        }
        case 'round.started':
            return {
                snapshot: {
                    ...state.snapshot,
                    round: action.round,
                    room: {
                        ...state.snapshot.room,
                        currentRoundId: action.round.id,
                    },
                },
                lastEnded: null,
            };
        case 'round.ended': {
            if (state.lastEnded?.roundId === action.ended.roundId) {
                return state;
            }

            const isCurrent =
                state.snapshot.room.currentRoundId === action.ended.roundId;

            if (!isCurrent) {
                return state;
            }

            return {
                snapshot: { ...state.snapshot, round: null },
                lastEnded: action.ended,
            };
        }
        case 'round.patched':
            return withRound(state, action.roundId, (round) => ({
                ...round,
                ...action.patch,
            }));
        case 'letter.picked':
            return withRound(state, action.picked.roundId, (round) => ({
                ...round,
                mask: action.picked.mask,
                misses: action.picked.misses,
                pickedLetters: [
                    ...(round.pickedLetters ?? []).filter(
                        (letter) => letter !== action.picked.letter,
                    ),
                    action.picked.letter,
                ],
                recentPicks: [
                    ...(round.recentPicks ?? []),
                    {
                        playerId: action.picked.playerId,
                        letter: action.picked.letter,
                        hit: action.picked.hit,
                    },
                ].slice(-RecentPicks),
            }));
        case 'timer.set':
            return {
                ...state,
                snapshot: {
                    ...state.snapshot,
                    room: {
                        ...state.snapshot.room,
                        timerEndsAt: action.timerEndsAt,
                    },
                },
            };
        case 'guess.added':
            return withRound(state, action.roundId, (round) => {
                const guesses = round.guesses ?? [];

                if (guesses.some((guess) => guess.id === action.guess.id)) {
                    return round;
                }

                return {
                    ...round,
                    guesses: [...guesses, action.guess].slice(-GuessesShown),
                };
            });
        case 'drawing.added':
            return withRound(state, action.roundId, (round) => ({
                ...round,
                drawing: [...(round.drawing ?? []), action.op],
                committedOpIds:
                    action.clientOpId === null
                        ? round.committedOpIds
                        : [
                              ...(round.committedOpIds ?? []),
                              action.clientOpId,
                          ].slice(-CommittedOpIds),
            }));
        case 'drawing.undone':
            return withRound(state, action.roundId, (round) => ({
                ...round,
                drawing: (round.drawing ?? []).slice(0, -1),
            }));
        case 'drawing.cleared':
            return withRound(state, action.roundId, (round) => ({
                ...round,
                drawing: [],
            }));
    }
}
