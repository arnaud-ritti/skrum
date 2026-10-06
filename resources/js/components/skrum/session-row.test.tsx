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
        expect(
            link.querySelector('[data-slot="session-row-date"]')?.textContent,
        ).toBe('Oct 2, 2026');
        expect(
            link.querySelector('[data-slot="session-row-status"]')?.textContent,
        ).toBe('Completed');
    });

    it('keeps the date, status and action cells on every row, empty when it has none', () => {
        const { container, rerender } = render(
            <SessionRow
                href="/retros/r1"
                kind="retro"
                title="Sprint 42 retro"
                meta="Retro"
            />,
        );
        const cell = (name: string) =>
            container.querySelector(`[data-slot="session-row-${name}"]`);

        for (const name of ['date', 'status', 'action']) {
            expect(cell(name)?.textContent).toBe('');
            expect(cell(name)?.getAttribute('aria-hidden')).toBe('true');
        }

        rerender(
            <SessionRow
                href="/retros/r1"
                kind="retro"
                title="Sprint 42 retro"
                meta="Retro"
                date="Now"
                status="Live"
                action={<a href="/retros/r1/join">Join</a>}
                menu={<button type="button">More actions</button>}
            />,
        );

        expect(cell('date')?.textContent).toBe('Now');
        expect(cell('status')?.textContent).toBe('Live');
        expect(cell('action')?.textContent).toBe('JoinMore actions');

        for (const name of ['date', 'status', 'action']) {
            expect(cell(name)?.hasAttribute('aria-hidden')).toBe(false);
        }
    });

    it('gives the three cells a fixed width from the card that holds them beside the text', () => {
        const { container } = render(
            <SessionRow
                href="/retros/r1"
                kind="retro"
                title="Sprint 42 retro"
                meta="Retro"
                date="Now"
                status="Live"
            />,
        );
        const classes = (name: string) =>
            container.querySelector(`[data-slot="session-row-${name}"]`)
                ?.classList;

        expect(classes('date')?.contains('@2xl/card:w-24')).toBe(true);
        expect(classes('date')?.contains('@2xl/card:text-right')).toBe(true);
        expect(classes('date')?.contains('tabular-nums')).toBe(true);
        expect(classes('status')?.contains('@2xl/card:w-24')).toBe(true);
        expect(classes('action')?.contains('@2xl/card:w-32')).toBe(true);
        expect(classes('action')?.contains('justify-end')).toBe(true);

        for (const name of ['date', 'status', 'action']) {
            expect(classes(name)?.contains('empty:hidden')).toBe(true);
            expect(classes(name)?.value).toMatch(
                /@2xl\/card:empty:(block|flex)\b/,
            );
        }
    });

    it('keeps no room for the action cell in a list where no row has one', () => {
        const { container } = render(
            <SessionRow
                href="/retros/r1"
                kind="retro"
                title="Sprint 42 retro"
                meta="Retro"
                date="Oct 2"
                status="Completed"
                actionColumn={false}
            />,
        );
        const classes = (name: string) =>
            container.querySelector(`[data-slot="session-row-${name}"]`)
                ?.classList;

        expect(classes('date')?.contains('@lg/card:w-24')).toBe(true);
        expect(classes('status')?.contains('@lg/card:w-24')).toBe(true);
        expect(classes('action')?.contains('empty:hidden')).toBe(true);
        expect(classes('action')?.value).not.toContain('w-32');
    });

    it('centres the right-hand cells on the row', () => {
        const { container } = render(
            <SessionRow
                href="/retros/r1"
                kind="retro"
                title="Sprint 42 retro"
                meta="Retro"
                date="Now"
                status="Live"
                action={<a href="/retros/r1/join">Join</a>}
            />,
        );
        const card = container.querySelector('[data-slot="card"]');
        const cell = (name: string) =>
            container.querySelector(`[data-slot="session-row-${name}"]`);
        const when = cell('date')?.parentElement;

        expect(cell('status')?.parentElement).toBe(when);
        expect(when?.classList.contains('@2xl/card:inset-y-0')).toBe(true);
        expect(when?.classList.contains('@2xl/card:items-center')).toBe(true);
        expect(card?.classList.contains('items-center')).toBe(true);
        expect(cell('action')?.parentElement).toBe(card);
        expect(cell('action')?.classList.contains('items-center')).toBe(true);
    });

    it('draws the outcome it is given, and keeps its text as the name', () => {
        render(
            <SessionRow
                href="/retros/r1"
                kind="retro"
                title="Sprint 42 retro"
                meta="Retro · 9 people"
                outcome="ROTI 4.0 · 2 actions"
                outcomeContent={<b data-testid="drawn">4.0, then 2</b>}
            />,
        );

        expect(
            screen
                .getByRole('link', {
                    name: 'Sprint 42 retro, Retro · 9 people, ROTI 4.0 · 2 actions',
                })
                .querySelector('[data-slot="session-row-outcome"]')
                ?.textContent,
        ).toBe('· 4.0, then 2');
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
