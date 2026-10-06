import { Head } from '@inertiajs/react';
import { TeamSettingsShell } from '@/components/team-settings/team-settings-shell';
import { TeamHealthManager } from '@/components/teams/team-health-manager';
import { useTrans } from '@/hooks/use-trans';
import type {
    TeamHealthStatement,
    TeamSettingsSections,
    TeamSummary,
    WorkspaceSummary,
} from '@/types';

type Props = {
    workspace: WorkspaceSummary;
    team: TeamSummary & { description: string | null };
    createdAt: string | null;
    sections: TeamSettingsSections;
    healthStatements: TeamHealthStatement[];
    /** Who may open this section may not always edit the statements: they then read them. */
    canManageHealthStatements: boolean;
};

/** The Health check section of the team settings: the statements every health check scores. */
export default function TeamHealthStatementsPage({
    workspace,
    team,
    createdAt,
    sections,
    healthStatements,
    canManageHealthStatements,
}: Props) {
    const { t } = useTrans();

    return (
        <TeamSettingsShell
            workspace={workspace}
            team={team}
            active="health"
            sections={sections}
            createdAt={createdAt}
        >
            <Head title={t('Health check')} />
            <TeamHealthManager
                workspaceSlug={workspace.slug}
                teamId={team.id}
                statements={healthStatements}
                canManage={canManageHealthStatements}
            />
        </TeamSettingsShell>
    );
}
