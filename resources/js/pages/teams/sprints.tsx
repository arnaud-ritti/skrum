import { Head } from '@inertiajs/react';
import { SprintsCard } from '@/components/team-settings/sprints-card';
import { TeamSettingsShell } from '@/components/team-settings/team-settings-shell';
import { useTrans } from '@/hooks/use-trans';
import type {
    TeamRituals,
    TeamSettingsSections,
    TeamSprintsPanel,
    TeamSummary,
    WorkspaceSummary,
} from '@/types';

type Props = {
    workspace: WorkspaceSummary;
    team: TeamSummary & { description: string | null };
    createdAt: string | null;
    sections: TeamSettingsSections;
    sprints: TeamSprintsPanel;
    rituals: TeamRituals;
};

/** The Sprints section of the team settings: the sprints, the next one, their length and the retro day. */
export default function TeamSprintsPage({
    workspace,
    team,
    createdAt,
    sections,
    sprints,
    rituals,
}: Props) {
    const { t } = useTrans();

    return (
        <TeamSettingsShell
            workspace={workspace}
            team={team}
            active="sprints"
            sections={sections}
            createdAt={createdAt}
        >
            <Head title={t('Sprints')} />
            <SprintsCard
                workspaceSlug={workspace.slug}
                team={team}
                sprints={sprints}
                rituals={rituals}
            />
        </TeamSettingsShell>
    );
}
