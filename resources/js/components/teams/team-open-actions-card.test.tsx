import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TeamOpenActionsCard } from '@/components/teams/team-open-actions-card';
import { actionItemFixture } from '@/test/action-items';
import { renderWithProviders } from '@/test/render';

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...original,
        usePage: () => ({ props: { translations: {}, locale: 'en' } }),
        Link: ({
            href,
            children,
            ...props
        }: {
            href: string | { url: string };
            children: React.ReactNode;
        }) => (
            <a href={typeof href === 'string' ? href : href.url} {...props}>
                {children}
            </a>
        ),
    };
});

const items = [
    actionItemFixture({
        id: 'item-1',
        content: 'Review the definition of ready with the PO',
        dueOn: '2026-09-29',
        isOverdue: true,
        assignee: {
            id: 'user-1',
            kind: 'member',
            name: 'Arnaud Ritti',
            avatarUrl: '/avatars/arnaud.svg',
            isTeamMember: true,
        },
        source: {
            retroTitle: 'Sprint 41 retro',
            retroCreatedAt: null,
            retroUrl: '/retros/retro-1',
        },
    }),
    actionItemFixture({ id: 'item-2', content: 'Automate the changelog' }),
];

function card(props: Partial<Parameters<typeof TeamOpenActionsCard>[0]> = {}) {
    return renderWithProviders(
        <TeamOpenActionsCard
            items={items}
            count={7}
            overdueCount={2}
            canCreate
            seeAllHref="/w/nordlys/action-items?team=team-1"
            {...props}
        />,
    );
}

describe('the open action items of a team', () => {
    it('counts the open and the overdue items, says where they come from and leads to all of them', () => {
        const { container } = card();

        expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
            'Open action items7',
        );
        expect(
            container.querySelector('[data-slot="open-actions-overdue"]')
                ?.textContent,
        ).toBe('2 overdue');
        expect(
            screen.getByText(
                'Gathered from every session of the team · overdue first.',
            ),
        ).toBeTruthy();
        expect(
            screen.getByRole('link', { name: 'See all' }).getAttribute('href'),
        ).toBe('/w/nordlys/action-items?team=team-1');
    });

    it('shows each item with its assignee, its late due day and its source retro, and changes nothing', () => {
        const { container } = card();
        const rows = container.querySelectorAll(
            '#open-actions [data-test="open-action"]',
        );

        expect(rows).toHaveLength(2);
        expect(rows[0].getAttribute('data-overdue')).toBe('true');
        expect(rows[0].textContent).toContain(
            'Review the definition of ready with the PO',
        );
        expect(rows[0].textContent).toContain('Arnaud Ritti');
        expect(rows[0].textContent).toContain('Sprint 41 retro');
        expect(
            (
                rows[0].querySelector(
                    '[data-slot="action-item-status"]',
                ) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });

    it('has no overdue badge when nothing is late', () => {
        const { container } = card({ overdueCount: 0 });

        expect(
            container.querySelector('[data-slot="open-actions-overdue"]'),
        ).toBeNull();
    });

    it('says so when the team has no open item', () => {
        card({ items: [], count: 0, overdueCount: 0 });

        expect(screen.getByText('No open action items.')).toBeTruthy();
    });

    it('is hidden when there is no open item and the viewer may not create one', () => {
        const { container } = card({
            items: [],
            count: 0,
            overdueCount: 0,
            canCreate: false,
        });

        expect(container.innerHTML).toBe('');
    });
});
