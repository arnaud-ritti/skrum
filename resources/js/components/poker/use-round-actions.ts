import { useRef, useState } from 'react';
import PokerCurrentTasksController from '@/actions/App/Http/Controllers/Poker/PokerCurrentTasksController';
import PokerRevealsController from '@/actions/App/Http/Controllers/Poker/PokerRevealsController';
import PokerRoundsController from '@/actions/App/Http/Controllers/Poker/PokerRoundsController';
import PokerSpectatorsController from '@/actions/App/Http/Controllers/Poker/PokerSpectatorsController';
import PokerStatusesController from '@/actions/App/Http/Controllers/Poker/PokerStatusesController';
import PokerTaskEstimatesController from '@/actions/App/Http/Controllers/Poker/PokerTaskEstimatesController';
import PokerVotesController from '@/actions/App/Http/Controllers/Poker/PokerVotesController';
import { suggestedEstimate } from '@/components/skrum/poker-table';
import { nextUnestimatedTask } from '@/lib/poker/room-adapters';
import { isSpecialCard } from '@/lib/poker/types';
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
    /**
     * Saves the estimate, then opens the next task when there is one. When
     * the move fails, the estimate stays saved and the error is shown.
     */
    validate: (value: string) => Promise<void>;
    /** The task "Next task" goes to; null when every other task is estimated. */
    next: PokerTask | null;
    /**
     * The final estimate of the current round: what the facilitator chose,
     * otherwise the saved estimate unless the round was revealed after it
     * (a re-vote), otherwise the nearest card. Empty when nothing can be
     * proposed.
     */
    estimate: string;
    /** The cards a final estimate is chosen from: the deck without "?" and the break. */
    estimateCards: string[];
    chooseEstimate: (value: string) => void;
};

/** What the facilitator does to the current round. One instance for the table and the dock, so `busy` is shared. */
export function useRoundActions(): RoundActions {
    const { snapshot, apply, run, refetch } = useGame();
    const [busy, setBusy] = useState(false);
    const [choice, setChoice] = useState<{
        roundId: string;
        value: string;
    } | null>(null);
    const { game, current } = snapshot;
    const next = nextUnestimatedTask(snapshot);
    const round = current?.round ?? null;
    const task = snapshot.tasks.find(
        (candidate) => candidate.id === current?.taskId,
    );
    const suggested = suggestedEstimate(round?.result, game.isNumeric);
    // A reveal that came after the estimate was saved (a re-vote) proposes
    // its own nearest card again.
    const isRevotedSinceSaved =
        suggested !== null &&
        !!round?.revealedAt &&
        !!task?.estimatedAt &&
        Date.parse(round.revealedAt) > Date.parse(task.estimatedAt);
    const saved = isRevotedSinceSaved ? null : (task?.estimate ?? null);
    const estimate =
        round !== null && choice?.roundId === round.id
            ? choice.value
            : (saved ?? suggested ?? '');
    const deckCards = game.cards.filter((card) => !isSpecialCard(card));
    // A saved estimate that left the deck stays among the cards.
    const estimateCards =
        estimate === '' || deckCards.includes(estimate)
            ? deckCards
            : [...deckCards, estimate];
    const chooseEstimate = (value: string) => {
        if (round !== null) {
            setChoice({ roundId: round.id, value });
        }
    };

    const perform = async <T>(mutation: Promise<T>): Promise<T | undefined> => {
        setBusy(true);

        const result = await run(mutation);

        setBusy(false);

        return result;
    };

    const performThenRefetch = async <T>(mutation: Promise<T>) => {
        if ((await perform(mutation)) !== undefined) {
            await refetch();
        }
    };

    const saveRequest = (taskId: string, value: string) =>
        retroRequest<PokerTask>(
            PokerTaskEstimatesController.update({
                game: game.id,
                task: taskId,
            }),
            { value },
        );

    const moveRequest = (taskId: string) =>
        retroRequest(PokerCurrentTasksController.update(game.id), {
            task_id: taskId,
        });

    const reveal = async () => {
        if (!current) {
            return;
        }

        await performThenRefetch(
            retroRequest(
                PokerRevealsController.store({
                    game: game.id,
                    round: current.round.id,
                }),
            ),
        );
    };

    const revote = async () => {
        if (!current) {
            return;
        }

        await performThenRefetch(
            retroRequest(
                PokerRoundsController.store({
                    game: game.id,
                    task: current.taskId,
                }),
            ),
        );
    };

    const saveEstimate = async (value: string) => {
        if (!current || value === '') {
            return;
        }

        const saved = await perform(saveRequest(current.taskId, value));

        if (saved) {
            apply({ type: 'task.upsert', task: saved });
        }
    };

    const goToNext = async () => {
        if (!next) {
            return;
        }

        await performThenRefetch(moveRequest(next.id));
    };

    const validate = async (value: string) => {
        if (!current || value === '') {
            return;
        }

        let moved: unknown;

        setBusy(true);

        try {
            const saved = await run(saveRequest(current.taskId, value));

            if (!saved) {
                return;
            }

            apply({ type: 'task.upsert', task: saved });

            if (!next) {
                return;
            }

            moved = await run(moveRequest(next.id));
        } finally {
            setBusy(false);
        }

        if (moved !== undefined) {
            await refetch();
        }
    };

    return {
        busy,
        reveal,
        revote,
        saveEstimate,
        goToNext,
        validate,
        next,
        estimate,
        estimateCards,
        chooseEstimate,
    };
}

/** Plays, changes or withdraws the viewer's card of the open round (changes only, after a reveal), shown at once and confirmed by the server. */
export function useVote(): {
    busy: boolean;
    play: (card: string) => Promise<void>;
    withdraw: () => Promise<void>;
} {
    const { snapshot, apply, run, refetch } = useGame();
    const [busy, setBusy] = useState(false);
    const isSending = useRef(false);
    const { game, current } = snapshot;
    const round = current?.round ?? null;

    /** One card at a time: two in flight would count from the same vote and could land out of order. */
    const send = async (card: string | null) => {
        if (round === null || card === round.myVote || isSending.current) {
            return;
        }

        // A revealed round keeps a result: a card can change, not leave.
        if (card === null && round.revealedAt !== null) {
            return;
        }

        const route = { game: game.id, round: round.id };
        const countChange = card === null ? -1 : round.myVote === null ? 1 : 0;

        isSending.current = true;
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

        isSending.current = false;
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

/** Ends the game or reopens it. Resolves to false when the server refused. */
export function useSetEnded(): {
    busy: boolean;
    setEnded: (ended: boolean) => Promise<boolean>;
} {
    const { snapshot, run, refetch } = useGame();
    const [busy, setBusy] = useState(false);

    const setEnded = async (ended: boolean): Promise<boolean> => {
        setBusy(true);

        const result = await run(
            retroRequest(PokerStatusesController.update(snapshot.game.id), {
                ended,
            }),
        );

        setBusy(false);

        if (result === undefined) {
            return false;
        }

        await refetch();

        return true;
    };

    return { busy, setEnded };
}
