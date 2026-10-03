import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SessionRow } from '@/components/skrum/session-row';
import { sessionKindTone } from '@/components/skrum/session-type-picker';

describe('SessionRow', () => {
    it('is one link named by the title and the meta line', () => {
        render(
            <SessionRow
                href="/retros/r1"
                kind="retro"
                title="Sprint 42 retro"
                meta="Retro · Writing · 9 people"
            />,
        );

        const link = screen.getByRole('link', {
            name: 'Sprint 42 retro, Retro · Writing · 9 people',
        });

        expect(link.getAttribute('href')).toBe('/retros/r1');
        expect(link.getAttribute('data-slot')).toBe('session-row');
        expect(link.getAttribute('data-kind')).toBe('retro');
        expect(screen.getByText('Sprint 42 retro')).toBeTruthy();
        expect(screen.getByText('Retro · Writing · 9 people')).toBeTruthy();
    });

    it('draws the tile in the colours of its kind', () => {
        const { container } = render(
            <SessionRow
                href="/poker/p1"
                kind="poker"
                title="Sprint 43 refinement"
                meta="Planning poker · 12 tasks"
            />,
        );

        const tile = container.querySelector('[data-slot="session-row-kind"]');

        for (const token of sessionKindTone('poker').split(' ')) {
            expect(tile?.classList.contains(token)).toBe(true);
        }
    });

    it('puts a badge after the title', () => {
        render(
            <SessionRow
                href="/surveys/s1"
                kind="survey"
                title="Team health"
                meta="Poll"
                badge="Draft"
            />,
        );

        expect(
            screen.getByText('Draft').closest('[data-slot="badge"]'),
        ).toBeTruthy();
    });
});
