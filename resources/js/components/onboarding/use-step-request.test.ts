import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStepRequest } from '@/components/onboarding/use-step-request';

const mocks = vi.hoisted(() => ({ post: vi.fn(), put: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    router: { post: mocks.post, put: mocks.put },
}));

beforeEach(() => {
    mocks.post.mockReset();
});

describe('useStepRequest', () => {
    it('sends one request for two submits in a row', () => {
        const { result } = renderHook(() => useStepRequest<'create'>());

        act(() => {
            result.current.send('create', 'post', '/onboarding/rituals');
            result.current.send('create', 'post', '/onboarding/rituals');
        });

        expect(mocks.post).toHaveBeenCalledTimes(1);
    });

    it('sends again once the first request is over', () => {
        const { result } = renderHook(() => useStepRequest<'create'>());

        act(() => {
            result.current.send('create', 'post', '/onboarding/rituals');
        });
        act(() => {
            mocks.post.mock.calls[0][2].onFinish();
        });
        act(() => {
            result.current.send('create', 'post', '/onboarding/rituals');
        });

        expect(mocks.post).toHaveBeenCalledTimes(2);
    });
});
