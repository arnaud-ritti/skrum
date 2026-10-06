import { Link, usePage } from '@inertiajs/react';
import { CalendarClock } from 'lucide-react';
import { RotiOutcome } from '@/components/skrum/roti-value';
import { SessionRow } from '@/components/skrum/session-row';
import { TeamSection } from '@/components/teams/team-section';
import { Button } from '@/components/ui/button';
import { useNow } from '@/hooks/use-now';
import { useTrans } from '@/hooks/use-trans';
import {
    sessionMeta,
    sessionOutcome,
    sessionStateLabel,
    sessionType,
} from '@/lib/teams/session-rows';
import type { RecentSessionRow } from '@/types';

type Props = {
    /** The sessions that are not live, the most recently active first. */
    rows: RecentSessionRow[];
    /** The Sessions page of the team. */
    allSessionsHref: string;
};

function isSameDay(first: Date, second: Date): boolean {
    return first.toDateString() === second.toDateString();
}

/** The last sessions of the team that are not live, as the rows of the Sessions list. */
export function TeamRecentSessions({ rows, allSessionsHref }: Props) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const now = new Date(useNow(rows));
    const formatDay = new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
    });
    const formatDayOfAnotherYear = new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });

    if (rows.length === 0) {
        return null;
    }

    const dayOf = (iso: string): string => {
        const day = new Date(iso);

        if (isSameDay(day, now)) {
            return t('Today');
        }

        return day.getFullYear() === now.getFullYear()
            ? formatDay.format(day)
            : formatDayOfAnotherYear.format(day);
    };

    return (
        <TeamSection
            id="recent-sessions"
            icon={CalendarClock}
            title={t('Recent sessions')}
            actions={
                <Button variant="link" size="sm" asChild>
                    <Link href={allSessionsHref}>{t('All sessions')}</Link>
                </Button>
            }
        >
            <ul className="flex min-w-0 flex-col gap-2">
                {rows.map((row) => {
                    const state = sessionStateLabel(row, t);
                    const isFinished = row.state === 'finished';
                    const outcome = isFinished ? sessionOutcome(row, t) : null;

                    return (
                        <li key={`${row.kind}-${row.id}`} className="min-w-0">
                            <SessionRow
                                href={row.url}
                                kind={sessionType(row)}
                                title={row.title}
                                meta={sessionMeta(row, t)}
                                outcome={outcome ?? undefined}
                                outcomeContent={
                                    row.roti === null ? undefined : (
                                        <RotiOutcome
                                            value={row.roti}
                                            rest={sessionOutcome(
                                                { ...row, roti: null },
                                                t,
                                            )}
                                        />
                                    )
                                }
                                date={dayOf(row.updatedAt)}
                                badge={isFinished ? undefined : state}
                                status={isFinished ? state : undefined}
                                actionColumn={false}
                            />
                        </li>
                    );
                })}
            </ul>
        </TeamSection>
    );
}
