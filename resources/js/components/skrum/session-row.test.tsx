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
        expect(screen.getAllByRole('link')).toHaveLength(1);
        expect(screen.queryByRole('button')).toBeNull();
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

    it('draws no badge for an empty one', () => {
        const { container } = render(
            <SessionRow
                href="/retros/r1"
                kind="retro"
                title="Sprint 42 retro"
                meta="Retro"
                badge=""
            />,
        );

        expect(container.querySelector('[data-slot="badge"]')).toBeNull();
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

    it('tells the outcome, the date and the status, in the name of the link too', () => {
        render(
            <SessionRow
                href="/retros/r1"
                kind="retro"
                title="Sprint 42 retro"
                meta="Retro · 9 people"
                outcome="ROTI 4.0 · 2 actions"
                date="Oct 2, 2026"
                status="Completed"
            />,
        );

        const link = screen.getByRole('link', {
            name: 'Sprint 42 retro, Retro · 9 people, ROTI 4.0 · 2 actions, Oct 2, 2026, Completed',
        });

        expect(link.textContent).toContain('ROTI 4.0 · 2 actions');
        expect(screen.getByText('Oct 2, 2026')).toBeTruthy();
        expect(screen.getByText('Completed')).toBeTruthy();
    });

    it('keeps an action and a menu in the card, outside the link', () => {
        render(
            <SessionRow
                href="/retros/r1"
                kind="retro"
                title="Sprint 42 retro"
                meta="Retro"
                action={<a href="/retros/r1/join">Join</a>}
                menu={<button type="button">More actions</button>}
            />,
        );

        const link = screen.getByRole('link', {
            name: 'Sprint 42 retro, Retro',
        });
        const join = screen.getByRole('link', { name: 'Join' });
        const menu = screen.getByRole('button', { name: 'More actions' });
        const card = link.closest('[data-slot="card"]');

        expect(link.contains(join)).toBe(false);
        expect(link.contains(menu)).toBe(false);
        expect(card?.contains(join)).toBe(true);
        expect(card?.contains(menu)).toBe(true);
    });
});
