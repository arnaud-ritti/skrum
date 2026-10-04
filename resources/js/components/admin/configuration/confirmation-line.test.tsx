import { act, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { ConfirmationLine, useFreshConfirmation } from './confirmation-line';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

afterEach(() => {
    vi.useRealTimers();
});

describe('ConfirmationLine', () => {
    it('asks for the password and links to the confirmation page', () => {
        renderWithProviders(
            <ConfirmationLine visible confirmUrl="/admin/sign-in/confirm" />,
        );

        expect(
            screen.getByText('Confirm your password to change these settings.'),
        ).not.toBeNull();
        expect(
            screen.getByRole('link', { name: 'Confirm' }).getAttribute('href'),
        ).toBe('/admin/sign-in/confirm');
    });

    it('shows nothing while the confirmation is fresh', () => {
        const { container } = renderWithProviders(
            <ConfirmationLine
                visible={false}
                confirmUrl="/admin/sign-in/confirm"
            />,
        );

        expect(container.textContent).toBe('');
    });

    it('keeps its live region mounted, so the request is announced when it appears', () => {
        const { rerender } = renderWithProviders(
            <ConfirmationLine
                visible={false}
                confirmUrl="/admin/sign-in/confirm"
            />,
        );
        const region = screen.getByRole('status');

        rerender(
            <ConfirmationLine visible confirmUrl="/admin/sign-in/confirm" />,
        );

        expect(screen.getByRole('status')).toBe(region);
        expect(region.textContent).toContain(
            'Confirm your password to change these settings.',
        );
    });
});

describe('useFreshConfirmation', () => {
    it('needs a confirmation without one', () => {
        const { result } = renderHook(() => useFreshConfirmation(null));

        expect(result.current.needsConfirmation).toBe(true);
    });

    it('needs a confirmation again once the fresh one passes', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));

        const { result } = renderHook(() =>
            useFreshConfirmation('2026-10-03T12:04:00Z'),
        );

        expect(result.current.needsConfirmation).toBe(false);

        act(() => {
            vi.advanceTimersByTime(3 * 60 * 1000);
        });

        expect(result.current.needsConfirmation).toBe(false);

        act(() => {
            vi.advanceTimersByTime(60 * 1000 + 1);
        });

        expect(result.current.needsConfirmation).toBe(true);
    });

    it('needs a confirmation once the server refused one', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));

        const { result } = renderHook(() =>
            useFreshConfirmation('2026-10-03T12:04:00Z'),
        );

        act(() => result.current.refuse());

        expect(result.current.needsConfirmation).toBe(true);
    });

    it('starts again from a new confirmation', () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));

        const { result, rerender } = renderHook(
            ({ until }: { until: string | null }) =>
                useFreshConfirmation(until),
            { initialProps: { until: null as string | null } },
        );

        expect(result.current.needsConfirmation).toBe(true);

        rerender({ until: '2026-10-03T12:05:00Z' });

        expect(result.current.needsConfirmation).toBe(false);
    });
});
