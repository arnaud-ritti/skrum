import { router } from '@inertiajs/react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import TeamInviteLinksController from '@/actions/App/Http/Controllers/TeamInviteLinksController';
import { useTrans } from '@/hooks/use-trans';
import type { TeamInvitationPayload } from '@/lib/invitations/types';

type Scope = { workspace: string; team: string };

/**
 * The team invite link's visits, shared by the team dialog and the
 * onboarding step: each settles with the server's reason, or a generic one
 * when the visit ended without an answer.
 */
export function useInviteLinkActions(scope: Scope, only: string[]) {
    const { t } = useTrans();
    const [busy, setBusy] = useState(false);

    const visit = (method: 'post' | 'delete'): Promise<void> =>
        new Promise((resolve, reject) => {
            const generic = t('Something went wrong. Please try again.');
            let settled = false;
            const options = {
                preserveScroll: true,
                only,
                onStart: () => setBusy(true),
                onSuccess: () => {
                    settled = true;
                    resolve();
                },
                onError: (errors: Record<string, string>) => {
                    settled = true;
                    reject(new Error(Object.values(errors)[0] ?? generic));
                },
                onFinish: () => {
                    setBusy(false);

                    if (!settled) {
                        reject(new Error(generic));
                    }
                },
            };

            if (method === 'post') {
                router.post(
                    TeamInviteLinksController.store.url(scope),
                    {},
                    options,
                );

                return;
            }

            router.delete(
                TeamInviteLinksController.destroy.url(scope),
                options,
            );
        });

    const create = (): void => {
        visit('post').catch((failure: Error) => toast.error(failure.message));
    };

    return {
        busy,
        create,
        replace: () => visit('post'),
        turnOff: () => visit('delete'),
    };
}

/**
 * The invite form's send, shared by the team dialog and the onboarding step:
 * the field errors and the links of the invitations just sent, with a toast.
 */
export function useSendInvitations(url: string, only?: string[]) {
    const { t } = useTrans();
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [sentUrls, setSentUrls] = useState<string[]>([]);

    const reset = useCallback((): void => {
        setErrors({});
        setSentUrls([]);
    }, []);

    const send = (payload: TeamInvitationPayload): Promise<void> =>
        new Promise((resolve, reject) => {
            let settled = false;

            router.post(url, payload, {
                preserveScroll: true,
                ...(only === undefined ? {} : { only }),
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

    return { send, errors, sentUrls, reset };
}
