import { useState } from 'react';
import PokerCurrentTasksController from '@/actions/App/Http/Controllers/Poker/PokerCurrentTasksController';
import PokerRevealsController from '@/actions/App/Http/Controllers/Poker/PokerRevealsController';
import PokerRoundsController from '@/actions/App/Http/Controllers/Poker/PokerRoundsController';
import PokerTaskEstimatesController from '@/actions/App/Http/Controllers/Poker/PokerTaskEstimatesController';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import { nextUnestimatedTask } from '@/lib/poker/game-reducer';
import {
    isSpecialCard,
    type PokerResult,
    type PokerTask,
} from '@/lib/poker/types';
import { retroRequest } from '@/lib/retro/api';
import { useGame } from './game-context';
import { RoundTimerControl } from './round-timer-control';

/** Spec Decision 2: nearest card for numeric decks, the single mode otherwise. */
function suggestedEstimate(
    result: PokerResult | null,
    isNumeric: boolean,
): string | null {
    if (!result) {
        return null;
    }

    if (isNumeric) {
        return result.nearestCard;
    }

    return result.mode.length === 1 ? result.mode[0] : null;
}

export function FacilitatorToolbar() {
    const { snapshot, apply, run, refetch } = useGame();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const [choice, setChoice] = useState<{
        roundId: string;
        value: string;
    } | null>(null);
    const { game, me, current } = snapshot;

    if (!me.isFacilitator || !current || game.endedAt !== null) {
        return null;
    }

    const { round, taskId } = current;
    const task = snapshot.tasks.find((candidate) => candidate.id === taskId);
    const isRevealed = round.revealedAt !== null;
    const estimateCards = game.cards.filter((card) => !isSpecialCard(card));
    const estimate =
        choice?.roundId === round.id
            ? choice.value
            : (task?.estimate ??
              suggestedEstimate(round.result, game.isNumeric) ??
              '');
    const next = nextUnestimatedTask(snapshot);

    const perform = async <T,>(
        mutation: Promise<T>,
    ): Promise<T | undefined> => {
        setBusy(true);

        const result = await run(mutation);

        setBusy(false);

        return result;
    };

    const reveal = async () => {
        const result = await perform(
            retroRequest(
                PokerRevealsController.store({
                    game: game.id,
                    round: round.id,
                }),
            ),
        );

        if (result !== undefined) {
            await refetch();
        }
    };

    const revote = async () => {
        const result = await perform(
            retroRequest(
                PokerRoundsController.store({ game: game.id, task: taskId }),
            ),
        );

        if (result !== undefined) {
            await refetch();
        }
    };

    const saveEstimate = async () => {
        const saved = await perform(
            retroRequest<PokerTask>(
                PokerTaskEstimatesController.update({
                    game: game.id,
                    task: taskId,
                }),
                { value: estimate },
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

    return (
        <div
            role="toolbar"
            aria-label={t('Facilitator tools')}
            className="flex flex-wrap items-center justify-center gap-2"
        >
            {!isRevealed ? (
                <>
                    <Button
                        disabled={busy || round.votesCount === 0}
                        onClick={() => void reveal()}
                    >
                        {t('Show votes')}
                    </Button>
                    <RoundTimerControl />
                </>
            ) : (
                <>
                    <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => void revote()}
                    >
                        {t('Re-vote')}
                    </Button>
                    <Select
                        value={estimate}
                        onValueChange={(value) =>
                            setChoice({ roundId: round.id, value })
                        }
                    >
                        <SelectTrigger
                            className="w-28"
                            aria-label={t('Estimate')}
                        >
                            <SelectValue placeholder={t('Estimate')} />
                        </SelectTrigger>
                        <SelectContent>
                            {estimateCards.map((card) => (
                                <SelectItem key={card} value={card}>
                                    {card}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button
                        disabled={busy || estimate === ''}
                        onClick={() => void saveEstimate()}
                    >
                        {t('Save estimate')}
                    </Button>
                </>
            )}
            <Button
                variant="ghost"
                disabled={busy || next === null}
                onClick={() => void goToNext()}
            >
                {t('Next task')}
            </Button>
        </div>
    );
}
