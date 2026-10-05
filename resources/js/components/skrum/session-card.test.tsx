import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SessionCard } from '@/components/skrum/session-card';
import type { SessionCardProps } from '@/components/skrum/session-card';

const base: SessionCardProps = {
    href: '/sessions/1',
    kind: 'retro',
    title: 'Sprint 42 retro',
    team: 'Atlas',
    when: '2 days ago',
    status: 'ended',
    stats: { participants: 9, cards: 38, actions: 6 },
};

describe('SessionCard', () => {
    it('is one link whose name includes the title, with no nested buttons', () => {
        render(<SessionCard {...base} />);

        const link = screen.getByRole('link', { name: /Sprint 42 retro/ });

        expect(link.getAttribute('href')).toBe('/sessions/1');
        expect(screen.queryAllByRole('button')).toHaveLength(0);
        expect(screen.getAllByRole('link')).toHaveLength(1);
    });

    it('shows the ended state with the final counters', () => {
        render(<SessionCard {...base} />);

        expect(screen.getByText('Ended')).toBeTruthy();
        expect(screen.getByText('38')).toBeTruthy();
        expect(screen.getByText('6')).toBeTruthy();
    });

    it('shows live presence and a join hint instead of the counters', () => {
        render(
            <SessionCard
                {...base}
                kind="poker"
                status="live"
                people={[
                    { name: 'Tess Martin' },
                    { name: 'Noa Kim' },
                    { name: 'Ana Lee' },
                    { name: 'Bo Chen' },
                    { name: 'Cy Dunn' },
                ]}
            />,
        );

        expect(screen.getByText('Live')).toBeTruthy();
        expect(screen.getByText(/Join/)).toBeTruthy();
        expect(screen.getByText('+2')).toBeTruthy();
        expect(screen.queryByText('38')).toBeNull();
    });

    it('reads the people as a count, not as their initials', () => {
        render(
            <SessionCard
                {...base}
                status="live"
                people={[
                    { name: 'Tess Martin' },
                    { name: 'Noa Kim' },
                    { name: 'Ana Lee' },
                    { name: 'Bo Chen' },
                    { name: 'Cy Dunn' },
                ]}
            />,
        );
        const link = screen.getByRole('link');

        expect(
            link
                .querySelector('[data-slot="session-card-presence"]')
                ?.getAttribute('aria-hidden'),
        ).toBe('true');
        expect(screen.getByText('5 people').className).toBe('sr-only');
    });

    it('shows two people of the same name', () => {
        const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
        const { container } = render(
            <SessionCard
                {...base}
                status="live"
                people={[{ name: 'Guest' }, { name: 'Guest' }]}
            />,
        );

        expect(
            container.querySelectorAll(
                '[data-slot="session-card-presence"] [data-slot="avatar"]',
            ),
        ).toHaveLength(2);
        expect(errors).not.toHaveBeenCalled();
        errors.mockRestore();
    });

    it('counts one participant, one card and one action item in the singular', () => {
        const { container } = render(
            <SessionCard
                {...base}
                stats={{ participants: 1, cards: 1, actions: 1 }}
            />,
        );

        expect(
            container.querySelector('[data-slot="session-card-participants"]')
                ?.textContent,
        ).toBe('1participant');
        expect(
            container.querySelector('[data-slot="session-card-cards"]')
                ?.textContent,
        ).toBe('1card');
        expect(
            container.querySelector('[data-slot="session-card-actions"]')
                ?.textContent,
        ).toBe('1action item');
    });

    it('takes the tone of a phase for its badge, with or without the live dot', () => {
        const { container, rerender } = render(
            <SessionCard
                {...base}
                status="live"
                statusLabel="Voting"
                statusTone="warning"
                statusDot={false}
            />,
        );
        const badge = (): HTMLElement =>
            container.querySelector(
                '[data-slot="session-card-status"]',
            ) as HTMLElement;

        expect(badge().dataset.tone).toBe('warning');
        expect(badge().className).toContain('bg-skrum-warning-soft');
        expect(
            container.querySelector('[data-slot="session-card-dot"]'),
        ).toBeNull();

        rerender(
            <SessionCard
                {...base}
                status="live"
                statusLabel="Writing"
                statusTone="info"
            />,
        );

        expect(badge().dataset.tone).toBe('info');
        expect(
            container.querySelector('[data-slot="session-card-dot"]')
                ?.className,
        ).toContain('bg-skrum-info');
    });

    it('moves from live to ended on rerender with the final counters', () => {
        const { rerender } = render(
            <SessionCard
                {...base}
                status="live"
                people={[{ name: 'Tess Martin' }]}
            />,
        );

        expect(screen.getByText('Live')).toBeTruthy();

        rerender(<SessionCard {...base} />);

        expect(screen.getByText('Ended')).toBeTruthy();
        expect(screen.queryByText(/Join/)).toBeNull();
        expect(screen.getByText('38')).toBeTruthy();
    });

    it('counts the groups after the cards, in the singular for one', () => {
        const { container, rerender } = render(
            <SessionCard
                {...base}
                stats={{ participants: 9, cards: 38, groups: 6, actions: 6 }}
            />,
        );
        const groups = () =>
            container.querySelector('[data-slot="session-card-groups"]');

        expect(groups()?.textContent).toBe('6 groups');
        expect(groups()?.previousElementSibling?.textContent).toContain('38');

        rerender(
            <SessionCard
                {...base}
                stats={{ participants: 9, cards: 38, groups: 1 }}
            />,
        );

        expect(groups()?.textContent).toBe('1 group');

        rerender(<SessionCard {...base} />);

        expect(groups()).toBeNull();
    });

    it('names the people "joined" while the session is open, and the actions "action items"', () => {
        const { container, rerender } = render(
            <SessionCard
                {...base}
                stats={{ participants: 8, joined: true, cards: 23 }}
            />,
        );
        const participants = () =>
            container.querySelector('[data-slot="session-card-participants"]');

        expect(participants()?.textContent).toBe('8joined');
        expect(participants()?.querySelector('.sr-only')).toBeNull();

        rerender(<SessionCard {...base} />);

        expect(participants()?.textContent).toBe('9participants');
        expect(participants()?.querySelector('.sr-only')?.textContent).toBe(
            'participants',
        );
        expect(
            container.querySelector('[data-slot="session-card-actions"]')
                ?.textContent,
        ).toBe('6action items');
    });

    it('renders the scheduled state and omits missing counters', () => {
        render(
            <SessionCard
                {...base}
                status="scheduled"
                stats={{ participants: 4 }}
            />,
        );

        expect(screen.getByText('Scheduled')).toBeTruthy();
        expect(screen.queryByText('cards')).toBeNull();
    });

    it('keeps the date whole beside a team or template name that is cut', () => {
        const { container } = render(<SessionCard {...base} />);
        const when = container.querySelector('[data-slot="session-card-when"]');

        expect(when?.textContent).toBe(` · ${base.when}`);
        expect(when?.className).toContain('shrink-0');
        expect(when?.previousElementSibling?.textContent).toBe(base.team);
        expect(when?.previousElementSibling?.className).toContain('truncate');
    });

    it('shows the status word the host gives and a meta line', () => {
        render(
            <SessionCard
                {...base}
                statusLabel="Voting"
                meta={<span>Facilitated by Tess</span>}
            />,
        );

        expect(screen.getByText('Voting')).toBeTruthy();
        expect(screen.queryByText('Ended')).toBeNull();
        expect(
            screen
                .getByText('Facilitated by Tess')
                .closest('[data-slot="session-card-meta"]'),
        ).not.toBeNull();
    });

    it('keeps an action outside the link', () => {
        render(
            <SessionCard
                {...base}
                action={<button type="button">Delete</button>}
            />,
        );

        const link = screen.getByRole('link', { name: /Sprint 42 retro/ });
        const button = screen.getByRole('button', { name: 'Delete' });

        expect(link.contains(button)).toBe(false);
        expect(link.querySelector('button, a')).toBeNull();
        expect(link.getAttribute('data-status')).toBe('ended');
    });

    it.each(['retro', 'poker', 'whiteboard', 'survey', 'icebreaker'] as const)(
        'renders the %s kind',
        (kind) => {
            render(<SessionCard {...base} kind={kind} />);

            expect(screen.getByRole('link').getAttribute('data-kind')).toBe(
                kind,
            );
        },
    );
});

describe('SessionCard padding', () => {
    it('keeps its padding and gap over the card defaults', () => {
        render(<SessionCard {...base} className="extra" />);

        const classes = screen.getByRole('link').className.split(/\s+/);

        expect(classes).toContain('p-4');
        expect(classes).toContain('gap-3');
        expect(classes).toContain('extra');
        expect(classes).not.toContain('py-0');
        expect(classes).not.toContain('gap-0');
        expect(classes).not.toContain('block');
    });
});
