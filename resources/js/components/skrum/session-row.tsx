import { Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import {
    sessionKindIcon,
    sessionKindTone,
} from '@/components/skrum/session-type-picker';
import type { SessionType } from '@/components/skrum/session-type-picker';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type SessionRowProps = {
    href: string;
    kind: SessionType;
    title: string;
    /** The line under the title, such as "Retro · Writing · 9 people". */
    meta: string;
    /** A short status after the title, such as "Draft". */
    badge?: string;
    /** What the session produced, such as "ROTI 4.0 · 2 actions"; under the meta line on a phone. */
    outcome?: string;
    date?: string;
    /** A state told in plain text at the end of the meta line, such as "Ended". */
    status?: string;
    /** A control of the row, such as "Join": in the card, outside the link. */
    action?: ReactNode;
    /** The "…" menu of the row: in the card, outside the link. */
    menu?: ReactNode;
    className?: string;
};

/**
 * A session of a list: the kind tile, the title, the meta line, a chevron.
 * The whole card leads to the session; an action and a menu stay above it.
 */
export function SessionRow({
    href,
    kind,
    title,
    meta,
    badge,
    outcome,
    date,
    status,
    action,
    menu,
    className,
}: SessionRowProps) {
    const Icon = sessionKindIcon(kind);
    const name = [title, badge, meta, outcome, date, status]
        .filter((part) => part !== undefined && part !== '')
        .join(', ');

    return (
        <Card
            className={cn(
                'relative flex-row items-center gap-3 px-4 py-3 outline-ring transition-colors hover:bg-accent has-[[data-slot=session-row]:focus-visible]:outline-2 has-[[data-slot=session-row]:focus-visible]:outline-offset-2 motion-reduce:transition-none',
                className,
            )}
        >
            <Link
                href={href}
                aria-label={name}
                data-slot="session-row"
                data-kind={kind}
                className="flex min-w-0 flex-1 items-center gap-3 outline-none after:absolute after:inset-0 after:rounded-xl"
            >
                <span
                    aria-hidden
                    data-slot="session-row-kind"
                    className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-md border',
                        sessionKindTone(kind),
                    )}
                >
                    <Icon className="size-4" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex min-w-0 items-center gap-x-2 max-sm:flex-wrap">
                        <span className="truncate text-sm font-semibold">
                            {title}
                        </span>
                        {badge !== undefined && badge !== '' && (
                            <Badge variant="outline" className="shrink-0">
                                {badge}
                            </Badge>
                        )}
                    </span>
                    <span className="flex min-w-0 flex-wrap gap-x-1 text-xs text-muted-foreground">
                        <span className="max-w-full truncate">{meta}</span>
                        {outcome !== undefined && outcome !== '' && (
                            <span
                                data-slot="session-row-outcome"
                                className="max-w-full truncate max-sm:basis-full"
                            >
                                <span aria-hidden className="max-sm:hidden">
                                    {'· '}
                                </span>
                                {outcome}
                            </span>
                        )}
                        {(date !== undefined || status !== undefined) && (
                            <span className="flex gap-x-1.5 whitespace-nowrap sm:ml-auto">
                                {date !== undefined && <span>{date}</span>}
                                {status !== undefined && (
                                    <span className="font-medium">
                                        {status}
                                    </span>
                                )}
                            </span>
                        )}
                    </span>
                </span>
            </Link>
            {action !== undefined && (
                <span className="relative z-10 flex shrink-0">{action}</span>
            )}
            {menu !== undefined && (
                <span className="relative z-10 flex shrink-0">{menu}</span>
            )}
            <ChevronRight
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground"
            />
        </Card>
    );
}
