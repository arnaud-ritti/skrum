import type { ReactNode } from 'react';
import type { BenchGroup } from '@/components/dev/bench';
import { BoardSkeleton, ListSkeleton } from '@/components/skrum/skeletons';
import { Skeleton } from '@/components/ui/skeleton';
import { useTrans } from '@/hooks/use-trans';

export const group: BenchGroup = 'skrum';

function Example({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            {children}
        </div>
    );
}

export default function SkeletonSection() {
    const { t } = useTrans();

    return (
        <div className="flex flex-col gap-8 p-4 md:p-6">
            <Example label={t('Primitive block')}>
                <div className="flex items-center gap-3">
                    <Skeleton className="size-8" />
                    <Skeleton className="h-2.5 w-40 rounded-full" />
                    <Skeleton className="h-5.5 w-16 rounded-full" />
                </div>
            </Example>
            <Example label={t('Board skeleton, default')}>
                <BoardSkeleton />
            </Example>
            <Example label={t('Board skeleton with connection status')}>
                <BoardSkeleton status={t('Connecting to the session…')} />
            </Example>
            <Example label={t('Board skeleton, two columns, many cards')}>
                <BoardSkeleton columns={2} cardsPerColumn={[4, 3]} />
            </Example>
            <Example label={t('List skeleton, default')}>
                <ListSkeleton />
            </Example>
            <Example label={t('List skeleton without avatar and badge')}>
                <ListSkeleton rows={3} withAvatar={false} withBadge={false} />
            </Example>
            <Example label={t('Reduced motion: blocks stay static')}>
                <p className="text-sm text-muted-foreground">
                    {t('With prefers-reduced-motion the blocks do not pulse.')}
                </p>
            </Example>
        </div>
    );
}
