import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MoodTrendChart } from '@/components/skrum/mood-trend-chart';
import type { MoodPoint } from '@/components/skrum/mood-trend-chart';
import { renderWithProviders } from '@/test/render';

function makePoints(count: number): MoodPoint[] {
    return Array.from({ length: count }, (_, index) => ({
        sprint: `S${30 + index}`,
        mean: 2.5 + (index % 4) * 0.5,
        q1: 2,
        q3: 4,
        voters: 8 + index,
    }));
}

function dots(container: HTMLElement) {
    return container.querySelectorAll('[data-slot="mood-trend-point"]');
}

describe('MoodTrendChart', () => {
    it('draws line, band, threshold and one dot per sprint', () => {
        const { container } = renderWithProviders(
            <MoodTrendChart team="Atlas" points={makePoints(8)} />,
        );

        expect(dots(container)).toHaveLength(8);
        expect(
            container.querySelector('[data-slot="mood-trend-line"]'),
        ).not.toBeNull();
        expect(
            container.querySelector('[data-slot="mood-trend-band"]'),
        ).not.toBeNull();
        expect(
            container.querySelector('[data-slot="mood-trend-threshold"]'),
        ).not.toBeNull();
    });

    it('lists every value in the svg description', () => {
        renderWithProviders(
            <MoodTrendChart team="Atlas" points={makePoints(3)} />,
        );

        const svg = screen.getByRole('img');
        const description = svg.querySelector('desc')?.textContent ?? '';

        expect(description).toContain('S30');
        expect(description).toContain('S32');
        expect(svg.querySelector('title')?.textContent).toBe(
            'Average ROTI per sprint, S30 to S32',
        );
    });

    it('shows points without line, band or trend badge under three sprints', () => {
        const { container } = renderWithProviders(
            <MoodTrendChart team="Atlas" points={makePoints(2)} />,
        );

        expect(dots(container)).toHaveLength(2);
        expect(
            container.querySelector('[data-slot="mood-trend-line"]'),
        ).toBeNull();
        expect(
            container.querySelector('[data-slot="mood-trend-band"]'),
        ).toBeNull();
        expect(
            screen.getByText(
                'Not enough data for a trend yet. It appears from 3 sprints.',
            ),
        ).toBeTruthy();
    });

    it('renders an empty message and no KPI without points', () => {
        const { container } = renderWithProviders(
            <MoodTrendChart team="Atlas" points={[]} />,
        );

        expect(screen.getByText('No ROTI results yet.')).toBeTruthy();
        expect(
            container.querySelector('[data-slot="mood-trend-kpi"]'),
        ).toBeNull();
    });

    it('shows the last sprint as KPI and the delta since the first shown', () => {
        const points: MoodPoint[] = [
            { sprint: 'S1', mean: 3, q1: 2, q3: 4, voters: 5 },
            { sprint: 'S2', mean: 3.2, q1: 2, q3: 4, voters: 5 },
            { sprint: 'S3', mean: 3.8, q1: 2, q3: 4, voters: 5 },
        ];
        const { container } = renderWithProviders(
            <MoodTrendChart team="Atlas" points={points} />,
        );

        expect(
            container.querySelector('[data-slot="mood-trend-kpi"]')
                ?.textContent,
        ).toMatch(/3[.,]8/);
        expect(
            container.querySelector('[data-slot="mood-trend-delta"]')
                ?.textContent,
        ).toMatch(/\+0[.,]8 since S1/);
    });

    it('uses the destructive badge when the mean went down', () => {
        const points: MoodPoint[] = [
            { sprint: 'S1', mean: 4, q1: 2, q3: 4, voters: 5 },
            { sprint: 'S2', mean: 3, q1: 2, q3: 4, voters: 5 },
        ];
        const { container } = renderWithProviders(
            <MoodTrendChart team="Atlas" points={points} />,
        );

        expect(
            container.querySelector('[data-slot="mood-trend-delta"]')
                ?.textContent,
        ).toMatch(/−1[.,]0 since S1/);
    });

    it('limits points by range and reports range changes', () => {
        const onRangeChange = vi.fn();
        const { container } = renderWithProviders(
            <MoodTrendChart
                team="Atlas"
                points={makePoints(12)}
                range="4"
                onRangeChange={onRangeChange}
            />,
        );

        expect(dots(container)).toHaveLength(4);

        const tab = screen.getByRole('tab', { name: 'All' });
        fireEvent.mouseDown(tab);
        fireEvent.click(tab);

        expect(onRangeChange).toHaveBeenCalledWith('all');
    });

    it('switches range on its own when uncontrolled', () => {
        const { container } = renderWithProviders(
            <MoodTrendChart team="Atlas" points={makePoints(12)} />,
        );

        expect(dots(container)).toHaveLength(8);

        const tab = screen.getByRole('tab', { name: '4 sprints' });
        fireEvent.mouseDown(tab);
        fireEvent.click(tab);

        expect(dots(container)).toHaveLength(4);
    });

    it('moves the crosshair with the arrow keys and announces it', () => {
        const { container } = renderWithProviders(
            <MoodTrendChart team="Atlas" points={makePoints(5)} />,
        );
        const svg = screen.getByRole('img');
        const live = container.querySelector('[data-slot="mood-trend-live"]');

        fireEvent.focus(svg);
        expect(live?.textContent).toContain('S34');

        fireEvent.keyDown(svg, { key: 'ArrowLeft' });
        expect(live?.textContent).toContain('S33');

        fireEvent.keyDown(svg, { key: 'Home' });
        expect(live?.textContent).toContain('S30');

        fireEvent.keyDown(svg, { key: 'ArrowLeft' });
        expect(live?.textContent).toContain('S30');

        fireEvent.keyDown(svg, { key: 'End' });
        fireEvent.keyDown(svg, { key: 'ArrowRight' });
        expect(live?.textContent).toContain('S34');
        expect(
            container.querySelector('[data-slot="mood-trend-crosshair"]'),
        ).not.toBeNull();

        fireEvent.keyDown(svg, { key: 'Escape' });
        expect(
            container.querySelector('[data-slot="mood-trend-crosshair"]'),
        ).toBeNull();
    });

    it('shows the tooltip with mean, spread and voters on hover', () => {
        const { container } = renderWithProviders(
            <MoodTrendChart team="Atlas" points={makePoints(5)} />,
        );
        const hits = container.querySelectorAll('[data-slot="mood-trend-hit"]');

        fireEvent.mouseEnter(hits[1]);

        const tooltip = container.querySelector(
            '[data-slot="mood-trend-tooltip"]',
        ) as HTMLElement;

        expect(within(tooltip).getByText('Sprint S31')).toBeTruthy();
        expect(within(tooltip).getByText('9')).toBeTruthy();

        fireEvent.mouseLeave(screen.getByRole('img'));
        expect(
            container.querySelector('[data-slot="mood-trend-tooltip"]'),
        ).toBeNull();
    });

    it('draws annotations only for visible sprints', () => {
        const { container } = renderWithProviders(
            <MoodTrendChart
                team="Atlas"
                points={makePoints(8)}
                range="4"
                annotations={[
                    {
                        sprint: 'S37',
                        title: 'Hard release',
                        detail: '3 actions',
                    },
                    { sprint: 'S30', title: 'Out of range' },
                ]}
            />,
        );

        expect(screen.getByText('Hard release')).toBeTruthy();
        expect(screen.queryByText('Out of range')).toBeNull();
        expect(
            container.querySelectorAll('[data-slot="mood-trend-annotation"]'),
        ).toHaveLength(1);
    });

    it('opens an equivalent table and goes back to the chart', () => {
        const { container } = renderWithProviders(
            <MoodTrendChart team="Atlas" points={makePoints(4)} />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'View as table' }));

        const table = screen.getByRole('table');

        expect(within(table).getAllByRole('row')).toHaveLength(5);
        expect(
            within(table).getByRole('rowheader', { name: 'S33' }),
        ).toBeTruthy();
        expect(container.querySelector('svg[role="img"]')).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: 'View as chart' }));

        expect(screen.queryByRole('table')).toBeNull();
        expect(screen.getByRole('img')).toBeTruthy();
    });

    it('adds a point when a new sprint arrives', () => {
        const { container, rerender } = renderWithProviders(
            <MoodTrendChart team="Atlas" points={makePoints(5)} />,
        );

        rerender(<MoodTrendChart team="Atlas" points={makePoints(6)} />);

        expect(dots(container)).toHaveLength(6);
    });
});
