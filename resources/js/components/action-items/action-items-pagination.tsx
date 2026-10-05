import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { PaginationLink } from '@/components/ui/pagination';
import { useTrans } from '@/hooks/use-trans';
import { cn } from '@/lib/utils';

type Props = {
    currentPage: number;
    lastPage: number;
    prevPageUrl: string | null;
    nextPageUrl: string | null;
    /** The table's footer counts the selection out of every matching item. */
    selection?: { count: number; total: number };
    className?: string;
};

/**
 * The footer of the Table mockup: the selection count, then "Page x / y" with
 * chevrons on the URLs the server gave. The page keeps its state across them,
 * so "all matching" survives a page change (spec 24 §9.3).
 */
export function ActionItemsPagination({
    currentPage,
    lastPage,
    prevPageUrl,
    nextPageUrl,
    selection,
    className,
}: Props) {
    const { t } = useTrans();
    const paged = lastPage > 1;

    return (
        <div
            data-slot="action-items-pagination"
            className={cn(
                'flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-body-sm text-muted-foreground',
                selection ? 'justify-between' : 'justify-end',
                className,
            )}
        >
            {selection && (
                <span className="tabular-nums" aria-live="polite">
                    {t(':count of :total action items selected', {
                        count: selection.count,
                        total: selection.total,
                    })}
                </span>
            )}
            {paged && (
                <nav
                    aria-label={t('Pagination')}
                    className="flex items-center gap-2"
                >
                    <span className="tabular-nums">
                        {t('Page :page / :total', {
                            page: currentPage,
                            total: lastPage,
                        })}
                    </span>
                    <PaginationLink
                        size="icon-sm"
                        variant="outline"
                        className="min-w-8"
                        aria-label={t('Previous page')}
                        disabled={prevPageUrl === null}
                        href={prevPageUrl ?? undefined}
                        preserveState
                    >
                        <ChevronLeftIcon aria-hidden />
                    </PaginationLink>
                    <PaginationLink
                        size="icon-sm"
                        variant="outline"
                        className="min-w-8"
                        aria-label={t('Next page')}
                        disabled={nextPageUrl === null}
                        href={nextPageUrl ?? undefined}
                        preserveState
                    >
                        <ChevronRightIcon aria-hidden />
                    </PaginationLink>
                </nav>
            )}
        </div>
    );
}
