import { ListTodo } from 'lucide-react';
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
import { PeoplePanel } from './people-panel';
import { PrioritiesPanel } from './priorities-panel';
import { StatusSyncSection } from './status-sync-section';
import { TrackerIntro } from './tracker-parts';

type Props = {
    card: IntegrationProviderCard;
    scope: IntegrationScope;
};

export function LinearIntegration({ card, scope }: Props) {
    const { t } = useTrans();
    const connection = card.connection;

    if (connection === null) {
        return (
            <ProviderCard
                {...providerCardProps(card, ListTodo, t)}
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
                <TrackerIntro>
                    {t(
                        'Import issues into planning poker. With write access, estimates are written back and action items can be exported.',
                    )}
                </TrackerIntro>
            </ProviderCard>
        );
    }

    const disconnect = (control?: DisconnectControl) => (
        <DisconnectIntegrationDialog
            scope={scope}
            card={card}
            connection={connection}
            description={t(
                'Imported tasks and exported issues keep their links but are no longer synced, and the people and priority mappings are deleted. skrum revokes its Linear access.',
            )}
            control={control}
        />
    );

    return (
        <ProviderCard
            {...providerCardProps(card, ListTodo, t)}
            disconnect={disconnect}
            details={
                <ProviderDetails
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
            }
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
                    {disconnect()}
                </>
            }
        >
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
        </ProviderCard>
    );
}
