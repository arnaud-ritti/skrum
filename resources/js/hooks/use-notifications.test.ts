import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppNotification } from '@/components/skrum/notifications-panel';
import { useNotifications } from '@/hooks/use-notifications';
import { retroRequest } from '@/lib/retro/api';

const visit = vi.fn();
const reload = vi.fn();
const leave = vi.fn();
const privateChannel = vi.fn();
let shared: { unreadCount: number } | null = { unreadCount: 2 };
let echoConfigured = false;
let received: (payload: { unreadCount?: number }) => void = () => {};

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest: vi.fn(),
}));

vi.mock('@laravel/echo-react', () => ({
    echoIsConfigured: () => echoConfigured,
    echo: () => ({
        private: (name: string) => {
            privateChannel(name);

            return {
                listen: (
                    event: string,
                    callback: (payload: { unreadCount?: number }) => void,
                ) => {
                    if (event === '.notification.received') {
                        received = callback;
                    }
                },
            };
        },
        leave: (name: string) => leave(name),
        socketId: () => undefined,
    }),
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    router: {
        visit: (...args: unknown[]) => visit(...args),
        reload: (...args: unknown[]) => reload(...args),
    },
    usePage: () => ({
        props: {
            notifications: shared,
            auth: { user: shared ? { id: 'u1' } : null },
            locale: 'en',
            translations: {},
        },
    }),
}));

const request = vi.mocked(retroRequest);

const unread: AppNotification = {
    id: 'n1',
    kind: 'overdue',
    wording: 'overdue',
    readAt: null,
    createdAt: '2026-10-01T08:00:00Z',
    actionItem: {
        id: 'a1',
        content: 'Fix the build',
        teamName: 'Atlas',
        dueOn: '2026-09-30',
        isOverdue: true,
        url: '/workspaces/w/action-items?item=a1',
        ticket: null,
    },
};

const recap: AppNotification = {
    id: 'n2',
    kind: 'recap_ready',
    readAt: null,
    createdAt: '2026-09-30T08:00:00Z',
    team: 'Atlas',
    session: { id: 'r1', title: 'Sprint 41 retro' },
    actionsCount: 4,
    roti: 3.8,
    href: '/retros/r1',
};

const invitation: AppNotification = {
    id: 'n3',
    kind: 'team_invite',
    readAt: '2026-09-29T09:00:00Z',
    createdAt: '2026-09-29T08:00:00Z',
    actor: { name: 'Camille R.', presence: 5, avatarUrl: '/avatars/c.svg' },
    team: 'Orbit',
    href: '/invitations/secret-token',
};

function page(
    notifications: AppNotification[],
    unreadCount: number,
    hasMore = false,
) {
    return { notifications, unreadCount, hasMore } as never;
}

describe('useNotifications', () => {
    beforeEach(() => {
        request.mockReset();
        visit.mockReset();
        reload.mockReset();
        leave.mockReset();
        privateChannel.mockReset();
        shared = { unreadCount: 2 };
        echoConfigured = false;
        received = () => {};
    });

    afterEach(() => vi.useRealTimers());

    it('is unavailable for a guest, and listens to no channel', () => {
        shared = null;
        echoConfigured = true;

        expect(
            renderHook(() => useNotifications()).result.current.available,
        ).toBe(false);
        expect(privateChannel).not.toHaveBeenCalled();
    });

    it('starts from the shared count and loads the list on demand', async () => {
        request.mockResolvedValueOnce(page([unread], 1));
        const { result } = renderHook(() => useNotifications());

        expect(result.current.unreadCount).toBe(2);
        expect(request).not.toHaveBeenCalled();
        await act(() => result.current.load());

        expect(result.current.notifications).toEqual([unread]);
        expect(result.current.unreadCount).toBe(1);
        expect(result.current.failed).toBe(false);
    });

    it('passes the three kinds of the server through, and changes no read mark by loading', async () => {
        request.mockResolvedValueOnce(page([unread, recap, invitation], 2));
        const { result } = renderHook(() => useNotifications());

        await act(() => result.current.load());

        expect(result.current.notifications).toEqual([
            unread,
            recap,
            invitation,
        ]);
        expect(request).toHaveBeenCalledTimes(1);
        expect(request.mock.calls[0][0].method).toBe('get');
    });

    it('reports a failed load and keeps the previous list', async () => {
        request.mockResolvedValueOnce(page([unread], 1));
        request.mockRejectedValueOnce(new Error('offline'));
        const { result } = renderHook(() => useNotifications());

        await act(() => result.current.load());
        await act(() => result.current.load());

        expect(result.current.failed).toBe(true);
        expect(result.current.notifications).toEqual([unread]);
    });

    it('drops the answer of an older load', async () => {
        let resolveFirst: (value: unknown) => void = () => {};
        request.mockImplementationOnce(
            () => new Promise((resolve) => (resolveFirst = resolve)) as never,
        );
        request.mockResolvedValueOnce(page([], 0));
        const { result } = renderHook(() => useNotifications());

        let first: Promise<void> = Promise.resolve();

        act(() => {
            first = result.current.load();
        });
        await act(() => result.current.load());
        await act(async () => {
            resolveFirst({ notifications: [unread], unreadCount: 1 });
            await first;
        });

        expect(result.current.notifications).toEqual([]);
    });

    it('shows the skeleton for the first load only', async () => {
        let resolveFirst: (value: unknown) => void = () => {};
        request.mockImplementationOnce(
            () => new Promise((resolve) => (resolveFirst = resolve)) as never,
        );
        request.mockImplementationOnce(() => new Promise(() => {}) as never);
        const { result } = renderHook(() => useNotifications());

        let first: Promise<void> = Promise.resolve();

        act(() => {
            first = result.current.load();
        });
        expect(result.current.loading).toBe(true);

        await act(async () => {
            resolveFirst({ notifications: [unread], unreadCount: 1 });
            await first;
        });
        expect(result.current.loading).toBe(false);

        act(() => {
            void result.current.load();
        });
        expect(result.current.loading).toBe(false);
    });

    it('marks an unread notification read, then visits its item even if marking fails', async () => {
        request.mockRejectedValueOnce(new Error('offline'));
        const { result } = renderHook(() => useNotifications());

        await act(() => result.current.open(unread));

        expect(request.mock.calls[0][1]).toEqual({ read: true });
        expect(visit).toHaveBeenCalledWith(
            '/workspaces/w/action-items?item=a1',
        );
    });

    it('marks a recap read and opens it', async () => {
        request.mockResolvedValueOnce({ unreadCount: 1 } as never);
        const { result } = renderHook(() => useNotifications());

        await act(() => result.current.open(recap));

        expect(request.mock.calls[0][0].url).toContain('/notifications/n2');
        expect(result.current.unreadCount).toBe(1);
        expect(visit).toHaveBeenCalledWith('/retros/r1');
    });

    it('opens the invitation page of a read invitation and sends nothing else', async () => {
        const { result } = renderHook(() => useNotifications());

        await act(() => result.current.open(invitation));

        expect(request).not.toHaveBeenCalled();
        expect(visit).toHaveBeenCalledWith('/invitations/secret-token');
    });

    it('marks everything read once at a time', async () => {
        request.mockResolvedValueOnce(page([unread], 1));
        request.mockResolvedValueOnce(null as never);
        const { result } = renderHook(() => useNotifications());
        await act(() => result.current.load());

        await act(() => result.current.markAllRead());

        expect(result.current.unreadCount).toBe(0);
        expect(result.current.notifications[0].readAt).not.toBeNull();
    });

    it('loads the next page after the last item and appends it', async () => {
        request.mockResolvedValueOnce(page([unread, recap], 2, true));
        request.mockResolvedValueOnce(page([invitation], 2, false));
        const { result } = renderHook(() => useNotifications());
        await act(() => result.current.load());

        expect(result.current.hasMore).toBe(true);
        await act(() => result.current.loadMore());

        expect(request.mock.calls[1][0].url).toContain('before=n2');
        expect(result.current.notifications).toEqual([
            unread,
            recap,
            invitation,
        ]);
        expect(result.current.hasMore).toBe(false);
    });

    it('asks for no page when there is none left', async () => {
        request.mockResolvedValueOnce(page([unread], 1, false));
        const { result } = renderHook(() => useNotifications());
        await act(() => result.current.load());

        await act(() => result.current.loadMore());

        expect(request).toHaveBeenCalledTimes(1);
    });

    it('refreshes the shared counts when the window gets the focus', async () => {
        renderHook(() => useNotifications());

        window.dispatchEvent(new Event('focus'));

        await waitFor(() =>
            expect(reload).toHaveBeenCalledWith({
                only: ['notifications', 'actionItems'],
            }),
        );
    });

    it('takes the count of an arrival from the private channel of the user, without reading the list of a closed panel', () => {
        vi.useFakeTimers();
        echoConfigured = true;
        const { result, unmount } = renderHook(() => useNotifications());

        expect(privateChannel).toHaveBeenCalledWith('user.u1');

        act(() => received({ unreadCount: 5 }));

        expect(result.current.unreadCount).toBe(5);
        expect(result.current.arriving).toBe(true);
        expect(request).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(4000);
        });

        expect(result.current.arriving).toBe(false);

        unmount();

        expect(leave).toHaveBeenCalledWith('user.u1');
    });

    it('reads the first page again on an arrival while the panel is open, and keeps the older pages', async () => {
        echoConfigured = true;
        request.mockResolvedValueOnce(page([unread], 1, true));
        request.mockResolvedValueOnce(page([invitation], 1, false));
        request.mockResolvedValueOnce(page([recap, unread], 2, true));
        const { result } = renderHook(() => useNotifications());
        await act(() => result.current.load());
        await act(() => result.current.loadMore());

        act(() => received({ unreadCount: 2 }));

        await waitFor(() =>
            expect(result.current.notifications).toEqual([
                recap,
                unread,
                invitation,
            ]),
        );
        expect(result.current.loading).toBe(false);

        act(() => result.current.stopWatching());
        act(() => received({ unreadCount: 3 }));

        expect(request).toHaveBeenCalledTimes(3);
        expect(result.current.unreadCount).toBe(3);
    });
});
