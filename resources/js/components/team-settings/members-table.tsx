import { router, usePage } from '@inertiajs/react';
import { ChevronDown, Ellipsis, UserMinus } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import TeamMemberRolesController from '@/actions/App/Http/Controllers/TeamMemberRolesController';
import TeamMembersController from '@/actions/App/Http/Controllers/TeamMembersController';
import {
    pendingInvitationCount,
    PendingInvitationRows,
    RevokePendingInvitationDialog,
    usePendingInvitationActions,
} from '@/components/invitations/pending-invitations';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { SettingsPanel } from '@/components/team-settings/settings-panel';
import { PersonAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { CardMenu } from '@/components/ui/dropdown-menu';
import { RadioGroup } from '@/components/ui/radio-group';
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
import { InvitationLink } from '@/components/workspaces/invitations-table';
import { useMinWidth } from '@/hooks/use-min-width';
import { useNow } from '@/hooks/use-now';
import { useOnlineUserIds } from '@/hooks/use-online-user-ids';
import { useTrans } from '@/hooks/use-trans';
import { formatRelativeTime } from '@/lib/action-items/format';
import type { PendingInvitation } from '@/lib/invitations/types';
import { teamRoleLabel } from '@/lib/teams/roles';
import type {
    TeamRole,
    TeamRoleOption,
    TeamSettingsMember,
    TeamSummary,
} from '@/types';

/** 40rem: below it the table becomes a list and the role opens in a drawer. */
const TableMinWidth = 640;

type MembersTableProps = {
    workspaceSlug: string;
    team: TeamSummary;
    members: TeamSettingsMember[];
    /** Owners and managers change roles and remove members; the others read. */
    canManageMembers: boolean;
    roleOptions: TeamRoleOption[];
    /** The team's invitations not accepted yet, after the members; sent to the team's inviters only. */
    invitations?: PendingInvitation[];
    /** "Invitation link" and "Invite", at the end of the card header. */
    actions?: ReactNode;
};

type RoleError = { memberId: string; message: string };

function MemberIdentity({ member }: { member: TeamSettingsMember }) {
    const { t } = useTrans();

    return (
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
                    {member.isViewer && (
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
    );
}

function LastActivity({
    member,
    online,
    now,
}: {
    member: TeamSettingsMember;
    online: boolean;
    now: number;
}) {
    const { t } = useTrans();
    const { locale } = usePage().props;

    if (online) {
        return (
            <span data-test="member-last-activity" data-online="true">
                {t('Online')}
            </span>
        );
    }

    if (member.lastActiveAt === null) {
        return <span data-test="member-last-activity">{t('Never')}</span>;
    }

    return (
        <time data-test="member-last-activity" dateTime={member.lastActiveAt}>
            {formatRelativeTime(member.lastActiveAt, locale, now)}
        </time>
    );
}

function RoleError({ id, message }: { id: string; message?: string }) {
    if (message === undefined) {
        return null;
    }

    return (
        <p
            id={id}
            role="alert"
            data-slot="member-role-error"
            className="text-body-sm whitespace-normal text-skrum-destructive-text"
        >
            {message}
        </p>
    );
}

function RoleSelect({
    member,
    roleOptions,
    error,
    onChange,
}: {
    member: TeamSettingsMember;
    roleOptions: TeamRoleOption[];
    error?: string;
    onChange: (role: TeamRole) => void;
}) {
    const { t } = useTrans();
    const errorId = useId();

    return (
        // The form gives the select its native twin, `select[name="role-{id}"]`.
        <form
            className="flex min-w-0 flex-col gap-1"
            onSubmit={(event) => event.preventDefault()}
        >
            <Select
                name={`role-${member.id}`}
                value={member.role}
                onValueChange={(role) => onChange(role as TeamRole)}
            >
                <SelectTrigger
                    size="sm"
                    aria-label={t('Role of :name', { name: member.name })}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                    className="w-40 max-w-full"
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {roleOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <RoleError id={errorId} message={error} />
        </form>
    );
}

function RoleDrawerButton({
    member,
    roleOptions,
    error,
    onChange,
}: {
    member: TeamSettingsMember;
    roleOptions: TeamRoleOption[];
    error?: string;
    onChange: (role: TeamRole) => void;
}) {
    const { t } = useTrans();
    const errorId = useId();
    const [open, setOpen] = useState(false);
    const title = t('Role of :name', { name: member.name });

    return (
        <div className="flex min-w-0 flex-col gap-1">
            <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={title}
                aria-haspopup="dialog"
                aria-describedby={error ? errorId : undefined}
                onClick={() => setOpen(true)}
                className="w-40 max-w-full justify-between"
            >
                <span className="truncate">
                    {teamRoleLabel(member.role, t)}
                </span>
                <ChevronDown aria-hidden />
            </Button>
            <RoleError id={errorId} message={error} />
            <Drawer open={open} onOpenChange={setOpen}>
                <DrawerContent closeLabel={t('Close')}>
                    <DrawerHeader>
                        <DrawerTitle>{title}</DrawerTitle>
                    </DrawerHeader>
                    <RadioGroup<TeamRole>
                        aria-label={title}
                        value={member.role}
                        onValueChange={(role) => {
                            setOpen(false);
                            onChange(role);
                        }}
                        options={roleOptions}
                        className="px-4 pb-6"
                    />
                </DrawerContent>
            </Drawer>
        </div>
    );
}

/**
 * The Members card of Members & rituals (ScreenSettings frame a): who is in
 * the team, their role, when they were last seen, "Remove from team".
 */
export function MembersTable({
    workspaceSlug,
    team,
    members,
    canManageMembers,
    roleOptions,
    invitations = [],
    actions,
}: MembersTableProps): ReactElement {
    const { t } = useTrans();
    const invitationActions = usePendingInvitationActions(workspaceSlug);
    const pendingCount = pendingInvitationCount(invitations);
    const wide = useMinWidth(TableMinWidth);
    const online = useOnlineUserIds();
    const now = useNow(members);
    const headingRef = useRef<HTMLHeadingElement>(null);
    const memberLeft = useRef(false);
    const [roleError, setRoleError] = useState<RoleError | null>(null);
    const [removing, setRemoving] = useState<TeamSettingsMember | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [removeError, setRemoveError] = useState<string>();
    const scope = { workspace: workspaceSlug, team: team.id };

    // The row leaves with its member: the focus goes to the card's heading.
    useEffect(() => {
        if (!confirming && memberLeft.current) {
            memberLeft.current = false;
            headingRef.current?.focus();
        }
    }, [confirming]);

    const isOnline = (member: TeamSettingsMember): boolean =>
        member.isViewer || online.has(member.id);

    const changeRole = (member: TeamSettingsMember, role: TeamRole): void => {
        router.put(
            TeamMemberRolesController.update.url({
                ...scope,
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

    const remove = (member: TeamSettingsMember): Promise<void> =>
        new Promise((resolve, reject) => {
            setRemoveError(undefined);
            router.delete(
                TeamMembersController.destroy.url({
                    ...scope,
                    member: member.id,
                }),
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        memberLeft.current = true;
                        resolve();
                    },
                    onError: (errors) => {
                        const message =
                            Object.values(errors)[0] ??
                            t('Something went wrong. Please try again.');

                        setRemoveError(message);
                        reject(new Error(message));
                    },
                },
            );
        });

    const roleControl = (member: TeamSettingsMember) => {
        if (!canManageMembers || member.isViewer) {
            return (
                <span className="text-sm">{teamRoleLabel(member.role, t)}</span>
            );
        }

        const Control = wide ? RoleSelect : RoleDrawerButton;

        return (
            <Control
                member={member}
                roleOptions={roleOptions}
                error={
                    roleError?.memberId === member.id
                        ? roleError.message
                        : undefined
                }
                onChange={(role) => changeRole(member, role)}
            />
        );
    };

    const rowMenu = (member: TeamSettingsMember) => {
        if (!canManageMembers || member.isViewer) {
            return null;
        }

        return (
            <CardMenu
                label={t('Member actions')}
                trigger={
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t('Member actions')}
                    >
                        <Ellipsis aria-hidden />
                    </Button>
                }
                entries={[
                    {
                        type: 'item',
                        label: t('Remove from team'),
                        icon: UserMinus,
                        tone: 'danger',
                        onSelect: () => {
                            setRemoveError(undefined);
                            setRemoving(member);
                            setConfirming(true);
                        },
                    },
                ]}
            />
        );
    };

    return (
        <SettingsPanel
            id="members"
            title={t('Members')}
            subtitle={[
                members.length === 1
                    ? t('1 member')
                    : t(':count members', { count: members.length }),
                ...(pendingCount === 0
                    ? []
                    : [
                          pendingCount === 1
                              ? t('1 pending invitation')
                              : t(':count pending invitations', {
                                    count: pendingCount,
                                }),
                      ]),
            ].join(' · ')}
            actions={actions}
            headingRef={headingRef}
            flush
            footer={
                <p className="text-xs text-muted-foreground">
                    {t(
                        'Facilitator: drives phases, timer and reveal, and can take control of any open session. Observer: read-only, does not vote.',
                    )}
                </p>
            }
        >
            {invitationActions.resent !== null && (
                <InvitationLink
                    url={invitationActions.resent.url}
                    email={invitationActions.resent.email}
                />
            )}
            {wide ? (
                <Table data-test="team-members">
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="px-5">
                                {t('Member')}
                            </TableHead>
                            <TableHead className="px-5">{t('Role')}</TableHead>
                            <TableHead className="px-5">
                                {t('Last activity')}
                            </TableHead>
                            <TableHead className="px-5">
                                <span className="sr-only">{t('Actions')}</span>
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {members.map((member) => (
                            <TableRow
                                key={member.id}
                                data-member-id={member.id}
                            >
                                <TableCell className="w-full max-w-0 px-5 py-1.5">
                                    <MemberIdentity member={member} />
                                </TableCell>
                                <TableCell className="px-5 py-1.5">
                                    {roleControl(member)}
                                </TableCell>
                                <TableCell className="px-5 py-1.5 text-sm whitespace-nowrap text-muted-foreground">
                                    <LastActivity
                                        member={member}
                                        online={isOnline(member)}
                                        now={now}
                                    />
                                </TableCell>
                                <TableCell className="px-5 py-1.5 text-right">
                                    {rowMenu(member)}
                                </TableCell>
                            </TableRow>
                        ))}
                        <PendingInvitationRows
                            invitations={invitations}
                            actions={invitationActions}
                            variant="table"
                        />
                    </TableBody>
                </Table>
            ) : (
                <ul data-test="team-members" className="flex flex-col divide-y">
                    {members.map((member) => (
                        <li
                            key={member.id}
                            data-member-id={member.id}
                            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-5 py-3"
                        >
                            <MemberIdentity member={member} />
                            {rowMenu(member) ?? <span />}
                            <div className="min-w-0">{roleControl(member)}</div>
                            <span className="text-sm text-muted-foreground">
                                <LastActivity
                                    member={member}
                                    online={isOnline(member)}
                                    now={now}
                                />
                            </span>
                        </li>
                    ))}
                    <PendingInvitationRows
                        invitations={invitations}
                        actions={invitationActions}
                        variant="list"
                    />
                </ul>
            )}

            <RevokePendingInvitationDialog actions={invitationActions} />

            <ConfirmDialog
                open={confirming}
                onOpenChange={setConfirming}
                tone="destructive"
                title={t('Remove :name from :team?', {
                    name: removing?.name ?? '',
                    team: team.name,
                })}
                description={t(
                    'They stay in the workspace and can be added back to the team.',
                )}
                confirmLabel={t('Remove from team')}
                onConfirm={() =>
                    removing === null ? Promise.resolve() : remove(removing)
                }
                error={removeError}
            />
        </SettingsPanel>
    );
}
