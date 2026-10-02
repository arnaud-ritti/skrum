import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
    NotificationsBell,
    NotificationsPanel,
} from '@/components/skrum/notifications-panel';
import type {
    AppNotification,
    NotificationsPanelProps,
} from '@/components/skrum/notifications-panel';

const now = new Date('2026-10-01T12:00:00Z').getTime();

const invite: AppNotification = {
    id: 'n1',
    kind: 'team_invite',
    readAt: null,
    createdAt: '2026-10-01T11:58:00Z',
    actor: { name: 'Camille R.', presence: 5 },
    team: 'Atlas',
    href: '/teams/atlas',
};

const starting: AppNotification = {
    id: 'n2',
    kind: 'session_starting',
    readAt: null,
    createdAt: '2026-10-01T11:55:00Z',
    session: {
        id: 's1',
        title: 'Sprint 42 retro',
        startsAt: '2026-10-01T12:05:00Z',
        facilitator: 'Inès B.',
    },
    href: '/sessions/s1',
};

const overdue: AppNotification = {
    id: 'n3',
    kind: 'overdue',
    wording: 'overdue',
    readAt: null,
    createdAt: '2026-10-01T08:00:00Z',
    actionItem: {
        id: 'a1',
        content: 'Isolate E2E data',
        teamName: 'Atlas',
        dueOn: '2026-09-29',
        isOverdue: true,
        url: '/actions/a1',
        ticket: 'ATLAS-1287',
    },
};

const dueSoon = (
    id: string,
    wording: 'due_today' | 'due_tomorrow',
    content = 'Write the release notes',
): AppNotification => ({
    id,
    kind: 'due_soon',
    wording,
    readAt: null,
    createdAt: '2026-10-01T07:00:00Z',
    actionItem: {
        id: `action-${id}`,
        content,
        teamName: 'Atlas',
        dueOn: wording === 'due_today' ? '2026-10-01' : '2026-10-02',
        isOverdue: false,
        url: `/actions/${id}`,
    },
});

const mention: AppNotification = {
    id: 'n4',
    kind: 'mention',
    readAt: '2026-10-01T11:30:00Z',
    createdAt: '2026-10-01T11:00:00Z',
    actor: { name: 'Théo M.', presence: 2, others: 2 },
    excerpt: '@Arnaud look at the flaky test',
    session: {
        id: 's2',
        title: 'Sprint 42 retro',
        startsAt: '2026-10-01T10:00:00Z',
        facilitator: 'Inès B.',
    },
    href: '/cards/4',
};

const recap: AppNotification = {
    id: 'n5',
    kind: 'recap_ready',
    readAt: '2026-09-30T12:00:00Z',
    createdAt: '2026-09-30T12:00:00Z',
    session: {
        id: 's3',
        title: 'Sprint 41 retro',
        startsAt: '2026-09-30T10:00:00Z',
        facilitator: 'Inès B.',
        ended: true,
    },
    href: '/sessions/s3/recap',
};

function setup(overrides: Partial<NotificationsPanelProps> = {}) {
    const props: NotificationsPanelProps = {
        notifications: [invite, starting, overdue, mention, recap],
        unreadCount: 3,
        tab: 'all',
        onTabChange: vi.fn(),
        onMarkAllRead: vi.fn(),
        onOpen: vi.fn(),
        onInvite: vi.fn(),
        onJoin: vi.fn(),
        settingsHref: '/settings/notifications',
        locale: 'en',
        now,
        ...overrides,
    };

    const view = render(<NotificationsPanel {...props} />);

    return {
        ...props,
        rerender: (next: Partial<NotificationsPanelProps>) =>
            view.rerender(<NotificationsPanel {...props} {...next} />),
    };
}

function setupWithView(overrides: Partial<NotificationsPanelProps>) {
    return render(
        <NotificationsPanel
            notifications={[]}
            unreadCount={0}
            tab="all"
            onTabChange={vi.fn()}
            onMarkAllRead={vi.fn()}
            onOpen={vi.fn()}
            settingsHref="/settings/notifications"
            locale="en"
            now={now}
            {...overrides}
        />,
    );
}

describe('NotificationsPanel', () => {
    it('lists items with a hidden unread label only on unread ones', () => {
        setup();

        const items = screen.getAllByRole('listitem');

        expect(items).toHaveLength(5);
        expect(within(items[0]).getByText('Unread')).toBeTruthy();
        expect(within(items[3]).queryByText('Unread')).toBeNull();
    });

    it('reports invitation answers with the notification id', async () => {
        const props = setup();

        await userEvent.click(screen.getByRole('button', { name: 'Accept' }));
        await userEvent.click(screen.getByRole('button', { name: 'Decline' }));

        expect(props.onInvite).toHaveBeenNthCalledWith(1, 'n1', 'accept');
        expect(props.onInvite).toHaveBeenNthCalledWith(2, 'n1', 'decline');
    });

    it('removes the buttons once an invitation is answered', () => {
        setup({ notifications: [{ ...invite, answer: 'accepted' }] });

        expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull();
        expect(screen.getByText('Accepted · welcome to Atlas')).toBeTruthy();
    });

    it('joins a session from the Join button', async () => {
        const props = setup();

        await userEvent.click(screen.getByRole('button', { name: 'Join' }));

        expect(props.onJoin).toHaveBeenCalledWith('s1');
    });

    it('keeps Join after the session started', () => {
        setup({
            notifications: [
                {
                    ...starting,
                    session: {
                        id: 's1',
                        title: 'Sprint 42 retro',
                        facilitator: 'Inès B.',
                        startsAt: '2026-10-01T11:50:00Z',
                    },
                },
            ],
        });

        expect(screen.getByRole('button', { name: 'Join' })).toBeTruthy();
        expect(screen.getByText(/has started/)).toBeTruthy();
    });

    it('removes Join once the session has ended', () => {
        setup({
            notifications: [
                {
                    ...starting,
                    session: {
                        id: 's1',
                        title: 'Sprint 42 retro',
                        facilitator: 'Inès B.',
                        startsAt: '2026-10-01T12:05:00Z',
                        ended: true,
                    },
                },
            ],
        });

        expect(screen.queryByRole('button', { name: 'Join' })).toBeNull();
    });

    it('shows the overdue due date as text, with the ticket', () => {
        setup();

        expect(screen.getByText('Due Sep 29')).toBeTruthy();
        expect(screen.getByText('ATLAS-1287')).toBeTruthy();
    });

    it('renders the server payload with the three wordings and the team', () => {
        setup({
            notifications: [
                overdue,
                dueSoon('t1', 'due_today'),
                dueSoon('t2', 'due_tomorrow'),
            ],
            onInvite: undefined,
            onJoin: undefined,
        });

        expect(
            screen.getByRole('link', { name: 'Overdue: Isolate E2E data' }),
        ).toBeTruthy();
        expect(
            screen.getByRole('link', {
                name: 'Due today: Write the release notes',
            }),
        ).toBeTruthy();
        expect(
            screen
                .getByRole('link', {
                    name: 'Due tomorrow: Write the release notes',
                })
                .getAttribute('href'),
        ).toBe('/actions/t2');
        expect(screen.getAllByText('Atlas')).toHaveLength(3);
        expect(
            screen
                .getAllByRole('listitem')
                .map((item) => item.getAttribute('data-kind')),
        ).toEqual(['overdue', 'due_soon', 'due_soon']);
    });

    it('omits the due date when the action has none', () => {
        setup({
            notifications: [
                {
                    ...overdue,
                    actionItem: {
                        id: 'a1',
                        content: 'Isolate E2E data',
                        teamName: 'Atlas',
                        dueOn: null,
                        isOverdue: false,
                        url: '/actions/a1',
                    },
                },
            ],
        });

        expect(screen.queryByText(/^Due /)).toBeNull();
    });

    it('shows no Accept, Decline or Join without their handlers', () => {
        setup({ onInvite: undefined, onJoin: undefined });

        expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Decline' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Join' })).toBeNull();
        expect(screen.getAllByRole('listitem')).toHaveLength(5);
    });

    it('lists one and 200 notifications, with a 280-character action', () => {
        const long = 'A'.repeat(280);
        const { unmount } = setupWithView({
            notifications: [dueSoon('only', 'due_today', long)],
            unreadCount: 1,
        });

        expect(screen.getAllByRole('listitem')).toHaveLength(1);
        expect(
            screen.getByRole('link', { name: `Due today: ${long}` }),
        ).toBeTruthy();
        unmount();

        setup({
            notifications: Array.from({ length: 200 }, (_, index) =>
                dueSoon(`n${index}`, 'due_tomorrow'),
            ),
            unreadCount: 200,
        });

        expect(screen.getAllByRole('listitem')).toHaveLength(200);
        expect(screen.getByRole('tab', { name: 'All,200' })).toBeTruthy();
    });

    it('shows the empty state for zero notifications', () => {
        setup({ notifications: [], unreadCount: 0 });

        expect(screen.getByText('No notifications yet')).toBeTruthy();
        expect(screen.queryByRole('list')).toBeNull();
    });

    it('reports a failed load with a retry', async () => {
        const onRetry = vi.fn();

        setup({ failed: true, onRetry });

        expect(screen.getByRole('alert').textContent).toContain(
            'Could not load the notifications.',
        );
        expect(screen.queryByRole('list')).toBeNull();

        await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('keeps mark all read focused and inert while the request runs', async () => {
        const props = setup();
        const button = screen.getByRole('button', { name: 'Mark all as read' });

        await userEvent.click(button);
        expect(props.onMarkAllRead).toHaveBeenCalledTimes(1);

        props.rerender({ markingAllRead: true });

        expect(button.getAttribute('aria-disabled')).toBe('true');
        expect(document.activeElement).toBe(button);

        await userEvent.click(button);
        await userEvent.keyboard('{Enter}');
        expect(props.onMarkAllRead).toHaveBeenCalledTimes(1);

        props.rerender({ markingAllRead: false, unreadCount: 0 });

        expect(document.activeElement).toBe(button);
        expect(button.getAttribute('aria-disabled')).toBe('true');
    });

    it('opens an item through its link and lets modified clicks through', () => {
        const props = setup();
        const link = screen.getByRole('link', { name: /Overdue: / });

        expect(link.getAttribute('href')).toBe('/actions/a1');

        fireEvent.click(link);
        expect(props.onOpen).toHaveBeenCalledWith(overdue);

        fireEvent.click(link, { ctrlKey: true });
        expect(props.onOpen).toHaveBeenCalledTimes(1);
    });

    it('does not mark anything read just by rendering', () => {
        const props = setup();

        expect(props.onOpen).not.toHaveBeenCalled();
        expect(props.onMarkAllRead).not.toHaveBeenCalled();
    });

    it('marks all read, and disables it when nothing is unread', async () => {
        const props = setup();

        await userEvent.click(
            screen.getByRole('button', { name: 'Mark all as read' }),
        );

        expect(props.onMarkAllRead).toHaveBeenCalledTimes(1);
    });

    it('disables mark all read at zero unread', () => {
        const props = setup({ unreadCount: 0 });

        const button = screen.getByRole('button', { name: 'Mark all as read' });

        expect(button.getAttribute('aria-disabled')).toBe('true');

        fireEvent.click(button);
        expect(props.onMarkAllRead).not.toHaveBeenCalled();
    });

    it('switches tabs and shows counts', async () => {
        const props = setup();

        expect(screen.getByRole('tab', { name: 'All,5' })).toBeTruthy();

        await userEvent.click(screen.getByRole('tab', { name: 'Unread,3' }));

        expect(props.onTabChange).toHaveBeenCalledWith('unread');
    });

    it('filters to unread notifications on the unread tab', () => {
        setup({ tab: 'unread' });

        expect(screen.getAllByRole('listitem')).toHaveLength(3);
    });

    it('shows the empty state on an empty unread tab', () => {
        setup({ tab: 'unread', notifications: [recap], unreadCount: 0 });

        expect(screen.getByText('You’re all caught up')).toBeTruthy();
        expect(screen.queryByRole('list')).toBeNull();
    });

    it('shows three skeleton items while loading', () => {
        setup({ loading: true });

        const loading = document.querySelector(
            '[data-slot="notifications-loading"]',
        );

        expect(loading?.getAttribute('aria-busy')).toBe('true');
        expect(loading?.children).toHaveLength(3);
        expect(screen.queryByRole('list')).toBeNull();
    });

    it('moves focus between items with the arrow keys', async () => {
        setup();

        const links = screen
            .getAllByRole('link')
            .filter((link) => link.hasAttribute('data-notification-link'));

        links[0].focus();
        await userEvent.keyboard('{ArrowDown}');
        expect(document.activeElement).toBe(links[1]);

        await userEvent.keyboard('{ArrowUp}');
        expect(document.activeElement).toBe(links[0]);
    });

    it('groups mentions and quotes the excerpt', () => {
        setup();

        expect(
            screen.getByRole('link', { name: /and 2 others mentioned you/ }),
        ).toBeTruthy();
        expect(screen.getByText('@Arnaud look at the flaky test')).toBeTruthy();
    });

    it('offers Load more only when there is more and a handler', async () => {
        const onLoadMore = vi.fn();

        setup({ hasMore: true, onLoadMore });

        await userEvent.click(
            screen.getByRole('button', { name: 'Load more' }),
        );

        expect(onLoadMore).toHaveBeenCalledTimes(1);
    });

    it('hides Load more without a handler', () => {
        setup({ hasMore: true });

        expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
    });

    it('links to the notification settings', () => {
        setup();

        expect(
            screen
                .getByRole('link', { name: 'Notification settings' })
                .getAttribute('href'),
        ).toBe('/settings/notifications');
    });
});

describe('NotificationsBell', () => {
    it('puts the count in the accessible name and hides the badge', () => {
        render(<NotificationsBell unreadCount={3} />);

        const bell = screen.getByRole('button', {
            name: 'Notifications, 3 unread',
        });

        expect(bell.getAttribute('aria-haspopup')).toBe('dialog');
        expect(bell.getAttribute('aria-expanded')).toBe('false');
        expect(
            bell
                .querySelector('[data-slot="notifications-badge"]')
                ?.getAttribute('aria-hidden'),
        ).toBe('true');
    });

    it('has no badge at zero and caps the badge at 9+', () => {
        const { rerender } = render(<NotificationsBell unreadCount={0} />);

        expect(
            screen.getByRole('button', { name: 'Notifications' }),
        ).toBeTruthy();
        expect(
            document.querySelector('[data-slot="notifications-badge"]'),
        ).toBeNull();

        rerender(<NotificationsBell unreadCount={12} open />);

        expect(
            document.querySelector('[data-slot="notifications-badge"]')
                ?.textContent,
        ).toBe('9+');
        expect(
            screen
                .getByRole('button', { name: 'Notifications, 12 unread' })
                .getAttribute('aria-expanded'),
        ).toBe('true');
    });

    it('announces a new arrival in a polite live region', () => {
        render(
            <NotificationsBell
                unreadCount={1}
                announcement="New notification: Sprint 42 retro starts in 5 min"
            />,
        );

        const region = screen.getByRole('status');

        expect(region.getAttribute('aria-live')).toBe('polite');
        expect(region.textContent).toContain('Sprint 42 retro starts in 5 min');
    });
});
