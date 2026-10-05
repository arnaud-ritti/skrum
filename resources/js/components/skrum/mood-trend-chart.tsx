import { Link } from '@inertiajs/react';
import type { InertiaLinkProps } from '@inertiajs/react';
import {
    ChartLine,
    Minus,
    Table,
    TrendingDown,
    TrendingUp,
} from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { FocusEvent, KeyboardEvent, ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs } from '@/components/ui/tabs';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type MoodPoint = {
    /** Unique key (a retro id); defaults to `sprint`. */
    id?: string;
    /** Label on the x axis: a sprint name or a retro title. */
    sprint: string;
    mean: number;
    /** Backlog: the server has no quartiles; no band without them. */
    q1?: number;
    q3?: number;
    /** Backlog: no voter count per point on the server. */
    voters?: number;
    /** The point and its table row link there (`HealthTrendPoint.url`). */
    href?: NonNullable<InertiaLinkProps['href']>;
    /** A remark on the point; its dot is drawn hollow. */
    note?: string;
    /** What the point is ("Retro", "Survey"); a column of the table when a point has one. */
    kind?: string;
};

export type MoodScale = { min: number; max: number };

export type MoodPeriod = 'sprint' | 'retro';

export type MoodRange = '4' | '8' | 'all';

export type MoodAnnotation = {
    sprint: string;
    title: string;
    detail?: string;
};

export type MoodTrendChartProps = {
    /** Used by the default ROTI title. */
    team?: string;
    points: MoodPoint[];
    /** Heading; defaults to the ROTI title. */
    title?: string;
    /** Level of the heading in the page outline; defaults to 3. */
    headingLevel?: 2 | 3;
    /** Controls of the host (a metric switch), before the period tabs. */
    controls?: ReactNode;
    /** Name of the plotted value; defaults to "Average ROTI". */
    metricLabel?: string;
    /** Defaults to the ROTI scale, 1 to 5, with its coloured levels. */
    scale?: MoodScale;
    /** What a point is: wording of the period tabs and the columns. */
    period?: MoodPeriod;
    /** Server-computed change of the last point; replaces the computed badge. */
    deltaSincePrevious?: number | null;
    /** Legend of the hollow dots (points with a `note`). */
    noteLegend?: string;
    emptyLabel?: string;
    annotations?: MoodAnnotation[];
    /** Defaults to 3 on the ROTI scale; no threshold on another scale. */
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
const maxLabelGap = 120;
const labelCharacterWidth = 6.5;
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

const rotiScale: MoodScale = { min: 1, max: 5 };

function ticksOf(scale: MoodScale): number[] {
    const span = scale.max - scale.min;
    const intervals = Number.isInteger(span / 5) ? 5 : 4;

    return Array.from(
        { length: intervals + 1 },
        (_, index) => scale.min + (index * span) / intervals,
    );
}

function keyOf(point: MoodPoint): string {
    return point.id ?? point.sprint;
}

function clip(text: string, max: number): string {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function useFormat(): (value: number) => string {
    const locale =
        typeof document === 'undefined'
            ? undefined
            : document.documentElement.lang || undefined;
    const formatter = useMemo(
        () =>
            new Intl.NumberFormat(locale, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
            }),
        [locale],
    );

    return (value: number) => formatter.format(value);
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
    title,
    headingLevel = 3,
    controls,
    metricLabel,
    scale,
    period = 'sprint',
    deltaSincePrevious,
    noteLegend,
    emptyLabel,
    annotations = [],
    threshold,
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
        (point) => keyOf(point) === activeSprint,
    );
    const activeIndex = foundIndex === -1 ? null : foundIndex;
    const activePoint = activeIndex === null ? undefined : shown[activeIndex];

    const newest = points.length > 0 ? keyOf(points[points.length - 1]) : null;
    const previous = useRef({ newest, total: points.length });
    const justAdded =
        points.length > previous.current.total &&
        newest !== previous.current.newest;

    useEffect(() => {
        previous.current = { newest, total: points.length };
    }, [newest, points.length]);

    const changeRange = (next: MoodRange) => {
        setLocalRange(next);
        onRangeChange?.(next);
    };

    const hasTrend = count >= minTrendPoints;
    const first = shown[0];
    const last = shown[count - 1];
    const isRoti = scale === undefined;
    const { min: scaleMin, max: scaleMax } = scale ?? rotiScale;
    const ticks = ticksOf({ min: scaleMin, max: scaleMax });
    const effectiveThreshold = threshold ?? (isRoti ? 3 : undefined);
    const clampLevel = (value: number): number =>
        Math.min(scaleMax, Math.max(scaleMin, value));
    const formatValue = (value: number): string =>
        isRoti ? format(value) : `${format(value)}/${scaleMax}`;
    const metric = metricLabel ?? t('Average ROTI');
    const isRetro = period === 'retro';

    const computedDelta =
        first && last && count >= 2 ? last.mean - first.mean : null;
    const delta =
        deltaSincePrevious === undefined ? computedDelta : deltaSincePrevious;
    const roundedDelta = delta === null ? 0 : Math.round(delta * 10) / 10;
    const signedDelta = `${roundedDelta > 0 ? '+' : roundedDelta < 0 ? '−' : ''}${format(Math.abs(roundedDelta))}`;
    const hasSpread =
        count > 0 &&
        shown.every(
            (point) => point.q1 !== undefined && point.q3 !== undefined,
        );
    const hasVoters =
        count > 0 && shown.every((point) => point.voters !== undefined);
    const hasNotes = shown.some((point) => point.note !== undefined);
    const hasKinds = shown.some((point) => point.kind !== undefined);
    const hasLinks = shown.some((point) => point.href !== undefined);
    const voterCounts = shown.map((point) => point.voters ?? 0);
    const minVoters = voterCounts.length > 0 ? Math.min(...voterCounts) : 0;
    const maxVoters = voterCounts.length > 0 ? Math.max(...voterCounts) : 0;
    const spreadOf = (point: MoodPoint): string =>
        `${format(point.q1 ?? point.mean)} – ${format(point.q3 ?? point.mean)}`;

    const plotBottom = height - plotBottomGap;
    const plotLeft = axisLeft + edgeInset;
    const plotRight = width - axisRight - edgeInset;
    const step = count > 1 ? (plotRight - plotLeft) / (count - 1) : 0;
    const xOf = (index: number): number =>
        count > 1
            ? plotLeft + index * step
            : (axisLeft + width - axisRight) / 2;
    const yOf = (value: number): number =>
        plotTop +
        ((scaleMax - clampLevel(value)) / (scaleMax - scaleMin || 1)) *
            (plotBottom - plotTop);
    const hitHalfWidth = count > 1 ? step / 2 : 40;
    const hitLeft = (index: number): number =>
        Math.max(axisLeft, xOf(index) - hitHalfWidth);
    const hitRight = (index: number): number =>
        Math.min(width - axisRight, xOf(index) + hitHalfWidth);

    const longestLabel = shown.reduce(
        (longest, point) => Math.max(longest, point.sprint.length),
        0,
    );
    const labelGap = Math.min(
        maxLabelGap,
        Math.max(minLabelGap, longestLabel * labelCharacterWidth + 12),
    );
    const labelEvery = Math.max(1, Math.ceil(labelGap / Math.max(step, 1)));
    const labelCharacters = Math.max(
        3,
        Math.floor((labelGap - 8) / labelCharacterWidth),
    );
    const isWideLabel = labelGap > 2 * (axisRight + edgeInset);
    const labelPinsRight = (index: number): boolean =>
        isWideLabel && count > 1 && index === count - 1;
    const labelSpan = (index: number, text: string): [number, number] => {
        const textWidth = text.length * labelCharacterWidth;

        if (labelPinsRight(index)) {
            return [width - axisRight - textWidth, width - axisRight];
        }

        return [xOf(index) - textWidth / 2, xOf(index) + textWidth / 2];
    };
    // The active label comes first, then the regular ticks from the right: a
    // label that would run into one already placed is left out.
    const placedLabelSpans: [number, number][] = [];
    const visibleLabelIndexes = new Set<number>();
    const labelCandidates = [
        ...(activeIndex === null ? [] : [activeIndex]),
        ...shown
            .map((_, index) => count - 1 - index)
            .filter((index) => (count - 1 - index) % labelEvery === 0),
    ];

    labelCandidates.forEach((index) => {
        if (visibleLabelIndexes.has(index) || shown[index] === undefined) {
            return;
        }

        const [left, right] = labelSpan(
            index,
            clip(shown[index].sprint, labelCharacters),
        );
        const collides = placedLabelSpans.some(
            ([placedLeft, placedRight]) =>
                left < placedRight + 4 && right > placedLeft - 4,
        );

        if (collides) {
            return;
        }

        placedLabelSpans.push([left, right]);
        visibleLabelIndexes.add(index);
    });

    const allLabel = isRetro ? t('All retros') : t('All sprints');
    const lastLabel = isRetro
        ? t('Last :count retros', { count: effectiveRange })
        : t('Last :count sprints', { count: effectiveRange });
    const subtitle = effectiveRange === 'all' ? allLabel : lastLabel;
    const periodLabel = isRetro ? t('Retro') : t('Sprint');
    const defaultTitle =
        team === undefined
            ? t('Average ROTI per sprint')
            : t('Average ROTI per sprint · :team', { team });
    const heading = title ?? defaultTitle;
    const HeadingTag = headingLevel === 2 ? 'h2' : 'h3';
    const empty =
        emptyLabel ??
        (title === undefined
            ? t('No ROTI results yet.')
            : t('No results yet.'));
    const pointTitle = (point: MoodPoint): string =>
        isRetro ? point.sprint : t('Sprint :sprint', { sprint: point.sprint });
    const votersLabel =
        count === 0 || !hasVoters
            ? null
            : t(
                  isRetro
                      ? 'Voters per retro: :range'
                      : 'Voters per sprint: :range',
                  {
                      range:
                          minVoters === maxVoters
                              ? String(minVoters)
                              : `${minVoters}–${maxVoters}`,
                  },
              );

    const chartName =
        title ??
        (isRetro ? t('Average ROTI per retro') : t('Average ROTI per sprint'));
    const svgTitle =
        count > 0
            ? t(':title, :first to :last', {
                  title: chartName,
                  first: first.sprint,
                  last: last.sprint,
              })
            : chartName;
    const describe = (point: MoodPoint): string => {
        const details: string[] = [];

        if (point.q1 !== undefined && point.q3 !== undefined) {
            details.push(`${format(point.q1)}–${format(point.q3)}`);
        }

        if (point.voters !== undefined) {
            details.push(t(':count voters', { count: point.voters }));
        }

        if (point.note !== undefined) {
            details.push(point.note);
        }

        const base = `${point.sprint} ${formatValue(point.mean)}`;

        return details.length > 0 ? `${base} (${details.join(', ')})` : base;
    };
    const leavePlot = (event: FocusEvent<Element>): void => {
        const next = event.relatedTarget;

        if (next instanceof Node && plotRef.current?.contains(next)) {
            return;
        }

        setActiveSprint(undefined);
    };
    const svgDescription = [
        t('Arrow keys, Home and End move from point to point.'),
        ...shown.map(describe),
        ...(hasSpread
            ? [
                  t(
                      'Band: spread of votes, from the first to the third quartile.',
                  ),
              ]
            : []),
    ].join('; ');

    const announce = (point: MoodPoint): string => {
        const parts = [
            t(':sprint: :metric :mean', {
                sprint: point.sprint,
                metric,
                mean: formatValue(point.mean),
            }),
        ];

        if (point.q1 !== undefined && point.q3 !== undefined) {
            parts.push(
                t('spread :q1 to :q3', {
                    q1: format(point.q1),
                    q3: format(point.q3),
                }),
            );
        }

        if (point.voters !== undefined) {
            parts.push(t(':count voters', { count: point.voters }));
        }

        if (point.note !== undefined) {
            parts.push(point.note);
        }

        return parts.join(', ');
    };
    const announcement = activePoint ? announce(activePoint) : '';

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
        setActiveSprint(keyOf(shown[next]));
    };

    const rangeItems = [
        {
            value: '4' as const,
            label: isRetro ? t('4 retros') : t('4 sprints'),
        },
        {
            value: '8' as const,
            label: isRetro ? t('8 retros') : t('8 sprints'),
        },
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
                `${index === 0 ? 'M' : 'L'}${xOf(index).toFixed(1)} ${yOf(point.q3 ?? point.mean).toFixed(1)}`,
        ),
        ...shown
            .map(
                (point, index) =>
                    `L${xOf(index).toFixed(1)} ${yOf(point.q1 ?? point.mean).toFixed(1)}`,
            )
            .reverse(),
        'Z',
    ].join(' ');

    const pointOf = (annotation: MoodAnnotation): number => {
        const byKey = shown.findIndex(
            (point) => keyOf(point) === annotation.sprint,
        );

        return byKey !== -1
            ? byKey
            : shown.findIndex((point) => point.sprint === annotation.sprint);
    };
    const placedAnnotations = annotations
        .map((annotation, position) => ({
            annotation,
            position,
            index: pointOf(annotation),
        }))
        .filter((entry) => entry.index !== -1);

    // The SVG scales with its box (viewBox), so what is laid over it is placed
    // in percent of the plot, not in the pixels of the drawing.
    const percentX = (x: number): string => `${(x / width) * 100}%`;
    const percentY = (y: number): string => `${(y / height) * 100}%`;

    const tooltipX = activeIndex === null ? 0 : xOf(activeIndex);
    const tooltipOnLeft = tooltipX > width * tooltipFlipRatio;

    return (
        <Card
            data-slot="mood-trend-chart"
            className={cn('@container/card gap-4 p-5', className)}
        >
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                <div className="flex min-w-0 flex-col gap-1">
                    <HeadingTag className="font-display text-base font-semibold break-words">
                        {heading}
                    </HeadingTag>
                    <p className="text-xs text-muted-foreground">
                        {subtitle}
                        {votersLabel ? ` · ${votersLabel}` : ''}
                    </p>
                </div>
                <div className="flex max-w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
                    {last && (
                        <div className="flex max-w-full min-w-0 items-baseline gap-2">
                            <span
                                data-slot="mood-trend-kpi"
                                className="font-display text-display-lg"
                            >
                                {formatValue(last.mean)}
                            </span>
                            <span className="max-w-48 min-w-0 truncate text-xs text-muted-foreground">
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
                            className="max-w-full min-w-0 whitespace-nowrap"
                        >
                            {roundedDelta > 0 && <TrendingUp aria-hidden />}
                            {roundedDelta < 0 && <TrendingDown aria-hidden />}
                            {roundedDelta === 0 && <Minus aria-hidden />}
                            <span className="max-w-48 truncate">
                                {deltaSincePrevious === undefined
                                    ? t(':delta since :sprint', {
                                          delta: signedDelta,
                                          sprint: first.sprint,
                                      })
                                    : t(
                                          isRetro
                                              ? ':delta since the previous retro'
                                              : ':delta since the previous sprint',
                                          { delta: signedDelta },
                                      )}
                            </span>
                        </Badge>
                    )}
                    {controls !== undefined && (
                        <div
                            data-slot="mood-trend-controls"
                            className="flex max-w-full min-w-0 items-center gap-2"
                        >
                            {controls}
                        </div>
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
                        role="group"
                        aria-roledescription={t('chart')}
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
                                setActiveSprint(keyOf(shown[count - 1]));
                            }
                        }}
                        onMouseLeave={() => setActiveSprint(undefined)}
                        onBlur={leavePlot}
                    >
                        <title id={titleId}>{svgTitle}</title>
                        <desc id={descId}>{svgDescription}</desc>

                        {ticks
                            .filter(
                                (level) =>
                                    !hasTrend || level !== effectiveThreshold,
                            )
                            .map((level) => (
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

                        {hasTrend && effectiveThreshold !== undefined && (
                            <g data-slot="mood-trend-threshold">
                                <line
                                    x1={axisLeft}
                                    x2={width - axisRight}
                                    y1={yOf(effectiveThreshold)}
                                    y2={yOf(effectiveThreshold)}
                                    strokeWidth={1}
                                    strokeDasharray="3 4"
                                    className="stroke-muted-foreground"
                                />
                                <text
                                    x={width - axisRight}
                                    y={yOf(effectiveThreshold) - 6}
                                    textAnchor="end"
                                    className="fill-muted-foreground text-overline font-semibold"
                                >
                                    {t(':value · okay', {
                                        value: effectiveThreshold,
                                    })}
                                </text>
                            </g>
                        )}

                        {ticks.map((level) => (
                            <g key={level} data-slot="mood-trend-level">
                                {isRoti && (
                                    <circle
                                        cx={22}
                                        cy={yOf(level)}
                                        r={10}
                                        className={rotiFills[level - 1]}
                                    />
                                )}
                                <text
                                    x={22}
                                    y={yOf(level) + 4}
                                    textAnchor="middle"
                                    className={
                                        isRoti
                                            ? 'fill-skrum-roti-foreground font-display text-overline font-bold'
                                            : 'fill-muted-foreground text-overline tabular-nums'
                                    }
                                >
                                    {Number.isInteger(level)
                                        ? level
                                        : format(level)}
                                </text>
                            </g>
                        ))}

                        {hasTrend && hasSpread && (
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
                                    key={keyOf(point)}
                                    data-slot="mood-trend-point"
                                    data-hollow={
                                        point.note !== undefined || undefined
                                    }
                                    cx={xOf(index)}
                                    cy={yOf(point.mean)}
                                    r={isActive ? 6 : isLast ? 5 : 4}
                                    strokeWidth={isLast ? 3 : 2}
                                    className={cn(
                                        point.note === undefined
                                            ? 'fill-chart-1 stroke-card'
                                            : 'fill-card stroke-chart-1',
                                        isLast &&
                                            justAdded &&
                                            'motion-safe:animate-in motion-safe:duration-220 motion-safe:fade-in',
                                    )}
                                />
                            );
                        })}

                        {placedAnnotations.map(
                            ({ annotation, position, index }) => {
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
                                        key={`${annotation.sprint}-${position}`}
                                        data-slot="mood-trend-annotation"
                                    >
                                        <line
                                            x1={x}
                                            x2={x}
                                            y1={
                                                yOf(
                                                    shown[index].q1 ??
                                                        shown[index].mean,
                                                ) + 8
                                            }
                                            y2={plotBottom - 4}
                                            strokeWidth={1}
                                            className="stroke-foreground"
                                        />
                                        <text
                                            x={textX}
                                            y={plotBottom - 18}
                                            textAnchor={
                                                onLeft ? 'end' : 'start'
                                            }
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
                                                    Math.min(
                                                        48,
                                                        roomInCharacters,
                                                    ),
                                                )}
                                            </text>
                                        )}
                                    </g>
                                );
                            },
                        )}

                        {shown.map((point, index) => {
                            const isActive = index === activeIndex;
                            if (!visibleLabelIndexes.has(index)) {
                                return null;
                            }

                            const pinsRight = labelPinsRight(index);

                            return (
                                <text
                                    key={keyOf(point)}
                                    data-slot="mood-trend-x-label"
                                    x={
                                        pinsRight
                                            ? width - axisRight
                                            : xOf(index)
                                    }
                                    y={height - 6}
                                    textAnchor={pinsRight ? 'end' : 'middle'}
                                    className={cn(
                                        'text-overline',
                                        isActive
                                            ? 'fill-foreground font-bold'
                                            : 'fill-muted-foreground',
                                    )}
                                >
                                    {clip(point.sprint, labelCharacters)}
                                </text>
                            );
                        })}

                        {shown.map((point, index) => (
                            <rect
                                key={keyOf(point)}
                                data-slot="mood-trend-hit"
                                x={hitLeft(index)}
                                y={plotTop - 10}
                                width={hitRight(index) - hitLeft(index)}
                                height={plotBottom - plotTop + 12}
                                className="fill-transparent"
                                onMouseEnter={() =>
                                    setActiveSprint(keyOf(point))
                                }
                            />
                        ))}
                    </svg>

                    {hasLinks &&
                        shown.map((point, index) =>
                            point.href === undefined ? null : (
                                <Link
                                    key={keyOf(point)}
                                    href={point.href}
                                    data-slot="mood-trend-link"
                                    aria-label={t('Open :title', {
                                        title: describe(point),
                                    })}
                                    className="absolute size-6 -translate-1/2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    style={{
                                        left: percentX(xOf(index)),
                                        top: percentY(yOf(point.mean)),
                                    }}
                                    onMouseEnter={() =>
                                        setActiveSprint(keyOf(point))
                                    }
                                    onFocus={() =>
                                        setActiveSprint(keyOf(point))
                                    }
                                    onBlur={leavePlot}
                                />
                            ),
                        )}

                    {activePoint && (
                        <div
                            aria-hidden
                            data-slot="mood-trend-tooltip"
                            className="pointer-events-none absolute z-10 max-w-64 min-w-36 rounded-md border bg-popover px-3 py-2 text-xs break-words text-popover-foreground shadow-popover"
                            style={{
                                left: percentX(tooltipX),
                                top: percentY(yOf(activePoint.mean)),
                                transform: `translate(${tooltipOnLeft ? 'calc(-100% - 0.75rem)' : '0.75rem'}, 0.5rem)`,
                            }}
                        >
                            <b className="text-body-sm">
                                {pointTitle(activePoint)}
                            </b>
                            <TooltipRow
                                label={metric}
                                value={formatValue(activePoint.mean)}
                            />
                            {activePoint.q1 !== undefined &&
                                activePoint.q3 !== undefined && (
                                    <TooltipRow
                                        label={t('Spread')}
                                        value={spreadOf(activePoint)}
                                    />
                                )}
                            {activePoint.voters !== undefined && (
                                <TooltipRow
                                    label={t('Voters')}
                                    value={String(activePoint.voters)}
                                />
                            )}
                            {activePoint.note !== undefined && (
                                <p className="mt-1 text-muted-foreground">
                                    {activePoint.note}
                                </p>
                            )}
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
                            {empty}
                        </p>
                    )}
                    {count > 0 && !hasTrend && (
                        <p
                            data-slot="mood-trend-sparse"
                            className="absolute inset-x-12 top-3 text-center text-sm text-muted-foreground"
                        >
                            {isRetro
                                ? t(
                                      'Not enough data for a trend yet. It appears from 3 retros.',
                                  )
                                : t(
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
                                    {periodLabel}
                                </th>
                                {hasKinds && (
                                    <th
                                        scope="col"
                                        className="py-2 pr-4 font-semibold"
                                    >
                                        {t('Kind')}
                                    </th>
                                )}
                                <th
                                    scope="col"
                                    className="py-2 pr-4 font-semibold"
                                >
                                    {metric}
                                </th>
                                {hasSpread && (
                                    <th
                                        scope="col"
                                        className="py-2 pr-4 font-semibold"
                                    >
                                        {t('Spread')}
                                    </th>
                                )}
                                {hasVoters && (
                                    <th
                                        scope="col"
                                        className="py-2 pr-4 font-semibold"
                                    >
                                        {t('Voters')}
                                    </th>
                                )}
                                {hasNotes && (
                                    <th
                                        scope="col"
                                        className="py-2 font-semibold"
                                    >
                                        {t('Note')}
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {shown.map((point) => (
                                <tr
                                    key={keyOf(point)}
                                    className="border-b last:border-0"
                                >
                                    <th
                                        scope="row"
                                        className="py-2 pr-4 text-left font-semibold break-words"
                                    >
                                        {point.href === undefined ? (
                                            point.sprint
                                        ) : (
                                            <Link
                                                href={point.href}
                                                className="rounded-sm text-skrum-primary-text underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                                            >
                                                {point.sprint}
                                            </Link>
                                        )}
                                    </th>
                                    {hasKinds && (
                                        <td className="py-2 pr-4">
                                            {point.kind}
                                        </td>
                                    )}
                                    <td className="py-2 pr-4 tabular-nums">
                                        {formatValue(point.mean)}
                                    </td>
                                    {hasSpread && (
                                        <td className="py-2 pr-4 tabular-nums">
                                            {spreadOf(point)}
                                        </td>
                                    )}
                                    {hasVoters && (
                                        <td className="py-2 pr-4 tabular-nums">
                                            {point.voters}
                                        </td>
                                    )}
                                    {hasNotes && (
                                        <td className="py-2 break-words text-muted-foreground">
                                            {point.note}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {count === 0 && (
                        <p className="py-4 text-center text-sm text-muted-foreground">
                            {empty}
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
                        {metric}
                    </li>
                    {hasSpread && (
                        <li className="flex items-center gap-1.5">
                            <span
                                aria-hidden
                                className="inline-block h-2.5 w-3.5 rounded-xs bg-chart-1/16"
                            />
                            {t('Spread (Q1–Q3)')}
                        </li>
                    )}
                    {hasTrend && effectiveThreshold !== undefined && (
                        <li className="flex items-center gap-1.5">
                            <span
                                aria-hidden
                                className="inline-block w-3.5 border-t border-dashed border-muted-foreground"
                            />
                            {t('“Okay” threshold')}
                        </li>
                    )}
                    {hasNotes && noteLegend !== undefined && (
                        <li className="flex items-center gap-1.5">
                            <span
                                aria-hidden
                                className="inline-block size-2.5 rounded-full border-2 border-chart-1 bg-card"
                            />
                            {noteLegend}
                        </li>
                    )}
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
