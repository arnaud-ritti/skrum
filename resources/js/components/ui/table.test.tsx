import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    Table,
    TableBody,
    TableBulkBar,
    TableCell,
    TableEmpty,
    TableHead,
    TableHeader,
    TableLoading,
    TableRow,
    TableSelectAll,
    TableCheckbox,
    TableSortHead,
} from '@/components/ui/table';
import { renderWithProviders } from '@/test/render';

describe('Table', () => {
    it('scrolls horizontally inside its own wrapper', () => {
        const { container } = renderWithProviders(
            <Table>
                <TableBody />
            </Table>,
        );

        const wrapper = container.querySelector(
            '[data-slot="table-container"]',
        );

        expect(wrapper?.className).toContain('overflow-x-auto');
        expect(wrapper?.querySelector('table')).not.toBeNull();
    });

    it('marks selected, done and late rows', () => {
        renderWithProviders(
            <Table>
                <TableBody>
                    <TableRow selected data-testid="a">
                        <TableCell>A</TableCell>
                    </TableRow>
                    <TableRow done late data-testid="b">
                        <TableCell>B</TableCell>
                    </TableRow>
                    <TableRow data-testid="c">
                        <TableCell>C</TableCell>
                    </TableRow>
                </TableBody>
            </Table>,
        );

        expect(screen.getByTestId('a').getAttribute('data-state')).toBe(
            'selected',
        );
        expect(screen.getByTestId('b').getAttribute('data-done')).toBe('true');
        expect(screen.getByTestId('b').getAttribute('data-late')).toBe('true');
        expect(screen.getByTestId('c').getAttribute('data-state')).toBeNull();
    });
});

describe('TableSortHead', () => {
    function renderHead(direction: 'asc' | 'desc' | null, onSort = vi.fn()) {
        renderWithProviders(
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableSortHead direction={direction} onSort={onSort}>
                            Due date
                        </TableSortHead>
                        <TableHead>Owner</TableHead>
                    </TableRow>
                </TableHeader>
            </Table>,
        );

        return onSort;
    }

    it.each([
        ['asc', 'ascending'],
        ['desc', 'descending'],
        [null, 'none'],
    ] as const)('exposes aria-sort for %s', (direction, expected) => {
        renderHead(direction);

        expect(
            screen
                .getByRole('columnheader', { name: 'Due date' })
                .getAttribute('aria-sort'),
        ).toBe(expected);
    });

    it('calls onSort from the button inside the header', () => {
        const onSort = renderHead(null);

        fireEvent.click(screen.getByRole('button', { name: 'Due date' }));

        expect(onSort).toHaveBeenCalledTimes(1);
    });

    it('reflects a changed direction on rerender', () => {
        const { rerender } = renderWithProviders(
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableSortHead direction="asc" onSort={vi.fn()}>
                            Title
                        </TableSortHead>
                    </TableRow>
                </TableHeader>
            </Table>,
        );

        rerender(
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableSortHead direction="desc" onSort={vi.fn()}>
                            Title
                        </TableSortHead>
                    </TableRow>
                </TableHeader>
            </Table>,
        );

        expect(
            screen.getByRole('columnheader').getAttribute('aria-sort'),
        ).toBe('descending');
    });
});

describe('selection', () => {
    it('shows the mixed state on select-all and reports a toggle', () => {
        const onChange = vi.fn();

        renderWithProviders(
            <TableSelectAll checked="indeterminate" onCheckedChange={onChange} />,
        );

        const box = screen.getByRole('checkbox', { name: 'Select all rows' });

        expect(box.getAttribute('aria-checked')).toBe('mixed');

        fireEvent.click(box);

        expect(onChange).toHaveBeenCalledWith(true);
    });

    it('reports unchecking a checked row box', () => {
        const onChange = vi.fn();

        renderWithProviders(
            <TableCheckbox
                checked
                onCheckedChange={onChange}
                aria-label="Select Isolate E2E data"
            />,
        );

        fireEvent.click(
            screen.getByRole('checkbox', { name: 'Select Isolate E2E data' }),
        );

        expect(onChange).toHaveBeenCalledWith(false);
    });
});

describe('TableBulkBar', () => {
    it('announces the count in a status and renders actions', () => {
        renderWithProviders(
            <TableBulkBar count={3}>
                <button type="button">Mark done</button>
            </TableBulkBar>,
        );

        expect(screen.getByRole('status').textContent).toBe('3 selected');
        expect(
            screen.getByRole('button', { name: 'Mark done' }),
        ).toBeTruthy();
    });

    it('uses the singular for one row and follows the count', () => {
        const { rerender } = renderWithProviders(<TableBulkBar count={1} />);

        expect(screen.getByRole('status').textContent).toBe('1 selected');

        rerender(<TableBulkBar count={12} />);

        expect(screen.getByRole('status').textContent).toBe('12 selected');
    });
});

describe('empty and loading', () => {
    it('renders a spanning empty cell with a default and a custom message', () => {
        const { container, rerender } = renderWithProviders(
            <Table>
                <TableBody>
                    <TableEmpty colSpan={4} />
                </TableBody>
            </Table>,
        );

        expect(screen.getByText('Nothing to show')).toBeTruthy();
        expect(container.querySelector('td')?.getAttribute('colspan')).toBe(
            '4',
        );

        rerender(
            <Table>
                <TableBody>
                    <TableEmpty colSpan={4}>No actions yet</TableEmpty>
                </TableBody>
            </Table>,
        );

        expect(screen.getByText('No actions yet')).toBeTruthy();
    });

    it('renders skeleton rows with one status announcement', () => {
        const { container } = renderWithProviders(
            <Table>
                <TableBody>
                    <TableLoading columns={3} rows={4} />
                </TableBody>
            </Table>,
        );

        expect(container.querySelectorAll('tr')).toHaveLength(4);
        expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(
            12,
        );
        expect(screen.getAllByRole('status')).toHaveLength(1);
    });
});
