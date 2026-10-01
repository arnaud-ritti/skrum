import { useState } from 'react';
import {
    LoadMore,
    LoadMoreFeed,
    PageSizeBar,
    Pagination,
} from '@/components/ui/pagination';
import { useTrans } from '@/hooks/use-trans';

function Labelled({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-2">
            <p className="text-xs font-semibold text-muted-foreground">
                {label}
            </p>
            {children}
        </div>
    );
}

function Narrow({
    width,
    children,
}: {
    width: string;
    children: React.ReactNode;
}) {
    return (
        <div className="max-w-full min-w-0 overflow-hidden" style={{ width }}>
            {children}
        </div>
    );
}

export default function PaginationSection() {
    const { t } = useTrans();
    const [page, setPage] = useState(3);
    const [wide, setWide] = useState(10);
    const [compact, setCompact] = useState(3);
    const [pageSize, setPageSize] = useState<10 | 20 | 50 | 100>(20);
    const [counterPage, setCounterPage] = useState(2);

    const total = 128;
    const from = (counterPage - 1) * pageSize + 1;
    const to = Math.min(counterPage * pageSize, total);
    const rows = [
        t('Isolate E2E data per worker'),
        t('Code review before 4 pm'),
        t('Weekly sync with the PO'),
    ];

    return (
        <div className="flex max-w-2xl min-w-0 flex-col gap-8 p-4 md:p-6">
            <Labelled
                label={t(
                    'Numbered: page 3 of 7, hover, keyboard focus, current page outlined',
                )}
            >
                <Pagination page={page} pageCount={7} onPageChange={setPage} />
            </Labelled>
            <Labelled label={t('First page: Previous disabled')}>
                <Pagination page={1} pageCount={7} onPageChange={() => {}} />
            </Labelled>
            <Labelled label={t('Last page: Next disabled')}>
                <Pagination page={7} pageCount={7} onPageChange={() => {}} />
            </Labelled>
            <Labelled label={t('Ellipsis on both sides, siblingCount 2')}>
                <Pagination
                    page={wide}
                    pageCount={20}
                    siblingCount={2}
                    onPageChange={setWide}
                />
            </Labelled>
            <Labelled label={t('Inertia links with getHref')}>
                <Pagination
                    page={2}
                    pageCount={5}
                    onPageChange={() => {}}
                    getHref={(target) => `?page=${target}`}
                />
            </Labelled>
            <Labelled label={t('Narrow container: under 448 px icons only')}>
                <Narrow width="26rem">
                    <Pagination
                        page={4}
                        pageCount={9}
                        onPageChange={() => {}}
                    />
                </Narrow>
            </Labelled>
            <Labelled
                label={t(
                    'Narrow container: under 320 px intermediate pages hidden',
                )}
            >
                <Narrow width="18rem">
                    <Pagination
                        page={4}
                        pageCount={9}
                        onPageChange={() => {}}
                    />
                </Narrow>
            </Labelled>
            <Labelled label={t('Compact')}>
                <Pagination
                    variant="compact"
                    page={compact}
                    pageCount={7}
                    onPageChange={setCompact}
                />
            </Labelled>
            <Labelled label={t('Compact: first page')}>
                <Pagination
                    variant="compact"
                    page={1}
                    pageCount={7}
                    onPageChange={() => {}}
                />
            </Labelled>
            <Labelled
                label={t(
                    'Counter and page size: open the select to see the menu above, checked value',
                )}
            >
                <div className="rounded-xl border bg-card p-3 shadow-card">
                    <PageSizeBar
                        from={from}
                        to={to}
                        total={total}
                        pageSize={pageSize}
                        onPageSizeChange={(size) => {
                            setPageSize(size);
                            setCounterPage(1);
                        }}
                        onPrev={() => setCounterPage((p) => Math.max(1, p - 1))}
                        onNext={() => setCounterPage((p) => p + 1)}
                    />
                </div>
            </Labelled>
            <Labelled label={t('Counter: first page, Previous disabled')}>
                <div className="rounded-xl border bg-card p-3 shadow-card">
                    <PageSizeBar
                        from={1}
                        to={20}
                        total={total}
                        pageSize={20}
                        onPageSizeChange={() => {}}
                        onPrev={() => {}}
                        onNext={() => {}}
                    />
                </div>
            </Labelled>
            <Labelled label={t('Load more: idle')}>
                <div className="rounded-xl border bg-card shadow-card">
                    <LoadMoreFeed>
                        {rows.map((row) => (
                            <div
                                key={row}
                                className="border-b px-4 py-3 text-body-sm font-semibold"
                            >
                                {row}
                            </div>
                        ))}
                    </LoadMoreFeed>
                    <LoadMore
                        remaining={total - rows.length}
                        nextCount={20}
                        total={total}
                        loading={false}
                        onLoadMore={() => {}}
                    />
                </div>
            </Labelled>
            <Labelled label={t('Load more: loading')}>
                <LoadMore
                    remaining={80}
                    nextCount={20}
                    total={total}
                    loading
                    onLoadMore={() => {}}
                />
            </Labelled>
            <Labelled label={t('Load more: end of list')}>
                <LoadMore
                    remaining={0}
                    total={total}
                    loading={false}
                    onLoadMore={() => {}}
                    endLabel={t("You're all caught up · :total items", {
                        total,
                    })}
                />
            </Labelled>
        </div>
    );
}
