import { Check, Copy, Mail, X } from 'lucide-react';
import { useId } from 'react';
import { toast } from 'sonner';
import type { PendingInvitationActions } from '@/components/invitations/pending-invitations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { TableCell, TableRow } from '@/components/ui/table';
import { MembersLayout } from '@/components/workspaces/members-layout';
import { useClipboard } from '@/hooks/use-clipboard';
import { useTrans } from '@/hooks/use-trans';
import { teamRoleLabel } from '@/lib/teams/roles';
import type { PendingInvitation } from '@/types';

function StatusBadge({ status }: { status: PendingInvitation['status'] }) {
    const { t } = useTrans();

    if (status === 'declined') {
        return (
            <Badge variant="muted" shape="pill">
                {t('Declined')}
            </Badge>
        );
    }

    if (status === 'expired') {
        return (
            <Badge variant="destructive" shape="pill">
                {t('Expired')}
            </Badge>
        );
    }

    return (
        <Badge variant="warning" shape="pill">
            {t('Invitation pending')}
        </Badge>
    );
}

function invitationDay(invitedAt: string, locale: string): string {
    return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
    }).format(new Date(invitedAt));
}

/**
 * The link of the invitation just sent. It exists only in the answer to
 * "Send invitation" or "Resend": the server keeps a hash of the token.
 */
/** The link of an invitation e-mail could not carry, named after its address when there is one. */
export function InvitationLink({
    url,
    email,
}: {
    url: string;
    email?: string;
}) {
    const { t } = useTrans();
    const textId = useId();
    const [copied, copy] = useClipboard();
    const linkCopied = copied === url;

    const copyLink = async (): Promise<void> => {
        if (!(await copy(url))) {
            toast.error(t('Something went wrong. Please try again.'));
        }
    };

    return (
        <div
            role="status"
            data-slot="invitation-link"
            className="flex min-w-0 flex-col gap-2 border-b bg-skrum-info-soft px-5 py-3"
        >
            <p id={textId} className="text-body-sm text-skrum-info-text">
                {email === undefined
                    ? t(
                          'Email is not configured on this instance. Share this link with the invited person:',
                      )
                    : t(
                          'Email is not configured on this instance. Share this link with :email:',
                          { email },
                      )}
            </p>
            <div className="flex min-w-0 items-center gap-2">
                <Input
                    readOnly
                    value={url}
                    aria-labelledby={textId}
                    className="min-w-0 flex-1 bg-card font-mono text-body-sm md:text-body-sm"
                    onFocus={(event) => event.currentTarget.select()}
                />
                <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => void copyLink()}
                >
                    {linkCopied ? <Check aria-hidden /> : <Copy aria-hidden />}
                    <span>{linkCopied ? t('Copied') : t('Copy link')}</span>
                </Button>
            </div>
        </div>
    );
}

function InvitationRow({
    invitation,
    locale,
    resending,
    busy,
    error,
    onResend,
    onRevoke,
}: {
    invitation: PendingInvitation;
    locale: string;
    resending: boolean;
    /** Another invitation is being sent again: one resend at a time. */
    busy: boolean;
    error?: string;
    onResend: () => void;
    onRevoke: () => void;
}) {
    const { t } = useTrans();
    const roleLabel = {
        owner: t('Owner'),
        admin: t('Admin'),
        member: t('Member'),
    }[invitation.role];
    const teamLabel =
        invitation.team === null
            ? null
            : invitation.teamRole === null
              ? invitation.team.name
              : `${invitation.team.name} (${teamRoleLabel(invitation.teamRole, t)})`;

    return (
        <TableRow
            data-slot="invitation-row"
            data-invitation-id={invitation.id}
            data-invitation-email={invitation.email}
            aria-busy={resending}
            className={MembersLayout.row}
        >
            <TableCell className={MembersLayout.person}>
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
                        <span
                            data-slot="invitation-details"
                            className="truncate text-xs text-muted-foreground"
                        >
                            {roleLabel}
                            {' · '}
                            {teamLabel !== null && `${teamLabel} · `}
                            {t('Invited on :date', {
                                date: invitationDay(
                                    invitation.invitedAt,
                                    locale,
                                ),
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
            </TableCell>
            <TableCell className={MembersLayout.wideCell}>
                <StatusBadge status={invitation.status} />
            </TableCell>
            <TableCell className={MembersLayout.wideActions}>
                <span className="inline-flex max-w-full flex-wrap items-center gap-1 @max-xl/card:-ml-3">
                    <Button
                        variant="link"
                        size="sm"
                        disabled={resending || busy}
                        aria-label={t('Resend the invitation of :email', {
                            email: invitation.email,
                        })}
                        onClick={onResend}
                    >
                        {resending && <Spinner aria-label={t('Loading')} />}
                        <span>{t('Resend')}</span>
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        disabled={resending}
                        aria-label={t('Revoke the invitation of :email', {
                            email: invitation.email,
                        })}
                        onClick={onRevoke}
                        className="text-skrum-destructive-text hover:bg-skrum-destructive-soft hover:text-skrum-destructive-text"
                    >
                        <X aria-hidden />
                        <span>{t('Revoke')}</span>
                    </Button>
                </span>
            </TableCell>
        </TableRow>
    );
}

/** The invitations that wait for an answer, as rows of the members table. */
export function InvitationRows({
    invitations,
    locale,
    actions,
}: {
    invitations: PendingInvitation[];
    locale: string;
    actions: PendingInvitationActions;
}) {
    return (
        <>
            {invitations.map((invitation) => (
                <InvitationRow
                    key={invitation.id}
                    invitation={invitation}
                    locale={locale}
                    resending={actions.resendingId === invitation.id}
                    busy={actions.resendingId !== null}
                    error={
                        actions.resendError?.id === invitation.id
                            ? actions.resendError.message
                            : undefined
                    }
                    onResend={() => actions.resend(invitation)}
                    onRevoke={() => actions.askToRevoke(invitation)}
                />
            ))}
        </>
    );
}
