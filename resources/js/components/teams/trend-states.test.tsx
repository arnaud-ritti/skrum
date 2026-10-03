import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeferredTrend } from '@/components/teams/trend-states';
import type { TrendState } from '@/components/teams/trend-states';
import { renderWithProviders } from '@/test/render';
import type { TeamMoodPoint } from '@/types';

const mocks = vi.hoisted(() => ({
    reload: vi.fn(),
    received: false,
    rescued: false,
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: { translations: {}, locale: 'en' } }),
        router: { reload: mocks.reload },
        Deferred: ({
            fallback,
            rescue,
            children,
        }: {
            fallback: () => React.ReactNode;
            rescue: React.ReactNode;
            children: React.ReactNode;
        }) => {
            if (mocks.rescued) {
                return <>{rescue}</>;
            }

            return <>{mocks.received ? children : fallback()}</>;
        },
    };
});

const point: TeamMoodPoint = {
    retroId: '42',
    surveyId: null,
    title: 'Sprint 42',
    completedAt: '2026-09-01T10:00:00+00:00',
    url: '/retros/42',
    mood: 7,
    moodVoters: 3,
    roti: 4,
    rotiVoters: 3,
};

function Probe({ trend, failed, onRetry }: TrendState) {
    if (failed) {
        return (
            <button type="button" onClick={onRetry}>
                failed
            </button>
        );
    }

    return (
        <p data-probe>
            {trend === undefined ? 'loading' : `${trend.length} points`}
        </p>
    );
}

function probe(trend?: TeamMoodPoint[] | null) {
    return (
        <DeferredTrend trend={trend}>
            {(state) => <Probe {...state} />}
        </DeferredTrend>
    );
}

beforeEach(() => {
    mocks.reload.mockReset();
    mocks.received = false;
    mocks.rescued = false;
});

describe('the deferred trend of a team', () => {
    it('is loading until the trend arrives, then gives it', () => {
        const { container, rerender } = renderWithProviders(probe());

        expect(container.querySelector('[data-probe]')?.textContent).toBe(
            'loading',
        );

        mocks.received = true;
        rerender(probe([point]));

        expect(container.querySelector('[data-probe]')?.textContent).toBe(
            '1 points',
        );
    });

    it('keeps the last trend received while it is fetched again', () => {
        mocks.received = true;
        const { container, rerender } = renderWithProviders(probe([point]));

        mocks.received = false;
        rerender(probe());

        expect(container.querySelector('[data-probe]')?.textContent).toBe(
            '1 points',
        );
    });

    it('gives the failed state when the server could not build the trend, and fetches the trend alone on a retry', async () => {
        mocks.rescued = true;
        renderWithProviders(probe(null));

        await userEvent.click(screen.getByRole('button', { name: 'failed' }));

        expect(mocks.reload).toHaveBeenCalledTimes(1);
        expect(mocks.reload).toHaveBeenCalledWith({ only: ['moodTrend'] });
    });
});
