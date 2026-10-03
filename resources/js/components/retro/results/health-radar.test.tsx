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
        distribution: [0, 0, 0, 0, 0],
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
                    statement('Fun', 4),
                    statement('Vision', 3.5),
                    statement('Trust', 4.5),
                ]}
            />,
        );

        const radar = screen.getByRole('img', { name: 'Team health radar' });

        expect(screen.getByText('Vision')).toBeTruthy();
        expect(radar.querySelector('desc')?.textContent).toBe(
            'Fun: 4.0/5; Vision: 3.5/5; Trust: 4.5/5',
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
                    statement('Fun', 4),
                    statement('Speed', 3.3),
                    statement('Trust', null),
                    statement('Pace', 2),
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
