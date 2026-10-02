import { fireEvent, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { TeamChart } from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import { renderWithProviders } from '@/test/render';

const config = {
    created: { label: 'Created', color: 'var(--chart-1)' },
    done: { label: 'Done', color: 'var(--chart-2)' },
} satisfies ChartConfig;

const data = [
    { sprint: 'S41', created: 8, done: 6 },
    { sprint: 'S42', created: 10, done: 9 },
    { sprint: 'S43', created: 5, done: 2 },
];

const size = { width: 600, height: 200 };

/*
 * jsdom has no layout: with a ResizeObserver, Recharts measures its container
 * (0 by 0) and drops `initialDimension`, so nothing is drawn.
 */
beforeAll(() => {
    vi.stubGlobal('ResizeObserver', undefined);
});

function renderChart(props: Partial<Parameters<typeof TeamChart>[0]> = {}) {
    return renderWithProviders(
        <TeamChart
            title="Actions per sprint"
            description="Last 3 sprints"
            data={data}
            config={config}
            kind="bar"
            xKey="sprint"
            initialDimension={size}
            {...props}
        />,
    );
}

describe('TeamChart', () => {
    it('exposes the data as a table on demand', () => {
        renderChart();

        expect(screen.queryByRole('table')).toBeNull();

        const toggle = screen.getByRole('button', { name: 'View the data' });
        expect(toggle.getAttribute('aria-expanded')).toBe('false');

        fireEvent.click(toggle);

        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(screen.getByRole('table')).toBeTruthy();
        expect(
            screen.getAllByRole('row').map((row) => row.textContent),
        ).toEqual(['sprintCreatedDone', 'S4186', 'S42109', 'S4352']);

        fireEvent.click(screen.getByRole('button', { name: 'Hide the data' }));
        expect(screen.queryByRole('table')).toBeNull();
    });

    it('appends the unit to table values and dashes missing ones', () => {
        renderChart({
            unit: 'pts',
            data: [{ sprint: 'S1', created: 3, done: null }],
        });

        fireEvent.click(screen.getByRole('button', { name: 'View the data' }));

        expect(screen.getAllByRole('row')[1].textContent).toBe('S13 pts-');
    });

    it('moves between periods with the arrow keys', () => {
        renderChart();

        const group = screen.getByRole('group');
        const status = screen.getByRole('status');

        expect(status.textContent).toBe('');

        fireEvent.keyDown(group, { key: 'ArrowRight' });
        expect(status.textContent).toBe('S41: Created 8, Done 6');

        fireEvent.keyDown(group, { key: 'ArrowRight' });
        fireEvent.keyDown(group, { key: 'ArrowRight' });
        fireEvent.keyDown(group, { key: 'ArrowRight' });
        expect(status.textContent).toBe('S43: Created 5, Done 2');

        fireEvent.keyDown(group, { key: 'ArrowLeft' });
        expect(status.textContent).toBe('S42: Created 10, Done 9');

        fireEvent.keyDown(group, { key: 'Escape' });
        expect(status.textContent).toBe('');
    });

    it('starts from the last period with the left arrow and clears on blur', () => {
        renderChart({ kind: 'line' });

        const group = screen.getByRole('group');

        fireEvent.keyDown(group, { key: 'ArrowLeft' });
        expect(screen.getByRole('status').textContent).toContain('S43');

        fireEvent.blur(group);
        expect(screen.getByRole('status').textContent).toBe('');
    });

    it('names the chart group with title and description', () => {
        renderChart();

        expect(
            screen.getByRole('group', {
                name: 'Actions per sprint. Last 3 sprints',
            }),
        ).toBeTruthy();
    });

    it('shows the empty state without data', () => {
        renderChart({ data: [] });

        expect(screen.getByText('Not enough sprints yet')).toBeTruthy();
        expect(screen.queryByRole('group')).toBeNull();
        expect(screen.queryByRole('button', { name: 'View the data' })).toBeNull();
    });

    it('shows a loading placeholder while loading', () => {
        renderChart({ loading: true });

        expect(screen.getByRole('status', { name: 'Loading chart' })).toBeTruthy();
        expect(screen.queryByRole('group')).toBeNull();
    });

    it('renders the legend with one entry per series, in config order', () => {
        const { container } = renderChart();

        const entries = Array.from(
            container.querySelectorAll('[data-slot="chart-legend"] li'),
        ).map((item) => item.textContent);

        expect(entries).toEqual(['Created', 'Done']);
    });

    it('keeps the legend free of the interrupted segment series', () => {
        const { container } = renderChart({
            kind: 'line',
            currentPeriod: 'S43',
        });

        expect(
            container.querySelectorAll('[data-slot="chart-legend"] li'),
        ).toHaveLength(2);
    });

    it('handles 200 periods and a single period', () => {
        const many = Array.from({ length: 200 }, (_, index) => ({
            sprint: `S${index}`,
            created: index,
            done: index,
        }));
        const { rerender } = renderChart({ data: many });

        fireEvent.click(screen.getByRole('button', { name: 'View the data' }));
        expect(screen.getAllByRole('row')).toHaveLength(201);

        rerender(
            <TeamChart
                title="Actions per sprint"
                description="Last 3 sprints"
                data={data.slice(0, 1)}
                config={config}
                kind="bar"
                xKey="sprint"
                initialDimension={size}
            />,
        );
        expect(screen.getAllByRole('row')).toHaveLength(2);
    });
});
