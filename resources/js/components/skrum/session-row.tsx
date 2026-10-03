import { Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
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
    className?: string;
};

/** A session of a list: the kind tile, the title, the meta line, a chevron; the whole row is one link. */
export function SessionRow({
    href,
    kind,
    title,
    meta,
    badge,
    className,
}: SessionRowProps) {
    const Icon = sessionKindIcon(kind);
    const name = [title, badge, meta]
        .filter((part) => part !== undefined && part !== '')
        .join(', ');

    return (
        <Card asChild>
            <Link
                href={href}
                aria-label={name}
                data-slot="session-row"
                data-kind={kind}
                className={cn(
                    'flex-row items-center gap-3 px-4 py-3 outline-ring transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none',
                    className,
                )}
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
                    <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-semibold">
                            {title}
                        </span>
                        {badge !== undefined && (
                            <Badge variant="outline" className="shrink-0">
                                {badge}
                            </Badge>
                        )}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                        {meta}
                    </span>
                </span>
                <ChevronRight
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground"
                />
            </Link>
        </Card>
    );
}
