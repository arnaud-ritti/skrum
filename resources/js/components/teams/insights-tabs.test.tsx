import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InsightsTabs, RetroRotiList } from '@/components/teams/insights-tabs';
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

describe('the tabs of Insights', () => {
    it('shows five tabs and marks the active one', () => {
        renderWithProviders(
            <InsightsTabs
                workspace={{ slug: 'nordlys' }}
                team={{ id: 'team-1' }}
                active="health"
            />,
        );

        expect(
            screen.getByRole('heading', { level: 1, name: 'Insights' }),
        ).toBeTruthy();
        expect(
            within(screen.getByRole('navigation', { name: 'Insights' }))
                .getAllByRole('link')
                .map((link) => [
                    link.textContent,
                    link.getAttribute('href'),
                    link.getAttribute('aria-current'),
                ]),
        ).toEqual([
            ['Mood & ROTI', '/w/nordlys/teams/team-1/insights', null],
            ['Health check', '/w/nordlys/teams/team-1/health-check', 'page'],
            ['eNPS', '/w/nordlys/teams/team-1/enps', null],
            ['Estimates', '/w/nordlys/teams/team-1/estimates', null],
            ['Games', '/w/nordlys/teams/team-1/games', null],
        ]);
    });

    it('shows eNPS third of five tabs', () => {
        renderWithProviders(
            <InsightsTabs
                workspace={{ slug: 'nordlys' }}
                team={{ id: 'team-1' }}
                active="enps"
            />,
        );

        const tabs = within(
            screen.getByRole('navigation', { name: 'Insights' }),
        ).getAllByRole('link');

        expect(tabs).toHaveLength(5);
        expect(tabs[2].textContent).toBe('eNPS');
        expect(tabs.map((tab) => tab.getAttribute('aria-current'))).toEqual([
            null,
            null,
            'page',
            null,
            null,
        ]);
    });

    it('lists the ROTI of each retro, or says none has one', () => {
        const { rerender } = renderWithProviders(
            <RetroRotiList
                retros={[
                    {
                        id: 'retro-2',
                        title: 'Sprint 42',
                        url: '/retros/retro-2',
                        roti: 4,
                        closedOn: '2026-09-18',
                    },
                    {
                        id: 'retro-1',
                        title: 'Sprint 41',
                        url: '/retros/retro-1',
                        roti: 3.5,
                        closedOn: '2025-12-31',
                    },
                ]}
            />,
        );

        expect(
            screen.getAllByRole('listitem').map((item) => item.textContent),
        ).toEqual([
            'Sprint 42Sep 18, 2026ROTI 4.0',
            'Sprint 41Dec 31, 2025ROTI 3.5',
        ]);
        expect(
            screen
                .getAllByRole('listitem')
                .map((item) =>
                    item
                        .querySelector('[data-slot="roti-value"]')
                        ?.getAttribute('data-step'),
                ),
        ).toEqual(['4', '4']);
        expect(
            screen
                .getByRole('link', { name: 'Sprint 42' })
                .getAttribute('href'),
        ).toBe('/retros/retro-2');
        expect(screen.queryByText('No retro has a ROTI yet')).toBeNull();

        rerender(<RetroRotiList retros={[]} />);

        expect(screen.queryByRole('listitem')).toBeNull();
        expect(screen.getByText('No retro has a ROTI yet')).toBeTruthy();
    });
});
