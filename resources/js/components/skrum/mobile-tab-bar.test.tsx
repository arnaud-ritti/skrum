import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MobileTabBar } from '@/components/skrum/mobile-tab-bar';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {} } }),
}));

describe('MobileTabBar', () => {
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
