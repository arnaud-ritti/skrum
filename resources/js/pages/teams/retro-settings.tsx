import { Head } from '@inertiajs/react';
import { DefaultColumnsCard } from '@/components/team-settings/default-columns-card';
import { DefaultFacilitatorsCard } from '@/components/team-settings/default-facilitators-card';
import { RetroTemplatesCard } from '@/components/team-settings/retro-templates-card';
import { SprintsCard } from '@/components/team-settings/sprints-card';
import { TeamSettingsShell } from '@/components/team-settings/team-settings-shell';
import { TeamHealthManager } from '@/components/teams/team-health-manager';
import { useTrans } from '@/hooks/use-trans';
import type {
    CatalogueTemplate,
    CategoryOption,
    TeamFacilitatorsPanel,
    TeamHealthStatement,
    TeamRituals,
    TeamSettingsSections,
    TeamSprintsPanel,
    TeamSummary,
    TeamTemplateUsageRow,
    WorkspaceSummary,
} from '@/types';

type Props = {
    workspace: WorkspaceSummary;
    team: TeamSummary & { description: string | null };
    createdAt: string | null;
    sections: TeamSettingsSections;
    sprints: TeamSprintsPanel;
    rituals: TeamRituals;
    facilitators: TeamFacilitatorsPanel;
    templates: TeamTemplateUsageRow[];
    defaultRetroTemplate: string | null;
    defaultRetroTemplateUnavailable: boolean;
    categories: CategoryOption[];
    catalogue?: CatalogueTemplate[];
    healthStatements: TeamHealthStatement[];
    /** Who may open Rituals may not always edit the statements: they then read them. */
    canManageHealthStatements: boolean;
};

/**
 * The Rituals section of the team settings: the sprints on the left, the
 * facilitators and the templates on the right, the default columns and the
 * health check statements under both.
 */
export default function TeamRitualsPage({
    workspace,
    team,
    createdAt,
    sections,
    sprints,
    rituals,
    facilitators,
    templates,
    defaultRetroTemplate,
    defaultRetroTemplateUnavailable,
    categories,
    catalogue,
    healthStatements,
    canManageHealthStatements,
}: Props) {
    const { t } = useTrans();
    const defaultTemplate = templates.find((template) => template.isDefault);

    return (
        <TeamSettingsShell
            workspace={workspace}
            team={team}
            active="rituals"
            sections={sections}
            createdAt={createdAt}
        >
            <Head title={t('Rituals')} />
            <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[5fr_4fr]">
                <SprintsCard
                    workspaceSlug={workspace.slug}
                    team={team}
                    sprints={sprints}
                    rituals={rituals}
                />
                <div className="flex min-w-0 flex-col gap-5">
                    <DefaultFacilitatorsCard
                        workspaceSlug={workspace.slug}
                        team={team}
                        facilitators={facilitators}
                        nextRetro={sprints.nextRetro}
                    />
                    <RetroTemplatesCard
                        workspace={workspace}
                        team={team}
                        templates={templates}
                        defaultTemplate={defaultRetroTemplate}
                        defaultUnavailable={defaultRetroTemplateUnavailable}
                        categories={categories}
                        catalogue={catalogue}
                    />
                </div>
            </div>
            {defaultTemplate !== undefined && (
                <DefaultColumnsCard
                    key={`${defaultTemplate.key}:${JSON.stringify(defaultTemplate.columns)}`}
                    workspaceSlug={workspace.slug}
                    team={team}
                    template={defaultTemplate}
                />
            )}
            <TeamHealthManager
                workspaceSlug={workspace.slug}
                teamId={team.id}
                statements={healthStatements}
                canManage={canManageHealthStatements}
            />
        </TeamSettingsShell>
    );
}
