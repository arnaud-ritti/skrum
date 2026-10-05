import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** The empty body of a list card: an icon in a disc above one line of text. */
export function IconEmpty({
    icon: Icon,
    slot,
    children,
}: {
    icon: LucideIcon;
    slot: string;
    children: ReactNode;
}) {
    return (
        <div
            data-slot={slot}
            className="flex flex-col items-center gap-3 px-5 py-8 text-center"
        >
            <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
                <Icon aria-hidden="true" className="size-5" />
            </span>
            <p className="text-sm text-muted-foreground">{children}</p>
        </div>
    );
}
