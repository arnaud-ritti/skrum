import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    HealthRadar,
    formatScore,
} from '@/components/retro/results/health-radar';
import type { HealthStatementResult } from '@/lib/retro/types';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {} } }),
}));

function statement(key: string, average: number | null): HealthStatementResult {
    return {
        key,
        label: key,
        text: key,
        isBuiltin: true,
        average,
        count: average === null ? 0 : 3,
        previousAverage: null,
    };
}

describe('HealthRadar', () => {
    it('formats a score with one decimal', () => {
        expect(formatScore(7)).toBe('7.0');
    });

    it('draws one filled shape and a point per statement when all are answered', () => {
        const { container } = render(
            <HealthRadar
                statements={[
                    statement('Fun', 8),
                    statement('Speed', 6.5),
                    statement('Trust', 9),
                ]}
            />,
        );

        const radar = screen.getByRole('img', { name: 'Team health radar' });

        expect(radar.querySelector('desc')?.textContent).toBe(
            'Fun: 8.0/10; Speed: 6.5/10; Trust: 9.0/10',
        );
        expect(
            container.querySelectorAll('polygon.fill-primary\\/20'),
        ).toHaveLength(1);
        expect(container.querySelectorAll('circle')).toHaveLength(3);
        expect(screen.queryByText('No answers')).toBeNull();
    });

    it('draws only the segments between answered neighbours and labels the gap', () => {
        const { container } = render(
            <HealthRadar
                statements={[
                    statement('Fun', 8),
                    statement('Speed', 6.5),
                    statement('Trust', null),
                    statement('Pace', 4),
                ]}
            />,
        );

        expect(
            container.querySelectorAll('polygon.fill-primary\\/20'),
        ).toHaveLength(0);
        expect(container.querySelectorAll('line.stroke-primary')).toHaveLength(
            2,
        );
        expect(container.querySelectorAll('circle')).toHaveLength(3);
        expect(screen.getByText('No answers')).toBeTruthy();
        expect(container.querySelector('desc')?.textContent).toContain(
            'Trust: No answers',
        );
    });
});
