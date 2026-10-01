import { useState } from 'react';
import PokerEstimateConflictsController from '@/actions/App/Http/Controllers/Integrations/PokerEstimateConflictsController';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type { PokerEstimateConflict, PokerTask } from '@/lib/poker/types';
import { retroRequest } from '@/lib/retro/api';
import { useGame } from './game-context';

type Props = {
    task: PokerTask;
    conflict: PokerEstimateConflict;
    source: string;
};

/**
 * Spec 8 §5.8: a diverging source estimate is flagged, never applied
 * silently; the facilitator decides.
 */
export function EstimateConflict({ task, conflict, source }: Props) {
    const { snapshot, apply, run } = useGame();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const notInDeck = t(':value is not in this deck.', {
        value: conflict.sourceEstimate,
    });

    const resolve = async (resolution: 'keepSkrum' | 'useSource') => {
        setBusy(true);

        try {
            const result = await run(
                retroRequest<PokerTask>(
                    PokerEstimateConflictsController.store({
                        game: snapshot.game.id,
                        task: task.id,
                    }),
                    { resolution },
                ),
            );

            if (result) {
                apply({ type: 'task.upsert', task: result });
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="flex flex-wrap items-center gap-2">
            <Badge
                variant="outline"
                className="border-amber-500 text-amber-700 dark:text-amber-400"
            >
                {t('Changed in :source to :value', {
                    source,
                    value: conflict.sourceEstimate,
                })}
            </Badge>
            {snapshot.me.isFacilitator && (
                <>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void resolve('keepSkrum')}
                    >
                        {t('Keep skrum estimate')}
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || conflict.matchingCard === null}
                        onClick={() => void resolve('useSource')}
                    >
                        {t('Use :source estimate', { source })}
                    </Button>
                    {conflict.matchingCard === null && (
                        <span className="text-xs text-muted-foreground">
                            {notInDeck}
                        </span>
                    )}
                </>
            )}
        </div>
    );
}
