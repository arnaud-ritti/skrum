import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { AdminShell } from './admin-shell';

const page = vi.hoisted(() => ({
    props: { translations: {} } as Record<string, unknown>,
}));

const mocks = vi.hoisted(() => ({ visit: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@inertiajs/react')>();

    return {
        ...actual,
        usePage: () => page,
        router: { visit: mocks.visit },
    };
});

vi.mock('@/layouts/skrum/app-layout', () => ({
    default: ({
        actions,
        title,
        children,
    }: {
        actions?: ReactNode;
        title: string;
        children: ReactNode;
    }) => (
        <div>
            <p data-slot="title">{title}</p>
            <header>{actions}</header>
            <main>{children}</main>
        </div>
    ),
}));

beforeAll(() => {
    vi.stubGlobal(
        'ResizeObserver',
        class {
            observe(): void {}
            unobserve(): void {}
            disconnect(): void {}
        },
    );
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
    Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
    page.props = { translations: {} };
    mocks.visit.mockReset();
});

function navigation(): HTMLElement {
    return screen.getByRole('navigation', {
        name: 'Administration',
        hidden: true,
    });
}

describe('AdminShell', () => {
    it('lists the eleven sections in order, in the groups Instance and Supervision', () => {
        renderWithProviders(
            <AdminShell active="admins">
                <p>content</p>
            </AdminShell>,
        );

        const links = within(navigation()).getAllByRole('link', {
            hidden: true,
        });

        expect(links.map((link) => link.textContent)).toEqual([
            'General',
            'Branding',
            'SSO authentication',
            'SMTP',
            'AI',
            'Integrations',
            'MCP keys',
            'Licence',
            'Users',
            'Admins',
            'Audit log',
        ]);
        expect(links.map((link) => link.getAttribute('href'))).toEqual([
            '/admin/general',
            '/admin/branding',
            '/admin/sign-in',
            '/admin/mail',
            '/admin/ai',
            '/admin/integrations',
            '/admin/mcp-keys',
            '/admin/licence',
            '/admin/users',
            '/admin/admins',
            '/admin/audit-log',
        ]);

        const instance = within(navigation()).getByRole('group', {
            name: 'Instance',
            hidden: true,
        });
        const supervision = within(navigation()).getByRole('group', {
            name: 'Supervision',
            hidden: true,
        });

        expect(
            within(instance)
                .getAllByRole('link', { hidden: true })
                .map((link) => link.textContent),
        ).toEqual([
            'General',
            'Branding',
            'SSO authentication',
            'SMTP',
            'AI',
            'Integrations',
            'MCP keys',
            'Licence',
        ]);
        expect(
            within(supervision)
                .getAllByRole('link', { hidden: true })
                .map((link) => link.textContent),
        ).toEqual(['Users', 'Admins', 'Audit log']);
    });

    it('marks the active section as the current page', () => {
        renderWithProviders(
            <AdminShell active="mcpKeys">
                <p>content</p>
            </AdminShell>,
        );

        const current = within(navigation())
            .getAllByRole('link', { hidden: true })
            .filter((link) => link.getAttribute('aria-current') === 'page');

        expect(current.map((link) => link.textContent)).toEqual(['MCP keys']);
    });

    it('titles the page after the section in view', () => {
        const { container } = renderWithProviders(
            <AdminShell active="users">
                <p>content</p>
            </AdminShell>,
        );

        expect(container.querySelector('[data-slot=title]')?.textContent).toBe(
            'Users',
        );
    });

    it('says "active" beside SSO authentication while single sign-on is in force', () => {
        page.props = { translations: {}, ssoInForce: true };

        renderWithProviders(
            <AdminShell active="signIn">
                <p>content</p>
            </AdminShell>,
        );

        expect(
            screen
                .getByRole('link', {
                    name: /^SSO authentication\s*active$/,
                    hidden: true,
                })
                .getAttribute('aria-current'),
        ).toBe('page');
    });

    it('counts the integrations turned on out of those configured', () => {
        page.props = {
            translations: {},
            integrationCounts: { enabled: 2, configured: 3 },
        };

        renderWithProviders(
            <AdminShell active="general">
                <p>content</p>
            </AdminShell>,
        );

        const integrations = screen.getByRole('link', {
            name: /^Integrations/,
            hidden: true,
        });

        expect(
            integrations.querySelector('[data-slot=admin-nav-badge]')
                ?.textContent,
        ).toBe('2/3');
        expect(integrations.textContent).toContain(
            '2 of 3 configured integrations turned on',
        );
    });

    it('shows no integration count before one is configured', () => {
        page.props = {
            translations: {},
            integrationCounts: { enabled: 0, configured: 0 },
        };

        renderWithProviders(
            <AdminShell active="general">
                <p>content</p>
            </AdminShell>,
        );

        expect(
            screen
                .getByRole('link', { name: /^Integrations/, hidden: true })
                .querySelector('[data-slot=admin-nav-badge]'),
        ).toBeNull();
    });

    it('shows the host of the instance under the navigation', () => {
        const { container } = renderWithProviders(
            <AdminShell active="branding">
                <p>content</p>
            </AdminShell>,
        );

        expect(
            container.querySelector('[data-slot=admin-host]')?.textContent,
        ).toBe(window.location.host);
    });

    it('says the version is up to date', () => {
        page.props = {
            translations: {},
            instanceVersion: '1.8.2',
            instanceVersionStatus: {
                state: 'current',
                latest: '1.8.2',
                checkedAt: '2026-10-03T08:00:00Z',
                releaseUrl: null,
            },
        };

        const { container } = renderWithProviders(
            <AdminShell active="general">
                <p>content</p>
            </AdminShell>,
        );

        const version = container.querySelector('[data-slot=admin-version]');

        expect(version?.textContent).toBe('v1.8.2 · up to date');
        expect(
            version?.querySelector('[data-slot=admin-version-state]')
                ?.className,
        ).toContain('text-skrum-success-text');
        expect(
            container.querySelector('[data-slot=admin-version-dot]'),
        ).not.toBeNull();
    });

    it('says an update is available, in words and with an icon', () => {
        page.props = {
            translations: {},
            instanceVersion: '1.8.2',
            instanceVersionStatus: {
                state: 'outdated',
                latest: '1.9.0',
                checkedAt: '2026-10-03T08:00:00Z',
                releaseUrl:
                    'https://github.com/arnaud-ritti/skrum/releases/tag/v1.9.0',
            },
        };

        const { container } = renderWithProviders(
            <AdminShell active="general">
                <p>content</p>
            </AdminShell>,
        );

        const version = container.querySelector('[data-slot=admin-version]');
        const state = version?.querySelector('[data-slot=admin-version-state]');

        expect(version?.textContent).toBe('v1.8.2 · update available: v1.9.0');
        expect(state?.className).toContain('text-skrum-warning-text');
        expect(state?.querySelector('svg')).not.toBeNull();
        expect(
            container.querySelector('[data-slot=admin-version-dot]'),
        ).toBeNull();

        const link = state?.querySelector('a');

        expect(link?.getAttribute('href')).toBe(
            'https://github.com/arnaud-ritti/skrum/releases/tag/v1.9.0',
        );
        expect(link?.getAttribute('target')).toBe('_blank');
        expect(link?.getAttribute('rel')).toBe('noreferrer noopener');
        expect(link?.getAttribute('aria-label')).toBe(
            'update available: v1.9.0 (opens in a new tab)',
        );
    });

    it('shows the version alone while the update status is unknown', () => {
        page.props = {
            translations: {},
            instanceVersion: '1.8.2',
            instanceVersionStatus: {
                state: 'unknown',
                latest: null,
                checkedAt: null,
                releaseUrl: null,
            },
        };

        const { container } = renderWithProviders(
            <AdminShell active="general">
                <p>content</p>
            </AdminShell>,
        );

        expect(
            container.querySelector('[data-slot=admin-version]')?.textContent,
        ).toBe('v1.8.2');
    });

    it('lists the sections by group in the mobile select and visits the chosen one', async () => {
        renderWithProviders(
            <AdminShell active="general">
                <p>content</p>
            </AdminShell>,
        );

        await userEvent.click(
            screen.getByRole('combobox', { name: 'Section' }),
        );

        const groups = screen.getAllByRole('group');

        expect(
            groups.map((group) =>
                within(group)
                    .getAllByRole('option')
                    .map((option) => option.textContent),
            ),
        ).toEqual([
            [
                'General',
                'Branding',
                'SSO authentication',
                'SMTP',
                'AI',
                'Integrations',
                'MCP keys',
                'Licence',
            ],
            ['Users', 'Admins', 'Audit log'],
        ]);

        await userEvent.click(
            screen.getByRole('option', { name: 'Audit log' }),
        );

        expect(mocks.visit).toHaveBeenCalledTimes(1);
        expect(mocks.visit).toHaveBeenCalledWith('/admin/audit-log');
    });

    it('puts the Self-host badge in the topbar, before the actions of the page', () => {
        renderWithProviders(
            <AdminShell
                active="branding"
                actions={<button type="button">Save</button>}
            >
                <p>content</p>
            </AdminShell>,
        );

        expect(screen.getByRole('banner').textContent).toBe('Self-hostSave');
        expect(screen.getByRole('main').textContent).toContain('content');
    });
});
