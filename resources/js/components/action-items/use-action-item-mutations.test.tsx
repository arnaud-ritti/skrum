import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useActionItemMutations } from '@/components/action-items/use-action-item-mutations';
import { RetroRequestError } from '@/lib/retro/api';
import {
    actionItemEndpointsFixture,
    actionItemFixture,
} from '@/test/action-items';

const retroRequest = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest,
}));

vi.mock('sonner', () => ({ toast }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {} } }),
}));

const endpoints = actionItemEndpointsFixture();

beforeEach(() => {
    retroRequest.mockReset();
    toast.error.mockReset();
    toast.success.mockReset();
});

describe('useActionItemMutations', () => {
    it('patches only what changed and hands the saved item back', async () => {
        const item = actionItemFixture();
        const saved = actionItemFixture({ priority: 'high' });
        const onSaved = vi.fn();

        retroRequest.mockResolvedValue({ actionItem: saved });

        const { result } = renderHook(() =>
            useActionItemMutations(endpoints, onSaved),
        );

        await act(() =>
            result.current.patch(item, {
                title: item.content,
                priority: 'high',
                dueDate: item.dueOn,
            }),
        );

        expect(retroRequest).toHaveBeenCalledWith(
            { url: '/items/item-1', method: 'patch' },
            { priority: 'high' },
        );
        expect(onSaved).toHaveBeenCalledWith(saved);
    });

    it('sends no request for a patch that changes nothing', async () => {
        const item = actionItemFixture();
        const { result } = renderHook(() =>
            useActionItemMutations(endpoints, vi.fn()),
        );

        await act(() => result.current.patch(item, { title: item.content }));

        expect(retroRequest).not.toHaveBeenCalled();
    });

    it('marks the item busy while its request runs, and refuses a second one', async () => {
        const item = actionItemFixture();
        let finish: (value: unknown) => void = () => {};

        retroRequest.mockReturnValue(
            new Promise((resolve) => {
                finish = resolve;
            }),
        );

        const { result } = renderHook(() =>
            useActionItemMutations(endpoints, vi.fn()),
        );

        let first: Promise<void> = Promise.resolve();

        act(() => {
            first = result.current.patch(item, { priority: 'high' });
        });

        await waitFor(() => expect(result.current.busyId).toBe('item-1'));

        await act(() => result.current.patch(item, { priority: 'low' }));

        expect(retroRequest).toHaveBeenCalledTimes(1);

        await act(async () => {
            finish({ actionItem: item });
            await first;
        });

        expect(result.current.busyId).toBeNull();
    });

    it('completes and reopens through the status', async () => {
        const item = actionItemFixture();

        retroRequest.mockResolvedValue({ actionItem: item });

        const { result } = renderHook(() =>
            useActionItemMutations(endpoints, vi.fn()),
        );

        await act(() => result.current.setStatus(item, 'completed'));

        expect(retroRequest).toHaveBeenCalledWith(
            { url: '/items/item-1', method: 'patch' },
            { status: 'completed' },
        );
    });

    it('removes the item and tells the container', async () => {
        const item = actionItemFixture();
        const onRemoved = vi.fn();

        retroRequest.mockResolvedValue(null);

        const { result } = renderHook(() =>
            useActionItemMutations(endpoints, vi.fn(), { onRemoved }),
        );

        await act(() => result.current.remove(item));

        expect(retroRequest).toHaveBeenCalledWith({
            url: '/items/item-1',
            method: 'delete',
        });
        expect(onRemoved).toHaveBeenCalledWith('item-1');
    });

    it('shows the message of the server and resyncs when a request fails', async () => {
        const item = actionItemFixture();
        const onSaved = vi.fn();
        const onRemoved = vi.fn();
        const resync = vi.fn();

        retroRequest.mockRejectedValue(
            new RetroRequestError(423, 'The board is locked.'),
        );

        const { result } = renderHook(() =>
            useActionItemMutations(endpoints, onSaved, { onRemoved, resync }),
        );

        await act(() => result.current.patch(item, { priority: 'high' }));
        await act(() => result.current.remove(item));

        expect(toast.error).toHaveBeenCalledWith('The board is locked.');
        expect(resync).toHaveBeenCalledTimes(2);
        expect(onSaved).not.toHaveBeenCalled();
        expect(onRemoved).not.toHaveBeenCalled();
        expect(result.current.busyId).toBeNull();
    });

    it('says the server was too slow on a timeout, and stays generic otherwise', async () => {
        const { result } = renderHook(() =>
            useActionItemMutations(endpoints, vi.fn()),
        );

        await act(async () => {
            await result.current.run(
                Promise.reject(new RetroRequestError(0, 'timeout')),
            );
            await result.current.run(Promise.reject(new Error('boom')));
        });

        expect(toast.error).toHaveBeenNthCalledWith(
            1,
            'The server did not respond in time. Please try again.',
        );
        expect(toast.error).toHaveBeenNthCalledWith(
            2,
            'Something went wrong. Please try again.',
        );
    });

    it('uses the run of its container when it is given one', async () => {
        const item = actionItemFixture();
        const run = vi.fn(async () => undefined);

        retroRequest.mockRejectedValue(new RetroRequestError(403, 'No.'));

        const { result } = renderHook(() =>
            useActionItemMutations(endpoints, vi.fn(), { run }),
        );

        await act(() => result.current.patch(item, { priority: 'high' }));

        expect(run).toHaveBeenCalledTimes(1);
        expect(toast.error).not.toHaveBeenCalled();
    });

    it('asks for a new sync of a tracker link', async () => {
        const item = actionItemFixture();
        const onSaved = vi.fn();

        retroRequest.mockResolvedValue({ actionItem: item });

        const { result } = renderHook(() =>
            useActionItemMutations(endpoints, onSaved),
        );

        await act(() => result.current.retrySync(item, { id: 'link-1' }));

        expect(retroRequest).toHaveBeenCalledWith({
            url: '/items/item-1/links/link-1/sync',
            method: 'post',
        });
        expect(onSaved).toHaveBeenCalledWith(item);
        expect(toast.success).toHaveBeenCalledWith('Sync requested.');
    });

    it('sends one sync when Retry sync is pressed twice', async () => {
        const item = actionItemFixture();

        retroRequest.mockResolvedValue({ actionItem: item });

        const { result } = renderHook(() =>
            useActionItemMutations(endpoints, vi.fn()),
        );

        await act(() =>
            Promise.all([
                result.current.retrySync(item, { id: 'link-1' }),
                result.current.retrySync(item, { id: 'link-1' }),
            ]),
        );

        expect(retroRequest).toHaveBeenCalledTimes(1);
        expect(toast.success).toHaveBeenCalledTimes(1);
    });

    it('hands the Item containers what they need through its value', () => {
        const onSaved = vi.fn();
        const onCommentCount = vi.fn();
        const { result } = renderHook(() =>
            useActionItemMutations(endpoints, onSaved, { onCommentCount }),
        );

        expect(result.current.value.endpoints).toBe(endpoints);
        expect(result.current.value.run).toBe(result.current.run);

        result.current.value.onSaved(actionItemFixture());
        result.current.value.onCommentCount?.('item-1', 3);

        expect(onSaved).toHaveBeenCalledTimes(1);
        expect(onCommentCount).toHaveBeenCalledWith('item-1', 3);
    });
});
