import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BoardEnded } from '@/components/retro/board-ended';
import { renderWithProviders } from '@/test/render';

describe('BoardEnded', () => {
    it('tells a member the retro was deleted and leads back to the team', () => {
        renderWithProviders(
            <BoardEnded
                reason="deleted"
                title="Sprint 42"
                teamUrl="/teams/t1"
            />,
        );

        expect(
            screen.getByText('This retrospective has been deleted.'),
        ).toBeTruthy();
        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
            'Sprint 42',
        );
        expect(
            screen
                .getAllByRole('link', { name: 'Back to the team' })
                .some((link) => link.getAttribute('href') === '/teams/t1'),
        ).toBe(true);
        expect(document.querySelectorAll('[data-realtime]')).toHaveLength(1);
    });

    it('tells a guest their access ended, without a way back', () => {
        renderWithProviders(
            <BoardEnded reason="ended" title="Sprint 42" teamUrl={null} />,
        );

        expect(
            screen.getByText('Your access to this retrospective has ended.'),
        ).toBeTruthy();
        expect(screen.queryByRole('link')).toBeNull();
    });
});
