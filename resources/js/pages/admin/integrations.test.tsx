import { screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type {
    IntegrationProviderSettings,
    IntegrationSettingsPageProps,
} from '@/lib/admin/types';
import { renderWithProviders } from '@/test/render';
import AdminIntegrations from './integrations';

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    Head: () => null,
}));

vi.mock('@/components/admin/admin-shell', () => ({
    AdminShell: ({ children }: { children: ReactNode }) => (
        <div>{children}</div>
    ),
}));

function provider(
    overrides: Partial<IntegrationProviderSettings>,
): IntegrationProviderSettings {
    return {
        key: 'slack',
        label: 'Slack',
        configured: true,
        enabled: true,
        connectedTeams: 2,
        fields: {},
        callbackUrl: null,
        webhookUrl: null,
        updateUrl: '/admin/integrations/slack/app',
        ...overrides,
    };
}

function props(): IntegrationSettingsPageProps {
    return {
        providers: [
            provider({}),
            provider({
                key: 'linear',
                label: 'Linear',
                configured: false,
                enabled: false,
                connectedTeams: 0,
                updateUrl: '/admin/integrations/linear/app',
            }),
        ],
        disabled: [],
        confirmedUntil: null,
        confirmUrl: '/admin/integrations/confirm',
    };
}

describe('AdminIntegrations', () => {
    it('lists one row per provider under the Integrations heading', () => {
        renderWithProviders(<AdminIntegrations {...props()} />);

        const section = screen.getByRole('region', { name: 'Integrations' });
        const rows = section.querySelectorAll('[data-slot="integration-row"]');

        expect(rows).toHaveLength(2);
        expect(
            within(rows[0] as HTMLElement).getByText(
                'Available · 2 teams connected',
            ),
        ).not.toBeNull();
        expect(
            within(rows[1] as HTMLElement).getByText('Not configured'),
        ).not.toBeNull();
        expect(
            within(section).getAllByRole('button', { name: 'Configure' }),
        ).toHaveLength(2);
    });
});
