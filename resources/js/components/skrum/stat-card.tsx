import { ArrowDown, ArrowUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export type StatCardTrend = {
    direction: 'up' | 'down';
    label: string;
    good: boolean;
};

export type StatCardProps = {
    label: string;
    value: string;
    trend?: StatCardTrend;
    series?: number[];
    context: string;
    icon?: LucideIcon;
    className?: string;
};

const sparkWidth = 100;
const sparkHeight = 24;

function sparklinePoints(series: number[]): string {
    const min = Math.min(...series);
    const range = Math.max(...series) - min;
    const step = sparkWidth / (series.length - 1);

    return series
        .map((value, index) => {
            const ratio = range === 0 ? 0.5 : (value - min) / range;
            const y = sparkHeight - 2 - ratio * (sparkHeight - 4);

            return `${(index * step).toFixed(2)},${y.toFixed(2)}`;
        })
        .join(' ');
}

export function StatCard({
    label,
    value,
    trend,
    series,
    context,
    icon: Icon,
    className,
}: StatCardProps) {
    const { t } = useTrans();
    const TrendIcon = trend?.direction === 'down' ? ArrowDown : ArrowUp;
    const hasSparkline = series !== undefined && series.length >= 2;

    return (
        <Card
            data-slot="stat-card"
            className={cn('gap-2 p-5 @max-card-narrow/card:p-4', className)}
        >
            <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-semibold text-muted-foreground">
                    {label}
                </span>
                {Icon && (
                    <Icon
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                    />
                )}
            </div>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-display text-stat font-bold tracking-tight">
                    {value}
                </span>
                {trend && (
                    <span
                        data-slot="stat-card-trend"
                        data-good={trend.good}
                        className={cn(
                            'inline-flex items-center gap-0.5 text-xs font-bold whitespace-nowrap',
                            trend.good
                                ? 'text-skrum-success-text'
                                : 'text-skrum-destructive-text',
                        )}
                    >
                        <TrendIcon className="size-3.5" aria-hidden />
                        <span className="sr-only">
                            {trend.direction === 'up' ? t('Up') : t('Down')}
                        </span>
                        {trend.label}
                    </span>
                )}
            </div>
            {hasSparkline && (
                <svg
                    aria-hidden
                    data-slot="stat-card-sparkline"
                    viewBox={`0 0 ${sparkWidth} ${sparkHeight}`}
                    preserveAspectRatio="none"
                    className="h-6 w-full overflow-visible"
                >
                    <polyline
                        points={sparklinePoints(series)}
                        fill="none"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                        className="stroke-chart-1"
                    />
                </svg>
            )}
            <p className="truncate text-xs text-muted-foreground">{context}</p>
        </Card>
    );
}
