import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { ReduceMotionField } from './reduce-motion-field';

const patch = vi.hoisted(() => vi.fn());

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    router: { patch },
    usePage: () => ({ props: { locale: 'en', translations: {} } }),
}));

const original = window.matchMedia;

function systemAsks(matches: boolean): void {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
    }));
}

type Visit = {
    preserveScroll: boolean;
    onSuccess: () => void;
    onFinish: () => void;
};

function control(): HTMLElement {
    return screen.getByRole('switch', { name: 'Reduce animations' });
}

describe('ReduceMotionField', () => {
    beforeEach(() => {
        patch.mockReset();
        systemAsks(false);
    });

    afterEach(() => {
        window.matchMedia = original;
        document.documentElement.classList.remove('reduce-motion');
    });

    it('shows the stored value with its help', () => {
        renderWithProviders(<ReduceMotionField enabled />);

        expect(control().getAttribute('aria-checked')).toBe('true');
        expect(
            screen.getByText(
                'Replaces card flips, confetti and drag tilts with simple fades. On by default when your system asks for it.',
            ),
        ).toBeTruthy();
        expect(
            screen.queryByText(
                'Your system already asks for fewer animations.',
            ),
        ).toBeNull();
    });

    it('says when the system already asks, and keeps the stored value', () => {
        systemAsks(true);

        renderWithProviders(<ReduceMotionField enabled={false} />);

        expect(control().getAttribute('aria-checked')).toBe('false');
        expect(
            screen.getByText('Your system already asks for fewer animations.'),
        ).toBeTruthy();
    });

    it('saves at once and applies the class once saved', () => {
        renderWithProviders(<ReduceMotionField enabled={false} />);

        fireEvent.click(control());

        expect(control().getAttribute('aria-checked')).toBe('true');
        expect(patch).toHaveBeenCalledTimes(1);
        expect(patch.mock.calls[0][0]).toBe('/settings/motion');
        expect(patch.mock.calls[0][1]).toEqual({ reduce_motion: true });

        const visit = patch.mock.calls[0][2] as Visit;

        expect(visit.preserveScroll).toBe(true);
        expect(
            document.documentElement.classList.contains('reduce-motion'),
        ).toBe(false);

        act(() => {
            visit.onSuccess();
            visit.onFinish();
        });

        expect(control().getAttribute('aria-checked')).toBe('true');
        expect(
            document.documentElement.classList.contains('reduce-motion'),
        ).toBe(true);
    });

    it('goes back to the stored value when the save fails for any reason', () => {
        renderWithProviders(<ReduceMotionField enabled={false} />);

        fireEvent.click(control());

        const visit = patch.mock.calls[0][2] as Visit;

        act(() => visit.onFinish());

        expect(
            screen
                .getByRole('switch', { name: 'Reduce animations' })
                .getAttribute('aria-checked'),
        ).toBe('false');
        expect(
            document.documentElement.classList.contains('reduce-motion'),
        ).toBe(false);
    });
});
