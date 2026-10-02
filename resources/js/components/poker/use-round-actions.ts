import { useState } from 'react';
import PokerCurrentTasksController from '@/actions/App/Http/Controllers/Poker/PokerCurrentTasksController';
import PokerRevealsController from '@/actions/App/Http/Controllers/Poker/PokerRevealsController';
import PokerRoundsController from '@/actions/App/Http/Controllers/Poker/PokerRoundsController';
import PokerSpectatorsController from '@/actions/App/Http/Controllers/Poker/PokerSpectatorsController';
import PokerTaskEstimatesController from '@/actions/App/Http/Controllers/Poker/PokerTaskEstimatesController';
import PokerVotesController from '@/actions/App/Http/Controllers/Poker/PokerVotesController';
import { nextUnestimatedTask } from '@/lib/poker/room-adapters';
import type { PokerTask, PokerVoteResponse } from '@/lib/poker/types';
import { retroRequest } from '@/lib/retro/api';
import { useGame } from './game-context';

export type RoundActions = {
    /** One of the facilitator's actions is on its way to the server. */
    busy: boolean;
    reveal: () => Promise<void>;
    revote: () => Promise<void>;
    saveEstimate: (value: string) => Promise<void>;
    goToNext: () => Promise<void>;
    /** The task "Next task" goes to; null when every other task is estimated. */
    next: PokerTask | null;
};

/** What the facilitator does to the current round. One instance for the table and the dock, so `busy` is shared. */
export function useRoundActions(): RoundActions {
    const { snapshot, apply, run, refetch } = useGame();
    const [busy, setBusy] = useState(false);
    const { game, current } = snapshot;
    const next = nextUnestimatedTask(snapshot);

    const perform = async <T>(mutation: Promise<T>): Promise<T | undefined> => {
        setBusy(true);

        const result = await run(mutation);

        setBusy(false);

        return result;
    };

    const reveal = async () => {
        if (!current) {
            return;
        }

        const result = await perform(
            retroRequest(
                PokerRevealsController.store({
                    game: game.id,
                    round: current.round.id,
                }),
            ),
        );

        if (result !== undefined) {
            await refetch();
        }
    };

    const revote = async () => {
        if (!current) {
            return;
        }

        const result = await perform(
            retroRequest(
                PokerRoundsController.store({
                    game: game.id,
                    task: current.taskId,
                }),
            ),
        );

        if (result !== undefined) {
            await refetch();
        }
    };

    const saveEstimate = async (value: string) => {
        if (!current || value === '') {
            return;
        }

        const saved = await perform(
            retroRequest<PokerTask>(
                PokerTaskEstimatesController.update({
                    game: game.id,
                    task: current.taskId,
                }),
                { value },
            ),
        );

        if (saved) {
            apply({ type: 'task.upsert', task: saved });
        }
    };

    const goToNext = async () => {
        if (!next) {
            return;
        }

        const result = await perform(
            retroRequest(PokerCurrentTasksController.update(game.id), {
                task_id: next.id,
            }),
        );

        if (result !== undefined) {
            await refetch();
        }
    };

    return { busy, reveal, revote, saveEstimate, goToNext, next };
}

/** Plays, changes or withdraws the viewer's card of the open round, shown at once and confirmed by the server. */
export function useVote(): {
    busy: boolean;
    play: (card: string) => Promise<void>;
    withdraw: () => Promise<void>;
} {
    const { snapshot, apply, run, refetch } = useGame();
    const [busy, setBusy] = useState(false);
    const { game, current } = snapshot;
    const round = current?.round ?? null;

    const send = async (card: string | null) => {
        if (round === null || card === round.myVote) {
            return;
        }

        const route = { game: game.id, round: round.id };
        const countChange = card === null ? -1 : round.myVote === null ? 1 : 0;

        setBusy(true);
        apply({
            type: 'vote.mine',
            response: {
                roundId: round.id,
                myVote: card,
                votesCount: round.votesCount + countChange,
                version: round.version,
                revealed: false,
            },
        });

        const response = await run(
            card === null
                ? retroRequest<PokerVoteResponse>(
                      PokerVotesController.destroy(route),
                  )
                : retroRequest<PokerVoteResponse>(
                      PokerVotesController.update(route),
                      { value: card },
                  ),
        );

        setBusy(false);

        if (!response) {
            return;
        }

        apply({ type: 'vote.mine', response });

        if (response.revealed) {
            await refetch();
        }
    };

    return {
        busy,
        play: (card) => send(card),
        withdraw: () => send(null),
    };
}

/** Switches a player between playing and watching; the server withdraws an open vote. */
export function useSetSpectator(): {
    busy: boolean;
    setSpectator: (playerId: string, spectator: boolean) => Promise<void>;
} {
    const { snapshot, run, refetch } = useGame();
    const [busy, setBusy] = useState(false);

    const setSpectator = async (playerId: string, spectator: boolean) => {
        setBusy(true);

        const result = await run(
            retroRequest(
                PokerSpectatorsController.update({
                    game: snapshot.game.id,
                    player: playerId,
                }),
                { spectator },
            ),
        );

        setBusy(false);

        if (result !== undefined) {
            await refetch();
        }
    };

    return { busy, setSpectator };
}
