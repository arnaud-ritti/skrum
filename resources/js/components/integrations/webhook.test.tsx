import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RetroRequestError } from '@/lib/retro/api';
import {
    providerButtons,
    providerPanel,
    providerStatus,
    renderProvider,
} from '@/test/integrations';
import { renderWithProviders } from '@/test/render';
import type {
    IntegrationProviderCard,
    TeamIntegration,
    WebhookDelivery,
    WebhookDeliveryDetails,
    WebhookDeliveryPage,
    WebhookEventOption,
} from '@/types';
import { WebhookDeliveriesPanel } from './webhook-deliveries-panel';
import { WebhookDeliveryDialog } from './webhook-delivery-dialog';
import { WebhookEventsPanel } from './webhook-events-panel';
import { WebhookIntegration } from './webhook-integration';
import { WebhookSecretDialog } from './webhook-secret';

const router = vi.hoisted(() => ({ reload: vi.fn() }));
const request = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() =>
    Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
);

vi.mock('@inertiajs/react', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@inertiajs/react')>()),
    usePage: () => ({ props: { translations: {}, locale: 'en' } }),
    router,
}));

vi.mock('@/lib/retro/api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/retro/api')>()),
    retroRequest: request,
}));

vi.mock('sonner', () => ({ toast }));

const scope = { workspace: 'nordlys', team: 't1' };

const events: WebhookEventOption[] = [
    {
        name: 'action_item.created',
        description: 'An action item is created.',
    },
    {
        name: 'action_item.completed',
        description: 'An action item is marked as done.',
    },
    { name: 'retro.completed', description: 'A retrospective is completed.' },
] as WebhookEventOption[];

function connection(overrides: Partial<TeamIntegration> = {}): TeamIntegration {
    return {
        id: 'i1',
        provider: 'webhook',
        status: 'active',
        statusLabel: 'Connected',
        access: 'write',
        settings: {
            host: 'hooks.example.com',
            channelLabel: 'Ops receiver',
            secretCreatedAt: '2026-10-01T09:00:00Z',
            events: ['action_item.completed'],
        },
        connectedBy: 'Ada Admin',
        connectedAt: '2026-09-14T09:00:00Z',
        lastCheckedAt: null,
        lastError: null,
        webhook: { lastDeliverySucceededAt: null },
        statusSync: false,
        inboundMode: 'none',
        webhookStatus: null,
        lastInboundAt: null,
        lastPolledAt: null,
        inboundHint: null,
        ...overrides,
    } as TeamIntegration;
}

function card(value: TeamIntegration | null = null): IntegrationProviderCard {
    return {
        provider: 'webhook',
        label: 'Webhook',
        usesOAuth: false,
        authMethods: [],
        isTracker: false,
        connection: value,
    } as IntegrationProviderCard;
}

function delivery(overrides: Partial<WebhookDelivery> = {}): WebhookDelivery {
    return {
        id: 'd1',
        event: 'action_item.completed',
        kind: 'event',
        status: 'sent',
        attempts: 1,
        responseStatus: 200,
        error: null,
        createdAt: '2026-10-01T10:00:00Z',
        lastAttemptAt: '2026-10-01T10:00:02Z',
        hasContent: true,
        contentExpired: false,
        redeliverable: false,
        redeliveryOf: null,
        ...overrides,
    };
}

function pageOf(
    data: WebhookDelivery[],
    currentPage = 1,
    lastPage = 1,
): WebhookDeliveryPage {
    return { data, currentPage, lastPage, total: data.length };
}

const details: WebhookDeliveryDetails = {
    id: 'd1',
    event: 'action_item.completed',
    status: 'sent',
    attempts: 1,
    redeliveryOf: null,
    request: {
        headers: {
            'X-Skrum-Event': 'action_item.completed',
            'X-Skrum-Signature': 'sha256=••••',
        },
        body: '{"event":"action_item.completed"}',
    },
    response: { status: 200, excerpt: '{"received":true}' },
} as WebhookDeliveryDetails;

function region(name: string): HTMLElement {
    return screen.getByRole('region', { name });
}

function deliveriesTable(): HTMLElement {
    return screen.getByRole('table', { name: 'Deliveries' });
}

function tableRows(): string[] {
    return Array.from(deliveriesTable().querySelectorAll('tbody tr')).map(
        (row) =>
            [1, 2, 3, 4, 5]
                .map((index) => row.children[index].textContent)
                .join(' | '),
    );
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
    let resolve: (value: T) => void = () => {};
    const promise = new Promise<T>((done) => {
        resolve = done;
    });

    return { promise, resolve };
}

beforeEach(() => {
    router.reload.mockReset();
    request.mockReset();
    toast.mockReset();
    toast.success.mockReset();
    toast.error.mockReset();
});

describe('WebhookIntegration', () => {
    it('says what a webhook sends and offers to connect while there is none', () => {
        renderProvider(
            <WebhookIntegration card={card()} scope={scope} events={events} />,
        );

        const webhook = providerPanel('Webhook');

        expect(providerStatus('Webhook')).toBe('Not connected');
        expect(webhook.textContent).toContain(
            'Send board links, game invites, results and the events you choose to your own HTTPS endpoint, signed with a secret.',
        );
        expect(
            providerButtons(webhook).map((button) => button.textContent),
        ).toEqual(['Connect']);
    });

    it('connects with an endpoint URL and a label, then shows the secret once', async () => {
        request.mockResolvedValue({ ...connection(), secret: 'whsec_once' });

        renderProvider(
            <WebhookIntegration card={card()} scope={scope} events={events} />,
        );

        await userEvent.click(screen.getByRole('button', { name: 'Connect' }));

        const dialog = screen.getByRole('dialog', { name: 'Connect Webhook' });
        const url = within(dialog).getByLabelText('Endpoint URL');
        const label = within(dialog).getByLabelText('Label (optional)');

        expect(url.getAttribute('type')).toBe('url');
        expect(url.hasAttribute('required')).toBe(true);
        expect(label.getAttribute('maxlength')).toBe('80');

        await userEvent.type(url, 'https://hooks.example.com/skrum/incoming');
        await userEvent.type(label, ' Ops receiver ');
        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Connect' }),
        );

        const secret = await screen.findByRole('textbox', {
            name: 'Signing secret',
        });

        expect(request.mock.calls[0][0].url).toContain(
            '/teams/t1/integrations/webhook',
        );
        expect(request.mock.calls[0][1]).toEqual({
            url: 'https://hooks.example.com/skrum/incoming',
            channel_label: 'Ops receiver',
        });
        expect((secret as HTMLInputElement).value).toBe('whsec_once');
        expect(toast.success).toHaveBeenCalledWith('Webhook connected.');
        expect(router.reload).toHaveBeenCalledWith({ only: ['providers'] });
        await waitFor(() =>
            expect(
                screen.queryByRole('dialog', { name: 'Connect Webhook' }),
            ).toBeNull(),
        );
    });

    it('shows a refused URL under its field, which takes the focus, and keeps the dialog open', async () => {
        request.mockRejectedValue(
            new RetroRequestError(422, 'Invalid.', {
                url: ['This URL points to a private or invalid address.'],
            }),
        );

        renderProvider(
            <WebhookIntegration card={card()} scope={scope} events={events} />,
        );

        await userEvent.click(screen.getByRole('button', { name: 'Connect' }));

        const dialog = screen.getByRole('dialog');
        const url = within(dialog).getByLabelText('Endpoint URL');

        await userEvent.type(url, 'https://127.0.0.1/skrum');
        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Connect' }),
        );

        await waitFor(() =>
            expect(
                dialog.querySelector('[data-slot="field-error"]')?.textContent,
            ).toBe('This URL points to a private or invalid address.'),
        );
        expect(document.activeElement).toBe(url);
        expect(
            screen.queryByRole('textbox', { name: 'Signing secret' }),
        ).toBeNull();
        expect(toast.error).not.toHaveBeenCalled();
        expect(router.reload).not.toHaveBeenCalled();
    });

    it('shows what is connected, with its actions in the footer', () => {
        renderProvider(
            <WebhookIntegration
                card={card(connection())}
                scope={scope}
                events={events}
            />,
        );

        const webhook = providerPanel('Webhook');
        const detailList = webhook.querySelector(
            '[data-slot="provider-details"]',
        );
        const footer = webhook.querySelector(
            '[data-slot="sheet-footer"]',
        ) as HTMLElement;

        expect(providerStatus('Webhook')).toBe('Connected');
        expect(
            Array.from(detailList?.querySelectorAll('dt') ?? []).map(
                (term) => term.textContent,
            ),
        ).toEqual([
            'Host',
            'Label',
            'Secret created on',
            'Last successful delivery',
            'Connected by',
            'Last checked',
        ]);
        expect(detailList?.textContent).toContain('hooks.example.com');
        expect(detailList?.textContent).toContain('Ops receiver');
        expect(
            within(footer)
                .getAllByRole('button')
                .map((button) => button.textContent),
        ).toEqual([
            'Replace URL',
            'Send a test message',
            'Rotate secret',
            'Disconnect',
        ]);
    });

    it('replaces the URL without asking for one again when only the label changes', async () => {
        request.mockResolvedValue(undefined);

        renderProvider(
            <WebhookIntegration
                card={card(connection())}
                scope={scope}
                events={events}
            />,
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Replace URL' }),
        );

        const dialog = screen.getByRole('dialog', { name: 'Replace the URL' });
        const url = within(dialog).getByLabelText('Endpoint URL');
        const label = within(dialog).getByLabelText(
            'Label (optional)',
        ) as HTMLInputElement;

        expect((url as HTMLInputElement).value).toBe('');
        expect(url.hasAttribute('required')).toBe(false);
        expect(label.value).toBe('Ops receiver');

        await userEvent.clear(label);
        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Save' }),
        );

        await waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith('Connection saved.'),
        );
        expect(request.mock.calls[0][0].url).toContain('/integrations/i1');
        expect(request.mock.calls[0][1]).toEqual({ channel_label: null });
        expect(
            screen.queryByRole('textbox', { name: 'Signing secret' }),
        ).toBeNull();
    });

    it('re-enables a webhook that was turned off after its failures', async () => {
        request.mockResolvedValue(undefined);

        renderProvider(
            <WebhookIntegration
                card={card(
                    connection({
                        status: 'reconnect_required',
                        statusLabel: 'Reconnect required',
                        lastError:
                            'Disabled after 10 failed deliveries in a row.',
                    }),
                )}
                scope={scope}
                events={events}
            />,
        );

        const webhook = providerPanel('Webhook');

        expect(within(webhook).getByRole('alert').textContent).toContain(
            'Disabled after 10 failed deliveries in a row.',
        );

        await userEvent.click(
            within(webhook).getByRole('button', { name: 'Re-enable' }),
        );

        await waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith('Webhook re-enabled.'),
        );
        expect(request.mock.calls[0][1]).toEqual({ enabled: true });
        expect(router.reload).toHaveBeenCalledWith({ only: ['providers'] });
    });

    it('has no "Re-enable" while the webhook works', () => {
        renderProvider(
            <WebhookIntegration
                card={card(connection())}
                scope={scope}
                events={events}
            />,
        );

        expect(screen.queryByRole('button', { name: 'Re-enable' })).toBeNull();
    });

    it('rotates the secret after a confirmation, then shows the new one', async () => {
        request.mockResolvedValue({ secret: 'whsec_rotated' });

        renderProvider(
            <WebhookIntegration
                card={card(connection())}
                scope={scope}
                events={events}
            />,
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Rotate secret' }),
        );

        const dialog = screen.getByRole('dialog', {
            name: 'Rotate the signing secret?',
        });

        expect(dialog.textContent).toContain(
            'The current secret stops working immediately. Update your endpoint with the new one.',
        );
        expect(document.activeElement).toBe(
            within(dialog).getByRole('button', { name: 'Cancel' }),
        );
        expect(request).not.toHaveBeenCalled();

        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Rotate secret' }),
        );

        const secret = await screen.findByRole('textbox', {
            name: 'Signing secret',
        });

        expect(request.mock.calls[0][0].url).toContain(
            '/integrations/i1/secret',
        );
        expect((secret as HTMLInputElement).value).toBe('whsec_rotated');
        expect(router.reload).toHaveBeenCalledWith({ only: ['providers'] });
        await waitFor(() =>
            expect(
                screen.queryByRole('dialog', {
                    name: 'Rotate the signing secret?',
                }),
            ).toBeNull(),
        );
    });

    it('keeps the secret it had when the rotation is refused', async () => {
        request.mockRejectedValue(new Error('down'));

        renderProvider(
            <WebhookIntegration
                card={card(connection())}
                scope={scope}
                events={events}
            />,
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Rotate secret' }),
        );
        await userEvent.click(
            within(screen.getByRole('dialog')).getByRole('button', {
                name: 'Rotate secret',
            }),
        );

        await waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith('Something went wrong.'),
        );
        expect(
            screen.queryByRole('textbox', { name: 'Signing secret' }),
        ).toBeNull();
        expect(router.reload).not.toHaveBeenCalled();
    });
});

describe('WebhookSecretDialog', () => {
    it('renders nothing without a secret', () => {
        renderWithProviders(
            <WebhookSecretDialog secret={null} onClose={vi.fn()} />,
        );

        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('shows the secret selected in its field, with how to verify a request', async () => {
        renderWithProviders(
            <WebhookSecretDialog secret="whsec_once" onClose={vi.fn()} />,
        );

        const dialog = screen.getByRole('dialog', { name: 'Signing secret' });
        const field = within(dialog).getByLabelText(
            'Signing secret',
        ) as HTMLInputElement;

        expect(dialog.textContent).toContain(
            "Copy this secret now. You won't be able to see it again.",
        );
        expect(field.readOnly).toBe(true);
        await waitFor(() => expect(document.activeElement).toBe(field));
        expect(dialog.querySelector('pre')?.textContent).toContain(
            'HMAC-SHA256',
        );
    });

    it('copies the secret and says so on the button', async () => {
        const user = userEvent.setup();

        renderWithProviders(
            <WebhookSecretDialog secret="whsec_once" onClose={vi.fn()} />,
        );

        await user.click(screen.getByRole('button', { name: 'Copy' }));

        await screen.findByRole('button', { name: 'Copied' });
        expect(await navigator.clipboard.readText()).toBe('whsec_once');
    });

    it('closes with its button only: not with Escape, and it has no close cross', async () => {
        const onClose = vi.fn();

        renderWithProviders(
            <WebhookSecretDialog secret="whsec_once" onClose={onClose} />,
        );

        await userEvent.keyboard('{Escape}');

        expect(onClose).not.toHaveBeenCalled();
        expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();

        await userEvent.click(
            screen.getByRole('button', { name: "I've saved the secret" }),
        );

        expect(onClose).toHaveBeenCalledTimes(1);
    });
});

describe('WebhookEventsPanel', () => {
    it('lists the events with the saved ones ticked, and nothing to save yet', () => {
        renderWithProviders(
            <WebhookEventsPanel
                scope={scope}
                connection={connection()}
                events={events}
            />,
        );

        const panel = region('Send automatically');
        const boxes = within(panel).getAllByRole('checkbox');

        expect(panel.textContent).toContain(
            'Only the events you tick are sent, as they happen.',
        );
        expect(boxes.map((box) => box.id)).toEqual([
            'webhook-event-action_item.created',
            'webhook-event-action_item.completed',
            'webhook-event-retro.completed',
        ]);
        expect(
            document.querySelectorAll('[id^="webhook-event-"]'),
        ).toHaveLength(3);
        expect(boxes.map((box) => box.getAttribute('aria-checked'))).toEqual([
            'false',
            'true',
            'false',
        ]);
        expect(
            within(panel).getByRole('checkbox', {
                name: /action_item\.created.*An action item is created\./,
            }),
        ).toBe(boxes[0]);
        expect(
            (
                within(panel).getByRole('button', {
                    name: 'Save events',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });

    it('saves the ticked events once they differ from the saved ones', async () => {
        request.mockResolvedValue(undefined);

        renderWithProviders(
            <WebhookEventsPanel
                scope={scope}
                connection={connection()}
                events={events}
            />,
        );

        const save = screen.getByRole('button', {
            name: 'Save events',
        }) as HTMLButtonElement;

        await userEvent.click(
            screen.getByRole('checkbox', { name: /retro\.completed/ }),
        );

        expect(save.disabled).toBe(false);

        await userEvent.click(
            screen.getByRole('checkbox', { name: /retro\.completed/ }),
        );

        expect(save.disabled).toBe(true);

        await userEvent.click(
            screen.getByRole('checkbox', { name: /action_item\.created/ }),
        );
        await userEvent.click(save);

        await waitFor(() =>
            expect(toast.success).toHaveBeenCalledWith('Events saved.'),
        );
        expect(request.mock.calls[0][0].url).toContain('/integrations/i1');
        expect(request.mock.calls[0][1]).toEqual({
            events: ['action_item.completed', 'action_item.created'],
        });
        expect(router.reload).toHaveBeenCalledWith({ only: ['providers'] });
    });

    it('says why the events were not saved', async () => {
        request.mockRejectedValue(new Error('down'));

        renderWithProviders(
            <WebhookEventsPanel
                scope={scope}
                connection={connection()}
                events={events}
            />,
        );

        await userEvent.click(
            screen.getByRole('checkbox', { name: /retro\.completed/ }),
        );
        await userEvent.click(
            screen.getByRole('button', { name: 'Save events' }),
        );

        await waitFor(() =>
            expect(toast.error).toHaveBeenCalledWith('Something went wrong.'),
        );
        expect(router.reload).not.toHaveBeenCalled();
    });

    it('opens the payload reference on demand', async () => {
        renderWithProviders(
            <WebhookEventsPanel
                scope={scope}
                connection={connection()}
                events={events}
            />,
        );

        const trigger = screen.getByRole('button', {
            name: 'Payload reference',
        });

        expect(trigger.getAttribute('aria-expanded')).toBe('false');
        expect(document.querySelector('pre')).toBeNull();

        await userEvent.click(trigger);

        expect(trigger.getAttribute('aria-expanded')).toBe('true');
        expect(document.querySelector('pre')?.textContent).toContain(
            '"event": "action_item.completed"',
        );
    });
});

describe('WebhookDeliveriesPanel', () => {
    it('loads the first page when it is opened and shows one row per delivery', async () => {
        request.mockResolvedValue(
            pageOf([
                delivery({
                    id: 'd2',
                    status: 'queued',
                    attempts: 0,
                    responseStatus: null,
                    redeliveryOf: 'd1',
                    lastAttemptAt: null,
                }),
                delivery({
                    status: 'failed',
                    attempts: 7,
                    responseStatus: 503,
                    error: 'Webhook did not respond. Try again later.',
                    redeliverable: true,
                }),
                delivery({ id: 'd3', event: null, kind: 'retro_link' }),
            ]),
        );

        renderWithProviders(
            <WebhookDeliveriesPanel scope={scope} connection={connection()} />,
        );

        const toggle = within(region('Deliveries')).getByRole('button', {
            name: 'Show deliveries',
        });

        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(request).not.toHaveBeenCalled();

        await userEvent.click(toggle);

        await waitFor(() => expect(tableRows()).toHaveLength(3));
        expect(request.mock.calls[0][0].url).toContain(
            '/integrations/i1/deliveries?page=1',
        );
        expect(tableRows()).toEqual([
            'action_item.completedRedelivery | Queued | 0 | — | —',
            'action_item.completed | Failed | 7 | 503 | Webhook did not respond. Try again later.',
            'Board link | Sent | 1 | 200 | —',
        ]);
        expect(
            within(deliveriesTable())
                .getAllByRole('columnheader')
                .map((head) => head.textContent),
        ).toEqual([
            'Time',
            'Event',
            'Status',
            'Attempts',
            'Response',
            'Error',
            'Actions',
        ]);
        expect(
            screen
                .getByRole('button', { name: 'Hide deliveries' })
                .getAttribute('aria-expanded'),
        ).toBe('true');
    });

    it('shows the status of a delivery as a badge of its colour', async () => {
        request.mockResolvedValue(
            pageOf([
                delivery({ status: 'failed' }),
                delivery({ id: 'd2', status: 'sent' }),
            ]),
        );

        renderWithProviders(
            <WebhookDeliveriesPanel scope={scope} connection={connection()} />,
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Show deliveries' }),
        );
        await waitFor(() => expect(tableRows()).toHaveLength(2));

        const badges = Array.from(
            deliveriesTable().querySelectorAll(
                'tbody tr td:nth-child(3) [data-slot="badge"]',
            ),
        );

        expect(
            badges.map((badge) => badge.getAttribute('data-status')),
        ).toEqual(['failed', 'sent']);
    });

    it('offers "Redeliver" only for a delivery that can be sent again by a working webhook', async () => {
        request.mockResolvedValue(
            pageOf([
                delivery({ redeliverable: true }),
                delivery({ id: 'd2', redeliverable: false }),
            ]),
        );

        const { unmount } = renderWithProviders(
            <WebhookDeliveriesPanel scope={scope} connection={connection()} />,
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Show deliveries' }),
        );
        await waitFor(() => expect(tableRows()).toHaveLength(2));

        expect(
            within(deliveriesTable()).getAllByRole('button', { name: 'View' }),
        ).toHaveLength(2);
        expect(
            within(deliveriesTable()).getAllByRole('button', {
                name: 'Redeliver',
            }),
        ).toHaveLength(1);

        unmount();

        renderWithProviders(
            <WebhookDeliveriesPanel
                scope={scope}
                connection={connection({ status: 'reconnect_required' })}
            />,
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Show deliveries' }),
        );
        await waitFor(() => expect(tableRows()).toHaveLength(2));

        expect(
            within(deliveriesTable()).queryByRole('button', {
                name: 'Redeliver',
            }),
        ).toBeNull();
    });

    it('says that the content of a delivery is not kept, or no longer kept once expired', async () => {
        request.mockResolvedValue(
            pageOf([
                delivery({ hasContent: false, contentExpired: false }),
                delivery({
                    id: 'd2',
                    hasContent: false,
                    contentExpired: true,
                }),
            ]),
        );

        renderWithProviders(
            <WebhookDeliveriesPanel scope={scope} connection={connection()} />,
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Show deliveries' }),
        );
        await waitFor(() => expect(tableRows()).toHaveLength(2));

        const lastCells = Array.from(
            deliveriesTable().querySelectorAll('tbody tr'),
        ).map((row) => row.children[6].textContent);

        expect(lastCells).toEqual([
            'Content not kept',
            'Content no longer kept',
        ]);
        expect(
            within(deliveriesTable()).queryByRole('button', { name: 'View' }),
        ).toBeNull();
    });

    it('says when nothing was delivered yet', async () => {
        request.mockResolvedValue(pageOf([]));

        renderWithProviders(
            <WebhookDeliveriesPanel scope={scope} connection={connection()} />,
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Show deliveries' }),
        );

        await screen.findByText('No deliveries yet.');
        expect(screen.queryByRole('table')).toBeNull();
    });

    it('offers to retry when the deliveries cannot be loaded', async () => {
        request.mockRejectedValueOnce(new Error('down'));
        request.mockResolvedValueOnce(pageOf([delivery()]));

        renderWithProviders(
            <WebhookDeliveriesPanel scope={scope} connection={connection()} />,
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Show deliveries' }),
        );

        await screen.findByText('Could not load the deliveries.');
        expect(toast.error).toHaveBeenCalledWith('Something went wrong.');

        await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

        await waitFor(() => expect(tableRows()).toHaveLength(1));
        expect(screen.queryByText('Could not load the deliveries.')).toBeNull();
    });

    it('moves between the pages', async () => {
        request.mockResolvedValueOnce(pageOf([delivery()], 1, 2));
        request.mockResolvedValueOnce(
            pageOf([delivery({ id: 'd9', attempts: 3 })], 2, 2),
        );

        renderWithProviders(
            <WebhookDeliveriesPanel scope={scope} connection={connection()} />,
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Show deliveries' }),
        );
        await screen.findByText('Page 1 of 2');

        const previous = screen.getByRole('button', {
            name: 'Previous',
        }) as HTMLButtonElement;
        const next = screen.getByRole('button', {
            name: 'Next',
        }) as HTMLButtonElement;

        expect(previous.disabled).toBe(true);
        expect(next.disabled).toBe(false);

        await userEvent.click(next);

        await screen.findByText('Page 2 of 2');
        expect(request.mock.calls[1][0].url).toContain('page=2');
        expect(tableRows()).toEqual([
            'action_item.completed | Sent | 3 | 200 | —',
        ]);
        expect(
            (screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement)
                .disabled,
        ).toBe(true);
    });

    it('forgets an answer that arrives after the list was closed', async () => {
        const slow = deferred<WebhookDeliveryPage>();
        const fresh = deferred<WebhookDeliveryPage>();
        request.mockReturnValueOnce(slow.promise);
        request.mockReturnValueOnce(fresh.promise);

        renderWithProviders(
            <WebhookDeliveriesPanel scope={scope} connection={connection()} />,
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Show deliveries' }),
        );
        await userEvent.click(
            screen.getByRole('button', { name: 'Hide deliveries' }),
        );
        await userEvent.click(
            screen.getByRole('button', { name: 'Show deliveries' }),
        );

        slow.resolve(pageOf([delivery({ id: 'stale', attempts: 9 })]));
        await slow.promise;

        expect(screen.queryByRole('table')).toBeNull();

        fresh.resolve(pageOf([delivery()]));

        await waitFor(() =>
            expect(tableRows()).toEqual([
                'action_item.completed | Sent | 1 | 200 | —',
            ]),
        );
    });

    it('shows the loading state, not the old rows, when the list opens again', async () => {
        request.mockResolvedValueOnce(pageOf([delivery()]));
        request.mockReturnValueOnce(deferred<WebhookDeliveryPage>().promise);

        renderWithProviders(
            <WebhookDeliveriesPanel scope={scope} connection={connection()} />,
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Show deliveries' }),
        );
        await waitFor(() => expect(tableRows()).toHaveLength(1));
        await userEvent.click(
            screen.getByRole('button', { name: 'Hide deliveries' }),
        );
        await userEvent.click(
            screen.getByRole('button', { name: 'Show deliveries' }),
        );

        expect(screen.queryByRole('table')).toBeNull();
        expect(
            document.querySelector('[data-slot="deliveries-loading"]'),
        ).not.toBeNull();
    });

    it('retries the page that was asked for', async () => {
        request.mockResolvedValueOnce(pageOf([delivery()], 1, 2));
        request.mockRejectedValueOnce(new Error('down'));
        request.mockResolvedValueOnce(pageOf([delivery({ id: 'd9' })], 2, 2));

        renderWithProviders(
            <WebhookDeliveriesPanel scope={scope} connection={connection()} />,
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Show deliveries' }),
        );
        await screen.findByText('Page 1 of 2');
        await userEvent.click(screen.getByRole('button', { name: 'Next' }));
        await userEvent.click(
            await screen.findByRole('button', { name: 'Retry' }),
        );

        await screen.findByText('Page 2 of 2');
        expect(request.mock.calls[2][0].url).toContain('page=2');
    });

    it('opens the details of a delivery', async () => {
        request.mockResolvedValueOnce(pageOf([delivery()]));
        request.mockResolvedValueOnce(details);

        renderWithProviders(
            <WebhookDeliveriesPanel scope={scope} connection={connection()} />,
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Show deliveries' }),
        );
        await waitFor(() => expect(tableRows()).toHaveLength(1));
        await userEvent.click(
            within(deliveriesTable()).getByRole('button', { name: 'View' }),
        );

        const dialog = await screen.findByRole('dialog', {
            name: 'Delivery details',
        });

        await within(dialog).findByRole('table', { name: 'Headers' });
        expect(request.mock.calls[1][0].url).toContain(
            '/integrations/i1/deliveries/d1',
        );
    });

    it('sends a delivery again after a confirmation and reloads its page', async () => {
        request.mockResolvedValueOnce(
            pageOf([delivery({ status: 'failed', redeliverable: true })]),
        );
        request.mockResolvedValueOnce(delivery({ id: 'd2' }));
        request.mockResolvedValueOnce(
            pageOf([
                delivery({ id: 'd2', status: 'queued', redeliveryOf: 'd1' }),
                delivery({ status: 'failed', redeliverable: true }),
            ]),
        );

        renderWithProviders(
            <WebhookDeliveriesPanel scope={scope} connection={connection()} />,
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Show deliveries' }),
        );
        await waitFor(() => expect(tableRows()).toHaveLength(1));
        await userEvent.click(
            within(deliveriesTable()).getByRole('button', {
                name: 'Redeliver',
            }),
        );

        const dialog = screen.getByRole('dialog', { name: 'Redeliver' });

        expect(dialog.textContent).toContain(
            'Send this delivery again to hooks.example.com?',
        );
        expect(request).toHaveBeenCalledTimes(1);

        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Redeliver' }),
        );

        await waitFor(() => expect(tableRows()).toHaveLength(2));
        expect(request.mock.calls[1][0].url).toContain(
            '/integrations/i1/deliveries/d1/redelivery',
        );
        expect(request.mock.calls[2][0].url).toContain('page=1');
        expect(toast).toHaveBeenCalledWith('Delivery queued again.');
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('stays on the page of the delivery sent again', async () => {
        request.mockResolvedValueOnce(pageOf([delivery()], 1, 2));
        request.mockResolvedValueOnce(
            pageOf([delivery({ status: 'failed', redeliverable: true })], 2, 2),
        );
        request.mockResolvedValueOnce(delivery({ id: 'd2' }));
        request.mockResolvedValueOnce(
            pageOf([delivery({ status: 'failed', redeliverable: true })], 2, 2),
        );

        renderWithProviders(
            <WebhookDeliveriesPanel scope={scope} connection={connection()} />,
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Show deliveries' }),
        );
        await screen.findByText('Page 1 of 2');
        await userEvent.click(screen.getByRole('button', { name: 'Next' }));
        await screen.findByText('Page 2 of 2');
        await userEvent.click(
            within(deliveriesTable()).getByRole('button', {
                name: 'Redeliver',
            }),
        );
        await userEvent.click(
            within(screen.getByRole('dialog', { name: 'Redeliver' })).getByRole(
                'button',
                { name: 'Redeliver' },
            ),
        );

        await waitFor(() => expect(request).toHaveBeenCalledTimes(4));
        expect(request.mock.calls[3][0].url).toContain('page=2');
    });

    it('keeps the confirmation open with the reason when a delivery cannot be sent again', async () => {
        request.mockResolvedValueOnce(
            pageOf([delivery({ status: 'failed', redeliverable: true })]),
        );
        request.mockRejectedValueOnce(
            new RetroRequestError(
                409,
                'This delivery is still being sent.',
                {},
            ),
        );

        renderWithProviders(
            <WebhookDeliveriesPanel scope={scope} connection={connection()} />,
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'Show deliveries' }),
        );
        await waitFor(() => expect(tableRows()).toHaveLength(1));
        await userEvent.click(
            within(deliveriesTable()).getByRole('button', {
                name: 'Redeliver',
            }),
        );

        const dialog = screen.getByRole('dialog', { name: 'Redeliver' });

        await userEvent.click(
            within(dialog).getByRole('button', { name: 'Redeliver' }),
        );

        const alert = await within(dialog).findByRole('alert');

        expect(alert.textContent).toBe('This delivery is still being sent.');
        expect(toast).not.toHaveBeenCalled();
        expect(request).toHaveBeenCalledTimes(2);
    });
});

describe('WebhookDeliveryDialog', () => {
    it('waits for the delivery, then says when it cannot be loaded', () => {
        const { rerender } = renderWithProviders(
            <WebhookDeliveryDialog
                label="Board link"
                details={null}
                failed={false}
                onClose={vi.fn()}
                onRetry={vi.fn()}
            />,
        );

        const dialog = screen.getByRole('dialog', { name: 'Delivery details' });

        expect(dialog.textContent).toContain('Board link');
        expect(within(dialog).getByRole('status').textContent).toBe('Loading…');
        expect(within(dialog).queryByRole('tablist')).toBeNull();

        rerender(
            <WebhookDeliveryDialog
                label="Board link"
                details={null}
                failed
                onClose={vi.fn()}
                onRetry={vi.fn()}
            />,
        );

        expect(within(dialog).getByRole('alert').textContent).toContain(
            'Could not load this delivery.',
        );
        expect(within(dialog).queryByRole('status')).toBeNull();
    });

    it('loads a delivery that could not be loaded again on "Retry"', async () => {
        const onRetry = vi.fn();

        renderWithProviders(
            <WebhookDeliveryDialog
                label="Board link"
                details={null}
                failed
                onClose={vi.fn()}
                onRetry={onRetry}
            />,
        );

        await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('shows the request first: its headers and its body, indented', () => {
        renderWithProviders(
            <WebhookDeliveryDialog
                label="action_item.completed"
                details={details}
                failed={false}
                onClose={vi.fn()}
                onRetry={vi.fn()}
            />,
        );

        const requestTab = document.getElementById('delivery-tab-request');
        const responseTab = document.getElementById('delivery-tab-response');
        const panel = document.getElementById('delivery-tabpanel');
        const headers = screen.getByRole('table', { name: 'Headers' });

        expect(requestTab?.getAttribute('role')).toBe('tab');
        expect(requestTab?.getAttribute('aria-selected')).toBe('true');
        expect(responseTab?.getAttribute('aria-selected')).toBe('false');
        expect(requestTab?.getAttribute('aria-controls')).toBe(
            'delivery-tabpanel',
        );
        expect(panel?.getAttribute('role')).toBe('tabpanel');
        expect(panel?.getAttribute('aria-labelledby')).toBe(
            'delivery-tab-request',
        );
        expect(
            within(headers)
                .getAllByRole('rowheader')
                .map((name) => name.textContent),
        ).toEqual(['X-Skrum-Event', 'X-Skrum-Signature']);
        expect(headers.textContent).toContain('sha256=••••');
        expect(panel?.querySelector('pre')?.textContent).toBe(
            '{\n  "event": "action_item.completed"\n}',
        );
    });

    it('moves between the two tabs with the arrow keys, Home and End', async () => {
        renderWithProviders(
            <WebhookDeliveryDialog
                label="action_item.completed"
                details={details}
                failed={false}
                onClose={vi.fn()}
                onRetry={vi.fn()}
            />,
        );

        const requestTab = document.getElementById(
            'delivery-tab-request',
        ) as HTMLElement;
        const responseTab = document.getElementById(
            'delivery-tab-response',
        ) as HTMLElement;

        expect(requestTab.tabIndex).toBe(0);
        expect(responseTab.tabIndex).toBe(-1);

        requestTab.focus();
        await userEvent.keyboard('{ArrowRight}');

        await waitFor(() =>
            expect(responseTab.getAttribute('aria-selected')).toBe('true'),
        );
        expect(document.activeElement).toBe(responseTab);
        expect(responseTab.tabIndex).toBe(0);
        expect(requestTab.tabIndex).toBe(-1);
        expect(
            document
                .getElementById('delivery-tabpanel')
                ?.getAttribute('aria-labelledby'),
        ).toBe('delivery-tab-response');

        await userEvent.keyboard('{ArrowRight}');
        await waitFor(() => expect(document.activeElement).toBe(requestTab));

        await userEvent.keyboard('{ArrowLeft}');
        await waitFor(() => expect(document.activeElement).toBe(responseTab));

        await userEvent.keyboard('{Home}');
        await waitFor(() =>
            expect(requestTab.getAttribute('aria-selected')).toBe('true'),
        );

        await userEvent.keyboard('{End}');
        await waitFor(() =>
            expect(responseTab.getAttribute('aria-selected')).toBe('true'),
        );
        expect(document.querySelectorAll('#delivery-tabpanel')).toHaveLength(1);
    });

    it('shows the status and the body of the response', async () => {
        renderWithProviders(
            <WebhookDeliveryDialog
                label="action_item.completed"
                details={details}
                failed={false}
                onClose={vi.fn()}
                onRetry={vi.fn()}
            />,
        );

        await userEvent.click(screen.getByRole('tab', { name: 'Response' }));

        const panel = document.getElementById('delivery-tabpanel');

        expect(panel?.textContent).toContain('Status: 200');
        expect(panel?.querySelector('pre')?.textContent).toBe(
            '{"received":true}',
        );
        expect(screen.queryByRole('table', { name: 'Headers' })).toBeNull();
    });

    it('says when there was no answer, and when nothing was sent yet', async () => {
        renderWithProviders(
            <WebhookDeliveryDialog
                label="action_item.completed"
                details={{
                    ...details,
                    request: { headers: {}, body: null },
                    response: { status: null, excerpt: null },
                }}
                failed={false}
                onClose={vi.fn()}
                onRetry={vi.fn()}
            />,
        );

        expect(document.getElementById('delivery-tabpanel')?.textContent).toBe(
            'Not sent yet.',
        );

        await userEvent.click(screen.getByRole('tab', { name: 'Response' }));

        const panel = document.getElementById('delivery-tabpanel');

        expect(panel?.textContent).toContain('Status: —');
        expect(panel?.textContent).toContain('No response body.');
    });

    it('copies the body as it was sent and says so on the button', async () => {
        const user = userEvent.setup();

        renderWithProviders(
            <WebhookDeliveryDialog
                label="action_item.completed"
                details={details}
                failed={false}
                onClose={vi.fn()}
                onRetry={vi.fn()}
            />,
        );

        await user.click(screen.getByRole('button', { name: 'Copy' }));

        await screen.findByRole('button', { name: 'Copied' });
        expect(await navigator.clipboard.readText()).toBe(
            '{"event":"action_item.completed"}',
        );
    });

    it('closes with its cross', async () => {
        const onClose = vi.fn();

        renderWithProviders(
            <WebhookDeliveryDialog
                label="action_item.completed"
                details={details}
                failed={false}
                onClose={onClose}
                onRetry={vi.fn()}
            />,
        );

        await userEvent.click(screen.getByRole('button', { name: 'Close' }));

        expect(onClose).toHaveBeenCalledTimes(1);
    });
});
