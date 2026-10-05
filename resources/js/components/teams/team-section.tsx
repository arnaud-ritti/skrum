import { Link } from '@inertiajs/react';
import { Plus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useId } from 'react';
import type { ReactNode, Ref } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type Props = {
    /** The anchor of the block, such as `surveys` for `#surveys`. */
    id?: string;
    icon: LucideIcon;
    title: string;
    count?: number;
    /** Links, the "…" menu: at the end of the heading row. */
    actions?: ReactNode;
    /** "New …" at the very end of the heading row: the team page asking for the dialog on a type. */
    newSession?: { href: string; label: string };
    /** Given when the heading receives the focus (after a row is deleted). */
    headingRef?: Ref<HTMLHeadingElement>;
    children: ReactNode;
};

/** One titled block of the main column of the team page. */
export function TeamSection({
    id,
    icon: Icon,
    title,
    count,
    actions,
    newSession,
    headingRef,
    children,
}: Props) {
    const headingId = useId();

    return (
        <section
            id={id}
            aria-labelledby={headingId}
            className="flex min-w-0 scroll-mt-20 flex-col gap-3"
        >
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <h2
                    id={headingId}
                    ref={headingRef}
                    tabIndex={headingRef === undefined ? undefined : -1}
                    className="flex min-w-0 items-center gap-2 rounded-sm text-base font-title outline-ring focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                    <Icon
                        aria-hidden
                        className="size-4 shrink-0 text-muted-foreground"
                    />
                    <span className="truncate">{title}</span>
                    {count !== undefined && (
                        <Badge variant="muted" shape="pill">
                            {count}
                        </Badge>
                    )}
                </h2>
                {(actions !== undefined || newSession !== undefined) && (
                    <div className="flex min-w-0 items-center gap-2">
                        {actions}
                        {newSession && (
                            <Button variant="outline" size="sm" asChild>
                                <Link
                                    href={newSession.href}
                                    preserveScroll
                                    preserveState
                                >
                                    <Plus aria-hidden />
                                    <span className="truncate">
                                        {newSession.label}
                                    </span>
                                </Link>
                            </Button>
                        )}
                    </div>
                )}
            </div>
            {children}
        </section>
    );
}
