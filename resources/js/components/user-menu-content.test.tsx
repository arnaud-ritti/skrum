import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserMenuContent } from '@/components/user-menu-content';
import { renderWithProviders } from '@/test/render';
import type { User } from '@/types';

const user: User = {
    id: '0199a000-0000-7000-8000-000000000001',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    avatarUrl: '/avatars/a.svg',
    email_verified_at: '2026-01-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
};

function renderMenu(): void {
    renderWithProviders(
        <DropdownMenu open>
            <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
            <DropdownMenuContent>
                <UserMenuContent user={user} />
            </DropdownMenuContent>
        </DropdownMenu>,
    );
}

describe('UserMenuContent', () => {
    it('links to the About page', () => {
        renderMenu();

        const about = screen.getByRole('menuitem', { name: 'About' });

        expect(about.getAttribute('href')).toBe('/about');
    });

    it('keeps the settings and log out entries', () => {
        renderMenu();

        expect(screen.getByRole('menuitem', { name: 'Settings' })).toBeTruthy();
        expect(screen.getByRole('menuitem', { name: 'Log out' })).toBeTruthy();
    });
});
