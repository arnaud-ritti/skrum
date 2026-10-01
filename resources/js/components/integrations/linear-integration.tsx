import { ListTodo } from 'lucide-react';
import { useTrans } from '@/hooks/use-trans';
import type { IntegrationProviderCard, IntegrationScope } from '@/types';
import { DisconnectIntegrationDialog } from './disconnect-integration-dialog';
import { ConnectLink, TestConnectionButton } from './integration-actions';
import { IntegrationCard } from './integration-card';
import { IntegrationDetails } from './integration-details';
import { PeoplePanel } from './people-panel';
import { PrioritiesPanel } from './priorities-panel';
import { StatusSyncSection } from './status-sync-section';

type Props = {
    card: IntegrationProviderCard;
    scope: IntegrationScope;
};

export function LinearIntegration({ card, scope }: Props) {
    const { t } = useTrans();
    const connection = card.connection;

    if (connection === null) {
        return (
            <IntegrationCard
                icon={ListTodo}
                card={card}
                actions={
                    <>
                        <ConnectLink
                            scope={scope}
                            provider="linear"
                            access="read"
                            label={t('Connect (read only)')}
                            variant="outline"
                        />
                        <ConnectLink
                            scope={scope}
                            provider="linear"
                            access="write"
                            label={t('Connect (read and write)')}
                        />
                    </>
                }
            >
                <p className="text-sm text-muted-foreground">
                    {t(
                        'Import issues into planning poker. With write access, estimates are written back and action items can be exported.',
                    )}
                </p>
            </IntegrationCard>
        );
    }

    return (
        <IntegrationCard
            icon={ListTodo}
            card={card}
            actions={
                <>
                    <ConnectLink
                        scope={scope}
                        provider="linear"
                        access={connection.access}
                        label={t('Reconnect')}
                        variant="outline"
                    />
                    {connection.access === 'read' && (
                        <ConnectLink
                            scope={scope}
                            provider="linear"
                            access="write"
                            label={t('Upgrade to read and write')}
                            variant="outline"
                        />
                    )}
                    {connection.status === 'active' && (
                        <TestConnectionButton
                            scope={scope}
                            connection={connection}
                            label={t('Test the connection')}
                            successMessage={t('The connection works.')}
                        />
                    )}
                    <DisconnectIntegrationDialog
                        scope={scope}
                        card={card}
                        connection={connection}
                        description={t(
                            'Imported tasks and exported issues keep their links but are no longer synced, and the people and priority mappings are deleted. skrum revokes its Linear access.',
                        )}
                    />
                </>
            }
        >
            <IntegrationDetails
                connection={connection}
                rows={[
                    {
                        label: t('Linear workspace'),
                        value: connection.settings.organizationName,
                    },
                    {
                        label: t('Access'),
                        value:
                            connection.access === 'write'
                                ? t('Read and write')
                                : t('Read only'),
                    },
                ]}
            />
            {connection.status === 'active' &&
                connection.access === 'write' && (
                    <>
                        <PeoplePanel
                            scope={scope}
                            connection={connection}
                            providerLabel={card.label}
                        />
                        <PrioritiesPanel
                            scope={scope}
                            connection={connection}
                        />
                    </>
                )}
            {connection.status === 'active' && (
                <StatusSyncSection
                    scope={scope}
                    card={card}
                    connection={connection}
                />
            )}
        </IntegrationCard>
    );
}
