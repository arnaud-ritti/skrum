import { router } from '@inertiajs/react';
import { DoorOpen, Ellipsis, UserMinus, UserPlus } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import WorkspaceMembersController from '@/actions/App/Http/Controllers/WorkspaceMembersController';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { PersonAvatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CardMenu } from '@/components/ui/dropdown-menu';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    InvitationLink,
    InvitationRows,
    RevokeInvitationDialog,
    useInvitationActions,
} from '@/components/workspaces/invitations-table';
import {
    InviteDialog,
    InviteMessageField,
    InviteTeamFields,
} from '@/components/workspaces/invite-form';
import type {
    InviteSlots,
    InviteTeamOption,
} from '@/components/workspaces/invite-form';
import { LeaveWorkspaceDialog } from '@/components/workspaces/leave-workspace-dialog';
import { MembersLayout } from '@/components/workspaces/members-layout';
import { useMenuDialogFocus } from '@/components/workspaces/use-menu-dialog-focus';
import { useRouterAction } from '@/components/workspaces/use-router-action';
import { useTrans } from '@/hooks/use-trans';
import type {
    PendingInvitation,
    TeamRole,
    WorkspaceMember,
    WorkspaceRole,
    WorkspaceSummary,
} from '@/types';

export type WorkspaceMembersProps = {
    workspace: WorkspaceSummary;
    members: WorkspaceMember[];
    invitations: PendingInvitation[];
    /** The teams an invitation may name. */
    teams: InviteTeamOption[];
    /** The team roles an invitation may give. */
    teamRoles: TeamRole[];
    /** How long the link of an invitation works, as the server sets it. */
    invitationValidForDays: number;
    isOwner: boolean;
};

/**
 * Places left for the features that come after the rewrite; nothing is
 * rendered while a slot is undefined.
 */
type MembersTableSlots = InviteSlots;

const ManagerRoles: readonly WorkspaceRole[] = ['owner', 'admin'];

function useRoleLabels(): Record<WorkspaceRole, string> {
    const { t } = useTrans();

    return {
        owner: t('Owner'),
        admin: t('Admin'),
        member: t('Member'),
    };
}

function MemberRow({
    member,
    isSelf,
    isOwner,
    error,
    onRoleChange,
    onRemove,
    onLeave,
}: {
    member: WorkspaceMember;
    isSelf: boolean;
    isOwner: boolean;
    error?: string;
    onRoleChange: (role: string) => void;
    onRemove: () => void;
    onLeave: () => void;
}) {
    const { t } = useTrans();
    const errorId = useId();
    const roleLabels = useRoleLabels();
    const isLocked = member.role === 'owner' && !isOwner;
    const assignableRoles: WorkspaceRole[] = isOwner
        ? ['owner', 'admin', 'member']
        : ['admin', 'member'];

    return (
        <TableRow
            data-slot="member-row"
            data-member-id={member.id}
            className={MembersLayout.row}
        >
            <TableCell className={MembersLayout.person}>
                <span className="flex min-w-0 items-center gap-2">
                    <PersonAvatar
                        name={member.name}
                        src={member.avatarUrl}
                        size="sm"
                        decorative
                    />
                    <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm leading-4.5 font-semibold">
                            {member.name}
                            {isSelf && (
                                <>
                                    {' '}
                                    <span className="font-medium text-muted-foreground">
                                        {t('(you)')}
                                    </span>
                                </>
                            )}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                            {member.email}
                        </span>
                    </span>
                </span>
            </TableCell>
            <TableCell className={MembersLayout.cell}>
                {isLocked ? (
                    <Badge variant="muted">{roleLabels.owner}</Badge>
                ) : (
                    <div className="flex min-w-0 flex-col gap-1">
                        <Select
                            value={member.role}
                            onValueChange={onRoleChange}
                        >
                            <SelectTrigger
                                size="sm"
                                aria-label={t('Role')}
                                aria-invalid={error ? true : undefined}
                                aria-describedby={error ? errorId : undefined}
                                className="w-40 max-w-full"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {assignableRoles.map((role) => (
                                    <SelectItem key={role} value={role}>
                                        {roleLabels[role]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {error && (
                            <p
                                id={errorId}
                                role="alert"
                                data-slot="member-role-error"
                                className="text-body-sm whitespace-normal text-skrum-destructive-text"
                            >
                                {error}
                            </p>
                        )}
                    </div>
                )}
            </TableCell>
            <TableCell className={MembersLayout.actions}>
                {!isLocked && (
                    <CardMenu
                        label={t('Actions for :name', { name: member.name })}
                        trigger={
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                data-member-menu
                                aria-label={t('Actions for :name', {
                                    name: member.name,
                                })}
                            >
                                <Ellipsis aria-hidden />
                            </Button>
                        }
                        entries={[
                            isSelf
                                ? {
                                      type: 'item',
                                      label: t('Leave'),
                                      icon: DoorOpen,
                                      tone: 'danger',
                                      onSelect: onLeave,
                                  }
                                : {
                                      type: 'item',
                                      label: t('Remove from workspace'),
                                      icon: UserMinus,
                                      tone: 'danger',
                                      onSelect: onRemove,
                                  },
                        ]}
                    />
                )}
            </TableCell>
        </TableRow>
    );
}

/**
 * The people of a workspace and the invitations that wait, in one table, as
 * the Members card of the settings mockup. Rendered for who manages members.
 */
export function MembersTable({
    workspace,
    members,
    invitations,
    teams,
    teamRoles,
    invitationValidForDays,
    isOwner,
    currentUserId,
    invitationUrl,
    locale = 'en',
    slots = {},
}: WorkspaceMembersProps & {
    currentUserId: string;
    /** The link of the invitation just sent, when no mail leaves the instance. */
    invitationUrl?: string;
    locale?: string;
    slots?: MembersTableSlots & {
        /** Backlog: "Invitation link", before "Invite" in the header. */
        headerAction?: ReactNode;
    };
}) {
    const { t } = useTrans();
    const headingId = useId();
    const sectionRef = useRef<HTMLElement>(null);
    const removal = useRouterAction();
    const invitationActions = useInvitationActions(workspace.slug);
    const [inviting, setInviting] = useState(false);
    const [leaving, setLeaving] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [removing, setRemoving] = useState<WorkspaceMember | null>(null);
    const {
        fallbackRef: headingRef,
        openedFrom,
        originRemoved,
    } = useMenuDialogFocus<HTMLHeadingElement>(confirming || leaving);
    const [roleError, setRoleError] = useState<{
        memberId: string;
        message: string;
    } | null>(null);

    const managers = members.filter((member) =>
        ManagerRoles.includes(member.role),
    );
    const viewerManages = managers.some(
        (member) => member.id === currentUserId,
    );
    const otherAdmin = managers.find((member) => member.id !== currentUserId);
    const pendingCount = invitations.filter(
        (invitation) => invitation.status === 'pending',
    ).length;

    const summary = [
        members.length === 1
            ? t('1 member')
            : t(':count members', { count: members.length }),
        pendingCount === 1 ? t('1 pending invitation') : undefined,
        pendingCount > 1
            ? t(':count pending invitations', { count: pendingCount })
            : undefined,
    ]
        .filter((part) => part !== undefined)
        .join(' · ');

    // A dialog opened from the menu of a row has no trigger to give the focus
    // back to. It returns to that menu, or to the heading of the card when
    // the row left with its member.
    const openedFromMenuOf = (member: WorkspaceMember): void =>
        openedFrom(() =>
            sectionRef.current?.querySelector<HTMLElement>(
                `[data-member-id="${member.id}"] [data-member-menu]`,
            ),
        );

    const changeRole = (member: WorkspaceMember, role: string): void => {
        router.patch(
            WorkspaceMembersController.update.url({
                workspace: workspace.slug,
                member: member.id,
            }),
            { role },
            {
                preserveScroll: true,
                onSuccess: () => setRoleError(null),
                onError: (errors) =>
                    setRoleError({
                        memberId: member.id,
                        message:
                            errors.role ??
                            t('Something went wrong. Please try again.'),
                    }),
            },
        );
    };

    const remove = async (member: WorkspaceMember): Promise<void> => {
        await removal.run((options) =>
            router.delete(
                WorkspaceMembersController.destroy.url({
                    workspace: workspace.slug,
                    member: member.id,
                }),
                options,
            ),
        );

        originRemoved();
    };

    return (
        <Card asChild>
            <section
                ref={sectionRef}
                data-slot="workspace-members"
                aria-labelledby={headingId}
            >
                <div
                    data-slot="members-header"
                    className="flex min-w-0 flex-wrap items-center gap-3 border-b px-5 py-4"
                >
                    <div className="flex min-w-32 flex-1 flex-col">
                        <h2
                            id={headingId}
                            ref={headingRef}
                            tabIndex={-1}
                            className="rounded-sm text-base font-semibold outline-ring focus-visible:outline-2 focus-visible:outline-offset-2"
                        >
                            {t('Members')}
                        </h2>
                        <p
                            data-slot="members-summary"
                            className="text-xs text-muted-foreground"
                        >
                            {summary}
                        </p>
                    </div>
                    {slots.headerAction}
                    <Button
                        size="sm"
                        className="max-w-full min-w-0"
                        onClick={() => setInviting(true)}
                    >
                        <UserPlus aria-hidden />
                        <span className="truncate">{t('Invite')}</span>
                    </Button>
                </div>

                {invitationUrl !== undefined && (
                    <InvitationLink url={invitationUrl} />
                )}

                <Table className={MembersLayout.table}>
                    <TableHeader className={MembersLayout.header}>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="px-5">
                                {t('Member')}
                            </TableHead>
                            <TableHead className="px-5">{t('Role')}</TableHead>
                            <TableHead className="px-5">
                                <span className="sr-only">{t('Actions')}</span>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody className={MembersLayout.body}>
                        {members.map((member) => (
                            <MemberRow
                                key={member.id}
                                member={member}
                                isSelf={member.id === currentUserId}
                                isOwner={isOwner}
                                error={
                                    roleError?.memberId === member.id
                                        ? roleError.message
                                        : undefined
                                }
                                onRoleChange={(role) =>
                                    changeRole(member, role)
                                }
                                onRemove={() => {
                                    openedFromMenuOf(member);
                                    removal.reset();
                                    setRemoving(member);
                                    setConfirming(true);
                                }}
                                onLeave={() => {
                                    openedFromMenuOf(member);
                                    setLeaving(true);
                                }}
                            />
                        ))}
                        <InvitationRows
                            invitations={invitations}
                            locale={locale}
                            actions={invitationActions}
                        />
                    </TableBody>
                </Table>

                <p
                    data-slot="members-footer"
                    className="rounded-b-xl border-t bg-muted/50 px-5 py-3 text-xs text-muted-foreground"
                >
                    {t(
                        'Admin: manages members, teams and templates. Owner: also names the owners and can delete the workspace.',
                    )}
                </p>

                <InviteDialog
                    open={inviting}
                    onOpenChange={setInviting}
                    workspace={workspace}
                    validForDays={invitationValidForDays}
                    slots={{
                        inviteTeamsField: (
                            <InviteTeamFields
                                teams={teams}
                                teamRoles={teamRoles}
                            />
                        ),
                        inviteMessageField: <InviteMessageField />,
                        ...slots,
                    }}
                />

                <ConfirmDialog
                    open={confirming}
                    onOpenChange={setConfirming}
                    tone="destructive"
                    title={t('Remove :name from this workspace?', {
                        name: removing?.name ?? '',
                    })}
                    description={t(
                        'They will lose access to the workspace and be removed from all of its teams.',
                    )}
                    confirmLabel={t('Remove from workspace')}
                    onConfirm={() =>
                        removing === null ? Promise.resolve() : remove(removing)
                    }
                    error={removal.error}
                />

                <RevokeInvitationDialog actions={invitationActions} />

                <LeaveWorkspaceDialog
                    open={leaving}
                    onOpenChange={setLeaving}
                    workspace={workspace}
                    adminsCount={viewerManages ? managers.length : undefined}
                    otherAdminName={otherAdmin?.name ?? null}
                />
            </section>
        </Card>
    );
}
