import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
        expect(providerCardProps(card(null), t)).toEqual({
            provider: { key: 'slack', label: 'Slack' },
            status: { label: 'Not connected', tone: 'none' },
            summary: null,
            error: null,
        });
    });

    it('takes the label of the server and a tone per status', () => {
        expect(providerCardProps(card(connection()), t).status).toEqual({
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
                t,
            ).status,
        ).toEqual({ label: 'Setup required', tone: 'setup' });
    });

    it('carries the last error only when the connection must be made again', () => {
        expect(
            providerCardProps(card(connection({ lastError: 'old trouble' })), t)
                .error,
        ).toBeNull();

        const props = providerCardProps(
            card(
                connection({
                    status: 'reconnect_required',
                    statusLabel: 'Reconnect required',
                    lastError: 'token_revoked',
                }),
            ),
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
                provider={{ key: 'slack', label: 'Slack' }}
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
                    provider={{ key: 'slack', label: 'Slack' }}
                    status={{ label: 'Connected', tone: 'active' }}
                />
                <ProviderCard
                    provider={{ key: 'jira', label: 'Jira' }}
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
            within(row('slack')).getByRole('button', {
                name: 'Configure Slack',
            }),
        ).not.toBeNull();
        expect(
            within(row('jira')).getByRole('button', { name: 'Connect Jira' }),
        ).not.toBeNull();
    });

    it('opens the details, panels and actions of the provider with "Configure"', () => {
        renderWithProviders(
            <ProviderCard
                provider={{ key: 'jira', label: 'Jira' }}
                status={{ label: 'Connected', tone: 'active' }}
                summary="nordlys.atlassian.net"
                details={<span>Read only</span>}
                actions={<button type="button">Disconnect</button>}
            >
                <p>People mapping</p>
            </ProviderCard>,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Configure Jira' }));

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
                provider={{ key: 'slack', label: 'Slack' }}
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
                provider={{ key: 'slack', label: 'Slack' }}
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

    it('calls for the pending step on the row of a connection that delivers nothing, its switch off', () => {
        renderWithProviders(
            <>
                <ProviderCard
                    provider={{ key: 'jira', label: 'Jira' }}
                    status={{ label: 'Setup required', tone: 'setup' }}
                    disconnect={() => null}
                >
                    <p>Choose the Jira site</p>
                </ProviderCard>
                <ProviderCard
                    provider={{ key: 'slack', label: 'Slack' }}
                    status={{ label: 'Reconnect required', tone: 'reconnect' }}
                    disconnect={() => null}
                />
            </>,
        );

        const finish = within(row('jira')).getByRole('button', {
            name: 'Finish setup Jira',
        });
        const reconnect = within(row('slack')).getByRole('button', {
            name: 'Reconnect Slack',
        });

        expect(finish.textContent).toBe('Finish setup');
        expect(finish.className).toContain('bg-primary');
        expect(reconnect.textContent).toBe('Reconnect');
        expect(reconnect.className).toContain('bg-primary');

        const toggle = screen.getByRole('switch', { name: 'Jira' });

        expect(toggle.getAttribute('aria-checked')).toBe('false');
        expect(
            screen
                .getByRole('switch', { name: 'Slack' })
                .getAttribute('aria-checked'),
        ).toBe('false');

        fireEvent.click(toggle);

        expect(
            within(screen.getByRole('dialog', { name: 'Jira' })).getByText(
                'Choose the Jira site',
            ),
        ).not.toBeNull();
    });

    it('shows a notice of the provider on its row, connected or not', () => {
        renderWithProviders(
            <ProviderCard
                provider={{ key: 'telegram', label: 'Telegram' }}
                status={{ label: 'Not connected', tone: 'none' }}
                notice="The bot is used elsewhere."
            />,
        );

        const notice = row('telegram').querySelector(
            '[data-slot="provider-row-notice"]',
        );

        expect(notice?.textContent).toBe('The bot is used elsewhere.');
        expect(notice?.className).toContain('text-skrum-warning-text');
    });

    it('says on the switch of a working connection that turning it off disconnects', () => {
        renderWithProviders(
            <>
                <ProviderCard
                    provider={{ key: 'slack', label: 'Slack' }}
                    status={{ label: 'Connected', tone: 'active' }}
                    disconnect={() => null}
                />
                <ProviderCard
                    provider={{ key: 'jira', label: 'Jira' }}
                    status={{ label: 'Not connected', tone: 'none' }}
                />
            </>,
        );

        const hint = screen
            .getByRole('switch', { name: 'Slack' })
            .getAttribute('aria-describedby');

        expect(document.getElementById(hint ?? '')?.textContent).toBe(
            'Turning this off disconnects the integration.',
        );
        expect(
            screen
                .getByRole('switch', { name: 'Jira' })
                .getAttribute('aria-describedby'),
        ).toBeNull();
    });

    it('opens the sheet from the keyboard and gives focus back to its button on Escape', async () => {
        renderWithProviders(
            <ProviderCard
                provider={{ key: 'slack', label: 'Slack' }}
                status={{ label: 'Connected', tone: 'active' }}
            >
                <p>body</p>
            </ProviderCard>,
        );

        const configure = screen.getByRole('button', {
            name: 'Configure Slack',
        });

        configure.focus();
        await userEvent.keyboard('{Enter}');

        expect(screen.getByRole('dialog', { name: 'Slack' })).not.toBeNull();

        await userEvent.keyboard('{Escape}');

        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        expect(document.activeElement).toBe(configure);
    });

    it('shows the error of a broken connection as an alert in the panel, and its tone on the row', () => {
        renderWithProviders(
            <ProviderCard
                provider={{ key: 'slack', label: 'Slack' }}
                status={{ label: 'Reconnect required', tone: 'reconnect' }}
                error="token_revoked"
            />,
        );

        expect(screen.queryByRole('alert')).toBeNull();
        expect(
            row().querySelector('[data-slot="provider-row-status"]')?.className,
        ).toContain('text-skrum-destructive-text');

        fireEvent.click(
            screen.getByRole('button', { name: 'Reconnect Slack' }),
        );

        expect(screen.getByRole('alert').textContent).toBe('token_revoked');
    });

    it('has no alert without error and no footer without action', () => {
        renderWithProviders(
            <ProviderCard
                provider={{ key: 'slack', label: 'Slack' }}
                status={{ label: 'Connected', tone: 'active' }}
                error={null}
            >
                <p>body</p>
            </ProviderCard>,
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Configure Slack' }),
        );

        expect(screen.getByText('body')).not.toBeNull();
        expect(screen.queryByRole('alert')).toBeNull();
        expect(document.querySelector('[data-slot="sheet-footer"]')).toBeNull();
    });

    it('hides the provider icon from assistive technology', () => {
        renderWithProviders(
            <ProviderCard
                provider={{ key: 'slack', label: 'Slack' }}
                status={{ label: 'Connected', tone: 'active' }}
            />,
        );

        expect(
            document
                .querySelector('[data-slot="provider-card-logo"]')
                ?.getAttribute('aria-hidden'),
        ).toBe('true');
    });

    it('shows the brand mark of the provider on its row', () => {
        renderWithProviders(
            <ProviderCard
                provider={{ key: 'slack', label: 'Slack' }}
                status={{ label: 'Connected', tone: 'active' }}
            />,
        );

        expect(
            document.querySelector(
                '[data-slot="provider-card-logo"] [data-provider-mark="slack"]',
            ),
        ).not.toBeNull();
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
