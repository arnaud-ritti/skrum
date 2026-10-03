import { router } from '@inertiajs/react';
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IntegrationProviderSettings } from '@/lib/admin/types';
import { renderWithProviders } from '@/test/render';
import { IntegrationRow } from './integration-row';
import type { IntegrationRowProps } from './integration-row';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
}));

function provider(
    overrides: Partial<IntegrationProviderSettings> = {},
): IntegrationProviderSettings {
    return {
        key: 'slack',
        label: 'Slack',
        configured: true,
        enabled: true,
        connectedTeams: 3,
        fields: {
            client_id: {
                value: 'slack-id',
                source: 'environment',
                secret: false,
                secretSet: false,
                unreadable: false,
                envName: 'SLACK_CLIENT_ID',
            },
            client_secret: {
                value: null,
                source: 'stored',
                secret: true,
                secretSet: true,
                unreadable: false,
                envName: 'SLACK_CLIENT_SECRET',
            },
        },
        callbackUrl: 'https://skrum.test/integrations/slack/callback',
        webhookUrl: null,
        updateUrl: '/admin/integrations/slack/app',
        ...overrides,
    };
}

function setup(overrides: Partial<IntegrationRowProps> = {}) {
    const props: IntegrationRowProps = {
        provider: provider(),
        disabled: ['telegram'],
        needsConfirmation: false,
        confirmUrl: '/admin/integrations/confirm',
        onConfirmationRefused: vi.fn(),
        ...overrides,
    };

    renderWithProviders(<IntegrationRow {...props} />);

    return props;
}

function spyOnVisit() {
    return vi.spyOn(router, 'visit').mockImplementation(() => {});
}

function toggle(): HTMLButtonElement {
    return screen.getByRole('switch') as HTMLButtonElement;
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('IntegrationRow', () => {
    it('says how many teams use an available provider', () => {
        setup();

        expect(
            screen.getByText('Available · 3 teams connected'),
        ).not.toBeNull();
        expect(toggle().getAttribute('aria-checked')).toBe('true');
        expect(toggle().getAttribute('aria-describedby')).toBe(
            screen.getByText('Available · 3 teams connected').id,
        );
    });

    it('says a provider is turned off', () => {
        setup({ provider: provider({ enabled: false }) });

        expect(screen.getByText('Turned off')).not.toBeNull();
        expect(toggle().getAttribute('aria-checked')).toBe('false');
        expect(toggle().disabled).toBe(false);
    });

    it('cannot turn on a provider that is not configured', () => {
        setup({
            provider: provider({
                configured: false,
                enabled: false,
                connectedTeams: 0,
            }),
        });

        expect(screen.getByText('Not configured')).not.toBeNull();
        expect(toggle().disabled).toBe(true);
    });

    it('asks before turning off a provider that teams use, then sends the whole list', async () => {
        const visit = spyOnVisit();

        setup();
        fireEvent.click(toggle());

        expect(visit).not.toHaveBeenCalled();
        expect(screen.getByText('Turn Slack off?')).not.toBeNull();
        expect(
            screen.getByText(
                '3 teams lose it until you turn it back on. Their settings are kept.',
            ),
        ).not.toBeNull();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'Turn off' }));
        });

        expect(visit).toHaveBeenCalledTimes(1);
        expect(visit.mock.calls[0][0]).toBe('/admin/integrations');
        expect(visit.mock.calls[0][1]?.method).toBe('put');
        expect(visit.mock.calls[0][1]?.data).toEqual({
            disabled: ['telegram', 'slack'],
        });
    });

    it('turns off a provider no team uses without asking', () => {
        const visit = spyOnVisit();

        setup({ provider: provider({ connectedTeams: 0 }) });
        fireEvent.click(toggle());

        expect(screen.queryByText('Turn Slack off?')).toBeNull();
        expect(visit.mock.calls[0][1]?.data).toEqual({
            disabled: ['telegram', 'slack'],
        });
    });

    it('turns a provider back on', () => {
        const visit = spyOnVisit();

        setup({
            provider: provider({ enabled: false }),
            disabled: ['slack', 'telegram'],
        });
        fireEvent.click(toggle());

        expect(visit.mock.calls[0][1]?.data).toEqual({
            disabled: ['telegram'],
        });
    });

    it('opens the app dialog with the fields of the provider', () => {
        setup();

        fireEvent.click(screen.getByRole('button', { name: 'Configure' }));

        expect(
            screen.getByRole('dialog', { name: 'Slack app' }),
        ).not.toBeNull();
        expect(
            (screen.getByLabelText('Client ID') as HTMLInputElement).value,
        ).toBe('slack-id');
        expect(
            (screen.getByLabelText('Client secret') as HTMLInputElement).value,
        ).toBe('');
    });
});
