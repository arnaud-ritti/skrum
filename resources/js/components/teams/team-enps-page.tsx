import { Link, usePage } from '@inertiajs/react';
import { Gauge } from 'lucide-react';
import { useId } from 'react';
import { EmptyState } from '@/components/skrum/empty-state';
import { NpsSegments } from '@/components/skrum/survey-question';
import { PulseChange } from '@/components/teams/team-pulse-card';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useTrans } from '@/hooks/use-trans';
import { signed } from '@/lib/surveys/compare';
import { calendarDay } from '@/lib/teams/sprint';

export type EnpsPoint = {
    id: string;
    title: string;
    /** The results of the survey. */
    url: string;
    /** The day the survey closed, `Y-m-d`. */
    closedOn: string;
    /** The answers to the team question. */
    answers: number;
    score: number;
    /** The score minus the score of the survey before; null for the first. */
    change: number | null;
    promoters: number;
    passives: number;
    detractors: number;
};

export type TeamEnpsPageProps = {
    /** The closed eNPS surveys that count, newest first; `latest` is the first of them. */
    enps: { latest: EnpsPoint | null; history: EnpsPoint[] };
    /** Whether the viewer may create a survey in the team. */
    canStart: boolean;
    /** Home, with the "New session" dialog on the survey form and the eNPS template. */
    startUrl: string;
};

/** The eNPS tab of Insights: the team's last score with its split, then every closed survey. */
export function TeamEnpsPage({ enps, canStart, startUrl }: TeamEnpsPageProps) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const latestId = useId();
    const historyId = useId();
    const { latest, history } = enps;
    const day = new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeZone: 'UTC',
    });
    const answersOf = (point: EnpsPoint): string =>
        point.answers === 1
            ? t('1 answer')
            : t(':count answers', { count: point.answers });

    if (latest === null) {
        return (
            <EmptyState
                module="survey"
                title={t('No eNPS survey has closed yet.')}
                description={t(
                    'The score of the team shows up here once a survey has closed.',
                )}
                action={
                    canStart
                        ? {
                              label: t('Start an eNPS survey'),
                              icon: Gauge,
                              href: startUrl,
                          }
                        : undefined
                }
            />
        );
    }

    return (
        <div data-slot="team-enps" className="flex min-w-0 flex-col gap-8">
            <Card asChild>
                <section aria-labelledby={latestId}>
                    <CardContent className="flex min-w-0 flex-col gap-4">
                        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
                            <h2
                                id={latestId}
                                className="text-base leading-snug font-title"
                            >
                                {t('Latest eNPS')}
                            </h2>
                            {canStart && (
                                <Button className="max-w-full" asChild>
                                    <Link href={startUrl}>
                                        <Gauge aria-hidden />
                                        <span className="truncate">
                                            {t('Start an eNPS survey')}
                                        </span>
                                    </Link>
                                </Button>
                            )}
                        </div>
                        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
                            <span
                                data-slot="enps-score"
                                className="font-display text-3xl font-bold tabular-nums"
                            >
                                {signed(latest.score)}
                            </span>
                            {latest.change !== null && (
                                <PulseChange
                                    slot="enps-change"
                                    change={latest.change}
                                    label={t(':delta since the last one', {
                                        delta: signed(latest.change) ?? '',
                                    })}
                                />
                            )}
                        </div>
                        <p
                            data-slot="enps-latest-survey"
                            className="text-sm wrap-anywhere text-muted-foreground"
                        >
                            <Link
                                href={latest.url}
                                className="rounded-sm font-semibold text-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {latest.title}
                            </Link>
                            {' · '}
                            <time dateTime={latest.closedOn}>
                                {day.format(calendarDay(latest.closedOn))}
                            </time>
                            {' · '}
                            {answersOf(latest)}
                        </p>
                        <NpsSegments segments={latest} />
                    </CardContent>
                </section>
            </Card>
            <section
                aria-labelledby={historyId}
                className="flex min-w-0 flex-col gap-3"
            >
                <h2 id={historyId} className="text-base font-title">
                    {t('History')}
                </h2>
                <ul className="flex min-w-0 flex-col divide-y rounded-lg border bg-card">
                    {history.map((point) => (
                        <li key={point.id} className="min-w-0">
                            <Link
                                href={point.url}
                                data-slot="enps-line"
                                className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm outline-none first:rounded-t-lg last:rounded-b-lg hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                            >
                                <span
                                    data-slot="enps-line-title"
                                    className="min-w-32 flex-1 truncate font-semibold"
                                >
                                    {point.title}
                                </span>
                                <time
                                    data-slot="enps-line-day"
                                    dateTime={point.closedOn}
                                    className="shrink-0 text-muted-foreground"
                                >
                                    {day.format(calendarDay(point.closedOn))}
                                </time>
                                <span
                                    data-slot="enps-line-answers"
                                    className="shrink-0 text-muted-foreground"
                                >
                                    {answersOf(point)}
                                </span>
                                <span
                                    data-slot="enps-line-score"
                                    className="w-10 shrink-0 text-right font-semibold tabular-nums"
                                >
                                    {signed(point.score)}
                                </span>
                                <NpsSegments
                                    segments={point}
                                    size="small"
                                    className="w-24 shrink-0"
                                />
                            </Link>
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}
