import { usePage } from '@inertiajs/react';
import { Cog } from 'lucide-react';
import type { ReactElement } from 'react';
import {
    auditActionLabel,
    auditSubjectLabel,
} from '@/components/admin/audit-log/audit-action-label';
import { PersonAvatar } from '@/components/ui/avatar';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useTrans } from '@/hooks/use-trans';
import { formatRelativeTime } from '@/lib/action-items/format';
import type { AuditEvent } from '@/lib/admin/types';

export type AuditTableProps = {
    events: AuditEvent[];
    /** The moment the relative times are counted from. */
    now: number;
};

const head = 'px-2 whitespace-normal';
const cell = 'px-2 text-body-sm';

function Actor({ event }: { event: AuditEvent }): ReactElement {
    const { t } = useTrans();

    if (event.actor === null) {
        return (
            <span
                data-slot="audit-actor"
                className="flex min-w-0 items-center gap-2 text-muted-foreground"
            >
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted">
                    <Cog aria-hidden="true" className="size-3.5" />
                </span>
                <span className="min-w-0 wrap-anywhere">{t('System')}</span>
            </span>
        );
    }

    return (
        <span
            data-slot="audit-actor"
            className="flex min-w-0 items-center gap-2"
        >
            <PersonAvatar
                decorative
                name={event.actor.name}
                src={event.actor.avatarUrl}
                size="sm"
                className="shrink-0"
            />
            <span className="min-w-0 font-medium wrap-anywhere">
                {event.actor.name}
            </span>
        </span>
    );
}

function When({ event, now }: { event: AuditEvent; now: number }) {
    const { locale } = usePage<{ locale: string }>().props;
    const exact = new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'medium',
    }).format(new Date(event.at));

    return (
        <time
            dateTime={event.at}
            title={exact}
            className="whitespace-nowrap tabular-nums"
        >
            {formatRelativeTime(event.at, locale, now)}
        </time>
    );
}

function Ip({ event }: { event: AuditEvent }) {
    return event.ip === null ? (
        <span className="text-muted-foreground">—</span>
    ) : (
        <span className="font-mono text-xs wrap-anywhere">{event.ip}</span>
    );
}

/**
 * The events of one page. Both layouts are in the page: the table from a wide
 * container, stacked cards below it (the mockup's mobile rule).
 */
export function AuditTable({ events, now }: AuditTableProps): ReactElement {
    const { t } = useTrans();
    const subject = (event: AuditEvent): string =>
        auditSubjectLabel(event, t) ?? '—';

    return (
        <div className="@container/audit min-w-0">
            <div data-slot="audit-table" className="hidden @3xl/audit:block">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className={`${head} pl-5`}>
                                {t('When')}
                            </TableHead>
                            <TableHead className={head}>{t('Actor')}</TableHead>
                            <TableHead className={head}>
                                {t('Action')}
                            </TableHead>
                            <TableHead className={head}>
                                {t('Subject')}
                            </TableHead>
                            <TableHead className={`${head} pr-5`}>
                                {t('IP address')}
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {events.map((event) => (
                            <TableRow
                                key={event.id}
                                data-slot="audit-row"
                                className="hover:bg-transparent"
                            >
                                <TableCell className={`${cell} pl-5`}>
                                    <When event={event} now={now} />
                                </TableCell>
                                <TableCell className={cell}>
                                    <Actor event={event} />
                                </TableCell>
                                <TableCell
                                    className={`${cell} whitespace-normal`}
                                >
                                    {auditActionLabel(event, t)}
                                </TableCell>
                                <TableCell
                                    className={`${cell} wrap-anywhere whitespace-normal`}
                                >
                                    {subject(event)}
                                </TableCell>
                                <TableCell className={`${cell} pr-5`}>
                                    <Ip event={event} />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <ul
                data-slot="audit-cards"
                aria-label={t('Audit log')}
                className="flex flex-col @3xl/audit:hidden"
            >
                {events.map((event) => (
                    <li
                        key={event.id}
                        className="flex min-w-0 flex-col gap-2 border-b px-5 py-4 last:border-b-0"
                    >
                        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
                            <Actor event={event} />
                            <span className="text-xs text-muted-foreground">
                                <When event={event} now={now} />
                            </span>
                        </div>
                        <p className="text-body-sm">
                            {auditActionLabel(event, t)}
                        </p>
                        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-body-sm">
                            <dt className="text-muted-foreground">
                                {t('Subject')}
                            </dt>
                            <dd className="min-w-0 wrap-anywhere">
                                {subject(event)}
                            </dd>
                            <dt className="text-muted-foreground">
                                {t('IP address')}
                            </dt>
                            <dd className="min-w-0">
                                <Ip event={event} />
                            </dd>
                        </dl>
                    </li>
                ))}
            </ul>
        </div>
    );
}
