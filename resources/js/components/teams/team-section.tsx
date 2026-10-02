import type { LucideIcon } from 'lucide-react';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';

type Props = {
    icon: LucideIcon;
    title: string;
    count?: number;
    /** Links, the "…" menu: at the end of the heading row. */
    actions?: ReactNode;
    children: ReactNode;
};

/** One titled block of the main column of the team page. */
export function TeamSection({
    icon: Icon,
    title,
    count,
    actions,
    children,
}: Props) {
    const headingId = useId();

    return (
        <section
            aria-labelledby={headingId}
            className="flex min-w-0 flex-col gap-3"
        >
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <h2
                    id={headingId}
                    className="flex min-w-0 items-center gap-2 text-base font-title"
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
                {actions !== undefined && (
                    <div className="flex min-w-0 items-center gap-2">
                        {actions}
                    </div>
                )}
            </div>
            {children}
        </section>
    );
}
