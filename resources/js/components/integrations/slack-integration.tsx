import { ExternalLink, Hash } from 'lucide-react';
import { useTrans } from '@/hooks/use-trans';
import type { IntegrationProviderCard, IntegrationScope } from '@/types';
import { DisconnectIntegrationDialog } from './disconnect-integration-dialog';
import { ConnectLink, TestConnectionButton } from './integration-actions';
import { IntegrationCard } from './integration-card';
import { IntegrationDetails } from './integration-details';

type Props = {
    card: IntegrationProviderCard;
    scope: IntegrationScope;
};

export function SlackIntegration({ card, scope }: Props) {
    const { t } = useTrans();
    const connection = card.connection;

    if (connection === null) {
        return (
            <IntegrationCard
                icon={Hash}
                card={card}
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
            </IntegrationCard>
        );
    }

    const { settings } = connection;

    return (
        <IntegrationCard
            icon={Hash}
            card={card}
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
                    <DisconnectIntegrationDialog
                        scope={scope}
                        card={card}
                        connection={connection}
                        description={t(
                            'Posting to :channel stops and the Slack access is revoked.',
                            { channel: settings.channelName ?? '' },
                        )}
                    />
                </>
            }
        >
            <IntegrationDetails
                connection={connection}
                rows={[
                    { label: t('Slack workspace'), value: settings.teamName },
                    {
                        label: t('Channel'),
                        value: settings.configurationUrl ? (
                            <a
                                href={settings.configurationUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 underline"
                            >
                                {settings.channelName}
                                <ExternalLink className="size-3" aria-hidden />
                            </a>
                        ) : (
                            settings.channelName
                        ),
                    },
                ]}
            />
        </IntegrationCard>
    );
}
