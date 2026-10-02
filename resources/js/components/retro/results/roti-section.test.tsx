import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RotiSection } from '@/components/retro/results/roti-section';
import type { RotiResults } from '@/lib/retro/types';
import { boardContext, renderInBoard, retroSnapshot } from '@/test/retro-board';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

const results: RotiResults = {
    distribution: [1, 2, 3, 4, 5].map((score) => ({
        score,
        count: score === 4 ? 2 : 0,
    })),
    average: 4,
    respondents: 2,
};

function section(canVote: boolean) {
    return renderInBoard(
        <RotiSection roti={results} />,
        boardContext(
            retroSnapshot({
                retro: { phase: 'completed' },
                roti: {
                    myScore: 4,
                    respondents: 2,
                    voterIds: ['me', 'bob'],
                    canVote,
                },
            }),
        ),
    );
}

describe('RotiSection', () => {
    it('shows the results alone on a retro that went through the ROTI phase', () => {
        section(false);

        expect(screen.getByText('Average: 4.0/5')).toBeTruthy();
        expect(screen.getByText('2 ratings')).toBeTruthy();
        expect(
            screen.queryByRole('group', { name: 'How was this retro?' }),
        ).toBeNull();
    });

    it('still takes a rating on a retro completed before the ROTI phase existed', () => {
        section(true);

        expect(
            screen
                .getByRole('group', { name: 'How was this retro?' })
                .querySelector('button[aria-pressed="true"]')?.textContent,
        ).toContain('Good use of time');
        expect(screen.getByText('2 ratings')).toBeTruthy();
    });
});
