import { router, usePage } from '@inertiajs/react';
import { Webhook } from 'lucide-react';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import IntegrationUrlsController from '@/actions/App/Http/Controllers/Integrations/IntegrationUrlsController';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
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
import { IntegrationCard } from './integration-card';
import { IntegrationDetails } from './integration-details';
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
    const [busy, setBusy] = useState(false);
    const [url, setUrl] = useState('');
    const [channelLabel, setChannelLabel] = useState('');
    const [errors, setErrors] = useState<FieldErrors>({});
    const [secret, setSecret] = useState<string | null>(null);

    const formatDate = (value: string | null | undefined): string =>
        value === null || value === undefined
            ? t('Never')
            : new Intl.DateTimeFormat(locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
              }).format(new Date(value));

    const openDialog = () => {
        setUrl('');
        setChannelLabel(connection?.settings.channelLabel ?? '');
        setErrors({});
        setOpen(true);
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setErrors({});

        const label = channelLabel.trim();
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

            setOpen(false);
            toast.success(
                connection === null
                    ? t(':provider connected.', { provider: card.label })
                    : t('Connection saved.'),
            );
            router.reload({ only: ['providers'] });
        } catch (error) {
            if (error instanceof RetroRequestError && error.status === 422) {
                setErrors({
                    url: error.errors.url?.[0],
                    channel_label: error.errors.channel_label?.[0],
                });
            } else {
                toast.error(
                    integrationErrorMessage(error, t('Something went wrong.')),
                );
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <IntegrationCard
            icon={Webhook}
            card={card}
            actions={
                connection === null ? (
                    <Button size="sm" onClick={openDialog}>
                        {t('Connect')}
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
                            size="sm"
                            variant="outline"
                            onClick={openDialog}
                        >
                            {t('Replace URL')}
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
            {connection === null ? (
                <p className="text-sm text-muted-foreground">
                    {t(
                        'Send board links, game invites, results and the events you choose to your own HTTPS endpoint, signed with a secret.',
                    )}
                </p>
            ) : (
                <>
                    <IntegrationDetails
                        connection={connection}
                        rows={[
                            {
                                label: t('Host'),
                                value: connection.settings.host,
                            },
                            {
                                label: t('Label'),
                                value: connection.settings.channelLabel ?? '—',
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
                                    connection.webhook?.lastDeliverySucceededAt,
                                ),
                            },
                        ]}
                    />
                    <WebhookEventsPanel
                        key={(connection.settings.events ?? []).join(',')}
                        scope={scope}
                        connection={connection}
                        events={events}
                    />
                    <WebhookDeliveriesPanel
                        scope={scope}
                        connection={connection}
                    />
                </>
            )}
            <WebhookSecretDialog
                secret={secret}
                onClose={() => setSecret(null)}
            />
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <form className="space-y-4" onSubmit={submit}>
                        <DialogTitle>
                            {connection === null
                                ? t('Connect :provider', {
                                      provider: card.label,
                                  })
                                : t('Replace the URL')}
                        </DialogTitle>
                        <DialogDescription>
                            {t(
                                'Paste the URL of an endpoint that accepts POST requests with a JSON body.',
                            )}
                        </DialogDescription>
                        <div className="space-y-2">
                            <Label htmlFor={urlId}>{t('Endpoint URL')}</Label>
                            <Input
                                id={urlId}
                                type="url"
                                required={connection === null}
                                autoComplete="off"
                                value={url}
                                onChange={(event) => setUrl(event.target.value)}
                            />
                            <InputError message={errors.url} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={labelId}>
                                {t('Label (optional)')}
                            </Label>
                            <Input
                                id={labelId}
                                maxLength={80}
                                value={channelLabel}
                                onChange={(event) =>
                                    setChannelLabel(event.target.value)
                                }
                            />
                            <p className="text-xs text-muted-foreground">
                                {t(
                                    'Shown on this page only, to remember where messages go.',
                                )}
                            </p>
                            <InputError message={errors.channel_label} />
                        </div>
                        <DialogFooter className="gap-2">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setOpen(false)}
                            >
                                {t('Cancel')}
                            </Button>
                            <Button type="submit" disabled={busy}>
                                {busy && <Spinner />}
                                {connection === null ? t('Connect') : t('Save')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </IntegrationCard>
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
        <Button size="sm" disabled={busy} onClick={() => void reenable()}>
            {busy && <Spinner />}
            {t('Re-enable')}
        </Button>
    );
}
