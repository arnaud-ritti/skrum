import { screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { TeamSettingsSections } from '@/types';
import { TeamSettingsShell } from './team-settings-shell';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
const layout = vi.hoisted(() => ({
    title: undefined as string | undefined,
    active: undefined as string | undefined,
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => page,
}));

vi.mock('@/layouts/skrum/app-layout', () => ({
    default: ({
        title,
        active,
        children,
    }: {
        title: string;
        active?: string;
        children: ReactNode;
    }) => {
        layout.title = title;
        layout.active = active;

        return <main>{children}</main>;
    },
}));

const workspace = { id: 'w1', name: 'Nordlys', slug: 'nordlys' };
const team = { id: 't1', name: 'Atlas' };
const allSections: TeamSettingsSections = {
    general: true,
    rituals: true,
    integrations: true,
    data: true,
    firstUrl: '/w/nordlys/teams/t1/settings',
};

beforeEach(() => {
    page.props = {
        translations: {},
        locale: 'en',
        currentTeam: {
            id: 't1',
            name: 'Atlas',
            membersCount: 11,
            viewerRole: 'owner',
            settingsUrl: '/w/nordlys/teams/t1/settings',
        },
    };
});

function renderShell(
    props: Partial<Parameters<typeof TeamSettingsShell>[0]> = {},
): void {
    renderWithProviders(
        <TeamSettingsShell
            workspace={workspace}
            team={team}
            active="integrations"
            sections={allSections}
            {...props}
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

function facts(): string | null | undefined {
    return document.querySelector('[data-slot="team-settings-facts"]')
        ?.textContent;
}

describe('TeamSettingsShell', () => {
    it('lists the four tabs in the order of the mockup in a navigation named Team settings and marks the current one', () => {
        renderShell();

        expect(links().map((link) => link.textContent)).toEqual([
            'General',
            'Members & rituals',
            'Integrations',
            'Data & export',
        ]);
        expect(links().map((link) => link.getAttribute('href'))).toEqual([
            '/w/nordlys/teams/t1/settings',
            '/w/nordlys/teams/t1/rituals',
            '/w/nordlys/teams/t1/integrations',
            '/w/nordlys/teams/t1/data',
        ]);
        expect(
            links().map((link) => link.getAttribute('aria-current')),
        ).toEqual([null, null, 'page', null]);
    });

    it('hides the tabs the viewer may not open', () => {
        renderShell({
            active: 'rituals',
            sections: {
                general: false,
                rituals: true,
                integrations: false,
                data: false,
                firstUrl: '/w/nordlys/teams/t1/rituals',
            },
        });

        expect(links().map((link) => link.textContent)).toEqual([
            'Members & rituals',
        ]);
    });

    it('gives every entry an icon', () => {
        renderShell();

        for (const link of links()) {
            expect(
                link.querySelector('[data-slot="sub-nav-icon"]'),
            ).not.toBeNull();
        }
    });

    it('sits under the Settings entry of the sidebar and is titled Settings whatever the section', () => {
        renderShell();

        expect(layout.active).toBe('settings');
        expect(layout.title).toBe('Settings');
    });

    it('heads the page with the mark and the name of the team and its number of members', () => {
        renderShell();

        const mark = document.querySelector('[data-slot="team-mark"]');

        expect(
            screen.getByRole('heading', { level: 1, name: 'Atlas' }),
        ).not.toBeNull();
        expect(mark?.textContent).toBe('A');
        expect(mark?.getAttribute('aria-hidden')).toBe('true');
        expect(facts()).toBe('11 members');
        expect(screen.getByText('content')).not.toBeNull();
    });

    it('reads the description, the members and the month the team was created, as the mockup does', () => {
        renderShell({
            team: { ...team, description: 'Product squad' },
            createdAt: '2025-03-10T09:00:00+00:00',
        });

        expect(facts()).toBe(
            'Product squad · 11 members · created in March 2025',
        );
    });

    it('leaves the description out when there is none', () => {
        renderShell({
            team: { ...team, description: null },
            createdAt: '2025-03-10T09:00:00+00:00',
        });

        expect(facts()).toBe('11 members · created in March 2025');
    });

    it('takes the number of members the page gives over the one of the sidebar', () => {
        renderShell({ membersCount: 1 });

        expect(facts()).toBe('1 member');
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
