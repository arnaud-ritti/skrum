import { Head } from '@inertiajs/react';
import { GeneralSettings } from '@/components/team-settings/general-settings';
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
    canDelete: boolean;
    sections: TeamSettingsSections;
};

export default function TeamSettingsPage({
    workspace,
    team,
    createdAt,
    membersCount,
    canDelete,
    sections,
}: Props) {
    const { t } = useTrans();

    return (
        <TeamSettingsShell
            workspace={workspace}
            team={team}
            active="general"
            sections={sections}
            createdAt={createdAt}
            membersCount={membersCount}
        >
            <Head title={t('Team settings')} />
            <GeneralSettings
                workspaceSlug={workspace.slug}
                team={team}
                canDelete={canDelete}
            />
        </TeamSettingsShell>
    );
}
