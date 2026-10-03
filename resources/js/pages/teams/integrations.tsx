import { Head } from '@inertiajs/react';
import { useId } from 'react';
import { GitHubIntegration } from '@/components/integrations/github-integration';
import { JiraDataCenterIntegration } from '@/components/integrations/jira-data-center-integration';
import { JiraIntegration } from '@/components/integrations/jira-integration';
import { LinearIntegration } from '@/components/integrations/linear-integration';
import { SlackIntegration } from '@/components/integrations/slack-integration';
import { StatusSyncSection } from '@/components/integrations/status-sync-section';
import { UrlChannelIntegration } from '@/components/integrations/url-channel-integration';
import { WebhookIntegration } from '@/components/integrations/webhook-integration';
import { TelegramIntegration } from '@/components/integrations/telegram-integration';
import { TeamSettingsShell } from '@/components/team-settings/team-settings-shell';
import { Card } from '@/components/ui/card';
import { useTrans } from '@/hooks/use-trans';
import type {
    IntegrationProviderCard,
    IntegrationScope,
    MattermostServerInfo,
    StatusSyncPageProps,
    TeamSettingsSections,
    TeamSummary,
    TelegramBotInfo,
    WebhookEventOption,
    WorkspaceSummary,
} from '@/types';

type Props = {
    workspace: WorkspaceSummary;
    team: TeamSummary;
    sections: TeamSettingsSections;
    providers: IntegrationProviderCard[];
    telegram: TelegramBotInfo | null;
    mattermost: MattermostServerInfo | null;
    webhookEvents: WebhookEventOption[] | null;
} & StatusSyncPageProps;

export default function TeamIntegrations({
    workspace,
    team,
    sections,
    providers,
    telegram,
    mattermost,
    webhookEvents,
}: Props) {
    const { t } = useTrans();
    const titleId = useId();
    const scope: IntegrationScope = {
        workspace: workspace.slug,
        team: team.id,
    };

    return (
        <TeamSettingsShell
            workspace={workspace}
            team={team}
            active="integrations"
            sections={sections}
        >
            <Head title={t('Integrations')} />
            <section
                data-slot="team-integrations"
                aria-labelledby={titleId}
                className="flex min-w-0 flex-col gap-4"
            >
                <div className="flex flex-col gap-0.5">
                    <h2
                        id={titleId}
                        className="text-xl font-title tracking-heading"
                    >
                        {t('Integrations')}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {t('Connect :team to the tools it already uses.', {
                            team: team.name,
                        })}
                    </p>
                </div>
                <Card data-test="integration-list" className="divide-y">
                    {providers.map((card) => {
                        switch (card.provider) {
                            case 'slack':
                                return (
                                    <SlackIntegration
                                        key={card.provider}
                                        card={card}
                                        scope={scope}
                                    />
                                );
                            case 'telegram':
                                return (
                                    <TelegramIntegration
                                        key={card.provider}
                                        card={card}
                                        scope={scope}
                                        telegram={telegram}
                                    />
                                );
                            case 'jira':
                                return (
                                    <JiraIntegration
                                        key={card.provider}
                                        card={card}
                                        scope={scope}
                                    />
                                );
                            case 'linear':
                                return (
                                    <LinearIntegration
                                        key={card.provider}
                                        card={card}
                                        scope={scope}
                                    />
                                );
                            case 'msteams':
                            case 'mattermost':
                                return (
                                    <UrlChannelIntegration
                                        key={card.provider}
                                        card={card}
                                        scope={scope}
                                        mattermost={mattermost}
                                    />
                                );
                            case 'webhook':
                                return (
                                    <WebhookIntegration
                                        key={card.provider}
                                        card={card}
                                        scope={scope}
                                        events={webhookEvents ?? []}
                                    />
                                );
                            case 'jira_dc':
                                return (
                                    <JiraDataCenterIntegration
                                        key={card.provider}
                                        card={card}
                                        scope={scope}
                                        statusSection={
                                            card.connection && (
                                                <StatusSyncSection
                                                    scope={scope}
                                                    card={card}
                                                    connection={card.connection}
                                                />
                                            )
                                        }
                                    />
                                );
                            case 'github':
                                return (
                                    <GitHubIntegration
                                        key={card.provider}
                                        card={card}
                                        scope={scope}
                                        statusSection={
                                            card.connection && (
                                                <StatusSyncSection
                                                    scope={scope}
                                                    card={card}
                                                    connection={card.connection}
                                                />
                                            )
                                        }
                                    />
                                );
                            default:
                                return null;
                        }
                    })}
                </Card>
            </section>
        </TeamSettingsShell>
    );
}
