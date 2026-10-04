import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

/** "Step :n of 4", the step's title and its sentence (`.ob-over`, the display title, `.ob-lead`). */
export function StepHeading({
    number,
    title,
    titleId,
    lead,
}: {
    number: number;
    title: string;
    titleId?: string;
    lead?: string;
}) {
    const { t } = useTrans();

    return (
        <div className="flex min-w-0 flex-col gap-2">
            <span className="text-overline text-skrum-primary-text uppercase">
                {t('Step :n of 4', { n: number })}
            </span>
            <h1
                id={titleId}
                className="font-display text-display-lg wrap-anywhere"
            >
                {title}
            </h1>
            {lead !== undefined && (
                <p className="max-w-128 text-base leading-6.5 text-muted-foreground">
                    {lead}
                </p>
            )}
        </div>
    );
}

/**
 * The step's actions (`.ob-actions`); on a phone they stay docked at the
 * bottom of the screen, over a top border.
 */
export function StepActions({
    className,
    children,
}: {
    className?: string;
    children: ReactNode;
}) {
    return (
        <div
            data-slot="step-actions"
            className={cn(
                'mt-3 flex min-w-0 flex-wrap items-center gap-2',
                'max-md:sticky max-md:bottom-0 max-md:z-10 max-md:-mx-4 max-md:border-t max-md:bg-background max-md:px-4 max-md:py-3',
                className,
            )}
        >
            {children}
        </div>
    );
}

/** A field error that belongs to no single input (a select, a group). */
export function StepFieldError({
    id,
    message,
}: {
    id?: string;
    message: string | undefined;
}) {
    if (message === undefined) {
        return null;
    }

    return (
        <span
            id={id}
            data-slot="field-error"
            className="flex items-center gap-1.5 text-body-sm text-skrum-destructive-text"
        >
            <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
            {message}
        </span>
    );
}
