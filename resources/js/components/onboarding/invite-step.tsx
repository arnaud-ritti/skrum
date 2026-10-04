import { router } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import OnboardingInvitationsController from '@/actions/App/Http/Controllers/OnboardingInvitationsController';
import OnboardingStepsController from '@/actions/App/Http/Controllers/OnboardingStepsController';
import TeamInviteLinksController from '@/actions/App/Http/Controllers/TeamInviteLinksController';
import { TeamInviteForm } from '@/components/invitations/team-invite-form';
import { StepHeading } from '@/components/onboarding/step-layout';
import { teamMarkData } from '@/components/skrum/team-mark';
import { useTrans } from '@/hooks/use-trans';
import type {
    InviteLink,
    TeamInvitationPayload,
    TeamRoleValue,
} from '@/lib/invitations/types';
import type { ColumnColor } from '@/lib/retro/types';

const Day = 24 * 60 * 60 * 1000;

const LinkProps = [
    'inviteLinkUrl',
    'inviteLinkExpiresInDays',
    'inviteLinkUsesCount',
];

export type OnboardingInviteLink = {
    url: string;
    expiresInDays: number;
    usesCount: number;
};

/**
 * Step 3, "Invite your teammates": the team's invite form, sent through the
 * onboarding, and the team's link, created once when the step first shows
 * without one.
 */
export function InviteStep({
    workspaceSlug,
    team,
    roles,
    link,
}: {
    workspaceSlug: string;
    team: { id: string; name: string; color: ColumnColor };
    roles: TeamRoleValue[];
    link: OnboardingInviteLink | null;
}) {
    const { t } = useTrans();
    const [linkBusy, setLinkBusy] = useState(false);
    const [skipping, setSkipping] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const linkCreated = useRef(false);
    const scope = { workspace: workspaceSlug, team: team.id };
    const linkUrl = link?.url ?? null;
    const expiresInDays = link?.expiresInDays ?? 0;

    const inviteLink = useMemo<InviteLink | null>(
        () =>
            linkUrl === null
                ? null
                : {
                      url: linkUrl,
                      expiresAt: new Date(
                          Date.now() + expiresInDays * Day,
                      ).toISOString(),
                      usesCount: link?.usesCount ?? 0,
                  },
        [linkUrl, expiresInDays, link?.usesCount],
    );

    const linkVisit = {
        preserveScroll: true,
        only: LinkProps,
        onStart: () => setLinkBusy(true),
        onFinish: () => setLinkBusy(false),
    };

    const createLink = (): void => {
        router.post(TeamInviteLinksController.store.url(scope), {}, linkVisit);
    };

    useEffect(() => {
        if (linkUrl !== null || linkCreated.current) {
            return;
        }

        linkCreated.current = true;
        createLink();
    });

    const replaceLink = (): Promise<void> =>
        new Promise((resolve, reject) => {
            router.post(
                TeamInviteLinksController.store.url(scope),
                {},
                {
                    ...linkVisit,
                    onSuccess: () => resolve(),
                    onFinish: () => {
                        setLinkBusy(false);
                        reject(
                            new Error(
                                t('Something went wrong. Please try again.'),
                            ),
                        );
                    },
                },
            );
        });

    const turnOffLink = (): void => {
        router.delete(TeamInviteLinksController.destroy.url(scope), linkVisit);
    };

    const send = (payload: TeamInvitationPayload): Promise<void> =>
        new Promise((resolve, reject) => {
            let settled = false;

            router.post(OnboardingInvitationsController.store.url(), payload, {
                preserveScroll: true,
                onSuccess: (page) => {
                    settled = true;
                    const count = page.flash.invitationsSent ?? 0;

                    setErrors({});
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
            <TeamInviteForm
                team={teamMarkData({ name: team.name, color: team.color })}
                roles={roles}
                defaultRole="member"
                inviteLink={{
                    link: inviteLink,
                    canManage: true,
                    onCreate: createLink,
                    onReplace: replaceLink,
                    onTurnOff: turnOffLink,
                    busy: linkBusy,
                }}
                onSubmit={send}
                onSkip={skip}
                errors={errors}
                processing={skipping}
            />
        </div>
    );
}
