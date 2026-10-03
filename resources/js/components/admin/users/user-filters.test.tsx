import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { SearchDelay, UserFilters, usersUrl } from './user-filters';

const router = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {} } }),
    router,
}));

beforeEach(() => {
    router.get.mockReset();
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('usersUrl', () => {
    it('leaves the defaults out of the address', () => {
        expect(usersUrl({ query: null, status: 'all' })).toBe('/admin/users');
        expect(usersUrl({ query: '  ', status: 'all' }, 1)).toBe(
            '/admin/users',
        );
    });

    it('keeps the term, the filter and the page', () => {
        expect(usersUrl({ query: ' atlas ', status: 'admins' }, 3)).toBe(
            '/admin/users?query=atlas&status=admins&page=3',
        );
    });
});

describe('UserFilters', () => {
    it('searches once the typing pauses, keeping the filter', () => {
        renderWithProviders(
            <UserFilters filters={{ query: null, status: 'active' }} />,
        );

        fireEvent.change(
            screen.getByRole('searchbox', {
                name: 'Search by name or email address',
            }),
            { target: { value: 'atlas' } },
        );

        expect(router.get).not.toHaveBeenCalled();

        act(() => {
            vi.advanceTimersByTime(SearchDelay);
        });

        expect(router.get).toHaveBeenCalledTimes(1);
        expect(router.get).toHaveBeenCalledWith(
            '/admin/users?query=atlas&status=active',
            {},
            expect.objectContaining({ preserveState: true }),
        );
    });

    it('does not search again for the term already shown', () => {
        renderWithProviders(
            <UserFilters filters={{ query: 'atlas', status: 'all' }} />,
        );

        act(() => {
            vi.advanceTimersByTime(SearchDelay);
        });

        expect(router.get).not.toHaveBeenCalled();
    });

    it('filters by status with the current term', () => {
        renderWithProviders(
            <UserFilters filters={{ query: 'atlas', status: 'all' }} />,
        );

        fireEvent.click(screen.getByRole('radio', { name: 'Deactivated' }));

        expect(router.get).toHaveBeenCalledWith(
            '/admin/users?query=atlas&status=deactivated',
            {},
            expect.objectContaining({ preserveState: true }),
        );
    });

    it('marks the filter in force', () => {
        renderWithProviders(
            <UserFilters filters={{ query: null, status: 'admins' }} />,
        );

        expect(
            screen
                .getByRole('radio', { name: 'Admins' })
                .getAttribute('aria-checked'),
        ).toBe('true');
    });
});
