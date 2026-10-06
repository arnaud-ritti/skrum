import { Link, usePage } from '@inertiajs/react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { RotiValue } from '@/components/skrum/roti-value';
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
    /** The last health check that has a score and its move since the one before; null when there is none, `undefined` until it is received. */
    health?: { score: number; change: number | null } | null;
    /** Insights › Mood & ROTI of the team. */
    insightsHref: string;
    /** Insights › Health check of the team. */
    healthHref: string;
};

function signed(change: number): string {
    return `${change > 0 ? '+' : change < 0 ? '−' : ''}${formatDecimal(Math.abs(change))}`;
}

/**
 * One figure of the card, a link to its Insights tab: the label, the value in
 * the large type, its change as a chip. Side by side where the card is wide
 * enough for three, otherwise one per line with the label and the value on a row.
 */
function PulseFigure({
    slot,
    changeSlot,
    label,
    href,
    value,
    unit,
    change,
    changeLabel,
    empty,
}: {
    slot: string;
    changeSlot: string;
    label: string;
    href: string;
    /** Absent when the figure has no data: `empty` takes its place. */
    value?: ReactNode;
    unit?: string;
    change?: number | null;
    changeLabel?: string;
    empty: string;
}) {
    return (
        <Link
            href={href}
            data-slot="pulse-figure"
            className="group flex min-w-0 flex-col items-start gap-1.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
        >
            <span
                data-slot={slot}
                className="flex w-full min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 @md/card:flex-col @md/card:items-start @md/card:justify-start"
            >
                <span className="text-xs text-muted-foreground group-hover:underline">
                    {label}
                </span>
                {value === undefined ? (
                    <span className="text-sm text-muted-foreground">
                        {empty}
                    </span>
                ) : (
                    <span className="whitespace-nowrap">
                        <span className="font-display text-3xl font-bold tabular-nums">
                            {value}
                        </span>
                        {unit !== undefined && (
                            <span className="text-sm text-muted-foreground">
                                {unit}
                            </span>
                        )}
                    </span>
                )}
            </span>
            {change != null && changeLabel !== undefined && (
                <Badge
                    data-slot={changeSlot}
                    variant={
                        change < 0
                            ? 'destructive'
                            : change > 0
                              ? 'success'
                              : 'secondary'
                    }
                    className="h-auto max-w-full shrink items-start py-0.5 text-left whitespace-normal [&>svg]:mt-0.5 [&>svg]:shrink-0"
                >
                    {change > 0 && <TrendingUp aria-hidden />}
                    {change < 0 && <TrendingDown aria-hidden />}
                    {change === 0 && <Minus aria-hidden />}
                    <span className="min-w-0">{changeLabel}</span>
                </Badge>
            )}
        </Link>
    );
}

/** Where the team stands: its last ROTI and its last health score, each with how it moved. */
export function TeamPulseCard({
    trend,
    failed = false,
    onRetry,
    health,
    insightsHref,
    healthHref,
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
    const outOfFive = ` ${t('/ 5')}`;

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
                <CardContent className="grid gap-4 @md/card:grid-cols-3">
                    <PulseFigure
                        slot="team-pulse-roti"
                        changeSlot="team-pulse-delta"
                        label={t('Average ROTI')}
                        href={insightsHref}
                        value={
                            last === undefined ? undefined : (
                                <RotiValue
                                    value={last.mean}
                                    className="rounded-md px-2 font-bold"
                                />
                            )
                        }
                        unit={outOfFive}
                        change={delta}
                        changeLabel={
                            delta === null
                                ? undefined
                                : t(':delta since the previous retro', {
                                      delta: signed(delta),
                                  })
                        }
                        empty={t('No retro yet')}
                    />
                    {health !== undefined && (
                        <PulseFigure
                            slot="team-pulse-health"
                            changeSlot="team-pulse-health-change"
                            label={t('Health check')}
                            href={healthHref}
                            value={
                                health === null
                                    ? undefined
                                    : formatDecimal(health.score)
                            }
                            unit={outOfFive}
                            change={health?.change}
                            changeLabel={
                                health?.change == null
                                    ? undefined
                                    : t(':delta since the previous one', {
                                          delta: signed(health.change),
                                      })
                            }
                            empty={t('Not run yet')}
                        />
                    )}
                </CardContent>
            </section>
        </Card>
    );
}
