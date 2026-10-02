import { screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { BreadcrumbItem } from '@/types';
import { SettingsShell } from './settings-shell';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
const layout = vi.hoisted(() => ({
    breadcrumbs: [] as { title: string }[],
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

beforeEach(() => {
    page.props = {
        translations: {},
        features: { mcp: true, integrations: false },
        auth: { user: { name: 'Mona Member' } },
    };
});

function links(): HTMLElement[] {
    return within(
        screen.getByRole('navigation', { name: 'Settings' }),
    ).getAllByRole('link');
}

describe('SettingsShell', () => {
    it('lists the five sections in a navigation named Settings and marks the current one', () => {
        renderWithProviders(
            <SettingsShell active="security">
                <p>content</p>
            </SettingsShell>,
        );

        expect(links().map((link) => link.textContent)).toEqual([
            'Profile',
            'Security',
            'Appearance',
            'Notifications',
            'API tokens',
        ]);
        expect(links().map((link) => link.getAttribute('href'))).toEqual([
            '/settings/profile',
            '/settings/security',
            '/settings/appearance',
            '/settings/notifications',
            '/settings/api-tokens',
        ]);
        expect(
            links().map((link) => link.getAttribute('aria-current')),
        ).toEqual([null, 'page', null, null, null]);
    });

    it('gives every entry an icon', () => {
        renderWithProviders(
            <SettingsShell active="profile">
                <p>content</p>
            </SettingsShell>,
        );

        for (const link of links()) {
            expect(
                link.querySelector('[data-slot="sub-nav-icon"]'),
            ).not.toBeNull();
        }
    });

    it('leaves API tokens out when the MCP server is off', () => {
        page.props.features = { mcp: false };

        renderWithProviders(
            <SettingsShell active="profile">
                <p>content</p>
            </SettingsShell>,
        );

        expect(links().map((link) => link.textContent)).toEqual([
            'Profile',
            'Security',
            'Appearance',
            'Notifications',
        ]);
    });

    it('titles the page Settings, with the sentence of the mockup, around the content', () => {
        renderWithProviders(
            <SettingsShell active="profile">
                <p>content</p>
            </SettingsShell>,
        );

        expect(
            screen.getByRole('heading', { level: 1, name: 'Settings' }),
        ).toBeTruthy();
        expect(
            screen.getByText('Your account, applied in every workspace'),
        ).toBeTruthy();
        expect(screen.getByRole('main').textContent).toContain('content');
    });

    it('sets the breadcrumb to the member then Settings, and no sidebar entry as active', () => {
        renderWithProviders(
            <SettingsShell active="appearance">
                <p>content</p>
            </SettingsShell>,
        );

        expect(layout.breadcrumbs.map((crumb) => crumb.title)).toEqual([
            'Mona Member',
            'Settings',
        ]);
        expect(layout.active).toBeUndefined();
    });

    it('gives a section its own page title, its sentence and a third crumb', () => {
        renderWithProviders(
            <SettingsShell
                active="security"
                title="Security"
                description="Password, two-factor authentication and passkeys."
            >
                <p>content</p>
            </SettingsShell>,
        );

        expect(
            screen.getByRole('heading', { level: 1, name: 'Security' }),
        ).toBeTruthy();
        expect(
            screen.getByText(
                'Password, two-factor authentication and passkeys.',
            ),
        ).toBeTruthy();
        expect(layout.breadcrumbs.map((crumb) => crumb.title)).toEqual([
            'Mona Member',
            'Settings',
            'Security',
        ]);
    });
});
