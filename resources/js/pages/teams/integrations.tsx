import { Head, Link } from '@inertiajs/react';
import TeamsController from '@/actions/App/Http/Controllers/TeamsController';
import Heading from '@/components/heading';
import { GitHubIntegration } from '@/components/integrations/github-integration';
import { JiraDataCenterIntegration } from '@/components/integrations/jira-data-center-integration';
import { JiraIntegration } from '@/components/integrations/jira-integration';
import { LinearIntegration } from '@/components/integrations/linear-integration';
import { SlackIntegration } from '@/components/integrations/slack-integration';
import { StatusSyncSection } from '@/components/integrations/status-sync-section';
import { UrlChannelIntegration } from '@/components/integrations/url-channel-integration';
import { WebhookIntegration } from '@/components/integrations/webhook-integration';
import { TelegramIntegration } from '@/components/integrations/telegram-integration';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type {
    IntegrationProviderCard,
    IntegrationScope,
    MattermostServerInfo,
    StatusSyncPageProps,
    TeamSummary,
    TelegramBotInfo,
    WebhookEventOption,
    WorkspaceSummary,
} from '@/types';

type Props = {
    workspace: WorkspaceSummary;
    team: TeamSummary;
    providers: IntegrationProviderCard[];
    telegram: TelegramBotInfo | null;
    mattermost: MattermostServerInfo | null;
    webhookEvents: WebhookEventOption[] | null;
} & StatusSyncPageProps;

export default function TeamIntegrations({
    workspace,
    team,
    providers,
    telegram,
    mattermost,
    webhookEvents,
}: Props) {
    const { t } = useTrans();
    const scope: IntegrationScope = {
        workspace: workspace.slug,
        team: team.id,
    };

    return (
        <>
            <Head title={t('Integrations')} />
            <div className="max-w-2xl space-y-6 p-4">
                <Heading
                    title={t('Integrations')}
                    description={t(
                        'Connect :team to the tools it already uses.',
                        {
                            team: team.name,
                        },
                    )}
                />
                <Button variant="outline" size="sm" asChild>
                    <Link href={TeamsController.show(scope)}>
                        {t('Back to the team')}
                    </Link>
                </Button>
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
            </div>
        </>
    );
}
