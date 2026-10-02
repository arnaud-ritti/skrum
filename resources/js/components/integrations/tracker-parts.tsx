import { CircleAlert, ExternalLink } from 'lucide-react';
import { useId } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

type TrackerPanelProps = {
    title: string;
    description?: string;
    /** A button at the end of the title line. */
    action?: ReactNode;
    /** `data-slot` of the section. */
    slot: string;
    /** A panel inside another panel has no rule above it and a smaller title. */
    nested?: boolean;
    children: ReactNode;
};

/** A titled part of a tracker card, under the details of the connection. */
export function TrackerPanel({
    title,
    description,
    action,
    slot,
    nested = false,
    children,
}: TrackerPanelProps): ReactElement {
    const titleId = useId();
    const Title = nested ? 'h5' : 'h4';

    return (
        <section
            aria-labelledby={titleId}
            data-slot={slot}
            className={cn(
                'flex min-w-0 flex-col gap-3',
                !nested && 'border-t pt-4',
            )}
        >
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-2">
                <div className="flex min-w-0 flex-1 basis-56 flex-col gap-0.5">
                    <Title id={titleId} className="text-sm font-semibold">
                        {title}
                    </Title>
                    {description !== undefined && (
                        <p className="text-body-sm text-muted-foreground">
                            {description}
                        </p>
                    )}
                </div>
                {action}
            </div>
            {children}
        </section>
    );
}

/** What could not be loaded, with the way to ask again. */
export function PanelError({
    message,
    retryLabel,
    onRetry,
}: {
    message: string;
    retryLabel: string;
    onRetry: () => void;
}): ReactElement {
    return (
        <div
            role="alert"
            data-slot="panel-error"
            className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-skrum-destructive-soft px-3 py-2 text-sm text-skrum-destructive-text"
        >
            <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 basis-40 break-words">
                {message}
            </span>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="max-w-full text-foreground"
                onClick={onRetry}
            >
                <span className="truncate">{retryLabel}</span>
            </Button>
        </div>
    );
}

export function PanelLoading({ rows = 3 }: { rows?: number }): ReactElement {
    const { t } = useTrans();

    return (
        <div
            role="status"
            data-slot="panel-loading"
            className="flex flex-col gap-2 rounded-lg border p-3"
        >
            <span className="sr-only">{t('Loading…')}</span>
            {Array.from({ length: rows }, (_, index) => (
                <Skeleton
                    key={index}
                    className={cn(
                        'h-4',
                        index === rows - 1 ? 'w-2/3' : 'w-full',
                    )}
                />
            ))}
        </div>
    );
}

/** The site, server or account of a connection, opened in a new tab. */
export function TrackerLink({
    href,
    children,
}: {
    href: string;
    children: ReactNode;
}): ReactElement {
    return (
        <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex max-w-full items-center gap-1 rounded-xs underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
            <span className="min-w-0 break-words">{children}</span>
            <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
        </a>
    );
}

/** What a tracker does, shown while it is not connected. */
export function TrackerIntro({
    children,
}: {
    children: ReactNode;
}): ReactElement {
    return <p className="text-sm text-muted-foreground">{children}</p>;
}
