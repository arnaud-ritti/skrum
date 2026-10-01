import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AppSidebarProps } from '@/components/skrum/app-sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
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
        render(
            <TooltipProvider>
                <AppFrame
                    sidebar={sidebar}
                    topbar={
                        <AppTopbar
                            breadcrumbs={[{ title: 'Atlas', href: '/t1' }]}
                        />
                    }
                >
                    <p>content</p>
                </AppFrame>
            </TooltipProvider>,
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
        const { container } = render(
            <TooltipProvider>
                <SessionFrame
                    sidebar={sidebar}
                    title="Sprint 42"
                    phases={<span>phases</span>}
                    timer={<span>05:00</span>}
                >
                    <p>board</p>
                </SessionFrame>
            </TooltipProvider>,
        );

        expect(
            container.querySelector('[data-state="collapsed"]'),
        ).not.toBeNull();
        expect(screen.getByRole('banner').textContent).toContain('Sprint 42');
        expect(screen.getByRole('banner').textContent).toContain('phases');
        expect(screen.getByRole('banner').textContent).toContain('05:00');
    });
});

describe('SettingsFrame', () => {
    it('marks the current section in a labelled sub-navigation', () => {
        render(
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
});

describe('AuthFrame', () => {
    it('shows the title as the page heading and the logo', () => {
        render(
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

describe('OnboardingFrame', () => {
    it('renders the stepper in the header and the content in main', () => {
        render(
            <OnboardingFrame stepper={<ol aria-label="Steps" />}>
                <p>step</p>
            </OnboardingFrame>,
        );

        expect(screen.getByRole('banner').querySelector('ol')).not.toBeNull();
        expect(screen.getByRole('main').textContent).toContain('step');
    });
});
