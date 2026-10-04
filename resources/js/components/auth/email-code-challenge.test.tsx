import { act, fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailCodeChallenge } from '@/components/auth/email-code-challenge';
import { createFormState } from '@/test/inertia-form';
import { renderWithProviders } from '@/test/render';

type VisitOptions = {
    onSuccess?: (page: { props: Record<string, unknown> }) => void;
    onError?: (errors: Record<string, string>) => void;
};

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
const form = vi.hoisted(() => ({
    processing: false,
    errors: {} as Record<string, string>,
    props: {} as Record<string, unknown>,
}));
const router = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const { formMock } = await import('@/test/inertia-form');

    return {
        ...(await importOriginal<typeof import('@inertiajs/react')>()),
        usePage: () => page,
        Form: formMock(form),
        router,
    };
});

function codeInput(): HTMLInputElement {
    return screen.getByLabelText('Code received by e-mail') as HTMLInputElement;
}

function resendButton(): HTMLElement {
    return screen.getByRole('button', { name: 'Resend the code' });
}

beforeEach(() => {
    page.props = { translations: {}, locale: 'en' };
    Object.assign(form, createFormState());
    router.post.mockReset();
});

describe('EmailCodeChallenge', () => {
    it('says where the code went and sends nothing during the cooldown', () => {
        renderWithProviders(
            <EmailCodeChallenge
                sentTo="a…@example.test"
                resendIn={42}
                available
            />,
        );

        expect(screen.getByText('a…@example.test')).toBeTruthy();
        expect(resendButton().getAttribute('aria-disabled')).toBe('true');

        fireEvent.click(resendButton());

        expect(router.post).not.toHaveBeenCalled();
    });

    it('asks for a new code once the cooldown is over, and starts the cooldown the server answers', () => {
        router.post.mockImplementation(
            (_url: string, _data: unknown, options: VisitOptions) =>
                options.onSuccess?.({
                    props: { emailCode: { resendIn: 60 } },
                }),
        );
        renderWithProviders(
            <EmailCodeChallenge
                sentTo="a…@example.test"
                resendIn={0}
                available
            />,
        );

        fireEvent.click(resendButton());

        expect(router.post).toHaveBeenCalledTimes(1);
        expect(router.post.mock.calls[0][0]).toBe(
            '/two-factor-challenge/email-code',
        );
        expect(resendButton().getAttribute('aria-disabled')).toBe('true');
    });

    it('says so when the server sent no new code', () => {
        router.post.mockImplementation(
            (_url: string, _data: unknown, options: VisitOptions) =>
                options.onError?.({
                    email_code: 'No code could be sent. Try again later.',
                }),
        );
        renderWithProviders(
            <EmailCodeChallenge
                sentTo="a…@example.test"
                resendIn={0}
                available
            />,
        );

        fireEvent.click(resendButton());

        expect(screen.getByRole('alert').textContent).toBe(
            'No code could be sent. Try again later.',
        );
    });

    it('empties the code after an accepted code', () => {
        renderWithProviders(
            <EmailCodeChallenge
                sentTo="a…@example.test"
                resendIn={10}
                available
            />,
        );

        fireEvent.change(codeInput(), { target: { value: '123456' } });
        act(() => {
            (form.props.onSuccess as () => void)();
        });

        expect(codeInput().value).toBe('');
    });

    it('sends six digits to the e-mail route, never to the authenticator route', () => {
        const { container } = renderWithProviders(
            <EmailCodeChallenge
                sentTo="a…@example.test"
                resendIn={10}
                available
            />,
        );
        const submit = screen.getByRole('button', {
            name: 'Continue',
        }) as HTMLButtonElement;

        expect(container.querySelector('form')?.getAttribute('action')).toBe(
            '/two-factor-challenge/email',
        );
        expect(codeInput().getAttribute('name')).toBe('code');
        expect(submit.disabled).toBe(true);

        fireEvent.change(codeInput(), { target: { value: '123456' } });

        expect(submit.disabled).toBe(false);
    });

    it('shows a refused code under the field', () => {
        form.errors = { code: 'The code is wrong or has expired.' };
        renderWithProviders(
            <EmailCodeChallenge
                sentTo="a…@example.test"
                resendIn={10}
                available
            />,
        );

        expect(screen.getByRole('alert').textContent).toBe(
            'The code is wrong or has expired.',
        );
        expect(codeInput().getAttribute('aria-invalid')).toBe('true');
    });

    it('explains that no code can be sent when mail does not deliver', () => {
        renderWithProviders(
            <EmailCodeChallenge
                sentTo="a…@example.test"
                resendIn={0}
                available={false}
            />,
        );

        expect(screen.getByRole('alert').textContent).toContain(
            'E-mail is not available on this instance',
        );
        expect(
            screen.queryByRole('button', { name: 'Resend the code' }),
        ).toBeNull();
    });
});
