import {
    ArrowDownIcon,
    ArrowUpIcon,
    EqualIcon,
    TriangleAlertIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type HealthDistribution = [number, number, number, number, number];

export interface HealthCheckResult {
    statementId: string;
    label: string;
    distribution: HealthDistribution;
    mean: number;
    previousMean?: number | null;
}

export interface HealthCheckResultsProps {
    retroTitle: string;
    respondents: number;
    participants: number;
    previousRetroTitle?: string;
    results: HealthCheckResult[];
    alertThreshold?: number;
    className?: string;
}

export const healthCheckMinimumRespondents = 3;

const segmentClasses = [
    'bg-skrum-roti-1',
    'bg-skrum-roti-2',
    'bg-skrum-roti-3',
    'bg-skrum-roti-4',
    'bg-skrum-roti-5',
];

function useFormatDecimal(): (value: number) => string {
    return (value) =>
        value.toLocaleString(document.documentElement.lang || undefined, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
        });
}

function Trend({
    delta,
    previousRetroTitle,
}: {
    delta: number;
    previousRetroTitle?: string;
}) {
    const { t } = useTrans();
    const format = useFormatDecimal();
    const rounded = Math.round(delta * 10) / 10;
    const reference = previousRetroTitle ?? t('previous retro');

    if (rounded === 0) {
        const text = t('no change');

        return (
            <span
                data-slot="health-trend"
                data-trend="flat"
                title={`${text} ${t('vs :retro', { retro: reference })}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground"
            >
                <EqualIcon className="size-3.5" aria-hidden />
                <span>{text}</span>
                <span className="sr-only">
                    {t('vs :retro', { retro: reference })}
                </span>
            </span>
        );
    }

    const up = rounded > 0;
    const Icon = up ? ArrowUpIcon : ArrowDownIcon;
    const signed = `${up ? '+' : '−'}${format(Math.abs(rounded))}`;

    return (
        <span
            data-slot="health-trend"
            data-trend={up ? 'up' : 'down'}
            className={cn(
                'inline-flex items-center gap-1 text-xs font-semibold',
                up ? 'text-skrum-success-text' : 'text-skrum-destructive-text',
            )}
        >
            <Icon className="size-3.5" aria-hidden />
            <span>{signed}</span>
            <span className="sr-only">
                {t('vs :retro', { retro: reference })}
            </span>
        </span>
    );
}

function ResultRow({
    result,
    threshold,
    previousRetroTitle,
}: {
    result: HealthCheckResult;
    threshold: number;
    previousRetroTitle?: string;
}) {
    const { t } = useTrans();
    const format = useFormatDecimal();
    const alert = result.mean < threshold;
    const hasTrend =
        result.previousMean !== undefined && result.previousMean !== null;
    const distributionLabel = result.distribution
        .map((count, index) => `${index + 1} : ${count}`)
        .join(' · ');

    return (
        <li
            data-slot="health-result"
            data-statement-id={result.statementId}
            data-alert={alert || undefined}
            className={cn(
                'flex flex-col gap-2 rounded-lg px-3 py-3',
                alert && 'bg-skrum-destructive-soft',
            )}
        >
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="min-w-0 truncate text-sm font-bold">
                        {result.label}
                    </span>
                    {alert ? (
                        <Badge variant="destructive" icon={TriangleAlertIcon}>
                            {t('Needs attention')}
                        </Badge>
                    ) : null}
                </div>
                <div className="flex shrink-0 items-baseline gap-2">
                    <span
                        data-slot="health-mean"
                        className={cn(
                            'font-display text-lg font-bold tabular-nums',
                            alert && 'text-skrum-destructive-text',
                        )}
                    >
                        {format(result.mean)}
                        <small className="ml-0.5 text-xs font-semibold text-muted-foreground">
                            {t('/5')}
                        </small>
                    </span>
                    {hasTrend ? (
                        <Trend
                            delta={result.mean - (result.previousMean ?? 0)}
                            previousRetroTitle={previousRetroTitle}
                        />
                    ) : null}
                </div>
            </div>
            <div aria-hidden className="relative h-2 rounded-full bg-muted">
                <span
                    className={cn(
                        'block h-full rounded-full',
                        alert ? 'bg-destructive' : 'bg-chart-1',
                    )}
                    style={{
                        width: `${Math.min(Math.max(result.mean / 5, 0), 1) * 100}%`,
                    }}
                />
                <i
                    className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-foreground/60"
                    style={{ left: `${(threshold / 5) * 100}%` }}
                />
            </div>
            <div
                role="img"
                aria-label={distributionLabel}
                data-slot="health-distribution"
                className="flex h-5 gap-0.5"
            >
                {result.distribution.map((count, index) =>
                    count > 0 ? (
                        <span
                            key={index}
                            title={`${index + 1} : ${count}`}
                            className={cn(
                                'flex min-w-0 items-center justify-center rounded-xs text-overline text-skrum-roti-foreground',
                                segmentClasses[index],
                            )}
                            style={{ flex: count }}
                        >
                            {count}
                        </span>
                    ) : null,
                )}
            </div>
        </li>
    );
}

export function HealthCheckResults({
    retroTitle,
    respondents,
    participants,
    previousRetroTitle,
    results,
    alertThreshold = 3,
    className,
}: HealthCheckResultsProps) {
    const { t } = useTrans();
    const revealed = respondents >= healthCheckMinimumRespondents;
    const hasTrend = results.some(
        (result) =>
            result.previousMean !== undefined && result.previousMean !== null,
    );
    const subtitle = t(':respondents answers from :participants participants', {
        respondents,
        participants,
    });

    return (
        <Card
            data-slot="health-check-results"
            title={t('Health check results · :retro', { retro: retroTitle })}
            description={
                hasTrend && previousRetroTitle && revealed
                    ? `${subtitle} · ${t('compared with :retro', { retro: previousRetroTitle })}`
                    : subtitle
            }
            className={className}
        >
            <div className="flex flex-col gap-4 px-5 py-4 @max-card-narrow/card:px-4">
                {revealed ? (
                    <ul className="flex flex-col gap-1">
                        {results.map((result) => (
                            <ResultRow
                                key={result.statementId}
                                result={result}
                                threshold={alertThreshold}
                                previousRetroTitle={previousRetroTitle}
                            />
                        ))}
                    </ul>
                ) : (
                    <p
                        role="status"
                        data-slot="health-hidden"
                        className="rounded-md bg-muted px-3 py-3 text-body-sm text-muted-foreground"
                    >
                        {t('Not enough answers to show results')}
                    </p>
                )}
            </div>
            {revealed ? (
                <div
                    data-slot="health-legend"
                    className="flex flex-wrap gap-x-4 gap-y-2 border-t px-5 py-3 text-xs text-muted-foreground @max-card-narrow/card:px-4"
                >
                    {segmentClasses.map((swatch, index) => (
                        <span
                            key={swatch}
                            className="flex items-center gap-1.5"
                        >
                            <i
                                aria-hidden
                                className={cn('size-2.5 rounded-xs', swatch)}
                            />
                            {index === 0
                                ? t('1 · Strongly disagree')
                                : index === 4
                                  ? t('5 · Strongly agree')
                                  : index + 1}
                        </span>
                    ))}
                    <span className="flex items-center gap-1.5">
                        <i aria-hidden className="h-3 w-0.5 bg-foreground/60" />
                        {t('Alert threshold · :threshold/5', {
                            threshold: alertThreshold,
                        })}
                    </span>
                </div>
            ) : null}
        </Card>
    );
}
