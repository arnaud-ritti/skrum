import { Deferred, router } from '@inertiajs/react';
import { CircleAlert, RotateCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useLastDefined } from '@/hooks/use-last-defined';
import { useTrans } from '@/hooks/use-trans';
import type { TeamMoodPoint } from '@/types';

export type TrendState = {
    /** `undefined` until the server has answered for the first time. */
    trend?: TeamMoodPoint[];
    /** The server could not build the trend. */
    failed?: boolean;
    onRetry?: () => void;
};

type Props = {
    /** The deferred `moodTrend` prop: absent while loading, and still absent once rescued. */
    trend?: TeamMoodPoint[] | null;
    children: (state: TrendState) => ReactNode;
};

/**
 * Reads the deferred `moodTrend` prop of the page. A visit to the same page
 * drops the prop until it is fetched again: the last trend received stays on
 * screen meanwhile. A trend the server failed to build gives the error state.
 */
export function DeferredTrend({ trend, children }: Props) {
    const lastTrend = useLastDefined(trend ?? undefined);
    const loaded = children({ trend: lastTrend });

    return (
        <Deferred
            data="moodTrend"
            fallback={() => loaded}
            rescue={children({
                failed: true,
                onRetry: () => router.reload({ only: ['moodTrend'] }),
            })}
        >
            {loaded}
        </Deferred>
    );
}

export function TrendSkeleton() {
    const { t } = useTrans();

    return (
        <Card data-slot="team-trend-loading" aria-busy className="gap-4 p-5">
            <span role="status" className="sr-only">
                {t('Loading chart')}
            </span>
            <div aria-hidden className="flex flex-col gap-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-44" />
            </div>
            <Skeleton aria-hidden className="h-44 w-full" />
        </Card>
    );
}

export function TrendError({
    title,
    headingLevel = 2,
    onRetry,
}: {
    title: string;
    headingLevel?: 2 | 3;
    onRetry?: () => void;
}) {
    const { t } = useTrans();
    const HeadingTag = headingLevel === 2 ? 'h2' : 'h3';

    return (
        <Card data-slot="team-trend-error" className="gap-3 p-5">
            <HeadingTag className="text-base leading-snug font-title">
                {title}
            </HeadingTag>
            <p
                role="alert"
                className="flex items-start gap-1.5 text-body-sm font-medium text-skrum-destructive-text"
            >
                <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
                <span className="min-w-0 break-words">
                    {t('The trend could not be loaded.')}
                </span>
            </p>
            {onRetry !== undefined && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="self-start"
                    onClick={onRetry}
                >
                    <RotateCw aria-hidden />
                    <span className="truncate">{t('Retry')}</span>
                </Button>
            )}
        </Card>
    );
}
