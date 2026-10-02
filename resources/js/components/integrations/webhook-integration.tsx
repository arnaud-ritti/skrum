import { router, usePage } from '@inertiajs/react';
import { Webhook } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import IntegrationUrlsController from '@/actions/App/Http/Controllers/Integrations/IntegrationUrlsController';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
import { FormDialog } from '@/components/skrum/confirm-dialog';
import { LoadingButton } from '@/components/skrum/loading-button';
import { TextField } from '@/components/skrum/text-field';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import type {
    ConnectedWebhook,
    IntegrationProviderCard,
    IntegrationScope,
    TeamIntegration,
    WebhookEventOption,
} from '@/types';
import { DisconnectIntegrationDialog } from './disconnect-integration-dialog';
import { TestConnectionButton } from './integration-actions';
import {
    ProviderCard,
    ProviderDetails,
    providerCardProps,
} from './provider-card';
import { WebhookDeliveriesPanel } from './webhook-deliveries-panel';
import { WebhookEventsPanel } from './webhook-events-panel';
import {
    RotateWebhookSecretButton,
    WebhookSecretDialog,
} from './webhook-secret';

type Props = {
    card: IntegrationProviderCard;
    scope: IntegrationScope;
    events: WebhookEventOption[];
};

type FieldErrors = { url?: string; channel_label?: string };

function textOf(data: FormData, name: string): string {
    const value = data.get(name);

    return typeof value === 'string' ? value : '';
}

/**
 * A generic webhook: a signed POST to the team's own endpoint. The URL and
 * the secret are never sent back to the browser after they are saved.
 */
export function WebhookIntegration({ card, scope, events }: Props) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const urlId = useId();
    const labelId = useId();
    const connection = card.connection;
    const [open, setOpen] = useState(false);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [secret, setSecret] = useState<string | null>(null);

    const formatDate = (value: string | null | undefined): string =>
        value === null || value === undefined
            ? t('Never')
            : new Intl.DateTimeFormat(locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
              }).format(new Date(value));

    const changeOpen = (next: boolean) => {
        setErrors({});
        setOpen(next);
    };

    /** A rejection keeps the dialog open: the form dialog closes on success only. */
    const submit = async (data: FormData) => {
        setErrors({});

        const url = textOf(data, 'url');
        const label = textOf(data, 'channel_label').trim();
        const body = {
            ...(url === '' ? {} : { url }),
            channel_label: label === '' ? null : label,
        };

        try {
            if (connection === null) {
                const created = await retroRequest<ConnectedWebhook>(
                    IntegrationUrlsController.store({
                        ...scope,
                        provider: 'webhook',
                    }),
                    body,
                );

                setSecret(created.secret);
            } else {
                await retroRequest(
                    TeamIntegrationsController.update({
                        ...scope,
                        integration: connection.id,
                    }),
                    body,
                );
            }
        } catch (error) {
            if (error instanceof RetroRequestError && error.status === 422) {
                const refused: FieldErrors = {
                    url: error.errors.url?.[0],
                    channel_label: error.errors.channel_label?.[0],
                };

                setErrors(refused);
                document
                    .getElementById(refused.url === undefined ? labelId : urlId)
                    ?.focus();
            } else {
                toast.error(
                    integrationErrorMessage(error, t('Something went wrong.')),
                );
            }

            throw error;
        }

        toast.success(
            connection === null
                ? t(':provider connected.', { provider: card.label })
                : t('Connection saved.'),
        );
        router.reload({ only: ['providers'] });
    };

    return (
        <>
            <ProviderCard
                {...providerCardProps(card, Webhook, t)}
                details={
                    connection !== null && (
                        <ProviderDetails
                            connection={connection}
                            rows={[
                                {
                                    label: t('Host'),
                                    value: connection.settings.host,
                                },
                                {
                                    label: t('Label'),
                                    value:
                                        connection.settings.channelLabel ?? '—',
                                },
                                {
                                    label: t('Secret created on'),
                                    value: formatDate(
                                        connection.settings.secretCreatedAt,
                                    ),
                                },
                                {
                                    label: t('Last successful delivery'),
                                    value: formatDate(
                                        connection.webhook
                                            ?.lastDeliverySucceededAt,
                                    ),
                                },
                            ]}
                        />
                    )
                }
                actions={
                    connection === null ? (
                        <Button
                            type="button"
                            size="sm"
                            className="max-w-full"
                            onClick={() => changeOpen(true)}
                        >
                            <span className="truncate">{t('Connect')}</span>
                        </Button>
                    ) : (
                        <>
                            {connection.status === 'reconnect_required' && (
                                <ReenableWebhookButton
                                    scope={scope}
                                    connection={connection}
                                />
                            )}
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="max-w-full"
                                onClick={() => changeOpen(true)}
                            >
                                <span className="truncate">
                                    {t('Replace URL')}
                                </span>
                            </Button>
                            <TestConnectionButton
                                scope={scope}
                                connection={connection}
                                label={t('Send a test message')}
                                successMessage={t('Test message sent.')}
                            />
                            <RotateWebhookSecretButton
                                scope={scope}
                                connection={connection}
                                onRotated={setSecret}
                            />
                            <DisconnectIntegrationDialog
                                scope={scope}
                                card={card}
                                connection={connection}
                                description={t(
                                    'Nothing is sent to :host anymore. Remove the endpoint on your side if you no longer need it.',
                                    { host: connection.settings.host ?? '' },
                                )}
                            />
                        </>
                    )
                }
            >
                {connection === null && (
                    <p className="text-sm text-muted-foreground">
                        {t(
                            'Send board links, game invites, results and the events you choose to your own HTTPS endpoint, signed with a secret.',
                        )}
                    </p>
                )}
                {connection !== null && (
                    <WebhookEventsPanel
                        key={(connection.settings.events ?? []).join(',')}
                        scope={scope}
                        connection={connection}
                        events={events}
                    />
                )}
                {connection !== null && (
                    <WebhookDeliveriesPanel
                        scope={scope}
                        connection={connection}
                    />
                )}
            </ProviderCard>
            <WebhookSecretDialog
                secret={secret}
                onClose={() => setSecret(null)}
            />
            <FormDialog
                open={open}
                onOpenChange={changeOpen}
                title={
                    connection === null
                        ? t('Connect :provider', { provider: card.label })
                        : t('Replace the URL')
                }
                description={t(
                    'Paste the URL of an endpoint that accepts POST requests with a JSON body.',
                )}
                submitLabel={connection === null ? t('Connect') : t('Save')}
                onSubmit={submit}
            >
                <TextField
                    id={urlId}
                    name="url"
                    type="url"
                    label={t('Endpoint URL')}
                    required={connection === null}
                    autoComplete="off"
                    error={errors.url}
                />
                <TextField
                    id={labelId}
                    name="channel_label"
                    label={t('Label (optional)')}
                    maxLength={80}
                    autoComplete="off"
                    defaultValue={connection?.settings.channelLabel ?? ''}
                    description={t(
                        'Shown on this page only, to remember where messages go.',
                    )}
                    error={errors.channel_label}
                />
            </FormDialog>
        </>
    );
}

type ReenableProps = {
    scope: IntegrationScope;
    connection: TeamIntegration;
};

function ReenableWebhookButton({ scope, connection }: ReenableProps) {
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);

    const reenable = async () => {
        setBusy(true);

        try {
            await retroRequest(
                TeamIntegrationsController.update({
                    ...scope,
                    integration: connection.id,
                }),
                { enabled: true },
            );
            toast.success(t('Webhook re-enabled.'));
            router.reload({ only: ['providers'] });
        } catch (error) {
            toast.error(
                integrationErrorMessage(error, t('Something went wrong.')),
            );
        } finally {
            setBusy(false);
        }
    };

    return (
        <LoadingButton
            type="button"
            size="sm"
            className="max-w-full"
            loading={busy}
            onClick={() => void reenable()}
        >
            <span className="truncate">{t('Re-enable')}</span>
        </LoadingButton>
    );
}
