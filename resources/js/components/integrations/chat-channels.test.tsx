import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RetroRequestError } from '@/lib/retro/api';
import {
    dialogOverPanel,
    providerButtons,
    providerPanel,
    providerStatus,
    renderProvider,
} from '@/test/integrations';
import { renderWithProviders } from '@/test/render';
import type {
    IntegrationProviderCard,
    IntegrationProviderKey,
    TeamIntegration,
} from '@/types';
import { SlackIntegration } from './slack-integration';
import { TelegramIntegration } from './telegram-integration';
import { UrlChannelIntegration } from './url-channel-integration';

const router = vi.hoisted(() => ({ reload: vi.fn() }));
const poll = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn() }));
const request = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    usePoll: () => poll,
    router,
}));

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest: request,
}));

vi.mock('sonner', () => ({ toast }));

const scope = { workspace: 'nordlys', team: 't1' };

function connection(
    provider: IntegrationProviderKey,
    overrides: Partial<TeamIntegration> = {},
): TeamIntegration {
    return {
        id: 'i1',
        provider,
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

function card(
    provider: IntegrationProviderKey,
    label: string,
    value: TeamIntegration | null = null,
): IntegrationProviderCard {
    return {
        provider,
        label,
        usesOAuth: provider === 'slack',
        authMethods: ['oauth'],
        isTracker: false,
        connection: value,
    };
}

const region = providerPanel;
const statusOf = providerStatus;

function buttons(name: string): (string | null)[] {
    return providerButtons(region(name)).map((button) => button.textContent);
}

beforeEach(() => {
    router.reload.mockReset();
    poll.start.mockReset();
    poll.stop.mockReset();
    request.mockReset();
    toast.success.mockReset();
    toast.error.mockReset();
});

describe('SlackIntegration', () => {
    it('offers to connect through a plain link while Slack is not connected', () => {
        renderProvider(
            <SlackIntegration card={card('slack', 'Slack')} scope={scope} />,
        );

        const link = within(region('Slack')).getByRole('link', {
            name: 'Connect',
        });

        expect(statusOf('Slack')).toBe('Not connected');
        expect(link.getAttribute('href')).toContain(
            '/integrations/slack/connect',
        );
        expect(within(region('Slack')).getAllByRole('link')).toHaveLength(1);
        expect(link.children).toHaveLength(0);
    });

    it('shows the workspace and the channel, then reconnect, test and disconnect', () => {
        renderProvider(
            <SlackIntegration
                card={card(
                    'slack',
                    'Slack',
                    connection('slack', {
                        settings: {
                            teamName: 'Acme',
                            channelName: '#retros',
                            configurationUrl: 'https://acme.slack.com/config',
                        },
                    }),
                )}
                scope={scope}
            />,
        );

        const slack = region('Slack');

        expect(statusOf('Slack')).toBe('Connected');
        expect(slack.textContent).toContain('Acme');
        expect(
            within(slack)
                .getByRole('link', { name: '#retros' })
                .getAttribute('href'),
        ).toBe('https://acme.slack.com/config');
        expect(
            within(slack).getByRole('link', { name: 'Reconnect' }),
        ).not.toBeNull();
        expect(buttons('Slack')).toEqual(['Send a test message', 'Disconnect']);
    });

    it('has no test message while the connection must be made again, and shows why', () => {
        renderProvider(
            <SlackIntegration
                card={card(
                    'slack',
                    'Slack',
                    connection('slack', {
                        status: 'reconnect_required',
                        statusLabel: 'Reconnect required',
                        lastError: 'token_revoked',
                    }),
                )}
                scope={scope}
            />,
        );

        expect(statusOf('Slack')).toBe('Reconnect required');
        expect(within(region('Slack')).getByRole('alert').textContent).toBe(
            'token_revoked',
        );
        expect(buttons('Slack')).toEqual(['Disconnect']);
    });

    it('sends a test message, then reloads the providers', async () => {
        request.mockResolvedValue(undefined);

        renderProvider(
            <SlackIntegration
                card={card('slack', 'Slack', connection('slack'))}
                scope={scope}
            />,
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Send a test message' }),
        );

        await waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith('Test message sent.'),
        );
        expect(router.reload).toHaveBeenCalledWith({ only: ['providers'] });
    });

    it('reloads the providers after a failed test too, and says what failed', async () => {
        request.mockRejectedValue(
            new RetroRequestError(502, 'Slack did not answer.'),
        );

        renderProvider(
            <SlackIntegration
                card={card('slack', 'Slack', connection('slack'))}
                scope={scope}
            />,
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Send a test message' }),
        );

        await waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith('Slack did not answer.'),
        );
        expect(router.reload).toHaveBeenCalledWith({ only: ['providers'] });
    });

    it('words the disconnection without a channel Slack did not name', async () => {
        renderProvider(
            <SlackIntegration
                card={card(
                    'slack',
                    'Slack',
                    connection('slack', { settings: {} }),
                )}
                scope={scope}
            />,
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Disconnect' }),
        );

        expect(
            screen.getByRole('dialog', { name: 'Disconnect Slack?' })
                .textContent,
        ).toContain('Posting stops and the Slack access is revoked.');
    });

    it('words the disconnection without a chat Telegram did not name', async () => {
        renderProvider(
            <TelegramIntegration
                card={card(
                    'telegram',
                    'Telegram',
                    connection('telegram', {
                        settings: { chatId: '-100123' },
                    }),
                )}
                scope={scope}
                telegram={{ botUsername: 'skrum_bot', conflict: false }}
            />,
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Disconnect' }),
        );

        expect(
            screen.getByRole('dialog', { name: 'Disconnect Telegram?' })
                .textContent,
        ).toContain(
            'The bot leaves the chat and nothing is posted there anymore.',
        );
    });

    it('confirms the disconnection in a dialog that names the provider', async () => {
        request.mockResolvedValue(undefined);

        renderProvider(
            <SlackIntegration
                card={card(
                    'slack',
                    'Slack',
                    connection('slack', {
                        settings: { channelName: '#retros' },
                    }),
                )}
                scope={scope}
            />,
        );

        const trigger = screen.getByRole('button', { name: 'Disconnect' });

        expect(trigger.querySelector('svg')).not.toBeNull();

        await userEvent.click(trigger);

        const dialog = screen.getByRole('dialog', {
            name: 'Disconnect Slack?',
        });

        expect(dialog.textContent).toContain(
            'Posting to #retros stops and the Slack access is revoked.',
        );
        expect(document.activeElement?.textContent).toBe('Cancel');
        expect(request).not.toHaveBeenCalled();

        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Disconnect' }),
        );

        await waitFor(() => expect(dialogOverPanel()).toBeNull());
        expect(toast.success).toHaveBeenCalledWith('Slack disconnected.');
        expect(router.reload).toHaveBeenCalledWith({ only: ['providers'] });
    });

    it('asks to disconnect when the switch of the row is turned off, without opening the sheet', async () => {
        request.mockResolvedValue(undefined);

        renderWithProviders(
            <SlackIntegration
                card={card('slack', 'Slack', connection('slack'))}
                scope={scope}
            />,
        );

        const toggle = screen.getByRole('switch', { name: 'Slack' });

        expect(screen.queryByRole('button', { name: 'Disconnect' })).toBeNull();

        await userEvent.click(toggle);

        const dialog = screen.getByRole('dialog', {
            name: 'Disconnect Slack?',
        });

        expect(
            document.querySelector('[data-slot="sheet-content"]'),
        ).toBeNull();
        expect(request).not.toHaveBeenCalled();

        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Cancel' }),
        );

        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
        expect(document.activeElement).toBe(toggle);
        expect(toggle.getAttribute('aria-checked')).toBe('true');

        await userEvent.click(toggle);
        await userEvent.click(
            within(screen.getByRole('dialog')).getByRole('button', {
                name: 'Disconnect',
            }),
        );

        await waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith('Slack disconnected.'),
        );
        expect(router.reload).toHaveBeenCalledWith({ only: ['providers'] });
    });

    it('keeps the dialog open when the disconnection is refused', async () => {
        request.mockRejectedValue(new RetroRequestError(500, 'Server error.'));

        renderProvider(
            <SlackIntegration
                card={card('slack', 'Slack', connection('slack'))}
                scope={scope}
            />,
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Disconnect' }),
        );
        await userEvent.click(
            within(screen.getByRole('dialog')).getByRole('button', {
                name: 'Disconnect',
            }),
        );

        await waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith('Server error.'),
        );
        expect(screen.getByRole('dialog')).not.toBeNull();
        expect(router.reload).not.toHaveBeenCalled();
    });
});

describe('TelegramIntegration', () => {
    const bot = { botUsername: 'skrum_test_bot', conflict: false };

    it('shows the command, a copy button and the bot link once a code is created, and starts polling', async () => {
        request.mockResolvedValue({
            code: 'ABCD2345',
            command: '/connect@skrum_test_bot ABCD2345',
            botUsername: 'skrum_test_bot',
            expiresAt: new Date(Date.now() + 600_000).toISOString(),
        });

        renderProvider(
            <TelegramIntegration
                card={card('telegram', 'Telegram')}
                scope={scope}
                telegram={bot}
            />,
        );

        expect(statusOf('Telegram')).toBe('Not connected');
        expect(region('Telegram').querySelector('code')).toBeNull();

        await userEvent.click(screen.getByRole('button', { name: 'Connect' }));

        const telegram = region('Telegram');

        await waitFor(() =>
            expect(telegram.querySelector('code')?.textContent).toBe(
                '/connect@skrum_test_bot ABCD2345',
            ),
        );
        expect(telegram.querySelectorAll('code')).toHaveLength(1);
        expect(
            within(telegram)
                .getByRole('link', { name: 'Open @skrum_test_bot in Telegram' })
                .getAttribute('href'),
        ).toBe('https://t.me/skrum_test_bot');
        expect(telegram.textContent).toContain('Waiting for the command…');
        expect(
            within(telegram).getByRole('button', { name: 'Copy' }),
        ).not.toBeNull();
        expect(poll.start).toHaveBeenCalledTimes(1);
    });

    it('says the code has expired and stops polling', async () => {
        request.mockResolvedValue({
            code: 'ABCD2345',
            command: '/connect@skrum_test_bot ABCD2345',
            botUsername: 'skrum_test_bot',
            expiresAt: new Date(Date.now() - 1_000).toISOString(),
        });

        renderProvider(
            <TelegramIntegration
                card={card('telegram', 'Telegram')}
                scope={scope}
                telegram={bot}
            />,
        );

        await userEvent.click(screen.getByRole('button', { name: 'Connect' }));

        await waitFor(() =>
            expect(region('Telegram').textContent).toContain(
                'This code has expired. Create a new one.',
            ),
        );
        expect(poll.stop).toHaveBeenCalled();
    });

    it('cannot connect while Telegram does not answer, and says so', () => {
        renderProvider(
            <TelegramIntegration
                card={card('telegram', 'Telegram')}
                scope={scope}
                telegram={{ botUsername: null, conflict: false }}
            />,
        );

        expect(
            screen
                .getByRole('button', { name: 'Connect' })
                .hasAttribute('disabled'),
        ).toBe(true);
        expect(region('Telegram').textContent).toContain(
            'Telegram did not answer. Check the bot token of this instance.',
        );
    });

    it('warns when the bot is used elsewhere', () => {
        renderProvider(
            <TelegramIntegration
                card={card('telegram', 'Telegram')}
                scope={scope}
                telegram={{ botUsername: 'skrum_test_bot', conflict: true }}
            />,
        );

        expect(region('Telegram').textContent).toContain(
            'The Telegram bot is used elsewhere. Remove its webhook or use a dedicated bot.',
        );
    });

    it('reports the trouble of the bot on the row, before the sheet is opened', () => {
        const { unmount } = renderWithProviders(
            <TelegramIntegration
                card={card('telegram', 'Telegram')}
                scope={scope}
                telegram={{ botUsername: 'skrum_test_bot', conflict: true }}
            />,
        );

        const notice = () =>
            document.querySelector('[data-slot="provider-row-notice"]')
                ?.textContent;

        expect(notice()).toBe(
            'The Telegram bot is used elsewhere. Remove its webhook or use a dedicated bot.',
        );

        unmount();

        renderWithProviders(
            <TelegramIntegration
                card={card('telegram', 'Telegram')}
                scope={scope}
                telegram={{ botUsername: null, conflict: false }}
            />,
        );

        expect(notice()).toBe(
            'Telegram did not answer. Check the bot token of this instance.',
        );
    });

    it('shows the chat and offers another chat, a test and the disconnection once connected', () => {
        renderProvider(
            <TelegramIntegration
                card={card(
                    'telegram',
                    'Telegram',
                    connection('telegram', {
                        settings: { chatId: '-100123', chatTitle: 'Team chat' },
                    }),
                )}
                scope={scope}
                telegram={bot}
            />,
        );

        expect(statusOf('Telegram')).toBe('Connected');
        expect(region('Telegram').textContent).toContain('Team chat');
        expect(buttons('Telegram')).toEqual([
            'Connect another chat',
            'Send a test message',
            'Disconnect',
        ]);
    });
});

describe('UrlChannelIntegration', () => {
    it('connects Microsoft Teams from a dialog with the URL and an optional label', async () => {
        request.mockResolvedValue(undefined);

        renderProvider(
            <UrlChannelIntegration
                card={card('msteams', 'Microsoft Teams')}
                scope={scope}
                mattermost={null}
            />,
        );

        expect(statusOf('Microsoft Teams')).toBe('Not connected');

        await userEvent.click(screen.getByRole('button', { name: 'Connect' }));

        const dialog = screen.getByRole('dialog', {
            name: 'Connect Microsoft Teams',
        });
        const url = within(dialog).getByLabelText('Webhook URL');
        const label = within(dialog).getByLabelText('Channel label (optional)');

        expect(url.getAttribute('type')).toBe('url');
        expect(url.hasAttribute('required')).toBe(true);
        expect(label.getAttribute('maxlength')).toBe('80');
        expect(dialog.querySelectorAll('button[type="submit"]')).toHaveLength(
            1,
        );

        await userEvent.type(url, 'https://example.com/workflows/abc');
        await userEvent.type(label, ' Retro channel ');
        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Connect' }),
        );

        await waitFor(() => expect(dialogOverPanel()).toBeNull());
        expect(request.mock.calls[0][1]).toEqual({
            url: 'https://example.com/workflows/abc',
            channel_label: 'Retro channel',
        });
        expect(toast.success).toHaveBeenCalledWith(
            'Microsoft Teams connected.',
        );
        expect(router.reload).toHaveBeenCalledWith({ only: ['providers'] });
    });

    it('shows a refused URL under its field, which takes the focus, and stays open', async () => {
        request.mockRejectedValue(
            new RetroRequestError(422, 'Invalid.', {
                url: ['Use the workflow URL from Microsoft Teams.'],
            }),
        );

        renderProvider(
            <UrlChannelIntegration
                card={card('msteams', 'Microsoft Teams')}
                scope={scope}
                mattermost={null}
            />,
        );

        await userEvent.click(screen.getByRole('button', { name: 'Connect' }));

        const dialog = screen.getByRole('dialog');
        const url = within(dialog).getByLabelText('Webhook URL');

        await userEvent.type(url, 'https://example.com/workflows/abc');
        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Connect' }),
        );

        await waitFor(() =>
            expect(
                dialog.querySelector('[data-slot="field-error"]')?.textContent,
            ).toBe('Use the workflow URL from Microsoft Teams.'),
        );
        expect(url.getAttribute('aria-invalid')).toBe('true');
        expect(document.activeElement).toBe(url);
        expect(toast.error).not.toHaveBeenCalled();
        expect(router.reload).not.toHaveBeenCalled();
    });

    it('forgets the refusal when the dialog is opened again', async () => {
        request.mockRejectedValue(
            new RetroRequestError(422, 'Invalid.', { url: ['Refused.'] }),
        );

        renderProvider(
            <UrlChannelIntegration
                card={card('mattermost', 'Mattermost')}
                scope={scope}
                mattermost={{ url: 'https://chat.example.com' }}
            />,
        );

        expect(region('Mattermost').textContent).toContain(
            'through an incoming webhook of https://chat.example.com.',
        );

        await userEvent.click(screen.getByRole('button', { name: 'Connect' }));
        await userEvent.type(
            screen.getByLabelText('Webhook URL'),
            'https://other.example.com/hooks/abc',
        );
        await userEvent.click(
            within(screen.getByRole('dialog')).getByRole('button', {
                name: 'Connect',
            }),
        );
        await waitFor(() =>
            expect(
                document.querySelector('[data-slot="field-error"]'),
            ).not.toBeNull(),
        );

        await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        await waitFor(() => expect(dialogOverPanel()).toBeNull());
        await userEvent.click(screen.getByRole('button', { name: 'Connect' }));

        expect(document.querySelector('[data-slot="field-error"]')).toBeNull();
        expect(
            (screen.getByLabelText('Webhook URL') as HTMLInputElement).value,
        ).toBe('');
    });

    it('replaces the URL of a connection without ever showing the old one, and keeps its label', async () => {
        request.mockResolvedValue(undefined);

        renderProvider(
            <UrlChannelIntegration
                card={card(
                    'msteams',
                    'Microsoft Teams',
                    connection('msteams', {
                        settings: {
                            host: 'prod-12.westeurope.logic.azure.com',
                            channelLabel: '#retros',
                        },
                    }),
                )}
                scope={scope}
                mattermost={null}
            />,
        );

        expect(region('Microsoft Teams').textContent).toContain(
            'prod-12.westeurope.logic.azure.com',
        );
        expect(buttons('Microsoft Teams')).toEqual([
            'Replace URL',
            'Send a test message',
            'Disconnect',
        ]);

        await userEvent.click(
            screen.getByRole('button', { name: 'Replace URL' }),
        );

        const dialog = screen.getByRole('dialog', { name: 'Replace the URL' });
        const url = within(dialog).getByLabelText(
            'Webhook URL',
        ) as HTMLInputElement;

        expect(url.value).toBe('');
        expect(url.hasAttribute('required')).toBe(false);
        expect(
            (
                within(dialog).getByLabelText(
                    'Channel label (optional)',
                ) as HTMLInputElement
            ).value,
        ).toBe('#retros');

        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Save' }),
        );

        await waitFor(() => expect(dialogOverPanel()).toBeNull());
        expect(request.mock.calls[0][1]).toEqual({ channel_label: '#retros' });
        expect(toast.success).toHaveBeenCalledWith('Connection saved.');
    });

    it('closes only the form above the sheet on Escape, the sheet staying open', async () => {
        renderProvider(
            <UrlChannelIntegration
                card={card(
                    'mattermost',
                    'Mattermost',
                    connection('mattermost', {
                        settings: { host: 'chat.example.com' },
                    }),
                )}
                scope={scope}
                mattermost={null}
            />,
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Replace URL' }),
        );

        expect(
            screen.getByRole('dialog', { name: 'Replace the URL' }),
        ).not.toBeNull();

        await userEvent.keyboard('{Escape}');

        await waitFor(() => expect(dialogOverPanel()).toBeNull());
        expect(
            screen.getByRole('dialog', { name: 'Mattermost' }),
        ).not.toBeNull();
    });

    it('shows a dash for a connection without label', () => {
        renderProvider(
            <UrlChannelIntegration
                card={card(
                    'mattermost',
                    'Mattermost',
                    connection('mattermost', {
                        settings: { host: 'chat.example.com' },
                    }),
                )}
                scope={scope}
                mattermost={null}
            />,
        );

        expect(
            Array.from(region('Mattermost').querySelectorAll('dd')).map(
                (value) => value.textContent,
            ),
        ).toEqual(['chat.example.com', '—', 'Ada Admin', 'Never']);
    });
});
