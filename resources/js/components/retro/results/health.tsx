import { useId } from 'react';
import { HealthCheckResults } from '@/components/skrum/health-check-results';
import { useTrans } from '@/hooks/use-trans';
import { toHealthResults } from '@/lib/retro/session-end';
import type { HealthResults, HealthTrendPoint } from '@/lib/retro/types';
import { useBoard } from '../board-context';
import { HealthRadar } from './health-radar';
import { HealthTrend } from './health-trend';

type Props = {
    health: HealthResults;
    /** `null` for a guest: the earlier retros of the team are not theirs to see. */
    trend: HealthTrendPoint[] | null;
};

/**
 * The health check of the retro: figures, radar, trend across retros and
 * each statement with what it scored the retro before.
 */
export function HealthResult({ health, trend }: Props) {
    const { t } = useTrans();
    const { board } = useBoard();
    const titleId = useId();
    const { respondents, participants, results, summary } =
        toHealthResults(health);
    // The trend ends with this retro: the one before it is what each
    // statement is compared with.
    const previous =
        trend !== null && trend.length > 1
            ? trend[trend.length - 2]
            : undefined;

    return (
        <section
            aria-labelledby={titleId}
            data-slot="retro-health-result"
            className="min-w-0"
        >
            <h2 id={titleId} className="sr-only">
                {t('Team health')}
            </h2>
            <HealthCheckResults
                retroTitle={board.retro.title}
                respondents={respondents}
                participants={participants}
                previousRetroTitle={previous?.title}
                results={results}
                summary={summary}
            >
                <div className="grid min-w-0 grid-cols-1 items-center gap-4 @lg/card:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
                    <div className="mx-auto w-full max-w-72 min-w-0 px-4">
                        <HealthRadar statements={health.statements} />
                    </div>
                    {trend !== null && trend.length > 0 && (
                        <HealthTrend points={trend} />
                    )}
                </div>
            </HealthCheckResults>
        </section>
    );
}
