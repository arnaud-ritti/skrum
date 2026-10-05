import { router, usePage } from '@inertiajs/react';
import { Mail, X } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import WorkspaceInvitationResendsController from '@/actions/App/Http/Controllers/WorkspaceInvitationResendsController';
import WorkspaceInvitationsController from '@/actions/App/Http/Controllers/WorkspaceInvitationsController';
import { ConfirmDialog } from '@/components/skrum/confirm-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { TableCell, TableRow } from '@/components/ui/table';
import { useRouterAction } from '@/components/workspaces/use-router-action';
import { useTrans } from '@/hooks/use-trans';
import type { PendingInvitation } from '@/lib/invitations/types';
import { teamRoleLabel } from '@/lib/teams/roles';

/** The props a resend or a revoke reloads. */
const ReloadedProps = ['pendingInvitations'];

export function pendingInvitationCount(
    invitations: PendingInvitation[],
): number {
    return invitations.filter((invitation) => invitation.status === 'pending')
        .length;
}

function invitationDay(invitedAt: string, locale: string): string {
    return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
    }).format(new Date(invitedAt));
}

/** What the rows and the confirmation share: one resend at a time, one invitation asked about. */
export function usePendingInvitationActions(workspaceSlug: string) {
    const { t } = useTrans();
    const revocation = useRouterAction();
    const [confirming, setConfirming] = useState(false);
    const [revoking, setRevoking] = useState<PendingInvitation | null>(null);
    const [resendingId, setResendingId] = useState<string | null>(null);
    const [resendError, setResendError] = useState<{
        id: string;
        message: string;
    } | null>(null);
    const [resent, setResent] = useState<{
        id: string;
        email: string;
        url: string;
    } | null>(null);

    const resend = (invitation: PendingInvitation): void => {
        if (resendingId !== null) {
            return;
        }

        let settled = false;

        router.post(
            WorkspaceInvitationResendsController.store.url({
                workspace: workspaceSlug,
                invitation: invitation.id,
            }),
            {},
            {
                preserveScroll: true,
                only: ReloadedProps,
                onStart: () => {
                    setResendingId(invitation.id);
                    setResendError(null);
                    setResent(null);
                },
                onSuccess: (page) => {
                    settled = true;
                    const url = page.flash.invitationUrl;

                    setResent(
                        url === undefined
                            ? null
                            : {
                                  id: invitation.id,
                                  email: invitation.email,
                                  url,
                              },
                    );
                    toast.success(
                        t('Invitation sent again to :email.', {
                            email: invitation.email,
                        }),
                    );
                },
                onError: (errors) => {
                    settled = true;
                    setResendError({
                        id: invitation.id,
                        message:
                            Object.values(errors)[0] ??
                            t('Something went wrong. Please try again.'),
                    });
                },
                onFinish: () => {
                    setResendingId(null);

                    if (!settled) {
                        setResendError({
                            id: invitation.id,
                            message: t(
                                'Something went wrong. Please try again.',
                            ),
                        });
                    }
                },
            },
        );
    };

    const askToRevoke = (invitation: PendingInvitation): void => {
        revocation.reset();
        setRevoking(invitation);
        setConfirming(true);
    };

    const revoke = (): Promise<void> => {
        if (revoking === null) {
            return Promise.resolve();
        }

        const revokedId = revoking.id;

        return revocation
            .run((options) =>
                router.delete(
                    WorkspaceInvitationsController.destroy.url({
                        workspace: workspaceSlug,
                        invitation: revokedId,
                    }),
                    { ...options, only: ReloadedProps },
                ),
            )
            .then(() =>
                setResent((current) =>
                    current?.id === revokedId ? null : current,
                ),
            );
    };

    return {
        resend,
        resendingId,
        resendError,
        resent,
        askToRevoke,
        revoke,
        revoking,
        revokeError: revocation.error,
        confirming,
        setConfirming,
    };
}

export type PendingInvitationActions = ReturnType<
    typeof usePendingInvitationActions
>;

function StatusBadge({ status }: { status: PendingInvitation['status'] }) {
    const { t } = useTrans();

    if (status === 'expired') {
        return (
            <Badge variant="muted" shape="pill">
                {t('Expired')}
            </Badge>
        );
    }

    if (status === 'declined') {
        return (
            <Badge variant="muted" shape="pill">
                {t('Declined')}
            </Badge>
        );
    }

    return (
        <Badge variant="warning" shape="pill">
            {t('Invitation pending')}
        </Badge>
    );
}

function InvitationIdentity({
    invitation,
    error,
}: {
    invitation: PendingInvitation;
    error?: string;
}) {
    const { t } = useTrans();
    const { locale } = usePage().props;

    return (
        <span className="flex min-w-0 items-center gap-2">
            <span
                aria-hidden
                className="grid size-6 shrink-0 place-items-center rounded-full border border-input bg-card text-muted-foreground"
            >
                <Mail className="size-3.5" />
            </span>
            <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm leading-4.5 font-semibold">
                    {invitation.email}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                    {t('Invited on :date', {
                        date: invitationDay(invitation.invitedAt, locale),
                    })}
                </span>
                {error !== undefined && (
                    <span
                        role="alert"
                        className="text-body-sm whitespace-normal text-skrum-destructive-text"
                    >
                        {error}
                    </span>
                )}
            </span>
        </span>
    );
}

function ResendButton({
    invitation,
    actions,
}: {
    invitation: PendingInvitation;
    actions: PendingInvitationActions;
}) {
    const { t } = useTrans();
    const resending = actions.resendingId === invitation.id;

    return (
        <Button
            variant="link"
            size="sm"
            disabled={resending}
            aria-label={t('Resend the invitation of :email', {
                email: invitation.email,
            })}
            onClick={() => actions.resend(invitation)}
        >
            {resending && <Spinner aria-label={t('Loading')} />}
            <span>{t('Resend')}</span>
        </Button>
    );
}

function RevokeButton({
    invitation,
    actions,
}: {
    invitation: PendingInvitation;
    actions: PendingInvitationActions;
}) {
    const { t } = useTrans();

    return (
        <Button
            variant="ghost"
            size="icon-sm"
            disabled={actions.resendingId === invitation.id}
            aria-label={t('Revoke the invitation of :email', {
                email: invitation.email,
            })}
            onClick={() => actions.askToRevoke(invitation)}
            className="text-muted-foreground hover:bg-skrum-destructive-soft hover:text-skrum-destructive-text"
        >
            <X aria-hidden />
        </Button>
    );
}

function InvitationButtons({
    invitation,
    actions,
}: {
    invitation: PendingInvitation;
    actions: PendingInvitationActions;
}) {
    return (
        <span className="inline-flex max-w-full flex-wrap items-center justify-end gap-1">
            <ResendButton invitation={invitation} actions={actions} />
            <RevokeButton invitation={invitation} actions={actions} />
        </span>
    );
}

function RoleText({ invitation }: { invitation: PendingInvitation }) {
    const { t } = useTrans();

    if (invitation.teamRole === null) {
        return null;
    }

    return (
        <span className="text-sm">{teamRoleLabel(invitation.teamRole, t)}</span>
    );
}

/**
 * The team's invitations that wait for an answer, after the members
 * (ScreenSettings frame a): the address and its date, the status, the team
 * role, "Resend" and the revoke action. `table` gives rows of the members
 * table, `list` the items of its phone list.
 */
export function PendingInvitationRows({
    invitations,
    actions,
    variant,
}: {
    invitations: PendingInvitation[];
    actions: PendingInvitationActions;
    variant: 'table' | 'list';
}): ReactNode {
    const errorFor = (invitation: PendingInvitation): string | undefined =>
        actions.resendError?.id === invitation.id
            ? actions.resendError.message
            : undefined;

    if (variant === 'list') {
        return invitations.map((invitation) => (
            <li
                key={invitation.id}
                data-slot="pending-invitation"
                data-invitation-email={invitation.email}
                aria-busy={actions.resendingId === invitation.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-5 py-3"
            >
                <InvitationIdentity
                    invitation={invitation}
                    error={errorFor(invitation)}
                />
                <InvitationButtons invitation={invitation} actions={actions} />
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <StatusBadge status={invitation.status} />
                    <RoleText invitation={invitation} />
                </span>
            </li>
        ));
    }

    return invitations.map((invitation) => (
        <TableRow
            key={invitation.id}
            data-slot="pending-invitation"
            data-invitation-email={invitation.email}
            aria-busy={actions.resendingId === invitation.id}
        >
            <TableCell className="w-full max-w-0 px-5 py-1.5">
                <InvitationIdentity
                    invitation={invitation}
                    error={errorFor(invitation)}
                />
            </TableCell>
            <TableCell className="px-5 py-1.5">
                <span className="flex flex-col items-start gap-1">
                    <StatusBadge status={invitation.status} />
                    <RoleText invitation={invitation} />
                </span>
            </TableCell>
            <TableCell className="px-5 py-1.5">
                <ResendButton invitation={invitation} actions={actions} />
            </TableCell>
            <TableCell className="px-5 py-1.5 text-right">
                <RevokeButton invitation={invitation} actions={actions} />
            </TableCell>
        </TableRow>
    ));
}

export function RevokePendingInvitationDialog({
    actions,
}: {
    actions: PendingInvitationActions;
}) {
    const { t } = useTrans();

    return (
        <ConfirmDialog
            open={actions.confirming}
            onOpenChange={actions.setConfirming}
            tone="destructive"
            title={t('Revoke the invitation of :email?', {
                email: actions.revoking?.email ?? '',
            })}
            description={t(
                'The link of the invitation stops working. You can invite this person again later.',
            )}
            confirmLabel={t('Revoke')}
            onConfirm={actions.revoke}
            error={actions.revokeError}
        />
    );
}
