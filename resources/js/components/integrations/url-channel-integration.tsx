import { router } from '@inertiajs/react';
import { MessageCircle, MessagesSquare } from 'lucide-react';
import { useId, useState } from 'react';
import { toast } from 'sonner';
import IntegrationUrlsController from '@/actions/App/Http/Controllers/Integrations/IntegrationUrlsController';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
import { FormDialog } from '@/components/skrum/confirm-dialog';
import { TextField } from '@/components/skrum/text-field';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { RetroRequestError, retroRequest } from '@/lib/retro/api';
import type {
    IntegrationProviderCard,
    IntegrationScope,
    MattermostServerInfo,
} from '@/types';
import { DisconnectIntegrationDialog } from './disconnect-integration-dialog';
import { TestConnectionButton } from './integration-actions';
import {
    ProviderCard,
    ProviderDetails,
    providerCardProps,
} from './provider-card';
import type { DisconnectControl } from './provider-card';

type Props = {
    card: IntegrationProviderCard;
    scope: IntegrationScope;
    mattermost: MattermostServerInfo | null;
};

type FieldErrors = { url?: string; channel_label?: string };

function textOf(data: FormData, name: string): string {
    const value = data.get(name);

    return typeof value === 'string' ? value : '';
}

/**
 * Microsoft Teams and Mattermost connect with a pasted webhook URL. The URL
 * is never sent back to the browser, so replacing it means pasting it again.
 */
export function UrlChannelIntegration({ card, scope, mattermost }: Props) {
    const { t } = useTrans();
    const urlId = useId();
    const labelId = useId();
    const connection = card.connection;
    const isTeams = card.provider === 'msteams';
    const [open, setOpen] = useState(false);
    const [errors, setErrors] = useState<FieldErrors>({});

    const description = isTeams
        ? t(
              'Post board links, game invites and results to a Microsoft Teams channel through a Workflows webhook.',
          )
        : mattermost === null
          ? t(
                'Post board links, game invites and results to a Mattermost channel through an incoming webhook.',
            )
          : t(
                'Post board links, game invites and results to a Mattermost channel through an incoming webhook of :url.',
                { url: mattermost.url },
            );
    const help = isTeams
        ? t(
              'In Teams, add the workflow "Post to a channel when a webhook request is received" to the channel and paste its URL.',
          )
        : t(
              'In Mattermost, create an incoming webhook for the channel and paste its URL.',
          );

    const changeOpen = (next: boolean) => {
        setErrors({});
        setOpen(next);
    };

    /** A rejection keeps the dialog open: the form dialog closes on success only. */
    const submit = async (data: FormData) => {
        setErrors({});

        const url = textOf(data, 'url');
        const label = textOf(data, 'channel_label').trim();

        try {
            await retroRequest(
                connection === null
                    ? IntegrationUrlsController.store({
                          ...scope,
                          provider: card.provider,
                      })
                    : TeamIntegrationsController.update({
                          ...scope,
                          integration: connection.id,
                      }),
                {
                    ...(url === '' ? {} : { url }),
                    channel_label: label === '' ? null : label,
                },
            );
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

    const destination =
        connection?.settings.channelLabel ?? connection?.settings.host ?? '';

    const disconnect =
        connection === null
            ? undefined
            : (control?: DisconnectControl) => (
                  <DisconnectIntegrationDialog
                      scope={scope}
                      card={card}
                      connection={connection}
                      description={t(
                          'Nothing is posted to :channel anymore. Delete the webhook in :provider if you no longer need it.',
                          {
                              channel: destination,
                              provider: card.label,
                          },
                      )}
                      control={control}
                  />
              );

    return (
        <>
            <ProviderCard
                {...providerCardProps(
                    card,
                    isTeams ? MessagesSquare : MessageCircle,
                    t,
                )}
                disconnect={disconnect}
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
                                    label: t('Channel'),
                                    value:
                                        connection.settings.channelLabel ?? '—',
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
                            {connection.status === 'active' && (
                                <TestConnectionButton
                                    scope={scope}
                                    connection={connection}
                                    label={t('Send a test message')}
                                    successMessage={t('Test message sent.')}
                                />
                            )}
                            {disconnect?.()}
                        </>
                    )
                }
            >
                {connection === null && (
                    <p className="text-sm text-muted-foreground">
                        {description}
                    </p>
                )}
            </ProviderCard>
            <FormDialog
                open={open}
                onOpenChange={changeOpen}
                title={
                    connection === null
                        ? t('Connect :provider', { provider: card.label })
                        : t('Replace the URL')
                }
                description={help}
                submitLabel={connection === null ? t('Connect') : t('Save')}
                onSubmit={submit}
            >
                <TextField
                    id={urlId}
                    name="url"
                    type="url"
                    label={t('Webhook URL')}
                    required={connection === null}
                    autoComplete="off"
                    error={errors.url}
                />
                <TextField
                    id={labelId}
                    name="channel_label"
                    label={t('Channel label (optional)')}
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
