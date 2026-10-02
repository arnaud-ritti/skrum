import { useId } from 'react';
import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Props = {
    title: string;
    /** Given when something outside the card points at its heading. */
    titleId?: string;
    /** What sits on the line of the title: a count, a note, actions. */
    aside?: ReactNode;
    /** Layout of the aside, for a card whose note takes a line of its own when narrow. */
    asideClassName?: string;
    className?: string;
    children: ReactNode;
};

/**
 * A card of the session end, named by its heading. The heading is a direct
 * child of the section: the browser suite reads the cards that way.
 */
export function ResultsCard({
    title,
    titleId,
    aside,
    asideClassName,
    className,
    children,
}: Props) {
    const generatedId = useId();
    const id = titleId ?? generatedId;

    return (
        <Card
            asChild
            className={cn(
                'grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 p-5',
                className,
            )}
        >
            <section aria-labelledby={id}>
                <h2
                    id={id}
                    className={cn(
                        'min-w-0 text-base font-title',
                        !aside && 'col-span-2',
                    )}
                >
                    {title}
                </h2>
                {aside && (
                    <div
                        className={cn(
                            'flex min-w-0 flex-wrap items-center gap-2',
                            asideClassName,
                        )}
                    >
                        {aside}
                    </div>
                )}
                <div className="col-span-2 flex min-w-0 flex-col gap-3">
                    {children}
                </div>
            </section>
        </Card>
    );
}
