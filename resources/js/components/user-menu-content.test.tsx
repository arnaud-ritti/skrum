import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserMenuContent } from '@/components/user-menu-content';
import { openKeyboardShortcutsEvent } from '@/lib/shortcuts/events';
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
    it('opens the website documentation in a new tab', () => {
        renderMenu();

        const link = screen.getByRole('menuitem', { name: 'Documentation' });

        expect(link.getAttribute('href')).toBe(
            'https://arnaud-ritti.github.io/skrum/docs/',
        );
        expect(link.getAttribute('target')).toBe('_blank');
        expect(link.getAttribute('rel')).toBe('noreferrer noopener');
    });

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

    it('asks for the keyboard shortcuts dialog', () => {
        const heard = vi.fn();

        window.addEventListener(openKeyboardShortcutsEvent, heard);
        renderMenu();

        const entry = screen.getByRole('menuitem', {
            name: 'Keyboard shortcuts',
        });

        expect(entry.getAttribute('aria-keyshortcuts')).toBe('?');

        fireEvent.click(entry);
        window.removeEventListener(openKeyboardShortcutsEvent, heard);

        expect(heard).toHaveBeenCalledTimes(1);
    });
});
