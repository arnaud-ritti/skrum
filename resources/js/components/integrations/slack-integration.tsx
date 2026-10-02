import { ExternalLink, Hash } from 'lucide-react';
import { useTrans } from '@/hooks/use-trans';
import type { IntegrationProviderCard, IntegrationScope } from '@/types';
import { DisconnectIntegrationDialog } from './disconnect-integration-dialog';
import { ConnectLink, TestConnectionButton } from './integration-actions';
import {
    ProviderCard,
    ProviderDetails,
    providerCardProps,
} from './provider-card';
import type { DisconnectControl } from './provider-card';

type Props = {
    card: IntegrationProviderCard;
    scope: IntegrationScope;
};

export function SlackIntegration({ card, scope }: Props) {
    const { t } = useTrans();
    const connection = card.connection;

    if (connection === null) {
        return (
            <ProviderCard
                {...providerCardProps(card, Hash, t)}
                actions={
                    <ConnectLink
                        scope={scope}
                        provider="slack"
                        label={t('Connect')}
                    />
                }
            >
                <p className="text-sm text-muted-foreground">
                    {t(
                        'Post board links and results to a Slack channel. Slack asks for the channel while connecting; reconnect to change it.',
                    )}
                </p>
            </ProviderCard>
        );
    }

    const { settings } = connection;

    const disconnect = (control?: DisconnectControl) => (
        <DisconnectIntegrationDialog
            scope={scope}
            card={card}
            connection={connection}
            description={t(
                'Posting to :channel stops and the Slack access is revoked.',
                { channel: settings.channelName ?? '' },
            )}
            control={control}
        />
    );

    return (
        <ProviderCard
            {...providerCardProps(card, Hash, t)}
            disconnect={disconnect}
            details={
                <ProviderDetails
                    connection={connection}
                    rows={[
                        {
                            label: t('Slack workspace'),
                            value: settings.teamName,
                        },
                        {
                            label: t('Channel'),
                            value: settings.configurationUrl ? (
                                <a
                                    href={settings.configurationUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex max-w-full items-center gap-1 rounded-xs underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                                >
                                    <span className="min-w-0 break-words">
                                        {settings.channelName}
                                    </span>
                                    <ExternalLink
                                        className="size-3 shrink-0"
                                        aria-hidden="true"
                                    />
                                </a>
                            ) : (
                                settings.channelName
                            ),
                        },
                    ]}
                />
            }
            actions={
                <>
                    <ConnectLink
                        scope={scope}
                        provider="slack"
                        label={t('Reconnect')}
                        variant="outline"
                    />
                    {connection.status === 'active' && (
                        <TestConnectionButton
                            scope={scope}
                            connection={connection}
                            label={t('Send a test message')}
                            successMessage={t('Test message sent.')}
                        />
                    )}
                    {disconnect()}
                </>
            }
        />
    );
}
