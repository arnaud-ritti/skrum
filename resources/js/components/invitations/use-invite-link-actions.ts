import { router } from '@inertiajs/react';
import { useState } from 'react';
import { toast } from 'sonner';
import TeamInviteLinksController from '@/actions/App/Http/Controllers/TeamInviteLinksController';
import { useTrans } from '@/hooks/use-trans';

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
