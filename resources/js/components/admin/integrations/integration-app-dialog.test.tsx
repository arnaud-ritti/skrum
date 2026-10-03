import { router } from '@inertiajs/react';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
    ConfigurationFieldDescription,
    IntegrationProviderSettings,
} from '@/lib/admin/types';
import { renderWithProviders } from '@/test/render';
import { IntegrationAppDialog } from './integration-app-dialog';
import type { IntegrationAppDialogProps } from './integration-app-dialog';

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

function secret(
    envName: string,
    overrides: Partial<ConfigurationFieldDescription> = {},
): ConfigurationFieldDescription {
    return described(null, envName, {
        secret: true,
        secretSet: true,
        source: 'stored',
        ...overrides,
    });
}

function github(
    overrides: Partial<IntegrationProviderSettings> = {},
): IntegrationProviderSettings {
    return {
        key: 'github',
        label: 'GitHub',
        configured: true,
        enabled: true,
        connectedTeams: 2,
        fields: {
            app_id: described('4242', 'GITHUB_APP_ID'),
            slug: described('skrum-atlas', 'GITHUB_APP_SLUG'),
            client_id: described('Iv1.atlas', 'GITHUB_APP_CLIENT_ID', {
                source: 'stored',
            }),
            client_secret: secret('GITHUB_APP_CLIENT_SECRET'),
            private_key: secret('GITHUB_APP_PRIVATE_KEY'),
            webhook_secret: secret('GITHUB_APP_WEBHOOK_SECRET'),
        },
        callbackUrl: 'https://skrum.test/integrations/github/callback',
        webhookUrl: 'https://skrum.test/integrations/github/webhooks',
        updateUrl: '/admin/integrations/github/app',
        ...overrides,
    };
}

function setup(overrides: Partial<IntegrationAppDialogProps> = {}) {
    const props: IntegrationAppDialogProps = {
        provider: github(),
        open: true,
        onOpenChange: vi.fn(),
        needsConfirmation: false,
        confirmUrl: '/admin/integrations/confirm',
        onConfirmationRefused: vi.fn(),
        ...overrides,
    };

    renderWithProviders(<IntegrationAppDialog {...props} />);

    return props;
}

function dialog() {
    return within(screen.getByRole('dialog', { name: 'GitHub app' }));
}

function field(label: string): HTMLInputElement {
    return dialog().getByLabelText(label) as HTMLInputElement;
}

function spyOnVisit() {
    return vi.spyOn(router, 'visit').mockImplementation(() => {});
}

function save(): void {
    act(() => {
        fireEvent.click(dialog().getByRole('button', { name: 'Save' }));
    });
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('IntegrationAppDialog', () => {
    it('shows the fields of the provider with empty secrets, each single-line one with its eye', () => {
        setup();

        expect(field('App ID').value).toBe('4242');
        expect(field('Client ID').value).toBe('Iv1.atlas');

        for (const label of ['Client secret', 'Webhook secret']) {
            expect(field(label).value).toBe('');
            expect(field(label).type).toBe('password');
            expect(field(label).placeholder).toBe('••••••••••••••••••');
        }

        expect(field('Private key').tagName).toBe('TEXTAREA');
        expect(field('Private key').value).toBe('');
        expect(
            dialog().getAllByRole('button', { name: 'Show what you typed' }),
        ).toHaveLength(2);
        expect(
            dialog().getByText('Every change is recorded in the audit log.'),
        ).not.toBeNull();
    });

    it('gives the callback and webhook URLs to copy', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);

        Object.assign(navigator, { clipboard: { writeText } });
        setup();

        expect(field('Callback URL').value).toBe(
            'https://skrum.test/integrations/github/callback',
        );
        expect(field('Webhook URL').value).toBe(
            'https://skrum.test/integrations/github/webhooks',
        );

        await act(async () => {
            fireEvent.click(
                dialog().getByRole('button', { name: 'Copy the webhook URL' }),
            );
        });

        expect(writeText).toHaveBeenCalledWith(
            'https://skrum.test/integrations/github/webhooks',
        );
    });

    it('sends only what changed and the typed secrets', () => {
        const visit = spyOnVisit();

        setup();
        fireEvent.change(field('App ID'), { target: { value: '4343' } });
        fireEvent.change(field('Client secret'), {
            target: { value: 'typed-secret' },
        });
        save();

        expect(visit.mock.calls[0][0]).toBe('/admin/integrations/github/app');
        expect(visit.mock.calls[0][1]?.method).toBe('put');
        expect(visit.mock.calls[0][1]?.data).toEqual({
            app_id: '4343',
            client_secret: 'typed-secret',
        });
    });

    it('closes once the app is saved', () => {
        const visit = spyOnVisit();
        const props = setup();

        fireEvent.change(field('App ID'), { target: { value: '4343' } });
        save();
        act(() => {
            visit.mock.calls[0][1]?.onSuccess?.({} as never);
        });

        expect(props.onOpenChange).toHaveBeenCalledWith(false);
    });

    it('asks before clearing the app of a provider that teams use', async () => {
        const visit = spyOnVisit();

        setup();
        fireEvent.click(
            within(
                field('Client ID').closest(
                    '[data-slot="configuration-field"]',
                ) as HTMLElement,
            ).getByRole('button', { name: 'Use the environment value' }),
        );
        save();

        expect(visit).not.toHaveBeenCalled();
        expect(screen.getByText("Clear GitHub's app?")).not.toBeNull();
        expect(
            screen.getByText(
                '2 teams lose it until it is configured again. Their settings are kept.',
            ),
        ).not.toBeNull();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
        });

        expect(visit).toHaveBeenCalledTimes(1);
    });

    it('clears the app of a provider no team uses without asking', () => {
        const visit = spyOnVisit();

        setup({ provider: github({ connectedTeams: 0 }) });
        fireEvent.click(
            within(
                field('Client ID').closest(
                    '[data-slot="configuration-field"]',
                ) as HTMLElement,
            ).getByRole('button', { name: 'Use the environment value' }),
        );
        save();

        expect(screen.queryByText("Clear GitHub's app?")).toBeNull();
        expect(visit).toHaveBeenCalledTimes(1);
    });

    it('asks for the password before any change', () => {
        setup({ needsConfirmation: true });

        expect(
            dialog().getByText(
                'Confirm your password to change these settings.',
            ),
        ).not.toBeNull();
        expect(
            dialog()
                .getByRole('link', { name: 'Confirm' })
                .getAttribute('href'),
        ).toBe('/admin/integrations/confirm');
        expect(field('App ID').readOnly).toBe(true);
        expect(
            (
                dialog().getByRole('button', {
                    name: 'Save',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });

    it('takes switches and host lists for the providers that have them', () => {
        const visit = spyOnVisit();

        renderWithProviders(
            <IntegrationAppDialog
                provider={{
                    key: 'msteams',
                    label: 'Microsoft Teams',
                    configured: false,
                    enabled: false,
                    connectedTeams: 0,
                    fields: {
                        enabled: described(false, 'MSTEAMS_ENABLED'),
                        allowed_hosts: described(
                            ['atlas.webhook.office.com'],
                            'MSTEAMS_ALLOWED_HOSTS',
                        ),
                    },
                    callbackUrl: null,
                    webhookUrl: null,
                    updateUrl: '/admin/integrations/msteams/app',
                }}
                open
                onOpenChange={vi.fn()}
                needsConfirmation={false}
                confirmUrl="/admin/integrations/confirm"
                onConfirmationRefused={vi.fn()}
            />,
        );

        const teams = within(
            screen.getByRole('dialog', { name: 'Microsoft Teams app' }),
        );
        const hosts = teams.getByLabelText('Allowed hosts') as HTMLInputElement;

        expect(hosts.value).toBe('atlas.webhook.office.com');

        fireEvent.click(teams.getByRole('switch', { name: 'Enabled' }));
        fireEvent.change(hosts, {
            target: { value: 'atlas.webhook.office.com, ' },
        });

        expect(hosts.value).toBe('atlas.webhook.office.com, ');

        fireEvent.change(hosts, {
            target: {
                value: 'atlas.webhook.office.com, beta.webhook.office.com',
            },
        });
        act(() => {
            fireEvent.click(teams.getByRole('button', { name: 'Save' }));
        });

        const transformed = visit.mock.calls[0][1]?.data;

        expect(transformed).toEqual({
            enabled: true,
            allowed_hosts: [
                'atlas.webhook.office.com',
                'beta.webhook.office.com',
            ],
        });
    });
});
