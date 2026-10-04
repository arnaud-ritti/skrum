import {
    Pagination,
    PaginationNext,
    PaginationPrevious,
} from '@/components/ui/pagination';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

type Props = {
    currentPage: number;
    lastPage: number;
    prevPageUrl: string | null;
    nextPageUrl: string | null;
    className?: string;
};

/**
 * "Page x of y" with Previous and Next, on the URLs the server gave. The page
 * keeps its state across them, so "all matching" survives a page change (spec 24 §9.3).
 */
export function ActionItemsPagination({
    currentPage,
    lastPage,
    prevPageUrl,
    nextPageUrl,
    className,
}: Props) {
    const { t } = useTrans();

    return (
        <div
            data-slot="action-items-pagination"
            className={cn(
                'flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2 text-sm',
                className,
            )}
        >
            <span className="text-muted-foreground tabular-nums">
                {t('Page :page of :total', {
                    page: currentPage,
                    total: lastPage,
                })}
            </span>
            <Pagination className="mx-0 w-auto min-w-24 flex-1 justify-end gap-2">
                <PaginationPrevious
                    size="sm"
                    variant="outline"
                    disabled={prevPageUrl === null}
                    href={prevPageUrl ?? undefined}
                    preserveState
                />
                <PaginationNext
                    size="sm"
                    variant="outline"
                    disabled={nextPageUrl === null}
                    href={nextPageUrl ?? undefined}
                    preserveState
                />
            </Pagination>
        </div>
    );
}
