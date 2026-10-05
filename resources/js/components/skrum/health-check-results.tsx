import {
    ArrowDownIcon,
    ArrowUpIcon,
    EqualIcon,
    TriangleAlertIcon,
} from 'lucide-react';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardHeader } from '@/components/ui/card';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

/** Answers per score of the health scale, 1 to 5, as the server buckets them. */
export type HealthDistribution = number[];

/** `key`, `label`, `text`, `average` and `count` as in `HealthStatementResult`. */
export interface HealthCheckResult {
    key: string;
    label: string;
    text?: string;
    /** `null` when nobody answered the statement. */
    average: number | null;
    count?: number;
    /** Answers per score, 1 to 5; no bars without it. */
    distribution?: HealthDistribution;
    /** Backlog: no per-statement comparison on the server. */
    previousAverage?: number | null;
}

export interface HealthCheckHighlight {
    label: string;
    average: number;
}

/** The figures of `HealthResults`; each one is rendered only when given. */
export interface HealthCheckSummary {
    score?: number;
    topStrength?: HealthCheckHighlight | null;
    growthArea?: HealthCheckHighlight | null;
    alignment?: { value: number; label: string };
    assessment?: { title: string; sentence: string };
}

export interface HealthCheckResultsProps {
    retroTitle: string;
    respondents: number;
    participants: number;
    previousRetroTitle?: string;
    results: HealthCheckResult[];
    /** Highest score: every reader reports on the health scale, 1 to 5. */
    scale?: number;
    /** Defaults to 60 % of the scale. */
    alertThreshold?: number;
    /**
     * Results stay hidden below this number of respondents. Off by default: the
     * server has no such rule. Pass `healthCheckMinimumRespondents` to opt in.
     */
    minimumRespondents?: number;
    summary?: HealthCheckSummary;
    /** Slot for the radar and the trend across retros. */
    children?: ReactNode;
    className?: string;
}

export const healthCheckResultsScale = 5;

/** Consensus is reported from 0 to 10 whatever the scale of the scores. */
const alignmentScale = 10;
export const healthCheckMinimumRespondents = 3;

const segmentClasses = [
    'bg-skrum-roti-1',
    'bg-skrum-roti-2',
    'bg-skrum-roti-3',
    'bg-skrum-roti-4',
    'bg-skrum-roti-5',
];

function levelOf(score: number, scale: number): number {
    return Math.min(
        segmentClasses.length - 1,
        Math.max(0, Math.ceil((score / scale) * segmentClasses.length) - 1),
    );
}

function rangeOf(level: number, scale: number): string {
    const scores = Array.from(
        { length: scale },
        (_, index) => index + 1,
    ).filter((score) => levelOf(score, scale) === level);

    if (scores.length === 0) {
        return '';
    }

    const first = scores[0];
    const last = scores[scores.length - 1];

    return first === last ? String(first) : `${first}–${last}`;
}

function useFormatNumber(): (value: number) => string {
    return (value) =>
        value.toLocaleString(document.documentElement.lang || undefined, {
            maximumFractionDigits: 1,
        });
}

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
                    {` ${t('vs :retro', { retro: reference })}`}
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
                {` ${t('vs :retro', { retro: reference })}`}
            </span>
        </span>
    );
}

function ResultRow({
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
    const format = useFormatDecimal();
    const { average, distribution } = result;
    const alert = average !== null && average < threshold;
    const hasTrend =
        average !== null &&
        result.previousAverage !== undefined &&
        result.previousAverage !== null;
    const segmentLabel = (count: number, index: number): string =>
        t(
            count === 1
                ? 'Score :score, :count answer'
                : 'Score :score, :count answers',
            { score: index + 1, count },
        );
    const distributionLabel = (distribution ?? [])
        .map(segmentLabel)
        .join(' · ');

    return (
        <li
            data-slot="health-result"
            data-statement-key={result.key}
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
                    {average === null ? (
                        <span
                            data-slot="health-mean"
                            className="text-sm text-muted-foreground"
                        >
                            {t('No answers')}
                        </span>
                    ) : (
                        <span
                            data-slot="health-mean"
                            className={cn(
                                'font-display text-lg font-bold tabular-nums',
                                alert && 'text-skrum-destructive-text',
                            )}
                        >
                            {format(average)}
                            <small className="ml-0.5 text-xs font-semibold text-muted-foreground">
                                /{scale}
                            </small>
                        </span>
                    )}
                    {hasTrend ? (
                        <Trend
                            delta={average - (result.previousAverage ?? 0)}
                            previousRetroTitle={previousRetroTitle}
                        />
                    ) : null}
                </div>
            </div>
            {result.text ? (
                <p className="text-body-sm break-words text-muted-foreground">
                    {result.text}
                </p>
            ) : null}
            <div aria-hidden className="relative h-2 rounded-full bg-muted">
                {average !== null ? (
                    <span
                        className={cn(
                            'block h-full rounded-full',
                            alert ? 'bg-destructive' : 'bg-chart-1',
                        )}
                        style={{
                            width: `${Math.min(Math.max(average / scale, 0), 1) * 100}%`,
                        }}
                    />
                ) : null}
                <i
                    className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-foreground/60"
                    style={{
                        left: `${Math.min(Math.max(threshold / scale, 0), 1) * 100}%`,
                    }}
                />
            </div>
            {result.count !== undefined && distribution === undefined ? (
                <span
                    data-slot="health-count"
                    className="text-xs text-muted-foreground"
                >
                    {t(':count answered', { count: result.count })}
                </span>
            ) : null}
            {distribution !== undefined ? (
                <div
                    role="img"
                    aria-label={distributionLabel}
                    data-slot="health-distribution"
                    className="flex h-5 gap-0.5"
                >
                    {distribution.map((count, index) =>
                        count > 0 ? (
                            <span
                                key={index}
                                title={segmentLabel(count, index)}
                                className={cn(
                                    'flex min-w-0 items-center justify-center rounded-xs text-overline text-skrum-roti-foreground',
                                    segmentClasses[levelOf(index + 1, scale)],
                                )}
                                style={{ flex: count }}
                            >
                                {count}
                            </span>
                        ) : null,
                    )}
                </div>
            ) : null}
        </li>
    );
}

function Stat({
    label,
    value,
    detail,
}: {
    label: string;
    value: string;
    detail?: string;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-semibold break-words">{value}</dd>
            {detail ? (
                <dd className="text-xs break-words text-muted-foreground">
                    {detail}
                </dd>
            ) : null}
        </div>
    );
}

export function HealthCheckResults({
    retroTitle,
    respondents,
    participants,
    previousRetroTitle,
    results,
    scale = healthCheckResultsScale,
    alertThreshold,
    minimumRespondents = 0,
    summary,
    children,
    className,
}: HealthCheckResultsProps) {
    const { t } = useTrans();
    const format = useFormatDecimal();
    const formatNumber = useFormatNumber();
    const headingId = useId();
    const threshold = alertThreshold ?? scale * 0.6;
    const revealed = respondents >= minimumRespondents;
    const hasTrend = results.some(
        (result) =>
            result.previousAverage !== undefined &&
            result.previousAverage !== null,
    );
    const hasDistribution = results.some(
        (result) => result.distribution !== undefined,
    );
    const outOf = (value: number): string => `${format(value)}/${scale}`;
    const subtitle = t(
        respondents === 1
            ? participants === 1
                ? ':respondents answer from :participants participant'
                : ':respondents answer from :participants participants'
            : participants === 1
              ? ':respondents answers from :participants participant'
              : ':respondents answers from :participants participants',
        { respondents, participants },
    );
    const stats =
        summary === undefined
            ? []
            : [
                  summary.score !== undefined ? (
                      <Stat
                          key="score"
                          label={t('Score')}
                          value={outOf(summary.score)}
                      />
                  ) : null,
                  summary.topStrength ? (
                      <Stat
                          key="strength"
                          label={t('Top strength')}
                          value={summary.topStrength.label}
                          detail={outOf(summary.topStrength.average)}
                      />
                  ) : null,
                  summary.growthArea ? (
                      <Stat
                          key="growth"
                          label={t('Growth area')}
                          value={summary.growthArea.label}
                          detail={outOf(summary.growthArea.average)}
                      />
                  ) : null,
                  summary.alignment ? (
                      <Stat
                          key="alignment"
                          label={t('Alignment')}
                          value={`${formatNumber(summary.alignment.value)}/${alignmentScale}`}
                          detail={summary.alignment.label}
                      />
                  ) : null,
              ].filter((stat) => stat !== null);

    return (
        <Card asChild data-slot="health-check-results" className={className}>
            <section aria-labelledby={headingId}>
                <CardHeader>
                    <h2
                        id={headingId}
                        className="text-base leading-snug font-title"
                    >
                        {t('Health check results · :retro', {
                            retro: retroTitle,
                        })}
                    </h2>
                    <CardDescription>
                        {hasTrend && previousRetroTitle && revealed
                            ? `${subtitle} · ${t('compared with :retro', { retro: previousRetroTitle })}`
                            : subtitle}
                    </CardDescription>
                </CardHeader>
                <div className="flex flex-col gap-4 px-5 py-4 @max-card-narrow/card:px-4">
                    {revealed ? (
                        <>
                            {stats.length > 0 ? (
                                <dl
                                    data-slot="health-summary"
                                    className="grid grid-cols-2 gap-4 text-sm @lg/card:grid-cols-4"
                                >
                                    {stats}
                                </dl>
                            ) : null}
                            {summary?.assessment ? (
                                <p
                                    data-slot="health-assessment"
                                    className="text-sm break-words"
                                >
                                    <strong>{summary.assessment.title}</strong>{' '}
                                    {summary.assessment.sentence}
                                </p>
                            ) : null}
                            {children}
                            {results.length === 0 ? (
                                <p
                                    data-slot="health-results-empty"
                                    className="rounded-md bg-muted px-3 py-3 text-body-sm text-muted-foreground"
                                >
                                    {t('No statements to show.')}
                                </p>
                            ) : (
                                <ul className="flex flex-col gap-1">
                                    {results.map((result) => (
                                        <ResultRow
                                            key={result.key}
                                            result={result}
                                            scale={scale}
                                            threshold={threshold}
                                            previousRetroTitle={
                                                previousRetroTitle
                                            }
                                        />
                                    ))}
                                </ul>
                            )}
                        </>
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
                {revealed && results.length > 0 ? (
                    <div
                        data-slot="health-legend"
                        className="flex flex-wrap gap-x-4 gap-y-2 border-t px-5 py-3 text-xs text-muted-foreground @max-card-narrow/card:px-4"
                    >
                        {hasDistribution
                            ? segmentClasses.map((swatch, level) => {
                                  const range = rangeOf(level, scale);

                                  if (range === '') {
                                      return null;
                                  }

                                  return (
                                      <span
                                          key={swatch}
                                          className="flex items-center gap-1.5"
                                      >
                                          <i
                                              aria-hidden
                                              className={cn(
                                                  'size-2.5 rounded-xs',
                                                  swatch,
                                              )}
                                          />
                                          {level === 0
                                              ? t(':score · Awful', {
                                                    score: range,
                                                })
                                              : level ===
                                                  segmentClasses.length - 1
                                                ? t(':score · Great', {
                                                      score: range,
                                                  })
                                                : range}
                                      </span>
                                  );
                              })
                            : null}
                        <span className="flex items-center gap-1.5">
                            <i
                                aria-hidden
                                className="h-3 w-0.5 bg-foreground/60"
                            />
                            {t('Alert threshold · :threshold/:scale', {
                                threshold: formatNumber(threshold),
                                scale,
                            })}
                        </span>
                    </div>
                ) : null}
            </section>
        </Card>
    );
}
