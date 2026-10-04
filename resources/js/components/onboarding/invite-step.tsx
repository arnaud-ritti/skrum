import { router } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import OnboardingInvitationsController from '@/actions/App/Http/Controllers/OnboardingInvitationsController';
import OnboardingStepsController from '@/actions/App/Http/Controllers/OnboardingStepsController';
import { TeamInviteForm } from '@/components/invitations/team-invite-form';
import { useInviteLinkActions } from '@/components/invitations/use-invite-link-actions';
import { StepHeading } from '@/components/onboarding/step-layout';
import { teamMarkData } from '@/components/skrum/team-mark';
import { InvitationLink } from '@/components/workspaces/invitations-table';
import { useTrans } from '@/hooks/use-trans';
import type {
    InviteLink,
    TeamInvitationPayload,
    TeamRoleValue,
} from '@/lib/invitations/types';
import type { ColumnColor } from '@/lib/retro/types';

const LinkProps = [
    'inviteLinkUrl',
    'inviteLinkExpiresAt',
    'inviteLinkUsesCount',
    'hasHadInviteLink',
];

/**
 * Step 3, "Invite your teammates": the team's invite form, sent through the
 * onboarding, and the team's link, created once when the step first shows
 * for a team that never had one: a link turned off stays off on a return.
 */
export function InviteStep({
    workspaceSlug,
    team,
    roles,
    link,
    hadLink,
}: {
    workspaceSlug: string;
    team: { id: string; name: string; color: ColumnColor };
    roles: TeamRoleValue[];
    link: InviteLink | null;
    hadLink: boolean;
}) {
    const { t } = useTrans();
    const [skipping, setSkipping] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [sentUrls, setSentUrls] = useState<string[]>([]);
    const linkCreated = useRef(false);
    const scope = { workspace: workspaceSlug, team: team.id };
    const linkUrl = link?.url ?? null;

    const linkActions = useInviteLinkActions(scope, LinkProps);
    const createLink = linkActions.create;

    useEffect(() => {
        if (hadLink || linkUrl !== null || linkCreated.current) {
            return;
        }

        linkCreated.current = true;
        createLink();
    });

    const send = (payload: TeamInvitationPayload): Promise<void> =>
        new Promise((resolve, reject) => {
            let settled = false;

            router.post(OnboardingInvitationsController.store.url(), payload, {
                preserveScroll: true,
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

    const skip = (): void => {
        router.put(
            OnboardingStepsController.update.url(),
            { step: 'ritual' },
            {
                preserveScroll: true,
                onStart: () => setSkipping(true),
                onFinish: () => setSkipping(false),
            },
        );
    };

    return (
        <div data-slot="invite-step" className="flex min-w-0 flex-col gap-5">
            <StepHeading number={3} title={t('Invite your teammates')} />
            {sentUrls.length > 0 && (
                <div className="flex min-w-0 flex-col overflow-hidden rounded-lg border [&>*:last-child]:border-b-0">
                    {sentUrls.map((url) => (
                        <InvitationLink key={url} url={url} />
                    ))}
                </div>
            )}
            <TeamInviteForm
                team={teamMarkData({ name: team.name, color: team.color })}
                roles={roles}
                defaultRole="member"
                inviteLink={{
                    link,
                    canManage: true,
                    onCreate: createLink,
                    onReplace: linkActions.replace,
                    onTurnOff: linkActions.turnOff,
                    busy: linkActions.busy,
                }}
                onSubmit={send}
                onSkip={skip}
                errors={errors}
                processing={skipping}
            />
        </div>
    );
}
