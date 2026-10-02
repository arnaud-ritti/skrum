import { fireEvent, screen, within } from '@testing-library/react';
import { Hash } from 'lucide-react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/test/render';
import type { IntegrationProviderCard, TeamIntegration } from '@/types';
import {
    ProviderCard,
    ProviderDetails,
    providerCardProps,
    providerSummary,
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
            summary: null,
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

describe('providerSummary', () => {
    it('names what a connection points to, per provider', () => {
        expect(
            providerSummary(
                connection({
                    settings: { teamName: 'Nordlys', channelName: '#retros' },
                }),
            ),
        ).toBe('Nordlys · #retros');
        expect(
            providerSummary(
                connection({
                    provider: 'webhook',
                    settings: { host: 'hooks.example.com' },
                }),
            ),
        ).toBe('hooks.example.com');
        expect(
            providerSummary(
                connection({
                    provider: 'github',
                    settings: { accountLogin: 'nordlys' },
                }),
            ),
        ).toBe('nordlys');
        expect(providerSummary(connection())).toBeNull();
    });
});

describe('ProviderCard', () => {
    function row(key = 'slack'): HTMLElement {
        return document.querySelector(
            `[data-test="integration-card-${key}"]`,
        ) as HTMLElement;
    }

    it('is a row named by the provider, with the status line under the name', () => {
        renderWithProviders(
            <ProviderCard
                provider={{ key: 'slack', label: 'Slack', icon: Hash }}
                status={{ label: 'Connected', tone: 'active' }}
                summary="Nordlys · #retros"
            >
                <p>Post links to Slack.</p>
            </ProviderCard>,
        );

        const region = screen.getByRole('region', { name: 'Slack' });

        expect(region).toBe(row());
        expect(region.getAttribute('data-status')).toBe('active');
        expect(
            within(region).getByRole('heading', { level: 3, name: 'Slack' }),
        ).not.toBeNull();

        const status = region.querySelector(
            '[data-slot="provider-row-status"]',
        );

        expect(status?.textContent).toBe('Connected · Nordlys · #retros');
        expect(status?.getAttribute('data-tone')).toBe('active');
        expect(status?.className).toContain('text-skrum-success-text');
        expect(screen.queryByText('Post links to Slack.')).toBeNull();
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('has a switch per integration, on when the provider is connected', () => {
        renderWithProviders(
            <>
                <ProviderCard
                    provider={{ key: 'slack', label: 'Slack', icon: Hash }}
                    status={{ label: 'Connected', tone: 'active' }}
                />
                <ProviderCard
                    provider={{ key: 'jira', label: 'Jira', icon: Hash }}
                    status={{ label: 'Not connected', tone: 'none' }}
                />
            </>,
        );

        expect(
            screen
                .getByRole('switch', { name: 'Slack' })
                .getAttribute('aria-checked'),
        ).toBe('true');
        expect(
            screen
                .getByRole('switch', { name: 'Jira' })
                .getAttribute('aria-checked'),
        ).toBe('false');
        expect(
            within(row('slack')).getByRole('button', { name: 'Configure' }),
        ).not.toBeNull();
        expect(
            within(row('jira')).getByRole('button', { name: 'Connect' }),
        ).not.toBeNull();
    });

    it('opens the details, panels and actions of the provider with "Configure"', () => {
        renderWithProviders(
            <ProviderCard
                provider={{ key: 'jira', label: 'Jira', icon: Hash }}
                status={{ label: 'Connected', tone: 'active' }}
                summary="nordlys.atlassian.net"
                details={<span>Read only</span>}
                actions={<button type="button">Disconnect</button>}
            >
                <p>People mapping</p>
            </ProviderCard>,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Configure' }));

        const panel = screen.getByRole('dialog', { name: 'Jira' });

        expect(panel.getAttribute('data-test')).toBe('integration-panel-jira');
        expect(
            panel.querySelector('[data-slot="sheet-description"]')?.textContent,
        ).toBe('Connected · nordlys.atlassian.net');
        expect(within(panel).getByText('Read only')).not.toBeNull();
        expect(within(panel).getByText('People mapping')).not.toBeNull();
        expect(
            within(
                panel.querySelector(
                    '[data-slot="sheet-footer"]',
                ) as HTMLElement,
            ).getByRole('button', { name: 'Disconnect' }),
        ).not.toBeNull();
    });

    it('opens the provider to connect it when its switch is turned on', () => {
        renderWithProviders(
            <ProviderCard
                provider={{ key: 'slack', label: 'Slack', icon: Hash }}
                status={{ label: 'Not connected', tone: 'none' }}
                actions={<a href="/connect">Connect to Slack</a>}
            />,
        );

        const toggle = screen.getByRole('switch', { name: 'Slack' });

        fireEvent.click(toggle);

        expect(
            within(screen.getByRole('dialog', { name: 'Slack' })).getByRole(
                'link',
                { name: 'Connect to Slack' },
            ),
        ).not.toBeNull();
        expect(toggle.getAttribute('aria-checked')).toBe('false');
    });

    it('asks to confirm the disconnection when the switch is turned off, and stays on until then', () => {
        const disconnect = vi.fn(
            ({ open }: { open: boolean }) =>
                open && <p role="alertdialog">Disconnect Slack?</p>,
        );

        renderWithProviders(
            <ProviderCard
                provider={{ key: 'slack', label: 'Slack', icon: Hash }}
                status={{ label: 'Connected', tone: 'active' }}
                disconnect={disconnect}
            />,
        );

        expect(screen.queryByRole('alertdialog')).toBeNull();

        const toggle = screen.getByRole('switch', { name: 'Slack' });

        fireEvent.click(toggle);

        expect(screen.getByRole('alertdialog').textContent).toBe(
            'Disconnect Slack?',
        );
        expect(toggle.getAttribute('aria-checked')).toBe('true');
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('shows the error of a broken connection as an alert in the panel, and its tone on the row', () => {
        renderWithProviders(
            <ProviderCard
                provider={{ key: 'slack', label: 'Slack', icon: Hash }}
                status={{ label: 'Reconnect required', tone: 'reconnect' }}
                error="token_revoked"
            />,
        );

        expect(screen.queryByRole('alert')).toBeNull();
        expect(
            row().querySelector('[data-slot="provider-row-status"]')?.className,
        ).toContain('text-skrum-destructive-text');

        fireEvent.click(screen.getByRole('button', { name: 'Configure' }));

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

        fireEvent.click(screen.getByRole('button', { name: 'Configure' }));

        expect(screen.getByText('body')).not.toBeNull();
        expect(screen.queryByRole('alert')).toBeNull();
        expect(document.querySelector('[data-slot="sheet-footer"]')).toBeNull();
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
