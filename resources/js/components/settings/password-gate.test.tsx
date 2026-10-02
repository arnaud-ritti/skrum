import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import { PasswordGateProvider, usePasswordGate } from './password-gate';

type ReloadOptions = { only?: string[]; onFinish?: () => void };
type PostOptions = {
    onSuccess?: () => void;
    onError?: (errors: Record<string, string>) => void;
};

const router = vi.hoisted(() => ({ reload: vi.fn() }));
const server = vi.hoisted(() => ({
    confirmed: false as boolean | 'unreachable',
    password: 'right-password',
    sent: undefined as unknown,
    status: vi.fn(),
    post: vi.fn(),
}));
const passkey = vi.hoisted(() => ({
    isSupported: true,
    routes: undefined as unknown,
    verify: vi.fn(),
}));

vi.mock('@inertiajs/react', async (importOriginal) => {
    const { useRef } = await import('react');

    return {
        ...(await importOriginal<typeof import('@inertiajs/react')>()),
        usePage: () => ({ props: { translations: {} } }),
        router,
        useHttp: (data?: Record<string, unknown>) => {
            const transform = useRef((current: unknown) => current);

            if (data === undefined) {
                return {
                    submit: async (route: { url: string }) => {
                        server.status(route.url);

                        if (server.confirmed === 'unreachable') {
                            throw new Error('unreachable');
                        }

                        return { confirmed: server.confirmed };
                    },
                };
            }

            return {
                transform: (callback: (current: unknown) => unknown) => {
                    transform.current = callback;
                },
                post: async (url: string, options: PostOptions) => {
                    const sent = transform.current(data) as {
                        password: string;
                    };

                    server.post(url, sent);

                    if (sent.password === server.password) {
                        server.confirmed = true;
                        options.onSuccess?.();

                        return '';
                    }

                    options.onError?.({
                        password: 'The provided password was incorrect.',
                    });

                    return undefined;
                },
            };
        },
    };
});

vi.mock('@laravel/passkeys/react', () => ({
    usePasskeyVerify: ({
        routes,
        onSuccess,
    }: {
        routes: unknown;
        onSuccess: () => void;
    }) => {
        passkey.routes = routes;

        return {
            verify: () => {
                passkey.verify();
                server.confirmed = true;
                onSuccess();
            },
            isLoading: false,
            error: null,
            errorInstance: null,
            isSupported: passkey.isSupported,
        };
    },
}));

const action = vi.fn();

function Card() {
    const { guard } = usePasswordGate();

    return (
        <button type="button" onClick={() => guard(action)}>
            Protected action
        </button>
    );
}

function gate(locked: boolean, passkeys = false) {
    return renderWithProviders(
        <PasswordGateProvider locked={locked} passkeys={passkeys}>
            <Card />
        </PasswordGateProvider>,
    );
}

async function ask(): Promise<void> {
    await userEvent.click(
        screen.getByRole('button', { name: 'Protected action' }),
    );
}

async function typePassword(password: string): Promise<void> {
    await userEvent.type(await screen.findByLabelText(/^Password/), password);
    await userEvent.click(
        screen.getByRole('button', { name: 'Confirm password' }),
    );
}

beforeEach(() => {
    action.mockReset();
    router.reload.mockReset();
    router.reload.mockImplementation((options: ReloadOptions) =>
        options.onFinish?.(),
    );
    server.confirmed = false;
    server.status.mockReset();
    server.post.mockReset();
    passkey.isSupported = true;
    passkey.verify.mockReset();
});

describe('usePasswordGate, outside the page', () => {
    it('runs the action and leaves the refusal to the server', async () => {
        renderWithProviders(<Card />);

        await ask();

        expect(action).toHaveBeenCalledOnce();
        expect(server.status).not.toHaveBeenCalled();
    });
});

describe('PasswordGateProvider', () => {
    it('lets the action go when the server still accepts the confirmation, without a dialog', async () => {
        server.confirmed = true;
        gate(false);

        await ask();

        await waitFor(() => expect(action).toHaveBeenCalledOnce());
        expect(server.status).toHaveBeenCalledWith(
            '/user/confirmed-password-status',
        );
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(router.reload).not.toHaveBeenCalled();
    });

    it('loads what the server kept back before the action, when the confirmation was made elsewhere', async () => {
        server.confirmed = true;
        router.reload.mockImplementation((options: ReloadOptions) => {
            expect(action).not.toHaveBeenCalled();
            options.onFinish?.();
        });
        gate(true);

        await ask();

        await waitFor(() => expect(action).toHaveBeenCalledOnce());
        expect(router.reload).toHaveBeenCalledOnce();
        expect(router.reload.mock.calls[0][0].only).toEqual([
            'security',
            'apiTokens',
        ]);
    });

    it('asks for the password in a dialog and holds the action until it is confirmed', async () => {
        gate(true);

        await ask();

        expect(
            await screen.findByRole('dialog', {
                name: 'Confirm your password',
            }),
        ).toBeTruthy();
        expect(action).not.toHaveBeenCalled();
        expect(server.post).not.toHaveBeenCalled();
        expect(router.reload).not.toHaveBeenCalled();
    });

    it('confirms the password in the page, loads the protected props, then runs the action', async () => {
        gate(true);

        await ask();
        await typePassword('right-password');

        await waitFor(() => expect(action).toHaveBeenCalledOnce());
        expect(server.post).toHaveBeenCalledWith('/user/confirm-password', {
            password: 'right-password',
        });
        expect(router.reload).toHaveBeenCalledOnce();
        expect(router.reload.mock.calls[0][0].only).toEqual([
            'security',
            'apiTokens',
        ]);
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('keeps the dialog open on a wrong password, says so at the field and does nothing else', async () => {
        gate(true);

        await ask();
        await typePassword('wrong-password');

        expect(
            await screen.findByText('The provided password was incorrect.'),
        ).toBeTruthy();
        expect(screen.getByRole('dialog')).toBeTruthy();
        expect(action).not.toHaveBeenCalled();
        expect(router.reload).not.toHaveBeenCalled();
    });

    it('drops the action when the reader gives up', async () => {
        gate(true);

        await ask();
        await userEvent.click(
            await screen.findByRole('button', { name: 'Cancel' }),
        );

        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        expect(action).not.toHaveBeenCalled();
        expect(router.reload).not.toHaveBeenCalled();
    });

    it('asks for the password when the server cannot say whether the confirmation holds', async () => {
        server.confirmed = 'unreachable';
        gate(false);

        await ask();

        expect(await screen.findByRole('dialog')).toBeTruthy();
        expect(action).not.toHaveBeenCalled();
    });

    it('asks again at the next action once the confirmation has expired', async () => {
        server.confirmed = true;
        gate(false);

        await ask();
        await waitFor(() => expect(action).toHaveBeenCalledOnce());

        server.confirmed = false;
        await ask();

        expect(await screen.findByRole('dialog')).toBeTruthy();
        expect(action).toHaveBeenCalledOnce();
    });

    it('offers a passkey in place of the password where the instance has passkeys', async () => {
        gate(true, true);

        await ask();
        await userEvent.click(
            await screen.findByRole('button', { name: 'Confirm with passkey' }),
        );

        await waitFor(() => expect(action).toHaveBeenCalledOnce());
        expect(passkey.routes).toEqual({
            options: '/passkeys/confirm/options',
            submit: '/passkeys/confirm',
        });
        expect(router.reload).toHaveBeenCalledOnce();
        expect(server.post).not.toHaveBeenCalled();
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('offers no passkey where the instance has none or the browser cannot use one', async () => {
        const { unmount } = gate(true, false);

        await ask();
        await screen.findByRole('dialog');

        expect(
            screen.queryByRole('button', { name: 'Confirm with passkey' }),
        ).toBeNull();

        unmount();
        passkey.isSupported = false;
        gate(true, true);
        await act(async () => {
            await ask();
        });
        await screen.findByRole('dialog');

        expect(
            screen.queryByRole('button', { name: 'Confirm with passkey' }),
        ).toBeNull();
    });
});
