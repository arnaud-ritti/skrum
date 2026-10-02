import { fireEvent, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { BreadcrumbItem } from '@/types';
import {
    SettingsSection,
    SettingsSections,
    SettingsShell,
} from './settings-shell';

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

const onSelect = vi.fn();

beforeEach(() => {
    onSelect.mockClear();
    page.props = {
        translations: {},
        auth: { user: { name: 'Mona Member' } },
    };
});

function links(): HTMLElement[] {
    return within(
        screen.getByRole('navigation', { name: 'Settings' }),
    ).getAllByRole('link');
}

describe('SettingsShell', () => {
    it('lists the five sections as anchors of the page, in a navigation named Settings, and marks the one in view', () => {
        renderWithProviders(
            <SettingsShell
                sections={SettingsSections}
                current="security"
                onSelect={onSelect}
            >
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
            '#profile',
            '#security',
            '#appearance',
            '#notifications',
            '#api-tokens',
        ]);
        expect(
            links().map((link) => link.getAttribute('aria-current')),
        ).toEqual([null, 'location', null, null, null]);
    });

    it('gives every entry an icon', () => {
        renderWithProviders(
            <SettingsShell
                sections={SettingsSections}
                current="profile"
                onSelect={onSelect}
            >
                <p>content</p>
            </SettingsShell>,
        );

        for (const link of links()) {
            expect(
                link.querySelector('[data-slot="sub-nav-icon"]'),
            ).not.toBeNull();
        }
    });

    it('lists only the sections the page holds, in the order of the page', () => {
        renderWithProviders(
            <SettingsShell
                sections={['notifications', 'profile']}
                current="profile"
                onSelect={onSelect}
            >
                <p>content</p>
            </SettingsShell>,
        );

        expect(links().map((link) => link.textContent)).toEqual([
            'Profile',
            'Notifications',
        ]);
    });

    it('hands the chosen section to the page instead of leaving it', () => {
        renderWithProviders(
            <SettingsShell
                sections={SettingsSections}
                current="profile"
                onSelect={onSelect}
            >
                <p>content</p>
            </SettingsShell>,
        );

        const followed = fireEvent.click(
            screen.getByRole('link', { name: 'Notifications' }),
        );

        expect(followed).toBe(false);
        expect(onSelect).toHaveBeenCalledWith('notifications');
    });

    it('titles the page Settings, with the sentence of the mockup, around the content', () => {
        renderWithProviders(
            <SettingsShell
                sections={SettingsSections}
                current="profile"
                onSelect={onSelect}
            >
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
            <SettingsShell
                sections={SettingsSections}
                current="appearance"
                onSelect={onSelect}
            >
                <p>content</p>
            </SettingsShell>,
        );

        expect(layout.breadcrumbs.map((crumb) => crumb.title)).toEqual([
            'Mona Member',
            'Settings',
        ]);
        expect(layout.active).toBeUndefined();
    });
});

describe('SettingsSection', () => {
    it('is the place its anchor reaches, can take the focus and adds no landmark around its cards', () => {
        const { container } = renderWithProviders(
            <SettingsSection id="api-tokens">
                <p>content</p>
            </SettingsSection>,
        );

        const section = container.querySelector<HTMLElement>('#api-tokens');

        expect(section?.dataset.slot).toBe('settings-section');
        expect(section?.tabIndex).toBe(-1);
        expect(section?.textContent).toBe('content');
        expect(screen.queryByRole('region')).toBeNull();
    });
});
