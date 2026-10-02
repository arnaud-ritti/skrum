import { screen, within } from '@testing-library/react';
import { Hash } from 'lucide-react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { IntegrationProviderCard, TeamIntegration } from '@/types';
import {
    ProviderCard,
    ProviderDetails,
    providerCardProps,
} from './provider-card';

const page = vi.hoisted(() => ({ props: {} as Record<string, unknown> }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => page,
}));

beforeEach(() => {
    page.props = { translations: {}, locale: 'en' };
});

function connection(overrides: Partial<TeamIntegration> = {}): TeamIntegration {
    return {
        id: 'i1',
        provider: 'slack',
        status: 'active',
        statusLabel: 'Connected',
        access: 'write',
        settings: {},
        connectedBy: 'Ada Admin',
        connectedAt: '2026-09-14T09:00:00Z',
        lastCheckedAt: null,
        lastError: null,
        webhook: null,
        statusSync: false,
        inboundMode: 'none',
        webhookStatus: null,
        lastInboundAt: null,
        lastPolledAt: null,
        inboundHint: null,
        ...overrides,
    } as TeamIntegration;
}

function card(value: TeamIntegration | null): IntegrationProviderCard {
    return {
        provider: 'slack',
        label: 'Slack',
        usesOAuth: true,
        authMethods: ['oauth'],
        isTracker: false,
        connection: value,
    };
}

const t = (key: string): string => key;

describe('providerCardProps', () => {
    it('reads "Not connected" for a provider without connection', () => {
        expect(providerCardProps(card(null), Hash, t)).toEqual({
            provider: { key: 'slack', label: 'Slack', icon: Hash },
            status: { label: 'Not connected', tone: 'none' },
            error: null,
        });
    });

    it('takes the label of the server and a tone per status', () => {
        expect(providerCardProps(card(connection()), Hash, t).status).toEqual({
            label: 'Connected',
            tone: 'active',
        });
        expect(
            providerCardProps(
                card(
                    connection({
                        status: 'setup_required',
                        statusLabel: 'Setup required',
                    }),
                ),
                Hash,
                t,
            ).status,
        ).toEqual({ label: 'Setup required', tone: 'setup' });
    });

    it('carries the last error only when the connection must be made again', () => {
        expect(
            providerCardProps(
                card(connection({ lastError: 'old trouble' })),
                Hash,
                t,
            ).error,
        ).toBeNull();

        const props = providerCardProps(
            card(
                connection({
                    status: 'reconnect_required',
                    statusLabel: 'Reconnect required',
                    lastError: 'token_revoked',
                }),
            ),
            Hash,
            t,
        );

        expect(props.status).toEqual({
            label: 'Reconnect required',
            tone: 'reconnect',
        });
        expect(props.error).toBe('token_revoked');
    });
});

describe('ProviderCard', () => {
    it('is a region named by the provider, with the test hook of its key', () => {
        renderWithProviders(
            <ProviderCard
                provider={{ key: 'slack', label: 'Slack', icon: Hash }}
                status={{ label: 'Not connected', tone: 'none' }}
            >
                <p>Post links to Slack.</p>
            </ProviderCard>,
        );

        const region = screen.getByRole('region', { name: 'Slack' });

        expect(region.getAttribute('data-test')).toBe('integration-card-slack');
        expect(
            region.querySelector('[data-slot="card-title"]')?.textContent,
        ).toBe('Slack');
        expect(
            within(region).getByRole('heading', { level: 3, name: 'Slack' }),
        ).not.toBeNull();
        expect(within(region).getByText('Post links to Slack.')).not.toBeNull();
    });

    it('puts the status first among the badges, whatever the body holds', () => {
        renderWithProviders(
            <ProviderCard
                provider={{ key: 'jira', label: 'Jira', icon: Hash }}
                status={{ label: 'Connected', tone: 'active' }}
                details={<span data-slot="badge">Read only</span>}
                actions={<button type="button">Disconnect</button>}
            >
                <span data-slot="badge">Other</span>
            </ProviderCard>,
        );

        const first = document.querySelector(
            '[data-test="integration-card-jira"] [data-slot="badge"]',
        );

        expect(first?.textContent).toBe('Connected');
        expect(first?.getAttribute('data-tone')).toBe('active');
    });

    it('shows the error of a broken connection as an alert in the card', () => {
        renderWithProviders(
            <ProviderCard
                provider={{ key: 'slack', label: 'Slack', icon: Hash }}
                status={{ label: 'Reconnect required', tone: 'reconnect' }}
                error="token_revoked"
            />,
        );

        expect(screen.getByRole('alert').textContent).toBe('token_revoked');
    });

    it('has no alert without error and no footer without action', () => {
        renderWithProviders(
            <ProviderCard
                provider={{ key: 'slack', label: 'Slack', icon: Hash }}
                status={{ label: 'Connected', tone: 'active' }}
                error={null}
            >
                <p>body</p>
            </ProviderCard>,
        );

        expect(screen.queryByRole('alert')).toBeNull();
        expect(
            document.querySelector('[data-slot="provider-card-footer"]'),
        ).toBeNull();
    });

    it('has no body when it has neither error, details nor children', () => {
        renderWithProviders(
            <ProviderCard
                provider={{ key: 'slack', label: 'Slack', icon: Hash }}
                status={{ label: 'Not connected', tone: 'none' }}
                actions={<button type="button">Connect</button>}
            />,
        );

        expect(
            document.querySelector('[data-slot="provider-card-body"]'),
        ).toBeNull();
        expect(
            within(
                document.querySelector(
                    '[data-slot="provider-card-footer"]',
                ) as HTMLElement,
            ).getByRole('button', { name: 'Connect' }),
        ).not.toBeNull();
    });

    it('hides the provider icon from assistive technology', () => {
        renderWithProviders(
            <ProviderCard
                provider={{ key: 'slack', label: 'Slack', icon: Hash }}
                status={{ label: 'Connected', tone: 'active' }}
            />,
        );

        expect(
            document
                .querySelector('[data-slot="provider-card-logo"]')
                ?.getAttribute('aria-hidden'),
        ).toBe('true');
    });
});

describe('ProviderDetails', () => {
    it('lists the rows, then who connected and the last check', () => {
        renderWithProviders(
            <ProviderDetails
                connection={connection()}
                rows={[{ label: 'Channel', value: '#retros' }]}
            />,
        );

        expect(
            Array.from(document.querySelectorAll('dt')).map(
                (term) => term.textContent,
            ),
        ).toEqual(['Channel', 'Connected by', 'Last checked']);
        expect(
            Array.from(document.querySelectorAll('dd')).map(
                (value) => value.textContent,
            ),
        ).toEqual(['#retros', 'Ada Admin', 'Never']);
    });

    it('says "Former member" when the person who connected has left, and dates the last check', () => {
        renderWithProviders(
            <ProviderDetails
                connection={connection({
                    connectedBy: null,
                    lastCheckedAt: '2026-09-28T16:20:00Z',
                })}
                rows={[]}
            />,
        );

        const values = Array.from(document.querySelectorAll('dd')).map(
            (value) => value.textContent,
        );

        expect(values[0]).toBe('Former member');
        expect(values[1]).toContain('2026');
        expect(values[1]).not.toBe('Never');
    });
});
