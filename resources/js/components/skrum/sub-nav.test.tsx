import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SubNav } from './sub-nav';

describe('SubNav', () => {
    it('keeps two entries that share a label', () => {
        const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

        render(
            <SubNav
                label="Team settings"
                items={[
                    { label: 'Team', href: '/a', current: true },
                    { label: 'Team', href: '/b', current: false },
                ]}
            />,
        );

        expect(screen.getAllByRole('link', { name: 'Team' })).toHaveLength(2);
        expect(errors).not.toHaveBeenCalled();
        errors.mockRestore();
    });

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

    it('stays under the top bar below lg only where the page asks for it', () => {
        const items = [{ label: 'Team', href: '/team', current: true }];
        const { rerender } = render(<SubNav label="Settings" items={items} />);
        const nav = screen.getByRole('navigation', { name: 'Settings' });

        expect(nav.hasAttribute('data-stuck')).toBe(false);
        expect(nav.className).not.toContain('max-lg:sticky');

        rerender(<SubNav label="Settings" items={items} stuck />);

        expect(nav.hasAttribute('data-stuck')).toBe(true);
        expect(nav.className).toContain('max-lg:sticky max-lg:top-14');
        expect(nav.className).toContain('lg:sticky lg:top-20');
    });
});
