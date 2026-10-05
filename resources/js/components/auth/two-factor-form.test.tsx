import { act, fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TwoFactorForm } from '@/components/auth/two-factor-form';
import type { TwoFactorMode } from '@/components/auth/two-factor-form';
import { renderWithProviders } from '@/test/render';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
const form = vi.hoisted(() => ({
    processing: false,
    errors: {} as Record<string, string>,
    props: {} as Record<string, unknown>,
    cleared: 0,
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const { formMock } = await import('@/test/inertia-form');

    return {
        ...(await importOriginal<typeof import('@inertiajs/react')>()),
        usePage: () => page,
        Form: formMock(form),
    };
});

function Harness({ initial = 'code' }: { initial?: TwoFactorMode }) {
    const [mode, setMode] = useState<TwoFactorMode>(initial);

    return (
        <>
            <output data-testid="mode">{mode}</output>
            <TwoFactorForm mode={mode} onModeChange={setMode} />
        </>
    );
}

function codeInput(): HTMLInputElement {
    return screen.getByLabelText('Authentication code') as HTMLInputElement;
}

beforeEach(() => {
    page.props = { translations: {} };
    form.processing = false;
    form.errors = {};
    form.props = {};
    form.cleared = 0;
});

describe('TwoFactorForm', () => {
    it('asks for the six digits of the authenticator, in two groups of three', () => {
        const { container } = renderWithProviders(<Harness />);

        const input = codeInput();

        expect(input.getAttribute('name')).toBe('code');
        expect(input.maxLength).toBe(6);
        expect(input.getAttribute('inputmode')).toBe('numeric');
        expect(input.getAttribute('autocomplete')).toBe('one-time-code');
        expect(
            container.querySelectorAll('[data-slot="input-otp-slot"]'),
        ).toHaveLength(6);
        expect(screen.getAllByRole('separator')).toHaveLength(1);
        expect(container.querySelector('form')?.getAttribute('action')).toBe(
            '/two-factor-challenge',
        );
        expect(screen.queryByPlaceholderText('Enter recovery code')).toBeNull();
    });

    it('accepts digits only', () => {
        renderWithProviders(<Harness />);

        fireEvent.change(codeInput(), { target: { value: '12a' } });
        expect(codeInput().value).toBe('');

        fireEvent.change(codeInput(), { target: { value: '123' } });
        expect(codeInput().value).toBe('123');
    });

    it('keeps "Continue" disabled until the code is complete', () => {
        renderWithProviders(<Harness />);

        const submit = screen.getByRole('button', {
            name: 'Continue',
        }) as HTMLButtonElement;

        expect(submit.disabled).toBe(true);
        expect(submit.getAttribute('type')).toBe('submit');

        fireEvent.change(codeInput(), { target: { value: '123456' } });

        expect(submit.disabled).toBe(false);
    });

    it('empties the code after an accepted code', () => {
        renderWithProviders(<Harness />);

        fireEvent.change(codeInput(), { target: { value: '123456' } });
        act(() => {
            (form.props.onSuccess as () => void)();
        });

        expect(codeInput().value).toBe('');
    });

    it('submits by itself at the sixth digit', () => {
        const { container } = renderWithProviders(<Harness />);
        const submitted = vi.fn((event: Event) => event.preventDefault());

        container.querySelector('form')!.addEventListener('submit', submitted);

        fireEvent.change(codeInput(), { target: { value: '12345' } });
        expect(submitted).not.toHaveBeenCalled();

        fireEvent.change(codeInput(), { target: { value: '123456' } });
        expect(submitted).toHaveBeenCalledTimes(1);
    });

    it('shows the server error under the code and marks the field invalid', () => {
        form.errors = {
            code: 'The provided two factor authentication code was invalid.',
        };
        renderWithProviders(<Harness />);

        expect(screen.getByRole('alert').textContent).toBe(
            'The provided two factor authentication code was invalid.',
        );
        expect(codeInput().getAttribute('aria-invalid')).toBe('true');
    });

    it('disables the code and the button while the code is checked', () => {
        form.processing = true;
        renderWithProviders(<Harness />);

        expect(codeInput().disabled).toBe(true);
        expect(
            (
                screen.getByRole('button', {
                    name: 'Continue',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });

    it('switches to a recovery code, clearing the code and the errors', () => {
        renderWithProviders(<Harness />);

        fireEvent.change(codeInput(), { target: { value: '123' } });
        fireEvent.click(
            screen.getByRole('button', { name: 'login using a recovery code' }),
        );

        expect(screen.getByTestId('mode').textContent).toBe('recovery');
        expect(form.cleared).toBe(1);
        expect(screen.queryByLabelText('Authentication code')).toBeNull();

        const recovery = screen.getByLabelText(
            'Recovery code',
        ) as HTMLInputElement;

        expect(recovery.getAttribute('name')).toBe('recovery_code');
        expect(recovery.getAttribute('placeholder')).toBe(
            'Enter recovery code',
        );
        expect(recovery.required).toBe(true);
        expect(
            (
                screen.getByRole('button', {
                    name: 'Continue',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(false);
    });

    it('comes back to an empty authentication code', () => {
        renderWithProviders(<Harness />);

        fireEvent.change(codeInput(), { target: { value: '123' } });
        fireEvent.click(
            screen.getByRole('button', { name: 'login using a recovery code' }),
        );
        fireEvent.change(screen.getByLabelText('Recovery code'), {
            target: { value: 'abcde-fghij' },
        });
        fireEvent.click(
            screen.getByRole('button', {
                name: 'login using an authentication code',
            }),
        );

        expect(screen.getByTestId('mode').textContent).toBe('code');
        expect(codeInput().value).toBe('');

        fireEvent.click(
            screen.getByRole('button', { name: 'login using a recovery code' }),
        );

        expect(
            (screen.getByLabelText('Recovery code') as HTMLInputElement).value,
        ).toBe('');
    });

    it('shows the server error under the recovery code', () => {
        form.errors = {
            recovery_code: 'The provided two factor recovery code was invalid.',
        };
        renderWithProviders(<Harness initial="recovery" />);

        const recovery = screen.getByLabelText('Recovery code');

        expect(
            document.getElementById(`${recovery.id}-error`)?.textContent,
        ).toBe('The provided two factor recovery code was invalid.');
    });

    it('keeps a wrong code to be retyped, and resets a wrong recovery code', () => {
        const { unmount } = renderWithProviders(<Harness />);

        expect(form.props.resetOnError).toBe(false);
        expect(form.props.resetOnSuccess).toBe(true);
        unmount();

        renderWithProviders(<Harness initial="recovery" />);

        expect(form.props.resetOnError).toBe(true);
        expect(form.props.resetOnSuccess).toBe(false);
    });
});
