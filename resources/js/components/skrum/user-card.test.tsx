import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';
import { UserCard } from '@/components/skrum/user-card';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { SidebarProvider } from '@/components/ui/sidebar';
import { renderWithProviders } from '@/test/render';

function renderCard(props: Parameters<typeof UserCard>[0]) {
    return renderWithProviders(
        <SidebarProvider>
            <UserCard {...props} />
        </SidebarProvider>,
    );
}

describe('UserCard', () => {
    beforeAll(() => {
        globalThis.ResizeObserver ??= class {
            observe(): void {}
            unobserve(): void {}
            disconnect(): void {}
        };
    });

    it('shows the name, the role and the initials fallback', () => {
        renderCard({ user: { name: 'Ada Lovelace', role: 'Admin' } });

        expect(screen.getByText('Ada Lovelace')).toBeTruthy();
        expect(screen.getByText('Admin')).toBeTruthy();
        expect(screen.getByText('AL')).toBeTruthy();
    });

    it('truncates a 60-character name', () => {
        const name = 'N'.repeat(60);

        renderCard({ user: { name, role: 'Member' } });

        expect(screen.getByText(name).className).toContain('truncate');
    });

    it('opens the menu slot from the card', async () => {
        const user = userEvent.setup();

        renderCard({
            user: { name: 'Ada Lovelace', role: 'Admin' },
            menu: <DropdownMenuItem>Sign out</DropdownMenuItem>,
        });

        await user.click(screen.getByRole('button', { name: /Ada Lovelace/ }));

        expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeTruthy();
    });

    it('is not a button without a menu', () => {
        renderCard({ user: { name: 'Ada Lovelace', role: 'Admin' } });

        expect(screen.queryByRole('button')).toBeNull();
    });

    it('updates when the user changes', () => {
        const { rerender } = renderCard({
            user: { name: 'Ada Lovelace', role: 'Admin' },
        });

        rerender(
            <SidebarProvider>
                <UserCard user={{ name: 'Grace Hopper', role: 'Member' }} />
            </SidebarProvider>,
        );

        expect(screen.getByText('Grace Hopper')).toBeTruthy();
        expect(screen.getByText('GH')).toBeTruthy();
    });
});
