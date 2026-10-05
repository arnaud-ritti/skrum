import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useOptionalProp } from '@/hooks/use-optional-prop';

type ReloadOptions = {
    only: string[];
    onSuccess?: () => void;
    onFinish?: () => void;
};

const mocks = vi.hoisted(() => ({ reload: vi.fn() }));

vi.mock('@inertiajs/react', () => ({ router: { reload: mocks.reload } }));

function lastReload(): ReloadOptions {
    return mocks.reload.mock.calls.at(-1)![0] as ReloadOptions;
}

beforeEach(() => {
    mocks.reload.mockReset();
});

describe('useOptionalProp', () => {
    it('asks for the prop only while it is missing', () => {
        const { rerender } = renderHook(
            ({ missing }) => useOptionalProp('catalogue', missing),
            { initialProps: { missing: false } },
        );

        expect(mocks.reload).not.toHaveBeenCalled();

        rerender({ missing: true });

        expect(lastReload().only).toEqual(['catalogue']);
    });

    it('fails when the reload ends without the prop, and asks again on retry', () => {
        const { result } = renderHook(() => useOptionalProp('catalogue', true));

        act(() => lastReload().onFinish?.());

        expect(result.current.failed).toBe(true);

        act(() => result.current.retry());

        expect(result.current.failed).toBe(false);
        expect(mocks.reload).toHaveBeenCalledTimes(2);
    });

    it('does not fail once the reload succeeded', () => {
        const { result } = renderHook(() => useOptionalProp('catalogue', true));

        act(() => {
            lastReload().onSuccess?.();
            lastReload().onFinish?.();
        });

        expect(result.current.failed).toBe(false);
    });
});
