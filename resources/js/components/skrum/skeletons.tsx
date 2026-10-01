import { Skeleton } from '@/components/ui/skeleton';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

export interface BoardSkeletonProps {
    columns?: number;
    cardsPerColumn?: number[];
    status?: string;
}

export interface ListSkeletonProps {
    rows?: number;
    withAvatar?: boolean;
    withBadge?: boolean;
}

const OnColumn = 'bg-[color-mix(in_oklch,var(--foreground)_9%,var(--muted))]';
const Line = 'h-2.5 rounded-full';
const CardLineWidths = [
    ['w-11/12', 'w-7/10', 'w-2/5'],
    ['w-4/5', 'w-1/2', 'w-3/5'],
    ['w-23/24', 'w-7/8', 'w-2/5'],
];
const ColumnTitleWidths = ['w-1/2', 'w-2/5', 'w-1/3'];
const AuthorWidths = ['w-15', 'w-12', 'w-14'];
const RowTitleWidths = ['w-3/5', 'w-7/10', 'w-1/2', 'w-2/3', 'w-4/7'];
const RowMetaWidths = ['w-1/3', 'w-3/10', 'w-2/5', 'w-7/25', 'w-9/25'];
const BadgeWidths = ['w-16', 'w-14', 'w-16', 'w-15', 'w-16'];

function SkeletonCard({ seed, lines }: { seed: number; lines: number }) {
    const widths = CardLineWidths[seed % CardLineWidths.length];

    return (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
            {Array.from({ length: lines }, (_, index) => (
                <Skeleton
                    key={index}
                    className={cn(Line, widths[index % widths.length])}
                />
            ))}
            <div className="mt-1 flex items-center gap-2">
                <Skeleton className="size-5 rounded-full" />
                <Skeleton
                    className={cn(
                        'h-2 rounded-full',
                        AuthorWidths[seed % AuthorWidths.length],
                    )}
                />
            </div>
        </div>
    );
}

function StatusLine({ status }: { status: string }) {
    return (
        <p
            role="status"
            className="flex items-center gap-2 text-sm text-muted-foreground"
        >
            <span
                aria-hidden="true"
                className="flex items-center gap-0.5 text-skrum-primary-text"
            >
                <i className="size-1 animate-trema rounded-full bg-current motion-reduce:animate-none" />
                <i className="size-1 animate-trema rounded-full bg-current [animation-delay:150ms] motion-reduce:animate-none" />
            </span>
            <span className="truncate">{status}</span>
        </p>
    );
}

export function BoardSkeleton({
    columns = 3,
    cardsPerColumn = [3, 2, 1],
    status,
}: BoardSkeletonProps) {
    const { t } = useTrans();
    const columnCount = Math.max(0, Math.floor(columns));
    const cardCounts = cardsPerColumn.length > 0 ? cardsPerColumn : [1];

    return (
        <div className="flex flex-col gap-2">
            {status ? <StatusLine status={status} /> : null}
            <div
                role="group"
                aria-busy="true"
                aria-label={t('Loading the board')}
                className="flex min-w-0 gap-3 overflow-hidden rounded-xl border border-border p-4"
            >
                {Array.from({ length: columnCount }, (_, column) => {
                    const cards = Math.max(
                        0,
                        cardCounts[column % cardCounts.length],
                    );
                    const isLast = column === columnCount - 1;

                    return (
                        <div
                            key={column}
                            aria-hidden="true"
                            className="flex min-w-0 flex-1 flex-col gap-3 rounded-xl bg-[color-mix(in_oklch,var(--muted)_70%,var(--skrum-canvas))] p-3"
                        >
                            <div className="flex items-center gap-2">
                                <Skeleton
                                    className={cn(
                                        'size-2.5 rounded-xs',
                                        OnColumn,
                                    )}
                                />
                                <Skeleton
                                    className={cn(
                                        Line,
                                        OnColumn,
                                        ColumnTitleWidths[
                                            column % ColumnTitleWidths.length
                                        ],
                                    )}
                                />
                            </div>
                            {Array.from({ length: cards }, (_, card) => (
                                <SkeletonCard
                                    key={card}
                                    seed={column + card}
                                    lines={((column + card) % 3) + 1}
                                />
                            ))}
                            {isLast ? (
                                <Skeleton
                                    className={cn(
                                        'h-10 rounded-lg opacity-60',
                                        OnColumn,
                                    )}
                                />
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function ListSkeleton({
    rows = 5,
    withAvatar = true,
    withBadge = true,
}: ListSkeletonProps) {
    const { t } = useTrans();

    return (
        <div
            role="group"
            aria-busy="true"
            aria-label={t('Loading sessions')}
            className="min-w-0 overflow-hidden rounded-xl border border-border bg-card"
        >
            {Array.from({ length: Math.max(0, Math.floor(rows)) }, (_, row) => (
                <div
                    key={row}
                    aria-hidden="true"
                    className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
                >
                    {withAvatar ? (
                        <Skeleton className="size-8 shrink-0 rounded-md" />
                    ) : null}
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <Skeleton
                            className={cn(
                                Line,
                                RowTitleWidths[row % RowTitleWidths.length],
                            )}
                        />
                        <Skeleton
                            className={cn(
                                'h-2 rounded-full',
                                RowMetaWidths[row % RowMetaWidths.length],
                            )}
                        />
                    </div>
                    {withBadge ? (
                        <Skeleton
                            className={cn(
                                'h-5.5 shrink-0 rounded-full',
                                BadgeWidths[row % BadgeWidths.length],
                            )}
                        />
                    ) : null}
                </div>
            ))}
        </div>
    );
}
