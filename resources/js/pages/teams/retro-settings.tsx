import { Head } from '@inertiajs/react';
import { DefaultColumnsCard } from '@/components/team-settings/default-columns-card';
import { DefaultFacilitatorsCard } from '@/components/team-settings/default-facilitators-card';
import { RetroTemplatesCard } from '@/components/team-settings/retro-templates-card';
import { TeamSettingsShell } from '@/components/team-settings/team-settings-shell';
import { useTrans } from '@/hooks/use-trans';
import type {
    CatalogueTemplate,
    CategoryOption,
    NextRetro,
    TeamFacilitatorsPanel,
    TeamSettingsSections,
    TeamSummary,
    TeamTemplateUsageRow,
    WorkspaceSummary,
} from '@/types';

type Props = {
    workspace: WorkspaceSummary;
    team: TeamSummary & { description: string | null };
    createdAt: string | null;
    sections: TeamSettingsSections;
    /** The next retro of the team's calendar: the rotation says who facilitates it. */
    nextRetro: NextRetro | null;
    facilitators: TeamFacilitatorsPanel;
    templates: TeamTemplateUsageRow[];
    defaultRetroTemplate: string | null;
    defaultRetroTemplateUnavailable: boolean;
    categories: CategoryOption[];
    catalogue?: CatalogueTemplate[];
};

/** The Retrospectives section of the team settings: who facilitates, the templates and the default columns. */
export default function TeamRetroSettingsPage({
    workspace,
    team,
    createdAt,
    sections,
    nextRetro,
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
            active="retros"
            sections={sections}
            createdAt={createdAt}
        >
            <Head title={t('Retrospectives')} />
            <DefaultFacilitatorsCard
                workspaceSlug={workspace.slug}
                team={team}
                facilitators={facilitators}
                nextRetro={nextRetro}
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
