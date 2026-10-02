import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationsMenu } from '@/components/action-items/notifications-menu';
import type { AppNotification } from '@/components/skrum/notifications-panel';

const invitation: AppNotification = {
    id: 'n3',
    kind: 'team_invite',
    readAt: null,
    createdAt: '2026-09-29T08:00:00Z',
    actor: { name: 'Camille R.', presence: 5 },
    team: 'Orbit',
    href: '/invitations/secret-token',
};

const load = vi.fn(async () => {});
const loadMore = vi.fn(async () => {});
const stopWatching = vi.fn();
const open = vi.fn(async () => {});
const markAllRead = vi.fn(async () => {});

function idleModel() {
    return {
        available: true,
        notifications: [] as AppNotification[],
        unreadCount: 2,
        hasMore: false,
        loading: false,
        failed: false,
        markingAllRead: false,
        arriving: false,
        load,
        loadMore,
        stopWatching,
        open,
        markAllRead,
    };
}

let model = idleModel();
let isWide = true;

vi.mock('@/hooks/use-notifications', () => ({
    useNotifications: () => model,
}));
vi.mock('@/hooks/use-min-width', () => ({ useMinWidth: () => isWide }));
vi.mock('@/routes/notificationPreferences', () => ({
    edit: { url: () => '/settings/notifications' },
}));
vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { locale: 'en', translations: {} } }),
}));

describe('NotificationsMenu', () => {
    beforeEach(() => {
        model = idleModel();
        isWide = true;
        load.mockClear();
        loadMore.mockClear();
        stopWatching.mockClear();
        open.mockClear();
    });

    it('names the bell as the mockup, with the count in the name', () => {
        const { rerender } = render(<NotificationsMenu />);

        expect(
            screen.getByRole('button', { name: 'Notifications, 2 unread' }),
        ).toBeTruthy();

        model = { ...model, unreadCount: 0 };
        rerender(<NotificationsMenu />);

        expect(
            screen.getByRole('button', { name: 'Notifications' }),
        ).toBeTruthy();
    });

    it('loads the list when it opens, in a dialog named by its title', () => {
        render(<NotificationsMenu />);

        expect(load).not.toHaveBeenCalled();

        fireEvent.click(
            screen.getByRole('button', { name: 'Notifications, 2 unread' }),
        );

        expect(load).toHaveBeenCalledTimes(1);
        expect(
            screen.getByRole('dialog', { name: 'Notifications' }),
        ).toBeTruthy();
        expect(
            screen
                .getByRole('link', { name: 'Notification settings' })
                .getAttribute('href'),
        ).toBe('/settings/notifications');
    });

    it('offers an invitation one link to its page, and nothing that accepts it', () => {
        model = { ...model, notifications: [invitation], unreadCount: 1 };
        render(<NotificationsMenu />);
        fireEvent.click(
            screen.getByRole('button', { name: 'Notifications, 1 unread' }),
        );

        const dialog = screen.getByRole('dialog');

        expect(
            within(dialog).queryByRole('button', { name: 'Accept' }),
        ).toBeNull();
        expect(
            within(dialog).queryByRole('button', { name: 'Decline' }),
        ).toBeNull();

        fireEvent.click(
            within(dialog).getByRole('link', { name: 'View invitation' }),
        );

        expect(open).toHaveBeenCalledWith(invitation);
        expect(stopWatching).toHaveBeenCalledTimes(1);
    });

    it('offers Load more when the server has more', () => {
        model = { ...model, notifications: [invitation], hasMore: true };
        render(<NotificationsMenu />);
        fireEvent.click(
            screen.getByRole('button', { name: 'Notifications, 2 unread' }),
        );

        fireEvent.click(screen.getByRole('button', { name: 'Load more' }));

        expect(loadMore).toHaveBeenCalledTimes(1);
    });

    it('rings and announces an arrival', () => {
        model = { ...model, arriving: true };
        render(<NotificationsMenu />);

        expect(
            screen
                .getByRole('button', { name: 'Notifications, 2 unread' })
                .getAttribute('data-arriving'),
        ).toBe('true');
        expect(screen.getByRole('status').textContent).toBe('New notification');
    });

    it('opens a drawer titled Notifications on a phone', () => {
        isWide = false;
        render(<NotificationsMenu />);

        fireEvent.click(
            screen.getByRole('button', { name: 'Notifications, 2 unread' }),
        );

        expect(load).toHaveBeenCalledTimes(1);
        expect(
            document.querySelector('[data-slot="drawer-content"]'),
        ).not.toBeNull();
        expect(
            document.querySelector('[data-slot="drawer-title"]')?.textContent,
        ).toBe('Notifications');
    });

    it('renders nothing for a guest', () => {
        model = { ...model, available: false };

        expect(render(<NotificationsMenu />).container.innerHTML).toBe('');
    });
});
