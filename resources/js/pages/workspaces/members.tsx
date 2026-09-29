import { Form, Head, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import WorkspaceInvitationsController from '@/actions/App/Http/Controllers/WorkspaceInvitationsController';
import WorkspaceMembersController from '@/actions/App/Http/Controllers/WorkspaceMembersController';
import WorkspacesController from '@/actions/App/Http/Controllers/WorkspacesController';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useTrans } from '@/hooks/use-trans';
import type {
    PendingInvitation,
    WorkspaceMember,
    WorkspaceRole,
    WorkspaceSummary,
} from '@/types';

type Props = {
    workspace: WorkspaceSummary;
    members: WorkspaceMember[];
    invitations: PendingInvitation[];
    isOwner: boolean;
};

const roleLabels: Record<WorkspaceRole, string> = {
    owner: 'Owner',
    admin: 'Admin',
    member: 'Member',
};

export default function WorkspaceMembers({
    workspace,
    members,
    invitations,
    isOwner,
}: Props) {
    const { t } = useTrans();
    const page = usePage();
    const { auth } = page.props;
    const invitationUrl = page.flash.invitationUrl;
    const [roleError, setRoleError] = useState<{
        memberId: string;
        message: string;
    } | null>(null);
    const assignableRoles: WorkspaceRole[] = isOwner
        ? ['owner', 'admin', 'member']
        : ['admin', 'member'];

    return (
        <>
            <Head title={t('Members')} />
            <div className="max-w-3xl space-y-10 p-4">
                <Heading title={t('Members')} description={workspace.name} />

                <ul className="divide-y rounded-md border">
                    {members.map((member) => (
                        <li
                            key={member.id}
                            className="flex items-center justify-between gap-4 p-3"
                        >
                            <div>
                                <div className="font-medium">{member.name}</div>
                                <div className="text-sm text-muted-foreground">
                                    {member.email}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {member.role === 'owner' && !isOwner ? (
                                    <Badge>{t(roleLabels.owner)}</Badge>
                                ) : (
                                    <div>
                                        <Select
                                            value={member.role}
                                            onValueChange={(role) =>
                                                router.patch(
                                                    WorkspaceMembersController.update.url(
                                                        {
                                                            workspace:
                                                                workspace.slug,
                                                            member: member.id,
                                                        },
                                                    ),
                                                    { role },
                                                    {
                                                        preserveScroll: true,
                                                        onSuccess: () =>
                                                            setRoleError(null),
                                                        onError: (errors) =>
                                                            setRoleError({
                                                                memberId:
                                                                    member.id,
                                                                message:
                                                                    errors.role,
                                                            }),
                                                    },
                                                )
                                            }
                                        >
                                            <SelectTrigger
                                                className="w-32"
                                                aria-label={t('Role')}
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {assignableRoles.map((role) => (
                                                    <SelectItem
                                                        key={role}
                                                        value={role}
                                                    >
                                                        {t(roleLabels[role])}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <InputError
                                            message={
                                                roleError?.memberId ===
                                                member.id
                                                    ? roleError.message
                                                    : undefined
                                            }
                                        />
                                    </div>
                                )}
                                {(member.role !== 'owner' || isOwner) && (
                                    <Form
                                        {...WorkspaceMembersController.destroy.form(
                                            {
                                                workspace: workspace.slug,
                                                member: member.id,
                                            },
                                        )}
                                        options={{ preserveScroll: true }}
                                    >
                                        {({ processing, errors }) => (
                                            <>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    disabled={processing}
                                                >
                                                    {member.id === auth.user.id
                                                        ? t('Leave')
                                                        : t('Remove')}
                                                </Button>
                                                <InputError
                                                    message={errors.member}
                                                />
                                            </>
                                        )}
                                    </Form>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>

                <section className="space-y-4">
                    <Heading variant="small" title={t('Invite people')} />
                    <Form
                        {...WorkspaceInvitationsController.store.form(
                            workspace.slug,
                        )}
                        resetOnSuccess={['email']}
                        options={{ preserveScroll: true }}
                        className="flex flex-wrap items-start gap-2"
                    >
                        {({ processing, errors }) => (
                            <>
                                <div className="min-w-64 flex-1">
                                    <Input
                                        type="email"
                                        name="email"
                                        required
                                        placeholder={t('Email address')}
                                        aria-label={t('Email address')}
                                    />
                                    <InputError message={errors.email} />
                                </div>
                                <Select name="role" defaultValue="member">
                                    <SelectTrigger
                                        className="w-32"
                                        aria-label={t('Role')}
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="member">
                                            {t(roleLabels.member)}
                                        </SelectItem>
                                        <SelectItem value="admin">
                                            {t(roleLabels.admin)}
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button disabled={processing}>
                                    {t('Send invitation')}
                                </Button>
                            </>
                        )}
                    </Form>

                    {invitationUrl && (
                        <div className="space-y-1 rounded-md border p-3 text-sm">
                            <p>
                                {t(
                                    'Email is not configured on this instance. Share this link with the invited person:',
                                )}
                            </p>
                            <Input
                                readOnly
                                value={invitationUrl}
                                onFocus={(event) =>
                                    event.currentTarget.select()
                                }
                            />
                        </div>
                    )}

                    <ul className="divide-y rounded-md border">
                        {invitations.map((invitation) => (
                            <li
                                key={invitation.id}
                                className="flex items-center justify-between p-3"
                            >
                                <div className="flex items-center gap-2">
                                    <span>{invitation.email}</span>
                                    <Badge variant="secondary">
                                        {t(roleLabels[invitation.role])}
                                    </Badge>
                                    {invitation.isExpired && (
                                        <Badge variant="destructive">
                                            {t('Expired')}
                                        </Badge>
                                    )}
                                </div>
                                <Form
                                    {...WorkspaceInvitationsController.destroy.form(
                                        {
                                            workspace: workspace.slug,
                                            invitation: invitation.id,
                                        },
                                    )}
                                    options={{ preserveScroll: true }}
                                >
                                    {({ processing }) => (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={processing}
                                        >
                                            {t('Revoke')}
                                        </Button>
                                    )}
                                </Form>
                            </li>
                        ))}
                    </ul>
                </section>

                {isOwner && (
                    <section className="space-y-3">
                        <Heading
                            variant="small"
                            title={t('Delete workspace')}
                            description={t(
                                'This permanently deletes the workspace, its teams and their retrospectives.',
                            )}
                        />
                        <Form
                            {...WorkspacesController.destroy.form(
                                workspace.slug,
                            )}
                        >
                            {({ processing }) => (
                                <Button
                                    variant="destructive"
                                    disabled={processing}
                                >
                                    {t('Delete workspace')}
                                </Button>
                            )}
                        </Form>
                    </section>
                )}
            </div>
        </>
    );
}
