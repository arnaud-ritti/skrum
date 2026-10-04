import { router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import TeamInvitationsController from '@/actions/App/Http/Controllers/TeamInvitationsController';
import { TeamInviteForm } from '@/components/invitations/team-invite-form';
import { useInviteLinkActions } from '@/components/invitations/use-invite-link-actions';
import { TeamMark, teamMarkData } from '@/components/skrum/team-mark';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import { InvitationLink } from '@/components/workspaces/invitations-table';
import { useMinWidth } from '@/hooks/use-min-width';
import { useTrans } from '@/hooks/use-trans';
import type {
    InviteLink,
    TeamInvitationPayload,
    TeamRoleValue,
} from '@/lib/invitations/types';
import type { ColumnColor } from '@/lib/retro/types';

/** 48rem (`md`): below it the dialog is a drawer. */
const DialogMinWidth = 768;

const LinkProps = ['inviteLink'];

const SentProps = ['pendingInvitations'];

type Team = { id: string; name: string; color?: ColumnColor };

function focusLinkBlock(container: HTMLElement | null): boolean {
    const target = container?.querySelector<HTMLElement>(
        '[data-slot="invite-link-block"] button',
    );

    if (target === null || target === undefined) {
        return false;
    }

    target.focus();

    return true;
}

/**
 * "Invite to :team" (spec §10.5): the team's invite form in a dialog, a
 * drawer on a phone. Opening it loads the team's link (an optional prop);
 * `focusLink` puts the focus on the link block, for "Invitation link".
 */
export function TeamInviteDialog({
    workspaceSlug,
    team,
    roles,
    inviteLink,
    open,
    onOpenChange,
    focusLink = false,
}: {
    workspaceSlug: string;
    team: Team;
    roles: TeamRoleValue[];
    /** Absent until the dialog has loaded it; null when the team has no usable link. */
    inviteLink: InviteLink | null | undefined;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    focusLink?: boolean;
}) {
    const { t } = useTrans();
    const wide = useMinWidth(DialogMinWidth);
    const contentRef = useRef<HTMLDivElement>(null);
    const linkFocusPending = useRef(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [sentUrls, setSentUrls] = useState<string[]>([]);
    const scope = { workspace: workspaceSlug, team: team.id };
    const linkLoading = inviteLink === undefined;

    useEffect(() => {
        if (!open) {
            return;
        }

        setErrors({});
        setSentUrls([]);
        linkFocusPending.current = focusLink;
        router.reload({ only: LinkProps });
    }, [open, focusLink]);

    useEffect(() => {
        if (!open || !linkFocusPending.current || linkLoading) {
            return;
        }

        if (focusLinkBlock(contentRef.current)) {
            linkFocusPending.current = false;
        }
    }, [open, linkLoading, inviteLink]);

    const linkActions = useInviteLinkActions(scope, LinkProps);
    const createLink = linkActions.create;

    const send = (payload: TeamInvitationPayload): Promise<void> =>
        new Promise((resolve, reject) => {
            let settled = false;

            router.post(TeamInvitationsController.store.url(scope), payload, {
                preserveScroll: true,
                only: SentProps,
                onSuccess: (page) => {
                    settled = true;
                    const count = page.flash.invitationsSent ?? 0;

                    setErrors({});
                    setSentUrls(page.flash.invitationUrls ?? []);
                    toast.success(
                        count === 1
                            ? t('One invitation sent.')
                            : t(':count invitations sent.', { count }),
                    );
                    resolve();
                },
                onError: (failures) => {
                    settled = true;
                    setErrors(failures);
                    reject(new Error(Object.values(failures)[0]));
                },
                onFinish: () => {
                    if (settled) {
                        return;
                    }

                    toast.error(t('Something went wrong. Please try again.'));
                    reject(new Error('The invitations were not sent.'));
                },
            });
        });

    const title = (
        <span className="flex min-w-0 items-center gap-2">
            <TeamMark
                team={teamMarkData({
                    name: team.name,
                    color: team.color ?? 'coral',
                })}
            />
            <span className="min-w-0 wrap-anywhere">
                {t('Invite to :team', { team: team.name })}
            </span>
        </span>
    );

    const body: ReactNode = (
        <div ref={contentRef} className="flex min-w-0 flex-col gap-4">
            {sentUrls.length > 0 && (
                <div className="-mx-5 flex min-w-0 flex-col overflow-hidden border-t">
                    {sentUrls.map((url) => (
                        <InvitationLink key={url} url={url} />
                    ))}
                </div>
            )}
            <TeamInviteForm
                team={teamMarkData({
                    name: team.name,
                    color: team.color ?? 'coral',
                })}
                roles={roles}
                defaultRole="member"
                errors={errors}
                inviteLink={{
                    link: inviteLink ?? null,
                    canManage: !linkLoading,
                    busy: linkActions.busy,
                    onCreate: createLink,
                    onReplace: linkActions.replace,
                    onTurnOff: linkActions.turnOff,
                }}
                onSubmit={send}
            />
        </div>
    );

    const autoFocus = (event: Event): void => {
        if (!focusLink || linkLoading) {
            return;
        }

        event.preventDefault();
        linkFocusPending.current = !focusLinkBlock(contentRef.current);
    };

    if (!wide) {
        return (
            <Drawer open={open} onOpenChange={onOpenChange}>
                <DrawerContent
                    closeLabel={t('Close')}
                    aria-describedby={undefined}
                    onOpenAutoFocus={autoFocus}
                    className="overflow-y-auto"
                >
                    <DrawerHeader className="px-0">
                        <DrawerTitle>{title}</DrawerTitle>
                    </DrawerHeader>
                    {body}
                </DrawerContent>
            </Drawer>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                closeLabel={t('Close')}
                aria-describedby={undefined}
                onOpenAutoFocus={autoFocus}
            >
                <DialogHeader className="pr-8">
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                {body}
            </DialogContent>
        </Dialog>
    );
}
