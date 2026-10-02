import { screen, within } from '@testing-library/react';
import { User } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import SessionLayout from '@/layouts/skrum/session-layout';
import { renderWithProviders } from '@/test/render';
import type { AppSidebarProps } from '@/components/skrum/app-sidebar';
import { AppTopbar } from '@/components/skrum/app-topbar';
import {
    AppFrame,
    AuthFrame,
    OnboardingFrame,
    SessionFrame,
    SettingsFrame,
} from '@/components/skrum/frames';

const sidebar: AppSidebarProps = {
    team: { id: 't1', name: 'Atlas', initials: 'AT', membersCount: 8 },
    teams: [],
    workspace: { id: 'w1', name: 'Nordlys' },
    workspaces: [],
    newWorkspaceHref: '/workspaces/create',
    homeHref: '/dashboard',
    links: { dashboard: '/t1', teams: '/w1' },
};

describe('AppFrame', () => {
    it('renders the sidebar, the topbar and the content in a main landmark', () => {
        renderWithProviders(
            <AppFrame
                sidebar={sidebar}
                topbar={
                    <AppTopbar
                        breadcrumbs={[{ title: 'Atlas', href: '/t1' }]}
                    />
                }
            >
                <p>content</p>
            </AppFrame>,
        );

        expect(
            screen.getAllByRole('navigation', { name: 'Navigation' }).length,
        ).toBeGreaterThan(0);
        expect(screen.getByRole('main').textContent).toContain('content');
        expect(screen.getByRole('banner').textContent).toContain('Atlas');
    });
});

describe('SessionFrame', () => {
    it('starts with the sidebar collapsed and shows the session slots', () => {
        const { container } = renderWithProviders(
            <SessionFrame
                sidebar={sidebar}
                title="Sprint 42"
                phases={<span>phases</span>}
                timer={<span>05:00</span>}
            >
                <p>board</p>
            </SessionFrame>,
        );

        expect(
            container.querySelector('[data-state="collapsed"]'),
        ).not.toBeNull();
        expect(screen.getByRole('banner').textContent).toContain('Sprint 42');
        expect(screen.getByRole('banner').textContent).toContain('phases');
        expect(screen.getByRole('banner').textContent).toContain('05:00');
    });
});

describe('SessionFrame header as a container', () => {
    it('is the container named session, whose width the phase rail follows', () => {
        renderWithProviders(
            <SessionFrame title="Sprint 42">
                <p>board</p>
            </SessionFrame>,
        );

        expect(screen.getByRole('banner').className).toContain(
            '@container/session',
        );
    });
});

describe('SessionFrame header order', () => {
    it('puts the logo first, the connection state before the timer and the viewer last', () => {
        renderWithProviders(
            <SessionFrame
                logo={<span>logo</span>}
                title="Sprint 42"
                status={<span>synced</span>}
                timer={<span>05:00</span>}
                presence={<span>2 online</span>}
                actions={<span>share</span>}
                avatar={<span>me</span>}
            >
                <p>board</p>
            </SessionFrame>,
        );

        expect(
            [...screen.getByRole('banner').children].map(
                (child) => child.textContent,
            ),
        ).toEqual([
            'logo',
            'Sprint 42',
            '',
            'synced',
            '05:00',
            '2 online',
            'share',
            'me',
        ]);
    });
});

describe('SessionFrame for a guest', () => {
    it('has no application sidebar and no sidebar trigger without a sidebar', () => {
        const { container } = renderWithProviders(
            <SessionFrame
                title="Sprint 42"
                phases={<span>phases</span>}
                presence={<span>2 online</span>}
            >
                <p>board</p>
            </SessionFrame>,
        );

        expect(screen.queryByRole('navigation')).toBeNull();
        expect(container.querySelector('[data-slot="sidebar"]')).toBeNull();
        expect(
            container.querySelector('[data-slot="sidebar-trigger"]'),
        ).toBeNull();
        expect(screen.queryByRole('button')).toBeNull();
        expect(screen.getByRole('banner').textContent).toContain('Sprint 42');
        expect(screen.getByRole('banner').textContent).toContain('2 online');
        expect(screen.getByRole('main').textContent).toContain('board');
    });

    it('shows the trigger again when a sidebar is given', () => {
        const { container } = renderWithProviders(
            <SessionFrame sidebar={sidebar} title="Sprint 42">
                <p>board</p>
            </SessionFrame>,
        );

        expect(
            container.querySelector('[data-slot="sidebar-trigger"]'),
        ).not.toBeNull();
    });
});

describe('SessionLayout', () => {
    it('gives a guest, who has no signed-in user, a session without the sidebar', () => {
        const { container } = renderWithProviders(
            <SessionLayout title="Sprint 42">
                <p>board</p>
            </SessionLayout>,
        );

        expect(container.querySelector('[data-slot="sidebar"]')).toBeNull();
        expect(
            container.querySelector('[data-slot="sidebar-trigger"]'),
        ).toBeNull();
        expect(screen.getByRole('main').textContent).toContain('board');
    });
});

describe('SettingsFrame', () => {
    it('marks the current section in a labelled sub-navigation', () => {
        renderWithProviders(
            <SettingsFrame
                title="Settings"
                navLabel="Settings"
                nav={[
                    {
                        label: 'Profile',
                        href: '/settings/profile',
                        current: true,
                    },
                    {
                        label: 'Security',
                        href: '/settings/security',
                        current: false,
                    },
                ]}
            >
                <p>form</p>
            </SettingsFrame>,
        );

        const nav = screen.getByRole('navigation', { name: 'Settings' });

        expect(nav).toBeTruthy();
        expect(
            screen
                .getByRole('link', { name: 'Profile' })
                .getAttribute('aria-current'),
        ).toBe('page');
        expect(
            screen
                .getByRole('link', { name: 'Security' })
                .getAttribute('aria-current'),
        ).toBeNull();
    });

    it('draws the icon of an entry before its label, hidden from assistive technology', () => {
        renderWithProviders(
            <SettingsFrame
                title="Settings"
                navLabel="Settings"
                nav={[
                    {
                        label: 'Profile',
                        href: '/settings/profile',
                        current: true,
                        icon: User,
                    },
                    {
                        label: 'Security',
                        href: '/settings/security',
                        current: false,
                    },
                ]}
            >
                <p>form</p>
            </SettingsFrame>,
        );

        const profile = screen.getByRole('link', { name: 'Profile' });
        const icon = profile.querySelector('[data-slot="sub-nav-icon"]');

        expect(icon?.getAttribute('aria-hidden')).toBe('true');
        expect(profile.firstElementChild).toBe(icon);
        expect(
            screen
                .getByRole('link', { name: 'Security' })
                .querySelector('[data-slot="sub-nav-icon"]'),
        ).toBeNull();
    });
});

describe('AuthFrame', () => {
    it('shows the title as the page heading and the logo', () => {
        renderWithProviders(
            <AuthFrame
                title="Log in to your account"
                description="Enter your email"
            >
                <p>form</p>
            </AuthFrame>,
        );

        expect(
            screen.getByRole('heading', {
                level: 1,
                name: 'Log in to your account',
            }),
        ).toBeTruthy();
        expect(
            screen.getAllByRole('img', { name: 'Skrüm' }).length,
        ).toBeGreaterThan(0);
    });
});

describe('AuthFrame with an instance brand', () => {
    it('replaces the Skrüm logo of the header by the instance logo', () => {
        renderWithProviders(
            <AuthFrame
                title="Log in"
                brand={{
                    name: 'Acme',
                    logoLightUrl: '/brand/logo-light?v=1',
                    logoDarkUrl: '/brand/logo-dark?v=2',
                }}
            >
                <p>form</p>
            </AuthFrame>,
        );

        const logos = within(screen.getByRole('banner')).getAllByRole('img');

        expect(logos.map((logo) => logo.getAttribute('src'))).toEqual([
            '/brand/logo-light?v=1',
            '/brand/logo-dark?v=2',
        ]);
        expect(logos.map((logo) => logo.getAttribute('alt'))).toEqual([
            'Acme',
            'Acme',
        ]);
        expect(logos[0].className).toContain('h-12');
        expect(logos[0].className).toContain('dark:hidden');
        expect(logos[1].className).toContain('dark:block');
    });

    it('keeps the Skrüm logo when the brand has no logo', () => {
        renderWithProviders(
            <AuthFrame
                title="Log in"
                brand={{ name: 'Acme', logoLightUrl: null, logoDarkUrl: null }}
            >
                <p>form</p>
            </AuthFrame>,
        );

        expect(
            within(screen.getByRole('banner')).getByRole('img', {
                name: 'Skrüm',
            }).tagName,
        ).toBe('svg');
    });

    it('renders a footer only when one is given', () => {
        const { unmount } = renderWithProviders(
            <AuthFrame title="Log in" footer="Powered by Skrüm">
                <p>form</p>
            </AuthFrame>,
        );

        expect(screen.getByRole('contentinfo').textContent).toBe(
            'Powered by Skrüm',
        );

        unmount();
        renderWithProviders(
            <AuthFrame title="Log in">
                <p>form</p>
            </AuthFrame>,
        );

        expect(screen.queryByRole('contentinfo')).toBeNull();
    });
});

describe('OnboardingFrame', () => {
    it('shows the instance logo in the header when the brand has one', () => {
        renderWithProviders(
            <OnboardingFrame
                brand={{
                    name: 'Acme',
                    logoLightUrl: '/brand/logo-light?v=1',
                    logoDarkUrl: null,
                }}
            >
                <p>step</p>
            </OnboardingFrame>,
        );

        const logo = within(screen.getByRole('banner')).getByRole('img', {
            name: 'Acme',
        });

        expect(logo.getAttribute('src')).toBe('/brand/logo-light?v=1');
        expect(logo.className).toContain('h-7');
    });

    it('renders the stepper in the header and the content in main', () => {
        renderWithProviders(
            <OnboardingFrame stepper={<ol aria-label="Steps" />}>
                <p>step</p>
            </OnboardingFrame>,
        );

        expect(screen.getByRole('banner').querySelector('ol')).not.toBeNull();
        expect(screen.getByRole('main').textContent).toContain('step');
    });
});

describe('AuthFrame centred', () => {
    it('has one column, a hidden page heading and no aside', () => {
        const { container } = renderWithProviders(
            <AuthFrame variant="centered" title="Sprint 42 retro">
                <h2>Join as a guest</h2>
            </AuthFrame>,
        );

        const heading = screen.getByRole('heading', { level: 1 });

        expect(heading.textContent).toBe('Sprint 42 retro');
        expect(heading.classList.contains('sr-only')).toBe(true);
        expect(container.querySelector('aside')).toBeNull();
        expect(screen.getByRole('main').textContent).toContain(
            'Join as a guest',
        );
    });
});
