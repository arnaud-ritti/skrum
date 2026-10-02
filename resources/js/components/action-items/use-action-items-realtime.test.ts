import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    ReloadProps,
    replaceActionItem,
    useActionItemsRealtime,
} from '@/components/action-items/use-action-items-realtime';
import type { ActionItem } from '@/lib/retro/types';
import { actionItemFixture } from '@/test/action-items';

type Listener = (payload: unknown) => void;

const realtime = vi.hoisted(() => ({
    configured: true,
    status: 'connected',
    channels: new Map<string, Map<string, (payload: unknown) => void>>(),
    subscribed: new Map<string, () => void>(),
    left: [] as string[],
}));

const inertia = vi.hoisted(() => ({ reload: vi.fn() }));

vi.mock('@laravel/echo-react', () => ({
    echoIsConfigured: () => realtime.configured,
    echo: () => ({
        connector: {
            onConnectionChange: () => () => {},
            connectionStatus: () => realtime.status,
        },
        private: (name: string) => {
            const listeners = new Map<string, Listener>();

            realtime.channels.set(name, listeners);

            const channel = {
                subscribed: (callback: () => void) => {
                    realtime.subscribed.set(name, callback);

                    return channel;
                },
                listen: (event: string, listener: Listener) => {
                    listeners.set(event, listener);

                    return channel;
                },
            };

            return channel;
        },
        leave: (name: string) => {
            realtime.left.push(name);
        },
    }),
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const original = await importOriginal<typeof import('@inertiajs/react')>();

    return { ...original, router: { reload: inertia.reload } };
});

const first = actionItemFixture({ id: 'item-1' });
const second = actionItemFixture({
    id: 'item-2',
    content: 'Write the runbook',
});

function emit(channel: string, event: string, payload: unknown): void {
    act(() => realtime.channels.get(channel)?.get(event)?.(payload));
}

function mount(
    options: Partial<Parameters<typeof useActionItemsRealtime>[0]> = {},
) {
    return renderHook(
        (props: { items: ActionItem[] }) =>
            useActionItemsRealtime({
                items: props.items,
                focusedItem: null,
                realtimeTeamIds: ['t1', 't2'],
                ...options,
            }),
        { initialProps: { items: [first, second] } },
    );
}

beforeEach(() => {
    vi.useFakeTimers();
    realtime.configured = true;
    realtime.status = 'connected';
    realtime.channels.clear();
    realtime.subscribed.clear();
    realtime.left = [];
    inertia.reload.mockReset();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('replaceActionItem', () => {
    it('keeps what a broadcast does not carry', () => {
        const known = actionItemFixture({
            isMine: true,
            commentsRevision: 3,
            externalLinks: [
                {
                    id: 'link-1',
                    source: 'jira',
                    key: 'PROJ-1',
                    url: 'https://acme.test/PROJ-1',
                    state: 'open',
                    statusName: null,
                    syncState: 'off',
                    syncError: null,
                    lastSyncedAt: null,
                },
            ],
        });
        const [merged] = replaceActionItem(
            [known],
            actionItemFixture({
                content: 'Renamed',
                isMine: false,
                externalLinks: null,
            }),
        );

        expect(merged.content).toBe('Renamed');
        expect(merged.isMine).toBe(true);
        expect(merged.commentsRevision).toBe(3);
        expect(merged.externalLinks).toHaveLength(1);
    });

    it('forgets the tracker that completed an item once it is reopened', () => {
        const [merged] = replaceActionItem(
            [
                actionItemFixture({
                    status: 'completed',
                    completedAt: '2026-10-01T10:00:00Z',
                    completedVia: 'jira',
                }),
            ],
            actionItemFixture({ completedAt: null, completedVia: null }),
        );

        expect(merged.completedVia).toBeNull();
    });

    it('does not add an item that is not on the page', () => {
        expect(
            replaceActionItem([first], actionItemFixture({ id: 'other' })),
        ).toEqual([first]);
    });
});

describe('useActionItemsRealtime', () => {
    it('is connected once every team channel has answered', () => {
        const { result } = mount();

        expect(result.current.state).toBe('connecting');

        act(() => realtime.subscribed.get('team-action-items.t1')?.());
        expect(result.current.state).toBe('connecting');

        act(() => realtime.subscribed.get('team-action-items.t2')?.());
        expect(result.current.state).toBe('connected');
    });

    it('shows a change of another browser at once, then reloads once', () => {
        const onSaved = vi.fn();
        const { result } = mount({ onSaved });

        emit('team-action-items.t1', '.team-action-item.saved', {
            actionItem: { ...first, content: 'Renamed elsewhere' },
        });
        emit('team-action-items.t1', '.team-action-item.saved', {
            actionItem: { ...second, status: 'completed' },
        });

        expect(result.current.rows[0].content).toBe('Renamed elsewhere');
        expect(result.current.rows[1].status).toBe('completed');
        expect(onSaved).toHaveBeenCalledTimes(2);
        expect(inertia.reload).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(1_000);
        });

        expect(inertia.reload).toHaveBeenCalledTimes(1);
        expect(inertia.reload).toHaveBeenCalledWith({ only: ReloadProps });
        expect(ReloadProps).toContain('counts');
    });

    it('tells the page of an item deleted elsewhere and reloads', () => {
        const onDeleted = vi.fn();

        mount({ onDeleted });

        emit('team-action-items.t2', '.team-action-item.deleted', {
            actionItemId: 'item-2',
        });

        expect(onDeleted).toHaveBeenCalledWith('item-2');

        act(() => {
            vi.advanceTimersByTime(1_000);
        });

        expect(inertia.reload).toHaveBeenCalledTimes(1);
    });

    it('counts the comments and asks an open thread to load again', () => {
        const { result } = mount();

        emit('team-action-items.t1', '.team-action-item.comments.changed', {
            actionItemId: 'item-1',
            commentCount: 4,
        });

        expect(result.current.rows[0].commentCount).toBe(4);
        expect(result.current.rows[0].commentsRevision).toBe(1);
    });

    it('removes a row the viewer deleted', () => {
        const { result } = mount();

        act(() => result.current.removeRow('item-1'));

        expect(result.current.rows.map((row) => row.id)).toEqual(['item-2']);
    });

    it('takes the rows of the server when the page reloads', () => {
        const { result, rerender } = mount();

        act(() => result.current.removeRow('item-1'));
        rerender({ items: [second] });

        expect(result.current.rows).toEqual([second]);
    });

    it('reloads when the window gets the focus back', () => {
        mount();

        act(() => {
            window.dispatchEvent(new Event('focus'));
        });

        expect(inertia.reload).toHaveBeenCalledWith({ only: ReloadProps });
    });

    it('leaves its channels when the page closes', () => {
        const { unmount } = mount();

        unmount();

        expect(realtime.left).toEqual([
            'team-action-items.t1',
            'team-action-items.t2',
        ]);
    });
});
