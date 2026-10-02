import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { teamAnchor, useTeamAnchor } from '@/components/teams/use-team-anchor';

const mocks = vi.hoisted(() => ({
    listeners: [] as Array<() => void>,
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    router: {
        on: (_event: string, listener: () => void) => {
            mocks.listeners.push(listener);

            return () => {
                mocks.listeners = mocks.listeners.filter(
                    (entry) => entry !== listener,
                );
            };
        },
    },
}));

afterEach(() => {
    window.location.hash = '';
    mocks.listeners = [];
});

describe('teamAnchor', () => {
    it('maps the four section hashes and falls back to the dashboard', () => {
        expect(teamAnchor('#sessions')).toBe('sessions');
        expect(teamAnchor('#mood')).toBe('mood');
        expect(teamAnchor('#members')).toBe('members');
        expect(teamAnchor('#settings')).toBe('settings');
        expect(teamAnchor('')).toBe('dashboard');
        expect(teamAnchor('#card-12')).toBe('dashboard');
    });
});

describe('useTeamAnchor', () => {
    it('reads the hash after mount, then on a hash change and on an Inertia navigation', () => {
        window.location.hash = '#members';

        const { result, unmount } = renderHook(() => useTeamAnchor());

        expect(result.current).toBe('members');

        act(() => {
            window.location.hash = '#mood';
            window.dispatchEvent(new HashChangeEvent('hashchange'));
        });

        expect(result.current).toBe('mood');

        act(() => {
            window.history.replaceState(null, '', '#sessions');
            mocks.listeners.forEach((listener) => listener());
        });

        expect(result.current).toBe('sessions');

        unmount();

        expect(mocks.listeners).toHaveLength(0);
    });
});
