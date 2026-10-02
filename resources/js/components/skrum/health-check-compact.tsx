import { HeartPulseIcon, TriangleAlertIcon } from 'lucide-react';
import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';
import { healthCheckResultsScale } from './health-check-results';
import type { HealthCheckResult } from './health-check-results';

export interface HealthCheckCompactProps {
    respondents: number;
    /** The average across the statements. */
    score: number;
    results: HealthCheckResult[];
    /** Names what each move is compared with, for a screen reader. */
    previousRetroTitle?: string;
    /** Highest score; the server stores 1..10. */
    scale?: number;
    /** Defaults to 60 % of the scale. */
    alertThreshold?: number;
    /** Opens the full results; no "Details" button without it. */
    onDetails?: () => void;
    className?: string;
}

function formatDecimal(value: number): string {
    return value.toLocaleString(document.documentElement.lang || undefined, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });
}

/** The move since the previous retro, rounded as it is shown; `null` without one. */
function moveOf(result: HealthCheckResult): number | null {
    if (
        result.average === null ||
        result.previousAverage === undefined ||
        result.previousAverage === null
    ) {
        return null;
    }

    return Math.round((result.average - result.previousAverage) * 10) / 10;
}

function Delta({
    move,
    previousRetroTitle,
}: {
    move: number;
    previousRetroTitle?: string;
}) {
    const { t } = useTrans();
    const versus = t('vs :retro', {
        retro: previousRetroTitle ?? t('previous retro'),
    });

    if (move === 0) {
        return (
            <span
                data-slot="health-compact-delta"
                data-trend="flat"
                className="text-right text-xs font-semibold whitespace-nowrap text-muted-foreground"
            >
                <span aria-hidden>=</span>
                <span className="sr-only">
                    {t('no change')} {versus}
                </span>
            </span>
        );
    }

    const up = move > 0;

    return (
        <span
            data-slot="health-compact-delta"
            data-trend={up ? 'up' : 'down'}
            className={cn(
                'text-right text-xs font-semibold whitespace-nowrap tabular-nums',
                up ? 'text-skrum-success-text' : 'text-skrum-destructive-text',
            )}
        >
            {`${up ? '+' : '−'}${formatDecimal(Math.abs(move))}`}
            <span className="sr-only">{versus}</span>
        </span>
    );
}

function Row({
    result,
    scale,
    threshold,
    previousRetroTitle,
}: {
    result: HealthCheckResult;
    scale: number;
    threshold: number;
    previousRetroTitle?: string;
}) {
    const { t } = useTrans();
    const { average } = result;
    const alert = average !== null && average < threshold;
    const move = moveOf(result);

    return (
        <li
            data-slot="health-compact-row"
            data-statement-key={result.key}
            data-alert={alert || undefined}
            className="col-span-full grid grid-cols-subgrid items-center text-body-sm"
        >
            <span className={cn('truncate', alert && 'font-semibold')}>
                {result.label}
                {alert && (
                    <span className="sr-only"> · {t('Needs attention')}</span>
                )}
            </span>
            <span
                aria-hidden
                data-slot="health-compact-bar"
                className="h-2 overflow-hidden rounded-full bg-muted"
            >
                {average !== null && (
                    <span
                        className={cn(
                            'block h-full rounded-full',
                            alert ? 'bg-skrum-warning' : 'bg-chart-2',
                        )}
                        style={{
                            width: `${Math.round(Math.min(Math.max(average / scale, 0), 1) * 100)}%`,
                        }}
                    />
                )}
            </span>
            {average === null ? (
                <span className="col-span-2 text-right text-xs text-muted-foreground">
                    {t('No answers')}
                </span>
            ) : (
                <>
                    <b
                        data-slot="health-compact-mean"
                        className="text-right tabular-nums"
                    >
                        {formatDecimal(average)}
                    </b>
                    {move === null ? (
                        <span />
                    ) : (
                        <Delta
                            move={move}
                            previousRetroTitle={previousRetroTitle}
                        />
                    )}
                </>
            )}
        </li>
    );
}

/**
 * The health check of a retro at a glance (ScreenRetroROTI, session end):
 * one compact row per statement, the statement that dropped the most, and a
 * way to the full results.
 */
export function HealthCheckCompact({
    respondents,
    score,
    results,
    previousRetroTitle,
    scale = healthCheckResultsScale,
    alertThreshold,
    onDetails,
    className,
}: HealthCheckCompactProps) {
    const { t } = useTrans();
    const headingId = useId();
    const threshold = alertThreshold ?? scale * 0.6;
    const average = formatDecimal(score);
    const steepest = results.reduce<{ label: string; move: number } | null>(
        (lowest, result) => {
            const move = moveOf(result);

            return move !== null && move < (lowest?.move ?? 0)
                ? { label: result.label, move }
                : lowest;
        },
        null,
    );

    return (
        <Card
            asChild
            data-slot="health-check-compact"
            className={cn(
                'grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-4',
                className,
            )}
        >
            <section aria-labelledby={headingId}>
                <h2
                    id={headingId}
                    className="flex min-w-0 items-center gap-2 text-sm font-semibold"
                >
                    <HeartPulseIcon aria-hidden className="size-4 shrink-0" />
                    <span className="truncate">{t('Health check')}</span>
                </h2>
                <span className="text-xs whitespace-nowrap text-muted-foreground">
                    {respondents === 1
                        ? t('1 answer · avg :average', { average })
                        : t(':count answers · avg :average', {
                              count: respondents,
                              average,
                          })}
                </span>
                {results.length === 0 ? (
                    <p className="col-span-full text-body-sm text-muted-foreground">
                        {t('No statements to show.')}
                    </p>
                ) : (
                    <ul className="col-span-full grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_auto_auto] gap-3">
                        {results.map((result) => (
                            <Row
                                key={result.key}
                                result={result}
                                scale={scale}
                                threshold={threshold}
                                previousRetroTitle={previousRetroTitle}
                            />
                        ))}
                    </ul>
                )}
                {(steepest !== null || onDetails !== undefined) && (
                    <div className="col-span-full flex min-w-0 items-center justify-between gap-3">
                        {steepest !== null ? (
                            <p
                                data-slot="health-compact-note"
                                className="flex min-w-0 items-start gap-1 text-xs text-muted-foreground"
                            >
                                <TriangleAlertIcon
                                    aria-hidden
                                    className="mt-0.5 size-3.5 shrink-0 text-skrum-warning-text"
                                />
                                <span className="min-w-0 break-words">
                                    {t(
                                        ':statement dropped :delta — worth a topic next retro.',
                                        {
                                            statement: steepest.label,
                                            delta: formatDecimal(
                                                Math.abs(steepest.move),
                                            ),
                                        },
                                    )}
                                </span>
                            </p>
                        ) : (
                            <span />
                        )}
                        {onDetails !== undefined && (
                            <Button
                                type="button"
                                variant="link"
                                size="sm"
                                className="h-auto shrink-0 p-0"
                                onClick={onDetails}
                            >
                                {t('Details')}
                            </Button>
                        )}
                    </div>
                )}
            </section>
        </Card>
    );
}
