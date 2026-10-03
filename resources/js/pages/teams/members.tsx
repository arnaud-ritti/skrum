import { Head } from '@inertiajs/react';
import { DefaultColumnsCard } from '@/components/team-settings/default-columns-card';
import { DefaultFacilitatorsCard } from '@/components/team-settings/default-facilitators-card';
import { MembersTable } from '@/components/team-settings/members-table';
import { RetroTemplatesCard } from '@/components/team-settings/retro-templates-card';
import { SprintsCard } from '@/components/team-settings/sprints-card';
import { TeamSettingsShell } from '@/components/team-settings/team-settings-shell';
import { useTrans } from '@/hooks/use-trans';
import type {
    CatalogueTemplate,
    CategoryOption,
    TeamFacilitatorsPanel,
    TeamMember,
    TeamRituals,
    TeamRoleOption,
    TeamSettingsMember,
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
    members: TeamSettingsMember[];
    canManageMembers: boolean;
    roleOptions: TeamRoleOption[];
    availableMembers: TeamMember[];
    sprints: TeamSprintsPanel;
    rituals: TeamRituals;
    facilitators: TeamFacilitatorsPanel;
    templates: TeamTemplateUsageRow[];
    defaultRetroTemplate: string | null;
    defaultRetroTemplateUnavailable: boolean;
    categories: CategoryOption[];
    catalogue?: CatalogueTemplate[];
};

/**
 * Members & rituals (ScreenSettings frame a): the members table and the
 * sprints on the left, the facilitators and the templates on the right, the
 * default columns under both.
 */
export default function TeamMembersPage({
    workspace,
    team,
    createdAt,
    sections,
    members,
    canManageMembers,
    roleOptions,
    sprints,
    rituals,
    facilitators,
    templates,
    defaultRetroTemplate,
    defaultRetroTemplateUnavailable,
    categories,
    catalogue,
}: Props) {
    const { t } = useTrans();
    const defaultTemplate = templates.find((template) => template.isDefault);

    return (
        <TeamSettingsShell
            workspace={workspace}
            team={team}
            active="members"
            sections={sections}
            createdAt={createdAt}
            membersCount={members.length}
        >
            <Head title={t('Members & rituals')} />
            <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[5fr_4fr]">
                <div className="flex min-w-0 flex-col gap-5">
                    <MembersTable
                        workspaceSlug={workspace.slug}
                        team={team}
                        members={members}
                        canManageMembers={canManageMembers}
                        roleOptions={roleOptions}
                    />
                    <SprintsCard
                        workspaceSlug={workspace.slug}
                        team={team}
                        sprints={sprints}
                        rituals={rituals}
                    />
                </div>
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
        </TeamSettingsShell>
    );
}
