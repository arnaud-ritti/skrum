import { useState } from 'react';
import RetroRotiController from '@/actions/App/Http/Controllers/Retros/RetroRotiController';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { retroRequest } from '@/lib/retro/api';
import type { RotiState } from '@/lib/retro/types';
import { useBoard } from './board-context';

export const RotiLabels = [
    'Time wasted',
    'Not really worth it',
    'Break-even',
    'Good use of time',
    'Excellent use of time',
] as const;

export function RotiControl() {
    const ctx = useBoard();
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const { myScore, respondents } = ctx.board.roti;
    const retroId = ctx.board.retro.id;

    const rate = async (score: number) => {
        if (busy) {
            return;
        }

        setBusy(true);

        const response = await ctx.run(
            score === myScore
                ? retroRequest<RotiState>(RetroRotiController.destroy(retroId))
                : retroRequest<RotiState>(RetroRotiController.update(retroId), {
                      score,
                  }),
        );

        setBusy(false);

        if (!response) {
            return;
        }

        ctx.apply({
            type: 'roti.set',
            myScore: response.myScore,
            respondents: response.respondents,
            voterIds: response.voterIds,
        });

        if (ctx.board.retro.phase === 'completed') {
            await ctx.refetch();
        }
    };

    return (
        <div className="space-y-2">
            <p className="text-sm font-semibold">{t('How was this retro?')}</p>
            <div
                role="group"
                aria-label={t('How was this retro?')}
                className="grid grid-cols-5 gap-1"
            >
                {RotiLabels.map((label, index) => {
                    const score = index + 1;

                    return (
                        <Button
                            key={label}
                            size="sm"
                            variant={myScore === score ? 'default' : 'outline'}
                            className="h-auto flex-col gap-0.5 px-1 py-1.5 text-[11px] leading-tight whitespace-normal"
                            aria-pressed={myScore === score}
                            disabled={busy}
                            onClick={() => void rate(score)}
                        >
                            <span className="text-sm font-semibold">
                                {score}
                            </span>
                            {t(label)}
                        </Button>
                    );
                })}
            </div>
            <p className="text-xs text-muted-foreground">
                {t(respondents === 1 ? ':count rating' : ':count ratings', {
                    count: respondents,
                })}
            </p>
        </div>
    );
}
