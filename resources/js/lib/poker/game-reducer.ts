import type {
    PokerPlayer,
    PokerRound,
    PokerRoundVote,
    PokerSnapshot,
    PokerTask,
    PokerVoteResponse,
} from './types';

export type GameAction =
    | { type: 'replace'; snapshot: PokerSnapshot }
    | { type: 'task.upsert'; task: PokerTask }
    | { type: 'task.remove'; taskId: string }
    | { type: 'tasks.reorder'; taskIds: string[] }
    | {
          type: 'vote.changed';
          roundId: string;
          playerId: string;
          hasVoted: boolean;
          votesCount: number;
          version: number;
      }
    | { type: 'vote.mine'; response: PokerVoteResponse }
    | { type: 'timer.set'; roundId: string; timerEndsAt: string | null };

export function sortedTasks(tasks: PokerTask[]): PokerTask[] {
    return [...tasks].sort((first, second) => first.position - second.position);
}

/**
 * The next task still to estimate after the current one, in list order,
 * wrapping around; the current task itself is never proposed.
 */
export function nextUnestimatedTask(snapshot: PokerSnapshot): PokerTask | null {
    const tasks = sortedTasks(snapshot.tasks);
    const currentIndex = tasks.findIndex(
        (task) => task.id === snapshot.current?.taskId,
    );
    const ordered =
        currentIndex === -1
            ? tasks
            : [
                  ...tasks.slice(currentIndex + 1),
                  ...tasks.slice(0, currentIndex),
              ];

    return ordered.find((task) => task.estimate === null) ?? null;
}

function withTasks(state: PokerSnapshot, tasks: PokerTask[]): PokerSnapshot {
    const ordered = sortedTasks(tasks);

    return {
        ...state,
        tasks: ordered,
        game: {
            ...state.game,
            tasksCount: ordered.length,
            estimatedCount: ordered.filter((task) => task.estimate !== null)
                .length,
        },
    };
}

function withRound(
    state: PokerSnapshot,
    roundId: string,
    update: (round: PokerRound) => PokerRound,
): PokerSnapshot {
    if (!state.current || state.current.round.id !== roundId) {
        return state;
    }

    return {
        ...state,
        current: { ...state.current, round: update(state.current.round) },
    };
}

/** Voters are listed in join order, like the server does. */
function inPlayerOrder(
    votes: PokerRoundVote[],
    players: PokerPlayer[],
): PokerRoundVote[] {
    const order = new Map(players.map((player, index) => [player.id, index]));

    return [...votes].sort(
        (first, second) =>
            (order.get(first.playerId) ?? players.length) -
            (order.get(second.playerId) ?? players.length),
    );
}

export function gameReducer(
    state: PokerSnapshot,
    action: GameAction,
): PokerSnapshot {
    switch (action.type) {
        case 'replace':
            return action.snapshot;
        case 'task.upsert':
            return withTasks(state, [
                ...state.tasks.filter((task) => task.id !== action.task.id),
                action.task,
            ]);
        case 'task.remove': {
            const next = withTasks(
                state,
                state.tasks.filter((task) => task.id !== action.taskId),
            );

            if (state.current?.taskId !== action.taskId) {
                return next;
            }

            return {
                ...next,
                current: null,
                game: { ...next.game, currentTaskId: null },
            };
        }
        case 'tasks.reorder': {
            const byId = new Map(state.tasks.map((task) => [task.id, task]));
            const listed = [...new Set(action.taskIds)].flatMap((id) => {
                const task = byId.get(id);

                return task ? [task] : [];
            });
            const unlisted = state.tasks.filter(
                (task) => !action.taskIds.includes(task.id),
            );

            return withTasks(
                state,
                [...listed, ...sortedTasks(unlisted)].map((task, index) => ({
                    ...task,
                    position: index + 1,
                })),
            );
        }
        case 'vote.changed':
            return withRound(state, action.roundId, (round) => {
                if (action.version <= round.version) {
                    return round;
                }

                const others = round.votes.filter(
                    (vote) => vote.playerId !== action.playerId,
                );
                const known = round.votes.find(
                    (vote) => vote.playerId === action.playerId,
                );
                const votes = action.hasVoted
                    ? inPlayerOrder(
                          [
                              ...others,
                              known ?? {
                                  playerId: action.playerId,
                                  value: null,
                              },
                          ],
                          state.players,
                      )
                    : others;

                return {
                    ...round,
                    votes,
                    votesCount: action.votesCount,
                    version: action.version,
                };
            });
        case 'vote.mine': {
            const { response } = action;
            const playerId = state.me.playerId;

            return withRound(state, response.roundId, (round) => {
                const others = round.votes.filter(
                    (vote) => vote.playerId !== playerId,
                );
                const votes =
                    response.myVote === null
                        ? others
                        : inPlayerOrder(
                              [...others, { playerId, value: response.myVote }],
                              state.players,
                          );
                const isCurrent = response.version >= round.version;

                return {
                    ...round,
                    votes,
                    myVote: response.myVote,
                    votesCount: isCurrent
                        ? response.votesCount
                        : round.votesCount,
                    version: isCurrent ? response.version : round.version,
                };
            });
        }
        case 'timer.set':
            return withRound(state, action.roundId, (round) => ({
                ...round,
                timerEndsAt: action.timerEndsAt,
            }));
    }
}
