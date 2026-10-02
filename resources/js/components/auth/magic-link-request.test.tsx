import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    MagicLinkButton,
    MagicLinkSent,
} from '@/components/auth/magic-link-request';
import { renderWithProviders } from '@/test/render';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));
const post = vi.hoisted(() => vi.fn());

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    router: { post },
    usePage: () => page,
}));

beforeEach(() => {
    page.props = { locale: 'en', translations: {} };
    post.mockReset();
});

describe('MagicLinkButton', () => {
    it('posts the address typed in the login form', () => {
        renderWithProviders(
            <MagicLinkButton
                email="ada@example.test"
                onMissingAddress={() => {}}
                onSent={() => {}}
            />,
        );

        const button = screen.getByRole('button', {
            name: 'E-mail me a magic link instead',
        });

        expect(button.getAttribute('data-test')).toBe('magic-link-button');
        expect(button.getAttribute('type')).toBe('button');

        fireEvent.click(button);

        expect(post).toHaveBeenCalledTimes(1);
        expect(post.mock.calls[0][0]).toBe('/magic-link');
        expect(post.mock.calls[0][1]).toEqual({ email: 'ada@example.test' });
    });

    it('asks for the address instead of posting an empty one', () => {
        const onMissingAddress = vi.fn();

        renderWithProviders(
            <MagicLinkButton
                email="   "
                onMissingAddress={onMissingAddress}
                onSent={() => {}}
            />,
        );
        fireEvent.click(
            screen.getByRole('button', {
                name: 'E-mail me a magic link instead',
            }),
        );

        expect(post).not.toHaveBeenCalled();
        expect(onMissingAddress).toHaveBeenCalledTimes(1);
    });

    it('tells the form once the request was accepted', () => {
        const onSent = vi.fn();

        renderWithProviders(
            <MagicLinkButton
                email="ada@example.test"
                onMissingAddress={() => {}}
                onSent={onSent}
            />,
        );
        fireEvent.click(
            screen.getByRole('button', {
                name: 'E-mail me a magic link instead',
            }),
        );
        act(() => {
            post.mock.calls[0][2].onSuccess();
        });

        expect(onSent).toHaveBeenCalledTimes(1);
    });

    it('shows the refusal of the server under the button, not as a toast', () => {
        renderWithProviders(
            <MagicLinkButton
                email="ada@example.test"
                onMissingAddress={() => {}}
                onSent={() => {}}
            />,
        );
        fireEvent.click(
            screen.getByRole('button', {
                name: 'E-mail me a magic link instead',
            }),
        );
        act(() => {
            post.mock.calls[0][2].onError({ email: 'Too many attempts.' });
        });

        expect(screen.getByRole('alert').textContent).toBe(
            'Too many attempts.',
        );
    });

    it('is the primary button of the phone tab under another label', () => {
        renderWithProviders(
            <MagicLinkButton
                variant="primary"
                email="ada@example.test"
                onMissingAddress={() => {}}
                onSent={() => {}}
            />,
        );

        expect(
            screen
                .getByRole('button', { name: 'Receive the magic link' })
                .getAttribute('data-test'),
        ).toBe('magic-link-button');
    });
});

describe('MagicLinkSent', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const pass = (seconds: number) => {
        for (let second = 0; second < seconds; second++) {
            act(() => {
                vi.advanceTimersByTime(1000);
            });
        }
    };

    it('shows the state of the mockup with the address typed in this browser, the same for every address', () => {
        renderWithProviders(
            <MagicLinkSent
                email="ada@example.test"
                onUseAnotherAddress={() => {}}
            />,
        );

        expect(
            screen.getByRole('heading', { name: 'Check your inbox' }),
        ).toBeTruthy();
        expect(screen.getByRole('status').textContent).toBe(
            'If an account exists for ada@example.test, a sign-in link is on its way. It is valid for 15 minutes and works once.',
        );
        expect(screen.getByText('ada@example.test').tagName).toBe('STRONG');
        expect(screen.getByRole('note').textContent).toBe(
            'Nothing received? Check your spam folder. On a self-hosted instance, sending depends on the SMTP your admin configured.',
        );
    });

    it('moves the focus to its title when it replaces the form', () => {
        renderWithProviders(
            <MagicLinkSent
                email="ada@example.test"
                onUseAnotherAddress={() => {}}
            />,
        );

        expect(document.activeElement).toBe(
            screen.getByRole('heading', { name: 'Check your inbox' }),
        );
    });

    it('keeps the resend button disabled for a minute, counting down, then sends again', () => {
        renderWithProviders(
            <MagicLinkSent
                email="ada@example.test"
                onUseAnotherAddress={() => {}}
            />,
        );

        expect(
            screen
                .getByRole('button', { name: 'Resend in 1:00' })
                .hasAttribute('disabled'),
        ).toBe(true);

        pass(18);
        expect(
            screen
                .getByRole('button', { name: 'Resend in 0:42' })
                .hasAttribute('disabled'),
        ).toBe(true);

        pass(42);
        fireEvent.click(
            screen.getByRole('button', { name: 'Resend the link' }),
        );

        expect(post.mock.calls[0][1]).toEqual({ email: 'ada@example.test' });

        act(() => {
            post.mock.calls[0][2].onSuccess();
        });

        expect(
            screen
                .getByRole('button', { name: 'Resend in 1:00' })
                .hasAttribute('disabled'),
        ).toBe(true);
    });

    it('goes back to the form for another address', () => {
        const onUseAnotherAddress = vi.fn();

        renderWithProviders(
            <MagicLinkSent
                email="ada@example.test"
                onUseAnotherAddress={onUseAnotherAddress}
            />,
        );
        fireEvent.click(
            screen.getByRole('button', { name: 'Use another address' }),
        );

        expect(onUseAnotherAddress).toHaveBeenCalledTimes(1);
    });
});
