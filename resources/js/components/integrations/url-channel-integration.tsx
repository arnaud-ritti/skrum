import { router } from '@inertiajs/react';
import { MessageCircle, MessagesSquare } from 'lucide-react';
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
    IntegrationProviderCard,
    IntegrationScope,
    MattermostServerInfo,
} from '@/types';
import { DisconnectIntegrationDialog } from './disconnect-integration-dialog';
import { TestConnectionButton } from './integration-actions';
import { IntegrationCard } from './integration-card';
import { IntegrationDetails } from './integration-details';

type Props = {
    card: IntegrationProviderCard;
    scope: IntegrationScope;
    mattermost: MattermostServerInfo | null;
};

type FieldErrors = { url?: string; channel_label?: string };

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
    const [busy, setBusy] = useState(false);
    const [url, setUrl] = useState('');
    const [channelLabel, setChannelLabel] = useState('');
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

    const destination =
        connection?.settings.channelLabel ?? connection?.settings.host ?? '';

    return (
        <IntegrationCard
            icon={isTeams ? MessagesSquare : MessageCircle}
            card={card}
            actions={
                connection === null ? (
                    <Button size="sm" onClick={openDialog}>
                        {t('Connect')}
                    </Button>
                ) : (
                    <>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={openDialog}
                        >
                            {t('Replace URL')}
                        </Button>
                        {connection.status === 'active' && (
                            <TestConnectionButton
                                scope={scope}
                                connection={connection}
                                label={t('Send a test message')}
                                successMessage={t('Test message sent.')}
                            />
                        )}
                        <DisconnectIntegrationDialog
                            scope={scope}
                            card={card}
                            connection={connection}
                            description={t(
                                'Nothing is posted to :channel anymore. Delete the webhook in :provider if you no longer need it.',
                                { channel: destination, provider: card.label },
                            )}
                        />
                    </>
                )
            }
        >
            {connection === null ? (
                <p className="text-sm text-muted-foreground">{description}</p>
            ) : (
                <IntegrationDetails
                    connection={connection}
                    rows={[
                        { label: t('Host'), value: connection.settings.host },
                        {
                            label: t('Channel'),
                            value: connection.settings.channelLabel ?? '—',
                        },
                    ]}
                />
            )}
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
                        <DialogDescription>{help}</DialogDescription>
                        <div className="space-y-2">
                            <Label htmlFor={urlId}>{t('Webhook URL')}</Label>
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
                                {t('Channel label (optional)')}
                            </Label>
                            <Input
                                id={labelId}
                                maxLength={80}
                                autoComplete="off"
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
