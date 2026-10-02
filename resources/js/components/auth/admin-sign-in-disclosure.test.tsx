import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminSignInDisclosure } from '@/components/auth/admin-sign-in-disclosure';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {} } }),
}));

const sentence =
    'Administrators can sign in with their password and a second factor.';

function renderDisclosure() {
    return render(
        <AdminSignInDisclosure>
            <label htmlFor="email">Work email</label>
            <input id="email" type="email" />
            <label htmlFor="password">Password</label>
            <input id="password" type="password" />
        </AdminSignInDisclosure>,
    );
}

describe('AdminSignInDisclosure', () => {
    it('keeps the form out of the page until it is opened', () => {
        renderDisclosure();

        expect(
            screen
                .getByRole('button', { name: 'Administrator sign-in' })
                .getAttribute('aria-expanded'),
        ).toBe('false');
        expect(document.getElementById('email')).toBeNull();
        expect(screen.queryByText(sentence)).toBeNull();
    });

    it('opens on the first field, says who it is for, and folds again', () => {
        renderDisclosure();

        const button = screen.getByRole('button', {
            name: 'Administrator sign-in',
        });

        fireEvent.click(button);

        expect(button.getAttribute('aria-expanded')).toBe('true');
        expect(screen.getByText(sentence)).toBeTruthy();
        expect(document.activeElement).toBe(
            screen.getByLabelText('Work email'),
        );

        fireEvent.click(button);

        expect(button.getAttribute('aria-expanded')).toBe('false');
        expect(document.getElementById('email')).toBeNull();
    });
});
