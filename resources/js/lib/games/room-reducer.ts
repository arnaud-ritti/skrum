import type {
    DrawingOp,
    GameGifRevealed,
    GameGuessEntry,
    GameLetterPicked,
    GameRound,
    GameRoomState,
    GameRoundEnded,
    GameRoundRevealed,
    GameSnapshot,
    GameStatementsChanged,
    GameTextRevealed,
    GameTruthSet,
    GameTruthSets,
    GameTurnChanged,
    GameFinder,
    GameVotesCounted,
    GameWordChanged,
    GameWordFound,
    GameWordGuess,
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
    | {
          type: 'guess.added';
          roundId: string;
          guess: GameGuessEntry;
          /** Hangman's whole-word guess: the round's misses after it. */
          misses?: number;
      }
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
      }
    | { type: 'turn.changed'; turn: GameTurnChanged }
    | { type: 'statements.changed'; change: GameStatementsChanged }
    | { type: 'statements.mine'; mine: GameTruthSet | null }
    | { type: 'votes.counted'; counted: GameVotesCounted }
    | { type: 'word.found'; found: GameWordFound }
    | { type: 'word.changed'; change: GameWordChanged };

const RecentPicks = 5;

/** Mirrors WordGuessRules::GuessesShown on the server. */
const GuessesShown = 50;

/** Mirrors HangmanRules::WordGuessesShown on the server. */
const WordGuessesShown = 10;

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

/**
 * A fresh snapshot knows nothing of what only the client holds for the round
 * in play. Dropping `committedOpIds` would let the live preview of a stroke
 * committed moments ago show again once that stroke is undone or the drawing
 * is cleared; dropping `recentPicks` would empty "Last moves" each time the
 * room is fetched again in the middle of a hangman round.
 */
function withClientRoundState(
    fresh: GameSnapshot,
    previous: GameSnapshot,
): GameSnapshot {
    if (!fresh.round || fresh.round.id !== previous.round?.id) {
        return fresh;
    }

    const { committedOpIds, recentPicks, finders, hintSlots } = previous.round;

    if (
        committedOpIds === undefined &&
        recentPicks === undefined &&
        finders === undefined &&
        hintSlots === undefined
    ) {
        return fresh;
    }

    return {
        ...fresh,
        round: {
            ...fresh.round,
            ...(committedOpIds !== undefined ? { committedOpIds } : {}),
            ...(hintSlots !== undefined ? { hintSlots } : {}),
            ...(recentPicks !== undefined &&
            fresh.round.recentPicks === undefined
                ? { recentPicks }
                : {}),
            ...(fresh.round.wordGuesses !== undefined
                ? {
                      wordGuesses: withWordGuessSeqs(
                          fresh.round.wordGuesses,
                          previous.round.wordGuesses ?? [],
                      ),
                  }
                : {}),
            ...(fresh.round.finders !== undefined && finders !== undefined
                ? { finders: withFinderPlaces(fresh.round.finders, finders) }
                : {}),
        },
    };
}

/** The fetched finders keep the place in the guesses they had when seen live. */
function withFinderPlaces(
    fresh: GameFinder[],
    previous: GameFinder[],
): GameFinder[] {
    return fresh.map((finder) => {
        const known = previous.find(
            (seen) => seen.playerId === finder.playerId,
        );

        return known?.afterGuessId === undefined
            ? finder
            : { ...finder, afterGuessId: known.afterGuessId };
    });
}

/** A finder seen live: once per player, after the last guess of the log. */
function withFinder(round: GameRound, found: GameWordFound): GameRound {
    const finders = round.finders ?? [];

    if (finders.some((finder) => finder.playerId === found.playerId)) {
        return round;
    }

    return {
        ...round,
        finders: [
            ...finders,
            {
                playerId: found.playerId,
                seconds: found.seconds,
                points: found.points,
                afterGuessId: round.guesses?.at(-1)?.id ?? null,
            },
        ],
    };
}

/** The fetched words keep the arrival the live ones had, so "Last moves" keeps its order. */
function withWordGuessSeqs(
    fresh: GameWordGuess[],
    previous: GameWordGuess[],
): GameWordGuess[] {
    const unmatched = [...previous];

    return fresh.map((guess) => {
        const index = unmatched.findIndex(
            (known) =>
                known.playerId === guess.playerId && known.text === guess.text,
        );

        if (index === -1) {
            return guess;
        }

        const [known] = unmatched.splice(index, 1);

        return known.seq === undefined ? guess : { ...guess, seq: known.seq };
    });
}

/** The arrival number of the next letter or word of a hangman round. */
function nextMoveSeq(round: GameRound): number {
    const seqs = [
        ...(round.recentPicks ?? []),
        ...(round.wordGuesses ?? []),
    ].map((move) => move.seq ?? 0);

    return Math.max(0, ...seqs) + 1;
}

function withReady(
    ready: string[],
    playerId: string,
    isReady: boolean,
): string[] {
    const others = ready.filter((known) => known !== playerId);

    return isReady ? [...others, playerId] : others;
}

function withTruthSets(
    state: GameRoomState,
    update: (truthSets: GameTruthSets) => GameTruthSets,
): GameRoomState {
    const truthSets = state.snapshot.truthSets;

    if (!truthSets) {
        return state;
    }

    return {
        ...state,
        snapshot: { ...state.snapshot, truthSets: update(truthSets) },
    };
}

/** A Two truths round plays its teller's set: it is no longer ready. */
function withTellerSetPlayed(
    state: GameRoomState,
    round: GameRound,
): GameRoomState {
    if (round.game !== 'two_truths' || round.leaderPlayerId === null) {
        return state;
    }

    const tellerId = round.leaderPlayerId;
    const isMine = tellerId === state.snapshot.me.playerId;

    return withTruthSets(state, (truthSets) => ({
        ready: withReady(truthSets.ready, tellerId, false),
        mine:
            isMine && truthSets.mine
                ? { ...truthSets.mine, played: true }
                : truthSets.mine,
    }));
}

function revealedRound(
    round: GameRound,
    revealed: GameRoundRevealed,
): GameRound {
    if (round.game === 'guess_who') {
        const [drawn] = revealed.answers as GameTextRevealed[];

        return {
            ...round,
            revealedAt: revealed.revealedAt,
            drawn: drawn ?? null,
            candidates: revealed.candidates ?? [],
            votedCount: 0,
            myChoice: null,
        };
    }

    return {
        ...round,
        revealedAt: revealed.revealedAt,
        answers: revealed.answers as GameGifRevealed[],
        voters: [],
        myVote: null,
        myVotes: [],
        authorsHidden: revealed.authorsHidden ?? false,
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
                ...state,
                snapshot: withClientRoundState(action.snapshot, state.snapshot),
                lastEnded: keepsEndCard ? state.lastEnded : null,
            };
        }
        case 'round.started':
            return withTellerSetPlayed(
                {
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
                },
                action.round,
            );
        case 'round.ended': {
            if (state.lastEnded?.roundId === action.ended.roundId) {
                return state;
            }

            const isCurrent =
                state.snapshot.room.currentRoundId === action.ended.roundId;

            if (!isCurrent) {
                return state;
            }

            const alreadyFetched =
                state.snapshot.round?.id !== action.ended.roundId;

            if (alreadyFetched) {
                return { ...state, lastEnded: action.ended };
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
            return withRound(state, action.picked.roundId, (round) => {
                if (round.pickedLetters?.includes(action.picked.letter)) {
                    return round;
                }

                return {
                    ...round,
                    mask: action.picked.mask,
                    misses: action.picked.misses,
                    turnPlayerId: action.picked.turnPlayerId,
                    turnEndsAt: action.picked.turnEndsAt,
                    pickedLetters: [
                        ...(round.pickedLetters ?? []),
                        action.picked.letter,
                    ],
                    recentPicks: [
                        ...(round.recentPicks ?? []),
                        {
                            playerId: action.picked.playerId,
                            letter: action.picked.letter,
                            hit: action.picked.hit,
                            seq: nextMoveSeq(round),
                        },
                    ].slice(-RecentPicks),
                };
            });
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
                if (round.game === 'hangman') {
                    if (
                        round.wordGuesses?.some(
                            (guess) => guess.id === action.guess.id,
                        )
                    ) {
                        return round;
                    }

                    return {
                        ...round,
                        misses: action.misses ?? round.misses,
                        wordGuesses: [
                            ...(round.wordGuesses ?? []),
                            {
                                id: action.guess.id,
                                playerId: action.guess.playerId,
                                text: action.guess.text,
                                seq: nextMoveSeq(round),
                            },
                        ].slice(-WordGuessesShown),
                    };
                }

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
            return withRound(state, action.revealed.roundId, (round) =>
                revealedRound(round, action.revealed),
            );
        case 'vote.changed':
            return withRound(state, action.roundId, (round) => ({
                ...round,
                voters: withVoter(
                    round.voters ?? [],
                    action.playerId,
                    action.voted,
                ),
            }));
        case 'turn.changed':
            return withRound(state, action.turn.roundId, (round) => ({
                ...round,
                turnPlayerId: action.turn.turnPlayerId,
                turnEndsAt: action.turn.turnEndsAt,
            }));
        case 'statements.changed':
            return withTruthSets(state, (truthSets) => ({
                ...truthSets,
                ready: withReady(
                    truthSets.ready,
                    action.change.playerId,
                    action.change.ready,
                ),
            }));
        case 'statements.mine':
            return withTruthSets(state, (truthSets) => ({
                ready: withReady(
                    truthSets.ready,
                    state.snapshot.me.playerId,
                    action.mine !== null && !action.mine.played,
                ),
                mine: action.mine,
            }));
        case 'votes.counted':
            return withRound(state, action.counted.roundId, (round) => ({
                ...round,
                votedCount: action.counted.voted,
            }));
        case 'word.found':
            return withRound(state, action.found.roundId, (round) =>
                withFinder(round, action.found),
            );
        case 'word.changed':
            return withRound(state, action.change.roundId, (round) => ({
                ...round,
                mask: action.change.mask,
                maxHints: action.change.maxHints,
                hintSlots: round.hintSlots ?? round.maxHints,
                drawing: [],
                committedOpIds: [],
            }));
    }
}
