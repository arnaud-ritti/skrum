import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps, ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFormState } from '@/test/inertia-form';
import { renderWithProviders } from '@/test/render';
import { PasswordCard } from './password-card';
import type { BreachState } from './use-breach-check';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
const form = vi.hoisted(() => ({
    processing: false,
    errors: {} as Record<string, string>,
    props: {} as Record<string, unknown>,
}));

const breach = vi.hoisted(() => ({
    state: 'idle' as BreachState,
    calls: [] as Array<[string, boolean]>,
}));

vi.mock('./use-breach-check', () => ({
    useBreachCheck: (password: string, enabled: boolean) => {
        breach.calls.push([password, enabled]);

        return breach.state;
    },
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
    breach.state = 'idle';
    breach.calls = [];
    Object.assign(form, createFormState());
});

function Card(
    props: Partial<ComponentProps<typeof PasswordCard>>,
): ReactElement {
    return (
        <PasswordCard
            passwordRules="minlength: 8;"
            checksCompromisedPasswords={false}
            liveBreachCheck={false}
            {...props}
        />
    );
}

function field(label: string): HTMLInputElement {
    return screen.getByLabelText(label) as HTMLInputElement;
}

describe('PasswordCard', () => {
    it('keeps the ids, the names and the save hook of the old form', () => {
        const { container } = renderWithProviders(<Card />);

        expect(field('Current password').id).toBe('current_password');
        expect(field('Current password').name).toBe('current_password');
        expect(field('Current password').autocomplete).toBe('current-password');
        expect(field('New password').id).toBe('password');
        expect(field('New password').name).toBe('password');
        expect(field('New password').getAttribute('passwordrules')).toBe(
            'minlength: 8;',
        );
        expect(field('Confirm new password').id).toBe('password_confirmation');
        expect(field('Confirm new password').name).toBe(
            'password_confirmation',
        );
        expect(
            screen
                .getByRole('button', { name: 'Update password' })
                .getAttribute('data-test'),
        ).toBe('update-password-button');
        expect(container.querySelector('form')?.getAttribute('action')).toBe(
            '/settings/password?_method=PUT',
        );
        expect(form.props.resetOnError).toEqual([
            'password',
            'password_confirmation',
            'current_password',
        ]);
        expect(form.props.resetOnSuccess).toBe(true);
    });

    it('can show each of the three passwords', async () => {
        renderWithProviders(<Card />);

        const toggles = screen.getAllByRole('button', {
            name: 'Show password',
        });
        const labels = [
            'Current password',
            'New password',
            'Confirm new password',
        ];

        expect(toggles.length).toBe(3);

        for (const [index, toggle] of toggles.entries()) {
            expect(field(labels[index]).type).toBe('password');

            await userEvent.click(toggle);

            expect(field(labels[index]).type).toBe('text');
            expect(toggle.getAttribute('aria-label')).toBe('Hide password');
        }
    });

    it('measures the new password as it is typed and states the rule of the server', async () => {
        renderWithProviders(<Card passwordRules="minlength: 12;" />);

        await userEvent.type(field('New password'), 'abcdefghijklmn');

        expect(screen.getByRole('meter').getAttribute('aria-valuetext')).toBe(
            'Good',
        );
        expect(
            screen.getByRole('list', { name: 'Password rules' }).textContent,
        ).toBe('At least 12 characters(met)');
        expect(screen.queryByText(/data breaches/)).toBeNull();
    });

    it('marks the confirmation once it matches the new password', async () => {
        renderWithProviders(<Card />);

        await userEvent.type(field('New password'), 'correct horse');
        await userEvent.type(field('Confirm new password'), 'correct');

        expect(
            screen.queryByRole('img', { name: 'Passwords match' }),
        ).toBeNull();

        await userEvent.type(field('Confirm new password'), ' horse');

        expect(
            screen.getByRole('img', { name: 'Passwords match' }),
        ).toBeTruthy();
    });

    it('shows a refusal under its field', () => {
        form.errors = { current_password: 'The password is incorrect.' };
        renderWithProviders(<Card />);

        expect(
            document.getElementById('current_password-error')?.textContent,
        ).toBe('The password is incorrect.');
        expect(field('Current password').getAttribute('aria-invalid')).toBe(
            'true',
        );
    });

    it('empties the new password and focuses the refused field after an error', async () => {
        renderWithProviders(<Card />);

        await userEvent.type(field('New password'), 'short');
        await userEvent.type(field('Confirm new password'), 'short');

        act(() =>
            (form.props.onError as (errors: Record<string, string>) => void)({
                current_password: 'The password is incorrect.',
            }),
        );

        expect(field('New password').value).toBe('');
        expect(field('Confirm new password').value).toBe('');
        expect(document.activeElement?.id).toBe('current_password');
    });

    it('empties the fields and the meter once the password is changed', async () => {
        renderWithProviders(<Card />);

        await userEvent.type(field('New password'), 'abcdefghijklmn');

        act(() => (form.props.onSuccess as () => void)());

        expect(field('New password').value).toBe('');
        expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe(
            '0',
        );
    });

    it('disables the button while the password is saved', () => {
        form.processing = true;
        renderWithProviders(<Card />);

        expect(
            screen
                .getByRole('button', { name: 'Update password' })
                .hasAttribute('disabled'),
        ).toBe(true);
    });

    it.each([
        ['idle', 'Not found in known data breaches'],
        ['checking', 'Checking known data breaches…'],
        ['clear', 'Not found in known data breaches(met)'],
        ['breached', 'Found in known data breaches: choose another one'],
        ['unavailable', 'Checked against known data breaches when you save'],
    ] as Array<[BreachState, string]>)(
        'ends the rules with the breach line while %s',
        async (state, text) => {
            breach.state = state;
            renderWithProviders(
                <Card checksCompromisedPasswords liveBreachCheck />,
            );

            await userEvent.type(field('New password'), 'p');

            expect(
                screen.getByRole('list', { name: 'Password rules' })
                    .lastElementChild?.textContent,
            ).toBe(text);
            expect(breach.calls.at(-1)).toEqual(['p', true]);
        },
    );

    it('points the new password at the breach line once the password is found in a breach', () => {
        breach.state = 'breached';
        renderWithProviders(
            <Card checksCompromisedPasswords liveBreachCheck />,
        );

        expect(field('New password').getAttribute('aria-describedby')).toBe(
            'password-breach-line',
        );
        expect(
            document.getElementById('password-breach-line')?.textContent,
        ).toBe('Found in known data breaches: choose another one');
    });

    it('checks only at save when the instance does not check live', () => {
        renderWithProviders(
            <Card checksCompromisedPasswords liveBreachCheck={false} />,
        );

        expect(
            screen.getByRole('list', { name: 'Password rules' })
                .lastElementChild?.textContent,
        ).toBe('Checked against known data breaches when you save');
        expect(breach.calls.at(-1)).toEqual(['', false]);
    });

    it('lists no breach line when the server does not check', () => {
        breach.state = 'breached';
        renderWithProviders(<Card liveBreachCheck />);

        expect(screen.queryByText(/data breaches/)).toBeNull();
        expect(breach.calls.at(-1)?.[1]).toBe(false);
    });

    it('sets a first password without the current one when the account has none it knows (rule S-1)', () => {
        renderWithProviders(<Card isSet={false} />);

        expect(screen.getByText('Set a password')).toBeTruthy();
        expect(screen.queryByLabelText('Current password')).toBeNull();
        expect(
            screen.getByRole('button', { name: 'Set the password' }),
        ).toBeTruthy();
        expect(
            screen.queryByRole('button', { name: 'Update password' }),
        ).toBeNull();
        expect(document.querySelector('form')?.getAttribute('action')).toBe(
            '/settings/password?_method=PUT',
        );
    });
});
