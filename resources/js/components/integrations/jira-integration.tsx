import { router } from '@inertiajs/react';
import { ExternalLink, ListChecks, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import JiraFieldDetectionsController from '@/actions/App/Http/Controllers/Integrations/JiraFieldDetectionsController';
import TeamIntegrationsController from '@/actions/App/Http/Controllers/Integrations/TeamIntegrationsController';
import { Button } from '@/components/ui/button';
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
import type {
    IntegrationProviderCard,
    IntegrationScope,
    TeamIntegration,
} from '@/types';
import { DisconnectIntegrationDialog } from './disconnect-integration-dialog';
import { ConnectLink, TestConnectionButton } from './integration-actions';
import { IntegrationCard } from './integration-card';
import { IntegrationDetails } from './integration-details';
import { PeoplePanel } from './people-panel';
import { PrioritiesPanel } from './priorities-panel';

type Props = {
    card: IntegrationProviderCard;
    scope: IntegrationScope;
};

export function JiraIntegration({ card, scope }: Props) {
    const { t } = useTrans();
    const connection = card.connection;

    if (connection === null) {
        return (
            <IntegrationCard
                icon={ListChecks}
                card={card}
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
                <p className="text-sm text-muted-foreground">
                    {t(
                        'Import issues into planning poker. With write access, estimates are written back and action items can be exported.',
                    )}
                </p>
            </IntegrationCard>
        );
    }

    return <ConnectedJira card={card} scope={scope} connection={connection} />;
}

function ConnectedJira({
    card,
    scope,
    connection,
}: Props & { connection: TeamIntegration }) {
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);
    const { settings } = connection;
    const sites = settings.sites ?? [];
    const numberFields = settings.numberFields ?? [];
    const storyPointFields = settings.storyPointFields ?? [];
    const target = { ...scope, integration: connection.id };

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

    const chooseField = (fieldId: string) =>
        void send(
            retroRequest(TeamIntegrationsController.update(target), {
                story_point_field_id: fieldId,
            }),
            t('Story points field saved.'),
        );

    const detect = () =>
        void send(
            retroRequest(JiraFieldDetectionsController.store(target)),
            t('Fields detected again.'),
        );

    return (
        <IntegrationCard
            icon={ListChecks}
            card={card}
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
                    <DisconnectIntegrationDialog
                        scope={scope}
                        card={card}
                        connection={connection}
                        description={t(
                            'Imported tasks and exported issues keep their links but are no longer synced, and the people and priority mappings are deleted. Atlassian does not let skrum revoke its access: remove the app under "Connected apps" in your Atlassian account settings.',
                        )}
                    />
                </>
            }
        >
            {connection.status === 'setup_required' ? (
                <div className="space-y-2">
                    <p className="text-sm">
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
            ) : (
                <>
                    <IntegrationDetails
                        connection={connection}
                        rows={[
                            {
                                label: t('Jira site'),
                                value: settings.siteUrl ? (
                                    <a
                                        href={settings.siteUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 underline"
                                    >
                                        {settings.siteName}
                                        <ExternalLink
                                            className="size-3"
                                            aria-hidden
                                        />
                                    </a>
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
                    <div className="space-y-2">
                        <p className="text-sm font-medium">
                            {t('Story points field')}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                            {numberFields.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    {t('No story points field found.')}
                                </p>
                            ) : (
                                <Select
                                    disabled={busy}
                                    value={storyPointFields[0]?.id}
                                    onValueChange={chooseField}
                                >
                                    <SelectTrigger
                                        className="w-full sm:w-72"
                                        aria-label={t('Story points field')}
                                    >
                                        <SelectValue
                                            placeholder={t('Choose a field')}
                                        />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {numberFields.map((field) => (
                                            <SelectItem
                                                key={field.id}
                                                value={field.id}
                                            >
                                                {field.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            {connection.status === 'active' && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={busy}
                                    onClick={detect}
                                >
                                    <RefreshCw className="size-4" aria-hidden />
                                    {t('Detect again')}
                                </Button>
                            )}
                        </div>
                    </div>
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
                </>
            )}
        </IntegrationCard>
    );
}
