import { screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { BreadcrumbItem } from '@/types';
import { TeamSettingsShell } from './team-settings-shell';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
const layout = vi.hoisted(() => ({
    breadcrumbs: [] as { title: string; href: unknown }[],
    active: undefined as string | undefined,
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => page,
}));

vi.mock('@/layouts/skrum/app-layout', () => ({
    default: ({
        breadcrumbs = [],
        active,
        children,
    }: {
        breadcrumbs?: BreadcrumbItem[];
        active?: string;
        children: ReactNode;
    }) => {
        layout.breadcrumbs = breadcrumbs;
        layout.active = active;

        return <main>{children}</main>;
    },
}));

const workspace = { id: 'w1', name: 'Nordlys', slug: 'nordlys' };
const team = { id: 't1', name: 'Atlas' };

beforeEach(() => {
    page.props = {
        translations: {},
        currentTeam: { id: 't1', name: 'Atlas', membersCount: 11 },
    };
});

function renderShell(): void {
    renderWithProviders(
        <TeamSettingsShell
            workspace={workspace}
            team={team}
            active="integrations"
        >
            <p>content</p>
        </TeamSettingsShell>,
    );
}

function links(): HTMLElement[] {
    return within(
        screen.getByRole('navigation', { name: 'Team settings' }),
    ).getAllByRole('link');
}

function hrefOf(href: unknown): string {
    return typeof href === 'string' ? href : (href as { url: string }).url;
}

describe('TeamSettingsShell', () => {
    it('lists Team and Integrations in a navigation named Team settings and marks the current one', () => {
        renderShell();

        expect(links().map((link) => link.textContent)).toEqual([
            'Team',
            'Integrations',
        ]);
        expect(links().map((link) => link.getAttribute('href'))).toEqual([
            '/w/nordlys/teams/t1#settings',
            '/w/nordlys/teams/t1/integrations',
        ]);
        expect(
            links().map((link) => link.getAttribute('aria-current')),
        ).toEqual([null, 'page']);
    });

    it('gives every entry an icon', () => {
        renderShell();

        for (const link of links()) {
            expect(
                link.querySelector('[data-slot="sub-nav-icon"]'),
            ).not.toBeNull();
        }
    });

    it('sits under the "Team settings" entry of the sidebar, with the team, the settings and the section as crumbs', () => {
        renderShell();

        expect(layout.active).toBe('settings');
        expect(layout.breadcrumbs.map((crumb) => crumb.title)).toEqual([
            'Atlas',
            'Team settings',
            'Integrations',
        ]);
        expect(layout.breadcrumbs.map((crumb) => hrefOf(crumb.href))).toEqual([
            '/w/nordlys/teams/t1',
            '/w/nordlys/teams/t1/integrations',
            '/w/nordlys/teams/t1/integrations',
        ]);
    });

    it('heads the page with the mark and the name of the team and its number of members', () => {
        renderShell();

        const mark = document.querySelector('[data-slot="team-mark"]');

        expect(
            screen.getByRole('heading', { level: 1, name: 'Atlas' }),
        ).not.toBeNull();
        expect(mark?.textContent).toBe('A');
        expect(mark?.getAttribute('aria-hidden')).toBe('true');
        expect(
            document.querySelector('[data-slot="team-settings-facts"]')
                ?.textContent,
        ).toBe('11 members');
        expect(screen.getByText('content')).not.toBeNull();
    });

    it('says "1 member" for a team of one', () => {
        page.props.currentTeam = { id: 't1', name: 'Atlas', membersCount: 1 };

        renderShell();

        expect(
            document.querySelector('[data-slot="team-settings-facts"]')
                ?.textContent,
        ).toBe('1 member');
    });

    it('shows no count when the current team of the sidebar is another team', () => {
        page.props.currentTeam = { id: 't2', name: 'Other', membersCount: 4 };

        renderShell();

        expect(screen.queryByText('4 members')).toBeNull();
        expect(
            document.querySelector('[data-slot="team-settings-facts"]'),
        ).toBeNull();
    });
});
