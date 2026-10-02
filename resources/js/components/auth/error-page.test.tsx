import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorPage } from '@/components/auth/error-page';
import { renderWithProviders } from '@/test/render';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => page,
}));

vi.mock('@/lib/reload-document', () => ({ reloadDocument: reload }));

const mona = { id: 'user-1', name: 'Mona Member', email: 'mona@example.com' };
const reload = vi.hoisted(() => vi.fn());
const writeText = vi.fn(() => Promise.resolve());

function slot(name: string): Element | null {
    return document.querySelector(`[data-slot="${name}"]`);
}

describe('ErrorPage', () => {
    beforeEach(() => {
        page.props = {
            translations: {},
            name: 'Nordlys',
            auth: { user: mona },
        };
        reload.mockClear();
        writeText.mockClear();
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText },
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('sends a signed-in visitor of a missing page back to the teams', () => {
        renderWithProviders(<ErrorPage status={404} />);

        expect(screen.getByText('Error 404')).toBeTruthy();
        expect(
            screen.getByRole('heading', {
                level: 1,
                name: "This page doesn't exist (anymore)",
            }),
        ).toBeTruthy();
        expect(
            screen
                .getByRole('link', { name: 'Back to my teams' })
                .getAttribute('href'),
        ).toBe('/dashboard');
        expect(screen.queryByRole('link', { name: 'Log in' })).toBeNull();
        expect(slot('error-art')?.getAttribute('data-kind')).toBe('missing');
        expect(slot('error-id')).toBeNull();
    });

    it('offers a guest to log in on a missing page', () => {
        page.props.auth = { user: null };

        renderWithProviders(<ErrorPage status={404} />);

        expect(
            screen.getByRole('link', { name: 'Log in' }).getAttribute('href'),
        ).toBe('/login');
        expect(
            screen.queryByRole('link', { name: 'Back to my teams' }),
        ).toBeNull();
    });

    it('names the account that was refused and lets it switch', () => {
        renderWithProviders(<ErrorPage status={403} />);

        expect(screen.getByText('Error 403 · Access denied')).toBeTruthy();
        expect(
            screen.getByRole('heading', {
                name: "You don't have access to this page",
            }),
        ).toBeTruthy();
        expect(screen.getByText('mona@example.com').tagName).toBe('B');
        expect(
            screen.getByRole('link', { name: 'Back to my teams' }),
        ).toBeTruthy();
        expect(
            screen.getByRole('button', { name: 'Switch account' }),
        ).toBeTruthy();
    });

    it('offers a refused guest to log in, without an account to switch', () => {
        page.props.auth = { user: null };

        renderWithProviders(<ErrorPage status={403} />);

        expect(screen.getByRole('link', { name: 'Log in' })).toBeTruthy();
        expect(
            screen.queryByRole('button', { name: 'Switch account' }),
        ).toBeNull();
    });

    it('reloads an expired page', () => {
        renderWithProviders(<ErrorPage status={419} />);

        expect(screen.getByText('Error 419')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Reload' }));

        expect(reload).toHaveBeenCalledTimes(1);
        expect(reload).toHaveBeenCalledWith(undefined);
    });

    it.each([
        [419, 'Reload'],
        [429, 'Try again'],
        [500, 'Try again'],
    ])(
        'goes back to the page a failed post came from on a %i, instead of reloading its url',
        (status, action) => {
            renderWithProviders(
                <ErrorPage
                    status={status}
                    returnTo="http://localhost/settings/profile"
                />,
            );

            fireEvent.click(screen.getByRole('button', { name: action }));

            expect(reload).toHaveBeenCalledWith(
                'http://localhost/settings/profile',
            );
        },
    );

    it('says when a throttled request can be tried again', () => {
        renderWithProviders(<ErrorPage status={429} retryAfter={42} />);

        expect(screen.getByText('You can retry in 42 seconds.')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

        expect(reload).toHaveBeenCalledTimes(1);
    });

    it('counts a single second in the singular', () => {
        renderWithProviders(<ErrorPage status={429} retryAfter={1} />);

        expect(screen.getByText('You can retry in 1 second.')).toBeTruthy();
    });

    it('says nothing about the delay when the response gave none', () => {
        renderWithProviders(<ErrorPage status={429} />);

        expect(slot('error-retry-after')).toBeNull();
    });

    it('shows the id of a server error and copies it', async () => {
        vi.useFakeTimers();

        renderWithProviders(
            <ErrorPage
                status={500}
                requestId="0198c0de-0000-4000-8000-000000000001"
                occurredAt="2026-10-01 12:02:37"
            />,
        );

        const id = screen.getByText('0198c0de-0000-4000-8000-000000000001');

        expect(id.tagName).toBe('CODE');
        expect(screen.getByText('· 2026-10-01 12:02:37 UTC')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
        expect(
            screen.getByRole('link', { name: 'Back to my teams' }),
        ).toBeTruthy();

        const copy = screen.getByRole('button', { name: 'Copy error ID' });

        expect(copy.textContent).toBe('Copy');

        await act(async () => {
            fireEvent.click(copy);
            await Promise.resolve();
        });

        expect(writeText).toHaveBeenCalledWith(
            '0198c0de-0000-4000-8000-000000000001',
        );
        expect(copy.textContent).toBe('Copied');
        expect(copy.getAttribute('aria-label')).toBe('Copied');
        expect(screen.getByRole('status').textContent).toBe('Copied');

        act(() => {
            vi.advanceTimersByTime(2000);
        });

        expect(copy.textContent).toBe('Copy');
        expect(copy.getAttribute('aria-label')).toBe('Copy error ID');
    });

    it('says so when the browser refuses the copy', async () => {
        writeText.mockRejectedValueOnce(new Error('Refused.'));
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        renderWithProviders(<ErrorPage status={500} requestId="0198c0de" />);

        const copy = screen.getByRole('button', { name: 'Copy error ID' });

        await act(async () => {
            fireEvent.click(copy);
            await Promise.resolve();
        });

        const status = screen.getByRole('status');

        expect(copy.textContent).toBe('Copy');
        expect(status.textContent).toBe(
            'The ID could not be copied. Select it and copy it by hand.',
        );
        expect(status.className).not.toContain('sr-only');
    });

    it('renders a server error without any shared prop', () => {
        page.props = { translations: {} };

        renderWithProviders(<ErrorPage status={500} />);

        expect(
            screen.getByRole('heading', {
                name: 'Something broke on our side',
            }),
        ).toBeTruthy();
        expect(slot('error-id')).toBeNull();
        expect(document.querySelector('footer')?.textContent).toBe('');
    });

    it('shows no id on a status other than 500', () => {
        renderWithProviders(<ErrorPage status={404} requestId="0198c0de" />);

        expect(slot('error-id')).toBeNull();
    });

    it('leaves the places of the later features empty', () => {
        renderWithProviders(<ErrorPage status={403} />);

        expect(slot('error-page-links')).toBeNull();
        expect(slot('error-page-access-request')).toBeNull();
        expect(slot('error-page-search')).toBeNull();
        expect(slot('error-page-version')).toBeNull();
        expect(document.querySelector('footer')?.textContent).toBe('Nordlys');
    });

    it('fills the places it is given', () => {
        const { rerender } = renderWithProviders(
            <ErrorPage
                status={403}
                headerLinks={<a href="/status">Instance status</a>}
                accessRequest={<button type="button">Request access</button>}
                version="v1.8.2"
            />,
        );

        expect(slot('error-page-links')?.textContent).toBe('Instance status');
        expect(slot('error-page-access-request')?.textContent).toBe(
            'Request access',
        );
        expect(document.querySelector('footer')?.textContent).toBe(
            'Nordlys · v1.8.2',
        );

        rerender(
            <ErrorPage
                status={404}
                search={<button type="button">Search sessions</button>}
                accessRequest={<button type="button">Request access</button>}
            />,
        );

        expect(slot('error-page-search')?.textContent).toBe('Search sessions');
        expect(slot('error-page-access-request')).toBeNull();
    });
});
