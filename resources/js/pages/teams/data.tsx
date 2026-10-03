import { Head } from '@inertiajs/react';
import { DataExport } from '@/components/team-settings/data-export';
import type { ClosedTeamSurvey } from '@/components/team-settings/data-export';
import { TeamSettingsShell } from '@/components/team-settings/team-settings-shell';
import { useTrans } from '@/hooks/use-trans';
import type {
    TeamSettingsSections,
    TeamSummary,
    WorkspaceSummary,
} from '@/types';

type Props = {
    workspace: WorkspaceSummary;
    team: TeamSummary & { description: string | null };
    createdAt: string | null;
    membersCount: number;
    sections: TeamSettingsSections;
    closedSurveys: ClosedTeamSurvey[];
    estimatesUrl: string;
    actionItemsUrl: string;
};

export default function TeamDataPage({
    workspace,
    team,
    createdAt,
    membersCount,
    sections,
    closedSurveys,
    estimatesUrl,
    actionItemsUrl,
}: Props) {
    const { t } = useTrans();

    return (
        <TeamSettingsShell
            workspace={workspace}
            team={team}
            active="data"
            sections={sections}
            createdAt={createdAt}
            membersCount={membersCount}
        >
            <Head title={t('Data & export')} />
            <DataExport
                closedSurveys={closedSurveys}
                estimatesUrl={estimatesUrl}
                actionItemsUrl={actionItemsUrl}
            />
        </TeamSettingsShell>
    );
}
