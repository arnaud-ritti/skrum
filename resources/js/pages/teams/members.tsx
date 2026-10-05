import { Head } from '@inertiajs/react';
import { Link2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { TeamInviteDialog } from '@/components/invitations/team-invite-dialog';
import { MembersTable } from '@/components/team-settings/members-table';
import { SettingsPanel } from '@/components/team-settings/settings-panel';
import { AddTeamMemberForm } from '@/components/teams/add-team-member-form';
import { Button } from '@/components/ui/button';
import { useTrans } from '@/hooks/use-trans';
import AppLayout from '@/layouts/skrum/app-layout';
import type {
    InviteLink,
    PendingInvitation,
    TeamRoleValue,
} from '@/lib/invitations/types';
import type {
    TeamMember,
    TeamRoleOption,
    TeamSettingsMember,
    TeamSummary,
    WorkspaceSummary,
} from '@/types';

type Props = {
    workspace: WorkspaceSummary;
    team: TeamSummary & { description: string | null };
    members: TeamSettingsMember[];
    canManageMembers: boolean;
    roleOptions: TeamRoleOption[];
    /** Members of the workspace who are not in the team; empty for who may not manage the members. */
    availableMembers: TeamMember[];
    /** The team's inviters: who manages its members, and its facilitators (decision 2 B). */
    canInvite: boolean;
    inviteRoles: TeamRoleValue[];
    /** Optional: loaded when the invite dialog opens. */
    inviteLink?: InviteLink | null;
    pendingInvitations: PendingInvitation[];
};

/**
 * The people of a team, open to every member: the table, the invitations and
 * the ways to bring someone in for who may.
 */
export default function TeamMembersPage({
    workspace,
    team,
    members,
    canManageMembers,
    roleOptions,
    availableMembers,
    canInvite,
    inviteRoles,
    inviteLink,
    pendingInvitations,
}: Props) {
    const { t } = useTrans();
    const [inviting, setInviting] = useState<'form' | 'link' | null>(null);

    return (
        <AppLayout active="members" title={t('Members')}>
            <Head title={`${t('Members')} · ${team.name}`} />
            <div
                data-slot="members-page"
                className="flex min-w-0 flex-col gap-6"
            >
                <header className="flex min-w-0 flex-wrap items-center justify-between gap-4">
                    <h1 className="min-w-0 font-display text-2xl font-bold tracking-heading wrap-anywhere">
                        {t('Members')}
                        <span className="font-medium text-muted-foreground">
                            {' · '}
                            {members.length}
                        </span>
                    </h1>
                    {canInvite && (
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setInviting('link')}
                            >
                                <Link2 aria-hidden />
                                <span>{t('Invitation link')}</span>
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => setInviting('form')}
                            >
                                <UserPlus aria-hidden />
                                <span>{t('Invite')}</span>
                            </Button>
                        </div>
                    )}
                </header>
                <MembersTable
                    workspaceSlug={workspace.slug}
                    team={team}
                    members={members}
                    canManageMembers={canManageMembers}
                    roleOptions={roleOptions}
                    invitations={pendingInvitations}
                />
                {canManageMembers && availableMembers.length > 0 && (
                    <SettingsPanel
                        id="add-member"
                        title={t('Add a member')}
                        className="max-w-140"
                    >
                        <AddTeamMemberForm
                            workspaceSlug={workspace.slug}
                            team={team}
                            availableMembers={availableMembers}
                            roleOptions={roleOptions}
                        />
                    </SettingsPanel>
                )}
            </div>
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
        </AppLayout>
    );
}
