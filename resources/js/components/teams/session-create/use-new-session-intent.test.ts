import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    readNewSessionIntent,
    useNewSessionIntent,
    withoutNewSessionIntent,
} from '@/components/teams/session-create/use-new-session-intent';

const mocks = vi.hoisted(() => ({
    replace: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    router: { replace: mocks.replace, on: mocks.on },
}));

afterEach(() => {
    mocks.replace.mockReset();
    mocks.on.mockReset();
    window.history.replaceState(null, '', '/');
});

describe('readNewSessionIntent', () => {
    it('reads the type, the template and the deck', () => {
        expect(readNewSessionIntent('?new=retro&template=four_ls')).toEqual({
            type: 'retro',
            template: 'four_ls',
        });
        expect(readNewSessionIntent('?new=poker&deck=abc')).toEqual({
            type: 'poker',
            deck: 'abc',
        });
        expect(readNewSessionIntent('?new=whiteboard')).toEqual({
            type: 'whiteboard',
        });
    });

    it('ignores an unknown or missing type', () => {
        expect(readNewSessionIntent('?new=survey')).toBeNull();
        expect(readNewSessionIntent('?template=four_ls')).toBeNull();
        expect(readNewSessionIntent('')).toBeNull();
    });
});

describe('withoutNewSessionIntent', () => {
    it('removes its three parameters and keeps the rest', () => {
        expect(
            withoutNewSessionIntent(
                'https://skrum.test/w/acme/teams/1?new=retro&template=four_ls&tab=members#top',
            ),
        ).toBe('/w/acme/teams/1?tab=members#top');
        expect(
            withoutNewSessionIntent(
                'https://skrum.test/teams/1?new=poker&deck=d',
            ),
        ).toBe('/teams/1');
    });
});

describe('useNewSessionIntent', () => {
    it('returns the intent once and removes the query through Inertia', () => {
        mocks.on.mockReturnValue(mocks.off);
        window.history.replaceState(
            null,
            '',
            '/teams/1?new=retro&template=four_ls',
        );

        const { result, rerender, unmount } = renderHook(() =>
            useNewSessionIntent(),
        );

        expect(result.current).toEqual({ type: 'retro', template: 'four_ls' });
        expect(mocks.replace).toHaveBeenCalledWith({
            url: '/teams/1',
            preserveScroll: true,
            preserveState: true,
        });

        window.history.replaceState(null, '', '/teams/1');
        rerender();

        expect(result.current).toEqual({ type: 'retro', template: 'four_ls' });
        expect(mocks.replace).toHaveBeenCalledTimes(1);

        const [event, listener] = mocks.on.mock.calls[0];

        expect(event).toBe('navigate');

        listener();

        expect(mocks.replace).toHaveBeenCalledTimes(1);

        window.history.replaceState(null, '', '/teams/1?new=retro');
        listener();

        expect(mocks.replace).toHaveBeenCalledTimes(2);

        unmount();

        expect(mocks.off).toHaveBeenCalled();
    });

    it('returns null and leaves the URL alone without an intent', () => {
        window.history.replaceState(null, '', '/teams/1?tab=members');

        const { result } = renderHook(() => useNewSessionIntent());

        expect(result.current).toBeNull();
        expect(mocks.replace).not.toHaveBeenCalled();
        expect(mocks.on).not.toHaveBeenCalled();
    });
});
