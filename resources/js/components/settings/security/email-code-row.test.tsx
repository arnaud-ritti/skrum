import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { EmailCodeRow } from './email-code-row';

type VisitOptions = {
    onSuccess?: (page: { props: Record<string, unknown> }) => void;
    onError?: (errors: Record<string, string>) => void;
    onFinish?: () => void;
};

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
const router = vi.hoisted(() => ({ post: vi.fn(), delete: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => page,
    router,
}));

beforeAll(() => {
    if (!('elementFromPoint' in document)) {
        Object.assign(document, { elementFromPoint: () => null });
    }
});

const off = {
    available: true,
    enabled: false,
    address: 'ada@example.test',
    resendIn: 0,
};

function succeed(props: Record<string, unknown> = {}) {
    return (_url: string, _data: unknown, options: VisitOptions) => {
        options.onSuccess?.({ props });
        options.onFinish?.();
    };
}

function codeInput(): HTMLInputElement {
    return screen.getByLabelText('Code received by email') as HTMLInputElement;
}

beforeEach(() => {
    page.props = { translations: {}, locale: 'en' };
    router.post.mockReset();
    router.delete.mockReset();
});

describe('EmailCodeRow, off', () => {
    it('names the address and offers to send a code, without a code field yet', () => {
        renderWithProviders(<EmailCodeRow {...off} appEnabled={false} />);

        expect(
            screen.getByText(
                'Receive a 6-digit code at ada@example.test each time you sign in.',
            ),
        ).toBeTruthy();
        expect(
            screen.getByRole('button', { name: 'Send me a code' }),
        ).toBeTruthy();
        expect(screen.queryByLabelText('Code received by email')).toBeNull();
    });

    it('sends a code, states the limits of the factor, then turns it on with the code', async () => {
        router.post.mockImplementationOnce(
            succeed({ emailSecondFactor: { ...off, resendIn: 60 } }),
        );
        renderWithProviders(<EmailCodeRow {...off} appEnabled={false} />);

        await userEvent.click(
            screen.getByRole('button', { name: 'Send me a code' }),
        );

        expect(router.post.mock.calls[0][0]).toBe(
            '/settings/email-second-factor/code',
        );
        expect(screen.getByText(/no recovery codes/)).toBeTruthy();
        expect(screen.getByText(/proves the same mailbox twice/)).toBeTruthy();

        const turnOn = screen.getByRole('button', {
            name: 'Turn on',
        }) as HTMLButtonElement;

        expect(turnOn.disabled).toBe(true);

        fireEvent.change(codeInput(), { target: { value: '123456' } });

        await waitFor(() => expect(router.post).toHaveBeenCalledTimes(2));
        expect(router.post.mock.calls[1][0]).toBe(
            '/settings/email-second-factor',
        );
        expect(router.post.mock.calls[1][1]).toEqual({ code: '123456' });
    });

    it('does not promise recovery codes are missing when the authenticator app is on', async () => {
        router.post.mockImplementationOnce(succeed());
        renderWithProviders(<EmailCodeRow {...off} appEnabled />);

        await userEvent.click(
            screen.getByRole('button', { name: 'Send me a code' }),
        );

        expect(screen.queryByText(/no recovery codes/)).toBeNull();
        expect(screen.getByText(/proves the same mailbox twice/)).toBeTruthy();
    });

    it('says so and opens no code field when the server sent no code', async () => {
        router.post.mockImplementationOnce(
            (_url: string, _data: unknown, options: VisitOptions) => {
                options.onError?.({
                    email_code: 'No code could be sent. Try again later.',
                });
                options.onFinish?.();
            },
        );
        renderWithProviders(<EmailCodeRow {...off} appEnabled={false} />);

        await userEvent.click(
            screen.getByRole('button', { name: 'Send me a code' }),
        );

        expect(screen.getByRole('alert').textContent).toBe(
            'No code could be sent. Try again later.',
        );
        expect(screen.queryByLabelText('Code received by email')).toBeNull();
    });

    it('shows a refused code under the field', async () => {
        router.post.mockImplementationOnce(succeed());
        router.post.mockImplementationOnce(
            (_url: string, _data: unknown, options: VisitOptions) => {
                options.onError?.({
                    code: 'The code is wrong or has expired.',
                });
                options.onFinish?.();
            },
        );
        renderWithProviders(<EmailCodeRow {...off} appEnabled={false} />);

        await userEvent.click(
            screen.getByRole('button', { name: 'Send me a code' }),
        );
        fireEvent.change(codeInput(), { target: { value: '123456' } });

        expect(
            await screen.findByText('The code is wrong or has expired.'),
        ).toBeTruthy();
    });

    it('opens on the code field when a code was sent less than a minute ago, and "Cancel" closes it', async () => {
        renderWithProviders(
            <EmailCodeRow {...off} resendIn={30} appEnabled={false} />,
        );

        expect(codeInput()).toBeTruthy();
        expect(
            screen
                .getByRole('button', { name: 'Resend the code' })
                .getAttribute('aria-disabled'),
        ).toBe('true');

        await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(screen.queryByLabelText('Code received by email')).toBeNull();
        expect(
            screen.getByRole('button', { name: 'Send me a code' }),
        ).toBeTruthy();
    });
});

describe('EmailCodeRow, on', () => {
    it('turns the factor off after a confirmation', async () => {
        router.delete.mockImplementation(
            (_url: string, options: VisitOptions) =>
                options.onSuccess?.({ props: {} }),
        );
        renderWithProviders(
            <EmailCodeRow {...off} enabled appEnabled={false} />,
        );

        expect(
            screen.queryByRole('button', { name: 'Send me a code' }),
        ).toBeNull();
        expect(screen.getByText(/no recovery codes/)).toBeTruthy();

        await userEvent.click(
            screen.getByRole('button', { name: 'Turn off the email code' }),
        );

        expect(router.delete).not.toHaveBeenCalled();

        const dialog = screen.getByRole('alertdialog', {
            name: 'Turn off the email code?',
        });

        await userEvent.click(
            within(dialog).getByRole('button', {
                name: 'Turn off the email code',
            }),
        );

        await waitFor(() => expect(router.delete).toHaveBeenCalledTimes(1));
        expect(router.delete.mock.calls[0][0]).toBe(
            '/settings/email-second-factor',
        );
    });

    it('says that codes cannot be sent when mail no longer delivers', () => {
        renderWithProviders(
            <EmailCodeRow {...off} available={false} enabled appEnabled />,
        );

        expect(screen.getByRole('alert').textContent).toContain(
            'Email is not available on this instance',
        );
    });
});
