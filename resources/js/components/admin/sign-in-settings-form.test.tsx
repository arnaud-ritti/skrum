import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignInSettingsForm } from '@/components/admin/sign-in-settings-form';

const put = vi.fn();

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    router: { put: (...args: unknown[]) => put(...args) },
    usePage: () => ({ props: { locale: 'en', translations: {} } }),
}));

const google = [{ key: 'google', label: 'Google' }];

function requireSwitch(): HTMLElement {
    return screen.getByRole('switch', { name: 'Require single sign-on' });
}

describe('SignInSettingsForm', () => {
    beforeEach(() => {
        put.mockReset();
    });

    it('saves the switch with the explicit Save button, never on toggle', () => {
        render(
            <SignInSettingsForm
                ssoRequired={false}
                inForce={false}
                providers={google}
                blockers={[]}
                accountsWithoutSso={0}
                adminsWithPasswordWayBack={1}
            />,
        );

        expect(
            screen
                .getByRole('button', { name: 'Save' })
                .hasAttribute('disabled'),
        ).toBe(true);
        expect(screen.getByText('No unsaved changes')).toBeTruthy();

        fireEvent.click(requireSwitch());
        expect(put).not.toHaveBeenCalled();
        expect(screen.getByText('1 unsaved change')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        expect(put.mock.calls[0][1]).toEqual({ sso_required: true });
    });

    it('cancels the change without sending anything', () => {
        render(
            <SignInSettingsForm
                ssoRequired={false}
                inForce={false}
                providers={google}
                blockers={[]}
                accountsWithoutSso={0}
                adminsWithPasswordWayBack={1}
            />,
        );

        fireEvent.click(requireSwitch());
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(requireSwitch().getAttribute('aria-checked')).toBe('false');
        expect(put).not.toHaveBeenCalled();
    });

    it('explains what stands in the way and keeps the switch off', () => {
        const { rerender } = render(
            <SignInSettingsForm
                ssoRequired={false}
                inForce={false}
                providers={[]}
                blockers={['no_provider']}
                accountsWithoutSso={0}
                adminsWithPasswordWayBack={1}
            />,
        );

        expect(requireSwitch().hasAttribute('disabled')).toBe(true);
        expect(
            screen.getByText(
                'Configure a single sign-on provider before requiring it.',
            ),
        ).toBeTruthy();
        expect(
            screen.getByText('No single sign-on provider is configured.'),
        ).toBeTruthy();

        rerender(
            <SignInSettingsForm
                ssoRequired={false}
                inForce={false}
                providers={google}
                blockers={['no_identity']}
                accountsWithoutSso={0}
                adminsWithPasswordWayBack={1}
            />,
        );

        expect(requireSwitch().hasAttribute('disabled')).toBe(true);
        expect(
            screen.getByText(
                'Sign in once with single sign-on yourself before requiring it for everyone.',
            ),
        ).toBeTruthy();
    });

    it('can always be turned off', () => {
        const { container } = render(
            <SignInSettingsForm
                ssoRequired
                inForce={false}
                providers={[]}
                blockers={['no_provider']}
                accountsWithoutSso={0}
                adminsWithPasswordWayBack={1}
            />,
        );

        expect(requireSwitch().hasAttribute('disabled')).toBe(false);
        expect(
            container.querySelector(
                '[role=status][data-slot=sign-in-not-in-force]',
            )?.textContent,
        ).toContain(
            'The setting is stored but not in force: no single sign-on provider is configured.',
        );

        fireEvent.click(requireSwitch());
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(put.mock.calls[0][1]).toEqual({ sso_required: false });
    });

    it('warns about the accounts that have never used single sign-on', () => {
        const { rerender } = render(
            <SignInSettingsForm
                ssoRequired={false}
                inForce={false}
                providers={google}
                blockers={[]}
                accountsWithoutSso={3}
                adminsWithPasswordWayBack={1}
            />,
        );

        expect(
            screen.getByText(
                '3 accounts have never signed in with single sign-on. Each is linked on its first single sign-on if its address matches; otherwise it cannot sign in.',
            ),
        ).toBeTruthy();

        rerender(
            <SignInSettingsForm
                ssoRequired={false}
                inForce={false}
                providers={google}
                blockers={[]}
                accountsWithoutSso={1}
                adminsWithPasswordWayBack={1}
            />,
        );

        expect(
            screen.getByText(
                '1 account has never signed in with single sign-on. It is linked on its first single sign-on if its address matches; otherwise it cannot sign in.',
            ),
        ).toBeTruthy();
    });

    it('explains the second-factor condition and warns when no admin has the password way back', () => {
        const { rerender } = render(
            <SignInSettingsForm
                ssoRequired={false}
                inForce={false}
                providers={google}
                blockers={['no_second_factor']}
                accountsWithoutSso={0}
                adminsWithPasswordWayBack={2}
            />,
        );

        expect(requireSwitch().hasAttribute('disabled')).toBe(true);
        expect(
            screen.getByText(
                'Turn on a second factor for your account before requiring single sign-on: it is what lets an administrator sign in with a password if single sign-on fails.',
            ),
        ).toBeTruthy();
        expect(
            screen.getByText(
                '2 administrators can sign in with a password and a second factor if single sign-on fails.',
            ),
        ).toBeTruthy();

        rerender(
            <SignInSettingsForm
                ssoRequired
                inForce
                providers={google}
                blockers={['no_second_factor']}
                accountsWithoutSso={0}
                adminsWithPasswordWayBack={0}
            />,
        );

        expect(screen.queryByRole('alert')).toBeNull();
        expect(
            document.querySelector('[data-slot=sign-in-no-way-back]')
                ?.textContent,
        ).toContain(
            'No administrator has a second factor: nobody can sign in with a password if single sign-on fails.',
        );
    });

    it('shows the refusal of the server under the switch', () => {
        put.mockImplementation(
            (
                _url: string,
                _data: unknown,
                options: { onError: (errors: Record<string, string>) => void },
            ) => options.onError({ sso_required: 'Refused by the server.' }),
        );

        render(
            <SignInSettingsForm
                ssoRequired={false}
                inForce={false}
                providers={google}
                blockers={[]}
                accountsWithoutSso={0}
                adminsWithPasswordWayBack={1}
            />,
        );

        fireEvent.click(requireSwitch());
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(screen.getByRole('alert')?.textContent).toContain(
            'Refused by the server.',
        );
    });

    it('shows a refusal of the server under another key too', () => {
        put.mockImplementation(
            (
                _url: string,
                _data: unknown,
                options: { onError: (errors: Record<string, string>) => void },
            ) => options.onError({ section: 'Another admin is saving.' }),
        );

        render(
            <SignInSettingsForm
                ssoRequired={false}
                inForce={false}
                providers={google}
                blockers={[]}
                accountsWithoutSso={0}
                adminsWithPasswordWayBack={1}
            />,
        );

        fireEvent.click(requireSwitch());
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));

        expect(screen.getByRole('alert')?.textContent).toContain(
            'Another admin is saving.',
        );
    });

    it('lists the configured providers', () => {
        render(
            <SignInSettingsForm
                ssoRequired={false}
                inForce={false}
                providers={google}
                blockers={[]}
                accountsWithoutSso={0}
                adminsWithPasswordWayBack={1}
            />,
        );

        expect(
            screen.getByRole('list', { name: 'Single sign-on providers' })
                ?.textContent,
        ).toContain('Google');
    });
});
