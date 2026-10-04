import { screen, waitFor } from '@testing-library/react';
import type { RefObject } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PasswordGateContext } from '@/components/settings/password-gate';
import { renderWithProviders } from '@/test/render';
import { ProfileCard } from './profile-card';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
const form = vi.hoisted(() => ({
    processing: false,
    errors: {} as Record<string, string>,
    props: {} as Record<string, unknown>,
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const { formMock } = await import('@/test/inertia-form');

    return {
        ...(await importOriginal<typeof import('@inertiajs/react')>()),
        usePage: () => page,
        Form: formMock(form),
    };
});

const verified = {
    name: 'Mona Member',
    email: 'mona.member@example.com',
    email_verified_at: '2026-01-01T00:00:00Z',
    avatarUrl: '/avatars/mona.svg',
};

const unverified = { ...verified, email_verified_at: null };

const guard = vi.fn((action: () => void) => action());

type SubmittedForm = {
    getData: () => Record<string, unknown>;
    submit: () => void;
};

function renderGuarded(): void {
    renderWithProviders(
        <PasswordGateContext.Provider value={{ guard }}>
            <ProfileCard user={verified} mustVerifyEmail />
        </PasswordGateContext.Provider>,
    );
}

function submitting(email: string): {
    submit: () => void;
    before: () => unknown;
} {
    const submit = vi.fn();
    const ref = form.props.ref as RefObject<SubmittedForm | null>;

    ref.current = { getData: () => ({ name: 'Mona Member', email }), submit };

    return {
        submit,
        before: () => (form.props.onBefore as () => unknown)(),
    };
}

beforeEach(() => {
    page.props = { translations: {} };
    form.processing = false;
    form.errors = {};
    form.props = {};
    guard.mockClear();
});

describe('ProfileCard', () => {
    it('keeps the ids, the names and the save hook of the old form', () => {
        const { container } = renderWithProviders(
            <ProfileCard user={verified} mustVerifyEmail />,
        );

        const name = screen.getByLabelText('Name') as HTMLInputElement;
        const email = screen.getByLabelText('Email') as HTMLInputElement;

        expect(name.id).toBe('name');
        expect(name.name).toBe('name');
        expect(name.value).toBe('Mona Member');
        expect(name.autocomplete).toBe('name');
        expect(name.required).toBe(true);
        expect(email.id).toBe('email');
        expect(email.name).toBe('email');
        expect(email.type).toBe('email');
        expect(email.value).toBe('mona.member@example.com');
        expect(email.autocomplete).toBe('username');
        expect(
            screen
                .getByRole('button', { name: 'Save' })
                .getAttribute('data-test'),
        ).toBe('update-profile-button');
        expect(container.querySelector('form')?.getAttribute('action')).toBe(
            '/settings/profile?_method=PATCH',
        );
        expect(form.props.options).toEqual({ preserveScroll: true });
    });

    it('is the Profile region, with the sentence of the mockup and the avatar', () => {
        renderWithProviders(<ProfileCard user={verified} mustVerifyEmail />);

        const region = screen.getByRole('region', { name: 'Profile' });

        expect(region.textContent).toContain(
            'How teammates see you in sessions and on cards.',
        );
        expect(
            region.querySelector('[data-slot="person-avatar"]'),
        ).not.toBeNull();
    });

    it('marks a verified address in the e-mail field', () => {
        renderWithProviders(<ProfileCard user={verified} mustVerifyEmail />);

        expect(
            document.querySelector('[data-slot="profile-email-verified"]')
                ?.textContent,
        ).toBe('Verified');
        expect(
            screen.queryByText('Your email address is unverified.'),
        ).toBeNull();
    });

    it('offers to send the verification e-mail again to an unverified member', () => {
        renderWithProviders(<ProfileCard user={unverified} mustVerifyEmail />);

        expect(
            document.querySelector('[data-slot="profile-email-verified"]'),
        ).toBeNull();
        expect(
            screen.getByText('Your email address is unverified.'),
        ).toBeTruthy();
        expect(
            screen.getByRole('button', {
                name: 'Click here to re-send the verification email.',
            }),
        ).toBeTruthy();
        expect(
            screen.queryByText(
                'A new verification link has been sent to your email address.',
            ),
        ).toBeNull();
    });

    it('confirms that the verification link was sent', () => {
        renderWithProviders(
            <ProfileCard
                user={unverified}
                mustVerifyEmail
                status="verification-link-sent"
            />,
        );

        expect(
            screen.getByText(
                'A new verification link has been sent to your email address.',
            ),
        ).toBeTruthy();
    });

    it('says nothing about verification on an instance that does not verify addresses', () => {
        renderWithProviders(
            <ProfileCard user={unverified} mustVerifyEmail={false} />,
        );

        expect(
            screen.queryByText('Your email address is unverified.'),
        ).toBeNull();
        expect(
            screen.queryByText(
                'A changed email address has to be verified again.',
            ),
        ).toBeNull();
    });

    it('shows the server errors under their fields', () => {
        form.errors = {
            name: 'The name field is required.',
            email: 'The email has already been taken.',
        };
        renderWithProviders(<ProfileCard user={verified} mustVerifyEmail />);

        expect(document.getElementById('name-error')?.textContent).toBe(
            'The name field is required.',
        );
        expect(document.getElementById('email-error')?.textContent).toBe(
            'The email has already been taken.',
        );
    });

    it('disables Save while the form is sent', () => {
        form.processing = true;
        renderWithProviders(<ProfileCard user={verified} mustVerifyEmail />);

        expect(
            (screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement)
                .disabled,
        ).toBe(true);
    });

    it('renders nothing in the places left for the photo and the presence colours', () => {
        renderWithProviders(<ProfileCard user={verified} mustVerifyEmail />);

        expect(
            document.querySelector('[data-slot="profile-identity"]'),
        ).toBeNull();
    });

    it('fills the places beside the avatar when a later feature gives them', () => {
        renderWithProviders(
            <ProfileCard
                user={verified}
                mustVerifyEmail
                presenceColours={<p>colours</p>}
                photo={<p>photo</p>}
            />,
        );

        expect(
            document.querySelector('[data-slot="profile-identity"]')
                ?.textContent,
        ).toBe('coloursphoto');
    });

    it('paints the avatar in the presence colour it is given', () => {
        renderWithProviders(
            <ProfileCard user={verified} mustVerifyEmail presence={4} />,
        );

        expect(
            document
                .querySelector('[data-slot="avatar-fallback"]')
                ?.classList.contains('bg-skrum-presence-4'),
        ).toBe(true);
    });

    it('lets a save that keeps the address go without the password gate', () => {
        renderGuarded();

        const { before, submit } = submitting(' Mona.Member@Example.com ');

        expect(before()).not.toBe(false);
        expect(guard).not.toHaveBeenCalled();
        expect(submit).not.toHaveBeenCalled();
    });

    it('holds a new address behind the password gate, then sends it once confirmed', async () => {
        renderGuarded();

        const { before, submit } = submitting('mona.new@example.com');

        expect(before()).toBe(false);

        await waitFor(() => expect(guard).toHaveBeenCalledTimes(1));
        expect(submit).toHaveBeenCalledTimes(1);
        expect(before()).not.toBe(false);
    });

    it('drops the new address when the password is not confirmed', async () => {
        guard.mockImplementationOnce(() => undefined);
        renderGuarded();

        const { before, submit } = submitting('mona.new@example.com');

        expect(before()).toBe(false);

        await waitFor(() => expect(guard).toHaveBeenCalledTimes(1));
        expect(submit).not.toHaveBeenCalled();
        expect(before()).toBe(false);
    });
});
