import { render, screen } from '@testing-library/react';
import { ListChecks } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { StatCard } from '@/components/skrum/stat-card';

describe('StatCard', () => {
    it('shows label, value and context', () => {
        render(
            <StatCard
                label="Actions done · 90 d"
                value="73 %"
                context="Atlas, last 90 days"
                icon={ListChecks}
            />,
        );

        expect(screen.getByText('Actions done · 90 d')).toBeTruthy();
        expect(screen.getByText('73 %')).toBeTruthy();
        expect(screen.getByText('Atlas, last 90 days')).toBeTruthy();
    });

    it('writes the trend direction in text and colours it by good', () => {
        const { rerender } = render(
            <StatCard
                label="L"
                value="1"
                context="c"
                trend={{ direction: 'up', label: '+8 pts', good: true }}
            />,
        );

        expect(screen.getByText('Up')).toBeTruthy();
        expect(screen.getByText(/\+8 pts/)).toBeTruthy();
        expect(
            document.querySelector('[data-slot="stat-card-trend"]')?.className,
        ).toContain('text-skrum-success-text');

        rerender(
            <StatCard
                label="L"
                value="1"
                context="c"
                trend={{
                    direction: 'up',
                    label: '1 since Monday',
                    good: false,
                }}
            />,
        );

        expect(
            document.querySelector('[data-slot="stat-card-trend"]')?.className,
        ).toContain('text-skrum-destructive-text');

        rerender(
            <StatCard
                label="L"
                value="1"
                context="c"
                trend={{ direction: 'down', label: '2 pts', good: true }}
            />,
        );

        expect(screen.getByText('Down')).toBeTruthy();
    });

    it('renders the sparkline hidden from assistive tech, only with two points or more', () => {
        const { rerender } = render(
            <StatCard label="L" value="1" context="c" series={[1, 3, 2]} />,
        );
        const spark = document.querySelector(
            '[data-slot="stat-card-sparkline"]',
        );

        expect(spark?.getAttribute('aria-hidden')).toBe('true');
        expect(
            spark?.querySelector('polyline')?.getAttribute('points'),
        ).toMatch(/^0\.00,/);

        rerender(<StatCard label="L" value="1" context="c" series={[4]} />);

        expect(
            document.querySelector('[data-slot="stat-card-sparkline"]'),
        ).toBeNull();
    });

    it('draws a flat series without NaN', () => {
        render(<StatCard label="L" value="1" context="c" series={[2, 2, 2]} />);

        expect(
            document.querySelector('polyline')?.getAttribute('points'),
        ).not.toContain('NaN');
    });

    it('omits the trend and icon when absent', () => {
        render(<StatCard label="L" value="1" context="c" />);

        expect(
            document.querySelector('[data-slot="stat-card-trend"]'),
        ).toBeNull();
    });
});
