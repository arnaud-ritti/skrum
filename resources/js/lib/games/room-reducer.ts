import type {
    DrawingOp,
    GameGuessEntry,
    GameLetterPicked,
    GameRound,
    GameRoomState,
    GameRoundEnded,
    GameRoundRevealed,
    GameSnapshot,
} from './types';
import { withAwardedPoints } from './leaderboard';
import { pendingAnswers, withPendingAnswer, withVoter } from './gif';

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
          count: number;
      }
    | { type: 'drawing.undone'; roundId: string; count: number }
    | { type: 'drawing.cleared'; roundId: string }
    | { type: 'question.changed'; roundId: string; question: string }
    | {
          type: 'answer.changed';
          roundId: string;
          playerId: string;
          answered: boolean;
      }
    | { type: 'round.revealed'; revealed: GameRoundRevealed }
    | {
          type: 'vote.changed';
          roundId: string;
          playerId: string;
          voted: boolean;
      };

const RecentPicks = 5;

/** Mirrors WordGuessRules::GuessesShown on the server. */
const GuessesShown = 50;

const CommittedOpIds = 20;

export function initialRoomState(snapshot: GameSnapshot): GameRoomState {
    return { snapshot, lastEnded: null, resyncRequests: 0 };
}

/**
 * A round this client has never seen (a missed `game.round.started`, or a
 * snapshot older than the event) asks for a fresh snapshot; late events of
 * the current or just-ended round are simply dropped.
 */
function isKnownRound(state: GameRoomState, roundId: string): boolean {
    return (
        state.snapshot.round?.id === roundId ||
        state.snapshot.room.currentRoundId === roundId ||
        state.lastEnded?.roundId === roundId
    );
}

function withRound(
    state: GameRoomState,
    roundId: string,
    update: (round: GameRound) => GameRound,
): GameRoomState {
    const round = state.snapshot.round;

    if (!isKnownRound(state, roundId)) {
        return requestResync(state);
    }

    if (!round || round.id !== roundId) {
        return state;
    }

    return {
        ...state,
        snapshot: { ...state.snapshot, round: update(round) },
    };
}

/**
 * Drawing events carry the drawing's length after the change (`count`), so
 * an event replayed over a snapshot that already holds it is ignored and one
 * that does not fit (a missed event) asks for a fresh snapshot. Null when
 * the event is about another round than the current one.
 */
function drawingLength(state: GameRoomState, roundId: string): number | null {
    const round = state.snapshot.round;

    if (!round || round.id !== roundId) {
        return null;
    }

    return (round.drawing ?? []).length;
}

function requestResync(state: GameRoomState): GameRoomState {
    return { ...state, resyncRequests: state.resyncRequests + 1 };
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
                ...state,
                snapshot: action.snapshot,
                lastEnded: keepsEndCard ? state.lastEnded : null,
            };
        }
        case 'round.started':
            return {
                ...state,
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
                ...state,
                snapshot: {
                    ...state.snapshot,
                    round: null,
                    leaderboard: withAwardedPoints(
                        state.snapshot.leaderboard,
                        action.ended.points,
                        state.snapshot.players,
                    ),
                },
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
        case 'drawing.added': {
            const length = drawingLength(state, action.roundId);

            if (length === null) {
                return isKnownRound(state, action.roundId)
                    ? state
                    : requestResync(state);
            }

            if (length !== action.count - 1 && length !== action.count) {
                return requestResync(state);
            }

            return withRound(state, action.roundId, (round) => ({
                ...round,
                drawing:
                    length === action.count
                        ? round.drawing
                        : [...(round.drawing ?? []), action.op],
                committedOpIds:
                    action.clientOpId === null
                        ? round.committedOpIds
                        : [
                              ...(round.committedOpIds ?? []),
                              action.clientOpId,
                          ].slice(-CommittedOpIds),
            }));
        }
        case 'drawing.undone': {
            const length = drawingLength(state, action.roundId);

            if (length === null) {
                return isKnownRound(state, action.roundId)
                    ? state
                    : requestResync(state);
            }

            if (length === action.count) {
                return state;
            }

            if (length !== action.count + 1) {
                return requestResync(state);
            }

            return withRound(state, action.roundId, (round) => ({
                ...round,
                drawing: (round.drawing ?? []).slice(0, -1),
            }));
        }
        case 'drawing.cleared':
            return withRound(state, action.roundId, (round) => ({
                ...round,
                drawing: [],
            }));
        case 'question.changed':
            return withRound(state, action.roundId, (round) => ({
                ...round,
                question: action.question,
            }));
        case 'answer.changed':
            return withRound(state, action.roundId, (round) =>
                round.revealedAt !== null
                    ? round
                    : {
                          ...round,
                          answers: withPendingAnswer(
                              pendingAnswers(round),
                              action.playerId,
                              action.answered,
                          ),
                      },
            );
        case 'round.revealed':
            return withRound(state, action.revealed.roundId, (round) => ({
                ...round,
                revealedAt: action.revealed.revealedAt,
                answers: action.revealed.answers,
                voters: [],
                myVote: null,
            }));
        case 'vote.changed':
            return withRound(state, action.roundId, (round) => ({
                ...round,
                voters: withVoter(
                    round.voters ?? [],
                    action.playerId,
                    action.voted,
                ),
            }));
    }
}
