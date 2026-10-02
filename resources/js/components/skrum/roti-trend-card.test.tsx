import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RotiTrendCard } from '@/components/skrum/roti-trend-card';
import type { RotiTrendPoint } from '@/components/skrum/roti-trend-card';
import { renderWithProviders } from '@/test/render';

function makePoints(means: number[]): RotiTrendPoint[] {
    return means.map((mean, index) => ({
        id: `retro-${index}`,
        label: `Aug ${index + 1}`,
        title: `Sprint ${35 + index}`,
        mean,
    }));
}

const eight = makePoints([3.2, 3.5, 3.1, 3.6, 3.9, 3.4, 3.8, 4.1]);

function slot(container: HTMLElement, name: string): Element | null {
    return container.querySelector(`[data-slot="${name}"]`);
}

describe('RotiTrendCard', () => {
    it('is a region named "Mood trend" that says what is plotted', () => {
        renderWithProviders(<RotiTrendCard points={eight} />);

        const region = screen.getByRole('region', { name: 'Mood trend' });

        expect(region.textContent).toContain(
            'Average ROTI at the end of the retro, out of 5',
        );
        expect(
            screen.getByRole('heading', { level: 2, name: 'Mood trend' }),
        ).toBeTruthy();
    });

    it('draws one filled curve, one dot per retro, the last one larger', () => {
        const { container } = renderWithProviders(
            <RotiTrendCard points={eight} />,
        );
        const dots = container.querySelectorAll(
            '[data-slot="roti-trend-point"]',
        );

        expect(slot(container, 'roti-trend-area')).not.toBeNull();
        expect(slot(container, 'roti-trend-line')).not.toBeNull();
        expect(dots).toHaveLength(8);
        expect(dots[0].getAttribute('r')).toBe('3');
        expect(dots[7].getAttribute('r')).toBe('4.5');
    });

    it('writes the last value in a bubble and the change since the first point in a badge', () => {
        const { container } = renderWithProviders(
            <RotiTrendCard points={eight} />,
        );

        expect(slot(container, 'roti-trend-bubble')?.textContent).toBe(
            '4.1 / 5',
        );
        expect(slot(container, 'roti-trend-delta')?.textContent).toBe(
            '+0.9 since Aug 1',
        );
    });

    it('says a falling trend as such', () => {
        const { container } = renderWithProviders(
            <RotiTrendCard points={makePoints([4, 3.5])} />,
        );

        expect(slot(container, 'roti-trend-delta')?.textContent).toBe(
            '−0.5 since Aug 1',
        );
    });

    it('names the chart for assistive technology with its first and last values, and each dot with its retro', () => {
        const { container } = renderWithProviders(
            <RotiTrendCard points={eight} />,
        );

        expect(
            screen.getByRole('img', {
                name: 'Average ROTI per retro, from 3.2 (Aug 1) to 4.1 (Aug 8)',
            }),
        ).toBeTruthy();
        expect(
            container.querySelector('[data-slot="roti-trend-point"] title')
                ?.textContent,
        ).toBe('Sprint 35 · 3.2 / 5');
    });

    it('lists every retro with its value for assistive technology, beside the chart', () => {
        renderWithProviders(<RotiTrendCard points={eight} />);

        const items = screen.getAllByRole('listitem');

        expect(items).toHaveLength(8);
        expect(items[0].textContent).toBe('Sprint 35 · 3.2 / 5');
        expect(items[3].textContent).toBe('Sprint 38 · 3.6 / 5');
        expect(items[7].textContent).toBe('Sprint 42 · 4.1 / 5');
    });

    it('keeps the label of the last retro when the labels would collide', () => {
        const { container } = renderWithProviders(
            <RotiTrendCard points={makePoints(Array(20).fill(3))} />,
        );
        const labels = Array.from(
            container.querySelectorAll('[data-slot="roti-trend-label"]'),
        ).map((label) => label.textContent);

        expect(labels.length).toBeLessThan(20);
        expect(labels.at(-1)).toBe('Aug 20');
    });

    it('shows one dot and its value, without a curve or a change, for a single retro', () => {
        const { container } = renderWithProviders(
            <RotiTrendCard points={makePoints([3.4])} />,
        );

        expect(
            container.querySelectorAll('[data-slot="roti-trend-point"]'),
        ).toHaveLength(1);
        expect(slot(container, 'roti-trend-line')).toBeNull();
        expect(slot(container, 'roti-trend-delta')).toBeNull();
        expect(slot(container, 'roti-trend-bubble')?.textContent).toBe(
            '3.4 / 5',
        );
    });

    it('says so when no retro has a ROTI', () => {
        const { container } = renderWithProviders(
            <RotiTrendCard points={[]} />,
        );

        expect(slot(container, 'roti-trend-empty')?.textContent).toBe(
            'No ROTI results yet.',
        );
        expect(slot(container, 'roti-trend-chart')).toBeNull();
    });
});
