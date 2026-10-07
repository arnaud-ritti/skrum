import { router } from '@inertiajs/react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GeneralSettingsPageProps } from '@/lib/admin/types';
import { renderWithProviders } from '@/test/render';
import { GeneralSettingsForm } from './general-settings-form';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

function props(
    overrides: Partial<GeneralSettingsPageProps> = {},
): GeneralSettingsPageProps {
    return {
        requireEmailVerification: null,
        signupMode: null,
        allowedEmailDomains: null,
        defaults: {
            signupMode: 'invite',
            allowedEmailDomains: [],
            requireEmailVerification: true,
        },
        updateCheckEnabled: false,
        version: '1.8.2',
        versionStatus: {
            state: 'unknown',
            latest: null,
            checkedAt: null,
            releaseUrl: null,
        },
        image: 'ghcr.io/arnaud-ritti/skrum',
        ...overrides,
    };
}

function setup(overrides: Partial<GeneralSettingsPageProps> = {}) {
    return renderWithProviders(<GeneralSettingsForm {...props(overrides)} />);
}

function status(): string {
    return (
        document.querySelector('[data-slot=unsaved-bar] [role=status]')
            ?.textContent ?? ''
    );
}

function saveButton(): HTMLButtonElement {
    return screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
}

function submit(): void {
    act(() => {
        fireEvent.submit(screen.getByRole('form', { name: 'General' }));
    });
}

function spyOnVisit() {
    return vi.spyOn(router, 'visit').mockImplementation(() => {});
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('GeneralSettingsForm unsaved changes', () => {
    it('counts each changed field and returns to zero on Cancel', () => {
        setup();

        expect(status()).toBe('No unsaved changes');
        expect(saveButton().disabled).toBe(true);

        fireEvent.click(
            screen.getByRole('radio', { name: 'Open to everyone' }),
        );

        expect(status()).toBe('1 unsaved change');

        fireEvent.click(
            screen.getByRole('switch', {
                name: 'Check for new versions once a day',
            }),
        );

        expect(status()).toBe('2 unsaved changes');

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(status()).toBe('No unsaved changes');
        expect(
            screen
                .getByRole('radio', { name: 'Invitation only' })
                .getAttribute('aria-checked'),
        ).toBe('true');
    });

    it('does not count an edit that comes back to the saved value', () => {
        setup();

        const dailyCheck = screen.getByRole('switch', {
            name: 'Check for new versions once a day',
        });

        fireEvent.click(dailyCheck);
        fireEvent.click(dailyCheck);

        expect(status()).toBe('No unsaved changes');
    });

    it('offers no maintenance message', () => {
        setup();

        expect(screen.queryByLabelText('Message')).toBeNull();
        expect(screen.queryByText('Maintenance message')).toBeNull();
    });
});

describe('GeneralSettingsForm sign-up', () => {
    it('shows the domains field only in domain mode, and requires one', () => {
        setup();

        expect(screen.queryByLabelText('Email domains')).toBeNull();

        fireEvent.click(screen.getByRole('radio', { name: 'Allowed domains' }));

        expect(screen.getByLabelText('Email domains')).not.toBeNull();
        expect(screen.getByText('Add at least one domain.')).not.toBeNull();
        expect(saveButton().disabled).toBe(true);

        const input = screen.getByLabelText('Email domains');

        fireEvent.change(input, { target: { value: 'Acme.fr' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(screen.queryByText('Add at least one domain.')).toBeNull();
        expect(screen.getByText('acme.fr')).not.toBeNull();
        expect(saveButton().disabled).toBe(false);
    });

    it('accepts domain mode on the environment domains', () => {
        setup({
            defaults: {
                signupMode: 'invite',
                allowedEmailDomains: ['acme.fr'],
                requireEmailVerification: true,
            },
        });

        fireEvent.click(screen.getByRole('radio', { name: 'Allowed domains' }));

        expect(screen.getByText('acme.fr')).not.toBeNull();
        expect(saveButton().disabled).toBe(false);
    });
});

describe('GeneralSettingsForm saving', () => {
    it('sends only the changed fields', () => {
        const visit = spyOnVisit();

        setup({ signupMode: 'open' });

        fireEvent.click(
            screen.getByRole('switch', {
                name: 'Check for new versions once a day',
            }),
        );
        submit();

        expect(visit).toHaveBeenCalledOnce();
        expect(visit.mock.calls[0][1]?.method).toBe('put');
        expect(visit.mock.calls[0][1]?.data).toEqual({
            update_check_enabled: true,
        });
    });

    it('sends the domains with the mode', () => {
        const visit = spyOnVisit();

        setup();

        fireEvent.click(screen.getByRole('radio', { name: 'Allowed domains' }));

        const input = screen.getByLabelText('Email domains');

        fireEvent.change(input, { target: { value: 'acme.fr' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        submit();

        expect(visit.mock.calls[0][1]?.data).toEqual({
            signup_mode: 'domain',
            allowed_email_domains: ['acme.fr'],
        });
    });

    it('shows the server errors under their fields', () => {
        const visit = spyOnVisit();

        setup({ signupMode: 'domain', allowedEmailDomains: ['acme.fr'] });

        fireEvent.click(
            screen.getByRole('switch', {
                name: 'Check for new versions once a day',
            }),
        );
        submit();

        act(() => {
            visit.mock.calls[0][1]?.onError?.({
                'allowed_email_domains.0': 'The domain is not valid.',
            });
        });

        expect(screen.getByText('The domain is not valid.')).not.toBeNull();

        const input = screen.getByLabelText('Email domains');

        fireEvent.change(input, { target: { value: 'atlas.fr' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(screen.queryByText('The domain is not valid.')).toBeNull();
    });

    it('does not submit the form from the update procedure', async () => {
        const visit = spyOnVisit();

        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { writeText: vi.fn().mockResolvedValue(undefined) },
        });
        setup({ signupMode: 'open' });

        fireEvent.click(
            screen.getByRole('switch', {
                name: 'Check for new versions once a day',
            }),
        );
        fireEvent.click(screen.getByRole('button', { name: 'How to update' }));
        fireEvent.click(screen.getAllByRole('button', { name: 'Copy' })[0]);

        await waitFor(() =>
            expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy(),
        );
        expect(visit).not.toHaveBeenCalled();
        expect(status()).toBe('1 unsaved change');
    });
});

describe('GeneralSettingsForm frame', () => {
    it('hands the bar and the form to the frame, Save submitting the form', () => {
        renderWithProviders(
            <GeneralSettingsForm
                {...props()}
                frame={(bar, content) => (
                    <>
                        <header>{bar}</header>
                        {content}
                    </>
                )}
            />,
        );

        expect(
            screen
                .getByRole('banner')
                .querySelector('button[type=submit]')
                ?.getAttribute('form'),
        ).toBe(screen.getByRole('form', { name: 'General' }).id);
    });
});

describe('GeneralSettingsForm email verification', () => {
    it('saves the optional override', async () => {
        setup();
        const put = vi.spyOn(router, 'put').mockImplementation(() => {});
        fireEvent.click(screen.getByRole('radio', { name: /^Optional$/ }));
        fireEvent.submit(screen.getByRole('form', { name: 'General' }));
        await waitFor(() => expect(put).toHaveBeenCalled());
        expect(put.mock.calls[0][1]).toEqual({
            require_email_verification: false,
        });
    });

    it('clears the override to follow the environment', async () => {
        setup({ requireEmailVerification: false });
        const put = vi.spyOn(router, 'put').mockImplementation(() => {});
        fireEvent.click(
            screen.getByRole('radio', { name: /Use environment default/ }),
        );
        fireEvent.submit(screen.getByRole('form', { name: 'General' }));
        await waitFor(() => expect(put).toHaveBeenCalled());
        expect(put.mock.calls[0][1]).toEqual({
            require_email_verification: null,
        });
    });
});
