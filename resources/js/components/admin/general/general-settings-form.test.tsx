import { router } from '@inertiajs/react';
import { act, fireEvent, screen } from '@testing-library/react';
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
        signupMode: null,
        allowedEmailDomains: null,
        defaults: { signupMode: 'invite', allowedEmailDomains: [] },
        maintenanceMessage: null,
        maintenanceMessageBy: null,
        maintenanceMessageAt: null,
        updateCheckEnabled: false,
        version: '1.8.2',
        versionStatus: { state: 'unknown', latest: null, checkedAt: null },
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

function message(): HTMLTextAreaElement {
    return screen.getByLabelText('Message') as HTMLTextAreaElement;
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

        fireEvent.change(message(), { target: { value: 'Back soon.' } });
        fireEvent.click(
            screen.getByRole('switch', {
                name: 'Check for new versions once a day',
            }),
        );

        expect(status()).toBe('3 unsaved changes');

        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(status()).toBe('No unsaved changes');
        expect(message().value).toBe('');
        expect(
            screen
                .getByRole('radio', { name: 'Invitation only' })
                .getAttribute('aria-checked'),
        ).toBe('true');
    });

    it('does not count an edit that comes back to the saved value', () => {
        setup({ maintenanceMessage: 'Back soon.' });

        fireEvent.change(message(), { target: { value: 'Later.' } });
        fireEvent.change(message(), { target: { value: 'Back soon.' } });

        expect(status()).toBe('No unsaved changes');
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
            },
        });

        fireEvent.click(screen.getByRole('radio', { name: 'Allowed domains' }));

        expect(screen.getByText('acme.fr')).not.toBeNull();
        expect(saveButton().disabled).toBe(false);
    });
});

describe('GeneralSettingsForm maintenance message', () => {
    it('turns the counter destructive past 280 and disables Save', () => {
        setup();

        fireEvent.change(message(), { target: { value: 'a'.repeat(281) } });

        const counter = document.querySelector(
            '[data-slot=maintenance-counter]',
        ) as HTMLElement;

        expect(counter.textContent).toBe('281/280');
        expect(counter.hasAttribute('data-over')).toBe(true);
        expect(saveButton().disabled).toBe(true);

        fireEvent.change(message(), { target: { value: 'a'.repeat(280) } });

        expect(counter.hasAttribute('data-over')).toBe(false);
        expect(saveButton().disabled).toBe(false);
    });

    it('measures the message as it is sent, without its outer spaces', () => {
        setup();

        fireEvent.change(message(), {
            target: { value: `${'a'.repeat(280)} \n` },
        });

        expect(
            document.querySelector('[data-slot=maintenance-counter]')
                ?.textContent,
        ).toBe('280/280');
        expect(saveButton().disabled).toBe(false);
    });
});

describe('GeneralSettingsForm saving', () => {
    it('sends only the changed fields', () => {
        const visit = spyOnVisit();

        setup({ signupMode: 'open', maintenanceMessage: 'Back soon.' });

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

    it('sends a cleared message as null and the domains with the mode', () => {
        const visit = spyOnVisit();

        setup({ maintenanceMessage: 'Back soon.' });

        fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
        fireEvent.click(screen.getByRole('radio', { name: 'Allowed domains' }));

        const input = screen.getByLabelText('Email domains');

        fireEvent.change(input, { target: { value: 'acme.fr' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        submit();

        expect(visit.mock.calls[0][1]?.data).toEqual({
            signup_mode: 'domain',
            allowed_email_domains: ['acme.fr'],
            maintenance_message: null,
        });
    });

    it('shows the server errors under their fields', () => {
        const visit = spyOnVisit();

        setup({ signupMode: 'domain', allowedEmailDomains: ['acme.fr'] });

        fireEvent.change(message(), { target: { value: 'Back soon.' } });
        submit();

        act(() => {
            visit.mock.calls[0][1]?.onError?.({
                'allowed_email_domains.0': 'The domain is not valid.',
                maintenance_message: 'The message is too long.',
            });
        });

        expect(screen.getByText('The domain is not valid.')).not.toBeNull();
        expect(screen.getByText('The message is too long.')).not.toBeNull();
        expect(message().getAttribute('aria-invalid')).toBe('true');

        fireEvent.change(message(), { target: { value: 'Back at noon.' } });

        expect(screen.queryByText('The message is too long.')).toBeNull();

        const input = screen.getByLabelText('Email domains');

        fireEvent.change(input, { target: { value: 'atlas.fr' } });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(screen.queryByText('The domain is not valid.')).toBeNull();
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
