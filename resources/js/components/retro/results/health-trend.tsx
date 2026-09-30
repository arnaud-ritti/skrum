import { useTrans } from '@/hooks/use-trans';
import type { HealthTrendPoint } from '@/lib/retro/types';
import { formatScore } from './health-radar';

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
        y: Padding + ((10 - point.score) / 10) * (Height - 2 * Padding),
    }));
    const latest = points[points.length - 1];

    return (
        <figure className="space-y-1">
            <figcaption className="text-sm font-medium">
                {t('Trend across retros')}
            </figcaption>
            <svg
                viewBox={`0 0 ${Width} ${Height}`}
                role="img"
                aria-label={t('Trend across retros')}
                className="h-14 w-56 overflow-visible"
            >
                <polyline
                    points={plotted.map(({ x, y }) => `${x},${y}`).join(' ')}
                    strokeWidth={2}
                    className="fill-none stroke-primary"
                />
                {plotted.map(({ point, x, y }) => (
                    <a key={point.retroId} href={point.url}>
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
                            <title>
                                {`${point.title}: ${formatScore(point.score)}/10`}
                                {point.sameStatements
                                    ? ''
                                    : ` — ${t('The statements changed since the previous retro')}`}
                            </title>
                        </circle>
                    </a>
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
