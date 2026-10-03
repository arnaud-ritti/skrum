import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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

    it('has no subtitle unless one is given', () => {
        const { container } = renderWithProviders(
            <SessionTitle>Sprint 42</SessionTitle>,
        );

        expect(
            container.querySelector('[data-slot="session-subtitle"]'),
        ).toBeNull();
    });
});
