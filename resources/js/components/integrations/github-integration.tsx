import { Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useTrans } from '@/hooks/use-trans';
import type { IntegrationProviderCard, IntegrationScope } from '@/types';
import { DisconnectIntegrationDialog } from './disconnect-integration-dialog';
import { GitHubPriorityLabels } from './github-priority-labels';
import { ConnectLink, TestConnectionButton } from './integration-actions';
import {
    ProviderCard,
    ProviderDetails,
    providerCardProps,
} from './provider-card';
import type { DisconnectControl } from './provider-card';
import { PeoplePanel } from './people-panel';
import { TrackerIntro, TrackerLink } from './tracker-parts';

type Props = {
    card: IntegrationProviderCard;
    scope: IntegrationScope;
    statusSection?: ReactNode;
};

/**
 * Spec 8 §4.2: the team connects one installation of the GitHub App; its
 * permissions decide the access. Disconnecting keeps the app installed,
 * since other teams may use it.
 */
export function GitHubIntegration({ card, scope, statusSection }: Props) {
    const { t } = useTrans();
    const connection = card.connection;

    if (connection === null) {
        return (
            <ProviderCard
                {...providerCardProps(card, t)}
                actions={
                    <ConnectLink
                        scope={scope}
                        provider="github"
                        label={t('Install the GitHub App')}
                    />
                }
            >
                <TrackerIntro>
                    {t(
                        'Import issues into planning poker by milestone or search, write estimates into issue descriptions and export action items.',
                    )}
                </TrackerIntro>
            </ProviderCard>
        );
    }

    const { settings } = connection;
    const account = settings.accountLogin ?? '';
    const installationUrl =
        settings.accountType === 'Organization'
            ? `https://github.com/organizations/${account}/settings/installations/${settings.installationId}`
            : `https://github.com/settings/installations/${settings.installationId}`;
    const active = connection.status === 'active';

    const disconnect = (control?: DisconnectControl) => (
        <DisconnectIntegrationDialog
            scope={scope}
            card={card}
            connection={connection}
            description={t(
                'Imported tasks and exported issues keep their links but are no longer synced, and the people mappings are deleted. The GitHub App stays installed on :account: uninstall it there if no other team uses it.',
                { account },
            )}
            control={control}
        />
    );

    return (
        <ProviderCard
            {...providerCardProps(card, t)}
            disconnect={disconnect}
            details={
                <ProviderDetails
                    connection={connection}
                    rows={[
                        {
                            label: t('GitHub account'),
                            value: (
                                <TrackerLink href={installationUrl}>
                                    {account}
                                </TrackerLink>
                            ),
                        },
                        {
                            label: t('Access'),
                            value:
                                connection.access === 'write'
                                    ? t('Read and write')
                                    : t('Read only'),
                        },
                        ...(settings.exportRepositoryName
                            ? [
                                  {
                                      label: t('Export repository'),
                                      value: settings.exportRepositoryName,
                                  },
                              ]
                            : []),
                    ]}
                />
            }
            actions={
                <>
                    <ConnectLink
                        scope={scope}
                        provider="github"
                        label={t('Manage the installation')}
                        variant="outline"
                    />
                    {active && (
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
            {connection.access === 'read' && (
                <Alert variant="info">
                    <Info aria-hidden="true" />
                    <AlertDescription>
                        {t(
                            'This installation can only read issues. Give the app "Issues: read and write" on GitHub to write estimates and export action items.',
                        )}
                    </AlertDescription>
                </Alert>
            )}
            {active && connection.access === 'write' && (
                <>
                    <PeoplePanel
                        scope={scope}
                        connection={connection}
                        providerLabel={card.label}
                    />
                    <GitHubPriorityLabels
                        scope={scope}
                        connection={connection}
                    />
                </>
            )}
            {active && statusSection}
        </ProviderCard>
    );
}
