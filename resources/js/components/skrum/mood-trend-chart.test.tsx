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

    describe('with the health trend the application has today', () => {
        const trend: MoodPoint[] = [
            {
                id: 'r1',
                sprint: 'Sprint 40 retro',
                mean: 6.2,
                href: '/retros/r1',
            },
            {
                id: 'r2',
                sprint: 'Sprint 41 retro',
                mean: 7.1,
                href: '/retros/r2',
                note: 'The statements changed since the previous retro',
            },
            {
                id: 'r3',
                sprint: 'Sprint 41 retro',
                mean: 8.4,
                href: '/retros/r3',
            },
        ];
        const health = (
            <MoodTrendChart
                points={trend}
                title="Trend across retros"
                metricLabel="Health score"
                scale={{ min: 0, max: 10 }}
                period="retro"
                deltaSincePrevious={1.3}
                noteLegend="Statements changed"
            />
        );

        it('plots a 0 to 10 score without quartiles, voters or ROTI wording', () => {
            const { container } = renderWithProviders(health);

            expect(dots(container)).toHaveLength(3);
            expect(
                container.querySelector('[data-slot="mood-trend-line"]'),
            ).not.toBeNull();
            expect(
                container.querySelector('[data-slot="mood-trend-band"]'),
            ).toBeNull();
            expect(
                container.querySelector('[data-slot="mood-trend-threshold"]'),
            ).toBeNull();
            expect(
                screen.getByRole('heading', { name: 'Trend across retros' }),
            ).toBeTruthy();
            expect(
                container.querySelector('[data-slot="mood-trend-kpi"]')
                    ?.textContent,
            ).toMatch(/8[.,]4\/10/);
            expect(
                container.querySelector('[data-slot="mood-trend-delta"]')
                    ?.textContent,
            ).toMatch(/\+1[.,]3 since the previous retro/);
            expect(screen.queryByText(/ROTI/)).toBeNull();
            expect(screen.queryByText(/Voters/)).toBeNull();
            expect(screen.queryByText('Spread (Q1–Q3)')).toBeNull();
            expect(screen.getByRole('tab', { name: '4 retros' })).toBeTruthy();
            expect(screen.getByText('Statements changed')).toBeTruthy();

            const levels = Array.from(
                container.querySelectorAll('[data-slot="mood-trend-level"]'),
            ).map((level) => level.textContent);

            expect(levels).toEqual(['0', '2', '4', '6', '8', '10']);
        });

        it('places the links in percent of the plot, so they follow the scaled drawing', () => {
            renderWithProviders(health);

            screen.getAllByRole('link').forEach((link) => {
                const left = (link as HTMLElement).style.left;
                const top = (link as HTMLElement).style.top;

                expect(left).toMatch(/%$/);
                expect(top).toMatch(/%$/);
                expect(Number.parseFloat(left)).toBeGreaterThanOrEqual(0);
                expect(Number.parseFloat(left)).toBeLessThanOrEqual(100);
                expect(Number.parseFloat(top)).toBeGreaterThanOrEqual(0);
                expect(Number.parseFloat(top)).toBeLessThanOrEqual(100);
            });
        });

        it('links every point to its retro and draws a noted point hollow', () => {
            const { container } = renderWithProviders(health);
            const links = screen.getAllByRole('link');

            expect(links.map((link) => link.getAttribute('href'))).toEqual([
                '/retros/r1',
                '/retros/r2',
                '/retros/r3',
            ]);
            expect(links[1].getAttribute('aria-label')).toContain(
                'The statements changed since the previous retro',
            );
            expect(
                container.querySelectorAll(
                    '[data-slot="mood-trend-point"][data-hollow]',
                ),
            ).toHaveLength(1);

            fireEvent.focus(links[2]);

            expect(
                container.querySelector('[data-slot="mood-trend-live"]')
                    ?.textContent,
            ).toMatch(/Sprint 41 retro: Health score 8[.,]4\/10/);
        });

        it('hides the badge when the server sends no delta', () => {
            const { container } = renderWithProviders(
                <MoodTrendChart
                    points={trend}
                    title="Trend across retros"
                    scale={{ min: 0, max: 10 }}
                    deltaSincePrevious={null}
                />,
            );

            expect(
                container.querySelector('[data-slot="mood-trend-delta"]'),
            ).toBeNull();
        });

        it('lists the same data in the table, with links and notes', () => {
            renderWithProviders(health);

            fireEvent.click(
                screen.getByRole('button', { name: 'View as table' }),
            );

            const table = screen.getByRole('table');

            expect(
                within(table)
                    .getAllByRole('columnheader')
                    .map((header) => header.textContent),
            ).toEqual(['Retro', 'Health score', 'Note']);
            expect(
                within(table)
                    .getAllByRole('link', { name: 'Sprint 41 retro' })
                    .map((link) => link.getAttribute('href')),
            ).toEqual(['/retros/r2', '/retros/r3']);
        });
    });

    it('copes with one point, 200 points and 60-character labels', () => {
        const name =
            'Quarterly platform reliability retrospective number '.padEnd(
                60,
                'x',
            );
        const many: MoodPoint[] = Array.from({ length: 200 }, (_, index) => ({
            id: `r${index}`,
            sprint: `${name}${index}`,
            mean: 1 + (index % 5),
        }));
        const { container, rerender } = renderWithProviders(
            <MoodTrendChart team="Atlas" points={many.slice(0, 1)} />,
        );

        expect(dots(container)).toHaveLength(1);

        rerender(<MoodTrendChart team="Atlas" points={many} range="all" />);

        expect(dots(container)).toHaveLength(200);

        const labels = container.querySelectorAll(
            '[data-slot="mood-trend-x-label"]',
        );

        expect(labels.length).toBeLessThan(12);
        labels.forEach((label) => {
            expect((label.textContent ?? '').length).toBeLessThanOrEqual(20);
        });
    });

    it('never draws two x labels over each other, the pinned last one included', () => {
        const many: MoodPoint[] = Array.from({ length: 200 }, (_, index) => ({
            id: `r${index}`,
            sprint: `Quarterly platform reliability retrospective ${index}`,
            mean: 1 + (index % 5),
        }));
        const { container } = renderWithProviders(
            <MoodTrendChart team="Atlas" points={many} range="all" />,
        );
        const spans = Array.from(
            container.querySelectorAll('[data-slot="mood-trend-x-label"]'),
        ).map((label) => {
            const x = Number(label.getAttribute('x'));
            const textWidth = (label.textContent ?? '').length * 6.5;

            return label.getAttribute('text-anchor') === 'end'
                ? [x - textWidth, x]
                : [x - textWidth / 2, x + textWidth / 2];
        });

        expect(spans.length).toBeGreaterThan(1);
        spans.forEach(([left, right], index) => {
            spans.slice(index + 1).forEach(([otherLeft, otherRight]) => {
                expect(left >= otherRight || right <= otherLeft).toBe(true);
            });
        });
    });

    it('adds a point when a new sprint arrives', () => {
        const { container, rerender } = renderWithProviders(
            <MoodTrendChart team="Atlas" points={makePoints(5)} />,
        );

        rerender(<MoodTrendChart team="Atlas" points={makePoints(6)} />);

        expect(dots(container)).toHaveLength(6);
    });
});
