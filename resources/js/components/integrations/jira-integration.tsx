import { router } from '@inertiajs/react';
import { ListChecks } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import { integrationErrorMessage } from '@/lib/integrations';
import { retroRequest } from '@/lib/retro/api';
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
import { StoryPointsField } from './story-points-field';
import { TrackerIntro, TrackerLink } from './tracker-parts';

type Props = {
    card: IntegrationProviderCard;
    scope: IntegrationScope;
};

/**
 * Both states return the same `ProviderCard`: the row, its switch and its open
 * sheet outlive a connection that appears or goes.
 */
export function JiraIntegration({ card, scope }: Props) {
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const connection = card.connection;

    if (connection === null) {
        return (
            <ProviderCard
                {...providerCardProps(card, ListChecks, t)}
                actions={
                    <>
                        <ConnectLink
                            scope={scope}
                            provider="jira"
                            access="read"
                            label={t('Connect (read only)')}
                            variant="outline"
                        />
                        <ConnectLink
                            scope={scope}
                            provider="jira"
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

    const { settings } = connection;
    const sites = settings.sites ?? [];
    const target = { ...scope, integration: connection.id };
    const isSetup = connection.status === 'setup_required';

    const send = async (request: Promise<unknown>, successMessage: string) => {
        setBusy(true);

        try {
            await request;
            toast.success(successMessage);
            router.reload({ only: ['providers'] });
        } catch (error) {
            toast.error(
                integrationErrorMessage(error, t('Something went wrong.')),
            );
        } finally {
            setBusy(false);
        }
    };

    const chooseSite = (cloudId: string) =>
        void send(
            retroRequest(TeamIntegrationsController.update(target), {
                cloud_id: cloudId,
            }),
            t('Jira connected.'),
        );

    const disconnect = (control?: DisconnectControl) => (
        <DisconnectIntegrationDialog
            scope={scope}
            card={card}
            connection={connection}
            description={t(
                'Imported tasks and exported issues keep their links but are no longer synced, and the people and priority mappings are deleted. Atlassian does not let skrum revoke its access: remove the app under "Connected apps" in your Atlassian account settings.',
            )}
            control={control}
        />
    );

    return (
        <ProviderCard
            {...providerCardProps(card, ListChecks, t)}
            disconnect={disconnect}
            details={
                !isSetup && (
                    <ProviderDetails
                        connection={connection}
                        rows={[
                            {
                                label: t('Jira site'),
                                value: settings.siteUrl ? (
                                    <TrackerLink href={settings.siteUrl}>
                                        {settings.siteName}
                                    </TrackerLink>
                                ) : (
                                    settings.siteName
                                ),
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
                )
            }
            actions={
                <>
                    <ConnectLink
                        scope={scope}
                        provider="jira"
                        access={connection.access}
                        label={t('Reconnect')}
                        variant="outline"
                    />
                    {connection.access === 'read' && (
                        <ConnectLink
                            scope={scope}
                            provider="jira"
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
            {isSetup && (
                <div
                    data-slot="jira-site-choice"
                    className="flex min-w-0 flex-col gap-1.5"
                >
                    <p className="text-sm font-medium">
                        {t('Choose the Jira site this team uses:')}
                    </p>
                    <Select disabled={busy} onValueChange={chooseSite}>
                        <SelectTrigger
                            className="w-full sm:w-72"
                            aria-label={t('Jira site')}
                        >
                            <SelectValue placeholder={t('Choose a site')} />
                        </SelectTrigger>
                        <SelectContent>
                            {sites.map((site) => (
                                <SelectItem
                                    key={site.cloudId}
                                    value={site.cloudId}
                                >
                                    {site.name} ({site.url})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
            {!isSetup && (
                <StoryPointsField scope={scope} connection={connection} />
            )}
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
