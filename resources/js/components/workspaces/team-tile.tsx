import { Link } from '@inertiajs/react';
import type { InertiaLinkProps } from '@inertiajs/react';
import {
    ArrowRight,
    CircleDot,
    Layers,
    ListChecks,
    PenTool,
    Spade,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { AvatarStack } from '@/components/skrum/avatar-stack';
import { useTrans } from '@/hooks/use-trans';
import { markColorClass } from '@/lib/mark-color';
import { cn, firstLetter } from '@/lib/utils';
import type { WorkspaceTeamTile } from '@/types';

const StackedMembers = 3;
const DayMs = 86_400_000;

const DayUnits: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 365],
    ['month', 30],
    ['week', 7],
    ['day', 1],
];

function startOfDay(time: number): number {
    const day = new Date(time);

    day.setHours(0, 0, 0, 0);

    return day.getTime();
}

/** "3 days ago", "2 weeks ago", "today": a date told to the day. */
export function formatDaysAgo(
    iso: string,
    locale: string,
    now: number,
): string {
    const days = Math.max(
        0,
        Math.round((startOfDay(now) - startOfDay(Date.parse(iso))) / DayMs),
    );
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

    for (const [unit, size] of DayUnits) {
        if (days >= size) {
            return formatter.format(-Math.floor(days / size), unit);
        }
    }

    return formatter.format(0, 'day');
}

function ActivityLine({
    icon: Icon,
    slot,
    children,
}: {
    icon: LucideIcon;
    slot: string;
    children: ReactNode;
}) {
    return (
        <li data-slot={slot} className="flex min-w-0 items-center gap-2">
            <Icon aria-hidden className="size-4 shrink-0" />
            <span className="truncate">{children}</span>
        </li>
    );
}

type TeamTileProps = {
    team: WorkspaceTeamTile;
    href: NonNullable<InertiaLinkProps['href']>;
    locale: string;
    /** The present, in milliseconds: the last retro is told from it. */
    now: number;
};

export function TeamTile({ team, href, locale, now }: TeamTileProps) {
    const { t } = useTrans();
    const { activity } = team;

    const pokerGames =
        activity.openPokerGames === 0
            ? t('No active game')
            : activity.openPokerGames === 1
              ? t('1 active poker game')
              : t(':count active poker games', {
                    count: activity.openPokerGames,
                });

    const whiteboards =
        activity.whiteboardsEditedToday === 1
            ? t('1 whiteboard edited today')
            : t(':count whiteboards edited today', {
                  count: activity.whiteboardsEditedToday,
              });

    const showsWhiteboards =
        activity.openPokerGames === 0 && activity.whiteboardsEditedToday > 0;

    const openRetroName =
        activity.openRetroSprint === null
            ? activity.openRetroTitle
            : t('Sprint :number', { number: activity.openRetroSprint });

    const openItems =
        activity.openActionItems === 0
            ? t('No open action items')
            : activity.openActionItems === 1
              ? t('1 open action item')
              : t(':count open action items', {
                    count: activity.openActionItems,
                });

    const actionItems =
        activity.overdueActionItems > 0
            ? `${openItems} · ${t(':count late', { count: activity.overdueActionItems })}`
            : openItems;

    return (
        <Link
            href={href}
            data-slot="team-tile"
            className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-5 text-card-foreground shadow-card outline-ring transition-colors duration-140 ease-standard hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
        >
            <div className="flex min-w-0 items-center gap-3">
                <span
                    aria-hidden
                    data-slot="team-mark"
                    className={cn(
                        'flex size-10 shrink-0 items-center justify-center rounded-lg border border-(--col-border) bg-(--col) font-display text-lg font-bold text-(--col-text)',
                        markColorClass(team.id),
                    )}
                >
                    {firstLetter(team.name)}
                </span>
                <span className="grid min-w-0">
                    <span className="truncate text-base font-title">
                        {team.name}
                    </span>
                    {team.description !== null && team.description !== '' && (
                        <span
                            data-slot="team-description"
                            className="truncate text-xs text-muted-foreground"
                        >
                            {team.description}
                        </span>
                    )}
                </span>
            </div>
            <ul
                data-slot="team-activity"
                className="flex flex-col gap-1.5 text-body-sm text-muted-foreground"
            >
                {activity.openRetroTitle !== null && (
                    <ActivityLine icon={CircleDot} slot="team-retro">
                        <span className="font-semibold text-skrum-success-text">
                            {t('Retro in progress')}
                        </span>{' '}
                        · {openRetroName}
                    </ActivityLine>
                )}
                {activity.openRetroTitle === null && (
                    <ActivityLine icon={Layers} slot="team-retro">
                        {activity.lastRetroAt === null
                            ? t('No retro yet')
                            : t('Last retro :when', {
                                  when: formatDaysAgo(
                                      activity.lastRetroAt,
                                      locale,
                                      now,
                                  ),
                              })}
                    </ActivityLine>
                )}
                {showsWhiteboards && (
                    <ActivityLine icon={PenTool} slot="team-whiteboards">
                        {whiteboards}
                    </ActivityLine>
                )}
                {!showsWhiteboards && (
                    <ActivityLine icon={Spade} slot="team-poker">
                        {pokerGames}
                    </ActivityLine>
                )}
                <ActivityLine icon={ListChecks} slot="team-actions">
                    {actionItems}
                </ActivityLine>
            </ul>
            <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <span
                    data-slot="team-members"
                    className="flex items-center gap-2"
                >
                    {team.members.length > 0 && (
                        <AvatarStack
                            size="sm"
                            max={StackedMembers}
                            total={team.membersCount}
                            people={team.members
                                .slice(0, StackedMembers)
                                .map((member) => ({
                                    name: member.name,
                                    src: member.avatarUrl,
                                }))}
                        />
                    )}
                    <span className="text-xs whitespace-nowrap text-muted-foreground">
                        {team.membersCount === 1
                            ? t('1 member')
                            : t(':count members', {
                                  count: team.membersCount,
                              })}
                    </span>
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap text-skrum-primary-text">
                    {t('Open the team')}
                    <ArrowRight aria-hidden className="size-3.5" />
                </span>
            </div>
        </Link>
    );
}
