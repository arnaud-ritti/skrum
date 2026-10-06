import { Link, usePage } from '@inertiajs/react';
import { useId } from 'react';
import TeamEstimatesController from '@/actions/App/Http/Controllers/TeamEstimatesController';
import TeamGameRoomsController from '@/actions/App/Http/Controllers/TeamGameRoomsController';
import TeamHealthChecksController from '@/actions/App/Http/Controllers/TeamHealthChecksController';
import TeamInsightsController from '@/actions/App/Http/Controllers/TeamInsightsController';
import { RotiOutcome } from '@/components/skrum/roti-value';
import { useTrans } from '@/hooks/use-trans';
import { calendarDay } from '@/lib/teams/sprint';

export type InsightsTab = 'mood' | 'health' | 'estimates' | 'games';

/** The heading of Insights and its four tabs: each one is a page of its own. */
export function InsightsTabs({
    workspace,
    team,
    active,
}: {
    workspace: { slug: string };
    team: { id: string };
    active: InsightsTab;
}) {
    const { t } = useTrans();
    const params = { workspace: workspace.slug, team: team.id };
    const tabs: { key: InsightsTab; label: string; href: string }[] = [
        {
            key: 'mood',
            label: t('Mood & ROTI'),
            href: TeamInsightsController.show.url(params),
        },
        {
            key: 'health',
            label: t('Health check'),
            href: TeamHealthChecksController.show.url(params),
        },
        {
            key: 'estimates',
            label: t('Estimates'),
            href: TeamEstimatesController.index.url(params),
        },
        {
            key: 'games',
            label: t('Games'),
            href: TeamGameRoomsController.index.url(params),
        },
    ];

    return (
        <header
            data-slot="insights-tabs"
            className="mb-6 flex min-w-0 flex-col gap-3"
        >
            <h1 className="font-display text-2xl font-bold tracking-heading">
                {t('Insights')}
            </h1>
            <nav
                aria-label={t('Insights')}
                className="flex max-w-full min-w-0 gap-4 overflow-x-auto border-b"
            >
                {tabs.map((tab) => (
                    <Link
                        key={tab.key}
                        href={tab.href}
                        aria-current={tab.key === active ? 'page' : undefined}
                        className="inline-flex h-10 shrink-0 items-center px-0.5 text-body-sm font-semibold whitespace-nowrap text-muted-foreground transition-colors duration-140 ease-out outline-none hover:text-foreground hover:not-aria-[current=page]:shadow-[inset_0_-2px_0_var(--border)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset aria-[current=page]:text-foreground aria-[current=page]:shadow-[inset_0_-2px_0_var(--primary)] motion-reduce:transition-none"
                    >
                        {tab.label}
                    </Link>
                ))}
            </nav>
        </header>
    );
}

export type RetroRoti = {
    id: string;
    title: string;
    url: string;
    roti: number;
    /** The day the retro was completed, `Y-m-d`. */
    closedOn: string;
};

/** The ROTI of each completed retro, newest first, each one leading to its retro. */
export function RetroRotiList({ retros }: { retros: RetroRoti[] }) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const headingId = useId();
    const day = new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeZone: 'UTC',
    });

    return (
        <section
            data-slot="retro-roti-list"
            aria-labelledby={headingId}
            className="flex min-w-0 flex-col gap-3"
        >
            <h2 id={headingId} className="text-base font-title">
                {t('Average ROTI per retro')}
            </h2>
            {retros.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {t('No retro has a ROTI yet')}
                </p>
            ) : (
                <ul className="flex min-w-0 flex-col divide-y rounded-lg border bg-card">
                    {retros.map((retro) => (
                        <li
                            key={retro.id}
                            className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm"
                        >
                            <Link
                                href={retro.url}
                                className="min-w-32 flex-1 truncate rounded-sm font-semibold outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {retro.title}
                            </Link>
                            <time
                                dateTime={retro.closedOn}
                                className="shrink-0 text-muted-foreground"
                            >
                                {day.format(calendarDay(retro.closedOn))}
                            </time>
                            <span className="shrink-0 font-semibold">
                                <RotiOutcome value={retro.roti} />
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
