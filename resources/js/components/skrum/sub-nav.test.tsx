import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SubNav } from './sub-nav';

describe('SubNav', () => {
    it('marks the page in use among links to other pages', () => {
        render(
            <SubNav
                label="Team settings"
                items={[
                    { label: 'Team', href: '/team', current: true },
                    {
                        label: 'Integrations',
                        href: '/integrations',
                        current: false,
                    },
                ]}
            />,
        );

        const team = screen.getByRole('link', { name: 'Team' });

        expect(team.getAttribute('aria-current')).toBe('page');
        expect(team.hasAttribute('data-current')).toBe(true);
        expect(
            screen
                .getByRole('link', { name: 'Integrations' })
                .hasAttribute('aria-current'),
        ).toBe(false);
    });

    it('links to a place of the page in view with a plain anchor, current as a location', () => {
        const onSelect = vi.fn();

        render(
            <SubNav
                label="Settings"
                items={[
                    {
                        label: 'Profile',
                        href: '#profile',
                        current: false,
                        inPage: true,
                        onSelect,
                    },
                    {
                        label: 'Security',
                        href: '#security',
                        current: true,
                        inPage: true,
                        onSelect,
                    },
                ]}
            />,
        );

        const security = screen.getByRole('link', { name: 'Security' });
        const profile = screen.getByRole('link', { name: 'Profile' });

        expect(security.getAttribute('href')).toBe('#security');
        expect(security.getAttribute('aria-current')).toBe('location');
        expect(security.hasAttribute('data-current')).toBe(true);
        expect(profile.hasAttribute('aria-current')).toBe(false);
        expect(profile.hasAttribute('data-current')).toBe(false);

        fireEvent.click(profile);

        expect(onSelect).toHaveBeenCalledTimes(1);
    });
});
