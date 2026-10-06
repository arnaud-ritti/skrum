import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MobileTabBar } from '@/components/skrum/mobile-tab-bar';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {} } }),
}));

const links = {
    dashboard: '/w/nordlys/teams/t1',
    sessions: '/w/nordlys/teams/t1/sessions',
    actions: '/w/nordlys/action-items?team=t1',
    insights: '/w/nordlys/teams/t1/insights',
};

function itemNames(): (string | null)[] {
    return Array.from(
        screen.getByRole('navigation', { name: 'Tab bar' }).children,
    ).map((item) => item.getAttribute('aria-label') ?? item.textContent);
}

describe('MobileTabBar', () => {
    it('shows Home, Sessions, New session, Actions and More', () => {
        render(
            <MobileTabBar
                links={links}
                newSessionHref="/w/nordlys/teams/t1?new=session"
                onMore={() => {}}
            />,
        );

        expect(itemNames()).toEqual([
            'Home',
            'Sessions',
            'New session',
            'Actions',
            'More',
        ]);
        expect(
            screen
                .getByRole('link', { name: 'New session' })
                .getAttribute('href'),
        ).toBe('/w/nordlys/teams/t1?new=session');
    });

    it('shows four items to someone who may create nothing', () => {
        render(<MobileTabBar links={links} onMore={() => {}} />);

        expect(itemNames()).toEqual(['Home', 'Sessions', 'Actions', 'More']);
    });

    it('marks Sessions when a session is live', () => {
        const { container, rerender } = render(
            <MobileTabBar links={links} liveSessions={2} onMore={() => {}} />,
        );

        expect(
            screen
                .getByRole('link', { name: 'Sessions, 2 live' })
                .querySelector('[data-slot="live-dot"]'),
        ).not.toBeNull();

        rerender(
            <MobileTabBar links={links} liveSessions={0} onMore={() => {}} />,
        );

        expect(screen.getByRole('link', { name: 'Sessions' })).toBeTruthy();
        expect(container.querySelector('[data-slot="live-dot"]')).toBeNull();
    });

    it('leads Sessions to the Sessions page and marks it on that page', () => {
        render(
            <MobileTabBar
                active="sessions"
                links={{
                    dashboard: '/w/nordlys/teams/t1',
                    sessions: '/w/nordlys/teams/t1/sessions',
                }}
                onMore={() => {}}
            />,
        );

        const sessions = screen.getByRole('link', { name: 'Sessions' });

        expect(sessions.getAttribute('href')).toBe(
            '/w/nordlys/teams/t1/sessions',
        );
        expect(sessions.getAttribute('aria-current')).toBe('page');
        expect(
            screen
                .getByRole('link', { name: 'Home' })
                .getAttribute('aria-current'),
        ).toBeNull();
    });

    it('leaves out an entry without a link', () => {
        render(<MobileTabBar links={{}} onMore={() => {}} />);

        expect(screen.queryByRole('link', { name: 'Sessions' })).toBeNull();
        expect(screen.getByRole('button', { name: 'More' })).toBeTruthy();
    });
});
