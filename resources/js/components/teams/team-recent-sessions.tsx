import { Link, usePage } from '@inertiajs/react';
import { CalendarClock } from 'lucide-react';
import { useState } from 'react';
import {
    sessionKindIcon,
    sessionKindTone,
} from '@/components/skrum/session-type-picker';
import type { SessionType } from '@/components/skrum/session-type-picker';
import { TeamSection } from '@/components/teams/team-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useTrans } from '@/hooks/use-trans';
import {
    sessionMeta,
    sessionOutcome,
    sessionStateLabel,
} from '@/lib/teams/session-rows';
import { cn } from '@/lib/utils';
import type { RecentSessionRow } from '@/types';

type Props = {
    rows: RecentSessionRow[];
    /** The Sessions page of the team. */
    allSessionsHref: string;
};

const Kinds: Record<RecentSessionRow['kind'], SessionType> = {
    retro: 'retro',
    poker: 'poker',
    whiteboard: 'whiteboard',
    survey: 'survey',
    game: 'icebreaker',
};

function isSameDay(first: Date, second: Date): boolean {
    return first.toDateString() === second.toDateString();
}

/** The five sessions of the team most recently active, live ones first (ScreenDashboard). */
export function TeamRecentSessions({ rows, allSessionsHref }: Props) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const [now] = useState(() => new Date());
    const formatDay = new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
    });

    if (rows.length === 0) {
        return null;
    }

    const dayOf = (iso: string): string => {
        const day = new Date(iso);

        return isSameDay(day, now) ? t('Today') : formatDay.format(day);
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
            <Card className="overflow-hidden py-0">
                <Table className="max-sm:block">
                    <TableHeader className="max-sm:hidden">
                        <TableRow>
                            <TableHead className="px-4">
                                {t('Session')}
                            </TableHead>
                            <TableHead className="px-4">{t('Date')}</TableHead>
                            <TableHead className="px-4">
                                {t('Participants')}
                            </TableHead>
                            <TableHead className="px-4">
                                {t('Status')}
                            </TableHead>
                            <TableHead className="px-4">
                                <span className="sr-only">{t('Action')}</span>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody className="max-sm:block">
                        {rows.map((row) => (
                            <RecentSession
                                key={`${row.kind}-${row.id}`}
                                row={row}
                                day={dayOf(row.updatedAt)}
                            />
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </TeamSection>
    );
}

function RecentSession({ row, day }: { row: RecentSessionRow; day: string }) {
    const { t } = useTrans();
    const kind = Kinds[row.kind];
    const Icon = sessionKindIcon(kind);
    const outcome = sessionOutcome(row, t);

    return (
        <TableRow
            data-test="recent-session"
            className="max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:items-center max-sm:gap-x-3 max-sm:py-1"
        >
            <TableCell className="w-full px-4 max-sm:col-span-2 max-sm:block">
                <div className="flex min-w-0 items-center gap-3">
                    <span
                        aria-hidden
                        data-kind={kind}
                        className={cn(
                            'flex size-7 shrink-0 items-center justify-center rounded-md border',
                            sessionKindTone(kind),
                        )}
                    >
                        <Icon className="size-3.5" />
                    </span>
                    <div className="flex min-w-0 flex-col">
                        <Link
                            href={row.url}
                            className="truncate rounded-sm font-semibold outline-ring hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                            {row.title}
                        </Link>
                        <span className="truncate text-xs text-muted-foreground">
                            {sessionMeta(row, t)}
                        </span>
                    </div>
                </div>
            </TableCell>
            <TableCell
                data-slot="recent-session-date"
                className="px-4 whitespace-nowrap text-muted-foreground max-sm:hidden"
            >
                {day}
            </TableCell>
            <TableCell
                data-slot="recent-session-participants"
                className="px-4 tabular-nums max-sm:hidden"
            >
                {row.participants}
            </TableCell>
            <TableCell className="px-4 whitespace-nowrap max-sm:block max-sm:pt-0">
                <StateBadge row={row} />
            </TableCell>
            <TableCell className="px-4 text-right whitespace-nowrap max-sm:block max-sm:pt-0 max-sm:pl-0">
                {row.state === 'live' && (
                    <Button size="sm" asChild>
                        <Link href={row.url}>
                            {t('Join')}
                            <span className="sr-only"> ({row.title})</span>
                        </Link>
                    </Button>
                )}
                {row.state === 'finished' && outcome !== null && (
                    <span className="text-xs text-muted-foreground">
                        {outcome}
                    </span>
                )}
            </TableCell>
        </TableRow>
    );
}

function StateBadge({ row }: { row: RecentSessionRow }) {
    const { t } = useTrans();
    const label = sessionStateLabel(row, t);

    if (row.state === 'live') {
        return (
            <Badge variant="success" shape="pill" dot="currentColor">
                {label}
            </Badge>
        );
    }

    if (row.state === 'finished') {
        return (
            <Badge variant="muted" shape="pill">
                {label}
            </Badge>
        );
    }

    return (
        <Badge variant="outline" shape="pill">
            {label}
        </Badge>
    );
}
