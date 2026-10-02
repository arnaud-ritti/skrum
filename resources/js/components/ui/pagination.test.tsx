import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    LoadMore,
    PageSizeBar,
    Pagination,
    buildPageItems,
} from '@/components/ui/pagination';
import { renderWithProviders } from '@/test/render';

describe('buildPageItems', () => {
    it('collapses the far side from the first pages', () => {
        expect(buildPageItems(3, 7)).toEqual([
            1,
            2,
            3,
            4,
            5,
            'end-ellipsis',
            7,
        ]);
    });

    it('collapses both sides in the middle', () => {
        expect(buildPageItems(4, 7)).toEqual([
            1,
            'start-ellipsis',
            3,
            4,
            5,
            'end-ellipsis',
            7,
        ]);
    });

    it('collapses the near side on the last pages', () => {
        expect(buildPageItems(7, 7)).toEqual([
            1,
            'start-ellipsis',
            3,
            4,
            5,
            6,
            7,
        ]);
    });

    it('lists every page when there are few', () => {
        expect(buildPageItems(2, 4)).toEqual([1, 2, 3, 4]);
    });

    it('widens the window with siblingCount', () => {
        expect(buildPageItems(10, 20, 2)).toEqual([
            1,
            'start-ellipsis',
            8,
            9,
            10,
            11,
            12,
            'end-ellipsis',
            20,
        ]);
    });
});

describe('Pagination', () => {
    it('is a labelled navigation with named page links', () => {
        renderWithProviders(
            <Pagination page={3} pageCount={7} onPageChange={vi.fn()} />,
        );

        expect(
            screen.getByRole('navigation', { name: 'Pagination' }),
        ).toBeTruthy();
        expect(screen.getByLabelText('Go to page 4')).toBeTruthy();
    });

    it('calls onPageChange for pages and edges', () => {
        const onPageChange = vi.fn();
        renderWithProviders(
            <Pagination page={4} pageCount={9} onPageChange={onPageChange} />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Next' }));
        fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
        fireEvent.click(screen.getByText('9'));

        expect(onPageChange.mock.calls).toEqual([[5], [3], [9]]);
    });

    it('keeps disabled edges in the DOM and inert', () => {
        const onPageChange = vi.fn();
        renderWithProviders(
            <Pagination page={1} pageCount={5} onPageChange={onPageChange} />,
        );

        const previous = screen.getByLabelText('Previous');

        expect(previous.getAttribute('aria-disabled')).toBe('true');

        fireEvent.click(previous);

        expect(onPageChange).not.toHaveBeenCalled();
    });

    it('flags the current page with aria-current', () => {
        renderWithProviders(
            <Pagination page={2} pageCount={4} onPageChange={vi.fn()} />,
        );

        const current = document.querySelector('[aria-current="page"]');

        expect(current?.textContent).toBe('2');
    });

    it('renders links when getHref is given', () => {
        renderWithProviders(
            <Pagination
                page={2}
                pageCount={4}
                onPageChange={vi.fn()}
                getHref={(p) => `/items?page=${p}`}
            />,
        );

        expect(screen.getByText('3').closest('a')?.getAttribute('href')).toBe(
            '/items?page=3',
        );
    });

    it('compact variant shows the position and steps', () => {
        const onPageChange = vi.fn();
        renderWithProviders(
            <Pagination
                variant="compact"
                page={3}
                pageCount={7}
                onPageChange={onPageChange}
            />,
        );

        expect(screen.getByText('Page 3 of 7')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'First page' }));
        fireEvent.click(screen.getByRole('button', { name: 'Last page' }));

        expect(onPageChange.mock.calls).toEqual([[1], [7]]);
    });

    it('acts as a plain nav root with children', () => {
        renderWithProviders(<Pagination>content</Pagination>);

        expect(screen.getByRole('navigation').textContent).toBe('content');
    });
});

describe('PageSizeBar', () => {
    const base = {
        from: 21,
        to: 40,
        total: 128,
        pageSize: 20 as const,
        onPageSizeChange: vi.fn(),
    };

    it('announces the range politely and wires the arrows', () => {
        const onPrev = vi.fn();
        const onNext = vi.fn();
        renderWithProviders(
            <PageSizeBar {...base} onPrev={onPrev} onNext={onNext} />,
        );

        expect(
            document.querySelector('[aria-live="polite"]')?.textContent,
        ).toContain('21–40');

        fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
        fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

        expect(onPrev).toHaveBeenCalledTimes(1);
        expect(onNext).toHaveBeenCalledTimes(1);
        expect(
            screen.getByRole('combobox', { name: 'Rows per page' }).textContent,
        ).toBe('20');
    });

    it('disables the arrows at both ends', () => {
        const onPrev = vi.fn();
        const onNext = vi.fn();
        renderWithProviders(
            <PageSizeBar
                {...base}
                from={1}
                to={128}
                onPrev={onPrev}
                onNext={onNext}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
        fireEvent.click(screen.getByRole('button', { name: 'Next page' }));

        expect(onPrev).not.toHaveBeenCalled();
        expect(onNext).not.toHaveBeenCalled();
    });
});

describe('LoadMore', () => {
    it('loads more with the remaining count', () => {
        const onLoadMore = vi.fn();
        renderWithProviders(
            <LoadMore
                remaining={20}
                total={128}
                loading={false}
                onLoadMore={onLoadMore}
            />,
        );

        expect(screen.getByText('20 more')).toBeTruthy();
        expect(screen.getByText('Load more').className).toContain('truncate');
        expect(
            screen
                .getByRole('button', { name: /Load more/ })
                .className.split(/\s+/),
        ).toContain('min-w-0');

        fireEvent.click(screen.getByRole('button', { name: /Load more/ }));

        expect(onLoadMore).toHaveBeenCalledTimes(1);
    });

    it('is busy and inert while loading', () => {
        const onLoadMore = vi.fn();
        renderWithProviders(
            <LoadMore
                remaining={20}
                total={128}
                loading
                onLoadMore={onLoadMore}
            />,
        );

        const button = screen.getByRole('button', { name: 'Loading…' });

        expect(button.getAttribute('aria-busy')).toBe('true');

        fireEvent.click(button);

        expect(onLoadMore).not.toHaveBeenCalled();
    });

    it('shows the end label and no button when nothing remains', () => {
        renderWithProviders(
            <LoadMore
                remaining={0}
                total={128}
                loading={false}
                onLoadMore={vi.fn()}
                endLabel="All done"
            />,
        );

        expect(screen.queryByRole('button')).toBeNull();
        expect(screen.getByText('All done')).toBeTruthy();
    });
});
