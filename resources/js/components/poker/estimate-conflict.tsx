import { useState } from 'react';
import PokerEstimateConflictsController from '@/actions/App/Http/Controllers/Integrations/PokerEstimateConflictsController';
import { Alert } from '@/components/ui/alert';
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
    const canDecide = snapshot.me.isFacilitator;

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
        <Alert
            variant="warning"
            data-slot="estimate-conflict"
            title={t('Changed in :source to :value', {
                source,
                value: conflict.sourceEstimate,
            })}
            description={
                canDecide && conflict.matchingCard === null
                    ? t(':value is not in this deck.', {
                          value: conflict.sourceEstimate,
                      })
                    : undefined
            }
        >
            {canDecide && (
                <div className="flex min-w-0 flex-wrap gap-2 pt-1 text-foreground">
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="max-w-full min-w-0"
                        disabled={busy}
                        onClick={() => void resolve('keepSkrum')}
                    >
                        <span className="truncate">
                            {t('Keep skrum estimate')}
                        </span>
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="max-w-full min-w-0"
                        disabled={busy || conflict.matchingCard === null}
                        onClick={() => void resolve('useSource')}
                    >
                        <span className="truncate">
                            {t('Use :source estimate', { source })}
                        </span>
                    </Button>
                </div>
            )}
        </Alert>
    );
}
