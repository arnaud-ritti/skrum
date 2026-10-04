import { Head } from '@inertiajs/react';
import { Link2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { TeamInviteDialog } from '@/components/invitations/team-invite-dialog';
import { DefaultColumnsCard } from '@/components/team-settings/default-columns-card';
import { DefaultFacilitatorsCard } from '@/components/team-settings/default-facilitators-card';
import { MembersTable } from '@/components/team-settings/members-table';
import { RetroTemplatesCard } from '@/components/team-settings/retro-templates-card';
import { SprintsCard } from '@/components/team-settings/sprints-card';
import { TeamSettingsShell } from '@/components/team-settings/team-settings-shell';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import type {
    InviteLink,
    PendingInvitation,
    TeamRoleValue,
} from '@/lib/invitations/types';
import type {
    CatalogueTemplate,
    CategoryOption,
    TeamFacilitatorsPanel,
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
    sprints: TeamSprintsPanel;
    rituals: TeamRituals;
    facilitators: TeamFacilitatorsPanel;
    templates: TeamTemplateUsageRow[];
    defaultRetroTemplate: string | null;
    defaultRetroTemplateUnavailable: boolean;
    categories: CategoryOption[];
    catalogue?: CatalogueTemplate[];
    /** The team's inviters: who manages its members, and its facilitators (decision 2 B). */
    canInvite: boolean;
    inviteRoles: TeamRoleValue[];
    /** Optional: loaded when the invite dialog opens. */
    inviteLink?: InviteLink | null;
    pendingInvitations: PendingInvitation[];
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
    canInvite,
    inviteRoles,
    inviteLink,
    pendingInvitations,
}: Props) {
    const { t } = useTrans();
    const defaultTemplate = templates.find((template) => template.isDefault);
    const [inviting, setInviting] = useState<'form' | 'link' | null>(null);
    const inviteActions = canInvite ? (
        <>
            <Button
                variant="outline"
                size="sm"
                onClick={() => setInviting('link')}
            >
                <Link2 aria-hidden />
                <span>{t('Invitation link')}</span>
            </Button>
            <Button size="sm" onClick={() => setInviting('form')}>
                <UserPlus aria-hidden />
                <span>{t('Invite')}</span>
            </Button>
        </>
    ) : undefined;

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
            <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[5fr_4fr] xl:[&>#members]:col-span-2">
                <MembersTable
                    workspaceSlug={workspace.slug}
                    team={team}
                    members={members}
                    canManageMembers={canManageMembers}
                    roleOptions={roleOptions}
                    invitations={pendingInvitations}
                    actions={inviteActions}
                />
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
            {canInvite && (
                <TeamInviteDialog
                    workspaceSlug={workspace.slug}
                    team={team}
                    roles={inviteRoles}
                    inviteLink={inviteLink}
                    open={inviting !== null}
                    onOpenChange={(open) => {
                        if (!open) {
                            setInviting(null);
                        }
                    }}
                    focusLink={inviting === 'link'}
                />
            )}
        </TeamSettingsShell>
    );
}
