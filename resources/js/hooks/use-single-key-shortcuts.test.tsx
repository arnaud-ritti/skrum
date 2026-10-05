import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    SingleKeyShortcutsStorageKey,
    useSingleKeyShortcuts,
} from '@/hooks/use-single-key-shortcuts';
import {
    setSingleKeyShortcuts,
    singleKeyShortcutsEnabled,
} from '@/lib/shortcuts/preference';

const page = vi.hoisted(() => ({
    user: null as { single_key_shortcuts?: boolean } | null,
    patch: vi.fn(),
}));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { auth: { user: page.user } } }),
    router: { patch: page.patch },
}));

let change: (enabled: boolean) => void = () => {};

function Probe() {
    const [enabled, setEnabled] = useSingleKeyShortcuts();

    change = setEnabled;

    return <output data-testid="state">{String(enabled)}</output>;
}

const state = () => screen.getByTestId('state').textContent;

beforeEach(() => {
    page.user = null;
    page.patch.mockReset();
    window.localStorage.clear();
});

afterEach(() => setSingleKeyShortcuts(true));

describe('useSingleKeyShortcuts', () => {
    it('reads the preference of a member from the account and feeds the switch', () => {
        page.user = { single_key_shortcuts: false };

        render(<Probe />);

        expect(state()).toBe('false');
        expect(singleKeyShortcutsEnabled()).toBe(false);
    });

    it('is on for a member whose account does not say', () => {
        page.user = {};

        render(<Probe />);

        expect(state()).toBe('true');
        expect(singleKeyShortcutsEnabled()).toBe(true);
    });

    it('reads the preference of a guest from this browser', () => {
        const first = render(<Probe />);

        expect(state()).toBe('true');
        first.unmount();

        window.localStorage.setItem(SingleKeyShortcutsStorageKey, 'false');
        render(<Probe />);

        expect(state()).toBe('false');
        expect(singleKeyShortcutsEnabled()).toBe(false);
    });

    it('keeps the choice of a guest in this browser and posts nothing', () => {
        render(<Probe />);

        act(() => change(false));

        expect(state()).toBe('false');
        expect(window.localStorage.getItem(SingleKeyShortcutsStorageKey)).toBe(
            'false',
        );
        expect(page.patch).not.toHaveBeenCalled();
    });

    it('shares the choice of a guest with every place that reads it', () => {
        let second: (enabled: boolean) => void = () => {};

        function SecondProbe() {
            const [enabled, setEnabled] = useSingleKeyShortcuts();

            second = setEnabled;

            return <output data-testid="second">{String(enabled)}</output>;
        }

        render(
            <>
                <Probe />
                <SecondProbe />
            </>,
        );

        act(() => second(false));

        expect(state()).toBe('false');
        expect(screen.getByTestId('second').textContent).toBe('false');
        expect(singleKeyShortcutsEnabled()).toBe(false);
    });

    it('saves the choice of a member on the account', () => {
        page.user = { single_key_shortcuts: true };

        render(<Probe />);
        act(() => change(false));

        expect(page.patch).toHaveBeenCalledTimes(1);
        expect(page.patch.mock.calls[0][0]).toContain('/settings/shortcuts');
        expect(page.patch.mock.calls[0][1]).toEqual({
            single_key_shortcuts: false,
        });
        expect(window.localStorage.getItem(SingleKeyShortcutsStorageKey)).toBe(
            null,
        );
    });
});
