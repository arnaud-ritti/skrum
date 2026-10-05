import { Link, usePage } from '@inertiajs/react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { useId } from 'react';
import { TrendError, TrendSkeleton } from '@/components/teams/trend-states';
import type { TrendState } from '@/components/teams/trend-states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardAction,
    CardContent,
    CardHeader,
} from '@/components/ui/card';
import { useTrans } from '@/hooks/use-trans';
import { formatDecimal } from '@/lib/surveys/format';
import { deltaSincePrevious, toRotiPoints } from '@/lib/teams/mood-adapter';

type Props = TrendState & {
    /** The score of the last health check; null when none has results, `undefined` until it is received. */
    healthScore?: number | null;
    /** The Insights page of the team. */
    insightsHref: string;
};

/** Where the team stands: the ROTI of its last retro, how it moved, and its last health score. */
export function TeamPulseCard({
    trend,
    failed = false,
    onRetry,
    healthScore,
    insightsHref,
}: Props) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const headingId = useId();

    if (failed) {
        return <TrendError title={t('Team pulse')} onRetry={onRetry} />;
    }

    if (trend === undefined) {
        return <TrendSkeleton />;
    }

    const points = toRotiPoints(trend, locale);
    const last = points.at(-1);
    const delta = deltaSincePrevious(points);

    return (
        <Card asChild>
            <section
                id="team-pulse"
                data-slot="team-pulse"
                aria-labelledby={headingId}
                className="scroll-mt-20"
            >
                <CardHeader>
                    <h2
                        id={headingId}
                        className="text-base leading-snug font-title"
                    >
                        {t('Team pulse')}
                    </h2>
                    <CardAction>
                        <Button
                            variant="link"
                            size="sm"
                            className="px-0"
                            asChild
                        >
                            <Link href={insightsHref}>{t('Insights')}</Link>
                        </Button>
                    </CardAction>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                    {last === undefined ? (
                        <p className="text-sm text-muted-foreground">
                            {t('No ROTI results yet.')}
                        </p>
                    ) : (
                        <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
                            <p
                                data-slot="team-pulse-roti"
                                className="flex flex-col"
                            >
                                <span className="text-xs text-muted-foreground">
                                    {t('Average ROTI')}
                                </span>
                                <span>
                                    <span className="font-display text-3xl font-bold tabular-nums">
                                        {formatDecimal(last.mean)}
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                        {' / 5'}
                                    </span>
                                </span>
                            </p>
                            {delta !== null && (
                                <Badge
                                    data-slot="team-pulse-delta"
                                    variant={
                                        delta < 0
                                            ? 'destructive'
                                            : delta > 0
                                              ? 'success'
                                              : 'secondary'
                                    }
                                    shape="pill"
                                    className="mb-1 max-w-full min-w-0"
                                >
                                    {delta > 0 && <TrendingUp aria-hidden />}
                                    {delta < 0 && <TrendingDown aria-hidden />}
                                    {delta === 0 && <Minus aria-hidden />}
                                    <span className="truncate">
                                        {t(':delta since the previous retro', {
                                            delta: `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${formatDecimal(Math.abs(delta))}`,
                                        })}
                                    </span>
                                </Badge>
                            )}
                        </div>
                    )}
                    {healthScore !== undefined && (
                        <p
                            data-slot="team-pulse-health"
                            className="text-sm text-muted-foreground"
                        >
                            {healthScore === null
                                ? t('Health check: not run yet')
                                : t('Health check: :score / 5', {
                                      score: formatDecimal(healthScore),
                                  })}
                        </p>
                    )}
                </CardContent>
            </section>
        </Card>
    );
}
