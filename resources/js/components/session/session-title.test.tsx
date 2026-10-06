import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SessionTitle } from '@/components/session/session-title';
import { renderWithProviders } from '@/test/render';

describe('SessionTitle', () => {
    it('keeps the subtitle for the phone, under the title and out of the h1', () => {
        const { container } = renderWithProviders(
            <SessionTitle
                overline="Atlas · Retrospective"
                subtitle="Voting · 4/7"
            >
                Sprint 42
            </SessionTitle>,
        );
        const subtitle = container.querySelector(
            '[data-slot="session-subtitle"]',
        );

        expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
            'Sprint 42',
        );
        expect(subtitle?.textContent).toBe('Voting · 4/7');
        expect(subtitle?.className).toContain('md:hidden');
        expect(
            screen
                .getByRole('heading', { level: 1 })
                .compareDocumentPosition(subtitle as Element) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    it('makes the back arrow a button when leaving has to be asked first', () => {
        const onBack = vi.fn();

        renderWithProviders(
            <SessionTitle backHref="/teams/t1" onBack={onBack}>
                Sprint 42
            </SessionTitle>,
        );

        expect(screen.queryByRole('link')).toBeNull();

        fireEvent.click(
            screen.getByRole('button', { name: 'Back to the team' }),
        );

        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('has no subtitle unless one is given', () => {
        const { container } = renderWithProviders(
            <SessionTitle>Sprint 42</SessionTitle>,
        );

        expect(
            container.querySelector('[data-slot="session-subtitle"]'),
        ).toBeNull();
    });
});
