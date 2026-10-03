import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useOnlineUserIds } from './use-online-user-ids';

let here: ((members: { id: string }[]) => void) | undefined;

vi.mock('@laravel/echo-react', () => ({
    echoIsConfigured: () => true,
    echo: () => ({
        join: () => {
            const channel = {
                here: (callback: typeof here) => {
                    here = callback;

                    return channel;
                },
                joining: () => channel,
                leaving: () => channel,
            };

            return channel;
        },
        leave: () => {},
    }),
}));

describe('useOnlineUserIds', () => {
    it('renders again with the people the channel reports', async () => {
        const { followWorkspace } =
            await import('@/lib/realtime/workspace-presence');
        const { result } = renderHook(() => useOnlineUserIds());

        expect(result.current.size).toBe(0);

        act(() => {
            followWorkspace('w1');
            here?.([{ id: 'a' }]);
        });

        expect(result.current.has('a')).toBe(true);
    });
});
