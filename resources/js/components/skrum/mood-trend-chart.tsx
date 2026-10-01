import {
    ChartLine,
    Minus,
    Table,
    TrendingDown,
    TrendingUp,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs } from '@/components/ui/tabs';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type MoodPoint = {
    sprint: string;
    mean: number;
    q1: number;
    q3: number;
    voters: number;
};

export type MoodRange = '4' | '8' | 'all';

export type MoodAnnotation = {
    sprint: string;
    title: string;
    detail?: string;
};

export type MoodTrendChartProps = {
    team: string;
    points: MoodPoint[];
    annotations?: MoodAnnotation[];
    threshold?: number;
    range?: MoodRange;
    onRangeChange?: (range: MoodRange) => void;
    height?: number;
    defaultActiveSprint?: string;
    defaultView?: 'chart' | 'table';
    className?: string;
};

const defaultWidth = 860;
const minWidth = 240;
const axisLeft = 48;
const axisRight = 12;
const edgeInset = 28;
const plotTop = 40;
const plotBottomGap = 30;
const minLabelGap = 44;
const minTrendPoints = 3;
const tooltipFlipRatio = 0.6;
const annotationCharacterWidth = 7.5;

const rotiFills = [
    'fill-skrum-roti-1',
    'fill-skrum-roti-2',
    'fill-skrum-roti-3',
    'fill-skrum-roti-4',
    'fill-skrum-roti-5',
];

const rotiLevels = [1, 2, 3, 4, 5];

function clampLevel(value: number): number {
    return Math.min(5, Math.max(1, value));
}

function clip(text: string, max: number): string {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function useFormat(): (value: number) => string {
    const locale =
        typeof document === 'undefined'
            ? undefined
            : document.documentElement.lang || undefined;

    return (value: number) =>
        new Intl.NumberFormat(locale, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
        }).format(value);
}

function useElementWidth() {
    const ref = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(defaultWidth);

    useEffect(() => {
        const element = ref.current;

        if (!element || typeof ResizeObserver === 'undefined') {
            return;
        }

        const observer = new ResizeObserver((entries) => {
            const measured = entries[0]?.contentRect.width ?? 0;

            if (measured > 0) {
                setWidth(Math.round(measured));
            }
        });

        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    return { ref, width: Math.max(width, minWidth) };
}

function visiblePoints(points: MoodPoint[], range: MoodRange): MoodPoint[] {
    if (range === 'all') {
        return points;
    }

    return points.slice(-Number(range));
}

export function MoodTrendChart({
    team,
    points,
    annotations = [],
    threshold = 3,
    range,
    onRangeChange,
    height = 290,
    defaultActiveSprint,
    defaultView = 'chart',
    className,
}: MoodTrendChartProps) {
    const { t } = useTrans();
    const format = useFormat();
    const titleId = useId();
    const descId = useId();
    const { ref: plotRef, width } = useElementWidth();

    const [localRange, setLocalRange] = useState<MoodRange>(range ?? '8');
    const [view, setView] = useState(defaultView);
    const effectiveRange = range ?? localRange;
    const shown = visiblePoints(points, effectiveRange);
    const count = shown.length;

    const [activeSprint, setActiveSprint] = useState<string | undefined>(
        defaultActiveSprint,
    );
    const foundIndex = shown.findIndex(
        (point) => point.sprint === activeSprint,
    );
    const activeIndex = foundIndex === -1 ? null : foundIndex;
    const activePoint = activeIndex === null ? undefined : shown[activeIndex];

    const previousCount = useRef(count);
    const justAdded = count > previousCount.current;

    useEffect(() => {
        previousCount.current = count;
    }, [count]);

    const changeRange = (next: MoodRange) => {
        setLocalRange(next);
        onRangeChange?.(next);
    };

    const hasTrend = count >= minTrendPoints;
    const first = shown[0];
    const last = shown[count - 1];
    const delta = first && last && count >= 2 ? last.mean - first.mean : null;
    const roundedDelta = delta === null ? 0 : Math.round(delta * 10) / 10;
    const voterCounts = shown.map((point) => point.voters);
    const minVoters = voterCounts.length > 0 ? Math.min(...voterCounts) : 0;
    const maxVoters = voterCounts.length > 0 ? Math.max(...voterCounts) : 0;

    const plotBottom = height - plotBottomGap;
    const plotLeft = axisLeft + edgeInset;
    const plotRight = width - axisRight - edgeInset;
    const step = count > 1 ? (plotRight - plotLeft) / (count - 1) : 0;
    const xOf = (index: number): number =>
        count > 1
            ? plotLeft + index * step
            : (axisLeft + width - axisRight) / 2;
    const yOf = (value: number): number =>
        plotTop + ((5 - clampLevel(value)) / 4) * (plotBottom - plotTop);
    const hitHalfWidth = count > 1 ? step / 2 : 40;
    const hitLeft = (index: number): number =>
        Math.max(axisLeft, xOf(index) - hitHalfWidth);
    const hitRight = (index: number): number =>
        Math.min(width - axisRight, xOf(index) + hitHalfWidth);

    const labelEvery = Math.max(1, Math.ceil(minLabelGap / Math.max(step, 1)));

    const subtitle =
        effectiveRange === 'all'
            ? t('All sprints')
            : t('Last :count sprints', { count: effectiveRange });
    const votersLabel =
        count === 0
            ? null
            : t('Voters per retro: :range', {
                  range:
                      minVoters === maxVoters
                          ? String(minVoters)
                          : `${minVoters}–${maxVoters}`,
              });

    const svgTitle =
        count > 0
            ? t('Average ROTI per sprint, :first to :last', {
                  first: first.sprint,
                  last: last.sprint,
              })
            : t('Average ROTI per sprint');
    const svgDescription = [
        ...shown.map(
            (point) =>
                `${point.sprint} ${format(point.mean)} (${format(point.q1)}–${format(point.q3)}, ${t(':count voters', { count: point.voters })})`,
        ),
        t('Band: spread of votes, from the first to the third quartile.'),
    ].join('; ');

    const announcement = activePoint
        ? t(':sprint: average :mean, spread :q1 to :q3, :count voters', {
              sprint: activePoint.sprint,
              mean: format(activePoint.mean),
              q1: format(activePoint.q1),
              q3: format(activePoint.q3),
              count: activePoint.voters,
          })
        : '';

    const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
        if (count === 0) {
            return;
        }

        const current = activeIndex ?? count - 1;
        let next: number | null = null;

        if (event.key === 'ArrowLeft') {
            next = Math.max(0, current - 1);
        }

        if (event.key === 'ArrowRight') {
            next = Math.min(count - 1, current + 1);
        }

        if (event.key === 'Home') {
            next = 0;
        }

        if (event.key === 'End') {
            next = count - 1;
        }

        if (event.key === 'Escape') {
            setActiveSprint(undefined);

            return;
        }

        if (next === null) {
            return;
        }

        event.preventDefault();
        setActiveSprint(shown[next].sprint);
    };

    const rangeItems = [
        { value: '4' as const, label: t('4 sprints') },
        { value: '8' as const, label: t('8 sprints') },
        { value: 'all' as const, label: t('All') },
    ];

    const linePath = shown
        .map(
            (point, index) =>
                `${index === 0 ? 'M' : 'L'}${xOf(index).toFixed(1)} ${yOf(point.mean).toFixed(1)}`,
        )
        .join(' ');
    const bandPath = [
        ...shown.map(
            (point, index) =>
                `${index === 0 ? 'M' : 'L'}${xOf(index).toFixed(1)} ${yOf(point.q3).toFixed(1)}`,
        ),
        ...shown
            .map(
                (point, index) =>
                    `L${xOf(index).toFixed(1)} ${yOf(point.q1).toFixed(1)}`,
            )
            .reverse(),
        'Z',
    ].join(' ');

    const placedAnnotations = annotations
        .map((annotation) => ({
            annotation,
            index: shown.findIndex(
                (point) => point.sprint === annotation.sprint,
            ),
        }))
        .filter((entry) => entry.index !== -1);

    const tooltipX = activeIndex === null ? 0 : xOf(activeIndex);
    const tooltipOnLeft = tooltipX > width * tooltipFlipRatio;

    return (
        <Card
            data-slot="mood-trend-chart"
            className={cn('@container/card gap-4 p-5', className)}
        >
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                <div className="flex min-w-0 flex-col gap-1">
                    <h3 className="font-display text-base font-semibold">
                        {t('Average ROTI per sprint · :team', { team })}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                        {subtitle}
                        {votersLabel ? ` · ${votersLabel}` : ''}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    {last && (
                        <div className="flex items-baseline gap-2">
                            <span
                                data-slot="mood-trend-kpi"
                                className="font-display text-display-lg"
                            >
                                {format(last.mean)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {last.sprint}
                            </span>
                        </div>
                    )}
                    {delta !== null && first && (
                        <Badge
                            data-slot="mood-trend-delta"
                            variant={
                                roundedDelta < 0 ? 'destructive' : 'success'
                            }
                            shape="pill"
                            className="whitespace-nowrap"
                        >
                            {roundedDelta > 0 && <TrendingUp aria-hidden />}
                            {roundedDelta < 0 && <TrendingDown aria-hidden />}
                            {roundedDelta === 0 && <Minus aria-hidden />}
                            {t(':delta since :sprint', {
                                delta: `${roundedDelta > 0 ? '+' : roundedDelta < 0 ? '−' : ''}${format(Math.abs(roundedDelta))}`,
                                sprint: first.sprint,
                            })}
                        </Badge>
                    )}
                    <Tabs
                        value={effectiveRange}
                        onValueChange={changeRange}
                        items={rangeItems}
                        aria-label={t('Period')}
                        className="w-auto"
                    />
                </div>
            </div>

            {view === 'chart' ? (
                <div ref={plotRef} className="relative w-full min-w-0">
                    <svg
                        role="img"
                        tabIndex={0}
                        aria-labelledby={`${titleId} ${descId}`}
                        viewBox={`0 0 ${width} ${height}`}
                        width={width}
                        height={height}
                        data-slot="mood-trend-svg"
                        className="block h-auto w-full overflow-visible rounded-md outline-none **:transition-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        onKeyDown={onKeyDown}
                        onFocus={() => {
                            if (activeIndex === null && count > 0) {
                                setActiveSprint(shown[count - 1].sprint);
                            }
                        }}
                        onMouseLeave={() => setActiveSprint(undefined)}
                    >
                        <title id={titleId}>{svgTitle}</title>
                        <desc id={descId}>{svgDescription}</desc>

                        {[1, 2, 4, 5].map((level) => (
                            <line
                                key={level}
                                x1={axisLeft}
                                x2={width - axisRight}
                                y1={yOf(level)}
                                y2={yOf(level)}
                                strokeWidth={1}
                                className="stroke-border"
                            />
                        ))}

                        {hasTrend && (
                            <g data-slot="mood-trend-threshold">
                                <line
                                    x1={axisLeft}
                                    x2={width - axisRight}
                                    y1={yOf(threshold)}
                                    y2={yOf(threshold)}
                                    strokeWidth={1}
                                    strokeDasharray="3 4"
                                    className="stroke-muted-foreground"
                                />
                                <text
                                    x={width - axisRight}
                                    y={yOf(threshold) - 6}
                                    textAnchor="end"
                                    className="fill-muted-foreground text-overline font-semibold"
                                >
                                    {t(':value · okay', { value: threshold })}
                                </text>
                            </g>
                        )}

                        {rotiLevels.map((level) => (
                            <g key={level} data-slot="mood-trend-level">
                                <circle
                                    cx={22}
                                    cy={yOf(level)}
                                    r={10}
                                    className={rotiFills[level - 1]}
                                />
                                <text
                                    x={22}
                                    y={yOf(level) + 4}
                                    textAnchor="middle"
                                    className="fill-skrum-roti-foreground font-display text-overline font-bold"
                                >
                                    {level}
                                </text>
                            </g>
                        ))}

                        {hasTrend && (
                            <path
                                d={bandPath}
                                data-slot="mood-trend-band"
                                className="fill-chart-1/16"
                            />
                        )}

                        {activeIndex !== null && (
                            <line
                                data-slot="mood-trend-crosshair"
                                x1={xOf(activeIndex)}
                                x2={xOf(activeIndex)}
                                y1={plotTop - 10}
                                y2={plotBottom + 2}
                                strokeWidth={1}
                                className="stroke-foreground opacity-35"
                            />
                        )}

                        {hasTrend && (
                            <path
                                d={linePath}
                                data-slot="mood-trend-line"
                                fill="none"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="stroke-chart-1"
                            />
                        )}

                        {shown.map((point, index) => {
                            const isLast = index === count - 1;
                            const isActive = index === activeIndex;

                            return (
                                <circle
                                    key={point.sprint}
                                    data-slot="mood-trend-point"
                                    cx={xOf(index)}
                                    cy={yOf(point.mean)}
                                    r={isActive ? 6 : isLast ? 5 : 4}
                                    strokeWidth={isLast ? 3 : 2}
                                    className={cn(
                                        'fill-chart-1 stroke-card',
                                        isLast &&
                                            justAdded &&
                                            'motion-safe:animate-in motion-safe:duration-200 motion-safe:fade-in',
                                    )}
                                />
                            );
                        })}

                        {placedAnnotations.map(({ annotation, index }) => {
                            const x = xOf(index);
                            const onLeft = x > width / 2;
                            const textX = onLeft ? x - 8 : x + 8;
                            const room = onLeft
                                ? textX - axisLeft
                                : width - axisRight - textX;
                            const roomInCharacters = Math.max(
                                4,
                                Math.floor(room / annotationCharacterWidth),
                            );

                            return (
                                <g
                                    key={annotation.sprint}
                                    data-slot="mood-trend-annotation"
                                >
                                    <line
                                        x1={x}
                                        x2={x}
                                        y1={yOf(shown[index].q1) + 8}
                                        y2={plotBottom - 4}
                                        strokeWidth={1}
                                        className="stroke-foreground"
                                    />
                                    <text
                                        x={textX}
                                        y={plotBottom - 18}
                                        textAnchor={onLeft ? 'end' : 'start'}
                                        className="fill-foreground text-xs font-semibold"
                                    >
                                        {clip(
                                            annotation.title,
                                            Math.min(40, roomInCharacters),
                                        )}
                                    </text>
                                    {annotation.detail && (
                                        <text
                                            x={textX}
                                            y={plotBottom - 3}
                                            textAnchor={
                                                onLeft ? 'end' : 'start'
                                            }
                                            className="fill-muted-foreground text-overline"
                                        >
                                            {clip(
                                                annotation.detail,
                                                Math.min(48, roomInCharacters),
                                            )}
                                        </text>
                                    )}
                                </g>
                            );
                        })}

                        {shown.map((point, index) => {
                            const isActive = index === activeIndex;
                            const showLabel =
                                isActive ||
                                (count - 1 - index) % labelEvery === 0;

                            if (!showLabel) {
                                return null;
                            }

                            return (
                                <text
                                    key={point.sprint}
                                    data-slot="mood-trend-x-label"
                                    x={xOf(index)}
                                    y={height - 6}
                                    textAnchor="middle"
                                    className={cn(
                                        'text-overline',
                                        isActive
                                            ? 'fill-foreground font-bold'
                                            : 'fill-muted-foreground',
                                    )}
                                >
                                    {point.sprint}
                                </text>
                            );
                        })}

                        {shown.map((point, index) => (
                            <rect
                                key={point.sprint}
                                data-slot="mood-trend-hit"
                                x={hitLeft(index)}
                                y={plotTop - 10}
                                width={hitRight(index) - hitLeft(index)}
                                height={plotBottom - plotTop + 12}
                                className="fill-transparent"
                                onMouseEnter={() =>
                                    setActiveSprint(point.sprint)
                                }
                            />
                        ))}
                    </svg>

                    {activePoint && (
                        <div
                            aria-hidden
                            data-slot="mood-trend-tooltip"
                            className="pointer-events-none absolute z-10 min-w-36 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-popover"
                            style={{
                                left: tooltipX,
                                top: yOf(activePoint.mean),
                                transform: `translate(${tooltipOnLeft ? 'calc(-100% - 0.75rem)' : '0.75rem'}, 0.5rem)`,
                            }}
                        >
                            <b className="text-body-sm">
                                {t('Sprint :sprint', {
                                    sprint: activePoint.sprint,
                                })}
                            </b>
                            <TooltipRow
                                label={t('Average ROTI')}
                                value={format(activePoint.mean)}
                            />
                            <TooltipRow
                                label={t('Spread')}
                                value={`${format(activePoint.q1)} – ${format(activePoint.q3)}`}
                            />
                            <TooltipRow
                                label={t('Voters')}
                                value={String(activePoint.voters)}
                            />
                        </div>
                    )}

                    <div
                        role="status"
                        aria-live="polite"
                        className="sr-only"
                        data-slot="mood-trend-live"
                    >
                        {announcement}
                    </div>

                    {count === 0 && (
                        <p
                            data-slot="mood-trend-empty"
                            className="absolute inset-x-12 top-1/2 -translate-y-1/2 text-center text-sm text-muted-foreground"
                        >
                            {t('No ROTI results yet.')}
                        </p>
                    )}
                    {count > 0 && !hasTrend && (
                        <p
                            data-slot="mood-trend-sparse"
                            className="absolute inset-x-12 top-3 text-center text-sm text-muted-foreground"
                        >
                            {t(
                                'Not enough data for a trend yet. It appears from 3 sprints.',
                            )}
                        </p>
                    )}
                </div>
            ) : (
                <div className="w-full min-w-0 overflow-x-auto">
                    <table
                        data-slot="mood-trend-table"
                        className="w-full text-sm"
                    >
                        <caption className="sr-only">{svgTitle}</caption>
                        <thead>
                            <tr className="border-b text-left text-xs text-muted-foreground">
                                <th
                                    scope="col"
                                    className="py-2 pr-4 font-semibold"
                                >
                                    {t('Sprint')}
                                </th>
                                <th
                                    scope="col"
                                    className="py-2 pr-4 font-semibold"
                                >
                                    {t('Average ROTI')}
                                </th>
                                <th
                                    scope="col"
                                    className="py-2 pr-4 font-semibold"
                                >
                                    {t('Spread')}
                                </th>
                                <th scope="col" className="py-2 font-semibold">
                                    {t('Voters')}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {shown.map((point) => (
                                <tr
                                    key={point.sprint}
                                    className="border-b last:border-0"
                                >
                                    <th
                                        scope="row"
                                        className="py-2 pr-4 text-left font-semibold"
                                    >
                                        {point.sprint}
                                    </th>
                                    <td className="py-2 pr-4 tabular-nums">
                                        {format(point.mean)}
                                    </td>
                                    <td className="py-2 pr-4 tabular-nums">
                                        {format(point.q1)} – {format(point.q3)}
                                    </td>
                                    <td className="py-2 tabular-nums">
                                        {point.voters}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {count === 0 && (
                        <p className="py-4 text-center text-sm text-muted-foreground">
                            {t('No ROTI results yet.')}
                        </p>
                    )}
                </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <li className="flex items-center gap-1.5">
                        <span
                            aria-hidden
                            className="inline-block h-0.5 w-3.5 rounded-full bg-chart-1"
                        />
                        {t('Average ROTI')}
                    </li>
                    <li className="flex items-center gap-1.5">
                        <span
                            aria-hidden
                            className="inline-block h-2.5 w-3.5 rounded-xs bg-chart-1/16"
                        />
                        {t('Spread (Q1–Q3)')}
                    </li>
                    <li className="flex items-center gap-1.5">
                        <span
                            aria-hidden
                            className="inline-block w-3.5 border-t border-dashed border-muted-foreground"
                        />
                        {t('“Okay” threshold')}
                    </li>
                </ul>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                        setView(view === 'chart' ? 'table' : 'chart')
                    }
                >
                    {view === 'chart' ? (
                        <Table aria-hidden />
                    ) : (
                        <ChartLine aria-hidden />
                    )}
                    <span className="truncate">
                        {view === 'chart'
                            ? t('View as table')
                            : t('View as chart')}
                    </span>
                </Button>
            </div>
        </Card>
    );
}

function TooltipRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between gap-3 text-muted-foreground">
            <span>{label}</span>
            <span className="font-semibold text-foreground tabular-nums">
                {value}
            </span>
        </div>
    );
}
