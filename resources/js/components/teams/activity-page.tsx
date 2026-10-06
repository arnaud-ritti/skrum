import { Link, router, usePage } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import { DatePicker } from '@/components/skrum/date-picker';
import type { DatePickerLocale } from '@/components/skrum/date-picker';
import { EmptyState } from '@/components/skrum/empty-state';
import { ActivityLineRow } from '@/components/teams/team-activity-card';
import { PersonAvatar } from '@/components/ui/avatar';
import { LoadMore, LoadMoreFeed } from '@/components/ui/pagination';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import { localToday } from '@/lib/action-items/due';
import {
    ActivityGroups,
    activityHref,
    activityQuery,
} from '@/lib/teams/activity';
import type { ActivityFilters, ActivityGroup } from '@/lib/teams/activity';
import { dayBefore, groupByDay } from '@/lib/teams/activity-days';
import { cn } from '@/lib/utils';
import type { TeamActivityLine, TeamSummary, WorkspaceSummary } from '@/types';

export type ActivityPageProps = {
    workspace: WorkspaceSummary;
    team: TeamSummary;
    /** The lines under the filters, newest first, page after page. */
    lines: TeamActivityLine[];
    /** How many lines the filters keep. */
    total: number;
    nextCursor: string | null;
    filters: ActivityFilters;
    /** The members of the team and whoever else acted in it, by name: the person filter. */
    members: { id: string; name: string; avatarUrl: string | null }[];
    /** Today in the application's time zone, `Y-m-d`. */
    today: string;
};

type Translate = ReturnType<typeof useTrans>['t'];

const Anyone = 'anyone';

const PickerLocales: DatePickerLocale[] = ['fr', 'en', 'es', 'de'];

/** A `Y-m-d` day as the date of the viewer's calendar the date picker shows. */
function pickerDay(day: string): Date {
    const [year, month, date] = day.split('-').map(Number);

    return new Date(year, month - 1, date);
}

function groupLabel(group: ActivityGroup | null, t: Translate): string {
    switch (group) {
        case null:
            return t('All');
        case 'sessions':
            return t('Sessions');
        case 'actions':
            return t('Actions');
        case 'members':
            return t('Members');
    }
}

type Feed = {
    /** The `lines` prop the feed last saw. */
    source: TeamActivityLine[];
    loadingMore: boolean;
    /** The first line a "Load more" added: it takes the focus. */
    focusId: string | null;
};

/**
 * The state of "Load more". The server merges each page it brings into the
 * `lines` prop, so the page in the history keeps every loaded line.
 */
function useActivityFeed(
    lines: TeamActivityLine[],
    filters: ActivityFilters,
    nextCursor: string | null,
) {
    const [feed, setFeed] = useState<Feed>({
        source: lines,
        loadingMore: false,
        focusId: null,
    });

    if (feed.source !== lines) {
        const added = feed.loadingMore ? lines[feed.source.length] : undefined;

        setFeed({
            source: lines,
            loadingMore: false,
            focusId: added?.id ?? null,
        });
    }

    const loadMore = (): void => {
        if (nextCursor === null) {
            return;
        }

        setFeed((current) => ({ ...current, loadingMore: true }));
        router.reload({
            only: ['lines', 'nextCursor'],
            data: { ...activityQuery(filters), before: nextCursor },
            preserveUrl: true,
            onFinish: () =>
                setFeed((current) =>
                    current.loadingMore
                        ? { ...current, loadingMore: false }
                        : current,
                ),
        });
    };

    return { ...feed, loadMore };
}

function ActivityFeed({
    lines,
    total,
    nextCursor,
    filters,
    today,
}: Pick<
    ActivityPageProps,
    'lines' | 'total' | 'nextCursor' | 'filters' | 'today'
>) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const feed = useActivityFeed(lines, filters, nextCursor);
    const list = useRef<HTMLDivElement>(null);
    const dayId = useId();
    const positions = new Map(lines.map((line, index) => [line.id, index + 1]));
    const timeOfDay = new Intl.DateTimeFormat(locale, {
        hour: 'numeric',
        minute: '2-digit',
    });

    useEffect(() => {
        if (feed.focusId === null) {
            return;
        }

        Array.from(
            list.current?.querySelectorAll<HTMLElement>('[data-line-id]') ?? [],
        )
            .find((row) => row.dataset.lineId === feed.focusId)
            ?.focus();
    }, [feed.focusId]);

    return (
        <div className="flex min-w-0 flex-col gap-2">
            <LoadMoreFeed
                ref={list}
                loading={feed.loadingMore}
                aria-label={t('Activity')}
                className="flex min-w-0 flex-col gap-6"
            >
                {groupByDay(lines, today, locale, t).map((group) => (
                    <section
                        key={group.day}
                        aria-labelledby={`${dayId}-${group.day}`}
                        className="flex min-w-0 flex-col gap-3"
                    >
                        <h2
                            id={`${dayId}-${group.day}`}
                            className="text-overline text-muted-foreground uppercase"
                        >
                            {group.label}
                        </h2>
                        {group.lines.map((line) => (
                            <article
                                key={line.id}
                                data-test="activity-line"
                                data-line-id={line.id}
                                tabIndex={-1}
                                aria-posinset={positions.get(line.id)}
                                aria-setsize={total}
                                className="min-w-0 rounded-sm outline-ring focus-visible:outline-2 focus-visible:outline-offset-2"
                            >
                                <ActivityLineRow
                                    line={line}
                                    time={timeOfDay.format(new Date(line.at))}
                                    inline
                                />
                            </article>
                        ))}
                    </section>
                ))}
            </LoadMoreFeed>
            <LoadMore
                remaining={nextCursor === null ? 0 : total - lines.length}
                loading={feed.loadingMore}
                onLoadMore={feed.loadMore}
                total={total}
                endLabel={
                    total === 1
                        ? t("You're all caught up · 1 event")
                        : t("You're all caught up · :count events", {
                              count: total,
                          })
                }
            />
        </div>
    );
}

/** Everything that happened in a team, by day, under the filters of the address. */
export function ActivityPage({
    workspace,
    team,
    lines,
    total,
    nextCursor,
    filters,
    members,
    today,
}: ActivityPageProps) {
    const { t } = useTrans();
    const { locale, currentTeam } = usePage().props;
    const todayDate = pickerDay(today);
    const hrefWith = (changes: Partial<ActivityFilters>): string =>
        activityHref(workspace.slug, team.id, { ...filters, ...changes });
    const isFiltered = Object.keys(activityQuery(filters)).length > 0;

    return (
        <div data-slot="activity-page" className="flex min-w-0 flex-col gap-6">
            <header className="flex min-w-0 flex-col gap-1">
                <h1 className="font-display text-2xl font-bold tracking-heading wrap-anywhere">
                    {t('Activity')}
                </h1>
                <p className="text-sm text-muted-foreground">
                    {t('Everything that happened in :team', {
                        team: team.name,
                    })}
                </p>
            </header>

            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                <nav
                    aria-label={t('Kinds')}
                    className="flex max-w-full min-w-0 overflow-x-auto"
                >
                    <div className="inline-flex h-9 shrink-0 items-center rounded-lg bg-muted p-0.75">
                        {[null, ...ActivityGroups].map((group) => (
                            <Link
                                key={group ?? 'all'}
                                href={hrefWith({ group })}
                                aria-current={
                                    group === filters.group ? 'page' : undefined
                                }
                                className={cn(
                                    'inline-flex h-7.5 items-center justify-center rounded-md px-3 text-body-sm font-semibold whitespace-nowrap text-muted-foreground transition-colors duration-140 ease-out outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none',
                                    'aria-[current=page]:bg-card aria-[current=page]:text-foreground aria-[current=page]:shadow-card',
                                )}
                            >
                                {groupLabel(group, t)}
                            </Link>
                        ))}
                    </div>
                </nav>
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Select
                        value={filters.actor ?? Anyone}
                        onValueChange={(value) =>
                            router.visit(
                                hrefWith({
                                    actor: value === Anyone ? null : value,
                                }),
                            )
                        }
                    >
                        <SelectTrigger
                            aria-label={t('Member')}
                            className="max-w-full min-w-0 sm:max-w-56"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={Anyone}>
                                {t('Anyone')}
                            </SelectItem>
                            {members.map((member) => (
                                <SelectItem key={member.id} value={member.id}>
                                    <PersonAvatar
                                        decorative
                                        size="xs"
                                        name={member.name}
                                        src={member.avatarUrl}
                                    />
                                    <span className="truncate">
                                        {member.name}
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <DatePicker
                        label={t('Day')}
                        hideLabel
                        value={
                            filters.day === null
                                ? undefined
                                : pickerDay(filters.day)
                        }
                        onValueChange={(date) =>
                            router.visit(
                                hrefWith({
                                    day:
                                        date === undefined
                                            ? null
                                            : localToday(date),
                                }),
                            )
                        }
                        locale={
                            PickerLocales.find((known) => known === locale) ??
                            'en'
                        }
                        today={todayDate}
                        isDateDisabled={(date) => date > todayDate}
                        shortcuts={[
                            { label: t('Any day'), date: null },
                            { label: t('Today'), date: todayDate },
                            {
                                label: t('Yesterday'),
                                date: pickerDay(dayBefore(today)),
                            },
                        ]}
                        placeholder={t('Any day')}
                        className="min-w-0"
                    />
                </div>
            </div>

            {lines.length > 0 ? (
                <ActivityFeed
                    key={activityHref(workspace.slug, team.id, filters)}
                    lines={lines}
                    total={total}
                    nextCursor={nextCursor}
                    filters={filters}
                    today={today}
                />
            ) : (
                <div className="rounded-xl border border-dashed border-input bg-card/50">
                    {isFiltered ? (
                        <EmptyState
                            module="sessions"
                            overline={t('Activity')}
                            title={t('No activity matches these filters')}
                            description={t('Try another kind, person or day.')}
                            action={{
                                label: t('Clear filters'),
                                variant: 'outline',
                                href: activityHref(workspace.slug, team.id),
                            }}
                        />
                    ) : (
                        <EmptyState
                            module="sessions"
                            overline={t('Activity')}
                            title={t('Nothing has happened in this team yet.')}
                            description={t(
                                'Sessions, completed actions and new members show up here.',
                            )}
                            action={
                                currentTeam?.canCreateSession
                                    ? {
                                          label: t('New session'),
                                          icon: Plus,
                                          href: TeamsController.show.url(
                                              {
                                                  workspace: workspace.slug,
                                                  team: team.id,
                                              },
                                              { query: { new: 'session' } },
                                          ),
                                      }
                                    : undefined
                            }
                        />
                    )}
                </div>
            )}
        </div>
    );
}
