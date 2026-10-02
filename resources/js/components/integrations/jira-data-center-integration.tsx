import { usePage } from '@inertiajs/react';
import { ExternalLink, ServerCog, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTrans } from '@/hooks/use-trans';
import type {
    IntegrationProviderCard,
    IntegrationScope,
    TeamIntegration,
} from '@/types';
import { DisconnectIntegrationDialog } from './disconnect-integration-dialog';
import { ConnectLink, TestConnectionButton } from './integration-actions';
import {
    ProviderCard,
    ProviderDetails,
    providerCardProps,
} from './provider-card';
import { JiraTokenDialog } from './jira-token-dialog';
import { PeoplePanel } from './people-panel';
import { PrioritiesPanel } from './priorities-panel';
import { StoryPointsField } from './story-points-field';

type Props = {
    card: IntegrationProviderCard;
    scope: IntegrationScope;
    statusSection?: ReactNode;
};

/**
 * Spec 8 §4.1: OAuth is the primary way in; a personal access token is
 * the fallback for older servers and is clearly labelled as acting as its
 * owner.
 */
export function JiraDataCenterIntegration({
    card,
    scope,
    statusSection,
}: Props) {
    const { t } = useTrans();
    const connection = card.connection;
    const allowsOAuth = card.authMethods.includes('oauth');
    const allowsToken = card.authMethods.includes('pat');

    if (connection === null) {
        return (
            <ProviderCard
                {...providerCardProps(card, ServerCog, t)}
                actions={
                    <>
                        {allowsOAuth && (
                            <>
                                <ConnectLink
                                    scope={scope}
                                    provider="jira_dc"
                                    access="read"
                                    label={t('Connect (read only)')}
                                    variant="outline"
                                />
                                <ConnectLink
                                    scope={scope}
                                    provider="jira_dc"
                                    access="write"
                                    label={t('Connect (read and write)')}
                                />
                            </>
                        )}
                        {allowsToken && (
                            <JiraTokenDialog
                                scope={scope}
                                label={
                                    allowsOAuth
                                        ? t(
                                              'Older Jira server? Use a personal access token',
                                          )
                                        : t('Use a personal access token')
                                }
                                variant={allowsOAuth ? 'link' : 'default'}
                            />
                        )}
                    </>
                }
            >
                <p className="text-sm text-muted-foreground">
                    {t(
                        'Import issues into planning poker. With write access, estimates are written back and action items can be exported.',
                    )}
                </p>
            </ProviderCard>
        );
    }

    return (
        <ConnectedJiraDataCenter
            card={card}
            scope={scope}
            connection={connection}
            statusSection={statusSection}
        />
    );
}

function ConnectedJiraDataCenter({
    card,
    scope,
    connection,
    statusSection,
}: Props & { connection: TeamIntegration }) {
    const { t } = useTrans();
    const { locale } = usePage().props;
    const { settings } = connection;
    const usesToken = settings.authMethod === 'pat';
    const allowsOAuth = card.authMethods.includes('oauth');
    const allowsToken = card.authMethods.includes('pat');
    const owner = settings.tokenOwner ?? '';
    const active = connection.status === 'active';
    const savedOn = settings.tokenSavedAt
        ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
              new Date(settings.tokenSavedAt),
          )
        : '';

    return (
        <ProviderCard
            {...providerCardProps(card, ServerCog, t)}
            actions={
                <>
                    {usesToken && allowsToken && (
                        <JiraTokenDialog
                            scope={scope}
                            label={t('Replace token')}
                            variant="outline"
                        />
                    )}
                    {!usesToken && allowsOAuth && (
                        <>
                            <ConnectLink
                                scope={scope}
                                provider="jira_dc"
                                access={connection.access}
                                label={t('Reconnect')}
                                variant="outline"
                            />
                            {connection.access === 'read' && (
                                <ConnectLink
                                    scope={scope}
                                    provider="jira_dc"
                                    access="write"
                                    label={t('Upgrade to read and write')}
                                    variant="outline"
                                />
                            )}
                        </>
                    )}
                    {active && (
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
                        label={usesToken ? t('Remove token') : undefined}
                        title={usesToken ? t('Remove the token?') : undefined}
                        description={
                            usesToken
                                ? t(
                                      'skrum deletes the token. Ask :name to also revoke it in Jira under Profile → Personal Access Tokens.',
                                      { name: owner },
                                  )
                                : t(
                                      'Imported tasks and exported issues keep their links but are no longer synced, and the people and priority mappings are deleted. Also revoke skrum under "Authorized applications" in your Jira profile.',
                                  )
                        }
                    />
                </>
            }
        >
            {usesToken && (
                <div
                    role="note"
                    className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
                >
                    <TriangleAlert
                        className="mt-0.5 size-4 shrink-0 text-amber-600"
                        aria-hidden
                    />
                    <div className="space-y-1">
                        <p className="font-medium">
                            {t('Acting as :name in Jira', { name: owner })}
                        </p>
                        <p>
                            {t(
                                'This token acts as :name in Jira. Everything skrum does — imports, estimates, exported issues, status changes — will appear as done by :name, and skrum sees only what :name can see. Prefer OAuth when your Jira supports it.',
                                { name: owner },
                            )}
                        </p>
                        <p className="text-muted-foreground">
                            {t('Token saved on :date', { date: savedOn })}
                        </p>
                    </div>
                </div>
            )}
            <ProviderDetails
                connection={connection}
                rows={[
                    {
                        label: t('Jira server'),
                        value: settings.baseUrl ? (
                            <a
                                href={settings.baseUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 underline"
                            >
                                {settings.serverTitle}
                                <ExternalLink className="size-3" aria-hidden />
                            </a>
                        ) : (
                            settings.serverTitle
                        ),
                    },
                    { label: t('Version'), value: settings.version ?? '—' },
                    {
                        label: t('Access'),
                        value:
                            connection.access === 'write'
                                ? t('Read and write')
                                : t('Read only'),
                    },
                    {
                        label: t('Signed in with'),
                        value: usesToken ? t('Personal access token') : 'OAuth',
                    },
                ]}
            />
            <StoryPointsField scope={scope} connection={connection} />
            {active && connection.access === 'write' && (
                <>
                    <PeoplePanel
                        scope={scope}
                        connection={connection}
                        providerLabel={card.label}
                    />
                    <PrioritiesPanel scope={scope} connection={connection} />
                </>
            )}
            {active && statusSection}
        </ProviderCard>
    );
}
