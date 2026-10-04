import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RegisterForm } from '@/components/auth/register-form';
import { renderWithProviders } from '@/test/render';

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

beforeEach(() => {
    page.props = { translations: {} };
    form.processing = false;
    form.errors = {};
    form.props = {};
});

const rules = 'minlength: 12; required: lower; required: upper;';

function renderForm(props: Partial<Parameters<typeof RegisterForm>[0]> = {}) {
    return renderWithProviders(
        <RegisterForm
            passwordRules={rules}
            invitationEmail={null}
            asksTeamName={false}
            ssoProviders={[]}
            {...props}
        />,
    );
}

describe('RegisterForm', () => {
    it('keeps the ids, the names and the submit hook of the old form', () => {
        const { container } = renderForm();

        const fields = {
            name: screen.getByLabelText('First and last name'),
            email: screen.getByLabelText('Work email'),
            password: screen.getByLabelText('Password'),
            password_confirmation: screen.getByLabelText('Confirm password'),
        };

        for (const [name, field] of Object.entries(fields)) {
            expect(field.id).toBe(name);
            expect(field.getAttribute('name')).toBe(name);
        }

        expect(fields.name.getAttribute('autocomplete')).toBe('name');
        expect(fields.password.getAttribute('autocomplete')).toBe(
            'new-password',
        );

        const submit = screen.getByRole('button', {
            name: 'Create my account',
        });

        expect(submit.getAttribute('data-test')).toBe('register-user-button');
        expect(container.querySelector('form')?.getAttribute('action')).toBe(
            '/register',
        );
        expect(form.props.resetOnSuccess).toEqual([
            'password',
            'password_confirmation',
        ]);
        expect(form.props.disableWhileProcessing).toBe(true);
    });

    it('gives the password rules of the server to both password fields', () => {
        renderForm();

        expect(
            screen.getByLabelText('Password').getAttribute('passwordrules'),
        ).toBe(rules);
        expect(
            screen
                .getByLabelText('Confirm password')
                .getAttribute('passwordrules'),
        ).toBe(rules);
    });

    it('states the minimum length only when the server rule has one', () => {
        const { unmount } = renderForm();

        expect(
            screen.getByLabelText('Password').getAttribute('placeholder'),
        ).toBe('12 characters minimum');

        unmount();
        renderForm({ passwordRules: '' });

        expect(
            screen.getByLabelText('Password').getAttribute('placeholder'),
        ).toBeNull();
    });

    it('locks the e-mail of a pending invitation and says why', () => {
        renderForm({ invitationEmail: 'sofia@nordlys.fr' });

        const email = screen.getByLabelText('Work email') as HTMLInputElement;

        expect(email.value).toBe('sofia@nordlys.fr');
        expect(email.readOnly).toBe(true);
        expect(
            screen.getByText('The invitation was sent to this address.').id,
        ).toBe(email.getAttribute('aria-describedby'));
    });

    it('leaves the e-mail free without an invitation', () => {
        renderForm();

        const email = screen.getByLabelText('Work email') as HTMLInputElement;

        expect(email.readOnly).toBe(false);
        expect(
            screen.queryByText('The invitation was sent to this address.'),
        ).toBeNull();
    });

    it('shows each server error under its field', () => {
        form.errors = {
            name: 'The name field is required.',
            email: 'The email has already been taken.',
            password: 'The password field confirmation does not match.',
        };
        renderForm();

        expect(document.getElementById('name-error')?.textContent).toBe(
            'The name field is required.',
        );
        expect(document.getElementById('email-error')?.textContent).toBe(
            'The email has already been taken.',
        );
        expect(document.getElementById('password-error')?.textContent).toBe(
            'The password field confirmation does not match.',
        );
    });

    it('shows the SSO buttons before the form and the login link after it', () => {
        const { container } = renderForm({
            ssoProviders: [{ key: 'google', label: 'Google' }],
        });

        const formElement = container.querySelector('form')!;
        const sso = container.querySelector('[data-slot="sso-buttons"]')!;
        const login = screen.getByRole('link', { name: 'Log in' });

        expect(screen.getByText('Already registered?')).toBeTruthy();
        expect(login.getAttribute('href')).toBe('/login');
        expect(
            sso.compareDocumentPosition(formElement) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
        expect(
            formElement.compareDocumentPosition(login) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
    });

    it('asks for no team name when the server does not', () => {
        renderForm();

        expect(screen.queryByLabelText('Team name')).toBeNull();
    });

    it('asks for an optional team name beside the name and posts it as team_name', () => {
        const { container } = renderForm({ asksTeamName: true });

        const name = screen.getByLabelText('First and last name');
        const teamName = screen.getByLabelText('Team name') as HTMLInputElement;

        expect(teamName.id).toBe('team_name');
        expect(teamName.required).toBe(false);
        expect(teamName.maxLength).toBe(100);
        expect(teamName.getAttribute('autocomplete')).toBe('organization');
        expect(
            name.compareDocumentPosition(teamName) &
                Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
        expect(
            teamName.compareDocumentPosition(
                screen.getByLabelText('Work email'),
            ) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();

        teamName.value = 'Atlas';

        expect(
            new FormData(container.querySelector('form')!).get('team_name'),
        ).toBe('Atlas');
    });

    it('shows the server error of the team name under its field', () => {
        form.errors = {
            team_name:
                'The team name field must not be greater than 100 characters.',
        };
        renderForm({ asksTeamName: true });

        expect(document.getElementById('team_name-error')?.textContent).toBe(
            'The team name field must not be greater than 100 characters.',
        );
    });
});
