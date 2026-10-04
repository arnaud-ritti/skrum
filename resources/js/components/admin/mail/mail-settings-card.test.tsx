import { router } from '@inertiajs/react';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
    ConfigurationFieldDescription,
    MailSettings,
} from '@/lib/admin/types';
import { renderWithProviders } from '@/test/render';
import { MailSettingsCard } from './mail-settings-card';
import type { MailSettingsCardProps } from './mail-settings-card';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

function described(
    value: ConfigurationFieldDescription['value'],
    envName: string,
    overrides: Partial<ConfigurationFieldDescription> = {},
): ConfigurationFieldDescription {
    return {
        value,
        source: 'environment',
        secret: false,
        secretSet: false,
        unreadable: false,
        envName,
        ...overrides,
    };
}

function mail(overrides: Partial<MailSettings> = {}): MailSettings {
    return {
        delivering: true,
        fields: {
            mailer: described('smtp', 'MAIL_MAILER'),
            host: described('smtp.atlas.test', 'MAIL_HOST', {
                source: 'stored',
            }),
            port: described(587, 'MAIL_PORT'),
            scheme: described('smtp', 'MAIL_SCHEME'),
            username: described('skrum', 'MAIL_USERNAME'),
            password: described(null, 'MAIL_PASSWORD', {
                secret: true,
                secretSet: true,
            }),
            from_address: described('retro@atlas.test', 'MAIL_FROM_ADDRESS'),
            from_name: described('Atlas Retros', 'MAIL_FROM_NAME'),
        },
        ...overrides,
    };
}

function setup(overrides: Partial<MailSettingsCardProps> = {}) {
    const props: MailSettingsCardProps = {
        mail: mail(),
        updateUrl: '/admin/mail',
        lastTest: null,
        defaultRecipient: 'arnaud@atlas.test',
        needsConfirmation: false,
        onConfirmationRefused: vi.fn(),
        ...overrides,
    };

    renderWithProviders(<MailSettingsCard {...props} />);

    return props;
}

function input(label: string): HTMLInputElement {
    return screen.getByLabelText(label) as HTMLInputElement;
}

function password(): HTMLInputElement {
    return input('Password');
}

function save(): void {
    act(() => {
        fireEvent.submit(screen.getByRole('form', { name: 'SMTP' }));
    });
}

function spyOnVisit() {
    return vi.spyOn(router, 'visit').mockImplementation(() => {});
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('MailSettingsCard', () => {
    it('shows the configuration in force with each source', () => {
        setup();

        expect(
            screen
                .getByText('Operational')
                .querySelector('[data-slot=badge-dot]'),
        ).not.toBeNull();
        expect(input('Host').value).toBe('smtp.atlas.test');
        expect(input('Port').value).toBe('587');
        expect(input('Username').value).toBe('skrum');
        expect(input('Sender address').value).toBe('retro@atlas.test');
        expect(
            screen
                .getByRole('radio', { name: 'Send through SMTP' })
                .getAttribute('aria-checked'),
        ).toBe('true');
        expect(
            screen.getByRole('combobox', { name: 'Encryption' }).textContent,
        ).toBe('STARTTLS when offered (smtp)');
        expect(
            screen.getByText('From the environment (MAIL_PORT)'),
        ).not.toBeNull();
        expect(
            screen.getByText('From the environment (MAIL_MAILER)'),
        ).not.toBeNull();
    });

    it('says when mails are only written to the log', () => {
        setup({ mail: mail({ delivering: false }) });

        expect(screen.getByText('Not configured')).not.toBeNull();
        expect(
            screen.getByText('Mails are written to the log.'),
        ).not.toBeNull();
    });

    it('never holds the password, and its eye shows only what was typed', () => {
        const visit = spyOnVisit();

        setup();

        expect(password().value).toBe('');
        expect(password().placeholder).toBe('••••••••••••••••••');

        const eye = screen.getByRole('button', { name: 'Show what you typed' });

        expect((eye as HTMLButtonElement).disabled).toBe(true);

        fireEvent.change(password(), { target: { value: 'typed-secret' } });
        fireEvent.click(eye);

        expect(password().type).toBe('text');
        expect(password().value).toBe('typed-secret');

        save();
        act(() => {
            visit.mock.calls[0][1]?.onError?.({
                password: 'This value is not accepted.',
            });
        });

        expect(password().value).toBe('');
    });

    it('keeps the SMTP fields but greys them when mails go to the log', () => {
        setup();

        fireEvent.click(
            screen.getByRole('radio', {
                name: "Don't send: write mails to the log",
            }),
        );

        expect(input('Host').value).toBe('smtp.atlas.test');
        expect(input('Host').disabled).toBe(true);
        expect(input('Username').disabled).toBe(true);
        expect(password().disabled).toBe(true);
        expect(input('Sender address').disabled).toBe(false);
    });

    it('sends the changed fields only, and not a blank password', () => {
        const visit = spyOnVisit();

        setup();

        fireEvent.change(input('Host'), {
            target: { value: 'smtp.stored.test' },
        });
        fireEvent.click(
            screen.getByRole('radio', {
                name: "Don't send: write mails to the log",
            }),
        );
        save();

        expect(visit.mock.calls[0][0]).toBe('/admin/mail');
        expect(visit.mock.calls[0][1]?.data).toEqual({
            host: 'smtp.stored.test',
            mailer: 'log',
        });
    });

    it('returns a stored field to the environment value', () => {
        const visit = spyOnVisit();

        setup();

        const host = input('Host').closest(
            '[data-slot=configuration-field]',
        ) as HTMLElement;

        fireEvent.click(
            within(host).getByRole('button', {
                name: 'Use the environment value',
            }),
        );
        save();

        expect(visit.mock.calls[0][1]?.data).toEqual({ clear: ['host'] });
    });

    it('is read-only and cannot be saved without a fresh confirmation', () => {
        const visit = spyOnVisit();

        setup({ needsConfirmation: true });

        expect(input('Host').readOnly).toBe(true);
        expect(password().readOnly).toBe(true);

        save();

        expect(visit).not.toHaveBeenCalled();
    });

    it('keeps the typed host when the server asks for a confirmation', () => {
        const visit = spyOnVisit();
        const props = setup();

        fireEvent.change(input('Host'), {
            target: { value: 'smtp.stored.test' },
        });
        fireEvent.change(password(), { target: { value: 'typed-secret' } });
        save();
        act(() => {
            visit.mock.calls[0][1]?.onError?.({
                confirmation: 'Confirm your password again.',
            });
        });

        expect(input('Host').value).toBe('smtp.stored.test');
        expect(password().value).toBe('');
        expect(props.onConfirmationRefused).toHaveBeenCalledOnce();
    });

    it('cannot send a test while the settings have unsaved changes', () => {
        setup();

        fireEvent.change(input('Host'), {
            target: { value: 'smtp.stored.test' },
        });

        expect(
            (screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement)
                .disabled,
        ).toBe(true);
    });

    it('says that every change is audited and mailed to the admins', () => {
        setup();

        expect(
            screen.getByText(
                'Every change is recorded in the audit log and mailed to every instance admin.',
            ),
        ).not.toBeNull();
    });

    it('empties the password and allows a test once a save that changes no description succeeds', async () => {
        const visit = spyOnVisit();

        setup();

        fireEvent.change(password(), { target: { value: 'same-secret' } });
        save();
        await act(async () => {
            await Promise.resolve(
                visit.mock.calls[0][1]?.onSuccess?.({} as never),
            );
        });

        expect(password().value).toBe('');
        expect(
            (screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement)
                .disabled,
        ).toBe(false);
        expect(
            screen.queryByText('Save first to test these values.'),
        ).toBeNull();
    });

    it('does not offer no encryption over an encryption from the environment', () => {
        setup();

        fireEvent.click(screen.getByRole('combobox', { name: 'Encryption' }));

        expect(
            screen
                .getByRole('option', { name: 'None' })
                .getAttribute('aria-disabled'),
        ).toBe('true');
    });

    it('names a mailer from the environment that is neither SMTP nor the log', () => {
        setup({
            mail: mail({
                fields: {
                    ...mail().fields,
                    mailer: described('ses', 'MAIL_MAILER'),
                },
            }),
        });

        expect(
            screen.getByText('Another mailer from the environment (ses)'),
        ).not.toBeNull();
    });
});
