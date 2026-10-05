import { Link } from '@inertiajs/react';
import { useTrans } from '@/hooks/use-trans';
import type { HealthTrendPoint } from '@/lib/retro/types';
import { HealthMax } from './health-radar';

const Width = 220;
const Height = 56;
const Padding = 8;

function formatDelta(delta: number): string {
    return `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`;
}

export function HealthTrend({ points }: { points: HealthTrendPoint[] }) {
    const { t } = useTrans();
    const plotted = points.map((point, index) => ({
        point,
        x:
            points.length === 1
                ? Width / 2
                : Padding +
                  (index * (Width - 2 * Padding)) / (points.length - 1),
        y:
            Padding +
            ((HealthMax - point.score) / HealthMax) * (Height - 2 * Padding),
    }));
    const tooltip = (point: HealthTrendPoint): string => {
        const base = `${point.title}: ${point.score.toFixed(1)}/${HealthMax}`;

        return point.sameStatements
            ? base
            : `${base} — ${t('The statements changed since the previous retro')}`;
    };
    const latest = points[points.length - 1];

    return (
        <figure className="flex min-w-0 flex-col gap-1">
            <figcaption className="text-sm font-medium">
                {t('Trend across retros')}
            </figcaption>
            <svg
                viewBox={`0 0 ${Width} ${Height}`}
                role="group"
                aria-label={t('Trend across retros')}
                className="h-14 w-56 max-w-full overflow-visible"
            >
                <polyline
                    points={plotted.map(({ x, y }) => `${x},${y}`).join(' ')}
                    strokeWidth={2}
                    className="fill-none stroke-primary"
                />
                {plotted.map(({ point, x, y }) => (
                    <Link
                        key={point.surveyId}
                        href={point.url}
                        aria-label={tooltip(point)}
                    >
                        <circle
                            cx={x}
                            cy={y}
                            r={4}
                            strokeWidth={2}
                            className={
                                point.sameStatements
                                    ? 'fill-primary stroke-primary'
                                    : 'fill-background stroke-primary'
                            }
                        >
                            <title>{tooltip(point)}</title>
                        </circle>
                    </Link>
                ))}
            </svg>
            {latest !== undefined && latest.delta !== null && (
                <p className="text-xs text-muted-foreground">
                    {t(':delta since the previous retro', {
                        delta: formatDelta(latest.delta),
                    })}
                </p>
            )}
        </figure>
    );
}
