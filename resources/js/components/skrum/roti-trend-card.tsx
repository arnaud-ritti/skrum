import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { useId } from 'react';
import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
} from '@/components/ui/card';
import { useElementWidth } from '@/hooks/use-element-width';
import { useTrans } from '@/hooks/use-trans';
import { formatDecimal } from '@/lib/surveys/format';

export type RotiTrendPoint = {
    id: string;
    /** Short label under the x axis (a date). */
    label: string;
    /** Name of the retro, read on hover and by assistive technology. */
    title?: string;
    /** Average ROTI, 1 to 5. */
    mean: number;
};

export type RotiTrendCardProps = {
    /** Oldest first. */
    points: RotiTrendPoint[];
    /** Level of the heading in the page outline; defaults to 2. */
    headingLevel?: 2 | 3;
    className?: string;
};

const defaultWidth = 500;
const minWidth = 240;
const height = 178;
const plotLeft = 36;
const plotRight = 12;
const plotTop = 14;
const plotBottom = 150;
const axisLabelX = 26;
const xLabelY = 170;
const minLabelGap = 48;
const bubbleWidth = 52;
const bubbleHeight = 22;
const bubbleGap = 8;
const levels = [1, 2, 3, 4, 5];

function yOf(mean: number): number {
    const clamped = Math.min(5, Math.max(1, mean));

    return plotBottom - ((clamped - 1) * (plotBottom - plotTop)) / 4;
}

/**
 * The average ROTI of the last retros as one filled curve, with the last
 * value in a bubble (ScreenDashboard, "Mood trend").
 */
export function RotiTrendCard({
    points,
    headingLevel = 2,
    className,
}: RotiTrendCardProps) {
    const { t } = useTrans();
    const headingId = useId();
    const { ref, width } = useElementWidth(defaultWidth, minWidth);
    const HeadingTag = headingLevel === 2 ? 'h2' : 'h3';

    const first = points.at(0);
    const last = points.at(-1);
    const right = width - plotRight;
    const step =
        points.length > 1 ? (right - plotLeft) / (points.length - 1) : 0;
    const xOf = (index: number): number =>
        points.length > 1 ? plotLeft + index * step : right;
    const labelEvery =
        step > 0 ? Math.max(1, Math.ceil(minLabelGap / step)) : 1;
    const line = points
        .map((point, index) => `${xOf(index)},${yOf(point.mean)}`)
        .join(' ');
    const delta =
        first !== undefined && last !== undefined && points.length > 1
            ? Math.round((last.mean - first.mean) * 10) / 10
            : null;
    const signedDelta =
        delta === null
            ? ''
            : `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${formatDecimal(Math.abs(delta))}`;
    const lastX = xOf(points.length - 1);
    const lastY = last === undefined ? plotBottom : yOf(last.mean);
    const bubbleX = Math.min(
        Math.max(lastX - bubbleWidth + bubbleGap, 0),
        width - bubbleWidth,
    );
    const bubbleAbove = lastY - bubbleHeight - bubbleGap;
    const bubbleY = bubbleAbove >= 0 ? bubbleAbove : lastY + bubbleGap;

    return (
        <Card asChild data-slot="roti-trend" className={className}>
            <section aria-labelledby={headingId}>
                <CardHeader>
                    <HeadingTag
                        id={headingId}
                        className="text-base leading-snug font-title"
                    >
                        {t('Mood trend')}
                    </HeadingTag>
                    <CardDescription>
                        {t('Average ROTI at the end of the retro, out of 5')}
                    </CardDescription>
                    {delta !== null && first !== undefined && (
                        <CardAction>
                            <Badge
                                data-slot="roti-trend-delta"
                                variant={
                                    delta < 0
                                        ? 'destructive'
                                        : delta > 0
                                          ? 'success'
                                          : 'secondary'
                                }
                                shape="pill"
                                className="max-w-full min-w-0"
                            >
                                {delta > 0 && <TrendingUp aria-hidden />}
                                {delta < 0 && <TrendingDown aria-hidden />}
                                {delta === 0 && <Minus aria-hidden />}
                                <span className="truncate">
                                    {t(':delta since :sprint', {
                                        delta: signedDelta,
                                        sprint: first.label,
                                    })}
                                </span>
                            </Badge>
                        </CardAction>
                    )}
                </CardHeader>
                <CardContent className="pt-3 @max-card-narrow/card:pt-3">
                    <div ref={ref} className="min-w-0">
                        {first === undefined || last === undefined ? (
                            <p
                                data-slot="roti-trend-empty"
                                className="py-6 text-center text-sm text-muted-foreground"
                            >
                                {t('No ROTI results yet.')}
                            </p>
                        ) : (
                            <svg
                                data-slot="roti-trend-chart"
                                role="img"
                                aria-label={
                                    points.length === 1
                                        ? t('Average ROTI of :label: :value', {
                                              label: last.label,
                                              value: formatDecimal(last.mean),
                                          })
                                        : t(
                                              'Average ROTI per retro, from :first (:firstLabel) to :last (:lastLabel)',
                                              {
                                                  first: formatDecimal(
                                                      first.mean,
                                                  ),
                                                  firstLabel: first.label,
                                                  last: formatDecimal(
                                                      last.mean,
                                                  ),
                                                  lastLabel: last.label,
                                              },
                                          )
                                }
                                viewBox={`0 0 ${width} ${height}`}
                                width={width}
                                height={height}
                                className="block w-full"
                            >
                                {levels.map((level) => (
                                    <g key={level}>
                                        <line
                                            x1={plotLeft}
                                            x2={right}
                                            y1={yOf(level)}
                                            y2={yOf(level)}
                                            className="stroke-border"
                                            strokeWidth={1}
                                        />
                                        <text
                                            x={axisLabelX}
                                            y={yOf(level) + 4}
                                            textAnchor="end"
                                            className="fill-muted-foreground text-overline font-normal tracking-normal"
                                        >
                                            {level}
                                        </text>
                                    </g>
                                ))}
                                {points.length > 1 && (
                                    <>
                                        <path
                                            data-slot="roti-trend-area"
                                            d={`M${plotLeft},${plotBottom} L${line.replaceAll(' ', ' L')} L${right},${plotBottom} Z`}
                                            className="fill-chart-1/14"
                                        />
                                        <polyline
                                            data-slot="roti-trend-line"
                                            points={line}
                                            fill="none"
                                            className="stroke-chart-1"
                                            strokeWidth={2.5}
                                            strokeLinejoin="round"
                                            strokeLinecap="round"
                                        />
                                    </>
                                )}
                                {points.map((point, index) => (
                                    <circle
                                        key={point.id}
                                        data-slot="roti-trend-point"
                                        cx={xOf(index)}
                                        cy={yOf(point.mean)}
                                        r={
                                            index === points.length - 1
                                                ? 4.5
                                                : 3
                                        }
                                        className="fill-card stroke-chart-1"
                                        strokeWidth={2}
                                    >
                                        <title>
                                            {`${point.title ?? point.label} · ${formatDecimal(point.mean)} / 5`}
                                        </title>
                                    </circle>
                                ))}
                                {points.map(
                                    (point, index) =>
                                        (points.length - 1 - index) %
                                            labelEvery ===
                                            0 && (
                                            <text
                                                key={point.id}
                                                data-slot="roti-trend-label"
                                                x={xOf(index)}
                                                y={xLabelY}
                                                textAnchor={
                                                    index === 0 &&
                                                    points.length > 1
                                                        ? 'start'
                                                        : index ===
                                                            points.length - 1
                                                          ? 'end'
                                                          : 'middle'
                                                }
                                                className="fill-muted-foreground text-overline font-normal tracking-normal"
                                            >
                                                {point.label}
                                            </text>
                                        ),
                                )}
                                <g
                                    data-slot="roti-trend-bubble"
                                    transform={`translate(${bubbleX},${bubbleY})`}
                                >
                                    <rect
                                        width={bubbleWidth}
                                        height={bubbleHeight}
                                        rx={6}
                                        className="fill-foreground"
                                    />
                                    <text
                                        x={bubbleWidth / 2}
                                        y={15}
                                        textAnchor="middle"
                                        className="fill-background text-xs font-bold"
                                    >
                                        {`${formatDecimal(last.mean)} / 5`}
                                    </text>
                                </g>
                            </svg>
                        )}
                        {points.length > 0 && (
                            <ul
                                data-slot="roti-trend-values"
                                className="sr-only"
                            >
                                {points.map((point) => (
                                    <li key={point.id}>
                                        {`${point.title ?? point.label} · ${formatDecimal(point.mean)} / 5`}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </CardContent>
            </section>
        </Card>
    );
}
